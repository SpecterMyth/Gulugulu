use super::*;

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
        pet.key_buffer = 0;
        pet.token_buffer = 0;
    }
    save.pets.len()
}
// ---------------------------------------------------------------------------
// Debug commands (调试 panel)
// ---------------------------------------------------------------------------

/// 作弊命令的 release 闸门：资产可交易后，任何本地作弊面都必须从正式版剔除
/// （cfg! 为编译期常量，release 分支被死代码消除）。
pub(crate) fn ensure_debug_build() -> Result<(), String> {
    if cfg!(debug_assertions) {
        Ok(())
    } else {
        Err("仅开发版可用".to_string())
    }
}

#[tauri::command]
pub fn debug_add_coins(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    amount: u64,
) -> Result<GameSave, String> {
    ensure_debug_build()?;
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        settle_all(config, save, now_secs(), &today_string());
        logic_add_coins(save, amount);
        Ok(())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn debug_hatch_now(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<GameSave, String> {
    ensure_debug_build()?;
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        settle_all(config, save, now_secs(), &today_string());
        logic_hatch_now(save, now_secs());
        Ok(())
    })?;
    Ok(save)
}

#[tauri::command]
pub fn debug_max_pets(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<GameSave, String> {
    ensure_debug_build()?;
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        settle_all(config, save, now_secs(), &today_string());
        logic_max_all_pets(config, save);
        Ok(())
    })?;
    Ok(save)
}

/// 调试：把主宠精力放空并置疲惫（验证恢复期/唤醒/键盘充能循环）。
#[tauri::command]
pub fn debug_drain_stamina(app: AppHandle, state: tauri::State<'_, SharedGameState>) -> Result<GameSave, String> {
    ensure_debug_build()?;
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        let now = now_secs();
        settle_all(config, save, now, &today_string());
        let active = save.active_pet_id.clone();
        if let Some(pet) = save.pets.iter_mut().find(|p| Some(&p.id) == active.as_ref()) {
            pet.stamina = 0;
            pet.stamina_updated_at = now;
            pet.exhausted = true;
        }
        Ok(())
    })?;
    Ok(save)
}

/// 调试：模拟一批键盘按键喂养（浏览器预览外的 FX/入账联调）。
#[tauri::command]
pub fn debug_feed_keys(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    count: u64,
) -> Result<GameSave, String> {
    ensure_debug_build()?;
    let (_, save) = with_save(&app, state.inner(), |config, save| {
        Ok(logic_feed_keys(config, save, count, now_secs(), &today_string()))
    })?;
    Ok(save)
}

/// Wipe the save back to the first-run initial state (fresh tutorial egg).
///
/// 清档同时**夺权云存档**：新档修订号取 `prev+1`（单调压过上次本地）并置 `cloud_force_push`，
/// 连线时立即用清空档覆盖云端 —— 杜绝「清完档又被高修订号的旧云档拉回」（SteamCloudSync.md 4b）。
#[tauri::command]
pub fn debug_clear_save(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    steam_state: tauri::State<'_, crate::steam::SharedSteamState>,
) -> Result<GameSave, String> {
    ensure_debug_build()?;
    let mut guard = state
        .save
        .lock()
        .map_err(|_| "game state poisoned".to_string())?;
    // 清档前记住上次修订号，新档取其 +1（同谱系单调，且在单机场景压过云端）。
    let prev_revision = guard.as_ref().map(|s| s.cloud_revision).unwrap_or(0);
    let (historical, token_baseline) = crate::codex_adapter::progress_snapshot(&app);
    let mut save =
        create_initial_save(&state.config, historical, token_baseline, now_secs(), &today_string());
    save.cloud_revision = prev_revision.saturating_add(1);
    save.cloud_force_push = true; // 连线拉阶段据此强制 PushLocal（跳过采纳），多机也不被旧云覆盖。
    persist(&app, &save)?;
    *guard = Some(save.clone());
    drop(guard); // 释放存档锁后再 kick 泵线程。
    // 已连线则立即用清空档覆盖云端三件套；未连线由夺权标记 + 抬高的修订号在下次连线兜底。
    steam_state.cloud_push_now();
    Ok(save)
}

