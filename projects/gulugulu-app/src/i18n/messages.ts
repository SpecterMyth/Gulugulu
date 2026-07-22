// 游戏消息键协议(Rust ↔ mock ↔ UI 三方镜像):
//
//   Rust `#[tauri::command]` / MockGameEngine 抛出的**用户可见**消息一律形如
//     "#<key>"                      —— 无参数
//     "#<key>|a=1|b=xyz"            —— 具名参数(err 类动态透传参数放最后,
//                                      值里出现 "|" 会被并回上一参数)
//   前端所有 toast/错误展示点必须先过 localizeGameMessage(raw, lang)。
//   非 "#" 前缀的字符串原样返回(动态穿透/向后兼容)。
//
// 语义参数约定:
//   recipe=<配方键>   → 渲染前经 recipeLabel 本地化("fire+water" → "火+水";
//                       单元素键 "fire" → "火")
//   species=<codename>→ 渲染前经 titleCase(en)透传;zh 模板应避免依赖此参数直出中文名
//   err=<原样文本>    → Steam/系统错误透传;一旦出现,其后所有片段(含带 "=" 的)
//                       都并回 err(所以 err 必须放最后)。若 err 本身又是 "#key…"
//                       协议串(如包裹层转发内层 Steam 错误),会先递归本地化。
//
// MESSAGES 两语键集必须一致(键漏配会在 en 下回退 zh 模板)。
// zh 模板与后端原文案逐字节一致(动态处用 {arg} 占位)。

import { fmt, type Language } from "./core";
import { recipeLabel, speciesDisplayName, titleCaseCode } from "./species";

export const MESSAGES: Record<Language, Record<string, string>> = {
  zh: {
    // ---- 通用 ----
    notEnoughCoins: "金币不足",
    petNotFound: "找不到这只精灵",
    unknownSpecies: "未知物种",
    unknownSpeciesNamed: "未知物种 {species}",
    eggNotFound: "找不到这颗蛋",
    eggGone: "蛋已不存在",
    // ---- 商店 / 孵化(economy) ----
    eggTierInvalid: "蛋阶非法",
    shopLevelTooLow: "商店等级不足，先升级商店",
    noSuchElementEgg: "没有这种属性的蛋",
    eggDailyCap: "今日「{tier} 阶{recipe}蛋」已达每日孵化上限（{cap}/{cap}），明日再来",
    noMatchingSpecies: "没有对应的精灵",
    shopMaxLevel: "商店已是最高等级",
    slotLocked: "这个孵化槽还没解锁",
    slotOccupied: "这个孵化槽已被占用",
    eggAlreadyIncubating: "这颗蛋已经在孵化中",
    eggNotReady: "还没孵好",
    yardFull: "后院满了，先升级后院或者放生宠物",
    // ---- 设施(facility) ----
    hatcheryMaxLevel: "孵化屋已是最高等级",
    yardMaxLevel: "后院已是最高等级",
    missingUpgradeCost: "缺少升级价格配置",
    lastPetCannotRelease: "最后一只伙伴不能放生",
    // ---- 融合(logic/fusion) ----
    fusionNeedTwoDistinct: "需要两只不同的精灵",
    petANotFound: "找不到精灵 A",
    petBNotFound: "找不到精灵 B",
    fusionPetsNotFound: "找不到要融合的精灵",
    fusionTierMismatch: "必须是同阶精灵才能融合",
    fusionMaxTier: "已达最高阶，无法再融合",
    fusionNeedMaxLevel: "两只精灵都要满级才能融合",
    fusionNeedFee: "金币不足，融合需要手续费",
    fusionDailyCap: "今日「{recipe}」配方融合已达每日上限（{cap}/{cap}），明日再来",
    recipeNoFixedSpecies: "配方 {recipe} 缺少固定物种",
    recipeSlotUnregistered: "配方 {recipe} 槽 {slot} 未注册",
    eggNoPendingFusion: "这颗蛋没有待定的融合",
    codenameTaken: "物种名已被占用：{codename}",
    // ---- 收取/放生/Steam 命令(commands) ----
    eggOpInProgress: "这颗蛋的 Steam 操作进行中，请稍候",
    petOpInProgress: "这只精灵的 Steam 操作进行中，请稍候",
    needSteamForTier2Hatch: "需要连接 Steam 才能孵化 2 阶精灵",
    needSteamForShopEgg: "得先牵上 Steam 的手，才能收下这颗蛋哦 🤝",
    missingTier1Mapping: "缺少该属性的一阶 Steam 映射",
    dropWindowCapped: "这窝蛋今天被你薅到见底啦（{cap}/{cap}），咕噜挂出「明日请早」的牌子先睡了 🦆",
    dropCooldown: "手速太快，咕噜还在给上一颗蛋盖章，喝口水一分钟就回来 ☕",
    dropPlaytimeShort: "游玩时长还没攒够，再陪我玩一小会儿，这颗蛋就该熟了 🥚",
    steamDropFailed: "Steam 那边闹脾气了：{err}（蛋没丢，喘口气再收）",
    steamDropTimeout: "Steam 打了个盹没回话，蛋先替你留着，等它回魂再点收 😴",
    steamItemIdCorrupt: "Steam 物品 id 损坏，请先同步",
    steamExchangeNoItem: "Steam 兑换未发放物品，已取消本次孵化",
    steamExchangeFailed: "Steam 兑换失败：{err}",
    steamConsumeFailed: "Steam 消耗物品失败：{err}",
    steamTimeoutWillVerify: "Steam 响应超时，稍后自动核对",
    fuseBoundPetsUseAi: "已同步 Steam 的精灵请在融合台操作（需要 Steam 兑换）",
    needSteamForRelease: "需要连接 Steam 才能放生此精灵",
    // ---- Steam 基础层(steam.rs / steam_inventory.rs) ----
    steamNotConnected: "Steam 未连接",
    steamPumpExited: "Steam 泵线程已退出",
    splitStackMissingInstance: "拆栈结果缺少新实例",
    splitStackFailed: "拆栈失败：{err}",
    splitStackTimeout: "拆栈超时，稍后自动核对",
    steamIntegrationOff: "Steam 集成已关闭（本地调试模式）",
    steamInventoryUnavailable: "Steam 库存接口不可用",
    steamInventoryStartFailed: "库存调用发起失败",
    steamInventoryOpFailed: "库存操作失败（EResult={err}）",
    steamInventoryTimeout: "读取 Steam 库存超时，稍后再试",
    steamOwnerMismatch: "此存档绑定的是另一个 Steam 账号，请先确认重绑",
    // ---- AI 融合(fusion_gen) ----
    fusionEggExpiredFallback: "孵化完成前未生成完毕，将孵出咕噜鸭",
    unknownParentSpecies: "未知父代物种：{species}",
    fusionCliNotFound: "未检测到本地 Claude Code / Codex CLI",
    providerError: "{provider}：{err}",
    workshopReuse: "复用了创意工坊上的全局形象",
    fusionResolved: "{name}（{code}）诞生了新设定",
    fusionNeedsCli: "融合需要连接本地 Claude Code 或 Codex。{err}",
    materialOpInProgress: "“{species}”正在进行 Steam 操作，请等它完成后再融合",
    materialSyncing: "“{species}”的 Steam 数据仍在同步中，请稍后再尝试融合",
    materialNotOnSteam: "“{species}”还没同步到 Steam，正在等待同步，请稍后再融合",
    fusionNeedsSteam: "融合需要连接 Steam",
    missingSteamMapping: "缺少 Steam 物品映射",
    legacyCustomNotOnSteam: "旧版自定义物种未同步到 Steam，无法在 Steam 模式融合（可在本地模式使用）",
    recipeNoUnionGen: "配方 {recipe} 缺少并集生成器序号",
    steamFuseExchangeNoItem: "Steam 兑换未发放物品，融合已取消",
    // ---- 皮肤系统(skins.rs / logic::skins，SkinWorkshop.md) ----
    skinNotAiSpecies: "只有 AI 融合物种可以换肤",
    skinSpeciesUnknown: "还没获得这个物种",
    skinDefaultUnavailable: "该物种没有可用的默认形态",
    skinNotInstalled: "这款皮肤还没导入",
    skinInvalidId: "皮肤参数不合法",
    skinCapReached: "这个物种的皮肤收藏已满（最多 20 款）",
    skinNeedsSteam: "需要连接 Steam 才能使用创意工坊皮肤",
    skinPetIdMismatch: "皮肤与物种不匹配",
    skinShareTextInvalid: "分享文本看不懂，检查一下是不是漏了字？",
    skinShareUnavailable: "这个形象还没上传创意工坊，暂时无法分享",
    skinProvenanceUnknown: "无法确认这个形象出自本机，不能上传",
    skinAlreadyPublished: "这个形象已经上传过创意工坊",
    skinTooLarge: "皮肤数据过大，已拒绝导入",
    skinNoPetId: "这不是有效的咕噜咕噜皮肤物品",
    skinCollidesCatalog: "皮肤指向的物种与目录物种冲突",
    skinSchemaUnsupported: "皮肤格式版本过新，请先更新游戏",
    skinContentInvalid: "皮肤内容校验未通过",
    // ---- 预览 mock 专用 ----
    mockValidateFailed: "mock 生成校验失败：{err}",
    fusionCliMissingPreview: "Claude Code：未找到命令；Codex：未找到命令（预览 ?nocli=1）",
  },
  en: {
    // ---- Common ----
    notEnoughCoins: "Not enough coins",
    petNotFound: "Pet not found",
    unknownSpecies: "Unknown species",
    unknownSpeciesNamed: "Unknown species {species}",
    eggNotFound: "Egg not found",
    eggGone: "The egg no longer exists",
    // ---- Shop / hatchery (economy) ----
    eggTierInvalid: "Invalid egg tier",
    shopLevelTooLow: "Shop level too low — upgrade the shop first",
    noSuchElementEgg: "No eggs of that element",
    eggDailyCap: "Tier-{tier} {recipe} eggs hit today's hatch cap ({cap}/{cap}) — come back tomorrow",
    noMatchingSpecies: "No matching pet found",
    shopMaxLevel: "The shop is already at max level",
    slotLocked: "That hatchery slot is still locked",
    slotOccupied: "That hatchery slot is already occupied",
    eggAlreadyIncubating: "This egg is already incubating",
    eggNotReady: "Not hatched yet",
    yardFull: "The backyard is full — upgrade it or release a pet",
    // ---- Facilities ----
    hatcheryMaxLevel: "The hatchery is already at max level",
    yardMaxLevel: "The backyard is already at max level",
    missingUpgradeCost: "Missing upgrade cost config",
    lastPetCannotRelease: "You can't release your last companion",
    // ---- Fusion (logic) ----
    fusionNeedTwoDistinct: "Pick two different pets",
    petANotFound: "Pet A not found",
    petBNotFound: "Pet B not found",
    fusionPetsNotFound: "Couldn't find the pets to fuse",
    fusionTierMismatch: "Only pets of the same tier can fuse",
    fusionMaxTier: "Already at the top tier — can't fuse further",
    fusionNeedMaxLevel: "Both pets must be at max level to fuse",
    fusionNeedFee: "Not enough coins for the fusion fee",
    fusionDailyCap: "The {recipe} recipe hit today's fusion cap ({cap}/{cap}) — come back tomorrow",
    recipeNoFixedSpecies: "Recipe {recipe} has no fixed species",
    recipeSlotUnregistered: "Slot {slot} of recipe {recipe} isn't registered",
    eggNoPendingFusion: "This egg has no pending fusion",
    codenameTaken: "Species codename already taken: {codename}",
    // ---- Collect / release / Steam commands ----
    eggOpInProgress: "A Steam operation on this egg is in progress — please wait",
    petOpInProgress: "A Steam operation on this pet is in progress — please wait",
    needSteamForTier2Hatch: "Connect Steam to hatch tier-2 pets",
    needSteamForShopEgg: "Link hands with Steam first to collect this egg 🤝",
    missingTier1Mapping: "Missing the tier-1 Steam mapping for that element",
    dropWindowCapped: "You've cleaned out today's nest ({cap}/{cap}) — Gulu hung a “come back tomorrow” sign and went to sleep 🦆",
    dropCooldown: "Too fast! Gulu is still stamping your last egg — grab a sip of water and come back in a minute ☕",
    dropPlaytimeShort: "Not enough playtime yet — keep me company a bit longer and this egg will be ready 🥚",
    steamDropFailed: "Steam is throwing a tantrum: {err} (your egg is safe — catch your breath and retry)",
    steamDropTimeout: "Steam dozed off mid-reply — I'll hold your egg; collect again once it wakes up 😴",
    steamItemIdCorrupt: "Steam item id corrupted — run a sync first",
    steamExchangeNoItem: "Steam exchange granted no item — this hatch was canceled",
    steamExchangeFailed: "Steam exchange failed: {err}",
    steamConsumeFailed: "Steam item consumption failed: {err}",
    steamTimeoutWillVerify: "Steam timed out — it will be verified automatically later",
    fuseBoundPetsUseAi: "Steam-synced pets must fuse at the fusion table (requires a Steam exchange)",
    needSteamForRelease: "Connect Steam to release this pet",
    // ---- Steam base layer (steam.rs / steam_inventory.rs) ----
    steamNotConnected: "Steam is not connected",
    steamPumpExited: "The Steam worker thread has exited",
    splitStackMissingInstance: "Stack split returned no new instance",
    splitStackFailed: "Stack split failed: {err}",
    splitStackTimeout: "Stack split timed out — it will be verified automatically later",
    steamIntegrationOff: "Steam integration is disabled (local debug mode)",
    steamInventoryUnavailable: "Steam inventory API is unavailable",
    steamInventoryStartFailed: "Failed to start the inventory call",
    steamInventoryOpFailed: "Inventory operation failed (EResult={err})",
    steamInventoryTimeout: "Reading the Steam inventory timed out — try again shortly",
    steamOwnerMismatch: "This save is bound to a different Steam account — confirm the rebind first",
    // ---- AI fusion (fusion_gen) ----
    fusionEggExpiredFallback: "Generation didn't finish before hatching — a Guluduck will hatch instead",
    unknownParentSpecies: "Unknown parent species: {species}",
    fusionCliNotFound: "No local Claude Code / Codex CLI detected",
    providerError: "{provider}: {err}",
    workshopReuse: "Reused this slot's global look from the Steam Workshop",
    fusionResolved: "{name} ({code}) hatched with a brand-new design",
    fusionNeedsCli: "Fusion needs a local Claude Code or Codex CLI. {err}",
    materialOpInProgress: "“{species}” has a Steam operation in progress — wait for it to finish before fusing",
    materialSyncing: "“{species}” is still syncing with Steam — try fusing again shortly",
    materialNotOnSteam: "“{species}” isn't on Steam yet — it's still syncing, try fusing again shortly",
    fusionNeedsSteam: "Fusion requires a Steam connection",
    missingSteamMapping: "Missing Steam item mapping",
    legacyCustomNotOnSteam: "Legacy custom species aren't synced to Steam and can't fuse in Steam mode (still usable in local mode)",
    recipeNoUnionGen: "Recipe {recipe} has no union-generator ordinal",
    steamFuseExchangeNoItem: "Steam exchange granted no item — the fusion was canceled",
    // ---- Skin system (skins.rs / logic::skins, SkinWorkshop.md) ----
    skinNotAiSpecies: "Only AI fusion species can switch skins",
    skinSpeciesUnknown: "You haven't obtained this species yet",
    skinDefaultUnavailable: "This species has no default form available",
    skinNotInstalled: "That skin isn't imported yet",
    skinInvalidId: "Invalid skin parameter",
    skinCapReached: "Skin collection for this species is full (max 20)",
    skinNeedsSteam: "Connect Steam to use Workshop skins",
    skinPetIdMismatch: "This skin doesn't match the species",
    skinShareTextInvalid: "Couldn't read that share text — is part of it missing?",
    skinShareUnavailable: "This look isn't on the Workshop yet, so it can't be shared",
    skinProvenanceUnknown: "Can't confirm this look was made on this machine, so it can't be uploaded",
    skinAlreadyPublished: "This look is already on the Workshop",
    skinTooLarge: "Skin data too large — import rejected",
    skinNoPetId: "Not a valid Gulugulu skin item",
    skinCollidesCatalog: "This skin points at a catalog species — rejected",
    skinSchemaUnsupported: "Skin format is newer than this game version — please update",
    skinContentInvalid: "Skin content failed validation",
    // ---- Preview mock only ----
    mockValidateFailed: "Mock generation failed validation: {err}",
    fusionCliMissingPreview: "Claude Code: command not found; Codex: command not found (preview ?nocli=1)",
  },
};

function parseArgs(pairs: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  let lastKey: string | null = null;
  for (const piece of pairs) {
    const eq = piece.indexOf("=");
    // err 是「最后一个参数 + 原样透传」:一旦开始,后续片段(哪怕带 "=",比如内层
    // 协议串 "#steamInventoryOpFailed|err=Fail" 的参数)全部并回 err。
    if (lastKey !== "err" && eq > 0) {
      lastKey = piece.slice(0, eq);
      args[lastKey] = piece.slice(eq + 1);
    } else if (lastKey) {
      // 值里原本就含 "|"(如 Steam 错误透传)——并回上一参数。
      args[lastKey] = `${args[lastKey]}|${piece}`;
    }
  }
  return args;
}

/** 把 "#key|a=b" 协议消息渲染为当前语言文案;未知键剥掉 "#" 原样返回。 */
export function localizeGameMessage(raw: string, lang: Language): string {
  if (!raw || !raw.startsWith("#")) return raw;
  const [head, ...pairs] = raw.slice(1).split("|");
  const args = parseArgs(pairs);
  if (args.recipe) args.recipe = recipeLabel(args.recipe, lang);
  // species=<codename>（可选伴 nameZh=<中文名> / nameEn=<英文名>）→ 复用全局 speciesDisplayName：
  // zh 出中文名、en 出 AI 专有英文名 nameEn（目录物种 TitleCase codename）。无 nameZh 时退回
  // 旧行为（zh 原样 codename、en TitleCase），保持既有诊断消息不变。
  if (args.species) {
    args.species =
      args.nameZh !== undefined || args.nameEn !== undefined
        ? speciesDisplayName(args.species, lang, args.nameZh || undefined, args.nameEn || undefined)
        : lang === "zh"
          ? args.species
          : titleCaseCode(args.species);
  }
  // 内层错误本身也是协议串(如 "#steamExchangeFailed|err=#steamNotConnected")→ 递归本地化。
  if (args.err && args.err.startsWith("#")) args.err = localizeGameMessage(args.err, lang);
  const template = MESSAGES[lang]?.[head] ?? MESSAGES.zh[head];
  if (!template) return raw.slice(1);
  return fmt(template, args);
}
