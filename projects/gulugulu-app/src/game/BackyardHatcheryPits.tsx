import type { GameConfig, GameSave, EggInstance } from "../types";
import { fmt, speciesDisplayName } from "../i18n";
import { useT } from "../useT";
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
  /** #2 点孵化中的蛋 → 孵化时间 −1s（催蛋）。 */
  onPokeEgg: (eggId: string) => void;
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
  onPokeEgg,
  onToast,
}: BackyardHatcheryPitsProps) {
  const { lang, T } = useT();
  const bk = T.bk.hatchery;
  // 本地先行融合的二阶蛋：未绑定 Steam 物品 + 有 applied Fuse op（后台正在烧材料 + 铸造结果并同步 Steam）。
  const syncingEggIds = new Set<string>();
  for (const op of save.steamOutbox ?? []) {
    if (op.kind === "fuse" && op.applied === true && op.eggId) {
      syncingEggIds.add(op.eggId);
    }
  }
  /** 物种显示名（zh 缺项兜底 "?"，与原文案一致）。 */
  const eggSpeciesName = (code: string): string => {
    const nameZh = config.species[code]?.nameZh;
    const nameEn = config.species[code]?.nameEn;
    return lang === "zh" ? nameZh ?? "?" : speciesDisplayName(code, lang, nameZh, nameEn);
  };
  // 教练锚点：后院里教练用 {kind:"egg"} 指向的那颗蛋（C5 收二号蛋 / C8 收首融蛋）。
  // 优先已可收取的；否则最靠前坑里的一颗。只标这一颗，避免 CoachFx 锚到错误的蛋。
  let coachEggId: string | null = null;
  for (let i = 0; i < slotCount; i += 1) {
    const pitEgg = save.eggs.find((item) => item.slot === i);
    if (!pitEgg) continue;
    if ((pitEgg.hatchAt ?? 0) - now <= 0) {
      coachEggId = pitEgg.id;
      break;
    }
    if (coachEggId == null) coachEggId = pitEgg.id;
  }
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
              title={isNext ? bk.unlockThisTitle : bk.unlockPrevTitle}
              onClick={(event) => {
                event.stopPropagation();
                if (!isNext || busy) return;
                if (!affordable) {
                  onToast(fmt(bk.needCoinsUnlock, { cost: formatCount(cost) }));
                  return;
                }
                onUpgradeHatchery();
              }}
            >
              <div className="by-pit-mound" />
              <div className="by-pit-hole" />
              <span className="by-pit-lock">🔒</span>
              <span className={`by-pill ${isNext ? "is-dark" : "is-dim"}`}>
                {isNext ? fmt(bk.unlockPill, { cost: formatCount(cost) }) : bk.lockedPill}
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
              title={canPlace ? bk.placeEggTitle : bk.emptyPitTitle}
              onClick={(event) => {
                event.stopPropagation();
                if (!canPlace) return;
                onPlaceEgg(inventoryEggs[0].id, slotIndex);
              }}
            >
              <div className="by-pit-mound" />
              <div className="by-pit-hole" />
              <span className={`by-pill ${canPlace ? "is-light" : "is-dim"}`}>
                {canPlace ? bk.placeEggPill : bk.emptyPill}
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
            ? fmt(bk.mysteryEggTitle, {
                provider: fusion.provider === "codex" ? "Codex" : fusion.provider ? "Claude" : "AI",
              })
            : fmt(bk.speciesEggTitle, { name: eggSpeciesName(egg.species) });
        return (
          <div
            key={`pit-${slotIndex}`}
            className={`by-pit ${ready && !busy ? "is-actionable" : ""}`}
            style={{ left: pitX, bottom: 106 }}
            role="button"
            data-coach={egg.id === coachEggId ? "egg" : undefined}
            title={ready ? bk.collectTitle : eggTitle}
            onClick={(event) => {
              event.stopPropagation();
              if (busy) return;
              if (ready) onCollectEgg(egg.id);
              else onPokeEgg(egg.id); // #2 点孵化中的蛋 → −1s 催蛋
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
                mystery={fusion != null && fusion.status !== "resolved"}
              />
            </div>
            {fusion && (
              <span
                className={`by-pit-fusion ${
                  fusion.status === "resolved" ? "is-resolved" : fusion.status === "failed" ? "is-failed" : ""
                }`}
              >
                {fusion.status === "resolved"
                  ? bk.designDone
                  : fusion.status === "failed"
                    ? bk.genFailed
                    : fusion.provider
                      ? fmt(bk.generating, { provider: fusion.provider === "codex" ? "Codex" : "Claude" })
                      : bk.queued}
              </span>
            )}
            {syncingEggIds.has(egg.id) && (
              <span className="by-pit-fusion" title={bk.syncingTitle}>
                {bk.syncing}
              </span>
            )}
            {ready ? (
              <span className="by-pill is-gold">{bk.collectPill}</span>
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
          title={freeSlot == null ? bk.noFreePitTitle : bk.placeToHatchTitle}
          onClick={(event) => {
            event.stopPropagation();
            if (freeSlot == null) {
              onToast(bk.pitsFull);
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
          {fmt(bk.waitingCount, { count: inventoryEggs.length })}
        </span>
      )}
    </>
  );
}
