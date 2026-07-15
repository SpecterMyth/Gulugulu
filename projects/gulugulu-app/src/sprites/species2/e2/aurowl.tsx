// ---------------------------------------------------------------------------
// 极光鸮 aurowl — e2（electric+ice）· 鸟禽
// 剪影：圆滚雪鸮（头身一体大圆），眉羽=两道小极光（招牌），耳羽簇，
//       尾拖极光丝带。熬夜观星的学者。
// 睡姿（P3）：头埋进翅膀缩成一颗羽毛球。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { WingArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BODY = "#F4F8FB";
const DEEP = "#C7D3E0";
const AURORA_T = "#7FE3C8";
const AURORA_V = "#B99BE8";
const VOLT = "#FFD93B";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：极光丝带尾羽（左下拖出，双色） */}
      <g transform={place(84, 216, -18)}>
        <Part name="tail" origin="90% 20%">
          <path d="M0 0 Q-18 6 -26 20 Q-14 20 -6 12 Q-2 6 0 0 Z" fill={AURORA_T} opacity={0.9} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M2 4 Q-10 12 -12 24 Q-2 22 3 13 Q5 8 2 4 Z" fill={AURORA_V} opacity={0.9} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 头身一体大圆（雪鸮） */}
      <ellipse cx={128} cy={172} rx={56} ry={60} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 羽纹点 */}
      <g fill={DEEP} opacity={0.8}>
        <path d="M92 196 q5 -4 10 0 M116 206 q5 -4 10 0 M144 200 q5 -4 10 0 M160 186 q5 -4 10 0" stroke={DEEP} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      </g>
      {/* 翅膀 */}
      <g transform={place(78, 158, 10)}>
        <Part name="armL" origin="50% 8%">
          <WingArm color={DEEP} deep="#9FB0C4" len={32} mirror />
        </Part>
      </g>
      <g transform={place(178, 158, -10)}>
        <Part name="armR" origin="50% 8%">
          <WingArm color={DEEP} deep="#9FB0C4" len={32} />
        </Part>
      </g>
      {/* 鸟爪 */}
      <g transform={place(112, 232)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-6 0 L0 -3 L6 0 M0 -3 V1" stroke="#E39B00" strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      <g transform={place(144, 232)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-6 0 L0 -3 L6 0 M0 -3 V1" stroke="#E39B00" strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      {/* 心形脸盘 */}
      <path
        d="M128 196 Q94 188 92 152 Q92 128 108 124 Q122 121 128 132 Q134 121 148 124 Q164 128 164 152 Q162 188 128 196 Z"
        fill="#FFFFFF"
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      {/* 眉羽=两道小极光（招牌，双色叠） */}
      <g strokeLinecap="round" fill="none">
        <path d="M96 132 Q112 118 126 128" stroke={AURORA_T} strokeWidth={6} />
        <path d="M98 126 Q112 114 124 122" stroke={AURORA_V} strokeWidth={4} />
        <path d="M130 128 Q144 118 160 132" stroke={AURORA_T} strokeWidth={6} />
        <path d="M132 122 Q144 114 158 126" stroke={AURORA_V} strokeWidth={4} />
      </g>
      {/* 脸：大圆眼 + 小尖喙 */}
      <g className="part-face">
        <ExpFace cx1={110} cx2={146} cy={150} r={11} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path d="M123 166 L133 166 L128 175 Z" fill="#E39B00" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        <Blush cx1={100} cx2={156} cy={166} />
      </g>
      {/* 头顶：耳羽簇一对 + 小星（headtop 呼吸摇） */}
      <g transform={place(128, 116)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-26 4 Q-32 -10 -24 -18 Q-18 -8 -18 2 Z" fill={BODY} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M26 4 Q32 -10 24 -18 Q18 -8 18 2 Z" fill={BODY} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M0 -8 l1.8 3.6 l3.6 1.8 l-3.6 1.8 l-1.8 3.6 l-1.8 -3.6 l-3.6 -1.8 l3.6 -1.8 z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
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

/** 侧视（右向）：圆滚雪鸮摇摆走，喙朝前，极光眉扬起，丝带尾拖后。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：极光丝带（身后拖） */}
      <g transform={place(80, 202, -6)}>
        <Part name="tail" origin="90% 20%">
          <path d="M0 0 Q-18 6 -26 20 Q-14 20 -6 12 Q-2 6 0 0 Z" fill={AURORA_T} opacity={0.9} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M2 4 Q-10 12 -12 24 Q-2 22 3 13 Q5 8 2 4 Z" fill={AURORA_V} opacity={0.9} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 远侧翅 */}
      <g transform={place(100, 158, 14)}>
        <Part name="armL" origin="50% 8%">
          <WingArm color="#9FB0C4" deep={DEEP} len={30} mirror />
        </Part>
      </g>
      {/* 头身一体大圆 */}
      <ellipse cx={128} cy={174} rx={52} ry={58} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 羽纹点 */}
      <g stroke={DEEP} strokeWidth={2.6} fill="none" strokeLinecap="round" opacity={0.8}>
        <path d="M92 196 q5 -4 10 0 M112 208 q5 -4 10 0 M138 204 q5 -4 10 0" />
      </g>
      {/* 鸟爪（迈步） */}
      <g transform={place(114, 232)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-6 0 L0 -3 L6 0 M0 -3 V1" stroke="#E39B00" strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      <g transform={place(146, 232)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-6 0 L0 -3 L6 0 M0 -3 V1" stroke="#E39B00" strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      {/* 侧脸盘（白色前脸） */}
      <ellipse cx={148} cy={154} rx={29} ry={33} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={4.5} />
      {/* 眉羽=一道小极光（近侧） */}
      <g strokeLinecap="round" fill="none">
        <path d="M128 128 Q148 116 166 130" stroke={AURORA_T} strokeWidth={6} />
        <path d="M131 122 Q148 112 163 124" stroke={AURORA_V} strokeWidth={4} />
      </g>
      {/* 近侧翅（贴身摆） */}
      <g transform={place(150, 164, -16)}>
        <Part name="armR" origin="50% 8%">
          <WingArm color={DEEP} deep="#9FB0C4" len={32} />
        </Part>
      </g>
      {/* 脸：大圆眼 + 尖喙朝前 */}
      <g className="part-face">
        <ExpSideFace cx={152} cy={150} r={11} expression={expression} base={eyes} withMouth={false} />
        <path d="M168 162 L182 168 L168 174 Z" fill="#E39B00" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        <ellipse cx={140} cy={168} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：耳羽簇 + 小星 */}
      <g transform={place(132, 118)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-22 4 Q-28 -8 -21 -16 Q-15 -6 -15 3 Z" fill={BODY} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M20 2 Q26 -10 19 -18 Q13 -8 13 1 Z" fill={BODY} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M0 -10 l1.8 3.6 l3.6 1.8 l-3.6 1.8 l-1.8 3.6 l-1.8 -3.6 l-3.6 -1.8 l3.6 -1.8 z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：头埋进翅膀缩成一颗羽毛球，只露耳羽簇和极光眉，喙尖从翅缝探出。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：极光丝带（摊地） */}
      <g transform={place(80, 224, -28)}>
        <Part name="tail" origin="90% 20%">
          <path d="M0 0 Q-16 6 -23 18 Q-12 18 -5 11 Q-1 5 0 0 Z" fill={AURORA_T} opacity={0.9} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
          <path d="M2 4 Q-8 11 -10 21 Q-1 19 4 12 Q5 7 2 4 Z" fill={AURORA_V} opacity={0.9} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 羽毛球本体（缩成一团） */}
      <ellipse cx={128} cy={196} rx={52} ry={40} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 顶部羽纹 */}
      <g stroke={DEEP} strokeWidth={2.6} fill="none" strokeLinecap="round" opacity={0.8}>
        <path d="M100 176 q5 -4 10 0 M146 174 q5 -4 10 0 M124 166 q5 -4 10 0" />
      </g>
      {/* 鸟爪尖（球底微露） */}
      <g transform={place(116, 233)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-5 0 L0 -2 L5 0" stroke="#E39B00" strokeWidth={3.6} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      <g transform={place(142, 233)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-5 0 L0 -2 L5 0" stroke="#E39B00" strokeWidth={3.6} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      {/* 埋头睡颜（极光眉 + 闭眼，脸下半埋进翅膀） */}
      <g strokeLinecap="round" fill="none">
        <path d="M96 172 Q112 162 126 170" stroke={AURORA_T} strokeWidth={5} />
        <path d="M130 170 Q144 162 160 172" stroke={AURORA_T} strokeWidth={5} />
      </g>
      <g className="part-face">
        <ExpFace cx1={110} cx2={146} cy={184} r={9} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={98} cx2={158} cy={196} />
      </g>
      {/* 双翅裹到身前（把脸下半埋住） */}
      <g transform={place(86, 196, 52)}>
        <Part name="armL" origin="50% 8%">
          <WingArm color={DEEP} deep="#9FB0C4" len={34} mirror />
        </Part>
      </g>
      <g transform={place(170, 196, -52)}>
        <Part name="armR" origin="50% 8%">
          <WingArm color={DEEP} deep="#9FB0C4" len={34} />
        </Part>
      </g>
      {/* 喙尖从翅缝探出 */}
      <path d="M123 206 L133 206 L128 214 Z" fill="#E39B00" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
      {/* 头顶：耳羽簇（塌） + 小星 */}
      <g transform={place(128, 158)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-24 4 Q-30 -6 -23 -13 Q-17 -4 -17 4 Z" fill={BODY} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
          <path d="M24 4 Q30 -6 23 -13 Q17 -4 17 4 Z" fill={BODY} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
          <path d="M0 -6 l1.6 3.2 l3.2 1.6 l-3.2 1.6 l-1.6 3.2 l-1.6 -3.2 l-3.2 -1.6 l3.2 -1.6 z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round" />
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

const auroraRibbon: ParticleRenderer = () => (
  <path d="M-6 4 Q-2 -6 4 -4 Q8 -3 6 2 Q2 8 -4 7 Q-7 6 -6 4 Z" fill={AURORA_T} opacity={0.9} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
);
const snowStar: ParticleRenderer = () => (
  <g stroke="#B0E5F0" strokeWidth={2.2} strokeLinecap="round">
    <path d="M0 -6 V6 M-5 -3 L5 3 M-5 3 L5 -3" />
    <circle cx={0} cy={0} r={1.5} fill="#F7FCFD" stroke="none" />
  </g>
);
const starBit: ParticleRenderer = () => (
  <path d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.18,
    palette: { body: BODY, deep: DEEP, belly: "#FFFFFF", accent: AURORA_T, accent2: AURORA_V },
    foodAnchor: { x: 128, y: 172 },
    shadowRx: 56,
  },
  // 天文望远镜：三脚架 + 镜筒 + 星
  tool: () => (
    <g>
      <path d="M-10 0 L0 -14 L10 0 M0 -14 L0 -2" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" fill="none" />
      <g transform="translate(0 -20) rotate(-26)">
        <rect x={-14} y={-7} width={30} height={14} rx={5} fill="#5C7FB5" stroke={OUTLINE} strokeWidth={3.4} />
        <rect x={14} y={-5} width={7} height={10} rx={3} fill="#3E4356" stroke={OUTLINE} strokeWidth={2.6} />
        <path d="M-10 -3 h8" stroke="#9BDCFF" strokeWidth={2.2} strokeLinecap="round" />
      </g>
      <path d="M22 -38 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 208, y: 196 },
    baseAngle: -Math.PI / 2.5,
    cone: 0.55,
    shapes: [auroraRibbon, snowStar, starBit],
  },
  meta: {
    nameZh: "极光鸮",
    elements: ["electric", "ice"],
    family: "鸟禽",
    toolAnchor: { x: 192, y: 231 },
    nodeBudget: 165,
    lieNote: "头埋进翅膀缩成一颗羽毛球",
  },
};
