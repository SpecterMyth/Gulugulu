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
            SteamOp::Fuse { pet_a, pet_b, .. } => {
                locked.insert(pet_a.clone());
                locked.insert(pet_b.clone());
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

fn bound_item_ids(save: &GameSave) -> BTreeSet<String> {
    save.pets
        .iter()
        .filter_map(|p| p.steam_item_id.clone())
        .chain(save.eggs.iter().filter_map(|e| e.steam_item_id.clone()))
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
                pet_a,
                pet_b,
                item_a,
                item_b,
                egg_def,
                recipe_key,
                ..
            } => {
                if snapshot_ids.contains(item_a.as_str()) || snapshot_ids.contains(item_b.as_str()) {
                    // 材料（至少部分）仍在 → 兑换未发生 → 弃意图。
                    true
                } else {
                    // 兑换已发生：找未绑定的目标蛋物品，补应用本地融合（配方路径）。
                    let bound = bound_item_ids(save);
                    let egg_item = snapshot
                        .iter()
                        .find(|i| i.def == *egg_def && !bound.contains(&i.item_id))
                        .map(|i| i.item_id.clone());
                    if let Some(egg_item) = egg_item {
                        let species = config
                            .fusion_table
                            .get(recipe_key)
                            .cloned()
                            .unwrap_or_else(|| crate::game::FALLBACK_SPECIES.to_string());
                        apply_fusion_local(config, save, pet_a, pet_b, species, now, egg_item, *egg_def, None);
                    }
                    // 找不到蛋物品（同窗口又被消耗等极端情况）→ 交给常规对账。
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
            SteamOp::Release { pet_id, item_id, .. } => {
                if snapshot_ids.contains(item_id.as_str()) {
                    true // 物品还在 → 消耗未发生 → 弃意图。
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

/// 二阶收取的本地物种：蛋已解析出 AI 自定义物种 → 用自定义 codename
/// （Steam 侧按目录物种记账）；否则一律信 Steam 实际发放的 def（随机就绪）。
pub fn collect_species_for(
    config: &GameConfig,
    save: &GameSave,
    egg_index: usize,
    granted_def: u32,
) -> String {
    let egg = &save.eggs[egg_index];
    let custom_resolved = egg
        .pending_fusion
        .as_ref()
        .map(|p| p.status == "resolved" && save.custom_species.contains_key(&egg.species))
        .unwrap_or(false);
    if custom_resolved {
        return egg.species.clone();
    }
    config
        .species_for_steam_def(granted_def)
        .map(|(codename, _)| codename.clone())
        .unwrap_or_else(|| egg.species.clone())
}

/// 融合的本地应用（供命令第三段与意图回放共用）：扣费、删双亲、修 active、
/// 产出绑定 Steam 物品的二阶蛋。物种由调用方决定（配方 / AI 兜底流程）；
/// AI 路径传 `pending`（挂起生成任务，species 用 FALLBACK 占位）。
pub fn apply_fusion_local(
    config: &GameConfig,
    save: &mut GameSave,
    pet_a: &str,
    pet_b: &str,
    species: String,
    now: i64,
    egg_item_id: String,
    egg_def: u32,
    pending: Option<PendingFusionInfo>,
) -> String {
    save.coins = save.coins.saturating_sub(config.fusion_fee);
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
    let hatch_at = slot.map(|_| now + *config.hatch_seconds.get("tier2").unwrap_or(&1800) as i64);
    let egg_id = new_id("egg");
    save.eggs.push(EggInstance {
        id: egg_id.clone(),
        species,
        tier: 2,
        hatch_kind: "tier2".to_string(),
        slot,
        hatch_at,
        pending_fusion: pending,
        steam_item_id: Some(egg_item_id),
        steam_item_def: Some(egg_def),
    });
    egg_id
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
        let keep = group.len().min(surviving.len());
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
            101..=106 | 201..=221 => {
                if save.pets.len() >= capacity {
                    report.unclaimed.push(item.clone());
                    continue;
                }
                // 墓碑复原（同 id 回流：挂市场取消/托管退回）。
                let tomb_index = save
                    .steam_tombstones
                    .iter()
                    .position(|t| t.item_id == item.item_id);
                let pet = if let Some(ti) = tomb_index {
                    let tomb = save.steam_tombstones.remove(ti);
                    PetInstance {
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
                    }
                } else {
                    let (species, tier) = config
                        .species_for_steam_def(item.def)
                        .map(|(codename, info)| (codename.clone(), info.tier))
                        .unwrap_or_else(|| (crate::game::FALLBACK_SPECIES.to_string(), 1));
                    PetInstance {
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
                    }
                };
                save.pets.push(pet);
                report.imported_pets += 1;
                report.changed = true;
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

/// MintTier1 限频退避（分钟）：1 → 2 → 5 → 10（封顶）。
pub fn mint_backoff_secs(attempts: u32) -> i64 {
    match attempts {
        0 => 60,
        1 => 120,
        2 => 300,
        _ => 600,
    }
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
        });

        // 崩溃后快照：材料消失、出现未绑定的 309 蛋 → 补应用本地融合。
        let snapshot = snap(&[("item-egg", 309)]);
        assert!(resolve_intents(&config, &mut save, &snapshot, 3000));
        assert!(save.steam_outbox.is_empty());
        assert!(save.pets.is_empty(), "双亲被消耗");
        assert_eq!(save.coins, 500 - config.fusion_fee, "手续费补扣一次");
        let egg = &save.eggs[0];
        assert_eq!(egg.species, "thermowolf");
        assert_eq!(egg.steam_item_id.as_deref(), Some("item-egg"));
        assert_eq!(egg.steam_item_def, Some(309));
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

        // Release:物品消失 → 补删 + 返还。
        let victim = save.pets[0].id.clone();
        save.steam_outbox.push(SteamOp::Release {
            op_id: "op-r".into(),
            pet_id: victim.clone(),
            item_id: "item-pet".into(),
        });
        let coins_before = save.coins;
        assert!(resolve_intents(&config, &mut save, &snap(&[]), 5000));
        assert!(save.pets.is_empty());
        assert!(save.coins > coins_before, "返还已入账");
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
}
