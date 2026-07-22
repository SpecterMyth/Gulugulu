//! Steam 库存同步的纯逻辑层（零 Steam / 零 Tauri 类型，单元测试主战场）。
//!
//! 设计规则（plans/steam_trade/00-decisions.md，摘要）：
//! - 供给只由 Steam 服务器侧水龙头控制；本地一切内容是装饰与节奏，
//!   **对账职责是向 Steam 现实收敛，不是执法**。
//! - 认领优先于导入：未绑定一阶物品先认领给最旧 MintTier1，之后才准发新掉落
//!   ——否则崩溃窗口会把同一次孵化铸成两个物品（唯一的膨胀漏洞）。
//! - 对账按 itemdef 分组、计数收敛：同 def 物品不可区分，减员移除等级最低者、
//!   幸存者重绑；墓碑保等级。
//! - 写前意图（Fuse/CollectT2/Release）崩溃后由 `resolve_intents` 对照快照
//!   判定"已发生→补应用本地 / 没发生→弃意图解锁"。

use crate::game::{
    apply_collect, apply_release, new_id, release_refund_for, EggInstance, GameSave,
    PendingFusionInfo, PetInstance, SteamOp, SteamTombstone, STEAM_TOMBSTONE_CAP,
};
use crate::game_config::{GameConfig, STEAM_EGG_DEF_OFFSET};
use std::collections::{BTreeMap, BTreeSet};

/// GetAllItems 快照中的一个物品（quantity>0 的净持有）。
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapItem {
    pub item_id: String,
    pub def: u32,
    /// 该 item_id 上的堆叠数量。Steam 掉落/兑换会**自动堆叠**到同 def 既有实例上
    /// （steam_inventory A5 实证），一个 SnapItem 可能代表 N 件。对账计数收敛按**件数**
    /// 而非**去重 id 数**判定，避免「一摞 N 件只算 1 件 → 误删 N-1 只宠」（review 第 2 项）。
    pub quantity: u16,
}

#[derive(Debug, Default)]
pub struct ReconcileReport {
    pub imported_pets: usize,
    pub imported_eggs: usize,
    pub removed_pets: usize,
    pub removed_eggs: usize,
    /// 超出后院容量、暂存 SteamState 的待认领导入。
    pub unclaimed: Vec<SnapItem>,
    pub changed: bool,
}

/// 被写前意图引用的实体 id（宠物/蛋）——其他命令必须拒绝操作这些实体。
pub fn op_locked_ids(save: &GameSave) -> BTreeSet<String> {
    let mut locked = BTreeSet::new();
    for op in &save.steam_outbox {
        match op {
            SteamOp::Fuse { applied, pet_a, pet_b, egg_id, pet_id, .. } => {
                if *applied {
                    // 本地先行:双亲已删,锁待回绑的结果实体(蛋/宠)——收取/再融合/放生须等同步完成。
                    if let Some(e) = egg_id {
                        locked.insert(e.clone());
                    }
                    if let Some(p) = pet_id {
                        locked.insert(p.clone());
                    }
                } else {
                    locked.insert(pet_a.clone());
                    locked.insert(pet_b.clone());
                }
            }
            SteamOp::CollectT2 { egg_id, .. } => {
                locked.insert(egg_id.clone());
            }
            SteamOp::Release { pet_id, .. } => {
                locked.insert(pet_id.clone());
            }
            SteamOp::MintTier1 { .. } => {}
        }
    }
    locked
}

/// 该宠物是否有待发放的 MintTier1（"同步中"徽章 / 放生取消路径判定）。
pub fn pending_mint_for(save: &GameSave, pet_id: &str) -> Option<usize> {
    save.steam_outbox.iter().position(|op| {
        matches!(op, SteamOp::MintTier1 { pet_id: p, .. } if p == pet_id)
    })
}

/// 不可认领/不可导入的物品 id：本地实体（宠物/蛋）已绑定的，加上**本地先行**排队待
/// 在 Steam 上消耗的材料：
/// - applied Release 的放生物品（待 ConsumeItem）；
/// - applied Fuse 的两只融合材料（待 ExchangeItems 烧掉）。
/// 后者若不排除，材料在兑换收敛前会被对账/认领/手动导入当成新宠回导 = 复制漏洞
/// （本地已有二阶结果 + Steam 上两只一阶材料又被拉回本地）。
fn bound_item_ids(save: &GameSave) -> BTreeSet<String> {
    save.pets
        .iter()
        .filter_map(|p| p.steam_item_id.clone())
        .chain(save.eggs.iter().filter_map(|e| e.steam_item_id.clone()))
        .chain(save.steam_outbox.iter().flat_map(|op| match op {
            SteamOp::Release { item_id, applied: true, .. } => vec![item_id.clone()],
            // 只护**已铸出**（非空）的融合材料；空 = 尚未同步 Steam，本就没有物品可护。
            SteamOp::Fuse { applied: true, item_a, item_b, .. } => [item_a, item_b]
                .into_iter()
                .filter(|id| !id.is_empty())
                .cloned()
                .collect(),
            _ => Vec::new(),
        }))
        .collect()
}

/// 认领优先于导入：把快照里未绑定的一阶宠物物品，按 def 认领给最旧的
/// MintTier1 op（绑定宠物、移除 op）。返回是否有变更。
pub fn attach_mints(save: &mut GameSave, snapshot: &[SnapItem]) -> bool {
    let bound = bound_item_ids(save);
    // def → 未绑定物品 id 池（保持快照顺序）。
    let mut pool: BTreeMap<u32, Vec<String>> = BTreeMap::new();
    for item in snapshot {
        if !bound.contains(&item.item_id) {
            pool.entry(item.def).or_default().push(item.item_id.clone());
        }
    }
    let mut changed = false;
    // outbox 顺序即时间顺序（push 尾部）→ 从头扫描 = 最旧优先。
    let mut index = 0;
    while index < save.steam_outbox.len() {
        let claim = match &save.steam_outbox[index] {
            SteamOp::MintTier1 { pet_id, def, .. } => {
                let item = pool.get_mut(def).and_then(|ids| {
                    if ids.is_empty() {
                        None
                    } else {
                        Some(ids.remove(0))
                    }
                });
                item.map(|item_id| (pet_id.clone(), *def, item_id))
            }
            _ => None,
        };
        if let Some((pet_id, def, item_id)) = claim {
            if let Some(pet) = save.pets.iter_mut().find(|p| p.id == pet_id) {
                pet.steam_item_id = Some(item_id);
                pet.steam_item_def = Some(def);
            }
            // 宠物已不在（被本地删除等）也移除 op：物品会走导入路径回来。
            save.steam_outbox.remove(index);
            changed = true;
        } else {
            index += 1;
        }
    }
    changed
}

/// 崩溃恢复：对照快照回放写前意图。exchange/consume 在 Steam 侧是原子的——
/// 材料还在 = 没发生（弃意图解锁）；材料消失 = 已发生（补应用本地）。
/// 融合回放一律走配方路径（AI 掷骰不跨崩溃恢复，00-decisions.md）。
pub fn resolve_intents(
    config: &GameConfig,
    save: &mut GameSave,
    snapshot: &[SnapItem],
    now: i64,
) -> bool {
    let snapshot_ids: BTreeSet<&str> = snapshot.iter().map(|i| i.item_id.as_str()).collect();
    let mut changed = false;
    let mut index = 0;
    while index < save.steam_outbox.len() {
        let op = save.steam_outbox[index].clone();
        let resolved = match &op {
            SteamOp::MintTier1 { .. } => false,
            SteamOp::Fuse {
                applied,
                pet_a,
                pet_b,
                item_a,
                item_b,
                egg_def,
                recipe_key,
                egg_id,
                pet_id,
                parents,
                ..
            } => {
                let materials_gone = !snapshot_ids.contains(item_a.as_str())
                    && !snapshot_ids.contains(item_b.as_str());
                if *applied {
                    // 本地先行（2026-07-21）：本地已消耗双亲+建蛋。
                    // 材料尚未全部铸出（`item_x==""`）→ 泵还在 TriggerItemDrop 铸材料 → 保留 op，
                    //   不做快照对账（空 id 不在快照里，别误判成「材料已消失=兑换已发生」）。
                    // 两材料（部分）仍在 → 兑换未发生 → 保留 op 交给泵限频重试（不在这里做 Steam 调用）。
                    // 两材料都已铸且消失 → 兑换已发生 → 找未绑定结果补绑到蛋/宠，收 op。
                    if item_a.is_empty() || item_b.is_empty() || !materials_gone {
                        false
                    } else {
                        let bound = bound_item_ids(save);
                        let expected = expected_result_defs(*egg_def);
                        if let Some(found) = snapshot
                            .iter()
                            .find(|i| expected.contains(&i.def) && !bound.contains(&i.item_id))
                            .cloned()
                        {
                            let parents = parents.clone().unwrap_or_else(|| {
                                [
                                    crate::game::FALLBACK_SPECIES.to_string(),
                                    crate::game::FALLBACK_SPECIES.to_string(),
                                ]
                            });
                            apply_fused_result(
                                config, save, found.item_id, found.def, recipe_key, &parents,
                                egg_id.as_deref(), pet_id.as_deref(), now,
                            );
                        }
                        true
                    }
                } else if !materials_gone {
                    // 旧写前意图：材料（至少部分）仍在 → 兑换未发生 → 弃意图。
                    true
                } else {
                    // 旧写前意图 + 材料消失：兑换已发生 → 补应用本地（创建蛋 + 消耗双亲）。
                    //   期望结果集：并集生成器（20000 段）→ {0 号固定, AI 槽 ×10}；其余 → {egg_def 自身}。
                    let bound = bound_item_ids(save);
                    let expected = expected_result_defs(*egg_def);
                    let found = snapshot
                        .iter()
                        .find(|i| expected.contains(&i.def) && !bound.contains(&i.item_id))
                        .cloned();
                    if let Some(found) = found {
                        if (301..=399).contains(&found.def) {
                            // 旧流蛋物品（升级前的存量意图）：配方表物种，兼容旧存档。
                            let species = config
                                .fusion_table
                                .get(recipe_key)
                                .cloned()
                                .unwrap_or_else(|| crate::game::FALLBACK_SPECIES.to_string());
                            apply_fusion_local(
                                config, save, pet_a, pet_b, species, now,
                                Some((found.item_id, found.def)), None,
                            );
                        } else {
                            // 双亲物种须在消耗前捕获（apply_fusion_local 会删双亲）。
                            let species_of = |id: &str| {
                                save.pets
                                    .iter()
                                    .find(|p| p.id == id)
                                    .map(|p| p.species.clone())
                                    .unwrap_or_else(|| crate::game::FALLBACK_SPECIES.to_string())
                            };
                            let parents_arr = [species_of(pet_a), species_of(pet_b)];
                            let (species, pending) =
                                resolve_fused_species(config, save, found.def, recipe_key, &parents_arr, now);
                            apply_fusion_local(
                                config, save, pet_a, pet_b, species, now,
                                Some((found.item_id, found.def)), pending,
                            );
                        }
                    }
                    // 找不到结果物品（同窗口又被消耗等极端情况）→ 交给常规对账。
                    true
                }
            }
            SteamOp::CollectT2 {
                egg_id,
                egg_item,
                egg_def,
                ..
            } => {
                if snapshot_ids.contains(egg_item.as_str()) {
                    true // 蛋还在 → 兑换未发生 → 弃意图。
                } else {
                    let bound = bound_item_ids(save);
                    let expected_pet_def = egg_def.saturating_sub(STEAM_EGG_DEF_OFFSET);
                    // 优先精确 def，其次任何未绑定二阶宠物物品（将来随机开池）。
                    let granted = snapshot
                        .iter()
                        .find(|i| i.def == expected_pet_def && !bound.contains(&i.item_id))
                        .or_else(|| {
                            snapshot
                                .iter()
                                .find(|i| (201..=299).contains(&i.def) && !bound.contains(&i.item_id))
                        })
                        .cloned();
                    if let (Some(granted), Some(egg_index)) = (
                        granted,
                        save.eggs.iter().position(|e| e.id == *egg_id),
                    ) {
                        let species = collect_species_for(config, save, egg_index, granted.def);
                        apply_collect(
                            config,
                            save,
                            egg_index,
                            now,
                            Some((species, granted.item_id, granted.def)),
                        );
                    }
                    true
                }
            }
            SteamOp::Release { pet_id, item_id, applied, .. } => {
                if *applied {
                    // 本地先行（2026-07-18）：本地已删宠+已返还，op 只欠 ConsumeItem。
                    // 物品已从库存消失（消耗已发生 / 被交易走）→ 收工；仍在 → 保留
                    // 给 outbox 单飞限频重试（不在这里做 Steam 调用）。
                    !snapshot_ids.contains(item_id.as_str())
                } else if snapshot_ids.contains(item_id.as_str()) {
                    true // 旧写前意图：物品还在 → 消耗未发生 → 弃意图。
                } else {
                    if save.pets.iter().any(|p| p.id == *pet_id) {
                        let refund = release_refund_for(config, save, pet_id).unwrap_or(0);
                        apply_release(save, pet_id, refund);
                    }
                    true
                }
            }
        };
        if resolved {
            save.steam_outbox.remove(index);
            changed = true;
        } else {
            index += 1;
        }
    }
    changed
}

/// def → 物种 codename：配置目录（101-657 canonical/legacy）优先；AI 段
/// （10001..=15610）按确定性 codename 反解——该物种可能尚未在本机注册，
/// 由调用方决定复用（custom_species 已有）还是触发生成（pending_fusion）。
pub fn species_codename_for_def(config: &GameConfig, def: u32) -> Option<String> {
    config
        .species_for_steam_def(def)
        .map(|(codename, _)| codename.clone())
        .or_else(|| crate::fusion_slots::codename_for_ai_def(def))
}

/// 收取的本地物种：蛋已解析出 AI 自定义物种 → 用自定义 codename
/// （Steam 侧按目录物种记账）；否则信 Steam 实际发放的 def（随机就绪）——但
/// **只有 def 解析成本地已注册物种（目录 / 已导入变种）才可信**：未注册的 AI 槽
/// 码名（生成未成功的变种）当物种孵出会渲染成兜底鸭。生成未成功（挂起未解析）
/// 的蛋改孵**该配方的 0 号固有物种**（形象/名字都用它）；已定案蛋保留自身物种
/// （教学首融绑了变种 def 的容忍口径，与 apply_fused_result 一致）。
pub fn collect_species_for(
    config: &GameConfig,
    save: &GameSave,
    egg_index: usize,
    granted_def: u32,
) -> String {
    let egg = &save.eggs[egg_index];
    let pending = egg.pending_fusion.as_ref();
    let custom_resolved = pending
        .map(|p| p.status == "resolved" && save.custom_species.contains_key(&egg.species))
        .unwrap_or(false);
    if custom_resolved {
        return egg.species.clone();
    }
    let registered = species_codename_for_def(config, granted_def)
        .filter(|c| config.species.contains_key(c) || save.custom_species.contains_key(c));
    if let Some(code) = registered {
        return code;
    }
    if let Some(p) = pending {
        if let Some(canonical) = config.species_by_recipe.get(&p.recipe_key) {
            return canonical.clone();
        }
    }
    egg.species.clone()
}

/// 融合的本地应用（供命令第三段与意图回放共用）：扣费、删双亲、修 active、产出二阶蛋。
/// 物种由调用方决定（配方 / AI 兜底流程）；AI 路径传 `pending`（挂起生成，species 用 FALLBACK 占位）。
/// `egg_binding`：`Some((item_id, def))` = Steam 先行（三阶+，兑换已到手即绑）；
/// `None` = **本地先行**（二阶，蛋先建成未绑定，由后台 ExchangeItems 回绑）。
pub fn apply_fusion_local(
    config: &GameConfig,
    save: &mut GameSave,
    pet_a: &str,
    pet_b: &str,
    species: String,
    now: i64,
    egg_binding: Option<(String, u32)>,
    pending: Option<PendingFusionInfo>,
) -> String {
    // 每日融合计数（EconomyScaling.md §7.5）：优先取双亲并集键（须在移除前算）；
    // 崩溃重放等双亲已不在的场合退化为结果物种的集合键。
    let recipe_key = {
        let union_of = |id: &str| {
            save.pets
                .iter()
                .find(|p| p.id == id)
                .and_then(|p| crate::game::species_info(config, save, &p.species))
                .map(|s| s.elements.clone())
        };
        match (union_of(pet_a), union_of(pet_b)) {
            (Some(mut ea), Some(eb)) => {
                ea.extend(eb);
                Some(crate::fusion_slots::element_set_key(&ea))
            }
            _ => crate::game::species_info(config, save, &species)
                .map(|s| crate::fusion_slots::element_set_key(&s.elements)),
        }
    };
    if let Some(key) = recipe_key {
        crate::game::record_fusion_mint(save, &key);
    }
    // 结果阶 = 亲代阶 + 1（融合 2.0 全阶通用；亲代已不在 = 崩溃重放兜底 2 阶），
    // 费用按亲代阶（fusionFees 阶梯）。
    let parent_tier = save
        .pets
        .iter()
        .find(|p| p.id == pet_a || p.id == pet_b)
        .map(|p| p.tier)
        .unwrap_or(1);
    let result_tier = parent_tier.saturating_add(1).clamp(2, 6);
    save.coins = save.coins.saturating_sub(config.fusion_fee_for(parent_tier));
    save.pets.retain(|p| p.id != pet_a && p.id != pet_b);
    if let Some(active) = &save.active_pet_id {
        if active == pet_a || active == pet_b {
            save.active_pet_id = save.pets.first().map(|p| p.id.clone());
        }
    }
    let slot = {
        let slot_count = config.hatchery_slot_count(save.hatchery_level);
        let used: Vec<u8> = save.eggs.iter().filter_map(|egg| egg.slot).collect();
        (0..slot_count).find(|slot| !used.contains(slot))
    };
    let hatch_kind = format!("tier{result_tier}");
    let hatch_secs = config
        .hatch_seconds
        .get(&hatch_kind)
        .or_else(|| config.hatch_seconds.get("tier2"))
        .copied()
        .unwrap_or(1800);
    let hatch_at = slot.map(|_| now + hatch_secs as i64);
    let (steam_item_id, steam_item_def) = match egg_binding {
        Some((item_id, def)) => (Some(item_id), Some(def)),
        None => (None, None),
    };
    let egg_id = new_id("egg");
    save.eggs.push(EggInstance {
        id: egg_id.clone(),
        species,
        tier: result_tier,
        hatch_kind,
        slot,
        hatch_at,
        pending_fusion: pending,
        steam_item_id,
        steam_item_def,
        shop_element: None,
    });
    egg_id
}

/// 融合目标 def → 期望的结果物品 def 集合。并集生成器（20000 段）由服务器掷 0 号固定或
/// AI 槽，故展开成 {0 号固定, AI 槽 ×MAX_AI_SLOTS}；其余（同种自升阶 def / 旧流 3XX 蛋 def）
/// 即目标 def 自身。崩溃恢复据此在快照里找未绑定的实发结果。
fn expected_result_defs(egg_def: u32) -> Vec<u32> {
    if crate::fusion_slots::is_union_gen_def(egg_def) {
        let ord = (egg_def - crate::fusion_slots::UNION_GEN_BASE) as usize;
        std::iter::once(crate::fusion_slots::fixed_item_def(ord))
            .chain((1..=crate::fusion_slots::MAX_AI_SLOTS).map(|s| crate::fusion_slots::ai_item_def(ord, s)))
            .collect()
    } else {
        vec![egg_def]
    }
}

/// 实发结果 def → 融合落定的 `(物种, 挂起生成信息)`（供 Steam 先行第三段、本地先行泵回绑、
/// 崩溃恢复三处共用）：
/// - 已注册物种（目录 / 自定义）→ `(该物种, None)` = 确定落定（前端 recipe 模式）；
/// - 未注册 AI 槽 codename → `(FALLBACK, Some(pending{forced_codename 锁槽, parents}))` = 挂起生成（ai 模式）；
/// - 未知 def（不应发生）→ `(并集固定物种兜底, None)`。
pub fn resolve_fused_species(
    config: &GameConfig,
    save: &GameSave,
    granted_def: u32,
    recipe_key: &str,
    parents: &[String; 2],
    now: i64,
) -> (String, Option<PendingFusionInfo>) {
    let code = species_codename_for_def(config, granted_def);
    let registered = code
        .as_ref()
        .map(|c| config.species.contains_key(c) || save.custom_species.contains_key(c));
    match (code, registered) {
        (Some(code), Some(true)) => (code, None),
        (Some(code), _) => {
            let pending = PendingFusionInfo {
                parents: parents.clone(),
                recipe_key: recipe_key.to_string(),
                requested_at: now,
                attempts: 0,
                status: "pending".to_string(),
                last_error: None,
                forced_codename: Some(code),
                provider: None,
            };
            // 占位/兜底物种 = 该配方 0 号固有物种（生成失败/超期开蛋孵它，不退咕噜鸭）。
            let fallback = config
                .species_by_recipe
                .get(recipe_key)
                .cloned()
                .unwrap_or_else(|| crate::game::FALLBACK_SPECIES.to_string());
            (fallback, Some(pending))
        }
        (None, _) => {
            let fallback = config
                .species_by_recipe
                .get(recipe_key)
                .cloned()
                .unwrap_or_else(|| crate::game::FALLBACK_SPECIES.to_string());
            (fallback, None)
        }
    }
}

/// 本地先行融合的**结果回绑**：把实发结果物品绑到已存在的蛋（前向融合）或宠（存量二阶修复），
/// 并按实发 def 精化物种 / 挂起生成。供泵成功路径与崩溃恢复共用；双亲已在应用阶段消耗，此处不再动。
pub fn apply_fused_result(
    config: &GameConfig,
    save: &mut GameSave,
    granted_item_id: String,
    granted_def: u32,
    recipe_key: &str,
    parents: &[String; 2],
    egg_id: Option<&str>,
    pet_id: Option<&str>,
    now: i64,
) {
    let (species, pending) = resolve_fused_species(config, save, granted_def, recipe_key, parents, now);
    if let Some(egg_id) = egg_id {
        if let Some(egg) = save.eggs.iter_mut().find(|e| e.id == egg_id) {
            // 创建时已定案的蛋（pending_fusion 从未挂过 = 教学首融强制经典配方 / 已知 def 直接
            // 解析；AI 路径的蛋从创建到孵化 pending 恒为 Some，resolved 也只改 status）→ 只回绑
            // 物品，不改物种、不挂起生成。教学首融必须确定性孵出经典配方：并集生成器掷中 AI 槽
            // 时与下方宠分支同口径，容忍「本地经典物种 ↔ Steam 变种 def」的轻微不一致（可交易）。
            if egg.pending_fusion.is_some() {
                egg.species = species;
                egg.pending_fusion = pending;
            }
            egg.steam_item_id = Some(granted_item_id);
            egg.steam_item_def = Some(granted_def);
        }
    } else if let Some(pet_id) = pet_id {
        if let Some(pet) = save.pets.iter_mut().find(|p| p.id == pet_id) {
            // 宠物不挂 pending（不能生成）；已知 def 时落定物种，未知则保留原物种只补绑物品。
            if pending.is_none() {
                pet.species = species;
            }
            pet.steam_item_id = Some(granted_item_id);
            pet.steam_item_def = Some(granted_def);
        }
    }
}

fn push_tombstone(save: &mut GameSave, pet: &PetInstance, now: i64) {
    if let Some(item_id) = &pet.steam_item_id {
        save.steam_tombstones.push(SteamTombstone {
            item_id: item_id.clone(),
            species: pet.species.clone(),
            tier: pet.tier,
            level: pet.level,
            exp: pet.exp,
            removed_at: now,
        });
        if save.steam_tombstones.len() > STEAM_TOMBSTONE_CAP {
            let excess = save.steam_tombstones.len() - STEAM_TOMBSTONE_CAP;
            save.steam_tombstones.drain(0..excess);
        }
    }
}

/// 全量对账：以 Steam 快照为所有权事实源收敛本地状态。
/// `grace`：近期操作过的物品 id——既不据以剪除（快照可能未反映刚发生的授予），
/// 也不导入（可能是刚兑换掉的残影）。
pub fn reconcile(
    config: &GameConfig,
    save: &mut GameSave,
    snapshot: &[SnapItem],
    grace: &BTreeSet<String>,
    now: i64,
) -> ReconcileReport {
    let mut report = ReconcileReport::default();
    report.changed |= attach_mints(save, snapshot);

    let locked = op_locked_ids(save);
    let snapshot_ids: BTreeSet<&str> = snapshot.iter().map(|i| i.item_id.as_str()).collect();

    // --- 剪除/重绑（按 def 分组，计数收敛，等级最低者出局）------------------
    let mut defs: BTreeSet<u32> = save
        .pets
        .iter()
        .filter_map(|p| p.steam_item_def)
        .collect();
    defs.extend(snapshot.iter().map(|i| i.def));

    for def in defs.clone() {
        // 该 def 的幸存物品 id（含宽限期内视为幸存的绑定 id）。
        let mut surviving: Vec<String> = snapshot
            .iter()
            .filter(|i| i.def == def)
            .map(|i| i.item_id.clone())
            .collect();
        for pet in &save.pets {
            if pet.steam_item_def == Some(def) {
                if let Some(id) = &pet.steam_item_id {
                    if grace.contains(id) && !surviving.contains(id) {
                        surviving.push(id.clone());
                    }
                }
            }
        }
        // 参与收敛的绑定宠物（op-lock 的实体交给意图回放，不动）。
        let mut group: Vec<usize> = save
            .pets
            .iter()
            .enumerate()
            .filter(|(_, p)| p.steam_item_def == Some(def) && !locked.contains(&p.id))
            .map(|(i, _)| i)
            .collect();
        if group.is_empty() {
            continue;
        }
        // 等级高者优先保留：按 (level, exp) 降序排组内宠物。
        group.sort_by(|&a, &b| {
            let pa = &save.pets[a];
            let pb = &save.pets[b];
            (pb.level, pb.exp).cmp(&(pa.level, pa.exp))
        });
        // 按**件数**（含堆叠 quantity）而非去重 id 数收敛：一摞 N 件只算 1 个 surviving id 时，
        // 旧 keep=min(group, 去重id数) 会把本有 N 件撑着的 N-1 只宠误删（review 第 2 项）。
        // 每个 surviving id 取其快照 quantity（宽限期补进来的绑定 id 不在快照 → 计 1 件）。
        // total_units >= surviving.len() 恒成立 → keep 只增不减，纯保守（绝不比旧逻辑多删）。
        // 注：重绑仍只有 surviving.len() 个去重 id 可发，多留的宠暂维持既有（可能同 id）绑定，
        // 直到有拆栈路径——不新建绑定，只是不再误删。
        let total_units: usize = surviving
            .iter()
            .map(|id| {
                snapshot
                    .iter()
                    .find(|i| &i.item_id == id && i.def == def)
                    .map(|i| i.quantity as usize)
                    .unwrap_or(1)
            })
            .sum();
        let keep = group.len().min(total_units);
        // 重绑：幸存 id 分配给等级最高的 keep 只（id 同 def 可互换）。
        // 尽量保持原绑定：先把已在幸存集的绑定原样保留。
        let mut free_ids: Vec<String> = surviving
            .iter()
            .filter(|id| {
                !group[..keep]
                    .iter()
                    .any(|&i| save.pets[i].steam_item_id.as_ref() == Some(*id))
            })
            .cloned()
            .collect();
        for &i in &group[..keep] {
            let already_ok = save.pets[i]
                .steam_item_id
                .as_ref()
                .map(|id| surviving.contains(id))
                .unwrap_or(false);
            if !already_ok {
                if let Some(id) = free_ids.pop() {
                    if save.pets[i].steam_item_id.as_ref() != Some(&id) {
                        save.pets[i].steam_item_id = Some(id);
                        report.changed = true;
                    }
                }
            }
        }
        // 剪除：超出幸存数的（等级最低的）宠物 → 墓碑 + 移除。
        let mut to_remove: Vec<String> = group[keep..]
            .iter()
            .map(|&i| save.pets[i].id.clone())
            .collect();
        to_remove.sort();
        if !to_remove.is_empty() {
            let removed_pets: Vec<PetInstance> = save
                .pets
                .iter()
                .filter(|p| to_remove.contains(&p.id))
                .cloned()
                .collect();
            for pet in &removed_pets {
                push_tombstone(save, pet, now);
            }
            save.pets.retain(|p| !to_remove.contains(&p.id));
            report.removed_pets += removed_pets.len();
            report.changed = true;
        }
    }

    // 蛋：绑定物品消失（非宽限、非 op-lock）→ 蛋已在别处被兑换 → 本地移除。
    let eggs_before = save.eggs.len();
    save.eggs.retain(|egg| {
        let Some(item_id) = &egg.steam_item_id else {
            return true; // 本地蛋不受对账管辖。
        };
        if locked.contains(&egg.id) || grace.contains(item_id) {
            return true;
        }
        snapshot_ids.contains(item_id.as_str())
    });
    report.removed_eggs = eggs_before - save.eggs.len();
    report.changed |= report.removed_eggs > 0;

    // --- 导入（交易/市场购入/崩溃残留）---------------------------------------
    let bound = bound_item_ids(save);
    let capacity = config.yard_capacity_for(save.yard_level) as usize;
    for item in snapshot {
        if bound.contains(&item.item_id) || grace.contains(&item.item_id) {
            continue;
        }
        match item.def {
            // 一切可解析为宠物身份的 def：101-106 / 201-221（旧）+ 601-657 融合 2.0 目录物种
            // + 10001-15610 AI 变种。旧代码只认前两段（硬编码范围）→ 交易/市场购入的融合 2.0
            // 宠被 `_` 忽略、永不自动导入，但换出去却会被对账减员——非对称（review 第 3 项）。
            // 复用与手动导入同源的 build_imported_pet（墓碑优先复原 → cold_pet_species_tier 冷解析），
            // 对既有 101-221 段行为一致；返回 None 的 def（生成器等）自然落到 `_`。
            def if cold_pet_species_tier(config, def).is_some() => {
                if save.pets.len() >= capacity {
                    report.unclaimed.push(item.clone());
                    continue;
                }
                if let Some(pet) = build_imported_pet(config, save, item, now) {
                    save.pets.push(pet);
                    report.imported_pets += 1;
                    report.changed = true;
                }
            }
            301..=321 => {
                // 崩溃残留的融合蛋（意图丢失时）→ 以未入槽蛋导入。
                let species = config
                    .species_for_steam_def(item.def - STEAM_EGG_DEF_OFFSET)
                    .map(|(codename, _)| codename.clone())
                    .unwrap_or_else(|| crate::game::FALLBACK_SPECIES.to_string());
                save.eggs.push(EggInstance {
                    id: new_id("egg"),
                    species,
                    tier: 2,
                    hatch_kind: "tier2".to_string(),
                    slot: None,
                    hatch_at: None,
                    pending_fusion: None,
                    steam_item_id: Some(item.item_id.clone()),
                    steam_item_def: Some(item.def),
                    shop_element: None,
                });
                report.imported_eggs += 1;
                report.changed = true;
            }
            _ => {}
        }
    }

    // active_pet 修正（对账可清空全场）。
    let active_ok = save
        .active_pet_id
        .as_ref()
        .map(|id| save.pets.iter().any(|p| &p.id == id))
        .unwrap_or(false);
    if !active_ok {
        let next = save.pets.first().map(|p| p.id.clone());
        if save.active_pet_id != next {
            save.active_pet_id = next;
            report.changed = true;
        }
    }
    report
}

/// 迁移扫描：存量未绑定的一阶目录宠物补入 MintTier1 队列（幂等）。
/// 供给不会膨胀——发放仍被 Steam 限频兜底。
pub fn migration_sweep(config: &GameConfig, save: &mut GameSave) -> bool {
    let mut changed = false;
    let pending: BTreeSet<String> = save
        .steam_outbox
        .iter()
        .filter_map(|op| match op {
            SteamOp::MintTier1 { pet_id, .. } => Some(pet_id.clone()),
            _ => None,
        })
        .collect();
    let candidates: Vec<(String, String, u32)> = save
        .pets
        .iter()
        .filter(|p| p.tier == 1 && p.steam_item_id.is_none() && !pending.contains(&p.id))
        .filter_map(|p| {
            config
                .steam_def_for_species(&p.species)
                .map(|def| (p.id.clone(), p.species.clone(), def))
        })
        .collect();
    for (pet_id, species, def) in candidates {
        save.steam_outbox.push(SteamOp::MintTier1 {
            op_id: new_id("op"),
            pet_id,
            species,
            def,
            attempts: 0,
            next_retry_at: 0,
        });
        changed = true;
    }
    changed
}

/// 融合的**合法 Steam 兑换目标 def**：
/// - 多元素（跨物种）配方 → **并集生成器**（`20000+recipe_ordinal`，服务器按 bundle 掷 0 号固定/AI 槽）；
/// - 单元素配方 → 该配方 canonical 物种自身 def。
/// ⚠️ 绝不能拿多元素物种自身的 601-657 def 去兑换跨物种材料——那些 def 只带 `sp:*2` 自升阶兑换规则，
///   收到 `set:A`+`set:B` 跨物种材料会 `k_EResultFail`（教学首融曾因此永远同步不上 Steam）。
pub fn exchange_target_def(config: &GameConfig, recipe_key: &str) -> Option<u32> {
    if recipe_key.contains('+') {
        let keys: Vec<String> = config.species_by_recipe.keys().cloned().collect();
        let ordered = crate::fusion_slots::multi_element_recipes_ordered(&keys);
        crate::fusion_slots::recipe_ordinal(&ordered, recipe_key)
            .map(crate::fusion_slots::union_gen_def)
    } else {
        config
            .species_by_recipe
            .get(recipe_key)
            .and_then(|canonical| config.steam_def_for_species(canonical))
    }
}

/// 存量修复（2026-07-21c）：早期实现把跨物种融合 op 的兑换目标误设为 canonical 物种 def（601-657），
/// `ExchangeItems` 必 `k_EResultFail` 卡死（教学首融融不上 Steam）。重指向该配方的并集生成器（20000+），
/// 使泵能正常兑换。幂等（目标已正确则不动）。返回是否有变更。
pub fn retarget_cross_species_fuse_ops(config: &GameConfig, save: &mut GameSave) -> bool {
    let mut changed = false;
    for op in &mut save.steam_outbox {
        if let SteamOp::Fuse { applied: true, egg_def, recipe_key, .. } = op {
            if (601..=657).contains(egg_def) && recipe_key.contains('+') {
                if let Some(correct) = exchange_target_def(config, recipe_key.as_str()) {
                    if *egg_def != correct {
                        *egg_def = correct;
                        changed = true;
                    }
                }
            }
        }
    }
    changed
}

/// 本地先行融合**取材料身份**（不阻挡融合的关键）：
/// - 已同步 Steam（`steam_item_id=Some`）→ `(item_id, 0)`，无需铸；
/// - 未同步 Steam（含 MintTier1 待发放 / 纯本地）→ `("", 铸造 def)`：泵先 `TriggerItemDrop` 铸出材料再兑换。
///   同时**取消该宠的待发放 MintTier1**（把「铸这只一阶」的责任从独立 mint 转交给 Fuse op——
///   否则材料被单独铸出后成为孤儿物品，会被对账当新宠回导 = 复制）。def 优先取 mint op 的 def，
///   否则按物种目录 def（纯本地宠）。
pub fn take_fusion_material(config: &GameConfig, save: &mut GameSave, pet: &PetInstance) -> (String, u32) {
    if let Some(item) = &pet.steam_item_id {
        return (item.clone(), 0);
    }
    let mint_def = if let Some(idx) = save
        .steam_outbox
        .iter()
        .position(|op| matches!(op, SteamOp::MintTier1 { pet_id, .. } if pet_id == &pet.id))
    {
        let def = match &save.steam_outbox[idx] {
            SteamOp::MintTier1 { def, .. } => *def,
            _ => 0,
        };
        save.steam_outbox.remove(idx);
        def
    } else {
        config.steam_def_for_species(&pet.species).unwrap_or(0)
    };
    (String::new(), mint_def)
}

/// 存量二阶宠修复（2026-07-21）：旧教学纯本地融合遗留的**未同步 Steam**二阶宠（`steam_item_id==None`），
/// 若后院恰有 ≥2 只已同步 Steam、其元素并集配方与之匹配的一阶宠作材料，则**本地先行**地消耗这两只材料，
/// 并排 `Fuse{applied, pet_id}` 由泵烧材料 + 按**该二阶宠自身物种 def**（确定性，非并集生成器）
/// 铸出物品回绑到这只宠。材料物品在兑换收敛前由 `bound_item_ids` 保护，不被对账回导。
/// 保守：仅在精确匹配材料在场时动手；绝不吃不匹配的宠、不膨胀供给。幂等（已被 Fuse op 引用/
/// op-lock 的实体跳过；本轮已征用的材料不复用）。返回是否有变更。
pub fn repair_unbound_tier2(config: &GameConfig, save: &mut GameSave) -> bool {
    // 已被任一 Fuse op 引用的绑定目标（蛋/宠）不重复处理。
    let referenced: BTreeSet<String> = save
        .steam_outbox
        .iter()
        .flat_map(|op| match op {
            SteamOp::Fuse { egg_id, pet_id, .. } => {
                egg_id.iter().chain(pet_id.iter()).cloned().collect::<Vec<_>>()
            }
            _ => Vec::new(),
        })
        .collect();
    let locked = op_locked_ids(save);

    let targets: Vec<String> = save
        .pets
        .iter()
        .filter(|p| {
            p.tier == 2
                && p.steam_item_id.is_none()
                && !referenced.contains(&p.id)
                && !locked.contains(&p.id)
        })
        .map(|p| p.id.clone())
        .collect();

    let mut changed = false;
    let mut consumed: BTreeSet<String> = BTreeSet::new(); // 本轮已征用的材料宠，避免跨目标复用。
    for pet_id in targets {
        // 目标宠的物种 / 并集配方键 / 自身固定物种 def。
        let (recipe_key, target_def) = {
            let Some(pet) = save.pets.iter().find(|p| p.id == pet_id) else {
                continue;
            };
            let species = pet.species.clone();
            let Some(info) = crate::game::species_info(config, save, &species) else {
                continue;
            };
            let recipe_key = crate::fusion_slots::element_set_key(&info.elements);
            // ⚠️ 跨物种（多元素）必须走并集生成器兑换，不能用该宠自身 601-657 def（只带 sp:*2 自升阶，会 k_EResultFail）。
            let Some(target_def) = exchange_target_def(config, &recipe_key) else {
                continue;
            };
            (recipe_key, target_def)
        };

        // 候选材料：**Lv1** 已同步 Steam、非被引用/锁定/本轮已征用的一阶宠（连同元素集）。
        // 只烧 Lv1（对账回导的复制宠恒为 Lv1/exp0，是这个 bug 的确定签名）——用户已练过的
        // 宠（level>1）绝不当材料吃掉；若无 Lv1 匹配材料则跳过、留二阶宠本地，交给用户处理。
        let candidates: Vec<(String, String, Vec<String>)> = save
            .pets
            .iter()
            .filter(|p| {
                p.tier == 1
                    && p.level <= 1
                    && p.steam_item_id.is_some()
                    && !referenced.contains(&p.id)
                    && !locked.contains(&p.id)
                    && !consumed.contains(&p.id)
            })
            .filter_map(|p| {
                crate::game::species_info(config, save, &p.species)
                    .map(|s| (p.id.clone(), p.species.clone(), s.elements.clone()))
            })
            .collect();

        // 找元素并集恰等于目标配方的两只。
        let mut pair: Option<(usize, usize)> = None;
        'search: for i in 0..candidates.len() {
            for j in (i + 1)..candidates.len() {
                let mut union = candidates[i].2.clone();
                union.extend(candidates[j].2.clone());
                if crate::fusion_slots::element_set_key(&union) == recipe_key {
                    pair = Some((i, j));
                    break 'search;
                }
            }
        }
        let Some((i, j)) = pair else { continue };
        let (id_a, sp_a, _) = candidates[i].clone();
        let (id_b, sp_b, _) = candidates[j].clone();
        let item_a = save
            .pets
            .iter()
            .find(|p| p.id == id_a)
            .and_then(|p| p.steam_item_id.clone());
        let item_b = save
            .pets
            .iter()
            .find(|p| p.id == id_b)
            .and_then(|p| p.steam_item_id.clone());
        let (Some(item_a), Some(item_b)) = (item_a, item_b) else {
            continue;
        };

        // 本地先行：删两只材料宠（物品受 bound_item_ids 保护）+ 排后台兑换。
        save.pets.retain(|p| p.id != id_a && p.id != id_b);
        if let Some(active) = &save.active_pet_id {
            if active == &id_a || active == &id_b {
                save.active_pet_id = save.pets.first().map(|p| p.id.clone());
            }
        }
        consumed.insert(id_a);
        consumed.insert(id_b);
        save.steam_outbox.push(SteamOp::Fuse {
            op_id: new_id("op"),
            pet_a: String::new(),
            pet_b: String::new(),
            item_a,
            item_b,
            egg_def: target_def,
            recipe_key,
            applied: true,
            mat_def_a: 0, // 修复用的材料恒已同步 Steam（item 非空）→ 无需铸。
            mat_def_b: 0,
            egg_id: None,
            pet_id: Some(pet_id),
            parents: Some([sp_a, sp_b]),
            attempts: 0,
            next_retry_at: 0,
        });
        changed = true;
    }
    changed
}

/// 跨账号存档：剥离全部 Steam 绑定/队列/墓碑并重打 owner（用户确认后调用）。
pub fn strip_steam_bindings(save: &mut GameSave, new_owner: String) {
    for pet in &mut save.pets {
        pet.steam_item_id = None;
        pet.steam_item_def = None;
    }
    for egg in &mut save.eggs {
        egg.steam_item_id = None;
        egg.steam_item_def = None;
    }
    save.steam_outbox.clear();
    save.steam_tombstones.clear();
    save.steam_owner_id = Some(new_owner);
}

/// outbox 限频退避（分钟）：1 → 2 → 5 → 10（封顶）。MintTier1 的 TriggerItemDrop
/// 与本地先行放生的 ConsumeItem 共用同一节奏。
pub fn mint_backoff_secs(attempts: u32) -> i64 {
    match attempts {
        0 => 60,
        1 => 120,
        2 => 300,
        _ => 600,
    }
}

// ---------------------------------------------------------------------------
// 手动「导入我的宠物」（交易市场按钮）—— 把 Steam 库存里全部未绑定的宠物物品
// 一次性拉进后院空位，品阶高者优先（后院满时高阶先入、低阶留 Steam 待认领）。
// 与自动对账（reconcile）分职：只**新增**、只**填空位**，绝不剪除或驱逐已放置的
// 宠物；反复调用幂等（已绑定物品跳过 = 不重复导入）。
// ---------------------------------------------------------------------------

#[derive(Debug, Default, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPetsReport {
    /// 本次导入到后院的只数。
    pub imported: usize,
    /// 因后院已满而未导入（留在 Steam 待认领）的只数。
    pub skipped_capacity: usize,
    pub changed: bool,
    /// 因容量未导入、仍留 Steam 的宠物物品 —— 供状态徽章"待认领"计数。
    /// 不下发前端（前端只用计数）。
    #[serde(skip)]
    pub unclaimed_items: Vec<SnapItem>,
}

/// 冷导入（无本地历史）的 def → (物种 codename, 实例阶数) 解析。
/// - 目录物种（101-106 一阶 / 201-221 旧二阶 / 601-657 多元素固定）：取目录物种；
///   自带阶数为 0 的多元素物种按元素数落 [2,6]（阶数在实例上，冷导入按元素数近似）。
/// - AI 变种（10001-15610）：按确定性 codename 反解（外观可能尚未在本机注册，
///   渲染层对未知物种有兜底），阶数按其配方元素数落 [2,6]。
/// - 其它（蛋 / 生成器 / 未知）→ None（不是可导入的宠物物品）。
pub fn cold_pet_species_tier(config: &GameConfig, def: u32) -> Option<(String, u8)> {
    if let Some((codename, info)) = config.species_for_steam_def(def) {
        let tier = if info.tier > 0 {
            info.tier
        } else {
            (info.elements.len() as u8).clamp(2, 6)
        };
        return Some((codename.clone(), tier));
    }
    if let Some(codename) = crate::fusion_slots::codename_for_ai_def(def) {
        let tier = ai_variant_tier(config, def);
        return Some((codename, tier));
    }
    None
}

/// AI 变种 def 的近似阶数：由 itemdef 序号（def = 10000 + 序号*100 + 槽）反查其配方，
/// 阶数按配方元素数落 [2,6]。查不到（越界/配方缺失）→ 2（融合最低阶兜底）。
fn ai_variant_tier(config: &GameConfig, def: u32) -> u8 {
    let Some(rest) = def.checked_sub(crate::fusion_slots::AI_ITEM_DEF_BASE) else {
        return 2;
    };
    let ordinal = (rest / 100) as usize;
    let keys: Vec<String> = config.species_by_recipe.keys().cloned().collect();
    let ordered = crate::fusion_slots::multi_element_recipes_ordered(&keys);
    ordered
        .get(ordinal)
        .map(|recipe| (crate::fusion_slots::recipe_element_count(recipe) as u8).clamp(2, 6))
        .unwrap_or(2)
}

/// 从一件未绑定的宠物物品构造 PetInstance：墓碑复原优先（同 id 回流保等级），
/// 否则按 `cold_pet_species_tier` 冷解析。返回 None = 该 def 非可导入宠物物品。
/// ⚠️ 命中墓碑会将其从 `steam_tombstones` 移除（消费一次）。
fn build_imported_pet(
    config: &GameConfig,
    save: &mut GameSave,
    item: &SnapItem,
    now: i64,
) -> Option<PetInstance> {
    if let Some(ti) = save
        .steam_tombstones
        .iter()
        .position(|t| t.item_id == item.item_id)
    {
        let tomb = save.steam_tombstones.remove(ti);
        return Some(PetInstance {
            id: new_id("pet"),
            species: tomb.species,
            tier: tomb.tier,
            level: tomb.level,
            exp: tomb.exp,
            stamina: config.stamina_max,
            stamina_updated_at: now,
            exhausted: false,
            key_buffer: 0,
            token_buffer: 0,
            steam_item_id: Some(item.item_id.clone()),
            steam_item_def: Some(item.def),
        });
    }
    let (species, tier) = cold_pet_species_tier(config, item.def)?;
    Some(PetInstance {
        id: new_id("pet"),
        species,
        tier,
        level: 1,
        exp: 0,
        stamina: config.stamina_max,
        stamina_updated_at: now,
        exhausted: false,
        key_buffer: 0,
        token_buffer: 0,
        steam_item_id: Some(item.item_id.clone()),
        steam_item_def: Some(item.def),
    })
}

/// 「导入我的宠物」核心：把快照里全部未绑定的宠物物品填入后院空位，品阶降序优先。
/// 后院满 → 剩余（低阶）计入 `skipped_capacity`，仍留在 Steam 侧（下次对账挂待认领）。
/// 不剪除、不驱逐已放置的宠物；已绑定物品天然跳过 → 反复调用不重复导入。
pub fn import_inventory_pets(
    config: &GameConfig,
    save: &mut GameSave,
    snapshot: &[SnapItem],
    now: i64,
) -> ImportPetsReport {
    let mut report = ImportPetsReport::default();
    // 认领优先于导入（00-decisions.md 唯一膨胀漏洞防线）：先把未绑定一阶物品认领
    // 给待发放的 MintTier1，避免同一物品既被认领又被当新宠导入。
    report.changed |= attach_mints(save, snapshot);
    let bound = bound_item_ids(save);

    // 候选 = 未绑定 ∧ 身份可解析为宠物 def 的物品，连同用于排序的阶数
    // （墓碑给精确阶，否则用 def 冷解析阶）。
    let mut candidates: Vec<(u8, u32, SnapItem)> = Vec::new();
    for item in snapshot {
        if bound.contains(&item.item_id) {
            continue;
        }
        let rank_tier = if let Some(tomb) = save
            .steam_tombstones
            .iter()
            .find(|t| t.item_id == item.item_id)
        {
            tomb.tier
        } else if let Some((_, tier)) = cold_pet_species_tier(config, item.def) {
            tier
        } else {
            continue; // 蛋 / 生成器 / 未知 —— 非宠物物品。
        };
        candidates.push((rank_tier, item.def, item.clone()));
    }

    // 品阶降序；同阶按 def 降序（编号越大越"新/稀有"，且确定性稳定）。
    candidates.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| b.1.cmp(&a.1)));

    let capacity = config.yard_capacity_for(save.yard_level) as usize;
    for (_, _, item) in candidates {
        if save.pets.len() >= capacity {
            report.skipped_capacity += 1;
            report.unclaimed_items.push(item);
            continue;
        }
        if let Some(pet) = build_imported_pet(config, save, &item, now) {
            save.pets.push(pet);
            report.imported += 1;
            report.changed = true;
        }
    }

    // 图鉴同步：当前持有（含刚导入）的每个物种在图鉴里确保"已收集"（曾获 ≥1）。
    // 幂等——不膨胀曾获计数（反复导入不重复加），也修复历史上冷导入未入册的存量宠。
    let owned: BTreeSet<String> = save.pets.iter().map(|p| p.species.clone()).collect();
    for species in owned {
        let count = save.dex_obtained.entry(species).or_insert(0);
        if *count < 1 {
            *count = 1;
            report.changed = true;
        }
    }

    // 首次导入到空后院时点亮一只主宠。
    if save.active_pet_id.is_none() {
        if let Some(first) = save.pets.first() {
            save.active_pet_id = Some(first.id.clone());
            report.changed = true;
        }
    }
    report
}

/// 需要向创意工坊解析形象的 AI 变种 codename：当前存档里被宠物引用、是合法 AI 槽
/// codename（`aif<序><槽>`）、且本机既非目录物种也未注册自定义形象 —— 否则渲染回退
/// 兜底鸭。导入/同步后按此逐个查工坊首发形象补齐（去重、保持宠物顺序）。
pub fn unresolved_ai_species(config: &GameConfig, save: &GameSave) -> Vec<String> {
    let mut seen = BTreeSet::new();
    let mut out = Vec::new();
    for pet in &save.pets {
        let code = &pet.species;
        if config.species.contains_key(code) || save.custom_species.contains_key(code) {
            continue; // 已有形象（目录 / 自定义）。
        }
        if crate::fusion_slots::ai_def_for_codename(code).is_none() {
            continue; // 非新式 AI 槽 codename —— 无从工坊解析。
        }
        if seen.insert(code.clone()) {
            out.push(code.clone());
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game::create_initial_save;
    use std::collections::BTreeMap;

    fn config() -> GameConfig {
        serde_json::from_str(include_str!("../../src/game/config.json")).unwrap()
    }

    fn fresh(config: &GameConfig) -> GameSave {
        let mut save = create_initial_save(config, 0, BTreeMap::new(), 1000, "2026-07-12");
        save.eggs.clear();
        save
    }

    fn add_pet(save: &mut GameSave, species: &str, tier: u8, level: u32) -> String {
        let id = new_id("pet");
        save.pets.push(PetInstance {
            id: id.clone(),
            species: species.into(),
            tier,
            level,
            exp: 0,
            stamina: 100,
            stamina_updated_at: 1000,
            exhausted: false,
            key_buffer: 0,
            token_buffer: 0,
            steam_item_id: None,
            steam_item_def: None,
        });
        id
    }

    fn bind(save: &mut GameSave, pet_id: &str, item: &str, def: u32) {
        let pet = save.pets.iter_mut().find(|p| p.id == pet_id).unwrap();
        pet.steam_item_id = Some(item.into());
        pet.steam_item_def = Some(def);
    }

    fn snap(items: &[(&str, u32)]) -> Vec<SnapItem> {
        items
            .iter()
            .map(|(id, def)| SnapItem {
                item_id: id.to_string(),
                def: *def,
                quantity: 1,
            })
            .collect()
    }

    fn queue_mint(save: &mut GameSave, pet_id: &str, species: &str, def: u32) {
        save.steam_outbox.push(SteamOp::MintTier1 {
            op_id: new_id("op"),
            pet_id: pet_id.into(),
            species: species.into(),
            def,
            attempts: 0,
            next_retry_at: 0,
        });
    }

    #[test]
    fn attach_binds_oldest_mint_before_import() {
        let config = config();
        let mut save = fresh(&config);
        let old = add_pet(&mut save, "guluduck", 1, 3);
        let newer = add_pet(&mut save, "guluduck", 1, 1);
        queue_mint(&mut save, &old, "guluduck", 101);
        queue_mint(&mut save, &newer, "guluduck", 101);

        // 一个未绑定 101 物品 → 认领给最旧 op；不产生导入。
        let snapshot = snap(&[("item-1", 101)]);
        assert!(attach_mints(&mut save, &snapshot));
        let old_pet = save.pets.iter().find(|p| p.id == old).unwrap();
        assert_eq!(old_pet.steam_item_id.as_deref(), Some("item-1"));
        assert_eq!(save.steam_outbox.len(), 1, "只消掉最旧的 op");

        let report = reconcile(&config, &mut save, &snapshot, &BTreeSet::new(), 2000);
        assert_eq!(report.imported_pets, 0, "认领优先于导入：不得重复铸宠");
        assert_eq!(save.pets.len(), 2);
    }

    #[test]
    fn fuse_intent_replays_after_crash_when_materials_gone() {
        let config = config();
        let mut save = fresh(&config);
        save.coins = 5_000; // 覆盖一阶融合费 1500（v1.2）
        let a = add_pet(&mut save, "emberfox", 1, 10);
        let b = add_pet(&mut save, "frostpeng", 1, 10);
        bind(&mut save, &a, "item-a", 102);
        bind(&mut save, &b, "item-b", 106);
        save.steam_outbox.push(SteamOp::Fuse {
            op_id: "op-1".into(),
            pet_a: a.clone(),
            pet_b: b.clone(),
            item_a: "item-a".into(),
            item_b: "item-b".into(),
            egg_def: 309,
            recipe_key: "fire+ice".into(),
            applied: false,
            mat_def_a: 0,
            mat_def_b: 0,
            egg_id: None,
            pet_id: None,
            parents: None,
            attempts: 0,
            next_retry_at: 0,
        });

        // 崩溃后快照：材料消失、出现未绑定的 309 蛋 → 补应用本地融合。
        let snapshot = snap(&[("item-egg", 309)]);
        assert!(resolve_intents(&config, &mut save, &snapshot, 3000));
        assert!(save.steam_outbox.is_empty());
        assert!(save.pets.is_empty(), "双亲被消耗");
        // 融合 2.0：手续费按亲代阶（fusionFees[tier-1]），不再用旧平坦 fusion_fee。
        assert_eq!(save.coins, 5_000 - config.fusion_fee_for(1), "手续费补扣一次（按亲代阶）");
        let egg = &save.eggs[0];
        assert_eq!(egg.species, "thermowolf");
        assert_eq!(egg.steam_item_id.as_deref(), Some("item-egg"));
        assert_eq!(egg.steam_item_def, Some(309));
    }

    #[test]
    fn fuse_intent_replays_union_gen_fixed_and_unregistered_ai() {
        let config = config();
        // 用例 1：并集生成器(20014=normal+water)意图，快照出现 0 号固定 615 → 直接落定物种。
        let mut save = fresh(&config);
        save.coins = 500;
        let a = add_pet(&mut save, "guluduck", 1, 10);
        let b = add_pet(&mut save, "bubblefrog", 1, 10);
        bind(&mut save, &a, "item-a", 101);
        bind(&mut save, &b, "item-b", 104);
        save.steam_outbox.push(SteamOp::Fuse {
            op_id: "op-u1".into(),
            pet_a: a.clone(),
            pet_b: b.clone(),
            item_a: "item-a".into(),
            item_b: "item-b".into(),
            egg_def: 20_014,
            recipe_key: "normal+water".into(),
            applied: false,
            mat_def_a: 0,
            mat_def_b: 0,
            egg_id: None,
            pet_id: None,
            parents: None,
            attempts: 0,
            next_retry_at: 0,
        });
        let snapshot = snap(&[("item-pet", 615)]);
        assert!(resolve_intents(&config, &mut save, &snapshot, 3000));
        assert!(save.steam_outbox.is_empty());
        assert!(save.pets.is_empty(), "双亲被消耗");
        let egg = save.eggs.iter().find(|e| e.steam_item_id.as_deref() == Some("item-pet")).unwrap();
        assert_eq!(egg.species, "sudsotter", "物种取实发 def（615=泡澡獭）");
        assert!(egg.pending_fusion.is_none(), "固定物种无需生成");
        assert_eq!(egg.tier, 2, "结果阶 = 亲代阶 + 1");

        // 用例 2：快照出现未注册 AI 槽 def(11403=aif1403) → 挂起生成 + forced_codename 锁槽。
        let mut save = fresh(&config);
        save.coins = 500;
        let a = add_pet(&mut save, "guluduck", 1, 10);
        let b = add_pet(&mut save, "bubblefrog", 1, 10);
        bind(&mut save, &a, "item-a", 101);
        bind(&mut save, &b, "item-b", 104);
        save.steam_outbox.push(SteamOp::Fuse {
            op_id: "op-u2".into(),
            pet_a: a.clone(),
            pet_b: b.clone(),
            item_a: "item-a".into(),
            item_b: "item-b".into(),
            egg_def: 20_014,
            recipe_key: "normal+water".into(),
            applied: false,
            mat_def_a: 0,
            mat_def_b: 0,
            egg_id: None,
            pet_id: None,
            parents: None,
            attempts: 0,
            next_retry_at: 0,
        });
        let snapshot = snap(&[("item-ai", 11_403)]);
        assert!(resolve_intents(&config, &mut save, &snapshot, 3000));
        let egg = save.eggs.iter().find(|e| e.steam_item_id.as_deref() == Some("item-ai")).unwrap();
        let pending = egg.pending_fusion.as_ref().expect("未注册 AI 槽应挂起生成");
        assert_eq!(pending.forced_codename.as_deref(), Some("aif1403"), "生成锁定 Steam 掷中的槽");
        assert_eq!(pending.parents, ["guluduck".to_string(), "bubblefrog".to_string()]);
    }

    #[test]
    fn fuse_intent_dropped_when_materials_alive() {
        let config = config();
        let mut save = fresh(&config);
        save.coins = 500;
        let a = add_pet(&mut save, "emberfox", 1, 10);
        let b = add_pet(&mut save, "frostpeng", 1, 10);
        bind(&mut save, &a, "item-a", 102);
        bind(&mut save, &b, "item-b", 106);
        save.steam_outbox.push(SteamOp::Fuse {
            op_id: "op-1".into(),
            pet_a: a.clone(),
            pet_b: b.clone(),
            item_a: "item-a".into(),
            item_b: "item-b".into(),
            egg_def: 309,
            recipe_key: "fire+ice".into(),
            applied: false,
            mat_def_a: 0,
            mat_def_b: 0,
            egg_id: None,
            pet_id: None,
            parents: None,
            attempts: 0,
            next_retry_at: 0,
        });

        let snapshot = snap(&[("item-a", 102), ("item-b", 106)]);
        assert!(resolve_intents(&config, &mut save, &snapshot, 3000));
        assert!(save.steam_outbox.is_empty(), "意图被丢弃(解锁)");
        assert_eq!(save.pets.len(), 2, "双亲原封不动");
        assert_eq!(save.coins, 500, "手续费未扣");
        assert!(save.eggs.is_empty());
    }

    #[test]
    fn collect_intent_replays_and_release_intent_replays() {
        let config = config();
        let mut save = fresh(&config);
        // CollectT2:蛋物品消失、出现未绑定 209 → 蛋转宠物(物种取发放 def)。
        save.eggs.push(EggInstance {
            id: "egg-1".into(),
            species: "thermowolf".into(),
            tier: 2,
            hatch_kind: "tier2".into(),
            slot: Some(0),
            hatch_at: Some(0),
            pending_fusion: None,
            steam_item_id: Some("item-egg".into()),
            steam_item_def: Some(309),
            shop_element: None,
        });
        save.steam_outbox.push(SteamOp::CollectT2 {
            op_id: "op-c".into(),
            egg_id: "egg-1".into(),
            egg_item: "item-egg".into(),
            egg_def: 309,
        });
        let snapshot = snap(&[("item-pet", 209)]);
        assert!(resolve_intents(&config, &mut save, &snapshot, 4000));
        assert!(save.eggs.is_empty());
        let pet = &save.pets[0];
        assert_eq!(pet.species, "thermowolf");
        assert_eq!(pet.steam_item_id.as_deref(), Some("item-pet"));

        // Release(旧写前意图 applied=false):物品消失 → 补删 + 返还。
        let victim = save.pets[0].id.clone();
        save.steam_outbox.push(SteamOp::Release {
            op_id: "op-r".into(),
            pet_id: victim.clone(),
            item_id: "item-pet".into(),
            applied: false,
            attempts: 0,
            next_retry_at: 0,
        });
        let coins_before = save.coins;
        assert!(resolve_intents(&config, &mut save, &snap(&[]), 5000));
        assert!(save.pets.is_empty());
        assert!(save.coins > coins_before, "返还已入账");
    }

    #[test]
    fn applied_release_waits_for_consume_and_blocks_reimport() {
        // 本地先行放生(2026-07-18):本地已删宠+已返还,op 只欠 ConsumeItem。
        let config = config();
        let mut save = fresh(&config);
        // 留一只无关宠物,便于确认不受影响。
        let keeper = add_pet(&mut save, "guluduck", 1, 3);
        bind(&mut save, &keeper, "item-keep", 101);
        save.steam_outbox.push(SteamOp::Release {
            op_id: "op-lr".into(),
            pet_id: "pet-gone".into(),
            item_id: "item-released".into(),
            applied: true,
            attempts: 0,
            next_retry_at: 0,
        });
        let coins_before = save.coins;

        // 物品仍在快照 → op 保留(等 outbox 单飞消耗),本地不动:不复活、不二次返还。
        let snapshot = snap(&[("item-keep", 101), ("item-released", 101)]);
        assert!(!resolve_intents(&config, &mut save, &snapshot, 6000));
        assert_eq!(save.steam_outbox.len(), 1, "op 保留待消耗");
        assert_eq!(save.pets.len(), 1, "被放生宠物不复活");
        assert_eq!(save.coins, coins_before, "不二次返还");

        // 复制防线:待消耗物品不被认领/对账导入/手动导入当成新宠。
        assert!(!attach_mints(&mut save, &snapshot), "不被 mint 认领");
        let report = reconcile(&config, &mut save, &snapshot, &BTreeSet::new(), 6000);
        assert_eq!(report.imported_pets, 0, "对账不回导待消耗物品");
        assert_eq!(save.pets.len(), 1);
        let report = import_inventory_pets(&config, &mut save, &snapshot, 6000);
        assert_eq!(report.imported, 0, "手动导入也跳过待消耗物品");

        // 物品从快照消失(消耗已发生/被交易走)→ op 收工,本地无进一步动作。
        assert!(resolve_intents(&config, &mut save, &snap(&[("item-keep", 101)]), 6100));
        assert!(save.steam_outbox.is_empty(), "op 收敛移除");
        assert_eq!(save.pets.len(), 1);
        assert_eq!(save.coins, coins_before);
    }

    #[test]
    fn reconcile_prunes_lowest_level_and_tombstone_restores() {
        let config = config();
        let mut save = fresh(&config);
        let high = add_pet(&mut save, "guluduck", 1, 9);
        let mid = add_pet(&mut save, "guluduck", 1, 5);
        let low = add_pet(&mut save, "guluduck", 1, 2);
        bind(&mut save, &high, "item-h", 101);
        bind(&mut save, &mid, "item-m", 101);
        bind(&mut save, &low, "item-l", 101);

        // 只剩一个物品(item-h)→ 保等级最高者,其余墓碑。
        let report = reconcile(&config, &mut save, &snap(&[("item-h", 101)]), &BTreeSet::new(), 6000);
        assert_eq!(report.removed_pets, 2);
        assert_eq!(save.pets.len(), 1);
        assert_eq!(save.pets[0].id, high);
        assert_eq!(save.steam_tombstones.len(), 2);

        // 同 id 回流(挂市场取消)→ 墓碑复原等级。
        let report = reconcile(
            &config,
            &mut save,
            &snap(&[("item-h", 101), ("item-m", 101)]),
            &BTreeSet::new(),
            7000,
        );
        assert_eq!(report.imported_pets, 1);
        let restored = save.pets.iter().find(|p| p.steam_item_id.as_deref() == Some("item-m")).unwrap();
        assert_eq!(restored.level, 5, "墓碑复原等级");
        assert_eq!(save.steam_tombstones.len(), 1);
    }

    #[test]
    fn reconcile_rebinds_within_species_favoring_high_level() {
        let config = config();
        let mut save = fresh(&config);
        let high = add_pet(&mut save, "guluduck", 1, 9);
        let low = add_pet(&mut save, "guluduck", 1, 2);
        bind(&mut save, &high, "item-h", 101);
        bind(&mut save, &low, "item-l", 101);

        // 交易走了 item-h(高等级宠绑定的物品)→ 高等级宠重绑到幸存 id,低等级宠出局。
        let report = reconcile(&config, &mut save, &snap(&[("item-l", 101)]), &BTreeSet::new(), 6000);
        assert_eq!(report.removed_pets, 1);
        assert_eq!(save.pets.len(), 1);
        assert_eq!(save.pets[0].id, high, "同 def 物品可互换,高等级保留");
        assert_eq!(save.pets[0].steam_item_id.as_deref(), Some("item-l"));
    }

    #[test]
    fn import_respects_capacity_and_overflow_goes_unclaimed() {
        let config = config();
        let mut save = fresh(&config);
        // yard Lv1 容量 3;已有 1 只。
        let existing = add_pet(&mut save, "guluduck", 1, 1);
        bind(&mut save, &existing, "item-0", 101);
        let snapshot = snap(&[
            ("item-0", 101),
            ("item-1", 102),
            ("item-2", 103),
            ("item-3", 104),
            ("item-4", 105),
        ]);
        let report = reconcile(&config, &mut save, &snapshot, &BTreeSet::new(), 6000);
        assert_eq!(save.pets.len(), 3, "导入到容量为止");
        assert_eq!(report.imported_pets, 2);
        assert_eq!(report.unclaimed.len(), 2, "超出容量的进待认领");
    }

    #[test]
    fn grace_prevents_prune_and_import() {
        let config = config();
        let mut save = fresh(&config);
        let pet = add_pet(&mut save, "guluduck", 1, 5);
        bind(&mut save, &pet, "item-fresh", 101);
        let grace: BTreeSet<String> = ["item-fresh".to_string(), "item-ghost".to_string()]
            .into_iter()
            .collect();
        // 快照没有 item-fresh(陈旧快照)但在宽限集 → 不剪除;
        // item-ghost 在快照但在宽限集 → 不导入。
        let report = reconcile(&config, &mut save, &snap(&[("item-ghost", 102)]), &grace, 6000);
        assert_eq!(report.removed_pets, 0);
        assert_eq!(report.imported_pets, 0);
        assert_eq!(save.pets.len(), 1);
    }

    #[test]
    fn unbound_egg_item_imports_as_inventory_egg() {
        let config = config();
        let mut save = fresh(&config);
        add_pet(&mut save, "guluduck", 1, 1);
        let report = reconcile(&config, &mut save, &snap(&[("item-egg", 309)]), &BTreeSet::new(), 6000);
        assert_eq!(report.imported_eggs, 1);
        let egg = &save.eggs[0];
        assert_eq!(egg.species, "thermowolf");
        assert_eq!(egg.slot, None, "未入槽,由玩家手动放置");
        assert_eq!(egg.steam_item_def, Some(309));
    }

    #[test]
    fn custom_species_pet_participates_by_def_group() {
        let config = config();
        let mut save = fresh(&config);
        // 自定义物种宠物绑定其配方目录物种 def(209)。
        let custom = add_pet(&mut save, "aifembwhale", 2, 7);
        bind(&mut save, &custom, "item-c", 209);
        // 物品被交易走 → 自定义宠随之移除并墓碑。
        let report = reconcile(&config, &mut save, &snap(&[]), &BTreeSet::new(), 6000);
        assert_eq!(report.removed_pets, 1);
        assert_eq!(save.steam_tombstones[0].species, "aifembwhale");
    }

    #[test]
    fn migration_sweep_is_idempotent_and_skips_bound() {
        let config = config();
        let mut save = fresh(&config);
        let legacy = add_pet(&mut save, "emberfox", 1, 4);
        let bound_pet = add_pet(&mut save, "guluduck", 1, 4);
        bind(&mut save, &bound_pet, "item-b", 101);
        add_pet(&mut save, "aifembwhale", 2, 4); // 自定义二阶:不扫。

        assert!(migration_sweep(&config, &mut save));
        assert_eq!(save.steam_outbox.len(), 1);
        match &save.steam_outbox[0] {
            SteamOp::MintTier1 { pet_id, def, .. } => {
                assert_eq!(pet_id, &legacy);
                assert_eq!(*def, 102);
            }
            other => panic!("unexpected op {other:?}"),
        }
        // 幂等。
        assert!(!migration_sweep(&config, &mut save));
        assert_eq!(save.steam_outbox.len(), 1);
    }

    #[test]
    fn strip_bindings_resets_everything_for_new_owner() {
        let config = config();
        let mut save = fresh(&config);
        let pet = add_pet(&mut save, "guluduck", 1, 5);
        bind(&mut save, &pet, "item-1", 101);
        queue_mint(&mut save, &pet, "guluduck", 101);
        save.steam_tombstones.push(SteamTombstone {
            item_id: "x".into(),
            species: "guluduck".into(),
            tier: 1,
            level: 3,
            exp: 0,
            removed_at: 0,
        });
        strip_steam_bindings(&mut save, "7656119xxxx".into());
        assert!(save.pets[0].steam_item_id.is_none());
        assert!(save.steam_outbox.is_empty());
        assert!(save.steam_tombstones.is_empty());
        assert_eq!(save.steam_owner_id.as_deref(), Some("7656119xxxx"));
    }

    #[test]
    fn save_json_roundtrip_keeps_steam_fields_camel_case() {
        let config = config();
        let mut save = fresh(&config);
        let pet = add_pet(&mut save, "guluduck", 1, 5);
        bind(&mut save, &pet, "9990001112223334445", 101);
        queue_mint(&mut save, &pet, "guluduck", 101);
        let json = serde_json::to_string(&save).unwrap();
        assert!(json.contains("\"steamItemId\":\"9990001112223334445\""), "物品 id 必须是字符串");
        assert!(json.contains("\"steamOutbox\""));
        assert!(json.contains("\"kind\":\"mintTier1\""));
        let back: GameSave = serde_json::from_str(&json).unwrap();
        assert_eq!(back.steam_outbox.len(), 1);
        assert_eq!(
            back.pets[0].steam_item_id.as_deref(),
            Some("9990001112223334445")
        );
    }

    // ---- 手动「导入我的宠物」（import_inventory_pets）----------------------

    #[test]
    fn import_prioritizes_high_tier_into_empty_slots() {
        let config = config();
        let mut save = fresh(&config); // yard Lv1 = 容量 3；pets 空。
        let canonical = (601u32..=657)
            .find(|d| config.species_for_steam_def(*d).is_some())
            .expect("601-657 应有多元素固定物种");
        // 候选阶：canonical(t2) · 201(legacy t2) · 106(t1) · 101(t1)。
        let snapshot = snap(&[
            ("i-101", 101),
            ("i-106", 106),
            ("i-201", 201),
            ("i-can", canonical),
        ]);
        let report = import_inventory_pets(&config, &mut save, &snapshot, 1000);
        assert_eq!(report.imported, 3, "填满 3 个空位");
        assert_eq!(report.skipped_capacity, 1, "最低阶 1 只留待认领");
        let defs: BTreeSet<u32> = save.pets.iter().filter_map(|p| p.steam_item_def).collect();
        assert!(
            defs.contains(&canonical) && defs.contains(&201) && defs.contains(&106),
            "高阶优先入院"
        );
        assert!(!defs.contains(&101), "同为一阶时按 def 降序，101 出局");
        // 冷导入的多元素固定物种阶数 = 元素数落 [2,6]。
        let (_, info) = config.species_for_steam_def(canonical).unwrap();
        let expect_tier = (info.elements.len() as u8).clamp(2, 6);
        let can_pet = save
            .pets
            .iter()
            .find(|p| p.steam_item_def == Some(canonical))
            .unwrap();
        assert_eq!(can_pet.tier, expect_tier);
        assert!(save.active_pet_id.is_some(), "首次导入点亮主宠");
    }

    #[test]
    fn import_is_idempotent_and_reimports_after_expansion() {
        let config = config();
        let mut save = fresh(&config); // 容量 3。
        let snapshot = snap(&[("a", 101), ("b", 102), ("c", 103), ("d", 104)]);
        let first = import_inventory_pets(&config, &mut save, &snapshot, 1000);
        assert_eq!(first.imported, 3);
        assert_eq!(first.skipped_capacity, 1);
        // 再次调用同一快照：已绑定的跳过 → 不重复导入。
        let again = import_inventory_pets(&config, &mut save, &snapshot, 2000);
        assert_eq!(again.imported, 0, "反复调用不重复导入");
        assert_eq!(save.pets.len(), 3);
        // 扩容后再导入 → 之前留待认领的那只补进来。
        if config.yard_capacity_for(2) as usize > 3 {
            save.yard_level = 2;
            let third = import_inventory_pets(&config, &mut save, &snapshot, 3000);
            assert_eq!(third.imported, 1, "扩容后补领剩余 1 只");
            assert_eq!(save.pets.len(), 4);
        }
    }

    #[test]
    fn import_restores_tombstone_skips_eggs_and_handles_ai_variant() {
        let config = config();
        let mut save = fresh(&config);
        save.steam_tombstones.push(SteamTombstone {
            item_id: "tomb-1".into(),
            species: "guluduck".into(),
            tier: 1,
            level: 8,
            exp: 42,
            removed_at: 0,
        });
        // 蛋物品(309)非宠物 → 跳过；墓碑物品复原等级；AI 变种(10001)按 codename 导入。
        let snapshot = snap(&[("tomb-1", 101), ("egg-x", 309), ("ai-1", 10_001)]);
        let report = import_inventory_pets(&config, &mut save, &snapshot, 5000);
        assert_eq!(report.imported, 2, "蛋不算宠物");
        let tomb_pet = save
            .pets
            .iter()
            .find(|p| p.steam_item_id.as_deref() == Some("tomb-1"))
            .unwrap();
        assert_eq!(tomb_pet.species, "guluduck");
        assert_eq!(tomb_pet.level, 8, "墓碑复原等级");
        assert!(save.steam_tombstones.is_empty(), "墓碑消费一次");
        let ai_pet = save
            .pets
            .iter()
            .find(|p| p.steam_item_id.as_deref() == Some("ai-1"))
            .unwrap();
        assert_eq!(ai_pet.species, "aif0001", "AI 变种按确定性 codename 反解");
        assert!(ai_pet.tier >= 2, "AI 变种冷导入阶数 ≥ 2");
    }

    #[test]
    fn import_claims_pending_mint_before_creating_duplicate() {
        let config = config();
        let mut save = fresh(&config);
        // 本地一阶宠待发放（MintTier1），其物品已在库存里未绑定。
        let pet = add_pet(&mut save, "guluduck", 1, 4);
        queue_mint(&mut save, &pet, "guluduck", 101);
        let report = import_inventory_pets(&config, &mut save, &snap(&[("item-1", 101)]), 1000);
        assert_eq!(report.imported, 0, "认领优先：不得为同一物品重复铸宠");
        assert_eq!(save.pets.len(), 1, "仍是那一只本地宠");
        assert_eq!(save.pets[0].id, pet);
        assert_eq!(
            save.pets[0].steam_item_id.as_deref(),
            Some("item-1"),
            "物品认领给本地宠而非新导入"
        );
        assert!(save.steam_outbox.is_empty(), "mint op 已消掉");
    }

    #[test]
    fn import_marks_owned_species_collected_in_dex() {
        let config = config();
        let mut save = fresh(&config);
        assert!(save.dex_obtained.is_empty(), "初始图鉴为空");
        // 导入一只一阶(101) + 一只 AI 变种(10001=aif0001)。
        let report = import_inventory_pets(&config, &mut save, &snap(&[("i-1", 101), ("i-ai", 10_001)]), 1000);
        assert_eq!(report.imported, 2);
        for pet in &save.pets {
            assert!(
                save.dex_obtained.get(&pet.species).copied().unwrap_or(0) >= 1,
                "{} 应入图鉴",
                pet.species
            );
        }
        // 幂等：再次导入（0 新）不膨胀图鉴计数。
        let before = save.dex_obtained.clone();
        import_inventory_pets(&config, &mut save, &snap(&[("i-1", 101), ("i-ai", 10_001)]), 2000);
        assert_eq!(save.dex_obtained, before, "反复导入不膨胀图鉴计数");
    }

    #[test]
    fn unresolved_ai_species_lists_only_unregistered_ai_codenames() {
        let config = config();
        let mut save = fresh(&config);
        add_pet(&mut save, "guluduck", 1, 1); // 目录物种（有形象）→ 不列。
        add_pet(&mut save, "aif0001", 2, 1); // 未注册 AI 变种 → 列。
        add_pet(&mut save, "aif0002", 2, 1); // 未注册 AI 变种 → 列。
        add_pet(&mut save, "aif0002", 2, 1); // 同 codename 重复 → 去重。
        add_pet(&mut save, "bogusname", 2, 1); // 非 AI codename（未知物种）→ 无从工坊解析，不列。
        let list = unresolved_ai_species(&config, &save);
        assert!(list.contains(&"aif0001".to_string()));
        assert!(list.contains(&"aif0002".to_string()));
        assert!(!list.contains(&"guluduck".to_string()), "目录物种有形象，不列");
        assert!(!list.contains(&"bogusname".to_string()), "非 AI codename 不列");
        assert_eq!(list.iter().filter(|c| *c == "aif0002").count(), 1, "去重");
    }

    // ---- 本地先行二阶融合（2026-07-21）--------------------------------------

    fn push_unbound_t2_egg(save: &mut GameSave, id: &str, pending: Option<PendingFusionInfo>) {
        save.eggs.push(EggInstance {
            id: id.into(),
            species: crate::game::FALLBACK_SPECIES.to_string(),
            tier: 2,
            hatch_kind: "tier2".into(),
            slot: Some(0),
            hatch_at: Some(9999),
            pending_fusion: pending,
            steam_item_id: None,
            steam_item_def: None,
            shop_element: None,
        });
    }

    #[test]
    fn local_fuse_burns_and_shields_materials() {
        // 本地先行融合已应用：双亲已消耗、产出未绑定二阶蛋 + Fuse{applied} 欠 ExchangeItems。
        // 复制防线核心：兑换收敛前，两只材料物品不得被任何导入路径当成新宠回导。
        let config = config();
        let mut save = fresh(&config);
        push_unbound_t2_egg(&mut save, "egg-t2", None);
        // 留一只无关 bound 宠，确认不受影响。
        let keeper = add_pet(&mut save, "guluduck", 1, 3);
        bind(&mut save, &keeper, "item-keep", 101);
        save.steam_outbox.push(SteamOp::Fuse {
            op_id: "op-lf".into(),
            pet_a: String::new(),
            pet_b: String::new(),
            item_a: "mat-a".into(),
            item_b: "mat-b".into(),
            egg_def: 309,
            recipe_key: "fire+ice".into(),
            applied: true,
            mat_def_a: 0,
            mat_def_b: 0,
            egg_id: Some("egg-t2".into()),
            pet_id: None,
            parents: Some(["emberfox".into(), "frostpeng".into()]),
            attempts: 0,
            next_retry_at: 0,
        });

        // 材料仍在快照（兑换未发生）：三条导入路径都不得回导在途材料。
        let snapshot = snap(&[("item-keep", 101), ("mat-a", 102), ("mat-b", 106)]);
        assert!(!attach_mints(&mut save, &snapshot), "材料不被 mint 认领");
        let report = reconcile(&config, &mut save, &snapshot, &BTreeSet::new(), 6000);
        assert_eq!(report.imported_pets, 0, "对账不回导在途材料（复制漏洞封死）");
        let report = import_inventory_pets(&config, &mut save, &snapshot, 6000);
        assert_eq!(report.imported, 0, "手动导入也跳过在途材料");
        // 未绑定结果蛋被 op 锁：收取 / 再融合须等同步完成。
        assert!(op_locked_ids(&save).contains("egg-t2"), "结果蛋被 op 锁");
        // 材料仍在 → 兑换未发生 → resolve_intents 保留 op、不动本地。
        assert!(!resolve_intents(&config, &mut save, &snapshot, 6000), "材料在，op 保留");
        assert_eq!(save.steam_outbox.len(), 1);
        assert!(
            save.eggs.iter().any(|e| e.id == "egg-t2" && e.steam_item_id.is_none()),
            "结果蛋仍未绑定、未被剪除"
        );
    }

    #[test]
    fn local_fuse_resolves_when_materials_gone() {
        // 材料从快照消失（兑换已发生）→ 找未绑定结果回绑到蛋 + 按实发 def 精化物种 + 收 op。
        let config = config();
        let mut save = fresh(&config);
        let pending = PendingFusionInfo {
            parents: ["guluduck".into(), "bubblefrog".into()],
            recipe_key: "normal+water".into(),
            requested_at: 1000,
            attempts: 0,
            status: "pending".into(),
            last_error: None,
            forced_codename: None,
            provider: None,
        };
        push_unbound_t2_egg(&mut save, "egg-t2", Some(pending));
        save.steam_outbox.push(SteamOp::Fuse {
            op_id: "op-lf".into(),
            pet_a: String::new(),
            pet_b: String::new(),
            item_a: "mat-a".into(),
            item_b: "mat-b".into(),
            egg_def: 20_014, // 并集生成器(normal+water)
            recipe_key: "normal+water".into(),
            applied: true,
            mat_def_a: 0,
            mat_def_b: 0,
            egg_id: Some("egg-t2".into()),
            pet_id: None,
            parents: Some(["guluduck".into(), "bubblefrog".into()]),
            attempts: 0,
            next_retry_at: 0,
        });
        // 实发 615 = 0 号固定 sudsotter。
        let snapshot = snap(&[("item-pet", 615)]);
        assert!(resolve_intents(&config, &mut save, &snapshot, 7000));
        assert!(save.steam_outbox.is_empty(), "op 收敛");
        let egg = save.eggs.iter().find(|e| e.id == "egg-t2").unwrap();
        assert_eq!(egg.species, "sudsotter", "物种取实发 def(615)");
        assert_eq!(egg.steam_item_id.as_deref(), Some("item-pet"));
        assert_eq!(egg.steam_item_def, Some(615));
        assert!(egg.pending_fusion.is_none(), "固定物种精化后清挂起");
    }

    #[test]
    fn decided_recipe_egg_keeps_species_when_granted_ai_slot() {
        // 教学首融特作：蛋创建时已定案经典配方（无 pending）。并集生成器兑换掷中
        // 未注册 AI 槽 def(11403=aif1403) → 只回绑物品；物种保持经典、绝不改挂 AI
        // 生成（否则新号首融冒出「Claude 设计中…」，破坏「首融必产固定配方」）。
        let config = config();
        let mut save = fresh(&config);
        push_unbound_t2_egg(&mut save, "egg-t2", None);
        save.eggs.last_mut().unwrap().species = "sudsotter".into();
        save.steam_outbox.push(SteamOp::Fuse {
            op_id: "op-lf".into(),
            pet_a: String::new(),
            pet_b: String::new(),
            item_a: "mat-a".into(),
            item_b: "mat-b".into(),
            egg_def: 20_014, // 并集生成器(normal+water)
            recipe_key: "normal+water".into(),
            applied: true,
            mat_def_a: 0,
            mat_def_b: 0,
            egg_id: Some("egg-t2".into()),
            pet_id: None,
            parents: Some(["guluduck".into(), "bubblefrog".into()]),
            attempts: 0,
            next_retry_at: 0,
        });
        // 兑换已发生：材料消失、实发未注册 AI 槽 11403。
        let snapshot = snap(&[("item-ai", 11_403)]);
        assert!(resolve_intents(&config, &mut save, &snapshot, 7000));
        assert!(save.steam_outbox.is_empty(), "op 收敛");
        let egg = save.eggs.iter().find(|e| e.id == "egg-t2").unwrap();
        assert_eq!(egg.species, "sudsotter", "已定案蛋保留经典配方物种");
        assert!(egg.pending_fusion.is_none(), "绝不被改挂 AI 生成");
        assert_eq!(egg.steam_item_id.as_deref(), Some("item-ai"), "变种物品仍回绑（可交易）");
        assert_eq!(egg.steam_item_def, Some(11_403));
    }

    #[test]
    fn unresolved_pending_egg_hatches_recipe_canonical() {
        // AI 生成未成功（挂起未解析）：收取不再孵出未注册槽码名（渲染成兜底鸭），
        // 而是该配方的 0 号固有物种（形象+名字）；实发 def 只有解析成已注册物种才可信。
        let config = config();
        let mut save = fresh(&config);
        let pending = PendingFusionInfo {
            parents: ["guluduck".into(), "bubblefrog".into()],
            recipe_key: "normal+water".into(),
            requested_at: 1000,
            attempts: 2,
            status: "failed".into(),
            last_error: None,
            forced_codename: Some("aif1403".into()),
            provider: None,
        };
        push_unbound_t2_egg(&mut save, "egg-t2", Some(pending));
        save.eggs.last_mut().unwrap().steam_item_id = Some("item-ai".into());
        save.eggs.last_mut().unwrap().steam_item_def = Some(11_403);
        assert_eq!(
            collect_species_for(&config, &save, 0, 11_403),
            "sudsotter",
            "未解析挂起蛋孵配方 0 号固有物种"
        );
        // 对照 1：实发 def 是已注册目录物种（0 号固定）→ 信 def。
        assert_eq!(collect_species_for(&config, &save, 0, 615), "sudsotter");
        // 对照 2：生成已解析成自定义物种 → 保持解析结果。
        let entry = crate::game::CustomSpeciesEntry {
            info: crate::game_config::SpeciesInfo {
                name_zh: "测试变种".to_string(),
                name_en: "Testling".to_string(),
                tier: 2,
                elements: vec!["normal".to_string(), "water".to_string()],
                colors: vec!["#FFD24A".to_string()],
                body: "duck".to_string(),
                desc: String::new(),
                desc_en: String::new(),
                steam_item_def: 0,
            },
            visual: crate::game::CustomVisualSpec {
                rig: "duck".to_string(),
                scale: 1.0,
                palette: crate::game::CustomPalette {
                    body: "#FFD24A".to_string(),
                    deep: "#C9992B".to_string(),
                    belly: "#FFF2CC".to_string(),
                    accent: "#7FB8E8".to_string(),
                    accent2: None,
                },
                eyes: None,
                tool_id: None,
                floating: false,
                slots: Default::default(),
                form: None,
                custom_rig: None,
                work_fx: None,
            },
            parents: ["guluduck".to_string(), "bubblefrog".to_string()],
            created_at: 0,
            generator: "mock".to_string(),
            origin: Some("local".to_string()),
        };
        save.custom_species.insert("aif1403".into(), entry);
        save.eggs[0].species = "aif1403".into();
        save.eggs[0].pending_fusion.as_mut().unwrap().status = "resolved".into();
        assert_eq!(collect_species_for(&config, &save, 0, 11_403), "aif1403");
    }

    #[test]
    fn repair_unbound_tier2_enqueues_exchange() {
        // 存量修复：本地 Lv20 未同步 Steam snowcub(ice+normal) + 匹配的两只已同步 Steam 一阶材料
        // → 消耗材料 + 排 Fuse{applied,pet_id} 按 snowcub 自身 def 铸回绑；幂等。
        let config = config();
        let mut save = fresh(&config);
        let snow = add_pet(&mut save, "snowcub", 2, 20);
        let g = add_pet(&mut save, "guluduck", 1, 1); // normal, 101
        let f = add_pet(&mut save, "frostpeng", 1, 1); // ice, 106
        bind(&mut save, &g, "item-g", 101);
        bind(&mut save, &f, "item-f", 106);

        assert!(repair_unbound_tier2(&config, &mut save));
        assert!(!save.pets.iter().any(|p| p.id == g), "材料 guluduck 已消耗");
        assert!(!save.pets.iter().any(|p| p.id == f), "材料 frostpeng 已消耗");
        assert!(save.pets.iter().any(|p| p.id == snow), "snowcub 保留");
        assert_eq!(save.steam_outbox.len(), 1);
        let SteamOp::Fuse { applied, pet_id, item_a, item_b, egg_def, .. } = &save.steam_outbox[0]
        else {
            panic!("应为 Fuse op");
        };
        assert!(*applied);
        assert_eq!(pet_id.as_deref(), Some(snow.as_str()));
        let items: BTreeSet<&str> = [item_a.as_str(), item_b.as_str()].into_iter().collect();
        assert!(items.contains("item-g") && items.contains("item-f"), "两材料物品入 op");
        assert_eq!(
            *egg_def,
            exchange_target_def(&config, "ice+normal").unwrap(),
            "目标 = ice+normal 并集生成器（跨物种合法兑换，非 snowcub 自身 601-657 def）"
        );
        assert!(
            crate::fusion_slots::is_union_gen_def(*egg_def),
            "跨物种目标应是并集生成器"
        );
        // 在途材料受 bound_item_ids 保护，不被回导。
        let snapshot = snap(&[("item-g", 101), ("item-f", 106)]);
        let report = reconcile(&config, &mut save, &snapshot, &BTreeSet::new(), 6000);
        assert_eq!(report.imported_pets, 0, "在途材料不被回导");
        // 幂等：snowcub 已被 op 引用 → 二次调用无新变更。
        assert!(!repair_unbound_tier2(&config, &mut save));
        assert_eq!(save.steam_outbox.len(), 1);
    }

    #[test]
    fn take_fusion_material_resolves_bound_and_cancels_pending_mint() {
        // 不阻挡融合的关键：已同步 Steam→(item,0)；待发放 MintTier1→("",def) 并取消 mint（责任转交 Fuse op）。
        let config = config();
        let mut save = fresh(&config);
        let bound = add_pet(&mut save, "emberfox", 1, 10);
        bind(&mut save, &bound, "item-x", 102);
        let pet_bound = save.pets.iter().find(|p| p.id == bound).unwrap().clone();
        assert_eq!(
            take_fusion_material(&config, &mut save, &pet_bound),
            ("item-x".to_string(), 0)
        );

        let pending = add_pet(&mut save, "frostpeng", 1, 10);
        queue_mint(&mut save, &pending, "frostpeng", 106);
        let pet_pending = save.pets.iter().find(|p| p.id == pending).unwrap().clone();
        assert!(pending_mint_for(&save, &pending).is_some());
        assert_eq!(
            take_fusion_material(&config, &mut save, &pet_pending),
            (String::new(), 106)
        );
        assert!(
            pending_mint_for(&save, &pending).is_none(),
            "待发放 mint 已取消（铸材料责任转交 Fuse op，防孤儿回导）"
        );
    }

    #[test]
    fn local_fuse_keeps_op_while_minting_materials() {
        // 材料未铸齐（item 空 + mat_def 记 def）→ resolve_intents 保留 op（别把空 id 当「材料已消失」）。
        let config = config();
        let mut save = fresh(&config);
        push_unbound_t2_egg(&mut save, "egg-t2", None);
        save.steam_outbox.push(SteamOp::Fuse {
            op_id: "op-lf".into(),
            pet_a: String::new(),
            pet_b: String::new(),
            item_a: String::new(), // 尚未铸出
            item_b: String::new(),
            egg_def: 613, // snowcub 自身 def
            recipe_key: "ice+normal".into(),
            applied: true,
            mat_def_a: 101,
            mat_def_b: 106,
            egg_id: Some("egg-t2".into()),
            pet_id: None,
            parents: Some(["guluduck".into(), "frostpeng".into()]),
            attempts: 0,
            next_retry_at: 0,
        });
        assert!(!resolve_intents(&config, &mut save, &snap(&[]), 7000), "材料铸造中，op 保留");
        assert_eq!(save.steam_outbox.len(), 1);
        // 空材料 id 不进受保护集（无物品可护）。
        assert!(bound_item_ids(&save).is_empty());
    }

    #[test]
    fn retarget_fixes_cross_species_canonical_target() {
        // 早期 bug：跨物种融合 op 目标误设为 canonical 物种 def(611=potturtle,grass+normal)→兑换卡死。
        let config = config();
        let mut save = fresh(&config);
        save.steam_outbox.push(SteamOp::Fuse {
            op_id: "op-bad".into(),
            pet_a: String::new(),
            pet_b: String::new(),
            item_a: "item-a".into(),
            item_b: "item-b".into(),
            egg_def: 611, // ❌ potturtle 自身 def（只带 sp:*2，收不了跨物种材料）
            recipe_key: "grass+normal".into(),
            applied: true,
            mat_def_a: 0,
            mat_def_b: 0,
            egg_id: None,
            pet_id: Some("pet-x".into()),
            parents: Some(["sproutcap".into(), "guluduck".into()]),
            attempts: 3,
            next_retry_at: 999,
        });
        assert!(retarget_cross_species_fuse_ops(&config, &mut save));
        let SteamOp::Fuse { egg_def, .. } = &save.steam_outbox[0] else { panic!() };
        assert_eq!(*egg_def, exchange_target_def(&config, "grass+normal").unwrap());
        assert!(crate::fusion_slots::is_union_gen_def(*egg_def), "重指向并集生成器");
        // 幂等：已正确 → 二次调用无变更。
        assert!(!retarget_cross_species_fuse_ops(&config, &mut save));
    }
}
