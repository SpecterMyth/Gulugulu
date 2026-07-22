// 一次性生成 "Gulugulu" / "咕噜咕噜" 品牌字标的矢量轮廓(ZCOOL KuaiLe,OFL/站酷免费商用)。
// 字体只随 @fontsource/zcool-kuaile 带 woff/woff2,resvg 吃不了 → 用 opentype.js 解析
// WOFF v1(zlib 包装的 sfnt,opentype.js 内置 inflate)把文字描成 <path>,此后所有
// 商店素材栅格化零字体依赖。
//
// 运行(项目根 projects/gulugulu-app):
//   npm install --no-save opentype.js @resvg/resvg-js   # 已装可跳过
//   npx --yes tsx scripts/gen_wordmark.tsx
// 产物:
//   scripts/store/wordmarkPaths.ts     —— 字标数据 + wordmarkGroup() 渲染函数(提交)
//   ../../assets/brand/wordmark.svg    —— 目检用样张(透明底+羊皮纸底两组)
//   ../../assets/brand/wordmark_preview.png —— 样张 PNG(Read 目检)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import { Resvg } from "@resvg/resvg-js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, "..");
const brandDir = join(appDir, "..", "..", "assets", "brand");
const storeDir = join(scriptDir, "store");

const FONT_DIR = join(appDir, "node_modules", "@fontsource", "zcool-kuaile", "files");
const LATIN = "zcool-kuaile-latin-400-normal.woff";
const CJK_101 = "zcool-kuaile-101-400-normal.woff"; // 覆盖 咕(U+5495)/噜(U+565C)

function loadFont(file: string): opentype.Font {
  const buf = readFileSync(join(FONT_DIR, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return opentype.parse(ab);
}

type Letter = { d: string; cx: number; cy: number; rotate: number; advance: number };
type Wordmark = {
  text: string;
  size: number;
  letters: Letter[];
  width: number;
  top: number;
  bottom: number;
};

// 逐字 ±2~3° 交替旋转,呼应游戏内木牌手写感(确定性,不用随机)。
const ROTATIONS = [-2.5, 2, -1.5, 2.5, -2, 1.5];

function outline(fonts: opentype.Font[], text: string, size: number, tracking: number): Wordmark {
  const letters: Letter[] = [];
  let pen = 0;
  let top = Infinity;
  let bottom = -Infinity;
  let index = 0;
  for (const ch of text) {
    const font = fonts.find((f) => f.charToGlyphIndex(ch) > 0);
    if (!font) throw new Error(`没有字体覆盖字符 ${ch}`);
    const glyph = font.charToGlyph(ch);
    const path = glyph.getPath(pen, 0, size);
    const d = path.toPathData(2);
    const box = path.getBoundingBox();
    const advance = ((glyph.advanceWidth ?? font.unitsPerEm) / font.unitsPerEm) * size;
    letters.push({
      d,
      cx: Number(((box.x1 + box.x2) / 2).toFixed(2)),
      cy: Number(((box.y1 + box.y2) / 2).toFixed(2)),
      rotate: ROTATIONS[index % ROTATIONS.length],
      advance: Number(advance.toFixed(2)),
    });
    top = Math.min(top, box.y1);
    bottom = Math.max(bottom, box.y2);
    pen += advance + tracking;
    index += 1;
  }
  return {
    text,
    size,
    letters,
    width: Number((pen - tracking).toFixed(2)),
    top: Number(top.toFixed(2)),
    bottom: Number(bottom.toFixed(2)),
  };
}

const latin = loadFont(LATIN);
const cjk = loadFont(CJK_101);

const SIZE = 100;
const en = outline([latin, cjk], "Gulugulu", SIZE, SIZE * 0.015);
const zh = outline([cjk, latin], "咕噜咕噜", SIZE, SIZE * 0.06);

// ---------- 生成 wordmarkPaths.ts ----------
function letterTs(l: Letter): string {
  return `    { d: ${JSON.stringify(l.d)}, cx: ${l.cx}, cy: ${l.cy}, rotate: ${l.rotate}, advance: ${l.advance} },`;
}
function wordmarkTs(name: string, w: Wordmark): string {
  return [
    `export const ${name}: Wordmark = {`,
    `  text: ${JSON.stringify(w.text)},`,
    `  size: ${w.size},`,
    `  width: ${w.width},`,
    `  top: ${w.top},`,
    `  bottom: ${w.bottom},`,
    `  letters: [`,
    w.letters.map(letterTs).join("\n"),
    `  ],`,
    `};`,
  ].join("\n");
}

const tsOut = `// 由 scripts/gen_wordmark.tsx 生成——手改无效,改脚本重跑。
// "Gulugulu"/"咕噜咕噜" 的 ZCOOL KuaiLe 矢量轮廓(字号 100 基线坐标系,y 向下)。

export type WordmarkLetter = { d: string; cx: number; cy: number; rotate: number; advance: number };
export type Wordmark = {
  text: string;
  size: number;
  letters: WordmarkLetter[];
  /** 首字起笔到末字前进宽(不含描边外扩)。 */
  width: number;
  /** 所有字形包围盒的 y 极值(基线为 0,top 为负)。 */
  top: number;
  bottom: number;
};

${wordmarkTs("WORDMARK_EN", en)}

${wordmarkTs("WORDMARK_ZH", zh)}

export type WordmarkStyle = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** 逐字旋转倍率(0 = 摆正)。 */
  wobble?: number;
};

/** 组装成 <g> 片段:描边副本垫底 + 填充副本在上,逐字微旋。外层自行 transform 摆位。 */
export function wordmarkGroup(w: Wordmark, style: WordmarkStyle = {}): string {
  const { fill = "#FFF3D9", stroke = "#6B4520", strokeWidth = 7, wobble = 1 } = style;
  const letters = w.letters
    .map((l) => {
      const rot = (l.rotate * wobble).toFixed(2);
      const strokePath = stroke && strokeWidth > 0
        ? \`<path d="\${l.d}" fill="none" stroke="\${stroke}" stroke-width="\${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>\`
        : "";
      return \`<g transform="rotate(\${rot} \${l.cx} \${l.cy})">\${strokePath}<path d="\${l.d}" fill="\${fill}"/></g>\`;
    })
    .join("");
  return \`<g>\${letters}</g>\`;
}
`;

mkdirSync(storeDir, { recursive: true });
writeFileSync(join(storeDir, "wordmarkPaths.ts"), tsOut);

// ---------- 样张 SVG + PNG(目检) ----------
function sample(): string {
  const pad = 40;
  const enScale = 1;
  const zhScale = 0.72;
  const rowEn = { x: pad - Math.min(0, 0), y: 130 };
  const rowZh = { y: 262 };
  const width = Math.ceil(Math.max(en.width * enScale, zh.width * zhScale) + pad * 2);
  const height = 420;
  const enGroup = `<g transform="translate(${pad} ${rowEn.y})">${groupFor(en, 1)}</g>`;
  const zhGroup = `<g transform="translate(${pad} ${rowZh.y}) scale(${zhScale})">${groupFor(zh, 1)}</g>`;
  const enGroup2 = `<g transform="translate(${pad} ${rowEn.y + 210})">${groupFor(en, 2)}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height / 2}" fill="none"/>
  <rect x="0" y="${height / 2}" width="${width}" height="${height / 2}" fill="#F5EAD2"/>
  ${enGroup}
  ${zhGroup}
  ${enGroup2}
</svg>`;

  function groupFor(w: Wordmark, variant: 1 | 2): string {
    // variant 1:奶油字+深木描边;variant 2:深木字+金边(羊皮纸底用)。
    const letters = w.letters
      .map((l) => {
        const strokeW = variant === 1 ? 7 : 6;
        const stroke = variant === 1 ? "#6B4520" : "#FFE9AD";
        const fill = variant === 1 ? "#FFF3D9" : "#6B4520";
        return `<g transform="rotate(${l.rotate} ${l.cx} ${l.cy})"><path d="${l.d}" fill="none" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round" stroke-linecap="round"/><path d="${l.d}" fill="${fill}"/></g>`;
      })
      .join("");
    return `<g>${letters}</g>`;
  }
}

mkdirSync(brandDir, { recursive: true });
const svg = sample();
writeFileSync(join(brandDir, "wordmark.svg"), svg);
const png = new Resvg(svg, { background: "#9BD5E8" }).render().asPng();
writeFileSync(join(brandDir, "wordmark_preview.png"), png);

console.log(`EN 字标:${en.letters.length} 字,宽 ${en.width},y ∈ [${en.top}, ${en.bottom}]`);
console.log(`ZH 字标:${zh.letters.length} 字,宽 ${zh.width},y ∈ [${zh.top}, ${zh.bottom}]`);
console.log(`已写 scripts/store/wordmarkPaths.ts + assets/brand/wordmark.svg/.png`);
