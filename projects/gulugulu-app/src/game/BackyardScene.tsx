import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  GameConfig,
  GameSave,
  PetInstance,
  PetState,
  SteamMarketPrice,
  SteamStatus,
  TokenStats,
} from "../types";
import { fmt, localizeGameMessage, speciesDisplayName, type Language } from "../i18n";
import { useT } from "../useT";
import type { CelebrationEmitPayload } from "../app/hooks/useFxOverlay";
import { getCustomSpeciesEntry } from "../sprites/customSpecies";
import { isTauri } from "../tauri";
import { previewPanel, previewTimeOfDay } from "../preview/shotParams";
import { SvgSprite } from "../sprites/SvgSprite";
import { CoinBurst } from "../sprites/parts/vfx";
import { WorkBurst, resolveWorkFx } from "../sprites/parts/workFx";
import { WORLD_SPAN, abs } from "./backyardShared";
import { FarDecor, MidDecor, NearDecor } from "./BackyardDecor";
import { BackyardSky } from "./BackyardSky";
import { BackyardNightLights } from "./BackyardNightLights";
import { BackyardAmbient } from "./BackyardAmbient";
import { computeDayPhase, gradeToFilter, hourFromEpochSeconds } from "./dayNight";
import { DexCell, DexRecipeRow } from "./BackyardDex";
import { BackyardDexDetail } from "./BackyardDexDetail";
import { BackyardDexSkinDialog } from "./BackyardDexSkinDialog";
import { BackyardHatcheryPits } from "./BackyardHatcheryPits";
import { CelebrationCinematic, celebrationDurationFor, celebrationFresh, type CelebrationPulse } from "./CelebrationCinematic";
import { FusionRitual, type FusionRitualData, type FusionRitualSprite } from "./FusionRitual";
import { PitEnergyFx, PIT_XS, type PitFxKind } from "./PitEnergyFx";
import { YardUpgradeFx } from "./YardUpgradeFx";
import { BackyardShopPopup } from "./BackyardShopPopup";
import { BackyardMuseumPanel } from "./BackyardMuseumPanel";
import { BackyardMarketPanel } from "./BackyardMarketPanel";
import { BackyardNoticeBoard } from "./BackyardNoticeBoard";
import { BackyardNearPetActions } from "./BackyardNearPetActions";
import {
  equivalentEggPrice,
  equivalentEggPriceForInfo,
  expToNext,
  fusionFeeFor,
  hatcherySlotCount,
  isMaxLevel,
  maxLevelForTier,
  yardCapacityFor,
} from "./config";
import { getGameBridge } from "./bridge";
import { formatCount } from "./format";
import { assignPetStations, type StationSlot } from "./stationAssign";
import { EnergyBar, ExpBar } from "./EnergyBar";
import { FlightLayer, foodFlightFor, keycapFlightsFor, useFlights } from "./FlightLayer";
import {
  buildPokedexModel,
  dexLocatorForCodename,
  FIXED_DEX_TOTAL,
  museumThumbs,
  recipeKeyForCodename,
  type DexLocator,
  type DexSlot,
} from "./pokedexData";
import { useAgentConnections } from "./useAgentConnections";
import { useNowSeconds } from "./useGame";
import { useCharSpeech } from "./useCharSpeech";
import { useBackyardWorkFx } from "./useBackyardWorkFx";
import { useBackyardMotion } from "./useBackyardMotion";
import "./backyard.css";

// ---------------------------------------------------------------------------
// 世界常量（与设计稿一致）：近景 4400，角色活动区 [70, 4330]，速度 230px/s。
// ---------------------------------------------------------------------------

/** 博物馆速览弹板可容缩略图格数（超出末位显示 +x，不滚动）。 */
const DEX_SUMMARY_CELLS = 12;
const CHAR_SIZE = 120;
const CHAR_BOTTOM = 138;

/** 融合就地仪式：无槽位（蛋入库存）时，蛋朝孵化区中心方向飞。 */
const HATCHERY_CENTER_X = 220;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** 打工粒子满屏飘散：WorkBurst 的 screen 模式在 256×256 的 viewBox 内按像素算飞散，
 *  必须让这层 SVG 以 1:1（256px 盒）渲染才能真正满屏飘出——若跟随宠物小盒(inset:0)
 *  被压到宠物尺寸，256 单位会被缩到 ~84px，飞散半径随之塌成 1/3。这里给一个固定
 *  256px 的 1:1 盒，并把它平移到发射点(工具位)对齐宠物身上的工具，效果与全屏 fx
 *  子窗口一致（见 FxOverlay 的 .fx-overlay-burst）。size = 该宠物小盒边长。 */
function workScatterStyle(species: string, size: number): CSSProperties {
  const emitter = resolveWorkFx(species)?.emitter ?? { x: 128, y: 128 };
  const fit = size / 256;
  return {
    left: `${(emitter.x * (fit - 1)).toFixed(1)}px`,
    top: `${(emitter.y * (fit - 1)).toFixed(1)}px`,
  };
}
/** 预览截图 rig:?panel= 把出生点挪到对应 POI(接近感应自动开板;仅 !isTauri)。 */
const PANEL_SPAWN_X: Record<string, number> = {
  // 商店弹板世界锚定(左位 694..998,BackyardShopPopup left:694/1312,宽 304):
  // 1080p 视口半宽 ≈ 497.8 世界px → 主角 ∈ [1150,1191] 才能弹板+商店双全,取 1180。
  shop: 1180,
  museum: 3310,
  market: 3970,
  notice: 2445,
  pits: 220,
};
const SPAWN_X = ((): number => {
  const panel = previewPanel();
  return (panel && PANEL_SPAWN_X[panel]) || 440;
})();

/** 舞台设计高（世界坐标系的画布高度）。窗口高度变化 = 整体等比缩放；
 *  窗口宽度变化 = 只扩展可见画卷（stageW = 视口宽 / 缩放）。 */
const STAGE_H = 560;

/** 交易市场行情榜最多展示的伙伴数（列表可滚动，左右分栏后容得下更多）。 */
const MARKET_TOP_LIMIT = 12;

/** 站在草地上的驻留点（脚底约在草皮线上，不悬空） */
const GROUND_SPOTS: Array<{ x: number; bottom: number; size: number; float?: boolean }> = [
  { x: 1760, bottom: 142, size: 84 },
  { x: 3236, bottom: 142, size: 92 },
  { x: 4249, bottom: 142, size: 98 },
  { x: 700, bottom: 142, size: 88 },
  { x: 2680, bottom: 142, size: 88 },
  { x: 4480, bottom: 142, size: 80 },
  { x: 4670, bottom: 142, size: 84 },
];

/** 池塘上空的漂浮位：只分配给水系伙伴，其他系一律落地 */
const POND_SPOT = { x: 2058, bottom: 196, size: 96, float: true };

/** 站位铺满：前 7 个用手摆的漂亮驻留点，之后沿世界横向铺开，保证再多宠物也全部
 *  可见（后院最多可养 50 只）。避开各建筑正面，逐轮收窄间距补满空地。生成一次、
 *  按「宠物在存档中的稳定序号」取用——序号不随当前陪伴变化，切换陪伴时其余伙伴
 *  的站位保持不动。 */
function buildGroundStations(): Array<{ x: number; bottom: number; size: number }> {
  const out = GROUND_SPOTS.map((spot) => ({ x: spot.x, bottom: spot.bottom, size: spot.size }));
  const xs = out.map((spot) => spot.x);
  const buildingBands: Array<[number, number]> = [
    [1000, 1310], // 商店
    [2230, 2600], // 公告板（板体 2240..2588，含少许留白）
    [3155, 3465], // 图鉴馆
    [3875, 4185], // 交易市场
  ];
  const clearOfBuildings = (x: number) => !buildingBands.some(([a, b]) => x >= a && x <= b);
  for (const minGap of [150, 112, 86]) {
    for (let x = 520; x <= 5720 && out.length < 58; x += 84) {
      if (!clearOfBuildings(x)) continue;
      if (xs.some((px) => Math.abs(px - x) < minGap)) continue;
      out.push({ x, bottom: 142, size: 80 + (out.length % 3) * 7 });
      xs.push(x);
    }
  }
  return out;
}

const GROUND_STATIONS = buildGroundStations();

type StationSpot = { x: number; bottom: number; size: number; float?: boolean };

/** 站位（pond / ground[n]，持久化分配见 stationAssign.ts）→ 具体落点。
 *  地面序号越界时兜底到最后一个铺满位。 */
function spotForStationSlot(slot: StationSlot | undefined): StationSpot | null {
  if (!slot) return null;
  if ("pond" in slot) return POND_SPOT;
  return GROUND_STATIONS[slot.ground] ?? GROUND_STATIONS[GROUND_STATIONS.length - 1];
}

/** 闲时踱步的单步位移与离站位的最大偏移（左右各不超过 STROLL_RANGE）。 */
const STROLL_STEP = 42;
const STROLL_RANGE = 64;

/** 原地小动作可选状态（随机挑一个演一下）。 */
const IDLE_ACTIONS: PetState[] = ["success", "fed"];

/** 每只驻留伙伴的闲时行为：静止 / 原地动作 / 左右踱步，外加当前离站位偏移与朝向。 */
type PetBehavior = { kind: "idle" | "action" | "move"; offset: number; facing: number; action: PetState };

/** 首次进入后院的移动引导只出现一次 */
const GUIDE_SEEN_KEY = "gulugulu.backyardGuideSeen";
const GUIDE_AUTO_HIDE_MS = 12_000;

/** 主角在场景里会原样演出的宠物状态（其余一律回落 idle；行走优先） */
const SCENE_ACTION_STATES: ReadonlySet<PetState> = new Set([
  "fed",
  "success",
  "error",
  "thinking",
  "working",
  "laboring",
]);

// ---------------------------------------------------------------------------
// 场景组件
// ---------------------------------------------------------------------------

/** 庆典脉冲 → 蛋坑就地特效类型。 */
function pitFxKindFor(pulse: CelebrationPulse): PitFxKind {
  if (pulse.phase === "fusionCommit") return pulse.mode === "ai" ? "commit-ai" : "commit-recipe";
  return pulse.branch === "fallback" ? "fizzle" : "crack";
}

export type BackyardSceneProps = {
  save: GameSave;
  config: GameConfig;
  busy: boolean;
  statusText: string;
  tokenStats: TokenStats;
  /** 主舞台的宠物状态：fed/success/thinking… 会映射到场景主角身上播放 */
  petState: PetState;
  /** 正在播放的进食收益（App 的喂食队列出队一条），跟随主角头顶飘字 */
  fedPulse: { id: number; exp: number; level: number } | null;
  /** 一次性庆典脉冲（孵化揭晓 / 融合达成）：据 id 变化播放一次电影化揭晓 */
  celebration: CelebrationPulse | null;
  /** 台词系统（与主舞台共用）：在后院改为主角头顶气泡 */
  speechLine: string;
  speechVisible: boolean;
  /** 全局提示：后院有主角时由头顶气泡代言 */
  toast: { id: number; text: string } | null;
  /** Steam 集成状态（连接点/待发放/待认领）；null = 尚未取到。 */
  steamStatus: SteamStatus | null;
  /** 交易市场入口（Steam） */
  onOpenMarket: () => void;
  /** 手动触发一轮 Steam 同步。 */
  onSteamSync: () => void;
  /** 导入我的宠物：读整份 Steam 库存填后院空位（高阶优先）。 */
  onImportPets: () => void;
  onWalkingChange: (walking: boolean) => void;
  onBack: () => void;
  onWorkPet: (petId: string, at?: { x: number; y: number }) => void;
  /** 点击宠物打工时把工具粒子发到全屏覆盖层（越过后院停靠窄条窗、满屏飘散）。
   *  返回 false 表示未送达（预览/覆盖层未就绪），由场景回退窗口内粒子。 */
  emitWorkBurst?: (
    species: string,
    rect: DOMRect,
    tier: number,
    seed: number,
    boom: boolean,
  ) => Promise<boolean>;
  /** 孵化庆典整幕交给全屏覆盖层居中重演（越过后院窄条窗，神光/粒子不被上沿截断）。
   *  返回 false（预览/覆盖层未就绪）时场景回退窗口内 CelebrationCinematic。 */
  emitCelebration?: (payload: CelebrationEmitPayload) => Promise<boolean>;
  /** 后院升级光效交给全屏覆盖层；返回 false 回退窗口内 YardUpgradeFx。 */
  emitYardFx?: (level: number, cap: number, lang: Language) => Promise<boolean>;
  onCollectEgg: (eggId: string) => void;
  /** #2 点孵化中的蛋 → −1s 催蛋。 */
  onPokeEgg: (eggId: string) => void;
  onPlaceEgg: (eggId: string, slot: number) => void;
  onBuyEgg: (element: string, tier: number) => void;
  onUpgradeHatchery: () => void;
  onUpgradeYard: () => void;
  onUpgradeShop: () => void;
  onFuse: (idA: string, idB: string) => void;
  onFollow: (petId: string) => void;
  onRelease: (petId: string) => void;
  onToast: (message: string) => void;
  /** 新手强引导（OnboardingCoach.md）：教练文字复用角色气泡；移动/近宠回传 resolver。 */
  coachLabel?: string | null;
  /** 进后院时的一次性红点点题（fuse/collectEgg/buyEgg）；null=无待办或引导期让位。 */
  entryGuideKind?: "fuse" | "collectEgg" | "buyEgg" | null;
  onCoachMoved?: () => void;
  onCoachYard?: (state: { nearShop: boolean; nearPetId: string | null }) => void;
};

export function BackyardScene({
  save,
  config,
  busy,
  statusText,
  tokenStats,
  petState,
  fedPulse,
  celebration,
  speechLine,
  speechVisible,
  toast,
  steamStatus,
  onOpenMarket,
  onSteamSync,
  onImportPets,
  onWalkingChange,
  onBack,
  onWorkPet,
  emitWorkBurst,
  emitCelebration,
  emitYardFx,
  onCollectEgg,
  onPokeEgg,
  onPlaceEgg,
  onBuyEgg,
  onUpgradeHatchery,
  onUpgradeYard,
  onUpgradeShop,
  onFuse,
  onFollow,
  onRelease,
  onToast,
  coachLabel = null,
  entryGuideKind = null,
  onCoachMoved,
  onCoachYard,
}: BackyardSceneProps) {
  const { lang, T } = useT();
  const bk = T.bk;
  /** 物种显示名（zh 直取 nameZh，可指定与原文案一致的兜底；en 走目录名规则）。 */
  const speciesName = (code: string, zhFallback = ""): string => {
    const nameZh = config.species[code]?.nameZh;
    const nameEn = config.species[code]?.nameEn;
    return lang === "zh" ? nameZh ?? zhFallback : speciesDisplayName(code, lang, nameZh, nameEn);
  };
  const now = useNowSeconds(true);

  // 真实时间昼夜相位（预览可用 ?tod= 覆盖）：驱动实景调色 + 天空天体 + 夜灯 + 氛围动态。
  // now 每秒更新 → 每秒重算（纯函数，值变化极小、肉眼平滑）。
  const dayPhase = useMemo(() => computeDayPhase(previewTimeOfDay() ?? hourFromEpochSeconds(now)), [now]);

  // 进后院一次性点题：有红点待办时主角用一句幽默话指引（含去找谁融合）。引导期由
  // App 传 entryGuideKind=null 让位；只在进场评估一次，融合完/收蛋后交由红点自然消失。
  const [entryHint, setEntryHint] = useState<string | null>(null);
  useEffect(() => {
    if (!entryGuideKind) return;
    let text: string | null = null;
    if (entryGuideKind === "fuse") {
      const partner =
        activePet != null
          ? save.pets.find(
              (pet) =>
                pet.id !== activePet.id && pet.tier === activePet.tier && isMaxLevel(config, pet),
            )
          : undefined;
      text = fmt(bk.entryGuide.fuse, {
        name: partner ? speciesName(partner.species, bk.hint.genericName) : bk.hint.genericName,
      });
    } else if (entryGuideKind === "collectEgg") {
      text = bk.entryGuide.collectEgg;
    } else if (entryGuideKind === "buyEgg") {
      text = bk.entryGuide.buyEgg;
    }
    setEntryHint(text);
    const timer = window.setTimeout(() => setEntryHint(null), 9000);
    return () => window.clearTimeout(timer);
    // 进场一次性评估——不随后续状态实时刷新（依赖故意留空）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 开局探测 Claude / Codex 真实登录态；公告板据此给「连接 / 断开」按钮。
  const {
    connections: agentConnections,
    connecting: agentConnecting,
    disconnecting: agentDisconnecting,
    connect: onConnectAgent,
    disconnect: onDisconnectAgent,
  } = useAgentConnections();

  /** 商店当前翻到的蛋阶（默认最高解锁阶；升级后自动跳到新最高阶）。 */
  const [shopTier, setShopTier] = useState(save.shopLevel ?? 1);

  // 商店升级后自动翻到新的最高解锁阶（"默认显示最高阶"，EconomyScaling.md §6.3）。
  useEffect(() => {
    setShopTier(save.shopLevel ?? 1);
  }, [save.shopLevel]);
  const [dexOpen, setDexOpen] = useState(() => previewPanel() === "dex");
  // 图鉴弹窗栈（SkinWorkshop.md）：物种详情 → 导入/分享对话框 → 浮层内 toast。
  const [dexDetail, setDexDetail] = useState<DexLocator | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [shareFallbackText, setShareFallbackText] = useState<string | null>(null);
  // 后院 toast 走主角头顶气泡（z=7）会被图鉴浮层（z=20）遮住 → 图鉴内操作反馈
  // 用独立的浮层 toast（z=70，仿 .game-toast）。
  const [dexToast, setDexToast] = useState<{ id: number; text: string } | null>(null);
  const showDexToast = useCallback((text: string) => setDexToast({ id: Date.now(), text }), []);
  useEffect(() => {
    if (!dexToast) return;
    const timer = window.setTimeout(() => setDexToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [dexToast]);
  // 图鉴关闭时整栈复位。
  useEffect(() => {
    if (!dexOpen) {
      setDexDetail(null);
      setImportOpen(false);
      setImportError(null);
      setShareFallbackText(null);
    }
  }, [dexOpen]);
  const [confirmRelease, setConfirmRelease] = useState(false);
  // 闲时行为（每只独立）：大部分时间安静待机，偶尔演个原地动作或左右踱两步。
  const [behaviors, setBehaviors] = useState<Record<string, PetBehavior>>({});
  // 首次进入的移动引导（一次性）
  const [showGuide, setShowGuide] = useState(() => {
    try {
      return window.localStorage.getItem(GUIDE_SEEN_KEY) == null;
    } catch {
      return true;
    }
  });
  // 键帽雨 + 能量饭团（InteractionEconomy §6.3）：后院场景自订阅 game://keys，
  // 键帽飞向主角；精力补丁触发条脉冲 + 短暂显示精力条（存档更新由 App 层负责）。
  const { flights: heroFlights, spawnFlights: spawnHeroFlights, removeFlight: removeHeroFlight } = useFlights();
  const [energyPulse, setEnergyPulse] = useState(0);
  // 精力条不常态显示（§6.1）：仅在点击某宠 / 该宠精力入账后短暂显示 ~2.6s。
  const [revealPetId, setRevealPetId] = useState<string | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const revealEnergy = useCallback((petId: string) => {
    setRevealPetId(petId);
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = window.setTimeout(() => setRevealPetId(null), 2600);
  }, []);
  const activePetIdRef = useRef<string | null>(save.activePetId ?? null);
  activePetIdRef.current = save.activePetId ?? null;
  useEffect(() => {
    const bridge = getGameBridge();
    const disposeKeys = bridge.onKeyFx((event) => {
      if (document.hidden) return;
      spawnHeroFlights(keycapFlightsFor(event.labels, 88, 118));
    });
    const disposePatch = bridge.onStaminaPatch((patch) => {
      if (patch.perPet.some((item) => item.staminaGained > 0)) {
        setEnergyPulse((tick) => tick + 1);
        // 键盘喂陪伴宠（2026-07-21 起精力只来自键盘+自然恢复）→ 短暂显示主宠精力条。
        if (activePetIdRef.current) revealEnergy(activePetIdRef.current);
      }
    });
    return () => {
      disposeKeys();
      disposePatch();
    };
  }, [revealEnergy, spawnHeroFlights]);

  // 能量饭团：Token 餐由 App 通过 fedPulse 下发，场景放飞行到主角嘴部。
  const fedFlightIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (fedPulse && fedPulse.id !== fedFlightIdRef.current) {
      fedFlightIdRef.current = fedPulse.id;
      spawnHeroFlights([foodFlightFor(fedPulse.level)]);
    }
  }, [fedPulse, spawnHeroFlights]);

  // 庆典脉冲：据 id 变化播放一次电影化揭晓；到点自动清除（点击揭晓卡可提前跳过）。
  // 陈旧脉冲靠 celebrationFresh（脉冲自带触发时刻）拦截：进入后院时把小宠物窗孵化
  // 残留的过期脉冲挡掉；而**仍在播放窗口内**的脉冲在重挂载（HMR / 渲染树崩溃恢复 /
  // 快速进出后院）后照常起演——seen-ref 若初始化成挂载时已存在的 id，会把融合提交
  // 瞬间的那场演出整场吞掉。
  const celebrationSeenIdRef = useRef<number | null>(null);
  const [activeCelebration, setActiveCelebration] = useState<CelebrationPulse | null>(null);
  // 孵化揭晓这一幕（神光/白闪/粒子/主角）是否已交给全屏覆盖层重演——是则不再窗口内
  // 渲染 CelebrationCinematic（避免与覆盖层重影，也彻底躲开后院窄条窗上沿硬裁）。
  // 融合脉冲的顶部横幅仍留窗口内（贴着就地仪式，不该跑到屏幕顶），故只搬「孵化」幕。
  const [celebrationViaOverlay, setCelebrationViaOverlay] = useState(false);
  const celebrationTimerRef = useRef<number | null>(null);

  // ── 融合就地仪式（世界锚定，在两亲当时站位起舞）：状态 + 两亲站位快照 + 相机延后 ──
  const [fusionRitual, setFusionRitual] = useState<FusionRitualData | null>(null);
  // 仪式期间藏主角（此刻已回落成新陪伴，会正好站在亲代 A 的旧位）——由幽灵 A 代演。
  const [charHidden, setCharHidden] = useState(false);
  // 「点融合」瞬间抓下的两亲站位快照（含物种），庆典脉冲抵达时据此就地起演。
  const fusionOriginRef = useRef<{ a: FusionRitualSprite; b: FusionRitualSprite } | null>(null);
  // 同步标志：供下面「消耗回中」effect 判断此刻是否该把相机回中延后到仪式结束。
  const fusionRitualActiveRef = useRef(false);
  const pendingRecenterRef = useRef<number | null>(null); // 延后的相机回中目标世界 X
  const fusionRitualTimerRef = useRef<number | null>(null);
  const fusionRitualSeenIdRef = useRef<number | null>(null); // 陈旧脉冲同样由 celebrationFresh 拦截
  const fusionRitualEndRef = useRef<() => void>(() => {}); // 迟绑真正的 endFusionRitual（定义在下方）

  // ── 后院升级庆典：save.yardLevel 跃升 → 播放一次屏幕级「光效」反馈（.yup-*）──
  const YARD_UPGRADE_FX_MS = 1600; // 与 .yup-root 生命周期一致
  const [yardUpgradeFx, setYardUpgradeFx] = useState<{ id: number; level: number; cap: number } | null>(null);
  const [yardFxViaOverlay, setYardFxViaOverlay] = useState(false);
  const yardUpgradeFxIdRef = useRef(0);
  const yardUpgradeTimerRef = useRef<number | null>(null);
  const prevYardLevelRef = useRef(save.yardLevel);

  const dismissCelebration = useCallback(() => {
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = null;
    setActiveCelebration(null);
    fusionRitualEndRef.current(); // 跳过时一并收束就地仪式（复位主角 + 相机回中）
  }, []);
  useEffect(() => {
    if (!celebration || celebration.id === celebrationSeenIdRef.current) return;
    celebrationSeenIdRef.current = celebration.id;
    if (!celebrationFresh(celebration)) return; // 过期脉冲（重挂载残留）不重播
    setActiveCelebration(celebration); // 替换语义：新脉冲顶替旧的（也驱动蛋坑就地特效/融合仪式）
    // 「孵化」揭晓幕整幕交给全屏覆盖层居中重演（越过后院窄条窗）；先按能力乐观标记以免
    // 窗口内闪一下，emit 落定后按实际送达校正（未送达=预览/覆盖层未就绪→回退窗口内）。
    const toOverlay = celebration.phase === "hatch" && !!emitCelebration && isTauri();
    setCelebrationViaOverlay(toOverlay);
    if (toOverlay && emitCelebration) {
      const customEntry = celebration.species ? getCustomSpeciesEntry(celebration.species) ?? null : null;
      void emitCelebration({ pulse: celebration, config, lang, customEntry }).then((sent) => {
        setCelebrationViaOverlay(sent);
      });
    }
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = window.setTimeout(
      () => setActiveCelebration(null),
      celebrationDurationFor(celebration),
    );
  }, [celebration, emitCelebration, config, lang]);
  // 离开后院卸载时清表，避免「卸载后 setState」。
  useEffect(
    () => () => {
      if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
      if (fusionRitualTimerRef.current) window.clearTimeout(fusionRitualTimerRef.current);
      if (yardUpgradeTimerRef.current) window.clearTimeout(yardUpgradeTimerRef.current);
    },
    [],
  );

  // 后院升级检测：yardLevel 增大即播放一次光效（点击升级木牌成功后 save 刷新触发；
  // 也覆盖 debug 等其它升级路径）。只在 yardLevel 变化时评估，容量取当前 config 快照。
  useEffect(() => {
    if (save.yardLevel > prevYardLevelRef.current) {
      const id = yardUpgradeFxIdRef.current + 1;
      yardUpgradeFxIdRef.current = id;
      const level = save.yardLevel;
      const cap = yardCapacityFor(config, level);
      setYardUpgradeFx({ id, level, cap });
      // 升级光效（150vmax 神光扇）优先满屏覆盖层，未就绪 / 预览回退窗口内。
      const toOverlay = !!emitYardFx && isTauri();
      setYardFxViaOverlay(toOverlay);
      if (toOverlay && emitYardFx) {
        void emitYardFx(level, cap, lang).then((sent) => setYardFxViaOverlay(sent));
      }
      if (yardUpgradeTimerRef.current) window.clearTimeout(yardUpgradeTimerRef.current);
      yardUpgradeTimerRef.current = window.setTimeout(() => {
        setYardUpgradeFx((cur) => (cur?.id === id ? null : cur));
      }, YARD_UPGRADE_FX_MS);
    }
    prevYardLevelRef.current = save.yardLevel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.yardLevel]);

  const activePet = save.pets.find((pet) => pet.id === save.activePetId) ?? null;
  // 驻留点分配（持久化，本次后院会话内稳定）：每只宠物一进场就绑定一个固定站位，
  // 离场（放生 / 融合消耗）只释放它自己那一格，绝不牵动其他伙伴——放生不再触发整体
  // 重排、也不会有伙伴滑到刚空出的坑位。新宠物取当前最低空位；水系首只优先占池塘漂浮
  // 位。首帧布局与旧的「按存档序号取 GROUND_STATIONS[index]」完全一致，只是之后不再
  // 随成员增减而 densify。当前陪伴=主角，虽分到站位但不落座（该格留空，切换陪伴时其余
  // 伙伴保持不动）。
  const stationAssignRef = useRef<Map<string, StationSlot>>(new Map());
  const placedPets = useMemo(() => {
    // 就地更新持久化分配（离场释放、新宠补位；纯逻辑见 stationAssign.ts）。
    assignPetStations(
      stationAssignRef.current,
      save.pets,
      (species) => config.species[species]?.elements?.[0] === "water",
    );
    // 落座：当前陪伴=主角不占驻留点（其格留空）；其余按各自固定站位落座。
    const result: Array<{ pet: PetInstance; spot: StationSpot }> = [];
    for (const pet of save.pets) {
      if (pet.id === save.activePetId) continue;
      const spot = spotForStationSlot(stationAssignRef.current.get(pet.id));
      if (spot) result.push({ pet, spot });
    }
    return result;
  }, [config, save.pets, save.activePetId]);

  // rAF 循环 / 靠近检测所需的驻留伙伴快照（闲时调度与头顶气泡也读它）。
  const placedPetsRef = useRef(placedPets);
  const guideSeenRef = useRef(false);

  useEffect(() => {
    placedPetsRef.current = placedPets;
  }, [placedPets]);

  // 闲时行为调度（每只独立循环）：≈60% 静止 / 20% 原地动作 / 20% 左右踱步。三种
  // 时长相近（~2–2.9s），故「命中概率 ≈ 时间占比」。力竭中的伙伴只趴着不动，并缓缓
  // 归位到站位。踱步在站位左右 STROLL_RANGE 内小步游走（left 过渡由 CSS 平滑）。
  const placedIdsKey = placedPets.map((item) => item.pet.id).join(",");
  useEffect(() => {
    const ids = placedPets.map((item) => item.pet.id);
    if (ids.length === 0) return;
    const timers: Record<string, number> = {};
    const roll = (id: string) => {
      setBehaviors((prev) => {
        const cur = prev[id] ?? { kind: "idle", offset: 0, facing: 1, action: "success" as PetState };
        const exhausted = placedPetsRef.current.find((item) => item.pet.id === id)?.pet.exhausted;
        let next: PetBehavior;
        if (exhausted) {
          next = { kind: "idle", offset: 0, facing: cur.facing, action: cur.action };
        } else {
          const r = Math.random();
          if (r < 0.6) {
            next = { kind: "idle", offset: cur.offset, facing: cur.facing, action: cur.action };
          } else if (r < 0.8) {
            next = {
              kind: "action",
              offset: cur.offset,
              facing: cur.facing,
              action: IDLE_ACTIONS[Math.floor(Math.random() * IDLE_ACTIONS.length)],
            };
          } else {
            const dir = Math.random() < 0.5 ? -1 : 1;
            const offset = Math.max(-STROLL_RANGE, Math.min(STROLL_RANGE, cur.offset + dir * STROLL_STEP));
            next = {
              kind: "move",
              offset,
              facing: offset === cur.offset ? cur.facing : offset > cur.offset ? 1 : -1,
              action: cur.action,
            };
          }
        }
        return { ...prev, [id]: next };
      });
      timers[id] = window.setTimeout(() => roll(id), 2000 + Math.random() * 900);
    };
    // 错峰起步，避免所有伙伴同拍换动作。
    ids.forEach((id) => {
      timers[id] = window.setTimeout(() => roll(id), Math.random() * 1600);
    });
    return () => {
      for (const timer of Object.values(timers)) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedIdsKey]);

  const dismissGuide = () => {
    if (guideSeenRef.current) return;
    guideSeenRef.current = true;
    try {
      window.localStorage.setItem(GUIDE_SEEN_KEY, "1");
    } catch {
      // localStorage 不可用时引导只在本次会话隐藏
    }
    setShowGuide(false);
  };
  const dismissGuideRef = useRef(dismissGuide);
  dismissGuideRef.current = dismissGuide;

  // 引导超时自动收起
  useEffect(() => {
    if (!showGuide) return;
    const timer = window.setTimeout(() => dismissGuideRef.current(), GUIDE_AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [showGuide]);

  // 图鉴打开时 Esc 先按弹窗栈逐层收（捕获阶段拦截，避免 App 的 Esc 直接退出后院）：
  // 导入/分享对话框 → 物种详情弹窗 → 图鉴本体。
  useEffect(() => {
    if (!dexOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      if (importOpen) {
        if (!importBusy) {
          setImportOpen(false);
          setImportError(null);
        }
      } else if (shareFallbackText != null) {
        setShareFallbackText(null);
      } else if (dexDetail != null) {
        setDexDetail(null);
      } else {
        setDexOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [dexOpen, importOpen, importBusy, shareFallbackText, dexDetail]);

  // rAF 运动循环 / 相机 / 视差 / 键盘移动 / 点击寻路 / 视口缩放跟踪。
  const {
    rootRef,
    farRef,
    midRef,
    nearRef,
    charRef,
    charFaceRef,
    walking,
    shopOpen,
    museumOpen,
    marketOpen,
    poiSides,
    nearPetId,
    walkToPointer,
    centerOnWorldX,
    readCharX,
    stageW,
    viewScale,
  } = useBackyardMotion({
    onWalkingChange,
    placedPetsRef,
    dismissGuide,
    dismissGuideRef,
    charSize: CHAR_SIZE,
    spawnX: SPAWN_X,
    stageH: STAGE_H,
  });

  useEffect(() => {
    setConfirmRelease(false);
  }, [nearPetId]);

  // 融合会消耗掉当前陪伴（onFuse 传的第一个 id 就是 activePet.id），后端把陪伴回落到
  // 剩余首只。这不是玩家主动「陪伴」某只，若沿用主角当前所站位置，会看起来像凭空把
  // 一只远处的宠物拽到脚下。改为把视角定位到新陪伴原本的站位（信号：上一任陪伴已从
  // save.pets 中消失＝被消耗）。放生不会触发：放生的是驻留伙伴，不改 activePetId；主动
  // 切换陪伴也不触发：上一任陪伴仍在场。
  const prevActiveIdRef = useRef<string | null>(save.activePetId ?? null);
  useEffect(() => {
    const prev = prevActiveIdRef.current;
    const curr = save.activePetId ?? null;
    if (prev === curr) return;
    prevActiveIdRef.current = curr;
    const consumed = prev != null && !save.pets.some((pet) => pet.id === prev);
    if (!consumed || curr == null) return;
    const spot = spotForStationSlot(stationAssignRef.current.get(curr));
    if (!spot) return;
    // 就地融合仪式进行中：先别把相机拽到新陪伴站位（否则演出会瞬间被平移出画），
    // 把目标记下，等仪式收束时再回中。fusionRitualActiveRef 由下方 useLayoutEffect
    // 在同一 commit（早于本 effect）同步置位，故这里读到的一定是最新值。
    if (fusionRitualActiveRef.current) {
      pendingRecenterRef.current = spot.x;
      return;
    }
    centerOnWorldX(spot.x);
  }, [save.activePetId, save.pets, centerOnWorldX]);

  const { petFx, workPulse, laboringIds, workClick, pulseClassFor } = useBackyardWorkFx({
    busy,
    config,
    activePetId: save.activePetId,
    revealEnergy,
    onWorkPet,
    emitWorkBurst,
  });

  // ---- 派生游戏数据 ----

  const slotCount = hatcherySlotCount(config, save.hatcheryLevel);
  const maxSlots = config.hatcherySlots[config.hatcherySlots.length - 1] ?? slotCount;
  const hatcheryMaxed = save.hatcheryLevel >= config.hatcherySlots.length;
  const hatcheryUpgradeCost = hatcheryMaxed ? null : config.hatcheryUpgradeCosts[save.hatcheryLevel - 1];
  const inventoryEggs = save.eggs.filter((egg) => egg.slot == null);
  const freeSlot = (() => {
    const used = save.eggs.filter((egg) => egg.slot != null).map((egg) => egg.slot);
    for (let index = 0; index < slotCount; index += 1) if (!used.includes(index)) return index;
    return null;
  })();

  const yardCapacity = yardCapacityFor(config, save.yardLevel);
  const yardMaxed = save.yardLevel >= config.yardCapacity.length;
  const yardUpgradeCost = yardMaxed ? null : config.yardUpgradeCosts[save.yardLevel - 1];

  const nearPlaced = placedPets.find((item) => item.pet.id === nearPetId) ?? null;

  // ---- 融合就地仪式（承接上方声明的状态/ref；须放在 motion hook + nearPlaced 之后） ----

  // 收束仪式：复位主角显示 + 把相机回中到（「消耗回中」effect 记下的）新陪伴站位。
  // 幂等——定时到点 / 点击跳过 / 卸载都可能调用。
  const endFusionRitual = useCallback(() => {
    if (fusionRitualTimerRef.current) {
      window.clearTimeout(fusionRitualTimerRef.current);
      fusionRitualTimerRef.current = null;
    }
    if (!fusionRitualActiveRef.current && pendingRecenterRef.current == null) return;
    fusionRitualActiveRef.current = false;
    setFusionRitual(null);
    setCharHidden(false);
    const target = pendingRecenterRef.current;
    pendingRecenterRef.current = null;
    if (target != null) {
      centerOnWorldX(target);
      // 主角此刻恰好复位可见：抢先把它的 DOM 站位对齐到回中点，免 1 帧停在旧位的闪跳。
      if (charRef.current) charRef.current.style.left = `${target - CHAR_SIZE / 2}px`;
    }
  }, [centerOnWorldX, charRef]);
  fusionRitualEndRef.current = endFusionRitual;

  // 「点融合」入口包一层：趁两亲都还在场，抓下它们的世界站位（含物种）存进 origin ref，
  // 供融合庆典脉冲抵达时就地起演。第一个 id 恒为当前陪伴（主角）、第二个为靠近的驻留伙伴。
  const handleFuse = useCallback(
    (idA: string, idB: string) => {
      const a = save.pets.find((pet) => pet.id === idA) ?? null;
      const b = save.pets.find((pet) => pet.id === idB) ?? null;
      const bSpot = placedPetsRef.current.find((item) => item.pet.id === idB)?.spot ?? null;
      fusionOriginRef.current =
        a && b && bSpot
          ? {
              a: { species: a.species, x: readCharX(), bottom: CHAR_BOTTOM, size: CHAR_SIZE },
              b: { species: b.species, x: bSpot.x, bottom: bSpot.bottom, size: bSpot.size },
            }
          : null;
      onFuse(idA, idB);
    },
    [save.pets, onFuse, readCharX, placedPetsRef],
  );

  // 融合庆典脉冲抵达 → 就地起演。用 layout effect：在浏览器绘制前同步藏主角（此刻已回落成
  // 新陪伴，否则会有 1 帧新陪伴叠在亲代 A 旧位）并置活动标志——layout effect 总早于随后的
  // 「消耗回中」passive effect，故那边读到标志、把相机回中延后到仪式结束。
  useLayoutEffect(() => {
    if (!celebration || celebration.id === fusionRitualSeenIdRef.current) return;
    fusionRitualSeenIdRef.current = celebration.id;
    if (celebration.phase !== "fusionCommit" || !celebrationFresh(celebration)) return;
    const origin = fusionOriginRef.current;
    fusionOriginRef.current = null;
    // 减弱动效 / 无站位快照：退回「顶部横幅 + toast + 坑口特效」，不藏主角、不延后相机。
    if (!origin || prefersReducedMotion()) return;
    const slot = celebration.slot;
    const targetX = slot != null && PIT_XS[slot] != null ? PIT_XS[slot] : HATCHERY_CENTER_X;
    const durationMs = celebrationDurationFor(celebration);
    fusionRitualActiveRef.current = true;
    setCharHidden(true);
    setFusionRitual({
      id: celebration.id,
      mode: celebration.mode,
      tier: celebration.tier,
      originA: origin.a,
      originB: origin.b,
      targetX,
      durationMs,
    });
    if (fusionRitualTimerRef.current) window.clearTimeout(fusionRitualTimerRef.current);
    fusionRitualTimerRef.current = window.setTimeout(() => {
      fusionRitualTimerRef.current = null;
      fusionRitualEndRef.current();
    }, durationMs);
  }, [celebration]);

  // ---- 头顶气泡（提示 > 融合条件 > 台词） ----

  const fusionHintFor = (pet: PetInstance): string | null => {
    if (!activePet) return bk.hint.followFirst;
    if (activePet.tier !== pet.tier) return bk.hint.sameTier;
    if (!isMaxLevel(config, pet))
      return fmt(bk.hint.otherNotMax, {
        level: maxLevelForTier(config, pet.tier),
        name: speciesName(pet.species),
      });
    if (!isMaxLevel(config, activePet))
      return fmt(bk.hint.yoursNotMax, { name: speciesName(activePet.species, bk.hint.genericName) });
    const fee = fusionFeeFor(config, pet.tier);
    if (save.coins < fee) return fmt(bk.hint.needCoins, { fee: formatCount(fee) });
    return null;
  };

  const releaseRefund = (pet: PetInstance): number => {
    // 物种资料缺失（Steam 侧导入的未注册 AI 变种）→ 按确定性 codename 反解配方
    // 元素估算，与 Rust release_refund_for 的兜底同口径（连配方都反解不出 → 0 基价）。
    const info =
      config.species[pet.species] ??
      (() => {
        const key = recipeKeyForCodename(pet.species, config, save.customSpecies);
        return key ? { elements: key.split("+") } : undefined;
      })();
    return (
      Math.floor(equivalentEggPriceForInfo(config, info, pet.tier) * config.releaseRefundRate) +
      config.releaseRefundPerLevel * pet.level
    );
  };

  const { charSay } = useCharSpeech({
    toast,
    nearPetId,
    placedPetsRef,
    fusionHintFor,
    entryHint,
    speechVisible,
    speechLine,
  });
  // 教练引导文字复用角色气泡（OnboardingCoach.md §5）：coachLabel 优先于台词。
  const charBubble = coachLabel ?? charSay;
  // 把后院运行时（近商店 / 近宠）上报给 App 的 resolver；主角一移动即完成 C3。
  useEffect(() => {
    onCoachYard?.({ nearShop: shopOpen, nearPetId });
  }, [shopOpen, nearPetId, onCoachYard]);
  useEffect(() => {
    if (walking) onCoachMoved?.();
  }, [walking, onCoachMoved]);

  const stopClick = (event: ReactMouseEvent) => event.stopPropagation();

  // ---- 渲染 ----

  // 主角姿态：行走优先（力竭时也能被拖着散步）；主舞台的动作状态（进食/庆祝/
  // 思考/工作…）原样演出；静止且精力耗尽 → 趴着睡觉；其余正常待机。
  const charState: PetState = walking
    ? "moving"
    : SCENE_ACTION_STATES.has(petState)
      ? petState
      : activePet?.exhausted
        ? "exhausted"
        : "idle";

  // ---- 图鉴馆 / 交易市场数据 ----

  // 图鉴模型（融合 2.0，PokedexSystem.md）：收集口径 = dexObtained（曾获即入册、
  // 放生仍在），配方槽位/概率与融合掷骰同源。
  const pokedexModel = useMemo(() => buildPokedexModel(config, save), [config, save]);
  const collectedSpecies = pokedexModel.collected;
  const museum = useMemo(() => museumThumbs(pokedexModel, config, DEX_SUMMARY_CELLS), [pokedexModel, config]);

  // ---- 皮肤系统（SkinWorkshop.md）：格子徽章数据 + 分享文本导入 ----

  /** 某槽名下已导入皮肤数（神秘槽也按确定性 codename 查——「先入库」徽章）。 */
  const skinCountFor = useCallback(
    (slot: DexSlot): number => {
      const key = slot.codename ?? slot.deterministicCodename;
      return key ? save.speciesSkins?.[key]?.length ?? 0 : 0;
    },
    [save.speciesSkins],
  );

  const submitImport = (text: string) => {
    setImportBusy(true);
    setImportError(null);
    getGameBridge()
      .importSkinText(text)
      .then((result) => {
        setImportOpen(false);
        showDexToast(
          result.duplicate ? bk.dexDetail.importDup : fmt(bk.dexDetail.importOk, { name: result.nameZh }),
        );
        // 导入成功自动跳到对应物种详情（神秘槽也能跳——按确定性 codename 定位）。
        const locator = dexLocatorForCodename(result.codename, pokedexModel);
        if (locator) setDexDetail(locator);
      })
      .catch((error) => {
        setImportError(localizeGameMessage(error instanceof Error ? error.message : String(error), lang));
      })
      .finally(() => setImportBusy(false));
  };

  /** 伙伴的本地估值——仅用于「暂无真实挂单」时的行情排序回退（不再对外展示估价）。 */
  const fakeValue = (pet: PetInstance): number =>
    (equivalentEggPrice(config, pet.species, pet.tier) + pet.level * 7) * pet.tier * 3;

  /** 同步中的宠物 id——行情列表挂"⏳同步中"徽章。含 MintTier1 待发放 + 本地先行融合
   *  已转宠但结果尚未同步 Steam(applied Fuse 的 petId，泵铸材料/兑换中)。 */
  const pendingMintIds = useMemo(
    () =>
      new Set(
        (save.steamOutbox ?? []).flatMap((op) =>
          op.kind === "mintTier1"
            ? [op.petId]
            : op.kind === "fuse" && op.applied && op.petId
              ? [op.petId]
              : [],
        ),
      ),
    [save.steamOutbox],
  );

  // 交易市场真实行情：面板打开且 Steam 已连接时，一次性拉取「我的宠物」里所有已同步 Steam
  // itemdef 的社区市场挂单价（后端 15min 缓存 + 限频）。查不到（无挂单/未同步 Steam）的伙伴
  // 在行情里显示「价格未知」。
  const [marketPrices, setMarketPrices] = useState<Record<number, SteamMarketPrice>>({});
  const listedDefs = useMemo(
    () =>
      Array.from(
        new Set(
          save.pets
            .map((pet) => pet.steamItemDef)
            .filter((def): def is number => typeof def === "number"),
        ),
      ),
    [save.pets],
  );
  useEffect(() => {
    if (!marketOpen || steamStatus?.mode !== "connected" || listedDefs.length === 0) return;
    let cancelled = false;
    getGameBridge()
      .steamMarketPrices(listedDefs)
      .then((prices) => {
        if (!cancelled) setMarketPrices((prev) => ({ ...prev, ...prices }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [marketOpen, steamStatus?.mode, listedDefs]);

  /** 社区市场真实挂单价（含币种符号）；无挂单/未同步 Steam → null。 */
  const realMarketPrice = (pet: PetInstance): string | null => {
    if (pet.steamItemDef == null) return null;
    const price = marketPrices[pet.steamItemDef];
    return price?.lowestPrice ?? price?.medianPrice ?? null;
  };

  /** 真实挂单价的数值（剥离币种符号，用于按价格从高到低排行情）；无挂单 → null。 */
  const realPriceValue = (pet: PetInstance): number | null => {
    const s = realMarketPrice(pet);
    if (!s) return null;
    const n = Number.parseFloat(s.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  // 行情榜：优先展示「已在 Steam 有挂单」的伙伴（按真实挂单价从高到低），其后才是尚无
  // 挂单的伙伴（按本地估值排序，行情里显示「价格未知」）。
  const marketTop = useMemo(() => {
    const listed: { pet: PetInstance; value: number }[] = [];
    const unlisted: { pet: PetInstance; value: number }[] = [];
    for (const pet of save.pets) {
      const real = realPriceValue(pet);
      if (real != null) listed.push({ pet, value: real });
      else unlisted.push({ pet, value: fakeValue(pet) });
    }
    listed.sort((a, b) => b.value - a.value);
    unlisted.sort((a, b) => b.value - a.value);
    return [...listed, ...unlisted].slice(0, MARKET_TOP_LIMIT).map((item) => item.pet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, save.pets, marketPrices]);

  return (
    <div
      ref={rootRef}
      className="backyard"
      onClick={walkToPointer}
      style={
        {
          // 仅布景按真实时间调色（.by-grade-scene 读取）；宠物本身颜色不受影响。
          "--by-scene-grade": gradeToFilter(dayPhase.scene),
        } as CSSProperties
      }
    >
      {/* 缩放舞台：设计高 560，高度变化整体等比缩放（origin 左下），宽度变化只扩画卷 */}
      <div
        className="by-stage"
        style={{ width: stageW, height: STAGE_H, transform: `scale(${viewScale})` }}
      >
      {/* 昼夜天空（视口锚定，置于视差层之后=最底层）：太阳/月亮/地平线光晕/星星/白天飞鸟 */}
      <BackyardSky phase={dayPhase} />

      {/* 远景 / 中景 */}
      <div ref={farRef} className="by-layer" style={{ width: 3400 }}>
        <div className="by-grade-scene">
          <FarDecor />
        </div>
      </div>
      <div ref={midRef} className="by-layer" style={{ width: 4400 }}>
        <div className="by-grade-scene">
          <MidDecor />
        </div>
      </div>

      {/* 近景 */}
      <div ref={nearRef} className="by-layer" style={{ width: WORLD_SPAN }}>
        <div className="by-grade-scene">
          <NearDecor />
        </div>

        {/* 夜间灯光（世界锚定，不受调色 filter；白天不挂载）+ 氛围动态（萤火虫/蝴蝶/水光） */}
        {dayPhase.windowLight > 0.02 && <BackyardNightLights windowLight={dayPhase.windowLight} />}
        <BackyardAmbient starOpacity={dayPhase.starOpacity} daylight={dayPhase.daylight} />

        {/* 教练层锚点：商店 POI 世界坐标（不可见，随相机移动）——供「移动到商店」
            方向箭头判断商店此刻在主角哪一侧。SHOP_CENTER_X≈1150（useBackyardMotion）。 */}
        <div data-coach="shopPoi" aria-hidden="true" style={abs({ left: 1150, bottom: 200, width: 2, height: 2 })} />

        <BackyardHatcheryPits
          maxSlots={maxSlots}
          slotCount={slotCount}
          save={save}
          config={config}
          busy={busy}
          now={now}
          inventoryEggs={inventoryEggs}
          freeSlot={freeSlot}
          onUpgradeHatchery={onUpgradeHatchery}
          onPlaceEgg={onPlaceEgg}
          onCollectEgg={onCollectEgg}
          onPokeEgg={onPokeEgg}
          onToast={onToast}
        />

        {/* 蛋坑就地特效（世界锚定，随相机移动；镜头在坑附近时加分，离屏也安全） */}
        {activeCelebration && activeCelebration.slot != null && PIT_XS[activeCelebration.slot] != null && (
          <PitEnergyFx
            key={`pitfx-${activeCelebration.id}`}
            worldX={PIT_XS[activeCelebration.slot]}
            kind={pitFxKindFor(activeCelebration)}
            tier={activeCelebration.tier}
          />
        )}

        {/* 融合就地仪式（世界锚定）：两亲在原站位公转合体 → 金光上冲 → 蛋飞向孵化区 */}
        {fusionRitual && (
          <FusionRitual key={`fusion-ritual-${fusionRitual.id}`} data={fusionRitual} config={config} />
        )}

        {/* ── 商店弹出商品板（分阶蛋 · 默认最高阶 · 左右翻页 · 2×3 两行） ── */}
        <BackyardShopPopup
          save={save}
          config={config}
          busy={busy}
          shopOpen={shopOpen}
          shopTier={shopTier}
          setShopTier={setShopTier}
          shopSide={poiSides.shop}
          onBuyEgg={onBuyEgg}
          onUpgradeShop={onUpgradeShop}
        />

        {/* ── 图鉴馆弹板（靠近显示）：已收集角色的彩色缩略图 + 图鉴入口 ── */}
        <BackyardMuseumPanel
          museumOpen={museumOpen}
          museumSide={poiSides.museum}
          pokedexModel={pokedexModel}
          collectedSpecies={collectedSpecies}
          museum={museum}
          config={config}
          setDexOpen={setDexOpen}
        />

        {/* ── 交易市场弹板（靠近显示）：持有伙伴 + 最贵五只的占位行情 ── */}
        <BackyardMarketPanel
          marketOpen={marketOpen}
          marketSide={poiSides.market}
          marketTop={marketTop}
          config={config}
          pendingMintIds={pendingMintIds}
          steamStatus={steamStatus}
          realMarketPrice={realMarketPrice}
          onSteamSync={onSteamSync}
          onImportPets={onImportPets}
          onOpenMarket={onOpenMarket}
        />

        {/* ── 公告板：全局统计（Token / Agent 连接为主区，下方今日流水与图鉴） ── */}
        <BackyardNoticeBoard
          tokenStats={tokenStats}
          save={save}
          config={config}
          pokedexModel={pokedexModel}
          agentConnections={agentConnections}
          agentConnecting={agentConnecting}
          agentDisconnecting={agentDisconnecting}
          onConnectAgent={onConnectAgent}
          onDisconnectAgent={onDisconnectAgent}
        />

        {/* ── 升级后院木牌 ── */}
        <div style={abs({ left: 2652, bottom: 150, width: 8, height: 104, borderRadius: 4, background: "#8A6437" })} />
        <button
          type="button"
          className="by-upgrade-btn"
          style={{ left: 2596, bottom: 246 }}
          disabled={busy || yardMaxed || (yardUpgradeCost != null && save.coins < yardUpgradeCost)}
          onClick={(event) => {
            event.stopPropagation();
            onUpgradeYard();
          }}
        >
          {yardMaxed ? (
            <span>{fmt(bk.scene.yardMaxed, { cap: yardCapacity })}</span>
          ) : (
            <>
              <span>{fmt(bk.scene.yardUpgrade, { level: save.yardLevel + 1 })}</span>
              <span className="by-upgrade-sub">
                {fmt(bk.scene.yardUpgradeSub, {
                  cost: formatCount(yardUpgradeCost ?? 0),
                  cap: config.yardCapacity[save.yardLevel],
                })}
              </span>
            </>
          )}
        </button>

        {/* ── 驻留伙伴（点击直接打工） ── */}
        {placedPets.map(({ pet, spot }) => {
          const max = isMaxLevel(config, pet);
          const beh = behaviors[pet.id];
          return (
            <div
              key={pet.id}
              className={`by-pet ${pet.exhausted ? "is-exhausted" : ""}`}
              data-coach={`placedPet:${pet.id}`}
              style={{
                // 闲时踱步：在驻留点附近平滑挪动几步（left 过渡由 CSS 控制）
                left: spot.x - spot.size / 2 + (beh?.offset ?? 0),
                bottom: spot.bottom,
                width: spot.size,
                height: spot.size,
              }}
              title={
                pet.exhausted
                  ? bk.scene.petExhaustedTitle
                  : fmt(bk.clickToWork, { name: speciesName(pet.species) })
              }
              onClick={(event) => workClick(pet, event)}
            >
              <span className={`by-pet-tag${max ? " is-max" : ""}`}>
                {/* 两行名牌：① 等级 + 阶数（几阶几星） ② 名字 */}
                <span className="by-pet-tag-line">
                  Lv{pet.level}
                  <span className="by-pet-tag-stars" aria-label={fmt(bk.scene.tierAria, { tier: pet.tier })}>
                    {"★".repeat(pet.tier)}
                  </span>
                </span>
                <span className="by-pet-tag-name">
                  {pet.exhausted ? "💤 " : ""}
                  {speciesName(pet.species, pet.species)}
                </span>
                {/* 精力/经验条不常态显示：仅点击该宠后短暂显示（§6.1）；经验条满级即不再显示 */}
                {revealPetId === pet.id && (
                  <>
                    <EnergyBar
                      value={pet.stamina}
                      max={config.staminaMax}
                      wakeThreshold={config.wakeThreshold}
                      variant="tag"
                    />
                    {!max && <ExpBar value={pet.exp} max={expToNext(config, pet.tier, pet.level)} />}
                  </>
                )}
              </span>
              <div
                className="by-pet-body"
                style={beh?.facing === -1 ? { transform: "scaleX(-1)" } : undefined}
              >
                <div className={`pet-react-pulse ${pulseClassFor(pet.id)}`}>
                  <SvgSprite
                    species={pet.species}
                    config={config}
                    petState={
                      pet.exhausted
                        ? "exhausted"
                        : laboringIds.has(pet.id)
                          ? "laboring"
                          : beh?.kind === "move"
                            ? "moving"
                            : beh?.kind === "action"
                              ? beh.action
                              : "idle"
                    }
                  />
                </div>
              </div>
              {petFx
                .filter((fx) => fx.petId === pet.id)
                .map((fx) => (
                  <span key={fx.id} className="by-work-fx">
                    {fx.local && (
                      <span className="by-work-scatter" style={workScatterStyle(fx.species, spot.size)}>
                        <WorkBurst species={fx.species} tier={fx.tier} seed={fx.seed} boom={fx.boom} screen />
                      </span>
                    )}
                    <CoinBurst boom={fx.boom} />
                  </span>
                ))}
            </div>
          );
        })}

        {/* ── 靠近伙伴：动作牌插在脚下的土层剖面里（融合大牌 + 陪伴/放生错位小牌） ── */}
        {nearPlaced && (
          <BackyardNearPetActions
            nearPlaced={nearPlaced}
            activePet={activePet}
            busy={busy}
            config={config}
            save={save}
            confirmRelease={confirmRelease}
            setConfirmRelease={setConfirmRelease}
            fusionHintFor={fusionHintFor}
            releaseRefund={releaseRefund}
            onFuse={handleFuse}
            onFollow={onFollow}
            onRelease={onRelease}
          />
        )}

        {/* ── 主角：跟随中的精灵（点击直接打工；恢复中也保持正常姿态可移动） ── */}
        {activePet && (
          <div
            ref={charRef}
            className="by-char"
            data-coach="char"
            style={{
              left: SPAWN_X - CHAR_SIZE / 2,
              bottom: CHAR_BOTTOM,
              width: CHAR_SIZE,
              height: CHAR_SIZE,
              // 就地融合仪式期间藏起主角（此刻已回落成新陪伴，会正好站在亲代 A 旧位）——
              // 保持挂载（rAF 仍持续写 left），只隐形，让幽灵 A 代演、结束再复现。
              visibility: charHidden ? "hidden" : undefined,
            }}
            title={
              activePet.exhausted
                ? bk.scene.charRecoveringTitle
                : fmt(bk.clickToWork, { name: speciesName(activePet.species) })
            }
            onClick={(event) => workClick(activePet, event)}
          >
            {/* 头顶对话气泡：提示 > 融合条件 > 台词（紧贴头顶，不要过高） */}
            {charBubble && (
              <div className="by-char-say" key={charBubble}>
                {charBubble}
              </div>
            )}
            {/* 头顶名牌：等级 + 阶星 + 名字（与驻留伙伴同款，主角大一号）；说话时让位给气泡。
                精力条：恢复期常驻（充电进度可见，§6.4），平时点击/精力入账后短暂显示（§6.1）；
                经验条：点击打工后与精力条同窗显示，经验满由后端升级，满级即不再显示。 */}
            {!charBubble && (
              <span className={`by-pet-tag by-char-tag${isMaxLevel(config, activePet) ? " is-max" : ""}`}>
                <span className="by-pet-tag-line">
                  Lv{activePet.level}
                  <span
                    className="by-pet-tag-stars"
                    aria-label={fmt(bk.scene.tierAria, { tier: activePet.tier })}
                  >
                    {"★".repeat(activePet.tier)}
                  </span>
                </span>
                <span className="by-pet-tag-name">
                  {activePet.exhausted ? "💤 " : ""}
                  {speciesName(activePet.species, activePet.species)}
                </span>
                {(activePet.exhausted || revealPetId === activePet.id) && (
                  <EnergyBar
                    value={activePet.stamina}
                    max={config.staminaMax}
                    wakeThreshold={config.wakeThreshold}
                    variant="tag"
                    pulseKey={energyPulse}
                  />
                )}
                {revealPetId === activePet.id && !isMaxLevel(config, activePet) && (
                  <ExpBar
                    value={activePet.exp}
                    max={expToNext(config, activePet.tier, activePet.level)}
                  />
                )}
              </span>
            )}
            {/* 键帽雨 / 能量饭团：飞向主角嘴部（§6.3） */}
            <FlightLayer flights={heroFlights} targetLeft="50%" targetTop="48%" onDone={removeHeroFlight} />
            <div ref={charFaceRef} className="by-char-face">
              <div className={`by-char-walk ${walking ? "is-walking" : ""}`}>
                <div className={`pet-react-pulse ${pulseClassFor(activePet.id)}${charState === "fed" ? " is-eating" : ""}`}>
                  <SvgSprite species={activePet.species} config={config} petState={charState} />
                </div>
              </div>
            </div>
            {petFx
              .filter((fx) => fx.petId === activePet.id)
              .map((fx) => (
                <span key={fx.id} className="by-work-fx">
                  {fx.local && (
                    <span className="by-work-scatter" style={workScatterStyle(fx.species, CHAR_SIZE)}>
                      <WorkBurst species={fx.species} tier={fx.tier} seed={fx.seed} boom={fx.boom} screen />
                    </span>
                  )}
                  <CoinBurst boom={fx.boom} />
                </span>
              ))}
            {/* 进食收益飘字：跟着主角走（世界坐标锚定）；2026-07-21 起 Token 餐 = 陪伴宠经验 */}
            {fedPulse && fedPulse.exp > 0 && (
              <span className="by-char-pops" key={fedPulse.id} aria-hidden="true">
                <span className="exp-pop pop-exp exp-pop-lane-0">
                  <span className="pop-icon">✨</span>+{fedPulse.exp}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ===== 泥土层常驻 UI：左下角同框牌簇（后院在上，返回/金币在下） ===== */}
      <div className="by-soil-ui" onClick={stopClick}>
        <div className="by-soil-chip by-soil-title">
          <span className="by-bar-name">{bk.scene.soilTitle}</span>
          <span className="by-bar-sub">
            {fmt(bk.scene.soilSub, { level: save.yardLevel, count: save.pets.length, cap: yardCapacity })}
          </span>
        </div>
        <div className="by-soil-row">
          <button
            type="button"
            className="by-soil-chip by-soil-back"
            data-coach="yardBack"
            title={bk.scene.backTitle}
            onClick={(event) => {
              event.stopPropagation();
              onBack();
            }}
          >
            {bk.scene.backBtn}
          </button>
          <div className="by-soil-chip by-soil-coins" title={bk.scene.coinsTitle}>
            🪙 {formatCount(save.coins)}
          </div>
        </div>
      </div>

      {/* 首次进入的移动引导（一次性）：教练激活时让位，避免与 C3 键帽指引叠字（#4） */}
      {showGuide && coachLabel == null && (
        <div className="by-guide">
          <span className="by-guide-title">{bk.scene.guideTitle}</span>
          <span className="by-guide-sub">{bk.scene.guideSub}</span>
        </div>
      )}
      </div>

      {/* ===== 后院升级光效（回退路径：覆盖层未接手时窗口内渲染；接手则满屏无截断） ===== */}
      {yardUpgradeFx && !yardFxViaOverlay && (
        <YardUpgradeFx
          key={`yard-upgrade-${yardUpgradeFx.id}`}
          level={yardUpgradeFx.level}
          cap={yardUpgradeFx.cap}
        />
      )}

      {/* ===== 庆典电影化揭晓（回退路径：孵化幕已交给全屏覆盖层时不再窗口内渲染，
             避免重影 + 躲开窄条窗上沿硬裁；融合脉冲的顶部横幅始终留窗口内贴着就地仪式） ===== */}
      {activeCelebration && !celebrationViaOverlay && (
        <CelebrationCinematic
          key={activeCelebration.id}
          pulse={activeCelebration}
          config={config}
          onSkip={dismissCelebration}
        />
      )}

      {/* ===== 图鉴全屏浮层（不随舞台缩放，保证清晰） ===== */}
      {dexOpen && (
        <>
          <div
            className="by-dex-overlay"
            onClick={(event) => {
              event.stopPropagation();
              setDexOpen(false);
            }}
          >
            <div className="by-dex-panel" onClick={stopClick}>
              <header className="by-dex-head">
                <span className="by-dex-title">{bk.dex.overlayTitle}</span>
                <span className="by-dex-progress">
                  {fmt(bk.dex.progress, { collected: pokedexModel.fixedCollected, total: FIXED_DEX_TOTAL })}
                  {pokedexModel.aiCollected > 0 ? fmt(bk.dex.aiSuffix, { count: pokedexModel.aiCollected }) : ""}
                </span>
                <button
                  type="button"
                  className="by-dex-import-btn"
                  disabled={steamStatus?.mode !== "connected"}
                  title={steamStatus?.mode === "connected" ? undefined : bk.dexDetail.importNeedSteam}
                  onClick={(event) => {
                    event.stopPropagation();
                    setImportError(null);
                    setImportOpen(true);
                  }}
                >
                  {bk.dexDetail.importBtn}
                </button>
                <button
                  type="button"
                  className="by-dex-close"
                  title={bk.dex.closeTitle}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDexOpen(false);
                  }}
                >
                  ✕
                </button>
              </header>
              <div className="by-dex-body">
                <div className="by-dex-section-label">{bk.dex.baseSection}</div>
                <div className="by-dex-baserow">
                  {pokedexModel.baseSlots.map((slot, index) => (
                    <DexCell
                      key={slot.codename}
                      slot={slot}
                      config={config}
                      onOpen={() => setDexDetail({ recipeKey: null, slotIndex: index })}
                      skinCount={skinCountFor(slot)}
                    />
                  ))}
                </div>
                <div className="by-dex-section-label">{bk.dex.recipeSection}</div>
                {pokedexModel.recipes.map((recipe) => (
                  <DexRecipeRow
                    key={recipe.key}
                    recipe={recipe}
                    config={config}
                    onOpenSlot={(slotIndex) => setDexDetail({ recipeKey: recipe.key, slotIndex })}
                    skinCountFor={skinCountFor}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 物种详情弹窗（.by-dex-overlay 的兄弟层 z=21：点空白只关自己，不冒泡关图鉴） */}
          {dexDetail && (
            <BackyardDexDetail
              locator={dexDetail}
              model={pokedexModel}
              config={config}
              save={save}
              steamStatus={steamStatus}
              onClose={() => setDexDetail(null)}
              onDexToast={showDexToast}
              onOpenImport={() => {
                setImportError(null);
                setImportOpen(true);
              }}
              onShareFallback={setShareFallbackText}
            />
          )}

          {/* 导入 / 分享兜底对话框（welcome 卡体系 z=80） */}
          {importOpen && (
            <BackyardDexSkinDialog
              mode="import"
              busy={importBusy}
              error={importError}
              onSubmit={submitImport}
              onClose={() => {
                setImportOpen(false);
                setImportError(null);
              }}
            />
          )}
          {shareFallbackText != null && !importOpen && (
            <BackyardDexSkinDialog
              mode="share"
              text={shareFallbackText}
              onClose={() => setShareFallbackText(null)}
            />
          )}

          {/* 浮层内 toast（后院气泡被图鉴遮挡；仿 .game-toast） */}
          {dexToast && (
            <div key={dexToast.id} className="by-dex-toast">
              {dexToast.text}
            </div>
          )}
        </>
      )}
    </div>
  );
}
