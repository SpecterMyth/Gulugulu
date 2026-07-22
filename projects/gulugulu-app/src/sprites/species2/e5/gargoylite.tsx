// ---------------------------------------------------------------------------
// 石像咕 gargoylite — e5（electric+fire+ice+normal+water，缺草）· 傀儡构装
// 剪影：胖石像鬼蹲坐在小石柱台上（自带底座=礼装层），石翅内衬四色元素纹，
//       小尖角尖耳，尾绕柱。城市天台导游。
// 睡姿（P3）：跳下石台，石翅当被子趴睡，尾巴绕柱。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const STONE = "#8E93A6";
const STONE_DEEP = "#5C6172";
const PALE = "#C8CCD8";
const VOLT = "#FFD93B";
const FIRE = "#E85D3A";
const ICE = "#8FD8E8";
const SEA = "#2E7BD6";

/** 一片石翅（内衬元素纹；mirror 得右翅） */
function StoneWing({ mirror = false }: { mirror?: boolean }) {
  return (
    <g transform={mirror ? "scale(-1 1)" : undefined}>
      <path
        d="M0 0 Q-26 -18 -42 -10 Q-46 4 -34 8 L-28 2 Q-26 12 -16 12 L-13 5 Q-9 12 0 10 Z"
        fill={STONE}
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      <g strokeWidth={2.6} strokeLinecap="round" fill="none">
        <path d="M-36 -6 Q-26 -8 -18 -4" stroke={VOLT} />
        <path d="M-32 2 Q-24 0 -16 3" stroke={ICE} />
      </g>
    </g>
  );
}

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 石柱台座（礼装层：自带罗马柱基座） */}
      <g>
        <path d="M92 214 L164 214 L160 202 L96 202 Z" fill={PALE} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        <path d="M98 202 L158 202 L154 190 L102 190 Z" fill={STONE} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        <path d="M88 226 L168 226 L164 214 L92 214 Z" fill={STONE} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
        <path d="M104 196 v-4 M128 197 v-5 M152 196 v-4" stroke={STONE_DEEP} strokeWidth={2.6} strokeLinecap="round" />
        <path d="M96 220 h12 M148 220 h12" stroke={STONE_DEEP} strokeWidth={2.4} strokeLinecap="round" />
      </g>
      {/* 石翅（armL/R） */}
      <g transform={place(94, 128, 4)}>
        <Part name="armL" origin="90% 10%">
          <StoneWing />
        </Part>
      </g>
      <g transform={place(162, 128, -4)}>
        <Part name="armR" origin="10% 10%">
          <StoneWing mirror />
        </Part>
      </g>
      {/* 尾（细石尾绕过台座垂下，箭头尾尖） */}
      <g transform={place(166, 196)}>
        <Part name="tail" origin="0% 0%">
          <path d="M0 0 Q22 6 22 24 Q22 34 12 34" fill="none" stroke={STONE} strokeWidth={7} strokeLinecap="round" />
          <path d="M12 34 l-8 -5 l0 10 z" fill={STONE} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 蹲坐身体（胖墩，蹲在台上） */}
      <path
        d="M92 168 Q90 122 128 118 Q166 122 164 168 Q164 192 128 196 Q92 192 92 168 Z"
        fill={STONE}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 石纹裂缝 + 浅色肚 */}
      <ellipse cx={128} cy={172} rx={24} ry={16} fill={PALE} opacity={0.95} />
      <g stroke={STONE_DEEP} strokeWidth={2.2} strokeLinecap="round" opacity={0.7}>
        <path d="M100 140 l7 4 M154 152 l-6 4 M110 186 l6 -3" />
      </g>
      {/* 元素纹肚徽（四色小菱排） */}
      <g stroke={OUTLINE} strokeWidth={1.6}>
        <path d="M114 170 L117 173.5 L114 177 L111 173.5 Z" fill={VOLT} />
        <path d="M124 172 L127 175.5 L124 179 L121 175.5 Z" fill={FIRE} />
        <path d="M134 172 L137 175.5 L134 179 L131 175.5 Z" fill={ICE} />
        <path d="M144 170 L147 173.5 L144 177 L141 173.5 Z" fill={SEA} />
      </g>
      {/* 蹲坐爪脚（扒在台沿） */}
      <g transform={place(108, 196)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-8 0 Q-8 -8 0 -8 Q6 -8 6 -2 M-6 0 v4 M-1 0 v5 M4 0 v4" fill="none" stroke={STONE_DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(148, 196)}>
        <Part name="legR" origin="50% -40%">
          <path d="M8 0 Q8 -8 0 -8 Q-6 -8 -6 -2 M6 0 v4 M1 0 v5 M-4 0 v4" fill="none" stroke={STONE_DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 小手（导游手势，搭在肚前；静态件——臂动画由石翅承担） */}
      <g transform={place(102, 158, 30)}>
        <NubArm color={STONE} rx={6} ry={9} stroke={4} />
      </g>
      {/* 尖耳 */}
      <g fill={STONE} stroke={OUTLINE} strokeWidth={4}>
        <path d="M96 130 Q90 114 100 108 Q108 118 106 130 Z" />
        <path d="M160 130 Q166 114 156 108 Q148 118 150 130 Z" />
      </g>
      {/* 脸（凸眉石脸 + 小獠牙） */}
      <g className="part-face">
        <ExpFace cx1={112} cx2={144} cy={142} r={9.5} mouthY={160} mouthW={13} expression={expression} base={eyes} />
        <path d="M119 163 L119 158 L124 163 Z M137 163 L137 158 L132 163 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
        <Blush cx1={101} cx2={155} cy={154} />
      </g>
      {/* 头顶：小尖角一对（headtop 呼吸摇） */}
      <g transform={place(128, 118)}>
        <Part name="headtop" origin="50% 100%">
          <g fill={PALE} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round">
            <path d="M-12 2 Q-15 -8 -9 -13 Q-5 -6 -6 2 Z" />
            <path d="M12 2 Q15 -8 9 -13 Q5 -6 6 2 Z" />
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

/** 侧视（右向）：跳下台座去巡台——胖石像迈步，石翅后掠，迷你台座夹在腋下。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾（身后甩，箭头尾尖） */}
      <g transform={place(88, 188)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 Q-20 6 -24 22" fill="none" stroke={STONE} strokeWidth={7} strokeLinecap="round" />
          <path d="M-24 22 l-6 -6 l-2 10 z" fill={STONE} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 石翅（后掠双层） */}
      <g transform={place(112, 126, 16)}>
        <Part name="armL" origin="90% 10%">
          <StoneWing />
        </Part>
      </g>
      <g transform={place(128, 140, -4)}>
        <Part name="armR" origin="90% 10%">
          <StoneWing />
        </Part>
      </g>
      {/* 蹲胖身体（迈步前倾） */}
      <path
        d="M98 176 Q96 126 134 122 Q170 128 166 176 Q164 200 130 204 Q98 198 98 176 Z"
        fill={STONE}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 石纹 + 浅色肚 + 元素菱排 */}
      <ellipse cx={140} cy={178} rx={20} ry={14} fill={PALE} opacity={0.95} />
      <g stroke={STONE_DEEP} strokeWidth={2.2} strokeLinecap="round" opacity={0.7}>
        <path d="M108 142 l7 4 M152 156 l-6 4" />
      </g>
      <g stroke={OUTLINE} strokeWidth={1.6}>
        <path d="M130 176 L133 179.5 L130 183 L127 179.5 Z" fill={VOLT} />
        <path d="M140 178 L143 181.5 L140 185 L137 181.5 Z" fill={FIRE} />
        <path d="M150 176 L153 179.5 L150 183 L147 179.5 Z" fill={ICE} />
      </g>
      {/* 腋下夹着的迷你台座 */}
      <g transform="translate(94 196) rotate(-8)">
        <path d="M-16 8 L16 8 L14 2 L-14 2 Z" fill={STONE} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        <path d="M-11 2 L11 2 L9 -5 L-9 -5 Z" fill={PALE} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        <path d="M-5 -1 v-2 M5 -1 v-2" stroke={STONE_DEEP} strokeWidth={2} strokeLinecap="round" />
      </g>
      <g transform={place(104, 178, 34)}>
        <NubArm color={STONE} rx={6} ry={9} stroke={4} />
      </g>
      {/* 爪脚（迈步） */}
      <g transform={place(116, 231)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-8 0 Q-8 -8 0 -8 Q6 -8 6 -2 M-6 0 v3 M-1 0 v4 M4 0 v3" fill="none" stroke={STONE_DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(148, 231)}>
        <Part name="legR" origin="50% -40%">
          <path d="M8 0 Q8 -8 0 -8 Q-6 -8 -6 -2 M6 0 v3 M1 0 v4 M-4 0 v3" fill="none" stroke={STONE_DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 尖耳（脑后一只） */}
      <path d="M112 128 Q106 112 116 106 Q124 116 122 128 Z" fill={STONE} stroke={OUTLINE} strokeWidth={4} />
      {/* 脸（侧脸 + 小獠牙） */}
      <g className="part-face">
        <ExpSideFace cx={148} cy={140} r={9.5} expression={expression} base={eyes} withMouth={false} />
        <path d="M158 160 q6 4 12 -1" fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
        <path d="M160 162 L160 157 L165 162 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
        <ellipse cx={136} cy={154} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：小尖角（前后错落） */}
      <g transform={place(138, 118, 6)}>
        <Part name="headtop" origin="50% 100%">
          <g fill={PALE} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round">
            <path d="M-11 2 Q-14 -8 -8 -12 Q-4 -6 -5 2 Z" />
            <path d="M11 2 Q14 -8 8 -12 Q4 -6 5 2 Z" />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：跳下石台趴地上睡，石翅折过来当被子，尾巴绕住空台座。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 空石台座（右侧立着） */}
      <g transform="translate(184 196)">
        <path d="M-26 35 L26 35 L23 25 L-23 25 Z" fill={STONE} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        <path d="M-20 25 L20 25 L17 15 L-17 15 Z" fill={PALE} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        <path d="M-15 15 L15 15 L12 -14 L-12 -14 Z" fill={STONE} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        <path d="M-17 -14 L17 -14 L14 -22 L-14 -22 Z" fill={PALE} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        <path d="M-6 4 v-10 M6 4 v-10" stroke={STONE_DEEP} strokeWidth={2.2} strokeLinecap="round" />
      </g>
      {/* 尾（绕住台座柱脚） */}
      <g transform={place(146, 218)}>
        <Part name="tail" origin="0% 0%">
          <path d="M0 0 Q22 2 32 10 Q40 16 36 24" fill="none" stroke={STONE} strokeWidth={7} strokeLinecap="round" />
          <path d="M36 24 l-8 -3 l3 9 z" fill={STONE} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 趴地身体（伏低） */}
      <path
        d="M62 210 Q60 176 96 170 Q136 164 152 184 Q162 198 156 212 Q148 226 116 228 Q76 228 62 210 Z"
        fill={STONE}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 石纹 + 元素菱排（侧腹） */}
      <g stroke={STONE_DEEP} strokeWidth={2.2} strokeLinecap="round" opacity={0.7}>
        <path d="M84 190 l7 4 M136 196 l-6 4" />
      </g>
      <g stroke={OUTLINE} strokeWidth={1.6}>
        <path d="M104 212 L107 215.5 L104 219 L101 215.5 Z" fill={VOLT} />
        <path d="M114 214 L117 217.5 L114 221 L111 217.5 Z" fill={FIRE} />
        <path d="M124 214 L127 217.5 L124 221 L121 217.5 Z" fill={ICE} />
        <path d="M134 212 L137 215.5 L134 219 L131 215.5 Z" fill={SEA} />
      </g>
      {/* 石翅折过来当被子（覆背双层） */}
      <g transform={place(118, 184, 30)}>
        <Part name="armL" origin="90% 10%">
          <StoneWing />
        </Part>
      </g>
      <g transform={place(134, 196, 14)}>
        <Part name="armR" origin="90% 10%">
          <StoneWing />
        </Part>
      </g>
      {/* 爪脚（身后微露） */}
      <g transform={place(140, 228)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-6 0 Q-6 -6 0 -6 Q5 -6 5 -1 M-4 0 v3 M1 0 v3" fill="none" stroke={STONE_DEEP} strokeWidth={3.6} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(156, 226)}>
        <Part name="legR" origin="50% -40%">
          <path d="M5 0 Q5 -6 0 -6 Q-5 -6 -5 -1 M4 0 v3 M-1 0 v3" fill="none" stroke={STONE_DEEP} strokeWidth={3.6} strokeLinecap="round" />
        </Part>
      </g>
      {/* 尖耳 + 脸（左端睡颜 + 獠牙） */}
      <path d="M64 176 Q58 160 68 154 Q76 164 74 176 Z" fill={STONE} stroke={OUTLINE} strokeWidth={4} />
      <path d="M104 168 Q102 154 110 150 Q116 160 114 170 Z" fill={STONE} stroke={OUTLINE} strokeWidth={4} />
      <g className="part-face">
        <ExpFace cx1={80} cx2={106} cy={190} r={8.5} mouthY={208} mouthW={11} expression={expression} base={eyes} withMouth={false} />
        <path d="M78 208 q7 4 14 0" fill="none" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
        <path d="M80 210 L80 205 L85 210 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
        <Blush cx1={70} cx2={116} cy={202} />
      </g>
      {/* 头顶：小尖角（贴伏） */}
      <g transform={place(88, 158, -10)}>
        <Part name="headtop" origin="50% 100%">
          <g fill={PALE} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
            <path d="M-10 2 Q-13 -7 -7 -11 Q-3 -5 -4 2 Z" />
            <path d="M10 2 Q13 -7 7 -11 Q3 -5 4 2 Z" />
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

// 裁判打工的产物：口哨 + 红黄牌 + 格子旗
const whistle: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    {/* 哨体 */}
    <path d="M-8 -3 Q-11 -3 -11 1 Q-11 7 -4 7 L3 7 Q9 7 9 1 Q9 -3 3 -3 Z" fill={PALE} strokeWidth={2} />
    {/* 吹口 */}
    <rect x={7} y={-3.5} width={6} height={4} rx={1.4} fill={PALE} strokeWidth={1.8} />
    {/* 出音孔 */}
    <circle cx={-2} cy={2} r={2.4} fill={STONE_DEEP} stroke={OUTLINE} strokeWidth={1.4} />
    {/* 挂绳环 */}
    <circle cx={-9} cy={-5.5} r={2.6} fill="none" stroke={STONE_DEEP} strokeWidth={1.8} />
  </g>
);
const cardPair: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    {/* 黄牌 */}
    <rect x={-8} y={-8} width={9} height={13} rx={1.6} fill={VOLT} strokeWidth={2} transform="rotate(-13)" />
    {/* 红牌 */}
    <rect x={-1} y={-5} width={9} height={13} rx={1.6} fill={FIRE} strokeWidth={2} transform="rotate(11)" />
  </g>
);
const linesmanFlag: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    {/* 旗杆 */}
    <path d="M-6 10 L2 -9" stroke="#B98A4E" strokeWidth={2.2} strokeLinecap="round" />
    {/* 格子旗 */}
    <rect x={2} y={-9} width={11} height={9} fill="#FFFFFF" strokeWidth={1.8} />
    <g fill={OUTLINE} stroke="none">
      <rect x={2} y={-9} width={3.7} height={3} />
      <rect x={9.3} y={-9} width={3.7} height={3} />
      <rect x={5.65} y={-6} width={3.65} height={3} />
      <rect x={2} y={-3} width={3.7} height={3} />
      <rect x={9.3} y={-3} width={3.7} height={3} />
    </g>
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.15,
    palette: { body: STONE, deep: STONE_DEEP, belly: PALE, accent: VOLT, accent2: ICE },
    foodAnchor: { x: 128, y: 160 },
    shadowRx: 60,
  },
  // 导游小旗：旗杆 + 三角旗（元素徽）+ 挂绳哨
  tool: () => (
    <g>
      <path d="M-2.2 0 L2.2 0 L2 -44 L-2 -44 Z" fill="#B98A4E" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
      <path d="M2 -44 L30 -36 L2 -28 Z" fill={FIRE} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <circle cx={12} cy={-36} r={3} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={1.8} />
      <path d="M-2 -16 q-6 2 -7 7" fill="none" stroke={OUTLINE} strokeWidth={2.2} strokeLinecap="round" />
      <rect x={-13} y={-9} width={6} height={8} rx={2} fill={ICE} stroke={OUTLINE} strokeWidth={2} />
    </g>
  ),
  workFx: {
    emitter: { x: 200, y: 194 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.6,
    shapes: [whistle, cardPair, linesmanFlag],
  },
  meta: {
    nameZh: "石像咕",
    elements: ["electric", "fire", "ice", "normal", "water"],
    family: "傀儡构装",
    toolAnchor: { x: 196, y: 231 },
    nodeBudget: 305,
    lieNote: "跳下石台，石翅当被子趴睡，尾巴绕柱",
  },
};
