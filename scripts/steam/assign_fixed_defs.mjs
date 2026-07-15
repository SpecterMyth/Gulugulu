// 一次性维护脚本：为 57 个多元素固定物种在 config.json + config.test.json 写入
// steamItemDef = 601 + recipeOrdinal（FusionSystem.md §9 加法编号，一经使用即冻结）。
//
// 外科式正则替换：只把物种定义块里的 "steamItemDef": 0 改成目标号，**保留 LF/缩进**，
// 不做 JSON round-trip（避免重排 84 物种大表 + 破坏 config.json↔config.test.json 逐字节同步）。
// 幂等：已是目标值则跳过；遇到非 0 非目标值则报错拒绝覆盖（防误改冻结的 101-521）。
//
// 用法（仓库根）：node scripts/steam/assign_fixed_defs.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GAME = join(ROOT, "projects", "gulugulu-app", "src", "game");
const CONFIGS = [join(GAME, "config.json"), join(GAME, "config.test.json")];

const recipeElementCount = (r) => r.split("+").length;

// 多元素配方按 (元素数升序, 键字典序) 排序 —— 与 fusion_slots.rs / fusionSlots.ts 同规。
const base = JSON.parse(readFileSync(CONFIGS[0], "utf8"));
const ordered = Object.keys(base.speciesByRecipe)
  .filter((k) => recipeElementCount(k) >= 2)
  .sort((a, b) => {
    const ca = recipeElementCount(a);
    const cb = recipeElementCount(b);
    return ca !== cb ? ca - cb : a < b ? -1 : a > b ? 1 : 0;
  });
if (ordered.length !== 57) {
  throw new Error(`expected 57 multi-element recipes, got ${ordered.length}`);
}

// codename → 目标 def（601 + 序号）。
const target = new Map();
ordered.forEach((recipe, ord) => target.set(base.speciesByRecipe[recipe], 601 + ord));

for (const path of CONFIGS) {
  let text = readFileSync(path, "utf8");
  let changed = 0;
  for (const [codename, def] of target) {
    // "codename": { <空白/换行> "steamItemDef": <n>   —— n 为 0（待写）或已是目标值。
    // [^}]*? 非贪婪且不跨 }，steamItemDef 是物种块首字段，故只命中本物种定义。
    const re = new RegExp(`("${codename}"\\s*:\\s*\\{[^}]*?"steamItemDef"\\s*:\\s*)(\\d+)`);
    const m = text.match(re);
    if (!m) throw new Error(`${path}: 找不到物种 ${codename} 的 steamItemDef`);
    const current = Number(m[2]);
    if (current === def) continue; // 幂等
    if (current !== 0) {
      throw new Error(`${path}: ${codename} steamItemDef=${current} 非 0/目标，拒绝覆盖`);
    }
    text = text.replace(re, `$1${def}`);
    changed += 1;
  }
  writeFileSync(path, text);
  console.log(`${path}: 写入 ${changed} 个 steamItemDef（目标 57）`);
}
