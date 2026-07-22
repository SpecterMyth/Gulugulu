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

// ---- 总量 + 类型分布(2026-07-16 起含 57 并集生成器 + 24 商店生成器) ------
eq(doc.appid, 4956830, "appid");
eq(items.length, 783, "总条目 783");
const byType = {};
for (const it of items) byType[it.type] = (byType[it.type] ?? 0) + 1;
eq(byType, { item: 675, playtimegenerator: 30, generator: 78 }, "类型分布");

// ---- 冻结 75 条编号仍在（101-106/201-221/301-321/401-406/501-521）------
const present = (id) => byId.has(id) || fail(`缺冻结 itemdef ${id}`);
for (let d = 101; d <= 106; d += 1) present(d);
for (let d = 201; d <= 221; d += 1) present(d); // 旧二阶宠
for (let d = 301; d <= 321; d += 1) present(d); // 旧二阶蛋
for (let d = 401; d <= 406; d += 1) present(d); // 一阶掉落生成器
for (let d = 501; d <= 521; d += 1) present(d); // 旧二阶孵化生成器

// ---- 新固定宠 601-657 = 601 + recipeOrdinal；英语=默认名、简中=name_schinese=nameZh，
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
  eq(typeof it.name === "string" && it.name.length > 0, true, `固定宠 ${def} 英文默认名`);
  eq(it.name_schinese, cfg.species[codename].nameZh, `固定宠 ${def} 简中名`);
  eq(it.tradable === true && it.marketable === true, true, `固定宠 ${def} 可交易可上市`);
  eq(cfg.species[codename].steamItemDef, def, `config ${codename} steamItemDef`);
}

// ---- 570 AI 占位：defs 全等于 {aiItemDef(ord,slot)}，英语默认名 + 简中名，
//      display_type(英语默认)= "AI Fusion Variant"，无 AI 蛋/生成器 ----------
const aiItems = items.filter((it) => it.display_type === "AI Fusion Variant");
eq(aiItems.length, 570, "570 AI 占位");
const expectDefs = new Set();
for (let ord = 0; ord < 57; ord += 1) {
  for (let slot = 1; slot <= M.MAX_AI_SLOTS; slot += 1) {
    const def = M.aiItemDef(ord, slot);
    expectDefs.add(def);
    const it = byId.get(def);
    if (!it) { fail(`缺 AI 占位 itemdef ${def}（ord=${ord} slot=${slot}）`); continue; }
    eq(it.type, "item", `AI ${def} type`);
    eq(typeof it.name === "string" && it.name.length > 0, true, `AI ${def} 英文默认名`);
    eq(typeof it.name_schinese === "string" && it.name_schinese.length > 0, true, `AI ${def} 简中名`);
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

// ---- 本地化结构：英语=基础(默认),简中=schinese;旧 name_english/description_english 已退役 ----
for (const it of items) {
  if ("name_english" in it || "description_english" in it) {
    fail(`itemdef ${it.itemdefid} 仍带旧本地化字段（应移除，英语走基础字段）`);
  }
  // 展示物品（宠/蛋，非 hidden 生成器）须有英文默认 + 简中覆盖。
  if (it.type === "item") {
    if (!it.name || !it.name_schinese) fail(`展示物品 ${it.itemdefid} 缺 英文默认名 或 name_schinese`);
    if (!it.display_type || !it.display_type_schinese) fail(`展示物品 ${it.itemdefid} 缺 英文/简中 display_type`);
    if (!it.description || !it.description_schinese) fail(`展示物品 ${it.itemdefid} 缺 英文/简中 description`);
  }
}

// ---- 宠物标签/自升阶（00-decisions「用户拍板(2026-07-15/16)」）------------
// canonical（一阶 6 + 新 57 + AI 570）：set:<自身集合键>;sp:<自身codename> + exchange sp:*2；
// legacy 201-221：set:<集合键>;sp:<该键 canonical codename>，无 exchange。
const setKey = (arr) => Array.from(new Set(arr)).sort().join("+");
for (const [codename, info] of Object.entries(cfg.species)) {
  const it = byId.get(info.steamItemDef);
  if (!it) continue; // 缺失已在冻结段报错
  const key = setKey(info.elements);
  if ((info.tier ?? 0) === 2) {
    const mapped = cfg.speciesByRecipe[key];
    eq(it.tags, `set:${key};sp:${mapped}`, `legacy ${codename}(${info.steamItemDef}) tags`);
    eq("exchange" in it, false, `legacy ${codename} 不应有 exchange`);
  } else {
    eq(it.tags, `set:${key};sp:${codename}`, `canonical ${codename}(${info.steamItemDef}) tags`);
    eq(it.exchange, `sp:${codename}*2`, `canonical ${codename} 自升阶 exchange`);
  }
}
for (let ord = 0; ord < 57; ord += 1) {
  const recipe = ordered[ord];
  for (let slot = 1; slot <= M.MAX_AI_SLOTS; slot += 1) {
    const it = byId.get(M.aiItemDef(ord, slot));
    if (!it) continue;
    const code = M.slotCodename(ord, slot);
    eq(it.tags, `set:${recipe};sp:${code}`, `AI ${M.aiItemDef(ord, slot)} tags`);
    eq(it.exchange, `sp:${code}*2`, `AI ${M.aiItemDef(ord, slot)} 自升阶 exchange`);
    // 带序号占位图:每槽指向自己的 _aislot_<recipe>_<slot>.png(仅 --with-icons 时存在)。
    if (it.icon_url) {
      const suffix = `/_aislot_${recipe.replaceAll("+", "-")}_${slot}.png`;
      eq(it.icon_url.endsWith(suffix), true, `AI ${M.aiItemDef(ord, slot)} icon_url 序号后缀`);
      eq(it.icon_url_large, it.icon_url, `AI ${M.aiItemDef(ord, slot)} icon_url_large 一致`);
    }
  }
}

// ---- 并集融合生成器 20000+ord（57 条）：exchange 全并集对 + bundle 加权 11 槽 ----
const gcd2 = (a, b) => (b === 0 ? a : gcd2(b, a % b));
for (let ord = 0; ord < 57; ord += 1) {
  const recipe = ordered[ord];
  const def = M.unionGenDef(ord);
  const it = byId.get(def);
  if (!it) { fail(`缺并集生成器 ${def}（${recipe}）`); continue; }
  eq(it.type === "generator" && it.hidden === true, true, `并集 gen ${def} 类型/hidden`);
  // exchange：无序对枚举条数 = (3^k − 1)/2，每条并集 == recipe，含对角 set:recipe*2。
  const k = recipe.split("+").length;
  const recipes = it.exchange.split(";");
  eq(recipes.length, (3 ** k - 1) / 2, `并集 gen ${def} 配方条数`);
  eq(recipes.includes(`set:${recipe}*2`), true, `并集 gen ${def} 含对角`);
  for (const r of recipes) {
    const keys = r.endsWith("*2")
      ? [r.slice(4, -2), r.slice(4, -2)]
      : r.split(",").map((m) => m.slice(4));
    eq(setKey(keys.flatMap((x) => x.split("+"))), recipe, `并集 gen ${def} 配方「${r}」并集`);
  }
  // bundle：11 条（0 号固定 + 10 AI 槽），权重 = GCD 归一的 (100−a)*512 / a*2^(9−i) / a。
  const a = Math.round((cfg.aiTotalChanceByElementCount[String(k)] ?? 0) * 100);
  const w = [(100 - a) * 512, ...Array.from({ length: 9 }, (_, i) => a * 2 ** (8 - i)), a];
  const g = w.reduce((x, y) => gcd2(x, y));
  const expectBundle = [
    `${M.fixedItemDef(ord)}x${w[0] / g}`,
    ...Array.from({ length: 10 }, (_, i) => `${M.aiItemDef(ord, i + 1)}x${w[i + 1] / g}`),
  ].join(";");
  eq(it.bundle, expectBundle, `并集 gen ${def} bundle 加权`);
}

// ---- 商店蛋生成器 21000+tier*10+(一阶def−100)（24 条）：24h 窗口 + 稀有度加权 ----
const ELEMENT_ORDER = ["normal", "fire", "electric", "water", "grass", "ice"];
const tier1Def = (e) =>
  Object.values(cfg.species).find((s) => s.tier === 1 && s.elements[0] === e).steamItemDef;
const denom = Math.max(1, cfg.eggRarityFalloffDenom ?? 3);
eq(cfg.eggDailyMintCaps.length, 4, "eggDailyMintCaps 4 阶");
eq(cfg.eggDailyMintCaps.every((c) => c >= 1 && c <= 10), true, "每日上限全 ≤10（Steam drop_max_per_window 硬上限）");
for (let tier = 1; tier <= 4; tier += 1) {
  for (const element of ELEMENT_ORDER) {
    const def = 21000 + tier * 10 + (tier1Def(element) - 100);
    const it = byId.get(def);
    if (!it) { fail(`缺商店生成器 ${def}（t${tier} ${element}）`); continue; }
    eq(it.type === "playtimegenerator" && it.hidden === true, true, `商店 gen ${def} 类型/hidden`);
    // drop_window 非 per-def 字段(2026-07-16 真机实证,应用级=1440);per-def 只有
    // interval(1 分钟≈即领)+ max_per_window(每日上限)。
    eq(
      [it.drop_interval, it.drop_max_per_window, "drop_window" in it],
      [1, cfg.eggDailyMintCaps[tier - 1], false],
      `商店 gen ${def} 窗口参数`,
    );
    const pool = Object.entries(cfg.species)
      .filter(([, s]) => (s.tier ?? 0) !== 2 && s.elements.includes(element) && s.elements.length <= tier)
      .map(([, s]) => s)
      .sort((a, b) => a.steamItemDef - b.steamItemDef);
    const expect =
      pool.length === 1
        ? `${pool[0].steamItemDef}`
        : pool.map((s) => `${s.steamItemDef}x${denom ** (6 - s.elements.length)}`).join(";");
    eq(it.bundle, expect, `商店 gen ${def} bundle 稀有度加权`);
  }
}

if (failures > 0) {
  console.error(`\n✗ itemdefs 校验：${failures} 项失败`);
  process.exit(1);
}
console.log(
  `✓ itemdefs.json：783 条、冻结编号完整、63 固定 + 570 AI 标签/自升阶、57 并集生成器、24 商店窗口生成器 全部逐位一致`,
);
