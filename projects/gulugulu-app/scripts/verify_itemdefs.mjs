// Steam itemdef 目录校验 —— 证明 scripts/steam/out/itemdefs.json 与配置 + 槽位身份
// 函数（src/game/fusionSlots.ts，与 fusion_slots.rs 镜像）逐位一致，且冻结编号完整。
//
// 跑法（在 projects/gulugulu-app 下）：node scripts/verify_itemdefs.mjs
//   （先跑 node ../../scripts/steam/generate_itemdefs.mjs 生成目录）
// 用 esbuild（devDep）把 fusionSlots.ts 转成 JS 后 data-URL 导入，无临时文件。

import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const slotsTs = new URL("../src/game/fusionSlots.ts", import.meta.url);
const { code } = transformSync(readFileSync(slotsTs, "utf8"), { loader: "ts", format: "esm" });
const M = await import("data:text/javascript;base64," + Buffer.from(code, "utf8").toString("base64"));

const cfg = JSON.parse(readFileSync(new URL("../src/game/config.json", import.meta.url), "utf8"));
const doc = JSON.parse(readFileSync(new URL("../../../scripts/steam/out/itemdefs.json", import.meta.url), "utf8"));

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`✗ ${msg}`);
};
const eq = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${msg}\n    expected ${JSON.stringify(b)}\n    got      ${JSON.stringify(a)}`);
};

const items = doc.items;
const byId = new Map();
for (const it of items) {
  if (byId.has(it.itemdefid)) fail(`重复 itemdefid ${it.itemdefid}`);
  byId.set(it.itemdefid, it);
}

// ---- 总量 + 类型分布 ---------------------------------------------------
eq(doc.appid, 4956830, "appid");
eq(items.length, 702, "总条目 702");
const byType = {};
for (const it of items) byType[it.type] = (byType[it.type] ?? 0) + 1;
eq(byType, { item: 675, playtimegenerator: 6, generator: 21 }, "类型分布");

// ---- 冻结 75 条编号仍在（101-106/201-221/301-321/401-406/501-521）------
const present = (id) => byId.has(id) || fail(`缺冻结 itemdef ${id}`);
for (let d = 101; d <= 106; d += 1) present(d);
for (let d = 201; d <= 221; d += 1) present(d); // 旧二阶宠
for (let d = 301; d <= 321; d += 1) present(d); // 旧二阶蛋
for (let d = 401; d <= 406; d += 1) present(d); // 一阶掉落生成器
for (let d = 501; d <= 521; d += 1) present(d); // 旧二阶孵化生成器

// ---- 新固定宠 601-657 = 601 + recipeOrdinal，且 name_english = 固定 codename，
//      与 config.species[codename].steamItemDef 一致 --------------------
const ordered = M.multiElementRecipesOrdered(Object.keys(cfg.speciesByRecipe));
eq(ordered.length, 57, "57 多元素配方");
for (let ord = 0; ord < ordered.length; ord += 1) {
  const recipe = ordered[ord];
  const codename = cfg.speciesByRecipe[recipe];
  const def = M.fixedItemDef(ord);
  const it = byId.get(def);
  if (!it) { fail(`缺固定宠 itemdef ${def}（${codename}/${recipe}）`); continue; }
  eq(it.type, "item", `固定宠 ${def} type`);
  eq(it.name_english, codename, `固定宠 ${def} name_english`);
  eq(it.tradable === true && it.marketable === true, true, `固定宠 ${def} 可交易可上市`);
  eq(cfg.species[codename].steamItemDef, def, `config ${codename} steamItemDef`);
}

// ---- 570 AI 占位：defs 全等于 {aiItemDef(ord,slot)}，name_english = slotCodename，
//      display_type = "AI 融合变种"，无 AI 蛋/生成器 --------------------
const aiItems = items.filter((it) => it.display_type === "AI 融合变种");
eq(aiItems.length, 570, "570 AI 占位");
const expectDefs = new Set();
for (let ord = 0; ord < 57; ord += 1) {
  for (let slot = 1; slot <= M.MAX_AI_SLOTS; slot += 1) {
    const def = M.aiItemDef(ord, slot);
    expectDefs.add(def);
    const it = byId.get(def);
    if (!it) { fail(`缺 AI 占位 itemdef ${def}（ord=${ord} slot=${slot}）`); continue; }
    eq(it.type, "item", `AI ${def} type`);
    eq(it.name_english, M.slotCodename(ord, slot), `AI ${def} name_english`);
    eq(it.tradable === true && it.marketable === true, true, `AI ${def} 可交易可上市`);
  }
}
// AI 集合恰好 = 期望集合（无多无少、无杂号）。
for (const it of aiItems) {
  if (!expectDefs.has(it.itemdefid)) fail(`意外 AI itemdefid ${it.itemdefid}`);
}

// ---- 本期边界：不生成新固定宠/AI 槽的蛋与生成器（号段 658-9999 应为空）----
for (const it of items) {
  if (it.itemdefid >= 658 && it.itemdefid < M.AI_ITEM_DEF_BASE) {
    fail(`意外号段占用 ${it.itemdefid}（本期不产新蛋/生成器）`);
  }
}

if (failures > 0) {
  console.error(`\n✗ itemdefs 校验：${failures} 项失败`);
  process.exit(1);
}
console.log(`✓ itemdefs.json：702 条、冻结编号完整、57 固定宠(601-657) + 570 AI 占位 与身份函数逐位一致`);
