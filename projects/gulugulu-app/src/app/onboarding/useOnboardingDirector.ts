import { useCallback, useEffect, useMemo, useRef } from "react";
import type { GameBridge } from "../../game/bridge";
import type { UiMode } from "../../game/GamePanels";
import type { GameConfig, GameSave } from "../../types";
import {
  fixedDexCount,
  hasElementPet,
  onboardingDirective,
  type OnboardingDirective,
} from "./onboardingSteps";

type Input = {
  bridge: GameBridge;
  save: GameSave | null;
  config: GameConfig | null;
  uiMode: UiMode;
  nearPetId: string | null;
  nearShop: boolean;
  nearMarket: boolean;
  fusionModalOpen: boolean;
  setSave: (save: GameSave) => void;
};

export type OnboardingDirector = {
  active: boolean;
  directive: OnboardingDirective | null;
  complete: (step?: string) => Promise<GameSave | null>;
  skipAgent: () => Promise<GameSave | null>;
};

function speciesHasElement(config: GameConfig, species: string, element: string): boolean {
  return config.species[species]?.elements.includes(element) === true;
}

function hasCollectedFusionSpecies(save: GameSave, config: GameConfig): boolean {
  // The catalogue's `tier` describes the species' recipe band and is intentionally absent
  // from several fusion species. The collected pet is the authoritative result: tutorial
  // fusion raises the pet itself to T2 and uses a multi-element recipe.
  return save.pets.some(
    (pet) => pet.tier >= 2 && (config.species[pet.species]?.elements.length ?? 0) >= 2,
  );
}

function currentStepSatisfied(input: Input): boolean {
  const { save, config, uiMode, nearPetId, nearShop, nearMarket, fusionModalOpen } = input;
  if (!save?.onboarding || !config) return false;
  const step = save.onboarding.step;
  const fireEgg = save.eggs.find((egg) => {
    if (egg.shopElement === "fire") return true;
    return speciesHasElement(config, egg.species, "fire");
  });
  switch (step) {
    case "A01": return fixedDexCount(save, config) >= 1;
    case "A02": return save.onboarding.tutorialWorkClicks >= 1;
    case "A03": return save.onboarding.tutorialWorkClicks >= 20;
    case "A05": return uiMode === "menu";
    case "A06": return uiMode === "backyard";
    case "A10": return save.hatcheryLevel >= 2;
    case "A11": return nearShop;
    case "A12": return fireEgg != null || hasElementPet(save, config, "fire");
    case "A13": return fireEgg?.slot != null;
    case "A14": return save.yardLevel >= 2;
    case "A15": return hasElementPet(save, config, "fire");
    case "A16": return hasElementPet(save, config, "fire") &&
      save.activePetId != null &&
      speciesHasElement(config, save.pets.find((pet) => pet.id === save.activePetId)?.species ?? "", "fire");
    case "A17": return uiMode === "menu";
    case "A18": return save.onboarding.tutorialWorkClicks >= 20 &&
      hasElementPet(save, config, "fire", true);
    case "A19": return uiMode === "backyard";
    case "B01": return nearPetId != null && speciesHasElement(
      config,
      save.pets.find((pet) => pet.id === nearPetId)?.species ?? "",
      "normal",
    );
    case "B02": return fusionModalOpen;
    case "B03": return save.onboarding.tutorialFusions >= 1;
    case "B05": return hasCollectedFusionSpecies(save, config);
    case "B07": return uiMode === "menu";
    case "C01":
    case "C02":
    case "C03":
    case "C04":
    case "C05":
    case "C06":
    case "C07":
    case "C08":
    case "C09":
    case "C10":
    case "C11":
    case "C12":
      return save.factoryTutorial?.status === "completed";
    case "D04": return save.activePetId != null &&
      speciesHasElement(config, save.pets.find((pet) => pet.id === save.activePetId)?.species ?? "", "water");
    case "D05": return fusionModalOpen;
    case "D06": return save.onboarding.tutorialFusions >= 2;
    case "D07": return Object.values(save.dexObtained ?? {}).filter((count) => count > 0).length >= 8;
    case "E01": return uiMode === "factory";
    case "E02": return save.onboarding.factoryFormalEntered;
    case "E03": return save.onboarding.factoryFormalEntered && uiMode !== "factory";
    case "F03a": return save.onboarding.agentPromptSkipped;
    case "G01": return nearMarket;
    case "G03": return save.onboarding.steamMarketOpenAttempted;
    default: return false;
  }
}

export function useOnboardingDirector(input: Input): OnboardingDirector {
  const currentRef = useRef(input);
  currentRef.current = input;
  const pendingRef = useRef<Promise<GameSave | null>>(Promise.resolve(null));

  const complete = useCallback((requestedStep?: string) => {
    const run = async (): Promise<GameSave | null> => {
      const current = currentRef.current;
      const state = current.save?.onboarding;
      if (!state || state.status !== "active") return current.save;
      const step = requestedStep ?? state.step;
      const realFirstShiftReceipt = step === "C12" && state.step.startsWith("C");
      if (step !== state.step && !realFirstShiftReceipt) return current.save;
      const next = await current.bridge.advanceOnboarding(step);
      current.setSave(next);
      return next;
    };
    const queued = pendingRef.current.then(run, run);
    pendingRef.current = queued.catch(() => null);
    return queued;
  }, []);

  const skipAgent = useCallback(() => {
    const run = async (): Promise<GameSave | null> => {
      const current = currentRef.current;
      const next = await current.bridge.skipOnboardingAgent();
      current.setSave(next);
      if (next.onboarding?.step === "F03a") {
        const advanced = await current.bridge.advanceOnboarding("F03a");
        current.setSave(advanced);
        return advanced;
      }
      return next;
    };
    const queued = pendingRef.current.then(run, run);
    pendingRef.current = queued.catch(() => null);
    return queued;
  }, []);

  const directive = useMemo(() => {
    if (!input.save || !input.config) return null;
    return onboardingDirective(input.save, input.config, {
      uiMode: input.uiMode,
      nearPetId: input.nearPetId,
      nearShop: input.nearShop,
      nearMarket: input.nearMarket,
      fusionModalOpen: input.fusionModalOpen,
    });
  }, [
    input.save,
    input.config,
    input.uiMode,
    input.nearPetId,
    input.nearShop,
    input.nearMarket,
    input.fusionModalOpen,
  ]);

  // Persisted facts are receipts. On reload, advance exactly one cursor at a time until the
  // first unmet objective; this is what makes every checkpoint resumable without duplicate gifts.
  useEffect(() => {
    if (!input.save?.onboarding || input.save.onboarding.status !== "active" || !input.config) return;
    if (!currentStepSatisfied(input)) return;
    const step =
      input.save.onboarding.step.startsWith("C") &&
      input.save.factoryTutorial?.status === "completed"
        ? "C12"
        : input.save.onboarding.step;
    void complete(step);
  }, [
    complete,
    input.save,
    input.config,
    input.uiMode,
    input.nearPetId,
    input.nearShop,
    input.nearMarket,
    input.fusionModalOpen,
  ]);

  // Direction keys are actual receipts for A07/A08. Other shortcuts remain untouched.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const step = currentRef.current.save?.onboarding?.step;
      if (step === "A07" && (event.key === "d" || event.key === "D" || event.key === "ArrowRight")) {
        void complete("A07");
      } else if (step === "A08" && (event.key === "a" || event.key === "A" || event.key === "ArrowLeft")) {
        void complete("A08");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [complete]);

  // Strong route input mutex: keep window chrome and the single highlighted target usable.
  useEffect(() => {
    if (!directive) return;
    const guard = (event: Event) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (target.closest("[data-onboarding-allow], [data-tauri-drag-region]")) return;
      // Moving the desktop pet is window chrome, not a gameplay action. Let the
      // drag begin during every strong-guide step, while the separate click
      // guard below still prevents an off-route pet click from doing anything.
      if (event.type === "pointerdown" && target.closest("[data-onboarding-pet-drag]")) return;
      const coachTarget = target.closest<HTMLElement>("[data-coach]");
      if (directive.targetKey && coachTarget?.dataset.coach === directive.targetKey) return;
      const walkingStep =
        directive.requiredMode === "backyard" &&
        (directive.gesture === "arrow" || directive.gesture === "moveKeys");
      const plainBackyardGround =
        target.closest(".backyard") &&
        !target.closest(
          "button, a, input, select, textarea, [role='button'], .by-pet, .by-char, [data-coach]",
        );
      if (walkingStep && plainBackyardGround) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener("pointerdown", guard, true);
    window.addEventListener("click", guard, true);
    return () => {
      window.removeEventListener("pointerdown", guard, true);
      window.removeEventListener("click", guard, true);
    };
  }, [directive]);

  return {
    active: input.save?.onboarding?.status === "active",
    directive,
    complete,
    skipAgent,
  };
}
