import type { GameConfig, GameSave, EggInstance } from "../types";
import { EggSvg } from "../sprites/SvgSprite";
import { abs } from "./backyardShared";
import { eggHatchInfo } from "./config";
import { formatCount } from "./format";
import { formatCountdown } from "./useGame";

// ---------------------------------------------------------------------------
// 孵化区：蛋坑（真实存档驱动）+ 栅栏边的待孵化蛋。
// 纯展示块，从 BackyardScene 抽出；接收其原本闭包引用的派生值与回调。
// ---------------------------------------------------------------------------

/** 孵化区三个蛋坑的世界 x（设计稿坐标） */
const PIT_XS = [120, 220, 320];

export type BackyardHatcheryPitsProps = {
  maxSlots: number;
  slotCount: number;
  save: GameSave;
  config: GameConfig;
  busy: boolean;
  now: number;
  inventoryEggs: EggInstance[];
  freeSlot: number | null;
  onUpgradeHatchery: () => void;
  onPlaceEgg: (eggId: string, slot: number) => void;
  onCollectEgg: (eggId: string) => void;
  onToast: (message: string) => void;
};

export function BackyardHatcheryPits({
  maxSlots,
  slotCount,
  save,
  config,
  busy,
  now,
  inventoryEggs,
  freeSlot,
  onUpgradeHatchery,
  onPlaceEgg,
  onCollectEgg,
  onToast,
}: BackyardHatcheryPitsProps) {
  return (
    <>
      {/* ── 孵化区：蛋坑（真实存档驱动） ── */}
      {Array.from({ length: maxSlots }, (_, slotIndex) => {
        const pitX = PIT_XS[slotIndex] ?? 120 + slotIndex * 100;
        if (slotIndex >= slotCount) {
          // 锁定坑：下一坑可点击解锁（= 升级孵化屋）
          const isNext = slotIndex === slotCount;
          const cost = config.hatcheryUpgradeCosts[slotIndex - 1];
          const affordable = cost != null && save.coins >= cost;
          return (
            <div
              key={`pit-${slotIndex}`}
              className={`by-pit is-locked ${isNext && affordable && !busy ? "is-actionable" : ""}`}
              style={{ left: pitX, bottom: 106 }}
              role="button"
              title={isNext ? "解锁这个蛋坑" : "先解锁前一个蛋坑"}
              onClick={(event) => {
                event.stopPropagation();
                if (!isNext || busy) return;
                if (!affordable) {
                  onToast(`金币不足，解锁需要 ${formatCount(cost)} 🪙`);
                  return;
                }
                onUpgradeHatchery();
              }}
            >
              <div className="by-pit-mound" />
              <div className="by-pit-hole" />
              <span className="by-pit-lock">🔒</span>
              <span className={`by-pill ${isNext ? "is-dark" : "is-dim"}`}>
                {isNext ? `解锁 ${formatCount(cost)} 🪙` : "待解锁"}
              </span>
            </div>
          );
        }

        const egg = save.eggs.find((item) => item.slot === slotIndex) ?? null;
        if (!egg) {
          const canPlace = inventoryEggs.length > 0 && !busy;
          return (
            <div
              key={`pit-${slotIndex}`}
              className={`by-pit ${canPlace ? "is-actionable" : ""}`}
              style={{ left: pitX, bottom: 106 }}
              role="button"
              title={canPlace ? "放入一颗待孵化的蛋" : "空蛋坑"}
              onClick={(event) => {
                event.stopPropagation();
                if (!canPlace) return;
                onPlaceEgg(inventoryEggs[0].id, slotIndex);
              }}
            >
              <div className="by-pit-mound" />
              <div className="by-pit-hole" />
              <span className={`by-pill ${canPlace ? "is-light" : "is-dim"}`}>
                {canPlace ? "🥚 放蛋孵化" : "空位"}
              </span>
            </div>
          );
        }

        const remain = (egg.hatchAt ?? 0) - now;
        const ready = remain <= 0;
        const { progress } = eggHatchInfo(config, egg, now);
        const fusion = egg.pendingFusion ?? null;
        const eggTitle =
          fusion && fusion.status !== "resolved"
            ? "神秘融合蛋：AI 正在设计新物种"
            : `${config.species[egg.species]?.nameZh ?? "?"}的蛋`;
        return (
          <div
            key={`pit-${slotIndex}`}
            className={`by-pit ${ready && !busy ? "is-actionable" : ""}`}
            style={{ left: pitX, bottom: 106 }}
            role="button"
            title={ready ? "点击收取" : eggTitle}
            onClick={(event) => {
              event.stopPropagation();
              if (ready && !busy) onCollectEgg(egg.id);
            }}
          >
            {ready && <div className="by-pit-glow" />}
            <div className="by-pit-mound" />
            <div className="by-pit-hole" />
            <div className="by-pit-egg">
              <EggSvg
                species={egg.species}
                tier={egg.tier}
                config={config}
                phase={ready ? "ready" : "incubating"}
                progress={progress}
                secondsLeft={Math.max(0, remain)}
              />
            </div>
            {fusion && (
              <span
                className={`by-pit-fusion ${
                  fusion.status === "resolved" ? "is-resolved" : fusion.status === "failed" ? "is-failed" : ""
                }`}
              >
                {fusion.status === "resolved"
                  ? "✨ 设计完成"
                  : fusion.status === "failed"
                    ? "💤 生成未完成"
                    : "🤖 AI 设计中…"}
              </span>
            )}
            {ready ? (
              <span className="by-pill is-gold">✨ 点击收取</span>
            ) : (
              <span className="by-pill is-light">⏳ {formatCountdown(remain)}</span>
            )}
          </div>
        );
      })}

      {/* 栅栏边的待孵化蛋 */}
      {inventoryEggs.slice(0, 3).map((egg, index) => (
        <button
          key={egg.id}
          type="button"
          className="by-egg-inv"
          style={{ left: 16 + index * 30, bottom: 148 }}
          disabled={busy}
          title={freeSlot == null ? "没有空蛋坑" : "放入蛋坑孵化"}
          onClick={(event) => {
            event.stopPropagation();
            if (freeSlot == null) {
              onToast("蛋坑都满了，先收取或解锁新坑");
              return;
            }
            onPlaceEgg(egg.id, freeSlot);
          }}
        >
          <EggSvg species={egg.species} tier={egg.tier} config={config} phase="idle" />
        </button>
      ))}
      {inventoryEggs.length > 3 && (
        <span className="by-pill is-dark" style={abs({ left: 16, bottom: 190 })}>
          待孵化 ×{inventoryEggs.length}
        </span>
      )}
    </>
  );
}
