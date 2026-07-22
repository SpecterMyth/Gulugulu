//! Steam 生命周期 + 泵线程 + IPC（02-rust-core.md C2/C3）。
//!
//! - `init` 在 setup 钩子调用一次：`Client::init_app(4956830)` 失败 →
//!   `unavailable` 优雅降级（GitHub 分发版无 Steam 照常跑）。
//!   **不调 RestartAppIfNecessary**（00-decisions.md）。
//! - 泵线程串行处理一切 Steam 操作（每操作内部轮询结果句柄，间隙跑
//!   run_callbacks）：命令请求 → 60s outbox 巡检（意图探测→认领→单飞重试
//!   MintTier1）→ 5min 对账。低频操作 + 全串行 = 无并发窗口。
//! - 死锁红线：任何线程不得持存档锁等 channel —— 命令三段式保证。

use crate::game::{self, GameSave, SharedGameState, SteamOp};
use crate::steam_cloud::{self, CloudAction};
use crate::steam_inventory::{self as inv, GrantedItem, OpOutcome};
use crate::steam_sync::{self, SnapItem};
use crate::steam_workshop;
use serde::Serialize;
use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

pub const STEAM_APP_ID: u32 = 4956830;

/// Steam 集成总开关的编译期默认值。
/// 【2026-07-16 用户指示】本地调试结束，重新打开 Steam 联调（含创意工坊上传）；
/// 临时关闭用运行时 env `GULUGULU_STEAM=0`（免重编）。
/// （2026-07-12 曾默认关闭走纯本地逻辑；重开后存量未同步 Steam 宠物由 migration_sweep
/// 自动补入发放队列、存量 AI 形象由 spawn_workshop_backfill 补传创意工坊。）
const STEAM_DEFAULT_ENABLED: bool = true;

/// Steam 集成是否启用：env `GULUGULU_STEAM`（1/true/on 开，0/false/off 关）
/// 优先，未设置时用编译期默认值。
pub fn integration_enabled() -> bool {
    match std::env::var("GULUGULU_STEAM") {
        Ok(value) => matches!(value.to_ascii_lowercase().as_str(), "1" | "true" | "on"),
        Err(_) => STEAM_DEFAULT_ENABLED,
    }
}
/// 结果句柄轮询上限；命令侧等待 = 此值 + 5s 余量。
const OP_TIMEOUT: Duration = Duration::from_secs(15);
const COMMAND_TIMEOUT: Duration = Duration::from_secs(20);
/// 创意工坊单操作可能串两段回调（create+submit）、查询+下载轮询，或多页列表
/// （≤4 页 × 30s 单步超时 + 5s 昵称预算），给足余量。
const WORKSHOP_TIMEOUT: Duration = Duration::from_secs(150);
/// 宽限集窗口：近期操作过的物品 id 不被对账剪除/导入。
const GRACE_WINDOW: Duration = Duration::from_secs(30);
const OUTBOX_INTERVAL: Duration = Duration::from_secs(60);
const RECONCILE_INTERVAL: Duration = Duration::from_secs(300);
/// 云存档周期推送间隔：本地任何落盘后最迟这么久上云（读磁盘按内容哈希判变化，未变不推）。
const CLOUD_PUSH_INTERVAL: Duration = Duration::from_secs(30);
/// 重连节奏：Steam 冷启动约十几秒，前几次密集试探，之后退成常驻慢轮询。
/// 慢档 15s = 用户开 Steam 后最迟 15s 自动接上，无需重启 app。
const RECONNECT_FAST_ATTEMPTS: u32 = 6;
const RECONNECT_FAST_DELAY: Duration = Duration::from_secs(3);
const RECONNECT_DELAY: Duration = Duration::from_secs(15);
/// 连不上时的日志节流：首次必打，之后每 20 次（≈5min）一条，免刷屏。
const RECONNECT_LOG_EVERY: u32 = 20;
/// 泵线程探活间隔；连续 2 次探测不到才判掉线（躲开偶发假阴性）。
const LIVENESS_INTERVAL: Duration = Duration::from_secs(5);
const LIVENESS_STRIKES: u32 = 2;
/// 连上不到这么久就判掉线 = 可疑（探活假阴性 / Steam 反复重启）：退避一档再连，
/// 兜底保证最坏情况是慢速抖动而非重连风暴。
const FLAP_WINDOW: Duration = Duration::from_secs(60);

#[derive(Clone, Debug)]
pub enum SteamCall {
    GetAll,
    TriggerDrop { def: u32 },
    Exchange { generate_def: u32, destroy: Vec<u64> },
    Consume { item_id: u64 },
    /// 拆栈：从堆叠拆 1 个到新实例（绑定前置，A5 实证掉落会自动堆叠）。
    SplitOne { item_id: u64 },
    /// 仅开发期（GenerateItems 在正式版失效）。
    Generate { defs: Vec<u32> },
    /// 立即跑一轮 outbox + 对账。
    SyncNow,
    /// 成就上报（非库存操作）：逐条 SetAchievement + StoreStats（幂等，fire-and-forget）。
    /// SteamAchievements.md §4.2。
    UnlockAchievements { ids: Vec<String> },
    /// 立即推一轮云存档（三件套写云）。手动同步 / 退出前 flush / 清档夺权用。
    /// 泵循环特判（不走 perform）：把周期推送计时器拨到即时，本轮 cloud_push_pass 就执行。
    /// SteamCloudSync.md。
    CloudPush,
}

pub struct SteamRequest {
    pub call: SteamCall,
    pub reply: Sender<OpOutcome>,
    /// 调用方放弃回复的时限（call_blocking 设 now+COMMAND_TIMEOUT）。泵在出队时若已过期，
    /// 直接回 Uncertain 而**不执行**该 Steam 变更——否则一个 150s 的工坊 op 会拖到调用方
    /// 20s 早已放弃后才执行 TriggerDrop，让商店蛋重复发放（review 第 4 项）。
    /// fire-and-forget 的 SyncNow/成就上报为 None（必须执行，不设时限）。
    pub deadline: Option<Instant>,
}

/// 创意工坊（AI 变种形象 UGC）操作 —— 与库存同走泵线程串行（steam_workshop.rs）。
#[derive(Clone, Debug)]
pub enum WorkshopOp {
    /// 发布/抢占某槽位形象：codename=petId，name_zh 标题，entry_json 内容，
    /// preview_png=设定图缩略图（缺失则无图发布，之后补挂）。
    Publish {
        codename: String,
        name_zh: String,
        entry_json: String,
        preview_png: Option<std::path::PathBuf>,
    },
    /// 查询某槽位的首发形象（最早发布者；CLI 不可用/失败的兜底复用）。
    Resolve { codename: String },
    /// 给本机发布过的物品补挂设定图缩略图（同 id 完整重提交，含内容/标签/预览）。
    UpdatePreview {
        published_file_id: u64,
        codename: String,
        name_zh: String,
        entry_json: String,
        preview_png: std::path::PathBuf,
    },
    /// 列出某 petId 的**全部**工坊物品（跨页 + best-effort 上传者昵称；皮肤上传者列表）。
    ListForPetId { codename: String },
    /// 按 fileId 拉详情 + 下载内容（皮肤安装/分享导入）。
    FetchItem { published_file_id: u64 },
    /// 开发期：删除本账号在本 App 名下发布的**全部**工坊物品（逐件 DeleteItem；不可逆）。
    DeleteAllOwned,
}

#[derive(Clone, Debug)]
pub enum WorkshopReply {
    Published {
        published_file_id: u64,
        /// true = 用户尚未接受创意工坊法律协议，物品已建但对他人隐藏。
        needs_legal_agreement: bool,
    },
    /// 首发形象：`(详情, 内容 JSON)`；无人认领 = None。
    Resolved(Option<(steam_workshop::WorkshopItemDetails, String)>),
    PreviewUpdated,
    Listing(Vec<steam_workshop::WorkshopItemMeta>),
    ItemFetched {
        details: steam_workshop::WorkshopItemDetails,
        entry_json: String,
    },
    /// 清空本账号工坊：`deleted` 成功删除数、`failed` 删除失败数。
    AllDeleted { deleted: usize, failed: usize },
    Failed(String),
}

pub struct WorkshopRequest {
    pub op: WorkshopOp,
    pub reply: Sender<WorkshopReply>,
}

/// `debug_steam_delete_all_workshop` 的返回体（mirrored in src/game/bridge.ts）。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkshopClearReport {
    /// 成功删除的工坊物品数。
    pub deleted: usize,
    /// 删除失败的物品数（详见后端日志）。
    pub failed: usize,
}

/// steam://status 事件载荷（mirrored in src/types.ts — keep both sides in sync）。
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamStatus {
    /// "connected" | "unavailable" | "disabled"（disabled = 集成总开关关闭，
    /// 全部玩法走纯本地逻辑）。
    pub mode: String,
    pub pending_mints: usize,
    /// 本地先行放生后待 ConsumeItem 收敛的只数（后台限频重试中）。
    pub pending_releases: usize,
    pub unclaimed_imports: usize,
    pub owner_mismatch: bool,
    pub last_sync_at: Option<i64>,
    pub steam_id: Option<String>,
    pub app_id: u32,
    /// 创意工坊上传成功但用户尚未接受《创意工坊法律协议》（物品对他人隐藏），
    /// 前端据此提示去 steamcommunity.com/sharedfiles/workshoplegalagreement 接受。
    pub workshop_legal_pending: bool,
    /// Steam 云存档是否可用（应用级 && 账号级都开）。false = 用户在 Steam 关了云
    /// 或后台未配额；此时不推不拉，全走本地。SteamCloudSync.md。
    pub cloud_enabled: bool,
    /// 最近一次云同步（推或拉成功）的时刻（秒）；从未同步为 None。
    pub last_cloud_sync_at: Option<i64>,
    /// 云端存档三件套总字节（诊断展示）。
    pub cloud_bytes: Option<u64>,
}

pub struct SteamStateInner {
    pub tx: Mutex<Option<Sender<SteamRequest>>>,
    /// 创意工坊请求通道（发布/查询 AI 变种形象），与 `tx` 同由泵线程消费。
    pub workshop_tx: Mutex<Option<Sender<WorkshopRequest>>>,
    pub status: Mutex<SteamStatus>,
    pub unclaimed: Mutex<Vec<SnapItem>>,
    /// 成就 toast 去重集（None = 尚未播种；首个 with_save 播种当前已达成、不弹）。
    /// SteamAchievements.md §4.2/§4.3。
    pub reported_achievements: Mutex<Option<std::collections::BTreeSet<String>>>,
    /// 连上 Steam 后是否已做过一次性全量回填（set 所有已达成，幂等）。
    pub achievements_backfilled: Mutex<bool>,
}

#[derive(Clone)]
pub struct SharedSteamState(Arc<SteamStateInner>);

impl SharedSteamState {
    pub fn new() -> Self {
        SharedSteamState(Arc::new(SteamStateInner {
            tx: Mutex::new(None),
            workshop_tx: Mutex::new(None),
            status: Mutex::new(SteamStatus {
                mode: "unavailable".to_string(),
                app_id: STEAM_APP_ID,
                ..SteamStatus::default()
            }),
            unclaimed: Mutex::new(Vec::new()),
            reported_achievements: Mutex::new(None),
            achievements_backfilled: Mutex::new(false),
        }))
    }

    pub fn snapshot(&self) -> SteamStatus {
        self.0.status.lock().map(|s| s.clone()).unwrap_or_default()
    }

    pub fn is_connected(&self) -> bool {
        self.0
            .status
            .lock()
            .map(|s| s.mode == "connected" && !s.owner_mismatch)
            .unwrap_or(false)
    }

    pub fn owner_mismatch(&self) -> bool {
        self.0.status.lock().map(|s| s.owner_mismatch).unwrap_or(false)
    }

    fn update_status(&self, app: &AppHandle, mutate: impl FnOnce(&mut SteamStatus)) {
        if let Ok(mut status) = self.0.status.lock() {
            mutate(&mut status);
            let _ = app.emit("steam://status", status.clone());
        }
    }

    /// Steam 掉线：摘掉命令通道（新命令立刻失败而不是排队进死泵）并回落
    /// unavailable，随后由 `init` 的重连循环自动接回。
    fn detach(&self, app: &AppHandle) {
        if let Ok(mut guard) = self.0.tx.lock() {
            *guard = None;
        }
        if let Ok(mut guard) = self.0.workshop_tx.lock() {
            *guard = None;
        }
        self.update_status(app, |s| {
            s.mode = "unavailable".to_string();
            s.steam_id = None;
        });
    }

    /// 非阻塞触发一轮立即同步（fire-and-forget）：丢一个 SyncNow 进泵线程后不等回复
    /// ——放生等「本地先行」操作用它加速后台收敛；泵忙/未连接时静默失败，60s 巡检兜底。
    pub fn kick_sync(&self) {
        let tx = match self.0.tx.lock() {
            Ok(guard) => guard.clone(),
            Err(_) => None,
        };
        if let Some(tx) = tx {
            let (reply_tx, _discarded_rx) = mpsc::channel();
            let _ = tx.send(SteamRequest {
                call: SteamCall::SyncNow,
                reply: reply_tx,
                deadline: None,
            });
        }
    }

    /// 立即推一轮云存档（fire-and-forget，仿 kick_sync）：丢 CloudPush 进泵后不等回复。
    /// 手动同步按钮 / 前端关闭前 flush / `debug_clear_save` 清档夺权用；泵忙 / 未连接时
    /// 静默失败，30s 周期推送兜底。可在持存档锁下安全调用（只发不等 channel）。
    pub fn cloud_push_now(&self) {
        let tx = match self.0.tx.lock() {
            Ok(guard) => guard.clone(),
            Err(_) => None,
        };
        if let Some(tx) = tx {
            let (reply_tx, _discarded_rx) = mpsc::channel();
            let _ = tx.send(SteamRequest {
                call: SteamCall::CloudPush,
                reply: reply_tx,
                deadline: None,
            });
        }
    }

    /// 成就上报（fire-and-forget，仿 kick_sync；可在持存档锁下安全调用——只发不等）：
    /// 把待解锁 ID 丢给泵线程做 SetAchievement + StoreStats。泵忙/未连接时静默失败。
    pub fn report_unlocks(&self, ids: Vec<String>) {
        if ids.is_empty() {
            return;
        }
        let tx = match self.0.tx.lock() {
            Ok(guard) => guard.clone(),
            Err(_) => None,
        };
        if let Some(tx) = tx {
            let (reply_tx, _discarded_rx) = mpsc::channel();
            let _ = tx.send(SteamRequest {
                call: SteamCall::UnlockAchievements { ids },
                reply: reply_tx,
                deadline: None,
            });
        }
    }

    /// 成就 toast 去重：首次调用**播种**当前已达成集（返回空、不弹）；之后返回本次**新**
    /// 达成的 ID 并记入已报集。内存态，配合连上回填保证幂等（SteamAchievements.md §4.2）。
    pub fn diff_new_achievements(
        &self,
        satisfied: &std::collections::BTreeSet<&'static str>,
    ) -> Vec<String> {
        let mut guard = match self.0.reported_achievements.lock() {
            Ok(g) => g,
            Err(_) => return Vec::new(),
        };
        match guard.as_mut() {
            None => {
                *guard = Some(satisfied.iter().map(|s| s.to_string()).collect());
                Vec::new()
            }
            Some(reported) => {
                let mut new_ids = Vec::new();
                for id in satisfied {
                    if reported.insert(id.to_string()) {
                        new_ids.push(id.to_string());
                    }
                }
                new_ids
            }
        }
    }

    /// 连上 Steam 后的一次性全量回填：仅当**已连接且尚未回填**时返回全部已达成 ID（供
    /// SetAchievement 幂等重设 —— 覆盖老档/开关后开/换机；不弹前端）。之后恒返回 None。
    pub fn take_achievement_backfill(
        &self,
        satisfied: &std::collections::BTreeSet<&'static str>,
    ) -> Option<Vec<String>> {
        if !self.is_connected() {
            return None;
        }
        let mut done = self.0.achievements_backfilled.lock().ok()?;
        if *done {
            return None;
        }
        *done = true;
        Some(satisfied.iter().map(|s| s.to_string()).collect())
    }

    /// 命令侧同步调用：发请求给泵线程并等待（不得持任何锁调用）。
    pub fn call_blocking(&self, call: SteamCall) -> OpOutcome {
        let tx = match self.0.tx.lock() {
            Ok(guard) => guard.clone(),
            Err(_) => None,
        };
        let Some(tx) = tx else {
            return OpOutcome::Failed("#steamNotConnected".to_string());
        };
        let (reply_tx, reply_rx) = mpsc::channel();
        let request = SteamRequest {
            call,
            reply: reply_tx,
            deadline: Some(Instant::now() + COMMAND_TIMEOUT),
        };
        if tx.send(request).is_err() {
            return OpOutcome::Failed("#steamPumpExited".to_string());
        }
        reply_rx.recv_timeout(COMMAND_TIMEOUT).unwrap_or(OpOutcome::Uncertain)
    }

    /// 创意工坊同步调用：发请求给泵线程并等待（不得持存档锁调用）。
    fn workshop_blocking(&self, op: WorkshopOp) -> WorkshopReply {
        let tx = match self.0.workshop_tx.lock() {
            Ok(guard) => guard.clone(),
            Err(_) => None,
        };
        let Some(tx) = tx else {
            return WorkshopReply::Failed("Steam 未连接".to_string());
        };
        let (reply_tx, reply_rx) = mpsc::channel();
        if tx.send(WorkshopRequest { op, reply: reply_tx }).is_err() {
            return WorkshopReply::Failed("Steam 泵线程已退出".to_string());
        }
        reply_rx
            .recv_timeout(WORKSHOP_TIMEOUT)
            .unwrap_or_else(|_| WorkshopReply::Failed("创意工坊操作超时".to_string()))
    }

    /// 发布/抢占某槽位 AI 变种形象（petId=codename）。返回
    /// `(publishedFileId, 需接受法律协议)` 或错误。
    pub fn publish_species(
        &self,
        codename: &str,
        name_zh: &str,
        entry_json: &str,
        preview_png: Option<std::path::PathBuf>,
    ) -> Result<(u64, bool), String> {
        match self.workshop_blocking(WorkshopOp::Publish {
            codename: codename.to_string(),
            name_zh: name_zh.to_string(),
            entry_json: entry_json.to_string(),
            preview_png,
        }) {
            WorkshopReply::Published { published_file_id, needs_legal_agreement } => {
                Ok((published_file_id, needs_legal_agreement))
            }
            WorkshopReply::Failed(error) => Err(error),
            _ => Err("创意工坊返回了意外的回复".to_string()),
        }
    }

    /// 给本机发布过的物品补挂设定图缩略图（同 id 完整重提交）。
    pub fn update_species_preview(
        &self,
        published_file_id: u64,
        codename: &str,
        name_zh: &str,
        entry_json: &str,
        preview_png: std::path::PathBuf,
    ) -> Result<(), String> {
        match self.workshop_blocking(WorkshopOp::UpdatePreview {
            published_file_id,
            codename: codename.to_string(),
            name_zh: name_zh.to_string(),
            entry_json: entry_json.to_string(),
            preview_png,
        }) {
            WorkshopReply::PreviewUpdated => Ok(()),
            WorkshopReply::Failed(error) => Err(error),
            _ => Err("创意工坊返回了意外的回复".to_string()),
        }
    }

    /// 标记/清除「创意工坊法律协议待接受」状态并广播给前端。
    pub fn set_workshop_legal_pending(&self, app: &AppHandle, pending: bool) {
        self.update_status(app, |s| s.workshop_legal_pending = pending);
    }

    /// 查询某槽位 AI 变种的**首发**形象（详情 + 内容 JSON；无人认领 → `Ok(None)`）。
    pub fn resolve_species(
        &self,
        codename: &str,
    ) -> Result<Option<(steam_workshop::WorkshopItemDetails, String)>, String> {
        match self.workshop_blocking(WorkshopOp::Resolve { codename: codename.to_string() }) {
            WorkshopReply::Resolved(hit) => Ok(hit),
            WorkshopReply::Failed(error) => Err(error),
            _ => Err("创意工坊返回了意外的回复".to_string()),
        }
    }

    /// 列出某 petId 的全部工坊上传（跨页 + best-effort 昵称；皮肤上传者列表数据源）。
    pub fn list_species_uploads(
        &self,
        codename: &str,
    ) -> Result<Vec<steam_workshop::WorkshopItemMeta>, String> {
        match self.workshop_blocking(WorkshopOp::ListForPetId { codename: codename.to_string() }) {
            WorkshopReply::Listing(metas) => Ok(metas),
            WorkshopReply::Failed(error) => Err(error),
            _ => Err("创意工坊返回了意外的回复".to_string()),
        }
    }

    /// 按 fileId 拉单条物品的详情 + 内容 JSON（皮肤安装/分享导入）。
    pub fn fetch_species_item(
        &self,
        published_file_id: u64,
    ) -> Result<(steam_workshop::WorkshopItemDetails, String), String> {
        match self.workshop_blocking(WorkshopOp::FetchItem { published_file_id }) {
            WorkshopReply::ItemFetched { details, entry_json } => Ok((details, entry_json)),
            WorkshopReply::Failed(error) => Err(error),
            _ => Err("创意工坊返回了意外的回复".to_string()),
        }
    }

    /// 开发期：删除本账号在本 App 名下发布的全部工坊物品。返回 `(deleted, failed)`。
    pub fn delete_all_owned_species(&self) -> Result<(usize, usize), String> {
        match self.workshop_blocking(WorkshopOp::DeleteAllOwned) {
            WorkshopReply::AllDeleted { deleted, failed } => Ok((deleted, failed)),
            WorkshopReply::Failed(error) => Err(error),
            _ => Err("创意工坊返回了意外的回复".to_string()),
        }
    }
}

pub fn new_shared_state() -> SharedSteamState {
    SharedSteamState::new()
}

/// setup 钩子入口：拉起「连接 → 泵 → 掉线重连」常驻线程。
///
/// 【2026-07-20】原来是一次性 init：启动那一刻 Steam 没开就永久 unavailable，
/// 用户之后开了 Steam 也接不上（融合只会报「需要连接 Steam」直到重启 app）。
/// 现在连不上就常驻重试、连上后探活，Steam 后开 / 自更新重启都自动接回。
pub fn init(app: AppHandle, game_state: SharedGameState, steam_state: SharedSteamState) {
    if !integration_enabled() {
        eprintln!("[steam] integration disabled (GULUGULU_STEAM / STEAM_DEFAULT_ENABLED) — local mode");
        steam_state.update_status(&app, |s| s.mode = "disabled".to_string());
        return;
    }
    std::thread::spawn(move || loop {
        let client = connect_with_retry(&app, &steam_state);
        let steam_id = client.user().steam_id().raw().to_string();

        // owner 校验：首连打点；不匹配则挂 ownerMismatch，等用户确认重绑。
        // 每次（重）连都重跑 —— Steam 可能是换个账号重开的。
        let owner_mismatch = {
            let result = game::with_save(&app, &game_state, |_config, save| {
                match &save.steam_owner_id {
                    None => {
                        save.steam_owner_id = Some(steam_id.clone());
                        Ok(false)
                    }
                    Some(owner) if *owner == steam_id => Ok(false),
                    Some(_) => Ok(true),
                }
            });
            result.map(|(mismatch, _)| mismatch).unwrap_or(false)
        };

        let (tx, rx) = mpsc::channel::<SteamRequest>();
        if let Ok(mut guard) = steam_state.0.tx.lock() {
            *guard = Some(tx);
        }
        let (workshop_tx, workshop_rx) = mpsc::channel::<WorkshopRequest>();
        if let Ok(mut guard) = steam_state.0.workshop_tx.lock() {
            *guard = Some(workshop_tx);
        }
        steam_state.update_status(&app, |s| {
            s.mode = "connected".to_string();
            s.steam_id = Some(steam_id.clone());
            s.owner_mismatch = owner_mismatch;
        });

        // 迁移扫描：存量未绑定一阶宠物补入 mint 队列（owner 正常时）。
        // 重连后照跑：两者都幂等，正好把掉线期间新增的宠物补进队列。
        // 同时跑存量二阶修复：旧教学纯本地融合遗留的未同步 Steam二阶宠，若后院有匹配材料 →
        // 排 Fuse{applied} 由泵烧材料 + 铸该宠物品回绑（幂等，无匹配材料则不动）。
        if !owner_mismatch {
            // 先与 Steam 云存档对账（较新者胜；采纳云端前先备份本地三件套）。放在迁移扫描
            // 之前：这样后续 migration_sweep/repair 跑在「最终存档」上（无论采纳云还是留本地）。
            cloud_pull_reconcile(&app, &game_state, &steam_state, &client);
            let changed = game::with_save(&app, &game_state, |config, save| {
                let mut changed = steam_sync::migration_sweep(config, save);
                // 早期把跨物种融合 op 误指向 canonical 物种 def（601-657）→ 兑换卡死；重指并集生成器。
                changed |= steam_sync::retarget_cross_species_fuse_ops(config, save);
                changed |= steam_sync::repair_unbound_tier2(config, save);
                Ok(changed)
            });
            if let Ok((true, save)) = changed {
                let _ = app.emit("game://state", save);
            }
            // 存量 AI 变种形象补传创意工坊（另起线程经泵线程串行执行，不阻塞启动）。
            crate::fusion_gen::spawn_workshop_backfill(
                app.clone(),
                game_state.clone(),
                steam_state.clone(),
            );
        }

        // 只有探活判定 Steam 没了才返回；正常情况下常驻不退。
        let connected_at = Instant::now();
        pump_loop(
            app.clone(),
            game_state.clone(),
            steam_state.clone(),
            &client,
            rx,
            workshop_rx,
        );
        let uptime = connected_at.elapsed();

        // 先摘通道 + 标 unavailable，再 drop client（Drop = SteamAPI_Shutdown），
        // 然后回到循环顶部重连 —— 期间所有玩法照常走「未连接」分支。
        eprintln!("[steam] client disappeared after {uptime:?} — dropping connection, will reconnect");
        steam_state.detach(&app);
        drop(client);
        if uptime < FLAP_WINDOW {
            std::thread::sleep(RECONNECT_DELAY);
        }
    });
}

/// 连接 Steam：连不上就按 fast→slow 节奏一直重试（Steam 比 app 晚开的常态）。
fn connect_with_retry(app: &AppHandle, steam_state: &SharedSteamState) -> steamworks::Client {
    let mut attempt: u32 = 0;
    loop {
        match steamworks::Client::init_app(STEAM_APP_ID) {
            Ok(client) => {
                if attempt > 0 {
                    eprintln!("[steam] connected after {attempt} retries");
                }
                return client;
            }
            Err(error) => {
                if attempt == 0 {
                    eprintln!("[steam] init_app({STEAM_APP_ID}) failed: {error} — retrying in background (local mode meanwhile)");
                    // 首次失败播一次状态：前端可能在默认值之后才挂上监听。
                    steam_state.update_status(app, |s| s.mode = "unavailable".to_string());
                } else if attempt % RECONNECT_LOG_EVERY == 0 {
                    eprintln!("[steam] still waiting for Steam ({attempt} attempts): {error}");
                }
                attempt += 1;
                std::thread::sleep(if attempt <= RECONNECT_FAST_ATTEMPTS {
                    RECONNECT_FAST_DELAY
                } else {
                    RECONNECT_DELAY
                });
            }
        }
    }
}

/// Steam 客户端是否仍在运行：flat API 的轻量探测，不碰任何接口指针，
/// 未初始化时调用也安全。
fn steam_running() -> bool {
    unsafe { steamworks_sys::SteamAPI_IsSteamRunning() }
}

/// 发放物品落在既有堆叠上（quantity>1，A5 实证掉落会堆叠）时拆 1 个出来供绑定；
/// 独立实例（quantity==1）原样返回。返回 (item_id, def)。
pub fn ensure_distinct_item(
    steam_state: &SharedSteamState,
    granted: &GrantedItem,
) -> Result<(String, u32), String> {
    if granted.quantity <= 1 {
        return Ok((granted.item_id.clone(), granted.def));
    }
    let source = granted
        .item_id
        .parse::<u64>()
        .map_err(|_| "#steamItemIdCorrupt".to_string())?;
    match steam_state.call_blocking(SteamCall::SplitOne { item_id: source }) {
        OpOutcome::Granted(items) => items
            .iter()
            .find(|i| i.item_id != granted.item_id && i.def == granted.def)
            .map(|i| (i.item_id.clone(), i.def))
            .ok_or_else(|| "#splitStackMissingInstance".to_string()),
        OpOutcome::Failed(error) => Err(format!("#splitStackFailed|err={error}")),
        OpOutcome::Uncertain => Err("#splitStackTimeout".to_string()),
    }
}

fn perform(client: &steamworks::Client, call: &SteamCall) -> OpOutcome {
    let started = match call {
        // 成就上报：非库存句柄操作 —— 直接 SetAchievement + StoreStats（幂等）后即返回。
        // StoreStats 触发的 UserStatsStored/UserAchievementStored 由下一轮 run_callbacks 刷新
        // + 弹 Steam 覆盖层。init_app 已自动加载当前用户 stats，setter 在 stats 到达前返回
        // Err 由 §4.3 回填兜底（幂等重设）。
        SteamCall::UnlockAchievements { ids } => {
            let us = client.user_stats();
            for id in ids {
                let _ = us.achievement(id.as_str()).set();
            }
            let _ = us.store_stats();
            return OpOutcome::Granted(Vec::new());
        }
        // 云推送在泵循环内特判处理（拨快周期计时器），不应走到 perform；防御性早返回。
        SteamCall::CloudPush => return OpOutcome::Granted(Vec::new()),
        SteamCall::GetAll | SteamCall::SyncNow => inv::start_get_all(),
        SteamCall::TriggerDrop { def } => inv::start_trigger_drop(*def),
        SteamCall::Exchange { generate_def, destroy } => inv::start_exchange(*generate_def, destroy),
        SteamCall::Consume { item_id } => inv::start_consume(*item_id),
        SteamCall::SplitOne { item_id } => inv::start_split_one(*item_id),
        SteamCall::Generate { defs } => {
            if cfg!(debug_assertions) {
                inv::start_generate(defs)
            } else {
                Err("GenerateItems 仅开发版可用".to_string())
            }
        }
    };
    match started {
        Ok(handle) => inv::wait_result(handle, OP_TIMEOUT, || client.run_callbacks()),
        Err(error) => OpOutcome::Failed(error),
    }
}

/// 泵线程内执行创意工坊操作（内部 pump run_callbacks 等回调；串行、低频、gated）。
fn perform_workshop(client: &steamworks::Client, op: &WorkshopOp) -> WorkshopReply {
    match op {
        WorkshopOp::Publish { codename, name_zh, entry_json, preview_png } => {
            match steam_workshop::publish(
                client,
                STEAM_APP_ID,
                codename,
                name_zh,
                entry_json,
                preview_png.as_deref(),
            ) {
                Ok((published_file_id, needs_legal_agreement)) => {
                    WorkshopReply::Published { published_file_id, needs_legal_agreement }
                }
                Err(error) => WorkshopReply::Failed(error),
            }
        }
        WorkshopOp::Resolve { codename } => match steam_workshop::resolve(client, STEAM_APP_ID, codename) {
            Ok(hit) => WorkshopReply::Resolved(hit),
            Err(error) => WorkshopReply::Failed(error),
        },
        WorkshopOp::ListForPetId { codename } => {
            match steam_workshop::list_for_pet_id(
                client,
                STEAM_APP_ID,
                codename,
                steam_workshop::PERSONA_BUDGET,
            ) {
                Ok(metas) => WorkshopReply::Listing(metas),
                Err(error) => WorkshopReply::Failed(error),
            }
        }
        WorkshopOp::FetchItem { published_file_id } => {
            match steam_workshop::fetch_item(client, *published_file_id) {
                Ok((details, entry_json)) => WorkshopReply::ItemFetched { details, entry_json },
                Err(error) => WorkshopReply::Failed(error),
            }
        }
        WorkshopOp::DeleteAllOwned => {
            // 账号身份从 client 现取：query_user(Published) 按 accountId 过滤，
            // owner_steam_id(raw u64) 再做 owner 二次校验。
            let steam_id = client.user().steam_id();
            match steam_workshop::delete_all_owned(
                client,
                STEAM_APP_ID,
                steam_id.account_id(),
                steam_id.raw(),
            ) {
                Ok((deleted, failed)) => WorkshopReply::AllDeleted { deleted, failed },
                Err(error) => WorkshopReply::Failed(error),
            }
        }
        WorkshopOp::UpdatePreview { published_file_id, codename, name_zh, entry_json, preview_png } => {
            match steam_workshop::update_preview(
                client,
                STEAM_APP_ID,
                *published_file_id,
                codename,
                name_zh,
                entry_json,
                preview_png,
            ) {
                Ok(()) => WorkshopReply::PreviewUpdated,
                Err(error) => WorkshopReply::Failed(error),
            }
        }
    }
}

struct Grace(HashMap<String, Instant>);

impl Grace {
    fn touch(&mut self, outcome: &OpOutcome) {
        if let OpOutcome::Granted(items) = outcome {
            let now = Instant::now();
            for item in items {
                self.0.insert(item.item_id.clone(), now);
            }
        }
    }
    fn active(&mut self) -> BTreeSet<String> {
        let now = Instant::now();
        self.0.retain(|_, at| now.duration_since(*at) < GRACE_WINDOW);
        self.0.keys().cloned().collect()
    }
}

fn to_snapshot(items: &[GrantedItem]) -> Vec<SnapItem> {
    items
        .iter()
        .map(|i| SnapItem {
            item_id: i.item_id.clone(),
            def: i.def,
            quantity: i.quantity,
        })
        .collect()
}

/// 泵循环。**Steam 客户端消失时返回**（调用方摘连接并重连）；其余情况常驻不退。
fn pump_loop(
    app: AppHandle,
    game_state: SharedGameState,
    steam_state: SharedSteamState,
    client: &steamworks::Client,
    rx: Receiver<SteamRequest>,
    workshop_rx: Receiver<WorkshopRequest>,
) {
    let mut grace = Grace(HashMap::new());
    let mut last_outbox = Instant::now() - OUTBOX_INTERVAL; // 启动立即巡检一次。
    let mut last_reconcile = Instant::now();
    let mut last_liveness = Instant::now();
    let mut strikes: u32 = 0;
    // 连线时的一次性拉（cloud_pull_reconcile）已在 init 里处理了初始种子推送，故周期推
    // 从 30s 后起；`cloud_hashes` = 各文件上次推上云的内容哈希，未变不重推。
    let mut last_cloud_push = Instant::now();
    let mut cloud_hashes: HashMap<String, u64> = HashMap::new();

    loop {
        // 探活先于一切调用：Steam 退了还照跑，每个操作都要干等 20s 超时，
        // 而且状态会一直谎报 connected（融合/放生的提示就跟着错）。
        if last_liveness.elapsed() >= LIVENESS_INTERVAL {
            last_liveness = Instant::now();
            strikes = if steam_running() { 0 } else { strikes + 1 };
            if strikes >= LIVENESS_STRIKES {
                return;
            }
        }

        client.run_callbacks();

        // 命令请求（串行处理；SyncNow 触发立即巡检）。
        while let Ok(request) = rx.try_recv() {
            // 调用方已超时放弃 → 回 Uncertain 但**不执行**该变更，避免迟到的 TriggerDrop
            // 等把商店蛋重复发放（第 4 项）。只在 rx（命令）路径判过期：outbox 收敛 op 直接
            // 调 perform、无 deadline，必须跑完。
            if matches!(request.deadline, Some(d) if Instant::now() >= d) {
                let _ = request.reply.send(OpOutcome::Uncertain);
                continue;
            }
            // 云推送非库存操作（无结果句柄）：不走 perform，只把周期计时器拨到即时，
            // 下方 cloud_push_pass 本轮就跑（手动同步 / 退出 flush / 清档夺权）。
            if matches!(request.call, SteamCall::CloudPush) {
                // 清档即时推：本地夺权标记若置着，先清（with_save；泵线程可调 with_save，不违
                // 「持存档锁等 channel」红线）——使随后推上云的字节不带 true，他机不会误判夺权。
                // 仅在标记为真时 with_save，避免普通 flush 每次白抬修订号。
                let force_set = game_state
                    .save
                    .lock()
                    .ok()
                    .and_then(|g| g.as_ref().map(|s| s.cloud_force_push))
                    .unwrap_or(false);
                if force_set {
                    let _ = game::with_save(&app, &game_state, |_config, save| {
                        save.cloud_force_push = false;
                        Ok(())
                    });
                }
                last_cloud_push = Instant::now() - CLOUD_PUSH_INTERVAL;
                let _ = request.reply.send(OpOutcome::Granted(Vec::new()));
                continue;
            }
            let sync_now = matches!(request.call, SteamCall::SyncNow);
            let outcome = perform(client, &request.call);
            grace.touch(&outcome);
            let _ = request.reply.send(outcome);
            if sync_now {
                last_outbox = Instant::now() - OUTBOX_INTERVAL;
                last_reconcile = Instant::now() - RECONCILE_INTERVAL;
            }
        }

        // 创意工坊请求（同线程串行；每个内部泵 run_callbacks 等回调）。
        while let Ok(request) = workshop_rx.try_recv() {
            let reply = perform_workshop(client, &request.op);
            let _ = request.reply.send(reply);
        }

        if steam_state.owner_mismatch() {
            std::thread::sleep(Duration::from_millis(100));
            continue; // 跨账号存档未确认前，不做任何自动同步。
        }

        if last_outbox.elapsed() >= OUTBOX_INTERVAL {
            last_outbox = Instant::now();
            outbox_pass(&app, &game_state, &steam_state, client, &mut grace);
        }
        if last_reconcile.elapsed() >= RECONCILE_INTERVAL {
            last_reconcile = Instant::now();
            reconcile_pass(&app, &game_state, &steam_state, client, &mut grace);
        }
        if last_cloud_push.elapsed() >= CLOUD_PUSH_INTERVAL {
            last_cloud_push = Instant::now();
            cloud_push_pass(&app, client, &mut cloud_hashes, &steam_state);
        }

        std::thread::sleep(Duration::from_millis(100));
    }
}

// ---------------------------------------------------------------------------
// Steam 云存档同步（SteamCloudSync.md）：连线一次性拉（较新者胜 + 备份 + 清档夺权）
// + 泵周期推（哈希判变化）。全部仅泵线程调用；不走 channel、只在 Adopt 时短暂持存档锁。
// ---------------------------------------------------------------------------

/// app_data_dir 下某文件的绝对路径（云同步三件套用）。
fn app_data_file(app: &AppHandle, name: &str) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join(name))
}

/// 内容哈希（std DefaultHasher，无新依赖）：判某文件自上次推送是否变化。
fn hash_bytes(bytes: &[u8]) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    bytes.hash(&mut hasher);
    hasher.finish()
}

/// 原子写字节到本地路径（临时文件 + fsync + rename）。
fn atomic_write_local(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    {
        let mut file = fs::File::create(&tmp).map_err(|error| error.to_string())?;
        file.write_all(bytes).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
    }
    fs::rename(&tmp, path).map_err(|error| error.to_string())
}

/// 周期推送：三件套逐个读磁盘、按内容哈希判变化，变了才写云（读磁盘落盘结果，不碰存档锁）。
fn cloud_push_pass(
    app: &AppHandle,
    client: &steamworks::Client,
    hashes: &mut HashMap<String, u64>,
    steam_state: &SharedSteamState,
) {
    if !steam_cloud::cloud_available(client) {
        // 中途关云（罕见）：仅在状态需翻转时 emit 一次，避免每 30s 刷屏。
        if steam_state.snapshot().cloud_enabled {
            steam_state.update_status(app, |s| s.cloud_enabled = false);
        }
        return;
    }
    let mut synced_any = false;
    for name in steam_cloud::SYNCED_FILES {
        let Some(path) = app_data_file(app, name) else {
            continue;
        };
        let Ok(bytes) = fs::read(&path) else {
            continue; // 文件不存在 / 读失败 → 跳过
        };
        let hash = hash_bytes(&bytes);
        if hashes.get(name) == Some(&hash) {
            continue; // 未变，不重推
        }
        match steam_cloud::write_file(client, name, &bytes) {
            Ok(()) => {
                hashes.insert(name.to_string(), hash);
                synced_any = true;
            }
            Err(error) => eprintln!("[steam_cloud] push {name} failed: {error}"),
        }
    }
    if synced_any {
        let bytes = steam_cloud::total_bytes(client);
        steam_state.update_status(app, |s| {
            s.cloud_enabled = true;
            s.cloud_bytes = Some(bytes);
            s.last_cloud_sync_at = Some(game::now_secs());
        });
        eprintln!("[steam_cloud] periodic push → synced changed file(s) to cloud（{bytes} bytes 云端）");
    }
}

/// 无条件推三件套到云（连线时的种子推送 / 采纳判定为 PushLocal）。
fn push_local_set(app: &AppHandle, client: &steamworks::Client) {
    for name in steam_cloud::SYNCED_FILES {
        let Some(path) = app_data_file(app, name) else {
            continue;
        };
        let Ok(bytes) = fs::read(&path) else {
            continue;
        };
        if let Err(error) = steam_cloud::write_file(client, name, &bytes) {
            eprintln!("[steam_cloud] seed push {name} failed: {error}");
        }
    }
}

/// 把本地三件套复制成带时间戳的 `.pre-cloud-<秒>.json` 备份（采纳云端前，best-effort）。
fn backup_local_set(app: &AppHandle) {
    let ts = game::now_secs();
    for name in steam_cloud::SYNCED_FILES {
        let Some(path) = app_data_file(app, name) else {
            continue;
        };
        if path.exists() {
            let backup = path.with_extension(format!("pre-cloud-{ts}.json"));
            let _ = fs::copy(&path, &backup);
        }
    }
}

/// 采纳云端的账本 / 语录（覆盖本地，best-effort）。存档主档由调用方在锁内处理。
fn adopt_ancillary_from_cloud(app: &AppHandle, client: &steamworks::Client) {
    if let Some(bytes) = steam_cloud::read_file(client, steam_cloud::PROGRESS_FILE) {
        if let Err(error) = crate::codex_adapter::replace_progress_store_bytes(app, &bytes) {
            eprintln!("[steam_cloud] adopt progress failed: {error}");
        }
    }
    if let Some(bytes) = steam_cloud::read_file(client, steam_cloud::QUOTES_FILE) {
        if let Some(path) = app_data_file(app, steam_cloud::QUOTES_FILE) {
            let _ = atomic_write_local(&path, &bytes);
        }
    }
}

/// 连线后一次性云对账（较新者胜 + 备份 + 清档夺权）。仅在 `!owner_mismatch` 时调用。
/// 云字节在锁外读，但**在锁内复比修订号**——并发 with_save 若在读云后抬高本地修订，
/// 锁内即得 `local>=cloud → Push`，绝不覆盖更新的本地。采纳全程持锁到 `*guard=None`。
fn cloud_pull_reconcile(
    app: &AppHandle,
    game_state: &SharedGameState,
    steam_state: &SharedSteamState,
    client: &steamworks::Client,
) {
    // 连线时先 best-effort 打开应用级云开关（幂等；某些开发者云配置下默认 false）。
    steam_cloud::opt_in_app_cloud(client);
    if !steam_cloud::cloud_available(client) {
        steam_state.update_status(app, |s| s.cloud_enabled = false);
        return; // 尊重用户关云：不推不拉。
    }
    steam_state.update_status(app, |s| s.cloud_enabled = true);

    let cloud_bytes = steam_cloud::read_file(client, steam_cloud::SAVE_FILE);
    let cloud_meta = cloud_bytes.as_deref().and_then(steam_cloud::parse_meta);

    // 云端版本超前本机 → 跳过（不降级、不覆盖，仿本地 TooNew）。
    if let Some(meta) = cloud_meta {
        if meta.version > game::CURRENT_SAVE_VERSION {
            eprintln!(
                "[steam_cloud] cloud save v{} newer than supported v{} — skipping sync",
                meta.version,
                game::CURRENT_SAVE_VERSION
            );
            return;
        }
    }

    let mut guard = match game_state.save.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            let mut guard = poisoned.into_inner();
            *guard = None;
            guard
        }
    };
    let local = match game::ensure_loaded(app, &game_state.config, &mut guard) {
        Ok(save) => save,
        Err(error) => {
            eprintln!("[steam_cloud] ensure_loaded failed: {error}");
            return;
        }
    };
    let local_meta = steam_cloud::SaveMeta {
        version: local.version,
        revision: local.cloud_revision,
        last_seen_at: local.last_seen_at,
    };
    let force_push = local.cloud_force_push;

    match steam_cloud::decide_cloud_action(local_meta, cloud_meta, force_push) {
        CloudAction::AdoptCloud => {
            let Some(cloud_bytes) = cloud_bytes else {
                return; // 逻辑上 Adopt 蕴含云存在；防御。
            };
            // 备份本地三件套 → 原子写云 save 字节到本地主档 → 失效内存档。全程持锁 = 对
            // with_save 原子（并发 with_save 在此期间被阻塞，不会与覆盖交错）。
            backup_local_set(app);
            let Ok(save_path) = game::save_path(app) else {
                return;
            };
            if let Err(error) = atomic_write_local(&save_path, &cloud_bytes) {
                eprintln!("[steam_cloud] adopt write save failed: {error} — keeping local");
                return; // 写失败则不动内存档，保底。
            }
            *guard = None;
            drop(guard); // 释放存档锁后再做锁外操作 / with_save（红线：不得持锁调 channel）。

            adopt_ancillary_from_cloud(app, client);
            steam_state.update_status(app, |s| {
                s.cloud_enabled = true;
                s.last_cloud_sync_at = Some(game::now_secs());
                s.cloud_bytes = Some(steam_cloud::total_bytes(client));
            });
            // 通知前端刷新（整档已换）：with_save 从新云档重载并落盘（顺带 +1 修订号）。
            if let Ok((_, save)) = game::with_save(app, game_state, |_config, _save| Ok(())) {
                let _ = app.emit("game://state", save);
            }
            let _ = app.emit("quotes://ready", ());
            eprintln!("[steam_cloud] adopted cloud save (local backed up to .pre-cloud-*)");
        }
        CloudAction::PushLocal => {
            drop(guard); // 先释放锁再 with_save。
            // 夺权推送前先清标记：这样推上云的字节不带 true（他机不会误判夺权）。
            if force_push {
                let _ = game::with_save(app, game_state, |_config, save| {
                    save.cloud_force_push = false;
                    Ok(())
                });
            }
            push_local_set(app, client);
            steam_state.update_status(app, |s| {
                s.cloud_enabled = true;
                s.last_cloud_sync_at = Some(game::now_secs());
                s.cloud_bytes = Some(steam_cloud::total_bytes(client));
            });
            eprintln!("[steam_cloud] reconcile → pushed local save-set to cloud（本地权威/播种）");
        }
    }
}

/// outbox 巡检的到期单飞项：MintTier1 的 TriggerItemDrop、本地先行放生的 ConsumeItem，
/// 或本地先行融合的 ExchangeItems（原子烧两材料 + 铸结果）。
enum DueOutboxOp {
    Mint {
        op_id: String,
        def: u32,
    },
    ReleaseConsume {
        op_id: String,
        item_id: String,
    },
    FuseExchange {
        op_id: String,
        generate_def: u32,
        item_a: String,
        item_b: String,
        /// 材料 A/B 待铸的一阶 def（对应 item 为空时先 TriggerItemDrop 铸出）。
        mat_def_a: u32,
        mat_def_b: u32,
        recipe_key: String,
        parents: Option<[String; 2]>,
        egg_id: Option<String>,
        pet_id: Option<String>,
    },
}

/// 从一次 Granted 结果取一个**独立实例**（掉落/兑换发放同 def 会自动堆叠 → 就地 SplitOne 拆 1；
/// 拆失败则退回原 id）。⚠️ 泵线程内不得用 `ensure_distinct_item`（走 call_blocking 会自锁死）。
fn distinct_instance(
    client: &steamworks::Client,
    grace: &mut Grace,
    granted: &GrantedItem,
) -> (String, u32) {
    if granted.quantity <= 1 {
        return (granted.item_id.clone(), granted.def);
    }
    if let Ok(source) = granted.item_id.parse::<u64>() {
        let split = perform(client, &SteamCall::SplitOne { item_id: source });
        grace.touch(&split);
        if let OpOutcome::Granted(list) = split {
            if let Some(i) = list
                .iter()
                .find(|i| i.item_id != granted.item_id && i.def == granted.def)
            {
                return (i.item_id.clone(), i.def);
            }
        }
    }
    (granted.item_id.clone(), granted.def)
}

/// outbox 巡检：意图探测 → 认领 → 单飞重试一个到期 op（MintTier1 / 放生消耗 / 融合兑换）。
fn outbox_pass(
    app: &AppHandle,
    game_state: &SharedGameState,
    steam_state: &SharedSteamState,
    client: &steamworks::Client,
    grace: &mut Grace,
) {
    let OpOutcome::Granted(items) = perform(client, &SteamCall::GetAll) else {
        return;
    };
    let snapshot = to_snapshot(&items);
    let now = game::now_secs();

    // 意图探测 + 认领（存档锁内，无 Steam 调用）。applied Release 的物品若已从
    // 快照消失（消耗已发生/被交易走），resolve_intents 会在这里直接收掉 op。
    let due_op = game::with_save(app, game_state, |config, save| {
        let mut changed = steam_sync::resolve_intents(config, save, &snapshot, now);
        changed |= steam_sync::attach_mints(save, &snapshot);
        let due = save.steam_outbox.iter().find_map(|op| match op {
            SteamOp::MintTier1 {
                op_id,
                def,
                next_retry_at,
                ..
            } if *next_retry_at <= now => Some(DueOutboxOp::Mint { op_id: op_id.clone(), def: *def }),
            SteamOp::Release {
                op_id,
                item_id,
                applied: true,
                next_retry_at,
                ..
            } if *next_retry_at <= now => Some(DueOutboxOp::ReleaseConsume {
                op_id: op_id.clone(),
                item_id: item_id.clone(),
            }),
            SteamOp::Fuse {
                op_id,
                applied: true,
                item_a,
                item_b,
                egg_def,
                mat_def_a,
                mat_def_b,
                recipe_key,
                egg_id,
                pet_id,
                parents,
                next_retry_at,
                ..
            } if *next_retry_at <= now => Some(DueOutboxOp::FuseExchange {
                op_id: op_id.clone(),
                generate_def: *egg_def,
                item_a: item_a.clone(),
                item_b: item_b.clone(),
                mat_def_a: *mat_def_a,
                mat_def_b: *mat_def_b,
                recipe_key: recipe_key.clone(),
                parents: parents.clone(),
                egg_id: egg_id.clone(),
                pet_id: pet_id.clone(),
            }),
            _ => None,
        });
        Ok((changed, due))
    });
    let (changed, due) = match due_op {
        Ok(((changed, due), save)) => {
            if changed {
                let _ = app.emit("game://state", save);
            }
            (changed, due)
        }
        Err(_) => (false, None),
    };
    let _ = changed;

    // 单飞重试一个到期的 mint（锁外做 Steam 调用）。
    // ⚠️ TriggerItemDrop 的目标是 playtimegenerator def，不是宠物 def（2026-07-16 修复：
    // 旧代码直打 op.def=101-106 必空手）。走 tier1 商店 gen 21011-21016（drop_interval:1、
    // drop_max_per_window:10/日、窗口=应用级 1440），bundle 单条目保证掉出的就是 op.def 宠物。
    match due {
        Some(DueOutboxOp::Mint { op_id, def }) => {
            let outcome = perform(client, &SteamCall::TriggerDrop { def: crate::fusion_slots::shop_gen_def(1, def) });
            grace.touch(&outcome);
            // 拆栈（锁外，镜像 FuseExchange 分支）：掉落若堆叠到既有同 def 实例上，items[0].item_id
            // 会是那个**已被别的宠绑定**的 id → 两宠共用一 id → 下轮对账把其中一只误删（review 第 1 项）。
            // 就地 SplitOne 拆一个独立实例出来绑。⚠️ 泵线程内不得用 ensure_distinct_item（走 call_blocking
            // 自锁死）。幂等：Mint 的“已掉落”只由 outbox.remove(index) 记住 → 拆栈必须**本轮就地**完成，
            // 拆失败就退回绑堆叠 id（.or_else）并仍 remove op；**绝不**保留 op 留到下轮重拆，否则二次
            // TriggerDrop 会双铸。
            let bind_pair: Option<(String, u32)> = match &outcome {
                OpOutcome::Granted(items) if !items.is_empty() => {
                    let granted = &items[0];
                    if granted.quantity > 1 {
                        match granted.item_id.parse::<u64>() {
                            Ok(source) => {
                                let split = perform(client, &SteamCall::SplitOne { item_id: source });
                                grace.touch(&split);
                                match split {
                                    OpOutcome::Granted(list) => list
                                        .iter()
                                        .find(|i| i.item_id != granted.item_id && i.def == granted.def)
                                        .map(|i| (i.item_id.clone(), i.def))
                                        .or_else(|| Some((granted.item_id.clone(), granted.def))),
                                    _ => Some((granted.item_id.clone(), granted.def)),
                                }
                            }
                            Err(_) => Some((granted.item_id.clone(), granted.def)),
                        }
                    } else {
                        Some((granted.item_id.clone(), granted.def))
                    }
                }
                _ => None,
            };
            let now = game::now_secs();
            let result = game::with_save(app, game_state, |_config, save| {
                let Some(index) = save.steam_outbox.iter().position(|op| {
                    matches!(op, SteamOp::MintTier1 { op_id: id, .. } if *id == op_id)
                }) else {
                    return Ok(false);
                };
                match &outcome {
                    OpOutcome::Granted(items) if !items.is_empty() => {
                        // 精确按本次结果句柄绑定（拆栈后为独立实例；00-decisions.md）。
                        if let (Some((bind_id, bind_def)), SteamOp::MintTier1 { pet_id, .. }) =
                            (&bind_pair, save.steam_outbox[index].clone())
                        {
                            if let Some(pet) = save.pets.iter_mut().find(|p| p.id == pet_id) {
                                pet.steam_item_id = Some(bind_id.clone());
                                pet.steam_item_def = Some(*bind_def);
                            }
                        }
                        save.steam_outbox.remove(index);
                        Ok(true)
                    }
                    OpOutcome::Granted(_) | OpOutcome::Failed(_) => {
                        // 限频（成功但零物品）或失败：退避重试。
                        if let SteamOp::MintTier1 {
                            attempts,
                            next_retry_at,
                            ..
                        } = &mut save.steam_outbox[index]
                        {
                            *next_retry_at = now + steam_sync::mint_backoff_secs(*attempts);
                            *attempts += 1;
                        }
                        Ok(true)
                    }
                    OpOutcome::Uncertain => Ok(false), // 结果未知：下轮认领兜底。
                }
            });
            if let Ok((true, save)) = result {
                let _ = app.emit("game://state", save);
            }
        }
        Some(DueOutboxOp::ReleaseConsume { op_id, item_id }) => {
            // 本地先行放生的欠账：单飞 ConsumeItem（成功 = 空 Granted——消耗条目
            // quantity 0 被过滤）。物品 id 损坏的 op 永远无法成功 → 直接移除
            //（物品若真存在，失去 bound 保护后由对账导入自愈）。
            let parsed = item_id.parse::<u64>();
            let corrupt = parsed.is_err();
            let outcome = match parsed {
                Ok(item) => perform(client, &SteamCall::Consume { item_id: item }),
                Err(_) => OpOutcome::Failed("#steamItemIdCorrupt".to_string()),
            };
            grace.touch(&outcome);
            let now = game::now_secs();
            let result = game::with_save(app, game_state, |_config, save| {
                let Some(index) = save.steam_outbox.iter().position(|op| {
                    matches!(op, SteamOp::Release { op_id: id, .. } if *id == op_id)
                }) else {
                    return Ok(false);
                };
                match &outcome {
                    OpOutcome::Granted(_) => {
                        save.steam_outbox.remove(index);
                        eprintln!("[steam] release consume {item_id}: 已消耗，放生收敛完成");
                        Ok(true)
                    }
                    OpOutcome::Failed(error) => {
                        if corrupt {
                            save.steam_outbox.remove(index);
                            eprintln!("[steam] release consume {item_id}: 物品 id 损坏，弃 op");
                        } else if let SteamOp::Release {
                            attempts,
                            next_retry_at,
                            ..
                        } = &mut save.steam_outbox[index]
                        {
                            // 失败退避重试；物品其实已消失（早前 Uncertain 实际成功等）
                            // 时，下轮 resolve_intents 对照快照会直接收掉 op。
                            *next_retry_at = now + steam_sync::mint_backoff_secs(*attempts);
                            *attempts += 1;
                            eprintln!("[steam] release consume {item_id}: 失败（{error}），退避后重试");
                        }
                        Ok(true)
                    }
                    OpOutcome::Uncertain => Ok(false), // 结果未知：下轮快照对照兜底。
                }
            });
            if let Ok((true, save)) = result {
                let _ = app.emit("game://state", save);
            }
        }
        Some(DueOutboxOp::FuseExchange {
            op_id,
            generate_def,
            item_a,
            item_b,
            mat_def_a,
            mat_def_b,
            recipe_key,
            parents,
            egg_id,
            pet_id,
        }) => {
            // 本地先行融合的欠账，分两阶单飞推进（一轮一步，全程非阻塞）：
            //   阶段 A —— 材料未铸齐（教学首融的双亲此时常是 MintTier1 待发放态，已在融合时转交本 op）：
            //             先 TriggerItemDrop 铸出缺的那只材料、填回 op.item_x（重置退避尽快接下一步）。
            //   阶段 B —— 两材料就绪：原子 ExchangeItems（烧两材料 + 按目标 def 铸结果）+ 回绑蛋/宠、收 op。
            if item_a.is_empty() || item_b.is_empty() {
                let (slot_a, mint_def) = if item_a.is_empty() {
                    (true, mat_def_a)
                } else {
                    (false, mat_def_b)
                };
                let now = game::now_secs();
                if mint_def == 0 {
                    // 无目录 def 可铸（几乎不会发生：一阶宠必有 def）→ 退避重试。
                    let _ = game::with_save(app, game_state, |_config, save| {
                        if let Some(i) = save.steam_outbox.iter().position(|op| {
                            matches!(op, SteamOp::Fuse { op_id: id, .. } if *id == op_id)
                        }) {
                            if let SteamOp::Fuse { attempts, next_retry_at, .. } =
                                &mut save.steam_outbox[i]
                            {
                                *next_retry_at = now + steam_sync::mint_backoff_secs(*attempts);
                                *attempts += 1;
                            }
                        }
                        Ok(false)
                    });
                } else {
                    // 铸材料走 tier1 商店 gen（同 MintTier1）；堆叠则拆 1。
                    let outcome = perform(
                        client,
                        &SteamCall::TriggerDrop { def: crate::fusion_slots::shop_gen_def(1, mint_def) },
                    );
                    grace.touch(&outcome);
                    let minted = match &outcome {
                        OpOutcome::Granted(items) if !items.is_empty() => {
                            Some(distinct_instance(client, grace, &items[0]))
                        }
                        _ => None,
                    };
                    let result = game::with_save(app, game_state, |_config, save| {
                        let Some(index) = save.steam_outbox.iter().position(|op| {
                            matches!(op, SteamOp::Fuse { op_id: id, .. } if *id == op_id)
                        }) else {
                            return Ok(false);
                        };
                        match minted {
                            Some((item_id, _def)) => {
                                if let SteamOp::Fuse {
                                    item_a: ia,
                                    item_b: ib,
                                    attempts,
                                    next_retry_at,
                                    ..
                                } = &mut save.steam_outbox[index]
                                {
                                    if slot_a {
                                        *ia = item_id;
                                    } else {
                                        *ib = item_id;
                                    }
                                    *attempts = 0;
                                    *next_retry_at = 0; // 立即接下一步（铸另一只 / 兑换）。
                                }
                                eprintln!(
                                    "[steam] fuse {op_id}: 材料 {} 已铸",
                                    if slot_a { "A" } else { "B" }
                                );
                                Ok(true)
                            }
                            None => {
                                // 限频（空）/失败：退避重试铸这只材料。
                                if let SteamOp::Fuse { attempts, next_retry_at, .. } =
                                    &mut save.steam_outbox[index]
                                {
                                    *next_retry_at = now + steam_sync::mint_backoff_secs(*attempts);
                                    *attempts += 1;
                                }
                                Ok(true)
                            }
                        }
                    });
                    if let Ok((true, save)) = result {
                        let _ = app.emit("game://state", save);
                    }
                }
            } else {
                // 阶段 B：两材料就绪 → 原子兑换。材料 id 损坏 → 弃 op（结果留未绑定，由 repair/对账兜底）。
                let parsed = item_a
                    .parse::<u64>()
                    .and_then(|a| item_b.parse::<u64>().map(|b| (a, b)));
                let corrupt = parsed.is_err();
                let outcome = match parsed {
                    Ok((a, b)) => perform(
                        client,
                        &SteamCall::Exchange { generate_def, destroy: vec![a, b] },
                    ),
                    Err(_) => OpOutcome::Failed("#steamItemIdCorrupt".to_string()),
                };
                grace.touch(&outcome);
                let bind_pair: Option<(String, u32)> = match &outcome {
                    OpOutcome::Granted(items) if !items.is_empty() => {
                        Some(distinct_instance(client, grace, &items[0]))
                    }
                    _ => None,
                };
                let now = game::now_secs();
                let result = game::with_save(app, game_state, |config, save| {
                    let Some(index) = save.steam_outbox.iter().position(|op| {
                        matches!(op, SteamOp::Fuse { op_id: id, .. } if *id == op_id)
                    }) else {
                        return Ok(false);
                    };
                    match (&outcome, &bind_pair) {
                        (OpOutcome::Granted(items), Some((bind_id, bind_def))) if !items.is_empty() => {
                            let parents_arr = parents.clone().unwrap_or_else(|| {
                                [
                                    crate::game::FALLBACK_SPECIES.to_string(),
                                    crate::game::FALLBACK_SPECIES.to_string(),
                                ]
                            });
                            steam_sync::apply_fused_result(
                                config, save, bind_id.clone(), *bind_def, &recipe_key, &parents_arr,
                                egg_id.as_deref(), pet_id.as_deref(), now,
                            );
                            save.steam_outbox.remove(index);
                            eprintln!("[steam] fuse exchange {op_id}: 已烧材料+铸结果 def={bind_def}，回绑完成");
                            Ok(true)
                        }
                        (OpOutcome::Uncertain, _) => Ok(false), // 下轮 resolve_intents 对照快照兜底。
                        _ => {
                            // 空 / 失败 / 拆栈失败：退避重试（材料 id 损坏则弃 op）。若兑换其实已成功
                            // （材料已消失），下轮 resolve_intents 会据快照直接回绑结果 + 收 op。
                            if corrupt {
                                save.steam_outbox.remove(index);
                                eprintln!("[steam] fuse exchange {op_id}: 材料 id 损坏，弃 op");
                            } else if let SteamOp::Fuse { attempts, next_retry_at, .. } =
                                &mut save.steam_outbox[index]
                            {
                                *next_retry_at = now + steam_sync::mint_backoff_secs(*attempts);
                                *attempts += 1;
                            }
                            Ok(true)
                        }
                    }
                });
                if let Ok((true, save)) = result {
                    let _ = app.emit("game://state", save);
                }
            }
        }
        None => {}
    }

    publish_status(app, game_state, steam_state, now);
}

/// 全量对账：以 Steam 快照收敛本地（导入交易所得 / 剪除交易送出）。
fn reconcile_pass(
    app: &AppHandle,
    game_state: &SharedGameState,
    steam_state: &SharedSteamState,
    client: &steamworks::Client,
    grace: &mut Grace,
) {
    let OpOutcome::Granted(items) = perform(client, &SteamCall::GetAll) else {
        return;
    };
    let snapshot = to_snapshot(&items);
    let grace_ids = grace.active();
    let now = game::now_secs();
    let result = game::with_save(app, game_state, |config, save| {
        Ok(steam_sync::reconcile(config, save, &snapshot, &grace_ids, now))
    });
    if let Ok((report, save)) = result {
        let imported_pets = report.imported_pets;
        if let Ok(mut unclaimed) = steam_state.0.unclaimed.lock() {
            *unclaimed = report.unclaimed;
        }
        if report.changed {
            let _ = app.emit("game://state", save);
        }
        // 自动对账冷导入了宠物 → 其中的 AI 变种（aif####）本机无形象会渲染成兜底鸭。
        // 后台补齐首发形象（镜像手动导入 steam_import_pets；review 第 3 项 caveat）。
        // 仅在真导入过宠物、且存在待补形象时触发，避免每次巡检空跑 resolver。
        if imported_pets > 0 {
            let unresolved = game::with_save(app, game_state, |config, save| {
                Ok(steam_sync::unresolved_ai_species(config, save))
            })
            .map(|(list, _)| list)
            .unwrap_or_default();
            if !unresolved.is_empty() {
                crate::fusion_gen::spawn_import_appearance_resolver(
                    app.clone(),
                    game_state.clone(),
                    steam_state.clone(),
                    unresolved,
                );
            }
        }
    }
    publish_status(app, game_state, steam_state, now);
}

fn publish_status(
    app: &AppHandle,
    game_state: &SharedGameState,
    steam_state: &SharedSteamState,
    now: i64,
) {
    let (pending_mints, pending_releases) = game::with_save(app, game_state, |_config, save| {
        let mints = save
            .steam_outbox
            .iter()
            .filter(|op| matches!(op, SteamOp::MintTier1 { .. }))
            .count();
        let releases = save
            .steam_outbox
            .iter()
            .filter(|op| matches!(op, SteamOp::Release { applied: true, .. }))
            .count();
        Ok((mints, releases))
    })
    .map(|(counts, _)| counts)
    .unwrap_or((0, 0));
    let unclaimed = steam_state.0.unclaimed.lock().map(|u| u.len()).unwrap_or(0);
    steam_state.update_status(app, |s| {
        s.pending_mints = pending_mints;
        s.pending_releases = pending_releases;
        s.unclaimed_imports = unclaimed;
        s.last_sync_at = Some(now);
    });
}

// ---------------------------------------------------------------------------
// IPC commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn get_steam_status(state: tauri::State<'_, SharedSteamState>) -> SteamStatus {
    state.snapshot()
}

/// 手动触发一轮同步（前端"立即同步"按钮 / 调试用）。
#[tauri::command]
pub async fn steam_sync_now(state: tauri::State<'_, SharedSteamState>) -> Result<(), String> {
    if !integration_enabled() {
        return Err("#steamIntegrationOff".to_string());
    }
    let steam = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || match steam.call_blocking(SteamCall::SyncNow) {
        OpOutcome::Failed(error) => Err(error),
        _ => Ok(()),
    })
    .await
    .map_err(|error| error.to_string())?
}

/// 手动触发一轮云存档推送（前端「云同步」按钮 / 窗口关闭·失焦前 flush）。fire-and-forget：
/// 只把 CloudPush 丢进泵线程即返回，不阻塞（泵下一轮 cloud_push_pass 执行）。泵忙 / 未连接
/// 时静默无效，30s 周期推送兜底。SteamCloudSync.md。
#[tauri::command]
pub fn steam_cloud_sync_now(state: tauri::State<'_, SharedSteamState>) -> Result<(), String> {
    if !integration_enabled() {
        return Err("#steamIntegrationOff".to_string());
    }
    state.cloud_push_now();
    Ok(())
}

/// 手动"导入我的宠物"（交易市场按钮）：读整份 Steam 库存，把未绑定的宠物物品
/// 填入后院空位，品阶高者优先（后院满时高阶先入、低阶留待认领）。反复调用幂等
/// —— 已绑定物品跳过，不重复导入；只新增、不驱逐已放置的宠物。
#[tauri::command]
pub async fn steam_import_pets(
    app: AppHandle,
    game: tauri::State<'_, SharedGameState>,
    state: tauri::State<'_, SharedSteamState>,
) -> Result<steam_sync::ImportPetsReport, String> {
    if !integration_enabled() {
        return Err("#steamIntegrationOff".to_string());
    }
    let steam = state.inner().clone();
    let game_state = game.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        if steam.owner_mismatch() {
            return Err("#steamOwnerMismatch".to_string());
        }
        // 读整份库存快照（泵线程串行执行）。
        let items = match steam.call_blocking(SteamCall::GetAll) {
            OpOutcome::Granted(items) => items,
            OpOutcome::Failed(error) => return Err(error),
            OpOutcome::Uncertain => return Err("#steamInventoryTimeout".to_string()),
        };
        let snapshot = to_snapshot(&items);
        let now = game::now_secs();
        let (report, save) = game::with_save(&app, &game_state, |config, save| {
            Ok(steam_sync::import_inventory_pets(config, save, &snapshot, now))
        })?;
        if report.changed {
            let _ = app.emit("game://state", save);
        }
        // 待认领徽章即时反映本次容量外的剩余。
        if let Ok(mut unclaimed) = steam.0.unclaimed.lock() {
            *unclaimed = report.unclaimed_items.clone();
        }
        // AI 融合形象补齐：冷导入的 AI 变种（aif####）本机没有形象数据 → 会渲染成
        // 兜底鸭。后台逐个查创意工坊首发形象并注册（渐进推 game://state 替换）。
        // 扫全部宠物 → 也修复历史上已导入成鸭的存量。
        let unresolved = game::with_save(&app, &game_state, |config, save| {
            Ok(steam_sync::unresolved_ai_species(config, save))
        })
        .map(|(list, _)| list)
        .unwrap_or_default();
        crate::fusion_gen::spawn_import_appearance_resolver(
            app.clone(),
            game_state.clone(),
            steam.clone(),
            unresolved,
        );
        publish_status(&app, &game_state, &steam, now);
        Ok(report)
    })
    .await
    .map_err(|error| error.to_string())?
}

/// 跨账号存档确认重绑：剥离全部绑定/队列/墓碑，重打当前账号，随后迁移扫描。
#[tauri::command]
pub async fn steam_confirm_rebind(
    app: AppHandle,
    game: tauri::State<'_, SharedGameState>,
    state: tauri::State<'_, SharedSteamState>,
) -> Result<GameSave, String> {
    let steam = state.inner().clone();
    let game_state = game.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let steam_id = steam
            .snapshot()
            .steam_id
            .ok_or_else(|| "#steamNotConnected".to_string())?;
        let (_, save) = game::with_save(&app, &game_state, |config, save| {
            steam_sync::strip_steam_bindings(save, steam_id.clone());
            steam_sync::migration_sweep(config, save);
            Ok(())
        })?;
        steam.update_status(&app, |s| s.owner_mismatch = false);
        let _ = app.emit("game://state", save.clone());
        Ok(save)
    })
    .await
    .map_err(|error| error.to_string())?
}

/// 开发期铺测试库存（GenerateItems；正式版由 Valve 侧禁用，双保险 cfg 门）。
#[tauri::command]
pub async fn debug_steam_generate_items(
    state: tauri::State<'_, SharedSteamState>,
    defs: Vec<u32>,
) -> Result<usize, String> {
    if !cfg!(debug_assertions) {
        return Err("仅开发版可用".to_string());
    }
    let steam = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let defs = if defs.is_empty() {
            vec![101, 102, 103, 104, 105, 106]
        } else {
            defs
        };
        match steam.call_blocking(SteamCall::Generate { defs }) {
            OpOutcome::Granted(items) => Ok(items.len()),
            OpOutcome::Failed(error) => Err(error),
            OpOutcome::Uncertain => Err("超时：结果未知，稍后对账核对".to_string()),
        }
    })
    .await
    .map_err(|error| error.to_string())?
}

/// 开发期清空**当前登录账号**的全部 Steam 库存物品实例（逐件 ConsumeItem）。
///
/// - 只清 Steam 侧物品实例；**不触碰 itemdef 目录，也不改本地存档**。
/// - 客户端 `ConsumeItem` 只能操作自己账号——别的测试账号须各自登录后再跑
///   （00-decisions.md「无 Web API key」下无跨账号批量清除）。
/// - **不可逆**（ConsumeItem 官方明示 cannot be reversed）。
/// - 收敛式：反复 `GetAll` → 逐件 `Consume`，直到库存空 / 某轮零进展 / 达轮次上限。
/// - ⚠️ 若集成仍在跑且本地存档尚有未绑定宠物，outbox 可能随后自动重新发放。
///   要彻底清零，请配合 `debug_clear_save`（或先清本地存档）再跑本命令。
#[tauri::command]
pub async fn debug_steam_consume_all(
    state: tauri::State<'_, SharedSteamState>,
) -> Result<usize, String> {
    if !cfg!(debug_assertions) {
        return Err("仅开发版可用".to_string());
    }
    if !integration_enabled() {
        return Err("Steam 集成已关闭（本地调试模式）".to_string());
    }
    let steam = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        const MAX_ROUNDS: usize = 50;
        let mut total = 0usize;
        for _ in 0..MAX_ROUNDS {
            let items = match steam.call_blocking(SteamCall::GetAll) {
                OpOutcome::Granted(items) => items,
                OpOutcome::Failed(error) => return Err(error),
                OpOutcome::Uncertain => return Err("超时：读取库存结果未知".to_string()),
            };
            if items.is_empty() {
                return Ok(total);
            }
            let mut progressed = 0usize;
            for item in &items {
                // item id 是十进制字符串（防 JS 精度）；异常者跳过。
                let Ok(item_id) = item.item_id.parse::<u64>() else {
                    continue;
                };
                // Granted（含消耗后空结果集）= 成功；Failed/Uncertain 本件跳过，
                // 靠下一轮 GetAll 复核。
                if let OpOutcome::Granted(_) = steam.call_blocking(SteamCall::Consume { item_id }) {
                    total += 1;
                    progressed += 1;
                }
            }
            if progressed == 0 {
                // 本轮一件都没清掉却仍有物品：无法再推进，返回已清计数。
                return Ok(total);
            }
        }
        Ok(total)
    })
    .await
    .map_err(|error| error.to_string())?
}

/// 开发期清除**当前登录账号**在本 App 名下发布的全部创意工坊内容（逐件 DeleteItem）。
///
/// - 数据源 `query_user(Published)`：只列本账号自己发布的工坊物品；owner 再做二次校验。
/// - 客户端 `DeleteItem` 只能删自己账号——别的测试账号须各自登录后再跑
///   （00-decisions.md「无 Web API key」下无跨账号删除）。
/// - **不可逆**（DeleteItem 官方明示从工坊永久移除物品）。
/// - **不触碰本地存档**：`workshop_published` 记录原样保留，`spawn_workshop_backfill`
///   据此判定「已处理」而**不会**在重启后把刚删的形象又传回去（工坊保持清空）。
///   若要连本地发布记录一并重置（例如重跑发布流程），请配合 `debug_clear_save`。
/// - 与 `debug_steam_consume_all` 同走泵线程串行、开发版 + 集成开启双闸门。
#[tauri::command]
pub async fn debug_steam_delete_all_workshop(
    state: tauri::State<'_, SharedSteamState>,
) -> Result<WorkshopClearReport, String> {
    if !cfg!(debug_assertions) {
        return Err("仅开发版可用".to_string());
    }
    if !integration_enabled() {
        return Err("Steam 集成已关闭（本地调试模式）".to_string());
    }
    let steam = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let (deleted, failed) = steam.delete_all_owned_species()?;
        Ok(WorkshopClearReport { deleted, failed })
    })
    .await
    .map_err(|error| error.to_string())?
}
