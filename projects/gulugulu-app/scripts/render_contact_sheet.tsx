// 融合 2.0 评审用：把 6 只一阶 + species2 全部新物种渲染成 contact sheet PNG
// （按元素数分行分组），并可选逐只输出 256px 单图。静态渲染无 CSS，因此：
//   - 恒剥离 .sprite-fx（元素粒子层，默认应由 CSS 隐藏）
//   - petState=idle 时剥离 .part-tool；working 时保留（评审工具形态）
// 用法（在 projects/gulugulu-app 下）：
//   npx --yes tsx scripts/render_contact_sheet.tsx [outDir] [statesCsv] [--silhouette] [--each]
// 缺省 outDir = <repo>/assets/species_review，statesCsv = "idle,working"。
// --silhouette：所有填充/描边刷成剪影色，输出 *_silhouette.png（两两区分度评审）。
// --each：另按状态逐只输出 256px 单图到 outDir/each/。
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Resvg } from "@resvg/resvg-js";
import { SvgSprite } from "../src/sprites/SvgSprite";
import { PACKS } from "../src/sprites/species2";
import rawConfig from "../src/game/config.json";
import type { GameConfig, PetState, SpeciesInfo } from "../src/types";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const outDir = args[0] ? resolve(args[0]) : join(scriptDir, "..", "..", "..", "assets", "species_review");
const states = (args[1] ?? "idle,working").split(",") as PetState[];
const silhouette = flags.has("--silhouette");
const each = flags.has("--each");

const ELEMENT_COLORS: Record<string, string> = {
  normal: "#6E6E78",
  fire: "#E85D3A",
  electric: "#FFD93B",
  water: "#2E7BD6",
  grass: "#57B84C",
  ice: "#8FD8E8",
};

// 拼一个够 SvgSprite 用的 config：真实 config 的物种 + species2 包推导的条目
const base = rawConfig as unknown as GameConfig;
const species: Record<string, SpeciesInfo> = { ...base.species };
for (const [code, pack] of Object.entries(PACKS)) {
  species[code] = {
    nameZh: pack.meta.nameZh,
    tier: pack.meta.elements.length,
    elements: pack.meta.elements,
    colors: pack.meta.elements.map((e) => ELEMENT_COLORS[e] ?? "#F5C542"),
    body: code,
    desc: "",
    steamItemDef: 0,
  } as SpeciesInfo;
}
const config = { ...base, species } as GameConfig;

// 排序：一阶六只 → 按元素数升序、codename 字典序
const TIER1 = ["guluduck", "emberfox", "voltmouse", "bubblefrog", "sproutcap", "frostpeng"];
const packRows = Object.entries(PACKS)
  .map(([code, pack]) => ({ code, count: pack.meta.elements.length }))
  .sort((a, b) => a.count - b.count || a.code.localeCompare(b.code));
const roster = [...TIER1.map((code) => ({ code, count: 1 })), ...packRows];

/** 删除 class 含指定类名的整个 <g>…</g> 子树（正确处理嵌套 <g>）。 */
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
        if (depth === 0) {
          end = m.index + m[0].length;
          break;
        }
      } else if (!m[0].endsWith("/>")) {
        depth += 1;
      }
    }
    if (end < 0) throw new Error(`unbalanced <g> while stripping .${className}`);
    out = out.slice(0, open.index) + out.slice(end);
  }
}

function toSilhouette(svg: string): string {
  return svg
    .replace(/fill="(?!none)[^"]*"/g, 'fill="#3B2B1D"')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="#3B2B1D"')
    .replace(/opacity="[^"]*"/g, 'opacity="1"')
    .replace(/fill-opacity="[^"]*"/g, "");
}

function renderSpecies(code: string, state: PetState): string {
  let svg = renderToStaticMarkup(createElement(SvgSprite, { species: code, config, petState: state }));
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  svg = stripGroups(svg, "sprite-fx");
  if (state !== "working" && state !== "laboring" && state !== "success") {
    svg = stripGroups(svg, "part-tool");
  }
  return svg;
}

mkdirSync(outDir, { recursive: true });
if (each) mkdirSync(join(outDir, "each"), { recursive: true });

const COLS = 8;
const CELL_W = 132;
const CELL_H = 158;
const failures: string[] = [];

for (const state of states) {
  const cells: string[] = [];
  let col = 0;
  let row = 0;
  let lastCount = -1;
  for (const { code, count } of roster) {
    if (count !== lastCount && col !== 0) {
      row += 1;
      col = 0;
    }
    lastCount = count;
    try {
      let inner = renderSpecies(code, state);
      if (silhouette) inner = toSilhouette(inner);
      // 内嵌为 <svg x y>（去掉根 svg 的 class，保尺寸属性）
      inner = inner.replace(/^<svg /, `<svg x="${col * CELL_W + 2}" y="${row * CELL_H + 2}" width="128" height="128" `);
      const label = `${code}·e${count}`;
      cells.push(
        inner,
        `<text x="${col * CELL_W + 66}" y="${row * CELL_H + 146}" text-anchor="middle" font-size="12" font-family="Segoe UI, Microsoft YaHei, sans-serif" fill="#3B2B1D">${label}</text>`,
      );
      if (each) {
        let solo = renderSpecies(code, state);
        if (silhouette) solo = toSilhouette(solo);
        const png = new Resvg(solo, { fitTo: { mode: "width", value: 256 }, background: "#FFFFFF" }).render().asPng();
        writeFileSync(join(outDir, "each", `${code}__${state}${silhouette ? "_sil" : ""}.png`), png);
      }
    } catch (error) {
      failures.push(`${code}/${state}: ${error instanceof Error ? error.message : String(error)}`);
    }
    col += 1;
    if (col >= COLS) {
      col = 0;
      row += 1;
    }
  }
  const width = COLS * CELL_W + 4;
  const height = (row + 1) * CELL_H + 4;
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#FFFFFF"/>${cells.join("")}</svg>`;
  const png = new Resvg(sheet, { fitTo: { mode: "width", value: width } }).render().asPng();
  const file = join(outDir, `sheet_${state}${silhouette ? "_silhouette" : ""}.png`);
  writeFileSync(file, png);
  console.log(`sheet ${state}${silhouette ? " (silhouette)" : ""} -> ${file} (${roster.length} species)`);
}

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL ${f}`);
  process.exitCode = 1;
}
