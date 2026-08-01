import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSync } from "esbuild";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));
const { outputFiles } = buildSync({
  stdin: {
    contents: `
      export { buildAdjacency, extendAdjacency } from "./src/game/factory/rogueGraph";
      export { computePulse } from "./src/game/factory/roguePulse";
    `,
    resolveDir: appDir,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  loader: { ".ts": "ts" },
  logLevel: "silent",
});
const bundlePath = join(appDir, "node_modules", ".cache", "factory-perf-check.bundle.mjs");
mkdirSync(dirname(bundlePath), { recursive: true });
writeFileSync(bundlePath, outputFiles[0].text);
const { buildAdjacency, extendAdjacency, computePulse } = await import(
  `${pathToFileURL(bundlePath).href}?v=${Date.now()}`
);

const makeBodies = (count) => Array.from({ length: count }, (_, index) => ({
  uid: index + 1,
  species: `worker${index % 12}`,
  elements: ["fire"],
  x: (index % 20) * 24,
  y: 480 - Math.floor(index / 20) * 20,
  r: 10,
  settled: true,
}));

const makeCandidates = (bodies) => [
  ...Array.from({ length: 42 }, (_, index) => ({
    uid: 100_000 + index,
    species: "candidate",
    elements: ["fire"],
    x: 8 + (index % 7) * 75,
    y: 460 - Math.floor(index / 7) * 6,
    r: 10,
    settled: true,
  })),
  ...bodies.map((body, index) => ({
    uid: 200_000 + index,
    species: "candidate",
    elements: ["fire"],
    x: body.x,
    y: body.y - 20,
    r: 10,
    settled: true,
  })),
];

const links = (adj) => {
  let total = 0;
  for (const neighbors of adj.values()) total += neighbors.length;
  return total;
};

const medianMs = (fn, rounds = 5) => {
  const samples = [];
  let checksum = 0;
  for (let round = 0; round < rounds + 1; round++) {
    const start = performance.now();
    checksum ^= fn();
    const elapsed = performance.now() - start;
    if (round > 0) samples.push(elapsed);
  }
  samples.sort((a, b) => a - b);
  return { ms: samples[Math.floor(samples.length / 2)], checksum };
};

const oldLandingY = (bodies, radius, x, deskTop) => {
  let y = deskTop - radius;
  for (let pass = 0; pass < bodies.length + 2; pass++) {
    let next = y;
    for (const body of bodies) {
      const dx = x - body.x;
      const rr = radius + body.r;
      if (Math.abs(dx) >= rr) continue;
      const contactY = body.y - Math.sqrt(Math.max(1, rr * rr - dx * dx));
      if (contactY < next) next = contactY;
    }
    if (Math.abs(next - y) < 0.01) break;
    y = next;
  }
  return y;
};

const newLandingY = (bodies, radius, x, deskTop) => {
  let y = deskTop - radius;
  for (const body of bodies) {
    const dx = x - body.x;
    const rr = radius + body.r;
    if (Math.abs(dx) >= rr) continue;
    const contactY = body.y - Math.sqrt(Math.max(1, rr * rr - dx * dx));
    if (contactY < y) y = contactY;
  }
  return y;
};

const rows = [];
for (const count of [50, 100, 200]) {
  const bodies = makeBodies(count);
  const candidates = makeCandidates(bodies);
  const base = buildAdjacency(bodies);

  for (const candidate of candidates) {
    const full = buildAdjacency([...bodies, candidate]);
    const incremental = extendAdjacency(base, bodies, candidate);
    if (links(full) !== links(incremental)) {
      throw new Error(`增量邻接图与全量图不等价：${count} bodies, candidate ${candidate.uid}`);
    }
  }

  const fullGraph = medianMs(() => {
    let checksum = 0;
    for (const candidate of candidates) checksum += links(buildAdjacency([...bodies, candidate]));
    return checksum;
  });
  const incrementalGraph = medianMs(() => {
    const stable = buildAdjacency(bodies);
    let checksum = 0;
    for (const candidate of candidates) checksum += links(extendAdjacency(stable, bodies, candidate));
    return checksum;
  });
  if (fullGraph.checksum !== incrementalGraph.checksum) {
    throw new Error(`邻接图基准校验和不一致：${count}`);
  }

  const meta = Object.fromEntries([
    ...Array.from({ length: 12 }, (_, index) => [
      `worker${index}`,
      { species: `worker${index}`, elements: ["fire"], tierCount: 1, groupNo: 1, reach: 20, baseValue: 10 },
    ]),
    ["candidate", { species: "candidate", elements: ["fire"], tierCount: 1, groupNo: 1, reach: 20, baseValue: 10 }],
  ]);
  const pulseCtx = (candidate, adjacency) => ({
    uid: candidate.uid,
    bodies: [...bodies, candidate],
    desks: [],
    meta,
    effBase: () => 10,
    cards: {},
    comboStacks: 0,
    opts: adjacency == null ? undefined : { adjacency },
  });
  const fullPulse = medianMs(() => {
    let checksum = 0;
    for (const candidate of candidates) checksum += computePulse(pulseCtx(candidate)).absorbUids.length;
    return checksum;
  }, 3);
  const reusedPulse = medianMs(() => {
    const stable = buildAdjacency(bodies);
    let checksum = 0;
    for (const candidate of candidates) {
      checksum += computePulse(
        pulseCtx(candidate, extendAdjacency(stable, bodies, candidate)),
      ).absorbUids.length;
    }
    return checksum;
  }, 3);
  if (fullPulse.checksum !== reusedPulse.checksum) {
    throw new Error(`完整脉冲基准校验和不一致：${count}`);
  }

  const xs = candidates.map((candidate) => candidate.x);
  for (const x of xs) {
    if (Math.abs(oldLandingY(bodies, 10, x, 500) - newLandingY(bodies, 10, x, 500)) > 1e-9) {
      throw new Error(`落点算法不等价：${count} bodies, x=${x}`);
    }
  }
  const oldLanding = medianMs(() => Math.round(
    xs.reduce((sum, x) => sum + oldLandingY(bodies, 10, x, 500), 0),
  ));
  const newLanding = medianMs(() => Math.round(
    xs.reduce((sum, x) => sum + newLandingY(bodies, 10, x, 500), 0),
  ));
  if (oldLanding.checksum !== newLanding.checksum) {
    throw new Error(`落点基准校验和不一致：${count}`);
  }

  rows.push({
    bodies: count,
    candidates: candidates.length,
    graphFullMs: fullGraph.ms.toFixed(2),
    graphIncrementalMs: incrementalGraph.ms.toFixed(2),
    graphSpeedup: `${(fullGraph.ms / incrementalGraph.ms).toFixed(1)}x`,
    pulseFullMs: fullPulse.ms.toFixed(2),
    pulseReuseMs: reusedPulse.ms.toFixed(2),
    pulseSpeedup: `${(fullPulse.ms / reusedPulse.ms).toFixed(1)}x`,
    landingOldMs: oldLanding.ms.toFixed(2),
    landingNewMs: newLanding.ms.toFixed(2),
    landingSpeedup: `${(oldLanding.ms / newLanding.ms).toFixed(1)}x`,
  });
}

console.table(rows);
console.log("Factory performance equivalence checks passed.");
