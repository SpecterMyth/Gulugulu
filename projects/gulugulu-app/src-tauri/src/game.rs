use crate::game_config::{is_test_mode, load_game_config, GameConfig};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

// ---------------------------------------------------------------------------
// Save data (mirrored in src/types.ts — keep both sides in sync)
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PetInstance {
    pub id: String,
    pub species: String,
    pub tier: u8,
    pub level: u32,
    /// Progress within the current level (resets to 0 on level-up).
    pub exp: u64,
    pub stamina: i64,
    pub stamina_updated_at: i64,
    pub exhausted: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EggInstance {
    pub id: String,
    pub species: String,
    pub tier: u8,
    /// Key into config.hatch_seconds: "tutorial", an element name, or "tier2".
    pub hatch_kind: String,
    /// None = in inventory (not incubating).
    pub slot: Option<u8>,
    pub hatch_at: Option<i64>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyCounters {
    pub date: String,
    pub token_exp: u64,
    pub overflow_coins: u64,
    pub pickup_coins: u64,
    pub idle_coins: u64,
    pub click_coins: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSave {
    pub version: u32,
    pub coins: u64,
    pub pets: Vec<PetInstance>,
    pub eggs: Vec<EggInstance>,
    pub hatchery_level: u8,
    pub yard_level: u8,
    pub active_pet_id: Option<String>,
    /// Per-project baseline for token-exp increments (progress ledger experience).
    pub last_seen_project_experience: BTreeMap<String, u64>,
    pub daily: DailyCounters,
    pub tutorial_step: u8,
    pub last_seen_at: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClickWorkResult {
    pub save: GameSave,
    pub coins_gained: u64,
    pub exp_gained: u64,
    pub leveled_up: bool,
    pub became_exhausted: bool,
    /// 0 = full rate, 1 = halved, 2 = quartered by the daily soft cap.
    pub soft_cap_tier: u8,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WanderPickupResult {
    pub save: GameSave,
    pub coins_gained: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleasePetResult {
    pub save: GameSave,
    pub refund: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameConfigPayload {
    pub test_mode: bool,
    pub config: GameConfig,
}

#[derive(Clone, Debug, Default)]
pub struct FeedOutcome {
    pub pet_exp: u64,
    pub coins: u64,
    pub leveled_up: bool,
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

pub struct GameState {
    pub config: GameConfig,
    pub save: Mutex<Option<GameSave>>,
}

pub type SharedGameState = Arc<GameState>;

pub fn new_shared_state() -> SharedGameState {
    Arc::new(GameState {
        config: load_game_config(),
        save: Mutex::new(None),
    })
}

static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn new_id(prefix: &str) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let counter = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{nanos:x}-{counter}")
}

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

fn pseudo_random_in(min: u64, max: u64) -> u64 {
    if max <= min {
        return min;
    }
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos() as u64)
        .unwrap_or(0);
    min + nanos % (max - min + 1)
}

fn ensure_daily(save: &mut GameSave, today: &str) {
    if save.daily.date != today {
        save.daily = DailyCounters {
            date: today.to_string(),
            ..DailyCounters::default()
        };
    }
}

/// Lazy stamina settlement: regen 1 point per `stamina_regen_seconds`, keeping
/// the unconsumed remainder by only advancing the timestamp for whole points.
fn settle_pet(config: &GameConfig, pet: &mut PetInstance, now: i64) {
    let elapsed = now - pet.stamina_updated_at;
    if elapsed > 0 && pet.stamina < config.stamina_max {
        let regen = elapsed / config.stamina_regen_seconds;
        if regen > 0 {
            pet.stamina = (pet.stamina + regen).min(config.stamina_max);
            pet.stamina_updated_at += regen * config.stamina_regen_seconds;
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

fn is_max_level(config: &GameConfig, pet: &PetInstance) -> bool {
    pet.level >= config.max_level_for_tier(pet.tier)
}

/// Apply exp to a pet, leveling up as needed. Returns (applied, leveled_up).
fn gain_exp(config: &GameConfig, pet: &mut PetInstance, amount: u64) -> (u64, bool) {
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
    pub soft_cap_tier: u8,
}

pub fn logic_click_work(
    config: &GameConfig,
    save: &mut GameSave,
    pet_id: &str,
    now: i64,
    today: &str,
) -> Result<ClickOutcome, String> {
    settle_all(config, save, now, today);
    let daily_click_coins = save.daily.click_coins;
    let pet = save
        .pets
        .iter_mut()
        .find(|p| p.id == pet_id)
        .ok_or_else(|| "找不到这只精灵".to_string())?;

    if pet.exhausted || pet.stamina < config.stamina_per_click {
        pet.exhausted = true;
        return Err("exhausted".to_string());
    }

    pet.stamina -= config.stamina_per_click;
    let became_exhausted = pet.stamina < config.stamina_per_click && pet.stamina <= 0;
    if pet.stamina <= 0 {
        pet.stamina = 0;
        pet.exhausted = true;
    }

    let base_coins = config.click_coins(pet.tier, pet.level);
    let (coins, soft_cap_tier) = if daily_click_coins >= config.click_soft_cap2 {
        ((base_coins / 4).max(1), 2u8)
    } else if daily_click_coins >= config.click_soft_cap1 {
        ((base_coins / 2).max(1), 1u8)
    } else {
        (base_coins, 0u8)
    };

    let (exp_applied, leveled_up) = gain_exp(config, pet, config.click_exp);
    save.coins += coins;
    save.daily.click_coins += coins;

    Ok(ClickOutcome {
        coins_gained: coins,
        exp_gained: exp_applied,
        leveled_up,
        became_exhausted,
        soft_cap_tier,
    })
}

fn used_slots(save: &GameSave) -> Vec<u8> {
    save.eggs.iter().filter_map(|egg| egg.slot).collect()
}

fn first_free_slot(config: &GameConfig, save: &GameSave) -> Option<u8> {
    let slot_count = config.hatchery_slot_count(save.hatchery_level);
    let used = used_slots(save);
    (0..slot_count).find(|slot| !used.contains(slot))
}

pub fn logic_buy_egg(
    config: &GameConfig,
    save: &mut GameSave,
    element: &str,
    now: i64,
    today: &str,
) -> Result<String, String> {
    settle_all(config, save, now, today);
    let price = *config
        .egg_prices
        .get(element)
        .ok_or_else(|| "没有这种属性的蛋".to_string())?;
    if save.coins < price {
        return Err("金币不足".to_string());
    }
    let species = config
        .base_species_for_element(element)
        .ok_or_else(|| "没有对应的初始精灵".to_string())?;

    save.coins -= price;
    let slot = first_free_slot(config, save);
    let hatch_at = slot.map(|_| now + *config.hatch_seconds.get(element).unwrap_or(&180) as i64);
    let egg_id = new_id("egg");
    save.eggs.push(EggInstance {
        id: egg_id.clone(),
        species,
        tier: 1,
        hatch_kind: element.to_string(),
        slot,
        hatch_at,
    });
    Ok(egg_id)
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

pub fn logic_collect_hatched(
    config: &GameConfig,
    save: &mut GameSave,
    egg_id: &str,
    now: i64,
    today: &str,
) -> Result<String, String> {
    settle_all(config, save, now, today);
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

    let egg = save.eggs.remove(egg_index);
    let tier = config
        .species
        .get(&egg.species)
        .map(|s| s.tier)
        .unwrap_or(egg.tier);
    let pet_id = new_id("pet");
    save.pets.push(PetInstance {
        id: pet_id.clone(),
        species: egg.species,
        tier,
        level: 1,
        exp: 0,
        stamina: config.stamina_max,
        stamina_updated_at: now,
        exhausted: false,
    });
    if save.active_pet_id.is_none() {
        save.active_pet_id = Some(pet_id.clone());
    }
    Ok(pet_id)
}

pub fn logic_fuse_pets(
    config: &GameConfig,
    save: &mut GameSave,
    id_a: &str,
    id_b: &str,
    now: i64,
    today: &str,
) -> Result<String, String> {
    settle_all(config, save, now, today);
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
    if pet_a.tier != 1 {
        return Err("2 阶融合将在后续版本开放".to_string());
    }
    if !is_max_level(config, &pet_a) || !is_max_level(config, &pet_b) {
        return Err("两只精灵都要满级才能融合".to_string());
    }
    if save.coins < config.fusion_fee {
        return Err("金币不足，融合需要手续费".to_string());
    }

    let element_a = config
        .species
        .get(&pet_a.species)
        .and_then(|s| s.elements.first().cloned())
        .ok_or_else(|| "未知物种".to_string())?;
    let element_b = config
        .species
        .get(&pet_b.species)
        .and_then(|s| s.elements.first().cloned())
        .ok_or_else(|| "未知物种".to_string())?;
    let result_species = config
        .fusion_result(&element_a, &element_b)
        .ok_or_else(|| "融合表缺少这个组合".to_string())?;

    save.coins -= config.fusion_fee;
    save.pets.retain(|p| p.id != id_a && p.id != id_b);
    if let Some(active) = &save.active_pet_id {
        if active == id_a || active == id_b {
            save.active_pet_id = save.pets.first().map(|p| p.id.clone());
        }
    }

    let slot = first_free_slot(config, save);
    let hatch_at = slot.map(|_| now + *config.hatch_seconds.get("tier2").unwrap_or(&1800) as i64);
    let egg_id = new_id("egg");
    save.eggs.push(EggInstance {
        id: egg_id.clone(),
        species: result_species,
        tier: 2,
        hatch_kind: "tier2".to_string(),
        slot,
        hatch_at,
    });
    Ok(egg_id)
}

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
    let pet = save
        .pets
        .iter()
        .find(|p| p.id == pet_id)
        .ok_or_else(|| "找不到这只精灵".to_string())?
        .clone();
    let species = config
        .species
        .get(&pet.species)
        .ok_or_else(|| "未知物种".to_string())?;
    let equivalent = config.equivalent_egg_price(species);
    let refund =
        (equivalent as f64 * config.release_refund_rate).floor() as u64 + config.release_refund_per_level * pet.level as u64;

    save.pets.retain(|p| p.id != pet_id);
    if save.active_pet_id.as_deref() == Some(pet_id) {
        save.active_pet_id = save.pets.first().map(|p| p.id.clone());
    }
    save.coins += refund;
    Ok(refund)
}

pub fn logic_set_active_pet(save: &mut GameSave, pet_id: &str) -> Result<(), String> {
    if !save.pets.iter().any(|p| p.id == pet_id) {
        return Err("找不到这只精灵".to_string());
    }
    save.active_pet_id = Some(pet_id.to_string());
    Ok(())
}

pub fn logic_wander_pickup(config: &GameConfig, save: &mut GameSave, now: i64, today: &str) -> u64 {
    settle_all(config, save, now, today);
    let room = config
        .wander_coin_daily_cap
        .saturating_sub(save.daily.pickup_coins);
    if room == 0 {
        return 0;
    }
    let amount = pseudo_random_in(config.wander_coin_min, config.wander_coin_max).min(room);
    save.coins += amount;
    save.daily.pickup_coins += amount;
    amount
}

// ---------------------------------------------------------------------------
// Debug cheats (exposed through the 调试 panel; dev/testing only)
// ---------------------------------------------------------------------------

/// Grant coins outright.
pub fn logic_add_coins(save: &mut GameSave, amount: u64) {
    save.coins = save.coins.saturating_add(amount);
}

/// Finish every incubating egg's timer so it is collectable right away.
/// Returns how many eggs were completed.
pub fn logic_hatch_now(save: &mut GameSave, now: i64) -> usize {
    let mut count = 0;
    for egg in &mut save.eggs {
        if egg.slot.is_some() {
            egg.hatch_at = Some(now);
            count += 1;
        }
    }
    count
}

/// Push every pet to the max level for its tier and restore it to full form.
/// Returns how many pets were touched.
pub fn logic_max_all_pets(config: &GameConfig, save: &mut GameSave) -> usize {
    for pet in &mut save.pets {
        pet.level = config.max_level_for_tier(pet.tier);
        pet.exp = 0;
        pet.stamina = config.stamina_max;
        pet.exhausted = false;
    }
    save.pets.len()
}

/// Token feed (GDD §3.3): capped per day; targets the active pet, spills to the
/// lowest-progress non-max pet, then converts to coins under the overflow cap.
pub fn logic_feed_from_tokens(
    config: &GameConfig,
    save: &mut GameSave,
    amount: u64,
    now: i64,
    today: &str,
) -> FeedOutcome {
    settle_all(config, save, now, today);
    if amount == 0 {
        return FeedOutcome::default();
    }

    let cap_room = config.token_exp_daily_cap.saturating_sub(save.daily.token_exp);
    let mut exp_budget = amount.min(cap_room);
    let mut overflow = amount - exp_budget;
    let mut outcome = FeedOutcome::default();

    while exp_budget > 0 {
        let target_id = {
            let active_ok = save
                .active_pet_id
                .as_ref()
                .and_then(|id| save.pets.iter().find(|p| &p.id == id))
                .filter(|p| !is_max_level(config, p))
                .map(|p| p.id.clone());
            active_ok.or_else(|| {
                save.pets
                    .iter()
                    .filter(|p| !is_max_level(config, p))
                    .min_by_key(|p| (p.tier, p.level, p.exp))
                    .map(|p| p.id.clone())
            })
        };
        let Some(target_id) = target_id else {
            // Everyone is max level: the rest converts to coins below.
            overflow += exp_budget;
            break;
        };
        let pet = save.pets.iter_mut().find(|p| p.id == target_id).unwrap();
        let (applied, leveled) = gain_exp(config, pet, exp_budget);
        outcome.pet_exp += applied;
        outcome.leveled_up |= leveled;
        save.daily.token_exp += applied;
        exp_budget -= applied;
        if applied == 0 {
            overflow += exp_budget;
            break;
        }
    }

    if overflow > 0 {
        let coin_room = config
            .overflow_coin_daily_cap
            .saturating_sub(save.daily.overflow_coins);
        let coins = overflow.min(coin_room);
        save.coins += coins;
        save.daily.overflow_coins += coins;
        outcome.coins = coins;
    }
    outcome
}

/// One 60s tick of online idle progress (GDD §12.7).
pub fn logic_tick(
    config: &GameConfig,
    save: &mut GameSave,
    tick_index: u64,
    now: i64,
    today: &str,
) {
    settle_all(config, save, now, today);
    let active_id = save.active_pet_id.clone();
    for pet in &mut save.pets {
        let is_active = Some(&pet.id) == active_id.as_ref();
        if is_max_level(config, pet) {
            continue;
        }
        if is_active {
            gain_exp(config, pet, config.main_exp_per_tick);
        } else if config.yard_ticks_per_exp > 0 && tick_index % config.yard_ticks_per_exp == 0 {
            gain_exp(config, pet, 1);
        }
    }
    if config.coin_ticks_per_coin > 0
        && tick_index % config.coin_ticks_per_coin == 0
        && save.daily.idle_coins < config.idle_coin_daily_cap
    {
        save.coins += 1;
        save.daily.idle_coins += 1;
    }
}

pub fn create_initial_save(
    config: &GameConfig,
    historical_experience: u64,
    baseline_projects: BTreeMap<String, u64>,
    now: i64,
    today: &str,
) -> GameSave {
    let bonus = historical_experience.min(config.historical_exp_coin_cap);
    let tutorial_seconds = *config.hatch_seconds.get("tutorial").unwrap_or(&60) as i64;
    GameSave {
        version: 1,
        coins: config.initial_coins + bonus,
        pets: Vec::new(),
        eggs: vec![EggInstance {
            id: new_id("egg"),
            species: "guluduck".to_string(),
            tier: 1,
            hatch_kind: "tutorial".to_string(),
            slot: Some(0),
            hatch_at: Some(now + tutorial_seconds),
        }],
        hatchery_level: 1,
        yard_level: 1,
        active_pet_id: None,
        last_seen_project_experience: baseline_projects,
        daily: DailyCounters {
            date: today.to_string(),
            ..DailyCounters::default()
        },
        tutorial_step: 0,
        last_seen_at: now,
    }
}

// ---------------------------------------------------------------------------
// Persistence + command plumbing
// ---------------------------------------------------------------------------

fn save_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("gulugulu-save.json"))
        .map_err(|error| error.to_string())
}

fn persist(app: &AppHandle, save: &GameSave) -> Result<(), String> {
    let path = save_path(app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    }
    let contents = serde_json::to_string_pretty(save).map_err(|error| error.to_string())?;
    fs::write(path, contents).map_err(|error| error.to_string())
}

fn ensure_loaded<'a>(
    app: &AppHandle,
    config: &GameConfig,
    guard: &'a mut Option<GameSave>,
) -> Result<&'a mut GameSave, String> {
    if guard.is_none() {
        let path = save_path(app)?;
        let loaded = fs::read_to_string(&path)
            .ok()
            .and_then(|contents| serde_json::from_str::<GameSave>(&contents).ok());
        let save = match loaded {
            Some(save) => save,
            None => {
                let (historical, baseline) = crate::codex_adapter::progress_experience_snapshot(app);
                let save = create_initial_save(config, historical, baseline, now_secs(), &today_string());
                persist(app, &save)?;
                save
            }
        };
        *guard = Some(save);
    }
    Ok(guard.as_mut().unwrap())
}

fn with_save<T>(
    app: &AppHandle,
    state: &SharedGameState,
    mutate: impl FnOnce(&GameConfig, &mut GameSave) -> Result<T, String>,
) -> Result<(T, GameSave), String> {
    let mut guard = state
        .save
        .lock()
        .map_err(|_| "game state poisoned".to_string())?;
    let save = ensure_loaded(app, &state.config, &mut guard)?;
    let result = mutate(&state.config, save)?;
    persist(app, save)?;
    Ok((result, save.clone()))
}

/// Token feed entry point called from the codex adapter watcher threads.
/// Returns None when there is no fresh experience for the project.
pub fn feed_from_project_experience(
    app: &AppHandle,
    state: &SharedGameState,
    project_path: &str,
    project_experience: u64,
) -> Option<FeedOutcome> {
    let result = with_save(app, state, |config, save| {
        let last = save
            .last_seen_project_experience
            .get(project_path)
            .copied()
            .unwrap_or(0);
        let diff = project_experience.saturating_sub(last);
        save.last_seen_project_experience
            .insert(project_path.to_string(), project_experience);
        if diff == 0 {
            return Ok(FeedOutcome::default());
        }
        Ok(logic_feed_from_tokens(config, save, diff, now_secs(), &today_string()))
    });
    match result {
        Ok((outcome, _)) if outcome.pet_exp > 0 || outcome.coins > 0 => Some(outcome),
        _ => None,
    }
}

pub fn run_tick(app: &AppHandle, state: &SharedGameState, tick_index: u64) -> Option<GameSave> {
    let result = with_save(app, state, |config, save| {
        logic_tick(config, save, tick_index, now_secs(), &today_string());
        Ok(())
    });
    result.ok().map(|(_, save)| save)
}

// ---------------------------------------------------------------------------
// IPC commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_game_state(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        settle_all(config, save, now_secs(), &today_string());
        Ok(())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn get_game_config(state: tauri::State<'_, SharedGameState>) -> GameConfigPayload {
    GameConfigPayload {
        test_mode: is_test_mode(),
        config: state.config.clone(),
    }
}

#[tauri::command]
pub fn click_work(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    pet_id: String,
) -> Result<ClickWorkResult, String> {
    let (outcome, save) = with_save(&app, state.inner(), |config, save| {
        logic_click_work(config, save, &pet_id, now_secs(), &today_string())
    })?;
    Ok(ClickWorkResult {
        save,
        coins_gained: outcome.coins_gained,
        exp_gained: outcome.exp_gained,
        leveled_up: outcome.leveled_up,
        became_exhausted: outcome.became_exhausted,
        soft_cap_tier: outcome.soft_cap_tier,
    })
}

#[tauri::command]
pub fn buy_egg(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    element: String,
) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        logic_buy_egg(config, save, &element, now_secs(), &today_string())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn place_egg(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    egg_id: String,
    slot: u8,
) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        logic_place_egg(config, save, &egg_id, slot, now_secs(), &today_string())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn collect_hatched(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    egg_id: String,
) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        logic_collect_hatched(config, save, &egg_id, now_secs(), &today_string())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn fuse_pets(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    id_a: String,
    id_b: String,
) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        logic_fuse_pets(config, save, &id_a, &id_b, now_secs(), &today_string())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn upgrade_hatchery(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        logic_upgrade_hatchery(config, save, now_secs(), &today_string())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn upgrade_yard(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        logic_upgrade_yard(config, save, now_secs(), &today_string())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn release_pet(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    pet_id: String,
) -> Result<ReleasePetResult, String> {
    let (refund, save) = with_save(&app, state.inner(), |config, save| {
        logic_release_pet(config, save, &pet_id, now_secs(), &today_string())
    })?;
    Ok(ReleasePetResult { save, refund })
}

#[tauri::command]
pub fn set_active_pet(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    pet_id: String,
) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |_config, save| {
        logic_set_active_pet(save, &pet_id)
    })?;
    Ok(save)
}

#[tauri::command]
pub fn advance_tutorial(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    step: u8,
) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |_config, save| {
        if step > save.tutorial_step {
            save.tutorial_step = step;
        }
        Ok(())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn wander_pickup(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<WanderPickupResult, String> {
    let (coins_gained, save) = with_save(&app, state.inner(), |config, save| {
        Ok(logic_wander_pickup(config, save, now_secs(), &today_string()))
    })?;
    Ok(WanderPickupResult { save, coins_gained })
}

// ---------------------------------------------------------------------------
// Debug commands (调试 panel)
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn debug_add_coins(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    amount: u64,
) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        settle_all(config, save, now_secs(), &today_string());
        logic_add_coins(save, amount);
        Ok(())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn debug_hatch_now(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        settle_all(config, save, now_secs(), &today_string());
        logic_hatch_now(save, now_secs());
        Ok(())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn debug_max_pets(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<GameSave, String> {
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        settle_all(config, save, now_secs(), &today_string());
        logic_max_all_pets(config, save);
        Ok(())
    })?;
    Ok(save)
}

/// Wipe the save back to the first-run initial state (fresh tutorial egg).
#[tauri::command]
pub fn debug_clear_save(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<GameSave, String> {
    let mut guard = state
        .save
        .lock()
        .map_err(|_| "game state poisoned".to_string())?;
    let (historical, baseline) = crate::codex_adapter::progress_experience_snapshot(&app);
    let save = create_initial_save(&state.config, historical, baseline, now_secs(), &today_string());
    persist(&app, &save)?;
    *guard = Some(save.clone());
    Ok(save)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::game_config::GameConfig;

    fn test_config() -> GameConfig {
        serde_json::from_str(include_str!("../../src/game/config.json")).unwrap()
    }

    fn fresh_save(config: &GameConfig) -> GameSave {
        create_initial_save(config, 0, BTreeMap::new(), 1000, "2026-07-07")
    }

    fn add_pet(save: &mut GameSave, config: &GameConfig, species: &str, level: u32) -> String {
        let tier = config.species.get(species).map(|s| s.tier).unwrap_or(1);
        let id = new_id("pet");
        save.pets.push(PetInstance {
            id: id.clone(),
            species: species.to_string(),
            tier,
            level,
            exp: 0,
            stamina: config.stamina_max,
            stamina_updated_at: 1000,
            exhausted: false,
        });
        if save.active_pet_id.is_none() {
            save.active_pet_id = Some(id.clone());
        }
        id
    }

    #[test]
    fn initial_save_has_tutorial_egg_and_bonus_coins() {
        let config = test_config();
        let save = create_initial_save(&config, 500, BTreeMap::new(), 1000, "2026-07-07");
        assert_eq!(save.coins, config.initial_coins + config.historical_exp_coin_cap);
        assert_eq!(save.eggs.len(), 1);
        assert_eq!(save.eggs[0].slot, Some(0));
        assert_eq!(save.eggs[0].hatch_at, Some(1000 + 60));
    }

    #[test]
    fn click_work_pays_and_levels_and_exhausts() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let pet = add_pet(&mut save, &config, "guluduck", 1);

        // First bar: 20 rapid clicks (same instant → no regen); leveling raises
        // payout mid-bar (GDD §9 rhythm: 5×2 + 10×3 + 5×4 = 60 coins, ends at
        // Lv3 with 0 stamina).
        let mut total = 0;
        for _ in 0..20 {
            let outcome = logic_click_work(&config, &mut save, &pet, 1000, "2026-07-07").unwrap();
            total += outcome.coins_gained;
        }
        assert_eq!(total, 60);
        let pet_ref = save.pets.iter().find(|p| p.id == pet).unwrap();
        assert_eq!(pet_ref.level, 3);
        assert_eq!(pet_ref.stamina, 0);
        assert!(pet_ref.exhausted);

        // Exhausted pets reject work.
        let err = logic_click_work(&config, &mut save, &pet, 1030, "2026-07-07").unwrap_err();
        assert_eq!(err, "exhausted");
    }

    #[test]
    fn stamina_regen_and_wake_threshold() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let pet_id = add_pet(&mut save, &config, "guluduck", 1);
        {
            let pet = save.pets.iter_mut().find(|p| p.id == pet_id).unwrap();
            pet.stamina = 0;
            pet.exhausted = true;
            pet.stamina_updated_at = 1000;
        }
        // 59 points × 6s: still asleep (wake at 60).
        settle_all(&config, &mut save, 1000 + 59 * 6, "2026-07-07");
        assert!(save.pets[0].exhausted);
        assert_eq!(save.pets[0].stamina, 59);
        // One more regen point crosses the threshold.
        settle_all(&config, &mut save, 1000 + 60 * 6, "2026-07-07");
        assert!(!save.pets[0].exhausted);
    }

    #[test]
    fn soft_cap_halves_then_quarters() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let pet_id = add_pet(&mut save, &config, "guluduck", 1);
        save.daily.date = "2026-07-07".into();
        save.daily.click_coins = config.click_soft_cap1;
        let outcome = logic_click_work(&config, &mut save, &pet_id, 1001, "2026-07-07").unwrap();
        assert_eq!(outcome.soft_cap_tier, 1);
        save.daily.click_coins = config.click_soft_cap2;
        let outcome = logic_click_work(&config, &mut save, &pet_id, 1002, "2026-07-07").unwrap();
        assert_eq!(outcome.soft_cap_tier, 2);
        assert!(outcome.coins_gained >= 1);
    }

    #[test]
    fn daily_rollover_resets_counters() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.daily.token_exp = 100;
        save.daily.click_coins = 500;
        settle_all(&config, &mut save, 2000, "2026-07-08");
        assert_eq!(save.daily.date, "2026-07-08");
        assert_eq!(save.daily.token_exp, 0);
        assert_eq!(save.daily.click_coins, 0);
    }

    #[test]
    fn buy_egg_slot_then_inventory_and_money_check() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear(); // free the tutorial slot
        save.coins = 200;
        logic_buy_egg(&config, &mut save, "normal", 1000, "2026-07-07").unwrap();
        assert_eq!(save.coins, 120);
        assert_eq!(save.eggs[0].slot, Some(0));
        // Second egg: hatchery Lv1 has one slot → inventory.
        logic_buy_egg(&config, &mut save, "normal", 1000, "2026-07-07").unwrap();
        assert_eq!(save.eggs[1].slot, None);
        assert_eq!(save.eggs[1].hatch_at, None);
        // Not enough money.
        save.coins = 10;
        assert!(logic_buy_egg(&config, &mut save, "normal", 1000, "2026-07-07").is_err());
    }

    #[test]
    fn collect_hatched_respects_time_and_capacity() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let egg_id = save.eggs[0].id.clone();
        // Too early.
        assert!(logic_collect_hatched(&config, &mut save, &egg_id, 1001, "2026-07-07").is_err());
        // Ready.
        let pet_id = logic_collect_hatched(&config, &mut save, &egg_id, 1100, "2026-07-07").unwrap();
        assert_eq!(save.pets.len(), 1);
        assert_eq!(save.active_pet_id, Some(pet_id));
        assert!(save.eggs.is_empty());

        // Fill the yard to capacity, then a hatched egg must stay in its slot.
        while save.pets.len() < config.yard_capacity_for(save.yard_level) as usize {
            add_pet(&mut save, &config, "emberfox", 1);
        }
        save.eggs.push(EggInstance {
            id: "egg-full".into(),
            species: "guluduck".into(),
            tier: 1,
            hatch_kind: "normal".into(),
            slot: Some(0),
            hatch_at: Some(1000),
        });
        let err = logic_collect_hatched(&config, &mut save, "egg-full", 2000, "2026-07-07").unwrap_err();
        assert!(err.contains("后院已满"));
        assert_eq!(save.eggs.len(), 1, "egg keeps occupying the slot");
    }

    #[test]
    fn fusion_rules_and_result() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        save.coins = 1000;
        let max1 = config.max_level_for_tier(1);
        let a = add_pet(&mut save, &config, "emberfox", max1);
        let b = add_pet(&mut save, &config, "frostpeng", max1);

        // Non-max partner rejected.
        let c = add_pet(&mut save, &config, "guluduck", 1);
        assert!(logic_fuse_pets(&config, &mut save, &a, &c, 1000, "2026-07-07").is_err());

        // fire+ice → thermowolf, consumes both, produces a tier-2 egg in slot 0.
        let egg_id = logic_fuse_pets(&config, &mut save, &a, &b, 1000, "2026-07-07").unwrap();
        assert_eq!(save.coins, 1000 - config.fusion_fee);
        assert_eq!(save.pets.len(), 1);
        let egg = save.eggs.iter().find(|e| e.id == egg_id).unwrap();
        assert_eq!(egg.species, "thermowolf");
        assert_eq!(egg.tier, 2);
        assert_eq!(egg.slot, Some(0));
        // Active pet was consumed → falls back to the remaining pet.
        assert_eq!(save.active_pet_id.as_deref(), Some(c.as_str()));
    }

    #[test]
    fn fusing_last_two_pets_is_allowed() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        save.coins = 1000;
        let max1 = config.max_level_for_tier(1);
        let a = add_pet(&mut save, &config, "guluduck", max1);
        let b = add_pet(&mut save, &config, "guluduck", max1);
        logic_fuse_pets(&config, &mut save, &a, &b, 1000, "2026-07-07").unwrap();
        assert!(save.pets.is_empty());
        assert_eq!(save.active_pet_id, None);
        assert_eq!(save.eggs[0].species, "guluswan");
    }

    #[test]
    fn release_refund_matches_gdd_and_protects_last_pet() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let only = add_pet(&mut save, &config, "guluduck", 5);
        assert!(logic_release_pet(&config, &mut save, &only, 1000, "2026-07-07").is_err());

        // Max-level ice pet: ⌊150×0.25⌋ + 10×5 = 37 + 50 = 87 (GDD §8 example).
        let ice = add_pet(&mut save, &config, "frostpeng", 10);
        let coins_before = save.coins;
        let refund = logic_release_pet(&config, &mut save, &ice, 1000, "2026-07-07").unwrap();
        assert_eq!(refund, 87);
        assert_eq!(save.coins, coins_before + 87);

        // Tier-2 equivalent price: normal+normal swan = 80+80+100 = 260 → ⌊65⌋+levels.
        let swan = add_pet(&mut save, &config, "guluswan", 20);
        let refund = logic_release_pet(&config, &mut save, &swan, 1000, "2026-07-07").unwrap();
        assert_eq!(refund, 65 + 20 * 5);
    }

    #[test]
    fn token_feed_caps_overflow_and_retargets() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        let active = add_pet(&mut save, &config, "guluduck", 1);
        let buddy = add_pet(&mut save, &config, "emberfox", 1);
        save.active_pet_id = Some(active.clone());

        // Feed well past the tier-1 requirement (450) and the daily cap (300):
        // 500 in → 300 exp fed (cap), 200 coins (overflow cap).
        let outcome = logic_feed_from_tokens(&config, &mut save, 500, 1000, "2026-07-07");
        assert_eq!(outcome.pet_exp, 300);
        assert_eq!(outcome.coins, config.overflow_coin_daily_cap.min(200));
        assert_eq!(save.daily.token_exp, 300);

        // Next day: active is close to max; remainder flows to the buddy.
        let active_level = save.pets.iter().find(|p| p.id == active).unwrap().level;
        assert!(active_level > 1);
        let outcome = logic_feed_from_tokens(&config, &mut save, 300, 2000, "2026-07-08");
        let active_ref = save.pets.iter().find(|p| p.id == active).unwrap();
        let buddy_ref = save.pets.iter().find(|p| p.id == buddy).unwrap();
        assert_eq!(active_ref.level, config.max_level_for_tier(1));
        assert!(buddy_ref.level > 1 || buddy_ref.exp > 0, "spillover reaches the buddy");
        assert!(outcome.pet_exp > 0);
    }

    #[test]
    fn tick_accrues_idle_exp_and_coins() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.eggs.clear();
        let active = add_pet(&mut save, &config, "guluduck", 1);
        let buddy = add_pet(&mut save, &config, "emberfox", 1);
        save.active_pet_id = Some(active.clone());

        for tick in 1..=10u64 {
            logic_tick(&config, &mut save, tick, 1000 + tick as i64 * 60, "2026-07-07");
        }
        let active_ref = save.pets.iter().find(|p| p.id == active).unwrap();
        let buddy_ref = save.pets.iter().find(|p| p.id == buddy).unwrap();
        // Active: 10 exp (leveled to 2). Buddy: ticks 5 and 10 → 2 exp.
        assert_eq!(active_ref.level, 2);
        assert_eq!(buddy_ref.exp, 2);
        // Idle coin at tick 10 (coin_ticks_per_coin = 10).
        assert_eq!(save.daily.idle_coins, 1);
    }

    #[test]
    fn wander_pickup_respects_daily_cap() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.daily.date = "2026-07-07".into();
        save.daily.pickup_coins = config.wander_coin_daily_cap - 1;
        let gained = logic_wander_pickup(&config, &mut save, 1000, "2026-07-07");
        assert_eq!(gained, 1, "clamped to the remaining daily room");
        let gained = logic_wander_pickup(&config, &mut save, 1001, "2026-07-07");
        assert_eq!(gained, 0);
    }

    #[test]
    fn upgrades_cost_and_cap() {
        let config = test_config();
        let mut save = fresh_save(&config);
        save.coins = 10_000;
        logic_upgrade_hatchery(&config, &mut save, 1000, "2026-07-07").unwrap();
        logic_upgrade_hatchery(&config, &mut save, 1000, "2026-07-07").unwrap();
        assert!(logic_upgrade_hatchery(&config, &mut save, 1000, "2026-07-07").is_err());
        assert_eq!(save.hatchery_level, 3);
        assert_eq!(save.coins, 10_000 - 200 - 800);

        logic_upgrade_yard(&config, &mut save, 1000, "2026-07-07").unwrap();
        logic_upgrade_yard(&config, &mut save, 1000, "2026-07-07").unwrap();
        assert!(logic_upgrade_yard(&config, &mut save, 1000, "2026-07-07").is_err());
        assert_eq!(save.yard_level, 3);
    }

    #[test]
    fn debug_add_coins_grants_and_saturates() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let before = save.coins;
        logic_add_coins(&mut save, 10_000);
        assert_eq!(save.coins, before + 10_000);
        // Never overflows.
        save.coins = u64::MAX - 5;
        logic_add_coins(&mut save, 10_000);
        assert_eq!(save.coins, u64::MAX);
    }

    #[test]
    fn debug_hatch_now_completes_incubating_eggs_only() {
        let config = test_config();
        let mut save = fresh_save(&config);
        // fresh_save seeds one incubating tutorial egg (slot 0, hatch_at 1000+60)…
        assert_eq!(save.eggs[0].slot, Some(0));
        // …plus one inventory egg (no slot) that must stay untouched.
        save.eggs.push(EggInstance {
            id: "egg-inv".into(),
            species: "guluduck".into(),
            tier: 1,
            hatch_kind: "normal".into(),
            slot: None,
            hatch_at: None,
        });
        let count = logic_hatch_now(&mut save, 9999);
        assert_eq!(count, 1, "only the incubating egg is completed");
        assert_eq!(save.eggs[0].hatch_at, Some(9999));
        let inventory = save.eggs.iter().find(|e| e.id == "egg-inv").unwrap();
        assert_eq!(inventory.hatch_at, None, "inventory egg is left alone");
    }

    #[test]
    fn debug_max_pets_levels_and_restores_everyone() {
        let config = test_config();
        let mut save = fresh_save(&config);
        let a = add_pet(&mut save, &config, "guluduck", 1);
        let b = add_pet(&mut save, &config, "emberfox", 3);
        // Drain and exhaust one pet to prove it gets restored.
        {
            let pet = save.pets.iter_mut().find(|p| p.id == a).unwrap();
            pet.stamina = 0;
            pet.exhausted = true;
        }
        let count = logic_max_all_pets(&config, &mut save);
        assert_eq!(count, 2);
        for id in [&a, &b] {
            let pet = save.pets.iter().find(|p| &p.id == id).unwrap();
            assert_eq!(pet.level, config.max_level_for_tier(pet.tier));
            assert_eq!(pet.exp, 0);
            assert_eq!(pet.stamina, config.stamina_max);
            assert!(!pet.exhausted);
        }
    }
}
