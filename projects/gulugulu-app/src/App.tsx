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
} from "./types";
import { isTauri } from "./tauri";
import { type Language, t } from "./i18n";
import { useGame } from "./game/useGame";
import {
  MenuBar,
  PanelShell,
  WINDOW_SIZES,
  type UiMode,
} from "./game/GamePanels";
import { BackyardScene } from "./game/BackyardScene";
import { DebugPanel } from "./game/DebugPanel";
import { eggPriceFor, isMaxLevel } from "./game/config";
import { formatCount } from "./game/format";
import { foodFlightFor, keycapFlightsFor, useFlights } from "./game/FlightLayer";
import { foodLevelForTokens } from "./sprites/parts/glyphs";
import { fusionReady } from "./game/tutorial";
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
import { useFxOverlay } from "./app/hooks/useFxOverlay";
import { usePetStateMachine } from "./app/hooks/usePetStateMachine";
import { useSpeechDrop } from "./app/hooks/useSpeechDrop";
import { useSteamStatus } from "./app/hooks/useSteamStatus";
import { useTutorialHints } from "./app/hooks/useTutorialHints";
import { useWelcomeBack } from "./app/hooks/useWelcomeBack";

const DRAG_THRESHOLD_PX = 4;
const AUTONOMOUS_MOVE_DELAY_MS = 18_000;
const TOAST_VISIBLE_MS = 2600;
/** 菜单（后院/调试按钮）无操作自动收起，回到纯角色状态 */
const MENU_IDLE_HIDE_MS = 8000;
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

/** 待播的进食演出：v1.1 起 Token 只回精力（InteractionEconomy §3.3）。
 *  tokens 用于按量给食物分级（越多的 token = 越大的一餐）。 */
type PendingFed = {
  id: number;
  stamina: number;
  tokens: number;
  /** 产出这些 token 的 Agent（"codex" | "claudeCode"；调试投喂为 ""）——气泡报来源用。 */
  source: string;
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
  const autonomousMovePlayedRef = useRef(false);
  const quoteDecksRef = useRef(createQuoteDecks());

  // --- game state ---
  const { bridge, config: gameConfig, save, setSave } = useGame();
  const [uiMode, setUiMode] = useState<UiMode>("pet");
  const uiModeRef = useRef<UiMode>("pet");
  const [gameBusy, setGameBusy] = useState(false);
  const [fusionFlash, setFusionFlash] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const toastIdRef = useRef(0);
  const [welcomeOffline, setWelcomeOffline] = useWelcomeBack();
  // 后院场景状态回传：主角行走中则暂缓进食动画；fedPulse 交给场景播放。
  const [sceneWalking, setSceneWalking] = useState(false);
  const sceneWalkingRef = useRef(false);
  // 后院进食演出：stamina 决定 +N 精力飘字，level 决定食物体型。
  const [sceneFed, setSceneFed] = useState<{ id: number; stamina: number; level: number } | null>(null);

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
  // SVG rig 是唯一舞台：有主宠即渲染 SVG 精灵（PNG 自定义头像方案已下线）。
  const isSvgStage = activePet != null;
  // 点击反馈爆发粒子的颜色跟随主属性元素色
  const reactionColor =
    (gameConfig &&
      activePet &&
      gameConfig.elements[gameConfig.species[activePet.species]?.elements?.[0] ?? "normal"]?.color) ||
    "#F5917B";

  // 气泡左上角装饰位：当前角色的属性（元素）图标，有几个显示几个。无主宠（蛋）时为空。
  const stageElements = useMemo<Array<{ id: string; badge: string; color: string; nameZh: string }>>(() => {
    if (!gameConfig || !activePet) return [];
    const species = gameConfig.species[activePet.species];
    if (!species) return [];
    return species.elements.flatMap((id) => {
      const info = gameConfig.elements[id];
      return info ? [{ id, badge: info.badge, color: info.color, nameZh: info.nameZh }] : [];
    });
  }, [gameConfig, activePet]);

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
  // 汇聚飞行（键帽雨 / Token 餐）与精力条获得脉冲（InteractionEconomy §6.1/§6.3）。
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
        showToastMsg(staminaRecoveryText(activePet.stamina, gameConfig?.wakeThreshold));
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
  const { duckFacingRef, ensureFxOverlay, hideFxOverlay, spawnWorkBurst, workBursts } = useFxOverlay(
    uiMode,
    activePetSpecies,
  );
  const { speechDrop, speechRef } = useSpeechDrop(uiMode, activePetSpecies, duckFacingRef);

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

  const { appSettings, handleAlwaysOnTop, handleKeyboardCapture, handleRandomMovement } = useAppSettings(
    bridge,
    applyLanguage,
    languageRef,
  );

  const enqueueFed = useCallback((stamina: number, tokens: number, source: string) => {
    const id = pendingFedIdRef.current + 1;
    pendingFedIdRef.current = id;
    setPendingFedQueue((items) => [...items, { id, stamina, tokens, source }]);
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

    // 合餐（InteractionEconomy §6.3）：把队列里全部待播项合成一餐播放。
    const merged = pendingFedQueue.reduce((sum, item) => sum + item.stamina, 0);
    const mergedTokens = pendingFedQueue.reduce((sum, item) => sum + item.tokens, 0);
    const mealId = pendingFedQueue[pendingFedQueue.length - 1].id;
    // 合餐的来源报最近一次 token 事件的 Agent（连续投喂几乎总是同源）。
    const mealSource = pendingFedQueue[pendingFedQueue.length - 1].source;
    const foodLevel = foodLevelForTokens(mergedTokens);
    playingFedRef.current = true;
    setPendingFedQueue([]);

    // 能量饭团从远处慢慢飘来（~1.9s）：主窗口直接放飞行层，后院把 level
    // 交给场景层放飞行（BackyardScene 自订阅）。
    if (mode === "backyard") {
      setSceneFed({ id: mealId, stamina: merged, level: foodLevel });
    } else if (merged > 0) {
      spawnFlights([foodFlightFor(foodLevel)]);
    }

    // 精力真的回了一点才冒气泡（fedStamina>0 已在事件层保证）：首餐给一次性
    // 玩法发现提示，之后每餐报「吃到 <Agent> 的 X Token，精力恢复！」。
    if (merged > 0) {
      let firstMeal = false;
      try {
        if (!window.localStorage.getItem("gulugulu.tokenEnergySeen")) {
          window.localStorage.setItem("gulugulu.tokenEnergySeen", "1");
          firstMeal = true;
        }
      } catch {
        // localStorage 不可用时按非首餐处理
      }
      showToastMsg(
        firstMeal
          ? "Agent 干活的 Token 现在是我的能量饭团🍙 精力回满就能继续点我打工"
          : tokenMealText(mealSource, mergedTokens, languageRef.current),
      );
    }

    // 食物飞到嘴边（~1.65s）才开吃：夸张咀嚼 + 精力飘字 + 条脉冲，与食物
    // "缩小消失"衔接。让整段 Token 回复动画慢下来、看得清（总时长 ~3s）。
    const chew = () => {
      if (mode !== "backyard" && merged > 0) pushPop(`+${formatNumber(merged)}`, "stamina");
      if (merged > 0) setEnergyPulse((tick) => tick + 1);
      dispatchPetEvent(makePetEvent("agent_token_gain"));
    };
    if (merged > 0) window.setTimeout(chew, FOOD_ARRIVE_MS);
    else chew();
  }, [dispatchPetEvent, pendingFedQueue, pushPop, showToastMsg, spawnFlights]);

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
              showToastMsg("今天的爱已点满💛 现在点我都是纯摸摸");
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
          if (save.tutorialStep === 2) advanceTutorial(3);

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
                  ? "过半啦！"
                  : clicksIntoBar === milestone * 3
                    ? "最后冲刺！"
                    : `${clicksIntoBar} 击！`;
              pushPop(label, "levelup", at);
              if (isActive) spawnWorkBurst(14, true);
            }
            if (result.becameExhausted) {
              // 大终结技 + 收工结算横幅：「满工收工！本管 🪙+N ✨+N」。
              showToastMsg(
                `满工收工！本管 🪙+${formatNumber(totals.coins)} ✨+${formatNumber(totals.exp)}`,
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
              showToastMsg("今天的爱点满啦！剩下的明天继续💛");
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
            showToastMsg(staminaRecoveryText(pet?.stamina, gameConfig?.wakeThreshold));
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
          const name = egg ? gameConfig.species[egg.species]?.nameZh ?? egg.species : "精灵";
          if (egg?.pendingFusion && egg.pendingFusion.status === "resolved") {
            // AI 融合揭晓时刻：全新物种诞生
            setFusionFlash(true);
            window.setTimeout(() => setFusionFlash(false), 900);
            showToastMsg(`🎉 全新物种「${name}」诞生了！`);
          } else if (egg?.pendingFusion) {
            showToastMsg("融合能量不稳定，孵出了一只咕噜鸭…");
          } else {
            showToastMsg(`${name} 破壳而出！`);
          }
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
    (element: string, tier: number) => {
      if (!save) return;
      setGameBusy(true);
      bridge
        .buyEgg(element, tier)
        .then((next) => {
          setSave(next);
          const latest = next.eggs[next.eggs.length - 1];
          showToastMsg(latest?.slot != null ? "蛋已放进孵化槽" : "孵化槽已满，蛋放进了库存");
          pushPop(`-${formatNumber(gameConfig ? eggPriceFor(gameConfig, element, tier) : 0)}`, "coin-dim");
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

  // 场景内点融合 → 打开融合仪式弹窗（CLI 预检 + 确认 + 掷骰配方/AI 生成）。
  const [fusionPair, setFusionPair] = useState<{ a: PetInstance; b: PetInstance } | null>(null);

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
      setFusionFlash(true);
      window.setTimeout(() => setFusionFlash(false), 900);
      setSave(result.save);
      showToastMsg(
        result.mode === "recipe" ? "触发经典配方！高阶蛋已放进孵化区" : "✨ AI 开始设计新物种，神秘蛋已入孵化区",
      );
    },
    [setSave, showToastMsg],
  );

  useFusionProgress(bridge, showToastMsg);

  useDynamicQuotes(bridge);

  const steamStatus = useSteamStatus(bridge, setSave, showToastMsg);

  const releasePet = useCallback(
    (petId: string) => {
      setGameBusy(true);
      bridge
        .releasePet(petId)
        .then((result) => {
          setSave(result.save);
          pushPop(`+${formatCount(result.refund)}`, "coin");
          showToastMsg(`已放生，返还 ${formatCount(result.refund)} 金币`);
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

  const upgradeShop = useCallback(() => {
    setGameBusy(true);
    bridge
      .upgradeShop()
      .then((next) => {
        setSave(next);
        showToastMsg("商店升级成功！解锁了更高阶的蛋");
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
          if (result.outcome.staminaFed > 0) {
            // 调试投喂无真实 Agent：借 Claude 之名走完气泡的来源分支，便于预览验证。
            enqueueFed(result.outcome.staminaFed, amount, "claudeCode");
          } else {
            showToastMsg("精力已经满满的啦");
          }
        })
        .catch(() => undefined);
    },
    [bridge, enqueueFed, setSave, showToastMsg],
  );

  const { projectTokens, statusText } = useCodexStatus(
    bridge,
    language,
    dispatchPetEvent,
    dispatchLocalEvent,
    enqueueFed,
    setSave,
  );

  // --- 键盘充能表现层（InteractionEconomy §6.3）---
  // game://keys → 键帽雨（主窗口舞台；后院由场景层自播）；
  // game://stamina → 精力轻量补丁（免拉全量存档）+ 条脉冲 + 合并飘字。
  useEffect(() => {
    const disposeKeys = bridge.onKeyFx((event) => {
      // 键盘玩法发现提示（一次性）：首批键帽到达时点破"打字=喂它"。
      try {
        if (!window.localStorage.getItem("gulugulu.keyDiscoverySeen")) {
          window.localStorage.setItem("gulugulu.keyDiscoverySeen", "1");
          showToastMsg("发现了吗？你敲的每个键我都接住吃掉啦——打字就是在喂我⚡");
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
        if (!document.hidden && patch.source === "keys") {
          pushPop(`+${formatNumber(total)}`, "stamina");
        }
      }
    });
    return () => {
      disposeKeys();
      disposePatch();
    };
  }, [bridge, pushPop, setSave, spawnFlights]);

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
      showToastMsg("睡饱啦！精力回上来了⚡");
    }
  }, [activePet, dispatchLocalEvent, petState, showToastMsg]);

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

      const pickup = () => {
        // 漫游零食（v1.1）：捡到的是能量零食，回精力不给金币。
        bridge
          .wanderSnack()
          .then((result) => {
            setSave(result.save);
            if (result.staminaGained > 0) {
              pushPop(`+${result.staminaGained}`, "stamina");
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
      if (uiMode === "pet") {
        dispatchLocalEvent("user_click");
        openMenu();
      }
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

  const visibleTutorialHint = useTutorialHints(save, gameConfig, uiMode, advanceTutorial);

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
        <SpeechBubble
          speechRef={speechRef}
          bubbleText={bubbleText}
          bubbleIsHint={bubbleIsHint}
          speechDrop={speechDrop}
          stageElements={stageElements}
          lastBubbleTextRef={lastBubbleTextRef}
        />
      )}

      {showStage ? (
        <PetStage
          flights={flights}
          removeFlight={removeFlight}
          pops={pops}
          comboView={comboView}
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
          petState={petState}
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
            projectTokens={projectTokens}
            petState={petState}
            fedPulse={sceneFed}
            speechLine={speechLine}
            speechVisible={speechVisible}
            toast={toast}
            steamStatus={steamStatus}
            onOpenMarket={openSteamMarket}
            onSteamSync={() => {
              bridge.steamSyncNow().catch((error) => showToastMsg(errorMessage(error)));
              showToastMsg("正在与 Steam 同步…");
            }}
            onWalkingChange={handleSceneWalking}
            onBack={goBack}
            onWorkPet={workOn}
            onCollectEgg={collectEgg}
            onPlaceEgg={placeEgg}
            onBuyEgg={buyEgg}
            onUpgradeHatchery={upgradeHatchery}
            onUpgradeYard={upgradeYard}
            onUpgradeShop={upgradeShop}
            onFuse={fusePets}
            onFollow={followPet}
            onRelease={releasePet}
            onToast={showToastMsg}
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
        fusionFlash={fusionFlash}
        fusionPair={fusionPair}
        gameConfig={gameConfig}
        bridge={bridge}
        setFusionPair={setFusionPair}
        handleFusionCommitted={handleFusionCommitted}
        welcomeOffline={welcomeOffline}
        save={save}
        setWelcomeOffline={setWelcomeOffline}
      />

    </main>
  );
}
