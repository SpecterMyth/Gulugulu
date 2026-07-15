import type { MouseEvent as ReactMouseEvent } from "react";
import type { GameConfig, GameSave, PetInstance } from "../types";
import { fusionFeeFor } from "./config";
import { formatCount } from "./format";

// ---------------------------------------------------------------------------
// 靠近伙伴：动作牌插在脚下的土层剖面里（融合大牌 + 陪伴/放生错位小牌）。
// 从 BackyardScene 抽出的纯展示块。
// ---------------------------------------------------------------------------

type PlacedPet = {
  pet: PetInstance;
  spot: { x: number; bottom: number; size: number; float?: boolean };
};

export type BackyardNearPetActionsProps = {
  nearPlaced: PlacedPet;
  activePet: PetInstance | null;
  busy: boolean;
  config: GameConfig;
  save: GameSave;
  confirmRelease: boolean;
  setConfirmRelease: (value: boolean) => void;
  fusionHintFor: (pet: PetInstance) => string | null;
  releaseRefund: (pet: PetInstance) => number;
  onFuse: (idA: string, idB: string) => void;
  onFollow: (petId: string) => void;
  onRelease: (petId: string) => void;
};

export function BackyardNearPetActions({
  nearPlaced,
  activePet,
  busy,
  config,
  save,
  confirmRelease,
  setConfirmRelease,
  fusionHintFor,
  releaseRefund,
  onFuse,
  onFollow,
  onRelease,
}: BackyardNearPetActionsProps) {
  const stopClick = (event: ReactMouseEvent) => event.stopPropagation();
  const { pet, spot } = nearPlaced;
  const hint = fusionHintFor(pet);
  const canFuse = hint == null && !busy;
  return (
    <div className="by-bubble" style={{ left: spot.x - 150, bottom: 68 }} onClick={stopClick}>
      {/* 左：大融合印章（与右列两个小按钮等高）；右：陪伴/放生上下排布。
          条件未达成的原因由主角头顶气泡说明（10s 后消失）。 */}
      <div className="by-bubble-actions">
        <button
          type="button"
          className={`by-bubble-fuse ${canFuse ? "" : "is-disabled"}`}
          onClick={(event) => {
            event.stopPropagation();
            if (!canFuse || !activePet) return;
            onFuse(activePet.id, pet.id);
          }}
        >
          <b>✨ 融合</b>
          <small>{canFuse ? `${formatCount(fusionFeeFor(config, pet.tier))} 🪙` : "条件未满足"}</small>
        </button>
        <div className="by-bubble-col">
          <button
            type="button"
            className="by-bubble-mini"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onFollow(pet.id);
            }}
          >
            🤝 陪伴
          </button>
          {confirmRelease ? (
            <button
              type="button"
              className="by-bubble-mini is-danger"
              disabled={busy || save.pets.length <= 1}
              onClick={(event) => {
                event.stopPropagation();
                setConfirmRelease(false);
                onRelease(pet.id);
              }}
            >
              确认放生（返 {releaseRefund(pet)} 🪙）
            </button>
          ) : (
            <button
              type="button"
              className="by-bubble-mini is-danger"
              disabled={busy || save.pets.length <= 1}
              title={save.pets.length <= 1 ? "最后一只伙伴不能放生" : undefined}
              onClick={(event) => {
                event.stopPropagation();
                setConfirmRelease(true);
              }}
            >
              放生
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
