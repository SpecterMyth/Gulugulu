import { useEffect, useId, useMemo, useState, type ReactElement } from "react";
import type { GameConfig } from "../types";
import { OUTLINE } from "./rigTypes";
import { BADGE_PATHS } from "../game/ElementIcon";

// -----------------------------------------------------------------------------
// EggSvg —— 分阶蛋美术（生物蛋方向 · 圆润拼接）
//   ① 蛋体形状逐阶变化，全部由圆形体量柔和拼接、整体圆润：
//      圆润蛋 → 高圆蛋 → 洋梨蛋 → 胖双球蛋 → 莓冠蛋(顶部三圆瓣) → 叠丸蛋(三球塔+呆毛卷)，
//      形状可以抽象但始终是"生物下的蛋"，无任何金属/王冠等人工制造件；
//   ② 花纹全部画在壳上：斑点 → 元素纹样（水波/焰舌/闪折/芽叶/冰晶/星点）→
//      生长环 → 能量脉络 → 内芒/辉光，越高阶越密、壳色越饱和；
//   ③ 元素一眼可辨：壳身元素浅染 + 腹部元素徽记"胎记" + 元素专属纹样；
//      多元素物种在主徽记上方弧排小徽记。128×128 局部坐标、扁平描边风与主美术一致。
// -----------------------------------------------------------------------------

const CREAM = "#FFFDF6";

// ---- 配色小工具（十六进制线性插值，避免引入依赖）---------------------------
function parseHex(hex: string): [number, number, number] {
  const s = hex.replace("#", "");
  const v = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
function toHex([r, g, b]: [number, number, number]): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
/** a→b 线性混合，t=0 取 a、t=1 取 b。 */
function mix(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
const lighten = (c: string, t: number) => mix(c, "#FFFFFF", t);
/** 花纹用加深色：与同色系浅染壳拉开对比（像真实蛋上的深色斑纹）。 */
const inkOf = (c: string) => mix(c, "#1B1206", 0.24);

// ---- 蛋体形状阶梯（剪影逐阶演变，华丽度信号之一）---------------------------
type EggShape = {
  path: string;
  /** 尖端小卷（6 阶专属"呆毛"），描边线。 */
  wisp?: string;
  /** 腹部主徽记位。 */
  belly: [number, number];
  /** 顶尖位（生长环圆心）。 */
  tip: [number, number];
  /** 中带 / 下带纹样基准 y。 */
  midY: number;
  lowY: number;
  /** 蛋底 y（落地阴影）。 */
  baseY: number;
  shadowRx: number;
  /** 高光椭圆 [cx, cy, rx, ry, rotate]。 */
  highlight: [number, number, number, number, number];
};

const SHAPES: EggShape[] = [
  // T1 圆润蛋：单体量的胖椭圆
  {
    path: "M64 28 C84 28 96 47 96 72 C96 96 82 110 64 110 C46 110 32 96 32 72 C32 47 44 28 64 28 Z",
    belly: [64, 74], tip: [64, 28], midY: 56, lowY: 92, baseY: 110, shadowRx: 33,
    highlight: [50, 44, 9, 13, -20],
  },
  // T2 高圆蛋：更高挑但顶部圆润（无尖），比 T1 修长
  {
    path: "M64 18 C79 18 92 40 92 70 C92 95 80 111 64 111 C48 111 36 95 36 70 C36 40 49 18 64 18 Z",
    belly: [64, 76], tip: [64, 18], midY: 57, lowY: 93, baseY: 111, shadowRx: 32,
    highlight: [50, 40, 9, 14, -20],
  },
  // T3 洋梨蛋：小圆肩顺滑流进大圆肚（无腰身的两球融合）
  {
    path: "M64 20 C72 20 78 28 78 38 C90 44 95 60 95 76 C95 98 82 112 64 112 C46 112 33 98 33 76 C33 60 38 44 50 38 C50 28 56 20 64 20 Z",
    belly: [64, 80], tip: [64, 22], midY: 60, lowY: 95, baseY: 112, shadowRx: 32,
    highlight: [49, 48, 8, 12, -18],
  },
  // T4 胖双球蛋：大顶球深重叠进圆肚（肩线极浅的圆润雪人）
  {
    path: "M64 23 C74 23 83 31 83 42 C83 46.8 81 51 78 54 C88 59 94 69 94 80 C94 100 81 111 64 111 C47 111 34 100 34 80 C34 69 40 59 50 54 C47 51 45 46.8 45 42 C45 31 54 23 64 23 Z",
    belly: [64, 82], tip: [64, 25], midY: 62, lowY: 96, baseY: 111, shadowRx: 32,
    highlight: [54, 35, 6, 8, -20],
  },
  // T5 莓冠蛋：胖蛋体 + 顶部三个圆瓣（莓果冠）
  {
    path: "M37 42 C37 36 41 31 47 31 C51 31 55 33 56 37 C57 30 60 24 64 24 C68 24 71 30 72 37 C73 33 77 31 81 31 C87 31 91 36 91 42 C91 45 90 48 88 50 C93 57 95 67 95 78 C95 100 82 112 64 112 C46 112 33 100 33 78 C33 67 35 57 40 50 C38 48 37 45 37 42 Z",
    belly: [64, 80], tip: [64, 26], midY: 60, lowY: 96, baseY: 112, shadowRx: 32,
    highlight: [49, 50, 8, 12, -18],
  },
  // T6 叠丸蛋：三球叠塔 + 顶端呆毛小卷（最高，但全是圆）
  {
    path: "M64 11 C71 11 77 17 77 24 C77 28 75 31.5 72 33.5 C79 37 85 44 85 52 C85 59 81 65 75 68 C87 72 94 78 94 86 C94 102 81 113 64 113 C47 113 34 102 34 86 C34 78 41 72 53 68 C47 65 43 59 43 52 C43 44 49 37 56 33.5 C53 31.5 51 28 51 24 C51 17 57 11 64 11 Z",
    wisp: "M64 11 C63 6 66 3 70 5",
    belly: [64, 86], tip: [64, 12], midY: 52, lowY: 98, baseY: 113, shadowRx: 31,
    highlight: [52, 44, 7, 10, -18],
  },
];

// ---- 品阶样式表（花纹丰富度阶梯）--------------------------------------------
type TierStyle = {
  /** 壳身元素→奶油混合比（越小越饱和）。 */
  shellMix: number;
  /** 腹部体积染色不透明度。 */
  shadeOp: number;
  speckles: number;
  /** 元素纹样层级 0~3。 */
  motif: number;
  /** 顶部生长环。 */
  rings: boolean;
  /** 徽记环纹：0 无 / 1 胎记环 / 2 环 + 太阳短线。 */
  crestRing: 0 | 1 | 2;
  /** 能量脉络（从徽记向外的发光叶脉）。 */
  veins: boolean;
  /** 内芒 0~2（徽记后的柔光）。 */
  glow: 0 | 1 | 2;
  /** 外部自然辉光 + 漂浮闪光（顶级）。 */
  halo: boolean;
  /** 主徽记尺寸。 */
  crest: number;
};

/** tier(钳到 1~6) → 品阶样式。逐阶加纹样层，无人工装饰件。 */
function tierStyle(tier: number): TierStyle {
  const t = Math.max(1, Math.min(6, Math.round(tier)));
  switch (t) {
    case 1:
      return { shellMix: 0.86, shadeOp: 0.4, speckles: 5, motif: 0, rings: false, crestRing: 0, veins: false, glow: 0, halo: false, crest: 16 };
    case 2:
      return { shellMix: 0.8, shadeOp: 0.45, speckles: 4, motif: 1, rings: false, crestRing: 0, veins: false, glow: 0, halo: false, crest: 18 };
    case 3:
      return { shellMix: 0.74, shadeOp: 0.5, speckles: 3, motif: 1, rings: true, crestRing: 1, veins: false, glow: 0, halo: false, crest: 20 };
    case 4:
      return { shellMix: 0.66, shadeOp: 0.55, speckles: 0, motif: 2, rings: true, crestRing: 1, veins: false, glow: 1, halo: false, crest: 21 };
    case 5:
      return { shellMix: 0.58, shadeOp: 0.6, speckles: 0, motif: 2, rings: true, crestRing: 2, veins: true, glow: 1, halo: false, crest: 23 };
    default:
      return { shellMix: 0.5, shadeOp: 0.65, speckles: 0, motif: 3, rings: true, crestRing: 2, veins: true, glow: 2, halo: true, crest: 25 };
  }
}

/** 斑点位（各形状公共安全区，越界由剪裁兜底）。 */
const SPECKLES: Array<[number, number, number]> = [
  [50, 47, 6.5],
  [77, 43, 4.6],
  [62, 38, 3.6],
  [46, 60, 4.2],
  [81, 58, 3.2],
];

// ---- 局部构件 ---------------------------------------------------------------

/** 元素徽记字形（16×16 局部坐标缩放到 size，描边有效宽 ~1.4）。 */
function Glyph({ x, y, size, color, badge }: { x: number; y: number; size: number; color: string; badge: string }) {
  const d = BADGE_PATHS[badge];
  const scale = size / 16;
  const sw = Math.min(2.6, 1.5 / scale);
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${scale})`}>
      {d ? (
        <path d={d} fill={color} stroke={OUTLINE} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
      ) : (
        <circle cx={8} cy={8} r={5.5} fill={color} stroke={OUTLINE} strokeWidth={sw} />
      )}
    </g>
  );
}

/** 元素纹样（画在壳内，level 越高层数越多）：
 *  水=波纹 / 火=焰舌 / 电=闪折 / 草=芽叶 / 冰=冰晶 / 一般=星点。 */
function ElementMotif({
  element,
  level,
  shape,
  colorAt,
}: {
  element: string;
  level: number;
  shape: EggShape;
  colorAt: (i: number) => string;
}) {
  if (level <= 0) return null;
  const { midY, lowY } = shape;
  const parts: ReactElement[] = [];
  switch (element) {
    case "water": {
      const wave = (y: number, key: string, op: number, c: string) => (
        <path key={key} d={`M30 ${y} q7 -7 14 0 t14 0 t14 0 t14 0 t14 0`} fill="none" stroke={c} strokeWidth={3.2} strokeLinecap="round" opacity={op} />
      );
      parts.push(wave(midY, "w1", 0.7, colorAt(0)));
      if (level >= 2) parts.push(wave(lowY - 6, "w2", 0.5, colorAt(1)));
      if (level >= 3) parts.push(wave(midY - 16, "w3", 0.38, colorAt(2)));
      break;
    }
    case "fire": {
      const lick = (x: number, y: number, h: number, key: string, op: number, c: string) => (
        <path
          key={key}
          d={`M${x} ${y} c -4 ${-h * 0.45} -2 ${-h * 0.8} 2 ${-h} c 3 ${h * 0.35} 3.4 ${h * 0.75} -2 ${h} z`}
          fill={c}
          opacity={op}
        />
      );
      [44, 57, 70, 83].forEach((x, i) => parts.push(lick(x, lowY + 4, i % 2 === 0 ? 17 : 12, `f${i}`, 0.75, colorAt(i))));
      if (level >= 2) [50, 64, 78].forEach((x, i) => parts.push(lick(x, midY + 3, 10, `fm${i}`, 0.5, colorAt(i + 1))));
      if (level >= 3) parts.push(lick(64, midY - 13, 11, "ft", 0.36, colorAt(0)));
      break;
    }
    case "electric": {
      const zig = (y: number, key: string, op: number, c: string) => (
        <path key={key} d={`M32 ${y} l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8`} fill="none" stroke={c} strokeWidth={3.4} strokeLinejoin="round" strokeLinecap="round" opacity={op} />
      );
      parts.push(zig(midY, "z1", 0.75, colorAt(0)));
      if (level >= 2) parts.push(zig(lowY - 4, "z2", 0.48, colorAt(1)));
      if (level >= 3) parts.push(zig(midY - 18, "z3", 0.34, colorAt(2)));
      break;
    }
    case "grass": {
      const sprig = (x: number, y: number, s: number, key: string, op: number, c: string) => (
        <g key={key} opacity={op}>
          <path d={`M${x} ${y} q ${-1.5 * s} ${-6 * s} 0 ${-11 * s}`} fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" />
          <path d={`M${x} ${y - 7 * s} q ${-6 * s} ${-2 * s} ${-7 * s} ${-8 * s} q ${6 * s} ${1 * s} ${7 * s} ${8 * s} z`} fill={c} />
          <path d={`M${x} ${y - 9 * s} q ${6 * s} ${-2 * s} ${7.5 * s} ${-7 * s} q ${-6.5 * s} ${0.5 * s} ${-7.5 * s} ${7 * s} z`} fill={c} />
        </g>
      );
      parts.push(sprig(46, lowY + 2, 0.8, "g1", 0.7, colorAt(0)));
      parts.push(sprig(66, lowY + 5, 1, "g2", 0.78, colorAt(1)));
      parts.push(sprig(84, lowY, 0.7, "g3", 0.6, colorAt(2)));
      if (level >= 2) {
        parts.push(sprig(52, midY + 2, 0.6, "g4", 0.5, colorAt(1)));
        parts.push(sprig(78, midY + 4, 0.55, "g5", 0.46, colorAt(0)));
      }
      if (level >= 3) parts.push(sprig(64, midY - 12, 0.5, "g6", 0.4, colorAt(2)));
      break;
    }
    case "ice": {
      const flake = (x: number, y: number, r: number, key: string, op: number, c: string) => (
        <g key={key} stroke={c} strokeWidth={1.9} strokeLinecap="round" opacity={op}>
          <line x1={x - r} y1={y} x2={x + r} y2={y} />
          <line x1={x - r * 0.5} y1={y - r * 0.87} x2={x + r * 0.5} y2={y + r * 0.87} />
          <line x1={x - r * 0.5} y1={y + r * 0.87} x2={x + r * 0.5} y2={y - r * 0.87} />
        </g>
      );
      parts.push(flake(46, midY + 2, 5, "i1", 0.7, colorAt(0)));
      parts.push(flake(64, midY - 6, 6.2, "i2", 0.78, colorAt(1)));
      parts.push(flake(82, midY + 2, 5, "i3", 0.7, colorAt(2)));
      if (level >= 2) {
        parts.push(flake(52, lowY - 2, 4.4, "i4", 0.5, colorAt(1)));
        parts.push(flake(76, lowY - 2, 4.4, "i5", 0.5, colorAt(0)));
      }
      if (level >= 3) parts.push(flake(64, midY - 22, 4, "i6", 0.38, colorAt(2)));
      break;
    }
    default: {
      // normal：四芒星点
      const spark = (x: number, y: number, r: number, key: string, op: number, c: string) => (
        <path
          key={key}
          d={`M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z`}
          fill={c}
          opacity={op}
        />
      );
      parts.push(spark(46, midY + 2, 4.4, "n1", 0.7, colorAt(0)));
      parts.push(spark(64, midY - 6, 5.4, "n2", 0.78, colorAt(1)));
      parts.push(spark(82, midY + 2, 4.4, "n3", 0.7, colorAt(2)));
      if (level >= 2) {
        parts.push(spark(52, lowY - 2, 3.8, "n4", 0.5, colorAt(1)));
        parts.push(spark(76, lowY - 2, 3.8, "n5", 0.5, colorAt(0)));
      }
      if (level >= 3) parts.push(spark(64, midY - 22, 3.4, "n6", 0.38, colorAt(2)));
      break;
    }
  }
  return <g className="egg-motif">{parts}</g>;
}

/** 能量脉络：从徽记向外的发光"叶脉"，高阶蛋的内在生命感。 */
function Veins({ cx, cy, color, strong }: { cx: number; cy: number; color: string; strong: boolean }) {
  const paths = [
    `M${cx - 4} ${cy - 6} q -10 -8 -12 -20`,
    `M${cx + 4} ${cy - 6} q 10 -8 12 -20`,
    `M${cx - 8} ${cy} q -14 -2 -20 -10`,
    `M${cx + 8} ${cy} q 14 -2 20 -10`,
    `M${cx - 5} ${cy + 8} q -10 10 -12 18`,
    `M${cx + 5} ${cy + 8} q 10 10 12 18`,
  ];
  return (
    <g className="egg-veins" opacity={strong ? 0.52 : 0.38} stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round">
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </g>
  );
}

export type EggSvgProps = {
  species: string;
  tier: number;
  config: GameConfig;
  /** "incubating" 加轻晃，"ready" 加光晕 + 抖动。 */
  phase?: "idle" | "incubating" | "ready";
  /** 孵化进度 0..1，驱动裂纹在 25/50/75% 逐条显现。 */
  progress?: number;
  /** 距孵化完成秒数；≤10 触发临门抖动加频。 */
  secondsLeft?: number;
  /** 神秘蛋（AI 融合待揭晓）：壳身与花纹随轮播色变换 + "?"核取代徽记。 */
  mystery?: boolean;
  className?: string;
};

export function EggSvg({
  species,
  tier,
  config,
  phase = "idle",
  progress,
  secondsLeft,
  mystery = false,
  className,
}: EggSvgProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const clipId = `egg-clip-${uid}`;

  const info = config.species[species];
  const style = tierStyle(tier);
  const shape = SHAPES[Math.max(1, Math.min(6, Math.round(tier))) - 1];
  const [bellyX, bellyY] = shape.belly;

  // 元素解析：优先 info.elements（多元素蛋徽记环 + 纹样交替色），回退 config 元素表。
  const elementIds = info?.elements?.length ? info.elements : ["normal"];
  const elMeta = (id: string) => config.elements?.[id];
  const primaryEl = elMeta(elementIds[0]);
  const elColor = primaryEl?.color ?? info?.colors?.[0] ?? "#F5C542";
  const elBadge = primaryEl?.badge ?? "star";

  const incubating = phase === "incubating";
  const ready = phase === "ready";
  const soon = !ready && secondsLeft != null && secondsLeft <= 10;

  // 裂纹递进：按孵化进度在 25/50/75% 逐条显现（缺省进度按 phase 粗略推断）。
  const prog = progress ?? (ready ? 1 : incubating ? 0.5 : 0);
  const cracks = prog >= 0.75 ? 3 : prog >= 0.5 ? 2 : prog >= 0.25 ? 1 : 0;

  // 神秘蛋：孵化中循环轮播 6 元素色（整壳随之变色），把死倒计时变成期待素材。
  const teasePalette = useMemo(
    () => Object.values(config.elements ?? {}).map((e) => e.color).filter(Boolean),
    [config],
  );
  const [teaseIndex, setTeaseIndex] = useState(0);
  useEffect(() => {
    if (!mystery || phase === "idle" || teasePalette.length === 0) return;
    const timer = window.setInterval(() => setTeaseIndex((i) => (i + 1) % teasePalette.length), 900);
    return () => window.clearInterval(timer);
  }, [mystery, phase, teasePalette.length]);
  const teaseColor = ready ? elColor : teasePalette[teaseIndex] ?? elColor;

  // 主色：神秘蛋整体随轮播色染色。花纹一律用加深色（inkOf）压出对比。
  const dye = mystery ? teaseColor : elColor;
  const colorAt = (i: number) => (mystery ? teaseColor : elMeta(elementIds[i % elementIds.length])?.color ?? elColor);
  const inkAt = (i: number) => inkOf(colorAt(i));
  const shellTint = mix(dye, CREAM, style.shellMix);
  const shellShade = mix(dye, CREAM, Math.max(0.2, style.shellMix - 0.24));

  const phaseClass = ready ? "egg-phase-ready" : soon ? "egg-phase-soon" : incubating ? "egg-phase-incubating" : "egg-phase-idle";
  const ringR = style.crest * 0.8 + 2;

  return (
    <svg
      viewBox="0 0 128 128"
      className={`egg-svg ${phaseClass} ${className ?? ""}`}
      role="img"
      aria-label={`${info?.nameZh ?? species}的蛋`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={shape.path} />
        </clipPath>
      </defs>

      {/* 顶级自然辉光（柔光两层，CSS 缓慢脉动） */}
      {style.halo && (
        <g className="egg-halo" aria-hidden="true">
          <circle cx={64} cy={64} r={57} fill={dye} opacity={0.1} />
          <circle cx={64} cy={64} r={47} fill={dye} opacity={0.13} />
        </g>
      )}

      {/* 落地阴影 */}
      <ellipse cx={64} cy={shape.baseY + 5} rx={shape.shadowRx} ry={6.5} fill={OUTLINE} opacity={0.14} />

      {/* 光晕（ready 或 神秘孵化中） */}
      {(ready || (mystery && phase !== "idle")) && (
        <circle cx={64} cy={68} r={52} fill={dye} opacity={0.25} className="egg-glow" />
      )}

      {/* 蓄能光：孵化中随进度增强的元素微光（透明度走内联，脉动走 CSS） */}
      {incubating && !mystery && (
        <circle cx={64} cy={68} r={50} fill={dye} className="egg-glow-charge" style={{ opacity: 0.05 + prog * 0.16 }} />
      )}

      {/* 蛋身（摇摆组；4 阶以上带待机呼吸） */}
      <g className={`egg-shell${style.glow > 0 ? " egg-breath" : ""}`}>
        <path d={shape.path} fill={shellTint} stroke={OUTLINE} strokeWidth={5} />
        {shape.wisp && <path d={shape.wisp} className="egg-wisp" fill="none" stroke={OUTLINE} strokeWidth={3.5} strokeLinecap="round" />}

        {/* 壳上彩绘（全部剪裁进蛋形） */}
        <g clipPath={`url(#${clipId})`}>
          {/* 腹部体积染色 */}
          <ellipse cx={64} cy={shape.baseY - 18} rx={44} ry={30} fill={shellShade} opacity={style.shadeOp} />

          {/* 顶部生长环 */}
          {style.rings && (
            <g className="egg-rings" fill="none" stroke={inkOf(dye)} strokeWidth={2.6} strokeLinecap="round" opacity={0.55}>
              <path d={`M${shape.tip[0] - 18} ${shape.tip[1] + 21} q 18 -12 36 0`} />
              <path d={`M${shape.tip[0] - 12} ${shape.tip[1] + 13} q 12 -8 24 0`} />
            </g>
          )}

          {/* 斑点（低阶主花纹，深色压出蛋斑质感） */}
          {style.speckles > 0 && (
            <g className="egg-speckles">
              {SPECKLES.slice(0, style.speckles).map(([x, y, r], i) => (
                <circle key={i} cx={x} cy={y} r={r} fill={inkAt(i)} opacity={i % 2 === 0 ? 0.62 : 0.45} />
              ))}
            </g>
          )}

          {/* 元素纹样 */}
          <ElementMotif element={mystery ? "normal" : elementIds[0]} level={style.motif} shape={shape} colorAt={inkAt} />

          {/* 内芒（徽记后的柔光） */}
          {style.glow > 0 && (
            <g className="egg-coreglow">
              <circle cx={bellyX} cy={bellyY} r={style.glow === 2 ? 26 : 19} fill={lighten(dye, 0.7)} opacity={0.5} />
              <circle cx={bellyX} cy={bellyY} r={style.glow === 2 ? 15 : 11} fill={lighten(dye, 0.5)} opacity={0.5} />
            </g>
          )}

          {/* 能量脉络 */}
          {style.veins && <Veins cx={bellyX} cy={bellyY} color={dye} strong={style.glow === 2} />}

          {/* 高光 */}
          <ellipse
            cx={shape.highlight[0]}
            cy={shape.highlight[1]}
            rx={shape.highlight[2]}
            ry={shape.highlight[3]}
            fill="#fff"
            opacity={0.55}
            transform={`rotate(${shape.highlight[4]} ${shape.highlight[0]} ${shape.highlight[1]})`}
          />

          {/* 徽记 / 神秘核 */}
          {mystery ? (
            <g className="egg-tease">
              <circle cx={bellyX} cy={bellyY} r={15} fill={teaseColor} opacity={0.92} stroke={OUTLINE} strokeWidth={3} />
              <text x={bellyX} y={bellyY + 7} textAnchor="middle" fontSize={19} fontWeight={900} fill={CREAM}>
                ?
              </text>
            </g>
          ) : (
            <g className="egg-crest">
              {style.crestRing >= 1 && (
                <>
                  <circle cx={bellyX} cy={bellyY} r={ringR} fill={lighten(dye, 0.82)} opacity={0.9} />
                  <circle cx={bellyX} cy={bellyY} r={ringR} fill="none" stroke={dye} strokeWidth={2} opacity={0.75} />
                </>
              )}
              {style.crestRing >= 2 && (
                <g stroke={dye} strokeWidth={1.8} strokeLinecap="round" opacity={0.7}>
                  {Array.from({ length: 8 }, (_, i) => {
                    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
                    const r0 = ringR + 2.5;
                    const r1 = ringR + 6.5;
                    return (
                      <line
                        key={i}
                        x1={bellyX + Math.cos(a) * r0}
                        y1={bellyY + Math.sin(a) * r0}
                        x2={bellyX + Math.cos(a) * r1}
                        y2={bellyY + Math.sin(a) * r1}
                      />
                    );
                  })}
                </g>
              )}
              <Glyph x={bellyX} y={bellyY} size={style.crest} color={dye} badge={elBadge} />
            </g>
          )}

          {/* 副元素小徽记（多元素物种，主徽记上方弧排） */}
          {!mystery && elementIds.length > 1 && (
            <g className="egg-el-row">
              {elementIds.slice(1, 6).map((id, i, arr) => {
                const spread = Math.PI / 5;
                const a = -Math.PI / 2 + (i - (arr.length - 1) / 2) * spread;
                const R = ringR > 10 ? ringR + 9 : style.crest + 6;
                const x = bellyX + Math.cos(a) * R;
                const y = bellyY + Math.sin(a) * R;
                return <Glyph key={id + i} x={x} y={y} size={9} color={elMeta(id)?.color ?? elColor} badge={elMeta(id)?.badge ?? "star"} />;
              })}
            </g>
          )}

          {/* 裂纹递进（进度驱动，压在花纹上层） */}
          {cracks > 0 && (
            <g className="egg-cracks" stroke={OUTLINE} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M58 40 l6 8 l-5 7 l7 6" opacity={cracks >= 1 ? 1 : 0} />
              {cracks >= 2 && <path d="M84 60 l-7 5 l6 7 l-8 5" />}
              {cracks >= 3 && <path d="M44 78 l7 4 l-4 8 l8 5" />}
            </g>
          )}
        </g>
      </g>

      {/* 顶级漂浮闪光（自然元素光点） */}
      {style.halo && (
        <g className="egg-sparkles" aria-hidden="true">
          {([[26, 42, 3.8], [104, 54, 3], [98, 100, 3.4], [28, 96, 2.8]] as const).map(([x, y, r], i) => (
            <path
              key={i}
              className={`egg-sparkle egg-sparkle-${i}`}
              d={`M${x} ${y - r} L${x + r * 0.35} ${y - r * 0.35} L${x + r} ${y} L${x + r * 0.35} ${y + r * 0.35} L${x} ${y + r} L${x - r * 0.35} ${y + r * 0.35} L${x - r} ${y} L${x - r * 0.35} ${y - r * 0.35} Z`}
              fill={dye}
              stroke={OUTLINE}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          ))}
        </g>
      )}

      {/* 蛋语：孵化中偶尔冒出的"?"心思气泡 */}
      {incubating && !mystery && (
        <g className="egg-wonder" aria-hidden="true">
          <circle cx={98} cy={28} r={11} fill={CREAM} stroke={OUTLINE} strokeWidth={3} />
          <circle cx={86} cy={42} r={3.4} fill={CREAM} stroke={OUTLINE} strokeWidth={2.4} />
          <text x={98} y={33} textAnchor="middle" fontSize={13} fontWeight={900} fill={OUTLINE}>
            ?
          </text>
        </g>
      )}
    </svg>
  );
}
