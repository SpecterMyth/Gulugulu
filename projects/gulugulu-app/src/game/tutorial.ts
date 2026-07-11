import type { GameConfig, GameSave, PetInstance } from "../types";
import { expToNext, isMaxLevel, maxLevelForTier } from "./config";
import type { UiMode } from "./GamePanels";

// ---------------------------------------------------------------------------
// 状态触发式新手引导（OnboardingFlow.md §二·调整 1）
//
// 旧引导是 tutorialStep 0-3 的线性计数，只覆盖前 10 分钟。这里改成"由存档状态
// 推导"的节点表：接管完整三天。每个节点带一个 when(ctx) 谓词，`computeTutorialHint`
// 返回优先级最高（最靠后里程碑优先）的命中节点。绝大多数节点随玩家动作自然清除，
// 只有终局"毕业"节点用 tutorialStep 作"已确认"标记避免长期复读。Rust 侧零改动
// ——tutorialStep 字段已存在，语义仍是"已达成的最远步骤"。
// ---------------------------------------------------------------------------

export type TutorialHint = { id: string; text: string };

/** 已达成毕业里程碑（首只 2 阶）后写入的 tutorialStep，避免终局提示复读。 */
export const GRADUATION_STEP = 11;

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

/** 当前拥有的不同 2 阶物种数（图鉴进度分子）。 */
export function pokedexCount(save: GameSave): number {
  return new Set(save.pets.filter((pet) => pet.tier >= 2).map((pet) => pet.species)).size;
}

/** 图鉴分母 = 融合表里所有可产出的不同 2 阶物种数（正式配置为 21）。 */
export function pokedexTotal(config: GameConfig): number {
  return new Set(Object.values(config.fusionTable)).size;
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
};

/** 距满级 ≤ 该击数时，弹"还差 X 经验 ≈ 亲手 Y 击"的目标梯度气泡。 */
const DIFF_HINT_CLICKS = 12;

export function computeTutorialHint({ save, config, uiMode }: TutorialContext): TutorialHint | null {
  const prices = Object.values(config.eggPrices);
  const cheapest = prices.length > 0 ? Math.min(...prices) : 0;
  const active = save.pets.find((pet) => pet.id === save.activePetId) ?? null;
  const hasPet = save.pets.length > 0;
  const tier2Owned = save.pets.filter((pet) => pet.tier >= 2).length;
  const goldEggIncubating = save.eggs.some(
    (egg) => egg.tier >= 2 && egg.slot != null && egg.hatchAt != null,
  );
  const canFuse = fusionReady(config, save);
  const activeMax = active ? isMaxLevel(config, active) : false;
  const hasNonMax = save.pets.some((pet) => !isMaxLevel(config, pet));

  // ⑪ 毕业总结（终局，一次性 —— 由 tutorialStep 在展示后置为 GRADUATION_STEP）。
  if (tier2Owned >= 1 && save.tutorialStep < GRADUATION_STEP) {
    return {
      id: "graduation",
      text: `🎉 第一只 2 阶伙伴诞生！图鉴 ${pokedexCount(save)}/${pokedexTotal(config)} —— 白天挂机、午休点两下、下班融合、早上收蛋，明天见`,
    };
  }
  // ⑩ 金蛋过夜：2 阶蛋在孵，最强次日预约钩子。
  if (goldEggIncubating) {
    return { id: "gold-egg", text: "金蛋孵化中✨ 关掉应用也照孵，回来就能见到全新伙伴" };
  }
  // ⑨ 融合择时（含"21 种可能"悬念）：两只同阶满级凑齐。
  if (canFuse) {
    return {
      id: "fusion-ready",
      text: "两只满级同阶伙伴凑齐啦！去后院走到一起融合——结果有 21 种可能",
    };
  }
  // ⑥ 满级切主宠：主宠满了但还有没满的，提示换一只继续养。
  if (activeMax && hasNonMax) {
    return { id: "max-switch", text: "主宠满级⭐ 去后院换一只没满的继续养，两只都满级就能融合" };
  }
  // 差额气泡（观察者·目标梯度）：主宠临近满级时把里程碑"留"给玩家的手指。
  if (active && !activeMax) {
    const remain = expToMax(config, active);
    const clicks = Math.max(1, Math.ceil(remain / Math.max(1, config.clickExp)));
    if (remain > 0 && remain <= config.clickExp * DIFF_HINT_CLICKS) {
      return { id: "expdiff", text: `还差 ${remain} 经验 ≈ 亲手点 ${clicks} 下就满级！` };
    }
  }
  // ④ 攒够金币买第二颗蛋（凑一对好融合）。
  if (hasPet && save.pets.length < 2 && save.coins >= cheapest && uiMode !== "backyard") {
    return { id: "buy-second", text: "金币够啦！去后院商店买第二颗蛋，凑一对好融合" };
  }
  // ⑤ 挂机说明：睡着也在长经验，教会"离场也有收益"。
  if (active?.exhausted) {
    return { id: "idle-grows", text: "它睡一会儿就好——挂着不用管，经验也在悄悄涨" };
  }
  // ③ 菜单打开点我打工。
  if (hasPet && (uiMode === "pet" || uiMode === "menu") && save.tutorialStep < 3) {
    return { id: "menu-work", text: "菜单打开时点我就能打工赚钱！精力用完我会小睡一会儿" };
  }
  // ①② 还没有精灵：引导去孵化区看第一颗蛋。
  if (!hasPet) {
    const hasIncubating = save.eggs.some((egg) => egg.slot != null);
    if (uiMode === "menu") return { id: "first-egg", text: "你的第一颗蛋在后院孵着呢，去看看" };
    if (uiMode === "pet") {
      return {
        id: "no-pet-click",
        text: hasIncubating ? "点我一下，打开菜单去看孵化区" : "点我一下试试！",
      };
    }
  }
  return null;
}
