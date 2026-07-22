// ---------------------------------------------------------------------------
// 烛焰羊 waxlamb — e2（fire+normal）· 四足兽
// 剪影：云朵蜡毛小羊，头顶一撮烛火呆毛（招牌），毛上挂蜡滴。
// 睡姿（P3）：团成一颗蜡球，烛火缩成小蓝豆。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const WOOL = "#FFF4E4";
const WOOL_DEEP = "#EAD9BE";
const FACE = "#F5C9A5";
const FLAME = "#FFB03A";
const FLAME_RED = "#E85D3A";
const WAX = "#F5E6C8";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小云朵毛尾（左下探出） */}
      <g transform={place(66, 208)}>
        <Part name="tail" origin="100% 50%">
          <g fill={WOOL} stroke={OUTLINE} strokeWidth={4.5}>
            <circle cx={-8} cy={-4} r={8} />
            <circle cx={-2} cy={3} r={6.5} />
          </g>
        </Part>
      </g>
      {/* 身体：云朵蜡毛（一圈泡泡轮廓，撑宽画面） */}
      <g fill={WOOL} stroke={OUTLINE} strokeWidth={5.5}>
        <circle cx={86} cy={198} r={25} />
        <circle cx={170} cy={198} r={25} />
        <circle cx={94} cy={168} r={23} />
        <circle cx={162} cy={168} r={23} />
        <circle cx={128} cy={156} r={27} />
        <circle cx={128} cy={198} r={38} />
      </g>
      {/* 蜡滴（毛上挂着凝固的蜡） */}
      <g fill={WAX} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round">
        <path d="M88 218 q0 8 -5 9 q-5 -1 -4 -8 q1 -4 4.5 -6 q4 2 4.5 5 z" />
        <path d="M176 212 q1 7 -3.5 8 q-4.5 -1 -4 -7 q0.5 -3.5 3.5 -5 q3.5 1.5 4 4 z" />
      </g>
      {/* 小脚（深色小蹄） */}
      <g transform={place(106, 230)}>
        <Part name="legL" origin="50% -30%">
          <path d="M0 -12 v6" stroke={WOOL_DEEP} strokeWidth={8} strokeLinecap="round" />
          <path d="M-5 -6 L5 -6 L4 0 Q0 2 -4 0 Z" fill="#8A6B4F" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(150, 230)}>
        <Part name="legR" origin="50% -30%">
          <path d="M0 -12 v6" stroke={WOOL_DEEP} strokeWidth={8} strokeLinecap="round" />
          <path d="M-5 -6 L5 -6 L4 0 Q0 2 -4 0 Z" fill="#8A6B4F" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 小手（藏毛里的小蹄手） */}
      <g transform={place(82, 212, 18)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={8.5} fill={WOOL_DEEP} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(174, 212, -18)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={8.5} fill={WOOL_DEEP} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 脸蛋（奶茶色大圆脸嵌在毛里——婴儿比例） */}
      <ellipse cx={128} cy={180} rx={36} ry={31} fill={FACE} stroke={OUTLINE} strokeWidth={5} />
      {/* 垂耳一对 */}
      <g fill={FACE} stroke={OUTLINE} strokeWidth={4.5}>
        <ellipse cx={88} cy={174} rx={10} ry={15} transform="rotate(24 88 174)" />
        <ellipse cx={168} cy={174} rx={10} ry={15} transform="rotate(-24 168 174)" />
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={113} cx2={143} cy={174} r={9.5} mouthY={193} mouthW={13} expression={expression} base={eyes} />
        <Blush cx1={103} cx2={153} cy={188} />
      </g>
      {/* 头顶：烛芯 + 烛火呆毛（招牌，headtop 呼吸摇） */}
      <g transform={place(128, 132)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 V-7" stroke={OUTLINE} strokeWidth={3.6} strokeLinecap="round" />
          <path d="M0 -8 q-7 -7 -3 -16 q4 4 4 9 q4 -6 2 -12 q8 6 6 15 q-2 7 -9 4 z" fill={FLAME} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
          <path d="M0 -12 q-2 -4 0 -8 q4 3 2 8 q-1 2 -2 0 z" fill={FLAME_RED} />
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

/** 侧视（右向）：云毛团身，大脸朝右，蹄脚迈步，烛火呆毛。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：云朵毛尾（左后） */}
      <g transform={place(68, 200)}>
        <Part name="tail" origin="100% 50%">
          <g fill={WOOL} stroke={OUTLINE} strokeWidth={4.5}>
            <circle cx={-8} cy={-4} r={8} />
            <circle cx={-2} cy={3} r={6.5} />
          </g>
        </Part>
      </g>
      {/* 云毛身（侧视泡泡轮廓） */}
      <g fill={WOOL} stroke={OUTLINE} strokeWidth={5.5}>
        <circle cx={88} cy={192} r={24} />
        <circle cx={104} cy={166} r={23} />
        <circle cx={134} cy={158} r={25} />
        <circle cx={120} cy={198} r={34} />
      </g>
      {/* 蜡滴 */}
      <path d="M92 214 q0 8 -5 9 q-5 -1 -4 -8 q1 -4 4.5 -6 q4 2 4.5 5 z" fill={WAX} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
      {/* 蹄脚（迈步） */}
      <g transform={place(102, 230)}>
        <Part name="legL" origin="50% -20%">
          <path d="M0 -14 v7" stroke={WOOL_DEEP} strokeWidth={8} strokeLinecap="round" />
          <path d="M-5 -7 L5 -7 L4 0 Q0 2 -4 0 Z" fill="#8A6B4F" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(142, 230)}>
        <Part name="legR" origin="50% -20%">
          <path d="M0 -14 v7" stroke={WOOL_DEEP} strokeWidth={8} strokeLinecap="round" />
          <path d="M-5 -7 L5 -7 L4 0 Q0 2 -4 0 Z" fill="#8A6B4F" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 近侧小蹄手 */}
      <g transform={place(140, 206, -14)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={8.5} fill={WOOL_DEEP} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(112, 210, 8)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8} fill={WOOL_DEEP} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 大脸（朝右探出毛球） + 近侧垂耳 */}
      <ellipse cx={160} cy={182} rx={32} ry={28} fill={FACE} stroke={OUTLINE} strokeWidth={5} />
      <ellipse cx={136} cy={172} rx={9} ry={14} fill={FACE} stroke={OUTLINE} strokeWidth={4.5} transform="rotate(24 136 172)" />
      {/* 脸（单眼） */}
      <g className="part-face">
        <ExpSideFace cx={166} cy={174} r={9.5} mouthX={176} mouthY={196} mouthW={11} expression={expression} base={eyes} />
        <ellipse cx={152} cy={194} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：烛芯 + 烛火（招牌） */}
      <g transform={place(152, 150)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 4 V-5" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" />
          <path d="M0 -6 q-6 -6 -3 -14 q4 3 4 8 q3 -5 2 -10 q7 5 5 13 q-2 6 -8 3 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：团成一颗蜡球——云毛收成圆球，脸缩球前，烛火缩成小蓝豆。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小云尾贴球侧 */}
      <g transform={place(76, 216)}>
        <Part name="tail" origin="100% 50%">
          <circle cx={-6} cy={0} r={8} fill={WOOL} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 蜡球本体（云毛圆球贴地） */}
      <g fill={WOOL} stroke={OUTLINE} strokeWidth={5.5}>
        <circle cx={100} cy={202} r={26} />
        <circle cx={156} cy={202} r={26} />
        <circle cx={128} cy={186} r={30} />
        <circle cx={128} cy={206} r={34} />
      </g>
      {/* 蜡滴垂边 */}
      <g fill={WAX} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round">
        <path d="M86 218 q0 7 -4.5 8 q-4.5 -1 -3.5 -7 q0.5 -3.5 3.5 -5 q3.5 1.5 4.5 4 z" />
        <path d="M172 214 q1 6 -3 7 q-4 -1 -3.5 -6 q0.5 -3 3 -4.5 q3 1.5 3.5 3.5 z" />
      </g>
      {/* 缩在球前的小脸（贴地闭眼） + 垂耳 */}
      <ellipse cx={128} cy={214} rx={26} ry={16} fill={FACE} stroke={OUTLINE} strokeWidth={4.5} />
      <g fill={FACE} stroke={OUTLINE} strokeWidth={4}>
        <ellipse cx={100} cy={210} rx={8} ry={12} transform="rotate(38 100 210)" />
        <ellipse cx={156} cy={210} rx={8} ry={12} transform="rotate(-38 156 210)" />
      </g>
      {/* 小蹄手收拢脸旁 */}
      <g transform={place(106, 226, -10)}>
        <Part name="armL" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={7} ry={4.5} fill={WOOL_DEEP} stroke={OUTLINE} strokeWidth={3.6} />
        </Part>
      </g>
      <g transform={place(150, 226, 10)}>
        <Part name="armR" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={7} ry={4.5} fill={WOOL_DEEP} stroke={OUTLINE} strokeWidth={3.6} />
        </Part>
      </g>
      {/* 脸（sleep） */}
      <g className="part-face">
        <ExpFace cx1={116} cx2={140} cy={210} r={7} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <circle cx={128} cy={219} r={1.8} fill={OUTLINE} opacity={0.8} />
      </g>
      {/* 头顶：烛火缩成小蓝豆（睡眠低火） */}
      <g transform={place(128, 156)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 V-3" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
          <path d="M0 -4 q-3 -4 -1 -8 q3 2 2.5 5 q2 -3 1 -6 q4 3 2.5 7.5 q-1.5 3.5 -5 1.5 z" fill="#7FB8D9" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
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

// 蜡烛：柱状蜡烛 + 烛芯小火（火焰是蜡烛的一部分，非独立火苗）
const candle: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <rect x={-5} y={-4} width={10} height={14} rx={2} fill={WAX} strokeWidth={2.4} />
    <path d="M-5 -4 Q0 -7 5 -4" fill={WAX} strokeWidth={2.2} />
    <path d="M0 -6 L0 -9" stroke={OUTLINE} strokeWidth={1.6} strokeLinecap="round" />
    <path d="M0 -9 Q2.5 -11 1.6 -13.5 Q0.8 -15 0 -14.5 Q-0.8 -15 -1.6 -13.5 Q-2.5 -11 0 -9 Z" fill={FLAME} strokeWidth={1.6} />
    <ellipse cx={0} cy={-11.4} rx={0.8} ry={1.6} fill="#FFF1C9" stroke="none" />
    <path d="M-4 12 h8" stroke={WOOL_DEEP} strokeWidth={1.6} strokeLinecap="round" />
  </g>
);
// 火漆印：红蜡印章戳印 + 蜡滴 + 徽记线
const waxSeal: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <path d="M-6 -4 Q-8 -7 -4 -8 Q0 -9 4 -7 Q8 -6 7 -2 Q8 3 4 5 Q0 7 -4 5 Q-8 4 -7 0 Z" fill={FLAME_RED} strokeWidth={2.2} />
    <path d="M4 5 q3 2 2 5 a2 2 0 0 1 -4 0 q0 -2 2 -5 z" fill={FLAME_RED} strokeWidth={1.8} />
    <path d="M-2 -3 L-2 3 M-2 -3 L2 1 L2 -3" fill="none" stroke="#B33A22" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </g>
);
// 火柴：细木杆 + 红棕火柴头
const matchstick: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round" transform="rotate(20)">
    <rect x={-1.6} y={-4} width={3.2} height={16} rx={1.4} fill={WOOL_DEEP} strokeWidth={2} />
    <ellipse cx={0} cy={-6} rx={3} ry={4} fill={FLAME_RED} strokeWidth={2} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.22,
    palette: { body: WOOL, deep: WOOL_DEEP, belly: FACE, accent: FLAME, accent2: "#6E6E78" },
    foodAnchor: { x: 130, y: 192 },
    shadowRx: 60,
  },
  // 火漆印章：木柄铜章 + 一枚盖好的火漆 + 小蜡烛
  tool: () => (
    <g>
      <path d="M-3 0 L3 0 L2.4 -22 L-2.4 -22 Z" fill="#B98A4E" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <path d="M-8 -22 L8 -22 L6 -30 L-6 -30 Z" fill="#D9A514" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
      <circle cx={14} cy={-6} r={7} fill={FLAME_RED} stroke={OUTLINE} strokeWidth={2.8} />
      <path d="M11 -6 l2 2 l4 -5" fill="none" stroke="#FFF1C9" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-14 -8 L-10 -8 L-10 0 L-14 0 Z" fill="#FFF4E4" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
      <path d="M-12 -12 q-2.5 -3 0 -6 q3 2.5 1.5 6 q-0.5 1.5 -1.5 0 z" fill={FLAME} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 200, y: 202 },
    baseAngle: -Math.PI / 2.4,
    cone: 0.5,
    shapes: [candle, waxSeal, matchstick],
  },
  meta: {
    nameZh: "烛焰羊",
    elements: ["fire", "normal"],
    family: "四足兽",
    toolAnchor: { x: 188, y: 231 },
    nodeBudget: 130,
    lieNote: "团成一颗蜡球，烛火缩成小蓝豆",
  },
};
