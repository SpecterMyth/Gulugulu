// Slower, full-placement verification for the finalists discovered by
// factory_archetype_explorer.mjs.
//
// Usage:
//   node scripts/factory_archetype_finalist_check.mjs [runs-per-route]

import {
  ARCHETYPE_ROUTES,
  simulate,
  summarize,
} from "./factory_player_behavior_sim.mjs";
import { writeFileSync } from "node:fs";

const runs = Math.max(30, Number.parseInt(process.argv[2] ?? "50", 10) || 50);
function cliValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const defaultRouteIds = [
  "attr_high_color",
  "pair_fire_water",
  "pair_electric_ice",
  "pair_grass_electric",
  "pair_water_grass",
  "pair_electric_normal",
  "mono_fire",
  "mono_water",
  "triple_grass_electric_normal",
  "triple_grass_electric_ice",
  "triple_electric_ice_normal",
];
const requestedRouteIds = cliValue("--routes")?.split(",").filter(Boolean);
const routeIds = process.argv.includes("--all-routes")
  ? ARCHETYPE_ROUTES.map((route) => route.id)
  : requestedRouteIds?.length > 0 ? requestedRouteIds : defaultRouteIds;
const seedText = cliValue("--seed") ?? "0xc001d00d";
const routeSeed = Number.parseInt(seedText, seedText.startsWith("0x") ? 16 : 10) >>> 0;

function hashText(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const rows = [];
for (const id of routeIds) {
  const route = ARCHETYPE_ROUTES.find((candidate) => candidate.id === id);
  const results = Array.from({ length: runs }, (_, index) =>
    simulate(
      "expert",
      (routeSeed ^ hashText(id) ^ Math.imul(index + 1, 0x9e37_79b1)) >>> 0,
      route,
      { trackContributions: false, fastMode: false },
    ));
  const summary = summarize("expert", results);
  const cards = Object.entries(summary.cards)
    .map(([cardId, row]) => ({ id: cardId, ...row }))
    .sort((left, right) => right.bought - left.bought);
  rows.push({
    id,
    runs,
    completionRate: summary.completionRate,
    survival: summary.survival,
    cleared: summary.cleared,
    behavior: summary.behavior,
    failureReasons: summary.failureReasons,
    peak: {
      median: Math.round(
        results.map((result) => result.maxPulse).sort((left, right) => left - right)[Math.floor(runs / 2)],
      ),
      p90: Math.round(
        results.map((result) => result.maxPulse).sort((left, right) => left - right)[Math.floor((runs - 1) * 0.9)],
      ),
      max: Math.max(...results.map((result) => result.maxPulse)),
    },
    topCards: cards.slice(0, 8),
    synergyCards: cards.filter((card) => card.id.startsWith("syn.")),
  });
}

const output = {
  model: {
    runsPerRoute: runs,
    routes: routeIds.length,
    totalRuns: runs * routeIds.length,
    seed: `0x${routeSeed.toString(16)}`,
    fastMode: false,
    trackContributions: false,
  },
  routes: rows,
};
const serialized = JSON.stringify(output, null, 2);
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0 && process.argv[outIndex + 1]) {
  writeFileSync(process.argv[outIndex + 1], serialized);
} else {
  console.log(serialized);
}
