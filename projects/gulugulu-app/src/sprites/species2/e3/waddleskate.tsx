// ---------------------------------------------------------------------------
// 滑冰鹅 waddleskate — e3（electric+ice+normal）· 双足小人
// 剪影：圆企鹅，脚蹼=两片冰刀（招牌），红围脖别着号码牌（e3 装饰），
//       头顶护耳绒帽。冰壶馆全能选手。
// 睡姿（P3）：肚皮着地的滑行姿势直接定格入睡。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { FlipperArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const TUX = "#3E4356";
const TUX_DEEP = "#2E2E36";
const BELLY = "#FFFFFF";
const ICE = "#8FD8E8";
const VOLT = "#FFD93B";
const SCARF = "#E2432E";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小燕尾（左下探出） */}
      <g transform={place(86, 216)}>
        <Part name="tail" origin="100% 30%">
          <path d="M0 0 Q-12 2 -16 10 Q-8 12 -2 8 Z" fill={TUX_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 身体（胖水滴企鹅） */}
      <path
        d="M88 200 Q86 138 108 116 Q128 100 148 116 Q170 138 168 200 Q166 224 128 226 Q90 224 88 200 Z"
        fill={TUX}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 白肚 + 脸区一体 */}
      <path
        d="M100 196 Q98 148 114 130 Q128 118 142 130 Q158 148 156 196 Q154 214 128 216 Q102 214 100 196 Z"
        fill={BELLY}
        stroke={OUTLINE}
        strokeWidth={3.4}
      />
      {/* 鳍翅 */}
      <g transform={place(84, 160, 16)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={TUX} len={26} mirror />
        </Part>
      </g>
      <g transform={place(172, 160, -16)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={TUX} len={26} />
        </Part>
      </g>
      {/* 冰刀脚蹼（招牌：蹼+刀刃） */}
      <g transform={place(110, 224)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-10 0 l10 -7 l10 7 z" fill="#F5A83B" stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M-11 5 L11 5" stroke={ICE} strokeWidth={4} strokeLinecap="round" />
          <path d="M-8 0 v5 M8 0 v5" stroke={OUTLINE} strokeWidth={2.2} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(146, 224)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-10 0 l10 -7 l10 7 z" fill="#F5A83B" stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M-11 5 L11 5" stroke={ICE} strokeWidth={4} strokeLinecap="round" />
          <path d="M-8 0 v5 M8 0 v5" stroke={OUTLINE} strokeWidth={2.2} strokeLinecap="round" />
        </Part>
      </g>
      {/* 红围脖 + 号码牌（e3 装饰） */}
      <path d="M102 148 Q128 160 154 148 L154 158 Q128 170 102 158 Z" fill={SCARF} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      <g transform="translate(128 172) rotate(-4)">
        <rect x={-11} y={-9} width={22} height={18} rx={3} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={2.8} />
        <text x={0} y={5} textAnchor="middle" fontSize={12} fontWeight={900} fill={TUX_DEEP}>7</text>
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={114} cx2={142} cy={132} r={8.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path
          d={expression === "happy" || expression === "star" || expression === "surprised"
            ? "M121 143 L135 143 L128 153 Z"
            : "M122 143 L134 143 L128 150 Z"}
          fill="#F5A83B"
          stroke={OUTLINE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <Blush cx1={106} cx2={150} cy={144} />
      </g>
      {/* 头顶：护耳绒帽（毛球顶 + 电花绣标，headtop 呼吸摇） */}
      <g transform={place(128, 108)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-24 4 Q-26 -12 -10 -16 Q0 -18 10 -16 Q26 -12 24 4 Q12 -2 0 -2 Q-12 -2 -24 4 Z" fill={ICE} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M-22 2 Q-28 8 -24 14 M22 2 Q28 8 24 14" fill="none" stroke={ICE} strokeWidth={6} strokeLinecap="round" />
          <circle cx={0} cy={-18} r={5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.8} />
          <path d="M-2 -8 l-2 3.4 h1.7 l-2 3.4" fill="none" stroke={VOLT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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

/** 侧视（右向）：企鹅前倾滑步，喙朝前，冰刀一前一后，围脖号码牌在胸前。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小燕尾（身后） */}
      <g transform={place(90, 208)}>
        <Part name="tail" origin="100% 30%">
          <path d="M0 0 Q-12 2 -16 10 Q-8 12 -2 8 Z" fill={TUX_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 远侧鳍翅 */}
      <g transform={place(106, 164, 18)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={TUX_DEEP} len={24} mirror />
        </Part>
      </g>
      {/* 身体（前倾胖水滴） */}
      <path
        d="M92 200 Q88 140 112 118 Q130 102 150 120 Q170 142 166 200 Q162 224 126 226 Q94 222 92 200 Z"
        fill={TUX}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 白肚+脸区（体前） */}
      <path
        d="M122 196 Q122 150 136 132 Q148 122 158 138 Q168 158 162 198 Q158 214 138 216 Q124 212 122 196 Z"
        fill={BELLY}
        stroke={OUTLINE}
        strokeWidth={3.4}
      />
      {/* 冰刀脚蹼（滑步一前一后） */}
      <g transform={place(108, 224)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-10 0 l10 -7 l10 7 z" fill="#F5A83B" stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M-11 5 L11 5" stroke={ICE} strokeWidth={4} strokeLinecap="round" />
          <path d="M-8 0 v5 M8 0 v5" stroke={OUTLINE} strokeWidth={2.2} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(148, 224)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-10 0 l10 -7 l10 7 z" fill="#F5A83B" stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M-11 5 L11 5" stroke={ICE} strokeWidth={4} strokeLinecap="round" />
          <path d="M-8 0 v5 M8 0 v5" stroke={OUTLINE} strokeWidth={2.2} strokeLinecap="round" />
        </Part>
      </g>
      {/* 红围脖 + 号码牌 */}
      <path d="M110 148 Q136 160 158 146 L158 156 Q136 170 110 158 Z" fill={SCARF} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      <g transform="translate(142 172) rotate(-4)">
        <rect x={-10} y={-8} width={20} height={16} rx={3} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={2.6} />
        <text x={0} y={4.5} textAnchor="middle" fontSize={11} fontWeight={900} fill={TUX_DEEP}>7</text>
      </g>
      {/* 近侧鳍翅（摆动） */}
      <g transform={place(140, 166, -22)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={TUX} len={26} />
        </Part>
      </g>
      {/* 脸（侧脸单眼 + 尖喙朝前） */}
      <g className="part-face">
        <ExpSideFace cx={146} cy={130} r={9} expression={expression} base={eyes} withMouth={false} />
        <path
          d={expression === "happy" || expression === "star" || expression === "surprised"
            ? "M158 138 L174 144 L158 152 Z"
            : "M159 140 L172 145 L159 150 Z"}
          fill="#F5A83B"
          stroke={OUTLINE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
        <ellipse cx={136} cy={144} rx={6.5} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：护耳绒帽（前倾） */}
      <g transform={place(130, 108, 6)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-24 4 Q-26 -12 -10 -16 Q0 -18 10 -16 Q26 -12 24 4 Q12 -2 0 -2 Q-12 -2 -24 4 Z" fill={ICE} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M-22 2 Q-28 8 -24 14 M22 2 Q28 8 24 14" fill="none" stroke={ICE} strokeWidth={6} strokeLinecap="round" />
          <circle cx={0} cy={-18} r={5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.8} />
          <path d="M-2 -8 l-2 3.4 h1.7 l-2 3.4" fill="none" stroke={VOLT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：肚皮着地的滑行姿势直接定格入睡，鳍翅贴身后掠，冰面拖两道滑痕。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 冰面滑痕 */}
      <g stroke={ICE} strokeWidth={3} strokeLinecap="round" opacity={0.8}>
        <path d="M60 230 h32 M104 233 h26" />
      </g>
      {/* 尾：小燕尾（左端翘起） */}
      <g transform={place(66, 206, 24)}>
        <Part name="tail" origin="100% 30%">
          <path d="M0 0 Q-12 2 -16 10 Q-8 12 -2 8 Z" fill={TUX_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 冰刀（拖在身后，刀刃朝后） */}
      <g transform={place(74, 220, 58)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-9 0 l9 -6 l9 6 z" fill="#F5A83B" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
          <path d="M-10 4.5 L10 4.5" stroke={ICE} strokeWidth={3.6} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(88, 227, 40)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-9 0 l9 -6 l9 6 z" fill="#F5A83B" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
          <path d="M-10 4.5 L10 4.5" stroke={ICE} strokeWidth={3.6} strokeLinecap="round" />
        </Part>
      </g>
      {/* 身体（趴地滑行水滴，头端在右） */}
      <path
        d="M62 212 Q64 190 98 184 Q142 176 172 188 Q186 194 186 206 Q184 220 156 226 Q104 232 74 226 Q60 222 62 212 Z"
        fill={TUX}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 白脸肚（贴地前段） */}
      <ellipse cx={158} cy={202} rx={27} ry={19} fill={BELLY} stroke={OUTLINE} strokeWidth={3.2} />
      {/* 红围脖 + 号码牌（背上） */}
      <path d="M132 184 Q148 192 164 186 L164 194 Q148 202 132 194 Z" fill={SCARF} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
      <g transform="translate(130 178) rotate(-16)">
        <rect x={-9} y={-7} width={18} height={14} rx={2.6} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={2.4} />
        <text x={0} y={4} textAnchor="middle" fontSize={10} fontWeight={900} fill={TUX_DEEP}>7</text>
      </g>
      {/* 鳍翅（贴身后掠） */}
      <g transform={place(98, 198, 104)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={TUX_DEEP} len={22} mirror />
        </Part>
      </g>
      <g transform={place(116, 190, -108)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={TUX} len={24} />
        </Part>
      </g>
      {/* 脸（闭眼滑行）+ 尖喙 */}
      <g className="part-face">
        <ExpSideFace cx={160} cy={194} r={8.5} expression={expression} base={eyes} withMouth={false} />
        <path d="M182 200 L194 205 L182 210 Z" fill="#F5A83B" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        <ellipse cx={150} cy={208} rx={6} ry={4} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：护耳绒帽（滑行压低） */}
      <g transform={place(152, 178, 12)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-22 4 Q-24 -11 -9 -15 Q0 -17 9 -15 Q24 -11 22 4 Q11 -2 0 -2 Q-11 -2 -22 4 Z" fill={ICE} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
          <circle cx={0} cy={-17} r={4.5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.6} />
          <path d="M-2 -7 l-2 3 h1.7 l-2 3" fill="none" stroke={VOLT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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

const iceChip: ParticleRenderer = () => (
  <path d="M0 -6 L5 -1 L2 6 L-4 4 L-5 -2 Z" fill="#F7FCFD" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
);
// 冰壶刷扫出的第二产物：冰面霜痕（配 1 道电花）
const frostStreak: ParticleRenderer = () => (
  <g fill="none" stroke={ICE} strokeWidth={2.2} strokeLinecap="round">
    <path d="M-7 3 q7 -4 13 -1" />
    <path d="M-6 -3 q6 -3 11 -1" />
  </g>
);
const boltBit: ParticleRenderer = () => (
  <path d="M1.5 -8 L-4 1 h3.5 L-1.5 8 L4.5 -1 h-3.5 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.12,
    palette: { body: TUX, deep: TUX_DEEP, belly: BELLY, accent: ICE, accent2: VOLT },
    foodAnchor: { x: 128, y: 148 },
    shadowRx: 52,
  },
  // 冰壶刷：长杆 + 刷头 + 冰屑
  tool: () => (
    <g>
      <path d="M-2.2 0 L2.2 0 L4 -38 L0 -38 Z" fill="#E2432E" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M2 -38 L6 -46" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" />
      <g transform="translate(8 -49) rotate(24)">
        <rect x={-10} y={-5} width={20} height={10} rx={4} fill={VOLT} stroke={OUTLINE} strokeWidth={2.8} />
        <path d="M-6 5 v3 M0 5 v3 M6 5 v3" stroke={OUTLINE} strokeWidth={2} strokeLinecap="round" />
      </g>
      <path d="M-8 -6 l-3 4 M-5 -12 l-4 3" stroke={ICE} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 198, y: 186 },
    baseAngle: -Math.PI / 2.4,
    cone: 0.6,
    shapes: [iceChip, frostStreak, boltBit],
  },
  meta: {
    nameZh: "滑冰鹅",
    elements: ["electric", "ice", "normal"],
    family: "双足小人",
    toolAnchor: { x: 192, y: 231 },
    nodeBudget: 205,
    lieNote: "肚皮着地的滑行姿势直接定格入睡",
  },
};
