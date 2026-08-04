import { useCallback, useEffect, useState } from "react";
import type { FactoryLeaderboardEntry, FactoryLeaderboardPage, GameConfig } from "../../../types";
import { useT } from "../../../useT";
import { fmt, languageDefinition, localizeGameMessage, speciesDisplayName, type Language } from "../../../i18n";
import { FACTORY_ROGUE } from "../../../i18n/factoryRogue";
import { SvgSprite } from "../../../sprites/SvgSprite";
import { getGameBridge } from "../../bridge";
import { formatCount } from "../../format";
import { decodeLeaderboardSpecies } from "../leaderboardSpecies";

function Lineup({ entry, config, lang }: { entry: FactoryLeaderboardEntry; config: GameConfig; lang: Language }) {
  const R = FACTORY_ROGUE[lang];
  if (entry.loadout == null) return <span className="fr-lb-old">{R.lbLegacyLineup}</span>;
  return (
    <span className="fr-lb-lineup">
      {entry.loadout.map((code, index) => {
        const species = decodeLeaderboardSpecies(code);
        if (species == null || config.species[species] == null) return <span key={`${code}-${index}`} className="fr-lb-unknown">?</span>;
        const info = config.species[species];
        return (
          <span key={`${code}-${index}`} className="fr-lb-gulu" title={speciesDisplayName(species, lang, info.nameZh, info.nameEn)}>
            <SvgSprite species={species} config={config} petState="idle" />
          </span>
        );
      })}
    </span>
  );
}

function Row({ entry, config, lang, mine = false }: { entry: FactoryLeaderboardEntry; config: GameConfig; lang: Language; mine?: boolean }) {
  const R = FACTORY_ROGUE[lang];
  const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;
  return (
    <div className={`fr-lb-row rank-${Math.min(entry.rank, 4)}${entry.isMe || mine ? " is-me" : ""}`}>
      <div className="fr-lb-rank">{medal ?? `#${entry.rank}`}</div>
      <div className="fr-lb-player" title={entry.steamId}><strong>{entry.personaName}</strong>{entry.isMe && <small>{R.lbMe}</small>}</div>
      <div className="fr-lb-score"><strong>{formatCount(Number(entry.revenueTotal), lang)}</strong><small>{R.lbBestRevenue}</small></div>
      <div className="fr-lb-shift"><strong>{entry.bestShift ?? "—"}</strong><small>{R.lbBestShift}</small></div>
      <div className={`fr-lb-mode${entry.endless ? " is-endless" : ""}`}>{entry.endless == null ? "—" : entry.endless ? R.lbEndless : R.lbNormal}</div>
      <Lineup entry={entry} config={config} lang={lang} />
    </div>
  );
}

export function FactoryLeaderboard({ config, onClose }: { config: GameConfig; onClose: () => void }) {
  const { lang } = useT();
  const R = FACTORY_ROGUE[lang];
  const [page, setPage] = useState<FactoryLeaderboardPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void getGameBridge().getFactoryLeaderboard().then(setPage).catch((reason) => setError(String(reason))).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  const updated = page ? new Date(page.updatedAt * 1000).toLocaleTimeString(languageDefinition(lang).htmlLang, { hour: "2-digit", minute: "2-digit" }) : "—";
  return (
    <div className="fr-lb-overlay" role="dialog" aria-modal="true" aria-label={R.lbAria} onPointerDown={(event) => event.stopPropagation()}>
      <section className="fr-lb-board">
        <header className="fr-lb-head">
          <button type="button" className="fr-note fr-btn fr-lb-back" onClick={onClose}>← {R.lbBack}</button>
          <div className="fr-lb-title"><span>STEAM</span><strong>{R.lbTitle}</strong><em>{R.lbTop100}</em></div>
          <div className="fr-lb-tools"><small>{fmt(R.lbUpdated, { time: updated })}</small><button type="button" className="fr-note fr-btn" onClick={load} disabled={loading}>↻ {R.lbRefresh}</button></div>
        </header>
        <div className="fr-lb-labels"><span>{R.lbRankPlayer}</span><span>{R.lbColumns}</span></div>
        <div className="fr-lb-list">
          {loading && page == null ? <div className="fr-lb-message">{R.lbConnecting}</div> : error ? <div className="fr-lb-message is-error"><strong>{R.lbUnavailable}</strong><span>{localizeGameMessage(error, lang)}</span><button type="button" className="fr-note fr-btn" onClick={load}>{R.lbRetry}</button></div> : page?.entries.length ? page.entries.map((entry) => <Row key={entry.steamId} entry={entry} config={config} lang={lang} />) : <div className="fr-lb-message">{R.lbEmpty}</div>}
        </div>
        <footer className="fr-lb-me"><span className="fr-lb-me-tag">{R.lbMyRank}</span>{page?.me ? <Row entry={page.me} config={config} lang={lang} mine /> : <div className="fr-lb-not-ranked">{R.lbNotRanked}</div>}</footer>
      </section>
    </div>
  );
}
