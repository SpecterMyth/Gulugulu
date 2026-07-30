// 《危楼打工记》权威数值单源(docs/gdd/factory_working/02-numbers.md · 03-upgrades.md)。
// 全部 v0 调参基准;改数只改这里,并对照 02 §6 不变量。

import type { CardDef, RogueElement, ShiftModifier } from "./rogueTypes";

// ---- 局结构 -----------------------------------------------------------------

export const TOTAL_SHIFTS = 20;
export const START_CASH = 150;
export const KPI_START = 80;
/** KPI 达标即发放的绩效奖金；金额按当班 KPI 四舍五入到整数。 */
export const KPI_BONUS_RATE = 0.3;
export const QUOTA_START = 20;
export const QUOTA_PER_SHIFT = 5;
export const LOADOUT_MIN = 3;
export const LOADOUT_MAX = 10;

/** 无限模式在第 20 班后的基础增长率；每多一班再增加 0.03。 */
export const KPI_RATE_LATE = 1.46;

/**
 * 标准 20 班 KPI 权威表。
 * 第 1~5 班从 80 平滑增长到 1000，第 6~10 班再平滑增长到 1 万；
 * 第 10 班起约按 ×2.154 快速增长，
 * 第 19 班锚定 1000 万，第 20 班终局锚定 5000 万。
 */
export const KPI_BY_SHIFT = [
  0,
  80,
  150,
  280,
  530,
  1_000,
  1_600,
  2_500,
  4_000,
  6_300,
  10_000,
  21_544,
  46_416,
  100_000,
  215_443,
  464_159,
  1_000_000,
  2_154_435,
  4_641_589,
  10_000_000,
  50_000_000,
] as const;

/** 标准班读取权威表；无限模式从 5000 万继续按递增倍率复合增长。 */
export function kpiForShift(shift: number): number {
  const normalizedShift = Math.max(1, Math.round(shift));
  if (normalizedShift <= TOTAL_SHIFTS) return KPI_BY_SHIFT[normalizedShift] ?? KPI_START;

  let kpi = KPI_BY_SHIFT[TOTAL_SHIFTS];
  for (let k = TOTAL_SHIFTS + 1; k <= normalizedShift; k++) {
    const m = k - TOTAL_SHIFTS;
    kpi *= KPI_RATE_LATE + 0.03 * m;
  }
  return Math.round(kpi);
}

export function kpiBonusFor(kpi: number): number {
  return Math.max(0, Math.round(kpi * KPI_BONUS_RATE));
}

/** 账单与 KPI 使用同一个权威值：达标收入用于交账单，可支配增量主要来自加班时间。 */
export const BILL_RATE = 1;
export const BILL_RATE_AUDIT = 1;

/** 检查日:5 赶工 / 10 限电 / 15 大风 / 20 决算;无限模式每 5 班循环随机。 */
export function modifierForShift(shift: number, rng: () => number): ShiftModifier {
  if (shift <= TOTAL_SHIFTS) {
    if (shift === 5) return "rush";
    if (shift === 10) return "power";
    if (shift === 15) return "wind";
    if (shift === 20) return "audit";
    return "none";
  }
  if ((shift - TOTAL_SHIFTS) % 5 !== 0) return "none";
  const pool: ShiftModifier[] = ["rush", "power", "wind", "audit"];
  return pool[Math.floor(rng() * pool.length)] ?? "none";
}

export function billForShift(shift: number, modifier: ShiftModifier): number {
  void modifier;
  return kpiForShift(shift);
}

// ---- 检查日参数 -------------------------------------------------------------

export const RUSH_WALL_MS = 150_000; // 赶工日墙钟
export const FINAL_RUSH_WALL_MS = 300_000; // 第 20 班复合检查：5 分钟
export const RUSH_TRICKLE_RATE = 0; // 赶工必须主动投放，不再挂机滴入
/**
 * 限电日每班可用的手动投放次数。
 * 常规构筑约 3～6 次投放达标；12 次给弱构筑/失投约 2～3 倍容错，
 * 同时仍会迫使玩家珍惜每次出手。KPI 达标后的自动加班不计入。
 */
export const POWER_THROW_LIMIT = 12;
export const FINAL_POWER_THROW_LIMIT = 20; // 第 20 班复合检查：20 投
export const WIND_RATIO = 0.65; // 大风日:横向风加速度 = 空投横速的 ±65%，一次下落即可看出明显偏航
export const WIND_FLIP_MS = 20_000;

/** 第 20 班 audit 同时承载赶工、限电和大风三条规则。 */
export function hasRushRule(modifier: ShiftModifier): modifier is "rush" | "audit" {
  return modifier === "rush" || modifier === "audit";
}

export function hasPowerRule(modifier: ShiftModifier): modifier is "power" | "audit" {
  return modifier === "power" || modifier === "audit";
}

export function hasWindRule(modifier: ShiftModifier): modifier is "wind" | "audit" {
  return modifier === "wind" || modifier === "audit";
}

export function rushWallMsFor(modifier: ShiftModifier): number {
  return modifier === "audit" ? FINAL_RUSH_WALL_MS : RUSH_WALL_MS;
}

export function powerThrowLimitFor(modifier: ShiftModifier): number {
  return modifier === "audit" ? FINAL_POWER_THROW_LIMIT : POWER_THROW_LIMIT;
}

// ---- 雇佣定价(六工种 · KPI 锚定 · 整局累计通胀) ----------------------------

/** 工种 = 元素数(1~6)→ 基准系数(% KPI/100)。
 *  v1 调参:全线下调(v0 的 4~42 → 2.5~17)且高工种相对压得更狠——
 *  常规卡组的死法应是「名额投满仍不达标」,现金雇不起只留给高工种极端卡组(02 §6-8)。 */
export const HIRE_BASE = [0, 3, 4.2, 6, 8.5, 12, 16] as const; // 下标=工种
export const HIRE_INFLATION = [0, 1.02, 1.03, 1.04, 1.05, 1.06, 1.07] as const;
export const HIRING_CANDIDATE_COUNT = 10;
/** 每轮最多实际选择 10 名；人才市场只扩大候选面，不扩大单轮录用上限。 */
export const HIRING_PICK_LIMIT = 10;
export const HIRING_REROLL_RATES = [0.05, 0.08, 0.11, 0.14, 0.17, 0.2, 0.23, 0.26, 0.29, 0.32] as const;

/** 雇价 = 基准 × KPI/100 × 通胀^(本班该工种已雇数);临时工/冻价/压价在调用处生效。 */
export function hirePrice(args: {
  tierCount: number;
  kpi: number;
  hiredThisShift: number;
  inflationOverride?: number;
  baseCut?: number; // 压价:基准 ×(1-0.25-…)
}): number {
  const t = Math.min(6, Math.max(1, args.tierCount));
  const base = HIRE_BASE[t] * (args.baseCut != null ? 1 - args.baseCut : 1);
  const infl = args.inflationOverride ?? HIRE_INFLATION[t];
  return Math.max(1, Math.round(((base * args.kpi) / 100) * Math.pow(infl, args.hiredThisShift)));
}

// ---- 大风 -------------------------------------------------------------------
/** 空投横速近似值(px/s):大风日横向风加速度 = ±此值 × WIND_RATIO。 */
export const WIND_DROP_SPEED = 240;

// ---- 脉冲常量 ---------------------------------------------------------------

/** 每只被传导/压榨咕噜默认贡献 100% 有效基础分。 */
export const ABSORB_FACTOR = 1;
export const COMBO_PER_STACK = 0.03;
export const COMBO_CAP = 0.3;
export const STRIKE_LINE_DEFAULT = 3;
/** 下标 = 元素数/工种；多元素以更低基础分换取接多桌与连携空间。 */
export const BASE_VALUE_BY_TIER = [0, 15, 12, 9, 6, 4, 3] as const;
export const DEFAULT_BASE_VALUE = BASE_VALUE_BY_TIER[1];

export function baseValueForTier(tierCount: number): number {
  const tier = Math.min(6, Math.max(1, Math.round(tierCount)));
  return BASE_VALUE_BY_TIER[tier];
}

// ---- 商店 -------------------------------------------------------------------

export const SHOP_PICKS = 3;
export const CARD_PRICE_RATE: Record<string, number> = { common: 0.07, rare: 0.12, epic: 0.2 };
/** 同名卡每升一级，下一次购买价变为上一级的 1.5 倍。 */
export const CARD_LEVEL_PRICE_MULTIPLIER = 1.5;
export const SHOP_REROLL_RATE = 0.07;
/** 班末商店的下一次刷新价：基础价随该维度已刷新次数逐次翻倍。 */
export function shopRerollCost(kpi: number, rerollCount: number): number {
  return Math.round(SHOP_REROLL_RATE * kpi * (2 ** Math.max(0, rerollCount)));
}
/** 跳过一维返 8% KPI：没钱时连续跳过仍能换来下一维的一张普通强化。 */
export const SHOP_SKIP_REFUND_RATE = 0.08;
/** 贷款:立得 100% 当前 KPI 本金;其后 3 班各还本金 35%，总还款 105%。 */
export const LOAN_GAIN_RATE = 1;
export const LOAN_REPAY_RATE = 0.35;
export const LOAN_TOTAL_REPAY_RATE = 1.05;
export const LOAN_SHIFTS = 3;

// ---- 卡牌数值参数（在售卡全部与 CARD_DEFS 对齐；末尾保留少量旧存档只读参数） ----

/** 卡牌等级表统一读取；所有非一次性数值卡最多展示到 Lv.5。 */
export function valueAtLevel(values: readonly number[], level: number): number {
  const index = Math.min(values.length, Math.max(1, Math.round(level))) - 1;
  return values[index];
}

export const CARD_PARAMS = {
  // 维度一 · 火
  "fire.burst": { repeats: [1, 2, 4, 8, 16] },
  "fire.ember": { asAbsorbed: [2, 4, 8, 16, 32] },
  "fire.wildfire": { spread: [2, 4, 8, 16, 32] },
  "fire.chain": { reachBonus: [1, 3, 6, 12, 20] }, // 火链:火宠连通链
  // 电
  "electric.overload": { perDepth: [0.25, 0.5, 1, 2, 4] },
  "electric.wire": { reachBonus: [2, 5, 9, 14, 20] }, // 导线:电宠吸取层数（元素特色溢价）
  // 分流显示真实连通桌数；并联只奖励第一张之外的桌，按固定比例线性增长。
  "electric.parallel": { perExtraDesk: [0.5, 1, 2, 4, 8] },
  "electric.induction": { perLink: [0.1, 0.2, 0.4, 0.8, 1.6] },
  // 冰
  "ice.freezeprice": { priceMult: [0.9, 0.75, 0.6, 0.4, 0.2] },
  "ice.freeze": { chance: [0.3, 0.5, 0.7, 0.9, 1] },
  "ice.overstaff": { per: [0.2, 0.5, 1, 2, 4] },
  "ice.chain": { reachBonus: [1, 3, 6, 12, 20] }, // 冰桥:冰宠连通链
  // 水
  "water.fourday": { line: [5, 7, 9, 12, 16], strikeBonus: [2, 4, 8, 16, 32] },
  "water.same": { perTeamSame: [1.1, 1.2, 1.35, 1.6, 2] },
  "water.convert": { targets: [1, 2, 3, 5, 8] },
  "water.chain": { reachBonus: [1, 3, 6, 12, 20] }, // 水道:水宠连通链
  // 草
  "grass.grow": { chance: [0.17, 0.35, 0.6, 0.82, 1] },
  // 繁茂 = 当前连成一片的咕噜数，每只提供固定加成，不再每 5 只跳一档。
  "grass.crowd": { perConnected: [0.08, 0.18, 0.4, 0.8, 1.6] },
  "grass.height": { perLayer: [0.1, 0.22, 0.45, 1, 2], cap: 34 },
  "grass.chain": { reachBonus: [1, 3, 6, 12, 20] }, // 藤链:草宠连通链
  // 一般
  "normal.absorb": { chance: [0.3, 0.6, 1, 1, 1], targets: [1, 1, 1, 2, 3] },
  "normal.gluttony": { perSize: [0.5, 1, 2, 4, 8] },
  "normal.emperor": { grow: [1, 2, 3, 5, 8] },
  "normal.chain": { reachBonus: [1, 3, 6, 10, 15] }, // 人脉:一般宠连通链
  // 维度二 · 属性数 + 编制/财务混合池
  "attr.pure": { mult: [1.65, 2.5, 4.5, 8, 14], count: 1 },
  "attr.dual": { mult: [1.65, 2.5, 4.5, 8, 14], count: 2 },
  "attr.slash": { mult: [2, 3.5, 7, 12, 21], count: 3 },
  "attr.hex": { perElement: [0.5, 1, 2, 4, 8], minCount: 4 },
  "attr.balance": { mult: [5, 10, 20, 40, 80] }, // 六工种各≥1在场
  // 维度三 · 两系连携。全部为史诗品质：Lv.1 立即形成跨系构筑，Lv.5 解锁巅峰规则。
  "syn.arcIgnite": { perDesk: [0.5, 1, 2, 4, 8] },
  "syn.thermalShock": { echo: [3, 6, 12, 24, 60] },
  "syn.steamBurst": { perSame: [1, 2, 4, 8, 16] },
  "syn.greenhouse": { chance: [0.5, 0.7, 0.85, 1, 1], growCopies: [1, 1, 1, 1, 2] },
  "syn.fireDispatch": { perMass: [1, 2, 4, 8, 16] },
  "syn.superconduct": { perFrozen: [0.5, 1, 2, 4, 8] },
  "syn.short": { burst: [3, 6, 12, 24, 60] },
  "syn.bionet": { perGenerated: [0.3, 0.6, 1.2, 2.5, 6], cap: 12, generatedWeight: [1, 1, 1, 1, 2] },
  "syn.lightningrod": { perMass: [0.5, 1, 2, 4, 8] },
  "syn.iceMirror": { perFrozenSame: [1, 2, 4, 8, 16] },
  "syn.permafrost": { perCrossEdge: [0.25, 0.5, 1, 2.5, 6], cap: [4, 6, 8, 12, 99], componentAtMax: true },
  "syn.coldRotation": { perMass: [0.5, 1, 2, 4, 8] },
  "syn.irrigation": { chanceMult: [2, 4, 8, 16, 32], growCopies: [1, 1, 1, 1, 3] },
  "syn.badge": { mult: [2, 4, 8, 16, 32] },
  "syn.multiSeed": { inheritMass: [0.35, 0.5, 0.7, 1, 1.5] },
  // 旧存档/旧文案兼容参数：不再进入 CARD_DEFS，不会出现在新商店。
  "ice.icicle": { above: [1.7, 1.95, 2.3, 2.8, 3.5] },
  "ice.prism": { extraShare: [0.3, 0.5, 0.75, 1.05, 1.5] },
  "water.reflow": { refund: [0.6, 0.7, 0.78, 0.85, 0.9] },
  "water.reservoir": { interest: [0.15, 0.19, 0.24, 0.3, 0.38] },
  "grass.root": { deskMult: [1.8, 2.05, 2.35, 2.75, 3.4] },
  "grass.symbiosis": { perNeighbor: [0.6, 0.75, 0.92, 1.12, 1.4] },
  "grass.growth": { perShift: [0.4, 0.52, 0.68, 0.9, 1.2], capX: [5, 5.5, 6.2, 7.2, 9] },
  "normal.crowd": { per5: [0.25, 0.32, 0.4, 0.5, 0.65] },
  "normal.temp": { inflation: [1.004, 1] },
  "normal.jack": {},
  "normal.tags": { count: [1, 2, 3, 4, 5] },
  "normal.overlap": { perSlot: [0.18, 0.4, 0.8, 1.8, 3.6] },
  "normal.dispatch": { count: [1, 2, 3, 4, 5] },
  "syn.steam": { aura: [2, 2.35, 2.75, 3.35, 4.2] },
  "syn.mudslide": {},
  // 元素系列 · 基础培训（固定基础分阶梯；多元素可叠加）
  "base.fire": { bonus: [2, 5, 10, 20, 40] },
  "base.water": { bonus: [2, 5, 10, 20, 40] },
  "base.grass": { bonus: [1, 3, 6, 12, 20] },
  "base.electric": { bonus: [2, 5, 10, 20, 40] },
  "base.ice": { bonus: [2, 5, 10, 20, 40] },
  "base.normal": { bonus: [2, 5, 10, 20, 40] },
  // 维度二 · 编制/财务
  "staff.fire3": { picks: 3 }, // 解雇(一次性)
  "staff.severance": { refund: [0.1, 0.2, 0.4, 0.7, 1] },
  "staff.movedesk": {}, // 搬桌(一次性)
  "staff.expand": { quota: 5 }, // 扩编
  "staff.talentmarket": { rerollsPerLevel: 1, candidatesPerLevel: 1 },
  "staff.backfill": { extraCandidates: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  "staff.loan": {}, // 贷款(免费)
  "staff.pricecut": { cut: [0.25, 0.4, 0.6, 0.8, 1] }, // 压价
} as const;

export type CardId = keyof typeof CARD_PARAMS;

/** 基础培训总加值：每个命中元素按 1/3/6/12/20 增加基础分，多元素角色可叠加。 */
export function baseTrainingBonus(elements: readonly string[], cards: Record<string, number>): number {
  let bonus = 0;
  for (const element of elements) {
    const id = `base.${element}` as CardId;
    const level = cards[id] ?? 0;
    const params = CARD_PARAMS[id];
    if (level > 0 && params != null && "bonus" in params) {
      bonus += valueAtLevel(params.bonus, level);
    }
  }
  return bonus;
}

/** 元素连通链总加值：一般系 1/3/6/10/15；电系 2/5/9/14/20；其余元素 1/3/6/12/20。多元素角色可叠加。 */
export function elementReachBonus(elements: readonly string[], cards: Record<string, number>): number {
  let bonus = 0;
  for (const element of elements) {
    const id = (element === "electric" ? "electric.wire" : `${element}.chain`) as CardId;
    const level = cards[id] ?? 0;
    const params = CARD_PARAMS[id];
    if (level > 0 && params != null && "reachBonus" in params) {
      bonus += valueAtLevel(params.reachBonus, level);
    }
  }
  return bonus;
}

export const CARD_DEFS: CardDef[] = [
  { id: "fire.burst", dim: 1, rarity: "common", element: "fire", maxLevel: 5 },
  { id: "fire.ember", dim: 1, rarity: "rare", element: "fire", requires: ["fire.burst"], maxLevel: 5 },
  {
    id: "fire.wildfire",
    dim: 1,
    rarity: "epic",
    element: "fire",
    requires: ["fire.burst"],
    maxLevel: 5,
  },
  { id: "fire.chain", dim: 1, rarity: "rare", element: "fire", maxLevel: 5 },
  { id: "base.fire", dim: 1, rarity: "common", element: "fire", maxLevel: 5 },
  { id: "electric.overload", dim: 1, rarity: "common", element: "electric", maxLevel: 5 },
  { id: "electric.wire", dim: 1, rarity: "rare", element: "electric", maxLevel: 5 },
  {
    id: "electric.parallel",
    dim: 1,
    rarity: "rare",
    element: "electric",
    requires: ["electric.overload"],
    maxLevel: 5,
  },
  {
    id: "electric.induction",
    dim: 1,
    rarity: "epic",
    element: "electric",
    requires: ["electric.wire", "electric.parallel"],
    maxLevel: 5,
  },
  { id: "base.electric", dim: 1, rarity: "common", element: "electric", maxLevel: 5 },
  { id: "ice.freezeprice", dim: 1, rarity: "common", element: "ice", maxLevel: 5 },
  { id: "ice.freeze", dim: 1, rarity: "rare", element: "ice", maxLevel: 5 },
  {
    id: "ice.overstaff",
    dim: 1,
    rarity: "epic",
    element: "ice",
    requires: ["ice.freeze"],
    maxLevel: 5,
  },
  { id: "ice.chain", dim: 1, rarity: "rare", element: "ice", maxLevel: 5 },
  { id: "base.ice", dim: 1, rarity: "common", element: "ice", maxLevel: 5 },
  { id: "water.fourday", dim: 1, rarity: "common", element: "water", maxLevel: 5 },
  {
    id: "water.same",
    dim: 1,
    rarity: "rare",
    element: "water",
    requires: ["water.fourday"],
    maxLevel: 5,
  },
  {
    id: "water.convert",
    dim: 1,
    rarity: "epic",
    element: "water",
    maxLevel: 5,
  },
  { id: "water.chain", dim: 1, rarity: "rare", element: "water", maxLevel: 5 },
  { id: "base.water", dim: 1, rarity: "common", element: "water", maxLevel: 5 },
  { id: "grass.grow", dim: 1, rarity: "common", element: "grass", maxLevel: 5 },
  {
    id: "grass.crowd",
    dim: 1,
    rarity: "rare",
    element: "grass",
    requires: ["grass.grow"],
    maxLevel: 5,
  },
  {
    id: "grass.height",
    dim: 1,
    rarity: "epic",
    element: "grass",
    requires: ["grass.grow", "grass.crowd"],
    maxLevel: 5,
  },
  { id: "grass.chain", dim: 1, rarity: "rare", element: "grass", maxLevel: 5 },
  { id: "base.grass", dim: 1, rarity: "common", element: "grass", maxLevel: 5 },
  { id: "normal.absorb", dim: 1, rarity: "common", element: "normal", maxLevel: 5 },
  {
    id: "normal.gluttony",
    dim: 1,
    rarity: "rare",
    element: "normal",
    requires: ["normal.absorb"],
    maxLevel: 5,
  },
  {
    id: "normal.emperor",
    dim: 1,
    rarity: "epic",
    element: "normal",
    requires: ["normal.absorb", "normal.gluttony"],
    maxLevel: 5,
  },
  { id: "normal.chain", dim: 1, rarity: "rare", element: "normal", maxLevel: 5 },
  { id: "base.normal", dim: 1, rarity: "common", element: "normal", maxLevel: 5 },
  { id: "attr.pure", dim: 2, rarity: "common", maxLevel: 5 },
  { id: "attr.dual", dim: 2, rarity: "common", maxLevel: 5 },
  { id: "attr.slash", dim: 2, rarity: "rare", maxLevel: 5 },
  { id: "attr.hex", dim: 2, rarity: "rare", maxLevel: 5 },
  { id: "attr.balance", dim: 2, rarity: "epic", maxLevel: 5 },
  {
    id: "syn.arcIgnite",
    dim: 3,
    rarity: "epic",
    pair: ["fire", "electric"],
    requires: ["fire.burst", "electric.overload"],
    maxLevel: 5,
  },
  {
    id: "syn.thermalShock",
    dim: 3,
    rarity: "epic",
    pair: ["fire", "ice"],
    requires: ["fire.burst", "ice.freeze"],
    maxLevel: 5,
  },
  {
    id: "syn.steamBurst",
    dim: 3,
    rarity: "epic",
    pair: ["fire", "water"],
    requires: ["fire.burst", "water.fourday"],
    maxLevel: 5,
  },
  {
    id: "syn.greenhouse",
    dim: 3,
    rarity: "epic",
    pair: ["fire", "grass"],
    requires: ["fire.burst", "grass.grow"],
    maxLevel: 5,
  },
  {
    id: "syn.fireDispatch",
    dim: 3,
    rarity: "epic",
    pair: ["fire", "normal"],
    requires: ["fire.burst", "normal.absorb"],
    maxLevel: 5,
  },
  {
    id: "syn.superconduct",
    dim: 3,
    rarity: "epic",
    pair: ["electric", "ice"],
    requires: ["electric.overload", "ice.freeze"],
    maxLevel: 5,
  },
  {
    id: "syn.short",
    dim: 3,
    rarity: "epic",
    pair: ["water", "electric"],
    requires: ["water.fourday", "electric.overload"],
    maxLevel: 5,
  },
  {
    id: "syn.bionet",
    dim: 3,
    rarity: "epic",
    pair: ["electric", "grass"],
    requires: ["electric.wire", "grass.grow"],
    maxLevel: 5,
  },
  {
    id: "syn.lightningrod",
    dim: 3,
    rarity: "epic",
    pair: ["electric", "normal"],
    requires: ["electric.overload", "normal.absorb"],
    maxLevel: 5,
  },
  {
    id: "syn.iceMirror",
    dim: 3,
    rarity: "epic",
    pair: ["ice", "water"],
    requires: ["ice.freeze", "water.fourday"],
    maxLevel: 5,
  },
  {
    id: "syn.permafrost",
    dim: 3,
    rarity: "epic",
    pair: ["ice", "grass"],
    requires: ["ice.freeze", "grass.grow"],
    maxLevel: 5,
  },
  {
    id: "syn.coldRotation",
    dim: 3,
    rarity: "epic",
    pair: ["ice", "normal"],
    requires: ["ice.freeze", "normal.absorb"],
    maxLevel: 5,
  },
  {
    id: "syn.irrigation",
    dim: 3,
    rarity: "epic",
    pair: ["water", "grass"],
    requires: ["water.same", "grass.grow"],
    maxLevel: 5,
  },
  {
    id: "syn.badge",
    dim: 3,
    rarity: "epic",
    pair: ["water", "normal"],
    requires: ["water.fourday", "normal.absorb"],
    maxLevel: 5,
  },
  {
    id: "syn.multiSeed",
    dim: 3,
    rarity: "epic",
    pair: ["grass", "normal"],
    requires: ["grass.grow", "normal.absorb"],
    maxLevel: 5,
  },
  { id: "staff.fire3", dim: 2, rarity: "common", oneShot: true },
  { id: "staff.severance", dim: 2, rarity: "rare", maxLevel: 5 },
  { id: "staff.movedesk", dim: 2, rarity: "common", oneShot: true },
  { id: "staff.expand", dim: 2, rarity: "common" },
  { id: "staff.talentmarket", dim: 2, rarity: "common", maxLevel: 5 },
  { id: "staff.backfill", dim: 2, rarity: "common", maxLevel: 10 },
  { id: "staff.loan", dim: 2, rarity: "common", oneShot: true, free: true },
  {
    id: "staff.pricecut",
    dim: 2,
    rarity: "rare",
    requires: ["staff.talentmarket"],
    maxLevel: 5,
  },
];

const ELEMENT_CARD_OWNER = new Map(
  CARD_DEFS
    .filter((card): card is CardDef & { element: RogueElement } => card.dim === 1 && card.element != null)
    .map((card) => [card.id, card.element]),
);

/**
 * 元素系列只在本次投放者拥有对应固有元素时生效。
 * 连携、属性数和编制卡保持原样；返回副本，避免改写局内持有等级。
 */
export function cardsForElementPlacement(
  elements: readonly string[],
  cards: Record<string, number>,
): Record<string, number> {
  const activeElements = new Set(elements);
  let scoped: Record<string, number> | null = null;
  for (const [id, element] of ELEMENT_CARD_OWNER) {
    if ((cards[id] ?? 0) <= 0 || activeElements.has(element)) continue;
    scoped ??= { ...cards };
    scoped[id] = 0;
  }
  return scoped ?? cards;
}

/** 返还类效果全局封顶(02 §6-6:禁止 ≥100% 的"雇了就退"循环)。 */
export const REFUND_HARD_CAP = 1;

// ---- 演出分档(04 §3:数字弹出) ---------------------------------------------

export const PULSE_TIERS = [
  { min: 0, cls: "t0" }, // 白
  { min: 50, cls: "t1" }, // 黄
  { min: 250, cls: "t2" }, // 橙+微震
  { min: 1_000, cls: "t3" }, // 红光+hit-stop
  { min: 10_000, cls: "t4" }, // 彩虹+速度线
] as const;

// ---- 桌序 -------------------------------------------------------------------

export function shuffleDeskOrder(rng: () => number): RogueElement[] {
  const arr: RogueElement[] = ["fire", "water", "grass", "electric", "ice", "normal"];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
