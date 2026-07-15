// ---------------------------------------------------------------------------
// 毛线猫 yarncat — e3（grass+ice+normal）· 团状软体
// 剪影：蜷成毛线球的猫（本体=大线球，冰蓝×叶绿双股缠绕），只露耳朵、
//       尾巴和小脸；背后插一对织针（e3 装饰）。织补铺看板猫。
// 睡姿（P3）：完全卷死，尾巴当封口线。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const YARN = "#CFEFF6";
const YARN_DEEP = "#8FC8A8";
const LEAF = "#8CD97B";
const CREAM = "#FFF8EE";
const NEEDLE = "#D9A514";

function Front({ palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e3 装饰：背后交叉织针 */}
      <g stroke={OUTLINE} strokeLinecap="round">
        <path d="M76 118 L180 196" stroke={NEEDLE} strokeWidth={6} />
        <path d="M180 122 L80 198" stroke={NEEDLE} strokeWidth={6} />
        <circle cx={76} cy={116} r={5} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.6} />
        <circle cx={180} cy={120} r={5} fill="#5C7FB5" stroke={OUTLINE} strokeWidth={2.6} />
      </g>
      {/* 尾：从球底绕出的线头猫尾（右下，尖端散成线丝） */}
      <g transform={place(176, 214)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 4 Q18 6 24 -6 Q26 -12 22 -16" fill="none" stroke={YARN_DEEP} strokeWidth={8} strokeLinecap="round" />
          <path d="M22 -16 q6 -2 8 -7 M22 -16 q7 1 10 -2" fill="none" stroke={LEAF} strokeWidth={2.6} strokeLinecap="round" />
        </Part>
      </g>
      {/* 毛线球本体（大圆 + 双色缠绕线路） */}
      <circle cx={128} cy={176} r={56} fill={YARN} stroke={OUTLINE} strokeWidth={6} />
      <g fill="none" strokeLinecap="round">
        <path d="M78 158 Q128 132 178 158" stroke={YARN_DEEP} strokeWidth={4} />
        <path d="M74 180 Q128 158 182 180" stroke={LEAF} strokeWidth={4} />
        <path d="M80 202 Q128 184 176 202" stroke={YARN_DEEP} strokeWidth={4} />
        <path d="M96 134 Q88 176 100 216" stroke={LEAF} strokeWidth={3.4} opacity={0.8} />
        <path d="M162 136 Q172 176 158 216" stroke={YARN_DEEP} strokeWidth={3.4} opacity={0.8} />
      </g>
      {/* 猫耳（从球顶露出） */}
      <g fill={YARN} stroke={OUTLINE} strokeWidth={4.5}>
        <path d="M92 132 Q90 110 102 104 Q112 114 110 128 Z" />
        <path d="M164 132 Q166 110 154 104 Q144 114 146 128 Z" />
      </g>
      <path d="M97 126 Q97 114 103 110 M159 126 Q159 114 153 110" stroke="#F5A8C6" strokeWidth={3.4} strokeLinecap="round" fill="none" opacity={0.8} />
      {/* 小脸（球面上露出的猫脸区） */}
      <ellipse cx={128} cy={160} rx={28} ry={20} fill={CREAM} opacity={0.95} />
      {/* 前爪（从球前下露出两只小爪=arm；后爪藏球里=腿位用两撮线圈） */}
      <g transform={place(108, 214, 8)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={4} rx={8} ry={6} fill={CREAM} stroke={OUTLINE} strokeWidth={3.6} />
          <path d="M-3 2 v4 M2 2 v4" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
        </Part>
      </g>
      <g transform={place(148, 214, -8)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={4} rx={8} ry={6} fill={CREAM} stroke={OUTLINE} strokeWidth={3.6} />
          <path d="M-3 2 v4 M2 2 v4" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
        </Part>
      </g>
      <g transform={place(94, 228)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-8 0 q8 -6 16 0" fill="none" stroke={YARN_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(154, 228)}>
        <Part name="legR" origin="50% -40%">
          <path d="M-8 0 q8 -6 16 0" fill="none" stroke={LEAF} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 脸：猫眯眼 + w 嘴 + 小胡须 */}
      <g className="part-face">
        <ExpFace cx1={114} cx2={142} cy={156} r={8} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path d="M124 168 q4 4 8 0 M120 167 q4 5 8 1 M128 168 q4 4 8 -1" fill="none" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
        <path d="M100 160 h-9 M101 166 h-8 M156 160 h9 M155 166 h8" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" opacity={0.55} />
        <Blush cx1={104} cx2={152} cy={168} />
      </g>
      {/* 头顶：一小撮呆线圈（headtop 呼吸摇） */}
      <g transform={place(128, 122)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-3 2 Q-8 -6 -2 -10 Q3 -12 5 -7 Q7 -2 2 0 Q-1 1 -1 -3" fill="none" stroke={LEAF} strokeWidth={3.4} strokeLinecap="round" />
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

/** 侧视（右向）：线球滚步向前，猫脸偏球前侧，线头尾在后散开，地上拖一段线。 */
function Side({ palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 地上拖的线（行进痕） */}
      <path d="M50 228 Q78 222 96 228" fill="none" stroke={YARN_DEEP} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      {/* 织针（斜插球后） */}
      <g stroke={OUTLINE} strokeLinecap="round">
        <path d="M72 126 L158 198" stroke={NEEDLE} strokeWidth={6} />
        <path d="M152 120 L78 200" stroke={NEEDLE} strokeWidth={6} />
        <circle cx={72} cy={124} r={5} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.6} />
        <circle cx={152} cy={118} r={5} fill="#5C7FB5" stroke={OUTLINE} strokeWidth={2.6} />
      </g>
      {/* 尾：线头猫尾（身后散丝） */}
      <g transform={place(76, 208)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 4 Q-16 6 -22 -6 Q-24 -12 -20 -16" fill="none" stroke={YARN_DEEP} strokeWidth={8} strokeLinecap="round" />
          <path d="M-20 -16 q-6 -2 -8 -7 M-20 -16 q-7 1 -10 -2" fill="none" stroke={LEAF} strokeWidth={2.6} strokeLinecap="round" />
        </Part>
      </g>
      {/* 毛线球本体（前倾滚动感） */}
      <circle cx={130} cy={176} r={54} fill={YARN} stroke={OUTLINE} strokeWidth={6} />
      <g fill="none" strokeLinecap="round">
        <path d="M82 156 Q130 132 178 158" stroke={YARN_DEEP} strokeWidth={4} />
        <path d="M78 180 Q130 158 182 182" stroke={LEAF} strokeWidth={4} />
        <path d="M84 202 Q130 184 176 204" stroke={YARN_DEEP} strokeWidth={4} />
        <path d="M100 134 Q92 176 104 214" stroke={LEAF} strokeWidth={3.4} opacity={0.8} />
      </g>
      {/* 猫耳（球顶偏前两只） */}
      <g fill={YARN} stroke={OUTLINE} strokeWidth={4.5}>
        <path d="M118 128 Q114 106 126 102 Q136 110 134 126 Z" />
        <path d="M162 134 Q166 112 156 106 Q146 116 148 130 Z" />
      </g>
      <path d="M123 122 Q124 110 129 107 M157 128 Q158 116 153 112" stroke="#F5A8C6" strokeWidth={3.4} strokeLinecap="round" fill="none" opacity={0.8} />
      {/* 小脸区（球前侧） */}
      <ellipse cx={152} cy={158} rx={22} ry={17} fill={CREAM} opacity={0.95} />
      {/* 前爪（球前下迈步） */}
      <g transform={place(126, 226, 6)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={3} rx={7.5} ry={5.5} fill={CREAM} stroke={OUTLINE} strokeWidth={3.4} />
        </Part>
      </g>
      <g transform={place(154, 218, -12)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={3} rx={7.5} ry={5.5} fill={CREAM} stroke={OUTLINE} strokeWidth={3.4} />
          <path d="M-3 1 v4 M2 1 v4" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" opacity={0.6} />
        </Part>
      </g>
      {/* 线圈腿位 */}
      <g transform={place(100, 229)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-8 0 q8 -6 16 0" fill="none" stroke={YARN_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(142, 231)}>
        <Part name="legR" origin="50% -40%">
          <path d="M-8 0 q8 -6 16 0" fill="none" stroke={LEAF} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 脸（侧脸猫相） */}
      <g className="part-face">
        <ExpSideFace cx={156} cy={152} r={8} expression={expression} base={eyes} withMouth={false} />
        <path d="M160 166 q4 4 8 -1 M164 166 q4 3 8 -2" fill="none" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
        <path d="M174 154 h9 M173 160 h8" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" opacity={0.55} />
        <ellipse cx={144} cy={166} rx={6.5} ry={4.5} fill="#F5A8C6" opacity={0.7} />
      </g>
      {/* 头顶：呆线圈（前倾） */}
      <g transform={place(138, 116, 8)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-3 2 Q-8 -6 -2 -10 Q3 -12 5 -7 Q7 -2 2 0 Q-1 1 -1 -3" fill="none" stroke={LEAF} strokeWidth={3.4} strokeLinecap="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：完全卷死成一颗球，尾巴横着缠一圈当封口线打了个结，耳朵和闭眼从线缝露出。 */
function Lie({ palette, slots = {}, eyes = "sleepy", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 织针（收工插在球后） */}
      <g stroke={OUTLINE} strokeLinecap="round">
        <path d="M92 132 L150 184" stroke={NEEDLE} strokeWidth={5.5} />
        <path d="M148 128 L96 188" stroke={NEEDLE} strokeWidth={5.5} />
        <circle cx={92} cy={130} r={4.5} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.4} />
        <circle cx={148} cy={126} r={4.5} fill="#5C7FB5" stroke={OUTLINE} strokeWidth={2.4} />
      </g>
      {/* 卷死的线球（微塌） */}
      <ellipse cx={128} cy={190} rx={54} ry={44} fill={YARN} stroke={OUTLINE} strokeWidth={6} />
      <g fill="none" strokeLinecap="round">
        <path d="M80 172 Q128 150 176 172" stroke={YARN_DEEP} strokeWidth={4} />
        <path d="M78 210 Q128 194 178 210" stroke={YARN_DEEP} strokeWidth={4} />
        <path d="M98 152 Q90 190 102 226" stroke={LEAF} strokeWidth={3.2} opacity={0.8} />
        <path d="M160 154 Q170 190 156 226" stroke={LEAF} strokeWidth={3.2} opacity={0.8} />
      </g>
      {/* 猫耳（球顶微露） */}
      <g fill={YARN} stroke={OUTLINE} strokeWidth={4}>
        <path d="M102 152 Q100 134 110 130 Q118 138 116 150 Z" />
        <path d="M154 150 Q156 132 146 128 Q138 136 140 148 Z" />
      </g>
      {/* 尾巴当封口线（横缠一圈 + 线结） */}
      <g transform={place(128, 194)}>
        <Part name="tail" origin="50% 50%">
          <path d="M-52 2 Q0 16 52 2" fill="none" stroke={YARN_DEEP} strokeWidth={7.5} strokeLinecap="round" />
          <g transform="translate(46 4)">
            <path d="M0 0 q6 -6 12 -2 q-2 6 -8 6 z" fill="none" stroke={YARN_DEEP} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 4 q5 3 8 8 M10 1 q6 1 10 -1" fill="none" stroke={LEAF} strokeWidth={2.4} strokeLinecap="round" />
          </g>
        </Part>
      </g>
      {/* 前爪尖（球底收拢） */}
      <g transform={place(112, 230)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={0} rx={7} ry={4.5} fill={CREAM} stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      <g transform={place(146, 230)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={0} rx={7} ry={4.5} fill={CREAM} stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      {/* 线圈腿位（贴地） */}
      <g transform={place(90, 231)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-7 0 q7 -5 14 0" fill="none" stroke={YARN_DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(166, 229)}>
        <Part name="legR" origin="50% -40%">
          <path d="M-7 0 q7 -5 14 0" fill="none" stroke={LEAF} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 脸（线缝里的闭眼 + w 嘴） */}
      <g className="part-face">
        <ExpFace cx1={114} cx2={142} cy={176} r={7.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path d="M124 188 q4 4 8 0 M120 187 q4 5 8 1" fill="none" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
        <Blush cx1={104} cx2={152} cy={186} />
      </g>
      {/* 头顶：呆线圈（塌在球顶） */}
      <g transform={place(128, 148, 14)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-3 2 Q-7 -5 -2 -9 Q3 -10 4 -6 Q6 -2 2 0 Q-1 1 -1 -3" fill="none" stroke={LEAF} strokeWidth={3.2} strokeLinecap="round" />
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

const loopBit: ParticleRenderer = () => (
  <path d="M-5 3 Q-7 -4 -1 -5 Q5 -6 5 0 Q5 4 1 4 Q-2 4 -2 1" fill="none" stroke={YARN_DEEP} strokeWidth={2.6} strokeLinecap="round" />
);
const snowBit: ParticleRenderer = () => (
  <g stroke="#B0E5F0" strokeWidth={2.2} strokeLinecap="round">
    <path d="M0 -6 V6 M-5 -3 L5 3 M-5 3 L5 -3" />
    <circle cx={0} cy={0} r={1.5} fill="#F7FCFD" stroke="none" />
  </g>
);
const leafTip: ParticleRenderer = () => (
  <path d="M0 -8 q7 2.5 1.5 12 q-8 -1.5 -1.5 -12 z" fill={LEAF} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.2,
    palette: { body: YARN, deep: YARN_DEEP, belly: CREAM, accent: LEAF, accent2: "#B0E5F0" },
    eyes: "sleepy",
    foodAnchor: { x: 128, y: 172 },
    shadowRx: 56,
  },
  // 织毛衣针：一对针 + 织了一半的小围巾
  tool: () => (
    <g>
      <g stroke={NEEDLE} strokeWidth={3.4} strokeLinecap="round">
        <path d="M-10 0 L14 -34" />
        <path d="M6 0 L-12 -30" />
      </g>
      <circle cx={15} cy={-35} r={3} fill="#E2432E" stroke={OUTLINE} strokeWidth={2} />
      <circle cx={-13} cy={-31} r={3} fill="#5C7FB5" stroke={OUTLINE} strokeWidth={2} />
      <path d="M-8 -12 L8 -12 L8 2 Q0 5 -8 2 Z" fill={YARN} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
      <path d="M-8 -8 h16 M-8 -3 h16" stroke={LEAF} strokeWidth={2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 200, y: 200 },
    baseAngle: -Math.PI / 2.4,
    cone: 0.55,
    shapes: [loopBit, snowBit, leafTip],
  },
  meta: {
    nameZh: "毛线猫",
    elements: ["grass", "ice", "normal"],
    family: "团状软体",
    toolAnchor: { x: 194, y: 231 },
    nodeBudget: 205,
    lieNote: "完全卷死，尾巴当封口线",
  },
};
