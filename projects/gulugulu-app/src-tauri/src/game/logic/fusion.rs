use crate::game::*;

/// 融合前提守卫（两条融合路径共用）：两只不同的、同为一阶且满级的精灵，
/// 且金币够手续费。只读校验，返回双亲快照。
pub fn logic_validate_fusion_pair(
    config: &GameConfig,
    save: &GameSave,
    id_a: &str,
    id_b: &str,
) -> Result<(PetInstance, PetInstance), String> {
    if id_a == id_b {
        return Err("#fusionNeedTwoDistinct".to_string());
    }
    let pet_a = save
        .pets
        .iter()
        .find(|p| p.id == id_a)
        .ok_or_else(|| "#petANotFound".to_string())?
        .clone();
    let pet_b = save
        .pets
        .iter()
        .find(|p| p.id == id_b)
        .ok_or_else(|| "#petBNotFound".to_string())?
        .clone();

    if pet_a.tier != pet_b.tier {
        return Err("#fusionTierMismatch".to_string());
    }
    // 融合 2.0：同阶 1~5 皆可融（结果 = 亲代阶 +1），两只 6 阶已达顶。
    if pet_a.tier < 1 || pet_a.tier > 5 {
        return Err("#fusionMaxTier".to_string());
    }
    if !is_max_level(config, &pet_a) || !is_max_level(config, &pet_b) {
        return Err("#fusionNeedMaxLevel".to_string());
    }
    if save.coins < config.fusion_fee_for(pet_a.tier) {
        return Err("#fusionNeedFee".to_string());
    }
    // 每日融合上限（EconomyScaling.md §7.5）：按结果配方键计数，达上限拒绝。
    // 客户端 pacing —— Steam 侧安全性来自 exchange 真实消耗（净 −1）+ 上游水龙头封顶。
    // 传配方**键**（recipe=），前端 recipeLabel 按语言渲染（"火+水" / "Fire + Water"）。
    let recipe_key = fusion_result_recipe_key(config, save, &pet_a, &pet_b)?;
    let cap = config.fusion_daily_mint_cap(recipe_key.split('+').count());
    let minted = save.daily.fusion_mints.get(&recipe_key).copied().unwrap_or(0);
    if minted >= cap {
        return Err(format!("#fusionDailyCap|recipe={recipe_key}|cap={cap}"));
    }
    Ok((pet_a, pet_b))
}

/// 融合结果配方键 = 双亲元素集合并集键（每日上限与掷骰共用同一口径）。
pub(crate) fn fusion_result_recipe_key(
    config: &GameConfig,
    save: &GameSave,
    pet_a: &PetInstance,
    pet_b: &PetInstance,
) -> Result<String, String> {
    let mut elements = species_elements(config, save, &pet_a.species)?;
    elements.extend(species_elements(config, save, &pet_b.species)?);
    Ok(crate::fusion_slots::element_set_key(&elements))
}

/// 每日融合计数 +1（唯一写入点集中于素材消耗时刻：`consume_fusion_pair` 与
/// Steam 路径的 `apply_fusion_local`）。
pub(crate) fn record_fusion_mint(save: &mut GameSave, recipe_key: &str) {
    *save.daily.fusion_mints.entry(recipe_key.to_string()).or_insert(0) += 1;
    // 成就：融合总次数（本函数是全路径唯一融合计数点，SteamAchievements.md §3.3）。
    save.stats.total_fusions += 1;
}

/// 把 AI 变种注册进配方槽位表。新式确定性 codename（aif+2位序+2位槽）落到
/// **codename 自带的槽号**——Steam 全局池可乱序掷中非前沿槽，中间空槽用 "" 占位
/// （本地阶梯遍历空串永不命中 dexObtained，前沿数学无损）；旧随机 codename 按
/// 注册序追加（原行为）。幂等：已注册不重复占槽。
pub fn register_ai_slot(save: &mut GameSave, recipe_key: &str, codename: &str) {
    let slots = save.recipe_ai_slots.entry(recipe_key.to_string()).or_default();
    if slots.iter().any(|c| c == codename) {
        return;
    }
    let forced_slot = crate::fusion_slots::ai_def_for_codename(codename)
        .map(|def| ((def - crate::fusion_slots::AI_ITEM_DEF_BASE) % 100) as usize);
    match forced_slot {
        Some(slot) if (1..=crate::fusion_slots::MAX_AI_SLOTS).contains(&slot) => {
            if slots.len() < slot {
                slots.resize(slot, String::new());
            }
            if slots[slot - 1].is_empty() {
                slots[slot - 1] = codename.to_string();
            }
        }
        _ => {
            if slots.len() < crate::fusion_slots::MAX_AI_SLOTS {
                slots.push(codename.to_string());
            }
        }
    }
}

/// AI 变种 codename（`aif<序><槽>`）→ 其配方键（元素集合键）。非新式 AI codename
/// → None。序号按 `multi_element_recipes_ordered(speciesByRecipe 键)` 冻结序反查
/// （与 itemdef/槽位身份同源）。
pub fn recipe_key_for_ai_codename(config: &GameConfig, codename: &str) -> Option<String> {
    let def = crate::fusion_slots::ai_def_for_codename(codename)?;
    let ordinal = ((def - crate::fusion_slots::AI_ITEM_DEF_BASE) / 100) as usize;
    let keys: Vec<String> = config.species_by_recipe.keys().cloned().collect();
    crate::fusion_slots::multi_element_recipes_ordered(&keys)
        .get(ordinal)
        .cloned()
}

/// 无挂起蛋地注册一个来自创意工坊的 AI 自定义物种（供 Steam 资产导入补形象用）：
/// 写入 `custom_species`、注册 AI 槽（`recipe_ai_slots`）、存为首发皮肤，并记
/// `workshop_published=""`（他人形象，本机不再重发布）。幂等：已注册即 `Ok(())`。
/// 撞目录物种名 → Err。调用方须先 `validate_custom_visual(&entry.visual)` 与
/// `is_valid_codename(codename)`。与 `logic_resolve_fusion_egg` 的注册记账同源，
/// 区别仅在「无挂起蛋」——导入的宠物实例其 `species` 早已是该 codename，注册后即
/// 从兜底鸭切换成真形象。
pub fn logic_register_workshop_species(
    config: &GameConfig,
    save: &mut GameSave,
    codename: &str,
    mut entry: CustomSpeciesEntry,
    skin: SpeciesSkin,
) -> Result<(), String> {
    if config.species.contains_key(codename) {
        return Err(format!("#codenameTaken|codename={codename}"));
    }
    if save.custom_species.contains_key(codename) {
        return Ok(()); // 幂等：已注册。
    }
    entry.origin = Some("workshop".to_string()); // 下载所得 origin 不可信，强制覆写。
    save.custom_species.insert(codename.to_string(), entry);
    if let Some(recipe_key) = recipe_key_for_ai_codename(config, codename) {
        register_ai_slot(save, &recipe_key, codename);
    }
    // 首发皮肤入库（换肤/上传者列表用）；入库失败（封顶等）不阻断形象注册。
    let _ = logic_install_skin(save, codename, skin);
    save.workshop_published.insert(codename.to_string(), String::new());
    Ok(())
}

/// 双亲主元素的配方键（校验通过后调用）。
pub fn fusion_pair_recipe_key(
    config: &GameConfig,
    save: &GameSave,
    pet_a: &PetInstance,
    pet_b: &PetInstance,
) -> Result<String, String> {
    let element_a = species_info(config, save, &pet_a.species)
        .and_then(|s| s.elements.first().cloned())
        .ok_or_else(|| "#unknownSpecies".to_string())?;
    let element_b = species_info(config, save, &pet_b.species)
        .and_then(|s| s.elements.first().cloned())
        .ok_or_else(|| "#unknownSpecies".to_string())?;
    Ok(fusion_recipe_key(&element_a, &element_b))
}

/// 消耗融合素材：扣手续费（按亲代阶）、移除双亲、修复 active_pet_id、记每日融合数。
pub(crate) fn consume_fusion_pair(save: &mut GameSave, id_a: &str, id_b: &str, fee: u64, recipe_key: &str) {
    save.coins = save.coins.saturating_sub(fee);
    save.pets.retain(|p| p.id != id_a && p.id != id_b);
    if let Some(active) = &save.active_pet_id {
        if active == id_a || active == id_b {
            save.active_pet_id = save.pets.first().map(|p| p.id.clone());
        }
    }
    record_fusion_mint(save, recipe_key);
}

/// 产出一颗融合蛋（结果阶 `tier`，有空槽直接入槽计时，否则进背包）。
/// 孵化时长键 = `tier{tier}`（config 提供 tier2..tier6，未知阶回退 tier2）。
pub(crate) fn push_fusion_egg(
    config: &GameConfig,
    save: &mut GameSave,
    species: String,
    tier: u8,
    now: i64,
    pending_fusion: Option<PendingFusionInfo>,
) -> String {
    let slot = first_free_slot(config, save);
    let hatch_kind = format!("tier{tier}");
    let hatch_secs = config
        .hatch_seconds
        .get(&hatch_kind)
        .or_else(|| config.hatch_seconds.get("tier2"))
        .copied()
        .unwrap_or(1800);
    let hatch_at = slot.map(|_| now + hatch_secs as i64);
    let egg_id = new_id("egg");
    save.eggs.push(EggInstance {
        id: egg_id.clone(),
        species,
        tier,
        hatch_kind,
        slot,
        hatch_at,
        pending_fusion,
        steam_item_id: None,
        steam_item_def: None,
        shop_element: None,
    });
    egg_id
}

/// 某物种的元素集合（config 目录 → AI 自定义物种）。
pub(crate) fn species_elements(config: &GameConfig, save: &GameSave, species: &str) -> Result<Vec<String>, String> {
    species_info(config, save, species)
        .map(|s| s.elements.clone())
        .ok_or_else(|| format!("#unknownSpeciesNamed|species={species}"))
}

/// 该配方当前已获得的槽号集合（0 = 固定物种；1.. = 已注册 AI 变种）。
/// 判定真源 = `dex_obtained`（曾获只数 ≥1），与图鉴一致（FusionRecipeSlots §5）。
pub(crate) fn obtained_slots_for(save: &GameSave, recipe_key: &str, fixed_codename: &str) -> std::collections::BTreeSet<usize> {
    let mut set = std::collections::BTreeSet::new();
    let has = |code: &str| save.dex_obtained.get(code).copied().unwrap_or(0) >= 1;
    if has(fixed_codename) {
        set.insert(0);
    }
    if let Some(slots) = save.recipe_ai_slots.get(recipe_key) {
        for (i, code) in slots.iter().enumerate() {
            if has(code) {
                set.insert(i + 1);
            }
        }
    }
    set
}

/// 融合结果的处置类别（FusionRecipeSlots.md §3.3）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FusionResultKind {
    /// 同物种 → 确定性升阶为同一物种（含 AI 变种），不掷骰。
    SameSpecies,
    /// 0 号固定物种（`speciesByRecipe`）。
    Fixed,
    /// 复用已解锁 AI 变种（1-indexed 槽号）。
    Reuse(usize),
    /// 掷中前沿新槽（需 AI 生成；同步路径回退固定物种，PR-2 异步真正生成）。
    Generate(usize),
}

/// 融合计划（纯推导，`roll_value` 注入以便测试）。
#[derive(Debug, Clone)]
pub struct FusionPlan {
    pub result_species: String,
    pub result_tier: u8,
    pub fee: u64,
    pub recipe_key: String,
    pub kind: FusionResultKind,
}

/// 推导融合计划：同物种确定性升阶；异物种走配方槽位阶梯掷骰
/// （FusionRecipeSlots.md §3）。`roll_value` 为掷点熵源（调用方注入）。
/// 同步路径 `cli_available=false`（无法内联生成，前沿新槽回退固定物种）。
pub fn plan_fusion(
    config: &GameConfig,
    save: &GameSave,
    pet_a: &PetInstance,
    pet_b: &PetInstance,
    roll_value: u64,
    cli_available: bool,
) -> Result<FusionPlan, String> {
    use crate::fusion_slots as fs;
    let tier = pet_a.tier;
    let fee = config.fusion_fee_for(tier);
    let result_tier = tier + 1;

    let mut elements = species_elements(config, save, &pet_a.species)?;
    elements.extend(species_elements(config, save, &pet_b.species)?);
    let recipe_key = fs::element_set_key(&elements);
    let element_count = recipe_key.split('+').count();

    // 同物种融合：确定性升阶为同一物种（不掷骰，AI 变种也照此可养成）。
    if pet_a.species == pet_b.species {
        return Ok(FusionPlan {
            result_species: pet_a.species.clone(),
            result_tier,
            fee,
            recipe_key,
            kind: FusionResultKind::SameSpecies,
        });
    }

    // 异物种：0 号固定物种（63 键全覆盖，理论必命中）。
    let fixed = config
        .species_by_recipe
        .get(&recipe_key)
        .cloned()
        .ok_or_else(|| format!("#recipeNoFixedSpecies|recipe={recipe_key}"))?;

    let registered = save.recipe_ai_slots.get(&recipe_key).map(|v| v.len()).unwrap_or(0);
    let obtained = obtained_slots_for(save, &recipe_key, &fixed);
    let a_percent = config.ai_total_chance_percent_for_count(element_count);
    let m = fs::frontier_m(fs::obtained_prefix(&obtained));
    let eff = fs::effective_frontier(m, registered, cli_available);
    let weights = fs::slot_weights(a_percent, eff);
    let total = fs::weights_sum(&weights).max(1);
    let rolled = fs::roll_slot(&weights, roll_value % total);

    let (result_species, kind) = match fs::classify_slot(rolled, registered) {
        fs::SlotOutcome::Fixed => (fixed, FusionResultKind::Fixed),
        fs::SlotOutcome::Reuse { slot } => {
            let code = save
                .recipe_ai_slots
                .get(&recipe_key)
                .and_then(|v| v.get(slot - 1))
                .cloned()
                .ok_or_else(|| format!("#recipeSlotUnregistered|recipe={recipe_key}|slot={slot}"))?;
            (code, FusionResultKind::Reuse(slot))
        }
        // 同步路径无法生成新变种：回退 0 号固定物种（PR-2 异步路径真正生成）。
        fs::SlotOutcome::Generate { slot } => (fixed, FusionResultKind::Generate(slot)),
    };

    Ok(FusionPlan { result_species, result_tier, fee, recipe_key, kind })
}

/// 融合掷点熵源（无 rand：now ⊕ 双亲 id 的 FNV 哈希，经 splitmix64 扩散）。
pub(crate) fn fusion_roll_value(now: i64, id_a: &str, id_b: &str) -> u64 {
    fn fnv(s: &str) -> u64 {
        let mut h = 0xcbf2_9ce4_8422_2325u64;
        for byte in s.bytes() {
            h ^= byte as u64;
            h = h.wrapping_mul(0x0000_0100_0000_01B3);
        }
        h
    }
    crate::fusion_slots::splitmix64((now as u64) ^ fnv(id_a).wrapping_add(fnv(id_b)))
}

/// 融合主逻辑（本地同步路径）：确定性升阶 / 异物种掷槽位阶梯 → 固定或复用变种。
/// 前沿新槽（需生成）在同步路径回退固定物种；真实 AI 生成走异步 fuse_pets_ai（PR-2）。
pub fn logic_fuse_pets(
    config: &GameConfig,
    save: &mut GameSave,
    id_a: &str,
    id_b: &str,
    now: i64,
    today: &str,
) -> Result<String, String> {
    settle_all(config, save, now, today);
    let (pet_a, pet_b) = logic_validate_fusion_pair(config, save, id_a, id_b)?;
    let roll = fusion_roll_value(now, id_a, id_b);
    let plan = plan_fusion(config, save, &pet_a, &pet_b, roll, false)?;
    consume_fusion_pair(save, id_a, id_b, plan.fee, &plan.recipe_key);
    Ok(push_fusion_egg(config, save, plan.result_species, plan.result_tier, now, None))
}

/// AI 融合启动：先提交后生成 —— 立即消耗双亲+手续费，产出一颗挂起的
/// 二阶融合蛋（species 先写兜底 guluduck），后台 worker 随后改写。
#[allow(dead_code)] // 旧直连路径：fuse_pets_ai 已改三段式（apply_fusion_local），保留供单测。
pub fn logic_start_ai_fusion(
    config: &GameConfig,
    save: &mut GameSave,
    id_a: &str,
    id_b: &str,
    now: i64,
    today: &str,
) -> Result<String, String> {
    settle_all(config, save, now, today);
    let (pet_a, pet_b) = logic_validate_fusion_pair(config, save, id_a, id_b)?;
    // 融合 2.0：配方 = 双亲元素并集；结果阶 = 亲代阶 +1；兜底 = 并集固定物种。
    let mut elements = species_elements(config, save, &pet_a.species)?;
    elements.extend(species_elements(config, save, &pet_b.species)?);
    let recipe_key = crate::fusion_slots::element_set_key(&elements);
    let result_tier = pet_a.tier + 1;
    let fallback = config
        .species_by_recipe
        .get(&recipe_key)
        .cloned()
        .unwrap_or_else(|| FALLBACK_SPECIES.to_string());
    let fee = config.fusion_fee_for(pet_a.tier);
    consume_fusion_pair(save, id_a, id_b, fee, &recipe_key);
    let pending = PendingFusionInfo {
        parents: [pet_a.species.clone(), pet_b.species.clone()],
        recipe_key,
        requested_at: now,
        attempts: 0,
        status: "pending".to_string(),
        last_error: None,
        forced_codename: None,
        provider: None,
    };
    Ok(push_fusion_egg(config, save, fallback, result_tier, now, Some(pending)))
}

/// AI 生成成功：注册自定义物种并把挂起蛋的 species 改写成新 codename。
/// 蛋已被提前收走/清档时报错（调用方丢弃结果即可，蛋已按兜底孵出）。
pub fn logic_resolve_fusion_egg(
    config: &GameConfig,
    save: &mut GameSave,
    egg_id: &str,
    codename: &str,
    entry: CustomSpeciesEntry,
) -> Result<(), String> {
    let egg_index = save
        .eggs
        .iter()
        .position(|e| e.id == egg_id)
        .ok_or_else(|| "#eggGone".to_string())?;
    if save.eggs[egg_index].pending_fusion.is_none() {
        return Err("#eggNoPendingFusion".to_string());
    }
    if config.species.contains_key(codename) || save.custom_species.contains_key(codename) {
        return Err(format!("#codenameTaken|codename={codename}"));
    }
    save.custom_species.insert(codename.to_string(), entry);

    // FusionRecipeSlots §3.3/§5：AI 生成成功即注册槽位（recipeAiSlots）；孵化才记 dexObtained。
    // 生成只发生在前沿槽（= 已注册数 + 1），按注册序追加即落到正确槽（下标 0 = 1 号槽）；
    // 封顶 MAX_AI_SLOTS，幂等去重（重复 resolve/意图回放不重复占槽）。漏掉这步 → AI 变种
    // 既不进图鉴对应格、也不推进"解锁下一个变种"的前沿（配方键取自挂起蛋的 recipeKey）。
    let recipe_key = save.eggs[egg_index]
        .pending_fusion
        .as_ref()
        .map(|pending| pending.recipe_key.clone());
    if let Some(recipe_key) = recipe_key {
        register_ai_slot(save, &recipe_key, codename);
    }

    let egg = &mut save.eggs[egg_index];
    egg.species = codename.to_string();
    if let Some(pending) = egg.pending_fusion.as_mut() {
        pending.status = "resolved".to_string();
        pending.last_error = None;
    }
    Ok(())
}

/// 复用既有物种解析融合蛋：Steam 掷中的确定性槽位（`forced_codename`）在本次生成
/// 落地前已被注册（另一路同配方融合先解析 / 他机工坊导入了同一槽）时，把蛋直接解析成
/// 该既有 codename，**不再新插入一个随机名重复物种**——否则本地会多出一个无 Steam def
/// 映射的孪生物种，而孵出的宠仍绑着该槽位 def，本地↔Steam 记账永久分叉（review C#10）。
/// 幂等注册 AI 槽；蛋不存在/无挂起融合时报错（调用方丢弃结果即可，蛋已按兜底孵出）。
pub fn logic_reuse_fusion_egg(save: &mut GameSave, egg_id: &str, codename: &str) -> Result<(), String> {
    let egg_index = save
        .eggs
        .iter()
        .position(|e| e.id == egg_id)
        .ok_or_else(|| "#eggGone".to_string())?;
    if save.eggs[egg_index].pending_fusion.is_none() {
        return Err("#eggNoPendingFusion".to_string());
    }
    // 幂等占槽（既有 codename 通常已注册，这里只是防御性补一次）。
    let recipe_key = save.eggs[egg_index]
        .pending_fusion
        .as_ref()
        .map(|pending| pending.recipe_key.clone());
    if let Some(recipe_key) = recipe_key {
        register_ai_slot(save, &recipe_key, codename);
    }
    let egg = &mut save.eggs[egg_index];
    egg.species = codename.to_string();
    if let Some(pending) = egg.pending_fusion.as_mut() {
        pending.status = "resolved".to_string();
        pending.last_error = None;
    }
    Ok(())
}

/// worker 更新挂起蛋状态（generating/failed 等）。已 resolved 的蛋不再改动。
/// 记录当前正在为这颗融合蛋生成的 CLI provider（供前端显示"Claude/Codex 生成中"）。
/// 蛋不存在或已 resolved 时静默忽略。
pub fn logic_set_fusion_provider(save: &mut GameSave, egg_id: &str, provider: &str) {
    if let Some(egg) = save.eggs.iter_mut().find(|e| e.id == egg_id) {
        if let Some(pending) = egg.pending_fusion.as_mut() {
            if pending.status != "resolved" {
                pending.provider = Some(provider.to_string());
            }
        }
    }
}

pub fn logic_mark_fusion_egg(
    save: &mut GameSave,
    egg_id: &str,
    status: &str,
    error: Option<String>,
    bump_attempt: bool,
) -> Result<(), String> {
    let egg = save
        .eggs
        .iter_mut()
        .find(|e| e.id == egg_id)
        .ok_or_else(|| "#eggGone".to_string())?;
    let Some(pending) = egg.pending_fusion.as_mut() else {
        return Err("#eggNoPendingFusion".to_string());
    };
    if pending.status == "resolved" {
        return Ok(());
    }
    pending.status = status.to_string();
    pending.last_error = error;
    if bump_attempt {
        pending.attempts += 1;
    }
    Ok(())
}
