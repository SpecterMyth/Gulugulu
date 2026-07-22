// ---------------------------------------------------------------------------
// 冰晶水母 icejelly — e2（ice+water）· 漂浮体
// 剪影：伞盖=旋涡冰淇淋（草莓旋+糖针），四根奶油卷触手（招牌）。
//       飘来飘去的甜品师。
// 睡姿（P3）：落地摊成半融化的甜品盘。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const DOME = "#CFEFF6";
const DOME_DEEP = "#8FD8E8";
const CREAM = "#FFF8EE";
const SWIRL = "#F5A8C6";
const SEA = "#9BDCFF";
const CHERRY = "#E2432E";

/** 一根奶油卷触手（pivot=根部，向下卷） */
function CreamTentacle({ h = 34, sway = 0 }: { h?: number; sway?: number }) {
  return (
    <path
      d={`M-6 0 Q${-8 + sway} ${h * 0.4} ${-2 + sway} ${h * 0.62} Q${4 + sway} ${h * 0.8} ${sway} ${h} Q${-7 + sway} ${h * 0.92} ${-6 + sway} ${h * 0.7} Q${-10 + sway} ${h * 0.5} ${-9 + sway} ${h * 0.28} Q${-10 + sway} ${h * 0.1} -6 0 Z`}
      fill={CREAM}
      stroke={OUTLINE}
      strokeWidth={3.6}
      strokeLinejoin="round"
    />
  );
}

function Front({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 四根奶油卷触手（先画，伞盖压住根部；legL/R 用两根外侧触手承担迈步动画） */}
      <g transform={place(96, 168)}>
        <Part name="legL" origin="50% -10%">
          <CreamTentacle h={40} sway={-2} />
        </Part>
      </g>
      <g transform={place(162, 168)}>
        <Part name="legR" origin="50% -10%">
          <CreamTentacle h={40} sway={2} />
        </Part>
      </g>
      <g transform={place(118, 176)}>
        <Part name="armL" origin="50% -10%">
          <CreamTentacle h={34} sway={-1} />
        </Part>
      </g>
      <g transform={place(142, 176)}>
        <Part name="armR" origin="50% -10%">
          <CreamTentacle h={34} sway={1} />
        </Part>
      </g>
      {/* 尾：一颗掉落中的小樱桃（右下，甜品师彩蛋） */}
      <g transform={place(178, 196)}>
        <Part name="tail" origin="50% 0%">
          <path d="M0 0 q4 -8 10 -10" fill="none" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={0} cy={5} r={5.5} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.8} />
          <circle cx={-1.6} cy={3.4} r={1.6} fill="#FFFFFF" opacity={0.85} />
        </Part>
      </g>
      {/* 伞盖=旋涡冰淇淋（三层堆叠收尖） */}
      <g>
        <path
          d="M76 160 Q74 118 104 102 Q128 92 152 102 Q182 118 180 160 Q128 174 76 160 Z"
          fill={DOME}
          stroke={OUTLINE}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        {/* 草莓旋涡层 */}
        <path d="M92 118 Q128 104 164 118 Q160 108 146 102 Q128 96 110 102 Q96 108 92 118 Z" fill={SWIRL} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <path d="M112 96 Q120 82 130 88 Q138 92 134 100" fill={SWIRL} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        {/* 旋纹 + 糖针 */}
        <path d="M88 142 Q128 152 168 142" fill="none" stroke={DOME_DEEP} strokeWidth={3} strokeLinecap="round" />
        <g strokeLinecap="round" strokeWidth={2.6}>
          <path d="M104 128 l6 -3" stroke="#FFD93B" />
          <path d="M134 132 l6 -2" stroke="#E2432E" />
          <path d="M152 124 l5 -3" stroke="#8CD97B" />
          <path d="M118 138 l5 -2" stroke="#B99BE8" />
        </g>
      </g>
      {/* 伞裙边（扇贝下缘） */}
      <path d="M80 158 Q92 166 104 160 Q116 168 128 162 Q140 168 152 160 Q164 166 176 158" fill="none" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" opacity={0.5} />
      {/* 脸（伞盖下部中央） */}
      <g className="part-face">
        <ExpFace cx1={112} cx2={144} cy={138} r={9} mouthY={154} mouthW={12} expression={expression} base={eyes} />
        <Blush cx1={100} cx2={156} cy={150} />
      </g>
      {/* 头顶：尖顶小樱桃（headtop 呼吸摇） */}
      <g transform={place(126, 84)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M2 0 q2 -8 8 -10" fill="none" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
          <circle cx={11} cy={-12} r={6} fill="#E2432E" stroke={OUTLINE} strokeWidth={3} />
          <circle cx={9} cy={-14} r={1.8} fill="#FFFFFF" opacity={0.85} />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(192, 226)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：伞盖前倾飘行，奶油触手向后拖，脸在伞盖前侧。 */
function Side({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 四根奶油触手（向后拖飘） */}
      <g transform={place(88, 168)}>
        <Part name="legL" origin="50% -10%">
          <CreamTentacle h={38} sway={-5} />
        </Part>
      </g>
      <g transform={place(110, 176)}>
        <Part name="armL" origin="50% -10%">
          <CreamTentacle h={34} sway={-4} />
        </Part>
      </g>
      <g transform={place(132, 180)}>
        <Part name="armR" origin="50% -10%">
          <CreamTentacle h={32} sway={-3} />
        </Part>
      </g>
      <g transform={place(154, 174)}>
        <Part name="legR" origin="50% -10%">
          <CreamTentacle h={36} sway={-2} />
        </Part>
      </g>
      {/* 尾：小樱桃（身后飘落） */}
      <g transform={place(72, 184)}>
        <Part name="tail" origin="50% 0%">
          <path d="M0 0 q-4 -8 -10 -10" fill="none" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={0} cy={5} r={5.5} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.8} />
          <circle cx={-1.6} cy={3.4} r={1.6} fill="#FFFFFF" opacity={0.85} />
        </Part>
      </g>
      {/* 伞盖=旋涡冰淇淋（前倾） */}
      <g>
        <path
          d="M78 158 Q78 116 108 102 Q132 92 156 104 Q184 120 180 162 Q128 176 78 158 Z"
          fill={DOME}
          stroke={OUTLINE}
          strokeWidth={6}
          strokeLinejoin="round"
        />
        <path d="M94 116 Q130 104 164 122 Q162 110 148 103 Q130 96 112 101 Q98 106 94 116 Z" fill={SWIRL} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <path d="M116 96 Q124 82 134 88 Q142 93 138 101" fill={SWIRL} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <path d="M90 142 Q130 152 168 144" fill="none" stroke={DOME_DEEP} strokeWidth={3} strokeLinecap="round" />
        <g strokeLinecap="round" strokeWidth={2.6}>
          <path d="M104 128 l6 -3" stroke="#FFD93B" />
          <path d="M134 134 l6 -2" stroke="#E2432E" />
          <path d="M154 126 l5 -3" stroke="#8CD97B" />
        </g>
      </g>
      {/* 伞裙边 */}
      <path d="M82 158 Q94 166 106 160 Q118 168 130 162 Q142 168 154 162 Q166 168 176 160" fill="none" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" opacity={0.5} />
      {/* 脸（伞盖前侧） */}
      <g className="part-face">
        <ExpSideFace cx={156} cy={136} r={9} mouthX={164} mouthY={152} mouthW={10} expression={expression} base={eyes} />
        <ellipse cx={144} cy={150} rx={7} ry={4.5} fill="#F5A8C6" opacity={0.8} />
      </g>
      {/* 头顶：尖顶小樱桃（迎风后仰） */}
      <g transform={place(130, 84, 8)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M2 0 q2 -8 8 -10" fill="none" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
          <circle cx={11} cy={-12} r={6} fill="#E2432E" stroke={OUTLINE} strokeWidth={3} />
          <circle cx={9} cy={-14} r={1.8} fill="#FFFFFF" opacity={0.85} />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：落地摊成半融化的甜品盘——伞盖塌成圆丘，奶油触手化成边角，樱桃滚落一旁。 */
function Lie({ palette, slots = {}, eyes = "happy", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 融化汁水圈 */}
      <ellipse cx={128} cy={228} rx={62} ry={7} fill="none" stroke={DOME_DEEP} strokeWidth={3} opacity={0.6} />
      {/* 融化的奶油触手（从丘底摊出四角） */}
      <g transform={place(84, 224)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-8 0 Q-14 -8 -6 -10 Q2 -11 4 -4 Q4 0 0 1 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(112, 229)}>
        <Part name="armL" origin="50% -30%">
          <path d="M-7 0 Q-11 -7 -4 -8 Q3 -9 4 -3 Q4 0 0 1 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(146, 229)}>
        <Part name="armR" origin="50% -30%">
          <path d="M7 0 Q11 -7 4 -8 Q-3 -9 -4 -3 Q-4 0 0 1 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(174, 224)}>
        <Part name="legR" origin="50% -30%">
          <path d="M8 0 Q14 -8 6 -10 Q-2 -11 -4 -4 Q-4 0 0 1 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 尾：滚落在旁的樱桃 */}
      <g transform={place(196, 222)}>
        <Part name="tail" origin="50% 50%">
          <path d="M2 -4 q4 -6 10 -7" fill="none" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={0} cy={0} r={5.5} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.8} />
          <circle cx={-1.6} cy={-1.6} r={1.6} fill="#FFFFFF" opacity={0.85} />
        </Part>
      </g>
      {/* 塌成圆丘的伞盖（带融边垂滴） */}
      <path
        d="M66 216 Q64 186 94 176 Q128 166 162 176 Q192 186 190 216 Q160 230 128 230 Q96 230 66 216 Z"
        fill={DOME}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d="M74 214 q-1 8 -6 9 q-4 -2 -3 -8 q1 -4 4 -5 q4 1 5 4 z" fill={DOME} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
      {/* 草莓旋涡（塌软摊开） */}
      <path d="M92 184 Q128 172 166 186 Q160 176 146 172 Q128 166 110 172 Q96 178 92 184 Z" fill={SWIRL} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <path d="M88 202 Q128 212 168 202" fill="none" stroke={DOME_DEEP} strokeWidth={3} strokeLinecap="round" />
      {/* 糖针（散落丘面） */}
      <g strokeLinecap="round" strokeWidth={2.6}>
        <path d="M102 196 l6 -3" stroke="#FFD93B" />
        <path d="M138 200 l6 -2" stroke="#E2432E" />
        <path d="M158 192 l5 -3" stroke="#8CD97B" />
      </g>
      {/* 脸（睡颜） */}
      <g className="part-face">
        <ExpFace cx1={112} cx2={144} cy={200} r={8.5} mouthY={216} mouthW={11} expression={expression} base={eyes} />
        <Blush cx1={100} cx2={156} cy={212} />
      </g>
      {/* 头顶：顶樱桃（歪倒在丘顶） */}
      <g transform={place(118, 174, -24)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M2 0 q2 -7 7 -9" fill="none" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={10} cy={-11} r={5.5} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.8} />
          <circle cx={8} cy={-13} r={1.6} fill="#FFFFFF" opacity={0.85} />
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

const creamSwirl: ParticleRenderer = () => (
  <path d="M-5 4 Q-7 -3 -1 -5 Q5 -7 6 -1 Q6 3 2 4 Q-1 5 -1 2" fill={CREAM} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);
// 樱桃：红果 + 梗 + 叶 + 高光
const cherry: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <path d="M2 -10 Q-1 -5 -2 -1" fill="none" strokeWidth={2} strokeLinecap="round" />
    <path d="M2 -10 q6 -2 7 3 q-6 1 -7 -3 z" fill="#57B84C" strokeWidth={1.8} />
    <circle cx={-2} cy={3} r={6} fill={CHERRY} strokeWidth={2.4} />
    <circle cx={-4} cy={1} r={1.4} fill="#FFFFFF" stroke="none" />
  </g>
);
// 淋酱：红/琥珀色波浪糖浆
const syrupDrizzle: ParticleRenderer = () => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M-11 -6 Q-6 -1 -2 -5 Q2 -9 6 -4 Q9 0 11 -4" stroke="#E29A2C" strokeWidth={2.8} />
    <path d="M-10 3 Q-5 8 -1 4 Q3 0 7 5 Q9 7 11 4" stroke={CHERRY} strokeWidth={2.6} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.08,
    palette: { body: DOME, deep: DOME_DEEP, belly: CREAM, accent: SWIRL, accent2: SEA },
    eyes: "happy",
    floating: true,
    shadowRx: 46,
    foodAnchor: { x: 128, y: 152 },
  },
  // 冰淇淋勺：挖球勺 + 一球冰淇淋
  tool: () => (
    <g>
      <path d="M-2.6 0 L2.6 0 L2.2 -20 L-2.2 -20 Z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M-8 -20 Q-10 -34 0 -34 Q10 -34 8 -20 Q0 -16 -8 -20 Z" fill="#C8CCD8" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <circle cx={0} cy={-36} r={9} fill={SWIRL} stroke={OUTLINE} strokeWidth={3} />
      <path d="M-4 -39 q4 -3 8 0" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
    </g>
  ),
  workFx: {
    emitter: { x: 192, y: 186 },
    baseAngle: -Math.PI / 2.2,
    cone: 0.6,
    shapes: [creamSwirl, cherry, syrupDrizzle],
  },
  meta: {
    nameZh: "冰晶水母",
    elements: ["ice", "water"],
    family: "漂浮体",
    toolAnchor: { x: 192, y: 226 },
    nodeBudget: 165,
    lieNote: "落地摊成半融化的甜品盘",
  },
};
