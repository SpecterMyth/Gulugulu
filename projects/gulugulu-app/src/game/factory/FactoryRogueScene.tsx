// 《危楼打工记》组合根:局流程(桌图+选人 → 班次 → 商店 → 结算)。
// - loadout 确认后才 new RogueRun(逻辑层引擎,P1 交付);UI 全程只经 RogueRunApi。
// - useSyncExternalStore 订阅 run.view()(引用每次变更换新);
// - 组桥对象把 RogueRunApi 转接成 FactoryScene 的 RogueSceneBridge(deskOrder 用
//   view.deskOrder,搬桌换新引用 → 场景重排+重算支撑)。P3 桥接线:timeScale
//   (hit-stop 慢镜)与 deskWiden(首班教学宽桌)转入场景;罢工/解雇/弹开事件
//   在桥上截流一份给演出层(离场宠的位置在移除前抓取)。
// - 250ms tick 驱动检查日/破产复查;200ms 泵 takePulses() 驱动演出:
//   P2 基线(五档浮字 ≤6 并发溢出合并 + 接桌高亮 0.6s + 💢 同种标记)之上,
//   P3 结算链完整版走 RoguePulseFx(吸取波/通路流光/金币喷泉/jackpot 定格)、
//   横幅仪式走 RogueBanners(下班铃/检查日公告/里程碑/教学气泡)、
//   屏幕微震(.fr-stage-shake)/punch(.fr-scene-punch)只动本组件自己的容器。
// - 破产:场景包壳去饱和(dayNight 的 filter 思路,不加黑幕)+「查封」封条,
//   结算板随后升起;?frdebug=1 挂 window.__frRun / __frFx 调试句柄。
// 状态不进 Rust 存档;战绩持久化在逻辑层(localStorage),UI 只展示 records()。

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import type {
  FactoryLeaderboardStatus,
  FactoryRogueAchievementSnapshot,
  GameConfig,
  GameSave,
} from "../../types";
import { useT } from "../../useT";
import { FactoryScene } from "../FactoryScene";
import { getGameBridge } from "../bridge";
import { formatCount } from "../format";
import { fmt } from "../../i18n";
import { elementName } from "../../i18n/species";
import { FACTORY_ROGUE } from "../../i18n/factoryRogue";
import {
  FACTORY_COIN_REWARD_CAP,
  PULSE_TIERS,
  factoryValueString,
  hasWindRule,
  shuffleDeskOrder,
  type CardId,
} from "./rogueConfig";
import { pulseSpotlightUids } from "./roguePulse";
import { clearRunSnapshot, loadRunSnapshot, RogueRun, saveRunSnapshot } from "./rogueRun";
import { buildSpeciesMeta } from "./rogueSpecies";
import {
  FactoryFirstRunGuide,
  factoryLoadoutGuide,
  factoryResumeGuide,
  factoryRunGuide,
  factoryStrikeWarningGuide,
} from "./FactoryFirstRunGuide";
import type {
  BodyLike,
  DeskLike,
  RogueElement,
  RogueRunSnapshot,
  RogueSceneBridge,
} from "./rogueTypes";
import { RogueBanners } from "./ui/RogueBanners";
import { RogueHud } from "./ui/RogueHud";
import { RogueHiring } from "./ui/RogueHiring";
import { RogueLoadout } from "./ui/RogueLoadout";
import { RoguePulseFx, type RoguePulseFxApi } from "./ui/RoguePulseFx";
import { RogueShop } from "./ui/RogueShop";
import { RogueSettlement } from "./ui/RogueSettlement";
import { RogueSummary } from "./ui/RogueSummary";
import { RogueCardIcon } from "./ui/RogueCardIcon";
import { FactoryLeaderboard } from "./ui/FactoryLeaderboard";
import { encodeLeaderboardLoadout } from "./leaderboardSpecies";
import "./rogue.css";

const PULSE_PUMP_MS = 200; // 演出泵间隔(04 §8:浮字对象池 ≤6 并发,多余合并)
const PASSIVE_SCENE_AUDIT_MS = 500; // 无脉冲时只需低频同步标记/常驻身体状态
const TICK_MS = 250; // 逻辑滴答(契约:检查日滴入/扣精/风向翻转/破产复查)
const RUN_SNAPSHOT_MIN_INTERVAL_MS = 2000;
const RUN_SNAPSHOT_IDLE_TIMEOUT_MS = 750;
const FLOAT_MS = 900; // 单条浮字生命周期(与 rogue.css fr-float-rise 同拍)
const FLOAT_MAX = 20; // 同屏主浮字上限；连续追加计分通过队列逐条进入，不会被此上限吞掉
const PART_FLOAT_MAX = 5; // 每次结算额外允许的「各宠自身数值」横向浮字条数
const DESK_HOT_MS = 600; // 接桌高亮时长
const FX_CHAINS_MAX = 3; // 单泵批次里跑完整结算链的脉冲上限(其余只保浮字)
const GONE_POS_TTL_MS = 4000; // 离场宠位置缓存时长(抗议浮字/爆破定位)
const STRIKE_CHAIN_WINDOW_MS = 6000; // 连锁罢工判定窗口(边缘红闪强度递增)
/** 写进 Steam 排行榜 details[3]；改平衡到不可比时必须递增。 */
const FACTORY_BALANCE_VERSION = 3;
const FACTORY_STRIKE_WARNING_KEY = "gulugulu.factory.strike-warning.v1";
const FACTORY_REWARD_FX_MS = 2100;
const FACTORY_MATERIAL_ICONS: Record<string, string> = {
  ironBadge: "🔩", copperGoggles: "🥽", silverHelmet: "⛑️",
  goldWrench: "🔧", platinumVest: "🦺", goldenBadge: "🎟️",
};
type FactoryRewardFx = { id: number; material: string; count: number };

function strikeWarningWasAcknowledged(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FACTORY_STRIKE_WARNING_KEY) === "acknowledged";
  } catch {
    return false;
  }
}

function rememberStrikeWarning(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FACTORY_STRIKE_WARNING_KEY, "acknowledged");
  } catch {
    // 存储不可用时仍允许继续；本次运行由 ref 防止重复。
  }
}

/** 大风日全屏演出。风线和飞屑共用逻辑层的瞬时方向，翻向时整层同步反转。 */
export function FactoryWindFx({ direction }: { direction: "left" | "right" }) {
  return (
    <div className={`fr-wind-fx is-${direction}`} aria-hidden="true">
      {Array.from({ length: 18 }, (_, index) => (
        <i
          key={`gust-${index}`}
          className="fr-wind-gust"
          style={
            {
              "--fr-wind-y": `${3 + ((index * 53) % 92)}%`,
              "--fr-wind-w": `${18 + ((index * 17) % 30)}vw`,
              "--fr-wind-delay": `${-((index * 0.31) % 2.8)}s`,
              "--fr-wind-duration": `${1.25 + ((index * 13) % 9) * 0.08}s`,
              "--fr-wind-lift": `${-18 + ((index * 11) % 37)}px`,
            } as CSSProperties
          }
        />
      ))}
      {Array.from({ length: 12 }, (_, index) => (
        <b
          key={`debris-${index}`}
          className="fr-wind-debris"
          style={
            {
              "--fr-wind-y": `${8 + ((index * 71) % 82)}%`,
              "--fr-wind-delay": `${-((index * 0.47) % 3.2)}s`,
              "--fr-wind-duration": `${1.65 + ((index * 19) % 8) * 0.12}s`,
              "--fr-wind-lift": `${-42 + ((index * 23) % 85)}px`,
              "--fr-wind-spin": `${180 + ((index * 79) % 420)}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function captureSeed(): number | null {
  if (typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search);
  if (query.get("frdebug") !== "1") return null;
  const raw = Number(query.get("frseed"));
  return Number.isFinite(raw) ? (raw >>> 0) : null;
}

function seededRandom(seed: number): () => number {
  let state = seed || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function initialDeskOrder(): RogueElement[] {
  const seed = captureSeed();
  return shuffleDeskOrder(seed == null ? Math.random : seededRandom(seed));
}

/** 金额 → 演出分档 class(04 §3 五档:白/黄/橙/红光/彩虹)。 */
function tierClsFor(amount: number): string {
  let cls: string = PULSE_TIERS[0].cls;
  for (const tier of PULSE_TIERS) {
    if (amount >= tier.min) cls = tier.cls;
  }
  return cls;
}

/** 金额 → 演出分档下标(0~4;微震/punch/金币枚数用)。 */
function tierIdxFor(amount: number): number {
  let idx = 0;
  PULSE_TIERS.forEach((tier, i) => {
    if (amount >= tier.min) idx = i;
  });
  return idx;
}

type FloatItem = {
  id: number;
  /** 场景坐标;null = 快照查不到 uid,落到场景中心兜底位。 */
  x: number | null;
  y: number | null;
  text: string;
  /** 演出中显示的统一概念名；总值=团队业绩，分项=压榨业绩。 */
  label?: string;
  cls: string;
  protest: boolean;
  until: number;
  /** total=最新落地宠正上方的总数值(大·金·带$);part=各贡献宠自身数值(横向飘·异色)。 */
  kind?: "total" | "part";
  /** part 的横向飘向(±1;渲染成 --fr-dx)。 */
  dir?: number;
};

type HotDesk = { id: number; element: string; x: number; w: number; top: number; until: number };

type SameMark = { uid: number; x: number; y: number };
type BodyStateMark = {
  uid: number;
  x: number;
  y: number;
  r: number;
  frozen: boolean;
  generated: boolean;
  sizeLevel: number;
};
type ScoreBurst = {
  id: number;
  x: number;
  y: number;
  total: number;
  cards: { id: CardId; amount: number }[];
  until: number;
};

/** 「今天冲到的最高进度」= 已清班数（EconomyRework-TrainingHall.md §5.2）。
 *  - shift（正在打）/ bankrupt（当班失败）：已清 = shiftIndex − 1；
 *  - shop（KPI 达标进商店）：当班已清 = shiftIndex；
 *  - summary：毕业（非无限，冲过第 20 班）已清 = shiftIndex；无限段破产回 summary = shiftIndex − 1。
 *  后端每日每关限领、单调幂等，重复上报同一关只发一次料。 */
function clearedShifts(view: { phase: string; shiftIndex: number; endless: boolean }): number {
  if (view.phase === "settlement" || view.phase === "shop") return view.shiftIndex;
  if (view.phase === "summary") return view.endless ? view.shiftIndex - 1 : view.shiftIndex;
  return view.shiftIndex - 1; // shift / bankrupt
}

export function FactoryRogueScene({
  save,
  config,
  onBack,
  onClaimFactoryLevels,
  onSave,
  onRunStart,
  onFirstShiftComplete,
}: {
  save: GameSave;
  config: GameConfig;
  onBack: () => void;
  onClaimFactoryLevels: (maxLevel: number) => Promise<Record<string, number>>;
  onSave: (save: GameSave) => void;
  onRunStart?: () => void;
  /** 首次教学直接跑真实局；首班强化结束并进入第二班后再提交完成回执。 */
  onFirstShiftComplete?: () => Promise<void> | void;
}) {
  const onboardingActive = save.onboarding?.status === "active";
  // 桌序在进 loadout 前就洗好(「先亮桌图,后选出战」);再开一局重洗。
  const [deskOrder, setDeskOrder] = useState<RogueElement[]>(initialDeskOrder);
  const [run, setRun] = useState<RogueRun | null>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  // 未结束局的续局存档(进场读一次):存在且用户未选「重开」时,先弹「继续/重开」抉择。
  const [resumeSnap, setResumeSnap] = useState<RogueRunSnapshot | null>(
    () => (onboardingActive ? null : loadRunSnapshot()),
  );
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const firstRunGuide =
    onFirstShiftComplete != null
    && onboardingActive
    && save.onboarding?.step.startsWith("C") === true
    && save.factoryTutorial?.status !== "completed";

  // 引导路线始终从新局开始，旧续档不能用普通续局确认打断当前指令。
  useEffect(() => {
    if (!onboardingActive) return;
    clearRunSnapshot();
    setResumeSnap(null);
    setResumeDismissed(true);
  }, [onboardingActive]);
  // 进局元数据表:loadout 展示与 RogueRun 初始化共用同一份推导。
  const meta = useMemo(() => buildSpeciesMeta(config, save), [config, save]);
  const recordBaseline = useMemo(
    () => ({
      starts: save.stats?.factoryRogueRunsStarted ?? 0,
      runs: save.stats?.factoryRogueRunsFinished ?? 0,
    }),
    [save.stats?.factoryRogueRunsFinished, save.stats?.factoryRogueRunsStarted],
  );
  // 出战准备页先画出本局的真实桌序，但不投放宠物、计分或推进局逻辑。
  const loadoutSceneBridge = useMemo<RogueSceneBridge>(
    () => ({
      nextCarried: () => null,
      onThrow: () => false,
      nextOvertime: () => null,
      onOvertimeThrow: () => null,
      onSettled: () => {},
      onBounced: () => {},
      onStrike: () => {},
      onDismissPick: () => {},
      onGone: () => {},
      deskOrder,
      strikeCount: () => Number.POSITIVE_INFINITY,
      windAx: () => 0,
      timeScale: () => 1,
      deskWiden: () => 1,
      clickMode: () => "none",
      isBodyFrozen: () => false,
      bodyScale: () => 1,
      takeBodyMutations: () => [],
      registerSnapshots: () => {},
    }),
    [deskOrder],
  );

  const handleStart = useCallback(
    (loadout: string[]) => {
      onRunStart?.();
      clearRunSnapshot(); // 新开一局:作废旧续档(新局的快照随后由持久化 effect 覆盖写入)。
      setRun(
        new RogueRun({
          loadout,
          meta,
          deskOrder,
          seed: captureSeed() ?? Math.floor(Math.random() * 0x7fffffff),
          recordBaseline,
        }),
      );
    },
    [meta, deskOrder, recordBaseline, onRunStart],
  );

  const handleRetry = useCallback(() => {
    clearRunSnapshot(); // 结算后「再来一局」= 全新开局,清掉刚结束这局可能残留的续档。
    setResumeSnap(null);
    setResumeDismissed(true);
    setRun(null);
    setDeskOrder(initialDeskOrder());
  }, []);

  // 「继续这局」:用当前 meta 还原存档;还原失败(出战物种已全失效)则弃档回选人。
  const handleResume = useCallback(() => {
    if (resumeSnap == null) return;
    const restored = RogueRun.restore(resumeSnap, meta, recordBaseline);
    if (restored == null) {
      clearRunSnapshot();
      setResumeSnap(null);
      setResumeDismissed(true);
      return;
    }
    setRun(restored);
  }, [recordBaseline, resumeSnap, meta]);

  // 「重开一局」:弃续档,落到出战准备页从头选人。
  const handleDiscardResume = useCallback(() => {
    clearRunSnapshot();
    setResumeSnap(null);
    setResumeDismissed(true);
  }, []);

  if (run == null) {
    if (resumeSnap != null && !resumeDismissed) {
      return (
        <div className="fr-stage">
          <ResumeChoice
            snap={resumeSnap}
            onResume={handleResume}
            onNew={handleDiscardResume}
            onBack={onBack}
          />
          {firstRunGuide && <FactoryFirstRunGuide directive={factoryResumeGuide()} />}
        </div>
      );
    }
    return (
      <div className="fr-stage">
        <div className="fr-scene-wrap fr-loadout-scene" aria-hidden="true">
          <FactoryScene save={save} config={config} onBack={onBack} rogue={loadoutSceneBridge} />
        </div>
        <RogueLoadout
          config={config}
          meta={meta}
          deskOrder={deskOrder}
          onStart={handleStart}
          onBack={onBack}
          onLeaderboard={() => setLeaderboardOpen(true)}
          firstRunGuide={firstRunGuide}
        />
        {leaderboardOpen && <FactoryLeaderboard config={config} onClose={() => setLeaderboardOpen(false)} />}
        {firstRunGuide && (
          <FactoryFirstRunGuide directive={factoryLoadoutGuide()} />
        )}
      </div>
    );
  }
  return (
    <>
    <RogueRunStage
      run={run}
      save={save}
      config={config}
      onExit={onBack}
      onRetry={handleRetry}
      onClaimFactoryLevels={onClaimFactoryLevels}
      onLeaderboard={() => setLeaderboardOpen(true)}
      onSave={onSave}
      onFirstShiftComplete={onFirstShiftComplete}
      firstRunGuide={firstRunGuide}
      initialBodies={resumeSnap?.bodies}
      initialRewards={resumeSnap?.rewards}
    />
    {leaderboardOpen && <FactoryLeaderboard config={config} onClose={() => setLeaderboardOpen(false)} />}
    </>
  );
}

/** 未结束局的「继续 / 重开」抉择页(进工厂时若有续档先弹它,选完才进选人/局内)。 */
function ResumeChoice({
  snap,
  onResume,
  onNew,
  onBack,
}: {
  snap: RogueRunSnapshot;
  onResume: () => void;
  onNew: () => void;
  onBack: () => void;
}) {
  const { lang } = useT();
  const R = FACTORY_ROGUE[lang];
  return (
    <div className="fr-overlay fr-quit-overlay">
      <div className="fr-panel fr-quit-panel" onPointerDown={(event) => event.stopPropagation()}>
        <div className="fr-quit-title">{R.resumeTitle}</div>
        <div className="fr-quit-body">{fmt(R.resumeShiftInfo, { n: snap.shiftIndex })}</div>
        <div className="fr-quit-body">{R.resumeBody}</div>
        <div className="fr-quit-actions">
          <button type="button" className="fr-chip fr-btn" onClick={onNew}>
            {R.resumeNew}
          </button>
          <button
            type="button"
            className="fr-chip fr-btn fr-btn-primary"
            data-coach="factoryResume"
            onClick={onResume}
          >
            {R.resumeContinue}
          </button>
        </div>
        <button type="button" className="fr-chip fr-btn" onClick={onBack}>
          {R.hubBack}
        </button>
      </div>
    </div>
  );
}

/** 局内舞台:场景(桥接)+ HUD + 演出层 + 商店/结算浮层。独立组件保证
 *  useSyncExternalStore 只在 run 存在时挂载。 */
function RogueRunStage({
  run,
  save,
  config,
  onExit,
  onRetry,
  onClaimFactoryLevels,
  onSave,
  onFirstShiftComplete,
  firstRunGuide,
  initialBodies,
  initialRewards,
  onLeaderboard,
}: {
  run: RogueRun;
  save: GameSave;
  config: GameConfig;
  onExit: () => void;
  onRetry: () => void;
  onClaimFactoryLevels: (maxLevel: number) => Promise<Record<string, number>>;
  onSave: (save: GameSave) => void;
  onFirstShiftComplete?: () => Promise<void> | void;
  firstRunGuide: boolean;
  initialBodies?: BodyLike[];
  initialRewards?: Record<string, number>;
  onLeaderboard: () => void;
}) {
  const subscribe = useCallback((fn: () => void) => run.subscribe(fn), [run]);
  const getView = useCallback(() => run.view(), [run]);
  const view = useSyncExternalStore(subscribe, getView);
  const gameBridge = useMemo(() => getGameBridge(), []);
  const firstShiftReceiptPendingRef = useRef(false);
  useEffect(() => {
    if (firstShiftReceiptPendingRef.current || onFirstShiftComplete == null) return;
    const firstShiftFinished = view.shiftIndex > 1;
    if (!firstShiftFinished) return;
    firstShiftReceiptPendingRef.current = true;
    void Promise.resolve(onFirstShiftComplete()).catch(() => {
      // 保留在真实局内；下一次状态更新或恢复该局时可以重试回执。
      firstShiftReceiptPendingRef.current = false;
    });
  }, [onFirstShiftComplete, view.phase, view.shiftIndex]);
  const [tutorialSettledCount, setTutorialSettledCount] = useState(
    () => initialBodies?.filter((body) => body.settled).length ?? 0,
  );
  const [strikeWarningOpen, setStrikeWarningOpen] = useState(false);
  // A restarted onboarding is a fresh teaching scope even when this desktop
  // profile acknowledged the warning in an earlier save. Outside onboarding,
  // keep the original once-per-profile behavior.
  const strikeWarningAcknowledgedRef = useRef(
    firstRunGuide ? false : strikeWarningWasAcknowledged(),
  );
  const tutorialSettledUidsRef = useRef(
    new Set(initialBodies?.filter((body) => body.settled).map((body) => body.uid) ?? []),
  );
  useEffect(() => {
    if (view.stats.strikes <= 0 || strikeWarningAcknowledgedRef.current) return;
    setStrikeWarningOpen(true);
  }, [view.stats.strikes]);
  const firstRunDirective = strikeWarningOpen
    ? factoryStrikeWarningGuide()
    : firstRunGuide
      ? factoryRunGuide(view, tutorialSettledCount)
      : null;
  const acknowledgeStrikeWarning = useCallback(() => {
    strikeWarningAcknowledgedRef.current = true;
    rememberStrikeWarning();
    setStrikeWarningOpen(false);
  }, []);
  // KPI 达标后先播「便签拼字 2s → 大号加班提示 1s」，期间场景桥不暴露池头，
  // 从根上保证宠物不会抢在仪式前飞下来。续档若本来就在 overtime 则直接恢复播放。
  const [overtimeReady, setOvertimeReady] = useState(() => view.phase === "overtime");
  const overtimeReadyRef = useRef(overtimeReady);
  overtimeReadyRef.current = overtimeReady;
  const [runRewards, setRunRewards] = useState<Record<string, number>>(
    () => ({ ...(initialRewards ?? {}) }),
  );
  const [rewardFx, setRewardFx] = useState<FactoryRewardFx[]>([]);
  const rewardFxIdRef = useRef(0);
  const [leaderboardStatus, setLeaderboardStatus] = useState<FactoryLeaderboardStatus | null>(null);
  const recordRevenueAtStartRef = useRef(run.records().bestRevenue);
  const runRewardsRef = useRef(runRewards);
  runRewardsRef.current = runRewards;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (view.phase === "overtime") return;
    overtimeReadyRef.current = false;
    setOvertimeReady(false);
  }, [view.phase]);
  const unlockOvertime = useCallback(() => {
    if (run.view().phase !== "overtime") return;
    overtimeReadyRef.current = true;
    setOvertimeReady(true);
    run.beginOvertimeScoring();
  }, [run]);

  // 工厂奖励 → 训练材料：清班数每上一个台阶就上报一次「今日最高进度」。
  // 回调走 ref 存取，故本 effect 只吃已清关数，不因回调换引用而重复触发。
  const claimRef = useRef(onClaimFactoryLevels);
  claimRef.current = onClaimFactoryLevels;
  const claimedHighRef = useRef(0);
  const cleared = clearedShifts(view);
  const madeRevenueRecord = (
    (view.phase === "summary" || view.phase === "bankrupt")
    && view.revenueTotal > recordRevenueAtStartRef.current
  );
  useEffect(
    () => gameBridge.onFactoryLeaderboardStatus(setLeaderboardStatus),
    [gameBridge],
  );
  // 订阅只会收到后续事件；重新进入工厂时必须主动恢复本地已回读的 Steam 名次。
  useEffect(() => {
    let cancelled = false;
    void gameBridge.getFactoryLeaderboardStatus()
      .then((status) => {
        if (!cancelled) setLeaderboardStatus((current) => current ?? status);
      })
      .catch(() => {
        // 未绑定 Steam / 预览环境不影响工厂流程；终局仍会尝试从全球榜回读本人。
      });
    return () => {
      cancelled = true;
    };
  }, [gameBridge]);
  useEffect(() => {
    if (cleared > claimedHighRef.current) {
      claimedHighRef.current = cleared;
      void claimRef.current(cleared).then((granted) => {
        if (!mountedRef.current || Object.keys(granted).length === 0) return;
        const gained = Object.entries(granted).filter(([, count]) => count > 0);
        if (gained.length > 0) {
          const effects = gained.map(([material, count]) => ({
            id: ++rewardFxIdRef.current,
            material,
            count,
          }));
          setRewardFx((current) => [...current, ...effects]);
          for (const effect of effects) {
            window.setTimeout(() => {
              if (mountedRef.current) {
                setRewardFx((current) => current.filter((item) => item.id !== effect.id));
              }
            }, FACTORY_REWARD_FX_MS);
          }
        }
        setRunRewards((previous) => {
          const next = { ...previous };
          for (const [material, count] of Object.entries(granted)) {
            if (count > 0) next[material] = (next[material] ?? 0) + count;
          }
          runRewardsRef.current = next;
          return next;
        });
      });
    }
  }, [cleared]);

  // 成就统计只在稳定节点落主存档：开局、工资单、商店与局终。所有字段都是
  // 绝对高水位/最终事实，后端只做 max/OR，因此续局与 React 重渲染均幂等。
  const achievementReportKeyRef = useRef("");
  const upgradeLevels = Object.values(view.cards).reduce((sum, level) => sum + level, 0);
  useEffect(() => {
    if (
      view.phase !== "hiring"
      && view.phase !== "settlement"
      && view.phase !== "shop"
      && view.phase !== "summary"
      && view.phase !== "bankrupt"
    ) return;

    const records = run.records();
    const snapshot: FactoryRogueAchievementSnapshot = {
      runsStarted: records.starts,
      runsFinished: records.runs,
      bestRevenue: factoryValueString(view.revenueTotal),
      bestShift: Math.max(0, cleared),
      bestPulse: factoryValueString(view.stats.maxPulse),
      bestCombo: Math.max(0, Math.trunc(view.stats.maxCombo)),
      bestDesks: Math.max(0, Math.trunc(view.stats.maxDesks)),
      maxUpgradeLevels: Math.max(0, Math.trunc(upgradeLevels)),
      maxLoadout: view.loadout.length,
      firstKpi: cleared >= 1,
      firstCard: view.boughtCardEver,
      firstBankruptcy: view.phase === "bankrupt",
      strikeClear: view.strikeClearEver,
      allInspectionsInOneRun: (view.inspectionMask & 0b1111) === 0b1111,
      graduated: view.graduated,
      graduatedWithoutLoan: view.graduated && !view.usedLoanEver,
      rewardCoins:
        view.phase === "summary" || view.phase === "bankrupt"
          ? factoryValueString(Math.min(view.revenueTotal, FACTORY_COIN_REWARD_CAP))
          : undefined,
    };
    const key = JSON.stringify(snapshot);
    if (key === achievementReportKeyRef.current) return;
    achievementReportKeyRef.current = key;
    void gameBridge.recordFactoryRogueAchievementSnapshot(snapshot)
      .then((next) => {
        if (view.phase === "summary" || view.phase === "bankrupt") onSave(next);
      })
      .catch(() => {
        // 成就/存档同步失败不能阻断局内操作；后续稳定节点会再次提交高水位。
        achievementReportKeyRef.current = "";
      });
  }, [
    cleared,
    gameBridge,
    onSave,
    run,
    upgradeLevels,
    view.boughtCardEver,
    view.graduated,
    view.inspectionMask,
    view.loadout.length,
    view.phase,
    view.revenueTotal,
    view.stats.maxCombo,
    view.stats.maxDesks,
    view.stats.maxPulse,
    view.strikeClearEver,
    view.usedLoanEver,
  ]);

  // 只提交这个版本中真实走到局终的成绩；绝不扫描/迁移旧 localStorage 最高分。
  // 毕业 summary 先报一次，若继续无限并再次结算，KeepBest 会以更高分覆盖。
  const leaderboardReportKeyRef = useRef("");
  useEffect(() => {
    if (view.phase !== "summary" && view.phase !== "bankrupt") return;
    const result = {
      revenueTotal: factoryValueString(view.revenueTotal),
      bestShift: Math.max(0, cleared),
      endless: view.endless,
      balanceVersion: FACTORY_BALANCE_VERSION,
      loadout: encodeLeaderboardLoadout(view.loadout),
    };
    const key = JSON.stringify(result);
    if (key === leaderboardReportKeyRef.current) return;
    leaderboardReportKeyRef.current = key;
    void gameBridge.recordFactoryLeaderboardResult(result)
      .then((status) => {
        setLeaderboardStatus(status);
        if (status.globalRank != null) return;
        // 本地 outbox 可能来自旧安装、被清理过，或上传事件发生在本页挂载之前。
        // 直接读取 Steam 的本人条目作为显示兜底，避免榜上已有 #1 却显示“—”。
        void gameBridge.getFactoryLeaderboard()
          .then((page) => {
            const me = page.me;
            if (me == null) return;
            setLeaderboardStatus((current) => current?.globalRank != null ? current : ({
              ...(current ?? status),
              steamScore: me.score,
              globalRank: me.rank,
              leaderboardAvailable: true,
            }));
          })
          .catch(() => {
            // Steam 离线时仍由现有 outbox 和 factory://leaderboard 事件稍后收敛。
          });
      })
      .catch(() => {
        // Steam 未连接/榜单未创建时不影响本地结算；Rust outbox 负责可重试场景。
      });
  }, [cleared, gameBridge, view.endless, view.phase, view.revenueTotal]);

  const { lang, T } = useT();
  const R = FACTORY_ROGUE[lang];
  const RRef = useRef(R);
  RRef.current = R;

  // 场景快照读取器:桥的 registerSnapshots 截流一份给演出层(浮字定位/💢标记),
  // 同时原样转发给逻辑层。
  const snapshotRef = useRef<{ bodies: () => BodyLike[]; desks: () => DeskLike[] } | null>(null);
  const bodyStateElementRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const positionBodyState = useCallback((uid: number, x: number, y: number, bobY: number) => {
    const element = bodyStateElementRefs.current.get(uid);
    if (element == null) return;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.style.transform = `translate(-50%, -52%) translateY(${bobY.toFixed(2)}px)`;
  }, []);

  // ---- P3 演出层句柄/缓存 ----
  const stageRef = useRef<HTMLDivElement | null>(null);
  const sceneWrapRef = useRef<HTMLDivElement | null>(null);
  const fxRef = useRef<RoguePulseFxApi | null>(null);
  const revenueRef = useRef<HTMLSpanElement | null>(null);
  const cashRef = useRef<HTMLDivElement | null>(null);
  const spendWalletTimerRef = useRef<number | null>(null);
  const previousCashRef = useRef(view.cash);
  useEffect(() => {
    const previous = previousCashRef.current;
    previousCashRef.current = view.cash;
    if (view.cash === previous) return;
    const wallet = cashRef.current;
    if (wallet == null) return;
    wallet.classList.remove("is-spending");
    void wallet.offsetWidth;
    wallet.classList.add("is-spending");
    const previousWalletTimer = spendWalletTimerRef.current;
    window.clearTimeout(previousWalletTimer ?? undefined);
    spendWalletTimerRef.current = window.setTimeout(() => {
      wallet.classList.remove("is-spending");
      spendWalletTimerRef.current = null;
    }, 1350);
  }, [view.cash]);

  const animateImmediateSpend = useCallback((target: HTMLElement, amount: number) => {
    if (amount <= 0) return;
    const stage = stageRef.current;
    const wallet = cashRef.current;
    if (stage == null || wallet == null) return;
    const from = wallet.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    wallet.classList.remove("is-spending");
    void wallet.offsetWidth;
    wallet.classList.add("is-spending");
    wallet.dispatchEvent(new CustomEvent("fhp-wallet-roll", {
      detail: { value: Math.max(0, view.cash - amount) },
    }));
    const activeWalletTimer = spendWalletTimerRef.current;
    window.clearTimeout(activeWalletTimer ?? undefined);
    spendWalletTimerRef.current = window.setTimeout(() => {
      wallet.classList.remove("is-spending");
      spendWalletTimerRef.current = null;
    }, 1700);
    target.animate(
      [{ scale: "1" }, { scale: "1.12", boxShadow: "0 0 26px #ffd23e" }, { scale: "1" }],
      { duration: 650, easing: "ease-out" },
    );
    for (let i = 0; i < 18; i++) {
      const coin = document.createElement("i");
      coin.className = "fr-spend-coin is-strong";
      coin.textContent = "¥";
      coin.style.left = `${from.left + from.width / 2}px`;
      coin.style.top = `${from.top + from.height / 2}px`;
      document.body.appendChild(coin);
      const startX = from.left + from.width / 2;
      const startY = from.top + from.height / 2;
      const endX = to.left + to.width / 2 + (i % 5 - 2) * 7;
      const endY = to.top + to.height / 2 + (i % 3 - 1) * 7;
      const burstX = startX + (i % 6 - 2.5) * 8;
      const burstY = startY - 28 - (i % 4) * 8;
      const flight = coin.animate(
        [
          { left: `${startX}px`, top: `${startY}px`, transform: "translate(-50%,-50%) scale(.45) rotate(0deg)", opacity: 0 },
          { left: `${burstX}px`, top: `${burstY}px`, transform: "translate(-50%,-50%) scale(1.2) rotate(140deg)", opacity: 1, offset: .2 },
          { left: `${endX}px`, top: `${endY}px`, transform: "translate(-50%,-50%) scale(.2) rotate(600deg)", opacity: 0 },
        ],
        { duration: 720, delay: i * 20, easing: "cubic-bezier(.16,.8,.25,1)", fill: "forwards" },
      );
      const cleanup = () => coin.remove();
      flight.finished.then(cleanup, cleanup);
      window.setTimeout(cleanup, 1250);
    }
  }, [view.cash]);

  const onSpendCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (button == null || button.disabled) return;
    let amount = 0;
    if (button.classList.contains("fr-settlement-confirm")) amount = view.bill;
    else if (button.classList.contains("is-confirm")) {
      amount = (view.hiring?.hireCost ?? 0) + (view.hiring?.rerollSpent ?? 0);
    } else if (button.classList.contains("fr-hiring-reroll")) amount = view.hiring?.rerollCost ?? 0;
    else if (button.classList.contains("fr-card-buybar") || button.classList.contains("fr-shop-act")) {
      const match = button.textContent?.replace(/,/g, "").match(/[¥$]\s*(\d+)/);
      amount = match ? Number(match[1]) : 0;
    }
    if (amount > 0) animateImmediateSpend(button, amount);
  }, [animateImmediateSpend, view.bill, view.hiring]);
  // 离场宠位置缓存:罢工/解雇宠在 onStrike/onDismissPick 同步调用后立刻被场景移除,
  // 泵读快照时人已不在——演出(抗议浮字/爆破/退款)靠这里定位。
  const goneRef = useRef(new Map<number, { x: number; y: number; r: number; at: number }>());
  const strikeTimesRef = useRef<number[]>([]);
  const fxClsTimersRef = useRef<{ shake?: number; punch?: number }>({});

  // 教学触发线(RogueBanners 消费):首次落定 / 首次两同粘连。
  const [cues, setCues] = useState({ settled: false, samePair: false });
  const cuesRef = useRef(cues);
  const markCue = useCallback((key: "settled" | "samePair") => {
    if (cuesRef.current[key]) return;
    cuesRef.current = { ...cuesRef.current, [key]: true };
    setCues(cuesRef.current);
  }, []);

  // ---- 屏幕微震(t2+)与镜头 punch(t3+):只动本组件自己的容器 ----
  const shakeStage = useCallback(() => {
    const el = stageRef.current;
    if (el == null) return;
    el.classList.remove("fr-stage-shake");
    void el.offsetWidth; // 重启动画
    el.classList.add("fr-stage-shake");
    window.clearTimeout(fxClsTimersRef.current.shake);
    fxClsTimersRef.current.shake = window.setTimeout(() => el.classList.remove("fr-stage-shake"), 140);
  }, []);
  const punchScene = useCallback(() => {
    const el = sceneWrapRef.current;
    if (el == null) return;
    el.classList.remove("fr-scene-punch");
    void el.offsetWidth;
    el.classList.add("fr-scene-punch");
    window.clearTimeout(fxClsTimersRef.current.punch);
    fxClsTimersRef.current.punch = window.setTimeout(() => el.classList.remove("fr-scene-punch"), 280);
  }, []);
  useEffect(
    () => () => {
      window.clearTimeout(fxClsTimersRef.current.shake);
      window.clearTimeout(fxClsTimersRef.current.punch);
      const walletTimer = spendWalletTimerRef.current;
      window.clearTimeout(walletTimer ?? undefined);
      cashRef.current?.classList.remove("is-spending");
      document.querySelectorAll(".fr-spend-coin").forEach((node) => node.remove());
    },
    [],
  );

  // ---- HUD 计数器目标点(金币/退款飞行终点;舞台坐标) ----
  const relPoint = useCallback((el: HTMLElement | null) => {
    const stage = stageRef.current;
    if (el == null || stage == null) return null;
    const sr = stage.getBoundingClientRect();
    const rr = el.getBoundingClientRect();
    return { x: rr.left + rr.width / 2 - sr.left, y: rr.top + rr.height / 2 - sr.top };
  }, []);
  const getRevenuePoint = useCallback(() => relPoint(revenueRef.current), [relPoint]);
  const getCashPoint = useCallback(() => relPoint(cashRef.current), [relPoint]);

  // 金币命中 → HUD 弹跳。逐币回调必须节流并复用一条动画，否则钱潮会给同一
  // 元素叠上几十条 WAAPI Animation，成为主线程长任务。
  const lastPopRef = useRef(0);
  const lastCashPopRef = useRef(0);
  const cashPopAnimationRef = useRef<Animation | null>(null);
  const onCoinHit = useCallback(() => {
    const now = performance.now();
    if (now - lastPopRef.current < 90) return;
    lastPopRef.current = now;
    revenueRef.current?.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.22)" }, { transform: "scale(1)" }],
      { duration: 160, easing: "ease-out" },
    );
  }, []);
  const onCashHit = useCallback(() => {
    const now = performance.now();
    if (now - lastCashPopRef.current < 90) return;
    lastCashPopRef.current = now;
    const cash = cashRef.current;
    if (cash == null) return;
    cashPopAnimationRef.current?.cancel();
    cashPopAnimationRef.current = cash.animate(
      [
        { transform: "scale(1)", filter: "none" },
        { transform: "scale(1.12)", filter: "drop-shadow(0 0 8px rgba(87,214,104,0.9))" },
        { transform: "scale(1)", filter: "none" },
      ],
      { duration: 220, easing: "ease-out" },
    );
  }, []);
  useEffect(() => () => cashPopAnimationRef.current?.cancel(), []);

  const celebrate = useCallback((bonus: number) => {
    fxRef.current?.confetti();
    fxRef.current?.kpiBonus(bonus);
  }, []);

  // ---- 浮字兜底推送(弹开原因/没接桌提示;满池即丢,提示优先级最低) ----
  const floatIdRef = useRef(1);
  const [floats, setFloats] = useState<FloatItem[]>([]);
  const [connectionFailure, setConnectionFailure] = useState<{
    uid: number;
    species?: string;
    x?: number;
    y?: number;
    r?: number;
    token: number;
    text: string;
  } | null>(null);
  const spotTokenRef = useRef(1);
  const pushHintFloat = useCallback((p: { x: number; y: number } | null, text: string) => {
    const nowT = Date.now();
    setFloats((prev) => {
      const alive = prev.filter((f) => f.until > nowT);
      if (alive.length >= FLOAT_MAX) return alive;
      return [
        ...alive,
        {
          id: floatIdRef.current++,
          x: p?.x ?? null,
          y: p?.y ?? null,
          text,
          cls: "miss",
          protest: false,
          until: nowT + FLOAT_MS,
        },
      ];
    });
  }, []);

  // ---- 桥事件截流(罢工/解雇/弹开:在逻辑层处理前抓位置) ----
  const tapStrike = useCallback(
    (uids: number[]) => {
      const bodies = snapshotRef.current?.bodies() ?? [];
      const byUid = new Map(bodies.map((b) => [b.uid, b]));
      const now = Date.now();
      const pts: { x: number; y: number; r: number; amount: number }[] = [];
      for (const uid of uids) {
        const feedback = run.departureFeedback(uid);
        if (!feedback.accepted) continue;
        const b = byUid.get(uid);
        if (b == null) continue;
        goneRef.current.set(uid, { x: b.x, y: b.y, r: b.r, at: now });
        pts.push({ x: b.x, y: b.y, r: b.r, amount: feedback.refund });
      }
      const fx = fxRef.current;
      if (fx == null || pts.length === 0) return;
      // 举牌期脚下橙红「结算阵」(举牌演出是场景的,阵是演出层叠的)
      fx.strikeRings(pts);
      // Only workers with a real severance amount emit a precise green refund.
      fx.severanceRefund(pts.filter((p) => p.amount > 0), 1050);
      // 连锁罢工:窗口内第 2 组起屏幕边缘红闪,强度随组数递增
      const times = strikeTimesRef.current.filter((t) => now - t < STRIKE_CHAIN_WINDOW_MS);
      times.push(now);
      strikeTimesRef.current = times;
      if (times.length >= 2) fx.edgeFlash(Math.min(3, times.length - 1));
    },
    [run],
  );
  const tapDismiss = useCallback(
    (uid: number) => {
      const feedback = run.departureFeedback(uid, 1);
      if (!feedback.accepted) return;
      const b = snapshotRef.current?.bodies().find((x) => x.uid === uid);
      if (b == null) return;
      goneRef.current.set(uid, { x: b.x, y: b.y, r: b.r, at: Date.now() });
      const fx = fxRef.current;
      fx?.dismissStamp({ x: b.x, y: b.y, r: b.r });
      // Manual dismissal always refunds 100% of the recorded hire price.
      if (feedback.refund > 0) fx?.severanceRefund([{ x: b.x, y: b.y, amount: feedback.refund }], 320);
    },
    [run],
  );
  const tapBounce = useCallback(
    (uid: number) => {
      // 弹开确定(落地未粘):即时原因浮字(04 §11「失败从不无声」)。
      // 滚出场外的失投此刻已不在快照,查不到就不弹。失投角色会继续滚走，
      // 因此这里只显示浮字；红色角色重绘仅属于“已落定但未接桌”的失败演出，
      // 否则本体逃走后会在原落点留下一个静止残影。
      const b = snapshotRef.current?.bodies().find((x) => x.uid === uid);
      if (b == null) return;
      pushHintFloat({ x: b.x, y: b.y - b.r - 6 }, RRef.current.hintNoShare);
    },
    [pushHintFloat],
  );
  const tapSettle = useCallback(
    (uid: number) => {
      // 加班角色落定后很快就会抽离塔体，而演出泵最多要再等 200ms。
      // 先记住落地点，保证团队业绩、卡牌贡献和延迟播放的 buff 特效仍锚在角色头顶。
      if (run.view().phase !== "overtime") return;
      const b = snapshotRef.current?.bodies().find((body) => body.uid === uid);
      if (b == null) return;
      goneRef.current.set(uid, { x: b.x, y: b.y, r: b.r, at: Date.now() });
    },
    [run],
  );

  // 桥对象:只在 run / deskOrder **内容**变化时换新(搬桌 → 场景重排桌子;
  // view 的其它变更不惊动场景)。真实 RogueRun 的 view() 每次重建都 slice 出
  // 新数组,直接透传会让每次 bump 都换桥、白跑场景的 [rogue] effect——
  // 按 join key 复用旧引用,内容变了才放行。
  const deskOrderKey = view.deskOrder.join(",");
  const deskOrder = useMemo(() => view.deskOrder, [deskOrderKey]); // eslint 无:有意依赖 key
  const disabledDesksKey = view.disabledDesks.join(",");
  const disabledDesks = useMemo(() => view.disabledDesks, [disabledDesksKey]);
  const visualInitialBodies = useMemo(() => {
    if (initialBodies == null) return undefined;
    const states = new Map(run.view().bodyStates.map((state) => [state.uid, state]));
    return initialBodies.map((body) => {
      const state = states.get(body.uid);
      return {
        ...body,
        species: state?.speciesOverride ?? body.species,
        elements: state?.elementsOverride?.slice() ?? body.elements.slice(),
      };
    });
  }, [initialBodies, run]);
  const bridge = useMemo<RogueSceneBridge>(
    () => ({
      nextCarried: () => run.nextCarried(),
      onThrow: (uid, species) => run.onThrow(uid, species),
      nextOvertime: () => (overtimeReadyRef.current ? run.nextOvertime() : null),
      onOvertimeThrow: (uid, species, radius) => (
        overtimeReadyRef.current ? run.onOvertimeThrow(uid, species, radius) : null
      ),
      onSettled: (uid) => {
        tapSettle(uid);
        const current = run.view();
        if (
          firstRunGuide
          && current.shiftIndex === 1
          && current.phase === "shift"
          && !tutorialSettledUidsRef.current.has(uid)
        ) {
          tutorialSettledUidsRef.current.add(uid);
          setTutorialSettledCount((count) => count + 1);
        }
        run.onSettled(uid);
      },
      onBounced: (uid, species) => {
        tapBounce(uid);
        run.onBounced(uid, species);
      },
      onStrike: (uids, species) => {
        tapStrike(uids); // 移除前抓位置(场景保证此刻快照仍含离场宠)
        run.onStrike(uids, species);
      },
      onDismissPick: (uid) => {
        tapDismiss(uid);
        run.onDismissPick(uid);
      },
      onGone: (uid, reason) => run.onGone(uid, reason),
      initialBodies: visualInitialBodies,
      deskOrder,
      takeDeskMoves: () => run.takeDeskMoves(),
      disabledDesks,
      strikeCount: (elements) => run.strikeCount(elements),
      countsForStrike: (uid) => run.countsForStrike(uid),
      stickOverride: (a, b) => run.stickOverride(a, b),
      windAx: () => run.windAx(),
      // P3 桥接线:hit-stop 慢镜(场景 rAF 每帧乘 dt)与首班教学宽桌(重排管线)
      timeScale: () => run.timeScale(),
      deskWiden: () => run.deskWiden(),
      showDropGuide: () => {
        const current = run.view();
        return current.phase === "shift" && current.shiftIndex === 1 && current.stats.throws < 3;
      },
      clickMode: () => run.clickMode(),
      isBodyFrozen: (uid) => run.isBodyFrozen(uid),
      isBodyGenerated: (uid) => run.isBodyGenerated(uid),
      sleepingPathUids: () => run.sleepingPathUids(),
      bodyScale: (uid) => run.bodyScale(uid),
      takeBodyMutations: () => {
        const mutations = run.takeBodyMutations();
        if (mutations.length > 0) {
          const byUid = new Map((snapshotRef.current?.bodies() ?? []).map((body) => [body.uid, body]));
          for (const mutation of mutations) {
            if (mutation.kind !== "absorb") continue;
            const target = byUid.get(mutation.targetUid);
            if (target != null) {
              goneRef.current.set(target.uid, {
                x: target.x,
                y: target.y,
                r: target.r,
                at: Date.now(),
              });
            }
          }
        }
        return mutations;
      },
      positionBodyState,
      takeGeneratedSpawn: (uid) => run.takeGeneratedSpawn(uid),
      registerSnapshots: (fns) => {
        snapshotRef.current = fns;
        run.registerSnapshots(fns);
      },
    }),
    [
      run,
      deskOrder,
      disabledDesks,
      tapSettle,
      tapBounce,
      tapStrike,
      tapDismiss,
      firstRunGuide,
      visualInitialBodies,
      positionBodyState,
    ],
  );

  const [resumeNoticeSeconds, setResumeNoticeSeconds] = useState<number | null>(null);

  // 逻辑滴答(250ms):赶工墙钟、限电末次投放判定、风向翻转、破产复查全在逻辑层。
  // 切到后台时暂停绝对墙钟；恢复时顺延截止时间，避免玩家因切窗被瞬间判负。
  useEffect(() => {
    let hiddenAt = document.hidden ? Date.now() : null;
    let noticeTimer: number | undefined;
    const timer = window.setInterval(() => {
      if (!document.hidden) run.tick(Date.now());
    }, TICK_MS);
    const onVisibilityChange = () => {
      const now = Date.now();
      if (document.hidden) {
        hiddenAt ??= now;
        return;
      }
      if (hiddenAt == null) return;
      const pausedMs = Math.max(0, now - hiddenAt);
      run.resumeClock(now, hiddenAt);
      hiddenAt = null;
      if (pausedMs < 500) return;
      setResumeNoticeSeconds(Math.max(1, Math.round(pausedMs / 1000)));
      if (noticeTimer != null) window.clearTimeout(noticeTimer);
      noticeTimer = window.setTimeout(() => setResumeNoticeSeconds(null), 1800);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      if (noticeTimer != null) window.clearTimeout(noticeTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [run]);

  // 续局存档:订阅局变更,把「与物理堆无关」的经济/班次/商店态落 localStorage。
  // 节流至多 0.5/s，并在浏览器空闲段做数组复制/JSON 序列化；检查日 250ms 滴答
  // 也会 bump，若同步 2/s 落盘会形成肉眼可见的固定节奏主线程尖峰。
  // 挂载即写一次、卸载(离开工厂/结算)强制补写最后一帧。snapshot()==null(结算/破产)
  // 时 saveRunSnapshot 清盘,故一局打完后再进工厂不会误弹「继续」。
  useEffect(() => {
    let timer: number | undefined;
    let idle: number | undefined;
    let lastAt = 0;
    let dirty = false;
    const flush = () => {
      if (timer != null) window.clearTimeout(timer);
      if (idle != null) window.cancelIdleCallback(idle);
      timer = undefined;
      idle = undefined;
      dirty = false;
      lastAt = performance.now();
      const snapshot = run.snapshot();
      if (snapshot != null) snapshot.rewards = { ...runRewardsRef.current };
      saveRunSnapshot(snapshot);
    };
    const flushWhenIdle = () => {
      idle = window.requestIdleCallback(() => {
        idle = undefined;
        if (dirty) flush();
      }, { timeout: RUN_SNAPSHOT_IDLE_TIMEOUT_MS });
    };
    const schedule = () => {
      dirty = true;
      if (timer != null || idle != null) {
        return;
      }
      const wait = Math.max(0, RUN_SNAPSHOT_MIN_INTERVAL_MS - (performance.now() - lastAt));
      timer = window.setTimeout(() => {
        timer = undefined;
        if (!dirty) return;
        // WebView2/Chromium 支持 requestIdleCallback；把同步 localStorage 写入放到
        // 帧间空隙，timeout 只用于持续繁忙时保证续局快照不会无限拖延。
        flushWhenIdle();
      }, wait);
    };
    const unsub = run.subscribe(schedule);
    // Shop peel animations can synchronously commit a pending buy/skip/reroll
    // from their own pagehide/visibility listeners. Defer persistence to the
    // event's microtask checkpoint so every same-event state commit is included,
    // while still completing before the browser freezes or discards the page.
    const flushAfterInterruptionEvent = () => queueMicrotask(flush);
    const flushOnPageHide = () => flushAfterInterruptionEvent();
    const flushOnVisibilityChange = () => {
      if (document.hidden) flushAfterInterruptionEvent();
    };
    window.addEventListener("pagehide", flushOnPageHide);
    document.addEventListener("visibilitychange", flushOnVisibilityChange);
    flush(); // 进局即写一版(承接刚 restore 的续局态 / 记录新局起点)
    return () => {
      unsub();
      window.removeEventListener("pagehide", flushOnPageHide);
      document.removeEventListener("visibilitychange", flushOnVisibilityChange);
      if (timer != null) window.clearTimeout(timer);
      if (idle != null) window.cancelIdleCallback(idle);
      flush(); // 卸载补写:离开工厂时把最新一帧存下,供下次「继续」
    };
  }, [run]);

  // ---- 调试句柄(?frdebug=1;测试线自检口) ----
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("frdebug") !== "1") return;
    const w = window as unknown as Record<string, unknown>;
    w.__frRun = run;
    w.__frFx = {
      activeParticles: () => fxRef.current?.activeParticles() ?? 0,
      // 商店录制/性能自检使用：走真实 RoguePulseFx 金币对象池与飞向 HUD 的轨迹。
      coinWave: () => fxRef.current?.kpiBonus(250_000),
      confetti: () => fxRef.current?.confetti(),
      showcaseImpact: (variant = 0) => {
        const stage = stageRef.current;
        const width = stage?.clientWidth ?? window.innerWidth;
        const height = stage?.clientHeight ?? window.innerHeight;
        const slot = Math.abs(Number(variant) || 0) % 4;
        const at = {
          x: width * ([0.32, 0.46, 0.62, 0.74][slot] ?? 0.5),
          y: height * ([0.58, 0.66, 0.55, 0.63][slot] ?? 0.6),
        };
        fxRef.current?.protest({ at, amount: 18_888 + slot * 7_777, tier: 2 + (slot % 2) });
        fxRef.current?.edgeFlash(1 + (slot % 3));
        if (slot % 2 === 1) {
          fxRef.current?.strikeRings([
            { x: at.x - 84, y: at.y + 34, r: 42 },
            { x: at.x + 4, y: at.y + 12, r: 48 },
            { x: at.x + 92, y: at.y + 38, r: 40 },
          ]);
        }
      },
    };
    return () => {
      delete w.__frRun;
      delete w.__frFx;
    };
  }, [run]);

  // ---- 脉冲演出泵(200ms):浮字/接桌高亮/💢 标记(P2 基线)+ P3 结算链 ----
  const [hotDesks, setHotDesks] = useState<HotDesk[]>([]);
  const [marks, setMarks] = useState<SameMark[]>([]);
  const [bodyStateMarks, setBodyStateMarks] = useState<BodyStateMark[]>([]);
  const [scoreBursts, setScoreBursts] = useState<ScoreBurst[]>([]);
  const scoreBurstIdRef = useRef(1);
  const hotIdRef = useRef(1);
  // N1 结算聚光信号(token 变即触发场景一次 ~2s 高亮:落地宠+吸取宠彩色打工、余灰显定格)。
  const [spotlight, setSpotlight] = useState<{
    uids: number[];
    deskEls: string[];
    token: number;
    durationMs?: number;
  } | null>(null);

  useEffect(() => {
    const delayedFloatTimers = new Set<number>();
    let nextPassiveAuditAt = 0;
    const timer = window.setInterval(() => {
      const nowT = Date.now();
      const pulses = run.takePulses();
      // view() 会组装招聘、卡牌、身体状态等完整 UI 快照；一轮演出泵只取一次，
      // 避免百人场景每 200ms 为三个独立读取重复分配同一批数组/对象。
      const currentView = run.view();
      // 非交互阶段的场景已冻结并被弹层遮住；丢弃刚收班时残留的视觉脉冲，
      // 不再分配 bodies 数组、位置 Map 和完整身体状态投影。
      if (currentView.phase !== "shift" && currentView.phase !== "overtime") return;
      if (pulses.length === 0 && nowT < nextPassiveAuditAt) {
        // 过期演出仍按 200ms 回收，但稳定场景不重复构造 bodies/Map。
        setFloats((items) => (items.some((item) => item.until <= nowT) ? items.filter((item) => item.until > nowT) : items));
        setHotDesks((items) => (items.some((item) => item.until <= nowT) ? items.filter((item) => item.until > nowT) : items));
        setScoreBursts((items) => (items.some((item) => item.until <= nowT) ? items.filter((item) => item.until > nowT) : items));
        return;
      }
      if (pulses.length === 0) nextPassiveAuditAt = nowT + PASSIVE_SCENE_AUDIT_MS;
      const snap = snapshotRef.current;
      const bodies = snap?.bodies() ?? [];
      const gone = goneRef.current;
      // 离场位置缓存修剪
      if (gone.size > 0) {
        for (const [uid, g] of gone) {
          if (nowT - g.at > GONE_POS_TTL_MS) gone.delete(uid);
        }
      }
      const posByUid = new Map(bodies.map((b) => [b.uid, b]));
      /** uid → 位置(在场读快照,离场读缓存;都查不到 null)。 */
      const locate = (uid: number): { x: number; y: number; r: number } | null => {
        const b = posByUid.get(uid);
        if (b != null) return { x: b.x, y: b.y, r: b.r };
        const g = gone.get(uid);
        return g != null ? { x: g.x, y: g.y, r: g.r } : null;
      };

      if (pulses.length > 0) {
        const nextBursts: ScoreBurst[] = [];
        for (const pulse of pulses) {
          const at = locate(pulse.uid);
          const total = pulse.total + pulse.extras.reduce((sum, item) => sum + item.amount, 0);
          if (at == null || total <= 0) continue;
          nextBursts.push({
            id: scoreBurstIdRef.current++,
            x: at.x,
            // 原有的大号总得分位于角色上方；卡片贡献明细排在它下方，避免重复总分重叠。
            y: at.y - at.r + 12,
            total,
            cards: (pulse.cardContributions ?? []).map((item) => ({
              id: item.id as CardId,
              amount: item.amount,
            })),
            until: nowT + 1500,
          });
        }
        setScoreBursts((previous) => [
          ...previous.filter((item) => item.until > nowT),
          ...nextBursts,
        ].slice(-6));
        const effectiveCards = new Set(
          pulses.flatMap((pulse) => pulse.cardContributions?.map((item) => item.id) ?? []),
        );
        stageRef.current?.querySelectorAll<HTMLElement>(".fhp-active-card").forEach((icon) => {
          const active = effectiveCards.has(icon.dataset.cardId ?? "");
          icon.animate(
            active
              ? [
                  { filter: "grayscale(1) brightness(.55)", transform: "scale(.84)" },
                  { filter: "none", transform: "scale(1.3)", boxShadow: "0 0 0 12px rgba(255,210,62,0)" },
                  { filter: "none", transform: "scale(1)" },
                ]
              : [
                  { filter: "grayscale(1) brightness(.55)" },
                  { filter: "grayscale(1) brightness(.55)" },
                  { filter: "none" },
                ],
            { duration: 900, easing: "ease-out" },
          );
        });
        // 主脉冲 + 追加脉冲(回响/短路/工休罢工业绩)摊平成浮字条目。入账约定(P1):
        // 一条 breakdown 的入账 = total + Σextras；0 额条目不弹浮字。
        // 主数字(总值,落地宠正上方,大·金·带$) + 各贡献宠自身数值(横向飘,异色) +
        // 追加脉冲(回响/短路/工休罢工业绩)。入账约定(P1):breakdown 入账 = total + Σextras;
        // 0 额条目不弹浮字。part 直接读取 contributors 中精确到每只咕噜的压榨业绩。
        const mainEntries: {
          uid: number;
          amount: number;
          protest: boolean;
          kind?: "total";
          repeatCount?: number;
          delayMs?: number;
        }[] = [];
        const partEntries: { uid: number; amount: number }[] = [];
        for (const p of pulses) {
          if (p.total > 0) {
            const scoreTimes = p.deskScoreMult ?? Math.max(1, p.deskCount);
            mainEntries.push({
              uid: p.uid,
              amount: p.total / scoreTimes,
              protest: false,
              kind: "total",
              repeatCount: scoreTimes,
            });
          }
          let extraStep = 0;
          for (const ex of p.extras) {
            if (ex.amount <= 0) continue;
            const isSkillScore = ex.kind !== "protest";
            mainEntries.push({
              uid: ex.uid,
              amount: ex.amount,
              protest: ex.kind === "protest",
              kind: isSkillScore ? "total" : undefined,
              // 每条额外计分独立排队；绝不合并成「×N」。
              delayMs: isSkillScore
                ? 260 + extraStep++ * (ex.kind === "wildfire" ? 170 : 105)
                : 0,
            });
          }
          if (p.total > 0) {
            const exploited = p.contributors
              .filter((part) => part.role === "absorbed" && part.amount > 0)
              .slice(0, PART_FLOAT_MAX);
            for (const part of exploited) partEntries.push({ uid: part.uid, amount: part.amount });
          }
        }
        const floatForEntry = (
          e: (typeof mainEntries)[number],
          createdAt: number,
        ): FloatItem => {
          const b = locate(e.uid);
          return {
            id: floatIdRef.current++,
            x: b != null ? b.x : null,
            y: b != null ? b.y - b.r - (e.kind === "total" ? 16 : 6) : null,
            text: e.kind === "total"
              ? `+$${formatCount(Math.round(e.amount))}${(e.repeatCount ?? 1) > 1 ? ` ×${e.repeatCount}` : ""}`
              : `+${formatCount(Math.round(e.amount))}`,
            label: e.kind === "total"
              ? R.runtimeTeamPerformance
              : undefined,
            cls: e.kind === "total" ? "is-total" : tierClsFor(e.amount),
            protest: e.protest,
            until: createdAt + FLOAT_MS,
            kind: e.kind,
          };
        };
        const immediateEntries = mainEntries.filter((entry) => (entry.delayMs ?? 0) <= 0);
        const delayedEntries = mainEntries.filter((entry) => (entry.delayMs ?? 0) > 0);
        setFloats((prev) => {
          const alive = prev.filter((f) => f.until > nowT);
          const items: FloatItem[] = [];
          // 主数字优先占坑,part 数字用剩余名额(名额紧张先舍 part)。
          for (const e of immediateEntries) {
            if (alive.length + items.length >= FLOAT_MAX) break;
            items.push(floatForEntry(e, nowT));
          }
          partEntries.forEach((e, i) => {
            if (alive.length + items.length >= FLOAT_MAX + PART_FLOAT_MAX) return;
            const b = locate(e.uid);
            items.push({
              id: floatIdRef.current++,
              x: b != null ? b.x : null,
              y: b != null ? b.y - Math.round(b.r * 0.3) : null,
              text: `+${formatCount(Math.round(e.amount))}`,
              label: R.runtimeExploitationPerformance,
              cls: "is-part",
              protest: false,
              until: nowT + FLOAT_MS,
              kind: "part",
              dir: i % 2 === 0 ? -1 : 1,
            });
          });
          return [...alive, ...items];
        });
        for (const entry of delayedEntries) {
          const timeout = window.setTimeout(() => {
            delayedFloatTimers.delete(timeout);
            const createdAt = Date.now();
            setFloats((previous) => {
              const alive = previous.filter((item) => item.until > createdAt);
              // 队列项必须出现；并发超预算时淘汰最老浮字，而不是吞掉本次触发。
              const room = alive.length >= FLOAT_MAX ? alive.slice(alive.length - FLOAT_MAX + 1) : alive;
              return [...room, floatForEntry(entry, createdAt)];
            });
          }, entry.delayMs);
          delayedFloatTimers.add(timeout);
        }

        // N1 结算聚光：团队成员始终保持彩色；冻结、同化、生长、额外计分等
        // 确实得到演出的角色也点亮。整网统计只取演出预算内真正播放的目标，
        // 不能借完整 targetUids 把几十只连通角色全部染亮。
        {
          const spotUids = new Set<number>();
          const spotDesks = new Set<string>();
          for (const p of pulses) {
            if (p.total <= 0) continue; // 只对真正计分的落地脉冲聚光(抗议/0 桌不聚光)
            for (const uid of pulseSpotlightUids(p)) spotUids.add(uid);
            for (const el of p.desks) if (el !== "prism") spotDesks.add(el);
          }
          if (spotUids.size > 0) {
            setSpotlight({
              uids: [...spotUids],
              deskEls: [...spotDesks],
              token: spotTokenRef.current++,
              durationMs: 1000,
            });
          }
        }

        // 接桌高亮:对每条脉冲接通的桌亮描边 0.6s("prism" 虚拟桌无实体,跳过)。
        const desksArr = snap?.desks() ?? [];
        const hitElements = new Set<string>();
        for (const p of pulses) for (const el of p.desks) hitElements.add(el);
        if (hitElements.size > 0) {
          setHotDesks((prev) => {
            const alive = prev.filter((d) => d.until > nowT);
            const items: HotDesk[] = [];
            hitElements.forEach((el) => {
              const d = desksArr.find((dd) => dd.element === el);
              if (d == null) return;
              items.push({ id: hotIdRef.current++, element: el, x: d.x, w: d.w, top: d.top, until: nowT + DESK_HOT_MS });
            });
            return [...alive, ...items];
          });
        }

        // ---- P3 结算链:吸取波/通路流光/金币喷泉/jackpot + 微震/punch ----
        const fx = fxRef.current;
        if (fx != null) {
          const deskOf = (el: string) => desksArr.find((dd) => dd.element === el) ?? null;
          let maxTier = -1;
          let chains = 0;
          for (const p of pulses) {
            const gained = p.total + p.extras.reduce((acc, e) => acc + e.amount, 0);
            if (gained > 0) maxTier = Math.max(maxTier, tierIdxFor(gained));
            // 离场结算(抗议单):uid 已出物理堆,只演爆破,不走落地结算链。
            const departure = p.overtime !== true && gone.has(p.uid) && !posByUid.has(p.uid);
            if (!departure) {
              markCue("settled"); // 教学步②:首次落定
              if (p.total > 0 && chains < FX_CHAINS_MAX) {
                chains++;
                const at = locate(p.uid);
                const scoreTimes = p.deskScoreMult ?? Math.max(1, p.deskCount);
                // pulse 已同时画出全部桌路径；jackpot ×N 与主得分数字表达多桌倍率，
                // 同一笔结算不再按桌数复制吸取、技能节点和金币潮。
                fx.pulse({
                  bd: p,
                  gained: gained / scoreTimes,
                  tier: tierIdxFor(gained / scoreTimes),
                  at: at != null ? { x: at.x, y: at.y } : null,
                  posOf: (uid) => {
                    const l = locate(uid);
                    return l != null ? { x: l.x, y: l.y } : null;
                  },
                  deskOf,
                  includeExtras: true,
                });
                // 生长/冻结是结算结果：黑幕固定 1 秒，恢复彩色后立刻演一次。
                // 金币可以继续飞，不再绑住黑幕或状态演出的时长。
                fx.aftermath({
                  bd: p,
                  delayMs: 1050,
                  at: at != null ? { x: at.x, y: at.y } : null,
                  posOf: (uid) => {
                    const l = locate(uid);
                    return l != null ? { x: l.x, y: l.y } : null;
                  },
                });
              } else if (p.total === 0 && p.deskCount === 0 && p.extras.length === 0) {
                // 禁运桌仍参与“是否连通”的解释，但不参与收入结算。
                const at = locate(p.uid);
                const disabledElement = p.disabledDeskElements?.[0];
                const failureText = disabledElement == null
                  ? RRef.current.connectionFailed
                  : fmt(RRef.current.disabledDeskHint, {
                      element: elementName(disabledElement, lang),
                    });
                pushHintFloat(
                  at != null ? { x: at.x, y: at.y - at.r - 6 } : null,
                  disabledElement == null ? RRef.current.hintNoDesk : failureText,
                );
                setConnectionFailure({
                  uid: p.uid,
                  token: spotTokenRef.current++,
                  text: failureText,
                });
              }
            }
            for (const ex of p.extras) {
              if (ex.kind === "protest" && ex.amount > 0) {
                const at = locate(ex.uid);
                fx.protest({
                  at: at != null ? { x: at.x, y: at.y } : null,
                  amount: ex.amount,
                  tier: tierIdxFor(ex.amount),
                });
              }
            }
          }
          if (maxTier >= 2) shakeStage(); // 橙档+:屏幕微震 2px/80ms
          if (maxTier >= 3) punchScene(); // 红光档+:镜头 punch-in 3%/220ms
        }
      } else {
        // 无新脉冲:惰性清理过期条目(有过期才 setState,避免空转重渲染)。
        setFloats((prev) => (prev.some((f) => f.until <= nowT) ? prev.filter((f) => f.until > nowT) : prev));
        setHotDesks((prev) => (prev.some((d) => d.until <= nowT) ? prev.filter((d) => d.until > nowT) : prev));
        setScoreBursts((prev) => (prev.some((item) => item.until <= nowT) ? prev.filter((item) => item.until > nowT) : prev));
      }

      // 💢 同种标记:场上与当前签(袋头)同物种的落定宠(读快照,非逐帧;
      // 内容没变不 setState)。
      const head = currentView.bagPreview[0]?.species ?? null;
      const next: SameMark[] =
        head == null
          ? []
          : bodies
              .filter((b) => b.settled && b.species === head)
              .map((b) => ({ uid: b.uid, x: b.x, y: b.y - b.r - 2 }));
      setMarks((prev) =>
        prev.length === next.length &&
        next.every((m, i) => m.uid === prev[i].uid && m.x === prev[i].x && m.y === prev[i].y)
          ? prev
          : next,
      );
      const stateByUid = new Map(currentView.bodyStates.map((state) => [state.uid, state]));
      const nextBodyStates: BodyStateMark[] = bodies.flatMap((body) => {
        const state = stateByUid.get(body.uid);
        if (state == null) return [];
        return [{
          uid: body.uid,
          x: body.x,
          y: body.y,
          r: body.r,
          frozen: state.frozen === true,
          generated: state.generated === true,
          sizeLevel: Math.max(1, state.sizeLevel ?? 1),
        }];
      });
      setBodyStateMarks((previous) => {
        const same = previous.length === nextBodyStates.length && nextBodyStates.every((item, index) => {
          const old = previous[index];
          return old?.uid === item.uid
            && old.x === item.x
            && old.y === item.y
            && old.frozen === item.frozen
            && old.generated === item.generated
            && old.sizeLevel === item.sizeLevel;
        });
        return same ? previous : nextBodyStates;
      });

      // 教学步③:首次两同粘连(仅第 1 班未触发时扫;教学班规模小,O(n²) 无压力)。
      if (!cuesRef.current.samePair) {
        const v = currentView;
        if (v.shiftIndex === 1 && !v.endless && v.phase === "shift") {
          const settled = bodies.filter((b) => b.settled);
          outer: for (let i = 0; i < settled.length; i++) {
            for (let j = i + 1; j < settled.length; j++) {
              const a = settled[i];
              const b = settled[j];
              if (a.species !== b.species) continue;
              const rr = (a.r + b.r) * 1.08; // 对齐场景 CONTACT_SLACK
              const dx = a.x - b.x;
              const dy = a.y - b.y;
              if (dx * dx + dy * dy <= rr * rr) {
                markCue("samePair");
                break outer;
              }
            }
          }
        }
      }
    }, PULSE_PUMP_MS);
    return () => {
      window.clearInterval(timer);
      for (const timeout of delayedFloatTimers) window.clearTimeout(timeout);
      delayedFloatTimers.clear();
    };
  }, [run, lang, markCue, pushHintFloat, shakeStage, punchScene]);

  const sealLine = `${R.sealText} ✕ ${R.sealText} ✕ ${R.sealText}`;
  const windDirection = run.windAx() >= 0 ? "right" : "left";
  const sceneActive = view.phase === "shift" || view.phase === "overtime";

  // 弹层出现后不再保留场景演出节点。它们都在弹层下方不可见，继续存活只会
  // 维持 CSS 动画和 200ms 清理泵，尤其会放大透明 WebView 的合成成本。
  useEffect(() => {
    if (sceneActive) return;
    setFloats((items) => (items.length === 0 ? items : []));
    setHotDesks((items) => (items.length === 0 ? items : []));
    setMarks((items) => (items.length === 0 ? items : []));
    setBodyStateMarks((items) => (items.length === 0 ? items : []));
    setScoreBursts((items) => (items.length === 0 ? items : []));
    setSpotlight(null);
    setConnectionFailure(null);
  }, [sceneActive]);

  return (
    <div ref={stageRef} className="fr-stage" onPointerDownCapture={onSpendCapture}>
      {/* 场景包壳:punch 镜头与破产去饱和都只动这层(不碰 fac-stage) */}
      <div
        ref={sceneWrapRef}
        className={`fr-scene-wrap${view.phase === "bankrupt" ? " is-doomed" : ""}`}
      >
        <FactoryScene
          save={save}
          config={config}
          onBack={onExit}
          rogue={bridge}
          paused={!sceneActive}
          spotlight={spotlight}
          connectionFailure={connectionFailure}
          coachTarget={
            firstRunDirective?.targetKey === "factoryDropZone"
              ? "factoryDropZone"
              : undefined
          }
        />
      </div>

      {view.phase === "shift" && hasWindRule(view.modifier) && (
        <FactoryWindFx direction={windDirection} />
      )}

      <RogueHud
        run={run}
        view={view}
        config={config}
        onExit={onExit}
        revenueRef={revenueRef}
        cashRef={cashRef}
      />
      {resumeNoticeSeconds != null && (
        <div className="fr-resume-notice" role="status" aria-live="polite">
          <span aria-hidden="true">⏸</span>
          {fmt(R.runtimePaused, { seconds: resumeNoticeSeconds })}
        </div>
      )}
      {view.phase === "hiring" && (
        <RogueHiring
          run={run}
          view={view}
          config={config}
          firstRunGuide={firstRunGuide}
        />
      )}

      {/* 演出层:接桌高亮 + 💢 标记 + 五档脉冲浮字(全部 pointer-events:none) */}
      <div className="fr-float-layer" aria-hidden="true">
        {scoreBursts.map((burst) => (
          <div
            key={burst.id}
            className="fr-score-burst"
            style={{ left: burst.x, top: burst.y }}
          >
            {burst.cards.length > 0 && (
              <div className="fr-score-burst-cards">
                {burst.cards.map((card) => (
                  <span className="fr-score-card-part" key={card.id}>
                    <RogueCardIcon id={card.id} />
                    <b>+{formatCount(card.amount)}</b>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {hotDesks.map((d) => (
          <div
            key={d.id}
            className="fr-desk-hot"
            style={
              {
                left: d.x - 4,
                top: d.top - 6,
                width: d.w + 8,
                height: 28,
                "--fr-el": config.elements[d.element]?.color ?? "#FFD93B",
              } as CSSProperties
            }
          />
        ))}
        {marks.map((m) => (
          <span key={m.uid} className="fr-mark" style={{ left: m.x, top: m.y }}>
            💢
          </span>
        ))}
        {bodyStateMarks.map((mark) => (
          <div
            key={mark.uid}
            ref={(element) => {
              if (element == null) bodyStateElementRefs.current.delete(mark.uid);
              else bodyStateElementRefs.current.set(mark.uid, element);
            }}
            className={[
              "fr-body-state",
              mark.frozen ? "is-frozen" : "",
              mark.generated ? "is-generated" : "",
            ].filter(Boolean).join(" ")}
            style={{
              left: mark.x,
              top: mark.y,
              width: Math.max(46, mark.r * 2.35),
              height: Math.max(50, mark.r * 2.55),
            }}
          >
            {mark.sizeLevel > 1 && <span className="fr-size-badge">体型 {mark.sizeLevel}</span>}
          </div>
        ))}
        {floats.map((f) => (
          <span
            key={f.id}
            className={`fr-float ${f.cls}${f.protest ? " is-protest" : ""}`}
            style={
              {
                ...(f.x != null && f.y != null ? { left: f.x, top: f.y } : { left: "50%", top: "40%" }),
                ...(f.dir != null ? { "--fr-dx": `${f.dir * 46}px` } : null),
              } as React.CSSProperties
            }
          >
            {f.label != null && <small>{f.label}</small>}
            {f.text}
          </span>
        ))}
      </div>

      {/* P3 粒子/飞行物引擎(命令式 DOM,对象池;?frdebug=1 暴露 activeParticles) */}
      <RoguePulseFx
        ref={fxRef}
        config={config}
        dismissText={R.dismissStampText}
        getRevenuePoint={getRevenuePoint}
        getCashPoint={getCashPoint}
        onCoinHit={onCoinHit}
        onCashHit={onCashHit}
      />

      {/* P3 横幅仪式:下班铃/检查日公告/数量级里程碑/首班教学气泡 */}
      <RogueBanners
        runKey={run}
        view={view}
        cues={cues}
        showFirstShiftTutorial={
          !firstRunGuide && save.factoryTutorial?.status !== "completed"
        }
        overtimeReady={overtimeReady}
        onCelebrate={celebrate}
        onOvertimeReady={unlockOvertime}
      />

      {/* 破产「查封」封条(去饱和由 .fr-scene-wrap.is-doomed 做;只贴实物条,无暗幕) */}
      <div className="fr-reward-fx-stack" aria-live="polite" aria-atomic="true">
        {rewardFx.map((effect) => (
          <div key={effect.id} className={`fr-reward-fx is-${effect.material}`}>
            <span className="fr-reward-fx-icon" aria-hidden="true">
              {FACTORY_MATERIAL_ICONS[effect.material] ?? "🎁"}
            </span>
            <strong>
              {T.bk.training.materialNames[effect.material] ?? effect.material}{" "}
              <small>×{effect.count}</small>
            </strong>
          </div>
        ))}
      </div>

      {view.phase === "bankrupt" && (
        <div className="fr-seal-layer" aria-hidden="true">
          <div className="fr-seal fr-seal-a">{sealLine}</div>
          <div className="fr-seal fr-seal-b">{sealLine}</div>
        </div>
      )}

      {view.phase === "shop" && view.shop != null && (
        <RogueShop
          run={run}
          view={view}
          config={config}
          firstRunGuide={firstRunGuide}
        />
      )}
      {view.phase === "settlement" && view.settlement != null && (
        <RogueSettlement
          run={run}
          view={view}
          config={config}
          save={save}
          firstRunGuide={firstRunGuide}
        />
      )}
      {(view.phase === "summary" || view.phase === "bankrupt") && (
        <RogueSummary
          run={run}
          view={view}
          config={config}
          rewards={runRewards}
          todayClaimedLevel={save.daily.factoryClaimedLevel ?? 0}
          madeRevenueRecord={madeRevenueRecord}
          leaderboardStatus={leaderboardStatus}
          onRetry={onRetry}
          onExit={onExit}
          onLeaderboard={onLeaderboard}
        />
      )}
      {(firstRunGuide || strikeWarningOpen) && (
        <FactoryFirstRunGuide
          directive={firstRunDirective}
          onAction={acknowledgeStrikeWarning}
        />
      )}
    </div>
  );
}
