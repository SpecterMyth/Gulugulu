import type { ReactNode } from "react";
import { OUTLINE } from "../rigTypes";

// -----------------------------------------------------------------------------
// species2 共享躯干件（融合 2.0 · SpeciesArtSpec §3）。
// 全局坐标直绘（躯干是构图基准，不走局部 pivot）。
// -----------------------------------------------------------------------------

/** 豆形身体 + 肚皮补丁（最通用的正面躯干）。 */
export function BeanBody({
  cx,
  cy,
  rx,
  ry,
  color,
  belly,
  bellyScale = 0.62,
  bellyDy = 0.35,
  stroke = 6,
  children,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  belly?: string;
  bellyScale?: number;
  bellyDy?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} stroke={OUTLINE} strokeWidth={stroke} />
      {belly && (
        <ellipse cx={cx} cy={cy + ry * bellyDy} rx={rx * bellyScale} ry={ry * bellyScale * 0.85} fill={belly} opacity={0.9} />
      )}
      {children}
    </g>
  );
}

/** 梨形/蛋形身体（上窄下宽，widthTop 控制顶部收窄 0.5~1）。 */
export function PearBody({
  cx,
  cy,
  rx,
  ry,
  color,
  taper = 0.72,
  stroke = 6,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  taper?: number;
  stroke?: number;
}) {
  const topR = rx * taper;
  return (
    <path
      d={`M${cx - rx} ${cy + ry * 0.28} Q${cx - rx} ${cy + ry} ${cx} ${cy + ry} Q${cx + rx} ${cy + ry} ${cx + rx} ${cy + ry * 0.28} Q${cx + rx} ${cy - ry * 0.6} ${cx + topR} ${cy - ry * 0.92} Q${cx} ${cy - ry * 1.06} ${cx - topR} ${cy - ry * 0.92} Q${cx - rx} ${cy - ry * 0.6} ${cx - rx} ${cy + ry * 0.28} Z`}
      fill={color}
      stroke={OUTLINE}
      strokeWidth={stroke}
      strokeLinejoin="round"
    />
  );
}

/** 趴卧土丘（P3 睡姿基件）：低扁团子 + 臀部起伏暗示。底缘贴 y=baseY。 */
export function ProneMound({
  cx,
  baseY,
  rx,
  ry,
  color,
  haunch = 0.55,
  stroke = 6,
}: {
  cx: number;
  baseY: number;
  rx: number;
  ry: number;
  color: string;
  haunch?: number;
  stroke?: number;
}) {
  const hx = cx + rx * 0.45;
  return (
    <path
      d={`M${cx - rx} ${baseY} Q${cx - rx} ${baseY - ry * 1.5} ${cx - rx * 0.3} ${baseY - ry * 1.7} Q${cx + rx * 0.15} ${baseY - ry * 1.8} ${hx} ${baseY - ry * (1.2 + haunch)} Q${cx + rx} ${baseY - ry * 0.9} ${cx + rx} ${baseY} Z`}
      fill={color}
      stroke={OUTLINE}
      strokeWidth={stroke}
      strokeLinejoin="round"
    />
  );
}
