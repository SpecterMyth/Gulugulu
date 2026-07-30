import { useEffect } from "react";
import type { GameBridge } from "../../game/bridge";
import { fmt, localizeGameMessage } from "../../i18n";
import { useT } from "../../useT";

export function isCodexUpgradeRequiredError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("codex") &&
    (normalized.includes("requires a newer version") ||
      normalized.includes("newer version of codex") ||
      normalized.includes("please upgrade to the latest app or cli") ||
      normalized.includes("upgrade codex"))
  );
}

/** AI 生成进度：设计完成/失败时全局提示（存档由 game://state 事件自动刷新）。
 *  progress.message 是 Rust/mock 的 "#key" 协议串——先本地化再套横幅模板。 */
export function useFusionProgress(
  bridge: GameBridge,
  showToastMsg: (text: string) => void,
  showCodexUpgradeGuide: () => void,
): void {
  const { lang, T } = useT();
  useEffect(() => {
    const unsubscribe = bridge.onFusionProgress((progress) => {
      const msg = progress.message ? localizeGameMessage(progress.message, lang) : null;
      if (progress.phase === "resolved") {
        showToastMsg(fmt(T.sh.toast.fusionResolvedToast, { msg: msg ?? T.sh.toast.fusionDesignDoneFallback }));
      } else if (progress.phase === "failed" && msg) {
        if (isCodexUpgradeRequiredError(progress.message ?? msg)) {
          showCodexUpgradeGuide();
        } else {
          showToastMsg(fmt(T.sh.toast.fusionBlockedToast, { msg }));
        }
      }
    });
    return unsubscribe;
  }, [bridge, showToastMsg, showCodexUpgradeGuide, lang, T]);
}
