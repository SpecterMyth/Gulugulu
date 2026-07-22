import type {
  ChimeraForm,
  ClickWorkResult,
  CustomVisualSpec,
  DailyCounters,
  EggInstance,
  EnergyFeedOutcome,
  FusionProgress,
  FusionStartResult,
  GameConfig,
  GameSave,
  PetInstance,
  ReleasePetResult,
  SkinImportResult,
  SlotSpec,
  SpeciesInfo,
  SpeciesSkin,
  TokenFeedOutcome,
  WorkshopUploader,
} from "../types";
import {
  aiTotalChancePercentFor,
  clickCoinsFor,
  clickExpFor,
  eggDailyMintCap,
  eggPriceFor,
  elementSetKey,
  equivalentEggPriceForInfo,
  expToNext,
  fusionDailyMintCap,
  fusionFeeFor,
  fusionResult,
  hatcherySlotCount,
  isMaxLevel,
  isTestConfigRequested,
  keysPerStaminaFor,
  maxLevelForTier,
  rollEggSpecies,
  shopMaxLevel,
  shopUpgradeCost,
  speciesForSet,
  staminaRegenSecondsFor,
  tokensPerExp,
  yardCapacityFor,
} from "./config";
import {
  classifySlot,
  effectiveFrontier,
  frontierM,
  obtainedPrefix,
  rollSlot,
  slotCodename,
  slotWeights,
  weightsSum,
} from "./fusionSlots";
import fusionCatalog from "./fusionParts.json";
import { validateVisualSpec } from "../sprites/customSpecies";

// Browser-preview implementation of the game rules. The Rust side
// (src-tauri/src/game.rs) is authoritative — this mirrors it 1:1 so the whole
// loop is playable and visually verifiable without the Tauri shell. All
// numbers come from the shared config JSON; only the rule code is duplicated.

const STORAGE_KEY = isTestConfigRequested ? "gulugulu.mock-save.test" : "gulugulu.mock-save";

/** ?fusionfail=1：假生成永不完成 → 验证"孵化到期兜底孵出配方 0 号固有物种"路径。 */
const isFusionFailRequested: boolean =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("fusionfail");

/** AI 融合蛋兜底孵出的默认物种（与 Rust game::FALLBACK_SPECIES 一致）。 */
const FALLBACK_SPECIES = "guluduck";

// --- 皮肤系统 mock 工坊（SkinWorkshop.md 预览镜像） -------------------------

/** mock 本机 SteamID（?steam=on 时 bridge 返回同值 → 上传者列表的「我」行联动）。 */
export const MOCK_SELF_STEAM_ID = "76561190000000001";

/** mock 工坊 fileId 可逆编码：9AABBC = 900000 + 序号AA*1000 + 槽BB*10 + 变体C。
 *  仅覆盖确定性 aif 名（预览种子全用确定性名）；importSkin 据此反解 codename。 */
export function mockWorkshopFileId(codename: string, variant: number): string | null {
  const m = /^aif(\d{2})(\d{2})$/.exec(codename);
  if (!m) return null;
  return String(900000 + Number(m[1]) * 1000 + Number(m[2]) * 10 + variant);
}

function mockCodenameForFileId(fileId: number): { codename: string; variant: number } | null {
  if (fileId < 900000 || fileId >= 960000) return null;
  const rest = fileId - 900000;
  const ordinal = Math.floor(rest / 1000);
  const slot = Math.floor((rest % 1000) / 10);
  const variant = rest % 10;
  if (ordinal > 56 || slot < 1 || slot > 10) return null;
  return { codename: slotCodename(ordinal, slot), variant };
}

/** mock 工坊三个变体的上传者档案（变体 3 = 「我」，与 MOCK_SELF_STEAM_ID 联动）。 */
const MOCK_UPLOADERS: Array<{ steamId: string; persona: string; timeCreated: number; suffix: string; body: string; accent: string }> = [
  { steamId: "76561198000000111", persona: "咕噜大师", timeCreated: 1_750_000_000, suffix: "首发配色", body: "#E8B34A", accent: "#8A5A2B" },
  { steamId: "76561198000000222", persona: "星星收藏家", timeCreated: 1_750_100_000, suffix: "星夜", body: "#5A6BD8", accent: "#F5E08A" },
  { steamId: MOCK_SELF_STEAM_ID, persona: "我自己", timeCreated: 1_750_200_000, suffix: "自制", body: "#67B86B", accent: "#F08FB0" },
];

/** 极简可过 validateVisualSpec 的 chimera 皮肤规格（mock 工坊/预览种子共用）。 */
export function mockSkinSpec(body: string, accent: string): CustomVisualSpec {
  return {
    rig: "chimera",
    scale: 1.12,
    palette: { body, deep: darkenHex(body), belly: "#FFF4DC", accent, accent2: accent },
    eyes: "round",
    floating: false,
    slots: {},
    form: {
      bodyPlan: "round",
      segments: 1,
      bodyW: 1,
      bodyH: 1,
      taper: 0.25,
      headStyle: "merged",
      headScale: 0.85,
      legStyle: "stub",
      legCount: 2,
      armStyle: "nub",
      earStyle: "round",
      floating: false,
    },
  };
}

/** 组一张 mock 工坊皮肤（种子/安装共用；variant 1=首发 2=他人分享 3=我）。 */
export function mockWorkshopSkin(
  codename: string,
  variant: number,
  nameBase: string,
  importedAt: number,
): SpeciesSkin | null {
  const fileId = mockWorkshopFileId(codename, variant);
  if (!fileId) return null;
  const u = MOCK_UPLOADERS[Math.max(0, Math.min(MOCK_UPLOADERS.length - 1, variant - 1))];
  return {
    id: `ws:${fileId}`,
    visual: mockSkinSpec(u.body, u.accent),
    nameZh: `${nameBase}·${u.suffix}`,
    authorSteamId: u.steamId,
    authorPersona: u.persona,
    publishedFileId: fileId,
    timeCreated: u.timeCreated,
    importedAt,
    source: variant === 1 ? "first" : "shared",
  };
}

/** 镜像 skins::parse_share_file_id：URL id= 优先，兜底唯一 6~20 位数字串。 */
function mockParseShareFileId(text: string): number | null {
  const hostAt = text.indexOf("steamcommunity.com");
  if (hostAt >= 0) {
    const idAt = text.indexOf("id=", hostAt);
    if (idAt >= 0) {
      const m = /^\d+/.exec(text.slice(idAt + 3));
      if (m) {
        const id = Number(m[0]);
        return id > 0 ? id : null;
      }
    }
  }
  const runs = text.match(/\d+/g) ?? [];
  const candidates = runs.filter((r) => r.length >= 6 && r.length <= 20);
  if (candidates.length !== 1) return null;
  const id = Number(candidates[0]);
  return id > 0 ? id : null;
}

const RIG_TO_BODY_MOCK: Record<string, string> = {
  duck: "duck",
  fox: "fox",
  mouse: "mouse",
  whale: "frog",
  mushroom: "mushroom",
  yeti: "penguin",
  chimera: "chimera",
};

function darkenHex(hex: string, factor = 0.72): string {
  const value = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : "#888888";
  const channels = [1, 3, 5].map((i) => Math.round(parseInt(value.slice(i, i + 2), 16) * factor));
  return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

let idCounter = 0;

function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(16)}-${idCounter}`;
}

export function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

export function todayString(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function emptyDaily(date: string): DailyCounters {
  return { date, clicks: 0, eggMints: {}, fusionMints: {} };
}

function ensureDaily(save: GameSave, today: string) {
  if (save.daily.date !== today) {
    save.daily = emptyDaily(today);
  }
}

function settlePet(config: GameConfig, pet: PetInstance, now: number) {
  if (pet.staminaUpdatedAt > now) {
    // 时钟回拨防呆（镜像 Rust settle_pet）。
    pet.staminaUpdatedAt = now;
  }
  const regenSeconds = staminaRegenSecondsFor(config, pet.tier);
  const elapsed = now - pet.staminaUpdatedAt;
  if (elapsed > 0 && pet.stamina < config.staminaMax) {
    const regen = Math.floor(elapsed / regenSeconds);
    if (regen > 0) {
      pet.stamina = Math.min(config.staminaMax, pet.stamina + regen);
      pet.staminaUpdatedAt += regen * regenSeconds;
    }
  }
  if (pet.stamina >= config.staminaMax) {
    pet.staminaUpdatedAt = now;
  }
  if (pet.exhausted && pet.stamina >= config.wakeThreshold) {
    pet.exhausted = false;
  }
}

function settleAll(config: GameConfig, save: GameSave, now: number, today: string) {
  ensureDaily(save, today);
  for (const pet of save.pets) settlePet(config, pet, now);
  save.lastSeenAt = now;
}

function gainExp(config: GameConfig, pet: PetInstance, amount: number): { applied: number; leveled: boolean } {
  const maxLevel = maxLevelForTier(config, pet.tier);
  let remaining = amount;
  let applied = 0;
  let leveled = false;
  while (remaining > 0 && pet.level < maxLevel) {
    const needed = expToNext(config, pet.tier, pet.level);
    const room = Math.max(0, needed - pet.exp);
    const take = Math.min(room, remaining);
    pet.exp += take;
    remaining -= take;
    applied += take;
    if (pet.exp >= needed) {
      pet.level += 1;
      pet.exp = 0;
      leveled = true;
    }
  }
  if (pet.level >= maxLevel) pet.exp = 0;
  return { applied, leveled };
}

function usedSlots(save: GameSave): number[] {
  return save.eggs.filter((egg) => egg.slot != null).map((egg) => egg.slot as number);
}

function firstFreeSlot(config: GameConfig, save: GameSave): number | null {
  const slotCount = hatcherySlotCount(config, save.hatcheryLevel);
  const used = usedSlots(save);
  for (let slot = 0; slot < slotCount; slot += 1) {
    if (!used.includes(slot)) return slot;
  }
  return null;
}

function createInitialSave(config: GameConfig, now: number, today: string): GameSave {
  return {
    version: 7,
    coins: config.initialCoins,
    pets: [],
    eggs: [
      {
        id: newId("egg"),
        species: "guluduck",
        tier: 1,
        hatchKind: "tutorial",
        slot: 0,
        hatchAt: now + (config.hatchSeconds.tutorial ?? 60),
      },
    ],
    hatcheryLevel: 1,
    yardLevel: 1,
    shopLevel: 1,
    activePetId: null,
    lastSeenProjectTokens: {},
    daily: emptyDaily(today),
    tutorialStep: 0,
    lastSeenAt: now,
    customSpecies: {},
    dexObtained: {},
    recipeAiSlots: {},
    speciesSkins: {},
    skinSelected: {},
    stats: {},
  };
}

/** v2 → v3 迁移（镜像 Rust game::migrate_save）：精力刻度换挡一次性回满、
 *  daily 换新结构、账本换 token 口径（mock 无 progress 存档，播空基线）。 */
function migrateSave(config: GameConfig, save: GameSave, now: number, today: string) {
  if ((save.version ?? 1) < 3) {
    for (const pet of save.pets) {
      pet.stamina = config.staminaMax;
      pet.staminaUpdatedAt = now;
      pet.exhausted = false;
      pet.keyBuffer = 0;
      pet.tokenBuffer = 0;
    }
    save.daily = emptyDaily(today);
    save.lastSeenProjectTokens = {};
    save.version = 3;
  }
  // v3 → v4（融合 2.0）：图鉴曾获从在册宠物播种（仅 dex 空时，幂等）。
  if ((save.version ?? 1) < 4) {
    save.dexObtained ??= {};
    save.recipeAiSlots ??= {};
    if (Object.keys(save.dexObtained).length === 0) {
      for (const pet of save.pets) {
        save.dexObtained[pet.species] = (save.dexObtained[pet.species] ?? 0) + 1;
      }
    }
    save.version = 4;
  }
  // v4 → v5（FusionRecipeSlots §5，镜像 Rust migrate_save）：从 customSpecies 按
  // (配方键, createdAt) 补写 recipeAiSlots。mock 生成路径本就即时注册，此步为存量存档兜底
  // 兼与 Rust 版本号对齐。只追加不重排、每配方封顶 10、幂等。
  if ((save.version ?? 1) < 5) {
    save.recipeAiSlots ??= {};
    const byRecipe = new Map<string, Array<{ created: number; code: string }>>();
    for (const [code, entry] of Object.entries(save.customSpecies ?? {})) {
      const key = elementSetKey(entry.info.elements);
      if (key.split("+").length < 2) continue; // 单元素不占 AI 阶梯槽
      let arr = byRecipe.get(key);
      if (!arr) byRecipe.set(key, (arr = []));
      arr.push({ created: entry.createdAt ?? 0, code });
    }
    for (const [key, list] of byRecipe) {
      list.sort((a, b) => a.created - b.created || a.code.localeCompare(b.code));
      const slots = (save.recipeAiSlots[key] ??= []);
      for (const { code } of list) {
        if (!slots.includes(code) && slots.length < 10) slots.push(code);
      }
    }
    save.version = 5;
  }
  // v5 → v6（皮肤系统，镜像 Rust migrate_save）：新增 speciesSkins / skinSelected。
  // 存量 customSpecies 不回填 origin（出处不可知；mock 侧同口径）。纯版本推进，幂等。
  if ((save.version ?? 1) < 6) {
    save.speciesSkins ??= {};
    save.skinSelected ??= {};
    save.version = 6;
  }
  save.lastSeenProjectTokens ??= {};
  for (const pet of save.pets) {
    pet.keyBuffer ??= 0;
    pet.tokenBuffer ??= 0;
    if (pet.staminaUpdatedAt > now) pet.staminaUpdatedAt = now;
  }
}

export class MockGameEngine {
  private save: GameSave;
  private listeners = new Set<(save: GameSave) => void>();
  private fusionListeners = new Set<(progress: FusionProgress) => void>();

  constructor(private config: GameConfig) {
    this.save = this.load();
    window.setInterval(() => this.tick(), Math.max(1, config.tickSeconds) * 1000);
    // 启动恢复（镜像 Rust worker）：上一会话遗留的挂起融合蛋重新排队假生成。
    for (const egg of this.save.eggs) {
      if (egg.pendingFusion && egg.pendingFusion.status !== "resolved") {
        egg.pendingFusion.status = "pending";
        this.scheduleMockGeneration(egg.id, egg.pendingFusion.recipeKey);
      }
    }
  }

  private load(): GameSave {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const save = JSON.parse(raw) as GameSave;
        save.customSpecies ??= {};
        save.dexObtained ??= {};
        save.recipeAiSlots ??= {};
        save.speciesSkins ??= {};
        save.skinSelected ??= {};
        migrateSave(this.config, save, nowSecs(), todayString());
        return save;
      }
    } catch {
      // fall through to a fresh save
    }
    const save = createInitialSave(this.config, nowSecs(), todayString());
    this.persistSave(save);
    return save;
  }

  private persistSave(save: GameSave) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  }

  private commit(): GameSave {
    this.persistSave(this.save);
    const snapshot = structuredClone(this.save);
    for (const listener of this.listeners) listener(snapshot);
    return snapshot;
  }

  subscribe(listener: (save: GameSave) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeFusionProgress(listener: (progress: FusionProgress) => void): () => void {
    this.fusionListeners.add(listener);
    return () => this.fusionListeners.delete(listener);
  }

  private emitFusionProgress(progress: FusionProgress) {
    for (const listener of this.fusionListeners) listener(progress);
  }

  /** Wipe the mock save (verification helper). */
  reset(): GameSave {
    this.save = createInitialSave(this.config, nowSecs(), todayString());
    return this.commit();
  }

  /** Debug: grant coins outright. */
  addCoins(amount: number): GameSave {
    this.save.coins += amount;
    return this.commit();
  }

  /** Debug: finish every incubating egg's timer so it can be collected now. */
  hatchNow(): GameSave {
    const now = nowSecs();
    for (const egg of this.save.eggs) {
      if (egg.slot != null) egg.hatchAt = now;
    }
    return this.commit();
  }

  /** Debug: push every pet to its tier's max level and restore full form. */
  maxAllPets(): GameSave {
    for (const pet of this.save.pets) {
      pet.level = maxLevelForTier(this.config, pet.tier);
      pet.exp = 0;
      pet.stamina = this.config.staminaMax;
      pet.exhausted = false;
      pet.keyBuffer = 0;
      pet.tokenBuffer = 0;
    }
    return this.commit();
  }

  /** Debug: drain the active pet to 0 stamina (镜像 debug_drain_stamina)。 */
  drainStamina(): GameSave {
    const now = nowSecs();
    settleAll(this.config, this.save, now, todayString());
    const pet = this.save.pets.find((p) => p.id === this.save.activePetId);
    if (pet) {
      pet.stamina = 0;
      pet.staminaUpdatedAt = now;
      pet.exhausted = true;
    }
    return this.commit();
  }

  getState(): GameSave {
    settleAll(this.config, this.save, nowSecs(), todayString());
    return this.commit();
  }

  /** 镜像 logic_click_work：经济不变量——exp/coins 只从这里进入游戏，
   *  受 dailyClickCap 与精力双重闸门。 */
  clickWork(petId: string): ClickWorkResult {
    const config = this.config;
    const now = nowSecs();
    settleAll(config, this.save, now, todayString());
    const pet = this.save.pets.find((p) => p.id === petId);
    if (!pet) throw new Error("#petNotFound");
    // "exhausted" 是控制流哨兵（App 侧 .includes("exhausted") 拦截），不走 "#key" 协议。
    if (pet.exhausted || pet.stamina < config.staminaPerClick) {
      pet.exhausted = true;
      this.commit();
      throw new Error("exhausted");
    }
    // 日额度用尽 → 纯抚摸模式：不耗精力、无产出（非错误）。
    if (this.save.daily.clicks >= config.dailyClickCap) {
      return {
        save: this.commit(),
        coinsGained: 0,
        expGained: 0,
        leveledUp: false,
        becameExhausted: false,
        dailyCapped: true,
      };
    }
    pet.stamina -= config.staminaPerClick;
    let becameExhausted = false;
    if (pet.stamina <= 0) {
      pet.stamina = 0;
      pet.exhausted = true;
      becameExhausted = true;
    }
    const coins = clickCoinsFor(config, pet.tier, pet.level);
    const { applied, leveled } = gainExp(config, pet, clickExpFor(config, pet.tier));
    this.save.coins += coins;
    this.save.daily.clicks += 1;
    return {
      save: this.commit(),
      coinsGained: coins,
      expGained: applied,
      leveledUp: leveled,
      becameExhausted,
      dailyCapped: false,
    };
  }

  buyEgg(element: string, tier: number): GameSave {
    const config = this.config;
    const now = nowSecs();
    settleAll(config, this.save, now, todayString());
    if (tier < 1) throw new Error("#eggTierInvalid");
    if (tier > (this.save.shopLevel ?? 1) || tier > shopMaxLevel(config)) {
      throw new Error("#shopLevelTooLow");
    }
    if (config.eggPrices[element] == null) throw new Error("#noSuchElementEgg");
    // 每日产出上限（EconomyScaling.md §7.5；限频 generator 的客户端镜像）：达上限拒绝孵化。
    const mintKey = `${element}:${tier}`;
    const cap = eggDailyMintCap(config, tier);
    const mints = (this.save.daily.eggMints ??= {});
    if ((mints[mintKey] ?? 0) >= cap) {
      throw new Error(`#eggDailyCap|recipe=${element}|tier=${tier}|cap=${cap}`);
    }
    const price = eggPriceFor(config, element, tier);
    if (this.save.coins < price) throw new Error("#notEnoughCoins");
    const species = rollEggSpecies(
      config,
      element,
      tier,
      Math.floor(Math.random() * 0x100000000),
    );
    if (!species) throw new Error("#noMatchingSpecies");
    this.save.coins -= price;
    mints[mintKey] = (mints[mintKey] ?? 0) + 1;
    const hatchKind = tier <= 1 ? element : `tier${tier}`;
    const slot = firstFreeSlot(config, this.save);
    // 教学硬编码：首次商店购买固定 30s（OnboardingCoach.md §3.1；镜像 economy.rs）。
    const firstBuy = !this.save.tutorialFirstEggBought;
    const hatchSecs = firstBuy && slot != null ? 30 : config.hatchSeconds[hatchKind] ?? 180;
    if (firstBuy && slot != null) this.save.tutorialFirstEggBought = true;
    this.save.eggs.push({
      id: newId("egg"),
      species,
      tier,
      hatchKind,
      slot,
      hatchAt: slot != null ? now + hatchSecs : null,
      shopElement: element,
    });
    return this.commit();
  }

  placeEgg(eggId: string, slot: number): GameSave {
    const config = this.config;
    const now = nowSecs();
    settleAll(config, this.save, now, todayString());
    const slotCount = hatcherySlotCount(config, this.save.hatcheryLevel);
    if (slot >= slotCount) throw new Error("#slotLocked");
    if (usedSlots(this.save).includes(slot)) throw new Error("#slotOccupied");
    const egg = this.save.eggs.find((e) => e.id === eggId);
    if (!egg) throw new Error("#eggNotFound");
    if (egg.slot != null) throw new Error("#eggAlreadyIncubating");
    egg.slot = slot;
    egg.hatchAt = now + (config.hatchSeconds[egg.hatchKind] ?? 180);
    return this.commit();
  }

  // 催蛋：点击孵化中的蛋，孵化时间 −1s（OnboardingCoach.md #2；镜像 logic_poke_egg）。
  pokeEgg(eggId: string): GameSave {
    const now = nowSecs();
    const egg = this.save.eggs.find((e) => e.id === eggId);
    if (egg && egg.slot != null && egg.hatchAt != null && egg.hatchAt > now) {
      egg.hatchAt = Math.max(now, egg.hatchAt - 1);
    }
    return this.commit();
  }

  collectHatched(eggId: string): GameSave {
    const config = this.config;
    const now = nowSecs();
    settleAll(config, this.save, now, todayString());
    const index = this.save.eggs.findIndex((e) => e.id === eggId);
    if (index < 0) throw new Error("#eggNotFound");
    const egg = this.save.eggs[index];
    if (egg.slot == null || egg.hatchAt == null || now < egg.hatchAt) throw new Error("#eggNotReady");
    const capacity = yardCapacityFor(config, this.save.yardLevel);
    if (this.save.pets.length >= capacity) throw new Error("#yardFull");
    this.save.eggs.splice(index, 1);
    // 镜像 Rust apply_collect（economy.rs）的 `egg.tier.max(1)`：蛋自身的 tier 才是权威阶数。
    // 旧实现让目录物种 tier 抢先（2 阶商店蛋掷中一阶目录物种 emberfox 时会错落成 1 阶），
    // 正是 Rust 侧 2026-07-16 实测修掉的 bug——预览孪生沿用旧规则会掩盖/误报阶数问题。
    const tier = Math.max(1, egg.tier);
    // 图鉴曾获记账（镜像 Rust game::record_species_obtained，孵出即 +1）。
    this.save.dexObtained ??= {};
    this.save.dexObtained[egg.species] = (this.save.dexObtained[egg.species] ?? 0) + 1;
    const pet: PetInstance = {
      id: newId("pet"),
      species: egg.species,
      tier,
      level: 1,
      exp: 0,
      stamina: config.staminaMax,
      staminaUpdatedAt: now,
      exhausted: false,
      keyBuffer: 0,
      tokenBuffer: 0,
    };
    this.save.pets.push(pet);
    if (!this.save.activePetId) this.save.activePetId = pet.id;
    return this.commit();
  }

  /** 物种资料查询：静态目录 → AI 自定义物种（镜像 Rust game::species_info）。 */
  private speciesInfoAny(species: string): SpeciesInfo | undefined {
    return this.config.species[species] ?? this.save.customSpecies[species]?.info;
  }

  /** 融合前提守卫（两条融合路径共用，镜像 logic_validate_fusion_pair）。 */
  private validateFusionPair(idA: string, idB: string): { petA: PetInstance; petB: PetInstance } {
    const config = this.config;
    if (idA === idB) throw new Error("#fusionNeedTwoDistinct");
    const petA = this.save.pets.find((p) => p.id === idA);
    const petB = this.save.pets.find((p) => p.id === idB);
    if (!petA || !petB) throw new Error("#fusionPetsNotFound");
    if (petA.tier !== petB.tier) throw new Error("#fusionTierMismatch");
    // 融合 2.0：同阶 1~5 可融（结果 = 亲代阶 +1），两只 6 阶已达顶。
    if (petA.tier < 1 || petA.tier > 5) throw new Error("#fusionMaxTier");
    if (!isMaxLevel(config, petA) || !isMaxLevel(config, petB)) {
      throw new Error("#fusionNeedMaxLevel");
    }
    if (this.save.coins < fusionFeeFor(config, petA.tier)) throw new Error("#fusionNeedFee");
    // 每日融合上限（镜像 logic_validate_fusion_pair；EconomyScaling.md §7.5）。
    // 传配方**键**（recipe=），显示端 recipeLabel 按语言渲染。
    const recipeKey = elementSetKey([
      ...(this.speciesInfoAny(petA.species)?.elements ?? []),
      ...(this.speciesInfoAny(petB.species)?.elements ?? []),
    ]);
    const cap = fusionDailyMintCap(config, recipeKey.split("+").length);
    if ((this.save.daily.fusionMints?.[recipeKey] ?? 0) >= cap) {
      throw new Error(`#fusionDailyCap|recipe=${recipeKey}|cap=${cap}`);
    }
    return { petA, petB };
  }

  /** 该配方已获得的槽号集合（镜像 game::obtained_slots_for；真源 dexObtained）。 */
  private obtainedSlotsFor(recipeKey: string, fixed: string): Set<number> {
    const set = new Set<number>();
    const has = (code: string) => (this.save.dexObtained?.[code] ?? 0) >= 1;
    if (has(fixed)) set.add(0);
    (this.save.recipeAiSlots?.[recipeKey] ?? []).forEach((code, i) => {
      if (has(code)) set.add(i + 1);
    });
    return set;
  }

  /** 融合计划（镜像 game::plan_fusion）：同物种确定性升阶；异物种走配方槽位阶梯。
   *  `cliAvailable=false`（本地路径）时前沿新槽回退固定物种。 */
  private planFusion(
    petA: PetInstance,
    petB: PetInstance,
    roll: number,
    cliAvailable: boolean,
  ): { resultSpecies: string; resultTier: number; fee: number; recipeKey: string; kind: string; slot?: number } {
    const config = this.config;
    const tier = petA.tier;
    const fee = fusionFeeFor(config, tier);
    const resultTier = tier + 1;
    const elements = [
      ...(this.speciesInfoAny(petA.species)?.elements ?? []),
      ...(this.speciesInfoAny(petB.species)?.elements ?? []),
    ];
    const recipeKey = elementSetKey(elements);
    const elementCount = recipeKey.split("+").length;

    if (petA.species === petB.species) {
      return { resultSpecies: petA.species, resultTier, fee, recipeKey, kind: "sameSpecies" };
    }
    const fixed = speciesForSet(config, elements);
    if (!fixed) throw new Error(`#recipeNoFixedSpecies|recipe=${recipeKey}`);

    const registered = this.save.recipeAiSlots?.[recipeKey]?.length ?? 0;
    const obtained = this.obtainedSlotsFor(recipeKey, fixed);
    const aPercent = aiTotalChancePercentFor(config, elementCount);
    const m = frontierM(obtainedPrefix(obtained));
    const eff = effectiveFrontier(m, registered, cliAvailable);
    const weights = slotWeights(aPercent, eff);
    const total = Math.max(1, weightsSum(weights));
    const outcome = classifySlot(rollSlot(weights, roll % total), registered);

    if (outcome.kind === "reuse") {
      const code = this.save.recipeAiSlots?.[recipeKey]?.[outcome.slot - 1];
      if (!code) throw new Error(`#recipeSlotUnregistered|recipe=${recipeKey}|slot=${outcome.slot}`);
      return { resultSpecies: code, resultTier, fee, recipeKey, kind: "reuse", slot: outcome.slot };
    }
    if (outcome.kind === "generate") {
      // 同步路径无法生成：回退固定物种（cliAvailable 路径由 fuseGenerate 处理）。
      return { resultSpecies: fixed, resultTier, fee, recipeKey, kind: "generate", slot: outcome.slot };
    }
    return { resultSpecies: fixed, resultTier, fee, recipeKey, kind: "fixed" };
  }

  private fusionPairElements(petA: PetInstance, petB: PetInstance): [string, string] {
    const elementA = this.speciesInfoAny(petA.species)?.elements[0];
    const elementB = this.speciesInfoAny(petB.species)?.elements[0];
    if (!elementA || !elementB) throw new Error("#unknownSpecies");
    return [elementA, elementB];
  }

  private consumeFusionPair(idA: string, idB: string, fee: number, recipeKey: string) {
    this.save.coins = Math.max(0, this.save.coins - fee);
    this.save.pets = this.save.pets.filter((p) => p.id !== idA && p.id !== idB);
    if (this.save.activePetId === idA || this.save.activePetId === idB) {
      this.save.activePetId = this.save.pets[0]?.id ?? null;
    }
    // 每日融合计数（镜像 consume_fusion_pair → record_fusion_mint）。
    const mints = (this.save.daily.fusionMints ??= {});
    mints[recipeKey] = (mints[recipeKey] ?? 0) + 1;
  }

  private pushFusionEgg(
    species: string,
    tier: number,
    now: number,
    pendingFusion?: EggInstance["pendingFusion"],
  ): string {
    const slot = firstFreeSlot(this.config, this.save);
    const hatchKind = `tier${tier}`;
    const hatchSecs = this.config.hatchSeconds[hatchKind] ?? this.config.hatchSeconds.tier2 ?? 1800;
    const eggId = newId("egg");
    this.save.eggs.push({
      id: eggId,
      species,
      tier,
      hatchKind,
      slot,
      hatchAt: slot != null ? now + hatchSecs : null,
      ...(pendingFusion ? { pendingFusion } : {}),
    });
    return eggId;
  }

  /** 本地同步融合（镜像 game::logic_fuse_pets）：确定性升阶 / 异物种掷槽位阶梯 →
   *  固定或复用变种；前沿新槽（需生成）回退固定物种（真实生成走 fuseGenerate）。 */
  fusePets(idA: string, idB: string): GameSave {
    const config = this.config;
    const now = nowSecs();
    settleAll(config, this.save, now, todayString());
    const { petA, petB } = this.validateFusionPair(idA, idB);
    const plan = this.planFusion(petA, petB, Math.floor(Math.random() * 0x7fffffff), false);
    this.consumeFusionPair(idA, idB, plan.fee, plan.recipeKey);
    this.pushFusionEgg(plan.resultSpecies, plan.resultTier, now);
    return this.commit();
  }

  /** AI 融合入口（镜像 fusion_gen::fuse_pets_ai）：走配方槽位阶梯（cli 可用）；
   *  掷中前沿新槽 → 先提交后生成（挂起蛋 + ~5s 假生成）；否则确定性固定/复用。 */
  fuseGenerate(idA: string, idB: string): FusionStartResult {
    const config = this.config;
    const now = nowSecs();
    settleAll(config, this.save, now, todayString());
    const { petA, petB } = this.validateFusionPair(idA, idB);
    const plan = this.planFusion(petA, petB, Math.floor(Math.random() * 0x7fffffff), true);

    // #9 首次融合必产经典配方（不走 AI）+ 蛋 1 分钟孵化（镜像 fusion_gen.rs）。
    const firstFusion = !this.save.tutorialFirstFusionDone;
    if (firstFusion || plan.kind !== "generate") {
      this.consumeFusionPair(idA, idB, plan.fee, plan.recipeKey);
      const eggId = this.pushFusionEgg(plan.resultSpecies, plan.resultTier, now);
      if (firstFusion) {
        const egg = this.save.eggs.find((e) => e.id === eggId);
        if (egg?.hatchAt != null) egg.hatchAt = now + 60;
        this.save.tutorialFirstFusionDone = true;
      }
      return { mode: "recipe", save: this.commit(), eggId, species: plan.resultSpecies };
    }

    const parents: [string, string] = [petA.species, petB.species];
    this.consumeFusionPair(idA, idB, plan.fee, plan.recipeKey);
    // 挂起蛋兜底 = 并集固定物种（plan.resultSpecies 已是 fixed）。
    const eggId = this.pushFusionEgg(plan.resultSpecies, plan.resultTier, now, {
      parents,
      recipeKey: plan.recipeKey,
      requestedAt: now,
      attempts: 0,
      status: "pending",
    });
    const save = this.commit();
    this.scheduleMockGeneration(eggId, plan.recipeKey);
    return { mode: "ai", save, eggId };
  }

  /** 假生成：2s 后进入 generating，5s 后出结果（?fusionfail=1 时永不完成）。 */
  private scheduleMockGeneration(eggId: string, recipeKey: string) {
    if (isFusionFailRequested) return;
    const started = Date.now();
    const elapsed = () => Math.floor((Date.now() - started) / 1000);
    window.setTimeout(() => {
      const egg = this.save.eggs.find((e) => e.id === eggId);
      if (!egg?.pendingFusion || egg.pendingFusion.status === "resolved") return;
      egg.pendingFusion.status = "generating";
      egg.pendingFusion.attempts += 1;
      this.commit();
      this.emitFusionProgress({
        eggId,
        phase: "generating",
        provider: "claude",
        attempt: 1,
        elapsedSecs: elapsed(),
      });
    }, 2000);
    window.setTimeout(() => {
      this.resolveMockFusion(eggId, recipeKey, elapsed());
    }, 5000);
  }

  private resolveMockFusion(eggId: string, recipeKey: string, elapsedSecs: number) {
    const egg = this.save.eggs.find((e) => e.id === eggId);
    if (!egg?.pendingFusion || egg.pendingFusion.status === "resolved") return;
    const now = nowSecs();
    if (egg.hatchAt != null && now >= egg.hatchAt) {
      egg.pendingFusion.status = "failed";
      egg.pendingFusion.lastError = "#fusionEggExpiredFallback";
      this.commit();
      this.emitFusionProgress({ eggId, phase: "failed", attempt: 1, elapsedSecs, message: egg.pendingFusion.lastError });
      return;
    }

    const composed = this.mockComposeSpec(egg.pendingFusion.parents);
    const validated = validateVisualSpec(composed.spec);
    if (!validated.ok) {
      egg.pendingFusion.status = "failed";
      egg.pendingFusion.lastError = `#mockValidateFailed|err=${validated.error}`;
      this.commit();
      this.emitFusionProgress({ eggId, phase: "failed", attempt: 1, elapsedSecs, message: egg.pendingFusion.lastError });
      return;
    }

    let codename = `aif${Date.now().toString(16).slice(-6)}`;
    while (this.config.species[codename] || this.save.customSpecies[codename]) {
      codename = `aif${Math.floor(Math.random() * 0xffffff).toString(16)}`;
    }
    const [parentA, parentB] = egg.pendingFusion.parents;
    // 融合 2.0：AI 变种元素 = 双亲并集（= recipeKey），归入正确配方槽。
    const elements = recipeKey.split("+");

    this.save.customSpecies[codename] = {
      info: {
        nameZh: composed.nameZh,
        // 不带 tier：变种可存在于多阶，阶数由蛋（结果阶）驱动（collectHatched 用 egg.tier）。
        elements,
        colors: [validated.spec.palette.body, validated.spec.palette.accent],
        body: RIG_TO_BODY_MOCK[validated.spec.rig] ?? validated.spec.rig,
        desc: composed.desc,
      },
      visual: validated.spec,
      parents: [parentA, parentB],
      createdAt: now,
      generator: "mock",
      // 镜像 Rust commit_design：本机生成 → origin=local（分享/补发布资格依据）。
      origin: "local",
    };
    // 注册 AI 变种槽（FusionRecipeSlots §5：生成即写 recipeAiSlots，封顶 10）。
    this.save.recipeAiSlots ??= {};
    const slots = (this.save.recipeAiSlots[recipeKey] ??= []);
    if (!slots.includes(codename) && slots.length < 10) slots.push(codename);
    egg.species = codename;
    egg.pendingFusion.status = "resolved";
    egg.pendingFusion.lastError = null;
    this.commit();
    this.emitFusionProgress({
      eggId,
      phase: "resolved",
      provider: "claude",
      attempt: 1,
      elapsedSecs,
      message: `#fusionResolved|name=${composed.nameZh}|code=${codename}`,
    });
  }

  /** 假设计（镜像 fusion_gen 的 chimera 提示词意图）：随机搭一个参数化身体
   *  form（剪影与双亲无关）、父 A 主色 + 父 B 点缀色、可选 1 个元素点缀件，
   *  并固定塞一个自定义 ShapeNode 件覆盖渲染路径。 */
  private mockComposeSpec(parents: string[]): { spec: CustomVisualSpec; nameZh: string; desc: string } {
    const infoA = this.speciesInfoAny(parents[0]);
    const infoB = this.speciesInfoAny(parents[1]);

    const body = infoA?.colors[0] ?? "#F5C542";
    const accent = infoB?.colors[0] ?? "#8FD8E8";
    const palette = {
      body,
      deep: darkenHex(body),
      belly: "#FFF4DC",
      accent,
      accent2: infoA?.colors[1] ?? accent,
    };

    // 预览假设计也走 6 种动物体型（镜像真实生成的 bodyPlan 优先原则）。
    const bodyPlan = pick([
      "round",
      "upright",
      "quadruped",
      "long",
      "floaty",
      "bighead",
    ]) as ChimeraForm["bodyPlan"];
    const floating = bodyPlan === "floaty";
    const form: ChimeraForm = {
      bodyPlan,
      segments: bodyPlan === "long" ? pick([2, 3]) : 1,
      bodyW: 0.8 + Math.random() * 0.45,
      bodyH: 0.85 + Math.random() * 0.4,
      taper: Math.random() * 0.6,
      headStyle: pick(["merged", "merged", "perched"]),
      headScale: 0.7 + Math.random() * 0.3,
      legStyle: floating ? "none" : bodyPlan === "quadruped" ? pick(["stub", "tall"]) : pick(["stub", "stub", "tall"]),
      legCount: bodyPlan === "quadruped" ? 4 : pick([2, 2, 4]),
      armStyle: bodyPlan === "floaty" ? pick(["flipper", "wing"]) : pick(["none", "nub", "nub", "wing", "flipper"]),
      earStyle: pick(["none", "round", "point", "long", "fin"]),
      floating,
    };

    // 可选：从某个父代元素抽 1 个现成点缀件（挂在非 marking 槽）
    const slots: Record<string, SlotSpec> = {};
    const partSlotOf = (partId: string): string | undefined =>
      Object.entries(fusionCatalog.slots as Record<string, Record<string, string>>).find(
        ([, parts]) => partId in parts,
      )?.[0];
    const hints = fusionCatalog.elementHints as Record<string, { parts: string[]; colors: string[] }>;
    const element = pick([infoA, infoB])?.elements[0] ?? "normal";
    const candidates = [...(hints[element]?.parts ?? [])].sort(() => Math.random() - 0.5);
    for (const partId of candidates) {
      const slotName = partSlotOf(partId);
      if (slotName && slotName !== "marking") {
        slots[slotName] = partId;
        break;
      }
    }
    // 固定一个自定义部件：胸口爱心斑（覆盖 ShapeNode 渲染路径）
    slots.marking = {
      kind: "custom",
      nodes: [
        {
          type: "path",
          d: "M0 -2 C-4 -9 -13 -8 -13 -1 C-13 5 -5 9 0 13 C5 9 13 5 13 -1 C13 -8 4 -9 0 -2 Z",
          fill: "$accent",
          opacity: 0.85,
        },
        { type: "circle", cx: 16, cy: -10, r: 3, fill: "$accent2", opacity: 0.7 },
      ],
    };

    // 角色专属打工粒子（镜像真实生成的 workFx 必填要求）
    const workFx = {
      particles: [
        {
          nodes: [
            {
              type: "path" as const,
              d: "M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z",
              fill: "$accent",
              stroke: "$outline",
              strokeWidth: 1.8,
            },
          ],
        },
        {
          nodes: [
            { type: "circle" as const, cx: 0, cy: 0, r: 6, fill: "$belly", opacity: 0.6, stroke: "$accent2", strokeWidth: 2 },
            { type: "circle" as const, cx: -2, cy: -2, r: 1.6, fill: "#FFFFFF", opacity: 0.9 },
          ],
        },
      ],
    };

    const nameA = infoA?.nameZh ?? "神秘";
    const nameB = infoB?.nameZh ?? "生物";
    const nameZh = `${nameA.slice(0, 1)}${nameB.slice(-1)}${pick(["宝", "灵", "崽", "怪"])}`;
    const desc = `由${nameA}和${nameB}融合诞生的新生命，正在熟悉自己的新形态`;

    return {
      spec: {
        rig: "chimera",
        scale: 1.12,
        palette,
        eyes: pick(fusionCatalog.eyes as string[]),
        toolId: pick(Object.keys(fusionCatalog.tools)),
        floating,
        slots,
        form,
        workFx,
      },
      nameZh,
      desc,
    };
  }

  upgradeHatchery(): GameSave {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    const level = this.save.hatcheryLevel;
    if (level >= config.hatcherySlots.length) throw new Error("#hatcheryMaxLevel");
    const cost = config.hatcheryUpgradeCosts[level - 1];
    if (cost == null) throw new Error("#missingUpgradeCost");
    if (this.save.coins < cost) throw new Error("#notEnoughCoins");
    this.save.coins -= cost;
    this.save.hatcheryLevel += 1;
    return this.commit();
  }

  upgradeYard(): GameSave {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    const level = this.save.yardLevel;
    if (level >= config.yardCapacity.length) throw new Error("#yardMaxLevel");
    const cost = config.yardUpgradeCosts[level - 1];
    if (cost == null) throw new Error("#missingUpgradeCost");
    if (this.save.coins < cost) throw new Error("#notEnoughCoins");
    this.save.coins -= cost;
    this.save.yardLevel += 1;
    return this.commit();
  }

  upgradeShop(): GameSave {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    const level = Math.max(1, this.save.shopLevel ?? 1);
    const cost = shopUpgradeCost(config, level);
    if (cost == null) throw new Error("#shopMaxLevel");
    if (this.save.coins < cost) throw new Error("#notEnoughCoins");
    this.save.coins -= cost;
    this.save.shopLevel = level + 1;
    return this.commit();
  }

  releasePet(petId: string): ReleasePetResult {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    if (this.save.pets.length <= 1) throw new Error("#lastPetCannotRelease");
    const pet = this.save.pets.find((p) => p.id === petId);
    if (!pet) throw new Error("#petNotFound");
    const info = this.speciesInfoAny(pet.species);
    if (!info) throw new Error("#unknownSpecies");
    const equivalent = equivalentEggPriceForInfo(config, info, pet.tier);
    const refund =
      Math.floor(equivalent * config.releaseRefundRate) + config.releaseRefundPerLevel * pet.level;
    this.save.pets = this.save.pets.filter((p) => p.id !== petId);
    if (this.save.activePetId === petId) {
      this.save.activePetId = this.save.pets[0]?.id ?? null;
    }
    this.save.coins += refund;
    return { save: this.commit(), refund };
  }

  setActivePet(petId: string): GameSave {
    if (!this.save.pets.some((p) => p.id === petId)) throw new Error("#petNotFound");
    this.save.activePetId = petId;
    return this.commit();
  }

  advanceTutorial(step: number): GameSave {
    if (step > this.save.tutorialStep) this.save.tutorialStep = step;
    return this.commit();
  }

  /** 键盘充能（镜像 logic_feed_keys，2026-07-21 机制修订）：只喂当前陪伴宠，
   *  不再溢出给其他宠；陪伴宠缺席/满管时按键浪费。只产精力，绝不触碰 coins/exp。 */
  feedKeys(count: number): { save: GameSave; outcome: EnergyFeedOutcome } {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    const outcome: EnergyFeedOutcome = { perPet: [], staminaFed: 0, wasted: 0, wokePetIds: [] };
    const units = Math.max(0, Math.floor(count));
    if (units === 0) return { save: this.commit(), outcome };
    const active = this.save.pets.find((p) => p.id === this.save.activePetId);
    const target = active && active.stamina < config.staminaMax ? active : undefined;
    if (!target) {
      outcome.wasted = units;
      return { save: this.commit(), outcome };
    }
    const rate = Math.max(1, keysPerStaminaFor(config, target.tier));
    const roomPoints = Math.max(0, config.staminaMax - target.stamina);
    const needUnits = Math.max(0, roomPoints * rate - target.keyBuffer);
    const take = Math.min(units, needUnits);
    outcome.wasted = units - take;
    target.keyBuffer += take;
    const points = Math.floor(target.keyBuffer / rate);
    target.keyBuffer %= rate;
    if (points > 0) {
      target.stamina = Math.min(config.staminaMax, target.stamina + points);
      if (target.exhausted && target.stamina >= config.wakeThreshold) {
        target.exhausted = false;
        outcome.wokePetIds.push(target.id);
      }
      outcome.staminaFed += points;
      outcome.perPet.push({ petId: target.id, staminaGained: points, staminaAfter: target.stamina });
    }
    return { save: this.commit(), outcome };
  }

  /** Token 喂养（镜像 logic_feed_tokens，2026-07-21 起 Token → **经验**）：
   *  加权 Token 单位折算经验只喂陪伴宠；满级/缺席整段浪费，绝不溢给其他宠。
   *  Preview-only stand-in for real agent token events。 */
  feedTokens(amount: number): { save: GameSave; outcome: TokenFeedOutcome } {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    const outcome: TokenFeedOutcome = {
      petId: null,
      expGained: 0,
      leveledUp: false,
      levelAfter: 0,
      expAfter: 0,
      wasted: 0,
      fedBreakdown: { input: 0, cacheCreate: 0, cacheRead: 0, output: 0 },
    };
    const units = Math.max(0, Math.floor(amount));
    if (units === 0) return { save: this.commit(), outcome };
    const pet = this.save.pets.find((p) => p.id === this.save.activePetId);
    if (!pet) {
      outcome.wasted = units;
      return { save: this.commit(), outcome };
    }
    outcome.petId = pet.id;
    if (isMaxLevel(config, pet)) {
      // 满级也不给别人：整段浪费、缓冲清零（镜像 Rust）。
      pet.tokenBuffer = 0;
      outcome.wasted = units;
      outcome.levelAfter = pet.level;
      return { save: this.commit(), outcome };
    }
    const rate = tokensPerExp(config, pet.tier);
    pet.tokenBuffer += units;
    const expPoints = Math.floor(pet.tokenBuffer / rate);
    pet.tokenBuffer %= rate;
    if (expPoints > 0) {
      const { applied, leveled } = gainExp(config, pet, expPoints);
      outcome.expGained = applied;
      outcome.leveledUp = leveled;
      outcome.wasted = (expPoints - applied) * rate;
      if (isMaxLevel(config, pet)) pet.tokenBuffer = 0;
    }
    outcome.levelAfter = pet.level;
    outcome.expAfter = pet.exp;
    return { save: this.commit(), outcome };
  }

  /** v1.1：tick 只做精力结算/日期翻转（挂机经验与挂机产金已移除）。 */
  private tick() {
    settleAll(this.config, this.save, nowSecs(), todayString());
    this.commit();
  }

  // --- 皮肤系统（镜像 Rust logic::skins + skins.rs 命令层；SkinWorkshop.md） ---

  /** 该物种基础显示名（皮肤卡命名用）。 */
  private skinBaseName(codename: string): string {
    return this.save.customSpecies[codename]?.info.nameZh ?? "神秘变种";
  }

  /** 换肤（镜像 logic_select_skin）："local" 删键；default 需配方固定物种；
   *  ws:* 需已导入；目录固定物种拒绝。 */
  selectSkin(codename: string, skinId: string): GameSave {
    if (this.config.species[codename]) throw new Error("#skinNotAiSpecies");
    if (skinId === "local") {
      if (this.save.skinSelected) delete this.save.skinSelected[codename];
      return this.commit();
    }
    const entry = this.save.customSpecies[codename];
    if (!entry) throw new Error("#skinSpeciesUnknown");
    if (skinId === "default") {
      if (!speciesForSet(this.config, entry.info.elements)) throw new Error("#skinDefaultUnavailable");
    } else if (skinId.startsWith("ws:")) {
      const installed = (this.save.speciesSkins?.[codename] ?? []).some((s) => s.id === skinId);
      if (!installed) throw new Error("#skinNotInstalled");
    } else {
      throw new Error("#skinInvalidId");
    }
    (this.save.skinSelected ??= {})[codename] = skinId;
    return this.commit();
  }

  /** 假工坊上传者列表：每个确定性槽固定 3 条（首发/他人/我），installed 与
   *  本机收藏联动。旧式 hex codename 无假条目（返回空 = 空态展示）。 */
  workshopList(codename: string): WorkshopUploader[] {
    const installed = new Set((this.save.speciesSkins?.[codename] ?? []).map((s) => s.publishedFileId));
    const rows: WorkshopUploader[] = [];
    for (let variant = 1; variant <= MOCK_UPLOADERS.length; variant += 1) {
      const fileId = mockWorkshopFileId(codename, variant);
      if (!fileId) return [];
      const u = MOCK_UPLOADERS[variant - 1];
      rows.push({
        publishedFileId: fileId,
        authorSteamId: u.steamId,
        authorPersona: u.persona,
        timeCreated: u.timeCreated,
        title: `${this.skinBaseName(codename)}·${u.suffix}`,
        previewUrl: null,
        isFirst: variant === 1,
        installed: installed.has(fileId),
        isSelf: u.steamId === MOCK_SELF_STEAM_ID,
      });
    }
    return rows;
  }

  /** 安装皮肤（镜像 install_species_skin：下载→校验→入库，去重刷新、封顶 20）。 */
  installSkin(codename: string, publishedFileId: string, source: "first" | "shared"): GameSave {
    const decoded = mockCodenameForFileId(Number(publishedFileId));
    if (!decoded || decoded.codename !== codename) throw new Error("#skinPetIdMismatch");
    this.installDecodedSkin(decoded.codename, decoded.variant, publishedFileId, source);
    return this.commit();
  }

  private installDecodedSkin(
    codename: string,
    variant: number,
    publishedFileId: string,
    source: "first" | "shared",
  ): { skinId: string; duplicate: boolean; nameZh: string } {
    const built = mockWorkshopSkin(codename, variant, this.skinBaseName(codename), nowSecs());
    if (!built) throw new Error("#skinContentInvalid");
    const skin: SpeciesSkin = { ...built, publishedFileId, id: `ws:${publishedFileId}`, source };
    const nameZh = skin.nameZh;
    const list = ((this.save.speciesSkins ??= {})[codename] ??= []);
    const existing = list.find((s) => s.publishedFileId === publishedFileId);
    if (existing) {
      existing.visual = skin.visual;
      existing.nameZh = skin.nameZh;
      existing.importedAt = skin.importedAt;
      existing.authorPersona = skin.authorPersona;
      return { skinId: skin.id, duplicate: true, nameZh };
    }
    if (list.length >= 20) throw new Error("#skinCapReached");
    list.push(skin);
    return { skinId: skin.id, duplicate: false, nameZh };
  }

  /** 导入分享文本（镜像 import_skin_from_text：codename 由 fileId 反解 = 假 petId 标签）。 */
  importSkin(text: string): SkinImportResult {
    const fileId = mockParseShareFileId(text);
    if (fileId == null) throw new Error("#skinShareTextInvalid");
    const decoded = mockCodenameForFileId(fileId);
    if (!decoded) throw new Error("#skinContentInvalid");
    if (this.config.species[decoded.codename]) throw new Error("#skinCollidesCatalog");
    const { skinId, duplicate, nameZh } = this.installDecodedSkin(
      decoded.codename,
      decoded.variant,
      String(fileId),
      "shared",
    );
    return { save: this.commit(), codename: decoded.codename, skinId, nameZh, duplicate };
  }

  /** 我的分享文本（镜像 get_skin_share_text：仅本机上传过的物种）。 */
  shareText(codename: string): string {
    const fileId = this.save.workshopPublished?.[codename];
    if (!fileId) throw new Error("#skinShareUnavailable");
    const nameZh = this.skinBaseName(codename);
    return `【咕噜咕噜】皮肤分享：${nameZh} https://steamcommunity.com/sharedfiles/filedetails/?id=${fileId} （复制整段文本，在游戏图鉴点「导入皮肤」粘贴即可）`;
  }

  /** 补发布自家皮肤（镜像 publish_own_skin：守卫 origin=local + 未有真 fileId）。 */
  publishOwn(codename: string): GameSave {
    const existing = this.save.workshopPublished?.[codename];
    if (existing) throw new Error("#skinAlreadyPublished");
    const entry = this.save.customSpecies[codename];
    if (!entry) throw new Error("#skinSpeciesUnknown");
    if (entry.origin !== "local") throw new Error("#skinProvenanceUnknown");
    const fileId = mockWorkshopFileId(codename, 3) ?? String(950000 + Math.floor(Math.random() * 9999));
    (this.save.workshopPublished ??= {})[codename] = fileId;
    return this.commit();
  }
}
