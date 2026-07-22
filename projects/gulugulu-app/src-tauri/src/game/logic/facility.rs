use crate::game::*;

pub fn logic_upgrade_hatchery(
    config: &GameConfig,
    save: &mut GameSave,
    now: i64,
    today: &str,
) -> Result<(), String> {
    settle_all(config, save, now, today);
    let level = save.hatchery_level as usize;
    if level >= config.hatchery_slots.len() {
        return Err("#hatcheryMaxLevel".to_string());
    }
    let cost = *config
        .hatchery_upgrade_costs
        .get(level - 1)
        .ok_or_else(|| "#missingUpgradeCost".to_string())?;
    if save.coins < cost {
        return Err("#notEnoughCoins".to_string());
    }
    save.coins -= cost;
    save.hatchery_level += 1;
    Ok(())
}

pub fn logic_upgrade_yard(
    config: &GameConfig,
    save: &mut GameSave,
    now: i64,
    today: &str,
) -> Result<(), String> {
    settle_all(config, save, now, today);
    let level = save.yard_level as usize;
    if level >= config.yard_capacity.len() {
        return Err("#yardMaxLevel".to_string());
    }
    let cost = *config
        .yard_upgrade_costs
        .get(level - 1)
        .ok_or_else(|| "#missingUpgradeCost".to_string())?;
    if save.coins < cost {
        return Err("#notEnoughCoins".to_string());
    }
    save.coins -= cost;
    save.yard_level += 1;
    Ok(())
}

/// 确定性 AI codename（aif+2位配方序+2位槽）→ 配方元素集合。物种资料缺失
/// （Steam 侧导入、本机未注册的 AI 变种）时的兜底；旧随机名/越界 → None。
fn ai_codename_elements(config: &GameConfig, codename: &str) -> Option<Vec<String>> {
    let def = crate::fusion_slots::ai_def_for_codename(codename)?;
    let ordinal = ((def - crate::fusion_slots::AI_ITEM_DEF_BASE) / 100) as usize;
    let keys: Vec<String> = config.species_by_recipe.keys().cloned().collect();
    let ordered = crate::fusion_slots::multi_element_recipes_ordered(&keys);
    ordered
        .get(ordinal)
        .map(|key| key.split('+').map(String::from).collect())
}

/// 放生返还金额（只读计算，供正常路径与崩溃恢复意图回放共用）。
/// 等效蛋价只依赖元素集合（EconomyScaling.md §8）——物种资料缺失（Steam 侧导入的
/// 未注册 AI 变种，形象/设定尚未同步到本机）时按确定性 codename 反解配方元素直算，
/// **放生不被「未知物种」卡死**；连配方都反解不出的异常名 → 等效价按 0，只按等级返还。
pub(crate) fn release_refund_for(
    config: &GameConfig,
    save: &GameSave,
    pet_id: &str,
) -> Result<u64, String> {
    let pet = save
        .pets
        .iter()
        .find(|p| p.id == pet_id)
        .ok_or_else(|| "#petNotFound".to_string())?;
    // 等效蛋价按**实例阶**（pet.tier）乘法缩放（EconomyScaling.md §8）。
    let equivalent = match species_info(config, save, &pet.species) {
        Some(species) => config.equivalent_egg_price(species, pet.tier),
        None => ai_codename_elements(config, &pet.species)
            .map(|elements| config.equivalent_egg_price_for_elements(&elements, pet.tier))
            .unwrap_or(0),
    };
    Ok((equivalent as f64 * config.release_refund_rate).floor() as u64
        + config.release_refund_per_level * pet.level as u64)
}

/// 应用放生（无最后一只守卫——守卫在调用方；意图回放时物品已消耗，必须执行）。
pub(crate) fn apply_release(save: &mut GameSave, pet_id: &str, refund: u64) {
    save.pets.retain(|p| p.id != pet_id);
    if save.active_pet_id.as_deref() == Some(pet_id) {
        save.active_pet_id = save.pets.first().map(|p| p.id.clone());
    }
    save.coins += refund;
    // 成就：放生总数 + 首次放生（SteamAchievements.md §3.3）。
    save.stats.total_releases += 1;
    save.stats.first_release_done = true;
    save.daily.releases += 1; // 昨日战报：当日放生数
}

#[allow(dead_code)] // 本地纯逻辑路径：命令已改三段式，此函数供单测与回归基准。
pub fn logic_release_pet(
    config: &GameConfig,
    save: &mut GameSave,
    pet_id: &str,
    now: i64,
    today: &str,
) -> Result<u64, String> {
    settle_all(config, save, now, today);
    if save.pets.len() <= 1 {
        return Err("#lastPetCannotRelease".to_string());
    }
    let refund = release_refund_for(config, save, pet_id)?;
    apply_release(save, pet_id, refund);
    Ok(refund)
}

pub fn logic_set_active_pet(save: &mut GameSave, pet_id: &str) -> Result<(), String> {
    if !save.pets.iter().any(|p| p.id == pet_id) {
        return Err("#petNotFound".to_string());
    }
    save.active_pet_id = Some(pet_id.to_string());
    Ok(())
}
