import { OUTLINE } from "../rigTypes";

// -----------------------------------------------------------------------------
// 火系签名件（emberfox / infernofox / 火系组合宠复用）。局部坐标，pivot=(0,0)，
// 见各件注释。火焰固有色：外层红 #E85D3A / 中层橙 #FFB03A / 焰心奶白 #FFF1C9。
// -----------------------------------------------------------------------------

const FLAME_RED = "#E85D3A";
const FLAME_ORANGE = "#FFB03A";
const FLAME_CREAM = "#FFF1C9";

/** 外层火焰轮廓：根在 (0,0)，向上卷成 S 形，总高 ~166。 */
const FLAME_D =
  "M2 2 " +
  "C-14 2 -30 -10 -32 -32 " +
  "C-34 -54 -24 -68 -22 -88 " +
  "C-20 -104 -30 -114 -28 -128 " +
  "C-26 -146 -12 -154 0 -166 " +
  "C2 -152 12 -146 14 -132 " +
  "C16 -118 8 -110 10 -96 " +
  "C12 -80 24 -70 26 -50 " +
  "C28 -26 16 -2 2 2 Z";

/**
 * 三层火焰大尾（炎尾狐签名剪影件）。pivot=(0,0)=尾根，向上生长，
 * 放置时用外层 <g transform> 旋出后仰角。scale 整体缩放；layers 控制色层数
 * （3=红/橙/奶白全层；二阶炎狱狐的三条尾可给侧尾减层复用）。
 */
export function FlameTail({ scale = 1, layers = 3 }: { scale?: number; layers?: 1 | 2 | 3 }) {
  return (
    <g transform={scale !== 1 ? `scale(${scale})` : undefined}>
      <path d={FLAME_D} fill={FLAME_RED} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
      {layers >= 2 && <path d={FLAME_D} fill={FLAME_ORANGE} transform="scale(0.62)" />}
      {layers >= 3 && <path d={FLAME_D} fill={FLAME_CREAM} transform="scale(0.36)" />}
    </g>
  );
}

/**
 * 双尖三角耳（front）。pivot=(0,0)=两耳基线中点；耳基下沉到 y≈+12，
 * 放置在头顶弧上并画在头形*后面*，由头把基线盖住。
 */
export function PointedEars({
  color,
  inner = FLAME_CREAM,
  scale = 1,
}: {
  color: string;
  inner?: string;
  scale?: number;
}) {
  return (
    <g transform={scale !== 1 ? `scale(${scale})` : undefined}>
      <SingleEar color={color} inner={inner} />
      <g transform="scale(-1 1)">
        <SingleEar color={color} inner={inner} />
      </g>
    </g>
  );
}

function SingleEar({ color, inner }: { color: string; inner: string }) {
  return (
    <g>
      <path
        d="M-14 12 C-18 -4 -25 -22 -36 -40 C-44 -26 -47 -6 -45 12 Z"
        fill={color}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M-22 6 C-25 -6 -29 -16 -34 -26 C-38 -17 -40 -7 -40 6 Z" fill={inner} />
    </g>
  );
}

/** 侧视单耳。pivot=(0,0)=耳基中点，向上收尖（放置时可旋转出前后倾）。 */
export function SideEar({
  color,
  inner = FLAME_CREAM,
  scale = 1,
}: {
  color: string;
  inner?: string;
  scale?: number;
}) {
  return (
    <g transform={scale !== 1 ? `scale(${scale})` : undefined}>
      <path
        d="M-15 12 C-12 -8 -6 -24 3 -38 C10 -22 14 -4 14 12 Z"
        fill={color}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M-8 8 C-6 -6 -2 -16 3 -26 C7 -16 9 -6 9 8 Z" fill={inner} />
    </g>
  );
}

/** 奶油口鼻补丁（front）：横椭圆 + 小三角鼻 + w 嘴。pivot=(0,0)=补丁中心。
 *  withMouth=false 时只画补丁+鼻（嘴交给表情库 ExpFace 按状态渲染）。 */
export function CreamMuzzle({
  color = FLAME_CREAM,
  scale = 1,
  withMouth = true,
}: {
  color?: string;
  scale?: number;
  withMouth?: boolean;
}) {
  return (
    <g transform={scale !== 1 ? `scale(${scale})` : undefined}>
      <ellipse cx={0} cy={1} rx={23} ry={14} fill={color} />
      <path d="M-5.5 -7 L5.5 -7 L0 -0.5 Z" fill={OUTLINE} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      {withMouth && (
        <path d="M-9 5 q4.5 6 9 0 q4.5 6 9 0" fill="none" stroke={OUTLINE} strokeWidth={3.5} strokeLinecap="round" />
      )}
    </g>
  );
}

/**
 * 🍮 料理喷枪（甜品师烤布蕾用）。pivot=(0,0)=底部握持点，向上作画，高 ~50，
 * 喷嘴朝右、嘴上一小簇蓝外橙心火苗。
 */
export function TorchTool() {
  return (
    <g>
      {/* 圆胖罐身 */}
      <rect x={-12} y={-36} width={24} height={37} rx={10} fill={FLAME_CREAM} stroke={OUTLINE} strokeWidth={4} />
      {/* 罐身色带 */}
      <path d="M-12 -22 h24 v9 h-24 z" fill={FLAME_RED} />
      {/* 枪头 */}
      <rect x={-10} y={-48} width={20} height={14} rx={5} fill="#C23B1F" stroke={OUTLINE} strokeWidth={4} />
      {/* 扳机 */}
      <path d="M-10 -40 q-8 2 -7 10" fill="none" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
      {/* 喷嘴（向右前伸） */}
      <rect x={8} y={-45} width={15} height={7.5} rx={3.5} fill="#8E93A6" stroke={OUTLINE} strokeWidth={3.5} />
      {/* 火苗：蓝外橙心 */}
      <path d="M23 -41 q11 -7 19 0 q-8 7 -19 0 z" fill="#7CC4FF" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M25 -41 q7 -3.5 11 0 q-4 3.5 -11 0 z" fill={FLAME_ORANGE} />
    </g>
  );
}
