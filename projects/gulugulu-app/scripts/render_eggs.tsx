// 蛋美术验收：把 EggSvg 离线渲染成 contact sheet PNG。
//   主表：6 元素(行) × 6 品阶(列)，phase=idle，看逐阶华丽度阶梯与元素表达。
//   附带：孵化/就绪/神秘/多元素 几个状态样例。
// 用法（在 projects/gulugulu-app 下）：npx --yes tsx scripts/render_eggs.tsx [outDir]
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Resvg } from "@resvg/resvg-js";
import { EggSvg } from "../src/sprites/eggArt";
import rawConfig from "../src/game/config.json";
import type { GameConfig } from "../src/types";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ? resolve(process.argv[2]) : join(scriptDir, "..", "..", "..", "assets", "egg_review");
const config = rawConfig as unknown as GameConfig;

const ELEMENTS = ["normal", "fire", "water", "grass", "electric", "ice"];
const TIERS = [1, 2, 3, 4, 5, 6];
const baseSpecies = (el: string) => config.speciesByRecipe?.[el] ?? "guluduck";

// 找一只 6 元素、一只 5 元素真实物种做多色宝石样例
const byCount = (n: number) =>
  Object.entries(config.species).find(([, s]) => (s.elements?.length ?? 0) === n)?.[0];

type Cell = { species: string; tier: number; phase?: "idle" | "incubating" | "ready"; progress?: number; secondsLeft?: number; mystery?: boolean; label: string };

function renderEgg(cell: Cell, uid: number): string {
  let svg = renderToStaticMarkup(
    createElement(EggSvg, {
      species: cell.species,
      tier: cell.tier,
      config,
      phase: cell.phase ?? "idle",
      progress: cell.progress,
      secondsLeft: cell.secondsLeft,
      mystery: cell.mystery,
    }),
  );
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  // clip id 去重（renderToStaticMarkup 每次重置 useId 计数 → 各 cell 撞同名）
  svg = svg.replace(/egg-clip-[A-Za-z0-9_-]+/g, `egg-clip-c${uid}`);
  return svg;
}

const CELL = 132;
const HEAD = 34;
const PAD = 6;

function sheet(rows: Array<{ label: string; cells: Cell[] }>, cols: number, title: string): string {
  const width = PAD * 2 + 70 + cols * CELL;
  const height = PAD * 2 + HEAD + rows.length * CELL;
  const parts: string[] = [
    `<rect width="${width}" height="${height}" fill="#FBF3E0"/>`,
    `<text x="${PAD + 8}" y="${PAD + 22}" font-size="20" font-weight="800" font-family="Segoe UI, Microsoft YaHei, sans-serif" fill="#3B2B1D">${title}</text>`,
  ];
  // 列头（品阶）
  for (let c = 0; c < cols; c++) {
    parts.push(
      `<text x="${PAD + 70 + c * CELL + CELL / 2}" y="${PAD + HEAD - 4}" text-anchor="middle" font-size="14" font-weight="700" font-family="Segoe UI, sans-serif" fill="#7A5A32">${cols === TIERS.length ? `T${TIERS[c]}` : ""}</text>`,
    );
  }
  let uid = 0;
  rows.forEach((row, r) => {
    const y = PAD + HEAD + r * CELL;
    parts.push(
      `<text x="${PAD + 6}" y="${y + CELL / 2}" font-size="13" font-weight="700" font-family="Segoe UI, Microsoft YaHei, sans-serif" fill="#3B2B1D">${row.label}</text>`,
    );
    row.cells.forEach((cell, c) => {
      const x = PAD + 70 + c * CELL;
      let inner = renderEgg(cell, uid++);
      inner = inner.replace(/^<svg /, `<svg x="${x + 2}" y="${y + 2}" width="128" height="128" `);
      parts.push(inner);
      parts.push(
        `<text x="${x + CELL / 2}" y="${y + CELL - 6}" text-anchor="middle" font-size="11" font-family="Segoe UI, Microsoft YaHei, sans-serif" fill="#7A5A32">${cell.label}</text>`,
      );
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join("")}</svg>`;
}

mkdirSync(outDir, { recursive: true });

// 主表：元素 × 品阶
const gridRows = ELEMENTS.map((el) => ({
  label: `${config.elements?.[el]?.nameZh ?? el}`,
  cells: TIERS.map((t) => ({ species: baseSpecies(el), tier: t, phase: "idle" as const, label: "" })),
}));
const mainSvg = sheet(gridRows, TIERS.length, "分阶蛋 · 元素(行) × 品阶(列)");
const mainW = PAD * 2 + 70 + TIERS.length * CELL;
writeFileSync(join(outDir, "eggs_grid.png"), new Resvg(mainSvg, { fitTo: { mode: "width", value: mainW } }).render().asPng());
// 小尺寸可读性检查（后院孵化坑里蛋只有 ~48px）
writeFileSync(join(outDir, "eggs_grid_small.png"), new Resvg(mainSvg, { fitTo: { mode: "width", value: Math.round(mainW * 0.45) } }).render().asPng());
writeFileSync(join(outDir, "eggs_grid.svg"), mainSvg);

// 附表：状态样例
const six = byCount(6) ?? "emberfox";
const five = byCount(5) ?? "emberfox";
const stateRows = [
  {
    label: "状态",
    cells: [
      { species: "emberfox", tier: 4, phase: "incubating" as const, progress: 0.55, label: "孵化中·裂纹" },
      { species: "emberfox", tier: 6, phase: "ready" as const, progress: 1, secondsLeft: 0, label: "就绪·辉光" },
      { species: "emberfox", tier: 6, phase: "incubating" as const, progress: 0.4, mystery: true, label: "神秘·融合" },
      { species: five, tier: 5, phase: "idle" as const, label: `${config.species[five]?.nameZh ?? five}·5元素` },
      { species: six, tier: 6, phase: "idle" as const, label: `${config.species[six]?.nameZh ?? six}·6元素` },
    ],
  },
];
const stateSvg = sheet(stateRows, 5, "状态样例（裂纹 / 辉光 / 神秘 / 多元素徽记）");
writeFileSync(join(outDir, "eggs_states.png"), new Resvg(stateSvg, { fitTo: { mode: "width", value: PAD * 2 + 70 + 5 * CELL } }).render().asPng());

console.log(`egg sheets -> ${outDir}`);
