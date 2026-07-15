import type { MouseEvent as ReactMouseEvent } from "react";
import type { GameConfig, GameSave } from "../types";
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
          aria-label="低阶蛋"
          onClick={(event) => {
            event.stopPropagation();
            setShopTier(Math.max(1, viewTier - 1));
          }}
        >
          ‹
        </button>
        <span className="by-shop-title">
          {viewTier} 阶蛋 · 页 {viewTier}/{shopLevel}
        </span>
        <button
          type="button"
          className="by-shop-arrow"
          disabled={viewTier >= shopLevel}
          aria-label="高阶蛋"
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
          const info = config.elements[element];
          const affordable = save.coins >= price;
          const previewSpecies = config.speciesByRecipe?.[element] ?? "guluduck";
          const pool = eggPoolCandidates(config, save, element, viewTier);
          const outcomes = pool
            .map(([code]) => config.species[code]?.nameZh ?? save.customSpecies?.[code]?.info.nameZh ?? code)
            .join("、");
          const title =
            viewTier <= 1
              ? `${info?.nameZh}蛋 → ${outcomes}`
              : `${viewTier} 阶${info?.nameZh}蛋 · 可能产出：${outcomes}（含元素越多越稀有）`;
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
                {info?.nameZh}蛋{viewTier > 1 ? ` ·${viewTier}阶` : ""}
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
          升级商店 → 解锁 {shopLevel + 1} 阶蛋（{formatCount(upgradeCost)} 🪙）
        </button>
      ) : (
        <div className="by-shop-note">商店已满级 · {maxTier} 阶蛋封顶（5~6 阶融合专属）</div>
      )}
    </div>
  );
}
