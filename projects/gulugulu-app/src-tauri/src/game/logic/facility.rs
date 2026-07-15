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
        return Err("孵化屋已是最高等级".to_string());
    }
    let cost = *config
        .hatchery_upgrade_costs
        .get(level - 1)
        .ok_or_else(|| "缺少升级价格配置".to_string())?;
    if save.coins < cost {
        return Err("金币不足".to_string());
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
        return Err("后院已是最高等级".to_string());
    }
    let cost = *config
        .yard_upgrade_costs
        .get(level - 1)
        .ok_or_else(|| "缺少升级价格配置".to_string())?;
    if save.coins < cost {
        return Err("金币不足".to_string());
    }
    save.coins -= cost;
    save.yard_level += 1;
    Ok(())
}

/// 放生返还金额（只读计算，供正常路径与崩溃恢复意图回放共用）。
pub(crate) fn release_refund_for(
    config: &GameConfig,
    save: &GameSave,
    pet_id: &str,
) -> Result<u64, String> {
    let pet = save
        .pets
        .iter()
        .find(|p| p.id == pet_id)
        .ok_or_else(|| "找不到这只精灵".to_string())?;
    let species = species_info(config, save, &pet.species)
        .ok_or_else(|| "未知物种".to_string())?;
    // 等效蛋价按**实例阶**（pet.tier）乘法缩放（EconomyScaling.md §8）。
    let equivalent = config.equivalent_egg_price(species, pet.tier);
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
        return Err("最后一只伙伴不能放生".to_string());
    }
    let refund = release_refund_for(config, save, pet_id)?;
    apply_release(save, pet_id, refund);
    Ok(refund)
}

pub fn logic_set_active_pet(save: &mut GameSave, pet_id: &str) -> Result<(), String> {
    if !save.pets.iter().any(|p| p.id == pet_id) {
        return Err("找不到这只精灵".to_string());
    }
    save.active_pet_id = Some(pet_id.to_string());
    Ok(())
}

/// 漫游零食（v1.1，原漫游捡币）：主宠漫游结束时 +2~5 点精力，受日上限。
/// 只产精力——金币只来自点击（经济不变量）。
pub fn logic_wander_snack(config: &GameConfig, save: &mut GameSave, now: i64, today: &str) -> i64 {
    settle_all(config, save, now, today);
    let room = config
        .wander_snack_daily_cap
        .saturating_sub(save.daily.snack_stamina);
    if room == 0 {
        return 0;
    }
    let Some(active_id) = save.active_pet_id.clone() else {
        return 0;
    };
    let Some(pet) = save.pets.iter_mut().find(|p| p.id == active_id) else {
        return 0;
    };
    let min = config.wander_snack_stamina_min.max(0) as u64;
    let max = config.wander_snack_stamina_max.max(config.wander_snack_stamina_min).max(0) as u64;
    let rolled = pseudo_random_in(min, max).min(room);
    let gained = (rolled as i64).min(config.stamina_max - pet.stamina).max(0);
    if gained == 0 {
        return 0;
    }
    pet.stamina += gained;
    if pet.exhausted && pet.stamina >= config.wake_threshold {
        pet.exhausted = false;
    }
    save.daily.snack_stamina += gained as u64;
    gained
}
