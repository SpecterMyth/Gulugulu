// Browser layout/click regression for the real FactoryRogueScene.
//
// Loads the production app through Vite, creates a deterministic rich save,
// walks loadout -> hiring -> shift in both languages, and resizes the same live
// scene across common/high-DPI equivalent
// CSS viewports. The probe checks viewport clipping, horizontal overflow,
// text/SVG-label overflow, critical button hit targets, and sibling UI overlap.
//
// Usage:
//   node scripts/factory_ui_layout_check.mjs [--out path.json] [--shot] [--modifiers] [--quick]


import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import {
  closePage,
  configurePageTimeouts,
  createStageRunner,
  findAvailablePort,
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
const scratchDir = join(repoDir, ".claude", "scratchpad", `factory-layout-${process.pid}`);

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const rawOut = argValue("--out");
const outPath = rawOut == null ? null : isAbsolute(rawOut) ? rawOut : resolve(process.cwd(), rawOut);
const captureShots = process.argv.includes("--shot");
const probeModifiers = process.argv.includes("--modifiers");
const quickMode = process.argv.includes("--quick");
const globalTimeoutMs = quickMode ? 180_000 : 300_000;
// A cold Vite transform now includes the complete 21-language runtime bundle.
// Leave enough headroom for slower Windows runners instead of failing just as
// the fonts/debug hooks become ready.
const stageTimeoutMs = quickMode ? 120_000 : 150_000;
const operationTimeoutMs = quickMode ? 20_000 : 30_000;
const navigationTimeoutMs = 120_000;
const cdpTimeoutMs = 90_000;
const fontTimeoutMs = 15_000;

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

const fullViewports = [
  { name: "fhd-100", width: 1920, height: 1080, physicalEquivalent: "1920x1080 @100%" },
  { name: "fhd-125", width: 1536, height: 864, physicalEquivalent: "1920x1080 @125%" },
  { name: "fhd-150", width: 1280, height: 720, physicalEquivalent: "1920x1080 @150%" },
  { name: "compact-1024", width: 1024, height: 576, physicalEquivalent: "compact 16:9" },
  { name: "hd-150", width: 853, height: 480, physicalEquivalent: "1280x720 @150%" },
  { name: "stress-640", width: 640, height: 480, physicalEquivalent: "stress floor" },
];
const viewports = quickMode
  ? fullViewports.filter((viewport) => viewport.name === "fhd-150" || viewport.name === "stress-640")
  : fullViewports;
const languages = quickMode ? ["zh"] : ["zh", "en"];
const stageSelectors = {
  loadout: [
    ".fr-lo-head",
    ".fr-lo-sub",
    ".fr-lo-element-odds",
    ".fr-lo-grid",
    ".fr-lo-legend-score",
    ".fr-lo-legend-drain",
    ".fr-lo-count",
    ".fr-lo-clockin",
  ],
  hiring: [
    ".fr-hiring-head",
    ".fr-hiring-tip",
    ".fr-hiring-candidates",
    ".fr-hiring-pool",
    ".fr-hiring-money",
    ".fr-hiring-foot",
  ],
  shift: [
    ".fhp-col-l",
    ".fhp-col-r",
    ".fr-hud-top",
    ".fr-timed-hud",
    ".fr-wind-message",
    ".fr-reward-fx-stack",
    ".fr-tut",
  ],
};
const criticalButtons = {
  loadout: [".fr-lo-back", ".fr-lo-leaderboard", ".fr-lo-clockin"],
  hiring: [".fr-hiring-reroll", ".fr-hiring-select-all", ".fr-hiring-clock"],
  shift: [".fhp-quit", ".fhp-active-card"],
};

mkdirSync(scratchDir, { recursive: true });
const port = await findAvailablePort();
const baseUrl = `http://127.0.0.1:${port}/`;
const vite = spawn(process.execPath, [join(appDir, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: appDir,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "ignore", "pipe"],
  windowsHide: true,
});
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

let browserProcess = null;
let browser = null;
const results = [];
const modifierResults = [];
const runtimeErrors = [];
const stageTimings = [];
const cleanup = [];
const runStage = createStageRunner(stageTimings, stageTimeoutMs);

const round = (value) => Math.round(value * 10) / 10;

const probeLayout = async (page, state, viewport, language) => {
  const probe = await page.evaluate(
    ({ stateName, zoneSelectors, buttonSelectors }) => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01
          && rect.width > 0.5 && rect.height > 0.5;
      };
      const rectOf = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      const overlapArea = (left, right) => Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
        * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
      const inViewport = (rect) => rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
      const fullyInViewport = (rect) => rect.left >= -1 && rect.top >= -1
        && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1;

      const zones = zoneSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]
        .filter((element) => visible(element) && (selector !== ".fr-reward-fx-stack" || element.childElementCount > 0))
        .map((element, index) => ({
          selector,
          index,
          element,
          rect: rectOf(element),
        })));
      const overlaps = [];
      for (let leftIndex = 0; leftIndex < zones.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < zones.length; rightIndex += 1) {
          const left = zones[leftIndex];
          const right = zones[rightIndex];
          if (left.element.contains(right.element) || right.element.contains(left.element)) continue;
          const area = overlapArea(left.rect, right.rect);
          if (area > 4) overlaps.push({ left: left.selector, right: right.selector, area: Math.round(area) });
        }
      }

      const buttons = buttonSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]
        .filter((element) => visible(element) && !element.disabled)
        .map((element, index) => {
          const rect = rectOf(element);
          const center = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
          const hit = inViewport(rect) && center.x >= 0 && center.y >= 0 && center.x < innerWidth && center.y < innerHeight
            ? document.elementFromPoint(center.x, center.y)
            : null;
          return {
            selector,
            index,
            text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "",
            rect,
            fullyInViewport: fullyInViewport(rect),
            centerHit: hit != null && (element === hit || element.contains(hit)),
          };
        }));

      const textOverflows = [...document.querySelectorAll(".fr-stage *")]
        .filter(visible)
        .flatMap((element) => {
          const style = getComputedStyle(element);
          const hasDirectText = [...element.childNodes]
            .some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
          if (!hasDirectText || element.scrollWidth <= element.clientWidth + 1) return [];
          if (style.textOverflow === "ellipsis" || ["auto", "scroll"].includes(style.overflowX)) return [];
          return [{
            tag: element.tagName.toLowerCase(),
            className: String(element.className).slice(0, 100),
            text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 100) ?? "",
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }];
        })
        .slice(0, 20);

      const clippedTexts = [...document.querySelectorAll(".fr-stage *")]
        .filter(visible)
        .flatMap((element) => {
          const hasDirectText = [...element.childNodes]
            .some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
          if (!hasDirectText) return [];
          const insideScroller = (() => {
            for (let parent = element.parentElement; parent != null && parent.matches(".fr-stage *"); parent = parent.parentElement) {
              const style = getComputedStyle(parent);
              if (["auto", "scroll"].includes(style.overflowX) || ["auto", "scroll"].includes(style.overflowY)) return true;
            }
            return false;
          })();
          const rect = rectOf(element);
          if (insideScroller || fullyInViewport(rect)) return [];
          return [{
            tag: element.tagName.toLowerCase(),
            className: String(element.className).slice(0, 100),
            text: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 100) ?? "",
            rect,
          }];
        })
        .slice(0, 20);

      const panelSelector = stateName === "loadout" ? ".fr-lo-wrap" : stateName === "hiring" ? ".fr-hiring-panel" : ".fr-stage";
      const panel = document.querySelector(panelSelector);
      const panelRect = panel == null ? null : rectOf(panel);
      const bodies = typeof window.__facBodies === "function" ? window.__facBodies() : [];
      return {
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        state: stateName,
        languageText: document.querySelector(stateName === "loadout" ? ".fr-lo-title" : stateName === "hiring" ? ".fr-hiring-title-note" : ".fhp-plaque-label")?.textContent?.trim() ?? "",
        documentOverflowX: document.documentElement.scrollWidth - innerWidth,
        documentOverflowY: document.documentElement.scrollHeight - innerHeight,
        panelRect,
        panelFullyInViewport: panelRect != null && fullyInViewport(panelRect),
        zones: zones.map(({ selector, index, rect }) => ({ selector, index, rect })),
        overlaps,
        buttons,
        textOverflows,
        clippedTexts,
        bodies: bodies.length,
        settledBodies: bodies.filter((body) => body.settled).length,
        canvasBodies: bodies.filter((body) => body.inDom !== true).length,
        pageErrors: [],
      };
    },
    { stateName: state, zoneSelectors: stageSelectors[state], buttonSelectors: criticalButtons[state] },
  );

  probe.viewportLabel = viewport.name;
  probe.physicalEquivalent = viewport.physicalEquivalent;
  probe.language = language;
  probe.passed = probe.documentOverflowX <= 1
    && probe.panelFullyInViewport
    && probe.overlaps.length === 0
    && probe.textOverflows.length === 0
    && probe.clippedTexts.length === 0
    && probe.buttons.every((button) => button.fullyInViewport && button.centerHit);
  return probe;
};

const maybeScreenshot = async (page, state, viewport, language, passed) => {
  if (!captureShots) return null;
  const rawPath = outPath?.replace(/\.json$/i, `-${language}-${state}-${viewport.name}.png`)
    ?? join(scratchDir, `${language}-${state}-${viewport.name}.png`);
  mkdirSync(dirname(rawPath), { recursive: true });
  await page.screenshot({ path: rawPath });
  return relative(repoDir, rawPath).replaceAll("\\", "/");
};

const resizeAndProbe = async (page, state, language) => {
  for (const viewport of viewports) {
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
    await new Promise((resolveWait) => setTimeout(resolveWait, 180));
    const result = await probeLayout(page, state, viewport, language);
    result.screenshot = await maybeScreenshot(page, state, viewport, language, result.passed);
    results.push(result);
    console.log(`${result.passed ? "PASS" : "FAIL"} ${language}/${state}/${viewport.name}`);
    if (!result.passed) {
      console.log(JSON.stringify({
        overflowX: result.documentOverflowX,
        panel: result.panelFullyInViewport,
        overlaps: result.overlaps,
        text: result.textOverflows,
        clippedText: result.clippedTexts,
        buttons: result.buttons.filter((button) => !button.fullyInViewport || !button.centerHit),
      }, null, 2));
    }
  }
};

const finishHiring = async (page) => {
  for (let roundIndex = 0; roundIndex < 8; roundIndex += 1) {
    if ((await page.$(".fr-hiring-panel")) == null) return;
    // The first payment is deliberately clicked at the 640×480 stress floor;
    // later rounds use FHD to keep the traversal fast after reachability is proven.
    if (roundIndex > 0) await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    const button = await page.$(".fr-hiring-clock:not([disabled])");
    if (button == null) throw new Error("Hiring confirmation button is disabled");
    await button.click();
    await new Promise((resolveWait) => setTimeout(resolveWait, 180));
    const confirm = await page.$(".fr-hiring-confirm .is-confirm");
    if (confirm != null) await confirm.click();
    await new Promise((resolveWait) => setTimeout(resolveWait, 1250));
  }
  if ((await page.$(".fr-hiring-panel")) != null) throw new Error("Hiring did not reach the shift after eight actions");
};

const probeVisibilityResume = async (page, language) => {
  const viewport = viewports.at(-1);
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
  const probe = await page.evaluate(async ({ expectedCash, languageCode }) => {
    window.__round7Hidden = false;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => window.__round7Hidden,
    });
    const setHidden = (hidden) => {
      window.__round7Hidden = hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    };

    // First force a clean persisted baseline. The next mutation is deliberately
    // hidden immediately, inside the normal 500 ms throttle window.
    setHidden(true);
    setHidden(false);
    window.__frRun.debugSetCash(expectedCash);
    setHidden(true);
    // Persistence deliberately flushes in a microtask so same-event shop
    // commits win the race. Observe storage only after that contract completes.
    await Promise.resolve();
    const stored = JSON.parse(localStorage.getItem("gulugulu.factory_rogue.run.v1") ?? "null");
    await new Promise((resolveWait) => setTimeout(resolveWait, 650));
    setHidden(false);
    await new Promise((resolveWait) => setTimeout(resolveWait, 80));

    const notice = document.querySelector(".fr-resume-notice");
    const rect = notice?.getBoundingClientRect() ?? null;
    const visible = (element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01
        && box.width > 0.5 && box.height > 0.5;
    };
    const overlapArea = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const buttonOverlaps = rect == null ? [] : [...document.querySelectorAll("button:not([disabled])")]
      .filter(visible)
      .flatMap((button) => {
        const area = overlapArea(rect, button.getBoundingClientRect());
        return area > 4 ? [{ text: button.textContent?.trim().replace(/\s+/g, " ").slice(0, 60), area: Math.round(area) }] : [];
      });
    const text = notice?.textContent?.trim() ?? "";
    return {
      storedCash: stored?.cash ?? null,
      snapshotVersion: stored?.v ?? null,
      noticeText: text,
      noticePointerEvents: notice == null ? null : getComputedStyle(notice).pointerEvents,
      noticeRect: rect == null ? null : {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      buttonOverlaps,
      expectedLanguageText: languageCode === "zh" ? "后台计时已暂停" : "Paused safely",
    };
  }, { expectedCash: 123_456, languageCode: language });

  probe.state = "resume";
  probe.viewport = { width: viewport.width, height: viewport.height, dpr: 1 };
  probe.viewportLabel = viewport.name;
  probe.physicalEquivalent = viewport.physicalEquivalent;
  probe.language = language;
  probe.passed = probe.storedCash === 123_456
    && probe.snapshotVersion === 10
    && probe.noticeText.includes(probe.expectedLanguageText)
    && probe.noticePointerEvents === "none"
    && probe.noticeRect != null
    && probe.noticeRect.left >= -1
    && probe.noticeRect.right <= viewport.width + 1
    && probe.buttonOverlaps.length === 0;
  probe.screenshot = await maybeScreenshot(page, "resume", viewport, language, probe.passed);
  results.push(probe);
  console.log(`${probe.passed ? "PASS" : "FAIL"} ${language}/resume/${viewport.name}`);
  if (!probe.passed) console.log(JSON.stringify(probe, null, 2));
};

const modifierViewports = viewports.filter((viewport) => (
  viewport.name === "fhd-150" || viewport.name === "hd-150" || viewport.name === "stress-640"
));

const setDebugModifier = async (page, modifier, windSign) => {
  await page.evaluate(({ nextModifier, nextWindSign }) => {
    const run = window.__frRun;
    if (run == null) throw new Error("Factory debug run is unavailable");
    run.shiftIndex = nextModifier === "audit" ? 20 : 15;
    run.modifier = nextModifier;
    run.windSign = nextWindSign;
    run.windFlipAt = Date.now() + 60_000;
    run.windResumeRemainingMs = null;
    run.disabledDesks = nextModifier === "wind" ? run.getDeskOrder().slice(0, 2) : [];
    run.powerThrowsLeftVal = nextModifier === "audit" ? 20 : null;
    run.rushArmed = nextModifier === "audit";
    run.rushDeadline = nextModifier === "audit" ? Date.now() + 300_000 : null;
    run.rushResumeRemainingMs = null;
    run.viewCache = null;
    run.bump();
  }, { nextModifier: modifier, nextWindSign: windSign });
  await page.waitForFunction(({ nextModifier, nextWindSign }) => {
    const direction = nextWindSign > 0 ? "right" : "left";
    return window.__frRun?.view().modifier === nextModifier
      && document.querySelector(`.fr-wind-fx.is-${direction}`) != null
      && document.querySelector(`.fr-wind-message.is-${direction}`) != null;
  }, { timeout: 5_000 }, { nextModifier: modifier, nextWindSign: windSign });
};

const probeModifierUi = async (page, language, modifier, viewport, expectedDirection) => {
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
  await new Promise((resolveWait) => setTimeout(resolveWait, 180));
  return page.evaluate(({ languageCode, modifierName, viewportName, direction }) => {
    const visible = (element) => {
      if (element == null) return false;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01
        && box.width > 0.5 && box.height > 0.5;
    };
    const rect = (element) => {
      if (element == null) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const overlap = (left, right) => left == null || right == null ? 0
      : Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
        * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
    const wind = document.querySelector(".fr-wind-message");
    const timed = document.querySelector(".fr-timed-hud");
    const modbar = document.querySelector(".fr-modbar");
    const leftHud = document.querySelector(".fhp-col-l");
    const rightHud = document.querySelector(".fhp-col-r");
    const quit = document.querySelector(".fhp-quit");
    const windRect = rect(wind);
    const timedRect = rect(timed);
    const modbarRect = rect(modbar);
    const criticalOverlaps = [
      ["wind-left-hud", windRect, rect(leftHud)],
      ["wind-right-hud", windRect, rect(rightHud)],
      ["wind-quit", windRect, rect(quit)],
      ["wind-timed", windRect, timedRect],
      ["wind-modbar", windRect, modbarRect],
      ["timed-left-hud", timedRect, rect(leftHud)],
      ["timed-right-hud", timedRect, rect(rightHud)],
      ["timed-quit", timedRect, rect(quit)],
      ["modbar-left-hud", modbarRect, rect(leftHud)],
      ["modbar-right-hud", modbarRect, rect(rightHud)],
    ].flatMap(([name, left, right]) => {
      const area = overlap(left, right);
      return area > 4 ? [{ name, area: Math.round(area) }] : [];
    });
    const disabledDesks = [...document.querySelectorAll(".fac-desk.is-disabled-score")];
    const disabledStamps = disabledDesks.map((desk) => {
      const textElement = desk.querySelector(".fac-desk-disabled-stamp text");
      const labelElement = desk.querySelector(".fac-desk-seal-label");
      const textRect = rect(textElement);
      const labelRect = rect(labelElement);
      const fitsLabel = textRect != null && labelRect != null
        && textRect.left >= labelRect.left - 1
        && textRect.right <= labelRect.right + 1
        && textRect.top >= labelRect.top - 1
        && textRect.bottom <= labelRect.bottom + 1;
      return {
        text: textElement?.textContent?.trim().replace(/\s+/g, " ") ?? "",
        lines: textElement?.querySelectorAll("tspan").length ?? 0,
        textRect,
        labelRect,
        fitsLabel,
      };
    });
    const result = {
      language: languageCode,
      modifier: modifierName,
      viewportName,
      viewport: { width: innerWidth, height: innerHeight },
      direction,
      runWindAx: window.__frRun?.windAx() ?? 0,
      windClass: wind?.className ?? "",
      windText: wind?.textContent?.trim().replace(/\s+/g, " ") ?? "",
      windRect,
      timedRect,
      modbarRect,
      windFxClass: document.querySelector(".fr-wind-fx")?.className ?? "",
      gustCount: document.querySelectorAll(".fr-wind-gust").length,
      debrisCount: document.querySelectorAll(".fr-wind-debris").length,
      disabledDeskCount: disabledDesks.length,
      disabledStamps,
      criticalOverlaps,
      documentOverflowX: document.documentElement.scrollWidth - innerWidth,
    };
    const expectDisabled = modifierName === "wind" ? 2 : 0;
    const expectsAudit = modifierName === "audit";
    result.passed = visible(wind)
      && result.windFxClass.includes(`is-${direction}`)
      && result.windClass.includes(`is-${direction}`)
      && Math.sign(result.runWindAx) === (direction === "right" ? 1 : -1)
      && result.gustCount === 18
      && result.debrisCount === 12
      && result.disabledDeskCount === expectDisabled
      && result.disabledStamps.every((stamp) => stamp.text.length > 0 && stamp.fitsLabel)
      && (expectsAudit ? visible(timed) && visible(modbar) && wind.classList.contains("is-combined") : timed == null && modbar == null)
      && criticalOverlaps.length === 0
      && result.documentOverflowX <= 1;
    return result;
  }, { languageCode: language, modifierName: modifier, viewportName: viewport.name, direction: expectedDirection });
};

const probeDisabledDeskDrop = async (page, language) => {
  const viewport = modifierViewports.at(-1);
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
  const target = await page.evaluate(() => {
    const run = window.__frRun;
    if (run == null || run.snap == null) throw new Error("Factory snapshot bridge is unavailable");
    const head = run.view().bagPreview[0];
    if (head == null) throw new Error("No carried Gulu is available for disabled-desk drop");
    const elements = run.meta[head.species]?.elements ?? ["normal"];
    const desks = run.snap.desks();
    const desk = desks.find((candidate) => elements.includes(candidate.element));
    if (desk == null) throw new Error(`No desk matches ${head.species}`);
    const center = desk.x + desk.w / 2;
    const windSign = center < document.querySelector(".fac-stage").getBoundingClientRect().width / 2 ? -1 : 1;
    const secondDisabled = run.getDeskOrder().find((element) => element !== desk.element);
    run.shiftIndex = 15;
    run.modifier = "wind";
    run.windSign = windSign;
    run.windFlipAt = Date.now() + 60_000;
    run.windResumeRemainingMs = null;
    run.disabledDesks = secondDisabled == null ? [desk.element] : [desk.element, secondDisabled];
    run.viewCache = null;
    run.bump();
    return { ...desk, species: head.species, windSign };
  });
  await page.waitForFunction((element) => (
    window.__frRun?.view().disabledDesks.includes(element)
      && document.querySelectorAll(".fac-desk.is-disabled-score").length === 2
  ), { timeout: 5_000 }, target.element);

  const before = await page.evaluate(() => ({
    view: window.__frRun.view(),
    bodies: window.__facBodies(),
  }));
  await page.waitForFunction((desk) => {
    const stage = document.querySelector(".fac-stage")?.getBoundingClientRect();
    const plane = document.querySelector(".fac-plane");
    const planeRect = plane?.getBoundingClientRect();
    if (stage == null || plane == null || planeRect == null) return false;
    const planeX = (planeRect.left + planeRect.right) / 2 - stage.left;
    const planeDir = plane.classList.contains("fac-plane-flip") ? -1 : 1;
    const planeSpeed = Math.max(120, stage.width * 0.96 / 5.2);
    const startFeetY = 22 + 64 + 18 + 104 * 233 / 256;
    const distance = Math.max(0, desk.top - startFeetY);
    const gravity = 2500;
    const time = (Math.sqrt(40 * 40 + 2 * gravity * distance) - 40) / gravity;
    const projectedX = planeX
      + planeDir * planeSpeed * 0.4 * time
      + 0.5 * window.__frRun.windAx() * time * time;
    // Release near the desk centre rather than merely somewhere inside it.
    // The real launch intentionally adds up to ±20 px/s of throw variation;
    // a centred release keeps every legal variation on the scoring surface.
    const center = desk.x + desk.w / 2;
    if (Math.abs(projectedX - center) > 3) return false;
    window.__round15DropProjection = {
      projectedX,
      planeX,
      planeDir,
      planeSpeed,
      time,
      windAx: window.__frRun.windAx(),
    };
    return true;
  }, { timeout: 20_000, polling: "raf" }, target);
  await page.keyboard.press("Space");
  await page.waitForFunction((throws) => window.__frRun.view().stats.throws === throws + 1, { timeout: 3_000 }, before.view.stats.throws);
  await page.waitForFunction(() => window.__facBodies().some((body) => body.settled), { timeout: 8_000 });
  await page.waitForFunction(() => (
    document.querySelector(".fac-failure-text")?.textContent?.trim().length > 0
      && document.querySelector(".fr-float.miss")?.textContent?.trim().length > 0
  ), { timeout: 2_000, polling: 30 });

  return page.evaluate(({ languageCode, desk }) => {
    const rect = (element) => {
      if (element == null) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const overlap = (left, right) => left == null || right == null ? 0
      : Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
        * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
    const failure = document.querySelector(".fac-failure-text");
    const float = document.querySelector(".fr-float.miss");
    const wind = document.querySelector(".fr-wind-message");
    const leftHud = document.querySelector(".fhp-col-l");
    const rightHud = document.querySelector(".fhp-col-r");
    const quit = document.querySelector(".fhp-quit");
    const failureRect = rect(failure);
    const floatRect = rect(float);
    const overlaps = [
      ["failure-wind", failureRect, rect(wind)],
      ["failure-left-hud", failureRect, rect(leftHud)],
      ["failure-right-hud", failureRect, rect(rightHud)],
      ["failure-quit", failureRect, rect(quit)],
      ["float-wind", floatRect, rect(wind)],
      ["float-left-hud", floatRect, rect(leftHud)],
      ["float-right-hud", floatRect, rect(rightHud)],
      ["float-quit", floatRect, rect(quit)],
    ].flatMap(([name, left, right]) => {
      const area = overlap(left, right);
      return area > 4 ? [{ name, area: Math.round(area) }] : [];
    });
    const after = window.__frRun.view();
    const expectedText = languageCode === "zh" ? "不计分" : "SCORES NOTHING THIS SHIFT";
    const failureText = failure?.textContent?.trim() ?? "";
    const floatText = float?.textContent?.trim() ?? "";
    const settled = window.__facBodies().filter((body) => body.settled);
    const result = {
      language: languageCode,
      modifier: "wind",
      case: "disabled-desk-real-drop",
      viewport: { width: innerWidth, height: innerHeight },
      target: desk,
      releaseProjection: window.__round15DropProjection ?? null,
      after: {
        throws: after.stats.throws,
        combo: after.combo,
        revenueShift: after.revenueShift,
        maxPulse: after.stats.maxPulse,
      },
      failureText,
      floatText,
      failureRect,
      floatRect,
      overlaps,
      failurePointerEvents: getComputedStyle(document.querySelector(".fac-failure-layer")).pointerEvents,
      floatPointerEvents: getComputedStyle(document.querySelector(".fr-float-layer")).pointerEvents,
      settled,
    };
    result.passed = after.stats.throws === 1
      && after.revenueShift === 0
      && after.stats.maxPulse === 0
      && after.combo === 0
      && failureText.includes(expectedText)
      && floatText.includes(expectedText)
      && settled.length === 1
      && overlaps.length === 0
      && result.failurePointerEvents === "none"
      && result.floatPointerEvents === "none";
    return result;
  }, { languageCode: language, desk: target });
};

const probeModifierStates = async (page, language) => {
  await setDebugModifier(page, "wind", 1);
  for (const viewport of modifierViewports) {
    const result = await probeModifierUi(page, language, "wind", viewport, "right");
    modifierResults.push(result);
    console.log(`${result.passed ? "PASS" : "FAIL"} ${language}/wind-right/${viewport.name}`);
  }

  await setDebugModifier(page, "wind", -1);
  const directionFlip = await probeModifierUi(page, language, "wind", modifierViewports.at(-1), "left");
  directionFlip.case = "direction-flip";
  modifierResults.push(directionFlip);
  console.log(`${directionFlip.passed ? "PASS" : "FAIL"} ${language}/wind-direction-flip`);

  const disabledDrop = await probeDisabledDeskDrop(page, language);
  modifierResults.push(disabledDrop);
  console.log(`${disabledDrop.passed ? "PASS" : "FAIL"} ${language}/wind-disabled-desk-real-drop`);

  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await new Promise((resolveWait) => setTimeout(resolveWait, 120));
  const reducedMotion = await page.evaluate((languageCode) => {
    const animations = (selector) => [...document.querySelectorAll(selector)].map((element) => getComputedStyle(element).animationName);
    const gustAnimations = animations(".fr-wind-gust");
    const debrisAnimations = animations(".fr-wind-debris");
    const arrowAnimation = getComputedStyle(document.querySelector(".fr-wind-arrow")).animationName;
    return {
      language: languageCode,
      modifier: "wind",
      case: "reduced-motion",
      gustAnimations: [...new Set(gustAnimations)],
      debrisAnimations: [...new Set(debrisAnimations)],
      arrowAnimation,
      visibleGusts: [...document.querySelectorAll(".fr-wind-gust")].filter((element) => getComputedStyle(element).display !== "none").length,
      visibleDebris: [...document.querySelectorAll(".fr-wind-debris")].filter((element) => getComputedStyle(element).display !== "none").length,
      passed: gustAnimations.every((name) => name === "none")
        && debrisAnimations.every((name) => name === "none")
        && arrowAnimation === "none",
    };
  }, language);
  modifierResults.push(reducedMotion);
  console.log(`${reducedMotion.passed ? "PASS" : "FAIL"} ${language}/wind-reduced-motion`);
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);

  await setDebugModifier(page, "audit", 1);
  for (const viewport of modifierViewports) {
    const result = await probeModifierUi(page, language, "audit", viewport, "right");
    modifierResults.push(result);
    console.log(`${result.passed ? "PASS" : "FAIL"} ${language}/audit/${viewport.name}`);
  }
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

  for (const language of languages) {
    let page = null;
    try {
      page = await runStage(`${language}/page-load`, async () => {
        const nextPage = await browser.newPage();
        configurePageTimeouts(nextPage, { operationTimeoutMs, navigationTimeoutMs });
        nextPage.on("pageerror", (error) => runtimeErrors.push(`${language}: pageerror: ${error.message}`));
        nextPage.on("console", (message) => {
          if (message.type() !== "error") return;
          const location = message.location().url ?? "";
          const missingFavicon = message.text().startsWith("Failed to load resource") && /favicon\.ico(?:$|\?)/.test(location);
          if (!missingFavicon) runtimeErrors.push(`${language}: console: ${message.text()} @ ${location}`);
        });
        await nextPage.evaluateOnNewDocument(() => {
          localStorage.removeItem("gulugulu.factory_rogue.run.v1");
          localStorage.removeItem("gulugulu.factory_rogue.lastLoadout");
          localStorage.removeItem("gulugulu.factory.strike-warning.v1");
        });
        await nextPage.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
        console.log(`[page-load:${language}] navigate`);
        await nextPage.goto(`${baseUrl}?ui=factory&seed=rich&lang=${language}&frdebug=1&frseed=90210`, {
          waitUntil: "domcontentloaded",
          timeout: navigationTimeoutMs,
        });
        console.log(`[page-load:${language}] wait loadout`);
        await nextPage.waitForSelector(".fr-lo-wrap", { timeout: 30_000 });
        console.log(`[page-load:${language}] wait factory debug handle`);
        await nextPage.waitForFunction(() => typeof window.__facBodies === "function", { timeout: 30_000 });
        console.log(`[page-load:${language}] wait fonts`);
        await waitForFonts(nextPage, fontTimeoutMs, `${language}/fonts`);
        console.log(`[page-load:${language}] ready`);
        return nextPage;
      });
      await runStage(`${language}/loadout`, () => resizeAndProbe(page, "loadout", language));

      // resizeAndProbe leaves the live page at the stress viewport. Start the
      // real run there so this is an actual constrained click, not geometry only.
      await runStage(`${language}/hiring`, async () => {
        await page.click(".fr-lo-clockin");
        await page.waitForSelector(".fr-hiring-panel", { timeout: 15_000 });
        await resizeAndProbe(page, "hiring", language);
      });
      await runStage(`${language}/shift`, async () => {
        await finishHiring(page);
        await page.waitForSelector(".fhp-root", { timeout: 15_000 });
        await page.waitForFunction(() => document.querySelector(".fr-hiring-panel") == null, { timeout: 15_000 });
        await resizeAndProbe(page, "shift", language);
      });
      if (probeModifiers) await runStage(`${language}/modifiers`, () => probeModifierStates(page, language));
      await runStage(`${language}/resume`, () => probeVisibilityResume(page, language));
    } finally {
      await closePage(page).catch((error) => runtimeErrors.push(`${language}/page-close: ${error.message}`));
    }
  }
};

try {
  await withTimeout(runScenario(), globalTimeoutMs, "factory layout global watchdog");
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

const failedCases = results.filter((result) => !result.passed);
const failedModifierCases = modifierResults.filter((result) => !result.passed);
const report = {
  generatedAt: new Date().toISOString(),
  environment: {
    browserPath,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    viewports,
    languages,
    probeModifiers,
    quickMode,
    timeouts: { globalTimeoutMs, stageTimeoutMs, operationTimeoutMs, navigationTimeoutMs, cdpTimeoutMs, fontTimeoutMs },
    bodySource: "real RogueRun-managed scene (no synthetic facpile seed)",
  },
  summary: {
    cases: results.length,
    passed: results.length - failedCases.length,
    failed: failedCases.length,
    runtimeErrors: runtimeErrors.length,
    modifierCases: modifierResults.length,
    modifierPassed: modifierResults.length - failedModifierCases.length,
    modifierFailed: failedModifierCases.length,
  },
  results,
  modifierResults,
  stageTimings,
  cleanup,
  runtimeErrors,
  passed: results.length === viewports.length * languages.length * 3 + languages.length
    && failedCases.length === 0
    && (!probeModifiers || (
      modifierResults.length === languages.length * (modifierViewports.length * 2 + 3)
      && failedModifierCases.length === 0
    ))
    && runtimeErrors.length === 0,
};
if (outPath != null) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report.summary, null, 2));
process.exitCode = report.passed ? 0 : 1;
