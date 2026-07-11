import type {
  ClickWorkResult,
  DailyCounters,
  EggInstance,
  GameConfig,
  GameSave,
  PetInstance,
  ReleasePetResult,
  WanderPickupResult,
} from "../types";
import {
  baseSpeciesForElement,
  clickCoins,
  equivalentEggPrice,
  expToNext,
  fusionResult,
  hatcherySlotCount,
  isMaxLevel,
  isTestConfigRequested,
  maxLevelForTier,
  yardCapacityFor,
} from "./config";

// Browser-preview implementation of the game rules. The Rust side
// (src-tauri/src/game.rs) is authoritative — this mirrors it 1:1 so the whole
// loop is playable and visually verifiable without the Tauri shell. All
// numbers come from the shared config JSON; only the rule code is duplicated.

const STORAGE_KEY = isTestConfigRequested ? "gulugulu.mock-save.test" : "gulugulu.mock-save";

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
  return { date, tokenExp: 0, overflowCoins: 0, pickupCoins: 0, idleCoins: 0, clickCoins: 0 };
}

function ensureDaily(save: GameSave, today: string) {
  if (save.daily.date !== today) {
    save.daily = emptyDaily(today);
  }
}

function settlePet(config: GameConfig, pet: PetInstance, now: number) {
  const elapsed = now - pet.staminaUpdatedAt;
  if (elapsed > 0 && pet.stamina < config.staminaMax) {
    const regen = Math.floor(elapsed / config.staminaRegenSeconds);
    if (regen > 0) {
      pet.stamina = Math.min(config.staminaMax, pet.stamina + regen);
      pet.staminaUpdatedAt += regen * config.staminaRegenSeconds;
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
    version: 1,
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
    activePetId: null,
    lastSeenProjectExperience: {},
    daily: emptyDaily(today),
    tutorialStep: 0,
    lastSeenAt: now,
  };
}

export class MockGameEngine {
  private save: GameSave;
  private listeners = new Set<(save: GameSave) => void>();
  private tickIndex = 0;

  constructor(private config: GameConfig) {
    this.save = this.load();
    window.setInterval(() => this.tick(), Math.max(1, config.tickSeconds) * 1000);
  }

  private load(): GameSave {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as GameSave;
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
    }
    return this.commit();
  }

  getState(): GameSave {
    settleAll(this.config, this.save, nowSecs(), todayString());
    return this.commit();
  }

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
    const dailyClickCoins = this.save.daily.clickCoins;
    pet.stamina -= config.staminaPerClick;
    let becameExhausted = false;
    if (pet.stamina <= 0) {
      pet.stamina = 0;
      pet.exhausted = true;
      becameExhausted = true;
    }
    const base = clickCoins(config, pet.tier, pet.level);
    let coins = base;
    let softCapTier = 0;
    if (dailyClickCoins >= config.clickSoftCap2) {
      coins = Math.max(1, Math.floor(base / 4));
      softCapTier = 2;
    } else if (dailyClickCoins >= config.clickSoftCap1) {
      coins = Math.max(1, Math.floor(base / 2));
      softCapTier = 1;
    }
    const { applied, leveled } = gainExp(config, pet, config.clickExp);
    this.save.coins += coins;
    this.save.daily.clickCoins += coins;
    return {
      save: this.commit(),
      coinsGained: coins,
      expGained: applied,
      leveledUp: leveled,
      becameExhausted,
      softCapTier,
    };
  }

  buyEgg(element: string): GameSave {
    const config = this.config;
    const now = nowSecs();
    settleAll(config, this.save, now, todayString());
    const price = config.eggPrices[element];
    if (price == null) throw new Error("没有这种属性的蛋");
    if (this.save.coins < price) throw new Error("金币不足");
    const species = baseSpeciesForElement(config, element);
    if (!species) throw new Error("没有对应的初始精灵");
    this.save.coins -= price;
    const slot = firstFreeSlot(config, this.save);
    this.save.eggs.push({
      id: newId("egg"),
      species,
      tier: 1,
      hatchKind: element,
      slot,
      hatchAt: slot != null ? now + (config.hatchSeconds[element] ?? 180) : null,
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
    const tier = config.species[egg.species]?.tier ?? egg.tier;
    const pet: PetInstance = {
      id: newId("pet"),
      species: egg.species,
      tier,
      level: 1,
      exp: 0,
      stamina: config.staminaMax,
      staminaUpdatedAt: now,
      exhausted: false,
    };
    this.save.pets.push(pet);
    if (!this.save.activePetId) this.save.activePetId = pet.id;
    return this.commit();
  }

  fusePets(idA: string, idB: string): GameSave {
    const config = this.config;
    const now = nowSecs();
    settleAll(config, this.save, now, todayString());
    if (idA === idB) throw new Error("需要两只不同的精灵");
    const petA = this.save.pets.find((p) => p.id === idA);
    const petB = this.save.pets.find((p) => p.id === idB);
    if (!petA || !petB) throw new Error("找不到要融合的精灵");
    if (petA.tier !== petB.tier) throw new Error("必须是同阶精灵才能融合");
    if (petA.tier !== 1) throw new Error("2 阶融合将在后续版本开放");
    if (!isMaxLevel(config, petA) || !isMaxLevel(config, petB)) {
      throw new Error("两只精灵都要满级才能融合");
    }
    if (this.save.coins < config.fusionFee) throw new Error("金币不足，融合需要手续费");
    const elementA = config.species[petA.species]?.elements[0];
    const elementB = config.species[petB.species]?.elements[0];
    if (!elementA || !elementB) throw new Error("未知物种");
    const result = fusionResult(config, elementA, elementB);
    if (!result) throw new Error("融合表缺少这个组合");

    this.save.coins -= config.fusionFee;
    this.save.pets = this.save.pets.filter((p) => p.id !== idA && p.id !== idB);
    if (this.save.activePetId === idA || this.save.activePetId === idB) {
      this.save.activePetId = this.save.pets[0]?.id ?? null;
    }
    const slot = firstFreeSlot(config, this.save);
    this.save.eggs.push({
      id: newId("egg"),
      species: result,
      tier: 2,
      hatchKind: "tier2",
      slot,
      hatchAt: slot != null ? now + (config.hatchSeconds.tier2 ?? 1800) : null,
    });
    return this.commit();
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

  releasePet(petId: string): ReleasePetResult {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    if (this.save.pets.length <= 1) throw new Error("最后一只伙伴不能放生");
    const pet = this.save.pets.find((p) => p.id === petId);
    if (!pet) throw new Error("找不到这只精灵");
    const equivalent = equivalentEggPrice(config, pet.species);
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

  wanderPickup(): WanderPickupResult {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    const room = Math.max(0, config.wanderCoinDailyCap - this.save.daily.pickupCoins);
    if (room === 0) return { save: this.commit(), coinsGained: 0 };
    const span = Math.max(1, config.wanderCoinMax - config.wanderCoinMin + 1);
    const amount = Math.min(room, config.wanderCoinMin + Math.floor(Math.random() * span));
    this.save.coins += amount;
    this.save.daily.pickupCoins += amount;
    return { save: this.commit(), coinsGained: amount };
  }

  /** Preview-only stand-in for real agent token events (GDD §3.3 semantics). */
  feedTokens(amount: number): { save: GameSave; petExp: number; coins: number } {
    const config = this.config;
    settleAll(config, this.save, nowSecs(), todayString());
    const capRoom = Math.max(0, config.tokenExpDailyCap - this.save.daily.tokenExp);
    let expBudget = Math.min(amount, capRoom);
    let overflow = amount - expBudget;
    let petExp = 0;

    while (expBudget > 0) {
      const active = this.save.pets.find((p) => p.id === this.save.activePetId);
      const target =
        active && !isMaxLevel(config, active)
          ? active
          : this.save.pets
              .filter((p) => !isMaxLevel(config, p))
              .sort((a, b) => a.tier - b.tier || a.level - b.level || a.exp - b.exp)[0];
      if (!target) {
        overflow += expBudget;
        break;
      }
      const { applied } = gainExp(config, target, expBudget);
      petExp += applied;
      this.save.daily.tokenExp += applied;
      expBudget -= applied;
      if (applied === 0) {
        overflow += expBudget;
        break;
      }
    }

    let coins = 0;
    if (overflow > 0) {
      const coinRoom = Math.max(0, config.overflowCoinDailyCap - this.save.daily.overflowCoins);
      coins = Math.min(overflow, coinRoom);
      this.save.coins += coins;
      this.save.daily.overflowCoins += coins;
    }
    return { save: this.commit(), petExp, coins };
  }

  private tick() {
    const config = this.config;
    this.tickIndex += 1;
    settleAll(config, this.save, nowSecs(), todayString());
    for (const pet of this.save.pets) {
      if (isMaxLevel(config, pet)) continue;
      if (pet.id === this.save.activePetId) {
        gainExp(config, pet, config.mainExpPerTick);
      } else if (config.yardTicksPerExp > 0 && this.tickIndex % config.yardTicksPerExp === 0) {
        gainExp(config, pet, 1);
      }
    }
    if (
      config.coinTicksPerCoin > 0 &&
      this.tickIndex % config.coinTicksPerCoin === 0 &&
      this.save.daily.idleCoins < config.idleCoinDailyCap
    ) {
      this.save.coins += 1;
      this.save.daily.idleCoins += 1;
    }
    this.commit();
  }
}
