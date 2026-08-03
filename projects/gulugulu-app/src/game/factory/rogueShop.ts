// 商店陈列与定价(GDD 03):维度一(元素系列)保底且**只出出战名单里的元素**;
// 原维度五基础培训已并入元素系列混合随机;属性数与编制/财务合并为维度二,
// 连携保留为维度三。连携尚未解锁时，第三次选择继续从混合维度二抽取。
// 属性数不按名单过滤;连携由已学习的两边核心机制共同解锁。所有维度统一检查
// CardDef.requires;已满级卡排除;贷款在还时排除。
// 纯函数:rng 由调用方注入(RogueRun 的 mulberry32),check 脚本可复现。

import {
  CARD_DEFS,
  CARD_LEVEL_PRICE_MULTIPLIER,
  CARD_PRICE_RATE,
  clampFactoryValue,
} from "./rogueConfig";
import type { CardDef, CardDim, RogueElement, ShopOffer } from "./rogueTypes";

export type OfferArgs = {
  /** 出战名单的元素并集(rogueSpecies.unionElements)。 */
  loadoutElements: RogueElement[];
  /** 出战收藏中各元素出现次数；用于把主力双系连携固定放在第三维第一格。 */
  loadoutElementCounts?: Partial<Record<RogueElement, number>>;
  /** 已购卡 id → 等级(前置解锁与满级排除共用)。 */
  cardLevels: Record<string, number>;
  /** 贷款在还中(排除 staff.loan)。 */
  activeLoan: boolean;
};

const DEF_BY_ID = new Map<string, CardDef>(CARD_DEFS.map((d) => [d.id, d]));

export function cardDef(id: string): CardDef | undefined {
  return DEF_BY_ID.get(id);
}

/** 单卡现价 = 稀有度率 × 当班 KPI × 2^当前已持有等级；免费卡(贷款)恒 0。 */
export function cardPrice(def: CardDef, level: number, kpi: number): number {
  if (def.free) return 0;
  const rate = CARD_PRICE_RATE[def.rarity] ?? CARD_PRICE_RATE.common;
  return clampFactoryValue(
    rate * kpi * Math.pow(CARD_LEVEL_PRICE_MULTIPLIER, Math.max(0, level)),
  );
}

function shuffled<T>(rng: () => number, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 是否已经学会卡牌的全部前置；多前置使用 AND 关系。 */
export function meetsCardPrerequisites(def: CardDef, cardLevels: Record<string, number>): boolean {
  return def.requires?.every((id) => (cardLevels[id] ?? 0) > 0) ?? true;
}

/** 某维度当前可抽卡池(前置未满足/满级排除;元素系列按名单过滤;贷款在还排除)。 */
export function dimPool(dim: CardDim, args: OfferArgs): CardDef[] {
  // 旧续局可能仍保存 dim=4；刷新时迁移到新的“属性与经营”混合池。
  const poolDim: CardDim = dim === 4 ? 2 : dim;
  return CARD_DEFS.filter((d) => {
    // 维度五作为第三栏的“综合精选”池，统一收录当前合法的元素、属性经营与连携卡。
    if (poolDim === 5 ? !([1, 2, 3] as CardDim[]).includes(d.dim) : d.dim !== poolDim) return false;
    if (!meetsCardPrerequisites(d, args.cardLevels)) return false;
    if (d.maxLevel != null && (args.cardLevels[d.id] ?? 0) >= d.maxLevel) return false;
    if (d.dim === 1 && (d.element == null || !args.loadoutElements.includes(d.element))) return false;
    if (d.id === "staff.loan" && args.activeLoan) return false;
    return true;
  });
}

/** 抽该维度陈列(至多 3 张、彼此不同;池不足 3 时有多少陈列多少)。 */
export function drawDimCards(rng: () => number, dim: CardDim, args: OfferArgs): string[] {
  const pool = dimPool(dim, args);
  if (dim === 3 && pool.length > 0) {
    const countOf = (element: RogueElement) => (
      args.loadoutElementCounts?.[element] ?? (args.loadoutElements.includes(element) ? 1 : 0)
    );
    const preferred = pool
      .filter((card) => card.pair != null)
      .slice()
      .sort((left, right) => {
        const [la, lb] = left.pair!;
        const [ra, rb] = right.pair!;
        const leftTotal = countOf(la) + countOf(lb);
        const rightTotal = countOf(ra) + countOf(rb);
        const leftBalance = Math.min(countOf(la), countOf(lb));
        const rightBalance = Math.min(countOf(ra), countOf(rb));
        return rightTotal - leftTotal || rightBalance - leftBalance || left.id.localeCompare(right.id);
      })[0];
    if (preferred != null) {
      return [
        preferred.id,
        ...shuffled(rng, pool.filter((card) => card.id !== preferred.id))
          .slice(0, 2)
          .map((card) => card.id),
      ];
    }
  }
  return shuffled(rng, pool)
    .slice(0, 3)
    .map((d) => d.id);
}

/** 开一次商店：元素系列 + 属性经营混合池 + 综合精选池。 */
export function buildOffer(rng: () => number, args: OfferArgs): ShopOffer {
  const dims: [CardDim, CardDim, CardDim] = [1, 2, 5];
  return {
    dims,
    cards: [drawDimCards(rng, dims[0], args), drawDimCards(rng, dims[1], args), drawDimCards(rng, dims[2], args)],
    resolved: [false, false, false],
    rerollCounts: [0, 0, 0],
  };
}
