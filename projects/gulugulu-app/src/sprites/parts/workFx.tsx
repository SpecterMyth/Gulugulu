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

// ---- 27 件目录工具的产物粒子目录（AI 融合/一阶/legacy 都从这里取） ----

/** 一件工具「喷出什么」的规格：粒子=工具产物、固有色、从工具尖端喷出。
 *  emitter 为 legacy/兜底用的近似位；一阶在 BASE_WORK_FX 直接复用，
 *  AI 自定义物种在 getCustomWorkFx 用 chimera 锚点覆盖 emitter。 */
export const TOOL_FX: Record<string, WorkFxSpec> = {
  // —— 一阶 6 件（emitter 沿用既有实测值，一阶直接引用本表） ——
  laptop: { emitter: { x: 188, y: 198 }, baseAngle: -Math.PI / 3, cone: 0.5, shapes: [codeChip, cursorBlink, codeChip] },
  torch: { emitter: { x: 202, y: 192 }, baseAngle: -Math.PI / 4.5, cone: 0.42, shapes: [flameSpark, emberStar, flameSpark] },
  keyboard: { emitter: { x: 166, y: 213 }, baseAngle: -Math.PI / 2, cone: 0.6, shapes: [keycap, boltSpark, keycap] },
  mop: { emitter: { x: 188, y: 210 }, baseAngle: (-Math.PI * 2) / 3, cone: 0.55, shapes: [waterDrop, soapBubble, waterDrop] },
  sproutWand: { emitter: { x: 196, y: 178 }, baseAngle: -Math.PI / 2.6, cone: 0.55, shapes: [leafBit, sproutStar, leafBit] },
  snowGlobe: { emitter: { x: 200, y: 198 }, baseAngle: -Math.PI / 2, cone: 0.8, shapes: [snowflakeBit, iceShard, snowflakeBit] },
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
    const shapes =
      fx.particles.length > 0
        ? fx.particles.map((nodes) => () => renderWorkFxParticle(nodes, fx.palette))
        : tool?.shapes;
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
