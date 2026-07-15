import { useEffect } from "react";
import type { GameBridge } from "../../game/bridge";
import { setDynamicQuotes } from "../speech";

// 动态台词：挂载时拉一次已缓存批次，并订阅后台新批（quotes://ready）。连接
// Claude/Codex 后由后台 CLI 预生成，到达后灌入动态池，chooseQuote 便有 50%
// 概率走动态句（未连接/未生成时动态池为空 → 全走静态；见 setDynamicQuotes）。
export function useDynamicQuotes(bridge: GameBridge): void {
  useEffect(() => {
    let disposed = false;
    bridge
      .getDynamicQuotes()
      .then((entries) => {
        if (!disposed && entries.length > 0) setDynamicQuotes(entries);
      })
      .catch(() => undefined);
    const unsubscribe = bridge.onQuotesReady((entries) => {
      if (entries.length > 0) setDynamicQuotes(entries);
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [bridge]);
}
