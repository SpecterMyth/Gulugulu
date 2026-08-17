import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { buildSync } from "esbuild";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const entrySource = `
export { RogueRun } from "./src/game/factory/rogueRun";
export { buildSpeciesMeta } from "./src/game/factory/rogueSpecies";
export { buildPulseAdjacency, computePulse, pulseSpotlightUids, pulseTeamUids } from "./src/game/factory/roguePulse";
export {
  absorbSet,
  bodiesSupportedByDesks,
  buildAdjacency,
  extendAdjacency,
  deskSwapMoves,
  deskPaths,
  mismatchedDeskPathUids,
} from "./src/game/factory/rogueGraph";
export { buildOffer, cardPrice, dimPool, meetsCardPrerequisites } from "./src/game/factory/rogueShop";
export * as CFG from "./src/game/factory/rogueConfig";
export { FACTORY_ROGUE } from "./src/i18n/factoryRogue";
export { projectFactoryDropGuide } from "./src/game/factory/dropGuide";
export { settlementIncomeFlows } from "./src/game/factory/rogueTypes";
`;
const { outputFiles } = buildSync({
  stdin: { contents: entrySource, resolveDir: appDir, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  loader: { ".json": "json", ".ts": "ts", ".tsx": "tsx" },
  logLevel: "silent",
});
const bundlePath = join(appDir, "node_modules", ".cache", "factory-rogue-check.bundle.mjs");
mkdirSync(dirname(bundlePath), { recursive: true });
writeFileSync(bundlePath, outputFiles[0].text);
const M = await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);

let checks = 0;
let failures = 0;
const ok = (value, message) => {
  checks++;
  if (!value) {
    failures++;
    console.error(`  ✗ ${message}`);
  }
};
const eq = (actual, expected, message) =>
  ok(JSON.stringify(actual) === JSON.stringify(expected), `${message}（期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}）`);

console.log("== 首班落点指示跟随真实水平出手速度");
const guideDesks = [{ element: "fire", x: 380, w: 200, top: 800 }];
const guideBase = {
  planeSpeed: 400,
  startFeetY: 200,
  groundY: 1000,
  gravity: 2500,
  sceneWidth: 1000,
  elements: ["fire"],
  desks: guideDesks,
};
const guideRight = M.projectFactoryDropGuide({ ...guideBase, planeX: 300, planeDir: 1 });
ok(guideRight.ready && guideRight.x > 400, "向右巡航时落点圈预留水平惯性并在桌面内变绿");
const guideLeft = M.projectFactoryDropGuide({ ...guideBase, planeX: 650, planeDir: -1 });
ok(guideLeft.ready && guideLeft.x < 550, "向左巡航时落点圈反向预留水平惯性");
const guideWait = M.projectFactoryDropGuide({ ...guideBase, planeX: 100, planeDir: 1 });
ok(!guideWait.ready && guideWait.element === "fire", "未进入匹配桌面的保守区时保持等待态");
const guideFallback = M.projectFactoryDropGuide({
  ...guideBase,
  elements: ["water"],
  planeX: 990,
  planeDir: 1,
});
ok(!guideFallback.ready && guideFallback.element == null && guideFallback.x <= 982, "没有可用元素桌时回退到屏内地面落点");

const metas = Object.fromEntries(
  [1, 2, 3, 4, 5, 6].map((tier) => {
    const species = `tier${tier}`;
    const elements = M.CFG.ROGUE_ELEMENTS?.slice?.(0, tier) ?? ["fire", "water", "grass", "electric", "ice", "normal"].slice(0, tier);
    return [species, {
      species,
      elements,
      tierCount: tier,
      groupNo: 1,
      reach: 2,
      baseValue: M.CFG.BASE_VALUE_BY_TIER[tier],
    }];
  }),
);

const body = (uid, x, y, elements = ["fire"]) => ({
  uid,
  species: `body${uid}`,
  x,
  y,
  r: 10,
  settled: true,
  elements,
});

console.log("== 连接链按无向最短距离取最近角色");
const wideConnectionBodies = [body(101, 0, 0), body(102, 29, 0)];
ok(
  M.buildAdjacency(wideConnectionBodies).get(101)?.includes(102),
  "连通判定使用 1.5 倍半径跨过小缝",
);
ok(
  !M.buildAdjacency(wideConnectionBodies, { slack: 1.3 }).get(101)?.includes(102),
  "原来的 1.3 倍半径不会跨过同一条缝",
);
ok(
  !M.buildAdjacency(wideConnectionBodies, { slack: 1.08 }).get(101)?.includes(102),
  "物理粘合范围仍保持原来的 1.08 倍",
);
const rowBodies = [
  body(1, 0, 0),
  body(2, 20, 0),
  body(3, 40, 0),
  body(4, 40, 20),
  body(5, 60, 20),
  body(6, 60, 40),
  body(7, 0, -20),
];
const rowAdj = M.buildAdjacency(rowBodies, { slack: 1.01 });
eq(M.absorbSet(rowBodies, rowAdj, 1, 0), [], "连接数为零时不吸取其他角色");
eq(M.absorbSet(rowBodies, rowAdj, 1, 1), [2], "只吸取最近的一只角色");
eq(M.absorbSet(rowBodies, rowAdj, 1, 3), [2, 7, 3], "同距离按邻接顺序取满最近数量");
ok(M.absorbSet(rowBodies, rowAdj, 1, 6).includes(7), "连接链允许向上连通");
const adjacencyEntries = (adj) => [...adj.entries()]
  .map(([uid, links]) => [uid, [...links].sort((a, b) => a - b)])
  .sort((a, b) => a[0] - b[0]);
const incrementalCandidate = body(99, 0, 100, ["fire"]);
eq(
  adjacencyEntries(M.extendAdjacency(rowAdj, rowBodies, incrementalCandidate, { slack: 1.01 })),
  adjacencyEntries(M.buildAdjacency([...rowBodies, incrementalCandidate], { slack: 1.01 })),
  "增量接入候选点与全量重建邻接图完全等价",
);
const inheritedState = (uid) => uid === 1 ? { uid, absorbedLinks: [6] } : undefined;
const inheritedAdj = M.buildPulseAdjacency(rowBodies, inheritedState);
ok(
  inheritedAdj.get(1)?.includes(6) && inheritedAdj.get(6)?.includes(1),
  "复用的计分邻接图保留吸收继承连接",
);
eq(
  M.computePulse({
    uid: 1,
    bodies: rowBodies,
    desks: [],
    meta: { body1: { species: "body1", elements: ["fire"], tierCount: 1, groupNo: 1, reach: 2, baseValue: 10 } },
    effBase: () => 10,
    cards: { "fire.chain": 2 },
    comboStacks: 0,
  }).absorbUids.length,
  5,
  "火系连通链 Lv.2 会让实际脉冲多吸取 3 只角色",
);

const rowDesks = [{ element: "fire", x: 50, w: 20, top: 50 }];
eq(M.deskPaths(rowBodies, rowAdj, rowDesks, 1).fire, [1, 2, 3, 4, 5, 6], "接桌通路支持逐层横向展开");
eq(
  M.computePulse({
    uid: 1,
    bodies: rowBodies,
    desks: rowDesks,
    meta: { body1: { species: "body1", elements: ["fire"], tierCount: 1, groupNo: 1, reach: 2, baseValue: 10 } },
    effBase: () => 10,
    cards: {},
    comboStacks: 0,
  }).total,
  30,
  "被传导的两只咕噜各贡献 100% 有效基础分",
);

const upwardBodies = [
  body(11, 0, 40),
  body(12, 0, 20),
  body(13, 0, 0),
];
const upwardAdj = M.buildAdjacency(upwardBodies, { slack: 1.01 });
const upwardDesks = [{ element: "fire", x: -10, w: 20, top: 10 }];
eq(M.deskPaths(upwardBodies, upwardAdj, upwardDesks, 11).fire, [11, 12, 13], "接桌最短通路允许向上连接");

const mixedRouteBodies = [
  body(14, 0, 40, ["fire", "electric"]),
  body(15, 0, 20, ["electric", "grass"]),
  body(16, 0, 0, ["grass"]),
];
const mixedRouteAdj = M.buildAdjacency(mixedRouteBodies, { slack: 1.01 });
const mixedRouteDesks = [{ element: "fire", x: -10, w: 20, top: 10 }];
eq(
  M.deskPaths(mixedRouteBodies, mixedRouteAdj, mixedRouteDesks, 14).fire,
  [14, 15, 16],
  "投放者可在目标桌计分时，中间节点和桌基节点不受目标桌属性限制",
);
eq(
  M.deskPaths(
    [{ ...mixedRouteBodies[0], elements: ["water", "electric"] }, ...mixedRouteBodies.slice(1)],
    mixedRouteAdj,
    mixedRouteDesks,
    14,
  ).fire,
  undefined,
  "投放者本身不能在目标属性桌计分时，物理连通也不触发该桌",
);

const relayBodies = [
  body(31, 0, 0, ["fire"]),
  body(32, 20, 0, ["normal"]),
  body(33, 40, 0, ["fire"]),
];
const relayAdj = M.buildAdjacency(relayBodies, { slack: 1.01, stickOverride: () => true });
const relayDesks = [{ element: "fire", x: -10, w: 20, top: 10 }];
eq(
  [...M.mismatchedDeskPathUids(relayBodies, relayAdj, relayDesks, {
    relayAllowed: (candidate, element) => candidate.elements.includes("normal") && element === "fire",
  })],
  [32],
  "异属性中继接入桌通路后会被识别为睡眠节点",
);
eq(
  [...M.mismatchedDeskPathUids(relayBodies, relayAdj, relayDesks)],
  [],
  "没有中继许可时异属性节点不属于桌通路",
);
const dualDeskRelayBodies = [
  body(34, 0, 0, ["fire"]),
  body(35, 20, 0, ["normal"]),
  body(36, 40, 0, ["normal"]),
];
const dualDeskRelayAdj = M.buildAdjacency(dualDeskRelayBodies, {
  slack: 1.01,
  stickOverride: () => true,
});
eq(
  [...M.mismatchedDeskPathUids(
    dualDeskRelayBodies,
    dualDeskRelayAdj,
    [
      { element: "fire", x: -10, w: 20, top: 10 },
      { element: "normal", x: 30, w: 20, top: 10 },
    ],
    {
      relayAllowed: (candidate, element) =>
        candidate.elements.includes("normal") && element === "fire",
    },
  )],
  [],
  "同时接通自身属性桌的中继仍在工作，不应被异属性桌全局切成睡眠态",
);

const dualElectric = body(20, 0, 0, ["electric", "water"]);
dualElectric.species = "dualElectric";
const parallelCtx = {
  uid: 20,
  bodies: [dualElectric],
  desks: [
    { element: "electric", x: -10, w: 20, top: 10 },
    { element: "water", x: -10, w: 20, top: 10 },
  ],
  meta: {
    dualElectric: {
      species: "dualElectric",
      elements: ["electric", "water"],
      tierCount: 2,
      groupNo: 1,
      reach: 2,
      baseValue: 12,
    },
  },
  effBase: () => 12,
  comboStacks: 0,
};
eq(M.computePulse({ ...parallelCtx, cards: {} }).total, 24, "双桌电系基础脉冲为两份");
const maxRhythmPulse = M.computePulse({ ...parallelCtx, cards: {}, comboStacks: 20 });
eq(maxRhythmPulse.rhythmMult, 5, "20 层连击使节奏池达到 5×");
eq(
  M.computePulse({ ...parallelCtx, cards: {}, comboStacks: 99 }).rhythmMult,
  5,
  "节奏池在 5× 硬封顶",
);
const parallelPulse = M.computePulse({ ...parallelCtx, cards: { "electric.parallel": 1 } });
eq(parallelPulse.total, 36, "并联回路 Lv.1 按每张额外桌 +50% 后执行两桌计分");
const cappedPulse = M.computePulse({
  ...parallelCtx,
  effBase: () => M.CFG.FACTORY_VALUE_CAP,
  cards: {},
});
eq(cappedPulse.total, M.CFG.FACTORY_VALUE_CAP, "极端基础值脉冲饱和而不生成 Infinity");
ok(
  cappedPulse.contributors.every((item) => Number.isSafeInteger(item.amount)),
  "封顶脉冲的贡献拆分仍全部是安全整数",
);
ok(
  parallelPulse.total % parallelPulse.deskCount === 0,
  "多桌连通的总业绩是单次计分的桌数整倍数",
);
eq(
  parallelPulse.triggers.find((trigger) => trigger.kind === "parallel")?.value,
  2,
  "分流直接显示本次连通到的真实桌数",
);
const tripleDeskPulse = M.computePulse({
  ...parallelCtx,
  bodies: [{ ...dualElectric, elements: ["fire", "electric", "water"] }],
  desks: [
    { element: "fire", x: -10, w: 20, top: 10 },
    { element: "electric", x: -10, w: 20, top: 10 },
    { element: "water", x: -10, w: 20, top: 10 },
  ],
  cards: {},
});
eq(tripleDeskPulse.deskCount, 3, "三桌脉冲保留真实物理桌数");
eq(tripleDeskPulse.deskScoreMult, 4, "三桌按四次计分");
eq(tripleDeskPulse.total, 48, "三桌基础业绩按 4 次结算");

console.log("== 六系核心打法与连携触发");
const fireCore = M.computePulse({
  ...parallelCtx,
  bodies: [
    { ...dualElectric, elements: ["fire", "electric", "water"] },
    { ...body(21, 500, 500, ["fire"]), species: "remoteFire" },
  ],
  cards: { "fire.burst": 5 },
});
eq(fireCore.total, 24, "爆燃不再挤占主脉冲乘区");
eq(
  fireCore.extras.filter((extra) => extra.kind === "fireBurst").length,
  15,
  "爆燃 Lv.5 把投放者打工业绩额外结算 15 次",
);
ok(fireCore.triggers.some((trigger) => trigger.kind === "ignite"), "火系爆燃写入点燃演出触发");
const fireBaseOnlyBurst = M.computePulse({
  ...parallelCtx,
  bodies: [{ ...dualElectric, elements: ["fire", "electric", "water"] }],
  cards: { "fire.burst": 1, "attr.dual": 5 },
});
eq(
  fireBaseOnlyBurst.extras.find((extra) => extra.kind === "fireBurst")?.amount,
  Math.round(
    12
      * fireBaseOnlyBurst.elementMult
      * fireBaseOnlyBurst.synergyCardMult
      * fireBaseOnlyBurst.jobMult
      * fireBaseOnlyBurst.rhythmMult,
  ) * fireBaseOnlyBurst.deskScoreMult,
  "爆燃结算投放者自身的全 BUFF 分数，并保留接桌计次",
);
const fireSpread = M.computePulse({
  uid: 1,
  bodies: rowBodies,
  desks: rowDesks,
  meta: { body1: { species: "body1", elements: ["fire"], tierCount: 1, groupNo: 1, reach: 2, baseValue: 10 } },
  effBase: () => 10,
  cards: { "fire.burst": 1, "fire.wildfire": 3 },
  comboStacks: 0,
});
eq(
  fireSpread.extras.filter((extra) => extra.kind === "wildfire").map((extra) => extra.uid),
  [2, 7, 3, 4, 5, 6],
  "燎原按邻接广度顺序逐只传火并受等级上限约束",
);
eq(
  fireSpread.extras.find((extra) => extra.kind === "wildfire")?.amount,
  Math.round(
    10
      * fireSpread.elementMult
      * fireSpread.synergyCardMult
      * fireSpread.jobMult
      * fireSpread.rhythmMult,
  ) * fireSpread.deskScoreMult,
  "燎原结算被传火单位自身的全 BUFF 分数，并保留接桌计次",
);

const sameWaterA = body(30, 0, 0, ["water"]);
const sameWaterB = body(31, 20, 0, ["water"]);
const sameWaterC = body(32, 500, 500, ["water"]);
sameWaterA.species = "sameWater";
sameWaterB.species = "sameWater";
sameWaterC.species = "sameWater";
const waterCtx = {
  uid: 30,
  bodies: [sameWaterA, sameWaterB, sameWaterC],
  desks: [{ element: "water", x: 10, w: 20, top: 10 }],
  meta: {},
  effBase: () => 15,
  comboStacks: 0,
};
const waterPlain = M.computePulse({ ...waterCtx, cards: {} });
const waterTide = M.computePulse({ ...waterCtx, cards: { "water.same": 3 } });
ok(waterTide.total > waterPlain.total, "水系同名潮阶随同名压榨放大业绩");
ok(waterTide.triggers.some((trigger) => trigger.kind === "sameName"), "水系同名潮阶写入演出触发");
eq(
  waterTide.triggers.find((trigger) => trigger.kind === "sameName")?.value,
  2,
  "同名增压只统计本次投放者与被压榨成员，排除未连通单位",
);
const additiveTeamPool = M.computePulse({
  ...waterCtx,
  bodies: [
    { ...sameWaterA, elements: ["water", "ice"] },
    { ...sameWaterB, elements: ["water", "ice"] },
  ],
  cards: { "water.same": 1, "ice.overstaff": 1 },
  stateOf: (uid) => uid === 31 ? { uid, frozen: true } : undefined,
});
ok(
  Math.abs(additiveTeamPool.elementMult - 1.41) < 1e-9,
  "同名增压先按同名数指数叠加，再与超额编制在元素卡池相加",
);
const sameCapBodies = Array.from({ length: 12 }, (_, index) => {
  const member = body(330 + index, 0, 220 - index * 20, ["water"]);
  member.species = "sameCap";
  return member;
});
const sameCapPulse = M.computePulse({
  uid: 330,
  bodies: sameCapBodies,
  desks: [{ element: "water", x: -10, w: 20, top: 10 }],
  meta: {
    sameCap: {
      species: "sameCap",
      elements: ["water"],
      tierCount: 1,
      groupNo: 1,
      reach: 20,
      baseValue: 15,
    },
  },
  effBase: () => 15,
  cards: { "water.same": 1 },
  comboStacks: 0,
});
ok(Math.abs(sameCapPulse.elementMult - Math.pow(1.1, 10)) < 1e-9, "同名增压最多取 10 只并保持指数叠加");

const iceCore = M.computePulse({
  ...waterCtx,
  bodies: [
    { ...sameWaterA, elements: ["ice"], species: "iceCore" },
    { ...sameWaterB, elements: ["ice"], species: "iceMate" },
  ],
  desks: [{ element: "ice", x: 10, w: 20, top: 10 }],
  cards: { "ice.overstaff": 3 },
  stateOf: (uid) => uid === 31 ? { uid, frozen: true } : undefined,
});
ok(iceCore.skillMult > 1 && iceCore.triggers.some((trigger) => trigger.kind === "overstaff"), "冰系冻结人口计入超额编制乘区");

const grassBodies = Array.from({ length: 5 }, (_, index) => {
  const grass = body(40 + index, 0, 80 - index * 20, ["grass"]);
  grass.species = `grass${index}`;
  return grass;
});
const grassCore = M.computePulse({
  uid: 40,
  bodies: grassBodies,
  desks: [{ element: "grass", x: -10, w: 20, top: 10 }],
  meta: {},
  effBase: () => 15,
  cards: { "grass.crowd": 2, "grass.height": 2 },
  comboStacks: 0,
});
ok(grassCore.skillMult > 1, "草系连通数量与总层高共同进入成长乘区");
ok(grassCore.triggers.some((trigger) => trigger.kind === "lush") && grassCore.triggers.some((trigger) => trigger.kind === "height"), "草系繁茂与冠层分别写入演出触发");
eq(
  grassCore.triggers.find((trigger) => trigger.kind === "lush")?.value,
  5,
  "繁茂直接显示与计分咕噜连成一片的真实数量",
);

const electricHead = body(50, 0, 40, ["electric"]);
const normalRelay = body(51, 0, 20, ["normal"]);
const electricBase = body(52, 0, 0, ["electric"]);
electricHead.species = "electricHead";
normalRelay.species = "normalRelay";
electricBase.species = "electricBase";
const lightningrod = M.computePulse({
  uid: 50,
  bodies: [electricHead, normalRelay, electricBase],
  desks: [{ element: "electric", x: -10, w: 20, top: 10 }],
  meta: {},
  effBase: () => 15,
  cards: { "syn.lightningrod": 1 },
  comboStacks: 0,
  stateOf: (uid) => uid === 51 ? { uid, sizeLevel: 2 } : undefined,
});
ok(lightningrod.deskCount === 1 && lightningrod.synergyMult > 1, "蓄能胃袋让一般系中继电路并按体型放大");
ok(lightningrod.triggers.some((trigger) => trigger.kind === "lightningrod"), "避雷针连携写入专属演出触发");
const gluttonyPlain = M.computePulse({
  uid: 51,
  bodies: [normalRelay],
  desks: [{ element: "normal", x: -10, w: 20, top: 30 }],
  meta: { normalRelay: { species: "normalRelay", elements: ["normal"], tierCount: 1, groupNo: 1, reach: 2, baseValue: 15 } },
  effBase: () => 15,
  cards: {},
  comboStacks: 0,
  stateOf: () => ({ uid: 51, sizeLevel: 4 }),
});
const gluttonyBoosted = M.computePulse({
  uid: 51,
  bodies: [normalRelay],
  desks: [{ element: "normal", x: -10, w: 20, top: 30 }],
  meta: { normalRelay: { species: "normalRelay", elements: ["normal"], tierCount: 1, groupNo: 1, reach: 2, baseValue: 15 } },
  effBase: () => 15,
  cards: { "normal.gluttony": 3 },
  comboStacks: 0,
  stateOf: () => ({ uid: 51, sizeLevel: 4 }),
});
ok(gluttonyBoosted.total > gluttonyPlain.total, "暴食按一般咕噜体型等级放大压榨业绩");

const frostrootIceA = body(53, 0, 0, ["ice"]);
const frostrootGrass = body(54, 20, 0, ["grass"]);
const frostrootIceB = body(55, 40, 0, ["ice"]);
const frostrootCtx = {
  uid: 53,
  bodies: [frostrootIceA, frostrootGrass, frostrootIceB],
  desks: [{ element: "ice", x: 30, w: 20, top: 10 }],
  meta: {},
  effBase: () => 15,
  cards: { "syn.permafrost": 1 },
  comboStacks: 0,
};
const frostroot = M.computePulse(frostrootCtx);
const frostrootStickRun = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 53,
});
frostrootStickRun.debugGrantCard("syn.permafrost", 1);
ok(
  frostrootStickRun.stickOverride(frostrootIceA, frostrootGrass) === true,
  "霜根网络同步改写场景物理粘连规则",
);
eq(
  M.computePulse({ ...frostrootCtx, cards: {} }).deskCount,
  0,
  "没有霜根网络时纯冰与纯草不能互相粘连接桌",
);
eq(frostroot.deskCount, 1, "霜根网络允许纯冰与纯草互相粘连接桌");
ok(
  Math.abs(frostroot.synergyCardMult - 1.5) < 1e-9,
  "史诗霜根网络按两条冰草相邻边加入连携卡池",
);
eq(
  frostroot.triggers.find((trigger) => trigger.kind === "permafrost")?.value,
  2,
  "霜根网络演出显示实际计入的冰草相邻边数",
);
const frostrootRemoteBodies = [
  body(570, 0, 0, ["ice"]),
  body(571, 20, 0, ["grass"]),
  body(572, 40, 0, ["ice"]),
  body(573, 60, 0, ["grass"]),
];
const frostrootTeamScoped = M.computePulse({
  uid: 570,
  bodies: frostrootRemoteBodies,
  desks: [{ element: "ice", x: -10, w: 20, top: 10 }],
  meta: {
    body570: {
      species: "body570",
      elements: ["ice"],
      tierCount: 1,
      groupNo: 1,
      reach: 1,
      baseValue: 15,
    },
  },
  effBase: () => 15,
  cards: { "syn.permafrost": 1 },
  comboStacks: 0,
});
eq(frostrootTeamScoped.absorbUids, [571], "霜根网络测试场景只压榨最近一只咕噜");
ok(
  Math.abs(frostrootTeamScoped.synergyCardMult - 1.25) < 1e-9,
  "未满级霜根网络不计算实际团队之外的远端冰草边",
);
eq(
  frostrootTeamScoped.triggers.find((trigger) => trigger.kind === "permafrost")?.targetUids,
  [570, 571],
  "霜根网络演出目标只包含实际计分边的团队成员",
);
eq(
  M.pulseSpotlightUids({
    uid: 570,
    absorbUids: [571],
    extras: [{ kind: "wildfire", uid: 592, amount: 15 }],
    triggers: [
      {
        kind: "lush",
        sourceUid: 570,
        targetUids: [570, 571, 572, 573, 574, 575, 576],
      },
      { kind: "convert", sourceUid: 570, targetUids: [590] },
      { kind: "grow", sourceUid: 591 },
    ],
  }).sort((left, right) => left - right),
  [570, 571, 572, 573, 574, 590, 591, 592],
  "聚光包含团队、状态/生长和额外计分目标，但排除未实际播放演出的整网目标",
);
const frostrootWithStates = M.computePulse({
  ...frostrootCtx,
  stateOf: (uid) => uid === 54 ? { uid, frozen: true, generated: true } : undefined,
});
eq(
  frostrootWithStates.synergyMult,
  frostroot.synergyMult,
  "霜根网络完全不读取冻结或生长状态",
);
const frostrootNoCrossEdge = M.computePulse({
  ...frostrootCtx,
  bodies: [
    { ...frostrootIceA, elements: ["ice"] },
    { ...frostrootGrass, elements: ["ice"] },
    { ...frostrootIceB, elements: ["ice"] },
  ],
});
eq(frostrootNoCrossEdge.synergyMult, 1, "没有冰草交叉相邻边时霜根网络不提供加成");
const frostrootCapBodies = Array.from({ length: 8 }, (_, index) =>
  body(560 + index, index * 20, 0, [index % 2 === 0 ? "ice" : "grass"]));
const frostrootCapped = M.computePulse({
  uid: 560,
  bodies: frostrootCapBodies,
  desks: [{ element: "ice", x: 130, w: 20, top: 10 }],
  meta: {
    body560: {
      species: "body560",
      elements: ["ice"],
      tierCount: 1,
      groupNo: 7,
      reach: 7,
      baseValue: 15,
    },
  },
  effBase: () => 15,
  cards: { "syn.permafrost": 5 },
  comboStacks: 0,
});
ok(
  Math.abs(
    frostrootCapped.synergyCardMult
      - (1 + (frostrootCapped.triggers.find((trigger) => trigger.kind === "permafrost")?.value ?? 0)
        * M.CFG.CARD_PARAMS["syn.permafrost"].perCrossEdge[4]),
  ) < 1e-9,
  "霜根网络满级计算整片粘连区域，连携卡池不做软上限压缩",
);

console.log("== 元素系列只响应本元素投放");
eq(
  M.CFG.cardsForElementPlacement(
    ["water"],
    { "fire.burst": 1, "base.fire": 2, "water.same": 1, "syn.short": 1 },
  ),
  { "fire.burst": 0, "base.fire": 0, "water.same": 1, "syn.short": 1 },
  "水系投放会屏蔽火系元素卡，但保留水系卡与两系连携",
);
const firePlacement = body(60, 0, 40, ["fire"]);
const normalMiddle = body(61, 0, 20, ["normal"]);
const fireBase = body(62, 0, 0, ["fire"]);
const offElementTags = M.computePulse({
  uid: 60,
  bodies: [firePlacement, normalMiddle, fireBase],
  desks: [{ element: "fire", x: -10, w: 20, top: 10 }],
  meta: {},
  effBase: () => 15,
  cards: { "normal.tags": 1 },
  comboStacks: 0,
});
eq(offElementTags.deskCount, 0, "属性放宽不会为完全无法粘连的咕噜凭空创建连接边");

console.log("== 基础值与六工种累计价格");
eq(M.CFG.CARD_DEFS.length, 58, "加入补招聘后商店完整卡池共 58 张");
eq(new Set(M.CFG.CARD_DEFS.map((card) => card.id)).size, 58, "商店卡 id 无重复");
ok(
  M.CFG.CARD_DEFS.every((card) => M.CFG.CARD_PARAMS[card.id] != null),
  "每张在售商店卡都有权威数值参数",
);
const allCardIds = new Set(M.CFG.CARD_DEFS.map((card) => card.id));
ok(
  M.CFG.CARD_DEFS.every((card) => (card.requires ?? []).every((id) => allCardIds.has(id))),
  "每张卡的前置都指向仍在售的有效卡牌",
);
ok(
  M.CFG.CARD_DEFS.every((card) => !(card.requires ?? []).includes(card.id)),
  "卡牌不会把自己设为前置",
);
{
  const visiting = new Set();
  const visited = new Set();
  const byId = new Map(M.CFG.CARD_DEFS.map((card) => [card.id, card]));
  let acyclic = true;
  const visit = (id) => {
    if (visiting.has(id)) {
      acyclic = false;
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const requiredId of byId.get(id)?.requires ?? []) visit(requiredId);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of allCardIds) visit(id);
  ok(acyclic && visited.size === allCardIds.size, "完整卡牌前置图无环且所有卡牌可达");
}
ok(
  M.CFG.CARD_DEFS
    .filter((card) => card.dim === 3)
    .every((card) => card.requires?.length === 2),
  "十五张两系连携各自拥有两个机制前置",
);
eq(
  Array.from({ length: 20 }, (_, i) => M.CFG.kpiForShift(i + 1)),
  [80, 179, 400, 894, 2000, 3170, 5024, 7962, 12619, 20000, 37693, 71040, 133887, 252332, 475563, 896281, 1689195, 3183578, 6000000, 20000000],
  "1~20 班 KPI 完整曲线",
);
eq(M.CFG.kpiForShift(1), 80, "第 1 班 KPI 保持 80");
eq(M.CFG.kpiForShift(5), 2_000, "第 5 班 KPI 调整为 2000");
eq(M.CFG.kpiForShift(10), 20_000, "第 10 班 KPI 调整为 2 万");
eq(M.CFG.kpiForShift(19), 6_000_000, "第 19 班 KPI 锚定 600 万");
eq(M.CFG.kpiForShift(20), 20_000_000, "第 20 班 KPI 锚定 2000 万");
ok(M.CFG.kpiForShift(47) < M.CFG.FACTORY_KPI_CAP, "第 47 班 KPI 仍保留在长期经济上限以下");
eq(M.CFG.kpiForShift(48), M.CFG.FACTORY_KPI_CAP, "第 48 班 KPI 达到长期经济安全上限");
eq(M.CFG.kpiForShift(10_000), M.CFG.FACTORY_KPI_CAP, "万班无限局 KPI 仍是可序列化的安全整数");
eq(M.CFG.kpiForShift(Infinity), M.CFG.FACTORY_KPI_CAP, "非有限的正班次不会进入无限计算循环");
eq(M.CFG.factoryValueString(Infinity), String(M.CFG.FACTORY_VALUE_CAP), "非有限成绩提交前饱和为后端安全上限");
ok(
  Array.from({ length: 9 }, (_, i) => M.CFG.kpiForShift(i + 11) / M.CFG.kpiForShift(i + 10))
    .every((rate) => rate > 1.88 && rate < 1.89),
  "第 10~19 班 KPI 以约 ×1.885 平滑增长",
);
ok(
  Array.from({ length: 20 }, (_, i) => M.CFG.billForShift(i + 1, i === 19 ? "audit" : "none"))
    .every((bill, i) => bill === M.CFG.kpiForShift(i + 1)),
  "每一班账单与 KPI 完全相等",
);
ok(M.CFG.kpiForShift(20) / M.CFG.kpiForShift(1) > 2_000, "20 班 KPI 相对首班膨胀超过 2000 倍");
eq(M.CFG.KPI_BONUS_RATE, 0.3, "KPI 达标奖金率为 30%");
eq(M.CFG.kpiBonusFor(80), 24, "KPI 80 的绩效奖金按整数四舍五入为 24");
eq(M.CFG.CARD_PARAMS["fire.burst"].repeats, [1, 3, 6, 10, 15], "爆燃追加打工业绩次数为 1/3/6/10/15");
eq(M.CFG.CARD_PARAMS["fire.wildfire"].spread, [2, 4, 8, 16, 32], "燎原传导上限按翻倍成长");
eq(M.CFG.CARD_PARAMS["water.convert"].targets, [1, 2, 3, 5, 8], "水镜同化改为确定的目标数量");
const coreTriggerChance = [0.1, 0.2, 0.3, 0.4, 0.6];
eq(M.CFG.CARD_PARAMS["grass.grow"].chance, coreTriggerChance, "生长五档触发率为 10%/20%/30%/40%/60%");
eq(M.CFG.CARD_PARAMS["ice.freeze"].chance, coreTriggerChance, "冻结五档触发率为 10%/20%/30%/40%/60%");
eq(M.CFG.CARD_PARAMS["normal.absorb"].chance, coreTriggerChance, "吸收五档触发率为 10%/20%/30%/40%/60%");
eq(M.CFG.CARD_PARAMS["normal.absorb"].targets, [1, 1, 1, 2, 3], "吸收后两档确定吞掉 2/3 个目标");
eq(M.CFG.CARD_PARAMS["normal.emperor"].grow, [1, 2, 3, 5, 8], "打工皇帝只成长确定的体型数值");
eq(
  M.CFG.CARD_PARAMS["syn.arcIgnite"].perDesk,
  [0.5, 1, 3, 8, 20],
  "史诗电弧点火每张额外桌的增幅按单一数值成长",
);
eq(
  M.CFG.CARD_PARAMS["syn.greenhouse"].chance,
  [0.5, 0.7, 0.85, 1, 1],
  "温室从 Lv.1 起即提供明显的额外生长概率",
);
eq(
  {
    arcIgnite: M.CFG.CARD_PARAMS["syn.arcIgnite"].perDesk[0],
    thermalShock: M.CFG.CARD_PARAMS["syn.thermalShock"].echo[0],
    steamBurst: M.CFG.CARD_PARAMS["syn.steamBurst"].perSame[0],
    greenhouse: M.CFG.CARD_PARAMS["syn.greenhouse"].chance[0],
    fireDispatch: M.CFG.CARD_PARAMS["syn.fireDispatch"].perMass[0],
    superconduct: M.CFG.CARD_PARAMS["syn.superconduct"].perFrozen[0],
    short: M.CFG.CARD_PARAMS["syn.short"].burst[0],
    bionet: M.CFG.CARD_PARAMS["syn.bionet"].perGenerated[0],
    lightningrod: M.CFG.CARD_PARAMS["syn.lightningrod"].perMass[0],
    iceMirror: M.CFG.CARD_PARAMS["syn.iceMirror"].perFrozenSame[0],
    permafrost: M.CFG.CARD_PARAMS["syn.permafrost"].perCrossEdge[0],
    coldRotation: M.CFG.CARD_PARAMS["syn.coldRotation"].perMass[0],
    irrigation: M.CFG.CARD_PARAMS["syn.irrigation"].chanceMult[0],
    badge: M.CFG.CARD_PARAMS["syn.badge"].mult[0],
    multiSeed: M.CFG.CARD_PARAMS["syn.multiSeed"].inheritMass[0],
  },
  {
    arcIgnite: 0.5,
    thermalShock: 3,
    steamBurst: 1,
    greenhouse: 0.5,
    fireDispatch: 1,
    superconduct: 0.5,
    short: 3,
    bionet: 0.3,
    lightningrod: 0.5,
    iceMirror: 1,
    permafrost: 0.25,
    coldRotation: 0.5,
    irrigation: 2,
    badge: 2,
    multiSeed: 0.35,
  },
  "十五张双系连携的 Lv.1 强度全部达到史诗基线",
);
ok(
  M.CFG.CARD_DEFS.filter((card) => card.dim === 3).every((card) => card.rarity === "epic"),
  "十五张两系连携全部为史诗品质",
);
eq(
  {
    greenhouseCopies: M.CFG.CARD_PARAMS["syn.greenhouse"].growCopies[4],
    bionetWeight: M.CFG.CARD_PARAMS["syn.bionet"].generatedWeight[4],
    frostrootCap: M.CFG.CARD_PARAMS["syn.permafrost"].cap[4],
    irrigationCopies: M.CFG.CARD_PARAMS["syn.irrigation"].growCopies[4],
    offspringMass: M.CFG.CARD_PARAMS["syn.multiSeed"].inheritMass[4],
  },
  {
    greenhouseCopies: 2,
    bionetWeight: 2,
    frostrootCap: 99,
    irrigationCopies: 3,
    offspringMass: 1.5,
  },
  "草系连携保留原有 Lv.5 巅峰规则，非草连携不再增加第二套数值",
);
ok(
  M.CFG.CARD_PARAMS["fire.burst"].repeats[4] - M.CFG.CARD_PARAMS["fire.burst"].repeats[3]
    > M.CFG.CARD_PARAMS["fire.burst"].repeats[1] - M.CFG.CARD_PARAMS["fire.burst"].repeats[0],
  "爆燃后期升级增量大于前期",
);
eq(M.CFG.CARD_PARAMS["staff.expand"].quota, 5, "扩编每次只增加 5 个员工名额");
eq(M.CFG.CARD_PARAMS["staff.fire3"].picks, 3, "解雇一次最多选择 3 只");
eq(M.CFG.CARD_PARAMS["attr.balance"].mult, [5, 8, 12, 20, 28], "均衡红利保留六工种机制并调整成长");
eq(M.CFG.CARD_PARAMS["attr.hex"].perElement, [1, 2, 4, 6, 10, 20], "六边形津贴提供六级逐元素成长");
eq(M.CFG.CARD_PARAMS["staff.backfill"].extraCandidates.length, 10, "补招聘上限提升到 Lv.10");
eq(M.CFG.CARD_PARAMS["water.fourday"].line, [5, 7, 9, 12, 16], "工休罢工线提高为 5/7/9/12/16");
eq(M.CFG.baseTrainingBonus(["fire"], { "base.fire": 2 }), 5, "非草单元素基础培训按增强阶梯增加基础分");
eq(
  M.CFG.baseTrainingBonus(["fire", "ice"], { "base.fire": 2, "base.ice": 1 }),
  7,
  "多元素角色叠加多个元素培训",
);
eq(
  M.CFG.elementReachBonus(["fire", "water", "electric"], {
    "fire.chain": 1,
    "water.chain": 2,
    "electric.wire": 1,
  }),
  6,
  "连通链按元素叠加并读取各系独立成长表",
);
eq(M.CFG.CARD_PARAMS["normal.chain"].reachBonus, [1, 3, 6, 10, 15], "一般系压榨数成长表");
eq(M.CFG.CARD_PARAMS["electric.wire"].reachBonus, [2, 5, 9, 14, 20], "电系压榨数成长表");
eq(
  M.dimPool(1, { loadoutElements: ["fire", "water"], cardLevels: {}, activeLoan: false }).map((card) => card.id),
  [
    "fire.burst",
    "fire.chain",
    "base.fire",
    "water.fourday",
    "water.convert",
    "water.chain",
    "base.water",
  ],
  "首间商店只出现各元素的机制入口、连通链与基础培训",
);
eq(
  M.dimPool(1, {
    loadoutElements: ["fire", "water"],
    cardLevels: { "fire.burst": 1, "water.fourday": 1 },
    activeLoan: false,
  }).map((card) => card.id),
  [
    "fire.burst",
    "fire.ember",
    "fire.wildfire",
    "fire.chain",
    "base.fire",
    "water.fourday",
    "water.same",
    "water.convert",
    "water.chain",
    "base.water",
  ],
  "购买机制入口后只开放对应的中阶卡",
);
ok(
  !M.dimPool(1, {
    loadoutElements: ["fire"],
    cardLevels: { "fire.ember": 1 },
    activeLoan: false,
  }).some((card) => card.id === "fire.wildfire"),
  "燎原只以前置爆燃为准，单独拥有余烬不会解锁",
);
ok(
  M.dimPool(1, {
    loadoutElements: ["fire"],
    cardLevels: { "fire.burst": 1 },
    activeLoan: false,
  }).some((card) => card.id === "fire.wildfire"),
  "爆燃解锁后燎原立即进入候选池",
);
ok(
  !M.dimPool(1, {
    loadoutElements: ["ice"],
    cardLevels: {},
    activeLoan: false,
  }).some((card) => card.id === "ice.overstaff"),
  "尚未学习冻结时不会出现超额编制奖",
);
ok(
  M.dimPool(1, {
    loadoutElements: ["ice"],
    cardLevels: { "ice.freeze": 1 },
    activeLoan: false,
  }).some((card) => card.id === "ice.overstaff"),
  "学习冻结后才会开放超额编制奖",
);
eq(
  M.dimPool(3, {
    loadoutElements: ["fire", "ice"],
    cardLevels: { "fire.burst": 1 },
    activeLoan: false,
  }).map((card) => card.id),
  [],
  "只学习点燃、尚未学习冻结时不会出现热震等冻结连携",
);
eq(
  M.dimPool(3, {
    loadoutElements: ["fire", "ice"],
    cardLevels: { "fire.burst": 1, "ice.freeze": 1 },
    activeLoan: false,
  }).map((card) => card.id),
  ["syn.thermalShock"],
  "点燃与冻结两个前置都满足后才开放热震",
);
eq(
  M.dimPool(3, {
    loadoutElements: ["fire", "water", "grass", "electric", "ice", "normal"],
    cardLevels: Object.fromEntries(M.CFG.CARD_DEFS.map((card) => [card.id, 1])),
    activeLoan: false,
  }).length,
  15,
  "全部机制学会后十五张两系连携均可进入候选池",
);
ok(
  !M.dimPool(1, {
    loadoutElements: ["fire", "water"],
    cardLevels: { "base.fire": 5 },
    activeLoan: false,
  }).some((card) => card.id === "base.fire"),
  "满级元素培训会从后续元素商店移除",
);
const mixedSelectionIds = M.dimPool(5, {
  loadoutElements: ["fire", "water"],
  cardLevels: { "fire.burst": 1, "water.fourday": 1 },
  activeLoan: false,
}).map((card) => card.id);
ok(
  mixedSelectionIds.includes("base.fire")
    && mixedSelectionIds.includes("staff.expand")
    && mixedSelectionIds.includes("syn.steamBurst"),
  "第三栏综合精选同时包含当前合法的元素、属性经营与连携卡",
);
eq(
  M.buildOffer(() => 0.5, { loadoutElements: ["fire"], cardLevels: {}, activeLoan: false }).dims,
  [1, 2, 5],
  "新商店第三栏固定从综合精选池抽取",
);
const mergedPoolIds = M.dimPool(2, {
  loadoutElements: ["fire"],
  cardLevels: {},
  activeLoan: false,
}).map((card) => card.id);
ok(
  mergedPoolIds.includes("attr.pure") && mergedPoolIds.includes("staff.talentmarket"),
  "属性数与编制财务进入同一个混合随机池",
);
eq(
  M.dimPool(4, { loadoutElements: ["fire"], cardLevels: {}, activeLoan: false }).map((card) => card.id),
  mergedPoolIds,
  "旧续局的维度四刷新会兼容迁移到新混合池",
);
const priceDef = M.CFG.CARD_DEFS.find((card) => card.id === "attr.pure");
eq(
  [0, 1, 2, 3, 4].map((level) => M.cardPrice(priceDef, level, 1000)),
  [150, 300, 600, 1200, 2400],
  "普通卡价格按 15% KPI 起价并逐级翻倍",
);
eq([1, 2, 3, 4, 5, 6].map((n) => metas[`tier${n}`].baseValue), [15, 12, 9, 6, 4, 3], "基础值按新六工种曲线下降");
eq([1, 2, 3, 4, 5, 6].map(M.CFG.baseValueForTier), [15, 12, 9, 6, 4, 3], "权威基础分函数覆盖六种规格");
eq(
  M.CFG.CARD_PARAMS["attr.pure"].mult[0],
  M.CFG.CARD_PARAMS["attr.dual"].mult[0],
  "同为普通的专精与双职工 Lv.1 预期倍率一致",
);
eq(1 + M.CFG.CARD_PARAMS["attr.hex"].perElement[0] * 5, 6, "五色六边形津贴 Lv.1 达到 6 倍");
eq(M.CFG.baseTrainingBonus(["fire"], { "base.fire": 5 }), 40, "非草基础培训 Lv.5 增加 40 点基础分");
eq(M.CFG.HIRE_BASE, [0, 3, 4.2, 6, 8.5, 12, 16], "六工种基准价");
eq(M.CFG.HIRE_INFLATION, [0, 1.02, 1.03, 1.04, 1.05, 1.06, 1.07], "六工种整局通胀率");
eq(M.CFG.hirePrice({ tierCount: 1, kpi: 100, hiredThisShift: 0 }), 3, "单色首雇");
eq(M.CFG.hirePrice({ tierCount: 6, kpi: 100, hiredThisShift: 10 }), 31, "六色累计第 11 名");
eq(
  M.CFG.hirePrice({ tierCount: 6, kpi: M.CFG.FACTORY_KPI_CAP, hiredThisShift: 10_000 }),
  M.CFG.FACTORY_VALUE_CAP,
  "万人累计通胀不会让雇价溢出为 Infinity",
);
eq(M.CFG.shopRerollCost(M.CFG.FACTORY_KPI_CAP, 10_000), M.CFG.FACTORY_VALUE_CAP, "超长商店刷新费饱和为安全上限");
eq(M.cardPrice(priceDef, 10_000, M.CFG.FACTORY_KPI_CAP), M.CFG.FACTORY_VALUE_CAP, "越界卡牌等级的价格不会溢出");

console.log("== 招聘、Reroll、雇佣池与集中扣款");
const run = new M.RogueRun({
  loadout: Object.keys(metas),
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 12345,
});
eq(run.view().phase, "hiring", "新班先进入招聘阶段");
eq(run.view().hiring.candidates.length, 10, "每班生成 10 名候选");
const initialIds = run.view().hiring.candidates.map((c) => c.id);
eq(run.view().hiring.roundsMax, 1, "每班一轮招聘，避免首班加班池过长");
eq(run.view().hiring.round, 1, "recruitment starts at round one");
for (const c of run.view().hiring.candidates.slice(6)) run.toggleHiringCandidate(c.id);
const beforeReroll = run.view();
ok(beforeReroll.hiring.hireCost > 0, "选择员工后实时计算招聘总价");
ok(!run.rerollHiring(), "未购买人才市场时没有默认 Reroll");
run.debugGrantCard("staff.talentmarket", 1);
ok(run.rerollHiring(), "人才市场 Lv.1 解锁一次 Reroll");
const afterReroll = run.view();
eq(afterReroll.hiring.rerollSpent, Math.round(M.CFG.KPI_START * 0.05), "首班第 1 次 Reroll 为 5% KPI");
eq(
  afterReroll.hiring.candidates.slice(0, 6).map((c) => c.id),
  initialIds.slice(0, 6),
  "已选择候选在 Reroll 时锁定保留",
);
const expectedCost = afterReroll.hiring.hireCost + afterReroll.hiring.rerollSpent;
ok(run.confirmHiring(), "可集中确认招聘");
eq(run.view().phase, "shift", "招聘确认后进入生产");
eq(run.view().cash, M.CFG.START_CASH - expectedCost, "招聘与 Reroll 一次性扣款");
eq(run.view().bagPreview.filter(Boolean).length, 3, "雇佣池显示当前与后 2 名");
eq(run.view().quotaUsed, 10, "待投库存占用员工名额");

console.log("== 投掷不扣款、员工永久离池");
console.log("== inspection desk floor keeps one matching scoring desk");
function inspectionShopRun(species, shiftIndex, seed) {
  const seedRun = new M.RogueRun({
    loadout: [species],
    meta: metas,
    deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
    seed,
  });
  const snap = seedRun.snapshot();
  return M.RogueRun.restore({
    ...snap,
    phase: "shop",
    shiftIndex,
    shopOffer: {
      dims: [1, 2, 3],
      cards: [[], [], []],
      resolved: [true, true, true],
      rerollCounts: [0, 0, 0],
    },
  }, metas);
}
for (let seed = 1; seed <= 48; seed++) {
  const monoInspection = inspectionShopRun("tier1", 5, seed);
  ok(monoInspection != null, `mono inspection seed ${seed} restores`);
  monoInspection.finishShop();
  eq(monoInspection.view().disabledDesks.length, 1, "shift 6 still disables one desk");
  ok(!monoInspection.view().disabledDesks.includes("fire"), "mono loadout keeps its only matching desk");

  const dualInspection = inspectionShopRun("tier2", 10, seed);
  ok(dualInspection != null, `dual inspection seed ${seed} restores`);
  dualInspection.finishShop();
  eq(dualInspection.view().disabledDesks.length, 2, "shift 11 still disables two desks");
  ok(
    !["fire", "water"].every((element) => dualInspection.view().disabledDesks.includes(element)),
    "dual loadout keeps at least one matching desk",
  );
}

console.log("== disabled desks cannot bank a free combo");
const disabledComboRun = inspectionShopRun("tier6", 5, 612);
ok(disabledComboRun != null, "disabled-desk combo run restores");
disabledComboRun.finishShop();
disabledComboRun.debugSetCash(1_000_000);
const disabledElement = disabledComboRun.view().disabledDesks[0];
ok(disabledElement != null, "inspection shift exposes one disabled desk");
const disabledCandidate = disabledComboRun.view().hiring.candidates[0];
ok(disabledCandidate != null, "disabled-desk combo run offers a worker");
disabledComboRun.toggleHiringCandidate(disabledCandidate.id);
ok(disabledComboRun.confirmHiring(), "disabled-desk combo run enters its shift");
const disabledHead = disabledComboRun.view().bagPreview[0];
const disabledBodies = [];
disabledComboRun.registerSnapshots({
  bodies: () => disabledBodies,
  desks: () => [{ element: disabledElement, x: -10, w: 20, top: 10 }],
});
ok(disabledHead != null && disabledComboRun.onThrow(10_061, disabledHead.species), "worker can be dropped on the disabled desk");
disabledBodies.push({ ...body(10_061, 0, 0, [disabledElement]), species: disabledHead.species });
disabledComboRun.onSettled(10_061);
eq(disabledComboRun.view().revenueShift, 0, "disabled desk still awards zero revenue");
eq(disabledComboRun.view().combo, 0, "disabled desk does not prime the next scoring combo");
eq(disabledComboRun.view().stats.maxCombo, 0, "zero-value pulse does not inflate max combo stats");
eq(
  disabledComboRun.takePulses()[0]?.disabledDeskElements,
  [disabledElement],
  "zero-value pulse keeps the disabled-desk feedback payload",
);

const head = run.view().bagPreview[0];
const cashBeforeThrow = run.view().cash;
ok(head != null && run.onThrow(1001, head.species), "可投掷雇佣池头部员工");
eq(run.view().cash, cashBeforeThrow, "投掷阶段不再扣费");
eq(run.view().quotaUsed, 10, "投掷只从库存转为在场，不重复占名额");
run.onGone(1001, "rolloff");
eq(run.view().quotaUsed, 9, "溜走永久离队并释放名额");

console.log("== 限电日按手动投放次数结算");
eq(M.CFG.POWER_THROW_LIMIT, 12, "限电日额度为 12 次，给常规 3～6 次达标留出双倍以上容错");
const powerSeedRun = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 1010,
});
const powerSeedSnap = powerSeedRun.snapshot();
const powerLimitRun = M.RogueRun.restore({
  ...powerSeedSnap,
  phase: "shift",
  shiftIndex: 10,
  modifier: "power",
  kpi: 999_999,
  bill: 999_999,
  quotaUsed: 13,
  hirePool: Array.from({ length: 13 }, () => ({ species: "tier1", price: 1 })),
  bodies: [],
  bodyEconomy: [],
  powerThrowsLeft: M.CFG.POWER_THROW_LIMIT,
}, metas);
ok(powerLimitRun != null, "可构造限电日测试局");
for (let i = 0; i < M.CFG.POWER_THROW_LIMIT - 1; i++) {
  ok(powerLimitRun.onThrow(10_000 + i, "tier1"), `限电日第 ${i + 1} 次投放放行`);
  powerLimitRun.onGone(10_000 + i, "rolloff");
}
eq(powerLimitRun.view().powerThrowsLeft, 1, "每次成功出手只扣一次投放额度");
ok(powerLimitRun.onThrow(10_099, "tier1"), "最后一次投放仍可正常出手");
eq(powerLimitRun.view().powerThrowsLeft, 0, "最后一次出手后额度显示为零");
eq(powerLimitRun.nextCarried(), null, "额度耗尽后运输机不再补下一只");
eq(powerLimitRun.view().phase, "shift", "最后一只仍在半空时不提前判负");
powerLimitRun.onGone(10_099, "rolloff");
eq(powerLimitRun.view().phase, "bankrupt", "最后一次投放失手且未达 KPI 才判破产");

const powerHitRun = M.RogueRun.restore({
  ...powerSeedSnap,
  phase: "shift",
  shiftIndex: 10,
  modifier: "power",
  kpi: 1,
  bill: 1,
  quotaUsed: 1,
  hirePool: [{ species: "tier1", price: 1 }],
  bodies: [],
  bodyEconomy: [],
  powerThrowsLeft: 1,
}, metas);
const powerHitBodies = [];
powerHitRun.registerSnapshots({
  bodies: () => powerHitBodies,
  desks: () => [{ element: "fire", x: -20, w: 40, top: 10 }],
});
ok(powerHitRun.onThrow(10_100, "tier1"), "只剩一次时仍允许决定胜负的投放");
powerHitBodies.push(body(10_100, 0, 0, ["fire"]));
powerHitBodies[0].species = "tier1";
powerHitRun.onSettled(10_100);
eq(powerHitRun.view().phase, "overtime", "最后一次投放达成 KPI 时进入加班，不会误判破产");

console.log("== 第 20 班复合检查");
const finalRun = M.RogueRun.restore({
  ...powerSeedSnap,
  phase: "shift",
  shiftIndex: 20,
  modifier: "audit",
  kpi: M.CFG.kpiForShift(20),
  bill: M.CFG.kpiForShift(20),
  quotaUsed: M.CFG.FINAL_POWER_THROW_LIMIT,
  hirePool: Array.from({ length: M.CFG.FINAL_POWER_THROW_LIMIT }, () => ({ species: "tier1", price: 1 })),
  bodies: [],
  bodyEconomy: [],
  powerThrowsLeft: M.CFG.FINAL_POWER_THROW_LIMIT,
}, metas);
ok(finalRun != null, "可构造第 20 班复合检查测试局");
eq(finalRun.view().disabledDesks, [], "第 20 班不禁用任何桌面");
eq(finalRun.view().powerThrowsLeft, 20, "第 20 班限制为 20 次手动投放");
ok(finalRun.windAx() !== 0, "第 20 班启用大风");
// 与 FactoryScene 标准 560px 场景的真实投放几何一致：
// 起点脚底约 198.66px、地面 508px、初始竖速 40px/s、重力 2500px/s²。
const standardDropDistance = 508 - (104 + 104 * (233 / 256));
const standardDropSeconds =
  (-40 + Math.sqrt(40 ** 2 + 2 * 2500 * standardDropDistance)) / 2500;
const standardWindDrift =
  0.5 * Math.abs(finalRun.windAx()) * standardDropSeconds ** 2;
ok(
  standardWindDrift >= 170,
  `标准场景大风落地点相对无风至少偏移 170px（实得 ${standardWindDrift.toFixed(1)}px）`,
);
finalRun.tick(1_000);
eq(finalRun.view().rushDeadline, 301_000, "第 20 班赶工时限为 5 分钟");
const inspectionSnap = finalRun.snapshot();
eq(inspectionSnap?.v, 10, "检查日续局写入 v10 剩余时间存档");
eq(inspectionSnap?.rushRemainingMs, 300_000, "续局保存赶工剩余有效游玩时间");
eq(inspectionSnap?.windSign, Math.sign(finalRun.windAx()), "续局保存当前大风方向");
const inspectionResumed = M.RogueRun.restore(inspectionSnap, metas);
eq(Math.sign(inspectionResumed?.windAx()), Math.sign(finalRun.windAx()), "读档不会改变大风方向");
inspectionResumed?.tick(10_000);
eq(inspectionResumed?.view().rushDeadline, 310_000, "读档后按剩余时间重建赶工墙钟而非重置进度");
const windBeforePause = Math.sign(finalRun.windAx());
finalRun.resumeClock(610_000, 10_000);
eq(finalRun.view().rushDeadline, 901_000, "切到后台 10 分钟会把赶工截止时间等量顺延");
finalRun.tick(610_000);
eq(finalRun.view().phase, "shift", "恢复窗口时不会因旧截止时间已经过去而瞬间破产");
eq(Math.sign(finalRun.windAx()), windBeforePause, "恢复窗口时不会立即翻转大风方向");
finalRun.tick(901_001);
eq(finalRun.view().phase, "bankrupt", "恢复后新的赶工截止时间仍会正常判定失败");

console.log("== 一般系吸收合并、人口释放与基础分继承");
const normalMeta = {
  normalWorker: {
    species: "normalWorker",
    elements: ["normal"],
    tierCount: 1,
    groupNo: 1,
    reach: 2,
    baseValue: 15,
  },
};
const absorbRun = new M.RogueRun({
  loadout: ["normalWorker"],
  meta: normalMeta,
  deskOrder: ["normal"],
  seed: 2,
});
ok(absorbRun.confirmHiring(), "吸收测试局完成招聘");
const absorbBodies = [];
const absorbDesks = [{ element: "normal", x: -10, w: 20, top: 10 }];
absorbRun.registerSnapshots({ bodies: () => absorbBodies, desks: () => absorbDesks });
ok(absorbRun.onThrow(7001, "normalWorker"), "先投放被吸收单位");
absorbBodies.push(body(7001, 0, 0, ["normal"]));
absorbBodies[0].species = "normalWorker";
absorbRun.onSettled(7001);
absorbRun.debugGrantCard("normal.absorb", 5);
ok(absorbRun.onThrow(7002, "normalWorker"), "再投放吸收者");
absorbBodies.push(body(7002, 20, 0, ["normal"]));
absorbBodies[1].species = "normalWorker";
absorbRun.onSettled(7002);
eq(absorbRun.takeBodyMutations(), [{ kind: "absorb", sourceUid: 7002, targetUid: 7001 }], "满级吸收命中后生成合并指令");
eq(absorbRun.view().quotaUsed, 9, "吸收后两个单位只占一个人口");
eq(absorbRun.view().bodyStates.find((state) => state.uid === 7002)?.sizeLevel, 2, "吸收者体型合并为 2 级");
ok(absorbRun.countsForStrike(7002), "吸收者没有永久个体罢工豁免");
eq(absorbRun.snapshot()?.bodyEconomy.find((item) => item.uid === 7002)?.base, 30, "吸收者继承两个单位的完整基础分");
eq(absorbRun.bodyScale(7002), 1.5, "首次吸收后的角色半径明显增大到 1.5 倍");

let reverseAbsorbResult = null;
for (let seed = 1; seed <= 100 && reverseAbsorbResult == null; seed++) {
  const run = new M.RogueRun({
    loadout: ["normalWorker"], meta: normalMeta, deskOrder: ["normal"], seed,
  });
  run.confirmHiring();
  const bodies = [];
  run.registerSnapshots({ bodies: () => bodies, desks: () => absorbDesks });
  run.onThrow(7101, "normalWorker");
  bodies.push({ ...body(7101, 0, 0, ["normal"]), species: "normalWorker" });
  run.onSettled(7101);
  run.debugGrantCard("normal.absorb", 5);
  run.onThrow(7102, "normalWorker");
  bodies.push({ ...body(7102, 20, 0, ["normal"]), species: "normalWorker" });
  run.onSettled(7102);
  const firstMutation = run.takeBodyMutations()[0];
  if (firstMutation?.kind !== "absorb") continue;

  // 场景层通常会立即执行 mutation；测试快照手动镜像该移除动作。
  bodies.splice(bodies.findIndex((item) => item.uid === firstMutation.targetUid), 1);
  run.onThrow(7103, "normalWorker");
  bodies.push({ ...body(7103, 20, 0, ["normal"]), species: "normalWorker" });
  run.onSettled(7103);
  const reverseMutation = run.takeBodyMutations()[0];
  if (reverseMutation?.sourceUid === firstMutation.sourceUid && reverseMutation.targetUid === 7103) {
    reverseAbsorbResult = { run, absorberUid: firstMutation.sourceUid };
  }
}
ok(reverseAbsorbResult != null, "低等级单位触发吸收时会反过来被高等级单位吸收");
eq(
  reverseAbsorbResult?.run.view().bodyStates.find((state) => state.uid === reverseAbsorbResult.absorberUid)?.sizeLevel,
  3,
  "反向吸收后高等级单位继续升级",
);
ok(!reverseAbsorbResult?.run.view().bodyStates.some((state) => state.uid === 7103), "反向吸收后低等级单位被移除");

const emperorRun = new M.RogueRun({
  loadout: ["normalWorker"],
  meta: normalMeta,
  deskOrder: ["normal"],
  seed: 7011,
});
ok(emperorRun.confirmHiring(), "打工皇帝测试局完成招聘");
const emperorBodies = [];
emperorRun.registerSnapshots({ bodies: () => emperorBodies, desks: () => absorbDesks });
ok(emperorRun.onThrow(7011, "normalWorker"), "先投放将被完全遮挡的单位");
emperorBodies.push({ ...body(7011, 0, 0, ["normal"]), species: "normalWorker" });
emperorRun.onSettled(7011);
emperorRun.debugGrantCard("normal.emperor", 5);
ok(emperorRun.onThrow(7012, "normalWorker"), "再投放触发打工皇帝的单位");
emperorBodies.push({ ...body(7012, 0, 0, ["normal"]), species: "normalWorker" });
emperorRun.onSettled(7012);
ok(
  emperorRun.takeBodyMutations().some((mutation) => mutation.kind === "absorb"),
  "打工皇帝增加体型后吞掉被可视圆完全遮挡的所有咕噜",
);
eq(
  Math.max(...emperorRun.view().bodyStates.map((state) => state.sizeLevel ?? 1)),
  10,
  "打工皇帝 Lv.5 先增加 8 体型，再合并完全遮挡目标的体型",
);

console.log("== 人才市场增加招聘 Reroll");
const baseTrainingRun = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 17,
});
baseTrainingRun.debugGrantCard("base.fire", 2);
eq(baseTrainingRun.view().hiring.candidates[0].baseValue, 20, "非草基础培训即时按增强值反映到招聘候选基础分");
baseTrainingRun.debugGrantCard("water.fourday", 1);
eq(baseTrainingRun.strikeCount(["water"]), 5, "工休 Lv.1 将含水同种罢工线改为 5");
eq(baseTrainingRun.strikeCount(["fire"]), 3, "工休不会改变非水系罢工线");
baseTrainingRun.debugGrantCard("water.fourday", 2);
eq(baseTrainingRun.strikeCount(["water"]), 9, "工休 Lv.3 将含水同种罢工线改为 9");
baseTrainingRun.debugGrantCard("staff.expand", 1);
const oldExpandSnap = baseTrainingRun.snapshot();
oldExpandSnap.quotaMax = 40;
const migratedExpandRun = M.RogueRun.restore(oldExpandSnap, metas);
eq(migratedExpandRun?.view().quotaMax, 25, "旧续局中的扩编按新规则迁移为 +5");

const multiRoundRun = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 2026,
});
multiRoundRun.setAllHiringCandidates(true);
eq(multiRoundRun.view().hiring.selectedCount, 10, "select-all chooses every recruitment candidate");
multiRoundRun.setAllHiringCandidates(false);
eq(multiRoundRun.view().hiring.selectedCount, 0, "clear-all removes every recruitment selection");
multiRoundRun.toggleAllHiringCandidates();
eq(multiRoundRun.view().hiring.selectedCount, 10, "select-all toggle chooses every recruitment candidate");
multiRoundRun.toggleAllHiringCandidates();
eq(multiRoundRun.view().hiring.selectedCount, 0, "select-all toggle clears a fully selected draft");

const cappedHiringSnap = multiRoundRun.snapshot();
cappedHiringSnap.quotaUsed = cappedHiringSnap.quotaMax - 3;
const cappedHiringRun = M.RogueRun.restore(cappedHiringSnap, metas);
ok(cappedHiringRun != null, "可恢复接近满编的招聘局");
cappedHiringRun?.setAllHiringCandidates(true);
eq(cappedHiringRun?.view().hiring.selectedCount, 3, "自动选择只选到满编，不选择超出名额的候选");
cappedHiringRun?.toggleAllHiringCandidates();
eq(cappedHiringRun?.view().hiring.selectedCount, 0, "容量受限时再次自动选择会清空当前选择");

multiRoundRun.toggleAllHiringCandidates();
ok(multiRoundRun.confirmHiring(true), "招聘确认可开工");
eq(multiRoundRun.view().phase, "shift", "每班只进行一轮招聘");
eq(multiRoundRun.view().quotaUsed, 10, "首班单轮最多招聘十人");

const budgetRun = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 99,
});
const budgetSnap = budgetRun.snapshot();
const overflowSnap = structuredClone(budgetSnap);
overflowSnap.cash = Infinity;
overflowSnap.revenueTotal = Infinity;
overflowSnap.revenueShift = Infinity;
overflowSnap.kpi = Infinity;
overflowSnap.bill = Infinity;
overflowSnap.stats.maxPulse = Infinity;
const recoveredOverflowRun = M.RogueRun.restore(overflowSnap, metas);
ok(recoveredOverflowRun != null, "旧版超长局的非有限经济快照仍可恢复");
eq(recoveredOverflowRun?.view().cash, M.CFG.FACTORY_VALUE_CAP, "恢复时现金收敛到安全上限");
eq(recoveredOverflowRun?.view().revenueTotal, M.CFG.FACTORY_VALUE_CAP, "恢复时累计营收收敛到安全上限");
eq(recoveredOverflowRun?.view().kpi, M.CFG.FACTORY_KPI_CAP, "恢复时 KPI 收敛到保留经济余量的上限");
eq(recoveredOverflowRun?.view().stats.maxPulse, M.CFG.FACTORY_VALUE_CAP, "恢复时最高脉冲收敛到安全上限");
budgetSnap.hiringCandidates[0].selected = true;
budgetSnap.cash = 0;
const poorRun = M.RogueRun.restore(budgetSnap, metas);
ok(poorRun != null && !poorRun.view().hiring.canAfford, "recruitment requires enough cash for its immediate payment");
ok(poorRun != null && !poorRun.confirmHiring(), "insufficient cash cannot confirm recruitment");
poorRun?.setAllHiringCandidates(true);
eq(poorRun?.view().hiring.selectedCount, 0, "automatic recruitment selects no candidates when cash is zero");

const limitedBudgetSnap = budgetRun.snapshot();
limitedBudgetSnap.cash = limitedBudgetSnap.hiringCandidates[0] == null
  ? 0
  : budgetRun.view().hiring.candidates[0].price;
const limitedBudgetRun = M.RogueRun.restore(limitedBudgetSnap, metas);
limitedBudgetRun?.setAllHiringCandidates(true);
ok(
  limitedBudgetRun != null
    && limitedBudgetRun.view().hiring.selectedCount > 0
    && limitedBudgetRun.view().hiring.hireCost <= limitedBudgetRun.view().cash,
  "automatic recruitment selects only the quantity affordable with current cash",
);

const billRiskSnap = budgetRun.snapshot();
billRiskSnap.cash = Math.max(0, billRiskSnap.bill - 1);
const billRiskRun = M.RogueRun.restore(billRiskSnap, metas);
ok(billRiskRun != null && billRiskRun.view().hiring.canAfford, "negative after-bill balance remains playable when immediate payment is affordable");

const talentRun = new M.RogueRun({
  loadout: ["tier1", "tier2", "tier3"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 7,
});
talentRun.debugGrantCard("staff.talentmarket", 2);
eq(talentRun.view().hiring.rerollsMax, 2, "人才市场每级 +1 次 Reroll，不再附送默认次数");
eq(talentRun.view().hiring.rerollCost, Math.round(M.CFG.KPI_START * 0.05), "人才市场不再降低刷新费用");

console.log("== 补招聘追加一轮限量招聘");
const backfillRun = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 7007,
});
backfillRun.debugGrantCard("staff.backfill", 3);
ok(backfillRun.confirmHiring(true), "补招聘局完成常规十选招聘");
eq(backfillRun.view().phase, "hiring", "补招聘在常规招聘后追加一轮");
eq(backfillRun.view().hiring.round, 2, "补招聘进入第二轮招聘");
eq(backfillRun.view().hiring.candidates.length, 3, "补招聘 Lv.3 提供 3 名额外候选");
ok(backfillRun.confirmHiring(), "补招聘额外轮可正常付款");
eq(backfillRun.view().phase, "shift", "补招聘额外轮结束后开工");
eq(backfillRun.view().quotaUsed, 13, "补招聘 Lv.3 最多额外招聘 3 只咕噜");

const backfillCapRun = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 7010,
});
backfillCapRun.debugGrantCard("staff.backfill", 10);
backfillCapRun.debugGrantCard("staff.talentmarket", 2);
ok(backfillCapRun.confirmHiring(true), "十级补招聘局完成常规招聘");
eq(backfillCapRun.view().hiring.candidates.length, 12, "补招聘 Lv.10 加人才市场 Lv.2 每轮展示 12 名候选");
eq(backfillCapRun.view().hiring.selectedCount, 10, "automatic recruitment respects the per-round seat limit");
ok(backfillCapRun.confirmHiring(), "automatically limited recruitment can be confirmed directly");

console.log("== 搬桌切割移动、解雇退款与遣散费");
const deskCardRun = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 8080,
});
ok(deskCardRun.confirmHiring(), "搬桌测试局完成招聘");
const deskCardBodies = [];
const deskCardDesks = [
  { element: "fire", x: 0, w: 100, top: 120 },
  { element: "water", x: 120, w: 100, top: 120 },
  { element: "grass", x: 240, w: 100, top: 120 },
  { element: "electric", x: 360, w: 100, top: 120 },
  { element: "ice", x: 480, w: 100, top: 120 },
  { element: "normal", x: 600, w: 100, top: 120 },
];
deskCardRun.registerSnapshots({ bodies: () => deskCardBodies, desks: () => deskCardDesks });
for (const [uid, x] of [[8101, 50], [8102, 170]]) {
  const worker = deskCardRun.nextCarried();
  ok(worker != null && deskCardRun.onThrow(uid, worker.species), `搬桌测试投放 ${uid}`);
  const placed = body(uid, x, 110);
  placed.species = worker.species;
  deskCardBodies.push(placed);
}
eq(
  M.bodiesSupportedByDesks(deskCardBodies, deskCardDesks, ["fire", "water"]).sort(),
  [8101, 8102],
  "物理支撑图能找出两张桌上的全部咕噜",
);
const poolBeforeDeskSwap = deskCardRun.view().bagTotal;
deskCardRun.debugGrantCard("staff.movedesk");
deskCardRun.pickDeskForSwap("fire");
deskCardRun.pickDeskForSwap("water");
eq(
  deskCardRun.takeDeskMoves().sort((left, right) => left.uid - right.uid),
  [{ uid: 8101, dx: 120 }, { uid: 8102, dx: -120 }],
  "搬桌让两座塔随桌面交换位置",
);
eq(deskCardRun.view().bagTotal, poolBeforeDeskSwap, "搬桌不再把咕噜返还雇佣池");
eq(deskCardRun.view().quotaUsed, 10, "搬桌不改变已占员工名额");

const bridgedDeskBodies = [50, 70, 90, 110, 130, 150, 170]
  .map((x, index) => body(8201 + index, x, 110));
const bridgedMoves = M.deskSwapMoves(
  bridgedDeskBodies,
  deskCardDesks.slice(0, 2),
  ["fire", "water"],
  { slack: 1.08 },
);
ok(bridgedMoves.some((move) => move.dx > 0) && bridgedMoves.some((move) => move.dx < 0), "跨桌连通塔在中点切开后分别随所属桌移动");
eq(new Set(bridgedMoves.map((move) => move.uid)).size, bridgedMoves.length, "搬桌切割点不会重复归属同一只咕噜");

const dismissalRun = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 8181,
});
ok(dismissalRun.confirmHiring(), "解雇测试局完成招聘");
const dismissalWorker = dismissalRun.view().bagPreview[0];
const dismissalBodies = [];
dismissalRun.registerSnapshots({ bodies: () => dismissalBodies, desks: () => deskCardDesks });
ok(dismissalWorker != null && dismissalRun.onThrow(8182, dismissalWorker.species), "解雇测试投放员工");
const dismissalBody = body(8182, 50, 110);
dismissalBody.species = dismissalWorker.species;
dismissalBodies.push(dismissalBody);
dismissalRun.debugGrantCard("staff.fire3");
eq(
  dismissalRun.departureFeedback(8182, 1),
  { accepted: true, refund: dismissalWorker.price },
  "解雇反馈在入账前给出该角色的精确退款金额",
);
ok(M.FACTORY_ROGUE["zh-Hans"].operationDismissSceneHint.includes("100% 最近雇价"), "中文解雇提示在点击前说明退款口径");
ok(M.FACTORY_ROGUE.en.operationDismissSceneHint.includes("100% of its latest hire price"), "英文解雇提示在点击前说明退款口径");
const cashBeforeDismissal = dismissalRun.view().cash;
dismissalRun.onDismissPick(8182);
eq(dismissalRun.view().cash - cashBeforeDismissal, dismissalWorker.price, "解雇返还 100% 最近雇价");
eq(dismissalRun.departureFeedback(8182, 1), { accepted: false, refund: 0 }, "已结算解雇不会再次生成退款反馈");
const dismissalAfterFirstPick = dismissalRun.view();
for (let index = 0; index < 24; index++) dismissalRun.onDismissPick(8182);
eq(dismissalRun.view().cash, dismissalAfterFirstPick.cash, "同一只解雇动画中的咕噜被重复点击不会重复退款");
eq(dismissalRun.view().pendingDismiss, dismissalAfterFirstPick.pendingDismiss, "重复点击同一只咕噜不会消耗更多解雇名额");
eq(dismissalRun.view().stats.dismissals, dismissalAfterFirstPick.stats.dismissals, "重复点击同一只咕噜不会虚增解雇统计");
const dismissalPendingSnap = dismissalRun.snapshot();
const dismissalResumed = dismissalPendingSnap == null ? null : M.RogueRun.restore(dismissalPendingSnap, metas);
const dismissalResumedBefore = dismissalResumed?.view();
dismissalResumed?.registerSnapshots({ bodies: () => dismissalBodies, desks: () => deskCardDesks });
dismissalResumed?.onDismissPick(8182);
eq(dismissalResumed?.view().cash, dismissalResumedBefore?.cash, "解雇退出动画中切后台续局不会再次退款");
eq(dismissalResumed?.view().pendingDismiss, dismissalResumedBefore?.pendingDismiss, "续局保留已结算离场标记和剩余解雇名额");

const severanceRun = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 9090,
});
ok(severanceRun.confirmHiring(), "遣散费测试局完成招聘");
const severanceWorker = severanceRun.view().bagPreview[0];
const severanceBodies = [];
severanceRun.registerSnapshots({ bodies: () => severanceBodies, desks: () => deskCardDesks });
ok(severanceWorker != null && severanceRun.onThrow(9101, severanceWorker.species), "遣散费测试投放员工");
const severanceBody = body(9101, 50, 110);
severanceBody.species = severanceWorker.species;
severanceBodies.push(severanceBody);
severanceRun.debugGrantCard("staff.severance", 5);
const maxSeveranceRefund = severanceWorker.price * 3;
eq(
  severanceRun.departureFeedback(9101),
  { accepted: true, refund: maxSeveranceRefund },
  "遣散反馈与罢工实际退款使用同一精确账本口径",
);
const cashBeforeSeverance = severanceRun.view().cash;
severanceRun.onStrike([9101], severanceWorker.species);
eq(
  severanceRun.view().cash - cashBeforeSeverance,
  maxSeveranceRefund,
  "遣散费 Lv.5 返还 300% 最新雇价",
);
const severanceAfterFirstStrike = severanceRun.view();
severanceRun.onStrike([9101], severanceWorker.species);
eq(severanceRun.view().cash, severanceAfterFirstStrike.cash, "重复罢工上报不会重复结算遣散费");
eq(severanceRun.view().stats.strikes, severanceAfterFirstStrike.stats.strikes, "重复罢工上报不会虚增罢工统计");
eq(severanceRun.takePulses(), [], "遣散费不再产生抗议结算脉冲");

const bulkDepartureTemplate = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 9210,
});
ok(bulkDepartureTemplate.confirmHiring(), "200 人批量离场测试局完成招聘");
const bulkDepartureBodies = Array.from({ length: 200 }, (_, index) => {
  const worker = body(92_100 + index, 20 + (index % 20) * 24, 80 + Math.floor(index / 20) * 18);
  worker.species = "tier1";
  return worker;
});
bulkDepartureTemplate.registerSnapshots({ bodies: () => bulkDepartureBodies, desks: () => deskCardDesks });
const bulkDepartureSnapshot = bulkDepartureTemplate.snapshot();
if (bulkDepartureSnapshot != null) {
  bulkDepartureSnapshot.cash = 1_000;
  bulkDepartureSnapshot.bodies = bulkDepartureBodies;
  bulkDepartureSnapshot.bodyEconomy = bulkDepartureBodies.map((worker, index) => ({
    uid: worker.uid,
    species: "tier1",
    cost: index + 1,
    base: 15,
  }));
}
const bulkDepartureRun = bulkDepartureSnapshot == null
  ? null
  : M.RogueRun.restore(bulkDepartureSnapshot, metas);
bulkDepartureRun?.registerSnapshots({ bodies: () => bulkDepartureBodies, desks: () => deskCardDesks });
bulkDepartureRun?.debugGrantCard("staff.severance", 5);
const bulkDepartureUids = bulkDepartureBodies.map((worker) => worker.uid);
const bulkRefundExpected = 60_300;
const cashBeforeBulkDeparture = bulkDepartureRun?.view().cash ?? 0;
bulkDepartureRun?.onStrike(bulkDepartureUids, "tier1");
eq(
  (bulkDepartureRun?.view().cash ?? 0) - cashBeforeBulkDeparture,
  bulkRefundExpected,
  "200 人批量罢工按各自最近雇价准确退款",
);
bulkDepartureRun?.debugEndShift();
eq(
  bulkDepartureRun?.view().settlement?.cashFlows.filter((flow) => flow.kind === "refund"),
  [{ kind: "refund", amount: bulkRefundExpected }],
  "200 笔退款在结算单压缩为一条准确总额",
);

const capDepartureTemplate = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 9211,
});
ok(capDepartureTemplate.confirmHiring(), "现金上限离场测试局完成招聘");
const capDepartureBody = body(93_001, 50, 110);
capDepartureBody.species = "tier1";
capDepartureTemplate.registerSnapshots({ bodies: () => [capDepartureBody], desks: () => deskCardDesks });
const capDepartureSnapshot = capDepartureTemplate.snapshot();
if (capDepartureSnapshot != null) {
  capDepartureSnapshot.cash = M.CFG.FACTORY_VALUE_CAP - 7;
  capDepartureSnapshot.bodies = [capDepartureBody];
  capDepartureSnapshot.bodyEconomy = [{ uid: capDepartureBody.uid, species: "tier1", cost: 100, base: 15 }];
}
const capDepartureRun = capDepartureSnapshot == null ? null : M.RogueRun.restore(capDepartureSnapshot, metas);
capDepartureRun?.registerSnapshots({ bodies: () => [capDepartureBody], desks: () => deskCardDesks });
capDepartureRun?.debugGrantCard("staff.severance", 5);
eq(
  capDepartureRun?.departureFeedback(capDepartureBody.uid),
  { accepted: true, refund: 7 },
  "接近安全上限时反馈只显示真正可到账的退款",
);
capDepartureRun?.onStrike([capDepartureBody.uid], "tier1");
eq(capDepartureRun?.view().cash, M.CFG.FACTORY_VALUE_CAP, "上限边界退款精确填满钱包且不溢出");
capDepartureRun?.debugEndShift();
eq(
  capDepartureRun?.view().settlement?.cashFlows.filter((flow) => flow.kind === "refund"),
  [{ kind: "refund", amount: 7 }],
  "上限边界结算单记录实际到账额而非名义退款",
);

eq(
  M.settlementIncomeFlows([
    { kind: "hire", amount: -30 },
    { kind: "reroll", amount: -6 },
    { kind: "refund", amount: 5 },
    { kind: "trickle", amount: 3 },
    { kind: "kpiBonus", amount: 9 },
  ]),
  [
    { kind: "refund", amount: 5 },
    { kind: "trickle", amount: 3 },
    { kind: "kpiBonus", amount: 9 },
  ],
  "结算收入明细排除已计入本班花费的招聘与重抽支出",
);

console.log("== 水镜同化确定目标数量");
const convertMeta = {
  fireTarget: {
    species: "fireTarget",
    elements: ["fire"],
    tierCount: 1,
    groupNo: 1,
    reach: 2,
    baseValue: 15,
  },
  waterSource: {
    species: "waterSource",
    elements: ["fire", "water"],
    tierCount: 2,
    groupNo: 1,
    reach: 2,
    baseValue: 12,
  },
};
const convertSeedRun = new M.RogueRun({
  loadout: Object.keys(convertMeta),
  meta: convertMeta,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 8282,
});
const convertSnap = convertSeedRun.snapshot();
convertSnap.phase = "shift";
convertSnap.hirePool = [
  { species: "fireTarget", price: 2 },
  { species: "waterSource", price: 3 },
];
convertSnap.hiringCandidates = [];
convertSnap.quotaUsed = 2;
const convertRun = M.RogueRun.restore(convertSnap, convertMeta);
const convertBodies = [];
const convertDesks = [{ element: "fire", x: 0, w: 120, top: 120 }];
convertRun.registerSnapshots({ bodies: () => convertBodies, desks: () => convertDesks });
convertRun.debugGrantCard("water.convert", 5);
ok(convertRun.onThrow(8283, "fireTarget"), "同化测试投放非水目标");
convertBodies.push({ ...body(8283, 70, 110, ["fire"]), species: "fireTarget" });
ok(convertRun.onThrow(8284, "waterSource"), "同化测试投放水系来源");
convertBodies.push({ ...body(8284, 50, 110, ["fire", "water"]), species: "waterSource" });
convertRun.onSettled(8284);
const convertPulse = convertRun.takePulses().at(-1);
ok(!convertPulse?.extras.some((extra) => extra.kind === "convertEcho"), "水镜同化不再额外生成回响业绩");
eq(
  convertRun.view().bodyStates.find((state) => state.uid === 8283)?.speciesOverride,
  "waterSource",
  "满级水镜同化确定改写最高业绩非水目标",
);
ok(convertRun.countsForStrike(8283), "同化目标没有永久个体罢工豁免");
const restoredConvertRun = M.RogueRun.restore(convertRun.snapshot(), convertMeta);
ok(restoredConvertRun.countsForStrike(8283), "同化连接豁免交由物理结构快照跨回合维护");

console.log("== 加班时间自动投放与 KPI/账单闭环");
const overtimeRun = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 31415,
});
overtimeRun.debugGrantCard("fire.burst", 2);
ok(overtimeRun.confirmHiring(), "加班测试局完成招聘");
const overtimeBodies = [];
const overtimeDesks = [
  { element: "fire", x: 0, w: 180, top: 120 },
  { element: "water", x: 200, w: 100, top: 120 },
  { element: "grass", x: 320, w: 100, top: 120 },
  { element: "electric", x: 440, w: 100, top: 120 },
  { element: "ice", x: 560, w: 100, top: 120 },
  { element: "normal", x: 680, w: 100, top: 120 },
];
overtimeRun.registerSnapshots({ bodies: () => overtimeBodies, desks: () => overtimeDesks });
let manualWorkers = 0;
for (let i = 0; i < 4 && overtimeRun.view().phase === "shift"; i++) {
  const current = overtimeRun.nextCarried();
  ok(current != null && overtimeRun.onThrow(2000 + i, current.species), `手动投放第 ${i + 1} 人`);
  overtimeBodies.push(body(2000 + i, 24 + i * 38, 110));
  overtimeBodies.at(-1).species = "tier1";
  overtimeRun.onSettled(2000 + i);
  manualWorkers++;
}
eq(overtimeRun.view().phase, "overtime", "少量角色达成 KPI 后进入加班时间");
eq(overtimeRun.view().overtimeRemaining, 10 - manualWorkers, "所有未投放角色都进入自动结算队列");
const overtimeWorkerCount = 10 - manualWorkers;
let overtimeUid = 3000;
let checkedOvertimeResume = false;
while (overtimeRun.view().phase === "overtime") {
  const current = overtimeRun.nextOvertime();
  ok(current != null, "加班阶段持续提供池头角色");
  const target = overtimeRun.onOvertimeThrow(overtimeUid, current.species, 10);
  ok(target != null, "自动角色能找到最高分落点");
  const landed = body(overtimeUid, target.x, target.y);
  landed.species = "tier1";
  overtimeBodies.push(landed);
  overtimeRun.onSettled(overtimeUid);
  eq(overtimeRun.view().phase, "overtime", "加班角色得分后先逃走，不立即生成工资单");
  if (!checkedOvertimeResume) {
    const midSnap = overtimeRun.snapshot();
    const resumed = midSnap == null ? null : M.RogueRun.restore(midSnap, metas);
    eq(midSnap?.overtimeReturned.length, 1, "存档单独记录已得分返池角色");
    eq(resumed?.view().revenueShift, overtimeRun.view().revenueShift, "读档不重复发放已完成的加班收入");
    eq(resumed?.view().overtimeRemaining, overtimeWorkerCount - 1, "读档只重播尚未得分的加班角色");
    checkedOvertimeResume = true;
  }
  overtimeBodies.splice(overtimeBodies.indexOf(landed), 1);
  // 场景竞态即便误报成罢工，登记中的加班 uid 也必须按返池处理。
  overtimeRun.onGone(overtimeUid, overtimeUid === 3000 ? "strike" : "overtime");
  overtimeUid++;
}
eq(overtimeRun.view().phase, "settlement", "最后一名加班角色逃回雇佣池后才进入工资单");
eq(overtimeRun.view().bagTotal, overtimeWorkerCount, "所有加班得分角色都返回雇佣池");
eq(overtimeRun.view().quotaUsed, 10, "加班返池不释放也不重复占用员工名额");
eq(overtimeRun.snapshot()?.hirePool.length, overtimeWorkerCount, "工资单存档保留全部返池角色");
eq(overtimeRun.view().settlement.bill, overtimeRun.view().kpi, "工资单账单与 KPI 同额");
const kpiBonusFlows = overtimeRun.view().settlement.cashFlows.filter((flow) => flow.kind === "kpiBonus");
eq(kpiBonusFlows.length, 1, "每班 KPI 达标奖金只发放一次");
eq(kpiBonusFlows[0]?.amount, M.CFG.kpiBonusFor(overtimeRun.view().kpi), "绩效奖金等于当班 KPI 的 30%");
ok(overtimeRun.view().settlement.receivedTotal > overtimeRun.view().kpi, "加班收入计入本班与钱包总收入");
ok(overtimeRun.takePulses().some((pulse) => pulse.overtime), "加班脉冲带演出标记");
const beforeBill = overtimeRun.view().cash;
ok(overtimeRun.confirmSettlement(), "KPI 同额账单可以正常支付");
eq(overtimeRun.view().cash, beforeBill - overtimeRun.view().kpi, "支付账单只扣除 KPI 同额");
const beforeSkip = overtimeRun.view().cash;
overtimeRun.skipDim(0);
eq(
  overtimeRun.view().cash,
  beforeSkip + Math.round(overtimeRun.view().kpi * M.CFG.SHOP_SKIP_REFUND_RATE),
  "跳过商店返还 8% KPI",
);
overtimeRun.skipDim(1);
overtimeRun.skipDim(2);
overtimeRun.finishShop();
eq(overtimeRun.view().phase, "hiring", "商店结束后进入下一班招聘");
eq(overtimeRun.view().hiring.poolTotal, overtimeWorkerCount, "下一班招聘页仍显示全部加班返池角色");
ok(overtimeRun.confirmHiring() && overtimeRun.nextCarried() != null, "下一班可以继续投放加班返池角色");

console.log("== 加班零分落点仍去本属性桌并优先粘连");
const zeroOvertimeSeed = new M.RogueRun({
  loadout: ["tier1"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 27182,
});
ok(zeroOvertimeSeed.confirmHiring(), "零分加班测试局完成招聘");
const zeroOvertimeSnap = zeroOvertimeSeed.snapshot();
zeroOvertimeSnap.phase = "overtime";
zeroOvertimeSnap.hirePool = [{ species: "tier1", price: 2 }];
zeroOvertimeSnap.hiringCandidates = [];
zeroOvertimeSnap.disabledDesks = ["fire"];
const zeroOvertimeRun = M.RogueRun.restore(zeroOvertimeSnap, metas);
const zeroAnchor = { ...body(3990, 60, 110, ["fire"]), species: "tier1" };
zeroOvertimeRun.registerSnapshots({
  bodies: () => [zeroAnchor],
  desks: () => [
    { element: "fire", x: 0, w: 120, top: 120 },
    { element: "water", x: 200, w: 120, top: 120 },
  ],
});
const zeroTarget = zeroOvertimeRun.onOvertimeThrow(3991, "tier1", 10);
ok(zeroTarget != null, "本属性桌禁运、无得分点时仍能完成自动投放");
eq(zeroTarget?.x, zeroAnchor.x, "零分加班角色优先落到本属性桌上的同属性咕噜处粘连");
ok((zeroTarget?.x ?? 999) < 120, "零分加班角色不会被同分排序投到异属性桌");

console.log("== 续局保存招聘池与整局通胀");
const snap = run.snapshot();
ok(snap != null && snap.v === 10, "新存档 schema v10");
ok((snap?.hirePool.length ?? 0) === 9, "存档保留未投雇佣池");
ok((snap?.hireInflation.reduce((a, b) => a + b, 0) ?? 0) === 10, "存档保留整局通胀计数");

const midDropRun = new M.RogueRun({
  loadout: ["tier1", "tier2", "tier3"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 20260804,
});
ok(midDropRun.confirmHiring(), "投放续局测试进入首班");
const midDropSpecies = midDropRun.nextCarried()?.species;
ok(midDropSpecies != null && midDropRun.onThrow(9901, midDropSpecies), "投放续局测试抛出一只咕噜");
midDropRun.registerSnapshots({
  bodies: () => [{
    uid: 9901,
    species: midDropSpecies,
    elements: metas[midDropSpecies].elements,
    x: 320,
    y: 180,
    r: 28,
    settled: false,
  }],
  desks: () => [],
});
const midDropSnap = midDropRun.snapshot();
eq(midDropSnap?.bodies.length, 0, "退出时不把投放中的咕噜固化为空中塔体");
eq(midDropSnap?.bodyEconomy.length, 0, "投放中的临时实体不残留在续局账本");
eq(midDropSnap?.hirePool[0]?.species, midDropSpecies, "投放中的咕噜退回续局投放队首");
const resumedMidDrop = M.RogueRun.restore(midDropSnap, metas);
eq(resumedMidDrop?.nextCarried()?.species, midDropSpecies, "续局后可重新投放退出时悬空的咕噜");

console.log("== 成就单局事实可续局");
const factRun = new M.RogueRun({
  loadout: ["tier1", "tier2", "tier3"],
  meta: metas,
  deskOrder: ["fire", "water", "grass", "electric", "ice", "normal"],
  seed: 424242,
});
factRun.registerSnapshots({ bodies: () => [], desks: () => [] });
ok(factRun.confirmHiring(), "事实测试局进入首班");
factRun.onStrike([], "tier1");
factRun.onStrike([], "tier1");
factRun.onStrike([], "tier1");
factRun.debugEndShift();
ok(factRun.confirmSettlement(), "三次罢工后仍成功通过本班");
ok(factRun.view().strikeClearEver, "同一班三次罢工后通过写入单局事实");
const cashBeforeLoan = factRun.view().cash;
factRun.debugGrantCard("staff.loan");
eq(factRun.view().cash - cashBeforeLoan, factRun.view().kpi * 3, "贷款立即获得 300% KPI 现金");
eq(
  M.FACTORY_ROGUE["zh-Hans"].cards["staff.loan"].desc(1),
  "立得 3x KPI；后 3 班各还 35% 本金（共 1.05x）",
  "贷款商店卡牌用短倍率显示",
);
eq(
  [M.CFG.LOAN_GAIN_RATE, M.CFG.LOAN_REPAY_RATE, M.CFG.LOAN_TOTAL_REPAY_RATE, M.CFG.LOAN_SHIFTS],
  [3, 0.35, 1.05, 3],
  "贷款连续 3 班各偿还本金 35%，总还款 105%",
);
eq(factRun.view().loan, { perShift: 84, remaining: 252, shiftsLeft: 3 }, "首班按 KPI 80 贷款 240，还款计划固定为 84/84/84");
ok(factRun.view().boughtCardEver, "购卡事实不会因卡牌是否常驻而丢失");
ok(factRun.view().usedLoanEver, "贷款还清前后都保留曾用贷款事实");
const factSnap = factRun.snapshot();
const factResumed = factSnap == null ? null : M.RogueRun.restore(factSnap, metas);
ok(factResumed?.view().strikeClearEver, "续局保留罢工后过班事实");
ok(factResumed?.view().usedLoanEver, "续局保留贷款使用史");

console.log("== 贷款还款结算与临界破产原子性");
factRun.phase = "shift";
factRun.shopOffer = null;
factRun.viewCache = null;
factRun.bump();
const exactLoanPayment = factRun.view().loan.perShift;
const exactRequired = factRun.view().bill + exactLoanPayment;
const remainingKpiPotential = Math.max(0, factRun.view().kpi - factRun.view().revenueShift);
factRun.debugSetCash(Math.max(0, factRun.view().bill - remainingKpiPotential));
ok(factRun.view().dangerBankrupt, "破产预警把本期贷款计入必要支付，不会在班中误报安全");
factRun.debugSetCash(exactRequired);
factRun.debugEndShift();
eq(factRun.view().settlement.loanPayment, exactLoanPayment, "工资单明确冻结本班贷款还款额");
eq(factRun.view().settlement.requiredPayment, exactRequired, "工资单明确冻结账单加贷款总应付");
eq(factRun.view().settlement.cashAfterPayment, 0, "刚好足额时工资单预测最终余额为零");
ok(factRun.confirmSettlement(), "现金刚好覆盖账单和贷款时原子支付成功");
eq(factRun.view().cash, 0, "足额原子支付后余额恰好归零");
eq(factRun.view().loan, { perShift: 84, remaining: 168, shiftsLeft: 2 }, "首期还款只推进一次贷款计划");

factRun.phase = "shift";
factRun.shopOffer = null;
factRun.viewCache = null;
factRun.bump();
const shortLoanPayment = factRun.view().loan.perShift;
const shortRequired = factRun.view().bill + shortLoanPayment;
factRun.debugSetCash(shortRequired - 1);
factRun.debugEndShift();
const cashBeforeShortfall = factRun.view().cash;
const loanBeforeShortfall = factRun.view().loan;
eq(factRun.view().settlement.shortfall, 1, "只差 1 元时工资单明确显示 1 元缺口");
ok(!factRun.confirmSettlement(), "只差 1 元时拒绝必要支付并进入破产");
eq(factRun.view().phase, "bankrupt", "贷款临界不足进入破产结算");
eq(factRun.view().cash, cashBeforeShortfall, "必要支付失败不会先部分扣除账单");
eq(factRun.view().loan, loanBeforeShortfall, "必要支付失败不会推进贷款期数或已还金额");

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
