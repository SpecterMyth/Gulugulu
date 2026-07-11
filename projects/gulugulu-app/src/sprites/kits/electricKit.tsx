import { OUTLINE } from "../rigTypes";

// -----------------------------------------------------------------------------
// 电系签名件（voltmouse / 雷霆鼠皇 / 电系组合体复用）。局部坐标，pivot 见各件注释。
// 电系固有色：闪电黄 #FFD93B、白芯 #FFFFFF、电花橙 #FF9B3D。
// -----------------------------------------------------------------------------

/** 闪电折线主形：root=(0,0)=尾根底边中点，尖端朝左上（-x/-y），3 折锐角。 */
const BOLT_D = "M-7 0 L7 0 L-1 -13 L7 -13 L-11 -34 L-6 -19 L-15 -19 Z";

/**
 * 折线闪电尾（黄底白芯）。pivot=(0,0)=尾根，向左上生长（放置时可旋转）。
 * bbox x∈[-15,7] y∈[-34,0] → Part origin 建议 "70% 100%"。
 * double=true 时再甩出一股（二阶雷霆鼠皇的双股尾）。
 */
export function BoltTail({
  color = "#FFD93B",
  core = "#FFFFFF",
  scale = 1,
  double = false,
}: {
  color?: string;
  core?: string;
  scale?: number;
  double?: boolean;
}) {
  const bolt = (
    <g>
      <path d={BOLT_D} fill={color} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="miter" />
      <path d={BOLT_D} transform="translate(-1.5 -7) scale(0.55)" fill={core} />
    </g>
  );
  return (
    <g transform={scale !== 1 ? `scale(${scale})` : undefined}>
      {double && <g transform="rotate(26) scale(0.8)">{bolt}</g>}
      {bolt}
    </g>
  );
}

/**
 * 正面超大双圆耳（剪影签名）。pivot=(0,0)=两耳连线中点（贴头顶放置，
 * 先画耳再画头球，让头轮廓压住耳根）。
 */
export function RoundEars({
  body = "#FFD93B",
  inner = "#FFF6CE",
  r = 21,
  spread = 26,
}: {
  body?: string;
  inner?: string;
  r?: number;
  spread?: number;
}) {
  return (
    <g>
      <circle cx={-spread} cy={0} r={r} fill={body} stroke={OUTLINE} strokeWidth={5} />
      <circle cx={-spread} cy={0} r={r * 0.55} fill={inner} />
      <circle cx={spread} cy={0} r={r} fill={body} stroke={OUTLINE} strokeWidth={5} />
      <circle cx={spread} cy={0} r={r * 0.55} fill={inner} />
    </g>
  );
}

/** 侧视单大耳。pivot=(0,0)=耳心（贴头顶偏后放置，头球画在耳后盖住耳根）。 */
export function SideEar({
  body = "#FFD93B",
  inner = "#FFF6CE",
  r = 21,
}: {
  body?: string;
  inner?: string;
  r?: number;
}) {
  return (
    <g>
      <circle cx={0} cy={0} r={r} fill={body} stroke={OUTLINE} strokeWidth={5} />
      <circle cx={0} cy={0} r={r * 0.55} fill={inner} />
    </g>
  );
}

/** "+" 形小电花（深底白芯，黄色身体上也能读出来）。 */
export function SparkPlus({ x = 0, y = 0, s = 4 }: { x?: number; y?: number; s?: number }) {
  const d = `M${-s} 0 H${s} M0 ${-s} V${s}`;
  return (
    <g transform={`translate(${x} ${y})`} fill="none" strokeLinecap="round">
      <path d={d} stroke={OUTLINE} strokeWidth={4.4} opacity={0.85} />
      <path d={d} stroke="#FFFFFF" strokeWidth={2} />
    </g>
  );
}

/**
 * 电花脸颊：两颊橙色圆斑 + 各一点 "+" 电花。pivot=(0,0)=两颊中心参考点。
 * spread/r 随头围调（baby 31/7，kid 24/6）。
 */
export function SparkCheeks({
  color = "#FF9B3D",
  spread = 31,
  r = 7,
}: {
  color?: string;
  spread?: number;
  r?: number;
}) {
  return (
    <g>
      <circle cx={-spread} cy={0} r={r} fill={color} />
      <circle cx={spread} cy={0} r={r} fill={color} />
      <SparkPlus x={-(spread + 9)} y={-7} s={3.6} />
      <SparkPlus x={spread + 9} y={-7} s={3.6} />
    </g>
  );
}

/**
 * 💼 机械键盘（voltmouse）：比小鼠还宽的一整块，平放地面（俯视微透视梯形，
 * 两排键帽，1-2 个 accent 键帽）。pivot=(0,0)=键盘底边中点，向上作画。
 */
export function KeyboardTool({ accent = "#FF9B3D" }: { accent?: string }) {
  const cap = "#FFF6CE";
  const backKeys = [-40, -29, -18, -7, 4, 15, 26];
  const frontKeys = [-45, -32, -19, 20, 33];
  return (
    <g>
      {/* 底板（后窄前宽的微透视） */}
      <path
        d="M-52 0 L52 0 L44 -20 L-44 -20 Z"
        fill="#8E93A6"
        stroke={OUTLINE}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      {/* 后排键帽 */}
      {backKeys.map((x) => (
        <rect
          key={`b${x}`}
          x={x}
          y={-17}
          width={9}
          height={6}
          rx={1.5}
          fill={x === -40 ? accent : cap}
          stroke={OUTLINE}
          strokeWidth={2}
        />
      ))}
      {/* 前排键帽 + 空格 */}
      {frontKeys.map((x) => (
        <rect
          key={`f${x}`}
          x={x}
          y={-9}
          width={11}
          height={7}
          rx={1.5}
          fill={x === 33 ? accent : cap}
          stroke={OUTLINE}
          strokeWidth={2}
        />
      ))}
      <rect x={-6} y={-9} width={24} height={7} rx={1.5} fill={cap} stroke={OUTLINE} strokeWidth={2} />
    </g>
  );
}
