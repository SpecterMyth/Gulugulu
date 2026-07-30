// 《危楼打工记》营收 / 单脉冲 / Steam i32 分数压力测试。
//
// 跑法：
//   node scripts/factory_score_balance.mjs [runs]
//
// 重要边界：
// - RogueRun 的真实收入依赖 Matter 场景里的落体、连通图、商店选择和逐个 onSettled
//   回调，当前没有可在 Node 中自动完成整局的无头玩家接口。
// - 本脚本因此是“已活到该班”的确定性 Monte Carlo 包络，不是通关率模拟；KPI、奖金、
//   无限模式增长率与卡牌字段来自当前 rogueConfig，脉冲拆分/加班/过冲是显式假设。
// - 极值为固定样本中的 sample max，不声称是数学上界。理论上无限模式无上限，任何固定
//   SCORE_UNIT 最终都会溢出 i32；必须同时冻结一个受支持的冲榜班次范围或溢出政策。

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { buildSync } from "esbuild";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const { outputFiles } = buildSync({
  stdin: {
    contents: `
      export {
        CARD_PARAMS,
        COMBO_CAP,
        KPI_BONUS_RATE,
        KPI_START,
        TOTAL_SHIFTS,
        kpiForShift,
      } from "./src/game/factory/rogueConfig";
    `,
    resolveDir: appDir,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
});
const bundlePath = join(appDir, "node_modules", ".cache", "factory-score-balance.bundle.mjs");
mkdirSync(dirname(bundlePath), { recursive: true });
writeFileSync(bundlePath, outputFiles[0].text);
const CFG = await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);

const RUNS = Math.max(1_000, Number.parseInt(process.argv[2] ?? "20000", 10) || 20_000);
const NORMAL_HORIZON = CFG.TOTAL_SHIFTS;
/** 20 个额外班次：作为首发冲榜明确支持范围的候选。 */
const LONG_HORIZON = 40;
/** 只用于揭示更远无限模式的 i32 风险，不作为首发可达性承诺。 */
const EXTREME_HORIZON = 50;
const I32_MAX = 2_147_483_647;
const SCORE_UNITS = [1, 100, 1_000];
const QUANTILES = [0.1, 0.25, 0.5, 0.75, 0.9, 0.99];
const CHECKPOINTS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const SEED = 0x51c0_4e5;

function requireSeries(cardId, field) {
  const values = CFG.CARD_PARAMS?.[cardId]?.[field];
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(`rogueConfig schema mismatch: CARD_PARAMS["${cardId}"].${field} must be a numeric array`);
  }
  return values;
}

// 显式验证这次导致崩溃的 schema，以及门槛估算依赖的核心乘区。
const FIRE_BURST = requireSeries("fire.burst", "repeats");
const FIRE_WILDFIRE = requireSeries("fire.wildfire", "spread");
/** 极限包络按基础 20 人编制估算；扩编和无限模式仍可能继续突破。 */
const FIRE_TEAM_EXTREME = 20;
const ATTR_PURE = requireSeries("attr.pure", "mult");
const ATTR_BALANCE = requireSeries("attr.balance", "mult");

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function gaussian(rng) {
  const a = Math.max(Number.EPSILON, rng());
  const b = Math.max(Number.EPSILON, rng());
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function percentile(sorted, quantile) {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * quantile;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

function quantileReport(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const report = Object.fromEntries(
    QUANTILES.map((quantile) => [
      `p${Math.round(quantile * 100)}`,
      Math.round(percentile(sorted, quantile)),
    ]),
  );
  report.sampleMax = Math.round(sorted.at(-1) ?? 0);
  return report;
}

function formatInt(value) {
  return Math.round(value).toLocaleString("en-US");
}

function profileFor(rng) {
  const roll = rng();
  // 成就平衡只模拟可重复的普通构筑，不把极限火系乘区、完美六工种或高额加班
  // 当成常态。多数玩家只获得少量有效叠加，高手档也刻意压在温和范围。
  if (roll < 0.6) {
    return {
      name: "newcomer",
      quality: 0.9,
      volatility: 0.1,
      overtime: 0.02,
      pulseDensity: 1.05,
    };
  }
  if (roll < 0.95) {
    return {
      name: "regular",
      quality: 1,
      volatility: 0.08,
      overtime: 0.05,
      pulseDensity: 1.1,
    };
  }
  return {
    name: "skilled",
    quality: 1.08,
    volatility: 0.06,
    overtime: 0.08,
    pulseDensity: 1.15,
  };
}

/**
 * 生存条件下的一班收入：
 * - KPI 本体必定已达到；
 * - KPI bonus 使用正式配置；
 * - 最后一跳过冲与剩余雇员加班使用固定、可审计的随机包络；
 * - 脉冲权重归一化到“非奖金收入”，因此单脉冲与总营收口径不会互相凭空膨胀。
 */
function simulateShift(rng, profile, runQuality, shift) {
  const kpi = CFG.kpiForShift(shift);
  const endlessDepth = Math.max(0, shift - NORMAL_HORIZON);
  const execution = clamp(
    profile.quality * runQuality * Math.exp(gaussian(rng) * profile.volatility),
    0.62,
    1.85,
  );
  const overshootRate = clamp(
    0.025 + Math.abs(gaussian(rng)) * 0.045 + Math.max(0, execution - 1) * 0.075,
    0.01,
    0.32,
  );
  const overtimeRate = clamp(
    profile.overtime
      * (0.72 + rng() * 0.62)
      * (1 + Math.min(0.5, endlessDepth * 0.012))
      * clamp(execution, 0.75, 1.5),
    0.015,
    0.9,
  );
  const pulseRevenue = Math.round(kpi * (1 + overshootRate + overtimeRate));
  const bonus = Math.max(0, Math.round(kpi * CFG.KPI_BONUS_RATE));
  const total = pulseRevenue + bonus;

  const pulseCount = Math.max(
    2,
    Math.round((5.5 + Math.sqrt(shift) * 1.15) * profile.pulseDensity),
  );
  const rawWeights = Array.from({ length: pulseCount }, () => {
    // 有限叠加口径：脉冲仍有大小差异，但不模拟完美多桌/极限连击 jackpot。
    return clamp(Math.exp(gaussian(rng) * 0.34), 0.45, 2.5);
  });
  const weightTotal = rawWeights.reduce((sum, value) => sum + value, 0);
  const maxPulse = Math.round(
    pulseRevenue * Math.max(...rawWeights) / Math.max(Number.EPSILON, weightTotal),
  );
  return { kpi, total, maxPulse };
}

function simulateRun(seed, horizon) {
  const rng = mulberry32(seed);
  const profile = profileFor(rng);
  const runQuality = clamp(Math.exp(gaussian(rng) * 0.05), 0.88, 1.12);
  const checkpoints = {};
  let revenue = 0;
  let maxPulse = 0;
  for (let shift = 1; shift <= horizon; shift++) {
    const result = simulateShift(rng, profile, runQuality, shift);
    revenue += result.total;
    maxPulse = Math.max(maxPulse, result.maxPulse);
    if (CHECKPOINTS.includes(shift)) {
      checkpoints[shift] = { revenue, maxPulse };
    }
  }
  return { profile: profile.name, revenue, maxPulse, checkpoints };
}

const results = Array.from({ length: RUNS }, (_, index) =>
  simulateRun((SEED ^ Math.imul(index + 1, 0x9e37_79b1)) >>> 0, EXTREME_HORIZON),
);

function checkpointValues(shift, field) {
  return results.map((result) => result.checkpoints[shift][field]);
}

function checkpointReport(shift) {
  return {
    shift,
    kpi: CFG.kpiForShift(shift),
    revenue: quantileReport(checkpointValues(shift, "revenue")),
    maxPulse: quantileReport(checkpointValues(shift, "maxPulse")),
  };
}

const normal = checkpointReport(NORMAL_HORIZON);
const long = checkpointReport(LONG_HORIZON);
const extreme = checkpointReport(EXTREME_HORIZON);
const checkpoints = CHECKPOINTS.map(checkpointReport);

function firstRiskShift(unit, quantileKey = "p99") {
  return checkpoints.find((entry) => entry.revenue[quantileKey] > I32_MAX * unit)?.shift ?? null;
}

const unitAnalysis = SCORE_UNITS.map((unit) => ({
  unit,
  exactRevenueCeiling: I32_MAX * unit,
  firstP99RiskShift: firstRiskShift(unit),
  normal20P99Fits: normal.revenue.p99 <= I32_MAX * unit,
  long40P99Fits: long.revenue.p99 <= I32_MAX * unit,
  extreme50P99Fits: extreme.revenue.p99 <= I32_MAX * unit,
}));
const supportedUnit = unitAnalysis.find((item) => item.long40P99Fits)?.unit ?? null;
const minimumUnitForLongP99 = Math.max(1, Math.ceil(long.revenue.p99 / I32_MAX));
const minimumUnitForExtremeP99 = Math.max(1, Math.ceil(extreme.revenue.p99 / I32_MAX));

function niceFloor(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const scaled = value / power;
  const step = scaled >= 5 ? 5 : scaled >= 2 ? 2 : scaled >= 1.5 ? 1.5 : 1;
  return Math.floor(step * power);
}

const byShift = Object.fromEntries(checkpoints.map((entry) => [entry.shift, entry]));
const thresholdSuggestions = {
  caveat: "生存条件包络；冻结成就阈值前仍需真实玩家 telemetry 校准。",
  revenue: {
    firstPlay: niceFloor(byShift[5].revenue.p50),
    skilled: niceFloor(byShift[20].revenue.p50),
    expert: niceFloor(byShift[30].revenue.p50),
    sources: ["shift5 p50", "shift20 p50", "shift30 p50"],
  },
  singlePulse: {
    firstPlay: niceFloor(byShift[5].maxPulse.p50),
    skilled: niceFloor(byShift[20].maxPulse.p50),
    expert: niceFloor(byShift[30].maxPulse.p50),
    sources: ["through shift5 p50", "through shift20 p50", "through shift30 p50"],
  },
};

const maxFireFactor =
  (1 + FIRE_BURST.at(-1) * FIRE_TEAM_EXTREME + FIRE_WILDFIRE.at(-1))
  * ATTR_PURE.at(-1)
  * (1 + CFG.COMBO_CAP);
const maxBalanceFactor =
  (1 + FIRE_BURST.at(-1) * FIRE_TEAM_EXTREME + FIRE_WILDFIRE.at(-1))
  * ATTR_BALANCE.at(-1)
  * (1 + CFG.COMBO_CAP);

console.log("\n=== 模型边界 ===");
console.log("这是生存条件下的营收/脉冲包络，不是 RogueRun 真机通关率或物理布局仿真。");
console.log(`样本 ${formatInt(RUNS)}，固定 seed 0x${SEED.toString(16)}，普通 ${NORMAL_HORIZON} 班，长无限 ${LONG_HORIZON} 班，极限探针 ${EXTREME_HORIZON} 班。`);

console.log("\n=== 当前配置快照 ===");
console.table([{
  KPI起点: CFG.KPI_START,
  KPI奖金率: CFG.KPI_BONUS_RATE,
  火爆燃Lv5追加次数: FIRE_BURST.at(-1),
  火燎原字段: "spread",
  火燎原Lv5: FIRE_WILDFIRE.at(-1),
  火队伍极限估算: FIRE_TEAM_EXTREME,
  理论火纯色乘区: Number(maxFireFactor.toFixed(2)),
  理论火六工种乘区: Number(maxBalanceFactor.toFixed(2)),
}]);

console.log("\n=== 普通 20 班与长无限营收 ===");
console.table([
  {
    场景: "普通20班",
    KPI: normal.kpi,
    营收P10: normal.revenue.p10,
    营收P50: normal.revenue.p50,
    营收P90: normal.revenue.p90,
    营收P99: normal.revenue.p99,
    样本极值: normal.revenue.sampleMax,
    最大单脉冲P50: normal.maxPulse.p50,
    最大单脉冲P99: normal.maxPulse.p99,
    单脉冲样本极值: normal.maxPulse.sampleMax,
  },
  {
    场景: "长无限40班",
    KPI: long.kpi,
    营收P10: long.revenue.p10,
    营收P50: long.revenue.p50,
    营收P90: long.revenue.p90,
    营收P99: long.revenue.p99,
    样本极值: long.revenue.sampleMax,
    最大单脉冲P50: long.maxPulse.p50,
    最大单脉冲P99: long.maxPulse.p99,
    单脉冲样本极值: long.maxPulse.sampleMax,
  },
]);

console.log("\n=== 无限模式检查点（累计营收） ===");
console.table(checkpoints.map((entry) => ({
  班次: entry.shift,
  当班KPI: entry.kpi,
  营收P50: entry.revenue.p50,
  营收P99: entry.revenue.p99,
  样本极值: entry.revenue.sampleMax,
  最大单脉冲P50: entry.maxPulse.p50,
  最大单脉冲P99: entry.maxPulse.p99,
})));

console.log("\n=== Steam i32 SCORE_UNIT 压力测试 ===");
console.table(unitAnalysis.map((item) => ({
  SCORE_UNIT: item.unit,
  可表示精确营收上限: item.exactRevenueCeiling,
  P99首次风险班次: item.firstP99RiskShift ?? "50班内无",
  普通20班: item.normal20P99Fits ? "OK" : "溢出",
  长无限40班: item.long40P99Fits ? "OK" : "溢出",
  极限50班: item.extreme50P99Fits ? "OK" : "溢出",
})));

const scoreUnitRecommendation = supportedUnit == null
  ? {
      recommended: null,
      reason: `候选 1/100/1000 均无法覆盖长无限 ${LONG_HORIZON} 班 P99；至少需要 ${formatInt(minimumUnitForLongP99)}。`,
    }
  : {
      recommended: supportedUnit,
      reason: `覆盖普通 20 班与“活到 ${LONG_HORIZON} 班”P99，同时保留尽可能高的榜单分辨率。`,
    };

console.log("\n=== 建议 ===");
console.log(JSON.stringify({
  scoreUnit: {
    ...scoreUnitRecommendation,
    supportedHorizon: LONG_HORIZON,
    minimumUnitForLongP99,
    minimumUnitForExtreme50P99: minimumUnitForExtremeP99,
    warning: `无限模式数学上无界；活到 ${EXTREME_HORIZON} 班时 1/100/1000 的结论见上表，不能宣称永久防溢出。`,
  },
  thresholds: thresholdSuggestions,
}, null, 2));

const machineReport = {
  model: {
    kind: "survival-conditioned Monte Carlo envelope",
    realPhysics: false,
    runs: RUNS,
    seed: SEED,
    normalHorizon: NORMAL_HORIZON,
    longHorizon: LONG_HORIZON,
    extremeHorizon: EXTREME_HORIZON,
  },
  config: {
    kpiStart: CFG.KPI_START,
    kpiBonusRate: CFG.KPI_BONUS_RATE,
    wildfireSchema: "spread",
    theoreticalConfiguredMultiplier: {
      firePure: Number(maxFireFactor.toFixed(4)),
      fireBalance: Number(maxBalanceFactor.toFixed(4)),
    },
  },
  normal,
  long,
  extreme,
  checkpoints,
  unitAnalysis,
  scoreUnitRecommendation,
  thresholdSuggestions,
};

if (
  !Number.isFinite(normal.revenue.p50)
  || !Number.isFinite(long.revenue.p99)
  || normal.revenue.p50 <= 0
  || long.revenue.p50 <= normal.revenue.p50
) {
  throw new Error("factory score simulation produced invalid or non-monotonic output");
}

console.log("\n=== JSON ===");
console.log(JSON.stringify(machineReport, null, 2));
