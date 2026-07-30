import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GameConfig } from "../../../types";
import { elementName, speciesDisplayName } from "../../../i18n";
import { useT } from "../../../useT";
import { SvgSprite } from "../../../sprites/SvgSprite";
import { ElementIcon } from "../../ElementIcon";
import { formatCount } from "../../format";
import { HIRING_PICK_LIMIT } from "../rogueConfig";
import type { RogueRunApi, RunView } from "../rogueTypes";

function elementStripe(elements: string[], config: GameConfig): string {
  const colors = elements.map((element) => config.elements[element]?.color ?? "#C9CFD9");
  const safe = colors.length > 0 ? colors : ["#C9CFD9"];
  const stops = safe.flatMap((color, index) => {
    const start = (index / safe.length) * 100;
    const end = ((index + 1) / safe.length) * 100;
    return [`${color} ${start}%`, `${color} ${end}%`];
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

const HIRING_NOTE_POSES = [
  { angle: -1.7, offset: 3 },
  { angle: 1.1, offset: -4 },
  { angle: -0.8, offset: 1 },
  { angle: 1.6, offset: -2 },
  { angle: -1.2, offset: 4 },
  { angle: 1.4, offset: -3 },
  { angle: -1.5, offset: 2 },
  { angle: 0.8, offset: -4 },
  { angle: -1, offset: 3 },
  { angle: 1.8, offset: -1 },
] as const;

export function RogueHiring({
  run,
  view,
  config,
  firstRunGuide = false,
  onGuideCandidateToggle,
}: {
  run: RogueRunApi;
  view: RunView;
  config: GameConfig;
  firstRunGuide?: boolean;
  onGuideCandidateToggle?: () => void;
}) {
  const { lang } = useT();
  const hiring = view.hiring;
  if (hiring == null) return null;
  const zh = lang === "zh";
  const total = hiring.hireCost + hiring.rerollSpent;
  const after = view.cash - total;
  const afterBill = after - view.bill;
  const selectableCount = Math.min(
    hiring.candidates.length,
    HIRING_PICK_LIMIT,
    Math.max(0, view.quotaMax - view.quotaUsed),
  );
  const allSelected = selectableCount > 0 && hiring.selectedCount === selectableCount;
  const isPoolFull = view.quotaUsed >= view.quotaMax;
  const guideCandidateId = firstRunGuide
    ? [...hiring.candidates].sort((a, b) => b.price - a.price)[0]?.id
    : undefined;
  const [pendingAction, setPendingAction] = useState<"next" | "clock" | null>(null);
  const [hiringFlights, setHiringFlights] = useState<Array<{
    id: number;
    markup: string;
    width: number;
    height: number;
    accent: string;
    stripe: string;
    left: number;
    top: number;
    dx: number;
    dy: number;
    delay: number;
    angle: number;
  }>>([]);
  const cardRefs = useRef(new Map<number, HTMLButtonElement>());
  const flightTimerRef = useRef<number | null>(null);
  const isFlying = hiringFlights.length > 0;

  useEffect(() => () => {
    if (flightTimerRef.current != null) window.clearTimeout(flightTimerRef.current);
  }, []);

  const performAction = (action: "next" | "clock") => {
    setPendingAction(null);
    const selected = hiring.candidates.filter((candidate) => candidate.selected);
    if (selected.length === 0) {
      run.confirmHiring(action === "next");
      return;
    }

    const target = document.querySelector<HTMLElement>(".fhp-pool-total")
      ?? document.querySelector<HTMLElement>(".fr-hiring-quota-note");
    const targetRect = target?.getBoundingClientRect();
    const targetX = targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth - 90;
    const targetY = targetRect ? targetRect.top + targetRect.height / 2 : 70;
    const flights = selected.flatMap((candidate, index) => {
      const card = cardRefs.current.get(candidate.id);
      const source = card?.getBoundingClientRect();
      if (card == null || source == null) return [];
      const accent = config.elements[candidate.elements[0]]?.color ?? "#ffd83d";
      const stripe = elementStripe(candidate.elements, config);
      const left = source.left;
      const top = source.top;
      const candidateIndex = hiring.candidates.findIndex((item) => item.id === candidate.id);
      const pose = HIRING_NOTE_POSES[candidateIndex] ?? HIRING_NOTE_POSES[0];
      return [{
        id: candidate.id,
        markup: card.innerHTML,
        width: source.width,
        height: source.height,
        accent,
        stripe,
        left,
        top,
        dx: targetX - (left + source.width / 2),
        dy: targetY - (top + source.height / 2),
        delay: index * 55,
        angle: pose.angle,
      }];
    });

    setHiringFlights(flights);
    const finishDelay = 800 + Math.max(0, flights.length - 1) * 55;
    flightTimerRef.current = window.setTimeout(() => {
      run.confirmHiring(action === "next");
      setHiringFlights([]);
    }, finishDelay);
  };

  const requestAction = (action: "next" | "clock") => {
    if (!hiring.canConfirm) return;
    const needsEmptyWarning = hiring.selectedCount === 0 && !isPoolFull;
    const needsLowPoolWarning = action === "clock" && hiring.projectedPoolTotal < 10;
    if (needsEmptyWarning || needsLowPoolWarning) setPendingAction(action);
    else performAction(action);
  };

  const toggleAllCandidates = () => {
    run.setAllHiringCandidates(!allSelected);
  };

  return (
    <div className="fr-overlay fr-hiring-overlay" onPointerDown={(event) => event.stopPropagation()}>
      <section className="fr-hiring-panel">
        <header className="fr-hiring-head">
          <div className="fr-hiring-title-note">{zh ? "咕噜招聘" : "GULU HIRING"}</div>
          <div className="fr-hiring-shift-note">
            {zh ? `第 ${view.shiftIndex} 班 · 招聘 ${hiring.round}/${hiring.roundsMax}` : `Shift ${view.shiftIndex} · Draft ${hiring.round}/${hiring.roundsMax}`}
          </div>
          <div className="fr-hiring-head-spacer" />
          <div className="fr-hiring-cash-note">
            <small>{zh ? "现有现金" : "CASH"}</small>
            <b>${formatCount(view.cash)}</b>
          </div>
          <div className="fr-hiring-quota-note">
            <small>{zh ? "咕噜池" : "GULU POOL"}</small>
            <b>{view.quotaUsed}/{view.quotaMax}</b>
          </div>
        </header>

        <p className="fr-hiring-tip">
          {zh
            ? "所有咕噜均已预选；取消不需要的咕噜后一次付款。已选咕噜不会被刷新。"
            : "All Gulus are preselected. Uncheck any you do not want, then pay once. Selected Gulus survive rerolls."}
        </p>

        <div className="fr-hiring-candidates">
          {hiring.candidates.map((candidate, index) => {
            const info = config.species[candidate.species];
            const accent = config.elements[candidate.elements[0]]?.color ?? "#ffd83d";
            const pose = HIRING_NOTE_POSES[index] ?? HIRING_NOTE_POSES[0];
            return (
              <button
                type="button"
                key={candidate.id}
                ref={(node) => {
                  if (node == null) cardRefs.current.delete(candidate.id);
                  else cardRefs.current.set(candidate.id, node);
                }}
                className={`fr-hiring-card${candidate.selected ? " is-selected" : ""}${
                  hiringFlights.some((flight) => flight.id === candidate.id) ? " is-flight-source" : ""
                }`}
                data-coach={
                  firstRunGuide && candidate.id === guideCandidateId
                    ? "factoryHiringCandidate"
                    : undefined
                }
                style={{
                  "--hire-accent": accent,
                  "--hire-stripe": elementStripe(candidate.elements, config),
                  "--hire-note-angle": `${pose.angle}deg`,
                  "--hire-note-offset": `${pose.offset}px`,
                  "--hire-note-delay": `${index * 38}ms`,
                } as CSSProperties}
                disabled={isFlying}
                onClick={() => {
                  run.toggleHiringCandidate(candidate.id);
                  if (candidate.id === guideCandidateId) onGuideCandidateToggle?.();
                }}
              >
                <span className="fr-hiring-card-stripe" aria-hidden="true" />
                <span className="fr-hiring-card-state">
                  {candidate.selected ? (zh ? "录用 ✓" : "IN ✓") : (zh ? "待选" : "PICK")}
                </span>
                <span className="fr-hiring-sprite">
                  <SvgSprite species={candidate.species} config={config} petState="idle" />
                </span>
                <strong>{speciesDisplayName(candidate.species, lang, info?.nameZh, info?.nameEn)}</strong>
                <span className="fr-hiring-card-stats">
                  <span className="fr-hiring-elements">
                    {candidate.elements.map((element) => (
                      <ElementIcon
                        key={element}
                        badge={config.elements[element]?.badge ?? "star"}
                        color={config.elements[element]?.color ?? "#B07B44"}
                        size={19}
                        title={elementName(element, lang)}
                      />
                    ))}
                  </span>
                  <span
                    className="fr-hiring-base"
                    title={zh ? "打工业绩" : "Work Performance"}
                  >
                    ★{candidate.baseValue}
                  </span>
                </span>
                <span className="fr-hiring-card-bottom">
                  <b
                    className="fr-hiring-reach"
                    title={zh ? "压榨数" : "Exploitation Count"}
                  >
                    ⛓ {candidate.reach}
                  </b>
                  <span className="fr-hiring-pricebar">
                    {candidate.price < 1000 && <small>{zh ? "雇佣" : "HIRE"}</small>}
                    ${formatCount(candidate.price)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="fr-hiring-pool">
          <strong>{zh ? "当前咕噜池" : "CURRENT GULU POOL"}</strong>
          <b className={hiring.poolTotal < 10 ? "is-low" : ""}>
            {zh ? `共 ${hiring.poolTotal} 只` : `${hiring.poolTotal} TOTAL`}
          </b>
          <div className="fr-hiring-pool-list">
            {hiring.poolCounts.length === 0 ? (
              <span className="is-empty">{zh ? "咕噜池为空" : "GULU POOL IS EMPTY"}</span>
            ) : hiring.poolCounts.map(({ species, count }) => {
              const info = config.species[species];
              return (
                <span
                  key={species}
                  className="fr-hiring-pool-pet"
                  title={speciesDisplayName(species, lang, info?.nameZh, info?.nameEn)}
                  aria-label={`${speciesDisplayName(species, lang, info?.nameZh, info?.nameEn)} × ${count}`}
                >
                  <span className="fr-hiring-pool-avatar" aria-hidden="true">
                    <SvgSprite species={species} config={config} petState="idle" />
                  </span>
                  <b>×{count}</b>
                </span>
              );
            })}
          </div>
        </div>

        <div className="fr-hiring-money">
          <div><small>{zh ? "本轮已选" : "PICKED"}</small><b>{hiring.selectedCount}/{hiring.candidates.length}</b></div>
          <div><small>{zh ? "雇佣费用" : "HIRE COST"}</small><b>${formatCount(hiring.hireCost)}</b></div>
          <div><small>REROLL</small><b>${formatCount(hiring.rerollSpent)}</b></div>
          <div className="is-primary"><small>{zh ? "支付后现金" : "CASH AFTER PAY"}</small><b>${formatCount(after)}</b></div>
          <div className={afterBill < 0 ? "is-danger" : ""}><small>{zh ? "预留账单后" : "AFTER BILL"}</small><b>${formatCount(afterBill)}</b></div>
        </div>

        <footer className="fr-hiring-foot">
          <button
            type="button"
            className="fr-hiring-reroll"
            disabled={isFlying || hiring.rerollCost == null || hiring.rerollsUsed >= hiring.rerollsMax}
            onClick={() => run.rerollHiring()}
          >
            {zh ? "刷新未选咕噜" : "REROLL UNSELECTED GULUS"}
            {hiring.rerollCost != null ? ` · $${formatCount(hiring.rerollCost)}` : ""}
            <small>{hiring.rerollsUsed}/{hiring.rerollsMax}</small>
          </button>
          <div className="fr-hiring-foot-spacer" />
          <button
            type="button"
            className="fr-hiring-continue fr-hiring-select-all"
            disabled={isFlying || selectableCount === 0}
            onClick={toggleAllCandidates}
          >
            {allSelected
              ? (zh ? "取消全选" : "CLEAR ALL")
              : (zh ? "选取所有" : "SELECT ALL")}
          </button>
          <button
            type="button"
            className="fr-hiring-clock"
            data-coach={
              firstRunGuide && pendingAction == null
                ? "factoryHiringPay"
                : undefined
            }
            disabled={isFlying || !hiring.canConfirm}
            onClick={() => requestAction(hiring.canContinue ? "next" : "clock")}
          >
            {!hiring.canAfford
              ? (zh ? "钱不够" : "NOT ENOUGH CASH")
              : !hiring.hasQuota
                ? (zh ? "咕噜池已满" : "GULU POOL FULL")
                : hiring.canContinue
                  ? (zh ? "付款并进入下一轮" : "PAY & NEXT DRAFT")
                  : (zh ? "付款并开工！" : "PAY & CLOCK IN!")}
          </button>
        </footer>

        {pendingAction != null && (
          <div className="fr-hiring-confirm" role="dialog" aria-modal="true">
            <div className="fr-hiring-confirm-note">
              <strong>{zh ? "确认继续？" : "CONTINUE?"}</strong>
              {hiring.selectedCount === 0 && !isPoolFull && (
                <p>{zh ? "你这一轮没有选择任何咕噜。" : "You have not selected any Gulu this draft."}</p>
              )}
              {pendingAction === "clock" && hiring.projectedPoolTotal < 10 && (
                <p>
                  {zh
                    ? `开工后咕噜池中只有 ${hiring.projectedPoolTotal} 只咕噜，储备已经很少。`
                    : `Only ${hiring.projectedPoolTotal} Gulus will remain in your Gulu pool. Your reserve is running low.`}
                </p>
              )}
              <div>
                <button type="button" onClick={() => setPendingAction(null)}>
                  {zh ? "返回招聘" : "GO BACK"}
                </button>
                <button
                  type="button"
                  className="is-confirm"
                  data-coach={firstRunGuide ? "factoryHiringPay" : undefined}
                  onClick={() => performAction(pendingAction)}
                >
                  {zh ? "确认继续" : "CONTINUE"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
      {hiringFlights.map((flight) => (
        <div
          className="fr-hiring-flight-note fr-hiring-card is-selected"
          key={flight.id}
          aria-hidden="true"
          style={{
            left: flight.left,
            top: flight.top,
            width: flight.width,
            height: flight.height,
            "--hire-accent": flight.accent,
            "--hire-stripe": flight.stripe,
            "--fr-fly-x": `${flight.dx}px`,
            "--fr-fly-y": `${flight.dy}px`,
            "--hire-note-angle": `${flight.angle}deg`,
            animationDelay: `${flight.delay}ms`,
          } as CSSProperties}
          dangerouslySetInnerHTML={{ __html: flight.markup }}
        />
      ))}
    </div>
  );
}
