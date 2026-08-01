import { useEffect, useRef, useState } from "react";
import type { GameConfig, GameSave } from "../../../types";
import { speciesDisplayName } from "../../../i18n";
import { useT } from "../../../useT";
import { SvgSprite } from "../../../sprites/SvgSprite";
import { formatCount } from "../../format";
import type { RogueRunApi, RunView } from "../rogueTypes";

const PAYMENT_MS = 1400;

export function RogueSettlement({
  run,
  view,
  config,
  save,
  firstRunGuide = false,
}: {
  run: RogueRunApi;
  view: RunView;
  config: GameConfig;
  save: GameSave;
  firstRunGuide?: boolean;
}) {
  const { lang } = useT();
  const data = view.settlement;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const committedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const displaySpeciesName = (species: string) => {
    const info = save.customSpecies[species]?.info ?? config.species[species];
    return speciesDisplayName(species, lang, info?.nameZh, info?.nameEn);
  };

  useEffect(() => {
    if (!paying) return;
    const stage = rootRef.current?.closest(".fr-stage");
    stage?.classList.add("is-settlement-paying");
    return () => stage?.classList.remove("is-settlement-paying");
  }, [paying]);

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  if (data == null) return null;

  const confirm = () => {
    if (paying || committedRef.current) return;
    setPaying(true);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const duration = reduced || document.hidden ? 120 : PAYMENT_MS;
    timerRef.current = window.setTimeout(() => {
      if (committedRef.current) return;
      committedRef.current = true;
      setPaid(true);
      window.setTimeout(() => run.confirmSettlement(), reduced ? 40 : 260);
    }, duration);
  };

  const cashFlows = data.cashFlows.filter((flow) => flow.kind !== "hire");
  const words = lang === "zh"
    ? {
        eyebrow: `第 ${data.shiftIndex} 班 · 下班回执`,
        title: "本班结算单",
        spent: "本班花费",
        received: "本班收入",
        bill: "待缴账单",
        details: "逐笔团队业绩明细",
        team: "团队业绩",
        base: "打工业绩",
        absorbed: "压榨业绩",
        extra: "额外业绩",
        pools: "元素 · 连携 · 工种 · 连击",
        empty: "本班没有获得团队业绩",
        desks: (count: number) => `${count} 张办公桌`,
        wallet: "我的钱包",
        after: "付款后余额",
        confirm: "确认并缴账单",
        paying: "正在缴账…",
        paid: "已缴 ✓",
        refund: "退款",
        trickle: "赶工滴入",
        kpiBonus: "绩效达成奖金",
      }
    : {
        eyebrow: `SHIFT ${data.shiftIndex} · CLOCK-OUT RECEIPT`,
        title: "Shift Statement",
        spent: "Spent",
        received: "Received",
        bill: "Bill Due",
        details: "Team Performance breakdown",
        team: "Team Performance",
        base: "Work Performance",
        absorbed: "Exploitation Performance",
        extra: "Bonus Performance",
        pools: "Element · Synergy · Job · Rhythm",
        empty: "No Team Performance earned this shift",
        desks: (count: number) => `${count} desk${count === 1 ? "" : "s"}`,
        wallet: "My wallet",
        after: "After payment",
        confirm: "Confirm & pay bill",
        paying: "Paying…",
        paid: "PAID ✓",
        refund: "Refund",
        trickle: "Rush trickle",
        kpiBonus: "KPI achievement bonus",
      };

  return (
    <div
      ref={rootRef}
      className={`fr-overlay fr-settlement-overlay${paying ? " is-paying" : ""}${paid ? " is-paid" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fr-settlement-title"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (paying) event.preventDefault();
      }}
    >
      <section className="fr-panel fr-settlement-panel">
        <span className="fr-settlement-clip" aria-hidden="true" />
        <header className="fr-settlement-head">
          <div>
            <div className="fr-settlement-eyebrow">{words.eyebrow}</div>
            <h2 id="fr-settlement-title">{words.title}</h2>
          </div>
          <div className={`fr-settlement-stamp${paid ? " is-visible" : ""}`}>{words.paid}</div>
        </header>

        <div className="fr-settlement-totals">
          <div className="fr-settlement-total is-spent">
            <span>{words.spent}</span><strong>−¥{formatCount(data.spentTotal)}</strong>
          </div>
          <div className="fr-settlement-total is-income">
            <span>{words.received}</span><strong>+¥{formatCount(data.receivedTotal)}</strong>
          </div>
          <div className="fr-settlement-total is-bill">
            <span>{words.bill}</span><strong>¥{formatCount(data.bill)}</strong>
          </div>
        </div>

        <div className="fr-settlement-ledger">
          <div className="fr-settlement-ledger-title">{words.details}</div>
          {data.pulses.length === 0 && <div className="fr-settlement-empty">{words.empty}</div>}
          {data.pulses.map((pulse, index) => {
            const extras = pulse.extras.reduce((sum, item) => sum + item.amount, 0);
            return (
              <details className="fr-settlement-pulse" key={`${pulse.uid}-${index}`} open={index < 2}>
                <summary>
                  <span className="fr-settlement-avatar">
                    <SvgSprite species={pulse.species} config={config} petState="success" />
                  </span>
                  <span className="fr-settlement-pulse-name">
                    <b>{displaySpeciesName(pulse.species)}</b>
                    <small>
                      #{index + 1} · {words.desks(pulse.deskCount)}
                      {" · "}×{pulse.deskScoreMult ?? pulse.deskCount}
                    </small>
                  </span>
                  <strong title={words.team}>+¥{formatCount(pulse.total + extras)}</strong>
                </summary>
                <div className="fr-settlement-contributors">
                  <div className="is-extra">
                    <span>{words.pools}</span>
                    <b>
                      ×{(pulse.elementMult ?? pulse.teamMult ?? 1).toFixed(2)}
                      {" · "}×{(pulse.synergyCardMult ?? pulse.networkMult ?? 1).toFixed(2)}
                      {" · "}×{(pulse.jobMult ?? pulse.individualMult ?? 1).toFixed(2)}
                      {" · "}×{(pulse.rhythmMult ?? pulse.comboMult ?? 1).toFixed(2)}
                    </b>
                  </div>
                  {pulse.contributors.map((part) => (
                    <div key={`${part.uid}-${part.role}`}>
                      <span>{part.role === "head" ? words.base : words.absorbed} · {displaySpeciesName(part.species)}</span>
                      <b>¥{formatCount(part.amount)}</b>
                    </div>
                  ))}
                  {pulse.extras.map((extra, extraIndex) => (
                    <div className="is-extra" key={`${extra.kind}-${extra.uid}-${extraIndex}`}>
                      <span>{words.extra} · {extra.kind}</span>
                      <b>¥{formatCount(extra.amount)}</b>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
          {cashFlows.map((flow, index) => (
            <div className="fr-settlement-flow" key={`${flow.kind}-${index}`}>
              <span>
                {flow.kind === "refund"
                  ? words.refund
                  : flow.kind === "kpiBonus"
                    ? words.kpiBonus
                    : words.trickle}
              </span>
              <b>+¥{formatCount(flow.amount)}</b>
            </div>
          ))}
        </div>

        <footer className="fr-settlement-foot">
          <div className="fr-settlement-payment">
            <div className="fr-settlement-wallet">
              <span>{words.wallet}</span>
              <strong>¥{formatCount(paying && paid ? data.cashAfterBill : data.cashBeforeBill)}</strong>
            </div>
            <div className="fr-settlement-arrow">→</div>
            <div className="fr-settlement-bill">
              <span>{words.bill}</span>
              <strong>¥{formatCount(data.bill)}</strong>
            </div>
            <div className="fr-settlement-after">
              <span>{words.after}</span>
              <b>¥{formatCount(data.cashAfterBill)}</b>
            </div>
          </div>
          <button
            autoFocus
            type="button"
            className="fr-chip fr-btn fr-btn-primary fr-settlement-confirm"
            data-coach={firstRunGuide ? "factorySettlementConfirm" : undefined}
            disabled={paying}
            onClick={confirm}
          >
            {paying ? words.paying : words.confirm}
          </button>
        </footer>

      </section>
    </div>
  );
}
