// Steam 成就纯判定（镜像 src-tauri/src/game/achievements.rs::satisfied_achievements）。
// 返回当前存档已达成的成就 API Name 集合（幂等、无副作用）。预览模式与前端庆祝据此判定；
// 口径逐条对齐 docs/gdd/SteamAchievements.md §8（41 枚）。Rust↔TS 必须逐条一致。

import type { GameConfig, GameSave } from "../types";

/** 41 个成就 ID（发布后冻结；顺序 = §8 A–I 组）。 */
export const ALL_ACHIEVEMENT_IDS: readonly string[] = [
  // A 起步
  "ACH_FIRST_HATCH", "ACH_FIRST_MAXLEVEL", "ACH_FIRST_FUSION",
  // B 图鉴
  "ACH_DEX_10", "ACH_DEX_25", "ACH_DEX_45", "ACH_DEX_ALL63",
  "ACH_ALL_ELEMENTS", "ACH_FIRST_PENTA", "ACH_FLAGSHIP_KIRIN",
  // C 品阶
  "ACH_TIER3", "ACH_TIER4", "ACH_TIER5", "ACH_TIER6_APEX",
  // D 融合
  "ACH_FUSE_10", "ACH_FUSE_50", "ACH_FUSE_200",
  // E AI 造物
  "ACH_AI_FIRST", "ACH_AI_COLLECT_5", "ACH_AI_COLLECT_20", "ACH_AI_LADDER_5",
  // F 编码伴侣
  "ACH_TOKENS_1M", "ACH_TOKENS_50M", "ACH_TOKENS_1B", "ACH_KEYS_100K",
  // G 经济 · 建设
  "ACH_COINS_1M", "ACH_HATCHERY_MAX", "ACH_YARD_MAX", "ACH_SHOP_MAX", "ACH_FULL_HOUSE",
  // H 工坊
  "ACH_WORKSHOP_IMPORT", "ACH_WORKSHOP_WEAR", "ACH_WORKSHOP_PUBLISH",
  "ACH_WORKSHOP_PUBLISH_5", "ACH_WORKSHOP_COLLECT_5",
  // I 彩蛋（隐藏）
  "ACH_STREAK_7", "ACH_STREAK_30", "ACH_NIGHT_OWL",
  "ACH_FAREWELL", "ACH_LOVED", "ACH_TREASURY",
];

/** 隐藏成就 ID（Steam 后台 hidden=true；§8-I 六枚）。 */
export const HIDDEN_ACHIEVEMENT_IDS: ReadonlySet<string> = new Set([
  "ACH_STREAK_7", "ACH_STREAK_30", "ACH_NIGHT_OWL",
  "ACH_FAREWELL", "ACH_LOVED", "ACH_TREASURY",
]);

export function satisfiedAchievements(config: GameConfig, save: GameSave): Set<string> {
  const out = new Set<string>();
  const st = save.stats ?? {};
  const byRecipe = config.speciesByRecipe ?? {};
  const dex = save.dexObtained ?? {};

  const fixed = new Set(Object.values(byRecipe));
  const dexKeys = Object.keys(dex);
  const dexFixed = dexKeys.filter((k) => fixed.has(k)).length;
  const aiCollected = dexKeys.filter((k) => !fixed.has(k)).length;

  const elementCount = (key: string) => key.split("+").length;
  const hasFixedWithElements = (n: number) =>
    Object.entries(byRecipe).some(
      ([key, code]) => elementCount(key) === n && dex[code] !== undefined,
    );

  // —— A. 起步 ——
  if (dexKeys.length > 0) out.add("ACH_FIRST_HATCH");
  if (st.firstMaxlevelDone) out.add("ACH_FIRST_MAXLEVEL");
  if (save.tutorialFirstFusionDone) out.add("ACH_FIRST_FUSION");

  // —— B. 图鉴 ——
  if (dexFixed >= 10) out.add("ACH_DEX_10");
  if (dexFixed >= 25) out.add("ACH_DEX_25");
  if (dexFixed >= 45) out.add("ACH_DEX_45");
  if (fixed.size > 0 && dexFixed >= fixed.size) out.add("ACH_DEX_ALL63");
  const bases = ["normal", "fire", "electric", "water", "grass", "ice"]
    .map((e) => byRecipe[e])
    .filter((c): c is string => !!c);
  if (bases.length === 6 && bases.every((c) => dex[c] !== undefined)) out.add("ACH_ALL_ELEMENTS");
  if (hasFixedWithElements(5)) out.add("ACH_FIRST_PENTA");
  if (hasFixedWithElements(6)) out.add("ACH_FLAGSHIP_KIRIN");

  // —— C. 品阶 ——
  const tier = st.highestTier ?? 0;
  if (tier >= 3) out.add("ACH_TIER3");
  if (tier >= 4) out.add("ACH_TIER4");
  if (tier >= 5) out.add("ACH_TIER5");
  if (tier >= 6) out.add("ACH_TIER6_APEX");

  // —— D. 融合 ——
  const fusions = st.totalFusions ?? 0;
  if (fusions >= 10) out.add("ACH_FUSE_10");
  if (fusions >= 50) out.add("ACH_FUSE_50");
  if (fusions >= 200) out.add("ACH_FUSE_200");

  // —— E. AI 造物 ——
  const slots = save.recipeAiSlots ?? {};
  const slotVals = Object.values(slots);
  if (slotVals.some((v) => v.some((c) => c !== ""))) out.add("ACH_AI_FIRST");
  if (aiCollected >= 5) out.add("ACH_AI_COLLECT_5");
  if (aiCollected >= 20) out.add("ACH_AI_COLLECT_20");
  const deepest = slotVals.reduce((m, v) => Math.max(m, v.filter((c) => c !== "").length), 0);
  if (deepest >= 5) out.add("ACH_AI_LADDER_5");

  // —— F. 编码伴侣 ——
  const tokens = st.totalTokensFed ?? 0;
  if (tokens >= 1_000_000) out.add("ACH_TOKENS_1M");
  if (tokens >= 50_000_000) out.add("ACH_TOKENS_50M");
  if (tokens >= 1_000_000_000) out.add("ACH_TOKENS_1B");
  if ((st.totalKeysCharged ?? 0) >= 100_000) out.add("ACH_KEYS_100K");

  // —— G. 经济 · 建设 ——
  const earned = st.totalCoinsEarned ?? 0;
  if (earned >= 1_000_000) out.add("ACH_COINS_1M");
  if ((save.hatcheryLevel ?? 1) >= (config.hatcherySlots?.length ?? 8)) out.add("ACH_HATCHERY_MAX");
  if ((save.yardLevel ?? 1) >= (config.yardCapacity?.length ?? 48)) out.add("ACH_YARD_MAX");
  if ((save.shopLevel ?? 1) >= (config.shopMaxLevel ?? 4)) out.add("ACH_SHOP_MAX");
  if ((save.pets?.length ?? 0) >= 20) out.add("ACH_FULL_HOUSE");

  // —— H. 社区 · 创意工坊 ——
  const skins = save.speciesSkins ?? {};
  if (Object.values(skins).some((v) => v.length > 0)) out.add("ACH_WORKSHOP_IMPORT");
  if (Object.values(save.skinSelected ?? {}).some((s) => s.startsWith("ws:"))) out.add("ACH_WORKSHOP_WEAR");
  const published = Object.values(save.workshopPublished ?? {}).filter((f) => f !== "").length;
  if (published >= 1) out.add("ACH_WORKSHOP_PUBLISH");
  if (published >= 5) out.add("ACH_WORKSHOP_PUBLISH_5");
  const skinsTotal = Object.values(skins).reduce((n, v) => n + v.length, 0);
  if (skinsTotal >= 5) out.add("ACH_WORKSHOP_COLLECT_5");

  // —— I. 彩蛋（隐藏）——
  const streak = st.loginStreak ?? 0;
  if (streak >= 7) out.add("ACH_STREAK_7");
  if (streak >= 30) out.add("ACH_STREAK_30");
  if (st.nightOwl) out.add("ACH_NIGHT_OWL");
  if (st.firstReleaseDone) out.add("ACH_FAREWELL");
  if (st.dailyCapReachedEver) out.add("ACH_LOVED");
  if (earned >= 100_000_000) out.add("ACH_TREASURY");

  return out;
}

/** 成就显示名（中/英）——前端 toast/庆祝用；与 Steam 后台文案（§8）一致。 */
export const ACHIEVEMENT_NAMES: Record<string, { zh: string; en: string }> = {
  ACH_FIRST_HATCH: { zh: "初次相遇", en: "First Friend" },
  ACH_FIRST_MAXLEVEL: { zh: "亲手养大", en: "Hand-Raised" },
  ACH_FIRST_FUSION: { zh: "初次融合", en: "First Fusion" },
  ACH_DEX_10: { zh: "小有收藏", en: "Budding Collector" },
  ACH_DEX_25: { zh: "图鉴达人", en: "Seasoned Collector" },
  ACH_DEX_45: { zh: "图鉴大师", en: "Master Collector" },
  ACH_DEX_ALL63: { zh: "图鉴全谱", en: "Gotta Fuse 'Em All" },
  ACH_ALL_ELEMENTS: { zh: "五行俱全", en: "Six of a Kind" },
  ACH_FIRST_PENTA: { zh: "五元素", en: "Pentad" },
  ACH_FLAGSHIP_KIRIN: { zh: "晶麒麟", en: "The Prism Kirin" },
  ACH_TIER3: { zh: "三阶登场", en: "Ascendant III" },
  ACH_TIER4: { zh: "四阶登场", en: "Ascendant IV" },
  ACH_TIER5: { zh: "五阶登场", en: "Ascendant V" },
  ACH_TIER6_APEX: { zh: "巅峰", en: "Apex Predator" },
  ACH_FUSE_10: { zh: "融合学徒", en: "Fusion Apprentice" },
  ACH_FUSE_50: { zh: "融合工匠", en: "Fusion Artisan" },
  ACH_FUSE_200: { zh: "融合宗师", en: "Fusion Grandmaster" },
  ACH_AI_FIRST: { zh: "AI 造物", en: "AI's Own Design" },
  ACH_AI_COLLECT_5: { zh: "AI 收藏家", en: "Variant Collector" },
  ACH_AI_COLLECT_20: { zh: "AI 图鉴", en: "Variant Curator" },
  ACH_AI_LADDER_5: { zh: "深挖一脉", en: "Deep Vein" },
  ACH_TOKENS_1M: { zh: "代码小食", en: "Code Snack" },
  ACH_TOKENS_50M: { zh: "代码正餐", en: "Code Feast" },
  ACH_TOKENS_1B: { zh: "代码盛宴", en: "Code Banquet" },
  ACH_KEYS_100K: { zh: "键盘伙伴", en: "Keystroke Companion" },
  ACH_COINS_1M: { zh: "小有积蓄", en: "Nest Egg" },
  ACH_HATCHERY_MAX: { zh: "孵化满级", en: "Full Hatchery" },
  ACH_YARD_MAX: { zh: "后院满员", en: "Grand Backyard" },
  ACH_SHOP_MAX: { zh: "商店满级", en: "Deluxe Shop" },
  ACH_FULL_HOUSE: { zh: "高朋满座", en: "Full House" },
  ACH_WORKSHOP_IMPORT: { zh: "换装", en: "Dress Up" },
  ACH_WORKSHOP_WEAR: { zh: "焕新一面", en: "New Look" },
  ACH_WORKSHOP_PUBLISH: { zh: "分享创作", en: "Share the Love" },
  ACH_WORKSHOP_PUBLISH_5: { zh: "创作达人", en: "Prolific Creator" },
  ACH_WORKSHOP_COLLECT_5: { zh: "衣柜收藏", en: "Wardrobe" },
  ACH_STREAK_7: { zh: "常来看看", en: "Regular" },
  ACH_STREAK_30: { zh: "月度陪伴", en: "Monthly Companion" },
  ACH_NIGHT_OWL: { zh: "夜猫子", en: "Night Owl" },
  ACH_FAREWELL: { zh: "挥手告别", en: "Bittersweet" },
  ACH_LOVED: { zh: "爱意满满", en: "Loved to the Brim" },
  ACH_TREASURY: { zh: "富甲一方", en: "Tycoon" },
};

/** 成就 id → 当前语言显示名（未知 id 回落 id 本身）。 */
export function achievementDisplayName(id: string, lang: string): string {
  const n = ACHIEVEMENT_NAMES[id];
  if (!n) return id;
  return lang === "zh" ? n.zh : n.en;
}
