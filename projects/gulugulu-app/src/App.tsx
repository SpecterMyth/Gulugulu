import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { currentMonitor, getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import {
  type CSSProperties,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  normalizeCodexEvent,
  SLEEP_TIMEOUT_MS,
  stateAnimationMap,
  stateForPetEvent,
  svgStateDurationMs,
  transientStateDurationMs,
} from "./petEvents";
import { AnimationPlayer } from "./AnimationPlayer";
import type {
  AvatarSelection,
  CodexActivityEvent,
  CodexStatus,
  PetEvent,
  PetEventType,
  PetState,
} from "./types";
import { isTauri } from "./tauri";
import { useGame } from "./game/useGame";
import {
  MenuBar,
  PANEL_TITLES,
  PanelShell,
  StageEgg,
  WINDOW_SIZES,
  type UiMode,
} from "./game/GamePanels";
import { BackyardScene } from "./game/BackyardScene";
import { SvgSprite } from "./sprites/SvgSprite";
import { ReactionBurst } from "./sprites/parts/vfx";
import { WORK_FX, WorkBurst } from "./sprites/parts/workFx";
import { DebugPanel } from "./game/DebugPanel";
import { isMaxLevel } from "./game/config";
import { computeTutorialHint, fusionReady, GRADUATION_STEP } from "./game/tutorial";
import { WelcomeBackCard, readOfflineWelcome, startHeartbeat } from "./game/WelcomeBack";
import quotesData from "../assets/text/ai_quotes.json";

const DRAG_THRESHOLD_PX = 4;
// 内置头像 id（avatar_manager.rs BUILTIN_AVATAR_ID）；选中自定义头像时回退 PNG 帧动画
const BUILTIN_AVATAR_ID = "guluduck";
const AUTONOMOUS_MOVE_DELAY_MS = 18_000;
const AUTONOMOUS_MOVE_DURATION_MS = 1800;
const AUTONOMOUS_MOVE_PADDING_PX = 24;
const AUTONOMOUS_MOVE_CANDIDATE_COUNT = 36;
const LANGUAGE_STORAGE_KEY = "gulugulu.language";
const TOAST_VISIBLE_MS = 2600;
/** 菜单（后院/调试按钮）无操作自动收起，回到纯角色状态 */
const MENU_IDLE_HIDE_MS = 8000;
/** 记住用户上次把后院窗口拉到多高（逻辑 px），下次进入按此高度停靠 */
const BACKYARD_HEIGHT_KEY = "gulugulu.backyardHeight";

function storedBackyardHeight(): number {
  try {
    const parsed = Number(window.localStorage.getItem(BACKYARD_HEIGHT_KEY));
    if (Number.isFinite(parsed) && parsed >= 240) return Math.round(parsed);
  } catch {
    // localStorage 不可用时用默认高度
  }
  // 默认占工作区高度的 60%：画面足够大、文字可读，用户仍可自由拉伸。
  const avail = window.screen?.availHeight;
  if (Number.isFinite(avail) && avail! > 0) {
    return Math.round(clamp(avail! * 0.6, 480, 900));
  }
  return WINDOW_SIZES.backyard.h;
}

type DragState = {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  active: boolean;
};

type PopKind = "exp" | "coin" | "coin-dim" | "levelup" | "levelmax";

/** 收益弹出的图标（透明背景 + 图标 + 描边数字） */
const POP_ICONS: Record<PopKind, string> = {
  exp: "✨",
  coin: "🪙",
  "coin-dim": "🪙",
  levelup: "🎉",
  levelmax: "⭐",
};

/** 连击窗口：两次打工点击间隔小于该值算连击 */
const COMBO_WINDOW_MS = 1100;

/** 全屏特效覆盖层：停手该时长后隐藏（覆盖 screen 模式粒子 ~1.5s 滞空） */
const FX_HIDE_DELAY_MS = 2000;

type GamePop = {
  id: number;
  text: string;
  kind: PopKind;
  lane: number;
  x?: number;
  y?: number;
  /** 点击手感分层：≥10 金的飘字放大一档（OnboardingFlow §二·5）。 */
  big?: boolean;
};

type PendingFed = {
  id: number;
  exp: number;
  coins: number;
};

const interruptibleDuringSuccess = new Set<PetEventType>([
  "pet_idle",
  "user_click",
  "user_work_click",
  "user_drag_start",
  "user_drag_move",
  "user_drag_end",
  "agent_error",
]);

/** "软归位"事件：只是把状态收回 idle、本身没有动画表现（工具收尾/会话开始/漫游停止）。
 *  睡着或趴着恢复精力时忽略它们——否则每次 agent 工具结束都会闪一帧站立待机。 */
const idleSettleEventTypes = new Set<PetEventType>([
  "pet_idle",
  "pet_move_stop",
  "agent_tool_finish",
]);

type Language = "zh" | "en";

type QuoteEntry = {
  id: string;
  lang: Language;
  text: string;
  tags: string[];
};

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Direction = "left" | "right";

const quotes = quotesData.quotes as QuoteEntry[];
const quotesByLanguage: Record<Language, QuoteEntry[]> = {
  zh: quotes.filter((quote) => quote.lang === "zh"),
  en: quotes.filter((quote) => quote.lang === "en"),
};

const speechContextTags: Record<PetState, string[]> = {
  idle: ["assistant", "chatgpt", "meme", "sycophancy"],
  sleeping: ["disclaimer", "reasoning", "comfort"],
  clicked: ["meme", "sycophancy", "comfort"],
  laboring: ["coding", "agent", "meme"],
  exhausted: ["comfort", "disclaimer", "apology"],
  drag_start: ["comfort", "apology", "meme"],
  dragging: ["comfort", "apology", "agent"],
  drop: ["apology", "meme", "agent"],
  moving: ["agent", "coding", "meme"],
  thinking: ["reasoning", "deepseek", "essay", "disclaimer"],
  working: ["coding", "agent", "claude", "overconfident"],
  success: ["coding", "agent", "overconfident", "meme"],
  fed: ["coding", "overconfident", "meme", "hallucination"],
  error: ["apology", "refusal", "safety", "hallucination"],
};

const speakingEventTypes = new Set<PetEventType>([
  "agent_thinking_start",
  "agent_work_finish",
  "user_click",
  "user_drag_end",
]);

const uiCopy: Record<
  Language,
  {
    languageLabel: string;
    simplifiedChinese: string;
    english: string;
    closePet: string;
    debugLabel: string;
    previewMode: string;
    codexOnline: string;
    findingCodex: string;
    statusError: string;
    duckAlt: string;
  }
> = {
  zh: {
    languageLabel: "语言",
    simplifiedChinese: "简体中文",
    english: "English",
    closePet: "关闭宠物",
    debugLabel: "调试",
    previewMode: "预览模式",
    codexOnline: "Codex 在线",
    findingCodex: "寻找 Codex",
    statusError: "Codex 连接需要注意",
    duckAlt: "咕噜咕噜小鸭",
  },
  en: {
    languageLabel: "Language",
    simplifiedChinese: "Simplified Chinese",
    english: "English",
    closePet: "Close pet",
    debugLabel: "Debug",
    previewMode: "Preview mode",
    codexOnline: "Codex online",
    findingCodex: "Finding Codex",
    statusError: "Codex connection needs attention",
    duckAlt: "Gulugulu duck",
  },
};

function makePetEvent(type: PetEventType): PetEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
  };
}

function loadInitialLanguage(): Language {
  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return savedLanguage === "en" || savedLanguage === "zh" ? savedLanguage : "zh";
}

function createQuoteDecks(): Record<Language, Set<string>> {
  return {
    zh: new Set(quotesByLanguage.zh.map((quote) => quote.id)),
    en: new Set(quotesByLanguage.en.map((quote) => quote.id)),
  };
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function chooseQuote(language: Language, state: PetState, decks: Record<Language, Set<string>>): string {
  const languageQuotes = quotesByLanguage[language];
  const tags = speechContextTags[state];
  let unusedIds = decks[language];

  if (unusedIds.size === 0) {
    unusedIds = new Set(languageQuotes.map((quote) => quote.id));
    decks[language] = unusedIds;
  }

  const unusedQuotes = languageQuotes.filter((quote) => unusedIds.has(quote.id));
  const contextualQuotes = unusedQuotes.filter((quote) => quote.tags.some((tag) => tags.includes(tag)));
  const candidates = contextualQuotes.length > 0 ? contextualQuotes : unusedQuotes;
  const selected = randomItem(candidates.length > 0 ? candidates : languageQuotes);
  unusedIds.delete(selected.id);
  return selected.text.replace("XXX", language === "zh" ? "状态" : "state");
}

function shouldSpeakForEvent(type: PetEventType): boolean {
  return speakingEventTypes.has(type);
}

/** 精力恢复中的统一提示文案（显示在对话气泡里，不再用浮动标签/弹框）。 */
function staminaRecoveryText(stamina?: number, staminaMax?: number): string {
  if (stamina == null || staminaMax == null) return "Zzz…精力恢复中";
  return `Zzz…精力恢复中 ${stamina}/${staminaMax}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function overlapArea(a: Bounds, b: Bounds): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function randomBetween(min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function chooseAutonomousTarget(currentBounds: Bounds, monitorBounds: Bounds, activeBounds?: Bounds | null): PhysicalPosition {
  const minX = monitorBounds.x + AUTONOMOUS_MOVE_PADDING_PX;
  const minY = monitorBounds.y + AUTONOMOUS_MOVE_PADDING_PX;
  const maxX = monitorBounds.x + monitorBounds.width - currentBounds.width - AUTONOMOUS_MOVE_PADDING_PX;
  const maxY = monitorBounds.y + monitorBounds.height - currentBounds.height - AUTONOMOUS_MOVE_PADDING_PX;
  const maxDistance = Math.max(1, monitorBounds.width / 5);
  const currentArea = currentBounds.width * currentBounds.height;
  const candidatePositions: PhysicalPosition[] = [];

  const addCandidate = (x: number, y: number) => {
    const targetX = clamp(x, minX, maxX);
    const targetY = clamp(y, minY, maxY);
    const deltaX = targetX - currentBounds.x;
    const deltaY = targetY - currentBounds.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= maxDistance) {
      candidatePositions.push(new PhysicalPosition(Math.round(targetX), Math.round(targetY)));
      return;
    }

    const ratio = maxDistance / distance;
    candidatePositions.push(
      new PhysicalPosition(
        Math.round(clamp(currentBounds.x + deltaX * ratio, minX, maxX)),
        Math.round(clamp(currentBounds.y + deltaY * ratio, minY, maxY)),
      ),
    );
  };

  if (activeBounds) {
    const avoidBounds: Bounds = {
      x: activeBounds.x - AUTONOMOUS_MOVE_PADDING_PX,
      y: activeBounds.y - AUTONOMOUS_MOVE_PADDING_PX,
      width: activeBounds.width + AUTONOMOUS_MOVE_PADDING_PX * 2,
      height: activeBounds.height + AUTONOMOUS_MOVE_PADDING_PX * 2,
    };
    const outsideZones = [
      { minX, maxX: avoidBounds.x - currentBounds.width, minY, maxY },
      { minX: avoidBounds.x + avoidBounds.width, maxX, minY, maxY },
      { minX, maxX, minY, maxY: avoidBounds.y - currentBounds.height },
      { minX, maxX, minY: avoidBounds.y + avoidBounds.height, maxY },
    ].filter((zone) => zone.maxX >= zone.minX && zone.maxY >= zone.minY);

    for (const zone of outsideZones) {
      addCandidate(randomBetween(zone.minX, zone.maxX), randomBetween(zone.minY, zone.maxY));
    }

    for (let index = 0; index < AUTONOMOUS_MOVE_CANDIDATE_COUNT; index += 1) {
      const zone = outsideZones.length > 0 ? randomItem(outsideZones) : null;
      if (zone) {
        addCandidate(randomBetween(zone.minX, zone.maxX), randomBetween(zone.minY, zone.maxY));
      }
    }
  }

  while (candidatePositions.length < AUTONOMOUS_MOVE_CANDIDATE_COUNT) {
    const angle = Math.random() * Math.PI * 2;
    const distance = maxDistance * (0.35 + Math.random() * 0.65);
    addCandidate(currentBounds.x + Math.cos(angle) * distance, currentBounds.y + Math.sin(angle) * distance);
  }

  const scoredCandidates = candidatePositions.map((position) => {
    const candidateBounds: Bounds = {
      x: position.x,
      y: position.y,
      width: currentBounds.width,
      height: currentBounds.height,
    };
    const activeOverlap = activeBounds ? overlapArea(candidateBounds, activeBounds) / currentArea : 0;
    const currentOverlap = activeBounds ? overlapArea(currentBounds, activeBounds) / currentArea : 0;
    const deltaX = position.x - currentBounds.x;
    const deltaY = position.y - currentBounds.y;
    const distance = Math.hypot(deltaX, deltaY);
    const movementScore = 1 - Math.abs(distance - maxDistance * 0.65) / maxDistance;
    const escapeScore = currentOverlap > 0 && activeOverlap < currentOverlap ? (currentOverlap - activeOverlap) * 800 : 0;
    const outsideScore = activeBounds && activeOverlap === 0 ? 1000 : 0;

    return {
      position,
      score: outsideScore + escapeScore + movementScore * 80 - activeOverlap * 2000 + Math.random() * 20,
    };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);
  return scoredCandidates[0]?.position ?? new PhysicalPosition(currentBounds.x, currentBounds.y);
}

async function moveWindowAlongPath(
  target: PhysicalPosition,
  onDirectionChange: (direction: Direction) => void,
): Promise<void> {
  if (!isTauri()) return;

  const appWindow = getCurrentWindow();
  const start = await appWindow.outerPosition();
  const deltaX = target.x - start.x;
  const deltaY = target.y - start.y;
  onDirectionChange(deltaX < 0 ? "left" : "right");

  if (Math.abs(deltaX) < 2 && Math.abs(deltaY) < 2) return;

  await new Promise<void>((resolve) => {
    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = clamp((now - startedAt) / AUTONOMOUS_MOVE_DURATION_MS, 0, 1);
      const eased = easeInOutCubic(progress);
      void appWindow.setPosition(
        new PhysicalPosition(Math.round(start.x + deltaX * eased), Math.round(start.y + deltaY * eased)),
      );

      if (progress < 1) {
        window.requestAnimationFrame(step);
        return;
      }

      resolve();
    };

    window.requestAnimationFrame(step);
  });
}

export default function App() {
  const [petState, setPetState] = useState<PetState>("idle");
  const [movementDirection, setMovementDirection] = useState<Direction>("right");
  const [language, setLanguage] = useState<Language>(() => loadInitialLanguage());
  const [speechLine, setSpeechLine] = useState(() => chooseQuote(loadInitialLanguage(), "idle", createQuoteDecks()));
  const [speechVisible, setSpeechVisible] = useState(false);
  const [status, setStatus] = useState<CodexStatus | null>(null);
  const [projectTokens, setProjectTokens] = useState(0);
  const [pops, setPops] = useState<GamePop[]>([]);
  const [pendingFedQueue, setPendingFedQueue] = useState<PendingFed[]>([]);
  const [lastEventAt, setLastEventAt] = useState(Date.now());
  const stateRef = useRef<PetState>("idle");
  const dragRef = useRef<DragState | null>(null);
  const dragEndTimerRef = useRef<number | null>(null);
  const popIdRef = useRef(0);
  const pendingFedIdRef = useRef(0);
  const playingFedRef = useRef(false);
  const seenTokenEventKeysRef = useRef<Set<string>>(new Set());
  const autonomousMovePlayedRef = useRef(false);
  const quoteDecksRef = useRef(createQuoteDecks());
  const [avatarSelection, setAvatarSelection] = useState<AvatarSelection | null>(null);

  // --- game state ---
  const { bridge, config: gameConfig, save, setSave } = useGame();
  const [uiMode, setUiMode] = useState<UiMode>("pet");
  const uiModeRef = useRef<UiMode>("pet");
  const [gameBusy, setGameBusy] = useState(false);
  const [fusionFlash, setFusionFlash] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastIdRef = useRef(0);
  const [stageNow, setStageNow] = useState(() => Math.floor(Date.now() / 1000));
  const [welcomeOffline, setWelcomeOffline] = useState<number | null>(null);
  // 后院场景状态回传：主角行走中则暂缓进食动画；fedPulse 交给场景播放。
  const [sceneWalking, setSceneWalking] = useState(false);
  const sceneWalkingRef = useRef(false);
  const [sceneFed, setSceneFed] = useState<PendingFed | null>(null);

  useEffect(() => {
    uiModeRef.current = uiMode;
  }, [uiMode]);

  const handleSceneWalking = useCallback((walking: boolean) => {
    sceneWalkingRef.current = walking;
    setSceneWalking(walking);
  }, []);

  // 菜单闲置自动收起：一段时间没有任何输入就回到只有角色的状态。
  useEffect(() => {
    if (uiMode !== "menu") return;
    let timer = window.setTimeout(() => setUiMode("pet"), MENU_IDLE_HIDE_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setUiMode("pet"), MENU_IDLE_HIDE_MS);
    };
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [uiMode]);

  // 欢迎回来摘要卡（OnboardingFlow §二·4）：启动时若离线 >2h（或 ?welcome=1）弹卡；
  // 运行时持续写心跳时间戳。不依赖存档字段（见 WelcomeBack.ts）。
  useEffect(() => {
    const welcome = readOfflineWelcome();
    if (welcome) setWelcomeOffline(welcome.offlineMs);
    return startHeartbeat();
  }, []);

  const activePet = useMemo(
    () => save?.pets.find((pet) => pet.id === save.activePetId) ?? null,
    [save],
  );
  // 布尔量（跨 5s 存档轮询保持稳定，供 effect 依赖）：有主宠 / 舞台上是蛋。
  const hasActivePet = activePet != null;
  const eggOnStage = save != null && activePet == null;
  const activePetSpecies = activePet?.species ?? null;
  // 供事件分发层同步读取的耗尽标记（dispatchPetEvent 是稳定 callback，不吃 save 依赖）。
  const activePetExhaustedRef = useRef(false);
  useEffect(() => {
    activePetExhaustedRef.current = activePet?.exhausted ?? false;
  }, [activePet]);
  const stageEgg = useMemo(() => {
    if (activePet || !save) return null;
    return save.eggs.find((egg) => egg.slot != null) ?? save.eggs[0] ?? null;
  }, [activePet, save]);
  const stageEggReady =
    stageEgg?.slot != null && stageEgg.hatchAt != null && stageNow >= stageEgg.hatchAt;
  // 全物种默认走 SVG rig 舞台；仅当用户选择了自定义导入头像时回退 PNG 帧动画。
  const hasCustomAvatarActive =
    avatarSelection != null && avatarSelection.currentId !== BUILTIN_AVATAR_ID;
  const isSvgStage = activePet != null && !hasCustomAvatarActive;
  // 点击反馈爆发粒子的颜色跟随主属性元素色
  const reactionColor =
    (gameConfig &&
      activePet &&
      gameConfig.elements[gameConfig.species[activePet.species]?.elements?.[0] ?? "normal"]?.color) ||
    "#F5917B";

  // 1s ticker for the stage egg countdown (only while an egg is on stage).
  useEffect(() => {
    if (!stageEgg) return;
    const timer = window.setInterval(() => setStageNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [stageEgg]);

  const showToastMsg = useCallback((text: string) => {
    const id = toastIdRef.current + 1;
    toastIdRef.current = id;
    setToast({ id, text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const pushPop = useCallback(
    (text: string, kind: PopKind, at?: { x: number; y: number }, big?: boolean) => {
      const id = popIdRef.current + 1;
      popIdRef.current = id;
      setPops((items) => [...items.slice(-4), { id, text, kind, lane: id % 3, x: at?.x, y: at?.y, big }]);
      window.setTimeout(() => {
        setPops((items) => items.filter((item) => item.id !== id));
      }, 1500);
    },
    [],
  );

  // 对话气泡被引导/状态提示占用时（见下方 bubble 多路复用），随机台词让位（§2）。
  const bubbleBusyRef = useRef(false);
  // 气泡淡出期间保留最后一条内容，避免隐藏瞬间文字跳变。
  const lastBubbleTextRef = useRef("");

  const showSpeechForState = useCallback(
    (state: PetState) => {
      // 孵化中的蛋不说话；引导/状态提示展示中也不插播随机台词。
      if (eggOnStage || bubbleBusyRef.current) return;
      setSpeechLine(chooseQuote(language, state, quoteDecksRef.current));
      setSpeechVisible(true);
    },
    [eggOnStage, language],
  );

  const dispatchPetEvent = useCallback((event: PetEvent) => {
    if (stateRef.current === "success" && !interruptibleDuringSuccess.has(event.type)) {
      return;
    }

    // 睡着/趴着时忽略"软归位"事件（agent 工具收尾等，映射为 idle 且无动画表现），
    // 否则每次 tool_finished 都会闪一帧站立待机再被按回趴姿。
    // 有表现的事件（thinking/working/喂食/点击/拖拽）仍照常唤醒演出。
    if (
      (stateRef.current === "sleeping" || stateRef.current === "exhausted") &&
      idleSettleEventTypes.has(event.type)
    ) {
      return;
    }

    let nextState = stateForPetEvent(event);
    // 耗尽恢复期间，一切"归位到待机"（吃完、演完 thinking 等）都直接落回趴姿，
    // 不经过 idle 中转帧（§耗尽只显示趴着的角色）。pet_wake 是真正的苏醒，豁免。
    if (nextState === "idle" && event.type !== "pet_wake" && activePetExhaustedRef.current) {
      nextState = "exhausted";
    }
    stateRef.current = nextState;
    setPetState(nextState);
    setLastEventAt(Date.now());

    if (shouldSpeakForEvent(event.type)) {
      showSpeechForState(nextState);
    }

    if (!event.type.startsWith("pet_move")) {
      autonomousMovePlayedRef.current = false;
    }
  }, [showSpeechForState]);

  const dispatchLocalEvent = useCallback(
    (type: PetEventType) => {
      dispatchPetEvent(makePetEvent(type));
    },
    [dispatchPetEvent],
  );

  // 点击反馈叠加层（计划 §2.4）：不打断当前动画，在 wrapper 上叠加一次
  // 压扁脉冲 + 元素色爆发粒子。连点靠 -a/-b 类交替重启动画。
  const [reactionPulseFlip, setReactionPulseFlip] = useState(-1);
  const [reactionBursts, setReactionBursts] = useState<number[]>([]);
  const reactionIdRef = useRef(0);
  // 点击手感 L3：清空一管精力时的"管末大跳"演出（纯表现，无数值）。
  const [finisherFlip, setFinisherFlip] = useState(-1);

  const spawnReactionBurst = useCallback(() => {
    const id = reactionIdRef.current + 1;
    reactionIdRef.current = id;
    setReactionBursts((list) => [...list.slice(-2), id]);
    window.setTimeout(() => {
      setReactionBursts((list) => list.filter((item) => item !== id));
    }, 650);
  }, []);

  // speak=false 用于菜单模式的打工连点：只要压扁脉冲+粒子，不每次换随机台词。
  const triggerPetReaction = useCallback(
    (speak = true) => {
      setReactionPulseFlip((flip) => (flip < 0 ? 0 : flip + 1));
      spawnReactionBurst();
      // 与旧 user_click 一致：重置睡眠/漫游计时，但不改变 petState。
      setLastEventAt(Date.now());
      autonomousMovePlayedRef.current = false;
      // 精力恢复中：点击不出随机台词，改在对话气泡里展示恢复进度（§6）。
      if (activePet?.exhausted) {
        showToastMsg(staminaRecoveryText(activePet.stamina, gameConfig?.staminaMax));
        return;
      }
      if (speak) showSpeechForState("clicked");
    },
    [activePet, gameConfig, showSpeechForState, showToastMsg, spawnReactionBurst],
  );

  const reactionPulseClass =
    reactionPulseFlip < 0 ? "" : reactionPulseFlip % 2 === 0 ? "pet-react-pulse-a" : "pet-react-pulse-b";
  const finisherClass =
    finisherFlip < 0 ? "" : finisherFlip % 2 === 0 ? "pet-finisher-a" : "pet-finisher-b";

  // —— 点击打工的爽快感（点击游戏化）：连击计数 + 工具粒子爆发 + 累计读数 ——
  const comboRef = useRef({ count: 0, coins: 0, exp: 0, last: 0 });
  const [comboView, setComboView] = useState<{ count: number; coins: number; exp: number; flip: number } | null>(
    null,
  );
  const comboHideTimerRef = useRef<number | null>(null);
  const [workBursts, setWorkBursts] = useState<Array<{ id: number; tier: number; seed: number; boom: boolean }>>([]);
  const workBurstIdRef = useRef(0);

  // —— 全屏特效覆盖层（"fx" 子窗口）：粒子飞出宠物小窗、满屏飘散 ——
  // 覆盖层是铺满显示器的透明点击穿透窗口（lib.rs ensure_fx_overlay），主窗口
  // 几何完全不动（不再有连点跳闪）。覆盖层未就绪/预览模式回退窗口内粒子。
  const duckFacingRef = useRef<HTMLDivElement | null>(null);
  const fxVisibleRef = useRef(false);
  const fxEnsurePendingRef = useRef<Promise<boolean> | null>(null);
  const fxWebviewReadyRef = useRef(false);
  const fxHideTimerRef = useRef<number | null>(null);

  // fx webview 挂载回执：在收到 fx://ready 之前 emit 会被丢弃，先回退窗口内粒子。
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const unlistenPromise = listen("fx://ready", () => {
      if (!disposed) fxWebviewReadyRef.current = true;
    });
    return () => {
      disposed = true;
      void unlistenPromise.then((dispose) => dispose());
    };
  }, []);

  const ensureFxOverlay = useCallback((): Promise<boolean> => {
    if (!isTauri()) return Promise.resolve(false);
    if (fxVisibleRef.current) return Promise.resolve(true);
    if (!fxEnsurePendingRef.current) {
      fxEnsurePendingRef.current = invoke("ensure_fx_overlay")
        .then(() => {
          fxVisibleRef.current = true;
          return true;
        })
        .catch(() => false)
        .finally(() => {
          fxEnsurePendingRef.current = null;
        });
    }
    return fxEnsurePendingRef.current;
  }, []);

  const hideFxOverlay = useCallback(() => {
    if (fxHideTimerRef.current) {
      window.clearTimeout(fxHideTimerRef.current);
      fxHideTimerRef.current = null;
    }
    if (!isTauri() || !fxVisibleRef.current) return;
    fxVisibleRef.current = false;
    void invoke("hide_fx_overlay").catch(() => undefined);
  }, []);

  const scheduleFxHide = useCallback(() => {
    if (fxHideTimerRef.current) window.clearTimeout(fxHideTimerRef.current);
    fxHideTimerRef.current = window.setTimeout(() => {
      fxHideTimerRef.current = null;
      hideFxOverlay();
    }, FX_HIDE_DELAY_MS);
  }, [hideFxOverlay]);

  /** 把一次爆发发到全屏覆盖层；返回 false 表示未送达（调用方回退窗口内渲染）。 */
  const emitFxBurst = useCallback(
    (species: string, tier: number, seed: number, boom: boolean): Promise<boolean> => {
      const el = duckFacingRef.current;
      const spec = WORK_FX[species];
      if (!isTauri() || !el || !spec) return Promise.resolve(false);
      return ensureFxOverlay().then(async (shown) => {
        if (!shown || !fxWebviewReadyRef.current) return false;
        try {
          const appWindow = getCurrentWindow();
          const [position, monitor] = await Promise.all([appWindow.outerPosition(), currentMonitor()]);
          const scale = window.devicePixelRatio || 1;
          // duck-facing 内的 256 viewBox（xMidYMid meet）→ CSS 坐标 → 覆盖层逻辑坐标，
          // 让覆盖层粒子精确从主窗口里工具的位置发射。
          const rect = el.getBoundingClientRect();
          const fit = Math.min(rect.width, rect.height) / 256;
          const emitterX = rect.left + (rect.width - 256 * fit) / 2 + spec.emitter.x * fit;
          const emitterY = rect.top + (rect.height - 256 * fit) / 2 + spec.emitter.y * fit;
          await emitTo("fx", "fx://burst", {
            species,
            tier,
            seed,
            boom,
            x: (position.x - (monitor?.position.x ?? 0)) / scale + emitterX,
            y: (position.y - (monitor?.position.y ?? 0)) / scale + emitterY,
          });
          return true;
        } catch {
          return false;
        }
      });
    },
    [ensureFxOverlay],
  );

  const pushLocalBurst = useCallback((tier: number, seed: number, boom: boolean) => {
    const id = workBurstIdRef.current + 1;
    workBurstIdRef.current = id;
    setWorkBursts((list) => [...list.slice(-7), { id, tier, seed, boom }]);
    window.setTimeout(() => {
      setWorkBursts((list) => list.filter((item) => item.id !== id));
    }, 1250);
  }, []);

  /** 一次工具粒子爆发：优先全屏覆盖层（满屏飘散），未就绪回退窗口内。 */
  const spawnWorkBurst = useCallback(
    (tier: number, boom: boolean) => {
      const seed = (Math.random() * 0xffffffff) >>> 0;
      if (isTauri() && activePetSpecies) {
        void emitFxBurst(activePetSpecies, tier, seed, boom).then((sent) => {
          if (!sent) pushLocalBurst(tier, seed, boom);
        });
        scheduleFxHide();
      } else {
        pushLocalBurst(tier, seed, boom);
      }
    },
    [activePetSpecies, emitFxBurst, pushLocalBurst, scheduleFxHide],
  );

  // 打工连击只发生在菜单模式：离开菜单即收起覆盖层（预热未用到的也一并回收）。
  useEffect(() => {
    if (uiMode !== "menu") hideFxOverlay();
  }, [uiMode, hideFxOverlay]);

  const registerWorkJuice = useCallback(
    (coinsGained: number, expGained: number) => {
      const now = Date.now();
      const combo = comboRef.current;
      if (now - combo.last > COMBO_WINDOW_MS) {
        combo.count = 0;
        combo.coins = 0;
        combo.exp = 0;
      }
      combo.count += 1;
      combo.coins += coinsGained;
      combo.exp += expGained;
      combo.last = now;

      // 工具粒子爆发：连击越高粒子越多、扩散越大；每 10 连击一次超级爆炸环
      spawnWorkBurst(Math.min(combo.count, 18), combo.count % 10 === 0);

      // 连击累计读数（🪙 总额 ×N），1.3s 无点击后消失
      setComboView((prev) => ({ count: combo.count, coins: combo.coins, exp: combo.exp, flip: (prev?.flip ?? 0) + 1 }));
      if (comboHideTimerRef.current) window.clearTimeout(comboHideTimerRef.current);
      comboHideTimerRef.current = window.setTimeout(() => setComboView(null), 1300);
    },
    [spawnWorkBurst],
  );

  // 点击手感 L3：清空一管精力（管末）时的大跳 + 一轮超级爆发环。
  const triggerFinisher = useCallback(() => {
    setFinisherFlip((flip) => (flip < 0 ? 0 : flip + 1));
    spawnWorkBurst(18, true);
  }, [spawnWorkBurst]);

  const changeLanguage = useCallback(
    (nextLanguage: Language) => {
      setLanguage(nextLanguage);
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      setSpeechLine(chooseQuote(nextLanguage, stateRef.current, quoteDecksRef.current));
    },
    [],
  );

  const enqueueFed = useCallback((exp: number, coins: number) => {
    const id = pendingFedIdRef.current + 1;
    pendingFedIdRef.current = id;
    setPendingFedQueue((items) => [...items, { id, exp, coins }]);
  }, []);

  const startNextFedIfReady = useCallback(() => {
    if (playingFedRef.current || pendingFedQueue.length === 0) return;
    const mode = uiModeRef.current;
    // 后院里保持原地播放进食：主角行走中先攒着，停下再吃。
    const inBackyardIdle = mode === "backyard" && !sceneWalkingRef.current;
    if (mode !== "pet" && mode !== "menu" && !inBackyardIdle) return;
    if (
      stateRef.current !== "idle" &&
      stateRef.current !== "sleeping" &&
      stateRef.current !== "exhausted"
    ) {
      return;
    }

    const [nextFed, ...rest] = pendingFedQueue;
    playingFedRef.current = true;
    setPendingFedQueue(rest);
    if (mode === "backyard") {
      setSceneFed(nextFed);
    } else {
      if (nextFed.exp > 0) pushPop(`+${formatNumber(nextFed.exp)}`, "exp");
      if (nextFed.coins > 0) pushPop(`+${formatNumber(nextFed.coins)}`, "coin");
    }
    dispatchPetEvent(makePetEvent("agent_token_gain"));
  }, [dispatchPetEvent, pendingFedQueue, pushPop]);

  const finishDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag?.active) return;

    if (dragEndTimerRef.current !== null) {
      window.clearTimeout(dragEndTimerRef.current);
      dragEndTimerRef.current = null;
    }

    dragRef.current = null;
    dispatchLocalEvent("user_drag_end");
  }, [dispatchLocalEvent]);

  // --- game actions ---

  const advanceTutorial = useCallback(
    (step: number) => {
      bridge
        .advanceTutorial(step)
        .then(setSave)
        .catch(() => undefined);
    },
    [bridge, setSave],
  );

  const openMenu = useCallback(() => {
    setUiMode("menu");
    // 预热特效覆盖层（创建/显示 fx 子窗口），首次连击即可满屏飘散。
    void ensureFxOverlay();
    if (save && save.tutorialStep === 0) advanceTutorial(1);
  }, [advanceTutorial, ensureFxOverlay, save]);

  const goBack = useCallback(() => {
    setUiMode((mode) => (mode === "pet" || mode === "menu" ? "pet" : "menu"));
  }, []);

  const selectPanel = useCallback(
    (mode: Exclude<UiMode, "pet" | "menu">) => {
      setUiMode(mode);
      // 孵化区并入后院场景：进入后院即视为看过孵化教程。
      if (mode === "backyard" && save?.tutorialStep === 1) advanceTutorial(2);
    },
    [advanceTutorial, save],
  );

  // 收益递减提示只在档位上升时说一次，避免连点时反复刷屏。
  const softCapNoticedRef = useRef(0);

  const workOn = useCallback(
    (petId: string, at?: { x: number; y: number }) => {
      if (!save) return;
      const isActive = petId === save.activePetId;
      bridge
        .clickWork(petId)
        .then((result) => {
          setSave(result.save);
          // 点击手感 L1：≥10 金的收益飘字放大一档，让 2 阶富点击可见。
          pushPop(
            `+${result.coinsGained}`,
            result.softCapTier > 0 ? "coin-dim" : "coin",
            at,
            result.coinsGained >= 10,
          );
          if (result.expGained > 0 && !at) pushPop(`+${result.expGained}`, "exp");
          // Anchored (yard-card) level-ups pop here; stage level-ups are handled
          // by the level watcher below so idle-tick gains celebrate too.
          if (result.leveledUp && at) pushPop("Lv UP!", "levelup", at);
          if (isActive && (uiModeRef.current === "menu" || uiModeRef.current === "pet")) {
            dispatchLocalEvent("user_work_click");
            registerWorkJuice(result.coinsGained, result.expGained);
          } else if (isActive && uiModeRef.current === "backyard") {
            // 后院：主角播打工动画；粒子特效由场景就地渲染（不扩张窗口）。
            dispatchLocalEvent("user_work_click");
          }
          if (save.tutorialStep === 2) advanceTutorial(3);
          if (result.becameExhausted) {
            // 主界面上耗尽只演趴下的角色（§4），不再叠加文字提示；后院仍给一条反馈。
            if (uiModeRef.current !== "pet" && uiModeRef.current !== "menu") {
              showToastMsg("精力用完啦，让它睡一会儿…");
            }
            // 点击手感 L3：清空一管精力 = 管末大跳（在场主宠才演）。
            if (isActive) {
              triggerFinisher();
              window.setTimeout(() => dispatchLocalEvent("pet_exhausted"), 850);
            }
          } else if (result.softCapTier > softCapNoticedRef.current) {
            showToastMsg("今天赚得够多了，收益递减中");
          }
          softCapNoticedRef.current = result.softCapTier;
        })
        .catch((error) => {
          const message = errorMessage(error);
          if (message.includes("exhausted")) {
            if (isActive) dispatchLocalEvent("pet_exhausted");
            const pet = save.pets.find((item) => item.id === petId);
            showToastMsg(staminaRecoveryText(pet?.stamina, gameConfig?.staminaMax));
          } else {
            showToastMsg(message);
          }
        });
    },
    [
      advanceTutorial,
      bridge,
      dispatchLocalEvent,
      gameConfig,
      pushPop,
      registerWorkJuice,
      save,
      setSave,
      showToastMsg,
      triggerFinisher,
    ],
  );

  const collectEgg = useCallback(
    (eggId: string) => {
      if (!save || !gameConfig) return;
      const egg = save.eggs.find((item) => item.id === eggId);
      setGameBusy(true);
      bridge
        .collectHatched(eggId)
        .then((next) => {
          setSave(next);
          const name = egg ? gameConfig.species[egg.species]?.nameZh ?? egg.species : "精灵";
          showToastMsg(`${name} 破壳而出！`);
          dispatchLocalEvent("agent_work_finish");
          if (next.tutorialStep < 2) {
            bridge
              .advanceTutorial(2)
              .then(setSave)
              .catch(() => undefined);
          }
        })
        .catch((error) => showToastMsg(errorMessage(error)))
        .finally(() => setGameBusy(false));
    },
    [bridge, dispatchLocalEvent, gameConfig, save, setSave, showToastMsg],
  );

  const buyEgg = useCallback(
    (element: string) => {
      if (!save) return;
      setGameBusy(true);
      bridge
        .buyEgg(element)
        .then((next) => {
          setSave(next);
          const latest = next.eggs[next.eggs.length - 1];
          showToastMsg(latest?.slot != null ? "蛋已放进孵化槽" : "孵化槽已满，蛋放进了库存");
          pushPop(`-${gameConfig?.eggPrices[element] ?? 0}`, "coin-dim");
          if (save.tutorialStep === 3) advanceTutorial(4);
        })
        .catch((error) => showToastMsg(errorMessage(error)))
        .finally(() => setGameBusy(false));
    },
    [advanceTutorial, bridge, gameConfig, pushPop, save, setSave, showToastMsg],
  );

  const placeEgg = useCallback(
    (eggId: string, slot: number) => {
      setGameBusy(true);
      bridge
        .placeEgg(eggId, slot)
        .then((next) => {
          setSave(next);
          showToastMsg("开始孵化！");
        })
        .catch((error) => showToastMsg(errorMessage(error)))
        .finally(() => setGameBusy(false));
    },
    [bridge, setSave, showToastMsg],
  );

  // 场景内直接融合（后院气泡按钮已做前置校验，后端仍会兜底）。
  const fusePets = useCallback(
    (idA: string, idB: string) => {
      setGameBusy(true);
      bridge
        .fusePets(idA, idB)
        .then((next) => {
          setFusionFlash(true);
          window.setTimeout(() => {
            setFusionFlash(false);
            setSave(next);
            showToastMsg("融合成功！高阶蛋已放进孵化区");
          }, 900);
        })
        .catch((error) => {
          showToastMsg(errorMessage(error));
        })
        .finally(() => setGameBusy(false));
    },
    [bridge, setSave, showToastMsg],
  );

  const releasePet = useCallback(
    (petId: string) => {
      setGameBusy(true);
      bridge
        .releasePet(petId)
        .then((result) => {
          setSave(result.save);
          pushPop(`+${result.refund}`, "coin");
          showToastMsg(`已放生，返还 ${result.refund} 金币`);
        })
        .catch((error) => showToastMsg(errorMessage(error)))
        .finally(() => setGameBusy(false));
    },
    [bridge, pushPop, setSave, showToastMsg],
  );

  const followPet = useCallback(
    (petId: string) => {
      setGameBusy(true);
      bridge
        .setActivePet(petId)
        .then((next) => {
          setSave(next);
          showToastMsg("它现在跟着你啦");
        })
        .catch((error) => showToastMsg(errorMessage(error)))
        .finally(() => setGameBusy(false));
    },
    [bridge, setSave, showToastMsg],
  );

  const upgradeHatchery = useCallback(() => {
    setGameBusy(true);
    bridge
      .upgradeHatchery()
      .then((next) => {
        setSave(next);
        showToastMsg("孵化屋升级成功！");
      })
      .catch((error) => showToastMsg(errorMessage(error)))
      .finally(() => setGameBusy(false));
  }, [bridge, setSave, showToastMsg]);

  const upgradeYard = useCallback(() => {
    setGameBusy(true);
    bridge
      .upgradeYard()
      .then((next) => {
        setSave(next);
        showToastMsg("后院升级成功！");
      })
      .catch((error) => showToastMsg(errorMessage(error)))
      .finally(() => setGameBusy(false));
  }, [bridge, setSave, showToastMsg]);

  // 后院交易所建筑入口：打开 Steam 交易市场（后续接入具体物品页）。
  const openSteamMarket = useCallback(() => {
    if (isTauri()) {
      void invoke("open_steam_market").catch(() => showToastMsg("打不开 Steam 市场，稍后再试"));
      return;
    }
    window.open("https://steamcommunity.com/market/", "_blank", "noopener");
  }, [showToastMsg]);

  const debugFeed = useCallback(
    (amount: number) => {
      if (!bridge.debugFeedTokens) return;
      bridge
        .debugFeedTokens(amount)
        .then((result) => {
          setSave(result.save);
          enqueueFed(result.petExp, result.coins);
          if (result.petExp === 0 && result.coins === 0) {
            showToastMsg("今天的 Token 收益已到上限");
          }
        })
        .catch(() => undefined);
    },
    [bridge, enqueueFed, setSave, showToastMsg],
  );

  // --- codex status + activity ---

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;

    invoke<CodexStatus>("get_codex_status")
      .then((nextStatus) => {
        if (disposed) return;
        setStatus(nextStatus);
        setProjectTokens(nextStatus.totalTokens);
        if (nextStatus.error) dispatchLocalEvent("agent_error");
      })
      .catch(() => dispatchLocalEvent("agent_error"));

    const statusTimer = window.setInterval(() => {
      invoke<CodexStatus>("get_codex_status")
        .then((nextStatus) => {
          if (disposed) return;
          setStatus(nextStatus);
          setProjectTokens(nextStatus.totalTokens);
        })
        .catch(() => undefined);
    }, 2000);

    let unlisten: (() => void) | undefined;
    listen<CodexActivityEvent>("codex://activity", (event) => {
      const payload = event.payload;

      if (payload.kind === "token_count") {
        const eventKey = [
          payload.source,
          payload.sessionId,
          payload.timestamp,
          payload.projectPath ?? "",
          payload.tokenDelta,
          payload.projectTotalTokens,
          payload.projectExperience,
        ].join("|");
        if (seenTokenEventKeysRef.current.has(eventKey)) return;

        seenTokenEventKeysRef.current.add(eventKey);
        if (seenTokenEventKeysRef.current.size > 80) {
          const [oldestKey] = seenTokenEventKeysRef.current;
          seenTokenEventKeysRef.current.delete(oldestKey);
        }
      }

      if (payload.kind !== "token_count") {
        dispatchPetEvent(normalizeCodexEvent(payload));
      }

      if (payload.kind === "token_count") {
        setProjectTokens(payload.projectTotalTokens);
        if (payload.tokenDelta > 0 && (payload.petExpDelta > 0 || payload.fedCoins > 0)) {
          enqueueFed(payload.petExpDelta, payload.fedCoins);
        }
        // Token events change the save (exp/coins) — refresh it.
        bridge
          .getState()
          .then(setSave)
          .catch(() => undefined);
      }

      invoke<CodexStatus>("get_codex_status")
        .then(setStatus)
        .catch(() => undefined);
    }).then((dispose) => {
      if (disposed) {
        dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      disposed = true;
      window.clearInterval(statusTimer);
      unlisten?.();
    };
  }, [bridge, dispatchLocalEvent, dispatchPetEvent, enqueueFed, setSave]);

  const refreshAvatars = useCallback(() => {
    if (!isTauri()) return Promise.resolve(null);
    return invoke<AvatarSelection>("get_current_avatar")
      .then((selection) => {
        setAvatarSelection(selection);
        return selection;
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    refreshAvatars();
  }, [refreshAvatars]);

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onMoved(() => {
        if (!dragRef.current?.active) return;

        if (stateRef.current !== "dragging") {
          dispatchLocalEvent("user_drag_move");
        }

        if (dragEndTimerRef.current !== null) {
          window.clearTimeout(dragEndTimerRef.current);
        }

        dragEndTimerRef.current = window.setTimeout(() => {
          finishDrag();
        }, 260);
      })
      .then((dispose) => {
        unlisten = dispose;
      })
      .catch(() => undefined);

    return () => {
      if (dragEndTimerRef.current !== null) {
        window.clearTimeout(dragEndTimerRef.current);
        dragEndTimerRef.current = null;
      }
      unlisten?.();
    };
  }, [dispatchLocalEvent, finishDrag]);

  useEffect(() => {
    if (!speechVisible) return;

    const timer = window.setTimeout(() => {
      setSpeechVisible(false);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [speechLine, speechVisible]);

  // Esc walks back through the UI modes (panel → menu → pet).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (uiModeRef.current !== "pet") goBack();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goBack]);

  // --- window sizing (GDD §10.1/§12.6): mode-driven, via the Rust command ---

  const windowSize = WINDOW_SIZES[uiMode];

  useEffect(() => {
    if (!isTauri()) return;
    if (uiMode === "backyard") {
      // 后院停靠：铺满工作区宽度、贴任务栏上沿。置顶关闭 + 边缘可缩放由
      // dock 命令在 Rust 侧权威设置（前端 window API 可能被能力配置静默拒绝）。
      void invoke("dock_backyard_window", { height: storedBackyardHeight() }).catch(() => undefined);
      return;
    }
    // 恢复置顶 + 固定尺寸在 resize_game_window（Rust）内完成。
    void bridge.resizeWindow(windowSize.w, windowSize.h).catch(() => undefined);
  }, [bridge, uiMode, windowSize.h, windowSize.w]);

  // Transient states fall back to idle (exhausted is settled by stamina, not a timer).
  useEffect(() => {
    if (
      petState === "idle" ||
      petState === "sleeping" ||
      petState === "exhausted" ||
      petState === "dragging" ||
      petState === "error"
    ) {
      return;
    }

    const duration = transientStateDurationMs[petState] ?? 5000;
    const timer = window.setTimeout(() => dispatchLocalEvent("pet_idle"), duration);
    return () => window.clearTimeout(timer);
  }, [dispatchLocalEvent, lastEventAt, petState]);

  useEffect(() => {
    startNextFedIfReady();
  }, [pendingFedQueue, petState, uiMode, sceneWalking, startNextFedIfReady]);

  useEffect(() => {
    if (petState === "sleeping" || petState === "exhausted" || petState === "error" || petState === "dragging") {
      return;
    }

    const timer = window.setTimeout(() => {
      dispatchLocalEvent("pet_sleep_start");
    }, SLEEP_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [dispatchLocalEvent, lastEventAt, petState]);

  // Keep the pet's exhausted animation in sync with the save.
  useEffect(() => {
    if (!activePet) return;
    if (activePet.exhausted && (petState === "idle" || petState === "sleeping")) {
      dispatchLocalEvent("pet_exhausted");
    } else if (!activePet.exhausted && petState === "exhausted") {
      dispatchLocalEvent("pet_wake");
    }
  }, [activePet, dispatchLocalEvent, petState]);

  // Celebrate every active-pet level-up on the stage (clicks, idle ticks and
  // token feeds all funnel through save changes). Reaching a tier's max level is
  // upgraded to a "★Lv MAX" celebration (OnboardingFlow §二·2); yard pets that
  // hit max off-stage get an environmental toast instead ("静默满级=环境奖励").
  const watchedLevelRef = useRef<{ id: string; level: number } | null>(null);
  const maxSeenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!save || !gameConfig) return;

    // Seed the known-max set on first run so pre-maxed pets don't re-celebrate.
    if (maxSeenRef.current === null) {
      maxSeenRef.current = new Set(
        save.pets.filter((pet) => isMaxLevel(gameConfig, pet)).map((pet) => pet.id),
      );
    }
    const known = maxSeenRef.current;
    for (const pet of save.pets) {
      const max = isMaxLevel(gameConfig, pet);
      if (max && !known.has(pet.id)) {
        known.add(pet.id);
        if (pet.id !== save.activePetId) {
          const name = gameConfig.species[pet.species]?.nameZh ?? pet.species;
          showToastMsg(`🌟 ${name} 满级啦！可以去融合了`);
        }
      } else if (!max && known.has(pet.id)) {
        known.delete(pet.id);
      }
    }

    const active = save.pets.find((pet) => pet.id === save.activePetId) ?? null;
    if (!active) {
      watchedLevelRef.current = null;
      return;
    }
    const watched = watchedLevelRef.current;
    if (watched && watched.id === active.id && active.level > watched.level) {
      if (isMaxLevel(gameConfig, active)) {
        pushPop("★满级！", "levelmax");
        spawnReactionBurst();
        triggerFinisher();
        setSpeechLine("⭐ 满级啦！凑一对同阶就能融合");
        setSpeechVisible(true);
      } else {
        pushPop("Lv UP!", "levelup");
      }
    }
    watchedLevelRef.current = { id: active.id, level: active.level };
  }, [save, gameConfig, pushPop, showToastMsg, spawnReactionBurst, triggerFinisher]);

  // Autonomous wandering (only while the plain pet is showing) + coin pickup.
  // 孵化中的蛋（没有主宠）钉在原地，不做随机漫游（§3）。
  useEffect(() => {
    if (petState !== "idle" || uiMode !== "pet" || !hasActivePet || autonomousMovePlayedRef.current) return;

    const timer = window.setTimeout(() => {
      if (stateRef.current !== "idle" || uiModeRef.current !== "pet" || autonomousMovePlayedRef.current) return;

      autonomousMovePlayedRef.current = true;
      dispatchLocalEvent("pet_move_start");
      dispatchLocalEvent("pet_move");

      const pickup = () => {
        bridge
          .wanderPickup()
          .then((result) => {
            setSave(result.save);
            if (result.coinsGained > 0) {
              pushPop(`+${result.coinsGained}`, "coin");
            }
          })
          .catch(() => undefined);
      };

      if (!isTauri()) {
        window.setTimeout(() => {
          dispatchLocalEvent("pet_move_stop");
          pickup();
        }, AUTONOMOUS_MOVE_DURATION_MS);
        return;
      }

      const appWindow = getCurrentWindow();
      Promise.all([
        appWindow.outerPosition(),
        appWindow.outerSize(),
        currentMonitor(),
        invoke<Bounds | null>("get_active_window_bounds").catch(() => null),
      ])
        .then(([position, size, monitor, activeBounds]) => {
          const monitorBounds: Bounds = monitor
            ? {
                x: monitor.position.x,
                y: monitor.position.y,
                width: monitor.size.width,
                height: monitor.size.height,
              }
            : {
                x: position.x - 320,
                y: position.y - 240,
                width: 1280,
                height: 720,
              };
          const currentBounds: Bounds = {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
          };
          const target = chooseAutonomousTarget(currentBounds, monitorBounds, activeBounds);
          return moveWindowAlongPath(target, setMovementDirection);
        })
        .catch(() => undefined)
        .finally(() => {
          dispatchLocalEvent("pet_move_stop");
          pickup();
        });
    }, AUTONOMOUS_MOVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [bridge, dispatchLocalEvent, hasActivePet, lastEventAt, petState, pushPop, setSave, uiMode]);

  const statusText = useMemo(() => {
    const copy = uiCopy[language];
    if (!isTauri()) return copy.previewMode;
    if (status?.error) return language === "zh" ? copy.statusError : status.error;
    if (status?.codexWatching && status.claudeCodeWatching) {
      return language === "zh" ? "Codex + Claude Code 在线" : "Codex + Claude Code online";
    }
    if (status?.codexWatching) return copy.codexOnline;
    if (status?.claudeCodeWatching) {
      return language === "zh" ? "Claude Code 在线" : "Claude Code online";
    }
    if (status?.watching && status.activeSource === "claudeCode") {
      return language === "zh" ? "Claude Code 在线" : "Claude Code online";
    }
    if (status?.watching && status.activeSource && status.activeSource !== "codex") {
      return language === "zh" ? "Agent 在线" : "Agent online";
    }
    if (status?.watching) return copy.codexOnline;
    if (status?.claudeHome && !status?.codexHome) {
      return language === "zh" ? "寻找 Agent" : "Finding agent";
    }
    return copy.findingCodex;
  }, [language, status]);

  const animationKey = stateAnimationMap[petState];

  const handleAnimationComplete = useCallback(() => {
    if (stateRef.current === "fed") {
      playingFedRef.current = false;
      setSceneFed(null);
      dispatchLocalEvent("pet_idle");
      window.setTimeout(startNextFedIfReady, 0);
      return;
    }

    if (
      stateRef.current === "clicked" ||
      stateRef.current === "laboring" ||
      stateRef.current === "drag_start" ||
      stateRef.current === "drop" ||
      stateRef.current === "success"
    ) {
      dispatchLocalEvent("pet_idle");
    }
  }, [dispatchLocalEvent, startNextFedIfReady]);

  // SVG sprites have no frame player — simulate onComplete for one-shot states
  // using the CSS-aligned duration table (petEvents.svgStateDurationMs).
  useEffect(() => {
    if (!isSvgStage) return;
    const duration = svgStateDurationMs[petState];
    if (!duration) return;
    const timer = window.setTimeout(() => handleAnimationComplete(), duration);
    return () => window.clearTimeout(timer);
  }, [handleAnimationComplete, isSvgStage, lastEventAt, petState]);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button === 2) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers (tests) have no capturable id.
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      active: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.screenX - drag.startScreenX;
    const deltaY = event.screenY - drag.startScreenY;
    const distance = Math.hypot(deltaX, deltaY);

    if (!drag.active && distance >= DRAG_THRESHOLD_PX) {
      drag.active = true;
      dispatchLocalEvent("user_drag_start");
      // 开始拖动即收起菜单，回到纯角色窗口（§2）；特效覆盖层也跟着收起。
      if (uiModeRef.current === "menu") setUiMode("pet");
      hideFxOverlay();
      window.setTimeout(() => {
        if (dragRef.current?.pointerId === event.pointerId) {
          if (stateRef.current === "drag_start") {
            dispatchLocalEvent("user_drag_move");
          }
        }
      }, 80);
      if (isTauri()) {
        void getCurrentWindow()
          .startDragging()
          .catch(() => undefined);
      }
      return;
    }

    if (!drag.active || stateRef.current === "dragging") return;

    dispatchLocalEvent("user_drag_move");
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (event.button === 2) return;
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Native window dragging can release pointer capture before React sees pointerup.
    }

    if (drag.active) {
      finishDrag();
      return;
    }

    dragRef.current = null;

    // Click semantics (GDD §10.2): stage egg collects when ready; otherwise
    // pet mode opens the menu, menu mode works the active pet.
    if (!activePet && stageEgg) {
      if (stageEggReady) {
        collectEgg(stageEgg.id);
        return;
      }
      if (uiMode === "pet") {
        dispatchLocalEvent("user_click");
        openMenu();
      }
      return;
    }

    if (uiMode === "pet") {
      // SVG 舞台：点击反馈走叠加层，不打断当前动画；PNG 自定义头像保持旧行为。
      if (isSvgStage) {
        triggerPetReaction();
      } else {
        dispatchLocalEvent("user_click");
      }
      openMenu();
      return;
    }

    if (uiMode === "menu" && activePet) {
      // 打工连点只要点击反馈，不换台词（气泡留给引导/收益提示）。
      if (isSvgStage) triggerPetReaction(false);
      workOn(activePet.id);
    }
  };

  const handlePointerCancel = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    finishDrag();
  };

  const closePet = () => {
    if (isTauri()) {
      void invoke("close_pet");
      return;
    }
    window.close();
  };

  const copy = uiCopy[language];

  // --- tutorial hints (state-triggered, OnboardingFlow §二·1) ---
  // 由存档状态推导当前引导节点（接管完整三天），不再是线性 tutorialStep 计数。
  const tutorialHint = useMemo(() => {
    if (!save || !gameConfig) return null;
    return computeTutorialHint({ save, config: gameConfig, uiMode });
  }, [gameConfig, save, uiMode]);

  // 引导气泡 10s 自动收起（GDD §10.4）：按 hint.id + uiMode 重新计时；收起后不再
  // 复读同一节点，直到出现不同的引导或切换界面。终局"毕业"节点在收起时才把
  // tutorialStep 推到 GRADUATION_STEP —— 若在出现时就推进，会因谓词失配导致气泡
  // 一帧即隐、玩家根本读不到。
  const [dismissedHintId, setDismissedHintId] = useState<string | null>(null);
  const tutorialHintId = tutorialHint?.id ?? null;
  useEffect(() => {
    if (!tutorialHintId) return;
    setDismissedHintId(null);
    const timer = window.setTimeout(() => {
      setDismissedHintId(tutorialHintId);
      if (tutorialHintId === "graduation") advanceTutorial(GRADUATION_STEP);
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [advanceTutorial, tutorialHintId, uiMode]);
  const visibleTutorialHint =
    tutorialHint && tutorialHint.id !== dismissedHintId ? tutorialHint : null;

  // 后院红点：能买第二颗蛋 / 有蛋可收取 / 可融合（两只同阶满级凑齐）。
  const shopBadge =
    save != null &&
    gameConfig != null &&
    save.pets.length < 2 &&
    save.coins >= Math.min(...Object.values(gameConfig.eggPrices));
  const hatcheryBadge =
    save != null && save.eggs.some((egg) => egg.slot != null && egg.hatchAt != null && stageNow >= egg.hatchAt);
  const fusionBadge = save != null && gameConfig != null && fusionReady(gameConfig, save);
  const backyardBadge = shopBadge || hatcheryBadge || fusionBadge;

  const showStage = uiMode === "pet" || uiMode === "menu";
  const gameReady = save != null && gameConfig != null;

  // —— 提示统一走对话气泡（§1/§2/§7）——
  // 主界面（pet/menu）上，状态提示（原 toast）> 新手/薪水引导 > 随机台词共用一个
  // 气泡区，互不叠加；浮动 pill 只保留给没有气泡区的界面（后院/调试）。
  const stageToast = showStage ? toast : null;
  const stageHint = showStage ? visibleTutorialHint : null;
  const bubbleText = stageToast?.text ?? stageHint?.text ?? (speechVisible ? speechLine : null);
  const bubbleIsHint = stageToast == null && stageHint != null;
  if (bubbleText != null) lastBubbleTextRef.current = bubbleText;

  useEffect(() => {
    bubbleBusyRef.current = stageToast != null || stageHint != null;
    // 引导/状态提示接管气泡时丢弃待播的随机台词，避免提示结束后旧台词突然冒出。
    if (bubbleBusyRef.current) setSpeechVisible(false);
  }, [stageToast, stageHint]);

  const handleShellPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && uiMode !== "pet") {
      goBack();
    }
  };

  return (
    <main
      className={`pet-shell state-${petState} facing-${movementDirection} ui-${uiMode} ${isTauri() ? "" : "is-preview"}`}
      style={
        uiMode === "backyard"
          ? // 停靠模式：窗口尺寸由用户拉伸决定，内容始终铺满
            { width: "100%", height: "100%" }
          : { width: windowSize.w, height: windowSize.h }
      }
      onPointerDown={handleShellPointerDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {showStage && (
        <section
          className={`speech ${bubbleText != null ? "is-visible" : "is-hidden"}${bubbleIsHint ? " is-hint" : ""}`}
          data-tauri-drag-region
        >
          <span>{bubbleText ?? lastBubbleTextRef.current}</span>
        </section>
      )}

      {showStage ? (
        <div className="pet-stage">
          <div className="exp-pop-layer" aria-hidden="true">
            {pops
              .filter((item) => item.x == null)
              .map((item) => (
                <span
                  key={item.id}
                  className={`exp-pop pop-${item.kind} exp-pop-lane-${item.lane} ${item.big ? "pop-big" : ""}`}
                >
                  <span className="pop-icon">{POP_ICONS[item.kind]}</span>
                  {item.text}
                </span>
              ))}
          </div>
          {/* 连击累计读数（点击游戏爽快感） */}
          {comboView && (
            <div
              className={`combo-pop ${comboView.flip % 2 === 0 ? "combo-pop-a" : "combo-pop-b"}`}
              style={{ "--combo-scale": `${1 + Math.min(comboView.count, 20) * 0.025}` } as CSSProperties}
              aria-hidden="true"
            >
              {comboView.count > 1 && <span className="combo-count">连击 ×{comboView.count}</span>}
              <span className="combo-line">🪙 +{comboView.coins}</span>
              {comboView.exp > 0 && <span className="combo-line combo-exp">✨ +{comboView.exp}</span>}
            </div>
          )}
          <div
            ref={duckFacingRef}
            className={`duck-facing ${finisherClass}`}
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {gameReady && !activePet && stageEgg ? (
              <StageEgg egg={stageEgg} config={gameConfig} now={stageNow} />
            ) : isSvgStage && gameConfig && activePet ? (
              <div className={`pet-react-pulse ${reactionPulseClass}`}>
                <SvgSprite
                  species={activePet.species}
                  config={gameConfig}
                  petState={petState}
                  className="duck duck-svg"
                />
              </div>
            ) : (
              <AnimationPlayer
                key={`${animationKey}-${lastEventAt}`}
                className="duck"
                animationKey={animationKey}
                alt={copy.duckAlt}
                draggable={false}
                onComplete={handleAnimationComplete}
                avatarManifest={avatarSelection?.manifest}
                avatarRootPath={avatarSelection?.rootPath}
              />
            )}
            {reactionBursts.map((id) => (
              <ReactionBurst key={id} color={reactionColor} />
            ))}
            {/* 打工工具粒子爆发（连击越多越密越广；先只做六个一阶角色） */}
            {isSvgStage &&
              activePet &&
              workBursts.map((burst) => (
                <WorkBurst
                  key={burst.id}
                  species={activePet.species}
                  tier={burst.tier}
                  seed={burst.seed}
                  boom={burst.boom}
                />
              ))}
          </div>
        </div>
      ) : uiMode === "backyard" ? (
        gameReady && (
          <BackyardScene
            save={save}
            config={gameConfig}
            busy={gameBusy}
            statusText={statusText}
            projectTokens={projectTokens}
            petState={petState}
            fedPulse={sceneFed}
            speechLine={speechLine}
            speechVisible={speechVisible}
            toast={toast}
            onOpenMarket={openSteamMarket}
            onWalkingChange={handleSceneWalking}
            onBack={goBack}
            onWorkPet={workOn}
            onCollectEgg={collectEgg}
            onPlaceEgg={placeEgg}
            onBuyEgg={buyEgg}
            onUpgradeHatchery={upgradeHatchery}
            onUpgradeYard={upgradeYard}
            onFuse={fusePets}
            onFollow={followPet}
            onRelease={releasePet}
            onToast={showToastMsg}
          />
        )
      ) : uiMode === "settings" ? (
        gameReady && (
          <PanelShell title={PANEL_TITLES.settings} onBack={goBack}>
            <div className="settings-panel">
              <span className="settings-label">{copy.languageLabel}</span>
              <div className="settings-options">
                <button
                  type="button"
                  className={`settings-btn ${language === "zh" ? "is-selected" : ""}`}
                  onClick={() => changeLanguage("zh")}
                >
                  {copy.simplifiedChinese}
                </button>
                <button
                  type="button"
                  className={`settings-btn ${language === "en" ? "is-selected" : ""}`}
                  onClick={() => changeLanguage("en")}
                >
                  {copy.english}
                </button>
              </div>
              <button type="button" className="settings-btn settings-action" onClick={() => selectPanel("debug")}>
                🛠 {copy.debugLabel}
              </button>
              <button type="button" className="settings-btn settings-action is-danger" onClick={closePet}>
                {copy.closePet}
              </button>
            </div>
          </PanelShell>
        )
      ) : (
        gameReady && (
          <PanelShell title={PANEL_TITLES.debug} onBack={goBack}>
            <DebugPanel
              config={gameConfig}
              save={save}
              bridge={bridge}
              onSave={setSave}
              onToast={showToastMsg}
              onFeedTokens={bridge.debugFeedTokens ? debugFeed : undefined}
            />
          </PanelShell>
        )
      )}

      {(uiMode === "menu" || uiMode === "debug" || uiMode === "settings") && gameReady && (
        <MenuBar
          uiMode={uiMode}
          save={save}
          config={gameConfig}
          onSelect={selectPanel}
          onPetAvatarClick={() => setUiMode("menu")}
          backyardBadge={backyardBadge}
        />
      )}

      {/* anchored pops (yard cards etc.) */}
      <div className="anchored-pop-layer" aria-hidden="true">
        {pops
          .filter((item) => item.x != null)
          .map((item) => (
            <span
              key={item.id}
              className={`exp-pop pop-${item.kind} is-anchored ${item.big ? "pop-big" : ""}`}
              style={{ left: item.x, top: item.y }}
            >
              <span className="pop-icon">{POP_ICONS[item.kind]}</span>
              {item.text}
            </span>
          ))}
      </div>

      {!showStage && visibleTutorialHint && (
        <div className="tutorial-bubble" key={visibleTutorialHint.id}>
          {visibleTutorialHint.text}
        </div>
      )}

      {/* 后院有主角时，提示改由场景的头顶气泡表达（BackyardScene 内） */}
      {!showStage && toast && !(uiMode === "backyard" && activePet != null) && (
        <div className="game-toast" key={toast.id}>
          {toast.text}
        </div>
      )}

      {fusionFlash && <div className="fusion-flash" />}

      {welcomeOffline != null && gameReady && (
        <WelcomeBackCard
          save={save}
          config={gameConfig}
          offlineMs={welcomeOffline}
          onClose={() => setWelcomeOffline(null)}
        />
      )}

    </main>
  );
}
