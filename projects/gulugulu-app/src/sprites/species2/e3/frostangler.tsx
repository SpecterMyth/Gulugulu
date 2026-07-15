// ---------------------------------------------------------------------------
// 霜灯鱼 frostangler — e3（electric+ice+water）· 鱼类水栖（漂浮）
// 剪影：圆滚深海鮟鱇，头顶钓竿挑一颗发光闪电灯泡（招牌），
//       软糯冰牙，宽尾鳍。夜班巡逻员。
// 睡姿（P3）：咬住自己的灯泡当夜灯，整鱼贴地。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { FlipperArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const DEEPSEA = "#4A5A8A";
const DEEPER = "#39466E";
const BELLY = "#CFEFF6";
const VOLT = "#FFD93B";
const ICE = "#8FD8E8";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾鳍（右下宽扇尾） */}
      <g transform={place(180, 204, 24)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 0 Q14 -12 24 -10 Q22 -2 16 2 Q24 4 26 12 Q14 16 4 8 Q0 4 0 0 Z" fill={DEEPER} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M8 -2 Q14 0 16 6" fill="none" stroke={ICE} strokeWidth={2.2} strokeLinecap="round" />
        </Part>
      </g>
      {/* 球身（深海圆鱼，底部微贴地=漂浮低悬） */}
      <circle cx={124} cy={172} r={56} fill={DEEPSEA} stroke={OUTLINE} strokeWidth={6} />
      {/* 冰蓝大肚（下半） */}
      <path d="M70 184 Q124 168 178 184 Q172 220 124 226 Q76 220 70 184 Z" fill={BELLY} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      {/* 侧鳍手 */}
      <g transform={place(74, 178, 30)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={DEEPER} len={18} mirror />
        </Part>
      </g>
      <g transform={place(174, 178, -30)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={DEEPER} len={18} />
        </Part>
      </g>
      {/* 大嘴（宽弧嘴 + 两颗软糯冰牙；withMouth=false 自绘） */}
      <g className="part-face">
        <ExpFace cx1={102} cx2={146} cy={158} r={10} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path
          d={expression === "happy" || expression === "star"
            ? "M94 180 Q124 200 154 180 Q150 208 124 208 Q98 208 94 180 Z"
            : "M96 182 Q124 198 152 182"}
          fill={expression === "happy" || expression === "star" ? DEEPER : "none"}
          stroke={OUTLINE}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M106 185 L106 179 L113 186 Z M142 185 L142 179 L135 186 Z" fill="#F7FCFD" stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        <Blush cx1={92} cx2={156} cy={172} />
      </g>
      {/* 头顶：钓竿灯（招牌：弯竿+发光闪电灯泡，headtop 呼吸摇） */}
      <g transform={place(118, 118)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-2 -14 10 -22 Q22 -28 30 -24" fill="none" stroke={DEEPER} strokeWidth={5} strokeLinecap="round" />
          <g transform="translate(34 -20)">
            <circle cx={0} cy={0} r={11} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={3.4} />
            <path d="M1.5 -5 L-2.5 0.5 h2 L-1 5.5 L3.5 0 h-2 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round" />
            <g stroke={VOLT} strokeWidth={2.2} strokeLinecap="round" opacity={0.9}>
              <path d="M-13 -6 l-4 -2 M0 -14 v-4 M13 -6 l4 -2" />
            </g>
          </g>
        </Part>
      </g>
      {/* 腿位（漂浮种：两片小腹鳍代位） */}
      <g transform={place(106, 226)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-6 0 Q0 -7 6 0 Q0 4 -6 0 Z" fill={DEEPER} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(142, 226)}>
        <Part name="legR" origin="50% -40%">
          <path d="M-6 0 Q0 -7 6 0 Q0 4 -6 0 Z" fill={DEEPER} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(194, 228)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：圆鱼前游，大嘴朝前，钓竿灯挑在前上方照路，宽尾鳍在后。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾鳍（身后宽扇） */}
      <g transform={place(74, 188)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-14 -12 -24 -10 Q-22 -2 -16 2 Q-24 4 -26 12 Q-14 16 -4 8 Q0 4 0 0 Z" fill={DEEPER} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M-16 -4 Q-10 0 -8 6" fill="none" stroke={ICE} strokeWidth={2.2} strokeLinecap="round" />
        </Part>
      </g>
      {/* 远侧鳍 */}
      <g transform={place(98, 198, 32)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={DEEPER} len={17} mirror />
        </Part>
      </g>
      {/* 球身（前倾） */}
      <circle cx={124} cy={172} r={52} fill={DEEPSEA} stroke={OUTLINE} strokeWidth={6} />
      {/* 冰蓝大肚（前下） */}
      <path d="M80 190 Q130 174 174 188 Q166 218 124 224 Q84 216 80 190 Z" fill={BELLY} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      {/* 近侧鳍（划水） */}
      <g transform={place(138, 206, -24)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={DEEPER} len={18} />
        </Part>
      </g>
      {/* 腹鳍两片（漂浮代腿） */}
      <g transform={place(104, 226)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-6 0 Q0 -7 6 0 Q0 4 -6 0 Z" fill={DEEPER} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(140, 227)}>
        <Part name="legR" origin="50% -40%">
          <path d="M-6 0 Q0 -7 6 0 Q0 4 -6 0 Z" fill={DEEPER} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 大嘴（朝前弧嘴 + 冰牙） */}
      <g className="part-face">
        <ExpSideFace cx={150} cy={156} r={10} expression={expression} base={eyes} withMouth={false} />
        <path
          d={expression === "happy" || expression === "star"
            ? "M134 186 Q154 200 172 184 Q166 206 146 206 Q132 200 134 186 Z"
            : "M136 188 Q156 198 172 184"}
          fill={expression === "happy" || expression === "star" ? DEEPER : "none"}
          stroke={OUTLINE}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M146 190 L146 184 L153 191 Z M166 186 L166 180 L159 187 Z" fill="#F7FCFD" stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        <ellipse cx={136} cy={172} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：钓竿灯（前挑照路） */}
      <g transform={place(122, 120)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q0 -14 12 -20 Q24 -26 32 -20" fill="none" stroke={DEEPER} strokeWidth={5} strokeLinecap="round" />
          <g transform="translate(36 -16)">
            <circle cx={0} cy={0} r={11} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={3.4} />
            <path d="M1.5 -5 L-2.5 0.5 h2 L-1 5.5 L3.5 0 h-2 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round" />
            <g stroke={VOLT} strokeWidth={2.2} strokeLinecap="round" opacity={0.9}>
              <path d="M13 -6 l4 -2 M14 4 l4 2 M0 -14 v-4" />
            </g>
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：整鱼贴地，钓竿弯下来把灯泡咬在嘴里当夜灯，尾鳍摊平。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾鳍（右侧摊平） */}
      <g transform={place(182, 214, 18)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 0 Q14 -10 24 -8 Q22 0 16 4 Q24 6 26 14 Q14 17 4 9 Q0 4 0 0 Z" fill={DEEPER} stroke={OUTLINE} strokeWidth={4.2} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 球身（贴地压扁） */}
      <ellipse cx={124} cy={196} rx={54} ry={38} fill={DEEPSEA} stroke={OUTLINE} strokeWidth={6} />
      {/* 冰蓝大肚（贴地半圈） */}
      <path d="M74 206 Q124 192 174 206 Q166 230 124 233 Q82 230 74 206 Z" fill={BELLY} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      {/* 侧鳍摊平 */}
      <g transform={place(78, 208, 54)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={DEEPER} len={16} mirror />
        </Part>
      </g>
      <g transform={place(172, 208, -54)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={DEEPER} len={16} />
        </Part>
      </g>
      {/* 腹鳍（贴地） */}
      <g transform={place(102, 231)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-6 0 Q0 -6 6 0 Q0 3.5 -6 0 Z" fill={DEEPER} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -40%">
          <path d="M-6 0 Q0 -6 6 0 Q0 3.5 -6 0 Z" fill={DEEPER} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 夜灯：咬在嘴里的灯泡（暖光晕） */}
      <circle cx={118} cy={214} r={17} fill="#FFF6CE" opacity={0.4} />
      <circle cx={118} cy={213} r={10} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={3.2} />
      <path d="M119.5 209 L115.5 213.5 h2 L117 218 L121.5 213 h-2 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.5} strokeLinejoin="round" />
      {/* 嘴（合拢咬住灯泡）+ 冰牙搭在灯泡上 */}
      <g className="part-face">
        <ExpFace cx1={106} cx2={144} cy={184} r={9} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path d="M96 208 Q106 214 108 214 M142 208 Q134 213 128 214" fill="none" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
        <path d="M104 208 L104 203 L110 209 Z M134 207 L134 202 L128 208 Z" fill="#F7FCFD" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
        <Blush cx1={94} cx2={156} cy={196} />
      </g>
      {/* 头顶：钓竿（弯下来送灯进嘴） */}
      <g transform={place(112, 152)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-6 -10 4 -16 Q16 -22 24 -12 Q30 -2 24 16 Q18 32 10 46" fill="none" stroke={DEEPER} strokeWidth={4.5} strokeLinecap="round" />
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

const beamStar: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={5} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={1.8} />
    <path d="M-8 0 h3 M8 0 h-3 M0 -8 v3" stroke={VOLT} strokeWidth={2} strokeLinecap="round" />
  </g>
);
// 头灯的第二产物：投出的光束条（配 1 颗深海气泡）
const rayBit: ParticleRenderer = () => (
  <path d="M-3 8 L-1 -8 L3 -8 L1 8 Z" fill="#FFF6CE" opacity={0.7} stroke={VOLT} strokeWidth={1.8} strokeLinejoin="round" />
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
    scale: 1.1,
    palette: { body: DEEPSEA, deep: DEEPER, belly: BELLY, accent: VOLT, accent2: ICE },
    floating: true,
    shadowRx: 50,
    foodAnchor: { x: 124, y: 192 },
  },
  // 矿工头灯：头盔 + 前灯 + 光束
  tool: () => (
    <g>
      <path d="M-14 -8 Q-14 -26 0 -26 Q14 -26 14 -8 Q0 -4 -14 -8 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
      <path d="M-16 -8 Q0 -2 16 -8" fill="none" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M0 -26 V-30" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={0} cy={-16} r={5} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={2.6} />
      <path d="M4 -18 L20 -24 L20 -8 L4 -13 Z" fill="#FFF6CE" opacity={0.55} />
    </g>
  ),
  workFx: {
    emitter: { x: 198, y: 204 },
    baseAngle: -Math.PI / 2.4,
    cone: 0.6,
    shapes: [beamStar, rayBit, bubbleBit],
  },
  meta: {
    nameZh: "霜灯鱼",
    elements: ["electric", "ice", "water"],
    family: "鱼类水栖",
    toolAnchor: { x: 194, y: 228 },
    nodeBudget: 205,
    lieNote: "咬住自己的灯泡当夜灯，整鱼贴地",
  },
};
