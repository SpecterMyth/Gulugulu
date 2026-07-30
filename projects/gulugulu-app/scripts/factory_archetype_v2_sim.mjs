// 六系 v7「点燃 / 同化 / 吸收」方案的逐班蒙特卡洛模拟（设计验证，不接入正式逻辑）。
// 跑法：node scripts/factory_archetype_v2_sim.mjs
//
// 模型口径：
// - 5,000 名玩家；每班 3 次有效结算，单局有固定操作水平并叠加班内波动；
// - 第 1 班后完成第一次扩编和商店，第 2 班结构跃升 ×1.32，之后塔体基础成长 ×1.18/班；
// - 元素商店每次从本系 5 张卡展示 3 张，55% 的玩家会为缺失核心进行一次刷新；
// - 玩家优先补最低等级的构筑卡；属性数维度每班有 30% 概率命中目标卡；
// - 冻结、同化、生长、吸收在一次团队业绩之后生效，按“半班生效”折算当班收入；
// - 火系追加计分按“主脉冲 + 逐只点燃”建模，一般系按体型、合并基础分和暴食建模；
// - 输出中位数、25/75 分位和 KPI 达成率，校验六系都能形成爽快的成长曲线。

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { buildSync } from "esbuild";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const { outputFiles } = buildSync({
  stdin: {
    contents: `export { kpiForShift } from "./src/game/factory/rogueConfig";`,
    resolveDir: appDir,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
});
const bundlePath = join(appDir, "node_modules", ".cache", "factory-archetype-v2.bundle.mjs");
mkdirSync(dirname(bundlePath), { recursive: true });
writeFileSync(bundlePath, outputFiles[0].text);
const { kpiForShift } = await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);

const RUNS = 5_000;
const SHIFTS = 20;
const TRAINING = [1, 3, 6, 12, 20];
const CHAIN = [1, 3, 6, 12, 20];
const ATTRIBUTE = [1, 1.65, 2.5, 4.5, 8, 14];

const PARAMS = {
  fire: {
    names: ["培训", "引火链", "爆燃", "余烬", "燎原"],
    priority: [2, 3, 4, 0, 1],
    burstRepeats: [1, 2, 3, 5, 8],
    ember: [1.5, 2, 3.5, 6, 11],
    wildfireSpread: [2, 4, 6, 10, 20],
  },
  electric: {
    names: ["培训", "导线", "过载", "并联回路", "感应"],
    priority: [2, 3, 4, 1, 0],
    chain: [2, 4, 8, 16, 30],
    overloadPer: [0.1, 0.2, 0.4, 0.8, 1.5],
    overloadCap: [0.6, 1.5, 3, 6, 12],
    parallelPer: [0.3, 0.7, 1.5, 3, 6],
    inductionPer: [0.025, 0.06, 0.13, 0.27, 0.5],
  },
  ice: {
    names: ["培训", "冰桥", "冻价", "急冻通路", "超额编制奖"],
    priority: [3, 4, 2, 0, 1],
    deflateChance: [0, 0.2, 0.45, 0.75, 1],
    freezeChance: [0.22, 0.4, 0.65, 0.85, 1],
    overstaffPer: [0.06, 0.08, 0.11, 0.15, 0.2],
  },
  water: {
    names: ["培训", "水道", "工休", "同名增压", "水镜同化"],
    priority: [3, 4, 2, 0, 1],
    strikeLine: [4, 5, 7, 9, 12],
    samePer: [0.12, 0.2, 0.32, 0.5, 0.8],
    convertChance: [0.18, 0.3, 0.48, 0.72, 1],
  },
  grass: {
    names: ["培训", "藤链", "野蛮生长", "繁茂群落", "高层冠幅"],
    priority: [2, 3, 4, 0, 1],
    growChance: [0.17, 0.35, 0.6, 0.82, 1],
    crowdPerConnected: [0.08, 0.18, 0.4, 0.8, 1.6],
    heightPer: [0.1, 0.22, 0.45, 1, 2],
  },
  normal: {
    names: ["培训", "人脉", "吸收", "暴食", "打工皇帝"],
    priority: [2, 3, 4, 0, 1],
    absorbChance: [0.22, 0.35, 0.5, 0.7, 1],
    gluttonyPerSize: [0.12, 0.2, 0.32, 0.5, 0.75],
    emperorChance: [0.06, 0.1, 0.15, 0.22, 0.3],
  },
};

function levelValue(values, level, fallback = 0) {
  return level <= 0 ? fallback : values[Math.min(values.length, level) - 1];
}

function mulberry32(seed) {
  return function rng() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function normal(rng) {
  const a = Math.max(Number.EPSILON, rng());
  const b = Math.max(Number.EPSILON, rng());
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

function sample(items, count, rng) {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function binomial(n, p, rng) {
  let total = 0;
  for (let i = 0; i < n; i++) if (rng() < p) total++;
  return total;
}

function percentile(sorted, p) {
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

function chooseCard(levels, config, rng) {
  const ids = [0, 1, 2, 3, 4].filter((id) => levels[id] < 5);
  let offers = sample(ids, Math.min(3, ids.length), rng);
  const lowest = Math.min(...ids.map((id) => levels[id]));
  const wanted = config.priority.find((id) => levels[id] === lowest && levels[id] < 5);
  if (!offers.includes(wanted) && rng() < 0.55) {
    offers = sample(ids, Math.min(3, ids.length), rng);
  }
  offers.sort((a, b) => {
    const levelDiff = levels[a] - levels[b];
    return levelDiff !== 0
      ? levelDiff
      : config.priority.indexOf(a) - config.priority.indexOf(b);
  });
  levels[offers[0]]++;
}

function commonMultiplier(shift, levels, attributeLevel, structuralGrowth) {
  const training = levelValue(TRAINING, levels[0]);
  const chain = levelValue(CHAIN, levels[1]);
  const earlyExpansion = shift === 1 ? 1 : 1.32;
  const laterSteps = Math.max(0, shift - 2);
  const structure = earlyExpansion * Math.pow(structuralGrowth, laterSteps);
  const trainingMult = (15 + training) / 15;
  const chainMult = 1 + chain * 0.06;
  const attributeMult = ATTRIBUTE[Math.min(5, attributeLevel)];
  const secondaryShopMult = Math.pow(1.025, shift - 1);
  return 135 * structure * trainingMult * chainMult * attributeMult * secondaryShopMult;
}

function archetypeMultiplier(element, shift, levels, state, rng) {
  const config = PARAMS[element];
  const events = 3 + (shift >= 12 ? 1 : 0);

  if (element === "fire") {
    const repeats = levelValue(config.burstRepeats, levels[2]);
    const ember = levelValue(config.ember, levels[3], 1);
    const chain = levelValue(CHAIN, levels[1]);
    const fireCount = Math.min(9, 1 + Math.floor((shift + chain) / 3));
    const spread = Math.min(fireCount - 1, levelValue(config.wildfireSpread, levels[4]));
    const vanillaMain = 1 + 0.5 * (fireCount - 1);
    const emberMain = 1 + 0.5 * (fireCount - 1) * ember;
    const sequentialExtras = repeats * fireCount + spread;
    return (emberMain + sequentialExtras) / vanillaMain;
  }

  if (element === "electric") {
    const chain = levelValue(config.chain, levels[1]);
    const usedDepth = Math.min(15, 2 + Math.floor(shift / 4) + Math.floor(chain / 2));
    const deskCount = 1 + Math.min(6, Math.floor(Math.max(0, shift - 6 + chain) / 4));
    const lines = Math.min(48, Math.round(usedDepth * (1 + 0.65 * (deskCount - 1))));
    const overload = 1 + Math.min(
      levelValue(config.overloadCap, levels[2]),
      levelValue(config.overloadPer, levels[2]) * usedDepth,
    );
    const extraDesks = deskCount - 1;
    const parallel = 1 + levelValue(config.parallelPer, levels[3]) * extraDesks;
    const induction = 1 + levelValue(config.inductionPer, levels[4]) * lines;
    const lineBreak = rng() < 0.06 + deskCount * 0.008 ? 0.45 : 1;
    return overload * parallel * induction * lineBreak;
  }

  if (element === "ice") {
    const freezeChance = levelValue(config.freezeChance, levels[3]);
    const newFrozen = binomial(events, freezeChance * 0.82, rng);
    const effectiveFrozen = Math.min(30, state.frozen + newFrozen * 0.5);
    state.frozen = Math.min(36, state.frozen + newFrozen);
    const deflate = levelValue(config.deflateChance, levels[2]);
    const economyPopulation = 1 + 0.07 * levels[2] + 0.12 * deflate;
    const frozenPopulation = 1 + 0.2 * effectiveFrozen;
    const overstaffCap = [0, 5, 8, 12, 18, 30][Math.min(5, levels[4])];
    const overstaff = 1 + levelValue(config.overstaffPer, levels[4]) * Math.min(overstaffCap, effectiveFrozen);
    const freezeJam = rng() < 0.04 ? 0.72 : 1;
    return economyPopulation * frozenPopulation * overstaff * freezeJam;
  }

  if (element === "water") {
    const line = levelValue(config.strikeLine, levels[2], 3);
    const convertChance = levelValue(config.convertChance, levels[4]);
    const conversions = binomial(events, convertChance * 0.45, rng);
    const naturalJoin = shift % 3 === 0 ? 1 : 0;
    const effectiveGroup = Math.min(line - 1, state.group + 0.5 * (conversions + naturalJoin));
    state.group = Math.min(line - 1, state.group + conversions + naturalJoin);
    const chain = levelValue(CHAIN, levels[1]);
    const sameTeam = Math.max(1, Math.min(7, effectiveGroup, 2 + Math.ceil(chain / 1.5)));
    const sameContribution = 1 + levelValue(config.samePer, levels[3]) * sameTeam;
    const clusterMass = 1 + 0.12 * Math.pow(Math.max(0, effectiveGroup - 1), 1.35);
    const strikeRisk = 0.025 + Math.max(0, effectiveGroup - 2) * 0.012;
    const strike = rng() < strikeRisk;
    if (strike) state.group = Math.max(1, Math.floor(state.group * 0.5));
    return sameContribution * clusterMass * (strike ? 0.58 : 1);
  }

  if (element === "grass") {
    const growChance = levelValue(config.growChance, levels[2]);
    const growthAttempts = Math.max(events, Math.round(events * (1 + state.spawned * 0.18)));
    const newGrowth = binomial(growthAttempts, growChance * 0.62, rng);
    const effectiveSpawned = Math.min(96, state.spawned + newGrowth * 0.5);
    state.spawned = Math.min(110, state.spawned + newGrowth);
    const connected = Math.min(69, 5 + Math.floor(shift * 0.2 + effectiveSpawned * 0.9));
    const height = Math.min(34, 1 + Math.floor(shift / 4 + effectiveSpawned * 0.28));
    const crowd = 1 + levelValue(config.crowdPerConnected, levels[3]) * connected;
    const canopy = 1 + levelValue(config.heightPer, levels[4]) * Math.max(0, height - 1);
    const collapse = rng() < 0.045 + effectiveSpawned * 0.0012;
    if (collapse) state.spawned = Math.floor(state.spawned * 0.74);
    return crowd * canopy * (collapse ? 0.42 : 1);
  }

  const absorbChance = levelValue(config.absorbChance, levels[2]);
  const emperorChance = Math.min(0.3, levelValue(config.emperorChance, levels[4]));
  const absorbed = binomial(events, absorbChance * Math.max(0.28, 1 - state.mass / 28), rng);
  const grown = binomial(events, emperorChance, rng);
  const emperorMeals = binomial(grown, Math.min(0.8, 0.25 + state.mass * 0.035), rng);
  const effectiveMass = Math.min(32, state.mass + 0.5 * (absorbed + grown + emperorMeals));
  state.mass = Math.min(36, state.mass + absorbed + grown + emperorMeals);
  const mergedBase = Math.pow(effectiveMass, 0.68);
  const gluttony = 1 + levelValue(config.gluttonyPerSize, levels[3]) * Math.max(0, effectiveMass - 1);
  const releasedPopulation = 1 + Math.min(1.4, state.mass * 0.045);
  const emperorExtraScore = 1 + emperorMeals * 0.22;
  return mergedBase * gluttony * releasedPopulation * emperorExtraScore;
}

const elements = Object.keys(PARAMS);
const scores = Object.fromEntries(elements.map((element) => [
  element,
  Array.from({ length: SHIFTS }, () => []),
]));

for (let run = 0; run < RUNS; run++) {
  const rng = mulberry32(0xC0FFEE + run * 97);
  const playerQuality = Math.max(0.84, Math.min(1.16, 1 + normal(rng) * 0.06));
  const structuralGrowth = Math.max(1.15, Math.min(1.21, 1.18 + normal(rng) * 0.012));

  for (const element of elements) {
    const levels = [0, 0, 0, 0, 0];
    let attributeLevel = 0;
    const state = { frozen: 0, group: 1, spawned: 0, mass: 1 };

    for (let shift = 1; shift <= SHIFTS; shift++) {
      const base = commonMultiplier(shift, levels, attributeLevel, structuralGrowth);
      const archetype = archetypeMultiplier(element, shift, levels, state, rng);
      const execution = Math.max(0.78, Math.min(1.18, 1 + normal(rng) * 0.055));
      scores[element][shift - 1].push(Math.round(base * archetype * playerQuality * execution));

      if (shift < SHIFTS) {
        chooseCard(levels, PARAMS[element], rng);
        if (rng() < 0.3) attributeLevel = Math.min(5, attributeLevel + 1);
      }
    }
  }
}

const rows = [];
for (let shift = 1; shift <= SHIFTS; shift++) {
  const kpi = kpiForShift(shift);
  const row = { shift, kpi };
  for (const element of elements) {
    const values = scores[element][shift - 1].sort((a, b) => a - b);
    const median = Math.round(percentile(values, 0.5));
    row[element] = median;
    row[`${element}Headroom`] = Number((median / kpi).toFixed(2));
    row[`${element}P25`] = Math.round(percentile(values, 0.25));
    row[`${element}P75`] = Math.round(percentile(values, 0.75));
    row[`${element}Pass`] = Number((values.filter((value) => value >= kpi).length / RUNS).toFixed(3));
  }
  rows.push(row);
}

console.table(rows.map((row) => ({
  班次: row.shift,
  KPI: row.kpi,
  火: row.fire,
  电: row.electric,
  冰: row.ice,
  水: row.water,
  草: row.grass,
  一般: row.normal,
})));

const summary = elements.map((element) => {
  const final = rows.at(-1);
  const peak = Math.max(...rows.map((row) => row[`${element}Headroom`]));
  const troughAfter2 = Math.min(...rows.slice(1).map((row) => row[`${element}Headroom`]));
  return {
    element,
    finalScore: final[element],
    finalHeadroom: final[`${element}Headroom`],
    shift20PassRate: final[`${element}Pass`],
    peakHeadroom: peak,
    troughAfter2,
  };
});

const finalScores = Object.fromEntries(elements.map((element) => [element, rows.at(-1)[element]]));
const finalSpread = Math.max(...Object.values(finalScores)) / Math.min(...Object.values(finalScores));
const actualFinalOrder = [...elements].sort((a, b) => finalScores[b] - finalScores[a]);

console.log(JSON.stringify({
  runs: RUNS,
  rows,
  summary,
  curveValidation: {
    finalSpread: Number(finalSpread.toFixed(2)),
    actualFinalOrder,
  },
}, null, 2));

const invalid = summary.filter((item) =>
  item.finalHeadroom < 1.25
  || item.shift20PassRate < 0.62
  || item.troughAfter2 < 0.85
);
if (invalid.length > 0) {
  console.error("以下流派未进入目标平衡带：", invalid.map((item) => item.element).join(", "));
  process.exitCode = 1;
}
