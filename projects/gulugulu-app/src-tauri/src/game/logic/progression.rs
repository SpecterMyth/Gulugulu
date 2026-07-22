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

/// 从 Unix 秒取**本机本地时区**的小时（0–23）。夜猫子成就用（非 UTC）。
pub(crate) fn local_hour(now: i64) -> u32 {
    use chrono::{Local, TimeZone, Timelike};
    Local
        .timestamp_opt(now, 0)
        .single()
        .map(|dt| dt.hour())
        .unwrap_or(12)
}

/// 是否处于"夜猫子"时段（本地时 0:00–3:59）。
pub(crate) fn is_night_owl_hour(now: i64) -> bool {
    local_hour(now) < 4
}

/// today 是否是 prev 的次日（连续登录判定；解析失败/非次日 → false）。
fn is_next_day(prev: &str, today: &str) -> bool {
    use chrono::NaiveDate;
    if let (Ok(p), Ok(t)) = (
        NaiveDate::parse_from_str(prev, "%Y-%m-%d"),
        NaiveDate::parse_from_str(today, "%Y-%m-%d"),
    ) {
        if let Some(next) = p.succ_opt() {
            return t == next;
        }
    }
    false
}

/// 登录节律记账（每本地日一次，自守卫）：days_played +1；与上次登录连续则 streak +1，
/// 否则归 1。由 `ensure_daily` 无条件调用（内部按 last_login_date 去重）。
pub(crate) fn update_login_stats(stats: &mut LifetimeStats, today: &str) {
    if stats.last_login_date == today {
        return;
    }
    if is_next_day(&stats.last_login_date, today) {
        stats.login_streak += 1;
    } else {
        stats.login_streak = 1;
    }
    stats.days_played += 1;
    stats.last_login_date = today.to_string();
}

// ---------------------------------------------------------------------------
// Pure game logic (unit-tested; no Tauri types)
// ---------------------------------------------------------------------------

pub(crate) fn ensure_daily(save: &mut GameSave, today: &str) {
    // 成就：登录节律记账（每本地日一次，含新档首日；在 daily 重置前后皆可，自去重）。
    update_login_stats(&mut save.stats, today);
    if save.daily.date != today {
        // 昨日战报：翻日时把刚结束那天的计数归档到 last_day_digest 再清零。
        // 空日期（新档默认 daily.date=""）不归档，避免弹出一张全零的假战报。
        if !save.daily.date.is_empty() {
            save.last_day_digest = Some(digest_from_daily(&save.daily));
        }
        save.daily = DailyCounters {
            date: today.to_string(),
            ..DailyCounters::default()
        };
    }
}

/// 把一天的 `DailyCounters` 折算成归档战报（map 类计数求和为标量）。
fn digest_from_daily(daily: &DailyCounters) -> DailyDigest {
    let sum = |m: &BTreeMap<String, u32>| m.values().map(|&v| v as u64).sum();
    DailyDigest {
        date: daily.date.clone(),
        day_index: day_index_of(&daily.date),
        clicks: daily.clicks,
        keys: daily.keys,
        hatches: daily.hatches,
        fusions: sum(&daily.fusion_mints),
        eggs_minted: sum(&daily.egg_mints),
        eggs_collected: sum(&daily.egg_collects),
        coins_earned: daily.coins_earned,
        releases: daily.releases,
        night_owl: daily.night_owl,
    }
}

/// 本地日期串（YYYY-MM-DD）→ 与 codex_adapter 每日桶一致的天序号（自 1970-01-01）。
/// 与 `current_day_index()` 同口径（都取本地日期）；解析失败回落 0。
pub(crate) fn day_index_of(date: &str) -> u64 {
    use chrono::NaiveDate;
    NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .ok()
        .and_then(|d| {
            NaiveDate::from_ymd_opt(1970, 1, 1)
                .map(|epoch| d.signed_duration_since(epoch).num_days().max(0) as u64)
        })
        .unwrap_or(0)
}

/// 天序号 → 本地日期串（`day_index_of` 的逆；越界回落今天）。
pub(crate) fn date_string_of_day_index(day_index: u64) -> String {
    use chrono::{Duration, NaiveDate};
    NaiveDate::from_ymd_opt(1970, 1, 1)
        .and_then(|epoch| epoch.checked_add_signed(Duration::days(day_index as i64)))
        .map(|d| d.format("%Y-%m-%d").to_string())
        .unwrap_or_else(today_string)
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
/// 且必经 dailyClickCap 与精力双重闸门。金币只在本函数进入游戏；经验另有
/// Token 喂养一条支流（logic_feed_tokens，只喂陪伴宠、不产金币）；键盘/挂机
/// 只产精力（2026-07-21 机制修订）。
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
        .ok_or_else(|| "#petNotFound".to_string())?;

    // "exhausted" 是控制流哨兵（前端 .includes("exhausted") 拦截后播动画，不上屏）——
    // 不走 "#key" 协议，保持原样。
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
    let reached_max = is_max_level(config, pet); // 捕获后 pet 借用结束，方可写 save.stats
    save.coins += coins;
    save.daily.clicks += 1;
    save.daily.coins_earned += coins; // 昨日战报：当日点击金币收入

    // —— 成就终身统计（SteamAchievements.md §3.3；只增，不触碰 Steam/锁）——
    save.stats.total_clicks += 1;
    save.stats.total_coins_earned += coins;
    if reached_max {
        save.stats.first_maxlevel_done = true;
    }
    if save.daily.clicks >= config.daily_click_cap {
        save.stats.daily_cap_reached_ever = true;
    }
    if is_night_owl_hour(now) {
        save.stats.night_owl = true;
        save.daily.night_owl = true; // 昨日战报：当日熬夜信号
    }

    Ok(ClickOutcome {
        coins_gained: coins,
        exp_gained: exp_applied,
        leveled_up,
        became_exhausted,
        daily_capped: false,
    })
}
