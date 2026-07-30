// 加班时间经济蒙特卡洛：模拟候选、通胀、KPI 同额账单、加班收入与商店支出。
// 跑法：node scripts/factory_economy_sim.mjs [局数]

const RUNS = Math.max(1000, Number(process.argv[2] ?? 10000));
const BASE = [0, 3, 4.2, 6, 8.5, 12, 16];
const BASE_SCORE = [0, 15, 12, 9, 6, 4, 3];
const INFLATION = [0, 1.02, 1.03, 1.04, 1.05, 1.06, 1.07];
const TIER_WEIGHTS = [0, 0.34, 0.25, 0.17, 0.11, 0.08, 0.05];
const REROLL_RATE = 0.07;
const KPI_BONUS_RATE = 0.3;
const KPI_START = 80;
const EARLY = { 2: 2.26875, 3: 1.62, 4: 1.6, 5: 1.58, 6: 1.56 };
const LATE = 1.46;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kpiForShift(shift) {
  let kpi = KPI_START;
  for (let n = 2; n <= shift; n++) kpi *= EARLY[n] ?? LATE;
  return Math.round(kpi);
}

function drawTier(rng) {
  let roll = rng();
  for (let tier = 1; tier <= 6; tier++) {
    roll -= TIER_WEIGHTS[tier];
    if (roll <= 0) return tier;
  }
  return 6;
}

function price(tier, kpi, counts) {
  return Math.max(1, Math.round((BASE[tier] * kpi / 100) * INFLATION[tier] ** counts[tier]));
}

const STRATEGIES = {
  cautious: { target: 4, firstTarget: 6, rerollChance: 0, shopRate: 0.16, lossRate: 0.05, manualRate: 0.72, overrun: [1.01, 1.06], maxTier: 3 },
  balanced: { target: 6, firstTarget: 8, rerollChance: 0.35, shopRate: 0.22, lossRate: 0.09, manualRate: 0.5, overrun: [1.03, 1.1], maxTier: 5 },
  aggressive: { target: 8, firstTarget: 10, rerollChance: 0.7, shopRate: 0.34, lossRate: 0.14, manualRate: 0.42, overrun: [1.05, 1.15], maxTier: 6 },
};

function simulate(seed, strategy) {
  const rng = mulberry32(seed);
  let cash = 150;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  let occupied = 0;
  let pool = 0;
  let quota = 20;
  const totals = { hire: 0, reroll: 0, bill: 0, bonus: 0, overtime: 0, shop: 0, kpi: 0, hired: 0, lost: 0 };
  let minAfterBillRate = Infinity;

  for (let shift = 1; shift <= 20; shift++) {
    const kpi = kpiForShift(shift);
    const bill = kpi;
    totals.kpi += kpi;
    const rounds = 1;
    // 加班角色会返池，因此策略目标是维持一个固定候班池，只补充本班手动消耗的缺口。
    const target = shift === 1 ? strategy.firstTarget : strategy.target;
    const needed = Math.max(0, target - pool);
    let candidates = Array.from({ length: 10 * rounds }, () => drawTier(rng));
    let rerollCost = 0;
    const desirable = candidates.filter((tier) => tier <= strategy.maxTier);
    for (let round = 0; round < rounds; round++) {
      if (needed > 0 && (rng() < strategy.rerollChance || desirable.length < needed)) {
        rerollCost += Math.round(kpi * REROLL_RATE);
      }
    }
    const ranked = candidates
      .map((tier, index) => ({ tier, index, score: price(tier, kpi, counts) / BASE_SCORE[tier] }))
      .sort((a, b) => a.score - b.score);
    const selected = ranked.slice(0, Math.min(needed, Math.max(0, quota - occupied)));
    let hireCost = 0;
    const virtual = counts.slice();
    for (const c of selected) {
      hireCost += Math.max(1, Math.round((BASE[c.tier] * kpi / 100) * INFLATION[c.tier] ** virtual[c.tier]));
      virtual[c.tier]++;
    }

    // 现金不足时按最贵员工逆序缩编；仍无法覆盖 Reroll 时失败。
    while (selected.length > 0 && hireCost + rerollCost > cash) {
      const removed = selected.pop();
      virtual[removed.tier]--;
      hireCost -= Math.max(1, Math.round((BASE[removed.tier] * kpi / 100) * INFLATION[removed.tier] ** virtual[removed.tier]));
    }
    if (pool + selected.length === 0) return { cleared: shift - 1, reason: "pool_empty", totals, cash };
    if (cash < hireCost + rerollCost) return { cleared: shift - 1, reason: "recruitment_cash", totals, cash };

    cash -= hireCost + rerollCost;
    for (let tier = 1; tier <= 6; tier++) counts[tier] = virtual[tier];
    occupied += selected.length;
    pool += selected.length;
    totals.hire += hireCost;
    totals.reroll += rerollCost;
    totals.hired += selected.length;

    // 玩家手动投放一部分候班池达标；其余员工加班一次后原样返池。
    const deployed = Math.max(1, Math.min(pool, Math.ceil(target * strategy.manualRate)));
    pool -= deployed;
    const overtimeWorkers = pool;
    const lost = Array.from({ length: deployed }, () => rng() < strategy.lossRate).filter(Boolean).length;
    occupied -= lost;
    totals.lost += lost;

    // 该模拟聚焦经济而非物理命中；成功班按策略产生少量 KPI 溢出。
    const [lo, hi] = strategy.overrun;
    const overtime = Math.round((overtimeWorkers / deployed) * kpi * (1.05 + rng() * 0.2));
    const bonus = Math.round(kpi * KPI_BONUS_RATE);
    const revenue = Math.round(kpi * (lo + rng() * (hi - lo))) + bonus + overtime;
    cash += revenue;
    totals.bonus += bonus;
    totals.overtime += overtime;
    if (cash < bill) return { cleared: shift - 1, reason: "bill", totals, cash };
    cash -= bill;
    totals.bill += bill;
    quota += 5;
    minAfterBillRate = Math.min(minAfterBillRate, cash / kpi);

    const desiredShop = Math.round(kpi * strategy.shopRate);
    const reserve = Math.round(kpiForShift(Math.min(20, shift + 1)) * 0.18);
    const shop = Math.max(0, Math.min(desiredShop, cash - reserve));
    cash -= shop;
    totals.shop += shop;
  }
  return { cleared: 20, reason: "complete", totals, cash, minAfterBillRate, counts, occupied, pool };
}

function percentile(values, p) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

const report = {};
for (const [name, strategy] of Object.entries(STRATEGIES)) {
  const results = Array.from({ length: RUNS }, (_, i) => simulate(0x9e3779b9 ^ (i * 2654435761), strategy));
  const complete = results.filter((r) => r.cleared === 20);
  const sum = (key) => complete.reduce((acc, r) => acc + r.totals[key] / r.totals.kpi, 0) / Math.max(1, complete.length);
  report[name] = {
    runs: RUNS,
    completionRate: complete.length / RUNS,
    medianCleared: percentile(results.map((r) => r.cleared), 0.5),
    p10Cleared: percentile(results.map((r) => r.cleared), 0.1),
    avgHirePctKpi: sum("hire"),
    avgRerollPctKpi: sum("reroll"),
    avgBillPctKpi: sum("bill"),
    avgBonusPctKpi: sum("bonus"),
    avgOvertimePctKpi: sum("overtime"),
    avgShopPctKpi: sum("shop"),
    avgHiresPerShift: complete.reduce((a, r) => a + r.totals.hired / 20, 0) / Math.max(1, complete.length),
    avgPermanentLosses: complete.reduce((a, r) => a + r.totals.lost, 0) / Math.max(1, complete.length),
    medianEndingCash: percentile(complete.map((r) => r.cash), 0.5),
    failures: Object.fromEntries(
      [...new Set(results.filter((r) => r.cleared < 20).map((r) => r.reason))]
        .map((reason) => [reason, results.filter((r) => r.reason === reason).length]),
    ),
  };
}

console.log(JSON.stringify(report, null, 2));

const balanced = report.balanced;
if (
  balanced.completionRate < 0.9 ||
  balanced.avgHirePctKpi < 0.12 ||
  balanced.avgHirePctKpi > 0.45 ||
  balanced.avgRerollPctKpi > 0.08 ||
  balanced.avgShopPctKpi < 0.16
) {
  console.error("经济模拟未落入 GDD 目标带宽");
  process.exit(1);
}
