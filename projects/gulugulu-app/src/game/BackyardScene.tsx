import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { GameConfig, GameSave, PetInstance, PetState, SteamStatus } from "../types";
import { SvgSprite } from "../sprites/SvgSprite";
import { ReactionBurst } from "../sprites/parts/vfx";
import { WorkBurst } from "../sprites/parts/workFx";
import { WORLD_W, abs } from "./backyardShared";
import { FarDecor, MidDecor, NearDecor } from "./BackyardDecor";
import { DexCell, DexRecipeRow } from "./BackyardDex";
import { BackyardHatcheryPits } from "./BackyardHatcheryPits";
import { BackyardShopPopup } from "./BackyardShopPopup";
import { BackyardMuseumPanel } from "./BackyardMuseumPanel";
import { BackyardMarketPanel } from "./BackyardMarketPanel";
import { BackyardNoticeBoard } from "./BackyardNoticeBoard";
import { BackyardNearPetActions } from "./BackyardNearPetActions";
import {
  equivalentEggPrice,
  fusionFeeFor,
  hatcherySlotCount,
  isMaxLevel,
  maxLevelForTier,
  yardCapacityFor,
} from "./config";
import { getGameBridge } from "./bridge";
import { formatCount } from "./format";
import { EnergyBar } from "./EnergyBar";
import { FlightLayer, foodFlightFor, keycapFlightsFor, useFlights } from "./FlightLayer";
import { buildPokedexModel, FIXED_DEX_TOTAL, museumThumbs } from "./pokedexData";
import { nextFusionGoal } from "./tutorial";
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
const SPAWN_X = 440;

/** 舞台设计高（世界坐标系的画布高度）。窗口高度变化 = 整体等比缩放；
 *  窗口宽度变化 = 只扩展可见画卷（stageW = 视口宽 / 缩放）。 */
const STAGE_H = 560;

/** 站在草地上的驻留点（脚底约在草皮线上，不悬空） */
const GROUND_SPOTS: Array<{ x: number; bottom: number; size: number; float?: boolean }> = [
  { x: 1760, bottom: 142, size: 84 },
  { x: 3236, bottom: 142, size: 92 },
  { x: 4009, bottom: 142, size: 98 },
  { x: 700, bottom: 142, size: 88 },
  { x: 2680, bottom: 142, size: 88 },
  { x: 4240, bottom: 142, size: 80 },
  { x: 4430, bottom: 142, size: 84 },
];

/** 池塘上空的漂浮位：只分配给水系伙伴，其他系一律落地 */
const POND_SPOT = { x: 2058, bottom: 196, size: 96, float: true };

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

export type BackyardSceneProps = {
  save: GameSave;
  config: GameConfig;
  busy: boolean;
  statusText: string;
  projectTokens: number;
  /** 主舞台的宠物状态：fed/success/thinking… 会映射到场景主角身上播放 */
  petState: PetState;
  /** 正在播放的进食收益（App 的喂食队列出队一条），跟随主角头顶飘字 */
  fedPulse: { id: number; stamina: number; level: number } | null;
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
  onWalkingChange: (walking: boolean) => void;
  onBack: () => void;
  onWorkPet: (petId: string, at?: { x: number; y: number }) => void;
  onCollectEgg: (eggId: string) => void;
  onPlaceEgg: (eggId: string, slot: number) => void;
  onBuyEgg: (element: string, tier: number) => void;
  onUpgradeHatchery: () => void;
  onUpgradeYard: () => void;
  onUpgradeShop: () => void;
  onFuse: (idA: string, idB: string) => void;
  onFollow: (petId: string) => void;
  onRelease: (petId: string) => void;
  onToast: (message: string) => void;
};

export function BackyardScene({
  save,
  config,
  busy,
  statusText,
  projectTokens,
  petState,
  fedPulse,
  speechLine,
  speechVisible,
  toast,
  steamStatus,
  onOpenMarket,
  onSteamSync,
  onWalkingChange,
  onBack,
  onWorkPet,
  onCollectEgg,
  onPlaceEgg,
  onBuyEgg,
  onUpgradeHatchery,
  onUpgradeYard,
  onUpgradeShop,
  onFuse,
  onFollow,
  onRelease,
  onToast,
}: BackyardSceneProps) {
  const now = useNowSeconds(true);

  /** 商店当前翻到的蛋阶（默认最高解锁阶；升级后自动跳到新最高阶）。 */
  const [shopTier, setShopTier] = useState(save.shopLevel ?? 1);

  // 商店升级后自动翻到新的最高解锁阶（"默认显示最高阶"，EconomyScaling.md §6.3）。
  useEffect(() => {
    setShopTier(save.shopLevel ?? 1);
  }, [save.shopLevel]);
  const [dexOpen, setDexOpen] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  // 闲时小动作：驻留伙伴大部分时间安静待机，偶尔欢呼一下或左右踱两步
  const [quirk, setQuirk] = useState<{ petId: string; kind: "hop" | "stroll"; dx: number; facing: number } | null>(
    null,
  );
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
        // 键盘/Token 喂主宠 → 短暂显示主宠精力条。
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

  const activePet = save.pets.find((pet) => pet.id === save.activePetId) ?? null;
  // 驻留点分配：水系优先占池塘漂浮位，其余全部落在草地上（不悬空）。
  const placedPets = useMemo(() => {
    const others = save.pets.filter((pet) => pet.id !== save.activePetId);
    const result: Array<{ pet: PetInstance; spot: { x: number; bottom: number; size: number; float?: boolean } }> = [];
    let pondTaken = false;
    let groundIndex = 0;
    for (const pet of others) {
      const isWater = config.species[pet.species]?.elements?.[0] === "water";
      if (isWater && !pondTaken) {
        result.push({ pet, spot: POND_SPOT });
        pondTaken = true;
        continue;
      }
      if (groundIndex < GROUND_SPOTS.length) {
        result.push({ pet, spot: GROUND_SPOTS[groundIndex] });
        groundIndex += 1;
      }
    }
    return result;
  }, [config, save.pets, save.activePetId]);

  // rAF 循环 / 靠近检测所需的驻留伙伴快照（闲时调度与头顶气泡也读它）。
  const placedPetsRef = useRef(placedPets);
  const guideSeenRef = useRef(false);

  useEffect(() => {
    placedPetsRef.current = placedPets;
  }, [placedPets]);

  // 闲时小动作调度：每 6–14s 随机挑一只驻留伙伴，55% 概率踱步（moving 左右
  // 挪 36px），否则原地欢呼（success）。力竭中的伙伴跳过。
  useEffect(() => {
    let scheduleTimer = 0;
    let clearTimer = 0;
    const schedule = () => {
      scheduleTimer = window.setTimeout(() => {
        const candidates = placedPetsRef.current.filter((item) => !item.pet.exhausted);
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          const stroll = Math.random() < 0.55;
          const dir = Math.random() < 0.5 ? -1 : 1;
          setQuirk({
            petId: pick.pet.id,
            kind: stroll ? "stroll" : "hop",
            dx: stroll ? dir * 36 : 0,
            facing: dir,
          });
          clearTimer = window.setTimeout(() => setQuirk(null), stroll ? 2400 : 1500);
        }
        schedule();
      }, 6000 + Math.random() * 8000);
    };
    schedule();
    return () => {
      window.clearTimeout(scheduleTimer);
      window.clearTimeout(clearTimer);
    };
  }, []);

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

  // 图鉴打开时 Esc 先关图鉴（捕获阶段拦截，避免 App 的 Esc 直接退出后院）
  useEffect(() => {
    if (!dexOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      setDexOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [dexOpen]);

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

  const { petFx, workPulse, laboringIds, workClick, pulseClassFor } = useBackyardWorkFx({
    busy,
    config,
    activePetId: save.activePetId,
    revealEnergy,
    onWorkPet,
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

  // ---- 头顶气泡（提示 > 融合条件 > 台词） ----

  const fusionHintFor = (pet: PetInstance): string | null => {
    if (!activePet) return "先跟随一只精灵再来融合";
    if (activePet.tier !== pet.tier) return "需要两只同阶精灵";
    if (!isMaxLevel(config, pet))
      return `需对方满级 Lv${maxLevelForTier(config, pet.tier)}（${config.species[pet.species]?.nameZh ?? ""}未满级）`;
    if (!isMaxLevel(config, activePet))
      return `你的${config.species[activePet.species]?.nameZh ?? "精灵"}还没满级`;
    const fee = fusionFeeFor(config, pet.tier);
    if (save.coins < fee) return `金币不足（融合需 ${formatCount(fee)} 🪙）`;
    return null;
  };

  const releaseRefund = (pet: PetInstance): number =>
    Math.floor(equivalentEggPrice(config, pet.species, pet.tier) * config.releaseRefundRate) +
    config.releaseRefundPerLevel * pet.level;

  const { charSay } = useCharSpeech({
    toast,
    nearPetId,
    placedPetsRef,
    fusionHintFor,
    speechVisible,
    speechLine,
  });

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

  // 融合目标卡（观察者·OnboardingFlow §二·1）：后院凑齐两只同阶满级时，
  // 顶部横幅点名可融合的一对 + ？？？ 结果，勾玩家走过去融合。
  const fuseGoal = nextFusionGoal(config, save);
  const fuseFee = fusionFeeFor(config, fuseGoal?.a.tier ?? 1);
  const fuseAffordable = save.coins >= fuseFee;

  // ---- 图鉴馆 / 交易市场数据 ----

  // 图鉴模型（融合 2.0，PokedexSystem.md）：收集口径 = dexObtained（曾获即入册、
  // 放生仍在），配方槽位/概率与融合掷骰同源。
  const pokedexModel = useMemo(() => buildPokedexModel(config, save), [config, save]);
  const collectedSpecies = pokedexModel.collected;
  const museum = useMemo(() => museumThumbs(pokedexModel, config, DEX_SUMMARY_CELLS), [pokedexModel, config]);

  /** 交易市场占位行情（后续接 Steam 市场真实价格） */
  const fakeMarketPrice = (pet: PetInstance): string =>
    (((equivalentEggPrice(config, pet.species, pet.tier) + pet.level * 7) * pet.tier * 3) / 100).toFixed(2);

  /** 待发放(MintTier1 排队中)的宠物 id——行情列表挂"⏳同步中"徽章。 */
  const pendingMintIds = useMemo(
    () =>
      new Set(
        (save.steamOutbox ?? [])
          .filter((op) => op.kind === "mintTier1")
          .map((op) => op.petId),
      ),
    [save.steamOutbox],
  );

  const marketTop = useMemo(() => {
    const priced = save.pets.map((pet) => ({
      pet,
      value: (equivalentEggPrice(config, pet.species, pet.tier) + pet.level * 7) * pet.tier * 3,
    }));
    priced.sort((a, b) => b.value - a.value);
    return priced.slice(0, 5).map((item) => item.pet);
  }, [config, save.pets]);

  return (
    <div ref={rootRef} className="backyard" onClick={walkToPointer}>
      {/* 缩放舞台：设计高 560，高度变化整体等比缩放（origin 左下），宽度变化只扩画卷 */}
      <div
        className="by-stage"
        style={{ width: stageW, height: STAGE_H, transform: `scale(${viewScale})` }}
      >
      {/* 远景 / 中景 */}
      <div ref={farRef} className="by-layer" style={{ width: 3400 }}>
        <FarDecor />
      </div>
      <div ref={midRef} className="by-layer" style={{ width: 4400 }}>
        <MidDecor />
      </div>

      {/* 近景 */}
      <div ref={nearRef} className="by-layer" style={{ width: WORLD_W }}>
        <NearDecor />

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
          onToast={onToast}
        />

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
          fakeMarketPrice={fakeMarketPrice}
          onSteamSync={onSteamSync}
          onOpenMarket={onOpenMarket}
        />

        {/* ── 公告板：全局统计（Token / Agent 连接为主区，下方今日流水与图鉴） ── */}
        <BackyardNoticeBoard
          projectTokens={projectTokens}
          statusText={statusText}
          save={save}
          config={config}
          pokedexModel={pokedexModel}
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
            <span>后院已满级 · {yardCapacity} 只</span>
          ) : (
            <>
              <span>⬆ 升级后院 Lv{save.yardLevel + 1}</span>
              <span className="by-upgrade-sub">
                {formatCount(yardUpgradeCost ?? 0)} 🪙 → {config.yardCapacity[save.yardLevel]} 只
              </span>
            </>
          )}
        </button>

        {/* ── 驻留伙伴（点击直接打工） ── */}
        {placedPets.map(({ pet, spot }) => {
          const info = config.species[pet.species];
          const max = isMaxLevel(config, pet);
          return (
            <div
              key={pet.id}
              className={`by-pet ${pet.exhausted ? "is-exhausted" : ""}`}
              style={{
                // 闲时踱步：在驻留点附近平滑挪动几步（left 过渡由 CSS 控制）
                left: spot.x - spot.size / 2 + (quirk?.petId === pet.id ? quirk.dx : 0),
                bottom: spot.bottom,
                width: spot.size,
                height: spot.size,
              }}
              title={pet.exhausted ? "趴着充电中…回到 10% 就起来" : `${info?.nameZh ?? ""}（点击打工）`}
              onClick={(event) => workClick(pet, event)}
            >
              <span className={`by-pet-tag${max ? " is-max" : ""}`}>
                {/* 两行名牌：① 等级 + 阶数（几阶几星） ② 名字 */}
                <span className="by-pet-tag-line">
                  Lv{pet.level}
                  <span className="by-pet-tag-stars" aria-label={`${pet.tier} 阶`}>
                    {"★".repeat(pet.tier)}
                  </span>
                </span>
                <span className="by-pet-tag-name">
                  {pet.exhausted ? "💤 " : ""}
                  {info?.nameZh ?? pet.species}
                </span>
                {/* 精力条不常态显示：仅点击该宠后短暂显示（§6.1） */}
                {revealPetId === pet.id && (
                  <EnergyBar
                    value={pet.stamina}
                    max={config.staminaMax}
                    wakeThreshold={config.wakeThreshold}
                    variant="tag"
                  />
                )}
              </span>
              <div
                className="by-pet-body"
                style={quirk?.petId === pet.id && quirk.facing === -1 ? { transform: "scaleX(-1)" } : undefined}
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
                          : quirk?.petId === pet.id
                            ? quirk.kind === "stroll"
                              ? "moving"
                              : "success"
                            : "idle"
                    }
                  />
                </div>
              </div>
              {petFx
                .filter((fx) => fx.petId === pet.id)
                .map((fx) => (
                  <span key={fx.id} className="by-work-fx">
                    <WorkBurst species={fx.species} tier={fx.tier} seed={fx.seed} boom={fx.boom} screen />
                    <ReactionBurst color={fx.color} />
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
            onFuse={onFuse}
            onFollow={onFollow}
            onRelease={onRelease}
          />
        )}

        {/* ── 主角：跟随中的精灵（点击直接打工；恢复中也保持正常姿态可移动） ── */}
        {activePet && (
          <div
            ref={charRef}
            className="by-char"
            style={{ left: SPAWN_X - CHAR_SIZE / 2, bottom: CHAR_BOTTOM, width: CHAR_SIZE, height: CHAR_SIZE }}
            title={
              activePet.exhausted
                ? "精力恢复中…还可以带它散步"
                : `${config.species[activePet.species]?.nameZh ?? ""}（点击打工）`
            }
            onClick={(event) => workClick(activePet, event)}
          >
            {/* 头顶对话气泡：提示 > 融合条件 > 台词（紧贴头顶，不要过高） */}
            {charSay && (
              <div className="by-char-say" key={charSay}>
                {charSay}
              </div>
            )}
            {activePet.exhausted && !charSay && (
              <span className="by-char-zzz">
                💤 充电中
                <EnergyBar
                  value={activePet.stamina}
                  max={config.staminaMax}
                  wakeThreshold={config.wakeThreshold}
                  variant="tag"
                  pulseKey={energyPulse}
                />
              </span>
            )}
            {/* 头顶悬浮精力条不常态显示：点击/精力入账后短暂显示；恢复期由充电药丸接管（§6.1） */}
            {!activePet.exhausted && revealPetId === activePet.id && (
              <span className="by-char-energy">
                <EnergyBar
                  value={activePet.stamina}
                  max={config.staminaMax}
                  wakeThreshold={config.wakeThreshold}
                  variant="float"
                  pulseKey={energyPulse}
                />
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
                  <WorkBurst species={fx.species} tier={fx.tier} seed={fx.seed} boom={fx.boom} screen />
                  <ReactionBurst color={fx.color} />
                </span>
              ))}
            {/* 进食收益飘字：跟着主角走（世界坐标锚定）；v1.1 Token 只回精力 */}
            {fedPulse && fedPulse.stamina > 0 && (
              <span className="by-char-pops" key={fedPulse.id} aria-hidden="true">
                <span className="exp-pop pop-stamina exp-pop-lane-0">
                  <span className="pop-icon">⚡</span>+{fedPulse.stamina}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ===== 泥土层常驻 UI：左下角同框牌簇（后院在上，返回/金币在下） ===== */}
      <div className="by-soil-ui" onClick={stopClick}>
        <div className="by-soil-chip by-soil-title">
          <span className="by-bar-name">后 院</span>
          <span className="by-bar-sub">
            Lv{save.yardLevel} · {save.pets.length}/{yardCapacity} 只
          </span>
        </div>
        <div className="by-soil-row">
          <button
            type="button"
            className="by-soil-chip by-soil-back"
            title="回到宠物（Esc）"
            onClick={(event) => {
              event.stopPropagation();
              onBack();
            }}
          >
            ← 返回
          </button>
          <div className="by-soil-chip by-soil-coins" title="金币">
            🪙 {formatCount(save.coins)}
          </div>
        </div>
      </div>

      {/* 可融合提示：右下角泥土层 */}
      {fuseGoal && (
        <div className="by-soil-goal" onClick={stopClick}>
          <span className="by-bar-goal-dot" />
          <span>
            可融合：{config.species[fuseGoal.a.species]?.nameZh ?? fuseGoal.a.species} +{" "}
            {config.species[fuseGoal.b.species]?.nameZh ?? fuseGoal.b.species} → <b>？？？</b>
            {fuseAffordable ? ` · ${formatCount(fuseFee)} 🪙` : `（还差 ${formatCount(fuseFee - save.coins)} 🪙）`}
          </span>
        </div>
      )}

      {/* 首次进入的移动引导（一次性；开始移动或超时后永久消失） */}
      {showGuide && (
        <div className="by-guide">
          <span className="by-guide-title">🖱 点击场景走过去 · ⌨ ← → / A D 移动</span>
          <span className="by-guide-sub">走到商店、公告板或伙伴身边看看吧 · 拖动窗口边缘可以缩放后院</span>
        </div>
      )}
      </div>

      {/* ===== 图鉴全屏浮层（不随舞台缩放，保证清晰） ===== */}
      {dexOpen && (
        <div
          className="by-dex-overlay"
          onClick={(event) => {
            event.stopPropagation();
            setDexOpen(false);
          }}
        >
          <div className="by-dex-panel" onClick={stopClick}>
            <header className="by-dex-head">
              <span className="by-dex-title">📖 图鉴</span>
              <span className="by-dex-progress">
                固定 {pokedexModel.fixedCollected}/{FIXED_DEX_TOTAL}
                {pokedexModel.aiCollected > 0 ? ` · AI 变种 ×${pokedexModel.aiCollected}` : ""}
              </span>
              <button
                type="button"
                className="by-dex-close"
                title="关闭（Esc）"
                onClick={(event) => {
                  event.stopPropagation();
                  setDexOpen(false);
                }}
              >
                ✕
              </button>
            </header>
            <div className="by-dex-body">
              <div className="by-dex-section-label">基础物种 · 单元素（商店蛋直出）</div>
              <div className="by-dex-baserow">
                {pokedexModel.baseSlots.map((slot) => (
                  <DexCell key={slot.codename} slot={slot} config={config} />
                ))}
              </div>
              <div className="by-dex-section-label">融合配方 · 元素并集（低阶在上 · 未收集黑影上是当前生成概率）</div>
              {pokedexModel.recipes.map((recipe) => (
                <DexRecipeRow key={recipe.key} recipe={recipe} config={config} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
