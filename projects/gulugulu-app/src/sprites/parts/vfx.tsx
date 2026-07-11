import type { CSSProperties, ReactNode } from "react";
import { OUTLINE } from "../rigTypes";

// -----------------------------------------------------------------------------
// 元素粒子特效层（计划 §1.4）
//
// 挂在 sprite 顶层（body 之外，不吃身体形变），单精灵 ≤8 粒（4 环境 + 8 爆发，
// 爆发只在 success/点击时显示）。强度由装配器算好的根类控制：
//   .fx-off  → 环境粒子隐藏（sleeping/exhausted）
//   .fx-low  → 只显示 slot 0/1（idle/thinking）
//   .fx-med  → 显示全部 4 个环境粒子（working/moving/fed 等）
//   .fx-burst→ 环境粒子照常 + 爆发粒子放一轮（success）
// 双元素：A 元素占左半区槽位(0,2)与爆发偶数位，B 元素占右半区槽位(1,3)与奇数位。
// -----------------------------------------------------------------------------

export type FxLevel = "off" | "low" | "med" | "burst";

type ElementFxSpec = {
  motion: "twinkle" | "rise" | "flicker" | "bubble" | "fall" | "snow";
  shape: (size: number) => ReactNode;
};

const star = (size: number) => (
  <path
    d={`M0 ${-size} L${size * 0.28} ${-size * 0.28} L${size} 0 L${size * 0.28} ${size * 0.28} L0 ${size} L${-size * 0.28} ${size * 0.28} L${-size} 0 L${-size * 0.28} ${-size * 0.28} Z`}
    fill="#FFFFFF"
    stroke="#2E2E36"
    strokeWidth={1.6}
    strokeLinejoin="round"
  />
);

const flame = (size: number) => (
  <g>
    <path
      d={`M0 ${-size} q${size * 0.75} ${size * 0.7} ${size * 0.55} ${size * 1.15} a${size * 0.62} ${size * 0.62} 0 0 1 -${size * 1.1} 0 q${-size * 0.2} ${-size * 0.45} ${size * 0.55} ${-size * 1.15} z`}
      fill="#E85D3A"
    />
    <path
      d={`M0 ${-size * 0.45} q${size * 0.4} ${size * 0.45} ${size * 0.28} ${size * 0.7} a${size * 0.34} ${size * 0.34} 0 0 1 -${size * 0.56} 0 q${-size * 0.12} ${-size * 0.25} ${size * 0.28} ${-size * 0.7} z`}
      fill="#FFB03A"
    />
    <circle cx={0} cy={size * 0.28} r={size * 0.16} fill="#FFF1C9" />
  </g>
);

const bolt = (size: number) => (
  <path
    d={`M${size * 0.2} ${-size} L${-size * 0.5} ${size * 0.15} h${size * 0.45} L${-size * 0.2} ${size} L${size * 0.55} ${-size * 0.15} h${-size * 0.45} Z`}
    fill="#FFD93B"
    stroke="#FFFFFF"
    strokeWidth={1.4}
    strokeLinejoin="round"
  />
);

const bubble = (size: number) => (
  <g>
    <circle cx={0} cy={0} r={size * 0.7} fill="#9BDCFF" opacity={0.55} stroke="#9BDCFF" strokeWidth={1.6} />
    <circle cx={-size * 0.22} cy={-size * 0.24} r={size * 0.18} fill="#FFFFFF" opacity={0.9} />
  </g>
);

const leaf = (size: number) => (
  <g>
    <path d={`M0 ${-size} q${size * 0.95} ${size * 0.35} ${size * 0.2} ${size * 1.6} q${-size * 1.1} ${-size * 0.2} ${-size * 0.2} ${-size * 1.6} z`} fill="#8CD97B" />
    <path d={`M0 ${-size * 0.7} q${size * 0.1} ${size * 0.7} ${size * 0.08} ${size * 1.1}`} stroke="#57B84C" strokeWidth={1.4} fill="none" strokeLinecap="round" />
  </g>
);

const snow = (size: number) => (
  <g stroke="#B0E5F0" strokeWidth={size * 0.22} strokeLinecap="round">
    <path d={`M0 ${-size} V${size} M${-size * 0.87} ${-size * 0.5} L${size * 0.87} ${size * 0.5} M${-size * 0.87} ${size * 0.5} L${size * 0.87} ${-size * 0.5}`} />
    <circle cx={0} cy={0} r={size * 0.2} fill="#F7FCFD" stroke="none" />
  </g>
);

const ELEMENT_FX: Record<string, ElementFxSpec> = {
  normal: { motion: "twinkle", shape: star },
  fire: { motion: "rise", shape: flame },
  electric: { motion: "flicker", shape: bolt },
  water: { motion: "bubble", shape: bubble },
  grass: { motion: "fall", shape: leaf },
  ice: { motion: "snow", shape: snow },
};

/** 环境粒子槽位：0/2 左半区，1/3 右半区（双元素分区用） */
const AMBIENT_POS: Array<[number, number]> = [
  [58, 152],
  [198, 142],
  [78, 96],
  [184, 194],
];
const AMBIENT_DELAY = [0, 0.9, 1.7, 2.6];

/** 爆发粒子：从胸口 (128,160) 径向飞出的 8 个方向落点偏移 */
const BURST_DIRS: Array<[number, number]> = [
  [66, -46],
  [-66, -46],
  [82, 8],
  [-82, 8],
  [46, -78],
  [-46, -78],
  [58, 52],
  [-58, 52],
];

export function FxLayer({ elements }: { elements: string[] }) {
  const known = elements.filter((element) => ELEMENT_FX[element]).slice(0, 2);
  if (known.length === 0) return null;
  const dual = known.length === 2;

  return (
    <g className="sprite-fx" aria-hidden="true">
      {AMBIENT_POS.map(([x, y], index) => {
        const element = dual ? known[index % 2] : known[0];
        const spec = ELEMENT_FX[element];
        return (
          <g key={`a${index}`} transform={`translate(${x} ${y})`}>
            <g
              className={`fx-p fx-slot-${index} fx-m-${spec.motion}`}
              style={{ animationDelay: `${AMBIENT_DELAY[index]}s` } as CSSProperties}
            >
              {spec.shape(index % 2 === 0 ? 8 : 6.5)}
            </g>
          </g>
        );
      })}
      {BURST_DIRS.map(([dx, dy], index) => {
        const element = dual ? known[index % 2] : known[0];
        const spec = ELEMENT_FX[element];
        return (
          <g key={`b${index}`} transform="translate(128 160)">
            <g
              className="fx-burst-p"
              style={{ "--bx": `${dx}px`, "--by": `${dy}px`, animationDelay: `${(index % 4) * 0.05}s` } as CSSProperties}
            >
              {spec.shape(7)}
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** 点击反馈爆发（叠加层用，渲染在 duck-facing 内、精灵之上）：元素色小心心+星星 */
export function ReactionBurst({ color = "#F5917B" }: { color?: string }) {
  const dirs: Array<[number, number, number]> = [
    [-34, -52, -18],
    [0, -64, 0],
    [34, -52, 18],
    [-52, -20, -32],
    [52, -20, 32],
  ];
  return (
    <svg viewBox="0 0 256 256" className="reaction-burst" aria-hidden="true">
      {dirs.map(([dx, dy, rot], index) => (
        <g key={index} transform="translate(128 150)">
          <g
            className="reaction-p"
            style={{ "--bx": `${dx}px`, "--by": `${dy}px`, animationDelay: `${index * 0.03}s` } as CSSProperties}
          >
            <path
              transform={`rotate(${rot}) scale(1.05)`}
              d="M0 4 C -7 -4 -14 1 -7 8 L 0 14 L 7 8 C 14 1 7 -4 0 4 Z"
              fill={color}
              stroke={OUTLINE}
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
          </g>
        </g>
      ))}
    </svg>
  );
}
