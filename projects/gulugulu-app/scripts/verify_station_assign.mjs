// 后院驻留点「持久化站位分配」不变量验收 —— 直接跑 src/game/stationAssign.ts 的真实
// 逻辑，证明本次修复的核心诉求：放生/融合宠物不会牵动其他伙伴的站位，且首帧布局与
// 旧的「按存档序号取 GROUND_STATIONS[index]」完全一致。
//
// 跑法（在 projects/gulugulu-app 下）：node scripts/verify_station_assign.mjs
// 用 esbuild（devDep）bundle stationAssign.ts → data-URL 动态导入，无临时文件。
// 无断言失败 exit 0，任一失败 exit 1。

import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";

const entry = fileURLToPath(new URL("../src/game/stationAssign.ts", import.meta.url));
const result = buildSync({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  write: false,
  logLevel: "silent",
});
const code = result.outputFiles[0].text;
const dataUrl = "data:text/javascript;base64," + Buffer.from(code, "utf8").toString("base64");
const { assignPetStations } = await import(dataUrl);

let failures = 0;
const eq = (a, b, msg) => {
  const A = JSON.stringify(a);
  const B = JSON.stringify(b);
  if (A !== B) {
    failures += 1;
    console.error(`✗ ${msg}\n    expected ${B}\n    got      ${A}`);
  } else {
    console.log(`✓ ${msg}`);
  }
};

const isWater = (species) => species === "water";
// 分配表快照（petId → 站位 JSON），便于逐只对比「谁没动」。
const snap = (assign) =>
  Object.fromEntries(Array.from(assign.entries()).map(([id, slot]) => [id, JSON.stringify(slot)]));
const pet = (id, species) => ({ id, species });

// 复刻旧的「按存档序号」布局，作为首帧参照（首帧必须逐格一致）。
function legacyAssign(pets, activePetId) {
  const pondPetId = pets.find((p) => isWater(p.species))?.id ?? null;
  const ground = pets.filter((p) => p.id !== pondPetId);
  const out = {};
  ground.forEach((p, index) => {
    out[p.id] = p.id === activePetId ? "__active__" : JSON.stringify({ ground: index });
  });
  if (pondPetId) out[pondPetId] = pondPetId === activePetId ? "__active__" : JSON.stringify({ pond: true });
  return out;
}

// === 场景 A：首帧布局与旧方案逐格一致（含当前陪伴占位留空、水系首只占池塘） ===
// pets=[A(fire,active), B(water), C(grass), D(water)]
const petsA = [pet("A", "fire"), pet("B", "water"), pet("C", "grass"), pet("D", "water")];
const assign = new Map();
assignPetStations(assign, petsA, isWater);
const sA = snap(assign);
eq(sA.A, JSON.stringify({ ground: 0 }), "A(active,fire) 占 ground0（留空但预留）");
eq(sA.B, JSON.stringify({ pond: true }), "B 水系首只 → 池塘");
eq(sA.C, JSON.stringify({ ground: 1 }), "C → ground1");
eq(sA.D, JSON.stringify({ ground: 2 }), "D 第二只水系 → ground2（池塘已占）");
// 与旧「按序号」方案逐格比对（旧方案里 active 记为 __active__，这里对齐比对非 active 项）。
const legacyA = legacyAssign(petsA, "A");
eq(
  { B: sA.B, C: sA.C, D: sA.D },
  { B: legacyA.B, C: legacyA.C, D: legacyA.D },
  "首帧非陪伴伙伴布局与旧『按存档序号』方案一致",
);

// === 场景 B：放生中段的 C —— 其余伙伴一格不动（核心诉求①） ===
const petsB = [pet("A", "fire"), pet("B", "water"), pet("D", "water")]; // C 离场
assignPetStations(assign, petsB, isWater);
const sB = snap(assign);
eq(sB.A, sA.A, "放生 C 后：A 站位不变");
eq(sB.B, sA.B, "放生 C 后：B 站位不变");
eq(sB.D, sA.D, "放生 C 后：D 仍在 ground2（未滑入刚空出的 ground1）");
eq(sB.C, undefined, "放生 C 后：C 释放其站位");

// === 场景 C：放生后新增宠物 —— 取最低空位、且不牵动既有伙伴 ===
const petsC = [pet("A", "fire"), pet("B", "water"), pet("D", "water"), pet("E", "fire")];
assignPetStations(assign, petsC, isWater);
const sC = snap(assign);
eq(sC.E, JSON.stringify({ ground: 1 }), "新宠 E 取当前最低空位 ground1");
eq({ A: sC.A, B: sC.B, D: sC.D }, { A: sB.A, B: sB.B, D: sB.D }, "新增 E 不牵动 A/B/D");

// === 场景 D：融合消耗（当前陪伴 A + 近邻 B）—— 剩余伙伴不重排、新陪伴可被相机定位 ===
// 从场景 A 的初态重演，避免场景 C 引入的 E 干扰。
const assign2 = new Map();
assignPetStations(assign2, petsA, isWater);
const before = snap(assign2);
const petsD = [pet("C", "grass"), pet("D", "water")]; // A、B 被融合消耗；active 回落 pets[0]=C
assignPetStations(assign2, petsD, isWater);
const sD = snap(assign2);
eq(sD.C, before.C, "融合后：C 站位不变（未整体重排）");
eq(sD.D, before.D, "融合后：D 站位不变");
eq(sD.A, undefined, "融合后：A 释放站位");
eq(sD.B, undefined, "融合后：B 释放站位");
eq(sD.C, JSON.stringify({ ground: 1 }), "新陪伴 C 保留原站位 ground1 → 相机可定位到它");

// === 场景 E：池塘拥有者离场后不牵引其他水系；后来者才补池塘 ===
const assign3 = new Map();
assignPetStations(assign3, petsA, isWater); // B 占池塘，D 在 ground2
const petsE = [pet("A", "fire"), pet("C", "grass"), pet("D", "water")]; // 放生池塘主 B
assignPetStations(assign3, petsE, isWater);
const sE = snap(assign3);
eq(sE.D, JSON.stringify({ ground: 2 }), "放生池塘主后：既有水系 D 不跳进池塘（仍 ground2）");
const hasPond = Object.values(sE).some((v) => v === JSON.stringify({ pond: true }));
eq(hasPond, false, "放生池塘主后：池塘留空");
assignPetStations(assign3, [...petsE, pet("F", "water")], isWater); // 新水系入场
eq(snap(assign3).F, JSON.stringify({ pond: true }), "后来的新水系 F 补进空出的池塘");

// === 场景 F：幂等 —— 同一 pets 重复分配不产生任何变化 ===
const assign4 = new Map();
assignPetStations(assign4, petsA, isWater);
const once = snap(assign4);
assignPetStations(assign4, petsA, isWater);
eq(snap(assign4), once, "同一 pets 重复调用幂等（render 期间可安全复算）");

if (failures === 0) {
  console.log("\n✓ 站位分配不变量全部通过：放生/融合不牵动其他伙伴，首帧布局与旧方案一致");
  process.exit(0);
} else {
  console.error(`\n${failures} 处不一致`);
  process.exit(1);
}
