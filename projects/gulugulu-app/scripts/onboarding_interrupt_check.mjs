// Real-browser interruption, recovery, and rapid-repeat regression for the main onboarding route.
//
// The probe uses the production App + BrowserGameBridge. It seeds persisted checkpoints,
// recovers a target from the wrong UI mode (including a full reload), then counts writes
// to the authoritative browser save while rapidly repeating a CTA and the full-route skip.
//
// Usage:
//   node scripts/onboarding_interrupt_check.mjs [--out path.json] [--shot]

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const repoDir = join(appDir, "..", "..");
const scratchDir = join(repoDir, ".claude", "scratchpad", `onboarding-interrupt-${process.pid}`);
const saveKey = "gulugulu.mock-save.test";

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const rawOut = argValue("--out");
const outPath = rawOut == null ? null : isAbsolute(rawOut) ? rawOut : resolve(process.cwd(), rawOut);
const captureShot = process.argv.includes("--shot");

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
const port = 4100 + (process.pid % 80);
const baseUrl = `http://127.0.0.1:${port}/?test=1`;
const vite = spawn(
  process.execPath,
  [join(appDir, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: appDir, stdio: ["ignore", "ignore", "pipe"], windowsHide: true },
);
let viteError = "";
vite.stderr.on("data", (chunk) => {
  viteError = (viteError + chunk.toString()).slice(-4000);
});

const waitForServer = async () => {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (vite.exitCode != null) break;
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Vite is still warming up.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Vite did not become ready (exit=${vite.exitCode}).\n${viteError}`);
};

const runtimeErrors = [];
const checkpoints = [];
const screenshots = [];
let browserProcess = null;
let browser = null;

const seedStep = async (page, step) => {
  await page.evaluate(
    ({ key, requestedStep }) => {
      const save = JSON.parse(localStorage.getItem(key));
      save.onboarding = {
        ...save.onboarding,
        status: "active",
        step: requestedStep,
      };
      localStorage.setItem(key, JSON.stringify(save));
    },
    { key: saveKey, requestedStep: step },
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector(".onboarding-goal[data-placement-ready='true']", { timeout: 30_000 });
};

const readPersisted = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);

const takeShot = async (page, label) => {
  if (!captureShot) return;
  const path = outPath?.replace(/\.json$/i, `-${label}.png`) ?? join(scratchDir, `${label}.png`);
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path });
  screenshots.push(relative(repoDir, path).replaceAll("\\", "/"));
};

try {
  await waitForServer();
  const debugPort = 9900 + (process.pid % 90);
  browserProcess = spawn(browserPath, [
    "--headless=new",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--no-first-run",
    "--disable-extensions",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    `--user-data-dir=${join(scratchDir, "profile")}`,
    `--remote-debugging-port=${debugPort}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  let browserError = "";
  browserProcess.stderr.on("data", (chunk) => {
    browserError = (browserError + chunk.toString()).slice(-4000);
  });

  let webSocketDebuggerUrl = "";
  for (let attempt = 0; attempt < 100 && !webSocketDebuggerUrl; attempt += 1) {
    if (browserProcess.exitCode != null) break;
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      webSocketDebuggerUrl = (await response.json()).webSocketDebuggerUrl;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  if (!webSocketDebuggerUrl) throw new Error(`Browser debug endpoint did not start.\n${browserError}`);
  browser = await puppeteer.connect({ browserWSEndpoint: webSocketDebuggerUrl });

  const page = await browser.newPage();
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location().url ?? "";
    const missingFavicon = message.text().startsWith("Failed to load resource") && /favicon\.ico(?:$|\?)/.test(location);
    if (!missingFavicon) runtimeErrors.push(`console: ${message.text()} @ ${location}`);
  });
  await page.evaluateOnNewDocument((key) => {
    const original = Storage.prototype.setItem;
    window.__onboardingSaveWrites = 0;
    Storage.prototype.setItem = function instrumentedSetItem(storageKey, value) {
      if (this === localStorage && storageKey === key) window.__onboardingSaveWrites += 1;
      return original.call(this, storageKey, value);
    };
  }, saveKey);
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector(".onboarding-goal", { timeout: 30_000 });

  // A Steam AI-slot result may be bound before optional local species metadata exists.
  // Its owned T2 pet instance must still close B05 and grant the first six-pet roster.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key));
    const aiPetId = "steam-ai-tier2-result";
    save.eggs = [];
    save.pets = [{
      id: aiPetId,
      species: "aif0701",
      tier: 2,
      level: 1,
      exp: 0,
      stamina: 200,
      staminaUpdatedAt: 1_000,
      exhausted: false,
      pendingFusion: null,
      keyBuffer: 0,
      tokenBuffer: 0,
      steamItemId: "steam-ai-result",
      steamItemDef: 10_701,
    }];
    save.activePetId = aiPetId;
    save.customSpecies = {};
    save.capacityExemptPetIds = [];
    save.onboarding = {
      ...save.onboarding,
      status: "active",
      step: "B05",
      tutorialFusions: 1,
      starterTrioClaimed: false,
    };
    localStorage.setItem(key, JSON.stringify(save));
  }, saveKey);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).onboarding.step === "B06",
    { timeout: 15_000 },
    saveKey,
  );
  const aiFusionRecovery = await readPersisted(page);
  assert.equal(aiFusionRecovery.pets.length, 7, "AI result plus six roster pets expected");
  assert.equal(aiFusionRecovery.pets.filter((pet) => pet.tier === 1).length, 6);
  assert.equal(aiFusionRecovery.capacityExemptPetIds.length, 6);
  assert.equal(aiFusionRecovery.onboarding.starterTrioClaimed, true);
  assert.equal(aiFusionRecovery.customSpecies.aif0701, undefined);
  checkpoints.push({
    name: "B05 Steam AI result without local metadata",
    step: aiFusionRecovery.onboarding.step,
    pets: aiFusionRecovery.pets.length,
    passed: true,
  });

  // Recovery from the wrong main-screen mode must lead to a real target, not a dead CTA.
  await seedStep(page, "G01");
  const recoveryButton = await page.waitForSelector(".onboarding-goal button:not(.onboarding-skip)", { timeout: 10_000 });
  assert.match(await recoveryButton.evaluate((element) => element.textContent ?? ""), /正确位置|right place/i);
  await recoveryButton.click();
  await page.waitForSelector(".backyard [data-coach='marketPoi']", { timeout: 15_000 });
  checkpoints.push({ name: "wrong-mode recovery", step: (await readPersisted(page)).onboarding.step, passed: true });
  await takeShot(page, "recovered-market");

  // A full process-like page reload forgets UI mode. The persisted cursor must offer the same recovery again.
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  const resumedRecovery = await page.waitForSelector(".onboarding-goal button:not(.onboarding-skip)", { timeout: 15_000 });
  assert.match(await resumedRecovery.evaluate((element) => element.textContent ?? ""), /正确位置|right place/i);
  checkpoints.push({ name: "reload recovery", step: (await readPersisted(page)).onboarding.step, passed: true });

  // Same-task click spam is harsher than physical clicking: React cannot repaint disabled state between clicks.
  // The task queue still has to collapse all 25 receipts into one authoritative mutation.
  await seedStep(page, "G05");
  await page.evaluate(() => { window.__onboardingSaveWrites = 0; });
  await page.evaluate(() => {
    const button = document.querySelector(".onboarding-goal button:not(.onboarding-skip)");
    for (let index = 0; index < 25; index += 1) button.click();
  });
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).onboarding.step === "G06",
    { timeout: 15_000 },
    saveKey,
  );
  const repeatedAction = await page.evaluate((key) => ({
    writes: window.__onboardingSaveWrites,
    onboarding: JSON.parse(localStorage.getItem(key)).onboarding,
    busy: document.querySelector(".onboarding-goal")?.getAttribute("aria-busy"),
  }), saveKey);
  assert.equal(repeatedAction.writes, 1, "25 repeated G05 clicks must persist exactly one receipt");
  assert.equal(repeatedAction.onboarding.step, "G06", "repeat clicks must advance exactly one step");
  checkpoints.push({ name: "25x CTA single-flight", ...repeatedAction, passed: true });

  // Reload from the newly persisted cursor, proving the exact step is resumable.
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(
    () => document.querySelector(".onboarding-goal small")?.textContent?.trim().length > 0,
    { timeout: 15_000 },
  );
  assert.equal((await readPersisted(page)).onboarding.step, "G06");
  checkpoints.push({ name: "post-CTA reload", step: "G06", passed: true });

  // Full-route skip from G05 has four legitimate writes: G05, G06, G07/DONE,
  // plus the idempotent tutorial-fusion reward/outbox catch-up introduced by
  // the expanded four-recipe route.
  await seedStep(page, "G05");
  await page.evaluate(() => { window.__onboardingSaveWrites = 0; });
  await page.click(".onboarding-skip");
  await page.waitForSelector(".onboarding-confirm-note[role='dialog']", { timeout: 10_000 });
  await page.evaluate(() => {
    const button = document.querySelector(".onboarding-confirm-skip");
    for (let index = 0; index < 25; index += 1) button.click();
  });
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).onboarding.status === "completed",
    { timeout: 15_000 },
    saveKey,
  );
  const repeatedSkip = await page.evaluate((key) => ({
    writes: window.__onboardingSaveWrites,
    onboarding: JSON.parse(localStorage.getItem(key)).onboarding,
  }), saveKey);
  assert.equal(repeatedSkip.writes, 4, "25 repeated skip clicks must persist one bounded route/reward sequence");
  assert.equal(repeatedSkip.onboarding.step, "DONE");
  checkpoints.push({ name: "25x full skip single-flight", ...repeatedSkip, passed: true });

  await page.close();
} catch (error) {
  runtimeErrors.push(error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error));
} finally {
  if (browser != null) await browser.disconnect().catch(() => {});
  if (browserProcess != null && browserProcess.exitCode == null) browserProcess.kill();
  if (vite.exitCode == null) vite.kill();
}

const output = {
  generatedAt: new Date().toISOString(),
  environment: {
    browser: browserPath,
    viewport: "1280x720 @1x",
    appUrl: baseUrl,
    authoritativeSaveKey: saveKey,
  },
  checkpoints,
  screenshots,
  runtimeErrors,
  passed: runtimeErrors.length === 0 && checkpoints.length === 6 && checkpoints.every((item) => item.passed),
};
if (outPath != null) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(output, null, 2));
if (!output.passed) process.exitCode = 1;
