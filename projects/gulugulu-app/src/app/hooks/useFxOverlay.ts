import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../../tauri";
import { resolveWorkFx } from "../../sprites/parts/workFx";
import { getCustomWorkFx } from "../../sprites/customSpecies";
import { getSpeciesVisual } from "../../sprites/speciesTable";
import type { UiMode } from "../../game/GamePanels";

/** 全屏特效覆盖层：停手该时长后隐藏（覆盖 screen 模式粒子 ~1.5s 滞空） */
const FX_HIDE_DELAY_MS = 2000;

type WorkBurst = { id: number; tier: number; seed: number; boom: boolean };

type UseFxOverlayResult = {
  duckFacingRef: RefObject<HTMLDivElement | null>;
  ensureFxOverlay: () => Promise<boolean>;
  hideFxOverlay: () => void;
  spawnWorkBurst: (tier: number, boom: boolean) => void;
  workBursts: WorkBurst[];
};

/** —— 全屏特效覆盖层（"fx" 子窗口）：粒子飞出宠物小窗、满屏飘散 ——
 *  覆盖层是铺满显示器的透明点击穿透窗口（lib.rs ensure_fx_overlay），主窗口
 *  几何完全不动（不再有连点跳闪）。覆盖层未就绪/预览模式回退窗口内粒子。 */
export function useFxOverlay(uiMode: UiMode, activePetSpecies: string | null): UseFxOverlayResult {
  const [workBursts, setWorkBursts] = useState<WorkBurst[]>([]);
  const workBurstIdRef = useRef(0);

  const duckFacingRef = useRef<HTMLDivElement | null>(null);
  const fxVisibleRef = useRef(false);
  const fxEnsurePendingRef = useRef<Promise<boolean> | null>(null);
  const fxWebviewReadyRef = useRef(false);
  const fxHideTimerRef = useRef<number | null>(null);

  // fx webview 挂载回执：在收到 fx://ready 之前 emit 会被丢弃，先回退窗口内粒子。
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const unlistenPromise = listen("fx://ready", () => {
      if (!disposed) fxWebviewReadyRef.current = true;
    });
    return () => {
      disposed = true;
      void unlistenPromise.then((dispose) => dispose());
    };
  }, []);

  const ensureFxOverlay = useCallback((): Promise<boolean> => {
    if (!isTauri()) return Promise.resolve(false);
    if (fxVisibleRef.current) return Promise.resolve(true);
    if (!fxEnsurePendingRef.current) {
      fxEnsurePendingRef.current = invoke("ensure_fx_overlay")
        .then(() => {
          fxVisibleRef.current = true;
          return true;
        })
        .catch(() => false)
        .finally(() => {
          fxEnsurePendingRef.current = null;
        });
    }
    return fxEnsurePendingRef.current;
  }, []);

  const hideFxOverlay = useCallback(() => {
    if (fxHideTimerRef.current) {
      window.clearTimeout(fxHideTimerRef.current);
      fxHideTimerRef.current = null;
    }
    if (!isTauri() || !fxVisibleRef.current) return;
    fxVisibleRef.current = false;
    void invoke("hide_fx_overlay").catch(() => undefined);
  }, []);

  const scheduleFxHide = useCallback(() => {
    if (fxHideTimerRef.current) window.clearTimeout(fxHideTimerRef.current);
    fxHideTimerRef.current = window.setTimeout(() => {
      fxHideTimerRef.current = null;
      hideFxOverlay();
    }, FX_HIDE_DELAY_MS);
  }, [hideFxOverlay]);

  /** 把一次爆发发到全屏覆盖层；返回 false 表示未送达（调用方回退窗口内渲染）。
   *  AI 融合物种：粒子设计随事件负载携带（fx 子窗口没有物种注册表）。 */
  const emitFxBurst = useCallback(
    (species: string, tier: number, seed: number, boom: boolean): Promise<boolean> => {
      const el = duckFacingRef.current;
      // 粒子=工具产物：先解出该物种手中工具 id，再统一走 resolveWorkFx。
      const toolId = getSpeciesVisual(species, undefined)?.toolId ?? null;
      const customFx = getCustomWorkFx(species); // 非自定义物种返回 null
      const emitter = resolveWorkFx(species, toolId, customFx)?.emitter;
      if (!isTauri() || !el || !emitter) return Promise.resolve(false);
      return ensureFxOverlay().then(async (shown) => {
        if (!shown || !fxWebviewReadyRef.current) return false;
        try {
          const appWindow = getCurrentWindow();
          const [position, monitor] = await Promise.all([appWindow.outerPosition(), currentMonitor()]);
          const scale = window.devicePixelRatio || 1;
          // duck-facing 内的 256 viewBox（xMidYMid meet）→ CSS 坐标 → 覆盖层逻辑坐标，
          // 让覆盖层粒子精确从主窗口里工具的位置发射。
          const rect = el.getBoundingClientRect();
          const fit = Math.min(rect.width, rect.height) / 256;
          const emitterX = rect.left + (rect.width - 256 * fit) / 2 + emitter.x * fit;
          const emitterY = rect.top + (rect.height - 256 * fit) / 2 + emitter.y * fit;
          await emitTo("fx", "fx://burst", {
            species,
            tier,
            seed,
            boom,
            customFx,
            toolId,
            x: (position.x - (monitor?.position.x ?? 0)) / scale + emitterX,
            y: (position.y - (monitor?.position.y ?? 0)) / scale + emitterY,
          });
          return true;
        } catch {
          return false;
        }
      });
    },
    [ensureFxOverlay],
  );

  const pushLocalBurst = useCallback((tier: number, seed: number, boom: boolean) => {
    const id = workBurstIdRef.current + 1;
    workBurstIdRef.current = id;
    setWorkBursts((list) => [...list.slice(-7), { id, tier, seed, boom }]);
    window.setTimeout(() => {
      setWorkBursts((list) => list.filter((item) => item.id !== id));
    }, 1250);
  }, []);

  /** 一次工具粒子爆发：优先全屏覆盖层（满屏飘散），未就绪回退窗口内。 */
  const spawnWorkBurst = useCallback(
    (tier: number, boom: boolean) => {
      const seed = (Math.random() * 0xffffffff) >>> 0;
      if (isTauri() && activePetSpecies) {
        void emitFxBurst(activePetSpecies, tier, seed, boom).then((sent) => {
          if (!sent) pushLocalBurst(tier, seed, boom);
        });
        scheduleFxHide();
      } else {
        pushLocalBurst(tier, seed, boom);
      }
    },
    [activePetSpecies, emitFxBurst, pushLocalBurst, scheduleFxHide],
  );

  // 打工连击只发生在菜单模式：离开菜单即收起覆盖层（预热未用到的也一并回收）。
  useEffect(() => {
    if (uiMode !== "menu") hideFxOverlay();
  }, [uiMode, hideFxOverlay]);

  return { duckFacingRef, ensureFxOverlay, hideFxOverlay, spawnWorkBurst, workBursts };
}
