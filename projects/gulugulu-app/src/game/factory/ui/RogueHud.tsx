// 危楼打工记 HUD(04 §1 布局):
// 顶部 = 总营收大数字(0.6s 缓动追值滚动 + 数量级换色,金币命中时外层弹跳)+
//        班次 + KPI 进度条(达标前 90% 呼吸闪烁)+ 待缴账单 +
//        非限时检查日横幅(audit 徽标)+ 破产预警(预测口径);
// 底部中央 = 检查日状态（rush 倒计时 / power 剩余投放次数），带醒目的资源条；
//              大风日方向与规则提示（方向本身另有全屏风效）；
// 底部 = 现金(低于后两签雇价和 → 红脉冲)+ 名额 + 连击 + 签袋预览 3(头签放大);
// 另有三条模式提示条:解雇点选剩余 / 搬桌选两桌(首选已选徽章)/ 压价选工种。
// 开班时班次/KPI/账单数字翻牌(key=shiftIndex 重挂 .fr-flip-num)。
// 「← 离开」在 shift/shop 阶段弹弃局确认(纯 UI 弹层,B 线遗留清账)。
// 所有按钮直接调 RogueRunApi;数据全部来自 view(引用变更驱动重渲染)。

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { GameConfig } from "../../../types";
import { fmt } from "../../../i18n";
import { useT } from "../../../useT";
import { formatCount } from "../../format";
import { FACTORY_ROGUE } from "../../../i18n/factoryRogue";
import {
  CARD_DEFS,
  POWER_THROW_LIMIT,
  RUSH_WALL_MS,
  TOTAL_SHIFTS,
  hasPowerRule,
  hasRushRule,
  hasWindRule,
  powerThrowLimitFor,
  rushWallMsFor,
  type CardId,
} from "../rogueConfig";
import type { RogueRunApi, RunView } from "../rogueTypes";
import { FactoryHudPosts, type FactoryHudData } from "./FactoryHudPosts";
import { ROGUE_CARD_KEYWORDS, rogueKeywordText } from "../rogueKeywords";

/** 赶工日进度条时钟。高频但隔离在 ModifierResourceHud 内，不带着整棵 HUD 重渲染。 */
function useNowMs(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now()); // 激活瞬间先校准一次,防挂载陈旧时钟把倒计时首帧顶到 150s 以上(D 线缺陷 #3)
    const timer = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function ModifierResourceHud({
  kind,
  deadline,
  powerThrowsLeft,
  title,
  rule,
  rushLeftTemplate,
  powerThrowsLeftTemplate,
}: {
  kind: "rush" | "power" | "audit";
  deadline: number | null;
  powerThrowsLeft: number | null;
  title: string;
  rule: string;
  rushLeftTemplate: string;
  powerThrowsLeftTemplate: string;
}) {
  const rushActive = hasRushRule(kind);
  const powerActive = hasPowerRule(kind);
  const rushTotal = rushWallMsFor(kind);
  const powerTotal = powerThrowLimitFor(kind);
  const nowMs = useNowMs(rushActive && deadline != null);
  const rushRemaining =
    rushActive
      // 开班后的首个逻辑 tick 才写入 deadline；这不到 250ms 的窗口先画满格，
      // 避免玩家看到一次“0s 红闪 → 150s”的假警报。
      ? deadline == null
        ? rushTotal
        : Math.min(rushTotal, Math.max(0, deadline - nowMs))
      : 0;
  const powerRemaining = Math.max(0, powerThrowsLeft ?? 0);
  const rushRatio = rushActive ? Math.min(1, rushRemaining / rushTotal) : 1;
  const powerRatio = powerActive ? Math.min(1, powerRemaining / powerTotal) : 1;
  const ratio = Math.min(rushRatio, powerRatio);
  const danger = ratio <= 0.25;
  const rushValueText = fmt(rushLeftTemplate, { s: Math.ceil(rushRemaining / 1000) });
  const powerValueText = fmt(powerThrowsLeftTemplate, { n: Math.ceil(powerRemaining) });
  const valueText = kind === "audit"
    ? `${rushValueText} · ${powerValueText}`
    : kind === "rush" ? rushValueText : powerValueText;

  return (
    <div
      className={`fr-timed-hud is-${kind}${kind === "audit" ? " is-rush" : ""}${danger ? " is-danger" : ""}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="fr-timed-head">
        <strong>
          <span aria-hidden="true">{kind === "rush" ? "⚡" : kind === "power" ? "🔌" : "🧾"}</span> {title}
        </strong>
        <span className="fr-timed-rule" title={rule}>{rule}</span>
        <span
          className="fr-timed-value"
        >
          {valueText}
        </span>
      </div>
      {powerActive && (
        <div
          className="fr-power-pips"
          role="meter"
          aria-label={powerValueText}
          aria-valuemin={0}
          aria-valuemax={powerTotal}
          aria-valuenow={Math.ceil(powerRemaining)}
        >
          {Array.from({ length: powerTotal }, (_, index) => (
            <i
              key={index}
              className={index < powerRemaining ? "is-left" : "is-spent"}
              aria-hidden="true"
            />
          ))}
        </div>
      )}
      {rushActive && (
        <div
          className="fr-timed-track"
          role="progressbar"
          aria-label={title}
          aria-valuemin={0}
          aria-valuemax={rushTotal}
          aria-valuenow={Math.ceil(rushRemaining)}
        >
          <span className="fr-timed-fill" style={{ width: `${rushRatio * 100}%` }}>
            <span className="fr-timed-burn" aria-hidden="true" />
          </span>
          <span className="fr-timed-gloss" aria-hidden="true" />
        </div>
      )}
      {rushActive && <span className="fr-timed-fold" aria-hidden="true" />}
    </div>
  );
}

export function RogueHud({
  run,
  view,
  config,
  onExit,
  revenueRef,
  cashRef,
}: {
  run: RogueRunApi;
  view: RunView;
  config: GameConfig;
  onExit: () => void;
  /** 总营收数字 span(RunStage 拿它做金币飞行终点 + 命中弹跳)。 */
  revenueRef: MutableRefObject<HTMLSpanElement | null>;
  /** 现金木牌(遣散退款 +¥ 的飞行终点 + 命中弹跳)。 */
  cashRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const { lang } = useT();
  const R = FACTORY_ROGUE[lang];
  const [quitOpen, setQuitOpen] = useState(false);

  const kpiRatio = view.kpi > 0 ? Math.min(1, view.revenueShift / view.kpi) : 0;
  const cashLow = view.cash < view.bill;
  // 破产预警:逻辑层预测口径(预测下班账单 > 现金 + 本班剩余 KPI 缺口;B 线清账,
  // 旧「现金 < 本班账单」启发式已删)。
  const bankruptWarn = view.phase === "shift" && view.dangerBankrupt;
  const shiftText = view.endless
    ? fmt(R.hudShiftEndless, { m: view.shiftIndex - TOTAL_SHIFTS })
    : fmt(R.hudShift, { n: view.shiftIndex, total: TOTAL_SHIFTS });

  // ---- 总营收滚动缓动(04 §1:easeOut 0.6s 追上真值)----
  // span 的 JSX 子节点恒为首帧值(React 不再改写文本),之后全由 rAF 直写
  // textContent;数量级换色仍走 className。
  const [initialRevenue] = useState(() => formatCount(view.revenueTotal));
  const chaseRef = useRef({
    shown: view.revenueTotal,
    from: view.revenueTotal,
    to: view.revenueTotal,
    start: 0,
    raf: 0,
  });
  useEffect(() => {
    const c = chaseRef.current;
    const el = revenueRef.current;
    if (el == null) return;
    if (c.to === view.revenueTotal) {
      // 目标没变(语言切换等):按当前追值即时重写一次。
      el.textContent = formatCount(Math.round(c.shown));
      return;
    }
    c.from = c.shown;
    c.to = view.revenueTotal;
    c.start = performance.now();
    cancelAnimationFrame(c.raf);
    const step = (now: number) => {
      const t = Math.min(1, (now - c.start) / 600);
      const k = 1 - Math.pow(1 - t, 3); // easeOutCubic
      c.shown = c.from + (c.to - c.from) * k;
      const cur = revenueRef.current;
      if (cur != null) cur.textContent = formatCount(Math.round(c.shown));
      if (t < 1) c.raf = requestAnimationFrame(step);
    };
    c.raf = requestAnimationFrame(step);
  }, [view.revenueTotal, lang, revenueRef]);
  useEffect(() => () => cancelAnimationFrame(chaseRef.current.raf), []);

  // 计数器字色按数量级晋级(04 §6):1e4 / 1e6 / 1e8 换档。
  const magCls =
    view.revenueTotal >= 1e8 ? " m3" : view.revenueTotal >= 1e6 ? " m2" : view.revenueTotal >= 1e4 ? " m1" : "";

  const wantExit = () => {
    // 局中(shift/shop)离开要确认:「弃局?本局进度不保存」;结算板阶段直接走。
    if (view.phase === "shift" || view.phase === "overtime" || view.phase === "shop") setQuitOpen(true);
    else onExit();
  };

  // ---- view → 双立柱 HUD 展示数据（设计定稿 6a；纯映射，不含副作用）----
  const hudData: FactoryHudData = {
    revenueTotal: view.revenueTotal,
    kpiRatio,
    kpiValue: view.kpi,
    shiftText,
    billText: fmt(R.hudBill, { v: formatCount(view.bill) }),
    bag: view.bagPreview,
    bagTotal: view.bagTotal,
    activeCards: Object.entries(view.cards).flatMap(([id, level]) => {
      const def = CARD_DEFS.find((card) => card.id === id);
      if (def == null || def.oneShot || level <= 0) return [];
      const text = R.cards[id as CardId];
      return [{
        id: id as CardId,
        level,
        name: text?.name ?? id,
        description: text?.desc(level) ?? "",
        keywords: (ROGUE_CARD_KEYWORDS[id as CardId] ?? []).map((keyword) => rogueKeywordText(keyword, lang)),
      }];
    }),
    cash: view.cash,
    quotaUsed: view.quotaUsed,
    quotaMax: view.quotaMax,
    combo: view.combo,
    showBagEmpty: view.phase === "shift" || view.phase === "overtime",
    cashLow,
  };

  return (
    <>
      {/* ---- 双立柱 HUD（左柱经营 / 右柱资源；接线到 view）----
          总营收滚动缓动仍由本组件的 chase effect 直写 revenueRef.textContent，
          FactoryHudPosts 只渲染首帧 initialRevenue；magCls/cashRef/翻牌 key 透传。 */}
      <FactoryHudPosts
        data={hudData}
        config={config}
        labels={{
          revenue: R.hudRevenue,
          kpi: R.hudKpi,
          bagEmpty: R.hudBagEmpty,
          cash: R.hudCash,
          quota: R.hudQuota,
          back: R.hudBack,
          workPerformance: R.loBaseValue.replace(" {n}", ""),
          exploitationCount: R.loReach.replace(" {n}", ""),
          cardAria: R.cardAria,
          levelAria: R.levelAria,
        }}
        onExit={wantExit}
        revenueRef={revenueRef}
        revenueInitial={initialRevenue}
        revenueMagClass={magCls}
        cashRef={cashRef}
        flipKey={view.shiftIndex}
      />

      {/* ---- 顶部中央横幅（决算日 / 破产预警）：留在 fr-hud-top 里居中，
             不与左右立柱冲突；顶部中间原先给运输机的位置略下移由 CSS 负责 ---- */}
      {(view.modifier === "audit" || bankruptWarn) && (
        <div
          className={`fr-hud-top${view.modifier === "audit" ? " is-audit" : ""}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
        {view.modifier === "audit" && (
          <div className="fr-modbar">
            <span>🧾 {R.modAudit}</span>
            <span>{R.modAuditRule}</span>
          </div>
        )}

          {bankruptWarn && <div className="fr-warn">{R.hudWarnBankrupt}</div>}
        </div>
      )}

      {/* 大风提示固定在屏幕最下方；箭头与全屏风线都读同一个瞬时风向。 */}
      {view.phase === "shift" && hasWindRule(view.modifier) && (
        <div
          className={`fr-wind-message is-${run.windAx() >= 0 ? "right" : "left"}${view.modifier === "audit" ? " is-combined" : ""}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span>🚩 {R.modWind}</span>
          <span className="fr-wind-arrow">{run.windAx() >= 0 ? "➡" : "⬅"}</span>
          <span>{R.modWindRule}</span>
        </div>
      )}

      {/* 限时玩法固定在桌子下方：大条持续退格，剩余 20% 时整条红色闪烁。 */}
      {view.phase === "shift" && (hasRushRule(view.modifier) || hasPowerRule(view.modifier)) && (
        <ModifierResourceHud
          kind={view.modifier}
          deadline={view.rushDeadline}
          powerThrowsLeft={view.powerThrowsLeft}
          title={view.modifier === "audit"
            ? R.modAudit
            : view.modifier === "rush" ? R.modRush : R.modPower}
          rule={view.modifier === "audit"
            ? R.modAuditRule
            : view.modifier === "rush"
              ? fmt(R.modRushRule, { s: RUSH_WALL_MS / 1000 })
              : fmt(R.modPowerRule, { n: POWER_THROW_LIMIT })}
          rushLeftTemplate={R.modRushLeft}
          powerThrowsLeftTemplate={R.modPowerLeft}
        />
      )}

      {/* 现金/名额/连击/签袋已并入右立柱（FactoryHudPosts）。 */}

      {/* ---- 弃局确认(局中离开;纯 UI 弹层,不碰逻辑层) ---- */}
      {quitOpen && (
        <div className="fr-overlay fr-quit-overlay" onPointerDown={(event) => event.stopPropagation()}>
          <div className="fr-panel fr-quit-panel">
            <div className="fr-quit-title">🚪 {R.quitTitle}</div>
            <div className="fr-quit-body">{R.quitBody}</div>
            <div className="fr-quit-actions">
              <button
                type="button"
                className="fr-chip fr-btn"
                onClick={() => {
                  setQuitOpen(false);
                  onExit();
                }}
              >
                {R.quitYes}
              </button>
              <button
                type="button"
                className="fr-chip fr-btn fr-btn-primary"
                onClick={() => setQuitOpen(false)}
              >
                {R.quitNo}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
