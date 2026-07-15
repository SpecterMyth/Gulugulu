import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AppSettings,
  ClickWorkResult,
  DynamicQuote,
  EnergyFeedOutcome,
  FusionCliStatus,
  FusionProgress,
  FusionStartResult,
  GameConfigPayload,
  GameSave,
  KeyFxEvent,
  ReleasePetResult,
  StaminaPatchEvent,
  SteamStatus,
  WanderSnackResult,
} from "../types";
import { isTauri } from "../tauri";
import { isTestConfigRequested, localGameConfig } from "./config";
import { MockGameEngine } from "./mockEngine";

export interface GameBridge {
  getConfig(): Promise<GameConfigPayload>;
  getState(): Promise<GameSave>;
  clickWork(petId: string): Promise<ClickWorkResult>;
  buyEgg(element: string, tier: number): Promise<GameSave>;
  placeEgg(eggId: string, slot: number): Promise<GameSave>;
  collectHatched(eggId: string): Promise<GameSave>;
  fusePets(idA: string, idB: string): Promise<GameSave>;
  /** AI 融合预检：本地 Claude Code（优先）/ Codex CLI 是否可用。 */
  checkFusionCli(force?: boolean): Promise<FusionCliStatus>;
  /** AI 融合入口：掷骰走配方或 AI 生成（AI 路径立即返回挂起蛋）。 */
  fuseGenerate(idA: string, idB: string): Promise<FusionStartResult>;
  /** 订阅 AI 生成进度（fusion://progress）。Returns unsubscribe. */
  onFusionProgress(handler: (progress: FusionProgress) => void): () => void;
  upgradeHatchery(): Promise<GameSave>;
  upgradeYard(): Promise<GameSave>;
  upgradeShop(): Promise<GameSave>;
  releasePet(petId: string): Promise<ReleasePetResult>;
  setActivePet(petId: string): Promise<GameSave>;
  advanceTutorial(step: number): Promise<GameSave>;
  /** 漫游零食：主宠 +2~5 点精力（原漫游捡币，v1.1 只回精力不产金币）。 */
  wanderSnack(): Promise<WanderSnackResult>;
  /** 应用设置（键盘充能/总在最前/随机移动/语言）。与托盘菜单共用单一真源。 */
  getSettings(): Promise<AppSettings>;
  setAlwaysOnTop(enabled: boolean): Promise<AppSettings>;
  setRandomMovement(enabled: boolean): Promise<AppSettings>;
  setLanguage(language: string): Promise<AppSettings>;
  /** 订阅设置变更（settings://changed，托盘或其它入口改动时推送）。Returns unsubscribe. */
  onSettingsChanged(handler: (settings: AppSettings) => void): () => void;
  /** 键盘充能开关（Tauri：全局钩子；预览：页面内 keydown 模拟）。 */
  getKeyboardCapture(): Promise<boolean>;
  setKeyboardCapture(enabled: boolean): Promise<boolean>;
  /** 订阅键帽特效批次（game://keys，≤4/s，纯表现）。Returns unsubscribe. */
  onKeyFx(handler: (event: KeyFxEvent) => void): () => void;
  /** 订阅精力轻量补丁（game://stamina，键盘/零食入账）。Returns unsubscribe. */
  onStaminaPatch(handler: (event: StaminaPatchEvent) => void): () => void;
  resizeWindow(width: number, height: number): Promise<void>;
  /** Subscribe to backend-pushed saves (idle tick). Returns unsubscribe. */
  onStateEvent(handler: (save: GameSave) => void): () => void;
  /** 已缓存的动态台词批次（后台 CLI 预生成；预览模式恒空数组）。 */
  getDynamicQuotes(): Promise<DynamicQuote[]>;
  /** 订阅后台新生成的动态台词批次（quotes://ready）。Returns unsubscribe. */
  onQuotesReady(handler: (quotes: DynamicQuote[]) => void): () => void;
  /** Steam 集成状态(连接/待发放/待认领/owner)。预览模式恒 unavailable。 */
  getSteamStatus(): Promise<SteamStatus>;
  /** 订阅 steam://status。Returns unsubscribe. */
  onSteamStatus(handler: (status: SteamStatus) => void): () => void;
  /** 手动触发一轮 Steam 同步(outbox 巡检 + 对账)。 */
  steamSyncNow(): Promise<void>;
  /** 跨账号存档确认重绑(剥离绑定并重打当前账号)。 */
  steamConfirmRebind(): Promise<GameSave>;
  /** Debug (调试 panel): grant coins outright. */
  debugAddCoins(amount: number): Promise<GameSave>;
  /** Debug (调试 panel): finish all incubating eggs' timers. */
  debugHatchNow(): Promise<GameSave>;
  /** Debug (调试 panel): max out every pet's level. */
  debugMaxPets(): Promise<GameSave>;
  /** Debug (调试 panel): wipe the save back to the initial state. */
  debugClearSave(): Promise<GameSave>;
  /** Debug (调试 panel): drain the active pet to 0 stamina. */
  debugDrainStamina(): Promise<GameSave>;
  /** Debug (调试 panel): simulate a batch of key presses. */
  debugFeedKeys(count: number): Promise<GameSave>;
  /** Preview-only: simulate agent tokens → 精力. Undefined in the Tauri build. */
  debugFeedTokens?(amount: number): Promise<{ save: GameSave; outcome: EnergyFeedOutcome }>;
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
  buyEgg(element: string, tier: number) {
    return invoke<GameSave>("buy_egg", { element, tier });
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
  checkFusionCli(force?: boolean) {
    return invoke<FusionCliStatus>("check_fusion_cli", { force: force ?? false });
  }
  fuseGenerate(idA: string, idB: string) {
    return invoke<FusionStartResult>("fuse_pets_ai", { idA, idB });
  }
  onFusionProgress(handler: (progress: FusionProgress) => void) {
    let disposed = false;
    let dispose: (() => void) | undefined;
    void listen<FusionProgress>("fusion://progress", (event) => handler(event.payload)).then((fn) => {
      if (disposed) fn();
      else dispose = fn;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }
  upgradeHatchery() {
    return invoke<GameSave>("upgrade_hatchery");
  }
  upgradeYard() {
    return invoke<GameSave>("upgrade_yard");
  }
  upgradeShop() {
    return invoke<GameSave>("upgrade_shop");
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
  wanderSnack() {
    return invoke<WanderSnackResult>("wander_snack");
  }
  getSettings() {
    return invoke<AppSettings>("get_settings");
  }
  setAlwaysOnTop(enabled: boolean) {
    return invoke<AppSettings>("set_always_on_top", { enabled });
  }
  setRandomMovement(enabled: boolean) {
    return invoke<AppSettings>("set_random_movement", { enabled });
  }
  setLanguage(language: string) {
    return invoke<AppSettings>("set_language", { language });
  }
  onSettingsChanged(handler: (settings: AppSettings) => void) {
    let disposed = false;
    let dispose: (() => void) | undefined;
    void listen<AppSettings>("settings://changed", (event) => handler(event.payload)).then((fn) => {
      if (disposed) fn();
      else dispose = fn;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }
  getKeyboardCapture() {
    return invoke<boolean>("get_keyboard_capture");
  }
  setKeyboardCapture(enabled: boolean) {
    return invoke<boolean>("set_keyboard_capture", { enabled });
  }
  onKeyFx(handler: (event: KeyFxEvent) => void) {
    let disposed = false;
    let dispose: (() => void) | undefined;
    void listen<KeyFxEvent>("game://keys", (event) => handler(event.payload)).then((fn) => {
      if (disposed) fn();
      else dispose = fn;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }
  onStaminaPatch(handler: (event: StaminaPatchEvent) => void) {
    let disposed = false;
    let dispose: (() => void) | undefined;
    void listen<StaminaPatchEvent>("game://stamina", (event) => handler(event.payload)).then((fn) => {
      if (disposed) fn();
      else dispose = fn;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
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
  getDynamicQuotes() {
    return invoke<DynamicQuote[]>("get_dynamic_quotes");
  }
  onQuotesReady(handler: (quotes: DynamicQuote[]) => void) {
    let disposed = false;
    let dispose: (() => void) | undefined;
    void listen<DynamicQuote[]>("quotes://ready", (event) => handler(event.payload)).then((fn) => {
      if (disposed) fn();
      else dispose = fn;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }
  getSteamStatus() {
    return invoke<SteamStatus>("get_steam_status");
  }
  onSteamStatus(handler: (status: SteamStatus) => void) {
    let disposed = false;
    let dispose: (() => void) | undefined;
    void listen<SteamStatus>("steam://status", (event) => handler(event.payload)).then((fn) => {
      if (disposed) fn();
      else dispose = fn;
    });
    return () => {
      disposed = true;
      dispose?.();
    };
  }
  steamSyncNow() {
    return invoke<void>("steam_sync_now");
  }
  steamConfirmRebind() {
    return invoke<GameSave>("steam_confirm_rebind");
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
  debugDrainStamina() {
    return invoke<GameSave>("debug_drain_stamina");
  }
  debugFeedKeys(count: number) {
    return invoke<GameSave>("debug_feed_keys", { count });
  }
}

/** e.key → 键帽显示字符（镜像 Rust key_watcher::vk_label 的字形约定）。 */
function keyLabelForPreview(key: string): string {
  if (key.length === 1) {
    if (key === " ") return "␣";
    return key.toUpperCase();
  }
  const named: Record<string, string> = {
    Enter: "⏎",
    Backspace: "⌫",
    Tab: "⇥",
    Escape: "⎋",
    Shift: "⇧",
    ArrowLeft: "←",
    ArrowUp: "↑",
    ArrowRight: "→",
    ArrowDown: "↓",
  };
  return named[key] ?? "⌨";
}

class MockBridge implements GameBridge {
  private engine = new MockGameEngine(localGameConfig);
  private keyFxHandlers = new Set<(event: KeyFxEvent) => void>();
  private staminaHandlers = new Set<(event: StaminaPatchEvent) => void>();
  private settingsHandlers = new Set<(settings: AppSettings) => void>();
  private keyboardEnabled = true;
  // 预览模式没有 Rust 单一真源：设置存内存（keyboardCapture 与 keyboardEnabled 同步）。
  private appSettings: AppSettings = {
    keyboardCapture: true,
    alwaysOnTop: true,
    randomMovement: true,
    language: window.localStorage.getItem("gulugulu.language") ?? "zh",
  };
  private pendingLabels: string[] = [];
  private pendingCount = 0;
  private countedThisWindow = 0;

  constructor() {
    // 预览模式的"全局键盘"退化为页面内 keydown（浏览器能力边界）；
    // 去重（e.repeat）与限速语义对齐 Rust key_watcher。
    window.addEventListener("keydown", (event) => {
      if (!this.keyboardEnabled || event.repeat) return;
      if (this.countedThisWindow >= localGameConfig.keyRateCapPerSec) return;
      this.countedThisWindow += 1;
      this.pendingCount += 1;
      if (this.pendingLabels.length < 8) this.pendingLabels.push(keyLabelForPreview(event.key));
    });
    // 250ms 键帽特效批（镜像 game://keys 节拍）。
    window.setInterval(() => {
      if (this.pendingLabels.length === 0) return;
      const labels = this.pendingLabels.splice(0);
      for (const handler of this.keyFxHandlers) handler({ labels });
    }, 250);
    // 1s 精力入账批（镜像 game://stamina 节拍）。
    window.setInterval(() => {
      this.countedThisWindow = 0;
      const count = this.pendingCount;
      this.pendingCount = 0;
      if (count === 0) return;
      const { outcome } = this.engine.feedKeys(count);
      if (outcome.staminaFed > 0) {
        const patch: StaminaPatchEvent = {
          source: "keys",
          perPet: outcome.perPet,
          wokePetIds: outcome.wokePetIds,
        };
        for (const handler of this.staminaHandlers) handler(patch);
      }
    }, 1000);
  }

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
  buyEgg(element: string, tier: number) {
    return this.run(() => this.engine.buyEgg(element, tier));
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
  checkFusionCli() {
    // ?nocli=1 预演"未检测到 CLI"的拒绝弹窗
    const nocli = new URLSearchParams(window.location.search).has("nocli");
    return Promise.resolve(
      nocli
        ? { available: false, error: "Claude Code：未找到命令；Codex：未找到命令（预览 ?nocli=1）" }
        : { available: true, provider: "claude", version: "mock", path: "preview" },
    );
  }
  fuseGenerate(idA: string, idB: string) {
    return this.run(() => this.engine.fuseGenerate(idA, idB));
  }
  onFusionProgress(handler: (progress: FusionProgress) => void) {
    return this.engine.subscribeFusionProgress(handler);
  }
  upgradeHatchery() {
    return this.run(() => this.engine.upgradeHatchery());
  }
  upgradeYard() {
    return this.run(() => this.engine.upgradeYard());
  }
  upgradeShop() {
    return this.run(() => this.engine.upgradeShop());
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
  wanderSnack() {
    return this.run(() => this.engine.wanderSnack());
  }
  private emitSettings() {
    for (const handler of this.settingsHandlers) handler({ ...this.appSettings });
  }
  getSettings() {
    return Promise.resolve({ ...this.appSettings });
  }
  setAlwaysOnTop(enabled: boolean) {
    this.appSettings.alwaysOnTop = enabled;
    this.emitSettings();
    return Promise.resolve({ ...this.appSettings });
  }
  setRandomMovement(enabled: boolean) {
    this.appSettings.randomMovement = enabled;
    this.emitSettings();
    return Promise.resolve({ ...this.appSettings });
  }
  setLanguage(language: string) {
    this.appSettings.language = language;
    this.emitSettings();
    return Promise.resolve({ ...this.appSettings });
  }
  onSettingsChanged(handler: (settings: AppSettings) => void) {
    this.settingsHandlers.add(handler);
    return () => this.settingsHandlers.delete(handler);
  }
  getKeyboardCapture() {
    return Promise.resolve(this.keyboardEnabled);
  }
  setKeyboardCapture(enabled: boolean) {
    this.keyboardEnabled = enabled;
    this.appSettings.keyboardCapture = enabled;
    this.emitSettings();
    return Promise.resolve(enabled);
  }
  onKeyFx(handler: (event: KeyFxEvent) => void) {
    this.keyFxHandlers.add(handler);
    return () => this.keyFxHandlers.delete(handler);
  }
  onStaminaPatch(handler: (event: StaminaPatchEvent) => void) {
    this.staminaHandlers.add(handler);
    return () => this.staminaHandlers.delete(handler);
  }
  resizeWindow() {
    return Promise.resolve();
  }
  onStateEvent(handler: (save: GameSave) => void) {
    return this.engine.subscribe(handler);
  }
  getDynamicQuotes() {
    return Promise.resolve([] as DynamicQuote[]);
  }
  onQuotesReady() {
    return () => {};
  }
  getSteamStatus() {
    // 网页预览没有 Steam:恒 unavailable,顺带免费验证降级 UI。
    return Promise.resolve({
      mode: "unavailable",
      pendingMints: 0,
      unclaimedImports: 0,
      ownerMismatch: false,
      lastSyncAt: null,
      steamId: null,
      appId: 4956830,
    } satisfies SteamStatus);
  }
  onSteamStatus() {
    return () => {};
  }
  steamSyncNow() {
    return Promise.resolve();
  }
  steamConfirmRebind() {
    return this.run(() => this.engine.getState());
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
  debugDrainStamina() {
    return this.run(() => this.engine.drainStamina());
  }
  debugFeedKeys(count: number) {
    return this.run(() => this.engine.feedKeys(count).save);
  }
  debugFeedTokens(amount: number) {
    return this.run(() => {
      const result = this.engine.feedTokens(amount);
      if (result.outcome.staminaFed > 0) {
        const patch: StaminaPatchEvent = {
          source: "tokens",
          perPet: result.outcome.perPet,
          wokePetIds: result.outcome.wokePetIds,
        };
        for (const handler of this.staminaHandlers) handler(patch);
      }
      return result;
    });
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
