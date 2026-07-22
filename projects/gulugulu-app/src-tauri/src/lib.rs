mod agent_conn;
mod cli_spawn;
mod codex_adapter;
mod fusion_gen;
mod fusion_slots;
mod game;
mod game_config;
mod key_watcher;
mod quote_gen;
mod settings;
mod skins;
mod steam;
mod steam_autostart;
mod steam_cloud;
mod steam_inventory;
mod steam_market;
#[cfg(test)]
mod steam_smoke;
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
fn get_codex_status(
    app: AppHandle,
    state: tauri::State<'_, SharedCodexState>,
) -> CodexStatus {
    let mut status = state.snapshot();
    // 累计 Token 改为全局口径：默认展示所有项目历史累计（all），并附带
    // 1d/1w/1m 时间窗，公告板据此本地切换——不再随「最后被监听的项目」跳变。
    let stats = codex_adapter::token_stats(&app);
    // 兼容字段仍取 raw 总量口径（含 cache_read），四分明细走 token_stats。
    status.total_tokens = stats.all.total;
    status.experience = stats.all.total / 1000;
    status.token_stats = stats;
    status
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
    tauri_plugin_opener::open_url(
        "https://steamcommunity.com/market/search?appid=4956830",
        None::<&str>,
    )
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

    // 建窗与「对齐显示器」解耦：先确保覆盖层存在，定位只是尽力而为。
    // 曾经这里先查 current_monitor()、查不到就 `?` 提前返回——在多显示器 / 副屏
    // 负坐标下 current_monitor() 会偶发返回 None，一次落空就让 fx 窗永远建不出来，
    // 全屏粒子整会话失效（表现为粒子只在主窗内飞、不满屏飘散）。
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
                .map_err(|error| {
                    eprintln!("[fx-overlay] build webview failed: {error}");
                    error.to_string()
                })?;
            window
                .set_ignore_cursor_events(true)
                .map_err(|error| error.to_string())?;
            window
        }
    };

    // 尽力对齐到主窗当前所在显示器：current_monitor → primary_monitor → 首个可用屏。
    // 三者都拿不到才跳过定位（窗口仍会 show，退化为默认几何，总比覆盖层整个缺席强）。
    let monitor = main
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| main.primary_monitor().ok().flatten())
        .or_else(|| {
            main.available_monitors()
                .ok()
                .and_then(|list| list.into_iter().next())
        });
    match monitor {
        Some(monitor) => {
            window
                .set_position(PhysicalPosition::new(monitor.position().x, monitor.position().y))
                .map_err(|error| error.to_string())?;
            window
                .set_size(PhysicalSize::new(monitor.size().width, monitor.size().height))
                .map_err(|error| error.to_string())?;
        }
        None => {
            eprintln!(
                "[fx-overlay] no monitor from current/primary/available; \
                 showing overlay at default geometry"
            );
        }
    }

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

/// 把主窗口摆到当前显示器工作区的右下角（避开任务栏），留出小边距。
/// 启动时调用一次；用户之后可自由拖动。
fn position_bottom_right(window: &tauri::WebviewWindow) {
    const MARGIN: i32 = 12;

    let outer = match window.outer_size() {
        Ok(size) => size,
        Err(_) => return,
    };

    // 优先用工作区（排除任务栏）；取不到时退回整块显示器区域。
    let pos = window.outer_position().ok();
    let work = pos
        .and_then(|p| window_tracker::work_area_at(p.x, p.y))
        .or_else(|| {
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
    let Some(work) = work else { return };

    let x = work.x + work.width - outer.width as i32 - MARGIN;
    let y = work.y + work.height - outer.height as i32 - MARGIN;
    let _ = window.set_position(PhysicalPosition::new(x.max(work.x), y.max(work.y)));
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

/// 单例守卫用的独占锁文件句柄。持有到进程退出（run() 返回）；OS 在进程结束时自动释放
/// 句柄，无陈旧锁问题。crates.io 在本环境不可达 → 不引入 tauri-plugin-single-instance，
/// 改用 OS 独占句柄自守（review 第 6 项）。
fn acquire_single_instance_lock() -> Option<std::fs::File> {
    let path = std::env::temp_dir().join("gulugulu-singleton.lock");
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        // share_mode(0) = 独占打开：第二个进程再 open 会因共享冲突失败 → 判定已有实例在跑。
        std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .share_mode(0)
            .open(&path)
            .ok()
    }
    #[cfg(not(windows))]
    {
        // 非 Windows 无 std 独占锁 API（flock 需 libc/fs2，本环境不可加依赖）→ 此项针对
        // Windows 双开场景，其它平台退化为不守卫（恒 Some）。
        std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .open(&path)
            .ok()
    }
}

pub fn run() {
    // 单例守卫（review 第 6 项）：拿不到独占锁 = 已有实例在跑 → 干净退出，避免双开进程
    // 互相覆盖存档（last-writer-wins → Steam 重复/丢写前意图）。放在建窗口之前，连窗口都不闪。
    let _singleton = match acquire_single_instance_lock() {
        Some(lock) => lock,
        None => {
            eprintln!("Gulugulu: another instance is already running; exiting.");
            return;
        }
    };
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // 开机自动启动（设置面板开关 + 首融引导弹窗）。macOS 用 LaunchAgent；无额外启动参数。
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None::<Vec<&str>>,
        ))
        .manage(SharedCodexState::new())
        .manage(game::new_shared_state())
        .manage(fusion_gen::new_state())
        .manage(quote_gen::new_state())
        .manage(steam::new_shared_state())
        .setup(|app| {
            // 托盘菜单（双语 + 与设置面板同步的开关）。见 tray.rs。
            tray::build(app.handle())?;

            // 默认启动位置：屏幕右下角（贴任务栏工作区右下角，留 12px 边距）。
            if let Some(window) = app.get_webview_window("main") {
                position_bottom_right(&window);
            }

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

            // 已开机自启的用户：确保 Steam 也随开机启动，免得自启时连不上 Steam。
            settings::reconcile_steam_autostart(app.handle());

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
            fusion_gen::missing_species_previews,
            fusion_gen::cache_species_preview,
            agent_conn::check_agent_connections,
            agent_conn::connect_agent,
            agent_conn::disconnect_agent,
            quote_gen::get_dynamic_quotes,
            quote_gen::regenerate_quotes,
            skins::select_species_skin,
            skins::list_skin_uploaders,
            skins::install_species_skin,
            skins::import_skin_from_text,
            skins::get_skin_share_text,
            skins::publish_own_skin,
            game::get_game_state,
            game::get_yesterday_summary,
            game::get_game_config,
            game::click_work,
            game::buy_egg,
            game::place_egg,
            game::poke_egg,
            game::collect_hatched,
            game::fuse_pets,
            game::upgrade_hatchery,
            game::upgrade_yard,
            game::upgrade_shop,
            game::release_pet,
            game::set_active_pet,
            game::advance_tutorial,
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
            settings::set_autostart,
            settings::note_autostart_prompt_shown,
            steam::get_steam_status,
            steam::steam_sync_now,
            steam::steam_cloud_sync_now,
            steam::steam_import_pets,
            steam::steam_confirm_rebind,
            steam_market::steam_market_prices,
            steam::debug_steam_generate_items,
            steam::debug_steam_consume_all,
            steam::debug_steam_delete_all_workshop
        ])
        .build(tauri::generate_context!())
        .expect("error while building Gulugulu")
        .run(|_app_handle, event| {
            // 优雅退出（关窗口 / 托盘退出）时统一树杀在飞的 CLI 生成子进程，
            // 防生成中途退出留下 node.exe 孤儿继续跑、白烧 API 额度（review 第 7 项）。
            if matches!(
                event,
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
            ) {
                cli_spawn::kill_all_live_children();
            }
        });
}
