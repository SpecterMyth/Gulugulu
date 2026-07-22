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
import { BADGE_PATHS, OUTLINE } from "../src/game/ElementIcon";
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
// "all" = 63 个上架固定物种（speciesByRecipe 的值：6 一阶 + 57 新多元素）。旧 21 只
// 二阶兼容物种（tier 2，仅供老存档迁移）**不再产 Steam 图标**——它们不进新目录图标层。
// 显式传 codename 仍可单独渲染任意物种（含 legacy，用于排查）。
const canonicalSpecies = [...new Set(Object.values(config.speciesByRecipe as Record<string, string>))];
const speciesList = speciesArg === "all" ? canonicalSpecies : speciesArg.split(",");
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

// --- AI 融合变种占位图标（每配方一张）------------------------------------
// 设计：底色按品质（元素数 2→6 = 绿蓝紫橙红 稀有度渐变）；正中一只"未知宠物"黑影
// （圆身+圆耳+脚）表示待认领；该配方的元素徽记做成象牙白勋章、以花环排布压在宠物之上
// （向内收，不压边线框，中心留空露出宠物"脸"）。徽记路径/元素色复用 ElementIcon。
// 文件名 `_aislot_<配方键 + 换 ->`，与 generate_itemdefs.mjs 的 icon_url 逐字对齐。
if (speciesArg === "all") {
  const elements = config.elements as unknown as Record<string, { color: string; badge: string }>;
  const elementCount = (r: string) => r.split("+").length;
  const recipes = Object.keys(config.speciesByRecipe).filter((r) => elementCount(r) >= 2);
  // 品质底色（2..6 元素 = 绿蓝紫橙红）。
  const QUALITY_BG: Record<number, string> = {
    2: "#57A863",
    3: "#4589CC",
    4: "#8C63C4",
    5: "#E28A3C",
    6: "#D45656",
  };
  const SILHOUETTE = "#201E28"; // 未知宠物黑影
  const MEDALLION = "#F3EFE7"; // 元素勋章底盘（象牙白，保证各元素色都醒目）
  // 花环参数（元素越多，环越大、勋章越小；R+mr≤82 保证向内收、不压边线框）。
  const ROSETTE: Record<number, { ring: number; mr: number }> = {
    2: { ring: 42, mr: 38 },
    3: { ring: 46, mr: 34 },
    4: { ring: 50, mr: 31 },
    5: { ring: 53, mr: 28 },
    6: { ring: 56, mr: 26 },
  };
  const CX = 128;
  const CY = 134; // 花环 / 宠物脸 中心
  const aiSlotSvg = (recipe: string): string => {
    const els = recipe.split("+");
    const n = els.length;
    const bg = QUALITY_BG[n] ?? "#6E6E78";
    const { ring, mr } = ROSETTE[n] ?? { ring: 50, mr: 30 };
    // 角度：2 元素水平并列；≥3 从正上方(-90°)均分成花环。
    const angles = n === 2 ? [180, 0] : Array.from({ length: n }, (_, i) => -90 + (360 / n) * i);
    const medallions = els
      .map((el, i) => {
        const a = (angles[i] * Math.PI) / 180;
        const mx = CX + ring * Math.cos(a);
        const my = CY + ring * Math.sin(a);
        const meta = elements[el];
        const d = meta ? BADGE_PATHS[meta.badge] : undefined;
        const box = mr * 1.5; // 徽记字形外框（居中于勋章）
        const disc = `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="${mr}" fill="${MEDALLION}" stroke="${OUTLINE}" stroke-width="3"/>`;
        const glyph = d
          ? `<g transform="translate(${(mx - box / 2).toFixed(2)} ${(my - box / 2).toFixed(2)}) scale(${(box / 16).toFixed(4)})"><path d="${d}" fill="${meta.color}" stroke="${OUTLINE}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"/></g>`
          : `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="${(mr * 0.5).toFixed(1)}" fill="${meta?.color ?? "#888"}"/>`;
        return disc + glyph;
      })
      .join("");
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">`,
      `<rect x="8" y="8" width="240" height="240" rx="44" fill="${bg}" stroke="${OUTLINE}" stroke-width="6"/>`,
      // 未知宠物黑影（同色圆身 + 两圆耳 + 两脚，叠加成剪影）。
      `<circle cx="84" cy="78" r="25" fill="${SILHOUETTE}"/>`,
      `<circle cx="172" cy="78" r="25" fill="${SILHOUETTE}"/>`,
      `<ellipse cx="104" cy="223" rx="18" ry="11" fill="${SILHOUETTE}"/>`,
      `<ellipse cx="152" cy="223" rx="18" ry="11" fill="${SILHOUETTE}"/>`,
      `<circle cx="128" cy="150" r="78" fill="${SILHOUETTE}"/>`,
      medallions,
      `</svg>`,
    ].join("");
  };
  // --- 槽位序号徽标(1..10):嵌进左上圆角的象牙白圆盘 + 深墨粗体数字 --------
  // Steam 库存里同一配方的 10 个 AI 变种槽此前共用一张占位图、肉眼无从区分;把
  // itemdef 名里已有的「第 N 号」槽位序号也画到图上,10 张与 570 个 AI 槽一一对应。
  // resvg 用系统字体渲染 <text>(已实测可用);产物 PNG 落库后与生成机字体无关。
  const MAX_AI_SLOTS = 10; // 与 fusionSlots.ts / build_itemdefs_core.mjs 镜像
  const slotBadge = (slot: number): string => {
    const cx = 58;
    const cy = 58;
    const r = 34; // 左上角,嵌进 rx=44 圆角内,避开中央元素花环
    const fs = slot >= 10 ? 38 : 48; // 两位数收字号
    return (
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${MEDALLION}" stroke="${OUTLINE}" stroke-width="5"/>` +
      `<text x="${cx}" y="${cy}" font-family="Arial, Helvetica, sans-serif" font-size="${fs}" font-weight="700"` +
      ` fill="${SILHOUETTE}" text-anchor="middle" dominant-baseline="central">${slot}</text>`
    );
  };
  const renderAiPng = (name: string, svg: string) => {
    try {
      const png = new Resvg(svg, {
        fitTo: { mode: "width", value: ICON_SIZE },
        font: { loadSystemFonts: true, defaultFontFamily: "Arial" },
      })
        .render()
        .asPng();
      if (png.length < 512) throw new Error(`suspiciously small png (${png.length} bytes)`);
      writeFileSync(join(outDir, `${name}.png`), png);
      ok.push({ species: name, bytes: png.length });
    } catch (error) {
      failures.push({ species: name, error: error instanceof Error ? error.message : String(error) });
    }
  };
  for (const recipe of recipes) {
    const stem = `_aislot_${recipe.replaceAll("+", "-")}`;
    const base = aiSlotSvg(recipe);
    renderAiPng(stem, base); // 无编号原图(向后兼容,既有 57 张保持不变)
    for (let slot = 1; slot <= MAX_AI_SLOTS; slot += 1) {
      renderAiPng(`${stem}_${slot}`, base.replace("</svg>", slotBadge(slot) + "</svg>"));
    }
  }
}

for (const { species, bytes } of ok) console.log(`ok   ${species}.png  ${bytes} bytes`);
for (const { species, error } of failures) console.error(`FAIL ${species}: ${error}`);
console.log(`${ok.length} icons (${speciesList.length} species + AI 占位) -> ${outDir}`);
if (failures.length > 0) process.exitCode = 1;
