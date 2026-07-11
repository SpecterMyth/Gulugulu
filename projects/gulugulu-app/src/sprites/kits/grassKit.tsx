import type { ReactNode } from "react";
import { OUTLINE, type RigPalette } from "../rigTypes";

// -----------------------------------------------------------------------------
// 草系签名件（sproutcap 芽芽菇底座 / 二阶复用）。局部坐标，pivot 见各件注释。
// - MushroomCap：苔羽鸭(mossduck) scale≈0.4 当帽子戴；莲叶鲸(lotusturtle)
//   换 colors 做莲叶变体。
// - Sprout：藤电鼠(vinevolt)/莲叶鲸 复用为头顶嫩芽。
// - SproutWandTool：签名 ToolRenderer（主线在 parts/tools.tsx 注册为
//   TOOLS.sproutWand）。
// -----------------------------------------------------------------------------

/**
 * 大菌帽（圆顶 + 微波浪帽檐）。pivot=(0,0)=帽底中心，向上(-y)生长。
 * 基准尺寸：宽 176、高 ~96（scale=1）。children 画在同一缩放空间里
 * （CapSpots / GillSkirt 塞进来即可跟着 scale）。
 * outlineWidth：缩放使用时传 6/scale 保持描边视觉粗细一致。
 */
export function MushroomCap({
  scale = 1,
  color = "#57B84C",
  deep = "#3B8F33",
  outlineWidth = 6,
  children,
}: {
  scale?: number;
  color?: string;
  deep?: string;
  outlineWidth?: number;
  children?: ReactNode;
}) {
  // 圆顶 + 波浪帽檐（下缘在 y≈2..13 间起伏）
  const domeD =
    "M-88 2 C-86 -40 -54 -94 0 -94 C54 -94 86 -40 88 2 " +
    "Q76 11 62 7 Q48 3 36 8 Q22 13 10 8 Q-2 3 -14 8 Q-28 13 -40 7 Q-52 2 -64 7 Q-78 11 -88 2 Z";
  // 帽檐深色环带（同一条波浪下缘，向上收一条弧）
  const bandD =
    "M88 2 Q76 11 62 7 Q48 3 36 8 Q22 13 10 8 Q-2 3 -14 8 Q-28 13 -40 7 Q-52 2 -64 7 Q-78 11 -88 2 " +
    "C-52 -10 52 -10 88 2 Z";
  return (
    <g transform={scale !== 1 ? `scale(${scale})` : undefined}>
      <path d={domeD} fill={color} stroke={OUTLINE} strokeWidth={outlineWidth} strokeLinejoin="round" />
      <path d={bandD} fill={deep} opacity={0.32} />
      {/* 顶部高光 */}
      <ellipse cx={-24} cy={-72} rx={14} ry={7} fill="#FFFFFF" opacity={0.3} transform="rotate(-18 -24 -72)" />
      {children}
    </g>
  );
}

/** 帽面圆斑（2-3 奶白 + 1 浅绿）。局部坐标同 MushroomCap（塞进它 children，
 *  或外部自行 translate+scale 到帽底中心）。 */
export function CapSpots({ color = "#FFF4DC", accent = "#8CD97B" }: { color?: string; accent?: string }) {
  return (
    <g>
      <circle cx={-42} cy={-48} r={15} fill={color} opacity={0.95} />
      <circle cx={36} cy={-30} r={11} fill={color} opacity={0.95} />
      <circle cx={12} cy={-72} r={8} fill={color} opacity={0.9} />
      <circle cx={-14} cy={-22} r={7} fill={accent} opacity={0.9} />
    </g>
  );
}

/** 帽檐内侧菌褶裙边（短竖线纹）。局部坐标同 MushroomCap（rim 在 y≈0）。
 *  gap=中央留空半宽（避免压住檐下的眼睛）。 */
export function GillSkirt({
  color = "#3B8F33",
  halfWidth = 78,
  gap = 24,
  step = 13,
  drop = 6.5,
  opacity = 0.85,
}: {
  color?: string;
  halfWidth?: number;
  gap?: number;
  step?: number;
  drop?: number;
  opacity?: number;
}) {
  const segments: string[] = [];
  let index = 0;
  for (let x = -halfWidth; x <= halfWidth + 0.01; x += step) {
    index += 1;
    if (Math.abs(x) < gap) continue;
    const y = index % 2 === 0 ? 3.5 : 1.5;
    segments.push(`M${Math.round(x * 10) / 10} ${y} v${drop}`);
  }
  return (
    <path d={segments.join(" ")} stroke={color} strokeWidth={3} strokeLinecap="round" fill="none" opacity={opacity} />
  );
}

/** 两叶嫩芽（sproutcap 的 part-headtop 默认件）。pivot=(0,0)=芽根，向上生长。
 *  高 ~30、叶展 ~34（scale=1）。 */
export function Sprout({
  color = "#8CD97B",
  stem = OUTLINE,
  scale = 1,
}: {
  color?: string;
  stem?: string;
  scale?: number;
}) {
  return (
    <g transform={scale !== 1 ? `scale(${scale})` : undefined}>
      <path d="M0 0 Q-1 -8 1 -15" stroke={stem} strokeWidth={4} strokeLinecap="round" fill="none" />
      <g fill={color} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
        {/* 左大叶 */}
        <path d="M1 -15 C-8 -13 -17 -18 -18 -30 C-6 -31 1 -24 1 -15 Z" />
        {/* 右小叶 */}
        <path d="M1 -15 C8 -14 15 -17 16 -27 C7 -28 1 -22 1 -15 Z" />
      </g>
    </g>
  );
}

/** ✨嫩芽魔杖（sproutcap 工具）。ToolRenderer 签名：局部坐标，
 *  pivot=(0,0)=杖底握持点，主体向上(-y)，高 ~55px。
 *  主线集成：parts/tools.tsx 里 `TOOLS.sproutWand = SproutWandTool`。 */
export function SproutWandTool(palette: RigPalette): ReactNode {
  const accent = palette.accent;
  const twigD = "M0 0 C-4 -12 3 -24 -1 -34 Q-3 -41 3 -46";
  const star = (s: number) =>
    `M0 ${-s} L${s * 0.3} ${-s * 0.3} L${s} 0 L${s * 0.3} ${s * 0.3} L0 ${s} L${-s * 0.3} ${s * 0.3} L${-s} 0 L${-s * 0.3} ${-s * 0.3} Z`;
  return (
    <g>
      {/* 杖尖光晕 */}
      <circle cx={3} cy={-52} r={11} fill="#FFFFFF" opacity={0.4} />
      <circle cx={3} cy={-52} r={7} fill={accent} opacity={0.3} />
      {/* 弯弯小树枝（描边叠加出轮廓） */}
      <g fill="none" strokeLinecap="round">
        <path d={twigD} stroke={OUTLINE} strokeWidth={9.5} />
        <path d="M-1 -18 Q-8 -20 -11 -26" stroke={OUTLINE} strokeWidth={7.5} />
        <path d={twigD} stroke="#A8703F" strokeWidth={5.5} />
        <path d="M-1 -18 Q-8 -20 -11 -26" stroke="#A8703F" strokeWidth={4} />
      </g>
      {/* 发光嫩芽（两瓣叶 + 白芯） */}
      <g fill={accent} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <path d="M3 -46 C-3 -45 -8 -49 -9 -57 C-1 -57 3 -52 3 -46 Z" />
        <path d="M3 -46 C9 -45 14 -49 15 -57 C7 -57 3 -52 3 -46 Z" />
      </g>
      <circle cx={3} cy={-51.5} r={2.2} fill="#FFFFFF" opacity={0.9} />
      {/* 小星点 */}
      <g fill="#FFEC8F" opacity={0.95}>
        <g transform="translate(-11 -38)">
          <path d={star(3.5)} />
        </g>
        <g transform="translate(15 -34)">
          <path d={star(2.8)} />
        </g>
        <g transform="translate(11 -60)">
          <path d={star(3)} />
        </g>
      </g>
    </g>
  );
}
