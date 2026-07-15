// 融合槽位阶梯 TS 对拍验证 —— 证明 src/game/fusionSlots.ts 与
// src-tauri/src/fusion_slots.rs 逐位一致（同一批测试向量）。
//
// 跑法（在 projects/gulugulu-app 下）：node scripts/verify_fusion_slots.mjs
// 用 esbuild（devDep）把 TS 转成 JS 后 data-URL 动态导入，无临时文件。
// 无断言失败即 exit 0，任一失败 exit 1。

import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";

const tsPath = new URL("../src/game/fusionSlots.ts", import.meta.url);
const { code } = transformSync(readFileSync(tsPath, "utf8"), { loader: "ts", format: "esm" });
const dataUrl = "data:text/javascript;base64," + Buffer.from(code, "utf8").toString("base64");
const M = await import(dataUrl);

let failures = 0;
const eq = (a, b, msg) => {
  const A = JSON.stringify(a);
  const B = JSON.stringify(b);
  if (A !== B) {
    failures += 1;
    console.error(`✗ ${msg}\n    expected ${B}\n    got      ${A}`);
  }
};

// ---- element_set_key ---------------------------------------------------
eq(M.elementSetKey(["fire"]), "fire", "elementSetKey single");
eq(M.elementSetKey(["water", "fire"]), "fire+water", "elementSetKey sorts");
eq(M.elementSetKey(["fire", "fire"]), "fire", "elementSetKey dedups (same-species union)");
eq(M.elementSetKey(["water", "fire", "grass", "fire"]), "fire+grass+water", "elementSetKey dedup+sort");

// ---- A(e) --------------------------------------------------------------
eq([2, 3, 4, 5, 6].map(M.aiTotalChancePercent), [60, 40, 20, 10, 5], "A(e) table");
eq([0, 1, 7].map(M.aiTotalChancePercent), [0, 0, 0], "A(e) non-AI counts → 0");

// ---- obtainedPrefix + frontierM ---------------------------------------
const S = (...xs) => new Set(xs);
eq(M.obtainedPrefix(S()), -1, "prefix empty");
eq(M.obtainedPrefix(S(1)), -1, "prefix {1} (no slot 0)");
eq(M.obtainedPrefix(S(0)), 0, "prefix {0}");
eq(M.obtainedPrefix(S(0, 1)), 1, "prefix {0,1}");
eq(M.obtainedPrefix(S(0, 1, 2)), 2, "prefix {0,1,2}");
eq(M.obtainedPrefix(S(0, 1, 3)), 1, "prefix {0,1,3} gap breaks");
eq([-1, 0, 1, 2, 9, 10].map(M.frontierM), [1, 1, 2, 3, 10, 10], "frontierM progression + cap");

// ---- slotWeights：逐位核对 GDD §3.2 分布表 ----------------------------
eq(M.slotWeights(60, 1), [40, 60], "e2 m1");
eq(M.slotWeights(60, 2), [80, 60, 60], "e2 m2 (=40/30/30)");
eq(M.slotWeights(60, 3), [160, 120, 60, 60], "e2 m3 (=40/30/15/15)");
eq(M.slotWeights(40, 1), [60, 40], "e3 m1");
eq(M.slotWeights(40, 2), [120, 40, 40], "e3 m2 (=60/20/20)");
eq(M.slotWeights(40, 3), [240, 80, 40, 40], "e3 m3 (=60/20/10/10)");
eq(M.slotWeights(5, 1), [95, 5], "e6 m1");
eq(M.slotWeights(5, 2), [190, 5, 5], "e6 m2 (=95/2.5/2.5)");
eq(M.slotWeights(5, 3), [380, 10, 5, 5], "e6 m3 (=95/2.5/1.25/1.25)");
eq(M.slotWeights(60, 0), [1], "m0 → fixed only");
eq(M.slotWeights(0, 3), [400, 0, 0, 0], "a0 (non-AI) → slot0 only");

// ---- 全阶梯不变量：和 = 100·2^(m−1)，AI 池 = a%，前沿 = a --------------
for (const e of [2, 3, 4, 5, 6]) {
  const a = M.aiTotalChancePercent(e);
  for (let m = 1; m <= M.MAX_AI_SLOTS; m += 1) {
    const w = M.slotWeights(a, m);
    eq(w.length, m + 1, `len e${e} m${m}`);
    eq(M.weightsSum(w), 100 * 2 ** (m - 1), `sum e${e} m${m}`);
    eq(w[0] * 100, (100 - a) * M.weightsSum(w), `P0 e${e} m${m}`);
    const ai = w.slice(1).reduce((s, x) => s + x, 0);
    eq(ai * 100, a * M.weightsSum(w), `AI-total e${e} m${m}`);
    eq(w[w.length - 1], a, `frontier=a e${e} m${m}`);
  }
}

// ---- rollSlot：累积分区 + 逐掷点频率恰等于权重 ------------------------
{
  const w = M.slotWeights(60, 2); // [80,60,60] 边界 80/140/200
  eq([0, 79, 80, 139, 140, 199, 200].map((r) => M.rollSlot(w, r)), [0, 0, 1, 1, 2, 2, 2], "rollSlot boundaries");
}
for (const e of [2, 3, 4, 5, 6]) {
  const a = M.aiTotalChancePercent(e);
  for (let m = 1; m <= 4; m += 1) {
    const w = M.slotWeights(a, m);
    const hits = new Array(w.length).fill(0);
    const total = M.weightsSum(w);
    for (let r = 0; r < total; r += 1) hits[M.rollSlot(w, r)] += 1;
    eq(hits, w, `empirical freq e${e} m${m}`);
  }
}

// ---- effectiveFrontier（CLI 降级）+ classifySlot ----------------------
eq(M.effectiveFrontier(3, 2, true), 3, "cli up keeps m");
eq(M.effectiveFrontier(3, 2, false), 2, "cli down + needs-gen → m-1");
eq(M.effectiveFrontier(2, 2, false), 2, "cli down + registered → m");
eq(M.effectiveFrontier(1, 0, false), 0, "cli down + no variants → 0");
eq(M.classifySlot(0, 2), { kind: "fixed" }, "classify 0");
eq(M.classifySlot(1, 2), { kind: "reuse", slot: 1 }, "classify reuse");
eq(M.classifySlot(3, 2), { kind: "generate", slot: 3 }, "classify generate");
eq(M.classifySlot(1, 0), { kind: "generate", slot: 1 }, "classify free-first-unlock");

// ---- recipeSlotWeights（组合 + 降级）---------------------------------
eq(M.recipeSlotWeights(2, S(0, 1), 1, true), [80, 60, 60], "recipeSlotWeights cli up");
eq(M.recipeSlotWeights(2, S(0, 1), 1, false), [40, 60], "recipeSlotWeights cli down");
eq(M.recipeSlotWeights(2, S(), 0, false), [1], "recipeSlotWeights fresh+cli down → fixed");
eq(M.recipeSlotWeights(1, S(), 0, true), [100, 0], "recipeSlotWeights single-element");

// ---- 槽位身份（Steam itemdef / 创意工坊 petId 主键）--------------------
// 用真配置的 speciesByRecipe 键驱动纯函数派生（config.steamItemDef 一致性归
// scripts/steam/verify_itemdefs.mjs 校验，此处只对拍身份函数本身）。
const cfg = JSON.parse(readFileSync(new URL("../src/game/config.json", import.meta.url), "utf8"));
const ordered = M.multiElementRecipesOrdered(Object.keys(cfg.speciesByRecipe));
eq(ordered.length, 57, "multiElementRecipesOrdered → 57 多元素配方");
eq(ordered[0], "electric+fire", "ordinal 0 = electric+fire");
eq(ordered[14], "normal+water", "ordinal 14 = 末位 2 元素");
eq(ordered[15], "electric+fire+grass", "ordinal 15 = 首位 3 元素");
eq(ordered[56], "electric+fire+grass+ice+normal+water", "ordinal 56 = 六元素旗舰");
eq(M.recipeOrdinal(ordered, "electric+fire"), 0, "recipeOrdinal electric+fire");
eq(M.recipeOrdinal(ordered, "fire"), -1, "recipeOrdinal 单元素 → -1");
eq([M.fixedItemDef(0), M.fixedItemDef(56)], [601, 657], "fixedItemDef 端点");
eq([M.aiItemDef(0, 1), M.aiItemDef(56, 10)], [10001, 15610], "aiItemDef 端点");
eq([M.slotCodename(0, 1), M.slotCodename(56, 10), M.slotCodename(5, 3)], ["aif0001", "aif5610", "aif0503"], "slotCodename 抽样");
{
  // 570 槽全量：def 唯一 ∈ [10001,15610] 且 >657；codename 唯一、匹配 ^aif\d{4}$。
  const defs = new Set();
  const names = new Set();
  for (let ord = 0; ord < 57; ord += 1) {
    for (let slot = 1; slot <= M.MAX_AI_SLOTS; slot += 1) {
      const def = M.aiItemDef(ord, slot);
      if (def < 10001 || def > 15610 || def <= 657 || defs.has(def)) {
        failures += 1;
        console.error(`✗ AI def 越界/撞号/重复 ord=${ord} slot=${slot} def=${def}`);
      }
      defs.add(def);
      const name = M.slotCodename(ord, slot);
      if (!/^aif\d{4}$/.test(name) || names.has(name)) {
        failures += 1;
        console.error(`✗ codename 非法/重复 ${name}`);
      }
      names.add(name);
    }
  }
  eq(defs.size, 570, "570 唯一 AI def");
  eq(names.size, 570, "570 唯一 AI codename");
}

if (failures > 0) {
  console.error(`\n✗ fusionSlots parity: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("✓ fusionSlots.ts ↔ fusion_slots.rs parity: all vectors match");
