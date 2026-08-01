//! Steam 工厂 Roguelike 最高营收排行榜。
//!
//! 该模块刻意不依赖 `LifetimeStats` / `GameSave` 的工厂字段：可信结算点通过
//! `record_factory_leaderboard_result` 把一局最终结果写入独立、按 SteamID 隔离的
//! 持久化 outbox；既有 Steam 泵线程再串行执行 Find → KeepBest Upload → 本人排名回读。
//! 旧 localStorage 数据不会经过这条命令，因此不会被自动上传。

use crate::game::SharedGameState;
use crate::steam::SharedSteamState;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, TryRecvError};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use steamworks::{
    Leaderboard, LeaderboardDataRequest, LeaderboardDisplayType, LeaderboardSortMethod,
    UploadScoreMethod,
};
use tauri::{AppHandle, Emitter, Manager};

pub const FACTORY_LEADERBOARD_API_NAME: &str = "LB_FACTORY_BEST_REVENUE";
/// 20,000 样本压力测试后冻结：覆盖“活到第 40 班”的 P99 营收包络。
/// Steam 分数 = floor(精确本地营收 / 100)；改这个常量会令新旧分数不可比较。
pub const FACTORY_REVENUE_SCORE_UNIT: u64 = 100;
pub const FACTORY_SCORE_SCHEMA_VERSION: i32 = 2;
const FACTORY_LEADERBOARD_DETAILS_MAX: usize = 15;
const FACTORY_LOADOUT_MAX: usize = 10;
const FACTORY_SPECIES_CODE_MAX: i32 = 84;
const STORE_FILE: &str = "factory-leaderboard-v1.json";
const CALLBACK_TIMEOUT: Duration = Duration::from_secs(15);
const RETRY_MINUTES: [i64; 4] = [1, 2, 5, 10];
static STORE_LOCK: Mutex<()> = Mutex::new(());

pub struct LeaderboardPageRequest {
    pub reply: mpsc::Sender<Result<FactoryLeaderboardPage, String>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactoryLeaderboardResult {
    /// 十进制整数字符串，避免 JS Number 在大营收时丢精度。
    pub revenue_total: String,
    pub best_shift: u32,
    pub endless: bool,
    pub balance_version: u32,
    pub loadout: Vec<i32>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FactoryLeaderboardEntry {
    pub rank: i32,
    pub steam_id: String,
    pub persona_name: String,
    pub score: i32,
    pub revenue_total: String,
    pub best_shift: Option<i32>,
    pub endless: Option<bool>,
    pub balance_version: Option<i32>,
    pub loadout: Option<Vec<i32>>,
    pub is_me: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FactoryLeaderboardPage {
    pub entries: Vec<FactoryLeaderboardEntry>,
    pub me: Option<FactoryLeaderboardEntry>,
    pub updated_at: i64,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FactoryLeaderboardStatus {
    pub api_name: String,
    pub score_unit: u64,
    pub local_best_revenue: Option<String>,
    pub steam_score: Option<i32>,
    pub pending: bool,
    pub global_rank: Option<i32>,
    pub leaderboard_available: bool,
    pub last_error: Option<String>,
    #[serde(default)]
    pub new_personal_best: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct LeaderboardStore {
    #[serde(default = "store_schema")]
    schema_version: u32,
    #[serde(default)]
    accounts: BTreeMap<String, AccountState>,
}

fn store_schema() -> u32 {
    1
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AccountState {
    #[serde(default)]
    local_best_revenue: Option<String>,
    #[serde(default)]
    local_best_score: Option<i32>,
    #[serde(default)]
    last_uploaded_score: Option<i32>,
    #[serde(default)]
    last_global_rank: Option<i32>,
    #[serde(default)]
    pending: Option<PendingScore>,
    #[serde(default)]
    leaderboard_available: bool,
    #[serde(default)]
    last_error: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PendingScore {
    revenue_total: String,
    score: i32,
    details: Vec<i32>,
    attempts: u32,
    next_retry_at: i64,
}

impl LeaderboardStore {
    fn status_for(&self, owner: &str) -> FactoryLeaderboardStatus {
        let account = self.accounts.get(owner);
        FactoryLeaderboardStatus {
            api_name: FACTORY_LEADERBOARD_API_NAME.to_string(),
            score_unit: FACTORY_REVENUE_SCORE_UNIT,
            local_best_revenue: account.and_then(|a| a.local_best_revenue.clone()),
            steam_score: account.and_then(|a| a.last_uploaded_score),
            pending: account.and_then(|a| a.pending.as_ref()).is_some(),
            global_rank: account.and_then(|a| a.last_global_rank),
            leaderboard_available: account.map(|a| a.leaderboard_available).unwrap_or(false),
            last_error: account.and_then(|a| a.last_error.clone()),
            new_personal_best: false,
        }
    }
}

fn store_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(STORE_FILE))
        .map_err(|error| error.to_string())
}

fn load_store(path: &Path) -> Result<LeaderboardStore, String> {
    match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map_err(|error| format!("排行榜 outbox 损坏（保留原文件，不上传）：{error}")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(LeaderboardStore {
            schema_version: store_schema(),
            ..LeaderboardStore::default()
        }),
        Err(error) => Err(format!("读取排行榜 outbox 失败：{error}")),
    }
}

fn save_store(path: &Path, store: &LeaderboardStore) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "排行榜 outbox 路径无父目录".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("创建排行榜 outbox 目录失败：{error}"))?;
    let bytes = serde_json::to_vec_pretty(store)
        .map_err(|error| format!("序列化排行榜 outbox 失败：{error}"))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, bytes).map_err(|error| format!("写排行榜 outbox 临时文件失败：{error}"))?;
    if !path.exists() {
        return fs::rename(&tmp, path).map_err(|error| format!("提交排行榜 outbox 失败：{error}"));
    }

    // Windows 不允许 rename 覆盖既有目标。先把旧文件挪到同目录备份，再提交新文件；
    // 第二步失败就回滚，避免「为更新 outbox 先删掉唯一副本」。
    let backup = path.with_extension("json.bak");
    if backup.exists() {
        fs::remove_file(&backup)
            .map_err(|error| format!("清理排行榜 outbox 旧备份失败：{error}"))?;
    }
    fs::rename(path, &backup).map_err(|error| format!("备份排行榜 outbox 失败：{error}"))?;
    match fs::rename(&tmp, path) {
        Ok(()) => {
            let _ = fs::remove_file(backup);
            Ok(())
        }
        Err(error) => {
            let _ = fs::rename(&backup, path);
            Err(format!("提交排行榜 outbox 失败：{error}"))
        }
    }
}

fn now_unix() -> i64 {
    chrono::Utc::now().timestamp()
}

fn parse_revenue(raw: &str) -> Result<u128, String> {
    let normalized = raw.trim();
    if normalized.is_empty() || !normalized.bytes().all(|b| b.is_ascii_digit()) {
        return Err("#factoryLeaderboardRevenueMustBeInteger".to_string());
    }
    normalized
        .parse::<u128>()
        .map_err(|_| "#factoryLeaderboardRevenueTooLarge".to_string())
}

pub fn scale_revenue(revenue: u128, unit: u64) -> Result<i32, String> {
    if unit == 0 {
        return Err("#factoryLeaderboardInvalidScoreUnit".to_string());
    }
    let scaled = revenue / u128::from(unit);
    i32::try_from(scaled).map_err(|_| "#factoryLeaderboardScoreOverflow".to_string())
}

fn checked_detail(value: u32, field: &str) -> Result<i32, String> {
    i32::try_from(value).map_err(|_| format!("#factoryLeaderboardInvalid{field}"))
}

fn enqueue(
    store: &mut LeaderboardStore,
    owner: &str,
    result: &FactoryLeaderboardResult,
    now: i64,
) -> Result<bool, String> {
    let revenue = parse_revenue(&result.revenue_total)?;
    let score = scale_revenue(revenue, FACTORY_REVENUE_SCORE_UNIT);
    let revenue_total = revenue.to_string();
    if result.loadout.len() > FACTORY_LOADOUT_MAX
        || result.loadout.iter().any(|code| !(1..=FACTORY_SPECIES_CODE_MAX).contains(code))
    {
        return Err("#factoryLeaderboardInvalidLoadout".to_string());
    }
    let mut details = vec![
        FACTORY_SCORE_SCHEMA_VERSION,
        checked_detail(result.best_shift, "BestShift")?,
        i32::from(result.endless),
        checked_detail(result.balance_version, "BalanceVersion")?,
        result.loadout.len() as i32,
    ];
    details.extend(result.loadout.iter().copied());
    let account = store.accounts.entry(owner.to_string()).or_default();

    let old_revenue = account
        .local_best_revenue
        .as_deref()
        .and_then(|value| value.parse::<u128>().ok())
        .unwrap_or(0);
    if revenue > old_revenue || account.local_best_revenue.is_none() {
        account.local_best_revenue = Some(revenue_total.clone());
    }

    let score = match score {
        Ok(score) => {
            if revenue >= old_revenue {
                account.local_best_score = Some(score);
            }
            score
        }
        Err(error) if error == "#factoryLeaderboardScoreOverflow" => {
            // 无限模式数学上无界。超过已冻结的 i32×100 可表示范围时，精确本地纪录
            // 仍已写入上方 local_best_revenue；不做饱和/截断，也不排一个会污染榜单的分数。
            account.last_error = Some(error);
            return Ok(false);
        }
        Err(error) => return Err(error),
    };

    let queued_score = account
        .pending
        .as_ref()
        .map(|p| p.score)
        .unwrap_or(i32::MIN);
    let uploaded_score = account.last_uploaded_score.unwrap_or(i32::MIN);
    if score <= queued_score.max(uploaded_score) {
        return Ok(false);
    }

    account.pending = Some(PendingScore {
        revenue_total,
        score,
        details,
        attempts: 0,
        next_retry_at: now,
    });
    account.last_error = None;
    Ok(true)
}

fn bound_owner(game_state: &SharedGameState) -> Result<String, String> {
    let guard = game_state
        .save
        .lock()
        .map_err(|_| "#gameStatePoisoned".to_string())?;
    guard
        .as_ref()
        .and_then(|save| save.steam_owner_id.clone())
        .ok_or_else(|| "#factoryLeaderboardNoBoundSteamAccount".to_string())
}

/// 只供升级后真实完成的新局调用；不要用它迁移旧 localStorage 最高分。
#[tauri::command]
pub fn record_factory_leaderboard_result(
    app: AppHandle,
    game: tauri::State<'_, SharedGameState>,
    steam: tauri::State<'_, SharedSteamState>,
    result: FactoryLeaderboardResult,
) -> Result<FactoryLeaderboardStatus, String> {
    if steam.owner_mismatch() {
        return Err("#steamOwnerMismatch".to_string());
    }
    let owner = bound_owner(game.inner())?;
    let path = store_path(&app)?;
    let _guard = STORE_LOCK
        .lock()
        .map_err(|_| "#factoryLeaderboardStorePoisoned".to_string())?;
    let mut store = load_store(&path)?;
    let previous_best = store
        .accounts
        .get(&owner)
        .and_then(|account| account.local_best_revenue.as_deref())
        .and_then(|value| value.parse::<u128>().ok());
    let submitted = parse_revenue(&result.revenue_total)?;
    let queued = enqueue(&mut store, &owner, &result, now_unix())?;
    save_store(&path, &store)?;
    let mut status = store.status_for(&owner);
    status.new_personal_best = previous_best.is_none_or(|best| submitted > best);
    drop(_guard);
    if queued {
        // fire-and-forget；Steam 离线时 outbox 保留，重连后的首次泵会补报。
        steam.kick_leaderboard();
    }
    Ok(status)
}

#[tauri::command]
pub fn get_factory_leaderboard_status(
    app: AppHandle,
    game: tauri::State<'_, SharedGameState>,
) -> Result<FactoryLeaderboardStatus, String> {
    let owner = bound_owner(game.inner())?;
    let path = store_path(&app)?;
    let _guard = STORE_LOCK
        .lock()
        .map_err(|_| "#factoryLeaderboardStorePoisoned".to_string())?;
    Ok(load_store(&path)?.status_for(&owner))
}

#[tauri::command]
pub async fn get_factory_leaderboard(
    steam: tauri::State<'_, SharedSteamState>,
) -> Result<FactoryLeaderboardPage, String> {
    let steam = steam.inner().clone();
    tauri::async_runtime::spawn_blocking(move || steam.leaderboard_page_blocking())
        .await
        .map_err(|error| error.to_string())?
}

fn wait_callback<T>(
    client: &steamworks::Client,
    rx: Receiver<T>,
    timeout: Duration,
) -> Result<T, String> {
    let started = Instant::now();
    loop {
        match rx.try_recv() {
            Ok(value) => return Ok(value),
            Err(TryRecvError::Disconnected) => {
                return Err("Steam 排行榜回调通道提前关闭".to_string())
            }
            Err(TryRecvError::Empty) if started.elapsed() >= timeout => {
                return Err("Steam 排行榜回调超时".to_string())
            }
            Err(TryRecvError::Empty) => {
                client.run_callbacks();
                std::thread::sleep(Duration::from_millis(10));
            }
        }
    }
}

fn find_leaderboard(client: &steamworks::Client) -> Result<Option<Leaderboard>, String> {
    let (tx, rx) = mpsc::channel();
    client
        .user_stats()
        .find_leaderboard(FACTORY_LEADERBOARD_API_NAME, move |result| {
            let _ = tx.send(result);
        });
    wait_callback(client, rx, CALLBACK_TIMEOUT)?
        .map_err(|error| format!("查找 Steam 排行榜失败：{error:?}"))
}

fn upload_score(
    client: &steamworks::Client,
    leaderboard: &Leaderboard,
    pending: &PendingScore,
) -> Result<steamworks::LeaderboardScoreUploaded, String> {
    let (tx, rx) = mpsc::channel();
    client.user_stats().upload_leaderboard_score(
        leaderboard,
        UploadScoreMethod::KeepBest,
        pending.score,
        pending.details.as_slice(),
        move |result| {
            let _ = tx.send(result);
        },
    );
    wait_callback(client, rx, CALLBACK_TIMEOUT)?
        .map_err(|error| format!("上传 Steam 排行榜失败：{error:?}"))?
        .ok_or_else(|| "Steam 排行榜拒绝了成绩".to_string())
}

fn download_self(
    client: &steamworks::Client,
    leaderboard: &Leaderboard,
    owner: u64,
) -> Result<Option<steamworks::LeaderboardEntry>, String> {
    let (tx, rx) = mpsc::channel();
    client.user_stats().download_leaderboard_entries(
        leaderboard,
        LeaderboardDataRequest::GlobalAroundUser,
        0,
        0,
        4,
        move |result| {
            let _ = tx.send(result);
        },
    );
    let entries = wait_callback(client, rx, CALLBACK_TIMEOUT)?
        .map_err(|error| format!("回读 Steam 排行榜失败：{error:?}"))?;
    Ok(entries.into_iter().find(|entry| entry.user.raw() == owner))
}

fn download_global(
    client: &steamworks::Client,
    leaderboard: &Leaderboard,
) -> Result<Vec<steamworks::LeaderboardEntry>, String> {
    let (tx, rx) = mpsc::channel();
    client.user_stats().download_leaderboard_entries(
        leaderboard,
        LeaderboardDataRequest::Global,
        1,
        100,
        FACTORY_LEADERBOARD_DETAILS_MAX,
        move |result| {
            let _ = tx.send(result);
        },
    );
    wait_callback(client, rx, CALLBACK_TIMEOUT)?
        .map_err(|error| format!("读取 Steam 全球排行榜失败：{error:?}"))
}

fn entry_payload(
    client: &steamworks::Client,
    entry: steamworks::LeaderboardEntry,
    owner: u64,
) -> FactoryLeaderboardEntry {
    let details = &entry.details;
    let is_v1 = details.first().copied() == Some(1) && details.len() >= 4;
    let is_v2 = details.first().copied() == Some(FACTORY_SCORE_SCHEMA_VERSION) && details.len() >= 5;
    let loadout = if is_v2 {
        let count = details[4].clamp(0, FACTORY_LOADOUT_MAX as i32) as usize;
        let end = 5usize.saturating_add(count).min(details.len());
        let codes = details[5..end]
            .iter()
            .copied()
            .filter(|code| (1..=FACTORY_SPECIES_CODE_MAX).contains(code))
            .collect::<Vec<_>>();
        (codes.len() == count).then_some(codes)
    } else {
        None
    };
    let steam_id = entry.user.raw();
    let fallback = format!("Steam …{}", steam_id % 10_000_000);
    let name = client.friends().get_friend(entry.user).name();
    FactoryLeaderboardEntry {
        rank: entry.global_rank,
        steam_id: steam_id.to_string(),
        persona_name: if name.trim().is_empty() || name == "[unknown]" { fallback } else { name },
        score: entry.score,
        revenue_total: (i128::from(entry.score.max(0)) * i128::from(FACTORY_REVENUE_SCORE_UNIT)).to_string(),
        best_shift: (is_v1 || is_v2).then_some(details[1]),
        endless: (is_v1 || is_v2).then_some(details[2] != 0),
        balance_version: (is_v1 || is_v2).then_some(details[3]),
        loadout,
        is_me: steam_id == owner,
    }
}

pub struct LeaderboardRuntime {
    leaderboard: Option<Leaderboard>,
}

impl LeaderboardRuntime {
    pub fn new() -> Self {
        Self { leaderboard: None }
    }

    fn ensure_leaderboard(&mut self, client: &steamworks::Client) -> Result<Leaderboard, String> {
        if let Some(leaderboard) = self.leaderboard.clone() {
            return Ok(leaderboard);
        }
        let leaderboard = find_leaderboard(client)?.ok_or_else(|| {
            format!(
                "Steamworks 中不存在排行榜 {}（正式版不会静默创建）",
                FACTORY_LEADERBOARD_API_NAME
            )
        })?;
        let stats = client.user_stats();
        if !matches!(
            stats.get_leaderboard_sort_method(&leaderboard),
            Some(LeaderboardSortMethod::Descending)
        ) {
            return Err("Steam 排行榜排序不是 Descending".to_string());
        }
        if !matches!(
            stats.get_leaderboard_display_type(&leaderboard),
            Some(LeaderboardDisplayType::Numeric)
        ) {
            return Err("Steam 排行榜显示类型不是 Numeric".to_string());
        }
        self.leaderboard = Some(leaderboard.clone());
        Ok(leaderboard)
    }

    pub fn reset_self(&mut self, client: &steamworks::Client) -> Result<(), String> {
        let leaderboard = self.ensure_leaderboard(client)?;
        let (tx, rx) = mpsc::channel();
        client.user_stats().upload_leaderboard_score(
            &leaderboard,
            UploadScoreMethod::ForceUpdate,
            0,
            &[FACTORY_SCORE_SCHEMA_VERSION, 0, 0, 0],
            move |result| {
                let _ = tx.send(result);
            },
        );
        wait_callback(client, rx, CALLBACK_TIMEOUT)?
            .map_err(|error| format!("清除 Steam 工厂排行榜失败：{error:?}"))?
            .ok_or_else(|| "Steam 拒绝清除工厂排行榜成绩".to_string())?;
        Ok(())
    }

    pub fn fetch_page(&mut self, client: &steamworks::Client) -> Result<FactoryLeaderboardPage, String> {
        let leaderboard = self.ensure_leaderboard(client)?;
        let owner = client.user().steam_id().raw();
        let mut global = download_global(client, &leaderboard)?;
        let mut me_raw = global.iter().find(|entry| entry.user.raw() == owner).cloned();
        if me_raw.is_none() {
            me_raw = download_self(client, &leaderboard, owner)?;
        }

        let friends = client.friends();
        for entry in global.iter().chain(me_raw.iter()) {
            let _ = friends.request_user_information(entry.user, true);
        }
        // Persona 缓存通常已热；给首次出现的非好友短暂时间回调，失败则使用 SteamID 回退。
        let until = Instant::now() + Duration::from_millis(600);
        while Instant::now() < until {
            client.run_callbacks();
            std::thread::sleep(Duration::from_millis(20));
        }

        let entries = global.drain(..).map(|entry| entry_payload(client, entry, owner)).collect::<Vec<_>>();
        let me = me_raw.map(|entry| entry_payload(client, entry, owner));
        Ok(FactoryLeaderboardPage { entries, me, updated_at: now_unix() })
    }

    /// 仅由 Steam 泵线程调用；失败写回退避时间并静默返回，不阻塞本地结算。
    pub fn pump_pass(&mut self, app: &AppHandle, client: &steamworks::Client, owner: &str) {
        let Ok(path) = store_path(app) else {
            return;
        };
        let pending = {
            let Ok(_guard) = STORE_LOCK.lock() else {
                return;
            };
            let Ok(store) = load_store(&path) else {
                return;
            };
            store
                .accounts
                .get(owner)
                .and_then(|account| account.pending.clone())
                .filter(|pending| pending.next_retry_at <= now_unix())
        };
        let Some(pending) = pending else {
            return;
        };

        let attempt = self.ensure_leaderboard(client).and_then(|leaderboard| {
            let uploaded = upload_score(client, &leaderboard, &pending)?;
            let readback = download_self(client, &leaderboard, client.user().steam_id().raw());
            Ok((uploaded, readback))
        });

        let status = {
            let Ok(_guard) = STORE_LOCK.lock() else {
                return;
            };
            let Ok(mut store) = load_store(&path) else {
                return;
            };
            let account = store.accounts.entry(owner.to_string()).or_default();
            match attempt {
                Ok((uploaded, readback)) => {
                    account.leaderboard_available = true;
                    account.last_uploaded_score = Some(
                        account
                            .last_uploaded_score
                            .unwrap_or(i32::MIN)
                            .max(uploaded.score)
                            .max(pending.score),
                    );
                    account.last_global_rank = Some(uploaded.global_rank_new);
                    account.last_error = None;
                    if matches!(account.pending.as_ref(), Some(current) if current.score <= pending.score)
                    {
                        account.pending = None;
                    }
                    match readback {
                        Ok(Some(entry)) => {
                            account.last_uploaded_score = Some(
                                account
                                    .last_uploaded_score
                                    .unwrap_or(i32::MIN)
                                    .max(entry.score),
                            );
                            account.last_global_rank = Some(entry.global_rank);
                        }
                        Ok(None) => {
                            account.last_error = Some("成绩已上传，但本人排名回读为空".to_string());
                        }
                        Err(error) => {
                            // 上传已经成功，绝不因排名回读失败重复提交；保留上传回调给出的排名。
                            account.last_error = Some(error);
                        }
                    }
                }
                Err(error) => {
                    account.leaderboard_available = false;
                    account.last_error = Some(error);
                    if let Some(current) = account.pending.as_mut() {
                        if current.score == pending.score {
                            current.attempts = current.attempts.saturating_add(1);
                            let retry_index = (current.attempts.saturating_sub(1) as usize)
                                .min(RETRY_MINUTES.len() - 1);
                            current.next_retry_at = now_unix() + RETRY_MINUTES[retry_index] * 60;
                        }
                    }
                }
            }
            if let Err(error) = save_store(&path, &store) {
                eprintln!("[steam-leaderboard] failed to persist result: {error}");
                return;
            }
            store.status_for(owner)
        };
        let _ = app.emit("factory://leaderboard", status);
    }
}

/// 调试页的一键从头测试：先清 Steam 本人成绩，成功后再清本地排行 outbox/历史。
#[tauri::command]
pub fn debug_clear_factory_leaderboard(
    app: AppHandle,
    game: tauri::State<'_, SharedGameState>,
    steam: tauri::State<'_, SharedSteamState>,
) -> Result<(), String> {
    crate::game::ensure_debug_build()?;
    let owner = bound_owner(game.inner())?;
    match steam.call_blocking(crate::steam::SteamCall::LeaderboardReset) {
        crate::steam_inventory::OpOutcome::Granted(_) => {}
        crate::steam_inventory::OpOutcome::Failed(error) => return Err(error),
        crate::steam_inventory::OpOutcome::Uncertain => {
            return Err("清除 Steam 工厂排行榜超时，结果未知，请重试".to_string())
        }
    }
    let path = store_path(&app)?;
    let _guard = STORE_LOCK
        .lock()
        .map_err(|_| "#factoryLeaderboardStorePoisoned".to_string())?;
    let mut store = load_store(&path)?;
    store.accounts.remove(&owner);
    save_store(&path, &store)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn result(revenue: &str) -> FactoryLeaderboardResult {
        FactoryLeaderboardResult {
            revenue_total: revenue.to_string(),
            best_shift: 12,
            endless: true,
            balance_version: 7,
            loadout: vec![1, 2, 3],
        }
    }

    #[test]
    fn scaling_is_integer_floor_and_rejects_i32_overflow() {
        assert_eq!(
            FACTORY_REVENUE_SCORE_UNIT, 100,
            "Steam 榜单口径已冻结为 ×100"
        );
        assert_eq!(scale_revenue(1_999, 1_000).unwrap(), 1);
        let ceiling = i32::MAX as u128 * u128::from(FACTORY_REVENUE_SCORE_UNIT);
        assert_eq!(
            scale_revenue(ceiling + 99, FACTORY_REVENUE_SCORE_UNIT).unwrap(),
            i32::MAX,
            "floor(revenue/100) 在最后 99 营收内仍可表示"
        );
        assert_eq!(
            scale_revenue(ceiling + 100, FACTORY_REVENUE_SCORE_UNIT).unwrap_err(),
            "#factoryLeaderboardScoreOverflow"
        );
        assert!(scale_revenue(1, 0).is_err());
    }

    #[test]
    fn lower_or_equal_scores_do_not_replace_pending_or_uploaded_best() {
        let mut store = LeaderboardStore::default();
        assert!(enqueue(&mut store, "A", &result("100"), 10).unwrap());
        assert!(!enqueue(&mut store, "A", &result("100"), 11).unwrap());
        assert!(!enqueue(&mut store, "A", &result("99"), 12).unwrap());
        assert_eq!(store.accounts["A"].pending.as_ref().unwrap().score, 1);

        store.accounts.get_mut("A").unwrap().pending = None;
        store.accounts.get_mut("A").unwrap().last_uploaded_score = Some(1);
        assert!(!enqueue(&mut store, "A", &result("100"), 13).unwrap());
        assert!(!enqueue(&mut store, "A", &result("50"), 14).unwrap());
    }

    #[test]
    fn a_higher_score_replaces_the_pending_score() {
        let mut store = LeaderboardStore::default();
        enqueue(&mut store, "A", &result("100"), 10).unwrap();
        assert!(enqueue(&mut store, "A", &result("250"), 11).unwrap());
        let pending = store.accounts["A"].pending.as_ref().unwrap();
        assert_eq!(pending.score, 2);
        assert_eq!(pending.attempts, 0);
        assert_eq!(pending.details, [2, 12, 1, 7, 3, 1, 2, 3]);
    }

    #[test]
    fn lineup_details_are_bounded_and_use_stable_positive_codes() {
        let mut store = LeaderboardStore::default();
        let mut too_many = result("100");
        too_many.loadout = vec![1; FACTORY_LOADOUT_MAX + 1];
        assert_eq!(enqueue(&mut store, "A", &too_many, 1).unwrap_err(), "#factoryLeaderboardInvalidLoadout");
        let mut invalid = result("100");
        invalid.loadout = vec![0, FACTORY_SPECIES_CODE_MAX + 1];
        assert_eq!(enqueue(&mut store, "A", &invalid, 1).unwrap_err(), "#factoryLeaderboardInvalidLoadout");
    }

    #[test]
    fn queues_are_isolated_by_steam_owner() {
        let mut store = LeaderboardStore::default();
        enqueue(&mut store, "A", &result("100"), 10).unwrap();
        enqueue(&mut store, "B", &result("200"), 10).unwrap();
        assert_eq!(store.accounts["A"].pending.as_ref().unwrap().score, 1);
        assert_eq!(store.accounts["B"].pending.as_ref().unwrap().score, 2);
        assert_eq!(
            store.status_for("A").local_best_revenue.as_deref(),
            Some("100")
        );
        assert_eq!(
            store.status_for("B").local_best_revenue.as_deref(),
            Some("200")
        );
    }

    #[test]
    fn persistent_outbox_roundtrips_and_replaces_safely() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "gulugulu-leaderboard-test-{}-{unique}",
            std::process::id()
        ));
        let path = dir.join(STORE_FILE);
        let mut store = LeaderboardStore::default();
        enqueue(&mut store, "A", &result("100"), 10).unwrap();
        save_store(&path, &store).unwrap();
        assert_eq!(
            load_store(&path).unwrap().accounts["A"]
                .pending
                .as_ref()
                .unwrap()
                .score,
            1
        );

        enqueue(&mut store, "A", &result("250"), 11).unwrap();
        save_store(&path, &store).unwrap();
        assert_eq!(
            load_store(&path).unwrap().accounts["A"]
                .pending
                .as_ref()
                .unwrap()
                .score,
            2
        );
        assert!(!path.with_extension("json.bak").exists());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn overflow_keeps_exact_local_best_without_queuing_a_wrong_score() {
        let mut store = LeaderboardStore::default();
        let overflow = (i32::MAX as u128 + 1) * u128::from(FACTORY_REVENUE_SCORE_UNIT);
        let exact = overflow.to_string();
        assert!(!enqueue(&mut store, "A", &result(&exact), 10).unwrap());
        let account = &store.accounts["A"];
        assert_eq!(account.local_best_revenue.as_deref(), Some(exact.as_str()));
        assert!(account.pending.is_none());
        assert_eq!(
            account.last_error.as_deref(),
            Some("#factoryLeaderboardScoreOverflow")
        );
    }

    #[test]
    fn rejects_non_integer_revenue_and_oversized_details() {
        let mut store = LeaderboardStore::default();
        assert!(enqueue(&mut store, "A", &result("12.5"), 10).is_err());
        let mut invalid = result("100");
        invalid.best_shift = u32::MAX;
        assert!(enqueue(&mut store, "A", &invalid, 10).is_err());
    }

    #[test]
    #[ignore = "一次性真机配置：会在 Steamworks 为 4956830 创建正式工厂排行榜"]
    fn steam_provision_factory_leaderboard() {
        let client = steamworks::Client::init_app(crate::steam::STEAM_APP_ID)
            .expect("Steam 客户端未连接或账号没有 App 许可");
        let (tx, rx) = mpsc::channel();
        client.user_stats().find_or_create_leaderboard(
            FACTORY_LEADERBOARD_API_NAME,
            LeaderboardSortMethod::Descending,
            LeaderboardDisplayType::Numeric,
            move |result| {
                let _ = tx.send(result);
            },
        );
        let leaderboard = wait_callback(&client, rx, CALLBACK_TIMEOUT)
            .expect("FindOrCreateLeaderboard 回调失败")
            .expect("Steamworks 创建排行榜失败")
            .expect("Steamworks 没有返回排行榜 handle");
        let stats = client.user_stats();
        assert!(matches!(
            stats.get_leaderboard_sort_method(&leaderboard),
            Some(LeaderboardSortMethod::Descending)
        ));
        assert!(matches!(
            stats.get_leaderboard_display_type(&leaderboard),
            Some(LeaderboardDisplayType::Numeric)
        ));
    }

    #[test]
    #[ignore = "真机只读冒烟：需 Steam 客户端、拥有 4956830 的账号且后台已创建排行榜"]
    fn steam_configuration_is_descending_numeric() {
        let client = steamworks::Client::init_app(crate::steam::STEAM_APP_ID)
            .expect("Steam 客户端未连接或账号没有 App 许可");
        let leaderboard = find_leaderboard(&client)
            .expect("FindLeaderboard 调用失败")
            .expect("Steamworks 尚未创建 LB_FACTORY_BEST_REVENUE");
        let stats = client.user_stats();
        assert!(matches!(
            stats.get_leaderboard_sort_method(&leaderboard),
            Some(LeaderboardSortMethod::Descending)
        ));
        assert!(matches!(
            stats.get_leaderboard_display_type(&leaderboard),
            Some(LeaderboardDisplayType::Numeric)
        ));
    }

    #[test]
    #[ignore = "真机写入冒烟：向正式榜提交可被后续真实成绩覆盖的 0 分，并回读本人条目"]
    fn steam_upload_and_readback_roundtrip() {
        let client = steamworks::Client::init_app(crate::steam::STEAM_APP_ID)
            .expect("Steam 客户端未连接或账号没有 App 许可");
        let leaderboard = find_leaderboard(&client)
            .expect("FindLeaderboard 调用失败")
            .expect("Steamworks 尚未创建 LB_FACTORY_BEST_REVENUE");
        let pending = PendingScore {
            revenue_total: "0".to_string(),
            score: 0,
            details: vec![FACTORY_SCORE_SCHEMA_VERSION, 0, 0, 0, 0],
            attempts: 0,
            next_retry_at: 0,
        };
        let uploaded =
            upload_score(&client, &leaderboard, &pending).expect("UploadLeaderboardScore 写入失败");
        assert_eq!(uploaded.score, 0);
        assert!(uploaded.global_rank_new >= 1);

        let entry = download_self(&client, &leaderboard, client.user().steam_id().raw())
            .expect("DownloadLeaderboardEntries 回读失败")
            .expect("上传成功后未找到本人榜单条目");
        assert_eq!(entry.score, 0);
        assert!(entry.global_rank >= 1);
        assert_eq!(entry.details, vec![FACTORY_SCORE_SCHEMA_VERSION, 0, 0, 0]);
    }
}
