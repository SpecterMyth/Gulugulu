// Production-browser click regression for the post-first-factory onboarding expansion.
// It uses the real App + BrowserGameBridge and only advances targeted steps by
// clicking the same visible DOM controls a player clicks.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const repoDir = join(appDir, "..", "..");
const scratchDir = join(repoDir, ".claude", "scratchpad", `onboarding-expansion-${process.pid}`);
const saveKey = "gulugulu.mock-save";
const freshSaveKey = "gulugulu.mock-save.test";
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
// Keep the deterministic test port below Windows' commonly reserved
// Hyper-V/WSL ranges (this host currently excludes much of 4414-5002).
const port = 4200 + (process.pid % 100);
const baseUrl = `http://127.0.0.1:${port}/`;
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

const readSave = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);
const stepOf = (save) => save.onboarding?.step;

const waitForStep = async (page, step) => {
  await page.waitForFunction(
    ({ key, expected }) => {
      const save = JSON.parse(localStorage.getItem(key) ?? "null");
      return save?.onboarding?.step === expected &&
        document.querySelector(`.onboarding-goal[data-step='${expected}'][data-placement-ready='true']`) != null;
    },
    { timeout: 30_000 },
    { key: saveKey, expected: step },
  );
};

const geometry = async (page, step, selector, targetMayBeInsideGuide = false) => {
  const result = await page.evaluate(({ expectedStep, targetSelector, insideGuide }) => {
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
        && box.width > 1 && box.height > 1;
    };
    const guide = document.querySelector(`.onboarding-goal[data-step='${expectedStep}']`);
    const target = [...document.querySelectorAll(targetSelector)].find(visible) ?? null;
    const guideRect = rect(guide);
    const targetRect = rect(target);
    const centerHit = targetRect == null ? null
      : document.elementFromPoint(
          targetRect.left + targetRect.width / 2,
          targetRect.top + targetRect.height / 2,
        );
    return {
      guideRect,
      targetRect,
      targetVisible: visible(target),
      overlap: insideGuide ? 0 : Math.round(overlap(guideRect, targetRect)),
      targetOverlapFlag: guide?.dataset.targetOverlap ?? null,
      centerHitsTarget: target != null && centerHit != null && (centerHit === target || target.contains(centerHit)),
      centerHitTag: centerHit instanceof Element ? centerHit.tagName : null,
      centerHitClass: centerHit instanceof Element ? centerHit.getAttribute("class") : null,
      centerHitCoach: centerHit instanceof Element
        ? centerHit.closest("[data-coach]")?.getAttribute("data-coach") ?? null
        : null,
      centerHitPreview: centerHit instanceof Element ? centerHit.outerHTML.slice(0, 240) : null,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      viewport: { width: innerWidth, height: innerHeight },
    };
  }, { expectedStep: step, targetSelector: selector, insideGuide: targetMayBeInsideGuide });

  assert.ok(result.guideRect, `${step}: guide card is missing`);
  assert.ok(result.targetVisible, `${step}: target ${selector} is not visible`);
  assert.ok(result.guideRect.left >= -1 && result.guideRect.top >= -1, `${step}: guide starts outside the viewport`);
  assert.ok(
    result.guideRect.right <= result.viewport.width + 1 && result.guideRect.bottom <= result.viewport.height + 1,
    `${step}: guide ends outside the viewport`,
  );
  assert.equal(result.overlap, 0, `${step}: guide covers ${selector}`);
  assert.notEqual(result.targetOverlapFlag, "true", `${step}: placement engine reported target overlap`);
  assert.ok(result.overflowX <= 1, `${step}: page has horizontal overflow (${result.overflowX}px)`);
  return result;
};

const clickTarget = async (page, step, selector, targetMayBeInsideGuide = false) => {
  await waitForStep(page, step);
  await page.waitForFunction(
    (targetSelector) => {
      return [...document.querySelectorAll(targetSelector)].some((target) => {
        const style = getComputedStyle(target);
        const rect = target.getBoundingClientRect();
        const visible = style.display !== "none" && style.visibility !== "hidden" &&
          Number(style.opacity) > 0.01 && rect.width > 1 && rect.height > 1 &&
          rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
        return visible && (!(target instanceof HTMLButtonElement) || !target.disabled);
      });
    },
    { timeout: 35_000 },
    selector,
  );
  const sampled = await geometry(page, step, selector, targetMayBeInsideGuide);
  assert.ok(
    sampled.centerHitsTarget,
    `${step}: ${selector} center is blocked by ${JSON.stringify({
      tag: sampled.centerHitTag,
      className: sampled.centerHitClass,
      coach: sampled.centerHitCoach,
      preview: sampled.centerHitPreview,
      targetRect: sampled.targetRect,
    })}`,
  );
  await page.mouse.click(
    sampled.targetRect.left + sampled.targetRect.width / 2,
    sampled.targetRect.top + sampled.targetRect.height / 2,
  );
  return sampled;
};

const beginGuidedWalk = async (page, name, maxInitialX) => {
  await page.waitForSelector("[data-coach='char']", { visible: true, timeout: 20_000 });
  const sample = () => page.$eval("[data-coach='char']", (character) => ({
    x: Number.parseFloat(character.style.left),
    walking: character.querySelector(".by-char-walk")?.classList.contains("is-walking") === true,
  }));
  const before = await sample();
  await page.keyboard.down("ArrowRight");
  await new Promise((resolveWait) => setTimeout(resolveWait, 350));
  const after = await sample();
  assert.ok(Number.isFinite(before.x) && Number.isFinite(after.x), `${name}: character position is unreadable`);
  assert.ok(before.x < maxInitialX, `${name}: character was teleported before the guided walk (${before.x})`);
  assert.ok(after.x > before.x + 20, `${name}: player input did not walk toward the target (${before.x} -> ${after.x})`);
  assert.ok(after.x - before.x < 180, `${name}: character jumped instead of walking (${before.x} -> ${after.x})`);
  assert.ok(before.walking || after.walking, `${name}: walking animation never became active`);
  return { before: before.x, after: after.x };
};

const walkToFusionAction = async (page, name, step, petId, actionCoach) => {
  await waitForStep(page, step);
  const placedSelector = `[data-coach='placedPet:${petId}']`;
  const actionSelector = `[data-coach='${actionCoach}:${petId}']`;
  await page.waitForSelector(placedSelector, { timeout: 20_000 });
  const sample = () => page.evaluate((selector) => {
    const pet = document.querySelector(selector);
    const character = document.querySelector("[data-coach='char']");
    if (!(pet instanceof HTMLElement) || !(character instanceof HTMLElement)) return null;
    return {
      petX: Number.parseFloat(pet.style.left),
      charX: Number.parseFloat(character.style.left),
      petVisible: getComputedStyle(pet).visibility !== "hidden",
    };
  }, placedSelector);
  const before = await sample();
  assert.ok(before && Number.isFinite(before.petX) && Number.isFinite(before.charX), `${name}: positions are unreadable`);
  const alreadyInRange = Math.abs(before.petX - before.charX) <= 100;

  // A click on the distant highlighted pet must not switch companions or center
  // the camera/character. The only way to reveal its action is player movement.
  const activeBeforeClick = (await readSave(page)).activePetId;
  await page.$eval(placedSelector, (element) => element.click());
  await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  const afterClick = await sample();
  assert.ok(afterClick, `${name}: positions disappeared after clicking the distant target`);
  assert.equal((await readSave(page)).activePetId, activeBeforeClick, `${name}: distant pet click switched companions`);
  assert.ok(Math.abs(afterClick.charX - before.charX) < 20, `${name}: distant pet click moved the player`);
  assert.ok(Math.abs(afterClick.petX - before.petX) < 100, `${name}: distant pet was pulled toward the player`);

  if (alreadyInRange) {
    await page.waitForSelector(actionSelector, { visible: true, timeout: 20_000 });
    const actionGeometry = await geometry(page, step, actionSelector);
    assert.ok(
      actionGeometry.centerHitsTarget,
      `${step}: ${actionSelector} center is blocked by ${JSON.stringify({
        tag: actionGeometry.centerHitTag,
        className: actionGeometry.centerHitClass,
        coach: actionGeometry.centerHitCoach,
        preview: actionGeometry.centerHitPreview,
      })}`,
    );
    return {
      alreadyInRange: true,
      player: [Math.round(before.charX), Math.round(afterClick.charX)],
      target: [Math.round(before.petX), Math.round(afterClick.petX)],
    };
  }

  const key = before.petX > before.charX ? "ArrowRight" : "ArrowLeft";
  await page.keyboard.down(key);
  try {
    await page.waitForSelector(actionSelector, { visible: true, timeout: 40_000 });
  } finally {
    await page.keyboard.up(key);
  }
  const afterWalk = await sample();
  assert.ok(afterWalk && Math.abs(afterWalk.charX - before.charX) > 20, `${name}: player did not walk to the target`);
  assert.ok(
    Math.abs(afterWalk.charX - afterWalk.petX) < Math.abs(before.charX - before.petX) - 100,
    `${name}: player did not close the distance to the target`,
  );
  assert.ok(Math.abs(afterWalk.petX - before.petX) < 100, `${name}: target station changed during the walk`);
  const actionGeometry = await geometry(page, step, actionSelector);
  assert.ok(
    actionGeometry.centerHitsTarget,
    `${step}: ${actionSelector} center is blocked by ${JSON.stringify({
      tag: actionGeometry.centerHitTag,
      className: actionGeometry.centerHitClass,
      coach: actionGeometry.centerHitCoach,
      preview: actionGeometry.centerHitPreview,
    })}`,
  );
  return {
    direction: key,
    player: [Math.round(before.charX), Math.round(afterWalk.charX)],
    target: [Math.round(before.petX), Math.round(afterWalk.petX)],
  };
};

const runtimeErrors = [];
const checkpoints = [];
let browserProcess = null;
let browser = null;

try {
  await waitForServer();
  const debugPort = 10100 + (process.pid % 90);
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
  await page.setViewport({ width: 640, height: 480, deviceScaleFactor: 1 });

  // A completed tutorial egg and the newly mounted pet share the same stage
  // coordinates. A player's double-click must collect exactly once and stop at
  // A02 instead of leaking the second pointer sequence into the pet work action.
  await page.goto(`${baseUrl}?test=1&lang=zh-Hans`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForFunction((key) => localStorage.getItem(key) != null, { timeout: 15_000 }, freshSaveKey);
  const welcomeStart = await page.$(".welcome-report button");
  if (welcomeStart) await welcomeStart.click();
  await page.waitForFunction(
    () => document.body.textContent?.includes("孵化完成！点我收取"),
    { timeout: 15_000 },
  );
  await page.click("[data-coach='egg']", { clickCount: 2, delay: 40 });
  await new Promise((resolveWait) => setTimeout(resolveWait, 800));
  const doubleClickSave = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), freshSaveKey);
  assert.equal(doubleClickSave.onboarding.step, "A02", "completed tutorial egg double-click crossed into A02");
  assert.equal(doubleClickSave.onboarding.tutorialWorkClicks, 0, "completed tutorial egg double-click earned work rewards");
  assert.equal(doubleClickSave.pets.length, 1, "completed tutorial egg double-click collected more than one pet");
  checkpoints.push({
    name: "completed tutorial egg double-click stays on A02",
    step: doubleClickSave.onboarding.step,
    tutorialWorkClicks: doubleClickSave.onboarding.tutorialWorkClicks,
    pets: doubleClickSave.pets.length,
  });

  // Build a fully shaped save through the production preview bootstrap, then
  // reduce it to the two parents a legacy three-pet grant could leave after
  // fusion #2. D09/D10 recovery must reconstruct the other two from inventory
  // facts instead of trusting old reward receipts.
  await page.goto(`${baseUrl}?ui=pet&seed=rich&lang=en&fresh=expansion`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForFunction((key) => localStorage.getItem(key) != null, { timeout: 15_000 }, saveKey);
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key));
    const now = Math.floor(Date.now() / 1000);
    const makePet = (id, species, tier = 1, level = 10) => ({
      id,
      species,
      tier,
      level,
      exp: 0,
      stamina: 100,
      staminaUpdatedAt: now,
      exhausted: false,
      keyBuffer: 0,
      tokenBuffer: 0,
    });
    save.version = 10;
    save.coins = 0;
    save.pets = [
      makePet("guide-grass", "sproutcap"),
      makePet("guide-ice", "frostpeng"),
      makePet("guide-tier2-a", "waxlamb", 2, 1),
      makePet("guide-tier2-b", "voltmare", 2, 1),
    ];
    save.eggs = [];
    save.activePetId = "guide-tier2-a";
    save.hatcheryLevel = 1;
    save.yardLevel = 1;
    save.capacityExemptPetIds = save.pets.map((pet) => pet.id);
    save.daily = { date: new Date().toISOString().slice(0, 10), clicks: 0, eggMints: {}, fusionMints: {} };
    save.onboarding = {
      version: 6,
      status: "active",
      step: "D01",
      tutorialWorkClicks: 20,
      tutorialFusions: 2,
      starterTrioClaimed: true,
      postPracticeRosterClaimed: true,
      postYardRosterClaimed: false,
      guidedFusionEggIds: [],
      factoryFormalEntered: false,
      agentPromptSkipped: false,
      steamMarketOpenAttempted: false,
    };
    save.factoryTutorial = { version: 2, status: "completed", step: "DONE" };
    localStorage.setItem(key, JSON.stringify(save));
  }, saveKey);

  // D01 must be visible over the factory and its button must actually return
  // the player to the main menu before the route continues.
  await page.goto(`${baseUrl}?ui=factory&lang=en`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const d01Button = ".onboarding-goal[data-step='D01'] button:not(.onboarding-skip)";
  await clickTarget(page, "D01", d01Button, true);
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).onboarding.step === "D02" &&
      document.querySelector(".game-menubar [data-coach='menuBackyard']") != null,
    { timeout: 20_000 },
    saveKey,
  );
  checkpoints.push({ name: "first factory returns to main", step: stepOf(await readSave(page)) });

  // Pure acknowledgement copy has a visible breathing CTA, while the browser
  // still honors reduced-motion through CSS (covered by the stylesheet check).
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key));
    save.onboarding.step = "B06";
    localStorage.setItem(key, JSON.stringify(save));
  }, saveKey);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await waitForStep(page, "B06");
  const breathing = await page.$eval(".onboarding-goal[data-step='B06'] button:not(.onboarding-skip)", (button) => ({
    className: button.className,
    animationName: getComputedStyle(button).animationName,
    animationDuration: getComputedStyle(button).animationDuration,
  }));
  assert.match(breathing.className, /is-breathing/);
  assert.notEqual(breathing.animationName, "none");
  checkpoints.push({ name: "acknowledgement CTA breathes", ...breathing });

  // Fusion #2 uses the same walk-first contract as #3/#4: clicking a distant
  // highlighted parent does nothing, and the follow/fuse controls appear only
  // after the player walks the character into range.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key));
    const now = Math.floor(Date.now() / 1000);
    const makePet = (id, species) => ({
      id,
      species,
      tier: 1,
      level: 10,
      exp: 0,
      stamina: 100,
      staminaUpdatedAt: now,
      exhausted: false,
      keyBuffer: 0,
      tokenBuffer: 0,
    });
    save.pets.push(makePet("walk-water", "bubblefrog"), makePet("walk-electric", "voltmouse"));
    save.capacityExemptPetIds.push("walk-water", "walk-electric");
    save.activePetId = "guide-tier2-a";
    save.onboarding.step = "D04";
    save.onboarding.tutorialFusions = 1;
    localStorage.setItem(key, JSON.stringify(save));
  }, saveKey);
  await page.goto(`${baseUrl}?ui=backyard&lang=en`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const secondFirstWalk = await walkToFusionAction(page, "fusion #2 first parent", "D04", "walk-water", "followBtn");
  await clickTarget(page, "D04", "[data-coach='followBtn:walk-water']");
  await waitForStep(page, "D05");
  const secondPartnerWalk = await walkToFusionAction(page, "fusion #2 partner", "D05", "walk-electric", "fuseBtn");
  await clickTarget(page, "D05", "[data-coach='fuseBtn:walk-electric']");
  await clickTarget(page, "D06", "[data-coach='fuseConfirm']");
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).onboarding.tutorialFusions === 2,
    { timeout: 20_000 },
    saveKey,
  );
  checkpoints.push({
    name: "second fusion walks to both parents",
    first: secondFirstWalk,
    partner: secondPartnerWalk,
  });

  // Restore the interruption fixture before the new D08-D11 route checks.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key));
    save.pets = save.pets.filter((pet) => [
      "guide-grass",
      "guide-ice",
      "guide-tier2-a",
      "guide-tier2-b",
    ].includes(pet.id));
    save.eggs = [];
    save.activePetId = "guide-tier2-a";
    save.capacityExemptPetIds = save.pets.map((pet) => pet.id);
    save.onboarding.step = "D08";
    save.onboarding.tutorialFusions = 2;
    save.onboarding.guidedFusionEggIds = [];
    save.daily.fusionMints = {};
    localStorage.setItem(key, JSON.stringify(save));
  }, saveKey);

  // Resume at D08 and complete every new targeted action by clicking the real
  // highlighted control. Zero coins prove both upgrades and both fusions are reimbursed.
  await page.goto(`${baseUrl}?ui=backyard&lang=en`, { waitUntil: "domcontentloaded", timeout: 90_000 });

  await clickTarget(page, "D08", "[data-coach='hatcheryUpgrade']");
  await page.waitForFunction(
    (key) => {
      const save = JSON.parse(localStorage.getItem(key));
      return save.onboarding.step === "D09" && save.hatcheryLevel === 2 && save.coins === 0;
    },
    { timeout: 20_000 },
    saveKey,
  );
  checkpoints.push({ name: "zero-cost hatchery upgrade", level: (await readSave(page)).hatcheryLevel });

  await waitForStep(page, "D09");
  const yardWalk = await beginGuidedWalk(page, "D09 yard upgrade", 1_000);
  await page.waitForFunction(() => {
    const target = document.querySelector("[data-coach='yardUpgrade']");
    if (!target) return false;
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return centerX >= 0 && centerX < innerWidth && centerY >= 0 && centerY < innerHeight;
  }, { timeout: 30_000 });
  await page.keyboard.up("ArrowRight");
  await clickTarget(page, "D09", "[data-coach='yardUpgrade']");
  await page.waitForFunction(
    (key) => {
      const save = JSON.parse(localStorage.getItem(key));
      return save.onboarding.step === "D10" && save.yardLevel === 2 && save.coins === 0;
    },
    { timeout: 20_000 },
    saveKey,
  );
  const afterYardUpgrade = await readSave(page);
  assert.equal(afterYardUpgrade.onboarding.postYardRosterClaimed, true);
  assert.equal(afterYardUpgrade.pets.length, 10, "D09 must add six new tier-1 pets immediately");
  assert.equal(
    afterYardUpgrade.pets.filter((pet) => pet.tier === 1 && pet.level === 10).length,
    8,
    "the fresh six-pet set must be max-level tier 1",
  );
  checkpoints.push({
    name: "zero-cost yard upgrade walks then grants six pets",
    level: afterYardUpgrade.yardLevel,
    grantedPets: 6,
    walk: yardWalk,
  });

  // Reproduce the reported interruption window with an old D10 inventory:
  // the upgrade receipt is already durable, but normal/fire are absent. A full
  // browser reload must keep the guide and repair both parents idempotently.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key));
    save.pets = save.pets.filter((pet) => !["guluduck", "emberfox"].includes(pet.species));
    save.capacityExemptPetIds = save.capacityExemptPetIds.filter((id) => save.pets.some((pet) => pet.id === id));
    localStorage.setItem(key, JSON.stringify(save));
  }, saveKey);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
  await waitForStep(page, "D10");
  const recovered = await readSave(page);
  assert.equal(
    recovered.pets.find((pet) => pet.id === recovered.activePetId)?.tier,
    2,
    "fixture must reproduce entering fusion #3 with a tier-2 companion",
  );
  const switchCopy = await page.$eval(".onboarding-goal[data-step='D10'] p", (element) => element.textContent ?? "");
  assert.match(switchCopy, /tier-1/i, "D10 must explicitly tell the player to switch to tier 1 first");
  const parentIds = Object.fromEntries([
    ["normal", "guluduck"],
    ["grass", "sproutcap"],
    ["fire", "emberfox"],
    ["ice", "frostpeng"],
  ].map(([element, species]) => {
    const parent = recovered.pets.find((pet) => pet.species === species && pet.tier === 1 && pet.level === 10);
    assert.ok(parent, `D10 reload did not recover the ${element} parent`);
    assert.ok(recovered.capacityExemptPetIds.includes(parent.id), `${element} recovery consumes yard capacity`);
    return [element, parent.id];
  }));
  checkpoints.push({ name: "D10 survives interruption and repairs parents", step: stepOf(recovered) });

  const completeRecipe = async (elementA, elementB) => {
    const beforeSwitch = await readSave(page);
    if (beforeSwitch.activePetId !== parentIds[elementA]) {
      await walkToFusionAction(
        page,
        `D10 ${elementA} first parent`,
        "D10",
        parentIds[elementA],
        "followBtn",
      );
      await clickTarget(page, "D10", `[data-coach='followBtn:${parentIds[elementA]}']`);
      await page.waitForFunction(
        ({ key, activeId }) => JSON.parse(localStorage.getItem(key)).activePetId === activeId,
        { timeout: 20_000 },
        { key: saveKey, activeId: parentIds[elementA] },
      );
    }
    const switched = await readSave(page);
    assert.equal(switched.pets.find((pet) => pet.id === switched.activePetId)?.tier, 1);
    await walkToFusionAction(
      page,
      `D10 ${elementB} fusion partner`,
      "D10",
      parentIds[elementB],
      "fuseBtn",
    );
    await clickTarget(page, "D10", `[data-coach='fuseBtn:${parentIds[elementB]}']`);
    await clickTarget(page, "D10", "[data-coach='fuseConfirm']");
  };

  // Classic recipe #3: normal + grass.
  await completeRecipe("normal", "grass");
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).onboarding.tutorialFusions === 3,
    { timeout: 20_000 },
    saveKey,
  );
  await page.waitForSelector(".fr-root", { timeout: 10_000 });
  await page.waitForFunction(() => {
    const character = document.querySelector("[data-coach='char']");
    return document.querySelector(".fr-root") == null &&
      character != null && getComputedStyle(character).visibility !== "hidden";
  }, { timeout: 20_000 });

  // Classic recipe #4: fire + ice.
  await completeRecipe("fire", "ice");
  await waitForStep(page, "D10");
  await page.waitForSelector(".fr-root", { timeout: 10_000 });
  await page.waitForFunction(() => {
    const character = document.querySelector("[data-coach='char']");
    return document.querySelector(".fr-root") == null &&
      character != null && getComputedStyle(character).visibility !== "hidden";
  }, { timeout: 20_000 });

  const fused = await readSave(page);
  const recipeKeys = Object.keys(fused.daily.fusionMints ?? {}).sort();
  const now = Math.floor(Date.now() / 1000);
  assert.deepEqual(recipeKeys, ["fire+ice", "grass+normal"]);
  assert.equal(fused.eggs.length, 2);
  assert.equal(fused.onboarding.step, "D10", "the route advanced before the guided eggs were collected");
  assert.equal(fused.onboarding.guidedFusionEggIds.length, 2);
  assert.ok(fused.eggs.every((egg) => egg.hatchAt != null && egg.hatchAt - now <= 8));
  assert.equal(fused.coins, 0);
  checkpoints.push({
    name: "two distinct free classic fusions",
    tutorialFusions: fused.onboarding.tutorialFusions,
    recipes: recipeKeys,
    hatchSecondsRemaining: fused.eggs.map((egg) => egg.hatchAt - now),
  });

  // The second factory route remains locked until the player stays in the yard
  // and collects both fusion results. Verify the one-egg intermediate state too.
  await page.waitForFunction(
    (key) => {
      const save = JSON.parse(localStorage.getItem(key));
      const pending = new Set(save.onboarding.guidedFusionEggIds ?? []);
      const now = Math.floor(Date.now() / 1000);
      return pending.size === 2 && save.eggs
        .filter((egg) => pending.has(egg.id))
        .every((egg) => egg.hatchAt != null && egg.hatchAt <= now);
    },
    { timeout: 20_000 },
    saveKey,
  );
  await clickTarget(page, "D10", "[data-coach='egg']");
  await page.waitForFunction(
    (key) => {
      const save = JSON.parse(localStorage.getItem(key));
      return save.onboarding.step === "D10" && save.onboarding.guidedFusionEggIds.length === 1;
    },
    { timeout: 20_000 },
    saveKey,
  );
  await clickTarget(page, "D10", "[data-coach='egg']");
  await waitForStep(page, "D11");
  const collected = await readSave(page);
  assert.equal(collected.onboarding.guidedFusionEggIds.length, 0);
  assert.equal(collected.eggs.length, 0);
  assert.equal(collected.pets.filter((pet) => pet.tier === 2).length, 4);
  checkpoints.push({
    name: "both guided fusion eggs collected before second factory",
    step: collected.onboarding.step,
    guidedEggs: collected.onboarding.guidedFusionEggIds.length,
  });

  await clickTarget(page, "D11", "[data-coach='yardBack']");
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).onboarding.step === "E01" &&
      document.querySelector(".game-menubar [data-coach='menuFactory']") != null,
    { timeout: 20_000 },
    saveKey,
  );
  await clickTarget(page, "E01", "[data-coach='menuFactory']");
  await page.waitForFunction(
    (key) => JSON.parse(localStorage.getItem(key)).onboarding.step === "E02" &&
      document.querySelector("[data-coach='factoryFormalStart']") != null,
    { timeout: 30_000 },
    saveKey,
  );
  checkpoints.push({ name: "second factory guide entered", step: stepOf(await readSave(page)) });

  // The remaining navigation lessons must also move the character through the
  // yard. Enter F01 from the menu, walk to the notice board, acknowledge the AI
  // explanation, then walk from the board to the trading market for G01.
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key));
    save.onboarding.step = "F01";
    save.onboarding.factoryFormalEntered = true;
    localStorage.setItem(key, JSON.stringify(save));
  }, saveKey);
  await page.goto(`${baseUrl}?ui=menu&lang=en`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await clickTarget(page, "F01", ".onboarding-goal[data-step='F01'] button:not(.onboarding-skip)", true);
  const boardWalk = await beginGuidedWalk(page, "F01 notice board", 1_000);
  await waitForStep(page, "F02");
  await page.keyboard.up("ArrowRight");
  checkpoints.push({ name: "AI guide walks to notice board", step: stepOf(await readSave(page)), walk: boardWalk });

  await clickTarget(page, "F02", ".onboarding-goal[data-step='F02'] button:not(.onboarding-skip)", true);
  await clickTarget(page, "F03a", ".onboarding-goal[data-step='F03a'] button:not(.onboarding-skip)", true);
  await clickTarget(page, "F04", ".onboarding-goal[data-step='F04'] button:not(.onboarding-skip)", true);
  const marketWalk = await beginGuidedWalk(page, "G01 trading market", 3_000);
  await waitForStep(page, "G02");
  await page.keyboard.up("ArrowRight");
  checkpoints.push({ name: "market guide walks to trading market", step: stepOf(await readSave(page)), walk: marketWalk });

  await page.close();
} catch (error) {
  runtimeErrors.push(error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error));
} finally {
  if (browser != null) await browser.disconnect().catch(() => {});
  if (browserProcess != null && browserProcess.exitCode == null) browserProcess.kill();
  if (vite.exitCode == null) vite.kill();
  // Edge may hold its profile lock briefly after kill(); cleanup is best-effort
  // and must never hide the actual regression result.
  try {
    rmSync(scratchDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch {
    // The ignored scratchpad is safe to remove on the next run.
  }
}

const output = {
  browser: browserPath,
  viewport: "640x480 @1x",
  checkpoints,
  runtimeErrors,
  passed: runtimeErrors.length === 0 && checkpoints.length === 12,
};
console.log(JSON.stringify(output, null, 2));
if (!output.passed) process.exitCode = 1;
