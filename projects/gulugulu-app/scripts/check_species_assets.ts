// 融合 2.0 species2 资产硬门禁（SpeciesArtSpec §6）。任何失败 exit 1。
// 校验：包完整性 / 元素集合规范 / codename 规范 / 唯一性 / Part 契约 /
// Part 无 transform / defs 禁用 / 工具锚-发射点距离 / 节点预算 / 渲染冒烟 /
// 栅格实测：画面利用率（内容包围盒）+ 边缘裁切检测。
// 用法（在 projects/gulugulu-app 下）：npx --yes tsx scripts/check_species_assets.ts [--bbox]
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Resvg } from "@resvg/resvg-js";
import { SvgSprite } from "../src/sprites/SvgSprite";
import { PACKS } from "../src/sprites/species2";
import rawConfig from "../src/game/config.json";
import type { GameConfig, PetState, SpeciesInfo } from "../src/types";

const showBbox = process.argv.includes("--bbox");

const ELEMENTS = ["electric", "fire", "grass", "ice", "normal", "water"];
const ELEMENT_COLORS: Record<string, string> = {
  normal: "#6E6E78", fire: "#E85D3A", electric: "#FFD93B",
  water: "#2E7BD6", grass: "#57B84C", ice: "#8FD8E8",
};
const FORBIDDEN = new Set([
  "guluswan", "infernofox", "thunderking", "tidefrog", "mycobeast", "glacierpeng",
  "blazeduck", "sparkduck", "rippleduck", "mossduck", "frostduck", "plasmatanuki",
  "steamander", "cinderleaf", "thermowolf", "stormeel", "vinevolt", "auroramink",
  "lotusturtle", "floeseal", "frostbunny",
  "guluduck", "emberfox", "voltmouse", "bubblefrog", "sproutcap", "frostpeng",
]);
// 预算含装配器共享开销（影子/粒子层/food 等 ≈35 节点）
const NODE_BUDGET: Record<number, number> = { 2: 165, 3: 205, 4: 255, 5: 305, 6: 380 };

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

const errs: string[] = [];
const setKeys = new Map<string, string>();
const names = new Map<string, string>();
const bboxRows: Array<{ code: string; w: number; h: number; top: number; left: number; right: number }> = [];
const animPending: string[] = [];

/** 删除 class 含指定类名的整个 <g>…</g> 子树（嵌套安全；供裁切测量剥层用）。 */
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

/** 栅格化 idle 帧（剥掉影子/粒子/工具/光圈），实测内容包围盒与边缘裁切。 */
function measureBBox(code: string): { w: number; h: number; top: number; left: number; right: number; cropped: string[] } | null {
  let svg = renderToStaticMarkup(createElement(SvgSprite, { species: code, config, petState: "idle" }));
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  svg = svg.replace(/<ellipse class="sprite-shadow"[^>]*\/>/, "");
  for (const cls of ["sprite-fx", "part-tool", "sprite-grade-halo"]) svg = stripGroups(svg, cls);
  const img = new Resvg(svg, { fitTo: { mode: "width", value: 256 } }).render();
  const px = img.pixels;
  let minX = 256, maxX = -1, minY = 256, maxY = -1;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      if (px[(y * 256 + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const cropped: string[] = [];
  if (minX <= 0) cropped.push("左");
  if (maxX >= 255) cropped.push("右");
  if (minY <= 0) cropped.push("上");
  if (maxY >= 255) cropped.push("下");
  return { w: maxX - minX + 1, h: maxY - minY + 1, top: minY, left: minX, right: 255 - maxX, cropped };
}

for (const [code, pack] of Object.entries(PACKS)) {
  const ctx = (msg: string) => errs.push(`[${code}] ${msg}`);

  // ---- codename / 元素集合 / 唯一性 ----
  if (!/^[a-z]{3,16}$/.test(code)) ctx(`codename 不合规: ${code}`);
  if (FORBIDDEN.has(code)) ctx(`codename 复用废弃名/一阶名`);
  if (code.startsWith("aif")) ctx(`codename 撞 aif 前缀`);
  const els = pack.meta.elements;
  const sorted = [...new Set(els)].sort();
  if (JSON.stringify(els) !== JSON.stringify(sorted)) ctx(`elements 未去重/未按字典序: ${els.join("+")}`);
  for (const e of els) if (!ELEMENTS.includes(e)) ctx(`未知元素 ${e}`);
  if (els.length < 2 || els.length > 6) ctx(`元素数 ${els.length} 超界`);
  const key = sorted.join("+");
  if (setKeys.has(key)) ctx(`配方键与 ${setKeys.get(key)} 重复: ${key}`);
  setKeys.set(key, code);
  if (names.has(pack.meta.nameZh)) ctx(`中文名与 ${names.get(pack.meta.nameZh)} 重复`);
  names.set(pack.meta.nameZh, code);

  // ---- 包完整性 ----
  if (!pack.rig) ctx("缺 rig");
  if (!pack.tool) ctx("缺 tool");
  if (!pack.workFx) ctx("缺 workFx");
  if (!pack.visual?.palette) ctx("缺 visual.palette");
  const s = pack.visual.scale;
  if (s < 1 || s > 1.3) ctx(`scale ${s} 超出 1.0~1.3（构图为主，scale 只做提档）`);
  const { emitter } = pack.workFx;
  // 工具随 rig 缩放：锚点按 scale 围绕 (128,233) 换算后再比距离
  const anchor = {
    x: 128 + (pack.meta.toolAnchor.x - 128) * s,
    y: 233 + (pack.meta.toolAnchor.y - 233) * s,
  };
  const dist = Math.hypot(emitter.x - anchor.x, emitter.y - anchor.y);
  if (dist > 60) ctx(`workFx.emitter 距 toolAnchor(缩放后) ${dist.toFixed(0)}px > 60px`);
  if (emitter.x < 8 || emitter.x > 266 || emitter.y < 8 || emitter.y > 240) ctx(`emitter 出界`);
  if (pack.workFx.shapes.length < 2 || pack.workFx.shapes.length > 3) ctx(`粒子形状数 ${pack.workFx.shapes.length}（应 2~3）`);
  const fa = pack.visual.foodAnchor;
  if (!fa || fa.x < 60 || fa.x > 210 || fa.y < 60 || fa.y > 226) ctx(`foodAnchor 缺失或出界`);
  const budget = NODE_BUDGET[els.length] ?? 340;

  // ---- 渲染冒烟 + Part 契约 lint ----
  for (const state of ["idle", "working", "moving", "sleeping"] as PetState[]) {
    let svg = "";
    try {
      svg = renderToStaticMarkup(createElement(SvgSprite, { species: code, config, petState: state }));
    } catch (error) {
      ctx(`${state} 渲染抛错: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (svg.length < 500) ctx(`${state} 渲染疑似为空`);
    if (state === "working") {
      const required = ["part-body", "part-tail", "part-headtop", "part-armL", "part-armR", "part-face", "part-tool"];
      if (!pack.visual.floating) required.push("part-legL", "part-legR");
      for (const cls of required) {
        if (!svg.includes(`"${cls}"`) && !svg.includes(`${cls} `) && !svg.includes(` ${cls}"`) && !svg.includes(`"${cls} `)) {
          if (!svg.includes(cls)) ctx(`working 渲染缺 ${cls}`);
        }
      }
      // Part 元素自身不得带 transform（两种属性顺序都查）
      if (/class="part-[a-zA-Z]+"[^>]*\stransform=/.test(svg) || /transform="[^"]*"[^>]*class="part-[a-zA-Z]+"/.test(svg)) {
        ctx(`存在带 transform 的 Part 元素（应移到外层 <g>）`);
      }
      if (svg.includes("<defs") || svg.includes("Gradient")) ctx(`使用了 defs/渐变（禁用）`);
      const tags = (svg.match(/<[a-zA-Z]/g) ?? []).length;
      if (tags > budget) ctx(`节点数 ${tags} 超预算 ${budget}（e${els.length}）`);
    }
  }

  // ---- P3 动画完成度：Side/Lie 是否仍以 Front 兜底 ----
  try {
    const rigProps = { stage: "kid", palette: pack.visual.palette, eyes: pack.visual.eyes, expression: "sleep" } as const;
    const standM = renderToStaticMarkup(createElement(pack.rig as never, { ...rigProps, view: "front", pose: "stand" } as never));
    const lieM = renderToStaticMarkup(createElement(pack.rig as never, { ...rigProps, view: "front", pose: "lie" } as never));
    const sideM = renderToStaticMarkup(createElement(pack.rig as never, { ...rigProps, view: "side", pose: "stand", expression: "normal" } as never));
    const standN = renderToStaticMarkup(createElement(pack.rig as never, { ...rigProps, view: "front", pose: "stand", expression: "normal" } as never));
    const missing: string[] = [];
    if (lieM === standM) missing.push("Lie");
    if (sideM === standN) missing.push("Side");
    if (missing.length > 0) animPending.push(`${code}(${missing.join("+")})`);
  } catch (error) {
    ctx(`Side/Lie 探测抛错: ${error instanceof Error ? error.message : String(error)}`);
  }

  // ---- 栅格实测：裁切 + 画面利用率 ----
  try {
    const bb = measureBBox(code);
    if (!bb) {
      ctx("栅格实测为空");
    } else {
      if (bb.cropped.length > 0) ctx(`内容被画布裁切（${bb.cropped.join("/")}边出界）`);
      if (Math.max(bb.w, bb.h) < 150) ctx(`画面利用率过低：内容 ${bb.w}×${bb.h}（长边应 ≥150，目标 ≥170）`);
      bboxRows.push({ code, w: bb.w, h: bb.h, top: bb.top, left: bb.left, right: bb.right });
    }
  } catch (error) {
    ctx(`栅格实测抛错: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const byCount = [2, 3, 4, 5, 6].map((n) => `e${n}:${Object.values(PACKS).filter((p) => p.meta.elements.length === n).length}`);
console.log(`packs: ${Object.keys(PACKS).length} (${byCount.join(" ")}) / 目标 e2:15 e3:20 e4:15 e5:6 e6:1`);
const total = Object.keys(PACKS).length;
console.log(`P3 动画（Side+Lie）完成度: ${total - animPending.length}/${total}${animPending.length > 0 ? ` · 待补: ${animPending.join(" ")}` : " ✅"}`);
if (process.argv.includes("--strict-anim") && animPending.length > 0) {
  errs.push(`--strict-anim：${animPending.length} 只物种 Side/Lie 未实现`);
}
if (showBbox) {
  const sorted = [...bboxRows].sort((a, b) => Math.max(a.w, a.h) - Math.max(b.w, b.h));
  console.log("code            w    h    top  left right  (idle 实测，剥影子/工具/粒子)");
  for (const r of sorted) {
    console.log(`${r.code.padEnd(14)} ${String(r.w).padStart(4)} ${String(r.h).padStart(4)} ${String(r.top).padStart(4)} ${String(r.left).padStart(5)} ${String(r.right).padStart(5)}`);
  }
}
if (errs.length > 0) {
  for (const e of errs) console.error(`FAIL ${e}`);
  process.exitCode = 1;
} else {
  console.log("✅ check_species_assets 全部通过");
}
