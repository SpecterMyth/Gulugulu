import { type SetStateAction, useEffect, useRef, useState } from "react";
import type { GameBridge } from "../../game/bridge";
import type { GameSave, SteamStatus } from "../../types";
import { errorMessage } from "../geometry";

/** Steam 集成状态：连接点/待发放/待认领（交易所面板显示；阻断项预先禁用）。
 *  跨账号存档：阻塞式确认后剥离绑定并重打当前账号（00-decisions.md）。 */
export function useSteamStatus(
  bridge: GameBridge,
  setSave: (action: SetStateAction<GameSave | null>) => void,
  showToastMsg: (text: string) => void,
): SteamStatus | null {
  const [steamStatus, setSteamStatus] = useState<SteamStatus | null>(null);
  const ownerPromptedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    bridge
      .getSteamStatus()
      .then((status) => {
        if (!cancelled) setSteamStatus(status);
      })
      .catch(() => {});
    const unsubscribe = bridge.onSteamStatus((status) => setSteamStatus(status));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [bridge]);

  useEffect(() => {
    if (!steamStatus?.ownerMismatch || ownerPromptedRef.current) return;
    ownerPromptedRef.current = true;
    const ok = window.confirm(
      "此存档绑定的是另一个 Steam 账号。\n确认后将解除旧绑定，并以当前账号的 Steam 库存为准重新同步（本地精灵保留）。\n现在重绑吗？",
    );
    if (ok) {
      bridge
        .steamConfirmRebind()
        .then((next) => {
          setSave(next);
          showToastMsg("已重绑当前 Steam 账号");
        })
        .catch((error) => showToastMsg(errorMessage(error)));
    }
  }, [steamStatus, bridge, setSave, showToastMsg]);

  return steamStatus;
}
