// Steam 商店截图批量抓取(零依赖,Windows):
//   node scripts/capture_store_shots.mjs [--lang=en,zh] [--only=name1,name2]
// 流程:PORT=4189 起 vite dev(strictPort,避开 1420/3737 的并行会话)→ 轮询就绪 →
// headless Chrome/Edge 按镜头表 × 语言逐张 --screenshot(--virtual-time-budget 定格
// 动画时间线)→ 校验 PNG 恰为 1920×1080 → taskkill 结束 vite。
// 镜头 URL 参数由 src/preview/shotParams.ts 消化(仅预览模式生效)。

import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const repoDir = join(appDir, "..", "..");
const outBase = join(repoDir, "assets", "steam-store", "screenshots");
const profileDir = join(repoDir, ".claude", "scratchpad", "shot-profile");

const PORT = 4189;
const BASE = `http://localhost:${PORT}/`;

const BROWSERS = [
  "C:/Users/admin/AppData/Local/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];
const browser = BROWSERS.find((p) => existsSync(p));
if (!browser) {
  console.error("找不到 Chrome/Edge,无法 headless 截图");
  process.exit(1);
}

/** 镜头表:query 不含 lang/shot(统一追加)。budget=虚拟时间预算 ms。 */
// budget 一律 20000:实测 6000 在 vite 未热透时会稳定失败(虚拟时钟在 ESM 瀑布
// 间隙空转烧穿预算),20000 冷热皆稳;menu 例外(8s 自动收起,须 <8000)。
// hero=<species>:各镜头轮换跟随主角(2026-07-17 用户审阅意见,别每张都是晶麒麟)。
const SHOTS = [
  { name: "backyard_home", query: "ui=backyard&seed=rich&hero=guluduck", budget: 20000 },
  { name: "backyard_shop", query: "ui=backyard&seed=rich&panel=shop&hero=bubblefrog", budget: 20000 },
  { name: "backyard_pits", query: "ui=backyard&seed=rich&panel=pits&hero=voltmouse", budget: 20000 },
  { name: "backyard_dex", query: "ui=backyard&seed=rich&panel=dex&hero=lanternloong", budget: 20000 },
  { name: "backyard_notice", query: "ui=backyard&seed=rich&panel=notice&hero=frostpeng", budget: 20000 },
  { name: "backyard_market", query: "ui=backyard&seed=rich&panel=market&hero=manacorn", budget: 20000 },
  // 6500:>启动+入场过渡(4000 会抓在菜单淡入半程),<8000 自动收起。
  // scale:真实窗口 280×320,1.3~1.6 倍≈真机在桌面上的观感(2026-07-17 用户意见调小)。
  { name: "pet_menu_closeup", query: "ui=menu&seed=rich&scale=1.6&hero=guluduck", budget: 6500 },
  // 单宠状态镜头(无菜单):打工+金币飘字 / 睡觉 / 思考,多角色轮换。
  { name: "pet_working", query: "ui=pet&seed=rich&scale=1.3&hero=guluduck&state=working&fx=pops", budget: 20000 },
  { name: "pet_sleeping", query: "ui=pet&seed=rich&scale=1.3&hero=frostpeng&state=sleeping", budget: 20000 },
  { name: "pet_thinking", query: "ui=pet&seed=rich&scale=1.3&hero=voltmouse&state=thinking", budget: 20000 },
];

const langArg = process.argv.find((a) => a.startsWith("--lang="));
const LANGS = (langArg ? langArg.slice(7) : "en,zh").split(",");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice(7).split(",")) : null;

function pngSize(file) {
  const buf = readFileSync(file);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function waitReady(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch {
      /* 还没起来 */
    }
    if (Date.now() > deadline) throw new Error("vite dev 启动超时");
    await new Promise((r) => setTimeout(r, 500));
  }
}

let captureSeq = 0;
// 每次运行独立命名空间:上一轮超时/崩溃遗留的 chrome 可能仍锁着旧 profile 目录。
const runStamp = process.pid.toString(36) + "-" + String(Date.now() % 1e7);
async function captureOnce(url, outPath, budget) {
  // --headless=old:new headless 的 --window-size 含窗框(实测视口只剩 1904x984),
  // old headless 视口=精确尺寸;Chrome 132 起移除 old,届时改用 new + 补偿尺寸。
  // profile 每张独立:复用同一 user-data-dir 连续拉起会偶发抢锁失败。
  captureSeq += 1;
  await execFileP(browser, [
    "--headless=old",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--window-size=1920,1080",
    `--virtual-time-budget=${budget}`,
    "--no-first-run",
    "--disable-extensions",
    `--user-data-dir=${profileDir}-${runStamp}-${captureSeq}`,
    `--screenshot=${outPath}`,
    url,
  ], { timeout: 180_000 }); // 冷 vite 首镜头要现场转换全部模块,60s 不够

}

async function capture(url, outPath, budget) {
  try {
    await captureOnce(url, outPath, budget);
  } catch {
    await new Promise((r) => setTimeout(r, 1200));
    await captureOnce(url, outPath, budget);
  }
}

const vite = spawn("npm", ["run", "dev"], {
  cwd: appDir,
  env: { ...process.env, PORT: String(PORT) },
  shell: true,
  stdio: "ignore",
});
console.log(`vite dev 启动中(PORT=${PORT},pid=${vite.pid})…`);

let failures = 0;
try {
  await waitReady();
  await new Promise((r) => setTimeout(r, 1000));
  // 预热空拍:vite dev 首批请求要现场转换全部模块,冷态下首镜头(尤其重视图)
  // 会超时/白屏;热身图必须真的"拍出内容"(>100KB)才算烤热,最多试 3 次。
  const warmup = join(repoDir, ".claude", "scratchpad", `shot-warmup-${runStamp}.png`);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await captureOnce(`${BASE}?ui=backyard&seed=rich&panel=dex&lang=en&shot=1`, warmup, 20_000);
      const { size } = statSync(warmup);
      if (size > 100_000) break;
      console.log(`warmup 第 ${attempt} 次产物过小(${size}B),重试…`);
    } catch (error) {
      console.log(`warmup 第 ${attempt} 次失败:${error?.message?.split("\n")[0] ?? error}`);
    }
  }
  for (const lang of LANGS) {
    const outDir = join(outBase, lang);
    mkdirSync(outDir, { recursive: true });
    for (const shot of SHOTS) {
      if (only && !only.has(shot.name)) continue;
      const outPath = join(outDir, `${shot.name}.png`);
      const url = `${BASE}?${shot.query}&lang=${lang}&shot=1`;
      try {
        await capture(url, outPath, shot.budget);
        const { w, h } = pngSize(outPath);
        const ok = w === 1920 && h === 1080;
        if (!ok) failures += 1;
        console.log(`${ok ? "ok " : "BAD"} ${lang}/${shot.name}.png ${w}x${h}`);
      } catch (error) {
        failures += 1;
        console.error(`FAIL ${lang}/${shot.name}: ${error?.message ?? error}`);
      }
    }
  }
} finally {
  if (vite.pid) {
    await execFileP("taskkill", ["/pid", String(vite.pid), "/T", "/F"]).catch(() => {});
  }
}
process.exitCode = failures > 0 ? 1 : 0;
console.log(failures > 0 ? `${failures} 张失败` : "全部镜头完成");
