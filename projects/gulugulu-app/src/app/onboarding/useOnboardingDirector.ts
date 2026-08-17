import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameBridge } from "../../game/bridge";
import type { UiMode } from "../../game/GamePanels";
import type { GameConfig, GameSave } from "../../types";
import {
  fixedDexCount,
  hasElementPet,
  onboardingDirective,
  type OnboardingDirective,
} from "./onboardingSteps";
import {
  ONBOARDING_STEP_IDS,
  onboardingLanguageFromStorage,
  type OnboardingStepId,
} from "./onboardingCopy";

type Input = {
  bridge: GameBridge;
  save: GameSave | null;
  config: GameConfig | null;
  uiMode: UiMode;
  nearPetId: string | null;
  nearShop: boolean;
  nearMarket: boolean;
  nearNoticeBoard: boolean;
  fusionModalOpen: boolean;
  setSave: (save: GameSave) => void;
};

export type OnboardingDirector = {
  active: boolean;
  /** A receipt or route skip is being persisted. UI actions should stay single-flight. */
  busy: boolean;
  directive: OnboardingDirective | null;
  complete: (step?: string) => Promise<GameSave | null>;
  /** Persistently finish the remaining main route. App may wire this to an explicit skip action. */
  skipMain: () => Promise<GameSave | null>;
  skipAgent: () => Promise<GameSave | null>;
};

type OnboardingTask = () => Promise<GameSave | null>;

export type OnboardingTaskQueue = {
  run: (key: string, task: OnboardingTask) => Promise<GameSave | null>;
};

/**
 * Serialize different onboarding mutations while coalescing repeated clicks for the
 * same receipt. This keeps slow native saves from accumulating duplicate work without
 * losing a legitimate next-step mutation that arrives while the previous one settles.
 */
export function createOnboardingTaskQueue(
  onBusyChange: (busy: boolean) => void = () => undefined,
): OnboardingTaskQueue {
  let tail: Promise<GameSave | null> = Promise.resolve(null);
  const inFlight = new Map<string, Promise<GameSave | null>>();

  return {
    run(key, task) {
      const existing = inFlight.get(key);
      if (existing) return existing;

      if (inFlight.size === 0) onBusyChange(true);
      const queued = tail.then(task, task);
      let tracked: Promise<GameSave | null>;
      tracked = queued.finally(() => {
        if (inFlight.get(key) === tracked) inFlight.delete(key);
        if (inFlight.size === 0) onBusyChange(false);
      });
      inFlight.set(key, tracked);
      tail = tracked.catch(() => null);
      return tracked;
    },
  };
}

function speciesHasElement(config: GameConfig, species: string, element: string): boolean {
  return config.species[species]?.elements.includes(element) === true;
}

function hasCollectedFusionPet(save: GameSave): boolean {
  // The collected pet instance is the durable receipt. A Steam AI-slot result can be
  // bound and usable before its optional local species metadata/design has resolved,
  // so consulting config/customSpecies here would strand B05 after a valid collect.
  return save.pets.some((pet) => pet.tier >= 2);
}

function currentStepSatisfied(input: Input): boolean {
  const {
    save,
    config,
    uiMode,
    nearPetId,
    nearShop,
    nearMarket,
    nearNoticeBoard,
    fusionModalOpen,
  } = input;
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
    case "B05": return hasCollectedFusionPet(save);
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
    case "D01": return uiMode === "menu";
    case "D04": return save.activePetId != null &&
      speciesHasElement(config, save.pets.find((pet) => pet.id === save.activePetId)?.species ?? "", "water");
    case "D05": return fusionModalOpen;
    case "D06": return save.onboarding.tutorialFusions >= 2;
    case "D07": return Object.values(save.dexObtained ?? {}).filter((count) => count > 0).length >= 8;
    case "D10": return save.onboarding.tutorialFusions >= 4 &&
      (save.onboarding.guidedFusionEggIds?.length ?? 0) === 0;
    case "D11": return uiMode === "menu";
    case "E01": return uiMode === "factory";
    case "E02": return save.onboarding.factoryFormalEntered;
    case "E03": return save.onboarding.factoryFormalEntered && uiMode !== "factory";
    case "F01": return nearNoticeBoard;
    case "F03a": return save.onboarding.agentPromptSkipped;
    case "G01": return nearMarket;
    case "G03": return save.onboarding.steamMarketOpenAttempted;
    default: return false;
  }
}

type OnboardingSkipBridge = Pick<
  GameBridge,
  "advanceOnboarding" | "skipOnboardingAgent" | "grantSkippedOnboardingFusions"
>;

/**
 * Complete the persisted route using only receipts already accepted by the backend.
 * Exported separately from the hook so the transactional sequence can be regression-tested.
 */
export async function skipOnboardingRoute(
  bridge: OnboardingSkipBridge,
  initialSave: GameSave | null,
  setSave: (save: GameSave) => void,
): Promise<GameSave | null> {
  let next = initialSave;
  const visited = new Set<string>();

  if (next?.onboarding?.status === "active") {
    next = await bridge.grantSkippedOnboardingFusions();
    setSave(next);
  }

  while (next?.onboarding?.status === "active") {
    const step = next.onboarding.step as OnboardingStepId;
    if (!ONBOARDING_STEP_IDS.includes(step) || visited.has(step)) {
      throw new Error(`Cannot skip onboarding from persisted step: ${next.onboarding.step}`);
    }
    visited.add(step);

    // C02-C12 are compatibility cursors for one real first-shift receipt. The
    // backend explicitly accepts C12 from any C cursor and grants its roster once.
    const receipt = step.startsWith("C") ? "C12" : step;
    if (step === "F03a" && !next.onboarding.agentPromptSkipped) {
      next = await bridge.skipOnboardingAgent();
      setSave(next);
    }
    const previousStep = next.onboarding?.step;
    next = await bridge.advanceOnboarding(receipt);
    setSave(next);
    if (
      next.onboarding?.status === "active"
      && next.onboarding.step === previousStep
    ) {
      throw new Error(`Onboarding skip did not advance from step: ${previousStep}`);
    }
  }
  return next;
}

export function useOnboardingDirector(input: Input): OnboardingDirector {
  const currentRef = useRef(input);
  currentRef.current = input;
  const [busy, setBusy] = useState(false);
  const taskQueueRef = useRef<OnboardingTaskQueue | null>(null);
  if (taskQueueRef.current == null) {
    taskQueueRef.current = createOnboardingTaskQueue(setBusy);
  }

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
    const step = requestedStep ?? currentRef.current.save?.onboarding?.step ?? "none";
    return taskQueueRef.current!.run(`complete:${step}`, run);
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
    return taskQueueRef.current!.run("skip-agent", run);
  }, []);

  const skipMain = useCallback(() => {
    const run = async (): Promise<GameSave | null> => {
      const current = currentRef.current;
      return skipOnboardingRoute(current.bridge, current.save, current.setSave);
    };
    return taskQueueRef.current!.run("skip-main", run);
  }, []);

  const language = onboardingLanguageFromStorage();
  const directive = useMemo(() => {
    if (!input.save || !input.config) return null;
    return onboardingDirective(input.save, input.config, {
      uiMode: input.uiMode,
      nearPetId: input.nearPetId,
      nearShop: input.nearShop,
      nearMarket: input.nearMarket,
      nearNoticeBoard: input.nearNoticeBoard,
      fusionModalOpen: input.fusionModalOpen,
    }, language);
  }, [
    input.save,
    input.config,
    input.uiMode,
    input.nearPetId,
    input.nearShop,
    input.nearMarket,
    input.nearNoticeBoard,
    input.fusionModalOpen,
    language,
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
    input.nearNoticeBoard,
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

  return {
    active: input.save?.onboarding?.status === "active",
    busy,
    directive,
    complete,
    skipMain,
    skipAgent,
  };
}
