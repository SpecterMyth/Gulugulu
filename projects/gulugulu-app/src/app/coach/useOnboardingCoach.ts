import { useCallback, useEffect, useMemo, useState } from "react";
import type { UiMode } from "../../game/GamePanels";
import type { Language } from "../../i18n";
import type { GameConfig, GameSave } from "../../types";
import type { CoachDirective, CoachFlags } from "./coachTypes";
import { coachActive, resolveCoach } from "./resolveCoach";

// 新手强引导 hook（docs/gdd/OnboardingCoach.md §4/§6）：持久标记落 localStorage，
// resolver 由存档 + uiMode + 后院运行时实时求出"此刻该点哪"。首次融合/跳过后整层退场。

const FLAGS_KEY = "gulugulu.coach";
const EMPTY: CoachFlags = { done: false, moved: false, switched: false, ceDone: false };

function loadFlags(): CoachFlags {
  try {
    const raw = window.localStorage.getItem(FLAGS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") {
      const p = parsed as Record<string, unknown>;
      return {
        done: p.done === true,
        moved: p.moved === true,
        switched: p.switched === true,
        ceDone: p.ceDone === true,
      };
    }
  } catch {
    // localStorage 不可用/损坏 → 从空标记开始
  }
  return { ...EMPTY };
}

export type OnboardingCoach = {
  directive: CoachDirective | null;
  active: boolean;
  markMoved: () => void;
  markSwitched: () => void;
  markCeDone: () => void;
  markDone: () => void;
};

export function useOnboardingCoach(input: {
  save: GameSave | null;
  config: GameConfig | null;
  uiMode: UiMode;
  hatcheryReady: boolean;
  nearShop: boolean;
  nearPetId: string | null;
  exhausted: boolean;
  /** 融合确认弹窗是否已打开（#8：打开时指引指向「开始融合」）。 */
  fusionModalOpen: boolean;
  /** 引导标签语言（App 持有的 language 状态；hook 在 Provider 之上，取不到 context）。 */
  lang: Language;
}): OnboardingCoach {
  const { save, config, uiMode, hatcheryReady, nearShop, nearPetId, exhausted, fusionModalOpen, lang } =
    input;
  const [flags, setFlags] = useState<CoachFlags>(loadFlags);

  const patch = useCallback((delta: Partial<CoachFlags>) => {
    setFlags((prev) => {
      if ((Object.keys(delta) as (keyof CoachFlags)[]).every((k) => prev[k] === delta[k])) return prev;
      const next = { ...prev, ...delta };
      try {
        window.localStorage.setItem(FLAGS_KEY, JSON.stringify(next));
      } catch {
        // 忽略持久化失败，本会话内仍生效
      }
      return next;
    });
  }, []);

  const markMoved = useCallback(() => patch({ moved: true }), [patch]);
  const markSwitched = useCallback(() => patch({ switched: true }), [patch]);
  const markCeDone = useCallback(() => patch({ ceDone: true }), [patch]);
  const markDone = useCallback(() => patch({ done: true }), [patch]);

  // #4 清档即重置引导：只要教学蛋在册 = 全新开局（清档必带教学蛋，即使 Steam 又导入了宠物），
  //    复位教练标记。localStorage 的 done 不随存档清除，否则清档后 coachDone 残留 → 手指不出现、
  //    反被 ambient 气泡引去后院。
  const freshStart = save != null && save.eggs.some((e) => e.hatchKind === "tutorial");
  useEffect(() => {
    if (!freshStart) return;
    setFlags((prev) => {
      if (!prev.done && !prev.moved && !prev.switched && !prev.ceDone) return prev;
      try {
        window.localStorage.setItem(FLAGS_KEY, JSON.stringify(EMPTY));
      } catch {
        // 忽略持久化失败
      }
      return { ...EMPTY };
    });
  }, [freshStart]);

  const directive = useMemo(() => {
    if (!save || !config) return null;
    return resolveCoach({ save, config, uiMode, lang, flags, hatcheryReady, nearShop, nearPetId, exhausted, fusionModalOpen });
  }, [save, config, uiMode, lang, flags, hatcheryReady, nearShop, nearPetId, exhausted, fusionModalOpen]);

  const active = useMemo(() => {
    if (!save || !config) return false;
    return coachActive({ save, config, uiMode, lang, flags, hatcheryReady, nearShop, nearPetId, exhausted, fusionModalOpen });
  }, [save, config, uiMode, lang, flags, hatcheryReady, nearShop, nearPetId, exhausted, fusionModalOpen]);

  return { directive, active, markMoved, markSwitched, markCeDone, markDone };
}
