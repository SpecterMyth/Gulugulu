use crate::cli_spawn::{available_providers, probe_cli, run_provider, tail_of, Provider};
use crate::game::{
    self, ChimeraForm, CustomPalette, CustomSpeciesEntry, CustomVisualSpec, CustomWorkFx,
    EggInstance, GameSave, ShapeNode, SharedGameState, SlotSpec,
};
use crate::game_config::SpeciesInfo;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

// ---------------------------------------------------------------------------
// AI 融合生成模块：本地 Claude Code CLI（优先）/ Codex CLI（兜底）
//
// 架构（计划：AI 融合机制）：
// - 预检：`claude --version` → `codex --version`，均失败 → 前端弹拒绝弹窗。
// - fuse_pets_ai：校验守卫 → 掷骰（aiFusionChance）→ 配方路径走老逻辑 /
//   AI 路径"先提交后生成"（消耗双亲+产挂起蛋）并唤醒 worker，秒级返回。
// - worker：挂起蛋即队列（天然抗重启）。每颗蛋一个生成周期 =
//   claude(初次+带校验错误的纠错重试) → codex(同样两次) → 标记 failed；
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FusionCatalog {
    rigs: BTreeMap<String, CatalogRig>,
    eyes: Vec<String>,
    tools: BTreeMap<String, String>,
    // 每件工具「打工时喷出的产物」提示（toolId → 中文一句）；拼提示词绑定粒子=工具产物。
    tool_fx_hints: BTreeMap<String, String>,
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
    desc: Option<String>,
    scale: Option<f64>,
    palette: Option<CustomPalette>,
    eyes: Option<String>,
    tool_id: Option<String>,
    #[serde(default)]
    form: Option<ChimeraFormInput>,
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
    desc: String,
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

fn is_valid_codename(value: &str) -> bool {
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

fn validate_design(raw_json: &str) -> Result<ValidatedDesign, String> {
    let cat = catalog();
    let design: CliDesign =
        serde_json::from_str(raw_json).map_err(|error| format!("JSON 解析失败：{error}"))?;

    // 融合物种统一走参数化 chimera 身体；缺 form 视为设计缺失。
    let form = normalize_form(design.form.ok_or_else(|| "缺少 form（参数化身体）".to_string())?);
    // 剪影多样化硬约束：新物种必须选一种动物体型，不接受兼容用的 stack（三段圆塔）。
    if !ANIMAL_BODY_PLANS.contains(&form.body_plan.as_str()) {
        return Err(format!(
            "form.bodyPlan 必须是动物体型之一：{}（不要用 stack）",
            ANIMAL_BODY_PLANS.join(" / ")
        ));
    }

    // 角色专属打工粒子：必填，2~3 种造型，每种 1~4 个节点。
    let work_fx = design
        .work_fx
        .ok_or_else(|| "缺少 workFx（角色专属打工粒子，见 workFx 字段说明）".to_string())?;
    if !(2..=3).contains(&work_fx.particles.len()) {
        return Err("workFx.particles 需为 2~3 个粒子造型".to_string());
    }
    for (p, particle) in work_fx.particles.iter().enumerate() {
        if particle.nodes.is_empty() || particle.nodes.len() > 4 {
            return Err(format!("workFx.particles[{p}] 节点数需 1~4"));
        }
        for (index, node) in particle.nodes.iter().enumerate() {
            validate_shape_node(node, &format!("workFx[{p}].nodes[{index}]"))?;
        }
    }

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
    let desc_raw = design.desc.unwrap_or_default().trim().to_string();
    if desc_raw.is_empty() {
        return Err("缺少 desc（一句中文设定）".to_string());
    }
    let desc: String = desc_raw.chars().take(60).collect();

    let scale = design
        .scale
        .filter(|s| s.is_finite())
        .unwrap_or(1.12)
        .clamp(SCALE_MIN, SCALE_MAX);

    Ok(ValidatedDesign {
        codename_hint: design.codename,
        name_zh,
        desc,
        visual: CustomVisualSpec {
            floating: form.floating,
            rig: "chimera".to_string(),
            scale,
            palette,
            eyes: design.eyes,
            tool_id: design.tool_id,
            slots,
            form: Some(form),
            work_fx: Some(work_fx),
        },
    })
}

// ---------------------------------------------------------------------------
// 提示词
// ---------------------------------------------------------------------------

struct PromptInputs {
    parent_a: (String, SpeciesInfo),
    parent_b: (String, SpeciesInfo),
    taken: BTreeSet<String>,
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

    p.push_str("【最重要的设计原则：像某种小动物 + 体型要多样】结果必须是一只**崭新、可爱、一眼能看出\"像某种小动物\"的生物**——不是\"父 A 的身体挂上父 B 的零件\"，更不能是抽象的三段圆球塔。\n");
    p.push_str("- **先定 bodyPlan（体型原型）**，它决定整体剪影。心里先想\"这只更像猫/企鹅/毛虫/水母/团子/大头崽里的哪一类\"，再选对应体型。\n");
    p.push_str("- **追求体型多样**：不同融合物种要尽量选不同的 bodyPlan，让一群融合宠摆在一起时剪影拉得开、胖瘦高矮各异；别每只都做成直立圆球。\n");
    p.push_str("- 剪影要和双亲都明显不同：只从每个父代**各保留一点点**线索（一个主色调、或一种元素气质 火/冰/电…），不要照搬父代的整套标志性部件。\n");
    p.push_str("- 允许、且鼓励物种彻底改变。排序底线：简单 > 好看 > 可爱。\n");
    for line in &cat.style_red_lines {
        p.push_str("- ");
        p.push_str(line);
        p.push('\n');
    }
    p.push('\n');

    p.push_str("【可爱与可读性硬规则】玩家隔着小窗口看宠物，脸就是一切：\n");
    p.push_str("- **脸必须大而清晰**：任何体型下，头都饱满圆润、占比大，眼睛和表情一眼可读。头太小的设计会被拒绝。\n");
    p.push_str("- 整体轮廓圆润胖乎（幼态感），配合 bodyPlan 做出动物味，避免尖锐细长的比例。\n\n");

    p.push_str("【身体 = 先选 bodyPlan 体型原型，再调参数（form）】所有部件平涂卡通、统一深棕描边 #3B2B1D；14 个状态动画会自动适配任何体型。\n");
    p.push_str("**bodyPlan（必填，六选一——先想\"这只像什么动物\"再选，别再用竖直堆叠）**：\n");
    p.push_str("- \"round\"：圆团崽——大圆身 + 大圆头（雏鸟/兔/仓鼠/团子）\n");
    p.push_str("- \"upright\"：直立崽——竖立梨形身 + 肚皮 + 并脚站立（企鹅/小鸭/熊崽）\n");
    p.push_str("- \"quadruped\"：四足兽——横向身体 + 四条腿 + 前上方大头（猫/狐/鹿/鼠），配 legCount=4、legStyle=stub|tall\n");
    p.push_str("- \"long\"：长条崽——贴地长身 + 分节小丘 + 一端是头（毛虫/水獭/壁虎），用 segments=2|3 控分节数\n");
    p.push_str("- \"floaty\"：漂浮崽——离地圆身 + 侧鳍/小翅、无腿（鲸/水母/幽灵），配 legStyle=none、armStyle=flipper|wing\n");
    p.push_str("- \"bighead\"：大头崽——巨头压在小小的身体上（蝌蚪/Q 版大头）\n");
    p.push_str("其余参数在所选体型上微调（都可省，缺省即合理）：\n");
    p.push_str("- bodyW: 0.75~1.3 宽度 · bodyH: 0.85~1.35 高度（拉开胖瘦高矮；**别压太扁**——身体要圆胖，扁片/瘫地不可爱）\n");
    p.push_str("- segments: 2|3 —— 仅 long 用（分节小丘数），其余体型可省\n");
    p.push_str("- legStyle: \"none\"|\"stub\"（短墩）|\"tall\"（长腿）；legCount: 2|4（四足兽用 4）\n");
    p.push_str("- armStyle: \"none\"|\"nub\"（小圆手）|\"wing\"（小翅）|\"flipper\"（桨鳍）\n");
    p.push_str("- earStyle: \"none\"|\"round\"（圆耳）|\"point\"（尖耳）|\"long\"（长垂耳）|\"fin\"（背鳍状）\n");
    p.push_str("- floating: true|false（floaty 会自动离地，可省）\n");
    p.push_str("选一个能呼应双亲元素气质的动物体型 + 一两处点缀，就是一只崭新的小动物！\n\n");

    p.push_str("【调色板 palette】body=身体主色 deep=阴影/深部 belly=肚皮/脸浅色 accent=元素点缀 accent2=第二点缀(可选)。全部 #rrggbb。\n");
    p.push_str("- **配色要有对比、别灰扑扑**：body 用饱和度够的主色，belly/脸用明显更浅的浅色兜住表情，accent 用对比元素色点亮一两处；切忌整只同一个浅蓝/浅色（单调、不可爱）。\n");
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

    p.push_str("【可选点缀件 slots（最多 2 个，宁缺毋滥）】给新身体加一两处元素小特征即可，别堆成父代拼盘。槽位: 部件id：\n");
    for (slot_name, parts) in &cat.slots {
        let ids: Vec<&str> = parts.keys().map(String::as_str).collect();
        p.push_str(&format!("- {slot_name}: {}\n", ids.join(" / ")));
    }
    p.push_str("或用完全重绘的自定义矢量件（更独特）：{\"kind\":\"custom\",\"nodes\":[{\"type\":\"path|circle|ellipse|rect|polygon|line\", ...几何, \"fill\":颜色,\"stroke\":颜色,\"strokeWidth\":数字,\"opacity\":数字,\"transform\":\"translate/rotate/scale\"}]}\n");
    p.push_str(&cat.custom_draw_rules);
    p.push('\n');
    p.push_str("槽位局部坐标（自定义件按此作画，自动获得摆放与动画）：\n");
    for (slot_name, geometry) in &cat.slot_geometry {
        p.push_str(&format!("- {slot_name}: {geometry}\n"));
    }
    p.push('\n');

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

    p.push_str("【打工特效 workFx（必填）】点击打工时，粒子会从手中工具喷向全屏飘散。\n");
    p.push_str("**粒子必须是你上面所选 toolId 那件工具的产物/输出**（照该工具标注的「产物」画），设计 2~3 种小粒子：\n");
    p.push_str("- 这 2~3 种里，至少 2 种是工具的直接产物；元素点缀（雪花/火星/电花之类）最多 1 种，别喧宾夺主。\n");
    p.push_str("\"workFx\": {\"particles\": [{\"nodes\": [ ...ShapeNode... ]}, ...]}\n");
    p.push_str("- 每个粒子是一个 ~16px 的小图形：画在以 (0,0) 为中心、±14 的局部坐标内，1~4 个节点。\n");
    p.push_str("- 节点格式与自定义部件相同（type/几何/fill/stroke/strokeWidth）；用工具/材料的固有色（代码=蓝、火星=橙、纸=白、墨=深蓝…别用宠物体色），必须描边（1.8~2.6）。\n\n");

    p.push_str("【双亲资料（只作灵感，勿照抄部件）】\n");
    p.push_str(&describe_parent(cat, &inputs.parent_a.0, &inputs.parent_a.1, "A"));
    p.push('\n');
    p.push_str(&describe_parent(cat, &inputs.parent_b.0, &inputs.parent_b.1, "B"));
    p.push_str("\n\n");

    p.push_str("【命名与设定】\n");
    p.push_str("- nameZh：2~5 个汉字的中文名，要独特、有辨识度、带点巧思（例：焰霜狸 / 雷角兽 / 温泉猴 / 醒狮 / 琉璃蜓）\n");
    p.push_str("  · 严禁叠字（相邻重复字，如 咕咕 / 泡泡 / 焊焊）；也别用「元素字+动物」的懒名。结合它的元素、职业气质或小怪癖，起个让人会心一笑的名字。\n");
    p.push_str("- desc：一句 ≤40 字的中文设定，带一个可爱的小怪癖\n");
    p.push_str("- codename：小写英文，格式 [a-z][a-z0-9]{2,15}，不能与已占用的重复：");
    let taken: Vec<&str> = inputs.taken.iter().map(String::as_str).collect();
    p.push_str(&taken.join(", "));
    p.push_str("\n\n");

    p.push_str("【输出 JSON 格式（示例）】\n");
    p.push_str("{\"codename\":\"emberlynx\",\"nameZh\":\"焰霜狸\",\"desc\":\"半边毛烫半边毛凉的小四足兽，走起路尾巴一会冒火星一会飘雪\",\"scale\":1.12,\"palette\":{\"body\":\"#E8734A\",\"deep\":\"#C2492B\",\"belly\":\"#EAF7FF\",\"accent\":\"#9BDCFF\",\"accent2\":\"#FFD9A0\"},\"eyes\":\"happy\",\"form\":{\"bodyPlan\":\"quadruped\",\"bodyW\":1.1,\"bodyH\":1.0,\"legStyle\":\"stub\",\"legCount\":4,\"earStyle\":\"point\",\"armStyle\":\"none\"},\"toolId\":\"torch\",\"slots\":{\"tail\":\"flameBolt\"},\"workFx\":{\"particles\":[{\"nodes\":[{\"type\":\"path\",\"d\":\"M0 7 q-5 -4 -3 -10 q2 -6 7 -9 q-2 6 2 9 q4 4 3 8 a6 6 0 0 1 -9 2 z\",\"fill\":\"$accent2\",\"stroke\":\"$outline\",\"strokeWidth\":2.2}]},{\"nodes\":[{\"type\":\"path\",\"d\":\"M0 -6 V6 M-5 -3 L5 3 M-5 3 L5 -3\",\"fill\":\"none\",\"stroke\":\"$accent\",\"strokeWidth\":2}]}]}}\n");
    p.push_str("字段说明：必填 form（含 bodyPlan 动物体型：round/upright/quadruped/long/floaty/bighead 六选一，不接受 stack）、toolId（打工工具，从工具目录选一件）、workFx（该工具的产物粒子）、palette、nameZh、desc、codename；eyes ∈ round|happy|sleepy（可省）；slots ≤2 个槽位（部件 id 或自定义件），可省。非法颜色/超界坐标/过小的头/非动物体型/缺工具会被拒绝。\n");

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

        loop {
            match next_job(&app, &game_state) {
                Some(job) => process_job(&app, &game_state, job),
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
                    pending.last_error = Some("孵化完成前未生成完毕，将孵出咕噜鸭".to_string());
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
            .ok_or_else(|| format!("未知父代物种：{}", job.parents[0]))?;
        let parent_b = game::species_info(config, save, &job.parents[1])
            .cloned()
            .ok_or_else(|| format!("未知父代物种：{}", job.parents[1]))?;
        let mut taken: BTreeSet<String> = config.species.keys().cloned().collect();
        taken.extend(save.custom_species.keys().cloned());
        Ok(PromptInputs {
            parent_a: (job.parents[0].clone(), parent_a),
            parent_b: (job.parents[1].clone(), parent_b),
            taken,
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
    let recipe_key = save
        .eggs
        .iter()
        .find(|e| e.id == job.egg_id)
        .and_then(|e| e.pending_fusion.as_ref())
        .map(|p| p.recipe_key.clone())?;
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
        // 全局确定性槽位 codename 优先（Steam itemdef / 创意工坊 petId 主键）；被占或非
        // 多元素配方则回落 CLI 提示名 / 随机名（沿用旧逻辑）。
        let deterministic = deterministic_slot_codename(config, save, job).filter(|n| !is_taken(n));
        let codename = match (deterministic, &design.codename_hint) {
            (Some(name), _) => name,
            (None, Some(hint)) if is_valid_codename(hint) && !is_taken(hint) => hint.clone(),
            (None, _) => generate_codename(is_taken),
        };

        let element_a = game::species_info(config, save, &job.parents[0])
            .and_then(|s| s.elements.first().cloned())
            .unwrap_or_else(|| "normal".to_string());
        let element_b = game::species_info(config, save, &job.parents[1])
            .and_then(|s| s.elements.first().cloned())
            .unwrap_or_else(|| "normal".to_string());
        let mut elements = vec![element_a];
        if !elements.contains(&element_b) {
            elements.push(element_b);
        }

        let info = SpeciesInfo {
            name_zh: design.name_zh.clone(),
            tier: 2,
            elements,
            colors: vec![design.visual.palette.body.clone(), design.visual.palette.accent.clone()],
            // AI 融合物种一律 chimera 身体（BODY_TO_RIG 的 chimera→chimera）。
            body: "chimera".to_string(),
            desc: design.desc.clone(),
            // AI 自定义物种无 Steam itemdef 映射（Steam 侧按配方目录物种记账）
            steam_item_def: 0,
        };
        let entry = CustomSpeciesEntry {
            info,
            visual: design.visual.clone(),
            parents: job.parents.clone(),
            created_at: now,
            generator: generator.to_string(),
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
fn validate_custom_visual(visual: &CustomVisualSpec) -> Result<(), String> {
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
        for (p, particle) in work_fx.particles.iter().enumerate() {
            if particle.nodes.len() > 4 {
                return Err(format!("workFx.particles[{p}] 节点数 ≤4"));
            }
            for (index, node) in particle.nodes.iter().enumerate() {
                validate_shape_node(node, &format!("workFx[{p}].nodes[{index}]"))?;
            }
        }
    }
    Ok(())
}

/// 应用从创意工坊下载的全局形象：校验 → 把挂起蛋 resolve 到该 codename（复用
/// `logic_resolve_fusion_egg`，与本地生成同一注册/槽位记账）。
fn commit_resolved_design(
    app: &AppHandle,
    game_state: &SharedGameState,
    job: &FusionJob,
    codename: &str,
    entry: CustomSpeciesEntry,
) -> Result<GameSave, String> {
    validate_custom_visual(&entry.visual)?;
    if !is_valid_codename(codename) {
        return Err(format!("非法 codename：{codename}"));
    }
    let (_, save) = game::with_save(app, game_state, |config, save| {
        if config.species.contains_key(codename) {
            return Err(format!("与目录物种撞名：{codename}"));
        }
        game::logic_resolve_fusion_egg(config, save, &job.egg_id, codename, entry.clone())
    })?;
    Ok(save)
}

/// 首个上传者胜：该槽位形象若已被全局认领则下载复用并 resolve 挂起蛋，返回更新后的
/// 存档；未连接/未认领/出错 → None（让本地 CLI 生成继续）。全 gated + 防御。
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
    // 查询全局形象（锁外阻塞泵线程）。无人认领 / 出错 → 本地生成。
    let json = match steam.resolve_species(&codename) {
        Ok(Some(json)) => json,
        _ => return None,
    };
    let entry: CustomSpeciesEntry = serde_json::from_str(&json).ok()?;
    commit_resolved_design(app, game_state, job, &codename, entry).ok()
}

/// 首发认领：把本机刚生成的形象上传创意工坊（gated + best-effort；另起线程不阻塞
/// worker；失败仅记日志）。
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
    let codename = codename.to_string();
    let name_zh = name_zh.to_string();
    thread::spawn(move || {
        if let Err(error) = steam.publish_species(&codename, &name_zh, &entry_json) {
            eprintln!("[workshop] publish {codename} failed: {error}");
        }
    });
}

fn process_job(app: &AppHandle, game_state: &SharedGameState, job: FusionJob) {
    let started = Instant::now();
    mark_egg(app, game_state, &job.egg_id, "generating", None, true);
    emit_progress(app, &job.egg_id, "generating", None, job.attempts + 1, None, started);

    // 首个上传者胜：该槽位形象若已被全局认领，下载复用并跳过 CLI（gated；未连接即跳过，
    // CLI 不可用也能走这条复用路，符合 FusionRecipeSlots §3.4 的降级）。
    if let Some(save) = try_claim_published_slot(app, game_state, &job) {
        let _ = app.emit(STATE_EVENT, save);
        emit_progress(
            app,
            &job.egg_id,
            "resolved",
            None,
            job.attempts + 1,
            Some("复用了创意工坊上的全局形象".to_string()),
            started,
        );
        return;
    }

    let inputs = match gather_prompt_inputs(app, game_state, &job) {
        Ok(inputs) => inputs,
        Err(error) => {
            mark_egg(app, game_state, &job.egg_id, "failed", Some(error.clone()), false);
            emit_progress(app, &job.egg_id, "failed", None, job.attempts + 1, Some(error), started);
            return;
        }
    };

    let providers = available_providers();
    if providers.is_empty() {
        let error = "未检测到本地 Claude Code / Codex CLI".to_string();
        mark_egg(app, game_state, &job.egg_id, "failed", Some(error.clone()), false);
        emit_progress(app, &job.egg_id, "failed", None, job.attempts + 1, Some(error), started);
        return;
    }

    let timeout = fusion_timeout();
    let mut last_error = String::new();

    for (provider, path) in &providers {
        let provider_name = provider.name();
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
                    last_error = format!("{provider_name}：{error}");
                    break;
                }
            };
            emit_progress(app, &job.egg_id, "validating", Some(provider_name), attempt, None, started);
            match validate_design(&json_text) {
                Ok(design) => match commit_design(app, game_state, &job, &design, provider_name) {
                    Ok((codename, save)) => {
                        let _ = app.emit(STATE_EVENT, save);
                        // 首发认领：把本机形象上传创意工坊（gated + best-effort，另起线程）。
                        publish_generated_slot(app, game_state, &codename, &design.name_zh);
                        emit_progress(
                            app,
                            &job.egg_id,
                            "resolved",
                            Some(provider_name),
                            attempt,
                            Some(format!("{}（{codename}）诞生了新设定", design.name_zh)),
                            started,
                        );
                        return;
                    }
                    Err(error) => {
                        // 蛋已被收走/清档等：结果只能丢弃，不再换 provider。
                        mark_egg(app, game_state, &job.egg_id, "failed", Some(error.clone()), false);
                        emit_progress(app, &job.egg_id, "failed", Some(provider_name), attempt, Some(error), started);
                        return;
                    }
                },
                Err(validation_error) => {
                    last_error = format!("{provider_name}：{validation_error}");
                    feedback = Some(format!(
                        "原因：{validation_error}\n上次输出（截断）：{}",
                        tail_of(&json_text, 400)
                    ));
                }
            }
        }
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
    use crate::game_config::STEAM_EGG_DEF_OFFSET;
    use crate::steam_inventory::OpOutcome;

    let game_state = game.inner().clone();
    let gen_state = gen.inner().clone();
    let steam_state = steam.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        // 融合必须连接 CLI —— 即使骰子会掷到配方路径，不可用也直接拒绝。
        let status = check_cli_cached(&gen_state, false);
        if !status.available {
            return Err(format!(
                "融合需要连接本地 Claude Code 或 Codex。{}",
                status.error.unwrap_or_default()
            ));
        }

        let now = game::now_secs();
        let today = game::today_string();

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

        // 阶段 1（存档锁内）：校验 + 写融合意图（Steam 先行：兑换成功才动本地）。
        let ((op_id, item_a, item_b, egg_def, recipe_key, parents), _save) =
            game::with_save(&app, &game_state, |config, save| {
                game::settle_all(config, save, now, &today);
                let (pet_a, pet_b) = game::logic_validate_fusion_pair(config, save, &id_a, &id_b)?;
                let locked = crate::steam_sync::op_locked_ids(save);
                if locked.contains(&id_a) || locked.contains(&id_b) {
                    return Err("素材的 Steam 操作进行中，请稍候".to_string());
                }
                if crate::steam_sync::pending_mint_for(save, &id_a).is_some()
                    || crate::steam_sync::pending_mint_for(save, &id_b).is_some()
                {
                    return Err("素材正在与 Steam 同步中，请稍后再融合".to_string());
                }
                let item_a = pet_a
                    .steam_item_id
                    .clone()
                    .ok_or_else(|| "素材尚未同步到 Steam（本地精灵不可融合上链产物）".to_string())?;
                let item_b = pet_b
                    .steam_item_id
                    .clone()
                    .ok_or_else(|| "素材尚未同步到 Steam（本地精灵不可融合上链产物）".to_string())?;
                if !steam_state.is_connected() {
                    return Err("融合需要连接 Steam".to_string());
                }
                let recipe_key = game::fusion_pair_recipe_key(config, save, &pet_a, &pet_b)?;
                let species = config
                    .fusion_table
                    .get(&recipe_key)
                    .cloned()
                    .ok_or_else(|| "融合表缺少这个组合".to_string())?;
                let egg_def = config
                    .steam_def_for_species(&species)
                    .ok_or_else(|| "缺少 Steam 物品映射".to_string())?
                    + STEAM_EGG_DEF_OFFSET;
                let op_id = game::new_id("op");
                save.steam_outbox.push(SteamOp::Fuse {
                    op_id: op_id.clone(),
                    pet_a: id_a.clone(),
                    pet_b: id_b.clone(),
                    item_a: item_a.clone(),
                    item_b: item_b.clone(),
                    egg_def,
                    recipe_key: recipe_key.clone(),
                });
                Ok((
                    op_id,
                    item_a,
                    item_b,
                    egg_def,
                    recipe_key,
                    [pet_a.species.clone(), pet_b.species.clone()],
                ))
            })?;

        // 阶段 2（锁外）：Steam 原子兑换（烧两只材料 → 发放绑定蛋）。
        let destroy_a = item_a
            .parse::<u64>()
            .map_err(|_| "Steam 物品 id 损坏，请先同步".to_string())?;
        let destroy_b = item_b
            .parse::<u64>()
            .map_err(|_| "Steam 物品 id 损坏，请先同步".to_string())?;
        let outcome = steam_state.call_blocking(crate::steam::SteamCall::Exchange {
            generate_def: egg_def,
            destroy: vec![destroy_a, destroy_b],
        });

        // 阶段 3（存档锁内）：成功 → 掷骰（AI/配方）并应用本地；失败 → 弃意图。
        let ((mode, egg_id, species), save) = game::with_save(&app, &game_state, |config, save| {
            let index = save
                .steam_outbox
                .iter()
                .position(|op| matches!(op, SteamOp::Fuse { op_id: id, .. } if *id == op_id));
            match &outcome {
                OpOutcome::Granted(items) if !items.is_empty() => {
                    if let Some(index) = index {
                        save.steam_outbox.remove(index);
                    }
                    let egg_item = items[0].item_id.clone();
                    // 掷骰在兑换成功之后：失败的兑换不消耗 AI 概率语义；
                    // 崩溃恢复（意图回放）一律走配方路径（00-decisions.md）。
                    let chance = config.ai_fusion_chance_for(&recipe_key);
                    if game::pseudo_random_unit() < chance {
                        let pending = PendingFusionInfo {
                            parents,
                            recipe_key: recipe_key.clone(),
                            requested_at: now,
                            attempts: 0,
                            status: "pending".to_string(),
                            last_error: None,
                        };
                        let egg_id = crate::steam_sync::apply_fusion_local(
                            config,
                            save,
                            &id_a,
                            &id_b,
                            FALLBACK_SPECIES.to_string(),
                            now,
                            egg_item,
                            egg_def,
                            Some(pending),
                        );
                        Ok(("ai".to_string(), egg_id, None))
                    } else {
                        let species = config
                            .fusion_table
                            .get(&recipe_key)
                            .cloned()
                            .unwrap_or_else(|| FALLBACK_SPECIES.to_string());
                        let egg_id = crate::steam_sync::apply_fusion_local(
                            config,
                            save,
                            &id_a,
                            &id_b,
                            species.clone(),
                            now,
                            egg_item,
                            egg_def,
                            None,
                        );
                        Ok(("recipe".to_string(), egg_id, Some(species)))
                    }
                }
                OpOutcome::Granted(_) => {
                    if let Some(index) = index {
                        save.steam_outbox.remove(index);
                    }
                    Err("Steam 兑换未发放蛋物品，融合已取消".to_string())
                }
                OpOutcome::Failed(error) => {
                    if let Some(index) = index {
                        save.steam_outbox.remove(index);
                    }
                    Err(format!("Steam 兑换失败：{error}"))
                }
                OpOutcome::Uncertain => Err("Steam 响应超时，稍后自动核对".to_string()),
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

        let species = |zh: &str, element: &str, color: &str, body: &str, desc: &str| SpeciesInfo {
            name_zh: zh.to_string(),
            tier: 1,
            elements: vec![element.to_string()],
            colors: vec![color.to_string()],
            body: body.to_string(),
            desc: desc.to_string(),
            steam_item_def: 0,
        };
        let inputs = PromptInputs {
            parent_a: (
                "emberfox".to_string(),
                species("炎尾狐", "fire", "#E85D3A", "fox", "急性子的高个子奶狐，火焰尾巴比头还高"),
            ),
            parent_b: (
                "frostpeng".to_string(),
                species("霜雪怪", "ice", "#8FD8E8", "penguin", "毛茸茸的壮实小雪怪，高冷话少"),
            ),
            taken: BTreeSet::from(["guluduck".to_string(), "emberfox".to_string(), "frostpeng".to_string()]),
        };
        let prompt = build_prompt(&inputs, None);
        // 遍历 provider（claude 登录失效时用 codex），复现 worker 的兜底顺序。
        let mut json = None;
        for (prov, prov_path) in &providers {
            println!("尝试 provider = {} ({})", prov.name(), prov_path.display());
            match run_provider(*prov, prov_path, &prompt, Duration::from_secs(300), fusion_model(*prov).as_deref()) {
                Ok(text) => {
                    json = Some(text);
                    break;
                }
                Err(e) => println!("  失败：{e}"),
            }
        }
        let _ = (provider, path);
        let json = json.expect("所有 CLI 都失败（可能都未登录）");
        println!("raw json = {json}");
        let design = validate_design(&json).expect("生成结果没通过校验");
        let form = design.visual.form.as_ref().unwrap();
        println!(
            "✅ {}（{:?}）rig={} form=segments{} bodyW{} bodyH{} head={} legs={}×{} arms={} ears={} float={}\n   palette={:?} slots={:?}\n   desc: {}",
            design.name_zh, design.codename_hint, design.visual.rig,
            form.segments, form.body_w, form.body_h, form.head_style, form.leg_style, form.leg_count,
            form.arm_style, form.ear_style, form.floating,
            design.visual.palette,
            design.visual.slots.keys().collect::<Vec<_>>(),
            design.desc,
        );
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
            tier: 1,
            elements: vec![element.to_string()],
            colors: vec!["#E85D3A".to_string()],
            body: "fox".to_string(),
            desc: "急性子".to_string(),
            steam_item_def: 0,
        };
        let inputs = PromptInputs {
            parent_a: ("emberfox".to_string(), cat_species("emberfox", "炎尾狐", "fire")),
            parent_b: ("frostpeng".to_string(), cat_species("frostpeng", "霜雪怪", "ice")),
            taken: BTreeSet::from(["guluduck".to_string()]),
        };
        let prompt = build_prompt(&inputs, None);
        assert!(prompt.contains("炎尾狐"));
        assert!(prompt.contains("霜雪怪"));
        assert!(prompt.contains("fluke"));
        assert!(prompt.contains("guluduck"));
        assert!(prompt.contains("只输出一个 JSON 对象"));
        assert!(prompt.contains("segments"), "提示词包含参数化身体 form");
        assert!(prompt.contains("完全不同"), "强调剪影与双亲不同");
        assert!(prompt.contains("bodyPlan"), "提示词以体型原型 bodyPlan 为主轴");
        assert!(prompt.contains("quadruped"), "提示词列出四足兽等动物体型");
        assert!(prompt.contains("脸必须大而清晰"), "可爱硬规则：大头大脸");
        assert!(prompt.contains("workFx"), "要求角色专属打工粒子");
        assert!(prompt.contains("产物"), "粒子必须绑定为所选工具的产物");
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
            }),
            steam_item_id: None,
            steam_item_def: None,
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
