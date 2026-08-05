import type { UiMode } from "../../game/GamePanels";
import { hatcherySlotCount, maxLevelForTier } from "../../game/config";
import type { Language } from "../../i18n/core";
import { GENERATED_RUNTIME_LOCALES } from "../../i18n/generatedLocales";
import type { GameConfig, GameSave } from "../../types";
import {
  ONBOARDING_EN_COPY,
  ONBOARDING_STEP_IDS,
  ONBOARDING_UI_EN,
  ONBOARDING_UI_ZH,
  onboardingLanguageFromStorage,
  type OnboardingStepId,
} from "./onboardingCopy";

export type OnboardingGesture = "tap" | "rapidTap" | "keys" | "moveKeys" | "drop" | "arrow" | "ring";

export type OnboardingDirective = {
  step: string;
  chapter: string;
  label: string;
  targetKey?: string;
  gesture: OnboardingGesture;
  ring: boolean;
  action: "target" | "ack" | "radar" | "navigate";
  cta?: string;
  requiredMode?: UiMode;
  progress: string;
};

type Runtime = {
  uiMode: UiMode;
  nearPetId: string | null;
  nearShop: boolean;
  nearMarket: boolean;
  fusionModalOpen: boolean;
};

const COPY: Record<string, Omit<OnboardingDirective, "step" | "progress">> = {
  A01: { chapter: "破壳入职", label: "点这颗发光的蛋，把同事从壳里批准出来。", targetKey: "egg", gesture: "tap", ring: true, action: "target", requiredMode: "pet" },
  A02: { chapter: "破壳入职", label: "点它一下。对，入职第一天就安排工作。", targetKey: "pet", gesture: "tap", ring: false, action: "target", requiredMode: "pet" },
  A03: { chapter: "破壳入职", label: "继续点到 20 次：每次工作都会增加经验和金币。亲手把它点过试用期。", targetKey: "pet", gesture: "rapidTap", ring: false, action: "target", requiredMode: "pet" },
  A04: { chapter: "破壳入职", label: "你赚了金币和经验，也花了精力。资本主义三件套，齐了。", gesture: "ring", ring: false, action: "ack", cta: "知道了" },
  A05: { chapter: "破壳入职", label: "再点它一下，打开菜单。它身上没有右键菜单，只有脾气。", targetKey: "pet", gesture: "tap", ring: false, action: "target", requiredMode: "pet" },
  A06: { chapter: "破壳入职", label: "点【后院】。真正的麻烦都堆在那里。", targetKey: "menuBackyard", gesture: "tap", ring: true, action: "target", requiredMode: "menu" },
  A07: { chapter: "后院驾照", label: "按 D 或 → 往右走。", targetKey: "char", gesture: "moveKeys", ring: false, action: "target", requiredMode: "backyard" },
  A08: { chapter: "后院驾照", label: "再按 A 或 ← 往左走。你已超越大部分寻路 AI。", targetKey: "char", gesture: "moveKeys", ring: false, action: "target", requiredMode: "backyard" },
  A09: { chapter: "后院驾照", label: "去左边的孵化区。按键走，点地面也能走。", targetKey: "hatcheryPoi", gesture: "arrow", ring: false, action: "navigate", cta: "我到孵化区了", requiredMode: "backyard" },
  A10: { chapter: "后院驾照", label: "点第二个蛋坑的【解锁】。一个坑不够埋梦想。", targetKey: "hatcheryUpgrade", gesture: "tap", ring: true, action: "target", requiredMode: "backyard" },
  A11: { chapter: "后院驾照", label: "去商店。买一颗火蛋，准备让配方开始冒烟。", targetKey: "shopPoi", gesture: "arrow", ring: false, action: "target", requiredMode: "backyard" },
  A12: { chapter: "后院驾照", label: "点【火蛋】。价格是真的，新人报销也是真的。", targetKey: "shopFire", gesture: "tap", ring: true, action: "target", requiredMode: "backyard" },
  A13: { chapter: "后院驾照", label: "回孵化区，点空蛋坑的【放蛋孵化】。AI 已把说明书垫桌脚了。", targetKey: "emptyPit", gesture: "arrow", ring: true, action: "target", requiredMode: "backyard" },
  A14: { chapter: "后院驾照", label: "跟箭头去点【升级后院 Lv2】。先扩容，免得以后拿蛋撞墙。", targetKey: "yardUpgrade", gesture: "arrow", ring: true, action: "target", requiredMode: "backyard" },
  A15: { chapter: "后院驾照", label: "火蛋好了就回孵化区点【收取】。新同事会留在原地，先别急着替换现在的陪伴。", targetKey: "egg", gesture: "arrow", ring: true, action: "target", requiredMode: "backyard" },
  A16: { chapter: "认识新伙伴", label: "继续用现在的角色走到火系旁边，再点【陪伴】。角色切换要由你亲手决定。", gesture: "arrow", ring: true, action: "target", requiredMode: "backyard" },
  A17: { chapter: "认识新伙伴", label: "已经换成火系了。点左下角【返回】，带它回主界面。", targetKey: "yardBack", gesture: "tap", ring: true, action: "target", requiredMode: "backyard" },
  A18: { chapter: "新伙伴试用期", label: "在主界面点火系 20 次。每次都会获得金币和经验，第 20 次后升到满级。", targetKey: "pet", gesture: "rapidTap", ring: false, action: "target", requiredMode: "menu" },
  A19: { chapter: "第一次异种融合", label: "火系已经满级。点【后院】，回去找一般系完成第一次融合。", targetKey: "menuBackyard", gesture: "tap", ring: true, action: "target", requiredMode: "menu" },

  B01: { chapter: "第一次异种融合", label: "继续用火系走到一般系旁边。两个满级伙伴靠近后会出现融合按钮。", gesture: "arrow", ring: false, action: "target", requiredMode: "backyard" },
  B02: { chapter: "第一次异种融合", label: "点【融合】。这是异种融合，不安排复制粘贴自己。", gesture: "tap", ring: true, action: "target", requiredMode: "backyard" },
  B03: { chapter: "第一次异种融合", label: "会消耗这 2 只，换 1 颗新物种蛋。看清后点【确认融合】。", targetKey: "fuseConfirm", gesture: "tap", ring: true, action: "target" },
  B04: { chapter: "第一次异种融合", label: "融合蛋已经送往孵化区。等它准备好，再去亲手收取结果。", gesture: "ring", ring: false, action: "ack", cta: "去收取融合蛋" },
  B05: { chapter: "第一次异种融合", label: "8 秒后跟箭头回去点【收取】。新同事直接满级，AI 暂停考勤。", targetKey: "egg", gesture: "arrow", ring: true, action: "target", requiredMode: "backyard" },
  B06: { chapter: "三宠支援", label: "第一融通过。水、电、冰三只满级宠已空降后院，HR 坚称这叫自然增长。", gesture: "ring", ring: false, action: "ack", cta: "收下三位背锅侠" },
  B07: { chapter: "返回主界面", label: "先点左下角【返回】，回到主界面。工厂要从真正的入口进去。", targetKey: "yardBack", gesture: "tap", ring: true, action: "target", requiredMode: "backyard" },

  C01: { chapter: "真实第一局", label: "现在点主界面的【职场叠叠乐】进入游戏。接下来就是完整的真实玩法。", targetKey: "menuFactory", gesture: "tap", ring: true, action: "target", requiredMode: "menu" },

  D01: { chapter: "物种快车", label: "真实第一班完成：六种基础宠各送一只，全员满级，而且不占容量。AI 这次终于没附小字。", gesture: "ring", ring: false, action: "ack", cta: "看看物种 KPI" },
  D02: { chapter: "物种快车", label: "还差一个物种。打开【配方雷达】，不用拿脑袋撞配方表。", gesture: "ring", ring: true, action: "radar", cta: "打开配方雷达", requiredMode: "backyard" },
  D03: { chapter: "配方雷达", label: "雷达找到水 + 电：亲代都满级，结果尚未见过。AI 只负责画圈，你负责批准调岗。", gesture: "ring", ring: false, action: "radar", cta: "带我去融合", requiredMode: "backyard" },
  D04: { chapter: "配方雷达", label: "跟箭头找到水系并点它。切人不用写三页交接文档。", gesture: "arrow", ring: true, action: "target", requiredMode: "backyard" },
  D05: { chapter: "配方雷达", label: "走到啾雷鼠(电系)旁边，再点【融合】。", gesture: "arrow", ring: true, action: "target", requiredMode: "backyard" },
  D06: { chapter: "配方雷达", label: "水和电会被消耗，换一颗新物种蛋。点【确认融合】。", targetKey: "fuseConfirm", gesture: "tap", ring: true, action: "target" },
  D07: { chapter: "配方雷达", label: "8 秒后跟箭头回去点【收取】。图鉴 8/8，AI 的物种 KPI 可以闭嘴了。", targetKey: "egg", gesture: "arrow", ring: true, action: "target", requiredMode: "backyard" },
  D08: { chapter: "物种 KPI 达标", label: "8 种齐了。下一站是正式场，成绩、材料和事故都算你的。", gesture: "ring", ring: false, action: "navigate", cta: "进入正式场", requiredMode: "menu" },

  E01: { chapter: "再次上岗", label: "点【职场叠叠乐】。第一局已经把玩法交给你，这次完全自由发挥。", targetKey: "menuFactory", gesture: "tap", ring: true, action: "target", requiredMode: "menu" },
  E02: { chapter: "正式上岗", label: "点【开始正式场】。从这里起不再替你选卡、招聘或投放。", targetKey: "factoryFormalStart", gesture: "tap", ring: true, action: "target", requiredMode: "factory" },
  E03: { chapter: "正式上岗", label: "正式场已打开。去自由发挥；离开本局后再处理 AI 和 Steam。", gesture: "ring", ring: false, action: "ack", cta: "继续" },

  F01: { chapter: "可选 AI 临时工", label: "去【公告板】。这里收容 Codex 和 Claude 两位电子临时工。", targetKey: "noticeBoard", gesture: "arrow", ring: true, action: "navigate", cta: "打开公告板", requiredMode: "backyard" },
  F02: { chapter: "可选 AI 临时工", label: "连接 Codex 或 Claude 能给异种融合画新脸；不连也能完整游玩。", gesture: "ring", ring: false, action: "ack", cta: "下一步" },
  F03a: { chapter: "可选 AI 临时工", label: "想连就点公告板上的【连接】；不想连，就批准 AI 带薪摸鱼。", targetKey: "agentConnect", gesture: "tap", ring: true, action: "ack", cta: "先让 AI 摸鱼" },
  F04: { chapter: "可选 AI 临时工", label: "经典配方永远可用。AI 只是美术外包，不是游戏门票。", gesture: "ring", ring: false, action: "ack", cta: "懂了" },

  G01: { chapter: "Steam 交易", label: "最后一站：去【交易市场】。只看一眼，不替你卖孩子。", targetKey: "marketPoi", gesture: "arrow", ring: true, action: "target", requiredMode: "backyard" },
  G02: { chapter: "Steam 交易", label: "这里能同步库存、看行情、进入 Steam 市场。真实交易由 Steam 网页确认。", gesture: "ring", ring: false, action: "ack", cta: "下一步" },
  G03: { chapter: "Steam 交易", label: "点【进入 Steam 市场】。只开这一次网页，绝不半夜弹窗。", targetKey: "steamMarketOpen", gesture: "tap", ring: true, action: "target", requiredMode: "backyard" },
  G04: { chapter: "Steam 交易", label: "网页开不开都不影响毕业。浏览器若罢工，入口也已经教会你了。", gesture: "ring", ring: false, action: "ack", cta: "继续" },
  G05: { chapter: "毕业检查", label: "孵化、异种融合、配方雷达、叠叠乐、AI 和 Steam——你已经会得比产品经理多了。", gesture: "ring", ring: false, action: "ack", cta: "检查下一项" },
  G06: { chapter: "毕业检查", label: "以后只在第一次遇到新系统时提醒，而且同一时间只来一条。AI 保证不组团开会。", gesture: "ring", ring: false, action: "ack", cta: "很好，少开会" },
  G07: { chapter: "新手毕业", label: "新人保护期结束。去把公司叠高，或者把它叠成事故报告。", gesture: "ring", ring: false, action: "ack", cta: "下班，开玩" },
};

function petForElement(save: GameSave, config: GameConfig, element: string) {
  return save.pets.find((pet) => config.species[pet.species]?.elements.includes(element));
}

function maxLevelVoltMouse(save: GameSave, config: GameConfig, preferredPetId?: string | null) {
  const eligible = (pet: GameSave["pets"][number]) =>
    pet.species === "voltmouse" && pet.level >= maxLevelForTier(config, pet.tier);
  return save.pets.find((pet) => pet.id === preferredPetId && eligible(pet)) ??
    save.pets.find(eligible);
}

export function onboardingDirective(
  save: GameSave,
  config: GameConfig,
  runtime: Runtime,
  language: Language = onboardingLanguageFromStorage(),
): OnboardingDirective | null {
  const state = save.onboarding;
  if (!state || state.status !== "active" || state.step === "DONE") return null;
  const base = COPY[state.step];
  if (!base) return null;

  // C 段由真实对局里的首班事件推进；局内不叠加强遮罩。
  if (state.step.startsWith("C") && runtime.uiMode === "factory") return null;
  // 第一班结算后允许玩家继续真实对局；D 段等玩家主动离开工厂再恢复。
  if (state.step.startsWith("D") && runtime.uiMode === "factory") return null;
  // A real run is the player's first unassisted shift. Resume the route only after they leave it.
  if (state.step === "E03" && runtime.uiMode === "factory") return null;

  let targetKey = base.targetKey;
  let a13NeedsPitRecovery = false;
  if (state.step === "A13") {
    const hatcherySlots = hatcherySlotCount(config, save.hatcheryLevel);
    const occupiedHatcherySlots = new Set(
      save.eggs.flatMap((egg) => egg.slot == null ? [] : [egg.slot]),
    );
    a13NeedsPitRecovery =
      save.eggs.some((egg) => egg.slot == null && egg.shopElement === "fire") &&
      Array.from({ length: hatcherySlots }, (_, slot) => slot).every((slot) => occupiedHatcherySlots.has(slot));
  }
  if (a13NeedsPitRecovery) {
    targetKey = "hatcheryUpgrade";
  } else if (state.step === "A16") {
    const fire = petForElement(save, config, "fire");
    if (fire) targetKey = runtime.nearPetId === fire.id ? `followBtn:${fire.id}` : `placedPet:${fire.id}`;
  } else if (state.step === "B01" || state.step === "B02") {
    const normal = petForElement(save, config, "normal");
    if (normal) targetKey = state.step === "B02" ? `fuseBtn:${normal.id}` : `placedPet:${normal.id}`;
  } else if (state.step === "D04") {
    const water = petForElement(save, config, "water");
    if (water) targetKey = runtime.nearPetId === water.id ? `followBtn:${water.id}` : `placedPet:${water.id}`;
  } else if (state.step === "D05") {
    const voltMouse = maxLevelVoltMouse(save, config, runtime.nearPetId);
    if (voltMouse) {
      targetKey = runtime.nearPetId === voltMouse.id ? `fuseBtn:${voltMouse.id}` : `placedPet:${voltMouse.id}`;
    }
  }

  const index = Math.max(0, ONBOARDING_STEP_IDS.indexOf(state.step as OnboardingStepId));
  const localized = language === "en"
    ? ONBOARDING_EN_COPY[state.step as OnboardingStepId]
    : language === "zh-Hans"
      ? null
      : GENERATED_RUNTIME_LOCALES[language]?.onboarding[state.step];
  const recoveryLabel = a13NeedsPitRecovery
    ? language === "zh-Hans"
      ? ONBOARDING_UI_ZH.occupiedPit
      : language === "en"
        ? ONBOARDING_UI_EN.occupiedPit
        : GENERATED_RUNTIME_LOCALES[language]?.onboardingUi.occupiedPit ?? ONBOARDING_UI_EN.occupiedPit
    : null;
  // Walking hints are useful until the player reaches a pet. Once the contextual
  // Follow/Fuse button is present, keep only the click cue so the movement keys do
  // not compete with the action the player must take next.
  const gesture =
    targetKey?.startsWith("followBtn:") || targetKey?.startsWith("fuseBtn:")
      ? "tap"
      : base.gesture;
  return {
    ...base,
    ...(localized ?? {}),
    ...(recoveryLabel ? { label: recoveryLabel } : {}),
    cta: localized?.cta ?? base.cta,
    step: state.step,
    targetKey,
    gesture,
    progress: `${index + 1}/${ONBOARDING_STEP_IDS.length}`,
  };
}

export function fixedDexCount(save: GameSave, config: GameConfig): number {
  return Object.keys(save.dexObtained ?? {}).filter((species) => config.species[species] != null).length;
}

export function hasElementPet(save: GameSave, config: GameConfig, element: string, maxOnly = false): boolean {
  return save.pets.some((pet) => {
    const info = config.species[pet.species];
    if (!info?.elements.includes(element)) return false;
    if (!maxOnly) return true;
    return pet.level >= maxLevelForTier(config, pet.tier);
  });
}
