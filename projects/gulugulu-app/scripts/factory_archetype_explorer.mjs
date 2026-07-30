// Comprehensive archetype search for Office Stack-Up.
//
// Usage:
//   node scripts/factory_archetype_explorer.mjs [broad-runs] [final-runs] [finalists]
//
// The broad stage disables expensive per-card counterfactual contribution tracking,
// but still uses the current shop, pulse, hiring, error, strike, modifier and placement
// behavior model. Finalists are rerun with a larger independent sample.

import {
  ARCHETYPE_ROUTES,
  simulate,
} from "./factory_player_behavior_sim.mjs";
import { writeFileSync } from "node:fs";

const broadRuns = Math.max(12, Number.parseInt(process.argv[2] ?? "24", 10) || 24);
const finalRuns = Math.max(40, Number.parseInt(process.argv[3] ?? "120", 10) || 120);
const finalistCount = Math.max(
  5,
  Math.min(ARCHETYPE_ROUTES.length, Number.parseInt(process.argv[4] ?? "12", 10) || 12),
);
const compact = process.argv.includes("--compact");
const includeAllPairs = process.argv.includes("--all-pairs");
const pairsOnly = process.argv.includes("--pairs-only");
const routesToScan = pairsOnly
  ? ARCHETYPE_ROUTES.filter((route) => route.family === "pair")
  : ARCHETYPE_ROUTES;

function percentile(values, q) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((left, right) => left - right);
  const index = (sorted.length - 1) * q;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

function hashText(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seedFor(route, index, stageSalt) {
  return (
    0x7290_1
    ^ hashText(route.id)
    ^ Math.imul(index + 1, 0x9e37_79b1)
    ^ stageSalt
  ) >>> 0;
}

function aggregateCardBuys(results) {
  const rows = {};
  for (const result of results) {
    for (const [id, count] of Object.entries(result.cardOffers)) {
      const row = rows[id] ??= {
        offers: 0,
        buys: 0,
        buyers: 0,
        levels: 0,
        buyerClears: [],
      };
      row.offers += count;
    }
    for (const [id, count] of Object.entries(result.cardBuys)) {
      const row = rows[id] ??= {
        offers: 0,
        buys: 0,
        buyers: 0,
        levels: 0,
        buyerClears: [],
      };
      row.buys += count;
      row.buyers++;
      row.levels += result.cards[id] ?? 0;
      row.buyerClears.push(result.cleared);
    }
  }
  return Object.entries(rows)
    .map(([id, row]) => ({
      id,
      offers: row.offers,
      buys: row.buys,
      buyers: row.buyers,
      buyerRate: Number((row.buyers / results.length).toFixed(3)),
      takeRate: row.offers > 0 ? Number((row.buys / row.offers).toFixed(3)) : 0,
      meanFinalLevel: Number((row.levels / Math.max(1, row.buyers)).toFixed(2)),
      medianBuyerClear: Number(percentile(row.buyerClears, 0.5).toFixed(1)),
    }))
    .sort((left, right) => right.buyers - left.buyers || right.buys - left.buys);
}

function summarizeRoute(route, results) {
  const survival = (shift) => results.filter((result) => result.cleared >= shift).length / results.length;
  const completionRate = survival(20);
  const maxPulses = results.map((result) => result.maxPulse);
  const clears = results.map((result) => result.cleared);
  const failures = {};
  for (const result of results) {
    if (!result.completed) failures[result.reason] = (failures[result.reason] ?? 0) + 1;
  }
  const peakP50 = Math.round(percentile(maxPulses, 0.5));
  const peakP90 = Math.round(percentile(maxPulses, 0.9));
  const cardRows = aggregateCardBuys(results);
  const row = {
    id: route.id,
    family: route.family,
    elements: route.elements,
    loadout: results[0]?.loadout ?? [],
    runs: results.length,
    completionRate: Number(completionRate.toFixed(3)),
    survival5: Number(survival(5).toFixed(3)),
    survival10: Number(survival(10).toFixed(3)),
    survival15: Number(survival(15).toFixed(3)),
    clearP50: Number(percentile(clears, 0.5).toFixed(1)),
    clearP90: Number(percentile(clears, 0.9).toFixed(1)),
    peakP50,
    peakP90,
    peakP99: Math.round(percentile(maxPulses, 0.99)),
    peakVolatility: peakP50 > 0 ? Number((peakP90 / peakP50).toFixed(1)) : 0,
    revenueP90: Math.round(percentile(results.map((result) => result.revenue), 0.9)),
    medianErrors: Number(percentile(results.map((result) => result.errors), 0.5).toFixed(1)),
    medianStrikes: Number(percentile(results.map((result) => result.strikes), 0.5).toFixed(1)),
    failures,
    topCards: cardRows.slice(0, 10),
    synergyCards: cardRows.filter((card) => card.id.startsWith("syn.")),
  };
  row.score = Number((
    completionRate * 100_000
    + row.survival15 * 10_000
    + row.survival10 * 1_000
    + row.survival5 * 100
    + row.clearP90 * 2
    + Math.log10(Math.max(1, row.peakP90))
  ).toFixed(3));
  return row;
}

function runRoute(route, runs, stageSalt) {
  return Array.from({ length: runs }, (_, index) =>
    simulate("expert", seedFor(route, index, stageSalt), route, {
      trackContributions: false,
      fastMode: true,
    }));
}

const broadRows = routesToScan.map((route) =>
  summarizeRoute(route, runRoute(route, broadRuns, 0x1357_9bdf)));
broadRows.sort((left, right) => right.score - left.score);

const finalistIds = new Set(broadRows.slice(0, finalistCount).map((row) => row.id));
if (includeAllPairs) {
  for (const route of routesToScan) {
    if (route.family === "pair") finalistIds.add(route.id);
  }
}
const finalists = routesToScan.filter((route) => finalistIds.has(route.id));
const finalRows = finalists.map((route) =>
  summarizeRoute(route, runRoute(route, finalRuns, 0x2468_ace0)));
finalRows.sort((left, right) => right.score - left.score);

const broadOutput = compact
  ? broadRows.map(({ topCards, synergyCards, failures, loadout, ...row }) => row)
  : broadRows;
const finalOutput = compact
  ? finalRows.map((row) => ({
      ...row,
      topCards: row.topCards.slice(0, 7),
      synergyCards: row.synergyCards,
    }))
  : finalRows;

const output = {
  model: {
    routes: routesToScan.length,
    broadRunsPerRoute: broadRuns,
    finalistRunsPerRoute: finalRuns,
    finalists: finalists.length,
    includeAllPairs,
    totalRuns: routesToScan.length * broadRuns + finalists.length * finalRuns,
    profile: "expert behavior with non-zero errors; abstracted Matter placement",
    ranking: "completion > shift-15 survival > shift-10 survival > shift-5 survival > burst",
  },
  broad: broadOutput,
  finals: finalOutput,
};
const serialized = JSON.stringify(output, null, 2);
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && process.argv[outIndex + 1]) {
  writeFileSync(process.argv[outIndex + 1], serialized);
} else {
  console.log(serialized);
}
