import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import {
  fetchWithTimeout,
  findAvailablePort,
  sleep,
  stopChild,
  waitForFonts,
} from "./browser_e2e_harness.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, "..");
const languages = [
  "en", "zh-Hans", "zh-Hant", "ja", "ko", "fr", "de", "es-ES", "es-419", "pt-BR", "pt-PT",
  "ru", "it", "pl", "tr", "uk", "ar", "th", "vi", "id", "nl",
];
const cases = [
  {
    mode: "menu",
    viewport: { width: 280, height: 452 },
    root: ".game-menubar",
    text: ".menu-item-label, .hud-num, .hud-level, .hud-coins-value",
  },
  {
    mode: "settings",
    viewport: { width: 280, height: 540 },
    root: ".game-panel",
    text: ".panel-title, .settings-label, .settings-btn, .settings-select",
  },
  {
    mode: "backyard",
    viewport: { width: 760, height: 560 },
    root: ".backyard",
    text: ".by-bar-name, .by-bar-sub, .by-soil-chip, .by-upgrade-btn, .by-pet-tag",
  },
];

const browserPath = [
  process.env.MK_BROWSER ?? "",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find((candidate) => candidate && existsSync(candidate));
if (!browserPath) throw new Error("Edge or Chrome was not found");

const artifactDir = process.env.UI_ARTIFACT_DIR ? resolve(process.env.UI_ARTIFACT_DIR) : null;
if (artifactDir) mkdirSync(artifactDir, { recursive: true });
const port = await findAvailablePort();
const baseUrl = `http://127.0.0.1:${port}/`;
const vite = spawn(process.execPath, [
  join(appDir, "node_modules", "vite", "bin", "vite.js"),
  "preview",
  "--host", "127.0.0.1", "--port", String(port), "--strictPort",
], { cwd: appDir, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
let viteError = "";
vite.stderr.on("data", (chunk) => { viteError = (viteError + chunk.toString()).slice(-4_000); });

const waitForServer = async () => {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (vite.exitCode != null) break;
    try {
      if ((await fetchWithTimeout(baseUrl, 2_000)).ok) return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Vite did not become ready (exit=${vite.exitCode})\n${viteError}`);
};

const profileDir = mkdtempSync(join(tmpdir(), "gulugulu-shell-l10n-"));
let browser = null;
const failures = [];
const runtimeErrors = [];
let probeCount = 0;

try {
  await waitForServer();
  browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    userDataDir: profileDir,
    timeout: 90_000,
    args: ["--no-first-run", "--disable-extensions", "--disable-background-networking"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(90_000);
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  for (const language of languages) {
    for (const testCase of cases) {
      await page.setViewport({ ...testCase.viewport, deviceScaleFactor: 1 });
      await page.goto(`${baseUrl}?ui=${testCase.mode}&seed=rich&lang=${encodeURIComponent(language)}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector(testCase.root);
      await waitForFonts(page, 15_000, `fonts ${language}/${testCase.mode}`);
      await page.evaluate(() => new Promise((resolvePaint) => requestAnimationFrame(() => requestAnimationFrame(resolvePaint))));

      const result = await page.evaluate(({ rootSelector, textSelector }) => {
        const root = document.querySelector(rootSelector);
        const visible = (node) => {
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        };
        const nodes = [...document.querySelectorAll(textSelector)].filter(visible).map((node) => {
          const text = node.textContent?.trim().replace(/\s+/g, " ") ?? "";
          return {
            className: node.className,
            text,
            overflowX: node.scrollWidth > node.clientWidth + 1,
            overflowY: node.scrollHeight > node.clientHeight + 1,
            placeholder: /\{[^}]+\}|\b(?:undefined|null)\b/i.test(text),
          };
        });
        return {
          direction: document.documentElement.dir || getComputedStyle(document.documentElement).direction,
          rootMissing: root == null,
          documentOverflowX: document.documentElement.scrollWidth > innerWidth + 1,
          nodes,
        };
      }, { rootSelector: testCase.root, textSelector: testCase.text });

      probeCount += result.nodes.length;
      // Settings is intentionally vertically scrollable and the backyard is a
      // horizontally translated world. Offscreen descendants are therefore not
      // layout failures; horizontal overflow inside a text box still is.
      const badNodes = result.nodes.filter((node) => node.overflowX || node.placeholder);
      const wrongDirection = language === "ar" ? result.direction !== "rtl" : result.direction === "rtl";
      if (result.rootMissing || result.documentOverflowX || wrongDirection || badNodes.length) {
        failures.push({ language, mode: testCase.mode, ...result, nodes: badNodes, wrongDirection });
      }
      if (artifactDir) {
        await page.screenshot({ path: join(artifactDir, `${language}-${testCase.mode}.png`) });
      }
      console.log(`[ok] ${language}/${testCase.mode}: ${result.nodes.length} text probes, dir=${result.direction}`);
    }
  }

  console.log(JSON.stringify({
    languages: languages.length,
    modes: cases.length,
    cases: languages.length * cases.length,
    probeCount,
    screenshotCount: artifactDir ? languages.length * cases.length : 0,
    failureCount: failures.length,
    failures,
    runtimeErrors,
  }, null, 2));
  if (failures.length || runtimeErrors.length) process.exitCode = 1;
} finally {
  if (browser != null) await browser.close().catch(() => {});
  await stopChild(vite, "shell localization Vite server").catch(() => {});
  const safePrefix = resolve(tmpdir(), "gulugulu-shell-l10n-").toLowerCase();
  const resolvedProfile = resolve(profileDir);
  if (!resolvedProfile.toLowerCase().startsWith(safePrefix)) throw new Error(`Unsafe temp cleanup path: ${resolvedProfile}`);
  if (existsSync(resolvedProfile)) rmSync(resolvedProfile, { recursive: true, force: true });
}
