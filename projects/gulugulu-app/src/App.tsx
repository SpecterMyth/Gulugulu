import { invoke } from "@tauri-apps/api/core";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
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
  SLEEP_TIMEOUT_MS,
  svgStateDurationMs,
  transientStateDurationMs,
} from "./petEvents";
import type {
  FusionStartResult,
  PetEventType,
  PetInstance,
  PetState,
  TokenBreakdown,
} from "./types";
import { breakdownTotal, EMPTY_BREAKDOWN } from "./types";
import { isTauri } from "./tauri";
import { elementName, fmt, type Language, localizeGameMessage, speciesDisplayName, t } from "./i18n";
import { LanguageContext } from "./useT";
import { previewFx, previewPetState, previewUiMode } from "./preview/shotParams";
import { useGame, useNowSeconds } from "./game/useGame";
import {
  MenuBar,
  PanelShell,
  WINDOW_SIZES,
  type UiMode,
} from "./game/GamePanels";
import { BackyardScene } from "./game/BackyardScene";
import type { CelebrationPayload, CelebrationPulse, HatchBranch } from "./game/CelebrationCinematic";
import { celebrationDurationFor } from "./game/CelebrationCinematic";
import { rememberFusionEgg, shouldPromptAutostart, takeFusionEgg } from "./app/autostartNudge";
import { DebugPanel } from "./game/DebugPanel";
import { eggPriceFor, isMaxLevel } from "./game/config";
import { formatCount } from "./game/format";
import { foodFlightFor, keycapFlightsFor, useFlights } from "./game/FlightLayer";
import { foodLevelForTokens } from "./sprites/parts/glyphs";
import { activePetCanFuse, hatcheryFull } from "./game/tutorial";
import {
  type Bounds,
  type Direction,
  errorMessage,
  formatNumber,
} from "./app/geometry";
import { AUTONOMOUS_MOVE_DURATION_MS, chooseAutonomousTarget, moveWindowAlongPath } from "./app/wander";
import {
  chooseQuote,
  createQuoteDecks,
  LANGUAGE_STORAGE_KEY,
  loadInitialLanguage,
  makePetEvent,
  staminaRecoveryText,
  tokenMealText,
} from "./app/speech";
import { Overlays } from "./app/Overlays";
import { PetStage } from "./app/PetStage";
import { type GamePop, type PopKind, POP_ICONS } from "./app/pops";
import { SettingsPanel } from "./app/SettingsPanel";
import { SpeechBubble } from "./app/SpeechBubble";
import { useAppSettings } from "./app/hooks/useAppSettings";
import { useCodexStatus } from "./app/hooks/useCodexStatus";
import { useDynamicQuotes } from "./app/hooks/useDynamicQuotes";
import { useEggCountdown } from "./app/hooks/useEggCountdown";
import { useFusionProgress } from "./app/hooks/useFusionProgress";
import { useAchievementUnlocks } from "./app/hooks/useAchievementUnlocks";
import { useFxOverlay } from "./app/hooks/useFxOverlay";
import { usePetStateMachine } from "./app/hooks/usePetStateMachine";
import { useSpeechDrop } from "./app/hooks/useSpeechDrop";
import { useSteamStatus } from "./app/hooks/useSteamStatus";
import { useSpeciesPreviews } from "./app/hooks/useSpeciesPreviews";
import { useTutorialHints } from "./app/hooks/useTutorialHints";
import { useOnboardingCoach } from "./app/coach/useOnboardingCoach";
import { CoachFx } from "./app/coach/CoachFx";
import { useWelcomeBack } from "./app/hooks/useWelcomeBack";

const DRAG_THRESHOLD_PX = 4;
const AUTONOMOUS_MOVE_DELAY_MS = 18_000;
const TOAST_VISIBLE_MS = 2600;
/** 菜单（后院/调试按钮）无操作自动收起，回到纯角色状态 */
const MENU_IDLE_HIDE_MS = 8000;
/** 后院连续无用户操作（点击/按键）自动返回主界面的静置时长（用户要求 5 分钟）。 */
const BACKYARD_IDLE_RETURN_MS = 5 * 60_000;
/** 欢迎卡打开时，窗口在卡片实测内容高度上再留的上下总余白（3px 边框×2 + 呼吸间距），
 *  让卡片不贴窗口边缘。见下方 window sizing effect。 */
const WELCOME_WINDOW_PAD = 34;
/** 欢迎卡窗口高度上限（逻辑 px）：极端长文案兜底——超出仍由卡片内部滚动
 *  （styles.css `.welcome-card:has(.welcome-report)`），不至于把窗口撑出屏幕。 */
const WELCOME_WINDOW_MAX_H = 680;
/** 记住用户上次把后院窗口拉到多高（逻辑 px），下次进入按此高度停靠。
 *  由 BackyardScene 仅在卸载时落盘最终高度——绝不逐帧写入进入瞬间的过渡值，
 *  否则该过渡值（= 上一面板的窗口高，调试 560 / 菜单 428）会被下面的 dock
 *  逻辑读回，造成"从调试进后院比从主界面进更大"。key 升到 v2 丢弃旧脏值。 */
const BACKYARD_HEIGHT_KEY = "gulugulu.backyardHeight.v2";

function storedBackyardHeight(): number {
  try {
    const parsed = Number(window.localStorage.getItem(BACKYARD_HEIGHT_KEY));
    if (Number.isFinite(parsed) && parsed >= 240) return Math.round(parsed);
  } catch {
    // localStorage 不可用时用默认高度
  }
  // 统一默认 = 从主界面（菜单态）进入后院时的窗口高度（用户要求以主界面为准）：
  // 各入口一致、缩放≈原生 1.0x。其它入口不再把自身窗口高带进后院。
  return WINDOW_SIZES.menu.h;
}

type DragState = {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  active: boolean;
};

/** 连击窗口：两次打工点击间隔小于该值算连击 */
const COMBO_WINDOW_MS = 1100;

/** 能量饭团飞到嘴边、宠物开吃的时机（略早于 foodFlightFor 的 1.9s 落点，
 *  让夸张咀嚼与食物"缩小消失"衔接；配 fed 状态 1.7s 咀嚼 ≈ 总 3s）。 */
const FOOD_ARRIVE_MS = 1650;
/** 播餐看门狗：飞行 1650ms + fed 1700ms + 富余。fed 是可被打断的一次性态
 * （点击/拖拽会抢状态），被抢后 "fed 播完 → 清 playingFedRef" 永远不来，
 * 进食队列会从此卡死（本会话再也不播进食）——超时强制收尾。 */
const FOOD_MEAL_FAILSAFE_MS = 6000;

/** 待播的进食演出：2026-07-21 起 Token → **经验**，只喂陪伴宠
 *  （InteractionEconomy §3.3）。breakdown 是本次吃进的四分明细（v1.3 四分
 *  喂养）——总量给食物分级，分项供气泡报「吃到 N 输入 / M 产出 Token」。 */
type PendingFed = {
  id: number;
  /** 本餐给陪伴宠的经验点数（0 = 满级/缺席浪费，照吃不冒字）。 */
  exp: number;
  breakdown: TokenBreakdown;
  /** 产出这些 token 的 Agent（"codex" | "claudeCode"；调试投喂为 ""）——气泡报来源用。 */
  source: string;
  /** 本餐是否触发陪伴宠升级（气泡改口"升级啦"用）。 */
  leveledUp: boolean;
};

export default function App() {
  const [movementDirection, setMovementDirection] = useState<Direction>("right");
  const [language, setLanguage] = useState<Language>(() => loadInitialLanguage());
  const [speechLine, setSpeechLine] = useState(() => chooseQuote(loadInitialLanguage(), "idle", createQuoteDecks()));
  const [speechVisible, setSpeechVisible] = useState(false);
  const [pops, setPops] = useState<GamePop[]>([]);
  const [pendingFedQueue, setPendingFedQueue] = useState<PendingFed[]>([]);
  const languageRef = useRef<Language>(language);
  const dragRef = useRef<DragState | null>(null);
  const dragEndTimerRef = useRef<number | null>(null);
  const popIdRef = useRef(0);
  const pendingFedIdRef = useRef(0);
  const playingFedRef = useRef(false);
  const fedFailsafeRef = useRef<number | null>(null);
  const autonomousMovePlayedRef = useRef(false);
  const quoteDecksRef = useRef(createQuoteDecks());
  // 催蛋：每颗蛋一条串行请求链（杜绝乱序回包把倒计时顶回去 → 卡在剩 2–3s）+ 已触发收取去重集。
  const pokeChainRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const autoCollectedRef = useRef<Set<string>>(new Set());

  // --- game state ---
  const { bridge, config: gameConfig, save, setSave } = useGame();
  // 预览截图 rig:?ui= 指定初始面板(仅 !isTauri 生效,见 preview/shotParams)。
  const initialUiMode = (previewUiMode() as UiMode | null) ?? "pet";
  const [uiMode, setUiMode] = useState<UiMode>(initialUiMode);
  const uiModeRef = useRef<UiMode>(initialUiMode);
  const [gameBusy, setGameBusy] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastIdRef = useRef(0);
  const [welcomeOffline, setWelcomeOffline] = useWelcomeBack();
  // 欢迎卡实测内容高度（由卡片报上来），用于把窗口临时增高到不截断昨日战报。
  const [welcomeCardHeight, setWelcomeCardHeight] = useState<number | null>(null);
  // 后院场景状态回传：主角行走中则暂缓进食动画；fedPulse 交给场景播放。
  const [sceneWalking, setSceneWalking] = useState(false);
  const sceneWalkingRef = useRef(false);
  // 后院进食演出：exp 决定 +N 经验飘字，level 决定食物体型。
  const [sceneFed, setSceneFed] = useState<{ id: number; exp: number; level: number } | null>(null);
  // 后院庆典演出（孵化揭晓 / 融合达成）：一次性脉冲，交给 BackyardScene 播放电影化揭晓。
  const [celebration, setCelebration] = useState<CelebrationPulse | null>(null);
  const celebrationIdRef = useRef(0);
  const fireCelebration = useCallback((payload: CelebrationPayload) => {
    celebrationIdRef.current += 1;
    setCelebration({ ...payload, id: celebrationIdRef.current, at: Date.now() });
  }, []);
  // 「开机自启」引导弹窗（融合领新宠后弹出，最多三次；加入自启即不再弹）。
  const [autostartPromptOpen, setAutostartPromptOpen] = useState(false);
  const autostartPromptOpenRef = useRef(false);
  useEffect(() => {
    autostartPromptOpenRef.current = autostartPromptOpen;
  }, [autostartPromptOpen]);

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
  const stageNow = useEggCountdown(stageEgg);
  const stageEggReady =
    stageEgg?.slot != null && stageEgg.hatchAt != null && stageNow >= stageEgg.hatchAt;

  // —— 新手强引导教练（docs/gdd/OnboardingCoach.md）。放在游戏动作回调之前，
  //    以便回调里调用 markSwitched/markDone 等（稳定 useCallback）。——
  // hatcheryReady 需要一个**独立于 stageEgg 的实时秒针**：stageNow 只在 stageEgg 非空
  // （即无在养宠）时才跑 1s interval，有在养宠时冻结在挂载值 → 有宠期间后院孵化红点与
  // 教练「蛋好了，去收」提示整局都不再触发（后端已孵好，主窗口 UI 却不知道）。对任何
  // 已入槽计时的蛋开一个独立秒针即可（1Hz 重渲染，与蛋在台时同等开销）。
  const yardNow = useNowSeconds(
    save != null && save.eggs.some((egg) => egg.slot != null && egg.hatchAt != null),
  );
  const hatcheryReady =
    save != null &&
    save.eggs.some((egg) => egg.slot != null && egg.hatchAt != null && yardNow >= egg.hatchAt);
  const [yardCoach, setYardCoach] = useState<{ nearShop: boolean; nearPetId: string | null }>({
    nearShop: false,
    nearPetId: null,
  });
  // 融合确认弹窗（fusePets 打开）—— 提前声明供教练 resolver 判「弹窗已开 → 指向开始融合」（#8）。
  const [fusionPair, setFusionPair] = useState<{ a: PetInstance; b: PetInstance } | null>(null);
  const coach = useOnboardingCoach({
    save,
    config: gameConfig,
    uiMode,
    hatcheryReady,
    nearShop: yardCoach.nearShop,
    nearPetId: yardCoach.nearPetId,
    exhausted: activePet?.exhausted ?? false,
    fusionModalOpen: fusionPair != null,
    lang: language,
  });
  const { markMoved, markSwitched, markCeDone, markDone } = coach;
  // 首次拥有二阶宠（收下融合结果）→ 永久退休教练：C8「回主界面看融出了啥」只在第一次融合后出现一次，
  // 后续融合不再提示（即使把二阶宠放生也不复活，markDone 幂等地锁死）。
  useEffect(() => {
    if (save?.pets.some((pet) => pet.tier >= 2)) markDone();
  }, [save, markDone]);

  // SVG rig 是唯一舞台：有主宠即渲染 SVG 精灵（PNG 自定义头像方案已下线）。
  const isSvgStage = activePet != null;
  // 点击反馈爆发粒子的颜色跟随主属性元素色
  const reactionColor =
    (gameConfig &&
      activePet &&
      gameConfig.elements[gameConfig.species[activePet.species]?.elements?.[0] ?? "normal"]?.color) ||
    "#F5917B";

  // 气泡左上角装饰位：当前角色的属性（元素）图标，有几个显示几个。无主宠（蛋）时为空。
  // nameZh 字段名是 SpeechBubble 的历史接口；值随当前语言本地化（tooltip 用）。
  const stageElements = useMemo<Array<{ id: string; badge: string; color: string; nameZh: string }>>(() => {
    if (!gameConfig || !activePet) return [];
    const species = gameConfig.species[activePet.species];
    if (!species) return [];
    return species.elements.flatMap((id) => {
      const info = gameConfig.elements[id];
      if (!info) return [];
      const name = language === "zh" ? info.nameZh : elementName(id, language);
      return [{ id, badge: info.badge, color: info.color, nameZh: name }];
    });
  }, [gameConfig, activePet, language]);

  // 稳定回调里取当前语言的壳层词条（languageRef 恒新，callback 无需吃 language 依赖）。
  const shOf = useCallback(() => t(languageRef.current).sh, []);

  // 展示前统一过 localizeGameMessage：Rust/mock 的 "#key|a=b" 协议消息渲染为当前
  // 语言；已本地化的普通字符串原样透传（幂等）。
  const showToastMsg = useCallback((text: string) => {
    const id = toastIdRef.current + 1;
    toastIdRef.current = id;
    setToast({ id, text: localizeGameMessage(text, languageRef.current) });
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

  // 截图特效(?fx=pops,仅预览截图模式):周期洒金币/经验飘字,拍"打工收益满屏"镜头。
  useEffect(() => {
    if (previewFx() !== "pops") return;
    const timer = window.setInterval(() => {
      const id = popIdRef.current;
      pushPop(`+${12 + (id % 5) * 7}`, id % 3 === 0 ? "exp" : "coin", undefined, id % 4 === 0);
    }, 300);
    return () => window.clearInterval(timer);
  }, [pushPop]);

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

  const {
    petState,
    stateRef,
    lastEventAt,
    setLastEventAt,
    agentActiveUntilRef,
    dispatchPetEvent,
    dispatchLocalEvent,
    settleAfterOneShot,
  } = usePetStateMachine(showSpeechForState, activePetExhaustedRef, autonomousMovePlayedRef);

  // 点击反馈叠加层（计划 §2.4）：不打断当前动画，在 wrapper 上叠加一次
  // 压扁脉冲 + 元素色爆发粒子。连点靠 -a/-b 类交替重启动画。
  const [reactionPulseFlip, setReactionPulseFlip] = useState(-1);
  const [reactionBursts, setReactionBursts] = useState<number[]>([]);
  const reactionIdRef = useRef(0);
  // 点击手感 L3：清空一管精力时的"管末大跳"演出（纯表现，无数值）。
  const [finisherFlip, setFinisherFlip] = useState(-1);
  // 汇聚飞行（键帽雨=精力 / Token 餐=经验）与精力条获得脉冲（InteractionEconomy §6.1/§6.3）。
  const { flights, spawnFlights, removeFlight } = useFlights();
  const [energyPulse, setEnergyPulse] = useState(0);
  // 10% 唤醒瞬间的 CSS 伸懒腰（§6.4）。
  const [waking, setWaking] = useState(false);

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
      // 精力恢复期：点击不出随机台词，改在对话气泡里演驳回（§6.4）。
      if (activePet?.exhausted) {
        showToastMsg(staminaRecoveryText(activePet.stamina, gameConfig?.wakeThreshold, languageRef.current));
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
  const {
    duckFacingRef,
    stageRef,
    ensureFxOverlay,
    hideFxOverlay,
    spawnWorkBurst,
    emitWorkBurstAtRect,
    emitFoodFlight,
    emitCelebration,
    emitYardFx,
    workBursts,
  } = useFxOverlay(uiMode, activePetSpecies);
  const { speechDrop, speechRef } = useSpeechDrop(uiMode, activePetSpecies, petState, duckFacingRef);

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

  // 仅更新 UI 语言（state + localStorage + 台词）。已是该语言则忽略——供
  // settings://changed 回流时安全调用，不会与用户主动切换成环。
  const applyLanguage = useCallback((nextLanguage: Language) => {
    if (nextLanguage === languageRef.current) return;
    languageRef.current = nextLanguage;
    setLanguage(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    setSpeechLine(chooseQuote(nextLanguage, stateRef.current, quoteDecksRef.current));
  }, []);

  // 用户主动切换语言：更新 UI + 推给 Rust（持久化并同步托盘菜单文案）。
  const changeLanguage = useCallback(
    (nextLanguage: Language) => {
      applyLanguage(nextLanguage);
      void bridge.setLanguage(nextLanguage).catch(() => undefined);
    },
    [applyLanguage, bridge],
  );

  const { appSettings, handleAlwaysOnTop, handleKeyboardCapture, handleRandomMovement, handleAutostart } =
    useAppSettings(bridge, applyLanguage, languageRef);
  // 引导弹窗的判定读最新设置（自启态 + 已展示次数），避免把 appSettings 塞进 collectEgg 依赖。
  const appSettingsRef = useRef(appSettings);
  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  // 融合领新宠且庆典演出结束后调用：未加入自启且未到展示上限时弹一次引导，并记一次展示。
  // 计数真源在 Rust（note_autostart_prompt_shown 广播 settings://changed 回填），这里只做门槛判断。
  const maybePromptAutostart = useCallback(() => {
    if (!shouldPromptAutostart(appSettingsRef.current)) return;
    if (autostartPromptOpenRef.current) return; // 已有弹窗打开，不叠加
    setAutostartPromptOpen(true);
    void bridge.noteAutostartPromptShown().catch(() => undefined);
  }, [bridge]);

  const acceptAutostart = useCallback(() => {
    setAutostartPromptOpen(false);
    handleAutostart(true);
  }, [handleAutostart]);

  const declineAutostart = useCallback(() => {
    setAutostartPromptOpen(false);
  }, []);

  const enqueueFed = useCallback((exp: number, breakdown: TokenBreakdown, source: string, leveledUp: boolean) => {
    const id = pendingFedIdRef.current + 1;
    pendingFedIdRef.current = id;
    setPendingFedQueue((items) => [...items, { id, exp, breakdown, source, leveledUp }]);
    // 数值入账不在这里做：Token 喂养的 `game://exp` 补丁（onExpPatch）已即时
    // 改写陪伴宠的 exp/level，这里只排进食演出（合餐可能晚几拍才播）。
  }, []);

  const startNextFedIfReady = useCallback(() => {
    if (playingFedRef.current || pendingFedQueue.length === 0) return;
    const mode = uiModeRef.current;
    // 后院里保持原地播放进食：主角行走中先攒着，停下再吃。
    const inBackyardIdle = mode === "backyard" && !sceneWalkingRef.current;
    if (mode !== "pet" && mode !== "menu" && !inBackyardIdle) return;
    // working/thinking 也放行：Token 餐只在 agent 活跃时产生，而活跃锁存恰好把
    // 宠物钉在这两个循环态——若只许 idle，进食演出会整段会话饿死在队列里，
    // 用户只看到精力条"凭空回满"（eat 是一次性态，播完自动落回锁存基线）。
    if (
      stateRef.current !== "idle" &&
      stateRef.current !== "sleeping" &&
      stateRef.current !== "exhausted" &&
      stateRef.current !== "working" &&
      stateRef.current !== "thinking"
    ) {
      return;
    }

    // 合餐（InteractionEconomy §6.3）：把队列里全部待播项合成一餐播放。
    const merged = pendingFedQueue.reduce((sum, item) => sum + item.exp, 0);
    const mergedBreakdown = pendingFedQueue.reduce<TokenBreakdown>(
      (acc, item) => ({
        input: acc.input + item.breakdown.input,
        cacheCreate: acc.cacheCreate + item.breakdown.cacheCreate,
        cacheRead: acc.cacheRead + item.breakdown.cacheRead,
        output: acc.output + item.breakdown.output,
      }),
      { ...EMPTY_BREAKDOWN },
    );
    const mergedTokens = breakdownTotal(mergedBreakdown);
    // 合餐里只要有一次触发升级，气泡就报"升级啦"。
    const mergedLeveledUp = pendingFedQueue.some((item) => item.leveledUp);
    const mealId = pendingFedQueue[pendingFedQueue.length - 1].id;
    // 合餐的来源报最近一次 token 事件的 Agent（连续投喂几乎总是同源）。
    const mealSource = pendingFedQueue[pendingFedQueue.length - 1].source;
    const foodLevel = foodLevelForTokens(mergedTokens);
    playingFedRef.current = true;
    setPendingFedQueue([]);
    // 看门狗：fed 被点击/拖拽抢断时正常收尾不会来，超时强制解锁并触发
    // 播放器复核（poke 队列引用；空队列不 poke，等下一次入账自然触发）。
    if (fedFailsafeRef.current !== null) window.clearTimeout(fedFailsafeRef.current);
    fedFailsafeRef.current = window.setTimeout(() => {
      fedFailsafeRef.current = null;
      if (!playingFedRef.current) return;
      playingFedRef.current = false;
      setSceneFed(null);
      setPendingFedQueue((items) => (items.length > 0 ? [...items] : items));
    }, FOOD_MEAL_FAILSAFE_MS);

    // 能量饭团从远处慢慢飘来（~1.9s）：主窗口直接放飞行层，后院把 level
    // 交给场景层放飞行（BackyardScene 自订阅）。只要吃进了 token 就飞食物——
    // 陪伴宠满级/缺席（浪费）时 merged=0 也照飞照吃，只是不冒 +经验 飘字。
    if (mode === "backyard") {
      setSceneFed({ id: mealId, exp: merged, level: foodLevel });
    } else if (mergedTokens > 0) {
      // 能量饭团优先走全屏覆盖层（穿桌面飘来、不被 280×320 小窗上沿硬裁），
      // 覆盖层未就绪 / 预览模式回退窗口内飞行层（同一枚 flight，轨迹一致）。
      const flight = foodFlightFor(foodLevel);
      void emitFoodFlight([flight]).then((sent) => {
        if (!sent) spawnFlights([flight]);
      });
    }

    // 经验真的涨了才冒气泡：首餐给一次性玩法发现提示，之后每餐报
    // 「吃到 <Agent> 的 X Token，经验涨了！」。满级浪费（merged=0）时静默吃。
    if (merged > 0) {
      let firstMeal = false;
      try {
        if (!window.localStorage.getItem("gulugulu.tokenExpSeen")) {
          window.localStorage.setItem("gulugulu.tokenExpSeen", "1");
          firstMeal = true;
        }
      } catch {
        // localStorage 不可用时按非首餐处理
      }
      showToastMsg(
        firstMeal
          ? shOf().toast.firstTokenMeal
          : tokenMealText(mealSource, mergedTokens, merged, mergedLeveledUp, languageRef.current),
      );
    }

    // 食物飞到嘴边（~1.65s）才开吃：夸张咀嚼 + 经验飘字，与食物"缩小消失"
    // 衔接。让整段 Token 进食动画慢下来、看得清（总时长 ~3s）。数值已随
    // 入账（game://exp 补丁）即时改写，这里只做演出。
    const chew = () => {
      if (mode !== "backyard" && merged > 0) pushPop(`+${formatNumber(merged)}`, "exp");
      dispatchPetEvent(makePetEvent("agent_token_gain"));
    };
    if (mergedTokens > 0) window.setTimeout(chew, FOOD_ARRIVE_MS);
    else chew();
  }, [dispatchPetEvent, emitFoodFlight, pendingFedQueue, pushPop, shOf, showToastMsg, spawnFlights]);

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
  }, [ensureFxOverlay]);

  const goBack = useCallback(() => {
    setUiMode((mode) => (mode === "pet" || mode === "menu" ? "pet" : "menu"));
  }, []);

  // 后院无操作自动返回主界面：连续 5 分钟没有任何用户操作（点击/按键）就执行一次
  // "返回"（等同左下角返回牌 → 回到菜单态主界面，再由菜单闲置逻辑收回纯角色）。
  // 只有用户输入才重置计时——宠物自动漫步 / Agent 活动 / 喂食演出都不算"操作"。
  // 捕获阶段监听 window：后院内各面板会对 click 调 stopPropagation，用捕获可确保
  // 每次真实交互都能重置计时，不被子层吞掉。
  useEffect(() => {
    if (uiMode !== "backyard") return;
    let timer = window.setTimeout(goBack, BACKYARD_IDLE_RETURN_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(goBack, BACKYARD_IDLE_RETURN_MS);
    };
    window.addEventListener("pointerdown", reset, { capture: true });
    window.addEventListener("keydown", reset, { capture: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", reset, { capture: true });
      window.removeEventListener("keydown", reset, { capture: true });
    };
  }, [uiMode, goBack]);

  const selectPanel = useCallback((mode: Exclude<UiMode, "pet" | "menu">) => {
    setUiMode(mode);
  }, []);

  // 纯抚摸模式（日额度用尽）提示只说一次/会话，避免连点刷屏。
  const capNoticedRef = useRef(false);
  // 第 2000 击达成庆祝只演一次（额度翻转后复位）。
  const capCelebratedRef = useRef(false);
  // 管级累计器（InteractionEconomy §6.5）：每只宠一管内的金币/经验，
  // 第 200 击"满工收工"结算横幅用。
  const barTotalsRef = useRef(new Map<string, { coins: number; exp: number }>());

  const workOn = useCallback(
    (petId: string, at?: { x: number; y: number }) => {
      if (!save) return;
      const isActive = petId === save.activePetId;
      bridge
        .clickWork(petId)
        .then((result) => {
          setSave(result.save);
          if (result.dailyCapped) {
            // 日额度用尽 → 纯抚摸（InteractionEconomy §4.2）：无数字无收益，
            // 只给摸头反馈与一次性温馨提示。
            if (isActive && (uiModeRef.current === "menu" || uiModeRef.current === "pet")) {
              dispatchLocalEvent("user_click");
            }
            if (!capNoticedRef.current) {
              capNoticedRef.current = true;
              showToastMsg(shOf().toast.capPetting);
            }
            return;
          }
          // 点击手感 L1：≥10 金的收益飘字放大一档，让 2 阶富点击可见。
          pushPop(`+${formatCount(result.coinsGained)}`, "coin", at, result.coinsGained >= 10);
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

          // —— 200 击长管节奏（InteractionEconomy §6.5）——
          const petAfter = result.save.pets.find((item) => item.id === petId);
          if (petAfter && gameConfig) {
            const perClick = Math.max(1, gameConfig.staminaPerClick);
            const clicksIntoBar = Math.round((gameConfig.staminaMax - petAfter.stamina) / perClick);
            // 管级累计：新一管开工（第 1 击）时清零。
            const totals =
              clicksIntoBar <= 1
                ? { coins: 0, exp: 0 }
                : barTotalsRef.current.get(petId) ?? { coins: 0, exp: 0 };
            totals.coins += result.coinsGained;
            totals.exp += result.expGained;
            barTotalsRef.current.set(petId, totals);
            // 50/100/150 击段落横幅 + screen boom（第 200 击交给大终结技）。
            const milestone = Math.max(1, Math.floor(gameConfig.staminaMax / perClick / 4));
            if (!result.becameExhausted && clicksIntoBar > 0 && clicksIntoBar % milestone === 0) {
              const label =
                clicksIntoBar === milestone * 2
                  ? shOf().pop.milestoneHalf
                  : clicksIntoBar === milestone * 3
                    ? shOf().pop.milestoneSprint
                    : fmt(shOf().pop.milestoneHits, { n: clicksIntoBar });
              pushPop(label, "levelup", at);
              if (isActive) spawnWorkBurst(14, true);
            }
            if (result.becameExhausted) {
              // 大终结技 + 收工结算横幅：「满工收工！本管 🪙+N ✨+N」。
              showToastMsg(
                fmt(shOf().toast.barDone, {
                  coins: formatNumber(totals.coins),
                  exp: formatNumber(totals.exp),
                }),
              );
              barTotalsRef.current.delete(petId);
            }
          }

          // 第 2000 击达成（日额度点满）：一次性庆祝，无金币奖励（§6.2）。
          if (gameConfig) {
            if (result.save.daily.clicks < gameConfig.dailyClickCap) {
              capCelebratedRef.current = false;
              capNoticedRef.current = false;
            } else if (!capCelebratedRef.current) {
              capCelebratedRef.current = true;
              spawnReactionBurst();
              showToastMsg(shOf().toast.capCelebrate);
            }
          }

          if (result.becameExhausted) {
            // 点击手感 L3：清空一管精力 = 管末大跳（在场主宠才演）。
            if (isActive) {
              triggerFinisher();
              window.setTimeout(() => dispatchLocalEvent("pet_exhausted"), 850);
            }
          }
        })
        .catch((error) => {
          const message = errorMessage(error);
          if (message.includes("exhausted")) {
            if (isActive) dispatchLocalEvent("pet_exhausted");
            const pet = save.pets.find((item) => item.id === petId);
            showToastMsg(staminaRecoveryText(pet?.stamina, gameConfig?.wakeThreshold, languageRef.current));
          } else {
            showToastMsg(message);
          }
        });
    },
    [
      bridge,
      dispatchLocalEvent,
      gameConfig,
      pushPop,
      registerWorkJuice,
      save,
      setSave,
      shOf,
      showToastMsg,
      spawnReactionBurst,
      spawnWorkBurst,
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
          // 揭晓物种以**实际孵出的宠**为准（收取前后 pets 差集）：Steam 流的实发物种
          // 由后端 collect_species_for 决定（商店蛋掷骰 / AI 未完成孵配方经典形象），
          // 可能不同于蛋上的占位物种；找不到新宠（异常）才退回蛋面。
          const prevPetIds = new Set(save.pets.map((pet) => pet.id));
          const hatched = next.pets.find((pet) => !prevPetIds.has(pet.id));
          const species = hatched?.species ?? egg?.species ?? "";
          // 名称优先取 AI 自定义物种的中文名，其次预设表，最后 codename；
          // EN 经 speciesDisplayName（目录物种 TitleCase，AI 用生成器给的英文专名 nameEn）。
          const nameZh =
            (species && next.customSpecies[species]?.info.nameZh) ||
            gameConfig.species[species]?.nameZh ||
            undefined;
          const nameEn =
            (species && next.customSpecies[species]?.info.nameEn) ||
            gameConfig.species[species]?.nameEn ||
            undefined;
          const name = species
            ? speciesDisplayName(species, languageRef.current, nameZh, nameEn)
            : shOf().fallbackPetName;
          const tier = egg?.tier ?? 1;
          const slot = egg?.slot ?? null;
          const f = egg?.pendingFusion;
          let branch: HatchBranch;
          if (f && f.status === "resolved") branch = "aiNew"; // 本次孵化诞生的全新 AI 物种（最强）
          else if (f) branch = "fallback"; // 生成失败/未完成 → 孵该配方经典（0 号固有）形象
          else if (species && next.customSpecies[species]) branch = "aiReuse"; // AI 形象复用
          else branch = "standard"; // 普通/经典孵化（统一中等强度）
          const payload: CelebrationPayload = { phase: "hatch", branch, tier, name, species, slot };
          fireCelebration(payload);
          // 融合领新宠：收取核销登记过的融合蛋 id → 判定来源；等庆典演出走完再引导开机自启。
          if (takeFusionEgg(eggId)) {
            const delayMs = celebrationDurationFor({ ...payload, id: 0, at: Date.now() }) + 400;
            window.setTimeout(maybePromptAutostart, delayMs);
          }
          showToastMsg(
            branch === "aiNew"
              ? fmt(shOf().toast.hatchAiNew, { name })
              : branch === "fallback"
                ? fmt(shOf().toast.hatchFallback, { name })
                : fmt(shOf().toast.hatchStandard, { name }),
          );
          dispatchLocalEvent("agent_work_finish");
        })
        .catch((error) => showToastMsg(errorMessage(error)))
        .finally(() => setGameBusy(false));
    },
    [
      bridge,
      dispatchLocalEvent,
      fireCelebration,
      gameConfig,
      maybePromptAutostart,
      save,
      setSave,
      shOf,
      showToastMsg,
    ],
  );

  const buyEgg = useCallback(
    (element: string, tier: number) => {
      if (!save) return;
      setGameBusy(true);
      bridge
        .buyEgg(element, tier)
        .then((next) => {
          setSave(next);
          const latest = next.eggs[next.eggs.length - 1];
          showToastMsg(latest?.slot != null ? shOf().toast.eggToSlot : shOf().toast.eggToInventory);
          pushPop(`-${formatNumber(gameConfig ? eggPriceFor(gameConfig, element, tier) : 0)}`, "coin-dim");
        })
        .catch((error) => showToastMsg(errorMessage(error)))
        .finally(() => setGameBusy(false));
    },
    [bridge, gameConfig, pushPop, save, setSave, shOf, showToastMsg],
  );

  const placeEgg = useCallback(
    (eggId: string, slot: number) => {
      setGameBusy(true);
      bridge
        .placeEgg(eggId, slot)
        .then((next) => {
          setSave(next);
          showToastMsg(shOf().toast.hatchStart);
        })
        .catch((error) => showToastMsg(errorMessage(error)))
        .finally(() => setGameBusy(false));
    },
    [bridge, setSave, shOf, showToastMsg],
  );

  // #2 催蛋：点击孵化中的蛋 → 孵化时间 −1s。不设 busy（要能连点）。
  // 疯狂连点原本会卡在剩 2–3s：多个催蛋请求并发往返、回包乱序到达，旧回包把倒计时又顶回去。
  // 修法①：每颗蛋串行化催蛋请求（前一条 resolve 后再发下一条）→ 回包必然单调递减、绝不回弹。
  // 修法②：后端权威回包显示已到点（hatchAt ≤ now，同机同源时钟）时，直接收取 → 连点一路点到孵化。
  const pokeEgg = useCallback(
    (eggId: string) => {
      const prev = pokeChainRef.current.get(eggId) ?? Promise.resolve();
      const chain = prev
        .catch(() => undefined)
        .then(() => bridge.pokeEgg(eggId))
        .then((fresh) => {
          const freshEgg = fresh.eggs.find((e) => e.id === eggId);
          // 已被收取 → 不要用回包复活这颗蛋（乱序回包仍可能带着旧的它）。
          if (!freshEgg) return;
          // 仅同步这颗蛋的孵化时刻，其余字段以当前存档为准，避免连点抖动。
          setSave((cur) =>
            cur
              ? { ...cur, eggs: cur.eggs.map((e) => (e.id === eggId ? { ...e, hatchAt: freshEgg.hatchAt } : e)) }
              : fresh,
          );
          const now = Math.floor(Date.now() / 1000);
          if (
            freshEgg.slot != null &&
            freshEgg.hatchAt != null &&
            freshEgg.hatchAt <= now &&
            !autoCollectedRef.current.has(eggId)
          ) {
            autoCollectedRef.current.add(eggId); // 串行链里多条回包都会到点，只收一次。
            collectEgg(eggId);
          }
        })
        .catch(() => undefined);
      pokeChainRef.current.set(eggId, chain);
    },
    [bridge, collectEgg, setSave],
  );

  // 场景内点融合 → 打开融合仪式弹窗（CLI 预检 + 确认 + 掷骰配方/AI 生成）。fusionPair 状态已上移（#8）。
  const fusePets = useCallback(
    (idA: string, idB: string) => {
      if (!save) return;
      const a = save.pets.find((pet) => pet.id === idA);
      const b = save.pets.find((pet) => pet.id === idB);
      if (!a || !b) return;
      setFusionPair({ a, b });
    },
    [save],
  );

  const handleFusionCommitted = useCallback(
    (result: FusionStartResult) => {
      setSave(result.save);
      // 登记融合结果蛋 id：收取到它时即「融合领新宠」，据此引导开机自启（见 collectEgg）。
      rememberFusionEgg(result.eggId);
      const egg = result.save.eggs.find((item) => item.id === result.eggId) ?? null;
      const name =
        result.mode === "recipe"
          ? result.species
            ? speciesDisplayName(result.species, languageRef.current, gameConfig?.species[result.species]?.nameZh, gameConfig?.species[result.species]?.nameEn)
            : shOf().newSpeciesName
          : shOf().mysterySpeciesName;
      fireCelebration({
        phase: "fusionCommit",
        mode: result.mode,
        tier: egg?.tier ?? 1,
        name,
        species: result.species ?? null,
        slot: egg?.slot ?? null,
        parentTier: fusionPair?.a.tier ?? 1,
        parentA: fusionPair?.a.species ?? "",
        parentB: fusionPair?.b.species ?? "",
      });
      showToastMsg(result.mode === "recipe" ? shOf().toast.fusionRecipe : shOf().toast.fusionAi);
      setFusionPair(null); // 关闭确认弹窗，让场景庆典接手
    },
    [fireCelebration, fusionPair, gameConfig, setSave, shOf, showToastMsg],
  );

  useFusionProgress(bridge, showToastMsg);
  useAchievementUnlocks(bridge, showToastMsg, dispatchPetEvent);

  useDynamicQuotes(bridge);

  const steamStatus = useSteamStatus(bridge, setSave, showToastMsg);
  // 自定义物种设定图离屏渲染缓存（创意工坊缩略图；Tauri 专属 best-effort）。
  useSpeciesPreviews(bridge, gameConfig, save);

  const releasePet = useCallback(
    (petId: string) => {
      setGameBusy(true);
      bridge
        .releasePet(petId)
        .then((result) => {
          setSave(result.save);
          pushPop(`+${formatCount(result.refund)}`, "coin");
          showToastMsg(fmt(shOf().toast.released, { refund: formatCount(result.refund) }));
        })
        .catch((error) => showToastMsg(errorMessage(error)))
        .finally(() => setGameBusy(false));
    },
    [bridge, pushPop, setSave, shOf, showToastMsg],
  );

  const followPet = useCallback(
    (petId: string) => {
      setGameBusy(true);
      bridge
        .setActivePet(petId)
        .then((next) => {
          setSave(next);
          markSwitched(); // 教练 C5：切换过陪伴
          showToastMsg(shOf().toast.following);
        })
        .catch((error) => showToastMsg(errorMessage(error)))
        .finally(() => setGameBusy(false));
    },
    [bridge, markSwitched, setSave, shOf, showToastMsg],
  );

  const upgradeHatchery = useCallback(() => {
    setGameBusy(true);
    bridge
      .upgradeHatchery()
      .then((next) => {
        setSave(next);
        showToastMsg(shOf().toast.hatcheryUpgraded);
      })
      .catch((error) => showToastMsg(errorMessage(error)))
      .finally(() => setGameBusy(false));
  }, [bridge, setSave, shOf, showToastMsg]);

  const upgradeYard = useCallback(() => {
    setGameBusy(true);
    bridge
      .upgradeYard()
      .then((next) => {
        setSave(next);
        showToastMsg(shOf().toast.yardUpgraded);
      })
      .catch((error) => showToastMsg(errorMessage(error)))
      .finally(() => setGameBusy(false));
  }, [bridge, setSave, shOf, showToastMsg]);

  const upgradeShop = useCallback(() => {
    setGameBusy(true);
    bridge
      .upgradeShop()
      .then((next) => {
        setSave(next);
        showToastMsg(shOf().toast.shopUpgraded);
      })
      .catch((error) => showToastMsg(errorMessage(error)))
      .finally(() => setGameBusy(false));
  }, [bridge, setSave, shOf, showToastMsg]);

  // 后院交易所建筑入口：打开 Steam 交易市场（后续接入具体物品页）。
  const openSteamMarket = useCallback(() => {
    if (isTauri()) {
      void invoke("open_steam_market").catch(() => showToastMsg(shOf().toast.steamMarketFail));
      return;
    }
    window.open("https://steamcommunity.com/market/search?appid=4956830", "_blank", "noopener");
  }, [shOf, showToastMsg]);

  // 导入我的宠物：读整份 Steam 库存，未绑定宠物物品填后院空位（高阶优先）。
  // 存档更新经 game://state 回推；这里只负责即时提示 + 结果文案。
  const importSteamPets = useCallback(() => {
    const toast = shOf().toast;
    showToastMsg(toast.steamImporting);
    bridge
      .steamImportPets()
      .then(({ imported, skippedCapacity }) => {
        if (imported > 0 && skippedCapacity > 0) {
          showToastMsg(fmt(toast.steamImportDonePartial, { imported, skipped: skippedCapacity }));
        } else if (imported > 0) {
          showToastMsg(fmt(toast.steamImportDone, { imported }));
        } else if (skippedCapacity > 0) {
          showToastMsg(fmt(toast.steamImportFull, { skipped: skippedCapacity }));
        } else {
          showToastMsg(toast.steamImportNone);
        }
      })
      .catch((error) => showToastMsg(errorMessage(error)));
  }, [bridge, shOf, showToastMsg]);

  const debugFeed = useCallback(
    (amount: number) => {
      if (!bridge.debugFeedTokens) return;
      bridge
        .debugFeedTokens(amount)
        .then((result) => {
          setSave(result.save);
          if (result.outcome.expGained > 0) {
            // 调试投喂无真实 Agent：借 Claude 之名走完气泡的来源分支，便于预览验证。
            // 调试量按纯产出 token 记（四分里最有意义的一类）。
            enqueueFed(
              result.outcome.expGained,
              { ...EMPTY_BREAKDOWN, output: amount },
              "claudeCode",
              result.outcome.leveledUp,
            );
          } else {
            showToastMsg(shOf().toast.tokenMaxed);
          }
        })
        .catch(() => undefined);
    },
    [bridge, enqueueFed, setSave, shOf, showToastMsg],
  );

  const { tokenStats, statusText } = useCodexStatus(
    bridge,
    language,
    dispatchPetEvent,
    dispatchLocalEvent,
    enqueueFed,
    setSave,
  );

  // --- 键盘充能 / Token 经验表现层（InteractionEconomy §6.3）---
  // game://keys → 键帽雨（主窗口舞台；后院由场景层自播）；
  // game://stamina → 精力轻量补丁（键盘入账，只喂陪伴宠）+ 条脉冲 + 合并飘字；
  // game://exp → 经验轻量补丁（Token 喂养入账，改写陪伴宠 exp/level）。
  useEffect(() => {
    const disposeKeys = bridge.onKeyFx((event) => {
      markCeDone(); // 教练 CE：敲过键盘即视为学会键盘回精力（稳定 callback，无需入依赖）
      // 键盘玩法发现提示（一次性）：首批键帽到达时点破"打字=喂它"。
      try {
        if (!window.localStorage.getItem("gulugulu.keyDiscoverySeen")) {
          window.localStorage.setItem("gulugulu.keyDiscoverySeen", "1");
          showToastMsg(shOf().toast.keyDiscovery);
        }
      } catch {
        // localStorage 不可用时跳过提示
      }
      if (document.hidden) return;
      if (uiModeRef.current !== "pet" && uiModeRef.current !== "menu") return;
      spawnFlights(keycapFlightsFor(event.labels));
    });
    const disposePatch = bridge.onStaminaPatch((patch) => {
      setSave((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pets: prev.pets.map((pet) => {
            const gain = patch.perPet.find((item) => item.petId === pet.id);
            if (!gain) return pet;
            return {
              ...pet,
              stamina: gain.staminaAfter,
              exhausted: patch.wokePetIds.includes(pet.id) ? false : pet.exhausted,
            };
          }),
        };
      });
      const total = patch.perPet.reduce((sum, item) => sum + item.staminaGained, 0);
      if (total > 0) {
        setEnergyPulse((tick) => tick + 1);
        if (!document.hidden) {
          pushPop(`+${formatNumber(total)}`, "stamina");
        }
      }
    });
    // Token 喂养的经验入账：即时改写陪伴宠 exp/level（免拉全量存档；
    // 升级庆祝由 save 变化的 watchedLevel 管线自然触发）。
    const disposeExp = bridge.onExpPatch((patch) => {
      if (!patch.petId || patch.expGained <= 0) return;
      setSave((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pets: prev.pets.map((pet) =>
            pet.id === patch.petId ? { ...pet, level: patch.levelAfter, exp: patch.expAfter } : pet,
          ),
        };
      });
    });
    return () => {
      disposeKeys();
      disposePatch();
      disposeExp();
    };
  }, [bridge, pushPop, setSave, shOf, spawnFlights]);

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
    // 欢迎卡打开时，把窗口临时增高到能完整容纳整张卡——否则 280×320 小窗会把昨日战报
    // 拦腰截断成内部滚动条（还挤窄右列）。卡片是 position:fixed 覆盖层、铺满整窗，所以只需
    // 放大 OS 窗口即可显示全部内容；<main>/windowSize 不动，宠物不位移。关闭后 welcomeOffline→
    // null，依赖变化让本 effect 重跑、自动恢复到当前模式尺寸。未测得高度前先保持模式高（只涨不缩）。
    let height = windowSize.h;
    if (welcomeOffline != null && welcomeCardHeight != null) {
      height = Math.min(
        Math.max(windowSize.h, welcomeCardHeight + WELCOME_WINDOW_PAD),
        WELCOME_WINDOW_MAX_H,
      );
    }
    // 恢复置顶 + 固定尺寸在 resize_game_window（Rust）内完成。
    void bridge.resizeWindow(windowSize.w, height).catch(() => undefined);
  }, [bridge, uiMode, windowSize.h, windowSize.w, welcomeOffline, welcomeCardHeight]);

  // 一次性状态到期归位。working/thinking 是 Agent 活跃期基线，不在此表——它们由
  // 下方专用锁存超时收束；其余瞬时态演完走 settleAfterOneShot（活跃→基线，否则 idle）。
  useEffect(() => {
    if (
      petState === "idle" ||
      petState === "sleeping" ||
      petState === "exhausted" ||
      petState === "dragging" ||
      petState === "error" ||
      petState === "working" ||
      petState === "thinking"
    ) {
      return;
    }

    const duration = transientStateDurationMs[petState] ?? 5000;
    const timer = window.setTimeout(() => settleAfterOneShot(), duration);
    return () => window.clearTimeout(timer);
  }, [lastEventAt, petState, settleAfterOneShot]);

  // Agent 活跃锁存超时：working/thinking 期间，最后一条 Agent 事件后经过活跃窗仍
  // 无新事件 → 收回 idle（进而恢复 60s 睡眠 / 18s 漫游）。事件不断刷新 lastEventAt
  // 会重跑本 effect，把回落 idle 推迟到真正静默之后。
  useEffect(() => {
    if (petState !== "working" && petState !== "thinking") return;
    const remaining = agentActiveUntilRef.current - Date.now();
    if (remaining <= 0) {
      dispatchLocalEvent("pet_idle");
      return;
    }
    const timer = window.setTimeout(() => dispatchLocalEvent("pet_idle"), remaining);
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
      // 10% 唤醒瞬间（InteractionEconomy §6.4）：伸懒腰 + ❗台词。
      dispatchLocalEvent("pet_wake");
      setWaking(true);
      window.setTimeout(() => setWaking(false), 950);
      showToastMsg(shOf().toast.wokeUp);
    }
  }, [activePet, dispatchLocalEvent, petState, shOf, showToastMsg]);

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
          const name = speciesDisplayName(
            pet.species,
            languageRef.current,
            gameConfig.species[pet.species]?.nameZh,
            gameConfig.species[pet.species]?.nameEn,
          );
          showToastMsg(fmt(shOf().toast.yardPetMaxed, { name }));
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
        pushPop(shOf().pop.maxLevel, "levelmax");
        spawnReactionBurst();
        triggerFinisher();
        setSpeechLine(shOf().speech.maxLevelFuse);
        setSpeechVisible(true);
      } else {
        pushPop("Lv UP!", "levelup");
      }
    }
    watchedLevelRef.current = { id: active.id, level: active.level };
  }, [save, gameConfig, pushPop, shOf, showToastMsg, spawnReactionBurst, triggerFinisher]);

  // Autonomous wandering (only while the plain pet is showing)。纯散步——
  // 2026-07-21 机制修订：漫游不再有任何拾取/回复（原漫游零食已移除）。
  // 孵化中的蛋（没有主宠）钉在原地，不做随机漫游（§3）。
  // 随机移动可在设置/托盘里关闭（默认开）；关闭时角色不再在桌面上自主走动。
  const randomMovementEnabled = appSettings?.randomMovement ?? true;
  useEffect(() => {
    if (
      petState !== "idle" ||
      uiMode !== "pet" ||
      !hasActivePet ||
      !randomMovementEnabled ||
      autonomousMovePlayedRef.current
    )
      return;

    const timer = window.setTimeout(() => {
      if (stateRef.current !== "idle" || uiModeRef.current !== "pet" || autonomousMovePlayedRef.current) return;

      autonomousMovePlayedRef.current = true;
      dispatchLocalEvent("pet_move_start");
      dispatchLocalEvent("pet_move");

      if (!isTauri()) {
        window.setTimeout(() => {
          dispatchLocalEvent("pet_move_stop");
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
        });
    }, AUTONOMOUS_MOVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    bridge,
    dispatchLocalEvent,
    hasActivePet,
    lastEventAt,
    petState,
    pushPop,
    randomMovementEnabled,
    setSave,
    uiMode,
  ]);

  const handleAnimationComplete = useCallback(() => {
    if (stateRef.current === "fed") {
      if (fedFailsafeRef.current !== null) {
        window.clearTimeout(fedFailsafeRef.current);
        fedFailsafeRef.current = null;
      }
      playingFedRef.current = false;
      setSceneFed(null);
      settleAfterOneShot();
      window.setTimeout(startNextFedIfReady, 0);
      return;
    }

    if (
      stateRef.current === "laboring" ||
      stateRef.current === "drag_start" ||
      stateRef.current === "drop" ||
      stateRef.current === "success"
    ) {
      settleAfterOneShot();
    }
  }, [settleAfterOneShot, startNextFedIfReady]);

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
      // #2 点击孵化中的蛋 → 每点 −1s（催蛋）；播一次点击反馈。不再借此开菜单。
      dispatchLocalEvent("user_click");
      pokeEgg(stageEgg.id);
      return;
    }

    if (uiMode === "pet") {
      // SVG 舞台：点击反馈走叠加层，不打断当前动画。
      if (activePet) triggerPetReaction();
      openMenu();
      return;
    }

    if (uiMode === "menu" && activePet) {
      // 打工连点只要点击反馈，不换台词（气泡留给引导/收益提示）。
      triggerPetReaction(false);
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

  const copy = t(language);

  const visibleTutorialHint = useTutorialHints(save, gameConfig, uiMode, advanceTutorial, {
    hatcheryReady,
    steamEnabled: steamStatus != null,
    suppressed: coach.active, // 强引导期间轻引导气泡让位（复用同一气泡）
    lang: language,
  });

  // 后院红点：能买第二颗蛋 / 有蛋可收取 / 可融合（两只同阶满级凑齐）。
  // 孵化屋已满时不为"买蛋"亮红点——蛋只能进库存孵不了（收蛋/融合红点另算）。
  const shopBadge =
    save != null &&
    gameConfig != null &&
    save.pets.length < 2 &&
    save.coins >= Math.min(...Object.values(gameConfig.eggPrices)) &&
    !hatcheryFull(gameConfig, save);
  const hatcheryBadge = hatcheryReady;
  // 融合红点：只看当前陪伴宠能否**立刻**融合（同阶满级搭档 + 金币够费），见 activePetCanFuse。
  const fusionBadge = save != null && gameConfig != null && activePetCanFuse(gameConfig, save);
  const backyardBadge = shopBadge || hatcheryBadge || fusionBadge;

  // 进后院时主角用一句幽默话点题「该干嘛」（含去找谁融合）。优先级低于新手引导：
  // 引导激活时交由 coachLabel 代言，这里给 null（BackyardScene 只在进场评估一次）。
  const entryGuideKind: "fuse" | "collectEgg" | "buyEgg" | null = coach.active
    ? null
    : fusionBadge
      ? "fuse"
      : hatcheryBadge
        ? "collectEgg"
        : shopBadge
          ? "buyEgg"
          : null;

  const showStage = uiMode === "pet" || uiMode === "menu";
  const gameReady = save != null && gameConfig != null;

  // —— 提示统一走对话气泡（§1/§2/§7）——
  // 主界面（pet/menu）上，状态提示（原 toast）> 新手/薪水引导 > 随机台词共用一个
  // 气泡区，互不叠加；浮动 pill 只保留给没有气泡区的界面（后院/调试）。
  const stageToast = showStage ? toast : null;
  const stageHint = showStage ? visibleTutorialHint : null;
  // 教练引导文字复用同一气泡（OnboardingCoach.md §5）：toast > 教练 > 轻引导 > 台词。
  const stageCoach = showStage ? coach.directive?.label ?? null : null;
  const bubbleText = stageToast?.text ?? stageCoach ?? stageHint?.text ?? (speechVisible ? speechLine : null);
  const bubbleIsHint = stageToast == null && (stageCoach != null || stageHint != null);
  if (bubbleText != null) lastBubbleTextRef.current = bubbleText;

  useEffect(() => {
    bubbleBusyRef.current = stageToast != null || stageHint != null || stageCoach != null;
    // 引导/状态提示接管气泡时丢弃待播的随机台词，避免提示结束后旧台词突然冒出。
    if (bubbleBusyRef.current) setSpeechVisible(false);
  }, [stageToast, stageHint, stageCoach]);

  const handleShellPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && uiMode !== "pet") {
      goBack();
    }
  };

  return (
    // 语言上下文根：App 持有 language 状态，全部 uiMode 渲染路径（舞台/菜单/后院/
    // 设置/调试/浮层）都在 Provider 内，任意深度组件可用 useT() 取词。
    <LanguageContext.Provider value={language}>
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
        <SpeechBubble
          speechRef={speechRef}
          bubbleText={bubbleText}
          bubbleIsHint={bubbleIsHint}
          speechDrop={speechDrop}
          stageElements={stageElements}
          lastBubbleTextRef={lastBubbleTextRef}
        />
      )}

      {/* 新手强引导手势层（全窗口固定覆盖、非阻塞）+ 跳过入口 */}
      <CoachFx directive={coach.directive} />
      {coach.active && (
        <button type="button" className="coach-skip" onClick={markDone}>
          {copy.sh.coach.skip}
        </button>
      )}

      {/* 连击累计读数（点击游戏爽快感）：置于对话气泡上方的窗口顶部，
          避开宠物身上的打工粒子/飞金特效，不再与它们叠加。 */}
      {showStage && comboView && (
        <div
          className={`combo-pop ${comboView.flip % 2 === 0 ? "combo-pop-a" : "combo-pop-b"}`}
          style={{ "--combo-scale": `${1 + Math.min(comboView.count, 20) * 0.025}` } as CSSProperties}
          aria-hidden="true"
        >
          {comboView.count > 1 && (
            <span className="combo-count">{fmt(copy.sh.pop.combo, { n: comboView.count })}</span>
          )}
          <span className="combo-line">🪙 +{formatCount(comboView.coins)}</span>
          {comboView.exp > 0 && (
            <span className="combo-line combo-exp">✨ +{formatCount(comboView.exp)}</span>
          )}
        </div>
      )}

      {showStage ? (
        <PetStage
          flights={flights}
          removeFlight={removeFlight}
          pops={pops}
          stageRef={stageRef}
          duckFacingRef={duckFacingRef}
          finisherClass={finisherClass}
          handlePointerCancel={handlePointerCancel}
          handlePointerDown={handlePointerDown}
          handlePointerMove={handlePointerMove}
          handlePointerUp={handlePointerUp}
          gameReady={gameReady}
          activePet={activePet}
          stageEgg={stageEgg}
          gameConfig={gameConfig}
          stageNow={stageNow}
          isSvgStage={isSvgStage}
          reactionPulseClass={reactionPulseClass}
          waking={waking}
          petState={(previewPetState() as PetState | null) ?? petState}
          reactionBursts={reactionBursts}
          reactionColor={reactionColor}
          workBursts={workBursts}
        />
      ) : uiMode === "backyard" ? (
        gameReady && (
          <BackyardScene
            save={save}
            config={gameConfig}
            busy={gameBusy}
            statusText={statusText}
            tokenStats={tokenStats}
            petState={petState}
            fedPulse={sceneFed}
            celebration={celebration}
            speechLine={speechLine}
            speechVisible={speechVisible}
            toast={toast}
            steamStatus={steamStatus}
            onOpenMarket={openSteamMarket}
            onSteamSync={() => {
              bridge.steamSyncNow().catch((error) => showToastMsg(errorMessage(error)));
              showToastMsg(copy.sh.toast.steamSyncing);
            }}
            onImportPets={importSteamPets}
            onWalkingChange={handleSceneWalking}
            onBack={goBack}
            onWorkPet={workOn}
            emitWorkBurst={emitWorkBurstAtRect}
            emitCelebration={emitCelebration}
            emitYardFx={emitYardFx}
            onCollectEgg={collectEgg}
            onPokeEgg={pokeEgg}
            onPlaceEgg={placeEgg}
            onBuyEgg={buyEgg}
            onUpgradeHatchery={upgradeHatchery}
            onUpgradeYard={upgradeYard}
            onUpgradeShop={upgradeShop}
            onFuse={fusePets}
            onFollow={followPet}
            onRelease={releasePet}
            onToast={showToastMsg}
            coachLabel={coach.directive?.label ?? null}
            entryGuideKind={entryGuideKind}
            onCoachMoved={markMoved}
            onCoachYard={setYardCoach}
          />
        )
      ) : uiMode === "settings" ? (
        gameReady && (
          <SettingsPanel
            copy={copy}
            language={language}
            appSettings={appSettings}
            goBack={goBack}
            changeLanguage={changeLanguage}
            handleAlwaysOnTop={handleAlwaysOnTop}
            handleKeyboardCapture={handleKeyboardCapture}
            handleRandomMovement={handleRandomMovement}
            handleAutostart={handleAutostart}
            selectPanel={selectPanel}
            closePet={closePet}
          />
        )
      ) : (
        gameReady && (
          <PanelShell title={copy.debug} backLabel={copy.back} onBack={goBack}>
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
          language={language}
          onSelect={selectPanel}
          onPetAvatarClick={() => setUiMode("menu")}
          backyardBadge={backyardBadge}
          energyPulse={energyPulse}
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

      <Overlays
        showStage={showStage}
        visibleTutorialHint={visibleTutorialHint}
        toast={toast}
        uiMode={uiMode}
        activePet={activePet}
        fusionPair={fusionPair}
        gameConfig={gameConfig}
        bridge={bridge}
        setFusionPair={setFusionPair}
        handleFusionCommitted={handleFusionCommitted}
        welcomeOffline={welcomeOffline}
        save={save}
        setWelcomeOffline={setWelcomeOffline}
        onWelcomeMeasure={setWelcomeCardHeight}
        autostartPromptOpen={autostartPromptOpen}
        onAutostartAccept={acceptAutostart}
        onAutostartDecline={declineAutostart}
      />

    </main>
    </LanguageContext.Provider>
  );
}
