use super::*;
use serde_json::{json, Value};

pub(super) const PROMPT_VERSION: &str = "pet-gen-v2";
pub(super) const QUALITY_THRESHOLD: f64 = 75.0;
pub(super) const MAX_CALLS: u32 = 4;

pub(super) fn take_call(used: &mut u32) -> Option<u32> {
    if *used >= MAX_CALLS {
        None
    } else {
        *used += 1;
        Some(*used)
    }
}

const MOTION_PRESETS: [&str; 7] = [
    "waddle", "trot", "bound", "scuttle", "slither", "float", "sway",
];
const REACTION_PROFILES: [&str; 5] = ["sunny", "shy", "cool", "sleepy", "mischievous"];

#[derive(Clone, Debug)]
pub(super) struct DiversitySample {
    pub recipe_key: String,
    pub prototype: String,
    pub archetype: String,
    pub hero_feature: String,
    pub palette_family: String,
    pub face_signature: String,
    pub motion_preset: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ConceptBatch {
    pub candidates: Vec<ConceptCandidate>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct ConceptCandidate {
    pub id: String,
    pub name_zh: String,
    pub name_en: String,
    pub desc: String,
    pub desc_en: String,
    pub prototype: String,
    pub archetype: String,
    pub hero_feature: String,
    pub hero_part: String,
    pub personality: String,
    pub palette_family: String,
    pub eyes: String,
    #[serde(default)]
    pub iris: Option<String>,
    #[serde(default)]
    pub mouth_style: Option<String>,
    pub motion_preset: String,
    pub reaction_profile: String,
    pub front_pose: String,
    pub side_pose: String,
    pub lie_pose: String,
    pub tool_id: String,
}

impl ConceptCandidate {
    fn face_signature(&self) -> String {
        format!(
            "{}+{}",
            self.eyes,
            self.mouth_style.as_deref().unwrap_or("beak")
        )
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct QualityReport {
    pub total_score: f64,
    pub silhouette: f64,
    pub face_readability: f64,
    pub pose_difference: f64,
    pub palette: f64,
    pub hero_feature: f64,
    pub fatal_issues: Vec<String>,
    pub issues: Vec<String>,
}

impl QualityReport {
    pub(super) fn passed(&self) -> bool {
        self.total_score >= QUALITY_THRESHOLD && self.fatal_issues.is_empty()
    }

    pub(super) fn feedback(&self) -> String {
        let mut issues = self.fatal_issues.clone();
        issues.extend(self.issues.clone());
        format!(
            "审美质量分 {:.1}/100（剪影 {:.1}/30，脸部 {:.1}/25，三视图 {:.1}/20，配色 {:.1}/15，招牌特征 {:.1}/10）。必须逐项修复：{}",
            self.total_score,
            self.silhouette,
            self.face_readability,
            self.pose_difference,
            self.palette,
            self.hero_feature,
            issues.join("；")
        )
    }
}

pub(super) fn enabled() -> bool {
    !matches!(
        std::env::var("GULUGULU_FUSION_PIPELINE")
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase()
            .as_str(),
        "v1" | "1" | "legacy"
    )
}

pub(super) fn concept_schema() -> Value {
    let string = || json!({"type": "string"});
    let nullable_string = || json!({"type": ["string", "null"]});
    let archetypes = BODY_ARCHETYPES
        .iter()
        .map(|(name, _, _)| *name)
        .collect::<Vec<_>>();
    let eyes = catalog().eyes.clone();
    let mouths = catalog().mouth_styles.clone();
    let tools = catalog().tools.keys().cloned().collect::<Vec<_>>();
    json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "additionalProperties": false,
        "required": ["candidates"],
        "properties": {
            "candidates": {
                "type": "array",
                "minItems": 3,
                "maxItems": 3,
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": [
                        "id", "nameZh", "nameEn", "desc", "descEn", "prototype",
                        "archetype", "heroFeature", "heroPart", "personality",
                        "paletteFamily", "eyes", "iris", "mouthStyle", "motionPreset",
                        "reactionProfile", "frontPose", "sidePose", "liePose", "toolId"
                    ],
                    "properties": {
                        "id": string(), "nameZh": string(), "nameEn": string(),
                        "desc": string(), "descEn": string(), "prototype": string(),
                        "archetype": {"enum": archetypes},
                        "heroFeature": string(),
                        "heroPart": {"enum": ["body", "head", "tail", "headTop", "arm", "wing", "flipper", "muzzle", "decor"]},
                        "personality": string(), "paletteFamily": string(),
                        "eyes": {"enum": eyes},
                        "iris": nullable_string(),
                        "mouthStyle": {"anyOf": [{"enum": mouths}, {"type": "null"}]},
                        "motionPreset": {"enum": MOTION_PRESETS},
                        "reactionProfile": {"enum": REACTION_PROFILES},
                        "frontPose": string(), "sidePose": string(), "liePose": string(),
                        "toolId": {"enum": tools}
                    }
                }
            }
        }
    })
}

pub(super) fn art_schema() -> Value {
    let painted = |properties: Value, required: Vec<&str>| {
        let mut required = required;
        required.extend(["fill", "stroke", "strokeWidth"]);
        json!({
            "type": "object",
            "additionalProperties": false,
            "required": required,
            "properties": properties
        })
    };
    let paint = || {
        json!({
            "fill": {"type": "string"},
            "stroke": {"type": "string"},
            "strokeWidth": {"type": "number"}
        })
    };
    let with_paint = |mut geometry: serde_json::Map<String, Value>| {
        geometry.extend(paint().as_object().expect("paint object").clone());
        Value::Object(geometry)
    };
    let shape = json!({
        "anyOf": [
            painted(
                with_paint(
                    [
                        (
                            "type".to_string(),
                            json!({"type": "string", "const": "path"}),
                        ),
                        ("d".to_string(), json!({"type": "string"})),
                    ]
                    .into_iter()
                    .collect()
                ),
                vec!["type", "d"]
            ),
            painted(
                with_paint(
                    [
                        (
                            "type".to_string(),
                            json!({"type": "string", "const": "circle"}),
                        ),
                        ("cx".to_string(), json!({"type": "number"})),
                        ("cy".to_string(), json!({"type": "number"})),
                        ("r".to_string(), json!({"type": "number"})),
                    ]
                    .into_iter()
                    .collect()
                ),
                vec!["type", "cx", "cy", "r"]
            ),
            painted(
                with_paint(
                    [
                        (
                            "type".to_string(),
                            json!({"type": "string", "const": "ellipse"}),
                        ),
                        ("cx".to_string(), json!({"type": "number"})),
                        ("cy".to_string(), json!({"type": "number"})),
                        ("rx".to_string(), json!({"type": "number"})),
                        ("ry".to_string(), json!({"type": "number"})),
                    ]
                    .into_iter()
                    .collect()
                ),
                vec!["type", "cx", "cy", "rx", "ry"]
            ),
            painted(
                with_paint(
                    [
                        (
                            "type".to_string(),
                            json!({"type": "string", "const": "rect"}),
                        ),
                        ("x".to_string(), json!({"type": "number"})),
                        ("y".to_string(), json!({"type": "number"})),
                        ("width".to_string(), json!({"type": "number"})),
                        ("height".to_string(), json!({"type": "number"})),
                    ]
                    .into_iter()
                    .collect()
                ),
                vec!["type", "x", "y", "width", "height"]
            ),
            painted(
                with_paint(
                    [
                        (
                            "type".to_string(),
                            json!({"type": "string", "const": "polygon"}),
                        ),
                        ("points".to_string(), json!({"type": "string"})),
                    ]
                    .into_iter()
                    .collect()
                ),
                vec!["type", "points"]
            ),
            painted(
                with_paint(
                    [
                        (
                            "type".to_string(),
                            json!({"type": "string", "const": "line"}),
                        ),
                        ("x1".to_string(), json!({"type": "number"})),
                        ("y1".to_string(), json!({"type": "number"})),
                        ("x2".to_string(), json!({"type": "number"})),
                        ("y2".to_string(), json!({"type": "number"})),
                    ]
                    .into_iter()
                    .collect()
                ),
                vec!["type", "x1", "y1", "x2", "y2"]
            )
        ]
    });
    let nullable_number = || json!({"type": ["number", "null"]});
    let nullable_nodes = || {
        json!({
            "anyOf": [
                {"type": "array", "items": shape.clone()},
                {"type": "null"}
            ]
        })
    };
    let anchor = json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["x", "y", "rot"],
        "properties": {
            "x": nullable_number(),
            "y": nullable_number(),
            "rot": nullable_number()
        }
    });
    let nullable_anchor = || json!({"anyOf": [anchor.clone(), {"type": "null"}]});
    let face = json!({
        "type": "object",
        "additionalProperties": false,
        "required": [
            "eyeR", "eyeDx", "eyeCx", "eyeDy",
            "mouthDx", "mouthDy", "mouthW", "mouth"
        ],
        "properties": {
            "eyeR": {"type": "number"},
            "eyeDx": nullable_number(),
            "eyeCx": nullable_number(),
            "eyeDy": nullable_number(),
            "mouthDx": nullable_number(),
            "mouthDy": nullable_number(),
            "mouthW": nullable_number(),
            "mouth": {"anyOf": [{"enum": ["engine", "beak"]}, {"type": "null"}]}
        }
    });
    let view = json!({
        "type": "object",
        "additionalProperties": false,
        "required": [
            "body", "bodyY", "head", "headY", "headX", "face",
            "muzzle", "belly", "armL", "armR", "armY", "armSpread",
            "legL", "legR", "legY", "legSpread", "tail", "tailAt",
            "headTop", "headTopAt", "decor", "toolAt"
        ],
        "properties": {
            "body": {"type": "array", "items": shape.clone()},
            "bodyY": nullable_number(),
            "head": {"type": "array", "items": shape.clone()},
            "headY": {"type": "number"},
            "headX": nullable_number(),
            "face": face,
            "muzzle": nullable_nodes(),
            "belly": nullable_nodes(),
            "armL": nullable_nodes(),
            "armR": nullable_nodes(),
            "armY": nullable_number(),
            "armSpread": nullable_number(),
            "legL": nullable_nodes(),
            "legR": nullable_nodes(),
            "legY": nullable_number(),
            "legSpread": nullable_number(),
            "tail": nullable_nodes(),
            "tailAt": nullable_anchor(),
            "headTop": nullable_nodes(),
            "headTopAt": nullable_anchor(),
            "decor": nullable_nodes(),
            "toolAt": nullable_anchor()
        }
    });
    let work_particle_refs = catalog()
        .work_particles
        .iter()
        .map(|particle| particle.id.clone())
        .collect::<Vec<_>>();
    let eyes = catalog().eyes.clone();
    let mouths = catalog().mouth_styles.clone();
    let tools = catalog().tools.keys().cloned().collect::<Vec<_>>();
    let palette_schema = json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["body", "deep", "belly", "accent", "accent2"],
        "properties": {
            "body": {"type": "string"},
            "deep": {"type": "string"},
            "belly": {"type": "string"},
            "accent": {"type": "string"},
            "accent2": {"type": ["string", "null"]}
        }
    });
    let rig_schema = json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["front", "side", "lie", "floating"],
        "properties": {
            "front": view.clone(),
            "side": view.clone(),
            "lie": view,
            "floating": {"type": "boolean"}
        }
    });
    let drawn_particle = json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["nodes"],
        "properties": {
            "nodes": {
                "type": "array",
                "minItems": 1,
                "maxItems": 4,
                "items": shape
            }
        }
    });
    let referenced_particle = json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["ref"],
        "properties": {"ref": {"enum": work_particle_refs}}
    });
    let work_fx_schema = json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["particles"],
        "properties": {
            "particles": {
                "type": "array",
                "minItems": 2,
                "maxItems": 3,
                "items": {"anyOf": [drawn_particle, referenced_particle]}
            }
        }
    });
    let slots_schema = json!({
        "type": "object",
        "additionalProperties": false,
        "required": [],
        "properties": {}
    });
    json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "additionalProperties": false,
        "required": [
            "nameZh", "nameEn", "desc", "descEn", "prototype", "scale", "palette",
            "eyes", "iris", "mouthStyle", "motionPreset", "reactionProfile",
            "toolId", "customRig", "workFx", "slots"
        ],
        "properties": {
            "nameZh": {"type": "string"},
            "nameEn": {"type": "string"},
            "desc": {"type": "string"},
            "descEn": {"type": "string"},
            "prototype": {"type": "string"},
            "scale": {"type": "number"},
            "palette": palette_schema,
            "eyes": {"enum": eyes},
            "iris": {"type": ["string", "null"]},
            "mouthStyle": {"anyOf": [{"enum": mouths}, {"type": "null"}]},
            "motionPreset": {"enum": MOTION_PRESETS},
            "reactionProfile": {"enum": REACTION_PROFILES},
            "toolId": {"enum": tools},
            "customRig": rig_schema,
            "workFx": work_fx_schema,
            "slots": slots_schema
        }
    })
}

fn underrepresented_archetypes(history: &[DiversitySample]) -> String {
    let mut counts: Vec<(&str, usize)> = BODY_ARCHETYPES
        .iter()
        .map(|(name, _, _)| {
            (
                *name,
                history
                    .iter()
                    .filter(|sample| sample.archetype == *name)
                    .count(),
            )
        })
        .collect();
    counts.sort_by_key(|(_, count)| *count);
    counts
        .into_iter()
        .take(5)
        .map(|(name, _)| name)
        .collect::<Vec<_>>()
        .join("、")
}

pub(super) fn build_concept_prompt(inputs: &PromptInputs) -> String {
    let archetype_menu = BODY_ARCHETYPES
        .iter()
        .map(|(name, shape, _)| format!("{name}（{shape}）"))
        .collect::<Vec<_>>()
        .join("；");
    let recent = inputs
        .history
        .iter()
        .map(|s| {
            format!(
                "{} / {} / {} / {} / {}",
                s.prototype, s.archetype, s.hero_feature, s.face_signature, s.palette_family
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let tools = catalog()
        .tools
        .keys()
        .cloned()
        .collect::<Vec<_>>()
        .join("/");
    format!(
        r#"[{version}｜Gulugulu 自有美术风格]
为桌面陪伴游戏设计幼态、自然、有生命感的原创宠物。优先级唯一且固定：
可爱与可读性 > 自然原型 > 招牌辨识度 > 简洁装饰。
轮廓先于花纹，表情先于特效；不要使用任何第三方角色或作品类比。
双亲只提供元素气质：保留一个可辨认的双亲视觉线索，但形态必须锚定真实动物/植物。

[概念任务]
一次提出恰好 3 个轻量候选，不画 SVG。三个候选的 prototype、archetype、脸型组合必须互不重复，
招牌特征必须能进入剪影，不能只是额头宝石或身边光点。优先补足收藏中欠缺的体型。
候选体型菜单：{archetype_menu}
当前最欠缺：{underrepresented}

双亲 A：{a_code}「{a_name}」元素={a_elements}，设定={a_desc}
双亲 B：{b_code}「{b_name}」元素={b_elements}，设定={b_desc}
当前配方：{recipe}
最近 12 个 AI 设计（请避开重复；同配方重复尤其不可接受）：
{recent}

[脸部契约]
eyes 只能是 {eyes}；mouthStyle 只能是 {mouths} 或 null（硬喙/长吻）；
iris 使用 $accent/$deep/$accent2 或 #rrggbb。眼型、嘴型与性格要共同塑造人设。

[运动与反应]
motionPreset 只能是 waddle/trot/bound/scuttle/slither/float/sway；
reactionProfile 只能是 sunny/shy/cool/sleepy/mischievous。
三段姿态说明必须明确正视、向右 90° 侧视、合理蜷卧睡姿的结构差异。

[工具粒子契约]
toolId 只能是 {tools}；选择与角色职业想象和元素气质自然匹配的实物工具。
heroPart 只能是 body/head/tail/headTop/arm/wing/flipper/muzzle/decor，不能写部件描述。

只返回符合 JSON Schema 的对象。中文名 2~6 字且不要叠字；英文名自然可读。"#,
        version = PROMPT_VERSION,
        archetype_menu = archetype_menu,
        underrepresented = underrepresented_archetypes(&inputs.history),
        a_code = inputs.parent_a.0,
        a_name = inputs.parent_a.1.name_zh,
        a_elements = inputs.parent_a.1.elements.join("+"),
        a_desc = inputs.parent_a.1.desc,
        b_code = inputs.parent_b.0,
        b_name = inputs.parent_b.1.name_zh,
        b_elements = inputs.parent_b.1.elements.join("+"),
        b_desc = inputs.parent_b.1.desc,
        recipe = inputs.recipe_key,
        recent = if recent.is_empty() {
            "暂无".to_string()
        } else {
            recent
        },
        eyes = catalog().eyes.join("/"),
        mouths = catalog().mouth_styles.join("/"),
        tools = tools,
    )
}

pub(super) fn parse_and_validate_concepts(raw: &str) -> Result<ConceptBatch, String> {
    let mut batch: ConceptBatch =
        serde_json::from_str(raw).map_err(|e| format!("概念 JSON 无法解析：{e}"))?;
    if batch.candidates.len() != 3 {
        return Err("概念阶段必须恰好返回 3 个候选".to_string());
    }
    let archetypes: BTreeSet<_> = BODY_ARCHETYPES.iter().map(|a| a.0).collect();
    let mut ids = BTreeSet::new();
    let mut prototypes = BTreeSet::new();
    let mut shapes = BTreeSet::new();
    let mut faces = BTreeSet::new();
    let trim = |value: &mut String| *value = value.trim().to_string();
    for candidate in &mut batch.candidates {
        for value in [
            &mut candidate.id,
            &mut candidate.name_zh,
            &mut candidate.name_en,
            &mut candidate.desc,
            &mut candidate.desc_en,
            &mut candidate.prototype,
            &mut candidate.archetype,
            &mut candidate.hero_feature,
            &mut candidate.hero_part,
            &mut candidate.personality,
            &mut candidate.palette_family,
            &mut candidate.eyes,
            &mut candidate.motion_preset,
            &mut candidate.reaction_profile,
            &mut candidate.front_pose,
            &mut candidate.side_pose,
            &mut candidate.lie_pose,
            &mut candidate.tool_id,
        ] {
            trim(value);
        }
        candidate.iris = candidate.iris.take().map(|value| value.trim().to_string());
        candidate.mouth_style = candidate
            .mouth_style
            .take()
            .map(|value| value.trim().to_string());
        candidate.name_en = sanitize_en_name(&candidate.name_en).unwrap_or_default();
        if !ids.insert(candidate.id.clone())
            || !prototypes.insert(candidate.prototype.clone())
            || !shapes.insert(candidate.archetype.clone())
            || !faces.insert(candidate.face_signature())
        {
            return Err("三个概念的 id、真实原型、体型和脸型组合必须互不重复".to_string());
        }
        if !archetypes.contains(candidate.archetype.as_str()) {
            return Err(format!("未知体型：{}", candidate.archetype));
        }
        let name_chars: Vec<char> = candidate.name_zh.chars().collect();
        if !(2..=6).contains(&name_chars.len())
            || !has_cjk(&candidate.name_zh)
            || name_chars.windows(2).any(|pair| pair[0] == pair[1])
            || sanitize_en_name(&candidate.name_en).is_none()
            || candidate.desc.trim().is_empty()
        {
            return Err(
                "概念名或设定不合格：中文名需 2~6 字且不叠字，并提供英文名与设定".to_string(),
            );
        }
        if !catalog().eyes.contains(&candidate.eyes) {
            return Err(format!("未知眼型：{}", candidate.eyes));
        }
        if candidate
            .mouth_style
            .as_ref()
            .is_some_and(|m| !catalog().mouth_styles.contains(m))
        {
            return Err(format!("未知嘴型：{:?}", candidate.mouth_style));
        }
        if !MOTION_PRESETS.contains(&candidate.motion_preset.as_str())
            || !REACTION_PROFILES.contains(&candidate.reaction_profile.as_str())
        {
            return Err("未知动作预设或反应性格".to_string());
        }
        if !catalog().tools.contains_key(&candidate.tool_id) {
            return Err(format!("未知工具：{}", candidate.tool_id));
        }
        if ![
            "body", "head", "tail", "headTop", "arm", "wing", "flipper", "muzzle", "decor",
        ]
        .contains(&candidate.hero_part.as_str())
        {
            return Err(format!("未知招牌部件：{}", candidate.hero_part));
        }
        if candidate.hero_feature.trim().chars().count() < 2
            || candidate.prototype.trim().chars().count() < 2
        {
            return Err("原型和招牌特征必须具体可读".to_string());
        }
    }
    Ok(batch)
}

fn novelty_score(
    value: &str,
    history: &[DiversitySample],
    recipe: &str,
    get: fn(&DiversitySample) -> &str,
    max: f64,
) -> f64 {
    let all = history.iter().filter(|sample| get(sample) == value).count() as f64;
    let same_recipe = history
        .iter()
        .filter(|sample| sample.recipe_key == recipe && get(sample) == value)
        .count() as f64;
    (max - all * (max * 0.18) - same_recipe * (max * 0.36)).max(0.0)
}

pub(super) fn select_concept(
    batch: &ConceptBatch,
    inputs: &PromptInputs,
) -> Result<ConceptCandidate, String> {
    let score = |candidate: &ConceptCandidate| {
        novelty_score(
            &candidate.prototype,
            &inputs.history,
            &inputs.recipe_key,
            |s| &s.prototype,
            20.0,
        ) + novelty_score(
            &candidate.archetype,
            &inputs.history,
            &inputs.recipe_key,
            |s| &s.archetype,
            20.0,
        ) + novelty_score(
            &candidate.hero_feature,
            &inputs.history,
            &inputs.recipe_key,
            |s| &s.hero_feature,
            20.0,
        ) + novelty_score(
            &candidate.face_signature(),
            &inputs.history,
            &inputs.recipe_key,
            |s| &s.face_signature,
            15.0,
        ) + novelty_score(
            &candidate.palette_family,
            &inputs.history,
            &inputs.recipe_key,
            |s| &s.palette_family,
            15.0,
        ) + novelty_score(
            &format!("{}+{}", candidate.motion_preset, candidate.personality),
            &inputs.history,
            &inputs.recipe_key,
            |s| &s.motion_preset,
            10.0,
        )
    };
    batch
        .candidates
        .iter()
        .filter(|candidate| {
            !inputs.history.iter().any(|sample| {
                sample.recipe_key == inputs.recipe_key && sample.prototype == candidate.prototype
            })
        })
        .enumerate()
        .max_by(|(ia, a), (ib, b)| {
            score(a)
                .partial_cmp(&score(b))
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| {
                    ((inputs.seed as usize + *ib) % 3).cmp(&((inputs.seed as usize + *ia) % 3))
                })
        })
        .map(|(_, candidate)| candidate.clone())
        .ok_or_else(|| "三个候选都重复了当前配方已有的真实原型，请重新构思".to_string())
}

pub(super) fn build_art_prompt(
    inputs: &PromptInputs,
    concept: &ConceptCandidate,
    repair: Option<(&QualityReport, &str)>,
) -> String {
    let concept_json = serde_json::to_string_pretty(concept).unwrap_or_default();
    let repair_block = repair
        .map(|(report, prior)| {
            format!(
                "\n[定向修稿]\n{}\n保留胜出概念，只修改导致问题的几何、构图或配色。上稿 JSON：\n{}",
                report.feedback(),
                prior
            )
        })
        .unwrap_or_default();
    let particle_ids = catalog()
        .work_particles
        .iter()
        .map(|item| item.id.as_str())
        .collect::<Vec<_>>()
        .join("/");
    format!(
        r#"[{version}｜Gulugulu 自有美术风格]
把下面已选定的概念绘制成自然、幼态、可读的原创桌面宠物。此阶段不再改原型、体型、名字、
招牌特征、脸型、动作或工具。优先级：可爱与可读性 > 自然原型 > 招牌辨识度 > 简洁装饰。
平涂、深棕统一描边；2~3 个大色块；不要第三方 IP 类比，不要默认圆头+圆身两球拓扑。

[胜出概念]
{concept_json}

[三视图几何契约]
画布 256×256。customRig.front/side/lie 必须分别绘制，不能复制：
- front 正对镜头、左右结构清楚；side 向右转 90°，单眼、头口鼻向右、近侧附肢；
- lie 是身体贴地、头有承托的合理蜷卧，不能把站姿纵向压扁。
body 局部原点摆在 (128,bodyY≈185)，head 局部原点摆在 (headX,headY)；
side 的 headX 通常约 145~165。部件用局部坐标，decor 才用绝对坐标。
ShapeNode 仅允许 path/circle/ellipse/rect/polygon/line。局部示例只说明语法：
{{"type":"ellipse","cx":0,"cy":0,"rx":42,"ry":34,"fill":"$body","stroke":"$outline","strokeWidth":5}}
每部件不超过 24 节点，每视图不超过 170 节点，所有形状完整留在画布内。
招牌特征「{hero}」必须落实到 heroPart={hero_part}，三视图都可识别并影响剪影。

[脸部契约]
eyes={eyes}，iris={iris}，mouthStyle={mouth}; 原样输出。
眼和软嘴只由引擎依据 face 参数绘制：head/muzzle/decor 禁止再画眼珠、瞳孔、软嘴或笑线。
face.eyeR 7~14；front/lie 用 eyeDx 双眼；side 用 eyeCx 单眼。
硬喙/长吻才设 face.mouth="beak" 并在 muzzle 自绘；否则 mouth="engine"。
装饰不得遮眼嘴；脸的浅色区域和主体要有明确明度对比。

[工具粒子契约]
toolId={tool} 原样输出。workFx.particles 恰好 2~3 个，每个用 nodes 或 ref 二选一，
至少一个是 1~4 节点的自绘实物；ref 只能是：{particle_ids}。
工具、粒子和角色职业想象一致，不能只画抽象光点。

[输出契约]
只返回 Schema 对象。必须输出 nameZh/nameEn/desc/descEn/prototype/scale/palette/eyes/iris/
mouthStyle/motionPreset/reactionProfile/toolId/customRig/workFx/slots。
prototype、名字、eyes、iris、mouthStyle、motionPreset、reactionProfile、toolId 必须与胜出概念完全一致。
scale 1.05~1.25。palette 的 body/deep/belly/accent/accent2 使用 #rrggbb；
节点 fill/stroke 可使用 $body/$deep/$belly/$accent/$accent2/$outline 或 #rrggbb。
父母元素仅作一个清晰视觉线索：{a_elements} + {b_elements}。{repair_block}"#,
        version = PROMPT_VERSION,
        concept_json = concept_json,
        hero = concept.hero_feature,
        hero_part = concept.hero_part,
        eyes = concept.eyes,
        iris = concept.iris.as_deref().unwrap_or("null"),
        mouth = concept
            .mouth_style
            .as_deref()
            .unwrap_or("null（硬喙/长吻）"),
        tool = concept.tool_id,
        particle_ids = particle_ids,
        a_elements = inputs.parent_a.1.elements.join("+"),
        b_elements = inputs.parent_b.1.elements.join("+"),
        repair_block = repair_block,
    )
}

pub(super) fn enforce_concept(
    design: &mut ValidatedDesign,
    concept: &ConceptCandidate,
) -> Result<(), String> {
    if design.prototype.as_deref() != Some(concept.prototype.as_str()) {
        return Err("绘制稿擅自改变了胜出概念的 prototype".to_string());
    }
    if design.name_zh != concept.name_zh
        || design.name_en != concept.name_en
        || design.visual.eyes.as_deref() != Some(concept.eyes.as_str())
        || design.visual.iris != concept.iris
        || design.visual.mouth_style != concept.mouth_style
        || design.visual.motion_preset.as_deref() != Some(concept.motion_preset.as_str())
        || design.visual.reaction_profile.as_deref() != Some(concept.reaction_profile.as_str())
        || design.visual.tool_id.as_deref() != Some(concept.tool_id.as_str())
    {
        return Err("绘制稿擅自改变了胜出概念的名字、脸型、动作、性格或工具".to_string());
    }
    design.visual.motion_preset = Some(concept.motion_preset.clone());
    design.visual.reaction_profile = Some(concept.reaction_profile.clone());
    Ok(())
}

fn union_bbox(nodes: &[ShapeNode], offset: (f64, f64), bbox: &mut Option<(f64, f64, f64, f64)>) {
    for node in nodes {
        let Some((x0, y0, x1, y1)) = node_bbox(node) else {
            continue;
        };
        let b = (x0 + offset.0, y0 + offset.1, x1 + offset.0, y1 + offset.1);
        *bbox = Some(match *bbox {
            Some(old) => (
                old.0.min(b.0),
                old.1.min(b.1),
                old.2.max(b.2),
                old.3.max(b.3),
            ),
            None => b,
        });
    }
}

fn view_bbox(view: &RigViewParts, side_mode: bool) -> Option<(f64, f64, f64, f64)> {
    let mut bbox = None;
    let body_y = view.body_y.unwrap_or(185.0);
    let head_x = view.head_x.unwrap_or(128.0);
    let arm_y = view.arm_y.unwrap_or(body_y - 8.0);
    let arm_spread = view.arm_spread.unwrap_or(54.0);
    let leg_y = view.leg_y.unwrap_or(224.0);
    let leg_spread = view.leg_spread.unwrap_or(22.0);
    union_bbox(&view.body, (128.0, body_y), &mut bbox);
    union_bbox(&view.head, (head_x, view.head_y), &mut bbox);
    if let Some(nodes) = &view.muzzle {
        union_bbox(nodes, (head_x, view.head_y), &mut bbox);
    }
    if let Some(nodes) = &view.belly {
        union_bbox(nodes, (128.0, body_y), &mut bbox);
    }
    if side_mode {
        if let Some(nodes) = view.arm_r.as_ref().or(view.arm_l.as_ref()) {
            union_bbox(nodes, (128.0 + arm_spread.min(18.0), arm_y), &mut bbox);
        }
    } else {
        if let Some(nodes) = &view.arm_l {
            union_bbox(nodes, (128.0 - arm_spread, arm_y), &mut bbox);
            if view.arm_r.is_none() {
                union_bbox(nodes, (128.0 + arm_spread, arm_y), &mut bbox);
            }
        }
        if let Some(nodes) = &view.arm_r {
            union_bbox(nodes, (128.0 + arm_spread, arm_y), &mut bbox);
        }
    }
    if let Some(nodes) = &view.leg_l {
        union_bbox(nodes, (128.0 - leg_spread, leg_y), &mut bbox);
        if view.leg_r.is_none() {
            union_bbox(nodes, (128.0 + leg_spread, leg_y), &mut bbox);
        }
    }
    if let Some(nodes) = &view.leg_r {
        union_bbox(nodes, (128.0 + leg_spread, leg_y), &mut bbox);
    }
    if let Some(nodes) = &view.tail {
        let anchor = view.tail_at.as_ref();
        union_bbox(
            nodes,
            (
                anchor.and_then(|a| a.x).unwrap_or(72.0),
                anchor.and_then(|a| a.y).unwrap_or(body_y),
            ),
            &mut bbox,
        );
    }
    if let Some(nodes) = &view.head_top {
        let anchor = view.head_top_at.as_ref();
        union_bbox(
            nodes,
            (
                anchor.and_then(|a| a.x).unwrap_or(head_x),
                anchor.and_then(|a| a.y).unwrap_or(view.head_y - 30.0),
            ),
            &mut bbox,
        );
    }
    if let Some(nodes) = &view.decor {
        union_bbox(nodes, (0.0, 0.0), &mut bbox);
    }
    bbox
}

fn scaled_bbox(bbox: (f64, f64, f64, f64), scale: f64) -> (f64, f64, f64, f64) {
    let transform_x = |x: f64| 128.0 + (x - 128.0) * scale;
    let transform_y = |y: f64| 233.0 + (y - 233.0) * scale;
    (
        transform_x(bbox.0),
        transform_y(bbox.1),
        transform_x(bbox.2),
        transform_y(bbox.3),
    )
}

fn nodes_equal(a: &[ShapeNode], b: &[ShapeNode]) -> bool {
    serde_json::to_value(a).ok() == serde_json::to_value(b).ok()
}

fn topology_equal(a: &[ShapeNode], b: &[ShapeNode]) -> bool {
    a.len() == b.len()
        && a.iter()
            .zip(b)
            .all(|(left, right)| left.node_type == right.node_type)
}

fn circular_two_ball(view: &RigViewParts) -> bool {
    let simple_round = |nodes: &[ShapeNode]| {
        nodes.len() <= 3
            && nodes
                .first()
                .is_some_and(|n| matches!(n.node_type.as_str(), "circle" | "ellipse"))
    };
    simple_round(&view.body) && simple_round(&view.head)
}

fn parse_hex(hex: &str) -> Option<(f64, f64, f64)> {
    if hex.len() != 7 || !hex.starts_with('#') {
        return None;
    }
    Some((
        u8::from_str_radix(&hex[1..3], 16).ok()? as f64 / 255.0,
        u8::from_str_radix(&hex[3..5], 16).ok()? as f64 / 255.0,
        u8::from_str_radix(&hex[5..7], 16).ok()? as f64 / 255.0,
    ))
}

fn luminance(hex: &str) -> Option<f64> {
    let (r, g, b) = parse_hex(hex)?;
    let linear = |v: f64| {
        if v <= 0.04045 {
            v / 12.92
        } else {
            ((v + 0.055) / 1.055).powf(2.4)
        }
    };
    Some(0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b))
}

fn part_present(view: &RigViewParts, part: &str) -> bool {
    match part {
        "body" => !view.body.is_empty(),
        "head" => !view.head.is_empty(),
        "tail" => view.tail.as_ref().is_some_and(|v| !v.is_empty()),
        "headTop" => view.head_top.as_ref().is_some_and(|v| !v.is_empty()),
        "arm" | "wing" | "flipper" => view.arm_l.as_ref().is_some_and(|v| !v.is_empty()),
        "muzzle" => view.muzzle.as_ref().is_some_and(|v| !v.is_empty()),
        "decor" => view.decor.as_ref().is_some_and(|v| !v.is_empty()),
        _ => false,
    }
}

pub(super) fn assess_quality(
    design: &ValidatedDesign,
    concept: &ConceptCandidate,
) -> QualityReport {
    let mut fatal = Vec::new();
    let mut issues = Vec::new();
    let Some(rig) = design.visual.custom_rig.as_ref() else {
        return QualityReport {
            total_score: 0.0,
            silhouette: 0.0,
            face_readability: 0.0,
            pose_difference: 0.0,
            palette: 0.0,
            hero_feature: 0.0,
            fatal_issues: vec!["V2 必须提供完整 customRig".to_string()],
            issues,
        };
    };
    let side = rig.side.as_ref().unwrap_or(&rig.front);
    let lie = rig.lie.as_ref().unwrap_or(&rig.front);
    let scale = design.visual.scale;
    let boxes = [
        view_bbox(&rig.front, false).map(|bbox| scaled_bbox(bbox, scale)),
        view_bbox(side, true).map(|bbox| scaled_bbox(bbox, scale)),
        view_bbox(lie, false).map(|bbox| scaled_bbox(bbox, scale)),
    ];
    if boxes
        .iter()
        .flatten()
        .any(|b| b.0 < 4.0 || b.1 < 4.0 || b.2 > 252.0 || b.3 > 252.0)
    {
        fatal.push("存在裁切出界".to_string());
    }

    let front_box = boxes[0].unwrap_or((64.0, 64.0, 192.0, 224.0));
    let front_w = front_box.2 - front_box.0;
    let front_h = front_box.3 - front_box.1;
    let mut silhouette: f64 = 30.0;
    if front_w.max(front_h) < 125.0 {
        silhouette -= 8.0;
        issues.push("正视剪影太小、画布利用不足".to_string());
    }
    if circular_two_ball(&rig.front) {
        silhouette -= 16.0;
        fatal.push("圆形两球默认拓扑".to_string());
    }

    let mut face: f64 = 25.0;
    for (label, view) in [("front", &rig.front), ("side", side), ("lie", lie)] {
        if !(7.0..=14.0).contains(&view.face.eye_r) {
            face -= 5.0;
            issues.push(format!("{label} 眼睛尺寸影响脸部可读性"));
        }
        let hx = view.head_x.unwrap_or(128.0);
        let ey = view.head_y + view.face.eye_dy.unwrap_or(0.0);
        let eyes = if label == "side" {
            vec![(hx + view.face.eye_cx.unwrap_or(0.0), ey)]
        } else {
            let dx = view.face.eye_dx.unwrap_or(12.0);
            vec![(hx - dx, ey), (hx + dx, ey)]
        };
        if let Some(decor) = &view.decor {
            for node in decor {
                if let Some((x0, y0, x1, y1)) = node_bbox(node) {
                    if eyes
                        .iter()
                        .all(|(x, y)| *x >= x0 && *x <= x1 && *y >= y0 && *y <= y1)
                        && has_paint_fill(&node.fill)
                    {
                        fatal.push(format!("{label} 脸部被装饰遮挡"));
                        face -= 8.0;
                        break;
                    }
                }
            }
        }
    }

    let mut pose: f64 = 20.0;
    if nodes_equal(&rig.front.body, &side.body) && nodes_equal(&rig.front.head, &side.head) {
        pose -= 10.0;
        fatal.push("正视与侧视近似复制".to_string());
    }
    if nodes_equal(&rig.front.body, &lie.body) && nodes_equal(&rig.front.head, &lie.head) {
        pose -= 10.0;
        fatal.push("睡姿只是复制或压扁站姿".to_string());
    } else if let Some(lie_box) = boxes[2] {
        let lie_w = lie_box.2 - lie_box.0;
        let lie_h = lie_box.3 - lie_box.1;
        if topology_equal(&rig.front.body, &lie.body)
            && topology_equal(&rig.front.head, &lie.head)
            && lie_w <= front_w * 1.08
            && lie_h < front_h * 0.8
        {
            pose -= 8.0;
            fatal.push("睡姿只是纵向压扁站姿".to_string());
        }
        if lie_w <= front_w * 0.95 && lie_h >= front_h * 0.88 {
            pose -= 6.0;
            issues.push("睡姿横向蜷卧差异不足".to_string());
        }
    }

    let mut palette: f64 = 15.0;
    let colors = &design.visual.palette;
    let body_l = luminance(&colors.body).unwrap_or(0.5);
    let belly_l = luminance(&colors.belly).unwrap_or(body_l);
    let deep_l = luminance(&colors.deep).unwrap_or(body_l);
    if (belly_l - body_l).abs() < 0.12 {
        palette -= 5.0;
        issues.push("脸腹浅色与主体对比不足".to_string());
    }
    if (deep_l - body_l).abs() < 0.08 {
        palette -= 4.0;
        issues.push("阴影色与主体层次不足".to_string());
    }
    let unique: BTreeSet<_> = [
        colors.body.as_str(),
        colors.deep.as_str(),
        colors.belly.as_str(),
        colors.accent.as_str(),
    ]
    .into_iter()
    .collect();
    if unique.len() < 4 {
        palette -= 4.0;
        issues.push("主配色重复过多".to_string());
    }

    let mut hero: f64 = 10.0;
    for (label, view) in [("front", &rig.front), ("side", side), ("lie", lie)] {
        if !part_present(view, &concept.hero_part) {
            hero -= 4.0;
            fatal.push(format!("{label} 缺少招牌部件 {}", concept.hero_part));
        }
    }

    silhouette = silhouette.max(0.0);
    face = face.max(0.0);
    pose = pose.max(0.0);
    palette = palette.max(0.0);
    hero = hero.max(0.0);
    let total = silhouette + face + pose + palette + hero;
    QualityReport {
        total_score: (total * 10.0).round() / 10.0,
        silhouette,
        face_readability: face,
        pose_difference: pose,
        palette,
        hero_feature: hero,
        fatal_issues: fatal,
        issues,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn concept(
        id: &str,
        prototype: &str,
        archetype: &str,
        eyes: &str,
        mouth: &str,
    ) -> ConceptCandidate {
        ConceptCandidate {
            id: id.to_string(),
            name_zh: "栗尾兽".to_string(),
            name_en: "Chestnut Tail".to_string(),
            desc: "一只轻快的小兽".to_string(),
            desc_en: "A nimble little creature.".to_string(),
            prototype: prototype.to_string(),
            archetype: archetype.to_string(),
            hero_feature: format!("{prototype}尾"),
            hero_part: "tail".to_string(),
            personality: "好奇".to_string(),
            palette_family: "湖蓝暖橙".to_string(),
            eyes: eyes.to_string(),
            iris: Some("$accent".to_string()),
            mouth_style: Some(mouth.to_string()),
            motion_preset: "trot".to_string(),
            reaction_profile: "sunny".to_string(),
            front_pose: "正视".to_string(),
            side_pose: "右侧".to_string(),
            lie_pose: "蜷卧".to_string(),
            tool_id: catalog().tools.keys().next().unwrap().clone(),
        }
    }

    #[test]
    fn three_concepts_must_be_distinct() {
        let batch = ConceptBatch {
            candidates: vec![
                concept("a", "水獭", "四足兽", "round", "smile"),
                concept("b", "水獭", "长颈型", "sharp", "flat"),
                concept("c", "海马", "蛇形长条", "droopy", "cat"),
            ],
        };
        let raw = serde_json::to_string(&batch).unwrap();
        assert!(parse_and_validate_concepts(&raw).is_err());
    }

    #[test]
    fn schemas_record_v2_contract() {
        assert_eq!(concept_schema()["properties"]["candidates"]["minItems"], 3);
        assert!(art_schema()["properties"]["motionPreset"]["enum"]
            .as_array()
            .unwrap()
            .iter()
            .any(|v| v == "slither"));
    }

    #[test]
    fn scaled_bbox_accounts_for_the_runtime_foot_pivot() {
        let unchanged = scaled_bbox((64.0, 4.0, 192.0, 224.0), 1.0);
        assert_eq!(unchanged, (64.0, 4.0, 192.0, 224.0));
        let enlarged = scaled_bbox((64.0, 4.0, 192.0, 224.0), 1.14);
        assert!(enlarged.1 < 4.0, "top edge should move out of bounds");
        assert!(enlarged.3 < 224.0, "foot-pivot scaling lifts the bottom");
    }

    #[test]
    fn call_budget_has_a_hard_four_call_ceiling() {
        let mut used = 0;
        assert_eq!(take_call(&mut used), Some(1));
        assert_eq!(take_call(&mut used), Some(2));
        assert_eq!(take_call(&mut used), Some(3));
        assert_eq!(take_call(&mut used), Some(4));
        assert_eq!(take_call(&mut used), None);
    }

    #[test]
    fn v2_is_default_and_v1_can_be_forced() {
        std::env::remove_var("GULUGULU_FUSION_PIPELINE");
        assert!(enabled());
        std::env::set_var("GULUGULU_FUSION_PIPELINE", "v1");
        assert!(!enabled());
        std::env::remove_var("GULUGULU_FUSION_PIPELINE");
    }

    fn view(body: Value, head: Value, head_x: f64, head_y: f64, tail: bool) -> RigViewParts {
        serde_json::from_value(json!({
            "body": body,
            "bodyY": 180,
            "head": head,
            "headX": head_x,
            "headY": head_y,
            "face": {"eyeR": 10, "eyeDx": 13, "eyeCx": 2, "mouthDy": 18, "mouthW": 17},
            "tail": if tail {
                json!([{"type":"path","d":"M 0 0 Q -24 -16 -34 8","fill":"$accent","stroke":"$outline","strokeWidth":5}])
            } else {
                json!([])
            },
            "tailAt": {"x": 76, "y": 178, "rot": 0}
        }))
        .unwrap()
    }

    fn design_with_rig(rig: CustomRig, palette: CustomPalette) -> ValidatedDesign {
        ValidatedDesign {
            codename_hint: None,
            name_zh: "栗尾兽".to_string(),
            name_en: "Chestnut Tail".to_string(),
            desc: "一只轻快的小兽".to_string(),
            desc_en: "A nimble little creature.".to_string(),
            prototype: Some("水獭".to_string()),
            visual: CustomVisualSpec {
                rig: "custom".to_string(),
                scale: 1.1,
                palette,
                eyes: Some("round".to_string()),
                iris: Some("$accent".to_string()),
                mouth_style: Some("smile".to_string()),
                motion_preset: Some("trot".to_string()),
                reaction_profile: Some("sunny".to_string()),
                tool_id: None,
                floating: false,
                slots: BTreeMap::new(),
                form: None,
                custom_rig: Some(rig),
                work_fx: None,
            },
            design_meta: None,
        }
    }

    fn quality_concept() -> ConceptCandidate {
        let mut c = concept("a", "水獭", "四足兽", "round", "smile");
        c.hero_feature = "桨形大尾".to_string();
        c.hero_part = "tail".to_string();
        c
    }

    fn prompt_inputs(history: Vec<DiversitySample>) -> PromptInputs {
        let species = |name: &str, element: &str| SpeciesInfo {
            name_zh: name.to_string(),
            name_en: String::new(),
            tier: 1,
            elements: vec![element.to_string()],
            colors: vec!["#4488AA".to_string()],
            body: "fox".to_string(),
            desc: "亲切活泼".to_string(),
            desc_en: String::new(),
            steam_item_def: 0,
        };
        PromptInputs {
            parent_a: ("parent-a".to_string(), species("风尾兽", "wind")),
            parent_b: ("parent-b".to_string(), species("水芽兽", "water")),
            taken: BTreeSet::new(),
            seed: 17,
            recipe_key: "water+wind".to_string(),
            history,
        }
    }

    #[test]
    fn same_recipe_repetition_loses_to_a_novel_concept() {
        let repeated = DiversitySample {
            recipe_key: "water+wind".to_string(),
            prototype: "水獭".to_string(),
            archetype: "四足兽".to_string(),
            hero_feature: "桨形大尾".to_string(),
            palette_family: "湖蓝暖橙".to_string(),
            face_signature: "round+smile".to_string(),
            motion_preset: "trot+好奇".to_string(),
        };
        let mut a = concept("a", "水獭", "四足兽", "round", "smile");
        a.hero_feature = "桨形大尾".to_string();
        let b = concept("b", "蜂鸟", "飞鸟带翼", "sharp", "flat");
        let c = concept("c", "海马", "蛇形长条", "droopy", "cat");
        let batch = ConceptBatch {
            candidates: vec![a, b, c],
        };
        let selected = select_concept(&batch, &prompt_inputs(vec![repeated])).unwrap();
        assert_ne!(selected.prototype, "水獭");
    }

    #[test]
    fn v2_prompts_use_own_style_and_no_third_party_anchors() {
        let inputs = prompt_inputs(Vec::new());
        let concept = quality_concept();
        let prompts = format!(
            "{}\n{}",
            build_concept_prompt(&inputs),
            build_art_prompt(&inputs, &concept, None)
        );
        assert!(prompts.contains(PROMPT_VERSION));
        assert!(!prompts.contains("宝可梦"));
        assert!(!prompts.contains("数码宝贝"));
        assert!(!prompts.contains("三丽鸥"));
    }

    fn normal_palette() -> CustomPalette {
        CustomPalette {
            body: "#4F9FC8".to_string(),
            deep: "#28506A".to_string(),
            belly: "#FFF2D6".to_string(),
            accent: "#E88442".to_string(),
            accent2: Some("#86D3C5".to_string()),
        }
    }

    #[test]
    fn quality_gate_rejects_round_two_ball_topology() {
        let round = json!([{"type":"ellipse","cx":0,"cy":0,"rx":48,"ry":42,"fill":"$body","stroke":"$outline","strokeWidth":5}]);
        let head = json!([{"type":"circle","cx":0,"cy":0,"r":31,"fill":"$belly","stroke":"$outline","strokeWidth":5}]);
        let rig = CustomRig {
            front: view(round.clone(), head.clone(), 128.0, 105.0, true),
            side: Some(view(round.clone(), head.clone(), 151.0, 108.0, true)),
            lie: Some(view(round, head, 140.0, 174.0, true)),
            floating: false,
        };
        let report = assess_quality(&design_with_rig(rig, normal_palette()), &quality_concept());
        assert!(report
            .fatal_issues
            .iter()
            .any(|issue| issue.contains("两球")));
    }

    #[test]
    fn quality_gate_rejects_copied_side_and_flattened_sleep() {
        let body = json!([{"type":"path","d":"M -58 8 Q -42 -48 18 -42 Q 58 -28 52 22 Q 28 48 -38 42 Z","fill":"$body","stroke":"$outline","strokeWidth":5}]);
        let head = json!([{"type":"path","d":"M -32 4 Q -30 -30 4 -34 Q 34 -24 30 12 Q 12 32 -24 24 Z","fill":"$belly","stroke":"$outline","strokeWidth":5}]);
        let front = view(body, head, 128.0, 105.0, true);
        let rig = CustomRig {
            front: front.clone(),
            side: Some(front.clone()),
            lie: Some(front),
            floating: false,
        };
        let report = assess_quality(&design_with_rig(rig, normal_palette()), &quality_concept());
        assert!(report
            .fatal_issues
            .iter()
            .any(|issue| issue.contains("侧视")));
        assert!(report
            .fatal_issues
            .iter()
            .any(|issue| issue.contains("睡姿")));
    }

    #[test]
    fn quality_gate_scores_low_contrast_palette_down() {
        let body = json!([{"type":"path","d":"M -58 8 Q -42 -48 18 -42 Q 58 -28 52 22 Q 28 48 -38 42 Z","fill":"$body","stroke":"$outline","strokeWidth":5}]);
        let head = json!([{"type":"path","d":"M -32 4 Q -30 -30 4 -34 Q 34 -24 30 12 Q 12 32 -24 24 Z","fill":"$belly","stroke":"$outline","strokeWidth":5}]);
        let rig = CustomRig {
            front: view(body.clone(), head.clone(), 128.0, 105.0, true),
            side: Some(view(
                json!([{"type":"path","d":"M -62 4 Q -36 -40 30 -34 Q 62 -12 48 30 Q 4 46 -50 30 Z","fill":"$body","stroke":"$outline","strokeWidth":5}]),
                json!([{"type":"path","d":"M -26 0 Q -18 -30 18 -24 Q 38 -8 22 22 Q -8 30 -26 14 Z","fill":"$belly","stroke":"$outline","strokeWidth":5}]),
                154.0,
                112.0,
                true,
            )),
            lie: Some(view(
                json!([{"type":"path","d":"M -72 6 Q -52 -28 28 -26 Q 70 -16 64 18 Q 18 42 -58 30 Z","fill":"$body","stroke":"$outline","strokeWidth":5}]),
                json!([{"type":"path","d":"M -30 0 Q -20 -24 18 -20 Q 36 -8 22 20 Q -10 26 -28 12 Z","fill":"$belly","stroke":"$outline","strokeWidth":5}]),
                150.0,
                174.0,
                true,
            )),
            floating: false,
        };
        let mut low = normal_palette();
        low.deep = "#509FC7".to_string();
        low.belly = "#55A2C9".to_string();
        let report = assess_quality(&design_with_rig(rig, low), &quality_concept());
        assert!(report.palette < 10.0);
        assert!(report.issues.iter().any(|issue| issue.contains("对比")));
    }

    #[test]
    fn quality_gate_rejects_decoration_covering_the_face() {
        let body = json!([{"type":"path","d":"M -58 8 Q -42 -48 18 -42 Q 58 -28 52 22 Q 28 48 -38 42 Z","fill":"$body","stroke":"$outline","strokeWidth":5}]);
        let head = json!([{"type":"path","d":"M -32 4 Q -30 -30 4 -34 Q 34 -24 30 12 Q 12 32 -24 24 Z","fill":"$belly","stroke":"$outline","strokeWidth":5}]);
        let mut front = view(body.clone(), head.clone(), 128.0, 105.0, true);
        front.decor = Some(
            serde_json::from_value(json!([
                {"type":"rect","x":90,"y":82,"width":76,"height":38,"fill":"$deep"}
            ]))
            .unwrap(),
        );
        let rig = CustomRig {
            front,
            side: Some(view(body.clone(), head.clone(), 151.0, 108.0, true)),
            lie: Some(view(body, head, 144.0, 172.0, true)),
            floating: false,
        };
        let report = assess_quality(&design_with_rig(rig, normal_palette()), &quality_concept());
        assert!(report
            .fatal_issues
            .iter()
            .any(|issue| issue.contains("脸部被装饰遮挡")));
    }

    /// 真实 V2 批量生成（会消耗本机已登录 provider 的额度），输出校验后的 idle 渲染规格：
    /// `GULUGULU_V2_OUT=<dir> GULUGULU_FUSION_COUNT=20 cargo test real_v2_batch_idle_specs -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_v2_batch_idle_specs() {
        let provider_name =
            std::env::var("GULUGULU_FUSION_PROVIDER").unwrap_or_else(|_| "codex".to_string());
        let (provider, path) = available_providers()
            .into_iter()
            .find(|(provider, _)| provider.name() == provider_name)
            .unwrap_or_else(|| panic!("本机没有可用的 {provider_name} CLI"));
        let out_dir = std::env::var("GULUGULU_V2_OUT")
            .map(PathBuf::from)
            .expect("必须设置 GULUGULU_V2_OUT");
        std::fs::create_dir_all(&out_dir).expect("创建输出目录");
        let count: usize = std::env::var("GULUGULU_FUSION_COUNT")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(1);
        let offset: u64 = std::env::var("GULUGULU_FUSION_SEED_OFFSET")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(0);
        let timeout = Duration::from_secs(
            std::env::var("GULUGULU_FUSION_TIMEOUT_SECS")
                .ok()
                .and_then(|value| value.parse().ok())
                .unwrap_or(300),
        );
        let species =
            |name_zh: &str, element: &str, color: &str, body: &str, desc: &str| SpeciesInfo {
                name_zh: name_zh.to_string(),
                name_en: String::new(),
                tier: 1,
                elements: vec![element.to_string()],
                colors: vec![color.to_string()],
                body: body.to_string(),
                desc: desc.to_string(),
                desc_en: String::new(),
                steam_item_def: 0,
            };
        let parents = vec![
            (
                "emberfox",
                species(
                    "炎尾狐",
                    "fire",
                    "#E85D3A",
                    "fox",
                    "急性子奶狐，火焰尾比头高",
                ),
            ),
            (
                "frostpeng",
                species("霜雪怪", "ice", "#8FD8E8", "penguin", "毛茸茸壮实的小雪怪"),
            ),
            (
                "sproutcap",
                species(
                    "芽菇菇",
                    "grass",
                    "#57B84C",
                    "mushroom",
                    "顶着菌帽的好奇小不点",
                ),
            ),
            (
                "bubblefrog",
                species("泡泡蛙", "water", "#2E7BD6", "frog", "爱吹水泡的活泼小蛙"),
            ),
            (
                "voltmouse",
                species("电电鼠", "electric", "#FFD93B", "mouse", "脸颊带电的大耳鼠"),
            ),
            (
                "guluduck",
                species("咕噜鸭", "normal", "#F5C542", "duck", "呆萌的大扁嘴小鸭"),
            ),
        ];
        let pair_indices = [
            (0, 1),
            (2, 3),
            (4, 0),
            (3, 1),
            (2, 4),
            (5, 2),
            (5, 3),
            (0, 2),
            (1, 4),
            (3, 4),
        ];
        let mut history: Vec<DiversitySample> = Vec::new();
        let mut generated = 0usize;
        let max_seeds = count * 3;
        for seed_index in 0..max_seeds {
            if generated >= count {
                break;
            }
            let seed = offset + seed_index as u64;
            let (left, right) = pair_indices[seed as usize % pair_indices.len()];
            let (left_code, left_info) = &parents[left];
            let (right_code, right_info) = &parents[right];
            let mut recipe_elements = vec![
                left_info.elements[0].clone(),
                right_info.elements[0].clone(),
            ];
            recipe_elements.sort();
            recipe_elements.dedup();
            let inputs = PromptInputs {
                parent_a: (left_code.to_string(), left_info.clone()),
                parent_b: (right_code.to_string(), right_info.clone()),
                taken: BTreeSet::new(),
                seed,
                recipe_key: recipe_elements.join("+"),
                history: history.clone(),
            };
            eprintln!(
                "\n[V2 {}/{}] seed={seed} recipe={} parents={}+{}",
                generated + 1,
                count,
                inputs.recipe_key,
                left_code,
                right_code
            );

            let concept_raw = match run_provider_with_schema(
                provider,
                &path,
                &build_concept_prompt(&inputs),
                timeout,
                fusion_model(provider).as_deref(),
                Some(&concept_schema()),
            ) {
                Ok(raw) => raw,
                Err(error) => {
                    eprintln!("  ❌ 概念调用失败：{error}");
                    continue;
                }
            };
            let batch = match parse_and_validate_concepts(&concept_raw) {
                Ok(batch) => batch,
                Err(error) => {
                    eprintln!("  ❌ 概念校验失败：{error}");
                    continue;
                }
            };
            let concept = match select_concept(&batch, &inputs) {
                Ok(concept) => concept,
                Err(error) => {
                    eprintln!("  ❌ 概念选优失败：{error}");
                    continue;
                }
            };
            eprintln!(
                "  💡 胜出：{} / {} / {} / {}",
                concept.name_zh, concept.prototype, concept.archetype, concept.hero_feature
            );

            let mut repair: Option<(QualityReport, String)> = None;
            let mut accepted: Option<(ValidatedDesign, QualityReport)> = None;
            for art_attempt in 0..2 {
                let art_raw = match run_provider_with_schema(
                    provider,
                    &path,
                    &build_art_prompt(
                        &inputs,
                        &concept,
                        repair
                            .as_ref()
                            .map(|(report, prior)| (report, prior.as_str())),
                    ),
                    timeout,
                    fusion_model(provider).as_deref(),
                    Some(&art_schema()),
                ) {
                    Ok(raw) => raw,
                    Err(error) => {
                        eprintln!("  ❌ 绘制调用失败：{error}");
                        break;
                    }
                };
                let mut design = match validate_design(&art_raw) {
                    Ok(design) => design,
                    Err(error) => {
                        eprintln!("  ⚠️ 结构校验失败：{error}");
                        repair = Some((
                            QualityReport {
                                total_score: 0.0,
                                silhouette: 0.0,
                                face_readability: 0.0,
                                pose_difference: 0.0,
                                palette: 0.0,
                                hero_feature: 0.0,
                                fatal_issues: vec![format!("结构校验失败：{error}")],
                                issues: Vec::new(),
                            },
                            art_raw,
                        ));
                        continue;
                    }
                };
                if let Err(error) = enforce_concept(&mut design, &concept) {
                    eprintln!("  ⚠️ 概念一致性失败：{error}");
                    repair = Some((
                        QualityReport {
                            total_score: 0.0,
                            silhouette: 0.0,
                            face_readability: 0.0,
                            pose_difference: 0.0,
                            palette: 0.0,
                            hero_feature: 0.0,
                            fatal_issues: vec![error],
                            issues: Vec::new(),
                        },
                        art_raw,
                    ));
                    continue;
                }
                let report = assess_quality(&design, &concept);
                eprintln!(
                    "  {} 第{}稿 {:.1}/100：{}",
                    if report.passed() { "✅" } else { "⚠️" },
                    art_attempt + 1,
                    report.total_score,
                    if report.passed() {
                        "通过".to_string()
                    } else {
                        report.feedback()
                    }
                );
                if report.passed() {
                    accepted = Some((design, report));
                    break;
                }
                repair = Some((report, art_raw));
            }
            let Some((design, report)) = accepted else {
                eprintln!("  ❌ seed={seed} 两稿后仍未通过");
                continue;
            };

            let mut output = serde_json::to_value(&design.visual).expect("visual serialize");
            output["nameZh"] = Value::String(design.name_zh.clone());
            output["nameEn"] = Value::String(design.name_en.clone());
            output["desc"] = Value::String(design.desc.clone());
            output["descEn"] = Value::String(design.desc_en.clone());
            output["prototype"] = Value::String(concept.prototype.clone());
            output["archetype"] = Value::String(concept.archetype.clone());
            output["heroFeature"] = Value::String(concept.hero_feature.clone());
            output["personality"] = Value::String(concept.personality.clone());
            output["paletteFamily"] = Value::String(concept.palette_family.clone());
            output["qualityScore"] = json!(report.total_score);
            output["promptVersion"] = Value::String(PROMPT_VERSION.to_string());
            output["recipeKey"] = Value::String(inputs.recipe_key.clone());
            output["elements"] = json!(recipe_elements);
            let file = out_dir.join(format!("pet_{:02}_seed_{seed}.json", generated + 1));
            std::fs::write(&file, serde_json::to_vec_pretty(&output).unwrap())
                .expect("write generated design");
            let face_signature = concept.face_signature();
            let motion_signature = format!("{}+{}", concept.motion_preset, concept.personality);
            history.push(DiversitySample {
                recipe_key: inputs.recipe_key,
                prototype: concept.prototype,
                archetype: concept.archetype,
                hero_feature: concept.hero_feature,
                palette_family: concept.palette_family,
                face_signature,
                motion_preset: motion_signature,
            });
            generated += 1;
            eprintln!("  💾 {}", file.display());
        }
        assert_eq!(
            generated, count,
            "只生成出 {generated}/{count} 个通过质量门的设计"
        );
    }
}
