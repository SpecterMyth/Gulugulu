import { useEffect } from "react";
import { CoachFx } from "../../app/coach/CoachFx";
import type { CoachDirective } from "../../app/coach/coachTypes";
import { OnboardingGoal } from "../../app/onboarding/OnboardingGoal";
import type { OnboardingDirective } from "../../app/onboarding/onboardingSteps";
import type { RunView } from "./rogueTypes";

const CHAPTER = "职场叠叠乐入职";

function targetStep(
  step: string,
  progress: string,
  label: string,
  targetKey: string,
): OnboardingDirective {
  return {
    step,
    chapter: CHAPTER,
    progress,
    label,
    targetKey,
    gesture: "tap",
    ring: true,
    action: "target",
    requiredMode: "factory",
  };
}

export function factoryResumeGuide(): OnboardingDirective {
  return targetStep(
    "C02",
    "继续教学",
    "检测到未完成的真实班次。点【继续这局】，教学会从当前阶段接着走。",
    "factoryResume",
  );
}

export function factoryLoadoutGuide(reviewed: boolean): OnboardingDirective {
  if (!reviewed) {
    return targetStep(
      "C02",
      "1/11",
      "发光的是一名已选同事。点它取消出战，先学会调整本局会抽到的物种池。",
      "factoryLoadoutCard",
    );
  }
  return targetStep(
    "C03",
    "2/11",
    "出战池已经调整。现在点【开工】，用这份真实名单进入招聘。",
    "factoryLoadoutStart",
  );
}

export function factoryStrikeWarningGuide(): OnboardingDirective {
  return {
    step: "C07-strike",
    chapter: "罢工警报",
    progress: "重要",
    label:
      "刚才三只同物种连在了一起，触发了集体罢工：这三只会全部离场，还可能让上层同事坍塌。三只聚在一起是坏事，之后要把同物种分开。",
    gesture: "ring",
    ring: false,
    action: "ack",
    cta: "记住：同种三只要分开",
    requiredMode: "factory",
  };
}

export function factoryRunGuide(
  view: RunView,
  hiringReviewed: boolean,
  settledCount: number,
): OnboardingDirective | null {
  if (view.shiftIndex > 1) return null;

  if (view.phase === "hiring") {
    const hiring = view.hiring;
    const reviewed =
      hiringReviewed
      || (hiring != null
        && (hiring.round > 1 || hiring.selectedCount < hiring.candidates.length));
    if (!reviewed) {
      return targetStep(
        "C04",
        "3/11",
        "候选默认全选。先点这张候选卡取消录用，观察雇佣费和付款后现金怎样变化。",
        "factoryHiringCandidate",
      );
    }
    return targetStep(
      "C05",
      "4/11",
      hiring?.canContinue
        ? "检查“支付后现金”和“预留账单后”，再点【付款并进入下一轮】。后续招聘也点这里确认。"
        : "最后检查咕噜池、付款后现金和预留账单，再点【付款并开工】。",
      "factoryHiringPay",
    );
  }

  if (view.phase === "shift") {
    if (settledCount <= 0) {
      return targetStep(
        "C06",
        "5/11",
        view.stats.throws > 0
          ? "刚才没有接稳。等运输机飞到同元素办公桌上方，再点运输机重试。"
          : "看吊挂同事的元素。等运输机飞到同元素办公桌上方，再点运输机投放。",
        "factoryDropZone",
      );
    }
    if (settledCount === 1) {
      return targetStep(
        "C07",
        "6/11",
        "等运输机飞到已落定同事上方再点它。注意：三只同物种连在一起会集体罢工并全部离场，这是坏事；同种第三只要放远。",
        "factoryDropZone",
      );
    }
    return targetStep(
      "C08",
      "7/11",
      "继续看准位置点运输机，把右上角本班业绩填到 KPI。达标后剩余同事会自动进入加班结算。",
      "factoryDropZone",
    );
  }

  if (view.phase === "settlement") {
    return targetStep(
      "C09",
      "8/11",
      "这是本班真实工资单。看完团队业绩、账单和付款后余额，点【确认并缴账单】。",
      "factorySettlementConfirm",
    );
  }

  if (view.phase === "shop" && view.shop != null) {
    const resolved = view.shop.resolved.filter(Boolean).length;
    if (resolved >= 3) return null;
    return targetStep(
      `C${10 + resolved}`,
      `${9 + resolved}/11`,
      resolved === 0
        ? "班末强化分三轮。先从当前三张卡中点一张购买；钱不够时可以点【跳过】返现。"
        : resolved === 1
          ? "第一项强化已生效。现在给第二个维度再选一张；每个维度只能定一次。"
          : "最后一个强化维度：点一张卡完成选择。完成后会自动进入下一班。",
      "factoryShopChoice",
    );
  }

  // KPI 达标后的加班投放和卡牌撕取动画都是自动流程，不制造一个假按钮打断它。
  return null;
}

export function FactoryFirstRunGuide({
  directive,
  onAction = () => {},
}: {
  directive: OnboardingDirective | null;
  onAction?: () => void;
}) {
  useEffect(() => {
    if (!directive) return;
    const guard = (event: Event) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (target.closest("[data-onboarding-allow], [data-tauri-drag-region]")) return;
      const coachTarget = target.closest<HTMLElement>("[data-coach]");
      if (directive.targetKey && coachTarget?.dataset.coach === directive.targetKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener("pointerdown", guard, true);
    window.addEventListener("click", guard, true);
    return () => {
      window.removeEventListener("pointerdown", guard, true);
      window.removeEventListener("click", guard, true);
    };
  }, [directive]);

  const coach: CoachDirective | null =
    directive?.targetKey == null
      ? null
      : {
          step: directive.step,
          gesture: directive.gesture,
          ring: directive.ring,
          label: directive.label,
          target: { kind: directive.targetKey },
        };

  return (
    <>
      <CoachFx directive={coach} />
      <OnboardingGoal
        directive={directive}
        onAction={onAction}
        onRecover={() => {}}
      />
    </>
  );
}
