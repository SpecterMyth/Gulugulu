// 无头逐帧导出宣传片 → MP4(中英文各一支)。
//   node scripts/render_video.mjs [--only=en|zh] [--fps=30]
// 单实例无头 Chrome:每帧 window.__seek(t) 精确定位 React 时间线(不靠无头 rAF),
// CDP 虚拟时钟每帧步进 FRAME_MS 推进 CSS 动画,截图 PNG 直接喂 ffmpeg image2pipe。
import { spawn, execFile } from "node:child_process";
import { existsSync, mkdirSync, appendFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const repoDir = join(appDir, "..", "..");
const outDir = join(repoDir, ".claude", "scratchpad", "trailer");

const FFMPEG = "C:/Users/admin/AppData/Local/Microsoft/WinGet/Links/ffmpeg.exe";
const CHROME = [
  "C:/Users/admin/AppData/Local/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].find((p) => existsSync(p));

const PORT = 4193;
const BASE = `http://localhost:${PORT}/trailer.html`;
const fpsArg = process.argv.find((a) => a.startsWith("--fps="));
const FPS = fpsArg ? Number(fpsArg.slice(6)) : 30;
const FRAME_MS = 1000 / FPS;
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const LANGS = onlyArg ? [onlyArg.slice(7)] : ["en", "zh"];
const maxArg = process.argv.find((a) => a.startsWith("--max=")); // 冒烟测试:只渲前 N 帧
const MAX_FRAMES = maxArg ? Number(maxArg.slice(6)) : Infinity;

if (!CHROME) {
  console.error("找不到 Chrome");
  process.exit(1);
}
if (!existsSync(FFMPEG)) {
  console.error("找不到 ffmpeg:", FFMPEG);
  process.exit(1);
}

async function waitReady(timeout = 90_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      /* not up */
    }
    if (Date.now() > deadline) throw new Error("vite dev 启动超时");
    await new Promise((r) => setTimeout(r, 500));
  }
}

mkdirSync(outDir, { recursive: true });
const LOG = join(outDir, "render.log");
writeFileSync(LOG, "");
const log = (m) => {
  const line = `[${new Date().toTimeString().slice(0, 8)}] ${m}`;
  console.log(line);
  try {
    appendFileSync(LOG, line + "\n");
  } catch {
    /* ignore */
  }
};
// 先构建静态宣传片包(读当前源码),再用 vite preview 静态托管 —— 无 HMR/按需编译,
// 无头 CDP 秒开,彻底避开 vite dev 的冷编译/websocket 卡顿。
log("构建静态宣传片包(vite build)…");
await new Promise((res, rej) => {
  const b = spawn("npx", ["vite", "build", "--config", "vite.trailer.config.ts"], { cwd: appDir, shell: true, stdio: "ignore" });
  b.on("close", (c) => (c === 0 ? res() : rej(new Error("vite build 失败 code " + c))));
}).catch((e) => {
  log(String(e));
  process.exit(1);
});
const vite = spawn("npx", ["vite", "preview", "--config", "vite.trailer.config.ts", "--port", String(PORT), "--strictPort"], { cwd: appDir, shell: true, stdio: "ignore" });
log(`vite preview 托管中(PORT=${PORT},pid=${vite.pid})…`);

let failures = 0;
let browser;
let chromeProc;
try {
  await waitReady();
  await new Promise((r) => setTimeout(r, 800));

  // 手动以 old headless 启动系统 Chrome(puppeteer 的 new headless 下本项目 React 不挂载),
  // 再 puppeteer.connect —— 复用 capture_trailer 验证过的 --headless=old 引擎。
  const DBG = 9223;
  const profile = join(repoDir, ".claude", "scratchpad", "render-profile");
  chromeProc = spawn(
    CHROME,
    [
      "--headless=old",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1920,1080",
      "--no-first-run",
      "--disable-extensions",
      "--mute-audio",
      // 确定性渲染:把 CSS 动画从合成线程搬回主线程(受我步进的虚拟时钟驱动),
      // 否则合成线程动画与虚拟时钟不同步 → 截图抓到错位帧 → 角色动画抖。
      "--disable-threaded-animation",
      "--disable-threaded-scrolling",
      "--disable-checker-imaging",
      "--disable-new-content-rendering-timeout",
      "--run-all-compositor-stages-before-draw",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${DBG}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let wsEndpoint = "";
  for (let i = 0; i < 50 && !wsEndpoint; i++) {
    try {
      wsEndpoint = (await (await fetch(`http://127.0.0.1:${DBG}/json/version`)).json()).webSocketDebuggerUrl;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  if (!wsEndpoint) throw new Error("Chrome 调试端点未就绪");
  log(`Chrome(old headless)已连:${wsEndpoint.slice(0, 40)}…`);
  browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint, defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 } });

  for (const lang of LANGS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    const client = await page.createCDPSession();
    page.on("console", (m) => { const t = m.text(); if (m.type() === "error" || m.type() === "warning") log(`  PAGE[${m.type()}] ${t.slice(0, 220)}`); });
    page.on("pageerror", (e) => log(`  PAGEERR: ${String(e.message).slice(0, 300)}`));
    page.on("requestfailed", (r) => log(`  REQFAIL: ${r.url().slice(-70)} ${r.failure()?.errorText}`));

    // 抓页面运行时错误(判断是否 JS 报错导致 React 不挂载)。
    await page.evaluateOnNewDocument(() => {
      window.addEventListener("error", (e) => (window.__err = "err: " + (e.message || String(e.error)).slice(0, 200)));
      window.addEventListener("unhandledrejection", (e) => (window.__err = "reject: " + String(e.reason).slice(0, 200)));
    });

    log(`[${lang}] 加载静态页…`);
    await page.goto(`${BASE}?render=1&clean=1&lang=${lang}`, { waitUntil: "load", timeout: 60_000 }).catch((e) => log(`  goto: ${String(e).slice(0, 80)}`));
    await page.waitForFunction(() => typeof window.__seek === "function" && (window.__TRAILER_TOTAL || 0) > 0, { timeout: 30_000, polling: 200 });
    log(`[${lang}] 应用就绪`);
    await page.evaluate(() => document.fonts.ready).catch(() => {}); // 等 CJK / ZCOOL 字体就绪
    await page.evaluate((t) => window.__seek(t), 0);

    const total = await page.evaluate(() => window.__TRAILER_TOTAL || 62000);
    const frames = Math.min(Math.ceil(total / FRAME_MS), MAX_FRAMES);
    console.log(`[${lang}] 总长 ${(total / 1000).toFixed(1)}s → ${frames} 帧 @ ${FPS}fps`);

    const outPath = join(outDir, `gulugulu_trailer_${lang}.mp4`);
    let ffErr = "";
    const ff = spawn(
      FFMPEG,
      [
        "-y",
        "-f", "image2pipe",
        "-framerate", String(FPS),
        "-i", "pipe:0",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-crf", "18",
        "-preset", "veryfast",
        "-r", String(FPS),
        "-movflags", "+faststart",
        outPath,
      ],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    ff.stderr.on("data", (d) => (ffErr = (ffErr + d.toString()).slice(-2000)));

    const writeFrame = (buf) =>
      new Promise((res) => {
        if (ff.stdin.write(buf)) res();
        else ff.stdin.once("drain", res);
      });

    // 逐帧:page 内 __seek(T) 同步定住 React + 把所有 CSS 动画冻结到 T(确定性,与真实
    // 墙钟无关),再截图。CSS 动画由页面内 currentTime 控制,故这里无需虚拟时钟。
    const t0 = Date.now();
    for (let i = 0; i < frames; i++) {
      const T = Math.min(total, Math.round(i * FRAME_MS));
      await page.evaluate((t) => window.__seek(t), T);
      const shot = page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1920, height: 1080 }, captureBeyondViewport: false });
      const png = await Promise.race([shot, new Promise((_, rej) => setTimeout(() => rej(new Error("screenshot 超时")), 20000))]);
      await writeFrame(png);
      if (i % 30 === 0 || i === frames - 1) {
        const pct = (((i + 1) / frames) * 100).toFixed(0);
        const eta = i > 0 ? ((((Date.now() - t0) / (i + 1)) * (frames - i - 1)) / 1000).toFixed(0) : "?";
        log(`[${lang}] ${i + 1}/${frames} (${pct}%) ETA ${eta}s`);
      }
    }
    ff.stdin.end();
    const code = await new Promise((res) => ff.on("close", res));
    await page.close();
    if (code === 0) {
      console.log(`[${lang}] ✅ ${outPath}`);
    } else {
      failures += 1;
      console.error(`[${lang}] ffmpeg 退出码 ${code}\n${ffErr}`);
    }
  }
} catch (err) {
  failures += 1;
  console.error("渲染失败:", err?.stack ?? err);
} finally {
  if (browser) await browser.disconnect().catch(() => {});
  if (chromeProc?.pid) await new Promise((r) => execFile("taskkill", ["/pid", String(chromeProc.pid), "/T", "/F"], () => r()));
  if (vite.pid) await new Promise((r) => execFile("taskkill", ["/pid", String(vite.pid), "/T", "/F"], () => r()));
}
console.log(failures ? `${failures} 个失败` : `全部完成 → ${outDir}`);
process.exitCode = failures ? 1 : 0;
