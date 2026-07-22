use super::*;

// ---------------------------------------------------------------------------
// Save data (mirrored in src/types.ts — keep both sides in sync)
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PetInstance {
    pub id: String,
    pub species: String,
    pub tier: u8,
    pub level: u32,
    /// Progress within the current level (resets to 0 on level-up).
    pub exp: u64,
    pub stamina: i64,
    pub stamina_updated_at: i64,
    pub exhausted: bool,
    /// 键盘充能换算余数（还差多少键满下一点精力，< keys_per_stamina_for(tier)）。
    #[serde(default)]
    pub key_buffer: u64,
    /// Token 喂养换算余数（还差多少加权 Token 满下一点经验，< tokens_per_exp；
    /// 2026-07-21 起 Token → 经验，缓冲单位随之从"精力"改记"经验"进度）。
    #[serde(default)]
    pub token_buffer: u64,
    /// Steam 库存物品实例 id。u64 超过 JS 安全整数范围，全链路一律字符串
    /// （plans/steam_trade/00-decisions.md）。None = 未同步 Steam（待发放/本地遗留）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steam_item_id: Option<String>,
    /// 绑定物品的 itemdefid。AI 自定义物种也绑其配方目录物种的 def
    /// （Steam 侧按目录物种记账，自定义外观是本地增值）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steam_item_def: Option<u32>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EggInstance {
    pub id: String,
    pub species: String,
    pub tier: u8,
    /// Key into config.hatch_seconds: "tutorial", an element name, or "tier2".
    pub hatch_kind: String,
    /// None = in inventory (not incubating).
    pub slot: Option<u8>,
    pub hatch_at: Option<i64>,
    /// AI 融合蛋的生成任务信息（普通蛋为 None）。species 初始为兜底
    /// guluduck，生成成功后被改写为新物种 codename（status=resolved）——
    /// 收取逻辑因此不需要任何特殊分支。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pending_fusion: Option<PendingFusionInfo>,
    /// Steam 库存物品实例 id。旧流 = 蛋物品（301-321）；融合 2.0 同步流 =
    /// **结果宠物物品**（融合时已兑换到手，收取纯本地绑定）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steam_item_id: Option<String>,
    /// 绑定物品的 itemdefid（旧蛋 301-321 / 新流宠物 def：101-657、10000 段）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steam_item_def: Option<u32>,
    /// 商店蛋的购买属性（EconomyScaling §7）：Steam-first 收取时定位
    /// 商店生成器 `shop_gen_def(tier, 一阶def(element))`。非商店蛋 None。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shop_element: Option<String>,
}

/// AI 融合蛋兜底孵出的默认物种（生成到期未完成时）。
pub const FALLBACK_SPECIES: &str = "guluduck";

/// 商店初始等级（只卖 1 阶蛋）。旧存档 serde default 亦用此值。
pub(crate) fn default_shop_level() -> u8 {
    1
}

// ---------------------------------------------------------------------------
// Steam 同步状态（mirrored in src/types.ts — keep both sides in sync）
// 设计规则见 plans/steam_trade/00-decisions.md：outbox 双职责 =
// MintTier1（发了就重试）+ 写前意图（Fuse/CollectT2/Release，涉及实体 op-lock）。
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "kind")]
pub enum SteamOp {
    /// 一阶收获的待发放（本地先行，TriggerItemDrop 限频重试）。
    #[serde(rename = "mintTier1", rename_all = "camelCase")]
    MintTier1 {
        op_id: String,
        pet_id: String,
        species: String,
        def: u32,
        #[serde(default)]
        attempts: u32,
        /// 下次允许重试的时间（限频退避 1→2→5→10 分钟）。
        #[serde(default)]
        next_retry_at: i64,
    },
    /// 融合意图。两种模式:
    /// - `applied:false`(默认,旧写前意图):三阶+ Steam 先行,ExchangeItems 成功后才应用
    ///   本地,崩溃由 `resolve_intents` 对照快照回放。
    /// - `applied:true`(**本地先行**,2026-07-21):二阶融合即时本地应用(消耗双亲 + 建**未绑定**
    ///   蛋),`ExchangeItems(结果 def ← 两材料)` 由 outbox 泵限频重试收敛(镜像 `Release{applied:true}`
    ///   「发了就重试」)。结果回绑到 `egg_id`(前向融合)或 `pet_id`(存量二阶修复 / 蛋已被收取转宠)。
    ///   复制防线:`item_a`/`item_b`(非空时)在 op 未收敛前计入 `bound_item_ids`,不被认领/对账/手动导入回导。
    ///   **不阻挡融合**:双亲若尚未同步 Steam(MintTier1 待发放 / 纯本地),其 `item_x` 留空("")、`mat_def_x`
    ///   记该阶宠 def,由泵**先 TriggerItemDrop 铸出材料**(填回 `item_x`)再兑换 —— 教学首融不再卡「同步中」。
    #[serde(rename = "fuse", rename_all = "camelCase")]
    Fuse {
        op_id: String,
        pet_a: String,
        pet_b: String,
        /// 材料 A 的物品 id;**空("")= 尚未同步 Steam**,泵按 `mat_def_a` 先铸再填回。
        item_a: String,
        /// 材料 B 的物品 id;空("")同上。
        item_b: String,
        egg_def: u32,
        recipe_key: String,
        /// 本地效果(消耗双亲 + 建蛋)是否已应用(本地先行恒 true;旧写前意图缺省 false)。
        #[serde(default)]
        applied: bool,
        /// 材料 A 待铸的一阶宠 def(`item_a` 为空时泵 `TriggerItemDrop(shop_gen_def(1,mat_def_a))` 先铸;
        /// 已同步 Steam 材料 = 0)。
        #[serde(default)]
        mat_def_a: u32,
        /// 材料 B 待铸的一阶宠 def(同上)。
        #[serde(default)]
        mat_def_b: u32,
        /// 本地先行:结果要回绑的蛋(前向融合)。
        #[serde(default, skip_serializing_if = "Option::is_none")]
        egg_id: Option<String>,
        /// 本地先行:结果要回绑的宠(存量二阶修复,绑已孵化的宠而非蛋)。
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pet_id: Option<String>,
        /// 本地先行:def 落定时给 AI 槽解析用的双亲物种。
        #[serde(default, skip_serializing_if = "Option::is_none")]
        parents: Option<[String; 2]>,
        /// 限频退避计数(本地先行用;写前意图恒 0)。
        #[serde(default)]
        attempts: u32,
        /// 下次允许 ExchangeItems 重试的时间。
        #[serde(default)]
        next_retry_at: i64,
    },
    /// 二阶收获写前意图：ExchangeItems(生成器 def ← 蛋物品)。
    #[serde(rename = "collectT2", rename_all = "camelCase")]
    CollectT2 {
        op_id: String,
        egg_id: String,
        egg_item: String,
        egg_def: u32,
    },
    /// 放生（2026-07-18 起**本地先行**）：放生即时删宠+返还，物品 ConsumeItem 由
    /// outbox 限频重试收敛（镜像 MintTier1「发了就重试」）。`applied=false` 为升级前
    /// 落盘的旧版写前意图（ConsumeItem 成功后才本地删除+返还），崩溃回放仍按旧语义。
    #[serde(rename = "release", rename_all = "camelCase")]
    Release {
        op_id: String,
        pet_id: String,
        item_id: String,
        /// 本地效果（删宠+返还）是否已应用（新版恒 true；旧存量 op 缺省 false）。
        #[serde(default)]
        applied: bool,
        #[serde(default)]
        attempts: u32,
        /// 下次允许 ConsumeItem 重试的时间（限频退避 1→2→5→10 分钟）。
        #[serde(default)]
        next_retry_at: i64,
    },
}

/// 对账减员时的等级墓碑：挂市场取消/交易托管退回同一物品 id 时按此复原，
/// 防"满级宠物变 1 级"。上限 100 条 FIFO。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamTombstone {
    pub item_id: String,
    pub species: String,
    pub tier: u8,
    pub level: u32,
    pub exp: u64,
    pub removed_at: i64,
}

pub const STEAM_TOMBSTONE_CAP: usize = 100;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingFusionInfo {
    /// 双亲的物种 codename。
    pub parents: [String; 2],
    /// 双亲主元素的配方键（fusionTable 排序键）。
    pub recipe_key: String,
    pub requested_at: i64,
    pub attempts: u32,
    /// pending | generating | resolved | failed
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    /// 当前正在用哪个本地 CLI 生成（"claude" | "codex"）；worker 选定 provider 后写入，
    /// 供前端徽标显示"Claude/Codex 生成中"。pending 阶段/旧存档为 None。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    /// Steam 掷中的确定性槽位 codename（如 `aif0503`）：生成必须落到这个槽
    /// （全局池可乱序掷中非前沿槽）。本地掷骰路径 None（沿用前沿槽推导）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub forced_codename: Option<String>,
}

// ---------------------------------------------------------------------------
// AI 融合自定义物种（mirrored in src/types.ts — keep both sides in sync）
// ---------------------------------------------------------------------------

/// 自定义部件的单个图形节点（白名单渲染；校验在 fusion_gen::validate_spec）。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShapeNode {
    #[serde(rename = "type")]
    pub node_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fill: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stroke: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stroke_width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stroke_linecap: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stroke_linejoin: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fill_rule: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opacity: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub d: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cx: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cy: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rx: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ry: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub points: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x1: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y1: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x2: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y2: Option<f64>,
}

/// AI 完全重绘的自定义部件。
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct CustomPart {
    /// 恒为 "custom"。
    pub kind: String,
    pub nodes: Vec<ShapeNode>,
}

/// 槽位取值：部件目录 id 或自定义部件。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(untagged)]
pub enum SlotSpec {
    PartId(String),
    Custom(CustomPart),
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomPalette {
    pub body: String,
    pub deep: String,
    pub belly: String,
    pub accent: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accent2: Option<String>,
}

pub(crate) fn default_body_plan() -> String {
    // 旧存档的 chimera form 无 bodyPlan 字段 → 回落到兼容的堆叠体型，
    // 保证既有自定义物种形象不变（新生成才走 6 种动物体型）。
    "stack".to_string()
}

/// chimera 参数化身体（rig="chimera" 时使用；镜像 sprites/rigTypes.ChimeraForm）。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChimeraForm {
    /// 体型原型（决定剪影拓扑）：stack（兼容旧存档）/ round / upright /
    /// quadruped / long / floaty / bighead。镜像 rigTypes.BodyPlan。
    #[serde(default = "default_body_plan")]
    pub body_plan: String,
    pub segments: u8,
    pub body_w: f64,
    pub body_h: f64,
    pub taper: f64,
    pub head_style: String,
    pub head_scale: f64,
    pub leg_style: String,
    pub leg_count: u8,
    pub arm_style: String,
    pub ear_style: String,
    pub floating: bool,
}

/// 打工特效的单个粒子（**联合体，二选一**）：
/// - 自绘 `nodes`：±14 局部坐标内的 1~4 个 ShapeNode 小图形（白名单渲染）；
/// - 目录引用 `ref`：共享「实物粒子目录」的 id（`src/game/fusionParts.json` 的
///   `workParticles`），前端按同名 id 映射到内置渲染器复用。
///
/// 每个粒子**有且仅有** `nodes` 或 `ref` 其一（校验在 `fusion_gen::validate_work_particles`）。
/// 向后兼容：旧存档只带 `{"nodes":[...]}`，反序列化即 `nodes=Some, ref=None`，仍合法。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkFxParticle {
    /// 自绘造型（1~4 个 ShapeNode）。与 `ref` 互斥、二选一。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nodes: Option<Vec<ShapeNode>>,
    /// 复用共享实物粒子目录的 id（如 `"coffee-cup"`）。与 `nodes` 互斥、二选一。
    #[serde(rename = "ref", default, skip_serializing_if = "Option::is_none")]
    pub r#ref: Option<String>,
}

/// AI 为角色设计的专属满屏打工粒子（2~3 个粒子，点击打工时喷向全屏）。每个粒子要么
/// 自绘 `nodes`、要么 `ref` 复用共享目录，且**至少 1 个自绘**（自绘下限）。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomWorkFx {
    pub particles: Vec<WorkFxParticle>,
}

/// custom rig 的脸部参数（front/lie 用 eye_dx 双眼；side 用 eye_cx 单眼）。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RigFace {
    pub eye_r: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eye_dx: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eye_cx: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eye_dy: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mouth_dx: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mouth_dy: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mouth_w: Option<f64>,
    /// 嘴的归属：`"engine"`（默认，缺省即此）= 引擎画会动的嘴；`"beak"` = 生物自带硬
    /// 喙/鸟嘴/长吻，由 muzzle 自绘嘴型，引擎**不再叠嘴**（只画会动的眼），避免双嘴。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mouth: Option<String>,
}

/// 部件摆放锚点（局部坐标偏移 + 旋转）。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RigAnchor {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rot: Option<f64>,
}

/// custom rig 里一个视图（front/side/lie）的部件几何（镜像 rigTypes.RigViewParts）。
/// 各部件在自己的局部坐标系作画，渲染层负责摆放/pivot/包 Part → 14 态动画白拿。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RigViewParts {
    pub body: Vec<ShapeNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body_y: Option<f64>,
    pub head: Vec<ShapeNode>,
    pub head_y: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub head_x: Option<f64>,
    pub face: RigFace,
    /// 面部点缀层（鼻/颊/须/眉/獠牙等**眼嘴之外**的五官；喙/长吻仅在 face.mouth="beak"
    /// 时在此画当嘴）。画在 head 与引擎眼嘴之间；绝不画眼珠、软脸不画嘴（校验期会拦）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub muzzle: Option<Vec<ShapeNode>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub belly: Option<Vec<ShapeNode>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arm_l: Option<Vec<ShapeNode>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arm_r: Option<Vec<ShapeNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arm_y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arm_spread: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub leg_l: Option<Vec<ShapeNode>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub leg_r: Option<Vec<ShapeNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub leg_y: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub leg_spread: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tail: Option<Vec<ShapeNode>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tail_at: Option<RigAnchor>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub head_top: Option<Vec<ShapeNode>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub head_top_at: Option<RigAnchor>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decor: Option<Vec<ShapeNode>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_at: Option<RigAnchor>,
}

/// AI 完全手绘的"专属 rig"（三视图各自作画；镜像 rigTypes.CustomRig）。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomRig {
    pub front: RigViewParts,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub side: Option<RigViewParts>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lie: Option<RigViewParts>,
    #[serde(default)]
    pub floating: bool,
}

/// AI 生成物种的视觉规格（CLI 输出经校验后的形态）。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomVisualSpec {
    pub rig: String,
    pub scale: f64,
    pub palette: CustomPalette,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eyes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_id: Option<String>,
    #[serde(default)]
    pub floating: bool,
    #[serde(default)]
    pub slots: BTreeMap<String, SlotSpec>,
    /// rig="chimera" 时的参数化身体（AI 融合新剪影）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub form: Option<ChimeraForm>,
    /// rig="custom" 时 AI 完全手绘的三视图部件几何（优先于 form）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_rig: Option<CustomRig>,
    /// 角色专属打工粒子（缺省时渲染层按调色板合成兜底）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub work_fx: Option<CustomWorkFx>,
}

/// 存档里的一条自定义物种记录。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomSpeciesEntry {
    pub info: SpeciesInfo,
    pub visual: CustomVisualSpec,
    pub parents: [String; 2],
    pub created_at: i64,
    /// "claude" | "codex" | "mock"
    pub generator: String,
    /// 出处："local" = 本机 CLI 生成；"workshop" = 从创意工坊下载的他人设计。
    /// None = v6 之前的存量条目（两者无法可靠区分——**不得**据此重发布到工坊）。
    /// 该结构同时是工坊内容文件格式：下载所得的 origin 不可信，入档前必须覆写。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
}

/// 每物种可收藏的工坊皮肤上限（存档体积防线：每张皮肤是几 KB 的 CustomVisualSpec）。
pub const MAX_SKINS_PER_SPECIES: usize = 20;

/// 某 AI 物种已导入的一张创意工坊皮肤（SkinWorkshop.md；mirrored in src/types.ts）。
/// 四源皮肤里 "default"（配方固定形态）与 "local"（custom_species 本体）是虚拟源
/// 不落这张表；这里只存从工坊下载的他人皮肤（首发/分享）。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeciesSkin {
    /// `"ws:<fileId>"` —— skin_selected 的取值主键。
    pub id: String,
    pub visual: CustomVisualSpec,
    /// 上传者给该形象起的名字（皮肤卡标题；物种本名不受皮肤影响）。
    pub name_zh: String,
    /// 上传者 SteamID64（十进制字符串；u64 超 JS 安全整数）。
    pub author_steam_id: String,
    /// 上传者昵称（best-effort 拉取；拿不到回落显示 SteamID）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_persona: Option<String>,
    /// 工坊 publishedFileId（十进制字符串）。同物种去重主键。
    pub published_file_id: String,
    /// 工坊条目创建时刻（Unix 秒；首发排序口径）。
    pub time_created: i64,
    pub imported_at: i64,
    /// 获取途径："first"（首发者形象）| "shared"（分享文本/列表安装）。仅展示用。
    pub source: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyCounters {
    pub date: String,
    /// 今日已消耗精力的有效点击数（全局 dailyClickCap 上限）。
    #[serde(default)]
    pub clicks: u64,
    /// 今日各「元素:阶」蛋已生产数（EconomyScaling.md §7.5 每日产出上限；键 = `"{element}:{tier}"`）。
    #[serde(default)]
    pub egg_mints: BTreeMap<String, u32>,
    /// 今日各「元素:阶」商店蛋**成功收取**数（键同 egg_mints）。这是收取侧镜像，比
    /// 购买侧 egg_mints 更贴近 Valve 的 24h 窗口实际计数 —— 空发放时据此区分
    /// 「今日已领满」vs「分钟级限频」两类文案（commands::empty_drop_message）。
    #[serde(default)]
    pub egg_collects: BTreeMap<String, u32>,
    /// 今日各配方已融合次数（§7.5 每日融合上限；键 = 结果配方集合键，如 `"fire+water"`）。
    #[serde(default)]
    pub fusion_mints: BTreeMap<String, u32>,
    // —— 以下为「昨日战报」（WelcomeBack 昨日总结）新增的当日计数，翻日时由
    //    ensure_daily 折算进 last_day_digest。全部 serde default，旧档零迁移。——
    /// 今日键盘充能键数（对齐 LifetimeStats.total_keys_charged 的当日增量）。
    #[serde(default)]
    pub keys: u64,
    /// 今日孵化（收取到手）宠物数——此前全系统无任何孵化计数。
    #[serde(default)]
    pub hatches: u64,
    /// 今日点击赚取金币（对齐 total_coins_earned 的当日增量；不含放生返还）。
    #[serde(default)]
    pub coins_earned: u64,
    /// 今日放生数（对齐 total_releases 的当日增量）。
    #[serde(default)]
    pub releases: u64,
    /// 今日是否有过本地时 0–4 点的打工/喂食（吐槽「熬夜」判定的当日信号）。
    #[serde(default)]
    pub night_owl: bool,
}

/// 某一本地日结束时归档的「当日战报」（WelcomeBack 昨日总结数据源）。翻日时由
/// `ensure_daily` 从旧 `DailyCounters` 折算写入 `GameSave.last_day_digest`：map 类
/// 计数（egg_mints/egg_collects/fusion_mints）在此折算为标量总和。Token **不在此**
/// ——按 `day_index` 去 codex_adapter 每日桶取，口径与公告板一致。
/// mirrored in src/types.ts — keep both sides in sync。
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyDigest {
    /// 归档那天的本地日期（YYYY-MM-DD）。
    pub date: String,
    /// 与 codex_adapter 每日桶一致的本地天序号（Token 按此取数）。
    pub day_index: u64,
    pub clicks: u64,
    pub keys: u64,
    pub hatches: u64,
    pub fusions: u64,
    pub eggs_minted: u64,
    pub eggs_collected: u64,
    pub coins_earned: u64,
    pub releases: u64,
    pub night_owl: bool,
}

/// 终身统计（Steam 成就判定用，SteamAchievements.md §3）。全部 `#[serde(default)]`：
/// 旧档缺字段即默认 0/空 → 零成本迁移（v6→v7 仅从当前宠物播种 highest_tier /
/// first_maxlevel_done）。只增计数 + 高水位 + 登录节律 + 一次性事件旗标；判定纯函数
/// 见 `game::satisfied_achievements`，写入点分散在各 `logic_*`（绝不触碰 Steam / 锁）。
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LifetimeStats {
    /// 有效点击总数（logic_click_work）。
    #[serde(default)]
    pub total_clicks: u64,
    /// 累计赚取金币（只计点击收入，不含放生返还）。
    #[serde(default)]
    pub total_coins_earned: u64,
    /// 融合成功总次数（同种升阶 + 异种并集，record_fusion_mint 覆盖全路径）。
    #[serde(default)]
    pub total_fusions: u64,
    /// 放生总数（apply_release）。
    #[serde(default)]
    pub total_releases: u64,
    /// 累计喂食的加权 Token 单位（四分加权口径，logic_feed_tokens）。
    #[serde(default)]
    pub total_tokens_fed: u64,
    /// 累计入账的键盘充能键数（logic_feed_keys）。
    #[serde(default)]
    pub total_keys_charged: u64,
    /// 曾拥有过的最高阶（apply_collect 时取 max；迁移从当前宠物播种）。
    #[serde(default)]
    pub highest_tier: u8,
    /// 累计游玩天数（本地日期去重，ensure_daily）。
    #[serde(default)]
    pub days_played: u32,
    /// 当前连续登录天数（ensure_daily；断档归 1）。
    #[serde(default)]
    pub login_streak: u32,
    /// 上次登录结算的本地日期（YYYY-MM-DD），streak 判定用。
    #[serde(default)]
    pub last_login_date: String,
    /// 曾把一只精灵点到其阶满级（click_work 触满级即置真；迁移从当前宠物播种）。
    #[serde(default)]
    pub first_maxlevel_done: bool,
    /// 曾放生过一只精灵。
    #[serde(default)]
    pub first_release_done: bool,
    /// 曾点满每日额度（dailyClickCap，进入纯抚摸模式）。
    #[serde(default)]
    pub daily_cap_reached_ever: bool,
    /// 曾在**本机本地时** 0–4 点打工/喂食（chrono::Local，非 UTC）。
    #[serde(default)]
    pub night_owl: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSave {
    pub version: u32,
    pub coins: u64,
    pub pets: Vec<PetInstance>,
    pub eggs: Vec<EggInstance>,
    pub hatchery_level: u8,
    pub yard_level: u8,
    /// 商店等级 = 可售最高蛋阶（1~shopMaxLevel）。EconomyScaling.md §6.1。
    /// serde default=1：旧存档缺失时按初始商店（只卖 1 阶蛋）。
    #[serde(default = "default_shop_level")]
    pub shop_level: u8,
    pub active_pet_id: Option<String>,
    /// Token 喂养的按项目增量锚点（v1.2 起为 progress 账本的 output_tokens
    /// 产出口径；旧档的 raw 基线由 ledger 自愈静默换锚）。
    /// v1.3（四分喂养）起改由 `last_seen_project_breakdown` 承担喂养差分，
    /// 本字段留作降级保险，不再驱动喂养。
    #[serde(default)]
    pub last_seen_project_tokens: BTreeMap<String, u64>,
    /// 四分喂养的按项目增量锚点（v1.3，2026-07-20 四分喂养）：progress 账本的
    /// 累计四分明细。首见项目自播种当前值（不喂历史），其后逐项差分驱动加权喂养。
    #[serde(default)]
    pub last_seen_project_breakdown: BTreeMap<String, crate::codex_adapter::TokenBreakdown>,
    /// v2 遗留字段：旧二进制反序列化时必填，缺失会静默重建存档（降级丢档）。
    /// v3 起恒为空表，仅为降级保险继续序列化一个版本，之后删除。
    #[serde(default)]
    pub last_seen_project_experience: BTreeMap<String, u64>,
    pub daily: DailyCounters,
    pub tutorial_step: u8,
    /// 教学硬编码：是否已购买过首颗商店蛋（首购蛋固定 30s，OnboardingCoach.md §3.1）。
    #[serde(default)]
    pub tutorial_first_egg_bought: bool,
    /// 教学硬编码：是否已完成首次融合（首融必产经典配方 + 1min 孵化，OnboardingCoach.md §3.1）。
    #[serde(default)]
    pub tutorial_first_fusion_done: bool,
    pub last_seen_at: i64,
    /// AI 融合诞生的自定义物种（codename → 完整设定），随存档持久化。
    #[serde(default)]
    pub custom_species: BTreeMap<String, CustomSpeciesEntry>,
    /// 图鉴"曾获得"账本（物种 codename → 累计曾获只数）。孵出即 +1，放生/融合
    /// 消耗不减；`≥1` 即视为图鉴已收集。见 docs/gdd/PokedexSystem.md §2 与
    /// FusionRecipeSlots.md §5（也是槽位阶梯 obtained 判定的真源）。
    #[serde(default)]
    pub dex_obtained: BTreeMap<String, u32>,
    /// 每配方的 AI 变种槽注册表（配方键 → [1 号 codename, 2 号 codename, …]，
    /// 顺序即槽号，下标 0 = 1 号槽）。长度 = 已生成 AI 变种数（0..=10）。物种完整
    /// 设定仍存在 `custom_species[codename]`。见 FusionRecipeSlots.md §5。
    #[serde(default)]
    pub recipe_ai_slots: BTreeMap<String, Vec<String>>,
    /// 绑定的 Steam 账号（SteamID64 十进制字符串）。存档拷到别的账号时
    /// 触发 ownerMismatch 阻塞对话框。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steam_owner_id: Option<String>,
    /// Steam 操作队列：MintTier1 待发放 + Fuse/CollectT2/Release 写前意图。
    #[serde(default)]
    pub steam_outbox: Vec<SteamOp>,
    /// 对账减员的等级墓碑（≤100 FIFO）。
    #[serde(default)]
    pub steam_tombstones: Vec<SteamTombstone>,
    /// 已处理过创意工坊认领的 AI 变种（codename → publishedFileId 十进制字符串；
    /// `""` = 该槽已有他人的全局形象，本机不再上传）。首发上传与启动补传扫描
    /// （`fusion_gen::spawn_workshop_backfill`）据此跳过已处理槽位。
    #[serde(default)]
    pub workshop_published: BTreeMap<String, String>,
    /// 已给本机创意工坊物品挂上设定图缩略图的 codename 集合（预览补挂扫描据此跳过；
    /// 预览图 PNG 由前端离屏渲染缓存到 app_data/species-previews/）。
    #[serde(default)]
    pub workshop_preview_done: std::collections::BTreeSet<String>,
    /// 最近一次商店蛋成功 TriggerItemDrop 收取的时刻（秒；未收过 = 0）。空发放时若
    /// 距此很近，判为 per-def 分钟级限频「冷却中」而非「今日领满」。冷却窗口以分钟计，
    /// 故**跨日不清零**（与按天重置的 daily 计数分离，见 commands::empty_drop_message）。
    #[serde(default)]
    pub last_shop_drop_at: i64,
    /// 每 AI 物种已导入的创意工坊皮肤（codename → 列表；按 publishedFileId 去重，
    /// 封顶 MAX_SKINS_PER_SPECIES）。允许先于物种获得而入库（图鉴神秘槽显示徽章，
    /// 获得后才可选用）——不注册物种/不动图鉴进度。SkinWorkshop.md。
    #[serde(default)]
    pub species_skins: BTreeMap<String, Vec<SpeciesSkin>>,
    /// 每 AI 物种当前选中皮肤（codename → "default" | "local" | "ws:<fileId>"；
    /// 缺省键 = "local" 即本机生成形象，存档保持精简）。按物种统一生效于全部个体。
    #[serde(default)]
    pub skin_selected: BTreeMap<String, String>,
    /// 终身统计（Steam 成就判定，SteamAchievements.md）。serde default → 旧档零成本迁移。
    #[serde(default)]
    pub stats: LifetimeStats,
    /// 上一个本地日结束时归档的「当日战报」（WelcomeBack「昨日战报」卡数据源）。
    /// 翻日时由 `ensure_daily` 从旧 `daily` 折算写入；无归档（新档/首日）为 None。
    #[serde(default)]
    pub last_day_digest: Option<DailyDigest>,
    /// 云同步单调修订号：每次 `with_save` 落盘 +1（persist.rs）。Steam 云存档冲突判
    /// 新旧的锚——同谱系单调递增，连线时较新者胜。SteamCloudSync.md。加法字段、
    /// **不 bump `version`**（旧二进制忽略未知字段，跨版本云同步安全）。
    #[serde(default)]
    pub cloud_revision: u64,
    /// 本地夺权标记：true 时下次连线**强制推云、跳过采纳**（`debug_clear_save` 清档用）。
    /// 推成功前先清此标记，故云端存档永不携带 true（避免他机误判夺权）。SteamCloudSync.md。
    #[serde(default)]
    pub cloud_force_push: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClickWorkResult {
    pub save: GameSave,
    pub coins_gained: u64,
    pub exp_gained: u64,
    pub leveled_up: bool,
    pub became_exhausted: bool,
    /// 日额度（dailyClickCap）已用尽：本次点击零消耗零产出，前端播纯抚摸特效。
    pub daily_capped: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleasePetResult {
    pub save: GameSave,
    pub refund: u64,
}

/// 「昨日战报」：上一个活跃日的当日总结（WelcomeBack 卡数据源）。
/// Token 走 codex_adapter 每日桶（raw + 四分，与公告板同口径），游戏统计走存档
/// 归档的 `DailyDigest`；两者按同一 `day_index` 对齐。mirrored in src/types.ts。
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DaySummary {
    /// 归档日的本地日期（YYYY-MM-DD）；无归档时 = 今天的前一天。
    pub date: String,
    pub day_index: u64,
    /// `day_index` 是否正好是「今天的前一天」（否则前端标「上次开工」）。
    pub is_yesterday: bool,
    /// 是否有真实归档数据（false = 尚无昨日战报，前端出兜底文案；Token 可能仍非零）。
    pub has_digest: bool,
    /// 当日 raw Token 总量（含 cache_read，与公告板一致）。
    pub tokens_raw: u64,
    /// 当日四分明细（output = AI 真正生成）。
    pub token_breakdown: crate::codex_adapter::TokenBreakdown,
    pub clicks: u64,
    pub keys: u64,
    pub hatches: u64,
    pub fusions: u64,
    pub eggs_minted: u64,
    pub coins_earned: u64,
    pub releases: u64,
    /// 归档日是否命中夜猫子时段（吐槽「熬夜」用）。
    pub night_owl: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameConfigPayload {
    pub test_mode: bool,
    pub config: GameConfig,
}

/// 单宠精力增益（game://stamina 与 codex://activity 的 FX 锚点数据；
/// mirrored in src/types.ts — keep both sides in sync）。
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PetStaminaGain {
    pub pet_id: String,
    pub stamina_gained: i64,
    pub stamina_after: i64,
}

/// 键盘充能结果。只描述精力——键盘永不产出金币/经验（经济不变量）。
/// 2026-07-21 起只喂陪伴宠：per_pet 至多一条。
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnergyFeedOutcome {
    pub per_pet: Vec<PetStaminaGain>,
    pub stamina_fed: i64,
    /// 陪伴宠缺席/已满管而丢弃的键次。
    pub wasted: u64,
    pub woke_pet_ids: Vec<String>,
}

/// Token 喂养结果（2026-07-21 起 Token → **经验**，只喂陪伴宠；同时作为
/// `game://exp` 事件载荷。mirrored in src/types.ts — keep both sides in sync）。
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenFeedOutcome {
    /// 吃到这餐的陪伴宠（None = 无陪伴宠，整段浪费）。
    pub pet_id: Option<String>,
    /// 实际入账的经验点数。
    pub exp_gained: u64,
    pub leveled_up: bool,
    /// 入账后的等级/当前级内经验（前端本地补丁 + FX 锚点用）。
    pub level_after: u32,
    pub exp_after: u64,
    /// 陪伴宠满级/缺席而丢弃的加权 Token 单位数。
    pub wasted: u64,
    /// 本次真正吃进去的四分 token（未加权的原始增量）。
    /// 前端据此报「吃到 N 输入 / M 产出 Token…」。
    pub fed_breakdown: crate::codex_adapter::TokenBreakdown,
}
