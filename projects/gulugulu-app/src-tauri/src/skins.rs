//! 皮肤系统命令层（SkinWorkshop.md）：图鉴换肤 / 工坊上传者列表 / 按 fileId 安装 /
//! 分享文本导入 / 复制分享文本 / 补发布自家皮肤。
//!
//! 分层：纯规则在 `game::logic::skins`（可单测）；工坊网络原语在 `steam_workshop`
//! （经 steam.rs 泵线程串行）；本模块只做参数解析、校验管线与事件广播。
//! Steam 触网命令一律 async + `spawn_blocking`（工坊单操作可达分钟级，绝不能占
//! IPC 线程）；改档命令返回新 `GameSave` **并** emit `game://state`（与 fuse_pets_ai
//! 同构——fx 浮层等其它窗口靠事件保鲜）。

use crate::game::{self, CustomSpeciesEntry, GameSave, SharedGameState, SpeciesSkin};
use crate::steam_workshop::{WorkshopItemDetails, WorkshopItemMeta};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const STATE_EVENT: &str = "game://state";
/// 导入内容大小防线（正常 CustomSpeciesEntry 只有几 KB；更大即视为恶意/畸形）。
const MAX_IMPORT_BYTES: usize = 256 * 1024;

// ---------------------------------------------------------------------------
// DTO（serde camelCase；u64 一律十进制字符串防 JS 精度——mirrored in src/types.ts）
// ---------------------------------------------------------------------------

/// 图鉴「创意工坊·上传玩家」列表的一行。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkinUploaderEntry {
    pub published_file_id: String,
    pub author_steam_id: String,
    pub author_persona: Option<String>,
    pub time_created: i64,
    pub title: String,
    pub preview_url: Option<String>,
    /// 首发标记（与 pick_earliest 同口径：timeCreated 最小，并列 fileId 小者胜）。
    pub is_first: bool,
    /// 已在本机 species_skins 收藏。
    pub installed: bool,
    /// 是本机 Steam 账号上传的条目。
    pub is_self: bool,
}

/// 分享文本导入的结果（前端据此跳转图鉴对应物种）。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkinImportResult {
    pub save: GameSave,
    pub codename: String,
    pub skin_id: String,
    pub name_zh: String,
    /// true = 该皮肤此前已导入过（幂等刷新，不新增）。
    pub duplicate: bool,
}

// ---------------------------------------------------------------------------
// 纯函数（单测面）
// ---------------------------------------------------------------------------

/// 从任意粘贴文本提取 workshop fileId：
/// 1) 优先：`steamcommunity.com` URL 里 `id=` 后的连续数字（容忍 `?id=`/`&id=`、
///    后随 `&searchtext` 等）；
/// 2) 兜底：全文**恰好一个** 6~20 位独立数字串 → 视为裸 fileId（0 个或多个 → None，
///    防止从聊天文本里误抓电话号/QQ 号一类的数字）。
/// `0`/溢出 → None。手写扫描（仓库不引 regex crate）。
pub(crate) fn parse_share_file_id(text: &str) -> Option<u64> {
    // 数字串扫描器：返回文本里的连续数字串列表。
    fn digit_runs(s: &str) -> Vec<&str> {
        let bytes = s.as_bytes();
        let mut runs: Vec<&str> = Vec::new();
        let mut i = 0;
        while i < bytes.len() {
            if bytes[i].is_ascii_digit() {
                let start = i;
                while i < bytes.len() && bytes[i].is_ascii_digit() {
                    i += 1;
                }
                runs.push(&s[start..i]);
            } else {
                i += 1;
            }
        }
        runs
    }
    // 1) steamcommunity URL 的 id= 参数。
    if let Some(host_at) = text.find("steamcommunity.com") {
        let rest = &text[host_at..];
        if let Some(id_at) = rest.find("id=") {
            let digits: String = rest[id_at + 3..]
                .chars()
                .take_while(|c| c.is_ascii_digit())
                .collect();
            if !digits.is_empty() {
                return digits.parse::<u64>().ok().filter(|id| *id > 0);
            }
        }
    }
    // 2) 恰好一个 6~20 位独立数字串。
    let candidates: Vec<&str> = digit_runs(text)
        .into_iter()
        .filter(|run| (6..=20).contains(&run.len()))
        .collect();
    match candidates.as_slice() {
        [single] => single.parse::<u64>().ok().filter(|id| *id > 0),
        _ => None,
    }
}

/// 生成分享文本（与 `parse_share_file_id` 保证往返；单测锁死）。
pub(crate) fn build_share_text(name_zh: &str, file_id: u64) -> String {
    format!(
        "【咕噜咕噜】皮肤分享：{name_zh} https://steamcommunity.com/sharedfiles/filedetails/?id={file_id} （复制整段文本，在游戏图鉴点「导入皮肤」粘贴即可）"
    )
}

/// 工坊查询元数据 → 上传者列表 DTO：按 (timeCreated, fileId) 升序（首发在最上），
/// 标注首发/已收藏/本人。纯函数，便于单测。
pub(crate) fn to_uploader_entries(
    metas: &[WorkshopItemMeta],
    installed: &std::collections::BTreeSet<u64>,
    my_steam_id: Option<u64>,
) -> Vec<SkinUploaderEntry> {
    let first = crate::steam_workshop::first_file_id(metas);
    let mut sorted: Vec<&WorkshopItemMeta> = metas.iter().collect();
    sorted.sort_by_key(|m| (m.time_created, m.published_file_id));
    sorted
        .into_iter()
        .map(|m| SkinUploaderEntry {
            published_file_id: m.published_file_id.to_string(),
            author_steam_id: m.owner_steam_id.to_string(),
            author_persona: m.owner_persona.clone(),
            time_created: m.time_created as i64,
            title: m.title.clone(),
            preview_url: m.preview_url.clone(),
            is_first: Some(m.published_file_id) == first,
            installed: installed.contains(&m.published_file_id),
            is_self: Some(m.owner_steam_id) == my_steam_id,
        })
        .collect()
}

/// 下载内容的校验管线（不含目录撞名——那步需要 config，放 with_save 闭包里做）：
/// 大小防线 → petId 标签存在且形态合法 → （安装路径）与期望槽位一致 → schema 兼容 →
/// 反序列化 → visual 安全校验 → 名字 sanity。返回 (codename, entry)。
/// **任何路径都不写 custom_species**（皮肤只进 species_skins，无进度绕过）。
pub(crate) fn validate_fetched_skin(
    details: &WorkshopItemDetails,
    entry_json: &str,
    expect_codename: Option<&str>,
) -> Result<(String, CustomSpeciesEntry), String> {
    if entry_json.len() > MAX_IMPORT_BYTES {
        return Err("#skinTooLarge".to_string());
    }
    let codename = details
        .pet_id
        .clone()
        .filter(|c| crate::fusion_gen::is_valid_codename(c))
        .ok_or_else(|| "#skinNoPetId".to_string())?;
    if let Some(expected) = expect_codename {
        if codename != expected {
            return Err("#skinPetIdMismatch".to_string());
        }
    }
    match details.schema.as_deref() {
        // None = 早期上传未带 schema 标签；"1" = 当前格式。其余版本拒收。
        None | Some("1") => {}
        Some(_) => return Err("#skinSchemaUnsupported".to_string()),
    }
    let entry: CustomSpeciesEntry = serde_json::from_str(entry_json)
        .map_err(|_| "#skinContentInvalid".to_string())?;
    crate::fusion_gen::validate_custom_visual(&entry.visual)
        .map_err(|e| format!("#skinContentInvalid|err={e}"))?;
    let name_len = entry.info.name_zh.chars().count();
    if name_len == 0 || name_len > 24 {
        return Err("#skinContentInvalid".to_string());
    }
    Ok((codename, entry))
}

/// 下载详情 + 内容 → SpeciesSkin 记录（source = "first" | "shared"）。
fn skin_from_fetch(
    details: &WorkshopItemDetails,
    entry: &CustomSpeciesEntry,
    source: &str,
    now: i64,
) -> SpeciesSkin {
    let file_id = details.meta.published_file_id;
    SpeciesSkin {
        id: format!("ws:{file_id}"),
        visual: entry.visual.clone(),
        name_zh: entry.info.name_zh.clone(),
        author_steam_id: details.meta.owner_steam_id.to_string(),
        author_persona: details.meta.owner_persona.clone(),
        published_file_id: file_id.to_string(),
        time_created: details.meta.time_created as i64,
        imported_at: now,
        source: source.to_string(),
    }
}

/// Steam 触网守卫：集成开 + 已连接，否则统一 `#skinNeedsSteam`。
fn require_steam(steam: &crate::steam::SharedSteamState) -> Result<(), String> {
    if !crate::steam::integration_enabled() || !steam.is_connected() {
        return Err("#skinNeedsSteam".to_string());
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// IPC 命令
// ---------------------------------------------------------------------------

/// 图鉴换肤：一物种一选择（"default" | "local" | "ws:<fileId>"），全场景生效。
#[tauri::command]
pub fn select_species_skin(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    codename: String,
    skin_id: String,
) -> Result<GameSave, String> {
    let (_, save) = game::with_save(&app, state.inner(), |config, save| {
        game::logic_select_skin(config, save, &codename, &skin_id)
    })?;
    let _ = app.emit(STATE_EVENT, save.clone());
    Ok(save)
}

/// 图鉴「创意工坊·上传玩家」列表：该物种 petId 的全部工坊上传（跨页 +
/// best-effort 昵称），首发/已收藏/本人已标注、首发在最上。慢（秒级~分钟级），
/// 前端自带 loading 并做单飞。
#[tauri::command]
pub async fn list_skin_uploaders(
    app: AppHandle,
    game: tauri::State<'_, SharedGameState>,
    steam: tauri::State<'_, crate::steam::SharedSteamState>,
    codename: String,
) -> Result<Vec<SkinUploaderEntry>, String> {
    let game_state = game.inner().clone();
    let steam_state = steam.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        require_steam(&steam_state)?;
        if !crate::fusion_gen::is_valid_codename(&codename) {
            return Err("#skinInvalidId".to_string());
        }
        let metas = steam_state.list_species_uploads(&codename)?;
        let installed = game::with_save(&app, &game_state, |_config, save| {
            Ok(save
                .species_skins
                .get(&codename)
                .map(|list| {
                    list.iter()
                        .filter_map(|s| s.published_file_id.parse::<u64>().ok())
                        .collect::<std::collections::BTreeSet<u64>>()
                })
                .unwrap_or_default())
        })
        .map(|(set, _)| set)
        .unwrap_or_default();
        let my_steam_id = steam_state.snapshot().steam_id.and_then(|s| s.parse::<u64>().ok());
        Ok(to_uploader_entries(&metas, &installed, my_steam_id))
    })
    .await
    .map_err(|error| error.to_string())?
}

/// 安装某上传者的皮肤（图鉴上传者列表「安装」）：按 fileId 下载 → 校验（petId 必须
/// 等于该物种）→ 入库 species_skins。**不**自动选中（前端引导点「使用」）。
/// 物种尚未获得也可入库（先入库决策：获得后才可选用）。
#[tauri::command]
pub async fn install_species_skin(
    app: AppHandle,
    game: tauri::State<'_, SharedGameState>,
    steam: tauri::State<'_, crate::steam::SharedSteamState>,
    codename: String,
    published_file_id: String,
    source: Option<String>,
) -> Result<GameSave, String> {
    let game_state = game.inner().clone();
    let steam_state = steam.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        require_steam(&steam_state)?;
        let file_id = published_file_id
            .parse::<u64>()
            .ok()
            .filter(|id| *id > 0)
            .ok_or_else(|| "#skinInvalidId".to_string())?;
        let (details, entry_json) = steam_state.fetch_species_item(file_id)?;
        let (codename, entry) = validate_fetched_skin(&details, &entry_json, Some(&codename))?;
        let source = match source.as_deref() {
            Some("first") => "first",
            _ => "shared",
        };
        let skin = skin_from_fetch(&details, &entry, source, game::now_secs());
        let (_, save) = game::with_save(&app, &game_state, |config, save| {
            if config.species.contains_key(&codename) {
                return Err("#skinCollidesCatalog".to_string());
            }
            game::logic_install_skin(save, &codename, skin.clone()).map(|_| ())
        })?;
        let _ = app.emit(STATE_EVENT, save.clone());
        Ok(save)
    })
    .await
    .map_err(|error| error.to_string())?
}

/// 导入好友分享的皮肤文本：解析 fileId → 下载 → **codename 取物品的 petId 标签** →
/// 校验入库。重复导入幂等成功（duplicate=true，元数据刷新）。
#[tauri::command]
pub async fn import_skin_from_text(
    app: AppHandle,
    game: tauri::State<'_, SharedGameState>,
    steam: tauri::State<'_, crate::steam::SharedSteamState>,
    text: String,
) -> Result<SkinImportResult, String> {
    let game_state = game.inner().clone();
    let steam_state = steam.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        require_steam(&steam_state)?;
        let file_id = parse_share_file_id(&text).ok_or_else(|| "#skinShareTextInvalid".to_string())?;
        let (details, entry_json) = steam_state.fetch_species_item(file_id)?;
        let (codename, entry) = validate_fetched_skin(&details, &entry_json, None)?;
        let skin = skin_from_fetch(&details, &entry, "shared", game::now_secs());
        let ((skin_id, duplicate), save) = game::with_save(&app, &game_state, |config, save| {
            if config.species.contains_key(&codename) {
                return Err("#skinCollidesCatalog".to_string());
            }
            let inserted = game::logic_install_skin(save, &codename, skin.clone())?;
            Ok((skin.id.clone(), !inserted))
        })?;
        let _ = app.emit(STATE_EVENT, save.clone());
        Ok(SkinImportResult {
            save,
            codename,
            skin_id,
            name_zh: entry.info.name_zh.clone(),
            duplicate,
        })
    })
    .await
    .map_err(|error| error.to_string())?
}

/// 复制分享文本：仅当该物种由本机上传过（workshop_published 有真 fileId）。
/// 剪贴板由前端负责（navigator.clipboard，失败降级手动复制框）。
#[tauri::command]
pub fn get_skin_share_text(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    codename: String,
) -> Result<String, String> {
    let (text, _) = game::with_save(&app, state.inner(), |_config, save| {
        let file_id = save
            .workshop_published
            .get(&codename)
            .and_then(|v| v.parse::<u64>().ok())
            .filter(|id| *id > 0)
            .ok_or_else(|| "#skinShareUnavailable".to_string())?;
        let name_zh = save
            .custom_species
            .get(&codename)
            .map(|e| e.info.name_zh.clone())
            .unwrap_or_else(|| codename.clone());
        Ok(build_share_text(&name_zh, file_id))
    })?;
    Ok(text)
}

/// 补发布自家皮肤（生成期发布失败/曾被 `""` 认领标记压住的本机形象）。
/// 守卫：entry 存在且 `origin=="local"`——存量出处不明（None）一律拒绝
/// （不能把可能是他人的设计当自家作品上传）；已有真 fileId 则无需再发。
#[tauri::command]
pub async fn publish_own_skin(
    app: AppHandle,
    game: tauri::State<'_, SharedGameState>,
    steam: tauri::State<'_, crate::steam::SharedSteamState>,
    codename: String,
) -> Result<GameSave, String> {
    let game_state = game.inner().clone();
    let steam_state = steam.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        require_steam(&steam_state)?;
        let (payload, _) = game::with_save(&app, &game_state, |_config, save| {
            let already = save
                .workshop_published
                .get(&codename)
                .and_then(|v| v.parse::<u64>().ok())
                .filter(|id| *id > 0)
                .is_some();
            if already {
                return Err("#skinAlreadyPublished".to_string());
            }
            let entry = save
                .custom_species
                .get(&codename)
                .ok_or_else(|| "#skinSpeciesUnknown".to_string())?;
            if entry.origin.as_deref() != Some("local") {
                return Err("#skinProvenanceUnknown".to_string());
            }
            let json = serde_json::to_string(entry).map_err(|e| e.to_string())?;
            Ok((entry.info.name_zh.clone(), json))
        })?;
        let (name_zh, entry_json) = payload;
        let preview = crate::fusion_gen::species_preview_path(&app, &codename);
        let had_preview = preview.as_deref().map_or(false, |p| p.is_file());
        let (file_id, needs_legal) =
            steam_state.publish_species(&codename, &name_zh, &entry_json, preview)?;
        eprintln!(
            "[workshop] publish-own {codename}: publishedFileId={file_id} legalPending={needs_legal}"
        );
        crate::fusion_gen::record_workshop_published(
            &app,
            &game_state,
            &steam_state,
            &codename,
            file_id.to_string(),
            Some(needs_legal),
            had_preview,
        );
        let (_, save) = game::with_save(&app, &game_state, |_config, _save| Ok(()))?;
        let _ = app.emit(STATE_EVENT, save.clone());
        Ok(save)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_share_file_id_variants() {
        // 标准 URL / 带尾参 / 夹在中文分享文本里。
        let url = "https://steamcommunity.com/sharedfiles/filedetails/?id=3765893901";
        assert_eq!(parse_share_file_id(url), Some(3765893901));
        assert_eq!(
            parse_share_file_id("https://steamcommunity.com/sharedfiles/filedetails/?id=3765893901&searchtext=x"),
            Some(3765893901)
        );
        assert_eq!(
            parse_share_file_id("看看我的皮肤！ https://steamcommunity.com/sharedfiles/filedetails/?id=42424242 好看吧"),
            Some(42424242)
        );
        // 裸 fileId（唯一 6~20 位数字串）。
        assert_eq!(parse_share_file_id("3765893901"), Some(3765893901));
        assert_eq!(parse_share_file_id("id 是 3765893901，去导入"), Some(3765893901));
        // 歧义（两个候选数字串）/ 无候选 / 过短 / 0 → None。
        assert_eq!(parse_share_file_id("123456 和 654321 两个"), None);
        assert_eq!(parse_share_file_id("没有数字"), None);
        assert_eq!(parse_share_file_id("12345"), None);
        assert_eq!(parse_share_file_id("steamcommunity.com/?id=0"), None);
        // URL 命中优先于文本里其它数字串。
        assert_eq!(
            parse_share_file_id("QQ 1008610086，链接 steamcommunity.com/sharedfiles/filedetails/?id=999999"),
            Some(999999)
        );
    }

    #[test]
    fn share_text_roundtrips_through_parser() {
        let text = build_share_text("焰花鼠丸", 3765894567);
        assert_eq!(parse_share_file_id(&text), Some(3765894567));
        assert!(text.contains("焰花鼠丸"));
        assert!(text.contains("导入皮肤"));
    }

    fn meta(time_created: u32, id: u64, owner: u64) -> WorkshopItemMeta {
        WorkshopItemMeta {
            published_file_id: id,
            owner_steam_id: owner,
            owner_persona: None,
            time_created,
            title: format!("t{id}"),
            preview_url: None,
        }
    }

    #[test]
    fn uploader_entries_sorted_first_installed_self_marked() {
        let metas = vec![meta(300, 7, 111), meta(100, 9, 222), meta(100, 3, 333)];
        let installed = std::collections::BTreeSet::from([7u64]);
        let entries = to_uploader_entries(&metas, &installed, Some(111));
        // 升序：(100,3) → (100,9) → (300,7)；首发 = (100,3)。
        assert_eq!(
            entries.iter().map(|e| e.published_file_id.as_str()).collect::<Vec<_>>(),
            ["3", "9", "7"]
        );
        assert!(entries[0].is_first);
        assert!(!entries[1].is_first && !entries[2].is_first);
        assert!(entries[2].installed && !entries[0].installed);
        assert!(entries[2].is_self && !entries[0].is_self);
        // camelCase 序列化（TS 镜像契约）。
        let json = serde_json::to_string(&entries[0]).unwrap();
        for key in ["publishedFileId", "authorSteamId", "timeCreated", "isFirst", "installed", "isSelf"] {
            assert!(json.contains(key), "{key} 应为 camelCase");
        }
    }

    fn details(pet_id: Option<&str>, schema: Option<&str>) -> WorkshopItemDetails {
        WorkshopItemDetails {
            meta: meta(100, 9001, 76561199838336217),
            pet_id: pet_id.map(String::from),
            schema: schema.map(String::from),
        }
    }

    fn sample_entry_json() -> String {
        r##"{"info":{"nameZh":"测试兽","elements":["fire"],"colors":["#ff0000"],"body":"chimera","desc":"d"},
             "visual":{"rig":"chimera","scale":1.1,"palette":{"body":"#111111","deep":"#222222","belly":"#333333","accent":"#444444"}},
             "parents":["a","b"],"createdAt":1,"generator":"mock","origin":"local"}"##
            .to_string()
    }

    #[test]
    fn validate_fetched_skin_edges() {
        let json = sample_entry_json();
        // 正常：codename 取自 petId 标签；origin 字段随内容来但导入侧不采信（皮肤不入 custom_species）。
        let (codename, entry) = validate_fetched_skin(&details(Some("aif0101"), Some("1")), &json, None).unwrap();
        assert_eq!(codename, "aif0101");
        assert_eq!(entry.info.name_zh, "测试兽");
        // 无 schema 标签（早期上传）也接受。
        assert!(validate_fetched_skin(&details(Some("aif0101"), None), &json, None).is_ok());
        // 未来 schema 拒收。
        assert_eq!(
            validate_fetched_skin(&details(Some("aif0101"), Some("2")), &json, None).unwrap_err(),
            "#skinSchemaUnsupported"
        );
        // petId 缺失 / 非法形态。
        assert_eq!(
            validate_fetched_skin(&details(None, Some("1")), &json, None).unwrap_err(),
            "#skinNoPetId"
        );
        assert_eq!(
            validate_fetched_skin(&details(Some("../evil"), Some("1")), &json, None).unwrap_err(),
            "#skinNoPetId"
        );
        // 安装路径的槽位一致性。
        assert_eq!(
            validate_fetched_skin(&details(Some("aif0102"), Some("1")), &json, Some("aif0101"))
                .unwrap_err(),
            "#skinPetIdMismatch"
        );
        // 超大内容拒收。
        let huge = format!("{}{}", json, " ".repeat(MAX_IMPORT_BYTES));
        assert_eq!(
            validate_fetched_skin(&details(Some("aif0101"), Some("1")), &huge, None).unwrap_err(),
            "#skinTooLarge"
        );
        // 坏 JSON。
        assert_eq!(
            validate_fetched_skin(&details(Some("aif0101"), Some("1")), "{broken", None).unwrap_err(),
            "#skinContentInvalid"
        );
    }
}
