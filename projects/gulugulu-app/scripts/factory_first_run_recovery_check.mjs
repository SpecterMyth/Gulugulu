// Real Edge regression for the first factory drop, a deliberately bad drop,
// rapid duplicate input, and visibility interruption recovery.
//
// Usage:
//   node scripts/factory_first_run_recovery_check.mjs [--lang zh|en] [--out path.json] [--quick]


import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import {
  closePage,
  configurePageTimeouts,
  createStageRunner,
  fetchWithTimeout,
  sleep,
  stopChild,
  waitForFonts,
  waitForWebSocketEndpoint,
  withTimeout,
} from "./browser_e2e_harness.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const repoDir = join(appDir, "..", "..");
const scratchDir = join(repoDir, ".claude", "scratchpad", `factory-first-run-${process.pid}`);
const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const rawOut = argValue("--out");
const outPath = rawOut == null ? null : isAbsolute(rawOut) ? rawOut : resolve(process.cwd(), rawOut);
const language = argValue("--lang") ?? "zh";
const quickMode = process.argv.includes("--quick");
const globalTimeoutMs = quickMode ? 180_000 : 300_000;
const stageTimeoutMs = quickMode ? 90_000 : 120_000;
const operationTimeoutMs = quickMode ? 20_000 : 30_000;
const navigationTimeoutMs = 90_000;
const cdpTimeoutMs = 90_000;
const fontTimeoutMs = 15_000;
if (language !== "zh" && language !== "en") {
  console.error(`Unsupported --lang ${JSON.stringify(language)}; expected zh or en.`);
  process.exit(1);
}
const expectedCopy = language === "zh"
  ? {
      retry: "没接稳",
      notice: "后台计时已暂停",
      success: "让第二只叠到第一只上",
      key: "空格键",
      failure: "✗ 气场不合，啪叽弹开！",
    }
  : {
      retry: "That one missed",
      notice: "Paused safely",
      success: "Stack the second coworker on the first",
      key: "SPACE",
      failure: "✗ Zero chemistry. Boing!",
    };

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
// Avoid Windows Hyper-V/WSL dynamic exclusions, which commonly reserve much
// of 4414-5002 and otherwise make this deterministic browser probe flaky.
const port = 4000 + (process.pid % 80);
const baseUrl = `http://127.0.0.1:${port}/`;
const vite = spawn(
  process.execPath,
  [join(appDir, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: appDir, env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "ignore", "pipe"], windowsHide: true },
);
let viteError = "";
vite.stderr.on("data", (chunk) => {
  viteError = (viteError + chunk.toString()).slice(-4000);
});

const waitForServer = async () => {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (vite.exitCode != null) break;
    try {
      const response = await fetchWithTimeout(baseUrl, 2_000);
      if (response.ok) return;
    } catch {
      // Vite is still warming up.
    }
    await sleep(250);
  }
  throw new Error(`Vite did not become ready (exit=${vite.exitCode}).\n${viteError}`);
};

const fullViewports = [
  { name: "fhd-150", width: 1280, height: 720 },
  { name: "hd-150", width: 853, height: 480 },
  { name: "stress-640", width: 640, height: 480 },
];
const viewports = quickMode ? [fullViewports.at(-1)] : fullViewports;
const runtimeErrors = [];
const results = { geometry: [], failure: null, success: null };
const stageTimings = [];
const cleanup = [];
const runStage = createStageRunner(stageTimings, stageTimeoutMs);
let browserProcess = null;
let browser = null;

const attachErrorCapture = (page, label) => {
  page.on("pageerror", (error) => runtimeErrors.push(`${label}: pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location().url ?? "";
    const missingFavicon = message.text().startsWith("Failed to load resource") && /favicon\.ico(?:$|\?)/.test(location);
    if (!missingFavicon) runtimeErrors.push(`${label}: console: ${message.text()} @ ${location}`);
  });
};

const startFreshPage = async (label) => {
  const page = await browser.newPage();
  configurePageTimeouts(page, { operationTimeoutMs, navigationTimeoutMs });
  attachErrorCapture(page, label);
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  // Build a roster-rich preview save first, then put only the onboarding state
  // at C02. This stays in the isolated Edge profile and exercises the same app
  // bridge/load path as a real new player entering the factory.
  await page.goto(`${baseUrl}?ui=pet&seed=rich&lang=${language}&fresh=${label}`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForFunction(() => localStorage.getItem("gulugulu.mock-save") != null, { timeout: 15_000 });
  await page.evaluate(() => {
    const key = "gulugulu.mock-save";
    const save = JSON.parse(localStorage.getItem(key) ?? "null");
    if (save == null) throw new Error("Preview save was not initialized");
    save.version = 10;
    save.onboarding = {
      version: 6,
      status: "active",
      step: "C02",
      tutorialWorkClicks: 0,
      tutorialFusions: 0,
      starterTrioClaimed: true,
      postPracticeRosterClaimed: true,
      factoryFormalEntered: false,
      agentPromptSkipped: false,
      steamMarketOpenAttempted: false,
    };
    save.factoryTutorial = { version: 2, status: "active", step: "C02" };
    save.stats ??= {};
    save.stats.factoryRogueRunsStarted = 0;
    save.stats.factoryRogueRunsFinished = 0;
    localStorage.setItem(key, JSON.stringify(save));
    localStorage.removeItem("gulugulu.factory_rogue.run.v1");
    localStorage.removeItem("gulugulu.factory_rogue.lastLoadout");
    localStorage.removeItem("gulugulu.factory.strike-warning.v1");
  });
  await page.goto(`${baseUrl}?ui=factory&lang=${language}&frdebug=1&frseed=121212`, {
    waitUntil: "domcontentloaded",
    timeout: navigationTimeoutMs,
  });
  await page.waitForSelector(".fr-lo-wrap", { timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector(".onboarding-goal[data-placement-ready='true']") != null, { timeout: 15_000 });
  await waitForFonts(page, fontTimeoutMs, `${label}/fonts`);
  return page;
};

const finishHiring = async (page) => {
  for (let action = 0; action < 8; action += 1) {
    if ((await page.$(".fr-hiring-panel")) == null) return;
    let pay = await page.$(".fr-hiring-clock:not([disabled])");
    if (pay == null) {
      const selectAll = await page.$(".fr-hiring-select-all:not([disabled])");
      if (selectAll != null) {
        await selectAll.click();
        await new Promise((resolveWait) => setTimeout(resolveWait, 120));
        pay = await page.$(".fr-hiring-clock:not([disabled])");
      }
    }
    if (pay == null) {
      const context = await page.evaluate(() => ({
        view: window.__frRun?.view() ?? null,
        selected: document.querySelectorAll(".fr-hiring-card.is-selected").length,
        payText: document.querySelector(".fr-hiring-clock")?.textContent?.trim() ?? "",
      }));
      throw new Error(`Hiring confirmation button is disabled: ${JSON.stringify(context)}`);
    }
    await pay.click();
    await new Promise((resolveWait) => setTimeout(resolveWait, 120));
    const confirm = await page.$(".fr-hiring-confirm .is-confirm");
    if (confirm != null) await confirm.click();
    await new Promise((resolveWait) => setTimeout(resolveWait, 1250));
  }
  if ((await page.$(".fr-hiring-panel")) != null) throw new Error("Hiring did not reach the shift after eight actions");
};

const reachFirstShift = async (page) => {
  await page.click(".fr-lo-clockin");
  await page.waitForSelector(".fr-hiring-panel", { timeout: 15_000 });
  await finishHiring(page);
  await page.waitForSelector(".fhp-root", { timeout: 15_000 });
  await page.waitForFunction(
    () => typeof window.__facBodies === "function"
      && window.__frRun?.view().phase === "shift"
      && document.querySelector(".fac-drop-guide") != null
      && document.querySelector(".onboarding-goal[data-placement-ready='true']") != null,
    { timeout: 20_000 },
  );
};

const sampleGeometry = async (page, viewport) => {
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
  await new Promise((resolveWait) => setTimeout(resolveWait, 180));
  return page.evaluate(async ({ viewportName }) => {
    const rect = (element) => {
      if (element == null) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const overlap = (left, right) => left == null || right == null ? 0
      : Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
        * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
    const visible = (element) => {
      if (element == null) return false;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01
        && box.width > 0.5 && box.height > 0.5;
    };
    const card = document.querySelector(".onboarding-goal");
    const dropKey = document.querySelector(".factory-guide-drop-key");
    const leftHud = document.querySelector(".fhp-col-l");
    const rightHud = document.querySelector(".fhp-col-r");
    const quit = document.querySelector(".fhp-quit");
    const cardRect = rect(card);
    const dropKeyRect = rect(dropKey);
    const critical = [leftHud, rightHud, quit, dropKey].filter(visible).map((element) => ({
      selector: element.classList.contains("fhp-col-l") ? ".fhp-col-l"
        : element.classList.contains("fhp-col-r") ? ".fhp-col-r"
          : element.classList.contains("fhp-quit") ? ".fhp-quit" : ".factory-guide-drop-key",
      rect: rect(element),
    }));
    let maxMarkerOverlap = 0;
    let markerOverlapSamples = 0;
    let readySamples = 0;
    for (let sample = 0; sample < 28; sample += 1) {
      const marker = document.querySelector(".fac-drop-guide");
      const markerRect = rect(marker);
      const area = overlap(cardRect, markerRect);
      maxMarkerOverlap = Math.max(maxMarkerOverlap, area);
      if (area > 4) markerOverlapSamples += 1;
      if (marker?.classList.contains("is-ready")) readySamples += 1;
      await new Promise((resolveWait) => setTimeout(resolveWait, 80));
    }
    const criticalOverlaps = critical.flatMap((item) => {
      const area = overlap(cardRect, item.rect);
      return area > 4 ? [{ selector: item.selector, area: Math.round(area) }] : [];
    });
    return {
      viewportName,
      viewport: { width: innerWidth, height: innerHeight },
      guideText: card?.querySelector("p")?.textContent?.trim() ?? "",
      guidePlacement: card?.dataset.placement ?? null,
      guideTargetOverlapFlag: card?.dataset.targetOverlap ?? null,
      cardRect,
      dropKeyRect,
      criticalOverlaps,
      maxMarkerOverlap: Math.round(maxMarkerOverlap),
      markerOverlapSamples,
      readySamples,
      documentOverflowX: document.documentElement.scrollWidth - innerWidth,
      passed: visible(card)
        && cardRect != null
        && cardRect.left >= -1
        && cardRect.right <= innerWidth + 1
        && cardRect.top >= -1
        && cardRect.bottom <= innerHeight + 1
        && criticalOverlaps.length === 0
        && maxMarkerOverlap <= 4
        && document.documentElement.scrollWidth - innerWidth <= 1,
    };
  }, { viewportName: viewport.name });
};

const runFailureRecovery = async (page) => {
  await page.setViewport({ width: 640, height: 480, deviceScaleFactor: 1 });
  await page.waitForFunction(() => {
    const marker = document.querySelector(".fac-drop-guide");
    const plane = document.querySelector(".fac-plane")?.getBoundingClientRect();
    if (marker?.dataset.state !== "wait" || plane == null) return false;
    const planeX = (plane.left + plane.right) / 2;
    return [...document.querySelectorAll(".fac-desk.is-carried-dim")].some((desk) => {
      const box = desk.getBoundingClientRect();
      return planeX >= box.left + box.width * 0.25 && planeX <= box.right - box.width * 0.25;
    });
  }, { timeout: 15_000, polling: 40 });
  const before = await page.evaluate(() => window.__frRun.view().stats);
  // Subscribe before the drop: the failure cue is intentionally short-lived,
  // while an unrelated body can satisfy the aggregate bounce counter first.
  const failureCue = page.waitForSelector(".fr-float.miss", { timeout: 8_000 });
  await page.keyboard.press("Space");
  await page.waitForFunction((throws) => window.__frRun.view().stats.throws === throws + 1, { timeout: 3_000 }, before.throws);
  await failureCue;
  const failed = await page.evaluate(() => {
    const rect = (element) => {
      if (element == null) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const overlap = (left, right) => left == null || right == null ? 0
      : Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
        * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
    const guide = document.querySelector(".onboarding-goal");
    const failure = document.querySelector(".fr-float.miss");
    const failureRect = rect(failure);
    const hudOverlaps = [".fhp-col-l", ".fhp-col-r"].map((selector) => ({
      selector,
      area: Math.round(overlap(failureRect, rect(document.querySelector(selector)))),
    }));
    return {
      stats: window.__frRun.view().stats,
      guideText: guide?.querySelector("p")?.textContent?.trim() ?? "",
      failureText: failure?.textContent?.trim() ?? "",
      failureRect,
      failureGuideOverlap: Math.round(overlap(failureRect, rect(guide))),
      failureHudOverlaps: hudOverlaps,
      failureLayerPointerEvents: getComputedStyle(document.querySelector(".fr-float-layer")).pointerEvents,
      settled: window.__facBodies().filter((body) => body.settled).length,
    };
  });
  await page.waitForFunction((bounces) => window.__frRun.view().stats.bounces > bounces, { timeout: 8_000 }, before.bounces);

  await page.evaluate(() => {
    window.__round12Hidden = false;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => window.__round12Hidden });
    window.__setRound12Hidden = (hidden) => {
      window.__round12Hidden = hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    };
    window.__setRound12Hidden(true);
  });
  await new Promise((resolveWait) => setTimeout(resolveWait, 750));
  await page.evaluate(() => window.__setRound12Hidden(false));
  await page.waitForSelector(".fr-resume-notice", { timeout: 3_000 });
  const recovered = await page.evaluate(() => {
    const rect = (element) => {
      if (element == null) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    const overlap = (left, right) => left == null || right == null ? 0
      : Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
        * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
    const guide = document.querySelector(".onboarding-goal");
    const notice = document.querySelector(".fr-resume-notice");
    return {
      stats: window.__frRun.view().stats,
      guideText: guide?.querySelector("p")?.textContent?.trim() ?? "",
      noticeText: notice?.textContent?.trim() ?? "",
      guideNoticeOverlap: Math.round(overlap(rect(guide), rect(notice))),
      guideVisible: guide != null && getComputedStyle(guide).visibility !== "hidden",
      markerPresent: document.querySelector(".fac-drop-guide") != null,
    };
  });
  return {
    before,
    failed,
    recovered,
    passed: failed.stats.throws === before.throws + 1
      && failed.stats.bounces > before.bounces
      && failed.settled === 0
      && failed.guideText.includes(expectedCopy.retry)
      && failed.failureText === expectedCopy.failure
      && failed.failureGuideOverlap === 0
      && failed.failureHudOverlaps.every((item) => item.area === 0)
      && failed.failureLayerPointerEvents === "none"
      && recovered.stats.throws === failed.stats.throws
      && recovered.stats.bounces === failed.stats.bounces
      && recovered.guideText.includes(expectedCopy.retry)
      && recovered.noticeText.includes(expectedCopy.notice)
      && recovered.guideNoticeOverlap === 0
      && recovered.guideVisible
      && recovered.markerPresent,
  };
};

const runRapidSuccess = async (page) => {
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.waitForFunction(() => document.querySelector(".fac-drop-guide")?.dataset.state === "ready", { timeout: 20_000, polling: 40 });
  const before = await page.evaluate(() => window.__frRun.view().stats);
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await page.keyboard.press("Space");
  await page.waitForFunction((throws) => window.__frRun.view().stats.throws > throws, { timeout: 3_000 }, before.throws);
  await new Promise((resolveWait) => setTimeout(resolveWait, 120));
  const immediate = await page.evaluate(() => window.__frRun.view().stats);
  await page.waitForFunction(() => window.__facBodies().some((body) => body.settled), { timeout: 8_000 });
  await page.waitForFunction((expected) => {
    const label = document.querySelector(".onboarding-goal p")?.textContent ?? "";
    return label.includes(expected);
  }, { timeout: 3_000 }, expectedCopy.success);
  const final = await page.evaluate(() => ({
    stats: window.__frRun.view().stats,
    settled: window.__facBodies().filter((body) => body.settled).length,
    guideText: document.querySelector(".onboarding-goal p")?.textContent?.trim() ?? "",
    targetNote: document.querySelector(".onboarding-target-note")?.textContent?.trim() ?? "",
  }));
  return {
    before,
    immediate,
    final,
    passed: immediate.throws === before.throws + 1
      && final.stats.throws === before.throws + 1
      && final.settled >= 1
      && final.guideText.includes(expectedCopy.success)
      && final.targetNote.includes(expectedCopy.key),
  };
};

const runScenario = async () => {
  await runStage("vite/ready", waitForServer, 60_000);
  let browserError = "";
  await runStage("browser/connect", async () => {
    browserProcess = spawn(browserPath, [
      "--headless=new",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--no-first-run",
      "--disable-extensions",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      `--user-data-dir=${join(scratchDir, "profile")}`,
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=0",
      "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
    browserProcess.stderr.on("data", (chunk) => {
      browserError = (browserError + chunk.toString()).slice(-4000);
    });
    const webSocketDebuggerUrl = await waitForWebSocketEndpoint(browserProcess, cdpTimeoutMs);
    if (!webSocketDebuggerUrl) throw new Error(`Browser debug endpoint did not start.\n${browserError}`);
    browser = await puppeteer.connect({ browserWSEndpoint: webSocketDebuggerUrl, protocolTimeout: cdpTimeoutMs });
  });

  let failurePage = null;
  try {
    failurePage = await runStage("failure/setup", async () => {
      const page = await startFreshPage("failure");
      await reachFirstShift(page);
      return page;
    });
    await runStage("failure/geometry", async () => {
      for (const viewport of viewports) {
        const result = await sampleGeometry(failurePage, viewport);
        results.geometry.push(result);
        console.log(`${result.passed ? "PASS" : "FAIL"} geometry/${viewport.name}`);
      }
    });
    results.failure = await runStage("failure/recovery", () => runFailureRecovery(failurePage));
    console.log(`${results.failure.passed ? "PASS" : "FAIL"} failure-and-resume`);
  } finally {
    await closePage(failurePage).catch((error) => runtimeErrors.push(`failure/page-close: ${error.message}`));
  }

  let successPage = null;
  try {
    successPage = await runStage("success/setup", async () => {
      const page = await startFreshPage("success");
      await reachFirstShift(page);
      return page;
    });
    results.success = await runStage("success/rapid-input", () => runRapidSuccess(successPage));
    console.log(`${results.success.passed ? "PASS" : "FAIL"} ready-drop-rapid-input`);
  } finally {
    await closePage(successPage).catch((error) => runtimeErrors.push(`success/page-close: ${error.message}`));
  }
};

try {
  await withTimeout(runScenario(), globalTimeoutMs, "first-run global watchdog");
} catch (error) {
  runtimeErrors.push(error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error));
} finally {
  if (browser != null) {
    await withTimeout(browser.disconnect(), 10_000, "browser.disconnect")
      .catch((error) => runtimeErrors.push(`browser/disconnect: ${error.message}`));
  }
  for (const [child, label] of [[browserProcess, "headless browser"], [vite, "Vite server"]]) {
    try {
      cleanup.push(await stopChild(child, label));
    } catch (error) {
      runtimeErrors.push(`cleanup/${label}: ${error.message}`);
    }
  }
}

const checks = [
  ...results.geometry.map((result) => result.passed),
  results.failure?.passed === true,
  results.success?.passed === true,
];
const report = {
  generatedAt: new Date().toISOString(),
  environment: {
    browserPath,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    language,
    quickMode,
    timeouts: { globalTimeoutMs, stageTimeoutMs, operationTimeoutMs, navigationTimeoutMs, cdpTimeoutMs, fontTimeoutMs },
  },
  summary: {
    checks: checks.length,
    passed: checks.filter(Boolean).length,
    failed: checks.filter((value) => !value).length,
    runtimeErrors: runtimeErrors.length,
  },
  results,
  stageTimings,
  cleanup,
  runtimeErrors,
  passed: checks.length === viewports.length + 2 && checks.every(Boolean) && runtimeErrors.length === 0,
};

if (outPath != null) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
if (runtimeErrors.length > 0) console.error(runtimeErrors.join("\n"));
console.log(`${report.passed ? "PASS" : "FAIL"} ${report.summary.passed}/${report.summary.checks} first-run recovery checks`);
process.exit(report.passed ? 0 : 1);
