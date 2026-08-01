import { useCallback, useEffect, useState } from "react";
import type { FactoryLeaderboardEntry, FactoryLeaderboardPage, GameConfig } from "../../../types";
import { useT } from "../../../useT";
import { speciesDisplayName } from "../../../i18n";
import { SvgSprite } from "../../../sprites/SvgSprite";
import { getGameBridge } from "../../bridge";
import { formatCount } from "../../format";
import { decodeLeaderboardSpecies } from "../leaderboardSpecies";

function Lineup({ entry, config, lang }: { entry: FactoryLeaderboardEntry; config: GameConfig; lang: "zh" | "en" }) {
  if (entry.loadout == null) return <span className="fr-lb-old">{lang === "zh" ? "历史记录未保存阵容" : "Lineup unavailable for legacy record"}</span>;
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

function Row({ entry, config, lang, mine = false }: { entry: FactoryLeaderboardEntry; config: GameConfig; lang: "zh" | "en"; mine?: boolean }) {
  const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;
  return (
    <div className={`fr-lb-row rank-${Math.min(entry.rank, 4)}${entry.isMe || mine ? " is-me" : ""}`}>
      <div className="fr-lb-rank">{medal ?? `#${entry.rank}`}</div>
      <div className="fr-lb-player" title={entry.steamId}><strong>{entry.personaName}</strong>{entry.isMe && <small>{lang === "zh" ? "我" : "ME"}</small>}</div>
      <div className="fr-lb-score"><strong>{formatCount(Number(entry.revenueTotal), lang)}</strong><small>{lang === "zh" ? "最高营收" : "BEST REVENUE"}</small></div>
      <div className="fr-lb-shift"><strong>{entry.bestShift ?? "—"}</strong><small>{lang === "zh" ? "最高班次" : "BEST SHIFT"}</small></div>
      <div className={`fr-lb-mode${entry.endless ? " is-endless" : ""}`}>{entry.endless == null ? "—" : entry.endless ? (lang === "zh" ? "无限" : "ENDLESS") : (lang === "zh" ? "普通" : "NORMAL")}</div>
      <Lineup entry={entry} config={config} lang={lang} />
    </div>
  );
}

export function FactoryLeaderboard({ config, onClose }: { config: GameConfig; onClose: () => void }) {
  const { lang } = useT();
  const [page, setPage] = useState<FactoryLeaderboardPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void getGameBridge().getFactoryLeaderboard().then(setPage).catch((reason) => setError(String(reason))).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  const updated = page ? new Date(page.updatedAt * 1000).toLocaleTimeString(lang === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" }) : "—";
  return (
    <div className="fr-lb-overlay" role="dialog" aria-modal="true" aria-label={lang === "zh" ? "Steam 全球排行榜" : "Steam Global Leaderboard"} onPointerDown={(event) => event.stopPropagation()}>
      <section className="fr-lb-board">
        <header className="fr-lb-head">
          <button type="button" className="fr-note fr-btn fr-lb-back" onClick={onClose}>← {lang === "zh" ? "返回" : "BACK"}</button>
          <div className="fr-lb-title"><span>STEAM</span><strong>{lang === "zh" ? "全球打工排行榜" : "GLOBAL FACTORY LEADERBOARD"}</strong><em>{lang === "zh" ? "全球前 100 名" : "GLOBAL TOP 100"}</em></div>
          <div className="fr-lb-tools"><small>{lang === "zh" ? `更新于 ${updated}` : `Updated ${updated}`}</small><button type="button" className="fr-note fr-btn" onClick={load} disabled={loading}>↻ {lang === "zh" ? "刷新" : "REFRESH"}</button></div>
        </header>
        <div className="fr-lb-labels"><span>{lang === "zh" ? "名次 / 玩家" : "RANK / PLAYER"}</span><span>{lang === "zh" ? "营收 / 班次 / 模式 / 创纪录阵容" : "REVENUE / SHIFT / MODE / RECORD LINEUP"}</span></div>
        <div className="fr-lb-list">
          {loading && page == null ? <div className="fr-lb-message">{lang === "zh" ? "正在连接 Steam 排行榜…" : "Connecting to Steam leaderboard…"}</div> : error ? <div className="fr-lb-message is-error"><strong>{lang === "zh" ? "排行榜暂时无法读取" : "Leaderboard unavailable"}</strong><span>{error}</span><button type="button" className="fr-note fr-btn" onClick={load}>{lang === "zh" ? "重试" : "TRY AGAIN"}</button></div> : page?.entries.length ? page.entries.map((entry) => <Row key={entry.steamId} entry={entry} config={config} lang={lang} />) : <div className="fr-lb-message">{lang === "zh" ? "榜单还是空的，去创造第一条纪录吧！" : "No records yet. Be the first!"}</div>}
        </div>
        <footer className="fr-lb-me"><span className="fr-lb-me-tag">{lang === "zh" ? "我的排名" : "MY RANK"}</span>{page?.me ? <Row entry={page.me} config={config} lang={lang} mine /> : <div className="fr-lb-not-ranked">{lang === "zh" ? "尚未上榜 · 完成一局即可提交成绩" : "Not ranked · Finish a run to submit a score"}</div>}</footer>
      </section>
    </div>
  );
}
