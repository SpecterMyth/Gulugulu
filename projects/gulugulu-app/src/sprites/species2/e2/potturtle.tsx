// ---------------------------------------------------------------------------
// 花盆龟 potturtle — e2（grass+normal）· 甲壳
// 剪影：小乌龟背着陶土花盆当壳（招牌），盆里一株嫩芽小花，探头探脑。
// 睡姿（P3）：头脚全缩进花盆，只剩盆和芽。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const SKIN = "#9CBF7A";
const DEEP = "#7A9A5A";
const CREAM = "#FFF4DC";
const POT = "#C9704A";
const POT_DEEP = "#A5522F";
const LEAF = "#8CD97B";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小短龟尾（右下探出） */}
      <g transform={place(178, 218)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 0 Q10 -2 12 -10 Q4 -10 0 -6 Z" fill={SKIN} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 盆里的嫩芽小花（先画，盆沿压住茎根；headtop 呼吸摇） */}
      <g transform={place(128, 132)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 4 Q-2 -10 2 -20" fill="none" stroke={DEEP} strokeWidth={4} strokeLinecap="round" />
          <path d="M-1 -8 q-11 -2 -13 -12 q11 0 13 10 z" fill={LEAF} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
          <g transform="translate(3 -24)">
            <g fill="#F5A8C6" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round">
              <circle cx={0} cy={-6} r={4.5} />
              <circle cx={-5.5} cy={-1} r={4.5} />
              <circle cx={5.5} cy={-1} r={4.5} />
              <circle cx={-3.4} cy={4.6} r={4.5} />
              <circle cx={3.4} cy={4.6} r={4.5} />
            </g>
            <circle cx={0} cy={0} r={3.4} fill="#FFD93B" stroke={OUTLINE} strokeWidth={2.4} />
          </g>
        </Part>
      </g>
      {/* 花盆壳（倒梯形陶盆 + 宽盆沿） */}
      <g>
        <path d="M84 156 L172 156 L162 210 Q128 218 94 210 Z" fill={POT} stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round" />
        <rect x={76} y={140} width={104} height={18} rx={6} fill={POT} stroke={OUTLINE} strokeWidth={5.5} />
        <path d="M92 166 Q128 174 164 166" fill="none" stroke={POT_DEEP} strokeWidth={3.4} strokeLinecap="round" />
        <path d="M84 148 h18" stroke="#E39B70" strokeWidth={3} strokeLinecap="round" />
        {/* 盆土 */}
        <path d="M96 140 Q128 132 160 140 L160 144 Q128 138 96 144 Z" fill="#8A5A3B" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
      </g>
      {/* 头（从盆前下方探出——大头比例） */}
      <ellipse cx={128} cy={192} rx={41} ry={36} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={128} cy={208} rx={24} ry={13} fill={CREAM} opacity={0.95} />
      {/* 小手 */}
      <g transform={place(84, 206, 24)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6.5} ry={9} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={place(172, 206, -24)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6.5} ry={9} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(106, 232)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(150, 232)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={110} cx2={146} cy={186} r={10} mouthY={205} mouthW={13} expression={expression} base={eyes} />
        <Blush cx1={97} cx2={159} cy={200} />
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

/** 侧视（右向）：背驮花盆爬步，头从盆前探出，嫩芽随行摇。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小短龟尾（身后） */}
      <g transform={place(74, 216)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-10 -2 -12 -10 Q-4 -10 0 -6 Z" fill={SKIN} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 盆里的嫩芽小花（随行，先画被盆沿压根） */}
      <g transform={place(114, 128)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 4 Q-2 -10 2 -20" fill="none" stroke={DEEP} strokeWidth={4} strokeLinecap="round" />
          <path d="M-1 -8 q-11 -2 -13 -12 q11 0 13 10 z" fill={LEAF} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
          <g transform="translate(3 -24)">
            <g fill="#F5A8C6" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round">
              <circle cx={0} cy={-6} r={4.5} />
              <circle cx={-5.5} cy={-1} r={4.5} />
              <circle cx={5.5} cy={-1} r={4.5} />
              <circle cx={-3.4} cy={4.6} r={4.5} />
              <circle cx={3.4} cy={4.6} r={4.5} />
            </g>
            <circle cx={0} cy={0} r={3.4} fill="#FFD93B" stroke={OUTLINE} strokeWidth={2.4} />
          </g>
        </Part>
      </g>
      {/* 远侧腿（先画，深色） */}
      <g transform={place(98, 230)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={DEEP} deep={DEEP} rx={7.5} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(140, 230)}>
        <Part name="armL" origin="50% -30%">
          <StubLeg color={DEEP} deep={DEEP} rx={7.5} ry={4.5} lift={4} />
        </Part>
      </g>
      {/* 花盆壳（驮在背上） */}
      <g>
        <path d="M80 158 L158 158 L150 210 Q116 218 88 210 Z" fill={POT} stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round" />
        <rect x={72} y={142} width={94} height={17} rx={6} fill={POT} stroke={OUTLINE} strokeWidth={5.5} />
        <path d="M88 168 Q120 176 152 168" fill="none" stroke={POT_DEEP} strokeWidth={3.4} strokeLinecap="round" />
        <path d="M80 150 h16" stroke="#E39B70" strokeWidth={3} strokeLinecap="round" />
        <path d="M90 142 Q118 134 150 142 L150 146 Q118 140 90 146 Z" fill="#8A5A3B" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
      </g>
      {/* 头（盆前探出，朝右） */}
      <ellipse cx={168} cy={194} rx={27} ry={24} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={177} cy={206} rx={13} ry={8} fill={CREAM} opacity={0.95} />
      {/* 近侧腿（爬步） */}
      <g transform={place(112, 232)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(152, 232)}>
        <Part name="armR" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      {/* 脸（探头侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={172} cy={188} r={9.5} mouthX={178} mouthY={208} mouthW={10} expression={expression} base={eyes} />
        <ellipse cx={158} cy={202} rx={6.5} ry={4.5} fill="#F5917B" opacity={0.6} />
      </g>
    </Part>
  );
}

/** 趴卧：头脚全缩进花盆——只剩陶盆和嫩芽，盆口黑洞里睡脸微露，脚尖点地。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾尖（右缘微露） */}
      <g transform={place(184, 224)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 0 Q8 -2 10 -8 Q3 -8 0 -5 Z" fill={SKIN} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 花盆（落地整只） */}
      <g>
        <path d="M82 170 L174 170 L164 226 Q128 234 92 226 Z" fill={POT} stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round" />
        <rect x={70} y={152} width={116} height={19} rx={6} fill={POT} stroke={OUTLINE} strokeWidth={5.5} />
        <path d="M90 182 Q128 190 166 182" fill="none" stroke={POT_DEEP} strokeWidth={3.4} strokeLinecap="round" />
        <path d="M80 160 h20" stroke="#E39B70" strokeWidth={3} strokeLinecap="round" />
        <path d="M92 152 Q128 144 164 152 L164 156 Q128 150 92 156 Z" fill="#8A5A3B" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
      </g>
      {/* 盆口洞（缩进去的头，睡脸微露） */}
      <path d="M106 226 Q106 194 128 194 Q150 194 150 226 Q128 232 106 226 Z" fill="#5E2C14" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <ellipse cx={128} cy={218} rx={16} ry={11} fill={SKIN} opacity={0.9} />
      {/* 脸（洞里的睡颜） */}
      <g className="part-face">
        <ExpFace cx1={120} cx2={136} cy={212} r={6} mouthY={224} mouthW={8} expression={expression} base={eyes} />
      </g>
      {/* 四只脚尖（盆底微露点地） */}
      <g transform={place(94, 230)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={6.5} ry={4} fill={SKIN} stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      <g transform={place(112, 232)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={6.5} ry={4} fill={SKIN} stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      <g transform={place(144, 232)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={0} rx={6.5} ry={4} fill={SKIN} stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      <g transform={place(162, 230)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={0} rx={6.5} ry={4} fill={SKIN} stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      {/* 盆顶：嫩芽小花（打盹垂头） */}
      <g transform={place(128, 146)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(14)">
            <path d="M0 4 Q-2 -9 2 -18" fill="none" stroke={DEEP} strokeWidth={4} strokeLinecap="round" />
            <path d="M-1 -7 q-10 -2 -12 -11 q10 0 12 9 z" fill={LEAF} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
            <g transform="translate(3 -22) rotate(22)">
              <g fill="#F5A8C6" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round">
                <circle cx={0} cy={-5.5} r={4.2} />
                <circle cx={-5} cy={-1} r={4.2} />
                <circle cx={5} cy={-1} r={4.2} />
                <circle cx={-3.2} cy={4.2} r={4.2} />
                <circle cx={3.2} cy={4.2} r={4.2} />
              </g>
              <circle cx={0} cy={0} r={3.2} fill="#FFD93B" stroke={OUTLINE} strokeWidth={2.2} />
            </g>
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

// 陶土花盆：橙色梯形盆身 + 盆沿
const terracottaPot: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <rect x={-9} y={-8} width={18} height={5} rx={1.5} fill={POT} strokeWidth={2.4} />
    <path d="M-8 -3 L8 -3 L5 9 L-5 9 Z" fill={POT} strokeWidth={2.4} />
    <path d="M3 -2 L1.5 8" stroke={POT_DEEP} strokeWidth={1.6} strokeLinecap="round" />
  </g>
);
// 移植铲：铲斗 + 木柄
const trowel: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <rect x={-1.8} y={-11} width={3.6} height={9} rx={1.6} fill="#8A5A3B" strokeWidth={2} />
    <rect x={-2.2} y={-3} width={4.4} height={2.6} rx={1} fill="#8E93A6" strokeWidth={1.6} />
    <path d="M-5 -1 L5 -1 L3 8 Q0 12 -3 8 Z" fill="#C8CCD8" strokeWidth={2.4} />
    <path d="M0 0 L0 9" stroke="#8E93A6" strokeWidth={1.4} strokeLinecap="round" />
  </g>
);
// 种子：棕色水滴形 + 高光
const seed: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round" transform="rotate(12)">
    <path d="M0 -8 Q6 -3 5 4 Q3 9 -1 8 Q-6 6 -5 -1 Q-4 -6 0 -8 Z" fill="#8A5A3B" strokeWidth={2.2} />
    <path d="M-1.5 -3 q2 -1 3 1" fill="none" stroke="#D8B48A" strokeWidth={1.4} strokeLinecap="round" />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.15,
    palette: { body: SKIN, deep: DEEP, belly: CREAM, accent: POT, accent2: LEAF },
    foodAnchor: { x: 130, y: 204 },
    shadowRx: 58,
  },
  // 浇水壶：圆壶身 + 花洒嘴洒水
  tool: () => (
    <g>
      <path d="M-14 0 Q-18 -6 -17 -16 Q-16 -26 -4 -26 L2 -26 Q10 -26 10 -16 Q10 -6 6 0 Q-4 3 -14 0 Z" fill="#7FB8D9" stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      <path d="M-12 -26 Q-12 -34 -2 -34 L0 -34" fill="none" stroke={OUTLINE} strokeWidth={3.6} strokeLinecap="round" />
      <path d="M10 -18 L24 -28" stroke={OUTLINE} strokeWidth={4.5} strokeLinecap="round" />
      <ellipse cx={26} cy={-30} rx={4.5} ry={3.4} fill="#5C7FB5" stroke={OUTLINE} strokeWidth={2.4} transform="rotate(-36 26 -30)" />
      <path d="M30 -26 l3 5 M33 -30 l4 4 M35 -35 l5 2" stroke="#9BDCFF" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 218, y: 200 },
    baseAngle: -Math.PI / 2.6,
    cone: 0.5,
    shapes: [terracottaPot, trowel, seed],
  },
  meta: {
    nameZh: "花盆龟",
    elements: ["grass", "normal"],
    family: "甲壳",
    toolAnchor: { x: 192, y: 231 },
    nodeBudget: 165,
    lieNote: "头脚全缩进花盆，只剩盆和芽",
  },
};
