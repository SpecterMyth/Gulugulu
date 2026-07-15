use super::*;

pub fn create_initial_save(
    config: &GameConfig,
    historical_experience: u64,
    token_baseline: BTreeMap<String, u64>,
    now: i64,
    today: &str,
) -> GameSave {
    let bonus = historical_experience.min(config.historical_exp_coin_cap);
    let tutorial_seconds = *config.hatch_seconds.get("tutorial").unwrap_or(&60) as i64;
    GameSave {
        version: 5,
        coins: config.initial_coins + bonus,
        pets: Vec::new(),
        eggs: vec![EggInstance {
            id: new_id("egg"),
            species: "guluduck".to_string(),
            tier: 1,
            hatch_kind: "tutorial".to_string(),
            slot: Some(0),
            hatch_at: Some(now + tutorial_seconds),
            pending_fusion: None,
            steam_item_id: None,
            steam_item_def: None,
        }],
        hatchery_level: 1,
        yard_level: 1,
        shop_level: 1,
        active_pet_id: None,
        last_seen_project_tokens: token_baseline,
        last_seen_project_experience: BTreeMap::new(),
        daily: DailyCounters {
            date: today.to_string(),
            ..DailyCounters::default()
        },
        tutorial_step: 0,
        last_seen_at: now,
        custom_species: BTreeMap::new(),
        dex_obtained: BTreeMap::new(),
        recipe_ai_slots: BTreeMap::new(),
        steam_owner_id: None,
        steam_outbox: Vec::new(),
        steam_tombstones: Vec::new(),
    }
}

/// 从 `customSpecies` 补写 `recipeAiSlots`（FusionRecipeSlots §5）：按元素集配方键聚合，
/// 组内按 `createdAt`（并列按 codename）稳定排序 = 生成序，逐个补入尚未注册的槽，每配方
/// 封顶 `MAX_AI_SLOTS`。**只追加不重排**——已注册槽的既有顺序（可能已被 obtained 前缀依赖）
/// 保持不动。单元素/无元素 entry 不入 AI 槽（0 号固定物种由 config `speciesByRecipe` 已知）。
pub(crate) fn backfill_recipe_ai_slots(
    custom: &BTreeMap<String, CustomSpeciesEntry>,
    registry: &mut BTreeMap<String, Vec<String>>,
) {
    let mut by_recipe: BTreeMap<String, Vec<(i64, &str)>> = BTreeMap::new();
    for (codename, entry) in custom {
        let key = crate::fusion_slots::element_set_key(&entry.info.elements);
        if key.split('+').count() < 2 {
            continue; // 单元素/空集不占 AI 阶梯槽
        }
        by_recipe
            .entry(key)
            .or_default()
            .push((entry.created_at, codename.as_str()));
    }
    for (key, mut list) in by_recipe {
        list.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.1.cmp(b.1)));
        let slots = registry.entry(key).or_default();
        for (_, codename) in list {
            if !slots.iter().any(|c| c == codename)
                && slots.len() < crate::fusion_slots::MAX_AI_SLOTS
            {
                slots.push(codename.to_string());
            }
        }
    }
}

/// v2 → v3 迁移（InteractionEconomy §9，2026-07-14 交互经济重构）：
/// 精力刻度从 100 换到 200 且无法从存档判断原配置，一次性回满补偿；
/// Token 账本从 experience 单位换成原始 token 口径，用 progress 快照重播种
/// （不追溯、不重复计数）。返回是否有改动（有则调用方立即落盘）。
pub(crate) fn migrate_save(
    config: &GameConfig,
    save: &mut GameSave,
    token_baseline: &BTreeMap<String, u64>,
    now: i64,
    today: &str,
) -> bool {
    let mut changed = false;
    if save.version < 3 {
        for pet in &mut save.pets {
            pet.stamina = config.stamina_max;
            pet.stamina_updated_at = now;
            pet.exhausted = false;
            pet.key_buffer = 0;
            pet.token_buffer = 0;
        }
        save.daily = DailyCounters {
            date: today.to_string(),
            ..DailyCounters::default()
        };
        save.last_seen_project_tokens = token_baseline.clone();
        save.last_seen_project_experience = BTreeMap::new();
        save.version = 3;
        changed = true;
    }
    // v3 → v4（融合 2.0，FusionRecipeSlots.md §5）：图鉴曾获账本从当前在册宠物
    // 播种（曾获下界，无法追溯已放生历史）。仅在 dex 为空时播种，避免与增量记账
    // 重复计数（幂等）。
    if save.version < 4 {
        if save.dex_obtained.is_empty() {
            for pet in &save.pets {
                *save.dex_obtained.entry(pet.species.clone()).or_insert(0) += 1;
            }
        }
        save.version = 4;
        changed = true;
    }
    // v4 → v5（FusionRecipeSlots §5 补写）：早期 logic_resolve_fusion_egg 漏写 recipeAiSlots，
    // 已生成的 AI 变种既不进图鉴对应格、也不推进前沿。从 customSpecies 按 (配方键, createdAt)
    // 补注册缺失槽（每配方封顶 10）。幂等，不重排已注册槽。
    if save.version < 5 {
        backfill_recipe_ai_slots(&save.custom_species, &mut save.recipe_ai_slots);
        save.version = 5;
        changed = true;
    }
    // 所有版本：时钟回拨防呆（settle_pet 也有同款钳制，这里让存档尽快自愈）。
    for pet in &mut save.pets {
        if pet.stamina_updated_at > now {
            pet.stamina_updated_at = now;
            changed = true;
        }
    }
    changed
}

// ---------------------------------------------------------------------------
// Persistence + command plumbing
// ---------------------------------------------------------------------------

pub(crate) fn save_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("gulugulu-save.json"))
        .map_err(|error| error.to_string())
}

pub(crate) fn persist(app: &AppHandle, save: &GameSave) -> Result<(), String> {
    let path = save_path(app)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    }
    let contents = serde_json::to_string_pretty(save).map_err(|error| error.to_string())?;
    // 原子写（临时文件 + rename）：撕裂存档会毁掉 Steam 绑定/墓碑，
    // 代价远超普通进度丢失（00-decisions.md）。
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, contents).map_err(|error| error.to_string())?;
    fs::rename(&tmp, &path).map_err(|error| error.to_string())
}

pub(crate) fn ensure_loaded<'a>(
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
            Some(mut save) => {
                // 旧版存档只在需要时读一次 progress 快照做账本播种。
                let token_baseline = if save.version < 3 {
                    crate::codex_adapter::progress_snapshot(app).1
                } else {
                    BTreeMap::new()
                };
                if migrate_save(config, &mut save, &token_baseline, now_secs(), &today_string()) {
                    persist(app, &save)?;
                }
                save
            }
            None => {
                let (historical, token_baseline) = crate::codex_adapter::progress_snapshot(app);
                let save = create_initial_save(config, historical, token_baseline, now_secs(), &today_string());
                persist(app, &save)?;
                save
            }
        };
        *guard = Some(save);
    }
    Ok(guard.as_mut().unwrap())
}

pub(crate) fn with_save<T>(
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

/// Token 账本差分（纯逻辑，供 feed_from_project_tokens 与单测共用）：
/// 返回本次原始 token 增量；store 总数小于基线（progress 被删除/重置）时
/// 自愈——重置基线并视为无增量。
pub(crate) fn ledger_token_diff(save: &mut GameSave, project_path: &str, project_total_tokens: u64) -> u64 {
    let last = save
        .last_seen_project_tokens
        .get(project_path)
        .copied()
        .unwrap_or(0);
    save.last_seen_project_tokens
        .insert(project_path.to_string(), project_total_tokens);
    project_total_tokens.saturating_sub(last)
}

/// Token feed entry point called from the codex adapter watcher threads.
/// Ledger-diff on RAW tokens → 精力（InteractionEconomy §9）。
/// Returns None when nothing was fed（无增量或全员满管）。
pub fn feed_from_project_tokens(
    app: &AppHandle,
    state: &SharedGameState,
    project_path: &str,
    project_total_tokens: u64,
) -> Option<EnergyFeedOutcome> {
    let result = with_save(app, state, |config, save| {
        let diff = ledger_token_diff(save, project_path, project_total_tokens);
        if diff == 0 {
            return Ok(EnergyFeedOutcome::default());
        }
        Ok(logic_feed_energy(config, save, EnergySource::Tokens, diff, now_secs(), &today_string()))
    });
    match result {
        Ok((outcome, _)) if outcome.stamina_fed > 0 => Some(outcome),
        _ => None,
    }
}

/// 键盘充能入账（key_watcher 的 1s 节拍调用）。count 为已限速去重的按键数。
/// Returns None when nothing was fed（缓冲未满一点或全员满管——缓冲照常入档）。
pub fn feed_keys(app: &AppHandle, state: &SharedGameState, count: u64) -> Option<EnergyFeedOutcome> {
    if count == 0 {
        return None;
    }
    let result = with_save(app, state, |config, save| {
        Ok(logic_feed_energy(config, save, EnergySource::Keys, count, now_secs(), &today_string()))
    });
    match result {
        Ok((outcome, _)) if outcome.stamina_fed > 0 => Some(outcome),
        _ => None,
    }
}

pub fn run_tick(app: &AppHandle, state: &SharedGameState) -> Option<GameSave> {
    let result = with_save(app, state, |config, save| {
        logic_tick(config, save, now_secs(), &today_string());
        Ok(())
    });
    result.ok().map(|(_, save)| save)
}
