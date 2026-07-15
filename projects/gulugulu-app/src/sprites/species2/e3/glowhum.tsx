// ---------------------------------------------------------------------------
// 光蜂鸟 glowhum — e3（electric+grass+ice）· 鸟禽（漂浮悬停）
// 剪影：全谱最小的悬停蜂鸟：极光残影双翅（招牌）、细长吸蜜喙、
//       冰晶叶尾。实验室里最快的观察员。
// 睡姿（P3）：蜷在叶片吊床里，喙插进背羽。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BODY = "#7FCFA8";
const DEEP = "#4FA383";
const CREAM = "#FFF8EE";
const AURORA = "#B99BE8";
const ICE = "#8FD8E8";
const VOLT = "#FFD93B";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 极光残影双翅（招牌：双层残影弧，banner/crest 微动） */}
      <g transform={place(94, 152, -10)}>
        <g className="part-crest">
          <path d="M0 0 Q-34 -14 -42 -38 Q-16 -36 -4 -14 Q0 -6 0 0 Z" fill={AURORA} opacity={0.55} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
          <path d="M-2 -4 Q-26 -14 -32 -30" fill="none" stroke="#D9CBF5" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
        </g>
      </g>
      <g transform={place(162, 152, 10)}>
        <g className="part-banner">
          <path d="M0 0 Q34 -14 42 -38 Q16 -36 4 -14 Q0 -6 0 0 Z" fill={AURORA} opacity={0.55} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
          <path d="M2 -4 Q26 -14 32 -30" fill="none" stroke="#D9CBF5" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
        </g>
      </g>
      {/* 尾：冰晶叶三片（下方悬垂） */}
      <g transform={place(128, 204)}>
        <Part name="tail" origin="50% 0%">
          <g stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
            <path d="M-6 0 Q-14 10 -12 22 Q-2 16 -3 4 Z" fill={ICE} />
            <path d="M6 0 Q14 10 12 22 Q2 16 3 4 Z" fill={ICE} />
            <path d="M-2 2 Q0 16 0 26 Q6 14 4 3 Z" fill="#CFEFF6" />
          </g>
        </Part>
      </g>
      {/* 身体（小巧圆润，全谱最小≈90px 高） */}
      <ellipse cx={128} cy={164} rx={38} ry={42} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 胸口光斑（蜂鸟喉部虹彩） */}
      <path d="M112 178 Q128 170 144 178 Q140 196 128 198 Q116 196 112 178 Z" fill={VOLT} opacity={0.85} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <ellipse cx={128} cy={196} rx={16} ry={9} fill={CREAM} opacity={0.95} />
      {/* 小翅手（悬停振翅的短前翅） */}
      <g transform={place(96, 172, 30)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 Q-12 4 -14 14 Q-4 14 0 6 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(160, 172, -30)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 Q12 4 14 14 Q4 14 0 6 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 细长吸蜜喙（招牌：向右下伸出的细针喙） */}
      <path d="M150 148 L188 158 Q190 160 188 162 L150 158 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={114} cx2={142} cy={144} r={8.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={104} cx2={152} cy={158} />
      </g>
      {/* 头顶：一撮冰晶呆羽（headtop 呼吸摇） */}
      <g transform={place(124, 124)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-4 -6 0 -12" fill="none" stroke={DEEP} strokeWidth={3.2} strokeLinecap="round" />
          <path d="M0 -12 L3 -18 L5 -11 L1 -8 Z" fill={ICE} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(190, 226)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：悬停前冲，针喙朝前，极光残影翅在背后拖出弧线，冰晶叶尾后摆。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 极光残影翅（背后拖弧） */}
      <g transform={place(104, 144, -18)}>
        <g className="part-crest">
          <path d="M0 0 Q-36 -12 -46 -36 Q-18 -36 -5 -13 Q0 -6 0 0 Z" fill={AURORA} opacity={0.55} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
          <path d="M-3 -4 Q-28 -13 -35 -28" fill="none" stroke="#D9CBF5" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
        </g>
      </g>
      <g transform={place(116, 136, -34)}>
        <g className="part-banner">
          <path d="M0 0 Q-28 -16 -32 -38 Q-8 -32 2 -12 Q4 -5 0 0 Z" fill={AURORA} opacity={0.45} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        </g>
      </g>
      {/* 尾：冰晶叶（后摆） */}
      <g transform={place(102, 196, 38)}>
        <Part name="tail" origin="50% 0%">
          <g stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
            <path d="M-6 0 Q-14 10 -12 22 Q-2 16 -3 4 Z" fill={ICE} />
            <path d="M2 2 Q2 16 4 24 Q10 13 8 3 Z" fill="#CFEFF6" />
          </g>
        </Part>
      </g>
      {/* 身体（小巧圆润前倾） */}
      <ellipse cx={132} cy={168} rx={36} ry={40} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 喉部虹彩光斑（体前） */}
      <path d="M138 184 Q152 178 162 186 Q158 202 146 202 Q136 198 138 184 Z" fill={VOLT} opacity={0.85} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <ellipse cx={132} cy={200} rx={15} ry={8} fill={CREAM} opacity={0.95} />
      {/* 小翅手（振翅一前一后） */}
      <g transform={place(106, 174, 34)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 Q-12 4 -14 14 Q-4 14 0 6 Z" fill="#3F8A6C" stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(148, 178, -30)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 Q12 4 14 14 Q4 14 0 6 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 细长吸蜜喙（朝前） */}
      <path d="M158 146 L204 154 Q206 156 204 158 L158 156 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={146} cy={142} r={8.5} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={136} cy={158} rx={6.5} ry={4.5} fill="#F5A8C6" opacity={0.7} />
      </g>
      {/* 头顶：冰晶呆羽（迎风后掠） */}
      <g transform={place(128, 128, -10)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-5 -5 -2 -11" fill="none" stroke={DEEP} strokeWidth={3.2} strokeLinecap="round" />
          <path d="M-2 -11 L0 -18 L3 -11 L0 -7 Z" fill={ICE} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：蜷在叶片吊床里，针喙折回插进背羽，翅光只剩一缕微光。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 叶片摇篮（后缘叶沿翘起两角） */}
      <path
        d="M58 200 Q66 186 90 182 Q128 176 166 182 Q190 186 198 200 L194 206 Q128 190 62 206 Z"
        fill="#57B84C"
        stroke={OUTLINE}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path d="M50 231 q9 -6 16 0 M190 231 q9 -6 16 0" fill="none" stroke="#57B84C" strokeWidth={3} strokeLinecap="round" />
      {/* 残影翅微光（一缕） */}
      <g transform={place(102, 176, -24)}>
        <g className="part-crest">
          <path d="M0 0 Q-20 -10 -26 -24 Q-8 -22 0 -8 Z" fill={AURORA} opacity={0.35} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </g>
      </g>
      {/* 尾：冰晶叶（吊床左缘探出） */}
      <g transform={place(80, 198, -46)}>
        <Part name="tail" origin="50% 0%">
          <g stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round">
            <path d="M-5 0 Q-12 8 -10 18 Q-2 13 -3 3 Z" fill={ICE} />
            <path d="M2 2 Q2 13 4 20 Q9 11 7 3 Z" fill="#CFEFF6" />
          </g>
        </Part>
      </g>
      {/* 蜷成球的鸟身 */}
      <ellipse cx={130} cy={186} rx={33} ry={27} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 针喙折回插进背羽 */}
      <path d="M148 174 L110 158 Q107 157 108 160 L144 180 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <path d="M104 162 Q112 152 122 156 Q118 164 108 166 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      {/* 折翅（收拢） */}
      <g transform={place(112, 190, 38)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 Q-11 4 -13 13 Q-3 13 0 5 Z" fill="#3F8A6C" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(146, 194, -34)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 Q11 4 13 13 Q3 13 0 5 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 喉部光斑（暗一档） */}
      <path d="M120 200 Q130 195 140 200 Q136 210 130 210 Q122 208 120 200 Z" fill={VOLT} opacity={0.6} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={122} cx2={144} cy={180} r={7.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={114} cx2={152} cy={192} />
      </g>
      {/* 叶片摇篮（前缘深叶船，兜住身子下半） */}
      <path
        d="M58 200 Q62 224 96 230 Q128 236 160 230 Q194 224 198 200 Q168 214 128 215 Q88 214 58 200 Z"
        fill="#4E9A4A"
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      <path d="M76 214 Q128 226 180 214" fill="none" stroke="#8CD97B" strokeWidth={2.6} strokeLinecap="round" opacity={0.9} />
      <path d="M128 216 Q128 226 128 231" fill="none" stroke="#3B8F33" strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
      {/* 头顶：冰晶呆羽（垂头） */}
      <g transform={place(126, 158, 16)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-4 -4 -2 -10" fill="none" stroke={DEEP} strokeWidth={3} strokeLinecap="round" />
          <path d="M-2 -10 L0 -16 L3 -10 L0 -6 Z" fill={ICE} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
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

// 显微镜下的产物：观察到的细胞 + 微生物 + 镜片反光
const cellBit: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={5.5} fill={AURORA} opacity={0.55} stroke={OUTLINE} strokeWidth={2} />
    <circle cx={0} cy={0} r={1.8} fill={VOLT} stroke={OUTLINE} strokeWidth={1.2} />
  </g>
);
const microbeBit: ParticleRenderer = () => (
  <g transform="rotate(-18)">
    <ellipse cx={0} cy={0} rx={6} ry={3.4} fill="#B7E88C" opacity={0.85} stroke={OUTLINE} strokeWidth={2} />
    <path d="M6 -1 l4 -1 M-6 1 l-4 1" stroke={OUTLINE} strokeWidth={1.4} strokeLinecap="round" />
  </g>
);
const lensGlint: ParticleRenderer = () => (
  <path d="M0 -6 Q1 -1 6 0 Q1 1 0 6 Q-1 1 -6 0 Q-1 -1 0 -6 Z" fill="#FFFFFF" stroke={ICE} strokeWidth={1.8} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.08,
    palette: { body: BODY, deep: DEEP, belly: CREAM, accent: AURORA, accent2: ICE },
    floating: true,
    shadowRx: 36,
    foodAnchor: { x: 158, y: 152 },
  },
  // 显微镜：底座 + 镜臂 + 目镜物镜 + 载物台
  tool: () => (
    <g>
      <path d="M-12 0 h24" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
      <path d="M6 -2 Q10 -16 2 -26" fill="none" stroke="#8E93A6" strokeWidth={5} strokeLinecap="round" />
      <g transform="translate(0 -30) rotate(18)">
        <rect x={-4} y={-10} width={8} height={16} rx={2.5} fill="#5C7FB5" stroke={OUTLINE} strokeWidth={2.8} />
        <rect x={-3} y={-15} width={6} height={5} rx={1.5} fill="#3E4356" stroke={OUTLINE} strokeWidth={2.2} />
      </g>
      <path d="M-8 -10 h12" stroke="#8E93A6" strokeWidth={3.4} strokeLinecap="round" />
      <circle cx={-2} cy={-10} r={2} fill={ICE} stroke={OUTLINE} strokeWidth={1.4} />
    </g>
  ),
  workFx: {
    emitter: { x: 192, y: 198 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.55,
    shapes: [cellBit, microbeBit, lensGlint],
  },
  meta: {
    nameZh: "光蜂鸟",
    elements: ["electric", "grass", "ice"],
    family: "鸟禽",
    toolAnchor: { x: 190, y: 226 },
    nodeBudget: 205,
    lieNote: "蜷在叶片吊床里，喙插进背羽",
  },
};
