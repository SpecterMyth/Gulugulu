import type { MouseEvent as ReactMouseEvent } from "react";
import type { GameConfig, GameSave } from "../types";
import { elementName, fmt, speciesDisplayName } from "../i18n";
import { useT } from "../useT";
import { EggSvg } from "../sprites/SvgSprite";
import { eggPoolCandidates, eggPriceFor, shopMaxLevel, shopUpgradeCost } from "./config";
import { formatCount } from "./format";

// ---------------------------------------------------------------------------
// 商店弹出商品板（分阶蛋 · 默认最高阶 · 左右翻页 · 2×3 两行）。
// 从 BackyardScene 抽出的纯展示块；接收其原本闭包引用的值与回调。
// ---------------------------------------------------------------------------

const SHOP_ORDER = ["normal", "fire", "water", "grass", "electric", "ice"];

export type BackyardShopPopupProps = {
  save: GameSave;
  config: GameConfig;
  busy: boolean;
  shopOpen: boolean;
  shopTier: number;
  setShopTier: (tier: number) => void;
  shopSide: "left" | "right";
  onBuyEgg: (element: string, tier: number) => void;
  onUpgradeShop: () => void;
};

export function BackyardShopPopup({
  save,
  config,
  busy,
  shopOpen,
  shopTier,
  setShopTier,
  shopSide,
  onBuyEgg,
  onUpgradeShop,
}: BackyardShopPopupProps) {
  const { lang, T } = useT();
  const bk = T.bk.shop;
  const stopClick = (event: ReactMouseEvent) => event.stopPropagation();
  const shopLevel = save.shopLevel ?? 1;
  const maxTier = shopMaxLevel(config);
  const viewTier = Math.min(Math.max(1, shopTier), shopLevel);
  const upgradeCost = shopUpgradeCost(config, shopLevel);
  return (
    <div
      className={`by-shop-pop ${shopOpen ? "is-open" : ""}`}
      style={{ left: shopSide === "right" ? 1312 : 694, bottom: 164 }}
      onClick={stopClick}
    >
      <div className="by-shop-head">
        <button
          type="button"
          className="by-shop-arrow"
          disabled={viewTier <= 1}
          aria-label={bk.prevTier}
          onClick={(event) => {
            event.stopPropagation();
            setShopTier(Math.max(1, viewTier - 1));
          }}
        >
          ‹
        </button>
        <span className="by-shop-title">
          {fmt(bk.header, { tier: viewTier, page: viewTier, pages: shopLevel })}
        </span>
        <button
          type="button"
          className="by-shop-arrow"
          disabled={viewTier >= shopLevel}
          aria-label={bk.nextTier}
          onClick={(event) => {
            event.stopPropagation();
            setShopTier(Math.min(shopLevel, viewTier + 1));
          }}
        >
          ›
        </button>
      </div>
      <div className="by-shop-grid">
        {SHOP_ORDER.map((element) => {
          const price = eggPriceFor(config, element, viewTier);
          const elName = elementName(element, lang);
          const affordable = save.coins >= price;
          const previewSpecies = config.speciesByRecipe?.[element] ?? "guluduck";
          const pool = eggPoolCandidates(config, element, viewTier);
          const outcomes = pool
            .map(([code]) => speciesDisplayName(code, lang, config.species[code]?.nameZh, config.species[code]?.nameEn))
            .join(bk.outcomeJoiner);
          const title =
            viewTier <= 1
              ? fmt(bk.tooltipT1, { element: elName, outcomes })
              : fmt(bk.tooltipTier, { tier: viewTier, element: elName, outcomes });
          return (
            <button
              key={element}
              type="button"
              className="by-shop-card"
              disabled={busy || !affordable}
              title={title}
              onClick={(event) => {
                event.stopPropagation();
                onBuyEgg(element, viewTier);
              }}
            >
              <div className="by-shop-egg">
                <EggSvg species={previewSpecies} tier={viewTier} config={config} phase="idle" />
              </div>
              <span className="by-shop-name">
                {fmt(bk.eggName, { element: elName })}
                {viewTier > 1 ? fmt(bk.eggTierSuffix, { tier: viewTier }) : ""}
              </span>
              <span className={`by-shop-price ${affordable ? "" : "is-short"}`}>🪙 {formatCount(price)}</span>
            </button>
          );
        })}
      </div>
      {upgradeCost != null ? (
        <button
          type="button"
          className="by-shop-upgrade"
          disabled={busy || save.coins < upgradeCost}
          onClick={(event) => {
            event.stopPropagation();
            onUpgradeShop();
          }}
        >
          {fmt(bk.upgrade, { tier: shopLevel + 1, cost: formatCount(upgradeCost) })}
        </button>
      ) : (
        <div className="by-shop-note">{fmt(bk.maxed, { tier: maxTier })}</div>
      )}
    </div>
  );
}
