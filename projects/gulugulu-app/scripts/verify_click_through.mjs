// 点击穿透判定的离线验收（配 src/app/hooks/useClickThrough.ts + src-tauri/src/click_through.rs）。
//   node scripts/verify_click_through.mjs [--shot]
// 真机的「鼠标穿透」本身没法自动化，但**判定规则**可以：按真机窗尺寸渲染真实场景 +
// 真实 CSS，用 isSolidAt 扫一遍网格，断言
//   ① 透明处判穿透（原 bug：整窗吃点击，工厂那块是整屏）
//   ② 画出来的东西（精灵/蛋/气泡/地面/办公室/飞机/HUD）判实心（别把用户自己的界面点没了）
//   ③ 实心区被限制在美术盒 + 膨胀余量之内，且确实比"只按描画像素"更宽一圈
//   ④ 后院沿窗四边留出 OS 缩放热区的实心带（否则拖不动上沿改高）。
// --shot 额外导出各场景 PNG 供肉眼复核。
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import puppeteer from "puppeteer-core";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const repoDir = join(appDir, "..", "..");
const outDir = join(repoDir, ".claude", "scratchpad", "click-through");
const SHOT = process.argv.includes("--shot");

// 本机 AppData 的 Chrome 是老 121 版，headless 崩溃循环 → 用常青 Edge（同 verify_welcome_layout.mjs）。
const CHROME = [
  process.env.MK_BROWSER ?? "",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].find((p) => p && existsSync(p));
if (!CHROME) {
  console.error("找不到 Edge/Chrome");
  process.exit(1);
}

// pet/egg/speech = src-tauri/tauri.conf.json 的 280×320 小窗；backyard = 工作区宽的底部
// 横条（dock_backyard_window）；factory = 整个工作区（dock_factory_window）。
// grip = App.tsx 传给 useClickThrough 的 edgeGripPx（只有后院是 resizable 窗）。
const SCENES = {
  pet: { w: 280, h: 320, step: 5, grip: 0, art: [".duck-facing"] },
  egg: { w: 280, h: 320, step: 5, grip: 0, art: [".duck-facing"] },
  speech: { w: 280, h: 320, step: 5, grip: 0, art: [".duck-facing", ".speech"] },
  backyard: { w: 1280, h: 428, step: 20, grip: 8, art: [] },
  // .fac-rope/.fac-hang 是绝对定位挂在 .fac-plane 之下的，不在飞机自身的 rect 里，得单列。
  factory: {
    w: 1280,
    h: 720,
    step: 20,
    grip: 0,
    art: [".fac-office", ".fac-plane", ".fac-rope", ".fac-hang", ".fac-cloud", ".fac-pet", ".fac-hud"],
  },
};

mkdirSync(outDir, { recursive: true });

// ── 1. 打包一个「和 App 各 uiMode 同构」的静态页（真实组件 + 真实全量 CSS）──
// DOM 嵌套必须与 App.tsx / PetStage.tsx / BackyardScene.tsx 一致：判定规则就是靠这层
// 嵌套区分「骨架容器」与「真画了东西的元素」的。
const entry = `
import { createRoot } from "react-dom/client";
import { SvgSprite, EggSvg } from "./sprites/SvgSprite";
import { NearDecor } from "./game/BackyardDecor";
import { FactoryScene } from "./game/FactoryScene";
import { isSolidAt, isPaintedAt, isEdgeGrip, HIT_DILATION_PX } from "./app/hooks/useClickThrough";
import rawConfig from "./game/config.json";
import "./styles.css";
import "./game/backyard.css";
import "./game/factory.css";

const config = rawConfig;
const species = Object.keys(config.species)[0];
const params = new URLSearchParams(location.search);
const scene = params.get("scene") ?? "pet";
const W = Number(params.get("w"));
const H = Number(params.get("h"));

Object.assign(window, {
  __hit: isSolidAt,
  __painted: isPaintedAt,
  __grip: isEdgeGrip,
  __dilation: HIT_DILATION_PX,
  __species: species,
});

// 工厂只读 save.pets（组件自己声明"不写任何游戏状态"）。
const SAVE = { pets: [0, 1, 2].map((i) => ({ id: "p" + i, species, tier: 1, level: 1, exp: 0 })) };

const docked = scene === "backyard" || scene === "factory";

function Shell() {
  return (
    <main
      className={"pet-shell state-idle facing-right ui-" + (docked ? scene : "pet")}
      style={docked ? { width: "100%", height: "100%" } : { width: W, height: H }}
    >
      {scene === "backyard" ? (
        // 真 BackyardScene 要 30 个 props（含一堆 invoke 回调），这里只复刻**判定相关**的
        // 那层容器嵌套 + 真实近景美术：根 → 缩放舞台 → 视差层 → 调色包裹 → NearDecor。
        <div className="backyard">
          <div className="by-stage" style={{ width: W, height: H }}>
            <div className="by-sky" style={{ position: "absolute", inset: 0 }} />
            <div className="by-layer" style={{ width: 6000, transform: "translate3d(0px,56px,0)" }}>
              <div className="by-grade-scene">
                <NearDecor />
              </div>
            </div>
            <div className="by-soil-ui">
              <button type="button" className="by-upgrade-btn">升级</button>
            </div>
          </div>
        </div>
      ) : scene === "factory" ? (
        <FactoryScene save={SAVE} config={config} onBack={() => {}} />
      ) : (
        <>
          {scene === "speech" && <div className="speech"><span className="speech-text">今天也在摸鱼吗</span></div>}
          <div className="pet-stage">
            <div className="exp-pop-layer" aria-hidden="true" />
            <div className="duck-facing">
              {scene === "egg" ? (
                <div className="stage-egg">
                  <EggSvg species={species} tier={1} config={config} phase="incubating" progress={0.5} secondsLeft={90} className="stage-egg-svg" />
                  <div className="stage-egg-label">孵化中</div>
                </div>
              ) : (
                <div className="pet-react-pulse">
                  <SvgSprite species={species} config={config} petState="idle" className="duck duck-svg" />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")).render(<Shell />);
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
  // 冻结 CSS 动画：精灵/飞机是逐帧动的，不定住则命中网格每次都不一样。
  // （rAF 驱动的位移拦不住，但 page.evaluate 是单个 JS 任务、扫描期间 DOM 冻结，
  //   所以"取矩形 + 扫网格"必须压在同一次 evaluate 里——下面就是这么写的。）
  `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="./bundle.css">
<style>html,body{margin:0;height:100%;background:#2b6ecb}#root{height:100%}*{animation:none!important;transition:none!important}</style>
<div id="root"></div><script src="./bundle.js"></script>`,
);

// ── 2. headless 起页扫网格 ──
const DBG = 9233;
const profile = join(repoDir, ".claude", "scratchpad", "click-through-profile");
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

const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });

const scan = async (scene, cfg, probeSpecs) => {
  const page = await browser.newPage();
  page.on("pageerror", (e) => {
    fail++;
    console.error(`  ✗ 页面报错: ${String(e.message).slice(0, 200)}`);
  });
  await page.setViewport({ width: cfg.w, height: cfg.h, deviceScaleFactor: 1 });
  const url = `${pathToFileURL(join(outDir, "index.html")).href}?scene=${scene}&w=${cfg.w}&h=${cfg.h}`;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForSelector(".pet-shell > *", { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  // 工厂的运输机/落体由 rAF 驱动，等几帧让飞机进画、宠物落定后再量。
  await new Promise((r) => setTimeout(r, 900));

  const probe = await page.evaluate(
    (opts) => {
      const { step, w, h, grip, art, probes } = opts;
      const rectOf = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
      };
      // 美术盒 = 所有"应该实心"的元素矩形（同类选择器取全部，如 200 个打工仔）。
      const artRects = art.flatMap((sel) =>
        [...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect()),
      );
      const pad = window.__dilation + step;
      const inArt = (x, y) =>
        artRects.some((b) => x >= b.left - pad && x <= b.right + pad && y >= b.top - pad && y <= b.bottom + pad);

      const rows = [];
      let solid = 0;
      let painted = 0;
      let total = 0;
      let outside = 0;
      let freePoint = null; // 第一个「不在任何美术盒里」的采样点：那里必须穿透
      for (let y = step / 2; y < h; y += step) {
        let row = "";
        for (let x = step / 2; x < w; x += step) {
          total++;
          const isSolid = window.__hit(x, y);
          const isPainted = window.__painted(x, y);
          if (isPainted) painted++;
          if (isSolid) {
            solid++;
            if (artRects.length && !inArt(x, y)) outside++;
          }
          // 膨胀是单调的：描画处必定实心。
          if (isPainted && !isSolid) outside += 1000;
          if (!freePoint && artRects.length && !inArt(x, y) && !window.__grip(x, y, grip)) {
            freePoint = { x, y, solid: isSolid };
          }
          row += isSolid ? (isPainted ? "#" : "+") : ".";
        }
        rows.push(row);
      }

      const hits = {};
      for (const [name, spec] of Object.entries(probes)) {
        if (spec.sel) {
          const r = rectOf(spec.sel);
          hits[name] = r ? window.__hit(r.cx, r.cy) : null;
        } else {
          hits[name] = window.__hit(spec.at[0] * w, spec.at[1] * h);
        }
      }
      return {
        rows,
        solid,
        painted,
        total,
        outside,
        freePoint,
        hits,
        // 缩放热区：贴边应实心、正中不应被误判为边
        gripEdge: window.__grip(2, h / 2, grip),
        gripCenter: window.__grip(w / 2, h / 2, grip),
        species: window.__species,
      };
    },
    { step: cfg.step, w: cfg.w, h: cfg.h, grip: cfg.grip, art: cfg.art, probes: probeSpecs },
  );

  if (SHOT) {
    const shot = join(outDir, `click-through-${scene}.png`);
    await page.screenshot({ path: shot });
    console.log(`  截图 → ${shot}`);
  }
  await page.close();
  return probe;
};

// 每个场景要点名验的「这里必须实心」（用户自己的界面）与「这里必须穿透」（看得见桌面）。
const PROBES = {
  pet: { art: { sel: ".svg-sprite-body" }, topGap: { at: [0.5, 0.15] } },
  egg: { art: { sel: ".egg-svg" }, label: { sel: ".stage-egg-label" }, eggBoxCorner: { at: [0.2, 0.55] } },
  speech: { art: { sel: ".svg-sprite-body" }, bubble: { sel: ".speech" } },
  backyard: { ground: { at: [0.5, 0.94] }, hud: { sel: ".by-upgrade-btn" }, sky: { at: [0.5, 0.12] } },
  factory: { office: { at: [0.5, 0.94] }, back: { sel: ".fac-back" }, plane: { sel: ".fac-plane" } },
};

try {
  for (const [scene, cfg] of Object.entries(SCENES)) {
    const p = await scan(scene, cfg, PROBES[scene]);
    const ratio = p.solid / p.total;
    console.log(
      `\n[${scene}] ${cfg.w}×${cfg.h} · 实心 ${p.solid}/${p.total} = ${(ratio * 100).toFixed(1)}% · 命中 ${JSON.stringify(p.hits)}`,
    );
    console.log(p.rows.map((r) => `    ${r}`).join("\n"));

    // —— 通用：透明处穿透 / 画出来的实心 / 实心不越界 / 膨胀生效 ——
    ok(p.outside === 0, `有 ${p.outside} 个实心点落在美术盒 + 膨胀余量之外（或描画点竟判成穿透）`);
    // 原状态是 100% 实心；低于 60% 才算真的把桌面还给用户。下限防"判过头把界面点没了"。
    ok(ratio < 0.6, `实心占比 ${(ratio * 100).toFixed(1)}% ≥ 60%，穿透基本没生效`);
    ok(ratio > 0.03, `实心占比 ${(ratio * 100).toFixed(1)}% ≤ 3%，画面可能整个变成不可点`);
    ok(p.solid > p.painted, `膨胀余量没生效：实心 ${p.solid} 未超过纯描画 ${p.painted}`);
    if (p.freePoint) {
      ok(!p.freePoint.solid, `美术盒之外的点 (${p.freePoint.x},${p.freePoint.y}) 仍判实心`);
    }

    // —— 缩放热区：只有后院留带子 ——
    ok(p.gripEdge === (cfg.grip > 0), `贴边 grip 应为 ${cfg.grip > 0}（后院靠它拖上沿改高）`);
    ok(p.gripCenter === false, `画面正中不该被当成窗口边`);

    // —— 逐场景点名 ——
    if (scene === "pet" || scene === "speech") {
      ok(p.hits.art === true, `精灵中心应实心（否则用户点不动自己的宠物）`);
    }
    if (scene === "pet") ok(p.hits.topGap === false, `精灵上方的空白应穿透`);
    if (scene === "speech") ok(p.hits.bubble === true, `对话气泡应实心（有底色的木牌，不该被点穿）`);
    if (scene === "egg") {
      ok(p.hits.art === true, `蛋中心应实心`);
      ok(p.hits.label === true, `「孵化中」标签应实心`);
      // .stage-egg 漏进白名单的话这里会红：整颗蛋退化成 150px 见方的实心块。
      ok(p.hits.eggBoxCorner === false, `蛋壳盒内、蛋轮廓外的空隙应穿透`);
    }
    if (scene === "backyard") {
      ok(p.hits.sky === false, `后院天空应穿透（看得见桌面就该点得到桌面）`);
      ok(p.hits.ground === true, `后院地面应实心（「点地行走」要留着）`);
      ok(p.hits.hud === true, `后院升级木牌应实心`);
    }
    if (scene === "factory") {
      ok(p.hits.office === true, `工厂办公室应实心（空投的主要落点区）`);
      ok(p.hits.plane === true, `运输机应实心（天空穿透后它是主投放目标）`);
      ok(p.hits.back === true, `工厂返回键应实心`);
    }
  }
} finally {
  await browser.disconnect();
  chromeProc.kill();
}

console.log(`\n${fail === 0 ? "✅" : "❌"} click-through: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
