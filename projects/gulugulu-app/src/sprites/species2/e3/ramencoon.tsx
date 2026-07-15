// ---------------------------------------------------------------------------
// 拉面熊 ramencoon — e3（fire+normal+water）· 四足兽
// 剪影：小浣熊，头顶冒热气的拉面碗帽（招牌），眼罩纹，
//       叉烧卷纹环尾盘在体侧。深夜食堂主厨。
// 睡姿（P3）：抱碗趴睡碗当枕头，尾巴盖脸。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const FUR = "#9C8B7A";
const MASK = "#5C5248";
const CREAM = "#F2E7D5";
const BOWL = "#E2432E";
const NOODLE = "#FFF6CE";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 叉烧卷纹环尾（招牌：右侧大盘尾，螺旋圈） */}
      <g transform={place(176, 200)}>
        <Part name="tail" origin="20% 80%">
          <circle cx={12} cy={-8} r={22} fill={FUR} stroke={OUTLINE} strokeWidth={5} />
          <path d="M12 -26 A18 18 0 1 1 -5 -6 A12 12 0 1 0 12 -16 A6 6 0 1 1 8 -8" fill="none" stroke={MASK} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 身体（圆墩四足） */}
      <ellipse cx={124} cy={192} rx={48} ry={36} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={124} cy={204} rx={28} ry={17} fill={CREAM} opacity={0.95} />
      {/* 小手 */}
      <g transform={place(84, 200, 22)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6.5} ry={10} fill={MASK} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={place(164, 200, -22)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6.5} ry={10} fill={MASK} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(104, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={FUR} deep={MASK} rx={8.5} ry={5} lift={6} />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={FUR} deep={MASK} rx={8.5} ry={5} lift={6} />
        </Part>
      </g>
      {/* 头（婴儿比例大头 + 尖耳） */}
      <g fill={FUR} stroke={OUTLINE} strokeWidth={4.5}>
        <path d="M82 114 Q78 92 94 88 Q104 100 102 114 Z" />
        <path d="M170 114 Q174 92 158 88 Q148 100 150 114 Z" />
      </g>
      <ellipse cx={126} cy={134} rx={48} ry={39} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 浣熊眼罩纹（招牌纹） */}
      <path d="M86 124 Q104 114 118 126 Q112 144 96 142 Q84 136 86 124 Z" fill={MASK} opacity={0.9} />
      <path d="M166 124 Q148 114 134 126 Q140 144 156 142 Q168 136 166 124 Z" fill={MASK} opacity={0.9} />
      {/* 奶油口鼻 */}
      <ellipse cx={126} cy={152} rx={20} ry={13} fill={CREAM} />
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={104} cx2={148} cy={130} r={10} mouthY={155} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={126} cy={146} rx={6} ry={4.5} fill={OUTLINE} />
        <Blush cx1={92} cx2={160} cy={146} />
      </g>
      {/* 头顶：拉面碗帽（红碗白云纹 + 面条垂边 + 蒸汽 + 鱼板，headtop 呼吸摇） */}
      <g transform={place(126, 100)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-28 2 L28 2 L22 -18 L-22 -18 Z" fill={BOWL} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
          <path d="M-18 -6 q4 -5 9 0 q4 -5 9 0 q4 -5 9 0" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
          {/* 碗口面条 + 垂下一缕 */}
          <path d="M-22 -18 Q0 -26 22 -18" fill="none" stroke={NOODLE} strokeWidth={5} strokeLinecap="round" />
          <path d="M18 -16 Q24 -6 20 4 Q18 8 15 6" fill="none" stroke={NOODLE} strokeWidth={3.4} strokeLinecap="round" />
          {/* 鱼板 + 蒸汽 */}
          <circle cx={-6} cy={-22} r={5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.4} />
          <path d="M-8.5 -23 A3.4 3.4 0 0 1 -3 -21" fill="none" stroke="#F5A8C6" strokeWidth={2} strokeLinecap="round" />
          <path d="M-14 -28 q-2 -5 1 -9 M8 -28 q3 -5 0 -9" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" opacity={0.95} />
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

/** 侧视（右向）：小浣熊迈步，碗帽随行冒热气，卷纹环尾竖在身后。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 叉烧卷纹环尾（身后竖起） */}
      <g transform={place(78, 192)}>
        <Part name="tail" origin="80% 80%">
          <circle cx={-10} cy={-8} r={21} fill={FUR} stroke={OUTLINE} strokeWidth={5} />
          <path d="M-10 -25 A17 17 0 1 0 6 -6 A11 11 0 1 1 -10 -15 A5.5 5.5 0 1 0 -6 -8" fill="none" stroke={MASK} strokeWidth={4.2} strokeLinecap="round" />
        </Part>
      </g>
      {/* 远侧手脚 */}
      <g transform={place(112, 214, 12)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={9} fill={MASK} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(100, 230)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={MASK} deep={MASK} rx={8} ry={5} lift={6} />
        </Part>
      </g>
      {/* 身体（圆墩前倾） */}
      <ellipse cx={120} cy={194} rx={44} ry={34} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={132} cy={206} rx={22} ry={14} fill={CREAM} opacity={0.95} />
      {/* 近侧手脚（迈步） */}
      <g transform={place(140, 210, -16)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6.5} ry={10} fill={MASK} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={place(134, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={FUR} deep={MASK} rx={8.5} ry={5} lift={6} />
        </Part>
      </g>
      {/* 头（大头前伸 + 双尖耳） */}
      <g fill={FUR} stroke={OUTLINE} strokeWidth={4.5}>
        <path d="M112 102 Q106 82 122 78 Q132 90 130 104 Z" />
        <path d="M162 96 Q166 76 150 74 Q142 86 146 98 Z" />
      </g>
      <ellipse cx={148} cy={132} rx={42} ry={36} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 眼罩纹（近侧单片） */}
      <path d="M138 118 Q158 108 174 122 Q168 140 150 138 Q138 132 138 118 Z" fill={MASK} opacity={0.9} />
      {/* 口鼻（朝前） */}
      <ellipse cx={176} cy={148} rx={16} ry={11} fill={CREAM} />
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={158} cy={126} r={10} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={184} cy={142} rx={5.5} ry={4.2} fill={OUTLINE} />
        <path d="M178 156 q6 4 12 -1" fill="none" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
        <ellipse cx={144} cy={146} rx={7} ry={4.5} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 头顶：拉面碗帽（随行冒热气） */}
      <g transform={place(146, 98, 4)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-26 2 L26 2 L20 -17 L-20 -17 Z" fill={BOWL} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
          <path d="M-16 -6 q4 -5 8 0 q4 -5 8 0 q4 -5 8 0" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
          <path d="M-20 -17 Q0 -25 20 -17" fill="none" stroke={NOODLE} strokeWidth={5} strokeLinecap="round" />
          <path d="M17 -15 Q23 -5 19 5 Q17 9 14 7" fill="none" stroke={NOODLE} strokeWidth={3.2} strokeLinecap="round" />
          <circle cx={-6} cy={-21} r={4.5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.2} />
          <path d="M-8.2 -22 A3 3 0 0 1 -3.4 -20.4" fill="none" stroke="#F5A8C6" strokeWidth={1.8} strokeLinecap="round" />
          <path d="M-13 -26 q-2 -5 1 -8 M7 -26 q3 -5 0 -8" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" opacity={0.95} />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：碗帽摘下来当枕头抱着趴睡，卷纹环尾卷上来盖住半边脸。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 枕头碗（摘下的拉面碗 + 余温热气） */}
      <g transform="translate(88 214)">
        <path d="M-28 12 L28 12 L22 -8 L-22 -8 Z" fill={BOWL} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        <path d="M-17 3 q4 -5 8.5 0 q4 -5 8.5 0 q4 -5 8.5 0" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
        <path d="M-22 -8 Q0 -15 22 -8" fill="none" stroke={NOODLE} strokeWidth={4.5} strokeLinecap="round" />
        <circle cx={7} cy={-11} r={4.2} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.2} />
        <path d="M4.8 -12 A2.8 2.8 0 0 1 9.2 -10.6" fill="none" stroke="#F5A8C6" strokeWidth={1.8} strokeLinecap="round" />
        <path d="M-10 -16 q-2 -5 1 -8" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" opacity={0.95} />
      </g>
      {/* 身体（趴伏） */}
      <ellipse cx={150} cy={210} rx={46} ry={22} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 后腿收拢（微露） */}
      <g transform={place(178, 228)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={MASK} deep={MASK} rx={7.5} ry={4.5} lift={3} />
        </Part>
      </g>
      <g transform={place(192, 222)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={FUR} deep={MASK} rx={7.5} ry={4.5} lift={3} />
        </Part>
      </g>
      {/* 头（枕在碗沿）+ 双尖耳 */}
      <g fill={FUR} stroke={OUTLINE} strokeWidth={4.5}>
        <path d="M78 158 Q72 138 88 134 Q98 146 96 160 Z" />
        <path d="M130 154 Q136 134 120 132 Q110 144 114 156 Z" />
      </g>
      <ellipse cx={102} cy={182} rx={36} ry={30} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 眼罩纹 + 口鼻 */}
      <path d="M70 174 Q84 166 96 174 Q92 188 78 186 Q70 182 70 174 Z" fill={MASK} opacity={0.9} />
      <path d="M134 172 Q120 164 108 172 Q112 186 126 184 Q134 180 134 172 Z" fill={MASK} opacity={0.9} />
      <ellipse cx={102} cy={196} rx={15} ry={10} fill={CREAM} />
      {/* 小手抱碗 */}
      <g transform={place(80, 208, 28)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={9} fill={MASK} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(120, 212, -24)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={9} fill={MASK} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={86} cx2={118} cy={174} r={8.5} mouthY={198} mouthW={10} expression={expression} base={eyes} />
        <ellipse cx={102} cy={191} rx={5} ry={4} fill={OUTLINE} />
        <Blush cx1={76} cx2={128} cy={190} />
      </g>
      {/* 卷纹环尾（卷上来盖住半边脸） */}
      <g transform={place(64, 172)}>
        <Part name="tail" origin="80% 100%">
          <circle cx={4} cy={8} r={19} fill={FUR} stroke={OUTLINE} strokeWidth={4.5} />
          <path d="M4 -7 A15 15 0 1 0 18 10 A10 10 0 1 1 4 2 A5 5 0 1 0 7 8" fill="none" stroke={MASK} strokeWidth={3.8} strokeLinecap="round" />
        </Part>
      </g>
      {/* 头顶：睡塌的呆毛耳发 */}
      <g transform={place(104, 150, 8)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-3 2 Q-6 -5 -1 -9 Q2 -5 1 -1 Q4 -6 7 -5 Q6 0 2 2 Z" fill={FUR} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
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

const noodleBit: ParticleRenderer = () => (
  <path d="M-6 -4 Q0 -8 3 -3 Q6 2 1 4 Q-4 6 -5 2" fill="none" stroke={NOODLE} strokeWidth={3.2} strokeLinecap="round" />
);
const soupDrop: ParticleRenderer = () => (
  <path d="M0 -6 q5 5.5 5 9 a5 5 0 0 1 -10 0 q0 -3.5 5 -9 z" fill="#E2C08A" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);
const narutoBit: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2} />
    <path d="M-2.6 -1 A2.8 2.8 0 0 1 2.2 0.6" fill="none" stroke="#F5A8C6" strokeWidth={1.8} strokeLinecap="round" />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.06,
    palette: { body: FUR, deep: MASK, belly: CREAM, accent: BOWL, accent2: NOODLE },
    foodAnchor: { x: 126, y: 155 },
    shadowRx: 56,
  },
  // 拉面竹笊篱：竹柄网勺 + 挑起的面条
  tool: () => (
    <g>
      <path d="M-2.2 0 L2.2 0 L4 -26 L0 -26 Z" fill="#B98A4E" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
      <g transform="translate(6 -32) rotate(-12)">
        <path d="M-10 0 A10 8 0 0 0 10 0 Z" fill="#E2C08A" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        <path d="M-6 2 v3 M0 3 v3 M6 2 v3" stroke="#8A6410" strokeWidth={1.6} strokeLinecap="round" />
        <path d="M-6 -2 Q-8 -12 -2 -16 M0 -3 Q0 -13 4 -17 M5 -2 Q9 -10 12 -12" fill="none" stroke={NOODLE} strokeWidth={2.8} strokeLinecap="round" />
      </g>
    </g>
  ),
  workFx: {
    emitter: { x: 198, y: 198 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.6,
    shapes: [noodleBit, soupDrop, narutoBit],
  },
  meta: {
    nameZh: "拉面熊",
    elements: ["fire", "normal", "water"],
    family: "四足兽",
    toolAnchor: { x: 192, y: 231 },
    nodeBudget: 205,
    lieNote: "抱碗趴睡碗当枕头，尾巴盖脸",
  },
};
