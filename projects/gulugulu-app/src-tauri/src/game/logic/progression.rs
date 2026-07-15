use crate::game::*;

pub fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub fn today_string() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

// ---------------------------------------------------------------------------
// Pure game logic (unit-tested; no Tauri types)
// ---------------------------------------------------------------------------

pub(crate) fn pseudo_random_in(min: u64, max: u64) -> u64 {
    if max <= min {
        return min;
    }
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos() as u64)
        .unwrap_or(0);
    min + nanos % (max - min + 1)
}

pub(crate) fn ensure_daily(save: &mut GameSave, today: &str) {
    if save.daily.date != today {
        save.daily = DailyCounters {
            date: today.to_string(),
            ..DailyCounters::default()
        };
    }
}

/// Lazy stamina settlement: regen 1 point per tier-scaled interval
/// (`stamina_regen_seconds_for`), keeping the unconsumed remainder by only
/// advancing the timestamp for whole points.
pub(crate) fn settle_pet(config: &GameConfig, pet: &mut PetInstance, now: i64) {
    if pet.stamina_updated_at > now {
        // 时钟回拨防呆：未来锚点会让自然恢复停摆数小时。
        pet.stamina_updated_at = now;
    }
    let regen_seconds = config.stamina_regen_seconds_for(pet.tier);
    let elapsed = now - pet.stamina_updated_at;
    if elapsed > 0 && pet.stamina < config.stamina_max {
        let regen = elapsed / regen_seconds;
        if regen > 0 {
            pet.stamina = (pet.stamina + regen).min(config.stamina_max);
            pet.stamina_updated_at += regen * regen_seconds;
        }
    }
    if pet.stamina >= config.stamina_max {
        pet.stamina_updated_at = now;
    }
    if pet.exhausted && pet.stamina >= config.wake_threshold {
        pet.exhausted = false;
    }
}

pub fn settle_all(config: &GameConfig, save: &mut GameSave, now: i64, today: &str) {
    ensure_daily(save, today);
    for pet in &mut save.pets {
        settle_pet(config, pet, now);
    }
    save.last_seen_at = now;
}

pub(crate) fn is_max_level(config: &GameConfig, pet: &PetInstance) -> bool {
    pet.level >= config.max_level_for_tier(pet.tier)
}

/// 物种资料查询：先查静态目录，再查存档里的 AI 自定义物种。
pub fn species_info<'a>(config: &'a GameConfig, save: &'a GameSave, species: &str) -> Option<&'a SpeciesInfo> {
    config
        .species
        .get(species)
        .or_else(|| save.custom_species.get(species).map(|entry| &entry.info))
}

/// 纳秒 xorshift 的 [0,1) 伪随机（融合掷骰用，避免引入 rand 依赖）。
pub fn pseudo_random_unit() -> f64 {
    let mut x = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0x9E37_79B9_7F4A_7C15);
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    (x % 1_000_000) as f64 / 1_000_000.0
}

/// 纳秒 + 计数器经 splitmix64 扩散的 u64 熵源（蛋池掷点用；同纳秒多次调用不撞）。
pub(crate) fn pseudo_random_u64() -> u64 {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0x9E37_79B9_7F4A_7C15);
    let seq = ID_COUNTER
        .fetch_add(1, Ordering::Relaxed)
        .wrapping_mul(0x9E37_79B9_7F4A_7C15);
    crate::fusion_slots::splitmix64(nanos ^ seq)
}

/// Apply exp to a pet, leveling up as needed. Returns (applied, leveled_up).
pub(crate) fn gain_exp(config: &GameConfig, pet: &mut PetInstance, amount: u64) -> (u64, bool) {
    let max_level = config.max_level_for_tier(pet.tier);
    let mut remaining = amount;
    let mut applied = 0u64;
    let mut leveled = false;
    while remaining > 0 && pet.level < max_level {
        let needed = config.exp_to_next(pet.tier, pet.level);
        let room = needed.saturating_sub(pet.exp);
        let take = remaining.min(room);
        pet.exp += take;
        remaining -= take;
        applied += take;
        if pet.exp >= needed {
            pet.level += 1;
            pet.exp = 0;
            leveled = true;
        }
    }
    if pet.level >= max_level {
        pet.exp = 0;
    }
    (applied, leveled)
}

#[derive(Debug)]
pub struct ClickOutcome {
    pub coins_gained: u64,
    pub exp_gained: u64,
    pub leveled_up: bool,
    pub became_exhausted: bool,
    pub daily_capped: bool,
}

/// 经济不变量（InteractionEconomy §4.4）：exp 与 coins 只在本函数进入游戏，
/// 且必经 dailyClickCap 与精力双重闸门；键盘/Token/挂机/零食只产精力。
pub fn logic_click_work(
    config: &GameConfig,
    save: &mut GameSave,
    pet_id: &str,
    now: i64,
    today: &str,
) -> Result<ClickOutcome, String> {
    settle_all(config, save, now, today);
    let daily_clicks = save.daily.clicks;
    let pet = save
        .pets
        .iter_mut()
        .find(|p| p.id == pet_id)
        .ok_or_else(|| "找不到这只精灵".to_string())?;

    if pet.exhausted || pet.stamina < config.stamina_per_click {
        pet.exhausted = true;
        return Err("exhausted".to_string());
    }

    // 日额度用尽 → 纯抚摸模式：不耗精力、无产出（非错误，前端播爱心特效）。
    if daily_clicks >= config.daily_click_cap {
        return Ok(ClickOutcome {
            coins_gained: 0,
            exp_gained: 0,
            leveled_up: false,
            became_exhausted: false,
            daily_capped: true,
        });
    }

    pet.stamina -= config.stamina_per_click;
    let became_exhausted = pet.stamina <= 0;
    if pet.stamina <= 0 {
        pet.stamina = 0;
        pet.exhausted = true;
    }

    let coins = config.click_coins_for(pet.tier, pet.level);
    let (exp_applied, leveled_up) = gain_exp(config, pet, config.click_exp_for(pet.tier));
    save.coins += coins;
    save.daily.clicks += 1;

    Ok(ClickOutcome {
        coins_gained: coins,
        exp_gained: exp_applied,
        leveled_up,
        became_exhausted,
        daily_capped: false,
    })
}
