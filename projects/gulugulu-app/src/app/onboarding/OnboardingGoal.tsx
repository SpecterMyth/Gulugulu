import { useLayoutEffect, useRef, useState } from "react";
import { useT } from "../../useT";
import type { OnboardingDirective } from "./onboardingSteps";
import { placeOnboardingCard } from "./onboardingPlacement";
import "./onboarding.css";

export function OnboardingGoal({
  directive,
  onAction,
  onRecover,
  onSkip,
}: {
  directive: OnboardingDirective | null;
  onAction: () => void;
  onRecover: () => void;
  /** Optional main-route escape hatch. App should pass director.skipMain after confirmation. */
  onSkip?: () => void;
}) {
  const { lang } = useT();
  const goalRef = useRef<HTMLElement>(null);
  const [targetPresent, setTargetPresent] = useState(false);

  useLayoutEffect(() => {
    const goal = goalRef.current;
    if (!goal || !directive) return;

    let raf = 0;
    let previousTargetPresent: boolean | null = null;
    let previousLayout = "";
    const shiftedSpeech = new Set<HTMLElement>();
    const targetKey = directive.targetKey;

    const position = () => {
      // Avoid CSS.escape: older desktop WebView runtimes may expose `CSS` without
      // `escape()`, leaving the first step stuck on the recovery button even though
      // the egg is already present.
      const target = targetKey
        ? Array.from(document.querySelectorAll<HTMLElement>("[data-coach]")).find(
            (element) => element.dataset.coach === targetKey,
          ) ?? null
        : null;
      const present = target != null;
      if (present !== previousTargetPresent) {
        previousTargetPresent = present;
        setTargetPresent(present);
      }

      const goalRect = goal.getBoundingClientRect();
      if (directive.gesture === "drop") {
        // 投放目标会随运输机持续移动。便签若参与目标避让，就会在飞机巡航时
        // 反复换边、上下跳动；投放步骤固定在屏幕中央，只让手势追踪飞机。
        const left = Math.max(14, (window.innerWidth - goalRect.width) / 2);
        const top = Math.max(14, (window.innerHeight - goalRect.height) / 2);
        const nextLayout = `${Math.round(left)}:${Math.round(top)}:screen-middle`;
        if (nextLayout !== previousLayout) {
          previousLayout = nextLayout;
          goal.style.left = `${left}px`;
          goal.style.top = `${top}px`;
          goal.dataset.placement = "screen-middle";
        }
        goal.dataset.targetOverlap = "false";
        goal.dataset.speechOverlap = "false";
        goal.dataset.placementReady = "true";
        raf = requestAnimationFrame(position);
        return;
      }

      const targetRect = target?.getBoundingClientRect();
      const guideFx = Array.from(document.querySelectorAll<HTMLElement>("[data-coach-fx]"))
        .filter((element) => Number.parseFloat(element.style.opacity || "0") > 0.01)
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }));
      const isVisible = (element: HTMLElement | null): element is HTMLElement => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity) > 0.01
        );
      };
      const backyardRoot = document.querySelector<HTMLElement>(".ui-backyard");
      const mainRoot = document.querySelector<HTMLElement>(
        ".pet-shell:not(.ui-backyard):not(.ui-factory)",
      );
      const anchorCandidates = backyardRoot
        ? [
            backyardRoot.querySelector<HTMLElement>(".by-char-say"),
            backyardRoot.querySelector<HTMLElement>(".by-char"),
          ]
        : [
            mainRoot?.querySelector<HTMLElement>(".speech.is-visible") ?? null,
            mainRoot?.querySelector<HTMLElement>(".duck-facing") ?? null,
          ];
      // The visible speech bubble wins. Because this runs every animation frame,
      // a bubble that appears mid-step immediately becomes the preferred anchor
      // and moves the guide above it; hiding it falls back to the character.
      const preferredAnchor = anchorCandidates.find(isVisible) ?? null;
      const speechElements = Array.from(
        new Set([
          ...document.querySelectorAll<HTMLElement>(".speech.is-visible"),
          ...(preferredAnchor ? [preferredAnchor] : []),
        ]),
      );
      const speechEntries = speechElements
        .filter(isVisible)
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const currentPush = Number.parseFloat(
            element.style.getPropertyValue("--onboarding-speech-push") || "0",
          );
          return { element, rect, currentPush, preferred: element === preferredAnchor };
        })
        .filter(({ rect }) => rect.width > 0 && rect.height > 0);
      const speechBubbles = speechEntries.map(({ element, rect, currentPush, preferred }) => ({
        left: rect.left,
        top: rect.top - currentPush,
        width: rect.width,
        height: rect.height,
        movable: element.matches(".speech"),
        preferred,
        screenFixed: Boolean(backyardRoot) && preferred,
      }));
      const placement = placeOnboardingCard(
        { width: window.innerWidth, height: window.innerHeight },
        { width: goalRect.width, height: goalRect.height },
        targetRect
          ? {
              left: targetRect.left,
              top: targetRect.top,
              width: targetRect.width,
              height: targetRect.height,
            }
        : null,
        guideFx,
        speechBubbles,
      );
      const nextLayout = `${Math.round(placement.left)}:${Math.round(placement.top)}:${placement.position}`;
      if (nextLayout !== previousLayout) {
        previousLayout = nextLayout;
        goal.style.left = `${placement.left}px`;
        goal.style.top = `${placement.top}px`;
        goal.dataset.placement = placement.position;
      }
      const cardRect = goal.getBoundingClientRect();
      speechEntries.forEach(({ element, rect, currentPush }, index) => {
        if (!element.matches(".speech")) return;
        const baseTop = rect.top - currentPush;
        const desiredPush =
          cardRect.top <= baseTop
            ? Math.max(0, cardRect.bottom + 12 - baseTop)
            : 0;
        element.style.setProperty("--onboarding-speech-push", `${desiredPush}px`);
        shiftedSpeech.add(element);
        speechBubbles[index] = {
          ...speechBubbles[index],
          top: baseTop + desiredPush,
        };
      });
      goal.dataset.targetOverlap = placement.overlap > 0.5 ? "true" : "false";
      goal.dataset.speechOverlap = speechBubbles.some((speech) => {
        const card = goal.getBoundingClientRect();
        return !(
          card.right <= speech.left ||
          card.left >= speech.left + speech.width ||
          card.bottom <= speech.top ||
          card.top >= speech.top + speech.height
        );
      })
        ? "true"
        : "false";
      goal.dataset.placementReady = "true";
      raf = requestAnimationFrame(position);
    };

    position();
    return () => {
      cancelAnimationFrame(raf);
      shiftedSpeech.forEach((element) => {
        element.style.removeProperty("--onboarding-speech-push");
      });
    };
  }, [directive?.step, directive?.targetKey, directive?.gesture]);

  if (!directive) return null;
  const showAction = directive.action !== "target";
  return (
    <section ref={goalRef} className="onboarding-goal" data-onboarding-allow role="status" aria-live="polite">
      <div className="onboarding-sticker">
        <span className="guide-sticker-sprinkles" aria-hidden="true" />
        <header>
          <span>{directive.chapter}</span>
          <small>{directive.progress}</small>
        </header>
        <p>{directive.label}</p>
        {showAction ? (
          <button type="button" data-onboarding-allow onClick={onAction}>
            {directive.cta ?? (lang === "zh" ? "知道了" : "Got it")}
          </button>
        ) : !targetPresent ? (
          <button type="button" data-onboarding-allow onClick={onRecover}>
            {lang === "zh" ? "带我回正确位置" : "Take me to the right place"}
          </button>
        ) : (
          <div className="onboarding-target-note">
            {lang === "zh" ? "建议先做发光的这一步" : "Try the highlighted step first"}
          </div>
        )}
        {onSkip && (
          <button
            type="button"
            className="onboarding-skip"
            data-onboarding-allow
            onClick={onSkip}
          >
            {lang === "zh" ? "跳过整个新手引导" : "Skip onboarding"}
          </button>
        )}
      </div>
    </section>
  );
}
