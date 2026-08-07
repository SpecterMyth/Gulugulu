// 「开机自启」引导逻辑冒烟测试：bundle src/app/autostartNudge.ts 后在 Node 里驱动
// shouldPromptAutostart（未启用时在里程碑弹、加入即止、设置未加载时不误弹）。
// 跑法（projects/gulugulu-app 下）：node scripts/verify_autostart.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { buildSync } from "esbuild";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));

const { outputFiles } = buildSync({
  stdin: { contents: `export * from "./src/app/autostartNudge";`, resolveDir: appDir, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  loader: { ".ts": "ts" },
  logLevel: "silent",
});
const bundlePath = join(appDir, "node_modules", ".cache", "verify-autostart.bundle.mjs");
mkdirSync(dirname(bundlePath), { recursive: true });
writeFileSync(bundlePath, outputFiles[0].text);

// localStorage 内存垫片（模块只在函数体内惰性访问 window.localStorage）。
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const { shouldPromptAutostart } = await import(
  pathToFileURL(bundlePath).href
);

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`✓ ${msg}`);
  else {
    failures += 1;
    console.error(`✗ ${msg}`);
  }
};

// —— 门槛判定：当前策略只信任系统自启状态；旧展示次数不再改变决定。——
ok(shouldPromptAutostart({ autostart: false, autostartPromptCount: 0 }) === true, "未启用（count=0）→ 弹");
ok(shouldPromptAutostart({ autostart: false, autostartPromptCount: 99 }) === true, "未启用（旧 count 很大）→ 仍弹");
ok(shouldPromptAutostart({ autostart: true, autostartPromptCount: 0 }) === false, "已加入自启 → 永不弹");
ok(shouldPromptAutostart(null) === false, "设置未加载 → 不弹");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
