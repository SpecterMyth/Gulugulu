use crate::cli_spawn::{available_providers, probe_cli, run_provider, tail_of, Provider};
use crate::game::{
    self, ChimeraForm, CustomPalette, CustomRig, CustomSpeciesEntry, CustomVisualSpec, CustomWorkFx,
    EggInstance, GameSave, RigViewParts, ShapeNode, SharedGameState, SlotSpec, SpeciesSkin,
    WorkFxParticle,
};
use crate::game_config::SpeciesInfo;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

// ---------------------------------------------------------------------------
// AI 融合生成模块：本地 Claude Code CLI（优先）/ Codex CLI（兜底）
//
// 架构（计划：AI 融合机制 + SkinWorkshop.md 皮肤系统 2026-07-18）：
// - 预检：`claude --version` → `codex --version`，均失败 → 前端弹拒绝弹窗。
// - fuse_pets_ai：校验守卫 → 掷骰（aiFusionChance）→ 配方路径走老逻辑 /
//   AI 路径"先提交后生成"（消耗双亲+产挂起蛋）并唤醒 worker，秒级返回。
// - worker：挂起蛋即队列（天然抗重启）。每颗蛋一个生成周期 =
//   claude(初次+带校验错误的纠错重试) → codex(同样两次) → **工坊兜底复用**
//   （该槽已有他人首发形象则下载采用，顺带记首发皮肤）→ 标记 failed；
//   本地生成优先于工坊复用（自己的形象即"本地皮肤"，一律发布 = always-publish）。
//   应用重启时 failed/generating 复位为 pending 再试。孵化到期仍未完成 →
//   蛋按兜底 guluduck 孵出（species 初始值即兜底，无需特殊分支）。
// - 进度：`fusion://progress` 事件 + 每次状态落盘后补发 `game://state`。
// ---------------------------------------------------------------------------

const FUSION_PARTS_JSON: &str = include_str!("../../src/game/fusionParts.json");
const PROGRESS_EVENT: &str = "fusion://progress";
const STATE_EVENT: &str = "game://state";
const DEFAULT_TIMEOUT_SECS: u64 = 300;
const CLI_CACHE_TTL: Duration = Duration::from_secs(120);
/// 会话内自动重试上限：每颗融合蛋最多经历这么多次生成周期（含首次）。
/// 达到上限后停在 failed，等孵化期限到自然孵出兜底 guluduck；应用重启会另给一次机会。
/// 每次周期是一次慢速 CLI 调用（天然限速），且仅在没有新融合排队时才回捡失败蛋。
const MAX_FUSION_ATTEMPTS: u32 = 3;
const MAX_CUSTOM_NODES: usize = 12;
const MAX_PATH_LEN: usize = 600;
const MAX_SLOTS: usize = 4;
const COORD_BOUND: f64 = 300.0;
const SCALE_MIN: f64 = 1.05;
const SCALE_MAX: f64 = 1.25;
/// custom rig：单个部件的节点上限，与整个视图的节点总上限（防滥用/超大 payload）。
const MAX_RIG_PART_NODES: usize = 24;
const MAX_RIG_VIEW_NODES: usize = 170;

// ---------------------------------------------------------------------------
// 共享部件目录（与 src/game/fusionParts.json 单一事实源）
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct CatalogRig {
    zh: String,
}

#[derive(Debug, Deserialize)]
struct CatalogElementHint {
    parts: Vec<String>,
    colors: Vec<String>,
}

/// 共享「实物粒子目录」的一条记录（id + 中文提示）。前端按同名 id 映射到内置渲染器；
/// Rust 端 id 用作 workFx `ref` 校验白名单，hint 用于拼提示词菜单（校验不读 hint）。
#[derive(Debug, Deserialize)]
struct CatalogWorkParticle {
    id: String,
    hint: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FusionCatalog {
    rigs: BTreeMap<String, CatalogRig>,
    eyes: Vec<String>,
    tools: BTreeMap<String, String>,
    // 每件工具「打工时喷出的产物」提示（toolId → 中文一句）；拼提示词绑定粒子=工具产物。
    tool_fx_hints: BTreeMap<String, String>,
    // 共享实物粒子目录（36 个 id+hint，按主题排序）：workFx 粒子可 `ref` 复用其中若干。
    work_particles: Vec<CatalogWorkParticle>,
    slots: BTreeMap<String, BTreeMap<String, String>>,
    slot_geometry: BTreeMap<String, String>,
    custom_draw_rules: String,
    element_hints: BTreeMap<String, CatalogElementHint>,
    species_signatures: BTreeMap<String, Vec<String>>,
    style_red_lines: Vec<String>,
}

fn catalog() -> &'static FusionCatalog {
    static CATALOG: OnceLock<FusionCatalog> = OnceLock::new();
    CATALOG.get_or_init(|| serde_json::from_str(FUSION_PARTS_JSON).expect("fusionParts.json is invalid"))
}

/// 共享实物粒子目录的 id 集合（workFx `ref` 的校验白名单，惰性构建一次）。
fn work_particle_ids() -> &'static BTreeSet<String> {
    static IDS: OnceLock<BTreeSet<String>> = OnceLock::new();
    IDS.get_or_init(|| catalog().work_particles.iter().map(|w| w.id.clone()).collect())
}

// ---------------------------------------------------------------------------
// 状态 + 事件
// ---------------------------------------------------------------------------

pub struct FusionGenStateInner {
    cli_cache: Mutex<Option<(FusionCliStatus, Instant)>>,
    /// worker 唤醒信号（有新挂起蛋时 notify）。
    signal: (Mutex<bool>, Condvar),
}

pub type FusionGenState = Arc<FusionGenStateInner>;

pub fn new_state() -> FusionGenState {
    Arc::new(FusionGenStateInner {
        cli_cache: Mutex::new(None),
        signal: (Mutex::new(false), Condvar::new()),
    })
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FusionCliStatus {
    pub available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FusionStartResult {
    /// "recipe" | "ai"
    pub mode: String,
    pub save: GameSave,
    pub egg_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub species: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FusionProgressEvent {
    egg_id: String,
    /// queued | generating | retrying | validating | resolved | failed
    phase: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    provider: Option<String>,
    attempt: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    elapsed_secs: u64,
}

fn emit_progress(
    app: &AppHandle,
    egg_id: &str,
    phase: &str,
    provider: Option<&str>,
    attempt: u32,
    message: Option<String>,
    started: Instant,
) {
    let _ = app.emit(
        PROGRESS_EVENT,
        FusionProgressEvent {
            egg_id: egg_id.to_string(),
            phase: phase.to_string(),
            provider: provider.map(|p| p.to_string()),
            attempt,
            message,
            elapsed_secs: started.elapsed().as_secs(),
        },
    );
}

// ---------------------------------------------------------------------------
// CLI 预检（复用 cli_spawn 的解析/探测；这里只组装融合专属的 FusionCliStatus）
// ---------------------------------------------------------------------------

fn probe_all() -> FusionCliStatus {
    match probe_cli("claude") {
        Ok((path, version)) => FusionCliStatus {
            available: true,
            provider: Some("claude".to_string()),
            version: Some(version),
            path: Some(path.display().to_string()),
            error: None,
        },
        Err(claude_error) => match probe_cli("codex") {
            Ok((path, version)) => FusionCliStatus {
                available: true,
                provider: Some("codex".to_string()),
                version: Some(version),
                path: Some(path.display().to_string()),
                error: None,
            },
            Err(codex_error) => FusionCliStatus {
                available: false,
                provider: None,
                version: None,
                path: None,
                error: Some(format!("Claude Code：{claude_error}；Codex：{codex_error}")),
            },
        },
    }
}

fn check_cli_cached(state: &FusionGenState, force: bool) -> FusionCliStatus {
    if !force {
        if let Ok(cache) = state.cli_cache.lock() {
            if let Some((status, at)) = cache.as_ref() {
                if at.elapsed() < CLI_CACHE_TTL {
                    return status.clone();
                }
            }
        }
    }
    let status = probe_all();
    if let Ok(mut cache) = state.cli_cache.lock() {
        *cache = Some((status.clone(), Instant::now()));
    }
    status
}

fn fusion_timeout() -> Duration {
    let secs = std::env::var("GULUGULU_FUSION_TIMEOUT_SECS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value >= 30)
        .unwrap_or(DEFAULT_TIMEOUT_SECS);
    Duration::from_secs(secs)
}

/// 融合物种设计用的模型：物种形象是全局最重要的创作，默认用**最强**模型。
/// - claude：`opus`（别名解析到最新 Opus，最强）；
/// - codex：用其自身默认模型（不同装机差异大，不硬编码）。
/// `GULUGULU_FUSION_MODEL` 环境变量可整体覆盖（两个 provider 都用它）。
fn fusion_model(provider: Provider) -> Option<String> {
    if let Ok(model) = std::env::var("GULUGULU_FUSION_MODEL") {
        let model = model.trim().to_string();
        if !model.is_empty() {
            return Some(model);
        }
    }
    match provider {
        Provider::Claude => Some("opus".to_string()),
        Provider::Codex => None,
    }
}

// ---------------------------------------------------------------------------
// CLI 输出校验（权威校验；TS 渲染层另有静默兜底）
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CliDesign {
    codename: Option<String>,
    name_zh: Option<String>,
    #[serde(default)]
    name_en: Option<String>,
    desc: Option<String>,
    #[serde(default)]
    desc_en: Option<String>,
    /// 设计所依据的真实动物/植物原型名（如"水獭"/"捕蝇草"）。customRig 路径必填，
    /// 逼模型先锚定一个真实物种再作画（防抽象团子）。
    prototype: Option<String>,
    scale: Option<f64>,
    palette: Option<CustomPalette>,
    eyes: Option<String>,
    tool_id: Option<String>,
    #[serde(default)]
    form: Option<ChimeraFormInput>,
    /// AI 完全手绘的三视图专属 rig（优先于 form）。
    #[serde(default)]
    custom_rig: Option<CustomRig>,
    #[serde(default)]
    work_fx: Option<CustomWorkFx>,
    #[serde(default)]
    slots: BTreeMap<String, SlotSpec>,
}

/// CLI 输出的 chimera 身体参数（全部可选；normalize 时夹取/补默认）。
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChimeraFormInput {
    body_plan: Option<String>,
    segments: Option<f64>,
    body_w: Option<f64>,
    body_h: Option<f64>,
    taper: Option<f64>,
    head_style: Option<String>,
    head_scale: Option<f64>,
    leg_style: Option<String>,
    leg_count: Option<f64>,
    arm_style: Option<String>,
    ear_style: Option<String>,
    floating: Option<bool>,
}

fn clampf(v: Option<f64>, lo: f64, hi: f64, fallback: f64) -> f64 {
    v.filter(|n| n.is_finite()).unwrap_or(fallback).clamp(lo, hi)
}

fn one_of(v: &Option<String>, allowed: &[&str], fallback: &str) -> String {
    match v {
        Some(s) if allowed.contains(&s.as_str()) => s.clone(),
        _ => fallback.to_string(),
    }
}

/// AI 融合合法的动物体型（stack 仅为兼容旧存档，不在此列——新生成必须选动物体型）。
const ANIMAL_BODY_PLANS: [&str; 6] = ["round", "upright", "quadruped", "long", "floaty", "bighead"];

/// 归一化 chimera form（宽容：缺字段补默认、越界夹取、枚举非法回落）。
/// head_scale 下限 0.7 = 可爱底线：脸随头走，头太小表情不可读。
/// bodyPlan 非法/缺失回落 "stack"（validate_design 会拒绝 stack，逼模型重选动物体型）。
fn normalize_form(input: ChimeraFormInput) -> ChimeraForm {
    let body_plan = one_of(
        &input.body_plan,
        &["stack", "round", "upright", "quadruped", "long", "floaty", "bighead"],
        "stack",
    );
    // floaty 体型天然离地：强制 floating，与渲染层一致。
    let floating = if body_plan == "floaty" { true } else { input.floating.unwrap_or(false) };
    ChimeraForm {
        body_plan,
        segments: clampf(input.segments, 1.0, 3.0, 1.0).round() as u8,
        body_w: clampf(input.body_w, 0.75, 1.3, 1.0),
        // bodyH 下限 0.85：更低会压成扁片/虫子，破坏可爱幼态（与渲染层一致）。
        body_h: clampf(input.body_h, 0.85, 1.35, 1.0),
        taper: clampf(input.taper, 0.0, 1.0, 0.3),
        head_style: one_of(&input.head_style, &["merged", "perched"], "merged"),
        head_scale: clampf(input.head_scale, 0.7, 1.0, 0.8),
        leg_style: one_of(&input.leg_style, &["none", "stub", "tall"], "stub"),
        leg_count: if clampf(input.leg_count, 2.0, 4.0, 2.0) >= 3.0 { 4 } else { 2 },
        arm_style: one_of(&input.arm_style, &["none", "nub", "wing", "flipper"], "nub"),
        ear_style: one_of(&input.ear_style, &["none", "round", "point", "long", "fin"], "round"),
        floating,
    }
}

#[derive(Debug)]
struct ValidatedDesign {
    codename_hint: Option<String>,
    name_zh: String,
    name_en: String,
    desc: String,
    desc_en: String,
    /// 设计原型（真实动植物名，customRig 路径必有；仅用于日志/评审，不入存档）。
    prototype: Option<String>,
    visual: CustomVisualSpec,
}

fn is_hex_color(value: &str) -> bool {
    value.len() == 7 && value.starts_with('#') && value[1..].chars().all(|c| c.is_ascii_hexdigit())
}

fn is_palette_token(value: &str) -> bool {
    matches!(value, "$body" | "$deep" | "$belly" | "$accent" | "$accent2" | "$outline")
}

fn is_valid_color(value: &str) -> bool {
    value == "none" || is_palette_token(value) || is_hex_color(value)
}

pub(crate) fn is_valid_codename(value: &str) -> bool {
    let len = value.len();
    if !(3..=16).contains(&len) {
        return false;
    }
    let mut chars = value.chars();
    match chars.next() {
        Some(c) if c.is_ascii_lowercase() => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
}

fn has_cjk(value: &str) -> bool {
    value.chars().any(|c| ('\u{4E00}'..='\u{9FFF}').contains(&c))
}

/// 扫描文本里的所有数字并检查绝对值上界（path d / points / transform 通用）。
fn numbers_within_bounds(text: &str, bound: f64) -> bool {
    fn flush(token: &mut String, bound: f64) -> bool {
        if token.is_empty() {
            return true;
        }
        let ok = token.parse::<f64>().map(|n| n.abs() <= bound).unwrap_or(false);
        token.clear();
        ok
    }
    let mut token = String::new();
    for c in text.chars() {
        match c {
            '0'..='9' | '.' => token.push(c),
            '-' => {
                if !flush(&mut token, bound) {
                    return false;
                }
                token.push('-');
            }
            _ => {
                if !flush(&mut token, bound) {
                    return false;
                }
            }
        }
    }
    flush(&mut token, bound)
}

fn is_valid_transform(value: &str) -> bool {
    let mut rest = value.trim();
    if rest.is_empty() {
        return false;
    }
    while !rest.is_empty() {
        let Some(open) = rest.find('(') else { return false };
        let name = rest[..open].trim();
        if !matches!(name, "translate" | "rotate" | "scale") {
            return false;
        }
        let Some(close_rel) = rest[open..].find(')') else { return false };
        let close = open + close_rel;
        let inner = &rest[open + 1..close];
        if !inner
            .chars()
            .all(|c| c.is_ascii_digit() || matches!(c, '.' | '-' | ' ' | ','))
        {
            return false;
        }
        if !numbers_within_bounds(inner, COORD_BOUND) {
            return false;
        }
        rest = rest[close + 1..].trim_start();
    }
    true
}

fn validate_shape_node(node: &ShapeNode, where_: &str) -> Result<(), String> {
    const NODE_TYPES: [&str; 6] = ["path", "circle", "ellipse", "rect", "polygon", "line"];
    if !NODE_TYPES.contains(&node.node_type.as_str()) {
        return Err(format!("{where_}: 未知节点类型 {}", node.node_type));
    }
    if let Some(fill) = &node.fill {
        if !is_valid_color(fill) {
            return Err(format!("{where_}: fill 只能是调色板 token 或 #rrggbb"));
        }
    }
    if let Some(stroke) = &node.stroke {
        if !is_valid_color(stroke) {
            return Err(format!("{where_}: stroke 只能是调色板 token 或 #rrggbb"));
        }
    }
    if let Some(width) = node.stroke_width {
        if !(0.0..=8.0).contains(&width) {
            return Err(format!("{where_}: strokeWidth 需在 0~8"));
        }
    }
    if let Some(opacity) = node.opacity {
        if !(0.0..=1.0).contains(&opacity) {
            return Err(format!("{where_}: opacity 需在 0~1"));
        }
    }
    if let Some(transform) = &node.transform {
        if !is_valid_transform(transform) {
            return Err(format!("{where_}: transform 只允许 translate/rotate/scale"));
        }
    }
    match node.node_type.as_str() {
        "path" => {
            let d = node.d.as_deref().unwrap_or("");
            if d.is_empty() {
                return Err(format!("{where_}: path 缺少 d"));
            }
            if d.len() > MAX_PATH_LEN {
                return Err(format!("{where_}: d 过长（≤{MAX_PATH_LEN} 字符）"));
            }
            if !d.chars().all(|c| {
                c.is_ascii_digit()
                    || c.is_ascii_whitespace()
                    || matches!(c, 'M' | 'm' | 'L' | 'l' | 'H' | 'h' | 'V' | 'v' | 'C' | 'c' | 'S' | 's' | 'Q' | 'q' | 'T' | 't' | 'A' | 'a' | 'Z' | 'z' | ',' | '.' | '-')
            }) {
                return Err(format!("{where_}: d 含非法字符"));
            }
            if !numbers_within_bounds(d, COORD_BOUND) {
                return Err(format!("{where_}: d 坐标超界（|n|≤{COORD_BOUND}）"));
            }
        }
        "polygon" => {
            let points = node.points.as_deref().unwrap_or("");
            if points.is_empty()
                || !points
                    .chars()
                    .all(|c| c.is_ascii_digit() || c.is_ascii_whitespace() || matches!(c, ',' | '.' | '-'))
                || !numbers_within_bounds(points, COORD_BOUND)
            {
                return Err(format!("{where_}: polygon points 非法"));
            }
        }
        _ => {}
    }
    for (key, value) in [
        ("cx", node.cx),
        ("cy", node.cy),
        ("r", node.r),
        ("rx", node.rx),
        ("ry", node.ry),
        ("x", node.x),
        ("y", node.y),
        ("width", node.width),
        ("height", node.height),
        ("x1", node.x1),
        ("y1", node.y1),
        ("x2", node.x2),
        ("y2", node.y2),
    ] {
        if let Some(value) = value {
            if value.abs() > COORD_BOUND {
                return Err(format!("{where_}: {key} 需为 |n|≤{COORD_BOUND} 的数字"));
            }
        }
    }
    Ok(())
}

/// 容忍 codex/claude 偶尔把数字加引号（如坐标写成 "-24"）：把**纯数字字符串**
/// 递归改成 JSON 数字。本 schema 里没有合法的纯数字字符串字段（codename 以字母
/// 开头、名字/设定是中文、颜色以 #/$ 开头、枚举是英文词），故全局强转是安全的。
fn coerce_numeric_strings(value: &mut serde_json::Value) {
    use serde_json::Value;
    match value {
        Value::String(s) => {
            let t = s.trim();
            if t.is_empty() {
                return;
            }
            if let Ok(n) = t.parse::<i64>() {
                *value = Value::from(n);
            } else if let Ok(f) = t.parse::<f64>() {
                if f.is_finite() {
                    *value = Value::from(f);
                }
            }
        }
        Value::Array(arr) => arr.iter_mut().for_each(coerce_numeric_strings),
        Value::Object(map) => map.values_mut().for_each(coerce_numeric_strings),
        _ => {}
    }
}

/// 容忍 polygon.points 写成数组（[[x,y],…] 或 [x,y,x,y,…]，codex 常见直觉写法）：
/// 转成标准 SVG 字符串 "x,y x,y …"。非纯数字数组不动，交给后续校验拒绝。
fn coerce_points_arrays(value: &mut serde_json::Value) {
    use serde_json::Value;
    match value {
        Value::Array(arr) => arr.iter_mut().for_each(coerce_points_arrays),
        Value::Object(map) => {
            for (key, v) in map.iter_mut() {
                if key == "points" {
                    if let Value::Array(items) = v {
                        let mut nums: Vec<f64> = Vec::new();
                        let mut ok = true;
                        for item in items.iter() {
                            match item {
                                Value::Number(n) => nums.push(n.as_f64().unwrap_or(f64::NAN)),
                                Value::Array(pair) => {
                                    for p in pair {
                                        match p.as_f64() {
                                            Some(f) => nums.push(f),
                                            None => {
                                                ok = false;
                                                break;
                                            }
                                        }
                                    }
                                }
                                _ => {
                                    ok = false;
                                }
                            }
                            if !ok {
                                break;
                            }
                        }
                        if ok
                            && !nums.is_empty()
                            && nums.len() % 2 == 0
                            && nums.iter().all(|n| n.is_finite())
                        {
                            let text = nums
                                .chunks(2)
                                .map(|c| format!("{},{}", c[0], c[1]))
                                .collect::<Vec<_>>()
                                .join(" ");
                            *v = Value::String(text);
                        }
                        continue;
                    }
                }
                coerce_points_arrays(v);
            }
        }
        _ => {}
    }
}

/// 夹取纯观感数值（strokeWidth 0~8 / opacity 0~1）：模型偶尔画超粗描边，
/// 这类问题夹取即可，不值得整只拒绝重试（2026-07 真机 codex 两例 strokeWidth 10+）。
fn clamp_cosmetic_ranges(value: &mut serde_json::Value) {
    use serde_json::Value;
    match value {
        Value::Array(arr) => arr.iter_mut().for_each(clamp_cosmetic_ranges),
        Value::Object(map) => {
            for (key, v) in map.iter_mut() {
                match key.as_str() {
                    "strokeWidth" => {
                        if let Some(n) = v.as_f64() {
                            *v = Value::from(n.clamp(0.0, 8.0));
                        }
                    }
                    "opacity" => {
                        if let Some(n) = v.as_f64() {
                            *v = Value::from(n.clamp(0.0, 1.0));
                        }
                    }
                    _ => clamp_cosmetic_ranges(v),
                }
            }
        }
        _ => {}
    }
}

/// custom rig：校验一个部件的节点组（数量 + 逐节点白名单）。
fn validate_rig_part(nodes: &[ShapeNode], where_: &str, require_nonempty: bool) -> Result<usize, String> {
    if require_nonempty && nodes.is_empty() {
        return Err(format!("{where_} 不能为空"));
    }
    if nodes.len() > MAX_RIG_PART_NODES {
        return Err(format!("{where_} 节点数需 ≤{MAX_RIG_PART_NODES}"));
    }
    for (i, node) in nodes.iter().enumerate() {
        validate_shape_node(node, &format!("{where_}[{i}]"))?;
    }
    Ok(nodes.len())
}

fn check_num(v: Option<f64>, bound: f64, name: &str) -> Result<(), String> {
    if let Some(n) = v {
        if !n.is_finite() || n.abs() > bound {
            return Err(format!("{name} 需为有限且 |n|≤{bound} 的数字"));
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// 面部卫生（防「静态脸叠动态脸」双嘴/双眼）
//
// 引擎按当前动作在 face 给定位置画**会动**的眼与嘴（眨眼/张嘴/咀嚼/星星眼…）。
// 若 AI 又在 muzzle/head 里的**同一眼位画了眼珠、或同一嘴位画了嘴线/张嘴**，就会
// 与引擎那套重影错位——用户实测：背后不动的鼻嘴 + 前面会动的嘴，脸看着散。
// 这里在校验期精确拦下最明确的两类违规并触发重生成；眼罩/黑眼圈（比眼大的块）、
// 鼻孔（远离眼、不在嘴线上的小点）、胡须腮红（描边/浅色、不横跨嘴位）都安全放行。
// beak 模式（face.mouth="beak"）的物种自带硬喙=嘴，引擎不画嘴 → 不查嘴位。
// ---------------------------------------------------------------------------

fn hex_luma(hex: &str) -> Option<f64> {
    if hex.len() == 7 && hex.starts_with('#') {
        let r = u8::from_str_radix(&hex[1..3], 16).ok()? as f64;
        let g = u8::from_str_radix(&hex[3..5], 16).ok()? as f64;
        let b = u8::from_str_radix(&hex[5..7], 16).ok()? as f64;
        return Some((0.299 * r + 0.587 * g + 0.114 * b) / 255.0);
    }
    None
}

/// 是否深色填充（画眼珠/黑嘴常用）：$outline / $deep / 深色 hex。$belly/$body/浅色不算。
fn is_dark_fill(fill: &Option<String>) -> bool {
    match fill.as_deref() {
        Some("$outline") | Some("$deep") => true,
        Some(hex) => hex_luma(hex).map(|l| l < 0.5).unwrap_or(false),
        _ => false,
    }
}

fn has_paint_fill(fill: &Option<String>) -> bool {
    matches!(fill.as_deref(), Some(f) if f != "none")
}

/// 从 translate(dx dy) / translate(dx) 取平移量（仅用于卫生检查的粗定位）。
fn parse_translate(t: &str) -> Option<(f64, f64)> {
    let start = t.find("translate(")? + "translate(".len();
    let end = t[start..].find(')')? + start;
    let parts: Vec<f64> = t[start..end]
        .split([',', ' '])
        .filter(|s| !s.is_empty())
        .filter_map(|s| s.parse::<f64>().ok())
        .collect();
    match parts.as_slice() {
        [dx] => Some((*dx, 0.0)),
        [dx, dy, ..] => Some((*dx, *dy)),
        _ => None,
    }
}

/// 扫描文本里的数字，按 (x=偶数位, y=奇数位) 粗估包围盒（path d / polygon points 用）。
fn numbers_bbox(text: &str) -> Option<(f64, f64, f64, f64)> {
    let mut nums: Vec<f64> = Vec::new();
    let mut token = String::new();
    fn flush(t: &mut String, out: &mut Vec<f64>) {
        if let Ok(n) = t.parse::<f64>() {
            out.push(n);
        }
        t.clear();
    }
    for c in text.chars() {
        match c {
            '0'..='9' | '.' => token.push(c),
            '-' => {
                flush(&mut token, &mut nums);
                token.push('-');
            }
            _ => flush(&mut token, &mut nums),
        }
    }
    flush(&mut token, &mut nums);
    if nums.len() < 2 {
        return None;
    }
    let (mut minx, mut maxx, mut miny, mut maxy) = (f64::INFINITY, f64::NEG_INFINITY, f64::INFINITY, f64::NEG_INFINITY);
    for (i, &n) in nums.iter().enumerate() {
        if !n.is_finite() {
            continue;
        }
        if i % 2 == 0 {
            minx = minx.min(n);
            maxx = maxx.max(n);
        } else {
            miny = miny.min(n);
            maxy = maxy.max(n);
        }
    }
    if minx.is_finite() && maxx.is_finite() && miny.is_finite() && maxy.is_finite() {
        Some((minx, miny, maxx, maxy))
    } else {
        None
    }
}

/// 一个节点的粗略局部包围盒。含 rotate/scale 变换时返回 None（不猜，跳过卫生检查，宁放勿误杀）。
fn node_bbox(n: &ShapeNode) -> Option<(f64, f64, f64, f64)> {
    if let Some(t) = &n.transform {
        if t.contains("rotate") || t.contains("scale") {
            return None;
        }
    }
    let base = match n.node_type.as_str() {
        "circle" => {
            let (cx, cy, r) = (n.cx?, n.cy?, n.r?);
            (cx - r, cy - r, cx + r, cy + r)
        }
        "ellipse" => {
            let (cx, cy) = (n.cx?, n.cy?);
            let rx = n.rx.unwrap_or(0.0);
            let ry = n.ry.unwrap_or(0.0);
            (cx - rx, cy - ry, cx + rx, cy + ry)
        }
        "rect" => {
            let (x, y) = (n.x?, n.y?);
            (x, y, x + n.width.unwrap_or(0.0), y + n.height.unwrap_or(0.0))
        }
        "line" => {
            let (x1, y1, x2, y2) = (n.x1?, n.y1?, n.x2?, n.y2?);
            (x1.min(x2), y1.min(y2), x1.max(x2), y1.max(y2))
        }
        "path" => numbers_bbox(n.d.as_deref()?)?,
        "polygon" => numbers_bbox(n.points.as_deref()?)?,
        _ => return None,
    };
    if let Some(t) = &n.transform {
        if let Some((dx, dy)) = parse_translate(t) {
            return Some((base.0 + dx, base.1 + dy, base.2 + dx, base.3 + dy));
        }
    }
    Some(base)
}

/// 在一个视图的 muzzle+head（都以脸心为局部原点）上拦截「画死的眼珠 / 画死的嘴」。
/// eye_centers=引擎眼位；mouth=(x,y,w) 引擎嘴位；mouth_engine=false（beak）时不查嘴。
fn check_face_hygiene(
    v: &RigViewParts,
    eye_centers: &[(f64, f64)],
    eye_r: f64,
    mouth: (f64, f64, f64),
    mouth_engine: bool,
    where_: &str,
) -> Result<(), String> {
    let (mouth_x, mouth_y, mouth_w) = mouth;
    for (name, nodes) in [("muzzle", v.muzzle.as_deref()), ("head", Some(v.head.as_slice()))] {
        let Some(nodes) = nodes else { continue };
        for (i, n) in nodes.iter().enumerate() {
            let Some((minx, miny, maxx, maxy)) = node_bbox(n) else { continue };
            let cx = (minx + maxx) / 2.0;
            let cy = (miny + maxy) / 2.0;
            let size = ((maxx - minx) / 2.0).max((maxy - miny) / 2.0);
            let is_round = matches!(n.node_type.as_str(), "circle" | "ellipse");
            // 眼珠：眼位上的深色小圆（比眼小）。眼罩/黑眼圈是**比眼大**的块 → size 门槛放行。
            if is_round && is_dark_fill(&n.fill) && size < eye_r * 0.95 {
                for &(ex, ey) in eye_centers {
                    if ((cx - ex).powi(2) + (cy - ey).powi(2)).sqrt() < eye_r * 0.7 {
                        return Err(format!(
                            "{where_}.{name}[{i}]：别在眼睛位({ex:.0},{ey:.0})画眼珠——眼睛只由引擎画（会眨眼会变表情，画死就成永不变的死眼）。想要黑眼圈/眼罩就画成比眼更大的浅色或纯描边块。"
                        ));
                    }
                }
            }
            if mouth_engine {
                let in_x = (cx - mouth_x).abs() < mouth_w * 0.6;
                let in_y = (cy - mouth_y).abs() < (eye_r * 0.6).max(6.0);
                if in_x && in_y {
                    // 画死的嘴线/笑脸：横跨嘴位的描边线（无填充）。
                    let stroke_only = n.stroke.is_some() && !has_paint_fill(&n.fill);
                    if matches!(n.node_type.as_str(), "path" | "line")
                        && stroke_only
                        && (maxx - minx) >= (mouth_w * 0.5).max(7.0)
                    {
                        return Err(format!(
                            "{where_}.{name}[{i}]：别在嘴位({mouth_x:.0},{mouth_y:.0})画嘴线/笑脸——嘴由引擎画（会开合/咀嚼），画死会和它重影。若这是硬喙/鸟嘴/长吻，请设 face.mouth=\"beak\" 自绘嘴型，引擎便不再叠嘴。"
                        ));
                    }
                    // 画死的张嘴：嘴位上的深色实心块。须有一定尺寸——真嘴是一块，
                    // 别把嘴边的小鼻孔/小痣（< 4px 或 < 0.3×mouthW）误当嘴（d2 侧脸回归）。
                    let mouth_sized = size >= (mouth_w * 0.3).max(4.0) && size < mouth_w * 1.1;
                    if is_round && is_dark_fill(&n.fill) && mouth_sized {
                        return Err(format!(
                            "{where_}.{name}[{i}]：别在嘴位画一张固定的嘴——嘴由引擎画。硬喙/长吻请设 face.mouth=\"beak\"。"
                        ));
                    }
                }
            }
        }
    }
    Ok(())
}

/// 夹取过宽的引擎嘴：mouthW 上限 = min(24, eyeR*2.4)。真机偶发 34（≈眼距）会画成大裂口。
/// 纯观感夹取、不拒稿；beak 模式不画引擎嘴，夹取也无害。三视图各夹。
fn clamp_face_mouth_w(rig: &mut CustomRig) {
    fn clamp_view(v: &mut RigViewParts) {
        let cap = (v.face.eye_r * 2.4).min(24.0);
        if let Some(w) = v.face.mouth_w {
            if w.is_finite() && w > cap {
                v.face.mouth_w = Some(cap);
            }
        }
    }
    clamp_view(&mut rig.front);
    if let Some(side) = rig.side.as_mut() {
        clamp_view(side);
    }
    if let Some(lie) = rig.lie.as_mut() {
        clamp_view(lie);
    }
}

/// custom rig：校验一个视图（front/side/lie）的全部部件几何 + 脸/摆放/锚点数值。
/// body/head 允许其一为空（一体式脸嵌主体块 / 头即全身），但不许都空。
/// is_side：side 视图用单眼（eyeCx），front/lie 用双眼（eyeDx）——脸卫生按对应眼位查。
fn validate_rig_view(v: &RigViewParts, where_: &str, is_side: bool) -> Result<(), String> {
    let mut total = 0usize;
    total += validate_rig_part(&v.body, &format!("{where_}.body"), false)?;
    total += validate_rig_part(&v.head, &format!("{where_}.head"), false)?;
    if v.body.is_empty() && v.head.is_empty() {
        return Err(format!("{where_}: body 与 head 不能都为空（至少画一个主体块）"));
    }
    if !v.face.eye_r.is_finite() || v.face.eye_r <= 0.0 || v.face.eye_r > 40.0 {
        return Err(format!("{where_}.face.eyeR 需为正数且 ≤40"));
    }
    check_num(v.face.eye_dx, COORD_BOUND, &format!("{where_}.face.eyeDx"))?;
    check_num(v.face.eye_cx, COORD_BOUND, &format!("{where_}.face.eyeCx"))?;
    check_num(v.face.eye_dy, COORD_BOUND, &format!("{where_}.face.eyeDy"))?;
    check_num(v.face.mouth_dx, COORD_BOUND, &format!("{where_}.face.mouthDx"))?;
    check_num(v.face.mouth_dy, COORD_BOUND, &format!("{where_}.face.mouthDy"))?;
    check_num(v.face.mouth_w, COORD_BOUND, &format!("{where_}.face.mouthW"))?;
    if let Some(m) = v.face.mouth.as_deref() {
        if m != "engine" && m != "beak" {
            return Err(format!("{where_}.face.mouth 只能是 \"engine\"（引擎画嘴，默认）或 \"beak\"（自带硬喙/长吻、引擎不叠嘴）"));
        }
    }
    check_num(v.body_y, COORD_BOUND, &format!("{where_}.bodyY"))?;
    check_num(Some(v.head_y), COORD_BOUND, &format!("{where_}.headY"))?;
    check_num(v.head_x, COORD_BOUND, &format!("{where_}.headX"))?;
    check_num(v.arm_y, COORD_BOUND, &format!("{where_}.armY"))?;
    check_num(v.arm_spread, COORD_BOUND, &format!("{where_}.armSpread"))?;
    check_num(v.leg_y, COORD_BOUND, &format!("{where_}.legY"))?;
    check_num(v.leg_spread, COORD_BOUND, &format!("{where_}.legSpread"))?;
    for (part, name) in [
        (&v.muzzle, "muzzle"),
        (&v.belly, "belly"),
        (&v.arm_l, "armL"),
        (&v.arm_r, "armR"),
        (&v.leg_l, "legL"),
        (&v.leg_r, "legR"),
        (&v.tail, "tail"),
        (&v.head_top, "headTop"),
        (&v.decor, "decor"),
    ] {
        if let Some(nodes) = part {
            total += validate_rig_part(nodes, &format!("{where_}.{name}"), false)?;
        }
    }
    for (anchor, name) in [
        (&v.tail_at, "tailAt"),
        (&v.head_top_at, "headTopAt"),
        (&v.tool_at, "toolAt"),
    ] {
        if let Some(a) = anchor {
            check_num(a.x, COORD_BOUND, &format!("{where_}.{name}.x"))?;
            check_num(a.y, COORD_BOUND, &format!("{where_}.{name}.y"))?;
            check_num(a.rot, 360.0, &format!("{where_}.{name}.rot"))?;
        }
    }
    if total > MAX_RIG_VIEW_NODES {
        return Err(format!("{where_} 总节点数需 ≤{MAX_RIG_VIEW_NODES}"));
    }

    // 面部卫生：拦「画死的眼珠 / 画死的嘴」（与引擎会动的眼嘴重影）。引擎眼嘴的
    // 缺省位置须与渲染层（customSpecies.renderRigView）一致，否则拦错区。
    let eye_r = v.face.eye_r;
    let eye_dy = v.face.eye_dy.unwrap_or(0.0);
    let eye_centers: Vec<(f64, f64)> = if is_side {
        vec![(v.face.eye_cx.unwrap_or(eye_r * 1.2), eye_dy)]
    } else {
        let dx = v.face.eye_dx.unwrap_or(16.0);
        vec![(-dx, eye_dy), (dx, eye_dy)]
    };
    let mouth_x = v
        .face
        .mouth_dx
        .unwrap_or(if is_side { eye_r * 1.9 } else { 0.0 });
    let mouth_y = v.face.mouth_dy.unwrap_or(eye_r * 1.7);
    let mouth_w = v.face.mouth_w.unwrap_or(eye_r * 2.2);
    let mouth_engine = v.face.mouth.as_deref() != Some("beak");
    check_face_hygiene(v, &eye_centers, eye_r, (mouth_x, mouth_y, mouth_w), mouth_engine, where_)?;

    Ok(())
}

/// custom rig：front 必填并校验；side/lie 可选（缺省时渲染层用 front 兜底）。
fn validate_custom_rig(rig: &CustomRig) -> Result<(), String> {
    validate_rig_view(&rig.front, "customRig.front", false)?;
    if let Some(side) = &rig.side {
        validate_rig_view(side, "customRig.side", true)?;
    }
    if let Some(lie) = &rig.lie {
        validate_rig_view(lie, "customRig.lie", false)?;
    }
    Ok(())
}

/// 校验一组打工粒子的「联合体 + 自绘下限」契约（`validate_design` 与 UGC 工坊路径共用）：
/// - 每个粒子**有且仅有** `nodes`（1~4 个合法 ShapeNode）或 `ref`（∈ 共享实物粒子目录 id）其一；
/// - **至少 1 个粒子是自绘 `nodes`**（自绘下限：禁止整只全靠 `ref` 复用目录）。
///
/// 数量上下限由各调用点自行把关（本地生成 = 2~3，UGC = ≤3），故空表在此即触发下限错误。
fn validate_work_particles(particles: &[WorkFxParticle]) -> Result<(), String> {
    let ids = work_particle_ids();
    let mut self_drawn = 0usize;
    for (p, particle) in particles.iter().enumerate() {
        match (&particle.nodes, &particle.r#ref) {
            (Some(nodes), None) => {
                if nodes.is_empty() || nodes.len() > 4 {
                    return Err(format!("workFx.particles[{p}] 自绘节点数需 1~4"));
                }
                for (index, node) in nodes.iter().enumerate() {
                    validate_shape_node(node, &format!("workFx[{p}].nodes[{index}]"))?;
                }
                self_drawn += 1;
            }
            (None, Some(id)) => {
                if !ids.contains(id) {
                    return Err(format!(
                        "workFx.particles[{p}] 的 ref \"{id}\" 不在实物粒子目录里"
                    ));
                }
            }
            (Some(_), Some(_)) => {
                return Err(format!(
                    "workFx.particles[{p}] 只能二选一：nodes（自绘）或 ref（复用目录），不能同时给"
                ));
            }
            (None, None) => {
                return Err(format!(
                    "workFx.particles[{p}] 必须给 nodes（自绘）或 ref（复用目录）其一"
                ));
            }
        }
    }
    if self_drawn == 0 {
        return Err("workFx 至少要有 1 个自绘 nodes 粒子（不能整只全靠 ref 复用目录）".to_string());
    }
    Ok(())
}

fn validate_design(raw_json: &str) -> Result<ValidatedDesign, String> {
    let cat = catalog();
    let mut value: serde_json::Value =
        serde_json::from_str(raw_json).map_err(|error| format!("JSON 解析失败：{error}"))?;
    coerce_numeric_strings(&mut value); // 容忍加引号的数字（codex 偶发）
    clamp_cosmetic_ranges(&mut value); // 夹取超范围的描边粗细/透明度（纯观感，不拒稿）
    coerce_points_arrays(&mut value); // 容忍 polygon.points 写成数组（codex 偶发）
    let design: CliDesign =
        serde_json::from_value(value).map_err(|error| format!("JSON 结构不符：{error}"))?;

    // 形态：优先 AI 完全手绘的 custom rig（三视图专属 rig）；缺失才退参数化 chimera form。
    let (rig, form_opt, custom_rig_opt, form_floating) = if let Some(mut rig_data) = design.custom_rig {
        // 原型锚定硬约束：必须先声明"这是照着哪个真实动物/植物设计的"。
        let proto = design.prototype.as_deref().map(str::trim).unwrap_or("");
        if proto.is_empty() || proto.chars().count() > 12 {
            return Err("缺少 prototype（1~12 字的真实动物/植物原型名，如\"水獭\"/\"捕蝇草\"）".to_string());
        }
        // 夹取过宽的引擎嘴（真机偶发 mouthW=34 → 一道大裂口）：纯观感，夹取不拒稿。
        clamp_face_mouth_w(&mut rig_data);
        validate_custom_rig(&rig_data)?;
        let floating = rig_data.floating;
        ("custom".to_string(), None, Some(rig_data), floating)
    } else {
        // 兜底：无 custom rig 时退参数化身体；仍要求选一种动物体型（拒绝 stack 三段圆塔）。
        let form = normalize_form(
            design.form.ok_or_else(|| "缺少 customRig 或 form（身体形态）".to_string())?,
        );
        if !ANIMAL_BODY_PLANS.contains(&form.body_plan.as_str()) {
            return Err(format!(
                "form.bodyPlan 必须是动物体型之一：{}（不要用 stack）",
                ANIMAL_BODY_PLANS.join(" / ")
            ));
        }
        let floating = form.floating;
        ("chimera".to_string(), Some(form), None, floating)
    };

    // 角色专属打工粒子：必填，2~3 种造型，每种 1~4 个节点。
    let work_fx = design
        .work_fx
        .ok_or_else(|| "缺少 workFx（角色专属打工粒子，见 workFx 字段说明）".to_string())?;
    if !(2..=3).contains(&work_fx.particles.len()) {
        return Err("workFx.particles 需为 2~3 个粒子造型".to_string());
    }
    // 联合体校验 + 自绘下限：每个粒子 nodes/ref 二选一，且至少 1 个自绘（见 validate_work_particles）。
    validate_work_particles(&work_fx.particles)?;

    let palette = design.palette.ok_or_else(|| "缺少 palette".to_string())?;
    for (key, value) in [
        ("body", &palette.body),
        ("deep", &palette.deep),
        ("belly", &palette.belly),
        ("accent", &palette.accent),
    ] {
        if !is_hex_color(value) {
            return Err(format!("palette.{key} 需为 #rrggbb"));
        }
    }
    if let Some(accent2) = &palette.accent2 {
        if !is_hex_color(accent2) {
            return Err("palette.accent2 需为 #rrggbb".to_string());
        }
    }

    if let Some(eyes) = &design.eyes {
        if !cat.eyes.iter().any(|e| e == eyes) {
            return Err(format!("eyes 必须是 {} 之一", cat.eyes.join("/")));
        }
    }
    // 打工工具必填：粒子=工具产物，没有工具就没有产物可画。
    let tool_id = design
        .tool_id
        .as_ref()
        .ok_or_else(|| "缺少 toolId（打工工具，从工具目录选一件）".to_string())?;
    if !cat.tools.contains_key(tool_id) {
        return Err(format!("toolId 不在工具目录里：{tool_id}"));
    }

    let mut slots: BTreeMap<String, SlotSpec> = BTreeMap::new();
    for (slot_name, value) in design.slots {
        let Some(slot_parts) = cat.slots.get(&slot_name) else {
            let names: Vec<&str> = cat.slots.keys().map(String::as_str).collect();
            return Err(format!("未知槽位 {slot_name}（可用：{}）", names.join("/")));
        };
        match &value {
            SlotSpec::PartId(id) => {
                if !slot_parts.contains_key(id) {
                    return Err(format!("槽位 {slot_name} 没有部件 {id}"));
                }
            }
            SlotSpec::Custom(part) => {
                if part.kind != "custom" {
                    return Err(format!("槽位 {slot_name} 的 kind 必须是 \"custom\""));
                }
                if part.nodes.is_empty() || part.nodes.len() > MAX_CUSTOM_NODES {
                    return Err(format!("槽位 {slot_name} 自定义节点数需 1~{MAX_CUSTOM_NODES}"));
                }
                for (index, node) in part.nodes.iter().enumerate() {
                    validate_shape_node(node, &format!("{slot_name}.nodes[{index}]"))?;
                }
            }
        }
        slots.insert(slot_name, value);
    }
    if slots.len() > MAX_SLOTS {
        return Err(format!("槽位总数需 ≤{MAX_SLOTS}（简单第一）"));
    }

    let name_zh = design.name_zh.unwrap_or_default().trim().to_string();
    let name_len = name_zh.chars().count();
    if !(2..=6).contains(&name_len) || !has_cjk(&name_zh) {
        return Err("nameZh 需为 2~6 个字的中文名".to_string());
    }
    // 拒绝叠字（相邻重复字，如 咕咕 / 泡泡 / 焊焊），逼 AI 起更有辨识度的名字。
    let name_chars: Vec<char> = name_zh.chars().collect();
    if name_chars.windows(2).any(|w| w[0] == w[1]) {
        return Err("nameZh 不要用叠字（相邻重复字，如 焊焊/泡泡），换一个更独特的名字".to_string());
    }
    // 英文名/英文设定（默认语言=英文）：模型给了且合法就用；缺失/非法**不整只拒稿**
    // （避免徒增重试/兜底鸭），留空由 commit_design 按元素本地兜底推导，保证总有英文名。
    let name_en = sanitize_en_name(&design.name_en.unwrap_or_default()).unwrap_or_default();

    let desc_raw = design.desc.unwrap_or_default().trim().to_string();
    if desc_raw.is_empty() {
        return Err("缺少 desc（一句中文设定）".to_string());
    }
    let desc: String = desc_raw.chars().take(60).collect();

    let desc_en: String = design
        .desc_en
        .unwrap_or_default()
        .trim()
        .chars()
        .take(160)
        .collect();

    let scale = design
        .scale
        .filter(|s| s.is_finite())
        .unwrap_or(1.12)
        .clamp(SCALE_MIN, SCALE_MAX);

    Ok(ValidatedDesign {
        codename_hint: design.codename,
        name_zh,
        name_en,
        desc,
        desc_en,
        prototype: design.prototype,
        visual: CustomVisualSpec {
            floating: form_floating,
            rig,
            scale,
            palette,
            eyes: design.eyes,
            tool_id: design.tool_id,
            slots,
            form: form_opt,
            custom_rig: custom_rig_opt,
            work_fx: Some(work_fx),
        },
    })
}

// ---------------------------------------------------------------------------
// 提示词
// ---------------------------------------------------------------------------

/// 体型原型菜单（按蛋轮转注入 prompt，强制体型多样、避免每只都圆头圆身）。
/// (标签, 形态描述, 构造提示)。构造提示教模型**怎么搭**——哪些体型该用
/// 一体式（脸嵌主体块）/ 头即全身，逼出与"两球分体"截然不同的剪影拓扑。
const BODY_ARCHETYPES: [(&str, &str, &str); 12] = [
    (
        "四足兽",
        "横向的长身体架在四条腿上、头在身体前方",
        "分体式：body 画横向胶囊/豆形，head 在前上方；legL/legR 是前腿（会迈步），后腿直接画进 body。原型候选：狐/鹿/水豚/羊驼/奶牛/小猪/浣熊",
    ),
    (
        "长颈型",
        "小头 + 长弯颈 + 圆身子，比例夸张",
        "分体式+极端比例：长弯颈画进 body 形状（一条粗曲线从身体伸向高处），headY 抬到 85~110、head 画小（半径 ≤22）；腿可细长如高跷。原型候选：火烈鸟/天鹅/长颈鹿/蛇颈龙/鹤",
    ),
    (
        "带壳背甲",
        "背上驮着厚重外壳或硬甲、四肢短小",
        "分体式：body 主形 = 大壳（半圆拱/螺旋，壳纹画足），head 从壳前下方探出、比壳小得多，四肢短小。原型候选：乌龟/蜗牛/寄居蟹/犰狳/瓢虫",
    ),
    (
        "飞鸟带翼",
        "有喙、身体两侧张开明显的翅膀",
        "分体式：armL/armR 画成大翅膀（剪影主角），head 带尖喙（喙画进 muzzle）；翅展要宽。原型候选：猫头鹰/蜂鸟/鹦鹉/蝙蝠/信鸽",
    ),
    (
        "蛇形长条",
        "细长身体贴地盘绕、少腿或无腿",
        "一体式：整条 S 形粗带子画进 body（可盘卷、首端翘起），head 留空数组 []，headX/headY 指到带子前端，脸直接嵌在那里。原型候选：东方龙/鳗鱼/毛虫/海马/黄鳝",
    ),
    (
        "多足虫",
        "横向长身下面一排小短腿",
        "一体式横长分节 body（或矮拱壳）；legL/legR 放最前一对腿，其余几对小腿直接画进 body 底缘。原型候选：蜈蚣/毛毛虫/鼠妇/蚕宝宝",
    ),
    (
        "高瘦直立",
        "竖直细长的两脚立姿",
        "分体式：body 画瘦高（宽不超过高的一半）、headY 抬高，整体窄长剪影；腿可细长。原型候选：企鹅/鼬/狐獴/竹子/仙人掌",
    ),
    (
        "矮胖宽扁",
        "宽明显大于高、贴地的大墩子",
        "一体式：整只 = 一个宽扁大馒头或上尖下宽的三角锥画进 body（海象那种锥体最好），head 留空数组 []，headX/headY 指到体块上部、脸直接嵌上去。原型候选：海象/河马/蟾蜍/土豆/蘑菇墩",
    ),
    (
        "长吻尖嘴",
        "头上拖着突出的长口鼻或尖吻",
        "分体式：head 别画圆——画成带长吻的形状（水滴形/鳄头，吻部细节画进 muzzle），眼睛在吻根上方；长吻是剪影主角。原型候选：食蚁兽/鳄鱼/大象/天狗/啄木鸟",
    ),
    (
        "漂浮带鳍",
        "离地漂浮、无腿、带鳍或触手",
        "一体式：整只 = 一个大球/伞盖/菱形画进 body，head 留空数组 []、脸直接嵌在主体块上；armL/armR 画成侧鳍或触手；customRig.floating=true。原型候选：水母/灯笼鱼/魟鱼/热气球/蒲公英种子",
    ),
    (
        "双足猛兽",
        "粗壮后腿站立 + 小前肢 + 大尾巴平衡",
        "分体式：body 前倾、legL/legR 画粗壮，tail 画大（剪影的重要部分），armL/armR 是小短手。原型候选：霸王龙/袋鼠/跳鼠/公鸡",
    ),
    (
        "大附肢型",
        "一处夸张的大附肢主导剪影：大盘/大伞/大螯/大耳",
        "头即全身也行：把大盘/大花/大伞画进 head（head 就是主角、脸嵌盘中央），body 只画一根细梗或小底座；或 body 正常但某一附肢夸张大。原型候选：向日葵/捕蝇草/招潮蟹/大耳狐/孔雀",
    ),
];

fn hash_seed(s: &str) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    s.hash(&mut hasher);
    hasher.finish()
}

struct PromptInputs {
    parent_a: (String, SpeciesInfo),
    parent_b: (String, SpeciesInfo),
    taken: BTreeSet<String>,
    /// 体型轮转种子（取自 egg_id 哈希）；同一颗蛋的重试一致、不同蛋各异。
    seed: u64,
}

fn describe_parent(cat: &FusionCatalog, codename: &str, info: &SpeciesInfo, label: &str) -> String {
    let signatures = cat
        .species_signatures
        .get(codename)
        .map(|parts| parts.join(", "))
        .unwrap_or_else(|| "无".to_string());
    format!(
        "{label}: {codename}「{}」 — 元素 {} — 代表色 {} — 标志性部件: {} — 设定：{}",
        info.name_zh,
        info.elements.join("+"),
        info.colors.join(" "),
        signatures,
        info.desc,
    )
}

fn build_prompt(inputs: &PromptInputs, feedback: Option<&str>) -> String {
    let cat = catalog();
    let mut p = String::with_capacity(8192);

    p.push_str("你是桌宠游戏《Gulugulu》的怪物设计师。任务：把两只一阶宠物融合成一只**全新的、外形与双亲完全不同的**二阶新物种。\n\n");
    p.push_str("【硬性输出契约】只输出一个 JSON 对象。不要 markdown 代码围栏，不要任何解释文字，不要使用工具。\n\n");

    p.push_str("【最重要的设计原则】你要**亲手把这只新生物的每个部件画成矢量数据**，做出一只崭新、可爱、一眼认得出\"这是某种真实动物/植物\"的二阶物种：\n");
    p.push_str("- **先锚定一个真实原型（最重要！）**：从体型指令的原型候选里选一个真实存在的动物或植物（也可选同类的其它真实物种），写进 prototype 字段；然后照着它的标志性特征作画——路人看一眼就能说出\"这是一只 XX\"。**禁止无原型的抽象团子/几何拼块**。\n");
    p.push_str("- **剪影和双亲、和固有 6 底座（鸭/狐/鼠/鲸/菇/雪怪）差异尽可能大**：大胆换一种形体（龟壳/长颈/多足/带翼/球形/尖吻…皆可），别只是把父代重新上色。\n");
    p.push_str("- 只从每个父代**各保留一点点**线索（一个主色调，或一种元素气质 火/冰/电…）。\n");
    p.push_str("- **元素越多越华丽越高阶**：这只有几种元素就配几分盛装——元素多则多加冠冕/宝石/环绕件等 decor 装饰、部件更繁复；单元素则朴素。\n");
    p.push('\n');

    // 设计基因（吉祥物级魅力）：把「可爱 + 有性格 + 一眼记住」拆成宝可梦/数码宝贝/日系萌宠
    // 三家看家本领，作为审美北极星贯穿全设计——这是本次改版专治"团子化、没特色"的核心。
    p.push_str("【设计基因 = 宝可梦 × 数码宝贝 × 日系治愈萌宠（吉祥物级魅力，务必吃透，这是评分的灵魂）】\n");
    p.push_str("你不是在拼一个抽象小怪，而是在设计一只**能印上周边、被人一眼爱上并记住**的吉祥物。三条铁律：\n");
    p.push_str("- **① 宝可梦式「一个招牌绝活」（最能出彩）**：每只必须有**一个一眼记住、就是它本体**的英雄特征来承载属性——学皮卡丘的电颊+闪电尾、小火龙的尾焰、杰尼龟的卷尾、妙蛙的背芽。**先把最主要的元素浓缩进这一个招牌**（火→尾焰/鬃火/焰纹眉、电→鼓鼓电颊/放电尖耳/锯齿闪电尾、冰→背脊冰晶/垂冰须/呵白气、草→头顶卷芽/叶片尾/花苞领、水→透明水膜鳍/水珠鬃/腮边气泡）；剪影抹成纯黑也要能读出「这是只 XX、玩 XX 属性」。多元素时**再**在招牌之外叠 decor 撑华丽，但别把元素碎成满身小贴纸、削弱主招牌。\n");
    p.push_str("- **② 数码宝贝式「穿戴感 / 个性件」**：给它一件像**装备/穿戴**、长在身上的标志物，带点角色态度——加布兽的兽皮尖角、巴达兽的翼耳、单边大螯、护额、披风、肩甲、尾环、颈铃、独角那种（放 headTop / decor / 或某一夸张附肢）。个性件让它从\"可爱团子\"升级成\"有来头的角色\"，是辨识度的第二支点。\n");
    p.push_str("- **③ 日系治愈萌宠式「幼态萌脸 + 明确性格」**：圆滚滚 2~2.5 头身、短粗四肢、大脑袋(kemono/吉卜力/三丽鸥那种憨态)；脸走 kawaii 语法——眼往大取(eyeR 抬高)、配腮红/脸斑、五官小巧。先给它定**一句人设**（例\"胆小爱躲的火狐苗\"\"高冷冰晶鹤\"\"贪吃的草团鼠\"\"傲娇雷小兽\"），让招牌、配色、表情(eyes 选 round/happy/sleepy)、姿态都为这句人设服务。**软萌**(大眼圆脸腮红)或**酷帅**(小锐眼+浓眉+个性件)选一条走到底，别做成没脾气的中庸圆球。\n");
    p.push('\n');

    // 体型指令（按蛋轮转）：强制这一只走某个具体的动物体型 + 给出构造搭法，
    // 避免每只都退化成"圆头 + 圆身"两球默认形。
    let (arch_label, arch_desc, arch_build) =
        BODY_ARCHETYPES[(inputs.seed as usize) % BODY_ARCHETYPES.len()];
    p.push_str(&format!(
        "- **【本次体型 = {arch_label}，务必照做】**：{arch_desc}。构造搭法：{arch_build}。从原型候选里挑一个（或同类其它真实物种）填进 prototype，全身按它的特征刻画。**严禁退回\"圆头 + 圆身\"的两球默认形**——剪影必须一眼属于「{arch_label}」且认得出原型。仍要可爱、并揉进双亲元素气质；若与双亲气质实在冲突，可换同类目其它真实原型，但同样不许是两球形。\n"
    ));
    for line in &cat.style_red_lines {
        p.push_str("- ");
        p.push_str(line);
        p.push('\n');
    }
    p.push('\n');

    p.push_str("【可爱与可读性硬规则】玩家隔着小窗口看宠物，脸就是一切：头要**大、占比高**（头形随原型走：可带长吻/尖喙/扁嘴/菌帽，不必是正圆），脸部饱满、眼睛清晰可读；整体圆润胖乎的幼态比例。头太小会被拒。\n\n");

    p.push_str("【身体 = 手绘三视图 rig（customRig，核心）】画布 256×256、地面 y=233、水平中心 x=128。输出一个 customRig 对象，含三个视图：**front（正面站立，必画）/ side（朝右侧面，移动用）/ lie（趴卧睡姿）**，三视图都要画。\n");
    p.push_str("每个视图把生物拆成若干**部件**，**每个部件在自己的局部坐标系作画**（(0,0)=该部件锚点）；引擎负责摆放+支点+驱动 14 态动画（你不用管动画）。视图字段：\n");
    p.push_str("- body：主体块形状，局部(0,0) 摆到 (128, bodyY 默认190)；在 x∈[-72,72]、y∈[-74,48] 内作画。**不必是圆/椭圆**——三角锥、山丘、S 形带子、花梗、分节虫身都行。\n");
    p.push_str("- head：头部形状（可以是空数组！见下方构造模式），局部(0,0)=脸中心，摆到 (headX 默认128, headY)。\n");
    p.push_str("**三种构造模式（按体型指令选，别默认分体式）**：\n");
    p.push_str("① 分体式：head 和 body 各画各的（经典头+身动物）。\n");
    p.push_str("② 一体式：整只就是一个大块（球/锥/山丘/长条）——全部画进 body，head 给空数组 []，headX/headY 直接指到主体块上\"脸\"的位置，脸就嵌在体块上（灯笼鱼/海象/史莱姆都是这种）。一体式体块大，脸也要相应放大：eyeR 取 10~13、嘴宽约 1.6~2×eyeR，并在脸周围画一块浅色（$belly）脸斑衬托表情。\n");
    p.push_str("③ 头即全身：巨大的头本身就是整只生物——主形画进 head，body 给空数组 [] 或只画一根细梗/小底座（向日葵盘/气球怪/蘑菇伞那种）。\n");
    p.push_str("body 与 head 不许都为空。脸的位置永远由 headX/headY 决定，与 head 里有没有形状无关。\n");
    p.push_str("- face：{eyeR 眼半径, eyeDx 双眼各偏移(front/lie用), eyeCx 单眼偏移(side用), eyeDy, mouthDx(side嘴前移), mouthDy, mouthW, mouth}。**引擎会在这些位置画一套随动作变化的眼和嘴**（眨眼/开心/用力/星星眼/咀嚼/蚊香眼/闭眼…），你只负责给尺寸和位置。**整张脸的表情核心（一双眼 + 一张嘴）永远归引擎；你只画它周围的点缀。**\n");
    p.push_str("  · **眼睛 100% 归引擎**：head/muzzle/decor 任何图层都**绝不能画眼珠/瞳孔/一双固定的眼**——会和会动的引擎眼重影错位（用户实测过：脸上多出一双不动的眼）。想要黑眼圈/眼罩/眼影，就画一块**比眼睛更大**的浅色或纯描边斑，让引擎的眼叠在它中间；**绝不是眼位上的深色小圆**。\n");
    p.push_str("  · **嘴二选一，别双嘴**：① 默认（mouth 省略或 =\"engine\"）= 软嘴物种，嘴整个交给引擎——你**在任何图层都别画嘴/嘴缝/笑脸/牙**；muzzle 顶多画鼻子。② mouth=\"beak\" = 硬喙/鸟嘴/尖长吻这类自带嘴型的物种，你在 muzzle/head 亲手画那只喙/吻当嘴，引擎就**不再叠嘴**（仍画会动的眼）。画了静态喙却不设 beak = 喙 + 引擎嘴的双嘴，判差。\n");
    p.push_str("  · 记住引擎眼在 (headX±eyeDx, headY+eyeDy)、软嘴在 (headX+mouthDx, headY+mouthDy) 宽 mouthW——**你画的所有五官轮廓都要避开这两处**（只有 beak 模式才故意把喙落在嘴位）。\n");
    p.push_str("- muzzle：**面部点缀层（脸的个性来源；与眼嘴同一图层、随表情一起动）**，局部(0,0)=脸中心(headX,headY)，画在 head 之上、引擎眼嘴之下。**只画『眼与嘴之外』的五官**：鼻梁/鼻头、鼻孔（眼下嘴上的一两个小点）、脸颊/腮红、胡须、眉毛（画在眼**上方**、别压到眼上）、獠牙、下颌纹。**不画眼珠、不画嘴/嘴缝/笑脸/牙**（这两样引擎画会动的版本）——唯一例外是 mouth=\"beak\" 时在这里画喙/吻当嘴。正视图 muzzle 要**左右对称、朝正前**（喙朝正下方，不是朝侧伸的侧喙）。\n");
    p.push_str("  · **凡是『贴在脸上』的点缀都画进 muzzle**（腮红/面颊红点、眉心与额头的小印记/小宝石、脸颊斑纹、胡须、眉毛）——muzzle 跟眼嘴同组，会一起做眨眼/咀嚼/点头等表情动作，整张脸才是一个会一起动的整体。**别把这些丢进 decor**（decor 不随脸动，静止的鼻嘴腮红配上会动的眼睛=脸像贴片、判差）。\n");
    p.push_str("- eyes：基础眼型，默认 **\"round\"（可爱大圆眼，待机就靠它）**；happy=眯眼笑、sleepy=困眼会让待机变成笑脸/睡脸，除非物种性格确实如此，否则一律用 round。\n");
    p.push_str("- **脸型多样化**：眼睛大小/间距/高度随原型大胆变化——猛禽小珠眼 eyeR 7~8 配浓眉、萌兽大圆眼 12~14、锥体一体式眼距拉宽；mouthDy 随吻长调整（长吻嘴更低），软嘴 mouthW 约 1.4~2×eyeR（别宽成一道裂口，>24 会被夹回）。别只会一种默认脸。\n");
    p.push_str("- belly：肚皮浅色补丁（可选），局部(0,0) 摆到躯干锚点。\n");
    p.push_str("- armL/armR：手/翅（可选），局部(0,0)=肩点，摆到 (128∓armSpread, armY)；引擎会挥动。**对称物种只画 armL、省略 armR，引擎自动镜像到右侧**；不对称（如一只大螯）才两侧都画。\n");
    p.push_str("- legL/legR：腿/脚（可选），局部(0,0)=髋点、脚底朝 +y，摆到 (128∓legSpread, legY)；引擎会迈步。**同样：对称只画 legL，右腿自动镜像**。\n");
    p.push_str("- tail：尾（可选），局部(0,0)=尾根，摆到 tailAt={x,y,rot}；引擎会摆动。\n");
    p.push_str("- headTop：头顶饰/耳（可选），局部(0,0)=头顶中点、向上作画(-y)，摆到 headTopAt={x,y}。\n");
    p.push_str("- decor：**不贴脸的华丽装饰**（头顶冠冕、身周环绕件/光环、背甲/壳上宝石、脚下座台，用**绝对坐标**画在最上层）；元素越多画越多，撑起高阶感。decor 独立于脸、**不随表情移动**——所以**贴脸的装饰（额头/眉心印记、脸颊纹样、腮红）一律放 muzzle**，别放这里。\n");
    p.push_str("- toolAt：{x,y} 打工工具落点（缺省右脚边 190,233）。\n");
    p.push_str("体型实现提示：四足/多足把**最前一对**腿放 legL/legR（会迈步），其余腿画进 body（静态即可）；长颈/长吻把脖子/长口鼻画进 head 或 body 的形状里（headY 抬高即成长颈）；漂浮型设 customRig.floating=true（离地+小影子，通常无腿）。\n");
    p.push_str("**三视图是同一只生物的三个不同朝向，务必分清（这是最容易画错的地方）：**\n");
    p.push_str("- **front 正视图 = 正对镜头的正脸，左右对称**：喙/吻/鼻一律朝**正前下方**、居中对称（像正对你的鸭子，扁嘴朝下）；**绝不能在正脸上画一根朝侧面伸的长嘴/侧喙**——那是侧视图的画法。双眼用 face.eyeDx；两手两脚左右对称（对称件只画左侧、右侧引擎自动镜像）。\n");
    p.push_str("- **side 侧视图 = 朝右的纯侧脸剖面**：整只向右转 90°，只画这一面看得到的东西——头向右前探（headX 挪到 ~150）、喙/吻朝右伸出、**单眼**（用 face.eyeCx，别用 eyeDx）、**近侧只有一只手（放进 armR，千万别再给 armL，否则同一侧会冒出两只手）**、前后腿错开。左移由引擎自动镜像，你只需画朝右这一版。**严禁把正视图原样平移当侧面。**\n");
    p.push_str("- **lie 睡姿 = 合理趴卧**：身体低伏贴地、头搁在身前的蜷卧构图，**绝不是把站姿压扁**。\n");
    p.push_str("部件几何用 ShapeNode：{\"type\":\"path|circle|ellipse|rect|polygon|line\", ...几何, \"fill\":色,\"stroke\":色,\"strokeWidth\":数,\"opacity\":数}。path 的 d 只用 M/L/C/Q/A/Z（含小写）+ 数字；平涂卡通、统一深棕描边 $outline（主形 5~6、中件 3~4、细节 2~3）；颜色只能是调色板 token（$body/$deep/$belly/$accent/$accent2/$outline）或 #rrggbb；坐标 |n|≤300；每部件 ≤24 节点、单视图合计 ≤170 节点。头脸务必大而圆。\n\n");

    p.push_str("【调色板 palette】body=身体主色 deep=阴影/深部 belly=肚皮/脸浅色 accent=第二主色 accent2=第三色(可选)。全部 #rrggbb。\n");
    p.push_str("- **主体必须 2~3 色分区，禁止单色调**：把 accent/accent2 当作**大面积的第二、第三主色**用在身体分区上——双色上下身/背腹异色/条纹/大斑块/帽壳与身异色（参考：企鹅黑白肚、蜜蜂黄黑纹、舞狮红金白）；不是只点一两个小装饰。节点 fill 也可直接写其它 #rrggbb 补色。整只一个颜色 = 不合格。\n");
    p.push_str("- **配色要有对比、别灰扑扑**：body 用饱和度够的主色，belly/脸用明显更浅的浅色兜住表情；深浅冷暖拉开层次。\n");
    p.push_str("双亲元素的锚定色参考（挑一两个揉进去即可，不必全用）：\n");
    let mut hint_elements: Vec<&str> = Vec::new();
    for element in inputs
        .parent_a
        .1
        .elements
        .iter()
        .chain(inputs.parent_b.1.elements.iter())
    {
        if !hint_elements.contains(&element.as_str()) {
            hint_elements.push(element);
        }
    }
    for element in &hint_elements {
        if let Some(hint) = cat.element_hints.get(*element) {
            p.push_str(&format!("- {element}: {}\n", hint.colors.join(" ")));
        }
    }
    p.push('\n');

    p.push_str("（不用槽位/部件目录——所有部件、尾巴、耳冠、装饰都由你在 customRig 里亲手画。）\n\n");

    p.push_str("【工具目录 toolId（必填）】给这只角色选一件最贴合其职业气质的打工工具（打工时握在手里）。每件后面标了它「喷出的产物」——下一段的粒子就要画这些：\n");
    for (id, name) in &cat.tools {
        let hint = cat.tool_fx_hints.get(id).map(String::as_str).unwrap_or("");
        if hint.is_empty() {
            p.push_str(&format!("- {id}（{name}）\n"));
        } else {
            p.push_str(&format!("- {id}（{name}）→ 产物：{hint}\n"));
        }
    }
    p.push('\n');

    p.push_str("【打工特效 workFx（必填）】点击打工时，粒子会从手中工具喷向全屏飘散——它们是这只角色「干活干出来的实物产出」。\n");
    p.push_str("**每个粒子都必须是具体、真实世界、看得见摸得着的小东西**（你所选 toolId 工具的产物/该职业的产出，见工具标注的「产物」）；越具体、越有梗、越搞笑越好，欢迎玩职业梗/网络梗。\n");
    p.push_str("🚫 严禁抽象元素粒子：火花 / 火星 / 雷电 / 电花 / 冰晶 / 雪花 / 蒸汽 / 水汽 / 星尘 / 星芒 / 极光 / 彩虹 之类一律不要——要画『咖啡杯 / 齿轮 / 快递箱 / bug 虫子 / 代码符号牌』这种实物。\n");
    p.push_str("共设计 2~3 个粒子，每个粒子**二选一**：\n");
    p.push_str("  · 自绘：{\"nodes\":[ ...ShapeNode... ]} —— 你亲手画的一个 ~16px 小实物；\n");
    p.push_str("  · 复用：{\"ref\":\"<id>\"} —— 直接引用下面「现成实物粒子目录」里的一个 id（前端已内置画好，你不用画）。\n");
    p.push_str("规则：可从目录挑 1~2 个填 ref 复用；**但至少要自绘 1 个这只角色专属的新粒子填 nodes**（不能整只全靠 ref）；总数 2~3 个。\n");
    p.push_str("现成实物粒子目录（ref 可选值，按主题：食物饮品 / 工具器物 / 自然 / 梗图文字 排列）：\n");
    // 目录来自 fusionParts.json 的 workParticles（按主题排序），单一事实源 → 提示词菜单 = 校验白名单。
    for w in &cat.work_particles {
        p.push_str(&format!("- {}（{}）\n", w.id, w.hint));
    }
    p.push_str("自绘 nodes 的粒子：画在以 (0,0) 为中心、±14 的局部坐标内，1~4 个节点；节点格式同自定义部件（type/几何/fill/stroke/strokeWidth）；用实物的固有色（咖啡=棕、纸=白、齿轮=铁灰、叶=绿、bug=褐绿…别用宠物体色），必须描边（1.8~2.6）。\n\n");

    p.push_str("【双亲资料（只作灵感，勿照抄部件）】\n");
    p.push_str(&describe_parent(cat, &inputs.parent_a.0, &inputs.parent_a.1, "A"));
    p.push('\n');
    p.push_str(&describe_parent(cat, &inputs.parent_b.0, &inputs.parent_b.1, "B"));
    p.push_str("\n\n");

    p.push_str("【命名与设定（中英双语，两者都必填）】\n");
    p.push_str("- nameEn：**英文名（游戏默认语言，务必用心起）**——简短专有名，1~2 个词、TitleCase、有画面感、好念（例：Frostfox / Ember Otter / Thunderquill / Lumipetal）；别直译中文名，别用元素词+动物的懒名。\n");
    p.push_str("- nameZh：2~5 个汉字的中文名，要独特、有辨识度、带点巧思（例：焰霜狸 / 雷角兽 / 温泉猴 / 醒狮 / 琉璃蜓）\n");
    p.push_str("  · 严禁叠字（相邻重复字，如 咕咕 / 泡泡 / 焊焊）；也别用「元素字+动物」的懒名。结合它的元素、职业气质或小怪癖，起个让人会心一笑的名字。\n");
    p.push_str("- descEn：**英文设定**，一句 ≤22 词，带一个可爱的小怪癖（与中文同调性、非逐字直译）。\n");
    p.push_str("- desc：一句 ≤40 字的中文设定，带一个可爱的小怪癖\n");
    p.push_str("- codename：小写英文，格式 [a-z][a-z0-9]{2,15}，不能与已占用的重复：");
    let taken: Vec<&str> = inputs.taken.iter().map(String::as_str).collect();
    p.push_str(&taken.join(", "));
    p.push_str("\n\n");

    p.push_str("【输出 JSON 格式（示例，一只圆头小鸟；照此结构画你自己的物种，别照抄形状）】\n");
    p.push_str("{\"codename\":\"chimewren\",\"nameEn\":\"Chimewren\",\"nameZh\":\"铃雀\",\"prototype\":\"山雀\",\"descEn\":\"Hums the wind into little tunes; when happy, the bell on its head jingles.\",\"desc\":\"总把风声哼成小调，开心时头顶铃铛叮当响\",\"scale\":1.12,\"palette\":{\"body\":\"#7FB8E6\",\"deep\":\"#4F8FC9\",\"belly\":\"#F3FAFF\",\"accent\":\"#FFC24A\",\"accent2\":\"#E86A8E\"},\"eyes\":\"round\",\"toolId\":\"headset\",\"customRig\":{\"front\":{\"bodyY\":190,\"body\":[{\"type\":\"ellipse\",\"cx\":0,\"cy\":0,\"rx\":46,\"ry\":44,\"fill\":\"$body\",\"stroke\":\"$outline\",\"strokeWidth\":6}],\"belly\":[{\"type\":\"ellipse\",\"cx\":0,\"cy\":12,\"rx\":24,\"ry\":24,\"fill\":\"$belly\",\"opacity\":0.9}],\"headY\":126,\"head\":[{\"type\":\"circle\",\"cx\":0,\"cy\":0,\"r\":40,\"fill\":\"$body\",\"stroke\":\"$outline\",\"strokeWidth\":6}],\"face\":{\"eyeR\":11,\"eyeDx\":15,\"eyeDy\":-2,\"mouth\":\"beak\"},\"muzzle\":[{\"type\":\"path\",\"d\":\"M-8 10 Q0 6 8 10 L0 21 Z\",\"fill\":\"$accent\",\"stroke\":\"$outline\",\"strokeWidth\":3.5},{\"type\":\"ellipse\",\"cx\":-22,\"cy\":13,\"rx\":5,\"ry\":3.5,\"fill\":\"#F5A8B8\",\"opacity\":0.8},{\"type\":\"ellipse\",\"cx\":22,\"cy\":13,\"rx\":5,\"ry\":3.5,\"fill\":\"#F5A8B8\",\"opacity\":0.8}],\"armY\":182,\"armSpread\":46,\"armL\":[{\"type\":\"path\",\"d\":\"M0 0 q-13 4 -12 20 q6 6 12 1 q3 -11 0 -21 z\",\"fill\":\"$accent2\",\"stroke\":\"$outline\",\"strokeWidth\":5}],\"armR\":[{\"type\":\"path\",\"d\":\"M0 0 q-13 4 -12 20 q6 6 12 1 q3 -11 0 -21 z\",\"fill\":\"$accent2\",\"stroke\":\"$outline\",\"strokeWidth\":5}],\"legY\":222,\"legSpread\":16,\"legL\":[{\"type\":\"ellipse\",\"cx\":0,\"cy\":2,\"rx\":9,\"ry\":5,\"fill\":\"$deep\",\"stroke\":\"$outline\",\"strokeWidth\":4}],\"legR\":[{\"type\":\"ellipse\",\"cx\":0,\"cy\":2,\"rx\":9,\"ry\":5,\"fill\":\"$deep\",\"stroke\":\"$outline\",\"strokeWidth\":4}],\"headTop\":[{\"type\":\"path\",\"d\":\"M-11 6 L-3 -18 L3 -18 L11 6 Z\",\"fill\":\"$accent\",\"stroke\":\"$outline\",\"strokeWidth\":4}],\"tailAt\":{\"x\":86,\"y\":200,\"rot\":-14},\"tail\":[{\"type\":\"path\",\"d\":\"M0 0 q-11 3 -12 12 q11 1 14 -8 z\",\"fill\":\"$deep\",\"stroke\":\"$outline\",\"strokeWidth\":3}],\"decor\":[{\"type\":\"circle\",\"cx\":128,\"cy\":98,\"r\":5,\"fill\":\"$accent2\",\"stroke\":\"$outline\",\"strokeWidth\":2}]},\"side\":{\"bodyY\":190,\"headX\":150,\"body\":[{\"type\":\"ellipse\",\"cx\":0,\"cy\":0,\"rx\":48,\"ry\":42,\"fill\":\"$body\",\"stroke\":\"$outline\",\"strokeWidth\":6}],\"belly\":[{\"type\":\"ellipse\",\"cx\":6,\"cy\":14,\"rx\":20,\"ry\":20,\"fill\":\"$belly\",\"opacity\":0.9}],\"headY\":128,\"head\":[{\"type\":\"circle\",\"cx\":0,\"cy\":0,\"r\":36,\"fill\":\"$body\",\"stroke\":\"$outline\",\"strokeWidth\":6},{\"type\":\"path\",\"d\":\"M28 4 L44 8 L28 12 Z\",\"fill\":\"$accent\",\"stroke\":\"$outline\",\"strokeWidth\":3}],\"face\":{\"eyeR\":10,\"eyeCx\":8,\"eyeDy\":-3,\"mouth\":\"beak\"},\"legY\":222,\"legSpread\":24,\"legL\":[{\"type\":\"ellipse\",\"cx\":0,\"cy\":2,\"rx\":9,\"ry\":5,\"fill\":\"$deep\",\"stroke\":\"$outline\",\"strokeWidth\":4}],\"legR\":[{\"type\":\"ellipse\",\"cx\":0,\"cy\":2,\"rx\":9,\"ry\":5,\"fill\":\"$deep\",\"stroke\":\"$outline\",\"strokeWidth\":4}],\"armY\":184,\"armSpread\":10,\"armR\":[{\"type\":\"path\",\"d\":\"M0 0 q16 3 15 20 q-6 6 -14 1 q-3 -12 -1 -21 z\",\"fill\":\"$deep\",\"stroke\":\"$outline\",\"strokeWidth\":5}],\"tailAt\":{\"x\":80,\"y\":202,\"rot\":-8},\"tail\":[{\"type\":\"path\",\"d\":\"M0 0 q-14 2 -16 10 q14 0 18 -8 z\",\"fill\":\"$deep\",\"stroke\":\"$outline\",\"strokeWidth\":3}]},\"lie\":{\"bodyY\":208,\"headX\":100,\"body\":[{\"type\":\"ellipse\",\"cx\":0,\"cy\":0,\"rx\":54,\"ry\":24,\"fill\":\"$body\",\"stroke\":\"$outline\",\"strokeWidth\":6}],\"belly\":[{\"type\":\"ellipse\",\"cx\":0,\"cy\":10,\"rx\":30,\"ry\":10,\"fill\":\"$belly\",\"opacity\":0.9}],\"headY\":202,\"head\":[{\"type\":\"circle\",\"cx\":0,\"cy\":0,\"r\":30,\"fill\":\"$body\",\"stroke\":\"$outline\",\"strokeWidth\":6}],\"face\":{\"eyeR\":10,\"eyeDx\":13,\"mouthDy\":12,\"mouthW\":8},\"legY\":224,\"legSpread\":40,\"legL\":[{\"type\":\"ellipse\",\"cx\":0,\"cy\":0,\"rx\":8,\"ry\":5,\"fill\":\"$deep\",\"stroke\":\"$outline\",\"strokeWidth\":4}],\"legR\":[{\"type\":\"ellipse\",\"cx\":0,\"cy\":0,\"rx\":8,\"ry\":5,\"fill\":\"$deep\",\"stroke\":\"$outline\",\"strokeWidth\":4}]}},\"workFx\":{\"particles\":[{\"ref\":\"music-note\"},{\"nodes\":[{\"type\":\"ellipse\",\"cx\":0,\"cy\":-2,\"rx\":9,\"ry\":7,\"fill\":\"#F4F8FF\",\"stroke\":\"$outline\",\"strokeWidth\":2},{\"type\":\"path\",\"d\":\"M-4 3 L2 3 L-4 9 Z\",\"fill\":\"#F4F8FF\",\"stroke\":\"$outline\",\"strokeWidth\":2}]}]}}\n");
    p.push_str("字段说明：必填 prototype（真实动植物原型名）、customRig（front 必画；side=移动侧视、lie=趴卧睡姿，都要画；每个视图含 body/head/face/muzzle + 可选 belly/armL/armR/legL/legR/tail/headTop/decor）、toolId（打工工具）、workFx（2~3 个实物产物粒子：每个 {\"nodes\":[…]} 自绘 或 {\"ref\":\"目录id\"} 复用现成粒子，至少 1 个自绘，禁抽象元素——示例这只 = 复用 music-note + 自绘客服对话框）、palette、nameEn、nameZh、descEn、desc、codename；eyes ∈ round|happy|sleepy（可省）。**face 只给眼嘴的尺寸位置：眼睛永远归引擎、绝不自己画眼珠；嘴要么留给引擎（软脸就别画嘴）、要么 face.mouth=\"beak\" 自绘喙当嘴（引擎不再叠嘴）**；脸的个性靠 muzzle 画『眼嘴之外』的鼻/颊/须/眉。示例这只是有喙的鸟（beak 模式）；软嘴物种照默认、muzzle 别画嘴。在眼位画眼珠、软脸在嘴位画嘴线、缺 prototype、body 与 head 都为空、非法颜色、超界坐标、过多节点、workFx 全靠 ref 没有自绘 / ref 不在目录 / 同一粒子既给 nodes 又给 ref，都会被拒。实在画不出三视图时可退而输出参数化 form（含 bodyPlan 六选一），但请优先 customRig。\n");
    p.push_str("⚠️ 上面示例是①分体式（圆头小鸟）——它只演示字段结构。若体型指令要求一体式/头即全身，**必须改用对应构造**（head 或 body 给 []），别照搬示例的两球结构。\n");

    if let Some(feedback) = feedback {
        p.push_str("\n【上次输出被拒绝】");
        p.push_str(feedback);
        p.push_str("\n请修正问题后，重新只输出一个 JSON 对象。\n");
    }
    p
}

// ---------------------------------------------------------------------------
// 后台 worker（挂起蛋驱动）
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
struct FusionJob {
    egg_id: String,
    parents: [String; 2],
    attempts: u32,
}

pub fn notify_worker(state: &FusionGenState) {
    let (lock, cvar) = &state.signal;
    if let Ok(mut pending) = lock.lock() {
        *pending = true;
        cvar.notify_all();
    }
}

// ---------------------------------------------------------------------------
// 英文名回填（默认语言=英文；存量 AI 物种只有中文名 → 补英文名/英文设定）
//
// 两级：① 启动即本地推导补 name_en/desc_en（离线、即时，保证英文界面不露中文名）；
//       ② 若 CLI 可用，后台线程把本地兜底名升级为更有创意的 CLI 英文名（best-effort，
//          失败/未连接就保留本地名，绝不阻塞融合排空线程）。
// ---------------------------------------------------------------------------

/// 单次会话经 CLI 升级英文名的封顶数（防一次性烧太多额度；剩余留本地兜底名）。
const AINAME_UPGRADE_CAP: usize = 24;

/// 元素 → 英文构词（本地兜底英文名用；离线可用）。
fn element_en_word(element: &str) -> &'static str {
    match element {
        "fire" => "Ember",
        "electric" => "Volt",
        "water" => "Aqua",
        "grass" => "Sprout",
        "ice" => "Frost",
        _ => "Gulu",
    }
}

/// 从元素集合本地推导一个可读英文名（AI 物种未回填时的即时兜底）。
fn derive_en_name(elements: &[String]) -> String {
    let mut words: Vec<&str> = Vec::new();
    for element in elements {
        let word = element_en_word(element);
        if !words.contains(&word) {
            words.push(word);
        }
    }
    match words.len() {
        0 => "Gulu Chimera".to_string(),
        1 => format!("{} Sprite", words[0]),
        _ => {
            // 首词原样 + 其余小写拼接（Ember + Frost → "Emberfrost Chimera"）。
            let mut name = words[0].to_string();
            for word in &words[1..] {
                name.push_str(&word.to_lowercase());
            }
            format!("{name} Chimera")
        }
    }
}

/// 本地兜底英文设定。
fn derive_en_desc(elements: &[String]) -> String {
    if elements.is_empty() {
        "A one-of-a-kind fusion creature with a quirky streak.".to_string()
    } else {
        let els: Vec<&str> = elements.iter().map(String::as_str).collect();
        format!(
            "A one-of-a-kind {} fusion creature with a quirky streak.",
            els.join("/")
        )
    }
}

/// 给存量 AI 物种升级英文名/设定的提示词（只求命名，不碰形象）。
fn build_ainame_prompt(name_zh: &str, desc_zh: &str, elements: &[String]) -> String {
    format!(
        "You are naming a cute monster in the desktop-pet game Gulugulu (default language: English). \
Given its existing Chinese name and flavour, invent a short, evocative English proper name and one \
short English flavour line.\n\
- Chinese name: {name_zh}\n\
- Chinese flavour: {desc_zh}\n\
- Elements: {}\n\
Rules: nameEn = 1-2 words, TitleCase, memorable, easy to say; NOT a literal translation, NOT \
\"element + animal\". descEn = one sentence <= 22 words with a cute quirk.\n\
Output ONE JSON object only, no markdown, no explanation: {{\"nameEn\":\"...\",\"descEn\":\"...\"}}",
        elements.join("+")
    )
}

/// 校验/清洗 CLI 给的英文名（与 validate_design 同口径的轻量版）。
fn sanitize_en_name(raw: &str) -> Option<String> {
    let name = raw.trim().to_string();
    let len = name.chars().count();
    let ok = (2..=32).contains(&len)
        && name.chars().any(|c| c.is_ascii_alphabetic())
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '-' | '\''));
    if ok {
        Some(name)
    } else {
        None
    }
}

/// 用本地 CLI 生成一个更好的英文名 + 英文设定（best-effort；任一 provider 成功即返回）。
fn cli_english_name(
    providers: &[(Provider, PathBuf)],
    name_zh: &str,
    desc_zh: &str,
    elements: &[String],
) -> Option<(String, String)> {
    let prompt = build_ainame_prompt(name_zh, desc_zh, elements);
    let timeout = Duration::from_secs(120);
    for (provider, path) in providers {
        let raw = match run_provider(*provider, path, &prompt, timeout, fusion_model(*provider).as_deref()) {
            Ok(text) => text,
            Err(_) => continue,
        };
        let value: serde_json::Value = match serde_json::from_str(&raw) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let name_en = value.get("nameEn").and_then(|v| v.as_str()).and_then(sanitize_en_name);
        if let Some(name_en) = name_en {
            let desc_en = value
                .get("descEn")
                .and_then(|v| v.as_str())
                .map(|s| s.trim().chars().take(160).collect::<String>())
                .unwrap_or_default();
            return Some((name_en, desc_en));
        }
    }
    None
}

/// 后台把本地兜底英文名升级为 CLI 生成名（CLI 不可用则整体跳过，保留兜底名）。
fn spawn_ainame_upgrade(app: AppHandle, game_state: SharedGameState, codenames: Vec<String>) {
    thread::spawn(move || {
        let providers = available_providers();
        if providers.is_empty() {
            return; // 未连接 CLI：保留本地兜底名，下次启动再试。
        }
        let mut done = 0usize;
        for code in codenames.into_iter().take(AINAME_UPGRADE_CAP) {
            // 取该物种当前中文名/设定/元素（可能已被其它流程改动）。
            let snapshot = game::with_save(&app, &game_state, |_config, save| {
                Ok(save.custom_species.get(&code).map(|entry| {
                    (
                        entry.info.name_zh.clone(),
                        entry.info.desc.clone(),
                        entry.info.elements.clone(),
                    )
                }))
            });
            let Some((name_zh, desc_zh, elements)) = snapshot.ok().and_then(|(value, _)| value)
            else {
                continue;
            };
            if let Some((name_en, desc_en)) = cli_english_name(&providers, &name_zh, &desc_zh, &elements) {
                let saved = game::with_save(&app, &game_state, |_config, save| {
                    if let Some(entry) = save.custom_species.get_mut(&code) {
                        entry.info.name_en = name_en.clone();
                        if !desc_en.trim().is_empty() {
                            entry.info.desc_en = desc_en.clone();
                        }
                    }
                    Ok(())
                });
                if let Ok((_, save)) = saved {
                    let _ = app.emit(STATE_EVENT, save);
                }
                done += 1;
            }
        }
        if done > 0 {
            eprintln!("[fusion] upgraded {done} AI English name(s) via CLI");
        }
    });
}

pub fn spawn_fusion_worker(app: AppHandle, game_state: SharedGameState, gen_state: FusionGenState) {
    thread::spawn(move || {
        // 启动恢复：崩溃遗留的 generating / 上轮 failed → pending，重扫重试。
        let recovered = game::with_save(&app, &game_state, |_config, save| {
            let mut changed = false;
            for egg in &mut save.eggs {
                if let Some(pending) = egg.pending_fusion.as_mut() {
                    if pending.status == "generating" || pending.status == "failed" {
                        pending.status = "pending".to_string();
                        changed = true;
                    }
                }
            }
            Ok(changed)
        });
        if let Ok((true, save)) = recovered {
            let _ = app.emit(STATE_EVENT, save);
        }

        // 英文名回填（默认语言=英文）：存量 AI 物种 name_en 空 → 先本地推导补上（即时、离线），
        // 收集待升级列表，再后台用 CLI 升级为更有创意的英文名（best-effort，不阻塞排空）。
        let mut to_upgrade: Vec<String> = Vec::new();
        let backfilled = game::with_save(&app, &game_state, |_config, save| {
            let mut changed = false;
            for (code, entry) in save.custom_species.iter_mut() {
                if entry.info.name_en.trim().is_empty() {
                    entry.info.name_en = derive_en_name(&entry.info.elements);
                    to_upgrade.push(code.clone());
                    changed = true;
                }
                if entry.info.desc_en.trim().is_empty() {
                    entry.info.desc_en = derive_en_desc(&entry.info.elements);
                    changed = true;
                }
            }
            Ok(changed)
        });
        if let Ok((true, save)) = backfilled {
            let _ = app.emit(STATE_EVENT, save);
        }
        if !to_upgrade.is_empty() {
            spawn_ainame_upgrade(app.clone(), game_state.clone(), to_upgrade);
        }

        loop {
            match next_job(&app, &game_state) {
                Some(job) => {
                    // panic 护栏：process_job 内任一 panic（emit/serde/steam FFI 等）本会
                    // 静默掀翻这条无人监管的 drain 线程 → 本次会话所有后续 AI 融合永远卡在
                    // pending、到期只能兜底孵鸭，用户毫不知情。catch_unwind 兜住后把该蛋标
                    // failed(+1 尝试)，线程存活继续排空。
                    let egg_id = job.egg_id.clone();
                    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                        process_job(&app, &game_state, job)
                    }));
                    if outcome.is_err() {
                        eprintln!("[fusion] worker recovered from panic on egg {egg_id}");
                        let _ = game::with_save(&app, &game_state, |_config, save| {
                            let _ = game::logic_mark_fusion_egg(
                                save,
                                &egg_id,
                                "failed",
                                Some("#fusionWorkerPanic".to_string()),
                                true,
                            );
                            Ok(())
                        });
                    }
                }
                None => {
                    let (lock, cvar) = &gen_state.signal;
                    if let Ok(mut pending) = lock.lock() {
                        if !*pending {
                            if let Ok((guard, _)) = cvar.wait_timeout(pending, Duration::from_secs(30)) {
                                pending = guard;
                            } else {
                                continue;
                            }
                        }
                        *pending = false;
                    }
                }
            }
        }
    });
}

/// 取下一颗可生成的蛋（纯逻辑，可单测）。两级优先：
/// 1）pending 蛋（新融合优先）；顺带把已过孵化期限的 pending 蛋标记 failed。
/// 2）会话内自动重试：已 failed 但未到孵化期限、且尝试次数未超上限的蛋——仅在
///    没有 pending 蛋可做时才回捡，避免饿死新融合、也避免猛敲不稳定的 CLI。
/// 达到孵化期限仍未成的蛋（无论 pending/failed）会按兜底 guluduck 孵出。
fn pick_fusion_job(eggs: &mut [EggInstance], now: i64) -> Option<FusionJob> {
    let mut pending_job: Option<FusionJob> = None;
    let mut retry_job: Option<FusionJob> = None;
    for egg in eggs.iter_mut() {
        let Some(pending) = egg.pending_fusion.as_mut() else { continue };
        let expired = egg.hatch_at.map(|hatch_at| now >= hatch_at).unwrap_or(false);
        match pending.status.as_str() {
            "pending" => {
                if expired {
                    pending.status = "failed".to_string();
                    pending.last_error = Some("#fusionEggExpiredFallback".to_string());
                    continue;
                }
                if pending_job.is_none() {
                    pending_job = Some(FusionJob {
                        egg_id: egg.id.clone(),
                        parents: pending.parents.clone(),
                        attempts: pending.attempts,
                    });
                }
            }
            // 上轮生成失败的蛋：只要还没到孵化期限、重试次数未超上限，就再排一次。
            "failed" if !expired && pending.attempts < MAX_FUSION_ATTEMPTS => {
                if retry_job.is_none() {
                    retry_job = Some(FusionJob {
                        egg_id: egg.id.clone(),
                        parents: pending.parents.clone(),
                        attempts: pending.attempts,
                    });
                }
            }
            _ => {}
        }
    }
    // pending 永远优先于 failed 重试。
    pending_job.or(retry_job)
}

fn next_job(app: &AppHandle, game_state: &SharedGameState) -> Option<FusionJob> {
    let now = game::now_secs();
    let result = game::with_save(app, game_state, |_config, save| Ok(pick_fusion_job(&mut save.eggs, now)));
    result.ok().and_then(|(job, _)| job)
}

fn gather_prompt_inputs(
    app: &AppHandle,
    game_state: &SharedGameState,
    job: &FusionJob,
) -> Result<PromptInputs, String> {
    game::with_save(app, game_state, |config, save| {
        let parent_a = game::species_info(config, save, &job.parents[0])
            .cloned()
            .ok_or_else(|| format!("#unknownParentSpecies|species={}", job.parents[0]))?;
        let parent_b = game::species_info(config, save, &job.parents[1])
            .cloned()
            .ok_or_else(|| format!("#unknownParentSpecies|species={}", job.parents[1]))?;
        let mut taken: BTreeSet<String> = config.species.keys().cloned().collect();
        taken.extend(save.custom_species.keys().cloned());
        Ok(PromptInputs {
            parent_a: (job.parents[0].clone(), parent_a),
            parent_b: (job.parents[1].clone(), parent_b),
            taken,
            seed: hash_seed(&job.egg_id),
        })
    })
    .map(|(inputs, _)| inputs)
}

fn mark_egg(
    app: &AppHandle,
    game_state: &SharedGameState,
    egg_id: &str,
    status: &str,
    error: Option<String>,
    bump_attempt: bool,
) {
    if let Ok((_, save)) = game::with_save(app, game_state, |_config, save| {
        game::logic_mark_fusion_egg(save, egg_id, status, error.clone(), bump_attempt)
    }) {
        let _ = app.emit(STATE_EVENT, save);
    }
}

fn generate_codename(taken: impl Fn(&str) -> bool) -> String {
    for salt in 0u64..64 {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0);
        let candidate = format!("aif{:06x}", (nanos.wrapping_add(salt.wrapping_mul(0x9E37))) & 0xFF_FFFF);
        if !taken(&candidate) {
            return candidate;
        }
    }
    format!("aif{:x}", game::now_secs())
}

/// 该融合任务将落入的**全局确定性槽位 codename**（Steam itemdef / 创意工坊 petId 的
/// 共同主键）。取挂起蛋携带的并集配方键 + 该配方已注册槽数推下一个槽号（1-based），
/// 落 `fusion_slots::slot_codename`。多元素配方且槽号 ≤ MAX_AI_SLOTS 才有；否则 None
/// （回落随机名）。与 `logic_resolve_fusion_egg` 用同一 recipe_key 追加，故槽号一致。
fn deterministic_slot_codename(
    config: &crate::game_config::GameConfig,
    save: &crate::game::GameSave,
    job: &FusionJob,
) -> Option<String> {
    let pending = save
        .eggs
        .iter()
        .find(|e| e.id == job.egg_id)
        .and_then(|e| e.pending_fusion.as_ref())?;
    // Steam 掷中的槽位优先（全局池可乱序掷中非前沿槽，生成必须落到该槽）。
    if let Some(forced) = pending.forced_codename.as_ref() {
        return Some(forced.clone());
    }
    let recipe_key = pending.recipe_key.clone();
    let recipe_keys: Vec<String> = config.species_by_recipe.keys().cloned().collect();
    let ordered = crate::fusion_slots::multi_element_recipes_ordered(&recipe_keys);
    let ordinal = crate::fusion_slots::recipe_ordinal(&ordered, &recipe_key)?;
    let slot_index = save.recipe_ai_slots.get(&recipe_key).map(|v| v.len()).unwrap_or(0) + 1;
    if slot_index > crate::fusion_slots::MAX_AI_SLOTS {
        return None;
    }
    Some(crate::fusion_slots::slot_codename(ordinal, slot_index))
}

/// 校验通过后的提交：锁内定名（权威查重）→ 注册物种 + 改写蛋。
fn commit_design(
    app: &AppHandle,
    game_state: &SharedGameState,
    job: &FusionJob,
    design: &ValidatedDesign,
    generator: &str,
) -> Result<(String, GameSave), String> {
    let now = game::now_secs();
    let (codename, save) = game::with_save(app, game_state, |config, save| {
        let is_taken =
            |name: &str| config.species.contains_key(name) || save.custom_species.contains_key(name);
        // Steam 掷中的确定性槽位（forced_codename ← 已按此 def 绑定的物品）在本次生成落地前
        // 已被注册（另一路同配方融合先解析 / 他机工坊导入）→ **复用既有物种**，别退回随机名
        // 让本地物种与绑定的 Steam def 永久分叉（review C#10）。
        let forced_taken = save
            .eggs
            .iter()
            .find(|e| e.id == job.egg_id)
            .and_then(|e| e.pending_fusion.as_ref())
            .and_then(|p| p.forced_codename.clone())
            .filter(|c| is_taken(c));
        if let Some(existing) = forced_taken {
            game::logic_reuse_fusion_egg(save, &job.egg_id, &existing)?;
            return Ok(existing);
        }
        // 全局确定性槽位 codename 优先（Steam itemdef / 创意工坊 petId 主键）；被占或非
        // 多元素配方则回落 CLI 提示名 / 随机名（沿用旧逻辑）。
        let deterministic = deterministic_slot_codename(config, save, job).filter(|n| !is_taken(n));
        let codename = match (deterministic, &design.codename_hint) {
            (Some(name), _) => name,
            (None, Some(hint)) if is_valid_codename(hint) && !is_taken(hint) => hint.clone(),
            (None, _) => generate_codename(is_taken),
        };

        // 融合 2.0：新物种的**元素集合 = 挂起蛋 recipeKey**（双亲元素并集，
        // 与 register_ai_slot / 确定性 codename / recipe_key_for_ai_codename 同源），
        // **阶数 = 蛋的结果阶**（亲代阶 +1）。旧实现只取双亲首元素（最多 2 个）并硬编码
        // tier=2，会让三阶以上 AI 变种的 info 与自身 codename 反推的配方/阶数长期打架
        // （错的每日上限桶、错的 Steam 兑换目标 def、v5 backfill 落错槽）。
        let pending_egg = save.eggs.iter().find(|e| e.id == job.egg_id);
        let recipe_key = pending_egg
            .and_then(|e| e.pending_fusion.as_ref())
            .map(|p| p.recipe_key.clone())
            .filter(|k| !k.is_empty());
        let result_tier = pending_egg.map(|e| e.tier).unwrap_or(2);
        let elements: Vec<String> = match recipe_key {
            Some(key) => key.split('+').map(str::to_string).collect(),
            // 兜底（正常不会走到：job 恒来自一颗带 pending_fusion 的蛋）——退回双亲首元素并集。
            None => {
                let element_a = game::species_info(config, save, &job.parents[0])
                    .and_then(|s| s.elements.first().cloned())
                    .unwrap_or_else(|| "normal".to_string());
                let element_b = game::species_info(config, save, &job.parents[1])
                    .and_then(|s| s.elements.first().cloned())
                    .unwrap_or_else(|| "normal".to_string());
                let mut els = vec![element_a];
                if !els.contains(&element_b) {
                    els.push(element_b);
                }
                els
            }
        };

        // 英文名/设定：模型给了就用，缺失则按元素本地兜底推导（默认语言=英文，务必有英文名）。
        let name_en = if design.name_en.trim().is_empty() {
            derive_en_name(&elements)
        } else {
            design.name_en.clone()
        };
        let desc_en = if design.desc_en.trim().is_empty() {
            derive_en_desc(&elements)
        } else {
            design.desc_en.clone()
        };
        let info = SpeciesInfo {
            name_zh: design.name_zh.clone(),
            name_en,
            tier: result_tier,
            elements,
            colors: vec![design.visual.palette.body.clone(), design.visual.palette.accent.clone()],
            // AI 融合物种一律 chimera 身体（BODY_TO_RIG 的 chimera→chimera）。
            body: "chimera".to_string(),
            desc: design.desc.clone(),
            desc_en,
            // AI 自定义物种无 Steam itemdef 映射（Steam 侧按配方目录物种记账）
            steam_item_def: 0,
        };
        let entry = CustomSpeciesEntry {
            info,
            visual: design.visual.clone(),
            parents: job.parents.clone(),
            created_at: now,
            generator: generator.to_string(),
            // 本机 CLI 生成 → 出处 local（always-publish 与「分享我的皮肤」的资格依据）。
            origin: Some("local".to_string()),
        };
        game::logic_resolve_fusion_egg(config, save, &job.egg_id, &codename, entry)?;
        Ok(codename)
    })?;
    Ok((codename, save))
}

// ---------------------------------------------------------------------------
// 创意工坊（AI 变种形象 UGC）—— 首个上传者胜的认领/复用（全 gated + 防御式）。
// ---------------------------------------------------------------------------

/// 校验从创意工坊下载的形象规格是否落在安全边界（节点/坐标/槽位/粒子上限），镜像
/// `validate_design` 对 visual 的检查。防止畸形/恶意 UGC 触达渲染层。
pub(crate) fn validate_custom_visual(visual: &CustomVisualSpec) -> Result<(), String> {
    for (key, value) in [
        ("body", &visual.palette.body),
        ("deep", &visual.palette.deep),
        ("belly", &visual.palette.belly),
        ("accent", &visual.palette.accent),
    ] {
        if !is_hex_color(value) {
            return Err(format!("palette.{key} 需为 #rrggbb"));
        }
    }
    if let Some(accent2) = &visual.palette.accent2 {
        if !is_hex_color(accent2) {
            return Err("palette.accent2 需为 #rrggbb".to_string());
        }
    }
    if visual.slots.len() > MAX_SLOTS {
        return Err(format!("槽位总数需 ≤{MAX_SLOTS}"));
    }
    for (slot_name, value) in &visual.slots {
        if let SlotSpec::Custom(part) = value {
            if part.nodes.is_empty() || part.nodes.len() > MAX_CUSTOM_NODES {
                return Err(format!("槽位 {slot_name} 自定义节点数需 1~{MAX_CUSTOM_NODES}"));
            }
            for (index, node) in part.nodes.iter().enumerate() {
                validate_shape_node(node, &format!("{slot_name}.nodes[{index}]"))?;
            }
        }
    }
    if let Some(work_fx) = &visual.work_fx {
        if work_fx.particles.len() > 3 {
            return Err("workFx.particles ≤3".to_string());
        }
        // 联合体校验 + 自绘下限（与本地生成同一契约，挡畸形/全靠 ref 复用的 UGC）。
        validate_work_particles(&work_fx.particles)?;
    }
    // AI 完全手绘的三视图 rig（若有）：逐部件几何/坐标校验，挡住畸形/超大 UGC。
    if let Some(rig) = &visual.custom_rig {
        validate_custom_rig(rig)?;
    }
    Ok(())
}

/// 应用从创意工坊下载的首发形象：校验 → 把挂起蛋 resolve 到该 codename（复用
/// `logic_resolve_fusion_egg`，与本地生成同一注册/槽位记账），并顺带：
/// ① 覆写 `origin="workshop"`（下载所得 origin 不可信）；② 把该形象连同上传者
/// 元数据记为「首发皮肤」（图鉴换肤/上传者列表用）；③ 立记 `workshop_published=""`
/// （形象来自他人 → 本机放弃上传，补传扫描据此跳过）。
fn commit_resolved_design(
    app: &AppHandle,
    game_state: &SharedGameState,
    job: &FusionJob,
    codename: &str,
    mut entry: CustomSpeciesEntry,
    details: &crate::steam_workshop::WorkshopItemDetails,
) -> Result<GameSave, String> {
    validate_custom_visual(&entry.visual)?;
    if !is_valid_codename(codename) {
        return Err(format!("非法 codename：{codename}"));
    }
    entry.origin = Some("workshop".to_string());
    let now = game::now_secs();
    let (_, save) = game::with_save(app, game_state, |config, save| {
        if config.species.contains_key(codename) {
            return Err(format!("与目录物种撞名：{codename}"));
        }
        game::logic_resolve_fusion_egg(config, save, &job.egg_id, codename, entry.clone())?;
        let file_id = details.meta.published_file_id;
        // 皮肤入库失败（封顶等）不阻断 resolve——形象本体已在 custom_species。
        let _ = game::logic_install_skin(
            save,
            codename,
            SpeciesSkin {
                id: format!("ws:{file_id}"),
                visual: entry.visual.clone(),
                name_zh: entry.info.name_zh.clone(),
                author_steam_id: details.meta.owner_steam_id.to_string(),
                author_persona: details.meta.owner_persona.clone(),
                published_file_id: file_id.to_string(),
                time_created: details.meta.time_created as i64,
                imported_at: now,
                source: "first".to_string(),
            },
        );
        save.workshop_published.insert(codename.to_string(), String::new());
        Ok(())
    })?;
    Ok(save)
}

/// 工坊兜底复用（皮肤系统起不再是「首查」）：该槽位若已有他人发布的首发形象则下载
/// 复用并 resolve 挂起蛋，返回更新后的存档；未连接/未认领/出错 → None。全 gated +
/// 防御（petId 标签一致性 + 内容大小防线）。仅在 CLI 不可用或生成全败后调用。
fn try_claim_published_slot(
    app: &AppHandle,
    game_state: &SharedGameState,
    job: &FusionJob,
) -> Option<GameSave> {
    if !crate::steam::integration_enabled() {
        return None;
    }
    let steam = app.try_state::<crate::steam::SharedSteamState>()?.inner().clone();
    if !steam.is_connected() {
        return None;
    }
    // 计算本槽确定性 codename（读存档后即释放锁）。
    let codename = game::with_save(app, game_state, |config, save| {
        Ok(deterministic_slot_codename(config, save, job))
    })
    .ok()
    .and_then(|(name, _)| name)?;
    // 查询首发形象（锁外阻塞泵线程）。无人认领 / 出错 → None（走失败路径）。
    let (details, json) = match steam.resolve_species(&codename) {
        Ok(Some(hit)) => hit,
        _ => return None,
    };
    // 防御：物品的 petId 标签必须与请求槽位一致；内容大小设防线（正常几 KB）。
    if details.pet_id.as_deref() != Some(codename.as_str()) {
        eprintln!("[workshop] claim {codename}: petId 标签不符（{:?}），放弃复用", details.pet_id);
        return None;
    }
    if json.len() > 256 * 1024 {
        eprintln!("[workshop] claim {codename}: 内容超限（{} bytes），放弃复用", json.len());
        return None;
    }
    let entry: CustomSpeciesEntry = serde_json::from_str(&json).ok()?;
    commit_resolved_design(app, game_state, job, &codename, entry, &details).ok()
}

/// Steam 资产导入补形象：把某 AI 变种 codename 的创意工坊**首发**形象解析并注册进
/// 本地（`logic_register_workshop_species`：custom_species + AI 槽 + 首发皮肤），成功
/// 后推 `game://state` 让前端把「兜底鸭」替换成真形象。返回 `true`=已注册/已存在；
/// 未连接 / 无人认领 / 校验失败 → `false`（pet 暂显兜底，联网后再次导入可修复）。
/// 防御同 `try_claim_published_slot`：petId 标签一致性 + 内容大小防线。
pub fn resolve_imported_species_appearance(
    app: &AppHandle,
    game_state: &SharedGameState,
    steam: &crate::steam::SharedSteamState,
    codename: &str,
) -> bool {
    if !is_valid_codename(codename) {
        return false;
    }
    // 已有形象（目录物种 / 已注册自定义）→ 幂等成功，免查工坊。
    let already = game::with_save(app, game_state, |config, save| {
        Ok(config.species.contains_key(codename) || save.custom_species.contains_key(codename))
    })
    .map(|(hit, _)| hit)
    .unwrap_or(false);
    if already {
        return true;
    }
    if !steam.is_connected() {
        return false;
    }
    let (details, json) = match steam.resolve_species(codename) {
        Ok(Some(hit)) => hit,
        _ => return false, // 无人认领 / 查询出错 → 保持兜底。
    };
    if details.pet_id.as_deref() != Some(codename) {
        eprintln!("[workshop] import {codename}: petId 标签不符（{:?}），放弃", details.pet_id);
        return false;
    }
    if json.len() > 256 * 1024 {
        eprintln!("[workshop] import {codename}: 内容超限（{} bytes），放弃", json.len());
        return false;
    }
    let entry: CustomSpeciesEntry = match serde_json::from_str(&json) {
        Ok(entry) => entry,
        Err(error) => {
            eprintln!("[workshop] import {codename}: 内容解析失败（{error}）");
            return false;
        }
    };
    if let Err(error) = validate_custom_visual(&entry.visual) {
        eprintln!("[workshop] import {codename}: 形象校验失败（{error}）");
        return false;
    }
    let now = game::now_secs();
    let file_id = details.meta.published_file_id;
    let skin = SpeciesSkin {
        id: format!("ws:{file_id}"),
        visual: entry.visual.clone(),
        name_zh: entry.info.name_zh.clone(),
        author_steam_id: details.meta.owner_steam_id.to_string(),
        author_persona: details.meta.owner_persona.clone(),
        published_file_id: file_id.to_string(),
        time_created: details.meta.time_created as i64,
        imported_at: now,
        source: "first".to_string(),
    };
    match game::with_save(app, game_state, move |config, save| {
        game::logic_register_workshop_species(config, save, codename, entry, skin)
    }) {
        Ok((_, save)) => {
            let _ = app.emit(STATE_EVENT, save); // 渐进替换：本个形象即时上屏。
            true
        }
        Err(error) => {
            eprintln!("[workshop] import {codename}: 注册失败（{error}）");
            false
        }
    }
}

/// Steam 资产导入后台补形象：对一批 AI 变种 codename 逐个查创意工坊首发形象并注册，
/// 每成功一个即推 `game://state`（渐进替换兜底鸭）。另起线程、经泵线程串行、
/// best-effort（单个失败只记日志，下次导入重试）。由 `steam_import_pets` 在导入后拉起。
pub fn spawn_import_appearance_resolver(
    app: AppHandle,
    game_state: SharedGameState,
    steam: crate::steam::SharedSteamState,
    codenames: Vec<String>,
) {
    if codenames.is_empty() || !crate::steam::integration_enabled() {
        return;
    }
    thread::spawn(move || {
        if !steam.is_connected() {
            return;
        }
        let total = codenames.len();
        let mut resolved = 0usize;
        for codename in codenames {
            if resolve_imported_species_appearance(&app, &game_state, &steam, &codename) {
                resolved += 1;
            }
        }
        eprintln!("[workshop] import: {resolved}/{total} 个 AI 变种形象已从创意工坊补齐");
    });
}

/// 物种设定图 PNG 缓存目录：`app_data/species-previews/`（前端离屏渲染写入，
/// 作创意工坊物品缩略图 SetItemPreview 用）。
pub(crate) fn species_preview_dir(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join("species-previews"))
}

/// 某物种的设定图缓存路径（不校验存在性；codename 先过合法性防路径注入）。
pub(crate) fn species_preview_path(app: &AppHandle, codename: &str) -> Option<std::path::PathBuf> {
    if !is_valid_codename(codename) {
        return None;
    }
    species_preview_dir(app).map(|dir| dir.join(format!("{codename}.png")))
}

/// 首发发布前等前端把设定图 PNG 渲染落盘（`cache_species_preview`）的上限。
/// 渲染由前端 webview 完成、常在 `commit_design` 推 `game://state` 后 1~2s 内到位；
/// 给一个宽裕但有界的窗口，超时则兜底无图发布（保留补挂路径）。
const PREVIEW_RENDER_WAIT: Duration = Duration::from_secs(20);

/// 轮询等某物种的设定图 PNG 出现（前端离屏渲染 + `cache_species_preview` 落盘）。
/// 命中返回其路径（用于「带图整体发布」）；超时返回 `None`（调用方兜底无图发布，
/// 之后由 `cache_species_preview` 即时补挂 / 启动 `spawn_workshop_backfill` 补挂收敛）。
fn wait_for_species_preview(
    app: &AppHandle,
    codename: &str,
    timeout: Duration,
) -> Option<std::path::PathBuf> {
    let path = species_preview_path(app, codename)?;
    let start = Instant::now();
    loop {
        if path.is_file() {
            return Some(path);
        }
        if start.elapsed() >= timeout {
            return None;
        }
        thread::sleep(Duration::from_millis(250));
    }
}

/// 把一次成功的创意工坊上传记入存档（补传扫描据此跳过），并同步法律协议状态。
/// `file_id_text` 传 `""` 表示「槽位已被他人认领，本机放弃上传」；
/// `preview_attached` = 本次发布已随内容带上设定图缩略图（预览补挂扫描据此跳过）。
pub(crate) fn record_workshop_published(
    app: &AppHandle,
    game_state: &SharedGameState,
    steam: &crate::steam::SharedSteamState,
    codename: &str,
    file_id_text: String,
    needs_legal: Option<bool>,
    preview_attached: bool,
) {
    let _ = game::with_save(app, game_state, |_config, save| {
        save.workshop_published.insert(codename.to_string(), file_id_text);
        if preview_attached {
            save.workshop_preview_done.insert(codename.to_string());
        }
        Ok(())
    });
    if let Some(pending) = needs_legal {
        steam.set_workshop_legal_pending(app, pending);
    }
}

/// 若该 codename 已由本机上传、缩略图未挂、且缓存 PNG 已存在 → 给工坊物品补挂
/// 设定图（SetItemPreview）并记账。幂等 best-effort：失败只记日志下次再试。
/// 返回是否真的执行了补挂。
pub fn attach_species_preview(
    app: &AppHandle,
    game_state: &SharedGameState,
    steam: &crate::steam::SharedSteamState,
    codename: &str,
) -> bool {
    if !crate::steam::integration_enabled() || !steam.is_connected() {
        eprintln!("[workshop] preview {codename}: 跳过（Steam 未连接）");
        return false;
    }
    let Some(png) = species_preview_path(app, codename).filter(|p| p.is_file()) else {
        eprintln!("[workshop] preview {codename}: 跳过（设定图 PNG 尚未缓存）");
        return false;
    };
    // 短锁读记账：仅本机上传过（fileId 非空可解析）且尚未挂图的才动。重提交需要
    // 与首发一致的完整字段，顺带取回名字与设定 JSON。
    let target = game::with_save(app, game_state, |_config, save| {
        if save.workshop_preview_done.contains(codename) {
            return Ok(None);
        }
        let file_id = save
            .workshop_published
            .get(codename)
            .and_then(|v| v.parse::<u64>().ok())
            .filter(|id| *id > 0);
        let entry = save.custom_species.get(codename);
        Ok(match (file_id, entry) {
            (Some(id), Some(entry)) => serde_json::to_string(entry)
                .ok()
                .map(|json| (id, entry.info.name_zh.clone(), json)),
            _ => None,
        })
    });
    let Ok((Some((file_id, name_zh, entry_json)), _)) = target else {
        eprintln!("[workshop] preview {codename}: 跳过（已挂图或本机未上传该槽）");
        return false;
    };
    match steam.update_species_preview(file_id, codename, &name_zh, &entry_json, png) {
        Ok(()) => {
            eprintln!("[workshop] preview {codename}: 缩略图已挂到 publishedFileId={file_id}");
            let _ = game::with_save(app, game_state, |_config, save| {
                save.workshop_preview_done.insert(codename.to_string());
                Ok(())
            });
            true
        }
        Err(error) => {
            eprintln!("[workshop] preview {codename}: 补挂失败（{error}），下次启动再试");
            false
        }
    }
}

/// 首发认领：把本机刚生成的形象上传创意工坊（gated + best-effort；另起线程不阻塞
/// worker；失败仅记日志，下次启动由补传扫描重试）。
fn publish_generated_slot(app: &AppHandle, game_state: &SharedGameState, codename: &str, name_zh: &str) {
    if !crate::steam::integration_enabled() {
        return;
    }
    let Some(steam) = app.try_state::<crate::steam::SharedSteamState>().map(|s| s.inner().clone()) else {
        return;
    };
    if !steam.is_connected() {
        return;
    }
    // 读回刚落盘的 entry 序列化（发布的即存档里那份）。
    let entry_json = game::with_save(app, game_state, |_config, save| {
        Ok(save.custom_species.get(codename).and_then(|e| serde_json::to_string(e).ok()))
    })
    .ok()
    .and_then(|(json, _)| json);
    let Some(entry_json) = entry_json else {
        return;
    };
    let app = app.clone();
    let game_state = game_state.clone();
    let codename = codename.to_string();
    let name_zh = name_zh.to_string();
    thread::spawn(move || {
        // 「先渲染再带图整体上传」：`commit_design` 已推 game://state，前端随即离屏
        // 渲染设定图并 cache_species_preview 落盘——这里有界等待其就绪，命中即在
        // 首次 SubmitItemUpdate 就带上缩略图（整体上值，无需二次补挂）。渲染迟迟不来
        // （webview 未就绪/渲染失败）则兜底无图发布，之后由 cache_species_preview 即时
        // 补挂 / 启动补挂扫描收敛——绝不因缺图而不上传。
        let preview = wait_for_species_preview(&app, &codename, PREVIEW_RENDER_WAIT);
        let had_preview = preview.is_some();
        if !had_preview {
            eprintln!(
                "[workshop] publish {codename}: 设定图未在 {}s 内就绪，先无图发布（之后补挂）",
                PREVIEW_RENDER_WAIT.as_secs()
            );
        }
        match steam.publish_species(&codename, &name_zh, &entry_json, preview) {
            Ok((file_id, needs_legal)) => {
                eprintln!(
                    "[workshop] publish {codename}: publishedFileId={file_id} legalPending={needs_legal} preview={had_preview}"
                );
                record_workshop_published(
                    &app,
                    &game_state,
                    &steam,
                    &codename,
                    file_id.to_string(),
                    Some(needs_legal),
                    had_preview,
                );
            }
            Err(error) => eprintln!("[workshop] publish {codename} failed: {error}"),
        }
    });
}

/// 补传候选：存档里已有完整设定、但从未做过创意工坊认领处理的 AI 变种 codename
/// （按 BTreeMap 键序稳定输出）。纯函数，便于单测。
pub(crate) fn workshop_backfill_candidates(
    custom_species: &BTreeMap<String, CustomSpeciesEntry>,
    workshop_published: &BTreeMap<String, String>,
) -> Vec<String> {
    custom_species
        .keys()
        .filter(|codename| !workshop_published.contains_key(*codename))
        .cloned()
        .collect()
}

/// 补传是否需要先 resolve 查重：本机生成（origin=="local"）一律**直接上传**（皮肤
/// 系统 always-publish——即使他人抢先，自家皮肤也该有自己的工坊条目供分享/列表）；
/// 出处不明（存量 None）或工坊下载（"workshop"）维持旧行为：查到已有全局形象就记
/// `""` 放弃上传——绝不把他人设计当自家作品重发布。纯函数，便于单测。
pub(crate) fn backfill_should_resolve_first(origin: Option<&str>) -> bool {
    origin != Some("local")
}

/// 存量 AI 物种补传创意工坊：Steam 连接后扫一遍 `custom_species`，对没有认领记录的
/// 槽位先 `resolve`（已有全局形象 → 只记账不上传，保持「最早发布者胜」），无人认领
/// 则把本机形象 `publish` 上去。逐槽经泵线程串行执行、best-effort：单槽失败只记
/// 日志，下次启动重扫。**须由 steam.rs 在泵线程拉起后调用**（内部另起线程）。
pub fn spawn_workshop_backfill(
    app: AppHandle,
    game_state: SharedGameState,
    steam: crate::steam::SharedSteamState,
) {
    if !crate::steam::integration_enabled() {
        return;
    }
    thread::spawn(move || {
        if !steam.is_connected() {
            return;
        }
        // 收集候选（持锁只做序列化，不做任何 Steam 调用）。origin 决定是否 resolve 查重。
        let candidates = match game::with_save(&app, &game_state, |_config, save| {
            let picks = workshop_backfill_candidates(&save.custom_species, &save.workshop_published);
            Ok(picks
                .into_iter()
                .filter_map(|codename| {
                    let entry = save.custom_species.get(&codename)?;
                    let json = serde_json::to_string(entry).ok()?;
                    Some((codename, entry.info.name_zh.clone(), json, entry.origin.clone()))
                })
                .collect::<Vec<_>>())
        }) {
            Ok((list, _)) => list,
            Err(_) => return,
        };
        if !candidates.is_empty() {
            eprintln!("[workshop] backfill: {} 个存量 AI 物种待认领检查", candidates.len());
            for (codename, name_zh, entry_json, origin) in candidates {
                if backfill_should_resolve_first(origin.as_deref()) {
                    // 出处不明/工坊下载：先查全局——已有形象（他人抢先，或本机曾传未
                    // 记账）→ 记账跳过，不覆盖不重传（防把他人设计挂自己名下）。
                    match steam.resolve_species(&codename) {
                        Ok(Some(_)) => {
                            eprintln!("[workshop] backfill {codename}: 槽位已有全局形象，跳过上传");
                            record_workshop_published(
                                &app,
                                &game_state,
                                &steam,
                                &codename,
                                String::new(),
                                None,
                                false,
                            );
                            continue;
                        }
                        Ok(None) => {}
                        Err(error) => {
                            eprintln!("[workshop] backfill {codename}: 查询失败（{error}），下次启动再试");
                            continue;
                        }
                    }
                } else {
                    // 本机生成（origin=local）：皮肤系统 always-publish，跳过查重直接上传
                    //（生成时发布失败的补偿路径也走这里）。
                    eprintln!("[workshop] backfill {codename}: 本机生成，直接上传（always-publish）");
                }
                let preview = species_preview_path(&app, &codename);
                let had_preview = preview.as_deref().map_or(false, |p| p.is_file());
                match steam.publish_species(&codename, &name_zh, &entry_json, preview) {
                    Ok((file_id, needs_legal)) => {
                        eprintln!(
                            "[workshop] backfill {codename}: 已上传 publishedFileId={file_id} legalPending={needs_legal} preview={had_preview}"
                        );
                        record_workshop_published(
                            &app,
                            &game_state,
                            &steam,
                            &codename,
                            file_id.to_string(),
                            Some(needs_legal),
                            had_preview,
                        );
                    }
                    Err(error) => {
                        eprintln!("[workshop] backfill {codename}: 上传失败（{error}），下次启动再试");
                    }
                }
            }
            eprintln!("[workshop] backfill: 扫描完成");
        }

        // 预览补挂：已上传但缩略图未挂的槽位（设定图 PNG 由前端渲染缓存，常晚于上传
        // 产生；cache_species_preview 命令落图时也会即时补挂，这里兜底跨启动收敛）。
        let pending_previews = match game::with_save(&app, &game_state, |_config, save| {
            Ok(save
                .workshop_published
                .iter()
                .filter(|(codename, file_id)| {
                    !file_id.is_empty() && !save.workshop_preview_done.contains(*codename)
                })
                .map(|(codename, _)| codename.clone())
                .collect::<Vec<_>>())
        }) {
            Ok((list, _)) => list,
            Err(_) => Vec::new(),
        };
        if !pending_previews.is_empty() {
            eprintln!("[workshop] preview: {} 个已上传物品待补挂缩略图", pending_previews.len());
            // Steam 对物品更新有洪水限制（2026-07-17 实测：短窗口约 5 个更新后
            // 开始 AccessDenied 进冷却）→ 逐个间隔 60s 滴灌，剩余的下次启动续跑。
            let mut first = true;
            for codename in pending_previews {
                if !first {
                    thread::sleep(Duration::from_secs(60));
                }
                first = false;
                attach_species_preview(&app, &game_state, &steam, &codename);
            }
        }
    });
}

/// 前端启动时查询：哪些自定义物种还没有设定图 PNG 缓存（需要离屏渲染后经
/// `cache_species_preview` 交回）。
#[tauri::command]
pub fn missing_species_previews(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
) -> Result<Vec<String>, String> {
    let (codenames, _) = game::with_save(&app, state.inner(), |_config, save| {
        Ok(save.custom_species.keys().cloned().collect::<Vec<_>>())
    })?;
    Ok(codenames
        .into_iter()
        .filter(|codename| species_preview_path(&app, codename).map_or(false, |p| !p.is_file()))
        .collect())
}

/// 前端把离屏渲染好的物种设定图 PNG（base64）交给后端缓存；若该物种已上传创意
/// 工坊且缩略图未挂，随即在后台补挂（SetItemPreview）。
#[tauri::command]
pub fn cache_species_preview(
    app: AppHandle,
    state: tauri::State<'_, SharedGameState>,
    codename: String,
    png_base64: String,
) -> Result<(), String> {
    use base64::Engine as _;
    let path = species_preview_path(&app, &codename).ok_or_else(|| "非法 codename".to_string())?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(png_base64.as_bytes())
        .map_err(|e| format!("PNG base64 解码失败：{e}"))?;
    // Steam 预览图上限 1MB；SVG 拍平的 PNG 远小于此，超限说明渲染侧出了岔子。
    if bytes.len() > 900 * 1024 {
        return Err(format!("预览图过大（{} bytes > 900KB）", bytes.len()));
    }
    if !bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
        return Err("内容不是 PNG".to_string());
    }
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("建预览目录失败：{e}"))?;
    }
    std::fs::write(&path, &bytes).map_err(|e| format!("写预览图失败：{e}"))?;
    eprintln!("[workshop] preview {codename}: 设定图已缓存（{} bytes → {}）", bytes.len(), path.display());
    // 已上传过的物品即时补挂（后台线程，不阻塞 IPC；未连接/未上传时为 no-op）。
    if let Some(steam) = app.try_state::<crate::steam::SharedSteamState>().map(|s| s.inner().clone()) {
        let app = app.clone();
        let game_state = state.inner().clone();
        thread::spawn(move || {
            attach_species_preview(&app, &game_state, &steam, &codename);
        });
    }
    Ok(())
}

fn process_job(app: &AppHandle, game_state: &SharedGameState, job: FusionJob) {
    let started = Instant::now();
    mark_egg(app, game_state, &job.egg_id, "generating", None, true);
    emit_progress(app, &job.egg_id, "generating", None, job.attempts + 1, None, started);

    // 皮肤系统（SkinWorkshop.md，2026-07-18）：**本地 CLI 生成优先**——工坊已有该槽
    // 形象不再跳过生成（他人首发只是可选皮肤），只要 CLI 可用就生成自己的形象并
    // 发布；工坊复用降级为 CLI 不可用/全部失败后的兜底（见函数尾）。
    let mut last_error = "#fusionCliNotFound".to_string();
    let providers = available_providers();
    if !providers.is_empty() {
        match gather_prompt_inputs(app, game_state, &job) {
            Ok(inputs) => {
                let timeout = fusion_timeout();
                for (provider, path) in &providers {
                    let provider_name = provider.name();
                    // 记录当前 provider 到蛋上（前端徽标显示"Claude/Codex 生成中"）+ 刷新前端。
                    if let Ok((_, save)) = game::with_save(app, game_state, |_config, save| {
                        game::logic_set_fusion_provider(save, &job.egg_id, provider_name);
                        Ok(())
                    }) {
                        let _ = app.emit(STATE_EVENT, save);
                    }
                    let mut feedback: Option<String> = None;
                    for attempt in 1..=2u32 {
                        emit_progress(
                            app,
                            &job.egg_id,
                            if attempt > 1 { "retrying" } else { "generating" },
                            Some(provider_name),
                            attempt,
                            None,
                            started,
                        );
                        let prompt = build_prompt(&inputs, feedback.as_deref());
                        let json_text = match run_provider(*provider, path, &prompt, timeout, fusion_model(*provider).as_deref()) {
                            Ok(text) => text,
                            Err(error) => {
                                // provider 级失败（未登录/超时/崩溃）：纠错重试无意义，换下一个 provider。
                                // CLI 侧错误是动态中文/系统文本 → err= 原样透传。
                                last_error = format!("#providerError|provider={provider_name}|err={error}");
                                break;
                            }
                        };
                        emit_progress(app, &job.egg_id, "validating", Some(provider_name), attempt, None, started);
                        match validate_design(&json_text) {
                            Ok(design) => match commit_design(app, game_state, &job, &design, provider_name) {
                                Ok((codename, save)) => {
                                    let _ = app.emit(STATE_EVENT, save);
                                    // always-publish：把本机形象上传创意工坊（即使他人已首发同槽，
                                    // 自家皮肤也要有自己的条目供分享/上传者列表；gated + best-effort，另起线程）。
                                    publish_generated_slot(app, game_state, &codename, &design.name_zh);
                                    emit_progress(
                                        app,
                                        &job.egg_id,
                                        "resolved",
                                        Some(provider_name),
                                        attempt,
                                        // name = 中文物种名（物种名按设计保持中文），code = codename。
                                        Some(format!("#fusionResolved|name={}|code={codename}", design.name_zh)),
                                        started,
                                    );
                                    return;
                                }
                                Err(error) => {
                                    // 蛋已被收走/清档等：结果只能丢弃，工坊兜底同样无意义。
                                    mark_egg(app, game_state, &job.egg_id, "failed", Some(error.clone()), false);
                                    emit_progress(app, &job.egg_id, "failed", Some(provider_name), attempt, Some(error), started);
                                    return;
                                }
                            },
                            Err(validation_error) => {
                                last_error = format!("#providerError|provider={provider_name}|err={validation_error}");
                                feedback = Some(format!(
                                    "原因：{validation_error}\n上次输出（截断）：{}",
                                    tail_of(&json_text, 400)
                                ));
                            }
                        }
                    }
                }
            }
            Err(error) => {
                last_error = error;
            }
        }
    }

    // 工坊兜底：CLI 不可用 / 素材收集失败 / 生成全败 → 该槽若已有他人首发形象则
    // 下载复用（顺带记首发皮肤），egg 照常 resolve；兜底也落空才标 failed
    //（蛋最终按兜底物种孵出，规则不变）。
    if let Some(save) = try_claim_published_slot(app, game_state, &job) {
        let _ = app.emit(STATE_EVENT, save);
        emit_progress(
            app,
            &job.egg_id,
            "resolved",
            None,
            job.attempts + 1,
            Some("#workshopReuse".to_string()),
            started,
        );
        return;
    }

    mark_egg(app, game_state, &job.egg_id, "failed", Some(last_error.clone()), false);
    emit_progress(app, &job.egg_id, "failed", None, job.attempts + 1, Some(last_error), started);
}

// ---------------------------------------------------------------------------
// IPC 命令
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn check_fusion_cli(
    gen: tauri::State<'_, FusionGenState>,
    force: Option<bool>,
) -> Result<FusionCliStatus, String> {
    let state = gen.inner().clone();
    tauri::async_runtime::spawn_blocking(move || check_cli_cached(&state, force.unwrap_or(false)))
        .await
        .map_err(|error| error.to_string())
}

/// 组装「素材」类融合拒绝消息，点名到触发的那只精灵：
/// `#<code>|species=<codename>|nameZh=<中文名>|nameEn=<英文名>`。
/// species 供前端 en 下 TitleCase 兜底，nameZh/nameEn 供各语言直出；都过 speciesDisplayName
/// 本地化，缺失时省略对应参数、退回 codename。
fn material_reject(
    config: &crate::game::GameConfig,
    save: &GameSave,
    code: &str,
    pet: &crate::game::PetInstance,
) -> String {
    let info = config
        .species
        .get(&pet.species)
        .or_else(|| save.custom_species.get(&pet.species).map(|e| &e.info));
    let name_zh = info.map(|s| s.name_zh.as_str()).unwrap_or("");
    let name_en = info.map(|s| s.name_en.as_str()).unwrap_or("");
    let mut msg = format!("#{code}|species={}", pet.species);
    if !name_zh.is_empty() {
        msg.push_str(&format!("|nameZh={name_zh}"));
    }
    if !name_en.is_empty() {
        msg.push_str(&format!("|nameEn={name_en}"));
    }
    msg
}

#[tauri::command]
pub async fn fuse_pets_ai(
    app: AppHandle,
    game: tauri::State<'_, SharedGameState>,
    gen: tauri::State<'_, FusionGenState>,
    steam: tauri::State<'_, crate::steam::SharedSteamState>,
    id_a: String,
    id_b: String,
) -> Result<FusionStartResult, String> {
    use crate::game::{PendingFusionInfo, SteamOp, FALLBACK_SPECIES};
    use crate::steam_inventory::OpOutcome;

    let game_state = game.inner().clone();
    let gen_state = gen.inner().clone();
    let steam_state = steam.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        // 融合必须连接 CLI —— 即使骰子会掷到配方路径，不可用也直接拒绝。
        let status = check_cli_cached(&gen_state, false);
        if !status.available {
            // 探测详情（probe_all 组装的动态文本）→ err= 原样透传。
            return Err(format!(
                "#fusionNeedsCli|err={}",
                status.error.unwrap_or_default()
            ));
        }

        let now = game::now_secs();
        let today = game::today_string();

        // #4/#9 教学首融：强制经典配方 + 1min（不掷 AI）。
        //   Steam 关（本地调试）→ 此处纯本地短路（logic_fuse_pets，不走 Steam 兑换）；
        //   Steam 开 → 不短路，落到下方「本地先行」路径（那里强制 canonical 配方 + 1min + 烧材料同步 Steam）。
        {
            let (first_egg, save) = game::with_save(&app, &game_state, |config, save| {
                if save.tutorial_first_fusion_done || crate::steam::integration_enabled() {
                    return Ok(None);
                }
                let egg_id = game::logic_fuse_pets(config, save, &id_a, &id_b, now, &today)?;
                if let Some(egg) = save.eggs.iter_mut().find(|e| e.id == egg_id) {
                    if egg.hatch_at.is_some() {
                        egg.hatch_at = Some(now + 60); // 首融蛋 1 分钟孵化（特作：无论产物强制 1 分钟内孵化）
                    }
                }
                save.tutorial_first_fusion_done = true;
                let species = save.eggs.iter().find(|e| e.id == egg_id).map(|e| e.species.clone());
                Ok(Some((egg_id, species)))
            })?;
            if let Some((egg_id, species)) = first_egg {
                let _ = app.emit(STATE_EVENT, save.clone());
                return Ok(FusionStartResult { mode: "recipe".to_string(), save, egg_id, species });
            }
        }

        // Steam 集成关闭（本地调试模式）：走原始本地掷骰路径，不做 Steam 兑换。
        if !crate::steam::integration_enabled() {
            let ((mode, egg_id, species), save) =
                game::with_save(&app, &game_state, |config, save| {
                    let (pet_a, pet_b) = game::logic_validate_fusion_pair(config, save, &id_a, &id_b)?;
                    let recipe_key = game::fusion_pair_recipe_key(config, save, &pet_a, &pet_b)?;
                    let has_recipe = config.fusion_table.contains_key(&recipe_key);
                    let chance = config.ai_fusion_chance_for(&recipe_key);
                    let go_ai = !has_recipe || game::pseudo_random_unit() < chance;
                    if go_ai {
                        let egg_id = game::logic_start_ai_fusion(config, save, &id_a, &id_b, now, &today)?;
                        Ok(("ai".to_string(), egg_id, None))
                    } else {
                        let egg_id = game::logic_fuse_pets(config, save, &id_a, &id_b, now, &today)?;
                        let species = save.eggs.iter().find(|e| e.id == egg_id).map(|e| e.species.clone());
                        Ok(("recipe".to_string(), egg_id, species))
                    }
                })?;
            let _ = app.emit(STATE_EVENT, save.clone());
            if mode == "ai" {
                notify_worker(&gen_state);
            }
            return Ok(FusionStartResult { mode, save, egg_id, species });
        }

        // 阶段 1（存档锁内）：校验 + 分流。
        //   结果 2 阶（含教学首融）→ 本地先行：即时应用 + 排后台 ExchangeItems（烧材料 + 铸结果）。
        //   结果 3 阶+ → Steam 先行写前意图（下方阻塞等兑换返回，00-decisions「三阶强校验」）。
        enum FusePlan {
            LocalDone {
                egg_id: String,
                species: Option<String>,
                mode: String,
            },
            NeedExchange {
                op_id: String,
                item_a: String,
                item_b: String,
                target_def: u32,
                recipe_key: String,
                parents: [String; 2],
            },
        }
        let (plan, save1) =
            game::with_save(&app, &game_state, |config, save| {
                game::settle_all(config, save, now, &today);
                let (pet_a, pet_b) = game::logic_validate_fusion_pair(config, save, &id_a, &id_b)?;
                // 本地先行允许离线（op 在 Steam 重连时由 outbox 泵补跑），不再强制 is_connected。
                // op-lock 拒绝逐只判定并点名到具体那只精灵（被放生 / 其它 op 占用的宠不能当材料）——两条路都拦。
                // ⚠️ 二阶（本地先行）**不再因「同步中 / 未同步 Steam」拒绝**——材料未同步 Steam时由 Fuse op 先铸再兑换
                //    （见下方 take_fusion_material），确保新手引导 / 融合永不被 Steam 同步阻挡；
                //    三阶+（Steam 强校验）仍要求材料已就绪，那两条守卫下移到 3 阶+ 分支。
                let locked = crate::steam_sync::op_locked_ids(save);
                if locked.contains(&id_a) {
                    return Err(material_reject(config, save, "materialOpInProgress", &pet_a));
                }
                if locked.contains(&id_b) {
                    return Err(material_reject(config, save, "materialOpInProgress", &pet_b));
                }
                // ⚠️ 必须用**并集键**（双亲元素集合的并集，fusion_result_recipe_key），
                // 不是旧的主元素对键（fusion_pair_recipe_key）——单元素物种两者恰好相等
                // （t1 融合因此一直成功），多元素/AI 变种立刻错靶（真机 E2E：aif0602×aif0401
                // 被打到 20000 而非 20039 → k_EResultFail）。
                let recipe_key = game::fusion_result_recipe_key(config, save, &pet_a, &pet_b)?;
                // 兑换目标 def（2026-07-16 重接线，00-decisions「用户拍板(2026-07-15)」）：
                //   同物种 → 该物种自身 def 的 `sp:*2` 自升阶（AI 变种 = 其槽位 def；
                //     legacy 物种收敛为该集合的 canonical def——legacy 物品带 sp:<canonical> 标签）；
                //   异物种多元素 → 并集生成器 20000+ord（服务器掷 0 号固定/AI 槽）；
                //   异物种同单元素（canonical×legacy）→ canonical def 确定性收敛。
                let fs_keys: Vec<String> = config.species_by_recipe.keys().cloned().collect();
                let canonical_def = |key: &str| -> Result<u32, String> {
                    let canonical = config
                        .species_by_recipe
                        .get(key)
                        .ok_or_else(|| format!("#recipeNoFixedSpecies|recipe={key}"))?;
                    config
                        .steam_def_for_species(canonical)
                        .ok_or_else(|| "#missingSteamMapping".to_string())
                };
                let is_tutorial_first = !save.tutorial_first_fusion_done;
                let result_tier = pet_a.tier.saturating_add(1);
                let parents = [pet_a.species.clone(), pet_b.species.clone()];
                // 兑换目标 def（与是否教学无关）：同物种→自 def；异物种多元素→**并集生成器 20000+**；异物种单元素→canonical。
                // ⚠️ 异物种**必须**走并集 gen——canonical 物种 def（601-657）只带 `sp:*2` 自升阶兑换、不收跨物种材料，
                //   直接兑 canonical 会 k_EResultFail（教学首融曾强制 canonical 导致融合永远同步不上 Steam）。
                let target_def = if pet_a.species == pet_b.species {
                    if save.custom_species.contains_key(&pet_a.species) {
                        crate::fusion_slots::ai_def_for_codename(&pet_a.species).ok_or_else(|| {
                            "#legacyCustomNotOnSteam".to_string()
                        })?
                    } else {
                        canonical_def(&recipe_key)?
                    }
                } else if recipe_key.contains('+') {
                    let ordered = crate::fusion_slots::multi_element_recipes_ordered(&fs_keys);
                    let ordinal = crate::fusion_slots::recipe_ordinal(&ordered, &recipe_key)
                        .ok_or_else(|| format!("#recipeNoUnionGen|recipe={recipe_key}"))?;
                    crate::fusion_slots::union_gen_def(ordinal)
                } else {
                    canonical_def(&recipe_key)?
                };

                if result_tier == 2 {
                    // 本地先行：即时应用（扣费 + 消耗双亲 + 建**未绑定**蛋）+ 排后台 ExchangeItems。
                    // 取材料身份（**不阻挡融合**）：已同步 Steam→用 item；未同步 Steam（含 MintTier1 待发放/纯本地）→
                    //   item 留空、记 def 由泵先 TriggerItemDrop 铸出再兑换，并取消其待发放 MintTier1
                    //   （铸材料责任转交本 Fuse op，防材料铸出后成孤儿被回导）。
                    let (item_a, mat_def_a) = crate::steam_sync::take_fusion_material(config, save, &pet_a);
                    let (item_b, mat_def_b) = crate::steam_sync::take_fusion_material(config, save, &pet_b);
                    // 教学首融：本地蛋**强制经典配方物种**（确定性 + 已知物种可早收，不阻挡新手引导）；
                    //   Steam 兑换仍走 target_def（异物种即并集 gen，才是合法兑换）——泵掷中 0 号固定即与本地一致，
                    //   掷中 AI 槽则蛋/宠都**保留经典物种**、Steam 物品为该变种（可交易，容忍轻微不一致）：
                    //   apply_fused_result 对「创建时已定案」（pending 从未挂过）的蛋只绑物品，绝不改挂 AI 生成。
                    // 非教学：目标是并集生成器（服务器才掷 0 号固定 / AI 槽，槽未知）→ 蛋挂 pending（神秘/AI），
                    //   泵回绑时按实发 def 精化；否则 def 已知 → 直接解析物种。
                    let (species, pending) = if is_tutorial_first {
                        let canonical = config
                            .species_by_recipe
                            .get(&recipe_key)
                            .cloned()
                            .or_else(|| crate::steam_sync::species_codename_for_def(config, target_def))
                            .unwrap_or_else(|| FALLBACK_SPECIES.to_string());
                        (canonical, None)
                    } else if crate::fusion_slots::is_union_gen_def(target_def) {
                        let pending = PendingFusionInfo {
                            parents: parents.clone(),
                            recipe_key: recipe_key.clone(),
                            requested_at: now,
                            attempts: 0,
                            status: "pending".to_string(),
                            last_error: None,
                            forced_codename: None,
                            provider: None,
                        };
                        // 挂起蛋的兜底物种 = 该配方 0 号固有物种（生成失败/超期开蛋孵它，
                        // 不再退到咕噜鸭；孵化前始终以神秘蛋呈现，不剧透）。
                        let fallback = config
                            .species_by_recipe
                            .get(&recipe_key)
                            .cloned()
                            .unwrap_or_else(|| FALLBACK_SPECIES.to_string());
                        (fallback, Some(pending))
                    } else {
                        crate::steam_sync::resolve_fused_species(
                            config, save, target_def, &recipe_key, &parents, now,
                        )
                    };
                    let mode = if pending.is_some() { "ai" } else { "recipe" }.to_string();
                    let display = if pending.is_some() { None } else { Some(species.clone()) };
                    let egg_id = crate::steam_sync::apply_fusion_local(
                        config, save, &id_a, &id_b, species, now, None, pending,
                    );
                    if is_tutorial_first {
                        // 教学首融：强制 1 分钟内孵化 + 置标志（特作节奏）。
                        if let Some(egg) = save.eggs.iter_mut().find(|e| e.id == egg_id) {
                            if egg.hatch_at.is_some() {
                                egg.hatch_at = Some(now + 60);
                            }
                        }
                        save.tutorial_first_fusion_done = true;
                    }
                    save.steam_outbox.push(SteamOp::Fuse {
                        op_id: game::new_id("op"),
                        pet_a: id_a.clone(),
                        pet_b: id_b.clone(),
                        item_a,
                        item_b,
                        egg_def: target_def,
                        recipe_key,
                        applied: true,
                        mat_def_a,
                        mat_def_b,
                        egg_id: Some(egg_id.clone()),
                        pet_id: None,
                        parents: Some(parents),
                        attempts: 0,
                        next_retry_at: 0,
                    });
                    return Ok(FusePlan::LocalDone { egg_id, species: display, mode });
                }

                // 3 阶+：Steam **强校验**（00-decisions「三阶等 Steam 返回再生成」）——材料必须已就绪，
                // 仍点名拒绝「同步中 / 未同步 Steam」（这两条守卫只在此分支，二阶已解除）。
                if crate::steam_sync::pending_mint_for(save, &id_a).is_some() {
                    return Err(material_reject(config, save, "materialSyncing", &pet_a));
                }
                if crate::steam_sync::pending_mint_for(save, &id_b).is_some() {
                    return Err(material_reject(config, save, "materialSyncing", &pet_b));
                }
                let item_a = pet_a
                    .steam_item_id
                    .clone()
                    .ok_or_else(|| material_reject(config, save, "materialNotOnSteam", &pet_a))?;
                let item_b = pet_b
                    .steam_item_id
                    .clone()
                    .ok_or_else(|| material_reject(config, save, "materialNotOnSteam", &pet_b))?;
                let op_id = game::new_id("op");
                save.steam_outbox.push(SteamOp::Fuse {
                    op_id: op_id.clone(),
                    pet_a: id_a.clone(),
                    pet_b: id_b.clone(),
                    item_a: item_a.clone(),
                    item_b: item_b.clone(),
                    egg_def: target_def,
                    recipe_key: recipe_key.clone(),
                    applied: false,
                    mat_def_a: 0,
                    mat_def_b: 0,
                    egg_id: None,
                    pet_id: None,
                    parents: None,
                    attempts: 0,
                    next_retry_at: 0,
                });
                Ok(FusePlan::NeedExchange {
                    op_id,
                    item_a,
                    item_b,
                    target_def,
                    recipe_key,
                    parents,
                })
            })?;

        // 本地先行完成 → 立即返回（后台 outbox 泵烧材料 + 铸结果并回绑）；否则进入 Steam 先行兑换。
        let (op_id, item_a, item_b, target_def, recipe_key, parents) = match plan {
            FusePlan::LocalDone { egg_id, species, mode } => {
                steam_state.kick_sync();
                let _ = app.emit(STATE_EVENT, save1.clone());
                if mode == "ai" {
                    notify_worker(&gen_state);
                }
                return Ok(FusionStartResult { mode, save: save1, egg_id, species });
            }
            FusePlan::NeedExchange {
                op_id,
                item_a,
                item_b,
                target_def,
                recipe_key,
                parents,
            } => (op_id, item_a, item_b, target_def, recipe_key, parents),
        };

        // 阶段 2（锁外）：Steam 原子兑换（烧两只材料 → 服务器按目标 def 发放结果宠物）。
        let destroy_a = item_a
            .parse::<u64>()
            .map_err(|_| "#steamItemIdCorrupt".to_string())?;
        let destroy_b = item_b
            .parse::<u64>()
            .map_err(|_| "#steamItemIdCorrupt".to_string())?;
        let outcome = steam_state.call_blocking(crate::steam::SteamCall::Exchange {
            generate_def: target_def,
            destroy: vec![destroy_a, destroy_b],
        });

        // 阶段 2.5（锁外）：结果落在堆叠上则拆 1 个出来绑定。拆栈失败 → 保留意图
        // 返回错误（材料已烧，意图回放会找到未绑定结果补应用，等价崩溃恢复）。
        let granted_pair = match &outcome {
            OpOutcome::Granted(items) if !items.is_empty() => {
                Some(crate::steam::ensure_distinct_item(&steam_state, &items[0])?)
            }
            _ => None,
        };

        // 阶段 3（存档锁内）：物种取实发 def —— 固定/已注册变种 = 确定落蛋；
        // 未注册 AI 槽 = 挂起生成（forced_codename 锁定 Steam 掷中的槽位）。
        let ((mode, egg_id, species), save) = game::with_save(&app, &game_state, |config, save| {
            let index = save
                .steam_outbox
                .iter()
                .position(|op| matches!(op, SteamOp::Fuse { op_id: id, .. } if *id == op_id));
            match (&outcome, &granted_pair) {
                (OpOutcome::Granted(items), Some((item_id, item_def))) if !items.is_empty() => {
                    if let Some(index) = index {
                        save.steam_outbox.remove(index);
                    }
                    // 实发 def → 物种 / 挂起生成（与本地先行、崩溃恢复共用 resolve_fused_species）。
                    let (species, pending) = crate::steam_sync::resolve_fused_species(
                        config, save, *item_def, &recipe_key, &parents, now,
                    );
                    let mode = if pending.is_some() { "ai" } else { "recipe" }.to_string();
                    let display = if pending.is_some() { None } else { Some(species.clone()) };
                    let egg_id = crate::steam_sync::apply_fusion_local(
                        config, save, &id_a, &id_b, species, now,
                        Some((item_id.clone(), *item_def)), pending,
                    );
                    Ok((mode, egg_id, display))
                }
                (OpOutcome::Granted(_), _) => {
                    if let Some(index) = index {
                        save.steam_outbox.remove(index);
                    }
                    eprintln!("[steam] fuse exchange target={target_def} destroy=({item_a},{item_b}) → granted empty");
                    Err("#steamFuseExchangeNoItem".to_string())
                }
                (OpOutcome::Failed(error), _) => {
                    if let Some(index) = index {
                        save.steam_outbox.remove(index);
                    }
                    eprintln!("[steam] fuse exchange target={target_def} destroy=({item_a},{item_b}) → failed: {error}");
                    Err(format!("#steamExchangeFailed|err={error}"))
                }
                (OpOutcome::Uncertain, _) => Err("#steamTimeoutWillVerify".to_string()),
            }
        })?;

        let _ = app.emit(STATE_EVENT, save.clone());
        if mode == "ai" {
            notify_worker(&gen_state);
        }
        Ok(FusionStartResult { mode, save, egg_id, species })
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pet_with_species(species: &str) -> crate::game::PetInstance {
        crate::game::PetInstance {
            id: "pet_1".to_string(),
            species: species.to_string(),
            tier: 1,
            level: 1,
            exp: 0,
            stamina: 100,
            stamina_updated_at: 1000,
            exhausted: false,
            key_buffer: 0,
            token_buffer: 0,
            steam_item_id: None,
            steam_item_def: None,
        }
    }

    #[test]
    fn material_reject_names_the_specific_pet() {
        let config: crate::game::GameConfig =
            serde_json::from_str(include_str!("../../src/game/config.json")).unwrap();
        let mut save = game::create_initial_save(&config, 0, BTreeMap::new(), 1000, "2026-07-07");

        // 目录物种 → 附 config 中文名（zh 直出），codename（en TitleCase）。
        let zh = config.species.get("guluduck").expect("config 应含 guluduck").name_zh.clone();
        assert_eq!(
            material_reject(&config, &save, "materialSyncing", &pet_with_species("guluduck")),
            format!("#materialSyncing|species=guluduck|nameZh={zh}")
        );

        // 自定义物种 → 用其 info.nameZh。
        let entry: CustomSpeciesEntry = serde_json::from_str(
            r##"{"info":{"nameZh":"焰霜团","elements":["fire"],"colors":["#ff0000"],"body":"chimera","desc":"d"},
                 "visual":{"rig":"chimera","scale":1.1,"palette":{"body":"#111111","deep":"#222222","belly":"#333333","accent":"#444444"}},
                 "parents":["a","b"],"createdAt":1,"generator":"mock"}"##,
        )
        .unwrap();
        save.custom_species.insert("aif0101".to_string(), entry);
        assert_eq!(
            material_reject(&config, &save, "materialOpInProgress", &pet_with_species("aif0101")),
            "#materialOpInProgress|species=aif0101|nameZh=焰霜团".to_string()
        );

        // 未知物种（config / customSpecies 都没有）→ 省略 nameZh，退回 codename。
        assert_eq!(
            material_reject(&config, &save, "materialNotOnSteam", &pet_with_species("no_such_species")),
            "#materialNotOnSteam|species=no_such_species".to_string()
        );
    }

    #[test]
    fn workshop_backfill_candidates_skips_recorded_slots() {
        let entry: CustomSpeciesEntry = serde_json::from_str(
            r##"{"info":{"nameZh":"测试兽","elements":["fire"],"colors":["#ff0000"],"body":"chimera","desc":"d"},
                 "visual":{"rig":"chimera","scale":1.1,"palette":{"body":"#111111","deep":"#222222","belly":"#333333","accent":"#444444"}},
                 "parents":["a","b"],"createdAt":1,"generator":"mock"}"##,
        )
        .expect("最小 CustomSpeciesEntry 应能反序列化");
        let mut species = BTreeMap::new();
        species.insert("aif0101".to_string(), entry.clone());
        species.insert("aif0102".to_string(), entry.clone());
        species.insert("aif0203".to_string(), entry);
        // 已有记录的槽位（本机已上传 / 他人已认领 ""）都跳过，只剩未处理的。
        let mut published = BTreeMap::new();
        published.insert("aif0102".to_string(), "123456".to_string());
        published.insert("aif0203".to_string(), String::new());
        assert_eq!(workshop_backfill_candidates(&species, &published), vec!["aif0101".to_string()]);
        // 无任何记录 → 全量候选，按键序稳定输出。
        assert_eq!(
            workshop_backfill_candidates(&species, &BTreeMap::new()),
            vec!["aif0101".to_string(), "aif0102".to_string(), "aif0203".to_string()]
        );
        // 全部已处理 → 空。
        let all: BTreeMap<String, String> =
            species.keys().map(|k| (k.clone(), String::new())).collect();
        assert!(workshop_backfill_candidates(&species, &all).is_empty());
    }

    #[test]
    fn backfill_resolve_first_only_for_unknown_or_workshop_origin() {
        // 本机生成 → 直接上传（always-publish，即使他人抢先）。
        assert!(!backfill_should_resolve_first(Some("local")));
        // 存量出处不明 / 工坊下载 → 先查重，命中记 "" 放弃上传（防重发他人设计）。
        assert!(backfill_should_resolve_first(None));
        assert!(backfill_should_resolve_first(Some("workshop")));
    }

    #[test]
    fn catalog_parses_and_matches_part_registry_contract() {
        let cat = catalog();
        assert!(cat.rigs.contains_key("duck"));
        assert_eq!(cat.rigs.len(), 6);
        assert!(cat.eyes.iter().any(|e| e == "happy"));
        assert!(cat.tools.contains_key("laptop"));
        // 每件工具都要有「产物」提示（拼提示词绑定粒子=工具产物；漏一件模型就没方向）。
        assert_eq!(cat.tool_fx_hints.len(), cat.tools.len(), "toolFxHints 必须与 tools 一一对应");
        for id in cat.tools.keys() {
            assert!(cat.tool_fx_hints.contains_key(id), "工具 {id} 缺少 toolFxHints 产物提示");
        }
        for slot in ["tail", "headTop", "back", "cheeks", "marking", "platform"] {
            assert!(cat.slots.contains_key(slot), "missing slot {slot}");
            assert!(cat.slot_geometry.contains_key(slot), "missing geometry {slot}");
        }
        // elementHints 推荐的部件必须真实存在于某个槽位目录里。
        for (element, hint) in &cat.element_hints {
            for part in &hint.parts {
                let exists = cat.slots.values().any(|parts| parts.contains_key(part));
                assert!(exists, "elementHints.{element} 引用了不存在的部件 {part}");
            }
        }
        for (species, parts) in &cat.species_signatures {
            for part in parts {
                let exists = cat.slots.values().any(|m| m.contains_key(part));
                assert!(exists, "speciesSignatures.{species} 引用了不存在的部件 {part}");
            }
        }
        // 共享实物粒子目录：36 个 id+hint，id 唯一非空 → workFx `ref` 白名单。
        assert_eq!(cat.work_particles.len(), 36, "workParticles 应为 36 个实物粒子");
        for w in &cat.work_particles {
            assert!(!w.id.is_empty() && !w.hint.is_empty(), "workParticle {} 需有 id+hint", w.id);
        }
        let ids = work_particle_ids();
        assert_eq!(ids.len(), cat.work_particles.len(), "workParticles id 不得重复");
        for id in ["coffee-cup", "music-note", "gear", "bug", "check-tag"] {
            assert!(ids.contains(id), "实物粒子目录缺少 {id}");
        }
    }

    #[test]
    fn validate_design_work_particle_union_contract() {
        // 最小合法 chimera 设计（form 路径），workFx 用 __FX__ 占位替换不同粒子组合。
        let base = r##"{
            "codename": "workblob",
            "nameZh": "打工团",
            "desc": "一上工就喷出各种实物的小团子",
            "scale": 1.2,
            "palette": {"body":"#E8734A","deep":"#C2492B","belly":"#EAF7FF","accent":"#9BDCFF"},
            "toolId": "laptop",
            "form": {"bodyPlan":"round","segments":2,"headScale":0.8,"legStyle":"stub","legCount":2,"armStyle":"nub","earStyle":"none"},
            "workFx": __FX__
        }"##;
        let node = r##"{"nodes":[{"type":"circle","cx":0,"cy":0,"r":5,"fill":"#6B4A2B","stroke":"$outline","strokeWidth":2}]}"##;
        let with = |fx: String| base.replace("__FX__", &fx);

        // ① 旧式：全部自绘 nodes（向后兼容）→ 通过。
        let all_nodes = with(format!(r##"{{"particles":[{node},{node}]}}"##));
        assert!(validate_design(&all_nodes).is_ok(), "全自绘 nodes（旧式）应通过");

        // ② 混合：合法 ref + 自绘 nodes → 通过（满足自绘下限）；ref/nodes 各自保留。
        let mixed = with(format!(r##"{{"particles":[{{"ref":"coffee-cup"}},{node}]}}"##));
        let d = validate_design(&mixed).expect("ref + 自绘混合应通过");
        let parts = &d.visual.work_fx.as_ref().unwrap().particles;
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0].r#ref.as_deref(), Some("coffee-cup"), "ref 粒子被保留");
        assert!(parts[0].nodes.is_none(), "ref 粒子不带 nodes");
        assert!(parts[1].nodes.is_some() && parts[1].r#ref.is_none(), "自绘粒子只带 nodes");

        // ③ 全 ref（3 个）→ 拒绝：至少要自绘 1 个。
        let all_ref = with(r##"{"particles":[{"ref":"coffee-cup"},{"ref":"gear"},{"ref":"bug"}]}"##.to_string());
        assert!(validate_design(&all_ref).unwrap_err().contains("自绘"), "全 ref 无自绘应被拒");

        // ④ 未知 ref → 拒绝。
        let bad_ref = with(format!(r##"{{"particles":[{{"ref":"nope-not-real"}},{node}]}}"##));
        assert!(
            validate_design(&bad_ref).unwrap_err().contains("不在实物粒子目录"),
            "未知 ref 应被拒"
        );

        // ⑤ 同一粒子既给 nodes 又给 ref → 拒绝（二选一）。
        let both = with(format!(
            r##"{{"particles":[{{"ref":"gear","nodes":[{{"type":"circle","cx":0,"cy":0,"r":5,"fill":"#6B4A2B","stroke":"$outline","strokeWidth":2}}]}},{node}]}}"##
        ));
        assert!(validate_design(&both).unwrap_err().contains("二选一"), "nodes+ref 同给应被拒");

        // ⑥ 数量下限：只有 1 个粒子 → 拒绝（需 2~3）。
        let too_few = with(format!(r##"{{"particles":[{node}]}}"##));
        assert!(validate_design(&too_few).unwrap_err().contains("2~3"), "1 个粒子应被拒");

        // ⑦ 数量上限：4 个粒子 → 拒绝（需 2~3）。
        let too_many = with(format!(r##"{{"particles":[{{"ref":"coffee-cup"}},{{"ref":"gear"}},{{"ref":"bug"}},{node}]}}"##));
        assert!(validate_design(&too_many).unwrap_err().contains("2~3"), "4 个粒子应被拒");
    }

    #[test]
    fn validate_design_accepts_good_and_rejects_bad() {
        let good = r##"{
            "codename": "emberblob",
            "nameZh": "焰霜团",
            "desc": "一半温热一半冰凉的果冻团子",
            "scale": 1.4,
            "palette": {"body":"#E8734A","deep":"#C2492B","belly":"#EAF7FF","accent":"#9BDCFF"},
            "eyes": "happy",
            "toolId": "cauldron",
            "form": {"bodyPlan":"quadruped","segments":3,"bodyW":2.0,"headScale":0.5,"headStyle":"perched","legStyle":"tall","legCount":4,"armStyle":"wing","earStyle":"fin","floating":true},
            "workFx": {"particles":[{"nodes":[{"type":"path","d":"M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z","fill":"$accent","stroke":"$outline","strokeWidth":1.8}]},{"nodes":[{"type":"circle","cx":0,"cy":0,"r":6,"fill":"$belly","opacity":0.6,"stroke":"$accent","strokeWidth":2}]}]},
            "slots": {
                "headTop": {"kind":"custom","nodes":[{"type":"path","d":"M0 0 Q-4 -12 0 -20 Q4 -12 0 0 Z","fill":"$accent","stroke":"$outline","strokeWidth":4}]}
            }
        }"##;
        let design = validate_design(good).unwrap();
        assert_eq!(design.name_zh, "焰霜团");
        assert_eq!(design.visual.rig, "chimera", "融合物种一律 chimera 身体");
        assert_eq!(design.visual.scale, SCALE_MAX, "scale 超出范围被夹取");
        let form = design.visual.form.as_ref().unwrap();
        assert_eq!(form.segments, 3, "form 段数保留");
        assert_eq!(form.body_w, 1.3, "bodyW 越界被夹取到 1.3");
        assert_eq!(form.head_scale, 0.7, "headScale 有 0.7 可爱下限");
        assert_eq!(form.leg_count, 4);
        assert!(form.floating);
        assert!(design.visual.floating, "floating 跟随 form");
        assert_eq!(design.visual.work_fx.as_ref().unwrap().particles.len(), 2, "workFx 保留");
        assert_eq!(form.body_plan, "quadruped", "bodyPlan 保留");

        // 缺 form → 拒绝
        let no_form = good.replace(",\n            \"form\"", ",\n            \"xform\"");
        assert!(validate_design(&no_form).unwrap_err().contains("form"));

        // 缺 workFx → 拒绝（每个角色必须有自己的打工粒子）
        let no_fx = good.replace("\"workFx\"", "\"xworkFx\"");
        assert!(validate_design(&no_fx).unwrap_err().contains("workFx"));

        // 缺 toolId → 拒绝（粒子=工具产物，必须先从工具目录选一件工具）
        let no_tool = good.replace("            \"toolId\": \"cauldron\",\n", "");
        assert!(validate_design(&no_tool).unwrap_err().contains("toolId"));

        // 非法部件 id
        let bad_part = good.replace("\"headTop\": {", "\"headTop\": \"notapart\", \"tail\": {");
        assert!(validate_design(&bad_part).unwrap_err().contains("没有部件"));

        let bad_color = good.replace("#E8734A", "red");
        assert!(validate_design(&bad_color).unwrap_err().contains("palette.body"));

        let bad_name = good.replace("焰霜团", "x");
        assert!(validate_design(&bad_name).unwrap_err().contains("nameZh"));

        // 非法枚举回落默认（headStyle 乱填 → merged），不报错
        let odd = good.replace("\"perched\"", "\"banana\"");
        let d2 = validate_design(&odd).unwrap();
        assert_eq!(d2.visual.form.as_ref().unwrap().head_style, "merged");

        // bodyPlan=stack（或缺失）→ 拒绝：新物种必须选一种动物体型
        let stacky = good.replace("\"bodyPlan\":\"quadruped\"", "\"bodyPlan\":\"stack\"");
        assert!(validate_design(&stacky).unwrap_err().contains("bodyPlan"));
        let no_plan = good.replace("\"bodyPlan\":\"quadruped\",", "");
        assert!(validate_design(&no_plan).unwrap_err().contains("bodyPlan"));

        // nameEn/descEn：模型给了合法值就原样带出；缺失**不拒稿**（留空，commit 时本地推导）。
        assert_eq!(design.name_en, "", "示例无 nameEn → validate 留空(不拒稿)");
        let with_en = good.replace(
            "\"nameZh\": \"焰霜团\",",
            "\"nameZh\": \"焰霜团\", \"nameEn\": \"Emberfrost\", \"descEn\": \"Half warm, half chilled jelly blob.\",",
        );
        let d_en = validate_design(&with_en).unwrap();
        assert_eq!(d_en.name_en, "Emberfrost");
        assert_eq!(d_en.desc_en, "Half warm, half chilled jelly blob.");
    }

    #[test]
    fn derive_en_name_is_readable_english() {
        assert_eq!(derive_en_name(&["fire".to_string()]), "Ember Sprite");
        assert_eq!(
            derive_en_name(&["fire".to_string(), "ice".to_string()]),
            "Emberfrost Chimera"
        );
        assert_eq!(derive_en_name(&[]), "Gulu Chimera");
        // 兜底名满足英文名清洗规则（可直接落 name_en）。
        assert!(sanitize_en_name(&derive_en_name(&["water".to_string(), "grass".to_string()])).is_some());
    }

    /// 2026-07 真机 codex 返回的完整输出（汽团包）：fill:"none" 的雪花粒子曾被
    /// 误拒——固化为回归夹具，保证校验器与提示词示例一致。
    #[test]
    fn validate_design_accepts_real_codex_output() {
        let raw = r##"{"codename":"sizzlebao","nameZh":"汽团包","desc":"肚里咕噜煮冰汽，紧张时会冒小小彩雾","scale":1.1,"palette":{"body":"#E8734A","deep":"#B84631","belly":"#F7FCFD","accent":"#8FD8E8","accent2":"#FFB03A"},"eyes":"happy","toolId":"shavedIce","form":{"bodyPlan":"round","segments":2,"bodyW":1.18,"bodyH":1.02,"taper":0.55,"headStyle":"perched","headScale":0.82,"legStyle":"stub","legCount":2,"armStyle":"nub","earStyle":"none","floating":false},"slots":{"headTop":"steamPuffs","marking":"bellyWave"},"workFx":{"particles":[{"nodes":[{"type":"path","d":"M0 7 q-5 -4 -3 -10 q2 -6 7 -9 q-2 6 2 9 q4 4 3 8 a6 6 0 0 1 -9 2 z","fill":"$accent2","stroke":"$outline","strokeWidth":2.2}]},{"nodes":[{"type":"path","d":"M0 -8 v16 M-7 -4 l14 8 M-7 4 l14 -8","fill":"none","stroke":"$accent","strokeWidth":2.1}]},{"nodes":[{"type":"circle","cx":-4,"cy":0,"r":4,"fill":"$belly","stroke":"$outline","strokeWidth":2},{"type":"circle","cx":5,"cy":-2,"r":3.5,"fill":"$accent","stroke":"$outline","strokeWidth":2}] }]}}"##;
        let design = validate_design(raw).expect("真机 codex 输出必须通过校验");
        assert_eq!(design.name_zh, "汽团包");
        assert_eq!(design.visual.work_fx.as_ref().unwrap().particles.len(), 3);
        assert_eq!(design.visual.form.as_ref().unwrap().head_scale, 0.82);
    }

    #[test]
    fn validate_design_accepts_custom_rig_and_prefers_it_over_form() {
        let raw = r##"{"codename":"chimewren","nameZh":"铃雀","prototype":"山雀","desc":"把风声哼成小调的圆头鸟","scale":1.1,"palette":{"body":"#7FB8E6","deep":"#4F8FC9","belly":"#F3FAFF","accent":"#FFC24A"},"eyes":"happy","toolId":"headset","customRig":{"front":{"bodyY":190,"body":[{"type":"ellipse","cx":0,"cy":0,"rx":46,"ry":44,"fill":"$body","stroke":"$outline","strokeWidth":6}],"headY":126,"head":[{"type":"circle","cx":0,"cy":0,"r":40,"fill":"$body","stroke":"$outline","strokeWidth":6}],"face":{"eyeR":11,"eyeDx":15},"legL":[{"type":"ellipse","cx":0,"cy":2,"rx":9,"ry":5,"fill":"$deep"}],"legR":[{"type":"ellipse","cx":0,"cy":2,"rx":9,"ry":5,"fill":"$deep"}]},"side":{"headX":150,"bodyY":190,"body":[{"type":"ellipse","cx":0,"cy":0,"rx":48,"ry":42,"fill":"$body","stroke":"$outline","strokeWidth":6}],"headY":128,"head":[{"type":"circle","cx":0,"cy":0,"r":36,"fill":"$body","stroke":"$outline","strokeWidth":6}],"face":{"eyeR":10,"eyeCx":8}}},"workFx":{"particles":[{"nodes":[{"type":"ellipse","cx":-3,"cy":6,"rx":5,"ry":4,"fill":"#7FB8E6","stroke":"$outline","strokeWidth":2}]},{"nodes":[{"type":"path","d":"M-4 -7 Q3 0 -4 7","fill":"none","stroke":"#9BD0F0","strokeWidth":2.2}]}]}}"##;
        let design = validate_design(raw).expect("合法 customRig 必须通过校验");
        assert_eq!(design.visual.rig, "custom", "有 customRig 时 rig=custom");
        assert!(design.visual.custom_rig.is_some(), "customRig 被保留");
        assert!(design.visual.form.is_none(), "custom 路径不带 form");
        let rig = design.visual.custom_rig.as_ref().unwrap();
        assert_eq!(rig.front.body.len(), 1);
        assert!(rig.side.is_some(), "side 视图保留");

        // 空 body + 非空 head = 合法（③头即全身模式：向日葵盘/气球怪）
        let empty_body = raw.replace(
            "\"body\":[{\"type\":\"ellipse\",\"cx\":0,\"cy\":0,\"rx\":46,\"ry\":44,\"fill\":\"$body\",\"stroke\":\"$outline\",\"strokeWidth\":6}]",
            "\"body\":[]",
        );
        assert!(validate_design(&empty_body).is_ok(), "head-only 构造应合法");

        // 空 head + 非空 body = 合法（②一体式：脸嵌主体块，海象/灯笼鱼）
        let empty_head = raw.replace(
            "\"head\":[{\"type\":\"circle\",\"cx\":0,\"cy\":0,\"r\":40,\"fill\":\"$body\",\"stroke\":\"$outline\",\"strokeWidth\":6}]",
            "\"head\":[]",
        );
        assert!(validate_design(&empty_head).is_ok(), "一体式（head 空）应合法");

        // body 与 head 都空 → 拒绝
        let both_empty = empty_body.replace(
            "\"head\":[{\"type\":\"circle\",\"cx\":0,\"cy\":0,\"r\":40,\"fill\":\"$body\",\"stroke\":\"$outline\",\"strokeWidth\":6}]",
            "\"head\":[]",
        );
        assert!(validate_design(&both_empty).unwrap_err().contains("都为空"));

        // 超界坐标 → 拒绝
        let oob = raw.replace("\"rx\":46", "\"rx\":999");
        assert!(validate_design(&oob).is_err());

        // 缺 prototype（customRig 路径必须锚定真实动植物原型）→ 拒绝
        let no_proto = raw.replace("\"prototype\":\"山雀\",", "");
        assert!(validate_design(&no_proto).unwrap_err().contains("prototype"));

        // 超粗描边（strokeWidth 12）→ 夹取到 8 通过，不拒稿（真机 codex 两例回归）
        let thick = raw.replace("\"strokeWidth\":6}],\"headY\":126", "\"strokeWidth\":12}],\"headY\":126");
        let clamped = validate_design(&thick).expect("超粗描边应被夹取而非拒绝");
        assert_eq!(
            clamped.visual.custom_rig.as_ref().unwrap().front.body[0].stroke_width,
            Some(8.0),
            "strokeWidth 夹到上限 8"
        );
    }

    // 面部卫生回归夹具：脸心眼在 (±15,-2) r11、软嘴在 (0,16) w14。
    // __MUZZLE__ = "" 或 `,"muzzle":[...]`；__MOUTHMODE__ = "" 或 `,"mouth":"beak"`。
    const HYG_BASE: &str = r##"{"codename":"hygcat","nameZh":"卫生崽","prototype":"猫","desc":"测试脸卫生的小猫","scale":1.1,"palette":{"body":"#7FB8E6","deep":"#4F8FC9","belly":"#F3FAFF","accent":"#FFC24A"},"eyes":"round","toolId":"headset","customRig":{"front":{"bodyY":190,"body":[{"type":"ellipse","cx":0,"cy":0,"rx":46,"ry":44,"fill":"$body","stroke":"$outline","strokeWidth":6}],"headY":126,"head":[{"type":"circle","cx":0,"cy":0,"r":40,"fill":"$body","stroke":"$outline","strokeWidth":6}],"face":{"eyeR":11,"eyeDx":15,"eyeDy":-2,"mouthDy":16,"mouthW":14__MOUTHMODE__}__MUZZLE__,"legL":[{"type":"ellipse","cx":0,"cy":2,"rx":9,"ry":5,"fill":"$deep"}],"legR":[{"type":"ellipse","cx":0,"cy":2,"rx":9,"ry":5,"fill":"$deep"}]}},"workFx":{"particles":[{"nodes":[{"type":"ellipse","cx":-3,"cy":6,"rx":5,"ry":4,"fill":"#7FB8E6","stroke":"$outline","strokeWidth":2}]},{"nodes":[{"type":"path","d":"M-4 -7 Q3 0 -4 7","fill":"none","stroke":"#9BD0F0","strokeWidth":2}]}]}}"##;

    fn hyg(muzzle: &str, mouth_mode: &str) -> String {
        HYG_BASE.replace("__MUZZLE__", muzzle).replace("__MOUTHMODE__", mouth_mode)
    }

    #[test]
    fn face_hygiene_rejects_drawn_eyeball() {
        // 眼位画深色小圆 = 眼珠 → 与引擎会动的眼重影，拒。
        let raw = hyg(r#","muzzle":[{"type":"circle","cx":-15,"cy":-2,"r":5,"fill":"$outline"}]"#, "");
        let err = validate_design(&raw).unwrap_err();
        assert!(err.contains("眼珠"), "画死的眼珠必须被拦：{err}");
    }

    #[test]
    fn face_hygiene_rejects_drawn_mouth_line_and_open_mouth_in_soft_mode() {
        // 软嘴模式在嘴位画一根横跨的笑脸线 → 拒。
        let smile = hyg(r#","muzzle":[{"type":"path","d":"M-7 16 Q0 22 7 16","fill":"none","stroke":"$outline","strokeWidth":3}]"#, "");
        assert!(validate_design(&smile).unwrap_err().contains("嘴"), "画死的嘴线必须被拦");
        // 软嘴模式在嘴位画深色实心张嘴 → 拒。
        let open = hyg(r#","muzzle":[{"type":"ellipse","cx":0,"cy":16,"rx":6,"ry":4,"fill":"$outline"}]"#, "");
        assert!(validate_design(&open).unwrap_err().contains("嘴"), "画死的张嘴必须被拦");
    }

    #[test]
    fn face_hygiene_allows_eye_mask_nostrils_and_brows() {
        // 眼罩（比眼大的深色块，引擎眼叠其上）+ 鼻孔（嘴上小点）+ 眉（眼上描边）都合法。
        let raw = hyg(
            r#","muzzle":[{"type":"ellipse","cx":-15,"cy":-2,"rx":16,"ry":13,"fill":"$deep","opacity":0.6},{"type":"ellipse","cx":15,"cy":-2,"rx":16,"ry":13,"fill":"$deep","opacity":0.6},{"type":"ellipse","cx":-4,"cy":7,"rx":2,"ry":1.5,"fill":"$outline"},{"type":"ellipse","cx":4,"cy":7,"rx":2,"ry":1.5,"fill":"$outline"},{"type":"path","d":"M-24 -14 Q-16 -20 -8 -16","fill":"none","stroke":"$deep","strokeWidth":3}]"#,
            "",
        );
        assert!(validate_design(&raw).is_ok(), "眼罩/鼻孔/眉不该被误杀：{:?}", validate_design(&raw).err());
    }

    #[test]
    fn beak_mode_allows_own_beak_and_records_flag() {
        // beak 模式：在嘴位自绘喙合法（引擎不叠嘴 → 无双嘴），且 mouth 标志被保留。
        let raw = hyg(
            r#","muzzle":[{"type":"path","d":"M-8 12 Q0 8 8 12 L0 22 Z","fill":"$accent","stroke":"$outline","strokeWidth":3}]"#,
            r#","mouth":"beak""#,
        );
        let design = validate_design(&raw).expect("beak 模式自绘喙应合法");
        assert_eq!(
            design.visual.custom_rig.as_ref().unwrap().front.face.mouth.as_deref(),
            Some("beak"),
            "mouth=beak 标志保留，渲染层据此关引擎嘴"
        );
    }

    #[test]
    fn invalid_mouth_mode_is_rejected() {
        let raw = hyg("", r#","mouth":"smile""#);
        assert!(validate_design(&raw).unwrap_err().contains("mouth"), "非法 mouth 取值应被拒");
    }

    #[test]
    fn oversized_mouth_width_is_clamped_not_rejected() {
        // 真机偶发 mouthW=34（≈眼距）画成大裂口 → 夹到 ≤24，不拒稿。
        let raw = hyg("", "").replace("\"mouthW\":14", "\"mouthW\":34");
        let design = validate_design(&raw).expect("过宽嘴应被夹取而非拒绝");
        let w = design.visual.custom_rig.as_ref().unwrap().front.face.mouth_w.unwrap();
        assert!(w <= 24.0 + 1e-9, "mouthW 夹到 ≤24，实得 {w}");
    }

    #[test]
    fn real_gen5_samples_pass_face_hygiene() {
        // 已评审通过的 5 只真机样本必须全部通过（防脸卫生守卫误杀已知良品 = 零假阳性）。
        let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../assets/species_review/gen5_codex");
        let mut checked = 0;
        for name in ["d1", "d2", "d3", "d4", "d5"] {
            let path = format!("{dir}/{name}.json");
            let Ok(raw) = std::fs::read_to_string(&path) else { continue };
            checked += 1;
            assert!(
                validate_design(&raw).is_ok(),
                "真机样本 {name} 不应被脸卫生守卫误杀：{:?}",
                validate_design(&raw).err()
            );
        }
        assert!(checked >= 1, "至少应读到一只真机样本做回归");
    }

    /// 2026-07 真机 codex（矮胖宽扁 seed7）把 polygon.points 写成嵌套数组——
    /// 固化为回归夹具：[[x,y],…] 与 [x,y,x,y,…] 都应被转成标准字符串。
    #[test]
    fn validate_design_tolerates_points_arrays() {
        let raw = r##"{"codename":"peakmound","nameZh":"峰墩崽","prototype":"海象","desc":"背着两座小山峰的大墩子","scale":1.1,"palette":{"body":"#C79A6B","deep":"#9C744B","belly":"#F4E9DA","accent":"#8FD8E8"},"eyes":"round","toolId":"snowGlobe","customRig":{"front":{"bodyY":190,"body":[{"type":"path","d":"M0 -80 Q32 -60 44 42 L-44 42 Q-32 -60 0 -80 Z","fill":"$body","stroke":"$outline","strokeWidth":6},{"type":"polygon","points":[[-28,-54],[-18,-74],[-8,-54]],"fill":"$accent","stroke":"$outline","strokeWidth":4},{"type":"polygon","points":[8,-54,18,-74,28,-54],"fill":"$accent","stroke":"$outline","strokeWidth":4}],"headY":150,"head":[],"face":{"eyeR":10,"eyeDx":14,"mouthDy":13}}},"workFx":{"particles":[{"nodes":[{"type":"circle","cx":0,"cy":0,"r":5,"fill":"#8FD8E8","stroke":"$outline","strokeWidth":2}]},{"nodes":[{"type":"path","d":"M0 -7 V7","fill":"none","stroke":"#CFEFF6","strokeWidth":2}]}]}}"##;
        let design = validate_design(raw).expect("points 数组应被转成字符串并通过校验");
        let front = &design.visual.custom_rig.as_ref().unwrap().front;
        assert_eq!(front.body[1].points.as_deref(), Some("-28,-54 -18,-74 -8,-54"), "嵌套对数组");
        assert_eq!(front.body[2].points.as_deref(), Some("8,-54 18,-74 28,-54"), "扁平数组");
        assert!(front.head.is_empty(), "一体式（head 空）经容错后仍合法");
    }

    #[test]
    fn validate_design_tolerates_quoted_numbers() {
        // codex 偶尔把数字写成字符串（"-24"）；coerce_numeric_strings 后应能通过。
        let raw = r##"{"codename":"quotebug","nameZh":"引号怪","prototype":"瓢虫","desc":"数字爱穿引号的小家伙","scale":"1.1","palette":{"body":"#7FB8E6","deep":"#4F8FC9","belly":"#F3FAFF","accent":"#FFC24A"},"eyes":"happy","toolId":"headset","customRig":{"front":{"bodyY":"190","body":[{"type":"ellipse","cx":"0","cy":0,"rx":46,"ry":"44","fill":"$body","stroke":"$outline","strokeWidth":6}],"headY":126,"head":[{"type":"circle","cx":0,"cy":0,"r":40,"fill":"$body","stroke":"$outline","strokeWidth":6}],"face":{"eyeR":11,"eyeDx":"-15"}}},"workFx":{"particles":[{"nodes":[{"type":"circle","cx":0,"cy":0,"r":5,"fill":"#7FB8E6","stroke":"$outline","strokeWidth":2}]},{"nodes":[{"type":"path","d":"M-4 -7 Q3 0 -4 7","fill":"none","stroke":"#9BD0F0","strokeWidth":2}]}]}}"##;
        let design = validate_design(raw).expect("加引号的数字应被容忍");
        assert_eq!(design.visual.rig, "custom");
        let front = &design.visual.custom_rig.as_ref().unwrap().front;
        assert_eq!(front.body_y, Some(190.0), "bodyY 引号被剥掉");
        assert_eq!(front.face.eye_dx, Some(-15.0), "eyeDx 负数引号被剥掉");
    }

    #[test]
    fn shape_node_validator_blocks_out_of_bounds_and_bad_transform() {
        let mut node = ShapeNode {
            node_type: "circle".to_string(),
            fill: Some("$body".to_string()),
            stroke: None,
            stroke_width: None,
            stroke_linecap: None,
            stroke_linejoin: None,
            fill_rule: None,
            opacity: None,
            transform: Some("translate(4 -6) rotate(20)".to_string()),
            d: None,
            cx: Some(0.0),
            cy: Some(-10.0),
            r: Some(8.0),
            rx: None,
            ry: None,
            x: None,
            y: None,
            width: None,
            height: None,
            points: None,
            x1: None,
            y1: None,
            x2: None,
            y2: None,
        };
        assert!(validate_shape_node(&node, "t").is_ok());
        node.cx = Some(9999.0);
        assert!(validate_shape_node(&node, "t").is_err());
        node.cx = Some(0.0);
        node.transform = Some("matrix(1 0 0 1 0 0)".to_string());
        assert!(validate_shape_node(&node, "t").is_err());
        node.transform = None;
        node.fill = Some("javascript:alert(1)".to_string());
        assert!(validate_shape_node(&node, "t").is_err());
    }

    #[test]
    fn numbers_within_bounds_handles_compact_path_syntax() {
        assert!(numbers_within_bounds("M0 0L1-2 3.5,-4", 300.0));
        assert!(!numbers_within_bounds("M0 0 L500 0", 300.0));
        assert!(numbers_within_bounds("q.5 .5 1 1", 300.0));
    }

    /// 真实 CLI 冒烟（会调用本机已登录的 claude/codex，产生真实 token 消耗）：
    /// `cargo test real_cli -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_cli_generation_smoke() {
        let providers = available_providers();
        assert!(!providers.is_empty(), "本机没有可用的 claude/codex CLI");
        let (provider, path) = &providers[0];
        println!("provider = {} ({})", provider.name(), path.display());

        let sp = |zh: &str, element: &str, color: &str, body: &str, desc: &str| SpeciesInfo {
            name_zh: zh.to_string(),
            name_en: String::new(),
            tier: 1,
            elements: vec![element.to_string()],
            colors: vec![color.to_string()],
            body: body.to_string(),
            desc: desc.to_string(),
            desc_en: String::new(),
            steam_item_def: 0,
        };
        // 双亲元素对轮转（配色多样）：覆盖 火/冰/草/水/电/普 的多种组合。
        let pairs: Vec<((&str, SpeciesInfo), (&str, SpeciesInfo))> = vec![
            (("emberfox", sp("炎尾狐", "fire", "#E85D3A", "fox", "急性子奶狐，火焰尾比头高")),
             ("frostpeng", sp("霜雪怪", "ice", "#8FD8E8", "penguin", "毛茸茸壮实小雪怪"))),
            (("sproutcap", sp("芽菇菇", "grass", "#57B84C", "mushroom", "顶着菌帽的小不点")),
             ("bubblefrog", sp("泡泡蛙", "water", "#2E7BD6", "frog", "爱吹水泡的圆蛙"))),
            (("voltmouse", sp("电电鼠", "electric", "#FFD93B", "mouse", "脸颊带电的大耳鼠")),
             ("emberfox", sp("炎尾狐", "fire", "#E85D3A", "fox", "急性子奶狐"))),
            (("bubblefrog", sp("泡泡蛙", "water", "#2E7BD6", "frog", "爱吹水泡的圆蛙")),
             ("frostpeng", sp("霜雪怪", "ice", "#8FD8E8", "penguin", "高冷话少小雪怪"))),
            (("sproutcap", sp("芽菇菇", "grass", "#57B84C", "mushroom", "顶菌帽的小不点")),
             ("voltmouse", sp("电电鼠", "electric", "#FFD93B", "mouse", "脸颊带电大耳鼠"))),
            (("guluduck", sp("咕噜鸭", "normal", "#F5C542", "duck", "呆萌大扁嘴小鸭")),
             ("sproutcap", sp("芽菇菇", "grass", "#57B84C", "mushroom", "顶菌帽小不点"))),
        ];

        let offset: u64 = std::env::var("GULUGULU_FUSION_SEED_OFFSET")
            .ok().and_then(|s| s.parse().ok()).unwrap_or(0);
        let count: usize = std::env::var("GULUGULU_FUSION_COUNT")
            .ok().and_then(|s| s.parse().ok()).unwrap_or(3);

        let mut good = 0usize;
        for i in 0..count {
            let s = offset + i as u64;
            let ((ca, ia), (cb, ib)) = &pairs[(s as usize) % pairs.len()];
            let (arch, _, _) = BODY_ARCHETYPES[(s as usize) % BODY_ARCHETYPES.len()];
            let inputs = PromptInputs {
                parent_a: (ca.to_string(), ia.clone()),
                parent_b: (cb.to_string(), ib.clone()),
                taken: BTreeSet::from(["guluduck".to_string()]),
                seed: s,
            };
            eprintln!("\n===== #{s} 体型={arch} 双亲={ca}+{cb} =====");
            // 与生产 process_job 一致：带校验反馈的纠错重试，提升良率（单次漏字段可救回）。
            let max_attempts: u32 = std::env::var("GULUGULU_FUSION_ATTEMPTS")
                .ok().and_then(|s| s.parse().ok()).unwrap_or(3);
            let mut feedback: Option<String> = None;
            let mut resolved = false;
            for attempt in 1..=max_attempts {
                let prompt = build_prompt(&inputs, feedback.as_deref());
                let mut json = None;
                for (prov, prov_path) in &providers {
                    match run_provider(*prov, prov_path, &prompt, Duration::from_secs(300), fusion_model(*prov).as_deref()) {
                        Ok(text) => { json = Some(text); break; }
                        Err(e) => eprintln!("  尝试{attempt} {} 失败：{e}", prov.name()),
                    }
                }
                let Some(json) = json else { eprintln!("  ❌ 所有 CLI 失败"); break; };
                match validate_design(&json) {
                    Ok(design) => {
                        // 输出**校验后**的规格（已容错/夹取）+ 名字，供离线渲染忠实还原真机存档。
                        let mut out = serde_json::to_value(&design.visual).unwrap();
                        out["nameZh"] = serde_json::Value::String(design.name_zh.clone());
                        out["nameEn"] = serde_json::Value::String(design.name_en.clone());
                        out["desc"] = serde_json::Value::String(design.desc.clone());
                        out["archetype"] = serde_json::Value::String(arch.to_string());
                        if let Some(proto) = &design.prototype {
                            out["prototype"] = serde_json::Value::String(proto.clone());
                        }
                        good += 1;
                        println!("GOOD#{s} {}", serde_json::to_string(&out).unwrap());
                        eprintln!("  ✅ {}（{arch}·原型 {}·尝试{attempt}）", design.name_zh, design.prototype.as_deref().unwrap_or("?"));
                        resolved = true;
                        break;
                    }
                    Err(e) => {
                        eprintln!("  ⚠️ 尝试{attempt} 校验失败：{e}");
                        feedback = Some(format!("原因：{e}\n上次输出（截断）：{}", tail_of(&json, 400)));
                    }
                }
            }
            if !resolved { eprintln!("  ❌ #{s} 最终失败"); }
        }
        eprintln!("\n==== 成功 {good}/{count} ====");
    }

    #[test]
    fn codename_rules() {
        assert!(is_valid_codename("emberwhale"));
        assert!(is_valid_codename("aif0a1b2c"));
        assert!(!is_valid_codename("Emberwhale"));
        assert!(!is_valid_codename("ab"));
        assert!(!is_valid_codename("has space"));
        let taken = |name: &str| name == "aifabc";
        let generated = generate_codename(taken);
        assert!(is_valid_codename(&generated));
    }

    #[test]
    fn prompt_contains_catalog_and_parents() {
        let cat_species = |_name: &str, zh: &str, element: &str| SpeciesInfo {
            name_zh: zh.to_string(),
            name_en: String::new(),
            tier: 1,
            elements: vec![element.to_string()],
            colors: vec!["#E85D3A".to_string()],
            body: "fox".to_string(),
            desc: "急性子".to_string(),
            desc_en: String::new(),
            steam_item_def: 0,
        };
        let inputs = PromptInputs {
            parent_a: ("emberfox".to_string(), cat_species("emberfox", "炎尾狐", "fire")),
            parent_b: ("frostpeng".to_string(), cat_species("frostpeng", "霜雪怪", "ice")),
            taken: BTreeSet::from(["guluduck".to_string()]),
            seed: 3,
        };
        let prompt = build_prompt(&inputs, None);
        assert!(prompt.contains("炎尾狐"));
        assert!(prompt.contains("霜雪怪"));
        assert!(prompt.contains("guluduck"));
        assert!(prompt.contains("只输出一个 JSON 对象"));
        assert!(prompt.contains("customRig"), "提示词以三视图 customRig 为核心");
        assert!(
            prompt.contains("front") && prompt.contains("side") && prompt.contains("lie"),
            "教三视图 front/side/lie"
        );
        assert!(prompt.contains("趴卧"), "睡姿是趴卧不是压扁");
        assert!(prompt.contains("差异尽可能大"), "强调剪影与双亲/底座差异大");
        assert!(prompt.contains("本次体型 = 飞鸟带翼"), "按 seed 注入具体体型指令");
        assert!(prompt.contains("构造搭法："), "体型指令携带构造搭法");
        assert!(
            prompt.contains("一体式") && prompt.contains("头即全身"),
            "教三种构造模式（分体/一体/头即全身）"
        );
        assert!(prompt.contains("prototype"), "要求锚定真实动植物原型");
        assert!(prompt.contains("原型候选"), "体型指令携带具体原型菜单");
        assert!(prompt.contains("muzzle"), "教面部刻画层（喙/吻/獠牙/眼斑）");
        assert!(prompt.contains("2~3 色分区"), "主体多色分区硬要求");
        assert!(prompt.contains("头要"), "可爱硬规则：大头");
        assert!(prompt.contains("workFx"), "要求角色专属打工粒子");
        assert!(prompt.contains("产物"), "粒子必须绑定为所选工具的产物");
        // 实物粒子改版：菜单列出共享目录 id、给出 ref 复用语法、要求至少自绘 1 个、禁抽象元素。
        assert!(prompt.contains("coffee-cup"), "workFx 菜单应列出共享实物粒子目录 id");
        assert!(prompt.contains("外带咖啡杯"), "菜单同时给出中文 hint");
        assert!(prompt.contains("\"ref\""), "提示词展示 ref 复用形式");
        assert!(prompt.contains("至少") && prompt.contains("自绘"), "强调自绘下限");
        assert!(prompt.contains("严禁抽象"), "禁止抽象元素粒子");
        let retry = build_prompt(&inputs, Some("原因：form 非法"));
        assert!(retry.contains("上次输出被拒绝"));
    }

    /// 造一颗带 pendingFusion 的融合蛋（其它字段取无关紧要的默认值）。
    fn fusion_egg(id: &str, status: &str, attempts: u32, hatch_at: i64) -> EggInstance {
        EggInstance {
            id: id.to_string(),
            species: "guluduck".to_string(),
            tier: 2,
            hatch_kind: "tier2".to_string(),
            slot: Some(0),
            hatch_at: Some(hatch_at),
            pending_fusion: Some(crate::game::PendingFusionInfo {
                parents: ["guluduck".to_string(), "bubblefrog".to_string()],
                recipe_key: "normal+water".to_string(),
                requested_at: 0,
                attempts,
                status: status.to_string(),
                last_error: None,
                forced_codename: None,
                provider: None,
            }),
            steam_item_id: None,
            steam_item_def: None,
            shop_element: None,
        }
    }

    #[test]
    fn pick_fusion_job_prioritises_pending_then_retries_failed() {
        let now = 1_000i64;
        let future = now + 1_000; // 未到孵化期限

        // pending 优先于 failed 重试（即使 failed 排在前面）。
        let mut eggs = vec![
            fusion_egg("failed-1", "failed", 1, future),
            fusion_egg("pending-1", "pending", 0, future),
        ];
        assert_eq!(pick_fusion_job(&mut eggs, now).unwrap().egg_id, "pending-1");

        // 没有 pending 时，回捡未超上限的 failed 蛋做会话内重试。
        let mut eggs = vec![fusion_egg("failed-1", "failed", 1, future)];
        assert_eq!(pick_fusion_job(&mut eggs, now).unwrap().egg_id, "failed-1");

        // 达到重试上限的 failed 蛋不再回捡。
        let mut eggs = vec![fusion_egg("maxed", "failed", MAX_FUSION_ATTEMPTS, future)];
        assert!(pick_fusion_job(&mut eggs, now).is_none());

        // resolved 蛋永不回捡。
        let mut eggs = vec![fusion_egg("done", "resolved", 1, future)];
        assert!(pick_fusion_job(&mut eggs, now).is_none());
    }

    #[test]
    fn pick_fusion_job_handles_hatch_deadline() {
        let now = 5_000i64;
        let past = now - 1; // 已过孵化期限

        // 过期的 pending 蛋被就地标记 failed 且不返回（等孵化兜底 guluduck）。
        let mut eggs = vec![fusion_egg("late", "pending", 0, past)];
        assert!(pick_fusion_job(&mut eggs, now).is_none());
        assert_eq!(eggs[0].pending_fusion.as_ref().unwrap().status, "failed");

        // 过期的 failed 蛋也不再重试（即使尝试次数没到上限）。
        let mut eggs = vec![fusion_egg("late-failed", "failed", 0, past)];
        assert!(pick_fusion_job(&mut eggs, now).is_none());
    }
}
