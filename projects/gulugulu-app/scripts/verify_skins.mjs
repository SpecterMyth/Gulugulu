// 皮肤系统前端解析链冒烟测试（SkinWorkshop.md）：bundle sprites/ 管线后在 Node 里
// 直接驱动 registerCustomSpecies + registerSkinState + getSpeciesVisual + SvgSprite，
// 核对四源皮肤（default/local/ws:*）的解析与 visual 覆盖 prop。
// 跑法（projects/gulugulu-app 下）：node scripts/verify_skins.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { buildSync } from "esbuild";

const appDir = dirname(dirname(fileURLToPath(import.meta.url)));

const entrySource = `
export { registerCustomSpecies, registerSkinState, getSkinOverride, buildVisualFromSpec } from "./src/sprites/customSpecies";
export { getSpeciesVisual } from "./src/sprites/speciesTable";
export { SvgSprite } from "./src/sprites/SvgSprite";
export { createElement } from "react";
export { renderToStaticMarkup } from "react-dom/server";
`;

const { outputFiles } = buildSync({
  stdin: { contents: entrySource, resolveDir: appDir, loader: "ts" },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  loader: { ".json": "json", ".tsx": "tsx", ".ts": "ts" },
  jsx: "automatic",
  logLevel: "silent",
  // react-dom/server.node 内部有运行时 require("stream") —— ESM 输出需垫 createRequire。
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
// bundle 落临时文件再 import（大 bundle 走 data: URL 会把报错栈撑爆到不可读）。
const bundlePath = join(appDir, "node_modules", ".cache", "verify-skins.bundle.mjs");
mkdirSync(dirname(bundlePath), { recursive: true });
writeFileSync(bundlePath, outputFiles[0].text);
const M = await import(pathToFileURL(bundlePath).href);

const config = JSON.parse(readFileSync(new URL("../src/game/config.json", import.meta.url), "utf8"));

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) {
    failures += 1;
    console.error(`✗ ${msg}`);
  }
};

// —— 造一个最简 AI 物种（chimera 参数化）+ 两张工坊皮肤 ——
const chimeraSpec = (body, accent) => ({
  rig: "chimera",
  scale: 1.12,
  palette: { body, deep: "#553322", belly: "#FFF4DC", accent, accent2: accent },
  eyes: "round",
  floating: false,
  slots: {},
  form: {
    bodyPlan: "round",
    segments: 1,
    bodyW: 1,
    bodyH: 1,
    taper: 0.25,
    headStyle: "merged",
    headScale: 0.85,
    legStyle: "stub",
    legCount: 2,
    armStyle: "nub",
    earStyle: "round",
    floating: false,
  },
});

const AI = "aif0001"; // electric+fire 配方 1 号槽（字典序第一个二元素配方）
const LOCAL_BODY = "#E86A4A";
const WS_BODY = "#5A6BD8";
const entry = {
  info: { nameZh: "测试变种", elements: ["electric", "fire"], colors: [LOCAL_BODY, "#FFD24A"], body: "chimera", desc: "d" },
  visual: chimeraSpec(LOCAL_BODY, "#FFD24A"),
  parents: ["voltmouse", "emberfox"],
  createdAt: 1000,
  generator: "claude",
  origin: "local",
};
const wsSkin = {
  id: "ws:900011",
  visual: chimeraSpec(WS_BODY, "#F5E08A"),
  nameZh: "测试变种·星夜",
  authorSteamId: "76561198000000111",
  authorPersona: "咕噜大师",
  publishedFileId: "900011",
  timeCreated: 500,
  importedAt: 2000,
  source: "first",
};

const fixedCode = config.speciesByRecipe["electric+fire"];
ok(typeof fixedCode === "string" && fixedCode.length > 0, "electric+fire 有固定物种");

M.registerCustomSpecies({ [AI]: entry });
const infoOf = (code) => config.species[code] ?? entry.info;

// 1) 无选择（缺省 local）：解析出本机形象。
M.registerSkinState({ customSpecies: { [AI]: entry }, speciesSkins: {}, skinSelected: {} }, config);
let visual = M.getSpeciesVisual(AI, infoOf(AI));
ok(visual.palette.body === LOCAL_BODY, `缺省=local 本机形象（实得 ${visual.palette.body}）`);

// 2) default：重定向到配方固定物种的形态（species2 包，rig=固定物种 codename）。
M.registerSkinState(
  { customSpecies: { [AI]: entry }, speciesSkins: {}, skinSelected: { [AI]: "default" } },
  config,
);
visual = M.getSpeciesVisual(AI, infoOf(AI));
ok(visual.rig === fixedCode, `default=固定物种形态 rig=${fixedCode}（实得 ${visual.rig}）`);
const fixedVisual = M.getSpeciesVisual(fixedCode, config.species[fixedCode]);
ok(visual === fixedVisual, "default 与固定物种本体解析同一 visual 对象");

// 3) ws:* 工坊皮肤：解析出皮肤配色。
M.registerSkinState(
  { customSpecies: { [AI]: entry }, speciesSkins: { [AI]: [wsSkin] }, skinSelected: { [AI]: "ws:900011" } },
  config,
);
visual = M.getSpeciesVisual(AI, infoOf(AI));
ok(visual.palette.body === WS_BODY, `ws: 皮肤生效（实得 ${visual.palette.body}）`);

// 4) 悬空 ws:（皮肤已被移除）：回落本机形象。
M.registerSkinState(
  { customSpecies: { [AI]: entry }, speciesSkins: {}, skinSelected: { [AI]: "ws:900011" } },
  config,
);
visual = M.getSpeciesVisual(AI, infoOf(AI));
ok(visual.palette.body === LOCAL_BODY, `悬空 ws: 回落 local（实得 ${visual.palette.body}）`);

// 5) 固定物种永不被覆盖（覆盖表只会命中 AI 物种）。
ok(M.getSkinOverride(fixedCode) == null, "固定物种无皮肤覆盖");

// 6) SvgSprite 的 visual 显式覆盖 prop：绕过全局选择（皮肤卡并排预览/工坊设定图护栏）。
M.registerSkinState(
  { customSpecies: { [AI]: entry }, speciesSkins: { [AI]: [wsSkin] }, skinSelected: { [AI]: "ws:900011" } },
  config,
);
const cfgWithAi = { ...config, species: { ...config.species, [AI]: entry.info } };
const globalMarkup = M.renderToStaticMarkup(
  M.createElement(M.SvgSprite, { species: AI, config: cfgWithAi, petState: "idle" }),
);
const overrideMarkup = M.renderToStaticMarkup(
  M.createElement(M.SvgSprite, {
    species: AI,
    config: cfgWithAi,
    petState: "idle",
    visual: M.buildVisualFromSpec(entry.visual),
  }),
);
ok(globalMarkup.includes(WS_BODY), "全局渲染吃到选中皮肤配色");
ok(overrideMarkup.includes(LOCAL_BODY) && !overrideMarkup.includes(WS_BODY), "visual prop 覆盖回本机配色（工坊设定图护栏）");

if (failures > 0) {
  console.error(`\n✗ skin pipeline: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("✓ skin pipeline: all assertions pass (default/local/ws resolution, dangling fallback, visual override)");
