import type { ReactNode } from "react";
import { OUTLINE, type EyeVariant, type Expression, type MouthStyle } from "../rigTypes";
import { Eyes, SideEye } from "./common";

// -----------------------------------------------------------------------------
// 呆萌表情库（计划：每个动作不同的面部表情）。
// - ExpFace：正面双眼 + 通用嘴；ExpSideFace：侧面单眼 + 小嘴。
// - expression="normal" 时回落到物种默认眼型（round/happy/sleepy）并保留
//   眨眼动画（.sprite-eyes）；其余表情为静态造型 + CSS 微动
//   （face-eyes-star 闪烁 / face-eyes-dizzy 旋转 / face-mouth-munch 咀嚼，
//   见 sprites.css）。
// - 有鸭嘴/吻部的 rig 可 withMouth={false} 自绘嘴部，眼睛仍走这里。
// -----------------------------------------------------------------------------

function eyePair(cx1: number, cx2: number, cy: number, r: number, expression: Expression): ReactNode {
  switch (expression) {
    case "happy":
    case "munch":
      return (
        <g fill="none" stroke={OUTLINE} strokeWidth={r * 0.55} strokeLinecap="round">
          <path d={`M${cx1 - r} ${cy + r * 0.3} q${r} ${-r * 1.3} ${r * 2} 0`} />
          <path d={`M${cx2 - r} ${cy + r * 0.3} q${r} ${-r * 1.3} ${r * 2} 0`} />
        </g>
      );
    case "effort":
      return (
        <g fill="none" stroke={OUTLINE} strokeWidth={r * 0.5} strokeLinecap="round" strokeLinejoin="round">
          <path d={`M${cx1 - r * 0.9} ${cy - r * 0.7} L${cx1 + r * 0.6} ${cy} L${cx1 - r * 0.9} ${cy + r * 0.7}`} />
          <path d={`M${cx2 + r * 0.9} ${cy - r * 0.7} L${cx2 - r * 0.6} ${cy} L${cx2 + r * 0.9} ${cy + r * 0.7}`} />
        </g>
      );
    case "star": {
      const star = (cx: number) => (
        <g>
          <path
            d={`M${cx} ${cy - r * 1.15} L${cx + r * 0.36} ${cy - r * 0.36} L${cx + r * 1.15} ${cy} L${cx + r * 0.36} ${cy + r * 0.36} L${cx} ${cy + r * 1.15} L${cx - r * 0.36} ${cy + r * 0.36} L${cx - r * 1.15} ${cy} L${cx - r * 0.36} ${cy - r * 0.36} Z`}
            fill="#FFD93B"
            stroke={OUTLINE}
            strokeWidth={r * 0.3}
            strokeLinejoin="round"
          />
          <circle cx={cx + r * 0.2} cy={cy - r * 0.2} r={r * 0.2} fill="#FFFFFF" />
        </g>
      );
      return (
        <g>
          {star(cx1)}
          {star(cx2)}
        </g>
      );
    }
    case "sleep":
      return (
        <g fill="none" stroke={OUTLINE} strokeWidth={r * 0.5} strokeLinecap="round">
          <path d={`M${cx1 - r} ${cy - r * 0.2} q${r} ${r * 1.1} ${r * 2} 0`} />
          <path d={`M${cx2 - r} ${cy - r * 0.2} q${r} ${r * 1.1} ${r * 2} 0`} />
          <path d={`M${cx1 - r * 0.5} ${cy + r * 0.75} l${-r * 0.28} ${r * 0.5} M${cx1 + r * 0.5} ${cy + r * 0.75} l${r * 0.28} ${r * 0.5}`} strokeWidth={r * 0.3} />
          <path d={`M${cx2 - r * 0.5} ${cy + r * 0.75} l${-r * 0.28} ${r * 0.5} M${cx2 + r * 0.5} ${cy + r * 0.75} l${r * 0.28} ${r * 0.5}`} strokeWidth={r * 0.3} />
        </g>
      );
    case "surprised": {
      const eye = (cx: number) => (
        <g>
          <circle cx={cx} cy={cy} r={r} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={r * 0.32} />
          <circle cx={cx} cy={cy + r * 0.1} r={r * 0.42} fill={OUTLINE} />
          <circle cx={cx + r * 0.18} cy={cy - r * 0.12} r={r * 0.15} fill="#FFFFFF" />
        </g>
      );
      return (
        <g>
          {eye(cx1)}
          {eye(cx2)}
        </g>
      );
    }
    case "dizzy": {
      // 蚊香眼：外圈 + 内钩
      const swirl = (cx: number) => (
        <g fill="none" stroke={OUTLINE} strokeWidth={r * 0.32} strokeLinecap="round">
          <circle cx={cx} cy={cy} r={r * 0.95} />
          <path d={`M${cx + r * 0.5} ${cy} A${r * 0.5} ${r * 0.5} 0 1 1 ${cx} ${cy - r * 0.5}`} />
        </g>
      );
      return (
        <g>
          {swirl(cx1)}
          {swirl(cx2)}
        </g>
      );
    }
    case "think": {
      const eye = (cx: number) => (
        <g>
          <circle cx={cx} cy={cy} r={r} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={r * 0.3} />
          <circle cx={cx + r * 0.32} cy={cy - r * 0.34} r={r * 0.45} fill={OUTLINE} />
        </g>
      );
      return (
        <g>
          {eye(cx1)}
          {eye(cx2)}
        </g>
      );
    }
    default:
      return null; // normal 由 ExpFace 走物种默认 Eyes
  }
}

function mouthShape(mx: number, my: number, w: number, expression: Expression): ReactNode {
  switch (expression) {
    case "normal":
      return <path d={`M${mx - w / 2} ${my} q${w / 2} ${w * 0.45} ${w} 0`} fill="none" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />;
    case "happy":
      return (
        <g>
          <path d={`M${mx - w * 0.62} ${my} q${w * 0.62} ${w * 0.85} ${w * 1.24} 0 z`} fill={OUTLINE} />
          <path d={`M${mx - w * 0.3} ${my + w * 0.28} q${w * 0.3} ${w * 0.34} ${w * 0.6} 0 z`} fill="#F5917B" />
        </g>
      );
    case "effort":
      return (
        <g>
          <path d={`M${mx - w * 0.55} ${my} h${w * 1.1}`} fill="none" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
          <path d={`M${mx + w * 0.32} ${my} q${w * 0.22} ${w * 0.4} ${w * 0.44} ${w * 0.12} q${-w * 0.18} ${w * 0.26} ${-w * 0.44} ${-w * 0.12} z`} fill="#F5917B" stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        </g>
      );
    case "star":
      return (
        <g>
          <path d={`M${mx - w * 0.7} ${my} q0 ${w * 1.05} ${w * 0.7} ${w * 1.05} q${w * 0.7} 0 ${w * 0.7} ${-w * 1.05} z`} fill={OUTLINE} />
          <path d={`M${mx - w * 0.34} ${my + w * 0.5} q${w * 0.34} ${w * 0.4} ${w * 0.68} 0 l0 ${w * 0.2} q${-w * 0.34} ${w * 0.3} ${-w * 0.68} 0 z`} fill="#F5917B" />
        </g>
      );
    case "munch":
      return (
        <g className="face-chew">
          <ellipse cx={mx} cy={my + w * 0.2} rx={w * 0.42} ry={w * 0.34} fill={OUTLINE} />
          <ellipse cx={mx} cy={my + w * 0.3} rx={w * 0.22} ry={w * 0.14} fill="#F5917B" />
        </g>
      );
    case "sleep":
      return <circle cx={mx} cy={my + 2} r={w * 0.17} fill={OUTLINE} opacity={0.85} />;
    case "surprised":
      return <ellipse cx={mx} cy={my + 1} rx={w * 0.2} ry={w * 0.26} fill={OUTLINE} />;
    case "dizzy":
      return (
        <path
          d={`M${mx - w * 0.55} ${my} q${w * 0.27} ${-w * 0.3} ${w * 0.55} 0 q${w * 0.27} ${w * 0.3} ${w * 0.55} 0`}
          fill="none"
          stroke={OUTLINE}
          strokeWidth={3.6}
          strokeLinecap="round"
        />
      );
    case "think":
      return <path d={`M${mx - w * 0.3} ${my + 1} h${w * 0.6}`} fill="none" stroke={OUTLINE} strokeWidth={3.6} strokeLinecap="round" />;
    default:
      return null;
  }
}

// 待机嘴（normal 表情用）：按 mouthStyle 选嘴型，默认 smile。动画表情走 mouthShape。
function normalMouth(mx: number, my: number, w: number, style: MouthStyle = "smile"): ReactNode {
  switch (style) {
    case "cat":
      return (
        <path
          d={`M${mx - w * 0.5} ${my} q${w * 0.25} ${w * 0.42} ${w * 0.5} 0 q${w * 0.25} ${w * 0.42} ${w * 0.5} 0`}
          fill="none"
          stroke={OUTLINE}
          strokeWidth={3.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "fang":
      return (
        <g>
          <path d={`M${mx - w / 2} ${my} q${w / 2} ${w * 0.5} ${w} 0`} fill="none" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
          <path
            d={`M${mx - w * 0.18} ${my + w * 0.1} l${w * 0.13} 0 l${-w * 0.065} ${w * 0.3} z`}
            fill="#fff"
            stroke={OUTLINE}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        </g>
      );
    case "smirk":
      return (
        <path
          d={`M${mx - w * 0.5} ${my + w * 0.16} Q${mx} ${my + w * 0.02} ${mx + w * 0.52} ${my - w * 0.22}`}
          fill="none"
          stroke={OUTLINE}
          strokeWidth={4}
          strokeLinecap="round"
        />
      );
    case "open":
      return (
        <g>
          <path d={`M${mx - w * 0.4} ${my} q${w * 0.4} ${w * 0.78} ${w * 0.8} 0 z`} fill={OUTLINE} />
          <path d={`M${mx - w * 0.2} ${my + w * 0.28} q${w * 0.2} ${w * 0.26} ${w * 0.4} 0 z`} fill="#F5917B" />
        </g>
      );
    case "pout":
      return (
        <path
          d={`M${mx - w * 0.22} ${my} Q${mx} ${my - w * 0.32} ${mx + w * 0.22} ${my} Q${mx} ${my + w * 0.38} ${mx - w * 0.22} ${my} Z`}
          fill="#F5917B"
          stroke={OUTLINE}
          strokeWidth={2.6}
          strokeLinejoin="round"
        />
      );
    case "flat":
      return <path d={`M${mx - w * 0.38} ${my} h${w * 0.76}`} fill="none" stroke={OUTLINE} strokeWidth={3.6} strokeLinecap="round" />;
    case "smile":
    default:
      return <path d={`M${mx - w / 2} ${my} q${w / 2} ${w * 0.45} ${w} 0`} fill="none" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />;
  }
}

export function ExpFace({
  cx1,
  cx2,
  cy,
  r = 8,
  mouthX,
  mouthY,
  mouthW = 14,
  expression = "normal",
  base = "round",
  iris,
  mouthStyle = "smile",
  withMouth = true,
}: {
  cx1: number;
  cx2: number;
  cy: number;
  r?: number;
  mouthX?: number;
  mouthY: number;
  mouthW?: number;
  expression?: Expression;
  base?: EyeVariant;
  iris?: string;
  mouthStyle?: MouthStyle;
  withMouth?: boolean;
}) {
  const mx = mouthX ?? (cx1 + cx2) / 2;
  return (
    <g className="part-facebits">
      {expression === "normal" ? (
        <Eyes cx1={cx1} cx2={cx2} cy={cy} r={r} variant={base} iris={iris} />
      ) : (
        <g className={`face-eyes face-eyes-${expression}`}>{eyePair(cx1, cx2, cy, r, expression)}</g>
      )}
      {withMouth && (
        <g className={`face-mouth face-mouth-${expression}`}>
          {expression === "normal" ? normalMouth(mx, mouthY, mouthW, mouthStyle) : mouthShape(mx, mouthY, mouthW, expression)}
        </g>
      )}
    </g>
  );
}

export function ExpSideFace({
  cx,
  cy,
  r = 8,
  mouthX,
  mouthY,
  mouthW = 11,
  expression = "normal",
  base = "round",
  iris,
  mouthStyle = "smile",
  withMouth = true,
}: {
  cx: number;
  cy: number;
  r?: number;
  mouthX?: number;
  mouthY?: number;
  mouthW?: number;
  expression?: Expression;
  base?: EyeVariant;
  iris?: string;
  mouthStyle?: MouthStyle;
  withMouth?: boolean;
}) {
  const mx = mouthX ?? cx - r * 0.4;
  const my = mouthY ?? cy + r * 2.2;
  // 侧面复用 eyePair 的单眼版本：把双眼坐标设为同一点取其一
  const single = (() => {
    if (expression === "normal") return <SideEye cx={cx} cy={cy} r={r} variant={base} iris={iris} />;
    const pair = eyePair(cx, cx, cy, r, expression);
    return <g className={`face-eyes face-eyes-${expression}`}>{pair}</g>;
  })();
  return (
    <g className="part-facebits">
      {single}
      {withMouth && (
        <g className={`face-mouth face-mouth-${expression}`}>
          {expression === "normal" ? normalMouth(mx, my, mouthW, mouthStyle) : mouthShape(mx, my, mouthW, expression)}
        </g>
      )}
    </g>
  );
}
