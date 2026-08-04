// ---------------------------------------------------------------------------
// 摇滚鸡 rockrooster — e3（electric+fire+normal）· 鸟禽
// 剪影：大红摇滚公鸡，鸡冠=跳动火焰（crest 摇摆），尾羽=三根闪电，
//       颈挂铆钉项圈（e3 装饰件）。嗓门大心肠软。
// 睡姿（P3）：抱着吉他瘫坐，鸡冠火苗打小呼。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { WingArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BODY = "#E2432E";
const DEEP = "#B32E17";
const CREAM = "#FFE8D6";
const FLAME = "#FFB03A";
const VOLT = "#FFD93B";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：三根闪电尾羽（左上方炸开，招牌） */}
      <g transform={place(88, 178, -10)}>
        <Part name="tail" origin="90% 90%">
          <g stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round">
            <path d="M0 0 L-16 -8 L-12 -14 L-30 -20 L-24 -27 L-14 -22 L-18 -16 L-2 -8 Z" fill={VOLT} />
            <path d="M0 -4 L-12 -18 L-6 -22 L-20 -38 L-12 -42 L-4 -30 L-10 -26 L4 -12 Z" fill={FLAME} />
            <path d="M2 -6 L-2 -24 L4 -26 L2 -44 L10 -44 L10 -28 L4 -27 L8 -10 Z" fill={VOLT} />
          </g>
        </Part>
      </g>
      {/* 身体（挺胸梨形） */}
      <path
        d="M92 220 Q86 168 110 148 Q128 134 146 148 Q170 168 164 220 Q128 236 92 220 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 奶油胸腹 */}
      <ellipse cx={128} cy={196} rx={26} ry={22} fill={CREAM} opacity={0.95} />
      {/* e3 装饰：铆钉项圈 */}
      <path d="M104 160 Q128 172 152 160 L152 168 Q128 180 104 168 Z" fill="#3E4356" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
      <g fill="#C8CCD8" stroke={OUTLINE} strokeWidth={1.6}>
        <circle cx={112} cy={166} r={2.4} />
        <circle cx={128} cy={169} r={2.4} />
        <circle cx={144} cy={166} r={2.4} />
      </g>
      {/* 翅膀 */}
      <g transform={place(92, 172, 12)}>
        <Part name="armL" origin="50% 8%">
          <WingArm color={DEEP} deep={OUTLINE} len={28} mirror />
        </Part>
      </g>
      <g transform={place(164, 172, -12)}>
        <Part name="armR" origin="50% 8%">
          <WingArm color={DEEP} deep={OUTLINE} len={28} />
        </Part>
      </g>
      {/* 鸟脚 */}
      <g transform={place(112, 231)}>
        <Part name="legL" origin="50% -30%">
          <path d="M0 -9 v7" stroke={FLAME} strokeWidth={5} strokeLinecap="round" />
          <path d="M-7 0 L0 -3 L7 0 M0 -3 V1" stroke={FLAME} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <path d="M0 -9 v7" stroke={FLAME} strokeWidth={5} strokeLinecap="round" />
          <path d="M-7 0 L0 -3 L7 0 M0 -3 V1" stroke={FLAME} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      {/* 脸：白脸区 + 尖喙 + 肉垂（大脸比例） */}
      <ellipse cx={128} cy={136} rx={37} ry={32} fill={CREAM} stroke={OUTLINE} strokeWidth={5} />
      <g className="part-face">
        <ExpFace cx1={111} cx2={145} cy={128} r={9.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path
          d={expression === "happy" || expression === "star" || expression === "surprised"
            ? "M119 144 L137 144 L128 156 Z"
            : "M120 144 L136 144 L128 152 Z"}
          fill={FLAME}
          stroke={OUTLINE}
          strokeWidth={3.4}
          strokeLinejoin="round"
        />
        <path d="M124 153 q4 8 8 0 q-1 8 -4 8 q-3 0 -4 -8 z" fill={BODY} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
        <Blush cx1={102} cx2={154} cy={142} />
      </g>
      {/* 鸡冠=跳动火焰（crest 装饰摇摆） */}
      <g transform={place(128, 102)}>
        <g className="part-crest">
          <path
            d="M-16 2 Q-22 -12 -12 -18 Q-10 -8 -6 -6 Q-10 -22 0 -28 Q4 -16 6 -10 Q8 -22 16 -22 Q20 -10 12 0 Q0 6 -16 2 Z"
            fill={FLAME}
            stroke={OUTLINE}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <path d="M-6 -4 Q-8 -14 -2 -18 Q2 -10 2 -4 Q-2 0 -6 -4 Z" fill={BODY} />
        </g>
      </g>
      {/* 头顶 Part（呆羽一小撮，保证 headtop 存在） */}
      <g transform={place(150, 106)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q6 -6 3 -13 Q-2 -8 -2 -2 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
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

/** 侧视（右向）：挺胸阔步，闪电尾羽向后炸开，尖喙朝前，鸡冠火焰迎风。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：三根闪电尾羽（身后炸开） */}
      <g transform={place(94, 186, 4)}>
        <Part name="tail" origin="90% 90%">
          <g stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round">
            <path d="M0 0 L-18 -4 L-14 -11 L-32 -14 L-27 -22 L-16 -18 L-19 -12 L-2 -7 Z" fill={VOLT} />
            <path d="M0 -6 L-14 -18 L-8 -23 L-24 -37 L-16 -42 L-7 -30 L-13 -25 L4 -13 Z" fill={FLAME} />
            <path d="M3 -8 L-1 -26 L5 -28 L3 -46 L11 -45 L10 -29 L5 -28 L9 -11 Z" fill={VOLT} />
          </g>
        </Part>
      </g>
      {/* 远侧翅（贴背） */}
      <g transform={place(112, 176, 12)}>
        <Part name="armL" origin="50% 8%">
          <WingArm color={DEEP} deep={OUTLINE} len={26} mirror />
        </Part>
      </g>
      {/* 身体（挺胸侧视） */}
      <path
        d="M98 220 Q88 174 112 152 Q130 138 150 154 Q168 172 160 220 Q128 234 98 220 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <ellipse cx={144} cy={196} rx={17} ry={17} fill={CREAM} opacity={0.95} />
      {/* 铆钉项圈（侧视） */}
      <path d="M118 154 Q140 166 158 152 L158 160 Q140 174 118 162 Z" fill="#3E4356" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <g fill="#C8CCD8" stroke={OUTLINE} strokeWidth={1.6}>
        <circle cx={130} cy={162} r={2.4} />
        <circle cx={148} cy={160} r={2.4} />
      </g>
      {/* 鸟脚（阔步） */}
      <g transform={place(116, 231)}>
        <Part name="legL" origin="50% -30%">
          <path d="M0 -9 v7" stroke={FLAME} strokeWidth={5} strokeLinecap="round" />
          <path d="M-6 0 L0 -3 L7 0 M0 -3 V1" stroke={FLAME} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <path d="M0 -9 v7" stroke={FLAME} strokeWidth={5} strokeLinecap="round" />
          <path d="M-6 0 L0 -3 L7 0 M0 -3 V1" stroke={FLAME} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      {/* 近侧翅（摆动） */}
      <g transform={place(134, 178, -10)}>
        <Part name="armR" origin="50% 8%">
          <WingArm color={DEEP} deep={OUTLINE} len={28} />
        </Part>
      </g>
      {/* 头（白脸侧视） */}
      <ellipse cx={146} cy={122} rx={33} ry={29} fill={CREAM} stroke={OUTLINE} strokeWidth={5} />
      {/* 脸：单眼 + 尖喙朝前 + 肉垂 */}
      <g className="part-face">
        <ExpSideFace cx={156} cy={116} r={9.5} expression={expression} base={eyes} withMouth={false} />
        <path
          d={expression === "happy" || expression === "star" || expression === "surprised"
            ? "M175 118 L193 125 L175 134 Z"
            : "M176 120 L192 126 L176 132 Z"}
          fill={FLAME}
          stroke={OUTLINE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <path d="M174 133 q4 7 8 0 q-1 8 -4 8 q-3 0 -4 -8 z" fill={BODY} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        <ellipse cx={142} cy={134} rx={7} ry={4.5} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 鸡冠火焰（迎风前倾） */}
      <g transform={place(140, 94)}>
        <g className="part-crest">
          <path
            d="M-14 2 Q-20 -10 -11 -16 Q-9 -7 -5 -5 Q-8 -20 2 -25 Q5 -14 7 -9 Q10 -20 17 -19 Q19 -8 11 1 Q0 6 -14 2 Z"
            fill={FLAME}
            stroke={OUTLINE}
            strokeWidth={4}
            strokeLinejoin="round"
          />
          <path d="M-4 -3 Q-6 -12 0 -16 Q4 -8 3 -3 Q0 1 -4 -3 Z" fill={BODY} />
        </g>
      </g>
      {/* 头顶：呆羽（脑后） */}
      <g transform={place(118, 100)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-7 -6 -4 -13 Q1 -8 1 -2 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：抱着电吉他瘫坐打盹，闪电尾羽摊地，脚丫朝天，鸡冠火苗缩小。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾羽摊在地上（左侧压低） */}
      <g transform={place(86, 224, -52)}>
        <Part name="tail" origin="90% 90%">
          <g stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round">
            <path d="M0 0 L-16 -6 L-12 -12 L-28 -17 L-23 -24 L-13 -20 L-16 -14 L-2 -7 Z" fill={VOLT} />
            <path d="M2 -4 L-10 -16 L-4 -21 L-18 -34 L-11 -38 L-3 -27 L-8 -22 L6 -11 Z" fill={FLAME} />
          </g>
        </Part>
      </g>
      {/* 身体（瘫坐圆墩，向左后靠） */}
      <path
        d="M92 224 Q80 188 100 166 Q120 146 146 158 Q168 170 166 200 Q164 224 142 231 Q112 238 92 224 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <ellipse cx={130} cy={202} rx={25} ry={19} fill={CREAM} opacity={0.95} />
      {/* 鸟脚（向前摊开，脚趾朝天） */}
      <g transform={place(110, 230, 68)}>
        <Part name="legL" origin="50% -30%">
          <path d="M0 -9 v7" stroke={FLAME} strokeWidth={5} strokeLinecap="round" />
          <path d="M-6 0 L0 -3 L6 0 M0 -3 V1" stroke={FLAME} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      <g transform={place(152, 230, -68)}>
        <Part name="legR" origin="50% -30%">
          <path d="M0 -9 v7" stroke={FLAME} strokeWidth={5} strokeLinecap="round" />
          <path d="M-6 0 L0 -3 L6 0 M0 -3 V1" stroke={FLAME} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      {/* 抱着的电吉他（琴颈朝右上探出，静态道具） */}
      <g transform="translate(148 202) rotate(18)">
        <path d="M-11 0 L11 0 L15 -11 L4 -13 L11 -22 L-7 -20 L-13 -9 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <path d="M2 -17 L8 -46" stroke="#8A6410" strokeWidth={5} strokeLinecap="round" />
        <rect x={4} y={-53} width={9} height={8} rx={2} fill="#3E4356" stroke={OUTLINE} strokeWidth={2.6} transform="rotate(10 8 -49)" />
        <circle cx={2} cy={-7} r={2.6} fill="#3E4356" stroke={OUTLINE} strokeWidth={1.6} />
      </g>
      {/* 翅膀搂住吉他 */}
      <g transform={place(106, 184, 34)}>
        <Part name="armL" origin="50% 8%">
          <WingArm color={DEEP} deep={OUTLINE} len={26} mirror />
        </Part>
      </g>
      <g transform={place(158, 188, -52)}>
        <Part name="armR" origin="50% 8%">
          <WingArm color={DEEP} deep={OUTLINE} len={28} />
        </Part>
      </g>
      {/* 头（歪向左肩打盹） */}
      <g transform="rotate(-12 116 140)">
        <ellipse cx={116} cy={140} rx={35} ry={30} fill={CREAM} stroke={OUTLINE} strokeWidth={5} />
      </g>
      <g className="part-face">
        <ExpFace cx1={100} cx2={132} cy={134} r={9} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path d="M108 148 L124 148 L116 156 Z" fill={FLAME} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        <path d="M112 156 q4 7 8 0 q-1 7 -4 7 q-3 0 -4 -7 z" fill={BODY} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        <Blush cx1={92} cx2={140} cy={146} />
      </g>
      {/* 鸡冠火苗（缩小蔫垂，打小呼） */}
      <g transform={place(106, 112)}>
        <g className="part-crest">
          <path
            d="M-10 2 Q-15 -7 -8 -12 Q-6 -5 -3 -4 Q-5 -14 3 -17 Q5 -8 6 -5 Q9 -12 13 -10 Q13 -3 7 2 Q-2 5 -10 2 Z"
            fill={FLAME}
            stroke={OUTLINE}
            strokeWidth={3.6}
            strokeLinejoin="round"
          />
        </g>
      </g>
      {/* 头顶：呆羽（贴伏） */}
      <g transform={place(134, 112)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q7 -4 5 -11 Q0 -7 -1 -2 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
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

// 摇滚现场产物：弹片 + 金属礼手势 + 崩断的琴弦
const guitarPick: ParticleRenderer = () => (
  <path d="M0 -6 Q7 -6 6 2 Q4.5 8 0 8 Q-4.5 8 -6 2 Q-7 -6 0 -6 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
);
const hornsHand: ParticleRenderer = () => (
  <g fill={CREAM} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
    <rect x={-6} y={-2} width={12} height={10} rx={3} />
    <rect x={-6} y={-10} width={3.6} height={9} rx={1.6} />
    <rect x={2.4} y={-10} width={3.6} height={9} rx={1.6} />
    <path d="M6 2 q3 -1 3 2 q0 2 -3 2" fill="none" />
  </g>
);
const brokenString: ParticleRenderer = () => (
  <path d="M-9 -6 Q-4 -4 -2 0 Q0 4 3 2 Q1 0 3 -1 M4 4 q3 2 6 1" fill="none" stroke="#C8CCD8" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.08,
    palette: { body: BODY, deep: DEEP, belly: CREAM, accent: FLAME, accent2: VOLT },
    foodAnchor: { x: 128, y: 150 },
    shadowRx: 54,
  },
  // 电吉他：闪电形琴身 + 琴颈 + 弦
  tool: () => (
    <g transform="rotate(-8)">
      <path d="M-10 0 L10 0 L14 -10 L4 -12 L10 -20 L-6 -18 L-12 -8 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
      <path d="M2 -16 L6 -44" stroke="#8A6410" strokeWidth={5} strokeLinecap="round" />
      <path d="M3 -16 L6.5 -42" stroke="#FFF1C9" strokeWidth={1.6} strokeLinecap="round" />
      <rect x={2} y={-50} width={9} height={8} rx={2} fill="#3E4356" stroke={OUTLINE} strokeWidth={2.6} transform="rotate(8 6 -46)" />
      <circle cx={2} cy={-7} r={2.6} fill="#3E4356" stroke={OUTLINE} strokeWidth={1.6} />
      <path d="M-6 -6 l8 -1" stroke={OUTLINE} strokeWidth={1.6} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 196, y: 196 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.65,
    shapes: [guitarPick, hornsHand, brokenString],
  },
  meta: {
    nameZh: "摇滚鸡",
    elements: ["electric", "fire", "normal"],
    family: "鸟禽",
    toolAnchor: { x: 190, y: 231 },
    nodeBudget: 170,
    lieNote: "抱着吉他瘫坐，鸡冠火苗打小呼",
  },
};
