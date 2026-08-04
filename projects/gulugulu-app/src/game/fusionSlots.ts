// 融合配方槽位阶梯 —— docs/gdd/FusionRecipeSlots.md 引擎实现的 TS 对拍。
//
// 与 src-tauri/src/fusion_slots.rs **逐函数镜像**（仓库 Rust↔TS 规则对等硬规则：
// 改一侧必改另一侧）。掷骰走整数权重（分母 100·2^(m−1)）避免浮点漂移；
// 验证向量见 scripts/verify_fusion_slots.mjs（与 Rust #[cfg(test)] 同表）。
//
// 术语（与 GDD 同）：配方 = 元素集合并集键；槽位 0 = 固定物种、1..=10 = AI 变种；
// 前缀 u = 从 0 号连续已获得的最大槽号（0 号缺 → −1）；前沿 m = min(10, max(1, u+1))。

/** 每配方最多 10 个 AI 变种槽（外加 0 号固定槽）。 */
export const MAX_AI_SLOTS = 10;

/** 配方键（canonical set key）：元素去重 → 字典序 → "+" 连接。单元素即元素名自身。 */
export function elementSetKey(elements: string[]): string {
  return Array.from(new Set(elements)).sort().join("+");
}

/** 触发 AI 的总概率 A(e)（百分数整数），按配方元素数缩放（查表，非公式）。
 *  2→60 · 3→40 · 4→20 · 5→10 · 6→5；其余（含单元素/0）→ 0（无 AI 槽）。 */
export function aiTotalChancePercent(elementCount: number): number {
  switch (elementCount) {
    case 2:
      return 60;
    case 3:
      return 40;
    case 4:
      return 20;
    case 5:
      return 10;
    case 6:
      return 5;
    default:
      return 0;
  }
}

/** 从 0 号起连续已获得的最大槽号（前缀 u）。0 号未获得 → −1。 */
export function obtainedPrefix(obtainedSlots: Set<number>): number {
  if (!obtainedSlots.has(0)) return -1;
  let u = 0;
  while (obtainedSlots.has(u + 1)) u += 1;
  return u;
}

/** 阶梯前沿 m = min(MAX_AI_SLOTS, max(1, u+1))。 */
export function frontierM(obtainedPrefixU: number): number {
  const raw = Math.max(1, obtainedPrefixU + 1);
  return Math.min(MAX_AI_SLOTS, raw);
}

/** CLI 降级后的有效前沿：CLI 不可用且前沿槽需生成（m > 已注册数）→ 回退 m−1；
 *  前沿槽已注册（纯复用）或 CLI 可用 → 保持 m；m=1 且无变种 → 0（只剩固定物种）。 */
export function effectiveFrontier(m: number, registeredAiSlots: number, cliAvailable: boolean): number {
  if (cliAvailable || m <= registeredAiSlots) return m;
  return Math.max(0, m - 1);
}

/** 可触发集合 {0..=m} 的整数权重（下标即槽号）。
 *  P(0)=1−A、内部 P(i)=A/2^i、前沿 P(m)=A/2^(m−1)；通分到 100·2^(m−1)：
 *  w0=(100−a)·2^(m−1)、w_i=a·2^(m−1−i)、w_m=a。m=0 → [1]（0 号 100%）。 */
export function slotWeights(aPercent: number, m: number): number[] {
  if (m === 0) return [1];
  const scale = 1 << (m - 1); // 2^(m−1)
  const weights = [(100 - aPercent) * scale]; // 0 号固定槽
  for (let i = 1; i < m; i += 1) {
    weights.push(aPercent * (1 << (m - 1 - i))); // 内部槽 = a·2^(m−1−i)
  }
  weights.push(aPercent); // 前沿槽 = a（吸收尾部余量）
  return weights;
}

/** 权重之和（= 100·2^(m−1)，或 m==0 时 1）。 */
export function weightsSum(weights: number[]): number {
  return weights.reduce((sum, w) => sum + w, 0);
}

/** 按累积权重与掷点 roll ∈ [0, sum) 选槽（越界兜底末槽）。 */
export function rollSlot(weights: number[], roll: number): number {
  let acc = 0;
  for (let i = 0; i < weights.length; i += 1) {
    acc += weights[i];
    if (roll < acc) return i;
  }
  return Math.max(0, weights.length - 1);
}

/** 掷中槽的处置：0 号=固定物种；≤已注册数=复用该 AI 变种；否则=生成新变种。 */
export type SlotOutcome =
  | { kind: "fixed" }
  | { kind: "reuse"; slot: number }
  | { kind: "generate"; slot: number };

export function classifySlot(rolled: number, registeredAiSlots: number): SlotOutcome {
  if (rolled === 0) return { kind: "fixed" };
  if (rolled <= registeredAiSlots) return { kind: "reuse", slot: rolled };
  return { kind: "generate", slot: rolled };
}

/** 便捷：给定配方元素数、已获得槽集合、已注册 AI 变种数、CLI 可用性，
 *  返回本次可触发集合的整数权重（供掷骰与图鉴概率显示共用同一真源）。 */
export function recipeSlotWeights(
  elementCount: number,
  obtainedSlots: Set<number>,
  registeredAiSlots: number,
  cliAvailable: boolean,
): number[] {
  const m = frontierM(obtainedPrefix(obtainedSlots));
  const eff = effectiveFrontier(m, registeredAiSlots, cliAvailable);
  return slotWeights(aiTotalChancePercent(elementCount), eff);
}

// ---------------------------------------------------------------------------
// 全局确定性槽位身份 —— Steam itemdef 与创意工坊 petId 的共同主键。
// 与 src-tauri/src/fusion_slots.rs 逐函数镜像：多元素配方（元素数≥2）按
// (元素数升序, 键字典序) 排出冻结序号 recipeOrdinal，派生固定物种 def（601+ord）、
// AI 槽 def（10000+ord*100+slot）、AI 槽 codename（aif+2位ord+2位slot）。
// 向量见 scripts/verify_fusion_slots.mjs。
// ---------------------------------------------------------------------------

/** AI 变种槽 itemdef 号段基址（加法编号，永不与既有 1xx–9xx 冲突）。 */
export const AI_ITEM_DEF_BASE = 10000;
/** 多元素固定物种 itemdef 起始号（§9：601..=657 = 601 + recipeOrdinal）。 */
export const FIXED_MULTI_DEF_BASE = 601;

/** 配方元素数（"+" 分段数）；单元素 → 1。 */
export function recipeElementCount(recipe: string): number {
  return recipe.split("+").length;
}

/** 多元素配方（元素数≥2）按 (元素数升序, 键字典序) 排序 —— 冻结序号真源。 */
export function multiElementRecipesOrdered(recipeKeys: string[]): string[] {
  return recipeKeys
    .filter((k) => recipeElementCount(k) >= 2)
    .sort((a, b) => {
      const ca = recipeElementCount(a);
      const cb = recipeElementCount(b);
      if (ca !== cb) return ca - cb;
      return a < b ? -1 : a > b ? 1 : 0;
    });
}

/** 配方在多元素有序表里的 0-based 序号；单元素/未知 → -1。 */
export function recipeOrdinal(ordered: string[], recipe: string): number {
  return ordered.indexOf(recipe);
}

/** 多元素固定物种 itemdefid = 601 + 序号。 */
export function fixedItemDef(ordinal: number): number {
  return FIXED_MULTI_DEF_BASE + ordinal;
}

/** AI 变种槽 itemdefid = 10000 + 序号*100 + slot（slot 1..=MAX_AI_SLOTS）。 */
export function aiItemDef(ordinal: number, slot: number): number {
  return AI_ITEM_DEF_BASE + ordinal * 100 + slot;
}

/** 并集融合生成器 itemdef 号段基址（2026-07-16 上架定案，00-decisions）。 */
export const UNION_GEN_BASE = 20000;

/** 并集融合生成器 itemdefid = 20000 + 序号（每多元素配方一条，exchange 枚举全部并集对）。 */
export function unionGenDef(ordinal: number): number {
  return UNION_GEN_BASE + ordinal;
}

/** 商店蛋生成器 itemdef 号段基址（2026-07-16 上架定案）。 */
export const SHOP_GEN_BASE = 21000;

/** 商店蛋生成器 itemdefid = 21000 + 阶*10 + (一阶宠 def − 100)（21011..=21046）。 */
export function shopGenDef(tier: number, tier1PetDef: number): number {
  return SHOP_GEN_BASE + tier * 10 + (tier1PetDef - 100);
}

/** codename → AI 槽 itemdef 反解（仅新式 aif+4 位数字；旧随机 hex → null）。 */
export function aiDefForCodename(codename: string): number | null {
  const m = /^aif(\d{2})(\d{2})$/.exec(codename);
  if (!m) return null;
  const ordinal = Number(m[1]);
  const slot = Number(m[2]);
  if (ordinal > 56 || slot < 1 || slot > MAX_AI_SLOTS) return null;
  return aiItemDef(ordinal, slot);
}

/** AI 槽 itemdef → codename 反解（10001..=15610 且槽号 1..=10；其余 null）。 */
export function codenameForAiDef(def: number): string | null {
  if (def <= AI_ITEM_DEF_BASE || def > AI_ITEM_DEF_BASE + 5610) return null;
  const rest = def - AI_ITEM_DEF_BASE;
  const ordinal = Math.floor(rest / 100);
  const slot = rest % 100;
  if (ordinal > 56 || slot < 1 || slot > MAX_AI_SLOTS) return null;
  return slotCodename(ordinal, slot);
}

/** AI 变种槽全局确定性 codename = `aif` + 2 位序号 + 2 位 slot（如 aif0001/aif5610）。 */
export function slotCodename(ordinal: number, slot: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `aif${pad(ordinal)}${pad(slot)}`;
}
