import type { MouseEvent as ReactMouseEvent } from "react";
import type { GameConfig, PetInstance, SteamStatus } from "../types";
import { fmt, speciesDisplayName } from "../i18n";
import { useT } from "../useT";
import { SvgSprite } from "../sprites/SvgSprite";

// ---------------------------------------------------------------------------
// 交易市场弹板（靠近显示）：左侧行情列表（可滚动，容纳更多伙伴）+ 右侧按钮栏。
// 行情价优先取 Steam 社区市场真实挂单价，查不到则显示「价格未知」。
// 从 BackyardScene 抽出的纯展示块。
// ---------------------------------------------------------------------------

export type BackyardMarketPanelProps = {
  marketOpen: boolean;
  marketSide: "left" | "right";
  marketTop: PetInstance[];
  config: GameConfig;
  pendingMintIds: Set<string>;
  steamStatus: SteamStatus | null;
  /** Steam 社区市场真实挂单价（已含币种符号）；无挂单/未同步 Steam → null（显示「价格未知」）。 */
  realMarketPrice: (pet: PetInstance) => string | null;
  onSteamSync: () => void;
  /** 导入我的宠物：读整份 Steam 库存填后院空位（高阶优先）。 */
  onImportPets: () => void;
  onOpenMarket: () => void;
};

export function BackyardMarketPanel({
  marketOpen,
  marketSide,
  marketTop,
  config,
  pendingMintIds,
  steamStatus,
  realMarketPrice,
  onSteamSync,
  onImportPets,
  onOpenMarket,
}: BackyardMarketPanelProps) {
  const { lang, T } = useT();
  const bk = T.bk.market;
  const stopClick = (event: ReactMouseEvent) => event.stopPropagation();
  const connected = steamStatus?.mode === "connected";
  return (
    <div
      className={`by-poi-pop by-poi-pop--market ${marketOpen ? "is-open" : ""}`}
      style={{ left: marketSide === "right" ? 4186 : 3394, bottom: 164 }}
      onClick={stopClick}
    >
      <div className="by-poi-title">{bk.header}</div>
      <div className="by-market-body">
        {/* 左栏：行情列表（可滚动，安全区内展示更多伙伴） */}
        <div className="by-market-list">
          {marketTop.length > 0 ? (
            marketTop.map((pet) => (
              <div key={pet.id} className="by-market-row">
                <div className="by-market-sprite">
                  <SvgSprite species={pet.species} config={config} petState="idle" />
                </div>
                <span className="by-market-name">
                  {speciesDisplayName(pet.species, lang, config.species[pet.species]?.nameZh, config.species[pet.species]?.nameEn)} Lv{pet.level}
                  {pet.steamItemId
                    ? ""
                    : pendingMintIds.has(pet.id)
                      ? bk.syncingBadge
                      : bk.localBadge}
                </span>
                {(() => {
                  const real = realMarketPrice(pet);
                  return real ? (
                    <span className="by-market-price" title={bk.priceReal}>
                      {real}
                    </span>
                  ) : (
                    <span className="by-market-price is-unknown" title={bk.priceUnknown}>
                      {bk.priceUnknown}
                    </span>
                  );
                })()}
              </div>
            ))
          ) : (
            <div className="by-poi-empty">{bk.empty}</div>
          )}
        </div>

        {/* 右栏：连接状态 + 操作按钮 */}
        <div className="by-market-side">
          <div className="by-poi-note">
            {connected ? (
              <>
                {bk.connected}
                {steamStatus!.pendingMints > 0 && fmt(bk.pendingMints, { count: steamStatus!.pendingMints })}
                {(steamStatus!.pendingReleases ?? 0) > 0 &&
                  fmt(bk.pendingReleases, { count: steamStatus!.pendingReleases ?? 0 })}
                {steamStatus!.unclaimedImports > 0 && fmt(bk.unclaimed, { count: steamStatus!.unclaimedImports })}
                {steamStatus!.cloudEnabled ? bk.cloudOn : bk.cloudOff}
              </>
            ) : steamStatus?.mode === "disabled" ? (
              <>{bk.disabled}</>
            ) : (
              <>{bk.offline}</>
            )}
          </div>

          {connected && steamStatus!.workshopLegalPending && (
            <>
              <div className="by-poi-note">{bk.workshopLegal}</div>
              <button
                type="button"
                className="by-poi-cta"
                onClick={(event) => {
                  event.stopPropagation();
                  window.open(
                    "https://steamcommunity.com/sharedfiles/workshoplegalagreement",
                    "_blank",
                    "noopener",
                  );
                }}
              >
                {bk.workshopBtn}
              </button>
            </>
          )}

          {connected && (
            <button
              type="button"
              className="by-poi-cta"
              onClick={(event) => {
                event.stopPropagation();
                onImportPets();
              }}
            >
              {bk.importBtn}
            </button>
          )}

          {connected && (
            <button
              type="button"
              className="by-poi-cta"
              onClick={(event) => {
                event.stopPropagation();
                onSteamSync();
              }}
            >
              {bk.syncBtn}
            </button>
          )}

          <button
            type="button"
            className="by-poi-cta"
            onClick={(event) => {
              event.stopPropagation();
              onOpenMarket();
            }}
          >
            {bk.openBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
