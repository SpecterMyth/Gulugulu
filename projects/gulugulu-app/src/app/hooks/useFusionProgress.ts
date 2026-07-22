import { useEffect } from "react";
import type { GameBridge } from "../../game/bridge";
import { fmt, localizeGameMessage } from "../../i18n";
import { useT } from "../../useT";

/** AI 生成进度：设计完成/失败时全局提示（存档由 game://state 事件自动刷新）。
 *  progress.message 是 Rust/mock 的 "#key" 协议串——先本地化再套横幅模板。 */
export function useFusionProgress(bridge: GameBridge, showToastMsg: (text: string) => void): void {
  const { lang, T } = useT();
  useEffect(() => {
    const unsubscribe = bridge.onFusionProgress((progress) => {
      const msg = progress.message ? localizeGameMessage(progress.message, lang) : null;
      if (progress.phase === "resolved") {
        showToastMsg(fmt(T.sh.toast.fusionResolvedToast, { msg: msg ?? T.sh.toast.fusionDesignDoneFallback }));
      } else if (progress.phase === "failed" && msg) {
        showToastMsg(fmt(T.sh.toast.fusionBlockedToast, { msg }));
      }
    });
    return unsubscribe;
  }, [bridge, showToastMsg, lang, T]);
}
