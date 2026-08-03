import { type SetStateAction, useEffect, useRef, useState } from "react";
import type { GameBridge } from "../../game/bridge";
import type { GameSave, SteamStatus } from "../../types";
import { t, type Language } from "../../i18n";
import { errorMessage } from "../geometry";
import type { ConfirmGameDialog } from "../GameDialog";

/** Steam 集成状态：连接点/待发放/待认领（交易所面板显示；阻断项预先禁用）。
 *  跨账号存档：阻塞式确认后剥离绑定并重打当前账号（00-decisions.md）。 */
export function useSteamStatus(
  bridge: GameBridge,
  setSave: (action: SetStateAction<GameSave | null>) => void,
  showToastMsg: (text: string) => void,
  language: Language,
  confirmDialog: ConfirmGameDialog,
): SteamStatus | null {
  const T = t(language);
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
    let cancelled = false;
    void confirmDialog({
      title: T.sh.dialog.steamRebindTitle,
      message: T.sh.toast.steamRebindConfirm,
      confirmLabel: T.sh.dialog.confirm,
      cancelLabel: T.sh.dialog.cancel,
    }).then((accepted) => {
      if (!accepted || cancelled) return;
      bridge
        .steamConfirmRebind()
        .then((next) => {
          if (cancelled) return;
          setSave(next);
          showToastMsg(T.sh.toast.steamRebindDone);
        })
        .catch((error) => {
          if (!cancelled) showToastMsg(errorMessage(error));
        });
    });
    return () => {
      cancelled = true;
    };
  }, [steamStatus, bridge, setSave, showToastMsg, T, confirmDialog]);

  return steamStatus;
}
