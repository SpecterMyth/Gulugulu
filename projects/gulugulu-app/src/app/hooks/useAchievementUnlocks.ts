import { useEffect } from "react";
import type { GameBridge } from "../../game/bridge";
import { achievementDisplayName } from "../../game/achievements";
import { makePetEvent } from "../speech";
import type { PetEvent } from "../../types";
import { fmt } from "../../i18n";
import { useT } from "../../useT";

/** 成就解锁的应用内庆祝（SteamAchievements.md §5，用户定 P1）：🏆 toast + 宠物欢呼
 *  （success 庆祝跳）。无边框置顶小窗 + Steam 覆盖层可能被关，故不依赖覆盖层作唯一反馈。
 *  连上 Steam 的历史回填批由后端 **不 emit** 事件，开机不会被已达成成就刷屏（§4.3/§5）。 */
export function useAchievementUnlocks(
  bridge: GameBridge,
  showToastMsg: (text: string) => void,
  dispatchPetEvent: (event: PetEvent) => void,
): void {
  const { lang, T } = useT();
  useEffect(() => {
    const unsubscribe = bridge.onAchievementUnlocked((payload) => {
      const name = achievementDisplayName(payload.id, lang);
      showToastMsg(fmt(T.sh.toast.achievementUnlocked, { name }));
      dispatchPetEvent(makePetEvent("agent_work_finish"));
    });
    return unsubscribe;
  }, [bridge, showToastMsg, dispatchPetEvent, lang, T]);
}
