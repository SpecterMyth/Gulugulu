//! 透明桌宠窗口的「按画面轮廓穿透」：空白处的点击直达桌面。
//!
//! 问题：主窗口是 280×320 的无边框透明窗，真正画出来的只有底部约 200×178 的
//! 精灵，其余全是透明像素——却照样吃掉鼠标点击（用户看见的是桌面，点下去没反应）。
//!
//! 做法：本模块的后台线程每 40ms 轮询全局光标，换算成主窗口客户区**物理**像素后
//! 推 `pet://hit-probe`；前端用 `document.elementFromPoint` 判断光标底下有没有真正
//! 画出来的东西，再回调 [`set_click_through`] 切 `set_ignore_cursor_events`。
//!
//! 两侧分工是被逼出来的，不能合并到任何一边：
//! * 命中判定必须在前端——某个像素画没画只有 DOM 知道（SVG 精灵默认
//!   `pointer-events: visiblePainted`，天生只在描画处命中，等于白送轮廓级精度）。
//! * 光标轮询必须在 Rust——窗口一旦变穿透，webview 就再也收不到任何鼠标事件，
//!   前端自己无从察觉光标何时移回宠物身上。

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

const POLL_INTERVAL: Duration = Duration::from_millis(40);
/// 光标没动也定期补一帧：窗口被拖走 / 换显示器缩放时客户区坐标同样会变，
/// 心跳保证状态不会卡在某个过期判定上。
const HEARTBEAT: Duration = Duration::from_millis(500);

/// 由前端按 uiMode 开关。只有「纯宠物」界面才穿透：菜单/设置/调试/后院/工厂里
/// 点窗口空白处是「返回上一层」，穿透会把这个交互吃掉。默认关——前端不主动开
/// 就是完全的旧行为。
static WATCHING: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HitProbe {
    /// 主窗口客户区左上角为原点的**物理**像素；前端除以 devicePixelRatio 得 CSS 像素。
    x: f64,
    y: f64,
}

/// 前端判完命中后回调：ignore=true 让窗口对鼠标完全透明（点击落到桌面/下层窗口）。
#[tauri::command]
pub fn set_click_through(app: AppHandle, ignore: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|error| error.to_string())
}

/// 开关轮询。关闭时**必须**同时恢复实心，否则窗口可能停在穿透态而再没人来纠正
/// （前端此后收不到探针，也就不会再下发 false）。
#[tauri::command]
pub fn set_click_through_watch(app: AppHandle, enabled: bool) -> Result<(), String> {
    WATCHING.store(enabled, Ordering::Relaxed);
    if !enabled {
        set_click_through(app, false)?;
    }
    Ok(())
}

/// 纯逻辑：这一帧要不要推给前端。光标不动就不推（鼠标静止时 IPC 归零），
/// 但每 [`HEARTBEAT`] 补一帧兜底。
fn should_emit(last: Option<(i32, i32)>, now: (i32, i32), since_emit: Duration) -> bool {
    match last {
        Some(previous) => previous != now || since_emit >= HEARTBEAT,
        None => true,
    }
}

pub fn spawn_hit_watcher(app: AppHandle) {
    thread::spawn(move || {
        let mut last_cursor: Option<(i32, i32)> = None;
        let mut last_emit = Instant::now();

        loop {
            thread::sleep(POLL_INTERVAL);

            if !WATCHING.load(Ordering::Relaxed) {
                // 重新开启时立刻补一帧（而不是等光标移动）。
                last_cursor = None;
                continue;
            }

            let Some(cursor) = cursor_position(&app) else {
                continue;
            };
            if !should_emit(last_cursor, cursor, last_emit.elapsed()) {
                continue;
            }

            let Some(window) = app.get_webview_window("main") else {
                continue;
            };
            let Ok(origin) = window.inner_position() else {
                continue;
            };

            last_cursor = Some(cursor);
            last_emit = Instant::now();
            let _ = app.emit_to(
                "main",
                "pet://hit-probe",
                HitProbe {
                    x: (cursor.0 - origin.x) as f64,
                    y: (cursor.1 - origin.y) as f64,
                },
            );
        }
    });
}

/// 全局光标（物理像素）。Windows 走 Win32 直取；其余平台退回 tauri 的跨平台实现
/// （要往返主线程，但只在光标真的动了时才继续用得上）。
fn cursor_position(app: &AppHandle) -> Option<(i32, i32)> {
    #[cfg(windows)]
    if let Some(point) = crate::window_tracker::cursor_position() {
        return Some(point);
    }

    let position = app.cursor_position().ok()?;
    Some((position.x.round() as i32, position.y.round() as i32))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emits_first_sample_then_only_on_move_or_heartbeat() {
        // 首帧无论如何要推，否则开关打开后光标不动就永远没有判定。
        assert!(should_emit(None, (10, 10), Duration::ZERO));
        // 光标静止 + 心跳未到 → 不推（鼠标不动时 IPC 归零）。
        assert!(!should_emit(
            Some((10, 10)),
            (10, 10),
            Duration::from_millis(100)
        ));
        // 动 1px 就推：穿透状态的切换必须跟手。
        assert!(should_emit(
            Some((10, 10)),
            (11, 10),
            Duration::from_millis(1)
        ));
        // 光标没动但心跳到点 → 补一帧（窗口自己可能被拖走了）。
        assert!(should_emit(Some((10, 10)), (10, 10), HEARTBEAT));
    }
}
