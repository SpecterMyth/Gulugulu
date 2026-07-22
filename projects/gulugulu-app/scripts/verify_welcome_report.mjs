// 离线单测「昨日战报」的纯逻辑（无需整个 app 编译通过——绕开并行重构造成的红）：
// esbuild 打包 src/game/welcomeReport.ts + i18n，Node 里断言吐槽分档 / 特殊组合 /
// 双语文案完整性 / 日期格式化。用户真实数据：7/20=298,352,228（→T3）、7/19=766,698,900（→T4）。
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

const appRoot = join(process.cwd());
const outfile = join(process.env.TEMP || "/tmp", `welcome-report-${process.pid}.mjs`);

const entry = `
export { pickRoast, formatReportDate, roastTier } from "./game/welcomeReport";
export { formatCount } from "./game/format";
export { t, fmt } from "./i18n";
`;

await build({
  stdin: { contents: entry, resolveDir: join(appRoot, "src"), loader: "ts", sourcefile: "entry.ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "silent",
});

const mod = await import(pathToFileURL(outfile).href);
const { pickRoast, formatReportDate, roastTier, formatCount, t, fmt } = mod;

let pass = 0;
let fail = 0;
const eq = (got, want, msg) => {
  if (got === want) {
    pass++;
  } else {
    fail++;
    console.error(`  ✗ ${msg}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`);
  }
};
const ok = (cond, msg) => {
  if (cond) pass++;
  else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
};

const mk = (o = {}) => ({
  date: "2026-07-20",
  dayIndex: 20654,
  isYesterday: true,
  hasDigest: true,
  tokensRaw: 0,
  tokenBreakdown: { input: 0, cacheCreate: 0, cacheRead: 0, output: 0 },
  clicks: 0,
  keys: 0,
  hatches: 0,
  fusions: 0,
  eggsMinted: 0,
  coinsEarned: 0,
  releases: 0,
  nightOwl: false,
  ...o,
});

// ── 1. 分档边界（raw token → T0..T5）──
console.log("[1] roastTier 边界");
eq(roastTier(0), 0, "0 → T0");
eq(roastTier(999_999), 0, "999,999 → T0");
eq(roastTier(1_000_000), 1, "1e6 → T1");
eq(roastTier(19_999_999), 1, "~2e7- → T1");
eq(roastTier(20_000_000), 2, "2e7 → T2");
eq(roastTier(99_999_999), 2, "~1e8- → T2");
eq(roastTier(100_000_000), 3, "1e8 → T3");
eq(roastTier(399_999_999), 3, "~4e8- → T3");
eq(roastTier(400_000_000), 4, "4e8 → T4");
eq(roastTier(999_999_999), 4, "~1e9- → T4");
eq(roastTier(1_000_000_000), 5, "1e9 → T5");
// 真实数据落档
eq(roastTier(298_352_228), 3, "真实 7/20 (2.98亿) → T3 高产");
eq(roastTier(766_698_900), 4, "真实 7/19 (7.67亿) → T4 爆肝");
eq(roastTier(65_716_578), 2, "真实 7/21 (6572万) → T2 常规");

// ── 2. 特殊组合优先级（用 zh 词表逐条钉）──
console.log("[2] pickRoast 特殊组合（优先级从上到下）");
const W = t("zh").sh.welcome;
const CAP = 200;
eq(pickRoast(mk({ tokensRaw: 3e8, nightOwl: true, clicks: 0 }), W, CAP), W.roastNightOwl, "熬夜优先于一切");
eq(pickRoast(mk({ tokensRaw: 3e8, fusions: 3, clicks: 50 }), W, CAP), fmt(W.roastFusionManiac, { fusions: 3 }), "融合≥3 → 缝合怪");
ok(pickRoast(mk({ fusions: 5 }), W, CAP).includes("5"), "融合数插值进文案");
eq(pickRoast(mk({ tokensRaw: 3e8, eggsMinted: 2, hatches: 0, clicks: 50 }), W, CAP), W.roastEggHoarder, "买蛋不孵 → 囤蛋");
eq(pickRoast(mk({ tokensRaw: 298_352_228, clicks: 0 }), W, CAP), W.roastHandsOff, "高token+几乎没戳 → 甩手掌柜");
eq(pickRoast(mk({ tokensRaw: 5_000_000, clicks: CAP }), W, CAP), fmt(W.roastClickStorm, { clicks: CAP }), "戳满上限 → 戳冒烟");
eq(pickRoast(mk({}), W, CAP), W.roastNothing, "全零 → 什么都没干");

// ── 3. 档位回退 + dayIndex 定种子（同天稳定）──
console.log("[3] pickRoast 档位回退与种子");
const s = mk({ tokensRaw: 298_352_228, clicks: 50, dayIndex: 20654 }); // 无特殊组合命中 → T3
const expected = fmt(W.roastT3[20654 % W.roastT3.length], { tokens: formatCount(298_352_228) });
eq(pickRoast(s, W, CAP), expected, "T3 按 dayIndex%len 取第 " + (20654 % W.roastT3.length) + " 句");
eq(pickRoast(s, W, CAP), pickRoast(s, W, CAP), "同一天重复调用稳定");
ok(pickRoast(s, W, CAP).includes(formatCount(298_352_228)), "{tokens} 已插值（含 " + formatCount(298_352_228) + "）");

// ── 4. 双语文案完整性 ──
console.log("[4] 双语文案完整性");
for (const lang of ["zh", "en"]) {
  const w = t(lang).sh.welcome;
  for (const key of ["roastT0", "roastT1", "roastT2", "roastT3", "roastT4", "roastT5"]) {
    ok(Array.isArray(w[key]) && w[key].length >= 1, `${lang}.${key} 是非空数组`);
    ok(w[key].every((x) => typeof x === "string" && x.length > 0), `${lang}.${key} 每条都是非空字符串`);
  }
  for (const key of [
    "roastNightOwl",
    "roastFusionManiac",
    "roastEggHoarder",
    "roastHandsOff",
    "roastClickStorm",
    "roastNothing",
    "reportTitle",
    "reportTitlePrev",
    "rowTokens",
    "rowTokensGen",
    "rowKeys",
    "rowClicks",
    "rowHatches",
    "rowFusions",
    "rowCoins",
  ]) {
    ok(typeof w[key] === "string" && w[key].length > 0, `${lang}.${key} 非空字符串`);
  }
  ok(w.roastFusionManiac.includes("{fusions}"), `${lang}.roastFusionManiac 含 {fusions} 占位`);
  ok(w.roastClickStorm.includes("{clicks}"), `${lang}.roastClickStorm 含 {clicks} 占位`);
  ok(w.reportTitle.includes("{date}"), `${lang}.reportTitle 含 {date} 占位`);
}

// ── 5. 日期格式化 ──
console.log("[5] formatReportDate");
eq(formatReportDate("2026-07-20", "zh"), "7月20日", "zh 短日期");
eq(formatReportDate("2026-07-20", "en"), "Jul 20", "en 短日期");
eq(formatReportDate("2026-01-05", "zh"), "1月5日", "zh 去前导零");
eq(formatReportDate("bad", "zh"), "bad", "非法输入原样返回");

console.log(`\n${fail === 0 ? "✅" : "❌"} welcome-report: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
