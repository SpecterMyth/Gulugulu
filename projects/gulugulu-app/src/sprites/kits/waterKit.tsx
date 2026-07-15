import { OUTLINE } from "../rigTypes";

// -----------------------------------------------------------------------------
// 水系签名件（bubblefrog 气泡鲸底座 / 水系家族复用）。局部坐标，pivot 见各件注释。
// kit 件允许水系固有色（浅蓝 #9BDCFF 等）；身体跟色走 props 传 palette.*。
// -----------------------------------------------------------------------------

/**
 * 头顶喷水柱。pivot=(0,0)=底部中点（坐在头顶上），向上生长（-y）。
 * 小喷口 + 分叉浅蓝水柱 + 顶端水珠；double=二阶浪涛鲸的双柱喷泉。
 */
export function Spout({
  double = false,
  water = "#9BDCFF",
  nozzle = "#1B5FB0",
  scale = 1,
}: {
  double?: boolean;
  water?: string;
  nozzle?: string;
  scale?: number;
}) {
  const fountain = (
    <g>
      <g fill="none" strokeLinecap="round">
        {/* 描边层（粗）+ 水色层（细）叠出描边水柱 */}
        <g stroke={OUTLINE} strokeWidth={7}>
          <path d="M0 2 L0 -20" />
          <path d="M0 -11 q-4 -13 -15 -19" />
          <path d="M0 -11 q4 -13 15 -19" />
        </g>
        <g stroke={water} strokeWidth={4}>
          <path d="M0 2 L0 -20" />
          <path d="M0 -11 q-4 -13 -15 -19" />
          <path d="M0 -11 q4 -13 15 -19" />
        </g>
      </g>
      <g fill={water} stroke={OUTLINE} strokeWidth={2.6}>
        <circle cx={-17} cy={-35} r={3.4} />
        <circle cx={17} cy={-35} r={3.4} />
        <circle cx={0} cy={-28} r={2.8} />
      </g>
    </g>
  );
  return (
    <g transform={scale === 1 ? undefined : `scale(${scale})`}>
      {double ? (
        <g>
          <g transform="translate(-6 0) rotate(-14)">{fountain}</g>
          <g transform="translate(6 0) rotate(14)">{fountain}</g>
          <path d="M-10 5 Q0 -3 10 5 Q0 9 -10 5 z" fill={nozzle} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </g>
      ) : (
        <g>
          {fountain}
          <path d="M-7 5 Q0 -2 7 5 Q0 8.5 -7 5 z" fill={nozzle} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </g>
      )}
    </g>
  );
}

/**
 * 心形双叶尾鳍。pivot=(0,0)=尾根，两叶向左上展开（侧视鲸朝右的朝向）；
 * 正面视图由 rig 放置层 scale(-1 1) 翻到右后方。
 */
export function Fluke({
  color = "#2E7BD6",
  deep = "#1B5FB0",
  scale = 1,
}: {
  color?: string;
  deep?: string;
  scale?: number;
}) {
  return (
    <g transform={scale === 1 ? undefined : `scale(${scale})`} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round">
      {/* 下叶（深色，靠后） */}
      <path d="M0 0 Q-14 4 -28 0 Q-40 -4 -44 -14 Q-30 -21 -16 -13 Q-5 -7 0 0 z" fill={deep} />
      {/* 上叶（主体色，靠前） */}
      <path d="M0 0 Q-12 -3 -20 -14 Q-26 -24 -24 -34 Q-9 -30 -3 -16 Q0 -8 0 0 z" fill={color} />
    </g>
  );
}

/**
 * 正面小侧鳍（一片）。pivot=(0,0)=肩根，桨叶向右下伸；mirror 翻成左鳍。
 * rig 各自包 <Part name="armL/armR">，两片分开摆放（挥手/打工动画相位不同）。
 */
export function Flippers({ mirror = false, color = "#2E7BD6" }: { mirror?: boolean; color?: string }) {
  return (
    <g transform={mirror ? "scale(-1 1)" : undefined}>
      <path
        d="M0 0 Q16 -4 24 6 Q30 16 22 26 Q10 32 2 22 Q-4 12 0 0 z"
        fill={color}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M8 8 q7 6 6 14" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.3} />
    </g>
  );
}

/** 侧视近侧鳍。pivot=(0,0)=肩根，扁桨叶向身后（-x）微垂着伸。 */
export function SideFlipper({ color = "#2E7BD6" }: { color?: string }) {
  return (
    <g>
      <path
        d="M0 0 Q-14 -6 -26 -2 Q-36 3 -33 12 Q-28 20 -16 18 Q-5 15 1 6 Q2 2 0 0 z"
        fill={color}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M-10 5 q-8 2 -12 8" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.3} />
    </g>
  );
}

/**
 * 波浪顶边的浅色大肚皮补丁 + 2 道波浪纹。pivot=(0,0)=补丁中心，
 * 宽 ~110 高 ~38，rig 放置时可整体 scale。
 */
export function BellyWave({
  color = "#EAF7FF",
  wave = "#9BDCFF",
  scale = 1,
}: {
  color?: string;
  wave?: string;
  scale?: number;
}) {
  return (
    <g transform={scale === 1 ? undefined : `scale(${scale})`}>
      <path
        d="M-55 -10 q11 -12 22 0 q11 -12 22 0 q11 -12 22 0 q11 -12 22 0 q11 -12 22 0 Q52 14 0 18 Q-52 14 -55 -10 z"
        fill={color}
      />
      <g stroke={wave} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.75}>
        <path d="M-30 0 q5 -6 10 0 q5 -6 10 0" />
        <path d="M4 7 q5 -6 10 0 q5 -6 10 0" />
      </g>
    </g>
  );
}

/**
 * 🧹 拖把（bubblefrog 的打工工具）。pivot=(0,0)=拖把头落地点，
 * 木杆向右上斜出（被侧鳍扶着的角度），高 ~60px，附一小滩水渍。
 */
export function MopTool({ wood = "#B98A4E", head = "#EDE8DE" }: { wood?: string; head?: string }) {
  return (
    <g>
      {/* 水渍 */}
      <ellipse cx={11} cy={0} rx={16} ry={4.5} fill="#9BDCFF" opacity={0.5} />
      {/* 木杆（描边层 + 木色层） */}
      <path d="M-1 -14 L13 -59" stroke={OUTLINE} strokeWidth={7.5} strokeLinecap="round" fill="none" />
      <path d="M-1 -14 L13 -59" stroke={wood} strokeWidth={4} strokeLinecap="round" fill="none" />
      {/* 颈箍 */}
      <path d="M-8 -19 l14 4.5 l2.5 -7.5 l-14 -4.5 z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      {/* 拖把头（垂坠流苏） */}
      <path
        d="M-9 -15 Q-19 -12 -21 -2 Q-21.5 1 -18.5 1 Q-16.5 1 -16 -2 Q-15 2 -12 2 Q-9 2 -8.5 -2 Q-7.5 2 -4.5 2 Q-1.5 2 -1 -2 Q0 1 2.5 1 Q5 1 4.5 -2 Q6 -12 -2 -15 Q-6 -16 -9 -15 z"
        fill={head}
        stroke={OUTLINE}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <g stroke={OUTLINE} strokeWidth={2} strokeLinecap="round" opacity={0.25} fill="none">
        <path d="M-13 -10 q-2 5 -2 9" />
        <path d="M-6 -11 q-1 5 -1 10" />
        <path d="M0 -10 q1 5 1 9" />
      </g>
    </g>
  );
}
