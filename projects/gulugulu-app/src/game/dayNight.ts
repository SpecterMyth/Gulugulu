// ---------------------------------------------------------------------------
// 后院「真实时间昼夜系统」纯逻辑（无 React / DOM 依赖，可单测）。
//
// 输入：本地小时（0..24 的小数）。输出：一整套随时间连续变化的视觉参数——
//   · scene / pet：给实景（远/中/近布景）与宠物用的 CSS filter 调色（亮度+色温）
//   · sun / moon：太阳、月亮各自的横向位置 x(0..1) / 高度 altitude(0..1) / 透明度 / 盘面色
//   · glow：地平线暖/冷光晕（黄昏偏橙、夜里偏蓝）
//   · windowLight：建筑窗户点灯强度（0=白天灭，1=深夜全亮）
//   · starOpacity：星星 / 萤火虫等「夜间氛围」强度
//
// 天空保持透明（露出桌面）——所以「变暗」靠给实景像素上 filter 调色，而非压一层
// 暗幕（透明窗里暗幕会勾出窗口矩形边界）。太阳/月亮/光晕是「只加亮」的浮层，合规。
// ---------------------------------------------------------------------------

export type DayGrade = {
  brightness: number;
  saturate: number;
  sepia: number;
  hueRotate: number;
  contrast: number;
};

export type Rgb = [number, number, number];

export type CelestialBody = {
  kind: "sun" | "moon";
  /** 视口横向位置：0=最左（东方升起），1=最右（西方落下）。 */
  x: number;
  /** 高度：0=地平线，1=天顶。用于竖直落位与盘面/光晕强度。 */
  altitude: number;
  /** 可见度：升落之际淡入淡出，白天月亮=0、夜里太阳=0。 */
  opacity: number;
  /** 盘面颜色（低空偏暖橙，高空偏白/冷）。 */
  disc: Rgb;
};

export type DayPhase = {
  /** 归一化后的本地小时（0..24）。 */
  hour: number;
  label: "night" | "dawn" | "day" | "dusk";
  /** 便捷「白昼度」0..1：驱动小鸟/蝴蝶等白天氛围。 */
  daylight: number;
  /** 布景调色（远/中/近实景像素）。宠物本身颜色**不**随昼夜变化（用户要求）。 */
  scene: DayGrade;
  windowLight: number;
  starOpacity: number;
  sun: CelestialBody;
  moon: CelestialBody;
  glow: { color: Rgb; alpha: number; x: number };
};

type Stop = {
  h: number;
  sb: number; // scene brightness
  ss: number; // scene saturate
  ssep: number; // scene sepia
  shue: number; // scene hue-rotate(deg)
  scon: number; // scene contrast
  glow: Rgb;
  glowA: number;
  win: number; // window light
  star: number; // star / firefly
};

// 一日内的关键时刻「关键帧」，其间按小时线性插值。色温用 sepia→hue-rotate 技巧：
// sepia 先把画面压成棕褐单色，再用 hue-rotate 旋到目标色（-向暖橙、+~200 向夜蓝）。
// 黄昏→夜的过渡刻意把 sepia 压低（19.6 那档），避免旋转途中扫出突兀的绿。
const STOPS: Stop[] = [
  { h: 0.0, sb: 0.6, ss: 0.84, ssep: 0.34, shue: 202, scon: 1.03, glow: [78, 98, 168], glowA: 0.3, win: 1.0, star: 0.9 },
  { h: 5.0, sb: 0.62, ss: 0.86, ssep: 0.32, shue: 205, scon: 1.03, glow: [96, 112, 170], glowA: 0.26, win: 0.95, star: 0.62 },
  { h: 6.4, sb: 0.84, ss: 1.16, ssep: 0.34, shue: -14, scon: 1.0, glow: [255, 166, 116], glowA: 0.52, win: 0.55, star: 0.05 },
  { h: 9.0, sb: 1.0, ss: 1.05, ssep: 0.05, shue: -4, scon: 1.0, glow: [255, 226, 150], glowA: 0.26, win: 0.14, star: 0.0 },
  { h: 13.0, sb: 1.06, ss: 1.0, ssep: 0.0, shue: 0, scon: 1.0, glow: [255, 240, 190], glowA: 0.16, win: 0.0, star: 0.0 },
  { h: 16.5, sb: 1.0, ss: 1.06, ssep: 0.06, shue: -6, scon: 1.0, glow: [255, 214, 150], glowA: 0.24, win: 0.1, star: 0.0 },
  { h: 18.6, sb: 0.8, ss: 1.22, ssep: 0.4, shue: -24, scon: 1.03, glow: [255, 110, 70], glowA: 0.56, win: 0.6, star: 0.06 },
  { h: 19.6, sb: 0.7, ss: 1.0, ssep: 0.16, shue: 120, scon: 1.02, glow: [170, 120, 150], glowA: 0.42, win: 0.85, star: 0.4 },
  { h: 20.6, sb: 0.62, ss: 0.9, ssep: 0.34, shue: 198, scon: 1.03, glow: [92, 106, 178], glowA: 0.34, win: 1.0, star: 0.72 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
}

/** 把任意小时折进 [0,24)。 */
export function normalizeHour(hour: number): number {
  const h = hour % 24;
  return h < 0 ? h + 24 : h;
}

/** 从 Unix 秒（本地时区）取一天中的小数小时。 */
export function hourFromEpochSeconds(epochSeconds: number): number {
  const d = new Date(epochSeconds * 1000);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** 在环形关键帧上按小时插值出一档权重混合。 */
function sampleStops(hour: number): Stop {
  const h = normalizeHour(hour);
  const n = STOPS.length;
  // 找到 h 落在的区间 [i, i+1]，末档回卷到首档（h0..24 视作到 STOPS[0]+24）。
  let i = n - 1;
  for (let k = 0; k < n; k += 1) {
    const cur = STOPS[k].h;
    const nextH = k + 1 < n ? STOPS[k + 1].h : STOPS[0].h + 24;
    if (h >= cur && h < nextH) {
      i = k;
      break;
    }
    // h 落在末档之后（例如 21:00~24:00）：用末档 → 首档(24)。
    if (k === n - 1) i = n - 1;
  }
  const a = STOPS[i];
  const b = STOPS[(i + 1) % n];
  const bh = i + 1 < n ? b.h : STOPS[0].h + 24;
  const span = bh - a.h;
  const t = span <= 0 ? 0 : clamp01((h - a.h) / span);
  return {
    h,
    sb: lerp(a.sb, b.sb, t),
    ss: lerp(a.ss, b.ss, t),
    ssep: lerp(a.ssep, b.ssep, t),
    shue: lerp(a.shue, b.shue, t),
    scon: lerp(a.scon, b.scon, t),
    glow: lerpRgb(a.glow, b.glow, t),
    glowA: lerp(a.glowA, b.glowA, t),
    win: lerp(a.win, b.win, t),
    star: lerp(a.star, b.star, t),
  };
}

// 太阳/月亮升落时刻（本地小时，可调）。月亮跨午夜（set<rise 视作 +24）。
const SUNRISE = 6.2;
const SUNSET = 18.8;
const MOONRISE = 18.4;
const MOONSET = 6.6;

const SUN_DISC_LOW: Rgb = [255, 150, 92];
const SUN_DISC_HIGH: Rgb = [255, 250, 232];
const MOON_DISC_LOW: Rgb = [255, 198, 150];
const MOON_DISC_HIGH: Rgb = [232, 240, 255];

/** 计算一颗天体（rise→set 的弧线）当前的位置/高度/可见度。 */
function celestial(hour: number, rise: number, set: number, kind: "sun" | "moon", discLow: Rgb, discHigh: Rgb): CelestialBody {
  let span = set - rise;
  if (span <= 0) span += 24;
  let t = normalizeHour(hour) - rise;
  if (t < 0) t += 24;
  const p = t / span; // 0..1 为在空中；>1 已落下
  const up = p >= 0 && p <= 1;
  const pc = clamp01(p);
  const altitude = up ? Math.sin(pc * Math.PI) : 0;
  // 升起后 / 落下前 ~6% 行程内淡入淡出，避免贴地突现/突灭。
  const edge = 0.06;
  const fade = up ? clamp01(Math.min(pc, 1 - pc) / edge) : 0;
  return {
    kind,
    x: lerp(0.1, 0.9, pc),
    altitude,
    opacity: up ? fade : 0,
    disc: lerpRgb(discLow, discHigh, clamp01(altitude * 1.15)),
  };
}

function labelFor(hour: number): DayPhase["label"] {
  const h = normalizeHour(hour);
  if (h >= SUNRISE - 0.6 && h < 8.5) return "dawn";
  if (h >= 8.5 && h < 17.0) return "day";
  if (h >= 17.0 && h < SUNSET + 1.2) return "dusk";
  return "night";
}

/** 主入口：本地小时 → 全套昼夜视觉参数。 */
export function computeDayPhase(hour: number): DayPhase {
  const s = sampleStops(hour);
  const sun = celestial(hour, SUNRISE, SUNSET, "sun", SUN_DISC_LOW, SUN_DISC_HIGH);
  const moon = celestial(hour, MOONRISE, MOONSET, "moon", MOON_DISC_LOW, MOON_DISC_HIGH);
  // 白昼度：由场景亮度归一（0.6=最暗夜 → 0，1.06=正午 → 1）。
  const daylight = clamp01((s.sb - 0.62) / (1.06 - 0.62));
  const dominant = sun.opacity >= moon.opacity ? sun : moon;
  return {
    hour: normalizeHour(hour),
    label: labelFor(hour),
    daylight,
    scene: { brightness: s.sb, saturate: s.ss, sepia: s.ssep, hueRotate: s.shue, contrast: s.scon },
    windowLight: clamp01(s.win),
    starOpacity: clamp01(s.star),
    sun,
    moon,
    glow: { color: s.glow, alpha: s.glowA, x: dominant.x },
  };
}

const r2 = (v: number): string => Math.round(v * 1000) / 1000 + "";

/** DayGrade → CSS filter 串（函数列表恒定顺序，便于 CSS 过渡插值）。 */
export function gradeToFilter(g: DayGrade): string {
  return `sepia(${r2(g.sepia)}) hue-rotate(${r2(g.hueRotate)}deg) saturate(${r2(g.saturate)}) brightness(${r2(g.brightness)}) contrast(${r2(g.contrast)})`;
}

export function rgbCss(c: Rgb, alpha = 1): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${r2(alpha)})`;
}
