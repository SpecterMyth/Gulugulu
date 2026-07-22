import type { GameConfig, GameSave, PetInstance } from "../types";
import { fmt, type Language, t } from "../i18n";
import {
  clickExpFor,
  expToNext,
  fusionFeeFor,
  hatcherySlotCount,
  isMaxLevel,
  maxLevelForTier,
  shopUpgradeCost,
  yardCapacityFor,
} from "./config";
import type { UiMode } from "./GamePanels";
import { FIXED_DEX_TOTAL } from "./pokedexData";

// ---------------------------------------------------------------------------
// 状态触发式新手引导 —— 展示预算模型（docs/gdd/OnboardingGuidance.md v1.0）
//
// 由存档状态推导当前引导节点，不再是线性 tutorialStep 计数。每条引导带一个
// `budget`（完整展示满这么多轮后永久退休，budget=1 即一次性）+ 一个持久展示键
// `key`（默认=id，可用 opts.key 覆盖为按实例区分），计数落 localStorage（见 useTutorialHints）。
// 另有"毕业闸"：拥有首只 2 阶（tutorialStep≥GRADUATION_STEP）后，basicCluster 的
// 基础引导无论剩余预算一律退休——引导期正式结束。发现/晚期节点（图鉴/Steam/放生/
// 升级）不属基础族，只看各自预算，可能毕业后才首次遇到。Rust 侧零改动。
// ---------------------------------------------------------------------------

export type TutorialHint = {
  id: string;
  text: string;
  /** 展示计数的持久键（默认=id，可用 opts.key 覆盖为按实例区分）。 */
  key: string;
  /** 展示预算：完整展示满这么多轮后永久退休（budget=1 即一次性）。 */
  budget: number;
};

/** 已达成毕业里程碑（首只 2 阶）后写入的 tutorialStep，标记引导期结束。 */
export const GRADUATION_STEP = 11;

/** 学会核心循环即应退场的"基础族"——毕业后无论剩余预算一律退休。 */
const BASIC_CLUSTER = new Set<string>([
  "collect-egg",
  "recovering",
  "cap-full",
  "fusion-ready",
  "expdiff",
  "max-switch",
  "buy-second",
  "cap-near",
  "menu-work",
]);

/** 距满级 ≤ 该击数时，弹"还差 X 下就满级"的目标梯度气泡。 */
const DIFF_HINT_CLICKS = 12;

/** 该精灵距本阶满级还需的经验（跨级累加，已满级返回 0）。 */
export function expToMax(config: GameConfig, pet: PetInstance): number {
  const maxLevel = maxLevelForTier(config, pet.tier);
  if (pet.level >= maxLevel) return 0;
  let remaining = Math.max(0, expToNext(config, pet.tier, pet.level) - pet.exp);
  for (let level = pet.level + 1; level < maxLevel; level += 1) {
    remaining += expToNext(config, pet.tier, level);
  }
  return remaining;
}

/** 后院是否已凑齐"两只同阶满级"——融合前置（金币另算，红点只看配对）。 */
export function fusionReady(config: GameConfig, save: GameSave): boolean {
  const countByTier = new Map<number, number>();
  for (const pet of save.pets) {
    if (!isMaxLevel(config, pet)) continue;
    const next = (countByTier.get(pet.tier) ?? 0) + 1;
    if (next >= 2) return true;
    countByTier.set(pet.tier, next);
  }
  return false;
}

/**
 * 后院融合红点：只看**当前陪伴宠**能否立刻融合——同阶满级搭档在册 + 金币够手续费。
 * （与 fusionReady 不同：那个只看"存在任意一对同阶满级"，供教练路由用；红点更严，
 * 对齐玩家在后院的真实一步——切谁跟随谁就能融，金币不够就别亮。）
 */
export function activePetCanFuse(config: GameConfig, save: GameSave): boolean {
  const active = save.pets.find((pet) => pet.id === save.activePetId) ?? null;
  if (!active || !isMaxLevel(config, active)) return false;
  const hasPartner = save.pets.some(
    (pet) => pet.id !== active.id && pet.tier === active.tier && isMaxLevel(config, pet),
  );
  if (!hasPartner) return false;
  return save.coins >= fusionFeeFor(config, active.tier);
}

/** 孵化屋是否已满（所有槽位都在孵蛋）——满则买蛋只能进库存孵不了，别再劝买/亮红点。 */
export function hatcheryFull(config: GameConfig, save: GameSave): boolean {
  const slots = hatcherySlotCount(config, save.hatcheryLevel);
  const incubating = save.eggs.filter((egg) => egg.slot != null).length;
  return incubating >= slots;
}

/** 一条可读的"下一步融合目标"：取后院可融合的一对，给出 A + B → ??? 文案。 */
export function nextFusionGoal(
  config: GameConfig,
  save: GameSave,
): { a: PetInstance; b: PetInstance } | null {
  const maxed = save.pets.filter((pet) => isMaxLevel(config, pet));
  for (let i = 0; i < maxed.length; i += 1) {
    for (let j = i + 1; j < maxed.length; j += 1) {
      if (maxed[i].tier === maxed[j].tier) return { a: maxed[i], b: maxed[j] };
    }
  }
  return null;
}

export type TutorialContext = {
  save: GameSave;
  config: GameConfig;
  uiMode: UiMode;
  /** 引导文案语言（词条在 i18n/shell.ts 的 tutorial 域；缺省中文）。 */
  lang?: Language;
  /** 各展示键已完整展示的轮数（localStorage 落盘，跨重启累计）。 */
  shows?: Readonly<Record<string, number>>;
  /** 是否有已孵化、可收取的蛋（App 侧按 stageNow 结算后传入）。 */
  hatcheryReady?: boolean;
  /** Steam 集成是否开启（默认关时不引导交易所）。 */
  steamEnabled?: boolean;
};

const NO_SHOWS: Readonly<Record<string, number>> = {};

/** 已收集的固定物种数（曾获账本 dexObtained ∩ 63 固定谱），用于毕业文案。 */
function fixedCollectedCount(config: GameConfig, save: GameSave): number {
  const fixed = new Set(Object.values(config.speciesByRecipe ?? {}));
  const dex = save.dexObtained ?? {};
  return Object.keys(dex).filter((s) => fixed.has(s) && (dex[s] ?? 0) >= 1).length;
}

export function computeTutorialHint({
  save,
  config,
  uiMode,
  lang = "en",
  shows = NO_SHOWS,
  hatcheryReady = false,
  steamEnabled = false,
}: TutorialContext): TutorialHint | null {
  const TT = t(lang).sh.tutorial;
  const graduated = save.tutorialStep >= GRADUATION_STEP;

  // 构造 + 退休判定：达预算 / 基础族已毕业 → 返回 null（让位给下一条）。
  const make = (
    id: string,
    text: string,
    opts?: { budget?: number; key?: string; basic?: boolean },
  ): TutorialHint | null => {
    const key = opts?.key ?? id;
    const budget = opts?.budget ?? Number.POSITIVE_INFINITY;
    if ((shows[key] ?? 0) >= budget) return null;
    if (opts?.basic && graduated) return null;
    return { id, text, key, budget };
  };

  const active = save.pets.find((pet) => pet.id === save.activePetId) ?? null;
  const hasPet = save.pets.length > 0;
  const tier2Owned = save.pets.filter((pet) => pet.tier >= 2).length;
  const capLeft = Math.max(0, config.dailyClickCap - save.daily.clicks);
  const eggPrices = Object.values(config.eggPrices);
  const cheapestEgg = eggPrices.length > 0 ? Math.min(...eggPrices) : 0;

  // —— 优先级从上到下（OnboardingGuidance.md §5）：转瞬发现/当刻动作 > 里程碑 >
  //    引流 > 温和提醒。退休项自动跳过，让位下一条，不留空窗。——

  // G1 毕业总结（终局；tutorialStep 去重，不吃展示预算）。
  if (tier2Owned >= 1 && !graduated) {
    const h = make(
      "graduation",
      fmt(TT.graduation, { collected: fixedCollectedCount(config, save), total: FIXED_DEX_TOTAL }),
    );
    if (h) return h;
  }

  // A3 收蛋（有已孵化、可收取的蛋）。
  if (hatcheryReady) {
    const h = make("collect-egg", TT.collectEgg, { budget: 3, basic: true });
    if (h) return h;
  }

  // A5 精力恢复（趴下充电）。
  if (active?.exhausted) {
    const h = make("recovering", TT.recovering, {
      budget: 3,
      basic: true,
    });
    if (h) return h;
  }

  // E2 额度用尽（纯抚摸模式）。
  if (hasPet && capLeft === 0) {
    const h = make("cap-full", TT.capFull, {
      budget: 2,
      basic: true,
    });
    if (h) return h;
  }

  // C3 融合就绪（两只同阶满级凑齐）。
  if (fusionReady(config, save)) {
    const h = make("fusion-ready", TT.fusionReady, { budget: 3, basic: true });
    if (h) return h;
  }

  // C1 临近满级（差额梯度；额度够/不够两种文案）。
  if (active && !isMaxLevel(config, active)) {
    const remain = expToMax(config, active);
    const perClick = Math.max(1, clickExpFor(config, active.tier));
    if (remain > 0 && remain <= perClick * DIFF_HINT_CLICKS) {
      const clicks = Math.max(1, Math.ceil(remain / perClick));
      const text =
        capLeft >= clicks
          ? fmt(TT.expDiffEnough, { clicks })
          : fmt(TT.expDiffCapped, { clicks });
      const h = make("expdiff", text, { budget: 3, basic: true });
      if (h) return h;
    }
  }

  // C2 满级切主宠。
  if (active && isMaxLevel(config, active) && save.pets.some((pet) => !isMaxLevel(config, pet))) {
    const h = make("max-switch", TT.maxSwitch, {
      budget: 2,
      basic: true,
    });
    if (h) return h;
  }

  // A6 商店买第二颗蛋（凑一对好融合）。孵化屋已满时不劝买——蛋只能进库存孵不了。
  if (hasPet && save.pets.length < 2 && save.coins >= cheapestEgg && !hatcheryFull(config, save)) {
    const h = make("buy-second", TT.buySecond, {
      budget: 3,
      basic: true,
    });
    if (h) return h;
  }

  // D5 升级商店（解锁更高阶蛋）。
  if (hasPet) {
    const cost = shopUpgradeCost(config, save.shopLevel ?? 1);
    if (cost != null && save.coins >= cost) {
      const h = make("shop-upgrade", TT.shopUpgrade, { budget: 1 });
      if (h) return h;
    }
  }

  // D4 放生腾位（后院满 + 有蛋待收）。
  if (hatcheryReady && save.pets.length >= yardCapacityFor(config, save.yardLevel)) {
    const h = make("release", TT.release, { budget: 2 });
    if (h) return h;
  }

  // D2 图鉴（首次拥有 2 阶物种即引到博物馆）。
  if (tier2Owned >= 1) {
    const h = make("pokedex", TT.pokedex, { budget: 1 });
    if (h) return h;
  }

  // F1 交易所（仅集成开启且有可交易/待认领时）。
  if (steamEnabled && (save.steamOutbox?.length ?? 0) > 0) {
    const h = make("steam", TT.steam, { budget: 1 });
    if (h) return h;
  }

  // E1 额度将尽（温和提醒）。
  if (hasPet && capLeft > 0 && capLeft <= Math.max(1, Math.floor(config.dailyClickCap * 0.1))) {
    const h = make("cap-near", fmt(TT.capNear, { left: capLeft }), {
      budget: 2,
      basic: true,
    });
    if (h) return h;
  }

  // A4 点击打工（有宠、仍在学基本操作）。
  if (hasPet) {
    const h = make("menu-work", TT.menuWork, { budget: 3, basic: true });
    if (h) return h;
  }

  // A1 / A2 还没有精灵：引到孵化区看第一颗蛋。
  if (!hasPet) {
    const hasIncubating = save.eggs.some((egg) => egg.slot != null);
    if (uiMode === "menu") {
      const h = make("first-egg", TT.firstEgg, { budget: 2 });
      if (h) return h;
    }
    if (uiMode === "pet") {
      const h = make("no-pet-click", hasIncubating ? TT.noPetMenu : TT.noPetTry, { budget: 2 });
      if (h) return h;
    }
  }

  return null;
}
