// V2 固定种子批量验收：传入 24 份生成记录/设计 JSON，检查分布上限与同配方原型重复。
// 用法：node scripts/audit_pet_gen_v2.mjs out/seed-*.json
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const paths = args.length === 1 && statSync(args[0]).isDirectory()
  ? readdirSync(args[0])
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => join(args[0], name))
  : args;
if (paths.length !== 24) {
  throw new Error(`V2 批量验收必须恰好输入 24 份 JSON，当前 ${paths.length} 份`);
}

const rows = paths.map((file) => {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const entry = raw.entry ?? raw;
  const visual = entry.visual ?? raw.visual ?? raw;
  const meta = entry.designMeta ?? raw.designMeta ?? raw.meta ?? {};
  const elements = entry.info?.elements ?? raw.elements ?? [];
  const recipe = raw.recipeKey ?? meta.recipeKey ?? [...elements].sort().join("+");
  return {
    file,
    recipe,
    prototype: meta.prototype ?? raw.prototype ?? "",
    archetype: meta.archetype ?? raw.archetype ?? "",
    face: `${visual.eyes ?? raw.eyes ?? "round"}+${visual.mouthStyle ?? raw.mouthStyle ?? "beak"}`,
    motion: visual.motionPreset ?? raw.motionPreset ?? "",
  };
});

for (const row of rows) {
  for (const key of ["recipe", "prototype", "archetype", "face", "motion"]) {
    if (!row[key]) throw new Error(`${row.file} 缺少验收字段 ${key}`);
  }
}

function assertMax(label, get, ratio) {
  const counts = new Map();
  for (const row of rows) counts.set(get(row), (counts.get(get(row)) ?? 0) + 1);
  const failed = [...counts].filter(([, count]) => count / rows.length > ratio);
  if (failed.length) {
    throw new Error(`${label} 超过 ${ratio * 100}%：${failed.map(([key, count]) => `${key}=${count}`).join("，")}`);
  }
  console.log(`${label}: ${[...counts].map(([key, count]) => `${key}=${count}`).join("，")}`);
}

assertMax("体型", (row) => row.archetype, 0.25);
assertMax("脸型组合", (row) => row.face, 0.2);
assertMax("动作预设", (row) => row.motion, 0.25);

const recipePrototype = new Set();
for (const row of rows) {
  const key = `${row.recipe}::${row.prototype}`;
  if (recipePrototype.has(key)) {
    throw new Error(`同配方重复真实原型：${row.recipe} / ${row.prototype}`);
  }
  recipePrototype.add(key);
}

console.log("pet-gen-v2 batch audit passed: 24/24");
