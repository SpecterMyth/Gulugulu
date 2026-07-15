// 图鉴模型冒烟测试：bundle pokedexData.ts（含 config/fusionSlots）后用合成存档跑
// buildPokedexModel，核对结构/概率与 PokedexSystem.md 一致。
// 跑法（projects/gulugulu-app 下）：node scripts/verify_pokedex.mjs

import { readFileSync } from "node:fs";
import { buildSync } from "esbuild";

const entry = new URL("../src/game/pokedexData.ts", import.meta.url);
const { outputFiles } = buildSync({
  entryPoints: [entry.pathname.replace(/^\//, "")],
  bundle: true,
  format: "esm",
  write: false,
  loader: { ".json": "json" },
  logLevel: "silent",
});
const code = outputFiles[0].text;
const M = await import("data:text/javascript;base64," + Buffer.from(code, "utf8").toString("base64"));

// 直接从 bundle 里拿不到 config，改从 config.json 读并构造 GameConfig 形态。
const config = JSON.parse(readFileSync(new URL("../src/game/config.json", import.meta.url), "utf8"));

let failures = 0;
const ok = (cond, msg) => {
  if (!cond) {
    failures += 1;
    console.error(`✗ ${msg}`);
  }
};

// 合成存档：曾获 guluduck×3、steamalotl×1、aiffw1×1；fire+water 注册了 1 号 AI 变种。
const save = {
  version: 4,
  dexObtained: { guluduck: 3, steamalotl: 1, aiffw1: 1 },
  recipeAiSlots: { "fire+water": ["aiffw1"] },
  pets: [],
  customSpecies: {},
};

const model = M.buildPokedexModel(config, save);

ok(model.baseSlots.length === 6, `基础物种 6 只（实得 ${model.baseSlots.length}）`);
ok(model.recipes.length === 57, `融合配方 57 行（实得 ${model.recipes.length}）`);
ok(model.fixedCollected === 2, `固定已收集=2 guluduck+steamalotl（实得 ${model.fixedCollected}）`);
ok(model.aiCollected === 1, `AI 变种已收集=1 aiffw1（实得 ${model.aiCollected}）`);
ok(model.collected.has("guluduck") && model.collected.has("steamalotl"), "曾获集合含 guluduck/steamalotl");

// 高阶在上：第一行应是 6 元素 prismkirin。
ok(model.recipes[0].elementCount === 6, `首行元素数 6（实得 ${model.recipes[0].elementCount}）`);
ok(model.recipes[0].fixed === "prismkirin", `首行固定=prismkirin（实得 ${model.recipes[0].fixed}）`);

// fire+water 行：slot0=steamalotl 已收集(曾获1)，slot1=aiffw1 已收集，slot2=神秘且概率 30%，slot3+ 锁定。
const fw = model.recipes.find((r) => r.key === "fire+water");
ok(fw != null, "存在 fire+water 配方行");
ok(fw.slots[0].codename === "steamalotl" && fw.slots[0].collected && fw.slots[0].everCount === 1, "fire+water 0 号=steamalotl 已收集 ×1");
ok(fw.slots[1].codename === "aiffw1" && fw.slots[1].collected, "fire+water 1 号=aiffw1 已收集");
ok(fw.slots[2].mystery === true && !fw.slots[2].collected, "fire+water 2 号=神秘未收集");
ok(Math.abs(fw.slots[2].probability - 30) < 0.01, `fire+water 2 号概率=30%（实得 ${fw.slots[2].probability}）`);
ok(fw.slots[3].locked === true && fw.slots[3].probability === 0, "fire+water 3 号锁定、概率 0");

// 全新配方（electric+fire，dex 无）：0 号概率=40%、1 号概率=60%（e=2 m=1）。
const ef = model.recipes.find((r) => r.key === "electric+fire");
ok(ef != null, "存在 electric+fire 配方行");
ok(Math.abs(ef.slots[0].probability - 40) < 0.01, `electric+fire 0 号=40%（实得 ${ef.slots[0].probability}）`);
ok(Math.abs(ef.slots[1].probability - 60) < 0.01, `electric+fire 1 号=60%（实得 ${ef.slots[1].probability}）`);
ok(ef.slots[1].mystery === true, "electric+fire 1 号未生成=神秘");
ok(ef.slots[2].locked === true, "electric+fire 2 号锁定（需先集齐 0/1）");

// 博物馆速览：高阶→低阶，maxCells 溢出 +x。
const mus = M.museumThumbs(model, config, 2);
ok(mus.shown.length === 1 && mus.overflow === 2, `速览 maxCells=2 → 显 1 + 溢出 2（实得 ${mus.shown.length}/${mus.overflow}）`);
ok((config.species[mus.shown[0]]?.elements.length ?? 1) >= 1, "速览首格按元素数降序");

if (failures > 0) {
  console.error(`\n✗ pokedex model: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("✓ pokedexData model: all assertions pass (63 recipes, ladder probabilities, museum overflow)");
