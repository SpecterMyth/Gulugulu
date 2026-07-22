import { memo } from "react";
import type { CelestialBody, DayPhase } from "./dayNight";
import { rgbCss } from "./dayNight";
import { abs } from "./backyardShared";

// ---------------------------------------------------------------------------
// 昼夜天空层：太阳 / 月亮 / 地平线光晕 / 星星。视口锚定（不随相机平移），置于
// 视差层「之后」的最底层——低空天体会自然被前方远山遮住（落山/月出的掩映感）。
// 天空保持透明：这里只画「会发光的浮层」（合规：只加亮不压暗），空白处仍透出桌面。
// ---------------------------------------------------------------------------

/** 天顶 / 地平线的 top 落位（舞台设计坐标 560 高，origin 左下）。
 *  ⚠️ 后院停靠成底部窄条窗：只显示舞台底部 VIEW_H(420) 一段，可视上缘 ≈ stage-top 140，
 *  再往上就是窗外（透明窗直接透出桌面）。天顶必须给「日面半径 + 光晕」留足余量，否则太阳
 *  升到最高时顶部会被窗口上缘硬裁（露出桌面成一条切线）。故 ZENITH_TOP 取 210
 *  （日面半径 38 → 顶边 172，距上缘 32px），既够高又整颗在窗内；低空落到远山线被山遮住。 */
const ZENITH_TOP = 210;
const HORIZON_TOP = 296;

const SUN_SIZE = 76;
const MOON_SIZE = 58;

function topForAltitude(altitude: number): number {
  return HORIZON_TOP + (ZENITH_TOP - HORIZON_TOP) * altitude;
}

function leftForX(x: number): string {
  return `${(x * 100).toFixed(2)}%`;
}

/** 固定伪随机的星点（避免用 Math.random——SSR/重渲一致）。x/y 为百分比/舞台 top。 */
const STARS: Array<{ x: number; top: number; s: number; delay: number }> = [
  { x: 8, top: 168, s: 2.2, delay: 0 },
  { x: 15, top: 210, s: 1.6, delay: 1.3 },
  { x: 21, top: 150, s: 2.6, delay: 2.1 },
  { x: 27, top: 232, s: 1.5, delay: 0.6 },
  { x: 34, top: 178, s: 2.0, delay: 1.8 },
  { x: 41, top: 205, s: 1.7, delay: 3.0 },
  { x: 47, top: 158, s: 2.4, delay: 0.9 },
  { x: 53, top: 224, s: 1.5, delay: 2.6 },
  { x: 59, top: 186, s: 2.1, delay: 1.1 },
  { x: 64, top: 162, s: 1.8, delay: 3.4 },
  { x: 70, top: 216, s: 2.5, delay: 0.3 },
  { x: 76, top: 176, s: 1.6, delay: 2.3 },
  { x: 82, top: 200, s: 2.0, delay: 1.5 },
  { x: 88, top: 154, s: 2.3, delay: 0.7 },
  { x: 92, top: 230, s: 1.5, delay: 2.9 },
  { x: 4, top: 244, s: 1.6, delay: 1.9 },
  { x: 37, top: 250, s: 1.5, delay: 0.4 },
  { x: 67, top: 246, s: 1.7, delay: 3.1 },
];

function SunDisc({ body }: { body: CelestialBody }) {
  const disc = rgbCss(body.disc);
  return (
    <div
      className="by-celestial by-sun"
      style={abs({
        left: leftForX(body.x),
        top: topForAltitude(body.altitude),
        width: SUN_SIZE,
        height: SUN_SIZE,
        transform: "translate(-50%,-50%)",
        opacity: body.opacity,
        borderRadius: "50%",
        background: `radial-gradient(circle at 46% 42%, #fff8e0 0 30%, ${disc} 60%, ${rgbCss(body.disc, 0)} 74%)`,
        // 末段实心环给天体一个描边：透明天空透出亮桌面时也不至于糊没（暗桌面上几乎不可见）。
        boxShadow: `0 0 26px 8px ${rgbCss(body.disc, 0.5)}, 0 0 60px 24px ${rgbCss(body.disc, 0.24)}, 0 0 0 2px rgba(214,150,60,0.4)`,
      })}
    >
      <span className="by-celestial-aura" style={{ background: `radial-gradient(circle, ${rgbCss(body.disc, 0.4)} 0%, ${rgbCss(body.disc, 0)} 68%)` }} />
    </div>
  );
}

function MoonDisc({ body }: { body: CelestialBody }) {
  const disc = rgbCss(body.disc);
  return (
    <div
      className="by-celestial by-moon"
      style={abs({
        left: leftForX(body.x),
        top: topForAltitude(body.altitude),
        width: MOON_SIZE,
        height: MOON_SIZE,
        transform: "translate(-50%,-50%)",
        opacity: body.opacity,
        borderRadius: "50%",
        background: `radial-gradient(circle at 40% 38%, #ffffff 0 26%, ${disc} 66%, ${rgbCss(body.disc, 0)} 80%)`,
        // 末段实心环给月盘描边：亮桌面透过透明天空时也能看清（暗桌面上几乎不可见）。
        boxShadow: `0 0 20px 6px ${rgbCss(body.disc, 0.42)}, 0 0 46px 18px ${rgbCss(body.disc, 0.2)}, 0 0 0 2px rgba(96,116,158,0.5)`,
      })}
    >
      {/* 环形山阴影：轻微内凹，弱化「纯圆点」感 */}
      <span
        className="by-moon-crater"
        style={abs({ left: "54%", top: "30%", width: "22%", height: "22%", borderRadius: "50%", background: rgbCss(body.disc, 0.5) })}
      />
      <span
        className="by-moon-crater"
        style={abs({ left: "34%", top: "58%", width: "16%", height: "16%", borderRadius: "50%", background: rgbCss(body.disc, 0.45) })}
      />
      <span className="by-celestial-aura" style={{ background: `radial-gradient(circle, ${rgbCss(body.disc, 0.34)} 0%, ${rgbCss(body.disc, 0)} 70%)` }} />
    </div>
  );
}

/** 白天掠过天空的小鸟（视口锚定，left 横穿；数值经预览调校）。 */
const BIRDS: Array<{ top: number; dur: number; delay: number }> = [
  { top: 150, dur: 26, delay: 0 },
  { top: 182, dur: 32, delay: 7 },
  { top: 138, dur: 29, delay: 15 },
];

export const BackyardSky = memo(function BackyardSky({ phase }: { phase: DayPhase }) {
  const { sun, moon, glow, starOpacity, daylight } = phase;
  return (
    <div className="by-sky" style={abs({ inset: 0 })} aria-hidden="true">
      {daylight > 0.15 && (
        <div className="by-birds" style={{ opacity: daylight }}>
          {BIRDS.map((bird, index) => (
            <span
              key={index}
              className="by-bird"
              style={abs({ top: bird.top, animationDuration: `${bird.dur}s`, animationDelay: `${bird.delay}s` })}
            >
              <span className="by-bird-w by-bird-wl" />
              <span className="by-bird-w by-bird-wr" />
            </span>
          ))}
        </div>
      )}
      {/* 地平线光晕：黄昏偏橙、夜里偏蓝——落在远山线附近，从山后透出天色。 */}
      {glow.alpha > 0.01 && (
        <div
          className="by-sky-glow"
          style={abs({
            left: leftForX(glow.x),
            top: HORIZON_TOP - 6,
            width: 760,
            height: 300,
            transform: "translate(-50%,-50%)",
            background: `radial-gradient(ellipse at 50% 60%, ${rgbCss(glow.color, glow.alpha)} 0%, ${rgbCss(glow.color, glow.alpha * 0.5)} 34%, ${rgbCss(glow.color, 0)} 70%)`,
          })}
        />
      )}

      {starOpacity > 0.015 && (
        <div className="by-stars" style={{ opacity: starOpacity }}>
          {STARS.map((star, index) => (
            <span
              key={index}
              className="by-star"
              style={abs({
                left: `${star.x}%`,
                top: star.top,
                width: star.s,
                height: star.s,
                animationDelay: `${star.delay}s`,
              })}
            />
          ))}
        </div>
      )}

      {moon.opacity > 0.015 && <MoonDisc body={moon} />}
      {sun.opacity > 0.015 && <SunDisc body={sun} />}
    </div>
  );
});
