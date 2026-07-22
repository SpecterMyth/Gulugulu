//! 开机自启的 Steam 伴随项（仅 Windows）：随「开机自启」开关一起，确保 Steam 也在
//! 开机时启动。否则 app 随系统自启时 Steam 尚未运行，`init_app(4956830)` 失败，
//! Steam 集成只能先进本地降级模式再等后台重连（用户反馈的 `init_app failed` 截图）。
//!
//! 设计（**非破坏、可逆**）：
//! - 只管理**我们自己的** `HKCU\...\Run` 值 `GuluguluSteamAutostart`，绝不改动
//!   Steam 自身的 `Steam` 启动项——用户若单独勾过 Steam 的「开机运行」，关掉 app
//!   自启也不会误删它。
//! - 开启：Steam 已安装、且 Steam 自身未登记开机启动时，写
//!   `GuluguluSteamAutostart = "<steamExe>" -silent`（`-silent` = 静默进系统托盘，
//!   不弹主窗/登录窗）。Steam 自身已登记则跳过（免重复；boot 时即便双启也会被
//!   Steam 单例吞掉，无害）。
//! - 关闭：删除我们的值（若在）。
//! - 非 Windows：全部空操作（macOS/Linux 的 Steam 自启机制不同，暂不介入）。

/// 随「开机自启」开关一起，确保 Steam 也开机自启（仅 Windows 生效；其它平台空操作）。
/// `enabled` 应传**实际**的 app 自启态（& Steam 集成开启），而非用户期望态。
#[cfg(windows)]
pub fn sync(enabled: bool) {
    if enabled {
        win::enable();
    } else {
        win::disable();
    }
}

#[cfg(not(windows))]
pub fn sync(_enabled: bool) {}

#[cfg(windows)]
mod win {
    use std::path::{Path, PathBuf};
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_SET_VALUE};
    use winreg::RegKey;

    /// 当前用户的开机启动项子键。
    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    /// 我们登记的值名（仅本 app 管理，绝不碰 Steam 自己的 `Steam` 值）。
    const OUR_VALUE: &str = "GuluguluSteamAutostart";
    /// Steam 自身「开机运行」勾选写入的值名。
    const STEAM_VALUE: &str = "Steam";

    /// Steam 静默启动命令行：`"<exe>" -silent`。抽成纯函数便于单测。
    fn run_command(exe: &Path) -> String {
        format!("\"{}\" -silent", exe.display())
    }

    /// 定位 steam.exe：优先 `HKCU\Software\Valve\Steam\SteamExe`（Steam 运行时写入，
    /// 正斜杠路径），退而求 `SteamPath\steam.exe`，再退
    /// `HKLM\SOFTWARE\WOW6432Node\Valve\Steam\InstallPath\steam.exe`。
    /// 全部查不到或文件不存在 → None（未装 Steam / GitHub 版用户，静默跳过）。
    fn steam_exe_path() -> Option<PathBuf> {
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(steam) = hkcu.open_subkey(r"Software\Valve\Steam") {
            if let Ok(exe) = steam.get_value::<String, _>("SteamExe") {
                let path = PathBuf::from(exe.replace('/', "\\"));
                if path.is_file() {
                    return Some(path);
                }
            }
            if let Ok(dir) = steam.get_value::<String, _>("SteamPath") {
                let path = PathBuf::from(dir.replace('/', "\\")).join("steam.exe");
                if path.is_file() {
                    return Some(path);
                }
            }
        }
        if let Ok(steam) = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(r"SOFTWARE\WOW6432Node\Valve\Steam")
        {
            if let Ok(dir) = steam.get_value::<String, _>("InstallPath") {
                let path = PathBuf::from(dir).join("steam.exe");
                if path.is_file() {
                    return Some(path);
                }
            }
        }
        None
    }

    /// Steam 是否已在 Run 里登记开机启动（`Steam` 值存在即为是）。
    fn steam_own_autostart_present() -> bool {
        RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(RUN_KEY)
            .and_then(|run| run.get_value::<String, _>(STEAM_VALUE))
            .is_ok()
    }

    /// 删除我们的开机启动值；Run 键或值不存在都视作已完成（幂等）。
    fn remove_our_entry() -> std::io::Result<()> {
        let run = match RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey_with_flags(RUN_KEY, KEY_SET_VALUE)
        {
            Ok(run) => run,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(error) => return Err(error),
        };
        match run.delete_value(OUR_VALUE) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error),
        }
    }

    pub(super) fn enable() {
        // Steam 自己已登记开机启动 → 无需我们插手（顺手清掉我们旧值，避免 boot 双启）。
        if steam_own_autostart_present() {
            let _ = remove_our_entry();
            return;
        }
        let Some(exe) = steam_exe_path() else {
            eprintln!("[autostart] Steam 未安装或定位不到 steam.exe，跳过 Steam 开机自启伴随");
            return;
        };
        let command = run_command(&exe);
        let written = RegKey::predef(HKEY_CURRENT_USER)
            .create_subkey(RUN_KEY)
            .and_then(|(run, _)| run.set_value(OUR_VALUE, &command));
        match written {
            Ok(()) => eprintln!("[autostart] 已登记 Steam 开机自启: {command}"),
            Err(error) => eprintln!("[autostart] 写 Steam 开机自启项失败: {error}"),
        }
    }

    pub(super) fn disable() {
        if let Err(error) = remove_our_entry() {
            eprintln!("[autostart] 移除 Steam 开机自启项失败: {error}");
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn run_command_quotes_path_and_appends_silent() {
            let cmd = run_command(Path::new(r"C:\Program Files (x86)\Steam\steam.exe"));
            assert_eq!(cmd, "\"C:\\Program Files (x86)\\Steam\\steam.exe\" -silent");
        }
    }
}
