// p0-v4c: record the complete Factory flow from the running app.
// Gameplay uses 3x carrier/drop motion while real UI and reward FX keep normal timing.
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const repoDir = join(appDir, "..", "..");
const outDir = join(repoDir, "assets", "steam-store", "p0-v4", "trailer", "factory-v4c");
const ffmpeg = "C:/Users/admin/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe";
const chrome = [
  "C:/Users/admin/AppData/Local/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find((path) => existsSync(path));
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);
const langs = only ? [only] : ["en", "zh"];
const fps = 30;
const port = 4191;
const base = `http://localhost:${port}/`;

const scenarios = [
  {
    id: "reward", kind: "gameplay", seconds: 6, pile: 72,
    facseed: 1103, frseed: 2103, bg: "rainy_night",
    dropEvery: 680, coinEvery: 920, confettiEvery: 2600,
  },
  {
    id: "hiring", kind: "hiring", seconds: 7, pile: 48,
    facseed: 2207, frseed: 3207, bg: "twilight",
  },
  {
    id: "shop", kind: "shop", seconds: 7, pile: 54,
    facseed: 3313, frseed: 4313, bg: "morning",
  },
  {
    id: "chaos", kind: "gameplay", seconds: 7, pile: 122,
    facseed: 4421, frseed: 5421, bg: "daylight",
    dropEvery: 610, coinEvery: 0, confettiEvery: 2400,
  },
  {
    id: "reward2", kind: "gameplay", seconds: 4, pile: 68,
    facseed: 5531, frseed: 6531, bg: "rainy_night",
    dropEvery: 620, coinEvery: 880, confettiEvery: 0,
  },
];

if (!chrome || !existsSync(ffmpeg)) throw new Error("Chrome/ffmpeg unavailable");
mkdirSync(outDir, { recursive: true });

async function ready() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(base)).ok) return;
    } catch { /* preview starting */ }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("vite preview timeout");
}

async function startHiring(page) {
  const clockIn = await page.$(".fr-lo-clockin");
  if (clockIn != null) await clockIn.click();
  await page.waitForSelector(".fr-hiring-panel", { timeout: 20_000 });
  await page.waitForFunction(
    () => window.__frRun?.view?.().phase === "hiring",
    { timeout: 20_000 },
  );
}

async function finishHiring(page) {
  const result = await page.evaluate(() => {
    const run = window.__frRun;
    if (run == null) return { ok: false, reason: "missing run" };
    for (let round = 0; round < 8; round += 1) {
      let view = run.view();
      if (view.phase !== "hiring" || view.hiring == null) return { ok: view.phase === "shift", phase: view.phase };
      run.setAllHiringCandidates(false);
      view = run.view();
      const hiring = view.hiring;
      if (hiring == null) return { ok: false, reason: "missing hiring" };
      let spend = 0;
      let picked = 0;
      const budget = Math.max(0, view.cash - view.bill);
      for (const candidate of [...hiring.candidates].sort((a, b) => a.price - b.price)) {
        if (spend + candidate.price > budget || picked >= 8) continue;
        run.toggleHiringCandidate(candidate.id);
        spend += candidate.price;
        picked += 1;
      }
      const next = run.view();
      if (next.hiring == null || !next.hiring.canConfirm) return { ok: false, reason: "cannot confirm", picked, spend };
      run.confirmHiring(next.hiring.canContinue);
    }
    const phase = run.view().phase;
    return { ok: phase === "shift", phase };
  });
  if (!result.ok) throw new Error(`Hiring automation failed: ${JSON.stringify(result)}`);
}

async function reachShift(page) {
  await startHiring(page);
  await finishHiring(page);
  await page.waitForFunction(
    () => window.__frRun?.view?.().phase === "shift" && typeof window.__facBodies === "function",
    { timeout: 30_000 },
  );
}

async function reachShop(page) {
  await reachShift(page);
  const result = await page.evaluate(() => {
    const run = window.__frRun;
    if (run == null) return { ok: false, reason: "missing run" };
    run.debugSetCash?.(2_000_000);
    run.debugEndShift?.();
    run.confirmSettlement?.();
    return { ok: run.view().phase === "shop", phase: run.view().phase };
  });
  if (!result.ok) throw new Error(`Shop setup failed: ${JSON.stringify(result)}`);
  await page.waitForSelector(".fr-shop-overlay .fr-card-buybar", { timeout: 20_000 });
}

async function writeVideo(frames, seconds, out) {
  if (frames.length < 3) throw new Error(`Too few screencast frames: ${frames.length}`);
  frames.sort((a, b) => a.ts - b.ts);
  const enc = spawn(ffmpeg, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-i", "pipe:0",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
    "-pix_fmt", "yuv420p", "-r", String(fps), "-movflags", "+faststart", out,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const start = frames[0].ts;
  let source = 0;
  for (let index = 0; index < Math.round(seconds * fps); index += 1) {
    const target = start + index / fps;
    while (source + 1 < frames.length && frames[source + 1].ts <= target) source += 1;
    await new Promise((resolve, reject) => {
      enc.stdin.write(frames[source].data, (error) => (error ? reject(error) : resolve()));
    });
  }
  enc.stdin.end();
  const code = await new Promise((resolve) => enc.on("close", resolve));
  if (code !== 0) throw new Error(`ffmpeg failed: ${code}`);
}

async function recordScenario(browser, lang, scenario) {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    localStorage.removeItem("gulugulu.factory_rogue.run.v1");
    localStorage.removeItem("gulugulu.factory_rogue.lastLoadout");
    localStorage.setItem("gulugulu.factory.strike-warning.v1", "1");
  });
  const query = new URLSearchParams({
    ui: "factory", seed: "rich", steamClean: "1", frdebug: "1", frshowcase: "1",
    facpile: String(scenario.pile), facseed: String(scenario.facseed), frseed: String(scenario.frseed),
    frcaptureSpeed: "3", bg: scenario.bg, lang, shot: "1",
  });
  await page.goto(`${base}?${query}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector("#root > *", { timeout: 60_000 });

  if (scenario.kind === "hiring") await startHiring(page);
  else if (scenario.kind === "shop") await reachShop(page);
  else await reachShift(page);

  await page.addStyleTag({
    content: [
      ".onboarding-goal,.factory-guide-drop-key,.fr-tut{display:none!important}",
      ".fac-prop{animation-duration:73ms!important}",
      ".fac-hang-rig{animation-duration:1.13s!important}",
      ".svg-sprite-state-drop .svg-sprite-body,.svg-sprite-state-drop .part-armL,.svg-sprite-state-drop .part-armR,.svg-sprite-state-drop .part-legL,.svg-sprite-state-drop .part-legR{animation-duration:333ms!important}",
    ].join(""),
  });

  if (scenario.kind === "gameplay") {
    await page.waitForFunction(
      (expected) => (window.__facBodies?.().length ?? 0) >= Math.floor(expected * 0.8),
      { timeout: 40_000 },
      scenario.pile,
    );
  }
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const client = await page.createCDPSession();
  const frames = [];
  client.on("Page.screencastFrame", async (event) => {
    frames.push({ ts: event.metadata.timestamp, data: Buffer.from(event.data, "base64") });
    await client.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
  });
  await client.send("Page.startScreencast", {
    format: "jpeg", quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1,
  });

  const intervals = [];
  const timeouts = [];
  let fxVariant = 0;
  let uiStep = 0;
  const triggerCoin = () => page.evaluate(() => window.__frFx?.coinWave?.()).catch(() => {});
  const triggerConfetti = () => page.evaluate(() => window.__frFx?.confetti?.()).catch(() => {});
  const triggerDrop = () => {
    void page.keyboard.press("Space").catch(() => {});
    const variant = fxVariant++;
    if (variant % 2 === 0) {
      timeouts.push(setTimeout(() => {
        void page.evaluate((v) => window.__frFx?.showcaseImpact?.(v), variant).catch(() => {});
      }, 210));
    }
  };
  const interactHiring = () => {
    const step = uiStep++;
    void page.evaluate((n) => {
      const cards = [...document.querySelectorAll(".fr-hiring-card:not(:disabled)")];
      if (n === 2) document.querySelector(".fr-hiring-reroll:not(:disabled)")?.click();
      else if (n === 5) document.querySelector(".fr-hiring-select-all:not(:disabled)")?.click();
      else cards[(n * 2 + 1) % Math.max(1, cards.length)]?.click();
    }, step).catch(() => {});
  };
  const interactShop = () => {
    const step = uiStep++;
    void page.evaluate((n) => {
      if (n === 1 || n === 4) {
        document.querySelector(".fr-shop-act-reroll:not(:disabled)")?.click();
        return;
      }
      if (n === 3) document.querySelector(".fr-shop-keyword-title")?.click();
      const buy = [...document.querySelectorAll(".fr-card-buybar:not(:disabled)")][n % 3];
      (buy ?? document.querySelector(".fr-card-buybar:not(:disabled)"))?.click();
    }, step).catch(() => {});
  };

  if (scenario.kind === "gameplay") {
    triggerDrop();
    intervals.push(setInterval(triggerDrop, scenario.dropEvery));
    if (scenario.coinEvery > 0) {
      void triggerCoin();
      intervals.push(setInterval(triggerCoin, scenario.coinEvery));
    }
    if (scenario.confettiEvery > 0) intervals.push(setInterval(triggerConfetti, scenario.confettiEvery));
  } else if (scenario.kind === "hiring") {
    interactHiring();
    intervals.push(setInterval(interactHiring, 920));
  } else {
    interactShop();
    intervals.push(setInterval(interactShop, 1050));
  }

  await new Promise((resolve) => setTimeout(resolve, scenario.seconds * 1000 + 120));
  intervals.forEach(clearInterval);
  timeouts.forEach(clearTimeout);
  await client.send("Page.stopScreencast").catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 150));

  const out = join(outDir, `factory_${scenario.id}_${lang}.mp4`);
  await writeVideo(frames, scenario.seconds, out);
  const observed = frames.at(-1).ts - frames[0].ts;
  console.log(`ok ${lang}/${scenario.id}: ${frames.length} source frames over ${observed.toFixed(2)}s -> ${out}`);
  await page.close();
}

const vite = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], {
  cwd: appDir,
  shell: true,
  stdio: "ignore",
});
let browser;
try {
  await ready();
  browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    args: ["--disable-gpu", "--hide-scrollbars", "--no-first-run", "--disable-extensions"],
  });
  for (const lang of langs) {
    for (const scenario of scenarios) await recordScenario(browser, lang, scenario);
  }
} finally {
  const browserPid = browser?.process()?.pid;
  if (browser) await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
  if (browserPid) await new Promise((r) => execFile("taskkill", ["/pid", String(browserPid), "/T", "/F"], () => r()));
  if (vite.pid) await new Promise((r) => execFile("taskkill", ["/pid", String(vite.pid), "/T", "/F"], () => r()));
}
process.exit(0);
