//! 应用设置（设备/隐私偏好，不进游戏存档、不进 mock）：键盘充能、总在最前、
//! 随机移动、界面语言。**单一真源**持久化到 `app_config_dir/gulugulu-settings.json`。
//!
//! 托盘菜单（tray.rs）与前端设置面板（src/App.tsx）都读写这里，任一处改动都
//! 经 `update()` 落盘并广播 `settings://changed`，两处菜单因此始终一致
//! （用户要求：托盘与设置面板条目同步）。

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

/// 与 `src/types.ts` 的 `AppSettings` 逐字段镜像（camelCase）。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// 键盘充能：全局键盘钩子把打字换成精力（InteractionEconomy §5）。
    #[serde(default = "default_true")]
    pub keyboard_capture: bool,
    /// 桌宠窗口在非后院模式下总在最前。
    #[serde(default = "default_true")]
    pub always_on_top: bool,
    /// 角色在桌面上的随机漫步/移动。
    #[serde(default = "default_true")]
    pub random_movement: bool,
    /// 界面语言（`"zh"` | `"en"`；留字符串以便将来扩展更多语言）。
    #[serde(default = "default_language")]
    pub language: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            keyboard_capture: true,
            always_on_top: true,
            random_movement: true,
            language: default_language(),
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_language() -> String {
    "zh".to_string()
}

fn settings_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("gulugulu-settings.json"))
}

/// 读取设置；文件缺失/损坏时回退默认值（缺字段由 serde default 补齐）。
pub fn load(app: &AppHandle) -> AppSettings {
    settings_path(app)
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn persist(app: &AppHandle, settings: &AppSettings) {
    let Some(path) = settings_path(app) else {
        return;
    };
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(raw) = serde_json::to_string_pretty(settings) {
        let _ = fs::write(path, raw);
    }
}

/// 读改写：应用 `mutate` → 落盘 → 广播 `settings://changed`。返回新快照。
/// 只负责持久化 + 通知；开关的副作用（置顶窗口、装/摘钩、刷新托盘）由各命令处理。
pub fn update(app: &AppHandle, mutate: impl FnOnce(&mut AppSettings)) -> AppSettings {
    let mut settings = load(app);
    mutate(&mut settings);
    persist(app, &settings);
    let _ = app.emit("settings://changed", settings.clone());
    settings
}

fn apply_always_on_top(app: &AppHandle, enabled: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(enabled);
    }
}

// ---------------------------------------------------------------------------
// IPC 命令（前端 bridge 调用；托盘 tray.rs 也直接调用同名函数）
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_settings(app: AppHandle) -> AppSettings {
    load(&app)
}

#[tauri::command]
pub fn set_always_on_top(app: AppHandle, enabled: bool) -> AppSettings {
    let settings = update(&app, |s| s.always_on_top = enabled);
    apply_always_on_top(&app, enabled);
    crate::tray::sync_from_settings(&settings);
    settings
}

#[tauri::command]
pub fn set_random_movement(app: AppHandle, enabled: bool) -> AppSettings {
    let settings = update(&app, |s| s.random_movement = enabled);
    crate::tray::sync_from_settings(&settings);
    settings
}

#[tauri::command]
pub fn set_language(app: AppHandle, language: String) -> AppSettings {
    let settings = update(&app, |s| s.language = language);
    crate::tray::sync_from_settings(&settings);
    settings
}
