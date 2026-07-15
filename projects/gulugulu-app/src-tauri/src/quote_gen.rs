use crate::cli_spawn::{available_providers, run_provider};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

// ---------------------------------------------------------------------------
// 动态台词后台生成（InteractionEconomy / 对话系统重构）
//
// 目标（用户需求）：连接 Claude/Codex 后，在后台用本地 CLI 预生成一批「更多、
// 更幽默、带实时 AI meme 梗」的双语随机台词；前端 chooseQuote 在动态池非空时
// 一半概率走动态句、一半走固定句。
//
// 复用 fusion_gen 的跨平台 spawn 工具集（available_providers / run_provider，
// 均在 neutral_cwd 里跑、不污染用户项目上下文）。
//
// worker 生命周期：启动即把上次缓存推给前端（秒开兜底）→ 尝试生成一批。
// - 生成成功：落盘 + 缓存 + emit(quotes://ready)，随后仅在 regenerate 唤醒时再生成
//   （契合「每次启动生成一批」，不反复烧额度）。
// - 未检测到 CLI（未连接）：每 30s 轻量探测重试，直到某次启动 Claude/Codex 后成功。
// - 已连 CLI 但生成失败/输出不合格：等待手动 regenerate（避免反复烧额度）。
// ---------------------------------------------------------------------------

const QUOTES_EVENT: &str = "quotes://ready";
const QUOTES_FILE: &str = "gulugulu-quotes.json";
const GEN_TIMEOUT_SECS: u64 = 180;
/// 未连接时的重探间隔。
const RETRY_INTERVAL: Duration = Duration::from_secs(30);
/// 少于该条数视为生成失败（模型跑偏 / 输出被截断）。
const MIN_QUOTES: usize = 6;
/// 单条文本上限（中文按字符、英文按字符都够用；防跑题长文塞进气泡）。
const MAX_TEXT_CHARS: usize = 64;

/// chooseQuote 的 17 个上下文过滤 tag——提示词只允许模型从中取标签，
/// 保证动态句能被状态 tag 命中（与 App.tsx speechContextTags 对齐）。
const FILTER_TAGS: &[&str] = &[
    "chatgpt",
    "meme",
    "coding",
    "agent",
    "sycophancy",
    "comfort",
    "claude",
    "assistant",
    "apology",
    "disclaimer",
    "overconfident",
    "deepseek",
    "safety",
    "refusal",
    "reasoning",
    "hallucination",
    "essay",
];

/// 一条动态台词（镜像 TS DynamicQuote / 前端 QuoteEntry）。字段均为单词小写，
/// 无需 camelCase 重命名。
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DynamicQuote {
    pub id: String,
    pub lang: String,
    pub text: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Default)]
struct QuoteStore {
    #[serde(default)]
    quotes: Vec<DynamicQuote>,
    #[serde(default)]
    generated_at: i64,
    #[serde(default)]
    provider: Option<String>,
}

pub struct QuoteGenStateInner {
    cache: Mutex<Vec<DynamicQuote>>,
    /// worker 唤醒信号（regenerate 时 notify）。
    signal: (Mutex<bool>, Condvar),
}

pub type QuoteGenState = Arc<QuoteGenStateInner>;

pub fn new_state() -> QuoteGenState {
    Arc::new(QuoteGenStateInner {
        cache: Mutex::new(Vec::new()),
        signal: (Mutex::new(false), Condvar::new()),
    })
}

fn quotes_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join(QUOTES_FILE))
}

fn load_cached(app: &AppHandle) -> Vec<DynamicQuote> {
    let Some(path) = quotes_path(app) else {
        return Vec::new();
    };
    let Ok(text) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    serde_json::from_str::<QuoteStore>(&text)
        .map(|store| store.quotes)
        .unwrap_or_default()
}

/// 原子落盘（tmp + rename，对齐 game.rs persist 约定）。
fn persist(app: &AppHandle, store: &QuoteStore) {
    let Some(path) = quotes_path(app) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let Ok(json) = serde_json::to_string_pretty(store) else {
        return;
    };
    let tmp = path.with_extension("json.tmp");
    if std::fs::write(&tmp, json.as_bytes()).is_ok() {
        let _ = std::fs::rename(&tmp, &path);
    }
}

/// Command：读已缓存的动态台词（前端挂载时拉取一次）。
#[tauri::command]
pub fn get_dynamic_quotes(state: tauri::State<'_, QuoteGenState>) -> Vec<DynamicQuote> {
    state.cache.lock().map(|cache| cache.clone()).unwrap_or_default()
}

/// Command（调试面板）：强制重新生成一批动态台词。
#[tauri::command]
pub fn regenerate_quotes(state: tauri::State<'_, QuoteGenState>) {
    notify_worker(&state);
}

fn notify_worker(state: &QuoteGenState) {
    let (lock, cvar) = &state.signal;
    if let Ok(mut pending) = lock.lock() {
        *pending = true;
        cvar.notify_all();
    }
}

fn wait_for_signal(state: &QuoteGenState, timeout: Option<Duration>) {
    let (lock, cvar) = &state.signal;
    let mut pending = match lock.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };
    if *pending {
        *pending = false;
        return;
    }
    match timeout {
        Some(dur) => {
            pending = match cvar.wait_timeout(pending, dur) {
                Ok((guard, _)) => guard,
                Err(poisoned) => poisoned.into_inner().0,
            };
        }
        None => {
            pending = match cvar.wait(pending) {
                Ok(guard) => guard,
                Err(poisoned) => poisoned.into_inner(),
            };
        }
    }
    *pending = false;
}

fn build_prompt() -> String {
    let tags = FILTER_TAGS.join(", ");
    format!(
        r#"你在为桌面宠物「咕噜鸭」创作随机吐槽台词。它会在角色头顶的对话气泡里冒出这些短句。

要求：
- 风格：幽默、带 AI 圈的实时梗，调侃各家 AI（ChatGPT / Claude / Gemini / DeepSeek / Bing 等）、Agent 写代码、模型幻觉、疯狂道歉、彩虹屁、免责声明；也可以是程序员日常吐槽或卖萌安慰。
- 语言：中英各占一半。中文每条不超过 20 字，英文每条不超过 12 个词。要口语、俏皮，别写正经解释。
- 每条打 1~3 个 tag，只能从这个集合里取：{tags}。
- 数量：大约 30 条（中文约 15 条，英文约 15 条）。
- 不要露骨、政治敏感或人身攻击的内容，玩梗即可。

只输出一个 JSON 对象，不要任何解释文字，也不要代码围栏：
{{"quotes":[{{"lang":"zh","text":"你说得对，我马上重构。","tags":["claude","sycophancy","coding"]}},{{"lang":"en","text":"It compiles, therefore it ships.","tags":["coding","overconfident","meme"]}}]}}"#,
        tags = tags
    )
}

/// 解析 run_provider 返回的 JSON 对象串（{{"quotes":[...]}}）为校验过的台词列表。
fn parse_quotes(raw: &str) -> Vec<DynamicQuote> {
    let Ok(value) = serde_json::from_str::<Value>(raw) else {
        return Vec::new();
    };
    let items = value.get("quotes").and_then(Value::as_array).cloned().unwrap_or_default();
    let mut out = Vec::new();
    for item in &items {
        let lang = item.get("lang").and_then(Value::as_str).unwrap_or("").trim();
        if lang != "zh" && lang != "en" {
            continue;
        }
        let text = item.get("text").and_then(Value::as_str).unwrap_or("").trim();
        if text.is_empty() || text.chars().count() > MAX_TEXT_CHARS {
            continue;
        }
        let tags: Vec<String> = item
            .get("tags")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter_map(Value::as_str)
                    .filter(|tag| FILTER_TAGS.contains(tag))
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default();
        // 至少留一个能被状态命中的 tag，否则动态句只会在"任意回退"时才出现。
        let tags = if tags.is_empty() { vec!["meme".to_string()] } else { tags };
        out.push(DynamicQuote {
            id: format!("dyn-{:03}", out.len() + 1),
            lang: lang.to_string(),
            text: text.to_string(),
            tags,
        });
    }
    out
}

enum GenOutcome {
    Generated(Vec<DynamicQuote>, String),
    /// 没有可用的 CLI provider（未安装 / 未连接）。
    NoProvider,
    /// provider 跑了但输出不合格（跑题 / 截断 / 未登录）。
    Failed,
}

fn attempt(prompt: &str) -> GenOutcome {
    let providers = available_providers();
    if providers.is_empty() {
        return GenOutcome::NoProvider;
    }
    let timeout = Duration::from_secs(GEN_TIMEOUT_SECS);
    for (provider, path) in providers {
        if let Ok(raw) = run_provider(provider, &path, prompt, timeout) {
            let quotes = parse_quotes(&raw);
            if quotes.len() >= MIN_QUOTES {
                return GenOutcome::Generated(quotes, provider.name().to_string());
            }
        }
    }
    GenOutcome::Failed
}

pub fn spawn_quote_worker(app: AppHandle, state: QuoteGenState) {
    // 先把上次缓存灌进内存并推给前端（秒开时用旧梗兜底，新批到达后替换）。
    let cached = load_cached(&app);
    if !cached.is_empty() {
        if let Ok(mut cache) = state.cache.lock() {
            *cache = cached.clone();
        }
        let _ = app.emit(QUOTES_EVENT, cached);
    }

    thread::spawn(move || {
        let prompt = build_prompt();
        loop {
            match attempt(&prompt) {
                GenOutcome::Generated(quotes, provider) => {
                    if let Ok(mut cache) = state.cache.lock() {
                        *cache = quotes.clone();
                    }
                    persist(
                        &app,
                        &QuoteStore {
                            quotes: quotes.clone(),
                            generated_at: crate::game::now_secs(),
                            provider: Some(provider),
                        },
                    );
                    let _ = app.emit(QUOTES_EVENT, quotes);
                    // 生成成功：等待手动 regenerate（本次启动的一批到此为止）。
                    wait_for_signal(&state, None);
                }
                GenOutcome::NoProvider => {
                    // 未连接：轻量重探，直到某次启动了 Claude/Codex。
                    wait_for_signal(&state, Some(RETRY_INTERVAL));
                }
                GenOutcome::Failed => {
                    // 已连接但生成失败：不反复烧额度，等手动 regenerate。
                    wait_for_signal(&state, None);
                }
            }
        }
    });
}
