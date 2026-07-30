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
use tauri_plugin_autostart::ManagerExt;

/// 「开机自启」引导弹窗的最多展示次数（首融/二融/三融后各一次，之后永不再弹）。
pub const AUTOSTART_PROMPT_MAX: u32 = 3;

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
    /// 开机自动启动（默认关闭）。真源是操作系统注册项（HKCU Run / LaunchAgent /
    /// .desktop，经 tauri-plugin-autostart）；此字段仅为镜像，`get_settings` 读取时
    /// 与实际注册态对账，`set_autostart` 写入后回填实际态。
    #[serde(default)]
    pub autostart: bool,
    /// 「融合成功领取新宠 → 引导开机自启」弹窗已展示次数（0..=AUTOSTART_PROMPT_MAX）。
    /// 用户加入自启后不再弹；无论如何到上限后永不再弹。
    #[serde(default)]
    pub autostart_prompt_count: u32,
    /// AI 融合首选 Agent（`"claude"` | `"codex"`）。融合生成时优先用它（不可用再回退另一个）。
    /// 默认 claude（配 opus = 最强，形象质量最好）。
    #[serde(default = "default_agent")]
    pub default_agent: String,
    /// AI 融合首选模型（首选 Agent 下的模型别名，如 claude 的 `opus`/`sonnet`/`haiku`）。
    /// 空串 = 用该 Agent 的 CLI 默认模型。默认 `opus`。
    #[serde(default = "default_model")]
    pub default_model: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            keyboard_capture: true,
            always_on_top: true,
            random_movement: true,
            language: default_language(),
            autostart: false,
            autostart_prompt_count: 0,
            default_agent: default_agent(),
            default_model: default_model(),
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_language() -> String {
    "en".to_string()
}

fn default_agent() -> String {
    "claude".to_string()
}

fn default_model() -> String {
    "opus".to_string()
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

/// 操作系统当前是否已注册开机自启（真源）。插件未就绪/查询失败时返回 None。
fn os_autostart_enabled(app: &AppHandle) -> Option<bool> {
    app.autolaunch().is_enabled().ok()
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> AppSettings {
    let mut settings = load(&app);
    // 开机自启真源在操作系统：与实际注册态对账，让开关如实反映（外部改动 / 上次写入
    // 失败也不飘）。查不到时保留存档镜像值。
    if let Some(enabled) = os_autostart_enabled(&app) {
        settings.autostart = enabled;
    }
    settings
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> AppSettings {
    let manager = app.autolaunch();
    // dev 调试版（`tauri dev`）的前端从 devUrl（http://localhost:5173）加载，脱离 Vite dev
    // server 无法独立启动。开机自启是直接拉起这个裸 exe、并不会先跑 Vite，于是 boot 时
    // WebView 卡在「localhost 拒绝连接」（用户实测的坏 boot）。故 dev 构建一律**拒绝登记**，
    // 并顺手清掉历史 dev 构建可能留下的坏自启项（含 Steam 伴随项）以自愈。真正支持开机自启的
    // 是安装版（`tauri build`，前端已打包、走自定义协议、不依赖 localhost）。`is_dev()` 精确
    // 对应「从 devUrl 供给」，故 `tauri build --debug` 这类打包调试版仍可正常登记。
    if enabled && tauri::is_dev() {
        eprintln!(
            "[autostart] 跳过登记：dev 调试版需要 Vite dev server 才能显示界面，开机自启会白屏；\
             请用安装版（tauri build）开自启。"
        );
        // 注意这里**不主动 disable**：既有登记可能是安装版写下的合法登记，而 auto-launch 的
        // is_enabled/disable 只认值名、不认路径，无条件 disable 会把它误删。清掉 dev 版自己
        // 留下的坏登记交给 reconcile_autostart（带路径比对）。
        let actual = os_autostart_enabled(&app).unwrap_or(false);
        return update(&app, |s| s.autostart = actual);
    }
    // 先落实操作系统注册（真源）；失败仅记录，随后按**实际**注册态回填存档，
    // 让开关回弹到真实状态而非用户期望态。
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    if let Err(error) = result {
        eprintln!(
            "[autostart] {} failed: {error}",
            if enabled { "enable" } else { "disable" }
        );
    }
    let actual = os_autostart_enabled(&app).unwrap_or(enabled);
    // 随 app 开机自启一起，确保 Steam 也开机自启（否则 app 自启时 Steam 未运行，
    // Steam 集成只能先进本地降级模式再等后台重连）。仅 Windows 生效；Steam 集成关闭
    // 或未装 Steam 时静默跳过。用**实际**注册态驱动：app 自启没落地就不动 Steam。
    crate::steam_autostart::sync(actual && crate::steam::integration_enabled());
    update(&app, |s| s.autostart = actual)
}

/// 从 Run 值的命令行里剥出可执行文件路径，与 `current` 比对（Windows 路径大小写不敏感）。
/// 命令行可能是 `"C:\a b\app.exe" --flag`（带引号）或 `C:\a\app.exe`（裸路径，auto-launch
/// 无参数时还会留个尾随空格）。抽成纯函数便于单测。
#[cfg(windows)]
fn same_exe(registered_command: &str, current: &std::path::Path) -> bool {
    let norm = |p: &str| p.trim().replace('/', "\\").to_lowercase();
    let cur = norm(&current.to_string_lossy());
    let raw = registered_command.trim();
    if let Some(rest) = raw.strip_prefix('"') {
        // 带引号：引号内就是完整路径（路径含空格时必须走这条）。
        return norm(rest.split('"').next().unwrap_or_default()) == cur;
    }
    // 裸路径：先整串比（裸路径含空格也常见），再退到「第一个 token」应对尾随参数。
    norm(raw) == cur || raw.split_whitespace().next().map(norm) == Some(cur)
}

/// 开机自启登记项当前指向的目标，是否就是**本进程的 exe**。
///
/// 必要性：`auto-launch` 的 `is_enabled()` / `disable()` 只看 Run 值名（= plugin 用的
/// `package_info().name`）在不在，**完全不比对路径**。开发者若既装了正式版（自启开着、登记
/// 指向安装目录的 exe），又从源码跑 dev 版，dev 版一旦无条件注销就会误删正式版那条合法登记。
/// 所以凡是「dev 版要动这条登记」，都必须先确认它指的就是当前这个 dev exe。
///
/// `None` = 无法判断（非 Windows / 读注册表失败 / 取不到 current_exe）→ 调用方**保守放弃**。
#[cfg(windows)]
fn autostart_target_is_current_exe(app: &AppHandle) -> Option<bool> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
    use winreg::RegKey;
    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    // 值名必须与 tauri-plugin-autostart 一致：它默认用 `package_info().name`。
    let name = app.package_info().name.clone();
    let registered: String = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(RUN_KEY, KEY_READ)
        .ok()?
        .get_value(&name)
        .ok()?;
    Some(same_exe(&registered, &std::env::current_exe().ok()?))
}

#[cfg(not(windows))]
fn autostart_target_is_current_exe(_app: &AppHandle) -> Option<bool> {
    None
}

/// 启动时对账开机自启。在 `lib.rs` 的 setup() 里调一次；幂等。
///
/// 1. **dev 自愈**：`tauri dev` 构建的前端从 devUrl（localhost:5173）加载，而开机自启是直接
///    拉起裸 exe、不会先跑 Vite，于是 boot 后必然卡在「localhost 拒绝连接」。`set_autostart`
///    的守卫只挡**新**登记，挡不住**已存在**的坏登记——历史 dev 构建写下的那条会一直存活、
///    每次开机复现（用户实测：删掉后从引导弹窗又点了一次「加入自启」就又坏了）。故 dev 构建
///    发现「开机自启登记指向的正是自己」时，就地注销并清掉 Steam 伴随项。
///    指向别的 exe（多半是安装版）或判不出来时**一律不动**，免得误删正式版的合法登记。
/// 2. 否则走原有 Steam 伴随项对账：已开 app 自启（且 Steam 集成开启）→ 确保 Steam 也登记
///    开机自启。覆盖本功能上线前就已开自启的老用户（无需重新开关一次）。
pub fn reconcile_autostart(app: &AppHandle) {
    let registered = os_autostart_enabled(app).unwrap_or(false);
    if registered && tauri::is_dev() {
        match autostart_target_is_current_exe(app) {
            Some(true) => {
                eprintln!(
                    "[autostart] 自愈：开机自启登记指向的正是当前 dev 调试版 exe，已注销。dev 版\
                     需 Vite dev server 才能显示界面，开机自启会白屏；要开机自启请用安装版。"
                );
                let _ = app.autolaunch().disable();
                crate::steam_autostart::sync(false);
                let _ = update(app, |s| s.autostart = false);
                return;
            }
            Some(false) => eprintln!(
                "[autostart] 开机自启登记指向的不是当前 dev exe（多半是安装版），保持原样不动。"
            ),
            None => eprintln!("[autostart] 判不出开机自启登记指向哪个 exe，保守起见不动它。"),
        }
    }
    crate::steam_autostart::sync(registered && crate::steam::integration_enabled());
}

/// 「开机自启」引导弹窗展示一次后调用：计数 +1（封顶 AUTOSTART_PROMPT_MAX），
/// 顺带对账当前自启态。前端据 `autostart_prompt_count` 与 `autostart` 决定是否再弹。
#[tauri::command]
pub fn note_autostart_prompt_shown(app: AppHandle) -> AppSettings {
    let actual = os_autostart_enabled(&app);
    update(&app, |s| {
        if let Some(enabled) = actual {
            s.autostart = enabled;
        }
        s.autostart_prompt_count = (s.autostart_prompt_count + 1).min(AUTOSTART_PROMPT_MAX);
    })
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

#[cfg(all(test, windows))]
mod tests {
    use super::same_exe;
    use std::path::Path;

    const DEV: &str = r"D:\repo\projects\gulugulu-app\src-tauri\target\debug\gulugulu.exe";
    const INSTALLED: &str = r"C:\Program Files\Gulugulu\Gulugulu.exe";

    #[test]
    fn matches_bare_path_with_trailing_space() {
        // auto-launch 无参数时写的就是这个形状（实测注册表值带尾随空格）。
        assert!(same_exe(&format!("{DEV} "), Path::new(DEV)));
    }

    #[test]
    fn matches_quoted_path_and_ignores_args() {
        assert!(same_exe(&format!("\"{DEV}\" --flag"), Path::new(DEV)));
        assert!(same_exe(&format!("{DEV} --flag"), Path::new(DEV)));
    }

    #[test]
    fn matches_case_insensitively_and_across_separators() {
        assert!(same_exe(&DEV.to_uppercase(), Path::new(DEV)));
        assert!(same_exe(&DEV.replace('\\', "/"), Path::new(DEV)));
    }

    #[test]
    fn quoted_path_containing_spaces_is_not_split() {
        let spaced = r"C:\Program Files\Gulugulu\Gulugulu.exe";
        assert!(same_exe(&format!("\"{spaced}\""), Path::new(spaced)));
    }

    /// 关键回归：dev 版**不得**认领安装版写下的登记，否则自愈会误删正式版自启。
    #[test]
    fn installed_build_entry_is_not_claimed_by_dev_exe() {
        assert!(!same_exe(&format!("\"{INSTALLED}\""), Path::new(DEV)));
        assert!(!same_exe(&format!("{INSTALLED} "), Path::new(DEV)));
    }
}

/// AI 融合首选 Agent（`"claude"` | `"codex"`）。非法值回落 `"claude"`。
#[tauri::command]
pub fn set_default_agent(app: AppHandle, agent: String) -> AppSettings {
    let normalized = if agent == "codex" { "codex" } else { "claude" }.to_string();
    update(&app, |s| s.default_agent = normalized)
}

/// AI 融合首选模型（首选 Agent 下的模型别名；空串 = CLI 默认模型）。
#[tauri::command]
pub fn set_default_model(app: AppHandle, model: String) -> AppSettings {
    let trimmed = model.trim().to_string();
    update(&app, |s| s.default_model = trimmed)
}
