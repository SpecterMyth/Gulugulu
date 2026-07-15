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
  SlotSpec,
  SpeciesInfo,
  WanderSnackResult,
} from "../types";
import {
  aiTotalChancePercentFor,
  clickCoinsFor,
  clickExpFor,
  eggPriceFor,
  elementSetKey,
  equivalentEggPriceForInfo,
  expToNext,
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
  tokensPerStaminaFor,
  yardCapacityFor,
} from "./config";
import {
  classifySlot,
  effectiveFrontier,
  frontierM,
  obtainedPrefix,
  rollSlot,
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

/** ?fusionfail=1：假生成永不完成 → 验证"孵化到期兜底孵出咕噜鸭"路径。 */
const isFusionFailRequested: boolean =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("fusionfail");

/** AI 融合蛋兜底孵出的默认物种（与 Rust game::FALLBACK_SPECIES 一致）。 */
const FALLBACK_SPECIES = "guluduck";

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
  return { date, clicks: 0, snackStamina: 0 };
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
    version: 5,
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
    if (!pet) throw new Error("找不到这只精灵");
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
    if (tier < 1) throw new Error("蛋阶非法");
    if (tier > (this.save.shopLevel ?? 1) || tier > shopMaxLevel(config)) {
      throw new Error("商店等级不足，先升级商店");
    }
    if (config.eggPrices[element] == null) throw new Error("没有这种属性的蛋");
    const price = eggPriceFor(config, element, tier);
    if (this.save.coins < price) throw new Error("金币不足");
    const species = rollEggSpecies(
      config,
      this.save,
      element,
      tier,
      Math.floor(Math.random() * 0x100000000),
    );
    if (!species) throw new Error("没有对应的精灵");
    this.save.coins -= price;
    const hatchKind = tier <= 1 ? element : `tier${tier}`;
    const slot = firstFreeSlot(config, this.save);
    this.save.eggs.push({
      id: newId("egg"),
      species,
      tier,
      hatchKind,
      slot,
      hatchAt: slot != null ? now + (config.hatchSeconds[hatchKind] ?? 180) : null,
    });
    return this.commit();
  }

  placeEgg(eggId: string, slot: number): GameSave {
    const config = this.config;
    const now = nowSecs();
    settleAll(config, this.save, now, todayString());
    const slotCount = hatcherySlotCount(config, this.save.hatcheryLevel);
    if (slot >= slotCount) throw new Error("这个孵化槽还没解锁");
    if (usedSlots(this.save).includes(slot)) throw new Error("这个孵化槽已被占用");
    const egg = this.save.eggs.find((e) => e.id === eggId);
    if (!egg) throw new Error("找不到这颗蛋");
    if (egg.slot != null) throw new Error("这颗蛋已经在孵化中");
    egg.slot = slot;
    egg.hatchAt = now + (config.hatchSeconds[egg.hatchKind] ?? 180);
    return this.commit();
  }

  collectHatched(eggId: string): GameSave {
    const config = this.config;
    const now = nowSecs();
    settleAll(config, this.save, now, todayString());
    const index = this.save.eggs.findIndex((e) => e.id === eggId);
    if (index < 0) throw new Error("找不到这颗蛋");
    const egg = this.save.eggs[index];
    if (egg.slot == null || egg.hatchAt == null || now < egg.hatchAt) throw new Error("还没孵好");
    const capacity = yardCapacityFor(config, this.save.yardLevel);
    if (this.save.pets.length >= capacity) throw new Error("后院已满，先去放生腾出位置");
    this.save.eggs.splice(index, 1);
    const tier = this.speciesInfoAny(egg.species)?.tier ?? egg.tier;
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
    if (idA === idB) throw new Error("需要两只不同的精灵");
    const petA = this.save.pets.find((p) => p.id === idA);
    const petB = this.save.pets.find((p) => p.id === idB);
    if (!petA || !petB) throw new Error("找不到要融合的精灵");
    if (petA.tier !== petB.tier) throw new Error("必须是同阶精灵才能融合");
    // 融合 2.0：同阶 1~5 可融（结果 = 亲代阶 +1），两只 6 阶已达顶。
    if (petA.tier < 1 || petA.tier > 5) throw new Error("已达最高阶，无法再融合");
    if (!isMaxLevel(config, petA) || !isMaxLevel(config, petB)) {
      throw new Error("两只精灵都要满级才能融合");
    }
    if (this.save.coins < fusionFeeFor(config, petA.tier)) throw new Error("金币不足，融合需要手续费");
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
    if (!fixed) throw new Error(`配方 ${recipeKey} 缺少固定物种`);

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
      if (!code) throw new Error(`配方 ${recipeKey} 槽 ${outcome.slot} 未注册`);
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
    if (!elementA || !elementB) throw new Error("未知物种");
    return [elementA, elementB];
  }

  private consumeFusionPair(idA: string, idB: string, fee: number) {
    this.save.coins = Math.max(0, this.save.coins - fee);
    this.save.pets = this.save.pets.filter((p) => p.id !== idA && p.id !== idB);
    if (this.save.activePetId === idA || this.save.activePetId === idB) {
      this.save.activePetId = this.save.pets[0]?.id ?? null;
    }
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
    this.consumeFusionPair(idA, idB, plan.fee);
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

    if (plan.kind !== "generate") {
      this.consumeFusionPair(idA, idB, plan.fee);
      const eggId = this.pushFusionEgg(plan.resultSpecies, plan.resultTier, now);
      return { mode: "recipe", save: this.commit(), eggId, species: plan.resultSpecies };
    }

    const parents: [string, string] = [petA.species, petB.species];
    this.consumeFusionPair(idA, idB, plan.fee);
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
      egg.pendingFusion.lastError = "孵化完成前未生成完毕，将孵出咕噜鸭";
      this.commit();
      this.emitFusionProgress({ eggId, phase: "failed", attempt: 1, elapsedSecs, message: egg.pendingFusion.lastError });
      return;
    }

    const composed = this.mockComposeSpec(egg.pendingFusion.parents);
    const validated = validateVisualSpec(composed.spec);
    if (!validated.ok) {
      egg.pendingFusion.status = "failed";
      egg.pendingFusion.lastError = `mock 生成校验失败：${validated.error}`;
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
      message: `${composed.nameZh}（${codename}）诞生了新设定`,
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
    if (level >= config.hatcherySlots.length) throw new Error("孵化屋已是最高等级");
    const cost = config.hatcheryUpgradeCosts[level - 1];
    if (cost == null) throw new Error("缺少升级价格配置");
    if (this.save.coins < cost) throw new Error("金币不足");
    this.save.coins -= cost;
    this.save.hatcheryLevel += 1;
    return this.commit();
  }

  upgradeYard(): GameSave {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    const level = this.save.yardLevel;
    if (level >= config.yardCapacity.length) throw new Error("后院已是最高等级");
    const cost = config.yardUpgradeCosts[level - 1];
    if (cost == null) throw new Error("缺少升级价格配置");
    if (this.save.coins < cost) throw new Error("金币不足");
    this.save.coins -= cost;
    this.save.yardLevel += 1;
    return this.commit();
  }

  upgradeShop(): GameSave {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    const level = Math.max(1, this.save.shopLevel ?? 1);
    const cost = shopUpgradeCost(config, level);
    if (cost == null) throw new Error("商店已是最高等级");
    if (this.save.coins < cost) throw new Error("金币不足");
    this.save.coins -= cost;
    this.save.shopLevel = level + 1;
    return this.commit();
  }

  releasePet(petId: string): ReleasePetResult {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    if (this.save.pets.length <= 1) throw new Error("最后一只伙伴不能放生");
    const pet = this.save.pets.find((p) => p.id === petId);
    if (!pet) throw new Error("找不到这只精灵");
    const info = this.speciesInfoAny(pet.species);
    if (!info) throw new Error("未知物种");
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
    if (!this.save.pets.some((p) => p.id === petId)) throw new Error("找不到这只精灵");
    this.save.activePetId = petId;
    return this.commit();
  }

  advanceTutorial(step: number): GameSave {
    if (step > this.save.tutorialStep) this.save.tutorialStep = step;
    return this.commit();
  }

  /** 漫游零食（镜像 logic_wander_snack）：主宠 +2~5 点精力，受日上限。 */
  wanderSnack(): WanderSnackResult {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    const room = Math.max(0, config.wanderSnackDailyCap - this.save.daily.snackStamina);
    if (room === 0) return { save: this.commit(), staminaGained: 0 };
    const pet = this.save.pets.find((p) => p.id === this.save.activePetId);
    if (!pet) return { save: this.commit(), staminaGained: 0 };
    const min = Math.max(0, config.wanderSnackStaminaMin);
    const max = Math.max(min, config.wanderSnackStaminaMax);
    const rolled = Math.min(room, min + Math.floor(Math.random() * (max - min + 1)));
    const gained = Math.max(0, Math.min(rolled, config.staminaMax - pet.stamina));
    if (gained === 0) return { save: this.commit(), staminaGained: 0 };
    pet.stamina += gained;
    if (pet.exhausted && pet.stamina >= config.wakeThreshold) pet.exhausted = false;
    this.save.daily.snackStamina += gained;
    return { save: this.commit(), staminaGained: gained };
  }

  /** 能量喂养统一入口（镜像 logic_feed_energy）：主宠优先 → 精力最低的
   *  未满宠 → 丢弃；换算余数存每宠缓冲。只产精力，绝不触碰 coins/exp。 */
  feedEnergy(source: "keys" | "tokens", amount: number): { save: GameSave; outcome: EnergyFeedOutcome } {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    const outcome: EnergyFeedOutcome = { perPet: [], staminaFed: 0, wasted: 0, wokePetIds: [] };
    let unitsLeft = Math.max(0, Math.floor(amount));
    while (unitsLeft > 0) {
      const active = this.save.pets.find((p) => p.id === this.save.activePetId);
      const target =
        active && active.stamina < config.staminaMax
          ? active
          : this.save.pets
              .filter((p) => p.stamina < config.staminaMax)
              .sort((a, b) => a.stamina - b.stamina || (a.id < b.id ? -1 : 1))[0];
      if (!target) {
        outcome.wasted += unitsLeft;
        break;
      }
      const rate = Math.max(
        1,
        source === "keys" ? keysPerStaminaFor(config, target.tier) : tokensPerStaminaFor(config, target.tier),
      );
      const bufferKey = source === "keys" ? "keyBuffer" : "tokenBuffer";
      const roomPoints = Math.max(0, config.staminaMax - target.stamina);
      const needUnits = Math.max(0, roomPoints * rate - target[bufferKey]);
      const take = Math.min(unitsLeft, needUnits);
      if (take === 0) {
        outcome.wasted += unitsLeft;
        break;
      }
      target[bufferKey] += take;
      unitsLeft -= take;
      const points = Math.floor(target[bufferKey] / rate);
      target[bufferKey] %= rate;
      if (points > 0) {
        target.stamina = Math.min(config.staminaMax, target.stamina + points);
        if (target.exhausted && target.stamina >= config.wakeThreshold) {
          target.exhausted = false;
          outcome.wokePetIds.push(target.id);
        }
        outcome.staminaFed += points;
        outcome.perPet.push({ petId: target.id, staminaGained: points, staminaAfter: target.stamina });
      }
    }
    return { save: this.commit(), outcome };
  }

  /** Preview-only stand-in for real agent token events（v1.1 tokens→精力）。 */
  feedTokens(amount: number): { save: GameSave; outcome: EnergyFeedOutcome } {
    return this.feedEnergy("tokens", amount);
  }

  /** 键盘充能（浏览器预览由页面内 keydown 驱动，镜像 game::feed_keys）。 */
  feedKeys(count: number): { save: GameSave; outcome: EnergyFeedOutcome } {
    return this.feedEnergy("keys", count);
  }

  /** v1.1：tick 只做精力结算/日期翻转（挂机经验与挂机产金已移除）。 */
  private tick() {
    settleAll(this.config, this.save, nowSecs(), todayString());
    this.commit();
  }
}
