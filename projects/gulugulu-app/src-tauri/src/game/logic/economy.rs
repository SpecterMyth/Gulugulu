use crate::game::*;

pub(crate) fn used_slots(save: &GameSave) -> Vec<u8> {
    save.eggs.iter().filter_map(|egg| egg.slot).collect()
}

pub(crate) fn first_free_slot(config: &GameConfig, save: &GameSave) -> Option<u8> {
    let slot_count = config.hatchery_slot_count(save.hatchery_level);
    let used = used_slots(save);
    (0..slot_count).find(|slot| !used.contains(slot))
}

/// 把一个物种加入蛋池候选（EconomyScaling.md §7.1）：含该属性、元素数 ≤ 蛋阶、
/// 且已解锁（`dexObtained≥1`）。**元素数=1 的 6 只基础种恒可售**（游戏入口，无需解锁）。
pub(crate) fn egg_pool_push(
    out: &mut Vec<(String, u64)>,
    config: &GameConfig,
    save: &GameSave,
    element: &str,
    tier: u8,
    codename: &str,
    info: &SpeciesInfo,
) {
    let count = info.element_count();
    if count < 1 || count > tier as usize {
        return;
    }
    if !info.elements.iter().any(|e| e == element) {
        return;
    }
    let always = count == 1; // 基础种恒可售
    let unlocked = save.dex_obtained.get(codename).copied().unwrap_or(0) >= 1;
    if !(always || unlocked) {
        return;
    }
    out.push((codename.to_string(), config.egg_rarity_weight(count)));
}

/// 「T 阶 · E 属性」蛋的候选物种及整数权重（EconomyScaling.md §7）。遍历 63 目录物种
/// （跳过 21 只 legacy 二阶——非配方物种）+ 已解锁的 AI 自定义物种。永不返回空（保底基础种）。
/// 纯函数、确定性顺序（BTreeMap 键序），供掷蛋、蛋卡产出预览、单测共用。
pub(crate) fn egg_pool_candidates(
    config: &GameConfig,
    save: &GameSave,
    element: &str,
    tier: u8,
) -> Vec<(String, u64)> {
    let mut out: Vec<(String, u64)> = Vec::new();
    for (codename, info) in &config.species {
        if info.tier == 2 {
            continue; // legacy 二阶物种是迁移用副本，不进配方蛋池
        }
        egg_pool_push(&mut out, config, save, element, tier, codename, info);
    }
    for (codename, entry) in &save.custom_species {
        egg_pool_push(&mut out, config, save, element, tier, codename, &entry.info);
    }
    out
}

/// 按整数权重从蛋池掷定物种（`roll` 为任意 u64 熵源）。空池 → None。
pub(crate) fn roll_egg_species(
    config: &GameConfig,
    save: &GameSave,
    element: &str,
    tier: u8,
    roll: u64,
) -> Option<String> {
    let pool = egg_pool_candidates(config, save, element, tier);
    if pool.is_empty() {
        return None;
    }
    let total: u64 = pool.iter().map(|(_, w)| *w).sum::<u64>().max(1);
    let mut pick = roll % total;
    for (codename, weight) in &pool {
        if pick < *weight {
            return Some(codename.clone());
        }
        pick = pick.saturating_sub(*weight);
    }
    pool.last().map(|(c, _)| c.clone())
}

/// 购蛋（EconomyScaling.md §6/§7）：分阶蛋价 + 商店等级校验 + 从属性角色库掷定物种。
/// 1 阶 = 该属性基础种（确定性）；2 阶+ 从已解锁池按元素数加权随机（越多元素越稀有）。
pub fn logic_buy_egg(
    config: &GameConfig,
    save: &mut GameSave,
    element: &str,
    tier: u8,
    now: i64,
    today: &str,
) -> Result<String, String> {
    settle_all(config, save, now, today);
    if tier < 1 {
        return Err("蛋阶非法".to_string());
    }
    if tier > save.shop_level.max(1) || tier > config.shop_max_level() {
        return Err("商店等级不足，先升级商店".to_string());
    }
    if !config.egg_prices.contains_key(element) {
        return Err("没有这种属性的蛋".to_string());
    }
    let price = config.egg_price_for(element, tier);
    if save.coins < price {
        return Err("金币不足".to_string());
    }
    let species = roll_egg_species(config, save, element, tier, pseudo_random_u64())
        .ok_or_else(|| "没有对应的精灵".to_string())?;

    save.coins -= price;
    let hatch_kind = if tier <= 1 {
        element.to_string()
    } else {
        format!("tier{tier}")
    };
    let slot = first_free_slot(config, save);
    let hatch_at = slot.map(|_| now + *config.hatch_seconds.get(&hatch_kind).unwrap_or(&180) as i64);
    let egg_id = new_id("egg");
    save.eggs.push(EggInstance {
        id: egg_id.clone(),
        species,
        tier,
        hatch_kind,
        slot,
        hatch_at,
        pending_fusion: None,
        steam_item_id: None,
        steam_item_def: None,
    });
    Ok(egg_id)
}

/// 升级商店（EconomyScaling.md §6.1）：可售最高蛋阶 +1，封顶 shopMaxLevel。
pub fn logic_upgrade_shop(
    config: &GameConfig,
    save: &mut GameSave,
    now: i64,
    today: &str,
) -> Result<(), String> {
    settle_all(config, save, now, today);
    let level = save.shop_level.max(1);
    let cost = config
        .shop_upgrade_cost(level)
        .ok_or_else(|| "商店已是最高等级".to_string())?;
    if save.coins < cost {
        return Err("金币不足".to_string());
    }
    save.coins -= cost;
    save.shop_level = level + 1;
    Ok(())
}

pub fn logic_place_egg(
    config: &GameConfig,
    save: &mut GameSave,
    egg_id: &str,
    slot: u8,
    now: i64,
    today: &str,
) -> Result<(), String> {
    settle_all(config, save, now, today);
    let slot_count = config.hatchery_slot_count(save.hatchery_level);
    if slot >= slot_count {
        return Err("这个孵化槽还没解锁".to_string());
    }
    if used_slots(save).contains(&slot) {
        return Err("这个孵化槽已被占用".to_string());
    }
    let hatch_seconds = {
        let egg = save
            .eggs
            .iter()
            .find(|e| e.id == egg_id)
            .ok_or_else(|| "找不到这颗蛋".to_string())?;
        if egg.slot.is_some() {
            return Err("这颗蛋已经在孵化中".to_string());
        }
        *config.hatch_seconds.get(&egg.hatch_kind).unwrap_or(&180) as i64
    };
    let egg = save.eggs.iter_mut().find(|e| e.id == egg_id).unwrap();
    egg.slot = Some(slot);
    egg.hatch_at = Some(now + hatch_seconds);
    Ok(())
}

/// 收取前置校验（只读）：蛋存在、到点、在槽位、后院有空间。返回蛋索引。
pub(crate) fn validate_collect(
    config: &GameConfig,
    save: &GameSave,
    egg_id: &str,
    now: i64,
) -> Result<usize, String> {
    let egg_index = save
        .eggs
        .iter()
        .position(|e| e.id == egg_id)
        .ok_or_else(|| "找不到这颗蛋".to_string())?;
    {
        let egg = &save.eggs[egg_index];
        match egg.hatch_at {
            Some(hatch_at) if egg.slot.is_some() && now >= hatch_at => {}
            _ => return Err("还没孵好".to_string()),
        }
    }
    let capacity = config.yard_capacity_for(save.yard_level) as usize;
    if save.pets.len() >= capacity {
        return Err("后院已满，先去放生腾出位置".to_string());
    }
    Ok(egg_index)
}

/// 图鉴记账：某物种曾获只数 +1（孵出即记，唯一写入点在 `apply_collect`）。
/// 放生/融合消耗**不减**（"只要获得过就永久入册"，PokedexSystem.md §2）。
pub(crate) fn record_species_obtained(save: &mut GameSave, species: &str) {
    *save.dex_obtained.entry(species.to_string()).or_insert(0) += 1;
}

/// 应用收取：移除蛋、创建宠物。`granted` 为 Steam 兑换结果
/// （物种覆盖 + 物品绑定）；本地路径传 None。
pub(crate) fn apply_collect(
    config: &GameConfig,
    save: &mut GameSave,
    egg_index: usize,
    now: i64,
    granted: Option<(String, String, u32)>,
) -> String {
    let egg = save.eggs.remove(egg_index);
    let (species, steam_item_id, steam_item_def) = match granted {
        Some((species, item_id, def)) => (species, Some(item_id), Some(def)),
        None => (egg.species, None, None),
    };
    // 融合 2.0：宠物阶数来自蛋（结果阶）；旧 legacy 物种自带 tier>0 时沿用，
    // 新物种(species.tier==0)一律取 egg.tier。
    let tier = match species_info(config, save, &species).map(|s| s.tier) {
        Some(t) if t > 0 => t,
        _ => egg.tier,
    };
    record_species_obtained(save, &species);
    let pet_id = new_id("pet");
    save.pets.push(PetInstance {
        id: pet_id.clone(),
        species,
        tier,
        level: 1,
        exp: 0,
        stamina: config.stamina_max,
        stamina_updated_at: now,
        exhausted: false,
        key_buffer: 0,
        token_buffer: 0,
        steam_item_id,
        steam_item_def,
    });
    if save.active_pet_id.is_none() {
        save.active_pet_id = Some(pet_id.clone());
    }
    pet_id
}

#[allow(dead_code)] // 本地纯逻辑路径：命令已改三段式，此函数供单测与回归基准。
pub fn logic_collect_hatched(
    config: &GameConfig,
    save: &mut GameSave,
    egg_id: &str,
    now: i64,
    today: &str,
) -> Result<String, String> {
    settle_all(config, save, now, today);
    let egg_index = validate_collect(config, save, egg_id, now)?;
    Ok(apply_collect(config, save, egg_index, now, None))
}

