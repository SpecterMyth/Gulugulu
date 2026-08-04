//! 系统托盘菜单。与前端设置面板共用 `crate::settings` 单一真源；语言项与
//! `src/i18n/core.ts` 的注册表保持同序、同 BCP-47 id。

use crate::settings::{self, AppSettings};
use std::sync::OnceLock;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};

const LANGUAGES: [(&str, &str); 21] = [
    ("en", "English"),
    ("zh-Hans", "简体中文"),
    ("zh-Hant", "繁體中文"),
    ("ja", "日本語"),
    ("ko", "한국어"),
    ("fr", "Français"),
    ("de", "Deutsch"),
    ("es-ES", "Español (España)"),
    ("es-419", "Español (Latinoamérica)"),
    ("pt-BR", "Português (Brasil)"),
    ("pt-PT", "Português (Portugal)"),
    ("ru", "Русский"),
    ("it", "Italiano"),
    ("pl", "Polski"),
    ("tr", "Türkçe"),
    ("uk", "Українська"),
    ("ar", "العربية"),
    ("th", "ไทย"),
    ("vi", "Tiếng Việt"),
    ("id", "Bahasa Indonesia"),
    ("nl", "Nederlands"),
];

struct TrayHandles {
    show: MenuItem<Wry>,
    hide: MenuItem<Wry>,
    always_on_top: CheckMenuItem<Wry>,
    keyboard_capture: CheckMenuItem<Wry>,
    random_movement: CheckMenuItem<Wry>,
    language: Submenu<Wry>,
    languages: Vec<(&'static str, CheckMenuItem<Wry>)>,
    quit: MenuItem<Wry>,
}

static HANDLES: OnceLock<TrayHandles> = OnceLock::new();

struct TrayLabels {
    show: &'static str,
    hide: &'static str,
    always_on_top: &'static str,
    keyboard_capture: &'static str,
    random_movement: &'static str,
    language: &'static str,
    quit: &'static str,
}

fn labels(language: &str) -> TrayLabels {
    let values = match language {
        "zh-Hans" => ["显示", "隐藏", "总在最前", "键盘充能", "随机移动", "语言", "退出"],
        "zh-Hant" => ["顯示", "隱藏", "永遠置頂", "鍵盤充能", "隨機移動", "語言", "結束"],
        "ja" => ["表示", "隠す", "常に手前", "キーボード充電", "ランダム移動", "言語", "終了"],
        "ko" => ["표시", "숨기기", "항상 위", "키보드 충전", "무작위 이동", "언어", "종료"],
        "fr" => ["Afficher", "Masquer", "Toujours au premier plan", "Recharge au clavier", "Déplacements aléatoires", "Langue", "Quitter"],
        "de" => ["Anzeigen", "Ausblenden", "Immer im Vordergrund", "Tastatur-Aufladung", "Zufällige Bewegung", "Sprache", "Beenden"],
        "es-ES" | "es-419" => ["Mostrar", "Ocultar", "Siempre visible", "Carga con teclado", "Movimiento aleatorio", "Idioma", "Salir"],
        "pt-BR" => ["Mostrar", "Ocultar", "Sempre visível", "Recarga pelo teclado", "Movimento aleatório", "Idioma", "Sair"],
        "pt-PT" => ["Mostrar", "Ocultar", "Sempre visível", "Carregamento pelo teclado", "Movimento aleatório", "Idioma", "Sair"],
        "ru" => ["Показать", "Скрыть", "Поверх всех", "Зарядка с клавиатуры", "Случайное движение", "Язык", "Выйти"],
        "it" => ["Mostra", "Nascondi", "Sempre in primo piano", "Ricarica da tastiera", "Movimento casuale", "Lingua", "Esci"],
        "pl" => ["Pokaż", "Ukryj", "Zawsze na wierzchu", "Ładowanie klawiaturą", "Losowy ruch", "Język", "Zakończ"],
        "tr" => ["Göster", "Gizle", "Her zaman üstte", "Klavyeyle şarj", "Rastgele hareket", "Dil", "Çıkış"],
        "uk" => ["Показати", "Сховати", "Поверх усіх", "Заряджання з клавіатури", "Випадковий рух", "Мова", "Вийти"],
        "ar" => ["إظهار", "إخفاء", "إبقاء في المقدمة", "الشحن بلوحة المفاتيح", "حركة عشوائية", "اللغة", "خروج"],
        "th" => ["แสดง", "ซ่อน", "อยู่ด้านบนเสมอ", "ชาร์จด้วยแป้นพิมพ์", "เคลื่อนที่แบบสุ่ม", "ภาษา", "ออกจากเกม"],
        "vi" => ["Hiện", "Ẩn", "Luôn ở trên cùng", "Sạc bằng bàn phím", "Di chuyển ngẫu nhiên", "Ngôn ngữ", "Thoát"],
        "id" => ["Tampilkan", "Sembunyikan", "Selalu di atas", "Isi daya lewat keyboard", "Gerak acak", "Bahasa", "Keluar"],
        "nl" => ["Tonen", "Verbergen", "Altijd op voorgrond", "Opladen via toetsenbord", "Willekeurig bewegen", "Taal", "Afsluiten"],
        _ => ["Show", "Hide", "Always on top", "Keyboard charging", "Random movement", "Language", "Quit"],
    };
    TrayLabels {
        show: values[0],
        hide: values[1],
        always_on_top: values[2],
        keyboard_capture: values[3],
        random_movement: values[4],
        language: values[5],
        quit: values[6],
    }
}

pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let settings = settings::load(app);
    let l = labels(&settings.language);

    let show = MenuItem::with_id(app, "show", l.show, true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", l.hide, true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let always_on_top = CheckMenuItem::with_id(
        app, "always_on_top", l.always_on_top, true, settings.always_on_top, None::<&str>,
    )?;
    let keyboard_capture = CheckMenuItem::with_id(
        app, "keyboard_capture", l.keyboard_capture, true, settings.keyboard_capture, None::<&str>,
    )?;
    let random_movement = CheckMenuItem::with_id(
        app, "random_movement", l.random_movement, true, settings.random_movement, None::<&str>,
    )?;
    let sep2 = PredefinedMenuItem::separator(app)?;

    let language = Submenu::new(app, l.language, true)?;
    let mut languages = Vec::with_capacity(LANGUAGES.len());
    for (id, native_name) in LANGUAGES {
        let item = CheckMenuItem::with_id(
            app,
            format!("lang:{id}"),
            native_name,
            true,
            settings.language == id,
            None::<&str>,
        )?;
        language.append(&item)?;
        languages.push((id, item));
    }

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
        languages,
        quit,
    });

    TrayIconBuilder::new()
        .icon(Image::from_bytes(include_bytes!("../icons/tray-duck.png"))?)
        .tooltip("Gulugulu")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| on_menu_event(app, event.id().as_ref()))
        .build(app)?;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(settings.always_on_top);
    }
    Ok(())
}

fn on_menu_event(app: &AppHandle, id: &str) {
    if let Some(language) = id.strip_prefix("lang:") {
        let _ = settings::set_language(app.clone(), language.to_string());
        return;
    }
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
        "always_on_top" => {
            let _ = settings::set_always_on_top(app.clone(), checked("always_on_top"));
        }
        "keyboard_capture" => {
            let _ = crate::key_watcher::set_keyboard_capture(app.clone(), checked("keyboard_capture"));
        }
        "random_movement" => {
            let _ = settings::set_random_movement(app.clone(), checked("random_movement"));
        }
        "quit" => crate::exit_app(app),
        _ => {}
    }
}

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

pub fn sync_from_settings(settings: &AppSettings) {
    let Some(h) = HANDLES.get() else {
        return;
    };
    let _ = h.always_on_top.set_checked(settings.always_on_top);
    let _ = h.keyboard_capture.set_checked(settings.keyboard_capture);
    let _ = h.random_movement.set_checked(settings.random_movement);
    for (id, item) in &h.languages {
        let _ = item.set_checked(settings.language == *id);
    }

    let l = labels(&settings.language);
    let _ = h.show.set_text(l.show);
    let _ = h.hide.set_text(l.hide);
    let _ = h.always_on_top.set_text(l.always_on_top);
    let _ = h.keyboard_capture.set_text(l.keyboard_capture);
    let _ = h.random_movement.set_text(l.random_movement);
    let _ = h.language.set_text(l.language);
    let _ = h.quit.set_text(l.quit);
}
