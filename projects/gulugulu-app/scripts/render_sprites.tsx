// 开发用：把 SvgSprite 离线渲染成静态 .svg（配合 resvg 转 PNG 做视觉验收）。
// 用法：npx --yes tsx scripts/render_sprites.tsx <outDir> [speciesCsv|all] [statesCsv]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SvgSprite } from "../src/sprites/SvgSprite";
import rawConfig from "../src/game/config.json";
import type { GameConfig, PetState } from "../src/types";

const config = rawConfig as unknown as GameConfig;
const [, , outDir = "sprite-snapshots", speciesArg = "all", statesArg = "idle,moving,working"] =
  process.argv;

mkdirSync(outDir, { recursive: true });
const speciesList = speciesArg === "all" ? Object.keys(config.species) : speciesArg.split(",");
const states = statesArg.split(",") as PetState[];

let count = 0;
for (const species of speciesList) {
  for (const state of states) {
    let svg = renderToStaticMarkup(
      createElement(SvgSprite, { species, config, petState: state }),
    );
    if (!svg.includes("xmlns=")) {
      svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
    }
    writeFileSync(join(outDir, `${species}__${state}.svg`), svg);
    count += 1;
  }
}
console.log(`rendered ${count} svg files to ${outDir}`);
