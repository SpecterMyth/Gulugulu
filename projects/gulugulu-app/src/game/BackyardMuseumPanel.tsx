import type { MouseEvent as ReactMouseEvent } from "react";
import type { GameConfig } from "../types";
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
  const stopClick = (event: ReactMouseEvent) => event.stopPropagation();
  return (
    <div
      className={`by-poi-pop ${museumOpen ? "is-open" : ""}`}
      style={{ left: museumSide === "right" ? 4762 : 4138, bottom: 164 }}
      onClick={stopClick}
    >
      <div className="by-poi-title">
        📖 图鉴 {pokedexModel.fixedCollected}/{FIXED_DEX_TOTAL}
        {pokedexModel.aiCollected > 0 ? ` · AI ×${pokedexModel.aiCollected}` : ""}
      </div>
      {collectedSpecies.size > 0 ? (
        <div className="by-dex-thumbs">
          {museum.shown.map((species) => (
            <div key={species} className="by-dex-thumb" title={config.species[species]?.nameZh ?? species}>
              <SvgSprite species={species} config={config} petState="idle" />
            </div>
          ))}
          {museum.overflow > 0 && (
            <div className="by-dex-thumb by-dex-thumb-more" title="打开图鉴查看全部">
              +{museum.overflow}
            </div>
          )}
        </div>
      ) : (
        <div className="by-poi-empty">还没有收集到伙伴——孵化或融合精灵试试！</div>
      )}
      <button
        type="button"
        className="by-poi-cta"
        onClick={(event) => {
          event.stopPropagation();
          setDexOpen(true);
        }}
      >
        📖 打开图鉴
      </button>
    </div>
  );
}
