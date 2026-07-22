//! Steam 创意工坊（ISteamUGC）—— AI 融合变种形象/名字的全局 UGC 载体。
//!
//! 机制（00-decisions.md「用户拍板(2026-07-14) · Feature 2」+ SkinWorkshop.md 皮肤化
//! 改版 2026-07-18）：每个 AI 变种槽有全局确定性 `petId`（= `fusion_slots::
//! slot_codename`）。生成该槽位的玩家把 `CustomSpeciesEntry`（紧凑参数化 JSON，几 KB）
//! 作为一条创意工坊物品上传（tag `petId`）。**皮肤系统起，「最早发布者胜」从“全局唯一
//! 形象”松弛为“首发皮肤”**：本地 CLI 生成优先、一律发布；同 `petId` 的多条物品都是
//! 合法皮肤（`list_for_pet_id` 全量列出、任一条可安装），`pick_earliest` 只用来标注
//! 「首发」与 CLI 不可用时的兜底复用（`resolve`）。
//!
//! 走高层 `Client::ugc()`（无需 FFI）；回调经 `run_callbacks()` 驱动。**只在 steam.rs
//! 泵线程内串行调用**（与库存同一线程 → 无并发 run_callbacks）。集成开关关闭时整条
//! 路径不触达（调用点在 steam.rs 已 gate）。
//!
//! 纯逻辑（`pick_earliest` / `first_file_id` / `need_next_page` / 内容目录读写）抽出并
//! 单测；真机 UGC 调用（create/submit/query/download）无法在 CI（无 Steam 客户端）
//! 验证，归 WS4/阶段 4 真机联调。

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::{Duration, Instant};
use steamworks::{
    AccountId, AppIDs, AppId, Client, FileType, PublishedFileId, PublishedFileVisibility, SteamId,
    UGCQueryType, UGCType, UserList, UserListOrder,
};

/// 单步 UGC 调用（create/submit/query/download）的回调等待上限。
const UGC_TIMEOUT: Duration = Duration::from_secs(30);
/// `list_for_pet_id` 的翻页上限（Steam 每页 50 条 → 最多 200 条/petId，远超实际）。
const MAX_LIST_PAGES: u32 = 4;
/// Steam UGC 查询固定页大小（kNumUGCResultsPerPage）。
const UGC_PAGE_SIZE: usize = 50;
/// 整批昵称解析的时间预算（拿不到回落 SteamID64 展示，绝不为昵称拖垮列表）。
pub(crate) const PERSONA_BUDGET: Duration = Duration::from_secs(5);
/// 创意工坊 KV 标签键：AI 变种槽全局身份（= slot_codename）。
const PET_ID_TAG: &str = "petId";
/// 内容 schema 版本标签（未来变更 CustomSpeciesEntry 结构时用于兼容判定）。
const SCHEMA_TAG: &str = "gulupetSchema";
const SCHEMA_VERSION: &str = "1";
/// 上传/下载内容目录里的定名文件。
const CONTENT_FILENAME: &str = "species.gulupet.json";

/// 从一批 (time_created, published_file_id) 里取**最早发布**者：`time_created` 最小，
/// 并列时 `published_file_id` 小者胜（收敛、与发布顺序一致）。纯函数，便于单测。
pub fn pick_earliest(candidates: &[(u32, u64)]) -> Option<u64> {
    candidates
        .iter()
        .copied()
        .min_by_key(|(time_created, id)| (*time_created, *id))
        .map(|(_, id)| id)
}

/// 一条工坊物品的查询元数据（owner 保持原始 u64；命令层 DTO 再转字符串防 JS 精度）。
#[derive(Clone, Debug)]
pub struct WorkshopItemMeta {
    pub published_file_id: u64,
    pub owner_steam_id: u64,
    /// 上传者昵称（best-effort：好友/缓存直读，陌生人异步拉取限时预算；拿不到 None）。
    pub owner_persona: Option<String>,
    pub time_created: u32,
    pub title: String,
    pub preview_url: Option<String>,
}

/// 单条物品详情（含 KV 标签；导入/安装前的 petId 一致性校验依据）。
#[derive(Clone, Debug)]
pub struct WorkshopItemDetails {
    pub meta: WorkshopItemMeta,
    /// `petId` KV 标签（= AI 变种槽 codename）。缺失 = 非本游戏物品。
    pub pet_id: Option<String>,
    /// `gulupetSchema` KV 标签（内容格式版本）。
    pub schema: Option<String>,
}

/// 首发判定：与 `pick_earliest` 同口径（time_created 最小，并列 fileId 小者胜）。
pub fn first_file_id(metas: &[WorkshopItemMeta]) -> Option<u64> {
    pick_earliest(
        &metas
            .iter()
            .map(|m| (m.time_created, m.published_file_id))
            .collect::<Vec<_>>(),
    )
}

/// 翻页判定：本页满 50、累计仍少于 total、且未达页数上限时继续下一页。
/// `RankedByPublicationDate` 是新→旧序，**最早（首发）条目在最后一页**——不翻页
/// 会把首发判成后来者。纯函数，便于单测。
pub(crate) fn need_next_page(fetched: usize, page_returned: usize, total: u32, page: u32) -> bool {
    page_returned >= UGC_PAGE_SIZE && fetched < total as usize && page < MAX_LIST_PAGES
}

/// 内容暂存目录：`<temp>/gulugulu-ugc/<codename>`。写入 `species.gulupet.json`，
/// 返回**已存在且可 canonicalize** 的目录（`SetItemContent` 内部会 canonicalize，
/// 先自证一遍避免其 unwrap panic 掀翻泵线程）。
fn write_content_dir(codename: &str, entry_json: &str) -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join("gulugulu-ugc").join(codename);
    fs::create_dir_all(&dir).map_err(|e| format!("建内容目录失败：{e}"))?;
    fs::write(dir.join(CONTENT_FILENAME), entry_json).map_err(|e| format!("写内容文件失败：{e}"))?;
    dir.canonicalize().map_err(|e| format!("内容目录 canonicalize 失败：{e}"))
}

/// 从下载好的安装目录读回 `CustomSpeciesEntry` JSON。先取定名文件，退而求其次扫描
/// 任一 `*.json`（容错不同上传者的文件名）。
fn read_content_dir(folder: &str) -> Result<String, String> {
    let named = Path::new(folder).join(CONTENT_FILENAME);
    if named.is_file() {
        return fs::read_to_string(&named).map_err(|e| format!("读内容文件失败：{e}"));
    }
    let entries = fs::read_dir(folder).map_err(|e| format!("读安装目录失败：{e}"))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            return fs::read_to_string(&path).map_err(|e| format!("读内容文件失败：{e}"));
        }
    }
    Err(format!("安装目录 {folder} 内未找到 JSON 内容"))
}

/// 泵 `run_callbacks()` 直到回调把结果送进 channel 或超时。**必须在持有 client 的
/// 泵线程调用**（与 inv::wait_result 同构）。
fn pump_until<T>(client: &Client, rx: &mpsc::Receiver<T>, timeout: Duration) -> Option<T> {
    let start = Instant::now();
    loop {
        client.run_callbacks();
        match rx.try_recv() {
            Ok(value) => return Some(value),
            Err(mpsc::TryRecvError::Empty) => {}
            Err(mpsc::TryRecvError::Disconnected) => return None,
        }
        if start.elapsed() > timeout {
            return None;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

/// 发布（或抢占）某槽位的 AI 变种形象：CreateItem → StartItemUpdate（title +
/// content + `petId` tag + 公开可见性 + 可选缩略图）→ SubmitItemUpdate。成功返回
/// `(publishedFileId, 需接受创意工坊法律协议)` —— legal 为 true 时物品已创建但对
/// 他人保持隐藏，直到用户在 Steam 接受协议（调用侧应提示用户）。
///
/// `preview_png`：物种设定图（前端离屏渲染缓存，见 commands::cache_species_preview）；
/// None/文件缺失时不带缩略图发布，之后由预览补挂扫描补上。
///
/// 「首个上传者胜」是收敛而非原子锁：并发首发可能产生多条同 `petId`，查询侧按最早
/// 创建者收敛（见 `resolve`），多余副本无害。
pub fn publish(
    client: &Client,
    app_id: u32,
    codename: &str,
    name_zh: &str,
    entry_json: &str,
    preview_png: Option<&Path>,
) -> Result<(u64, bool), String> {
    let dir = write_content_dir(codename, entry_json)?;

    // 1) CreateItem
    let (tx, rx) = mpsc::channel();
    client.ugc().create_item(AppId(app_id), FileType::Community, move |res| {
        let _ = tx.send(res);
    });
    let (published_id, create_needs_legal) = match pump_until(client, &rx, UGC_TIMEOUT) {
        Some(Ok(v)) => v,
        Some(Err(e)) => return Err(format!("CreateItem 失败：{e:?}")),
        None => return Err("CreateItem 超时".to_string()),
    };

    // 2) StartItemUpdate + 元数据 + 内容 + petId 标签 → SubmitItemUpdate。
    //    显式 Public：未接受法律协议时 Steam 会强制隐藏，接受后即公开可查。
    let mut update = client
        .ugc()
        .start_item_update(AppId(app_id), published_id)
        .title(name_zh)
        .content_path(&dir)
        .visibility(PublishedFileVisibility::Public)
        .add_key_value_tag(PET_ID_TAG, codename)
        .add_key_value_tag(SCHEMA_TAG, SCHEMA_VERSION);
    if let Some(png) = preview_png.filter(|p| p.is_file()) {
        update = update.preview_path(png);
    }
    let (tx2, rx2) = mpsc::channel();
    update.submit(Some("gulugulu ai species"), move |res| {
        let _ = tx2.send(res);
    });
    match pump_until(client, &rx2, UGC_TIMEOUT) {
        Some(Ok((id, submit_needs_legal))) => Ok((id.0, create_needs_legal || submit_needs_legal)),
        Some(Err(e)) => {
            if create_needs_legal {
                Err(format!("SubmitItemUpdate 失败（需先在 Steam 接受创意工坊法律协议）：{e:?}"))
            } else {
                Err(format!("SubmitItemUpdate 失败：{e:?}"))
            }
        }
        None => Err("SubmitItemUpdate 超时".to_string()),
    }
}

/// 给**本机发布过**的物品补挂/更新缩略图。带上与首发一致的完整字段（标题/内容/
/// 标签/可见性 + 预览）做同 publishedFileId 的重提交——纯 SetItemPreview 的更新
/// 实测被 Steam 拒（AccessDenied，2026-07-17），完整重提交与首发同构、稳妥。
pub fn update_preview(
    client: &Client,
    app_id: u32,
    published_file_id: u64,
    codename: &str,
    name_zh: &str,
    entry_json: &str,
    preview_png: &Path,
) -> Result<(), String> {
    if !preview_png.is_file() {
        return Err(format!("预览图不存在：{}", preview_png.display()));
    }
    let dir = write_content_dir(codename, entry_json)?;
    let update = client
        .ugc()
        .start_item_update(AppId(app_id), PublishedFileId(published_file_id))
        .title(name_zh)
        .content_path(&dir)
        .visibility(PublishedFileVisibility::Public)
        .add_key_value_tag(PET_ID_TAG, codename)
        .add_key_value_tag(SCHEMA_TAG, SCHEMA_VERSION)
        .preview_path(preview_png);
    let (tx, rx) = mpsc::channel();
    update.submit(Some("attach species preview"), move |res| {
        let _ = tx.send(res);
    });
    match pump_until(client, &rx, UGC_TIMEOUT) {
        Some(Ok(_)) => Ok(()),
        Some(Err(e)) => Err(format!("SubmitItemUpdate(preview) 失败：{e:?}")),
        None => Err("SubmitItemUpdate(preview) 超时".to_string()),
    }
}

/// 拉某 `petId` 的**全部**工坊物品（跨页；皮肤上传者列表数据源）。
/// `RankedByPublicationDate` 新→旧，必须翻到最后一页才能正确标注首发（`need_next_page`）。
/// `persona_budget` > 0 时批量 best-effort 解析上传者昵称（`resolve_personas`）。
pub fn list_for_pet_id(
    client: &Client,
    app_id: u32,
    codename: &str,
    persona_budget: Duration,
) -> Result<Vec<WorkshopItemMeta>, String> {
    let mut metas: Vec<WorkshopItemMeta> = Vec::new();
    let mut page = 1u32;
    loop {
        let query = client
            .ugc()
            .query_all(
                UGCQueryType::RankedByPublicationDate,
                UGCType::Items,
                AppIDs::Both { creator: AppId(app_id), consumer: AppId(app_id) },
                page,
            )
            .map_err(|_| "CreateQueryAll 失败".to_string())?
            .set_return_key_value_tags(true)
            .add_required_key_value_tag(PET_ID_TAG, codename);

        let (tx, rx) = mpsc::channel();
        // QueryResults 的句柄随回调结束释放：get/preview_url 必须在回调**内**读完。
        query.fetch(move |res| {
            let mapped = res.map(|results| {
                let mut page_metas: Vec<WorkshopItemMeta> = Vec::new();
                for i in 0..results.returned_results() {
                    if let Some(r) = results.get(i) {
                        page_metas.push(WorkshopItemMeta {
                            published_file_id: r.published_file_id.0,
                            owner_steam_id: r.owner.raw(),
                            owner_persona: None,
                            time_created: r.time_created,
                            title: r.title,
                            preview_url: results.preview_url(i).filter(|u| !u.is_empty()),
                        });
                    }
                }
                (page_metas, results.total_results())
            });
            let _ = tx.send(mapped);
        });
        let (page_metas, total) = match pump_until(client, &rx, UGC_TIMEOUT) {
            Some(Ok(v)) => v,
            Some(Err(e)) => return Err(format!("查询失败（第 {page} 页）：{e:?}")),
            None => return Err(format!("查询超时（第 {page} 页）")),
        };
        let page_returned = page_metas.len();
        metas.extend(page_metas);
        if !need_next_page(metas.len(), page_returned, total, page) {
            break;
        }
        page += 1;
    }
    if !persona_budget.is_zero() {
        resolve_personas(client, &mut metas, persona_budget);
    }
    Ok(metas)
}

/// 批量 best-effort 解析上传者昵称：好友/本地缓存直读；陌生人发起
/// `RequestUserInformation` 异步拉取，整批共享 `budget` 轮询预算。拿不到保持
/// None（展示层回落 SteamID64）——**绝不因昵称阻塞/失败整个列表**。
fn resolve_personas(client: &Client, metas: &mut [WorkshopItemMeta], budget: Duration) {
    let usable = |name: &str| {
        let trimmed = name.trim();
        !trimmed.is_empty() && trimmed != "[unknown]"
    };
    let mut owners: Vec<u64> = metas.iter().map(|m| m.owner_steam_id).collect();
    owners.sort_unstable();
    owners.dedup();

    let mut resolved: Vec<(u64, String)> = Vec::new();
    let mut pending: Vec<u64> = Vec::new();
    for owner in owners {
        let name = client.friends().get_friend(SteamId::from_raw(owner)).name();
        if usable(&name) {
            resolved.push((owner, name));
        } else {
            // true = 已发起异步拉取；false = Steam 认为信息已在手（再读一次）。
            if !client
                .friends()
                .request_user_information(SteamId::from_raw(owner), true)
            {
                let again = client.friends().get_friend(SteamId::from_raw(owner)).name();
                if usable(&again) {
                    resolved.push((owner, again));
                    continue;
                }
            }
            pending.push(owner);
        }
    }
    let start = Instant::now();
    while !pending.is_empty() && start.elapsed() < budget {
        client.run_callbacks();
        std::thread::sleep(Duration::from_millis(100));
        pending.retain(|owner| {
            let name = client.friends().get_friend(SteamId::from_raw(*owner)).name();
            if usable(&name) {
                resolved.push((*owner, name));
                false
            } else {
                true
            }
        });
    }
    for (owner, name) in resolved {
        for meta in metas.iter_mut() {
            if meta.owner_steam_id == owner {
                meta.owner_persona = Some(name.clone());
            }
        }
    }
}

/// 按 fileId 查单条物品详情（owner/时间/标题 + `petId`/`gulupetSchema` KV 标签）。
pub fn item_details(client: &Client, published_file_id: u64) -> Result<WorkshopItemDetails, String> {
    let query = client
        .ugc()
        .query_item(PublishedFileId(published_file_id))
        .map_err(|_| "CreateQueryUGCDetailsRequest 失败".to_string())?
        .set_return_key_value_tags(true);
    let (tx, rx) = mpsc::channel();
    query.fetch(move |res| {
        let mapped = res.map(|results| {
            results.get(0).map(|r| {
                let mut pet_id = None;
                let mut schema = None;
                for kv in 0..results.key_value_tags(0) {
                    if let Some((key, value)) = results.get_key_value_tag(0, kv) {
                        match key.as_str() {
                            PET_ID_TAG => pet_id = Some(value),
                            SCHEMA_TAG => schema = Some(value),
                            _ => {}
                        }
                    }
                }
                WorkshopItemDetails {
                    meta: WorkshopItemMeta {
                        published_file_id: r.published_file_id.0,
                        owner_steam_id: r.owner.raw(),
                        owner_persona: None,
                        time_created: r.time_created,
                        title: r.title,
                        preview_url: results.preview_url(0).filter(|u| !u.is_empty()),
                    },
                    pet_id,
                    schema,
                }
            })
        });
        let _ = tx.send(mapped);
    });
    match pump_until(client, &rx, UGC_TIMEOUT) {
        Some(Ok(Some(details))) => Ok(details),
        Some(Ok(None)) => Err(format!("物品不存在或不可见：{published_file_id}")),
        Some(Err(e)) => Err(format!("查询物品详情失败：{e:?}")),
        None => Err("查询物品详情超时".to_string()),
    }
}

/// 下载 + 等安装 + 读内容（`resolve`/`fetch_item` 共用尾段）。
fn fetch_item_content(client: &Client, pfid: PublishedFileId) -> Result<String, String> {
    if !client.ugc().download_item(pfid, true) {
        return Err("DownloadItem 未启动（物品无效或未订阅工坊）".to_string());
    }
    let folder = match wait_installed(client, pfid, UGC_TIMEOUT) {
        Some(folder) => folder,
        None => return Err("下载超时".to_string()),
    };
    read_content_dir(&folder)
}

/// 按 fileId 一把抓：详情（petId 校验依据）+ 内容 JSON + best-effort 上传者昵称。
/// 皮肤安装/分享导入的统一入口。
pub fn fetch_item(
    client: &Client,
    published_file_id: u64,
) -> Result<(WorkshopItemDetails, String), String> {
    let mut details = item_details(client, published_file_id)?;
    let entry_json = fetch_item_content(client, PublishedFileId(published_file_id))?;
    // 单条昵称解析复用批量助手（预算小：一人份）。
    let mut metas = [details.meta.clone()];
    resolve_personas(client, &mut metas, Duration::from_secs(2));
    details.meta.owner_persona = metas[0].owner_persona.clone();
    Ok((details, entry_json))
}

/// 查询某 `petId` 的首发形象（CLI 不可用/生成失败的兜底复用路径）：全量列出 →
/// `pick_earliest` → 下载读回内容与详情。无人认领返回 `Ok(None)`。
pub fn resolve(
    client: &Client,
    app_id: u32,
    codename: &str,
) -> Result<Option<(WorkshopItemDetails, String)>, String> {
    let metas = list_for_pet_id(client, app_id, codename, Duration::ZERO)?;
    let Some(file_id) = first_file_id(&metas) else {
        return Ok(None); // 无人认领
    };
    let (details, entry_json) = fetch_item(client, file_id)?;
    Ok(Some((details, entry_json)))
}

/// 列出**当前登录账号**在本 App 名下发布的全部工坊物品 fileId（跨页收敛）。
/// 数据源 `query_user(Published)` 已按账号过滤；`owner_steam_id` 再做一次 owner
/// 校验（删除不可逆 → 只收本账号 owner 的物品，双保险）。纯查询、无副作用。
/// 翻页判定复用 `need_next_page`（≤4 页 = 200 件，远超本账号实际自传数）。
fn list_owned_published(
    client: &Client,
    app_id: u32,
    account: AccountId,
    owner_steam_id: u64,
) -> Result<Vec<u64>, String> {
    let mut ids: Vec<u64> = Vec::new();
    let mut fetched = 0usize;
    let mut page = 1u32;
    loop {
        let query = client
            .ugc()
            .query_user(
                account,
                UserList::Published,
                UGCType::Items,
                UserListOrder::CreationOrderAsc,
                AppIDs::Both { creator: AppId(app_id), consumer: AppId(app_id) },
                page,
            )
            .map_err(|_| "CreateQueryUserUGCRequest 失败".to_string())?;

        let (tx, rx) = mpsc::channel();
        // QueryResults 句柄随回调结束释放：published_file_id/owner 必须在回调内读完。
        query.fetch(move |res| {
            let mapped = res.map(|results| {
                let mut rows: Vec<(u64, u64)> = Vec::new(); // (published_file_id, owner)
                for i in 0..results.returned_results() {
                    if let Some(r) = results.get(i) {
                        rows.push((r.published_file_id.0, r.owner.raw()));
                    }
                }
                (rows, results.total_results())
            });
            let _ = tx.send(mapped);
        });
        let (rows, total) = match pump_until(client, &rx, UGC_TIMEOUT) {
            Some(Ok(v)) => v,
            Some(Err(e)) => return Err(format!("查询本账号工坊物品失败（第 {page} 页）：{e:?}")),
            None => return Err(format!("查询本账号工坊物品超时（第 {page} 页）")),
        };
        let page_returned = rows.len();
        fetched += page_returned;
        for (file_id, owner) in rows {
            if owner == owner_steam_id {
                ids.push(file_id);
            }
        }
        if !need_next_page(fetched, page_returned, total, page) {
            break;
        }
        page += 1;
    }
    Ok(ids)
}

/// 删除**当前登录账号**在本 App 名下发布的全部创意工坊物品（逐件 `DeleteItem`）。
/// 返回 `(deleted, failed)`：成功删除数 / 失败数（单条失败记 eprintln 并计入 failed，
/// 不中断其余删除）。
///
/// **不可逆**（`DeleteItem` 从工坊永久移除物品）。客户端 API 只能删本账号自己的物品
/// ——别的测试账号须各自登录后再跑（00-decisions.md「无 Web API key」下无跨账号删除）。
/// 真机 UGC 调用无法在 CI（无 Steam 客户端）验证，归 WS4/阶段 4 真机联调。
pub fn delete_all_owned(
    client: &Client,
    app_id: u32,
    account: AccountId,
    owner_steam_id: u64,
) -> Result<(usize, usize), String> {
    let ids = list_owned_published(client, app_id, account, owner_steam_id)?;
    let mut deleted = 0usize;
    let mut failed = 0usize;
    for file_id in ids {
        let (tx, rx) = mpsc::channel();
        client.ugc().delete_item(PublishedFileId(file_id), move |res| {
            let _ = tx.send(res);
        });
        match pump_until(client, &rx, UGC_TIMEOUT) {
            Some(Ok(())) => deleted += 1,
            Some(Err(e)) => {
                eprintln!("[workshop] DeleteItem({file_id}) 失败：{e:?}");
                failed += 1;
            }
            None => {
                eprintln!("[workshop] DeleteItem({file_id}) 超时");
                failed += 1;
            }
        }
    }
    Ok((deleted, failed))
}

/// 轮询 `item_install_info`（返回 Some 即已安装到磁盘），泵 run_callbacks 推进下载。
fn wait_installed(client: &Client, item: PublishedFileId, timeout: Duration) -> Option<String> {
    let start = Instant::now();
    loop {
        client.run_callbacks();
        if let Some(info) = client.ugc().item_install_info(item) {
            if !info.folder.is_empty() {
                return Some(info.folder);
            }
        }
        if start.elapsed() > timeout {
            return None;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pick_earliest_by_time_then_id() {
        // 单个。
        assert_eq!(pick_earliest(&[(100, 9)]), Some(9));
        // 时间更早者胜（与 id 无关）。
        assert_eq!(pick_earliest(&[(200, 1), (100, 9), (150, 2)]), Some(9));
        // 时间并列 → id 小者胜。
        assert_eq!(pick_earliest(&[(100, 8), (100, 3), (100, 5)]), Some(3));
        // 空 → None（= 无人认领）。
        assert_eq!(pick_earliest(&[]), None);
    }

    fn meta(time_created: u32, id: u64) -> WorkshopItemMeta {
        WorkshopItemMeta {
            published_file_id: id,
            owner_steam_id: 76_561_190_000_000_000 + id,
            owner_persona: None,
            time_created,
            title: format!("item-{id}"),
            preview_url: None,
        }
    }

    #[test]
    fn first_file_id_matches_pick_earliest() {
        // 时间更早者胜；并列 id 小者胜；空 = 无人认领。
        assert_eq!(first_file_id(&[meta(200, 1), meta(100, 9), meta(150, 2)]), Some(9));
        assert_eq!(first_file_id(&[meta(100, 8), meta(100, 3)]), Some(3));
        assert_eq!(first_file_id(&[]), None);
    }

    #[test]
    fn need_next_page_boundaries() {
        // 本页不满 50 → 已到尾页，停。
        assert!(!need_next_page(30, 30, 80, 1));
        // 满页且累计 < total → 继续。
        assert!(need_next_page(50, 50, 80, 1));
        // 满页但累计已达 total → 停（total 恰为页大小整数倍的尾页）。
        assert!(!need_next_page(100, 50, 100, 2));
        // 页数上限 → 停（防失控翻页）。
        assert!(!need_next_page(200, 50, 999, MAX_LIST_PAGES));
    }

    #[test]
    fn content_dir_write_then_read_roundtrips() {
        let codename = "aif9901"; // 测试专用；不与真实序号冲突（序号≤56）。
        let json = r#"{"info":{"nameZh":"测试"},"parents":["a","b"]}"#;
        let dir = write_content_dir(codename, json).expect("write");
        assert!(dir.join(CONTENT_FILENAME).is_file());
        let read = read_content_dir(dir.to_str().unwrap()).expect("read");
        assert_eq!(read, json);
        let _ = fs::remove_dir_all(dir); // 清理
    }

    #[test]
    fn read_content_dir_falls_back_to_any_json() {
        let dir = std::env::temp_dir().join("gulugulu-ugc-test-fallback");
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("whatever.json"), "{\"k\":1}").unwrap();
        let read = read_content_dir(dir.to_str().unwrap()).expect("read fallback");
        assert_eq!(read, "{\"k\":1}");
        let _ = fs::remove_dir_all(&dir);
    }
}
