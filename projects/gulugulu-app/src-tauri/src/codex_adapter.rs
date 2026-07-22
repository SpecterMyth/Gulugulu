use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::env;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant, SystemTime};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Debug, Default)]
struct CodexStateInner {
    codex_home: Option<PathBuf>,
    claude_home: Option<PathBuf>,
    latest_session: Option<PathBuf>,
    current_project: Option<String>,
    watching: bool,
    codex_watching: bool,
    claude_code_watching: bool,
    active_source: Option<String>,
    error: Option<String>,
    total_tokens: u64,
    experience: u64,
    /// 某源最近一次有**新会话内容**到达的时刻（不序列化，仅内部判活）。启动时采纳的
    /// 陈旧历史会话不会产生新事件 → 恒 None → snapshot 不判为在线，修「几天前的会话永远显示在线」。
    codex_last_active: Option<Instant>,
    claude_last_active: Option<Instant>,
}

/// 在线判定窗口：某源最近一次有新内容到达在此窗口内才算"在线"。足够长以容忍长
/// 回合/读输出的停顿，又能让关掉或很久以前的会话较快落回"寻找 Agent"。
const ACTIVE_WINDOW: Duration = Duration::from_secs(180);

#[derive(Clone, Debug, Default)]
pub struct SharedCodexState(Arc<Mutex<CodexStateInner>>);

/// Token 四分口径明细。四项互不重叠，`total()` 即 raw 总量。
///
/// 两家 CLI 的 usage 语义不同，各自在解析处折算成同一套四分：
/// - Anthropic：`input_tokens` / `cache_creation_input_tokens` /
///   `cache_read_input_tokens` / `output_tokens` 天然四分，直接对应。
/// - Codex：只报 `input_tokens`（**已含**缓存）与 `cached_input_tokens`（缓存读），
///   不区分写缓存 → `input = input_tokens - cached_input_tokens`、
///   `cache_read = cached_input_tokens`、`cache_create` 恒 0。
///
/// 两侧都满足 `total() == usage.total_tokens`，四分与总量永不打架。
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TokenBreakdown {
    pub input: u64,
    pub cache_create: u64,
    pub cache_read: u64,
    pub output: u64,
}

impl TokenBreakdown {
    pub fn total(&self) -> u64 {
        self.input
            .saturating_add(self.cache_create)
            .saturating_add(self.cache_read)
            .saturating_add(self.output)
    }

    pub fn is_zero(&self) -> bool {
        *self == Self::default()
    }

    pub fn add(&mut self, other: &Self) {
        self.input = self.input.saturating_add(other.input);
        self.cache_create = self.cache_create.saturating_add(other.cache_create);
        self.cache_read = self.cache_read.saturating_add(other.cache_read);
        self.output = self.output.saturating_add(other.output);
    }

    /// 逐项饱和相减（账本差分用；任一项回退都记 0 而非绕回）。
    pub fn saturating_sub(&self, other: &Self) -> Self {
        Self {
            input: self.input.saturating_sub(other.input),
            cache_create: self.cache_create.saturating_sub(other.cache_create),
            cache_read: self.cache_read.saturating_sub(other.cache_read),
            output: self.output.saturating_sub(other.output),
        }
    }
}

/// 单个时间窗的 Token 统计：raw 总量 + 四分明细。
/// `total` 沿用 raw 口径（含 cache_read），四分供公告板「详情」页展开。
///
/// 四分账本晚于 raw 账本上线，历史天/历史项目只有 total 没有明细，因此
/// `total >= breakdown.total()`，差额由前端显示为「未分类」。
#[derive(Clone, Copy, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenWindow {
    pub total: u64,
    #[serde(flatten)]
    pub breakdown: TokenBreakdown,
}

/// 全局 Token 累计的多时间窗聚合。`all` = 所有项目的历史累计和；
/// `d1`/`w1`/`m1` = 最近 1/7/30 天的增量和，来自 `ProgressStore` 的每日桶
/// （账本引入前的历史只进 `all`）。
#[derive(Clone, Copy, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenStats {
    pub all: TokenWindow,
    pub d1: TokenWindow,
    pub w1: TokenWindow,
    pub m1: TokenWindow,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexStatus {
    pub codex_home: Option<String>,
    pub claude_home: Option<String>,
    pub watching: bool,
    pub codex_watching: bool,
    pub claude_code_watching: bool,
    pub latest_session: Option<String>,
    pub active_source: Option<String>,
    pub project_path: Option<String>,
    pub error: Option<String>,
    /// 兼容字段：等于 `token_stats.all`（全局历史累计），供旧读取点使用。
    pub total_tokens: u64,
    pub experience: u64,
    /// 全局 Token 的多时间窗聚合（默认展示 `all`，公告板可切 1d/1w/1m）。
    pub token_stats: TokenStats,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub cached_input_tokens: u64,
    pub output_tokens: u64,
    pub reasoning_output_tokens: u64,
    pub total_tokens: u64,
    /// 这份 usage 的四分明细（见 `TokenBreakdown`）。`breakdown.total()`
    /// 恒等于 `total_tokens`——统计与喂养都从这里取，口径永不分叉。
    pub breakdown: TokenBreakdown,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexActivityEvent {
    pub source: String,
    pub session_id: String,
    pub timestamp: String,
    pub kind: String,
    pub project_path: Option<String>,
    pub token_delta: u64,
    pub experience_delta: u64,
    pub project_total_tokens: u64,
    pub project_experience: u64,
    /// 本事件新增的产出 token（output-only；v1.2 喂养口径，餐级/Toast 数字用）。
    pub output_token_delta: u64,
    /// 项目累计产出 token（喂养账本口径；input/cache 不计，raw 账本另存 total_tokens）。
    pub project_output_tokens: u64,
    /// 项目累计四分明细（统计详情页与加权喂养的账本锚点）。
    pub project_breakdown: TokenBreakdown,
    /// 本次事件实际喂进陪伴宠的经验点数（game 层，token→经验，2026-07-21 起）。
    pub fed_exp: u64,
    /// 本次喂养是否触发了陪伴宠升级（前端庆祝演出用）。
    pub fed_leveled_up: bool,
    /// 本次真正吃进去的四分 token（账本差分结果）。前端据此报
    /// 「吃到 N 个产出 Token」——必须是**吃到的**而非本事件解析到的，
    /// 两者在补账/多事件合并时会不一致。
    pub fed_breakdown: TokenBreakdown,
    /// 吃到这餐的陪伴宠（前端 Token 飞行 FX 的锚点；None = 无陪伴宠）。
    pub fed_pet_id: Option<String>,
    pub total_usage: Option<TokenUsage>,
    pub last_usage: Option<TokenUsage>,
}

#[derive(Clone, Debug, Default)]
struct CodexParseState {
    waiting_for_agent_output: bool,
}

#[derive(Clone, Debug, Default)]
struct ClaudeCodeParseState {
    waiting_for_agent_output: bool,
}

#[derive(Clone, Debug)]
struct AgentTokenEvent {
    source: String,
    project_path: String,
    session_id: String,
    session_path: String,
    timestamp: String,
    token_delta: u64,
    /// 本事件的产出 token 增量（output-only 喂养口径）。
    output_token_delta: u64,
    /// 本事件的四分 token 增量（统计明细 + 加权喂养的来源）。
    breakdown_delta: TokenBreakdown,
    total_usage: Option<TokenUsage>,
    last_usage: Option<TokenUsage>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressStore {
    projects: BTreeMap<String, ProjectProgress>,
    /// 全局每日 raw Token 增量桶：key = 本地天序号（见 `current_day_index`），
    /// value = 当天新增的 raw total_tokens。仅保留最近 ~40 天，服务公告板
    /// 1d/1w/1m 时间窗的**总量**；`all` 仍从各项目 total_tokens 求和。
    #[serde(default)]
    daily_tokens: BTreeMap<u64, u64>,
    /// 同上，但记四分明细——公告板「详情」页的数据源。晚于 `daily_tokens`
    /// 上线，早期天缺明细，故同一天可能 `daily_tokens > daily_breakdown.total()`。
    #[serde(default)]
    daily_breakdown: BTreeMap<u64, TokenBreakdown>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectProgress {
    project_path: String,
    total_tokens: u64,
    experience: u64,
    /// 累计产出 token（output-only，v1.2 喂养口径）。raw 口径的 total_tokens
    /// 继续承担经验统计，两账并行互不影响。
    #[serde(default)]
    output_tokens: u64,
    /// 累计四分明细（公告板「详情」页 + 喂养加权换算的数据源）。
    /// 晚于 raw/output 两本账上线，历史项目 `breakdown.total() < total_tokens`。
    #[serde(default)]
    breakdown: TokenBreakdown,
    sources: AgentSources,
    updated_at: String,
}

impl ProjectProgress {
    fn new(project_path: String) -> Self {
        Self {
            project_path,
            total_tokens: 0,
            experience: 0,
            output_tokens: 0,
            breakdown: TokenBreakdown::default(),
            sources: AgentSources::default(),
            updated_at: String::new(),
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentSources {
    codex: CodexSourceProgress,
    claude_code: ClaudeCodeSourceProgress,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodexSourceProgress {
    session_offsets: BTreeMap<String, u64>,
    session_totals: BTreeMap<String, u64>,
    /// 会话级产出 token 锚点（fallback 差分用；口径同 project.output_tokens）。
    #[serde(default)]
    session_output_totals: BTreeMap<String, u64>,
    /// 会话级四分明细锚点（fallback 差分用；口径同 project.breakdown）。
    #[serde(default)]
    session_breakdown_totals: BTreeMap<String, TokenBreakdown>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeCodeSourceProgress {
    #[serde(default)]
    session_offsets: BTreeMap<String, u64>,
    #[serde(default)]
    session_totals: BTreeMap<String, u64>,
    #[serde(default)]
    session_output_totals: BTreeMap<String, u64>,
    #[serde(default)]
    session_breakdown_totals: BTreeMap<String, TokenBreakdown>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct GuluguluConfig {
    codex_home: Option<String>,
}

impl SharedCodexState {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(CodexStateInner {
            codex_home: discover_codex_home(),
            claude_home: discover_claude_home(),
            ..CodexStateInner::default()
        })))
    }

    pub fn snapshot(&self) -> CodexStatus {
        let state = self.0.lock().expect("codex state poisoned");
        // 在线 = 「在跟踪某会话文件」且「该源最近有新内容」。仅"跟踪到文件"不算在线——
        // 否则启动即采纳的陈旧历史日志会让状态栏永久显示在线（见 codex_last_active）。
        let now = Instant::now();
        let recent = |at: Option<Instant>| at.is_some_and(|t| now.duration_since(t) < ACTIVE_WINDOW);
        let codex_online = state.codex_watching && recent(state.codex_last_active);
        let claude_online = state.claude_code_watching && recent(state.claude_last_active);
        CodexStatus {
            codex_home: state.codex_home.as_ref().map(path_to_string),
            claude_home: state.claude_home.as_ref().map(path_to_string),
            watching: codex_online || claude_online,
            codex_watching: codex_online,
            claude_code_watching: claude_online,
            latest_session: state.latest_session.as_ref().map(path_to_string),
            active_source: state.active_source.clone(),
            project_path: state.current_project.clone(),
            error: state.error.clone(),
            total_tokens: state.total_tokens,
            experience: state.experience,
            token_stats: TokenStats::default(),
        }
    }

    pub fn set_codex_home(&self, codex_home: PathBuf) {
        let mut state = self.0.lock().expect("codex state poisoned");
        state.codex_home = Some(codex_home);
        state.latest_session = None;
        state.error = None;
    }

    pub fn load_config(&self, app: &AppHandle) {
        let Ok(config_path) = config_path(app) else {
            return;
        };

        let Ok(contents) = fs::read_to_string(config_path) else {
            return;
        };

        let Ok(config) = serde_json::from_str::<GuluguluConfig>(&contents) else {
            return;
        };

        if let Some(codex_home) = config.codex_home {
            let path = PathBuf::from(codex_home);
            if path.exists() {
                self.set_codex_home(path);
            }
        }
    }

    pub fn save_config(&self, app: &AppHandle) -> Result<(), String> {
        let config_path = config_path(app)?;
        let config_dir = config_path
            .parent()
            .ok_or_else(|| "Unable to resolve app config directory.".to_string())?;
        fs::create_dir_all(config_dir).map_err(|error| error.to_string())?;

        let state = self
            .0
            .lock()
            .map_err(|_| "Codex state poisoned.".to_string())?;
        let config = GuluguluConfig {
            codex_home: state.codex_home.as_ref().map(path_to_string),
        };
        let contents = serde_json::to_string_pretty(&config).map_err(|error| error.to_string())?;
        fs::write(config_path, contents).map_err(|error| error.to_string())
    }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join("gulugulu.json"))
        .map_err(|error| error.to_string())
}

fn progress_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("gulugulu-progress.json"))
        .map_err(|error| error.to_string())
}

pub fn spawn_codex_watcher(app: AppHandle, state: SharedCodexState) {
    thread::spawn(move || {
        let mut active_file: Option<PathBuf> = None;
        let mut offset: u64 = 0;
        let mut parse_state = CodexParseState::default();
        let mut active_project: Option<String> = None;
        let mut last_error_emit: Option<(String, Instant)> = None;
        let mut started_sessions: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();

        loop {
            let codex_home = state
                .0
                .lock()
                .ok()
                .and_then(|guard| guard.codex_home.clone());

            let Some(codex_home) = codex_home else {
                if state_has_claude_home(&state) {
                    thread::sleep(Duration::from_secs(2));
                    continue;
                }
                set_error(&state, "codex", "Codex home not found.");
                emit_error_debounced(&app, "codex", "Codex home not found.", &mut last_error_emit);
                thread::sleep(Duration::from_secs(2));
                continue;
            };

            let latest = latest_session_file(&codex_home);
            let Some(latest) = latest else {
                if state_has_claude_home(&state) {
                    thread::sleep(Duration::from_secs(2));
                    continue;
                }
                set_error(&state, "codex", "No Codex session files found.");
                emit_error_debounced(
                    &app,
                    "codex",
                    "No Codex session files found.",
                    &mut last_error_emit,
                );
                thread::sleep(Duration::from_secs(2));
                continue;
            };

            if active_file.as_ref() != Some(&latest) {
                // 切走前对旧文件做一次追读：并发会话按 mtime 翻牌时，落败会话的尾部
                // （收尾 token_count）本会永久无人读到。offset 逐会话持久化，追读幂等。
                if let (Some(prev_file), Some(prev_project)) =
                    (active_file.as_ref(), active_project.as_ref())
                {
                    if let Ok((prev_offset, events)) =
                        read_new_events(prev_file, offset, &mut parse_state)
                    {
                        let _ = update_codex_session_offset(&app, prev_project, prev_file, prev_offset);
                        if !events.is_empty() {
                            mark_source_active(&state, "codex");
                            process_session_events(
                                &app, &state, "codex", prev_file, prev_project, events,
                                &mut last_error_emit,
                            );
                        }
                    }
                }

                active_file = Some(latest.clone());
                parse_state = CodexParseState::default();
                let file_len = file_len(&latest).unwrap_or(0);
                let project_path =
                    extract_project_path(&latest).unwrap_or_else(|| "Unknown project".to_string());
                active_project = Some(project_path.clone());
                offset = prepare_codex_session(&app, &project_path, &latest, file_len)
                    .unwrap_or(file_len);
                let progress = project_progress_snapshot(&app, &project_path)
                    .ok()
                    .flatten();
                mark_watching(&state, "codex", &latest, &project_path, progress.as_ref());
                // 翻牌抖动抑制：同一进程内已 session_started 过的文件不再重复发，
                // 否则 pet_idle 会反复把宠物踢出工作动画（session_started→pet_idle）。
                if started_sessions.insert(latest.clone()) {
                    emit_activity(
                        &app,
                        "codex",
                        session_id_from_path(&latest),
                        "session_started",
                        Some(project_path),
                        progress.as_ref(),
                        None,
                        None,
                    );
                }
            }

            match read_new_events(&latest, offset, &mut parse_state) {
                Ok((new_offset, events)) => {
                    offset = new_offset;
                    if let Some(project_path) = &active_project {
                        let _ = update_codex_session_offset(&app, project_path, &latest, offset);
                        if !events.is_empty() {
                            mark_source_active(&state, "codex");
                            process_session_events(
                                &app, &state, "codex", &latest, project_path, events,
                                &mut last_error_emit,
                            );
                        }
                    }
                }
                Err(error) => {
                    set_error(&state, "codex", &error);
                    emit_error_debounced(&app, "codex", &error, &mut last_error_emit);
                }
            }

            thread::sleep(Duration::from_millis(750));
        }
    });
}

pub fn spawn_claude_code_watcher(app: AppHandle, state: SharedCodexState) {
    thread::spawn(move || {
        let mut active_file: Option<PathBuf> = None;
        let mut offset: u64 = 0;
        let mut parse_state = ClaudeCodeParseState::default();
        let mut active_project: Option<String> = None;
        let mut last_error_emit: Option<(String, Instant)> = None;
        let mut started_sessions: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();

        loop {
            let claude_home = state
                .0
                .lock()
                .ok()
                .and_then(|guard| guard.claude_home.clone());

            let Some(claude_home) = claude_home else {
                thread::sleep(Duration::from_secs(2));
                continue;
            };

            let latest = latest_claude_code_session_file(&claude_home);
            let Some(latest) = latest else {
                thread::sleep(Duration::from_secs(2));
                continue;
            };

            if active_file.as_ref() != Some(&latest) {
                // 切走前对旧文件追读一次，避免并发会话翻牌丢尾部（见 codex watcher 同款注释）。
                if let (Some(prev_file), Some(prev_project)) =
                    (active_file.as_ref(), active_project.as_ref())
                {
                    if let Ok((prev_offset, events)) =
                        read_new_claude_code_events(prev_file, offset, &mut parse_state)
                    {
                        let _ = update_claude_code_session_offset(
                            &app, prev_project, prev_file, prev_offset,
                        );
                        if !events.is_empty() {
                            mark_source_active(&state, "claudeCode");
                            process_session_events(
                                &app, &state, "claudeCode", prev_file, prev_project, events,
                                &mut last_error_emit,
                            );
                        }
                    }
                }

                active_file = Some(latest.clone());
                parse_state = ClaudeCodeParseState::default();
                let file_len = file_len(&latest).unwrap_or(0);
                let project_path = extract_claude_code_project_path(&latest)
                    .or_else(|| project_path_from_claude_code_session_path(&latest, &claude_home))
                    .unwrap_or_else(|| "Unknown project".to_string());
                active_project = Some(project_path.clone());
                offset = prepare_claude_code_session(&app, &project_path, &latest, file_len)
                    .unwrap_or(file_len);
                let progress = project_progress_snapshot(&app, &project_path)
                    .ok()
                    .flatten();
                mark_watching(
                    &state,
                    "claudeCode",
                    &latest,
                    &project_path,
                    progress.as_ref(),
                );
                if started_sessions.insert(latest.clone()) {
                    emit_activity(
                        &app,
                        "claudeCode",
                        session_id_from_path(&latest),
                        "session_started",
                        Some(project_path),
                        progress.as_ref(),
                        None,
                        None,
                    );
                }
            }

            match read_new_claude_code_events(&latest, offset, &mut parse_state) {
                Ok((new_offset, events)) => {
                    offset = new_offset;
                    if let Some(project_path) = &active_project {
                        let _ =
                            update_claude_code_session_offset(&app, project_path, &latest, offset);
                        if !events.is_empty() {
                            mark_source_active(&state, "claudeCode");
                            process_session_events(
                                &app, &state, "claudeCode", &latest, project_path, events,
                                &mut last_error_emit,
                            );
                        }
                    }
                }
                Err(error) => {
                    set_error(&state, "claudeCode", &error);
                    emit_error_debounced(&app, "claudeCode", &error, &mut last_error_emit);
                }
            }

            thread::sleep(Duration::from_millis(750));
        }
    });
}

/// 读取 [offset, EOF) 里的**完整行**（以 '\n' 结尾），逐行交给 `parse`。
/// 返回的新 offset 只推进到最后一个换行处——半行（可能被上游 8KB 缓冲切在
/// UTF-8 多字节中间或半截 JSON）留到下一轮，避免两类静默故障：
/// (a) 把半行当整行解析后丢弃、下一轮又从行中读起 → 整条 token_count 丢失（少喂）；
/// (b) offset 落在 UTF-8 字节中间 → `BufRead::lines()` 首行即报错、offset 永不前进、
///     watcher 每 750ms 死循环刷同一条错（把宠物钉在 error 态）。
/// 用 `from_utf8_lossy` 逐行解码：坏字节只毁一行，不再毁掉整批读取。
fn read_complete_lines<F>(path: &Path, offset: u64, mut parse: F) -> Result<u64, String>
where
    F: FnMut(&str),
{
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let len = file.metadata().map_err(|error| error.to_string())?.len();
    let safe_offset = offset.min(len);
    file.seek(SeekFrom::Start(safe_offset))
        .map_err(|error| error.to_string())?;

    let mut buf = Vec::new();
    file.read_to_end(&mut buf).map_err(|error| error.to_string())?;

    let mut consumed = 0usize; // 已消费到「最后一个 '\n' 之后」的字节数
    for chunk in buf.split_inclusive(|&b| b == b'\n') {
        // split_inclusive 的末段若不以 '\n' 结尾 = 半行，跳过留到下一轮。
        if chunk.last() != Some(&b'\n') {
            break;
        }
        let line = String::from_utf8_lossy(chunk);
        parse(line.trim_end_matches(|c| c == '\n' || c == '\r'));
        consumed += chunk.len();
    }
    Ok(safe_offset + consumed as u64)
}

fn read_new_events(
    path: &Path,
    offset: u64,
    parse_state: &mut CodexParseState,
) -> Result<(u64, Vec<CodexActivityEvent>), String> {
    let mut events = Vec::new();
    let session_id = session_id_from_path(path);
    let new_offset = read_complete_lines(path, offset, |line| {
        events.extend(parse_codex_line(line, &session_id, parse_state));
    })?;
    Ok((new_offset, events))
}

fn read_new_claude_code_events(
    path: &Path,
    offset: u64,
    parse_state: &mut ClaudeCodeParseState,
) -> Result<(u64, Vec<CodexActivityEvent>), String> {
    let mut events = Vec::new();
    let session_id = session_id_from_path(path);
    let new_offset = read_complete_lines(path, offset, |line| {
        events.extend(parse_claude_code_line(line, &session_id, parse_state));
    })?;
    Ok((new_offset, events))
}

fn parse_claude_code_line(
    line: &str,
    session_id: &str,
    parse_state: &mut ClaudeCodeParseState,
) -> Vec<CodexActivityEvent> {
    let Some(value) = serde_json::from_str::<Value>(line).ok() else {
        return Vec::new();
    };
    let timestamp = value
        .get("timestamp")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let Some(entry_type) = value.get("type").and_then(Value::as_str) else {
        return Vec::new();
    };

    match entry_type {
        "user" => parse_claude_code_user_message(&value, session_id, timestamp, parse_state),
        "assistant" => {
            parse_claude_code_assistant_message(&value, session_id, timestamp, parse_state)
        }
        "summary" | "ai-title" => {
            vec![activity(
                "claudeCode",
                session_id,
                timestamp,
                "session_started",
            )]
        }
        _ => Vec::new(),
    }
}

fn parse_claude_code_user_message(
    value: &Value,
    session_id: &str,
    timestamp: String,
    parse_state: &mut ClaudeCodeParseState,
) -> Vec<CodexActivityEvent> {
    let content_items = claude_code_content_items(value);
    let has_tool_result = content_items.iter().any(|item| {
        item.get("type")
            .and_then(Value::as_str)
            .map(|content_type| content_type == "tool_result")
            .unwrap_or(false)
    });

    if has_tool_result {
        return vec![activity(
            "claudeCode",
            session_id,
            timestamp,
            "tool_finished",
        )];
    }

    parse_state.waiting_for_agent_output = true;
    vec![activity(
        "claudeCode",
        session_id,
        timestamp,
        "agent_thinking_start",
    )]
}

fn parse_claude_code_assistant_message(
    value: &Value,
    session_id: &str,
    timestamp: String,
    parse_state: &mut ClaudeCodeParseState,
) -> Vec<CodexActivityEvent> {
    let content_items = claude_code_content_items(value);
    let has_tool_use = content_items.iter().any(|item| {
        item.get("type")
            .and_then(Value::as_str)
            .map(|content_type| content_type == "tool_use")
            .unwrap_or(false)
    });
    let has_text = content_items.iter().any(|item| {
        item.get("type")
            .and_then(Value::as_str)
            .map(|content_type| content_type == "text")
            .unwrap_or(false)
    });

    let mut events = first_claude_code_agent_output_events(
        parse_state,
        session_id,
        timestamp.clone(),
        if has_tool_use {
            "tool_started"
        } else {
            "message_seen"
        },
    );

    if let Some(usage) = claude_code_usage(value) {
        events.push(CodexActivityEvent {
            source: "claudeCode".to_string(),
            session_id: session_id.to_string(),
            timestamp: timestamp.clone(),
            kind: "token_count".to_string(),
            project_path: None,
            token_delta: usage.total_tokens,
            experience_delta: 0,
            project_total_tokens: 0,
            project_experience: 0,
            output_token_delta: usage.output_tokens,
            project_output_tokens: 0,
            project_breakdown: TokenBreakdown::default(),
            fed_exp: 0,
            fed_leveled_up: false,
            fed_breakdown: TokenBreakdown::default(),
            fed_pet_id: None,
            total_usage: Some(usage.clone()),
            last_usage: Some(usage),
        });
    }

    if has_text && !has_tool_use {
        events.push(activity(
            "claudeCode",
            session_id,
            timestamp,
            "agent_work_finish",
        ));
    }

    events
}

fn first_claude_code_agent_output_events(
    parse_state: &mut ClaudeCodeParseState,
    session_id: &str,
    timestamp: String,
    compatible_kind: &str,
) -> Vec<CodexActivityEvent> {
    let mut events = Vec::new();

    if parse_state.waiting_for_agent_output {
        parse_state.waiting_for_agent_output = false;
        events.push(activity(
            "claudeCode",
            session_id,
            timestamp.clone(),
            "agent_work_start",
        ));
        if compatible_kind == "message_seen" {
            return events;
        }
    }

    if compatible_kind != "message_seen" {
        events.push(activity(
            "claudeCode",
            session_id,
            timestamp,
            compatible_kind,
        ));
    }

    events
}

fn claude_code_content_items(value: &Value) -> Vec<&Value> {
    let Some(content) = value
        .get("message")
        .and_then(|message| message.get("content"))
    else {
        return Vec::new();
    };

    match content {
        Value::Array(items) => items.iter().collect(),
        Value::String(_) => Vec::new(),
        _ => Vec::new(),
    }
}

fn claude_code_usage(value: &Value) -> Option<TokenUsage> {
    let usage = value.get("message")?.get("usage")?;
    let input_tokens = usage
        .get("input_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    // 写缓存 / 读缓存分开留着：前者是这轮真正新交上去的上下文（计入新增），
    // 后者是同一份上下文每轮的重复读取（只进 raw 账本）。
    let cache_creation_tokens = usage
        .get("cache_creation_input_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let cache_read_tokens = usage
        .get("cache_read_input_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let cached_input_tokens = cache_creation_tokens.saturating_add(cache_read_tokens);
    let output_tokens = usage
        .get("output_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);

    Some(TokenUsage {
        input_tokens,
        cached_input_tokens,
        output_tokens,
        reasoning_output_tokens: 0,
        total_tokens: input_tokens
            .saturating_add(cached_input_tokens)
            .saturating_add(output_tokens),
        // Anthropic 的 input / cache_creation / cache_read / output 天然四分，
        // 互不重叠，直接对应。
        breakdown: TokenBreakdown {
            input: input_tokens,
            cache_create: cache_creation_tokens,
            cache_read: cache_read_tokens,
            output: output_tokens,
        },
    })
}

fn parse_codex_line(
    line: &str,
    session_id: &str,
    parse_state: &mut CodexParseState,
) -> Vec<CodexActivityEvent> {
    let Some(value) = serde_json::from_str::<Value>(line).ok() else {
        return Vec::new();
    };
    let timestamp = value
        .get("timestamp")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    let Some(entry_type) = value.get("type").and_then(Value::as_str) else {
        return Vec::new();
    };

    match entry_type {
        "event_msg" => parse_event_msg(value.get("payload"), session_id, timestamp, parse_state),
        "response_item" => {
            let payload_type = value
                .get("payload")
                .and_then(|payload| payload.get("type"))
                .and_then(Value::as_str);
            match payload_type {
                Some("function_call") => first_agent_output_events(
                    parse_state,
                    session_id,
                    timestamp,
                    "tool_started",
                    "codex",
                ),
                Some("function_call_output") => {
                    vec![activity("codex", session_id, timestamp, "tool_finished")]
                }
                Some("message") => first_agent_output_events(
                    parse_state,
                    session_id,
                    timestamp,
                    "message_seen",
                    "codex",
                ),
                _ => Vec::new(),
            }
        }
        "session_meta" => vec![activity("codex", session_id, timestamp, "session_started")],
        _ => Vec::new(),
    }
}

fn parse_event_msg(
    payload: Option<&Value>,
    session_id: &str,
    timestamp: String,
    parse_state: &mut CodexParseState,
) -> Vec<CodexActivityEvent> {
    let Some(payload) = payload else {
        return Vec::new();
    };

    match payload.get("type").and_then(Value::as_str) {
        Some("token_count") => {
            let Some(info) = payload.get("info") else {
                return Vec::new();
            };
            vec![CodexActivityEvent {
                source: "codex".to_string(),
                session_id: session_id.to_string(),
                timestamp,
                kind: "token_count".to_string(),
                project_path: None,
                token_delta: 0,
                experience_delta: 0,
                project_total_tokens: 0,
                project_experience: 0,
                output_token_delta: 0,
                project_output_tokens: 0,
                project_breakdown: TokenBreakdown::default(),
                fed_exp: 0,
                fed_leveled_up: false,
                fed_breakdown: TokenBreakdown::default(),
                fed_pet_id: None,
                total_usage: parse_usage(info.get("total_token_usage")),
                last_usage: parse_usage(info.get("last_token_usage")),
            }]
        }
        Some("user_message") => {
            parse_state.waiting_for_agent_output = true;
            vec![activity(
                "codex",
                session_id,
                timestamp,
                "agent_thinking_start",
            )]
        }
        Some("agent_message") => agent_message_events(parse_state, session_id, timestamp, payload),
        Some("exec_command_begin") => {
            first_agent_output_events(parse_state, session_id, timestamp, "tool_started", "codex")
        }
        Some("exec_command_end") => {
            vec![activity("codex", session_id, timestamp, "tool_finished")]
        }
        _ => Vec::new(),
    }
}

fn agent_message_events(
    parse_state: &mut CodexParseState,
    session_id: &str,
    timestamp: String,
    payload: &Value,
) -> Vec<CodexActivityEvent> {
    let phase = payload.get("phase").and_then(Value::as_str);
    let mut events = first_agent_output_events(
        parse_state,
        session_id,
        timestamp.clone(),
        "message_seen",
        "codex",
    );
    if phase == Some("final_answer") {
        events.push(activity(
            "codex",
            session_id,
            timestamp,
            "agent_work_finish",
        ));
    }
    events
}

fn first_agent_output_events(
    parse_state: &mut CodexParseState,
    session_id: &str,
    timestamp: String,
    compatible_kind: &str,
    source: &str,
) -> Vec<CodexActivityEvent> {
    let mut events = Vec::new();

    if parse_state.waiting_for_agent_output {
        parse_state.waiting_for_agent_output = false;
        events.push(activity(
            source,
            session_id,
            timestamp.clone(),
            "agent_work_start",
        ));
        if compatible_kind == "message_seen" {
            return events;
        }
    }

    events.push(activity(source, session_id, timestamp, compatible_kind));
    events
}

fn parse_usage(value: Option<&Value>) -> Option<TokenUsage> {
    let value = value?;
    let field = |key: &str| value.get(key).and_then(Value::as_u64).unwrap_or(0);
    let input_tokens = field("input_tokens");
    let cached_input_tokens = field("cached_input_tokens");
    let output_tokens = field("output_tokens");
    Some(TokenUsage {
        input_tokens,
        cached_input_tokens,
        output_tokens,
        reasoning_output_tokens: field("reasoning_output_tokens"),
        total_tokens: field("total_tokens"),
        breakdown: TokenBreakdown {
            // Codex 的 `input_tokens` 是输入总量、`cached_input_tokens` 是其中
            // 命中缓存的子集，相减才是"这轮真正新交上去的输入"。
            input: input_tokens.saturating_sub(cached_input_tokens),
            // Codex 不区分写缓存/读缓存，只报命中量 → 全部记作 cache_read。
            cache_create: 0,
            cache_read: cached_input_tokens,
            output: output_tokens,
        },
    })
}

fn activity(source: &str, session_id: &str, timestamp: String, kind: &str) -> CodexActivityEvent {
    CodexActivityEvent {
        source: source.to_string(),
        session_id: session_id.to_string(),
        timestamp,
        kind: kind.to_string(),
        project_path: None,
        token_delta: 0,
        experience_delta: 0,
        project_total_tokens: 0,
        project_experience: 0,
        output_token_delta: 0,
        project_output_tokens: 0,
        project_breakdown: TokenBreakdown::default(),
        fed_exp: 0,
        fed_leveled_up: false,
        fed_breakdown: TokenBreakdown::default(),
        fed_pet_id: None,
        total_usage: None,
        last_usage: None,
    }
}

fn emit_activity(
    app: &AppHandle,
    source: &str,
    session_id: String,
    kind: &str,
    project_path: Option<String>,
    progress: Option<&ProjectProgress>,
    total_usage: Option<TokenUsage>,
    last_usage: Option<TokenUsage>,
) {
    let event = CodexActivityEvent {
        source: source.to_string(),
        session_id,
        timestamp: "".to_string(),
        kind: kind.to_string(),
        project_path,
        token_delta: 0,
        experience_delta: 0,
        project_total_tokens: progress.map(|item| item.total_tokens).unwrap_or(0),
        project_experience: progress.map(|item| item.experience).unwrap_or(0),
        output_token_delta: 0,
        project_output_tokens: progress.map(|item| item.output_tokens).unwrap_or(0),
        project_breakdown: TokenBreakdown::default(),
        fed_exp: 0,
        fed_leveled_up: false,
        fed_breakdown: TokenBreakdown::default(),
        fed_pet_id: None,
        total_usage,
        last_usage,
    };
    let _ = app.emit("codex://activity", event);
}

fn emit_error(app: &AppHandle, source: &str, error: &str) {
    let event = CodexActivityEvent {
        source: source.to_string(),
        session_id: "".to_string(),
        timestamp: "".to_string(),
        kind: "error".to_string(),
        project_path: None,
        token_delta: 0,
        experience_delta: 0,
        project_total_tokens: 0,
        project_experience: 0,
        output_token_delta: 0,
        project_output_tokens: 0,
        project_breakdown: TokenBreakdown::default(),
        fed_exp: 0,
        fed_leveled_up: false,
        fed_breakdown: TokenBreakdown::default(),
        fed_pet_id: None,
        total_usage: None,
        last_usage: None,
    };
    eprintln!("Gulugulu Codex adapter: {error}");
    let _ = app.emit("codex://activity", event);
}

/// 去抖版 emit_error：仅当错误文案变化、或距上次同款错误 ≥30s 才真正 emit。
/// 持续读失败（文件被 AV 锁、被删、半写）本会每 750ms 刷一条 `error` 活动事件——
/// 而 `agent_error` 属于前端 agent-active latch 事件，会把宠物钉在 error 态永不衰减，
/// 并让 useCodexStatus 以 ~1.3Hz 猛拉 get_codex_status（叠加 2s 轮询）。set_error 仍
/// 每轮照常更新状态（幂等），这里只压制**事件洪泛**。
fn emit_error_debounced(
    app: &AppHandle,
    source: &str,
    error: &str,
    last: &mut Option<(String, Instant)>,
) {
    let now = Instant::now();
    let fresh = match last {
        Some((prev, at)) => prev != error || now.duration_since(*at) >= Duration::from_secs(30),
        None => true,
    };
    if fresh {
        emit_error(app, source, error);
        *last = Some((error.to_string(), now));
    }
}

fn agent_token_event_from_codex(
    session_path: &Path,
    project_path: &str,
    event: CodexActivityEvent,
) -> AgentTokenEvent {
    let token_delta = event
        .last_usage
        .as_ref()
        .map(|usage| usage.total_tokens)
        .unwrap_or(0);
    // 产出口径：output_tokens 已含推理 token（上游 usage 语义），不再叠加
    // reasoning_output_tokens，避免双计。
    let output_token_delta = event
        .last_usage
        .as_ref()
        .map(|usage| usage.output_tokens)
        .unwrap_or(0);
    let breakdown_delta = event
        .last_usage
        .as_ref()
        .map(|usage| usage.breakdown)
        .unwrap_or_default();

    AgentTokenEvent {
        source: "codex".to_string(),
        project_path: project_path.to_string(),
        session_id: event.session_id,
        session_path: path_to_string(&session_path.to_path_buf()),
        timestamp: event.timestamp,
        token_delta,
        output_token_delta,
        breakdown_delta,
        total_usage: event.total_usage,
        last_usage: event.last_usage,
    }
}

fn agent_token_event_from_claude_code(
    session_path: &Path,
    project_path: &str,
    event: CodexActivityEvent,
) -> AgentTokenEvent {
    // 四分明细直接从随事件携带的 last_usage 取（claude 侧 last_usage 就是
    // 本条消息自己的 usage）。
    let breakdown_delta = event
        .last_usage
        .as_ref()
        .map(|usage| usage.breakdown)
        .unwrap_or_default();

    AgentTokenEvent {
        source: "claudeCode".to_string(),
        project_path: project_path.to_string(),
        session_id: event.session_id,
        session_path: path_to_string(&session_path.to_path_buf()),
        timestamp: event.timestamp,
        token_delta: event.token_delta,
        output_token_delta: event.output_token_delta,
        breakdown_delta,
        total_usage: event.total_usage,
        last_usage: event.last_usage,
    }
}

fn apply_agent_token_event(
    app: &AppHandle,
    event: AgentTokenEvent,
) -> Result<CodexActivityEvent, String> {
    let _guard = lock_progress();
    let mut store = load_progress_store(app)?;
    let project = store
        .projects
        .entry(event.project_path.clone())
        .or_insert_with(|| ProjectProgress::new(event.project_path.clone()));

    let token_delta = if event.token_delta > 0 {
        event.token_delta
    } else {
        fallback_token_delta(project, &event)
    };
    let experience_delta = token_delta / 1000;
    // 产出口径（v1.2 喂养）：与 raw 账本并行差分，fallback 同样先播种后差分。
    let output_token_delta = if event.output_token_delta > 0 {
        event.output_token_delta
    } else {
        fallback_output_token_delta(project, &event)
    };
    // 四分明细：同样先播种后差分，避免升级/重启把存量会话一次性灌进来。
    let breakdown_delta = if !event.breakdown_delta.is_zero() {
        event.breakdown_delta
    } else {
        fallback_breakdown_delta(project, &event)
    };

    if token_delta > 0 {
        project.total_tokens = project.total_tokens.saturating_add(token_delta);
        project.experience = project.total_tokens / 1000;
        project.updated_at = event.timestamp.clone();
    }
    if output_token_delta > 0 {
        project.output_tokens = project.output_tokens.saturating_add(output_token_delta);
    }
    if !breakdown_delta.is_zero() {
        project.breakdown.add(&breakdown_delta);
    }

    if let Some(total) = &event.total_usage {
        // 两个 source 是不同类型，只能分别取三张锚点表（而非整体借出）。
        let (session_totals, session_output_totals, session_breakdown_totals) =
            if event.source == "claudeCode" {
                (
                    &mut project.sources.claude_code.session_totals,
                    &mut project.sources.claude_code.session_output_totals,
                    &mut project.sources.claude_code.session_breakdown_totals,
                )
            } else {
                (
                    &mut project.sources.codex.session_totals,
                    &mut project.sources.codex.session_output_totals,
                    &mut project.sources.codex.session_breakdown_totals,
                )
            };
        session_totals.insert(event.session_path.clone(), total.total_tokens);
        session_output_totals.insert(event.session_path.clone(), total.output_tokens);
        session_breakdown_totals.insert(event.session_path.clone(), total.breakdown);
    }

    let project_total_tokens = project.total_tokens;
    let project_experience = project.experience;
    let project_output_tokens = project.output_tokens;
    let project_breakdown = project.breakdown;
    // 全局每日桶：raw 总量 + 四分明细并行入桶。
    record_daily_tokens(&mut store, token_delta, &breakdown_delta);
    save_progress_store(app, &store)?;

    Ok(CodexActivityEvent {
        source: event.source,
        session_id: event.session_id,
        timestamp: event.timestamp,
        kind: "token_count".to_string(),
        project_path: Some(event.project_path),
        token_delta,
        experience_delta,
        project_total_tokens,
        project_experience,
        output_token_delta,
        project_output_tokens,
        project_breakdown,
        fed_exp: 0,
        fed_leveled_up: false,
        fed_breakdown: TokenBreakdown::default(),
        fed_pet_id: None,
        total_usage: event.total_usage,
        last_usage: event.last_usage,
    })
}

/// Feed the game layer with the four-part token increment this event produced
/// (ledger-increment semantics). 四分加权喂养（用户 2026-07-20 决策）：
/// cache_read/cache_create/output/input → 0.1/1/5/1，逐项差分后按权折算成
/// **陪伴宠的经验**（2026-07-21 机制修订：Token 不再回精力），既让"产出"份量
/// 最重，又不让海量 cache_read 一口喂成巨餐。喂养账本用四分基线
/// （`project.breakdown`），raw 账本继续服务统计。返回的 `fed_breakdown`
/// 标到事件上，供前端报「吃到 N 个产出 Token…」。
fn enrich_with_game_feed(app: &AppHandle, mut activity: CodexActivityEvent) -> CodexActivityEvent {
    if let Some(project_path) = activity.project_path.clone() {
        if let Some(state) = app.try_state::<crate::game::SharedGameState>() {
            if let Some(outcome) = crate::game::feed_from_project_tokens(
                app,
                state.inner(),
                &project_path,
                activity.project_breakdown,
            ) {
                activity.fed_exp = outcome.exp_gained;
                activity.fed_leveled_up = outcome.leveled_up;
                activity.fed_breakdown = outcome.fed_breakdown.clone();
                activity.fed_pet_id = outcome.pet_id.clone();
                // 入账即反馈：`game://exp` 轻量补丁（不推全量存档——customSpecies
                // 太大）。主窗/后院据此本地改写陪伴宠的 exp/level，不等进食演出——
                // 进食合餐可能晚几拍才播，数值却已入账，不能"无声升级"。
                let _ = app.emit("game://exp", outcome);
            }
        }
    }
    activity
}

/// 进度存档快照：(全项目累计 experience 之和, 按项目的喂养账本基线)。
/// 前者用于首建存档的历史折币礼包（GDD §3.3 并轨，仍按 raw 口径的 experience）；
/// 后者播种 token→精力增量账本——v1.2 起喂养走产出口径，基线取 output_tokens
///（InteractionEconomy §9）。
pub fn progress_snapshot(app: &AppHandle) -> (u64, BTreeMap<String, u64>) {
    match load_progress_store(app) {
        Ok(store) => {
            let mut baseline = BTreeMap::new();
            let mut total = 0u64;
            for (path, project) in &store.projects {
                total = total.saturating_add(project.experience);
                baseline.insert(path.clone(), project.output_tokens);
            }
            (total, baseline)
        }
        Err(_) => (0, BTreeMap::new()),
    }
}

fn fallback_token_delta(project: &ProjectProgress, event: &AgentTokenEvent) -> u64 {
    let Some(total) = &event.total_usage else {
        return 0;
    };
    let previous = if event.source == "claudeCode" {
        project
            .sources
            .claude_code
            .session_totals
            .get(&event.session_path)
            .copied()
            .unwrap_or(total.total_tokens)
    } else {
        project
            .sources
            .codex
            .session_totals
            .get(&event.session_path)
            .copied()
            .unwrap_or(total.total_tokens)
    };
    total.total_tokens.saturating_sub(previous)
}

/// 产出口径的 fallback 差分（镜像 `fallback_token_delta`）：首见会话
/// `unwrap_or(当前值)` 播种锚点不喂养——升级/重启后存量会话不会把
/// 历史产出一次性灌成一顿巨餐。
fn fallback_output_token_delta(project: &ProjectProgress, event: &AgentTokenEvent) -> u64 {
    let Some(total) = &event.total_usage else {
        return 0;
    };
    let previous = if event.source == "claudeCode" {
        project
            .sources
            .claude_code
            .session_output_totals
            .get(&event.session_path)
            .copied()
            .unwrap_or(total.output_tokens)
    } else {
        project
            .sources
            .codex
            .session_output_totals
            .get(&event.session_path)
            .copied()
            .unwrap_or(total.output_tokens)
    };
    total.output_tokens.saturating_sub(previous)
}

/// 四分明细的 fallback 差分（镜像 `fallback_output_token_delta`，逐项差分）。
fn fallback_breakdown_delta(project: &ProjectProgress, event: &AgentTokenEvent) -> TokenBreakdown {
    let Some(total) = &event.total_usage else {
        return TokenBreakdown::default();
    };
    let session_breakdown_totals = if event.source == "claudeCode" {
        &project.sources.claude_code.session_breakdown_totals
    } else {
        &project.sources.codex.session_breakdown_totals
    };
    let previous = session_breakdown_totals
        .get(&event.session_path)
        .copied()
        .unwrap_or(total.breakdown);
    total.breakdown.saturating_sub(&previous)
}

fn prepare_codex_session(
    app: &AppHandle,
    project_path: &str,
    session_path: &Path,
    file_len: u64,
) -> Result<u64, String> {
    let _guard = lock_progress();
    let mut store = load_progress_store(app)?;
    let project = store
        .projects
        .entry(project_path.to_string())
        .or_insert_with(|| ProjectProgress::new(project_path.to_string()));
    let session_key = path_to_string(&session_path.to_path_buf());
    let offset = *project
        .sources
        .codex
        .session_offsets
        .entry(session_key.clone())
        .or_insert(file_len);
    if !project
        .sources
        .codex
        .session_totals
        .contains_key(&session_key)
    {
        if let Some(total) = last_codex_total_usage(session_path) {
            project
                .sources
                .codex
                .session_totals
                .insert(session_key, total);
        }
    }
    save_progress_store(app, &store)?;
    Ok(offset)
}

fn update_codex_session_offset(
    app: &AppHandle,
    project_path: &str,
    session_path: &Path,
    offset: u64,
) -> Result<(), String> {
    let _guard = lock_progress();
    let mut store = load_progress_store(app)?;
    let project = store
        .projects
        .entry(project_path.to_string())
        .or_insert_with(|| ProjectProgress::new(project_path.to_string()));
    project
        .sources
        .codex
        .session_offsets
        .insert(path_to_string(&session_path.to_path_buf()), offset);
    save_progress_store(app, &store)
}

fn prepare_claude_code_session(
    app: &AppHandle,
    project_path: &str,
    session_path: &Path,
    file_len: u64,
) -> Result<u64, String> {
    let _guard = lock_progress();
    let mut store = load_progress_store(app)?;
    let project = store
        .projects
        .entry(project_path.to_string())
        .or_insert_with(|| ProjectProgress::new(project_path.to_string()));
    let session_key = path_to_string(&session_path.to_path_buf());
    let offset = *project
        .sources
        .claude_code
        .session_offsets
        .entry(session_key.clone())
        .or_insert(file_len);
    if !project
        .sources
        .claude_code
        .session_totals
        .contains_key(&session_key)
    {
        if let Some(total) = last_claude_code_total_usage(session_path) {
            project
                .sources
                .claude_code
                .session_totals
                .insert(session_key, total);
        }
    }
    save_progress_store(app, &store)?;
    Ok(offset)
}

fn update_claude_code_session_offset(
    app: &AppHandle,
    project_path: &str,
    session_path: &Path,
    offset: u64,
) -> Result<(), String> {
    let _guard = lock_progress();
    let mut store = load_progress_store(app)?;
    let project = store
        .projects
        .entry(project_path.to_string())
        .or_insert_with(|| ProjectProgress::new(project_path.to_string()));
    project
        .sources
        .claude_code
        .session_offsets
        .insert(path_to_string(&session_path.to_path_buf()), offset);
    save_progress_store(app, &store)
}

fn project_progress_snapshot(
    app: &AppHandle,
    project_path: &str,
) -> Result<Option<ProjectProgress>, String> {
    let store = load_progress_store(app)?;
    Ok(store.projects.get(project_path).cloned())
}

/// 当前**本地**天序号（自 Unix 纪元的整天数），用作每日 Token 桶的 key。
/// 必须按本地时区切日：早先用 `secs / 86_400`（UTC 天）时，UTC+8 的玩家
/// 看到的「今日」其实是每天早上 8 点滚动的窗口，跨不过本地零点。
fn current_day_index() -> u64 {
    let now = chrono::Local::now();
    let epoch_days = now.date_naive().signed_duration_since(
        chrono::NaiveDate::from_ymd_opt(1970, 1, 1).expect("1970-01-01 is a valid date"),
    );
    epoch_days.num_days().max(0) as u64
}

/// 每日桶保留窗口（天）：覆盖最长的 1m(30d) 时间窗，留些余量。
const DAILY_TOKENS_RETAIN_DAYS: u64 = 40;

/// 把当天新增的 raw 总量 + 四分明细记入全局每日桶，并顺带修剪过期桶。
/// 调用方需已持有 `lock_progress()` 且会随后 save。
fn record_daily_tokens(store: &mut ProgressStore, token_delta: u64, breakdown_delta: &TokenBreakdown) {
    record_daily_tokens_at(store, token_delta, breakdown_delta, current_day_index());
}

/// `record_daily_tokens` 的纯实现（`today` 显式传入以便测试）。
fn record_daily_tokens_at(
    store: &mut ProgressStore,
    token_delta: u64,
    breakdown_delta: &TokenBreakdown,
    today: u64,
) {
    if token_delta == 0 && breakdown_delta.is_zero() {
        return;
    }
    if token_delta > 0 {
        let bucket = store.daily_tokens.entry(today).or_insert(0);
        *bucket = bucket.saturating_add(token_delta);
    }
    if !breakdown_delta.is_zero() {
        store
            .daily_breakdown
            .entry(today)
            .or_default()
            .add(breakdown_delta);
    }
    let fresh_u64 = |&day: &u64, _: &mut u64| today.saturating_sub(day) < DAILY_TOKENS_RETAIN_DAYS;
    let fresh_bd =
        |&day: &u64, _: &mut TokenBreakdown| today.saturating_sub(day) < DAILY_TOKENS_RETAIN_DAYS;
    store.daily_tokens.retain(fresh_u64);
    store.daily_breakdown.retain(fresh_bd);
}

/// 从每日桶聚合出 1d/1w/1m 三档（含四分明细），`all` 用各项目历史累计之和
/// （账本引入前的历史 token 只会计入 `all` 的 total，不会进时间窗）。
/// `today` 显式传入以便测试。总量沿用 raw 口径（含 cache_read），四分供详情页展开。
fn aggregate_token_stats_at(store: &ProgressStore, today: u64) -> TokenStats {
    let mut stats = TokenStats::default();
    for project in store.projects.values() {
        stats.all.total = stats.all.total.saturating_add(project.total_tokens);
        stats.all.breakdown.add(&project.breakdown);
    }
    // total 与 breakdown 是两本独立的桶，同一天可能只有其一（明细账本晚于
    // total 账本上线），各自累加、互不依赖。
    let windows: [(&mut TokenWindow, u64); 3] =
        [(&mut stats.d1, 1), (&mut stats.w1, 7), (&mut stats.m1, 30)];
    let mut windows = windows;
    for (&day, &tokens) in &store.daily_tokens {
        let age = today.saturating_sub(day);
        for (window, max_age) in windows.iter_mut() {
            if age < *max_age {
                window.total = window.total.saturating_add(tokens);
            }
        }
    }
    for (&day, breakdown) in &store.daily_breakdown {
        let age = today.saturating_sub(day);
        for (window, max_age) in windows.iter_mut() {
            if age < *max_age {
                window.breakdown.add(breakdown);
            }
        }
    }
    stats
}

/// 读取全局 Token 的多时间窗聚合（供 `get_codex_status` 命令使用）。
pub fn token_stats(app: &AppHandle) -> TokenStats {
    let _guard = lock_progress();
    let store = load_progress_store(app).unwrap_or_default();
    aggregate_token_stats_at(&store, current_day_index())
}

/// 当前**本地**天序号（供命令层算「昨天 = today-1」，与每日桶同口径）。
pub fn local_day_index() -> u64 {
    current_day_index()
}

/// 读取指定本地天序号的 Token 窗（raw 总量 + 四分明细），缺桶返回全零窗。
/// 「昨日战报」按**具体某天**取数（非滚动窗），供 `game::get_yesterday_summary` 用。
pub fn day_token_window(app: &AppHandle, day_index: u64) -> TokenWindow {
    let _guard = lock_progress();
    let store = load_progress_store(app).unwrap_or_default();
    day_token_window_at(&store, day_index)
}

/// `day_token_window` 的纯实现（`store` 显式传入以便测试）。
fn day_token_window_at(store: &ProgressStore, day_index: u64) -> TokenWindow {
    let mut window = TokenWindow::default();
    if let Some(&total) = store.daily_tokens.get(&day_index) {
        window.total = total;
    }
    if let Some(breakdown) = store.daily_breakdown.get(&day_index) {
        window.breakdown = *breakdown;
    }
    window
}

/// 串行化进度存档的 read-modify-write：Codex 与 Claude 两个 watcher 线程
/// 都会 load→改→save，若不加锁并发写会撕裂出 “trailing characters” 的坏文件。
fn progress_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn lock_progress() -> std::sync::MutexGuard<'static, ()> {
    // 锁只保护文件访问顺序；即便被投毒也照常继续（数据不因此损坏）。
    progress_lock().lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn load_progress_store(app: &AppHandle) -> Result<ProgressStore, String> {
    let path = progress_path(app)?;
    if !path.exists() {
        return Ok(ProgressStore::default());
    }
    let contents = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    match serde_json::from_str::<ProgressStore>(&contents) {
        Ok(mut store) => {
            seed_breakdown_ledger(&mut store);
            Ok(store)
        }
        Err(error) => {
            // 存档已损坏：备份后重置，否则每个 token 事件都会重复刷同一条
            // “trailing characters” 错误、永远无法自愈。
            let backup = path.with_extension("json.corrupt");
            let _ = fs::rename(&path, &backup);
            eprintln!(
                "Gulugulu Codex adapter: progress store corrupt ({error}); \
                 reset and backed up to {}",
                backup.display()
            );
            Ok(ProgressStore::default())
        }
    }
}

/// 四分明细账本上线前的存量项目播种。
///
/// 历史只持久化了 raw(`total_tokens`) 和产出(`output_tokens`) 两本账，无法反推
/// 当年的 input/cache_*，所以只把已知的 `output_tokens` 填进 `breakdown.output`
/// 打底——其余三项留 0，详情页会把 `total - breakdown.total()` 显示为「未分类」。
/// 首次带四分增量入账后 `breakdown.output >= output_tokens`，条件不再成立，幂等。
fn seed_breakdown_ledger(store: &mut ProgressStore) {
    for project in store.projects.values_mut() {
        if project.breakdown.is_zero() && project.output_tokens > 0 {
            project.breakdown.output = project.output_tokens;
        }
    }
}

fn save_progress_store(app: &AppHandle, store: &ProgressStore) -> Result<(), String> {
    let path = progress_path(app)?;
    let dir = path
        .parent()
        .ok_or_else(|| "Unable to resolve app data directory.".to_string())?;
    fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    let contents = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
    // 原子写（临时文件 + rename）：即便两个线程仍抢写，rename 也只会整体
    // 覆盖，绝不会留下半截 JSON 造成 “trailing characters” 损坏。
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, contents).map_err(|error| error.to_string())?;
    fs::rename(&tmp, &path).map_err(|error| error.to_string())
}

/// 用给定字节整份替换本地 progress store（Steam 云采纳外机账本用，SteamCloudSync.md）。
/// 先校验能解析为 `ProgressStore` 再原子落盘，持 `lock_progress` 串行化避免与 watcher
/// 竞写。整份覆盖安全：本机自己的 session 文件不在外机 offset 表里 → watcher 首见即从
/// 当前 `file_len` 播种（不重算历史、不翻倍），可移植的累计 token 正确带过来。
pub fn replace_progress_store_bytes(app: &AppHandle, bytes: &[u8]) -> Result<(), String> {
    serde_json::from_slice::<ProgressStore>(bytes)
        .map_err(|error| format!("cloud progress parse: {error}"))?;
    let _guard = lock_progress();
    let path = progress_path(app)?;
    let dir = path
        .parent()
        .ok_or_else(|| "Unable to resolve app data directory.".to_string())?;
    fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, bytes).map_err(|error| error.to_string())?;
    fs::rename(&tmp, &path).map_err(|error| error.to_string())
}

fn discover_codex_home() -> Option<PathBuf> {
    if let Ok(path) = env::var("CODEX_HOME") {
        let path = PathBuf::from(path);
        if path.exists() {
            return Some(path);
        }
    }

    candidate_codex_homes()
        .into_iter()
        .find(|path| path.exists())
}

fn discover_claude_home() -> Option<PathBuf> {
    if let Ok(path) = env::var("CLAUDE_HOME") {
        let path = PathBuf::from(path);
        if path.exists() {
            return Some(path);
        }
    }

    candidate_claude_homes()
        .into_iter()
        .find(|path| path.exists())
}

fn candidate_codex_homes() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(appdata) = env::var("APPDATA") {
        candidates.push(PathBuf::from(appdata).join("Codex"));
    }

    if let Ok(local_appdata) = env::var("LOCALAPPDATA") {
        candidates.push(PathBuf::from(local_appdata).join("Codex"));
    }

    if let Ok(home) = env::var("USERPROFILE").or_else(|_| env::var("HOME")) {
        let home = PathBuf::from(home);
        candidates.push(home.join(".codex"));
        candidates.push(home.join(".config").join("codex"));
        candidates.push(home.join("AppData").join("Roaming").join("Codex"));
    }

    candidates.push(PathBuf::from("D:\\AppHome\\Codex"));
    candidates
}

fn candidate_claude_homes() -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(home) = env::var("USERPROFILE").or_else(|_| env::var("HOME")) {
        let home = PathBuf::from(home);
        candidates.push(home.join(".claude"));
        candidates.push(home.join(".config").join("claude"));
    }

    if let Ok(appdata) = env::var("APPDATA") {
        candidates.push(PathBuf::from(appdata).join("Claude"));
    }

    candidates
}

fn latest_session_file(codex_home: &Path) -> Option<PathBuf> {
    let sessions = codex_home.join("sessions");
    if !sessions.exists() {
        return None;
    }
    latest_non_generation_session(&sessions, extract_project_path)
}

fn latest_claude_code_session_file(claude_home: &Path) -> Option<PathBuf> {
    let projects = claude_home.join("projects");
    if !projects.exists() {
        return None;
    }
    latest_non_generation_session(&projects, |path| {
        extract_claude_code_project_path(path)
            .or_else(|| project_path_from_claude_code_session_path(path, &claude_home.join("projects")))
    })
}

/// App 自己的 CLI 生成 cwd（`cli_spawn::generation_cwd`）归一化后的标记路径。
/// 与会话 cwd 走同一个 `normalize_project_path`（canonicalize），两侧同形可比。
fn generation_project_marker() -> Option<String> {
    Some(normalize_project_path(
        &crate::cli_spawn::generation_cwd().to_string_lossy(),
    ))
}

/// 返回 mtime 最新、且**不是 App 自产生成**的会话文件。生成运行时其自产会话会短暂
/// 成为最新——用 `resolve`（读会话 cwd）比对标记路径把它跳过，落到真正的用户会话上，
/// 避免自产 token 被计进经济、并避免 watcher 在自产/用户会话间反复翻牌。
fn latest_non_generation_session(
    root: &Path,
    resolve: impl Fn(&Path) -> Option<String>,
) -> Option<PathBuf> {
    let mut all: Vec<(PathBuf, SystemTime)> = Vec::new();
    collect_all_jsonl_files(root, &mut all);
    all.sort_by(|a, b| b.1.cmp(&a.1)); // 新 → 旧
    let marker = generation_project_marker();
    for (path, _) in all {
        // 只跳过**确认**为自产的会话（resolve 命中标记）；读不出 cwd 时按真实会话处理。
        if let Some(marker) = &marker {
            if resolve(&path).as_deref() == Some(marker.as_str()) {
                continue;
            }
        }
        return Some(path);
    }
    None
}

fn collect_all_jsonl_files(dir: &Path, out: &mut Vec<(PathBuf, SystemTime)>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_all_jsonl_files(&path, out);
            continue;
        }

        if path.extension().and_then(|ext| ext.to_str()) != Some("jsonl") {
            continue;
        }

        let modified = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        out.push((path, modified));
    }
}

fn file_len(path: &Path) -> Result<u64, String> {
    path.metadata()
        .map(|metadata| metadata.len())
        .map_err(|error| error.to_string())
}

fn extract_project_path(path: &Path) -> Option<String> {
    let file = File::open(path).ok()?;
    let reader = BufReader::new(file);

    for line in reader.lines().map_while(Result::ok) {
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        if value.get("type").and_then(Value::as_str) != Some("session_meta") {
            continue;
        }

        let cwd = value
            .get("payload")
            .and_then(|payload| payload.get("cwd"))
            .and_then(Value::as_str)?;
        return Some(normalize_project_path(cwd));
    }

    None
}

fn extract_claude_code_project_path(path: &Path) -> Option<String> {
    let file = File::open(path).ok()?;
    let reader = BufReader::new(file);

    for line in reader.lines().map_while(Result::ok) {
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let cwd = value.get("cwd").and_then(Value::as_str);
        if let Some(cwd) = cwd {
            return Some(normalize_project_path(cwd));
        }
    }

    None
}

fn project_path_from_claude_code_session_path(path: &Path, claude_home: &Path) -> Option<String> {
    let projects = claude_home.join("projects");
    let project_dir = path.parent()?;
    let relative = project_dir.strip_prefix(projects).ok()?;
    let encoded = relative.components().next()?.as_os_str().to_string_lossy();
    let decoded = decode_claude_code_project_dir(&encoded)?;
    Some(normalize_project_path(&decoded))
}

fn decode_claude_code_project_dir(encoded: &str) -> Option<String> {
    let (drive, rest) = encoded.split_once("--")?;
    if drive.len() != 1 {
        return None;
    }

    let normalized_drive = drive.to_ascii_uppercase();
    let separator = std::path::MAIN_SEPARATOR.to_string();
    Some(format!(
        "{}:{}{}",
        normalized_drive,
        separator,
        rest.replace('-', &separator)
    ))
}

fn last_codex_total_usage(path: &Path) -> Option<u64> {
    let file = File::open(path).ok()?;
    let reader = BufReader::new(file);
    let mut latest_total = None;

    for line in reader.lines().map_while(Result::ok) {
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        let total = value
            .get("payload")
            .and_then(|payload| payload.get("info"))
            .and_then(|info| info.get("total_token_usage"))
            .and_then(|usage| usage.get("total_tokens"))
            .and_then(Value::as_u64);
        if total.is_some() {
            latest_total = total;
        }
    }

    latest_total
}

fn last_claude_code_total_usage(path: &Path) -> Option<u64> {
    let file = File::open(path).ok()?;
    let reader = BufReader::new(file);
    let mut latest_total = None;

    for line in reader.lines().map_while(Result::ok) {
        let Ok(value) = serde_json::from_str::<Value>(&line) else {
            continue;
        };
        if let Some(usage) = claude_code_usage(&value) {
            latest_total = Some(usage.total_tokens);
        }
    }

    latest_total
}

fn normalize_project_path(path: &str) -> String {
    let path = PathBuf::from(path);
    path.canonicalize()
        .unwrap_or(path)
        .to_string_lossy()
        .to_string()
}

fn mark_watching(
    state: &SharedCodexState,
    source: &str,
    latest: &Path,
    project_path: &str,
    progress: Option<&ProjectProgress>,
) {
    if let Ok(mut state) = state.0.lock() {
        state.latest_session = Some(latest.to_path_buf());
        state.current_project = Some(project_path.to_string());
        if source == "claudeCode" {
            state.claude_code_watching = true;
        } else {
            state.codex_watching = true;
        }
        state.watching = state.codex_watching || state.claude_code_watching;
        state.active_source = Some(source.to_string());
        state.error = None;
        state.total_tokens = progress.map(|item| item.total_tokens).unwrap_or(0);
        state.experience = progress.map(|item| item.experience).unwrap_or(0);
    }
}

fn set_error(state: &SharedCodexState, source: &str, error: &str) {
    if let Ok(mut state) = state.0.lock() {
        if source == "claudeCode" {
            state.claude_code_watching = false;
        } else {
            state.codex_watching = false;
        }
        state.watching = state.codex_watching || state.claude_code_watching;
        state.error = if state.watching {
            None
        } else {
            Some(error.to_string())
        };
    }
}

fn state_has_claude_home(state: &SharedCodexState) -> bool {
    state
        .0
        .lock()
        .ok()
        .and_then(|guard| guard.claude_home.clone())
        .is_some()
}

/// 记录某源刚有新会话内容到达（判活用）。见 CodexStateInner::codex_last_active。
fn mark_source_active(state: &SharedCodexState, source: &str) {
    if let Ok(mut state) = state.0.lock() {
        let now = Instant::now();
        if source == "claudeCode" {
            state.claude_last_active = Some(now);
        } else {
            state.codex_last_active = Some(now);
        }
    }
}

/// 处理一批已解析的会话事件（两个 watcher 主读 + 切文件前的追读共用，避免重复逻辑）：
/// token_count → 入账折算喂养并 emit 富事件；其它事件直接 emit。
fn process_session_events(
    app: &AppHandle,
    state: &SharedCodexState,
    source: &str,
    session_path: &Path,
    project_path: &str,
    events: Vec<CodexActivityEvent>,
    last_error_emit: &mut Option<(String, Instant)>,
) {
    for event in events {
        if event.kind == "token_count" {
            let token_event = if source == "claudeCode" {
                agent_token_event_from_claude_code(session_path, project_path, event)
            } else {
                agent_token_event_from_codex(session_path, project_path, event)
            };
            match apply_agent_token_event(app, token_event) {
                Ok(activity) => {
                    set_project_progress(
                        state,
                        activity.project_path.clone(),
                        activity.project_total_tokens,
                        activity.project_experience,
                    );
                    let activity = enrich_with_game_feed(app, activity);
                    let _ = app.emit("codex://activity", activity);
                }
                Err(error) => {
                    set_error(state, source, &error);
                    emit_error_debounced(app, source, &error, last_error_emit);
                }
            }
        } else {
            let _ = app.emit("codex://activity", event);
        }
    }
}

fn set_project_progress(
    state: &SharedCodexState,
    project_path: Option<String>,
    total_tokens: u64,
    experience: u64,
) {
    if let Ok(mut state) = state.0.lock() {
        state.current_project = project_path;
        state.total_tokens = total_tokens;
        state.experience = experience;
    }
}

fn session_id_from_path(path: &Path) -> String {
    let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) else {
        return "unknown".to_string();
    };

    if stem.len() >= 36 {
        // 按**字符边界**取末 36 字节：非 ASCII 文件名（手改/同步进来的中文名）若 len-36
        // 落在多字节字符中间，直接 `stem[..]` 会 panic「byte index is not a char boundary」，
        // 掀翻无人监管的 watcher 线程。str::get 遇非边界返回 None → 回退整名（不再崩）。
        return stem
            .get(stem.len() - 36..)
            .map(str::to_string)
            .unwrap_or_else(|| stem.to_string());
    }

    stem.to_string()
}

fn path_to_string(path: &PathBuf) -> String {
    path.to_string_lossy().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bd(input: u64, cache_create: u64, cache_read: u64, output: u64) -> TokenBreakdown {
        TokenBreakdown { input, cache_create, cache_read, output }
    }

    /// `projects` 给每个项目的 raw total_tokens；`daily` 给 (天序号, raw 总量)。
    /// 四分明细按 total 的固定比例（1:2:6:1，凑成 10 份）派生，方便断言。
    fn store_with(projects: &[u64], daily: &[(u64, u64)]) -> ProgressStore {
        let mut store = ProgressStore::default();
        for (i, &total) in projects.iter().enumerate() {
            let path = format!("proj-{i}");
            let mut p = ProjectProgress::new(path.clone());
            p.total_tokens = total;
            p.breakdown = split(total);
            store.projects.insert(path, p);
        }
        for &(day, total) in daily {
            store.daily_tokens.insert(day, total);
            store.daily_breakdown.insert(day, split(total));
        }
        store
    }

    /// 把一个 raw 总量拆成四分（1:2:6:1），四项之和恰等于入参。
    fn split(total: u64) -> TokenBreakdown {
        let unit = total / 10;
        bd(unit, unit * 2, unit * 6, total - unit * 9)
    }

    #[test]
    fn all_sums_every_project_total_and_breakdown() {
        let store = store_with(&[5_198_000, 7_565_000_000], &[]);
        let all = aggregate_token_stats_at(&store, 100).all;
        // all.total 是全局 raw 历史累计和，不随「最后被监听的项目」跳变。
        assert_eq!(all.total, 7_570_198_000);
        // 四分明细逐项求和，且四项之和回到 total。
        assert_eq!(all.breakdown.total(), all.total);
        assert_eq!(all.breakdown, split(5_198_000).also_add(split(7_565_000_000)));
    }

    #[test]
    fn windows_bucket_by_age() {
        let today = 100;
        // 桶年龄：today(0)、6 天前(<7)、7 天前(=7,出周)、29 天前(<30)、30 天前(出月)。
        let store = store_with(
            &[1000],
            &[
                (100, 10), // 今日
                (94, 20),  // 6 天前 → 周内
                (93, 40),  // 7 天前 → 出周、仍在月内
                (71, 80),  // 29 天前 → 月内边界
                (70, 160), // 30 天前 → 出月
            ],
        );
        let stats = aggregate_token_stats_at(&store, today);
        assert_eq!(stats.d1.total, 10);
        assert_eq!(stats.w1.total, 10 + 20);
        assert_eq!(stats.m1.total, 10 + 20 + 40 + 80);
        assert_eq!(stats.all.total, 1000); // all 走项目累计，与桶无关
        // 四分随时间窗一同聚合，且始终自洽。
        assert_eq!(stats.m1.breakdown, split(10).also_add(split(20)).also_add(split(40)).also_add(split(80)));
        assert_eq!(stats.w1.breakdown.total(), stats.w1.total);
    }

    /// total 桶与 breakdown 桶各自独立：某天只有 total（明细账本上线前），
    /// 聚合出的 window.total 照常累加，而该天不进 breakdown。
    #[test]
    fn total_and_breakdown_buckets_are_independent() {
        let mut store = ProgressStore::default();
        store.daily_tokens.insert(100, 500); // 有 total 无明细
        store.daily_breakdown.insert(100, bd(1, 2, 3, 4)); // 同日明细（值刻意 != total）
        store.daily_tokens.insert(99, 999); // 仅 total，无明细
        let d1 = aggregate_token_stats_at(&store, 100).d1;
        assert_eq!(d1.total, 500); // 99 天前出了 1d 窗
        assert_eq!(d1.breakdown, bd(1, 2, 3, 4));
    }

    #[test]
    fn record_accumulates_and_prunes() {
        let mut store = ProgressStore::default();
        record_daily_tokens_at(&mut store, 100, &bd(1, 2, 3, 1), 200);
        record_daily_tokens_at(&mut store, 50, &bd(0, 1, 2, 0), 200); // 同日累加
        assert_eq!(store.daily_tokens.get(&200), Some(&150));
        assert_eq!(store.daily_breakdown.get(&200), Some(&bd(1, 3, 5, 1)));

        // 早于保留窗口的旧桶应被修剪掉（两本账同步修剪）。
        let stale = 200 - DAILY_TOKENS_RETAIN_DAYS;
        store.daily_tokens.insert(stale, 999);
        store.daily_breakdown.insert(stale, bd(9, 9, 9, 9));
        record_daily_tokens_at(&mut store, 1, &bd(1, 0, 0, 0), 200);
        assert!(!store.daily_tokens.contains_key(&stale));
        assert!(!store.daily_breakdown.contains_key(&stale));

        // total 与 breakdown 都为空时不建桶。
        let before = (store.daily_tokens.len(), store.daily_breakdown.len());
        record_daily_tokens_at(&mut store, 0, &TokenBreakdown::default(), 201);
        assert_eq!((store.daily_tokens.len(), store.daily_breakdown.len()), before);
    }

    /// 「昨日战报」按具体某天取数：命中当天桶（raw + 四分），另一天互不串，缺桶回全零。
    #[test]
    fn day_token_window_reads_single_day_bucket() {
        let mut store = ProgressStore::default();
        record_daily_tokens_at(&mut store, 100, &bd(1, 2, 3, 4), 20654); // 昨天
        record_daily_tokens_at(&mut store, 50, &bd(0, 0, 5, 0), 20655); // 今天
        let y = day_token_window_at(&store, 20654);
        assert_eq!(y.total, 100);
        assert_eq!(y.breakdown, bd(1, 2, 3, 4));
        assert_eq!(day_token_window_at(&store, 20655).total, 50); // 不串天
        let miss = day_token_window_at(&store, 19000);
        assert_eq!(miss.total, 0); // 缺桶 → 全零窗
        assert!(miss.breakdown.is_zero());
    }

    /// Claude Code：四分与 raw 总量都对得上，cache_read 照常计入 total。
    #[test]
    fn claude_code_usage_splits_four_parts() {
        let value = serde_json::json!({
            "message": { "usage": {
                "input_tokens": 12,
                "cache_creation_input_tokens": 3_000,
                "cache_read_input_tokens": 220_000,
                "output_tokens": 900,
            }}
        });
        let usage = claude_code_usage(&value).expect("usage parses");
        assert_eq!(usage.total_tokens, 12 + 3_000 + 220_000 + 900);
        assert_eq!(usage.breakdown, bd(12, 3_000, 220_000, 900));
        assert_eq!(usage.breakdown.total(), usage.total_tokens);
    }

    /// Codex：`input_tokens` 已含缓存，四分里的 input 要减掉缓存命中量，
    /// 缓存全部记作 cache_read（Codex 不区分写缓存）。四项之和仍 == total。
    #[test]
    fn codex_usage_splits_subtracting_cached_input() {
        let value = serde_json::json!({
            "input_tokens": 180_000,
            "cached_input_tokens": 176_000,
            "output_tokens": 1_200,
            "reasoning_output_tokens": 400,
            "total_tokens": 181_200,
        });
        let usage = parse_usage(Some(&value)).expect("usage parses");
        assert_eq!(usage.total_tokens, 181_200);
        assert_eq!(usage.breakdown, bd(180_000 - 176_000, 0, 176_000, 1_200));
        assert_eq!(usage.breakdown.total(), usage.total_tokens);
    }

    #[test]
    fn seed_backfills_breakdown_from_output_only_once() {
        let mut store = ProgressStore::default();
        let mut legacy = ProjectProgress::new("legacy".into());
        legacy.total_tokens = 900_000_000; // raw 历史，不参与播种
        legacy.output_tokens = 6_777_797;
        store.projects.insert("legacy".into(), legacy);

        seed_breakdown_ledger(&mut store);
        // 只能回填已知的 output，其余三项留 0（详情页按「未分类」显示差额）。
        assert_eq!(store.projects["legacy"].breakdown, bd(0, 0, 0, 6_777_797));

        // 播种后继续入账，再次 load 不得二次覆盖。
        store.projects.get_mut("legacy").unwrap().breakdown.input += 1_000;
        seed_breakdown_ledger(&mut store);
        assert_eq!(store.projects["legacy"].breakdown, bd(1_000, 0, 0, 6_777_797));
    }

    // 测试便捷：链式相加，返回累加结果。
    impl TokenBreakdown {
        fn also_add(mut self, other: Self) -> Self {
            self.add(&other);
            self
        }
    }

    /// 跨语言线格契约（CLAUDE.md：Rust serde ↔ types.ts 必须对齐）：
    /// TokenWindow 用 serde flatten 把四分与 total 摊平到同层，且四分走 camelCase。
    /// types.ts 的 `TokenWindow = { total } & TokenBreakdown` 依赖这个形状。
    #[test]
    fn token_window_serializes_flat_camelcase() {
        let window = TokenWindow {
            total: 999,
            breakdown: bd(1, 2, 3, 4),
        };
        let value = serde_json::to_value(window).unwrap();
        let obj = value.as_object().unwrap();
        // 五个键全在同一层（flatten 生效），且四分是 camelCase。
        assert_eq!(obj.get("total").and_then(Value::as_u64), Some(999));
        assert_eq!(obj.get("input").and_then(Value::as_u64), Some(1));
        assert_eq!(obj.get("cacheCreate").and_then(Value::as_u64), Some(2));
        assert_eq!(obj.get("cacheRead").and_then(Value::as_u64), Some(3));
        assert_eq!(obj.get("output").and_then(Value::as_u64), Some(4));
        assert!(obj.get("breakdown").is_none(), "flatten 后不应再有嵌套 breakdown 键");
        // TokenStats 的四个窗口都按 camelCase key 暴露。
        let stats = serde_json::to_value(TokenStats::default()).unwrap();
        for key in ["all", "d1", "w1", "m1"] {
            assert!(stats.get(key).is_some(), "缺时间窗 {key}");
        }
    }
}
