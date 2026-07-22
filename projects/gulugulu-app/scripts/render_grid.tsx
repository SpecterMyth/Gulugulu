// 开发用：把多份设计 JSON 的 idle 单帧铺成一张网格总览。
// 用法：npx tsx scripts/render_grid.tsx <outSvg> <cols> <json1> <json2> ...
import { readFileSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SvgSprite } from "../src/sprites/SvgSprite";
import { registerCustomSpecies } from "../src/sprites/customSpecies";
import type { CustomSpeciesEntry, GameConfig } from "../src/types";

const [, , outSvg, colsArg, ...paths] = process.argv;
const cols = Math.max(1, parseInt(colsArg, 10) || 5);

const species: Record<string, CustomSpeciesEntry> = {};
const configSpecies: Record<string, unknown> = {};
const meta: Array<{ key: string; name: string; arch: string; proto: string }> = [];
paths.forEach((p, i) => {
  let d: any;
  try {
    d = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return;
  }
  const key = `g${i}`;
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
  meta.push({ key, name: info.nameZh, arch: d.archetype ?? "", proto: d.prototype ?? "" });
});
registerCustomSpecies(species);
const config = { species: configSpecies, fusionTable: {} } as unknown as GameConfig;

const CELL = 176;
const LABEL = 30;
const rows = Math.ceil(meta.length / cols);
const cells: string[] = [];
meta.forEach((m, i) => {
  const cx = (i % cols) * CELL;
  const cy = Math.floor(i / cols) * (CELL + LABEL);
  let svg = renderToStaticMarkup(h(SvgSprite, { species: m.key, config, petState: "idle", tier: 2 }));
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  cells.push(
    svg.replace("<svg ", `<svg x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" `) +
      `<text x="${cx + CELL / 2}" y="${cy + CELL + 13}" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="#2a2a2a">${m.name}</text>` +
      `<text x="${cx + CELL / 2}" y="${cy + CELL + 26}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#8a8a8a">${m.arch}${m.proto ? " · " + m.proto : ""}</text>`,
  );
});
const W = cols * CELL;
const H = rows * (CELL + LABEL);
writeFileSync(
  outSvg,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#F1ECE1"/>${cells.join("")}</svg>`,
);
console.log(`grid: ${meta.length} species in ${cols} cols -> ${outSvg}`);
