// 成就纯判定冒烟：bundle achievements.ts（type-only 导入被擦除）后用合成存档跑
// satisfiedAchievements，核对与 SteamAchievements.md §8 / Rust achievements.rs 一致。
// 跑法（projects/gulugulu-app 下）：node scripts/verify_achievements.mjs

import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";

const entry = new URL("../src/game/achievements.ts", import.meta.url);
const { outputFiles } = buildSync({
  entryPoints: [entry.pathname.replace(/^\//, "")],
  bundle: true,
  format: "esm",
  write: false,
  loader: { ".json": "json" },
  logLevel: "silent",
});
const code = outputFiles[0].text;
const M = await import("data:text/javascript;base64," + Buffer.from(code, "utf8").toString("base64"));
const {
  satisfiedAchievements,
  ALL_ACHIEVEMENT_IDS,
  FACTORY_ACHIEVEMENT_IDS,
  FACTORY_SCORE_THRESHOLDS,
  FACTORY_ADVANCED_THRESHOLDS,
  ACHIEVEMENT_NAMES,
  HIDDEN_ACHIEVEMENT_IDS,
} = M;

const config = JSON.parse(readFileSync(new URL("../src/game/config.json", import.meta.url), "utf8"));
const rustSource = readFileSync(new URL("../src-tauri/src/game/achievements.rs", import.meta.url), "utf8");
const fixed = Object.values(config.speciesByRecipe);

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) {
    failures += 1;
    console.error(`✗ ${msg}`);
  }
};

// —— 目录自检 ——
ok(ALL_ACHIEVEMENT_IDS.length === 48, `48 枚成就（实得 ${ALL_ACHIEVEMENT_IDS.length}）`);
ok(new Set(ALL_ACHIEVEMENT_IDS).size === 48, "成就 ID 无重复");
ok(FACTORY_ACHIEVEMENT_IDS.size === 24, `24 枚工厂成就（实得 ${FACTORY_ACHIEVEMENT_IDS.size}）`);
ok(
  [...FACTORY_ACHIEVEMENT_IDS].every((id) => ALL_ACHIEVEMENT_IDS.includes(id)),
  "工厂成就均属于 48 枚总目录",
);
ok(HIDDEN_ACHIEVEMENT_IDS.size === 13, `13 枚隐藏（实得 ${HIDDEN_ACHIEVEMENT_IDS.size}）`);
ok(HIDDEN_ACHIEVEMENT_IDS.has("ACH_WORKSHOP_PUBLISH_5"), "首次破产设为隐藏成就");
ok(
  ["ACH_WORKSHOP_COLLECT_5", "ACH_AI_LADDER_5", "ACH_FUSE_50", "ACH_FACTORY_ENDLESS_30",
    "ACH_FACTORY_REVENUE_II", "ACH_FACTORY_REVENUE_III"].every((id) => HIDDEN_ACHIEVEMENT_IDS.has(id)),
  "六枚工厂高数值成就均隐藏",
);
ok(
  ALL_ACHIEVEMENT_IDS.every((id) => ACHIEVEMENT_NAMES[id]?.zh && ACHIEVEMENT_NAMES[id]?.en),
  "每枚成就有中英显示名",
);
ok(
  [...FACTORY_ACHIEVEMENT_IDS].every((id) => rustSource.includes(`"${id}"`)),
  "24 枚工厂 ID 均存在于 Rust 镜像",
);
for (const [rustName, value] of [
  ["FACTORY_REVENUE_I", FACTORY_SCORE_THRESHOLDS.revenueI],
  ["FACTORY_REVENUE_II", FACTORY_SCORE_THRESHOLDS.revenueII],
  ["FACTORY_REVENUE_III", FACTORY_SCORE_THRESHOLDS.revenueIII],
  ["FACTORY_BIG_PULSE", FACTORY_SCORE_THRESHOLDS.bigPulse],
]) {
  const compact = rustSource.replaceAll("_", "").replace(/\s+/g, "");
  ok(
    compact.includes(`const${rustName.replaceAll("_", "")}:u64=${value};`),
    `${rustName} 的 Rust/TS 冻结阈值一致`,
  );
}
ok(fixed.length >= 63, `固定物种 codename ≥63（实得 ${fixed.length}）`);

const base = { dexObtained: {}, recipeAiSlots: {}, pets: [], stats: {}, workshopPublished: {}, speciesSkins: {}, skinSelected: {} };
const evalSave = (patch) => satisfiedAchievements(config, { ...base, ...patch });

// 1. 空档 → 零成就。
ok(evalSave({}).size === 0, "空存档零成就");

// 2. 图鉴阶梯 + 首孵。
{
  const dex = {};
  fixed.slice(0, 10).forEach((c) => (dex[c] = 1));
  const got = evalSave({ dexObtained: dex });
  ok(got.has("ACH_FIRST_HATCH"), "首次孵化");
  ok(got.has("ACH_DEX_10") && !got.has("ACH_DEX_25"), "图鉴 10 不含 25");
}

// 3. 六元素齐 + 全谱 + 旗舰；已复用 ID 不再由旧图鉴条件解锁。
{
  const dex = {};
  fixed.forEach((c) => (dex[c] = 1));
  const got = evalSave({ dexObtained: dex });
  ok(!got.has("ACH_ALL_ELEMENTS"), "六基础元素不再解锁已复用的 ACH_ALL_ELEMENTS");
  ok(got.has("ACH_DEX_ALL63"), "图鉴全谱");
  ok(!got.has("ACH_DEX_25") && !got.has("ACH_DEX_45"), "旧图鉴 25/45 条件不再解锁复用 ID");
  ok(!got.has("ACH_FIRST_PENTA"), "五元素物种不再解锁已复用 ID");
  ok(got.has("ACH_FLAGSHIP_KIRIN"), "六元素旗舰");
}

// 4. AI 造物：5 个变种入 dex + 一条配方 5 槽。
{
  const dex = {};
  for (let i = 0; i < 5; i++) dex[`aif99${i}`] = 1;
  const got = evalSave({
    dexObtained: dex,
    recipeAiSlots: { "fire+water": ["a", "b", "c", "d", "e"] },
  });
  ok(got.has("ACH_AI_FIRST"), "首个 AI 变种生成");
  ok(!got.has("ACH_AI_COLLECT_5") && !got.has("ACH_AI_COLLECT_20"), "收集 5 不解锁已复用 ID");
  ok(!got.has("ACH_AI_LADDER_5"), "单配方阶梯 5 不解锁已复用 ID");
}

// 5. 品阶 / 融合 / 经济 高水位。
{
  const got = evalSave({
    stats: { highestTier: 5, totalFusions: 50, totalCoinsEarned: 1_000_000, totalTokensFed: 50_000_000, totalKeysCharged: 100_000 },
    hatcheryLevel: config.hatcherySlots.length,
    yardLevel: config.yardCapacity.length,
    shopLevel: config.shopMaxLevel ?? 4,
    pets: Array.from({ length: 20 }, (_, i) => ({ id: `p${i}` })),
  });
  ok(got.has("ACH_TIER3") && !got.has("ACH_TIER4") && !got.has("ACH_TIER5") && !got.has("ACH_TIER6_APEX"), "旧品阶只保留 3/6");
  ok(got.has("ACH_FUSE_10") && !got.has("ACH_FUSE_50") && !got.has("ACH_FUSE_200"), "旧融合只保留 10/200");
  ok(got.has("ACH_TOKENS_1M") && !got.has("ACH_TOKENS_50M") && !got.has("ACH_TOKENS_1B"), "旧 Token 只保留 1M/1B");
  ok(got.has("ACH_KEYS_100K"), "键盘 10 万");
  ok(got.has("ACH_COINS_1M") && !got.has("ACH_TREASURY"), "赚 100万不含 1亿");
  ok(!got.has("ACH_HATCHERY_MAX") && !got.has("ACH_YARD_MAX") && !got.has("ACH_SHOP_MAX"), "旧设施条件不解锁复用 ID");
  ok(!got.has("ACH_FULL_HOUSE"), "旧 20 宠条件不解锁复用 ID");
}

// 6. 工坊 + 隐藏。
{
  const wp = {};
  for (let i = 0; i < 5; i++) wp[`aif0${i}`] = `111${i}`;
  const got = evalSave({
    workshopPublished: wp,
    skinSelected: { aif0101: "ws:222" },
    stats: { loginStreak: 7, nightOwl: true, firstReleaseDone: true, dailyCapReachedEver: true },
  });
  ok(got.has("ACH_WORKSHOP_PUBLISH") && !got.has("ACH_WORKSHOP_PUBLISH_5"), "旧工坊只保留发布 1");
  ok(!got.has("ACH_WORKSHOP_WEAR"), "旧换装条件不解锁复用 ID");
  ok(got.has("ACH_STREAK_7") && !got.has("ACH_STREAK_30"), "连登 7 不含 30");
  ok(got.has("ACH_NIGHT_OWL") && got.has("ACH_FAREWELL") && got.has("ACH_LOVED"), "夜猫子/告别/爱意");
}

// 7. 工厂判定矩阵：前一刻全锁；最高档状态恰好覆盖 24 枚。
{
  const T = FACTORY_SCORE_THRESHOLDS;
  const below = evalSave({
    stats: {
      factoryRogueRunsStarted: 0,
      factoryRogueRunsFinished: FACTORY_ADVANCED_THRESHOLDS.repeatRuns - 1,
      factoryRogueBestRevenue: T.revenueI - 1,
      factoryRogueBestShift: 4,
      factoryRogueBestPulse: 0,
      factoryRogueBestCombo: 9,
      factoryRogueBestDesks: 2,
      factoryRogueMaxUpgradeLevels: FACTORY_ADVANCED_THRESHOLDS.upgradeLevels - 1,
      factoryRogueMaxLoadout: 9,
      factoryRogueInspectionMask: 0b0111,
    },
  });
  ok(
    [...FACTORY_ACHIEVEMENT_IDS].every((id) => !below.has(id)),
    "工厂阈值前一刻不得提前解锁",
  );
  const pulseBoundary = evalSave({ stats: { factoryRogueBestPulse: T.bigPulse - 1 } });
  ok(
    pulseBoundary.has("ACH_FACTORY_FIRST_PULSE") && !pulseBoundary.has("ACH_WORKSHOP_COLLECT_5"),
    "有效脉冲先解锁 First Paycheck，但未提前解锁 Big Pulse",
  );
  const debtFree = evalSave({ stats: { factoryRogueGraduatedWithoutLoan: true } });
  ok(
    debtFree.has("ACH_FACTORY_DEBT_FREE") && debtFree.has("ACH_HATCHERY_MAX"),
    "无贷毕业同时满足普通毕业",
  );

  const all = evalSave({
    stats: {
      factoryRogueRunsStarted: 1,
      factoryRogueRunsFinished: FACTORY_ADVANCED_THRESHOLDS.repeatRuns,
      factoryRogueBestRevenue: T.revenueIII,
      factoryRogueBestShift: FACTORY_ADVANCED_THRESHOLDS.endlessShift,
      factoryRogueBestPulse: T.bigPulse,
      factoryRogueBestCombo: 10,
      factoryRogueBestDesks: 6,
      factoryRogueMaxUpgradeLevels: FACTORY_ADVANCED_THRESHOLDS.upgradeLevels,
      factoryRogueMaxLoadout: 10,
      factoryRogueFirstKpi: true,
      factoryRogueFirstCard: true,
      factoryRogueFirstBankruptcy: true,
      factoryRogueStrikeClear: true,
      factoryRogueInspectionMask: 0b1111,
      factoryRogueGraduated: true,
      factoryRogueGraduatedWithoutLoan: true,
    },
  });
  const unlockedFactory = [...FACTORY_ACHIEVEMENT_IDS].filter((id) => all.has(id));
  ok(unlockedFactory.length === 24, `最高档工厂状态解锁 24 枚（实得 ${unlockedFactory.length}）`);
}

if (failures === 0) {
  console.log("✓ verify_achievements: all checks passed (48 total / 24 factory)");
} else {
  console.error(`\n✗ verify_achievements: ${failures} check(s) failed`);
  process.exit(1);
}
