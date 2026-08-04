import type { GameConfig, GameSave } from "../types";
import { fmt } from "../i18n";
import { useT } from "../useT";
import { SvgSprite } from "../sprites/SvgSprite";
import { abs } from "./backyardShared";
import { formatCountdown } from "./useGame";
import { trainingSlotCount } from "./config";

// ---------------------------------------------------------------------------
// 训练草位（世界锚定，训练馆门前）：把训练槽真的画在地图上——空位是一块草垫，
// 占用时把受训宠站上去做 `laboring` 训练动作 + 头顶倒计时，练完变金色「出师」可点收。
// 与 BackyardHatcheryPits 同构（存档驱动的纯展示块），渲染在近景层内随相机平移。
// ---------------------------------------------------------------------------

/** 训练草位世界 x（训练馆立面 -552..-288 门前一排，末位挪到举重台旁）。 */
const SLOT_XS = [-515, -430, -345, -252];
/** 草位/受训宠脚底所在的草皮线（与地面驻留点一致）。 */
const GROUND_BOTTOM = 142;
const PET_SIZE = 74;

export type BackyardTrainingGroundProps = {
  save: GameSave;
  config: GameConfig;
  now: number;
  /** 陪伴宠（主角）单独渲染在别处，训练时不在此重复画，避免同宠出现两次。 */
  activePetId: string | null;
  onCollect: (jobId: string) => void;
  /** 物种显示名（复用 BackyardScene 的 resolver，zh 缺项兜底）。 */
  speciesName: (species: string, fallback?: string) => string;
};

export function BackyardTrainingGround({
  save,
  config,
  now,
  activePetId,
  onCollect,
  speciesName,
}: BackyardTrainingGroundProps) {
  const { T } = useT();
  const bk = T.bk.training;
  // 未建训练馆：门前空地不摆草位（建筑虽是常驻布景，草位跟着「已开张」才出现）。
  if ((save.trainingHallLevel ?? 0) === 0) return null;

  const slotTotal = Math.min(trainingSlotCount(config, save.trainingSlotLevel ?? 1), SLOT_XS.length);
  const jobs = save.trainingJobs ?? [];

  return (
    <>
      {Array.from({ length: slotTotal }, (_, slot) => {
        const x = SLOT_XS[slot];
        const job = jobs.find((j) => j.slot === slot);
        return (
          <div key={`train-slot-${slot}`}>
            {/* 草垫：空位也画，让「训练场」一直可见 */}
            <div
              className="by-train-mat-ground"
              style={abs({ left: x - 34, bottom: GROUND_BOTTOM - 6, width: 68, height: 16 })}
            />
            {job && job.petId !== activePetId && renderTrainee(job, x)}
          </div>
        );
      })}
    </>
  );

  function renderTrainee(
    job: { id: string; petId: string; fromTier: number; doneAt: number },
    x: number,
  ) {
    const pet = save.pets.find((p) => p.id === job.petId);
    if (!pet) return null; // 训练中被放生/融合消耗：草位空着，收取时后端会静默丢弃
    const remain = job.doneAt - now;
    const done = remain <= 0;
    return (
      <div
        className={`by-train-pet ${done ? "is-done" : ""}`}
        style={{ left: x - PET_SIZE / 2, bottom: GROUND_BOTTOM, width: PET_SIZE, height: PET_SIZE }}
        role={done ? "button" : undefined}
        title={done ? bk.collectBtn : fmt(bk.training, { name: speciesName(pet.species, pet.species), from: job.fromTier, to: job.fromTier + 1 })}
        onClick={(event) => {
          event.stopPropagation();
          if (done) onCollect(job.id);
        }}
      >
        <span className="by-train-pet-tag">
          <span className="by-train-pet-arrow">
            {"★".repeat(job.fromTier)}
            <span className="by-train-pet-to">→ {"★".repeat(job.fromTier + 1)}</span>
          </span>
          <span className="by-train-pet-name">{speciesName(pet.species, pet.species)}</span>
        </span>
        {/* 训练动作：复用打工 laboring 律动（挥臂发力），配训练馆语境即「锻炼」 */}
        <div className="by-train-pet-body">
          <SvgSprite species={pet.species} config={config} petState="laboring" tier={pet.tier} />
        </div>
        {/* 汗珠：强化「在使劲」的观感（纯装饰，reduced-motion 下 CSS 收敛） */}
        {!done && <span className="by-train-sweat" aria-hidden="true" />}
        {done ? (
          <span className="by-pill is-gold by-train-pet-pill">{bk.collectBtn}</span>
        ) : (
          <span className="by-pill is-light by-train-pet-pill">⏳ {formatCountdown(remain)}</span>
        )}
      </div>
    );
  }
}
