// ---------------------------------------------------------------------------
// 掌勺猪 porkchef — e4（fire+grass+normal+water）· 团状软体
// 剪影：圆成汤圆的小猪，歪戴厨师帽（招牌），四色酱渍围裙，卷卷尾，
//       食材轨道环绕（e4 环绕件 orbit）。农家乐大厨，尝菜比做菜多。
// 睡姿（P3）：圆滚侧躺，呼噜冒蒸汽圈。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm, StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const PIG = "#F5B8C0";
const PIG_DEEP = "#E890A0";
const CREAM = "#FFF0F0";
const APRON = "#FFF6CE";
const FIRE = "#E85D3A";
const LEAF = "#8CD97B";
const SEA = "#9BDCFF";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e4 环绕件：食材轨道（胡萝卜/香菇/豌豆/水滴，part-orbit 慢转） */}
      <g transform={place(128, 176)}>
        <g className="part-orbit">
          <g stroke={OUTLINE} strokeWidth={2}>
            <g transform="translate(-62 0) rotate(24)">
              <path d="M-2 -6 L2 -6 L1 4 Q0 6 -1 4 Z" fill="#F5A83B" />
              <path d="M-1 -8 q1 -2 2 0" stroke={LEAF} strokeWidth={1.8} fill="none" />
            </g>
            <g transform="translate(62 0)">
              <path d="M-5 -2 Q-5 -7 0 -7 Q5 -7 5 -2 Z" fill="#B98A4E" />
              <path d="M-1.5 -2 L-1.5 3 Q0 4 1.5 3 L1.5 -2 Z" fill="#FFF4DC" />
            </g>
            <circle cx={0} cy={-20} r={4} fill={LEAF} />
            <path d="M-3 17 q3 -3 6 0 a4.5 4.5 0 0 1 -6 0 z" fill={SEA} transform="translate(0 3)" />
          </g>
        </g>
      </g>
      {/* 卷卷尾（招牌螺旋小尾，右下探出） */}
      <g transform={place(176, 208)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 0 Q10 -2 12 -9 Q13 -15 8 -15 Q4 -15 5 -11 Q6 -8 9 -9" fill="none" stroke={PIG_DEEP} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 汤圆身（头身一体大圆） */}
      <circle cx={128} cy={174} r={56} fill={PIG} stroke={OUTLINE} strokeWidth={6} />
      {/* 四色酱渍围裙 */}
      <path d="M92 186 Q128 172 164 186 L160 218 Q128 230 96 218 Z" fill={APRON} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M100 190 L104 186 M152 190 L156 186" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
      <g opacity={0.9}>
        <circle cx={112} cy={200} r={3.4} fill={FIRE} />
        <circle cx={128} cy={208} r={3} fill={LEAF} />
        <circle cx={144} cy={200} r={3.2} fill={SEA} />
        <circle cx={136} cy={216} r={2.6} fill="#8A5A3B" />
      </g>
      {/* 小手小脚 */}
      <g transform={place(80, 188, 26)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={PIG} rx={7} ry={10.5} />
        </Part>
      </g>
      <g transform={place(176, 188, -26)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={PIG} rx={7} ry={10.5} />
        </Part>
      </g>
      <g transform={place(110, 232)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={PIG} deep={PIG_DEEP} rx={8.5} ry={5} lift={4} />
        </Part>
      </g>
      <g transform={place(146, 232)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={PIG} deep={PIG_DEEP} rx={8.5} ry={5} lift={4} />
        </Part>
      </g>
      {/* 小尖耳 */}
      <g fill={PIG} stroke={OUTLINE} strokeWidth={4.5}>
        <path d="M92 140 Q88 124 100 120 Q108 130 104 142 Z" />
        <path d="M164 140 Q168 124 156 120 Q148 130 152 142 Z" />
      </g>
      {/* 脸：猪鼻豚吻 */}
      <g className="part-face">
        <ExpFace cx1={110} cx2={146} cy={152} r={9.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={128} cy={168} rx={13} ry={9.5} fill={PIG_DEEP} stroke={OUTLINE} strokeWidth={3.6} />
        <g fill={OUTLINE}>
          <ellipse cx={123} cy={168} rx={2} ry={3} />
          <ellipse cx={133} cy={168} rx={2} ry={3} />
        </g>
        <Blush cx1={98} cx2={158} cy={164} />
      </g>
      {/* 头顶：歪戴厨师帽（招牌，headtop 呼吸摇） */}
      <g transform={place(122, 122)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(-12)">
            <path d="M-18 0 L18 0 L16 -10 L-16 -10 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
            <path d="M-16 -10 Q-24 -14 -20 -22 Q-16 -28 -8 -25 Q-6 -32 2 -31 Q10 -32 12 -25 Q20 -27 22 -20 Q24 -13 16 -10 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
            <path d="M-8 -4 h16" stroke="#E3E7F0" strokeWidth={2.2} strokeLinecap="round" />
          </g>
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(194, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：汤圆猪颠颠小跑，豚吻朝前，厨师帽前倾，卷尾在后。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 食材轨道（随行） */}
      <g transform={place(128, 176)}>
        <g className="part-orbit">
          <g stroke={OUTLINE} strokeWidth={2}>
            <g transform="translate(-58 0) rotate(24)">
              <path d="M-2 -6 L2 -6 L1 4 Q0 6 -1 4 Z" fill="#F5A83B" />
            </g>
            <g transform="translate(58 0)">
              <path d="M-5 -2 Q-5 -7 0 -7 Q5 -7 5 -2 Z" fill="#B98A4E" />
              <path d="M-1.5 -2 L-1.5 3 Q0 4 1.5 3 L1.5 -2 Z" fill="#FFF4DC" />
            </g>
            <circle cx={0} cy={-19} r={4} fill={LEAF} />
          </g>
        </g>
      </g>
      {/* 卷卷尾（身后） */}
      <g transform={place(78, 200)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-10 -2 -12 -9 Q-13 -15 -8 -15 Q-4 -15 -5 -11 Q-6 -8 -9 -9" fill="none" stroke={PIG_DEEP} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 远侧手 */}
      <g transform={place(92, 190, 22)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={PIG_DEEP} rx={6.5} ry={10} />
        </Part>
      </g>
      {/* 汤圆身（前倾小跑） */}
      <circle cx={128} cy={176} r={54} fill={PIG} stroke={OUTLINE} strokeWidth={6} />
      {/* 酱渍围裙（前襟） */}
      <path d="M100 190 Q134 176 166 190 L160 220 Q130 230 102 220 Z" fill={APRON} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <g opacity={0.9}>
        <circle cx={118} cy={202} r={3.2} fill={FIRE} />
        <circle cx={134} cy={210} r={3} fill={LEAF} />
        <circle cx={148} cy={202} r={3} fill={SEA} />
      </g>
      {/* 小脚（迈步） */}
      <g transform={place(112, 232)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={PIG} deep={PIG_DEEP} rx={8.5} ry={5} lift={5} />
        </Part>
      </g>
      <g transform={place(146, 232)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={PIG} deep={PIG_DEEP} rx={8.5} ry={5} lift={5} />
        </Part>
      </g>
      {/* 近侧手（摆臂） */}
      <g transform={place(162, 186, -28)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={PIG} rx={7} ry={10.5} />
        </Part>
      </g>
      {/* 小尖耳（前后两只） */}
      <g fill={PIG} stroke={OUTLINE} strokeWidth={4.5}>
        <path d="M110 130 Q104 114 116 110 Q124 120 120 132 Z" />
        <path d="M154 124 Q158 108 146 106 Q138 116 142 128 Z" />
      </g>
      {/* 脸（侧脸 + 豚吻朝前） */}
      <g className="part-face">
        <ExpSideFace cx={156} cy={148} r={9.5} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={177} cy={162} rx={9.5} ry={8} fill={PIG_DEEP} stroke={OUTLINE} strokeWidth={3.4} />
        <g fill={OUTLINE}>
          <ellipse cx={174} cy={162} rx={1.8} ry={2.6} />
          <ellipse cx={181} cy={162} rx={1.8} ry={2.6} />
        </g>
        <path d="M166 176 q6 4 12 0" fill="none" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
        <ellipse cx={144} cy={164} rx={7} ry={4.5} fill="#E890A0" opacity={0.7} />
      </g>
      {/* 头顶：厨师帽（前倾歪戴） */}
      <g transform={place(128, 122, 6)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(-10)">
            <path d="M-18 0 L18 0 L16 -10 L-16 -10 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
            <path d="M-16 -10 Q-24 -14 -20 -22 Q-16 -28 -8 -25 Q-6 -32 2 -31 Q10 -32 12 -25 Q20 -27 22 -20 Q24 -13 16 -10 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
            <path d="M-8 -4 h16" stroke="#E3E7F0" strokeWidth={2.2} strokeLinecap="round" />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：圆滚侧躺，鼻孔冒蒸汽圈打呼噜，厨师帽落在头旁。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 落地的厨师帽（头旁） */}
      <g transform="translate(50 214) rotate(-24)">
        <path d="M-14 0 L14 0 L12 -8 L-12 -8 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        <path d="M-12 -8 Q-19 -12 -15 -18 Q-11 -23 -5 -20 Q-4 -26 2 -25 Q9 -26 10 -20 Q16 -21 17 -15 Q18 -10 12 -8 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      </g>
      {/* 卷卷尾（翘在上后方） */}
      <g transform={place(188, 176)}>
        <Part name="tail" origin="0% 100%">
          <path d="M0 0 Q10 -4 12 -11 Q13 -17 8 -17 Q4 -17 5 -13 Q6 -10 9 -11" fill="none" stroke={PIG_DEEP} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 汤圆身（侧躺压扁） */}
      <ellipse cx={132} cy={198} rx={56} ry={38} fill={PIG} stroke={OUTLINE} strokeWidth={6} />
      {/* 围裙（跟着侧过来） */}
      <path d="M108 216 Q140 202 172 212 L166 230 Q136 238 112 230 Z" fill={APRON} stroke={OUTLINE} strokeWidth={3.8} strokeLinejoin="round" />
      <g opacity={0.9}>
        <circle cx={128} cy={222} r={3} fill={FIRE} />
        <circle cx={148} cy={222} r={2.8} fill={SEA} />
      </g>
      {/* 小尖耳（侧躺一高一低） */}
      <g fill={PIG} stroke={OUTLINE} strokeWidth={4.5}>
        <path d="M84 168 Q76 154 88 148 Q98 156 94 170 Z" />
        <path d="M124 152 Q124 134 112 134 Q106 146 112 156 Z" />
      </g>
      {/* 小手（一只垫头一只搭肚） */}
      <g transform={place(84, 212, 44)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={PIG} rx={6.5} ry={10} />
        </Part>
      </g>
      <g transform={place(142, 208, -74)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={PIG} rx={6.5} ry={10} />
        </Part>
      </g>
      {/* 小脚（叠着伸向右） */}
      <g transform={place(178, 216, -64)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={PIG} deep={PIG_DEEP} rx={8} ry={4.5} lift={3} />
        </Part>
      </g>
      <g transform={place(186, 228, -74)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={PIG} deep={PIG_DEEP} rx={8} ry={4.5} lift={3} />
        </Part>
      </g>
      {/* 脸（侧躺睡颜，豚吻朝左上） */}
      <g className="part-face">
        <ExpFace cx1={96} cx2={126} cy={178} r={9} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={108} cy={194} rx={12} ry={9} fill={PIG_DEEP} stroke={OUTLINE} strokeWidth={3.4} />
        <g fill={OUTLINE}>
          <ellipse cx={104} cy={194} rx={1.8} ry={2.8} />
          <ellipse cx={113} cy={194} rx={1.8} ry={2.8} />
        </g>
        <Blush cx1={88} cx2={132} cy={192} />
      </g>
      {/* 头顶：呼噜蒸汽圈（从鼻孔冒起） */}
      <g transform={place(96, 168)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" strokeLinecap="round">
            <circle cx={-4} cy={-6} r={5} stroke="#9BDCFF" strokeWidth={2.6} opacity={0.85} />
            <circle cx={-12} cy={-20} r={7} stroke="#B0E5F0" strokeWidth={2.8} opacity={0.75} />
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

const carrotBit: ParticleRenderer = () => (
  <g>
    <path d="M-2.5 -6 L2.5 -6 L1.4 5 Q0 7 -1.4 5 Z" fill="#F5A83B" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M-1.4 -8 q1.4 -2.4 2.8 0" stroke={LEAF} strokeWidth={1.8} fill="none" strokeLinecap="round" />
  </g>
);
// 高汤飞溅：主液滴 + 甩出的两小滴
const brothSplash: ParticleRenderer = () => (
  <g>
    <path d="M0 -7 q4.5 6 4.5 9.5 a4.5 4.5 0 0 1 -9 0 q0 -3.5 4.5 -9.5 z" fill="#F0C067" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <circle cx={-1.4} cy={2} r={1.2} fill="#FFF1C9" />
    <circle cx={6} cy={-2} r={1.8} fill="#F0C067" stroke={OUTLINE} strokeWidth={1.6} />
    <circle cx={-6} cy={-1} r={1.4} fill="#F0C067" stroke={OUTLINE} strokeWidth={1.6} />
  </g>
);
// 小木勺
const woodenLadle: ParticleRenderer = () => (
  <g transform="rotate(-24)">
    <path d="M0 -9 L0 3" stroke="#B98A4E" strokeWidth={3} strokeLinecap="round" />
    <path d="M-6 3 Q-6 10 0 10 Q6 10 6 3 Z" fill="#C79A5B" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M-5 3 Q0 6 5 3" fill="none" stroke={OUTLINE} strokeWidth={1.4} opacity={0.5} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.15,
    palette: { body: PIG, deep: PIG_DEEP, belly: CREAM, accent: FIRE, accent2: LEAF },
    foodAnchor: { x: 128, y: 172 },
    shadowRx: 58,
  },
  // 大汤勺：深汤勺 + 舀着一勺汤和豌豆
  tool: () => (
    <g>
      <path d="M-2.6 0 L2.6 0 L2 -30 L-2 -30 Z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <circle cx={0} cy={-33} r={2.6} fill="#5C6172" stroke={OUTLINE} strokeWidth={1.8} />
      <path d="M-14 -40 Q-14 -30 0 -30 Q14 -30 14 -40 Z" fill="#C8CCD8" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <path d="M-11 -40 Q0 -36 11 -40 Z" fill="#E2C08A" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={-4} cy={-39} r={1.8} fill={LEAF} />
      <circle cx={4} cy={-38.5} r={1.8} fill="#F5A83B" />
      <path d="M-4 -46 q-2 -4 1 -7 M4 -46 q2 -4 -1 -7" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 194, y: 192 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.6,
    shapes: [carrotBit, brothSplash, woodenLadle],
  },
  meta: {
    nameZh: "掌勺猪",
    elements: ["fire", "grass", "normal", "water"],
    family: "团状软体",
    toolAnchor: { x: 194, y: 231 },
    nodeBudget: 255,
    lieNote: "圆滚侧躺，呼噜冒蒸汽圈",
  },
};
