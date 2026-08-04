// ---------------------------------------------------------------------------
// 女王蜂 queenbuzz — e5（electric+fire+grass+normal+water，缺冰）· 昆虫多足
// 剪影：蜂后：金黑条纹圆腹（五色渐变环，礼装层）+ 五瓣花冠冠冕 +
//       双层披纱翅。乐团首席指挥。
// 睡姿（P3）：趴在自己的小蜂巢鼓上，冠冕歪掉。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BEE = "#FFD93B";
const DARK = "#3E4356";
const CREAM = "#FFF6CE";
const FIRE = "#E85D3A";
const LEAF = "#8CD97B";
const SEA = "#9BDCFF";
const HONEY = "#E2A52C";
const WOOD = "#C89B5A";

function Front({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 双层披纱翅（礼装层1：外层大纱翅 + 内层小翅） */}
      <g transform={place(90, 150, -18)}>
        <g className="part-crest">
          <path d="M0 0 Q-38 -20 -48 4 Q-36 26 -8 16 Q-1 10 0 0 Z" fill="#EAF7FF" opacity={0.75} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M-8 4 Q-26 0 -36 8" fill="none" stroke={SEA} strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
        </g>
      </g>
      <g transform={place(166, 150, 18)}>
        <g className="part-banner">
          <path d="M0 0 Q38 -20 48 4 Q36 26 8 16 Q1 10 0 0 Z" fill="#EAF7FF" opacity={0.75} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M8 4 Q26 0 36 8" fill="none" stroke={SEA} strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
        </g>
      </g>
      {/* 尾：蜂针（下方小金针 + 蜜滴） */}
      <g transform={place(128, 224)}>
        <Part name="tail" origin="50% 0%">
          <path d="M-4 0 L4 0 L0 12 Z" fill={BEE} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
          <path d="M6 8 q3 3.5 3 5.5 a3 3 0 0 1 -6 0 q0 -2 3 -5.5 z" fill="#E2A52C" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 圆腹（金黑条纹 + 五色渐变环=礼装层2） */}
      <circle cx={128} cy={176} r={50} fill={BEE} stroke={OUTLINE} strokeWidth={6} />
      <g stroke={DARK} strokeWidth={9} fill="none" strokeLinecap="round">
        <path d="M84 158 Q128 146 172 158" />
        <path d="M80 184 Q128 172 176 184" />
        <path d="M90 208 Q128 200 166 208" />
      </g>
      {/* 五色渐变环点（条纹间的元素宝石排） */}
      <g stroke={OUTLINE} strokeWidth={1.8}>
        <circle cx={102} cy={170} r={3.4} fill={FIRE} />
        <circle cx={128} cy={162} r={3.4} fill={LEAF} />
        <circle cx={154} cy={170} r={3.4} fill={SEA} />
        <circle cx={112} cy={196} r={3} fill="#FFFFFF" />
        <circle cx={144} cy={196} r={3} fill={FIRE} />
      </g>
      {/* 小手（戴白手套的指挥手） */}
      <g transform={place(86, 172, 30)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color="#FFFFFF" rx={6.5} ry={10} />
        </Part>
      </g>
      <g transform={place(170, 172, -30)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color="#FFFFFF" rx={6.5} ry={10} />
        </Part>
      </g>
      {/* 小脚（黑色小靴两只） */}
      <g transform={place(112, 229)}>
        <Part name="legL" origin="50% -40%">
          <path d="M0 -8 q0 4 0 6" stroke={DARK} strokeWidth={5} strokeLinecap="round" />
          <ellipse cx={0} cy={0} rx={7} ry={4.5} fill={DARK} stroke={OUTLINE} strokeWidth={3} />
        </Part>
      </g>
      <g transform={place(144, 229)}>
        <Part name="legR" origin="50% -40%">
          <path d="M0 -8 q0 4 0 6" stroke={DARK} strokeWidth={5} strokeLinecap="round" />
          <ellipse cx={0} cy={0} rx={7} ry={4.5} fill={DARK} stroke={OUTLINE} strokeWidth={3} />
        </Part>
      </g>
      {/* 头（大头比例 + 奶油脸） */}
      <circle cx={128} cy={112} r={38} fill={BEE} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={128} cy={122} rx={26} ry={19} fill={CREAM} opacity={0.95} />
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={111} cx2={145} cy={106} r={9.5} mouthY={128} mouthW={12} expression={expression} base={eyes} />
        <Blush cx1={100} cx2={156} cy={120} />
      </g>
      {/* 头顶：五瓣花冠冠冕（礼装层3，headtop 呼吸摇）+ 触角 */}
      <g transform={place(128, 80)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round">
            <path d="M-10 0 Q-16 -10 -14 -18" />
            <path d="M10 0 Q16 -10 14 -18" />
          </g>
          <circle cx={-14} cy={-20} r={3.4} fill={DARK} stroke={OUTLINE} strokeWidth={2} />
          <circle cx={14} cy={-20} r={3.4} fill={DARK} stroke={OUTLINE} strokeWidth={2} />
          {/* 花冠冠冕（五瓣五色） */}
          <g stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round">
            <path d="M-16 -2 Q-20 -12 -12 -13 Q-8 -7 -9 -1 Z" fill={FIRE} />
            <path d="M-8 -4 Q-9 -15 -1 -15 Q2 -8 0 -2 Z" fill={LEAF} />
            <path d="M1 -3 Q3 -16 10 -13 Q12 -6 8 -1 Z" fill={SEA} />
            <path d="M9 -1 Q15 -11 20 -6 Q19 0 14 2 Z" fill="#FFFFFF" />
            <path d="M-20 0 Q-26 -6 -23 -1 Q-21 2 -18 3 Z" fill="#FFFFFF" />
          </g>
          <circle cx={-3} cy={-2} r={3.4} fill="#F5C542" stroke={OUTLINE} strokeWidth={2} />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(192, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：蜂后巡场——纱翅向后展，条纹圆腹前倾，指挥手向前引。 */
function Side({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 双层披纱翅（向后展） */}
      <g transform={place(100, 138, -26)}>
        <g className="part-crest">
          <path d="M0 0 Q-38 -22 -50 0 Q-38 24 -8 15 Q-1 9 0 0 Z" fill="#EAF7FF" opacity={0.75} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M-8 3 Q-26 -1 -38 6" fill="none" stroke={SEA} strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
        </g>
      </g>
      <g transform={place(112, 128, -44)}>
        <g className="part-banner">
          <path d="M0 0 Q-30 -20 -40 -4 Q-30 16 -6 11 Q0 7 0 0 Z" fill="#EAF7FF" opacity={0.6} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        </g>
      </g>
      {/* 尾：蜂针（腹后斜垂） */}
      <g transform={place(84, 200, 52)}>
        <Part name="tail" origin="50% 0%">
          <path d="M-4 0 L4 0 L0 12 Z" fill={BEE} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 圆腹（条纹前倾） */}
      <circle cx={124} cy={178} r={48} fill={BEE} stroke={OUTLINE} strokeWidth={6} />
      <g stroke={DARK} strokeWidth={9} fill="none" strokeLinecap="round">
        <path d="M82 160 Q124 148 166 160" />
        <path d="M78 186 Q124 174 170 186" />
        <path d="M88 210 Q124 202 162 210" />
      </g>
      {/* 元素宝石排 */}
      <g stroke={OUTLINE} strokeWidth={1.8}>
        <circle cx={100} cy={172} r={3.2} fill={FIRE} />
        <circle cx={126} cy={164} r={3.2} fill={LEAF} />
        <circle cx={152} cy={172} r={3.2} fill={SEA} />
        <circle cx={116} cy={198} r={3} fill="#FFFFFF" />
      </g>
      {/* 小靴（悬停垂足） */}
      <g transform={place(110, 229)}>
        <Part name="legL" origin="50% -40%">
          <path d="M0 -8 q0 4 0 6" stroke={DARK} strokeWidth={5} strokeLinecap="round" />
          <ellipse cx={0} cy={0} rx={7} ry={4.5} fill={DARK} stroke={OUTLINE} strokeWidth={3} />
        </Part>
      </g>
      <g transform={place(140, 229)}>
        <Part name="legR" origin="50% -40%">
          <path d="M0 -8 q0 4 0 6" stroke={DARK} strokeWidth={5} strokeLinecap="round" />
          <ellipse cx={0} cy={0} rx={7} ry={4.5} fill={DARK} stroke={OUTLINE} strokeWidth={3} />
        </Part>
      </g>
      {/* 指挥手（一只后摆一只前引） */}
      <g transform={place(104, 178, 36)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color="#E3E7F0" rx={6} ry={9.5} />
        </Part>
      </g>
      <g transform={place(162, 170, -44)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color="#FFFFFF" rx={6.5} ry={10} />
        </Part>
      </g>
      {/* 头（前倾） */}
      <circle cx={146} cy={110} r={36} fill={BEE} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={158} cy={120} rx={20} ry={16} fill={CREAM} opacity={0.95} />
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={158} cy={104} r={9.5} mouthX={166} mouthY={124} mouthW={11} expression={expression} base={eyes} />
        <ellipse cx={144} cy={120} rx={7} ry={4.5} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 头顶：花冠冠冕 + 触角（前倾） */}
      <g transform={place(146, 78, 8)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round">
            <path d="M-8 0 Q-14 -10 -12 -18" />
            <path d="M10 0 Q14 -10 12 -18" />
          </g>
          <circle cx={-12} cy={-20} r={3.4} fill={DARK} stroke={OUTLINE} strokeWidth={2} />
          <circle cx={12} cy={-20} r={3.4} fill={DARK} stroke={OUTLINE} strokeWidth={2} />
          <g stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round">
            <path d="M-14 -2 Q-18 -12 -10 -13 Q-6 -7 -7 -1 Z" fill={FIRE} />
            <path d="M-6 -4 Q-7 -15 1 -15 Q4 -8 2 -2 Z" fill={LEAF} />
            <path d="M3 -3 Q5 -16 12 -13 Q14 -6 10 -1 Z" fill={SEA} />
          </g>
          <circle cx={-1} cy={-2} r={3.4} fill="#F5C542" stroke={OUTLINE} strokeWidth={2} />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：趴在自己的小蜂巢鼓上，冠冕滑到一边，纱翅披身如毯。 */
function Lie({ palette, slots = {}, eyes = "happy", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 小蜂巢鼓（床） */}
      <g transform="translate(128 216)">
        <path d="M-44 16 L-52 0 L-44 -16 L44 -16 L52 0 L44 16 Z" fill="#E2A52C" stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
        <path d="M-44 -16 L-52 0 L-44 16 M44 -16 L52 0 L44 16" fill="none" stroke="#B97F1F" strokeWidth={2.6} />
        <g fill="none" stroke="#B97F1F" strokeWidth={2.4}>
          <path d="M-24 -4 l6 -8 l12 0 l6 8 l-6 8 l-12 0 z" />
          <path d="M6 -4 l6 -8 l12 0 l6 8 l-6 8 l-12 0 z" />
        </g>
      </g>
      {/* 纱翅（披在背上如毯） */}
      <g transform={place(96, 172, 24)}>
        <g className="part-crest">
          <path d="M0 0 Q-32 -8 -42 10 Q-30 28 -6 18 Q0 10 0 0 Z" fill="#EAF7FF" opacity={0.7} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        </g>
      </g>
      <g transform={place(158, 170, -22)}>
        <g className="part-banner">
          <path d="M0 0 Q32 -8 42 10 Q30 28 6 18 Q0 10 0 0 Z" fill="#EAF7FF" opacity={0.7} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        </g>
      </g>
      {/* 尾：蜂针（鼓后露尖） */}
      <g transform={place(184, 206, 64)}>
        <Part name="tail" origin="50% 0%">
          <path d="M-3.5 0 L3.5 0 L0 10 Z" fill={BEE} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 圆腹（趴伏在鼓上） */}
      <ellipse cx={128} cy={182} rx={50} ry={36} fill={BEE} stroke={OUTLINE} strokeWidth={6} />
      <g stroke={DARK} strokeWidth={8.5} fill="none" strokeLinecap="round">
        <path d="M84 168 Q128 158 172 168" />
        <path d="M82 192 Q128 182 174 192" />
      </g>
      <g stroke={OUTLINE} strokeWidth={1.8}>
        <circle cx={104} cy={178} r={3} fill={FIRE} />
        <circle cx={130} cy={172} r={3} fill={LEAF} />
        <circle cx={154} cy={178} r={3} fill={SEA} />
      </g>
      {/* 白手套手（垂在鼓沿） */}
      <g transform={place(88, 200, 34)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color="#FFFFFF" rx={6} ry={9.5} />
        </Part>
      </g>
      <g transform={place(168, 200, -34)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color="#FFFFFF" rx={6} ry={9.5} />
        </Part>
      </g>
      {/* 小靴（鼓沿两侧垂） */}
      <g transform={place(108, 226, 14)}>
        <Part name="legL" origin="50% -40%">
          <ellipse cx={0} cy={0} rx={6.5} ry={4.2} fill={DARK} stroke={OUTLINE} strokeWidth={3} />
        </Part>
      </g>
      <g transform={place(148, 226, -14)}>
        <Part name="legR" origin="50% -40%">
          <ellipse cx={0} cy={0} rx={6.5} ry={4.2} fill={DARK} stroke={OUTLINE} strokeWidth={3} />
        </Part>
      </g>
      {/* 头（伏在腹前，脸朝下方） */}
      <circle cx={128} cy={140} r={34} fill={BEE} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={128} cy={150} rx={23} ry={16} fill={CREAM} opacity={0.95} />
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={113} cx2={143} cy={136} r={9} mouthY={156} mouthW={11} expression={expression} base={eyes} />
        <Blush cx1={102} cx2={154} cy={148} />
      </g>
      {/* 头顶：冠冕歪掉 + 触角耷拉 */}
      <g transform={place(126, 112)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round">
            <path d="M-8 0 Q-14 -6 -16 -12" />
            <path d="M8 0 Q13 -6 14 -12" />
          </g>
          <circle cx={-17} cy={-14} r={3.2} fill={DARK} stroke={OUTLINE} strokeWidth={2} />
          <circle cx={15} cy={-14} r={3.2} fill={DARK} stroke={OUTLINE} strokeWidth={2} />
          {/* 歪掉的花冠 */}
          <g transform="translate(16 -4) rotate(26)">
            <g stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round">
              <path d="M-12 -2 Q-15 -10 -8 -11 Q-5 -6 -6 -1 Z" fill={FIRE} />
              <path d="M-4 -3 Q-5 -12 2 -12 Q4 -6 2 -1 Z" fill={LEAF} />
              <path d="M4 -2 Q6 -12 12 -10 Q13 -4 9 0 Z" fill={SEA} />
            </g>
            <circle cx={0} cy={0} r={3} fill="#F5C542" stroke={OUTLINE} strokeWidth={1.8} />
          </g>
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

// 养蜂人打工的产物：蜂蜜棒 + 蜂巢块 + 工蜂
const honeyDipper: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    {/* 木柄 */}
    <path d="M6 -9 L-2 2" stroke={WOOD} strokeWidth={2.6} strokeLinecap="round" />
    {/* 蜜球头 */}
    <ellipse cx={-4} cy={4} rx={4.6} ry={5} fill={HONEY} strokeWidth={2} />
    <g stroke="#B97F1F" strokeWidth={1.2} fill="none" strokeLinecap="round">
      <path d="M-8 2 h8 M-8.6 4.4 h9 M-7.5 6.8 h7" />
    </g>
    {/* 滴落的蜜 */}
    <path d="M-4 8.5 q-1.4 3 -0.2 4.6 q1.6 -1.4 0.2 -4.6 z" fill={HONEY} strokeWidth={1.4} />
  </g>
);
const honeycomb: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <path d="M0 -8.5 L7.4 -4.25 L7.4 4.25 L0 8.5 L-7.4 4.25 L-7.4 -4.25 Z" fill={BEE} strokeWidth={2} />
    {/* 蜂室壁 */}
    <g stroke="#B97F1F" strokeWidth={1.4} strokeLinecap="round" fill="none">
      <path d="M0 0 L0 -8.5 M0 0 L7.4 4.25 M0 0 L-7.4 4.25" />
    </g>
    <circle cx={0} cy={0} r={1.8} fill={HONEY} stroke="none" />
  </g>
);
const workerBee: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    {/* 翅膀 */}
    <g fill="#EAF7FF" strokeWidth={1.4} opacity={0.9}>
      <ellipse cx={-1} cy={-5.5} rx={3.6} ry={2.4} transform="rotate(-22 -1 -5.5)" />
      <ellipse cx={4} cy={-5.5} rx={3.6} ry={2.4} transform="rotate(22 4 -5.5)" />
    </g>
    {/* 条纹身 */}
    <ellipse cx={0} cy={1.5} rx={6.5} ry={4.6} fill={BEE} strokeWidth={2} />
    <g stroke={DARK} strokeWidth={1.9} strokeLinecap="round">
      <path d="M-2 -2.2 V5.2 M2 -2.2 V5.2" />
    </g>
    {/* 尾刺 + 眼 */}
    <path d="M6.4 1.5 l3.4 0.4 l-3.4 1.4 z" fill={DARK} strokeWidth={1} strokeLinejoin="round" />
    <circle cx={-4.6} cy={-0.4} r={0.9} fill={OUTLINE} stroke="none" />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.03,
    palette: { body: BEE, deep: DARK, belly: CREAM, accent: FIRE, accent2: LEAF },
    eyes: "happy",
    foodAnchor: { x: 128, y: 128 },
    shadowRx: 54,
  },
  // 指挥棒：白手柄细棒 + 音浪弧线
  tool: () => (
    <g>
      <path d="M-3 0 L3 0 L2 -10 L-2 -10 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
      <path d="M0 -10 L14 -44" stroke={DARK} strokeWidth={3} strokeLinecap="round" />
      <circle cx={15} cy={-46} r={2.4} fill="#F5C542" stroke={OUTLINE} strokeWidth={1.8} />
      <path d="M-10 -30 q6 -4 12 -1 M-8 -40 q7 -4 14 0" fill="none" stroke={SEA} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 200, y: 194 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.65,
    shapes: [honeyDipper, honeycomb, workerBee],
  },
  meta: {
    nameZh: "女王蜂",
    elements: ["electric", "fire", "grass", "normal", "water"],
    family: "昆虫多足",
    toolAnchor: { x: 192, y: 231 },
    nodeBudget: 305,
    lieNote: "趴在自己的小蜂巢鼓上，冠冕歪掉",
  },
};
