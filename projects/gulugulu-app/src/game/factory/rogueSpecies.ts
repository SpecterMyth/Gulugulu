// 物种进局元数据推导(工种/编号/吸取层数/基础值)。
// 规则:docs/gdd/factory_working/02-numbers.md §1 + plans/factory_rogue/PLAN.md §2「编号推导」。
//  · 目录物种 groupNo=1;AI/自定义物种按「其元素组内 AI 物种的创建序」取 1,2,3…
//    (组内第 1 个 AI=1 → 压榨 3 只、第 10 个=10 → 压榨 12 只);多元素取各组编号最大值。
//  · 创建序从存档结构推导:save.customSpecies 的 createdAt 升序,平局按插入序
//    (Record 字符串键保序;与 recipeAiSlots 的槽号口径一致)。
//  · 目录宠 reach = 2;AI 宠 reach = groupNo + 2;baseValue 按元素数计算。

import type { GameConfig, GameSave } from "../../types";
import { baseValueForTier } from "./rogueConfig";
import { ROGUE_ELEMENTS, type RogueElement, type SpeciesRogueMeta } from "./rogueTypes";

const VALID_ELEMENTS = new Set<string>(ROGUE_ELEMENTS);

/** 元素数组清洗:滤非法值 + 去重,空则兜底 ["normal"](与 FactoryScene.speciesElements 同兜底)。 */
function normalizeElements(raw: readonly string[] | undefined | null): RogueElement[] {
  const out: RogueElement[] = [];
  for (const el of raw ?? []) {
    if (VALID_ELEMENTS.has(el) && !out.includes(el as RogueElement)) out.push(el as RogueElement);
  }
  return out.length > 0 ? out : ["normal"];
}

/** AI 物种 codename → 组内编号(各元素组按创建序独立计数 1,2,3…,取所属组最大)。 */
function buildAiGroupNos(save: GameSave): Map<string, number> {
  const entries = Object.entries(save.customSpecies ?? {}).map(([code, entry], idx) => ({
    code,
    elements: normalizeElements(entry?.info?.elements),
    createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : 0,
    idx,
  }));
  entries.sort((a, b) => a.createdAt - b.createdAt || a.idx - b.idx);
  const counters = new Map<RogueElement, number>();
  const out = new Map<string, number>();
  for (const e of entries) {
    let groupNo = 1;
    for (const el of e.elements) {
      const n = (counters.get(el) ?? 0) + 1;
      counters.set(el, n);
      groupNo = Math.max(groupNo, n);
    }
    out.set(e.code, groupNo);
  }
  return out;
}

/** 当前后院拥有的物种 → 进局元数据表。图鉴中已解锁但后院不再持有的物种不能进入工厂。 */
export function buildSpeciesMeta(config: GameConfig, save: GameSave): Record<string, SpeciesRogueMeta> {
  const aiGroupNos = buildAiGroupNos(save);
  const out: Record<string, SpeciesRogueMeta> = {};
  const owned = new Set(save.pets.map((pet) => pet.species));
  for (const species of owned) {
    const info = config.species[species] ?? save.customSpecies?.[species]?.info;
    if (!info) continue;
    const elements = normalizeElements(info?.elements);
    const aiGroupNo = aiGroupNos.get(species);
    const groupNo = aiGroupNo ?? 1;
    out[species] = {
      species,
      elements,
      tierCount: Math.min(6, Math.max(1, elements.length)),
      groupNo,
      reach: aiGroupNo == null ? 2 : aiGroupNo + 2,
      baseValue: baseValueForTier(elements.length),
    };
  }
  return out;
}

/** 工种(=元素数 1~6,决定雇价基准与通胀)。 */
export function speciesTier(meta: SpeciesRogueMeta): number {
  return meta.tierCount;
}

/** 出战名单的元素并集(商店维度一过滤 / 桌图亲和提示用)。 */
export function unionElements(metas: SpeciesRogueMeta[]): RogueElement[] {
  const out: RogueElement[] = [];
  for (const m of metas) {
    for (const el of m.elements) if (!out.includes(el)) out.push(el);
  }
  return out;
}
