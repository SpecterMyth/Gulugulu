import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import type { GameConfig, GameSave } from "../types";
import { getGameBridge } from "./bridge";
import { registerCustomSpecies, registerSkinState } from "../sprites/customSpecies";

/** Loads the game config + save, subscribes to backend tick pushes, and polls
 *  as a safety net. All mutations go through the returned bridge and should
 *  setSave() with the returned snapshot.
 *
 *  存档三条路径（首载/事件推送/轮询）与所有变更回写都走这里包装过的
 *  setSave：先把 save.customSpecies 灌进精灵运行时注册表（AI 融合物种）、
 *  再灌皮肤选择覆盖表（registerSkinState，默认皮肤解析需要 config），
 *  最后进 React 状态，保证渲染时视觉表已就绪。返回的 config 是"有效配置"
 *  （config.species 合并自定义物种），下游名字/配色/元素查询零改动生效。 */
export function useGame() {
  const bridge = useMemo(() => getGameBridge(), []);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [save, setSaveRaw] = useState<GameSave | null>(null);
  // registerSkinState 需要原始 config（speciesByRecipe）；ref 保证 setSave 回调
  // 无需依赖 config 状态（避免重建回调）。
  const configRef = useRef<GameConfig | null>(null);
  const saveRef = useRef<GameSave | null>(null);

  const setSave = useCallback((action: SetStateAction<GameSave | null>) => {
    if (typeof action !== "function") {
      if (action) {
        registerCustomSpecies(action.customSpecies);
        registerSkinState(action, configRef.current);
      }
      saveRef.current = action;
      setSaveRaw(action);
      return;
    }
    setSaveRaw((prev) => {
      const next = (action as (p: GameSave | null) => GameSave | null)(prev);
      if (next) {
        registerCustomSpecies(next.customSpecies);
        registerSkinState(next, configRef.current);
      }
      saveRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    bridge
      .getConfig()
      .then((payload) => {
        if (disposed) return;
        configRef.current = payload.config;
        // 首帧 config 晚于 save 到达时补灌一次（默认皮肤解析依赖 speciesByRecipe）。
        if (saveRef.current) registerSkinState(saveRef.current, payload.config);
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
  }, [bridge, setSave]);

  const effectiveConfig = useMemo(() => {
    if (!config) return null;
    const customs = save?.customSpecies;
    if (!customs || Object.keys(customs).length === 0) return config;
    const species = { ...config.species };
    for (const [codename, entry] of Object.entries(customs)) {
      species[codename] = entry.info;
    }
    return { ...config, species };
  }, [config, save?.customSpecies]);

  return { bridge, config: effectiveConfig, testMode, save, setSave };
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
