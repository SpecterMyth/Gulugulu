// ---------------------------------------------------------------------------
// 桑拿豚 saunapuff — e3（fire+ice+water）· 鱼类水栖（漂浮）
// 剪影：鼓成球的小河豚，刺=软软的桑拿木钉，头顶卷毛巾（e3 装饰），
//       上暖下霜双色身。呼吸自成节奏。
// 睡姿（P3）：彻底泄气瘪成一张饼，随呼吸微鼓。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { FlipperArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const WARM = "#F0A868";
const WARM_DEEP = "#D18248";
const FROST = "#CFEFF6";
const CREAM = "#FFF0DC";
const PEG = "#B98A4E";
const STEAM = "#FFFFFF";

/** 一根桑拿木钉刺（pivot=根部向外） */
function WoodPeg({ r = 0 }: { r?: number }) {
  return (
    <g transform={`rotate(${r})`}>
      <path d="M-4 0 L4 0 L2.6 -12 Q0 -14 -2.6 -12 Z" fill={PEG} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
    </g>
  );
}

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 木钉刺一圈（先画根部被身体压住） */}
      <g>
        <g transform={place(75, 158)}><WoodPeg r={-62} /></g>
        <g transform={place(89, 132)}><WoodPeg r={-38} /></g>
        <g transform={place(112, 118)}><WoodPeg r={-14} /></g>
        <g transform={place(144, 118)}><WoodPeg r={14} /></g>
        <g transform={place(167, 132)}><WoodPeg r={38} /></g>
        <g transform={place(181, 158)}><WoodPeg r={62} /></g>
        <g transform={place(70, 190)}><WoodPeg r={-84} /></g>
        <g transform={place(186, 190)}><WoodPeg r={84} /></g>
      </g>
      {/* 尾鳍（右下小扇尾） */}
      <g transform={place(182, 208, 30)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 0 Q14 -8 20 -2 Q16 4 12 4 Q16 8 18 12 Q10 14 2 8 Q0 4 0 0 Z" fill={WARM_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 球身：上暖下霜（冷热同体） */}
      <circle cx={128} cy={172} r={56} fill={WARM} stroke={OUTLINE} strokeWidth={6} />
      <path d="M74 186 Q128 166 182 186 Q176 222 128 228 Q80 222 74 186 Z" fill={FROST} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
      <ellipse cx={128} cy={196} rx={28} ry={14} fill={CREAM} opacity={0.9} />
      {/* 小鳍手 */}
      <g transform={place(80, 178, 30)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={WARM_DEEP} len={16} mirror />
        </Part>
      </g>
      <g transform={place(176, 178, -30)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={WARM_DEEP} len={16} />
        </Part>
      </g>
      {/* 脸（嘟嘟嘴河豚） */}
      <g className="part-face">
        <ExpFace cx1={106} cx2={150} cy={160} r={10} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={128} cy={182} rx={8} ry={6.5} fill={WARM_DEEP} stroke={OUTLINE} strokeWidth={3.4} />
        <ellipse cx={126} cy={180} rx={2.4} ry={1.8} fill="#FFF0DC" opacity={0.8} />
        <Blush cx1={94} cx2={162} cy={176} />
      </g>
      {/* 头顶：卷毛巾（e3 装饰）+ 一缕蒸汽 */}
      <g transform={place(128, 118)}>
        <Part name="headtop" origin="50% 100%">
          <g stroke={OUTLINE} strokeWidth={3.4}>
            <rect x={-17} y={-12} width={34} height={12} rx={6} fill="#FFFFFF" />
            <path d="M-17 -6 h34" strokeWidth={0} stroke="none" />
          </g>
          <path d="M-10 -6 v-4 M0 -7 v-4 M10 -6 v-4" stroke="#8FD8E8" strokeWidth={2.4} strokeLinecap="round" />
          <path d="M20 -14 q3 -6 -1 -11" fill="none" stroke={STEAM} strokeWidth={3} strokeLinecap="round" opacity={0.95} />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(192, 228)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：鼓球前飘，嘟嘟嘴朝前，木钉沿背排开，尾鳍在后打水。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 背侧木钉（后半圈） */}
      <g>
        <g transform={place(86, 150)}><WoodPeg r={-52} /></g>
        <g transform={place(104, 128)}><WoodPeg r={-26} /></g>
        <g transform={place(132, 118)}><WoodPeg r={0} /></g>
        <g transform={place(160, 126)}><WoodPeg r={26} /></g>
        <g transform={place(78, 178)}><WoodPeg r={-78} /></g>
      </g>
      {/* 尾鳍（身后打水） */}
      <g transform={place(80, 196, 12)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-14 -8 -20 -2 Q-16 4 -12 4 Q-16 8 -18 12 Q-10 14 -2 8 Q0 4 0 0 Z" fill={WARM_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 球身：上暖下霜 */}
      <circle cx={132} cy={172} r={54} fill={WARM} stroke={OUTLINE} strokeWidth={6} />
      <path d="M80 186 Q132 166 184 186 Q178 220 132 226 Q86 220 80 186 Z" fill={FROST} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
      <ellipse cx={146} cy={198} rx={24} ry={12} fill={CREAM} opacity={0.9} />
      {/* 小鳍手（前后划水） */}
      <g transform={place(102, 200, 36)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={WARM_DEEP} len={15} mirror />
        </Part>
      </g>
      <g transform={place(152, 206, -18)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={WARM_DEEP} len={16} />
        </Part>
      </g>
      {/* 脸（嘟嘟嘴朝前） */}
      <g className="part-face">
        <ExpSideFace cx={160} cy={156} r={10} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={177} cy={176} rx={7} ry={6} fill={WARM_DEEP} stroke={OUTLINE} strokeWidth={3.2} />
        <ellipse cx={175} cy={174} rx={2} ry={1.6} fill="#FFF0DC" opacity={0.8} />
        <ellipse cx={150} cy={176} rx={7.5} ry={5} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 头顶：卷毛巾（前倾）+ 蒸汽 */}
      <g transform={place(134, 116, 6)}>
        <Part name="headtop" origin="50% 100%">
          <g stroke={OUTLINE} strokeWidth={3.4}>
            <rect x={-17} y={-12} width={34} height={12} rx={6} fill="#FFFFFF" />
          </g>
          <path d="M-10 -6 v-4 M0 -7 v-4 M10 -6 v-4" stroke="#8FD8E8" strokeWidth={2.4} strokeLinecap="round" />
          <path d="M20 -14 q3 -6 -1 -11" fill="none" stroke="#8FD8E8" strokeWidth={3} strokeLinecap="round" opacity={0.95} />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：彻底泄气瘪成一张饼贴地，木钉塌在饼边，毛巾歪盖，嘴角漏小汽。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 塌在饼边的木钉（外倒） */}
      <g>
        <g transform={place(66, 214)}><WoodPeg r={-84} /></g>
        <g transform={place(84, 202)}><WoodPeg r={-44} /></g>
        <g transform={place(120, 196)}><WoodPeg r={-8} /></g>
        <g transform={place(156, 198)}><WoodPeg r={24} /></g>
        <g transform={place(186, 210)}><WoodPeg r={78} /></g>
      </g>
      {/* 尾鳍（摊地） */}
      <g transform={place(196, 226, 34)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 0 Q12 -7 18 -2 Q14 3 11 3 Q14 7 16 10 Q9 12 2 7 Q0 3 0 0 Z" fill={WARM_DEEP} stroke={OUTLINE} strokeWidth={3.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 瘪饼身（上暖下霜压扁成一张饼） */}
      <path
        d="M58 224 Q56 204 88 200 Q128 194 168 200 Q200 204 198 224 Q128 240 58 224 Z"
        fill={WARM}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d="M62 220 Q128 208 194 220 Q170 232 128 233 Q86 232 62 220 Z" fill={FROST} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      {/* 小鳍手（摊平两侧） */}
      <g transform={place(68, 216, 64)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={WARM_DEEP} len={13} mirror />
        </Part>
      </g>
      <g transform={place(188, 216, -64)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={WARM_DEEP} len={13} />
        </Part>
      </g>
      {/* 脸（瘪着嘟嘴睡，嘴角漏汽） */}
      <g className="part-face">
        <ExpFace cx1={108} cx2={150} cy={212} r={8.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={128} cy={224} rx={7} ry={5} fill={WARM_DEEP} stroke={OUTLINE} strokeWidth={3} />
        <Blush cx1={96} cx2={162} cy={222} />
        <path d="M142 228 q6 2 9 -2 q1 -4 -2 -6" fill="none" stroke="#8FD8E8" strokeWidth={2.6} strokeLinecap="round" opacity={0.9} />
      </g>
      {/* 头顶：毛巾歪盖在饼顶 */}
      <g transform={place(96, 200, -12)}>
        <Part name="headtop" origin="50% 100%">
          <g stroke={OUTLINE} strokeWidth={3.2}>
            <rect x={-15} y={-11} width={30} height={11} rx={5.5} fill="#FFFFFF" />
          </g>
          <path d="M-9 -5.5 v-3.5 M0 -6 v-3.5 M9 -5.5 v-3.5" stroke="#8FD8E8" strokeWidth={2.2} strokeLinecap="round" />
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

// 桑拿房产物：桑拿水勺 + 叠好的毛巾 + 白桦树枝束
const saunaLadle: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round" strokeLinecap="round">
    <path d="M-9 -2 A6 6 0 0 0 3 -2 Z" fill={WARM_DEEP} strokeWidth={2.2} />
    <path d="M2 -2 L10 -10" fill="none" strokeWidth={3} stroke={PEG} />
  </g>
);
const foldedTowel: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round" strokeWidth={2}>
    <rect x={-9} y={2} width={18} height={5} rx={2.5} fill={CREAM} />
    <rect x={-8} y={-3} width={16} height={5} rx={2.5} fill={FROST} />
    <rect x={-7} y={-8} width={14} height={5} rx={2.5} fill={STEAM} />
    <path d="M-3 -8 V-3 M-3 2 V7" fill="none" strokeWidth={1.2} stroke={WARM_DEEP} />
  </g>
);
const birchWhisk: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round" strokeLinecap="round">
    <g fill="#7CB342" strokeWidth={1.6}>
      <path d="M0 4 Q-8 -2 -8 -9 Q-3 -6 0 4 Z" />
      <path d="M0 4 Q-3 -6 0 -11 Q3 -6 0 4 Z" />
      <path d="M0 4 Q8 -2 8 -9 Q3 -6 0 4 Z" />
    </g>
    <path d="M-2 4 L2 10" fill="none" strokeWidth={3} stroke={PEG} />
    <path d="M-2 5 h5" fill="none" strokeWidth={1.6} stroke={WARM_DEEP} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.15,
    palette: { body: WARM, deep: WARM_DEEP, belly: CREAM, accent: "#E85D3A", accent2: "#8FD8E8" },
    floating: true,
    shadowRx: 46,
    foodAnchor: { x: 128, y: 184 },
  },
  // 热水袋：绒面袋身 + 螺纹口塞 + 暖气纹
  tool: () => (
    <g>
      <path d="M-14 0 Q-18 -8 -16 -20 Q-14 -32 0 -32 Q14 -32 16 -20 Q18 -8 14 0 Q0 4 -14 0 Z" fill="#E2432E" stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      <path d="M-10 -10 Q0 -14 10 -10 M-11 -18 Q0 -22 11 -18" fill="none" stroke="#F5917B" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M-4 -32 L4 -32 L3 -40 L-3 -40 Z" fill="#F5A83B" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
      <path d="M-6 -40 h12" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M18 -26 q4 -4 2 -9 M23 -20 q4 -4 2 -9" fill="none" stroke={STEAM} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 196, y: 196 },
    baseAngle: -Math.PI / 2.2,
    cone: 0.6,
    shapes: [saunaLadle, foldedTowel, birchWhisk],
  },
  meta: {
    nameZh: "桑拿豚",
    elements: ["fire", "ice", "water"],
    family: "鱼类水栖",
    toolAnchor: { x: 192, y: 228 },
    nodeBudget: 170,
    lieNote: "彻底泄气瘪成一张饼，随呼吸微鼓",
  },
};
