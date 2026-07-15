import type { GameConfig } from "../types";
import normalConfig from "./config.json";
import testConfig from "./config.test.json";
import { elementSetKey, aiTotalChancePercent } from "./fusionSlots";

export { elementSetKey } from "./fusionSlots";

/** `?test=1` switches the browser preview to the small-value test config
 *  (the Tauri backend uses GULUGULU_TEST_CONFIG=1 for the same purpose). */
export const isTestConfigRequested: boolean =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("test");

export const localGameConfig: GameConfig = (isTestConfigRequested
  ? testConfig
  : normalConfig) as unknown as GameConfig;

export function speciesInfo(config: GameConfig, species: string) {
  return config.species[species];
}

export function expToNext(config: GameConfig, tier: number, level: number): number {
  const factor = config.levelExpFactor[tier - 1] ?? 10;
  return factor * level;
}

export function maxLevelForTier(config: GameConfig, tier: number): number {
  return config.maxLevel[tier - 1] ?? 10;
}

export function isMaxLevel(config: GameConfig, pet: { tier: number; level: number }): boolean {
  return pet.level >= maxLevelForTier(config, pet.tier);
}

/** 阶系数：tierGrowthFactor^(tier−1)（镜像 game_config.rs::tier_factor）。 */
export function tierFactor(config: GameConfig, tier: number): number {
  return Math.pow(Math.max(1, config.tierGrowthFactor), Math.max(0, tier - 1));
}

/** 每回复 1 点精力所需秒数（按阶放大；镜像 stamina_regen_seconds_for）。 */
export function staminaRegenSecondsFor(config: GameConfig, tier: number): number {
  return Math.max(1, config.staminaRegenSecondsBase) * tierFactor(config, tier);
}

/** 每 1 点精力需要的按键数（镜像 keys_per_stamina_for）。 */
export function keysPerStaminaFor(config: GameConfig, tier: number): number {
  return Math.max(1, config.keysPerStaminaBase) * tierFactor(config, tier);
}

/** 每 1 点精力需要的 token 数（镜像 tokens_per_stamina_for）。 */
export function tokensPerStaminaFor(config: GameConfig, tier: number): number {
  return Math.max(1, config.tokensPerStaminaBase) * tierFactor(config, tier);
}

/** 点击经验：clickExpBase × 阶系数（镜像 click_exp_for）。 */
export function clickExpFor(config: GameConfig, tier: number): number {
  return config.clickExpBase * tierFactor(config, tier);
}

/** 点击金币：(base + perLevel×level) × 阶系数（镜像 click_coins_for）。 */
export function clickCoinsFor(config: GameConfig, tier: number, level: number): number {
  return (config.clickCoinsBase + config.clickCoinsPerLevel * level) * tierFactor(config, tier);
}

export function baseSpeciesForElement(config: GameConfig, element: string): string | undefined {
  return Object.entries(config.species).find(
    ([, info]) => info.tier === 1 && info.elements[0] === element,
  )?.[0];
}

/** 旧模型：双亲首元素配对 → fusionTable。融合 2.0 已由 speciesForSet 取代，保留兼容。 */
export function fusionResult(config: GameConfig, elementA: string, elementB: string): string | undefined {
  const key = [elementA, elementB].sort().join("+");
  return config.fusionTable[key];
}

/** 融合 2.0：配方（元素集合并集）→ 0 号固定物种 codename（镜像 Rust species_codename_for_set）。 */
export function speciesForSet(config: GameConfig, elements: string[]): string | undefined {
  return config.speciesByRecipe?.[elementSetKey(elements)];
}

/** 按亲代阶数的融合费（镜像 fusion_fee_for；越界钳末项，再回退旧 fusionFee）。 */
export function fusionFeeFor(config: GameConfig, parentTier: number): number {
  const fees = config.fusionFees;
  if (fees && fees.length > 0) return fees[Math.min(parentTier - 1, fees.length - 1)] ?? fees[fees.length - 1];
  return config.fusionFee;
}

/** 触发 AI 变种的总概率（百分数整数），按元素数查表（config 权威，缺项回退硬编码表）。 */
export function aiTotalChancePercentFor(config: GameConfig, elementCount: number): number {
  const p = config.aiTotalChanceByElementCount?.[String(elementCount)];
  if (p != null) return Math.round(Math.min(1, Math.max(0, p)) * 100);
  return aiTotalChancePercent(elementCount);
}

/** 分阶蛋价乘数（默认 15；镜像 egg_tier_price_multiplier）。 */
function eggTierMult(config: GameConfig): number {
  return Math.max(1, config.eggTierPriceMultiplier ?? 15);
}

/** 单颗「T 阶 · E 属性」蛋价 = 该属性 1 阶基价 × mult^(阶−1)（镜像 egg_price_for）。 */
export function eggPriceFor(config: GameConfig, element: string, tier: number): number {
  const base = config.eggPrices[element] ?? 0;
  return base * Math.pow(eggTierMult(config), Math.max(0, tier - 1));
}

/** 放生返还等效蛋价（乘法口径、按**实例阶**；镜像 equivalent_egg_price）。 */
export function equivalentEggPrice(config: GameConfig, species: string, tier: number): number {
  return equivalentEggPriceForInfo(config, config.species[species], tier);
}

/** 同 equivalentEggPrice，但直接给 info——AI 自定义物种不在 config.species 里。
 *  = (Σ 各元素 1 阶基价) × mult^(实例阶−1)（EconomyScaling.md §8）。 */
export function equivalentEggPriceForInfo(
  config: GameConfig,
  info: { elements: string[] } | undefined,
  tier: number,
): number {
  if (!info) return 0;
  const baseSum = info.elements.reduce((s, e) => s + (config.eggPrices[e] ?? 0), 0);
  return baseSum * Math.pow(eggTierMult(config), Math.max(0, tier - 1));
}

/** 商店最高等级 = 可售最高蛋阶（默认 4；镜像 shop_max_level）。 */
export function shopMaxLevel(config: GameConfig): number {
  return Math.max(1, config.shopMaxLevel ?? 4);
}

/** 从 shopLevel 升到 +1 的费用（索引 = shopLevel−1；已满级返回 null；镜像 shop_upgrade_cost）。 */
export function shopUpgradeCost(config: GameConfig, shopLevel: number): number | null {
  if (shopLevel >= shopMaxLevel(config)) return null;
  return config.shopUpgradeCosts?.[shopLevel - 1] ?? null;
}

/** 蛋池按元素数的整数权重 w(c)=denom^(6−c)（镜像 egg_rarity_weight）。 */
export function eggRarityWeight(config: GameConfig, elementCount: number): number {
  const denom = Math.max(1, config.eggRarityFalloffDenom ?? 3);
  return Math.pow(denom, 6 - Math.min(6, Math.max(0, elementCount)));
}

type EggPoolSave = {
  dexObtained?: Record<string, number>;
  customSpecies?: Record<string, { info: { tier?: number; elements: string[] } }>;
};

/** 「T 阶 · E 属性」蛋候选物种及整数权重（镜像 egg_pool_candidates）：含该属性、
 *  元素数 ≤ 蛋阶、且已解锁（dexObtained≥1）；元素数=1 的 6 只基础种恒可售。
 *  跳过 21 只 legacy 二阶物种。按键排序 → 与 Rust BTreeMap 顺序一致（掷点可复现）。 */
export function eggPoolCandidates(
  config: GameConfig,
  save: EggPoolSave,
  element: string,
  tier: number,
): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  const push = (codename: string, info: { tier?: number; elements: string[] }) => {
    const count = info.elements.length;
    if (count < 1 || count > tier) return;
    if (!info.elements.includes(element)) return;
    const always = count === 1;
    const unlocked = (save.dexObtained?.[codename] ?? 0) >= 1;
    if (!(always || unlocked)) return;
    out.push([codename, eggRarityWeight(config, count)]);
  };
  for (const codename of Object.keys(config.species).sort()) {
    const info = config.species[codename];
    if ((info.tier ?? 0) === 2) continue; // legacy 二阶副本不进配方蛋池
    push(codename, info);
  }
  const custom = save.customSpecies ?? {};
  for (const codename of Object.keys(custom).sort()) {
    push(codename, custom[codename].info);
  }
  return out;
}

/** 按整数权重从蛋池掷定物种（镜像 roll_egg_species）。空池 → undefined。 */
export function rollEggSpecies(
  config: GameConfig,
  save: EggPoolSave,
  element: string,
  tier: number,
  roll: number,
): string | undefined {
  const pool = eggPoolCandidates(config, save, element, tier);
  if (pool.length === 0) return undefined;
  const total = Math.max(1, pool.reduce((s, [, w]) => s + w, 0));
  let pick = ((roll % total) + total) % total;
  for (const [codename, weight] of pool) {
    if (pick < weight) return codename;
    pick -= weight;
  }
  return pool[pool.length - 1][0];
}

export function hatcherySlotCount(config: GameConfig, hatcheryLevel: number): number {
  return config.hatcherySlots[hatcheryLevel - 1] ?? 1;
}

/** 孵化进度（0..1）+ 剩余秒数，供蛋语的裂纹递进与临门抖动使用。 */
export function eggHatchInfo(
  config: GameConfig,
  egg: { hatchKind: string; hatchAt?: number | null },
  now: number,
): { total: number; remaining: number; progress: number } {
  const total = config.hatchSeconds[egg.hatchKind] ?? 180;
  if (egg.hatchAt == null) return { total, remaining: total, progress: 0 };
  const remaining = Math.max(0, egg.hatchAt - now);
  const progress = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 1;
  return { total, remaining, progress };
}

export function yardCapacityFor(config: GameConfig, yardLevel: number): number {
  return config.yardCapacity[yardLevel - 1] ?? 3;
}
