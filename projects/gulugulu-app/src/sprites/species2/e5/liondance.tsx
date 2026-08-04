// ---------------------------------------------------------------------------
// 醒狮 liondance — e5（electric+fire+grass+ice+normal，缺水）· 傀儡构装
// 剪影：节庆舞狮：大狮头面具（额镜+五彩流苏眉腮+绒球鼻，礼装档），
//       面具下小小狮裤身。揭幕仪式专业户。
// 睡姿（P3）：狮头面具掀开搁一旁，小小的它抱着绣球睡（反差萌）。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm, StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const RED = "#E2432E";
const RED_DEEP = "#B32E17";
const GOLD = "#FFD93B";
const CREAM = "#FFF1C9";
const LEAF = "#8CD97B";
const ICE = "#8FD8E8";
const VOLT = "#F5C542";

/** 一撮流苏穗（pivot=系点，向下垂） */
function Tassel({ color, len = 14 }: { color: string; len?: number }) {
  return (
    <g>
      <circle cx={0} cy={0} r={3.4} fill={color} stroke={OUTLINE} strokeWidth={2} />
      <path d={`M-2.5 2 L-3.5 ${len} M0 3 L0 ${len + 3} M2.5 2 L3.5 ${len}`} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  );
}

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：狮尾绒穗（左下探出） */}
      <g transform={place(84, 216, -20)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-14 2 -18 -6" fill="none" stroke={GOLD} strokeWidth={5} strokeLinecap="round" />
          <circle cx={-20} cy={-9} r={6.5} fill={RED} stroke={OUTLINE} strokeWidth={3} />
        </Part>
      </g>
      {/* 小小身体（狮裤+布鞋，被大面具压在下面） */}
      <path d="M104 196 Q102 176 128 174 Q154 176 152 196 Q152 216 128 220 Q104 216 104 196 Z" fill={GOLD} stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round" />
      <path d="M108 196 q20 8 40 0" fill="none" stroke={RED} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M112 208 q16 6 32 0" fill="none" stroke={LEAF} strokeWidth={3} strokeLinecap="round" />
      {/* 小手 */}
      <g transform={place(100, 190, 28)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={RED} rx={6.5} ry={10} />
        </Part>
      </g>
      <g transform={place(156, 190, -28)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={RED} rx={6.5} ry={10} />
        </Part>
      </g>
      {/* 小脚（黑布鞋） */}
      <g transform={place(112, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={GOLD} deep="#3E4356" rx={8.5} ry={5} lift={6} />
        </Part>
      </g>
      <g transform={place(144, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={GOLD} deep="#3E4356" rx={8.5} ry={5} lift={6} />
        </Part>
      </g>
      {/* ===== 大狮头面具（剪影主体，礼装多层） ===== */}
      {/* 腮须流苏排（面具下缘两侧） */}
      <g>
        <g transform={place(84, 156, -14)}><Tassel color={LEAF} len={16} /></g>
        <g transform={place(78, 138, -8)}><Tassel color={ICE} len={15} /></g>
        <g transform={place(172, 156, 14)}><Tassel color={ICE} len={16} /></g>
        <g transform={place(178, 138, 8)}><Tassel color={LEAF} len={15} /></g>
      </g>
      {/* 狮头主体（宽圆面具） */}
      <path
        d="M78 120 Q76 74 128 72 Q180 74 178 120 Q178 152 158 164 Q144 172 128 172 Q112 172 98 164 Q78 152 78 120 Z"
        fill={RED}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 面具口（张嘴笑口，露出小脸感的口腔） */}
      <path d="M100 148 Q128 166 156 148 Q152 168 128 170 Q104 168 100 148 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      {/* 额镜（招牌圆镜） */}
      <circle cx={128} cy={92} r={10} fill={ICE} stroke={GOLD} strokeWidth={4} />
      <circle cx={128} cy={92} r={10} fill="none" stroke={OUTLINE} strokeWidth={2} />
      <path d="M124 88 l3 -2" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
      {/* 五彩眉羽（左右各一撮上扬） */}
      <g stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <path d="M96 104 Q84 94 86 82 Q98 86 102 98 Z" fill={LEAF} />
        <path d="M102 100 Q94 88 100 78 Q110 86 110 98 Z" fill={VOLT} />
        <path d="M160 104 Q172 94 170 82 Q158 86 154 98 Z" fill={LEAF} />
        <path d="M154 100 Q162 88 156 78 Q146 86 146 98 Z" fill={VOLT} />
      </g>
      {/* 绒球鼻 + 面具眼 */}
      <g className="part-face">
        <ExpFace cx1={106} cx2={150} cy={118} r={11} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <circle cx={128} cy={136} r={9} fill={GOLD} stroke={OUTLINE} strokeWidth={3.4} />
        <circle cx={125} cy={133} r={2.4} fill={CREAM} />
      </g>
      {/* 头顶：独角绒球 + 双耳绒球（headtop 呼吸摇，礼装顶层） */}
      <g transform={place(128, 74)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 0 Q-2 -10 2 -16" fill="none" stroke={RED_DEEP} strokeWidth={5} strokeLinecap="round" />
          <circle cx={3} cy={-19} r={7} fill={LEAF} stroke={OUTLINE} strokeWidth={3} />
          <g transform="translate(-34 8)">
            <circle cx={0} cy={0} r={8} fill={ICE} stroke={OUTLINE} strokeWidth={3} />
            <circle cx={-2} cy={-2} r={2} fill="#FFFFFF" opacity={0.8} />
          </g>
          <g transform="translate(34 8)">
            <circle cx={0} cy={0} r={8} fill={GOLD} stroke={OUTLINE} strokeWidth={3} />
            <circle cx={-2} cy={-2} r={2} fill="#FFFFFF" opacity={0.8} />
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

/** 侧视（右向）：舞步前探，大狮头面具朝前，眉羽后掠，腮须流苏拖尾。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：狮尾绒穗（身后） */}
      <g transform={place(88, 214, -14)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-14 2 -18 -6" fill="none" stroke={GOLD} strokeWidth={5} strokeLinecap="round" />
          <circle cx={-20} cy={-9} r={6.5} fill={RED} stroke={OUTLINE} strokeWidth={3} />
        </Part>
      </g>
      {/* 小狮裤身（面具后下方，舞步） */}
      <path d="M106 196 Q104 178 128 176 Q152 178 150 196 Q150 214 128 218 Q106 214 106 196 Z" fill={GOLD} stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round" />
      <path d="M110 196 q18 8 36 0" fill="none" stroke={RED} strokeWidth={3.4} strokeLinecap="round" />
      {/* 小手（舞步摆） */}
      <g transform={place(104, 192, 30)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={RED_DEEP} rx={6} ry={9.5} />
        </Part>
      </g>
      <g transform={place(150, 188, -32)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={RED} rx={6.5} ry={10} />
        </Part>
      </g>
      {/* 小脚（黑布鞋弓步） */}
      <g transform={place(112, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={GOLD} deep="#3E4356" rx={8.5} ry={5} lift={6} />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={GOLD} deep="#3E4356" rx={8.5} ry={5} lift={6} />
        </Part>
      </g>
      {/* ===== 大狮头面具（朝前） ===== */}
      {/* 腮须流苏（后缘拖尾两撮） */}
      <g>
        <g transform={place(92, 152, -22)}><Tassel color={LEAF} len={16} /></g>
        <g transform={place(86, 132, -14)}><Tassel color={ICE} len={15} /></g>
      </g>
      {/* 狮头主体 */}
      <path
        d="M84 120 Q84 74 134 72 Q184 76 180 122 Q178 150 160 162 Q146 170 130 169 Q110 167 96 157 Q84 146 84 120 Z"
        fill={RED}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 面具口（朝前笑口） */}
      <path d="M120 150 Q144 166 166 144 Q164 164 140 169 Q122 166 120 150 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      {/* 额镜 */}
      <circle cx={140} cy={90} r={10} fill={ICE} stroke={GOLD} strokeWidth={4} />
      <circle cx={140} cy={90} r={10} fill="none" stroke={OUTLINE} strokeWidth={2} />
      <path d="M136 86 l3 -2" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
      {/* 眉羽（上扬后掠） */}
      <g stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <path d="M148 92 Q142 78 148 68 Q158 76 158 90 Z" fill={VOLT} />
        <path d="M138 96 Q128 84 132 72 Q142 80 144 94 Z" fill={LEAF} />
      </g>
      {/* 绒球鼻 + 面具侧眼 */}
      <g className="part-face">
        <ExpSideFace cx={152} cy={116} r={11} expression={expression} base={eyes} withMouth={false} />
        <circle cx={168} cy={132} r={9} fill={GOLD} stroke={OUTLINE} strokeWidth={3.4} />
        <circle cx={165} cy={129} r={2.4} fill={CREAM} />
        <ellipse cx={136} cy={132} rx={7.5} ry={5} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 头顶：独角绒球 + 双耳绒球（前后错落） */}
      <g transform={place(130, 74)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M4 0 Q2 -10 6 -16" fill="none" stroke={RED_DEEP} strokeWidth={5} strokeLinecap="round" />
          <circle cx={7} cy={-19} r={7} fill={LEAF} stroke={OUTLINE} strokeWidth={3} />
          <g transform="translate(-32 8)">
            <circle cx={0} cy={0} r={8} fill={ICE} stroke={OUTLINE} strokeWidth={3} />
            <circle cx={-2} cy={-2} r={2} fill="#FFFFFF" opacity={0.8} />
          </g>
          <g transform="translate(30 10)">
            <circle cx={0} cy={0} r={7.5} fill={GOLD} stroke={OUTLINE} strokeWidth={3} />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：狮头面具掀开搁一旁，小小的它露出真身抱着绣球睡——反差萌。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 掀开搁一旁的狮头面具（坐在地上斜靠） */}
      <g transform="translate(64 224) rotate(-10) scale(0.8)">
        <path
          d="M-42 -46 Q-42 -92 8 -94 Q58 -90 54 -44 Q52 -16 34 -4 Q20 4 4 3 Q-16 1 -30 -9 Q-42 -20 -42 -46 Z"
          fill={RED}
          stroke={OUTLINE}
          strokeWidth={7}
          strokeLinejoin="round"
        />
        <path d="M-22 -16 Q4 2 30 -18 Q26 4 2 6 Q-18 4 -22 -16 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
        <circle cx={6} cy={-74} r={11} fill={ICE} stroke={GOLD} strokeWidth={4.5} />
        <circle cx={6} cy={-74} r={11} fill="none" stroke={OUTLINE} strokeWidth={2.2} />
        <g stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round">
          <path d="M-24 -62 Q-36 -72 -34 -84 Q-22 -80 -18 -68 Z" fill={LEAF} />
          <path d="M34 -62 Q46 -72 44 -84 Q32 -80 28 -68 Z" fill={VOLT} />
        </g>
        <g fill={OUTLINE} opacity={0.85}>
          <circle cx={-14} cy={-48} r={7} />
          <circle cx={26} cy={-48} r={7} />
        </g>
        <circle cx={6} cy={-30} r={9.5} fill={GOLD} stroke={OUTLINE} strokeWidth={3.6} />
        <g transform="translate(-38 -80)">
          <circle cx={0} cy={0} r={8.5} fill={ICE} stroke={OUTLINE} strokeWidth={3.2} />
        </g>
        <g transform="translate(48 -78)">
          <circle cx={0} cy={0} r={8.5} fill={GOLD} stroke={OUTLINE} strokeWidth={3.2} />
        </g>
      </g>
      {/* 尾：狮尾绒穗（真身后） */}
      <g transform={place(196, 216, 8)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 0 Q12 2 16 -6" fill="none" stroke={GOLD} strokeWidth={4.5} strokeLinecap="round" />
          <circle cx={18} cy={-9} r={6} fill={RED} stroke={OUTLINE} strokeWidth={2.8} />
        </Part>
      </g>
      {/* 小小真身（狮裤蜷卧） */}
      <path d="M136 214 Q134 196 160 194 Q186 196 184 214 Q184 228 160 231 Q136 228 136 214 Z" fill={GOLD} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
      <path d="M140 212 q20 7 40 0" fill="none" stroke={RED} strokeWidth={3} strokeLinecap="round" />
      {/* 布鞋（收拢） */}
      <g transform={place(150, 232)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={7.5} ry={4.5} fill="#3E4356" stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      <g transform={place(172, 232)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={7.5} ry={4.5} fill="#3E4356" stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      {/* 抱着的绣球 */}
      <g transform="translate(136 210)">
        <circle cx={0} cy={0} r={13} fill={RED} stroke={OUTLINE} strokeWidth={3.2} />
        <path d="M-13 0 A13 13 0 0 1 13 0" fill="none" stroke={GOLD} strokeWidth={2.8} />
        <circle cx={0} cy={0} r={4} fill={ICE} stroke={OUTLINE} strokeWidth={2} />
        <path d="M-8 10 Q-11 16 -9 20 M8 10 Q11 16 9 20" fill="none" stroke={LEAF} strokeWidth={2.4} strokeLinecap="round" />
      </g>
      {/* 小手环抱绣球 */}
      <g transform={place(146, 202, 42)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={RED} rx={6} ry={9} />
        </Part>
      </g>
      <g transform={place(168, 206, -36)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={RED} rx={6} ry={9} />
        </Part>
      </g>
      {/* 真身小脑袋（奶油圆脸 + 小圆耳） */}
      <g fill={RED} stroke={OUTLINE} strokeWidth={3.6}>
        <circle cx={146} cy={168} r={6.5} />
        <circle cx={178} cy={166} r={6.5} />
      </g>
      <circle cx={162} cy={182} r={20} fill={CREAM} stroke={OUTLINE} strokeWidth={5} />
      {/* 脸（反差萌睡颜） */}
      <g className="part-face">
        <ExpFace cx1={154} cx2={170} cy={178} r={6} mouthY={192} mouthW={8} expression={expression} base={eyes} />
        <Blush cx1={146} cx2={178} cy={188} />
      </g>
      {/* 头顶：迷你绒球呆毛 */}
      <g transform={place(162, 162)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-1 -4 1 -8" fill="none" stroke={RED_DEEP} strokeWidth={3.2} strokeLinecap="round" />
          <circle cx={2} cy={-10} r={4.5} fill={LEAF} stroke={OUTLINE} strokeWidth={2.4} />
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

// 舞狮打工的产物：迷你狮头 + 红鞭炮串 + 五彩纸屑
const lionHead: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    {/* 金绒球独角 */}
    <circle cx={0} cy={-8} r={2.4} fill={GOLD} strokeWidth={1.6} />
    {/* 圆脸狮头 */}
    <path d="M-7 -1 Q-8 -7 -3 -8 Q0 -10 3 -8 Q8 -7 7 -1 Q7 6 0 8 Q-7 6 -7 -1 Z" fill={RED} strokeWidth={2} />
    {/* 金流苏眉 */}
    <path d="M-6 -2 q3 3 6 0 q3 3 6 0" fill="none" stroke={GOLD} strokeWidth={1.8} strokeLinecap="round" />
    <g fill={OUTLINE} stroke="none">
      <circle cx={-3} cy={1.5} r={1.3} />
      <circle cx={3} cy={1.5} r={1.3} />
    </g>
  </g>
);
const firecrackerString: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    {/* 引线 */}
    <path d="M10 -9 q-6 1 -10 4 q-4 2 -8 2" fill="none" strokeWidth={1.6} strokeLinecap="round" />
    {/* 三节红鞭炮 */}
    <rect x={-10} y={-3} width={5} height={9} rx={1.6} fill={RED} strokeWidth={1.8} />
    <rect x={-2.5} y={-4} width={5} height={10} rx={1.6} fill={RED} strokeWidth={1.8} />
    <rect x={5} y={-2} width={5} height={8} rx={1.6} fill={RED} strokeWidth={1.8} />
    {/* 金封纸带 */}
    <g stroke={GOLD} strokeWidth={1.3} strokeLinecap="round">
      <path d="M-9.5 1 h4 M-2 0 h4 M5.5 1.5 h4" />
    </g>
    {/* 引线火花 */}
    <circle cx={10} cy={-9} r={1.5} fill={GOLD} strokeWidth={1.2} />
  </g>
);
const confettiBit: ParticleRenderer = () => (
  <rect x={-4} y={-2.5} width={8} height={5} rx={1} fill={LEAF} stroke={OUTLINE} strokeWidth={1.6} transform="rotate(-20)" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1,
    palette: { body: RED, deep: RED_DEEP, belly: CREAM, accent: GOLD, accent2: LEAF },
    foodAnchor: { x: 128, y: 158 },
    shadowRx: 58,
  },
  // 绣球：彩带绣球（舞狮引球）
  tool: () => (
    <g>
      <path d="M0 0 L0 -12" stroke="#8A6410" strokeWidth={3} strokeLinecap="round" />
      <circle cx={0} cy={-24} r={12} fill={RED} stroke={OUTLINE} strokeWidth={3.4} />
      <path d="M-12 -24 A12 12 0 0 1 12 -24" fill="none" stroke={GOLD} strokeWidth={3} />
      <circle cx={0} cy={-24} r={4} fill={ICE} stroke={OUTLINE} strokeWidth={2.2} />
      <path d="M-8 -14 Q-12 -6 -10 0 M8 -14 Q12 -6 10 0" fill="none" stroke={LEAF} strokeWidth={2.6} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 198, y: 200 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.7,
    shapes: [lionHead, firecrackerString, confettiBit],
  },
  meta: {
    nameZh: "醒狮",
    elements: ["electric", "fire", "grass", "ice", "normal"],
    family: "傀儡构装",
    toolAnchor: { x: 196, y: 231 },
    nodeBudget: 305,
    lieNote: "狮头面具掀开搁一旁，小小的它抱着绣球睡（反差萌）",
  },
};
