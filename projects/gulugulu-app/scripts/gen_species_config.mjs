// 从 docs/gdd/SpeciesMatrix.md 生成 Fusion 2.0 的 config 物种数据，加法式写入
// config.json / config.test.json（保留旧 21 物种与旧字段，P4 再清理）。
//
// 跑法（projects/gulugulu-app 下）：node scripts/gen_species_config.mjs
// 解析 §4–§8 的 57 只新物种（codename/nameZh/elements/desc），推导 speciesByRecipe(63)。
// colors 由元素色机械推导（蛋斑点/兜底用；正式视觉走 species2 rig）。

import { readFileSync, writeFileSync } from "node:fs";

const ELEMENT_COLOR = {
  normal: "#6E6E78",
  fire: "#E85D3A",
  electric: "#FFD93B",
  water: "#2E7BD6",
  grass: "#57B84C",
  ice: "#8FD8E8",
};
// 6 单元素配方 → 一阶 codename（speciesByRecipe 的单元素部分）。
const TIER1_BY_ELEMENT = {
  normal: "guluduck",
  fire: "emberfox",
  electric: "voltmouse",
  water: "bubblefrog",
  grass: "sproutcap",
  ice: "frostpeng",
};

const matrixPath = new URL("../../../docs/gdd/SpeciesMatrix.md", import.meta.url);
const md = readFileSync(matrixPath, "utf8");

// 解析新物种：只取 ≥8 列且首列含反引号（配方键）的表格行（§4–§8）；
// 跳过 §3 一阶（5 列）、§2 家族表（首列无反引号）、表头/分隔行。
const newSpecies = [];
for (const line of md.split("\n")) {
  if (!line.startsWith("|")) continue;
  const cells = line.split("|").map((c) => c.trim());
  // cells: ['', recipe, codename, family, desc, tool, particles, sleep, '']
  if (cells.length < 9) continue;
  const recipeCell = cells[1];
  const m = recipeCell.match(/`([^`]+)`/);
  if (!m) continue;
  const codename = cells[2];
  if (!/^[a-z]{3,16}$/.test(codename)) continue;
  const nameZh = cells[3];
  const desc = cells[5];
  const elements = m[1].split("+").map((e) => e.trim()).sort();
  if (elements.some((e) => !(e in ELEMENT_COLOR))) continue;
  if (elements.length < 2) continue; // 一阶不在这些表里，双保险
  newSpecies.push({ codename, nameZh, elements, desc });
}

// 去重（防解析重复），并核对数量。
const seen = new Set();
const species57 = [];
for (const s of newSpecies) {
  if (seen.has(s.codename)) continue;
  seen.add(s.codename);
  species57.push(s);
}

const histogram = {};
for (const s of species57) histogram[s.elements.length] = (histogram[s.elements.length] ?? 0) + 1;
console.log("解析新物种数:", species57.length, "元素数直方图:", histogram);
if (species57.length !== 57) throw new Error(`期望 57 只新物种，实得 ${species57.length}`);
const expectHist = { 2: 15, 3: 20, 4: 15, 5: 6, 6: 1 };
for (const [k, v] of Object.entries(expectHist)) {
  if (histogram[k] !== v) throw new Error(`元素数 ${k} 期望 ${v}，实得 ${histogram[k]}`);
}

// speciesByRecipe：6 单元素 + 57 多元素。
const speciesByRecipe = {};
for (const [el, code] of Object.entries(TIER1_BY_ELEMENT)) speciesByRecipe[el] = code;
for (const s of species57) {
  const key = s.elements.join("+");
  if (speciesByRecipe[key]) throw new Error(`配方键冲突 ${key}: ${speciesByRecipe[key]} vs ${s.codename}`);
  speciesByRecipe[key] = s.codename;
}
if (Object.keys(speciesByRecipe).length !== 63) {
  throw new Error(`speciesByRecipe 期望 63 键，实得 ${Object.keys(speciesByRecipe).length}`);
}

// 新物种 config 条目（无 tier 字段；steamItemDef 0；colors 由元素色推导）。
function speciesEntry(s) {
  return {
    steamItemDef: 0,
    nameZh: s.nameZh,
    elements: s.elements,
    colors: s.elements.map((e) => ELEMENT_COLOR[e]),
    body: s.codename,
    desc: s.desc,
  };
}

// 两份 config 的 Fusion 2.0 新增经济数值（正式 / 测试）。
const ECON = {
  normal: {
    fusionFees: [100, 200, 300, 400, 500, 600],
    fusionEggPriceBonus: 100,
    maxLevel: [10, 20, 30, 40, 50, 60],
    levelExpFactor: [10, 50, 250, 1250, 6250, 31250],
    hatchExtra: { tier3: 3600, tier4: 7200, tier5: 14400, tier6: 28800 },
  },
  test: {
    fusionFees: [10, 20, 30, 40, 50, 60],
    fusionEggPriceBonus: 10,
    maxLevel: [4, 6, 8, 10, 12, 14],
    levelExpFactor: [2, 3, 4, 5, 6, 7],
    hatchExtra: { tier3: 25, tier4: 30, tier5: 35, tier6: 40 },
  },
};
const AI_TOTAL_CHANCE_BY_ELEMENT_COUNT = { 2: 0.6, 3: 0.4, 4: 0.2, 5: 0.1, 6: 0.05 };

function transform(path, econ) {
  const cfg = JSON.parse(readFileSync(path, "utf8"));
  // 加法式加新物种（保留既有 6+21）。
  for (const s of species57) {
    if (cfg.species[s.codename]) throw new Error(`${path}: 物种撞名 ${s.codename}`);
    cfg.species[s.codename] = speciesEntry(s);
  }
  cfg.speciesByRecipe = speciesByRecipe;
  cfg.fusionFees = econ.fusionFees;
  cfg.fusionEggPriceBonus = econ.fusionEggPriceBonus;
  cfg.aiTotalChanceByElementCount = AI_TOTAL_CHANCE_BY_ELEMENT_COUNT;
  cfg.maxLevel = econ.maxLevel;
  cfg.levelExpFactor = econ.levelExpFactor;
  cfg.hatchSeconds = { ...cfg.hatchSeconds, ...econ.hatchExtra };
  // 旧字段（fusionTable/fusionFee/aiFusionChance/tier2EggPriceBonus）加法式保留。
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  console.log(`✓ ${path}: species=${Object.keys(cfg.species).length} speciesByRecipe=${Object.keys(cfg.speciesByRecipe).length}`);
}

const base = new URL("../src/game/", import.meta.url);
transform(new URL("config.json", base), ECON.normal);
transform(new URL("config.test.json", base), ECON.test);
console.log("done.");
