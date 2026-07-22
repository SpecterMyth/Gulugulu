import { memo } from "react";
import { abs } from "./backyardShared";

// ---------------------------------------------------------------------------
// 后院氛围动态（世界锚定，随相机平移）：夜里的萤火虫、白天的蝴蝶、池塘水光。
// 不受实景调色 filter 影响。萤火虫强度随夜色(starOpacity)、蝴蝶随白昼度(daylight)
// 淡入淡出；接近纯白天/纯黑夜时用 display:none 省去无谓的动画开销。
// ---------------------------------------------------------------------------

/** 萤火虫：夜里贴地飘舞的荧点，散布在各自然带（避开功能建筑正面）。 */
const FIREFLIES: Array<{ x: number; bottom: number; v: number; dur: number; delay: number }> = [
  { x: -520, bottom: 176, v: 0, dur: 7.5, delay: 0 },
  { x: -360, bottom: 210, v: 1, dur: 8.2, delay: 1.4 },
  { x: 560, bottom: 186, v: 2, dur: 6.8, delay: 0.8 },
  { x: 720, bottom: 220, v: 0, dur: 8.6, delay: 2.2 },
  { x: 1420, bottom: 196, v: 1, dur: 7.2, delay: 0.4 },
  { x: 1660, bottom: 172, v: 2, dur: 9.0, delay: 1.9 },
  { x: 2040, bottom: 214, v: 0, dur: 7.8, delay: 3.1 },
  { x: 2760, bottom: 188, v: 1, dur: 8.4, delay: 0.6 },
  { x: 3020, bottom: 224, v: 2, dur: 6.6, delay: 2.6 },
  { x: 4260, bottom: 196, v: 0, dur: 8.8, delay: 1.2 },
  { x: 4460, bottom: 230, v: 1, dur: 7.4, delay: 3.3 },
  { x: 5140, bottom: 182, v: 2, dur: 8.0, delay: 0.9 },
  { x: 5360, bottom: 216, v: 0, dur: 7.0, delay: 2.0 },
  { x: 6040, bottom: 200, v: 1, dur: 8.5, delay: 1.6 },
  { x: 6360, bottom: 176, v: 2, dur: 7.6, delay: 3.0 },
  { x: 6600, bottom: 224, v: 0, dur: 8.1, delay: 0.5 },
];

/** 蝴蝶：白天在花丛/果园附近翩飞。 */
const BUTTERFLIES: Array<{ x: number; bottom: number; v: number; dur: number; delay: number; color: string }> = [
  { x: 1440, bottom: 208, v: 0, dur: 9, delay: 0, color: "#F5917B" },
  { x: 1560, bottom: 230, v: 1, dur: 10.5, delay: 1.7, color: "#F7C948" },
  { x: 4320, bottom: 250, v: 0, dur: 9.8, delay: 0.9, color: "#9BB8F0" },
  { x: 4480, bottom: 224, v: 1, dur: 11, delay: 2.4, color: "#F5917B" },
  { x: -560, bottom: 214, v: 0, dur: 10, delay: 1.2, color: "#F7C948" },
  { x: 6560, bottom: 236, v: 1, dur: 9.4, delay: 0.3, color: "#C89BF0" },
];

/** 池塘水面反光条（世界锚定在池塘椭圆内，缓慢明灭）。 */
const RIPPLES: Array<{ x: number; bottom: number; w: number; dur: number; delay: number }> = [
  { x: 1940, bottom: 150, w: 60, dur: 4.6, delay: 0 },
  { x: 2020, bottom: 160, w: 44, dur: 5.4, delay: 1.3 },
  { x: 2090, bottom: 152, w: 52, dur: 4.2, delay: 2.1 },
];

function Butterfly({ b }: { b: (typeof BUTTERFLIES)[number] }) {
  return (
    <span
      className={`by-butterfly by-butterfly-path-${b.v}`}
      style={abs({ left: b.x, bottom: b.bottom, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` })}
    >
      <span className="by-bf-wing by-bf-wing-l" style={{ background: b.color }} />
      <span className="by-bf-wing by-bf-wing-r" style={{ background: b.color }} />
    </span>
  );
}

export const BackyardAmbient = memo(function BackyardAmbient({ starOpacity, daylight }: { starOpacity: number; daylight: number }) {
  const showFireflies = starOpacity > 0.02;
  const showButterflies = daylight > 0.05;
  return (
    <div className="by-ambient" aria-hidden="true">
      {/* 池塘水光（常驻） */}
      {RIPPLES.map((r, index) => (
        <span
          key={`rp${index}`}
          className="by-ripple"
          style={abs({ left: r.x - r.w / 2, bottom: r.bottom, width: r.w, height: 5, animationDuration: `${r.dur}s`, animationDelay: `${r.delay}s` })}
        />
      ))}

      {/* 蝴蝶（白天） */}
      <div className="by-butterflies" style={{ opacity: daylight, display: showButterflies ? "block" : "none" }}>
        {BUTTERFLIES.map((b, index) => (
          <Butterfly key={`bf${index}`} b={b} />
        ))}
      </div>

      {/* 萤火虫（夜里） */}
      <div className="by-fireflies" style={{ opacity: starOpacity, display: showFireflies ? "block" : "none" }}>
        {FIREFLIES.map((f, index) => (
          <span
            key={`ff${index}`}
            className={`by-firefly by-firefly-${f.v}`}
            style={abs({ left: f.x, bottom: f.bottom, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` })}
          />
        ))}
      </div>
    </div>
  );
});
