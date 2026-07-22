// Steam 商店全套图形素材离线渲染(矢量直出,任意尺寸无损)。
// 用法(在 projects/gulugulu-app 下):
//   npm install --no-save @resvg/resvg-js opentype.js png-to-ico   # 已装可跳过
//   npx --yes tsx scripts/render_store_assets.tsx [--only=name1,name2]
// 产物 → <repo>/assets/steam-store/:胶囊×4、页面背景、库头图/库胶囊/库 Hero、
// 库 Logo(透明)、社区图标(184 PNG,JPG 由 PowerShell System.Drawing 另转)、
// 快捷方式图标 256/512 + 多尺寸 gulugulu.ico。
//
// 构图原则(partner.steamgames.com/doc/store/assets/rules):
//   - 只有产品字标,无评分/奖项/促销文字;library_hero/page_background 完全无文字。
//   - 画面元素全部来自游戏内真实 SVG rig(与实际观感一致)。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";
import type { PetState } from "../src/types";
import { buildRenderConfig, nestSvg, renderSpeciesSvg } from "./store/svgUtils";
import {
  WORDMARK_EN,
  WORDMARK_ZH,
  wordmarkGroup,
  type Wordmark,
  type WordmarkStyle,
} from "./store/wordmarkPaths";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(scriptDir, "..", "..", "..", "assets", "steam-store");
const config = buildRenderConfig();

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice(7).split(",")) : null;

// ---------------- 调色板(src/styles.css + 元素色) ----------------
const C = {
  woodDark: "#6B4520",
  ink: "#4A3313",
  cream: "#FFF3D9",
  creamTitle: "#FFE9AD",
  parchment: "#F5EAD2",
  gold: "#F7D373",
  skyTop: "#8FCFEA",
  skyBottom: "#D8F0FB",
  meadow: "#8FCB6B",
  meadowDeep: "#5FAE4C",
  hill: "#A8D97C",
};

const DEFS = `<defs>
  <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${C.skyTop}"/><stop offset="100%" stop-color="${C.skyBottom}"/>
  </linearGradient>
  <linearGradient id="meadowG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${C.meadow}"/><stop offset="100%" stop-color="${C.meadowDeep}"/>
  </linearGradient>
  <linearGradient id="parchG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#FBF3DE"/><stop offset="100%" stop-color="${C.parchment}"/>
  </linearGradient>
  <linearGradient id="woodG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#B07B44"/><stop offset="100%" stop-color="#96622F"/>
  </linearGradient>
  <radialGradient id="glowG" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0%" stop-color="#FFF7E0" stop-opacity="0.95"/><stop offset="100%" stop-color="#FFF7E0" stop-opacity="0"/>
  </radialGradient>
</defs>`;

// ---------------- 小装饰 ----------------
function sun(x: number, y: number, r: number): string {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = x + Math.cos(a) * r * 1.25;
    const y1 = y + Math.sin(a) * r * 1.25;
    const x2 = x + Math.cos(a) * r * 1.55;
    const y2 = y + Math.sin(a) * r * 1.55;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${C.gold}" stroke-width="${(r * 0.16).toFixed(1)}" stroke-linecap="round"/>`;
  }).join("");
  return `<g opacity="0.9">${rays}<circle cx="${x}" cy="${y}" r="${r}" fill="${C.creamTitle}" stroke="${C.gold}" stroke-width="${(r * 0.1).toFixed(1)}"/></g>`;
}

function cloud(x: number, y: number, s: number, opacity = 0.92): string {
  return `<g fill="#FFFFFF" opacity="${opacity}">
    <ellipse cx="${x}" cy="${y}" rx="${s * 1.15}" ry="${s * 0.55}"/>
    <ellipse cx="${x - s * 0.75}" cy="${y + s * 0.12}" rx="${s * 0.6}" ry="${s * 0.38}"/>
    <ellipse cx="${x + s * 0.7}" cy="${y + s * 0.1}" rx="${s * 0.65}" ry="${s * 0.4}"/>
  </g>`;
}

function sparkle(x: number, y: number, s: number, color = C.creamTitle, opacity = 0.9): string {
  return `<path d="M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z" fill="${color}" opacity="${opacity}"/>`;
}

/** 天空+草地背景(horizon = 草地线占高比)。 */
function skyMeadow(w: number, h: number, horizon = 0.66): string {
  const hy = h * horizon;
  return `<rect width="${w}" height="${h}" fill="url(#skyG)"/>
  <ellipse cx="${w * 0.22}" cy="${hy + h * 0.05}" rx="${w * 0.42}" ry="${h * 0.11}" fill="${C.hill}"/>
  <ellipse cx="${w * 0.8}" cy="${hy + h * 0.06}" rx="${w * 0.46}" ry="${h * 0.13}" fill="${C.hill}"/>
  <rect y="${hy}" width="${w}" height="${h - hy}" fill="url(#meadowG)"/>
  <ellipse cx="${w * 0.5}" cy="${hy + 2}" rx="${w * 0.62}" ry="${h * 0.045}" fill="${C.meadow}"/>`;
}

// ---------------- 摆位 ----------------
type CastEntry = { code: string; state?: PetState; size: number; cx: number; feetY: number; opacity?: number };

/** 精灵脚底(阴影椭圆)约在 256 视框的 y≈230 → feetY - size*0.9 为顶部。 */
function putCast(entries: CastEntry[]): string {
  return entries
    .map((e) => {
      const svg = renderSpeciesSvg(e.code, e.state ?? "idle", config);
      const x = e.cx - e.size / 2;
      const y = e.feetY - e.size * 0.9;
      const nested = nestSvg(svg, x, y, e.size);
      return e.opacity != null ? `<g opacity="${e.opacity}">${nested}</g>` : nested;
    })
    .join("");
}

function placeWordmark(
  w: Wordmark,
  xCenter: number,
  yTop: number,
  targetW: number,
  style?: WordmarkStyle,
): string {
  const scale = targetW / w.width;
  const x = xCenter - targetW / 2;
  const y = yTop - w.top * scale;
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(4)})">${wordmarkGroup(w, style)}</g>`;
}

const wmHeight = (w: Wordmark, targetW: number) => ((w.bottom - w.top) * targetW) / w.width;

const STARTERS5 = ["emberfox", "voltmouse", "bubblefrog", "sproutcap", "frostpeng"];

// ---------------- 各目标构图 ----------------
function capsuleWide(w: number, h: number): string {
  const wmW = Math.min(w * 0.54, 680);
  const wmTop = h * 0.06;
  const zhW = wmW * 0.34;
  const zhTop = wmTop + wmHeight(WORDMARK_EN, wmW) + h * 0.012;
  const back: CastEntry[] = ["emberfox", "voltmouse", "sproutcap", "frostpeng"].map((code, i) => ({
    code,
    size: h * 0.26,
    cx: w * (0.27 + i * 0.153),
    feetY: h * 0.775,
  }));
  const front: CastEntry[] = [
    { code: "lanternloong", size: h * 0.6, cx: w * 0.11, feetY: h * 0.97 },
    { code: "prismkirin", size: h * 0.65, cx: w * 0.885, feetY: h * 0.975 },
    { code: "guluduck", state: "working", size: h * 0.55, cx: w * 0.5, feetY: h * 0.98 },
  ];
  // 浮空鲸填补字标与草地之间的天空段(bubblefrog 本就是浮空系)。
  const floating: CastEntry[] = [
    { code: "bubblefrog", size: h * 0.17, cx: w * 0.205, feetY: h * 0.46 },
  ];
  return `${skyMeadow(w, h, 0.68)}
  ${sun(w * 0.925, h * 0.13, h * 0.055)}
  ${cloud(w * 0.14, h * 0.14, h * 0.05)}
  ${cloud(w * 0.66, h * 0.09, h * 0.04, 0.8)}
  <ellipse cx="${w * 0.5}" cy="${h * 0.32}" rx="${w * 0.33}" ry="${h * 0.26}" fill="url(#glowG)"/>
  ${putCast(floating)}
  ${putCast(back)}
  ${putCast(front)}
  ${sparkle(w * 0.2, h * 0.34, h * 0.018)}
  ${sparkle(w * 0.79, h * 0.3, h * 0.022)}
  ${sparkle(w * 0.31, h * 0.24, h * 0.014, "#FFFFFF")}
  ${placeWordmark(WORDMARK_EN, w * 0.5, wmTop, wmW)}
  ${placeWordmark(WORDMARK_ZH, w * 0.5, zhTop, zhW, { strokeWidth: 9 })}`;
}

function capsuleTall(w: number, h: number): string {
  const wmW = w * 0.78;
  const wmTop = h * 0.035;
  const zhW = wmW * 0.4;
  const zhTop = wmTop + wmHeight(WORDMARK_EN, wmW) + h * 0.01;
  const bottom: CastEntry[] = STARTERS5.map((code, i) => ({
    code,
    size: h * 0.15,
    cx: w * (0.13 + i * 0.185),
    feetY: h * 0.955,
  }));
  return `${skyMeadow(w, h, 0.62)}
  ${sun(w * 0.88, h * 0.045, h * 0.028)}
  ${cloud(w * 0.16, h * 0.28, h * 0.03)}
  ${cloud(w * 0.82, h * 0.33, h * 0.026, 0.8)}
  <ellipse cx="${w * 0.5}" cy="${h * 0.42}" rx="${w * 0.42}" ry="${h * 0.2}" fill="url(#glowG)"/>
  ${putCast([{ code: "prismkirin", size: h * 0.3, cx: w * 0.5, feetY: h * 0.475 }])}
  ${sparkle(w * 0.24, h * 0.33, w * 0.02)}
  ${sparkle(w * 0.78, h * 0.28, w * 0.024)}
  ${sparkle(w * 0.68, h * 0.44, w * 0.015, "#FFFFFF")}
  ${putCast([{ code: "guluduck", state: "working", size: h * 0.31, cx: w * 0.5, feetY: h * 0.81 }])}
  ${putCast(bottom)}
  ${placeWordmark(WORDMARK_EN, w * 0.5, wmTop, wmW)}
  ${placeWordmark(WORDMARK_ZH, w * 0.5, zhTop, zhW, { strokeWidth: 9 })}`;
}

function capsuleSmall(w: number, h: number): string {
  const wmW = w * 0.6;
  const wmH = wmHeight(WORDMARK_EN, wmW);
  return `<rect width="${w}" height="${h}" fill="url(#woodG)"/>
  <rect x="5" y="5" width="${w - 10}" height="${h - 10}" rx="14" fill="url(#parchG)" stroke="${C.woodDark}" stroke-width="4"/>
  ${sparkle(w * 0.08, h * 0.22, 7, C.gold)}
  ${sparkle(w * 0.62, h * 0.8, 6, C.gold)}
  ${placeWordmark(WORDMARK_EN, w * 0.37, (h - wmH) / 2, wmW, { fill: C.woodDark, stroke: C.creamTitle, strokeWidth: 6 })}
  ${putCast([{ code: "guluduck", state: "working", size: h * 0.8, cx: w * 0.83, feetY: h * 0.94 }])}`;
}

function pageBg(w: number, h: number): string {
  return `${skyMeadow(w, h, 0.72)}
  ${cloud(w * 0.12, h * 0.12, h * 0.05, 0.6)}
  ${cloud(w * 0.5, h * 0.08, h * 0.04, 0.5)}
  ${cloud(w * 0.85, h * 0.16, h * 0.055, 0.55)}
  <rect width="${w}" height="${h}" fill="#FFFFFF" opacity="0.12"/>`;
}

function heroParade(w: number, h: number): string {
  // 中央 860×380 安全区:主角对(咕噜鸭+晶麒麟)落位其中;整幅无文字。
  const cast: CastEntry[] = [
    { code: "frostpeng", size: 330, cx: 300, feetY: h * 0.9 },
    { code: "bubblefrog", size: 360, cx: 680, feetY: h * 0.93 },
    { code: "liondance", size: 470, cx: 1080, feetY: h * 0.95 },
    { code: "voltmouse", state: "working", size: 350, cx: 1430, feetY: h * 0.9 },
    { code: "guluduck", state: "working", size: 520, cx: 1780, feetY: h * 0.95 },
    { code: "prismkirin", size: 560, cx: 2150, feetY: h * 0.955 },
    { code: "lanternloong", size: 500, cx: 2520, feetY: h * 0.94 },
    { code: "manacorn", size: 440, cx: 2880, feetY: h * 0.92 },
    { code: "emberfox", size: 350, cx: 3200, feetY: h * 0.9 },
    { code: "sproutcap", size: 340, cx: 3520, feetY: h * 0.92 },
  ];
  return `${skyMeadow(w, h, 0.6)}
  ${sun(w * 0.06, h * 0.16, h * 0.05)}
  ${cloud(w * 0.3, h * 0.14, h * 0.045, 0.85)}
  ${cloud(w * 0.55, h * 0.1, h * 0.04, 0.7)}
  ${cloud(w * 0.8, h * 0.17, h * 0.05, 0.8)}
  <ellipse cx="${w * 0.51}" cy="${h * 0.52}" rx="${w * 0.17}" ry="${h * 0.32}" fill="url(#glowG)"/>
  ${putCast(cast)}
  ${sparkle(w * 0.44, h * 0.3, 22)}
  ${sparkle(w * 0.58, h * 0.26, 26)}
  ${sparkle(w * 0.5, h * 0.2, 18, "#FFFFFF")}`;
}

function logoOnly(w: number, h: number): string {
  const wmW = 880;
  const wmTop = h * 0.44;
  const zhW = 320;
  const zhTop = wmTop + wmHeight(WORDMARK_EN, wmW) + 16;
  return `${putCast([{ code: "guluduck", size: 300, cx: w / 2, feetY: wmTop - 6 }])}
  ${sparkle(w * 0.31, h * 0.3, 16, C.gold)}
  ${sparkle(w * 0.68, h * 0.26, 18, C.gold)}
  ${placeWordmark(WORDMARK_EN, w / 2, wmTop, wmW)}
  ${placeWordmark(WORDMARK_ZH, w / 2, zhTop, zhW, { strokeWidth: 9 })}`;
}

function workshopHeader(w: number, h: number): string {
  // 948×203 创意工坊头图(Steam workshop_header)。游戏艺术 + 字标居左 ~55%;
  // 右 ~45% 留素色天空,供 Steam 叠加工坊标题/描述(partner 要求"右侧留白")。
  const wmW = w * 0.33;
  const wmTop = h * 0.12;
  const zhW = wmW * 0.36;
  const zhTop = wmTop + wmHeight(WORDMARK_EN, wmW) + h * 0.04;
  const cast: CastEntry[] = [
    { code: "frostpeng", size: h * 0.58, cx: w * 0.05, feetY: h * 1.0 },
    { code: "voltmouse", state: "working", size: h * 0.56, cx: w * 0.455, feetY: h * 0.99 },
    { code: "guluduck", state: "working", size: h * 0.8, cx: w * 0.285, feetY: h * 1.03 },
  ];
  return `${skyMeadow(w, h, 0.72)}
  ${sun(w * 0.125, h * 0.26, h * 0.072)}
  ${cloud(w * 0.79, h * 0.2, h * 0.075, 0.55)}
  <ellipse cx="${w * 0.27}" cy="${h * 0.52}" rx="${w * 0.28}" ry="${h * 0.52}" fill="url(#glowG)"/>
  ${putCast(cast)}
  ${sparkle(w * 0.15, h * 0.42, h * 0.032)}
  ${sparkle(w * 0.4, h * 0.3, h * 0.036)}
  ${placeWordmark(WORDMARK_EN, w * 0.27, wmTop, wmW)}
  ${placeWordmark(WORDMARK_ZH, w * 0.27, zhTop, zhW, { strokeWidth: 9 })}`;
}

function iconBadge(w: number, h: number, opaque: boolean): string {
  // 满画幅鸭头(2026-07-17 用户审阅 v2):无边框、无圆角裁形——Steam 侧自行裁切。
  // 头部窗口取 sprite 坐标 x∈[44,212]、y∈[46,214](168×168,含完整鸭嘴、避开尾尖),
  // 画布=该窗口等比放大,溢出由画布边缘自然裁掉。
  const s = w / 168;
  const size = 256 * s;
  const x = -44 * s;
  const y = -46 * s;
  const sprite = nestSvg(renderSpeciesSvg("guluduck", "idle", config), x, y, size);
  return `${opaque ? `<rect width="${w}" height="${h}" fill="${C.cream}"/>` : ""}${sprite}`;
}

// ---------------- 目标表 ----------------
type Target = { name: string; w: number; h: number; transparent?: boolean; compose: (w: number, h: number) => string };
const TARGETS: Target[] = [
  { name: "main_capsule", w: 1232, h: 706, compose: capsuleWide },
  { name: "header_capsule", w: 920, h: 430, compose: capsuleWide },
  { name: "small_capsule", w: 462, h: 174, compose: capsuleSmall },
  { name: "vertical_capsule", w: 748, h: 896, compose: capsuleTall },
  { name: "page_background", w: 1438, h: 810, compose: pageBg },
  { name: "library_capsule", w: 600, h: 900, compose: capsuleTall },
  { name: "library_header", w: 920, h: 430, compose: capsuleWide },
  { name: "library_hero", w: 3840, h: 1240, compose: heroParade },
  { name: "library_logo", w: 1280, h: 720, transparent: true, compose: logoOnly },
  { name: "workshop_header", w: 948, h: 203, compose: workshopHeader },
  { name: "community_icon", w: 184, h: 184, compose: (w, h) => iconBadge(w, h, true) },
  { name: "shortcut_256", w: 256, h: 256, transparent: true, compose: (w, h) => iconBadge(w, h, false) },
  { name: "shortcut_512", w: 512, h: 512, transparent: true, compose: (w, h) => iconBadge(w, h, false) },
  // Tauri 应用图标源图(1024 透明无框鸭头);`tauri icon` 从它重生成全套嵌入 exe。
  { name: "app_icon_src", w: 1024, h: 1024, transparent: true, compose: (w, h) => iconBadge(w, h, false) },
  // 托盘图标源图(512 透明,只裁头部、不含身体/手臂);→ tray-duck.png / .ico。
  { name: "tray_head_src", w: 512, h: 512, transparent: true, compose: (w, h) => trayHead(w, h) },
];

/** 只裁鸭头(冠→喙下沿,切掉手臂):窗口 sprite 坐标 x∈[59,193]、y∈[44,178](134 方窗)。 */
function trayHead(w: number, h: number): string {
  const win = 134;
  const s = w / win;
  const x = -59 * s;
  const y = -44 * s;
  return nestSvg(renderSpeciesSvg("guluduck", "idle", config), x, y, 256 * s);
}

function renderTarget(t: Target): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t.w}" height="${t.h}" viewBox="0 0 ${t.w} ${t.h}">${DEFS}${t.compose(t.w, t.h)}</svg>`;
  const rendered = new Resvg(svg, { fitTo: { mode: "width", value: t.w } }).render();
  if (rendered.height !== t.h) throw new Error(`${t.name}: 渲染高度 ${rendered.height} ≠ ${t.h}`);
  return Buffer.from(rendered.asPng());
}

mkdirSync(outDir, { recursive: true });
const failures: string[] = [];
for (const t of TARGETS) {
  if (only && !only.has(t.name)) continue;
  try {
    const png = renderTarget(t);
    writeFileSync(join(outDir, `${t.name}.png`), png);
    console.log(`${t.name}.png  ${t.w}x${t.h}  ${(png.length / 1024).toFixed(0)}KB`);
  } catch (error) {
    failures.push(`${t.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 多尺寸 ICO(快捷方式图标)。
if (!only || only.has("ico")) {
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngs = sizes.map((s) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${DEFS}${iconBadge(s, s, false)}</svg>`;
    return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: s } }).render().asPng());
  });
  const ico = await pngToIco(pngs);
  writeFileSync(join(outDir, "gulugulu.ico"), ico);
  console.log(`gulugulu.ico  (${sizes.join("/")})  ${(ico.length / 1024).toFixed(0)}KB`);
}

// 托盘图标(只鸭头):直接写入 src-tauri/icons/tray-duck.png + .ico(多尺寸)。
if (!only || only.has("tray")) {
  const trayDir = join(scriptDir, "..", "src-tauri", "icons");
  const renderTray = (s: number) =>
    Buffer.from(
      new Resvg(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">${DEFS}${trayHead(s, s)}</svg>`,
        { fitTo: { mode: "width", value: s } },
      )
        .render()
        .asPng(),
    );
  writeFileSync(join(trayDir, "tray-duck.png"), renderTray(256));
  const trayIco = await pngToIco([16, 24, 32, 48, 64, 128, 256].map(renderTray));
  writeFileSync(join(trayDir, "tray-duck.ico"), trayIco);
  console.log(`tray-duck.png (256) + tray-duck.ico → src-tauri/icons/`);
}

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL ${f}`);
  process.exitCode = 1;
}
