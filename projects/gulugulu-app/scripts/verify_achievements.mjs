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
const { satisfiedAchievements, ALL_ACHIEVEMENT_IDS, ACHIEVEMENT_NAMES, HIDDEN_ACHIEVEMENT_IDS } = M;

const config = JSON.parse(readFileSync(new URL("../src/game/config.json", import.meta.url), "utf8"));
const fixed = Object.values(config.speciesByRecipe);

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) {
    failures += 1;
    console.error(`✗ ${msg}`);
  }
};

// —— 目录自检 ——
ok(ALL_ACHIEVEMENT_IDS.length === 41, `41 枚成就（实得 ${ALL_ACHIEVEMENT_IDS.length}）`);
ok(new Set(ALL_ACHIEVEMENT_IDS).size === 41, "成就 ID 无重复");
ok(HIDDEN_ACHIEVEMENT_IDS.size === 6, `6 枚隐藏（实得 ${HIDDEN_ACHIEVEMENT_IDS.size}）`);
ok(
  ALL_ACHIEVEMENT_IDS.every((id) => ACHIEVEMENT_NAMES[id]?.zh && ACHIEVEMENT_NAMES[id]?.en),
  "每枚成就有中英显示名",
);
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

// 3. 六元素齐 + 全谱 + 五元素 + 旗舰。
{
  const dex = {};
  fixed.forEach((c) => (dex[c] = 1));
  const got = evalSave({ dexObtained: dex });
  ok(got.has("ACH_ALL_ELEMENTS"), "五行俱全");
  ok(got.has("ACH_DEX_ALL63"), "图鉴全谱");
  ok(got.has("ACH_DEX_45"), "图鉴 45");
  ok(got.has("ACH_FIRST_PENTA"), "五元素物种");
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
  ok(got.has("ACH_AI_COLLECT_5") && !got.has("ACH_AI_COLLECT_20"), "收集 5 不含 20");
  ok(got.has("ACH_AI_LADDER_5"), "单配方阶梯 5");
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
  ok(got.has("ACH_TIER3") && got.has("ACH_TIER5") && !got.has("ACH_TIER6_APEX"), "品阶 5 不含 6");
  ok(got.has("ACH_FUSE_10") && got.has("ACH_FUSE_50") && !got.has("ACH_FUSE_200"), "融合 50 不含 200");
  ok(got.has("ACH_TOKENS_1M") && got.has("ACH_TOKENS_50M") && !got.has("ACH_TOKENS_1B"), "Token 5000万不含10亿");
  ok(got.has("ACH_KEYS_100K"), "键盘 10 万");
  ok(got.has("ACH_COINS_1M") && !got.has("ACH_TREASURY"), "赚 100万不含 1亿");
  ok(got.has("ACH_HATCHERY_MAX") && got.has("ACH_YARD_MAX") && got.has("ACH_SHOP_MAX"), "三设施满级");
  ok(got.has("ACH_FULL_HOUSE"), "同时 20 只");
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
  ok(got.has("ACH_WORKSHOP_PUBLISH") && got.has("ACH_WORKSHOP_PUBLISH_5"), "发布 1 + 5");
  ok(got.has("ACH_WORKSHOP_WEAR"), "换上工坊皮肤");
  ok(got.has("ACH_STREAK_7") && !got.has("ACH_STREAK_30"), "连登 7 不含 30");
  ok(got.has("ACH_NIGHT_OWL") && got.has("ACH_FAREWELL") && got.has("ACH_LOVED"), "夜猫子/告别/爱意");
}

if (failures === 0) {
  console.log(`✓ verify_achievements: all checks passed (41 achievements, evaluator parity)`);
} else {
  console.error(`\n✗ verify_achievements: ${failures} check(s) failed`);
  process.exit(1);
}
