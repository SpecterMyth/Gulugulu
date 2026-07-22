use crate::game::*;

pub(crate) fn used_slots(save: &GameSave) -> Vec<u8> {
    save.eggs.iter().filter_map(|egg| egg.slot).collect()
}

pub(crate) fn first_free_slot(config: &GameConfig, save: &GameSave) -> Option<u8> {
    let slot_count = config.hatchery_slot_count(save.hatchery_level);
    let used = used_slots(save);
    (0..slot_count).find(|slot| !used.contains(slot))
}

/// 把一个固定配方物种加入蛋池候选（EconomyScaling.md §7.1）：含该属性、元素数 ≤ 蛋阶。
/// **商店蛋 = 全局池（2026-07-15）**：不再按 `dexObtained` 解锁门筛选，可产出**尚未解锁**的
/// 固定配方物种；调用点只喂固定配方物种（不含 AI 自定义变种）。稀有度权重仍按元素数。
pub(crate) fn egg_pool_push(
    out: &mut Vec<(String, u64)>,
    config: &GameConfig,
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
    out.push((codename.to_string(), config.egg_rarity_weight(count)));
}

/// 「T 阶 · E 属性」蛋的候选**固定配方物种**及整数权重（EconomyScaling.md §7）。遍历 63 目录
/// 物种（跳过 21 只 legacy 二阶——非配方物种）。**商店蛋 = 全局池（2026-07-15）**：不按
/// `dexObtained` 解锁门筛（可产未解锁固定种）、**不含 AI 自定义变种**（AI 只经融合获得，见
/// `plans/steam_trade/00-decisions.md`「用户拍板（2026-07-15）· 商店蛋全局池」）。永不返回空
/// （基础种恒含该属性）。纯函数、确定性顺序（BTreeMap 键序），供掷蛋、蛋卡产出预览、单测共用。
pub(crate) fn egg_pool_candidates(
    config: &GameConfig,
    element: &str,
    tier: u8,
) -> Vec<(String, u64)> {
    let mut out: Vec<(String, u64)> = Vec::new();
    for (codename, info) in &config.species {
        if info.tier == 2 {
            continue; // legacy 二阶物种是迁移用副本，不进配方蛋池
        }
        egg_pool_push(&mut out, config, element, tier, codename, info);
    }
    out
}

/// 按整数权重从蛋池掷定物种（`roll` 为任意 u64 熵源）。空池 → None。
pub(crate) fn roll_egg_species(
    config: &GameConfig,
    element: &str,
    tier: u8,
    roll: u64,
) -> Option<String> {
    let pool = egg_pool_candidates(config, element, tier);
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
        return Err("#eggTierInvalid".to_string());
    }
    if tier > save.shop_level.max(1) || tier > config.shop_max_level() {
        return Err("#shopLevelTooLow".to_string());
    }
    if !config.egg_prices.contains_key(element) {
        return Err("#noSuchElementEgg".to_string());
    }
    // 每日产出上限（EconomyScaling.md §7.5；「限频 generator」的客户端镜像）：达上限拒绝孵化。
    let mint_key = format!("{element}:{tier}");
    let cap = config.egg_daily_mint_cap(tier);
    let minted_today = save.daily.egg_mints.get(&mint_key).copied().unwrap_or(0);
    if minted_today >= cap {
        return Err(format!("#eggDailyCap|recipe={element}|tier={tier}|cap={cap}"));
    }
    let price = config.egg_price_for(element, tier);
    if save.coins < price {
        return Err("#notEnoughCoins".to_string());
    }
    let species = roll_egg_species(config, element, tier, pseudo_random_u64())
        .ok_or_else(|| "#noMatchingSpecies".to_string())?;

    save.coins -= price;
    *save.daily.egg_mints.entry(mint_key).or_insert(0) += 1;
    let hatch_kind = if tier <= 1 {
        element.to_string()
    } else {
        format!("tier{tier}")
    };
    let slot = first_free_slot(config, save);
    // 教学硬编码：首次商店购买固定 30s 孵化（OnboardingCoach.md §3.1）；仅当真入槽才算首购。
    let first_buy = !save.tutorial_first_egg_bought;
    let hatch_secs = if first_buy && slot.is_some() {
        30
    } else {
        *config.hatch_seconds.get(&hatch_kind).unwrap_or(&180) as i64
    };
    if first_buy && slot.is_some() {
        save.tutorial_first_egg_bought = true;
    }
    let hatch_at = slot.map(|_| now + hatch_secs);
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
        shop_element: Some(element.to_string()),
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
        .ok_or_else(|| "#shopMaxLevel".to_string())?;
    if save.coins < cost {
        return Err("#notEnoughCoins".to_string());
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
        return Err("#slotLocked".to_string());
    }
    if used_slots(save).contains(&slot) {
        return Err("#slotOccupied".to_string());
    }
    let hatch_seconds = {
        let egg = save
            .eggs
            .iter()
            .find(|e| e.id == egg_id)
            .ok_or_else(|| "#eggNotFound".to_string())?;
        if egg.slot.is_some() {
            return Err("#eggAlreadyIncubating".to_string());
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
        .ok_or_else(|| "#eggNotFound".to_string())?;
    {
        let egg = &save.eggs[egg_index];
        match egg.hatch_at {
            Some(hatch_at) if egg.slot.is_some() && now >= hatch_at => {}
            _ => return Err("#eggNotReady".to_string()),
        }
    }
    let capacity = config.yard_capacity_for(save.yard_level) as usize;
    if save.pets.len() >= capacity {
        return Err("#yardFull".to_string());
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
    // 融合 2.0：阶数在实例上，**蛋阶 = 宠阶**（EconomyScaling §7）——一律取 egg.tier。
    // 旧口径"物种自带 tier>0 沿用"是 bug：2 阶商店蛋掷中目录一阶物种（如 emberfox）
    // 时会错落成 t1（2026-07-16 真机 E2E 发现）。教程/一阶蛋与 legacy 蛋两侧本就相等。
    let tier = egg.tier.max(1);
    record_species_obtained(save, &species);
    save.daily.hatches += 1; // 昨日战报：当日孵化（收取到手）总数（唯一写入点）
    // 成就：曾拥有过的最高阶（孵出即知阶，SteamAchievements.md §3.3 品阶组）。
    if tier > save.stats.highest_tier {
        save.stats.highest_tier = tier;
    }
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

/// 催蛋：孵化中的蛋每点一下 −1s（OnboardingCoach.md #2）。夹到 now（不早于当前，到点即可收）；
/// 非孵化中的蛋（无槽 / 无 hatch_at / 已就绪）一律忽略。
pub fn logic_poke_egg(save: &mut GameSave, egg_id: &str, now: i64) {
    if let Some(egg) = save.eggs.iter_mut().find(|e| e.id == egg_id) {
        if let (Some(_), Some(hatch_at)) = (egg.slot, egg.hatch_at) {
            if hatch_at > now {
                egg.hatch_at = Some((hatch_at - 1).max(now));
            }
        }
    }
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

