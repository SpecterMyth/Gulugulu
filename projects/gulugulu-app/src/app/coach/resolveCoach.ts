// 教练 resolver（纯函数）—— docs/gdd/OnboardingCoach.md §3.2 非阻塞全界面路由。
// 输入当前上下文（存档 + uiMode + 后院运行时 + 持久标记），输出"此刻该点哪/按哪键"。
// 每步 = 终点动作 + 前置阶梯：找第一个未满足前置显示其导航子步；全满足 → 终点动作。
import { clickExpFor, expToNext, fusionFeeFor, isMaxLevel } from "../../game/config";
import { expToMax, fusionReady } from "../../game/tutorial";
import { fmt, t as tStrings } from "../../i18n";
import type { ShellCoachStrings } from "../../i18n/shell";
import type { CoachContext, CoachDirective, CoachStepId, CoachTarget } from "./coachTypes";
import type { PetInstance } from "../../types";

/** 当前语言的教练词条（局部变量常叫 t=CoachTarget，i18n 的 t 用别名避免遮蔽）。 */
function coachCopy(ctx: CoachContext): ShellCoachStrings {
  return tStrings(ctx.lang).sh.coach;
}

/** C2"学会点击"阈值：首宠累计经验 ≥ 此值即通过（≈12 击，一阶 2 exp/击）。 */
export const COACH_WORK_EXP = 24;

function everFused(ctx: CoachContext): boolean {
  const { save, config } = ctx;
  // 拥有二阶宠（已收下融合结果）才退场——首融蛋在飞时教练仍活（要教收蛋，见 C8）。
  if (save.pets.some((p) => p.tier >= 2)) return true;
  const dex = save.dexObtained ?? {};
  return Object.keys(dex).some(
    (code) => (dex[code] ?? 0) >= 1 && (config.species[code]?.elements.length ?? 1) >= 2,
  );
}

/** 教练是否激活：未完成/未跳过，且从未融合过（老玩家/新设备空标记也不重教）。 */
export function coachActive(ctx: CoachContext): boolean {
  return !ctx.flags.done && !everFused(ctx);
}

function cumulativeExp(ctx: CoachContext, pet: PetInstance): number {
  let total = pet.exp;
  for (let lv = 1; lv < pet.level; lv += 1) total += expToNext(ctx.config, pet.tier, lv);
  return total;
}

function clicksToMax(ctx: CoachContext, pet: PetInstance): number {
  const per = Math.max(1, clickExpFor(ctx.config, pet.tier));
  return Math.max(1, Math.ceil(expToMax(ctx.config, pet) / per));
}

function cheapestEgg(ctx: CoachContext): number {
  const prices = Object.values(ctx.config.eggPrices);
  return prices.length ? Math.min(...prices) : 0;
}

/** 当前处于哪一步（由存档 + 标记推导，自愈；乱序也能重定位）。 */
export function currentStep(ctx: CoachContext): CoachStepId {
  const pets = ctx.save.pets;
  // 全新开局：教学蛋在册 → 先收教学蛋（哪怕 Steam 又导入了别的宠物，也不跳步）。
  if (ctx.save.eggs.some((e) => e.hatchKind === "tutorial")) return "C1";
  // #6 首融产出的高阶蛋待收 → C8（回主界面收蛋）。融合消耗双亲后 pets 可能为 0。
  if (ctx.save.eggs.some((e) => e.tier >= 2)) return "C8";
  if (pets.length === 0) return "C1";
  if (cumulativeExp(ctx, pets[0]) < COACH_WORK_EXP) return "C2";
  if (!ctx.flags.moved) return "C3";
  if (pets.length < 2) return ctx.save.eggs.length > 0 ? "C5" : "C4"; // 买过蛋→收/切；否则→买
  if (fusionReady(ctx.config, ctx.save)) return "C7"; // 两只满级即可融合（跳过 C5/C6 免死循环）
  if (!ctx.flags.switched) return "C5";
  return "C6";
}

const D = (
  step: CoachDirective["step"],
  gesture: CoachDirective["gesture"],
  target: CoachTarget,
  label: string,
  ring = true,
): CoachDirective => ({ step, gesture, target, label, ring });

/** 从舞台去后院：pet→展开菜单，menu→点🏡；已在后院返回 null。 */
function toBackyard(ctx: CoachContext, step: CoachStepId, backyardLabel: string): CoachDirective | null {
  if (ctx.uiMode === "pet") return D(step, "tap", { kind: "pet" }, coachCopy(ctx).openMenu);
  if (ctx.uiMode === "menu") return D(step, "tap", { kind: "menuBackyard" }, backyardLabel);
  return null;
}

/** 就近连点某宠赚币（N4 内部；pet 态先展开菜单）。 */
function earn(ctx: CoachContext, step: CoachStepId, label: string): CoachDirective {
  if (ctx.uiMode === "pet") return D(step, "tap", { kind: "pet" }, coachCopy(ctx).openMenu);
  const t: CoachTarget = ctx.uiMode === "backyard" ? { kind: "char" } : { kind: "pet" };
  return D(step, "rapidTap", t, label);
}

export function resolveCoach(ctx: CoachContext): CoachDirective | null {
  if (!coachActive(ctx)) return null;
  if (ctx.uiMode === "settings" || ctx.uiMode === "debug") return null; // 面板内暂停，退出即恢复

  const C = coachCopy(ctx);

  // #4 力竭时永远先教回精力（点不动的宠不该再被引导去点击）——不再只教一次。
  if (ctx.exhausted) {
    const t: CoachTarget = ctx.uiMode === "backyard" ? { kind: "char" } : { kind: "pet" };
    return D("CE", "keys", t, C.keysForEnergy);
  }

  // #8 融合确认弹窗打开时：指引指向「开始融合」（而非打开弹窗的旧「融合」按钮）。
  if (ctx.fusionModalOpen) return D("C7", "tap", { kind: "fuseConfirm" }, C.tapFuseConfirm);

  const pets = ctx.save.pets;
  const active = pets.find((p) => p.id === ctx.save.activePetId) ?? null;

  switch (currentStep(ctx)) {
    case "C8": {
      // #6 首融蛋。主舞台的 stageEgg 只在「无在养主宠」时才顶蛋（App.tsx: activePet==null）。
      // 故按是否仍有其他角色分两条收法（active 与 App 的 activePet 同源，精确对齐可见性）：
      //  · active!=null（融合后仍有别的角色占着主舞台）→ 回主界面根本看不到蛋，蛋只留在
      //    后院孵化槽 → 直接引到后院收（pet/menu 态先进后院，backyard 态点孵化槽的蛋）。
      //  · active==null（双亲耗尽、无宠）→ 蛋顶到主舞台 → 先回主界面，再在台上收（原路径）。
      if (active) {
        const nav = toBackyard(ctx, "C8", C.goYardCollectFusion);
        if (nav) return nav;
        return D("C8", "tap", { kind: "egg" }, ctx.hatcheryReady ? C.eggReadyCollect : C.eggWaiting);
      }
      if (ctx.uiMode === "backyard") return D("C8", "tap", { kind: "yardBack" }, C.returnMainCollect);
      return D("C8", "tap", { kind: "egg" }, ctx.hatcheryReady ? C.eggReadyCollect : C.eggWaiting);
    }

    case "C1":
      return D("C1", "tap", { kind: "egg" }, ctx.hatcheryReady ? C.eggReadyTap : C.eggWaiting);

    case "C2": {
      if (ctx.uiMode === "pet") return D("C2", "tap", { kind: "pet" }, C.openMenu);
      const t: CoachTarget = ctx.uiMode === "backyard" ? { kind: "char" } : { kind: "pet" };
      return D("C2", "rapidTap", t, C.rapidWork);
    }

    case "C3": {
      const nav = toBackyard(ctx, "C3", C.goYardWalk);
      if (nav) return nav;
      return D("C3", "moveKeys", { kind: "char" }, C.walkKeys);
    }

    case "C4": {
      if (ctx.save.coins < cheapestEgg(ctx)) return earn(ctx, "C4", C.earnCoins);
      const nav = toBackyard(ctx, "C4", C.goYardBuy);
      if (nav) return nav;
      if (!ctx.nearShop) return D("C4", "arrow", { kind: "shopPoi" }, C.goShop);
      return D("C4", "tap", { kind: "shopCard" }, C.buyEggPair);
    }

    case "C5": {
      if (pets.length < 2) {
        // 2 号蛋已买、待收 → 去后院孵化槽收下它
        const nav = toBackyard(ctx, "C5", C.goYardEgg);
        if (nav) return nav;
        return ctx.hatcheryReady
          ? D("C5", "tap", { kind: "egg" }, C.eggReadyCollect)
          : D("C5", "ring", { kind: "egg" }, C.eggWaiting);
      }
      // 两只齐 → 切换陪伴到另一只
      const other = pets.find((p) => p.id !== ctx.save.activePetId) ?? pets[0];
      const nav = toBackyard(ctx, "C5", C.goYardSwitch);
      if (nav) return nav;
      if (ctx.nearPetId !== other.id)
        return D("C5", "arrow", { kind: "placedPet", petId: other.id }, C.approachOther);
      return D("C5", "tap", { kind: "followBtn", petId: other.id }, C.tapFollow);
    }

    case "C6": {
      const activeNonMax = active && !isMaxLevel(ctx.config, active) ? active : null;
      const target =
        activeNonMax ??
        pets.find((p) => !isMaxLevel(ctx.config, p) && p.id !== ctx.save.activePetId) ??
        pets.find((p) => !isMaxLevel(ctx.config, p)) ??
        null;
      if (!target) return null; // 全满级但非同阶（教学期不会发生）→ 静默
      // #7 升满级只在主界面点（不在后院直接点）。未满宠 ≠ 主宠 → 先去后院切它跟随。
      if (!active || active.id !== target.id) {
        const nav = toBackyard(ctx, "C6", C.goYardSwitch);
        if (nav) return nav;
        if (ctx.nearPetId !== target.id)
          return D("C6", "arrow", { kind: "placedPet", petId: target.id }, C.approachOther);
        return D("C6", "tap", { kind: "followBtn", petId: target.id }, C.tapFollow);
      }
      // 未满宠 = 主宠 → 回主界面点满它（后院→点返回；pet→展开菜单；menu→连点）
      const label = fmt(C.maxIt, { n: clicksToMax(ctx, target) });
      if (ctx.uiMode === "backyard") return D("C6", "tap", { kind: "yardBack" }, C.returnMain);
      if (ctx.uiMode === "pet") return D("C6", "tap", { kind: "pet" }, C.openMenu);
      return D("C6", "rapidTap", { kind: "pet" }, label);
    }

    case "C7": {
      const maxed = pets.filter((p) => isMaxLevel(ctx.config, p));
      const parentA = active && isMaxLevel(ctx.config, active) ? active : maxed[0] ?? null;
      if (!parentA) return null;
      // 主宠不是满级亲代 → 先切它跟随（教学期主宠已满，罕见）
      if (!active || active.id !== parentA.id) {
        const nav = toBackyard(ctx, "C7", C.goYardFuse);
        if (nav) return nav;
        if (ctx.nearPetId !== parentA.id)
          return D("C7", "arrow", { kind: "placedPet", petId: parentA.id }, C.approachIt);
        return D("C7", "tap", { kind: "followBtn", petId: parentA.id }, C.makeFollow);
      }
      const other = maxed.find((p) => p.id !== parentA.id && p.tier === parentA.tier);
      if (!other) return null;
      if (ctx.save.coins < fusionFeeFor(ctx.config, parentA.tier))
        return earn(ctx, "C7", C.earnFusionFee);
      const nav = toBackyard(ctx, "C7", C.goYardFuse);
      if (nav) return nav;
      if (ctx.nearPetId !== other.id)
        return D("C7", "arrow", { kind: "placedPet", petId: other.id }, C.walkToIt);
      return D("C7", "tap", { kind: "fuseBtn", petId: other.id }, C.tapFuse);
    }
  }
}
