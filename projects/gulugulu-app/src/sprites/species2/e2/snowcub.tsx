// ---------------------------------------------------------------------------
// 雪球熊 snowcub — e2（ice+normal）· 双足小人
// 剪影：站立圆雪球小白熊，星星围巾（招牌），软雪肚皮，圆手圆脚。
//       冷链快递实习生，干劲十足。
// 睡姿（P3）：抱着保温箱滑坐到地，像摊开的雪人。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm, StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const SNOW = "#F7FCFD";
const SNOW_DEEP = "#CFEFF6";
const SCARF = "#F5C542";
const SCARF_DEEP = "#E39B00";
const ICE = "#8FD8E8";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小圆雪球尾（左下探出） */}
      <g transform={place(82, 214)}>
        <Part name="tail" origin="100% 50%">
          <circle cx={-6} cy={0} r={9} fill={SNOW} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 身体（圆雪球） */}
      <circle cx={128} cy={188} r={44} fill={SNOW} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={128} cy={200} rx={26} ry={18} fill="#FFFFFF" stroke={SNOW_DEEP} strokeWidth={2.6} />
      {/* 小手（圆手套感） */}
      <g transform={place(88, 182, 24)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={SNOW} rx={7.5} ry={12} />
        </Part>
      </g>
      <g transform={place(168, 182, -24)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={SNOW} rx={7.5} ry={12} />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(110, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={SNOW} deep={SNOW_DEEP} rx={9} ry={5.5} lift={6} />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SNOW} deep={SNOW_DEEP} rx={9} ry={5.5} lift={6} />
        </Part>
      </g>
      {/* 星星围巾（招牌，垂一段在身前） */}
      <g>
        <path d="M96 150 Q128 164 160 150 L160 162 Q128 176 96 162 Z" fill={SCARF} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        <g transform="translate(148 162) rotate(8)">
          <path d="M-7 0 L7 0 L6 26 Q0 30 -6 26 Z" fill={SCARF} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M-5 26 v5 M0 27 v5 M5 26 v5" stroke={SCARF_DEEP} strokeWidth={2.4} strokeLinecap="round" />
        </g>
        <g fill="#FFFFFF" stroke={SCARF_DEEP} strokeWidth={1.6}>
          <path d="M110 155 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" />
          <path d="M134 158 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" />
        </g>
      </g>
      {/* 头（婴儿比例大头+小圆耳） */}
      <g fill={SNOW} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={95} cy={88} r={12} />
        <circle cx={161} cy={88} r={12} />
      </g>
      <circle cx={95} cy={88} r={5} fill={SNOW_DEEP} stroke="none" />
      <circle cx={161} cy={88} r={5} fill={SNOW_DEEP} stroke="none" />
      <circle cx={128} cy={116} r={41} fill={SNOW} stroke={OUTLINE} strokeWidth={6} />
      {/* 口鼻软雪区 */}
      <ellipse cx={128} cy={130} rx={19} ry={13} fill="#FFFFFF" stroke={SNOW_DEEP} strokeWidth={2.2} />
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={111} cx2={145} cy={108} r={9.5} mouthY={132} mouthW={11} expression={expression} base={eyes} />
        <ellipse cx={128} cy={125} rx={6} ry={4.5} fill="#3E4356" stroke={OUTLINE} strokeWidth={2.4} />
        <Blush cx1={101} cx2={155} cy={122} />
      </g>
      {/* 头顶：一撮呆雪毛（headtop 呼吸摇） */}
      <g transform={place(128, 76)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-4 2 Q-7 -6 -2 -11 Q1 -6 0 -2 Q3 -8 7 -8 Q7 -2 2 2 Z" fill={SNOW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
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

/** 侧视（右向）：圆雪球小熊迈步，口鼻朝前，围巾尾向后飘。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小雪球尾（身后） */}
      <g transform={place(86, 206)}>
        <Part name="tail" origin="100% 50%">
          <circle cx={-6} cy={0} r={9} fill={SNOW} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 远侧手 */}
      <g transform={place(106, 182, 20)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={SNOW_DEEP} rx={7} ry={11} />
        </Part>
      </g>
      {/* 身体（圆雪球） */}
      <circle cx={126} cy={190} r={42} fill={SNOW} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={140} cy={202} rx={22} ry={16} fill="#FFFFFF" stroke={SNOW_DEEP} strokeWidth={2.6} />
      {/* 围巾（颈圈 + 巾尾向后飘） */}
      <path d="M100 152 Q128 166 156 150 L156 162 Q128 178 100 164 Z" fill={SCARF} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <g transform="translate(102 158) rotate(118)">
        <path d="M-7 0 L7 0 L6 24 Q0 28 -6 24 Z" fill={SCARF} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        <path d="M-5 24 v5 M0 25 v5 M5 24 v5" stroke={SCARF_DEEP} strokeWidth={2.4} strokeLinecap="round" />
      </g>
      <path d="M124 158 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" fill="#FFFFFF" stroke={SCARF_DEEP} strokeWidth={1.6} />
      {/* 小脚（迈步） */}
      <g transform={place(112, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={SNOW} deep={SNOW_DEEP} rx={9} ry={5.5} lift={6} />
        </Part>
      </g>
      <g transform={place(144, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SNOW} deep={SNOW_DEEP} rx={9} ry={5.5} lift={6} />
        </Part>
      </g>
      {/* 近侧手（摆臂） */}
      <g transform={place(146, 182, -26)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={SNOW} rx={7.5} ry={12} />
        </Part>
      </g>
      {/* 头（大头前倾）+ 双耳 */}
      <g fill={SNOW} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={110} cy={88} r={11} />
        <circle cx={156} cy={82} r={11} />
      </g>
      <circle cx={110} cy={88} r={4.5} fill={SNOW_DEEP} stroke="none" />
      <circle cx={156} cy={82} r={4.5} fill={SNOW_DEEP} stroke="none" />
      <circle cx={138} cy={114} r={38} fill={SNOW} stroke={OUTLINE} strokeWidth={6} />
      {/* 口鼻（朝前） */}
      <ellipse cx={162} cy={128} rx={15} ry={11} fill="#FFFFFF" stroke={SNOW_DEEP} strokeWidth={2.2} />
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={148} cy={106} r={10} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={169} cy={121} rx={5.5} ry={4.2} fill="#3E4356" stroke={OUTLINE} strokeWidth={2.2} />
        <path d="M164 134 q5 4 10 0" fill="none" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
        <ellipse cx={136} cy={122} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：呆雪毛 */}
      <g transform={place(134, 76)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-4 2 Q-7 -6 -2 -11 Q1 -6 0 -2 Q3 -8 7 -8 Q7 -2 2 2 Z" fill={SNOW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：抱着保温箱滑坐到地摊成雪人，下巴搁箱顶，围巾尾摊在地上。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小雪球（右后） */}
      <g transform={place(192, 220)}>
        <Part name="tail" origin="0% 50%">
          <circle cx={5} cy={0} r={8.5} fill={SNOW} stroke={OUTLINE} strokeWidth={4.2} />
        </Part>
      </g>
      {/* 身体（滑坐摊开的雪墩） */}
      <path
        d="M76 226 Q72 200 96 192 Q128 184 160 192 Q184 200 180 226 Q128 238 76 226 Z"
        fill={SNOW}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 摊开的小脚（前伸外撇） */}
      <g transform={place(98, 230, 26)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={SNOW} deep={SNOW_DEEP} rx={8.5} ry={5} lift={4} />
        </Part>
      </g>
      <g transform={place(158, 230, -26)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SNOW} deep={SNOW_DEEP} rx={8.5} ry={5} lift={4} />
        </Part>
      </g>
      {/* 围巾（颈圈 + 巾尾摊地） */}
      <path d="M102 184 Q130 196 158 182 L158 194 Q130 208 102 196 Z" fill={SCARF} stroke={OUTLINE} strokeWidth={3.8} strokeLinejoin="round" />
      <g transform="translate(96 192) rotate(146)">
        <path d="M-6 0 L6 0 L5 22 Q0 26 -5 22 Z" fill={SCARF} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <path d="M-4 22 v4 M0 23 v4 M4 22 v4" stroke={SCARF_DEEP} strokeWidth={2.2} strokeLinecap="round" />
      </g>
      {/* 保温箱（抱在怀里） */}
      <g transform="translate(128 202) rotate(-4)">
        <rect x={-17} y={-15} width={34} height={30} rx={4} fill={ICE} stroke={OUTLINE} strokeWidth={3.6} />
        <path d="M-17 -7 h34" stroke={OUTLINE} strokeWidth={2.4} />
        <g stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round">
          <path d="M0 -1 V7 M-3.5 1 L3.5 5 M-3.5 5 L3.5 1" />
        </g>
        <rect x={6} y={-4} width={8} height={11} rx={1.5} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={1.8} transform="rotate(8 10 2)" />
      </g>
      {/* 双手环抱箱子 */}
      <g transform={place(102, 194, 42)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={SNOW} rx={7} ry={11.5} />
        </Part>
      </g>
      <g transform={place(154, 194, -42)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={SNOW} rx={7} ry={11.5} />
        </Part>
      </g>
      {/* 头（下巴搁在箱顶打盹）+ 双耳 */}
      <g fill={SNOW} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={100} cy={130} r={11} />
        <circle cx={160} cy={128} r={11} />
      </g>
      <circle cx={100} cy={130} r={4.5} fill={SNOW_DEEP} stroke="none" />
      <circle cx={160} cy={128} r={4.5} fill={SNOW_DEEP} stroke="none" />
      <circle cx={130} cy={154} r={37} fill={SNOW} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={130} cy={170} rx={17} ry={11} fill="#FFFFFF" stroke={SNOW_DEEP} strokeWidth={2.2} />
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={114} cx2={146} cy={148} r={9} mouthY={172} mouthW={10} expression={expression} base={eyes} />
        <ellipse cx={130} cy={165} rx={5.5} ry={4} fill="#3E4356" stroke={OUTLINE} strokeWidth={2.2} />
        <Blush cx1={104} cx2={156} cy={162} />
      </g>
      {/* 头顶：呆雪毛（塌） */}
      <g transform={place(130, 116, 12)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-4 2 Q-7 -5 -2 -10 Q1 -5 0 -2 Q3 -7 6 -7 Q6 -2 2 2 Z" fill={SNOW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
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

const snowball: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={5.5} fill={SNOW} stroke={OUTLINE} strokeWidth={2} />
    <path d="M-2 -1 q2 -2 4 0" fill="none" stroke={SNOW_DEEP} strokeWidth={1.6} strokeLinecap="round" />
  </g>
);
const boxBit: ParticleRenderer = () => (
  <g>
    <rect x={-6} y={-5.5} width={12} height={11} rx={1.6} fill="#C9A86A" stroke={OUTLINE} strokeWidth={2} />
    <path d="M-6 -1 h12 M0 -5.5 v11" stroke="#8A6410" strokeWidth={1.4} />
  </g>
);
const starBit: ParticleRenderer = () => (
  <path d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill={SCARF} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.06,
    palette: { body: SNOW, deep: SNOW_DEEP, belly: "#FFFFFF", accent: SCARF, accent2: ICE },
    foodAnchor: { x: 128, y: 132 },
    shadowRx: 52,
  },
  // 快递保温箱：冷链箱 + 雪花标 + 提手 + 单据
  tool: () => (
    <g>
      <rect x={-16} y={-28} width={32} height={28} rx={4} fill={ICE} stroke={OUTLINE} strokeWidth={3.6} />
      <path d="M-16 -20 h32" stroke={OUTLINE} strokeWidth={2.4} />
      <path d="M-6 -28 Q-6 -36 0 -36 Q6 -36 6 -28" fill="none" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" />
      <g stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round">
        <path d="M0 -14 V-6 M-3.5 -12 L3.5 -8 M-3.5 -8 L3.5 -12" />
      </g>
      <rect x={5} y={-18} width={9} height={12} rx={1.5} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={2} transform="rotate(8 9 -12)" />
    </g>
  ),
  workFx: {
    emitter: { x: 190, y: 202 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.6,
    shapes: [snowball, boxBit, starBit],
  },
  meta: {
    nameZh: "雪球熊",
    elements: ["ice", "normal"],
    family: "双足小人",
    toolAnchor: { x: 190, y: 231 },
    nodeBudget: 165,
    lieNote: "抱着保温箱滑坐到地，像摊开的雪人",
  },
};
