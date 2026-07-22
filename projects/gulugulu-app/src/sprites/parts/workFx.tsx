import type { CSSProperties, ReactNode } from "react";
import { OUTLINE } from "../rigTypes";
import { getCustomWorkFx, renderWorkFxParticle, type ResolvedWorkFx } from "../customSpecies";

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

export type ParticleRenderer = (rand: () => number) => ReactNode;

export type WorkFxSpec = {
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
  const glyphs = ["</>", "{ }", "// TODO", "git -f", ";", "fn"];
  const text = glyphs[Math.floor(rand() * glyphs.length)];
  return (
    <g>
      <rect x={-15} y={-9} width={30} height={18} rx={5} fill="#3E4356" stroke={OUTLINE} strokeWidth={2.4} />
      <text x={0} y={4} fontSize={9} fontWeight={900} textAnchor="middle" fill="#7FD1FF" fontFamily="ui-monospace, monospace">
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

// ---- 工具产物粒子的通用工厂（同形状、变固有色，避免重复） ----

/** 泪滴（墨滴/药滴/糖浆/雨滴：换固有色即可） */
const drop = (fill: string): ParticleRenderer => () => (
  <path d="M0 -7 q5 6 5 9 a5 5 0 0 1 -10 0 q0 -3 5 -9 z" fill={fill} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);

/** 云团/蒸汽/烟（换色：白蒸汽 / 灰烟 / 深灰乌云） */
const puff = (fill: string): ParticleRenderer => () => (
  <path
    d="M-8 2 a5 5 0 0 1 3 -8 a6 6 0 0 1 11 1 a4.5 4.5 0 0 1 -1 8 q-7 1.5 -13 -1 z"
    fill={fill}
    stroke={OUTLINE}
    strokeWidth={2.2}
    strokeLinejoin="round"
  />
);

/** 小方块（切好的食材/肉丁/黏土：换固有色） */
const cube = (fill: string): ParticleRenderer => () => (
  <rect x={-5} y={-5} width={10} height={10} rx={2.5} fill={fill} stroke={OUTLINE} strokeWidth={2.2} />
);

/** 四角闪光星（火花/灵光/霜光：换固有色） */
const sparkle = (fill: string): ParticleRenderer => () => (
  <path d="M0 -7 Q1 -1 7 0 Q1 1 0 7 Q-1 1 -7 0 Q-1 -1 0 -7 Z" fill={fill} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
);

// ---- 工具产物粒子造型（27 件目录工具的产物；元素点缀仅作次要） ----

/** 🖊️ 钢笔：书写笔锋（墨色弧笔画） */
const signSwirl: ParticleRenderer = () => (
  <path d="M-7 5 q2 -11 7 -6 q-4 2 -1 5 q3 3 8 -3" fill="none" stroke="#2E3A6E" strokeWidth={2.6} strokeLinecap="round" />
);

/** 🍳 炒锅：颠出的油花 */
const oilDrop: ParticleRenderer = () => (
  <g>
    <path d="M0 -6 q4 5 4 8 a4 4 0 0 1 -8 0 q0 -3 4 -8 z" fill="#F0B84A" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <circle cx={-1} cy={2} r={1.1} fill="#FFF1C9" />
  </g>
);

/** 🧪 药锅：翻涌药泡 */
const potionBubble: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={5} fill="#8CD97B" opacity={0.75} stroke={OUTLINE} strokeWidth={2} />
    <circle cx={-1.6} cy={-1.8} r={1.4} fill="#EAFBE4" />
  </g>
);

/** 🖨️ 打印机：吐出的打印纸 */
const paperSheet: ParticleRenderer = () => (
  <g transform="rotate(-8)">
    <rect x={-7} y={-9} width={14} height={18} rx={2} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.2} />
    <path d="M-4 -4 h8 M-4 0 h8 M-4 4 h6" stroke="#8E93A6" strokeWidth={1.6} strokeLinecap="round" />
  </g>
);

/** 🖨️ 打印机：墨点 */
const inkDot: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={3.4} fill="#3E4356" stroke={OUTLINE} strokeWidth={1.6} />
    <circle cx={3} cy={-2.5} r={1.2} fill="#3E4356" />
  </g>
);

/** 🌸 洒水壶：甩出的花瓣 */
const petalBit: ParticleRenderer = () => (
  <path d="M0 -7 q7 4 0 12 q-7 -8 0 -12 z" fill="#F7B7D0" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);

/** 💡 激光笔：投射的激光点 */
const laserDot: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={4} fill="#E2432E" stroke={OUTLINE} strokeWidth={1.8} />
    <circle cx={-1.2} cy={-1.2} r={1.2} fill="#FFD0C4" />
  </g>
);

/** 📽️ 激光笔：翻页的幻灯片 */
const slideBit: ParticleRenderer = () => (
  <g>
    <rect x={-7} y={-5} width={14} height={10} rx={1.6} fill="#BFE9FF" stroke={OUTLINE} strokeWidth={2.2} />
    <path d="M-4 2 l3 -4 2 2 3 -3" fill="none" stroke="#2E7BD6" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </g>
);

/** 🔥 火种灯笼/台灯：暖光点 */
const lightMote: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={4} fill="#FFE9AD" stroke={OUTLINE} strokeWidth={1.8} />
    <circle cx={-1.2} cy={-1.2} r={1.3} fill="#FFF8E0" />
  </g>
);

/** ❄️🔥 空调遥控：暖气热浪（配雪花=冷热双修） */
const warmWave: ParticleRenderer = () => (
  <path d="M-6 5 q3 -5 0 -8.5 q-3 -3.5 0 -8" fill="none" stroke="#E85D3A" strokeWidth={2.4} strokeLinecap="round" />
);

/** 🎧 耳机：外放声波弧 */
const soundWave: ParticleRenderer = () => (
  <g fill="none" stroke="#2E7BD6" strokeWidth={2.4} strokeLinecap="round">
    <path d="M-3 -6 a8 8 0 0 1 0 12" />
    <path d="M2 -9 a12 12 0 0 1 0 18" />
  </g>
);

/** 💬 耳机：客服对话框 */
const chatBubble: ParticleRenderer = () => (
  <g>
    <path
      d="M-7 -6 h14 a3 3 0 0 1 3 3 v5 a3 3 0 0 1 -3 3 h-8 l-4 4 v-4 h-2 a3 3 0 0 1 -3 -3 v-5 a3 3 0 0 1 3 -3 z"
      fill="#FFF6CE"
      stroke={OUTLINE}
      strokeWidth={2.2}
      strokeLinejoin="round"
    />
    <path d="M-3 -1 h8 M-3 2 h5" stroke="#8E93A6" strokeWidth={1.6} strokeLinecap="round" />
  </g>
);

/** 🔮 水晶球：灵光旋涡 */
const mysticSwirl: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={5.5} fill="#C9B8F0" stroke={OUTLINE} strokeWidth={2} />
    <path d="M2 -2 a3 3 0 1 0 1 3" fill="none" stroke="#7B5FC9" strokeWidth={1.8} strokeLinecap="round" />
  </g>
);

/** 🎣 捞网：捞起的小鱼 */
const fishBit: ParticleRenderer = () => (
  <g>
    <path d="M-6 0 q4 -5 9 0 q-4 5 -9 0 z" fill="#9BDCFF" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M4 0 l4 -3 v6 z" fill="#9BDCFF" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
    <circle cx={-2} cy={-0.5} r={0.9} fill={OUTLINE} />
  </g>
);

/** 🧶 毛线球：织出的线脚 */
const yarnLoop: ParticleRenderer = () => (
  <path d="M-5 5 L0 -5 L5 5 M0 -5 v10" fill="none" stroke="#E48AA6" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
);

/** 🧶 毛线球：缠线小球 */
const yarnClew: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={5} fill="#B0E5F0" stroke={OUTLINE} strokeWidth={2} />
    <path d="M-4 -2 q4 -2 8 1 M-4 2 q4 -2 8 1" fill="none" stroke="#4FA6C9" strokeWidth={1.4} />
  </g>
);

/** 🖌️ 数位笔：数码彩点（随机取色） */
const colorDot: ParticleRenderer = (rand) => {
  const cols = ["#E85D3A", "#FFD93B", "#57B84C", "#2E7BD6"];
  const c = cols[Math.floor(rand() * cols.length)];
  return <circle cx={0} cy={0} r={4} fill={c} stroke={OUTLINE} strokeWidth={1.8} />;
};

// ---- 一阶 6 件的新粒子造型（tangible/meme 重做；替换旧的元素点缀粒子） ----

/** 🐞 笔电：红瓢虫 bug（椭圆身+中缝+两斑点+触角）。 */
const bugBit: ParticleRenderer = () => (
  <g>
    <path d="M-3 -6 q-2 -3 -4.5 -4 M3 -6 q2 -3 4.5 -4" fill="none" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" />
    <circle cx={-7.5} cy={-10.5} r={1.3} fill={OUTLINE} />
    <circle cx={7.5} cy={-10.5} r={1.3} fill={OUTLINE} />
    <ellipse cx={0} cy={0.5} rx={8} ry={6.5} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.2} />
    <path d="M-4.5 -4.2 a4.6 4.6 0 0 1 9 0 z" fill={OUTLINE} />
    <line x1={0} y1={-4} x2={0} y2={6.5} stroke={OUTLINE} strokeWidth={1.6} />
    <circle cx={-3.6} cy={1.6} r={1.5} fill={OUTLINE} />
    <circle cx={3.6} cy={1.6} r={1.5} fill={OUTLINE} />
  </g>
);

/** 💙 笔电：蓝屏死机 BSOD（蓝窗+白色 ":(" + 两行细白线）。 */
const bsodBit: ParticleRenderer = () => (
  <g>
    <rect x={-9} y={-8} width={18} height={16} rx={2} fill="#2E7BD6" stroke={OUTLINE} strokeWidth={2.2} />
    <text x={-3.5} y={0.5} fontSize={8.5} fontWeight={900} textAnchor="middle" fill="#FFFFFF" fontFamily="ui-monospace, monospace">
      :(
    </text>
    <path d="M-6 4 h11 M-6 6 h7" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" />
  </g>
);

/** 🍮 喷枪厨师：焦糖布丁盅（奶油盅体+焦糖脆顶弧）。 */
const bruleeCup: ParticleRenderer = () => (
  <g>
    <path d="M-8 -2 h16 l-2 8 q-6 3 -12 0 z" fill="#FBE9C8" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
    <path d="M-8.5 -2.5 q8.5 -4.5 17 0 q-8.5 3 -17 0 z" fill="#C77A44" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
    <path d="M-4 -3.2 q4 -1.5 8 0" fill="none" stroke="#FFE8D6" strokeWidth={1.4} strokeLinecap="round" />
  </g>
);

/** 🍬 喷枪厨师：焦糖脆片（琥珀裂盘+裂纹）。 */
const sugarShard: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={7} fill="#E0A046" stroke={OUTLINE} strokeWidth={2.2} />
    <path d="M-5 -3 L0.5 0 L-1 5 M0.5 0 L5.5 -1.5" fill="none" stroke={OUTLINE} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={-2.4} cy={-2.4} r={1.4} fill="#FFE8D6" opacity={0.85} />
  </g>
);

/** 🧯 喷枪厨师：灭火器（红瓶身+黑喷嘴——火太大了）。 */
const extinguisher: ParticleRenderer = () => (
  <g>
    <rect x={-4} y={-4} width={8} height={12} rx={3} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.2} />
    <rect x={-3} y={-8} width={6} height={4} rx={1.5} fill="#3E4356" stroke={OUTLINE} strokeWidth={1.8} />
    <path d="M2 -6 q6 -1.5 5 5" fill="none" stroke={OUTLINE} strokeWidth={2} strokeLinecap="round" />
    <rect x={-2.6} y={0.5} width={5.2} height={4} rx={0.8} fill="#FFF6CE" opacity={0.9} />
  </g>
);

/** 🗨️ 键盘玩家：GG 对话气泡。 */
const ggBubble: ParticleRenderer = () => (
  <g>
    <path
      d="M-9 -8 h18 a3 3 0 0 1 3 3 v6 a3 3 0 0 1 -3 3 h-6 l-4 4 v-4 h-8 a3 3 0 0 1 -3 -3 v-6 a3 3 0 0 1 3 -3 z"
      fill="#FFF6CE"
      stroke={OUTLINE}
      strokeWidth={2.2}
      strokeLinejoin="round"
    />
    <text x={0} y={1.5} fontSize={9.5} fontWeight={900} textAnchor="middle" fill="#E2432E" fontFamily="inherit">
      GG
    </text>
  </g>
);

/** ⌨️ 键盘玩家：暴走碎键帽（翻滚的裂键帽+崩掉的碎角）。 */
const rageKeycap: ParticleRenderer = () => (
  <g transform="rotate(-18)">
    <rect x={-9} y={-9} width={18} height={18} rx={4} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={2.6} />
    <path d="M-2 -9 L1 -2 L-3 2 L0 9" fill="none" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 -11 l5 -1.5 -1 5 z" fill="#FFF6CE" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
  </g>
);

/** 🫧 拖把清洁工：肥皂泡簇（三泡+高光；亦见 soapBubble）。 */
const soapSuds: ParticleRenderer = () => (
  <g>
    <circle cx={-4} cy={2.5} r={5} fill="#EAF7FF" opacity={0.6} stroke="#9BDCFF" strokeWidth={2} />
    <circle cx={4.5} cy={3.5} r={4} fill="#EAF7FF" opacity={0.6} stroke="#9BDCFF" strokeWidth={2} />
    <circle cx={0} cy={-4} r={5.5} fill="#EAF7FF" opacity={0.6} stroke="#9BDCFF" strokeWidth={2} />
    <circle cx={-2} cy={-6} r={1.6} fill="#FFFFFF" opacity={0.95} />
    <circle cx={2.4} cy={1} r={1.2} fill="#FFFFFF" opacity={0.9} />
  </g>
);

/** 🟤 拖把清洁工：污垢块（褐色不规则团+黑斑）。 */
const grimeClod: ParticleRenderer = () => (
  <g>
    <path
      d="M-6 -2 q-2 -5 4 -5 q4 -2 6 3 q4 2 1 6 q1 5 -5 4 q-6 1 -6 -4 q-2 -2 0 -4 z"
      fill="#8B6A45"
      stroke={OUTLINE}
      strokeWidth={2.2}
      strokeLinejoin="round"
    />
    <circle cx={-2} cy={-0.5} r={1.2} fill="#5E4630" />
    <circle cx={2.2} cy={2.4} r={1} fill="#5E4630" />
    <circle cx={3} cy={-2} r={0.9} fill="#5E4630" />
  </g>
);

/** ⚠️ 拖把清洁工：小心地滑黄牌（A 字架+感叹号）。 */
const wetFloorSign: ParticleRenderer = () => (
  <g>
    <path d="M0 -8 L6.5 8 H-6.5 Z" fill="#FFD93B" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
    <path d="M0 -8 L2.5 8" fill="none" stroke={OUTLINE} strokeWidth={1.3} opacity={0.45} />
    <line x1={-0.6} y1={-2} x2={-0.6} y2={3} stroke={OUTLINE} strokeWidth={2} strokeLinecap="round" />
    <circle cx={-0.6} cy={5.6} r={1.3} fill={OUTLINE} />
  </g>
);

/** 🌱 花匠：种子袋（纸袋+锯齿撕口+小花图）。 */
const seedPacket: ParticleRenderer = () => (
  <g>
    <rect x={-7} y={-5.5} width={14} height={14.5} rx={1.5} fill="#F3E3C0" stroke={OUTLINE} strokeWidth={2.2} />
    <path d="M-7 -5.5 l2.3 -2.6 2.3 2.6 2.4 -2.6 2.3 2.6 2.4 -2.6 2.2 2.6" fill="#F3E3C0" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <g fill="#F7B7D0" stroke={OUTLINE} strokeWidth={0.8}>
      <circle cx={0} cy={-0.2} r={1.7} />
      <circle cx={2.5} cy={2.2} r={1.7} />
      <circle cx={0} cy={4.6} r={1.7} />
      <circle cx={-2.5} cy={2.2} r={1.7} />
    </g>
    <circle cx={0} cy={2.2} r={1.7} fill="#FFD93B" stroke={OUTLINE} strokeWidth={0.8} />
  </g>
);

/** 🌿 花匠：破土幼苗（土堆+两片子叶）。 */
const seedling: ParticleRenderer = () => (
  <g>
    <path d="M-8 6 q8 -6 16 0 z" fill="#8B6A45" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
    <path d="M0 5 v-6" fill="none" stroke="#3B8F33" strokeWidth={2} strokeLinecap="round" />
    <path d="M0 -1 q-6 -2 -7 -6 q6 -1 7 5 z" fill="#8CD97B" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M0 -1 q6 -2 7 -6 q-6 -1 -7 5 z" fill="#8CD97B" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
  </g>
);

/** 🏷️ 花匠：植物标牌（木桩+白标签）。 */
const plantTag: ParticleRenderer = () => (
  <g transform="rotate(8)">
    <path d="M0 -1 v10" stroke="#C9A16B" strokeWidth={2.4} strokeLinecap="round" />
    <rect x={-7} y={-8} width={14} height={8} rx={1.5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.2} />
    <path d="M-4 -5 h8 M-4 -2.5 h5" stroke="#8CD97B" strokeWidth={1.4} strokeLinecap="round" />
  </g>
);

/** 🍧 雪球雪花冰小贩：刨冰甜筒（白纸筒+彩虹冰顶）。 */
const snowCone: ParticleRenderer = () => (
  <g>
    <path d="M-7 0 h14 l-7 11 z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
    <path d="M-2 1 l2 8 M3 1 l-1 5" fill="none" stroke="#C4D3DE" strokeWidth={1} strokeLinecap="round" />
    <path d="M-7.5 0.5 a7.5 7.5 0 0 1 15 0 z" fill="#FF9BC2" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
    <path d="M-6 -2.4 a7.5 7.5 0 0 1 12 0" fill="none" stroke="#7FD1FF" strokeWidth={2.4} strokeLinecap="round" />
    <path d="M-3.4 -4.6 a7.5 7.5 0 0 1 6.8 0" fill="none" stroke="#FFE06B" strokeWidth={2.4} strokeLinecap="round" />
  </g>
);

/** 🩸 雪球雪花冰小贩：糖浆挤滴（红色泪滴+高光；亦可用 drop("#E2432E")）。 */
const syrupSquirt: ParticleRenderer = () => (
  <g>
    <path d="M0 -7 q5 6 5 9 a5 5 0 0 1 -10 0 q0 -3 5 -9 z" fill="#E2432E" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <circle cx={-1.4} cy={2.6} r={1.4} fill="#FFC4B4" opacity={0.9} />
  </g>
);

/** 🥶 雪球雪花冰小贩：脑冻脸（淡蓝脸+咬牙表情）。 */
const brainFreeze: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={8} fill="#CFEFF6" stroke={OUTLINE} strokeWidth={2.2} />
    <path d="M-6 -3.5 l3 2 -3 2 M6 -3.5 l-3 2 3 2" fill="none" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <rect x={-4} y={2} width={8} height={4} rx={1} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={1.6} />
    <path d="M-1.4 2 v4 M1.4 2 v4 M-4 4 h8" stroke={OUTLINE} strokeWidth={0.9} />
  </g>
);

// ---- 27 件目录工具的产物粒子目录（AI 融合/一阶/legacy 都从这里取） ----

/** 一件工具「喷出什么」的规格：粒子=工具产物、固有色、从工具尖端喷出。
 *  emitter 为 legacy/兜底用的近似位；一阶在 BASE_WORK_FX 直接复用，
 *  AI 自定义物种在 getCustomWorkFx 用 chimera 锚点覆盖 emitter。 */
export const TOOL_FX: Record<string, WorkFxSpec> = {
  // —— 一阶 6 件（emitter 沿用既有实测值，一阶直接引用本表） ——
  laptop: { emitter: { x: 188, y: 198 }, baseAngle: -Math.PI / 3, cone: 0.5, shapes: [codeChip, bugBit, bsodBit] },
  torch: { emitter: { x: 202, y: 192 }, baseAngle: -Math.PI / 4.5, cone: 0.42, shapes: [bruleeCup, sugarShard, extinguisher] },
  keyboard: { emitter: { x: 166, y: 213 }, baseAngle: -Math.PI / 2, cone: 0.6, shapes: [keycap, ggBubble, rageKeycap] },
  mop: { emitter: { x: 188, y: 210 }, baseAngle: (-Math.PI * 2) / 3, cone: 0.55, shapes: [soapSuds, grimeClod, wetFloorSign] },
  sproutWand: { emitter: { x: 196, y: 178 }, baseAngle: -Math.PI / 2.6, cone: 0.55, shapes: [seedPacket, seedling, plantTag] },
  snowGlobe: { emitter: { x: 200, y: 198 }, baseAngle: -Math.PI / 2, cone: 0.8, shapes: [snowCone, syrupSquirt, brainFreeze] },
  // —— legacy 21 件（emitter 用近似值：这些物种仅兼容旧档/Steam，位置无需像素级） ——
  fountainPen: { emitter: { x: 196, y: 196 }, baseAngle: -Math.PI / 2.6, cone: 0.5, shapes: [drop("#2E3A6E"), signSwirl, inkDot] },
  wok: { emitter: { x: 200, y: 198 }, baseAngle: -Math.PI / 2.4, cone: 0.6, shapes: [flameSpark, cube("#8CD97B"), oilDrop] },
  mjolnir: { emitter: { x: 198, y: 186 }, baseAngle: -Math.PI / 2.4, cone: 0.55, shapes: [boltSpark, sparkle("#FFD93B"), boltSpark] },
  lifebuoy: { emitter: { x: 198, y: 198 }, baseAngle: -Math.PI / 2.6, cone: 0.6, shapes: [waterDrop, soapBubble, waterDrop] },
  cauldron: { emitter: { x: 196, y: 194 }, baseAngle: -Math.PI / 2, cone: 0.7, shapes: [potionBubble, drop("#8CD97B"), sparkle("#EAFBE4")] },
  iceScepter: { emitter: { x: 198, y: 182 }, baseAngle: -Math.PI / 2, cone: 0.7, shapes: [iceShard, snowflakeBit, sparkle("#DFF4FA")] },
  skewer: { emitter: { x: 198, y: 184 }, baseAngle: -Math.PI / 2.4, cone: 0.55, shapes: [emberStar, cube("#C77A44"), puff("#B7BBC7")] },
  printer: { emitter: { x: 196, y: 196 }, baseAngle: -Math.PI / 2.6, cone: 0.55, shapes: [paperSheet, inkDot, paperSheet] },
  waterCooler: { emitter: { x: 196, y: 194 }, baseAngle: -Math.PI / 2.4, cone: 0.55, shapes: [waterDrop, soapBubble, waterDrop] },
  wateringCan: { emitter: { x: 190, y: 194 }, baseAngle: (-Math.PI * 2) / 3, cone: 0.6, shapes: [waterDrop, leafBit, petalBit] },
  shavedIce: { emitter: { x: 196, y: 190 }, baseAngle: -Math.PI / 2, cone: 0.7, shapes: [iceShard, snowflakeBit, drop("#E2432E")] },
  laserPointer: { emitter: { x: 198, y: 186 }, baseAngle: -Math.PI / 3, cone: 0.5, shapes: [laserDot, slideBit, laserDot] },
  flatIron: { emitter: { x: 196, y: 194 }, baseAngle: -Math.PI / 2.4, cone: 0.6, shapes: [puff("#F7FCFD"), waterDrop, puff("#F7FCFD")] },
  emberLantern: { emitter: { x: 196, y: 188 }, baseAngle: -Math.PI / 2, cone: 0.65, shapes: [emberStar, lightMote, emberStar] },
  acRemote: { emitter: { x: 196, y: 194 }, baseAngle: -Math.PI / 2, cone: 0.75, shapes: [snowflakeBit, warmWave, snowflakeBit] },
  stormStaff: { emitter: { x: 198, y: 182 }, baseAngle: -Math.PI / 2, cone: 0.7, shapes: [boltSpark, puff("#8E93A6"), drop("#9BDCFF")] },
  headset: { emitter: { x: 202, y: 196 }, baseAngle: -Math.PI / 2.4, cone: 0.65, shapes: [soundWave, chatBubble, soundWave] },
  tabletPen: { emitter: { x: 198, y: 192 }, baseAngle: -Math.PI / 2.6, cone: 0.6, shapes: [sparkle("#7FD1FF"), colorDot, sparkle("#7FD1FF")] },
  pondNet: { emitter: { x: 200, y: 190 }, baseAngle: -Math.PI / 2.6, cone: 0.6, shapes: [waterDrop, fishBit, leafBit] },
  crystalBall: { emitter: { x: 196, y: 192 }, baseAngle: -Math.PI / 2, cone: 0.75, shapes: [sparkle("#FFE9AD"), mysticSwirl, sparkle("#FFE9AD")] },
  yarnBall: { emitter: { x: 196, y: 194 }, baseAngle: -Math.PI / 2.6, cone: 0.6, shapes: [yarnLoop, yarnClew, yarnLoop] },
};

// ---- 打工粒子目录（36 件 tangible/meme 造型；ref 引用的单一事实源） ----

/** AI 融合物种的 workFx 可用 `{ ref }` 引用本目录里的现成造型（无需自绘 nodes）。
 *  id 集合必须与 fusionParts.json 的 `workParticles` 键一致（Rust 侧同源写入，
 *  校验 ref 用）。每件 ~16px、原点居中、主形描边用 OUTLINE；文字类走 <rect>+<text>。
 *  主窗口与 fx 子窗口都从本文件导入本表，跨窗口渲染一致。 */
export const WORK_PARTICLE_CATALOG: Record<string, ParticleRenderer> = {
  // —— 食物/饮品 12 —— //
  "coffee-cup": () => (
    <g>
      <path d="M-6 -5 h11 v6 a5.5 5.5 0 0 1 -11 0 z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <ellipse cx={-0.5} cy={-5} rx={5.5} ry={1.8} fill="#6B4A2E" stroke={OUTLINE} strokeWidth={1.4} />
      <path d="M5 -3 a3.5 3.5 0 0 1 0 6" fill="none" stroke={OUTLINE} strokeWidth={2.2} />
      <path d="M-3 -8 q2 -2 0 -4 M1 -8 q2 -2 0 -4" fill="none" stroke="#C4D3DE" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  ),
  "coffee-bean": () => (
    <g transform="rotate(24)">
      <ellipse cx={0} cy={0} rx={5} ry={7} fill="#6B4A2E" stroke={OUTLINE} strokeWidth={2.2} />
      <path d="M0 -6 q-2.4 6 0 12" fill="none" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" />
    </g>
  ),
  "boba-pearl": () => (
    <g>
      <circle cx={0} cy={0} r={6} fill="#3E2C22" stroke={OUTLINE} strokeWidth={2.2} />
      <circle cx={-2} cy={-2.2} r={1.6} fill="#8B6A45" opacity={0.9} />
    </g>
  ),
  "tea-cup": () => (
    <g>
      <path d="M-8 6 q8 3 16 0" fill="none" stroke={OUTLINE} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M-6 -3 h12 l-1.5 6 q-4.5 3 -9 0 z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <ellipse cx={0} cy={-3} rx={6} ry={1.8} fill="#8CC96B" stroke={OUTLINE} strokeWidth={1.4} />
      <path d="M6 -1 a3 3 0 0 1 0 5" fill="none" stroke={OUTLINE} strokeWidth={2} />
    </g>
  ),
  toast: () => (
    <g>
      <path d="M-7 -2 q0 -7 7 -7 q7 0 7 7 v7 a2 2 0 0 1 -2 2 h-10 a2 2 0 0 1 -2 -2 z" fill="#F0C066" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <rect x={-3} y={-3} width={6} height={4} rx={1} fill="#FFE06B" stroke={OUTLINE} strokeWidth={1.4} transform="rotate(-6)" />
    </g>
  ),
  "rice-ball": () => (
    <g>
      <path d="M0 -8 q7 3 6 12 q-6 3 -12 0 q-1 -9 6 -12 z" fill="#FBFBF5" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <rect x={-6} y={3} width={12} height={6} rx={1} fill="#2E4A38" stroke={OUTLINE} strokeWidth={2} />
    </g>
  ),
  "ramen-egg": () => (
    <g>
      <ellipse cx={0} cy={0} rx={8} ry={7} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.2} />
      <circle cx={0} cy={0} r={3.6} fill="#F5A83B" stroke={OUTLINE} strokeWidth={1.8} />
    </g>
  ),
  cherry: () => (
    <g>
      <path d="M-3 3 q1 -8 5 -10 M3 4 q1 -7 2 -11" fill="none" stroke="#3B8F33" strokeWidth={1.8} strokeLinecap="round" />
      <circle cx={-4} cy={4} r={4} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.2} />
      <circle cx={4} cy={5} r={4} fill="#C23B1F" stroke={OUTLINE} strokeWidth={2.2} />
      <circle cx={-5} cy={2.6} r={1.1} fill="#FFC4B4" />
    </g>
  ),
  "honey-drop": drop("#F0B84A"),
  "corn-cob": () => (
    <g transform="rotate(20)">
      <ellipse cx={0} cy={0} rx={4.5} ry={8} fill="#FFE06B" stroke={OUTLINE} strokeWidth={2.2} />
      <path d="M-4 -4 h8 M-4.3 0 h8.6 M-4 4 h8 M-1.5 -7 v14 M1.5 -7 v14" fill="none" stroke="#E0A046" strokeWidth={1} />
      <path d="M-4 6 q-4 4 -2 8 q4 -2 4 -6 z" fill="#8CD97B" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
    </g>
  ),
  donut: () => (
    <g>
      <circle cx={0} cy={0} r={8} fill="#C77A44" stroke={OUTLINE} strokeWidth={2.2} />
      <circle cx={0} cy={0} r={7} fill="none" stroke="#F7B7D0" strokeWidth={3.5} />
      <circle cx={0} cy={0} r={3} fill="#FBE9C8" stroke={OUTLINE} strokeWidth={2} />
      <circle cx={-4} cy={-3} r={0.9} fill="#57B84C" />
      <circle cx={3} cy={-4} r={0.9} fill="#2E7BD6" />
      <circle cx={4} cy={2} r={0.9} fill="#FFE06B" />
      <circle cx={-3} cy={4} r={0.9} fill="#E2432E" />
    </g>
  ),
  "lemon-wedge": () => (
    <g transform="rotate(-20)">
      <path d="M-8 5 a9 9 0 0 1 16 0 z" fill="#FFE06B" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M-8 5 a9 9 0 0 1 16 0" fill="none" stroke="#E0A046" strokeWidth={2.4} />
      <path d="M0 5 L-4 -1 M0 5 L0 -3 M0 5 L4 -1" fill="none" stroke="#E0A046" strokeWidth={1.2} strokeLinecap="round" />
    </g>
  ),
  // —— 工具/物件 12 —— //
  gear: () => (
    <g>
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} x={-2} y={-9} width={4} height={5} rx={1} fill="#8E93A6" stroke={OUTLINE} strokeWidth={1.6} transform={`rotate(${i * 45})`} />
      ))}
      <circle cx={0} cy={0} r={6} fill="#B7BBC7" stroke={OUTLINE} strokeWidth={2.2} />
      <circle cx={0} cy={0} r={2.4} fill="#6E7383" stroke={OUTLINE} strokeWidth={1.8} />
    </g>
  ),
  wrench: () => (
    <g transform="rotate(-40)">
      <rect x={-2} y={-3} width={4} height={12} rx={2} fill="#8E93A6" stroke={OUTLINE} strokeWidth={2.2} />
      <path d="M-4 -8 a5 5 0 1 0 8 0 l-2 3 a2.5 2.5 0 1 1 -4 0 z" fill="#B7BBC7" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
    </g>
  ),
  "screw-nut": () => (
    <g>
      <polygon points="0,-8 7,-4 7,4 0,8 -7,4 -7,-4" fill="#B7BBC7" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={0} cy={0} r={3.2} fill="#6E7383" stroke={OUTLINE} strokeWidth={1.8} />
    </g>
  ),
  "paint-roller": () => (
    <g transform="rotate(12)">
      <rect x={-8} y={-8} width={16} height={7} rx={2.5} fill="#7FD1FF" stroke={OUTLINE} strokeWidth={2.2} />
      <path d="M0 -4.5 v4 h4" fill="none" stroke={OUTLINE} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <rect x={2.5} y={-0.5} width={3.5} height={10} rx={1.7} fill="#C9A16B" stroke={OUTLINE} strokeWidth={2} />
      <path d="M-6 -1 v4" stroke="#7FD1FF" strokeWidth={2} strokeLinecap="round" />
    </g>
  ),
  trowel: () => (
    <g transform="rotate(-20)">
      <path d="M0 9 q-6 -2 -6 -8 q0 -3 6 -3 q6 0 6 3 q0 6 -6 8 z" fill="#B7BBC7" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M0 -2 v-4" stroke={OUTLINE} strokeWidth={2} strokeLinecap="round" />
      <rect x={-2.5} y={-11} width={5} height={6} rx={2} fill="#C9A16B" stroke={OUTLINE} strokeWidth={2} />
    </g>
  ),
  sponge: () => (
    <g>
      <rect x={-8} y={-6} width={16} height={12} rx={2.5} fill="#FFE06B" stroke={OUTLINE} strokeWidth={2.2} />
      <path d="M-8 -2 q8 -3 16 0 v-2 a2 2 0 0 0 -2 -2 h-12 a2 2 0 0 0 -2 2 z" fill="#57B84C" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
      <circle cx={-3} cy={3} r={1} fill="#E0A046" />
      <circle cx={2} cy={1.5} r={1} fill="#E0A046" />
      <circle cx={4.5} cy={4} r={0.9} fill="#E0A046" />
    </g>
  ),
  envelope: () => (
    <g>
      <rect x={-8} y={-6} width={16} height={12} rx={1.5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.2} />
      <path d="M-8 -5 L0 1 L8 -5" fill="none" stroke={OUTLINE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  "parcel-box": () => (
    <g>
      <rect x={-8} y={-6} width={16} height={13} rx={1.5} fill="#C9A16B" stroke={OUTLINE} strokeWidth={2.2} />
      <path d="M0 -6 v13 M-8 -1 h16" stroke={OUTLINE} strokeWidth={1.8} />
      <path d="M-8 -1 q8 3 16 0" fill="none" stroke="#8B6A45" strokeWidth={1.4} />
    </g>
  ),
  "potion-vial": () => (
    <g>
      <rect x={-2.5} y={-9} width={5} height={3} rx={1} fill="#C9A16B" stroke={OUTLINE} strokeWidth={1.8} />
      <rect x={-2} y={-6.2} width={4} height={3.2} fill="#EAF7FF" stroke={OUTLINE} strokeWidth={2} />
      <path d="M-2 -3 q-5 2 -5 6 a5.5 5.5 0 0 0 11 0 q0 -4 -5 -6 z" fill="#B084F0" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={-2} cy={6} r={1.3} fill="#EAF7FF" opacity={0.85} />
    </g>
  ),
  "light-bulb": () => (
    <g>
      <circle cx={0} cy={-2} r={6.5} fill="#FFE9AD" stroke={OUTLINE} strokeWidth={2.2} />
      <rect x={-3} y={3.5} width={6} height={4} rx={1} fill="#B7BBC7" stroke={OUTLINE} strokeWidth={2} />
      <path d="M-2.5 5.5 h5 M-2 7.5 h4" stroke={OUTLINE} strokeWidth={1.1} />
      <path d="M-2 -1 l2 -2 2 2" fill="none" stroke={OUTLINE} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-3.5 -5 a4 4 0 0 1 3 -2" fill="none" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" />
    </g>
  ),
  "color-swatch": () => (
    <g>
      <rect x={-7} y={-5} width={9} height={12} rx={1.5} fill="#E2432E" stroke={OUTLINE} strokeWidth={2} transform="rotate(-10)" />
      <rect x={-3} y={-6} width={9} height={12} rx={1.5} fill="#2E7BD6" stroke={OUTLINE} strokeWidth={2} transform="rotate(4)" />
      <rect x={1} y={-4} width={9} height={12} rx={1.5} fill="#FFD93B" stroke={OUTLINE} strokeWidth={2} transform="rotate(16)" />
    </g>
  ),
  "music-note": () => (
    <g>
      <path d="M4 -8 v11" fill="none" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M4 -8 q5 0 5 4 q-5 -1 -5 1 z" fill="#B084F0" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
      <ellipse cx={0.5} cy={3.5} rx={4.5} ry={3.5} fill="#B084F0" stroke={OUTLINE} strokeWidth={2.2} transform="rotate(-18 0.5 3.5)" />
    </g>
  ),
  // —— 自然 6 —— //
  "seed-packet": seedPacket,
  pinecone: () => (
    <g>
      <path d="M0 -8 q6 3 5 9 q-5 4 -10 0 q-1 -6 5 -9 z" fill="#8B6A45" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M-4 -4 q4 2 8 0 M-5 -0.5 q5 2.5 9 0 M-4 3 q4 2 7 0" fill="none" stroke="#5E4630" strokeWidth={1.3} strokeLinecap="round" />
      <path d="M0 -8 v14" stroke="#5E4630" strokeWidth={1} opacity={0.5} />
    </g>
  ),
  mushroom: () => (
    <g>
      <path d="M-3 1 q0 6 0 7 q3 2 6 0 q0 -1 0 -7 z" fill="#FBE9C8" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M-8 1 a8 6 0 0 1 16 0 z" fill="#E2432E" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={-3} cy={-2} r={1.4} fill="#FFF6CE" />
      <circle cx={3} cy={-1.5} r={1.2} fill="#FFF6CE" />
      <circle cx={0} cy={-3.5} r={1} fill="#FFF6CE" />
    </g>
  ),
  petal: petalBit,
  clover: () => (
    <g>
      <g fill="#57B84C" stroke={OUTLINE} strokeWidth={2}>
        <ellipse cx={0} cy={-5} rx={3.2} ry={4} />
        <ellipse cx={-4.5} cy={2} rx={3.2} ry={4} transform="rotate(-120 -4.5 2)" />
        <ellipse cx={4.5} cy={2} rx={3.2} ry={4} transform="rotate(120 4.5 2)" />
      </g>
      <path d="M0 1 q1 5 3 8" fill="none" stroke="#3B8F33" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  ),
  confetti: (rand) => {
    const cols = ["#E2432E", "#FFD93B", "#57B84C", "#2E7BD6", "#F7B7D0"];
    const pick = (i: number) => cols[(Math.floor(rand() * cols.length) + i) % cols.length];
    return (
      <g>
        <rect x={-7} y={-6} width={4} height={4} rx={0.8} fill={pick(0)} stroke={OUTLINE} strokeWidth={1.4} transform="rotate(20)" />
        <rect x={3} y={-7} width={4} height={4} rx={0.8} fill={pick(1)} stroke={OUTLINE} strokeWidth={1.4} transform="rotate(-15)" />
        <circle cx={-3} cy={5} r={2} fill={pick(2)} stroke={OUTLINE} strokeWidth={1.4} />
        <rect x={2} y={3} width={4} height={4} rx={0.8} fill={pick(3)} stroke={OUTLINE} strokeWidth={1.4} transform="rotate(35)" />
        <path d="M-6 0 l2 2" stroke={pick(4)} strokeWidth={2} strokeLinecap="round" />
      </g>
    );
  },
  // —— 梗/文字 6 —— //
  "code-glyph": codeChip,
  bug: bugBit,
  "game-over": () => (
    <g>
      <rect x={-11} y={-9} width={22} height={18} rx={3} fill="#1B1B22" stroke={OUTLINE} strokeWidth={2.4} />
      <text x={0} y={-1} fontSize={7.5} fontWeight={900} textAnchor="middle" fill="#E2432E" fontFamily="ui-monospace, monospace">
        GAME
      </text>
      <text x={0} y={7} fontSize={7.5} fontWeight={900} textAnchor="middle" fill="#E2432E" fontFamily="ui-monospace, monospace">
        OVER
      </text>
    </g>
  ),
  "strike-text": () => (
    <g>
      <rect x={-13} y={-7} width={26} height={14} rx={3} fill="#3E4356" stroke={OUTLINE} strokeWidth={2.2} />
      <text x={0} y={3.5} fontSize={8.5} fontWeight={900} textAnchor="middle" fill="#9BA0B0" fontFamily="ui-monospace, monospace">
        TODO
      </text>
      <line x1={-9} y1={0} x2={9} y2={0} stroke="#E2432E" strokeWidth={2} strokeLinecap="round" />
    </g>
  ),
  "hundred-tag": () => (
    <g>
      <rect x={-12} y={-8} width={24} height={16} rx={3} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.2} />
      <text x={0} y={1.5} fontSize={9.5} fontWeight={900} textAnchor="middle" fill="#E2432E" fontFamily="ui-monospace, monospace">
        100
      </text>
      <path d="M-8 5 h16 M-8 7 h16" stroke="#E2432E" strokeWidth={1.5} strokeLinecap="round" />
    </g>
  ),
  "check-tag": () => (
    <g>
      <rect x={-9} y={-9} width={18} height={18} rx={5} fill="#57B84C" stroke={OUTLINE} strokeWidth={2.4} />
      <path d="M-4.5 0 l3 4 6 -7" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
};

// ---- 六个一阶角色的粒子规格（直接引用工具产物目录，单一事实源） ----

// 一阶物种的粒子 = 各自工具的产物，直接引用 TOOL_FX（含实测 emitter）。
const BASE_WORK_FX: Record<string, WorkFxSpec> = {
  guluduck: TOOL_FX.laptop, // 💼 笔记本电脑 → 代码符号
  emberfox: TOOL_FX.torch, // 🔥 料理喷枪 → 火星
  voltmouse: TOOL_FX.keyboard, // ⌨️ 机械键盘 → 键帽 + 电花
  bubblefrog: TOOL_FX.mop, // 🧹 拖把 → 水珠泡泡
  sproutcap: TOOL_FX.sproutWand, // 🌱 嫩芽魔杖 → 叶片星光
  frostpeng: TOOL_FX.snowGlobe, // ❄️ 水晶雪球 → 雪花冰晶
};

import { WORK_FX2 } from "../species2";

/** 完整粒子注册表：一阶六只 + 融合 2.0 新物种（fx 全屏窗口查同一张表）。 */
export const WORK_FX: Record<string, WorkFxSpec> = { ...BASE_WORK_FX, ...WORK_FX2 };

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
  /** 自定义物种粒子（fx 子窗口没有物种注册表，由事件负载直接携带）。 */
  customFx?: ResolvedWorkFx | null;
  /** 手中工具 id（目录工具）：粒子=该工具产物；legacy 与 AI 兜底走此路。 */
  toolId?: string | null;
};

/** 统一解析一次爆发用的 WorkFxSpec —— 这就是"粒子=工具产物"规则的代码化。
 *  查找顺序：
 *  ① WORK_FX[species]：手作融合 57 + 一阶 6（各自 bespoke / 工具产物）。
 *  ② AI 自定义物种：优先 AI 自绘粒子（保多样性），缺失退该物种 toolId 的工具
 *     产物；emitter 用 chimera 锚点（随 customFx 携带）。
 *  ③ 目录 toolId 直查 TOOL_FX：legacy 21 只及任何带目录工具的物种在此兜住。
 *  App/FxOverlay/WorkBurst 三处共用本函数，保证发射点与形状一致。 */
export function resolveWorkFx(
  species: string,
  toolId?: string | null,
  customFx?: ResolvedWorkFx | null,
): WorkFxSpec | null {
  const known = WORK_FX[species];
  if (known) return known;

  const fx = customFx ?? getCustomWorkFx(species);
  if (fx) {
    const tool = toolId ? TOOL_FX[toolId] : null;
    // 粒子是纯数据的联合：`{ ref }` 引用目录造型、`{ nodes }` 自绘；未知 ref 丢弃。
    const mapped: ParticleRenderer[] = fx.particles
      .map((p): ParticleRenderer | null => {
        if ("ref" in p) return WORK_PARTICLE_CATALOG[p.ref] ?? null;
        return () => renderWorkFxParticle(p.nodes, fx.palette);
      })
      .filter((r): r is ParticleRenderer => r != null);
    const shapes = fx.particles.length > 0 ? mapped : tool?.shapes;
    if (shapes && shapes.length > 0) {
      return { emitter: fx.emitter, baseAngle: tool?.baseAngle ?? -Math.PI / 2.2, cone: tool?.cone ?? 0.75, shapes };
    }
  }

  if (toolId && TOOL_FX[toolId]) return TOOL_FX[toolId];
  return null;
}

export function WorkBurst({ species, tier, seed, boom = false, screen = false, customFx, toolId }: WorkBurstProps) {
  const spec = resolveWorkFx(species, toolId, customFx);
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
