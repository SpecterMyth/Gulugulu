// 「开机自启」引导逻辑冒烟测试：bundle src/app/autostartNudge.ts 后在 Node 里驱动
// shouldPromptAutostart（首融/二融/三融弹、加入即止、上限后永不弹）与 rememberFusionEgg/
// takeFusionEgg（融合蛋登记→收取核销，区分商店蛋、单次触发、跨蛋独立、去重）。
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

const { shouldPromptAutostart, rememberFusionEgg, takeFusionEgg, AUTOSTART_PROMPT_MAX } = await import(
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

// —— 门槛判定：需求「首融/二融/三融各弹一次、加入即止、无论如何三次后永不弹」——
ok(AUTOSTART_PROMPT_MAX === 3, `上限为 3（当前 ${AUTOSTART_PROMPT_MAX}）`);
ok(shouldPromptAutostart({ autostart: false, autostartPromptCount: 0 }) === true, "首融（count=0）→ 弹");
ok(shouldPromptAutostart({ autostart: false, autostartPromptCount: 1 }) === true, "二融（count=1）→ 弹");
ok(shouldPromptAutostart({ autostart: false, autostartPromptCount: 2 }) === true, "三融（count=2）→ 弹");
ok(shouldPromptAutostart({ autostart: false, autostartPromptCount: 3 }) === false, "已弹满 3 次 → 不再弹");
ok(shouldPromptAutostart({ autostart: true, autostartPromptCount: 0 }) === false, "已加入自启 → 永不弹（次数为 0 也不弹）");
ok(shouldPromptAutostart({ autostart: true, autostartPromptCount: 2 }) === false, "已加入自启 → 永不弹（次数未满也不弹）");
ok(shouldPromptAutostart(null) === false, "设置未加载 → 不弹");

// —— 融合蛋核销：仅对登记过的蛋判为融合来源；单次触发；跨蛋独立；重复登记不重复核销 ——
ok(takeFusionEgg("egg_shop_1") === false, "未登记的蛋（商店蛋）→ 不判为融合");
rememberFusionEgg("egg_fuse_A");
rememberFusionEgg("egg_fuse_B");
ok(takeFusionEgg("egg_shop_1") === false, "登记融合蛋后，商店蛋仍不判为融合");
ok(takeFusionEgg("egg_fuse_A") === true, "登记过的融合蛋 A → 判为融合");
ok(takeFusionEgg("egg_fuse_A") === false, "同一蛋再次收取 → 不重复触发（已核销）");
ok(takeFusionEgg("egg_fuse_B") === true, "另一颗融合蛋 B → 判为融合（跨蛋独立）");
rememberFusionEgg("egg_dup");
rememberFusionEgg("egg_dup");
ok(takeFusionEgg("egg_dup") === true && takeFusionEgg("egg_dup") === false, "重复登记同一蛋不产生重复核销");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
