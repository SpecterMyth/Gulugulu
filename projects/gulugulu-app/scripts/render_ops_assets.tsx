// 运营账号注册素材离线渲染(矢量直出;头像/横幅按各平台规格)。
// 用法(在 projects/gulugulu-app 下):
//   npm install --no-save @resvg/resvg-js   # 已装可跳过
//   npx --yes tsx scripts/render_ops_assets.tsx [--only=name1,name2]
// 产物 → <repo>/assets/ops/<平台>/:X·Reddit·Discord·Product Hunt·YouTube·邮箱 的头像与横幅。
//
// 构图约定:
//   - 头像 = 满画幅鸭头(与 Steam community_icon/app 图标同款,2026-07-17 用户已审),
//     圆形裁切平台统一按 92% 视窗留出安全边;bot 头像换 Discord 蓝紫底色以示区分。
//   - 横幅 = 复用商店素材同套舞台(skyMeadow + 真实精灵 + 字标),关键内容收进各平台安全区:
//     X 避开左下角头像遮挡;YouTube 全部关键物落中央 1546×423 设备安全区。

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
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
const outRoot = join(scriptDir, "..", "..", "..", "assets", "ops");
const config = buildRenderConfig();

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice(7).split(",")) : null;

// ---------------- 调色板/公共 defs(与 render_store_assets.tsx 同源) ----------------
const C = {
  woodDark: "#6B4520",
  cream: "#FFF3D9",
  creamTitle: "#FFE9AD",
  gold: "#F7D373",
  skyTop: "#8FCFEA",
  skyBottom: "#D8F0FB",
  meadow: "#8FCB6B",
  meadowDeep: "#5FAE4C",
  hill: "#A8D97C",
  blurple: "#5865F2",
  blurpleDeep: "#3C45C6",
};

const DEFS = `<defs>
  <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${C.skyTop}"/><stop offset="100%" stop-color="${C.skyBottom}"/>
  </linearGradient>
  <linearGradient id="meadowG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${C.meadow}"/><stop offset="100%" stop-color="${C.meadowDeep}"/>
  </linearGradient>
  <linearGradient id="creamG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#FFF8E6"/><stop offset="100%" stop-color="${C.cream}"/>
  </linearGradient>
  <linearGradient id="blurpleG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${C.blurple}"/><stop offset="100%" stop-color="${C.blurpleDeep}"/>
  </linearGradient>
  <radialGradient id="glowG" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0%" stop-color="#FFF7E0" stop-opacity="0.95"/><stop offset="100%" stop-color="#FFF7E0" stop-opacity="0"/>
  </radialGradient>
</defs>`;

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

function skyMeadow(w: number, h: number, horizon = 0.66): string {
  const hy = h * horizon;
  return `<rect width="${w}" height="${h}" fill="url(#skyG)"/>
  <ellipse cx="${w * 0.22}" cy="${hy + h * 0.05}" rx="${w * 0.42}" ry="${h * 0.11}" fill="${C.hill}"/>
  <ellipse cx="${w * 0.8}" cy="${hy + h * 0.06}" rx="${w * 0.46}" ry="${h * 0.13}" fill="${C.hill}"/>
  <rect y="${hy}" width="${w}" height="${h - hy}" fill="url(#meadowG)"/>
  <ellipse cx="${w * 0.5}" cy="${hy + 2}" rx="${w * 0.62}" ry="${h * 0.045}" fill="${C.meadow}"/>`;
}

type CastEntry = { code: string; state?: PetState; size: number; cx: number; feetY: number; opacity?: number };

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

// ---------------- 头像 ----------------
/** 满画幅鸭头,视窗放大率 zoom(1=贴边;<1 留圆裁安全边)。头窗 sprite 坐标 x∈[44,212] y∈[46,214]。 */
function avatarBadge(w: number, h: number, bg: "cream" | "blurple", zoom = 0.92): string {
  const win = 168 / zoom;
  const s = w / win;
  const cx = 128;
  const cy = 130;
  const x = -(cx - win / 2) * s;
  const y = -(cy - win / 2) * s;
  const sprite = nestSvg(renderSpeciesSvg("guluduck", "idle", config), x, y, 256 * s);
  const fill = bg === "blurple" ? "url(#blurpleG)" : "url(#creamG)";
  return `<rect width="${w}" height="${h}" fill="${fill}"/>
  <ellipse cx="${w * 0.5}" cy="${h * 0.42}" rx="${w * 0.46}" ry="${h * 0.4}" fill="url(#glowG)"/>
  ${sprite}`;
}

// ---------------- 横幅 ----------------
/** X 1500×500:字标居中偏上,关键物避开左下角(资料页头像圆遮挡区 ~x<0.14,y>0.55)。 */
function bannerX(w: number, h: number): string {
  const wmW = 560;
  const wmTop = h * 0.09;
  const zhW = wmW * 0.34;
  const zhTop = wmTop + wmHeight(WORDMARK_EN, wmW) + h * 0.015;
  const cast: CastEntry[] = [
    { code: "voltmouse", size: h * 0.34, cx: w * 0.2, feetY: h * 0.9 },
    { code: "emberfox", size: h * 0.36, cx: w * 0.31, feetY: h * 0.95 },
    { code: "guluduck", state: "working", size: h * 0.52, cx: w * 0.5, feetY: h * 0.985 },
    { code: "prismkirin", size: h * 0.5, cx: w * 0.68, feetY: h * 0.96 },
    { code: "lanternloong", size: h * 0.46, cx: w * 0.84, feetY: h * 0.93 },
  ];
  const floating: CastEntry[] = [
    { code: "bubblefrog", size: h * 0.16, cx: w * 0.13, feetY: h * 0.42 },
  ];
  return `${skyMeadow(w, h, 0.66)}
  ${sun(w * 0.94, h * 0.16, h * 0.07)}
  ${cloud(w * 0.08, h * 0.18, h * 0.055)}
  ${cloud(w * 0.72, h * 0.12, h * 0.045, 0.8)}
  <ellipse cx="${w * 0.5}" cy="${h * 0.34}" rx="${w * 0.26}" ry="${h * 0.3}" fill="url(#glowG)"/>
  ${putCast(floating)}
  ${putCast(cast)}
  ${sparkle(w * 0.27, h * 0.3, h * 0.03)}
  ${sparkle(w * 0.75, h * 0.26, h * 0.035)}
  ${sparkle(w * 0.62, h * 0.18, h * 0.022, "#FFFFFF")}
  ${placeWordmark(WORDMARK_EN, w * 0.5, wmTop, wmW)}
  ${placeWordmark(WORDMARK_ZH, w * 0.5, zhTop, zhW, { strokeWidth: 9 })}`;
}

/** Reddit 资料横幅 1280×384:同舞台紧凑版。 */
function bannerReddit(w: number, h: number): string {
  const wmW = 430;
  const wmTop = h * 0.08;
  const cast: CastEntry[] = [
    { code: "emberfox", size: h * 0.42, cx: w * 0.16, feetY: h * 0.94 },
    { code: "guluduck", state: "working", size: h * 0.56, cx: w * 0.34, feetY: h * 0.99 },
    { code: "prismkirin", size: h * 0.52, cx: w * 0.66, feetY: h * 0.97 },
    { code: "frostpeng", size: h * 0.4, cx: w * 0.84, feetY: h * 0.93 },
  ];
  return `${skyMeadow(w, h, 0.64)}
  ${sun(w * 0.93, h * 0.18, h * 0.075)}
  ${cloud(w * 0.09, h * 0.2, h * 0.06)}
  <ellipse cx="${w * 0.5}" cy="${h * 0.36}" rx="${w * 0.28}" ry="${h * 0.32}" fill="url(#glowG)"/>
  ${putCast(cast)}
  ${sparkle(w * 0.52, h * 0.3, h * 0.035)}
  ${sparkle(w * 0.78, h * 0.24, h * 0.028, "#FFFFFF")}
  ${placeWordmark(WORDMARK_EN, w * 0.5, wmTop, wmW)}`;
}

/** YouTube 频道横幅 2560×1440:关键内容全部落中央设备安全区 1546×423(x 507..2053, y 508..931)。 */
function bannerYouTube(w: number, h: number): string {
  const safeTop = (h - 423) / 2;
  const safeBottom = safeTop + 423;
  const wmW = 560;
  const wmTop = safeTop + 26;
  const zhW = wmW * 0.34;
  const zhTop = wmTop + wmHeight(WORDMARK_EN, wmW) + 10;
  const feet = safeBottom - 10;
  const cast: CastEntry[] = [
    { code: "voltmouse", size: 190, cx: w * 0.5 - 460, feetY: feet - 8 },
    { code: "emberfox", size: 205, cx: w * 0.5 - 300, feetY: feet },
    { code: "guluduck", state: "working", size: 265, cx: w * 0.5, feetY: feet + 4 },
    { code: "prismkirin", size: 250, cx: w * 0.5 + 300, feetY: feet },
    { code: "lanternloong", size: 220, cx: w * 0.5 + 470, feetY: feet - 8 },
  ];
  // 地平线压在安全区下沿附近,场外区域纯天空草地延展。
  return `${skyMeadow(w, h, (feet - 60) / h)}
  ${sun(w * 0.87, h * 0.18, 70)}
  ${cloud(w * 0.12, h * 0.22, 64, 0.85)}
  ${cloud(w * 0.33, h * 0.13, 52, 0.7)}
  ${cloud(w * 0.68, h * 0.12, 58, 0.75)}
  <ellipse cx="${w * 0.5}" cy="${safeTop + 200}" rx="700" ry="260" fill="url(#glowG)"/>
  ${putCast(cast)}
  ${sparkle(w * 0.5 - 380, safeTop + 150, 26)}
  ${sparkle(w * 0.5 + 390, safeTop + 130, 30)}
  ${sparkle(w * 0.5 + 180, safeTop + 60, 20, "#FFFFFF")}
  ${placeWordmark(WORDMARK_EN, w * 0.5, wmTop, wmW)}
  ${placeWordmark(WORDMARK_ZH, w * 0.5, zhTop, zhW, { strokeWidth: 9 })}`;
}

// ---------------- 目标表 ----------------
type Target = { name: string; dir: string; w: number; h: number; compose: (w: number, h: number) => string };
const TARGETS: Target[] = [
  { name: "avatar-400", dir: "x", w: 400, h: 400, compose: (w, h) => avatarBadge(w, h, "cream") },
  { name: "banner-1500x500", dir: "x", w: 1500, h: 500, compose: bannerX },
  { name: "avatar-256", dir: "reddit", w: 256, h: 256, compose: (w, h) => avatarBadge(w, h, "cream") },
  { name: "banner-1280x384", dir: "reddit", w: 1280, h: 384, compose: bannerReddit },
  { name: "server-icon-512", dir: "discord", w: 512, h: 512, compose: (w, h) => avatarBadge(w, h, "cream") },
  { name: "bot-avatar-512", dir: "discord", w: 512, h: 512, compose: (w, h) => avatarBadge(w, h, "blurple") },
  { name: "avatar-240", dir: "producthunt", w: 240, h: 240, compose: (w, h) => avatarBadge(w, h, "cream") },
  { name: "avatar-800", dir: "youtube", w: 800, h: 800, compose: (w, h) => avatarBadge(w, h, "cream") },
  { name: "banner-2560x1440", dir: "youtube", w: 2560, h: 1440, compose: bannerYouTube },
  { name: "avatar-512", dir: "email", w: 512, h: 512, compose: (w, h) => avatarBadge(w, h, "cream") },
];

const failures: string[] = [];
for (const t of TARGETS) {
  if (only && !only.has(t.name)) continue;
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t.w}" height="${t.h}" viewBox="0 0 ${t.w} ${t.h}">${DEFS}${t.compose(t.w, t.h)}</svg>`;
    const rendered = new Resvg(svg, { fitTo: { mode: "width", value: t.w } }).render();
    if (rendered.height !== t.h) throw new Error(`渲染高度 ${rendered.height} ≠ ${t.h}`);
    const png = Buffer.from(rendered.asPng());
    const dir = join(outRoot, t.dir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${t.name}.png`), png);
    console.log(`${t.dir}/${t.name}.png  ${t.w}x${t.h}  ${(png.length / 1024).toFixed(0)}KB`);
  } catch (error) {
    failures.push(`${t.dir}/${t.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL ${f}`);
  process.exitCode = 1;
}
