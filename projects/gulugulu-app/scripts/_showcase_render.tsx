// 临时展示脚本：把一批「AI 生成的设计 JSON」渲染成 idle 正面单帧网格 PNG（供形象评审）。
// 用法：npx --yes tsx scripts/_showcase_render.tsx <outPng> <cols> <json1> <json2> ...
// 静态渲染无 CSS：剥离 .sprite-fx（元素粒子层）与 .part-tool（idle 不握工具），只看生物本体。
import { readFileSync, writeFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Resvg } from "@resvg/resvg-js";
import { SvgSprite } from "../src/sprites/SvgSprite";
import { registerCustomSpecies } from "../src/sprites/customSpecies";
import type { CustomSpeciesEntry, GameConfig, PetState } from "../src/types";

const [, , outPng, colsArg, ...paths] = process.argv;
const cols = Math.max(1, parseInt(colsArg, 10) || 5);

/** 删除 class 含指定类名的整个 <g>…</g> 子树（正确处理嵌套）。取自 render_contact_sheet。 */
function stripGroups(svg: string, className: string): string {
  let out = svg;
  const openRe = new RegExp(`<g\\s[^>]*class="[^"]*${className}[^"]*"[^>]*>`);
  for (;;) {
    const open = openRe.exec(out);
    if (!open) return out;
    if (open[0].endsWith("/>")) {
      out = out.slice(0, open.index) + out.slice(open.index + open[0].length);
      continue;
    }
    const tagRe = /<g\b[^>]*>|<\/g>/g;
    tagRe.lastIndex = open.index + open[0].length;
    let depth = 1;
    let end = -1;
    for (let m = tagRe.exec(out); m; m = tagRe.exec(out)) {
      if (m[0] === "</g>") {
        depth -= 1;
        if (depth === 0) { end = m.index + m[0].length; break; }
      } else if (!m[0].endsWith("/>")) depth += 1;
    }
    if (end < 0) throw new Error(`unbalanced <g> while stripping .${className}`);
    out = out.slice(0, open.index) + out.slice(end);
  }
}

const species: Record<string, CustomSpeciesEntry> = {};
const configSpecies: Record<string, unknown> = {};
const meta: Array<{ key: string; zh: string; en: string; arch: string; proto: string }> = [];
paths.forEach((p, i) => {
  let d: any;
  try { d = JSON.parse(readFileSync(p, "utf8")); } catch { return; }
  const key = `s${i}`;
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
  meta.push({ key, zh: info.nameZh, en: d.nameEn ?? "", arch: d.archetype ?? "", proto: d.prototype ?? "" });
});
registerCustomSpecies(species);
const config = { species: configSpecies, fusionTable: {} } as unknown as GameConfig;

const CELL = 200;
const LABEL = 44;
const rows = Math.ceil(meta.length / cols);
const cells: string[] = [];
meta.forEach((m, i) => {
  const cx = (i % cols) * CELL;
  const cy = Math.floor(i / cols) * (CELL + LABEL);
  let svg = renderToStaticMarkup(h(SvgSprite, { species: m.key, config, petState: "idle" as PetState, tier: 2 }));
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  svg = stripGroups(svg, "sprite-fx");
  svg = stripGroups(svg, "part-tool");
  const tx = cx + CELL / 2;
  cells.push(
    svg.replace("<svg ", `<svg x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" `) +
      `<text x="${tx}" y="${cy + CELL + 16}" text-anchor="middle" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="16" font-weight="700" fill="#2a2a2a">${m.zh}${m.en ? " · " + m.en : ""}</text>` +
      `<text x="${tx}" y="${cy + CELL + 34}" text-anchor="middle" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="12" fill="#8a8a8a">${m.arch}${m.proto ? " · " + m.proto : ""}</text>`,
  );
});
const W = cols * CELL;
const H = rows * (CELL + LABEL);
const bg = "#F1ECE1";
const gridSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${cells.join("")}</svg>`;
const png = new Resvg(gridSvg, { fitTo: { mode: "width", value: W * 2 }, background: bg }).render().asPng();
writeFileSync(outPng, png);
console.log(`showcase: ${meta.length} species in ${cols} cols -> ${outPng}`);
