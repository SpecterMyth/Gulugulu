// Browser-level performance probe for the real FactoryScene.
//
// Unlike factory_perf_check.mjs (pure logic), this renders the production
// component at a real fullscreen viewport and measures its requestAnimationFrame
// cadence, DOM size, canvas atlas memory, page errors, and a worst-case feedback
// burst with 0 and 200 workers (normal and reduced-motion modes).
//
// Usage:
//   node scripts/factory_ui_perf_check.mjs [--out path.json] [--duration 5000]

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import puppeteer from "puppeteer-core";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const repoDir = join(appDir, "..", "..");
const scratchDir = join(repoDir, ".claude", "scratchpad", `factory-ui-perf-${process.pid}`);

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const durationMs = Math.max(2000, Math.min(20_000, Number(argValue("--duration") ?? 5000)));
const rawOut = argValue("--out");
const outPath = rawOut == null ? null : isAbsolute(rawOut) ? rawOut : resolve(process.cwd(), rawOut);
const captureScreenshot = process.argv.includes("--shot");

const browserPath = [
  process.env.MK_BROWSER ?? "",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find((candidate) => candidate && existsSync(candidate));

if (!browserPath) {
  console.error("Edge/Chrome was not found; set MK_BROWSER to its executable path.");
  process.exit(1);
}

mkdirSync(scratchDir, { recursive: true });

const entry = `
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { FactoryScene } from "./game/FactoryScene";
import { FactoryWindFx } from "./game/factory/FactoryRogueScene";
import { RoguePulseFx } from "./game/factory/ui/RoguePulseFx";
import rawConfig from "./game/config.json";
import "./styles.css";
import "./game/factory.css";
import "./game/factory/rogue.css";

const config = rawConfig;
const species = Object.keys(config.species);
const pets = Array.from({ length: 200 }, (_, index) => ({
  id: "perf-" + index,
  species: species[index % species.length],
  tier: 1,
  level: 1,
  exp: 0,
  stamina: 200,
  staminaUpdatedAt: 0,
  exhausted: false,
  keyBuffer: 0,
  tokenBuffer: 0,
}));
const save = { pets };

function App() {
  const fxRef = useRef(null);
  const showWind = new URLSearchParams(window.location.search).get("facwind") === "1";
  useEffect(() => {
    window.__feedbackActiveParticles = () => fxRef.current?.activeParticles() ?? 0;
    window.__cashHits = 0;
    window.__triggerFeedback = () => {
      const fx = fxRef.current;
      const bodies = window.__facBodies?.() ?? [];
      if (fx == null || bodies.length === 0) return false;
      const main = [...bodies].sort((a, b) => {
        const da = (a.x - 960) ** 2 + (a.y - 540) ** 2;
        const db = (b.x - 960) ** 2 + (b.y - 540) ** 2;
        return da - db;
      })[0];
      const absorbed = bodies.filter((body) => body.uid !== main.uid).slice(0, 14);
      const elements = ["fire", "water", "grass", "electric", "ice", "normal"];
      const byUid = new Map(bodies.map((body) => [body.uid, body]));
      const posOf = (uid) => {
        const body = byUid.get(uid);
        return body == null ? null : { x: body.x, y: body.y };
      };
      const desks = Object.fromEntries(elements.map((element, index) => [element, {
        x: 100 + index * 305,
        w: 160,
        top: 820,
      }]));
      const deskPaths = Object.fromEntries(elements.map((element, index) => [
        element,
        [main.uid, ...absorbed.slice(index * 2, index * 2 + 3).map((body) => body.uid)],
      ]));
      const breakdown = {
        uid: main.uid,
        species: main.species,
        base: 8000,
        absorbSum: 14000,
        absorbUids: absorbed.map((body) => body.uid),
        chips: 22000,
        elementMult: 6,
        synergyCardMult: 4,
        jobMult: 3,
        rhythmMult: 2,
        individualMult: 3,
        teamMult: 6,
        networkMult: 4,
        statusMult: 1,
        skillMult: 18,
        synergyMult: 4,
        comboMult: 2,
        desks: elements,
        deskCount: 6,
        deskScoreMult: 16,
        deskPaths,
        total: 528000,
        contributors: [
          { uid: main.uid, species: main.species, role: "head", amount: 500000 },
          ...absorbed.map((body) => ({ uid: body.uid, species: body.species, role: "absorbed", amount: 2000 })),
        ],
        extras: [
          { kind: "fireBurst", uid: main.uid, amount: 88000 },
          { kind: "wildfire", uid: main.uid, amount: 168000 },
          { kind: "shortCircuit", uid: main.uid, amount: 66000 },
        ],
        triggers: [
          { kind: "ignite", sourceUid: main.uid, targetUids: absorbed.slice(0, 3).map((body) => body.uid), value: 3 },
          { kind: "overload", sourceUid: main.uid, targetUids: absorbed.slice(3, 6).map((body) => body.uid), value: 6 },
          { kind: "shortCircuit", sourceUid: main.uid, targetUids: absorbed.slice(6, 9).map((body) => body.uid), value: 2 },
          { kind: "freeze", sourceUid: main.uid, targetUids: absorbed.slice(9, 12).map((body) => body.uid) },
          { kind: "grow", sourceUid: main.uid, targetUids: [main.uid] },
          { kind: "emperor", sourceUid: main.uid, targetUids: absorbed.slice(12, 14).map((body) => body.uid) },
        ],
      };
      const at = { x: main.x, y: main.y };
      const deskOf = (element) => desks[element] ?? null;
      fx.pulse({ bd: breakdown, gained: 850000, tier: 4, at, posOf, deskOf });
      fx.aftermath({ bd: breakdown, delayMs: 80, at, posOf });
      fx.protest({ at, amount: 66000, tier: 4 });
      fx.strikeRings(absorbed.slice(0, 6).map((body) => ({ x: body.x, y: body.y, r: body.r })));
      fx.severanceRefund(absorbed.slice(0, 6).map((body, index) => ({
        x: body.x,
        y: body.y,
        amount: 432 + index,
      })), 40);
      fx.dismissStamp({ x: main.x, y: main.y, r: main.r });
      fx.edgeFlash(3);
      fx.confetti();
      fx.kpiBonus(250000);
      return true;
    };
    return () => {
      delete window.__feedbackActiveParticles;
      delete window.__triggerFeedback;
      delete window.__cashHits;
    };
  }, []);

  return (
    <main className="pet-shell ui-factory" style={{ width: "100%", height: "100%" }}>
      <FactoryScene save={save} config={config} onBack={() => {}} />
      {showWind && <FactoryWindFx direction="right" />}
      <RoguePulseFx
        ref={fxRef}
        config={config}
        dismissText="裁"
        getRevenuePoint={() => ({ x: 1740, y: 120 })}
        getCashPoint={() => ({ x: 1740, y: 190 })}
        onCashHit={() => { window.__cashHits = (window.__cashHits ?? 0) + 1; }}
      />
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
`;

await build({
  stdin: { contents: entry, resolveDir: join(appDir, "src"), loader: "tsx", sourcefile: "entry.tsx" },
  bundle: true,
  format: "iife",
  jsx: "automatic",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: join(scratchDir, "bundle.js"),
  logLevel: "warning",
});

writeFileSync(
  join(scratchDir, "index.html"),
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./bundle.css"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}body{background:#2b6ecb}</style></head><body><div id="root"></div><script src="./bundle.js"></script></body></html>`,
);

const debugPort = 9300 + (process.pid % 300);
const profileDir = join(scratchDir, "profile");
const browserProcess = spawn(
  browserPath,
  [
    "--headless=new",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--no-first-run",
    "--disable-extensions",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--enable-precise-memory-info",
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${debugPort}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

let browserError = "";
browserProcess.stderr.on("data", (chunk) => {
  browserError = (browserError + chunk.toString()).slice(-4000);
});

let webSocketDebuggerUrl = "";
for (let attempt = 0; attempt < 100 && !webSocketDebuggerUrl; attempt++) {
  if (browserProcess.exitCode != null) break;
  try {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
    webSocketDebuggerUrl = (await response.json()).webSocketDebuggerUrl;
  } catch {
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
}

if (!webSocketDebuggerUrl) {
  browserProcess.kill();
  console.error(`Browser debug endpoint did not start (exit=${browserProcess.exitCode}).\n${browserError}`);
  process.exit(1);
}

const browser = await puppeteer.connect({ browserWSEndpoint: webSocketDebuggerUrl });
const browserSession = await browser.target().createCDPSession();
const percentile = (sorted, ratio) => {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
};
const round = (value, digits = 2) => Number(value.toFixed(digits));
const readBrowserCpu = async () => {
  const { processInfo = [] } = await browserSession.send("SystemInfo.getProcessInfo");
  return new Map(processInfo.map((process) => [
    String(process.id),
    { type: process.type, cpuTime: Number(process.cpuTime) || 0 },
  ]));
};
const readBrowserProcessMemory = (processes) => {
  if (process.platform !== "win32") return null;
  const pids = [...processes.keys()]
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (pids.length === 0) return null;
  const command = [
    `$ids = @(${pids.join(",")})`,
    "$items = @(Get-Process -Id $ids -ErrorAction SilentlyContinue)",
    "$working = ($items | Measure-Object -Property WorkingSet64 -Sum).Sum",
    "$private = ($items | Measure-Object -Property PrivateMemorySize64 -Sum).Sum",
    "[PSCustomObject]@{ processCount = $items.Count; workingSetBytes = $working; privateBytes = $private } | ConvertTo-Json -Compress",
  ].join("; ");
  try {
    const raw = execFileSync("powershell.exe", ["-NoProfile", "-Command", command], {
      encoding: "utf8",
      windowsHide: true,
    });
    const parsed = JSON.parse(raw);
    return {
      processCount: Number(parsed.processCount) || 0,
      workingSetBytes: Number(parsed.workingSetBytes) || 0,
      privateBytes: Number(parsed.privateBytes) || 0,
    };
  } catch {
    return null;
  }
};

const runCase = async (
  targetBodies,
  {
    feedback = false,
    wind = false,
    reducedMotion = false,
    label = targetBodies === 0 ? "baseline" : "full-pile",
  } = {},
) => {
  const page = await browser.newPage();
  const errors = [];
  const caseStartedAt = Date.now();
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" },
  ]);
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const query = new URLSearchParams({ frdebug: "1" });
  if (targetBodies > 0) query.set("facpile", String(targetBodies));
  if (wind) query.set("facwind", "1");
  await page.goto(`${pathToFileURL(join(scratchDir, "index.html")).href}?${query}`, { waitUntil: "load" });
  await page.waitForSelector(".fac-stage", { timeout: 15_000 });
  await page.waitForFunction(
    (expected) => typeof window.__facBodies === "function" && window.__facBodies().length === expected,
    { timeout: 30_000 },
    targetBodies,
  );
  const bodiesReadyMs = Date.now() - caseStartedAt;
  await page.waitForFunction(
    () => typeof window.__facAtlas === "function" && window.__facAtlas().every((entry) => entry.ready),
    { timeout: 60_000 },
  );
  const atlasReadyMs = Date.now() - caseStartedAt;
  await new Promise((resolveWait) => setTimeout(resolveWait, 1000));

  let screenshot = null;
  let feedbackTriggered = false;
  let feedbackScreenshotState = null;
  if (feedback) {
    feedbackTriggered = await page.evaluate(() => window.__triggerFeedback?.() === true);
    if (!feedbackTriggered) errors.push("feedback trigger was unavailable");
    await new Promise((resolveWait) => setTimeout(resolveWait, 160));
    feedbackScreenshotState = await page.evaluate(() => {
      const speedlines = document.querySelector(".fr-speedlines");
      if (speedlines == null) return null;
      const style = getComputedStyle(speedlines);
      return {
        active: speedlines.classList.contains("is-on"),
        display: style.display,
        opacity: Number.parseFloat(style.opacity),
        refundTexts: [...document.querySelectorAll(".fr-refund-fly")].map((element) => element.textContent),
        refundPointerEvents: [...document.querySelectorAll(".fr-refund-fly")]
          .map((element) => getComputedStyle(element).pointerEvents),
      };
    });
    if (captureScreenshot) {
      const suffix = `-feedback-${reducedMotion ? "reduced" : "normal"}`;
      const screenshotPath = outPath?.replace(/\.json$/i, `${suffix}.png`) ?? join(scratchDir, `${label}.png`);
      mkdirSync(dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath });
      screenshot = relative(repoDir, screenshotPath).replaceAll("\\", "/");
    }
    // Let the visual-only warm-up drain before the measured burst.
    await new Promise((resolveWait) => setTimeout(resolveWait, 2460));
  }

  const metricsBefore = await page.metrics();
  const cpuBefore = await readBrowserCpu();
  if (feedback) feedbackTriggered = (await page.evaluate(() => window.__triggerFeedback?.() === true)) && feedbackTriggered;
  const frames = await page.evaluate(
    (sampleDuration) =>
      new Promise((resolveFrames) => {
        const deltas = [];
        const longTasks = [];
        let peakActiveParticles = 0;
        let peakCoinNodes = 0;
        let peakConfettiNodes = 0;
        let peakProtestBits = 0;
        let observer = null;
        if (typeof PerformanceObserver !== "undefined") {
          try {
            observer = new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) longTasks.push(entry.duration);
            });
            observer.observe({ entryTypes: ["longtask"] });
          } catch {
            observer = null;
          }
        }
        const startedAt = performance.now();
        let previous = null;
        const tick = (now) => {
          if (previous != null) deltas.push(now - previous);
          previous = now;
          peakActiveParticles = Math.max(peakActiveParticles, window.__feedbackActiveParticles?.() ?? 0);
          peakCoinNodes = Math.max(peakCoinNodes, document.querySelectorAll(".fr-coin:not([style*='display: none'])").length);
          peakConfettiNodes = Math.max(peakConfettiNodes, document.querySelectorAll(".fr-confetti").length);
          peakProtestBits = Math.max(peakProtestBits, document.querySelectorAll(".fr-protest-bit").length);
          if (now - startedAt >= sampleDuration) {
            observer?.disconnect();
            resolveFrames({
              deltas,
              elapsedMs: now - startedAt,
              longTasks,
              peakActiveParticles,
              peakCoinNodes,
              peakConfettiNodes,
              peakProtestBits,
            });
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    durationMs,
  );
  const metricsAfter = await page.metrics();
  const cpuAfter = await readBrowserCpu();
  let browserCpuTimeMs = 0;
  const browserCpuTimeByType = {};
  for (const [id, after] of cpuAfter) {
    const before = cpuBefore.get(id);
    if (before == null) continue;
    const deltaMs = Math.max(0, (after.cpuTime - before.cpuTime) * 1000);
    browserCpuTimeMs += deltaMs;
    browserCpuTimeByType[after.type] = (browserCpuTimeByType[after.type] ?? 0) + deltaMs;
  }
  const renderPipelineCpuTimeMs = (browserCpuTimeByType.renderer ?? 0) + (browserCpuTimeByType.GPU ?? 0);
  const browserProcessMemory = readBrowserProcessMemory(cpuAfter);
  const state = await page.evaluate(() => {
    const bodies = window.__facBodies();
    const atlas = window.__facAtlas();
    const canvas = document.querySelector(".fac-pile-canvas");
    const stageRect = document.querySelector(".fac-stage")?.getBoundingClientRect();
    const feedbackLayer = document.querySelector(".fr-fx-layer");
    const feedbackBackdrop = document.querySelector(".fr-fx-backdrop");
    const factoryHud = document.querySelector(".fac-hud");
    const factoryHint = document.querySelector(".fac-hint");
    const zIndex = (element) => {
      if (element == null) return null;
      const parsed = Number.parseInt(getComputedStyle(element).zIndex, 10);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return {
      bodies: bodies.length,
      settledBodies: bodies.filter((body) => body.settled).length,
      inDomBodies: bodies.filter((body) => body.inDom).length,
      petDomNodes: document.querySelectorAll(".fac-pet").length,
      totalDomNodes: document.querySelectorAll("*").length,
      atlasSpecies: atlas.length,
      atlasReady: atlas.filter((entry) => entry.ready).length,
      atlasEstimatedBytes: atlas.reduce((sum, entry) => sum + entry.estimatedBytes, 0),
      canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
      stage: stageRect ? { width: stageRect.width, height: stageRect.height } : null,
      jsHeapUsedBytes: performance.memory?.usedJSHeapSize ?? null,
      jsHeapTotalBytes: performance.memory?.totalJSHeapSize ?? null,
      feedbackActiveAfterSample: window.__feedbackActiveParticles?.() ?? 0,
      cashHits: window.__cashHits ?? 0,
      reducedMotionMatched: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      feedbackLayerPointerEvents: feedbackLayer == null ? null : getComputedStyle(feedbackLayer).pointerEvents,
      feedbackBackdropPointerEvents:
        feedbackBackdrop == null ? null : getComputedStyle(feedbackBackdrop).pointerEvents,
      feedbackBackdropZIndex: zIndex(feedbackBackdrop),
      factoryHudZIndex: zIndex(factoryHud),
      factoryHintZIndex: zIndex(factoryHint),
      feedbackBackdropBottom: feedbackBackdrop?.getBoundingClientRect().bottom ?? null,
      factoryHudTop: factoryHud?.getBoundingClientRect().top ?? null,
      factoryHintTop: factoryHint?.getBoundingClientRect().top ?? null,
      windFxClass: document.querySelector(".fr-wind-fx")?.className ?? null,
      windGusts: document.querySelectorAll(".fr-wind-gust").length,
      windDebris: document.querySelectorAll(".fr-wind-debris").length,
      windGustAnimations: [...new Set(
        [...document.querySelectorAll(".fr-wind-gust")].map((element) => getComputedStyle(element).animationName),
      )],
      windDebrisAnimations: [...new Set(
        [...document.querySelectorAll(".fr-wind-debris")].map((element) => getComputedStyle(element).animationName),
      )],
    };
  });
  if (captureScreenshot && targetBodies > 0 && !feedback) {
    const suffix = wind ? `-wind-${reducedMotion ? "reduced" : "normal"}` : "";
    const screenshotPath = outPath?.replace(/\.json$/i, `${suffix}.png`)
      ?? join(scratchDir, `factory-${targetBodies}${suffix}.png`);
    mkdirSync(dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath });
    screenshot = relative(repoDir, screenshotPath).replaceAll("\\", "/");
  }
  let interaction = null;
  if (targetBodies > 0 && !feedback) {
    const clickTarget = await page.evaluate(() => {
      const bodies = window.__facBodies();
      const body = [...bodies].sort((a, b) => b.y - a.y)[0];
      return body == null
        ? null
        : {
            x: body.x,
            y: body.y,
            bodiesBefore: bodies.length,
            firedBefore: window.__facStats?.fired ?? 0,
          };
    });
    if (clickTarget != null) {
      await page.mouse.click(clickTarget.x, clickTarget.y);
      await page.waitForFunction(
        (expected) => typeof window.__facBodies === "function" && window.__facBodies().length === expected,
        { timeout: 5000 },
        targetBodies - 1,
      );
      interaction = await page.evaluate((target) => {
        const bodiesAfter = window.__facBodies().length;
        const firedAfter = window.__facStats?.fired ?? 0;
        return {
          click: { x: target.x, y: target.y },
          bodiesBefore: target.bodiesBefore,
          bodiesAfter,
          firedBefore: target.firedBefore,
          firedAfter,
          succeeded: bodiesAfter === target.bodiesBefore - 1 && firedAfter === target.firedBefore + 1,
        };
      }, clickTarget);
    }
  }
  const sorted = [...frames.deltas].sort((a, b) => a - b);
  const averageDelta = frames.deltas.reduce((sum, delta) => sum + delta, 0) / Math.max(1, frames.deltas.length);
  const result = {
    label,
    targetBodies,
    feedback,
    wind,
    feedbackTriggered,
    feedbackScreenshotState,
    reducedMotion,
    readiness: { bodiesReadyMs, atlasReadyMs },
    ...state,
    screenshot,
    interaction,
    sample: {
      durationMs: round(frames.elapsedMs),
      frames: frames.deltas.length,
      averageFps: round(1000 / averageDelta),
      averageFrameMs: round(averageDelta),
      p50FrameMs: round(percentile(sorted, 0.5)),
      p95FrameMs: round(percentile(sorted, 0.95)),
      p99FrameMs: round(percentile(sorted, 0.99)),
      maxFrameMs: round(sorted.at(-1) ?? 0),
      framesOver25Ms: frames.deltas.filter((delta) => delta > 25).length,
      framesOver33Ms: frames.deltas.filter((delta) => delta > 33.4).length,
      framesOver50Ms: frames.deltas.filter((delta) => delta > 50).length,
      longTasks: frames.longTasks.length,
      longestTaskMs: round(Math.max(0, ...frames.longTasks)),
      peakActiveParticles: frames.peakActiveParticles,
      peakCoinNodes: frames.peakCoinNodes,
      peakConfettiNodes: frames.peakConfettiNodes,
      peakProtestBits: frames.peakProtestBits,
    },
    browserMetrics: {
      jsHeapUsedBytes: Math.round(metricsAfter.JSHeapUsedSize ?? 0),
      nodes: Math.round(metricsAfter.Nodes ?? 0),
      layoutCountDuringSample: Math.round((metricsAfter.LayoutCount ?? 0) - (metricsBefore.LayoutCount ?? 0)),
      recalcStyleCountDuringSample: Math.round(
        (metricsAfter.RecalcStyleCount ?? 0) - (metricsBefore.RecalcStyleCount ?? 0),
      ),
      taskDurationDuringSampleMs: round(
        ((metricsAfter.TaskDuration ?? 0) - (metricsBefore.TaskDuration ?? 0)) * 1000,
      ),
      browserCpuTimeMs: round(browserCpuTimeMs),
      browserCpuPctOneCore: round((browserCpuTimeMs / Math.max(1, frames.elapsedMs)) * 100),
      renderPipelineCpuTimeMs: round(renderPipelineCpuTimeMs),
      renderPipelineCpuPctOneCore: round((renderPipelineCpuTimeMs / Math.max(1, frames.elapsedMs)) * 100),
      browserCpuTimeByTypeMs: Object.fromEntries(
        Object.entries(browserCpuTimeByType).map(([type, value]) => [type, round(value)]),
      ),
      browserProcessMemory,
    },
    errors,
  };
  await page.close();
  return result;
};

let report;
let exitCode = 0;
try {
  const baseline = await runCase(0);
  const fullPile = await runCase(200);
  const windNormal = await runCase(200, {
    wind: true,
    reducedMotion: false,
    label: "full-pile-wind-normal",
  });
  const windReduced = await runCase(200, {
    wind: true,
    reducedMotion: true,
    label: "full-pile-wind-reduced",
  });
  const feedbackNormal = await runCase(200, {
    feedback: true,
    reducedMotion: false,
    label: "full-pile-feedback-normal",
  });
  const feedbackReduced = await runCase(200, {
    feedback: true,
    reducedMotion: true,
    label: "full-pile-feedback-reduced",
  });
  const fpsDelta = fullPile.sample.averageFps - baseline.sample.averageFps;
  const heapDelta = (fullPile.jsHeapUsedBytes ?? 0) - (baseline.jsHeapUsedBytes ?? 0);
  const checks = {
    exactBodyCount: fullPile.bodies === 200,
    settledBodyCount: fullPile.settledBodies === 200,
    canvasBatching: fullPile.inDomBodies <= 3 && fullPile.petDomNodes <= 3,
    pileClickDismissesOne: fullPile.interaction?.succeeded === true,
    feedbackBurstCovered:
      feedbackNormal.feedbackTriggered &&
      feedbackNormal.feedbackScreenshotState?.active === true &&
      feedbackNormal.feedbackScreenshotState?.display !== "none" &&
      feedbackNormal.feedbackScreenshotState?.opacity > 0 &&
      feedbackNormal.sample.peakActiveParticles > 0 &&
      feedbackNormal.sample.peakCoinNodes > 0 &&
      feedbackNormal.sample.peakConfettiNodes > 0,
    feedbackLayerDoesNotBlockClicks:
      feedbackNormal.feedbackLayerPointerEvents === "none" &&
      feedbackReduced.feedbackLayerPointerEvents === "none" &&
      feedbackNormal.feedbackBackdropPointerEvents === "none" &&
      feedbackReduced.feedbackBackdropPointerEvents === "none",
    refundFeedbackShowsExactAmount:
      feedbackNormal.feedbackScreenshotState?.refundTexts?.includes("+¥432") === true &&
      feedbackReduced.feedbackScreenshotState?.refundTexts?.includes("+¥432") === true,
    refundFeedbackDoesNotBlockClicks:
      feedbackNormal.feedbackScreenshotState?.refundPointerEvents?.every((value) => value === "none") === true &&
      feedbackReduced.feedbackScreenshotState?.refundPointerEvents?.every((value) => value === "none") === true,
    speedlinesStayBelowFactoryUi:
      feedbackNormal.feedbackBackdropZIndex != null &&
      feedbackNormal.factoryHudZIndex != null &&
      feedbackNormal.factoryHintZIndex != null &&
      feedbackNormal.feedbackBackdropZIndex < feedbackNormal.factoryHudZIndex &&
      feedbackNormal.feedbackBackdropZIndex < feedbackNormal.factoryHintZIndex &&
      feedbackNormal.feedbackBackdropBottom != null &&
      feedbackNormal.factoryHudTop != null &&
      feedbackNormal.factoryHintTop != null &&
      feedbackNormal.feedbackBackdropBottom <= feedbackNormal.factoryHudTop &&
      feedbackNormal.feedbackBackdropBottom <= feedbackNormal.factoryHintTop,
    reducedMotionMatched:
      feedbackReduced.reducedMotionMatched === true && feedbackNormal.reducedMotionMatched === false,
    reducedMotionDropsDenseMotion:
      feedbackReduced.sample.peakCoinNodes === 0 &&
      feedbackReduced.sample.peakConfettiNodes === 0 &&
      feedbackReduced.sample.peakProtestBits === 0 &&
      feedbackReduced.sample.peakActiveParticles < feedbackNormal.sample.peakActiveParticles,
    windBurstCovered:
      windNormal.windFxClass?.includes("is-right") === true &&
      windNormal.windGusts === 18 &&
      windNormal.windDebris === 12 &&
      windNormal.windGustAnimations.every((name) => name !== "none") &&
      windNormal.windDebrisAnimations.every((name) => name !== "none"),
    reducedMotionDropsWindAnimation:
      windReduced.reducedMotionMatched === true &&
      windReduced.windGusts === 18 &&
      windReduced.windDebris === 12 &&
      windReduced.windGustAnimations.every((name) => name === "none") &&
      windReduced.windDebrisAnimations.every((name) => name === "none"),
    noPageErrors:
      baseline.errors.length === 0 &&
      fullPile.errors.length === 0 &&
      feedbackNormal.errors.length === 0 &&
      feedbackReduced.errors.length === 0 &&
      windNormal.errors.length === 0 &&
      windReduced.errors.length === 0,
    interactiveFrameFloor: fullPile.sample.averageFps >= 30 && fullPile.sample.p95FrameMs <= 50,
    feedbackFrameFloor:
      feedbackNormal.sample.averageFps >= 30 &&
      feedbackNormal.sample.p95FrameMs <= 50 &&
      feedbackReduced.sample.averageFps >= 30 &&
      feedbackReduced.sample.p95FrameMs <= 50,
    windFrameFloor:
      windNormal.sample.averageFps >= 30 &&
      windNormal.sample.p95FrameMs <= 50 &&
      windReduced.sample.averageFps >= 30 &&
      windReduced.sample.p95FrameMs <= 50,
  };
  report = {
    generatedAt: new Date().toISOString(),
    environment: {
      browserPath,
      browserVersion: await browser.version(),
      viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      sampleDurationMs: durationMs,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    baseline,
    fullPile,
    windNormal,
    windReduced,
    feedbackNormal,
    feedbackReduced,
    comparison: {
      averageFpsDelta: round(fpsDelta),
      p95FrameMsDelta: round(fullPile.sample.p95FrameMs - baseline.sample.p95FrameMs),
      jsHeapUsedDeltaBytes: heapDelta,
      domNodeDelta: fullPile.totalDomNodes - baseline.totalDomNodes,
      taskDurationDeltaMs: round(
        fullPile.browserMetrics.taskDurationDuringSampleMs - baseline.browserMetrics.taskDurationDuringSampleMs,
      ),
      feedback: {
        normalAverageFps: feedbackNormal.sample.averageFps,
        reducedAverageFps: feedbackReduced.sample.averageFps,
        normalP95FrameMs: feedbackNormal.sample.p95FrameMs,
        reducedP95FrameMs: feedbackReduced.sample.p95FrameMs,
        normalPeakParticles: feedbackNormal.sample.peakActiveParticles,
        reducedPeakParticles: feedbackReduced.sample.peakActiveParticles,
        peakParticleReductionPct: round(
          feedbackNormal.sample.peakActiveParticles === 0
            ? 0
            : (1 - feedbackReduced.sample.peakActiveParticles / feedbackNormal.sample.peakActiveParticles) * 100,
        ),
      },
      wind: {
        normalAverageFps: windNormal.sample.averageFps,
        reducedAverageFps: windReduced.sample.averageFps,
        normalP95FrameMs: windNormal.sample.p95FrameMs,
        reducedP95FrameMs: windReduced.sample.p95FrameMs,
        normalRenderPipelineCpuPctOneCore: windNormal.browserMetrics.renderPipelineCpuPctOneCore,
        reducedRenderPipelineCpuPctOneCore: windReduced.browserMetrics.renderPipelineCpuPctOneCore,
      },
    },
    checks,
    passed: Object.values(checks).every(Boolean),
  };
  if (!report.passed) exitCode = 1;
} catch (error) {
  report = {
    generatedAt: new Date().toISOString(),
    fatalError: error instanceof Error ? error.stack ?? error.message : String(error),
    passed: false,
  };
  exitCode = 1;
} finally {
  await browser.disconnect();
  browserProcess.kill();
}

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outPath != null) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, serialized);
  console.log(`Report: ${outPath}`);
}
console.log(serialized);
process.exit(exitCode);
