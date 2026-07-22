import { type SetStateAction, useEffect, useRef, useState } from "react";
import type { GameBridge } from "../../game/bridge";
import type { GameSave, SteamStatus } from "../../types";
import { errorMessage } from "../geometry";
import { useT } from "../../useT";

/** Steam 集成状态：连接点/待发放/待认领（交易所面板显示；阻断项预先禁用）。
 *  跨账号存档：阻塞式确认后剥离绑定并重打当前账号（00-decisions.md）。 */
export function useSteamStatus(
  bridge: GameBridge,
  setSave: (action: SetStateAction<GameSave | null>) => void,
  showToastMsg: (text: string) => void,
): SteamStatus | null {
  const { T } = useT();
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

  // 云存档 flush：窗口隐藏 / 卸载前 best-effort 推一轮云，兜住最后 <30s（泵内按内容
  // 哈希判变化，未变不真上传；预览模式 MockBridge 空操作）。SteamCloudSync.md。
  useEffect(() => {
    const flush = () => {
      void bridge.steamCloudSyncNow().catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", flush);
    };
  }, [bridge]);

  useEffect(() => {
    if (!steamStatus?.ownerMismatch || ownerPromptedRef.current) return;
    ownerPromptedRef.current = true;
    const ok = window.confirm(T.sh.toast.steamRebindConfirm);
    if (ok) {
      bridge
        .steamConfirmRebind()
        .then((next) => {
          setSave(next);
          showToastMsg(T.sh.toast.steamRebindDone);
        })
        .catch((error) => showToastMsg(errorMessage(error)));
    }
  }, [steamStatus, bridge, setSave, showToastMsg, T]);

  return steamStatus;
}
