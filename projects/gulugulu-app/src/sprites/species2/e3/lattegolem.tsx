// ---------------------------------------------------------------------------
// 拿铁雪人 lattegolem — e3（fire+ice+normal）· 傀儡构装
// 剪影：两段式雪人，胸口嵌温热咖啡心（发光窗，招牌），头顶奶泡贝雷帽，
//       树枝手 + 咖啡豆纽扣。咖啡店店长，字面意义外冷内热。
// 睡姿（P3）：头球滚下来，靠着身子睡。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const SNOW = "#F7FCFD";
const SNOW_DEEP = "#CFEFF6";
const COFFEE = "#8A5A3B";
const CREMA = "#C9A86A";
const WARM = "#E85D3A";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：背后一支小奶泡搅拌勺（左下探出，构装配件感） */}
      <g transform={place(82, 210, -30)}>
        <Part name="tail" origin="50% 100%">
          <path d="M0 2 V-16" stroke={CREMA} strokeWidth={3.4} strokeLinecap="round" />
          <ellipse cx={0} cy={-20} rx={5} ry={6.5} fill={SNOW} stroke={OUTLINE} strokeWidth={2.8} />
        </Part>
      </g>
      {/* 下段雪球身 */}
      <circle cx={128} cy={186} r={46} fill={SNOW} stroke={OUTLINE} strokeWidth={6} />
      {/* 胸口咖啡心（发光窗：心形开口内是咖啡+蒸汽，招牌） */}
      <g transform={place(128, 182)}>
        <path
          d="M0 16 C-16 4 -15 -9 -6 -11 C-2 -12 0 -9 0 -6.5 C0 -9 2 -12 6 -11 C15 -9 16 4 0 16 Z"
          fill={COFFEE}
          stroke={OUTLINE}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path d="M-7 -4 Q0 -8 7 -4" fill="none" stroke={CREMA} strokeWidth={3} strokeLinecap="round" />
        <path d="M-3 -14 q-2 -4 1 -7 M4 -14 q2 -4 -1 -7" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" opacity={0.9} />
        <circle cx={-4} cy={4} r={1.6} fill={CREMA} opacity={0.9} />
      </g>
      {/* 咖啡豆纽扣 */}
      <g fill={COFFEE} stroke={OUTLINE} strokeWidth={2}>
        <ellipse cx={128} cy={208} rx={4} ry={5} />
        <ellipse cx={128} cy={222} rx={3.4} ry={4.2} />
      </g>
      <path d="M128 204 v8 M128 218.5 v7" stroke={CREMA} strokeWidth={1.4} strokeLinecap="round" />
      {/* 树枝手 */}
      <g transform={place(84, 176, 34)}>
        <Part name="armL" origin="90% 10%">
          <path d="M0 0 L-22 10 M-14 6 L-18 -2 M-10 8 L-12 16" fill="none" stroke="#8A6B4F" strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(172, 176, -34)}>
        <Part name="armR" origin="10% 10%">
          <path d="M0 0 L22 10 M14 6 L18 -2 M10 8 L12 16" fill="none" stroke="#8A6B4F" strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 雪堆脚（两小坨） */}
      <g transform={place(108, 231)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={10} ry={5.5} fill={SNOW_DEEP} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(148, 231)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={10} ry={5.5} fill={SNOW_DEEP} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 上段头球（大头比例） */}
      <circle cx={128} cy={112} r={40} fill={SNOW} stroke={OUTLINE} strokeWidth={6} />
      {/* 脸：胡萝卜换成咖啡豆鼻 */}
      <g className="part-face">
        <ExpFace cx1={112} cx2={144} cy={104} r={9.5} mouthY={128} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={128} cy={118} rx={5} ry={6} fill={COFFEE} stroke={OUTLINE} strokeWidth={2.6} />
        <Blush cx1={102} cx2={154} cy={116} />
      </g>
      {/* 头顶：奶泡贝雷帽（歪戴，headtop 呼吸摇） */}
      <g transform={place(128, 78)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(-8)">
            <path d="M-26 2 Q-28 -12 -12 -16 Q0 -19 12 -16 Q28 -12 26 2 Q0 8 -26 2 Z" fill="#FFF4E4" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
            <path d="M-18 -6 Q0 -12 18 -6" fill="none" stroke={CREMA} strokeWidth={2.6} strokeLinecap="round" />
            <circle cx={2} cy={-17} r={4} fill={CREMA} stroke={OUTLINE} strokeWidth={2.6} />
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

/** 侧视（右向）：两段雪人挪步，头球前倾，咖啡心朝前，树枝手一前一后。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：奶泡搅拌勺（背后） */}
      <g transform={place(86, 208, -32)}>
        <Part name="tail" origin="50% 100%">
          <path d="M0 2 V-16" stroke={CREMA} strokeWidth={3.4} strokeLinecap="round" />
          <ellipse cx={0} cy={-20} rx={5} ry={6.5} fill={SNOW} stroke={OUTLINE} strokeWidth={2.8} />
        </Part>
      </g>
      {/* 远侧树枝手（后摆） */}
      <g transform={place(100, 180, 38)}>
        <Part name="armL" origin="90% 10%">
          <path d="M0 0 L-20 10 M-13 6 L-16 -1 M-9 8 L-11 15" fill="none" stroke="#6E5540" strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 下段雪球身 */}
      <circle cx={124} cy={188} r={44} fill={SNOW} stroke={OUTLINE} strokeWidth={6} />
      {/* 胸口咖啡心（朝前） */}
      <g transform={place(146, 184)}>
        <path
          d="M0 14 C-14 3 -13 -8 -5 -10 C-2 -11 0 -8 0 -6 C0 -8 2 -11 5 -10 C13 -8 14 3 0 14 Z"
          fill={COFFEE}
          stroke={OUTLINE}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path d="M-6 -4 Q0 -7 6 -4" fill="none" stroke={CREMA} strokeWidth={2.8} strokeLinecap="round" />
        <path d="M-2 -13 q-2 -4 1 -7 M4 -13 q2 -4 -1 -7" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" opacity={0.9} />
      </g>
      {/* 咖啡豆纽扣 */}
      <ellipse cx={130} cy={212} rx={4} ry={5} fill={COFFEE} stroke={OUTLINE} strokeWidth={2} />
      <path d="M130 208 v8" stroke={CREMA} strokeWidth={1.4} strokeLinecap="round" />
      {/* 雪堆脚（挪步） */}
      <g transform={place(110, 231)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={10} ry={5.5} fill={SNOW_DEEP} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={10} ry={5.5} fill={SNOW_DEEP} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 近侧树枝手（前伸） */}
      <g transform={place(154, 174, -26)}>
        <Part name="armR" origin="10% 10%">
          <path d="M0 0 L22 8 M14 5 L18 -3 M10 7 L12 15" fill="none" stroke="#8A6B4F" strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 上段头球（前倾） */}
      <circle cx={138} cy={112} r={38} fill={SNOW} stroke={OUTLINE} strokeWidth={6} />
      {/* 脸（侧脸 + 咖啡豆鼻） */}
      <g className="part-face">
        <ExpSideFace cx={148} cy={104} r={9.5} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={162} cy={116} rx={4.5} ry={5.5} fill={COFFEE} stroke={OUTLINE} strokeWidth={2.4} />
        <path d="M156 128 q6 4 12 -1" fill="none" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
        <ellipse cx={134} cy={120} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：奶泡贝雷帽（前倾歪戴） */}
      <g transform={place(134, 78)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(-12)">
            <path d="M-24 2 Q-26 -12 -11 -16 Q0 -18 11 -15 Q26 -11 24 2 Q0 8 -24 2 Z" fill="#FFF4E4" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
            <path d="M-16 -6 Q0 -11 16 -5" fill="none" stroke={CREMA} strokeWidth={2.6} strokeLinecap="round" />
            <circle cx={2} cy={-16} r={4} fill={CREMA} stroke={OUTLINE} strokeWidth={2.6} />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：头球滚下来靠着身子睡——身球还站着，头球落地贴靠，树枝手想去捞。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：搅拌勺（倒在身后） */}
      <g transform={place(52, 226, -78)}>
        <Part name="tail" origin="50% 100%">
          <path d="M0 2 V-14" stroke={CREMA} strokeWidth={3.2} strokeLinecap="round" />
          <ellipse cx={0} cy={-18} rx={4.5} ry={6} fill={SNOW} stroke={OUTLINE} strokeWidth={2.6} />
        </Part>
      </g>
      {/* 下段身球（原地） */}
      <circle cx={94} cy={194} r={40} fill={SNOW} stroke={OUTLINE} strokeWidth={6} />
      {/* 胸口咖啡心（仍温着） */}
      <g transform={place(94, 190)}>
        <path
          d="M0 13 C-13 3 -12 -7 -5 -9 C-2 -10 0 -7 0 -5.5 C0 -7 2 -10 5 -9 C12 -7 13 3 0 13 Z"
          fill={COFFEE}
          stroke={OUTLINE}
          strokeWidth={3.8}
          strokeLinejoin="round"
        />
        <path d="M-5 -4 Q0 -6 5 -4" fill="none" stroke={CREMA} strokeWidth={2.6} strokeLinecap="round" />
        <path d="M-2 -12 q-2 -3 1 -6" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.9} />
      </g>
      {/* 纽扣 */}
      <ellipse cx={94} cy={216} rx={3.6} ry={4.4} fill={COFFEE} stroke={OUTLINE} strokeWidth={1.8} />
      {/* 雪堆脚 */}
      <g transform={place(80, 232)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={9} ry={5} fill={SNOW_DEEP} stroke={OUTLINE} strokeWidth={3.8} />
        </Part>
      </g>
      <g transform={place(108, 232)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={9} ry={5} fill={SNOW_DEEP} stroke={OUTLINE} strokeWidth={3.8} />
        </Part>
      </g>
      {/* 滚落路径上的雪屑 */}
      <g fill={SNOW_DEEP} stroke={OUTLINE} strokeWidth={2.2}>
        <circle cx={130} cy={228} r={4} />
        <circle cx={144} cy={231} r={3} />
      </g>
      {/* 树枝手（一只垂着，一只伸向头球） */}
      <g transform={place(66, 200, 52)}>
        <Part name="armL" origin="90% 10%">
          <path d="M0 0 L-18 9 M-12 5 L-15 -1" fill="none" stroke="#6E5540" strokeWidth={4.2} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(126, 196, -64)}>
        <Part name="armR" origin="10% 10%">
          <path d="M0 0 L22 8 M14 5 L17 -2 M10 7 L12 14" fill="none" stroke="#8A6B4F" strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 滚下来的头球（落地贴靠身球） */}
      <circle cx={172} cy={200} r={34} fill={SNOW} stroke={OUTLINE} strokeWidth={6} />
      {/* 脸（落地也照睡） */}
      <g className="part-face">
        <ExpFace cx1={160} cx2={184} cy={194} r={8.5} mouthY={216} mouthW={10} expression={expression} base={eyes} />
        <ellipse cx={172} cy={208} rx={4.5} ry={5.5} fill={COFFEE} stroke={OUTLINE} strokeWidth={2.4} />
        <Blush cx1={152} cx2={192} cy={206} />
      </g>
      {/* 头顶：贝雷帽（滑到头球一侧） */}
      <g transform={place(154, 174, -30)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-21 2 Q-23 -10 -10 -14 Q0 -16 10 -13 Q23 -10 21 2 Q0 7 -21 2 Z" fill="#FFF4E4" stroke={OUTLINE} strokeWidth={3.8} strokeLinejoin="round" />
          <path d="M-14 -5 Q0 -9 14 -4" fill="none" stroke={CREMA} strokeWidth={2.4} strokeLinecap="round" />
          <circle cx={2} cy={-14} r={3.6} fill={CREMA} stroke={OUTLINE} strokeWidth={2.4} />
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

// 咖啡吧台产物：咖啡豆 + 拿铁拉花心 + 外带杯
const coffeeBean: ParticleRenderer = () => (
  <g>
    <ellipse cx={0} cy={0} rx={5} ry={7} fill={COFFEE} stroke={OUTLINE} strokeWidth={2.2} transform="rotate(18)" />
    <path d="M0 -5 Q2 0 0 5" fill="none" stroke={CREMA} strokeWidth={1.6} strokeLinecap="round" transform="rotate(18)" />
  </g>
);
const latteHeart: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <circle cx={0} cy={0} r={8} fill={COFFEE} strokeWidth={2.2} />
    <path d="M0 4 Q-5 -1 -3 -4 Q-1 -6 0 -3 Q1 -6 3 -4 Q5 -1 0 4 Z" fill="#FFF4E4" stroke="none" />
  </g>
);
const toGoCup: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <path d="M-6 -3 L6 -3 L4.5 10 L-4.5 10 Z" fill={SNOW} strokeWidth={2.2} />
    <path d="M-7 -3 Q0 -9 7 -3 Z" fill="#FFFFFF" strokeWidth={2.2} />
    <circle cx={0} cy={-7} r={1.4} fill={SNOW_DEEP} stroke={OUTLINE} strokeWidth={1.2} />
    <rect x={-6} y={1} width={12} height={4.5} fill={CREMA} stroke={OUTLINE} strokeWidth={1.8} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.06,
    palette: { body: SNOW, deep: SNOW_DEEP, belly: "#FFFFFF", accent: COFFEE, accent2: WARM },
    foodAnchor: { x: 128, y: 130 },
    shadowRx: 54,
  },
  // 咖啡机：机身 + 手柄 + 双流咖啡 + 小杯
  tool: () => (
    <g>
      <rect x={-16} y={-34} width={32} height={22} rx={4} fill="#5C6172" stroke={OUTLINE} strokeWidth={3.4} />
      <path d="M-6 -12 L-6 -8 M6 -12 L6 -8" stroke={COFFEE} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M-10 0 L10 0 L8 -8 L-8 -8 Z" fill="#FFF4E4" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
      <path d="M16 -28 h6" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" />
      <circle cx={-8} cy={-28} r={2.6} fill={WARM} stroke={OUTLINE} strokeWidth={1.8} />
      <path d="M0 -40 q-2 -3 1 -6" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 192, y: 200 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.55,
    shapes: [coffeeBean, latteHeart, toGoCup],
  },
  meta: {
    nameZh: "拿铁雪人",
    elements: ["fire", "ice", "normal"],
    family: "傀儡构装",
    toolAnchor: { x: 192, y: 231 },
    nodeBudget: 205,
    lieNote: "头球滚下来，靠着身子睡",
  },
};
