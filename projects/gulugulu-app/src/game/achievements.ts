// Steam 成就纯判定（镜像 src-tauri/src/game/achievements.rs::satisfied_achievements）。
// 返回当前存档已达成的成就 API Name 集合（幂等、无副作用）。预览模式与前端庆祝据此判定；
// 口径逐条对齐 docs/gdd/SteamAchievements.md §8（48 枚，其中工厂 24 枚）。
// Rust↔TS 必须逐条一致。

import type { GameConfig, GameSave } from "../types";
import { normalizeLanguage } from "../i18n/core";
import { GENERATED_RUNTIME_LOCALES } from "../i18n/generatedLocales";

/** 48 个成就 ID（发布后冻结；顺序 = §8 清单）。 */
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
  // J 工厂新增（另有 17 枚复用现有 ID）
  "ACH_FACTORY_CLOCK_IN", "ACH_FACTORY_FIRST_PULSE", "ACH_FACTORY_ENDLESS_30",
  "ACH_FACTORY_REVENUE_II", "ACH_FACTORY_REVENUE_III", "ACH_FACTORY_COMBO_10",
  "ACH_FACTORY_DEBT_FREE",
];

/** 24 枚《危楼打工记》成就；17 枚复用 ID + 7 枚新 ID。 */
export const FACTORY_ACHIEVEMENT_IDS: ReadonlySet<string> = new Set([
  "ACH_DEX_25", "ACH_AI_COLLECT_5", "ACH_DEX_45", "ACH_TIER4", "ACH_TIER5",
  "ACH_HATCHERY_MAX", "ACH_YARD_MAX", "ACH_TOKENS_50M", "ACH_WORKSHOP_COLLECT_5",
  "ACH_ALL_ELEMENTS", "ACH_SHOP_MAX", "ACH_FULL_HOUSE", "ACH_AI_LADDER_5",
  "ACH_WORKSHOP_WEAR", "ACH_FUSE_50", "ACH_WORKSHOP_PUBLISH_5", "ACH_FIRST_PENTA",
  "ACH_FACTORY_CLOCK_IN", "ACH_FACTORY_FIRST_PULSE", "ACH_FACTORY_ENDLESS_30",
  "ACH_FACTORY_REVENUE_II", "ACH_FACTORY_REVENUE_III", "ACH_FACTORY_COMBO_10",
  "ACH_FACTORY_DEBT_FREE",
]);

/**
 * 2026-07-28：基于当前 rogueConfig 的 100,000 局“有限叠加”生存条件模拟冻结。
 * Revenue I/II/III 分别锚定约第 5/20/30 班；Mega Pulse 锚定第 30 班。
 */
export const FACTORY_SCORE_THRESHOLDS = Object.freeze({
  revenueI: 1_500,
  revenueII: 1_000_000,
  revenueIII: 50_000_000,
  bigPulse: 2_000_000,
});

const FACTORY_ALL_INSPECTIONS_MASK = 0b1111;
export const FACTORY_ADVANCED_THRESHOLDS = Object.freeze({
  endlessShift: 30,
  repeatRuns: 50,
  upgradeLevels: 20,
});

/** 隐藏成就 ID（Steam 后台 hidden=true；原彩蛋六枚 + 首次破产 + 六枚工厂高数值挑战）。 */
export const HIDDEN_ACHIEVEMENT_IDS: ReadonlySet<string> = new Set([
  "ACH_STREAK_7", "ACH_STREAK_30", "ACH_NIGHT_OWL",
  "ACH_FAREWELL", "ACH_LOVED", "ACH_TREASURY",
  "ACH_WORKSHOP_PUBLISH_5", "ACH_WORKSHOP_COLLECT_5", "ACH_AI_LADDER_5",
  "ACH_FUSE_50", "ACH_FACTORY_ENDLESS_30", "ACH_FACTORY_REVENUE_II",
  "ACH_FACTORY_REVENUE_III",
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
  if (fixed.size > 0 && dexFixed >= fixed.size) out.add("ACH_DEX_ALL63");
  if (hasFixedWithElements(6)) out.add("ACH_FLAGSHIP_KIRIN");

  // —— C. 品阶 ——
  const tier = st.highestTier ?? 0;
  if (tier >= 3) out.add("ACH_TIER3");
  if (tier >= 6) out.add("ACH_TIER6_APEX");

  // —— D. 融合 ——
  const fusions = st.totalFusions ?? 0;
  if (fusions >= 10) out.add("ACH_FUSE_10");
  if (fusions >= 200) out.add("ACH_FUSE_200");

  // —— E. AI 造物 ——
  const slots = save.recipeAiSlots ?? {};
  const slotVals = Object.values(slots);
  if (slotVals.some((v) => v.some((c) => c !== ""))) out.add("ACH_AI_FIRST");
  if (aiCollected >= 20) out.add("ACH_AI_COLLECT_20");

  // —— F. 编码伴侣 ——
  const tokens = st.totalTokensFed ?? 0;
  if (tokens >= 1_000_000) out.add("ACH_TOKENS_1M");
  if ((st.totalTokensObserved ?? 0) >= 1_000_000_000) out.add("ACH_TOKENS_1B");
  if ((st.totalKeysCharged ?? 0) >= 100_000) out.add("ACH_KEYS_100K");

  // —— G. 经济 · 建设 ——
  const earned = st.totalCoinsEarned ?? 0;
  if (earned >= 1_000_000) out.add("ACH_COINS_1M");
  // —— H. 社区 · 创意工坊 ——
  const skins = save.speciesSkins ?? {};
  if (Object.values(skins).some((v) => v.length > 0)) out.add("ACH_WORKSHOP_IMPORT");
  const published = Object.values(save.workshopPublished ?? {}).filter((f) => f !== "").length;
  if (published >= 1) out.add("ACH_WORKSHOP_PUBLISH");

  // —— I. 彩蛋（隐藏）——
  const streak = st.loginStreak ?? 0;
  if (streak >= 7) out.add("ACH_STREAK_7");
  if (streak >= 30) out.add("ACH_STREAK_30");
  if (st.nightOwl) out.add("ACH_NIGHT_OWL");
  if (st.firstReleaseDone) out.add("ACH_FAREWELL");
  if (st.dailyCapReachedEver) out.add("ACH_LOVED");
  if (earned >= 100_000_000) out.add("ACH_TREASURY");

  // —— J. 《危楼打工记》（17 枚复用 ID + 7 枚新 ID）——
  const bestShift = st.factoryRogueBestShift ?? 0;
  const bestRevenue = st.factoryRogueBestRevenue ?? 0;
  const bestPulse = st.factoryRogueBestPulse ?? 0;
  if (st.factoryRogueFirstKpi) out.add("ACH_DEX_25");
  if (st.factoryRogueFirstCard) out.add("ACH_AI_COLLECT_5");
  if (bestShift >= 5) out.add("ACH_DEX_45");
  if (bestShift >= 10) out.add("ACH_TIER4");
  if (bestShift >= 15) out.add("ACH_TIER5");
  if (st.factoryRogueGraduated || st.factoryRogueGraduatedWithoutLoan) out.add("ACH_HATCHERY_MAX");
  if (bestShift >= 25) out.add("ACH_YARD_MAX");
  if (bestRevenue >= FACTORY_SCORE_THRESHOLDS.revenueI) out.add("ACH_TOKENS_50M");
  if (bestPulse >= FACTORY_SCORE_THRESHOLDS.bigPulse) out.add("ACH_WORKSHOP_COLLECT_5");
  if ((st.factoryRogueBestDesks ?? 0) >= 3) out.add("ACH_ALL_ELEMENTS");
  if ((st.factoryRogueBestDesks ?? 0) >= 6) out.add("ACH_SHOP_MAX");
  if ((st.factoryRogueMaxLoadout ?? 0) >= 10) out.add("ACH_FULL_HOUSE");
  if ((st.factoryRogueMaxUpgradeLevels ?? 0) >= FACTORY_ADVANCED_THRESHOLDS.upgradeLevels) out.add("ACH_AI_LADDER_5");
  if (st.factoryRogueStrikeClear) out.add("ACH_WORKSHOP_WEAR");
  if ((st.factoryRogueRunsFinished ?? 0) >= FACTORY_ADVANCED_THRESHOLDS.repeatRuns) out.add("ACH_FUSE_50");
  if (st.factoryRogueFirstBankruptcy) out.add("ACH_WORKSHOP_PUBLISH_5");
  if (((st.factoryRogueInspectionMask ?? 0) & FACTORY_ALL_INSPECTIONS_MASK) === FACTORY_ALL_INSPECTIONS_MASK) {
    out.add("ACH_FIRST_PENTA");
  }
  if ((st.factoryRogueRunsStarted ?? 0) >= 1) out.add("ACH_FACTORY_CLOCK_IN");
  if (bestPulse >= 1) out.add("ACH_FACTORY_FIRST_PULSE");
  if (bestShift >= FACTORY_ADVANCED_THRESHOLDS.endlessShift) out.add("ACH_FACTORY_ENDLESS_30");
  if (bestRevenue >= FACTORY_SCORE_THRESHOLDS.revenueII) out.add("ACH_FACTORY_REVENUE_II");
  if (bestRevenue >= FACTORY_SCORE_THRESHOLDS.revenueIII) out.add("ACH_FACTORY_REVENUE_III");
  if ((st.factoryRogueBestCombo ?? 0) >= 10) out.add("ACH_FACTORY_COMBO_10");
  if (st.factoryRogueGraduatedWithoutLoan) out.add("ACH_FACTORY_DEBT_FREE");

  return out;
}

/** 成就显示名（中/英）——前端 toast/庆祝用；与 Steam 后台文案（§8）一致。 */
export const ACHIEVEMENT_NAMES: Record<string, { zh: string; en: string }> = {
  ACH_FIRST_HATCH: { zh: "初次相遇", en: "First Friend" },
  ACH_FIRST_MAXLEVEL: { zh: "亲手养大", en: "Hand-Raised" },
  ACH_FIRST_FUSION: { zh: "初次融合", en: "First Fusion" },
  ACH_DEX_10: { zh: "小有收藏", en: "Budding Collector" },
  ACH_DEX_25: { zh: "KPI 达标", en: "KPI Met" },
  ACH_DEX_45: { zh: "五班老员工", en: "Five Shifts In" },
  ACH_DEX_ALL63: { zh: "图鉴全谱", en: "Gotta Fuse 'Em All" },
  ACH_ALL_ELEMENTS: { zh: "三线开工", en: "Triple Connection" },
  ACH_FIRST_PENTA: { zh: "经得起检查", en: "Audit-Proof" },
  ACH_FLAGSHIP_KIRIN: { zh: "晶麒麟", en: "The Prism Kirin" },
  ACH_TIER3: { zh: "三阶登场", en: "Ascendant III" },
  ACH_TIER4: { zh: "中层骨干", en: "Middle Management" },
  ACH_TIER5: { zh: "坚持到终面", en: "Final Interview" },
  ACH_TIER6_APEX: { zh: "巅峰", en: "Apex Predator" },
  ACH_FUSE_10: { zh: "融合学徒", en: "Fusion Apprentice" },
  ACH_FUSE_50: { zh: "工厂常客", en: "Factory Regular" },
  ACH_FUSE_200: { zh: "融合宗师", en: "Fusion Grandmaster" },
  ACH_AI_FIRST: { zh: "AI 造物", en: "AI's Own Design" },
  ACH_AI_COLLECT_5: { zh: "入职福利", en: "First Perk" },
  ACH_AI_COLLECT_20: { zh: "AI 图鉴", en: "Variant Curator" },
  ACH_AI_LADDER_5: { zh: "构筑大成", en: "Master Builder" },
  ACH_TOKENS_1M: { zh: "代码小食", en: "Code Snack" },
  ACH_TOKENS_50M: { zh: "小有营收", en: "Revenue I" },
  ACH_TOKENS_1B: { zh: "代码盛宴", en: "Code Banquet" },
  ACH_KEYS_100K: { zh: "键盘伙伴", en: "Keystroke Companion" },
  ACH_COINS_1M: { zh: "小有积蓄", en: "Nest Egg" },
  ACH_HATCHERY_MAX: { zh: "光荣毕业", en: "Clocked Out" },
  ACH_YARD_MAX: { zh: "自愿加班", en: "Overtime Volunteer" },
  ACH_SHOP_MAX: { zh: "六路通吃", en: "Full Circuit" },
  ACH_FULL_HOUSE: { zh: "全员到岗", en: "Full Roster" },
  ACH_WORKSHOP_IMPORT: { zh: "换装", en: "Dress Up" },
  ACH_WORKSHOP_WEAR: { zh: "劳资融洽", en: "Labor Relations" },
  ACH_WORKSHOP_PUBLISH: { zh: "分享创作", en: "Share the Love" },
  ACH_WORKSHOP_PUBLISH_5: { zh: "现金流断裂", en: "Insolvent" },
  ACH_WORKSHOP_COLLECT_5: { zh: "两百万大单", en: "Mega Pulse" },
  ACH_STREAK_7: { zh: "常来看看", en: "Regular" },
  ACH_STREAK_30: { zh: "月度陪伴", en: "Monthly Companion" },
  ACH_NIGHT_OWL: { zh: "夜猫子", en: "Night Owl" },
  ACH_FAREWELL: { zh: "挥手告别", en: "Bittersweet" },
  ACH_LOVED: { zh: "爱意满满", en: "Loved to the Brim" },
  ACH_TREASURY: { zh: "富甲一方", en: "Tycoon" },
  ACH_FACTORY_CLOCK_IN: { zh: "打卡上班", en: "Clocked In" },
  ACH_FACTORY_FIRST_PULSE: { zh: "第一笔工资", en: "First Paycheck" },
  ACH_FACTORY_ENDLESS_30: { zh: "永不下班", en: "No Clock-Out" },
  ACH_FACTORY_REVENUE_II: { zh: "百万财报", en: "Million-Revenue Report" },
  ACH_FACTORY_REVENUE_III: { zh: "五千万奇迹", en: "Fifty-Million Miracle" },
  ACH_FACTORY_COMBO_10: { zh: "连轴转", en: "Tenfold Combo" },
  ACH_FACTORY_DEBT_FREE: { zh: "无贷毕业", en: "Debt-Free Graduate" },
};

/** 成就 id → 当前语言显示名（未知 id 回落 id 本身）。 */
export function achievementDisplayName(id: string, lang: string): string {
  const n = ACHIEVEMENT_NAMES[id];
  if (!n) return id;
  const language = normalizeLanguage(lang) ?? "en";
  if (language === "zh-Hans") return n.zh;
  if (language === "en") return n.en;
  return GENERATED_RUNTIME_LOCALES[language]?.achievements[id] ?? n.en;
}
