// ---------------------------------------------------------------------------
// 温泉猴 onsenmonk — e2（fire+ice）· 双足小人
// 剪影：泡温泉的雪猴，蓬毛围脸，左颊暖橘右颊霜蓝（冷热同体），
//       头顶常年三缕蒸汽，肩搭小毛巾。
// 睡姿（P3）：趴在木桶沿上，毛巾盖背。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm, StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const FUR = "#E8DFD2";
const FUR_DEEP = "#C9BCA8";
const FACE = "#F5C9A5";
const WARM = "#F5917B";
const COLD = "#8FD8E8";
const STEAM = "#FFFFFF";
const DUCK = "#FFD93B";
const BEAK = "#F5A83B";
const WOOD = "#B98A4E";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：短弯猴尾（左下探出） */}
      <g transform={place(80, 210)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-16 0 -18 -14" fill="none" stroke={FUR} strokeWidth={9} strokeLinecap="round" />
        </Part>
      </g>
      {/* 身体（矮墩梨形，蓬毛） */}
      <path
        d="M92 226 Q86 184 108 170 Q128 160 148 170 Q170 184 164 226 Q128 238 92 226 Z"
        fill={FUR}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <ellipse cx={128} cy={206} rx={22} ry={15} fill={FACE} opacity={0.9} />
      {/* 肩搭小毛巾（招牌道具感） */}
      <g transform={place(154, 172, -18)}>
        <path d="M-8 0 L8 0 L8 26 L-8 26 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <path d="M-8 6 h16 M-8 20 h16" stroke={COLD} strokeWidth={2.6} />
      </g>
      {/* 小手 */}
      <g transform={place(98, 182, 26)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={FUR} rx={7} ry={12} />
        </Part>
      </g>
      <g transform={place(158, 182, -26)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={FUR} rx={7} ry={12} />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(110, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={FUR} deep={FUR_DEEP} rx={8.5} ry={5} lift={6} />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={FUR} deep={FUR_DEEP} rx={8.5} ry={5} lift={6} />
        </Part>
      </g>
      {/* 头：蓬毛大圆 + 心形脸围 */}
      <circle cx={128} cy={128} r={42} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      <g fill={FUR} stroke={OUTLINE} strokeWidth={4}>
        <circle cx={92} cy={112} r={10} />
        <circle cx={164} cy={112} r={10} />
      </g>
      {/* 桃心脸（雪猴红脸蛋区） */}
      <path
        d="M128 158 Q100 150 100 124 Q100 104 114 102 Q124 100 128 108 Q132 100 142 102 Q156 104 156 124 Q156 150 128 158 Z"
        fill={FACE}
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      {/* 脸：冷热双色腮红（左暖右霜=签名） */}
      <g className="part-face">
        <ExpFace cx1={114} cx2={142} cy={124} r={8.5} mouthY={140} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={104} cy={135} rx={8} ry={5.5} fill={WARM} opacity={0.75} />
        <ellipse cx={152} cy={135} rx={8} ry={5.5} fill={COLD} opacity={0.8} />
      </g>
      {/* 头顶：三缕蒸汽（呼吸摇） */}
      <g transform={place(128, 88)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" strokeLinecap="round">
            <path d="M-14 0 q-5 -8 0 -14" stroke={COLD} strokeWidth={7} opacity={0.5} />
            <path d="M-14 0 q-5 -8 0 -14" stroke={STEAM} strokeWidth={5} />
            <path d="M0 -2 q6 -10 0 -20" stroke={COLD} strokeWidth={8} opacity={0.5} />
            <path d="M0 -2 q6 -10 0 -20" stroke={STEAM} strokeWidth={6} />
            <path d="M14 0 q5 -8 0 -14" stroke={STEAM} strokeWidth={5} />
          </g>
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(188, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：蓬毛雪猴迈步，桃心脸转侧脸，肩搭毛巾，头顶蒸汽前飘。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：短弯猴尾（身后） */}
      <g transform={place(94, 208)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-18 -2 -20 -18" fill="none" stroke={FUR} strokeWidth={9} strokeLinecap="round" />
        </Part>
      </g>
      {/* 远侧手（被身体半遮） */}
      <g transform={place(114, 188, 18)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={FUR_DEEP} rx={6.5} ry={11} />
        </Part>
      </g>
      {/* 身体（矮墩梨形侧视） */}
      <path
        d="M96 226 Q92 186 114 172 Q132 163 150 172 Q166 186 162 226 Q128 238 96 226 Z"
        fill={FUR}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <ellipse cx={138} cy={206} rx={17} ry={12} fill={FACE} opacity={0.9} />
      {/* 肩搭小毛巾（背侧垂下） */}
      <g transform={place(116, 172, 10)}>
        <path d="M-7 0 L7 0 L7 24 L-7 24 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        <path d="M-7 6 h14 M-7 18 h14" stroke={COLD} strokeWidth={2.4} />
      </g>
      {/* 小脚（迈步） */}
      <g transform={place(114, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={FUR} deep={FUR_DEEP} rx={8.5} ry={5} lift={6} />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={FUR} deep={FUR_DEEP} rx={8.5} ry={5} lift={6} />
        </Part>
      </g>
      {/* 近侧手（摆臂） */}
      <g transform={place(146, 186, -24)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={FUR} rx={7} ry={12} />
        </Part>
      </g>
      {/* 头：后耳毛 + 蓬毛大圆（前倾探右） */}
      <circle cx={102} cy={110} r={10} fill={FUR} stroke={OUTLINE} strokeWidth={4} />
      <circle cx={134} cy={126} r={42} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 桃心侧脸区 */}
      <path
        d="M166 128 Q169 106 151 100 Q140 97 136 105 Q133 99 126 103 Q118 109 121 126 Q126 147 149 151 Q163 144 166 128 Z"
        fill={FACE}
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      {/* 脸（侧脸单眼 + 暖腮，五官放大） */}
      <g className="part-face">
        <ExpSideFace cx={150} cy={123} r={10.5} mouthX={162} mouthY={142} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={139} cy={140} rx={8} ry={5.5} fill={WARM} opacity={0.75} />
      </g>
      {/* 头顶：蒸汽两缕（前飘，冰蓝可见） */}
      <g transform={place(132, 86)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" strokeLinecap="round" stroke={COLD}>
            <path d="M-8 0 q-5 -8 0 -14" strokeWidth={5.5} />
            <path d="M8 -2 q6 -9 0 -18" strokeWidth={6} opacity={0.85} />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：泡进小木桶，头枕左桶沿毛巾当枕，脚丫翘上右桶沿——泡汤睡。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 木桶（睡床） */}
      <path d="M84 232 L92 174 L164 174 L172 232 Z" fill="#B98A4E" stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round" />
      <path d="M89 192 h78 M86 216 h84" stroke="#8A6410" strokeWidth={3} />
      {/* 汤面（露出一弯温泉水）+ 桶边蒸汽 */}
      <path d="M92 174 Q128 184 164 174" fill="none" stroke={COLD} strokeWidth={4} strokeLinecap="round" />
      <path d="M170 166 q5 -9 0 -16" fill="none" stroke={COLD} strokeWidth={4.5} strokeLinecap="round" opacity={0.8} />
      {/* 尾巴挂出桶沿（右侧垂下） */}
      <g transform={place(166, 184)}>
        <Part name="tail" origin="0% 0%">
          <path d="M0 0 Q12 6 10 20" fill="none" stroke={FUR} strokeWidth={8} strokeLinecap="round" />
        </Part>
      </g>
      {/* 脚丫翘上右桶沿（泡汤放松） */}
      <g transform={place(146, 168, -18)}>
        <Part name="legL" origin="50% 50%">
          <StubLeg color={FUR} deep={FUR_DEEP} rx={7} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(162, 168, -32)}>
        <Part name="legR" origin="50% 50%">
          <StubLeg color={FUR} deep={FUR_DEEP} rx={7} ry={4.5} lift={4} />
        </Part>
      </g>
      {/* 手：一只垂在桶外壁，一只扒着桶前沿 */}
      <g transform={place(90, 190, 8)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={FUR} rx={6.5} ry={11} />
        </Part>
      </g>
      <g transform={place(134, 184, -12)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={FUR} rx={6} ry={9} />
        </Part>
      </g>
      {/* 头：枕在左桶沿的蓬毛大圆（歪头睡）+ 后耳毛 */}
      <circle cx={76} cy={126} r={10} fill={FUR} stroke={OUTLINE} strokeWidth={4} />
      <circle cx={106} cy={152} r={38} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 桃心脸（微歪） */}
      <path
        d="M106 180 Q82 172 82 150 Q82 132 94 130 Q103 128 106 136 Q109 128 118 130 Q130 132 130 150 Q130 172 106 180 Z"
        fill={FACE}
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      {/* 脸（闭眼冒小汗珠，冷热腮红仍在） */}
      <g className="part-face">
        <ExpFace cx1={94} cx2={118} cy={150} r={8} mouthY={164} mouthW={10} expression={expression} base={eyes} />
        <ellipse cx={88} cy={160} rx={7} ry={5} fill={WARM} opacity={0.75} />
        <ellipse cx={124} cy={160} rx={7} ry={5} fill={COLD} opacity={0.8} />
      </g>
      {/* 头顶：叠好的小毛巾（经典泡汤造型）+ 一缕慢蒸汽 */}
      <g transform={place(104, 116)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-14 0 L14 0 L12 -9 L-12 -9 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
          <path d="M-12 -4.5 h24" stroke={COLD} strokeWidth={2.2} />
          <path d="M18 -6 q5 -8 0 -15" fill="none" stroke={COLD} strokeWidth={4.5} strokeLinecap="round" opacity={0.85} />
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

// 小黄鸭：黄身 + 橙喙 + 圆眼
const rubberDucky: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <path d="M-8 4 Q-8 -3 -1 -3 Q2 -3 4 0 Q9 0 9 4 Q9 8 2 8 Q-8 8 -8 4 Z" fill={DUCK} strokeWidth={2.2} />
    <circle cx={-4} cy={-5} r={4.5} fill={DUCK} strokeWidth={2.2} />
    <path d="M-8 -5 L-13 -4 L-8 -2 Z" fill={BEAK} strokeWidth={1.8} />
    <circle cx={-3.5} cy={-6} r={1.1} fill={OUTLINE} stroke="none" />
  </g>
);
// 泡澡木桶：木条梯形桶 + 提手弧
const bathBucket: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <path d="M-7 -6 Q0 -13 7 -6" fill="none" strokeWidth={2} strokeLinecap="round" />
    <path d="M-8 -6 L8 -6 L6 8 L-6 8 Z" fill={WOOD} strokeWidth={2.4} />
    <g stroke="#8A6410" strokeWidth={1.4}>
      <path d="M-2.7 -6 L-2 8 M3 -6 L2.3 8 M-7 1 L7 1" />
    </g>
  </g>
);
// 舒服脸：眯眼笑 + 张嘴「啊～」+ 红晕
const ahhFace: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <circle cx={0} cy={0} r={8} fill={FACE} strokeWidth={2.4} />
    <path d="M-6 -2 q1.5 -2.5 3 0 M3 -2 q1.5 -2.5 3 0" fill="none" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" />
    <path d="M-2.5 3 Q0 7 2.5 3 Q0 4.5 -2.5 3 Z" fill={WARM} strokeWidth={1.8} />
    <g fill={WARM} stroke="none" opacity={0.7}>
      <ellipse cx={-6} cy={2} rx={2} ry={1.3} />
      <ellipse cx={6} cy={2} rx={2} ry={1.3} />
    </g>
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.05,
    palette: { body: FUR, deep: FUR_DEEP, belly: FACE, accent: WARM, accent2: COLD },
    foodAnchor: { x: 130, y: 140 },
    shadowRx: 52,
  },
  // 澡堂木桶刷：小木桶（一半温泉水）+ 长柄毛刷
  tool: () => (
    <g>
      <path d="M-16 0 L-14 -18 L14 -18 L16 0 Z" fill="#B98A4E" stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      <path d="M-14 -12 h28" stroke="#8A6410" strokeWidth={2.2} />
      <path d="M-11 -18 Q0 -22 11 -18" fill="none" stroke={COLD} strokeWidth={3} strokeLinecap="round" />
      <path d="M-4 -22 q-2 -4 1 -7 M4 -21 q2 -4 -1 -7" fill="none" stroke={STEAM} strokeWidth={2.4} strokeLinecap="round" />
      <g transform="translate(14 -22) rotate(-28)">
        <path d="M-2 0 L2 0 L2 -20 L-2 -20 Z" fill="#D9A514" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        <rect x={-6} y={-32} width={12} height={12} rx={3} fill="#FFF4E4" stroke={OUTLINE} strokeWidth={2.8} />
        <path d="M-4 -20 v3 M0 -20 v3 M4 -20 v3" stroke={OUTLINE} strokeWidth={1.6} strokeLinecap="round" />
      </g>
    </g>
  ),
  workFx: {
    emitter: { x: 200, y: 196 },
    baseAngle: -Math.PI / 2.2,
    cone: 0.6,
    shapes: [rubberDucky, bathBucket, ahhFace],
  },
  meta: {
    nameZh: "温泉猴",
    elements: ["fire", "ice"],
    family: "双足小人",
    toolAnchor: { x: 188, y: 231 },
    nodeBudget: 130,
    lieNote: "趴在木桶沿上，毛巾盖背",
  },
};
