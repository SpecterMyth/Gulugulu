// 时间线引擎:主时钟(rAF)+ 场景路由类型。
// - 默认从 0 实时播放到 total;`?loop=1` 循环。
// - `?t=<ms>` 冻结在某时刻(静帧,截图验收用,不依赖虚拟时钟精度)。
// - `?beat=<i>` 从第 i 段起播(从 0 计;迭代单段用)。
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";

export type SceneProps = {
  /** 本场景内已播毫秒(0..dur)。 */
  localT: number;
  /** 本场景总时长毫秒。 */
  dur: number;
};

export type SceneDef = {
  id: string;
  /** 全片起点毫秒。 */
  at: number;
  /** 时长毫秒。 */
  dur: number;
  Comp: ComponentType<SceneProps>;
};

/** 场景首尾淡入淡出毫秒。 */
export const FADE = 360;

function numParam(name: string): number | null {
  try {
    const raw = new URLSearchParams(window.location.search).get(name);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** 从场景表算总时长。 */
export function totalDuration(scenes: SceneDef[]): number {
  return scenes.reduce((m, s) => Math.max(m, s.at + s.dur), 0);
}

/** 主时钟。返回当前全片毫秒 now,以及是否处于冻结(静帧)态。 */
export function useTrailerClock(scenes: SceneDef[]): { now: number; frozen: boolean; total: number } {
  const total = useMemo(() => totalDuration(scenes), [scenes]);
  const { frozenAt, initial, loop } = useMemo(() => {
    const t = numParam("t");
    const beat = numParam("beat");
    const start = beat != null && scenes[beat] ? scenes[beat].at : 0;
    let loopParam = false;
    try {
      loopParam = new URLSearchParams(window.location.search).get("loop") === "1";
    } catch {
      /* 忽略 */
    }
    return { frozenAt: t, initial: start, loop: loopParam };
  }, [scenes]);

  const [now, setNow] = useState<number>(frozenAt ?? initial);

  useEffect(() => {
    if (frozenAt != null) {
      setNow(frozenAt);
      return;
    }
    // 导出模式(?render=1):由 TrailerPlayer 的 window.__seek 逐帧驱动,不跑 rAF
    // (避免无头里 rAF 主循环干扰 CDP)。
    try {
      if (new URLSearchParams(window.location.search).has("render")) return;
    } catch {
      /* 忽略 */
    }
    // 时基锚在挂载时刻(performance.now 起点),而非首个 rAF 回调——后者在无头
    // 虚拟时钟下会落在预算末尾,导致 now 恒为 0。锚在挂载则真机/虚拟时钟皆正确推进。
    let start = performance.now() - initial;
    let raf = 0;
    const tick = () => {
      let e = performance.now() - start;
      if (e >= total) {
        if (loop) {
          start = performance.now();
          e = 0;
        } else {
          setNow(total);
          return;
        }
      }
      setNow(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frozenAt, initial, loop, total]);

  return { now, frozen: frozenAt != null, total };
}
