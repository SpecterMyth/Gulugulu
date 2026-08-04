import { useEffect, useRef } from "react";
import type { GameConfig, GameSave, EggInstance } from "../types";
import { fmt, speciesDisplayName } from "../i18n";
import { useT } from "../useT";
import { EggSvg } from "../sprites/SvgSprite";
import { abs } from "./backyardShared";
import { eggHatchInfo } from "./config";
import { formatCount } from "./format";
import { formatCountdown } from "./useGame";
import { emitPaperFx } from "../ui/PaperFx";

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
  const pitRefs = useRef(new Map<number, HTMLDivElement>());
  const prevSlotCountRef = useRef(slotCount);
  const prevEggSlotsRef = useRef(new Map(save.eggs.map((egg) => [egg.id, egg.slot])));

  useEffect(() => {
    const previous = prevSlotCountRef.current;
    if (slotCount > previous) {
      const unlockedSlot = slotCount - 1;
      emitPaperFx({
        preset: "unlock",
        intensity: slotCount >= maxSlots ? 3 : 2,
        anchor: pitRefs.current.get(unlockedSlot),
        label: T.sh.misc.hatchPitUnlocked,
        dedupeKey: `hatchery-slot:${slotCount}`,
      });
    }
    prevSlotCountRef.current = slotCount;
  }, [T.sh.misc.hatchPitUnlocked, maxSlots, slotCount]);

  useEffect(() => {
    const previous = prevEggSlotsRef.current;
    for (const egg of save.eggs) {
      const priorSlot = previous.get(egg.id);
      if (egg.slot != null && priorSlot == null && previous.has(egg.id)) {
        emitPaperFx({
          preset: "place",
          intensity: 1,
          anchor: pitRefs.current.get(egg.slot),
          seed: egg.id.length * 2654435761,
          dedupeKey: `place-egg:${egg.id}:${egg.slot}`,
        });
      }
    }
    prevEggSlotsRef.current = new Map(save.eggs.map((egg) => [egg.id, egg.slot]));
  }, [save.eggs]);
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
    return lang.startsWith("zh") ? nameZh ?? "?" : speciesDisplayName(code, lang, nameZh, nameEn);
  };
  // 教练锚点：后院里教练用 {kind:"egg"} 指向当前流程要求收取的那颗蛋。
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
  const tutorialFirePlacement =
    save.onboarding?.status === "active" && save.onboarding.step === "A13";
  const guidedInventoryEgg = tutorialFirePlacement
    ? inventoryEggs.find((egg) => egg.shopElement === "fire") ?? inventoryEggs[0]
    : inventoryEggs[0];
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
          const tutorialUnlock =
            isNext &&
            save.onboarding?.status === "active" &&
            (save.onboarding.step === "A10" ||
              (save.onboarding.step === "A13" &&
                freeSlot == null &&
                inventoryEggs.some((egg) => egg.shopElement === "fire")));
          const canUnlock = affordable || tutorialUnlock;
          return (
            <div
              key={`pit-${slotIndex}`}
              ref={(node) => {
                if (node) pitRefs.current.set(slotIndex, node);
                else pitRefs.current.delete(slotIndex);
              }}
              className={`by-pit is-locked ${isNext && canUnlock && !busy ? "is-actionable" : ""}`}
              data-coach={isNext ? "hatcheryUpgrade" : undefined}
              style={{ left: pitX, bottom: 106 }}
              role="button"
              title={isNext ? bk.unlockThisTitle : bk.unlockPrevTitle}
              onClick={(event) => {
                event.stopPropagation();
                if (!isNext || busy) return;
                if (!canUnlock) {
                  emitPaperFx({
                    preset: "failure",
                    intensity: 1,
                    anchor: event.currentTarget,
                    dedupeKey: `hatchery-short:${slotIndex}`,
                  });
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
          const canPlace = guidedInventoryEgg != null && !busy;
          return (
            <div
              key={`pit-${slotIndex}`}
              ref={(node) => {
                if (node) pitRefs.current.set(slotIndex, node);
                else pitRefs.current.delete(slotIndex);
              }}
              className={`by-pit ${canPlace ? "is-actionable" : ""}`}
              data-coach={canPlace ? "emptyPit" : undefined}
              style={{ left: pitX, bottom: 106 }}
              role="button"
              title={canPlace ? bk.placeEggTitle : bk.emptyPitTitle}
              onClick={(event) => {
                event.stopPropagation();
                if (!canPlace || !guidedInventoryEgg) return;
                onPlaceEgg(guidedInventoryEgg.id, slotIndex);
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
        const waitingForSteam = syncingEggIds.has(egg.id);
        const providerName =
          fusion?.provider === "codex" ? "Codex" : fusion?.provider ? "Claude" : null;
        const designStatus = fusion
          ? fusion.status === "resolved"
            ? bk.designDone
            : fusion.status === "failed"
              ? bk.genFailed
              : fusion.status === "generating" && providerName
                ? fmt(bk.generating, { provider: providerName })
                : providerName
                  ? fmt(bk.queuedProvider, { provider: providerName })
                  : bk.queued
          : null;
        const eggTitle =
          fusion && fusion.status !== "resolved"
            ? fmt(bk.mysteryEggTitle, {
                provider: fusion.provider === "codex" ? "Codex" : fusion.provider ? "Claude" : "AI",
              })
            : fmt(bk.speciesEggTitle, { name: eggSpeciesName(egg.species) });
        return (
          <div
            key={`pit-${slotIndex}`}
            ref={(node) => {
              if (node) pitRefs.current.set(slotIndex, node);
              else pitRefs.current.delete(slotIndex);
            }}
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
                className={`by-pit-fusion is-ai ${
                  fusion.status === "resolved" ? "is-resolved" : fusion.status === "failed" ? "is-failed" : ""
                }`}
              >
                {designStatus}
              </span>
            )}
            {waitingForSteam && (
              <span
                className={`by-pit-fusion is-steam ${fusion ? "is-row2" : ""}`}
                title={bk.syncingTitle}
              >
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
          disabled={busy || (tutorialFirePlacement && egg.shopElement !== "fire")}
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
