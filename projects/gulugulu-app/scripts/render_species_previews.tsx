// 离线渲染自定义物种的创意工坊设定图 PNG（应用内 useSpeciesPreviews 的离线等价物，
// 供 webview 不可用/批量补渲场景）。从真实存档读 customSpecies，输出到应用数据目录的
// species-previews/，Rust 端预览补挂扫描（spawn_workshop_backfill）下次启动即取用。
//
// 用法（gulugulu-app 下；resvg 一次性安装：npm install --no-save @resvg/resvg-js）：
//   npx tsx scripts/render_species_previews.tsx [savePath] [outDir]
// 缺省 savePath = %APPDATA%/com.gulugulu.pet/gulugulu-save.json，
// 缺省 outDir   = %APPDATA%/com.gulugulu.pet/species-previews
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Resvg } from "@resvg/resvg-js";
import { SvgSprite } from "../src/sprites/SvgSprite";
import { registerCustomSpecies } from "../src/sprites/customSpecies";
import type { CustomSpeciesEntry, GameConfig } from "../src/types";

const appData = process.env.APPDATA ?? "";
const [, , savePath = join(appData, "com.gulugulu.pet", "gulugulu-save.json"), outDir = join(appData, "com.gulugulu.pet", "species-previews")] =
  process.argv;

/** 与应用内 speciesPreview.ts 保持一致的输出边长。 */
const PREVIEW_SIZE = 512;

const save = JSON.parse(readFileSync(savePath, "utf8")) as {
  customSpecies?: Record<string, CustomSpeciesEntry>;
};
const customSpecies = save.customSpecies ?? {};
const codenames = Object.keys(customSpecies).sort();
if (codenames.length === 0) {
  console.log("存档里没有自定义物种，无事可做");
  process.exit(0);
}

registerCustomSpecies(customSpecies);
const configSpecies: Record<string, unknown> = {};
for (const codename of codenames) {
  configSpecies[codename] = customSpecies[codename].info;
}
const config = { species: configSpecies, fusionTable: {} } as unknown as GameConfig;

mkdirSync(outDir, { recursive: true });
let ok = 0;
for (const codename of codenames) {
  let svg = renderToStaticMarkup(h(SvgSprite, { species: codename, config, petState: "idle" }));
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
  const png = new Resvg(svg, { fitTo: { mode: "width", value: PREVIEW_SIZE } }).render().asPng();
  if (png.length < 1024) throw new Error(`${codename}: suspiciously small png (${png.length} bytes)`);
  writeFileSync(join(outDir, `${codename}.png`), png);
  console.log(`${codename}.png  ${png.length} bytes`);
  ok += 1;
}
console.log(`rendered ${ok}/${codenames.length} previews to ${outDir}`);
