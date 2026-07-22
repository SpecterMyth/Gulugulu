// 开发用：把多份设计 JSON 拼成一张对比图（每行一只，每列一个状态）。
// 用法：npx tsx scripts/render_gallery.tsx <outSvg> <statesCsv> <json1> <json2> ...
// （json 路径作为独立参数，避免 MSYS 对逗号连接的 /c/ 路径转换出错）
import { readFileSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SvgSprite } from "../src/sprites/SvgSprite";
import { registerCustomSpecies } from "../src/sprites/customSpecies";
import type { CustomSpeciesEntry, GameConfig, PetState } from "../src/types";

const [, , outSvg, statesArg, ...paths] = process.argv;
const states = statesArg.split(",") as PetState[];

const species: Record<string, CustomSpeciesEntry> = {};
const configSpecies: Record<string, unknown> = {};
const keys: string[] = [];
paths.forEach((p, i) => {
  const d = JSON.parse(readFileSync(p, "utf8"));
  const key = `sp${i}`;
  keys.push(key);
  const info = {
    nameZh: d.nameZh ?? key,
    tier: 2,
    elements: d.elements ?? ["fire", "ice"],
    colors: [d.palette.body, d.palette.accent],
    body: "custom",
    desc: d.desc ?? "",
    steamItemDef: 0,
  };
  configSpecies[key] = info;
  species[key] = {
    info,
    visual: {
      rig: d.customRig ? "custom" : d.rig ?? "chimera",
      scale: d.scale ?? 1.12,
      palette: { ...d.palette, accent2: d.palette.accent2 ?? null },
      eyes: d.eyes ?? null,
      toolId: d.toolId ?? null,
      floating: d.customRig?.floating ?? false,
      slots: d.slots ?? {},
      form: d.form ?? null,
      customRig: d.customRig ?? null,
      workFx: d.workFx ?? null,
    },
  } as unknown as CustomSpeciesEntry;
});
registerCustomSpecies(species);
const config = { species: configSpecies, fusionTable: {} } as unknown as GameConfig;

const CELL = 190;
const LABELW = 96; // 左侧名字列
const HEAD = 24; // 顶部状态标题
const cols = states.length;
const rows = keys.length;
const cells: string[] = [];
// 顶部状态标题
states.forEach((st, c) => {
  cells.push(`<text x="${LABELW + c * CELL + CELL / 2}" y="16" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#555">${st}</text>`);
});
keys.forEach((key, r) => {
  const name = (configSpecies[key] as { nameZh: string }).nameZh;
  const y0 = HEAD + r * CELL;
  cells.push(`<text x="12" y="${y0 + CELL / 2}" font-family="sans-serif" font-size="15" font-weight="700" fill="#333">${name}</text>`);
  states.forEach((st, c) => {
    let svg = renderToStaticMarkup(h(SvgSprite, { species: key, config, petState: st, tier: 2 }));
    if (!svg.includes("xmlns=")) svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
    const x = LABELW + c * CELL;
    cells.push(svg.replace("<svg ", `<svg x="${x}" y="${y0}" width="${CELL}" height="${CELL}" `));
  });
});
const W = LABELW + cols * CELL;
const H = HEAD + rows * CELL;
writeFileSync(outSvg, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#F4EFE6"/>${cells.join("")}</svg>`);
console.log(`gallery: ${rows} species x ${cols} states -> ${outSvg}`);
