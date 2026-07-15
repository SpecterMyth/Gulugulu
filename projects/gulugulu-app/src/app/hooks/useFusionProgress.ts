import { useEffect } from "react";
import type { GameBridge } from "../../game/bridge";

/** AI 生成进度：设计完成/失败时全局提示（存档由 game://state 事件自动刷新）。 */
export function useFusionProgress(bridge: GameBridge, showToastMsg: (text: string) => void): void {
  useEffect(() => {
    const unsubscribe = bridge.onFusionProgress((progress) => {
      if (progress.phase === "resolved") {
        showToastMsg(`🎉 ${progress.message ?? "新物种设计完成！"}`);
      } else if (progress.phase === "failed" && progress.message) {
        showToastMsg(`融合生成受阻：${progress.message}`);
      }
    });
    return unsubscribe;
  }, [bridge, showToastMsg]);
}
