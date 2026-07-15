// 开发用：离线渲染 AI 融合 chimera 的 6 种 bodyPlan 动物体型（front/side/lie），
// 配合 resvg 转 PNG 做剪影验收。用法：
//   npx tsx scripts/render_chimera.tsx <outDir> [plansCsv|all]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SvgSprite } from "../src/sprites/SvgSprite";
import { registerCustomSpecies } from "../src/sprites/customSpecies";
import type { ChimeraForm, CustomSpeciesEntry, GameConfig, PetState } from "../src/types";

const [, , outDir = "chimera-snapshots", plansArg = "all"] = process.argv;
mkdirSync(outDir, { recursive: true });

const palette = { body: "#E8A24A", deep: "#B9791F", belly: "#FFF3DC", accent: "#5FBF6F", accent2: "#8FD8E8" };

const base: ChimeraForm = {
  bodyPlan: "round",
  segments: 1,
  bodyW: 1,
  bodyH: 1,
  taper: 0.3,
  headStyle: "merged",
  headScale: 0.85,
  legStyle: "stub",
  legCount: 2,
  armStyle: "nub",
  earStyle: "round",
  floating: false,
};

// 每种体型挑一组能凸显剪影的参数（配合真实会用到的耳/手/腿变体）。
const FORMS: Record<string, ChimeraForm> = {
  round: { ...base, bodyPlan: "round", earStyle: "round", armStyle: "nub" },
  upright: { ...base, bodyPlan: "upright", earStyle: "none", armStyle: "flipper", bodyH: 1.1 },
  quadruped: { ...base, bodyPlan: "quadruped", legStyle: "tall", legCount: 4, earStyle: "point" },
  long: { ...base, bodyPlan: "long", segments: 3, legStyle: "stub", earStyle: "round", bodyW: 1.05 },
  floaty: { ...base, bodyPlan: "floaty", legStyle: "none", armStyle: "flipper", earStyle: "fin", floating: true },
  bighead: { ...base, bodyPlan: "bighead", earStyle: "long", armStyle: "nub" },
};

const plans = plansArg === "all" ? Object.keys(FORMS) : plansArg.split(",");

const species: Record<string, CustomSpeciesEntry> = {};
const configSpecies: Record<string, unknown> = {};
for (const name of plans) {
  const form = FORMS[name];
  if (!form) continue;
  const info = {
    nameZh: name,
    tier: 2,
    elements: ["grass", "water"],
    colors: [palette.body, palette.accent],
    body: "chimera",
    desc: name,
    steamItemDef: 0,
  };
  species[`ch_${name}`] = {
    info,
    visual: {
      rig: "chimera",
      scale: 1.12,
      palette: { ...palette },
      eyes: "round",
      toolId: "laptop",
      floating: form.floating,
      slots: { tail: "duckCurl" },
      form,
    },
    parents: ["a", "b"],
    createdAt: 0,
    generator: "test",
  } as unknown as CustomSpeciesEntry;
  configSpecies[`ch_${name}`] = info;
}
registerCustomSpecies(species);
const config = { species: configSpecies, fusionTable: {} } as unknown as GameConfig;

const VIEWS: Array<[string, PetState]> = [
  ["front", "idle"],
  ["side", "moving"],
  ["lie", "sleeping"],
];

const CELL = 200;
const LABEL_H = 22;
const cols = VIEWS.length;
const rows = plans.filter((n) => FORMS[n]).length;
const cells: string[] = [];
let count = 0;
let row = 0;
for (const name of plans) {
  if (!FORMS[name]) continue;
  let col = 0;
  for (const [label, state] of VIEWS) {
    let svg = renderToStaticMarkup(
      h(SvgSprite, { species: `ch_${name}`, config, petState: state, tier: 2 }),
    );
    if (!svg.includes("xmlns=")) svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
    writeFileSync(join(outDir, `${name}__${label}.svg`), svg);
    // 联表单元：嵌套整张精灵 svg（自带 viewBox 0 0 256 256）+ 标签
    const x = col * CELL;
    const y = row * (CELL + LABEL_H);
    const inner = svg.replace(
      "<svg ",
      `<svg x="${x}" y="${y + LABEL_H}" width="${CELL}" height="${CELL}" `,
    );
    cells.push(
      `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL + LABEL_H}" fill="none" stroke="#ddd"/>` +
        `<text x="${x + 8}" y="${y + 15}" font-family="sans-serif" font-size="13" fill="#333">${name} · ${label}</text>` +
        inner,
    );
    count += 1;
    col += 1;
  }
  row += 1;
}
const sheetW = cols * CELL;
const sheetH = rows * (CELL + LABEL_H);
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${sheetH}" viewBox="0 0 ${sheetW} ${sheetH}"><rect width="${sheetW}" height="${sheetH}" fill="#F4EFE6"/>${cells.join("")}</svg>`;
writeFileSync(join(outDir, "_contact.svg"), sheet);
console.log(`rendered ${count} svg files + _contact.svg to ${outDir}`);
