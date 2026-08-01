import { CoachFx } from "../../app/coach/CoachFx";
import type { CoachDirective } from "../../app/coach/coachTypes";
import { OnboardingGoal } from "../../app/onboarding/OnboardingGoal";
import { onboardingLanguageFromStorage } from "../../app/onboarding/onboardingCopy";
import type { OnboardingDirective } from "../../app/onboarding/onboardingSteps";
import type { Language } from "../../i18n/core";
import { useT } from "../../useT";
import type { RunView } from "./rogueTypes";

type FactoryGuideCopy = {
  chapter: string;
  resumeProgress: string;
  resume: string;
  loadout: string;
  strikeChapter: string;
  strikeProgress: string;
  strike: string;
  strikeCta: string;
  hiringContinue: string;
  hiringStart: string;
  dropRetry: string;
  dropFirst: string;
  dropSecond: string;
  dropContinue: string;
  settlement: string;
  shopFirst: string;
  shopSecond: string;
  shopThird: string;
  dropKey: string;
};

export const FACTORY_FIRST_RUN_COPY: Record<Language, FactoryGuideCopy> = {
  zh: {
    chapter: "职场叠叠乐入职",
    resumeProgress: "继续教学",
    resume: "检测到未完成的真实班次。点【继续这局】，教学会从当前阶段接着走。",
    loadout: "4 名同事已经全部选好。直接点【开工】，用这份真实名单进入招聘。",
    strikeChapter: "罢工警报",
    strikeProgress: "重要",
    strike:
      "刚才三只同物种连在了一起，触发了集体罢工：这三只会全部离场，还可能让上层同事坍塌。三只聚在一起是坏事，之后要把同物种分开。",
    strikeCta: "记住：同种三只要分开",
    hiringContinue:
      "检查“支付后现金”和“预留账单后”，再点【付款并进入下一轮】。后续招聘也点这里确认。",
    hiringStart:
      "候选已经默认全选。检查咕噜池、付款后现金和预留账单，再直接点【付款并开工】。",
    dropRetry:
      "刚才没有接稳。等运输机飞到同元素办公桌上方，按空格键重试；也可以点击运输机。",
    dropFirst:
      "看吊挂同事的元素。等运输机飞到同元素办公桌上方，按空格键投放；也可以点击运输机。",
    dropSecond:
      "等运输机飞到已落定同事上方，按空格键投放（也可以点击运输机）。注意：三只同物种连在一起会集体罢工并全部离场，同种第三只要放远。",
    dropContinue:
      "继续看准位置按空格键投放，也可以点击运输机，把右上角本班业绩填到 KPI。达标后剩余同事会自动进入加班结算。",
    settlement:
      "这是本班真实工资单。看完团队业绩、账单和付款后余额，点【确认并缴账单】。",
    shopFirst:
      "班末强化分三轮。先从当前三张卡中点一张购买；钱不够时可以点【跳过】返现。",
    shopSecond:
      "第一项强化已生效。现在给第二个维度再选一张；每个维度只能定一次。",
    shopThird:
      "最后一个强化维度：点一张卡完成选择。完成后会自动进入下一班。",
    dropKey: "空格键 · 投放",
  },
  en: {
    chapter: "Workplace Stack Orientation",
    resumeProgress: "Resume tutorial",
    resume: "An unfinished real shift was found. Choose Continue Run and the tutorial will resume from its current phase.",
    loadout: "All four coworkers are selected. Choose Start Shift to take this real roster into hiring.",
    strikeChapter: "Strike Alert",
    strikeProgress: "Important",
    strike:
      "Three coworkers of the same species just connected and triggered a group strike. All three leave, and coworkers above them may collapse. Keep matching species apart from now on.",
    strikeCta: "Remember: split up matching trios",
    hiringContinue:
      "Check Cash After Payment and After Reserved Bill, then choose Pay and Continue. Use the same control for later hiring rounds.",
    hiringStart:
      "Every candidate starts selected. Check the Gulu pool, cash after payment, and reserved bill, then choose Pay and Start.",
    dropRetry:
      "That one did not settle. Wait until the conveyor is above a desk with the matching element, then press Space to retry. You can also click the conveyor.",
    dropFirst:
      "Check the hanging coworker's element. When the conveyor reaches a matching desk, press Space to drop. You can also click the conveyor.",
    dropSecond:
      "Wait until the conveyor is above the settled coworker, then press Space to drop. Three connected coworkers of the same species will strike and all leave, so place the third one farther away.",
    dropContinue:
      "Keep aiming and press Space to drop, or click the conveyor, until the shift KPI in the upper-right is full. Remaining coworkers then enter overtime automatically.",
    settlement:
      "This is the shift's real payroll sheet. Review team revenue, the bill, and the balance after payment, then choose Confirm and Pay Bill.",
    shopFirst:
      "End-of-shift upgrades come in three rounds. Buy one of the current cards; if cash is short, choose Skip for a refund.",
    shopSecond:
      "The first upgrade is active. Choose one for the second category; each category gets one decision.",
    shopThird:
      "Last upgrade category: choose one card to finish. The next shift starts automatically.",
    dropKey: "SPACE · DROP",
  },
};

function guideCopy(language: Language = onboardingLanguageFromStorage()): FactoryGuideCopy {
  return FACTORY_FIRST_RUN_COPY[language];
}

function targetStep(
  step: string,
  progress: string,
  label: string,
  targetKey: string,
  gesture: OnboardingDirective["gesture"] = "tap",
  language: Language = onboardingLanguageFromStorage(),
): OnboardingDirective {
  return {
    step,
    chapter: guideCopy(language).chapter,
    progress,
    label,
    targetKey,
    gesture,
    ring: true,
    action: "target",
    requiredMode: "factory",
  };
}

export function factoryResumeGuide(
  language: Language = onboardingLanguageFromStorage(),
): OnboardingDirective {
  const copy = guideCopy(language);
  return targetStep(
    "C02",
    copy.resumeProgress,
    copy.resume,
    "factoryResume",
    "tap",
    language,
  );
}

export function factoryLoadoutGuide(
  language: Language = onboardingLanguageFromStorage(),
): OnboardingDirective {
  const copy = guideCopy(language);
  return targetStep(
    "C02",
    "1/9",
    copy.loadout,
    "factoryLoadoutStart",
    "tap",
    language,
  );
}

export function factoryStrikeWarningGuide(
  language: Language = onboardingLanguageFromStorage(),
): OnboardingDirective {
  const copy = guideCopy(language);
  return {
    step: "C07-strike",
    chapter: copy.strikeChapter,
    progress: copy.strikeProgress,
    label: copy.strike,
    gesture: "ring",
    ring: false,
    action: "ack",
    cta: copy.strikeCta,
    requiredMode: "factory",
  };
}

export function factoryRunGuide(
  view: RunView,
  settledCount: number,
  language: Language = onboardingLanguageFromStorage(),
): OnboardingDirective | null {
  if (view.shiftIndex > 1) return null;
  const copy = guideCopy(language);

  if (view.phase === "hiring") {
    const hiring = view.hiring;
    return targetStep(
      "C03",
      "2/9",
      hiring?.canContinue ? copy.hiringContinue : copy.hiringStart,
      "factoryHiringPay",
      "tap",
      language,
    );
  }

  if (view.phase === "shift") {
    if (settledCount <= 0) {
      return targetStep(
        "C04",
        "3/9",
        view.stats.throws > 0 ? copy.dropRetry : copy.dropFirst,
        "factoryDropZone",
        "drop",
        language,
      );
    }
    if (settledCount === 1) {
      return targetStep(
        "C05",
        "4/9",
        copy.dropSecond,
        "factoryDropZone",
        "drop",
        language,
      );
    }
    return targetStep(
      "C06",
      "5/9",
      copy.dropContinue,
      "factoryDropZone",
      "drop",
      language,
    );
  }

  if (view.phase === "settlement") {
    return targetStep(
      "C07",
      "6/9",
      copy.settlement,
      "factorySettlementConfirm",
      "tap",
      language,
    );
  }

  if (view.phase === "shop" && view.shop != null) {
    const resolved = view.shop.resolved.filter(Boolean).length;
    if (resolved >= 3) return null;
    return targetStep(
      `C${8 + resolved}`,
      `${7 + resolved}/9`,
      resolved === 0
        ? copy.shopFirst
        : resolved === 1
          ? copy.shopSecond
          : copy.shopThird,
      "factoryShopChoice",
      "tap",
      language,
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
  const { lang } = useT();

  const coach: CoachDirective | null =
    directive?.targetKey == null
      ? null
      : {
          step: directive.step,
          // FactoryFirstRunGuide renders its own localized Space key. CoachFx keeps
          // tracking the moving conveyor with the hand, without its Chinese-only keycap.
          gesture: directive.gesture === "drop" ? "tap" : directive.gesture,
          ring: directive.ring,
          label: directive.label,
          target: { kind: directive.targetKey },
        };

  return (
    <>
      <CoachFx directive={coach} />
      {directive?.gesture === "drop" && (
        <div className="factory-guide-drop-key" aria-hidden="true">
          {guideCopy(lang).dropKey}
        </div>
      )}
      <OnboardingGoal
        directive={directive}
        onAction={onAction}
        onRecover={() => {}}
      />
    </>
  );
}
