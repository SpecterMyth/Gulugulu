import { spawn } from "node:child_process";
// Exhaustive 21-language card/settlement geometry regression at the supported
// 640x480 stress floor. Uses the production build via `vite preview`.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import puppeteer from "puppeteer-core";
import { fetchWithTimeout, findAvailablePort, sleep, stopChild, withTimeout } from "./browser_e2e_harness.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, "..");
const allLanguages = [
  "en", "zh-Hans", "zh-Hant", "ja", "ko", "fr", "de", "es-ES", "es-419", "pt-BR", "pt-PT",
  "ru", "it", "pl", "tr", "uk", "ar", "th", "vi", "id", "nl",
];
const languages = process.env.L10N_LANGUAGES
  ? process.env.L10N_LANGUAGES.split(",").filter(Boolean)
  : allLanguages;

const browserPath = [
  process.env.MK_BROWSER ?? "",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find((candidate) => candidate && existsSync(candidate));
if (!browserPath) throw new Error("Edge or Chrome was not found");

const bundled = await build({
  entryPoints: [join(appDir, "src", "game", "factory", "rogueConfig.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
});
const configModule = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const allCardDefs = configModule.CARD_DEFS.map(({ id, maxLevel }) => ({ id, maxLevel: maxLevel ?? 1 }));
const wantedCards = new Set((process.env.L10N_CARDS ?? "").split(",").filter(Boolean));
const cardDefs = wantedCards.size ? allCardDefs.filter(({ id }) => wantedCards.has(id)) : allCardDefs;

const port = await findAvailablePort();
const baseUrl = `http://127.0.0.1:${port}/`;
const vite = spawn(process.execPath, [
  join(appDir, "node_modules", "vite", "bin", "vite.js"),
  "preview",
  "--host", "127.0.0.1", "--port", String(port), "--strictPort",
], { cwd: appDir, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
let viteError = "";
vite.stderr.on("data", (chunk) => { viteError = (viteError + chunk.toString()).slice(-4000); });

const waitForServer = async () => {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (vite.exitCode != null) break;
    try {
      const response = await fetchWithTimeout(baseUrl, 2000);
      if (response.ok) return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Vite did not become ready (exit=${vite.exitCode})\n${viteError}`);
};

const profileDir = mkdtempSync(join(tmpdir(), "gulugulu-l10n-ui-"));
let browser = null;
const failures = [];
const summaries = [];
const runtimeErrors = [];

const nextPaint = (page) => page.evaluate(() => new Promise((resolvePaint) => {
  requestAnimationFrame(() => requestAnimationFrame(resolvePaint));
}));

try {
  await waitForServer();
  browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    userDataDir: profileDir,
    timeout: 90000,
    args: ["--no-first-run", "--disable-extensions", "--disable-background-networking"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(90000);
  await page.evaluateOnNewDocument(() => {
    localStorage.removeItem("gulugulu.factory_rogue.run.v1");
    localStorage.removeItem("gulugulu.factory_rogue.lastLoadout");
    localStorage.removeItem("gulugulu.factory.strike-warning.v1");
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  for (const language of languages) {
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}?ui=factory&seed=rich&lang=${encodeURIComponent(language)}&frdebug=1&frseed=90210`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector(".fr-lo-clockin");
    await page.setViewport({ width: 640, height: 480, deviceScaleFactor: 1 });
    await nextPaint(page);
    const loadout = await page.evaluate(() => {
      const selectors = [".fr-lo-legend-score", ".fr-lo-legend-drain", ".fr-lo-count", ".fr-lo-clockin"];
      const nodes = selectors.map((selector) => {
        const node = document.querySelector(selector);
        const box = node?.getBoundingClientRect();
        const text = node?.textContent?.trim().replace(/\s+/g, " ") ?? "";
        return {
          selector,
          text,
          missing: node == null,
          overflow: node != null && (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1),
          outsideViewport: box != null && (box.left < -1 || box.right > innerWidth + 1 || box.top < -1 || box.bottom > innerHeight + 1),
          invalidText: text.length === 0 || /\{[^}]+\}|\([A-Z]\)\s*$/.test(text),
        };
      });
      return {
        nodes,
        documentOverflowX: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    const loadoutProblems = loadout.nodes.filter((node) => node.missing || node.overflow || node.outsideViewport || node.invalidText);
    if (loadoutProblems.length || loadout.documentOverflowX) {
      failures.push({ kind: "loadout", language, nodes: loadoutProblems, documentOverflowX: loadout.documentOverflowX });
    }
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.click(".fr-lo-clockin");
    await page.waitForSelector(".fr-hiring-panel");
    for (let round = 0; round < 8 && await page.$(".fr-hiring-panel") != null; round += 1) {
      const clockIn = await page.$(".fr-hiring-clock:not([disabled])");
      if (clockIn == null) throw new Error(`Hiring confirmation is disabled for ${language}`);
      await clockIn.click();
      await sleep(180);
      const confirm = await page.$(".fr-hiring-confirm .is-confirm");
      if (confirm != null) await confirm.click();
      await sleep(1250);
    }
    await page.waitForFunction(() => window.__frRun != null);
    await withTimeout(page.evaluate(() => document.fonts?.ready), 15000, `fonts ${language}`);
    await page.setViewport({ width: 640, height: 480, deviceScaleFactor: 1 });

    let renderedCards = 0;
    for (let offset = 0; offset < cardDefs.length; offset += 3) {
      const rawBatch = cardDefs.slice(offset, offset + 3);
      const batch = rawBatch.concat(Array.from({ length: 3 - rawBatch.length }, () => rawBatch.at(-1)));
      await page.evaluate((items) => {
        const run = window.__frRun;
        run.phase = "shop";
        run.settlement = null;
        run.cards = Object.fromEntries(items.map((item) => [item.id, Math.max(0, item.maxLevel - 1)]));
        const ids = items.map((item) => item.id);
        run.shopOffer = {
          dims: [2, 1, 3],
          cards: [ids, ids, ids],
          resolved: [false, false, false],
          rerollCounts: [0, 0, 0],
        };
        run.viewCache = null;
        run.cash = 1_000_000_000;
        run.bump();
      }, batch);
      await page.waitForFunction(() => document.querySelectorAll(".fr-card-big").length === 3);
      await nextPaint(page);

      const probes = await page.evaluate(() => {
        const rect = (element) => {
          const value = element.getBoundingClientRect();
          return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
        };
        return [...document.querySelectorAll(".fr-card-big")].map((card) => {
          const name = card.querySelector(".fr-card-name");
          const desc = card.querySelector(".fr-card-desc");
          const buy = card.querySelector(".fr-card-buybar");
          const cardRect = rect(card);
          const nameRect = rect(name);
          const descRect = rect(desc);
          const buyRect = rect(buy);
          const overflowNodes = [name, desc, buy].filter((node) =>
            node.scrollWidth > node.clientWidth + 1
          ).map((node) => ({
            className: node.className,
            clientWidth: node.clientWidth,
            scrollWidth: node.scrollWidth,
            clientHeight: node.clientHeight,
            scrollHeight: node.scrollHeight,
          }));
          return {
            name: name.textContent.trim(),
            desc: desc.textContent.trim(),
            buy: buy.textContent.trim(),
            overflowNodes,
            contentBelowCard: buy.offsetTop + buy.offsetHeight > card.clientHeight + 1,
            cardHeight: card.clientHeight,
            buyBottom: buy.offsetTop + buy.offsetHeight,
            descBuyCollision: desc.offsetTop + desc.offsetHeight > buy.offsetTop + 1,
            nameDescCollision: name.offsetTop + name.offsetHeight > desc.offsetTop + 1,
            documentOverflowX: document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
      });

      probes.slice(0, rawBatch.length).forEach((probe, index) => {
        renderedCards += 1;
        if (probe.overflowNodes.length || probe.contentBelowCard || probe.descBuyCollision || probe.nameDescCollision
          || probe.documentOverflowX) {
          failures.push({ kind: "card", language, cardId: rawBatch[index].id, ...probe });
        }
      });
    }

    await page.evaluate(() => {
      const run = window.__frRun;
      run.phase = "shift";
      run.shopOffer = null;
      run.settlement = null;
      run.viewCache = null;
      run.cash = 1_000_000_000;
      run.bump();
      run.debugEndShift();
    });
    await page.waitForSelector(".fr-settlement-confirm");
    await nextPaint(page);
    const settlement = await page.evaluate(() => {
      const button = document.querySelector(".fr-settlement-confirm");
      const panel = document.querySelector(".fr-settlement-panel");
      const buttonRect = button.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const text = button.textContent.trim().replace(/\s+/g, " ");
      return {
        text,
        mnemonic: /\([A-Z]\)\s*$/.test(text),
        buttonOverflow: button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1,
        outsidePanel: buttonRect.left < panelRect.left - 1 || buttonRect.right > panelRect.right + 1
          || buttonRect.bottom > panelRect.bottom + 1,
        outsideViewport: buttonRect.left < -1 || buttonRect.right > innerWidth + 1
          || buttonRect.top < -1 || buttonRect.bottom > innerHeight + 1,
        documentOverflowX: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    if (settlement.mnemonic || settlement.buttonOverflow || settlement.outsidePanel
      || settlement.outsideViewport || settlement.documentOverflowX) {
      failures.push({ kind: "settlement", language, ...settlement });
    }
    summaries.push({ language, cards: renderedCards, settlement: settlement.text });
    console.log(`[ok] ${language}: ${renderedCards} cards; settlement=${JSON.stringify(settlement.text)}`);
  }

  console.log(JSON.stringify({
    languages: summaries.length,
    cardsPerLanguage: cardDefs.length,
    cardProbes: summaries.length * cardDefs.length,
    loadoutProbes: summaries.length * 4,
    settlementProbes: summaries.length,
    probes: summaries.length * (cardDefs.length + 5),
    failureCount: failures.length,
    failures: failures.map((failure) => ({
      kind: failure.kind,
      language: failure.language,
      cardId: failure.cardId,
      name: failure.name,
      overflow: failure.overflowNodes?.map((node) => `${node.className}:${node.scrollWidth}/${node.clientWidth}`),
      content: failure.contentBelowCard ? `${failure.buyBottom}/${failure.cardHeight}` : undefined,
      descBuyCollision: failure.descBuyCollision,
      nameDescCollision: failure.nameDescCollision,
      documentOverflowX: failure.documentOverflowX,
      text: failure.kind === "settlement" ? failure.text : undefined,
      nodes: failure.kind === "loadout" ? failure.nodes : undefined,
    })),
    runtimeErrors,
  }, null, 2));
  if (failures.length || runtimeErrors.length) process.exitCode = 1;
} finally {
  if (browser != null) await browser.close().catch(() => {});
  await stopChild(vite, "localization Vite server").catch(() => {});
  const safePrefix = resolve(tmpdir(), "gulugulu-l10n-ui-").toLowerCase();
  const resolvedProfile = resolve(profileDir);
  if (!resolvedProfile.toLowerCase().startsWith(safePrefix)) throw new Error(`Unsafe temp cleanup path: ${resolvedProfile}`);
  if (existsSync(resolvedProfile)) rmSync(resolvedProfile, { recursive: true, force: true });
}
