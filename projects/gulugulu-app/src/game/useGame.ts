import { useEffect, useMemo, useState } from "react";
import type { GameConfig, GameSave } from "../types";
import { getGameBridge } from "./bridge";

/** Loads the game config + save, subscribes to backend tick pushes, and polls
 *  as a safety net. All mutations go through the returned bridge and should
 *  setSave() with the returned snapshot. */
export function useGame() {
  const bridge = useMemo(() => getGameBridge(), []);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [save, setSave] = useState<GameSave | null>(null);

  useEffect(() => {
    let disposed = false;
    bridge
      .getConfig()
      .then((payload) => {
        if (disposed) return;
        setConfig(payload.config);
        setTestMode(payload.testMode);
      })
      .catch(() => undefined);
    bridge
      .getState()
      .then((next) => {
        if (!disposed) setSave(next);
      })
      .catch(() => undefined);

    const unsubscribe = bridge.onStateEvent((next) => {
      if (!disposed) setSave(next);
    });
    const poll = window.setInterval(() => {
      bridge
        .getState()
        .then((next) => {
          if (!disposed) setSave(next);
        })
        .catch(() => undefined);
    }, 5000);

    return () => {
      disposed = true;
      unsubscribe();
      window.clearInterval(poll);
    };
  }, [bridge]);

  return { bridge, config, testMode, save, setSave };
}

/** 1s ticker for countdowns; only active while `enabled`. */
export function useNowSeconds(enabled: boolean): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return now;
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
