// ---------------------------------------------------------------------------
// 啵茶鸟 bobamingo — e3（fire+grass+water）· 鸟禽
// 剪影：奶茶粉火烈鸟，单腿站立（招牌）+ S 形吸管长颈，
//       站立腿戴珍珠脚环（e3 装饰），尾羽小蓬。下午茶宣传大使。
// 睡姿（P3）：长脖绕回背上蹲卧，像盖好的奶茶。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { WingArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const PINK = "#F5A8C6";
const PINK_DEEP = "#E87DA8";
const CREAM = "#FFF0F5";
const BOBA = "#8A5A3B";
const LEAF = "#8CD97B";

function Front({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：奶泡蓬尾（左侧探出） */}
      <g transform={place(92, 158)}>
        <Part name="tail" origin="100% 60%">
          <g fill={PINK_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
            <path d="M0 0 Q-16 -4 -22 6 Q-12 12 -2 8 Z" />
            <path d="M0 -6 Q-14 -14 -22 -8 Q-14 0 -2 0 Z" fill={PINK} />
          </g>
        </Part>
      </g>
      {/* S 形吸管长颈（招牌：从身体向上再弯向右，绿色吸管纹） */}
      <path
        d="M118 150 Q112 118 126 96 Q140 76 158 82 L154 96 Q142 92 134 106 Q126 122 132 148 Z"
        fill={PINK}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M124 118 l12 6 M128 104 l11 7" stroke={LEAF} strokeWidth={2.6} strokeLinecap="round" opacity={0.7} />
      {/* 身体（奶茶杯形圆身） */}
      <ellipse cx={128} cy={172} rx={40} ry={30} fill={PINK} stroke={OUTLINE} strokeWidth={6} />
      {/* 奶茶分层肚（下层珍珠） */}
      <path d="M94 176 Q128 168 162 176 Q158 198 128 200 Q98 198 94 176 Z" fill={CREAM} opacity={0.95} />
      <g fill={BOBA} stroke={OUTLINE} strokeWidth={1.8}>
        <circle cx={112} cy={190} r={3.4} />
        <circle cx={128} cy={193} r={3.4} />
        <circle cx={144} cy={190} r={3.4} />
      </g>
      {/* 翅膀 */}
      <g transform={place(94, 160, 14)}>
        <Part name="armL" origin="50% 8%">
          <WingArm color={PINK_DEEP} deep={OUTLINE} len={24} mirror />
        </Part>
      </g>
      <g transform={place(162, 160, -14)}>
        <Part name="armR" origin="50% 8%">
          <WingArm color={PINK_DEEP} deep={OUTLINE} len={24} />
        </Part>
      </g>
      {/* 单腿站立（招牌）：站立长腿 + 收起的折腿 */}
      <g transform={place(132, 231)}>
        <Part name="legR" origin="50% -12%">
          <path d="M0 -30 V-4" stroke={PINK_DEEP} strokeWidth={7} strokeLinecap="round" />
          <path d="M-8 0 L0 -4 L8 0 M0 -4 V1" stroke={PINK_DEEP} strokeWidth={4.5} strokeLinecap="round" fill="none" />
          {/* 珍珠脚环（e3 装饰） */}
          <g fill={BOBA} stroke={OUTLINE} strokeWidth={1.6}>
            <circle cx={-5} cy={-16} r={2.8} />
            <circle cx={0} cy={-14.5} r={2.8} />
            <circle cx={5} cy={-16} r={2.8} />
          </g>
        </Part>
      </g>
      <g transform={place(114, 204)}>
        <Part name="legL" origin="50% -12%">
          <path d="M0 0 Q-4 10 2 14 Q8 16 10 10" fill="none" stroke={PINK_DEEP} strokeWidth={6.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 头（颈顶圆头——加大更可爱） */}
      <circle cx={160} cy={72} r={29} fill={PINK} stroke={OUTLINE} strokeWidth={5.5} />
      {/* 脸：弯喙（奶茶勺喙） */}
      <g className="part-face">
        <ExpFace cx1={150} cx2={172} cy={68} r={7.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path d="M184 76 Q197 80 197 91 Q190 93 184 87 Q180 83 182 77 Z" fill={BOBA} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        <Blush cx1={146} cx2={174} cy={82} />
      </g>
      {/* 头顶：三根奶泡呆羽（headtop 呼吸摇） */}
      <g transform={place(158, 46)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={PINK_DEEP} strokeWidth={3} strokeLinecap="round">
            <path d="M-6 2 Q-8 -6 -5 -10 M0 0 Q0 -8 2 -12 M6 2 Q9 -5 7 -10" />
          </g>
          <circle cx={-5} cy={-12} r={2.6} fill={CREAM} stroke={OUTLINE} strokeWidth={1.8} />
          <circle cx={2} cy={-14} r={2.6} fill={CREAM} stroke={OUTLINE} strokeWidth={1.8} />
          <circle cx={8} cy={-12} r={2.4} fill={CREAM} stroke={OUTLINE} strokeWidth={1.8} />
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

/** 侧视（右向）：细腿迈步，S 颈前伸，勺喙朝前，奶泡尾在后。 */
function Side({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：奶泡蓬尾（身后） */}
      <g transform={place(92, 156)}>
        <Part name="tail" origin="100% 60%">
          <g fill={PINK_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
            <path d="M0 0 Q-16 -4 -22 6 Q-12 12 -2 8 Z" />
            <path d="M0 -6 Q-14 -14 -22 -8 Q-14 0 -2 0 Z" fill={PINK} />
          </g>
        </Part>
      </g>
      {/* 远侧翅 */}
      <g transform={place(106, 160, 12)}>
        <Part name="armL" origin="50% 8%">
          <WingArm color="#D96A96" deep={OUTLINE} len={22} mirror />
        </Part>
      </g>
      {/* S 形吸管长颈（前伸） */}
      <path
        d="M114 150 Q108 118 122 96 Q136 76 154 82 L150 96 Q138 92 130 106 Q122 122 128 148 Z"
        fill={PINK}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M120 118 l12 6 M124 104 l11 7" stroke={LEAF} strokeWidth={2.6} strokeLinecap="round" opacity={0.7} />
      {/* 身体（奶茶杯圆身） */}
      <ellipse cx={122} cy={170} rx={38} ry={29} fill={PINK} stroke={OUTLINE} strokeWidth={6} />
      <path d="M90 174 Q122 166 154 174 Q150 194 122 196 Q94 194 90 174 Z" fill={CREAM} opacity={0.95} />
      <g fill={BOBA} stroke={OUTLINE} strokeWidth={1.8}>
        <circle cx={108} cy={186} r={3.2} />
        <circle cx={124} cy={189} r={3.2} />
        <circle cx={140} cy={186} r={3.2} />
      </g>
      {/* 双腿迈步：站立腿（带珍珠脚环）+ 抬起后蹬腿 */}
      <g transform={place(138, 231)}>
        <Part name="legR" origin="50% -12%">
          <path d="M0 -34 V-4" stroke={PINK_DEEP} strokeWidth={7} strokeLinecap="round" />
          <path d="M-8 0 L0 -4 L8 0 M0 -4 V1" stroke={PINK_DEEP} strokeWidth={4.5} strokeLinecap="round" fill="none" />
          <g fill={BOBA} stroke={OUTLINE} strokeWidth={1.6}>
            <circle cx={-5} cy={-16} r={2.8} />
            <circle cx={0} cy={-14.5} r={2.8} />
            <circle cx={5} cy={-16} r={2.8} />
          </g>
        </Part>
      </g>
      <g transform={place(108, 226)}>
        <Part name="legL" origin="50% -12%">
          <path d="M4 -28 Q-2 -18 -6 -8" fill="none" stroke={PINK_DEEP} strokeWidth={6.5} strokeLinecap="round" />
          <path d="M-11 -4 L-6 -8 L0 -3" stroke={PINK_DEEP} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      {/* 近侧翅（贴身摆） */}
      <g transform={place(138, 158, -16)}>
        <Part name="armR" origin="50% 8%">
          <WingArm color={PINK_DEEP} deep={OUTLINE} len={24} />
        </Part>
      </g>
      {/* 头（颈顶圆头朝前） */}
      <circle cx={156} cy={72} r={28} fill={PINK} stroke={OUTLINE} strokeWidth={5.5} />
      {/* 脸（侧脸 + 勺喙） */}
      <g className="part-face">
        <ExpSideFace cx={164} cy={66} r={8} expression={expression} base={eyes} withMouth={false} />
        <path d="M180 74 Q193 78 193 89 Q186 91 180 85 Q176 81 178 75 Z" fill={BOBA} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        <ellipse cx={152} cy={82} rx={5.5} ry={4} fill="#E87DA8" opacity={0.6} />
      </g>
      {/* 头顶：奶泡呆羽（迎风后飘） */}
      <g transform={place(150, 46, -10)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={PINK_DEEP} strokeWidth={3} strokeLinecap="round">
            <path d="M-6 2 Q-9 -5 -7 -10 M0 0 Q-2 -8 -1 -12 M6 2 Q6 -5 5 -10" />
          </g>
          <circle cx={-8} cy={-12} r={2.6} fill={CREAM} stroke={OUTLINE} strokeWidth={1.8} />
          <circle cx={-1} cy={-14} r={2.6} fill={CREAM} stroke={OUTLINE} strokeWidth={1.8} />
          <circle cx={5} cy={-12} r={2.4} fill={CREAM} stroke={OUTLINE} strokeWidth={1.8} />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：蹲卧收腿，长脖绕回背上、头枕背心——像盖好盖子的奶茶。 */
function Lie({ palette, slots = {}, eyes = "happy", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：奶泡蓬尾（贴地） */}
      <g transform={place(88, 190)}>
        <Part name="tail" origin="100% 60%">
          <g fill={PINK_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
            <path d="M0 0 Q-15 -4 -21 6 Q-11 12 -2 8 Z" />
            <path d="M0 -6 Q-13 -13 -21 -8 Q-13 0 -2 0 Z" fill={PINK} />
          </g>
        </Part>
      </g>
      {/* 身体（蹲卧奶茶杯） */}
      <ellipse cx={128} cy={200} rx={42} ry={28} fill={PINK} stroke={OUTLINE} strokeWidth={6} />
      <path d="M90 204 Q128 196 166 204 Q160 222 128 224 Q96 222 90 204 Z" fill={CREAM} opacity={0.95} />
      <g fill={BOBA} stroke={OUTLINE} strokeWidth={1.8}>
        <circle cx={112} cy={214} r={3.2} />
        <circle cx={128} cy={217} r={3.2} />
        <circle cx={144} cy={214} r={3.2} />
      </g>
      {/* 收拢的脚（杯底微露脚尖 + 珍珠环） */}
      <g transform={place(114, 231)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-6 0 L0 -3 L6 0" stroke={PINK_DEEP} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      <g transform={place(144, 231)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-6 0 L0 -3 L6 0" stroke={PINK_DEEP} strokeWidth={4} strokeLinecap="round" fill="none" />
          <g fill={BOBA} stroke={OUTLINE} strokeWidth={1.4}>
            <circle cx={-4} cy={-6} r={2.4} />
            <circle cx={1} cy={-7} r={2.4} />
          </g>
        </Part>
      </g>
      {/* 长脖绕回背上（S 颈盖回来） */}
      <path
        d="M100 188 Q92 152 116 138 Q144 126 160 146 L150 156 Q140 142 126 150 Q112 158 116 184 Z"
        fill={PINK}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M106 162 l12 5 M112 148 l11 6" stroke={LEAF} strokeWidth={2.4} strokeLinecap="round" opacity={0.7} />
      {/* 翅膀收拢护杯 */}
      <g transform={place(96, 196, 22)}>
        <Part name="armL" origin="50% 8%">
          <WingArm color="#D96A96" deep={OUTLINE} len={20} mirror />
        </Part>
      </g>
      <g transform={place(160, 196, -22)}>
        <Part name="armR" origin="50% 8%">
          <WingArm color={PINK_DEEP} deep={OUTLINE} len={22} />
        </Part>
      </g>
      {/* 头（枕在背心，喙掖进翅根） */}
      <circle cx={152} cy={162} r={26} fill={PINK} stroke={OUTLINE} strokeWidth={5.5} />
      <path d="M136 176 Q124 182 118 192 Q126 196 134 190 Q140 184 140 178 Z" fill={BOBA} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={144} cx2={164} cy={158} r={7} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={138} cx2={170} cy={172} />
      </g>
      {/* 头顶：奶泡呆羽（塌） */}
      <g transform={place(154, 138, 8)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={PINK_DEEP} strokeWidth={3} strokeLinecap="round">
            <path d="M-5 2 Q-7 -5 -5 -9 M1 0 Q1 -7 2 -10 M7 2 Q9 -4 8 -9" />
          </g>
          <circle cx={-5} cy={-11} r={2.4} fill={CREAM} stroke={OUTLINE} strokeWidth={1.8} />
          <circle cx={2} cy={-12} r={2.4} fill={CREAM} stroke={OUTLINE} strokeWidth={1.8} />
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

const pearlBit: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={5} fill={BOBA} stroke={OUTLINE} strokeWidth={2} />
    <circle cx={-1.4} cy={-1.4} r={1.4} fill="#C9A86A" />
  </g>
);
const teaDrop: ParticleRenderer = () => (
  <path d="M0 -7 q5.5 6.5 5.5 10.5 a5.5 5.5 0 0 1 -11 0 q0 -4 5.5 -10.5 z" fill="#E2C08A" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);
const leafBit: ParticleRenderer = () => (
  <path d="M0 -8 q7 2.5 1.5 12 q-8 -1.5 -1.5 -12 z" fill={LEAF} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1,
    palette: { body: PINK, deep: PINK_DEEP, belly: CREAM, accent: BOBA, accent2: LEAF },
    eyes: "happy",
    foodAnchor: { x: 176, y: 84 },
    shadowRx: 46,
  },
  // 奶茶摇摇杯：带盖摇杯 + 吸管 + 飞出的珍珠
  tool: () => (
    <g>
      <path d="M-11 0 L11 0 L8 -28 L-8 -28 Z" fill="#E2C08A" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <path d="M-9 -10 Q0 -14 9 -10" fill="none" stroke={CREAM} strokeWidth={3} strokeLinecap="round" />
      <g fill={BOBA} stroke={OUTLINE} strokeWidth={1.4}>
        <circle cx={-4} cy={-4} r={2.2} />
        <circle cx={1} cy={-3} r={2.2} />
        <circle cx={5} cy={-5} r={2.2} />
      </g>
      <path d="M-9 -28 L9 -28 L7 -34 L-7 -34 Z" fill={PINK} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
      <path d="M2 -34 L8 -46" stroke={LEAF} strokeWidth={4} strokeLinecap="round" />
      <circle cx={12} cy={-42} r={2.6} fill={BOBA} stroke={OUTLINE} strokeWidth={1.6} />
    </g>
  ),
  workFx: {
    emitter: { x: 194, y: 194 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.6,
    shapes: [pearlBit, teaDrop, leafBit],
  },
  meta: {
    nameZh: "啵茶鸟",
    elements: ["fire", "grass", "water"],
    family: "鸟禽",
    toolAnchor: { x: 192, y: 231 },
    nodeBudget: 205,
    lieNote: "长脖绕回背上蹲卧，像盖好的奶茶",
  },
};
