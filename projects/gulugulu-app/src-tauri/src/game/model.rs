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
    /// Token 喂食换算余数（< tokens_per_stamina_for(tier)）。
    #[serde(default)]
    pub token_buffer: u64,
    /// Steam 库存物品实例 id。u64 超过 JS 安全整数范围，全链路一律字符串
    /// （plans/steam_trade/00-decisions.md）。None = 未上链（待发放/本地遗留）。
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
    /// Steam 库存物品实例 id（仅二阶融合蛋；一阶蛋不上 Steam，恒 None）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steam_item_id: Option<String>,
    /// 蛋物品的 itemdefid（301..321）。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub steam_item_def: Option<u32>,
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
    /// 融合写前意图：ExchangeItems(蛋 def ← 两只材料) 成功后才应用本地。
    #[serde(rename = "fuse", rename_all = "camelCase")]
    Fuse {
        op_id: String,
        pet_a: String,
        pet_b: String,
        item_a: String,
        item_b: String,
        egg_def: u32,
        recipe_key: String,
    },
    /// 二阶收获写前意图：ExchangeItems(生成器 def ← 蛋物品)。
    #[serde(rename = "collectT2", rename_all = "camelCase")]
    CollectT2 {
        op_id: String,
        egg_id: String,
        egg_item: String,
        egg_def: u32,
    },
    /// 放生写前意图：ConsumeItem 成功后才本地删除+返还。
    #[serde(rename = "release", rename_all = "camelCase")]
    Release {
        op_id: String,
        pet_id: String,
        item_id: String,
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

/// 打工特效的单个粒子造型（±14 局部坐标的小图形，ShapeNode 白名单渲染）。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkFxParticle {
    pub nodes: Vec<ShapeNode>,
}

/// AI 为角色设计的专属满屏打工粒子（2~3 种造型，点击打工时喷向全屏）。
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomWorkFx {
    pub particles: Vec<WorkFxParticle>,
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
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyCounters {
    pub date: String,
    /// 今日已消耗精力的有效点击数（全局 dailyClickCap 上限）。
    #[serde(default)]
    pub clicks: u64,
    /// 今日漫游零食已回复的精力点数（wanderSnackDailyCap 上限）。
    #[serde(default)]
    pub snack_stamina: u64,
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
    /// Token→精力的按项目增量锚点（progress 账本的原始 total_tokens 口径）。
    #[serde(default)]
    pub last_seen_project_tokens: BTreeMap<String, u64>,
    /// v2 遗留字段：旧二进制反序列化时必填，缺失会静默重建存档（降级丢档）。
    /// v3 起恒为空表，仅为降级保险继续序列化一个版本，之后删除。
    #[serde(default)]
    pub last_seen_project_experience: BTreeMap<String, u64>,
    pub daily: DailyCounters,
    pub tutorial_step: u8,
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
pub struct WanderSnackResult {
    pub save: GameSave,
    pub stamina_gained: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleasePetResult {
    pub save: GameSave,
    pub refund: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameConfigPayload {
    pub test_mode: bool,
    pub config: GameConfig,
}

/// 能量喂养的来源（换算率与每宠缓冲按来源区分）。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EnergySource {
    Keys,
    Tokens,
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

/// 能量喂养结果。只描述精力——喂养永不产出金币/经验（经济不变量）。
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnergyFeedOutcome {
    pub per_pet: Vec<PetStaminaGain>,
    pub stamina_fed: i64,
    /// 全员满管后丢弃的源单位数（键次 / tokens）。
    pub wasted: u64,
    pub woke_pet_ids: Vec<String>,
}
