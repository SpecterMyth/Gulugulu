// 终局结算板：升阶材料是主收获，营收与跑局统计退到第二视觉层级。
// 奖励数据只展示本局实际入库的增量；同日重复通关不会把未发放的材料画出来。

import { useEffect, useState } from "react";
import { fmt } from "../../../i18n";
import { useT } from "../../../useT";
import type { CSSProperties } from "react";
import type { FactoryLeaderboardStatus, GameConfig } from "../../../types";
import { formatCount } from "../../format";
import { FACTORY_ROGUE } from "../../../i18n/factoryRogue";
import { TOTAL_SHIFTS } from "../rogueConfig";
import type { RogueRunApi, RunView } from "../rogueTypes";
import { emitPaperFx } from "../../../ui/PaperFx";

const MATERIAL_ICONS: Record<string, string> = {
  ironBadge: "🔩",
  copperGoggles: "🥽",
  silverHelmet: "⛑️",
  goldWrench: "🔧",
  platinumVest: "🦺",
  goldenBadge: "🎫",
};

const CONFETTI = Array.from({ length: 48 }, (_, index) => ({
  id: index,
  x: (index * 37 + 11) % 100,
  delay: (index * 37) % 220,
  duration: 2100 + ((index * 47) % 1700),
  drift: ((index * 29) % 180) - 90,
  rotation: (index * 71) % 360,
  color: ["#ff5b75", "#ffd84d", "#54c7ec", "#78d66b", "#a77bf3", "#ff9f43"][index % 6],
}));

function withoutLeadingIcon(label: string): string {
  const separator = label.indexOf(" ");
  return separator < 0 ? label : label.slice(separator + 1);
}

export function RogueSummary({
  run,
  view,
  config,
  rewards,
  todayClaimedLevel,
  madeRevenueRecord,
  leaderboardStatus,
  onRetry,
  onExit,
  onLeaderboard,
}: {
  run: RogueRunApi;
  view: RunView;
  config: GameConfig;
  rewards: Record<string, number>;
  todayClaimedLevel: number;
  madeRevenueRecord: boolean;
  leaderboardStatus: FactoryLeaderboardStatus | null;
  onRetry: () => void;
  onExit: () => void;
  onLeaderboard: () => void;
}) {
  const { lang, T } = useT();
  const R = FACTORY_ROGUE[lang];
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const bankrupt = view.phase === "bankrupt";
  const title = bankrupt
    ? R.sumBankrupt
    : view.shiftIndex > TOTAL_SHIFTS || view.endless
      ? R.sumEndlessOver
      : R.sumGraduate;
  const records = run.records();
  const stats = view.stats;
  // 毕业(通关 summary,尚未进无限)= 金辉变体 + 无限解锁徽章动画。
  const graduated = view.phase === "summary" && !view.endless;
  useEffect(() => {
    if (bankrupt || (!graduated && !madeRevenueRecord)) return;
    emitPaperFx({
      intensity: 3,
      preset: "factory",
      eventId: `factory-summary:${view.revenueTotal}:${view.shiftIndex}:${madeRevenueRecord ? "record" : "graduate"}`,
    });
  }, [bankrupt, graduated, madeRevenueRecord, view.revenueTotal, view.shiftIndex]);
  const materialOrder = Array.from(new Set([
    ...(config.factoryRewardMaterials ?? []),
    ...Object.keys(rewards),
  ]));
  const rewardEntries = materialOrder
    .map((id) => ({ id, count: rewards[id] ?? 0 }))
    .filter((item) => item.count > 0);
  const rewardTotal = rewardEntries.reduce((sum, item) => sum + item.count, 0);
  const todayRewards: Record<string, number> = {};
  for (let level = 1; level <= todayClaimedLevel; level += 1) {
    const id = config.factoryRewardMaterials?.[Math.floor((level - 1) / 5)];
    if (id) todayRewards[id] = (todayRewards[id] ?? 0) + 1;
  }
  const todayEntries = materialOrder
    .map((id) => ({ id, count: todayRewards[id] ?? 0 }))
    .filter((item) => item.count > 0);
  const selectedLabel = selectedMaterial == null
    ? ""
    : withoutLeadingIcon(T.bk.training.materialNames[selectedMaterial] ?? selectedMaterial);
  const selectedRunCount = selectedMaterial == null ? 0 : rewards[selectedMaterial] ?? 0;
  const selectedTodayCount = selectedMaterial == null ? 0 : todayRewards[selectedMaterial] ?? 0;

  return (
    <div className="fr-overlay">
      {madeRevenueRecord && (
        <div className="fr-record-confetti" aria-hidden="true">
          {CONFETTI.map((piece) => (
            <i
              key={piece.id}
              className={piece.id % 5 === 0 ? "is-note" : piece.id % 3 === 0 ? "is-scrap" : "is-strip"}
              style={{
                "--confetti-x": `${piece.x}vw`,
                "--confetti-delay": `${piece.delay}ms`,
                "--confetti-duration": `${piece.duration}ms`,
                "--confetti-drift": `${piece.drift}px`,
                "--confetti-rotation": `${piece.rotation}deg`,
                "--confetti-color": piece.color,
              } as CSSProperties}
            />
          ))}
        </div>
      )}
      {madeRevenueRecord && (
        <div className="fr-sum-record-note" role="status">
          <span>★ NEW RECORD ★</span>
          <strong>{R.steamNewRecord}</strong>
          <small>{formatCount(view.revenueTotal)}</small>
        </div>
      )}
      <div
        className={`fr-panel fr-sum-panel${bankrupt ? " is-late" : ""}${graduated ? " is-grad" : ""}`}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="fr-sum-heading">
          <div className={`fr-sum-title${bankrupt ? " is-bankrupt" : ""}`}>
            {bankrupt ? "✕ " : "🎓 "}
            {title}
          </div>
          {graduated && <div className="fr-sum-badge">{R.sumEndlessBadge}</div>}
          <div className="fr-sum-revenue">
            <span className="fr-sum-revenue-label">{R.sumRevenue}</span>
            <span className="fr-sum-revenue-num">{formatCount(view.revenueTotal)}</span>
          </div>
        </div>

        <div className="fr-sum-content">
        <section className="fr-sum-rewards" aria-labelledby="fr-sum-rewards-title">
          <header className="fr-sum-rewards-head">
            <div>
              <span className="fr-sum-rewards-kicker">FACTORY DROP</span>
              <h3 id="fr-sum-rewards-title">{R.sumRewards}</h3>
              <p>{R.sumUpgradeHint}</p>
            </div>
            {rewardTotal > 0 && (
              <strong>{fmt(R.sumRewardsTotal, { count: formatCount(rewardTotal) })}</strong>
            )}
          </header>

          <div className="fr-sum-coin-reward">
            <span>🪙 {R.sumCoinsEarned}</span>
            <strong>+{formatCount(view.revenueTotal)}</strong>
          </div>

          <h4 className="fr-sum-reward-subtitle">{R.sumThisRunItems}</h4>

          {rewardEntries.length > 0 ? (
            <div className="fr-sum-reward-cards">
              {rewardEntries.map(({ id, count }) => {
                const label = T.bk.training.materialNames[id] ?? id;
                return (
                  <button
                    type="button"
                    className={`fr-sum-reward-card is-${id}`}
                    key={id}
                    aria-label={fmt(R.sumItemTipAria, { name: withoutLeadingIcon(label), count: formatCount(count) })}
                    onClick={() => setSelectedMaterial(id)}
                  >
                    <span className="fr-sum-reward-pin" aria-hidden="true" />
                    <span className="fr-sum-reward-icon" aria-hidden="true">
                      {MATERIAL_ICONS[id] ?? "📦"}
                    </span>
                    <strong>×{formatCount(count)}</strong>
                    <small>{R.sumTapForTip}</small>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="fr-sum-rewards-empty">
              <span aria-hidden="true">📭</span>
              <div>
                <b>{R.sumRewardsEmpty}</b>
                <small>{R.sumRewardsEmptyHint}</small>
              </div>
            </div>
          )}

          <h4 className="fr-sum-reward-subtitle">{R.sumTodayItems}</h4>
          {todayEntries.length > 0 ? (
            <div className="fr-sum-today-items">
              {todayEntries.map(({ id, count }) => (
                <button type="button" key={id} onClick={() => setSelectedMaterial(id)}>
                  <span aria-hidden="true">{MATERIAL_ICONS[id] ?? "📦"}</span>
                  <b>×{formatCount(count)}</b>
                </button>
              ))}
            </div>
          ) : (
            <div className="fr-sum-today-empty">{R.sumTodayEmpty}</div>
          )}
        </section>

        <aside className="fr-sum-details">
          <h3>{R.sumPerformance}</h3>
          <div className="fr-sum-grid">
            <div className="fr-sum-row">
              <span>{R.sumShifts}</span>
              <span className="v">{view.shiftIndex}</span>
            </div>
            <div className="fr-sum-row">
              <span>{R.sumMaxPulse}</span>
              <span className="v">{formatCount(stats.maxPulse)}</span>
            </div>
            <div className="fr-sum-row">
              <span>{R.sumMaxCombo}</span>
              <span className="v">×{stats.maxCombo}</span>
            </div>
            <div className="fr-sum-row">
              <span>{R.sumMaxDesks}</span>
              <span className="v">{stats.maxDesks}</span>
            </div>
            <div className="fr-sum-row">
              <span>{R.sumStrikes}</span>
              <span className="v">{stats.strikes}</span>
            </div>
            <div className="fr-sum-row">
              <span>{R.sumThrows}</span>
              <span className="v">{stats.throws}</span>
            </div>
            <div className="fr-sum-row">
              <span>{R.sumBounces}</span>
              <span className="v">{stats.bounces}</span>
            </div>
          </div>

          <div className="fr-sum-records">
            <span>{fmt("{label} {v}", { label: R.sumBestRevenue, v: formatCount(records.bestRevenue) })}</span>
            <span>{fmt("{label} {v}", { label: R.sumBestShift, v: records.bestShift })}</span>
            <span>{fmt("{label} {v}", { label: R.sumRuns, v: records.runs })}</span>
          </div>
          {leaderboardStatus?.globalRank != null ? (
            <button type="button" className="fr-sum-steam-rank" onClick={onLeaderboard}>
              <span aria-hidden="true">STEAM</span>
              <strong>{fmt(R.steamGlobalRank, { rank: leaderboardStatus.globalRank })}</strong>
              <small>{lang === "zh" ? "点击查看全球榜" : "View leaderboard"}</small>
            </button>
          ) : leaderboardStatus?.pending ? (
            <button type="button" className="fr-sum-steam-rank is-syncing" onClick={onLeaderboard}>
              <span aria-hidden="true">STEAM</span>
              <strong>{R.steamSyncing}</strong>
              <small>{lang === "zh" ? "点击查看全球榜" : "View leaderboard"}</small>
            </button>
          ) : (
            <button type="button" className="fr-sum-steam-rank" onClick={onLeaderboard}>
              <span aria-hidden="true">STEAM</span>
              <strong>{lang === "zh" ? "Steam 全球第 — 名" : "Steam global rank —"}</strong>
              <small>{lang === "zh" ? "点击查看全球榜" : "View leaderboard"}</small>
            </button>
          )}
        </aside>
        </div>

        <div className="fr-sum-actions">
          {/* 毕业(通关 summary,尚未进入无限)可直接续班冲榜。 */}
          {view.phase === "summary" && !view.endless && (
            <button
              type="button"
              className="fr-chip fr-btn fr-btn-primary"
              onClick={() => run.continueEndless()}
            >
              {R.sumContinueEndless}
            </button>
          )}
          <button
            type="button"
            className={`fr-chip fr-btn${bankrupt || view.endless ? " fr-btn-primary" : ""}`}
            onClick={onRetry}
          >
            {R.sumRetry}
          </button>
          <button type="button" className="fr-chip fr-btn" onClick={onExit}>
            {R.sumBack}
          </button>
        </div>

        {selectedMaterial != null && (
          <div className="fr-sum-tip-shade" role="presentation" onClick={() => setSelectedMaterial(null)}>
            <div
              className={`fr-sum-item-tip is-${selectedMaterial}`}
              role="dialog"
              aria-modal="true"
              aria-label={selectedLabel}
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="fr-sum-tip-close" onClick={() => setSelectedMaterial(null)}>×</button>
              <span className="fr-sum-tip-icon" aria-hidden="true">{MATERIAL_ICONS[selectedMaterial] ?? "📦"}</span>
              <h3>{selectedLabel}</h3>
              <p>{R.sumItemUpgradeTip}</p>
              <div>
                <span>{R.sumThisRunItems}<b>×{formatCount(selectedRunCount)}</b></span>
                <span>{R.sumTodayItems}<b>×{formatCount(selectedTodayCount)}</b></span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
