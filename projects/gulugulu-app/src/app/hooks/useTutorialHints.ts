import { useCallback, useEffect, useMemo, useState } from "react";
import type { UiMode } from "../../game/GamePanels";
import { computeTutorialHint, GRADUATION_STEP, type TutorialHint } from "../../game/tutorial";
import type { Language } from "../../i18n";
import type { GameConfig, GameSave } from "../../types";

/** 引导展示计数（展示键 → 已完整展示轮数），落 localStorage 跨重启累计。达 budget 即退休。 */
const HINT_SHOWS_KEY = "gulugulu.hintShows";
/** 旧版一次性去重键（string[]）——迁移用：每个旧键视为已展示 1 轮（budget=1 即退休）。 */
const LEGACY_SEEN_KEY = "gulugulu.hintSeenOnce";

function loadHintShows(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(HINT_SHOWS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, number> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "number") out[key] = value;
      }
      return out;
    }
    // 旧格式（gulugulu.hintSeenOnce 为 string[]）平滑迁移：每个键记 1 轮。
    const legacyRaw = window.localStorage.getItem(LEGACY_SEEN_KEY);
    const legacy: unknown = legacyRaw ? JSON.parse(legacyRaw) : null;
    if (Array.isArray(legacy)) {
      const out: Record<string, number> = {};
      for (const key of legacy) if (typeof key === "string") out[key] = 1;
      return out;
    }
  } catch {
    // localStorage 不可用/损坏 → 从空表开始
  }
  return {};
}

// --- 状态触发式新手引导（docs/gdd/OnboardingGuidance.md v1.0）---
// 由存档状态推导当前引导节点，带展示预算：一条气泡完整展示满一轮（10s 或做出对应
// 操作）后 shows[key]+1；达 budget → 永久退休。毕业里程碑（首只 2 阶）另把基础族一律
// 退休。hatcheryReady/steamEnabled 由 App 侧结算后传入（收蛋/交易所引导所需）。
export function useTutorialHints(
  save: GameSave | null,
  gameConfig: GameConfig | null,
  uiMode: UiMode,
  advanceTutorial: (step: number) => void,
  opts: { hatcheryReady?: boolean; steamEnabled?: boolean; suppressed?: boolean; lang?: Language } = {},
): TutorialHint | null {
  const { hatcheryReady = false, steamEnabled = false, suppressed = false, lang = "en" } = opts;
  const [shows, setShows] = useState<Record<string, number>>(loadHintShows);
  const bumpHintShow = useCallback((key: string) => {
    setShows((prev) => {
      const next = { ...prev, [key]: (prev[key] ?? 0) + 1 };
      try {
        window.localStorage.setItem(HINT_SHOWS_KEY, JSON.stringify(next));
      } catch {
        // localStorage 不可用时仅本次会话记住
      }
      return next;
    });
  }, []);
  const tutorialHint = useMemo(() => {
    if (!save || !gameConfig || suppressed) return null; // 强引导期间让位（OnboardingCoach.md §5）
    return computeTutorialHint({
      save,
      config: gameConfig,
      uiMode,
      lang,
      shows,
      hatcheryReady,
      steamEnabled,
    });
  }, [gameConfig, lang, save, shows, uiMode, hatcheryReady, steamEnabled, suppressed]);

  // 引导气泡 10s 自动收起（GDD §10.4）：按 hint.id + uiMode 重新计时；收起时把该展示键
  // 计数 +1（达 budget 即退休），"毕业"节点另把 tutorialStep 推到 GRADUATION_STEP。收起后
  // 不再复读同一节点，直到出现不同引导或切换界面。
  const [dismissedHintId, setDismissedHintId] = useState<string | null>(null);
  const tutorialHintId = tutorialHint?.id ?? null;
  const tutorialHintKey = tutorialHint?.key ?? null;
  useEffect(() => {
    if (!tutorialHintId) return;
    setDismissedHintId(null);
    const timer = window.setTimeout(() => {
      setDismissedHintId(tutorialHintId);
      if (tutorialHintId === "graduation") advanceTutorial(GRADUATION_STEP);
      if (tutorialHintKey) bumpHintShow(tutorialHintKey);
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [advanceTutorial, bumpHintShow, tutorialHintId, tutorialHintKey, uiMode]);
  const visibleTutorialHint =
    tutorialHint && tutorialHint.id !== dismissedHintId ? tutorialHint : null;

  return visibleTutorialHint;
}
