// ---------------------------------------------------------------------------
// 赤陶甲 claypango — e5（fire+grass+ice+normal+water，缺电）· 甲壳
// 剪影：小穿山甲，鳞片=一片片上釉陶瓦（五色釉彩，礼装层），
//       大卷尾裹身，怀里抱着一只小陶罐。古法窑厂传人。
// 睡姿（P3）：卷成一只完美的陶罐球。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const CLAY = "#C9704A";
const CLAY_DEEP = "#A5522F";
const CREAM = "#FFE8D6";
const GLAZE_F = "#E85D3A";
const GLAZE_G = "#8CD97B";
const GLAZE_I = "#8FD8E8";
const GLAZE_W = "#2E7BD6";
const GLAZE_N = "#F2EFE0";

/** 一片釉彩陶瓦鳞（pivot=瓦顶中点，向下叠） */
function GlazeTile({ color, s = 1 }: { color: string; s?: number }) {
  return (
    <path
      d={`M${-9 * s} 0 L${9 * s} 0 L${7 * s} ${12 * s} Q0 ${16 * s} ${-7 * s} ${12 * s} Z`}
      fill={color}
      stroke={OUTLINE}
      strokeWidth={3}
      strokeLinejoin="round"
    />
  );
}

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 大卷尾（招牌：右侧向前卷到身前，尾面也贴瓦鳞） */}
      <g transform={place(170, 214)}>
        <Part name="tail" origin="10% 70%">
          <path
            d="M0 6 Q30 8 36 -14 Q38 -30 24 -32 Q14 -33 12 -22 Q11 -13 20 -13"
            fill="none"
            stroke={CLAY}
            strokeWidth={13}
            strokeLinecap="round"
          />
          <g>
            <g transform={place(30, -4, -40)}><GlazeTile color={GLAZE_I} s={0.62} /></g>
            <g transform={place(33, -18, -70)}><GlazeTile color={GLAZE_W} s={0.58} /></g>
            <g transform={place(23, -28, -110)}><GlazeTile color={GLAZE_G} s={0.55} /></g>
          </g>
        </Part>
      </g>
      {/* 身体（拱背穿山甲） */}
      <path
        d="M76 208 Q74 156 108 136 Q128 126 148 136 Q182 156 180 208 Q180 226 128 228 Q76 226 76 208 Z"
        fill={CLAY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 釉彩瓦鳞五排（礼装层：从背脊向下叠瓦，五色釉） */}
      <g>
        <g transform={place(108, 134, -16)}><GlazeTile color={GLAZE_N} /></g>
        <g transform={place(130, 130)}><GlazeTile color={GLAZE_F} /></g>
        <g transform={place(152, 136, 16)}><GlazeTile color={GLAZE_I} /></g>
        <g transform={place(94, 152, -26)}><GlazeTile color={GLAZE_G} /></g>
        <g transform={place(118, 148, -8)}><GlazeTile color={GLAZE_I} /></g>
        <g transform={place(142, 148, 8)}><GlazeTile color={GLAZE_W} /></g>
        <g transform={place(164, 154, 26)}><GlazeTile color={GLAZE_F} /></g>
        <g transform={place(106, 168, -14)}><GlazeTile color={GLAZE_W} s={0.92} /></g>
        <g transform={place(130, 166)}><GlazeTile color={GLAZE_G} s={0.92} /></g>
        <g transform={place(154, 168, 14)}><GlazeTile color={GLAZE_N} s={0.92} /></g>
      </g>
      {/* 奶油肚 + 怀里小陶罐 */}
      <ellipse cx={122} cy={200} rx={30} ry={19} fill={CREAM} opacity={0.95} />
      <g transform={place(122, 198)}>
        <path d="M-9 8 Q-12 -2 -7 -7 L7 -7 Q12 -2 9 8 Q0 12 -9 8 Z" fill={CLAY_DEEP} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        <path d="M-7 -7 Q0 -11 7 -7" fill="none" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
        <path d="M-5 -2 Q0 -4 5 -2" fill="none" stroke={GLAZE_I} strokeWidth={2.2} strokeLinecap="round" />
      </g>
      {/* 小手（抱罐） */}
      <g transform={place(102, 194, 30)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={9} fill={CLAY} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(144, 194, -30)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={9} fill={CLAY} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(104, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={CLAY} deep={CLAY_DEEP} rx={8.5} ry={5} lift={5} />
        </Part>
      </g>
      <g transform={place(148, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={CLAY} deep={CLAY_DEEP} rx={8.5} ry={5} lift={5} />
        </Part>
      </g>
      {/* 头（大头比例，从拱背前下方探出） */}
      <g>
        <ellipse cx={98} cy={160} rx={34} ry={29} fill={CLAY} stroke={OUTLINE} strokeWidth={5.5} />
        <path d="M72 170 Q58 174 54 184 Q64 191 76 187 Q83 182 83 174 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        <ellipse cx={61} cy={180} rx={3} ry={2.4} fill={CLAY_DEEP} />
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={87} cx2={113} cy={154} r={8.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={80} cx2={122} cy={170} />
      </g>
      {/* 头顶：一片小瓦呆饰（headtop 呼吸摇） */}
      <g transform={place(100, 133)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(-10)">
            <GlazeTile color={GLAZE_F} s={0.6} />
          </g>
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(196, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：拱背迈步，尖吻朝前，釉瓦顺背脊叠排，大卷尾在身后立卷。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 大卷尾（身后立卷 + 尾瓦） */}
      <g transform={place(74, 206)}>
        <Part name="tail" origin="90% 70%">
          <path
            d="M0 6 Q-30 8 -36 -14 Q-38 -30 -24 -32 Q-14 -33 -12 -22 Q-11 -13 -20 -13"
            fill="none"
            stroke={CLAY}
            strokeWidth={13}
            strokeLinecap="round"
          />
          <g>
            <g transform={place(-30, -4, 40)}><GlazeTile color={GLAZE_I} s={0.62} /></g>
            <g transform={place(-33, -18, 70)}><GlazeTile color={GLAZE_W} s={0.58} /></g>
          </g>
        </Part>
      </g>
      {/* 身体（拱背前行） */}
      <path
        d="M84 208 Q82 156 116 136 Q136 126 158 140 Q188 160 184 208 Q184 226 132 228 Q84 226 84 208 Z"
        fill={CLAY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 釉彩瓦鳞（顺背脊三排） */}
      <g>
        <g transform={place(106, 138, -18)}><GlazeTile color={GLAZE_N} /></g>
        <g transform={place(130, 132, -2)}><GlazeTile color={GLAZE_F} /></g>
        <g transform={place(152, 140, 14)}><GlazeTile color={GLAZE_I} /></g>
        <g transform={place(94, 156, -26)}><GlazeTile color={GLAZE_G} /></g>
        <g transform={place(118, 152, -10)}><GlazeTile color={GLAZE_I} s={0.92} /></g>
        <g transform={place(142, 152, 6)}><GlazeTile color={GLAZE_W} s={0.92} /></g>
        <g transform={place(164, 158, 22)}><GlazeTile color={GLAZE_F} s={0.88} /></g>
      </g>
      {/* 怀里小陶罐（胸前抱行） */}
      <ellipse cx={152} cy={204} rx={24} ry={15} fill={CREAM} opacity={0.95} />
      <g transform={place(152, 202)}>
        <path d="M-9 8 Q-12 -2 -7 -7 L7 -7 Q12 -2 9 8 Q0 12 -9 8 Z" fill={CLAY_DEEP} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        <path d="M-7 -7 Q0 -11 7 -7" fill="none" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
        <path d="M-5 -2 Q0 -4 5 -2" fill="none" stroke={GLAZE_I} strokeWidth={2.2} strokeLinecap="round" />
      </g>
      {/* 小手抱罐 */}
      <g transform={place(136, 198, 26)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={9} fill={CLAY} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(166, 196, -22)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={9} fill={CLAY} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 小脚（迈步） */}
      <g transform={place(106, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={CLAY} deep={CLAY_DEEP} rx={8.5} ry={5} lift={5} />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={CLAY} deep={CLAY_DEEP} rx={8.5} ry={5} lift={5} />
        </Part>
      </g>
      {/* 头（前伸）+ 尖吻朝前 */}
      <ellipse cx={172} cy={168} rx={30} ry={26} fill={CLAY} stroke={OUTLINE} strokeWidth={5.5} />
      <path d="M194 176 Q208 180 212 190 Q202 197 190 193 Q183 188 183 180 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <ellipse cx={205} cy={187} rx={3} ry={2.4} fill={CLAY_DEEP} />
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={178} cy={162} r={8.5} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={164} cy={178} rx={6.5} ry={4.5} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 头顶：小瓦呆饰（前倾） */}
      <g transform={place(174, 142, 8)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(-6)">
            <GlazeTile color={GLAZE_F} s={0.6} />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：卷成一只完美的陶罐球——卷尾盘成罐口，釉瓦排成罐纹，睡脸嵌在釉窗里。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 陶罐球身（卷起的身体） */}
      <path
        d="M80 226 Q72 192 88 168 Q102 148 128 148 Q154 148 168 168 Q184 192 176 226 Q128 238 80 226 Z"
        fill={CLAY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 釉彩瓦纹两圈 */}
      <g>
        <g transform={place(102, 168, -22)}><GlazeTile color={GLAZE_G} s={0.9} /></g>
        <g transform={place(128, 162)}><GlazeTile color={GLAZE_F} s={0.95} /></g>
        <g transform={place(154, 168, 22)}><GlazeTile color={GLAZE_I} s={0.9} /></g>
        <g transform={place(92, 190, -30)}><GlazeTile color={GLAZE_W} s={0.85} /></g>
        <g transform={place(164, 190, 30)}><GlazeTile color={GLAZE_N} s={0.85} /></g>
      </g>
      {/* 釉面睡脸窗（脸从卷缝里露出） */}
      <ellipse cx={128} cy={198} rx={24} ry={17} fill={CREAM} stroke={OUTLINE} strokeWidth={4} />
      <g className="part-face">
        <ExpFace cx1={118} cx2={138} cy={194} r={7} mouthY={208} mouthW={9} expression={expression} base={eyes} />
        <Blush cx1={110} cx2={146} cy={204} />
      </g>
      {/* 小手（收在脸窗两侧） */}
      <g transform={place(104, 210, 18)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={6} rx={5.5} ry={8} fill={CLAY} stroke={OUTLINE} strokeWidth={3.8} />
        </Part>
      </g>
      <g transform={place(152, 210, -18)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={6} rx={5.5} ry={8} fill={CLAY} stroke={OUTLINE} strokeWidth={3.8} />
        </Part>
      </g>
      {/* 脚尖（罐底微露） */}
      <g transform={place(108, 232)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={7} ry={4} fill={CLAY_DEEP} stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      <g transform={place(148, 232)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={7} ry={4} fill={CLAY_DEEP} stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      {/* 卷尾盘成罐口（顶圈） */}
      <g transform={place(128, 152)}>
        <Part name="tail" origin="50% 100%">
          <path d="M-26 2 Q-26 -14 0 -14 Q26 -14 26 2" fill="none" stroke={CLAY} strokeWidth={12} strokeLinecap="round" />
          <path d="M26 2 Q34 0 34 -8 Q34 -14 28 -13" fill="none" stroke={CLAY} strokeWidth={8} strokeLinecap="round" />
          <path d="M-18 -8 Q0 -13 18 -8" fill="none" stroke={CLAY_DEEP} strokeWidth={2.6} strokeLinecap="round" opacity={0.7} />
          <g transform={place(0, -12, 0)}><GlazeTile color={GLAZE_F} s={0.5} /></g>
        </Part>
      </g>
      {/* 旁边的小陶罐（安放着一起睡） */}
      <g transform="translate(196 222)">
        <path d="M-8 7 Q-11 -2 -6 -6 L6 -6 Q11 -2 8 7 Q0 11 -8 7 Z" fill={CLAY_DEEP} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        <path d="M-6 -6 Q0 -10 6 -6" fill="none" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
        <path d="M-4 -1 Q0 -3 4 -1" fill="none" stroke={GLAZE_I} strokeWidth={2} strokeLinecap="round" />
      </g>
      {/* 头顶：罐口小瓦呆饰 */}
      <g transform={place(128, 134)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(-8)">
            <GlazeTile color={GLAZE_G} s={0.55} />
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

// 陶艺打工的产物：拉坯陶瓶 + 湿泥飞溅 + 成品马克杯
const clayVase: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    {/* 瓶身 */}
    <path d="M-4 -8 Q0 -9 4 -8 Q5 -4 6 1 Q6 7 0 8 Q-6 7 -6 1 Q-5 -4 -4 -8 Z" fill={CLAY} strokeWidth={2} />
    {/* 瓶口 */}
    <path d="M-4 -8 Q0 -10 4 -8" fill="none" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" />
    {/* 拉坯纹 */}
    <g stroke={CLAY_DEEP} strokeWidth={1.1} fill="none" opacity={0.65} strokeLinecap="round">
      <path d="M-5.5 -1 Q0 0.5 5.5 -1 M-6 3 Q0 4.5 5.5 3" />
    </g>
    {/* 转盘暗示 */}
    <ellipse cx={0} cy={11} rx={9} ry={2.4} fill="none" stroke={CLAY_DEEP} strokeWidth={1.6} opacity={0.7} />
  </g>
);
const claySplat: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <path d="M-6 -3 Q-8 -7 -4 -7 Q-2 -9 1 -6 Q6 -8 6 -3 Q10 -1 6 3 Q8 7 3 6 Q1 9 -2 6 Q-7 8 -6 2 Q-9 0 -6 -3 Z" fill={CLAY} strokeWidth={2} />
    <path d="M-2 -1 q2 -2 4 0" fill="none" stroke={CLAY_DEEP} strokeWidth={1.5} strokeLinecap="round" />
    <circle cx={2.5} cy={2.5} r={1.2} fill={CLAY_DEEP} stroke="none" />
  </g>
);
const finishedMug: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    {/* 杯身（上釉成品） */}
    <path d="M-6 -6 L5 -6 L4 7 Q-0.5 9 -5 7 Z" fill={GLAZE_I} strokeWidth={2} />
    <path d="M-6 -6 Q-0.5 -4 5 -6" fill="none" stroke={OUTLINE} strokeWidth={1.6} />
    {/* 把手 */}
    <path d="M5 -3 Q11 -3 10 2 Q9 5 4 4" fill="none" strokeWidth={2.2} />
    {/* 釉光 */}
    <path d="M-4.5 -1 Q-0.5 1 3.5 -1" fill="none" stroke="#FFFFFF" strokeWidth={1.4} opacity={0.8} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.14,
    palette: { body: CLAY, deep: CLAY_DEEP, belly: CREAM, accent: GLAZE_G, accent2: GLAZE_I },
    foodAnchor: { x: 90, y: 172 },
    shadowRx: 60,
  },
  // 陶艺转盘：手持转轮 + 拉坯小陶罐
  tool: () => (
    <g>
      <path d="M-12 0 h24" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
      <path d="M0 0 V-8" stroke="#8E93A6" strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={0} cy={-11} rx={15} ry={4.5} fill="#8E93A6" stroke={OUTLINE} strokeWidth={3} />
      <path d="M-7 -13 Q-9 -26 -4 -30 L4 -30 Q9 -26 7 -13 Q0 -10 -7 -13 Z" fill={CLAY} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M-4 -30 Q0 -33 4 -30" fill="none" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M-5 -22 Q0 -24 5 -22" fill="none" stroke={GLAZE_I} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M18 -16 a8 8 0 0 1 -4 7" fill="none" stroke={CLAY_DEEP} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 196, y: 204 },
    baseAngle: -Math.PI / 2.4,
    cone: 0.55,
    shapes: [clayVase, claySplat, finishedMug],
  },
  meta: {
    nameZh: "赤陶甲",
    elements: ["fire", "grass", "ice", "normal", "water"],
    family: "甲壳",
    toolAnchor: { x: 196, y: 231 },
    nodeBudget: 305,
    lieNote: "卷成一只完美的陶罐球",
  },
};
