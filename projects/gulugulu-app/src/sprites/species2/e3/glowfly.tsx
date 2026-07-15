// ---------------------------------------------------------------------------
// 流萤虫 glowfly — e3（electric+grass+water）· 昆虫多足
// 剪影：小萤火虫，下半身=暖黄小灯泡（发光腹），背后一对挂露珠的叶形翅，
//       droopy 垂天线。夜班图书管理员。
// 睡姿（P3）：趴叶垫上，尾灯调暗当小夜灯。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm, StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const SHELL = "#4CA36B";
const DEEP = "#2F7D4E";
const GLOW = "#FFE28A";
const GLOW_CORE = "#FFF9D9";
const DEW = "#9BDCFF";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e3 背饰：一对叶形翅（挂露珠），从身后探出左右上方 */}
      <g>
        <g transform={place(88, 152, -36)}>
          <g className="part-crest">
            <path d="M0 0 Q-26 -18 -22 -46 Q-2 -40 4 -12 Q5 -4 0 0 Z" fill="#BDE8C8" opacity={0.92} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
            <path d="M-4 -10 Q-14 -24 -16 -38" fill="none" stroke={DEEP} strokeWidth={2.4} strokeLinecap="round" />
            <circle cx={-14} cy={-20} r={3.4} fill={DEW} stroke={OUTLINE} strokeWidth={2} />
          </g>
        </g>
        <g transform={place(168, 152, 36)}>
          <g className="part-banner">
            <path d="M0 0 Q26 -18 22 -46 Q2 -40 -4 -12 Q-5 -4 0 0 Z" fill="#BDE8C8" opacity={0.92} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
            <path d="M4 -10 Q14 -24 16 -38" fill="none" stroke={DEEP} strokeWidth={2.4} strokeLinecap="round" />
            <circle cx={12} cy={-28} r={3} fill={DEW} stroke={OUTLINE} strokeWidth={2} />
          </g>
        </g>
      </g>
      {/* 尾：一缕光丝拖两颗小星（左下探出） */}
      <g transform={place(78, 216)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-12 2 -18 -6" fill="none" stroke={GLOW} strokeWidth={3.4} strokeLinecap="round" />
          <path d="M-20 -8 l1.6 3.2 l3.2 1.6 l-3.2 1.6 l-1.6 3.2 l-1.6 -3.2 l-3.2 -1.6 l3.2 -1.6 z" fill={GLOW_CORE} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 身体：上壳绿 + 下腹=发光灯泡 */}
      <circle cx={128} cy={180} r={50} fill={SHELL} stroke={OUTLINE} strokeWidth={6} />
      {/* 发光腹（下半，扇贝分界线） */}
      <path
        d="M82 192 Q100 180 128 180 Q156 180 174 192 Q170 226 128 230 Q86 226 82 192 Z"
        fill={GLOW}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <ellipse cx={128} cy={208} rx={24} ry={13} fill={GLOW_CORE} />
      {/* 光晕短线 */}
      <g stroke={GLOW} strokeWidth={3} strokeLinecap="round" opacity={0.9}>
        <path d="M90 226 l-6 5 M128 236 v0.5 M166 226 l6 5" />
      </g>
      {/* 小手 */}
      <g transform={place(86, 186, 22)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={SHELL} rx={6.5} ry={10} stroke={4.5} />
        </Part>
      </g>
      <g transform={place(170, 186, -22)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={SHELL} rx={6.5} ry={10} stroke={4.5} />
        </Part>
      </g>
      {/* 小脚（藏在灯腹下缘） */}
      <g transform={place(110, 232)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={SHELL} deep={DEEP} rx={7.5} ry={4.5} lift={5} />
        </Part>
      </g>
      <g transform={place(146, 232)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SHELL} deep={DEEP} rx={7.5} ry={4.5} lift={5} />
        </Part>
      </g>
      {/* 脸（在绿壳上半） */}
      <g className="part-face">
        <ExpFace cx1={110} cx2={146} cy={166} r={9.5} mouthY={184} mouthW={13} expression={expression} base={eyes} />
        <Blush cx1={98} cx2={158} cy={178} />
      </g>
      {/* 头顶：droopy 垂天线（球端），下垂弧线（headtop 呼吸摇） */}
      <g transform={place(128, 132)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={OUTLINE} strokeWidth={3.6} strokeLinecap="round">
            <path d="M-6 2 Q-16 -10 -26 -6" />
            <path d="M6 2 Q16 -10 26 -6" />
          </g>
          <circle cx={-27} cy={-5} r={4.5} fill={GLOW} stroke={OUTLINE} strokeWidth={2.6} />
          <circle cx={27} cy={-5} r={4.5} fill={GLOW} stroke={OUTLINE} strokeWidth={2.6} />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(190, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：叶翅收在背上，发光腹在后下，垂天线朝前。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：光丝小星（左后） */}
      <g transform={place(74, 210)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-12 2 -16 -6" fill="none" stroke={GLOW} strokeWidth={3.4} strokeLinecap="round" />
          <path d="M-18 -8 l1.6 3.2 l3.2 1.6 l-3.2 1.6 l-1.6 3.2 l-1.6 -3.2 l-3.2 -1.6 l3.2 -1.6 z" fill={GLOW_CORE} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 叶翅（背上一片大叶，crest 微摆） */}
      <g transform={place(112, 148, -18)}>
        <g className="part-crest">
          <path d="M0 0 Q-30 -22 -20 -52 Q4 -44 10 -12 Q11 -4 0 0 Z" fill="#BDE8C8" opacity={0.92} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
          <path d="M-4 -12 Q-14 -28 -14 -42" fill="none" stroke={DEEP} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={-12} cy={-24} r={3.2} fill={DEW} stroke={OUTLINE} strokeWidth={2} />
        </g>
      </g>
      {/* 身体（前壳绿 + 后腹灯泡） */}
      <circle cx={130} cy={184} r={48} fill={SHELL} stroke={OUTLINE} strokeWidth={6} />
      {/* 发光腹（后下 1/3，扇贝分界） */}
      <path d="M86 196 Q104 184 128 186 Q118 214 128 228 Q98 226 86 208 Q83 200 86 196 Z" fill={GLOW} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
      <ellipse cx={104} cy={208} rx={12} ry={9} fill={GLOW_CORE} />
      <path d="M84 224 l-6 5 M96 232 l-3 5" stroke={GLOW} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
      {/* 近侧小手 */}
      <g transform={place(148, 200, -16)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={SHELL} rx={6} ry={9} stroke={4.5} />
        </Part>
      </g>
      <g transform={place(120, 206, 10)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={SHELL} rx={5.5} ry={8} stroke={4.5} />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(116, 232)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={SHELL} deep={DEEP} rx={7.5} ry={4.5} lift={5} />
        </Part>
      </g>
      <g transform={place(152, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SHELL} deep={DEEP} rx={7.5} ry={4.5} lift={5} />
        </Part>
      </g>
      {/* 脸（单眼朝右） */}
      <g className="part-face">
        <ExpSideFace cx={156} cy={168} r={9.5} mouthX={168} mouthY={190} mouthW={11} expression={expression} base={eyes} />
        <ellipse cx={144} cy={188} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：droopy 垂天线（朝前垂） */}
      <g transform={place(150, 138)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-2 2 Q10 -10 22 -6" fill="none" stroke={OUTLINE} strokeWidth={3.6} strokeLinecap="round" />
          <circle cx={23} cy={-5} r={4.5} fill={GLOW} stroke={OUTLINE} strokeWidth={2.6} />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：趴在大叶垫上，尾灯调暗当小夜灯，翅收拢天线耷拉。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 大叶垫（platform 感，贴地） */}
      <path
        d="M60 226 Q64 210 92 206 Q128 202 164 206 Q192 210 196 226 Q160 234 128 234 Q96 234 60 226 Z"
        fill="#8CD97B"
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      <path d="M78 222 Q128 212 178 222" fill="none" stroke={DEEP} strokeWidth={2.6} strokeLinecap="round" opacity={0.6} />
      {/* 尾：调暗的尾灯（后侧微光） */}
      <g transform={place(178, 210)}>
        <Part name="tail" origin="0% 50%">
          <circle cx={8} cy={0} r={9} fill={GLOW} opacity={0.75} stroke={OUTLINE} strokeWidth={3.4} />
          <circle cx={8} cy={0} r={3.4} fill={GLOW_CORE} opacity={0.8} />
        </Part>
      </g>
      {/* 低扁身体趴叶上 */}
      <ellipse cx={124} cy={200} rx={46} ry={24} fill={SHELL} stroke={OUTLINE} strokeWidth={6} />
      <path d="M92 210 Q124 222 158 208 Q150 222 124 224 Q100 220 92 210 Z" fill={GLOW} opacity={0.85} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
      {/* 收拢叶翅（贴背两小片） */}
      <g stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round">
        <path d="M104 184 Q92 166 100 152 Q114 160 116 180 Z" fill="#BDE8C8" opacity={0.92} />
        <path d="M130 182 Q124 164 134 152 Q146 162 144 180 Z" fill="#BDE8C8" opacity={0.92} />
      </g>
      {/* 小手收在身前 */}
      <g transform={place(96, 218, -8)}>
        <Part name="armL" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={7} ry={4.5} fill={SHELL} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(150, 218, 8)}>
        <Part name="armR" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={7} ry={4.5} fill={SHELL} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 脸（闭眼贴叶） */}
      <g className="part-face">
        <ExpFace cx1={110} cx2={136} cy={194} r={7.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <circle cx={123} cy={206} r={1.8} fill={OUTLINE} opacity={0.85} />
        <ellipse cx={98} cy={202} rx={6.5} ry={4} fill="#F5917B" opacity={0.5} />
      </g>
      {/* 头顶：天线耷拉贴叶 */}
      <g transform={place(122, 178)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round">
            <path d="M-4 2 q-12 0 -18 8" />
            <path d="M4 2 q12 0 18 8" />
          </g>
          <circle cx={-23} cy={11} r={3.6} fill={GLOW} opacity={0.8} stroke={OUTLINE} strokeWidth={2.2} />
          <circle cx={23} cy={11} r={3.6} fill={GLOW} opacity={0.8} stroke={OUTLINE} strokeWidth={2.2} />
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

const lightDot: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={5.5} fill={GLOW} stroke={OUTLINE} strokeWidth={1.8} />
    <circle cx={0} cy={0} r={2} fill="#FFFFFF" />
  </g>
);
const dropBit: ParticleRenderer = () => (
  <path d="M0 -7 q5.5 6.5 5.5 10.5 a5.5 5.5 0 0 1 -11 0 q0 -4 5.5 -10.5 z" fill={DEW} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);
const leafBit: ParticleRenderer = () => (
  <path d="M0 -8 q7 2.5 1.5 12 q-8 -1.5 -1.5 -12 z" fill="#8CD97B" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.08,
    palette: { body: SHELL, deep: DEEP, belly: GLOW_CORE, accent: GLOW, accent2: DEW },
    foodAnchor: { x: 132, y: 184 },
    shadowRx: 56,
  },
  // 阅读台灯：圆底座 + 曲臂 + 灯罩斜照 + 光锥
  tool: () => (
    <g>
      <ellipse cx={0} cy={-2} rx={12} ry={4} fill="#8E93A6" stroke={OUTLINE} strokeWidth={3.4} />
      <path d="M0 -4 Q-2 -20 8 -30" fill="none" stroke={OUTLINE} strokeWidth={4.5} strokeLinecap="round" />
      <path d="M8 -30 Q-2 -20 0 -4" fill="none" stroke="#57B84C" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M2 -34 L18 -30 L12 -20 L-1 -26 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
      <circle cx={9} cy={-27} r={3} fill={GLOW_CORE} />
      <path d="M13 -20 L24 -6 L8 -12 Z" fill={GLOW} opacity={0.55} />
    </g>
  ),
  workFx: {
    emitter: { x: 202, y: 206 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.55,
    shapes: [lightDot, dropBit, leafBit],
  },
  meta: {
    nameZh: "流萤虫",
    elements: ["electric", "grass", "water"],
    family: "昆虫多足",
    toolAnchor: { x: 190, y: 231 },
    nodeBudget: 170,
    lieNote: "趴叶垫上，尾灯调暗当小夜灯",
  },
};
