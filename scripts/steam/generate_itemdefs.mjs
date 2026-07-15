// 从 src/game/config.json 生成 Steam Inventory Service 的 itemdefs JSON。
//
// 编号规则(plans/steam_trade/00-decisions.md + FusionSystem.md §9,一经上传不可回改):
//   一阶宠物 101..106(固定元素序) · 旧二阶宠物 201..221(fusionTable 键字典序)
//   旧二阶蛋 = 宠物+100(绑定) · 旧二阶孵化生成器 = 蛋+200(generator,exchange 蛋)
//   一阶掉落生成器 = 宠物+300(playtimegenerator,单条目)
//   ── 融合 2.0 新增(加法,永不重编旧号) ──
//   新多元素固定宠物 601..657(601 + recipeOrdinal;2元素 601-615/…/6元素 657)
//   AI 融合变种占位 10000 + recipeOrdinal*100 + slot(57 配方 × 10 槽 = 570 个)
//     形象/名字后续由首个生成该槽位的玩家经 Steam 创意工坊上传认领(最早发布者胜)。
//
// **本期不生成新固定宠/AI 槽的蛋与生成器**(铸造龙头链):3+ 元素配方是"任意两只并集=
// 该集合"的多对多,Steam 固定 exchange 串表达不了(§9 P5 待决),且集成默认关。占位宠物条目
// 无 Steam 龙头,关状态下本地铸造;开机制留给独立的"并集 exchange 重设计"。
//
// 随机就绪:生成器 bundle 今为单条目(必出);将来加权即随机,零客户端改动。
// 掉落节流:不写 per-def drop 字段,由合作伙伴网站的应用级设置统一控制
// (当前测试值 5/10/5;发布前收紧为 45/2/120,见 05-release.md R8)。
//
// 槽位身份(recipeOrdinal/aiItemDef/slotCodename)在此内联,与 src/game/fusionSlots.ts ↔
// src-tauri/src/fusion_slots.rs 逐字镜像(本脚本是零依赖构建工具,不引 esbuild/TS)。
// 漂移由 projects/gulugulu-app/scripts/verify_itemdefs.mjs 守卫(它导入 fusionSlots.ts
// 并断言本脚本产出的 itemdefs.json 与之逐位一致)。
//
// 用法: node scripts/steam/generate_itemdefs.mjs [--appid 4956830] [--with-icons] [--out <path>]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONFIG = join(ROOT, "projects", "gulugulu-app", "src", "game", "config.json");
const ICON_BASE = "https://raw.githubusercontent.com/SpecterMyth/Gulugulu/main/assets/steam-icons";

// 槽位身份 —— 与 fusionSlots.ts / fusion_slots.rs 镜像（drift 由 verify_itemdefs.mjs 守卫）。
const AI_ITEM_DEF_BASE = 10000;
const MAX_AI_SLOTS = 10;
const recipeElementCount = (r) => r.split("+").length;
const multiElementRecipesOrdered = (keys) =>
  keys
    .filter((k) => recipeElementCount(k) >= 2)
    .sort((a, b) => {
      const ca = recipeElementCount(a);
      const cb = recipeElementCount(b);
      return ca !== cb ? ca - cb : a < b ? -1 : a > b ? 1 : 0;
    });
const aiItemDef = (ord, slot) => AI_ITEM_DEF_BASE + ord * 100 + slot;
const slotCodename = (ord, slot) => `aif${String(ord).padStart(2, "0")}${String(slot).padStart(2, "0")}`;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const APP_ID = Number(opt("--appid", "4956830"));
const WITH_ICONS = flag("--with-icons");
const OUT = opt("--out", join(ROOT, "scripts", "steam", "out", "itemdefs.json"));

const cfg = JSON.parse(readFileSync(CONFIG, "utf8"));
const speciesByDef = new Map();
for (const [codename, info] of Object.entries(cfg.species)) {
  if (!info.steamItemDef) throw new Error(`species ${codename} missing steamItemDef`);
  if (speciesByDef.has(info.steamItemDef)) throw new Error(`duplicate def ${info.steamItemDef}`);
  speciesByDef.set(info.steamItemDef, { codename, ...info });
}
const tier1DefForElement = (element) => {
  const hit = [...speciesByDef.values()].find((s) => s.tier === 1 && s.elements[0] === element);
  if (!hit) throw new Error(`no tier-1 species for element ${element}`);
  return hit.steamItemDef;
};

const items = [];
const push = (item) => items.push(item);
const icon = (codename) => (WITH_ICONS ? { icon_url: `${ICON_BASE}/${codename}.png`, icon_url_large: `${ICON_BASE}/${codename}.png` } : {});

// 显示类型/英文描述：一阶/旧二阶保持原文（冻结），新 63 谱系按元素数（阶数在实例上）。
const displayType = (s) => (s.tier === 1 ? "一阶精灵" : s.tier === 2 ? "二阶精灵" : `${s.elements.length}元素精灵`);
const descEnglish = (s) =>
  s.tier ? `Gulugulu tier-${s.tier} pet: ${s.codename}` : `Gulugulu fixed species (${s.elements.length}-element): ${s.codename}`;

// --- 宠物(一阶 101-106 + 旧二阶 201-221 + 新多元素 601-657):可交易 + 可上市场 ---
for (const s of [...speciesByDef.values()].sort((a, b) => a.steamItemDef - b.steamItemDef)) {
  push({
    itemdefid: s.steamItemDef,
    type: "item",
    display_type: displayType(s),
    name: s.nameZh,
    name_english: s.codename,
    description: s.desc,
    description_english: descEnglish(s),
    ...icon(s.codename),
    tradable: true,
    marketable: true,
  });
}

// --- 旧二阶蛋(绑定)+ 孵化生成器(仅 21 legacy 配方,冻结) --------------------
const fusionKeys = Object.keys(cfg.fusionTable).sort();
for (const key of fusionKeys) {
  const codename = cfg.fusionTable[key];
  const s = cfg.species[codename];
  const petDef = s.steamItemDef;
  const eggDef = petDef + 100;
  const genDef = eggDef + 200;
  const [ea, eb] = key.split("+");
  const [da, db] = [tier1DefForElement(ea), tier1DefForElement(eb)].sort((x, y) => x - y);
  const exchange = da === db ? `${da}x2` : `${da},${db}`;
  push({
    itemdefid: eggDef,
    type: "item",
    display_type: "融合蛋",
    name: `${s.nameZh}蛋`,
    name_english: `${codename} egg`,
    description: `由 ${key} 融合而来的蛋(绑定,不可交易)。`,
    description_english: `Fusion egg (${key}). Account-bound.`,
    ...icon(codename),
    tradable: false,
    marketable: false,
    exchange,
  });
  push({
    itemdefid: genDef,
    type: "generator",
    name: `${codename} hatch generator`,
    // 随机就绪:今为单条目必出;将来在此加权(如 "209x90;210x10")即随机开池。
    bundle: `${petDef}`,
    exchange: `${eggDef}`,
    hidden: true,
  });
}

// --- 一阶掉落生成器(playtimegenerator) -----------------------------------
const ELEMENT_ORDER = ["normal", "fire", "electric", "water", "grass", "ice"];
for (const element of ELEMENT_ORDER) {
  const petDef = tier1DefForElement(element);
  const s = speciesByDef.get(petDef);
  push({
    itemdefid: petDef + 300,
    type: "playtimegenerator",
    name: `${s.codename} drop generator`,
    bundle: `${petDef}`,
    hidden: true,
  });
}

// --- AI 融合变种占位(570 = 57 多元素配方 × 10 槽):可交易 + 可上市场 --------
// 占位图标按元素数分 5 张(_aislot_e2..e6);真形象/名字经创意工坊由首传者认领。
const aiIcon = (ec) =>
  WITH_ICONS ? { icon_url: `${ICON_BASE}/_aislot_e${ec}.png`, icon_url_large: `${ICON_BASE}/_aislot_e${ec}.png` } : {};
const orderedRecipes = multiElementRecipesOrdered(Object.keys(cfg.speciesByRecipe));
for (let ord = 0; ord < orderedRecipes.length; ord += 1) {
  const recipe = orderedRecipes[ord];
  const fixedNameZh = cfg.species[cfg.speciesByRecipe[recipe]].nameZh;
  const ec = recipeElementCount(recipe);
  for (let slot = 1; slot <= MAX_AI_SLOTS; slot += 1) {
    push({
      itemdefid: aiItemDef(ord, slot),
      type: "item",
      display_type: "AI 融合变种",
      name: `${fixedNameZh}·AI变种${slot}`,
      name_english: slotCodename(ord, slot),
      description: `${recipe} 配方的第 ${slot} 号 AI 变种槽(形象/名字由首个生成者经创意工坊上传认领)。`,
      description_english: `AI fusion variant slot ${slot} of recipe ${recipe}; appearance claimed via Steam Workshop (earliest publisher wins).`,
      ...aiIcon(ec),
      tradable: true,
      marketable: true,
    });
  }
}

items.sort((a, b) => a.itemdefid - b.itemdefid);
const doc = { appid: APP_ID, items };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
console.log(`wrote ${OUT}: appid=${APP_ID}, ${items.length} itemdefs (icons: ${WITH_ICONS ? "on" : "off"})`);
const byType = {};
for (const it of items) byType[it.type] = (byType[it.type] ?? 0) + 1;
console.log(JSON.stringify(byType));
