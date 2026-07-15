// ---------------------------------------------------------------------------
// 爆浆糬 mochipop — e4（electric+fire+ice+normal）· 团状软体
// 剪影：雪白方圆年糕团子（squish 方糕=招牌），头插仙女棒，
//       爆米花星环绕（e4 环绕件 orbit），糖霜网格。跨年夜限定艺人。
// 睡姿（P3）：摊成一块完美的方年糕。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm, StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const MOCHI = "#FFF8EE";
const MOCHI_DEEP = "#F0DFC8";
const FLAME = "#FFB03A";
const VOLT = "#FFD93B";
const ICE = "#8FD8E8";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e4 环绕件：爆米花星轨道（part-orbit 慢转） */}
      <g transform={place(128, 172)}>
        <g className="part-orbit">
          <g stroke={OUTLINE} strokeWidth={2}>
            <g transform="translate(-62 0)">
              <circle cx={-3} cy={0} r={3.4} fill={MOCHI} />
              <circle cx={2} cy={-2.5} r={3} fill="#FFF1C9" />
              <circle cx={2} cy={2.5} r={2.6} fill={MOCHI} />
            </g>
            <g transform="translate(62 0)">
              <circle cx={3} cy={0} r={3.4} fill={MOCHI} />
              <circle cx={-2} cy={-2.5} r={3} fill="#FFF1C9" />
              <circle cx={-2} cy={2.5} r={2.6} fill={MOCHI} />
            </g>
            <path d="M-3 -20 L-1.4 -16 L2 -14.5 L-1.4 -13 L-3 -9 L-4.6 -13 L-8 -14.5 L-4.6 -16 Z" fill={VOLT} transform="translate(3 -2)" />
            <path d="M-3 16 L-1.4 20 L2 21.5 L-1.4 23 L-3 27 L-4.6 23 L-8 21.5 L-4.6 20 Z" fill={FLAME} transform="translate(3 -21)" />
          </g>
        </g>
      </g>
      {/* 尾：一小坨拉丝年糕（左下拖出，tail 摇摆） */}
      <g transform={place(82, 222)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-10 2 -16 -2 Q-18 -6 -14 -8 Q-8 -6 0 -6 Z" fill={MOCHI} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 方圆年糕身（squish 圆角方块=招牌剪影） */}
      <rect x={78} y={128} width={100} height={102} rx={38} fill={MOCHI} stroke={OUTLINE} strokeWidth={6} />
      {/* 糖霜网格烤纹 */}
      <g fill="none" stroke={MOCHI_DEEP} strokeWidth={3} strokeLinecap="round" opacity={0.9}>
        <path d="M98 156 h60 M98 176 h60" />
        <path d="M112 142 v50 M144 142 v50" />
      </g>
      {/* 烤鼓起的焦糖斑 */}
      <g fill={FLAME} opacity={0.55}>
        <circle cx={96} cy={146} r={5} />
        <circle cx={162} cy={200} r={6} />
      </g>
      {/* 冰糖粒 */}
      <g fill={ICE} stroke={OUTLINE} strokeWidth={1.6}>
        <path d="M160 142 L163 146 L160 150 L157 146 Z" />
        <path d="M94 206 L97 210 L94 214 L91 210 Z" />
      </g>
      {/* 小手小脚（糯米小短肢） */}
      <g transform={place(78, 192, 26)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={MOCHI} rx={7} ry={10} />
        </Part>
      </g>
      <g transform={place(178, 192, -26)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={MOCHI} rx={7} ry={10} />
        </Part>
      </g>
      <g transform={place(110, 232)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={MOCHI} deep={MOCHI_DEEP} rx={8.5} ry={5} lift={4} />
        </Part>
      </g>
      <g transform={place(146, 232)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={MOCHI} deep={MOCHI_DEEP} rx={8.5} ry={5} lift={4} />
        </Part>
      </g>
      {/* 脸（糕面居中） */}
      <g className="part-face">
        <ExpFace cx1={112} cx2={144} cy={172} r={9.5} mouthY={192} mouthW={13} expression={expression} base={eyes} />
        <Blush cx1={100} cx2={156} cy={186} />
      </g>
      {/* 头顶：插着的仙女棒（headtop 呼吸摇；燃着星火） */}
      <g transform={place(140, 128)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 L10 -26" stroke="#8A6410" strokeWidth={3.4} strokeLinecap="round" />
          <g transform="translate(12 -30)">
            <path d="M0 -6 L1.8 -1.8 L7 0 L1.8 1.8 L0 6 L-1.8 1.8 L-7 0 L-1.8 -1.8 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
            <g stroke={FLAME} strokeWidth={2} strokeLinecap="round">
              <path d="M-8 -8 l-3 -3 M8 -8 l3 -3 M0 -10 v-4" />
            </g>
          </g>
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

/** 侧视（右向）：方糕团子颠颠小跑，脸偏前，仙女棒后扬拉星火，拉丝尾在后。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 爆米花星轨道（随行） */}
      <g transform={place(128, 174)}>
        <g className="part-orbit">
          <g stroke={OUTLINE} strokeWidth={2}>
            <g transform="translate(-58 0)">
              <circle cx={-3} cy={0} r={3.4} fill={MOCHI} />
              <circle cx={2} cy={-2.5} r={3} fill="#FFF1C9" />
            </g>
            <g transform="translate(58 0)">
              <circle cx={3} cy={0} r={3.4} fill={MOCHI} />
              <circle cx={-2} cy={2.5} r={2.6} fill={MOCHI} />
            </g>
            <path d="M0 -24 L1.6 -20 L5 -18.5 L1.6 -17 L0 -13 L-1.6 -17 L-5 -18.5 L-1.6 -20 Z" fill={VOLT} />
          </g>
        </g>
      </g>
      {/* 尾：拉丝年糕（身后拖丝） */}
      <g transform={place(86, 222)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-10 2 -16 -2 Q-18 -6 -14 -8 Q-8 -6 0 -6 Z" fill={MOCHI} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 方圆年糕身（前倾小跑） */}
      <rect x={82} y={130} width={94} height={100} rx={36} fill={MOCHI} stroke={OUTLINE} strokeWidth={6} />
      {/* 糖霜网格 */}
      <g fill="none" stroke={MOCHI_DEEP} strokeWidth={3} strokeLinecap="round" opacity={0.9}>
        <path d="M100 158 h58 M100 178 h58" />
        <path d="M116 144 v48 M146 144 v48" />
      </g>
      {/* 焦糖斑 + 冰糖粒 */}
      <circle cx={98} cy={148} r={5} fill={FLAME} opacity={0.55} />
      <path d="M160 144 L163 148 L160 152 L157 148 Z" fill={ICE} stroke={OUTLINE} strokeWidth={1.6} />
      {/* 小手（前后摆） */}
      <g transform={place(86, 192, 24)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={MOCHI_DEEP} rx={6.5} ry={9.5} />
        </Part>
      </g>
      <g transform={place(172, 188, -28)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={MOCHI} rx={7} ry={10} />
        </Part>
      </g>
      {/* 小脚（迈步） */}
      <g transform={place(112, 232)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={MOCHI} deep={MOCHI_DEEP} rx={8.5} ry={5} lift={5} />
        </Part>
      </g>
      <g transform={place(146, 232)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={MOCHI} deep={MOCHI_DEEP} rx={8.5} ry={5} lift={5} />
        </Part>
      </g>
      {/* 脸（糕面偏前） */}
      <g className="part-face">
        <ExpSideFace cx={150} cy={168} r={9.5} mouthX={158} mouthY={190} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={136} cy={186} rx={7.5} ry={5} fill="#F5A8C6" opacity={0.7} />
      </g>
      {/* 头顶：仙女棒（后扬拉出星火） */}
      <g transform={place(134, 130, -14)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 L-12 -24" stroke="#8A6410" strokeWidth={3.4} strokeLinecap="round" />
          <g transform="translate(-14 -28)">
            <path d="M0 -6 L1.8 -1.8 L7 0 L1.8 1.8 L0 6 L-1.8 1.8 L-7 0 L-1.8 -1.8 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
            <g stroke={FLAME} strokeWidth={2} strokeLinecap="round">
              <path d="M-8 -6 l-3 -3 M-9 2 l-4 1 M0 -10 v-4" />
            </g>
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：摊成一块完美的方年糕平板，仙女棒斜插在糕边，爆米花落在糕面歇着。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：拉丝年糕（贴地拖出） */}
      <g transform={place(196, 226)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 0 Q10 2 16 -2 Q18 -6 14 -8 Q8 -6 0 -6 Z" fill={MOCHI} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 摊平的完美方年糕 */}
      <rect x={60} y={188} width={136} height={44} rx={20} fill={MOCHI} stroke={OUTLINE} strokeWidth={6} />
      {/* 糕面网格（俯视浅纹） */}
      <g fill="none" stroke={MOCHI_DEEP} strokeWidth={2.8} strokeLinecap="round" opacity={0.9}>
        <path d="M76 202 h104 M76 216 h104" />
        <path d="M100 192 v36 M132 192 v36 M164 192 v36" />
      </g>
      {/* 焦糖斑 + 冰糖粒（糕面） */}
      <circle cx={86} cy={208} r={4.5} fill={FLAME} opacity={0.55} />
      <path d="M174 206 L177 210 L174 214 L171 210 Z" fill={ICE} stroke={OUTLINE} strokeWidth={1.6} />
      {/* 糕面歇着的爆米花两粒 */}
      <g stroke={OUTLINE} strokeWidth={1.8}>
        <g transform="translate(112 184)">
          <circle cx={-2.5} cy={0.5} r={3.4} fill={MOCHI} />
          <circle cx={2.5} cy={-2} r={3} fill="#FFF1C9" />
        </g>
        <g transform="translate(158 186)">
          <circle cx={2.5} cy={0} r={3.2} fill={MOCHI} />
          <circle cx={-2} cy={-2} r={2.8} fill="#FFF1C9" />
        </g>
      </g>
      {/* 小手小脚（从糕边露出小圆头） */}
      <g transform={place(62, 214, 78)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={MOCHI} rx={6} ry={8} />
        </Part>
      </g>
      <g transform={place(194, 212, -78)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={MOCHI} rx={6} ry={8} />
        </Part>
      </g>
      <g transform={place(104, 233)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={7.5} ry={4} fill={MOCHI_DEEP} stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      <g transform={place(152, 233)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={7.5} ry={4} fill={MOCHI_DEEP} stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      {/* 脸（糕面睡颜） */}
      <g className="part-face">
        <ExpFace cx1={116} cx2={144} cy={206} r={8} mouthY={222} mouthW={11} expression={expression} base={eyes} />
        <Blush cx1={106} cx2={154} cy={218} />
      </g>
      {/* 头顶：仙女棒斜倚糕边（余火轻闪） */}
      <g transform={place(186, 192, 58)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 L8 -22" stroke="#8A6410" strokeWidth={3.2} strokeLinecap="round" />
          <g transform="translate(9 -26)">
            <path d="M0 -5 L1.5 -1.5 L6 0 L1.5 1.5 L0 5 L-1.5 1.5 L-6 0 L-1.5 -1.5 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round" />
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

// 仙女棒的第二产物：拖尾火花（配 1 粒糖霜=年糕点缀）
const sparkTrail: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <path d="M0 -7 L1.4 -2 L6 0 L1.4 2 L0 7 L-1 2 L-6 0 L-1 -2 Z" fill={FLAME} strokeWidth={1.6} />
    <path d="M2 2 l5 6" stroke={VOLT} strokeWidth={1.8} strokeLinecap="round" fill="none" />
  </g>
);
const sparkBit: ParticleRenderer = () => (
  <g>
    <path d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
  </g>
);
const sugarBit: ParticleRenderer = () => (
  <path d="M0 -5 L3.5 0 L0 5 L-3.5 0 Z" fill={ICE} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.12,
    palette: { body: MOCHI, deep: MOCHI_DEEP, belly: "#FFFFFF", accent: FLAME, accent2: ICE },
    foodAnchor: { x: 128, y: 192 },
    shadowRx: 58,
  },
  // 仙女棒：一把三根，星火四溅
  tool: () => (
    <g>
      <g stroke="#8A6410" strokeWidth={2.8} strokeLinecap="round">
        <path d="M0 0 L-4 -30" />
        <path d="M2 0 L6 -32" />
        <path d="M1 0 L1 -34" />
      </g>
      <g stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round">
        <path d="M-5 -34 L-3.8 -31 L-1 -30 L-3.8 -29 L-5 -26 L-6.2 -29 L-9 -30 L-6.2 -31 Z" fill={VOLT} />
        <path d="M7 -36 L8.2 -33 L11 -32 L8.2 -31 L7 -28 L5.8 -31 L3 -32 L5.8 -33 Z" fill={FLAME} />
        <path d="M1 -40 L2.2 -37 L5 -36 L2.2 -35 L1 -32 L-0.2 -35 L-3 -36 L-0.2 -37 Z" fill="#FFF1C9" />
      </g>
    </g>
  ),
  workFx: {
    emitter: { x: 198, y: 196 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.7,
    shapes: [sparkBit, sparkTrail, sugarBit],
  },
  meta: {
    nameZh: "爆浆糬",
    elements: ["electric", "fire", "ice", "normal"],
    family: "团状软体",
    toolAnchor: { x: 196, y: 231 },
    nodeBudget: 255,
    lieNote: "摊成一块完美的方年糕",
  },
};
