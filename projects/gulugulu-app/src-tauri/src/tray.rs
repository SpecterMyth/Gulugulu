//! 系统托盘菜单。与前端设置面板（src/App.tsx）保持一致的开关——总在最前 /
//! 键盘充能 / 随机移动 + 语言子菜单——全部走 `crate::settings` 单一真源。
//!
//! 所有条目**双语**：菜单在构建时按当前语言取词，语言切换时用 `set_text` 就地
//! 换词（无需重建）。新增一门语言：在 `labels()` 加一个 match 分支、在语言子菜单
//! 加一个 CheckMenuItem，即可（前端 src/i18n.ts 同步加一项）。

use crate::settings::{self, AppSettings};
use std::sync::OnceLock;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};

/// 需要随语言/勾选态更新的菜单条目句柄（构建后存入进程级 OnceLock）。
struct TrayHandles {
    show: MenuItem<Wry>,
    hide: MenuItem<Wry>,
    always_on_top: CheckMenuItem<Wry>,
    keyboard_capture: CheckMenuItem<Wry>,
    random_movement: CheckMenuItem<Wry>,
    language: Submenu<Wry>,
    lang_zh: CheckMenuItem<Wry>,
    lang_en: CheckMenuItem<Wry>,
    quit: MenuItem<Wry>,
}

static HANDLES: OnceLock<TrayHandles> = OnceLock::new();

/// 一门语言下的全部托盘文案。
struct TrayLabels {
    show: &'static str,
    hide: &'static str,
    always_on_top: &'static str,
    keyboard_capture: &'static str,
    random_movement: &'static str,
    language: &'static str,
    lang_zh: &'static str,
    lang_en: &'static str,
    quit: &'static str,
}

/// 托盘文案表。语言码未知时回退英文（与 settings 默认一致）。
fn labels(language: &str) -> TrayLabels {
    match language {
        "zh" => TrayLabels {
            show: "显示",
            hide: "隐藏",
            always_on_top: "总在最前",
            keyboard_capture: "键盘充能",
            random_movement: "随机移动",
            language: "语言",
            lang_zh: "简体中文",
            lang_en: "English",
            quit: "退出",
        },
        _ => TrayLabels {
            show: "Show",
            hide: "Hide",
            always_on_top: "Always on top",
            keyboard_capture: "Keyboard charging",
            random_movement: "Random movement",
            language: "Language",
            lang_zh: "简体中文",
            lang_en: "English",
            quit: "Quit",
        },
    }
}

/// 构建托盘图标 + 菜单，接线菜单事件，并把初始置顶偏好落到主窗口。
/// 在 `lib.rs` 的 `setup()` 内调用一次。
pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let settings = settings::load(app);
    let l = labels(&settings.language);

    let show = MenuItem::with_id(app, "show", l.show, true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", l.hide, true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let always_on_top = CheckMenuItem::with_id(
        app,
        "always_on_top",
        l.always_on_top,
        true,
        settings.always_on_top,
        None::<&str>,
    )?;
    // 键盘充能开关（InteractionEconomy §5.2）：关闭 = 真实卸载系统钩子。
    let keyboard_capture = CheckMenuItem::with_id(
        app,
        "keyboard_capture",
        l.keyboard_capture,
        true,
        settings.keyboard_capture,
        None::<&str>,
    )?;
    let random_movement = CheckMenuItem::with_id(
        app,
        "random_movement",
        l.random_movement,
        true,
        settings.random_movement,
        None::<&str>,
    )?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let lang_zh = CheckMenuItem::with_id(app, "lang_zh", l.lang_zh, true, settings.language == "zh", None::<&str>)?;
    let lang_en = CheckMenuItem::with_id(app, "lang_en", l.lang_en, true, settings.language == "en", None::<&str>)?;
    let language = Submenu::with_items(app, l.language, true, &[&lang_zh, &lang_en])?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", l.quit, true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show,
            &hide,
            &sep1,
            &always_on_top,
            &keyboard_capture,
            &random_movement,
            &sep2,
            &language,
            &sep3,
            &quit,
        ],
    )?;

    let _ = HANDLES.set(TrayHandles {
        show,
        hide,
        always_on_top,
        keyboard_capture,
        random_movement,
        language,
        lang_zh,
        lang_en,
        quit,
    });

    TrayIconBuilder::new()
        .icon(Image::from_bytes(include_bytes!("../icons/tray-duck.png"))?)
        .tooltip("Gulugulu")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| on_menu_event(app, event.id().as_ref()))
        .build(app)?;

    // 启动时按持久化偏好设一次主窗口置顶（后续模式切换由 resize/dock 命令维持）。
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(settings.always_on_top);
    }

    Ok(())
}

fn on_menu_event(app: &AppHandle, id: &str) {
    match id {
        "show" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "hide" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }
        }
        // CheckMenuItem 点击后自身已翻转 → 读新值落地（settings 命令内会回写托盘勾选态）。
        "always_on_top" => {
            let enabled = checked("always_on_top");
            let _ = settings::set_always_on_top(app.clone(), enabled);
        }
        "keyboard_capture" => {
            let enabled = checked("keyboard_capture");
            let _ = crate::key_watcher::set_keyboard_capture(app.clone(), enabled);
        }
        "random_movement" => {
            let enabled = checked("random_movement");
            let _ = settings::set_random_movement(app.clone(), enabled);
        }
        // 语言项是"单选"表现：忽略点击的自翻转，改由 set_language + sync 校正两项勾选。
        "lang_zh" => {
            let _ = settings::set_language(app.clone(), "zh".to_string());
        }
        "lang_en" => {
            let _ = settings::set_language(app.clone(), "en".to_string());
        }
        "quit" => app.exit(0),
        _ => {}
    }
}

/// 读某个勾选项的当前勾选态（读不到时默认开——三个开关默认值均为 true）。
fn checked(id: &str) -> bool {
    let Some(handles) = HANDLES.get() else {
        return true;
    };
    let item = match id {
        "always_on_top" => &handles.always_on_top,
        "keyboard_capture" => &handles.keyboard_capture,
        "random_movement" => &handles.random_movement,
        _ => return true,
    };
    item.is_checked().unwrap_or(true)
}

/// 依据设置刷新托盘：勾选态 + 当前语言的全部文案。
/// 前端改设置/语言，或托盘自身改动后都会调用，使两处菜单始终一致。
pub fn sync_from_settings(settings: &AppSettings) {
    let Some(h) = HANDLES.get() else {
        return;
    };
    let _ = h.always_on_top.set_checked(settings.always_on_top);
    let _ = h.keyboard_capture.set_checked(settings.keyboard_capture);
    let _ = h.random_movement.set_checked(settings.random_movement);
    let _ = h.lang_zh.set_checked(settings.language == "zh");
    let _ = h.lang_en.set_checked(settings.language == "en");

    let l = labels(&settings.language);
    let _ = h.show.set_text(l.show);
    let _ = h.hide.set_text(l.hide);
    let _ = h.always_on_top.set_text(l.always_on_top);
    let _ = h.keyboard_capture.set_text(l.keyboard_capture);
    let _ = h.random_movement.set_text(l.random_movement);
    let _ = h.language.set_text(l.language);
    let _ = h.lang_zh.set_text(l.lang_zh);
    let _ = h.lang_en.set_text(l.lang_en);
    let _ = h.quit.set_text(l.quit);
}
