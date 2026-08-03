import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useT } from "../../useT";
import type { OnboardingDirective } from "./onboardingSteps";
import { placeOnboardingCard } from "./onboardingPlacement";
import "./onboarding.css";

export function OnboardingGoal({
  directive,
  onAction,
  onRecover,
  onSkip,
  targetNote,
  busy = false,
}: {
  directive: OnboardingDirective | null;
  onAction: () => void;
  onRecover: () => void;
  /** Optional main-route escape hatch. App should pass director.skipMain after confirmation. */
  onSkip?: () => void;
  /** Optional concrete input hint for a present target (for example “Space · Drop”). */
  targetNote?: string;
  /** Native persistence is in flight; repeated mutations are coalesced until it settles. */
  busy?: boolean;
}) {
  const { lang } = useT();
  const goalRef = useRef<HTMLElement>(null);
  const keepLearningRef = useRef<HTMLButtonElement>(null);
  const [targetPresent, setTargetPresent] = useState(false);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);

  useEffect(() => {
    if (!skipConfirmOpen) return;
    keepLearningRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      setSkipConfirmOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [busy, skipConfirmOpen]);

  useEffect(() => {
    setSkipConfirmOpen(false);
  }, [directive?.step]);

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
        // 投放目标会随运输机持续移动。便签若逐帧追着目标避让，就会反复换边；
        // 改停在 HUD 之间的下方安全通道，让上层/下层落点圈都保持可见。
        const horizontalBias = window.innerWidth <= 900
          ? Math.min(52, window.innerWidth * 0.08)
          : 0;
        const left = Math.max(8, (window.innerWidth - goalRect.width) / 2 - horizontalBias);
        const top = Math.max(8, window.innerHeight - goalRect.height - 10);
        const nextLayout = `${Math.round(left)}:${Math.round(top)}:screen-lower-lane`;
        if (nextLayout !== previousLayout) {
          previousLayout = nextLayout;
          goal.style.left = `${left}px`;
          goal.style.top = `${top}px`;
          goal.dataset.placement = "screen-lower-lane";
        }
        goal.dataset.targetOverlap = "false";
        goal.dataset.speechOverlap = "false";
        goal.dataset.placementReady = "true";
        raf = requestAnimationFrame(position);
        return;
      }

      const backyardRoot = document.querySelector<HTMLElement>(".ui-backyard");
      if (backyardRoot) {
        // Every backyard step uses one viewport slot. Targets, speech bubbles,
        // pets and the camera all move independently in this scene; none of
        // them may pull the guide card away from its fixed HUD position.
        const left = Math.max(8, (window.innerWidth - goalRect.width) / 2);
        const top = 2;
        const nextLayout = `${Math.round(left)}:${top}:backyard-screen-top`;
        if (nextLayout !== previousLayout) {
          previousLayout = nextLayout;
          goal.style.left = `${left}px`;
          goal.style.top = `${top}px`;
          goal.dataset.placement = "backyard-screen-top";
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
      const mainRoot = document.querySelector<HTMLElement>(
        ".pet-shell:not(.ui-backyard):not(.ui-factory)",
      );
      const anchorCandidates = [
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
        screenFixed: false,
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
  const busyLabel = lang === "zh" ? "正在确认…" : "Saving…";
  return (
    <section
      ref={goalRef}
      className={`onboarding-goal${directive.gesture === "drop" ? " is-drop" : ""}`}
      data-step={directive.step}
      data-onboarding-allow
      role="status"
      aria-live="polite"
      aria-busy={busy}
    >
      <div className="onboarding-sticker" aria-hidden={skipConfirmOpen || undefined}>
        <span className="guide-sticker-sprinkles" aria-hidden="true" />
        <header className="onboarding-goal-header">
          <span>{directive.chapter}</span>
          <small>{directive.progress}</small>
        </header>
        <p>{directive.label}</p>
        {showAction ? (
          <button type="button" data-onboarding-allow disabled={busy} onClick={onAction}>
            {busy ? busyLabel : directive.cta ?? (lang === "zh" ? "知道了" : "Got it")}
          </button>
        ) : !targetPresent ? (
          <button type="button" data-onboarding-allow disabled={busy} onClick={onRecover}>
            {busy ? busyLabel : lang === "zh" ? "带我回正确位置" : "Take me to the right place"}
          </button>
        ) : (
          <div className="onboarding-target-note">
            {targetNote ?? (lang === "zh" ? "先做发光步骤" : "Do the glowing step")}
          </div>
        )}
        {onSkip && (
          <button
            type="button"
            className="onboarding-skip"
            data-onboarding-allow
            disabled={busy}
            onClick={() => setSkipConfirmOpen(true)}
          >
            {busy ? busyLabel : lang === "zh" ? "跳过整个新手引导" : "Skip onboarding"}
          </button>
        )}
      </div>
      {onSkip && skipConfirmOpen && (
        <div
          className="onboarding-confirm-backdrop"
          data-onboarding-allow
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setSkipConfirmOpen(false);
          }}
        >
          <div
            className="onboarding-confirm-note"
            data-onboarding-allow
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-skip-title"
            aria-describedby="onboarding-skip-description"
          >
            <span className="onboarding-confirm-tape" aria-hidden="true" />
            <strong id="onboarding-skip-title">
              {lang === "zh" ? "要跳过新手引导吗？" : "Skip the onboarding?"}
            </strong>
            <p id="onboarding-skip-description">
              {lang === "zh"
                ? "之后仍可直接使用全部正常玩法，但引导进度会标记为完成。"
                : "All regular features will remain available, but the guide will be marked complete."}
            </p>
            <div className="onboarding-confirm-actions">
              <button
                ref={keepLearningRef}
                type="button"
                className="onboarding-confirm-cancel"
                data-onboarding-allow
                disabled={busy}
                onClick={() => setSkipConfirmOpen(false)}
              >
                {lang === "zh" ? "继续引导" : "Keep learning"}
              </button>
              <button
                type="button"
                className="onboarding-confirm-skip"
                data-onboarding-allow
                disabled={busy}
                onClick={() => {
                  setSkipConfirmOpen(false);
                  onSkip();
                }}
              >
                {busy ? busyLabel : lang === "zh" ? "确认跳过" : "Skip it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
