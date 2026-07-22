use crate::game::*;

/// 键盘充能入口（敲键盘 → 精力，InteractionEconomy §3.3/§3.4，2026-07-21 机制修订）：
/// **只喂当前陪伴宠**——不再溢出给其他宠；陪伴宠缺席或已满管时按键直接浪费
/// （其余宠物的精力由挂机自然恢复独立覆盖，见 settle_pet）。换算余数存
/// key_buffer，不丢精度。只产精力——绝不触碰 coins（金币只来自点击）。
pub fn logic_feed_keys(
    config: &GameConfig,
    save: &mut GameSave,
    count: u64,
    now: i64,
    today: &str,
) -> EnergyFeedOutcome {
    settle_all(config, save, now, today);
    let mut outcome = EnergyFeedOutcome::default();
    if count == 0 {
        return outcome;
    }
    // 成就：累计键盘充能键数 + 夜猫子（本地时 0–4 点写代码）。
    save.stats.total_keys_charged += count;
    save.daily.keys += count; // 昨日战报：当日键盘充能键数
    if is_night_owl_hour(now) {
        save.stats.night_owl = true;
        save.daily.night_owl = true; // 昨日战报：当日熬夜信号
    }
    let target_id = save
        .active_pet_id
        .as_ref()
        .and_then(|id| save.pets.iter().find(|p| &p.id == id))
        .filter(|p| p.stamina < config.stamina_max)
        .map(|p| p.id.clone());
    let Some(target_id) = target_id else {
        outcome.wasted = count;
        return outcome;
    };
    let pet = save.pets.iter_mut().find(|p| p.id == target_id).unwrap();
    let rate = config.keys_per_stamina_for(pet.tier).max(1);
    let room_points = (config.stamina_max - pet.stamina).max(0) as u64;
    let need_units = room_points.saturating_mul(rate).saturating_sub(pet.key_buffer);
    let take = count.min(need_units);
    outcome.wasted = count - take;
    pet.key_buffer += take;
    let points = (pet.key_buffer / rate) as i64;
    pet.key_buffer %= rate;
    if points > 0 {
        // 不动 stamina_updated_at：自然恢复的余数照常累计，互不重复折算。
        pet.stamina = (pet.stamina + points).min(config.stamina_max);
        if pet.exhausted && pet.stamina >= config.wake_threshold {
            pet.exhausted = false;
            outcome.woke_pet_ids.push(pet.id.clone());
        }
        outcome.stamina_fed += points;
        outcome.per_pet.push(PetStaminaGain {
            pet_id: pet.id.clone(),
            stamina_gained: points,
            stamina_after: pet.stamina,
        });
    }
    outcome
}

/// Token 喂养入口（2026-07-21 机制修订：Token → **经验**，不再回精力）：
/// 编码产出的加权 Token 单位直接折算成经验喂给**当前陪伴宠**——陪伴宠满级或
/// 缺席时整段浪费，绝不溢给其他宠。换算余数存每宠 token_buffer（单位：加权
/// Token），不丢精度。折算率 `tokens_per_exp_for(tier)` 按阶递减，抵消
/// `level_exp_factor` 的 ×10/阶暴涨，把「吃 Token 满级」的单位量从 T1→T6 的
/// 天然 ~11 万× 压回约 1000×（详见 game_config 字段文档）。绝不触碰 coins/stamina。
pub fn logic_feed_tokens(
    config: &GameConfig,
    save: &mut GameSave,
    units: u64,
    now: i64,
    today: &str,
) -> TokenFeedOutcome {
    settle_all(config, save, now, today);
    let mut outcome = TokenFeedOutcome::default();
    if units == 0 {
        return outcome;
    }
    // 成就：累计喂食 Token（计加权喂养单位，口径与精力时代一致）+ 夜猫子。
    save.stats.total_tokens_fed += units;
    if is_night_owl_hour(now) {
        save.stats.night_owl = true;
        save.daily.night_owl = true; // 昨日战报：当日熬夜信号
    }
    let target_id = save
        .active_pet_id
        .as_ref()
        .and_then(|id| save.pets.iter().find(|p| &p.id == id))
        .map(|p| p.id.clone());
    let Some(target_id) = target_id else {
        outcome.wasted = units;
        return outcome;
    };
    let pet = save.pets.iter_mut().find(|p| p.id == target_id).unwrap();
    outcome.pet_id = Some(pet.id.clone());
    if is_max_level(config, pet) {
        // 满级也不给别人（用户 2026-07-21 决策）：整段浪费，缓冲清零，
        // 避免"攒着等下一只"的幽灵账。
        pet.token_buffer = 0;
        outcome.wasted = units;
        outcome.level_after = pet.level;
        return outcome;
    }
    let rate = config.tokens_per_exp_for(pet.tier);
    pet.token_buffer += units;
    let exp_points = pet.token_buffer / rate;
    pet.token_buffer %= rate;
    let mut reached_max = false;
    if exp_points > 0 {
        let (applied, leveled) = gain_exp(config, pet, exp_points);
        outcome.exp_gained = applied;
        outcome.leveled_up = leveled;
        // 撞上满级墙没吃完的部分按浪费记；缓冲同步清零（同上）。
        outcome.wasted = (exp_points - applied).saturating_mul(rate);
        reached_max = is_max_level(config, pet);
        if reached_max {
            pet.token_buffer = 0;
        }
    }
    outcome.level_after = pet.level;
    outcome.exp_after = pet.exp;
    // 成就：Token 喂养也能把陪伴宠喂到满级——「首次满级」旗标与点击路径同置，
    // 否则纯靠写代码养满主宠的玩家永远拿不到该成就（pet 借用在此结束，方可写 stats）。
    if reached_max {
        save.stats.first_maxlevel_done = true;
    }
    outcome
}

/// One 60s refresh tick（v1.1）：只做精力结算 + 日期翻转——挂机经验与
/// 挂机产金已随交互经济重构移除，tick 仅负责让挂机时的精力条持续走动。
pub fn logic_tick(config: &GameConfig, save: &mut GameSave, now: i64, today: &str) {
    settle_all(config, save, now, today);
}
