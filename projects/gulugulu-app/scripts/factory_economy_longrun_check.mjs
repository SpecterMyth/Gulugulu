import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSync } from "esbuild";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const entrySource = `
export * as CFG from "./src/game/factory/rogueConfig";
export { cardPrice } from "./src/game/factory/rogueShop";
export { settlementIncomeFlows } from "./src/game/factory/rogueTypes";
`;
const { outputFiles } = buildSync({
  stdin: { contents: entrySource, resolveDir: appDir, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
});
const bundlePath = resolve(appDir, "node_modules", ".cache", "factory-economy-longrun.bundle.mjs");
mkdirSync(dirname(bundlePath), { recursive: true });
writeFileSync(bundlePath, outputFiles[0].text);
const { CFG, cardPrice, settlementIncomeFlows } = await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);

const checks = [];
const check = (condition, name, details = undefined) => {
  checks.push({ name, pass: Boolean(condition), ...(details == null ? {} : { details }) });
};
const safeValue = (value) => Number.isSafeInteger(value) && value >= 0 && value <= CFG.FACTORY_VALUE_CAP;

let legacyKpi = CFG.KPI_BY_SHIFT[CFG.TOTAL_SHIFTS];
let firstLegacyBackendRejectionShift = null;
let firstLegacyInfinityShift = null;
for (let shift = CFG.TOTAL_SHIFTS + 1; shift <= 1_000; shift++) {
  legacyKpi *= CFG.KPI_RATE_LATE + 0.03 * (shift - CFG.TOTAL_SHIFTS);
  if (firstLegacyBackendRejectionShift == null && legacyKpi > CFG.FACTORY_VALUE_CAP) {
    firstLegacyBackendRejectionShift = shift;
  }
  if (!Number.isFinite(legacyKpi)) {
    firstLegacyInfinityShift = shift;
    break;
  }
}

const sampleShifts = [20, 30, 40, 46, 47, 60, 120, 398, 10_000];
const shiftSamples = sampleShifts.map((shift) => {
  const kpi = CFG.kpiForShift(shift);
  const bonus = CFG.kpiBonusFor(kpi);
  const skipRefund = CFG.clampFactoryValue(CFG.SHOP_SKIP_REFUND_RATE * kpi);
  const loanPrincipal = CFG.clampFactoryValue(CFG.LOAN_GAIN_RATE * kpi);
  const loanPayment = CFG.clampFactoryValue(CFG.LOAN_REPAY_RATE * loanPrincipal);
  const nextFiveHireCostByTier = {};
  for (let tier = 1; tier <= 6; tier++) {
    const alreadyHired = Math.max(0, (shift - 1) * 5);
    const prices = Array.from({ length: 5 }, (_, index) => CFG.hirePrice({
      tierCount: tier,
      kpi,
      hiredThisShift: alreadyHired + index,
    }));
    nextFiveHireCostByTier[tier] = {
      prices,
      total: CFG.addFactoryValues(...prices),
      affordableFromMaximumCash: prices.reduce((remaining, price) => (
        remaining != null && price <= remaining ? remaining - price : null
      ), CFG.FACTORY_VALUE_CAP) != null,
    };
  }
  return {
    shift,
    kpi,
    bonus,
    bill: CFG.billForShift(shift, "none"),
    threeSkipRefunds: CFG.addFactoryValues(skipRefund, skipRefund, skipRefund),
    loanPrincipal,
    loanPayment,
    billPlusLoanPayment: CFG.addFactoryValues(kpi, loanPayment),
    nextFiveHireCostByTier,
  };
});

const baselineTierEfficiency = [1, 2, 3, 4, 5, 6].map((tier) => {
  const deskMultiplier = [0, 1, 2, 4, 8, 12, 16][tier];
  const score = CFG.BASE_VALUE_BY_TIER[tier] * deskMultiplier;
  return {
    tier,
    baseValue: CFG.BASE_VALUE_BY_TIER[tier],
    deskMultiplier,
    score,
    hireBase: CFG.HIRE_BASE[tier],
    scorePerHireBase: score / CFG.HIRE_BASE[tier],
  };
});

const strategySamples = [1, 5, 10, 15, 20, 30, 47].map((shift) => {
  const kpi = CFG.kpiForShift(shift);
  const skipRefund = CFG.clampFactoryValue(CFG.SHOP_SKIP_REFUND_RATE * kpi);
  const rerollCosts = Array.from({ length: 4 }, (_, count) => CFG.shopRerollCost(kpi, count));
  const rerollThenSkipNet = rerollCosts.map((_, count) => (
    skipRefund - CFG.addFactoryValues(...rerollCosts.slice(0, count + 1))
  ));
  const loanPrincipal = CFG.clampFactoryValue(CFG.LOAN_GAIN_RATE * kpi);
  const loanTotalDue = CFG.clampFactoryValue(CFG.LOAN_TOTAL_REPAY_RATE * loanPrincipal);
  const regularInstallment = CFG.clampFactoryValue(CFG.LOAN_REPAY_RATE * loanPrincipal);
  const loanInstallments = [
    regularInstallment,
    regularInstallment,
    Math.max(0, loanTotalDue - regularInstallment * 2),
  ];
  const sampleHirePrice = CFG.hirePrice({ tierCount: 3, kpi, hiredThisShift: Math.max(0, shift - 1) });
  const maximumDismissRefund = Math.floor(sampleHirePrice * CFG.REFUND_HARD_CAP);
  return {
    shift,
    kpi,
    skipRefund,
    threeSkipRefunds: CFG.addFactoryValues(skipRefund, skipRefund, skipRefund),
    rerollCosts,
    rerollThenSkipNet,
    loanPrincipal,
    loanTotalDue,
    loanInterest: loanTotalDue - loanPrincipal,
    loanInstallments,
    sampleHirePrice,
    maximumDismissRefund,
    hireDismissCycleNet: maximumDismissRefund - sampleHirePrice,
  };
});

const bulkDepartureSamples = [1, 20, 47].map((shift) => {
  const kpi = CFG.kpiForShift(shift);
  const refunds = Array.from({ length: 200 }, (_, index) => CFG.hirePrice({
    tierCount: 1 + (index % 6),
    kpi,
    hiredThisShift: index,
  }));
  const nominalRefundTotal = CFG.addFactoryValues(...refunds);
  const walletBefore = CFG.FACTORY_VALUE_CAP - 7;
  const creditedAtCeiling = Math.min(nominalRefundTotal, CFG.FACTORY_VALUE_CAP - walletBefore);
  return {
    shift,
    workers: refunds.length,
    refunds,
    nominalRefundTotal,
    walletBefore,
    creditedAtCeiling,
    walletAfter: CFG.addFactoryValues(walletBefore, creditedAtCeiling),
  };
});

const capShift = shiftSamples.find((sample) => sample.kpi === CFG.FACTORY_KPI_CAP)?.shift ?? null;
check(firstLegacyBackendRejectionShift === 51, "legacy curve crossed backend score cap at shift 51", {
  firstLegacyBackendRejectionShift,
});
check(firstLegacyInfinityShift === 399, "legacy curve became Infinity at shift 399", { firstLegacyInfinityShift });
check(capShift === 60, "new KPI curve caps before unsafe integer growth", { capShift });
check(
  shiftSamples.every((sample) => [
    sample.kpi,
    sample.bonus,
    sample.bill,
    sample.threeSkipRefunds,
    sample.loanPrincipal,
    sample.loanPayment,
    sample.billPlusLoanPayment,
  ].every(safeValue)),
  "all sampled KPI, bill, bonus, refund, and loan values are safe integers",
);
check(
  shiftSamples.every((sample) => Object.values(sample.nextFiveHireCostByTier).every((tier) => (
    tier.prices.every(safeValue) && safeValue(tier.total)
  ))),
  "all sampled cumulative hire prices remain serializable",
);
check(
  shiftSamples.filter((sample) => sample.shift >= 47).every((sample) => (
    sample.billPlusLoanPayment < CFG.FACTORY_VALUE_CAP
  )),
  "KPI cap leaves enough numeric headroom to pay a bill and one loan installment",
);
check(
  CFG.CARD_DEFS.every((def) => safeValue(cardPrice(def, Math.max(0, (def.maxLevel ?? 5) - 1), CFG.FACTORY_KPI_CAP))),
  "every legal maximum-level card quote is bounded",
);
check(CFG.factoryValueString(Infinity) === String(CFG.FACTORY_VALUE_CAP), "achievement string conversion rejects Infinity");
check(CFG.clampFactoryValue(undefined) === 0, "missing snapshot values recover to zero rather than maximum cash");
check(CFG.addFactoryValues(CFG.FACTORY_VALUE_CAP - 10, 100) === CFG.FACTORY_VALUE_CAP, "positive additions saturate deterministically");
check(
  strategySamples.every((sample) => sample.rerollThenSkipNet.every((net) => net < sample.skipRefund)),
  "rerolling before a skip never improves cash over skipping immediately",
);
check(
  strategySamples.every((sample) => CFG.addFactoryValues(...sample.loanInstallments) === sample.loanTotalDue),
  "three loan installments exactly match the disclosed total debt",
);
check(
  strategySamples.every((sample) => sample.loanInterest > 0 && sample.loanInterest <= CFG.clampFactoryValue(sample.kpi * 0.16)),
  "loan interest stays positive and near the intended fifteen-percent-of-KPI cost",
);
check(
  strategySamples.every((sample) => sample.hireDismissCycleNet === 0),
  "a maximum manual dismissal refund is cash-neutral before card acquisition cost",
);
check(
  strategySamples.every((sample) => sample.threeSkipRefunds < CFG.kpiBonusFor(sample.kpi)),
  "three shop skips remain below the KPI completion bonus",
);
check(
  bulkDepartureSamples.every((sample) => sample.refunds.length === 200 && sample.refunds.every(safeValue)),
  "200-worker mixed-tier departure quotes remain safe integers",
);
check(
  bulkDepartureSamples.every((sample) => safeValue(sample.nominalRefundTotal)),
  "200-worker refund totals saturate deterministically without overflow",
);
check(
  bulkDepartureSamples.every((sample) => sample.creditedAtCeiling === 7 && sample.walletAfter === CFG.FACTORY_VALUE_CAP),
  "near the wallet ceiling departure feedback is limited to the amount actually credited",
);
check(
  settlementIncomeFlows([
    { kind: "hire", amount: -30 },
    { kind: "reroll", amount: -6 },
    { kind: "refund", amount: 5 },
  ]).length === 1,
  "settlement income rows exclude hiring and reroll spending",
);

const efficiencyValues = baselineTierEfficiency.map((row) => row.scorePerHireBase);
const report = {
  generatedAt: new Date().toISOString(),
  mode: "analytic boundary simulation using bundled production economy functions",
  caps: {
    value: CFG.FACTORY_VALUE_CAP,
    kpi: CFG.FACTORY_KPI_CAP,
    kpiShareOfValueCap: CFG.FACTORY_KPI_CAP / CFG.FACTORY_VALUE_CAP,
  },
  legacyFailureBoundaries: { firstLegacyBackendRejectionShift, firstLegacyInfinityShift },
  baselineTierEfficiency,
  baselineEfficiencySpread: Math.max(...efficiencyValues) / Math.min(...efficiencyValues),
  strategySamples,
  bulkDepartureSamples,
  shiftSamples,
  checks,
  summary: {
    checks: checks.length,
    passed: checks.filter((item) => item.pass).length,
    failed: checks.filter((item) => !item.pass).length,
  },
};

const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && process.argv[outIndex + 1]) {
  const outputPath = resolve(process.cwd(), process.argv[outIndex + 1]);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
if (report.summary.failed > 0) process.exitCode = 1;
