import type { Dispatch, SetStateAction } from "react";
import { WelcomeBackCard } from "../game/WelcomeBack";
import { FusionModal } from "../game/FusionModal";
import type { GameBridge } from "../game/bridge";
import type { UiMode } from "../game/GamePanels";
import type { TutorialHint } from "../game/tutorial";
import type { FusionStartResult, GameConfig, GameSave, PetInstance } from "../types";

type OverlaysProps = {
  showStage: boolean;
  visibleTutorialHint: TutorialHint | null;
  toast: { id: number; text: string } | null;
  uiMode: UiMode;
  activePet: PetInstance | null;
  fusionFlash: boolean;
  fusionPair: { a: PetInstance; b: PetInstance } | null;
  gameConfig: GameConfig | null;
  bridge: GameBridge;
  setFusionPair: Dispatch<SetStateAction<{ a: PetInstance; b: PetInstance } | null>>;
  handleFusionCommitted: (result: FusionStartResult) => void;
  welcomeOffline: number | null;
  save: GameSave | null;
  setWelcomeOffline: Dispatch<SetStateAction<number | null>>;
};

export function Overlays({
  showStage,
  visibleTutorialHint,
  toast,
  uiMode,
  activePet,
  fusionFlash,
  fusionPair,
  gameConfig,
  bridge,
  setFusionPair,
  handleFusionCommitted,
  welcomeOffline,
  save,
  setWelcomeOffline,
}: OverlaysProps) {
  return (
    <>
      {!showStage && visibleTutorialHint && (
        <div className="tutorial-bubble" key={visibleTutorialHint.id}>
          {visibleTutorialHint.text}
        </div>
      )}

      {/* 后院有主角时，提示改由场景的头顶气泡表达（BackyardScene 内） */}
      {!showStage && toast && !(uiMode === "backyard" && activePet != null) && (
        <div className="game-toast" key={toast.id}>
          {toast.text}
        </div>
      )}

      {fusionFlash && <div className="fusion-flash" />}

      {fusionPair && gameConfig && (
        <FusionModal
          pair={fusionPair}
          config={gameConfig}
          bridge={bridge}
          onClose={() => setFusionPair(null)}
          onCommitted={handleFusionCommitted}
        />
      )}

      {welcomeOffline != null && save != null && gameConfig != null && (
        <WelcomeBackCard
          save={save}
          config={gameConfig}
          offlineMs={welcomeOffline}
          onClose={() => setWelcomeOffline(null)}
        />
      )}
    </>
  );
}
