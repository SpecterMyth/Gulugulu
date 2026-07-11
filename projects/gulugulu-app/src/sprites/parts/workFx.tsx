import type { CSSProperties, ReactNode } from "react";
import { OUTLINE } from "../rigTypes";

// -----------------------------------------------------------------------------
// 点击打工的工具粒子特效（先只做六个一阶角色）。
// - 每个角色的粒子与其工作工具匹配，从工具位置发射，朝与工作动画相符的
//   方向飘散（笔电=代码符号右上飞、喷枪=火星沿喷嘴向右上喷、键盘=键帽向上
//   弹跳、拖把=水珠泡泡向左上甩、魔杖=叶片星光右上喷泉、雪球=雪花冰晶上飘）。
// - 连击越多（tier 越高）：单次粒子越多、锥角越大、飞得越远；落点做了
//   边界收敛，避免被 260px 窗口截断。
// - 每 10 连击触发一次"超级爆炸"冲击环。
// 动画见 sprites.css：.work-p → work-fly；.work-boom → work-boom-ring。
// -----------------------------------------------------------------------------

type ParticleRenderer = (rand: () => number) => ReactNode;

type WorkFxSpec = {
  /** 发射点（viewBox 坐标，≈工具位置） */
  emitter: { x: number; y: number };
  /** 基准飘散方向（弧度，0=向右，-PI/2=向上） */
  baseAngle: number;
  /** 基础锥角（弧度，单侧） */
  cone: number;
  shapes: ParticleRenderer[];
};

// ---- 粒子造型 ----

const codeChip: ParticleRenderer = (rand) => {
  const glyphs = ["</>", "{ }", "()=>", "0101", ";", "fn"];
  const text = glyphs[Math.floor(rand() * glyphs.length)];
  return (
    <g>
      <rect x={-15} y={-9} width={30} height={18} rx={5} fill="#3E4356" stroke={OUTLINE} strokeWidth={2.4} />
      <text x={0} y={4.5} fontSize={10} fontWeight={900} textAnchor="middle" fill="#7FD1FF" fontFamily="ui-monospace, monospace">
        {text}
      </text>
    </g>
  );
};

const cursorBlink: ParticleRenderer = () => (
  <g>
    <rect x={-2.4} y={-8} width={4.8} height={16} rx={1.6} fill="#BFE9FF" stroke={OUTLINE} strokeWidth={1.8} />
  </g>
);

const flameSpark: ParticleRenderer = () => (
  <g>
    <path
      d="M0 7 q-6 -5 -3.5 -12 q2.5 -7 8 -11 q-2 7 2.5 10.5 q5 4.5 3.5 10 a7.5 7.5 0 0 1 -10.5 2.5 z"
      fill="#FFB03A"
      stroke={OUTLINE}
      strokeWidth={2.6}
      strokeLinejoin="round"
    />
    <circle cx={1} cy={0} r={2.6} fill="#FFF1C9" />
  </g>
);

const emberStar: ParticleRenderer = () => (
  <path
    d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z"
    fill="#E85D3A"
    stroke={OUTLINE}
    strokeWidth={1.8}
    strokeLinejoin="round"
  />
);

const keycap: ParticleRenderer = (rand) => {
  const keys = ["A", "W", "S", "D", "⏎", "␣", "!", "?"];
  const text = keys[Math.floor(rand() * keys.length)];
  return (
    <g>
      <rect x={-9} y={-9} width={18} height={18} rx={4} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={2.6} />
      <text x={0} y={4.5} fontSize={10.5} fontWeight={900} textAnchor="middle" fill="#3B2B1D" fontFamily="inherit">
        {text}
      </text>
    </g>
  );
};

const boltSpark: ParticleRenderer = () => (
  <path
    d="M1.5 -8 L-4 1 h3.5 L-1.5 8 L4.5 -1 h-3.5 Z"
    fill="#FFD93B"
    stroke={OUTLINE}
    strokeWidth={1.8}
    strokeLinejoin="round"
  />
);

const waterDrop: ParticleRenderer = () => (
  <path
    d="M0 -8 q6 7 6 11.5 a6 6 0 0 1 -12 0 q0 -4.5 6 -11.5 z"
    fill="#9BDCFF"
    stroke={OUTLINE}
    strokeWidth={2.2}
    strokeLinejoin="round"
  />
);

const soapBubble: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={7} fill="#EAF7FF" opacity={0.55} stroke="#9BDCFF" strokeWidth={2.2} />
    <circle cx={-2.2} cy={-2.4} r={1.8} fill="#FFFFFF" opacity={0.95} />
  </g>
);

const leafBit: ParticleRenderer = () => (
  <g>
    <path d="M0 -8 q7 2.5 1.5 12 q-8 -1.5 -1.5 -12 z" fill="#8CD97B" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
  </g>
);

const sproutStar: ParticleRenderer = () => (
  <path
    d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z"
    fill="#FFEC8F"
    stroke={OUTLINE}
    strokeWidth={1.8}
    strokeLinejoin="round"
  />
);

const snowflakeBit: ParticleRenderer = () => (
  <g stroke="#B0E5F0" strokeWidth={2.2} strokeLinecap="round">
    <path d="M0 -7 V7 M-6 -3.5 L6 3.5 M-6 3.5 L6 -3.5" />
    <circle cx={0} cy={0} r={1.6} fill="#F7FCFD" stroke="none" />
  </g>
);

const iceShard: ParticleRenderer = () => (
  <path
    d="M0 -8 L4 0 L0 8 L-4 0 Z"
    fill="#F7FCFD"
    stroke={OUTLINE}
    strokeWidth={2}
    strokeLinejoin="round"
  />
);

// ---- 六个一阶角色的粒子规格 ----

export const WORK_FX: Record<string, WorkFxSpec> = {
  // 💼 笔记本电脑：代码符号从屏幕向右上飞出
  guluduck: {
    emitter: { x: 188, y: 198 },
    baseAngle: -Math.PI / 3, // 右上 60°
    cone: 0.5,
    shapes: [codeChip, cursorBlink, codeChip],
  },
  // 🍮 料理喷枪：火星沿喷嘴向右上喷
  emberfox: {
    emitter: { x: 202, y: 192 },
    baseAngle: -Math.PI / 4.5, // 偏右上
    cone: 0.42,
    shapes: [flameSpark, emberStar, flameSpark],
  },
  // 💼 机械键盘：键帽向正上方弹跳 + 电花（键盘锚点在 166,231）
  voltmouse: {
    emitter: { x: 166, y: 213 },
    baseAngle: -Math.PI / 2, // 正上
    cone: 0.6,
    shapes: [keycap, boltSpark, keycap],
  },
  // 🧹 拖把：水珠泡泡向左上甩出
  bubblefrog: {
    emitter: { x: 188, y: 210 },
    baseAngle: (-Math.PI * 2) / 3, // 左上
    cone: 0.55,
    shapes: [waterDrop, soapBubble, waterDrop],
  },
  // ✨ 嫩芽魔杖：叶片星光从杖尖右上喷泉
  sproutcap: {
    emitter: { x: 196, y: 178 },
    baseAngle: -Math.PI / 2.6,
    cone: 0.55,
    shapes: [leafBit, sproutStar, leafBit],
  },
  // ✨ 水晶雪球：雪花冰晶向上飘散（宽锥）
  frostpeng: {
    emitter: { x: 200, y: 198 },
    baseAngle: -Math.PI / 2,
    cone: 0.8,
    shapes: [snowflakeBit, iceShard, snowflakeBit],
  },
};

/** 简单可复现伪随机（每次爆发一个 seed，保证 React 重渲染稳定） */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type WorkBurstProps = {
  species: string;
  /** 连击档位（越高粒子越多、锥角越大、飞得越远） */
  tier: number;
  seed: number;
  /** 每 10 连击的超级爆炸冲击环 */
  boom?: boolean;
  /** 全屏特效覆盖层（fx 子窗口）模式：粒子更多、飞得更远，满屏飘散 */
  screen?: boolean;
};

export function WorkBurst({ species, tier, seed, boom = false, screen = false }: WorkBurstProps) {
  const spec = WORK_FX[species];
  if (!spec) return null;

  const rand = mulberry32(seed);
  const count = screen ? Math.min(6 + tier * 2, 30) : Math.min(3 + tier, 14);
  const cone = Math.min(spec.cone + tier * 0.035, screen ? 1.5 : 1.15);
  const reach = (1 + Math.min(tier, 16) * 0.055) * (screen ? 4.2 : 1);
  // 落点边界：窗口内=避免被 260px 窗口截断；全屏=交给显示器边缘自然裁切
  const boundX = screen ? { min: -1600, max: 1860 } : { min: 8, max: 266 };
  const boundYTop = screen ? -1200 : 26;

  const particles = Array.from({ length: count }, (_, index) => {
    const angle = spec.baseAngle + (rand() - 0.5) * 2 * cone;
    const dist = (52 + rand() * 46) * reach;
    const rawX = spec.emitter.x + Math.cos(angle) * dist;
    const rawY = spec.emitter.y + Math.sin(angle) * dist;
    const dx = Math.min(Math.max(rawX, boundX.min), boundX.max) - spec.emitter.x;
    const dy = Math.max(rawY, boundYTop) - spec.emitter.y;
    const rot = (rand() - 0.5) * 260;
    // 全屏模式飞得远，给更长的滞空时间
    const dur = screen ? 0.9 + rand() * 0.55 : 0.62 + rand() * 0.3;
    const delay = rand() * 0.08;
    const scale = 0.75 + rand() * 0.5 + Math.min(tier, 12) * 0.015;
    const shape = spec.shapes[index % spec.shapes.length](rand);
    return (
      <g key={index} transform={`translate(${spec.emitter.x} ${spec.emitter.y})`}>
        <g
          className="work-p"
          style={
            {
              "--dx": `${dx.toFixed(1)}px`,
              "--dy": `${dy.toFixed(1)}px`,
              "--rot": `${rot.toFixed(0)}deg`,
              "--sc": scale.toFixed(2),
              animationDuration: `${dur.toFixed(2)}s`,
              animationDelay: `${delay.toFixed(2)}s`,
            } as CSSProperties
          }
        >
          {shape}
        </g>
      </g>
    );
  });

  return (
    <svg viewBox="0 0 256 256" className="work-burst" aria-hidden="true">
      {boom && (
        <g transform={`translate(${spec.emitter.x} ${spec.emitter.y - 14})`}>
          <g className="work-boom" style={{ "--boom-scale": screen ? 18 : 4.2 } as CSSProperties}>
            <circle r={16} fill="none" stroke="#FFE9AD" strokeWidth={7} opacity={0.9} />
            <circle r={16} fill="none" stroke={OUTLINE} strokeWidth={2.4} />
          </g>
          <g className="work-boom work-boom-late" style={{ "--boom-scale": screen ? 18 : 4.2 } as CSSProperties}>
            <circle r={16} fill="none" stroke="#FFD93B" strokeWidth={4} opacity={0.8} />
          </g>
        </g>
      )}
      {particles}
    </svg>
  );
}
