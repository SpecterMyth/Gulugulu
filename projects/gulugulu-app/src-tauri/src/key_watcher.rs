//! 键盘充能（InteractionEconomy.md §5）：系统级低级键盘钩子把"敲键盘"
//! 变成宠物的精力来源——每次按键下压计 1 次，按阶换算成精力喂给主宠。
//!
//! # 隐私契约（§5.2，不可回改）
//! - 游戏逻辑只接收"这 1 秒按了 N 次键"的计数（`game::feed_keys`）。
//! - 按键字符只以显示字形（`&'static str`）存在 ≤250ms 的特效批里，随
//!   `game://keys` 发给前端渲染飞行键帽后即丢弃——**不写日志、不入存档、
//!   不落盘、不上传**；也绝不调用 ToUnicode/GetKeyNameTextW 之类的文本
//!   还原 API（既没必要，还会破坏 IME 死键状态）。
//! - 托盘"键盘充能"随时可关 = 真实卸载系统钩子（非静默忽略）。
//!
//! 平台：Windows（WH_KEYBOARD_LL 专线程 + 消息泵；回调必须极快，超时会被
//! 系统静默摘钩）；其他平台 no-op（window_tracker.rs 同款先例），浏览器
//! 预览由 MockBridge 的页面内 keydown 等价模拟。

use serde::Serialize;
use tauri::AppHandle;

// ---------------------------------------------------------------------------
// 键盘充能偏好：持久化收敛到 crate::settings（gulugulu-settings.json 单一真源），
// 与总在最前 / 随机移动 / 语言并列，托盘与前端设置面板共读写。
// ---------------------------------------------------------------------------

/// 键盘充能是否开启（默认开，核心恢复机制；InteractionEconomy §5.2）。
pub fn keyboard_capture_enabled(app: &AppHandle) -> bool {
    crate::settings::load(app).keyboard_capture
}

// ---------------------------------------------------------------------------
// 事件载荷（mirrored in src/types.ts — keep both sides in sync）
// ---------------------------------------------------------------------------

/// `game://keys`：≤4/s 的键帽特效批（纯表现，键身份仅存在于本事件）。
#[derive(Clone, Debug, Serialize)]
pub struct KeyFxEvent {
    pub labels: Vec<&'static str>,
}

/// `game://stamina`：≤1/s 的精力轻量补丁（不推全量存档——customSpecies 太大）。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StaminaPatchEvent {
    pub source: &'static str,
    pub per_pet: Vec<crate::game::PetStaminaGain>,
    pub woke_pet_ids: Vec<String>,
}

// ---------------------------------------------------------------------------
// 纯逻辑核 KeyBatcher（无 Win32，可单测）
// ---------------------------------------------------------------------------

/// 单个 250ms 特效批最多携带的键帽字形数（前端每批渲染 ≤6，多出堆叠）。
const FX_LABELS_PER_BATCH_MAX: usize = 8;
/// pressed-set 防泄漏兜底：异常膨胀（漏收 KEYUP）时整组清空。
const PRESSED_SET_SANITY_CAP: usize = 20;

/// 按键批处理器：pressed-set 压自动重复 + 每秒窗口限速 + 特效字形缓存。
/// 按 **scancode** 键控 pressed-set——IME 下所有键的 vkCode 同为
/// VK_PROCESSKEY(0xE5)，按 vk 会把中文连打吞成一个"长按"。
pub(crate) struct KeyBatcher {
    rate_cap_per_sec: u64,
    pressed: std::collections::HashSet<u32>,
    rate_window: u64,
    counted_in_window: u64,
    counted: u64,
    fx_labels: Vec<&'static str>,
}

impl KeyBatcher {
    pub(crate) fn new(rate_cap_per_sec: u64) -> Self {
        Self {
            rate_cap_per_sec: rate_cap_per_sec.max(1),
            pressed: std::collections::HashSet::new(),
            rate_window: 0,
            counted_in_window: 0,
            counted: 0,
            fx_labels: Vec::new(),
        }
    }

    /// 按键下压。返回 false = 被忽略（按住重复 / 超限速）。
    pub(crate) fn key_down(&mut self, scancode: u32, vk: u32, now_ms: u64) -> bool {
        if self.pressed.len() > PRESSED_SET_SANITY_CAP {
            self.pressed.clear();
        }
        if !self.pressed.insert(scancode) {
            // LL 钩子对按住的键反复发 KEYDOWN：一次按下只计一次，直到抬起。
            return false;
        }
        let window = now_ms / 1000;
        if window != self.rate_window {
            self.rate_window = window;
            self.counted_in_window = 0;
        }
        if self.counted_in_window >= self.rate_cap_per_sec {
            // 超出限速的键既不计数也不出特效（防宏，一条规则管两头）。
            return false;
        }
        self.counted_in_window += 1;
        self.counted += 1;
        if self.fx_labels.len() < FX_LABELS_PER_BATCH_MAX {
            self.fx_labels.push(vk_label(vk));
        }
        true
    }

    pub(crate) fn key_up(&mut self, scancode: u32) {
        self.pressed.remove(&scancode);
    }

    /// 取走本批特效字形（250ms 节拍调用）。
    pub(crate) fn drain_fx(&mut self) -> Vec<&'static str> {
        std::mem::take(&mut self.fx_labels)
    }

    /// 取走累计计数（1s 入账节拍调用）。
    pub(crate) fn take_counted(&mut self) -> u64 {
        std::mem::take(&mut self.counted)
    }
}

/// VK 码 → 键帽显示字形。只映射常见键，其余（含 IME 的 VK_PROCESSKEY）
/// 一律通用键帽 ⌨。**禁止**改成 ToUnicode 之类的布局还原（隐私契约）。
pub(crate) fn vk_label(vk: u32) -> &'static str {
    const LETTERS: [&str; 26] = [
        "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R",
        "S", "T", "U", "V", "W", "X", "Y", "Z",
    ];
    const DIGITS: [&str; 10] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    match vk {
        0x41..=0x5A => LETTERS[(vk - 0x41) as usize],
        0x30..=0x39 => DIGITS[(vk - 0x30) as usize],
        0x60..=0x69 => DIGITS[(vk - 0x60) as usize], // 数字小键盘
        0x0D => "⏎",                                 // Enter
        0x20 => "␣",                                 // Space
        0x08 => "⌫",                                 // Backspace
        0x09 => "⇥",                                 // Tab
        0x1B => "⎋",                                 // Esc
        0x10 | 0xA0 | 0xA1 => "⇧",                   // Shift
        0x11 | 0xA2 | 0xA3 => "⌃",                   // Ctrl
        0x12 | 0xA4 | 0xA5 => "⎇",                   // Alt
        0x5B | 0x5C => "⊞",                          // Win
        0x25 => "←",
        0x26 => "↑",
        0x27 => "→",
        0x28 => "↓",
        0xBC => ",",
        0xBE => ".",
        0xBD => "-",
        0xBB => "=",
        0xBA => ";",
        0xBF => "/",
        0xDE => "'",
        _ => "⌨", // 含 VK_PROCESSKEY(0xE5)：IME 组合中的键
    }
}

// ---------------------------------------------------------------------------
// IPC 命令（跨平台注册；非 Windows 上开关只影响持久化偏好）
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_keyboard_capture(app: AppHandle) -> bool {
    keyboard_capture_enabled(&app)
}

#[tauri::command]
pub fn set_keyboard_capture(app: AppHandle, enabled: bool) -> Result<bool, String> {
    // 落盘 + 广播 settings://changed（前端设置面板同步）→ 真实装/摘钩 → 刷新托盘勾选态。
    let settings = crate::settings::update(&app, |s| s.keyboard_capture = enabled);
    apply_capture(enabled);
    crate::tray::sync_from_settings(&settings);
    Ok(enabled)
}

// ---------------------------------------------------------------------------
// Windows 实现：WH_KEYBOARD_LL 钩子线程 + 250ms/1s 双节拍
// ---------------------------------------------------------------------------

#[cfg(windows)]
mod platform {
    use super::{KeyBatcher, KeyFxEvent, StaminaPatchEvent};
    use crate::game::SharedGameState;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::sync::{Mutex, OnceLock};
    use std::thread;
    use std::time::{Duration, Instant};
    use tauri::{AppHandle, Emitter};
    use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::Threading::GetCurrentThreadId;
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetMessageW, PostThreadMessageW, SetWindowsHookExW,
        TranslateMessage, UnhookWindowsHookEx, HC_ACTION, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL,
        WM_KEYDOWN, WM_KEYUP, WM_QUIT, WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    /// 钩子回调没有用户数据指针 → 批处理器只能是进程级静态。
    static BATCHER: OnceLock<Mutex<KeyBatcher>> = OnceLock::new();
    /// 钩子线程 id（0 = 未运行）；stop 用 PostThreadMessage(WM_QUIT) 退泵。
    static HOOK_THREAD_ID: AtomicU32 = AtomicU32::new(0);
    /// 单调毫秒钟的起点（回调里不能做慢事，Instant 足够便宜）。
    static CLOCK_START: OnceLock<Instant> = OnceLock::new();

    fn now_ms() -> u64 {
        CLOCK_START.get_or_init(Instant::now).elapsed().as_millis() as u64
    }

    fn batcher() -> &'static Mutex<KeyBatcher> {
        BATCHER.get_or_init(|| Mutex::new(KeyBatcher::new(15)))
    }

    /// 钩子回调：必须极快（超过系统 LowLevelHooksTimeout 会被静默摘钩），
    /// 只做 pressed-set/计数登记并放行。
    unsafe extern "system" fn hook_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 {
            let info = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
            match wparam.0 as u32 {
                WM_KEYDOWN | WM_SYSKEYDOWN => {
                    if let Ok(mut batcher) = batcher().lock() {
                        batcher.key_down(info.scanCode, info.vkCode, now_ms());
                    }
                }
                WM_KEYUP | WM_SYSKEYUP => {
                    if let Ok(mut batcher) = batcher().lock() {
                        batcher.key_up(info.scanCode);
                    }
                }
                _ => {}
            }
        }
        CallNextHookEx(None, code, wparam, lparam)
    }

    pub(super) fn start(rate_cap_per_sec: u64) {
        if HOOK_THREAD_ID.load(Ordering::SeqCst) != 0 {
            return; // 已在运行
        }
        // 初次启动时用配置的限速建 batcher（之后沿用同一实例）。
        BATCHER.get_or_init(|| Mutex::new(KeyBatcher::new(rate_cap_per_sec)));
        thread::spawn(|| unsafe {
            let Ok(hook) = SetWindowsHookExW(WH_KEYBOARD_LL, Some(hook_proc), None, 0) else {
                return;
            };
            HOOK_THREAD_ID.store(GetCurrentThreadId(), Ordering::SeqCst);
            // WH_KEYBOARD_LL 的回调在装钩线程上下文里执行，必须泵消息。
            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                let _ = TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
            // 收到 WM_QUIT：真实摘钩（对 AV 诚实——关闭就是不监听）。
            let _ = UnhookWindowsHookEx(hook);
            HOOK_THREAD_ID.store(0, Ordering::SeqCst);
        });
    }

    pub(super) fn stop() {
        let tid = HOOK_THREAD_ID.load(Ordering::SeqCst);
        if tid != 0 {
            unsafe {
                let _ = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0));
            }
        }
    }

    /// 双节拍泵：250ms 排空特效字形 → `game://keys`；1s 取计数入账 →
    /// `game::feed_keys` → `game://stamina`。线程常驻（钩子关闭时批自然为空）。
    pub(super) fn spawn_pump(app: AppHandle, state: SharedGameState) {
        thread::spawn(move || {
            let mut last_feed = Instant::now();
            loop {
                thread::sleep(Duration::from_millis(250));
                let labels = batcher().lock().map(|mut b| b.drain_fx()).unwrap_or_default();
                if !labels.is_empty() {
                    let _ = app.emit("game://keys", KeyFxEvent { labels });
                }
                if last_feed.elapsed() >= Duration::from_secs(1) {
                    last_feed = Instant::now();
                    let count = batcher().lock().map(|mut b| b.take_counted()).unwrap_or(0);
                    if count > 0 {
                        if let Some(outcome) = crate::game::feed_keys(&app, &state, count) {
                            let _ = app.emit(
                                "game://stamina",
                                StaminaPatchEvent {
                                    source: "keys",
                                    per_pet: outcome.per_pet,
                                    woke_pet_ids: outcome.woke_pet_ids,
                                },
                            );
                        }
                    }
                }
            }
        });
    }
}

#[cfg(windows)]
fn apply_capture(enabled: bool) {
    if enabled {
        platform::start(15);
    } else {
        platform::stop();
    }
}

#[cfg(not(windows))]
fn apply_capture(_enabled: bool) {}

/// 启动键盘充能子系统：读取偏好、装钩（若开启）、常驻双节拍泵。
/// 非 Windows：整体 no-op（恢复途径退化为挂机 + Token + 零食）。
#[cfg(windows)]
pub fn spawn_key_watcher(app: AppHandle, state: crate::game::SharedGameState) {
    let rate_cap = state.config.key_rate_cap_per_sec.max(1);
    if keyboard_capture_enabled(&app) {
        platform::start(rate_cap);
    }
    platform::spawn_pump(app, state);
}

#[cfg(not(windows))]
pub fn spawn_key_watcher(_app: AppHandle, _state: crate::game::SharedGameState) {}

// ---------------------------------------------------------------------------
// Tests（纯逻辑核，无 Win32）
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_down_dedupes_repeats_until_key_up() {
        let mut batcher = KeyBatcher::new(15);
        assert!(batcher.key_down(30, 0x41, 0)); // A 按下
        assert!(!batcher.key_down(30, 0x41, 100)); // 按住自动重复：不计
        assert!(!batcher.key_down(30, 0x41, 200));
        batcher.key_up(30);
        assert!(batcher.key_down(30, 0x41, 300)); // 抬起后再按：计
        assert_eq!(batcher.take_counted(), 2);
    }

    #[test]
    fn ime_keys_share_vk_but_distinct_scancodes_all_count() {
        // IME 组合时所有键 vkCode = VK_PROCESSKEY(0xE5)，靠 scancode 区分。
        let mut batcher = KeyBatcher::new(15);
        assert!(batcher.key_down(30, 0xE5, 0));
        assert!(batcher.key_down(31, 0xE5, 50));
        assert!(batcher.key_down(32, 0xE5, 100));
        assert_eq!(batcher.take_counted(), 3);
        assert_eq!(batcher.drain_fx(), vec!["⌨", "⌨", "⌨"]);
    }

    #[test]
    fn rate_cap_limits_counted_keys_per_second_window() {
        let mut batcher = KeyBatcher::new(3);
        for i in 0..10u32 {
            batcher.key_down(100 + i, 0x41 + i, 500); // 同一秒窗口内
            batcher.key_up(100 + i);
        }
        assert_eq!(batcher.take_counted(), 3, "超出限速的键不计数");
        // 下一秒窗口重新放行。
        assert!(batcher.key_down(200, 0x42, 1500));
        assert_eq!(batcher.take_counted(), 1);
    }

    #[test]
    fn fx_labels_are_capped_and_drained() {
        let mut batcher = KeyBatcher::new(100);
        for i in 0..12u32 {
            batcher.key_down(300 + i, 0x41 + (i % 26), i as u64 * 10);
        }
        let labels = batcher.drain_fx();
        assert_eq!(labels.len(), FX_LABELS_PER_BATCH_MAX, "特效字形每批封顶");
        assert!(batcher.drain_fx().is_empty(), "排空后无残留");
        assert_eq!(batcher.take_counted(), 12, "计数不受特效封顶影响");
    }

    #[test]
    fn labels_map_common_keys_and_fall_back() {
        assert_eq!(vk_label(0x41), "A");
        assert_eq!(vk_label(0x39), "9");
        assert_eq!(vk_label(0x65), "5"); // 小键盘
        assert_eq!(vk_label(0x0D), "⏎");
        assert_eq!(vk_label(0x20), "␣");
        assert_eq!(vk_label(0xE5), "⌨"); // IME
        assert_eq!(vk_label(0xFF), "⌨");
    }

    #[test]
    fn pressed_set_sanity_cap_clears_leaks() {
        let mut batcher = KeyBatcher::new(1000);
        // 模拟漏收 KEYUP 导致的泄漏：塞满超过上限后自动清组。
        for i in 0..(PRESSED_SET_SANITY_CAP as u32 + 2) {
            batcher.key_down(i, 0x41, 0);
        }
        // 清组后同一 scancode 能再次计数（不会被永久卡死）。
        assert!(batcher.key_down(0, 0x41, 5000));
    }
}
