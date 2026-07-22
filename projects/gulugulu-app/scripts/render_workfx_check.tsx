// 打工特效重设计验收：把 27 件目录工具 + 全部一阶/融合物种 + 36 件可复用粒子目录
// (WORK_PARTICLE_CATALOG) 逐行渲染成 PNG（每行 label + 粒子），并跑 resolveWorkFx
// 解析（含 {ref}/{nodes} 联合）与「目录 id 与 fusionParts.json 对齐」断言。
// 静态渲染无 CSS，粒子不飞散——按格子摆开，专供肉眼核对"形状=职业实物产物、无元素"。
// 用法（在 projects/gulugulu-app 下）：npx --yes tsx scripts/render_workfx_check.tsx [outPng]
import { writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Resvg } from "@resvg/resvg-js";
import { TOOL_FX, WORK_FX, WORK_PARTICLE_CATALOG, resolveWorkFx, type ParticleRenderer } from "../src/sprites/parts/workFx";
import type { ResolvedWorkFx } from "../src/sprites/customSpecies";
import fusionParts from "../src/game/fusionParts.json";

const outPng = process.argv[2] ?? "workfx_check.png";
const catalogIds = (fusionParts as { workParticles: Array<{ id: string; hint: string }> }).workParticles.map((p) => p.id);

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 渲染行：目录工具产物 + 每只物种（一阶 6 + 融合 57）+ 36 件可复用粒子目录。
const rows: Array<{ label: string; shapes: ParticleRenderer[] }> = [
  ...Object.keys(TOOL_FX).map((id) => ({ label: `tool:${id}`, shapes: TOOL_FX[id].shapes })),
  ...Object.keys(WORK_FX)
    .sort()
    .map((code) => ({ label: `sp:${code}`, shapes: WORK_FX[code].shapes })),
  ...Object.keys(WORK_PARTICLE_CATALOG)
    .sort()
    .map((id) => ({ label: `cat:${id}`, shapes: [WORK_PARTICLE_CATALOG[id]] })),
];

const ROW_H = 48;
const W = 360;
const H = rows.length * ROW_H + 8;
let body = `<rect width="${W}" height="${H}" fill="#FFFFFF"/>`;
rows.forEach((r, i) => {
  const cy = i * ROW_H + ROW_H / 2 + 6;
  body += `<text x="8" y="${cy + 4}" font-size="12" font-family="Consolas, Menlo, monospace" fill="#3B2B1D">${r.label}</text>`;
  body += `<line x1="0" y1="${i * ROW_H + 6}" x2="${W}" y2="${i * ROW_H + 6}" stroke="#EEE" stroke-width="1"/>`;
  const rand = rng(1234 + i * 7);
  r.shapes.forEach((shape, j) => {
    body += renderToStaticMarkup(
      createElement("g", { transform: `translate(${168 + j * 52} ${cy}) scale(2.4)` }, shape(rand)),
    );
  });
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
writeFileSync(outPng, new Resvg(svg, { fitTo: { mode: "width", value: W * 2 }, background: "#FFFFFF" }).render().asPng());
console.log(`rendered ${rows.length} rows → ${outPng}`);

// ---- resolveWorkFx 解析 + 联合(ref/nodes) + 目录对齐 断言 ----
let failed = 0;
const check = (name: string, cond: boolean) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failed += 1;
};
const pal = { body: "#FFFFFF", deep: "#000000", belly: "#FFFFFF", accent: "#F00000", accent2: "#00F000" };

check("TOOL_FX 覆盖 27 件目录工具", Object.keys(TOOL_FX).length === 27);
check("WORK_PARTICLE_CATALOG = 36 件", Object.keys(WORK_PARTICLE_CATALOG).length === 36);
// 单一事实源对齐：前端 catalog 的 id 集必须与 fusionParts.json workParticles 完全一致
const catKeys = Object.keys(WORK_PARTICLE_CATALOG).sort();
const jsonKeys = [...catalogIds].sort();
check(
  `WORK_PARTICLE_CATALOG(${catKeys.length}) ↔ fusionParts.workParticles(${jsonKeys.length}) id 对齐`,
  catKeys.length === jsonKeys.length && catKeys.every((k, i) => k === jsonKeys[i]),
);
check("legacy/目录路径：未注册物种 + printer → TOOL_FX.printer", resolveWorkFx("zzz", "printer", null) === TOOL_FX.printer);
check("一阶 guluduck → laptop 产物", resolveWorkFx("guluduck", null, null)?.shapes === TOOL_FX.laptop.shapes);
check("手作 weldbug → 自带 bespoke workFx", resolveWorkFx("weldbug", "weldbug", null) === WORK_FX.weldbug);

const aiFallback = resolveWorkFx("aiX", "printer", { emitter: { x: 186, y: 206 }, palette: pal, particles: [] } as ResolvedWorkFx);
check(
  "AI 空粒子 + toolId → 退回 TOOL_FX.printer 产物、emitter 用 chimera 锚",
  aiFallback?.shapes.length === TOOL_FX.printer.shapes.length && aiFallback?.emitter.x === 186,
);
// 联合：自绘 {nodes}
const aiDraw = resolveWorkFx("aiY", "printer", {
  emitter: { x: 190, y: 200 },
  palette: pal,
  particles: [{ nodes: [{ type: "circle", cx: 0, cy: 0, r: 5, fill: "$accent", stroke: "$outline", strokeWidth: 2 }] }],
} as ResolvedWorkFx);
check("AI 自绘粒子 {nodes} → 用 AI 粒子（1 个）、emitter 用其自带", aiDraw?.shapes.length === 1 && aiDraw?.emitter.x === 190);
// 联合：{ref}(复用目录) + {nodes}(自绘) 混合 → 2 个渲染器
const aiMix = resolveWorkFx("aiZ", "printer", {
  emitter: { x: 188, y: 202 },
  palette: pal,
  particles: [
    { ref: catalogIds[0] },
    { nodes: [{ type: "circle", cx: 0, cy: 0, r: 4, fill: "$accent", stroke: "$outline", strokeWidth: 2 }] },
  ],
} as ResolvedWorkFx);
check("AI 联合 {ref}+{nodes} 混合 → 拼出 2 个渲染器", aiMix?.shapes.length === 2);
// 未知 ref 全丢弃 → mapped 空 → 回退该工具产物
const aiBadRef = resolveWorkFx("aiBad", "printer", {
  emitter: { x: 186, y: 206 },
  palette: pal,
  particles: [{ ref: "___nope___" }],
} as ResolvedWorkFx);
check("AI 未知 ref 丢弃 → 回退 TOOL_FX.printer", aiBadRef?.shapes.length === TOOL_FX.printer.shapes.length);

check("无工具无自定义 → null（不放空爆发）", resolveWorkFx("nope", null, null) === null);

console.log(failed === 0 ? "\n✅ 全部断言通过" : `\n❌ ${failed} 条断言失败`);
process.exit(failed === 0 ? 0 : 1);
