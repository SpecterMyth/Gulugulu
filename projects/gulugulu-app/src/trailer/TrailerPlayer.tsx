// 播放器:装配 6 段场景表 → 跑主时钟 → 固定 1920×1080 舞台 letterbox 适配视口。
// 录屏走 `npm run dev` → Chrome 打开 /trailer.html → F11 全屏 → OBS 录 ~74s 一条过。
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { useTrailerClock, type SceneDef } from "./timeline";
import {
  ColdOpen,
  COLD_DUR,
  LiveReaction,
  LIVE_DUR,
  KeyboardFeed,
  KEYS_DUR,
  Collection,
  COLLECT_DUR,
  AiCreation,
  CREATE_DUR,
  WorkshopTrade,
  TRADE_DUR,
  EndCard,
  END_DUR,
} from "./scenes";
import { LANG } from "./ui";

// 7 段分镜;时长由各场景按 layoutCaps(每行打完停 ≥2s)自动派生,中英文各自算出总长。
// 顺序:冷开场 → 实时反应 → 键盘喂养 → 多样性 → AI 创作(重头)→ 工坊+交易 → 尾卡。
const SCENES: SceneDef[] = (() => {
  const defs: Array<Omit<SceneDef, "at">> = [
    { id: "cold", dur: COLD_DUR, Comp: ColdOpen },
    { id: "live", dur: LIVE_DUR, Comp: LiveReaction },
    { id: "keys", dur: KEYS_DUR, Comp: KeyboardFeed },
    { id: "collect", dur: COLLECT_DUR, Comp: Collection },
    { id: "create", dur: CREATE_DUR, Comp: AiCreation },
    { id: "trade", dur: TRADE_DUR, Comp: WorkshopTrade },
    { id: "end", dur: END_DUR, Comp: EndCard },
  ];
  let at = 0;
  return defs.map((d) => {
    const s: SceneDef = { ...d, at };
    at += d.dur;
    return s;
  });
})();

function hasParam(name: string): boolean {
  try {
    return new URLSearchParams(window.location.search).has(name);
  } catch {
    return false;
  }
}

export function TrailerPlayer() {
  const { now: clockNow, total } = useTrailerClock(SCENES);
  const [fit, setFit] = useState(1);
  // 渲染导出:render_video.mjs 逐帧调用 window.__seek(ms) 精确定位(不靠无头 rAF)。
  const [renderT, setRenderT] = useState<number | null>(null);

  useEffect(() => {
    const on = () => setFit(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  useEffect(() => {
    const w = window as unknown as { __seek?: (t: number) => void; __TRAILER_TOTAL?: number };
    w.__seek = (t: number) => {
      // 1) 同步提交 React(定住字幕/场景/位置);2) 把所有 CSS 动画暂停并定到该帧时间。
      // 导出时角色 CSS 动画完全由此确定性驱动,不受真实墙钟影响(否则每帧多跑约一帧
      // 真实处理耗时 → 又快又抖)。
      flushSync(() => setRenderT(t));
      try {
        void document.documentElement.offsetHeight; // 强制样式重算,让新挂载元素的动画就位
        for (const a of document.getAnimations()) {
          try {
            a.pause();
            a.currentTime = t;
          } catch {
            /* 个别动画不可 seek,忽略 */
          }
        }
      } catch {
        /* 忽略 */
      }
    };
    w.__TRAILER_TOTAL = total; // 供导出脚本读取本语言总长
  }, [total]);

  const now = renderT ?? clockNow;
  const clean = useMemo(() => hasParam("shot") || hasParam("t") || hasParam("clean") || hasParam("render"), []);

  const active = SCENES.find((s) => now >= s.at && now < s.at + s.dur) ?? SCENES[SCENES.length - 1];
  const localT = Math.min(active.dur, now - active.at);
  const Comp = active.Comp;

  return (
    <div className="trailer-root">
      <div className={`trailer-stage lang-${LANG}`} style={{ ["--fit" as string]: fit } as CSSProperties}>
        {/* key=场景 id:切段即重挂,让每段动画从头播 */}
        <Comp key={active.id} localT={localT} dur={active.dur} />
        {/* 高级感覆盖层:扫描线 + 暗角(始终最上) */}
        <div className="stage-fx" />
      </div>
      {!clean && (
        <>
          <div className="tr-progress" style={{ width: `${(now / total) * 100}vw` }} />
          <div className="tr-hud">
            {(now / 1000).toFixed(1)}s / {(total / 1000).toFixed(0)}s · {active.id}
          </div>
          <button className="tr-replay" onClick={() => window.location.reload()}>
            ⟲ Replay
          </button>
        </>
      )}
    </div>
  );
}
