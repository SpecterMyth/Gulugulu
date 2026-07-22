// 开发用：把一份「AI 生成的设计 JSON」（含 customRig 或 form）渲染成八态 contact sheet，
// 验证真机生成结果的观感。用法：npx tsx scripts/render_spec.tsx <designJson> <outDir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SvgSprite } from "../src/sprites/SvgSprite";
import { registerCustomSpecies } from "../src/sprites/customSpecies";
import type { CustomSpeciesEntry, GameConfig, PetState } from "../src/types";

const [, , jsonPath, outDir = "spec-out"] = process.argv;
mkdirSync(outDir, { recursive: true });
const design = JSON.parse(readFileSync(jsonPath, "utf8"));

const palette = { ...design.palette, accent2: design.palette.accent2 ?? null };
const info = {
  nameZh: design.nameZh ?? "无名",
  tier: 2,
  elements: design.elements ?? ["fire", "ice"],
  colors: [design.palette.body, design.palette.accent],
  body: "custom",
  desc: design.desc ?? "",
  steamItemDef: 0,
};
const species: Record<string, CustomSpeciesEntry> = {
  spec: {
    info,
    visual: {
      rig: design.customRig ? "custom" : design.rig ?? "chimera",
      scale: design.scale ?? 1.12,
      palette,
      eyes: design.eyes ?? null,
      toolId: design.toolId ?? null,
      floating: design.customRig?.floating ?? design.form?.floating ?? false,
      slots: design.slots ?? {},
      form: design.form ?? null,
      customRig: design.customRig ?? null,
      workFx: design.workFx ?? null,
    },
  } as unknown as CustomSpeciesEntry,
};
registerCustomSpecies(species);
const config = { species: { spec: info }, fusionTable: {} } as unknown as GameConfig;

const STATES: PetState[] = ["idle", "moving", "working", "success", "fed", "thinking", "error", "sleeping"];
const CELL = 200, LABEL = 20, cols = 4;
const cells: string[] = [];
STATES.forEach((state, i) => {
  let svg = renderToStaticMarkup(h(SvgSprite, { species: "spec", config, petState: state, tier: 2 }));
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  const x = (i % cols) * CELL, y = Math.floor(i / cols) * (CELL + LABEL);
  const inner = svg.replace("<svg ", `<svg x="${x}" y="${y + LABEL}" width="${CELL}" height="${CELL}" `);
  cells.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL + LABEL}" fill="none" stroke="#ddd"/><text x="${x + 8}" y="${y + 14}" font-family="sans-serif" font-size="12" fill="#333">${info.nameZh} · ${state}</text>${inner}`);
});
const rows = Math.ceil(STATES.length / cols);
const W = cols * CELL, H = rows * (CELL + LABEL);
writeFileSync(join(outDir, "_contact.svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#F4EFE6"/>${cells.join("")}</svg>`);
console.log(`rendered ${info.nameZh}: rig=${species.spec.visual.rig}, customRig=${design.customRig ? "yes" : "no"}`);
