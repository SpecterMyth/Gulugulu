// 图鉴数据模型（docs/gdd/PokedexSystem.md）——纯函数，供 BackyardScene 渲染。
// 收集口径 = dexObtained（曾获即入册、放生仍在）。
// 每槽概率 = Steam 生成的**全局静态加权池**（11 槽：0 号固定 + 1..10 AI，权重恒定、
// 与已收集进度无关——不再依赖前置宠物/前沿解锁），与 build_itemdefs_core.mjs 的并集
// 生成器 bundle 逐位同源（slotWeights(a, MAX_AI_SLOTS)），保证"图鉴显示的概率 = Steam 真实掷骰"。

import type { CustomSpeciesEntry, GameConfig, GameSave } from "../types";
import { aiTotalChancePercentFor } from "./config";
import {
  elementSetKey,
  multiElementRecipesOrdered,
  slotCodename,
  slotWeights,
  weightsSum,
} from "./fusionSlots";

export const FIXED_DEX_TOTAL = 63; // 6 单元素 + 57 多元素固定物种
const MAX_AI_SLOTS = 10;

export type DexSlot = {
  /** 槽号：0 = 固定物种，1..10 = AI 变种。 */
  index: number;
  /** 该槽物种 codename（AI 未生成槽为 undefined）。 */
  codename?: string;
  /** 该槽的全局确定性 codename（aif+2位序+2位槽；神秘槽也有——皮肤先入库徽章/
   *  详情弹窗据此查 speciesSkins）。0 号固定槽 = codename 本身。 */
  deterministicCodename?: string;
  collected: boolean;
  /** 曾获总只数（dexObtained）。 */
  everCount: number;
  /** 该槽的固定生成概率（百分比原值，0~100；Steam 静态加权池、与收集进度无关；
   *  已收集/非融合槽为 0，不显徽章）。展示用 formatDropChance 格式化。 */
  probability: number;
  /** AI 神秘槽（未生成，形体未知）——用通用神秘剪影。 */
  mystery: boolean;
};

/** 图鉴槽位定位（详情弹窗持 locator 而非 slot 快照——save 更新后从最新 model
 *  解引用，永不过期）。recipeKey=null → 基础物种行（baseSlots[slotIndex]）。 */
export type DexLocator = { recipeKey: string | null; slotIndex: number };

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

/** 掉率徽章格式化（图鉴格子与详情弹窗共用）：≤0 → 空串（非融合槽/已收集，不显徽章）；
 *  正但四舍五入不足 0.1% → "<0.1%"（可掷但极罕见的尾部槽）；否则保留一位小数。 */
export function formatDropChance(percent: number): string {
  if (percent <= 0) return "";
  const rounded = Math.round(percent * 10) / 10;
  return rounded === 0 ? "<0.1%" : `${rounded}%`;
}

/** 构建一个配方行（含每槽的收集/概率/神秘态）。`ordinal` = 配方在多元素
 *  有序表里的序号（推导每槽全局确定性 codename；-1 = 未知配方，不推导）。 */
function buildRecipe(config: GameConfig, save: GameSave, key: string, fixed: string, ordinal: number): DexRecipe {
  const elements = key.split("+");
  const elementCount = elements.length;
  const aiSlots = save.recipeAiSlots?.[key] ?? [];
  const registered = aiSlots.length;
  const aPercent = aiTotalChancePercentFor(config, elementCount);
  // Steam 生成为「全局静态加权池」：11 槽（0 号固定 + 1..10 AI）权重恒定、与已收集进度
  // 无关（不再有前沿/前置解锁）。每槽概率 = 该槽在满 MAX_AI_SLOTS 池里的固定占比，
  // 与 build_itemdefs_core.mjs 的并集生成器 bundle 逐位同源。
  const weights = slotWeights(aPercent, MAX_AI_SLOTS);
  const total = Math.max(1, weightsSum(weights));

  const slots: DexSlot[] = [];
  for (let i = 0; i <= MAX_AI_SLOTS; i += 1) {
    const codename = i === 0 ? fixed : aiSlots[i - 1];
    const collected = codename != null && everCountOf(save, codename) >= 1;
    slots.push({
      index: i,
      codename,
      deterministicCodename: i === 0 ? fixed : ordinal >= 0 ? slotCodename(ordinal, i) : undefined,
      collected,
      everCount: codename ? everCountOf(save, codename) : 0,
      probability: collected ? 0 : (weights[i] / total) * 100,
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
      deterministicCodename: fixed,
      collected: everCountOf(save, fixed) >= 1,
      everCount: everCountOf(save, fixed),
      probability: 0,
      mystery: false,
    }))
    // 单元素固定元素序（normal→ice）：按 config 元素顺序稳定排。
    .sort((a, b) => elementOrder(config, a.codename) - elementOrder(config, b.codename));

  // 多元素配方按元素数升序（低阶→高阶），同元素数按配方键稳定序。
  // 配方序号（= Steam itemdef / 工坊 petId 的冻结序）用于推导每槽确定性 codename。
  const ordered = multiElementRecipesOrdered(Object.keys(byRecipe));
  const recipes = recipeKeys
    .map((key) => buildRecipe(config, save, key, byRecipe[key], ordered.indexOf(key)))
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

// --- 皮肤系统工具（SkinWorkshop.md） ---------------------------------------

/** 新式确定性 codename（aif+2位序+2位槽）解析；旧随机名/非法 → null。 */
function parseSlotCodename(codename: string): { ordinal: number; slot: number } | null {
  const m = /^aif(\d{2})(\d{2})$/.exec(codename);
  if (!m) return null;
  const ordinal = Number(m[1]);
  const slot = Number(m[2]);
  if (ordinal > 56 || slot < 1 || slot > MAX_AI_SLOTS) return null;
  return { ordinal, slot };
}

/** AI 物种 codename → 所属配方键：新式名走冻结序号反查；旧式 hex 走本体
 *  entry 的元素集合兜底。都拿不到 → null。 */
export function recipeKeyForCodename(
  codename: string,
  config: GameConfig,
  customSpecies: Record<string, CustomSpeciesEntry> | undefined,
): string | null {
  const parsed = parseSlotCodename(codename);
  if (parsed) {
    const ordered = multiElementRecipesOrdered(Object.keys(config.speciesByRecipe ?? {}));
    if (parsed.ordinal < ordered.length) return ordered[parsed.ordinal];
  }
  const elements = customSpecies?.[codename]?.info.elements;
  if (elements && elements.length > 0) return elementSetKey(elements);
  return null;
}

/** 默认皮肤的本体 = 同配方 0 号固定物种 codename（将来换成专门生成的默认皮肤时
 *  只改这一处解析）。 */
export function resolveDefaultCodename(
  codename: string,
  config: GameConfig,
  customSpecies: Record<string, CustomSpeciesEntry> | undefined,
): string | null {
  const key = recipeKeyForCodename(codename, config, customSpecies);
  return key ? config.speciesByRecipe?.[key] ?? null : null;
}

/** 导入成功后的图鉴跳转定位：先精确扫 model（含基础行），扫不到再按新式
 *  codename 的 (序号, 槽号) 直接构造（未生成的神秘槽也能跳到）。 */
export function dexLocatorForCodename(codename: string, model: PokedexModel): DexLocator | null {
  const baseIndex = model.baseSlots.findIndex((s) => s.codename === codename);
  if (baseIndex >= 0) return { recipeKey: null, slotIndex: baseIndex };
  for (const recipe of model.recipes) {
    const slotIndex = recipe.slots.findIndex(
      (s) => s.codename === codename || s.deterministicCodename === codename,
    );
    if (slotIndex >= 0) return { recipeKey: recipe.key, slotIndex };
  }
  return null;
}

/** 按 locator 取最新槽位（详情弹窗每次渲染解引用；失效 → null 自动关）。 */
export function dexSlotAt(model: PokedexModel, locator: DexLocator): { slot: DexSlot; recipe: DexRecipe | null } | null {
  if (locator.recipeKey == null) {
    const slot = model.baseSlots[locator.slotIndex];
    return slot ? { slot, recipe: null } : null;
  }
  const recipe = model.recipes.find((r) => r.key === locator.recipeKey);
  const slot = recipe?.slots[locator.slotIndex];
  return recipe && slot ? { slot, recipe } : null;
}
