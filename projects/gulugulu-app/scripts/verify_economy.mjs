// 经济纵深 TS 对拍验证 —— 证明 src/game/config.ts 的分阶蛋价 / 等效蛋价 /
// 商店升级 / 蛋池权重与过滤，与 src-tauri/src/game_config.rs + game.rs 一致
// （同一批期望值，对齐 EconomyScaling.md 与 Rust 单测）。
//
// 跑法（在 projects/gulugulu-app 下）：node scripts/verify_economy.mjs
// 用 esbuild（devDep）bundle config.ts（解析 config.json / fusionSlots 依赖）→
// data-URL 动态导入，无临时文件。无断言失败即 exit 0，任一失败 exit 1。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const entry = fileURLToPath(new URL("../src/game/config.ts", import.meta.url));
const result = buildSync({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  write: false,
  loader: { ".json": "json" },
  logLevel: "silent",
});
const code = result.outputFiles[0].text;
const dataUrl = "data:text/javascript;base64," + Buffer.from(code, "utf8").toString("base64");
const M = await import(dataUrl);
const config = M.localGameConfig; // node 无 window → 取正式 config.json

let failures = 0;
const eq = (a, b, msg) => {
  const A = JSON.stringify(a);
  const B = JSON.stringify(b);
  if (A !== B) {
    failures += 1;
    console.error(`✗ ${msg}\n    expected ${B}\n    got      ${A}`);
  }
};

// ---- 分阶蛋价 base × 15^(阶−1)（EconomyScaling.md §6.2） ----
eq(M.eggPriceFor(config, "normal", 1), 80, "1 阶一般蛋 = 基价");
eq(M.eggPriceFor(config, "normal", 3), 80 * 15 * 15, "3 阶一般蛋 = 80×15²");
eq(M.eggPriceFor(config, "fire", 4), 405000, "4 阶火蛋 = 120×15³");
eq(M.eggPriceFor(config, "ice", 4), 506250, "4 阶冰蛋 = 150×15³");

// ---- 放生等效蛋价（乘法、按实例阶；§8） ----
eq(M.equivalentEggPrice(config, "frostpeng", 1), 150, "1 阶冰基础种等效价 = 150");
eq(M.equivalentEggPrice(config, "guluswan", 2), 1200, "2 阶 guluswan([normal]) = 80×15");
eq(M.equivalentEggPrice(config, "steamalotl", 3), (120 + 120) * 225, "3 阶 fire+water = (120+120)×15²");

// ---- 商店升级 / 封顶（§6.1） ----
eq(M.shopMaxLevel(config), 4, "商店封顶 4 阶");
eq(M.shopUpgradeCost(config, 1), 50000, "Lv1→2 升级费");
eq(M.shopUpgradeCost(config, 3), 11250000, "Lv3→4 升级费");
eq(M.shopUpgradeCost(config, 4), null, "已满级无升级费");

// ---- 蛋池整数权重 w(c)=3^(6−c)（§7.2） ----
eq([1, 2, 3, 4, 5, 6].map((c) => M.eggRarityWeight(config, c)), [243, 81, 27, 9, 3, 1], "蛋池权重表");

// ---- 蛋池过滤 + 掷点（§7.1；对齐 Rust egg_pool_filters 单测） ----
const empty = { dexObtained: {}, customSpecies: {} };
eq(M.eggPoolCandidates(config, empty, "fire", 1), [["emberfox", 243]], "1 阶火蛋 = 基础种恒可售");
eq(M.eggPoolCandidates(config, empty, "fire", 2), [["emberfox", 243]], "2 阶火蛋未解锁 → 仅保底");
const withSteam = { dexObtained: { steamalotl: 1 }, customSpecies: {} };
const t2 = M.eggPoolCandidates(config, withSteam, "fire", 2).map(([c]) => c);
eq(t2.includes("emberfox") && t2.includes("steamalotl"), true, "解锁 fire+water → 进 2 阶火蛋池");
eq(
  M.eggPoolCandidates(config, withSteam, "electric", 2).some(([c]) => c === "steamalotl"),
  false,
  "steamalotl 不在 electric 蛋池",
);
// 元素数 > 蛋阶：3 元素种即便解锁也不进 2 阶池，但进 3 阶池。
const with3 = { dexObtained: { pyrepeacock: 1 }, customSpecies: {} };
eq(
  M.eggPoolCandidates(config, with3, "fire", 2).some(([c]) => c === "pyrepeacock"),
  false,
  "3 元素种不进 2 阶池",
);
eq(
  M.eggPoolCandidates(config, with3, "fire", 3).some(([c]) => c === "pyrepeacock"),
  true,
  "3 元素种进 3 阶池",
);
// roll=0 → 池首元素（与 Rust roll_egg_species 一致）。
eq(M.rollEggSpecies(config, empty, "fire", 1, 0), "emberfox", "roll=0 → 池首 emberfox");

if (failures === 0) {
  console.log("✓ 经济纵深对拍全部通过（config.ts ↔ Rust）");
  process.exit(0);
} else {
  console.error(`\n${failures} 处不一致`);
  process.exit(1);
}
