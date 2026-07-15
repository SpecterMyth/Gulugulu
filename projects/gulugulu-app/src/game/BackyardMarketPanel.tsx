import type { MouseEvent as ReactMouseEvent } from "react";
import type { GameConfig, PetInstance, SteamStatus } from "../types";
import { SvgSprite } from "../sprites/SvgSprite";

// ---------------------------------------------------------------------------
// 交易市场弹板（靠近显示）：持有伙伴 + 最贵五只的占位行情。
// 从 BackyardScene 抽出的纯展示块。
// ---------------------------------------------------------------------------

export type BackyardMarketPanelProps = {
  marketOpen: boolean;
  marketSide: "left" | "right";
  marketTop: PetInstance[];
  config: GameConfig;
  pendingMintIds: Set<string>;
  steamStatus: SteamStatus | null;
  fakeMarketPrice: (pet: PetInstance) => string;
  onSteamSync: () => void;
  onOpenMarket: () => void;
};

export function BackyardMarketPanel({
  marketOpen,
  marketSide,
  marketTop,
  config,
  pendingMintIds,
  steamStatus,
  fakeMarketPrice,
  onSteamSync,
  onOpenMarket,
}: BackyardMarketPanelProps) {
  const stopClick = (event: ReactMouseEvent) => event.stopPropagation();
  return (
    <div
      className={`by-poi-pop ${marketOpen ? "is-open" : ""}`}
      style={{ left: marketSide === "right" ? 5146 : 4514, bottom: 164 }}
      onClick={stopClick}
    >
      <div className="by-poi-title">💰 我的伙伴行情</div>
      {marketTop.length > 0 ? (
        <div className="by-market-rows">
          {marketTop.map((pet) => (
            <div key={pet.id} className="by-market-row">
              <div className="by-market-sprite">
                <SvgSprite species={pet.species} config={config} petState="idle" />
              </div>
              <span className="by-market-name">
                {config.species[pet.species]?.nameZh ?? pet.species} Lv{pet.level}
                {pet.steamItemId
                  ? ""
                  : pendingMintIds.has(pet.id)
                    ? " ⏳同步中"
                    : " 🏠本地"}
              </span>
              <span className="by-market-price">¥ {fakeMarketPrice(pet)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="by-poi-empty">还没有伙伴可以估价</div>
      )}
      <div className="by-poi-note">
        {steamStatus?.mode === "connected" ? (
          <>
            🟢 Steam 已连接
            {steamStatus.pendingMints > 0 && ` · ⏳待发放 ${steamStatus.pendingMints}`}
            {steamStatus.unclaimedImports > 0 && ` · 📦待认领 ${steamStatus.unclaimedImports}(扩建后院后同步领取)`}
          </>
        ) : steamStatus?.mode === "disabled" ? (
          <>🔧 Steam 集成已关闭(本地调试模式)——全部玩法走本地逻辑</>
        ) : (
          <>⚪ Steam 未连接——融合/二阶孵化/放生上链精灵暂不可用</>
        )}
      </div>
      {steamStatus?.mode === "connected" && (
        <button
          type="button"
          className="by-poi-cta"
          onClick={(event) => {
            event.stopPropagation();
            onSteamSync();
          }}
        >
          🔄 立即同步
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
        🛒 进入 Steam 市场
      </button>
    </div>
  );
}
