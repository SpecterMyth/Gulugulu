import type { MouseEvent as ReactMouseEvent } from "react";
import type { GameConfig } from "../types";
import { fmt, speciesDisplayName } from "../i18n";
import { useT } from "../useT";
import { SvgSprite } from "../sprites/SvgSprite";
import { FIXED_DEX_TOTAL, type PokedexModel } from "./pokedexData";

// ---------------------------------------------------------------------------
// 图鉴馆弹板（靠近显示）：已收集角色的彩色缩略图 + 图鉴入口。
// 从 BackyardScene 抽出的纯展示块。
// ---------------------------------------------------------------------------

export type BackyardMuseumPanelProps = {
  museumOpen: boolean;
  museumSide: "left" | "right";
  pokedexModel: PokedexModel;
  collectedSpecies: Set<string>;
  museum: { shown: string[]; overflow: number };
  config: GameConfig;
  setDexOpen: (open: boolean) => void;
};

export function BackyardMuseumPanel({
  museumOpen,
  museumSide,
  pokedexModel,
  collectedSpecies,
  museum,
  config,
  setDexOpen,
}: BackyardMuseumPanelProps) {
  const { lang, T } = useT();
  const bk = T.bk.museum;
  const stopClick = (event: ReactMouseEvent) => event.stopPropagation();
  return (
    <div
      className={`by-poi-pop ${museumOpen ? "is-open" : ""}`}
      style={{ left: museumSide === "right" ? 3462 : 2838, bottom: 164 }}
      onClick={stopClick}
    >
      <div className="by-poi-title">
        {fmt(T.bk.dexProgress, { collected: pokedexModel.fixedCollected, total: FIXED_DEX_TOTAL })}
        {pokedexModel.aiCollected > 0 ? fmt(bk.aiSuffix, { count: pokedexModel.aiCollected }) : ""}
      </div>
      {collectedSpecies.size > 0 ? (
        <div className="by-dex-thumbs">
          {museum.shown.map((species) => (
            <div
              key={species}
              className="by-dex-thumb"
              title={speciesDisplayName(species, lang, config.species[species]?.nameZh, config.species[species]?.nameEn)}
            >
              <SvgSprite species={species} config={config} petState="idle" />
            </div>
          ))}
          {museum.overflow > 0 && (
            <div className="by-dex-thumb by-dex-thumb-more" title={bk.moreTitle}>
              +{museum.overflow}
            </div>
          )}
        </div>
      ) : (
        <div className="by-poi-empty">{bk.empty}</div>
      )}
      <button
        type="button"
        className="by-poi-cta"
        onClick={(event) => {
          event.stopPropagation();
          setDexOpen(true);
        }}
      >
        {bk.openBtn}
      </button>
    </div>
  );
}
