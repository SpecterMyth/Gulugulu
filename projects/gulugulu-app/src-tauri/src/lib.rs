mod codex_adapter;
mod window_tracker;

use codex_adapter::{CodexStatus, SharedCodexState};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager};

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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(SharedCodexState::new())
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let always_on_top = CheckMenuItem::with_id(
                app,
                "always_on_top",
                "Always on top",
                true,
                true,
                None::<&str>,
            )?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &hide, &always_on_top, &quit])?;

            let always_on_top_state = Arc::new(Mutex::new(true));
            let always_on_top_for_menu = Arc::clone(&always_on_top_state);

            TrayIconBuilder::new()
                .icon(Image::from_bytes(include_bytes!("../icons/tray-duck.png"))?)
                .tooltip("Gulugulu")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(move |app, event| {
                    if let Some(window) = app.get_webview_window("main") {
                        match event.id().as_ref() {
                            "show" => {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            "hide" => {
                                let _ = window.hide();
                            }
                            "always_on_top" => {
                                if let Ok(mut enabled) = always_on_top_for_menu.lock() {
                                    *enabled = !*enabled;
                                    let _ = window.set_always_on_top(*enabled);
                                }
                            }
                            "quit" => app.exit(0),
                            _ => {}
                        }
                    }
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(true);
            }

            let app_handle = app.handle().clone();
            let state = app.state::<SharedCodexState>().inner().clone();
            state.load_config(app.handle());
            codex_adapter::spawn_codex_watcher(app_handle.clone(), state.clone());
            codex_adapter::spawn_claude_code_watcher(app_handle, state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_codex_status,
            set_codex_home,
            close_pet,
            get_active_window_bounds
        ])
        .run(tauri::generate_context!())
        .expect("error while running Gulugulu");
}
