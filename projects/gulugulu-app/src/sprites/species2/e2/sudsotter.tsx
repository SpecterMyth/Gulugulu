// ---------------------------------------------------------------------------
// 泡澡獭 sudsotter — e2（normal+water）· 四足兽（直立水獭）
// 剪影：修长小水獭直立站姿，头顶肥皂泡刘海（招牌），粗尾从身后绕到体侧。
// 睡姿（P3）：仰面朝天躺，双手搭肚皮（浮水式）。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const FUR = "#8B6F5B";
const DEEP = "#6E5847";
const CREAM = "#E8D8C8";
const SEA = "#9BDCFF";
const BUBBLE = "#EAF7FF";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 粗尾（从身后绕到右侧贴地，尖端上翘=签名） */}
      <g transform={place(158, 226)}>
        <Part name="tail" origin="10% 80%">
          <path
            d="M0 4 Q26 6 34 -10 Q38 -20 32 -26 Q28 -14 18 -10 Q6 -6 0 4 Z"
            fill={DEEP}
            stroke={OUTLINE}
            strokeWidth={5}
            strokeLinejoin="round"
          />
        </Part>
      </g>
      {/* 身体（修长直立，上窄下宽） */}
      <path
        d="M100 226 Q96 168 112 148 Q120 138 128 138 Q136 138 144 148 Q160 168 156 226 Q128 236 100 226 Z"
        fill={FUR}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 奶油胸腹长条 */}
      <path d="M114 160 Q128 152 142 160 Q148 196 142 222 Q128 228 114 222 Q108 196 114 160 Z" fill={CREAM} opacity={0.95} />
      {/* 小手（搭在胸前） */}
      <g transform={place(106, 176, 30)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={FUR} rx={6.5} ry={11} />
        </Part>
      </g>
      <g transform={place(150, 176, -30)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={FUR} rx={6.5} ry={11} />
        </Part>
      </g>
      {/* 小脚（蹼足） */}
      <g transform={place(112, 231)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={10} ry={5.5} fill={DEEP} stroke={OUTLINE} strokeWidth={4} />
          <path d="M-4 -2 v4 M3 -2 v4" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
        </Part>
      </g>
      <g transform={place(144, 231)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={10} ry={5.5} fill={DEEP} stroke={OUTLINE} strokeWidth={4} />
          <path d="M-4 -2 v4 M3 -2 v4" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
        </Part>
      </g>
      {/* 头（婴儿比例大头+小圆耳） */}
      <g fill={FUR} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={92} cy={88} r={11} />
        <circle cx={164} cy={88} r={11} />
      </g>
      <ellipse cx={128} cy={116} rx={45} ry={39} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 奶油口鼻区 */}
      <ellipse cx={128} cy={134} rx={24} ry={15} fill={CREAM} />
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={110} cx2={146} cy={108} r={10} mouthY={136} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={128} cy={128} rx={7} ry={5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} />
        <path d="M104 126 h-9 M105 133 h-8 M152 126 h9 M151 133 h8" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" opacity={0.55} />
        <Blush cx1={100} cx2={156} cy={124} />
      </g>
      {/* 头顶：肥皂泡刘海（三颗泡泡，headtop 呼吸摇） */}
      <g transform={place(128, 80)}>
        <Part name="headtop" origin="50% 100%">
          <g stroke={SEA} strokeWidth={2.6}>
            <circle cx={-11} cy={-4} r={7} fill={BUBBLE} opacity={0.9} />
            <circle cx={4} cy={-9} r={9} fill={BUBBLE} opacity={0.9} />
            <circle cx={14} cy={-1} r={5.5} fill={BUBBLE} opacity={0.9} />
          </g>
          <circle cx={1} cy={-12} r={2} fill="#FFFFFF" />
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

/** 侧视（右向）：修长直立迈步，口鼻朝前，粗尾拖后上翘，泡泡刘海前飘。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 粗尾（身后拖地上翘） */}
      <g transform={place(102, 226)}>
        <Part name="tail" origin="90% 80%">
          <path
            d="M0 4 Q-26 6 -36 -10 Q-40 -22 -34 -28 Q-29 -16 -19 -11 Q-7 -6 0 4 Z"
            fill={DEEP}
            stroke={OUTLINE}
            strokeWidth={5}
            strokeLinejoin="round"
          />
        </Part>
      </g>
      {/* 远侧手 */}
      <g transform={place(118, 180, 18)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={DEEP} rx={6} ry={10} />
        </Part>
      </g>
      {/* 身体（修长直立侧视） */}
      <path
        d="M106 226 Q102 172 116 150 Q124 140 132 142 Q142 146 150 158 Q158 180 152 226 Q128 236 106 226 Z"
        fill={FUR}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 奶油胸线（体前） */}
      <path d="M136 160 Q146 158 149 168 Q153 196 148 222 Q140 226 133 222 Q130 190 136 160 Z" fill={CREAM} opacity={0.95} />
      {/* 小脚（蹼足迈步） */}
      <g transform={place(116, 231)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={9.5} ry={5.5} fill={DEEP} stroke={OUTLINE} strokeWidth={4} />
          <path d="M-3 -2 v4 M3 -2 v4" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
        </Part>
      </g>
      <g transform={place(144, 231)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={9.5} ry={5.5} fill={DEEP} stroke={OUTLINE} strokeWidth={4} />
          <path d="M-3 -2 v4 M3 -2 v4" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
        </Part>
      </g>
      {/* 近侧手（摆臂） */}
      <g transform={place(142, 178, -28)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={FUR} rx={6.5} ry={11} />
        </Part>
      </g>
      {/* 头（大头前倾）+ 双耳 */}
      <g fill={FUR} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={106} cy={90} r={10} />
        <circle cx={148} cy={82} r={10} />
      </g>
      <ellipse cx={134} cy={112} rx={43} ry={37} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 奶油口鼻（朝前） */}
      <ellipse cx={162} cy={126} rx={19} ry={13} fill={CREAM} />
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={150} cy={106} r={10.5} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={169} cy={119} rx={6} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} />
        <path d="M166 132 q5 4 10 0" fill="none" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
        <path d="M180 124 h8 M179 130 h8" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" opacity={0.55} />
        <ellipse cx={140} cy={126} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：肥皂泡刘海（前飘） */}
      <g transform={place(134, 76)}>
        <Part name="headtop" origin="50% 100%">
          <g stroke={SEA} strokeWidth={2.6}>
            <circle cx={-9} cy={-3} r={6.5} fill={BUBBLE} opacity={0.9} />
            <circle cx={5} cy={-8} r={8.5} fill={BUBBLE} opacity={0.9} />
            <circle cx={15} cy={0} r={5} fill={BUBBLE} opacity={0.9} />
          </g>
          <circle cx={2} cy={-11} r={2} fill="#FFFFFF" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：仰面朝天的浮水式——肚皮朝上，双手搭肚，蹼足翘起，泡泡飘头顶。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 粗尾（右端贴地，尖上翘） */}
      <g transform={place(192, 222)}>
        <Part name="tail" origin="10% 80%">
          <path d="M0 6 Q20 4 26 -10 Q28 -18 22 -22 Q18 -12 10 -6 Q3 -1 0 6 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 身体（仰躺长条，肚皮朝上） */}
      <path
        d="M76 218 Q74 198 96 192 Q128 184 160 192 Q182 198 180 218 Q128 234 76 218 Z"
        fill={FUR}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 朝天肚皮 */}
      <ellipse cx={130} cy={202} rx={34} ry={11} fill={CREAM} opacity={0.95} />
      {/* 蹼足翘起（右端浮水式） */}
      <g transform={place(172, 200, -52)}>
        <Part name="legL" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={9} ry={5} fill={DEEP} stroke={OUTLINE} strokeWidth={3.6} />
          <path d="M-3 -2 v4 M3 -2 v4" stroke={OUTLINE} strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />
        </Part>
      </g>
      <g transform={place(184, 206, -34)}>
        <Part name="legR" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={9} ry={5} fill={DEEP} stroke={OUTLINE} strokeWidth={3.6} />
          <path d="M-3 -2 v4 M3 -2 v4" stroke={OUTLINE} strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />
        </Part>
      </g>
      {/* 双手搭在肚皮上 */}
      <g transform={place(118, 194, 74)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={FUR} rx={5.5} ry={9} />
        </Part>
      </g>
      <g transform={place(146, 194, -106)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={FUR} rx={5.5} ry={9} />
        </Part>
      </g>
      {/* 头（枕地仰面）+ 双耳 */}
      <g fill={FUR} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={50} cy={172} r={9} />
        <circle cx={102} cy={168} r={9} />
      </g>
      <ellipse cx={76} cy={192} rx={36} ry={31} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={76} cy={206} rx={19} ry={11} fill={CREAM} />
      {/* 脸（睡颜朝天） */}
      <g className="part-face">
        <ExpFace cx1={62} cx2={92} cy={186} r={8.5} mouthY={210} mouthW={10} expression={expression} base={eyes} />
        <ellipse cx={76} cy={201} rx={6} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} />
        <path d="M56 200 h-8 M57 206 h-7 M96 200 h8 M95 206 h7" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" opacity={0.55} />
        <Blush cx1={54} cx2={98} cy={198} />
      </g>
      {/* 头顶：泡泡刘海斜飘 + 一颗梦泡 */}
      <g transform={place(72, 160)}>
        <Part name="headtop" origin="50% 100%">
          <g stroke={SEA} strokeWidth={2.4}>
            <circle cx={-8} cy={-2} r={6} fill={BUBBLE} opacity={0.9} />
            <circle cx={5} cy={-6} r={7.5} fill={BUBBLE} opacity={0.9} />
            <circle cx={16} cy={-14} r={4.5} fill={BUBBLE} opacity={0.85} />
          </g>
          <circle cx={3} cy={-9} r={1.8} fill="#FFFFFF" />
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

// 肥皂泡沫：2~3 颗泡泡簇 + 高光（洗车獭一按泡沫喷一脸）
const soapSuds: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeWidth={2}>
    <circle cx={-4} cy={2} r={5} fill={BUBBLE} opacity={0.9} />
    <circle cx={4} cy={0} r={4} fill={BUBBLE} opacity={0.9} />
    <circle cx={0} cy={-5} r={3.2} fill={BUBBLE} opacity={0.9} />
    <g fill="#FFFFFF" stroke="none">
      <circle cx={-5.6} cy={0.4} r={1.4} />
      <circle cx={2.6} cy={-1.4} r={1} />
    </g>
  </g>
);
// 海绵：圆角块 + 几个孔
const sponge: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <rect x={-9} y={-6} width={18} height={12} rx={3} fill="#F5D97A" strokeWidth={2.4} />
    <path d="M-9 -2 Q0 -5 9 -2 L9 -3 Q9 -6 6 -6 L-6 -6 Q-9 -6 -9 -3 Z" fill="#57B84C" strokeWidth={2} />
    <g fill={DEEP} stroke="none">
      <circle cx={-4} cy={2} r={1.3} />
      <circle cx={2} cy={3} r={1.1} />
      <circle cx={5} cy={0} r={1.2} />
    </g>
  </g>
);
// 刮水器：橡胶刮条 + 手柄
const squeegee: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <rect x={-1.8} y={-11} width={3.6} height={9} rx={1.5} fill={SEA} strokeWidth={2} />
    <rect x={-9} y={-3} width={18} height={4} rx={1.5} fill="#5C6172" strokeWidth={2.2} />
    <path d="M-9 1 L9 1 L8 6 L-8 6 Z" fill="#3E4356" strokeWidth={2.2} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.05,
    palette: { body: FUR, deep: DEEP, belly: CREAM, accent: SEA, accent2: BUBBLE },
    foodAnchor: { x: 130, y: 136 },
    shadowRx: 48,
  },
  // 吹风机：机身 + 手柄 + 出风口风线
  tool: () => (
    <g>
      <path d="M-4 0 L4 0 L6 -16 L-6 -16 Z" fill="#F5A8C6" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <path d="M-14 -16 Q-16 -34 0 -34 Q10 -34 12 -26 Q13 -20 8 -17 Q-4 -14 -14 -16 Z" fill="#F5A8C6" stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      <ellipse cx={-13} cy={-24} rx={3.4} ry={7} fill="#5C6172" stroke={OUTLINE} strokeWidth={2.4} />
      <circle cx={4} cy={-26} r={2.2} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={1.6} />
      <path d="M-20 -28 q-5 2 -7 6 M-19 -21 q-4 1 -6 4" fill="none" stroke={SEA} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 178, y: 204 },
    baseAngle: (-Math.PI * 2) / 3,
    cone: 0.55,
    shapes: [soapSuds, sponge, squeegee],
  },
  meta: {
    nameZh: "泡澡獭",
    elements: ["normal", "water"],
    family: "四足兽",
    toolAnchor: { x: 188, y: 231 },
    nodeBudget: 130,
    lieNote: "仰面朝天躺，双手搭肚皮（浮水式）",
  },
};
