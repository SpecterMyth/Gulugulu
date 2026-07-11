import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  ClickWorkResult,
  GameConfigPayload,
  GameSave,
  ReleasePetResult,
  WanderPickupResult,
} from "../types";
import { isTauri } from "../tauri";
import { isTestConfigRequested, localGameConfig } from "./config";
import { MockGameEngine } from "./mockEngine";

export interface GameBridge {
  getConfig(): Promise<GameConfigPayload>;
  getState(): Promise<GameSave>;
  clickWork(petId: string): Promise<ClickWorkResult>;
  buyEgg(element: string): Promise<GameSave>;
  placeEgg(eggId: string, slot: number): Promise<GameSave>;
  collectHatched(eggId: string): Promise<GameSave>;
  fusePets(idA: string, idB: string): Promise<GameSave>;
  upgradeHatchery(): Promise<GameSave>;
  upgradeYard(): Promise<GameSave>;
  releasePet(petId: string): Promise<ReleasePetResult>;
  setActivePet(petId: string): Promise<GameSave>;
  advanceTutorial(step: number): Promise<GameSave>;
  wanderPickup(): Promise<WanderPickupResult>;
  resizeWindow(width: number, height: number): Promise<void>;
  /** Subscribe to backend-pushed saves (idle tick). Returns unsubscribe. */
  onStateEvent(handler: (save: GameSave) => void): () => void;
  /** Debug (调试 panel): grant coins outright. */
  debugAddCoins(amount: number): Promise<GameSave>;
  /** Debug (调试 panel): finish all incubating eggs' timers. */
  debugHatchNow(): Promise<GameSave>;
  /** Debug (调试 panel): max out every pet's level. */
  debugMaxPets(): Promise<GameSave>;
  /** Debug (调试 panel): wipe the save back to the initial state. */
  debugClearSave(): Promise<GameSave>;
  /** Preview-only: simulate agent token exp. Undefined in the Tauri build. */
  debugFeedTokens?(amount: number): Promise<{ save: GameSave; petExp: number; coins: number }>;
  /** Preview-only: wipe the mock save. */
  debugReset?(): Promise<GameSave>;
}

class TauriBridge implements GameBridge {
  getConfig() {
    return invoke<GameConfigPayload>("get_game_config");
  }
  getState() {
    return invoke<GameSave>("get_game_state");
  }
  clickWork(petId: string) {
    return invoke<ClickWorkResult>("click_work", { petId });
  }
  buyEgg(element: string) {
    return invoke<GameSave>("buy_egg", { element });
  }
  placeEgg(eggId: string, slot: number) {
    return invoke<GameSave>("place_egg", { eggId, slot });
  }
  collectHatched(eggId: string) {
    return invoke<GameSave>("collect_hatched", { eggId });
  }
  fusePets(idA: string, idB: string) {
    return invoke<GameSave>("fuse_pets", { idA, idB });
  }
  upgradeHatchery() {
    return invoke<GameSave>("upgrade_hatchery");
  }
  upgradeYard() {
    return invoke<GameSave>("upgrade_yard");
  }
  releasePet(petId: string) {
    return invoke<ReleasePetResult>("release_pet", { petId });
  }
  setActivePet(petId: string) {
    return invoke<GameSave>("set_active_pet", { petId });
  }
  advanceTutorial(step: number) {
    return invoke<GameSave>("advance_tutorial", { step });
  }
  wanderPickup() {
    return invoke<WanderPickupResult>("wander_pickup");
  }
  resizeWindow(width: number, height: number) {
    return invoke<void>("resize_game_window", { width, height });
  }
  onStateEvent(handler: (save: GameSave) => void) {
    let disposed = false;
    let dispose: (() => void) | undefined;
    void listen<GameSave>("game://state", (event) => handler(event.payload)).then((fn) => {
      if (disposed) fn();
      else dispose = fn;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }
  debugAddCoins(amount: number) {
    return invoke<GameSave>("debug_add_coins", { amount });
  }
  debugHatchNow() {
    return invoke<GameSave>("debug_hatch_now");
  }
  debugMaxPets() {
    return invoke<GameSave>("debug_max_pets");
  }
  debugClearSave() {
    return invoke<GameSave>("debug_clear_save");
  }
}

class MockBridge implements GameBridge {
  private engine = new MockGameEngine(localGameConfig);

  /** Engine methods throw synchronously on rule violations — normalize to
   *  rejected promises so callers' .catch() branches behave like Tauri's. */
  private run<T>(fn: () => T): Promise<T> {
    try {
      return Promise.resolve(fn());
    } catch (error) {
      return Promise.reject(error);
    }
  }

  getConfig() {
    return Promise.resolve({ testMode: isTestConfigRequested, config: localGameConfig });
  }
  getState() {
    return this.run(() => this.engine.getState());
  }
  clickWork(petId: string) {
    return this.run(() => this.engine.clickWork(petId));
  }
  buyEgg(element: string) {
    return this.run(() => this.engine.buyEgg(element));
  }
  placeEgg(eggId: string, slot: number) {
    return this.run(() => this.engine.placeEgg(eggId, slot));
  }
  collectHatched(eggId: string) {
    return this.run(() => this.engine.collectHatched(eggId));
  }
  fusePets(idA: string, idB: string) {
    return this.run(() => this.engine.fusePets(idA, idB));
  }
  upgradeHatchery() {
    return this.run(() => this.engine.upgradeHatchery());
  }
  upgradeYard() {
    return this.run(() => this.engine.upgradeYard());
  }
  releasePet(petId: string) {
    return this.run(() => this.engine.releasePet(petId));
  }
  setActivePet(petId: string) {
    return this.run(() => this.engine.setActivePet(petId));
  }
  advanceTutorial(step: number) {
    return this.run(() => this.engine.advanceTutorial(step));
  }
  wanderPickup() {
    return this.run(() => this.engine.wanderPickup());
  }
  resizeWindow() {
    return Promise.resolve();
  }
  onStateEvent(handler: (save: GameSave) => void) {
    return this.engine.subscribe(handler);
  }
  debugAddCoins(amount: number) {
    return this.run(() => this.engine.addCoins(amount));
  }
  debugHatchNow() {
    return this.run(() => this.engine.hatchNow());
  }
  debugMaxPets() {
    return this.run(() => this.engine.maxAllPets());
  }
  debugClearSave() {
    return this.run(() => this.engine.reset());
  }
  debugFeedTokens(amount: number) {
    return this.run(() => this.engine.feedTokens(amount));
  }
  debugReset() {
    return this.run(() => this.engine.reset());
  }
}

let bridge: GameBridge | null = null;

export function getGameBridge(): GameBridge {
  if (!bridge) {
    bridge = isTauri() ? new TauriBridge() : new MockBridge();
  }
  return bridge;
}
