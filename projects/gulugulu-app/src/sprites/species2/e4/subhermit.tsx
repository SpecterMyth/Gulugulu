// ---------------------------------------------------------------------------
// 潜艇蟹 subhermit — e4（electric+ice+normal+water）· 甲壳
// 剪影：寄居蟹背着黄色小潜水艇当壳（舷窗+螺旋桨+潜望镜，招牌），
//       前伸大螯，声呐圈（e4 环绕件 aura）。深海快递潜航员。
// 睡姿（P3）：缩进潜艇壳，舷窗透出小灯。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const CRAB = "#F0A868";
const CRAB_DEEP = "#D18248";
const CREAM = "#FFE8D6";
const SUB = "#FFD93B";
const SUB_DEEP = "#E39B00";
const SEA = "#8FD8E8";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e4 环绕件：声呐圈（part-aura 脉动，自潜望镜发出） */}
      <g transform={place(170, 96)}>
        <g className="part-aura">
          <g fill="none" stroke={SEA} strokeWidth={2.6} strokeLinecap="round">
            <path d="M8 -4 a10 10 0 0 1 0 12" />
            <path d="M13 -8 a17 17 0 0 1 0 20" />
            <path d="M18 -12 a24 24 0 0 1 0 28" />
          </g>
        </g>
      </g>
      {/* 潜水艇壳（背在身后上方：艇身+舷窗+螺旋桨+潜望镜） */}
      <g transform={place(140, 148, -8)}>
        <ellipse cx={0} cy={0} rx={52} ry={30} fill={SUB} stroke={OUTLINE} strokeWidth={5.5} />
        <path d="M-52 -2 Q-58 -2 -60 4 L-52 8 Z" fill={SUB_DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        {/* 螺旋桨（part-orbit 慢转） */}
        <g transform="translate(54 2)">
          <g className="part-orbit">
            <path d="M0 -9 Q4 -4 0 0 Q-4 4 0 9 Q4 4 0 0 Q-4 -4 0 -9 Z" fill={SEA} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
          </g>
          <circle r={2.4} fill={SUB_DEEP} stroke={OUTLINE} strokeWidth={1.8} />
        </g>
        {/* 舷窗两枚 */}
        <g stroke={OUTLINE} strokeWidth={3}>
          <circle cx={-18} cy={-4} r={8} fill={SEA} />
          <circle cx={8} cy={-6} r={6.5} fill={SEA} />
        </g>
        <path d="M-21 -7 l4 -2 M5 -9 l4 -2" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
        {/* 潜望镜 */}
        <path d="M22 -28 L22 -44 Q22 -50 28 -50 L34 -50" fill="none" stroke={SUB_DEEP} strokeWidth={6} strokeLinecap="round" />
        <circle cx={36} cy={-50} r={4} fill={SEA} stroke={OUTLINE} strokeWidth={2.6} />
        <path d="M18 -28 h8" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
      </g>
      {/* 尾：壳后拖的小锚链（左下） */}
      <g transform={place(84, 206, -10)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 Q-10 4 -14 12" fill="none" stroke={CRAB_DEEP} strokeWidth={3.4} strokeLinecap="round" strokeDasharray="5 4" />
          <path d="M-16 14 v6 M-19 17 h6" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
        </Part>
      </g>
      {/* 蟹身（横宽椭圆，低趴在艇下） */}
      <ellipse cx={118} cy={196} rx={46} ry={28} fill={CRAB} stroke={OUTLINE} strokeWidth={6} />
      <path d="M84 200 Q118 212 152 200 Q146 216 118 218 Q90 216 84 200 Z" fill={CREAM} opacity={0.95} />
      {/* 大螯（招牌：左右前伸的钳子） */}
      <g transform={place(72, 196, 18)}>
        <Part name="armL" origin="80% 20%">
          <path d="M0 0 Q-18 -2 -24 -14 Q-26 -20 -20 -22 Q-14 -14 -8 -12 L-12 -20 Q-8 -24 -4 -20 Q2 -12 2 -4 Q2 0 0 0 Z" fill={CRAB_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(164, 196, -18)}>
        <Part name="armR" origin="20% 20%">
          <path d="M0 0 Q18 -2 24 -14 Q26 -20 20 -22 Q14 -14 8 -12 L12 -20 Q8 -24 4 -20 Q-2 -12 -2 -4 Q-2 0 0 0 Z" fill={CRAB_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 蟹腿（两对细腿） */}
      <g stroke={CRAB_DEEP} strokeWidth={4.5} strokeLinecap="round">
        <path d="M88 214 q-8 6 -10 12" />
        <path d="M148 214 q8 6 10 12" />
      </g>
      <g transform={place(102, 229)}>
        <Part name="legL" origin="50% -60%">
          <path d="M0 -8 q-4 5 -9 8" fill="none" stroke={CRAB_DEEP} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(134, 229)}>
        <Part name="legR" origin="50% -60%">
          <path d="M0 -8 q4 5 9 8" fill="none" stroke={CRAB_DEEP} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 眼柱（蟹签名：两根立起的眼柱） */}
      <g fill={CRAB} stroke={OUTLINE} strokeWidth={4}>
        <path d="M102 176 Q100 162 104 156 L112 158 Q110 166 110 176 Z" />
        <path d="M134 176 Q136 162 132 156 L124 158 Q126 166 126 176 Z" />
      </g>
      {/* 脸（眼在柱顶） */}
      <g className="part-face">
        <ExpFace cx1={107} cx2={129} cy={156} r={7.5} mouthY={192} mouthW={10} expression={expression} base={eyes} />
        <Blush cx1={96} cx2={140} cy={184} />
      </g>
      {/* 头顶：小气泡呆饰（headtop 呼吸摇） */}
      <g transform={place(118, 150)}>
        <Part name="headtop" origin="50% 100%">
          <circle cx={0} cy={-6} r={4} fill="#EAF7FF" opacity={0.8} stroke={SEA} strokeWidth={2.2} />
          <circle cx={5} cy={-13} r={2.6} fill="#EAF7FF" opacity={0.8} stroke={SEA} strokeWidth={2} />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(196, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：横着快步走（蟹步照样往前），潜艇壳朝后，眼柱朝前，大螯开路。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 声呐圈（潜望镜朝前发） */}
      <g transform={place(134, 88)}>
        <g className="part-aura">
          <g fill="none" stroke={SEA} strokeWidth={2.6} strokeLinecap="round">
            <path d="M8 -4 a10 10 0 0 1 0 12" />
            <path d="M13 -8 a17 17 0 0 1 0 20" />
          </g>
        </g>
      </g>
      {/* 潜水艇壳（背上，艇头朝前） */}
      <g transform={place(122, 148, -6)}>
        <ellipse cx={0} cy={0} rx={50} ry={29} fill={SUB} stroke={OUTLINE} strokeWidth={5.5} />
        <path d="M50 -2 Q56 -2 58 4 L50 8 Z" fill={SUB_DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        {/* 螺旋桨（艇尾=左） */}
        <g transform="translate(-52 2)">
          <g className="part-orbit">
            <path d="M0 -9 Q4 -4 0 0 Q-4 4 0 9 Q4 4 0 0 Q-4 -4 0 -9 Z" fill={SEA} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
          </g>
          <circle r={2.4} fill={SUB_DEEP} stroke={OUTLINE} strokeWidth={1.8} />
        </g>
        <g stroke={OUTLINE} strokeWidth={3}>
          <circle cx={16} cy={-4} r={8} fill={SEA} />
          <circle cx={-10} cy={-6} r={6.5} fill={SEA} />
        </g>
        <path d="M13 -7 l4 -2 M-13 -9 l4 -2" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
        {/* 潜望镜（朝前看路） */}
        <path d="M4 -27 L4 -44 Q4 -50 10 -50 L16 -50" fill="none" stroke={SUB_DEEP} strokeWidth={6} strokeLinecap="round" />
        <circle cx={18} cy={-50} r={4} fill={SEA} stroke={OUTLINE} strokeWidth={2.6} />
      </g>
      {/* 尾：锚链（身后拖） */}
      <g transform={place(72, 202, -6)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 Q-10 4 -14 12" fill="none" stroke={CRAB_DEEP} strokeWidth={3.4} strokeLinecap="round" strokeDasharray="5 4" />
          <path d="M-16 14 v6 M-19 17 h6" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
        </Part>
      </g>
      {/* 蟹身（低趴） */}
      <ellipse cx={122} cy={198} rx={44} ry={26} fill={CRAB} stroke={OUTLINE} strokeWidth={6} />
      <path d="M90 202 Q122 212 154 202 Q148 216 122 218 Q96 216 90 202 Z" fill={CREAM} opacity={0.95} />
      {/* 大螯（一前一后开路） */}
      <g transform={place(158, 192, -12)}>
        <Part name="armR" origin="20% 20%">
          <path d="M0 0 Q18 -2 24 -14 Q26 -20 20 -22 Q14 -14 8 -12 L12 -20 Q8 -24 4 -20 Q-2 -12 -2 -4 Q-2 0 0 0 Z" fill={CRAB_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(86, 196, 14)}>
        <Part name="armL" origin="80% 20%">
          <path d="M0 0 Q-16 -2 -21 -12 Q-23 -17 -18 -19 Q-13 -12 -8 -10 Q-2 -8 -2 -3 Q-2 0 0 0 Z" fill="#B96F3E" stroke={OUTLINE} strokeWidth={3.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 蟹腿（碎步） */}
      <g stroke={CRAB_DEEP} strokeWidth={4.5} strokeLinecap="round">
        <path d="M94 216 q-8 6 -10 12" />
      </g>
      <g transform={place(112, 229)}>
        <Part name="legL" origin="50% -60%">
          <path d="M0 -8 q-4 5 -9 8" fill="none" stroke={CRAB_DEEP} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(140, 229)}>
        <Part name="legR" origin="50% -60%">
          <path d="M0 -8 q4 5 9 8" fill="none" stroke={CRAB_DEEP} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 眼柱（朝前斜探） */}
      <g fill={CRAB} stroke={OUTLINE} strokeWidth={4}>
        <path d="M134 180 Q136 164 142 158 L150 162 Q146 170 144 180 Z" />
        <path d="M116 178 Q116 164 120 158 L128 160 Q126 168 126 178 Z" />
      </g>
      {/* 脸（柱顶单眼朝前） */}
      <g className="part-face">
        <ExpSideFace cx={146} cy={160} r={7.5} expression={expression} base={eyes} withMouth={false} />
        <circle cx={124} cy={160} r={5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.6} />
        <path d="M150 190 q6 4 12 -1" fill="none" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
        <ellipse cx={136} cy={186} rx={6.5} ry={4.5} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 头顶：小气泡（前飘） */}
      <g transform={place(140, 150)}>
        <Part name="headtop" origin="50% 100%">
          <circle cx={2} cy={-6} r={4} fill="#EAF7FF" opacity={0.8} stroke={SEA} strokeWidth={2.2} />
          <circle cx={8} cy={-13} r={2.6} fill="#EAF7FF" opacity={0.8} stroke={SEA} strokeWidth={2} />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：缩进潜艇壳里，舷窗透出暖灯，只剩大螯和眼柱尖从舱口露出。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 潜艇壳（落地当床，舱口朝左下） */}
      <g transform={place(132, 186, -4)}>
        <ellipse cx={0} cy={0} rx={56} ry={34} fill={SUB} stroke={OUTLINE} strokeWidth={5.5} />
        <path d="M-56 -2 Q-62 -2 -64 4 L-56 8 Z" fill={SUB_DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        {/* 螺旋桨（静止） */}
        <g transform="translate(58 2)">
          <path d="M0 -9 Q4 -4 0 0 Q-4 4 0 9 Q4 4 0 0 Q-4 -4 0 -9 Z" fill={SEA} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
          <circle r={2.4} fill={SUB_DEEP} stroke={OUTLINE} strokeWidth={1.8} />
        </g>
        {/* 舷窗透暖灯（睡灯） */}
        <g stroke={OUTLINE} strokeWidth={3}>
          <circle cx={-16} cy={-4} r={9} fill="#FFF6CE" />
          <circle cx={12} cy={-6} r={7} fill="#FFF6CE" />
        </g>
        <circle cx={-16} cy={-4} r={14} fill="#FFF6CE" opacity={0.3} />
        <path d="M-19 -7 l4 -2 M9 -9 l4 -2" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
        {/* 潜望镜（收平） */}
        <path d="M28 -30 Q36 -34 42 -30" fill="none" stroke={SUB_DEEP} strokeWidth={5.5} strokeLinecap="round" />
      </g>
      {/* 尾：锚链（垂地固定，睡得安稳） */}
      <g transform={place(190, 218)}>
        <Part name="tail" origin="0% 0%">
          <path d="M0 0 Q8 4 10 12" fill="none" stroke={CRAB_DEEP} strokeWidth={3.4} strokeLinecap="round" strokeDasharray="5 4" />
          <path d="M12 16 v6 M9 19 h6" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
        </Part>
      </g>
      {/* 舱口探出的大螯（一对搭在地上） */}
      <g transform={place(76, 214, 8)}>
        <Part name="armL" origin="80% 20%">
          <path d="M0 0 Q-16 -1 -22 -10 Q-24 -15 -19 -17 Q-13 -11 -8 -9 L-11 -16 Q-7 -19 -4 -16 Q1 -9 1 -3 Q1 0 0 0 Z" fill={CRAB_DEEP} stroke={OUTLINE} strokeWidth={3.8} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(96, 222, -6)}>
        <Part name="armR" origin="20% 20%">
          <path d="M0 0 Q14 -1 19 -9 Q21 -14 16 -16 Q11 -10 6 -8 Q0 -6 0 -2 Z" fill={CRAB_DEEP} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 眼柱尖（从舱口露出，闭眼） */}
      <g fill={CRAB} stroke={OUTLINE} strokeWidth={3.8}>
        <path d="M84 206 Q82 194 86 188 L94 190 Q92 198 92 206 Z" />
        <path d="M106 210 Q106 198 110 192 L118 194 Q116 202 114 210 Z" />
      </g>
      {/* 脸（柱顶闭眼） */}
      <g className="part-face">
        <ExpFace cx1={89} cx2={113} cy={190} r={6.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={82} cx2={120} cy={204} />
      </g>
      {/* 蟹腿尖（壳沿下微露） */}
      <g transform={place(122, 226)}>
        <Part name="legL" origin="50% -60%">
          <path d="M0 -6 q-4 4 -8 6" fill="none" stroke={CRAB_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(146, 228)}>
        <Part name="legR" origin="50% -60%">
          <path d="M0 -6 q4 4 8 6" fill="none" stroke={CRAB_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 头顶：梦气泡（从舱口冒出） */}
      <g transform={place(96, 178)}>
        <Part name="headtop" origin="50% 100%">
          <circle cx={0} cy={-6} r={4} fill="#EAF7FF" opacity={0.8} stroke={SEA} strokeWidth={2.2} />
          <circle cx={6} cy={-14} r={2.6} fill="#EAF7FF" opacity={0.8} stroke={SEA} strokeWidth={2} />
        </Part>
      </g>
    </Part>
  );
}

function Rig(props: RigProps) {
  if (props.view === "side") return <Side {...props} />;
  if (props.pose === "lie") return <Lie {...props} />;
  return <Front {...props} />;
}

// 潜望镜：L 形镜筒 + 镜头
const periscope: ParticleRenderer = () => (
  <g fill={SUB} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round">
    <path d="M-3 9 L-3 -6 Q-3 -9 0 -9 L8 -9 L8 -4 L3 -4 L3 9 Z" />
    <rect x={6} y={-9.5} width={5} height={5} rx={1.2} fill={SUB_DEEP} />
    <path d="M-3 4 h6" stroke={OUTLINE} strokeWidth={1.4} opacity={0.6} />
  </g>
);
// 声呐扫掠弧（沿用既有雷达扫掠）
const sonarPing: ParticleRenderer = () => (
  <g fill="none" stroke={SEA} strokeWidth={2.2} strokeLinecap="round">
    <path d="M-2 -5 a7 7 0 0 1 0 10 M2 -8 a12 12 0 0 1 0 16" />
  </g>
);
// 鱼雷：带尾翼的鱼雷
const torpedo: ParticleRenderer = () => (
  <g transform="rotate(-12)">
    <path d="M-9 0 L-6 -3.5 L7 -3.5 Q11 -3.5 11 0 Q11 3.5 7 3.5 L-6 3.5 Z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M-9 0 L-6 -3.5 M-9 0 L-6 3.5 M-6 -3.5 L-6 3.5" fill="none" stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round" />
    <circle cx={5} cy={0} r={1.6} fill={SUB_DEEP} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.12,
    palette: { body: CRAB, deep: CRAB_DEEP, belly: CREAM, accent: SUB, accent2: SEA },
    foodAnchor: { x: 118, y: 192 },
    shadowRx: 60,
  },
  // 潜望镜：手持潜望筒 + 目镜 + 反光
  tool: () => (
    <g>
      <path d="M-4 0 L4 0 L4 -30 L-4 -30 Z" fill={SUB} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <path d="M-4 -30 L-4 -38 Q-4 -44 2 -44 L10 -44 L10 -36 L4 -36 L4 -30 Z" fill={SUB_DEEP} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <circle cx={10} cy={-40} r={3.4} fill={SEA} stroke={OUTLINE} strokeWidth={2.2} />
      <path d="M-2 -10 h4 M-2 -18 h4" stroke={SUB_DEEP} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M14 -46 q4 2 5 6" fill="none" stroke={SEA} strokeWidth={2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 200, y: 196 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.6,
    shapes: [periscope, sonarPing, torpedo],
  },
  meta: {
    nameZh: "潜艇蟹",
    elements: ["electric", "ice", "normal", "water"],
    family: "甲壳",
    toolAnchor: { x: 196, y: 231 },
    nodeBudget: 255,
    lieNote: "缩进潜艇壳，舷窗透出小灯",
  },
};
