import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import type { GameConfig, GameSave } from "../types";
import { elementName, fmt, speciesDisplayName } from "../i18n";
import { useT } from "../useT";
import { EggSvg } from "../sprites/SvgSprite";
import { eggPoolCandidates, eggPriceFor, shopMaxLevel, shopUpgradeCost } from "./config";
import { formatCount } from "./format";
import { emitPaperFx } from "../ui/PaperFx";

// ---------------------------------------------------------------------------
// 商店弹出商品板（分阶蛋 · 默认最高阶 · 左右翻页 · 2×3 两行）。
// 从 BackyardScene 抽出的纯展示块；接收其原本闭包引用的值与回调。
// ---------------------------------------------------------------------------

const SHOP_ORDER = ["normal", "fire", "water", "grass", "electric", "ice"];
const GUIDED_FIRE_PURCHASE_STEPS = new Set([
  "A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10", "A11", "A12",
]);

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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pendingBuyRef = useRef<{ anchor: HTMLElement; eggCount: number; timer: number } | null>(null);
  const prevShopLevelRef = useRef(shopLevel);

  useEffect(() => {
    const previous = prevShopLevelRef.current;
    if (shopLevel > previous) {
      emitPaperFx({
        preset: "upgrade",
        intensity: shopLevel >= maxTier ? 3 : 2,
        anchor: rootRef.current,
        label:
          shopLevel >= maxTier
            ? T.sh.misc.shopMaxed
            : fmt(T.sh.misc.shopUpgradedTier, { tier: shopLevel }),
        dedupeKey: `shop-level:${shopLevel}`,
      });
    }
    prevShopLevelRef.current = shopLevel;
  }, [T.sh.misc.shopMaxed, T.sh.misc.shopUpgradedTier, maxTier, shopLevel]);

  useEffect(() => {
    const pending = pendingBuyRef.current;
    if (!pending || save.eggs.length <= pending.eggCount) return;
    window.clearTimeout(pending.timer);
    emitPaperFx({
      preset: "purchase",
      intensity: 1,
      anchor: pending.anchor,
      dedupeKey: `egg-purchase:${save.eggs.length}`,
    });
    pendingBuyRef.current = null;
  }, [save.eggs.length]);

  useEffect(
    () => () => {
      if (pendingBuyRef.current) window.clearTimeout(pendingBuyRef.current.timer);
    },
    [],
  );
  return (
    <div
      ref={rootRef}
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
          const tutorialFire =
            element === "fire" &&
            viewTier === 1 &&
            save.onboarding?.status === "active" &&
            save.onboarding.step === "A12";
          // Before the guided Fire Egg receipt lands, every other purchase can
          // occupy the newly unlocked pit and strand A13 with no valid target.
          // Keep the shop visible for orientation, but make the highlighted
          // purchase the only mutation that can leave this screen.
          const tutorialPurchaseLocked =
            save.onboarding?.status === "active" &&
            GUIDED_FIRE_PURCHASE_STEPS.has(save.onboarding.step) &&
            !tutorialFire;
          const unaffordable = !affordable && !tutorialFire;
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
              className={`by-shop-card${unaffordable ? " is-unaffordable" : ""}`}
              data-coach={element === "fire" && viewTier === 1 ? "shopFire" : undefined}
              disabled={busy || unaffordable || tutorialPurchaseLocked}
              title={title}
              onClick={(event) => {
                event.stopPropagation();
                if (pendingBuyRef.current) window.clearTimeout(pendingBuyRef.current.timer);
                const anchor = event.currentTarget;
                const timer = window.setTimeout(() => {
                  if (pendingBuyRef.current?.anchor === anchor) pendingBuyRef.current = null;
                }, 5000);
                pendingBuyRef.current = { anchor, eggCount: save.eggs.length, timer };
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
              <span className="by-shop-price">
                🪙 <span className={unaffordable ? "is-short" : undefined}>{formatCount(price)}</span>
              </span>
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
