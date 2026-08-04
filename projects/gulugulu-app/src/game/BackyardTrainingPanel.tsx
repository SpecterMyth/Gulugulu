import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import type { GameConfig, GameSave } from "../types";
import { fmt, speciesDisplayName } from "../i18n";
import { useT } from "../useT";
import { formatCount } from "./format";
import { formatCountdown } from "./useGame";
import {
  trainingHallMaxLevel,
  trainingHallUpgradeCost,
  isMaxLevel,
  trainingSlotCount,
  trainingSlotUpgradeCost,
  trainingStepFor,
  universalMaterial,
} from "./config";
import { emitPaperFx } from "../ui/PaperFx";
import { trainingMaterialIcon, trainingMaterialText } from "./trainingMaterialUi";

// ---------------------------------------------------------------------------
// 训练馆弹板（靠近显示）—— EconomyRework-TrainingHall.md §3。
//
// 经济 v2.0 的纵轴入口：融合封顶三阶后，4~6 阶只能在这里练出来。弹板本身只负责
// 「馆的状态 + 材料库存 + 训练位」，真正的选宠与确认走 TrainingModal（信息量装不进
// 这块小板）。与 BackyardMuseumPanel 同构：纯展示 + 回调，状态全在 BackyardScene。
// ---------------------------------------------------------------------------

export type BackyardTrainingPanelProps = {
  trainingOpen: boolean;
  trainingSide: "left" | "right";
  save: GameSave;
  config: GameConfig;
  /** 秒级时钟（弹板打开时才 tick），用于训练倒计时。 */
  now: number;
  onBuildHall: () => void;
  onUpgradeSlots: () => void;
  onCollect: (jobId: string) => void;
  onOpenModal: () => void;
};

export function BackyardTrainingPanel({
  trainingOpen,
  trainingSide,
  save,
  config,
  now,
  onBuildHall,
  onUpgradeSlots,
  onCollect,
  onOpenModal,
}: BackyardTrainingPanelProps) {
  const { lang, T } = useT();
  const bk = T.bk.training;
  const stopClick = (event: ReactMouseEvent) => event.stopPropagation();

  const hallLevel = save.trainingHallLevel ?? 0;
  const jobs = save.trainingJobs ?? [];
  const slotTotal = trainingSlotCount(config, save.trainingSlotLevel ?? 1);
  const hallCost = trainingHallUpgradeCost(config, hallLevel);
  const slotCost = trainingSlotUpgradeCost(config, save.trainingSlotLevel ?? 1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const prevHallLevelRef = useRef(hallLevel);
  const prevSlotLevelRef = useRef(save.trainingSlotLevel ?? 1);
  const prevJobsRef = useRef(new Map(jobs.map((job) => [job.id, job])));

  useEffect(() => {
    const previous = prevHallLevelRef.current;
    if (hallLevel > previous) {
      const built = previous === 0;
      const maxed = hallLevel >= trainingHallMaxLevel(config);
      emitPaperFx({
        preset: built ? "unlock" : "upgrade",
        intensity: built || maxed ? 3 : 2,
        anchor: rootRef.current,
        label: built
          ? T.sh.misc.trainingHallBuilt
          : maxed
            ? T.sh.misc.trainingHallMaxed
            : fmt(T.sh.misc.trainingHallLevel, { level: hallLevel }),
        dedupeKey: `training-hall:${hallLevel}`,
      });
    }
    prevHallLevelRef.current = hallLevel;
  }, [T.sh.misc.trainingHallBuilt, T.sh.misc.trainingHallLevel, T.sh.misc.trainingHallMaxed, config, hallLevel]);

  useEffect(() => {
    const slotLevel = save.trainingSlotLevel ?? 1;
    if (slotLevel > prevSlotLevelRef.current) {
      emitPaperFx({
        preset: "unlock",
        intensity: trainingSlotUpgradeCost(config, slotLevel) == null ? 3 : 2,
        anchor: rootRef.current,
        label: T.sh.misc.trainingSlotAdded,
        dedupeKey: `training-slots:${slotLevel}`,
      });
    }
    prevSlotLevelRef.current = slotLevel;
  }, [T.sh.misc.trainingSlotAdded, config, save.trainingSlotLevel]);

  useEffect(() => {
    const previous = prevJobsRef.current;
    const current = new Map(jobs.map((job) => [job.id, job]));
    if (jobs.length > previous.size) {
      emitPaperFx({
        preset: "training",
        intensity: 1,
        anchor: rootRef.current,
        dedupeKey: `training-start:${jobs.map((job) => job.id).join(":")}`,
      });
    }
    for (const [jobId] of previous) {
      if (!current.has(jobId)) {
        emitPaperFx({
          preset: "training",
          intensity: 3,
          anchor: rootRef.current,
          label: T.sh.misc.trainingComplete,
          dedupeKey: `training-complete:${jobId}`,
        });
      }
    }
    prevJobsRef.current = current;
  }, [T.sh.misc.trainingComplete, jobs]);
  // 材料条：五种升阶材料 + 万能券，按 config 顺序（= 阶梯顺序）展示，0 个也占位，
  // 让玩家一眼看出「卡在哪一档」。
  const materialIds = [...(config.trainingMaterials ?? []), universalMaterial(config)];
  const owned = save.materials ?? {};
  const tutorialBuild =
    save.trainingTutorialBoostClaimed !== true &&
    hallLevel === 0 &&
    save.pets.some((pet) => {
      if (pet.tier !== 1 || !isMaxLevel(config, pet)) return false;
      const step = trainingStepFor(config, 1);
      return step != null && (owned[step.material] ?? 0) >= step.count;
    });

  const petName = (petId: string) => {
    const pet = save.pets.find((p) => p.id === petId);
    if (!pet) return "?";
    const info = config.species[pet.species] ?? save.customSpecies?.[pet.species]?.info;
    return speciesDisplayName(pet.species, lang, info?.nameZh, info?.nameEn);
  };

  return (
    <div
      ref={rootRef}
      className={`by-poi-pop by-poi-pop--training ${trainingOpen ? "is-open" : ""}`}
      style={{ left: trainingSide === "right" ? -252 : -754, bottom: 68 }}
      onClick={stopClick}
    >
      {hallLevel === 0 && <div className="by-poi-title">{bk.title}</div>}

      {hallLevel === 0 ? (
        <>
          <div className="by-poi-empty">{bk.lockedHint}</div>
          <button
            type="button"
            className="by-poi-cta"
            data-coach="trainingBuild"
            disabled={hallCost == null || (save.coins < hallCost && !tutorialBuild)}
            onClick={(event) => {
              event.stopPropagation();
              onBuildHall();
            }}
          >
            {fmt(bk.buildBtn, { cost: formatCount(hallCost ?? 0) })}
          </button>
        </>
      ) : (
        <>
          <header className="by-train-head">
            <div className="by-train-heading">
              <div className="by-poi-title">
                {bk.title}
                <span className="by-train-level">Lv{hallLevel}</span>
              </div>
              <span className="by-train-note">
                {hallLevel >= trainingHallMaxLevel(config)
                  ? bk.hallMaxed
                  : fmt(bk.hallUnlocks, { tier: hallLevel + 1 })}
              </span>
            </div>
            <div className="by-train-upgrades">
              {hallCost != null ? (
                <button
                  type="button"
                  className="by-poi-cta is-mini"
                  disabled={save.coins < hallCost}
                  onClick={(event) => {
                    event.stopPropagation();
                    onBuildHall();
                  }}
                >
                  {fmt(bk.upgradeHallBtn, { cost: formatCount(hallCost) })}
                </button>
              ) : (
                <span className="by-train-upgrade-done">{bk.hallMaxed}</span>
              )}
              {slotCost != null ? (
                <button
                  type="button"
                  className="by-poi-cta is-mini"
                  disabled={save.coins < slotCost}
                  onClick={(event) => {
                    event.stopPropagation();
                    onUpgradeSlots();
                  }}
                >
                  {fmt(bk.expandSlotsBtn, { cost: formatCount(slotCost) })}
                </button>
              ) : (
                <span className="by-train-upgrade-done">{bk.slotsMaxed}</span>
              )}
            </div>
          </header>

          <section className="by-train-section">
            <div className="by-train-sub">{bk.materialsTitle}</div>
            <div className="by-train-materials">
              {materialIds.map((id) => {
                const localizedName = bk.materialNames[id] ?? id;
                const count = owned[id] ?? 0;
                return (
                  <div
                    key={id}
                    className={`by-train-mat${count > 0 ? "" : " is-empty"}`}
                    title={`${trainingMaterialText(localizedName)} × ${count}`}
                    aria-label={`${trainingMaterialText(localizedName)} × ${count}`}
                  >
                    <span className="by-train-mat-icon" aria-hidden="true">
                      {trainingMaterialIcon(id)}
                    </span>
                    <b className="by-train-mat-count">{formatCount(count)}</b>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="by-train-section">
            <div className="by-train-sub">
              {fmt(bk.slots, { used: jobs.length, total: slotTotal })}
            </div>
            <div className="by-train-slots">
              {Array.from({ length: slotTotal }, (_, slot) => {
                const job = jobs.find((j) => j.slot === slot);
                if (!job) {
                  return (
                    <div key={slot} className="by-train-slot is-idle">
                      {bk.idleSlot}
                    </div>
                  );
                }
                const remain = job.doneAt - now;
                return (
                  <div key={slot} className="by-train-slot">
                    <span className="by-train-slot-name">
                      {fmt(bk.training, {
                        name: petName(job.petId),
                        from: job.fromTier,
                        to: job.fromTier + 1,
                      })}
                    </span>
                    {remain > 0 ? (
                      <span className="by-pill is-light">
                        {fmt(bk.remaining, { time: formatCountdown(remain) })}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="by-poi-cta is-mini"
                        data-coach="trainingCollect"
                        onClick={(event) => {
                          event.stopPropagation();
                          onCollect(job.id);
                        }}
                      >
                        {bk.collectBtn}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <button
            type="button"
            className="by-poi-cta by-train-start"
            data-coach="trainingStart"
            onClick={(event) => {
              event.stopPropagation();
              onOpenModal();
            }}
          >
            {bk.openBtn}
          </button>
        </>
      )}
    </div>
  );
}
