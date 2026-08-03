// Real-browser interruption/rapid-click regression for the production factory shop.
// It deliberately hides the document inside the peel animation's deferred-commit
// window, then verifies that the logical action is committed before persistence.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const repoDir = join(appDir, "..", "..");
const scratchDir = join(repoDir, ".claude", "scratchpad", `factory-races-${process.pid}`);
const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const rawOut = argValue("--out");
const outPath = rawOut == null ? null : isAbsolute(rawOut) ? rawOut : resolve(process.cwd(), rawOut);
const stressOverlays = process.argv.includes("--stress-overlays");
const viewport = stressOverlays
  ? { width: 640, height: 480, deviceScaleFactor: 1 }
  : { width: 1280, height: 720, deviceScaleFactor: 1 };
const browserPath = [
  process.env.MK_BROWSER ?? "",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find((candidate) => candidate && existsSync(candidate));
if (!browserPath) {
  console.error("Edge/Chrome was not found; set MK_BROWSER to its executable path.");
  process.exit(1);
}

mkdirSync(scratchDir, { recursive: true });
const port = 4700 + (process.pid % 200);
const baseUrl = `http://127.0.0.1:${port}/`;
const vite = spawn(
  process.execPath,
  [join(appDir, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: appDir, env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "ignore", "pipe"], windowsHide: true },
);
let viteError = "";
vite.stderr.on("data", (chunk) => { viteError = (viteError + chunk.toString()).slice(-4000); });
const sleep = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
const waitForServer = async () => {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (vite.exitCode != null) break;
    try {
      if ((await fetch(baseUrl)).ok) return;
    } catch {
      // Vite is still warming up.
    }
    await sleep(250);
  }
  throw new Error(`Vite did not become ready (exit=${vite.exitCode}).\n${viteError}`);
};

const checks = [];
const record = (name, pass, details = undefined) => {
  checks.push({ name, pass: Boolean(pass), ...(details == null ? {} : { details }) });
};
const countResolved = (view) => view.shop?.resolved.filter(Boolean).length ?? 0;
let browserProcess = null;
let browser = null;
const runtimeErrors = [];

const finishHiring = async (page) => {
  for (let roundIndex = 0; roundIndex < 8; roundIndex += 1) {
    if ((await page.$(".fr-hiring-panel")) == null
      || await page.evaluate(() => window.__frRun?.view().phase !== "hiring")) return;
    await page.evaluate(() => window.__frRun?.debugSetCash(1_000_000));
    let button = await page.$(".fr-hiring-clock:not([disabled])");
    if (button == null) {
      const selectAll = await page.$(".fr-hiring-select-all:not([disabled])");
      if (selectAll != null) await selectAll.click();
      await sleep(100);
      if (await page.evaluate(() => window.__frRun?.view().phase !== "hiring")) return;
      button = await page.$(".fr-hiring-clock:not([disabled])");
    }
    if (button == null) throw new Error("Hiring confirmation button is disabled");
    await button.click();
    await sleep(100);
    const confirm = await page.$(".fr-hiring-confirm .is-confirm");
    if (confirm != null) await confirm.click();
    await sleep(1150);
  }
  throw new Error("Hiring did not reach the shift after eight actions");
};

try {
  await waitForServer();
  const debugPort = 9900 + (process.pid % 80);
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
  browserProcess.stderr.on("data", (chunk) => { browserError = (browserError + chunk.toString()).slice(-4000); });
  let webSocketDebuggerUrl = "";
  for (let attempt = 0; attempt < 100 && !webSocketDebuggerUrl; attempt += 1) {
    if (browserProcess.exitCode != null) break;
    try {
      webSocketDebuggerUrl = (await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json()).webSocketDebuggerUrl;
    } catch {
      await sleep(250);
    }
  }
  if (!webSocketDebuggerUrl) throw new Error(`Browser debug endpoint did not start.\n${browserError}`);
  browser = await puppeteer.connect({ browserWSEndpoint: webSocketDebuggerUrl });
  const page = await browser.newPage();
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
      runtimeErrors.push(`console: ${message.text()}`);
    }
  });
  await page.evaluateOnNewDocument(() => {
    localStorage.removeItem("gulugulu.factory_rogue.run.v1");
    localStorage.removeItem("gulugulu.factory_rogue.lastLoadout");
    localStorage.removeItem("gulugulu.factory.strike-warning.v1");
  });
  await page.setViewport(viewport);
  await page.goto(`${baseUrl}?ui=factory&seed=rich&lang=en&frdebug=1&frseed=90210`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForSelector(".fr-lo-clockin", { timeout: 30_000 });
  await page.click(".fr-lo-clockin");
  await page.waitForSelector(".fr-hiring-panel", { timeout: 15_000 });
  await finishHiring(page);
  await page.waitForFunction(() => window.__frRun?.view().phase === "shift", { timeout: 15_000 });
  await page.evaluate((deferSettlement) => {
    window.__raceHidden = false;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => window.__raceHidden,
    });
    window.__setRaceHidden = (hidden) => {
      window.__raceHidden = hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    };
    window.__frRun.debugSetCash(1_000_000);
    if (deferSettlement) {
      // Inject a legacy-style receipt with spending and income together. The
      // production settlement selector must not relabel the reroll as income.
      window.__frRun.shiftCashFlows.push(
        { kind: "reroll", amount: -6 },
        { kind: "refund", amount: 5 },
      );
    }
    window.__frRun.debugEndShift();
    if (!deferSettlement) window.__frRun.confirmSettlement();
  }, stressOverlays);

  if (stressOverlays) {
    await page.waitForSelector(".fr-settlement-overlay", { timeout: 15_000 });
    const settlementLayout = await page.evaluate(() => {
      const rect = (element) => {
        if (element == null) return null;
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
          visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01,
        };
      };
      const layoutRect = (element) => {
        if (element == null) return null;
        const style = getComputedStyle(element);
        return {
          left: element.offsetLeft,
          top: element.offsetTop,
          right: element.offsetLeft + element.offsetWidth,
          bottom: element.offsetTop + element.offsetHeight,
          width: element.offsetWidth,
          height: element.offsetHeight,
          visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01,
        };
      };
      const overlap = (left, right) => left == null || right == null ? 0
        : Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
          * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
      const panel = rect(document.querySelector(".fr-settlement-panel"));
      const confirm = rect(document.querySelector(".fr-settlement-confirm"));
      const paymentElements = [
        ["wallet", document.querySelector(".fr-settlement-wallet")],
        ["arrow", document.querySelector(".fr-settlement-arrow")],
        ["bill", document.querySelector(".fr-settlement-bill")],
        ["after", document.querySelector(".fr-settlement-after")],
      ];
      const payment = paymentElements
        .map(([name, element]) => [name, rect(element)])
        .filter(([, box]) => box?.visible);
      // Compare untransformed sibling layout boxes. The one-degree receipt
      // rotation makes otherwise separated rows overlap in axis-aligned DOMRects.
      const paymentLayout = paymentElements
        .map(([name, element]) => [name, layoutRect(element)])
        .filter(([, box]) => box?.visible);
      const paymentOverlaps = [];
      for (let left = 0; left < paymentLayout.length; left += 1) {
        for (let right = left + 1; right < paymentLayout.length; right += 1) {
          const xDepth = Math.max(0, Math.min(paymentLayout[left][1].right, paymentLayout[right][1].right)
            - Math.max(paymentLayout[left][1].left, paymentLayout[right][1].left));
          const yDepth = Math.max(0, Math.min(paymentLayout[left][1].bottom, paymentLayout[right][1].bottom)
            - Math.max(paymentLayout[left][1].top, paymentLayout[right][1].top));
          const area = overlap(paymentLayout[left][1], paymentLayout[right][1]);
          if (xDepth > 2 && yDepth > 2) {
            paymentOverlaps.push({ pair: `${paymentLayout[left][0]}-${paymentLayout[right][0]}`, area: Math.round(area) });
          }
        }
      }
      const hit = confirm == null ? null : document.elementFromPoint(
        (confirm.left + confirm.right) / 2,
        (confirm.top + confirm.bottom) / 2,
      );
      return {
        panel,
        confirm,
        payment,
        paymentLayout,
        paymentOverlaps,
        confirmHit: hit?.closest(".fr-settlement-confirm") != null,
        flowTexts: [...document.querySelectorAll(".fr-settlement-flow:not(.fr-settlement-loan-flow)")]
          .map((element) => element.textContent?.trim().replace(/\s+/g, " ") ?? ""),
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    const insideViewport = (box) => box != null
      && box.left >= -1 && box.top >= -1
      && box.right <= viewport.width + 1 && box.bottom <= viewport.height + 1;
    record("settlement panel stays within 640x480 viewport", insideViewport(settlementLayout.panel), settlementLayout);
    record(
      "settlement pay action is initially visible and clickable",
      insideViewport(settlementLayout.confirm) && settlementLayout.confirmHit,
      { confirm: settlementLayout.confirm, confirmHit: settlementLayout.confirmHit },
    );
    record("settlement payment cells do not overlap", settlementLayout.paymentOverlaps.length === 0, {
      payment: settlementLayout.payment,
      paymentLayout: settlementLayout.paymentLayout,
      overlaps: settlementLayout.paymentOverlaps,
    });
    record(
      "settlement income rows exclude reroll spending",
      settlementLayout.flowTexts.every((text) => !text.includes("-6") && !text.includes("Rush trickle")),
      { flowTexts: settlementLayout.flowTexts },
    );
    record(
      "settlement shows one truthful positive refund row",
      settlementLayout.flowTexts.length === 1
        && settlementLayout.flowTexts[0].includes("Refund")
        && settlementLayout.flowTexts[0].includes("+¥5"),
      { flowTexts: settlementLayout.flowTexts },
    );

    await page.evaluate(() => {
      const nativeSetTimeout = window.setTimeout.bind(window);
      window.__settlementPayTimerCount = 0;
      window.setTimeout = (callback, delay, ...args) => {
        if (delay === 1400 || delay === 120) window.__settlementPayTimerCount += 1;
        return nativeSetTimeout(callback, delay, ...args);
      };
      const run = window.__frRun;
      const confirmSettlement = run.confirmSettlement.bind(run);
      window.__settlementCommitCount = 0;
      run.confirmSettlement = () => {
        window.__settlementCommitCount += 1;
        return confirmSettlement();
      };
      const button = document.querySelector(".fr-settlement-confirm");
      for (let index = 0; index < 25; index += 1) button?.click();
    });
    await sleep(60);
    const payTimers = await page.evaluate(() => window.__settlementPayTimerCount);
    record("25 same-task pay clicks schedule one payment timer", payTimers === 1, { payTimers });
    await page.waitForFunction(() => window.__frRun.view().phase === "shop", { timeout: 5_000 });
    const settlementCommitCount = await page.evaluate(() => window.__settlementCommitCount);
    record("rapid settlement clicks commit the bill exactly once", settlementCommitCount === 1, { settlementCommitCount });
  }
  await page.waitForSelector(".fr-shop-overlay", { timeout: 15_000 });

  if (stressOverlays) {
    // Measure the usable resting layout, after the authored 0.6s stick/stamp
    // entrance. The animation path is separately clipped on the x axis.
    await sleep(700);
    const shopLayout = await page.evaluate(() => {
      const rect = (element) => {
        if (element == null) return null;
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          width: box.width,
          height: box.height,
          visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01,
        };
      };
      const overlay = document.querySelector(".fr-shop-overlay");
      const overlayBox = overlay?.getBoundingClientRect() ?? null;
      const overflowing = overlayBox == null ? [] : [...overlay.querySelectorAll("*")].flatMap((element) => {
        const style = getComputedStyle(element);
        if (style.display === "none") return [];
        const box = element.getBoundingClientRect();
        if (box.width <= 0 || (box.left >= overlayBox.left - 1 && box.right <= overlayBox.right + 1)) return [];
        return [{
          tag: element.tagName,
          cls: typeof element.className === "string" ? element.className : "",
          left: Math.round(box.left * 10) / 10,
          right: Math.round(box.right * 10) / 10,
          width: Math.round(box.width * 10) / 10,
        }];
      }).slice(0, 20);
      return {
        cards: [...document.querySelectorAll(".fr-card-buybar")].map(rect),
        actions: [...document.querySelectorAll(".fr-shop-act")].map(rect),
        keywordToggle: rect(document.querySelector(".fr-shop-keyword-title")),
        overlay: rect(overlay),
        overlayScroll: overlay == null ? null : {
          scrollWidth: overlay.scrollWidth,
          clientWidth: overlay.clientWidth,
          scrollHeight: overlay.scrollHeight,
          clientHeight: overlay.clientHeight,
          scrollTop: overlay.scrollTop,
          overflowX: getComputedStyle(overlay).overflowX,
        },
        documentOverflowX: document.documentElement.scrollWidth - innerWidth,
        overflowing,
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    const visibleInViewport = (box) => box?.visible === true
      && box.left >= -1 && box.top >= -1
      && box.right <= viewport.width + 1 && box.bottom <= viewport.height + 1;
    record(
      "all three shop choices are initially visible at 640x480",
      shopLayout.cards.length === 3 && shopLayout.cards.every(visibleInViewport),
      { cards: shopLayout.cards },
    );
    record(
      "shop reroll and skip actions are initially visible at 640x480",
      shopLayout.actions.length === 2 && shopLayout.actions.every(visibleInViewport),
      { actions: shopLayout.actions, overlayScroll: shopLayout.overlayScroll },
    );
    record("shop keyword help remains initially reachable", visibleInViewport(shopLayout.keywordToggle), {
      keywordToggle: shopLayout.keywordToggle,
    });
    record(
      "shop creates no horizontal overflow",
      shopLayout.documentOverflowX <= 1
        && (
          shopLayout.overlayScroll.scrollWidth <= shopLayout.overlayScroll.clientWidth + 1
          || ["hidden", "clip"].includes(shopLayout.overlayScroll.overflowX)
        ),
      {
      documentOverflowX: shopLayout.documentOverflowX,
      overlayScroll: shopLayout.overlayScroll,
      overflowing: shopLayout.overflowing,
      },
    );
  }

  // Buy, then hide inside the 800 ms peel window. The action must be durable
  // before the factory scene's hidden-state snapshot listener runs.
  const buyBefore = await page.evaluate(() => ({
    view: window.__frRun.view(),
    stored: JSON.parse(localStorage.getItem("gulugulu.factory_rogue.run.v1") ?? "null"),
  }));
  await page.click(".fr-card-buybar:not([disabled])");
  await sleep(40);
  await page.evaluate(() => window.__setRaceHidden(true));
  await sleep(100);
  const buyAfter = await page.evaluate(() => ({
    view: window.__frRun.view(),
    stored: JSON.parse(localStorage.getItem("gulugulu.factory_rogue.run.v1") ?? "null"),
  }));
  record("buy commits before hidden snapshot", countResolved(buyAfter.view) === countResolved(buyBefore.view) + 1, {
    beforeResolved: countResolved(buyBefore.view),
    afterResolved: countResolved(buyAfter.view),
  });
  record("hidden snapshot contains committed buy", buyAfter.stored?.shopOffer?.resolved?.filter(Boolean).length === 1, {
    storedResolved: buyAfter.stored?.shopOffer?.resolved ?? null,
  });
  record("buy charges exactly once", buyAfter.view.cash < buyBefore.view.cash && buyAfter.view.cash >= 0, {
    cashBefore: buyBefore.view.cash,
    cashAfter: buyAfter.view.cash,
  });
  await page.evaluate(() => window.__setRaceHidden(false));
  await page.waitForFunction(() => window.__frRun.view().shop?.resolved.filter(Boolean).length === 1);

  // Twenty-five rapid skip clicks must resolve just one dimension and grant one refund.
  const skipBefore = await page.evaluate(() => window.__frRun.view());
  await page.evaluate(() => {
    const button = document.querySelector(".fr-shop-act-skip");
    for (let index = 0; index < 25; index += 1) button?.click();
  });
  await sleep(40);
  await page.evaluate(() => window.__setRaceHidden(true));
  await sleep(100);
  const skipAfter = await page.evaluate(() => ({
    view: window.__frRun.view(),
    stored: JSON.parse(localStorage.getItem("gulugulu.factory_rogue.run.v1") ?? "null"),
  }));
  const expectedRefund = Math.round(skipBefore.kpi * 0.08);
  record("25 rapid skip clicks resolve one dimension", countResolved(skipAfter.view) === countResolved(skipBefore) + 1, {
    beforeResolved: countResolved(skipBefore),
    afterResolved: countResolved(skipAfter.view),
  });
  record("25 rapid skip clicks grant one refund", skipAfter.view.cash === skipBefore.cash + expectedRefund, {
    cashBefore: skipBefore.cash,
    cashAfter: skipAfter.view.cash,
    expectedRefund,
  });
  record("hidden snapshot contains single rapid-click resolution", skipAfter.stored?.shopOffer?.resolved?.filter(Boolean).length === 2, {
    storedResolved: skipAfter.stored?.shopOffer?.resolved ?? null,
  });
  await page.evaluate(() => window.__setRaceHidden(false));
  await page.waitForFunction(() => window.__frRun.view().shop?.resolved.filter(Boolean).length === 2);

  // Simulate a stale affordability view: cash changes during the 620 ms peel.
  // A rejected reroll must restore the buttons instead of leaving the shop locked.
  const rerollBefore = await page.evaluate(() => window.__frRun.view());
  await page.click(".fr-shop-act-reroll:not([disabled])");
  await sleep(40);
  await page.evaluate(() => window.__frRun.debugSetCash(0));
  await sleep(720);
  const rejected = await page.evaluate(() => ({
    view: window.__frRun.view(),
    skipDisabled: document.querySelector(".fr-shop-act-skip")?.disabled ?? null,
    cardsVisible: [...document.querySelectorAll(".fr-card-big")].some((card) => Number(getComputedStyle(card).opacity) > 0.01),
  }));
  record("rejected delayed reroll leaves dimension unresolved", countResolved(rejected.view) === countResolved(rerollBefore), {
    beforeResolved: countResolved(rerollBefore),
    afterResolved: countResolved(rejected.view),
  });
  record("rejected delayed reroll releases local UI lock", rejected.skipDisabled === false && rejected.cardsVisible, {
    skipDisabled: rejected.skipDisabled,
    cardsVisible: rejected.cardsVisible,
  });
  record("rejected delayed reroll does not consume reroll count", rejected.view.shop?.rerollCounts[2] === rerollBefore.shop?.rerollCounts[2], {
    before: rerollBefore.shop?.rerollCounts[2] ?? null,
    after: rejected.view.shop?.rerollCounts[2] ?? null,
  });

  // The normal, uninterrupted path must retain the authored 620 ms rhythm and
  // still charge exactly once after a prior rejection released the lock.
  await page.evaluate(() => window.__frRun.debugSetCash(1_000_000));
  await page.waitForFunction(() => document.querySelector(".fr-shop-act-reroll")?.disabled === false);
  const normalRerollBefore = await page.evaluate(() => window.__frRun.view());
  const normalRerollCost = Math.round(normalRerollBefore.kpi * 0.07 * (2 ** normalRerollBefore.shop.rerollCounts[2]));
  await page.click(".fr-shop-act-reroll:not([disabled])");
  await sleep(720);
  const normalRerollAfter = await page.evaluate(() => ({
    view: window.__frRun.view(),
    skipDisabled: document.querySelector(".fr-shop-act-skip")?.disabled ?? null,
    cardsVisible: [...document.querySelectorAll(".fr-card-big")].some((card) => Number(getComputedStyle(card).opacity) > 0.01),
  }));
  record("uninterrupted reroll resolves after authored peel delay", normalRerollAfter.view.shop?.rerollCounts[2] === normalRerollBefore.shop?.rerollCounts[2] + 1, {
    before: normalRerollBefore.shop?.rerollCounts[2] ?? null,
    after: normalRerollAfter.view.shop?.rerollCounts[2] ?? null,
  });
  record("uninterrupted reroll charges exactly once", normalRerollAfter.view.cash === normalRerollBefore.cash - normalRerollCost, {
    cashBefore: normalRerollBefore.cash,
    cashAfter: normalRerollAfter.view.cash,
    normalRerollCost,
  });
  record("uninterrupted reroll restores interactive cards", normalRerollAfter.skipDisabled === false && normalRerollAfter.cardsVisible, {
    skipDisabled: normalRerollAfter.skipDisabled,
    cardsVisible: normalRerollAfter.cardsVisible,
  });

  // Reduced motion keeps the state confirmation but removes the long off-screen
  // flight and its otherwise invisible 620 ms input lock.
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  const reducedRerollBefore = await page.evaluate(() => window.__frRun.view());
  const reducedRerollCost = Math.round(reducedRerollBefore.kpi * 0.07 * (2 ** reducedRerollBefore.shop.rerollCounts[2]));
  const reducedStartedAt = Date.now();
  await page.click(".fr-shop-act-reroll:not([disabled])");
  await page.waitForFunction(
    (before) => window.__frRun.view().shop?.rerollCounts[2] === before + 1,
    { timeout: 300 },
    reducedRerollBefore.shop.rerollCounts[2],
  );
  const reducedElapsedMs = Date.now() - reducedStartedAt;
  const reducedRerollAfter = await page.evaluate(() => ({
    view: window.__frRun.view(),
    cardAnimation: getComputedStyle(document.querySelector(".fr-card-big")).animationName,
  }));
  record("reduced-motion reroll commits without long invisible wait", reducedElapsedMs < 300, { reducedElapsedMs });
  record("reduced-motion reroll charges exactly once", reducedRerollAfter.view.cash === reducedRerollBefore.cash - reducedRerollCost, {
    cashBefore: reducedRerollBefore.cash,
    cashAfter: reducedRerollAfter.view.cash,
    reducedRerollCost,
  });
  record("reduced-motion removes card flight animation", reducedRerollAfter.cardAnimation === "none", {
    cardAnimation: reducedRerollAfter.cardAnimation,
  });

  // Closing the page uses pagehide rather than visibilitychange on some Tauri/
  // WebView2 paths. Resolve the final dimension in that exact interruption.
  const pagehideBefore = await page.evaluate(() => window.__frRun.view());
  await page.click(".fr-shop-act-skip:not([disabled])");
  await sleep(10);
  await page.evaluate(() => {
    const event = typeof PageTransitionEvent === "function"
      ? new PageTransitionEvent("pagehide", { persisted: false })
      : new Event("pagehide");
    window.dispatchEvent(event);
  });
  await sleep(100);
  const pagehideAfter = await page.evaluate(() => ({
    view: window.__frRun.view(),
    stored: JSON.parse(localStorage.getItem("gulugulu.factory_rogue.run.v1") ?? "null"),
  }));
  const pagehideRefund = Math.round(pagehideBefore.kpi * 0.08);
  record("pagehide commits pending final skip", countResolved(pagehideAfter.view) === countResolved(pagehideBefore) + 1, {
    beforeResolved: countResolved(pagehideBefore),
    afterResolved: countResolved(pagehideAfter.view),
  });
  record("pagehide snapshot contains all resolved dimensions", pagehideAfter.stored?.shopOffer?.resolved?.every(Boolean) === true, {
    storedResolved: pagehideAfter.stored?.shopOffer?.resolved ?? null,
  });
  record("pagehide final skip grants one refund", pagehideAfter.view.cash === pagehideBefore.cash + pagehideRefund, {
    cashBefore: pagehideBefore.cash,
    cashAfter: pagehideAfter.view.cash,
    pagehideRefund,
  });
  await page.waitForFunction(() => window.__frRun.view().phase === "hiring", { timeout: 500 });
  record("reduced-motion completed shop avoids two-second empty wait", true, {
    phase: await page.evaluate(() => window.__frRun.view().phase),
  });

  if (stressOverlays) {
    // Re-open an authored staffing-card step with Payday Advance at the 640x480
    // floor. This exercises the free-loan click and the already-active state
    // without simulating fifteen shifts to wait for a random offer.
    await page.evaluate(() => {
      const run = window.__frRun;
      run.phase = "shop";
      run.shopOffer = {
        dims: [2, 1, 3],
        cards: [
          ["staff.loan", "staff.backfill", "staff.talentmarket"],
          ["attr.pure", "attr.dual", "attr.tri"],
          ["syn.steam", "syn.mudslide", "syn.short"],
        ],
        resolved: [false, false, false],
        rerollCounts: [0, 0, 0],
      };
      run.viewCache = null;
      run.bump();
    });
    await page.waitForFunction(() => document.querySelector(".fr-card-name")?.textContent?.includes("Payday Loan"));
    const loanLayout = await page.evaluate(() => {
      const loanCard = [...document.querySelectorAll(".fr-card-big")]
        .find((card) => card.querySelector(".fr-card-name")?.textContent?.includes("Payday Loan"));
      const rect = (element) => {
        if (element == null) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      };
      return {
        card: rect(loanCard),
        description: rect(loanCard?.querySelector(".fr-card-desc")),
        action: rect(loanCard?.querySelector(".fr-card-buybar")),
        descriptionText: loanCard?.querySelector(".fr-card-desc")?.textContent?.trim() ?? "",
      };
    });
    const loanTextInside = loanLayout.card != null && loanLayout.description != null && loanLayout.action != null
      && loanLayout.description.left >= loanLayout.card.left - 1
      && loanLayout.description.right <= loanLayout.card.right + 1
      && loanLayout.description.bottom <= loanLayout.action.top + 1
      && loanLayout.action.bottom <= viewport.height + 1;
    record("English loan terms and action fit the compact card", loanTextInside, loanLayout);

    const loanBefore = await page.evaluate(() => window.__frRun.view());
    await page.evaluate(() => {
      const loanCard = [...document.querySelectorAll(".fr-card-big")]
        .find((card) => card.querySelector(".fr-card-name")?.textContent?.includes("Payday Loan"));
      const button = loanCard?.querySelector(".fr-card-buybar");
      for (let index = 0; index < 25; index += 1) button?.click();
    });
    await page.waitForFunction(() => window.__frRun.view().loan != null, { timeout: 1_000 });
    const loanAfter = await page.evaluate(() => window.__frRun.view());
    record(
      "25 rapid loan clicks create one advance",
      loanAfter.loan != null
        && loanAfter.cash - loanBefore.cash === loanBefore.kpi * 3
        && countResolved(loanAfter) === countResolved(loanBefore) + 1,
      {
        cashBefore: loanBefore.cash,
        cashAfter: loanAfter.cash,
        expectedAdvance: loanBefore.kpi * 3,
        resolvedBefore: countResolved(loanBefore),
        resolvedAfter: countResolved(loanAfter),
      },
    );

    await page.evaluate(() => {
      const run = window.__frRun;
      run.shopOffer.resolved = [false, false, false];
      run.viewCache = null;
      run.bump();
    });
    await page.waitForFunction(() => {
      const loanCard = [...document.querySelectorAll(".fr-card-big")]
        .find((card) => card.querySelector(".fr-card-name")?.textContent?.includes("Payday Loan"));
      return loanCard?.querySelector(".fr-card-buybar")?.disabled === true;
    });
    const activeLoan = await page.evaluate(() => {
      const loanCard = [...document.querySelectorAll(".fr-card-big")]
        .find((card) => card.querySelector(".fr-card-name")?.textContent?.includes("Payday Loan"));
      const button = loanCard?.querySelector(".fr-card-buybar");
      return { disabled: button?.disabled ?? null, label: button?.textContent?.trim() ?? "" };
    });
    record("active loan card explains why it is disabled", activeLoan.disabled === true && activeLoan.label === "LOAN ACTIVE", activeLoan);

    const exactPlan = await page.evaluate(() => {
      const run = window.__frRun;
      window.__setRaceHidden(false);
      run.phase = "shift";
      run.shopOffer = null;
      run.viewCache = null;
      run.bump();
      const before = run.view();
      const loanPayment = before.loan?.perShift ?? 0;
      const requiredPayment = before.bill + loanPayment;
      run.debugSetCash(requiredPayment);
      run.debugEndShift();
      return { loanPayment, requiredPayment, settlement: run.view().settlement };
    });
    await page.waitForSelector(".fr-settlement-overlay", { timeout: 2_000 });
    const exactUi = await page.evaluate(() => {
      const rect = (element) => {
        if (element == null) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      };
      const panel = rect(document.querySelector(".fr-settlement-panel"));
      const payment = rect(document.querySelector(".fr-settlement-payment"));
      const loan = rect(document.querySelector(".fr-settlement-loan-flow"));
      const after = rect(document.querySelector(".fr-settlement-after"));
      const confirm = rect(document.querySelector(".fr-settlement-confirm"));
      return {
        panel,
        payment,
        loan,
        after,
        confirm,
        requiredText: document.querySelector(".fr-settlement-bill")?.textContent?.trim().replace(/\s+/g, " ") ?? "",
        loanText: document.querySelector(".fr-settlement-loan-flow")?.textContent?.trim().replace(/\s+/g, " ") ?? "",
        afterText: document.querySelector(".fr-settlement-after")?.textContent?.trim().replace(/\s+/g, " ") ?? "",
        confirmText: document.querySelector(".fr-settlement-confirm")?.textContent?.trim() ?? "",
      };
    });
    record(
      "loan settlement freezes bill, repayment, total, and final balance",
      exactPlan.settlement?.loanPayment === exactPlan.loanPayment
        && exactPlan.settlement?.requiredPayment === exactPlan.requiredPayment
        && exactPlan.settlement?.cashAfterPayment === 0
        && exactPlan.settlement?.shortfall === 0,
      exactPlan,
    );
    record(
      "English loan repayment is explicit before confirmation",
      exactUi.requiredText.includes("Required today")
        && exactUi.requiredText.includes(`¥${exactPlan.requiredPayment}`)
        && exactUi.loanText.includes("Loan repayment")
        && exactUi.loanText.includes(`¥${exactPlan.loanPayment}`)
        && exactUi.afterText.includes("After all payments")
        && exactUi.afterText.includes("¥0")
        && exactUi.confirmText === "Confirm all payments",
      exactUi,
    );
    record(
      "compact loan payment disclosure stays inside the settlement",
      exactUi.panel != null && exactUi.payment != null && exactUi.loan != null && exactUi.after != null && exactUi.confirm != null
        && exactUi.panel.top >= -1 && exactUi.panel.bottom <= viewport.height + 1
        && exactUi.payment.left >= exactUi.panel.left - 1 && exactUi.payment.right <= exactUi.panel.right + 1
        && exactUi.loan.left >= exactUi.panel.left - 1 && exactUi.loan.right <= exactUi.panel.right + 1
        && exactUi.after.left >= exactUi.panel.left - 1 && exactUi.after.right <= exactUi.panel.right + 1
        && exactUi.confirm.bottom <= viewport.height + 1,
      exactUi,
    );

    await page.evaluate(() => {
      window.__settlementPayTimerCount = 0;
      const button = document.querySelector(".fr-settlement-confirm");
      for (let index = 0; index < 25; index += 1) button?.click();
    });
    await page.waitForFunction(() => window.__frRun.view().phase === "shop", { timeout: 4_000 });
    const exactAfter = await page.evaluate(() => ({
      view: window.__frRun.view(),
      timers: window.__settlementPayTimerCount,
    }));
    record("25 rapid clicks schedule one loan payment", exactAfter.timers === 1, exactAfter);
    record(
      "exact funds atomically pay bill and one loan installment",
      exactAfter.view.cash === 0
        && exactAfter.view.loan?.remaining === loanAfter.loan.remaining - exactPlan.loanPayment
        && exactAfter.view.loan?.shiftsLeft === loanAfter.loan.shiftsLeft - 1,
      exactAfter,
    );

    const shortPlan = await page.evaluate(() => {
      const run = window.__frRun;
      run.phase = "shift";
      run.shopOffer = null;
      run.viewCache = null;
      run.bump();
      const before = run.view();
      const loanPayment = before.loan?.perShift ?? 0;
      const requiredPayment = before.bill + loanPayment;
      run.debugSetCash(requiredPayment - 1);
      run.debugEndShift();
      const settlement = run.view().settlement;
      return { loanPayment, requiredPayment, cashBefore: run.view().cash, loanBefore: run.view().loan, settlement };
    });
    await page.waitForSelector(".fr-settlement-overlay", { timeout: 2_000 });
    const shortUi = await page.evaluate(() => ({
      afterClass: document.querySelector(".fr-settlement-after")?.className ?? "",
      afterText: document.querySelector(".fr-settlement-after")?.textContent?.trim().replace(/\s+/g, " ") ?? "",
      confirmText: document.querySelector(".fr-settlement-confirm")?.textContent?.trim() ?? "",
    }));
    record(
      "one-yen shortfall is disclosed before bankruptcy",
      shortPlan.settlement?.shortfall === 1
        && shortUi.afterClass.includes("is-shortfall")
        && shortUi.afterText.includes("Shortfall")
        && shortUi.afterText.includes("¥1")
        && shortUi.confirmText === "Insufficient — confirm bankruptcy",
      { shortPlan, shortUi },
    );
    await page.evaluate(() => {
      const button = document.querySelector(".fr-settlement-confirm");
      for (let index = 0; index < 25; index += 1) button?.click();
    });
    await page.waitForFunction(() => window.__frRun.view().phase === "bankrupt", { timeout: 4_000 });
    const shortAfter = await page.evaluate(() => window.__frRun.view());
    record(
      "failed required payment is atomic and idempotent",
      shortAfter.cash === shortPlan.cashBefore
        && shortAfter.loan?.remaining === shortPlan.loanBefore.remaining
        && shortAfter.loan?.shiftsLeft === shortPlan.loanBefore.shiftsLeft,
      { shortPlan, shortAfter },
    );
  }
  await page.close();
} catch (error) {
  runtimeErrors.push(error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : String(error));
} finally {
  if (browser != null) await browser.disconnect().catch(() => {});
  if (browserProcess != null && browserProcess.exitCode == null) browserProcess.kill();
  if (vite.exitCode == null) vite.kill();
}

const report = {
  generatedAt: new Date().toISOString(),
  environment: {
    browserPath,
    viewport,
    node: process.version,
    platform: process.platform,
    bodySource: "production FactoryRogueScene, RogueSettlement, and RogueShop through Vite",
    stressOverlays,
  },
  checks,
  runtimeErrors,
  summary: {
    checks: checks.length,
    passed: checks.filter((check) => check.pass).length,
    failed: checks.filter((check) => !check.pass).length,
    runtimeErrors: runtimeErrors.length,
  },
};
report.passed = report.summary.checks === (stressOverlays ? 40 : 19)
  && report.summary.failed === 0
  && runtimeErrors.length === 0;
if (outPath != null) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${outPath}`);
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.passed ? 0 : 1;
