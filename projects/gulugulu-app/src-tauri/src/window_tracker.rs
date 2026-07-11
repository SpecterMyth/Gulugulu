use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[cfg(windows)]
pub fn active_window_bounds() -> Option<WindowBounds> {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId, IsIconic,
    };

    unsafe {
        let window = GetForegroundWindow();
        if window.0.is_null() || IsIconic(window).as_bool() {
            return None;
        }

        let mut process_id = 0;
        GetWindowThreadProcessId(window, Some(&mut process_id));
        if process_id == std::process::id() {
            return None;
        }

        let mut rect = RECT::default();
        if GetWindowRect(window, &mut rect).is_err() {
            return None;
        }

        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;
        if width <= 0 || height <= 0 {
            return None;
        }

        Some(WindowBounds {
            x: rect.left,
            y: rect.top,
            width,
            height,
        })
    }
}

#[cfg(not(windows))]
pub fn active_window_bounds() -> Option<WindowBounds> {
    None
}

/// 包含 (x, y) 那台显示器的工作区（去掉任务栏后的可用区域）。
/// 后院停靠布局用它把窗口铺满屏宽、底边贴任务栏上沿。
#[cfg(windows)]
pub fn work_area_at(x: i32, y: i32) -> Option<WindowBounds> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };

    unsafe {
        let monitor = MonitorFromPoint(POINT { x, y }, MONITOR_DEFAULTTONEAREST);
        if monitor.0.is_null() {
            return None;
        }

        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };
        if !GetMonitorInfoW(monitor, &mut info).as_bool() {
            return None;
        }

        let work = info.rcWork;
        let width = work.right - work.left;
        let height = work.bottom - work.top;
        if width <= 0 || height <= 0 {
            return None;
        }

        Some(WindowBounds {
            x: work.left,
            y: work.top,
            width,
            height,
        })
    }
}

#[cfg(not(windows))]
pub fn work_area_at(_x: i32, _y: i32) -> Option<WindowBounds> {
    None
}
