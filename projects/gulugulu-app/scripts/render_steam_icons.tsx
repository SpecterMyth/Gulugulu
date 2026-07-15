// 开发用：把全部物种的 idle 立绘离线渲染成 Steam 库存图标 PNG（256×256 透明底）。
// 与 render_sprites.tsx 同源（SvgSprite 静态渲染），差异：
//   1) 静态渲染没有 sprites.css —— 需剥离仅在特定状态由 CSS 显示的部件：
//      .part-tool（工具，默认 opacity:0，仅 working/laboring/success 可见）
//      .sprite-fx（元素粒子层，默认 opacity:0，由动画点亮）
//   2) 直接用 @resvg/resvg-js 栅格化为 PNG，不落中间 .svg。
// 用法（在 projects/gulugulu-app 下）：
//   npm install --no-save @resvg/resvg-js        # 一次性；渲染依赖不进 package.json
//   npx --yes tsx scripts/render_steam_icons.tsx [outDir] [speciesCsv|all]
// 缺省 outDir = <repo>/assets/steam-icons，文件名 = 物种 key（如 guluduck.png）。
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Resvg } from "@resvg/resvg-js";
import { SvgSprite } from "../src/sprites/SvgSprite";
import rawConfig from "../src/game/config.json";
import type { GameConfig } from "../src/types";

const ICON_SIZE = 256;
const config = rawConfig as unknown as GameConfig;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const [, , outDirArg, speciesArg = "all"] = process.argv;
const outDir = outDirArg
  ? resolve(outDirArg)
  : join(scriptDir, "..", "..", "..", "assets", "steam-icons");

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

mkdirSync(outDir, { recursive: true });
const speciesList = speciesArg === "all" ? Object.keys(config.species) : speciesArg.split(",");
const ok: Array<{ species: string; bytes: number }> = [];
const failures: Array<{ species: string; error: string }> = [];

for (const species of speciesList) {
  try {
    let svg = renderToStaticMarkup(
      createElement(SvgSprite, { species, config, petState: "idle" }),
    );
    if (!svg.includes("xmlns=")) {
      svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
    }
    svg = stripGroups(svg, "part-tool");
    svg = stripGroups(svg, "sprite-fx");
    const rendered = new Resvg(svg, { fitTo: { mode: "width", value: ICON_SIZE } }).render();
    if (rendered.width !== ICON_SIZE || rendered.height !== ICON_SIZE) {
      throw new Error(`unexpected raster size ${rendered.width}x${rendered.height}`);
    }
    const png = rendered.asPng();
    if (png.length < 1024) throw new Error(`suspiciously small png (${png.length} bytes)`);
    writeFileSync(join(outDir, `${species}.png`), png);
    ok.push({ species, bytes: png.length });
  } catch (error) {
    failures.push({ species, error: error instanceof Error ? error.message : String(error) });
  }
}

// --- AI 融合变种占位图标（5 张，按元素数 2..6）---------------------------
// 真形象/名字由首个生成者经创意工坊上传认领；此处只出通用"待认领空槽"占位。
// 纯图形（虚线环 + N 颗元素色点 + 图形拼的 "?"），不依赖字体，避免 resvg 缺字。
if (speciesArg === "all") {
  const ELEMENT_COLORS = ["#6E6E78", "#E85D3A", "#FFD93B", "#2E7BD6", "#57B84C", "#8FD8E8"];
  const aiSlotSvg = (ec: number): string => {
    const gap = 34;
    const startX = 128 - ((ec - 1) * gap) / 2;
    const dots = Array.from({ length: ec }, (_, i) =>
      `<circle cx="${startX + i * gap}" cy="198" r="12" fill="${ELEMENT_COLORS[i]}" stroke="#3B2B1D" stroke-width="4"/>`,
    ).join("");
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">`,
      `<rect x="10" y="10" width="236" height="236" rx="44" fill="#2A2A32" stroke="#3B2B1D" stroke-width="6"/>`,
      `<circle cx="128" cy="110" r="60" fill="none" stroke="#9AA0AA" stroke-width="10" stroke-dasharray="16 12" stroke-linecap="round"/>`,
      `<path d="M108 94 a20 20 0 1 1 26 19 q-6 4 -6 14" fill="none" stroke="#EDEDF2" stroke-width="11" stroke-linecap="round"/>`,
      `<circle cx="128" cy="144" r="7" fill="#EDEDF2"/>`,
      dots,
      `</svg>`,
    ].join("");
  };
  for (let ec = 2; ec <= 6; ec += 1) {
    const name = `_aislot_e${ec}`;
    try {
      const rendered = new Resvg(aiSlotSvg(ec), { fitTo: { mode: "width", value: ICON_SIZE } }).render();
      const png = rendered.asPng();
      if (png.length < 512) throw new Error(`suspiciously small png (${png.length} bytes)`);
      writeFileSync(join(outDir, `${name}.png`), png);
      ok.push({ species: name, bytes: png.length });
    } catch (error) {
      failures.push({ species: name, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

for (const { species, bytes } of ok) console.log(`ok   ${species}.png  ${bytes} bytes`);
for (const { species, error } of failures) console.error(`FAIL ${species}: ${error}`);
console.log(`${ok.length} icons (${speciesList.length} species + AI 占位) -> ${outDir}`);
if (failures.length > 0) process.exitCode = 1;
