// 预览模式的截图种子存档(仅 !isTauri 时经 ?seed=<name> 注入 localStorage,
// 见 src/preview/shotParams.ts)。用途:商店截图/视觉验收需要一个"养成有声有色"
// 的后院,而 mock 初始档是 0 宠 1 蛋。字段严格镜像 GameSave(version 6 跳过迁移)。

import type { CustomSpeciesEntry, EggInstance, GameConfig, GameSave, PetInstance, SpeciesSkin } from "../types";
import { multiElementRecipesOrdered, slotCodename } from "./fusionSlots";
import { mockSkinSpec, mockWorkshopFileId, mockWorkshopSkin } from "./mockEngine";

function pet(
  config: GameConfig,
  id: string,
  species: string,
  tier: number,
  level: number,
  now: number,
): PetInstance {
  return {
    id,
    species,
    tier,
    level,
    exp: 0,
    stamina: config.staminaMax,
    staminaUpdatedAt: now,
    exhausted: false,
    keyBuffer: 0,
    tokenBuffer: 0,
  };
}

/** 满员富存档:多阶物种、金币充裕、蛋坑三态(孵化中/待收/倒计时)、图鉴过半。 */
function richSave(config: GameConfig, now: number, today: string): GameSave {
  const maxLv = (tier: number) => config.maxLevel[tier - 1] ?? 10;
  const pets: PetInstance[] = [
    pet(config, "seed-kirin", "prismkirin", 6, 42, now),
    pet(config, "seed-loong", "lanternloong", 4, 28, now),
    pet(config, "seed-lion", "liondance", 5, 30, now),
    pet(config, "seed-mana", "manacorn", 5, 18, now),
    pet(config, "seed-tking", "thunderking", 2, maxLv(2), now),
    pet(config, "seed-duck", "guluduck", 1, maxLv(1), now),
    pet(config, "seed-mouse", "voltmouse", 1, 6, now),
    pet(config, "seed-frog", "bubblefrog", 1, 9, now),
    pet(config, "seed-cap", "sproutcap", 1, 8, now),
    pet(config, "seed-peng", "frostpeng", 1, maxLv(1), now),
  ];
  const eggs: EggInstance[] = [
    { id: "seed-egg-t6", species: "prismkirin", tier: 6, hatchKind: "tier6", slot: 0, hatchAt: now + 9999 },
    { id: "seed-egg-t2", species: "guluswan", tier: 2, hatchKind: "tier2", slot: 1, hatchAt: now - 5 },
    { id: "seed-egg-fire", species: "emberfox", tier: 1, hatchKind: "fire", slot: 2, hatchAt: now + 140, shopElement: "fire" },
  ];
  // 图鉴:在册物种全点亮 + 低阶配方补一批,凑"收集过半"的观感。
  const dexObtained: Record<string, number> = {};
  for (const p of pets) dexObtained[p.species] = (dexObtained[p.species] ?? 0) + 1;
  const canonical = Object.values(config.speciesByRecipe ?? {});
  for (const code of canonical) {
    const info = config.species[code];
    const count = info?.elements.length ?? 1;
    if (count <= 2 && dexObtained[code] == null) dexObtained[code] = 1 + ((code.length * 7) % 3);
  }
  dexObtained.crystalwing ??= 1;
  dexObtained.queenbuzz ??= 1;
  dexObtained.guluswan ??= 2;

  // ---- 皮肤系统种子（SkinWorkshop.md）----
  // 现算配方序号（勿写死键名）：ordered[0] 的 1 号槽 = 已生成 AI 变种（带两张
  // 工坊皮肤 + 开局即选中首发皮肤 + 自有上传解锁分享钮）；ordered[1] 的 1 号槽 =
  // 只有导入皮肤、本地未生成（神秘槽「先入库」徽章路径）。
  const ordered = multiElementRecipesOrdered(Object.keys(config.speciesByRecipe ?? {}));
  const customSpecies: Record<string, CustomSpeciesEntry> = {};
  const speciesSkins: Record<string, SpeciesSkin[]> = {};
  const skinSelected: Record<string, string> = {};
  const workshopPublished: Record<string, string> = {};
  const recipeAiSlots: Record<string, string[]> = {};
  if (ordered.length >= 2) {
    const recipeKey = ordered[0];
    const aiCode = slotCodename(0, 1);
    customSpecies[aiCode] = {
      info: {
        nameZh: "焰花鼠丸",
        elements: recipeKey.split("+"),
        colors: ["#E86A4A", "#FFD24A"],
        body: "chimera",
        desc: "预览种子里的 AI 融合变种，用来演示皮肤切换 / 分享 / 上传者列表。",
      },
      visual: mockSkinSpec("#E86A4A", "#FFD24A"),
      parents: ["voltmouse", "emberfox"],
      createdAt: now - 86_400,
      generator: "claude",
      origin: "local",
    };
    recipeAiSlots[recipeKey] = [aiCode];
    dexObtained[aiCode] = 2;
    pets.push(pet(config, "seed-aif", aiCode, 2, 5, now));
    const first = mockWorkshopSkin(aiCode, 1, "焰花鼠丸", now - 3600);
    const shared = mockWorkshopSkin(aiCode, 2, "焰花鼠丸", now - 1800);
    speciesSkins[aiCode] = [first, shared].filter((s): s is SpeciesSkin => s != null);
    if (first) skinSelected[aiCode] = first.id; // 开局即演示「皮肤全场景生效」
    const ownFileId = mockWorkshopFileId(aiCode, 3);
    if (ownFileId) workshopPublished[aiCode] = ownFileId; // 解锁「复制分享文本」
    // 神秘槽先入库：第二个配方的 1 号槽只有导入皮肤，无本体。
    const mysteryCode = slotCodename(1, 1);
    const mysterySkin = mockWorkshopSkin(mysteryCode, 2, "神秘变种", now - 600);
    if (mysterySkin) speciesSkins[mysteryCode] = [mysterySkin];
  }

  return {
    version: 6,
    coins: 2_600_000,
    pets,
    eggs,
    hatcheryLevel: 3,
    yardLevel: 8,
    shopLevel: 4,
    activePetId: "seed-kirin",
    lastSeenProjectTokens: {},
    daily: { date: today, clicks: 0, eggMints: {}, fusionMints: {} },
    tutorialStep: 99,
    tutorialFirstEggBought: true,
    lastSeenAt: now,
    customSpecies,
    dexObtained,
    recipeAiSlots,
    speciesSkins,
    skinSelected,
    workshopPublished,
  };
}

/** 按名字构建种子存档;未知名字返回 null(沿用 mock 默认初始档)。 */
export function buildSeed(
  name: string,
  config: GameConfig,
  now: number,
  today: string,
): GameSave | null {
  if (name === "rich") return richSave(config, now, today);
  return null;
}
