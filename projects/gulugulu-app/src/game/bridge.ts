import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AchievementUnlock,
  AgentConnections,
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
  SkinImportResult,
  StaminaPatchEvent,
  SteamImportSummary,
  SteamMarketPrice,
  SteamStatus,
  TokenFeedOutcome,
  WorkshopClearReport,
  WorkshopUploader,
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
  /** 催蛋：点击孵化中的蛋，孵化时间 −1s（OnboardingCoach.md #2）。 */
  pokeEgg(eggId: string): Promise<GameSave>;
  collectHatched(eggId: string): Promise<GameSave>;
  fusePets(idA: string, idB: string): Promise<GameSave>;
  /** AI 融合预检：本地 Claude Code（优先）/ Codex CLI 是否可用。 */
  checkFusionCli(force?: boolean): Promise<FusionCliStatus>;
  /** 开局探测 Claude / Codex 的**真实登录态**（非仅装机；用 auth-status 子命令）。 */
  checkAgentConnections(): Promise<AgentConnections>;
  /** 打开可见终端跑交互式登录（OAuth）。返回后前端轮询 checkAgentConnections。 */
  connectAgent(provider: "claude" | "codex"): Promise<void>;
  /** 断开连接（登出，清除本机 CLI 凭据）。返回后前端重新 checkAgentConnections。 */
  disconnectAgent(provider: "claude" | "codex"): Promise<void>;
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
  /** 应用设置（键盘充能/总在最前/随机移动/语言）。与托盘菜单共用单一真源。 */
  getSettings(): Promise<AppSettings>;
  setAlwaysOnTop(enabled: boolean): Promise<AppSettings>;
  setRandomMovement(enabled: boolean): Promise<AppSettings>;
  setLanguage(language: string): Promise<AppSettings>;
  /** 开机自动启动开关（Tauri：写系统注册项；预览：仅内存态）。 */
  setAutostart(enabled: boolean): Promise<AppSettings>;
  /** 「开机自启」引导弹窗展示一次后调用：计数 +1（封顶 3）。返回新设置快照。 */
  noteAutostartPromptShown(): Promise<AppSettings>;
  /** 订阅设置变更（settings://changed，托盘或其它入口改动时推送）。Returns unsubscribe. */
  onSettingsChanged(handler: (settings: AppSettings) => void): () => void;
  /** 键盘充能开关（Tauri：全局钩子；预览：页面内 keydown 模拟）。 */
  getKeyboardCapture(): Promise<boolean>;
  setKeyboardCapture(enabled: boolean): Promise<boolean>;
  /** 订阅键帽特效批次（game://keys，≤4/s，纯表现）。Returns unsubscribe. */
  onKeyFx(handler: (event: KeyFxEvent) => void): () => void;
  /** 订阅精力轻量补丁（game://stamina，键盘入账）。Returns unsubscribe. */
  onStaminaPatch(handler: (event: StaminaPatchEvent) => void): () => void;
  /** 订阅经验轻量补丁（game://exp，Token 喂养入账 → 陪伴宠经验）。Returns unsubscribe. */
  onExpPatch(handler: (event: TokenFeedOutcome) => void): () => void;
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
  /** 订阅 achievement://unlocked（成就解锁；前端庆祝 toast + 宠物欢呼）。Returns unsubscribe. */
  onAchievementUnlocked(handler: (payload: AchievementUnlock) => void): () => void;
  /** 手动触发一轮 Steam 同步(outbox 巡检 + 对账)。 */
  steamSyncNow(): Promise<void>;
  /** 立即推一轮云存档(fire-and-forget;窗口关闭/失焦前 flush 用)。SteamCloudSync.md。 */
  steamCloudSyncNow(): Promise<void>;
  /** 导入我的宠物:读整份 Steam 库存,把未绑定宠物物品填进后院空位(高阶优先)。
   *  反复调用幂等不重复导入;后院满时低阶留待认领。预览模式恒 0。 */
  steamImportPets(): Promise<SteamImportSummary>;
  /** 查询一组 itemdef 的社区市场真实行情(人民币);无挂单者缺席。预览模式恒空。 */
  steamMarketPrices(defs: number[]): Promise<Record<number, SteamMarketPrice>>;
  /** 跨账号存档确认重绑(剥离绑定并重打当前账号)。 */
  steamConfirmRebind(): Promise<GameSave>;
  /** 还没有设定图 PNG 缓存的自定义物种(需离屏渲染后 cacheSpeciesPreview 交回)。 */
  missingSpeciesPreviews(): Promise<string[]>;
  /** 上交离屏渲染的物种设定图(base64 PNG);后端落盘并给工坊物品补挂缩略图。 */
  cacheSpeciesPreview(codename: string, pngBase64: string): Promise<void>;
  /** 图鉴换肤(SkinWorkshop.md):skinId = "default" | "local" | "ws:<fileId>",按物种统一生效。 */
  selectSpeciesSkin(codename: string, skinId: string): Promise<GameSave>;
  /** 该物种 petId 的全部工坊上传者(首发在最上)。慢(秒级),调用侧自带 loading + 单飞。 */
  listSkinUploaders(codename: string): Promise<WorkshopUploader[]>;
  /** 安装某上传者的皮肤(下载+校验+入库;不自动选中)。 */
  installWorkshopSkin(codename: string, publishedFileId: string, source?: "first" | "shared"): Promise<GameSave>;
  /** 导入好友分享的皮肤文本(codename 由物品 petId 标签决定)。 */
  importSkinText(text: string): Promise<SkinImportResult>;
  /** 我的皮肤分享文本(仅当本机上传过该物种;剪贴板由调用侧负责)。 */
  getSkinShareText(codename: string): Promise<string>;
  /** 补发布自家皮肤(生成期发布失败/被认领标记压住的本机形象;守卫 origin=local)。 */
  publishOwnSkin(codename: string): Promise<GameSave>;
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
  /** Debug (调试 panel): delete every Workshop item this account published for this game.
   *  Steam-side only + irreversible; leaves the local save (incl. workshopPublished) untouched. */
  debugClearWorkshop(): Promise<WorkshopClearReport>;
  /** Debug (调试 panel): consume every Steam inventory item instance this account owns for this game.
   *  Returns how many were consumed. Steam-side only + irreversible; the outbox may re-mint from the
   *  local save until it's cleared too. */
  debugClearInventory(): Promise<number>;
  /** Preview-only: simulate agent tokens → 陪伴宠经验. Undefined in the Tauri build. */
  debugFeedTokens?(amount: number): Promise<{ save: GameSave; outcome: TokenFeedOutcome }>;
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
  pokeEgg(eggId: string) {
    return invoke<GameSave>("poke_egg", { eggId });
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
  checkAgentConnections() {
    return invoke<AgentConnections>("check_agent_connections");
  }
  connectAgent(provider: "claude" | "codex") {
    return invoke<void>("connect_agent", { provider });
  }
  disconnectAgent(provider: "claude" | "codex") {
    return invoke<void>("disconnect_agent", { provider });
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
  onAchievementUnlocked(handler: (payload: AchievementUnlock) => void) {
    let disposed = false;
    let dispose: (() => void) | undefined;
    void listen<AchievementUnlock>("achievement://unlocked", (event) => handler(event.payload)).then((fn) => {
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
  setAutostart(enabled: boolean) {
    return invoke<AppSettings>("set_autostart", { enabled });
  }
  noteAutostartPromptShown() {
    return invoke<AppSettings>("note_autostart_prompt_shown");
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
  onExpPatch(handler: (event: TokenFeedOutcome) => void) {
    let disposed = false;
    let dispose: (() => void) | undefined;
    void listen<TokenFeedOutcome>("game://exp", (event) => handler(event.payload)).then((fn) => {
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
  /** 立即推一轮云存档（fire-and-forget；窗口关闭/失焦前 flush 用）。 */
  steamCloudSyncNow() {
    return invoke<void>("steam_cloud_sync_now");
  }
  steamImportPets() {
    return invoke<SteamImportSummary>("steam_import_pets");
  }
  steamMarketPrices(defs: number[]) {
    return invoke<Record<number, SteamMarketPrice>>("steam_market_prices", { defs });
  }
  steamConfirmRebind() {
    return invoke<GameSave>("steam_confirm_rebind");
  }
  missingSpeciesPreviews() {
    return invoke<string[]>("missing_species_previews");
  }
  cacheSpeciesPreview(codename: string, pngBase64: string) {
    return invoke<void>("cache_species_preview", { codename, pngBase64 });
  }
  selectSpeciesSkin(codename: string, skinId: string) {
    return invoke<GameSave>("select_species_skin", { codename, skinId });
  }
  listSkinUploaders(codename: string) {
    return invoke<WorkshopUploader[]>("list_skin_uploaders", { codename });
  }
  installWorkshopSkin(codename: string, publishedFileId: string, source?: "first" | "shared") {
    return invoke<GameSave>("install_species_skin", { codename, publishedFileId, source: source ?? null });
  }
  importSkinText(text: string) {
    return invoke<SkinImportResult>("import_skin_from_text", { text });
  }
  getSkinShareText(codename: string) {
    return invoke<string>("get_skin_share_text", { codename });
  }
  publishOwnSkin(codename: string) {
    return invoke<GameSave>("publish_own_skin", { codename });
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
  debugClearWorkshop() {
    return invoke<WorkshopClearReport>("debug_steam_delete_all_workshop");
  }
  debugClearInventory() {
    return invoke<number>("debug_steam_consume_all");
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
  private expHandlers = new Set<(event: TokenFeedOutcome) => void>();
  private settingsHandlers = new Set<(settings: AppSettings) => void>();
  private keyboardEnabled = true;
  // 预览模式没有 Rust 单一真源：设置存内存（keyboardCapture 与 keyboardEnabled 同步）。
  private appSettings: AppSettings = {
    keyboardCapture: true,
    alwaysOnTop: true,
    randomMovement: true,
    language: window.localStorage.getItem("gulugulu.language") ?? "zh",
    // 预览模式无系统注册项：自启态与引导计数仅存内存（供 UI / 弹窗流程演示）。
    autostart: false,
    autostartPromptCount: 0,
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
  pokeEgg(eggId: string) {
    return this.run(() => this.engine.pokeEgg(eggId));
  }
  collectHatched(eggId: string) {
    return this.run(() => this.engine.collectHatched(eggId));
  }
  fusePets(idA: string, idB: string) {
    return this.run(() => this.engine.fusePets(idA, idB));
  }
  checkFusionCli() {
    // ?nocli=1 预演"未检测到 CLI"的拒绝弹窗（消息键协议，展示端 localizeGameMessage 渲染）
    const nocli = new URLSearchParams(window.location.search).has("nocli");
    return Promise.resolve(
      nocli
        ? { available: false, error: "#fusionCliMissingPreview" }
        : { available: true, provider: "claude", version: "mock", path: "preview" },
    );
  }
  // 预览模式连接态：?noagent=1 预演"两家都未登录"（公告板出连接按钮）；
  // ?noagent=claude 只演 claude 未登录。connectAgent 1.2s 后标记已连接、
  // disconnectAgent 立即标记未连接，二者都覆盖 ?noagent 基线，供连/断按钮演示。
  private agentOverride: Record<string, boolean> = {};
  private agentLoggedIn(provider: string) {
    if (provider in this.agentOverride) return this.agentOverride[provider];
    const raw = new URLSearchParams(window.location.search).get("noagent");
    const down = raw != null && (raw === "1" || raw === "" || raw.split(",").includes(provider));
    return !down;
  }
  checkAgentConnections() {
    const claudeIn = this.agentLoggedIn("claude");
    const codexIn = this.agentLoggedIn("codex");
    return Promise.resolve<AgentConnections>({
      claude: {
        provider: "claude",
        installed: true,
        loggedIn: claudeIn,
        version: "mock",
        account: claudeIn ? "preview@local" : null,
      },
      codex: {
        provider: "codex",
        installed: true,
        loggedIn: codexIn,
        version: "mock",
        account: codexIn ? "ChatGPT" : null,
      },
    });
  }
  connectAgent(provider: "claude" | "codex") {
    window.setTimeout(() => {
      this.agentOverride[provider] = true;
    }, 1200);
    return Promise.resolve();
  }
  disconnectAgent(provider: "claude" | "codex") {
    this.agentOverride[provider] = false;
    return Promise.resolve();
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
  setAutostart(enabled: boolean) {
    this.appSettings.autostart = enabled;
    this.emitSettings();
    return Promise.resolve({ ...this.appSettings });
  }
  noteAutostartPromptShown() {
    this.appSettings.autostartPromptCount = Math.min(3, this.appSettings.autostartPromptCount + 1);
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
  onExpPatch(handler: (event: TokenFeedOutcome) => void) {
    this.expHandlers.add(handler);
    return () => this.expHandlers.delete(handler);
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
    // ?steam=on 假装已连接(测图鉴工坊分区:上传者列表/导入/分享;steamId 与
    // mock 上传者表的"本人"行联动);?pendrel=N 演示「放生同步中 ×N」状态行。
    const params = new URLSearchParams(window.location.search);
    const steamOn = params.get("steam") === "on";
    const pendingReleases = steamOn ? Number(params.get("pendrel") ?? "0") || 0 : 0;
    return Promise.resolve({
      mode: steamOn ? "connected" : "unavailable",
      pendingMints: 0,
      pendingReleases,
      unclaimedImports: 0,
      ownerMismatch: false,
      lastSyncAt: null,
      steamId: steamOn ? "76561190000000001" : null,
      appId: 4956830,
      workshopLegalPending: false,
    } satisfies SteamStatus);
  }
  onSteamStatus() {
    return () => {};
  }
  onAchievementUnlocked() {
    // 预览模式无 Steam/成就事件；真机走 TauriBridge 的 achievement://unlocked。
    return () => {};
  }
  steamSyncNow() {
    return Promise.resolve();
  }
  steamCloudSyncNow() {
    // 预览模式无 Steam 云：无操作。
    return Promise.resolve();
  }
  steamImportPets() {
    // 预览模式无 Steam 库存：无可导入项。
    return Promise.resolve({ imported: 0, skippedCapacity: 0, changed: false });
  }
  steamMarketPrices() {
    // 预览模式无网络查价：恒空 → 面板回退本地估价。
    return Promise.resolve({} as Record<number, SteamMarketPrice>);
  }
  steamConfirmRebind() {
    return this.run(() => this.engine.getState());
  }
  missingSpeciesPreviews() {
    // 预览模式无 Steam/无文件系统：永远没有待渲染项。
    return Promise.resolve([] as string[]);
  }
  cacheSpeciesPreview() {
    return Promise.resolve();
  }
  /** 假网络延迟（工坊操作的 loading 态在预览可见）。 */
  private slow<T>(ms: number, fn: () => T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      window.setTimeout(() => {
        try {
          resolve(fn());
        } catch (error) {
          reject(error);
        }
      }, ms);
    });
  }
  selectSpeciesSkin(codename: string, skinId: string) {
    return this.run(() => this.engine.selectSkin(codename, skinId));
  }
  listSkinUploaders(codename: string) {
    const params = new URLSearchParams(window.location.search);
    if (params.has("wsfail")) {
      return this.slow<WorkshopUploader[]>(900, () => {
        throw new Error("mock workshop unreachable");
      });
    }
    if (params.has("wsempty")) return this.slow(600, () => [] as WorkshopUploader[]);
    return this.slow(900, () => this.engine.workshopList(codename));
  }
  installWorkshopSkin(codename: string, publishedFileId: string, source?: "first" | "shared") {
    return this.slow(700, () => this.engine.installSkin(codename, publishedFileId, source ?? "shared"));
  }
  importSkinText(text: string) {
    return this.slow(700, () => this.engine.importSkin(text));
  }
  getSkinShareText(codename: string) {
    return this.run(() => this.engine.shareText(codename));
  }
  publishOwnSkin(codename: string) {
    return this.slow(900, () => this.engine.publishOwn(codename));
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
  debugClearWorkshop() {
    // 预览模式无真实 Steam 工坊：恒「无可删除项」（loading 态借 slow 可见）。
    return this.slow<WorkshopClearReport>(700, () => ({ deleted: 0, failed: 0 }));
  }
  debugClearInventory() {
    // 预览模式无真实 Steam 库存：恒 0（loading 态借 slow 可见）。
    return this.slow<number>(700, () => 0);
  }
  debugFeedTokens(amount: number) {
    return this.run(() => {
      const result = this.engine.feedTokens(amount);
      // 镜像 Rust：入账即 game://exp 轻量补丁（进食演出另行合餐）。
      if (result.outcome.expGained > 0) {
        for (const handler of this.expHandlers) handler(result.outcome);
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
