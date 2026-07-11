import type { GameConfig } from "../types";
import normalConfig from "./config.json";
import testConfig from "./config.test.json";

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

export function clickCoins(config: GameConfig, tier: number, level: number): number {
  return (
    config.clickCoinsBase +
    config.clickCoinsPerLevel * level +
    config.clickCoinsPerTier * Math.max(0, tier - 1)
  );
}

export function baseSpeciesForElement(config: GameConfig, element: string): string | undefined {
  return Object.entries(config.species).find(
    ([, info]) => info.tier === 1 && info.elements[0] === element,
  )?.[0];
}

export function fusionResult(config: GameConfig, elementA: string, elementB: string): string | undefined {
  const key = [elementA, elementB].sort().join("+");
  return config.fusionTable[key];
}

export function equivalentEggPrice(config: GameConfig, species: string): number {
  const info = config.species[species];
  if (!info) return 0;
  if (info.tier <= 1) {
    return config.eggPrices[info.elements[0] ?? "normal"] ?? 0;
  }
  const first = info.elements[0] ?? "normal";
  const second = info.elements[1] ?? first;
  return (config.eggPrices[first] ?? 0) + (config.eggPrices[second] ?? 0) + config.tier2EggPriceBonus;
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
