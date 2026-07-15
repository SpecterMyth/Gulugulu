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
        return Err("需要两只不同的精灵".to_string());
    }
    let pet_a = save
        .pets
        .iter()
        .find(|p| p.id == id_a)
        .ok_or_else(|| "找不到精灵 A".to_string())?
        .clone();
    let pet_b = save
        .pets
        .iter()
        .find(|p| p.id == id_b)
        .ok_or_else(|| "找不到精灵 B".to_string())?
        .clone();

    if pet_a.tier != pet_b.tier {
        return Err("必须是同阶精灵才能融合".to_string());
    }
    // 融合 2.0：同阶 1~5 皆可融（结果 = 亲代阶 +1），两只 6 阶已达顶。
    if pet_a.tier < 1 || pet_a.tier > 5 {
        return Err("已达最高阶，无法再融合".to_string());
    }
    if !is_max_level(config, &pet_a) || !is_max_level(config, &pet_b) {
        return Err("两只精灵都要满级才能融合".to_string());
    }
    if save.coins < config.fusion_fee_for(pet_a.tier) {
        return Err("金币不足，融合需要手续费".to_string());
    }
    Ok((pet_a, pet_b))
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
        .ok_or_else(|| "未知物种".to_string())?;
    let element_b = species_info(config, save, &pet_b.species)
        .and_then(|s| s.elements.first().cloned())
        .ok_or_else(|| "未知物种".to_string())?;
    Ok(fusion_recipe_key(&element_a, &element_b))
}

/// 消耗融合素材：扣手续费（按亲代阶）、移除双亲、修复 active_pet_id。
pub(crate) fn consume_fusion_pair(save: &mut GameSave, id_a: &str, id_b: &str, fee: u64) {
    save.coins = save.coins.saturating_sub(fee);
    save.pets.retain(|p| p.id != id_a && p.id != id_b);
    if let Some(active) = &save.active_pet_id {
        if active == id_a || active == id_b {
            save.active_pet_id = save.pets.first().map(|p| p.id.clone());
        }
    }
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
    });
    egg_id
}

/// 某物种的元素集合（config 目录 → AI 自定义物种）。
pub(crate) fn species_elements(config: &GameConfig, save: &GameSave, species: &str) -> Result<Vec<String>, String> {
    species_info(config, save, species)
        .map(|s| s.elements.clone())
        .ok_or_else(|| format!("未知物种 {species}"))
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
        .ok_or_else(|| format!("配方 {recipe_key} 缺少固定物种"))?;

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
                .ok_or_else(|| format!("配方 {recipe_key} 槽 {slot} 未注册"))?;
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
    consume_fusion_pair(save, id_a, id_b, plan.fee);
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
    consume_fusion_pair(save, id_a, id_b, fee);
    let pending = PendingFusionInfo {
        parents: [pet_a.species.clone(), pet_b.species.clone()],
        recipe_key,
        requested_at: now,
        attempts: 0,
        status: "pending".to_string(),
        last_error: None,
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
        .ok_or_else(|| "蛋已不存在".to_string())?;
    if save.eggs[egg_index].pending_fusion.is_none() {
        return Err("这颗蛋没有待定的融合".to_string());
    }
    if config.species.contains_key(codename) || save.custom_species.contains_key(codename) {
        return Err(format!("物种名已被占用：{codename}"));
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
        let slots = save.recipe_ai_slots.entry(recipe_key).or_default();
        if !slots.iter().any(|c| c == codename) && slots.len() < crate::fusion_slots::MAX_AI_SLOTS {
            slots.push(codename.to_string());
        }
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
        .ok_or_else(|| "蛋已不存在".to_string())?;
    let Some(pending) = egg.pending_fusion.as_mut() else {
        return Err("这颗蛋没有待定的融合".to_string());
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
