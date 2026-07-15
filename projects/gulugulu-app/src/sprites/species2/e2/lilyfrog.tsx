// ---------------------------------------------------------------------------
// 荷叶蛙 lilyfrog — e2（grass+water）· 双足小人
// 剪影：蹲坐宽扁小青蛙，头顶荷叶圆帽（招牌），鼓着半透明喉囊泡。
// 睡姿（P3）：蹲姿趴倒，荷叶帽盖住全身当被子。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const SKIN = "#6FBF6B";
const DEEP = "#4E9A4A";
const CREAM = "#FFF4DC";
const SEA = "#2E7BD6";
const LOTUS = "#F5A8C6";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小水花尾饰（左下，青蛙没尾巴就给一朵小水花） */}
      <g transform={place(76, 222)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-10 -2 -14 -10 Q-8 -10 -4 -6 Q-6 -12 -4 -16 Q2 -10 2 -4 Z" fill={SEA} opacity={0.85} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 身体（宽扁蹲坐，头身一体） */}
      <path
        d="M76 208 Q74 158 104 144 Q128 134 152 144 Q182 158 180 208 Q178 228 128 230 Q78 228 76 208 Z"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 喉囊泡（半透明鼓起） */}
      <ellipse cx={128} cy={206} rx={26} ry={16} fill="#CFEBD1" opacity={0.9} stroke={OUTLINE} strokeWidth={3.4} />
      <ellipse cx={121} cy={201} rx={5} ry={3.4} fill="#FFFFFF" opacity={0.8} />
      {/* 大腿蹲坐鼓包 + 蹼足 */}
      <path d="M84 204 Q76 216 86 226 M172 204 Q180 216 170 226" fill="none" stroke={DEEP} strokeWidth={4.5} strokeLinecap="round" />
      <g transform={place(104, 231)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-10 0 L-2 -6 L4 0 M-6 0 L0 -5 L6 0" fill={SKIN} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(152, 231)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-4 0 L2 -6 L10 0 M-6 0 L0 -5 L6 0" fill={SKIN} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 小蹼手（撑在身前） */}
      <g transform={place(96, 210, 24)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 Q-2 8 -8 12 M0 0 Q0 9 -2 14 M0 0 Q4 8 3 13" fill="none" stroke={SKIN} strokeWidth={5.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(160, 210, -24)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 Q2 8 8 12 M0 0 Q0 9 2 14 M0 0 Q-4 8 -3 13" fill="none" stroke={SKIN} strokeWidth={5.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 突出的大眼包（青蛙签名：眼睛长在头顶包上） */}
      <g fill={SKIN} stroke={OUTLINE} strokeWidth={5}>
        <circle cx={102} cy={142} r={17} />
        <circle cx={154} cy={142} r={17} />
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={102} cx2={154} cy={142} r={9.5} mouthY={176} mouthW={20} expression={expression} base={eyes} />
        <Blush cx1={92} cx2={164} cy={166} />
      </g>
      {/* 头顶：荷叶圆帽 + 一粒莲蓬芽（headtop 呼吸摇） */}
      <g transform={place(128, 134)}>
        <Part name="headtop" origin="50% 100%">
          <path
            d="M0 0 Q-30 2 -36 -8 Q-20 -22 0 -22 Q20 -22 36 -8 Q30 2 0 0 Z"
            fill={DEEP}
            stroke={OUTLINE}
            strokeWidth={4.5}
            strokeLinejoin="round"
          />
          <path d="M-24 -8 Q0 -14 24 -8" fill="none" stroke="#8CD97B" strokeWidth={2.6} strokeLinecap="round" />
          <g transform="translate(12 -20)">
            <circle cx={0} cy={-4} r={5.5} fill={LOTUS} stroke={OUTLINE} strokeWidth={2.8} />
            <path d="M0 -9 Q-1 -12 0 -14" stroke={OUTLINE} strokeWidth={2} strokeLinecap="round" fill="none" />
          </g>
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

/** 侧视（右向）：宽扁蛙蹲步向前，眼包在前上，喉囊鼓在前下，荷叶帽前倾。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小水花尾饰（身后） */}
      <g transform={place(74, 220)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-10 -2 -14 -10 Q-8 -10 -4 -6 Q-6 -12 -4 -16 Q2 -10 2 -4 Z" fill={SEA} opacity={0.85} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 身体（宽扁蹲坐侧视） */}
      <path
        d="M84 206 Q80 160 110 146 Q136 136 160 150 Q182 162 176 206 Q170 228 126 230 Q88 226 84 206 Z"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 大腿蹲坐鼓包（后腿折叠） */}
      <path d="M96 192 Q84 206 94 224" fill="none" stroke={DEEP} strokeWidth={4.5} strokeLinecap="round" />
      {/* 喉囊泡（前下鼓起） */}
      <ellipse cx={152} cy={206} rx={21} ry={14} fill="#CFEBD1" opacity={0.9} stroke={OUTLINE} strokeWidth={3.4} />
      <ellipse cx={146} cy={201} rx={4.5} ry={3} fill="#FFFFFF" opacity={0.8} />
      {/* 后蹼足（迈步） */}
      <g transform={place(102, 231)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-10 0 L-2 -6 L4 0 M-6 0 L0 -5 L6 0" fill={SKIN} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(120, 231)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-6 0 L2 -6 L8 0 M-4 0 L2 -5 L8 0" fill={SKIN} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 前蹼手（撑地小手） */}
      <g transform={place(150, 222, 10)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 Q-2 6 -6 9 M0 0 Q1 7 0 10 M0 0 Q4 6 4 9" fill="none" stroke={DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(164, 220, -8)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 Q-2 7 -6 10 M0 0 Q1 8 0 11 M0 0 Q5 7 5 10" fill="none" stroke={SKIN} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 突出眼包（前上单侧） */}
      <circle cx={156} cy={136} r={17} fill={SKIN} stroke={OUTLINE} strokeWidth={5} />
      {/* 脸 */}
      <g className="part-face">
        <ExpSideFace cx={158} cy={134} r={10.5} mouthX={168} mouthY={172} mouthW={16} expression={expression} base={eyes} />
        <ellipse cx={146} cy={166} rx={7.5} ry={5} fill="#F5A8C6" opacity={0.6} />
      </g>
      {/* 头顶：荷叶帽（靠后戴，不遮眼）+ 莲蓬芽 */}
      <g transform={place(118, 128)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(-4)">
            <path
              d="M0 0 Q-30 2 -36 -8 Q-20 -22 0 -22 Q20 -22 36 -8 Q30 2 0 0 Z"
              fill={DEEP}
              stroke={OUTLINE}
              strokeWidth={4.5}
              strokeLinejoin="round"
            />
            <path d="M-24 -8 Q0 -14 24 -8" fill="none" stroke="#8CD97B" strokeWidth={2.6} strokeLinecap="round" />
            <g transform="translate(12 -20)">
              <circle cx={0} cy={-4} r={5.5} fill={LOTUS} stroke={OUTLINE} strokeWidth={2.8} />
              <path d="M0 -9 Q-1 -12 0 -14" stroke={OUTLINE} strokeWidth={2} strokeLinecap="round" fill="none" />
            </g>
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：蹲姿趴倒，荷叶帽放大盖住全身当被子，只露脸和脚尖。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小水花（头旁） */}
      <g transform={place(54, 222)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-9 -2 -12 -9 Q-7 -9 -4 -5 Q-5 -11 -3 -14 Q2 -9 2 -4 Z" fill={SEA} opacity={0.85} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 身体（趴平的低墩，被叶被覆盖大半） */}
      <ellipse cx={138} cy={214} rx={46} ry={17} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      {/* 探出叶被的头（左前）+ 眼包 */}
      <ellipse cx={88} cy={206} rx={27} ry={21} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      <g fill={SKIN} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={76} cy={192} r={12} />
        <circle cx={102} cy={190} r={12} />
      </g>
      {/* 小蹼手（叶被前缘下露出） */}
      <g transform={place(112, 226, 12)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 Q-2 5 -5 7 M0 0 Q1 6 0 8 M0 0 Q3 5 3 7" fill="none" stroke={DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(126, 228, -8)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 Q-2 5 -5 7 M0 0 Q1 6 0 8 M0 0 Q3 5 3 7" fill="none" stroke={DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={76} cx2={102} cy={192} r={7.5} mouthY={212} mouthW={12} expression={expression} base={eyes} />
        <Blush cx1={68} cx2={110} cy={206} />
      </g>
      {/* 荷叶被（放大盖住全身，随呼吸轻掀） */}
      <g transform={place(142, 224)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(3)">
            <path
              d="M-44 0 Q-58 -10 -52 -26 Q-20 -52 20 -50 Q56 -46 64 -22 Q66 -6 50 2 Q0 10 -44 0 Z"
              fill={DEEP}
              stroke={OUTLINE}
              strokeWidth={5}
              strokeLinejoin="round"
            />
            <path d="M-36 -22 Q4 -34 48 -20" fill="none" stroke="#8CD97B" strokeWidth={2.8} strokeLinecap="round" />
            <g transform="translate(30 -44)">
              <circle cx={0} cy={-4} r={5.5} fill={LOTUS} stroke={OUTLINE} strokeWidth={2.8} />
              <path d="M0 -9 Q-1 -12 0 -14" stroke={OUTLINE} strokeWidth={2} strokeLinecap="round" fill="none" />
            </g>
          </g>
        </Part>
      </g>
      {/* 脚尖从叶被右缘露出 */}
      <g transform={place(196, 228, -10)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-6 0 L0 -5 L6 0 M-3 0 L3 -4 L8 0" fill={SKIN} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(182, 231, 6)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-6 0 L0 -5 L6 0 M-3 0 L3 -4 L8 0" fill={SKIN} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
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

const rainDrop: ParticleRenderer = () => (
  <path d="M0 -7 q5.5 6.5 5.5 10.5 a5.5 5.5 0 0 1 -11 0 q0 -4 5.5 -10.5 z" fill="#9BDCFF" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);
const petalBit: ParticleRenderer = () => (
  <path d="M0 -7 Q6 -3 4 4 Q0 8 -4 4 Q-6 -3 0 -7 Z" fill={LOTUS} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);
const bubbleBit: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={6} fill="#EAF7FF" opacity={0.6} stroke="#9BDCFF" strokeWidth={2.2} />
    <circle cx={-2} cy={-2} r={1.6} fill="#FFFFFF" />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.2,
    palette: { body: SKIN, deep: DEEP, belly: CREAM, accent: SEA, accent2: LOTUS },
    foodAnchor: { x: 128, y: 176 },
    shadowRx: 62,
  },
  // 荷叶伞：卷边荷叶 + 弯柄，滴着水珠
  tool: () => (
    <g>
      <path d="M0 0 Q-2 -20 2 -34" fill="none" stroke="#4E9A4A" strokeWidth={4.5} strokeLinecap="round" />
      <path
        d="M2 -34 Q-24 -32 -30 -42 Q-14 -56 4 -54 Q24 -52 32 -40 Q22 -30 2 -34 Z"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth={3.6}
        strokeLinejoin="round"
      />
      <path d="M-18 -42 Q2 -46 22 -40" fill="none" stroke={DEEP} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M26 -34 q1 5 -2 8 a3.4 3.4 0 0 1 -5 -3 q0 -3 7 -5 z" fill="#9BDCFF" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 194, y: 188 },
    baseAngle: -Math.PI / 2.2,
    cone: 0.6,
    shapes: [rainDrop, petalBit, bubbleBit],
  },
  meta: {
    nameZh: "荷叶蛙",
    elements: ["grass", "water"],
    family: "双足小人",
    toolAnchor: { x: 192, y: 231 },
    nodeBudget: 130,
    lieNote: "蹲姿趴倒，荷叶帽盖住全身当被子",
  },
};
