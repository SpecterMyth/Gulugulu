// ---------------------------------------------------------------------------
// 雷海马 voltmare — e2（electric+water）· 鱼类水栖（漂浮）
// 剪影：直立漂浮小海马，卷尾缠一朵小雷云，背鳍=均衡器光条，头顶珊瑚冠。
// 睡姿（P3）：卷尾盘成蚊香圈贴地睡。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { FlipperArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BODY = "#FFD93B";
const DEEP = "#E39B00";
const CREAM = "#FFF6CE";
const SEA = "#2E7BD6";
const SEA_LIGHT = "#9BDCFF";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 背鳍=均衡器光条（左背，crest 摇摆） */}
      <g transform={place(92, 150)}>
        <g className="part-crest">
          <g stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round">
            <rect x={-14} y={-10} width={8} height={22} rx={4} fill={SEA_LIGHT} />
            <rect x={-4} y={-20} width={8} height={32} rx={4} fill={SEA} />
            <rect x={6} y={-14} width={8} height={26} rx={4} fill={SEA_LIGHT} />
          </g>
        </g>
      </g>
      {/* 卷尾 + 尾端缠着的小雷云（tail 摇摆） */}
      <g transform={place(146, 196)}>
        <Part name="tail" origin="30% 20%">
          <path
            d="M-6 -14 Q18 -6 16 12 Q14 26 -2 26 Q-14 26 -13 15 Q-12 6 -3 7 Q4 8 3 15"
            fill="none"
            stroke={BODY}
            strokeWidth={11}
            strokeLinecap="round"
          />
          <path
            d="M-6 -14 Q18 -6 16 12 Q14 26 -2 26 Q-14 26 -13 15 Q-12 6 -3 7 Q4 8 3 15"
            fill="none"
            stroke={OUTLINE}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.35}
          />
          <g transform="translate(-14 22)">
            <g fill="#E8EDF5" stroke={OUTLINE} strokeWidth={3}>
              <circle cx={-6} cy={0} r={7} />
              <circle cx={4} cy={-3} r={8.5} />
              <circle cx={12} cy={2} r={6} />
            </g>
            <path d="M2 8 l-3.4 6 h2.8 l-3.4 6" fill="none" stroke={DEEP} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </Part>
      </g>
      {/* 躯干：S 形海马身（上宽下窄，向右下卷） */}
      <path
        d="M112 106 Q90 118 92 152 Q94 184 118 200 Q134 210 148 202 Q158 196 154 184 Q136 190 124 176 Q112 160 118 136 Q122 120 138 114 Q128 102 112 106 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 腹节纹（海马签名） */}
      <g fill="none" stroke={DEEP} strokeWidth={3} strokeLinecap="round" opacity={0.8}>
        <path d="M104 140 q10 6 22 4" />
        <path d="M106 156 q10 6 22 3" />
        <path d="M112 172 q9 6 20 2" />
      </g>
      {/* 头（圆球）+ 向下小吸管吻 */}
      <circle cx={124} cy={112} r={34} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      <path d="M118 140 Q116 158 124 164 Q132 158 130 140 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
      <ellipse cx={124} cy={162} rx={5} ry={3} fill={DEEP} stroke={OUTLINE} strokeWidth={2.4} />
      {/* 胸鳍小手 */}
      <g transform={place(96, 128, 30)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={SEA_LIGHT} len={18} mirror />
        </Part>
      </g>
      <g transform={place(152, 130, -30)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={SEA_LIGHT} len={18} />
        </Part>
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={110} cx2={138} cy={108} r={9} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={100} cx2={148} cy={124} />
      </g>
      {/* 头顶：珊瑚小冠（headtop 呼吸摇） */}
      <g transform={place(124, 82)}>
        <Part name="headtop" origin="50% 100%">
          <g fill={SEA_LIGHT} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round">
            <path d="M-12 2 Q-16 -10 -8 -14 Q-4 -6 -4 2 Z" />
            <path d="M-2 2 Q-2 -16 4 -20 Q10 -12 6 2 Z" fill={SEA} />
            <path d="M10 2 Q14 -8 18 -8 Q18 0 14 4 Z" />
          </g>
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(186, 226)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：吻管朝右、S 身左弯、卷尾缠雷云在左下，背鳍光条在背侧。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 背鳍=均衡器光条（背侧，crest 摇摆） */}
      <g transform={place(96, 138)}>
        <g className="part-crest">
          <g stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round">
            <rect x={-14} y={-8} width={8} height={20} rx={4} fill={SEA_LIGHT} />
            <rect x={-4} y={-18} width={8} height={30} rx={4} fill={SEA} />
            <rect x={6} y={-12} width={8} height={24} rx={4} fill={SEA_LIGHT} />
          </g>
        </g>
      </g>
      {/* 卷尾 + 小雷云（左下，tail 摇摆） */}
      <g transform={place(104, 196)}>
        <Part name="tail" origin="70% 20%">
          <path
            d="M6 -12 Q-18 -4 -16 14 Q-14 28 2 28 Q14 28 13 17 Q12 8 3 9 Q-4 10 -3 17"
            fill="none"
            stroke={BODY}
            strokeWidth={11}
            strokeLinecap="round"
          />
          <g transform="translate(16 24)">
            <g fill="#E8EDF5" stroke={OUTLINE} strokeWidth={3}>
              <circle cx={-6} cy={0} r={7} />
              <circle cx={4} cy={-3} r={8.5} />
              <circle cx={12} cy={2} r={6} />
            </g>
            <path d="M2 8 l-3.4 6 h2.8 l-3.4 6" fill="none" stroke={DEEP} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </Part>
      </g>
      {/* 躯干：S 弯（头前倾向右） */}
      <path
        d="M118 104 Q98 116 100 148 Q102 178 122 196 Q136 206 148 200 Q156 194 152 184 Q136 188 126 172 Q116 156 122 134 Q126 120 140 114 Q132 102 118 104 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 腹节纹 */}
      <g fill="none" stroke={DEEP} strokeWidth={3} strokeLinecap="round" opacity={0.8}>
        <path d="M112 136 q9 5 20 4" />
        <path d="M114 152 q9 5 20 3" />
        <path d="M120 168 q8 5 18 2" />
      </g>
      {/* 头 + 吻管朝右 */}
      <circle cx={132} cy={112} r={30} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      <path d="M158 106 Q178 108 182 118 Q176 126 160 124 Q154 118 158 106 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
      <ellipse cx={178} cy={117} rx={3.4} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.2} />
      {/* 近侧胸鳍 */}
      <g transform={place(140, 138, -24)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={SEA_LIGHT} len={18} />
        </Part>
      </g>
      {/* 脸（单眼） */}
      <g className="part-face">
        <ExpSideFace cx={140} cy={106} r={9} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <circle cx={128} cy={126} r={6} fill={palette.accent} opacity={0.55} />
      </g>
      {/* 头顶：珊瑚小冠 */}
      <g transform={place(126, 84)}>
        <Part name="headtop" origin="50% 100%">
          <g fill={SEA_LIGHT} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round">
            <path d="M-10 2 Q-14 -8 -6 -12 Q-3 -5 -3 2 Z" />
            <path d="M0 2 Q0 -14 6 -18 Q11 -10 7 2 Z" fill={SEA} />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：卷尾盘成蚊香圈贴地，头枕在圈上，鳍收拢。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 蚊香盘（尾巴盘两圈半贴地，tail 缓摇） */}
      <g transform={place(132, 210)}>
        <Part name="tail" origin="50% 50%">
          <path
            d="M-44 6 Q-46 -18 -14 -22 Q22 -25 34 -6 Q42 8 22 14 Q0 20 -10 8 Q-16 -2 -2 -6 Q12 -9 14 0"
            fill="none"
            stroke={BODY}
            strokeWidth={13}
            strokeLinecap="round"
          />
          <path d="M-44 6 Q-46 -18 -14 -22" fill="none" stroke={DEEP} strokeWidth={3} strokeLinecap="round" opacity={0.4} />
        </Part>
      </g>
      {/* 小雷云垫在下巴底下当枕头 */}
      <g transform={place(66, 220)}>
        <g fill="#E8EDF5" stroke={OUTLINE} strokeWidth={3}>
          <circle cx={-5} cy={0} r={6.5} />
          <circle cx={6} cy={-2} r={7.5} />
        </g>
      </g>
      {/* 头（枕在盘外缘，闭眼） */}
      <circle cx={92} cy={196} r={28} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      <path d="M70 206 Q60 210 58 218 Q66 222 76 218 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      {/* 鳍收拢（arm 静置微摇） */}
      <g transform={place(112, 214, 40)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={SEA_LIGHT} len={14} />
        </Part>
      </g>
      <g transform={place(84, 222, 70)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={SEA_LIGHT} len={12} mirror />
        </Part>
      </g>
      {/* 脸（sleep） */}
      <g className="part-face">
        <ExpFace cx1={82} cx2={104} cy={192} r={6.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <circle cx={92} cy={206} r={1.8} fill={OUTLINE} opacity={0.8} />
      </g>
      {/* 头顶：珊瑚冠耷拉 */}
      <g transform={place(90, 170)}>
        <Part name="headtop" origin="50% 100%">
          <g fill={SEA_LIGHT} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" transform="rotate(-18)">
            <path d="M-8 2 Q-11 -6 -5 -10 Q-2 -4 -2 2 Z" />
            <path d="M1 2 Q1 -10 6 -13 Q10 -7 6 2 Z" fill={SEA} />
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

const musicNote: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinecap="round">
    <path d="M-2 6 a3.5 3.5 0 1 0 0.1 0 M1.5 5 V-6 Q1.5 -8 4 -7.5 L7 -6.5" fill={SEA} strokeWidth={2.2} />
  </g>
);
// 重低音音箱：音箱柜 + 大低音盆 + 2 道声波 + 向下的「DROP」箭头
const subwoofer: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <rect x={-10} y={-9} width={13} height={18} rx={2.4} fill="#3E4356" strokeWidth={2.4} />
    <circle cx={-3.5} cy={2} r={4.6} fill="#5C6172" strokeWidth={2} />
    <circle cx={-3.5} cy={2} r={1.7} fill={DEEP} stroke="none" />
    <circle cx={-3.5} cy={-5.5} r={1.5} fill="#8E93A6" strokeWidth={1.3} />
    <path d="M8 -8 L8 -1 M5.5 -3.5 L8 -1 L10.5 -3.5" fill="none" stroke={SEA} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <g fill="none" stroke={SEA} strokeWidth={1.8} strokeLinecap="round">
      <path d="M6 3 a4 4 0 0 1 0 6" />
      <path d="M9 1 a7 7 0 0 1 0 10" />
    </g>
  </g>
);
// 打碟机的第二产物：飞出的黑胶唱片（配 1 道电花）
const vinylBit: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeWidth={1.8}>
    <circle cx={0} cy={0} r={6} fill="#2E2E36" />
    <circle cx={0} cy={0} r={2} fill={SEA_LIGHT} stroke="none" />
    <path d="M0 -6 a6 6 0 0 1 4.5 2.5" fill="none" stroke="#5C6172" strokeWidth={1.2} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.05,
    palette: { body: BODY, deep: DEEP, belly: CREAM, accent: SEA, accent2: SEA_LIGHT },
    floating: true,
    shadowRx: 42,
    foodAnchor: { x: 124, y: 160 },
  },
  // DJ 打碟机：斜放唱盘 + 唱臂 + 推子，音浪弧
  tool: () => (
    <g>
      <path d="M-24 -6 L24 -6 L20 -22 L-20 -22 Z" fill="#3E4356" stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      <ellipse cx={-6} cy={-14} rx={9} ry={6.5} fill="#2E2E36" stroke={OUTLINE} strokeWidth={2.6} />
      <ellipse cx={-6} cy={-14} rx={3} ry={2.2} fill={SEA_LIGHT} />
      <path d="M8 -19 L15 -12" stroke="#C8CCD8" strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={8} cy={-19} r={2} fill="#C8CCD8" stroke={OUTLINE} strokeWidth={1.6} />
      <path d="M14 -10 h6 M13 -14 h4" stroke={SEA_LIGHT} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M-2 -28 q6 -4 12 0 M0 -34 q5 -3 9 0" fill="none" stroke={SEA} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 186, y: 208 },
    baseAngle: -Math.PI / 2.2,
    cone: 0.62,
    shapes: [musicNote, vinylBit, subwoofer],
  },
  meta: {
    nameZh: "雷海马",
    elements: ["electric", "water"],
    family: "鱼类水栖",
    toolAnchor: { x: 186, y: 226 },
    nodeBudget: 130,
    lieNote: "卷尾盘成蚊香圈贴地睡",
  },
};
