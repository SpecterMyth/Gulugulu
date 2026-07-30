use crate::game::*;

// ---------------------------------------------------------------------------
// 训练馆与升阶材料（EconomyRework-TrainingHall.md §3/§5.2）
//
// 经济 v2.0 的纵轴：**融合管横向（物种＝元素集合），训练馆管纵向（阶数）**。
// 融合封顶三阶后，4~6 阶只能在这里练出来；1~3 阶两条路并存——
//   融合 = 我要新东西（换物种，吃掉两只）
//   训练 = 我要这一只更强（保物种，吃材料）
// 材料的唯一产出源是工厂关卡奖励（`logic_claim_factory_levels`），每个自然日
// 每关只领一次。
//
// 全部为纯函数：只吃 `&GameConfig` + `&mut GameSave`，不碰锁，直接可单测。
// ---------------------------------------------------------------------------

/// 建造/升级训练馆。馆等级 L 解锁「L → L+1 阶」的升阶，故封顶 = 升阶阶梯项数。
pub fn logic_build_training_hall(
    config: &GameConfig,
    save: &mut GameSave,
    now: i64,
    today: &str,
) -> Result<(), String> {
    settle_all(config, save, now, today);
    let cost = config
        .training_hall_upgrade_cost(save.training_hall_level)
        .ok_or_else(|| "#trainingHallMaxLevel".to_string())?;
    let tutorial_reimburse = !save.training_tutorial_boost_claimed
        && save.training_hall_level == 0
        && save.pets.iter().any(|pet| {
            if pet.tier != 1 || !is_max_level(config, pet) {
                return false;
            }
            config
                .training_step_for(1)
                .map(|(material, need, _, _)| material_count(save, &material) >= need)
                .unwrap_or(false)
        });
    if save.coins < cost && !tutorial_reimburse {
        return Err("#notEnoughCoins".to_string());
    }
    save.coins = save.coins.saturating_sub(cost);
    save.training_hall_level += 1;
    Ok(())
}

/// 扩建训练槽（可同时训练的宠物数）。
pub fn logic_upgrade_training_slots(
    config: &GameConfig,
    save: &mut GameSave,
    now: i64,
    today: &str,
) -> Result<(), String> {
    settle_all(config, save, now, today);
    if save.training_hall_level == 0 {
        return Err("#trainingHallLocked".to_string());
    }
    let level = save.training_slot_level.max(1);
    let cost = config
        .training_slot_upgrade_cost(level)
        .ok_or_else(|| "#trainingSlotMaxLevel".to_string())?;
    if save.coins < cost {
        return Err("#notEnoughCoins".to_string());
    }
    save.coins -= cost;
    save.training_slot_level = level + 1;
    Ok(())
}

/// 某材料的持有数。
pub(crate) fn material_count(save: &GameSave, material: &str) -> u32 {
    save.materials.get(material).copied().unwrap_or(0)
}

/// 扣减材料（不足按 0 收敛——调用方必须先校验）。
fn take_material(save: &mut GameSave, material: &str, count: u32) {
    if count == 0 {
        return;
    }
    let left = material_count(save, material).saturating_sub(count);
    if left == 0 {
        save.materials.remove(material);
    } else {
        save.materials.insert(material.to_string(), left);
    }
}

/// 发放材料。
pub(crate) fn give_material(save: &mut GameSave, material: &str, count: u32) {
    if count == 0 {
        return;
    }
    *save.materials.entry(material.to_string()).or_insert(0) += count;
}

/// 「本次升阶要花掉哪些材料」的拆分结果：主材料 N 个 + 万能券补 M 个（N+M = 需求）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MaterialSpend {
    pub main: u32,
    pub universal: u32,
}

/// 校验材料是否够，并给出扣减拆分。`use_universal=false` 时不许动万能券。
/// 万能券 1:1 替代任意升阶材料（工厂 26–30 关产出，是后期短板材料的加速通道）。
pub fn plan_material_spend(
    config: &GameConfig,
    save: &GameSave,
    material: &str,
    need: u32,
    use_universal: bool,
) -> Result<MaterialSpend, String> {
    let have = material_count(save, material);
    let main = have.min(need);
    let short = need - main;
    if short == 0 {
        return Ok(MaterialSpend { main, universal: 0 });
    }
    if !use_universal {
        return Err(format!(
            "#trainingNoMaterial|material={material}|have={have}|need={need}"
        ));
    }
    let universal_have = material_count(save, &config.universal_material);
    if universal_have < short {
        return Err(format!(
            "#trainingNoMaterial|material={material}|have={have}|need={need}"
        ));
    }
    Ok(MaterialSpend {
        main,
        universal: short,
    })
}

/// 当前空闲的训练槽序号（无空槽 → None）。
fn first_free_training_slot(config: &GameConfig, save: &GameSave) -> Option<u32> {
    let total = config.training_slot_count(save.training_slot_level);
    (0..total).find(|slot| !save.training_jobs.iter().any(|job| job.slot == *slot))
}

/// 开始训练：宠物 `pet_id` 从当前阶升一阶。
///
/// 门槛（顺序即玩家看到的报错优先级）：馆已建 → 宠物存在 → 未在训练 → 未达最高阶 →
/// 馆等级够 → 满级 → 金币够 → 材料够 → 有空槽。
pub fn logic_start_training(
    config: &GameConfig,
    save: &mut GameSave,
    pet_id: &str,
    use_universal: bool,
    now: i64,
    today: &str,
) -> Result<String, String> {
    settle_all(config, save, now, today);
    if save.training_hall_level == 0 {
        return Err("#trainingHallLocked".to_string());
    }
    let pet = save
        .pets
        .iter()
        .find(|p| p.id == pet_id)
        .ok_or_else(|| "#petNotFound".to_string())?
        .clone();
    if save.training_jobs.iter().any(|job| job.pet_id == pet_id) {
        return Err("#trainingAlreadyRunning".to_string());
    }
    let (material, need, coins, seconds) = config
        .training_step_for(pet.tier)
        .ok_or_else(|| "#trainingMaxTier".to_string())?;
    // 馆等级 L 解锁「L → L+1 阶」：练 3→4 需要 Lv3。
    if save.training_hall_level < pet.tier {
        return Err(format!("#trainingHallTooLow|need={}", pet.tier));
    }
    if !is_max_level(config, &pet) {
        return Err("#trainingNeedMaxLevel".to_string());
    }
    if save.coins < coins {
        return Err("#notEnoughCoins".to_string());
    }
    let spend = plan_material_spend(config, save, &material, need, use_universal)?;
    let slot =
        first_free_training_slot(config, save).ok_or_else(|| "#trainingNoSlot".to_string())?;

    save.coins -= coins;
    take_material(save, &material, spend.main);
    take_material(save, &config.universal_material.clone(), spend.universal);
    let job_id = new_id("train");
    let tutorial_boost = pet.tier == 1 && !save.training_tutorial_boost_claimed;
    if tutorial_boost {
        save.training_tutorial_boost_claimed = true;
    }
    save.training_jobs.push(TrainingJob {
        id: job_id.clone(),
        pet_id: pet_id.to_string(),
        from_tier: pet.tier,
        slot,
        done_at: now + if tutorial_boost { 10 } else { seconds as i64 },
    });
    Ok(job_id)
}

/// 收取训练成果：宠物阶数 +1，**等级不清零**。
///
/// 等级保留是刻意的——训练的卖点就是「还是这一只」，与融合「消耗双亲、产出 1 级新个体」
/// 形成对照。新阶的 `maxLevel` 更高，所以宠物是从原等级继续往上练，没有回退感。
pub fn logic_collect_training(
    config: &GameConfig,
    save: &mut GameSave,
    job_id: &str,
    now: i64,
    today: &str,
) -> Result<(), String> {
    settle_all(config, save, now, today);
    let index = save
        .training_jobs
        .iter()
        .position(|job| job.id == job_id)
        .ok_or_else(|| "#trainingJobNotFound".to_string())?;
    if save.training_jobs[index].done_at > now {
        return Err("#trainingNotDone".to_string());
    }
    let job = save.training_jobs.remove(index);
    // 宠物在训练期间被放生/融合消耗掉：槽位照常释放，静默丢弃（材料已在开练时扣走）。
    let Some(pet) = save.pets.iter_mut().find(|p| p.id == job.pet_id) else {
        return Ok(());
    };
    pet.tier = pet.tier.saturating_add(1).min(6);
    save.stats.total_tier_ups += 1;
    if pet.tier > save.stats.highest_tier {
        save.stats.highest_tier = pet.tier;
    }
    Ok(())
}

/// 领取工厂关卡奖励（EconomyRework-TrainingHall.md §5.2）。
///
/// **每个自然日、每一关只领一次**：当天冲到第 N 关 = 一次性领到第 1..N 关的全部未领
/// 奖励，同日再冲只补发新突破的关卡。因此一天的产出上限完全由「今日最高关」决定，
/// 重复刷没有任何收益。
///
/// 本命令**与来源无关**——工厂关卡制建成后由工厂直接调用，调试期由 debug 面板调用。
/// 返回本次实际发放的材料明细。
pub fn logic_claim_factory_levels(
    config: &GameConfig,
    save: &mut GameSave,
    max_level: u16,
    now: i64,
    today: &str,
) -> Result<BTreeMap<String, u32>, String> {
    settle_all(config, save, now, today);
    let target = max_level.min(config.factory_max_level);
    let claimed = save.daily.factory_claimed_level;
    if target > save.stats.factory_best_level {
        save.stats.factory_best_level = target;
    }
    if target <= claimed {
        return Ok(BTreeMap::new()); // 今日这些关都领过了
    }
    let mut granted: BTreeMap<String, u32> = BTreeMap::new();
    for level in (claimed + 1)..=target {
        if let Some(material) = config.factory_reward_material(level) {
            *granted.entry(material.clone()).or_insert(0) += 1;
        }
    }
    for (material, count) in &granted {
        give_material(save, material, *count);
    }
    save.daily.factory_claimed_level = target;
    Ok(granted)
}
