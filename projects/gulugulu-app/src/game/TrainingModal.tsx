import { useMemo, useState } from "react";
import type { GameConfig, GameSave, PetInstance } from "../types";
import { fmt, localizeGameMessage, speciesDisplayName } from "../i18n";
import { useT } from "../useT";
import { SvgSprite } from "../sprites/SvgSprite";
import { formatCount } from "./format";
import { formatCountdown } from "./useGame";
import { isMaxLevel, trainingSlotCount, trainingStepFor, universalMaterial } from "./config";

// ---------------------------------------------------------------------------
// 训练弹窗：选一只伙伴升阶（EconomyRework-TrainingHall.md §3）。
//
// 训练与融合是一对明确的取舍，UI 必须把它说清楚：
//   融合 = 我要新东西（换物种，吃掉两只）
//   训练 = 我要这一只更强（保物种、保等级，吃材料）
// 复用 FusionModal 的 .welcome-overlay/.welcome-card 视觉体系。
// ---------------------------------------------------------------------------

/** 一只伙伴在训练馆里的可用性（不可用时给出确切原因，不做静默置灰）。 */
type Candidate = {
  pet: PetInstance;
  step: ReturnType<typeof trainingStepFor>;
  /** null = 可以练；否则是拦下它的原因文案。 */
  blocked: string | null;
  /** 主材料缺口（用万能券补的张数）。 */
  shortfall: number;
};

export function TrainingModal({
  save,
  config,
  busy,
  error,
  onClose,
  onStart,
}: {
  save: GameSave;
  config: GameConfig;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onStart: (petId: string, useUniversal: boolean) => void;
}) {
  const { lang, T } = useT();
  const bk = T.bk.training;
  const [selected, setSelected] = useState<string | null>(null);
  const [useUniversal, setUseUniversal] = useState(false);

  const hallLevel = save.trainingHallLevel ?? 0;
  const jobs = save.trainingJobs ?? [];
  const slotsFull = jobs.length >= trainingSlotCount(config, save.trainingSlotLevel ?? 1);
  const universalId = universalMaterial(config);
  const universalHave = save.materials?.[universalId] ?? 0;

  const nameOf = (pet: PetInstance) => {
    const info = config.species[pet.species] ?? save.customSpecies?.[pet.species]?.info;
    return speciesDisplayName(pet.species, lang, info?.nameZh, info?.nameEn);
  };

  const candidates: Candidate[] = useMemo(
    () =>
      save.pets.map((pet) => {
        const step = trainingStepFor(config, pet.tier);
        const have = step ? save.materials?.[step.material] ?? 0 : 0;
        const shortfall = step ? Math.max(0, step.count - have) : 0;
        let blocked: string | null = null;
        if (jobs.some((job) => job.petId === pet.id)) blocked = bk.inTraining;
        else if (!step) blocked = bk.atTopTier;
        else if (hallLevel < pet.tier) blocked = fmt(bk.needHallLevel, { level: pet.tier });
        else if (!isMaxLevel(config, pet)) blocked = bk.needMaxLevel;
        return { pet, step, blocked, shortfall };
      }),
    [save.pets, save.materials, jobs, hallLevel, config, bk],
  );

  const eligible = candidates.filter((c) => c.blocked == null);
  const current = candidates.find((c) => c.pet.id === selected) ?? null;
  // 缺口只能用万能券补，且券要够。
  const coveredByUniversal = current != null && current.shortfall > 0 && universalHave >= current.shortfall;
  const materialsOk =
    current != null && (current.shortfall === 0 || (useUniversal && coveredByUniversal));
  const coinsOk = current?.step != null && save.coins >= current.step.coins;
  const canStart = current != null && current.blocked == null && materialsOk && coinsOk && !slotsFull && !busy;

  return (
    <div className="welcome-overlay" onClick={busy ? undefined : onClose}>
      <div
        className="welcome-card fusion-modal train-modal"
        role="dialog"
        aria-label={bk.pickTitle}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="welcome-title">{bk.pickTitle}</div>
        <div className="welcome-sub">{bk.pickHint}</div>

        {eligible.length === 0 && candidates.length > 0 && (
          <p className="fusion-modal-note">{bk.noEligible}</p>
        )}

        <div className="train-modal-list">
          {candidates.map(({ pet, step, blocked, shortfall }) => (
            <button
              type="button"
              key={pet.id}
              data-coach={blocked == null ? "trainingPet" : undefined}
              className={`train-modal-pet${selected === pet.id ? " is-selected" : ""}${blocked ? " is-blocked" : ""}`}
              disabled={blocked != null || busy}
              onClick={() => {
                setSelected(pet.id);
                setUseUniversal(false);
              }}
            >
              <SvgSprite species={pet.species} config={config} petState="idle" tier={pet.tier} />
              <span className="train-modal-pet-name">{nameOf(pet)}</span>
              {/* 有升阶目标才显示阶梯箭头；顶阶宠的「已达最高阶」交给下面的 block 行，不重复 */}
              {step && (
                <span className="train-modal-pet-meta">
                  {fmt(bk.tierUp, { from: pet.tier, to: pet.tier + 1 })}
                </span>
              )}
              {blocked ? (
                <span className="train-modal-pet-block">{blocked}</span>
              ) : (
                shortfall > 0 && (
                  <span className="train-modal-pet-block">
                    {fmt(bk.universalShort, { count: shortfall })}
                  </span>
                )
              )}
            </button>
          ))}
        </div>

        {current?.step && (
          <div className="train-modal-cost" data-coach="trainingCosts">
            <span className="by-pill">
              {bk.materialNames[current.step.material] ?? current.step.material}{" "}
              <b>
                {Math.min(current.step.count, save.materials?.[current.step.material] ?? 0)}/
                {current.step.count}
              </b>
            </span>
            <span className="by-pill">{fmt(bk.costCoins, { cost: formatCount(current.step.coins) })}</span>
            <span className="by-pill is-light">
              {fmt(bk.costTime, { time: formatCountdown(current.step.seconds) })}
            </span>
          </div>
        )}

        {/* 万能券补差额：只在真的缺料且券够时给出，避免玩家误耗稀有券 */}
        {current != null && current.shortfall > 0 && coveredByUniversal && (
          <label className="train-modal-universal">
            <input
              type="checkbox"
              checked={useUniversal}
              onChange={(event) => setUseUniversal(event.target.checked)}
            />
            {fmt(bk.useUniversal, {
              count: current.shortfall,
              name: bk.materialNames[universalId] ?? universalId,
            })}
          </label>
        )}

        {error && <div className="fusion-modal-detail">{localizeGameMessage(error, lang)}</div>}

        <div className="fusion-modal-actions">
          <button type="button" className="welcome-cta is-secondary" disabled={busy} onClick={onClose}>
            {bk.cancelBtn}
          </button>
          <button
            type="button"
            className="welcome-cta"
            data-coach="trainingConfirm"
            disabled={!canStart}
            onClick={() => current && onStart(current.pet.id, useUniversal)}
          >
            {bk.startBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
