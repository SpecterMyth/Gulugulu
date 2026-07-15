// 图鉴数据模型（docs/gdd/PokedexSystem.md）——纯函数，供 BackyardScene 渲染。
// 收集口径 = dexObtained（曾获即入册、放生仍在）；配方槽位/概率与融合掷骰同源
// （fusionSlots + config.aiTotalChanceByElementCount），保证"图鉴显示的概率 = 真实掷骰"。

import type { GameConfig, GameSave } from "../types";
import { aiTotalChancePercentFor } from "./config";
import { effectiveFrontier, frontierM, obtainedPrefix, slotWeights, weightsSum } from "./fusionSlots";

export const FIXED_DEX_TOTAL = 63; // 6 单元素 + 57 多元素固定物种
const MAX_AI_SLOTS = 10;

export type DexSlot = {
  /** 槽号：0 = 固定物种，1..10 = AI 变种。 */
  index: number;
  /** 该槽物种 codename（AI 未生成槽为 undefined）。 */
  codename?: string;
  collected: boolean;
  /** 曾获总只数（dexObtained）。 */
  everCount: number;
  /** 当前融合生成该槽的概率（百分比，0~100；已收集或锁定为 0 展示用途）。 */
  probability: number;
  /** 未解锁（槽号 > 当前前沿）——显示 🔒。 */
  locked: boolean;
  /** AI 神秘槽（未生成，形体未知）——用通用神秘剪影。 */
  mystery: boolean;
};

export type DexRecipe = {
  key: string;
  elements: string[];
  elementCount: number;
  /** 0 号固定物种 codename。 */
  fixed: string;
  /** 0 号 + 1..10 号槽（AI 槽随进度增减；未解锁槽 locked）。 */
  slots: DexSlot[];
  /** 已解锁 AI 变种数（recipeAiSlots 长度）。 */
  registered: number;
};

export type PokedexModel = {
  /** 曾获物种集合（放生仍在）。 */
  collected: Set<string>;
  everCount: (species: string) => number;
  /** 6 只单元素基础物种的槽（无 AI）。 */
  baseSlots: DexSlot[];
  /** 57 个多元素配方行（按元素数降序 = 高阶→低阶）。 */
  recipes: DexRecipe[];
  /** 已收集固定物种数（/63 主进度）。 */
  fixedCollected: number;
  /** 已收集 AI 变种数（bonus 计数）。 */
  aiCollected: number;
};

function everCountOf(save: GameSave, species: string): number {
  return save.dexObtained?.[species] ?? 0;
}

/** 该配方已获得槽号集合（镜像 game::obtained_slots_for）。 */
function obtainedSlots(save: GameSave, key: string, fixed: string, aiSlots: string[]): Set<number> {
  const set = new Set<number>();
  if (everCountOf(save, fixed) >= 1) set.add(0);
  aiSlots.forEach((code, i) => {
    if (everCountOf(save, code) >= 1) set.add(i + 1);
  });
  return set;
}

/** 构建一个配方行（含每槽的收集/概率/锁定/神秘态）。 */
function buildRecipe(config: GameConfig, save: GameSave, key: string, fixed: string): DexRecipe {
  const elements = key.split("+");
  const elementCount = elements.length;
  const aiSlots = save.recipeAiSlots?.[key] ?? [];
  const registered = aiSlots.length;
  const obtained = obtainedSlots(save, key, fixed, aiSlots);
  const aPercent = aiTotalChancePercentFor(config, elementCount);
  const m = frontierM(obtainedPrefix(obtained));
  const eff = effectiveFrontier(m, registered, true); // 图鉴按"CLI 可用"展示可解锁潜力
  const weights = slotWeights(aPercent, eff);
  const total = Math.max(1, weightsSum(weights));

  const slots: DexSlot[] = [];
  for (let i = 0; i <= MAX_AI_SLOTS; i += 1) {
    const codename = i === 0 ? fixed : aiSlots[i - 1];
    const collected = codename != null && everCountOf(save, codename) >= 1;
    const withinRollable = i <= eff && i < weights.length;
    slots.push({
      index: i,
      codename,
      collected,
      everCount: codename ? everCountOf(save, codename) : 0,
      probability: !collected && withinRollable ? Math.round((weights[i] / total) * 1000) / 10 : 0,
      locked: !collected && i > eff,
      mystery: i > 0 && codename == null,
    });
  }
  return { key, elements, elementCount, fixed, slots, registered };
}

export function buildPokedexModel(config: GameConfig, save: GameSave): PokedexModel {
  const byRecipe = config.speciesByRecipe ?? {};
  const collected = new Set<string>(Object.keys(save.dexObtained ?? {}).filter((s) => everCountOf(save, s) >= 1));

  const baseKeys: string[] = [];
  const recipeKeys: string[] = [];
  for (const key of Object.keys(byRecipe)) {
    (key.includes("+") ? recipeKeys : baseKeys).push(key);
  }

  // 基础物种（单元素）：无 AI 槽，只有 0 号。
  const baseSlots: DexSlot[] = baseKeys
    .map((key) => byRecipe[key])
    .map((fixed) => ({
      index: 0,
      codename: fixed,
      collected: everCountOf(save, fixed) >= 1,
      everCount: everCountOf(save, fixed),
      probability: 0,
      locked: false,
      mystery: false,
    }))
    // 单元素固定元素序（normal→ice）：按 config 元素顺序稳定排。
    .sort((a, b) => elementOrder(config, a.codename) - elementOrder(config, b.codename));

  // 多元素配方按元素数升序（低阶→高阶），同元素数按配方键稳定序。
  const recipes = recipeKeys
    .map((key) => buildRecipe(config, save, key, byRecipe[key]))
    .sort((a, b) => a.elementCount - b.elementCount || a.key.localeCompare(b.key));

  const fixedCollected = Object.values(byRecipe).filter((sp) => collected.has(sp)).length;
  const fixedSet = new Set(Object.values(byRecipe));
  const aiCollected = [...collected].filter((s) => !fixedSet.has(s)).length;

  return { collected, everCount: (s) => everCountOf(save, s), baseSlots, recipes, fixedCollected, aiCollected };
}

function elementOrder(config: GameConfig, species?: string): number {
  const order = ["normal", "fire", "electric", "water", "grass", "ice"];
  const el = species ? config.species[species]?.elements[0] : undefined;
  const idx = el ? order.indexOf(el) : 99;
  return idx < 0 ? 99 : idx;
}

/** 博物馆速览：已收集物种缩略图，元素数降序（高阶→低阶）+ 溢出 "+x"。
 *  返回 { shown: codenames, overflow: number }（overflow>0 时末位显示 +overflow）。 */
export function museumThumbs(
  model: PokedexModel,
  config: GameConfig,
  maxCells: number,
): { shown: string[]; overflow: number } {
  const all = [...model.collected].sort((a, b) => {
    const ea = config.species[a]?.elements.length ?? 1;
    const eb = config.species[b]?.elements.length ?? 1;
    return eb - ea || a.localeCompare(b);
  });
  if (all.length <= maxCells) return { shown: all, overflow: 0 };
  const shown = all.slice(0, Math.max(0, maxCells - 1));
  return { shown, overflow: all.length - shown.length };
}
