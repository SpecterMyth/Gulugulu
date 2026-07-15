import type { CSSProperties, ReactNode } from "react";
import { OUTLINE, type EyeVariant } from "../rigTypes";

// -----------------------------------------------------------------------------
// 共享原语：Part 包装器、眼睛（三变体）、腮红、鸭蹼脚、圆爪脚
// -----------------------------------------------------------------------------

/**
 * 动画部件包装器：CSS 通过 `.part-<name>` 选中并施加 keyframes；
 * pivot 用自身 bbox 的百分比表示（可越界，如腿绕髋点 "50% -10%"）。
 * 注意：Part 自身不能带 transform 属性（CSS transform 会覆盖它）；
 * 放置用外层 <g transform=...> 包住 Part。
 */
export function Part({
  name,
  origin = "50% 50%",
  style,
  children,
}: {
  name: string;
  origin?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <g
      className={`part-${name}`}
      style={{ transformBox: "fill-box", transformOrigin: origin, ...style }}
    >
      {children}
    </g>
  );
}

/** 眼睛对（含眨眼动画组 .sprite-eyes）。variant: round 圆眼 / happy 弯月笑眼 / sleepy 半合眼 */
export function Eyes({
  cx1,
  cx2,
  cy,
  r = 8,
  variant = "round",
}: {
  cx1: number;
  cx2: number;
  cy: number;
  r?: number;
  variant?: EyeVariant;
}) {
  if (variant === "happy") {
    return (
      <g className="sprite-eyes" fill="none" stroke={OUTLINE} strokeWidth={r * 0.6} strokeLinecap="round">
        <path d={`M${cx1 - r} ${cy + r * 0.3} q${r} ${-r * 1.2} ${r * 2} 0`} />
        <path d={`M${cx2 - r} ${cy + r * 0.3} q${r} ${-r * 1.2} ${r * 2} 0`} />
      </g>
    );
  }
  if (variant === "sleepy") {
    return (
      <g className="sprite-eyes">
        <path d={`M${cx1 - r} ${cy} a${r} ${r} 0 0 0 ${r * 2} 0 z`} fill={OUTLINE} />
        <path d={`M${cx2 - r} ${cy} a${r} ${r} 0 0 0 ${r * 2} 0 z`} fill={OUTLINE} />
        <g stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round">
          <path d={`M${cx1 - r} ${cy - 1} h${r * 2}`} />
          <path d={`M${cx2 - r} ${cy - 1} h${r * 2}`} />
        </g>
        <circle cx={cx1 + 2} cy={cy + 2.5} r={1.8} fill="#fff" />
        <circle cx={cx2 + 2} cy={cy + 2.5} r={1.8} fill="#fff" />
      </g>
    );
  }
  return (
    <g className="sprite-eyes">
      <circle cx={cx1} cy={cy} r={r} fill={OUTLINE} />
      <circle cx={cx2} cy={cy} r={r} fill={OUTLINE} />
      <circle cx={cx1 + r * 0.35} cy={cy - r * 0.35} r={r * 0.32} fill="#fff" />
      <circle cx={cx2 + r * 0.35} cy={cy - r * 0.35} r={r * 0.32} fill="#fff" />
    </g>
  );
}

/** 侧视单眼 */
export function SideEye({ cx, cy, r = 8, variant = "round" }: { cx: number; cy: number; r?: number; variant?: EyeVariant }) {
  if (variant === "happy") {
    return (
      <g className="sprite-eyes" fill="none" stroke={OUTLINE} strokeWidth={r * 0.6} strokeLinecap="round">
        <path d={`M${cx - r} ${cy + r * 0.3} q${r} ${-r * 1.2} ${r * 2} 0`} />
      </g>
    );
  }
  if (variant === "sleepy") {
    return (
      <g className="sprite-eyes">
        <path d={`M${cx - r} ${cy} a${r} ${r} 0 0 0 ${r * 2} 0 z`} fill={OUTLINE} />
        <path d={`M${cx - r} ${cy - 1} h${r * 2}`} stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g className="sprite-eyes">
      <circle cx={cx} cy={cy} r={r} fill={OUTLINE} />
      <circle cx={cx + r * 0.35} cy={cy - r * 0.35} r={r * 0.32} fill="#fff" />
    </g>
  );
}

export function Blush({ cx1, cx2, cy, color = "#F5917B" }: { cx1: number; cx2: number; cy: number; color?: string }) {
  return (
    <g opacity={0.55}>
      <ellipse cx={cx1} cy={cy} rx={9} ry={5.5} fill={color} />
      <ellipse cx={cx2} cy={cy} rx={9} ry={5.5} fill={color} />
    </g>
  );
}

/** 鸭蹼脚（朝向 dir：front 正面小三角 / right 侧面向右） */
export function WebFoot({ x, y, dir = "front", color = "#F5A83B" }: { x: number; y: number; dir?: "front" | "right"; color?: string }) {
  if (dir === "right") {
    return (
      <path
        d={`M${x} ${y} q10 -2 16 4 l-4 5 q-8 2 -14 -2 z`}
        fill={color}
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
    );
  }
  return (
    <path
      d={`M${x - 12} ${y + 8} l12 -10 l12 10 z`}
      fill={color}
      stroke={OUTLINE}
      strokeWidth={4.5}
      strokeLinejoin="round"
    />
  );
}

/** 圆肉垫小爪 */
export function PawFoot({ x, y, rx = 13, color }: { x: number; y: number; rx?: number; color: string }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={rx * 0.58} fill={color} stroke={OUTLINE} strokeWidth={4.5} />;
}

/** 阶数光圈色阶（融合 2.0：2 青碧 / 3 湛蓝 / 4 绛紫 / 5 鎏金；6=六色棱光三环）。 */
export const GRADE_RING_COLORS: Record<number, string> = {
  2: "#6FD3A6",
  3: "#5AA9F0",
  4: "#B07DE8",
  5: "#F5C542",
};

/** 阶数光圈：pet.tier ≥ 2 时画在影子层旁的向外扩散彩环
 *  （动画 grade-ring-expand 见 sprites.css；离线渲染不传 tier 即不出现）。 */
export function GradeHalo({ tier, rx }: { tier: number; rx: number }) {
  if (tier < 2) return null;
  const ry = Math.max(8, rx * 0.18);
  if (tier >= 6) {
    return (
      <g className="sprite-grade-halo" aria-hidden="true">
        <ellipse className="grade-ring" cx={128} cy={236} rx={rx} ry={ry} fill="none" stroke="#E85D3A" strokeWidth={4.5} />
        <ellipse className="grade-ring grade-ring-b" cx={128} cy={236} rx={rx} ry={ry} fill="none" stroke="#FFD93B" strokeWidth={3.2} />
        <ellipse className="grade-ring grade-ring-c" cx={128} cy={236} rx={rx} ry={ry} fill="none" stroke="#5AA9F0" strokeWidth={2.2} />
      </g>
    );
  }
  const color = GRADE_RING_COLORS[Math.min(Math.max(tier, 2), 5)];
  return (
    <g className="sprite-grade-halo" aria-hidden="true">
      <ellipse className="grade-ring" cx={128} cy={236} rx={rx} ry={ry} fill="none" stroke={color} strokeWidth={4.5} />
      <ellipse className="grade-ring grade-ring-b" cx={128} cy={236} rx={rx} ry={ry} fill="none" stroke={color} strokeWidth={2.4} />
    </g>
  );
}

/** 头顶"…"思考气泡（thinking 状态由装配器渲染） */
export function ThinkDots() {
  return (
    <g className="sprite-think" fill={OUTLINE}>
      <circle cx={188} cy={70} r={4} opacity={0.9} />
      <circle cx={202} cy={62} r={5} opacity={0.7} />
      <circle cx={218} cy={52} r={6} opacity={0.5} />
    </g>
  );
}

/** 冒汗滴（error 状态由装配器渲染） */
export function SweatDrop() {
  return (
    <g className="sprite-sweat">
      <path d="M196 96 q8 12 8 18 a8 8 0 0 1 -16 0 q0 -6 8 -18 z" fill="#9BDCFF" stroke={OUTLINE} strokeWidth={3} />
    </g>
  );
}

/** 睡眠 Zzz */
export function SleepZzz() {
  return (
    <g className="sprite-zzz" fill={OUTLINE} fontFamily="inherit" fontWeight={900}>
      <text x={182} y={92} fontSize={30}>
        Z
      </text>
      <text x={204} y={68} fontSize={22} opacity={0.75}>
        z
      </text>
      <text x={220} y={50} fontSize={16} opacity={0.5}>
        z
      </text>
    </g>
  );
}
