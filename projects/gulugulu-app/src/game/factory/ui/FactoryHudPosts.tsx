// 工厂 HUD「双立柱挂牌」（Claude Design 定稿 6a）：左右两根木立柱贴屏幕边缘，
// 各种木牌/纸条/卡片挂在柱上，顶部中央完全留空给运输机航线。
//
//   左柱（经营）：总营收木牌 → 竖版 KPI 温度计 → 班次牌 → 账单纸条
//   右柱（资源）：「签袋」小签 → 当前签大卡 → 后两签小卡 → 现金/名额/连击胶囊
//
// **纯展示组件**：不 import 任何 rogue 类型、不碰局引擎、不产生副作用。全部数据经
// FactoryHudData 传入（字段与 RogueHud 的 view 一一对应，接线时直接映射即可）。
// 文案经 labels 传入，避免在美术层里硬编码中文。

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from "react";
import type { GameConfig } from "../../../types";
import { SvgSprite } from "../../../sprites/SvgSprite";
import { ElementIcon } from "../../ElementIcon";
import { formatCount } from "../../format";
import { RogueCardIcon } from "./RogueCardIcon";
import type { CardId } from "../rogueConfig";
import "./hudPosts.css";

/** 签袋里的一格（当前签 + 后两签）。 */
export type HudBagSlot = {
  species: string;
  /** 雇价。 */
  price: number;
  baseValue: number;
  reach: number;
};

/** 双立柱 HUD 的全部显示数据。字段命名对齐 RogueHud 的 view：
 *  revenueTotal / kpiRatio(=revenueShift/kpi) / shiftText / bill /
 *  bagPreview / cash / quotaUsed / quotaMax / combo。 */
export type FactoryHudData = {
  /** 总营收（左柱大牌，滚动缓动由调用方决定）。 */
  revenueTotal: number;
  /** 本班 KPI 完成度 0..1（温度计液面；≥0.9 且 <1 自动呼吸闪烁）。 */
  kpiRatio: number;
  kpiValue: number;
  /** 班次文案，例如「班次 7/20」——已格式化，本组件不拼串。 */
  shiftText: string;
  /** 班末待缴账单文案，例如「账单 ¥1,410 待缴」——同上，已格式化。 */
  billText: string;
  /** 签袋预览，长度 3：[当前签, 下一签, 下下签]，空格子给 null。 */
  bag: ReadonlyArray<HudBagSlot | null>;
  bagTotal: number;
  activeCards: ReadonlyArray<{
    id: CardId;
    level: number;
    name: string;
    description: string;
    keywords?: ReadonlyArray<{ name: string; tip: string }>;
  }>;
  /** 现金。 */
  cash: number;
  quotaUsed: number;
  quotaMax: number;
  /** 连击数；0 = 不显示连击胶囊。 */
  combo: number;
  /** 现金不够付后两签 → 钱包红脉冲。 */
  cashLow?: boolean;
};

/** React-owned cash counter. Keeping the displayed value in state prevents the
 * wallet from getting out of sync when cash changes again during an animation. */
function RollingWalletNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const [turn, setTurn] = useState(0);
  const [direction, setDirection] = useState<"is-up" | "is-down">("is-up");
  const elementRef = useRef<HTMLSpanElement | null>(null);
  const displayedRef = useRef(value);
  const rafRef = useRef(0);
  const targetRef = useRef(value);
  const valueRef = useRef(value);
  const reconcileTimerRef = useRef(0);

  valueRef.current = value;

  const rollTo = useCallback((to: number) => {
    if (targetRef.current === to && rafRef.current !== 0) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    const from = displayedRef.current;
    targetRef.current = to;

    if (from === to) {
      displayedRef.current = to;
      setDisplayed(to);
      return;
    }

    setDirection(to > from ? "is-up" : "is-down");
    setTurn((current) => current + 1);
    const startedAt = performance.now();
    const duration = 520;
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (to - from) * eased);
      displayedRef.current = next;
      setDisplayed(next);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
      else rafRef.current = 0;
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => rollTo(value), [value, rollTo]);

  useEffect(() => {
    const wallet = elementRef.current?.parentElement;
    if (wallet == null) return;
    const onPreview = (event: Event) => {
      const next = (event as CustomEvent<{ value?: number }>).detail?.value;
      if (typeof next !== "number" || !Number.isFinite(next)) return;
      rollTo(Math.max(0, next));
      window.clearTimeout(reconcileTimerRef.current);
      reconcileTimerRef.current = window.setTimeout(() => rollTo(valueRef.current), 1750);
    };
    wallet.addEventListener("fhp-wallet-roll", onPreview);
    return () => wallet.removeEventListener("fhp-wallet-roll", onPreview);
  }, [rollTo]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    window.clearTimeout(reconcileTimerRef.current);
  }, []);

  return (
    <span
      key={turn}
      ref={elementRef}
      className={`fhp-wallet-num is-turning ${direction}`}
      aria-label={`¥${value}`}
    >
      ¥{formatCount(displayed)}
    </span>
  );
}

/** 挂牌文案（i18n 由调用方给）。 */
export type FactoryHudLabels = {
  revenue: string;
  kpi: string;
  bagEmpty: string;
  cash: string;
  quota: string;
  back: string;
  workPerformance: string;
  exploitationCount: string;
};

/** 一张签卡（头签放大 + 后两签递减不透明度，做出"排队感"）。 */
function BagCard({
  slot,
  config,
  rank,
  labels,
}: {
  slot: HudBagSlot | null;
  config: GameConfig;
  /** 0 = 当前签（大卡金底），1/2 = 后两签（小卡奶油底）。 */
  rank: 0 | 1 | 2;
  labels: Pick<FactoryHudLabels, "workPerformance" | "exploitationCount">;
}) {
  if (slot == null) return null;
  const elements = config.species[slot.species]?.elements ?? ["normal"];
  return (
    <div className={`fhp-bag-card fhp-bag-r${rank}`}>
      <div className="fhp-bag-sprite">
        <SvgSprite species={slot.species} config={config} petState="idle" />
      </div>
      <div className="fhp-bag-line">
        <span className="fhp-bag-els">
          {elements.map((el) => (
            <ElementIcon
              key={el}
              badge={config.elements[el]?.badge ?? "star"}
              color={config.elements[el]?.color ?? "#B07B44"}
              size={rank === 0 ? 22 : 16}
            />
          ))}
        </span>
        <span className="fhp-pet-stat fhp-pet-base" title={labels.workPerformance}>★{slot.baseValue}</span>
        <span className="fhp-pet-stat fhp-pet-reach" title={labels.exploitationCount}>⛓{slot.reach}</span>
      </div>
    </div>
  );
}

export function FactoryHudPosts({
  data,
  config,
  labels,
  onExit,
  revenueRef,
  revenueInitial,
  revenueMagClass = "",
  cashRef,
  flipKey,
}: {
  data: FactoryHudData;
  config: GameConfig;
  labels: FactoryHudLabels;
  /** 给了就在左柱底部挂一枚返回牌；不给则不挂。 */
  onExit?: () => void;
  /** 接线用：总营收数字 span 的外部 ref（金币飞行终点 + 命中弹跳目标）。
   *  给了 revenueRef 时，数字文本交给外部（rAF 直写 textContent）——本组件只渲染
   *  首帧 revenueInitial 一次，之后**不再重写**，与 RogueHud 的滚动缓动配合。 */
  revenueRef?: MutableRefObject<HTMLSpanElement | null>;
  /** 总营收首帧文本（不带 ¥；给了 revenueRef 才生效）。 */
  revenueInitial?: string;
  /** 数量级换色 class（如 " m1"/" m2"/" m3"），拼到营收数字 span 上。 */
  revenueMagClass?: string;
  /** 接线用：现金木牌 div 的外部 ref（退款 +¥ 飞行终点 + 命中弹跳）。 */
  cashRef?: MutableRefObject<HTMLDivElement | null>;
  /** 开班翻牌：值变化时 shift/KPI/账单 重挂做翻牌动画（不给则不翻）。 */
  flipKey?: number | string;
}) {
  const [openCardId, setOpenCardId] = useState<CardId | null>(null);
  const openCard = data.activeCards.find((card) => card.id === openCardId) ?? null;
  const ratio = Math.max(0, Math.min(1, data.kpiRatio));
  // 达标前 10% 开始呼吸闪烁（GDD 04 §1）
  const kpiNear = ratio >= 0.9 && ratio < 1;
  // 点 HUD ≠ 空投：整块吞掉 pointerdown（但**不能** pointer-events:none，
  // 点击穿透判定要认这里"画了东西"，否则点自己的 HUD 会漏到桌面上）。
  const swallow = (event: { stopPropagation: () => void }) => event.stopPropagation();

  const wrap = (children: ReactNode) => (
    <div className="fhp-root" onPointerDown={swallow}>
      {children}
    </div>
  );

  return wrap(
    <>
      {/* ---- 左列：经营(便签自上而下 9px 间距,贴屏幕左缘)---- */}
      <div className="fhp-col-l">
        {/* 总营收:白便签 + 折角 + 金色大数字 */}
        <div className="fhp-plaque fhp-revenue">
          <span className="fr-fold" />
          <span className="fhp-plaque-label">{labels.revenue}</span>
          {/* ¥ 留在 ref 外：接线时外部只 rAF 直写内层 span 的数字文本（滚动缓动），
              货币符号不被 textContent 覆盖；独立/预览时本组件自渲染数字。 */}
          <span className={`fhp-plaque-num${revenueMagClass}`}>
            ¥
            <span ref={revenueRef}>
              {revenueRef != null && revenueInitial != null ? revenueInitial : formatCount(data.revenueTotal)}
            </span>
          </span>
        </div>

        {/* KPI:白便签 + 横向金色进度条(≥90% 呼吸) */}
        <div className={`fhp-kpi-note${kpiNear ? " is-near" : ""}`}>
          <div className="fhp-kpi-head">
            <span>{labels.kpi}</span>
            <span className="fhp-kpi-pct">{formatCount(data.kpiValue)}</span>
          </div>
          <div className="fhp-kpi-track">
            <div className="fhp-kpi-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
        </div>

        <div className="fr-note fr-note-mint fhp-shift">
          <span className="fhp-flip" key={flipKey}>
            {data.shiftText}
          </span>
        </div>

        <div className="fr-note fr-note-blue fhp-seats">
          👥 {labels.quota} {data.quotaUsed}/{data.quotaMax}
        </div>

        {data.combo > 0 && (
          <div className="fr-note fr-note-yellow fhp-combo" key={data.combo}>
            🔥 ×{data.combo}
          </div>
        )}
        {data.activeCards.length > 0 && (
          <div className="fhp-active-cards">
            {data.activeCards.map((card) => (
              <button
                type="button"
                className="fhp-active-card"
                data-card-id={card.id}
                key={card.id}
                aria-label={`${card.name}, level ${card.level}. ${card.description}`}
                aria-expanded={openCardId === card.id}
                onClick={() => setOpenCardId((current) => current === card.id ? null : card.id)}
              >
                <RogueCardIcon id={card.id} title={card.name} />
                <b aria-label={`Level ${card.level}`}>{card.level}</b>
              </button>
            ))}
          </div>
        )}
        {openCard != null && (
          <div className="fhp-card-inspector" role="status">
            <strong>{openCard.name} · Lv.{openCard.level}</strong>
            <span>{openCard.description}</span>
            {(openCard.keywords?.length ?? 0) > 0 && (
              <div className="fhp-card-inspector-tips">
                {openCard.keywords?.map((keyword) => (
                  <span key={keyword.name}>
                    <b>【{keyword.name}】</b>{keyword.tip}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 离开:左下角 */}
      {onExit != null && (
        <button type="button" className="fr-note fr-note-plain fhp-quit" onClick={onExit}>
          {labels.back}
        </button>
      )}

      {/* ---- 右列:资源(钱包 → 账单 → 签袋队列)---- */}
      <div className="fhp-col-r">
        {/* 现金「钱包」大牌。cashRef 挂这里 = 金币飞行落点 + 命中弹跳。 */}
        <div ref={cashRef} className={`fhp-cash-wallet${data.cashLow ? " is-low" : ""}`}>
          <span className="fhp-wallet-bills" aria-hidden="true" />
          <span className="fhp-wallet-label">{labels.cash}</span>
          <RollingWalletNumber value={data.cash} />
        </div>

        {/* 待缴账单:白便签 + 红字红边 */}
        <div className="fhp-receipt">
          <span className="fhp-flip" key={flipKey}>
            {data.billText}
          </span>
        </div>
        <div className="fr-note fr-note-blue fhp-pool-total">👥 {data.bagTotal}</div>

        {/* 签袋队列:当前签奶油大卡 + 后两签递减 */}
        {data.bag.every((s) => s == null) ? (
          <div className="fr-note fr-note-plain fhp-bag-empty">{labels.bagEmpty}</div>
        ) : (
          <div className="fhp-bag-queue">
            <BagCard slot={data.bag[0] ?? null} config={config} rank={0} labels={labels} />
            <BagCard slot={data.bag[1] ?? null} config={config} rank={1} labels={labels} />
            <BagCard slot={data.bag[2] ?? null} config={config} rank={2} labels={labels} />
          </div>
        )}
      </div>
    </>,
  );
}

/** 预览/接线前的占位数据（`?fachud=1` 用）：让版式在没有局引擎时也能看。 */
export function demoHudData(config: GameConfig): FactoryHudData {
  const pool = Object.keys(config.species);
  const pick = (i: number) => pool[i % Math.max(1, pool.length)] ?? "guluduck";
  return {
    revenueTotal: 128400,
    kpiRatio: 0.61,
    kpiValue: 210,
    // 与 RogueHud 接线后的实际串形一致（班次/账单都是调用方 fmt 好再传进来的），
    // 占位数据也照这个形状给，免得版式宽度失真。
    shiftText: "班次 7/20",
    billText: "账单 ¥1,410 待缴",
    bag: [
      { species: pick(0), price: 86, baseValue: 10, reach: 2 },
      { species: pick(3), price: 42, baseValue: 8, reach: 4 },
      { species: pick(6), price: 42, baseValue: 6, reach: 6 },
    ],
    bagTotal: 24,
    activeCards: [],
    cash: 237,
    quotaUsed: 12,
    quotaMax: 45,
    combo: 7,
  };
}

export type { CSSProperties as FactoryHudStyle };
