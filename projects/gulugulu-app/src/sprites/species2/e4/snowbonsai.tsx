// ---------------------------------------------------------------------------
// 雪盆栽 snowbonsai — e4（grass+ice+normal+water）· 植物体
// 剪影：会走路的雪松盆景：青花瓷盆（波浪纹）长小脸，虬曲树干，
//       三团积雪松云，飘雪轨道（e4 环绕件）。自称百岁的园艺大师。
// 睡姿（P3）：枝条垂下罩住自己，像盖了雪被。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const PORCELAIN = "#EAF7FF";
const COBALT = "#5C7FB5";
const PINE = "#4E9A6E";
const PINE_DEEP = "#377952";
const TRUNK = "#8A6B4F";
const SNOW = "#F7FCFD";

function Front({ palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e4 环绕件：飘雪轨道（part-orbit 慢转） */}
      <g transform={place(128, 150)}>
        <g className="part-orbit">
          <g stroke="#B0E5F0" strokeWidth={2} strokeLinecap="round">
            <path d="M-66 6 l0 -8 M-70 2 l8 0" />
            <path d="M66 -6 l0 8 M62 -2 l8 0" />
            <path d="M-6 -52 l0 8 M-10 -48 l8 0" />
            <path d="M6 46 l0 8 M2 50 l8 0" />
          </g>
        </g>
      </g>
      {/* 松云三团（先画后层两团，树干上再压前层一团） */}
      <g>
        <g transform={place(94, 118)}>
          <ellipse cx={0} cy={0} rx={30} ry={19} fill={PINE} stroke={OUTLINE} strokeWidth={5} />
          <path d="M-26 -8 Q-6 -20 22 -10 L24 -4 Q0 -14 -24 -2 Z" fill={SNOW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </g>
        <g transform={place(166, 106)}>
          <ellipse cx={0} cy={0} rx={26} ry={17} fill={PINE_DEEP} stroke={OUTLINE} strokeWidth={5} />
          <path d="M-22 -7 Q0 -17 20 -8 L21 -3 Q0 -12 -21 -2 Z" fill={SNOW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </g>
      </g>
      {/* 虬曲树干（从盆里长出，S 弯） */}
      <path
        d="M120 168 Q112 150 122 138 Q132 128 126 116 Q122 108 128 100 L140 102 Q136 112 142 120 Q150 132 140 144 Q132 154 138 168 Z"
        fill={TRUNK}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M126 132 q6 -2 10 1 M128 112 q4 -2 8 0" fill="none" stroke="#6E5540" strokeWidth={2.2} strokeLinecap="round" />
      {/* 前层松云（压住树干顶） */}
      <g transform={place(132, 88)}>
        <ellipse cx={0} cy={0} rx={34} ry={21} fill={PINE} stroke={OUTLINE} strokeWidth={5} />
        <path d="M-30 -8 Q0 -22 28 -9 L29 -3 Q0 -16 -29 -2 Z" fill={SNOW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        <g fill={SNOW}>
          <circle cx={-12} cy={8} r={2.4} />
          <circle cx={14} cy={6} r={2} />
        </g>
      </g>
      {/* 尾：盆后垂下的一小枝（左下） */}
      <g transform={place(88, 186, -20)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 q-12 4 -16 12" fill="none" stroke={TRUNK} strokeWidth={4} strokeLinecap="round" />
          <ellipse cx={-17} cy={14} rx={8} ry={5} fill={PINE} stroke={OUTLINE} strokeWidth={3} />
        </Part>
      </g>
      {/* 青花瓷盆（脸在盆上） */}
      <g>
        <rect x={84} y={162} width={88} height={16} rx={6} fill={PORCELAIN} stroke={OUTLINE} strokeWidth={5} />
        <path d="M92 178 L164 178 L156 226 Q128 232 100 226 Z" fill={PORCELAIN} stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round" />
        {/* 青花波浪纹 */}
        <path d="M100 216 q7 -6 14 0 q7 -6 14 0 q7 -6 14 0 q7 -6 14 0" fill="none" stroke={COBALT} strokeWidth={2.8} strokeLinecap="round" />
        <path d="M90 170 h20 M146 170 h18" stroke={COBALT} strokeWidth={2.4} strokeLinecap="round" />
      </g>
      {/* 小手（盆沿两侧的小瓷手） */}
      <g transform={place(88, 190, 24)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6} ry={9} fill={PORCELAIN} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(168, 190, -24)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6} ry={9} fill={PORCELAIN} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 小瓷足 */}
      <g transform={place(110, 231)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-7 0 L7 0 L5 -8 L-5 -8 Z" fill={COBALT} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-7 0 L7 0 L5 -8 L-5 -8 Z" fill={COBALT} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 脸（盆正面） */}
      <g className="part-face">
        <ExpFace cx1={114} cx2={142} cy={196} r={8.5} mouthY={212} mouthW={12} expression={expression} base={eyes} />
        <Blush cx1={103} cx2={153} cy={208} />
      </g>
      {/* 头顶：树梢一小簇雪芽（headtop 呼吸摇；探出画布安全区内） */}
      <g transform={place(132, 68)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-1 -6 2 -11" fill="none" stroke={PINE_DEEP} strokeWidth={3} strokeLinecap="round" />
          <circle cx={3} cy={-13} r={5} fill={SNOW} stroke={OUTLINE} strokeWidth={2.6} />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(194, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：瓷盆迈小步，盆脸朝前，松云前后错落，雪粒随行。 */
function Side({ palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 飘雪轨道（随行） */}
      <g transform={place(128, 148)}>
        <g className="part-orbit">
          <g stroke="#B0E5F0" strokeWidth={2} strokeLinecap="round">
            <path d="M-62 6 l0 -8 M-66 2 l8 0" />
            <path d="M62 -6 l0 8 M58 -2 l8 0" />
            <path d="M-6 -50 l0 8 M-10 -46 l8 0" />
          </g>
        </g>
      </g>
      {/* 后层松云两团 */}
      <g>
        <g transform={place(96, 122)}>
          <ellipse cx={0} cy={0} rx={28} ry={18} fill={PINE_DEEP} stroke={OUTLINE} strokeWidth={5} />
          <path d="M-24 -7 Q-4 -18 20 -9 L21 -3 Q0 -13 -22 -1 Z" fill={SNOW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </g>
        <g transform={place(164, 108)}>
          <ellipse cx={0} cy={0} rx={25} ry={16} fill={PINE} stroke={OUTLINE} strokeWidth={5} />
          <path d="M-21 -6 Q0 -16 19 -7 L20 -2 Q0 -11 -20 -1 Z" fill={SNOW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </g>
      </g>
      {/* 虬曲树干（前倾 S 弯） */}
      <path
        d="M122 172 Q114 152 126 140 Q136 130 130 118 Q126 110 134 102 L146 106 Q140 114 146 122 Q154 134 144 146 Q136 156 140 172 Z"
        fill={TRUNK}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M130 134 q6 -2 10 1" fill="none" stroke="#6E5540" strokeWidth={2.2} strokeLinecap="round" />
      {/* 前层松云（压住干顶，朝前） */}
      <g transform={place(140, 88)}>
        <ellipse cx={0} cy={0} rx={32} ry={20} fill={PINE} stroke={OUTLINE} strokeWidth={5} />
        <path d="M-28 -8 Q0 -20 26 -8 L27 -3 Q0 -15 -27 -2 Z" fill={SNOW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        <circle cx={-10} cy={7} r={2.2} fill={SNOW} />
      </g>
      {/* 尾：盆后垂枝 */}
      <g transform={place(92, 184, -22)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 q-12 4 -16 12" fill="none" stroke={TRUNK} strokeWidth={4} strokeLinecap="round" />
          <ellipse cx={-17} cy={14} rx={8} ry={5} fill={PINE} stroke={OUTLINE} strokeWidth={3} />
        </Part>
      </g>
      {/* 青花瓷盆（侧视，脸在前半） */}
      <g>
        <rect x={88} y={164} width={82} height={16} rx={6} fill={PORCELAIN} stroke={OUTLINE} strokeWidth={5} />
        <path d="M96 180 L162 180 L154 226 Q126 232 104 226 Z" fill={PORCELAIN} stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round" />
        <path d="M104 216 q7 -6 14 0 q7 -6 14 0 q7 -6 14 0" fill="none" stroke={COBALT} strokeWidth={2.8} strokeLinecap="round" />
        <path d="M94 172 h18" stroke={COBALT} strokeWidth={2.4} strokeLinecap="round" />
      </g>
      {/* 小瓷手 */}
      <g transform={place(94, 192, 22)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6} ry={9} fill={PORCELAIN} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(164, 190, -24)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6} ry={9} fill={PORCELAIN} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 小瓷足（迈步） */}
      <g transform={place(112, 230)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-7 0 L7 0 L5 -8 L-5 -8 Z" fill={COBALT} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-7 0 L7 0 L5 -8 L-5 -8 Z" fill={COBALT} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 脸（盆面偏前=侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={146} cy={196} r={8.5} mouthX={152} mouthY={212} mouthW={10} expression={expression} base={eyes} />
        <ellipse cx={132} cy={208} rx={6.5} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：树梢雪芽（前倾） */}
      <g transform={place(140, 68, 8)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-1 -6 2 -11" fill="none" stroke={PINE_DEEP} strokeWidth={3} strokeLinecap="round" />
          <circle cx={3} cy={-13} r={5} fill={SNOW} stroke={OUTLINE} strokeWidth={2.6} />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：松枝全体垂下罩住瓷盆，像盖了床雪被，盆脸从枝缝里露出睡颜。 */
function Lie({ palette, slots = {}, eyes = "sleepy", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 飘雪轨道（低速贴地） */}
      <g transform={place(128, 178)}>
        <g className="part-orbit">
          <g stroke="#B0E5F0" strokeWidth={2} strokeLinecap="round">
            <path d="M-60 4 l0 -8 M-64 0 l8 0" />
            <path d="M60 -2 l0 8 M56 2 l8 0" />
          </g>
        </g>
      </g>
      {/* 尾：垂枝摊地（左） */}
      <g transform={place(76, 220, -56)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 q-12 4 -16 12" fill="none" stroke={TRUNK} strokeWidth={4} strokeLinecap="round" />
          <ellipse cx={-17} cy={14} rx={8} ry={5} fill={PINE} stroke={OUTLINE} strokeWidth={3} />
        </Part>
      </g>
      {/* 青花瓷盆（落座） */}
      <g>
        <rect x={86} y={176} width={84} height={15} rx={6} fill={PORCELAIN} stroke={OUTLINE} strokeWidth={5} />
        <path d="M94 191 L162 191 L154 228 Q126 234 102 228 Z" fill={PORCELAIN} stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round" />
        <path d="M102 218 q7 -6 14 0 q7 -6 14 0 q7 -6 14 0" fill="none" stroke={COBALT} strokeWidth={2.8} strokeLinecap="round" />
      </g>
      {/* 弯垂的短树干 */}
      <path
        d="M120 178 Q116 164 124 154 Q130 146 126 138 L138 140 Q134 150 140 158 Q146 166 138 178 Z"
        fill={TRUNK}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      {/* 松云全体垂下（雪被）：左右两团压低 + 中团罩顶 + 垂枝盖盆沿 */}
      <g>
        <g transform={place(88, 158)}>
          <ellipse cx={0} cy={0} rx={30} ry={19} fill={PINE_DEEP} stroke={OUTLINE} strokeWidth={5} />
          <path d="M-26 -8 Q-4 -19 22 -9 L23 -3 Q0 -14 -24 -1 Z" fill={SNOW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </g>
        <g transform={place(168, 156)}>
          <ellipse cx={0} cy={0} rx={27} ry={17} fill={PINE_DEEP} stroke={OUTLINE} strokeWidth={5} />
          <path d="M-23 -7 Q0 -17 21 -8 L22 -3 Q0 -12 -21 -1 Z" fill={SNOW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </g>
        <g transform={place(128, 132)}>
          <ellipse cx={0} cy={0} rx={36} ry={22} fill={PINE} stroke={OUTLINE} strokeWidth={5} />
          <path d="M-32 -9 Q0 -23 30 -10 L31 -4 Q0 -17 -31 -3 Z" fill={SNOW} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
          <g fill={SNOW}>
            <circle cx={-13} cy={9} r={2.4} />
            <circle cx={15} cy={7} r={2} />
          </g>
        </g>
        {/* 垂枝盖到盆沿（被角） */}
        <ellipse cx={102} cy={184} rx={11} ry={6.5} fill={PINE} stroke={OUTLINE} strokeWidth={3.4} />
        <ellipse cx={154} cy={182} rx={11} ry={6.5} fill={PINE} stroke={OUTLINE} strokeWidth={3.4} />
        <path d="M92 188 Q128 176 164 188" fill="none" stroke={SNOW} strokeWidth={4.5} strokeLinecap="round" opacity={0.95} />
      </g>
      {/* 小瓷手（收拢盆侧） */}
      <g transform={place(90, 204, 10)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8} fill={PORCELAIN} stroke={OUTLINE} strokeWidth={3.8} />
        </Part>
      </g>
      <g transform={place(166, 204, -10)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8} fill={PORCELAIN} stroke={OUTLINE} strokeWidth={3.8} />
        </Part>
      </g>
      {/* 小瓷足尖（盆底微露） */}
      <g transform={place(112, 231)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-6 0 L6 0 L4 -6 L-4 -6 Z" fill={COBALT} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(144, 231)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-6 0 L6 0 L4 -6 L-4 -6 Z" fill={COBALT} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 脸（盆面睡颜） */}
      <g className="part-face">
        <ExpFace cx1={114} cx2={142} cy={204} r={8} mouthY={218} mouthW={11} expression={expression} base={eyes} />
        <Blush cx1={104} cx2={152} cy={214} />
      </g>
      {/* 头顶：雪芽垂头 */}
      <g transform={place(132, 112, 30)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-1 -5 2 -10" fill="none" stroke={PINE_DEEP} strokeWidth={3} strokeLinecap="round" />
          <circle cx={3} cy={-12} r={4.5} fill={SNOW} stroke={OUTLINE} strokeWidth={2.4} />
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

// 盆栽：花盆 + 弯干 + 树冠
const bonsaiTree: ParticleRenderer = () => (
  <g>
    <path d="M0 4 L0 -3" stroke={TRUNK} strokeWidth={2.6} strokeLinecap="round" />
    <path d="M0 -1 Q-1 -5 -3 -7 M0 -2 Q1 -5 3 -6" fill="none" stroke={TRUNK} strokeWidth={2.2} strokeLinecap="round" />
    <ellipse cx={-3.5} cy={-7} rx={4} ry={2.8} fill={PINE} stroke={OUTLINE} strokeWidth={1.8} />
    <ellipse cx={4} cy={-7.5} rx={3.6} ry={2.6} fill={PINE} stroke={OUTLINE} strokeWidth={1.8} />
    <ellipse cx={0} cy={-9.5} rx={3.6} ry={2.6} fill={PINE_DEEP} stroke={OUTLINE} strokeWidth={1.8} />
    <path d="M-6 4 L6 4 L4.5 8.5 Q0 9.5 -4.5 8.5 Z" fill={COBALT} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M-6 4 h12" stroke={OUTLINE} strokeWidth={1.6} />
  </g>
);
// 修枝剪
const pruningShears: ParticleRenderer = () => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d="M-5 -8 L1 0 L-4 8 M5 -8 L-1 0 L4 8" stroke={OUTLINE} strokeWidth={3.6} />
    <path d="M-5 -8 L1 0 L-4 8 M5 -8 L-1 0 L4 8" stroke="#C8CCD8" strokeWidth={1.8} />
    <circle cx={-4.4} cy={9} r={2} stroke={TRUNK} strokeWidth={2} />
    <circle cx={4.4} cy={9} r={2} stroke={TRUNK} strokeWidth={2} />
    <circle cx={0} cy={0} r={1.5} fill={COBALT} stroke={OUTLINE} strokeWidth={1.4} />
  </g>
);
// 松枝剪叶（沿用既有松叶粒）
const pineClipping: ParticleRenderer = () => (
  <g stroke={PINE_DEEP} strokeWidth={2.2} strokeLinecap="round">
    <path d="M0 -6 V6 M0 -3 L-4 -6 M0 -3 L4 -6 M0 1 L-4.5 -2 M0 1 L4.5 -2" />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1,
    palette: { body: PINE, deep: PINE_DEEP, belly: PORCELAIN, accent: COBALT, accent2: "#CFEFF6" },
    eyes: "sleepy",
    foodAnchor: { x: 128, y: 212 },
    shadowRx: 54,
  },
  // 修枝剪：双柄园艺剪 + 一小枝剪下的松枝
  tool: () => (
    <g>
      <g transform="rotate(-20)">
        <path d="M-3 0 Q-8 -6 -6 -12 L-1 -10 Q-2 -5 0 -2 Z" fill="#E2432E" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        <path d="M3 0 Q8 -6 6 -12 L1 -10 Q2 -5 0 -2 Z" fill="#E2432E" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        <circle cx={0} cy={-13} r={2.6} fill="#8E93A6" stroke={OUTLINE} strokeWidth={2} />
        <path d="M-2 -14 Q-6 -24 -1 -32 L1 -32 Q5 -24 2 -14 Z" fill="#C8CCD8" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
      </g>
      <g transform="translate(14 -26) rotate(24)">
        <path d="M0 8 V-4" stroke={TRUNK} strokeWidth={2.6} strokeLinecap="round" />
        <ellipse cx={1} cy={-7} rx={6.5} ry={4.5} fill={PINE} stroke={OUTLINE} strokeWidth={2.4} />
        <path d="M-4 -9 Q1 -12 6 -9" fill="none" stroke={SNOW} strokeWidth={2} strokeLinecap="round" />
      </g>
    </g>
  ),
  workFx: {
    emitter: { x: 196, y: 202 },
    baseAngle: -Math.PI / 2.4,
    cone: 0.55,
    shapes: [bonsaiTree, pruningShears, pineClipping],
  },
  meta: {
    nameZh: "雪盆栽",
    elements: ["grass", "ice", "normal", "water"],
    family: "植物体",
    toolAnchor: { x: 194, y: 231 },
    nodeBudget: 255,
    lieNote: "枝条垂下罩住自己，像盖了雪被",
  },
};
