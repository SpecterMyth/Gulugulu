// 宣传片分帧验收(零依赖,Windows):对 trailer.html 在若干时间戳各截一帧,
// 校验每段都在 1920×1080 正确合成。绕开对本项目会挂的 MCP 预览面板。
//   node scripts/capture_trailer.mjs [--only=name1,name2] [--budget=2600]
// 流程:PORT=4192 起 vite dev → 轮询就绪 → headless Chrome 逐帧
// --screenshot(?t=<ms> 冻结场景合成,--virtual-time-budget 让精灵动画走到该处)。
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const repoDir = join(appDir, "..", "..");
// --lang=zh 抓全中文字幕版(默认 en);产物分目录,两版可对照。
const langArg = process.argv.find((a) => a.startsWith("--lang="));
const LANG = langArg ? langArg.slice(7) : "en";
const langQ = LANG === "zh" ? "&lang=zh" : "";
const outDir = join(repoDir, ".claude", "scratchpad", "trailer", LANG);
const profileDir = join(repoDir, ".claude", "scratchpad", "trailer-profile");

const PORT = 4192;
const BASE = `http://localhost:${PORT}/trailer.html`;

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

// 抽各段最长的一行验证「不换行」+ 尾部定格验证总长(目标 ~60s)。
const SHOTS = [
  { name: "keys_c1", t: 19700 },
  { name: "live_c3", t: 12900 },
  { name: "create_c2", t: 38500 },
  { name: "trade_c2", t: 51600 },
  { name: "end_59", t: 59000 },
  { name: "end_62", t: 62000 },
];

// 说明:实时播放(rAF 时钟)无法在无头 Chrome 里验证——headless 会把 rAF/定时器
// 节流到近乎停止(虚拟时钟同理)。故本工具只出 ?t 冻结静帧验证合成;实时播放到
// 真机可见标签页里天然 60fps 正常跑(即用户 OBS 录屏的环境)。
const budgetArg = process.argv.find((a) => a.startsWith("--budget="));
const BUDGET = budgetArg ? Number(budgetArg.slice(9)) : 2600;
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

let seq = 0;
const runStamp = process.pid.toString(36) + "-" + String(Date.now() % 1e7);
async function captureOnce(url, outPath, budget) {
  seq += 1;
  await execFileP(
    browser,
    [
      "--headless=old",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1920,1080",
      `--virtual-time-budget=${budget}`,
      "--no-first-run",
      "--disable-extensions",
      `--user-data-dir=${profileDir}-${runStamp}-${seq}`,
      `--screenshot=${outPath}`,
      url,
    ],
    { timeout: 180_000 },
  );
}

async function capture(url, outPath, budget) {
  try {
    await captureOnce(url, outPath, budget);
  } catch {
    await new Promise((r) => setTimeout(r, 1200));
    await captureOnce(url, outPath, budget);
  }
}

mkdirSync(outDir, { recursive: true });
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
  // 预热空拍:冷 vite 首镜头要现场转换全部模块,产物 >100KB 才算烤热。
  const warm = join(outDir, `_warmup.png`);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await captureOnce(`${BASE}?t=40000${langQ}`, warm, BUDGET);
      if (statSync(warm).size > 100_000) break;
    } catch (e) {
      console.log(`warmup ${attempt} 失败:${e?.message?.split("\n")[0] ?? e}`);
    }
  }
  for (const shot of SHOTS) {
    if (only && !only.has(shot.name)) continue;
    const outPath = join(outDir, `${shot.name}.png`);
    const url = `${BASE}?t=${shot.t}${langQ}`;
    try {
      await capture(url, outPath, BUDGET);
      const { w, h } = pngSize(outPath);
      const ok = w === 1920 && h === 1080;
      if (!ok) failures += 1;
      console.log(`${ok ? "ok " : "BAD"} ${shot.name}.png ${w}x${h} (t=${shot.t})`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${shot.name}: ${error?.message ?? error}`);
    }
  }
} finally {
  if (vite.pid) {
    await execFileP("taskkill", ["/pid", String(vite.pid), "/T", "/F"]).catch(() => {});
  }
}
console.log(failures > 0 ? `${failures} 张失败` : `全部完成 → ${outDir}`);
process.exitCode = failures > 0 ? 1 : 0;
