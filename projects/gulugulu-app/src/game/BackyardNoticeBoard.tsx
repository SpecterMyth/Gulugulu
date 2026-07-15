import type { MouseEvent as ReactMouseEvent } from "react";
import type { GameConfig, GameSave } from "../types";
import { abs } from "./backyardShared";
import { formatCount } from "./format";
import { DailyLoveMeter } from "./EnergyBar";
import { FIXED_DEX_TOTAL, type PokedexModel } from "./pokedexData";

// ---------------------------------------------------------------------------
// 公告板：全局统计（Token / Agent 连接为主区，下方今日流水与图鉴）。
// 从 BackyardScene 抽出的纯展示块。
// ---------------------------------------------------------------------------

export type BackyardNoticeBoardProps = {
  projectTokens: number;
  statusText: string;
  save: GameSave;
  config: GameConfig;
  pokedexModel: PokedexModel;
};

export function BackyardNoticeBoard({
  projectTokens,
  statusText,
  save,
  config,
  pokedexModel,
}: BackyardNoticeBoardProps) {
  const stopClick = (event: ReactMouseEvent) => event.stopPropagation();
  return (
    <div
      style={abs({ left: 2308, bottom: 236, width: 274, height: 158, borderRadius: 12, border: "4px solid #6B4520", background: "linear-gradient(180deg,#B07B44,#96622F)", boxShadow: "0 12px 22px rgba(43,26,8,0.35)", boxSizing: "border-box", cursor: "default" })}
      onClick={stopClick}
    >
      <div className="by-board-inner">
        <div className="by-board-main">
          <span className="by-board-token">🍙 {formatCount(projectTokens)}</span>
          <span className="by-board-token-label">累计 Token</span>
          <span className="by-board-status">📡 {statusText}</span>
        </div>
        {/* 今日互动状态：爱心额度 + 满格一瞥（从左下常驻 HUD 迁入公告板，§6.2/§6.6） */}
        <div className="by-board-love-row">
          <span className="by-board-love" title="今日还能给的爱（点击额度）">
            <span className="by-board-love-label">今日的爱</span>
            <DailyLoveMeter clicks={save.daily.clicks} cap={config.dailyClickCap} showCount />
          </span>
        </div>
        <div className="by-board-grid">
          <span>🍙 Token→⚡精力</span>
          <span>🍀 零食 +{save.daily.snackStamina}⚡</span>
          <span>
            📖 图鉴 {pokedexModel.fixedCollected}/{FIXED_DEX_TOTAL}
          </span>
        </div>
      </div>
      <span style={abs({ left: 14, top: 12, width: 8, height: 8, borderRadius: "50%", background: "#D9553F", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" })} />
      <span style={abs({ right: 14, top: 12, width: 8, height: 8, borderRadius: "50%", background: "#D9553F", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" })} />
    </div>
  );
}
