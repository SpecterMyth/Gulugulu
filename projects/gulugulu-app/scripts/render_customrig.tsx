// 开发用：验证"数据驱动专属 rig"(rig="custom") 的完整形态 —— 手搓一只三视图
// (front/side/lie) 的 CustomRig，走完整 SvgSprite 装配 + resvg 渲染，覆盖多状态表情，
// 并单独展示专属打工粒子。用法：npx tsx scripts/render_customrig.tsx <outDir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SvgSprite } from "../src/sprites/SvgSprite";
import { getCustomWorkFx, registerCustomSpecies, renderWorkFxParticle } from "../src/sprites/customSpecies";
import type { CustomRig, CustomSpeciesEntry, GameConfig, PetState } from "../src/types";

const outDir = process.argv[2] ?? "customrig";
mkdirSync(outDir, { recursive: true });
const O = "$outline";

// 晶甲龟：龟壳剪影(6 个底座都没有的形体) + 大萌头 + 壳上宝石(元素越多越华丽) + 三视图。
const turtle: CustomRig = {
  front: {
    bodyY: 196,
    body: [
      { type: "path", d: "M-56 16 Q-58 -36 0 -42 Q58 -36 56 16 Q56 21 47 21 L-47 21 Q-56 21 -56 16 Z", fill: "$body", stroke: O, strokeWidth: 6, strokeLinejoin: "round" },
      { type: "path", d: "M0 -42 L0 18 M-30 -36 Q-36 -10 -30 19 M30 -36 Q36 -10 30 19 M-52 -2 Q0 -12 52 -2", fill: "none", stroke: "$deep", strokeWidth: 3 },
      { type: "ellipse", cx: -42, cy: 22, rx: 12, ry: 7, fill: "$deep", stroke: O, strokeWidth: 4 },
      { type: "ellipse", cx: 42, cy: 22, rx: 12, ry: 7, fill: "$deep", stroke: O, strokeWidth: 4 },
    ],
    belly: [{ type: "ellipse", cx: 0, cy: 18, rx: 44, ry: 8, fill: "$belly" }],
    headY: 126,
    head: [
      { type: "circle", cx: 0, cy: 0, r: 39, fill: "$body", stroke: O, strokeWidth: 6 },
      { type: "ellipse", cx: 0, cy: 14, rx: 17, ry: 12, fill: "$belly" },
    ],
    face: { eyeR: 11, eyeDx: 16, eyeDy: -2, mouthDy: 16, mouthW: 12 },
    legY: 222,
    legSpread: 26,
    legL: [{ type: "ellipse", cx: 0, cy: 2, rx: 12, ry: 7, fill: "$deep", stroke: O, strokeWidth: 4 }],
    legR: [{ type: "ellipse", cx: 0, cy: 2, rx: 12, ry: 7, fill: "$deep", stroke: O, strokeWidth: 4 }],
    tailAt: { x: 128, y: 214, rot: 0 },
    tail: [{ type: "path", d: "M0 0 q-7 5 0 12 q7 -5 0 -12 z", fill: "$deep", stroke: O, strokeWidth: 3 }],
    decor: [
      { type: "circle", cx: 128, cy: 176, r: 6.5, fill: "$accent", stroke: O, strokeWidth: 2 },
      { type: "circle", cx: 106, cy: 190, r: 4.5, fill: "$accent2", stroke: O, strokeWidth: 2 },
      { type: "circle", cx: 150, cy: 190, r: 4.5, fill: "$accent2", stroke: O, strokeWidth: 2 },
      { type: "path", d: "M112 98 l6 -13 l10 9 l10 -9 l6 13 z", fill: "$accent", stroke: O, strokeWidth: 3, strokeLinejoin: "round" },
    ],
    toolAt: { x: 192, y: 233 },
  },
  side: {
    bodyY: 196,
    headX: 154,
    body: [
      { type: "path", d: "M-50 16 Q-56 -34 8 -40 Q54 -32 50 16 Q50 21 42 21 L-42 21 Q-50 21 -50 16 Z", fill: "$body", stroke: O, strokeWidth: 6, strokeLinejoin: "round" },
      { type: "path", d: "M-40 -6 Q8 -18 46 -4 M8 -40 L8 18 M-22 -34 Q-28 -8 -22 19", fill: "none", stroke: "$deep", strokeWidth: 3 },
      { type: "ellipse", cx: -28, cy: 22, rx: 11, ry: 7, fill: "$deep", stroke: O, strokeWidth: 4, opacity: 0.92 },
    ],
    belly: [{ type: "ellipse", cx: 2, cy: 18, rx: 40, ry: 8, fill: "$belly" }],
    headY: 140,
    head: [
      { type: "circle", cx: 0, cy: 0, r: 34, fill: "$body", stroke: O, strokeWidth: 6 },
      { type: "ellipse", cx: 21, cy: 9, rx: 15, ry: 11, fill: "$belly", stroke: O, strokeWidth: 4 },
      { type: "circle", cx: 31, cy: 5, r: 2.6, fill: "#3B2B1D" },
    ],
    face: { eyeR: 10, eyeCx: 6, eyeDy: -4, mouthDx: 22, mouthDy: 9, mouthW: 9 },
    legY: 222,
    legSpread: 30,
    legL: [{ type: "ellipse", cx: 0, cy: 2, rx: 11, ry: 7, fill: "$deep", stroke: O, strokeWidth: 4 }],
    legR: [{ type: "ellipse", cx: 0, cy: 2, rx: 12, ry: 7, fill: "$deep", stroke: O, strokeWidth: 4 }],
    tailAt: { x: 80, y: 208, rot: 0 },
    tail: [{ type: "path", d: "M0 0 q-11 2 -13 9 q11 0 13 -9 z", fill: "$deep", stroke: O, strokeWidth: 3 }],
    decor: [
      { type: "circle", cx: 118, cy: 172, r: 6.5, fill: "$accent", stroke: O, strokeWidth: 2 },
      { type: "path", d: "M140 114 l5 -12 l9 8 l9 -8 l5 12 z", fill: "$accent", stroke: O, strokeWidth: 3, strokeLinejoin: "round" },
    ],
    toolAt: { x: 198, y: 233 },
  },
  lie: {
    bodyY: 210,
    headX: 94,
    body: [
      { type: "path", d: "M-58 10 Q-60 -22 0 -28 Q60 -22 58 10 Q58 15 50 15 L-50 15 Q-58 15 -58 10 Z", fill: "$body", stroke: O, strokeWidth: 6, strokeLinejoin: "round" },
      { type: "path", d: "M0 -28 L0 12 M-32 -22 Q-38 -4 -32 13 M32 -22 Q38 -4 32 13", fill: "none", stroke: "$deep", strokeWidth: 3 },
    ],
    belly: [{ type: "ellipse", cx: 0, cy: 12, rx: 48, ry: 7, fill: "$belly" }],
    headY: 206,
    head: [
      { type: "circle", cx: 0, cy: 0, r: 30, fill: "$body", stroke: O, strokeWidth: 6 },
      { type: "ellipse", cx: 0, cy: 10, rx: 13, ry: 9, fill: "$belly" },
    ],
    face: { eyeR: 10, eyeDx: 13, eyeDy: -1, mouthDy: 12, mouthW: 9 },
    legY: 224,
    legSpread: 42,
    legL: [{ type: "ellipse", cx: 0, cy: 0, rx: 9, ry: 5, fill: "$deep", stroke: O, strokeWidth: 4 }],
    legR: [{ type: "ellipse", cx: 0, cy: 0, rx: 9, ry: 5, fill: "$deep", stroke: O, strokeWidth: 4 }],
    decor: [{ type: "circle", cx: 128, cy: 192, r: 5.5, fill: "$accent", stroke: O, strokeWidth: 2 }],
  },
};

// 专属打工粒子 = 打工工具的真实产物（准则六）：工具是洒水壶 → 粒子就是喷出的水。
// 大水滴 / 小水滴 / 落地水花，全是水，一眼看出是洒水壶喷的。
const workFx = {
  particles: [
    { nodes: [
      { type: "path" as const, d: "M0 -9 C6 -1 8 4 8 7 A8 8 0 1 1 -8 7 C-8 4 -6 -1 0 -9 Z", fill: "#7FCBE6", stroke: O, strokeWidth: 2 },
      { type: "ellipse" as const, cx: -2.5, cy: 3, rx: 2, ry: 3, fill: "#EAF7FF", opacity: 0.9 },
    ] },
    { nodes: [{ type: "path" as const, d: "M0 -6 C4 -1 5 2 5 4 A5 5 0 1 1 -5 4 C-5 2 -4 -1 0 -6 Z", fill: "#A6DCEF", stroke: O, strokeWidth: 1.8 }] },
    { nodes: [
      { type: "path" as const, d: "M-8 4 Q-4 -6 0 4 Q4 -6 8 4", fill: "none", stroke: "#7FCBE6", strokeWidth: 2.4, strokeLinecap: "round" },
      { type: "circle" as const, cx: -9, cy: -2, r: 1.8, fill: "#A6DCEF" },
      { type: "circle" as const, cx: 9, cy: -3, r: 1.6, fill: "#A6DCEF" },
    ] },
  ],
};

const palette = { body: "#5FBF8F", deep: "#3C8F66", belly: "#F3FBF3", accent: "#FFC24A", accent2: "#E86A8E" };
const info = { nameZh: "晶甲龟", tier: 2, elements: ["grass", "water"], colors: [palette.body, palette.accent], body: "custom", desc: "三视图专属 rig 验证", steamItemDef: 0 };
const species: Record<string, CustomSpeciesEntry> = {
  turtle: { info, visual: { rig: "custom", scale: 1.1, palette, eyes: "round", toolId: "wateringCan", floating: false, slots: {}, customRig: turtle, workFx } } as unknown as CustomSpeciesEntry,
};
registerCustomSpecies(species);
const config = { species: { turtle: info }, fusionTable: {} } as unknown as GameConfig;

const STATES: PetState[] = ["idle", "moving", "working", "success", "fed", "thinking", "error", "sleeping"];
const CELL = 200, LABEL = 20, cols = 4;
const cells: string[] = [];
STATES.forEach((state, i) => {
  let svg = renderToStaticMarkup(h(SvgSprite, { species: "turtle", config, petState: state, tier: 2 }));
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  writeFileSync(join(outDir, `turtle__${state}.svg`), svg);
  const x = (i % cols) * CELL, y = Math.floor(i / cols) * (CELL + LABEL);
  const inner = svg.replace("<svg ", `<svg x="${x}" y="${y + LABEL}" width="${CELL}" height="${CELL}" `);
  cells.push(`<rect x="${x}" y="${y}" width="${CELL}" height="${CELL + LABEL}" fill="none" stroke="#ddd"/><text x="${x + 8}" y="${y + 14}" font-family="sans-serif" font-size="12" fill="#333">晶甲龟 · ${state}</text>${inner}`);
});
// 打工粒子展示行
const fx = getCustomWorkFx("turtle");
const fxCells: string[] = [];
if (fx) {
  fx.particles.forEach((nodes, i) => {
    const g = renderToStaticMarkup(renderWorkFxParticle(nodes, fx.palette));
    const cell = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 40 40" x="${i * 60}" y="0" width="56" height="56">${g}</svg>`;
    fxCells.push(`<rect x="${i * 60}" y="0" width="56" height="56" fill="#fff" stroke="#ddd"/>${cell}`);
    // 单独存一份（供 showcase 页嵌入）
    writeFileSync(join(outDir, `turtle__fx${i}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 40 40">${g}</svg>`);
  });
}
const rows = Math.ceil(STATES.length / cols);
const W = cols * CELL, H = rows * (CELL + LABEL);
const fxRow = `<g transform="translate(8 ${H + 6})"><text x="0" y="0" font-family="sans-serif" font-size="12" fill="#333">专属打工粒子：</text><g transform="translate(0 12)">${fxCells.join("")}</g></g>`;
writeFileSync(join(outDir, "_contact.svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 80}" viewBox="0 0 ${W} ${H + 80}"><rect width="${W}" height="${H + 80}" fill="#F4EFE6"/>${cells.join("")}${fxRow}</svg>`);

const front = readFileSync(join(outDir, "turtle__idle.svg"), "utf8");
const parts = ["part-legL", "part-legR", "part-tail", "part-headtop", "part-face", "part-tool"];
console.log("front part classes:", parts.filter((p) => front.includes(p)).join(", ") || "NONE");
const side = readFileSync(join(outDir, "turtle__moving.svg"), "utf8");
console.log("moving uses side view:", side.includes("part-face") ? "rendered" : "no");
console.log("done");
