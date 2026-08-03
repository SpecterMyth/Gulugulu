// 《职场叠叠乐》真实玩家行为蒙特卡洛。
//
// 跑法：
//   node scripts/factory_player_behavior_sim.mjs [每类玩家局数]
//
// 模型边界：
// - KPI、雇价、卡池、价格与主脉冲直接使用当前 TypeScript 实现；
// - 招聘、出战、商店和投放决策带有玩家画像、认知噪声与显式失误；
// - Matter 落体被抽象为“候选落点 + 失投/零分/罢工”概率模型，不是真机通关率；
// - 首班命中率以 2026-07-29 可视实测（中度玩家 8 投、1 失投、1 零分、76/80）
//   校准。报告结论必须同时标注这一边界。

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { buildSync } from "esbuild";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const { outputFiles } = buildSync({
  stdin: {
    contents: `
      export {
        BASE_VALUE_BY_TIER,
        CARD_DEFS,
        CARD_PARAMS,
        HIRING_PICK_LIMIT,
        HIRING_REROLL_RATES,
        KPI_BONUS_RATE,
        LOAN_GAIN_RATE,
        LOAN_REPAY_RATE,
        LOAN_SHIFTS,
        LOAN_TOTAL_REPAY_RATE,
        QUOTA_PER_SHIFT,
        QUOTA_START,
        SHOP_SKIP_REFUND_RATE,
        START_CASH,
        TOTAL_SHIFTS,
        baseTrainingBonus,
        hasPowerRule,
        hasRushRule,
        hasWindRule,
        hirePrice,
        kpiForShift,
        modifierForShift,
        powerThrowLimitFor,
        rushWallMsFor,
        valueAtLevel,
      } from "./src/game/factory/rogueConfig";
      export { computePulse, stickOverrideForCards } from "./src/game/factory/roguePulse";
      export { buildAdjacency } from "./src/game/factory/rogueGraph";
      export {
        buildOffer,
        cardDef,
        cardPrice,
        drawDimCards,
      } from "./src/game/factory/rogueShop";
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
const bundlePath = join(appDir, "node_modules", ".cache", "factory-player-behavior.bundle.mjs");
mkdirSync(dirname(bundlePath), { recursive: true });
writeFileSync(bundlePath, outputFiles[0].text);
const G = await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);

function cliValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const RUNS = Math.max(100, Number.parseInt(process.argv[2] ?? "500", 10) || 500);
const SUMMARY_ONLY = process.argv.includes("--summary");
const ALTERNATE_STRATEGY = process.argv.includes("--alternate-strategy");
const ALTERNATE_LOADOUTS = ALTERNATE_STRATEGY || process.argv.includes("--alternate-loadouts");
const FOUNDATION_GUARANTEE = process.argv.includes("--foundation-guarantee");
const MONO_DESK_PROTECTION = process.argv.includes("--mono-desk-protection");
const ACTIVE_DESK_FLOOR = MONO_DESK_PROTECTION || process.argv.includes("--active-desk-floor");
const SEED_TEXT = cliValue("--seed") ?? "0x72901";
const RUN_SEED = Number.parseInt(SEED_TEXT, SEED_TEXT.startsWith("0x") ? 16 : 10) >>> 0;
const BALANCE_PROFILE = cliValue("--balance-profile") ?? "current";

const BALANCE_PROFILES = {
  "weak-card-boost-v1": {
    "base.fire": { bonus: [5, 12, 30, 70, 160] },
    "base.water": { bonus: [5, 12, 30, 70, 160] },
    "base.grass": { bonus: [3, 8, 20, 50, 120] },
    "base.electric": { bonus: [5, 12, 30, 70, 160] },
    "base.ice": { bonus: [5, 12, 30, 70, 160] },
    "base.normal": { bonus: [5, 12, 30, 70, 160] },
    "fire.wildfire": { spread: [4, 8, 16, 32, 64] },
    "water.same": { perTeamSame: [1.5, 2, 3, 5, 8] },
    "water.convert": { targets: [2, 4, 6, 9, 12] },
    "grass.grow": { chance: [0.3, 0.5, 0.7, 0.9, 1] },
    "normal.gluttony": { perSize: [1, 2, 4, 8, 16] },
    "normal.emperor": { grow: [2, 4, 8, 16, 32] },
    "attr.hex": { perElement: [1, 2, 4, 8, 16] },
    "attr.balance": { mult: [10, 20, 40, 80, 160] },
    "syn.arcIgnite": { perDesk: [1, 2, 4, 8, 16] },
    "syn.thermalShock": { echo: [10, 25, 60, 150, 400] },
    "syn.greenhouse": { growCopies: [1, 1, 2, 3, 5] },
    "syn.fireDispatch": { perMass: [2, 4, 8, 16, 32] },
    "syn.short": { burst: [10, 25, 60, 150, 400] },
    "syn.iceMirror": { perFrozenSame: [2, 4, 8, 16, 32] },
    "syn.coldRotation": { perMass: [1, 2, 4, 8, 16] },
    "syn.badge": { mult: [4, 8, 16, 32, 64] },
    "syn.multiSeed": { inheritMass: [0.5, 0.75, 1, 1.5, 2.5] },
    "staff.severance": { refund: [0.25, 0.5, 0.75, 1, 1] },
    "staff.expand": { quota: 10 },
    "staff.talentmarket": { rerollsPerLevel: 2, candidatesPerLevel: 2 },
    "staff.backfill": { extraCandidates: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
    "staff.pricecut": { cut: [0.4, 0.6, 0.75, 0.9, 1] },
  },
  "weak-card-boost-v2": {
    "base.fire": { bonus: [10, 25, 60, 140, 320] },
    "base.water": { bonus: [10, 25, 60, 140, 320] },
    "base.grass": { bonus: [6, 15, 35, 80, 180] },
    "base.electric": { bonus: [10, 25, 60, 140, 320] },
    "base.ice": { bonus: [10, 25, 60, 140, 320] },
    "base.normal": { bonus: [10, 25, 60, 140, 320] },
    "fire.wildfire": { spread: [6, 12, 24, 48, 96] },
    "ice.freeze": { chance: [0.5, 0.7, 0.85, 1, 1] },
    "water.same": { perTeamSame: [2, 3, 5, 8, 12] },
    "water.convert": { targets: [3, 5, 8, 12, 16] },
    "grass.grow": { chance: [0.5, 0.7, 0.85, 1, 1] },
    "normal.gluttony": { perSize: [2, 4, 8, 16, 32] },
    "normal.emperor": { grow: [3, 6, 12, 24, 48] },
    "attr.hex": { perElement: [2, 4, 8, 16, 32] },
    "attr.balance": { mult: [20, 40, 80, 160, 320] },
    "syn.arcIgnite": { perDesk: [2, 4, 8, 16, 32] },
    "syn.thermalShock": { echo: [20, 50, 125, 300, 750] },
    "syn.greenhouse": { chance: [0.7, 0.85, 1, 1, 1], growCopies: [1, 2, 3, 4, 6] },
    "syn.fireDispatch": { perMass: [4, 8, 16, 32, 64] },
    "syn.short": { burst: [20, 50, 125, 300, 750] },
    "syn.iceMirror": { perFrozenSame: [4, 8, 16, 32, 64] },
    "syn.coldRotation": { perMass: [2, 4, 8, 16, 32] },
    "syn.badge": { mult: [8, 16, 32, 64, 128] },
    "syn.multiSeed": { inheritMass: [0.75, 1, 1.5, 2, 3] },
    "staff.severance": { refund: [0.4, 0.65, 0.85, 1, 1] },
    "staff.expand": { quota: 15 },
    "staff.talentmarket": { rerollsPerLevel: 3, candidatesPerLevel: 3 },
    "staff.backfill": { extraCandidates: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30] },
    "staff.pricecut": { cut: [0.5, 0.7, 0.85, 0.95, 1] },
  },
  "weak-card-boost-v3": {
    "base.fire": { bonus: [30, 80, 200, 500, 1200] },
    "base.water": { bonus: [30, 80, 200, 500, 1200] },
    "base.grass": { bonus: [20, 50, 125, 300, 750] },
    "base.electric": { bonus: [30, 80, 200, 500, 1200] },
    "base.ice": { bonus: [30, 80, 200, 500, 1200] },
    "base.normal": { bonus: [30, 80, 200, 500, 1200] },
    "fire.wildfire": { spread: [8, 20, 50, 125, 300] },
    "ice.freeze": { chance: [0.5, 0.7, 0.85, 1, 1] },
    "water.same": { perTeamSame: [2, 4, 8, 16, 32] },
    "water.convert": { targets: [3, 6, 10, 15, 24] },
    "grass.grow": { chance: [0.5, 0.7, 0.85, 1, 1] },
    "normal.gluttony": { perSize: [3, 6, 12, 24, 48] },
    "normal.emperor": { grow: [3, 6, 12, 24, 48] },
    "attr.hex": { perElement: [3, 6, 12, 24, 48] },
    "attr.balance": { mult: [30, 75, 180, 450, 1200] },
    "syn.arcIgnite": { perDesk: [3, 6, 12, 24, 48] },
    "syn.thermalShock": { echo: [30, 75, 180, 450, 1200] },
    "syn.greenhouse": { chance: [1, 1, 1, 1, 1], growCopies: [2, 3, 4, 6, 10] },
    "syn.fireDispatch": { perMass: [6, 12, 24, 48, 96] },
    "syn.short": { burst: [30, 75, 180, 450, 1200] },
    "syn.bionet": {
      perGenerated: [1, 2, 4, 8, 16],
      cap: 24,
      generatedWeight: [1, 1, 2, 3, 5],
    },
    "syn.iceMirror": { perFrozenSame: [6, 12, 24, 48, 96] },
    "syn.permafrost": {
      perCrossEdge: [0.5, 1, 2, 4, 8],
      cap: [8, 12, 16, 24, 99],
    },
    "syn.coldRotation": { perMass: [3, 6, 12, 24, 48] },
    "syn.irrigation": { chanceMult: [3, 6, 12, 24, 48], growCopies: [1, 2, 3, 5, 8] },
    "syn.badge": { mult: [12, 30, 75, 180, 450] },
    "syn.multiSeed": { inheritMass: [1, 1.5, 2.5, 4, 6] },
    "staff.severance": { refund: [0.4, 0.65, 0.85, 1, 1] },
    "staff.expand": { quota: 15 },
    "staff.talentmarket": { rerollsPerLevel: 3, candidatesPerLevel: 3 },
    "staff.backfill": { extraCandidates: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30] },
    "staff.pricecut": { cut: [0.5, 0.7, 0.85, 0.95, 1] },
  },
  "weak-card-boost-v4": {
    "base.fire": { bonus: [60, 180, 500, 1500, 5000] },
    "base.water": { bonus: [60, 180, 500, 1500, 5000] },
    "base.grass": { bonus: [40, 120, 350, 1000, 3000] },
    "base.electric": { bonus: [60, 180, 500, 1500, 5000] },
    "base.ice": { bonus: [60, 180, 500, 1500, 5000] },
    "base.normal": { bonus: [60, 180, 500, 1500, 5000] },
    "fire.wildfire": { spread: [10, 30, 90, 270, 800] },
    "ice.freeze": { chance: [0.5, 0.7, 0.85, 1, 1] },
    "water.same": { perTeamSame: [3, 8, 20, 50, 120] },
    "water.convert": { targets: [4, 8, 14, 22, 36] },
    "grass.grow": { chance: [0.5, 0.7, 0.85, 1, 1] },
    "normal.gluttony": { perSize: [5, 15, 40, 100, 250] },
    "normal.emperor": { grow: [5, 15, 40, 100, 250] },
    "attr.hex": { perElement: [5, 15, 40, 100, 250] },
    "attr.balance": { mult: [50, 150, 500, 1500, 5000] },
    "syn.arcIgnite": { perDesk: [5, 15, 40, 100, 250] },
    "syn.thermalShock": { echo: [60, 180, 500, 1500, 5000] },
    "syn.greenhouse": { chance: [1, 1, 1, 1, 1], growCopies: [3, 5, 8, 13, 21] },
    "syn.fireDispatch": { perMass: [10, 30, 90, 270, 800] },
    "syn.short": { burst: [60, 180, 500, 1500, 5000] },
    "syn.bionet": {
      perGenerated: [2, 5, 12, 30, 75],
      cap: 30,
      generatedWeight: [1, 2, 3, 5, 8],
    },
    "syn.iceMirror": { perFrozenSame: [10, 30, 90, 270, 800] },
    "syn.permafrost": {
      perCrossEdge: [0.75, 1.5, 3, 6, 12],
      cap: [10, 15, 22, 32, 99],
    },
    "syn.coldRotation": { perMass: [5, 15, 40, 100, 250] },
    "syn.irrigation": { chanceMult: [4, 8, 16, 32, 64], growCopies: [2, 3, 5, 8, 13] },
    "syn.badge": { mult: [20, 60, 180, 500, 1500] },
    "syn.multiSeed": { inheritMass: [1.5, 2.5, 4, 6, 10] },
    "staff.severance": { refund: [0.5, 0.75, 1, 1, 1] },
    "staff.expand": { quota: 20 },
    "staff.talentmarket": { rerollsPerLevel: 4, candidatesPerLevel: 4 },
    "staff.backfill": { extraCandidates: [4, 8, 12, 16, 20, 24, 28, 32, 36, 40] },
    "staff.pricecut": { cut: [0.6, 0.8, 0.9, 1, 1] },
  },
  "weak-card-boost-v5": {
    "base.fire": { bonus: [100, 400, 1600, 8000, 40000] },
    "base.water": { bonus: [100, 400, 1600, 8000, 40000] },
    "base.grass": { bonus: [70, 280, 1100, 5500, 27500] },
    "base.electric": { bonus: [100, 400, 1600, 8000, 40000] },
    "base.ice": { bonus: [100, 400, 1600, 8000, 40000] },
    "base.normal": { bonus: [100, 400, 1600, 8000, 40000] },
    "fire.wildfire": { spread: [20, 80, 320, 1280, 5120] },
    "ice.freeze": { chance: [0.5, 0.7, 0.85, 1, 1] },
    "water.same": { perTeamSame: [5, 20, 80, 320, 1280] },
    "water.convert": { targets: [5, 10, 18, 30, 50] },
    "grass.grow": { chance: [0.5, 0.7, 0.85, 1, 1] },
    "normal.gluttony": { perSize: [10, 40, 160, 800, 4000] },
    "normal.emperor": { grow: [10, 40, 160, 800, 4000] },
    "attr.hex": { perElement: [10, 40, 160, 800, 4000] },
    "attr.balance": { mult: [100, 400, 1600, 8000, 40000] },
    "syn.arcIgnite": { perDesk: [10, 40, 160, 800, 4000] },
    "syn.thermalShock": { echo: [150, 600, 2400, 12000, 60000] },
    "syn.greenhouse": { chance: [1, 1, 1, 1, 1], growCopies: [4, 8, 16, 32, 64] },
    "syn.fireDispatch": { perMass: [20, 80, 320, 1280, 5120] },
    "syn.short": { burst: [150, 600, 2400, 12000, 60000] },
    "syn.bionet": {
      perGenerated: [4, 16, 64, 256, 1024],
      cap: 40,
      generatedWeight: [2, 3, 5, 8, 13],
    },
    "syn.iceMirror": { perFrozenSame: [20, 80, 320, 1280, 5120] },
    "syn.permafrost": {
      perCrossEdge: [1, 3, 9, 27, 81],
      cap: [12, 18, 27, 40, 99],
    },
    "syn.coldRotation": { perMass: [10, 40, 160, 800, 4000] },
    "syn.irrigation": { chanceMult: [5, 10, 20, 40, 80], growCopies: [3, 6, 12, 24, 48] },
    "syn.badge": { mult: [50, 200, 800, 4000, 20000] },
    "syn.multiSeed": { inheritMass: [2, 4, 8, 16, 32] },
    "staff.severance": { refund: [0.5, 0.75, 1, 1, 1] },
    "staff.expand": { quota: 20 },
    "staff.talentmarket": { rerollsPerLevel: 4, candidatesPerLevel: 4 },
    "staff.backfill": { extraCandidates: [4, 8, 12, 16, 20, 24, 28, 32, 36, 40] },
    "staff.pricecut": { cut: [0.6, 0.8, 0.9, 1, 1] },
  },
  "weak-card-boost-v6": {
    "base.fire": { bonus: [500, 2500, 12500, 62500, 312500] },
    "base.water": { bonus: [500, 2500, 12500, 62500, 312500] },
    "base.grass": { bonus: [350, 1750, 8750, 43750, 218750] },
    "base.electric": { bonus: [500, 2500, 12500, 62500, 312500] },
    "base.ice": { bonus: [500, 2500, 12500, 62500, 312500] },
    "base.normal": { bonus: [500, 2500, 12500, 62500, 312500] },
    "fire.wildfire": { spread: [20, 80, 320, 1280, 5120] },
    "ice.freeze": { chance: [0.5, 0.7, 0.85, 1, 1] },
    "water.same": { perTeamSame: [5, 20, 80, 320, 1280] },
    "water.convert": { targets: [5, 10, 18, 30, 50] },
    "grass.grow": { chance: [0.5, 0.7, 0.85, 1, 1] },
    "normal.gluttony": { perSize: [10, 40, 160, 800, 4000] },
    "normal.emperor": { grow: [10, 40, 160, 800, 4000] },
    "attr.hex": { perElement: [10, 40, 160, 800, 4000] },
    "attr.balance": { mult: [100, 400, 1600, 8000, 40000] },
    "syn.arcIgnite": { perDesk: [10, 40, 160, 800, 4000] },
    "syn.thermalShock": { echo: [150, 600, 2400, 12000, 60000] },
    "syn.greenhouse": { chance: [1, 1, 1, 1, 1], growCopies: [4, 8, 16, 32, 64] },
    "syn.fireDispatch": {
      perMass: [0, 0, 0, 0, 0],
      direct: [30, 120, 480, 1920, 7680],
    },
    "syn.short": { burst: [150, 600, 2400, 12000, 60000] },
    "syn.bionet": {
      perGenerated: [4, 16, 64, 256, 1024],
      cap: 40,
      generatedWeight: [2, 3, 5, 8, 13],
    },
    "syn.lightningrod": {
      perMass: [0, 0, 0, 0, 0],
      direct: [30, 120, 480, 1920, 7680],
    },
    "syn.iceMirror": { perFrozenSame: [20, 80, 320, 1280, 5120] },
    "syn.permafrost": {
      perCrossEdge: [1, 3, 9, 27, 81],
      cap: [12, 18, 27, 40, 99],
    },
    "syn.coldRotation": { perMass: [10, 40, 160, 800, 4000] },
    "syn.irrigation": { chanceMult: [5, 10, 20, 40, 80], growCopies: [3, 6, 12, 24, 48] },
    "syn.badge": { mult: [50, 200, 800, 4000, 20000] },
    "syn.multiSeed": { inheritMass: [2, 4, 8, 16, 32] },
    "staff.severance": { refund: [0.5, 0.75, 1, 1, 1] },
    "staff.expand": { quota: 20 },
    "staff.talentmarket": { rerollsPerLevel: 4, candidatesPerLevel: 4 },
    "staff.backfill": { extraCandidates: [4, 8, 12, 16, 20, 24, 28, 32, 36, 40] },
    "staff.pricecut": { cut: [0.6, 0.8, 0.9, 1, 1] },
  },
};

BALANCE_PROFILES["weak-card-boost-final"] = structuredClone(
  BALANCE_PROFILES["weak-card-boost-v6"],
);
Object.assign(BALANCE_PROFILES["weak-card-boost-final"], {
  "syn.bionet": {
    perGenerated: [4, 16, 64, 256, 1024],
    cap: 40,
    generatedWeight: [1, 1, 1, 1, 1],
  },
  "syn.permafrost": {
    perCrossEdge: [1, 3, 9, 27, 81],
    cap: [40, 40, 40, 40, 40],
  },
  "syn.irrigation": {
    chanceMult: [1, 1, 1, 1, 1],
    growCopies: [3, 6, 12, 24, 48],
  },
  "staff.talentmarket": {
    rerollsPerLevel: 0,
    candidatesPerLevel: 4,
  },
});

function applyBalanceProfile(profileId) {
  if (profileId === "current") return;
  const overrides = BALANCE_PROFILES[profileId];
  if (overrides == null) throw new Error(`Unknown balance profile: ${profileId}`);
  for (const [id, fields] of Object.entries(overrides)) {
    if (G.CARD_PARAMS[id] == null) throw new Error(`Unknown card in balance profile: ${id}`);
    Object.assign(G.CARD_PARAMS[id], fields);
  }
}

applyBalanceProfile(BALANCE_PROFILE);

const ELEMENTS = ["fire", "water", "grass", "electric", "ice", "normal"];
const PAIRS = [];
for (let i = 0; i < ELEMENTS.length; i++) {
  for (let j = i + 1; j < ELEMENTS.length; j++) PAIRS.push([ELEMENTS[i], ELEMENTS[j]]);
}
const TRIPLES = [];
for (let i = 0; i < ELEMENTS.length; i++) {
  for (let j = i + 1; j < ELEMENTS.length; j++) {
    for (let k = j + 1; k < ELEMENTS.length; k++) {
      TRIPLES.push([ELEMENTS[i], ELEMENTS[j], ELEMENTS[k]]);
    }
  }
}
export const ARCHETYPE_ROUTES = [
  ...ELEMENTS.map((element) => ({
    id: `mono_${element}`,
    family: "mono",
    elements: [element],
  })),
  ...PAIRS.map((elements) => ({
    id: `pair_${elements.join("_")}`,
    family: "pair",
    elements,
  })),
  ...TRIPLES.map((elements) => ({
    id: `triple_${elements.join("_")}`,
    family: "triple",
    elements,
  })),
  {
    id: "attr_high_color",
    family: "attribute",
    elements: ELEMENTS.slice(),
  },
  {
    id: "attr_six_tiers",
    family: "attribute",
    elements: ELEMENTS.slice(),
  },
];
const DESKS = ELEMENTS.map((element, index) => ({
  element,
  x: index * 180 - 75,
  w: 150,
  top: 0,
}));
const RADIUS = 30;
const PROFILE_DEFS = {
  newcomer: {
    label: "新手玩家",
    collectionSize: 6,
    firstBag: 10,
    minBag: 9,
    errorBuffer: 3,
    accuracy: 0.77,
    windPenalty: 0.18,
    disabledAwareness: 0.52,
    placementQuality: 0.42,
    bridgeAwareness: 0.16,
    strikeAwareness: 0.38,
    shopKnowledge: 0.32,
    rarityBias: 0.055,
    shopThreshold: 0.015,
    shopRefreshChance: 0.08,
    hireRerollChance: 0.1,
    reserveRate: 0.12,
    thinkSeconds: 14,
    cosmeticNoise: 0.42,
  },
  regular: {
    label: "中度玩家",
    collectionSize: 18,
    firstBag: 9,
    minBag: 8,
    errorBuffer: 2,
    accuracy: 0.87,
    windPenalty: 0.12,
    disabledAwareness: 0.82,
    placementQuality: 0.72,
    bridgeAwareness: 0.5,
    strikeAwareness: 0.82,
    shopKnowledge: 0.68,
    rarityBias: 0.015,
    shopThreshold: 0.035,
    shopRefreshChance: 0.22,
    hireRerollChance: 0.3,
    reserveRate: 0.24,
    thinkSeconds: 8,
    cosmeticNoise: 0.2,
  },
  expert: {
    label: "极限玩家",
    collectionSize: 45,
    firstBag: 8,
    minBag: 7,
    errorBuffer: 1,
    accuracy: 0.95,
    windPenalty: 0.07,
    disabledAwareness: 0.96,
    placementQuality: 0.93,
    bridgeAwareness: 0.84,
    strikeAwareness: 0.97,
    shopKnowledge: 0.92,
    rarityBias: 0,
    shopThreshold: 0.05,
    shopRefreshChance: 0.42,
    hireRerollChance: 0.55,
    reserveRate: 0.34,
    thinkSeconds: 4.2,
    cosmeticNoise: 0.08,
  },
};

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

function shuffle(items, rng) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function percentile(values, q) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

function collectionFor(kind) {
  const meta = {};
  const add = (code, elements, groupNo) => {
    meta[code] = {
      species: code,
      elements,
      tierCount: elements.length,
      groupNo,
      reach: groupNo + 1,
      baseValue: G.BASE_VALUE_BY_TIER[elements.length],
    };
  };
  for (const element of ELEMENTS) add(`starter_${element}`, [element], 1);
  if (kind === "newcomer") return meta;

  for (const element of ELEMENTS) add(`ai_${element}`, [element], kind === "regular" ? 3 : 10);
  const regularPairs = [
    ["fire", "electric"],
    ["fire", "grass"],
    ["water", "ice"],
    ["water", "grass"],
    ["electric", "normal"],
    ["grass", "normal"],
  ];
  for (const pair of kind === "regular" ? regularPairs : PAIRS) {
    add(`dual_${pair.join("_")}`, pair, kind === "regular" ? 3 : 8);
  }
  if (kind === "regular") return meta;

  const triples = [
    ["fire", "electric", "grass"],
    ["fire", "electric", "normal"],
    ["fire", "water", "grass"],
    ["fire", "ice", "normal"],
    ["water", "ice", "grass"],
    ["water", "ice", "normal"],
    ["electric", "grass", "normal"],
    ["electric", "ice", "normal"],
    ["fire", "water", "electric"],
    ["grass", "ice", "normal"],
  ];
  triples.forEach((elements, index) => add(`triple_${index}`, elements, 7));
  const quads = [
    ["fire", "water", "grass", "electric"],
    ["fire", "electric", "ice", "normal"],
    ["water", "grass", "ice", "normal"],
    ["fire", "water", "electric", "ice"],
    ["fire", "grass", "electric", "normal"],
  ];
  quads.forEach((elements, index) => add(`quad_${index}`, elements, 6));
  add("penta_0", ["fire", "water", "grass", "electric", "ice"], 5);
  add("penta_1", ["fire", "water", "grass", "electric", "normal"], 5);
  add("hexa_0", ELEMENTS.slice(), 5);
  return meta;
}

function canonicalElements(elements) {
  return elements.slice().sort((left, right) => ELEMENTS.indexOf(left) - ELEMENTS.indexOf(right));
}

function loadoutForRoute(route, meta) {
  const species = [];
  const add = (code) => {
    if (meta[code] && !species.includes(code)) species.push(code);
  };
  if (route.id === "attr_high_color") {
    ["quad_0", "quad_1", "quad_2", "penta_0", "penta_1", "hexa_0"].forEach(add);
    return { species: species.slice(0, 6), anchor: ELEMENTS.slice() };
  }
  if (route.id === "attr_six_tiers") {
    add("ai_fire");
    add("dual_fire_water");
    add(Object.keys(meta).find((code) => code.startsWith("triple_")));
    add("quad_0");
    add("penta_0");
    add("hexa_0");
    return { species: species.slice(0, 6), anchor: ELEMENTS.slice() };
  }
  const elements = canonicalElements(route.elements);
  if (route.family === "mono") {
    add(`ai_${elements[0]}`);
    add(`starter_${elements[0]}`);
    return { species, anchor: elements };
  }
  const exactTriple = Object.keys(meta).find((code) =>
    code.startsWith("triple_")
    && meta[code].elements.length === elements.length
    && elements.every((element) => meta[code].elements.includes(element)));
  add(exactTriple);
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      add(`dual_${canonicalElements([elements[i], elements[j]]).join("_")}`);
    }
  }
  for (const element of elements) add(`ai_${element}`);
  if (species.length < 5) {
    for (const element of elements) add(`starter_${element}`);
  }
  return { species: species.slice(0, 5), anchor: elements };
}

function loadoutFor(kind, meta, rng, route = null) {
  if (kind === "expert" && route) return loadoutForRoute(route, meta);
  if (kind === "newcomer") {
    const favorites = ALTERNATE_LOADOUTS ? shuffle(ELEMENTS, rng).slice(0, 2) : ["fire", "electric"];
    return {
      species: [
        ...favorites,
        ...ELEMENTS.filter((element) => !favorites.includes(element)),
      ].map((element) => `starter_${element}`),
      anchor: favorites,
    };
  }
  const regularPairs = [
    ["fire", "electric"],
    ["fire", "grass"],
    ["water", "ice"],
    ["water", "grass"],
    ["electric", "normal"],
    ["grass", "normal"],
  ];
  // 极限玩家按当前规则会很快收敛到“电＋草”的多桌/繁茂双指数构筑；
  // 中度玩家仍在六种直观双系主题间轮换，不预设已知版本答案。
  const alternateExpertThemes = [
    ["fire", "water"],
    ["electric", "ice"],
    ["electric", "normal"],
    ["fire", "electric"],
    ["water", "normal"],
    ["fire", "ice"],
  ];
  const anchor = kind === "expert"
    ? (
      ALTERNATE_LOADOUTS
        ? alternateExpertThemes[Math.floor(rng() * alternateExpertThemes.length)]
        : ["grass", "electric"]
    )
    : regularPairs[Math.floor(rng() * regularPairs.length)];
  const species = [];
  const add = (code) => {
    if (meta[code] && !species.includes(code)) species.push(code);
  };
  add(`ai_${anchor[0]}`);
  add(`ai_${anchor[1]}`);
  add(`dual_${canonicalElements(anchor).join("_")}`);
  add(`dual_${canonicalElements([...anchor].reverse()).join("_")}`);
  if (kind === "regular") {
    add(`starter_${anchor[0]}`);
    add(`starter_${anchor[1]}`);
    const supporter = anchor.includes("normal") ? "grass" : "normal";
    add(`ai_${supporter}`);
    add(`starter_${ELEMENTS.find((element) => !anchor.includes(element) && element !== supporter)}`);
  } else {
    const triple = Object.keys(meta).find((code) =>
      code.startsWith("triple_") && anchor.every((element) => meta[code].elements.includes(element)));
    add(triple);
    const bridge = Object.keys(meta).find((code) =>
      code.startsWith("dual_")
      && meta[code].elements.some((element) => anchor.includes(element))
      && meta[code].elements.some((element) => element === "normal" || element === "grass"));
    add(bridge);
    if (species.length < 5) add("hexa_0");
  }
  return { species: species.slice(0, kind === "regular" ? 6 : 5), anchor };
}

function activeElements(loadout, meta) {
  return [...new Set(loadout.flatMap((species) => meta[species]?.elements ?? []))];
}

function stateFor(run, uid) {
  return run.bodyStates.get(uid);
}

function logicalBodies(run, extra = []) {
  return [...run.bodies, ...extra].map((body) => {
    const state = run.bodyStates.get(body.uid);
    return {
      ...body,
      species: state?.speciesOverride ?? body.species,
      elements: state?.elementsOverride ?? body.elements,
    };
  });
}

function enabledDesks(run) {
  return DESKS.filter((desk) => !run.disabledDesks.includes(desk.element));
}

function effectiveBase(run, uid, bodies, cards) {
  const body = bodies.find((candidate) => candidate.uid === uid);
  const state = run.bodyStates.get(uid);
  const species = state?.speciesOverride ?? body?.species;
  const elements = state?.elementsOverride ?? run.meta[species]?.elements ?? body?.elements ?? [];
  return (run.uidBase.get(uid) ?? run.meta[species]?.baseValue ?? 15)
    + G.baseTrainingBonus(elements, cards);
}

function pulseFor(run, uid, extraBodies = [], cards = run.cards) {
  const bodies = logicalBodies(run, extraBodies);
  return G.computePulse({
    uid,
    bodies,
    desks: enabledDesks(run),
    meta: run.meta,
    effBase: (targetUid) => effectiveBase(run, targetUid, bodies, cards),
    cards,
    comboStacks: run.combo,
    stateOf: (targetUid) => stateFor(run, targetUid),
    opts: { stickOverride: G.stickOverrideForCards(cards) ?? undefined },
  });
}

function pulseGain(pulse) {
  return pulse.total + pulse.extras.reduce((sum, extra) => sum + extra.amount, 0);
}

function recordPulseShape(run, pulse) {
  const shape = {
    individual: pulse.individualMult ?? 1,
    team: pulse.teamMult ?? 1,
    network: pulse.networkMult ?? 1,
    status: pulse.statusMult ?? 1,
    rhythm: pulse.comboMult ?? 1,
  };
  run.poolSamples.count++;
  for (const [key, value] of Object.entries(shape)) run.poolSamples[key] += value;
  const gain = pulseGain(pulse);
  if (gain >= (run.peakBreakdown?.gain ?? -1)) {
    run.peakBreakdown = {
      gain,
      chips: pulse.chips,
      desks: pulse.deskCount,
      absorbed: pulse.absorbUids.length,
      extras: pulse.extras.reduce((sum, extra) => sum + extra.amount, 0),
      ...shape,
    };
  }
}

function intersects(left, right) {
  return left.some((element) => right.includes(element));
}

function placementCandidates(run, species, cards = run.cards, allowBridge = true) {
  const meta = run.meta[species];
  if (!meta) return [];
  const bodies = logicalBodies(run);
  const stickOverride = G.stickOverrideForCards(cards);
  const compatible = (body) => intersects(meta.elements, body.elements)
    || stickOverride?.({
      uid: -1,
      species,
      elements: meta.elements,
      x: body.x,
      y: body.y - 60,
      r: RADIUS,
      settled: true,
    }, body) === true;
  const candidates = [];
  for (const desk of enabledDesks(run)) {
    if (!meta.elements.includes(desk.element)) continue;
    const center = desk.x + desk.w / 2;
    for (const x of [center - 50, center, center + 50]) {
      const sameColumn = bodies
        .filter((body) => Math.abs(body.x - x) < 32 && compatible(body))
        .sort((left, right) => left.y - right.y);
      candidates.push({
        x,
        y: sameColumn.length > 0 ? sameColumn[0].y - 60 : -RADIUS,
        kind: "desk",
      });
    }
  }
  for (const body of bodies.filter(compatible)) {
    candidates.push({ x: body.x, y: body.y - 60, kind: "stack" });
  }
  if (allowBridge && meta.elements.length >= 2 && bodies.length >= 2) {
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const left = bodies[i];
        const right = bodies[j];
        const dx = Math.abs(left.x - right.x);
        if (dx < 70 || dx > 180 || !compatible(left) || !compatible(right)) continue;
        candidates.push({
          x: (left.x + right.x) / 2,
          y: Math.min(left.y, right.y) - 50,
          kind: "bridge",
        });
      }
    }
  }
  const deduped = new Map();
  for (const candidate of candidates) {
    const key = `${Math.round(candidate.x / 4)}:${Math.round(candidate.y / 4)}`;
    if (!deduped.has(key)) deduped.set(key, candidate);
  }
  const values = [...deduped.values()];
  if (!run.fastMode || values.length <= 18) return values;
  const high = values.slice().sort((left, right) => left.y - right.y).slice(0, 10);
  const bridges = values.filter((candidate) => candidate.kind === "bridge").slice(0, 4);
  const desk = values.filter((candidate) => candidate.kind === "desk")
    .sort((left, right) => right.y - left.y)
    .slice(0, 4);
  return [...new Set([...high, ...bridges, ...desk])];
}

function scoredPlacements(run, species, cards = run.cards, allowBridge = true) {
  const meta = run.meta[species];
  return placementCandidates(run, species, cards, allowBridge).map((candidate) => {
    const body = {
      uid: run.nextUid,
      species,
      elements: meta.elements.slice(),
      x: candidate.x,
      y: candidate.y,
      r: RADIUS,
      settled: true,
    };
    run.uidBase.set(body.uid, meta.baseValue);
    const pulse = pulseFor(run, body.uid, [body], cards);
    run.uidBase.delete(body.uid);
    return { ...candidate, body, pulse, gain: pulseGain(pulse) };
  }).sort((left, right) => right.gain - left.gain || right.y - left.y);
}

function removeBody(run, uid, releaseQuota = true) {
  const index = run.bodies.findIndex((body) => body.uid === uid);
  if (index < 0) return;
  const state = run.bodyStates.get(uid);
  if (releaseQuota && !state?.frozen && !state?.generated) {
    run.quotaUsed = Math.max(0, run.quotaUsed - 1);
  }
  run.bodies.splice(index, 1);
  run.uidBase.delete(uid);
  run.uidCost.delete(uid);
  run.bodyStates.delete(uid);
}

function recordDirectContributions(run, pulse, uid) {
  if (!run.trackContributions) return;
  const full = pulseGain(pulse);
  if (full <= 0) return;
  for (const [id, level] of Object.entries(run.cards)) {
    if (level <= 0) continue;
    const without = { ...run.cards, [id]: 0 };
    const delta = Math.max(0, full - pulseGain(pulseFor(run, uid, [], without)));
    if (delta > 0) {
      run.cardDirect[id] = (run.cardDirect[id] ?? 0) + delta;
      run.cardTriggers[id] = (run.cardTriggers[id] ?? 0) + 1;
    }
  }
}

function trigger(run, id, amount = 1) {
  run.cardTriggers[id] = (run.cardTriggers[id] ?? 0) + amount;
}

function applyPostPulse(run, pulse, sourceUid) {
  const source = logicalBodies(run).find((body) => body.uid === sourceUid);
  if (!source || pulse.total <= 0) return;
  const cards = run.cards;
  const absorbed = pulse.absorbUids
    .map((uid) => logicalBodies(run).find((body) => body.uid === uid))
    .filter(Boolean);

  if (
    BALANCE_PROFILE === "weak-card-boost-v6"
    || BALANCE_PROFILE === "weak-card-boost-final"
  ) {
    const directConversions = [
      ["syn.fireDispatch", "fireDispatch", (value) => Math.max(0, value - 1)],
      ["syn.lightningrod", "lightningrod", (value) => Math.max(0, value)],
    ];
    for (const [id, triggerKind, unitsFor] of directConversions) {
      const level = cards[id] ?? 0;
      if (level <= 0) continue;
      const event = pulse.triggers?.find((triggerEvent) => triggerEvent.kind === triggerKind);
      const units = unitsFor(event?.value ?? 0);
      const params = G.CARD_PARAMS[id];
      if (units <= 0 || !("direct" in params)) continue;
      const factor = G.valueAtLevel(params.direct, level);
      const amount = Math.round(pulse.chips * pulse.deskCount * units * factor);
      if (amount <= 0) continue;
      pulse.extras.push({ kind: "echo", uid: sourceUid, amount });
      pulse.cardContributions ??= [];
      pulse.cardContributions.push({ id, amount });
      run.cash += amount;
      run.revenueShift += amount;
      run.revenueTotal += amount;
      run.maxPulse = Math.max(run.maxPulse, pulseGain(pulse));
      run.cardDirect[id] = (run.cardDirect[id] ?? 0) + amount;
      trigger(run, id);
    }
  }

  const freezeLevel = cards["ice.freeze"] ?? 0;
  if (freezeLevel > 0 && source.elements.includes("ice")) {
    const targets = absorbed.filter((body) => body.y > source.y && !run.bodyStates.get(body.uid)?.frozen);
    const target = targets[Math.floor(run.rng() * targets.length)];
    if (
      target
      && run.rng() < G.valueAtLevel(G.CARD_PARAMS["ice.freeze"].chance, freezeLevel)
    ) {
      const state = run.bodyStates.get(target.uid) ?? { uid: target.uid };
      run.bodyStates.set(target.uid, { ...state, frozen: true });
      if (!state.generated) run.quotaUsed = Math.max(0, run.quotaUsed - 1);
      trigger(run, "ice.freeze");
    }
  }

  const convertLevel = cards["water.convert"] ?? 0;
  if (convertLevel > 0 && source.elements.includes("water") && absorbed.length > 0) {
    const contributionByUid = new Map(
      pulse.contributors.map((contributor) => [contributor.uid, contributor.amount]),
    );
    const targets = absorbed
      .filter((target) => !target.elements.includes("water"))
      .sort((left, right) => (
        (contributionByUid.get(right.uid) ?? 0) - (contributionByUid.get(left.uid) ?? 0)
        || left.uid - right.uid
      ))
      .slice(0, G.valueAtLevel(G.CARD_PARAMS["water.convert"].targets, convertLevel));
    for (const target of targets) {
      const state = run.bodyStates.get(target.uid) ?? { uid: target.uid };
      run.bodyStates.set(target.uid, {
        ...state,
        speciesOverride: source.species,
        elementsOverride: source.elements.slice(),
      });
    }
    if (targets.length > 0) trigger(run, "water.convert", targets.length);
  }

  const normalLevel = cards["normal.absorb"] ?? 0;
  if (normalLevel > 0 && source.elements.includes("normal")) {
    const bodies = logicalBodies(run);
    const adjacency = G.buildAdjacency(bodies, {
      stickOverride: G.stickOverrideForCards(cards) ?? undefined,
    });
    let sourceMass = Math.max(1, run.bodyStates.get(sourceUid)?.sizeLevel ?? 1);
    const targets = (adjacency.get(sourceUid) ?? [])
      .map((uid) => bodies.find((body) => body.uid === uid))
      .filter(Boolean)
      .filter((body) => Math.max(1, run.bodyStates.get(body.uid)?.sizeLevel ?? 1) <= sourceMass);
    const badgeLevel = cards["syn.badge"] ?? 0;
    const chance = G.valueAtLevel(G.CARD_PARAMS["normal.absorb"].chance, normalLevel);
    const maxTargets = G.valueAtLevel(G.CARD_PARAMS["normal.absorb"].targets, normalLevel);
    let absorbedCount = 0;
    for (const target of targets.slice(0, maxTargets)) {
      if (run.rng() >= chance) continue;
      const sourceState = run.bodyStates.get(sourceUid) ?? { uid: sourceUid, sizeLevel: 1 };
      const targetState = run.bodyStates.get(target.uid);
      run.uidBase.set(
        sourceUid,
        (run.uidBase.get(sourceUid) ?? run.meta[source.species].baseValue)
          + (run.uidBase.get(target.uid) ?? run.meta[target.species]?.baseValue ?? 15),
      );
      const targetMass = Math.max(1, targetState?.sizeLevel ?? 1);
      sourceMass += targetMass;
      run.bodyStates.set(sourceUid, {
        ...sourceState,
        sizeLevel: sourceMass,
      });
      removeBody(run, target.uid, true);
      absorbedCount++;
    }
    if (absorbedCount > 0) trigger(run, "normal.absorb", absorbedCount);
    if (absorbedCount > 0 && badgeLevel > 0 && source.elements.includes("water")) {
      const mult = G.valueAtLevel(G.CARD_PARAMS["syn.badge"].mult, badgeLevel);
      // 与 RogueRun 一致：液态融合只复制基础池与接桌数，不复制四个软上限池。
      const bonus = Math.round(pulse.chips * pulse.deskCount * (mult - 1));
      if (bonus > 0) {
        pulse.extras.push({ kind: "echo", uid: sourceUid, amount: bonus });
        run.cash += bonus;
        run.revenueShift += bonus;
        run.revenueTotal += bonus;
        run.maxPulse = Math.max(run.maxPulse, pulseGain(pulse));
      }
      trigger(run, "syn.badge", absorbedCount);
    }
  }

  const growLevel = cards["grass.grow"] ?? 0;
  if (growLevel > 0 && source.elements.includes("grass")) {
    let chance = G.valueAtLevel(G.CARD_PARAMS["grass.grow"].chance, growLevel);
    const irrigation = cards["syn.irrigation"] ?? 0;
    if (irrigation > 0 && source.elements.includes("water")) {
      chance *= G.valueAtLevel(G.CARD_PARAMS["syn.irrigation"].chanceMult, irrigation);
    }
    const greenhouse = cards["syn.greenhouse"] ?? 0;
    if (greenhouse > 0 && source.elements.includes("fire")) {
      chance += G.valueAtLevel(G.CARD_PARAMS["syn.greenhouse"].chance, greenhouse);
    }
    if (run.rng() < Math.min(1, chance)) {
      const grassSpecies = run.loadout.filter((species) =>
        run.meta[species].elements.includes("grass"));
      const species = grassSpecies[Math.floor(run.rng() * grassSpecies.length)];
      if (species) {
        const copies = Math.max(
          irrigation > 0 ? G.valueAtLevel(G.CARD_PARAMS["syn.irrigation"].growCopies, irrigation) : 1,
          greenhouse > 0 ? G.valueAtLevel(G.CARD_PARAMS["syn.greenhouse"].growCopies, greenhouse) : 1,
        );
        const multiSeed = cards["syn.multiSeed"] ?? 0;
        const parentMass = Math.max(1, run.bodyStates.get(sourceUid)?.sizeLevel ?? 1);
        const inheritedMass = multiSeed > 0 && source.elements.includes("normal")
          ? Math.max(
              1,
              Math.round(
                parentMass
                * G.valueAtLevel(G.CARD_PARAMS["syn.multiSeed"].inheritMass, multiSeed),
              ),
            )
          : 1;
        for (let copy = 0; copy < copies; copy++) {
          const uid = run.nextUid++;
          const body = {
            uid,
            species,
            elements: run.meta[species].elements.slice(),
            x: source.x + (copy % 2 === 0 ? -1 : 1) * (36 + 12 * Math.floor(copy / 2)),
            y: source.y - 52 - 8 * Math.floor(copy / 2),
            r: RADIUS,
            settled: true,
          };
          run.bodies.push(body);
          run.uidBase.set(uid, run.meta[species].baseValue);
          run.bodyStates.set(uid, { uid, generated: true, sizeLevel: inheritedMass });
        }
        trigger(run, "grass.grow");
        if (irrigation > 0) trigger(run, "syn.irrigation");
        if (greenhouse > 0) trigger(run, "syn.greenhouse");
        if (multiSeed > 0) trigger(run, "syn.multiSeed");
      }
    }
  }

  const emperor = cards["normal.emperor"] ?? 0;
  if (emperor > 0) {
    const normalTeam = [sourceUid, ...pulse.absorbUids].filter((uid) => {
      const body = logicalBodies(run).find((candidate) => candidate.uid === uid);
      return body?.elements.includes("normal");
    }).sort((leftUid, rightUid) => {
      const leftMass = Math.max(1, run.bodyStates.get(leftUid)?.sizeLevel ?? 1);
      const rightMass = Math.max(1, run.bodyStates.get(rightUid)?.sizeLevel ?? 1);
      return rightMass - leftMass || leftUid - rightUid;
    });
    const uid = normalTeam[0];
    if (uid != null) {
      const state = run.bodyStates.get(uid) ?? { uid, sizeLevel: 1 };
      run.bodyStates.set(uid, {
        ...state,
        sizeLevel: Math.max(1, state.sizeLevel ?? 1)
          + G.valueAtLevel(G.CARD_PARAMS["normal.emperor"].grow, emperor),
      });
      trigger(run, "normal.emperor");
      while (true) {
        const worker = logicalBodies(run).find((body) => body.uid === uid);
        if (!worker) break;
        const workerMass = Math.max(1, run.bodyStates.get(uid)?.sizeLevel ?? 1);
        const sourceScale = Math.min(1.85, 1 + Math.log2(workerMass) * 0.5);
        const sourceRadius = worker.r * sourceScale;
        const covered = logicalBodies(run)
          .filter((target) => target.uid !== uid)
          .filter((target) => {
            const targetMass = Math.max(1, run.bodyStates.get(target.uid)?.sizeLevel ?? 1);
            const targetScale = Math.min(1.85, 1 + Math.log2(targetMass) * 0.5);
            return Math.hypot(target.x - worker.x, target.y - worker.y) + target.r * targetScale
              <= sourceRadius + 0.001;
          })
          .sort((left, right) => {
            const dl = (left.x - worker.x) ** 2 + (left.y - worker.y) ** 2;
            const dr = (right.x - worker.x) ** 2 + (right.y - worker.y) ** 2;
            return dl - dr || left.uid - right.uid;
          });
        if (covered.length === 0) break;
        let absorbedAny = false;
        for (const target of covered) {
          const sourceState = run.bodyStates.get(uid) ?? { uid, sizeLevel: 1 };
          const targetState = run.bodyStates.get(target.uid) ?? { uid: target.uid, sizeLevel: 1 };
          const sourceMass = Math.max(1, sourceState.sizeLevel ?? 1);
          const targetMass = Math.max(1, targetState.sizeLevel ?? 1);
          if (targetMass > sourceMass) continue;
          run.uidBase.set(
            uid,
            (run.uidBase.get(uid) ?? run.meta[worker.species].baseValue)
              + (run.uidBase.get(target.uid) ?? run.meta[target.species]?.baseValue ?? 15),
          );
          run.bodyStates.set(uid, { ...sourceState, sizeLevel: sourceMass + targetMass });
          removeBody(run, target.uid, true);
          absorbedAny = true;
        }
        if (!absorbedAny) break;
      }
    }
  }
}

function strikeLineFor(run, elements) {
  const level = elements.includes("water") ? (run.cards["water.fourday"] ?? 0) : 0;
  return level > 0
    ? G.valueAtLevel(G.CARD_PARAMS["water.fourday"].line, level)
    : 3;
}

function resolveStrikes(run, lastGain) {
  const bodies = logicalBodies(run);
  const adjacency = G.buildAdjacency(bodies, {
    stickOverride: G.stickOverrideForCards(run.cards) ?? undefined,
  });
  const seen = new Set();
  for (const body of bodies) {
    if (seen.has(body.uid)) continue;
    const component = [];
    const queue = [body.uid];
    seen.add(body.uid);
    for (let i = 0; i < queue.length; i++) {
      const current = bodies.find((candidate) => candidate.uid === queue[i]);
      if (!current) continue;
      component.push(current);
      for (const nextUid of adjacency.get(current.uid) ?? []) {
        const next = bodies.find((candidate) => candidate.uid === nextUid);
        if (!next || seen.has(nextUid) || next.species !== body.species) continue;
        seen.add(nextUid);
        queue.push(nextUid);
      }
    }
    const line = strikeLineFor(run, body.elements);
    if (component.length < line) continue;
    const waterLevel = body.elements.includes("water") ? (run.cards["water.fourday"] ?? 0) : 0;
    if (waterLevel > 0) {
      const rate = G.valueAtLevel(G.CARD_PARAMS["water.fourday"].strikeBonus, waterLevel);
      const bonus = Math.round(lastGain * rate * component.length);
      run.cash += bonus;
      run.revenueShift += bonus;
      run.revenueTotal += bonus;
      trigger(run, "water.fourday", component.length);
    }
    const severance = run.cards["staff.severance"] ?? 0;
    const refundRate = severance > 0
      ? G.valueAtLevel(G.CARD_PARAMS["staff.severance"].refund, severance)
      : 0;
    for (const worker of component) {
      if (refundRate > 0) run.cash += Math.floor((run.uidCost.get(worker.uid) ?? 0) * refundRate);
      removeBody(run, worker.uid, true);
    }
    run.strikes++;
  }
}

function choosePlacement(run, species, overtime = false) {
  const profile = run.profile;
  const allowBridge = overtime || run.rng() < profile.bridgeAwareness;
  const scored = scoredPlacements(run, species, run.cards, allowBridge)
    .map((placement) => {
      const bodies = logicalBodies(run, [placement.body]);
      const adjacency = G.buildAdjacency(bodies, {
        stickOverride: G.stickOverrideForCards(run.cards) ?? undefined,
      });
      const byUid = new Map(bodies.map((body) => [body.uid, body]));
      const seen = new Set([placement.body.uid]);
      const queue = [placement.body.uid];
      for (let i = 0; i < queue.length; i++) {
        for (const nextUid of adjacency.get(queue[i]) ?? []) {
          const next = byUid.get(nextUid);
          if (!next || seen.has(nextUid) || next.species !== species) continue;
          seen.add(nextUid);
          queue.push(nextUid);
        }
      }
      const line = strikeLineFor(run, run.meta[species].elements);
      const wouldStrike = seen.size >= line;
      const safety = wouldStrike
        ? (1 - run.profile.strikeAwareness) * 0.12
        : 1;
      if (ALTERNATE_STRATEGY) {
        const sameNameCount = seen.size;
        const habitDistance = run.lastPlacementX == null
          ? 0
          : Math.abs(placement.x - run.lastPlacementX);
        const habit = 1 + Math.max(0, 1 - habitDistance / 240) * 0.28;
        if (run.kind === "newcomer") {
          // 直觉跟投：优先沿用上一根柱子、叠同名、落在桌面中央；
          // 只粗略感知数字大小，不枚举绝对最高脉冲。
          const visibleGain = Math.log2(2 + Math.max(0, placement.gain));
          const shape = placement.kind === "stack"
            ? 1.34
            : placement.kind === "desk" ? 1.16 : 0.86;
          const centerBias = placement.kind === "desk"
            && enabledDesks(run).some((desk) =>
              Math.abs(placement.x - (desk.x + desk.w / 2)) < 8)
            ? 1.18
            : 1;
          return {
            ...placement,
            decisionGain: visibleGain
              * shape
              * centerBias
              * habit
              * (1 + Math.max(0, sameNameCount - 1) * 0.16)
              * safety,
            wouldStrike,
          };
        }
        if (run.kind === "regular") {
          // 稳健成塔：追求同名塔、可持续得分与罢工安全，
          // 不为了单次最高值频繁跨桌搭桥。
          const stableGain = Math.pow(Math.max(1, placement.gain), 0.64);
          const shape = placement.kind === "stack"
            ? 1.28
            : placement.kind === "desk" ? 1.12 : 0.94;
          return {
            ...placement,
            decisionGain: stableGain
              * shape
              * (1 + Math.max(0, sameNameCount - 1) * 0.2)
              * (1 + Math.min(0.25, Math.max(0, placement.pulse.deskCount - 1) * 0.08))
              * Math.sqrt(habit)
              * safety,
            wouldStrike,
          };
        }

        // 乘区均衡搭桥：极限玩家不再只追当前总分，而是优先补齐
        // 个人/团队/网络/状态中的短板，并保留多桌与大团队结构。
        const pools = [
          placement.pulse.individualMult ?? 1,
          placement.pulse.teamMult ?? 1,
          placement.pulse.networkMult ?? 1,
          placement.pulse.statusMult ?? 1,
        ];
        const averagePool = pools.reduce((sum, value) => sum + value, 0) / pools.length;
        const weakestPool = Math.min(...pools);
        const balance = averagePool > 0 ? weakestPool / averagePool : 1;
        const structure = 1
          + Math.max(0, placement.pulse.deskCount - 1) * 0.18
          + Math.min(0.45, placement.pulse.absorbUids.length * 0.035);
        const bridge = placement.kind === "bridge" ? 1.3 : placement.kind === "stack" ? 1.08 : 1;
        return {
          ...placement,
          decisionGain: Math.pow(Math.max(1, placement.gain), 0.72)
            * (1 + balance * 0.55)
            * structure
            * bridge
            * safety,
          wouldStrike,
        };
      }
      return { ...placement, decisionGain: placement.gain * safety, wouldStrike };
    })
    .sort((left, right) => right.decisionGain - left.decisionGain || right.gain - left.gain);
  if (scored.length === 0) return null;
  if (overtime) return scored[0];
  const quality = clamp(profile.placementQuality + gaussian(run.rng) * 0.13, 0, 1);
  if (ALTERNATE_STRATEGY) {
    const breadth = run.kind === "newcomer" ? 8 : run.kind === "regular" ? 5 : 3;
    const extraNoise = run.kind === "newcomer" ? 2 : 0;
    const maxIndex = Math.min(
      scored.length - 1,
      Math.floor((1 - quality) * Math.min(breadth, scored.length)) + extraNoise,
    );
    const exponent = run.kind === "newcomer" ? 0.72 : run.kind === "regular" ? 1.3 : 2;
    return scored[Math.floor((run.rng() ** exponent) * (maxIndex + 1))];
  }
  const maxIndex = Math.min(scored.length - 1, Math.floor((1 - quality) * Math.min(4, scored.length)));
  return scored[Math.floor(run.rng() * (maxIndex + 1))];
}

function manualDrop(run, worker) {
  const profile = run.profile;
  let accuracy = profile.accuracy;
  if (G.hasWindRule(run.modifier)) accuracy -= profile.windPenalty;
  if (run.disabledDesks.length > 0 && run.rng() > profile.disabledAwareness) accuracy -= 0.08;
  accuracy = clamp(accuracy + gaussian(run.rng) * 0.025, 0.45, 0.99);
  run.throws++;
  run.quotaUsed = Math.max(run.quotaUsed, 0);

  if (run.rng() > accuracy) {
    run.errors++;
    run.combo = 0;
    if (run.rng() < 0.68) {
      run.quotaUsed = Math.max(0, run.quotaUsed - 1);
      return 0;
    }
    const uid = run.nextUid++;
    const meta = run.meta[worker.species];
    run.bodies.push({
      uid,
      species: worker.species,
      elements: meta.elements.slice(),
      x: 900 + run.rng() * 300,
      y: 90 + run.rng() * 80,
      r: RADIUS,
      settled: true,
      offdesk: true,
    });
    run.uidBase.set(uid, meta.baseValue);
    run.uidCost.set(uid, worker.cost);
    return 0;
  }

  const placement = choosePlacement(run, worker.species, false);
  if (!placement || placement.gain <= 0) {
    run.errors++;
    run.combo = 0;
    run.quotaUsed = Math.max(0, run.quotaUsed - 1);
    return 0;
  }
  const uid = run.nextUid++;
  const body = { ...placement.body, uid };
  run.uidBase.set(uid, run.meta[worker.species].baseValue);
  run.uidCost.set(uid, worker.cost);
  run.bodies.push(body);
  if (body.elements.includes("normal")) run.bodyStates.set(uid, { uid, sizeLevel: 1 });
  const pulse = pulseFor(run, uid);
  const gain = pulseGain(pulse);
  recordDirectContributions(run, pulse, uid);
  run.cash += gain;
  run.revenueShift += gain;
  run.revenueTotal += gain;
  run.maxPulse = Math.max(run.maxPulse, gain);
  run.combo++;
  run.recentPulses.push(gain);
  if (run.recentPulses.length > 12) run.recentPulses.shift();
  applyPostPulse(run, pulse, uid);
  recordPulseShape(run, pulse);
  run.lastPlacementX = body.x;
  run.lastPlacementKind = placement.kind;
  resolveStrikes(run, gain);
  return gain;
}

function overtimeDrop(run, worker) {
  const placement = choosePlacement(run, worker.species, true);
  if (!placement || placement.gain <= 0) return 0;
  const uid = run.nextUid++;
  const body = { ...placement.body, uid };
  run.uidBase.set(uid, run.meta[worker.species].baseValue);
  run.uidCost.set(uid, worker.cost);
  run.bodies.push(body);
  if (body.elements.includes("normal")) run.bodyStates.set(uid, { uid, sizeLevel: 1 });
  const pulse = pulseFor(run, uid);
  const gain = pulseGain(pulse);
  recordDirectContributions(run, pulse, uid);
  run.cash += gain;
  run.revenueShift += gain;
  run.revenueTotal += gain;
  run.maxPulse = Math.max(run.maxPulse, gain);
  applyPostPulse(run, pulse, uid);
  recordPulseShape(run, pulse);
  // 加班角色计分后返池，不留在塔上。
  removeBody(run, uid, false);
  return gain;
}

function candidateValue(run, species, cost) {
  const meta = run.meta[species];
  const anchorHits = meta.elements.filter((element) => run.anchor.includes(element)).length;
  if (ALTERNATE_STRATEGY) {
    const onBoard = logicalBodies(run).filter((body) => body.species === species).length;
    const affordability = 1 / Math.max(1, cost);
    const aesthetics = 1 + gaussian(run.rng) * run.profile.cosmeticNoise;
    if (run.kind === "newcomer") {
      // 新手按熟悉元素、便宜程度和“我已经有这种”做招聘决定。
      return (1 + anchorHits * 0.48)
        * (1 + Math.min(3, onBoard) * 0.13)
        * (1.2 - Math.max(0, meta.tierCount - 1) * 0.08)
        * aesthetics
        * affordability;
    }
    if (run.kind === "regular") {
      // 中度玩家主动收同名，并偏爱能稳定接两张桌的双系。
      return meta.baseValue
        * (1 + anchorHits * 0.34)
        * (1 + Math.min(4, onBoard) * 0.2)
        * (1 + Math.min(2, Math.max(0, meta.tierCount - 1)) * 0.18)
        * aesthetics
        * affordability;
    }
    // 极限玩家围绕主轴补齐多桌桥梁，但仍考虑低色阶的基础分优势。
    const bridgeValue = 1 + Math.max(0, meta.tierCount - 1) * 0.34;
    const missingAnchor = run.anchor.filter((element) =>
      !logicalBodies(run).some((body) => body.elements.includes(element))).length;
    const coverage = meta.elements.filter((element) => run.anchor.includes(element)).length;
    return meta.baseValue
      * (1 + coverage * 0.42)
      * bridgeValue
      * (1 + Math.min(2, missingAnchor) * 0.12)
      * aesthetics
      * affordability;
  }
  const direct = meta.baseValue * (1 + meta.reach * 0.09) * (1 + anchorHits * 0.28);
  const multi = 1 + Math.max(0, meta.elements.length - 1) * run.profile.bridgeAwareness * 0.42;
  const aesthetics = 1 + gaussian(run.rng) * run.profile.cosmeticNoise;
  return direct * multi * aesthetics / Math.max(1, cost);
}

function quoteCandidates(run, candidates) {
  return candidates.map((species, index) => {
    const meta = run.meta[species];
    const tier = meta.tierCount;
    const cutLevel = run.cards["staff.pricecut"] ?? 0;
    let priceMult = cutLevel > 0 && run.pricecutTier === tier
      ? 1 - G.valueAtLevel(G.CARD_PARAMS["staff.pricecut"].cut, cutLevel)
      : 1;
    const freezeLevel = run.cards["ice.freezeprice"] ?? 0;
    if (freezeLevel > 0 && meta.elements.includes("ice")) {
      priceMult *= G.valueAtLevel(G.CARD_PARAMS["ice.freezeprice"].priceMult, freezeLevel);
    }
    const cost = G.hirePrice({
      tierCount: tier,
      kpi: run.kpi,
      hiredThisShift: run.hireCounts[tier] ?? 0,
      baseCut: 1 - priceMult,
    });
    return { index, species, cost, value: candidateValue(run, species, cost) };
  });
}

function desiredBag(run) {
  if (run.shift === 1) return run.profile.firstBag;
  const recent = run.recentPulses.length > 0
    ? run.recentPulses.reduce((sum, value) => sum + value, 0) / run.recentPulses.length
    : 15;
  const expected = Math.ceil(run.kpi / Math.max(1, recent * (1.12 + run.profile.placementQuality * 0.3)));
  return clamp(
    Math.max(run.profile.minBag, expected + run.profile.errorBuffer),
    run.profile.minBag,
    10 + ((run.cards["staff.backfill"] ?? 0) > 0
      ? G.valueAtLevel(G.CARD_PARAMS["staff.backfill"].extraCandidates, run.cards["staff.backfill"])
      : 0),
  );
}

function selectHireSet(run, candidates, needed) {
  const quoted = quoteCandidates(run, candidates)
    .sort((left, right) => right.value - left.value || left.cost - right.cost);
  const selected = [];
  const speciesCounts = {};
  for (const candidate of quoted) {
    if (selected.length >= Math.min(needed, G.HIRING_PICK_LIMIT ?? 10)) break;
    const count = speciesCounts[candidate.species] ?? 0;
    const duplicatePenalty = ALTERNATE_STRATEGY
      ? (
        count >= (run.kind === "newcomer" ? 4 : 3)
          ? run.kind === "expert" ? 0.72 : 0.92
          : 1
      )
      : (count >= 2 ? 0.72 - run.profile.shopKnowledge * 0.22 : 1);
    if (candidate.value * duplicatePenalty < quoted[0].value * 0.28 && selected.length >= 3) continue;
    selected.push(candidate);
    speciesCounts[candidate.species] = count + 1;
  }
  return selected;
}

function hireRound(run, candidateCount, needed, firstRound) {
  let candidates = Array.from(
    { length: candidateCount },
    () => run.loadout[Math.floor(run.rng() * run.loadout.length)],
  );
  if (run.shift === 1 && firstRound) {
    const mono = run.loadout.find((species) => run.meta[species].tierCount === 1);
    if (mono) for (let i = 0; i < Math.min(3, candidates.length); i++) candidates[i] = mono;
  }
  let selected = selectHireSet(run, candidates, needed);
  const talent = run.cards["staff.talentmarket"] ?? 0;
  const talentParams = G.CARD_PARAMS["staff.talentmarket"];
  const rerollsMax = "rerollsPerLevel" in talentParams
    ? talent * talentParams.rerollsPerLevel
    : 1 + talent;
  for (let reroll = 0; reroll < rerollsMax; reroll++) {
    const weak = selected.length < needed
      || selected.reduce((sum, item) => sum + item.value, 0) / Math.max(1, selected.length)
        < Math.max(...selected.map((item) => item.value), 0) * 0.62;
    if (!weak || run.rng() >= run.profile.hireRerollChance) break;
    const rate = G.HIRING_REROLL_RATES[reroll] ?? 0.32;
    const cost = Math.round(rate * run.kpi);
    if (run.cash < cost) break;
    run.cash -= cost;
    run.rerollSpend += cost;
    run.hireRerolls++;
    candidates = Array.from(
      { length: candidateCount },
      () => run.loadout[Math.floor(run.rng() * run.loadout.length)],
    );
    selected = selectHireSet(run, candidates, needed);
  }

  const reserve = Math.min(run.cash * 0.45, run.kpi * run.profile.reserveRate);
  const hired = [];
  for (const candidate of selected) {
    const meta = run.meta[candidate.species];
    const tier = meta.tierCount;
    const cutLevel = run.cards["staff.pricecut"] ?? 0;
    let priceMult = cutLevel > 0 && run.pricecutTier === tier
      ? 1 - G.valueAtLevel(G.CARD_PARAMS["staff.pricecut"].cut, cutLevel)
      : 1;
    const freezePrice = run.cards["ice.freezeprice"] ?? 0;
    if (freezePrice > 0 && meta.elements.includes("ice")) {
      priceMult *= G.valueAtLevel(G.CARD_PARAMS["ice.freezeprice"].priceMult, freezePrice);
    }
    const actualCost = G.hirePrice({
      tierCount: tier,
      kpi: run.kpi,
      hiredThisShift: run.hireCounts[tier] ?? 0,
      baseCut: 1 - priceMult,
    });
    if (run.quotaUsed >= run.quotaMax || run.cash - actualCost < reserve) break;
    run.cash -= actualCost;
    run.hireSpend += actualCost;
    run.hires++;
    run.quotaUsed++;
    hired.push({ species: candidate.species, cost: actualCost });
    run.hireCounts[tier] = (run.hireCounts[tier] ?? 0) + 1;
    if (freezePrice > 0 && meta.elements.includes("ice")) trigger(run, "ice.freezeprice");
  }
  run.bag.push(...hired);
  return hired.length;
}

function recruit(run) {
  const desired = desiredBag(run);
  let needed = Math.max(0, desired - run.bag.length);
  if (needed <= 0) return;
  const talent = run.cards["staff.talentmarket"] ?? 0;
  const talentParams = G.CARD_PARAMS["staff.talentmarket"];
  const extraCandidates = "candidatesPerLevel" in talentParams
    ? talent * talentParams.candidatesPerLevel
    : 0;
  const hired = hireRound(run, 10 + extraCandidates, needed, true);
  needed -= hired;
  const backfill = run.cards["staff.backfill"] ?? 0;
  if (needed > 0 && backfill > 0) {
    hireRound(
      run,
      G.valueAtLevel(G.CARD_PARAMS["staff.backfill"].extraCandidates, backfill)
        + extraCandidates,
      needed,
      false,
    );
    trigger(run, "staff.backfill");
  }
  run.bag = shuffle(run.bag, run.rng);
}

function bestCurrentPulse(run, cards) {
  const values = run.loadout.flatMap((species) =>
    scoredPlacements(run, species, cards, true).slice(0, 1).map((item) => item.gain));
  return Math.max(1, ...values);
}

function setupUtility(run, id) {
  const elements = activeElements(run.loadout, run.meta);
  const hasElement = (element) => elements.includes(element);
  const isAnchor = (element) => run.anchor.includes(element);
  const def = G.cardDef(id);
  if (def?.dim === 3 && def.pair != null) {
    const aligned = def.pair.every((element) => run.anchor.includes(element));
    const available = def.pair.every((element) => hasElement(element));
    const explicitArchetype = run.routeId?.startsWith("pair_")
      || run.routeId?.startsWith("triple_");
    if (explicitArchetype && aligned) return 0.24;
    if (run.routeId?.startsWith("attr_")) return available ? 0.06 : -0.16;
    if (aligned) return 0.16;
    return available ? 0.04 : -0.16;
  }
  if (id === "ice.freezeprice") return hasElement("ice") ? (isAnchor("ice") ? 0.16 : 0.1) : -0.25;
  if (id === "ice.freeze") return hasElement("ice") ? (isAnchor("ice") ? 0.22 : 0.12) : -0.25;
  if (id === "ice.overstaff") {
    return (run.cards["ice.freeze"] ?? 0) > 0 ? 0.16 : 0.02;
  }
  if (id === "water.fourday") return hasElement("water") ? (isAnchor("water") ? 0.22 : 0.12) : -0.25;
  if (id === "water.same") return (run.cards["water.fourday"] ?? 0) > 0 ? 0.16 : 0.02;
  if (id === "water.convert") return hasElement("water") ? (isAnchor("water") ? 0.18 : 0.1) : -0.25;
  if (id === "grass.grow") return hasElement("grass") ? 0.14 : -0.25;
  if (id === "normal.absorb") return hasElement("normal") ? (isAnchor("normal") ? 0.22 : 0.12) : -0.25;
  if (id === "normal.gluttony") return (run.cards["normal.absorb"] ?? 0) > 0 ? 0.16 : 0.02;
  if (id === "normal.emperor") return (run.cards["normal.gluttony"] ?? 0) > 0 ? 0.2 : 0.08;
  if (id === "staff.fire3") return run.bodies.filter((body) => body.offdesk).length >= 2 ? 0.1 : -0.1;
  if (id === "staff.severance") return run.errors + run.strikes >= 4 ? 0.09 : -0.055;
  if (id === "staff.movedesk") return run.disabledDesks.length > 0 ? 0.025 : -0.12;
  if (id === "staff.expand") return run.quotaUsed / run.quotaMax > 0.82 ? 0.14 : -0.08;
  if (id === "staff.talentmarket") return run.hireRerolls > 0 ? 0.1 : 0.015;
  if (id === "staff.backfill") return run.bag.length <= 2 ? 0.12 : -0.045;
  if (id === "staff.loan") {
    // 最新规则按本金总计偿还 105%；它是流动性工具，不再随未来 KPI 复利。
    if (run.profile.shopKnowledge < 0.5) return 0.15;
    return run.cash < run.kpi * 0.35 ? 0.08 : -0.08;
  }
  if (id === "staff.pricecut") return 0.12;
  return 0;
}

function cardPoolCategory(id) {
  if (
    id === "electric.overload"
    || id === "normal.gluttony"
    || id === "attr.pure"
    || id === "attr.dual"
    || id === "attr.slash"
    || id === "attr.hex"
  ) return "individual";
  if (
    id === "water.same"
    || id === "ice.overstaff"
    || id === "grass.crowd"
    || id === "attr.balance"
  ) return "team";
  if (
    id === "electric.parallel"
    || id === "electric.induction"
    || id === "grass.height"
    || id === "syn.arcIgnite"
    || id === "syn.bionet"
    || id === "syn.lightningrod"
    || id === "syn.permafrost"
  ) return "network";
  if (
    id === "syn.steamBurst"
    || id === "syn.iceMirror"
    || id === "syn.superconduct"
    || id === "syn.fireDispatch"
  ) return "status";
  if (
    id === "fire.burst"
    || id === "fire.wildfire"
    || id === "syn.thermalShock"
    || id === "syn.short"
    || id === "syn.badge"
  ) return "extra";
  return "foundation";
}

function attributeEligibility(run, id) {
  if (!id.startsWith("attr.")) return null;
  const eligible = new Set(run.loadout.map((species) => run.meta[species].tierCount));
  if (id === "attr.pure") return eligible.has(1);
  if (id === "attr.dual") return eligible.has(2);
  if (id === "attr.slash") return eligible.has(3);
  if (id === "attr.hex") return [4, 5, 6].some((tier) => eligible.has(tier));
  if (id === "attr.balance") return [1, 2, 3, 4, 5, 6].every((tier) => eligible.has(tier));
  return true;
}

function alternateCardDecisionScore(run, id, baseline = null) {
  const def = G.cardDef(id);
  if (!def) return -Infinity;
  const eligibility = attributeEligibility(run, id);
  if (eligibility === false) return -0.7 + gaussian(run.rng) * 0.01;
  const level = run.cards[id] ?? 0;
  const price = G.cardPrice(def, level, run.kpi);
  const opportunity = price / Math.max(1, run.kpi) + G.SHOP_SKIP_REFUND_RATE;
  const category = cardPoolCategory(id);
  const setup = setupUtility(run, id);
  const elementOwner = def.element;
  const elementFit = elementOwner == null
    ? 0
    : run.anchor.includes(elementOwner) ? 0.14 : 0.045;
  const pairFit = def.pair == null
    ? 0
    : def.pair.every((element) => run.anchor.includes(element)) ? 0.18 : 0.025;

  if (run.kind === "newcomer") {
    // 新手读卡面关键词与稀有度，重视“我的元素”和立刻看得懂的基础卡；
    // 不调用全场最优落点来精算每张卡的边际收益。
    const readable = id.startsWith("base.")
      || id.endsWith(".chain")
      || id === "fire.burst"
      || id === "electric.overload"
      || id === "water.fourday"
      || id === "normal.absorb"
      || id === "grass.grow"
      || id === "ice.freeze"
      ? 0.12
      : 0;
    return readable
      + elementFit
      + pairFit
      + setup * 0.55
      + (def.rarity === "epic" ? 0.035 : 0)
      - opportunity * 0.38
      - level * 0.022
      + gaussian(run.rng) * 0.075;
  }

  const currentBaseline = baseline ?? bestCurrentPulse(run, run.cards);
  const candidateCards = def.oneShot ? run.cards : { ...run.cards, [id]: level + 1 };
  const improved = bestCurrentPulse(run, candidateCards);
  const rawLift = Math.max(0, improved / Math.max(1, currentBaseline) - 1);
  const compressedLift = rawLift / (1 + rawLift / (run.kind === "expert" ? 2 : 1.25));
  const sampleCount = Math.max(1, run.poolSamples.count);
  const poolValue = category === "extra" || category === "foundation"
    ? 1
    : run.poolSamples[category] / sampleCount;
  const cap = category === "status" ? 8 : 10;
  const poolNeed = category === "extra" || category === "foundation"
    ? 0
    : clamp(1 - (poolValue - 1) / (cap - 1), 0, 1);

  if (run.kind === "regular") {
    // 中度玩家看近期稳定收益和主轴匹配，弱化单个理想落点的诱惑。
    return compressedLift * 0.55
      + setup * 0.72
      + elementFit * 0.7
      + pairFit * 0.72
      + poolNeed * 0.055
      - opportunity * 0.5
      - level * 0.012
      + gaussian(run.rng) * 0.045;
  }

  // 极限玩家根据四个软上限池的平均强度补短板；
  // 额外结算卡另行估值，避免继续往已接近软上限的同一池堆数值。
  const categoryDiversity = category !== run.lastBoughtPool ? 0.035 : 0;
  const extraValue = category === "extra" ? 0.08 : 0;
  return compressedLift * 0.62
    + setup * 0.78
    + elementFit * 0.65
    + pairFit * 0.78
    + poolNeed * 0.17
    + categoryDiversity
    + extraValue
    - opportunity * 0.58
    - level * 0.01
    + gaussian(run.rng) * 0.022;
}

function cardDecisionScore(run, id, baseline = null) {
  if (ALTERNATE_STRATEGY) return alternateCardDecisionScore(run, id, baseline);
  const def = G.cardDef(id);
  if (!def) return -Infinity;
  const currentLevel = run.cards[id] ?? 0;
  const candidateCards = def.oneShot ? run.cards : { ...run.cards, [id]: currentLevel + 1 };
  const currentBaseline = baseline ?? bestCurrentPulse(run, run.cards);
  const improved = bestCurrentPulse(run, candidateCards);
  let trueValue = Math.max(0, improved / currentBaseline - 1) + setupUtility(run, id);

  if (id.startsWith("attr.")) {
    const eligible = new Set(run.loadout.map((species) => run.meta[species].tierCount));
    if (id === "attr.pure" && !eligible.has(1)) trueValue = -0.4;
    if (id === "attr.dual" && !eligible.has(2)) trueValue = -0.4;
    if (id === "attr.slash" && !eligible.has(3)) trueValue = -0.4;
    if (id === "attr.hex" && ![4, 5, 6].some((tier) => eligible.has(tier))) trueValue = -0.55;
    if (id === "attr.balance" && ![1, 2, 3, 4, 5, 6].every((tier) => eligible.has(tier))) {
      trueValue = -0.62;
    }
  }
  const price = G.cardPrice(def, currentLevel, run.kpi);
  const opportunity = (price / Math.max(1, run.kpi)) + G.SHOP_SKIP_REFUND_RATE;
  const perceived = trueValue * run.profile.shopKnowledge
    + setupUtility(run, id) * (1 - run.profile.shopKnowledge)
    + (def.rarity === "epic" ? run.profile.rarityBias : 0)
    + gaussian(run.rng) * (0.1 - run.profile.shopKnowledge * 0.07)
    - opportunity * (0.42 + run.profile.shopKnowledge * 0.2);
  return perceived;
}

function useOneShot(run, id) {
  if (id === "staff.fire3") {
    const worst = run.bodies
      .map((body) => ({
        body,
        gain: pulseGain(pulseFor(run, body.uid)),
      }))
      .sort((left, right) => left.gain - right.gain)
      .slice(0, 3);
    for (const item of worst) {
      // 与 RogueRun.settleDeparture(uid, 1) 一致：主动解雇至少返还 100% 最近雇价，
      // 遣散费不再额外叠加。
      run.cash += Math.floor(run.uidCost.get(item.body.uid) ?? 0);
      removeBody(run, item.body.uid, true);
    }
    trigger(run, id);
  } else if (id === "staff.movedesk") {
    // 近似真实行为：把一座低收益塔返池；不人为制造得分。
    const returned = run.bodies.filter((body) => !run.bodyStates.get(body.uid)?.generated).slice(0, 2);
    for (const body of returned) {
      run.bag.push({ species: body.species, cost: run.uidCost.get(body.uid) ?? 0 });
      removeBody(run, body.uid, false);
    }
    trigger(run, id);
  } else if (id === "staff.loan") {
    const principal = Math.round(G.LOAN_GAIN_RATE * run.kpi);
    run.cash += principal;
    run.loan = {
      principal,
      totalDue: Math.round(principal * G.LOAN_TOTAL_REPAY_RATE),
      paid: 0,
      shiftsLeft: G.LOAN_SHIFTS,
    };
    trigger(run, id);
  }
}

function buyCard(run, id) {
  const def = G.cardDef(id);
  const level = run.cards[id] ?? 0;
  const price = G.cardPrice(def, level, run.kpi);
  if (run.cash < price) return false;
  run.cash -= price;
  run.shopSpend += price;
  run.cardBuys[id] = (run.cardBuys[id] ?? 0) + 1;
  run.lastBoughtPool = cardPoolCategory(id);
  if (def.oneShot) {
    useOneShot(run, id);
  } else {
    run.cards[id] = level + 1;
    if (id === "staff.expand") run.quotaMax += G.CARD_PARAMS["staff.expand"].quota;
    if (id === "staff.pricecut") {
      const tierCounts = run.loadout.reduce((counts, species) => {
        const tier = run.meta[species].tierCount;
        counts[tier] = (counts[tier] ?? 0) + 1;
        return counts;
      }, {});
      run.pricecutTier = Number(
        Object.entries(tierCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 1,
      );
    }
  }
  return true;
}

function shop(run) {
  const loadoutElementCounts = {};
  for (const species of run.loadout) {
    for (const element of run.meta[species]?.elements ?? []) {
      loadoutElementCounts[element] = (loadoutElementCounts[element] ?? 0) + 1;
    }
  }
  const args = {
    loadoutElements: activeElements(run.loadout, run.meta),
    loadoutElementCounts,
    cardLevels: run.cards,
    activeLoan: run.loan != null,
  };
  const offer = G.buildOffer(run.rng, args);
  for (let dimIndex = 0; dimIndex < 3; dimIndex++) {
    let ids = offer.cards[dimIndex];
    const foundationElement = run.anchor
      .slice()
      .sort((left, right) => (
        (run.cards[`base.${left}`] ?? 0) - (run.cards[`base.${right}`] ?? 0)
        || run.anchor.indexOf(left) - run.anchor.indexOf(right)
      ))[0];
    if (
      FOUNDATION_GUARANTEE
      && run.shift <= 7
      && dimIndex === 0
      && foundationElement != null
      && (run.cards[`base.${foundationElement}`] ?? 0) < 3
    ) {
      const foundationId = `base.${foundationElement}`;
      if (!ids.includes(foundationId)) ids = [...ids.slice(0, -1), foundationId];
    }
    for (const id of ids) run.cardOffers[id] = (run.cardOffers[id] ?? 0) + 1;
    const baseline = bestCurrentPulse(run, run.cards);
    let ranked = ids.map((id) => ({ id, score: cardDecisionScore(run, id, baseline) }))
      .sort((left, right) => right.score - left.score);
    if (
      (ranked[0]?.score ?? -Infinity) < run.profile.shopThreshold
      && run.rng() < run.profile.shopRefreshChance
    ) {
      const rerollCost = Math.round(0.07 * run.kpi);
      if (run.cash >= rerollCost) {
        run.cash -= rerollCost;
        run.shopRerollSpend += rerollCost;
        ids = G.drawDimCards(run.rng, offer.dims[dimIndex], args);
        for (const id of ids) run.cardOffers[id] = (run.cardOffers[id] ?? 0) + 1;
        ranked = ids.map((id) => ({ id, score: cardDecisionScore(run, id, baseline) }))
          .sort((left, right) => right.score - left.score);
      }
    }
    const best = ranked[0];
    if (best && best.score >= run.profile.shopThreshold && buyCard(run, best.id)) continue;
    run.cash += Math.round(G.SHOP_SKIP_REFUND_RATE * run.kpi);
    run.skips++;
  }
}

function startRun(kind, seed, route = null, options = {}) {
  const rng = mulberry32(seed);
  const meta = collectionFor(kind);
  const selected = loadoutFor(kind, meta, rng, route);
  return {
    kind,
    routeId: route?.id ?? null,
    profile: PROFILE_DEFS[kind],
    rng,
    meta,
    loadout: selected.species,
    anchor: selected.anchor,
    strategy: ALTERNATE_STRATEGY
      ? (
        kind === "newcomer"
          ? "直觉跟投与熟悉柱"
          : kind === "regular" ? "稳健同名成塔" : "四池均衡搭桥"
      )
      : "当前脉冲择优",
    shift: 1,
    kpi: G.kpiForShift(1),
    modifier: "none",
    disabledDesks: [],
    cash: G.START_CASH,
    revenueShift: 0,
    revenueTotal: 0,
    quotaMax: G.QUOTA_START,
    quotaUsed: 0,
    hireCounts: [0, 0, 0, 0, 0, 0, 0],
    bag: [],
    bodies: [],
    bodyStates: new Map(),
    uidBase: new Map(),
    uidCost: new Map(),
    nextUid: 1,
    cards: {},
    pricecutTier: null,
    loan: null,
    combo: 0,
    recentPulses: [],
    lastPlacementX: null,
    lastPlacementKind: null,
    lastBoughtPool: null,
    poolSamples: {
      count: 0,
      individual: 0,
      team: 0,
      network: 0,
      status: 0,
      rhythm: 0,
    },
    peakBreakdown: null,
    cardOffers: {},
    cardBuys: {},
    cardDirect: {},
    cardTriggers: {},
    hires: 0,
    hireSpend: 0,
    hireRerolls: 0,
    rerollSpend: 0,
    shopSpend: 0,
    shopRerollSpend: 0,
    skips: 0,
    throws: 0,
    errors: 0,
    strikes: 0,
    maxPulse: 0,
    shiftRows: [],
    trackContributions: options.trackContributions ?? true,
    fastMode: options.fastMode ?? false,
  };
}

function playShift(run) {
  run.kpi = G.kpiForShift(run.shift);
  run.modifier = G.modifierForShift(run.shift, run.rng);
  const disabledCount = run.shift === G.TOTAL_SHIFTS ? 0 : run.shift > 10 ? 2 : run.shift > 5 ? 1 : 0;
  const runElements = activeElements(run.loadout, run.meta);
  run.disabledDesks = shuffle(ELEMENTS, run.rng).slice(0, disabledCount);
  if (
    ACTIVE_DESK_FLOOR
    && runElements.length > 0
    && runElements.every((element) => run.disabledDesks.includes(element))
  ) {
    const replacement = ELEMENTS.find((element) => (
      !runElements.includes(element) && !run.disabledDesks.includes(element)
    ));
    const activeIndex = run.disabledDesks.findIndex((element) => runElements.includes(element));
    if (replacement != null && activeIndex >= 0) run.disabledDesks[activeIndex] = replacement;
  }
  run.revenueShift = 0;
  run.combo = 0;
  recruit(run);
  if (run.bag.length === 0) return { success: false, reason: "pool_empty" };

  let throwLimit = Infinity;
  if (G.hasPowerRule(run.modifier)) throwLimit = G.powerThrowLimitFor(run.modifier);
  if (G.hasRushRule(run.modifier)) {
    const wall = G.rushWallMsFor(run.modifier) / 1000;
    const timeLimit = Math.max(1, Math.floor(wall / Math.max(1, run.profile.thinkSeconds * (
      0.8 + Math.abs(gaussian(run.rng)) * 0.28
    ))));
    throwLimit = Math.min(throwLimit, timeLimit);
  }

  let attempts = 0;
  while (run.revenueShift < run.kpi && run.bag.length > 0 && attempts < throwLimit) {
    const worker = run.bag.shift();
    manualDrop(run, worker);
    attempts++;
  }
  if (run.revenueShift < run.kpi) {
    const reason = attempts >= throwLimit ? "inspection_limit" : "pool_empty";
    return { success: false, reason };
  }

  const bonus = Math.round(run.kpi * G.KPI_BONUS_RATE);
  run.cash += bonus;
  run.revenueShift += bonus;
  run.revenueTotal += bonus;
  const overtime = run.bag.slice();
  for (const worker of overtime) overtimeDrop(run, worker);

  if (run.cash < run.kpi) return { success: false, reason: "bill" };
  run.cash -= run.kpi;
  if (run.loan) {
    const remaining = Math.max(0, run.loan.totalDue - run.loan.paid);
    const repay = run.loan.shiftsLeft <= 1
      ? remaining
      : Math.min(remaining, Math.round(run.loan.principal * G.LOAN_REPAY_RATE));
    if (run.cash < repay) return { success: false, reason: "loan" };
    run.cash -= repay;
    run.loan.paid += repay;
    run.loan.shiftsLeft--;
    if (run.loan.shiftsLeft <= 0) run.loan = null;
  }
  run.quotaMax += G.QUOTA_PER_SHIFT;
  for (const body of run.bodies.slice()) {
    if (body.offdesk && run.rng() < 0.72) removeBody(run, body.uid, true);
  }
  shop(run);
  run.shiftRows.push({
    shift: run.shift,
    kpi: run.kpi,
    revenue: run.revenueShift,
    cash: run.cash,
    bag: run.bag.length,
    bodies: run.bodies.length,
    attempts,
    errors: run.errors,
    cards: Object.keys(run.cards).length,
  });
  return { success: true };
}

export function simulate(kind, seed, route = null, options = {}) {
  const run = startRun(kind, seed, route, options);
  let reason = "complete";
  let cleared = 0;
  for (let shift = 1; shift <= G.TOTAL_SHIFTS; shift++) {
    run.shift = shift;
    const result = playShift(run);
    if (!result.success) {
      reason = result.reason;
      break;
    }
    cleared = shift;
  }
  return {
    kind,
    strategy: run.strategy,
    anchor: run.anchor.slice(),
    routeId: run.routeId,
    cleared,
    reason,
    completed: cleared === G.TOTAL_SHIFTS,
    cash: run.cash,
    revenue: run.revenueTotal,
    maxPulse: run.maxPulse,
    peakBreakdown: run.peakBreakdown,
    poolAverages: Object.fromEntries(
      ["individual", "team", "network", "status", "rhythm"].map((key) => [
        key,
        run.poolSamples.count > 0 ? run.poolSamples[key] / run.poolSamples.count : 1,
      ]),
    ),
    hires: run.hires,
    hireSpend: run.hireSpend,
    hireRerolls: run.hireRerolls,
    rerollSpend: run.rerollSpend,
    shopSpend: run.shopSpend,
    shopRerollSpend: run.shopRerollSpend,
    skips: run.skips,
    throws: run.throws,
    errors: run.errors,
    strikes: run.strikes,
    loadout: run.loadout,
    loadoutTiers: run.loadout.map((species) => run.meta[species].tierCount),
    cardOffers: run.cardOffers,
    cardBuys: run.cardBuys,
    cardDirect: run.cardDirect,
    cardTriggers: run.cardTriggers,
    cards: run.cards,
    shiftRows: run.shiftRows,
  };
}

function aggregateCards(results) {
  const out = {};
  for (const result of results) {
    const ids = new Set([
      ...Object.keys(result.cardOffers),
      ...Object.keys(result.cardBuys),
      ...Object.keys(result.cardDirect),
      ...Object.keys(result.cardTriggers),
    ]);
    for (const id of ids) {
      const row = out[id] ??= {
        offered: 0,
        bought: 0,
        buyers: 0,
        direct: 0,
        triggers: 0,
        buyerClears: [],
      };
      row.offered += result.cardOffers[id] ?? 0;
      row.bought += result.cardBuys[id] ?? 0;
      row.direct += result.cardDirect[id] ?? 0;
      row.triggers += result.cardTriggers[id] ?? 0;
      if ((result.cardBuys[id] ?? 0) > 0) {
        row.buyers++;
        row.buyerClears.push(result.cleared);
      }
    }
  }
  return Object.fromEntries(Object.entries(out).map(([id, row]) => [id, {
    offered: row.offered,
    bought: row.bought,
    buyers: row.buyers,
    takeRate: row.offered > 0 ? Number((row.bought / row.offered).toFixed(3)) : 0,
    direct: Math.round(row.direct),
    directPerBuy: row.bought > 0 ? Math.round(row.direct / row.bought) : 0,
    triggers: row.triggers,
    medianBuyerClear: row.buyerClears.length > 0
      ? Number(percentile(row.buyerClears, 0.5).toFixed(1))
      : 0,
  }]));
}

export function summarize(kind, results) {
  const completed = results.filter((result) => result.completed);
  const peakRows = results.map((result) => result.peakBreakdown).filter(Boolean);
  const checkpoint = (shift) => results.filter((result) => result.cleared >= shift).length / results.length;
  const anchorGroups = Object.groupBy(results, (result) => result.anchor.join("+"));
  return {
    label: PROFILE_DEFS[kind].label,
    collectionSize: PROFILE_DEFS[kind].collectionSize,
    strategies: Object.fromEntries(
      [...new Set(results.map((result) => result.strategy))]
        .map((strategy) => [strategy, results.filter((result) => result.strategy === strategy).length]),
    ),
    runs: results.length,
    anchorBreakdown: Object.fromEntries(
      Object.entries(anchorGroups)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([anchor, rows]) => [
          anchor,
          {
            runs: rows.length,
            survival10: Number((rows.filter((result) => result.cleared >= 10).length / rows.length).toFixed(3)),
            survival15: Number((rows.filter((result) => result.cleared >= 15).length / rows.length).toFixed(3)),
            clearedP50: Number(percentile(rows.map((result) => result.cleared), 0.5).toFixed(1)),
            peakP50: Math.round(percentile(rows.map((result) => result.maxPulse), 0.5)),
            peakP90: Math.round(percentile(rows.map((result) => result.maxPulse), 0.9)),
            peakMax: Math.max(...rows.map((result) => result.maxPulse)),
          },
        ]),
    ),
    completionRate: Number((completed.length / results.length).toFixed(3)),
    survival: Object.fromEntries([1, 5, 10, 15, 20].map((shift) => [
      shift,
      Number(checkpoint(shift).toFixed(3)),
    ])),
    cleared: {
      p10: Number(percentile(results.map((result) => result.cleared), 0.1).toFixed(1)),
      p50: Number(percentile(results.map((result) => result.cleared), 0.5).toFixed(1)),
      p90: Number(percentile(results.map((result) => result.cleared), 0.9).toFixed(1)),
    },
    peak: {
      p50: Math.round(percentile(results.map((result) => result.maxPulse), 0.5)),
      p90: Math.round(percentile(results.map((result) => result.maxPulse), 0.9)),
      p99: Math.round(percentile(results.map((result) => result.maxPulse), 0.99)),
      max: Math.max(...results.map((result) => result.maxPulse)),
    },
    multiplierPools: Object.fromEntries(
      ["individual", "team", "network", "status", "rhythm"].map((key) => [
        key,
        {
          p50: Number(percentile(results.map((result) => result.poolAverages[key]), 0.5).toFixed(3)),
          p90: Number(percentile(results.map((result) => result.poolAverages[key]), 0.9).toFixed(3)),
        },
      ]),
    ),
    peakShape: Object.fromEntries(
      ["chips", "desks", "absorbed", "extras", "individual", "team", "network", "status", "rhythm"]
        .map((key) => [
          key,
          {
            p50: Number(percentile(peakRows.map((row) => row[key]), 0.5).toFixed(3)),
            p90: Number(percentile(peakRows.map((row) => row[key]), 0.9).toFixed(3)),
          },
        ]),
    ),
    completedOnly: {
      medianRevenue: Math.round(percentile(completed.map((result) => result.revenue), 0.5)),
      medianCash: Math.round(percentile(completed.map((result) => result.cash), 0.5)),
      medianMaxPulse: Math.round(percentile(completed.map((result) => result.maxPulse), 0.5)),
    },
    behavior: {
      medianHires: Number(percentile(results.map((result) => result.hires), 0.5).toFixed(1)),
      medianThrows: Number(percentile(results.map((result) => result.throws), 0.5).toFixed(1)),
      medianErrors: Number(percentile(results.map((result) => result.errors), 0.5).toFixed(1)),
      medianStrikes: Number(percentile(results.map((result) => result.strikes), 0.5).toFixed(1)),
      medianSkips: Number(percentile(results.map((result) => result.skips), 0.5).toFixed(1)),
    },
    failureReasons: Object.fromEntries(
      [...new Set(results.filter((result) => !result.completed).map((result) => result.reason))]
        .map((reason) => [reason, results.filter((result) => result.reason === reason).length]),
    ),
    cards: aggregateCards(results),
  };
}

function main() {
  const resultsByKind = {};
  for (const kind of Object.keys(PROFILE_DEFS)) {
    resultsByKind[kind] = Array.from({ length: RUNS }, (_, index) =>
      simulate(kind, (RUN_SEED ^ Math.imul(index + 1, 0x9e37_79b1) ^ kind.length * 0x45d9f3b) >>> 0));
  }
  const report = {
    model: {
      kind: ALTERNATE_STRATEGY
        ? "behavioral Monte Carlo with exact additive-pool pulse formula and alternate human placement policies"
        : "behavioral Monte Carlo with exact config/shop/pulse and abstracted Matter placement",
      strategySet: ALTERNATE_STRATEGY
        ? {
          newcomer: "habitual columns, visible score and same-name follow-up",
          regular: "safe same-name towers and stable multi-desk coverage",
          expert: "balance individual/team/network/status soft-cap pools with deliberate bridges",
        }
        : "current-pulse greedy with profile noise",
      runsPerProfile: RUNS,
      seed: `0x${RUN_SEED.toString(16)}`,
      balanceProfile: BALANCE_PROFILE,
      foundationGuarantee: FOUNDATION_GUARANTEE,
      monoDeskProtection: MONO_DESK_PROTECTION,
      activeDeskFloor: ACTIVE_DESK_FLOOR,
      totalShifts: G.TOTAL_SHIFTS,
      calibration: ALTERNATE_STRATEGY
        ? "Uses the same miss/wind/inspection calibration as the visual run, but replaces placement, hiring and shop policies."
        : {
          profile: "regular",
          hired: 8,
          throws: 8,
          clearScore: 76,
          kpi: 80,
          result: "shift-1 bankruptcy",
        },
    },
    profiles: Object.fromEntries(
      Object.entries(resultsByKind).map(([kind, results]) => [kind, summarize(kind, results)]),
    ),
  };

  let output;
  if (SUMMARY_ONLY) {
    const compactProfiles = Object.fromEntries(Object.entries(report.profiles).map(([kind, profile]) => {
      const { cards, ...summary } = profile;
      const cardRows = Object.entries(cards).map(([id, row]) => ({ id, ...row }));
      return [kind, {
        ...summary,
        cardHighlights: {
          mostBought: cardRows.slice().sort((left, right) => right.bought - left.bought).slice(0, 10),
          strongestDirect: cardRows
            .filter((row) => row.bought >= Math.max(2, RUNS * 0.01))
            .sort((left, right) => right.directPerBuy - left.directPerBuy)
            .slice(0, 10),
          ignored: cardRows
            .filter((row) => row.offered >= RUNS * 0.5)
            .sort((left, right) => left.takeRate - right.takeRate || right.offered - left.offered)
            .slice(0, 10),
        },
      }];
    }));
    output = { model: report.model, profiles: compactProfiles };
  } else {
    output = report;
  }
  const serialized = JSON.stringify(output, null, 2);
  const outIndex = process.argv.indexOf("--out");
  if (outIndex >= 0 && process.argv[outIndex + 1]) {
    writeFileSync(process.argv[outIndex + 1], serialized);
  } else {
    console.log(serialized);
  }
}

const isMain = process.argv[1] != null
  && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();
if (isMain) main();
