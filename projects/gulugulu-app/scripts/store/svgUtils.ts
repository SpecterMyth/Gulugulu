// 商店素材渲染的共享工具:配置合并(config.json + species2 包)、CSS 类子树剥离、
// 单只物种静态 SVG 渲染、嵌套摆位。抽取自 render_contact_sheet.tsx / render_steam_icons.tsx
// 的既有实现(旧脚本暂不回改,后续去重)。

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SvgSprite } from "../../src/sprites/SvgSprite";
import { PACKS } from "../../src/sprites/species2";
import rawConfig from "../../src/game/config.json";
import type { GameConfig, PetState, SpeciesInfo } from "../../src/types";

export const ELEMENT_COLORS: Record<string, string> = {
  normal: "#6E6E78",
  fire: "#E85D3A",
  electric: "#FFD93B",
  water: "#2E7BD6",
  grass: "#57B84C",
  ice: "#8FD8E8",
};

/** 拼一个够 SvgSprite 用的 config:真实 config 的物种 + species2 包推导的条目。 */
export function buildRenderConfig(): GameConfig {
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
  return { ...base, species } as GameConfig;
}

/** 删除 class 含指定类名的整个 <g>…</g> 子树(正确处理嵌套 <g>)。 */
export function stripGroups(svg: string, className: string): string {
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

/**
 * 渲染一只物种为独立 SVG 字符串(静态无 CSS):恒剥 .sprite-fx;
 * 非工作类状态剥 .part-tool(与游戏内 CSS 隐藏行为一致)。
 */
export function renderSpeciesSvg(code: string, state: PetState, config: GameConfig): string {
  let svg = renderToStaticMarkup(createElement(SvgSprite, { species: code, config, petState: state }));
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  svg = stripGroups(svg, "sprite-fx");
  if (state !== "working" && state !== "laboring" && state !== "success") {
    svg = stripGroups(svg, "part-tool");
  }
  return svg;
}

/** 把独立 SVG 作为 <svg x y width height> 嵌进更大画布(size = 256 视框的目标边长)。 */
export function nestSvg(svg: string, x: number, y: number, size: number): string {
  return svg.replace(
    /^<svg /,
    `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" `,
  );
}
