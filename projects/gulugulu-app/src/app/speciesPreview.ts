import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SvgSprite } from "../sprites/SvgSprite";
import { buildVisualFromSpec, getCustomSpeciesEntry } from "../sprites/customSpecies";
import type { GameConfig } from "../types";

// ---------------------------------------------------------------------------
// 物种设定图离屏渲染：SvgSprite → 静态 SVG → canvas 栅格化 PNG。
// 用途：创意工坊物品缩略图（Rust 侧 cache_species_preview 落盘 + SetItemPreview）。
// 与 scripts/render_*.tsx 的离线管线同源（renderToStaticMarkup），只是栅格化改走
// 浏览器 canvas 而非 resvg。
// ---------------------------------------------------------------------------

/** 输出边长（Steam 预览图方形网格；SVG 拍平后几十 KB，远低于 1MB 上限）。 */
const PREVIEW_SIZE = 512;

/** 把一个物种渲染成 PNG，返回 base64（不含 data: 前缀）。物种需已
 *  `registerCustomSpecies` 注册（useGame 在存档载入时完成）。
 *
 *  **皮肤护栏（SkinWorkshop.md）**：这张 PNG 是**本机上传创意工坊物品**的缩略图，
 *  必须永远是本机 custom_species 里的原生形象——显式传 visual 绕过全局皮肤覆盖，
 *  否则玩家换了「默认/他人皮肤」后，自己的工坊条目会被盖成别人的画。 */
export async function renderSpeciesPreviewPng(species: string, config: GameConfig): Promise<string> {
  const entry = getCustomSpeciesEntry(species);
  const nativeVisual = entry ? buildVisualFromSpec(entry.visual) : undefined;
  const markup = renderToStaticMarkup(
    createElement(SvgSprite, { species, config, petState: "idle", visual: nativeVisual }),
  );
  // 根 svg 只有 viewBox（页面内尺寸由 CSS 给），栅格化需要显式像素尺寸；且
  // renderToStaticMarkup **不输出 xmlns**，而 <Image> 加载 data:image/svg+xml
  // 缺 SVG 命名空间会直接 onerror 加载失败（缩略图渲染长期静默失败的根因）——
  // 这里把 xmlns 与像素尺寸一并补进根节点（xmlns 幂等，防未来 React 自带时重复）。
  const nsAttr = markup.includes("xmlns=") ? "" : 'xmlns="http://www.w3.org/2000/svg" ';
  const sized = markup.replace("<svg ", `<svg ${nsAttr}width="${PREVIEW_SIZE}" height="${PREVIEW_SIZE}" `);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;

  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`SVG 预览图加载失败：${species}`));
    image.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_SIZE;
  canvas.height = PREVIEW_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d 上下文不可用");
  ctx.drawImage(image, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

  const dataUrl = canvas.toDataURL("image/png");
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) throw new Error("canvas PNG 导出失败");
  return dataUrl.slice(prefix.length);
}
