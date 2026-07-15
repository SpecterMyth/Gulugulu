import { useCallback, useEffect, useMemo, useState } from "react";
import type { UiMode } from "../../game/GamePanels";
import { computeTutorialHint, GRADUATION_STEP, type TutorialHint } from "../../game/tutorial";
import type { GameConfig, GameSave } from "../../types";

/** 一次性引导提示（如金蛋诞生）的持久去重键，跨重启只提示一次。 */
const HINT_SEEN_ONCE_KEY = "gulugulu.hintSeenOnce";

function loadSeenOnceHints(): Set<string> {
  try {
    const raw = window.localStorage.getItem(HINT_SEEN_ONCE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((key): key is string => typeof key === "string"));
    }
  } catch {
    // localStorage 不可用/损坏时从空集开始
  }
  return new Set();
}

// --- tutorial hints (state-triggered, OnboardingFlow §二·1) ---
// 由存档状态推导当前引导节点（接管完整三天），不再是线性 tutorialStep 计数。
// seenOnce：一次性提示（金蛋诞生等）的持久去重键，落 localStorage，跨重启只提一次。
export function useTutorialHints(
  save: GameSave | null,
  gameConfig: GameConfig | null,
  uiMode: UiMode,
  advanceTutorial: (step: number) => void,
): TutorialHint | null {
  const [seenOnceHints, setSeenOnceHints] = useState<Set<string>>(loadSeenOnceHints);
  const markHintSeenOnce = useCallback((key: string) => {
    setSeenOnceHints((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      try {
        window.localStorage.setItem(HINT_SEEN_ONCE_KEY, JSON.stringify([...next]));
      } catch {
        // localStorage 不可用时仅本次会话记住
      }
      return next;
    });
  }, []);
  const tutorialHint = useMemo(() => {
    if (!save || !gameConfig) return null;
    return computeTutorialHint({ save, config: gameConfig, uiMode, seenOnce: seenOnceHints });
  }, [gameConfig, save, seenOnceHints, uiMode]);

  // 引导气泡 10s 自动收起（GDD §10.4）：按 hint.id + uiMode 重新计时；收起后不再
  // 复读同一节点，直到出现不同的引导或切换界面。终局"毕业"节点在收起时才把
  // tutorialStep 推到 GRADUATION_STEP、一次性提示在收起时才写 seenOnce —— 若在出现时
  // 就标记，会因谓词失配导致气泡一帧即隐、玩家根本读不到。
  const [dismissedHintId, setDismissedHintId] = useState<string | null>(null);
  const tutorialHintId = tutorialHint?.id ?? null;
  const tutorialHintOnce = tutorialHint?.once ?? null;
  useEffect(() => {
    if (!tutorialHintId) return;
    setDismissedHintId(null);
    const timer = window.setTimeout(() => {
      setDismissedHintId(tutorialHintId);
      if (tutorialHintId === "graduation") advanceTutorial(GRADUATION_STEP);
      if (tutorialHintOnce) markHintSeenOnce(tutorialHintOnce);
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [advanceTutorial, markHintSeenOnce, tutorialHintId, tutorialHintOnce, uiMode]);
  const visibleTutorialHint =
    tutorialHint && tutorialHint.id !== dismissedHintId ? tutorialHint : null;

  return visibleTutorialHint;
}
