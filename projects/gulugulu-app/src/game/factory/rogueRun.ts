// 局引擎 RogueRun(实现 RogueRunApi):开班招聘 + 持久雇佣池、六工种整局累计通胀、
// 落地脉冲入账、KPI 自动收班、账单/蓄水利息/贷款、商店三维度、检查日(赶工/限电/大风/决算)、
// 罢工/解雇账务(遣散费退款)、破产与 20 班通关、无限模式、战绩 localStorage。
// 场景桥回调全部轻量同步(纯计算,无 DOM);状态只在本类,UI 经 subscribe/view 订阅。
//
// 入账统一约定(见 roguePulse.ts 头注):任何一条 PulseBreakdown 的入账额 = total + Σextras。

import {
  DEFAULT_BASE_VALUE,
  CARD_PARAMS,
  LOAN_GAIN_RATE,
  LOAN_REPAY_RATE,
  LOAN_TOTAL_REPAY_RATE,
  LOAN_SHIFTS,
  HIRING_CANDIDATE_COUNT,
  HIRING_PICK_LIMIT,
  HIRING_REROLL_RATES,
  FACTORY_KPI_CAP,
  FACTORY_VALUE_CAP,
  PULSE_TIERS,
  QUOTA_PER_SHIFT,
  QUOTA_START,
  SEVERANCE_REFUND_HARD_CAP,
  RUSH_TRICKLE_RATE,
  hasPowerRule,
  hasRushRule,
  hasWindRule,
  powerThrowLimitFor,
  rushWallMsFor,
  shopRerollCost,
  SHOP_SKIP_REFUND_RATE,
  START_CASH,
  STRIKE_LINE_DEFAULT,
  TOTAL_SHIFTS,
  WIND_DROP_SPEED,
  WIND_FLIP_MS,
  WIND_RATIO,
  addFactoryValues,
  baseTrainingBonus,
  billForShift,
  cardsForElementPlacement,
  clampFactoryValue,
  elementReachBonus,
  hirePrice,
  kpiBonusFor,
  kpiForShift,
  modifierForShift,
  valueAtLevel,
} from "./rogueConfig";
import {
  comboParams,
  buildPulseAdjacency,
  computePulse,
  relayAllowedForCards,
  stickOverrideForCards,
  type PulseCtx,
} from "./roguePulse";
import {
  buildAdjacency,
  deskBases,
  deskSwapMoves,
  extendAdjacency,
  mismatchedDeskPathUids,
  type Adjacency,
} from "./rogueGraph";
import { buildOffer, cardDef, cardPrice, drawDimCards, type OfferArgs } from "./rogueShop";
import { unionElements } from "./rogueSpecies";
import type {
  BodyLike,
  DeskMove,
  DeskLike,
  LoanState,
  PulseBreakdown,
  RogueBodyState,
  RogueBodyMutation,
  RogueElement,
  RogueRecords,
  RogueRunApi,
  RogueRunSnapshot,
  RogueSpawnRequest,
  RunPhase,
  RunStats,
  RunView,
  ShiftCashFlow,
  ShiftSettlement,
  ShiftModifier,
  ShopOffer,
  SpeciesRogueMeta,
} from "./rogueTypes";
import { ROGUE_RUN_STORAGE_KEY, ROGUE_STORAGE_KEY } from "./rogueTypes";

export type RogueRunInit = {
  loadout: string[];
  meta: Record<string, SpeciesRogueMeta>;
  deskOrder: RogueElement[];
  seed?: number;
  /** 续局恢复传 false，避免把同一局重复计为一次新开局。 */
  countStart?: boolean;
  /** 主存档终身统计是权威下界；localStorage 被清理后仍可继续单调计数。 */
  recordBaseline?: { starts: number; runs: number };
};

/** 简单可复现伪随机(与 sprites/parts/workFx.tsx 同实现)。状态外置在 holder 对象上,
 *  便于续局存档序列化/还原(见 snapshot/restore)。 */
function mulberry32(state: { a: number }): () => number {
  return () => {
    state.a |= 0;
    state.a = (state.a + 0x6d2b79f5) | 0;
    let t = Math.imul(state.a ^ (state.a >>> 15), 1 | state.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadRecords(): RogueRecords {
  const fallback: RogueRecords = {
    bestRevenue: 0,
    bestShift: 0,
    endlessUnlocked: false,
    starts: 0,
    runs: 0,
  };
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(ROGUE_STORAGE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<RogueRecords>;
    return {
      bestRevenue: clampFactoryValue(p.bestRevenue ?? 0),
      bestShift: typeof p.bestShift === "number" ? p.bestShift : 0,
      endlessUnlocked: p.endlessUnlocked === true,
      // v1 旧记录没有 starts；至少用已结算局数作为安全下界。
      starts: typeof p.starts === "number"
        ? p.starts
        : (typeof p.runs === "number" ? p.runs : 0),
      runs: typeof p.runs === "number" ? p.runs : 0,
    };
  } catch {
    return fallback;
  }
}

function saveRecords(records: RogueRecords): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  try {
    window.localStorage.setItem(ROGUE_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // 配额/隐私模式写失败可忽略(战绩尽力而为)。
  }
}

/** 续局存档 schema 版本(RogueRunSnapshot 结构变更时 +1,旧档读盘即弃)。 */
const RUN_SNAPSHOT_VERSION = 10;

/** 读未结束局的续局存档;缺失/损坏/版本不符一律 null(退化为从头开局)。 */
export function loadRunSnapshot(): RogueRunSnapshot | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ROGUE_RUN_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<RogueRunSnapshot>;
    // v9 没有检查日剩余时间；restore 会安全迁移为完整时限。
    if (p == null || (p.v !== 9 && p.v !== RUN_SNAPSHOT_VERSION)) return null;
    if (
      p.phase !== "hiring"
      && p.phase !== "shift"
      && p.phase !== "overtime"
      && p.phase !== "settlement"
      && p.phase !== "shop"
    ) return null;
    if (!Array.isArray(p.loadout) || p.loadout.length === 0) return null;
    if (!Array.isArray(p.deskOrder) || p.deskOrder.length === 0) return null;
    if (!Array.isArray(p.bodies) || !Array.isArray(p.bodyEconomy)) return null;
    return p as RogueRunSnapshot;
  } catch {
    return null;
  }
}

/** 写续局存档;snap=null 表示本局已结束(结算/破产)→ 清盘。写失败静默(配额/隐私)。 */
export function saveRunSnapshot(snap: RogueRunSnapshot | null): void {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return;
  try {
    if (snap == null) window.localStorage.removeItem(ROGUE_RUN_STORAGE_KEY);
    else window.localStorage.setItem(ROGUE_RUN_STORAGE_KEY, JSON.stringify(snap));
  } catch {
    // 忽略:续局存档尽力而为,写不进不影响当前这局。
  }
}

/** 主动清空续局存档(重开一局 / 再来一局时调用)。 */
export function clearRunSnapshot(): void {
  saveRunSnapshot(null);
}

/** 首轮四个固定检查节点；无限模式的循环检查不参与「全检查」成就。 */
function inspectionBitForShift(shift: number): number {
  if (shift === 5) return 1 << 0;
  if (shift === 10) return 1 << 1;
  if (shift === 15) return 1 << 2;
  if (shift === 20) return 1 << 3;
  return 0;
}

export class RogueRun implements RogueRunApi {
  private listeners = new Set<() => void>();
  private viewCache: RunView | null = null;

  private readonly meta: Record<string, SpeciesRogueMeta>;
  private readonly loadout: string[];
  private readonly loadoutEls: RogueElement[];
  /** mulberry32 状态 holder(续局存档序列化/还原它)。 */
  private readonly rngState: { a: number };
  private readonly rng: () => number;

  private phase: RunPhase = "hiring";
  private shiftIndex = 1;
  private endless = false;
  private modifier: ShiftModifier;
  private cash = START_CASH;
  private revenueTotal = 0;
  private revenueShift = 0;
  private kpi: number;
  private bill: number;
  private quotaMax = QUOTA_START;
  private quotaUsed = 0;
  private deskOrderArr: RogueElement[];
  private disabledDesks: RogueElement[] = [];
  private combo = 0;
  private cards: Record<string, number> = {};
  private loan: LoanState | null = null;
  private boughtCardEver = false;
  private usedLoanEver = false;
  private inspectionMask = 0;
  private strikeClearEver = false;
  private shiftStrikeCount = 0;
  private graduated = false;
  private pendingDismissN = 0;
  private pendingPricecutFlag = false;
  private pricecutTier: number | null = null;
  private shopOffer: ShopOffer | null = null;
  private settlement: ShiftSettlement | null = null;
  private stats: RunStats = { throws: 0, bounces: 0, strikes: 0, dismissals: 0, maxPulse: 0, maxCombo: 0, maxDesks: 0 };

  // ---- 招聘候选与已付款雇佣池 ----
  private bag: { species: string; price: number }[] = [];
  private hiringCandidates: { id: number; species: string; selected: boolean }[] = [];
  private hiringCandidateSeq = 1;
  private hiringRound = 1;
  private hiringRerollsUsed = 0;
  private hiringRerollSpent = 0;

  // ---- 雇佣账本 ----
  /** 工种 1..6 → 本局累计已雇数，跨班不重置。 */
  private hiredThisShift: number[] = [0, 0, 0, 0, 0, 0, 0];
  private uidSpecies = new Map<number, string>();
  private uidCost = new Map<number, number>();
  /** uid → 当前基础值(草系生长在此复利)。 */
  private uidBase = new Map<number, number>();
  private refunded = new Set<number>();
  /** 冻结/生长/同化/额外标签等跨结算状态。 */
  private bodyStates = new Map<number, RogueBodyState>();
  private bodyMutations: RogueBodyMutation[] = [];
  /** 草系生长请求由场景逐个领取并生成真实物理咕噜。 */
  private generatedSpawns: RogueSpawnRequest[] = [];
  /** 已从雇佣池跳出、尚未逃回池中的加班角色。 */
  private overtimePending = new Map<number, { species: string; price: number }>();
  /** 已完成得分的临时 uid；返池前存档时据此避免重复得分。 */
  private overtimeScored = new Set<number>();
  /** 本轮已完成得分的角色，全部逃走后按原得分顺序整体放回雇佣池。 */
  private overtimeReturned: { species: string; price: number }[] = [];

  // ---- 场景快照读取器 ----
  private snap: { bodies: () => BodyLike[]; desks: () => DeskLike[] } | null = null;
  /** 睡眠通路会做全体 settled 角色的连通图计算；场景高频读取时按拓扑签名复用结果。 */
  private sleepingPathCache: { key: string; uids: number[] } | null = null;

  // ---- 检查日运行态 ----
  private rushArmed = false;
  private rushDeadline: number | null = null;
  /** 续档只保存剩余有效游玩时间，首次 tick 再锚定到当前墙钟。 */
  private rushResumeRemainingMs: number | null = null;
  private rushAcc = 0;
  private powerThrowsLeftVal: number | null = null;
  /** 已扣次数但尚未得到落地/离场结果的手动投放；最后一次要等结果结算后再判失败。 */
  private powerPendingThrows = new Set<number>();
  private windSign: 1 | -1 = 1;
  /** null=非大风;0=已进班待首次 tick 校准;>0=下次翻向时刻。 */
  private windFlipAt: number | null = null;
  private windResumeRemainingMs: number | null = null;
  private lastTickAt: number | null = null;

  // ---- 搬桌 ----
  private deskSwapPending = false;
  private deskSwapFirst: RogueElement | null = null;
  /** 搬桌时已返还账本、等待场景移除的物理 uid。 */
  private deskMoves: DeskMove[] = [];

  // ---- 演出队列 / 战绩 ----
  private pulses: PulseBreakdown[] = [];
  private shiftPulses: PulseBreakdown[] = [];
  private shiftCashFlows: ShiftCashFlow[] = [];
  private spentThisShift = 0;
  private recordsCache: RogueRecords;
  private runCounted = false;

  /** The receipt needs one truthful total per income source, not hundreds of
   * identical rows from rush ticks or a large strike. Aggregating here also
   * bounds active-run memory and snapshot size. */
  private recordIncomeCashFlow(kind: "refund" | "trickle" | "kpiBonus", amount: number): void {
    const credited = clampFactoryValue(amount);
    if (credited <= 0) return;
    const existing = this.shiftCashFlows.find((flow) => flow.kind === kind);
    if (existing == null) {
      this.shiftCashFlows.push({ kind, amount: credited });
      return;
    }
    existing.amount = addFactoryValues(existing.amount, credited);
  }

  constructor(init: RogueRunInit) {
    this.meta = init.meta;
    this.loadout = init.loadout.filter((s) => init.meta[s] != null);
    this.loadoutEls = unionElements(this.loadout.map((s) => init.meta[s]));
    this.rngState = { a: (init.seed ?? Date.now()) >>> 0 };
    this.rng = mulberry32(this.rngState);
    this.deskOrderArr = init.deskOrder.slice();
    this.modifier = modifierForShift(1, this.rng);
    this.kpi = kpiForShift(1);
    this.bill = billForShift(1, this.modifier);
    this.recordsCache = loadRecords();
    if (init.recordBaseline != null) {
      this.recordsCache.starts = Math.max(this.recordsCache.starts, init.recordBaseline.starts);
      this.recordsCache.runs = Math.max(this.recordsCache.runs, init.recordBaseline.runs);
      this.recordsCache.starts = Math.max(this.recordsCache.starts, this.recordsCache.runs);
    }
    if (init.countStart !== false) {
      this.recordsCache.starts++;
      saveRecords(this.recordsCache);
    }
    this.startHiring();
  }

  // ---- 订阅 / 视图 -----------------------------------------------------------

  private bump(): void {
    this.viewCache = null;
    for (const fn of this.listeners) fn();
  }

  private openLoan(): void {
    const principal = clampFactoryValue(LOAN_GAIN_RATE * this.kpi);
    this.cash = addFactoryValues(this.cash, principal);
    this.loan = {
      principal,
      totalDue: clampFactoryValue(principal * LOAN_TOTAL_REPAY_RATE),
      paid: 0,
      shiftsLeft: LOAN_SHIFTS,
    };
    this.usedLoanEver = true;
  }

  private nextLoanPayment(): number {
    if (this.loan == null) return 0;
    const remaining = Math.max(0, this.loan.totalDue - this.loan.paid);
    if (this.loan.shiftsLeft <= 1) return remaining;
    return Math.min(remaining, Math.round(this.loan.principal * LOAN_REPAY_RATE));
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  view(): RunView {
    if (this.viewCache) return this.viewCache;
    const cp = comboParams(this.cards);
    const shop = this.shopOffer;
    this.viewCache = {
      phase: this.phase,
      shiftIndex: this.shiftIndex,
      endless: this.endless,
      modifier: this.modifier,
      cash: this.cash,
      revenueTotal: this.revenueTotal,
      revenueShift: this.revenueShift,
      kpi: this.kpi,
      bill: this.bill,
      quotaMax: this.quotaMax,
      quotaUsed: this.quotaUsed,
      deskOrder: this.deskOrderArr.slice(),
      disabledDesks: this.disabledDesks.slice(),
      loadout: this.loadout.slice(),
      bagPreview: this.buildBagPreview(),
      bagTotal: this.bag.length,
      overtimeRemaining: this.phase === "overtime" ? this.bag.length + this.overtimePending.size : 0,
      hiring: this.phase === "hiring" ? this.buildHiringView() : null,
      combo: this.combo,
      comboMult: 1 + Math.min(cp.per * this.combo, cp.cap),
      // 视图保留工休卡的含水罢工线；实际检测由场景按每个物种组元素查询。
      strikeLine: this.strikeCount(["water"]),
      cards: { ...this.cards },
      bodyStates: Array.from(this.bodyStates.values(), (state) => ({
        ...state,
        elementsOverride: state.elementsOverride?.slice(),
        extraTags: state.extraTags?.slice(),
        absorbedLinks: state.absorbedLinks?.slice(),
        absorbedDesks: state.absorbedDesks?.slice(),
      })),
      loan: this.loan
        ? {
            perShift: this.nextLoanPayment(),
            remaining: Math.max(0, this.loan.totalDue - this.loan.paid),
            shiftsLeft: this.loan.shiftsLeft,
          }
        : null,
      pendingDismiss: this.pendingDismissN,
      pendingPricecut: this.pendingPricecutFlag,
      deskSwapFirst: this.deskSwapFirst,
      dangerBankrupt: this.computeDanger(),
      shop: shop
        ? {
            dims: [shop.dims[0], shop.dims[1], shop.dims[2]],
            cards: [shop.cards[0].slice(), shop.cards[1].slice(), shop.cards[2].slice()],
            resolved: [shop.resolved[0], shop.resolved[1], shop.resolved[2]],
            rerollCounts: [shop.rerollCounts[0], shop.rerollCounts[1], shop.rerollCounts[2]],
          }
        : null,
      settlement: this.settlement == null
        ? null
        : {
            ...this.settlement,
            pulses: this.settlement.pulses.map((pulse) => ({
              ...pulse,
              absorbUids: pulse.absorbUids.slice(),
              desks: pulse.desks.slice(),
              contributors: pulse.contributors.map((x) => ({ ...x })),
              extras: pulse.extras.map((x) => ({ ...x })),
              triggers: pulse.triggers?.map((trigger) => ({
                ...trigger,
                targetUids: trigger.targetUids?.slice(),
              })),
            })),
            cashFlows: this.settlement.cashFlows.map((x) => ({ ...x })),
          },
      rushDeadline: this.rushDeadline,
      powerThrowsLeft: this.powerThrowsLeftVal,
      stats: { ...this.stats },
      boughtCardEver: this.boughtCardEver,
      usedLoanEver: this.usedLoanEver,
      inspectionMask: this.inspectionMask,
      strikeClearEver: this.strikeClearEver,
      graduated: this.graduated,
    };
    return this.viewCache;
  }

  // ---- 招聘与雇佣池 ----------------------------------------------------------

  private drawCandidate(): { id: number; species: string; selected: boolean } {
    const species = this.loadout[Math.floor(this.rng() * this.loadout.length)] ?? this.loadout[0];
    return { id: this.hiringCandidateSeq++, species, selected: true };
  }

  private startHiring(): void {
    this.phase = "hiring";
    this.hiringRound = 1;
    this.dealHiringRound();
  }

  private dealHiringRound(): void {
    this.hiringRerollsUsed = 0;
    this.hiringRerollSpent = 0;
    const backfillLevel = this.cards["staff.backfill"] ?? 0;
    const talentLevel = this.cards["staff.talentmarket"] ?? 0;
    const baseCandidateCount = this.hiringRound === 1
      ? HIRING_CANDIDATE_COUNT
      : valueAtLevel(CARD_PARAMS["staff.backfill"].extraCandidates, backfillLevel);
    const candidateCount = baseCandidateCount
      + talentLevel * CARD_PARAMS["staff.talentmarket"].candidatesPerLevel;
    this.hiringCandidates = Array.from({ length: candidateCount }, () => this.drawCandidate());
    if (this.shiftIndex === 1 && this.hiringRound === 1) {
      const mono = this.loadout.find((s) => this.meta[s]?.tierCount === 1);
      if (mono != null) {
        for (let i = 0; i < 3; i++) this.hiringCandidates[i] = { id: this.hiringCandidateSeq++, species: mono, selected: true };
      }
    }
    this.autoSelectAffordableHiringCandidates();
  }

  private affordableHiringCandidateIds(): Set<number> {
    const availableSeats = Math.min(
      HIRING_PICK_LIMIT,
      Math.max(0, this.quotaMax - this.quotaUsed),
    );
    const availableCash = Math.max(0, this.cash - this.hiringRerollSpent);
    const selectedByTier = [0, 0, 0, 0, 0, 0, 0];
    let selectedCount = 0;
    let selectedCost = 0;

    const selectedIds = new Set<number>();
    for (const candidate of this.hiringCandidates) {
      if (selectedCount >= availableSeats) continue;

      const tier = this.meta[candidate.species]?.tierCount ?? 1;
      const price = this.priceFor(candidate.species, selectedByTier[tier] ?? 0);
      if (price > availableCash - selectedCost) continue;

      selectedIds.add(candidate.id);
      selectedCount++;
      selectedCost = addFactoryValues(selectedCost, price);
      selectedByTier[tier] = (selectedByTier[tier] ?? 0) + 1;
    }
    return selectedIds;
  }

  private autoSelectAffordableHiringCandidates(): void {
    const selectedIds = this.affordableHiringCandidateIds();
    for (const candidate of this.hiringCandidates) {
      candidate.selected = selectedIds.has(candidate.id);
    }
  }

  private rerollsMax(): number {
    const level = this.cards["staff.talentmarket"] ?? 0;
    return level * CARD_PARAMS["staff.talentmarket"].rerollsPerLevel;
  }

  private hiringRoundsMax(): number {
    return (this.cards["staff.backfill"] ?? 0) > 0 ? 2 : 1;
  }

  private hiringRerollRate(): number | null {
    if (this.hiringRerollsUsed >= this.rerollsMax()) return null;
    const baseRate = HIRING_REROLL_RATES[this.hiringRerollsUsed] ?? null;
    return baseRate;
  }

  private candidateQuotes(): Map<number, number> {
    const counts = this.hiredThisShift.slice();
    const out = new Map<number, number>();
    for (const c of this.hiringCandidates) {
      const m = this.meta[c.species];
      if (m == null) continue;
      const t = m.tierCount;
      out.set(c.id, this.priceFor(c.species, Math.max(0, (counts[t] ?? 0) - (this.hiredThisShift[t] ?? 0))));
      if (c.selected) counts[t] = (counts[t] ?? 0) + 1;
    }
    return out;
  }

  private buildHiringView() {
    const quotes = this.candidateQuotes();
    const selected = this.hiringCandidates.filter((c) => c.selected);
    const affordableSelection = this.affordableHiringCandidateIds();
    let hireCost = 0;
    let hireCostOverflow = false;
    for (const candidate of selected) {
      const price = quotes.get(candidate.id) ?? 0;
      if (price > Number.MAX_SAFE_INTEGER - hireCost) hireCostOverflow = true;
      hireCost = addFactoryValues(hireCost, price);
    }
    const usedQuota = this.quotaUsed + selected.length;
    const poolCountMap = new Map<string, number>();
    for (const worker of this.bag) poolCountMap.set(worker.species, (poolCountMap.get(worker.species) ?? 0) + 1);
    const canAfford = !hireCostOverflow
      && this.hiringRerollSpent <= this.cash
      && hireCost <= this.cash - this.hiringRerollSpent;
    const hasQuota = usedQuota <= this.quotaMax && selected.length <= HIRING_PICK_LIMIT;
    const rerollRate = this.hiringRerollRate();
    return {
      round: this.hiringRound,
      roundsMax: this.hiringRoundsMax(),
      canContinue: this.hiringRound < this.hiringRoundsMax(),
      candidates: this.hiringCandidates.map((c) => {
        const meta = this.meta[c.species];
        return {
          ...c,
          price: quotes.get(c.id) ?? 0,
          tierCount: meta?.tierCount ?? 1,
          baseValue: this.baseForSpecies(c.species),
          reach: this.reachForSpecies(c.species),
          elements: meta?.elements.slice() ?? ["normal" as RogueElement],
        };
      }),
      selectedCount: selected.length,
      allAffordableSelected: selected.length === affordableSelection.size
        && selected.every((candidate) => affordableSelection.has(candidate.id)),
      hireCost,
      rerollSpent: this.hiringRerollSpent,
      rerollsUsed: this.hiringRerollsUsed,
      rerollsMax: this.rerollsMax(),
      rerollCost: rerollRate == null ? null : clampFactoryValue(rerollRate * this.kpi),
      canConfirm: hasQuota && canAfford,
      canAfford,
      hasQuota,
      poolCounts: [...poolCountMap.entries()]
        .map(([species, count]) => ({ species, count }))
        .sort((a, b) => b.count - a.count || a.species.localeCompare(b.species)),
      poolTotal: this.bag.length,
      projectedPoolTotal: this.bag.length + selected.length,
      inflationCounts: this.hiredThisShift.slice(1),
    };
  }

  toggleHiringCandidate(id: number): void {
    if (this.phase !== "hiring") return;
    const c = this.hiringCandidates.find((x) => x.id === id);
    if (c == null) return;
    if (!c.selected && this.hiringCandidates.filter((candidate) => candidate.selected).length >= HIRING_PICK_LIMIT) {
      return;
    }
    c.selected = !c.selected;
    this.bump();
  }

  setAllHiringCandidates(selected: boolean): void {
    if (this.phase !== "hiring") return;
    if (selected) this.autoSelectAffordableHiringCandidates();
    else for (const candidate of this.hiringCandidates) candidate.selected = false;
    this.bump();
  }

  toggleAllHiringCandidates(): void {
    if (this.phase !== "hiring") return;
    const previouslySelected = new Set(
      this.hiringCandidates.filter((candidate) => candidate.selected).map((candidate) => candidate.id),
    );
    this.autoSelectAffordableHiringCandidates();
    const autoSelected = this.hiringCandidates.filter((candidate) => candidate.selected);
    const wasAlreadyAutoSelected = previouslySelected.size === autoSelected.length
      && autoSelected.every((candidate) => previouslySelected.has(candidate.id));
    if (wasAlreadyAutoSelected) {
      for (const candidate of this.hiringCandidates) candidate.selected = false;
    }
    this.bump();
  }

  rerollHiring(): boolean {
    if (this.phase !== "hiring" || this.hiringRerollsUsed >= this.rerollsMax()) return false;
    const rate = this.hiringRerollRate();
    if (rate == null) return false;
    const cost = clampFactoryValue(rate * this.kpi);
    if (cost > this.cash - this.hiringRerollSpent) return false;
    this.hiringCandidates = this.hiringCandidates.map((c) => (c.selected ? c : this.drawCandidate()));
    this.hiringRerollsUsed++;
    this.hiringRerollSpent = addFactoryValues(this.hiringRerollSpent, cost);
    this.bump();
    return true;
  }

  confirmHiring(_continueRecruiting = false): boolean {
    if (this.phase !== "hiring") return false;
    const view = this.buildHiringView();
    if (!view.canConfirm) return false;
    const quotes = new Map(view.candidates.map((c) => [c.id, c.price]));
    const selected = this.hiringCandidates.filter((c) => c.selected);
    const hiringSpend = addFactoryValues(view.hireCost, this.hiringRerollSpent);
    this.cash -= hiringSpend;
    this.spentThisShift = addFactoryValues(this.spentThisShift, hiringSpend);
    if (view.hireCost > 0) this.shiftCashFlows.push({ kind: "hire", amount: -view.hireCost });
    if (this.hiringRerollSpent > 0) this.shiftCashFlows.push({ kind: "reroll", amount: -this.hiringRerollSpent });
    for (const c of selected) {
      const m = this.meta[c.species];
      if (m == null) continue;
      const price = quotes.get(c.id) ?? this.priceFor(c.species);
      this.bag.push({ species: c.species, price });
      this.quotaUsed++;
      const t = m.tierCount;
      this.hiredThisShift[t] = (this.hiredThisShift[t] ?? 0) + 1;
    }
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
    if (this.hiringRound < this.hiringRoundsMax()) {
      this.hiringRound++;
      this.dealHiringRound();
    } else {
      this.hiringCandidates = [];
      this.phase = "shift";
    }
    this.bump();
    return true;
  }

  /** 当前雇价（压价与冻价都直接乘到本次基准价格）。 */
  private priceFor(species: string, extraCount = 0): number {
    const m = this.meta[species];
    if (!m) return 1;
    const t = m.tierCount;
    let priceMult = 1;
    const cutLvl = this.cards["staff.pricecut"] ?? 0;
    if (cutLvl > 0 && this.pricecutTier === t) {
      const P = CARD_PARAMS["staff.pricecut"];
      priceMult *= 1 - valueAtLevel(P.cut, cutLvl);
    }
    const freezeLvl = this.cards["ice.freezeprice"] ?? 0;
    if (freezeLvl > 0 && m.elements.includes("ice")) {
      priceMult *= valueAtLevel(CARD_PARAMS["ice.freezeprice"].priceMult, freezeLvl);
    }
    return hirePrice({
      tierCount: t,
      kpi: this.kpi,
      hiredThisShift: (this.hiredThisShift[t] ?? 0) + extraCount,
      baseCut: 1 - priceMult,
    });
  }

  private buildBagPreview(): ({ species: string; price: number; baseValue: number; reach: number } | null)[] {
    const out: ({ species: string; price: number; baseValue: number; reach: number } | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const s = this.bag[i];
      const meta = s != null ? this.meta[s.species] : undefined;
      out.push(s != null ? {
        species: s.species,
        price: s.price,
        baseValue: this.baseForSpecies(s.species),
        reach: this.reachForSpecies(s.species),
      } : null);
    }
    return out;
  }

  // ---- 场景桥:载宠 / 投掷 / 落定 / 弹开 / 罢工 / 解雇 / 离场 -------------------

  nextCarried(): { species: string } | null {
    if (this.phase !== "shift") return null;
    if (hasPowerRule(this.modifier) && (this.powerThrowsLeftVal ?? 0) <= 0) return null;
    const item = this.bag[0];
    if (item == null) return null;
    return { species: item.species };
  }

  onThrow(uid: number, species: string): boolean {
    if (this.phase !== "shift") return false;
    if (hasPowerRule(this.modifier) && (this.powerThrowsLeftVal ?? 0) <= 0) return false;
    if (this.bag[0]?.species !== species) return false;
    const m = this.meta[species];
    if (!m) return false;
    const price = this.bag[0]?.price ?? 0;
    this.uidSpecies.set(uid, species);
    this.uidCost.set(uid, price);
    this.uidBase.set(uid, m.baseValue);
    if (m.elements.includes("normal")) this.bodyStates.set(uid, { uid, sizeLevel: 1 });
    this.bag.shift();
    this.stats.throws++;
    if (hasPowerRule(this.modifier) && this.powerThrowsLeftVal != null) {
      this.powerThrowsLeftVal = Math.max(0, this.powerThrowsLeftVal - 1);
      this.powerPendingThrows.add(uid);
    }
    this.bump();
    return true;
  }

  nextOvertime(): { species: string } | null {
    if (this.phase !== "overtime") return null;
    const item = this.bag[0];
    return item == null ? null : { species: item.species };
  }

  /**
   * 为池头角色寻找当前场景的最高分落点。候选覆盖每张可用桌的横向槽位，
   * 也覆盖每只已落定角色的正上方；逐个把假想角色送进同一套 computePulse，
   * 因而卡牌、吸取、连携、连击和多桌倍率都会参与比较。
   */
  onOvertimeThrow(
    uid: number,
    species: string,
    radius: number,
  ): { x: number; y: number } | null {
    if (this.phase !== "overtime" || this.snap == null) return null;
    if (this.bag[0]?.species !== species) return null;
    const meta = this.meta[species];
    if (meta == null) return null;

    const bodies = this.snap.bodies().filter((body) => body.settled);
    const logicalBodies = this.logicalBodies(bodies);
    const desks = this.snap.desks();
    const enabledDesks = desks.filter(
      (desk) => !this.disabledDesks.includes(desk.element as RogueElement),
    );
    if (enabledDesks.length === 0) return null;

    const r = Math.max(8, radius);
    const landingY = (x: number, deskTop: number): number => {
      let y = deskTop - r;
      // contactY 只由候选 x 与静态塔体决定；旧循环重复 N+2 次计算同一个最小值。
      // 一次扫描即可得到完全相同的最高接触面，把每候选 O(n²) 降为 O(n)。
      for (const body of bodies) {
        const dx = x - body.x;
        const rr = r + body.r;
        if (Math.abs(dx) >= rr) continue;
        const contactY = body.y - Math.sqrt(Math.max(1, rr * rr - dx * dx));
        if (contactY < y) y = contactY;
      }
      return y;
    };

    const candidates: { x: number; y: number }[] = [];
    for (const desk of enabledDesks) {
      const left = desk.x + r * 0.55;
      const right = desk.x + desk.w - r * 0.55;
      const slots = 7;
      for (let i = 0; i < slots; i++) {
        const x = left + ((right - left) * i) / (slots - 1);
        candidates.push({ x, y: landingY(x, desk.top) });
      }
    }
    for (const body of bodies) {
      const matching = meta.elements.some((element) => body.elements.includes(element))
        || this.stickOverride(
          {
            uid,
            species,
            elements: meta.elements,
            x: body.x,
            y: body.y - body.r - r,
            r,
            settled: true,
          },
          body,
        ) === true;
      if (!matching) continue;
      const desk = enabledDesks.reduce(
        (best, item) => (Math.abs(item.x + item.w / 2 - body.x) < Math.abs(best.x + best.w / 2 - body.x) ? item : best),
        enabledDesks[0],
      );
      candidates.push({ x: body.x, y: landingY(body.x, desk.top) });
    }

    this.uidSpecies.set(uid, species);
    this.uidCost.set(uid, this.bag[0]?.price ?? 0);
    this.uidBase.set(uid, meta.baseValue);
    if (meta.elements.includes("normal")) this.bodyStates.set(uid, { uid, sizeLevel: 1 });
    const pulseCards = cardsForElementPlacement(meta.elements, this.cards);
    const pulseStickOverride = stickOverrideForCards(pulseCards) ?? undefined;
    const pulseStateOf = (targetUid: number) => this.stateFor(targetUid);
    const baseAdjacency = buildPulseAdjacency(logicalBodies, pulseStateOf, pulseStickOverride);
    let best = candidates[0];
    let bestGain = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      const hypothetical: BodyLike = {
        uid,
        species,
        elements: meta.elements,
        x: candidate.x,
        y: candidate.y,
        r,
        settled: true,
      };
      const allBodies = [...logicalBodies, hypothetical];
      const adjacency = extendAdjacency(baseAdjacency, logicalBodies, hypothetical, {
        stickOverride: pulseStickOverride,
      });
      const pulse = computePulse(this.pulseCtx(uid, allBodies, desks, {
        adjacency,
        bodiesAreLogical: true,
        enabledDesks,
      }));
      const gain = pulse.total + pulse.extras.reduce((sum, item) => sum + item.amount, 0);
      if (
        gain > bestGain
        || (gain === bestGain && (candidate.y > best.y || (candidate.y === best.y && candidate.x < best.x)))
      ) {
        best = candidate;
        bestGain = gain;
      }
    }

    const worker = this.bag.shift();
    if (worker == null) return null;
    this.overtimePending.set(uid, { ...worker });
    this.bump();
    return best;
  }

  /** uid → 当前基础值(未知 uid 按物种 meta 兜底)。 */
  private effBaseOf(
    uid: number,
    bodies?: BodyLike[],
    cards: Record<string, number> = this.cards,
  ): number {
    const state = this.bodyStates.get(uid);
    const species = state?.speciesOverride ?? this.uidSpecies.get(uid) ?? bodies?.find((b) => b.uid === uid)?.species;
    const m = species != null ? this.meta[species] : undefined;
    const raw = this.uidBase.get(uid) ?? m?.baseValue ?? DEFAULT_BASE_VALUE;
    const elements = state?.elementsOverride ?? m?.elements ?? bodies?.find((b) => b.uid === uid)?.elements ?? [];
    return raw + baseTrainingBonus(elements, cards);
  }

  private baseForSpecies(species: string): number {
    const meta = this.meta[species];
    const raw = meta?.baseValue ?? DEFAULT_BASE_VALUE;
    return raw + baseTrainingBonus(meta?.elements ?? [], this.cards);
  }

  /** 当前链接/吸取层数，包含已购元素连通类卡牌的实时加成。 */
  private reachForSpecies(species: string): number {
    const meta = this.meta[species];
    return (meta?.reach ?? 2) + elementReachBonus(meta?.elements ?? [], this.cards);
  }

  private stateFor(uid: number, body?: BodyLike): RogueBodyState | undefined {
    const existing = this.bodyStates.get(uid);
    void body;
    return existing;
  }

  /** 将水系同化投影到本次纯计算快照。 */
  private logicalBodies(bodies: BodyLike[]): BodyLike[] {
    return bodies.map((body) => {
      const state = this.stateFor(body.uid, body);
      const species = state?.speciesOverride ?? body.species;
      const elements = state?.elementsOverride ?? body.elements;
      return species === body.species && elements === body.elements
        ? body
        : { ...body, species, elements };
    });
  }

  private pulseCtx(
    uid: number,
    bodies: BodyLike[],
    desks: DeskLike[],
    prepared?: {
      adjacency?: Adjacency;
      bodiesAreLogical?: boolean;
      enabledDesks?: DeskLike[];
    },
  ): PulseCtx {
    const tail = bodies[bodies.length - 1];
    const sourceBody = tail?.uid === uid ? tail : bodies.find((body) => body.uid === uid);
    const sourceState = this.bodyStates.get(uid);
    const sourceSpecies = sourceState?.speciesOverride ?? sourceBody?.species;
    const sourceElements = sourceState?.elementsOverride
      ?? (sourceSpecies != null ? this.meta[sourceSpecies]?.elements : undefined)
      ?? sourceBody?.elements
      ?? [];
    const cards = cardsForElementPlacement(sourceElements, this.cards);
    const logicalBodies = prepared?.bodiesAreLogical ? bodies : this.logicalBodies(bodies);
    return {
      uid,
      bodies: logicalBodies,
      desks: prepared?.enabledDesks
        ?? desks.filter((desk) => !this.disabledDesks.includes(desk.element as RogueElement)),
      meta: this.meta,
      effBase: (u) => this.effBaseOf(u, logicalBodies, cards),
      cards,
      comboStacks: this.combo,
      stateOf: (u) => this.stateFor(u),
      opts: {
        stickOverride: stickOverrideForCards(cards) ?? undefined,
        adjacency: prepared?.adjacency,
      },
    };
  }

  /** 统一入账:total + Σextras 全进现金与两条营收;顺带维护 maxPulse。返回入账额。 */
  private bookPulse(bd: PulseBreakdown): number {
    let gained = clampFactoryValue(bd.total);
    for (const e of bd.extras) gained = addFactoryValues(gained, e.amount);
    if (gained > 0) {
      this.cash = addFactoryValues(this.cash, gained);
      this.revenueTotal = addFactoryValues(this.revenueTotal, gained);
      this.revenueShift = addFactoryValues(this.revenueShift, gained);
    }
    if (gained > this.stats.maxPulse) this.stats.maxPulse = gained;
    return gained;
  }

  private freezeBody(uid: number): boolean {
    const current = this.bodyStates.get(uid) ?? { uid };
    if (current.frozen) return false;
    const wasFree = current.generated === true;
    this.bodyStates.set(uid, {
      ...current,
      frozen: true,
    });
    if (!wasFree) this.quotaUsed = Math.max(0, this.quotaUsed - 1);
    return true;
  }

  isBodyFrozen(uid: number): boolean {
    return this.bodyStates.get(uid)?.frozen === true;
  }

  isBodyGenerated(uid: number): boolean {
    return this.bodyStates.get(uid)?.generated === true;
  }

  sleepingPathUids(): number[] {
    if (this.snap == null) return [];
    const bodies = this.logicalBodies(this.snap.bodies());
    const desks = this.snap.desks();
    const settled = bodies.filter((body) => body.settled);
    const bodyKey = settled.map((body) => {
      const state = this.bodyStates.get(body.uid);
      const links = state?.absorbedLinks?.slice().sort((a, b) => a - b).join(".") ?? "";
      const bases = state?.absorbedDesks?.slice().sort().join(".") ?? "";
      return [
        body.uid,
        body.species,
        body.elements.join("."),
        Math.round(body.x * 2),
        Math.round(body.y * 2),
        Math.round(body.r * 2),
        state?.generated === true ? 1 : 0,
        links,
        bases,
      ].join(":");
    }).join("|");
    const deskKey = desks.map((desk) => [
      desk.element,
      Math.round(desk.x * 2),
      Math.round(desk.w * 2),
      Math.round(desk.top * 2),
    ].join(":")).join("|");
    const cardKey = Object.entries(this.cards)
      .filter(([, level]) => level > 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, level]) => `${id}:${level}`)
      .join("|");
    const cacheKey = `${cardKey}::${deskKey}::${bodyKey}`;
    if (this.sleepingPathCache?.key === cacheKey) return this.sleepingPathCache.uids;

    const adjacency = buildAdjacency(bodies, {
      stickOverride: (a, b) => this.stickOverride(a, b),
    });

    // 吸收会把原连接转移给吞噬者；视觉通路必须与脉冲计算使用同一张图。
    for (const body of bodies) {
      for (const targetUid of this.bodyStates.get(body.uid)?.absorbedLinks ?? []) {
        if (!adjacency.has(targetUid) || targetUid === body.uid) continue;
        const own = adjacency.get(body.uid)!;
        const target = adjacency.get(targetUid)!;
        if (!own.includes(targetUid)) own.push(targetUid);
        if (!target.includes(body.uid)) target.push(body.uid);
      }
    }

    const extraBases: Record<string, number[]> = {};
    for (const body of bodies) {
      for (const element of this.bodyStates.get(body.uid)?.absorbedDesks ?? []) {
        (extraBases[element] ??= []).push(body.uid);
      }
    }

    const uids = [...mismatchedDeskPathUids(bodies, adjacency, desks, {
      relayAllowed: relayAllowedForCards(this.cards, (uid) => this.bodyStates.get(uid)),
      extraBases,
    })];
    this.sleepingPathCache = { key: cacheKey, uids };
    return uids;
  }

  bodyScale(uid: number): number {
    const mass = Math.max(1, this.bodyStates.get(uid)?.sizeLevel ?? 1);
    // The first absorption should read as a real size upgrade at a glance.
    // Keep logarithmic growth and the existing cap so later merges do not
    // overwhelm the factory scene.
    return Math.min(1.85, 1 + Math.log2(mass) * 0.5);
  }

  takeBodyMutations(): RogueBodyMutation[] {
    if (this.bodyMutations.length === 0) return [];
    return this.bodyMutations.splice(0, this.bodyMutations.length);
  }

  private growBody(uid: number, amount = 1): number {
    const current = this.bodyStates.get(uid) ?? { uid };
    const next = Math.max(1, current.sizeLevel ?? 1) + Math.max(1, amount);
    this.bodyStates.set(uid, { ...current, sizeLevel: next });
    return next;
  }

  /** 吞掉一个单位并把基础分、人口与逻辑连接完整转移给吞噬者。 */
  private absorbBody(
    sourceUid: number,
    targetUid: number,
    physicalBodies: BodyLike[],
    bd: PulseBreakdown,
    triggerKind: "absorb" | "emperor",
  ): boolean {
    // 加班员工只临时落场计分，随后原样返池；禁止它在离场前吞掉永久塔体。
    if (this.phase === "overtime") return false;
    if (
      sourceUid === targetUid
      || this.bodyMutations.some((item) => (
        item.kind === "absorb"
        && (item.targetUid === sourceUid || item.targetUid === targetUid)
      ))
    ) return false;
    const bodies = this.logicalBodies(physicalBodies);
    const source = bodies.find((body) => body.uid === sourceUid);
    const target = bodies.find((body) => body.uid === targetUid);
    if (source == null || target == null) return false;
    const initialSourceState = this.bodyStates.get(sourceUid) ?? { uid: sourceUid };
    const initialTargetState = this.bodyStates.get(targetUid) ?? { uid: targetUid };
    const initialSourceMass = Math.max(1, initialSourceState.sizeLevel ?? 1);
    const initialTargetMass = Math.max(1, initialTargetState.sizeLevel ?? 1);

    // 吸收永远由等级较高的一方完成；同级时保留技能触发者为吸收者。
    // 因此小体型尝试吸收大体型时，会反过来被大体型吸收。
    const reversed = initialTargetMass > initialSourceMass;
    const absorberUid = reversed ? targetUid : sourceUid;
    const absorbedUid = reversed ? sourceUid : targetUid;
    const absorber = reversed ? target : source;
    const absorbed = reversed ? source : target;
    const absorberState = reversed ? initialTargetState : initialSourceState;
    const absorbedState = reversed ? initialSourceState : initialTargetState;
    const absorberMass = reversed ? initialTargetMass : initialSourceMass;
    const absorbedMass = reversed ? initialSourceMass : initialTargetMass;

    const adjacency = buildAdjacency(bodies, {
      stickOverride: stickOverrideForCards(this.cards) ?? undefined,
    });
    const inheritedLinks = [
      ...(absorberState.absorbedLinks ?? []),
      ...(absorbedState.absorbedLinks ?? []),
      ...(adjacency.get(absorbedUid) ?? []).filter((uid) => uid !== absorberUid && uid !== absorbedUid),
    ].filter((uid, index, all) => uid !== absorbedUid && uid !== absorberUid && all.indexOf(uid) === index);
    const inheritedDesks = new Set<RogueElement>([
      ...(absorberState.absorbedDesks ?? []),
      ...(absorbedState.absorbedDesks ?? []),
    ]);
    const bases = deskBases(bodies, this.snap?.desks() ?? []);
    for (const [element, uids] of bases) {
      if (uids.includes(absorbedUid)) inheritedDesks.add(element as RogueElement);
    }

    const absorberRaw = this.uidBase.get(absorberUid)
      ?? this.meta[absorber.species]?.baseValue
      ?? DEFAULT_BASE_VALUE;
    const absorbedRaw = this.uidBase.get(absorbedUid)
      ?? this.meta[absorbed.species]?.baseValue
      ?? DEFAULT_BASE_VALUE;
    this.uidBase.set(absorberUid, addFactoryValues(absorberRaw, absorbedRaw));
    this.bodyStates.set(absorberUid, {
      ...absorberState,
      sizeLevel: absorberMass + absorbedMass,
      absorbedLinks: inheritedLinks,
      absorbedDesks: [...inheritedDesks],
    });
    if (!absorbedState.frozen && !absorbedState.generated) {
      this.quotaUsed = Math.max(0, this.quotaUsed - 1);
    }
    this.uidSpecies.delete(absorbedUid);
    this.uidCost.delete(absorbedUid);
    this.uidBase.delete(absorbedUid);
    this.bodyStates.delete(absorbedUid);
    this.refunded.delete(absorbedUid);
    this.bodyMutations.push({ kind: "absorb", sourceUid: absorberUid, targetUid: absorbedUid });
    bd.triggers = [
      ...(bd.triggers ?? []),
      {
        kind: triggerKind,
        sourceUid: absorberUid,
        targetUids: [absorbedUid],
        value: absorberMass + absorbedMass,
        persistent: true,
      },
    ];
    return true;
  }

  /** 主脉冲入账后的状态阶段：每类状态单次最多成功一次，禁止当次递归计分。 */
  private applyPostPulseEffects(bd: PulseBreakdown, physicalBodies: BodyLike[]): void {
    const sourceBody = physicalBodies.find((body) => body.uid === bd.uid);
    const sourceState = this.bodyStates.get(bd.uid);
    const sourceSpecies = sourceState?.speciesOverride ?? sourceBody?.species;
    const sourceElements = sourceState?.elementsOverride
      ?? (sourceSpecies != null ? this.meta[sourceSpecies]?.elements : undefined)
      ?? sourceBody?.elements
      ?? [];
    const cards = cardsForElementPlacement(sourceElements, this.cards);
    const bodies = this.logicalBodies(physicalBodies);
    const byUid = new Map(bodies.map((body) => [body.uid, body]));
    const self = byUid.get(bd.uid);
    if (self == null || bd.total <= 0) return;
    const absorbed = bd.absorbUids.map((uid) => byUid.get(uid)).filter((body): body is BodyLike => body != null);

    const freezeLevel = cards["ice.freeze"] ?? 0;
    if (freezeLevel > 0 && self.elements.includes("ice")) {
      const targets = absorbed.filter((body) => body.y > self.y && !this.bodyStates.get(body.uid)?.frozen);
      const target = targets[Math.floor(this.rng() * targets.length)];
      if (
        target != null
        && this.rng() < valueAtLevel(CARD_PARAMS["ice.freeze"].chance, freezeLevel)
        && this.freezeBody(target.uid)
      ) {
        bd.triggers = [
          ...(bd.triggers ?? []),
          {
            kind: "freeze",
            sourceUid: self.uid,
            targetUids: [target.uid],
            persistent: true,
          },
          ...((cards["syn.coldRotation"] ?? 0) > 0
            ? [{
                kind: "coldRotation" as const,
                sourceUid: self.uid,
                targetUids: [target.uid],
                persistent: true,
              }]
            : []),
        ];
      }
    }

    const convertLevel = cards["water.convert"] ?? 0;
    if (convertLevel > 0 && self.elements.includes("water")) {
      const desks = this.snap?.desks() ?? [];
      const targets = absorbed
        .filter((body) => body.uid !== self.uid && !body.elements.includes("water"))
        .map((body) => {
          const pulse = computePulse(this.pulseCtx(body.uid, physicalBodies, desks));
          const amount = pulse.total + pulse.extras.reduce((sum, extra) => sum + extra.amount, 0);
          return { body, amount };
        })
        .sort((left, right) => right.amount - left.amount || left.body.uid - right.body.uid);
      const picked = targets.slice(0, valueAtLevel(CARD_PARAMS["water.convert"].targets, convertLevel));
      const converted: number[] = [];
      for (const { body: target } of picked) {
          const current = this.bodyStates.get(target.uid) ?? { uid: target.uid };
          const sourceState = this.stateFor(self.uid, self);
          const sourceInnateElements = sourceState?.elementsOverride
            ?? this.meta[self.species]?.elements
            ?? self.elements;
          const convertedElements = sourceInnateElements.filter((element): element is RogueElement => (
            element === "fire" || element === "water" || element === "grass"
            || element === "electric" || element === "ice" || element === "normal"
          ));
          this.bodyStates.set(target.uid, {
            ...current,
            speciesOverride: self.species,
            elementsOverride: convertedElements,
          });
          this.bodyMutations.push({
            kind: "convert",
            sourceUid: self.uid,
            targetUid: target.uid,
            species: self.species,
            elements: convertedElements,
          });
          converted.push(target.uid);
      }
      if (converted.length > 0) {
        bd.triggers = [
          ...(bd.triggers ?? []),
          {
            kind: "convert",
            sourceUid: self.uid,
            targetUids: converted,
            value: converted.length,
          },
        ];
      }
    }

    const absorbLevel = cards["normal.absorb"] ?? 0;
    if (this.phase !== "overtime" && absorbLevel > 0 && self.elements.includes("normal")) {
      const adjacency = buildAdjacency(bodies, {
        stickOverride: stickOverrideForCards(cards) ?? undefined,
      });
      const targets = (adjacency.get(self.uid) ?? [])
        .map((uid) => byUid.get(uid))
        .filter((body): body is BodyLike => body != null)
        .sort((left, right) => {
          const dl = (left.x - self.x) ** 2 + (left.y - self.y) ** 2;
          const dr = (right.x - self.x) ** 2 + (right.y - self.y) ** 2;
          return dl - dr || left.uid - right.uid;
        });
      const badgeLevel = cards["syn.badge"] ?? 0;
      const chance = valueAtLevel(CARD_PARAMS["normal.absorb"].chance, absorbLevel);
      const maxTargets = valueAtLevel(CARD_PARAMS["normal.absorb"].targets, absorbLevel);
      const absorbedTargets: number[] = [];
      for (const target of targets.slice(0, maxTargets)) {
        if (this.rng() >= chance) continue;
        if (this.absorbBody(self.uid, target.uid, physicalBodies, bd, "absorb")) {
          absorbedTargets.push(target.uid);
          if (!this.bodyStates.has(self.uid)) break;
        }
      }
      if (
        absorbedTargets.length > 0
        && this.bodyStates.has(self.uid)
        && badgeLevel > 0
        && self.elements.includes("water")
      ) {
        const mult = valueAtLevel(CARD_PARAMS["syn.badge"].mult, badgeLevel);
        const amount = Math.round(bd.total * (mult - 1));
        if (amount > 0) {
          bd.extras.push({ kind: "echo", uid: self.uid, amount });
          bd.cardContributions = [
            ...(bd.cardContributions ?? []),
            { id: "syn.badge", amount },
          ];
        }
        bd.triggers = [
          ...(bd.triggers ?? []),
          { kind: "badge", sourceUid: self.uid, targetUids: absorbedTargets, value: mult },
        ];
      }
    }

    const growLevel = cards["grass.grow"] ?? 0;
    const greenhouseLevel = cards["syn.greenhouse"] ?? 0;
    const greenhouseParent = self.elements.includes("fire")
      ? absorbed.find((body) => body.elements.includes("grass"))
      : undefined;
    const growParent = self.elements.includes("grass") ? self : greenhouseParent;
    if (growLevel > 0 && growParent != null) {
      const irrigationLevel = cards["syn.irrigation"] ?? 0;
      let chance = valueAtLevel(CARD_PARAMS["grass.grow"].chance, growLevel);
      if (greenhouseLevel > 0 && self.elements.includes("fire")) {
        chance += valueAtLevel(CARD_PARAMS["syn.greenhouse"].chance, greenhouseLevel);
      }
      if (irrigationLevel > 0 && growParent.elements.includes("water")) {
        chance *= valueAtLevel(CARD_PARAMS["syn.irrigation"].chanceMult, irrigationLevel);
      }
      if (this.rng() < Math.min(1, chance)) {
        // 生长体必须能接入本次已经结算成功的元素桌；否则即使是草系，也可能
        // 落在塔上却没有任何可计分通路，形成误导性的“免费但断网”角色。
        const connectedDesks = new Set(bd.desks);
        const grassSpecies = this.loadout.filter((species) => {
          const elements = this.meta[species]?.elements ?? [];
          return elements.includes("grass") && elements.some((element) => connectedDesks.has(element));
        });
        const sameWaterGrass = growParent.elements.includes("water") && grassSpecies.includes(growParent.species);
        const species = sameWaterGrass
          ? growParent.species
          : grassSpecies[Math.floor(this.rng() * grassSpecies.length)];
        if (species != null) {
          const parentState = this.stateFor(growParent.uid, growParent);
          const multiSeedLevel = cards["syn.multiSeed"] ?? 0;
          const growsInPlace = this.phase === "overtime";
          const inheritedMass = multiSeedLevel > 0 && growParent.elements.includes("normal")
            ? Math.max(
                1,
                Math.round(
                  Math.max(1, parentState?.sizeLevel ?? 1)
                  * valueAtLevel(CARD_PARAMS["syn.multiSeed"].inheritMass, multiSeedLevel),
                ),
              )
            : 1;
          const greenhouseCopies = greenhouseLevel > 0 && self.elements.includes("fire")
            ? valueAtLevel(CARD_PARAMS["syn.greenhouse"].growCopies, greenhouseLevel)
            : 1;
          const irrigationCopies = irrigationLevel > 0 && growParent.elements.includes("water")
            ? valueAtLevel(CARD_PARAMS["syn.irrigation"].growCopies, irrigationLevel)
            : 1;
          const copyCount = Math.max(greenhouseCopies, irrigationCopies);
          for (let copy = 0; copy < copyCount; copy++) {
            const direction = copy % 2 === 0 ? -1 : 1;
            const spread = 1 + Math.floor(copy / 2) * 0.55;
            this.generatedSpawns.push({
              species,
              // 单体加班生长继续原位补洞；满级多体生长向两侧展开，避免重叠。
              x: growsInPlace && copyCount === 1
                ? growParent.x
                : growParent.x + direction * spread * Math.max(34, growParent.r * 1.45),
              y: growsInPlace && copyCount === 1
                ? growParent.y
                : growParent.y - Math.max(34, growParent.r * 1.25) - Math.floor(copy / 2) * 6,
              parentUid: growParent.uid,
              generated: true,
              sizeLevel: inheritedMass,
              readyAt: typeof performance === "undefined" ? undefined : performance.now() + 1020,
            });
          }
          bd.triggers = [
            ...(bd.triggers ?? []),
            {
              kind: "grow",
              sourceUid: growParent.uid,
              persistent: true,
            },
            ...(greenhouseLevel > 0 && self.elements.includes("fire")
              ? [{ kind: "greenhouse" as const, sourceUid: growParent.uid }]
              : []),
            ...(irrigationLevel > 0 && growParent.elements.includes("water")
              ? [{ kind: "irrigation" as const, sourceUid: growParent.uid }]
              : []),
            ...(multiSeedLevel > 0
              ? [{ kind: "multiSeed" as const, sourceUid: growParent.uid }]
              : []),
          ];
        }
      }
    }

    const emperorLevel = cards["normal.emperor"] ?? 0;
    if (emperorLevel > 0) {
      // 与脉冲层保持同一术语：团队 = 投放者 + 本次压榨成员。
      const team = [self.uid, ...bd.absorbUids]
        .map((uid) => byUid.get(uid))
        .filter((body): body is BodyLike => body?.elements.includes("normal") === true)
        .filter((body) => !this.bodyMutations.some((item) => item.targetUid === body.uid))
        .sort((left, right) => {
          const leftMass = Math.max(1, this.bodyStates.get(left.uid)?.sizeLevel ?? 1);
          const rightMass = Math.max(1, this.bodyStates.get(right.uid)?.sizeLevel ?? 1);
          return rightMass - leftMass || left.uid - right.uid;
        });
      const worker = team[0];
      if (worker != null) {
        const newMass = this.growBody(
          worker.uid,
          valueAtLevel(CARD_PARAMS["normal.emperor"].grow, emperorLevel),
        );
        bd.triggers = [
          ...(bd.triggers ?? []),
          { kind: "emperor", sourceUid: worker.uid, value: newMass, persistent: true },
        ];
        // 体型已经由场景直接显示；长大后把可视圆完整包住的所有咕噜一次吞掉。
        // 每次吞噬都会继续增大体型，因此循环到没有新的完全遮挡目标为止。
        while (true) {
          const sourceRadius = worker.r * this.bodyScale(worker.uid);
          const covered = this.logicalBodies(physicalBodies)
            .filter((target) => target.uid !== worker.uid)
            .filter((target) => !this.bodyMutations.some((item) => item.targetUid === target.uid))
            .filter((target) => {
              const targetRadius = target.r * this.bodyScale(target.uid);
              const distance = Math.hypot(target.x - worker.x, target.y - worker.y);
              return distance + targetRadius <= sourceRadius + 0.001;
            })
            .sort((left, right) => {
              const dl = (left.x - worker.x) ** 2 + (left.y - worker.y) ** 2;
              const dr = (right.x - worker.x) ** 2 + (right.y - worker.y) ** 2;
              return dl - dr || left.uid - right.uid;
            });
          if (covered.length === 0) break;
          let absorbedAny = false;
          for (const target of covered) {
            absorbedAny = this.absorbBody(worker.uid, target.uid, physicalBodies, bd, "emperor")
              || absorbedAny;
          }
          if (!absorbedAny) break;
        }
      }
    }
  }

  takeGeneratedSpawn(uid: number): RogueSpawnRequest | null {
    const head = this.generatedSpawns[0];
    if (head?.readyAt != null && typeof performance !== "undefined" && performance.now() < head.readyAt) {
      return null;
    }
    const request = this.generatedSpawns.shift();
    if (request == null) return null;
    const meta = this.meta[request.species];
    if (meta == null) return null;
    this.uidSpecies.set(uid, request.species);
    this.uidCost.set(uid, 0);
    this.uidBase.set(uid, meta.baseValue);
    this.bodyStates.set(uid, {
      uid,
      generated: true,
      sizeLevel: request.sizeLevel ?? 1,
    });
    this.bump();
    return request;
  }

  // ---- hit-stop 慢镜(04 §3:大脉冲/多接桌短暂减速,场景 rAF 经 timeScale 消费) ----

  private hitStopUntil = 0;
  private hitStopScale = 1;

  private hitStop(ms: number, scale: number): void {
    if (typeof performance === "undefined") return;
    const until = performance.now() + ms;
    if (until > this.hitStopUntil) {
      this.hitStopUntil = until;
      this.hitStopScale = scale;
    }
  }

  timeScale(): number {
    if (typeof performance === "undefined") return 1;
    return performance.now() < this.hitStopUntil ? this.hitStopScale : 1;
  }

  /** 首班教学桌加宽(04 §11);整个第 1 班生效,第 2 班开班回正(重排引发的
   *  重新落体按塌方重组处理,教学期塔小,代价可控)。 */
  deskWiden(): number {
    return !this.endless && this.shiftIndex === 1 ? 1.35 : 1;
  }

  /** 破产预警(01 §10 预测口径):账单与本期还贷 > 现金 + 本班剩余 KPI 缺口。 */
  private computeDanger(): boolean {
    if (this.phase !== "shift") return false;
    const requiredPayment = addFactoryValues(this.bill, this.nextLoanPayment());
    return this.cash + Math.max(0, this.kpi - this.revenueShift) < requiredPayment;
  }

  onSettled(uid: number): void {
    if (this.snap == null) return;
    // 收班瞬间仍在空中的「物理尾巴」照常入账(溢出计入总营收);破产/结算后丢弃。
    if (this.phase !== "shift" && this.phase !== "overtime" && this.phase !== "shop") return;
    const bodies = this.snap.bodies();
    if (!bodies.some((b) => b.uid === uid)) return;
    const desks = this.snap.desks();
    const rawCtx = this.pulseCtx(uid, bodies, desks);
    // 一次落地会为每张已持有卡重算“移除该卡后的贡献”。绝大多数卡不会改变
    // 粘连结构，因此先建一次完整图供主结算、禁运探测和各卡贡献共同复用。
    const baseCtx: PulseCtx = {
      ...rawCtx,
      opts: {
        ...rawCtx.opts,
        adjacency: buildPulseAdjacency(
          rawCtx.bodies,
          rawCtx.stateOf,
          rawCtx.opts?.stickOverride,
        ),
      },
    };
    const bd = computePulse(baseCtx);
    if (bd.deskCount === 0 && this.disabledDesks.length > 0) {
      // 计分上下文会先过滤禁运桌。额外用完整桌表探测一次，供演出层区分
      // “没有连通”与“已经连通，但该元素本班次不计分”。
      const withDisabled = computePulse({ ...baseCtx, desks });
      bd.disabledDeskElements = withDisabled.desks.filter(
        (element): element is RogueElement => this.disabledDesks.includes(element as RogueElement),
      );
    }
    const overtimeWorker = this.phase === "overtime" ? this.overtimePending.get(uid) : undefined;
    if (overtimeWorker != null) bd.overtime = true;
    const fullGain = bd.total + bd.extras.reduce((sum, item) => sum + item.amount, 0);
    bd.cardContributions = Object.entries(this.cards).flatMap(([id, level]) => {
      if (level <= 0) return [];
      const withoutCards = { ...baseCtx.cards, [id]: 0 };
      const changesConnectivity = id === "syn.lightningrod" || id === "syn.permafrost";
      const without = computePulse({
        ...baseCtx,
        cards: withoutCards,
        opts: changesConnectivity
          ? {
              ...baseCtx.opts,
              adjacency: undefined,
              stickOverride: stickOverrideForCards(withoutCards) ?? undefined,
            }
          : baseCtx.opts,
      });
      const withoutGain = without.total + without.extras.reduce((sum, item) => sum + item.amount, 0);
      const amount = Math.max(0, fullGain - withoutGain);
      return amount > 0 ? [{ id, amount }] : [];
    });
    this.applyPostPulseEffects(bd, bodies);
    const convertGain = bd.extras
      .filter((extra) => extra.kind === "convertEcho")
      .reduce((sum, extra) => sum + extra.amount, 0);
    if (convertGain > 0) {
      bd.cardContributions = [
        ...(bd.cardContributions ?? []),
        { id: "water.convert", amount: convertGain },
      ];
    }
    const emperorGain = bd.extras
      .filter((extra) => extra.kind === "emperor")
      .reduce((sum, extra) => sum + extra.amount, 0);
    if (emperorGain > 0) {
      bd.cardContributions = [
        ...(bd.cardContributions ?? []),
        { id: "normal.emperor", amount: emperorGain },
      ];
    }
    const gained = this.bookPulse(bd);
    // A disabled-desk landing is still surfaced as a zero-value pulse so the
    // scene can explain why it did not score. It must not prime the combo for
    // the next valid landing: only revenue-producing work continues a streak.
    if (gained > 0) {
      this.combo++;
      if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;
    } else {
      this.combo = 0;
    }
    if (bd.deskCount > this.stats.maxDesks) this.stats.maxDesks = bd.deskCount;
    // hit-stop 分档(04 §3):红光档 130ms、彩虹档 220ms;多接桌 jackpot 定格 180ms。
    if (gained >= PULSE_TIERS[4].min) this.hitStop(220, 0.12);
    else if (gained >= PULSE_TIERS[3].min) this.hitStop(130, 0.18);
    if (bd.deskCount >= 2) this.hitStop(180, 0.15);
    this.pulses.push(bd);
    this.shiftPulses.push(bd);
    this.powerPendingThrows.delete(uid);
    if (this.phase === "shift" && this.revenueShift >= this.kpi) this.startOvertime();
    else this.finishPowerIfSpent();
    if (overtimeWorker != null && !this.overtimeScored.has(uid)) {
      // 加班角色只临时参与这一次脉冲：先记入返池队列，场景随后让它逃离；
      // 真正出屏时 onGone("overtime") 才结束该角色的加班流程。
      this.overtimeScored.add(uid);
      this.overtimeReturned.push({ ...overtimeWorker });
    }
    this.bump();
  }

  onBounced(uid: number, _species: string): void {
    if (this.phase !== "shift" && this.phase !== "overtime" && this.phase !== "shop") return;
    const overtimeWorker = this.phase === "overtime" ? this.overtimePending.get(uid) : undefined;
    this.combo = 0;
    this.stats.bounces++;
    if (overtimeWorker != null && !this.overtimeScored.has(uid)) {
      // 理论上自动落点不会弹开；兜底仍把员工安全返池，不造成永久损耗。
      this.overtimeScored.add(uid);
      this.overtimeReturned.push({ ...overtimeWorker });
    }
    this.bump();
  }

  /** 遣散费退款率：25% / 50% / 100% / 200% / 300%。 */
  private severanceRefundRate(): number {
    const lvl = this.cards["staff.severance"] ?? 0;
    if (lvl <= 0) return 0;
    const table = CARD_PARAMS["staff.severance"].refund;
    return Math.min(table[Math.min(lvl, table.length) - 1], SEVERANCE_REFUND_HARD_CAP);
  }

  /** Scene feedback quote for one departure. It shares the exact ledger
   * formula and settled-state gate so rejected duplicate events stay silent. */
  departureFeedback(uid: number, minimumRate = 0): { accepted: boolean; refund: number } {
    if (!this.uidSpecies.has(uid) || this.refunded.has(uid)) return { accepted: false, refund: 0 };
    const rate = Math.min(SEVERANCE_REFUND_HARD_CAP, Math.max(minimumRate, this.severanceRefundRate()));
    const nominalRefund = clampFactoryValue(Math.floor((this.uidCost.get(uid) ?? 0) * rate));
    // At the numeric safety ceiling only the remaining wallet room is actually
    // credited. Quote that exact amount so fly text and the receipt never claim
    // more than the ledger can store.
    const refund = Math.min(nominalRefund, Math.max(0, FACTORY_VALUE_CAP - this.cash));
    return {
      accepted: true,
      refund,
    };
  }

  /** 单只离场账务：解雇至少退 100% 最新雇价；遣散费与其不叠加，取较高者。 */
  private settleDeparture(uid: number, minimumRate = 0): boolean {
    // The scene removes a dismissed/striking body after its exit animation.
    // Pointer spam or duplicate collision reports can arrive during that gap;
    // settle each worker's departure ledger exactly once.
    const feedback = this.departureFeedback(uid, minimumRate);
    if (!feedback.accepted) return false;
    this.refunded.add(uid);
    if (feedback.refund > 0) {
      this.cash = addFactoryValues(this.cash, feedback.refund);
      this.recordIncomeCashFlow("refund", feedback.refund);
    }
    return true;
  }

  onStrike(uids: number[], species: string): void {
    if (this.snap == null) return;
    if (this.phase !== "shift" && this.phase !== "shop") return;
    // 场景保证调用时 bodies 快照仍含这些宠(举牌演出先于移除)。
    const bodies = this.snap.bodies();
    const desks = this.snap.desks();
    const groupHasWater = uids.some((uid) => {
      const body = bodies.find((candidate) => candidate.uid === uid);
      const state = this.bodyStates.get(uid);
      const effectiveSpecies = state?.speciesOverride ?? body?.species ?? species;
      const elements = state?.elementsOverride
        ?? this.meta[effectiveSpecies]?.elements
        ?? body?.elements
        ?? [];
      return elements.includes("water");
    });
    const fourdayLvl = groupHasWater ? (this.cards["water.fourday"] ?? 0) : 0;
    const fourdayRate = fourdayLvl > 0
      ? valueAtLevel(CARD_PARAMS["water.fourday"].strikeBonus, fourdayLvl)
      : 0;
    // Empty groups are a valid rules-level strike signal (used by resumed and
    // headless runs); non-empty groups are deduplicated by worker uid.
    let settledAny = uids.length === 0;
    for (const uid of uids) {
      if (!this.settleDeparture(uid)) continue;
      settledAny = true;
      const body = bodies.find((candidate) => candidate.uid === uid);
      if (fourdayRate <= 0 || body?.species !== species) continue;
      const source = computePulse(this.pulseCtx(uid, bodies, desks));
      const sourceAmount = source.total + source.extras.reduce((sum, extra) => sum + extra.amount, 0);
      const amount = Math.round(sourceAmount * fourdayRate);
      if (amount <= 0) continue;
      const bonus: PulseBreakdown = {
        ...source,
        total: 0,
        extras: [{ kind: "workRest", uid, amount }],
        cardContributions: [{ id: "water.fourday", amount }],
        triggers: [
          ...(source.triggers ?? []),
          { kind: "workRest", sourceUid: uid, targetUids: uids.slice() },
        ],
      };
      this.bookPulse(bonus);
      this.pulses.push(bonus);
      this.shiftPulses.push(bonus);
    }
    if (!settledAny) return;
    this.stats.strikes++;
    if (this.phase === "shift") this.shiftStrikeCount++;
    if (this.phase === "shift" && this.revenueShift >= this.kpi) this.startOvertime();
    this.bump();
  }

  onDismissPick(uid: number): void {
    if (this.pendingDismissN <= 0 || this.snap == null) return;
    if (this.phase !== "shift" && this.phase !== "shop") return;
    const species = this.uidSpecies.get(uid);
    if (species == null) return;
    if (!this.settleDeparture(uid, 1)) return;
    this.pendingDismissN--;
    this.stats.dismissals++;
    if (this.phase === "shift" && this.revenueShift >= this.kpi) this.startOvertime();
    this.bump();
  }

  onGone(uid: number, reason: "strike" | "dismiss" | "rolloff" | "overtime"): void {
    // 场景层即使因罢工/坍塌等竞态给了别的原因，只要 uid 仍登记在加班流程中，
    // 就必须按返池处理，绝不能永久损耗或让 overtimeRemaining 卡死。
    if (reason === "overtime" || this.overtimePending.has(uid)) {
      const worker = this.overtimePending.get(uid);
      if (worker != null && !this.overtimeScored.has(uid)) {
        // 场景异常跳过落定上报时也不能吃掉员工；只返池、不补发得分。
        this.overtimeReturned.push({ ...worker });
      }
      this.overtimePending.delete(uid);
      this.overtimeScored.delete(uid);
      this.uidSpecies.delete(uid);
      this.uidCost.delete(uid);
      this.uidBase.delete(uid);
      this.refunded.delete(uid);
      this.bodyStates.delete(uid);
      this.finishOvertimeIfReady();
      this.bump();
      return;
    }
    const state = this.bodyStates.get(uid);
    this.powerPendingThrows.delete(uid);
    if (!state?.frozen && !state?.generated) this.quotaUsed = Math.max(0, this.quotaUsed - 1);
    this.uidSpecies.delete(uid);
    this.uidCost.delete(uid);
    this.uidBase.delete(uid);
    this.refunded.delete(uid);
    this.bodyStates.delete(uid);
    this.finishPowerIfSpent();
    this.bump();
  }

  registerSnapshots(fns: { bodies: () => BodyLike[]; desks: () => DeskLike[] }): void {
    this.snap = fns;
  }

  // ---- 收班 / 商店 / 下一班 ---------------------------------------------------

  /** KPI 达标后统一进入加班时间；场景先播放达标仪式，再开始自动投放。 */
  private startOvertime(): void {
    if (this.phase !== "shift") return;
    const bonus = kpiBonusFor(this.kpi);
    if (bonus > 0) {
      this.cash = addFactoryValues(this.cash, bonus);
      this.revenueTotal = addFactoryValues(this.revenueTotal, bonus);
      this.revenueShift = addFactoryValues(this.revenueShift, bonus);
      this.recordIncomeCashFlow("kpiBonus", bonus);
    }
    this.rushArmed = false;
    this.rushDeadline = null;
    this.powerPendingThrows.clear();
    this.overtimePending.clear();
    this.overtimeScored.clear();
    this.overtimeReturned = [];
    this.phase = "overtime";
    this.bump();
  }

  /** KPI 达标仪式结束，由场景解锁自动加班；空池在此刻才进入工资单。 */
  beginOvertimeScoring(): void {
    if (this.phase !== "overtime") return;
    this.finishOvertimeIfReady();
  }

  private finishOvertimeIfReady(): void {
    if (this.phase !== "overtime") return;
    if (this.bag.length > 0 || this.overtimePending.size > 0) return;
    // 加班员工不构成永久塔体，也不消耗名额：全部逃走后回到下一班可用的雇佣池。
    this.bag = this.overtimeReturned.map((item) => ({ ...item }));
    this.overtimeReturned = [];
    this.overtimeScored.clear();
    this.endShift();
  }

  /** 加班池全部结算：冻结本班账本，进入工资单；此时账单尚未扣除。 */
  private endShift(): void {
    if (this.phase !== "shift" && this.phase !== "overtime") return;
    const loanPayment = this.nextLoanPayment();
    const requiredPayment = addFactoryValues(this.bill, loanPayment);
    this.settlement = {
      shiftIndex: this.shiftIndex,
      spentTotal: this.spentThisShift,
      receivedTotal: this.revenueShift,
      bill: this.bill,
      cashBeforeBill: this.cash,
      cashAfterBill: Math.max(0, this.cash - this.bill),
      loanPayment,
      requiredPayment,
      cashAfterPayment: Math.max(0, this.cash - requiredPayment),
      shortfall: Math.max(0, requiredPayment - this.cash),
      pulses: this.shiftPulses.slice(),
      cashFlows: this.shiftCashFlows.map((x) => ({ ...x })),
    };
    this.rushArmed = false;
    this.rushDeadline = null;
    this.powerPendingThrows.clear();
    this.phase = "settlement";
    this.bump();
  }

  /** UI 付款动画结束后提交；幂等地只允许 settlement → shop/bankrupt 一次。 */
  confirmSettlement(): boolean {
    if (this.phase !== "settlement" || this.settlement == null) return false;
    const loanPayment = this.loan == null
      ? 0
      : (this.settlement.loanPayment ?? this.nextLoanPayment());
    const requiredPayment = this.settlement.requiredPayment
      ?? addFactoryValues(this.bill, loanPayment);
    if (this.cash < requiredPayment) {
      this.bankrupt();
      return false;
    }
    // 账单和贷款是同一笔必要支付：先验证全额可付，再一次性扣除。
    // 这样临界不足不会留下“账单已扣、贷款未还”的半提交破产状态。
    this.cash -= requiredPayment;
    if (this.loan != null) {
      this.loan.paid += loanPayment;
      this.loan.shiftsLeft--;
      if (this.loan.shiftsLeft <= 0) this.loan = null;
    }
    this.inspectionMask |= inspectionBitForShift(this.shiftIndex);
    if (this.shiftStrikeCount >= 3) this.strikeClearEver = true;
    this.rushArmed = false;
    this.rushDeadline = null;
    this.rushAcc = 0;
    this.powerThrowsLeftVal = null;
    this.powerPendingThrows.clear();
    this.windFlipAt = null;
    this.quotaMax += QUOTA_PER_SHIFT;
    this.shopOffer = buildOffer(this.rng, this.offerArgs());
    this.settlement = null;
    this.phase = "shop";
    this.bump();
    return true;
  }

  private offerArgs(): OfferArgs {
    const loadoutElementCounts: Partial<Record<RogueElement, number>> = {};
    for (const species of this.loadout) {
      for (const element of this.meta[species]?.elements ?? []) {
        loadoutElementCounts[element] = (loadoutElementCounts[element] ?? 0) + 1;
      }
    }
    return {
      loadoutElements: this.loadoutEls,
      loadoutElementCounts,
      cardLevels: this.cards,
      activeLoan: this.loan != null,
    };
  }

  buyCard(dimIndex: 0 | 1 | 2, cardId: string): boolean {
    if (this.phase !== "shop" || this.shopOffer == null) return false;
    const shop = this.shopOffer;
    if (shop.resolved[dimIndex]) return false;
    if (!shop.cards[dimIndex].includes(cardId)) return false;
    const def = cardDef(cardId);
    if (def == null) return false;
    const level = this.cards[cardId] ?? 0;
    if (def.maxLevel != null && level >= def.maxLevel) return false;
    if (cardId === "staff.loan" && this.loan != null) return false;
    const price = cardPrice(def, level, this.kpi);
    if (this.cash < price) return false;
    this.cash -= price;
    this.boughtCardEver = true;
    if (def.oneShot) {
      if (cardId === "staff.fire3") {
        this.pendingDismissN = CARD_PARAMS["staff.fire3"].picks;
      } else if (cardId === "staff.movedesk") {
        this.deskSwapPending = true;
        this.deskSwapFirst = null;
      } else if (cardId === "staff.loan") {
        this.openLoan();
      }
    } else {
      this.cards[cardId] = level + 1;
      if (cardId === "staff.expand") this.quotaMax += CARD_PARAMS["staff.expand"].quota;
      if (cardId === "staff.pricecut") this.pendingPricecutFlag = true; // 每次购买/升级都重选工种
    }
    // 所有购买（包括免费贷款）都会敲定当前维度，占用本次商店选择。
    shop.resolved[dimIndex] = true;
    this.bump();
    return true;
  }

  skipDim(dimIndex: 0 | 1 | 2): void {
    if (this.phase !== "shop" || this.shopOffer == null) return;
    if (this.shopOffer.resolved[dimIndex]) return;
    this.shopOffer.resolved[dimIndex] = true;
    this.cash = addFactoryValues(this.cash, clampFactoryValue(SHOP_SKIP_REFUND_RATE * this.kpi));
    this.bump();
  }

  rerollDim(dimIndex: 0 | 1 | 2): boolean {
    if (this.phase !== "shop" || this.shopOffer == null) return false;
    const shop = this.shopOffer;
    if (shop.resolved[dimIndex]) return false;
    const cost = shopRerollCost(this.kpi, shop.rerollCounts[dimIndex]);
    if (this.cash < cost) return false;
    this.cash -= cost;
    shop.rerollCounts[dimIndex]++;
    shop.cards[dimIndex] = drawDimCards(this.rng, shop.dims[dimIndex], this.offerArgs());
    this.bump();
    return true;
  }

  finishShop(): void {
    if (this.phase !== "shop" || this.shopOffer == null) return;
    if (!this.shopOffer.resolved.every(Boolean)) return;
    this.shopOffer = null;
    if (this.shiftIndex === TOTAL_SHIFTS && !this.endless) {
      // 20 班通关:毕业结算 + 解锁无限(继续冲榜走 continueEndless)。
      this.recordsCache.endlessUnlocked = true;
      this.graduated = true;
      this.commitRunEnd();
      this.phase = "summary";
      this.bump();
      return;
    }
    this.advanceShift();
  }

  /** 进入下一班(finishShop / continueEndless 共用)。 */
  private advanceShift(): void {
    this.shiftIndex++;
    this.modifier = modifierForShift(this.shiftIndex, this.rng);
    this.rollDisabledDesks();
    this.kpi = kpiForShift(this.shiftIndex);
    this.bill = billForShift(this.shiftIndex, this.modifier);
    this.spentThisShift = 0;
    this.shiftPulses = [];
    this.shiftCashFlows = [];
    this.settlement = null;
    this.revenueShift = 0;
    this.combo = 0;
    this.shiftStrikeCount = 0;
    this.rushArmed = hasRushRule(this.modifier);
    this.rushDeadline = null; // 赶工墙钟由首次 tick 补 now
    this.rushResumeRemainingMs = null;
    this.rushAcc = 0;
    this.powerThrowsLeftVal = hasPowerRule(this.modifier)
      ? powerThrowLimitFor(this.modifier)
      : null;
    this.powerPendingThrows.clear();
    this.windSign = this.rng() < 0.5 ? -1 : 1;
    this.windFlipAt = hasWindRule(this.modifier) ? 0 : null;
    this.windResumeRemainingMs = null;
    this.startHiring();
    this.bump();
  }

  private rollDisabledDesks(): void {
    // 第 20 班用三项复合检查替代禁桌面，六张桌全部可用。
    const count = this.shiftIndex === TOTAL_SHIFTS
      ? 0
      : this.shiftIndex > 10 ? 2 : this.shiftIndex > 5 ? 1 : 0;
    const pool = this.deskOrderArr.slice();
    this.disabledDesks = [];
    while (this.disabledDesks.length < count && pool.length > 0) {
      const index = Math.floor(this.rng() * pool.length);
      this.disabledDesks.push(pool.splice(index, 1)[0]);
    }
    // Inspection modifiers may narrow a build, but must never turn off every
    // matching scoring desk. Keep the original random draw/count and swap one
    // disabled active desk for an inactive desk only when the draw hard-locks
    // the selected loadout (mono builds from shift 6; dual builds from shift 11).
    if (
      this.loadoutEls.length > 0
      && this.loadoutEls.every((element) => this.disabledDesks.includes(element))
    ) {
      const replacement = this.deskOrderArr.find((element) => (
        !this.loadoutEls.includes(element) && !this.disabledDesks.includes(element)
      ));
      const activeIndex = this.disabledDesks.findIndex((element) => this.loadoutEls.includes(element));
      if (replacement != null && activeIndex >= 0) this.disabledDesks[activeIndex] = replacement;
    }
  }

  // ---- 搬桌 / 压价 ------------------------------------------------------------

  pendingDeskSwap(): boolean {
    return this.deskSwapPending;
  }

  pickDeskForSwap(element: RogueElement): void {
    if (!this.deskSwapPending) return;
    if (!this.deskOrderArr.includes(element)) return;
    if (this.deskSwapFirst == null) {
      this.deskSwapFirst = element;
      this.bump();
      return;
    }
    if (this.deskSwapFirst === element) {
      this.deskSwapFirst = null; // 再点同一张 = 取消首选
      this.bump();
      return;
    }
    const first = this.deskSwapFirst;
    const bodies = this.snap?.bodies() ?? [];
    const desks = this.snap?.desks() ?? [];
    this.deskMoves.push(...deskSwapMoves(bodies, desks, [first, element], {
      // 与 FactoryScene 的实际粘合范围一致；计分图的 1.5 松弛不应用于搬桌切割。
      slack: 1.08,
      stickOverride: (a, b) => this.stickOverride(a, b),
    }));
    const next = this.deskOrderArr.slice();
    const i = next.indexOf(first);
    const j = next.indexOf(element);
    [next[i], next[j]] = [next[j], next[i]];
    this.deskOrderArr = next; // 新引用:场景据此重排 + 重算支撑
    this.deskSwapPending = false;
    this.deskSwapFirst = null;
    this.bump();
  }

  /** 场景在桌序变更帧取走切割后的塔体平移命令。 */
  takeDeskMoves(): DeskMove[] {
    const out = this.deskMoves;
    this.deskMoves = [];
    return out;
  }

  pickPricecutTier(tierCount: number): void {
    if (!this.pendingPricecutFlag) return;
    if (!Number.isInteger(tierCount) || tierCount < 1 || tierCount > 6) return;
    this.pricecutTier = tierCount;
    this.pendingPricecutFlag = false;
    this.bump();
  }

  // ---- 场景桥杂项 -------------------------------------------------------------

  strikeCount(elements: readonly string[] = []): number {
    const lvl = elements.includes("water") ? (this.cards["water.fourday"] ?? 0) : 0;
    if (lvl > 0) {
      const line = CARD_PARAMS["water.fourday"].line;
      return valueAtLevel(line, lvl);
    }
    return STRIKE_LINE_DEFAULT;
  }

  countsForStrike(uid: number): boolean {
    const state = this.bodyStates.get(uid);
    return state?.strikeImmuneShift !== this.shiftIndex;
  }

  stickOverride(a: BodyLike, b: BodyLike): boolean | null {
    return stickOverrideForCards(this.cards)?.(a, b) ?? null;
  }

  windAx(): number {
    if (this.phase !== "shift" || !hasWindRule(this.modifier)) return 0;
    return this.windSign * WIND_DROP_SPEED * WIND_RATIO;
  }

  clickMode(): "none" | "dismiss" {
    return this.pendingDismissN > 0 ? "dismiss" : "none";
  }

  getDeskOrder(): RogueElement[] {
    return this.deskOrderArr;
  }

  /** 限电次数耗尽后，等最后一只投放得到落地/离场结果，再按 KPI 判定。 */
  private finishPowerIfSpent(): boolean {
    if (
      this.phase !== "shift"
      || !hasPowerRule(this.modifier)
      || this.powerThrowsLeftVal == null
      || this.powerThrowsLeftVal > 0
      || this.powerPendingThrows.size > 0
    ) return false;
    if (this.revenueShift >= this.kpi) this.startOvertime();
    else this.bankrupt();
    return true;
  }

  // ---- 检查日 / 破产复查(250ms 间隔驱动) -------------------------------------

  tick(nowMs: number): void {
    const last = this.lastTickAt;
    this.lastTickAt = nowMs;
    if (this.phase !== "shift") return;
    // dt 钳 2s:窗口挂起/节流回来不做补偿性巨额滴入。
    const dt = last == null ? 0 : Math.min(2, Math.max(0, (nowMs - last) / 1000));
    let dirty = false;

    if (hasRushRule(this.modifier)) {
      if (this.rushDeadline == null && this.rushArmed) {
        this.rushDeadline = nowMs + (this.rushResumeRemainingMs ?? rushWallMsFor(this.modifier));
        this.rushResumeRemainingMs = null;
        dirty = true;
      }
      if (dt > 0 && this.snap != null) {
        let perSec = 0;
        for (const b of this.snap.bodies()) {
          if (b.settled) perSec += this.effBaseOf(b.uid) * RUSH_TRICKLE_RATE;
        }
        if (perSec > 0) {
          this.rushAcc += perSec * dt;
          const gain = Math.floor(this.rushAcc);
          if (gain > 0) {
            this.rushAcc -= gain;
            this.cash = addFactoryValues(this.cash, gain);
            this.revenueTotal = addFactoryValues(this.revenueTotal, gain);
            this.revenueShift = addFactoryValues(this.revenueShift, gain);
            this.recordIncomeCashFlow("trickle", gain);
            dirty = true;
          }
        }
      }
      if (this.revenueShift >= this.kpi) {
        this.startOvertime();
        return;
      }
      if (this.rushDeadline != null && nowMs >= this.rushDeadline) {
        // 钟响强制收班:达标照常收,未达 = 破产。
        this.bankrupt();
        return;
      }
    }

    if (this.finishPowerIfSpent()) return;

    if (hasWindRule(this.modifier)) {
      if (this.windFlipAt === 0) {
        this.windFlipAt = nowMs + (this.windResumeRemainingMs ?? WIND_FLIP_MS);
        this.windResumeRemainingMs = null;
      } else if (this.windFlipAt != null && nowMs >= this.windFlipAt) {
        this.windSign = this.windSign === 1 ? -1 : 1;
        this.windFlipAt = nowMs + WIND_FLIP_MS;
        dirty = true;
      }
    }

    // 破产复查(必须"看着它来"):全体落定、KPI 未达、且雇不起头签或名额已满。
    // pendingDismiss > 0 时玩家还有主动拆除手段(可退名额/触发遣散退款),不判死。
    if (this.snap != null && this.revenueShift < this.kpi && this.pendingDismissN === 0) {
      const bodies = this.snap.bodies();
      let allSettled = true;
      for (const b of bodies) {
        if (!b.settled) {
          allSettled = false;
          break;
        }
      }
      if (allSettled) {
        if (this.bag.length === 0) {
          this.bankrupt();
          return;
        }
      }
    }

    if (dirty) this.bump();
  }

  /**
   * 窗口切到后台时暂停检查日墙钟。恢复后把绝对截止时间整体顺延，
   * 同时丢弃后台期间的 tick 间隔，避免切回游戏的一瞬间被判破产或翻转风向。
   */
  resumeClock(nowMs: number, pausedAtMs: number): void {
    if (!Number.isFinite(nowMs) || !Number.isFinite(pausedAtMs)) return;
    const pausedMs = Math.max(0, nowMs - pausedAtMs);
    this.lastTickAt = nowMs;
    if (this.phase !== "shift" || pausedMs === 0) return;

    let dirty = false;
    if (this.rushDeadline != null) {
      this.rushDeadline += pausedMs;
      dirty = true;
    }
    if (this.windFlipAt != null && this.windFlipAt > 0) {
      this.windFlipAt += pausedMs;
      dirty = true;
    }
    if (dirty) this.bump();
  }

  // ---- 破产 / 通关 / 无限 / 战绩 ----------------------------------------------

  /** 战绩快照(一局只 ++ 一次 runs;无限段结束时 best 再刷新)。 */
  private commitRunEnd(): void {
    if (this.revenueTotal > this.recordsCache.bestRevenue) this.recordsCache.bestRevenue = this.revenueTotal;
    if (this.shiftIndex > this.recordsCache.bestShift) this.recordsCache.bestShift = this.shiftIndex;
    if (!this.runCounted) {
      this.recordsCache.runs++;
      this.runCounted = true;
    }
    saveRecords(this.recordsCache);
  }

  private bankrupt(): void {
    if (this.phase === "bankrupt" || this.phase === "summary") return;
    this.commitRunEnd();
    // 常规 20 班内破产 → bankrupt 结算;无限段死亡 → summary 冲榜。
    this.phase = this.endless ? "summary" : "bankrupt";
    this.bump();
  }

  continueEndless(): void {
    if (this.phase !== "summary" || this.endless) return;
    this.endless = true;
    this.advanceShift();
  }

  // ---- 演出队列 / 战绩读取 ----------------------------------------------------

  takePulses(): PulseBreakdown[] {
    const out = this.pulses;
    this.pulses = [];
    return out;
  }

  records(): RogueRecords {
    return { ...this.recordsCache };
  }

  // ---- 续局存档:快照 / 还原(状态只落经济/班次/商店,不含物理堆) ----------------

  /** 生成可续存档快照；局已结束（破产/毕业）返回 null，由调用方据此清盘。
   *  桌上结构、冻结/同化/生长状态与雇佣账务一并保存。 */
  snapshot(): RogueRunSnapshot | null {
    if (
      this.phase !== "hiring"
      && this.phase !== "shift"
      && this.phase !== "overtime"
      && this.phase !== "settlement"
      && this.phase !== "shop"
    ) return null;
    // 飞行中的加班角色在存档视为“尚未跳出”：读档后重新按池序自动投放，
    // 避免半条抛物线/尚未入账的角色被恢复成已落定而漏结算。
    const retryOvertime = this.phase === "overtime"
      ? [...this.overtimePending].flatMap(([uid, worker]) => (
          this.overtimeScored.has(uid) ? [] : [{ ...worker }]
        ))
      : [];
    const pendingDeskDx = new Map(this.deskMoves.map((move) => [move.uid, move.dx]));
    return {
      v: RUN_SNAPSHOT_VERSION,
      loadout: this.loadout.slice(),
      deskOrder: this.deskOrderArr.slice(),
      bodies: (this.snap?.bodies() ?? [])
        .filter((body) => !this.overtimePending.has(body.uid))
        .map((body) => ({
          ...body,
          x: body.x + (pendingDeskDx.get(body.uid) ?? 0),
          elements: body.elements.slice(),
        })),
      bodyEconomy: Array.from(this.uidSpecies, ([uid, species]) => ({
          uid,
          species,
          cost: this.uidCost.get(uid) ?? 0,
          base: this.uidBase.get(uid) ?? this.meta[species]?.baseValue ?? 0,
          departed: this.refunded.has(uid) || undefined,
        }))
        .filter((item) => !this.overtimePending.has(item.uid)),
      bodyStates: Array.from(this.bodyStates.values(), (state) => ({
        ...state,
        elementsOverride: state.elementsOverride?.slice(),
        extraTags: state.extraTags?.slice(),
        absorbedLinks: state.absorbedLinks?.slice(),
        absorbedDesks: state.absorbedDesks?.slice(),
      })).filter((state) => !this.overtimePending.has(state.uid)),
      rngState: this.rngState.a >>> 0,
      phase: this.phase,
      shiftIndex: this.shiftIndex,
      endless: this.endless,
      modifier: this.modifier,
      cash: this.cash,
      revenueTotal: this.revenueTotal,
      revenueShift: this.revenueShift,
      kpi: this.kpi,
      bill: this.bill,
      quotaMax: this.quotaMax,
      quotaUsed: this.quotaUsed,
      hireInflation: this.hiredThisShift.slice(),
      hirePool: [...retryOvertime, ...this.bag.map((x) => ({ ...x }))],
      overtimeReturned: this.overtimeReturned.map((item) => ({ ...item })),
      hiringCandidates: this.hiringCandidates.map((x) => ({ ...x })),
      hiringRound: this.hiringRound,
      hiringRerollsUsed: this.hiringRerollsUsed,
      hiringRerollSpent: this.hiringRerollSpent,
      combo: this.combo,
      cards: { ...this.cards },
      loan: this.loan ? { ...this.loan } : null,
      boughtCardEver: this.boughtCardEver,
      usedLoanEver: this.usedLoanEver,
      inspectionMask: this.inspectionMask,
      strikeClearEver: this.strikeClearEver,
      shiftStrikeCount: this.shiftStrikeCount,
      graduated: this.graduated,
      pendingDismissN: this.pendingDismissN,
      pendingPricecutFlag: this.pendingPricecutFlag,
      pricecutTier: this.pricecutTier,
      shopOffer: this.shopOffer
        ? {
            dims: [this.shopOffer.dims[0], this.shopOffer.dims[1], this.shopOffer.dims[2]],
            cards: [
              this.shopOffer.cards[0].slice(),
              this.shopOffer.cards[1].slice(),
              this.shopOffer.cards[2].slice(),
            ],
            resolved: [this.shopOffer.resolved[0], this.shopOffer.resolved[1], this.shopOffer.resolved[2]],
            rerollCounts: [
              this.shopOffer.rerollCounts[0],
              this.shopOffer.rerollCounts[1],
              this.shopOffer.rerollCounts[2],
            ],
          }
        : null,
      settlement: this.settlement == null ? null : {
        ...this.settlement,
        pulses: this.settlement.pulses.map((pulse) => ({
          ...pulse,
          contributors: pulse.contributors.map((x) => ({ ...x })),
          extras: pulse.extras.map((x) => ({ ...x })),
          triggers: pulse.triggers?.map((trigger) => ({
            ...trigger,
            targetUids: trigger.targetUids?.slice(),
          })),
        })),
        cashFlows: this.settlement.cashFlows.map((x) => ({ ...x })),
      },
      powerThrowsLeft: this.powerThrowsLeftVal,
      rushRemainingMs: this.rushDeadline != null && this.lastTickAt != null
        ? Math.max(0, this.rushDeadline - this.lastTickAt)
        : this.rushResumeRemainingMs,
      windSign: this.windSign,
      windFlipRemainingMs: this.windFlipAt != null && this.windFlipAt > 0 && this.lastTickAt != null
        ? Math.max(0, this.windFlipAt - this.lastTickAt)
        : this.windResumeRemainingMs,
      stats: { ...this.stats },
      deskSwapPending: this.deskSwapPending,
      deskSwapFirst: this.deskSwapFirst,
    };
  }

  /** 从续局存档还原一局。meta 用当前 config/save 现推(不入档):存档里的出战物种
   *  若已不在收藏(改动/迁移)则过滤,过滤后为空则视为无效档返回 null。
   *  续 "shift" 时因物理堆已丢,重置在班进度(营收/名额/签袋/检查日),从空堆重打本班;
   *  续 "shop" 直接落座班末商店(商店不依赖物理堆)。 */
  static restore(
    snap: RogueRunSnapshot,
    meta: Record<string, SpeciesRogueMeta>,
    recordBaseline?: { starts: number; runs: number },
  ): RogueRun | null {
    const loadout = snap.loadout.filter((s) => meta[s] != null);
    if (loadout.length === 0) return null;
    const run = new RogueRun({
      loadout,
      meta,
      deskOrder: snap.deskOrder,
      seed: snap.rngState,
      countStart: false,
      recordBaseline,
    });
    // 覆盖为存档态(随机状态直接接续 snap.rngState,忽略构造期的洗袋消耗)。
    run.rngState.a = snap.rngState >>> 0;
    run.phase = snap.phase;
    run.shiftIndex = snap.shiftIndex;
    run.endless = snap.endless;
    run.modifier = snap.modifier;
    run.cash = clampFactoryValue(snap.cash);
    run.revenueTotal = clampFactoryValue(snap.revenueTotal);
    run.revenueShift = clampFactoryValue(snap.revenueShift);
    run.kpi = Math.min(FACTORY_KPI_CAP, clampFactoryValue(snap.kpi))
      || kpiForShift(snap.shiftIndex);
    run.bill = Math.min(FACTORY_KPI_CAP, clampFactoryValue(snap.bill))
      || billForShift(snap.shiftIndex, snap.modifier);
    // v3.1 数值迁移：扩编由 +10 调回 +5。按班次与卡级重算，旧续局不会保留超额名额。
    const naturalQuotaSteps = Math.max(0, snap.shiftIndex - (snap.phase === "shop" ? 0 : 1));
    run.quotaMax = QUOTA_START
      + naturalQuotaSteps * QUOTA_PER_SHIFT
      + (snap.cards["staff.expand"] ?? 0) * CARD_PARAMS["staff.expand"].quota;
    run.quotaUsed = snap.quotaUsed;
    run.hiredThisShift = Array.isArray(snap.hireInflation)
      ? snap.hireInflation.map((count) => Math.max(0, Number.isFinite(count) ? Math.trunc(count) : 0))
      : [0, 0, 0, 0, 0, 0, 0];
    run.bag = Array.isArray(snap.hirePool)
      ? snap.hirePool.map((x) => ({ ...x, price: clampFactoryValue(x.price) }))
      : [];
    run.overtimeReturned = Array.isArray(snap.overtimeReturned)
      ? snap.overtimeReturned.map((item) => ({ ...item, price: clampFactoryValue(item.price) }))
      : [];
    run.hiringCandidates = Array.isArray(snap.hiringCandidates) ? snap.hiringCandidates.map((x) => ({ ...x })) : [];
    run.hiringRound = snap.hiringRound ?? 1;
    run.hiringRerollsUsed = snap.hiringRerollsUsed ?? 0;
    run.hiringRerollSpent = clampFactoryValue(snap.hiringRerollSpent ?? 0);
    run.combo = snap.combo;
    run.cards = { ...snap.cards };
    // 旧标签系存档平滑迁移到吸收系的同稀有度位置。
    if ((run.cards["normal.absorb"] ?? 0) <= 0 && (run.cards["normal.tags"] ?? 0) > 0) {
      run.cards["normal.absorb"] = run.cards["normal.tags"];
    }
    if ((run.cards["normal.gluttony"] ?? 0) <= 0 && (run.cards["normal.overlap"] ?? 0) > 0) {
      run.cards["normal.gluttony"] = run.cards["normal.overlap"];
    }
    if ((run.cards["normal.emperor"] ?? 0) <= 0 && (run.cards["normal.dispatch"] ?? 0) > 0) {
      run.cards["normal.emperor"] = run.cards["normal.dispatch"];
    }
    run.bodyStates = new Map((snap.bodyStates ?? []).map((state) => [
      state.uid,
      {
        ...state,
        elementsOverride: state.elementsOverride?.slice(),
        extraTags: undefined,
        sizeLevel: Math.max(1, state.sizeLevel ?? 1),
        absorbedLinks: state.absorbedLinks?.slice(),
        absorbedDesks: state.absorbedDesks?.slice(),
      },
    ]));
    if (snap.loan != null) {
      const shiftsLeft = Math.max(1, Math.min(LOAN_SHIFTS, snap.loan.shiftsLeft));
      const principal = clampFactoryValue(snap.loan.principal ?? LOAN_GAIN_RATE * run.kpi);
      const totalDue = Math.max(
        principal,
        clampFactoryValue(snap.loan.totalDue ?? principal * LOAN_TOTAL_REPAY_RATE),
      );
      const completed = Math.max(0, LOAN_SHIFTS - shiftsLeft);
      const migratedPaid = completed * Math.round(principal * LOAN_REPAY_RATE);
      run.loan = {
        principal,
        totalDue,
        paid: Math.min(totalDue, clampFactoryValue(snap.loan.paid ?? migratedPaid)),
        shiftsLeft,
      };
    } else {
      run.loan = null;
    }
    run.boughtCardEver = snap.boughtCardEver;
    run.usedLoanEver = snap.usedLoanEver;
    run.inspectionMask = snap.inspectionMask;
    run.strikeClearEver = snap.strikeClearEver;
    run.shiftStrikeCount = snap.shiftStrikeCount;
    run.graduated = snap.graduated;
    run.pendingDismissN = snap.pendingDismissN;
    run.pendingPricecutFlag = snap.pendingPricecutFlag;
    run.pricecutTier = snap.pricecutTier;
    if (snap.shopOffer != null) {
      // 兼容旧版续局：旧字段用布尔值记录“是否已刷新过”。
      const legacy = snap.shopOffer as ShopOffer & { rerolled?: [boolean, boolean, boolean] };
      const counts = Array.isArray(legacy.rerollCounts)
        ? legacy.rerollCounts
        : (legacy.rerolled ?? [false, false, false]).map((value) => value ? 1 : 0);
      run.shopOffer = {
        dims: [legacy.dims[0], legacy.dims[1], legacy.dims[2]],
        cards: [legacy.cards[0].slice(), legacy.cards[1].slice(), legacy.cards[2].slice()],
        resolved: [legacy.resolved[0], legacy.resolved[1], legacy.resolved[2]],
        rerollCounts: [
          Math.max(0, Number(counts[0]) || 0),
          Math.max(0, Number(counts[1]) || 0),
          Math.max(0, Number(counts[2]) || 0),
        ],
      };
    } else {
      run.shopOffer = null;
    }
    run.settlement = snap.settlement;
    run.powerThrowsLeftVal = hasPowerRule(snap.modifier)
      ? Math.min(
          powerThrowLimitFor(snap.modifier),
          Math.max(0, Math.round(snap.powerThrowsLeft ?? powerThrowLimitFor(snap.modifier))),
        )
      : null;
    run.rushArmed = hasRushRule(snap.modifier);
    run.rushDeadline = null;
    run.rushResumeRemainingMs = run.rushArmed && Number.isFinite(snap.rushRemainingMs)
      ? Math.min(
          rushWallMsFor(snap.modifier),
          Math.max(0, Math.round(snap.rushRemainingMs ?? 0)),
        )
      : null;
    run.windSign = snap.windSign === -1 ? -1 : 1;
    run.windFlipAt = hasWindRule(snap.modifier) ? 0 : null;
    run.windResumeRemainingMs = hasWindRule(snap.modifier) && Number.isFinite(snap.windFlipRemainingMs)
      ? Math.min(WIND_FLIP_MS, Math.max(0, Math.round(snap.windFlipRemainingMs ?? 0)))
      : null;
    run.powerPendingThrows = new Set(
      (snap.bodies ?? [])
        .filter((body) => (
          !body.settled
          && !snap.bodyStates?.find((state) => state.uid === body.uid)?.generated
        ))
        .map((body) => body.uid),
    );
    if (snap.settlement != null) {
      run.spentThisShift = clampFactoryValue(snap.settlement.spentTotal);
      run.shiftPulses = snap.settlement.pulses.slice();
      run.shiftCashFlows = snap.settlement.cashFlows.slice();
    }
    run.stats = { ...snap.stats, maxPulse: clampFactoryValue(snap.stats.maxPulse) };
    run.deskSwapPending = snap.deskSwapPending;
    run.deskSwapFirst = snap.deskSwapFirst;
    // 战绩缓存读当前盘(构造期已 loadRecords);续局不改 runs 计数(本局早已计过或未计)。
    if (snap.phase === "shift" || snap.phase === "overtime") {
      for (const item of snap.bodyEconomy) {
        run.uidSpecies.set(item.uid, item.species);
        run.uidCost.set(item.uid, clampFactoryValue(item.cost));
        run.uidBase.set(item.uid, clampFactoryValue(item.base));
        if (item.departed === true) run.refunded.add(item.uid);
      }
    }
    // 续档不会保存逃跑动画；若所有未得分角色均已处理，就视为已全部返池并进入账单。
    if (snap.phase === "overtime" && run.bag.length === 0) run.finishOvertimeIfReady();
    return run;
  }

  // ---- 测试/调试钩子(不在 RogueRunApi 契约内;仅 factory_rogue_check.mjs 用) ----

  /** 直接授予卡(跳过商店,搭测试台)。一次性卡走与 buyCard 相同的生效分支
   *  (D 线缺陷 #2:此前只加等级表,fire3/movedesk 授予后无效果)。 */
  debugGrantCard(id: string, levels = 1): void {
    this.boughtCardEver = true;
    if (cardDef(id)?.oneShot) {
      if (id === "staff.fire3") {
        this.pendingDismissN = CARD_PARAMS["staff.fire3"].picks;
      } else if (id === "staff.movedesk") {
        this.deskSwapPending = true;
        this.deskSwapFirst = null;
      } else if (id === "staff.loan") {
        this.openLoan();
      }
    } else {
      this.cards[id] = (this.cards[id] ?? 0) + levels;
      if (id === "staff.expand") this.quotaMax += CARD_PARAMS["staff.expand"].quota * levels;
      if (id === "staff.pricecut") this.pendingPricecutFlag = true;
    }
    this.bump();
  }

  /** 直接改现金(构造破产/富裕场景)。 */
  debugSetCash(n: number): void {
    this.cash = n;
    this.bump();
  }

  /** 强制收班(测生长/商店流,不等 KPI)。 */
  debugEndShift(): void {
    this.endShift();
  }
}
