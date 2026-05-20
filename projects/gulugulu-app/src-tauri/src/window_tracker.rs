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
