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
use crate::steam_inventory::{self as inv, GrantedItem, OpOutcome};
use crate::steam_sync::{self, SnapItem};
use crate::steam_workshop;
use serde::Serialize;
use std::collections::{BTreeSet, HashMap};
use std::sync::mpsc::{Receiver, Sender};
use std::sync::{mpsc, Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub const STEAM_APP_ID: u32 = 4956830;

/// Steam 集成总开关的编译期默认值。
/// 【2026-07-12 用户指示】本地调试阶段默认**关闭**——全部玩法走纯本地逻辑
/// （融合/二阶孵化/放生不再要求 Steam，也不入 MintTier1 队列）。
/// 重启 Steam 联调时：改回 true，或运行时设 `GULUGULU_STEAM=1`（免重编）。
/// 重新开启后，存量未上链宠物由 migration_sweep 自动补入发放队列，供给不膨胀。
const STEAM_DEFAULT_ENABLED: bool = false;

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
/// 创意工坊单操作可能串两段回调（create+submit）或查询+下载轮询，给足余量。
const WORKSHOP_TIMEOUT: Duration = Duration::from_secs(100);
/// 宽限集窗口：近期操作过的物品 id 不被对账剪除/导入。
const GRACE_WINDOW: Duration = Duration::from_secs(30);
const OUTBOX_INTERVAL: Duration = Duration::from_secs(60);
const RECONCILE_INTERVAL: Duration = Duration::from_secs(300);

#[derive(Clone, Debug)]
pub enum SteamCall {
    GetAll,
    TriggerDrop { def: u32 },
    Exchange { generate_def: u32, destroy: Vec<u64> },
    Consume { item_id: u64 },
    /// 仅开发期（GenerateItems 在正式版失效）。
    Generate { defs: Vec<u32> },
    /// 立即跑一轮 outbox + 对账。
    SyncNow,
}

pub struct SteamRequest {
    pub call: SteamCall,
    pub reply: Sender<OpOutcome>,
}

/// 创意工坊（AI 变种形象 UGC）操作 —— 与库存同走泵线程串行（steam_workshop.rs）。
#[derive(Clone, Debug)]
pub enum WorkshopOp {
    /// 发布/抢占某槽位形象：codename=petId，name_zh 标题，entry_json 内容。
    Publish { codename: String, name_zh: String, entry_json: String },
    /// 查询某槽位的全局形象（最早发布者胜）。
    Resolve { codename: String },
}

#[derive(Clone, Debug)]
pub enum WorkshopReply {
    Published { published_file_id: u64 },
    Resolved(Option<String>),
    Failed(String),
}

pub struct WorkshopRequest {
    pub op: WorkshopOp,
    pub reply: Sender<WorkshopReply>,
}

/// steam://status 事件载荷（mirrored in src/types.ts — keep both sides in sync）。
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamStatus {
    /// "connected" | "unavailable" | "disabled"（disabled = 集成总开关关闭，
    /// 全部玩法走纯本地逻辑）。
    pub mode: String,
    pub pending_mints: usize,
    pub unclaimed_imports: usize,
    pub owner_mismatch: bool,
    pub last_sync_at: Option<i64>,
    pub steam_id: Option<String>,
    pub app_id: u32,
}

pub struct SteamStateInner {
    pub tx: Mutex<Option<Sender<SteamRequest>>>,
    /// 创意工坊请求通道（发布/查询 AI 变种形象），与 `tx` 同由泵线程消费。
    pub workshop_tx: Mutex<Option<Sender<WorkshopRequest>>>,
    pub status: Mutex<SteamStatus>,
    pub unclaimed: Mutex<Vec<SnapItem>>,
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

    /// 命令侧同步调用：发请求给泵线程并等待（不得持任何锁调用）。
    pub fn call_blocking(&self, call: SteamCall) -> OpOutcome {
        let tx = match self.0.tx.lock() {
            Ok(guard) => guard.clone(),
            Err(_) => None,
        };
        let Some(tx) = tx else {
            return OpOutcome::Failed("Steam 未连接".to_string());
        };
        let (reply_tx, reply_rx) = mpsc::channel();
        if tx.send(SteamRequest { call, reply: reply_tx }).is_err() {
            return OpOutcome::Failed("Steam 泵线程已退出".to_string());
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

    /// 发布/抢占某槽位 AI 变种形象（petId=codename）。返回 publishedFileId 或错误。
    pub fn publish_species(&self, codename: &str, name_zh: &str, entry_json: &str) -> Result<u64, String> {
        match self.workshop_blocking(WorkshopOp::Publish {
            codename: codename.to_string(),
            name_zh: name_zh.to_string(),
            entry_json: entry_json.to_string(),
        }) {
            WorkshopReply::Published { published_file_id } => Ok(published_file_id),
            WorkshopReply::Failed(error) => Err(error),
            WorkshopReply::Resolved(_) => Err("创意工坊返回了意外的回复".to_string()),
        }
    }

    /// 查询某槽位 AI 变种形象的全局 JSON（无人认领 → `Ok(None)`）。
    pub fn resolve_species(&self, codename: &str) -> Result<Option<String>, String> {
        match self.workshop_blocking(WorkshopOp::Resolve { codename: codename.to_string() }) {
            WorkshopReply::Resolved(json) => Ok(json),
            WorkshopReply::Failed(error) => Err(error),
            WorkshopReply::Published { .. } => Err("创意工坊返回了意外的回复".to_string()),
        }
    }
}

pub fn new_shared_state() -> SharedSteamState {
    SharedSteamState::new()
}

/// setup 钩子入口：初始化 SteamAPI 并拉起泵线程；失败即优雅降级。
pub fn init(app: AppHandle, game_state: SharedGameState, steam_state: SharedSteamState) {
    if !integration_enabled() {
        eprintln!("[steam] integration disabled (GULUGULU_STEAM / STEAM_DEFAULT_ENABLED) — local mode");
        steam_state.update_status(&app, |s| s.mode = "disabled".to_string());
        return;
    }
    std::thread::spawn(move || {
        let client = match steamworks::Client::init_app(STEAM_APP_ID) {
            Ok(client) => client,
            Err(error) => {
                eprintln!("[steam] init_app({STEAM_APP_ID}) failed, degrading: {error}");
                steam_state.update_status(&app, |s| s.mode = "unavailable".to_string());
                return;
            }
        };
        let steam_id = client.user().steam_id().raw().to_string();

        // owner 校验：首连打点；不匹配则挂 ownerMismatch，等用户确认重绑。
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
        if !owner_mismatch {
            let changed = game::with_save(&app, &game_state, |config, save| {
                Ok(steam_sync::migration_sweep(config, save))
            });
            if let Ok((true, save)) = changed {
                let _ = app.emit("game://state", save);
            }
        }

        pump_loop(app, game_state, steam_state, client, rx, workshop_rx);
    });
}

fn perform(client: &steamworks::Client, call: &SteamCall) -> OpOutcome {
    let started = match call {
        SteamCall::GetAll | SteamCall::SyncNow => inv::start_get_all(),
        SteamCall::TriggerDrop { def } => inv::start_trigger_drop(*def),
        SteamCall::Exchange { generate_def, destroy } => inv::start_exchange(*generate_def, destroy),
        SteamCall::Consume { item_id } => inv::start_consume(*item_id),
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
        WorkshopOp::Publish { codename, name_zh, entry_json } => {
            match steam_workshop::publish(client, STEAM_APP_ID, codename, name_zh, entry_json) {
                Ok(published_file_id) => WorkshopReply::Published { published_file_id },
                Err(error) => WorkshopReply::Failed(error),
            }
        }
        WorkshopOp::Resolve { codename } => match steam_workshop::resolve(client, STEAM_APP_ID, codename) {
            Ok(json) => WorkshopReply::Resolved(json),
            Err(error) => WorkshopReply::Failed(error),
        },
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
        })
        .collect()
}

fn pump_loop(
    app: AppHandle,
    game_state: SharedGameState,
    steam_state: SharedSteamState,
    client: steamworks::Client,
    rx: Receiver<SteamRequest>,
    workshop_rx: Receiver<WorkshopRequest>,
) {
    let mut grace = Grace(HashMap::new());
    let mut last_outbox = Instant::now() - OUTBOX_INTERVAL; // 启动立即巡检一次。
    let mut last_reconcile = Instant::now();

    loop {
        client.run_callbacks();

        // 命令请求（串行处理；SyncNow 触发立即巡检）。
        while let Ok(request) = rx.try_recv() {
            let sync_now = matches!(request.call, SteamCall::SyncNow);
            let outcome = perform(&client, &request.call);
            grace.touch(&outcome);
            let _ = request.reply.send(outcome);
            if sync_now {
                last_outbox = Instant::now() - OUTBOX_INTERVAL;
                last_reconcile = Instant::now() - RECONCILE_INTERVAL;
            }
        }

        // 创意工坊请求（同线程串行；每个内部泵 run_callbacks 等回调）。
        while let Ok(request) = workshop_rx.try_recv() {
            let reply = perform_workshop(&client, &request.op);
            let _ = request.reply.send(reply);
        }

        if steam_state.owner_mismatch() {
            std::thread::sleep(Duration::from_millis(100));
            continue; // 跨账号存档未确认前，不做任何自动同步。
        }

        if last_outbox.elapsed() >= OUTBOX_INTERVAL {
            last_outbox = Instant::now();
            outbox_pass(&app, &game_state, &steam_state, &client, &mut grace);
        }
        if last_reconcile.elapsed() >= RECONCILE_INTERVAL {
            last_reconcile = Instant::now();
            reconcile_pass(&app, &game_state, &steam_state, &client, &mut grace);
        }

        std::thread::sleep(Duration::from_millis(100));
    }
}

/// outbox 巡检：意图探测 → 认领 → 单飞重试一个到期 MintTier1。
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

    // 意图探测 + 认领（存档锁内，无 Steam 调用）。
    let due_mint = game::with_save(app, game_state, |config, save| {
        let mut changed = steam_sync::resolve_intents(config, save, &snapshot, now);
        changed |= steam_sync::attach_mints(save, &snapshot);
        let due = save.steam_outbox.iter().find_map(|op| match op {
            SteamOp::MintTier1 {
                op_id,
                def,
                next_retry_at,
                ..
            } if *next_retry_at <= now => Some((op_id.clone(), *def)),
            _ => None,
        });
        Ok((changed, due))
    });
    let (changed, due) = match due_mint {
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
    if let Some((op_id, def)) = due {
        let outcome = perform(client, &SteamCall::TriggerDrop { def });
        grace.touch(&outcome);
        let now = game::now_secs();
        let result = game::with_save(app, game_state, |_config, save| {
            let Some(index) = save.steam_outbox.iter().position(|op| {
                matches!(op, SteamOp::MintTier1 { op_id: id, .. } if *id == op_id)
            }) else {
                return Ok(false);
            };
            match &outcome {
                OpOutcome::Granted(items) if !items.is_empty() => {
                    // 精确按本次结果句柄绑定（00-decisions.md）。
                    if let SteamOp::MintTier1 { pet_id, def, .. } = save.steam_outbox[index].clone() {
                        if let Some(pet) = save.pets.iter_mut().find(|p| p.id == pet_id) {
                            pet.steam_item_id = Some(items[0].item_id.clone());
                            pet.steam_item_def = Some(def);
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
        if let Ok(mut unclaimed) = steam_state.0.unclaimed.lock() {
            *unclaimed = report.unclaimed;
        }
        if report.changed {
            let _ = app.emit("game://state", save);
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
    let pending = game::with_save(app, game_state, |_config, save| {
        Ok(save
            .steam_outbox
            .iter()
            .filter(|op| matches!(op, SteamOp::MintTier1 { .. }))
            .count())
    })
    .map(|(count, _)| count)
    .unwrap_or(0);
    let unclaimed = steam_state.0.unclaimed.lock().map(|u| u.len()).unwrap_or(0);
    steam_state.update_status(app, |s| {
        s.pending_mints = pending;
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
        return Err("Steam 集成已关闭（本地调试模式）".to_string());
    }
    let steam = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || match steam.call_blocking(SteamCall::SyncNow) {
        OpOutcome::Failed(error) => Err(error),
        _ => Ok(()),
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
            .ok_or_else(|| "Steam 未连接".to_string())?;
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
