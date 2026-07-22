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

/** Token 四分明细（互不重叠；四项之和 = raw 总量）。mirrors Rust TokenBreakdown。 */
export type TokenBreakdown = {
  input: number;
  cacheCreate: number;
  cacheRead: number;
  output: number;
};

export const EMPTY_BREAKDOWN: TokenBreakdown = {
  input: 0,
  cacheCreate: 0,
  cacheRead: 0,
  output: 0,
};

export function breakdownTotal(b: TokenBreakdown): number {
  return b.input + b.cacheCreate + b.cacheRead + b.output;
}

export type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  /** 四分明细（见 `TokenBreakdown`）；`breakdownTotal()` 恒等于 totalTokens。 */
  breakdown: TokenBreakdown;
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
  /** 本事件新增的产出 token（output-only；v1.2 喂养口径，餐级/Toast 数字用）。 */
  outputTokenDelta: number;
  /** 项目累计产出 token（喂养账本口径；input/cache 不计）。 */
  projectOutputTokens: number;
  /** 项目累计四分明细（统计详情 + 加权喂养账本锚点）。 */
  projectBreakdown: TokenBreakdown;
  /** 本次事件实际喂进陪伴宠的经验点数（game 层，token→经验，2026-07-21 起）。 */
  fedExp: number;
  /** 本次喂养是否触发陪伴宠升级（庆祝演出用）。 */
  fedLeveledUp: boolean;
  /** 本次真正吃进去的四分 token（未加权原始增量；气泡文案报明细用）。 */
  fedBreakdown: TokenBreakdown;
  /** 吃到这餐的陪伴宠（Token 飞行 FX 的锚点；无陪伴宠时缺省）。 */
  fedPetId?: string | null;
  totalUsage?: TokenUsage;
  lastUsage?: TokenUsage;
};

/** 单个时间窗的 Token 统计：raw 总量（含 cache_read）+ 四分明细。
 *  Rust 侧 `breakdown` 用 serde flatten，故四分与 total 同层。 */
export type TokenWindow = {
  total: number;
} & TokenBreakdown;

export const EMPTY_TOKEN_WINDOW: TokenWindow = { total: 0, ...EMPTY_BREAKDOWN };

/** 全局 Token 累计的多时间窗聚合。默认展示 `all`，公告板可切 1d/1w/1m。 */
export type TokenStats = {
  all: TokenWindow;
  d1: TokenWindow;
  w1: TokenWindow;
  m1: TokenWindow;
};

export type TokenRange = keyof TokenStats;

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
  tokenStats: TokenStats;
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
  /** Token 喂养换算余数（还差多少加权 Token 满下一点经验，< tokensPerExp）。 */
  tokenBuffer: number;
  /** Steam 物品实例 id(十进制字符串——u64 超 JS 安全整数,不得转 number)。
   *  缺省 = 未同步 Steam(待发放或本地遗留)。 */
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
  /** Steam 物品实例 id。旧流 = 蛋物品(301-321);融合 2.0 同步流 = 结果宠物物品。 */
  steamItemId?: string | null;
  steamItemDef?: number | null;
  /** 商店蛋的购买属性(EconomyScaling §7):Steam-first 收取定位商店生成器用。 */
  shopElement?: string | null;
};

export type DailyCounters = {
  date: string;
  /** 今日已消耗精力的有效点击数（全局 dailyClickCap 上限）。 */
  clicks: number;
  /** 今日各「元素:阶」蛋已生产数（EconomyScaling.md §7.5 每日产出上限；键 = `"{element}:{tier}"`）。 */
  eggMints?: Record<string, number>;
  /** 今日各「元素:阶」商店蛋成功收取数（收取侧镜像，键同 eggMints；空发放归因用）。 */
  eggCollects?: Record<string, number>;
  /** 今日各配方已融合次数（§7.5 每日融合上限；键 = 结果配方集合键，如 `"fire+water"`）。 */
  fusionMints?: Record<string, number>;
  /** 昨日战报新增的当日计数（翻日归档进 lastDayDigest）；全部可选，旧档默认 0/false。 */
  keys?: number;
  hatches?: number;
  coinsEarned?: number;
  releases?: number;
  nightOwl?: boolean;
};

/** 某一本地日结束时归档的「当日战报」（WelcomeBack 昨日总结）。镜像 Rust DailyDigest。
 *  map 类计数已在 Rust 侧折算为标量总和；Token 不在此（按 dayIndex 另取每日桶）。 */
export type DailyDigest = {
  date: string;
  dayIndex: number;
  clicks: number;
  keys: number;
  hatches: number;
  fusions: number;
  eggsMinted: number;
  eggsCollected: number;
  coinsEarned: number;
  releases: number;
  nightOwl: boolean;
};

/** 「昨日战报」命令 get_yesterday_summary 的返回（镜像 Rust DaySummary）。游戏统计来自
 *  存档归档，Token（tokensRaw + tokenBreakdown，raw 含 cache_read）来自 codex 每日桶。 */
export type DaySummary = {
  date: string;
  dayIndex: number;
  /** dayIndex 是否正好是「今天的前一天」（否则前端标「上次开工」）。 */
  isYesterday: boolean;
  /** 是否有真实归档（false = 尚无昨日战报，Token 仍可能非零）。 */
  hasDigest: boolean;
  tokensRaw: number;
  tokenBreakdown: TokenBreakdown;
  clicks: number;
  keys: number;
  hatches: number;
  fusions: number;
  eggsMinted: number;
  coinsEarned: number;
  releases: number;
  nightOwl: boolean;
};

/** 终身统计（Steam 成就判定用，SteamAchievements.md §3）。镜像 Rust LifetimeStats
 *  （全 serde default）；全部可选，旧档零成本迁移。判定见 game/achievements.ts。 */
export type LifetimeStats = {
  totalClicks?: number;
  totalCoinsEarned?: number;
  totalFusions?: number;
  totalReleases?: number;
  totalTokensFed?: number;
  totalKeysCharged?: number;
  highestTier?: number;
  daysPlayed?: number;
  loginStreak?: number;
  lastLoginDate?: string;
  firstMaxlevelDone?: boolean;
  firstReleaseDone?: boolean;
  dailyCapReachedEver?: boolean;
  nightOwl?: boolean;
};

/** achievement://unlocked 事件载荷（镜像 Rust AchievementUnlock）。
 *  仅带 id；id→显示名映射在 game/achievements.ts。 */
export type AchievementUnlock = { id: string };

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
  /** Token 喂养的按项目增量锚点（v1.2 起为产出 outputTokens 口径，旧 raw 基线自愈换锚；2026-07-21 起喂的是经验）。 */
  lastSeenProjectTokens: Record<string, number>;
  /** v2 遗留字段：恒为空表，仅为旧二进制降级兼容保留一个版本。 */
  lastSeenProjectExperience?: Record<string, number>;
  daily: DailyCounters;
  /** 上一个本地日结束时归档的「当日战报」（WelcomeBack 昨日总结数据源）；无归档为 null。 */
  lastDayDigest?: DailyDigest | null;
  /** 云同步单调修订号（每次落盘 +1；Steam 云存档冲突判新旧）。SteamCloudSync.md。 */
  cloudRevision?: number;
  /** 清档夺权标记（连线时强制推云、跳过采纳）；仅后端置位，前端不用。 */
  cloudForcePush?: boolean;
  tutorialStep: number;
  /** 教学硬编码：是否已购买过首颗商店蛋（首购蛋固定 30s，OnboardingCoach.md §3.1）。 */
  tutorialFirstEggBought?: boolean;
  /** 教学硬编码：是否已完成首次融合（首融必产经典配方 + 5min 孵化，OnboardingCoach.md §3.1）。 */
  tutorialFirstFusionDone?: boolean;
  lastSeenAt: number;
  /** AI 融合诞生的自定义物种（codename → 完整设定），随存档持久化。 */
  customSpecies: Record<string, CustomSpeciesEntry>;
  /** 绑定的 Steam 账号(SteamID64 十进制字符串)。 */
  steamOwnerId?: string | null;
  /** Steam 操作队列:mintTier1 待发放 + fuse/collectT2/release 写前意图。 */
  steamOutbox?: SteamOp[];
  /** 对账减员的等级墓碑(≤100 FIFO)。 */
  steamTombstones?: SteamTombstone[];
  /** 已处理创意工坊认领的 AI 变种(codename → publishedFileId 字符串;"" = 他人已认领)。
   *  镜像 Rust GameSave.workshopPublished。 */
  workshopPublished?: Record<string, string>;
  /** 已给本机工坊物品挂上设定图缩略图的 codename 集合。镜像 Rust workshopPreviewDone。 */
  workshopPreviewDone?: string[];
  /** 图鉴"曾获得"账本(物种 codename → 累计曾获只数)。孵出即 +1、放生/融合消耗不减；
   *  ≥1 即图鉴已收集。见 docs/gdd/PokedexSystem.md §2。镜像 Rust GameSave.dexObtained。 */
  dexObtained?: Record<string, number>;
  /** 每配方的 AI 变种槽注册表(配方键 → [1号codename,2号codename,…]，顺序即槽号)。
   *  长度 = 已生成 AI 变种数(0..=10)。见 FusionRecipeSlots.md §5。镜像 Rust recipeAiSlots。 */
  recipeAiSlots?: Record<string, string[]>;
  /** 最近一次商店蛋成功收取时刻(秒;未收过=0)。空发放归因「冷却中」vs「今日领满」。
   *  跨日不清零。镜像 Rust GameSave.lastShopDropAt。 */
  lastShopDropAt?: number;
  /** 每 AI 物种已导入的创意工坊皮肤(codename → 列表;按 publishedFileId 去重,封顶 20)。
   *  允许先于物种获得而入库(图鉴神秘槽显示徽章)。镜像 Rust GameSave.speciesSkins。 */
  speciesSkins?: Record<string, SpeciesSkin[]>;
  /** 每 AI 物种当前选中皮肤(codename → "default" | "local" | "ws:<fileId>";
   *  缺省键 = "local" 本机形象)。按物种统一生效。镜像 Rust GameSave.skinSelected。 */
  skinSelected?: Record<string, string>;
  /** 终身统计（Steam 成就判定，SteamAchievements.md）。镜像 Rust GameSave.stats。 */
  stats?: LifetimeStats;
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
      /** 材料 A 物品 id；**空("")= 尚未同步 Steam**，泵按 matDefA 先铸再填回（不阻挡融合/新手引导）。 */
      itemA: string;
      /** 材料 B 物品 id；空同上。 */
      itemB: string;
      eggDef: number;
      recipeKey: string;
      /** true = 本地先行（二阶：即时应用，ExchangeItems 由泵烧材料+铸结果回绑到 eggId/petId）；
       *  省略/false = 旧写前意图（三阶+ Steam 先行）。 */
      applied?: boolean;
      /** 材料 A/B 待铸的一阶 def（itemA/itemB 为空时泵先 TriggerItemDrop 铸出；已同步 Steam=0）。 */
      matDefA?: number;
      matDefB?: number;
      /** 本地先行结果要回绑的蛋（前向融合）。 */
      eggId?: string | null;
      /** 本地先行结果要回绑的宠（存量二阶修复）。 */
      petId?: string | null;
      /** def 落定时 AI 槽解析用的双亲物种。 */
      parents?: [string, string] | null;
      attempts?: number;
      nextRetryAt?: number;
    }
  | { kind: "collectT2"; opId: string; eggId: string; eggItem: string; eggDef: number }
  | {
      kind: "release";
      opId: string;
      petId: string;
      itemId: string;
      /** 本地效果已应用(2026-07-18 本地先行放生;旧写前意图缺省 false)。 */
      applied?: boolean;
      attempts?: number;
      nextRetryAt?: number;
    };

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
  /** 本地先行放生后待 ConsumeItem 收敛的只数(后台限频重试中)。 */
  pendingReleases?: number;
  unclaimedImports: number;
  ownerMismatch: boolean;
  lastSyncAt?: number | null;
  steamId?: string | null;
  appId: number;
  /** 创意工坊上传成功但用户尚未接受《创意工坊法律协议》(物品对他人隐藏)。 */
  workshopLegalPending: boolean;
  /** Steam 云存档是否可用(应用级 && 账号级都开)。false = 关云/未配额,纯本地。SteamCloudSync.md。 */
  cloudEnabled?: boolean;
  /** 最近一次云同步(推或拉成功)的时刻(秒);从未同步为 null。 */
  lastCloudSyncAt?: number | null;
  /** 云端存档三件套总字节(诊断展示)。 */
  cloudBytes?: number | null;
};

/** debug_steam_delete_all_workshop 结果(mirrors steam.rs WorkshopClearReport)。 */
export type WorkshopClearReport = {
  /** 成功删除的工坊物品数。 */
  deleted: number;
  /** 删除失败的物品数(详见后端日志)。 */
  failed: number;
};

/** steam_import_pets 结果(mirrors steam_sync.rs ImportPetsReport;unclaimedItems 不下发)。 */
export type SteamImportSummary = {
  /** 本次导入到后院的只数。 */
  imported: number;
  /** 后院已满、留在 Steam 待认领的只数。 */
  skippedCapacity: number;
  changed: boolean;
};

/** 社区市场真实行情(mirrors steam_market.rs MarketPrice;价格字符串含币种符号)。 */
export type SteamMarketPrice = {
  /** 已格式化的最低挂单价,如 "¥ 0.68"。无挂单时缺省。 */
  lowestPrice?: string | null;
  medianPrice?: string | null;
  /** 近 24h 成交量,如 "1,234"。 */
  volume?: string | null;
  currency: number;
  marketHashName: string;
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

/** 单宠精力增益（game://stamina 与键盘充能结果的条目）。 */
export type PetStaminaGain = {
  petId: string;
  staminaGained: number;
  staminaAfter: number;
};

/** game://stamina 轻量补丁事件（键盘入账；不推全量存档）。
 *  2026-07-21 起精力只来自键盘与自然恢复，source 恒 "keys"。 */
export type StaminaPatchEvent = {
  source: "keys";
  perPet: PetStaminaGain[];
  wokePetIds: string[];
};

/** 键盘充能结果（mirrors game model.rs EnergyFeedOutcome；只喂陪伴宠，
 *  perPet 至多一条）。 */
export type EnergyFeedOutcome = {
  perPet: PetStaminaGain[];
  staminaFed: number;
  /** 陪伴宠缺席/已满管而丢弃的键次。 */
  wasted: number;
  wokePetIds: string[];
};

/** Token 喂养结果 = `game://exp` 轻量补丁事件（mirrors game model.rs
 *  TokenFeedOutcome）。2026-07-21 起 Token → 经验，只喂陪伴宠。 */
export type TokenFeedOutcome = {
  /** 吃到这餐的陪伴宠（null = 无陪伴宠，整段浪费）。 */
  petId?: string | null;
  expGained: number;
  leveledUp: boolean;
  /** 入账后的等级/级内经验（本地补丁陪伴宠用，免拉全量存档）。 */
  levelAfter: number;
  expAfter: number;
  /** 陪伴宠满级/缺席而丢弃的加权 Token 单位数。 */
  wasted: number;
  /** 本次真正吃进去的四分 token（未加权原始增量）。 */
  fedBreakdown: TokenBreakdown;
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
  /** 开机自动启动（默认关闭）。真源为操作系统注册项，get_settings 读取时对账。 */
  autostart: boolean;
  /** 「融合领新宠 → 引导开机自启」弹窗已展示次数（0..=3；加入自启或到上限后不再弹）。 */
  autostartPromptCount: number;
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
  /** 英文名。目录物种留空(英文名由 codename TitleCase 求得)；AI 融合物种由生成器填专有英文名。 */
  nameEn?: string;
  /** 旧模型物种自带阶数(1/2)；融合 2.0 的 57 新物种不带此字段(视为 0，华丽度看 elements.length)。 */
  tier?: number;
  elements: string[];
  colors: string[];
  body: string;
  desc: string;
  /** 英文图鉴文案。目录物种留空(英文文案在 SPECIES_EN_DESC 表)；AI 物种由生成器填。 */
  descEn?: string;
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
  /** 每 1 点经验需要的加权 Token 单位数，**按阶数组**（索引=阶−1）。按阶递减，
   *  抵消 levelExpFactor 的 ×10/阶暴涨，把「吃 Token 满级」单位量 T1→T6 从
   *  天然 ~11 万× 压回约 1000×（取率走 tokensPerExp() 访问器）。 */
  tokensPerExp: number[];
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
  /** 每日蛋产出上限（索引 = 蛋阶 − 1，[10,8,6,3]，全 ≤10=Steam drop_max_per_window 上限）；
   *  游戏内拒绝 + Steam 24h 窗口封顶的共同上限（§7.5）。 */
  eggDailyMintCaps?: number[];
  /** 每日融合上限（索引 = 结果配方元素数 − 1，[5,5,2,2,1,1]）；按配方键计数（§7.5）。 */
  fusionDailyMintCaps?: number[];
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

/** 打工特效的单个粒子造型：二选一——`nodes` 自绘（±14 局部坐标的 ShapeNode 白名单
 *  小图形），或 `ref` 引用打工粒子目录（workFx.tsx 的 WORK_PARTICLE_CATALOG /
 *  fusionParts.json 的 workParticles 里的 id）。镜像 Rust serde 可选字段。 */
export type WorkFxParticle = {
  nodes?: ShapeNode[] | null;
  ref?: string | null;
};

/** AI 为角色设计的专属满屏打工粒子（2~3 种造型，点击打工时喷向全屏）。 */
export type CustomWorkFx = {
  particles: WorkFxParticle[];
};

/** AI 完全手绘的"专属 rig"里一个视图的部件几何（镜像 sprites/rigTypes.RigViewParts）。 */
export type RigViewParts = {
  body: ShapeNode[];
  bodyY?: number;
  head: ShapeNode[];
  headY: number;
  headX?: number;
  face: {
    eyeR: number;
    eyeDx?: number;
    eyeCx?: number;
    eyeDy?: number;
    mouthDx?: number;
    mouthDy?: number;
    mouthW?: number;
    /** 嘴的归属：默认/缺省 "engine"=引擎画会动的嘴；"beak"=生物自带硬喙/长吻，
     *  由 muzzle 自绘嘴型、引擎不再叠嘴（只画会动的眼），杜绝双嘴。 */
    mouth?: "engine" | "beak";
  };
  belly?: ShapeNode[];
  armL?: ShapeNode[];
  armR?: ShapeNode[];
  armY?: number;
  armSpread?: number;
  legL?: ShapeNode[];
  legR?: ShapeNode[];
  legY?: number;
  legSpread?: number;
  tail?: ShapeNode[];
  tailAt?: { x?: number; y?: number; rot?: number };
  headTop?: ShapeNode[];
  headTopAt?: { x?: number; y?: number };
  /** 面部点缀层（鼻/颊/须/眉/獠牙等**眼嘴之外**的五官；喙/长吻仅在 face.mouth="beak"
   *  时在此画当嘴）。画在 head 与引擎眼嘴之间；绝不画眼珠、软脸不画嘴。 */
  muzzle?: ShapeNode[];
  decor?: ShapeNode[];
  toolAt?: { x?: number; y?: number };
};

/** AI 完全手绘的"专属 rig"（三视图各自作画；镜像 sprites/rigTypes.CustomRig）。 */
export type CustomRig = {
  front: RigViewParts;
  side?: RigViewParts;
  lie?: RigViewParts;
  floating?: boolean;
};

/** AI 生成物种的视觉规格（CLI 输出经校验后的形态）。 */
export type CustomVisualSpec = {
  rig: string;
  scale: number;
  palette: CustomPalette;
  eyes?: string | null;
  /** 眼睛虹膜色（palette token 或 #rrggbb）；缺省纯黑瞳。 */
  iris?: string | null;
  /** 待机嘴型（smile/cat/fang/smirk/open/pout/flat）；缺省 smile。 */
  mouthStyle?: string | null;
  toolId?: string | null;
  floating?: boolean;
  slots: Record<string, SlotSpec>;
  /** rig="chimera" 时的参数化身体（AI 融合新剪影）。 */
  form?: ChimeraForm | null;
  /** rig="custom" 时的完全手绘部件几何（一物种一套，优先于 form）。 */
  customRig?: CustomRig | null;
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
  /** 出处:"local" = 本机 CLI 生成;"workshop" = 工坊下载的他人设计;
   *  缺省 = v6 之前的存量条目(不可知,不得据此重发布)。镜像 Rust origin。 */
  origin?: string | null;
};

/** 皮肤获取途径:"first" 首发者形象 | "shared" 分享文本/上传者列表安装。 */
export type SpeciesSkinSource = "first" | "shared";

/** 某 AI 物种已导入的一张创意工坊皮肤(SkinWorkshop.md;镜像 Rust SpeciesSkin)。 */
export type SpeciesSkin = {
  /** `"ws:<fileId>"` —— skinSelected 的取值主键。 */
  id: string;
  visual: CustomVisualSpec;
  /** 上传者给该形象起的名字(皮肤卡标题;物种本名不受皮肤影响)。 */
  nameZh: string;
  /** 上传者 SteamID64(十进制字符串)。 */
  authorSteamId: string;
  /** 上传者昵称(best-effort;拿不到回落显示 SteamID)。 */
  authorPersona?: string | null;
  /** 工坊 publishedFileId(十进制字符串)。同物种去重主键。 */
  publishedFileId: string;
  /** 工坊条目创建时刻(Unix 秒;首发排序口径)。 */
  timeCreated: number;
  importedAt: number;
  source: SpeciesSkinSource | string;
};

/** 分享文本导入结果(镜像 Rust skins::SkinImportResult)。 */
export type SkinImportResult = {
  save: GameSave;
  codename: string;
  skinId: string;
  nameZh: string;
  /** true = 该皮肤此前已导入过(幂等刷新,不新增)。 */
  duplicate: boolean;
};

/** 创意工坊某物种的一条上传者记录(list_skin_uploaders 命令返回;镜像 Rust SkinUploaderEntry)。 */
export type WorkshopUploader = {
  publishedFileId: string;
  authorSteamId: string;
  authorPersona?: string | null;
  timeCreated: number;
  title: string;
  previewUrl?: string | null;
  /** 最早上传者(与 pick_earliest 同口径:timeCreated 最小,并列 fileId 小者胜)。 */
  isFirst: boolean;
  /** 已在本机 speciesSkins 收藏。 */
  installed: boolean;
  /** 是本机 Steam 账号上传的条目。 */
  isSelf: boolean;
};

export type PendingFusionStatus = "pending" | "generating" | "resolved" | "failed";

export type PendingFusionInfo = {
  parents: string[];
  recipeKey: string;
  requestedAt: number;
  attempts: number;
  status: PendingFusionStatus;
  lastError?: string | null;
  /** Steam 掷中的确定性槽位 codename(如 aif0503):生成必须落到该槽;本地路径无此字段。 */
  forcedCodename?: string | null;
  /** 当前正在生成的本地 CLI("claude" | "codex")；前端徽标显示"Claude/Codex 生成中"。 */
  provider?: string | null;
};

export type FusionCliStatus = {
  available: boolean;
  provider?: string | null;
  version?: string | null;
  path?: string | null;
  error?: string | null;
};

/** 单个 agent（claude/codex）的真实连接/登录态（镜像 Rust ProviderConn）。 */
export type ProviderConn = {
  provider: "claude" | "codex" | string;
  installed: boolean;
  loggedIn: boolean;
  version?: string | null;
  account?: string | null;
  error?: string | null;
};

/** 开局探测的两家 agent 连接态（镜像 Rust AgentConnections）。 */
export type AgentConnections = {
  claude: ProviderConn;
  codex: ProviderConn;
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
