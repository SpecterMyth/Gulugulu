use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::env;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime};
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
}

#[derive(Clone, Debug, Default)]
pub struct SharedCodexState(Arc<Mutex<CodexStateInner>>);

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
    pub total_tokens: u64,
    pub experience: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub cached_input_tokens: u64,
    pub output_tokens: u64,
    pub reasoning_output_tokens: u64,
    pub total_tokens: u64,
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
    /// 本次事件实际喂进宠物的精力点数（game 层，token→精力，v1.1）。
    pub fed_stamina: i64,
    /// 本次喂养的主要受益宠（份额最大者；前端 Token 飞行 FX 的锚点）。
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
    total_usage: Option<TokenUsage>,
    last_usage: Option<TokenUsage>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressStore {
    projects: BTreeMap<String, ProjectProgress>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectProgress {
    project_path: String,
    total_tokens: u64,
    experience: u64,
    sources: AgentSources,
    updated_at: String,
}

impl ProjectProgress {
    fn new(project_path: String) -> Self {
        Self {
            project_path,
            total_tokens: 0,
            experience: 0,
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
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeCodeSourceProgress {
    #[serde(default)]
    session_offsets: BTreeMap<String, u64>,
    #[serde(default)]
    session_totals: BTreeMap<String, u64>,
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
        CodexStatus {
            codex_home: state.codex_home.as_ref().map(path_to_string),
            claude_home: state.claude_home.as_ref().map(path_to_string),
            watching: state.watching,
            codex_watching: state.codex_watching,
            claude_code_watching: state.claude_code_watching,
            latest_session: state.latest_session.as_ref().map(path_to_string),
            active_source: state.active_source.clone(),
            project_path: state.current_project.clone(),
            error: state.error.clone(),
            total_tokens: state.total_tokens,
            experience: state.experience,
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
                emit_error(&app, "codex", "Codex home not found.");
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
                emit_error(&app, "codex", "No Codex session files found.");
                thread::sleep(Duration::from_secs(2));
                continue;
            };

            if active_file.as_ref() != Some(&latest) {
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

            match read_new_events(&latest, offset, &mut parse_state) {
                Ok((new_offset, events)) => {
                    offset = new_offset;
                    if let Some(project_path) = &active_project {
                        let _ = update_codex_session_offset(&app, project_path, &latest, offset);
                    }
                    for event in events {
                        if event.kind == "token_count" {
                            if let Some(project_path) = &active_project {
                                let token_event =
                                    agent_token_event_from_codex(&latest, project_path, event);
                                match apply_agent_token_event(&app, token_event) {
                                    Ok(activity) => {
                                        set_project_progress(
                                            &state,
                                            activity.project_path.clone(),
                                            activity.project_total_tokens,
                                            activity.project_experience,
                                        );
                                        let activity = enrich_with_game_feed(&app, activity);
                                        let _ = app.emit("codex://activity", activity);
                                    }
                                    Err(error) => {
                                        set_error(&state, "codex", &error);
                                        emit_error(&app, "codex", &error);
                                    }
                                }
                                continue;
                            }
                        }
                        let _ = app.emit("codex://activity", event);
                    }
                }
                Err(error) => {
                    set_error(&state, "codex", &error);
                    emit_error(&app, "codex", &error);
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

            match read_new_claude_code_events(&latest, offset, &mut parse_state) {
                Ok((new_offset, events)) => {
                    offset = new_offset;
                    if let Some(project_path) = &active_project {
                        let _ =
                            update_claude_code_session_offset(&app, project_path, &latest, offset);
                    }

                    for event in events {
                        if event.kind == "token_count" {
                            if let Some(project_path) = &active_project {
                                let token_event = agent_token_event_from_claude_code(
                                    &latest,
                                    project_path,
                                    event,
                                );
                                match apply_agent_token_event(&app, token_event) {
                                    Ok(activity) => {
                                        set_project_progress(
                                            &state,
                                            activity.project_path.clone(),
                                            activity.project_total_tokens,
                                            activity.project_experience,
                                        );
                                        let activity = enrich_with_game_feed(&app, activity);
                                        let _ = app.emit("codex://activity", activity);
                                    }
                                    Err(error) => {
                                        set_error(&state, "claudeCode", &error);
                                        emit_error(&app, "claudeCode", &error);
                                    }
                                }
                                continue;
                            }
                        }

                        let _ = app.emit("codex://activity", event);
                    }
                }
                Err(error) => {
                    set_error(&state, "claudeCode", &error);
                    emit_error(&app, "claudeCode", &error);
                }
            }

            thread::sleep(Duration::from_millis(750));
        }
    });
}

fn read_new_events(
    path: &Path,
    offset: u64,
    parse_state: &mut CodexParseState,
) -> Result<(u64, Vec<CodexActivityEvent>), String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let len = file.metadata().map_err(|error| error.to_string())?.len();
    let safe_offset = offset.min(len);
    file.seek(SeekFrom::Start(safe_offset))
        .map_err(|error| error.to_string())?;

    let reader = BufReader::new(file);
    let mut events = Vec::new();
    let session_id = session_id_from_path(path);

    for line in reader.lines() {
        let line = line.map_err(|error| error.to_string())?;
        events.extend(parse_codex_line(&line, &session_id, parse_state));
    }

    Ok((len, events))
}

fn read_new_claude_code_events(
    path: &Path,
    offset: u64,
    parse_state: &mut ClaudeCodeParseState,
) -> Result<(u64, Vec<CodexActivityEvent>), String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let len = file.metadata().map_err(|error| error.to_string())?.len();
    let safe_offset = offset.min(len);
    file.seek(SeekFrom::Start(safe_offset))
        .map_err(|error| error.to_string())?;

    let reader = BufReader::new(file);
    let mut events = Vec::new();
    let session_id = session_id_from_path(path);

    for line in reader.lines() {
        let line = line.map_err(|error| error.to_string())?;
        events.extend(parse_claude_code_line(&line, &session_id, parse_state));
    }

    Ok((len, events))
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
            fed_stamina: 0,
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
    let cached_input_tokens = usage
        .get("cache_creation_input_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0)
        .saturating_add(
            usage
                .get("cache_read_input_tokens")
                .and_then(Value::as_u64)
                .unwrap_or(0),
        );
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
                fed_stamina: 0,
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
    Some(TokenUsage {
        input_tokens: value
            .get("input_tokens")
            .and_then(Value::as_u64)
            .unwrap_or(0),
        cached_input_tokens: value
            .get("cached_input_tokens")
            .and_then(Value::as_u64)
            .unwrap_or(0),
        output_tokens: value
            .get("output_tokens")
            .and_then(Value::as_u64)
            .unwrap_or(0),
        reasoning_output_tokens: value
            .get("reasoning_output_tokens")
            .and_then(Value::as_u64)
            .unwrap_or(0),
        total_tokens: value
            .get("total_tokens")
            .and_then(Value::as_u64)
            .unwrap_or(0),
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
        fed_stamina: 0,
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
        fed_stamina: 0,
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
        fed_stamina: 0,
        fed_pet_id: None,
        total_usage: None,
        last_usage: None,
    };
    eprintln!("Gulugulu Codex adapter: {error}");
    let _ = app.emit("codex://activity", event);
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

    AgentTokenEvent {
        source: "codex".to_string(),
        project_path: project_path.to_string(),
        session_id: event.session_id,
        session_path: path_to_string(&session_path.to_path_buf()),
        timestamp: event.timestamp,
        token_delta,
        total_usage: event.total_usage,
        last_usage: event.last_usage,
    }
}

fn agent_token_event_from_claude_code(
    session_path: &Path,
    project_path: &str,
    event: CodexActivityEvent,
) -> AgentTokenEvent {
    AgentTokenEvent {
        source: "claudeCode".to_string(),
        project_path: project_path.to_string(),
        session_id: event.session_id,
        session_path: path_to_string(&session_path.to_path_buf()),
        timestamp: event.timestamp,
        token_delta: event.token_delta,
        total_usage: event.total_usage,
        last_usage: event.last_usage,
    }
}

fn apply_agent_token_event(
    app: &AppHandle,
    event: AgentTokenEvent,
) -> Result<CodexActivityEvent, String> {
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

    if token_delta > 0 {
        project.total_tokens = project.total_tokens.saturating_add(token_delta);
        project.experience = project.total_tokens / 1000;
        project.updated_at = event.timestamp.clone();
    }

    if let Some(total) = &event.total_usage {
        if event.source == "claudeCode" {
            project
                .sources
                .claude_code
                .session_totals
                .insert(event.session_path.clone(), total.total_tokens);
        } else {
            project
                .sources
                .codex
                .session_totals
                .insert(event.session_path.clone(), total.total_tokens);
        }
    }

    let project_total_tokens = project.total_tokens;
    let project_experience = project.experience;
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
        fed_stamina: 0,
        fed_pet_id: None,
        total_usage: event.total_usage,
        last_usage: event.last_usage,
    })
}

/// Feed the game layer with the fresh raw tokens this event produced
/// (ledger-increment semantics; v1.1 tokens→精力, InteractionEconomy §9) and
/// stamp the outcome onto the event so the frontend can fly the token chip.
fn enrich_with_game_feed(app: &AppHandle, mut activity: CodexActivityEvent) -> CodexActivityEvent {
    if let Some(project_path) = activity.project_path.clone() {
        if let Some(state) = app.try_state::<crate::game::SharedGameState>() {
            if let Some(outcome) = crate::game::feed_from_project_tokens(
                app,
                state.inner(),
                &project_path,
                activity.project_total_tokens,
            ) {
                activity.fed_stamina = outcome.stamina_fed;
                activity.fed_pet_id = outcome
                    .per_pet
                    .iter()
                    .max_by_key(|gain| gain.stamina_gained)
                    .map(|gain| gain.pet_id.clone());
            }
        }
    }
    activity
}

/// 进度存档快照：(全项目累计 experience 之和, 按项目的原始 total_tokens 基线)。
/// 前者用于首建存档的历史折币礼包（GDD §3.3 并轨），后者播种 v3 的
/// token→精力增量账本（InteractionEconomy §9）。
pub fn progress_snapshot(app: &AppHandle) -> (u64, BTreeMap<String, u64>) {
    match load_progress_store(app) {
        Ok(store) => {
            let mut baseline = BTreeMap::new();
            let mut total = 0u64;
            for (path, project) in &store.projects {
                total = total.saturating_add(project.experience);
                baseline.insert(path.clone(), project.total_tokens);
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

fn prepare_codex_session(
    app: &AppHandle,
    project_path: &str,
    session_path: &Path,
    file_len: u64,
) -> Result<u64, String> {
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

fn load_progress_store(app: &AppHandle) -> Result<ProgressStore, String> {
    let path = progress_path(app)?;
    if !path.exists() {
        return Ok(ProgressStore::default());
    }
    let contents = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&contents).map_err(|error| error.to_string())
}

fn save_progress_store(app: &AppHandle, store: &ProgressStore) -> Result<(), String> {
    let path = progress_path(app)?;
    let dir = path
        .parent()
        .ok_or_else(|| "Unable to resolve app data directory.".to_string())?;
    fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    let contents = serde_json::to_string_pretty(store).map_err(|error| error.to_string())?;
    fs::write(path, contents).map_err(|error| error.to_string())
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

    let mut latest: Option<(PathBuf, SystemTime)> = None;
    collect_jsonl_files(&sessions, &mut latest);
    latest.map(|(path, _)| path)
}

fn latest_claude_code_session_file(claude_home: &Path) -> Option<PathBuf> {
    let projects = claude_home.join("projects");
    if !projects.exists() {
        return None;
    }

    let mut latest: Option<(PathBuf, SystemTime)> = None;
    collect_jsonl_files(&projects, &mut latest);
    latest.map(|(path, _)| path)
}

fn collect_jsonl_files(dir: &Path, latest: &mut Option<(PathBuf, SystemTime)>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl_files(&path, latest);
            continue;
        }

        if path.extension().and_then(|ext| ext.to_str()) != Some("jsonl") {
            continue;
        }

        let modified = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);

        if latest
            .as_ref()
            .map(|(_, current)| modified > *current)
            .unwrap_or(true)
        {
            *latest = Some((path, modified));
        }
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
        return stem[stem.len() - 36..].to_string();
    }

    stem.to_string()
}

fn path_to_string(path: &PathBuf) -> String {
    path.to_string_lossy().to_string()
}
