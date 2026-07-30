import { useEffect } from "react";
import type { GameBridge } from "../../game/bridge";
import { achievementDisplayName } from "../../game/achievements";
import { makePetEvent } from "../speech";
import type { PetEvent } from "../../types";
import { useT } from "../../useT";
import { emitPaperFx } from "../../ui/PaperFx";

/** 成就解锁的应用内庆祝（SteamAchievements.md §5，用户定 P1）：🏆 toast + 宠物欢呼
 *  （success 庆祝跳）。无边框置顶小窗 + Steam 覆盖层可能被关，故不依赖覆盖层作唯一反馈。
 *  连上 Steam 的历史回填批由后端 **不 emit** 事件，开机不会被已达成成就刷屏（§4.3/§5）。 */
export function useAchievementUnlocks(
  bridge: GameBridge,
  _showToastMsg: (text: string) => void,
  dispatchPetEvent: (event: PetEvent) => void,
): void {
  const { lang } = useT();
  useEffect(() => {
    const pending = new Map<string, string>();
    let timer: number | null = null;
    const flush = () => {
      timer = null;
      if (pending.size === 0) return;
      const ids = [...pending.keys()].sort();
      const names = [...pending.values()];
      pending.clear();
      const joined = names.join(lang === "zh" ? "、" : ", ");
      emitPaperFx({
        intensity: 2,
        preset: "achievement",
        label: lang === "zh" ? `成就解锁 · ${joined}` : `ACHIEVEMENT · ${joined}`,
        eventId: `achievement:${ids.join("+")}`,
        dedupeKey: `achievement:${ids.join("+")}`,
        palette: ["#ffd75a", "#fff1a8", "#ef6d5a", "#63b7a7", "#fffdf1"],
      });
      dispatchPetEvent(makePetEvent("agent_work_finish"));
    };
    const unsubscribe = bridge.onAchievementUnlocked((payload) => {
      pending.set(payload.id, achievementDisplayName(payload.id, lang));
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(flush, 220);
    });
    return () => {
      unsubscribe();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [bridge, dispatchPetEvent, lang]);
}
