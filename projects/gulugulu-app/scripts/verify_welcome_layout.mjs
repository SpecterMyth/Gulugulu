// 「欢迎回来」卡的**版式**离线验收：在真机窗宽（280px，tauri.conf.json）下渲染真实
// WelcomeReport + 真实 styles.css，逐元素断言「不换行、不溢出」。
//   node scripts/verify_welcome_layout.mjs [--shot]
// 起因：英文标签（"Keys charged" / "actually generated"）比中文长一截，280px 小窗里
// 反复出现半词换行/被裁。这里用 headless Edge 实测每个标签/数值的 getClientRects()
// 行数与 scrollWidth，避免"目测觉得够宽"。--shot 额外出双语截图供肉眼看排版。
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import puppeteer from "puppeteer-core";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const repoDir = join(appDir, "..", "..");
const outDir = join(repoDir, ".claude", "scratchpad", "welcome-layout");
const SHOT = process.argv.includes("--shot");

// 本机 AppData 的 Chrome 是老 121 版，headless 崩溃循环 → 用常青 Edge（同 render_marketing.mjs）。
const CHROME = [
  process.env.MK_BROWSER ?? "",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => p && existsSync(p));
if (!CHROME) {
  console.error("找不到 Edge/Chrome");
  process.exit(1);
}

const WINDOW_W = 280; // src-tauri/tauri.conf.json app.windows[0].width

// 极端数据：每个数字都取该字段在 formatCount 下的最长形态（3 位有效数字 + 单位）。
const SUMMARY = {
  date: "2026-07-22",
  dayIndex: 20656,
  isYesterday: true,
  hasDigest: true,
  tokensRaw: 1_119_000_000, // "1.12B" / "11.2亿"
  tokenBreakdown: { input: 0, cacheCreate: 0, cacheRead: 0, output: 8_470_000 },
  clicks: 963,
  keys: 6_510_000, // "6.51M" —— 三位有效数字下的最长形态之一
  hatches: 7,
  fusions: 4,
  eggsMinted: 0,
  coinsEarned: 505_300,
  releases: 0,
  nightOwl: true, // 命中最长的一条吐槽
};

mkdirSync(outDir, { recursive: true });

// ── 1. 打包一个只渲染战报卡的静态页（真实组件 + 真实全量 CSS）──
const entry = `
import { createRoot } from "react-dom/client";
import { WelcomeReport } from "./game/WelcomeBack";
import { t } from "./i18n";
import "./styles.css";

const lang = new URLSearchParams(location.search).get("lang") === "zh" ? "zh" : "en";
const W = t(lang).sh.welcome;
window.__W = W; // 供探针取「最长吐槽」压高度
const summary = JSON.parse(document.getElementById("summary").textContent);

function Card() {
  return (
    <div className="welcome-overlay">
      <div className="welcome-card welcome-daily" role="dialog">
        <div className="welcome-head">
          <div className="welcome-kicker">{W.kicker}</div>
          <div className="welcome-title">{W.title}</div>
          <div className="welcome-sub">{W.awayFor.replace("{duration}", lang === "zh" ? "9 小时" : "9 hours")}</div>
        </div>
        <WelcomeReport summary={summary} W={W} lang={lang} clickCap={200} />
        <button type="button" className="welcome-cta welcome-cta-daily">{W.start}</button>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Card />);
`;

await build({
  stdin: { contents: entry, resolveDir: join(appDir, "src"), loader: "tsx", sourcefile: "entry.tsx" },
  bundle: true,
  format: "iife",
  jsx: "automatic",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' },
  outfile: join(outDir, "bundle.js"),
  logLevel: "warning",
});

writeFileSync(
  join(outDir, "index.html"),
  // 关掉入场动画：welcome-pop 起始帧是 scale(0.94)+opacity 0，headless 里量到的常是
  // 第 0 帧，宽度会被按 94% 缩小（余量假性变紧 6%）、截图还半透明。量/拍的必须是落定态。
  `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="./bundle.css">
<style>html,body{margin:0;background:#2b6ecb}.welcome-overlay,.welcome-card{animation:none!important;opacity:1!important}</style>
<script type="application/json" id="summary">${JSON.stringify(SUMMARY)}</script>
<div id="root"></div><script src="./bundle.js"></script>`,
);

// ── 2. headless 起页测量 ──
const DBG = 9231;
const profile = join(repoDir, ".claude", "scratchpad", "welcome-layout-profile");
const chromeProc = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--no-first-run",
    "--disable-extensions",
    "--mute-audio",
    "--allow-file-access-from-files",
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${DBG}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
let chromeErr = "";
chromeProc.stderr.on("data", (d) => (chromeErr = (chromeErr + d.toString()).slice(-2000)));

let wsEndpoint = "";
for (let i = 0; i < 100 && !wsEndpoint; i++) {
  if (chromeProc.exitCode != null) break;
  try {
    wsEndpoint = (await (await fetch(`http://127.0.0.1:${DBG}/json/version`)).json()).webSocketDebuggerUrl;
  } catch {
    await new Promise((r) => setTimeout(r, 300));
  }
}
if (!wsEndpoint) {
  console.error(`Chrome 调试端点未就绪(exit=${chromeProc.exitCode})\n${chromeErr}`);
  process.exit(1);
}

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) pass++;
  else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
};

const browser = await puppeteer.connect({
  browserWSEndpoint: wsEndpoint,
  defaultViewport: { width: WINDOW_W, height: 700, deviceScaleFactor: 1 },
});

try {
  for (const lang of ["en", "zh"]) {
    console.log(`\n[${lang}] 280px 窗宽下量版式`);
    const page = await browser.newPage();
    page.on("pageerror", (e) => {
      fail++;
      console.error(`  ✗ 页面报错: ${String(e.message).slice(0, 200)}`);
    });
    await page.goto(`${pathToFileURL(join(outDir, "index.html")).href}?lang=${lang}`, { waitUntil: "load" });
    await page.waitForSelector(".welcome-report", { timeout: 15_000 });
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    const probe = await page.evaluate(() => {
      // 「必须单行」的元素：所有标签与数值（吐槽正文/副标题本就允许折行，不在列）。
      const SINGLE_LINE = [
        [".welcome-kicker", "报头小字"],
        [".welcome-title", "标题"],
        [".welcome-report-date > span", "日期头"],
        [".welcome-hero-label", "Token 标签"],
        [".welcome-hero-val", "Token 数值"],
        [".welcome-hero-note", "生成量副行"],
        [".welcome-row-label", "账本行标签"],
        [".welcome-row-val", "账本行数值"],
        [".welcome-coins-label", "金币标签"],
        [".welcome-coins-val", "金币数值"],
        [".welcome-cta", "按钮"],
      ];
      // 量的是**文本本身**而不是元素盒：块级元素（.welcome-title）的盒子恒等于父宽，
      // getClientRects() 也恒为 1 个矩形——拿它判断换行/余量全是假绿。改用 Range 罩住
      // 元素内容取每个行盒矩形：按不同 top 归并出真实行数，并集宽度即文本实际占宽。
      // （React 把 `{icon} {label}` 渲成多个文本节点 → 同一行会有多个 rect，故按 top 去重。）
      const measure = (el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0 || r.height > 0);
        const lines = new Set(rects.map((r) => Math.round(r.top))).size;
        const cs = getComputedStyle(el);
        const contentW =
          el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
        return { lines, textW: range.getBoundingClientRect().width, contentW };
      };
      const round = (n) => Math.round(n * 10) / 10;

      const items = [];
      for (const [sel, name] of SINGLE_LINE) {
        for (const el of document.querySelectorAll(sel)) {
          const m = measure(el);
          items.push({ name, text: el.textContent.trim(), lines: m.lines, textW: round(m.textW) });
        }
      }
      const card = document.querySelector(".welcome-card");
      const cr = card.getBoundingClientRect();

      // 余量做成**压力测试**而不是逐元素算差值：flex 里的 span 是收缩到内容宽的，
      // 「容器宽-文本宽」恒为 0，量不出任何东西。改为把卡片一格一格调窄，看第一个
      // 断行/被裁的元素在窄多少时出现——这才是"字体换一换还扛不扛得住"的真实答案。
      const offender = () => {
        for (const [sel, name] of SINGLE_LINE) {
          for (const el of document.querySelectorAll(sel)) {
            if (measure(el).lines > 1) return `${name}「${el.textContent.trim()}」`;
          }
        }
        if (card.scrollWidth > card.clientWidth + 0.5) return "卡片横向溢出";
        return null;
      };
      let headroom = 0;
      let firstBreak = null;
      for (let shrink = 0; shrink <= 140; shrink += 1) {
        card.style.width = `${cr.width - shrink}px`;
        const bad = offender();
        if (bad) {
          headroom = shrink - 1;
          firstBreak = bad;
          break;
        }
        headroom = shrink;
      }
      card.style.width = "";

      // 高度上限压测：吐槽是唯一会折多行的文本，换最长的一条看卡片撑到多高——
      // App.tsx 把窗口最多放到 WELCOME_WINDOW_MAX_H(680)，超了就要出内滚动条。
      const roast = card.querySelector(".welcome-roast");
      const keep = roast.textContent;
      const pools = ["roastT0", "roastT1", "roastT2", "roastT3", "roastT4", "roastT5"];
      const all = [
        ...pools.flatMap((k) => window.__W[k]),
        window.__W.roastNightOwl,
        window.__W.roastFusionManiac,
        window.__W.roastEggHoarder,
        window.__W.roastHandsOff,
        window.__W.roastClickStorm,
        window.__W.roastNothing,
      ];
      const longest = all.reduce((a, b) => (b.length > a.length ? b : a));
      roast.textContent = longest;
      const maxH = Math.round(card.scrollHeight);
      roast.textContent = keep;

      return {
        items,
        headroom,
        firstBreak,
        maxH,
        longestRoast: longest.slice(0, 28) + "…",
        viewportW: document.documentElement.clientWidth,
        card: {
          w: round(cr.width),
          h: Math.round(card.scrollHeight),
          clipped: card.scrollWidth > card.clientWidth + 0.5,
          fitsWindow: cr.left >= -0.5 && cr.right <= window.innerWidth + 0.5,
        },
      };
    });

    for (const it of probe.items) {
      ok(it.lines === 1, `${it.name}「${it.text}」应单行，实测 ${it.lines} 行（文本 ${it.textW}px）`);
    }
    ok(!probe.card.clipped, `卡片横向无溢出`);
    ok(probe.card.fitsWindow, `卡片完整落在 ${WINDOW_W}px 窗内`);
    console.log(
      `  视口 ${probe.viewportW}px · 卡宽 ${probe.card.w}px · 内容高 ${probe.card.h}px · 量了 ${probe.items.length} 个文本盒`,
    );
    console.log(`  抗压余量 ${probe.headroom}px（再窄就轮到 ${probe.firstBreak ?? "无"} 断行）`);
    console.log(`  最长吐槽下卡高 ${probe.maxH}px（「${probe.longestRoast}」）`);
    ok(probe.headroom >= 6, `抗压余量仅 ${probe.headroom}px（<6px）：换字体/调字号就要断行`);
    ok(probe.maxH + 34 <= 680, `最长吐槽把卡片撑到 ${probe.maxH}px，+34 边距超窗口上限 680px`);
    ok(probe.card.h + 34 <= 680, `卡片内容高 ${probe.card.h}px + 34 边距超出窗口上限 680px（会出内滚动条）`);

    if (SHOT) {
      const shot = join(outDir, `welcome-${lang}.png`);
      await page.setViewport({ width: WINDOW_W, height: probe.card.h + 40, deviceScaleFactor: 2 });
      await page.screenshot({ path: shot });
      console.log(`  截图 → ${shot}`);
    }
    await page.close();
  }
} finally {
  await browser.disconnect();
  chromeProc.kill();
}

console.log(`\n${fail === 0 ? "✅" : "❌"} welcome-layout: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
