export type PetEventType =
  | "user_click"
  | "user_work_click"
  | "user_drag_start"
  | "user_drag_move"
  | "user_drag_end"
  | "pet_idle"
  | "pet_move_start"
  | "pet_move"
  | "pet_move_stop"
  | "pet_sleep_start"
  | "pet_exhausted"
  | "pet_wake"
  | "agent_thinking_start"
  | "agent_work_start"
  | "agent_work_finish"
  | "agent_tool_start"
  | "agent_tool_finish"
  | "agent_token_gain"
  | "agent_error";

export type PetState =
  | "idle"
  | "sleeping"
  | "clicked"
  | "laboring"
  | "exhausted"
  | "drag_start"
  | "dragging"
  | "drop"
  | "moving"
  | "thinking"
  | "working"
  | "success"
  | "fed"
  | "error";

export type PetEvent = {
  type: PetEventType;
  timestamp: string;
};

/** 动态台词条目（后台 CLI 预生成，`quotes://ready` 推送 / `get_dynamic_quotes` 拉取）。
 *  形状与前端静态台词一致，供随机台词 50/50 混用（App.tsx setDynamicQuotes）。 */
export type DynamicQuote = {
  id: string;
  lang: "zh" | "en";
  text: string;
  tags: string[];
};

export type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
};

export type CodexActivityEvent = {
  source: "codex" | "claudeCode" | string;
  sessionId: string;
  timestamp: string;
  kind:
    | "session_started"
    | "message_seen"
    | "tool_started"
    | "tool_finished"
    | "token_count"
    | "error"
    | PetEventType;
  projectPath?: string;
  tokenDelta: number;
  experienceDelta: number;
  projectTotalTokens: number;
  projectExperience: number;
  /** 本次事件实际喂进宠物的精力点数（game 层，token→精力，v1.1）。 */
  fedStamina: number;
  /** 本次喂养的主要受益宠（份额最大者；Token 飞行 FX 的锚点）。 */
  fedPetId?: string | null;
  totalUsage?: TokenUsage;
  lastUsage?: TokenUsage;
};

export type CodexStatus = {
  codexHome?: string;
  claudeHome?: string;
  watching: boolean;
  codexWatching: boolean;
  claudeCodeWatching: boolean;
  latestSession?: string;
  activeSource?: "codex" | "claudeCode" | string;
  projectPath?: string;
  error?: string;
  totalTokens: number;
  experience: number;
};

// ---------------------------------------------------------------------------
// Game (mirrors src-tauri/src/game.rs + game_config.rs — keep in sync)
// ---------------------------------------------------------------------------

export type ElementId = "normal" | "fire" | "electric" | "water" | "grass" | "ice";

export type PetInstance = {
  id: string;
  species: string;
  tier: number;
  level: number;
  exp: number;
  stamina: number;
  staminaUpdatedAt: number;
  exhausted: boolean;
  /** 键盘充能换算余数（还差多少键满下一点精力，< keysPerStaminaFor(tier)）。 */
  keyBuffer: number;
  /** Token 喂食换算余数（< tokensPerStaminaFor(tier)）。 */
  tokenBuffer: number;
  /** Steam 物品实例 id(十进制字符串——u64 超 JS 安全整数,不得转 number)。
   *  缺省 = 未上链(待发放或本地遗留)。 */
  steamItemId?: string | null;
  /** 绑定物品的 itemdefid(AI 自定义物种绑其配方目录物种的 def)。 */
  steamItemDef?: number | null;
};

export type EggInstance = {
  id: string;
  species: string;
  tier: number;
  hatchKind: string;
  slot?: number | null;
  hatchAt?: number | null;
  /** AI 融合蛋的生成任务信息；普通蛋无此字段。species 初始为兜底 guluduck，
   *  生成成功后被改写为新物种 codename（status=resolved）。 */
  pendingFusion?: PendingFusionInfo | null;
  /** Steam 物品实例 id(仅二阶融合蛋;一阶蛋不上 Steam)。 */
  steamItemId?: string | null;
  steamItemDef?: number | null;
};

export type DailyCounters = {
  date: string;
  /** 今日已消耗精力的有效点击数（全局 dailyClickCap 上限）。 */
  clicks: number;
  /** 今日漫游零食已回复的精力点数（wanderSnackDailyCap 上限）。 */
  snackStamina: number;
};

export type GameSave = {
  version: number;
  coins: number;
  pets: PetInstance[];
  eggs: EggInstance[];
  hatcheryLevel: number;
  yardLevel: number;
  /** 商店等级 = 可售最高蛋阶（1~shopMaxLevel）。EconomyScaling.md §6.1。
   *  镜像 Rust GameSave.shopLevel（serde default 1；旧存档缺失按初始商店）。 */
  shopLevel?: number;
  activePetId?: string | null;
  /** Token→精力的按项目增量锚点（progress 账本原始 totalTokens 口径）。 */
  lastSeenProjectTokens: Record<string, number>;
  /** v2 遗留字段：恒为空表，仅为旧二进制降级兼容保留一个版本。 */
  lastSeenProjectExperience?: Record<string, number>;
  daily: DailyCounters;
  tutorialStep: number;
  lastSeenAt: number;
  /** AI 融合诞生的自定义物种（codename → 完整设定），随存档持久化。 */
  customSpecies: Record<string, CustomSpeciesEntry>;
  /** 绑定的 Steam 账号(SteamID64 十进制字符串)。 */
  steamOwnerId?: string | null;
  /** Steam 操作队列:mintTier1 待发放 + fuse/collectT2/release 写前意图。 */
  steamOutbox?: SteamOp[];
  /** 对账减员的等级墓碑(≤100 FIFO)。 */
  steamTombstones?: SteamTombstone[];
  /** 图鉴"曾获得"账本(物种 codename → 累计曾获只数)。孵出即 +1、放生/融合消耗不减；
   *  ≥1 即图鉴已收集。见 docs/gdd/PokedexSystem.md §2。镜像 Rust GameSave.dexObtained。 */
  dexObtained?: Record<string, number>;
  /** 每配方的 AI 变种槽注册表(配方键 → [1号codename,2号codename,…]，顺序即槽号)。
   *  长度 = 已生成 AI 变种数(0..=10)。见 FusionRecipeSlots.md §5。镜像 Rust recipeAiSlots。 */
  recipeAiSlots?: Record<string, string[]>;
};

// ---------------------------------------------------------------------------
// Steam 同步(mirrors src-tauri/src/game.rs SteamOp / steam.rs SteamStatus)
// ---------------------------------------------------------------------------

export type SteamOp =
  | {
      kind: "mintTier1";
      opId: string;
      petId: string;
      species: string;
      def: number;
      attempts?: number;
      nextRetryAt?: number;
    }
  | {
      kind: "fuse";
      opId: string;
      petA: string;
      petB: string;
      itemA: string;
      itemB: string;
      eggDef: number;
      recipeKey: string;
    }
  | { kind: "collectT2"; opId: string; eggId: string; eggItem: string; eggDef: number }
  | { kind: "release"; opId: string; petId: string; itemId: string };

export type SteamTombstone = {
  itemId: string;
  species: string;
  tier: number;
  level: number;
  exp: number;
  removedAt: number;
};

/** steam://status 事件载荷(mirrors src-tauri/src/steam.rs SteamStatus)。 */
export type SteamStatus = {
  /** "connected" | "unavailable" | "disabled"(集成总开关关闭,纯本地模式) */
  mode: string;
  pendingMints: number;
  unclaimedImports: number;
  ownerMismatch: boolean;
  lastSyncAt?: number | null;
  steamId?: string | null;
  appId: number;
};

export type ClickWorkResult = {
  save: GameSave;
  coinsGained: number;
  expGained: number;
  leveledUp: boolean;
  becameExhausted: boolean;
  /** 日额度已用尽：本次点击零消耗零产出，前端播纯抚摸特效。 */
  dailyCapped: boolean;
};

export type WanderSnackResult = {
  save: GameSave;
  staminaGained: number;
};

/** 单宠精力增益（game://stamina 与能量喂养结果的条目）。 */
export type PetStaminaGain = {
  petId: string;
  staminaGained: number;
  staminaAfter: number;
};

/** game://stamina 轻量补丁事件（键盘/零食入账；不推全量存档）。 */
export type StaminaPatchEvent = {
  source: "keys" | "tokens" | "snack";
  perPet: PetStaminaGain[];
  wokePetIds: string[];
};

/** 能量喂养结果（mirrors game.rs EnergyFeedOutcome）。 */
export type EnergyFeedOutcome = {
  perPet: PetStaminaGain[];
  staminaFed: number;
  /** 全员满管后丢弃的源单位数（键次 / tokens）。 */
  wasted: number;
  wokePetIds: string[];
};

/** game://keys 键帽特效批次（纯表现；键身份仅存在于本事件，不落盘）。 */
export type KeyFxEvent = {
  labels: string[];
};

/** 应用设置（设备/隐私偏好；mirrors settings.rs AppSettings）。托盘菜单与
 *  设置面板共用，任一处改动经 settings://changed 广播同步。 */
export type AppSettings = {
  keyboardCapture: boolean;
  alwaysOnTop: boolean;
  randomMovement: boolean;
  /** 界面语言码（"zh" | "en"；留字符串以便扩展更多语言）。 */
  language: string;
};

export type ReleasePetResult = {
  save: GameSave;
  refund: number;
};

export type ElementInfo = {
  nameZh: string;
  color: string;
  badge: string;
};

export type SpeciesInfo = {
  nameZh: string;
  /** 旧模型物种自带阶数(1/2)；融合 2.0 的 57 新物种不带此字段(视为 0，华丽度看 elements.length)。 */
  tier?: number;
  elements: string[];
  colors: string[];
  body: string;
  desc: string;
  /** Steam Inventory itemdefid(编号规则见 plans/steam_trade/00-decisions.md,
   *  一经上传不可回改)。缺省/0 = 未映射(AI 自定义物种)。 */
  steamItemDef?: number;
};

export type GameConfig = {
  initialCoins: number;
  historicalExpCoinCap: number;
  eggPrices: Record<string, number>;
  tier2EggPriceBonus: number;
  hatchSeconds: Record<string, number>;
  /** 品阶成长系数：恢复需求与点击收益按 factor^(tier−1) 缩放。 */
  tierGrowthFactor: number;
  clickCoinsBase: number;
  clickCoinsPerLevel: number;
  clickExpBase: number;
  /** 账号级每日有效点击上限（唯一的经验/金币水龙头总闸）。 */
  dailyClickCap: number;
  staminaMax: number;
  staminaPerClick: number;
  /** 1 阶每回复 1 点精力所需秒数（实际按阶 ×tierFactor）。 */
  staminaRegenSecondsBase: number;
  wakeThreshold: number;
  tickSeconds: number;
  /** 1 阶每 1 点精力需要的按键数（实际按阶 ×tierFactor）。 */
  keysPerStaminaBase: number;
  /** 键盘充能的计数限速（次/秒，防宏）。 */
  keyRateCapPerSec: number;
  /** 1 阶每 1 点精力需要的 token 数（实际按阶 ×tierFactor）。 */
  tokensPerStaminaBase: number;
  wanderSnackStaminaMin: number;
  wanderSnackStaminaMax: number;
  wanderSnackDailyCap: number;
  levelExpFactor: number[];
  maxLevel: number[];
  fusionFee: number;
  hatcherySlots: number[];
  hatcheryUpgradeCosts: number[];
  yardCapacity: number[];
  yardUpgradeCosts: number[];
  releaseRefundRate: number;
  releaseRefundPerLevel: number;
  elements: Record<string, ElementInfo>;
  species: Record<string, SpeciesInfo>;
  fusionTable: Record<string, string>;
  /** 融合掷骰走 AI 生成的概率（0~1，全局默认）。旧模型字段，融合 2.0 已由槽位阶梯取代。 */
  aiFusionChance: number;
  /** 按配方（fusionTable 排序键）覆盖 AI 概率，将来逐配方调整用。 */
  aiFusionChanceByRecipe?: Record<string, number>;
  // ---- 融合 2.0（FusionSystem.md / FusionRecipeSlots.md）----
  /** 配方键（元素集合并集）→ 0 号固定物种 codename。63 键全覆盖。 */
  speciesByRecipe?: Record<string, string>;
  /** 按亲代阶数的融合费（索引 = 亲代阶数 − 1，1~6 阶）。 */
  fusionFees?: number[];
  /** 融合等效蛋价加成（放生返还用，取代 tier2EggPriceBonus）。 */
  fusionEggPriceBonus?: number;
  /** 触发 AI 变种的总概率（key = 元素数 "2".."6" → 概率 0~1）。FusionRecipeSlots §3.2。 */
  aiTotalChanceByElementCount?: Record<string, number>;
  // ---- 经济纵深（EconomyScaling.md）----
  /** 分阶蛋价乘数：T 阶蛋价 = 1 阶基价 × 此值^(阶−1)（默认 15）。 */
  eggTierPriceMultiplier?: number;
  /** 商店最高等级 = 可售最高蛋阶（默认 4；5~6 阶纯融合专属）。 */
  shopMaxLevel?: number;
  /** 商店升级费（索引 = 当前 shopLevel − 1；Lv1→2 / 2→3 / 3→4）。 */
  shopUpgradeCosts?: number[];
  /** 蛋池元素数稀有度衰减分母：整数权重 w(c)=denom^(6−c)（denom=3 → falloff 1/3）。 */
  eggRarityFalloffDenom?: number;
};

export type GameConfigPayload = {
  testMode: boolean;
  config: GameConfig;
};

// ---------------------------------------------------------------------------
// AI fusion (mirrors src-tauri/src/game.rs + fusion_gen.rs — keep in sync)
// ---------------------------------------------------------------------------

/** 自定义部件的单个图形节点。结构化 JSON 白名单渲染（不接受原始 SVG 字符串）。
 *  fill/stroke 允许调色板 token（$body/$deep/$belly/$accent/$accent2/$outline）
 *  或 #rrggbb。 */
export type ShapeNode = {
  type: "path" | "circle" | "ellipse" | "rect" | "polygon" | "line";
  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number | null;
  strokeLinecap?: string | null;
  strokeLinejoin?: string | null;
  fillRule?: string | null;
  opacity?: number | null;
  transform?: string | null;
  d?: string | null;
  cx?: number | null;
  cy?: number | null;
  r?: number | null;
  rx?: number | null;
  ry?: number | null;
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
  points?: string | null;
  x1?: number | null;
  y1?: number | null;
  x2?: number | null;
  y2?: number | null;
};

/** AI 完全重绘的自定义部件（画在槽位局部坐标系里）。 */
export type CustomPart = {
  kind: "custom";
  nodes: ShapeNode[];
};

/** 槽位取值：部件目录 id 或自定义部件。 */
export type SlotSpec = string | CustomPart;

export type CustomPalette = {
  body: string;
  deep: string;
  belly: string;
  accent: string;
  accent2?: string | null;
};

/** chimera 参数化身体（rig="chimera" 时使用；镜像 sprites/rigTypes.ChimeraForm）。 */
export type ChimeraForm = {
  bodyPlan: "stack" | "round" | "upright" | "quadruped" | "long" | "floaty" | "bighead";
  segments: number;
  bodyW: number;
  bodyH: number;
  taper: number;
  headStyle: "merged" | "perched";
  headScale: number;
  legStyle: "none" | "stub" | "tall";
  legCount: number;
  armStyle: "none" | "nub" | "wing" | "flipper";
  earStyle: "none" | "round" | "point" | "long" | "fin";
  floating: boolean;
};

/** 打工特效的单个粒子造型（±14 局部坐标的小图形，ShapeNode 白名单渲染）。 */
export type WorkFxParticle = {
  nodes: ShapeNode[];
};

/** AI 为角色设计的专属满屏打工粒子（2~3 种造型，点击打工时喷向全屏）。 */
export type CustomWorkFx = {
  particles: WorkFxParticle[];
};

/** AI 生成物种的视觉规格（CLI 输出经校验后的形态）。 */
export type CustomVisualSpec = {
  rig: string;
  scale: number;
  palette: CustomPalette;
  eyes?: string | null;
  toolId?: string | null;
  floating?: boolean;
  slots: Record<string, SlotSpec>;
  /** rig="chimera" 时的参数化身体（AI 融合新剪影）。 */
  form?: ChimeraForm | null;
  /** 角色专属打工粒子（缺省时渲染层按调色板合成兜底）。 */
  workFx?: CustomWorkFx | null;
};

/** 存档里的一条自定义物种记录。 */
export type CustomSpeciesEntry = {
  info: SpeciesInfo;
  visual: CustomVisualSpec;
  parents: string[];
  createdAt: number;
  generator: string;
};

export type PendingFusionStatus = "pending" | "generating" | "resolved" | "failed";

export type PendingFusionInfo = {
  parents: string[];
  recipeKey: string;
  requestedAt: number;
  attempts: number;
  status: PendingFusionStatus;
  lastError?: string | null;
};

export type FusionCliStatus = {
  available: boolean;
  provider?: string | null;
  version?: string | null;
  path?: string | null;
  error?: string | null;
};

export type FusionProgress = {
  eggId: string;
  phase: "queued" | "generating" | "retrying" | "validating" | "resolved" | "failed";
  provider?: string | null;
  attempt: number;
  message?: string | null;
  elapsedSecs: number;
};

export type FusionStartResult = {
  mode: "recipe" | "ai";
  save: GameSave;
  eggId: string;
  species?: string | null;
};
