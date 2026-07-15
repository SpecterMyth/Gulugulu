use crate::game::*;

/// 能量喂养统一入口（键盘/Token → 精力，InteractionEconomy §3.3/§3.4）：
/// 主宠优先，溢出流向当前精力最低的未满宠（并列按 id 决平，逐只灌满），
/// 全员满管后丢弃。换算余数存进每宠的 key_buffer/token_buffer，不丢精度。
/// 只产精力——绝不触碰 coins/exp（经济不变量，见 logic_click_work）。
pub fn logic_feed_energy(
    config: &GameConfig,
    save: &mut GameSave,
    source: EnergySource,
    amount: u64,
    now: i64,
    today: &str,
) -> EnergyFeedOutcome {
    settle_all(config, save, now, today);
    let mut outcome = EnergyFeedOutcome::default();
    if amount == 0 {
        return outcome;
    }
    let mut units_left = amount;
    while units_left > 0 {
        let target_id = {
            let active_ok = save
                .active_pet_id
                .as_ref()
                .and_then(|id| save.pets.iter().find(|p| &p.id == id))
                .filter(|p| p.stamina < config.stamina_max)
                .map(|p| p.id.clone());
            active_ok.or_else(|| {
                save.pets
                    .iter()
                    .filter(|p| p.stamina < config.stamina_max)
                    .min_by(|a, b| a.stamina.cmp(&b.stamina).then_with(|| a.id.cmp(&b.id)))
                    .map(|p| p.id.clone())
            })
        };
        let Some(target_id) = target_id else {
            outcome.wasted += units_left;
            break;
        };
        let pet = save.pets.iter_mut().find(|p| p.id == target_id).unwrap();
        let rate = match source {
            EnergySource::Keys => config.keys_per_stamina_for(pet.tier),
            EnergySource::Tokens => config.tokens_per_stamina_for(pet.tier),
        }
        .max(1);
        let buffer = match source {
            EnergySource::Keys => &mut pet.key_buffer,
            EnergySource::Tokens => &mut pet.token_buffer,
        };
        let room_points = (config.stamina_max - pet.stamina).max(0) as u64;
        let need_units = room_points.saturating_mul(rate).saturating_sub(*buffer);
        let take = units_left.min(need_units);
        if take == 0 {
            // 理论不可达（room≥1 且 buffer<rate ⇒ need≥1）；防死循环兜底。
            outcome.wasted += units_left;
            break;
        }
        *buffer += take;
        units_left -= take;
        let points = (*buffer / rate) as i64;
        *buffer %= rate;
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
    }
    outcome
}

/// One 60s refresh tick（v1.1）：只做精力结算 + 日期翻转——挂机经验与
/// 挂机产金已随交互经济重构移除，tick 仅负责让挂机时的精力条持续走动。
pub fn logic_tick(config: &GameConfig, save: &mut GameSave, now: i64, today: &str) {
    settle_all(config, save, now, today);
}
