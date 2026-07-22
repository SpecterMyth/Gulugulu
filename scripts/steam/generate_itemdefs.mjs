// 从 src/game/config.json 生成 Steam Inventory Service 的 itemdefs JSON。
//
// 构建逻辑全部在 build_itemdefs_core.mjs(纯函数,浏览器可 eval)—— 本文件只负责
// ① 从 config.json 提取 seed;② 调核心;③ 写 out/itemdefs.json + out/seed.json。
// 浏览器上传路径(partner 站页面内 eval 核心 + seed 后 POST)用同一份核心,保证
// repo ↔ live 零漂移。编号规则/标签/生成器语义见核心文件头注释与
// plans/steam_trade/00-decisions.md。
//
// 用法: node scripts/steam/generate_itemdefs.mjs [--appid 4956830] [--with-icons] [--out <path>]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildItemdefs } from "./build_itemdefs_core.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONFIG = join(ROOT, "projects", "gulugulu-app", "src", "game", "config.json");
const ICON_BASE = "https://raw.githubusercontent.com/SpecterMyth/Gulugulu/main/assets/steam-icons";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const APP_ID = Number(opt("--appid", "4956830"));
const WITH_ICONS = flag("--with-icons");
const OUT = opt("--out", join(ROOT, "scripts", "steam", "out", "itemdefs.json"));
const SEED_OUT = join(dirname(OUT), "seed.json");

const cfg = JSON.parse(readFileSync(CONFIG, "utf8"));
const seed = {
  withIcons: WITH_ICONS,
  iconBase: ICON_BASE,
  elementOrder: ["normal", "fire", "electric", "water", "grass", "ice"], // 101-106 冻结序
  elementsZh: Object.fromEntries(Object.entries(cfg.elements).map(([k, v]) => [k, v.nameZh])),
  species: Object.entries(cfg.species).map(([codename, info]) => ({
    codename,
    def: info.steamItemDef,
    tier: info.tier ?? 0,
    elements: info.elements,
    nameZh: info.nameZh,
    desc: info.desc,
  })),
  speciesByRecipe: cfg.speciesByRecipe,
  fusionTable: cfg.fusionTable,
  eggDailyMintCaps: cfg.eggDailyMintCaps,
  aiTotalChanceByElementCount: cfg.aiTotalChanceByElementCount,
  eggRarityFalloffDenom: cfg.eggRarityFalloffDenom,
};

const items = buildItemdefs(seed);
const doc = { appid: APP_ID, items };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
writeFileSync(SEED_OUT, JSON.stringify({ appid: APP_ID, seed }) + "\n");
console.log(`wrote ${OUT}: appid=${APP_ID}, ${items.length} itemdefs (icons: ${WITH_ICONS ? "on" : "off"})`);
console.log(`wrote ${SEED_OUT} (browser-upload seed)`);
const byType = {};
for (const it of items) byType[it.type] = (byType[it.type] ?? 0) + 1;
console.log(JSON.stringify(byType));
