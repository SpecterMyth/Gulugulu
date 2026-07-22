// ---------------------------------------------------------------------------
// 稻草人 scaresprout — e3（grass+normal+water）· 傀儡构装
// 剪影：田间稻草人小神：垂稻穗草帽 + 补丁布身 + 稻草裙摆手脚，
//       背后十字木架（e3 背饰）。守田的老好人。
// 睡姿（P3）：下木架平躺，草帽盖脸（农民午睡式）。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const CLOTH = "#E8D5A8";
const CLOTH_DEEP = "#C9A86A";
const STRAW = "#E2C25C";
const STRAW_DEEP = "#B98A4E";
const LEAF = "#57B84C";
const SEA = "#9BDCFF";

/** 一撮稻草（pivot=束口向下散开） */
function StrawTuft({ w = 16, h = 12 }: { w?: number; h?: number }) {
  const hw = w / 2;
  return (
    <g fill={STRAW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
      <path d={`M${-hw} 0 L${-hw * 0.5} ${h} L${-hw * 0.15} 0 L0 ${h * 1.15} L${hw * 0.2} 0 L${hw * 0.6} ${h} L${hw} 0 Z`} />
    </g>
  );
}

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e3 背饰：背后十字木架（探出左右与头顶后方） */}
      <g stroke={OUTLINE} strokeLinecap="round">
        <path d="M128 84 L128 122" stroke={STRAW_DEEP} strokeWidth={9} />
        <path d="M72 152 L184 152" stroke={STRAW_DEEP} strokeWidth={9} />
        <path d="M128 84 L128 122 M72 152 L184 152" stroke="#8A6410" strokeWidth={3} />
      </g>
      {/* 尾：垂在身后的一束稻穗（左下） */}
      <g transform={place(84, 214, -24)}>
        <Part name="tail" origin="50% 0%">
          <path d="M0 0 Q-2 10 -6 14" fill="none" stroke={STRAW_DEEP} strokeWidth={3} strokeLinecap="round" />
          <g fill={STRAW} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round">
            <ellipse cx={-7} cy={16} rx={2.8} ry={5} transform="rotate(20 -7 16)" />
            <ellipse cx={-2} cy={18} rx={2.8} ry={5} />
          </g>
        </Part>
      </g>
      {/* 布身（补丁围裙裙摆） */}
      <path
        d="M98 158 Q94 150 106 148 L150 148 Q162 150 158 158 Q168 196 158 218 Q128 228 98 218 Q88 196 98 158 Z"
        fill={CLOTH}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 补丁 ×2 + 缝线 */}
      <g>
        <rect x={106} y={180} width={16} height={13} rx={3} fill={LEAF} opacity={0.85} stroke={OUTLINE} strokeWidth={2.4} />
        <rect x={138} y={196} width={13} height={11} rx={3} fill={SEA} opacity={0.85} stroke={OUTLINE} strokeWidth={2.4} />
        <path d="M100 170 q28 8 56 0" fill="none" stroke={CLOTH_DEEP} strokeWidth={2.4} strokeDasharray="4 4" strokeLinecap="round" />
      </g>
      {/* 裙摆下的稻草脚 */}
      <g transform={place(110, 230)}>
        <Part name="legL" origin="50% -40%">
          <StrawTuft w={15} h={11} />
        </Part>
      </g>
      <g transform={place(146, 230)}>
        <Part name="legR" origin="50% -40%">
          <StrawTuft w={15} h={11} />
        </Part>
      </g>
      {/* 稻草手（从袖口漏出的草束 + 一片新芽） */}
      <g transform={place(94, 168, 118)}>
        <Part name="armL" origin="50% 0%">
          <StrawTuft w={14} h={12} />
        </Part>
      </g>
      <g transform={place(162, 168, -118)}>
        <Part name="armR" origin="50% 0%">
          <StrawTuft w={14} h={12} />
        </Part>
      </g>
      <path d="M90 176 q-6 2 -8 8" fill="none" stroke={LEAF} strokeWidth={2.6} strokeLinecap="round" />
      {/* 头（麻布大圆头——婴儿比例） */}
      <circle cx={128} cy={118} r={40} fill={CLOTH} stroke={OUTLINE} strokeWidth={6} />
      <path d="M100 138 q28 11 56 0" fill="none" stroke={CLOTH_DEEP} strokeWidth={2.2} strokeDasharray="4 4" strokeLinecap="round" />
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={112} cx2={144} cy={114} r={9.5} mouthY={134} mouthW={13} expression={expression} base={eyes} />
        <Blush cx1={101} cx2={155} cy={128} />
      </g>
      {/* 头顶：垂稻穗草帽（headtop 呼吸摇） */}
      <g transform={place(128, 94)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-38 4 Q-20 -2 -14 -4 Q-8 -22 0 -22 Q8 -22 14 -4 Q20 -2 38 4 Q20 12 0 12 Q-20 12 -38 4 Z" fill={STRAW} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
          <path d="M-14 -2 Q0 -8 14 -2" fill="none" stroke={STRAW_DEEP} strokeWidth={2.6} strokeLinecap="round" />
          <g transform="translate(24 6)">
            <path d="M0 0 q4 -8 2 -14" fill="none" stroke={STRAW_DEEP} strokeWidth={2.4} strokeLinecap="round" />
            <g fill={STRAW} stroke={OUTLINE} strokeWidth={2}>
              <ellipse cx={2} cy={-14} rx={2.6} ry={4.5} />
              <ellipse cx={5} cy={-9} rx={2.4} ry={4} transform="rotate(-24 5 -9)" />
            </g>
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

/** 侧视（右向）：扛着木架小步走，草帽前倾，稻草手前后摆。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 背后木架（侧视：立杆 + 短横杆） */}
      <g stroke={OUTLINE} strokeLinecap="round">
        <path d="M116 84 L116 122" stroke={STRAW_DEEP} strokeWidth={9} />
        <path d="M96 152 L140 152" stroke={STRAW_DEEP} strokeWidth={9} />
        <path d="M116 84 L116 122 M96 152 L140 152" stroke="#8A6410" strokeWidth={3} />
      </g>
      {/* 尾：稻穗束（身后） */}
      <g transform={place(90, 212, -26)}>
        <Part name="tail" origin="50% 0%">
          <path d="M0 0 Q-2 10 -6 14" fill="none" stroke={STRAW_DEEP} strokeWidth={3} strokeLinecap="round" />
          <g fill={STRAW} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round">
            <ellipse cx={-7} cy={16} rx={2.8} ry={5} transform="rotate(20 -7 16)" />
            <ellipse cx={-2} cy={18} rx={2.8} ry={5} />
          </g>
        </Part>
      </g>
      {/* 远侧稻草手（后摆） */}
      <g transform={place(112, 168, 142)}>
        <Part name="armL" origin="50% 0%">
          <StrawTuft w={13} h={11} />
        </Part>
      </g>
      {/* 布身（侧视窄裙摆） */}
      <path
        d="M106 158 Q102 150 114 148 L146 148 Q156 150 152 158 Q162 194 152 216 Q128 226 106 216 Q96 194 106 158 Z"
        fill={CLOTH}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 补丁 + 缝线 */}
      <rect x={116} y={184} width={15} height={12} rx={3} fill={LEAF} opacity={0.85} stroke={OUTLINE} strokeWidth={2.4} />
      <path d="M108 170 q22 7 44 0" fill="none" stroke={CLOTH_DEEP} strokeWidth={2.4} strokeDasharray="4 4" strokeLinecap="round" />
      {/* 稻草脚（迈步） */}
      <g transform={place(116, 230)}>
        <Part name="legL" origin="50% -40%">
          <StrawTuft w={14} h={11} />
        </Part>
      </g>
      <g transform={place(140, 231)}>
        <Part name="legR" origin="50% -40%">
          <StrawTuft w={15} h={11} />
        </Part>
      </g>
      {/* 近侧稻草手（前摆）+ 新芽 */}
      <g transform={place(152, 166, -108)}>
        <Part name="armR" origin="50% 0%">
          <StrawTuft w={14} h={12} />
        </Part>
      </g>
      <path d="M164 162 q7 -1 10 -6" fill="none" stroke={LEAF} strokeWidth={2.6} strokeLinecap="round" />
      {/* 头（麻布圆头前倾） */}
      <circle cx={134} cy={116} r={38} fill={CLOTH} stroke={OUTLINE} strokeWidth={6} />
      <path d="M112 136 q22 9 44 -2" fill="none" stroke={CLOTH_DEEP} strokeWidth={2.2} strokeDasharray="4 4" strokeLinecap="round" />
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={150} cy={110} r={9.5} mouthX={158} mouthY={130} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={138} cy={126} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：垂稻穗草帽（前倾） */}
      <g transform={place(134, 92, -6)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-38 4 Q-20 -2 -14 -4 Q-8 -22 0 -22 Q8 -22 14 -4 Q20 -2 38 4 Q20 12 0 12 Q-20 12 -38 4 Z" fill={STRAW} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
          <path d="M-14 -2 Q0 -8 14 -2" fill="none" stroke={STRAW_DEEP} strokeWidth={2.6} strokeLinecap="round" />
          <g transform="translate(26 5)">
            <path d="M0 0 q4 -8 2 -14" fill="none" stroke={STRAW_DEEP} strokeWidth={2.4} strokeLinecap="round" />
            <g fill={STRAW} stroke={OUTLINE} strokeWidth={2}>
              <ellipse cx={2} cy={-14} rx={2.6} ry={4.5} />
              <ellipse cx={5} cy={-9} rx={2.4} ry={4} transform="rotate(-24 5 -9)" />
            </g>
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：下了木架仰面平躺，草帽盖脸（农民午睡式），手搭肚上。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 卸下的木架（平放身后地上） */}
      <g stroke={OUTLINE} strokeLinecap="round" opacity={0.95}>
        <path d="M66 182 L182 182" stroke={STRAW_DEEP} strokeWidth={8} />
        <path d="M92 168 L92 196" stroke={STRAW_DEEP} strokeWidth={8} />
        <path d="M66 182 L182 182 M92 168 L92 196" stroke="#8A6410" strokeWidth={2.8} />
      </g>
      {/* 尾：稻穗束（左端摊地） */}
      <g transform={place(64, 216, -80)}>
        <Part name="tail" origin="50% 0%">
          <path d="M0 0 Q-2 9 -6 13" fill="none" stroke={STRAW_DEEP} strokeWidth={3} strokeLinecap="round" />
          <g fill={STRAW} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round">
            <ellipse cx={-7} cy={15} rx={2.8} ry={5} transform="rotate(20 -7 15)" />
            <ellipse cx={-2} cy={17} rx={2.8} ry={5} />
          </g>
        </Part>
      </g>
      {/* 布身（仰躺横放，裙摆朝左） */}
      <path
        d="M74 210 Q70 200 82 196 L138 194 Q150 196 150 208 Q152 222 140 226 L84 228 Q72 226 74 210 Z"
        fill={CLOTH}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 补丁 + 缝线 */}
      <rect x={94} y={204} width={15} height={12} rx={3} fill={LEAF} opacity={0.85} stroke={OUTLINE} strokeWidth={2.4} />
      <rect x={120} y={212} width={12} height={10} rx={3} fill={SEA} opacity={0.85} stroke={OUTLINE} strokeWidth={2.4} />
      {/* 稻草脚（左端翘着二郎腿式） */}
      <g transform={place(70, 208, 96)}>
        <Part name="legL" origin="50% -40%">
          <StrawTuft w={13} h={10} />
        </Part>
      </g>
      <g transform={place(78, 222, 84)}>
        <Part name="legR" origin="50% -40%">
          <StrawTuft w={14} h={11} />
        </Part>
      </g>
      {/* 头（仰面圆头，右端） */}
      <circle cx={172} cy={202} r={33} fill={CLOTH} stroke={OUTLINE} strokeWidth={6} />
      <path d="M150 214 q22 8 44 -2" fill="none" stroke={CLOTH_DEEP} strokeWidth={2.2} strokeDasharray="4 4" strokeLinecap="round" />
      {/* 脸（帽下只露嘴和腮） */}
      <g className="part-face">
        <ExpFace cx1={162} cx2={184} cy={196} r={7.5} mouthY={218} mouthW={11} expression={expression} base={eyes} />
        <Blush cx1={152} cx2={192} cy={214} />
      </g>
      {/* 稻草手（搭在肚子上） */}
      <g transform={place(122, 200, 118)}>
        <Part name="armL" origin="50% 0%">
          <StrawTuft w={12} h={10} />
        </Part>
      </g>
      <g transform={place(136, 208, -128)}>
        <Part name="armR" origin="50% 0%">
          <StrawTuft w={12} h={10} />
        </Part>
      </g>
      {/* 头顶：草帽盖脸（午睡式，盖住眼睛、露出嘴） */}
      <g transform={place(168, 190)}>
        <Part name="headtop" origin="50% 100%">
          <ellipse cx={0} cy={0} rx={34} ry={15} fill={STRAW} stroke={OUTLINE} strokeWidth={4} />
          <ellipse cx={0} cy={-4} rx={14} ry={7.5} fill={STRAW} stroke={STRAW_DEEP} strokeWidth={2.6} />
          <g transform="translate(24 4)">
            <path d="M0 0 q4 -7 2 -12" fill="none" stroke={STRAW_DEEP} strokeWidth={2.4} strokeLinecap="round" />
            <g fill={STRAW} stroke={OUTLINE} strokeWidth={2}>
              <ellipse cx={2} cy={-12} rx={2.4} ry={4.2} />
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

// 稻草人农活产物：麦穗 + 乌鸦 + 扎束的稻草
const wheatEar: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <path d="M0 10 V-2" fill="none" strokeWidth={2} stroke={STRAW_DEEP} strokeLinecap="round" />
    <g fill={STRAW} strokeWidth={1.6}>
      <ellipse cx={0} cy={-6} rx={2.4} ry={4} />
      <ellipse cx={-3} cy={-1} rx={2.2} ry={3.6} transform="rotate(24 -3 -1)" />
      <ellipse cx={3} cy={-1} rx={2.2} ry={3.6} transform="rotate(-24 3 -1)" />
      <ellipse cx={-3} cy={4} rx={2.2} ry={3.4} transform="rotate(28 -3 4)" />
      <ellipse cx={3} cy={4} rx={2.2} ry={3.4} transform="rotate(-28 3 4)" />
    </g>
  </g>
);
const crowBit: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round" strokeWidth={2}>
    <path d="M-8 2 Q-9 -4 -3 -5 Q3 -6 8 -1 Q4 2 -2 3 Q-6 4 -8 2 Z" fill="#3E4356" />
    <path d="M8 -1 L13 -2 L9 2 Z" fill="#F0A828" strokeWidth={1.6} />
    <path d="M-3 -4 Q0 2 -5 3" fill="none" strokeWidth={1.4} stroke="#2A2E3A" />
    <circle cx={4} cy={-2} r={0.9} fill="#FFFFFF" stroke="none" />
  </g>
);
const strawTuft: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round" strokeLinecap="round">
    <g strokeWidth={2} stroke={STRAW}>
      <path d="M0 6 L-8 -6 M0 6 L-3 -9 M0 6 L3 -9 M0 6 L8 -6" fill="none" />
    </g>
    <path d="M-4 4 Q0 6 4 4" fill="none" strokeWidth={2.2} stroke={STRAW_DEEP} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.08,
    palette: { body: CLOTH, deep: CLOTH_DEEP, belly: "#F7EBD0", accent: LEAF, accent2: SEA },
    foodAnchor: { x: 130, y: 134 },
    shadowRx: 54,
  },
  // 稻穗扫帚：竹柄 + 稻穗帚头 + 扎绳
  tool: () => (
    <g>
      <path d="M-2.2 0 L2.2 0 L2 -34 L-2 -34 Z" fill="#B98A4E" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M-12 0 Q-8 -14 -2 -16 L2 -16 Q8 -14 12 0 L7 2 Q4 -6 2 -8 Q0 -4 -1 2 Q-4 -6 -6 -7 Q-8 -2 -7 2 Z" fill={STRAW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M-5 -16 h10" stroke="#E2432E" strokeWidth={3} strokeLinecap="round" />
      <g fill={STRAW} stroke={OUTLINE} strokeWidth={1.8}>
        <ellipse cx={8} cy={-40} rx={2.4} ry={4} transform="rotate(-20 8 -40)" />
        <ellipse cx={4} cy={-44} rx={2.4} ry={4} />
      </g>
      <path d="M2 -34 q4 -4 4 -8" fill="none" stroke={STRAW_DEEP} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 194, y: 214 },
    baseAngle: -Math.PI / 2.4,
    cone: 0.6,
    shapes: [wheatEar, crowBit, strawTuft],
  },
  meta: {
    nameZh: "稻草人",
    elements: ["grass", "normal", "water"],
    family: "傀儡构装",
    toolAnchor: { x: 192, y: 231 },
    nodeBudget: 205,
    lieNote: "下木架平躺，草帽盖脸（农民午睡式）",
  },
};
