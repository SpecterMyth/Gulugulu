mod cli_spawn;
mod codex_adapter;
mod fusion_gen;
mod fusion_slots;
mod game;
mod game_config;
mod key_watcher;
mod quote_gen;
mod settings;
mod steam;
mod steam_inventory;
mod steam_sync;
mod steam_workshop;
mod tray;
mod window_tracker;

use codex_adapter::{CodexStatus, SharedCodexState};
use game::SharedGameState;
use std::path::PathBuf;
use std::thread;
use std::time::Duration;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, WebviewUrl,
    WebviewWindowBuilder,
};

#[tauri::command]
fn get_codex_status(state: tauri::State<'_, SharedCodexState>) -> CodexStatus {
    state.snapshot()
}

#[tauri::command]
fn set_codex_home(
    app: AppHandle,
    path: String,
    state: tauri::State<'_, SharedCodexState>,
) -> Result<CodexStatus, String> {
    let codex_home = PathBuf::from(path);
    if !codex_home.exists() {
        return Err("Codex home path does not exist.".to_string());
    }

    state.set_codex_home(codex_home);
    state.save_config(&app)?;
    Ok(state.snapshot())
}

#[tauri::command]
fn close_pet(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn get_active_window_bounds() -> Option<window_tracker::WindowBounds> {
    window_tracker::active_window_bounds()
}

/// Resize the game window to a logical size, keeping the horizontal center
/// fixed (GDD §12.6): height grows downward for free (top-left is anchored by
/// set_size), width changes are compensated by shifting x by −Δw/2.
#[tauri::command]
fn resize_game_window(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    let current = window.outer_size().map_err(|error| error.to_string())?;
    let position = window.outer_position().map_err(|error| error.to_string())?;

    let target_physical_width = (width * scale).round() as i32;
    let target_physical_height = (height * scale).round() as i32;
    let delta_w = target_physical_width - current.width as i32;

    // 非后院模式恢复桌宠常态：置顶（按用户偏好）+ 固定尺寸（后院 dock 时反向设置）。
    let _ = window.set_always_on_top(settings::load(&app).always_on_top);
    let _ = window.set_resizable(false);
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|error| error.to_string())?;

    let mut x = position.x - delta_w / 2;
    let mut y = position.y;

    // 宽窗口（后院 760px）居中展开可能超出屏幕，夹回当前显示器可见范围。
    if let Ok(Some(monitor)) = window.current_monitor() {
        let monitor_pos = monitor.position();
        let monitor_size = monitor.size();
        let max_x = monitor_pos.x + monitor_size.width as i32 - target_physical_width;
        let max_y = monitor_pos.y + monitor_size.height as i32 - target_physical_height;
        x = x.min(max_x).max(monitor_pos.x);
        y = y.min(max_y).max(monitor_pos.y);
    }

    if x != position.x || y != position.y {
        window
            .set_position(PhysicalPosition::new(x, y))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// 后院停靠布局：铺满当前显示器工作区宽度，底边贴任务栏上沿。
/// `height` 为期望逻辑高度（会被夹到工作区高度内）。
#[tauri::command]
fn dock_backyard_window(app: AppHandle, height: f64) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    let position = window.outer_position().map_err(|error| error.to_string())?;

    let work = window_tracker::work_area_at(position.x, position.y).or_else(|| {
        window
            .current_monitor()
            .ok()
            .flatten()
            .map(|monitor| window_tracker::WindowBounds {
                x: monitor.position().x,
                y: monitor.position().y,
                width: monitor.size().width as i32,
                height: monitor.size().height as i32,
            })
    });
    let work = work.ok_or_else(|| "no monitor".to_string())?;

    // 后院不置顶：其他应用窗口激活时可以盖在后院之上（主界面模式会恢复置顶）。
    // 在 Rust 侧权威设置，避免前端 window API 受能力配置限制而被静默拒绝。
    let _ = window.set_always_on_top(false);
    let _ = window.set_resizable(true);

    let target_height = ((height * scale).round() as i32).clamp(200, work.height);
    window
        .set_size(PhysicalSize::new(work.width as u32, target_height as u32))
        .map_err(|error| error.to_string())?;
    window
        .set_position(PhysicalPosition::new(
            work.x,
            work.y + work.height - target_height,
        ))
        .map_err(|error| error.to_string())?;
    Ok(())
}

/// 打开 Steam 交易市场（后院交易所建筑入口；后续接入具体物品页）。
#[tauri::command]
fn open_steam_market() -> Result<(), String> {
    tauri_plugin_opener::open_url("https://steamcommunity.com/market/", None::<&str>)
        .map_err(|error| error.to_string())
}

/// 打工特效覆盖层：铺满主窗口所在显示器的透明子窗口（点击穿透、不抢焦点、
/// 不进任务栏），粒子在其中渲染即可满屏飘散——主窗口几何完全不动，杜绝跳闪。
/// 幂等：已存在则只做"对齐当前显示器 + 显示"。必须是 async 命令：同步命令在
/// 主线程执行，创建 webview 窗口会死锁。
#[tauri::command]
async fn ensure_fx_overlay(app: AppHandle) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    let monitor = main
        .current_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "no monitor".to_string())?;

    let window = match app.get_webview_window("fx") {
        Some(window) => window,
        None => {
            let window = WebviewWindowBuilder::new(&app, "fx", WebviewUrl::App("index.html".into()))
                .title("Gulugulu FX")
                .transparent(true)
                .decorations(false)
                .shadow(false)
                .resizable(false)
                .maximizable(false)
                .minimizable(false)
                .skip_taskbar(true)
                .always_on_top(true)
                .focusable(false)
                .focused(false)
                .visible(false)
                .build()
                .map_err(|error| error.to_string())?;
            window
                .set_ignore_cursor_events(true)
                .map_err(|error| error.to_string())?;
            window
        }
    };

    // 每次显示前对齐到主窗口当前所在显示器（多显示器 / 拖到别的屏后跟随）。
    // 此刻覆盖层没有可见内容，改位置尺寸不会被察觉。
    window
        .set_position(PhysicalPosition::new(monitor.position().x, monitor.position().y))
        .map_err(|error| error.to_string())?;
    window
        .set_size(PhysicalSize::new(monitor.size().width, monitor.size().height))
        .map_err(|error| error.to_string())?;
    if !window.is_visible().unwrap_or(false) {
        window.show().map_err(|error| error.to_string())?;
    }
    Ok(())
}

/// 隐藏特效覆盖层（停止连击一段时间后由主窗口调用；webview 保留以便下次秒开）。
#[tauri::command]
async fn hide_fx_overlay(app: AppHandle) {
    if let Some(window) = app.get_webview_window("fx") {
        let _ = window.hide();
    }
}

fn spawn_game_tick(app: AppHandle, state: SharedGameState) {
    thread::spawn(move || {
        let tick_seconds = state.config.tick_seconds.max(1);
        loop {
            thread::sleep(Duration::from_secs(tick_seconds));
            // v1.1：tick 只做精力结算/日期翻转并推送刷新（无任何挂机产出）。
            if let Some(save) = game::run_tick(&app, &state) {
                let _ = app.emit("game://state", save);
            }
        }
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(SharedCodexState::new())
        .manage(game::new_shared_state())
        .manage(fusion_gen::new_state())
        .manage(quote_gen::new_state())
        .manage(steam::new_shared_state())
        .setup(|app| {
            // 托盘菜单（双语 + 与设置面板同步的开关）。见 tray.rs。
            tray::build(app.handle())?;

            let app_handle = app.handle().clone();
            let state = app.state::<SharedCodexState>().inner().clone();
            state.load_config(app.handle());
            codex_adapter::spawn_codex_watcher(app_handle.clone(), state.clone());
            codex_adapter::spawn_claude_code_watcher(app_handle.clone(), state);

            let game_state = app.state::<SharedGameState>().inner().clone();
            spawn_game_tick(app_handle.clone(), game_state.clone());

            // 键盘充能：全局键盘钩子（Windows）+ 250ms/1s 双节拍泵。
            key_watcher::spawn_key_watcher(app_handle.clone(), game_state.clone());

            // AI 融合后台 worker：扫描存档里的挂起融合蛋并调本地 CLI 生成。
            let fusion_state = app.state::<fusion_gen::FusionGenState>().inner().clone();
            fusion_gen::spawn_fusion_worker(app_handle.clone(), game_state.clone(), fusion_state);

            // 动态台词后台生成：连接 Claude/Codex 后预生成一批双语吐槽台词，
            // 落盘 gulugulu-quotes.json 并推 quotes://ready。
            let quote_state = app.state::<quote_gen::QuoteGenState>().inner().clone();
            quote_gen::spawn_quote_worker(app_handle.clone(), quote_state);

            // Steam 集成：init 失败 → unavailable 优雅降级（GitHub 分发版照常跑）。
            let steam_state = app.state::<steam::SharedSteamState>().inner().clone();
            steam::init(app_handle, game_state, steam_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_codex_status,
            set_codex_home,
            close_pet,
            get_active_window_bounds,
            resize_game_window,
            dock_backyard_window,
            open_steam_market,
            ensure_fx_overlay,
            hide_fx_overlay,
            fusion_gen::check_fusion_cli,
            fusion_gen::fuse_pets_ai,
            quote_gen::get_dynamic_quotes,
            quote_gen::regenerate_quotes,
            game::get_game_state,
            game::get_game_config,
            game::click_work,
            game::buy_egg,
            game::place_egg,
            game::collect_hatched,
            game::fuse_pets,
            game::upgrade_hatchery,
            game::upgrade_yard,
            game::upgrade_shop,
            game::release_pet,
            game::set_active_pet,
            game::advance_tutorial,
            game::wander_snack,
            game::debug_add_coins,
            game::debug_hatch_now,
            game::debug_max_pets,
            game::debug_drain_stamina,
            game::debug_feed_keys,
            game::debug_clear_save,
            key_watcher::get_keyboard_capture,
            key_watcher::set_keyboard_capture,
            settings::get_settings,
            settings::set_always_on_top,
            settings::set_random_movement,
            settings::set_language,
            steam::get_steam_status,
            steam::steam_sync_now,
            steam::steam_confirm_rebind,
            steam::debug_steam_generate_items,
            steam::debug_steam_consume_all
        ])
        .run(tauri::generate_context!())
        .expect("error while running Gulugulu");
}
