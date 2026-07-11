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

export type AnimationKey =
  | "idle_normal"
  | "blink"
  | "sleep"
  | "walk"
  | "turn_around"
  | "happy_dance"
  | "confused"
  | "scared_backstep"
  | "angry_backturn"
  | "agent_thinking"
  | "agent_success"
  | "eat"
  | "pet_head";

export type AnimationDefinition = {
  frames: number;
  fps: number;
  loop: boolean;
  framePathTemplate?: string;
  webpPath?: string;
};

export type AvatarManifest = {
  id: string;
  name: string;
  version: number;
  frameSize: {
    width: number;
    height: number;
  };
  anchor: {
    x: number;
    y: number;
  };
  animations: Partial<Record<AnimationKey, AnimationDefinition>> & {
    idle_normal: AnimationDefinition;
  };
};

export type InstalledAvatar = {
  id: string;
  name: string;
  builtin: boolean;
  rootPath?: string | null;
  previewPath?: string | null;
};

export type AvatarSelection = {
  currentId: string;
  manifest: AvatarManifest;
  rootPath?: string | null;
  avatars: InstalledAvatar[];
};

export type PetEvent = {
  type: PetEventType;
  timestamp: string;
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
  petExpDelta: number;
  fedCoins: number;
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
};

export type EggInstance = {
  id: string;
  species: string;
  tier: number;
  hatchKind: string;
  slot?: number | null;
  hatchAt?: number | null;
};

export type DailyCounters = {
  date: string;
  tokenExp: number;
  overflowCoins: number;
  pickupCoins: number;
  idleCoins: number;
  clickCoins: number;
};

export type GameSave = {
  version: number;
  coins: number;
  pets: PetInstance[];
  eggs: EggInstance[];
  hatcheryLevel: number;
  yardLevel: number;
  activePetId?: string | null;
  lastSeenProjectExperience: Record<string, number>;
  daily: DailyCounters;
  tutorialStep: number;
  lastSeenAt: number;
};

export type ClickWorkResult = {
  save: GameSave;
  coinsGained: number;
  expGained: number;
  leveledUp: boolean;
  becameExhausted: boolean;
  softCapTier: number;
};

export type WanderPickupResult = {
  save: GameSave;
  coinsGained: number;
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
  tier: number;
  elements: string[];
  colors: string[];
  body: string;
  desc: string;
};

export type GameConfig = {
  initialCoins: number;
  historicalExpCoinCap: number;
  eggPrices: Record<string, number>;
  tier2EggPriceBonus: number;
  hatchSeconds: Record<string, number>;
  clickCoinsBase: number;
  clickCoinsPerLevel: number;
  clickCoinsPerTier: number;
  clickExp: number;
  clickSoftCap1: number;
  clickSoftCap2: number;
  staminaMax: number;
  staminaPerClick: number;
  staminaRegenSeconds: number;
  wakeThreshold: number;
  tickSeconds: number;
  mainExpPerTick: number;
  yardTicksPerExp: number;
  coinTicksPerCoin: number;
  idleCoinDailyCap: number;
  wanderCoinMin: number;
  wanderCoinMax: number;
  wanderCoinDailyCap: number;
  tokenExpDailyCap: number;
  overflowCoinDailyCap: number;
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
};

export type GameConfigPayload = {
  testMode: boolean;
  config: GameConfig;
};
