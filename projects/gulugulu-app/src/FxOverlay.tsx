import { useEffect, useRef, useState } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import { WORK_FX, WorkBurst } from "./sprites/parts/workFx";

// -----------------------------------------------------------------------------
// 全屏打工特效覆盖层（"fx" 子窗口的根组件，见 main.tsx 的窗口 label 分流）。
// 窗口本体由 Rust 的 ensure_fx_overlay 创建：铺满显示器、透明、点击穿透、
// 不抢焦点。这里只做一件事：听主窗口发来的爆发事件，把 WorkBurst 渲染在
// 对应屏幕位置（screen 模式：粒子更多、飞得更远）。
// -----------------------------------------------------------------------------

/** 主窗口 → 覆盖层的爆发事件（fx://burst）。x/y 为发射点在本窗口的逻辑坐标。 */
type FxBurstPayload = {
  species: string;
  tier: number;
  seed: number;
  boom: boolean;
  x: number;
  y: number;
};

type OverlayBurst = FxBurstPayload & { id: number };

/** 覆盖 screen 模式粒子的最长滞空（dur 0.9+0.55 + delay 0.08 ≈ 1.53s）。 */
const BURST_LIFETIME_MS = 1700;

export function FxOverlay() {
  const [bursts, setBursts] = useState<OverlayBurst[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    let disposed = false;
    const unlistenPromise = listen<FxBurstPayload>("fx://burst", (event) => {
      if (disposed) return;
      const id = idRef.current + 1;
      idRef.current = id;
      setBursts((list) => [...list.slice(-23), { ...event.payload, id }]);
      window.setTimeout(() => {
        setBursts((list) => list.filter((item) => item.id !== id));
      }, BURST_LIFETIME_MS);
    });
    // 告知主窗口监听已就绪——在此之前发来的事件会丢，主窗口先回退窗口内粒子。
    void emitTo("main", "fx://ready", null).catch(() => undefined);
    return () => {
      disposed = true;
      void unlistenPromise.then((dispose) => dispose());
    };
  }, []);

  return (
    <div className="fx-overlay" aria-hidden="true">
      {bursts.map((burst) => {
        const emitter = WORK_FX[burst.species]?.emitter ?? { x: 128, y: 128 };
        return (
          <div
            key={burst.id}
            className="fx-overlay-burst"
            // 256 viewBox 以 1:1 渲染，把发射点精确对到主窗口里工具的屏幕位置
            style={{ left: burst.x - emitter.x, top: burst.y - emitter.y }}
          >
            <WorkBurst species={burst.species} tier={burst.tier} seed={burst.seed} boom={burst.boom} screen />
          </div>
        );
      })}
    </div>
  );
}
