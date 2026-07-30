import type { Dispatch, SetStateAction } from "react";
import { WelcomeBackCard } from "../game/WelcomeBack";
import { AutostartPromptCard } from "./AutostartPromptCard";
import { CodexUpgradeCard } from "./CodexUpgradeCard";
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
  fusionPair: { a: PetInstance; b: PetInstance } | null;
  gameConfig: GameConfig | null;
  bridge: GameBridge;
  setFusionPair: Dispatch<SetStateAction<{ a: PetInstance; b: PetInstance } | null>>;
  handleFusionCommitted: (result: FusionStartResult) => void;
  welcomeOffline: number | null;
  save: GameSave | null;
  setWelcomeOffline: Dispatch<SetStateAction<number | null>>;
  onWelcomeMeasure: (height: number) => void;
  autostartPromptOpen: boolean;
  onAutostartAccept: () => void;
  onAutostartDecline: () => void;
  codexUpgradeOpen: boolean;
  onCodexUpgradeClose: () => void;
};

export function Overlays({
  showStage,
  visibleTutorialHint,
  toast,
  uiMode,
  activePet,
  fusionPair,
  gameConfig,
  bridge,
  setFusionPair,
  handleFusionCommitted,
  welcomeOffline,
  save,
  setWelcomeOffline,
  onWelcomeMeasure,
  autostartPromptOpen,
  onAutostartAccept,
  onAutostartDecline,
  codexUpgradeOpen,
  onCodexUpgradeClose,
}: OverlaysProps) {
  return (
    <>
      {!showStage && visibleTutorialHint && !toast && (
        <div className="tutorial-bubble" key={visibleTutorialHint.id}>
          <span className="guide-sticker-sprinkles" aria-hidden="true" />
          <span className="guide-sticker-copy">{visibleTutorialHint.text}</span>
        </div>
      )}

      {/* 后院有主角时，提示改由场景的头顶气泡表达（BackyardScene 内） */}
      {!showStage && toast && !(uiMode === "backyard" && activePet != null) && (
        <div className="game-toast" key={toast.id}>
          {toast.text}
        </div>
      )}

      {fusionPair && gameConfig && (
        <FusionModal
          pair={fusionPair}
          config={gameConfig}
          bridge={bridge}
          tutorialMode={
            save?.onboarding?.status === "active" &&
            (save.onboarding.tutorialFusions ?? 0) < 2
          }
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
          onMeasure={onWelcomeMeasure}
        />
      )}

      {autostartPromptOpen && (
        <AutostartPromptCard onAccept={onAutostartAccept} onDecline={onAutostartDecline} />
      )}

      {codexUpgradeOpen && <CodexUpgradeCard onClose={onCodexUpgradeClose} />}
    </>
  );
}
