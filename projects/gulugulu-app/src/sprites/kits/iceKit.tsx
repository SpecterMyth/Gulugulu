import { OUTLINE } from "../rigTypes";

// -----------------------------------------------------------------------------
// 冰系签名件（frostpeng / glacierpeng / 冰组合系）。局部坐标，pivot 见各件注释。
// 配色红线：不允许大面积纯 #FFFFFF——所有"白"一律带青
// （毛 #CFEFF6 / 面·雪 #F7FCFD / 冰晶 #B0E5F0 / 深部 #8FD8E8 / 点缀深青 #4FA6C9）。
// -----------------------------------------------------------------------------

/** 冰系点缀深青（底座金属/鼻头等小面积用） */
export const ICE_DEEP_TEAL = "#4FA6C9";

/**
 * 锯齿毛边条。pivot=(0,0)=条顶边中点，锯齿向下垂（毛尖朝 +y）。
 * 顶边平直（塞进衣领/帽檐/身体下面），齿长长短交替显得蓬松。
 * 复用点：二阶霜羽鸭围脖、极光貂蓬毛、雪兔菇帽檐绒边、雪怪毛裙摆。
 */
export function FurRidge({
  width = 90,
  teeth = 6,
  depth = 12,
  color = "#CFEFF6",
  stroke = OUTLINE,
}: {
  width?: number;
  teeth?: number;
  depth?: number;
  color?: string;
  stroke?: string;
}) {
  const half = width / 2;
  const step = width / teeth;
  // 顶边从左到右，锯齿从右往左回来（长短交替）
  let d = `M${-half} 0 L${half} 0`;
  for (let i = 0; i < teeth; i += 1) {
    const x0 = half - step * i;
    const tipX = x0 - step * 0.5;
    const tipY = depth * (i % 2 === 0 ? 1 : 0.7);
    d += ` L${tipX.toFixed(1)} ${tipY.toFixed(1)} L${(x0 - step).toFixed(1)} 2`;
  }
  d += " Z";
  return <path d={d} fill={color} stroke={stroke} strokeWidth={4} strokeLinejoin="round" />;
}

/**
 * 背部小冰晶簇。pivot=(0,0)=簇底边中点，冰晶向上生长（-y）。
 * count 控制根数（极冰雪帝翻倍用），中间最高、两侧递减。
 */
export function IceSpikes({
  count = 3,
  scale = 1,
  color = "#B0E5F0",
  highlight = "#F7FCFD",
}: {
  count?: number;
  scale?: number;
  color?: string;
  highlight?: string;
}) {
  const mid = (count - 1) / 2;
  const spikes = [];
  for (let i = 0; i < count; i += 1) {
    const x = (i - mid) * 13;
    const h = Math.max(12, 27 - Math.abs(i - mid) * 7 + (i % 2) * 2);
    spikes.push(
      <g key={i}>
        <path
          d={`M${x - 5.5} 0 L${x - 4} ${(-h * 0.55).toFixed(1)} L${x} ${-h} L${x + 4} ${(-h * 0.55).toFixed(1)} L${x + 5.5} 0 Z`}
          fill={color}
          stroke={OUTLINE}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path
          d={`M${x - 0.5} ${(-h + 5).toFixed(1)} L${x - 1.8} -3`}
          stroke={highlight}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.85}
        />
      </g>,
    );
  }
  return <g transform={scale !== 1 ? `scale(${scale})` : undefined}>{spikes}</g>;
}

/** 呵气小雾团。pivot=(0,0)=嘴前起点，雾团向右上飘散（侧视嘴前用）。 */
export function FrostBreath({ color = "#B0E5F0" }: { color?: string }) {
  return (
    <g fill={color}>
      <circle cx={9} cy={-3} r={6.5} opacity={0.6} />
      <circle cx={21} cy={-8} r={4.5} opacity={0.45} fill="#CFEFF6" />
      <circle cx={30} cy={-13} r={2.8} opacity={0.35} />
    </g>
  );
}

/**
 * ✨水晶雪球（frostpeng 工具）。pivot=(0,0)=底座底边中点，主体向上（-y），
 * 高 ~50px：青蓝底座 + 玻璃球（浅青描边+高光弧）+ 球内迷你小雪人 + 雪花。
 */
export function SnowGlobeTool({
  base = ICE_DEEP_TEAL,
  glass = "#B0E5F0",
  snow = "#F7FCFD",
}: {
  base?: string;
  glass?: string;
  snow?: string;
}) {
  return (
    <g>
      {/* 玻璃球（半透明，浅青描边） */}
      <circle cx={0} cy={-29} r={19} fill={snow} fillOpacity={0.4} stroke={glass} strokeWidth={3.5} />
      {/* 球内积雪地面 */}
      <path d="M-13 -20 Q0 -28 13 -20 Q6 -14.5 0 -14.5 Q-6 -14.5 -13 -20 Z" fill={snow} />
      {/* 迷你小雪人 */}
      <circle cx={0} cy={-22} r={4.8} fill={snow} stroke="#8FD8E8" strokeWidth={1.5} />
      <circle cx={0} cy={-29.5} r={3.4} fill={snow} stroke="#8FD8E8" strokeWidth={1.5} />
      <circle cx={-1.2} cy={-30.2} r={0.7} fill={OUTLINE} />
      <circle cx={1.2} cy={-30.2} r={0.7} fill={OUTLINE} />
      <path d="M0 -29.4 L4 -28.5 L0 -27.7 Z" fill="#F5A83B" />
      {/* 飘着的雪花点 */}
      <g fill={snow} opacity={0.9}>
        <circle cx={-9} cy={-34} r={1.4} />
        <circle cx={7} cy={-38} r={1.4} />
        <circle cx={-4} cy={-42} r={1.2} />
        <circle cx={10} cy={-26} r={1.2} />
      </g>
      {/* 玻璃高光弧 */}
      <path d="M-12 -39 A14 14 0 0 1 -3 -45" fill="none" stroke={snow} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
      {/* 青蓝底座 */}
      <path d="M-16 0 L16 0 L13 -10 Q0 -14 -13 -10 Z" fill={base} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M-13.5 -4.5 H13.5" stroke="#8FD8E8" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
    </g>
  );
}
