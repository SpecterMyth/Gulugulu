// ---------------------------------------------------------------------------
// 信使鸽 maildove — e3（electric+normal+water）· 鸟禽
// 剪影：胖墩信鸽，斜挎云朵邮包（露信封），头顶飞行护目镜，扇形尾羽。
// 睡姿（P3）：头埋进邮包里，包带还挎着。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { WingArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BODY = "#F4F6FA";
const GREY = "#8E93A6";
const CAP = "#5C7FB5";
const CREAM = "#E3E7F0";
const VOLT = "#FFD93B";
const CLOUD = "#9BDCFF";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：扇形三根尾羽（左下探出剪影） */}
      <g transform={place(84, 210, -30)}>
        <Part name="tail" origin="90% 90%">
          <g fill={GREY} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
            <path d="M0 0 Q-22 -2 -30 8 Q-20 14 0 8 Z" />
            <path d="M0 0 Q-24 -12 -34 -6 Q-26 4 0 6 Z" fill={BODY} />
            <path d="M0 -2 Q-20 -20 -30 -18 Q-24 -6 0 4 Z" />
          </g>
        </Part>
      </g>
      {/* 身体（胖梨形鸽） */}
      <path
        d="M86 214 Q80 152 108 130 Q128 116 148 130 Q176 152 170 214 Q168 230 128 232 Q88 230 86 214 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 头顶蓝灰盖羽 + 胸口云斑 */}
      <path d="M104 134 Q128 118 152 134 Q148 148 128 148 Q108 148 104 134 Z" fill={CAP} opacity={0.9} />
      <ellipse cx={128} cy={196} rx={26} ry={17} fill={CREAM} opacity={0.9} />
      {/* 翅膀（armL/armR：WingArm） */}
      <g transform={place(90, 168, 14)}>
        <Part name="armL" origin="50% 8%">
          <WingArm color={GREY} deep="#5C6172" len={30} mirror />
        </Part>
      </g>
      <g transform={place(166, 168, -14)}>
        <Part name="armR" origin="50% 8%">
          <WingArm color={GREY} deep="#5C6172" len={30} />
        </Part>
      </g>
      {/* e3 背饰：斜挎云朵邮包（带 + 云包 + 信封） */}
      <g>
        <path d="M100 150 L166 196" stroke="#B98A4E" strokeWidth={6} strokeLinecap="round" />
        <path d="M100 150 L166 196" stroke="#D9A514" strokeWidth={2.6} strokeLinecap="round" />
        <g transform={place(162, 206)}>
          <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={4}>
            <circle cx={-12} cy={0} r={11} />
            <circle cx={2} cy={-4} r={13} />
            <circle cx={14} cy={2} r={9} />
          </g>
          <path d="M-20 4 Q0 12 22 4 L20 12 Q0 18 -18 12 Z" fill={CLOUD} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
          <g transform="translate(-2 -12) rotate(-8)">
            <rect x={-9} y={-7} width={18} height={13} rx={2} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={2.6} />
            <path d="M-9 -7 L0 0 L9 -7" fill="none" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
          </g>
        </g>
      </g>
      {/* 鸟脚（橙色小趾） */}
      <g transform={place(112, 231)}>
        <Part name="legL" origin="50% -30%">
          <path d="M0 -8 v6" stroke="#F5A83B" strokeWidth={5} strokeLinecap="round" />
          <path d="M-7 0 L0 -3 L7 0 M0 -3 V1" stroke="#F5A83B" strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <path d="M0 -8 v6" stroke="#F5A83B" strokeWidth={5} strokeLinecap="round" />
          <path d="M-7 0 L0 -3 L7 0 M0 -3 V1" stroke="#F5A83B" strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      {/* 脸：圆眼 + 小尖喙（withMouth=false 自绘喙） */}
      <g className="part-face">
        <ExpFace cx1={112} cx2={144} cy={150} r={9} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path
          d={expression === "happy" || expression === "star" || expression === "surprised"
            ? "M120 162 L136 162 L128 172 Z"
            : "M121 162 L135 162 L128 169 Z"}
          fill="#F5A83B"
          stroke={OUTLINE}
          strokeWidth={3.4}
          strokeLinejoin="round"
        />
        <Blush cx1={103} cx2={153} cy={162} />
      </g>
      {/* 头顶：飞行护目镜（带 + 双镜片 + 小闪电徽） */}
      <g transform={place(128, 126)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-26 2 Q0 -8 26 2" fill="none" stroke="#8A6410" strokeWidth={6} strokeLinecap="round" />
          <g fill="#B0E5F0" stroke={OUTLINE} strokeWidth={3.4}>
            <circle cx={-11} cy={-4} r={8} />
            <circle cx={11} cy={-4} r={8} />
          </g>
          <path d="M-14 -7 l4 -2 M8 -7 l4 -2" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
          <path d="M0 -14 l-2.6 4.4 h2.2 l-2.6 4.4" fill="none" stroke={VOLT} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(190, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：胖鸽侧影，翅收近侧，邮包挎在体侧，喙朝右。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：扇形尾羽（左后） */}
      <g transform={place(78, 196, -18)}>
        <Part name="tail" origin="90% 60%">
          <g fill={GREY} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
            <path d="M0 0 Q-24 -4 -32 6 Q-20 14 0 8 Z" />
            <path d="M0 -4 Q-26 -14 -34 -6 Q-24 4 0 2 Z" fill={BODY} />
          </g>
        </Part>
      </g>
      {/* 身体（胖梨形侧影，喙端朝右） */}
      <path
        d="M84 200 Q80 150 116 132 Q146 118 168 142 Q184 160 178 196 Q172 224 128 228 Q92 224 84 200 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 头顶蓝灰盖羽（侧） + 胸前云斑 */}
      <path d="M112 136 Q142 122 164 142 Q152 150 132 148 Q118 146 112 136 Z" fill={CAP} opacity={0.9} />
      <ellipse cx={116} cy={196} rx={22} ry={15} fill={CREAM} opacity={0.9} />
      {/* 邮包挎在体侧（带绕肩） */}
      <path d="M128 140 L104 208" stroke="#B98A4E" strokeWidth={6} strokeLinecap="round" />
      <path d="M128 140 L104 208" stroke="#D9A514" strokeWidth={2.6} strokeLinecap="round" />
      <g transform={place(100, 214)}>
        <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.6}>
          <circle cx={-10} cy={0} r={9} />
          <circle cx={2} cy={-3} r={11} />
          <circle cx={12} cy={2} r={8} />
        </g>
        <path d="M-17 4 Q0 11 19 4 L17 11 Q0 16 -15 11 Z" fill={CLOUD} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      </g>
      {/* 近侧收拢翅 */}
      <g transform={place(140, 168, -8)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 Q26 4 30 26 Q16 36 0 30 Q-8 14 0 0 Z" fill={GREY} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M8 8 Q20 12 24 24" fill="none" stroke="#5C6172" strokeWidth={2.6} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(112, 176, 8)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 Q-8 10 -4 20 Q4 22 8 14 Q8 6 0 0 Z" fill={GREY} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 鸟脚（迈步主角） */}
      <g transform={place(118, 231)}>
        <Part name="legL" origin="50% -30%">
          <path d="M0 -8 v6" stroke="#F5A83B" strokeWidth={5} strokeLinecap="round" />
          <path d="M-6 0 L0 -3 L6 0 M0 -3 V1" stroke="#F5A83B" strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      <g transform={place(148, 230)}>
        <Part name="legR" origin="50% -30%">
          <path d="M0 -8 v6" stroke="#F5A83B" strokeWidth={5} strokeLinecap="round" />
          <path d="M-6 0 L0 -3 L6 0 M0 -3 V1" stroke="#F5A83B" strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      {/* 脸（单眼 + 侧喙） */}
      <g className="part-face">
        <ExpSideFace cx={150} cy={152} r={9} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path d="M168 158 L184 162 L168 168 Z" fill="#F5A83B" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        <ellipse cx={140} cy={170} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：护目镜（侧视单镜片） */}
      <g transform={place(140, 128)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-20 4 Q2 -6 22 2" fill="none" stroke="#8A6410" strokeWidth={5.5} strokeLinecap="round" />
          <circle cx={8} cy={-3} r={8} fill="#B0E5F0" stroke={OUTLINE} strokeWidth={3.2} />
          <path d="M4 -6 l4 -2" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：头埋进云朵邮包里，包带还挎着，尾羽摊地。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：尾羽摊地（右后，贴住身尾） */}
      <g transform={place(170, 218, 10)}>
        <Part name="tail" origin="0% 50%">
          <g fill={GREY} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round">
            <path d="M0 0 Q18 -4 26 4 Q16 10 0 7 Z" />
            <path d="M0 -3 Q20 -12 28 -5 Q18 2 0 3 Z" fill={BODY} />
          </g>
        </Part>
      </g>
      {/* 趴地胖身（头端向左倾进邮包） */}
      <path
        d="M76 214 Q80 184 116 180 Q158 176 176 198 Q184 214 168 224 Q128 234 92 228 Q76 224 76 214 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d="M120 186 Q146 180 164 194" fill="none" stroke={CAP} strokeWidth={6} strokeLinecap="round" opacity={0.75} />
      {/* 云朵邮包（头埋进去：包盖住头前部） */}
      <g transform={place(66, 206)}>
        <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={4}>
          <circle cx={-8} cy={4} r={13} />
          <circle cx={8} cy={-4} r={15} />
          <circle cx={20} cy={6} r={11} />
        </g>
        <path d="M-18 12 Q4 20 28 12 L26 20 Q2 26 -16 20 Z" fill={CLOUD} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <g transform="translate(4 -12) rotate(-8)">
          <rect x={-8} y={-6} width={16} height={12} rx={2} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={2.4} />
          <path d="M-8 -6 L0 0 L8 -6" fill="none" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
        </g>
      </g>
      {/* 包带还挎着（绕过背） */}
      <path d="M84 190 Q124 176 162 194" fill="none" stroke="#B98A4E" strokeWidth={5.5} strokeLinecap="round" />
      <path d="M84 190 Q124 176 162 194" fill="none" stroke="#D9A514" strokeWidth={2.2} strokeLinecap="round" />
      {/* 翅摊开贴地 */}
      <g transform={place(140, 210, 14)}>
        <Part name="armR" origin="20% 20%">
          <path d="M0 0 Q22 2 28 14 Q14 20 0 14 Q-4 6 0 0 Z" fill={GREY} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(104, 216, -8)}>
        <Part name="armL" origin="80% 20%">
          <path d="M0 0 Q-16 2 -20 12 Q-8 16 2 11 Q4 4 0 0 Z" fill={GREY} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 微露的后脑勺盖羽 + 睡容（脸大半埋包里，露一只闭眼） */}
      <g className="part-face">
        <ExpFace cx1={102} cx2={102} cy={198} r={6} mouthY={0} expression={expression} base={eyes} withMouth={false} />
      </g>
      {/* 头顶：护目镜滑到脑后 */}
      <g transform={place(112, 184)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-14 2 Q2 -6 16 0" fill="none" stroke="#8A6410" strokeWidth={4.5} strokeLinecap="round" />
          <circle cx={2} cy={-3} r={6.5} fill="#B0E5F0" stroke={OUTLINE} strokeWidth={2.8} />
        </Part>
      </g>
      {/* 鸟脚收在身下（微露脚尖） */}
      <g transform={place(120, 230)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-5 0 L0 -2 L5 0" stroke="#F5A83B" strokeWidth={3.6} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      <g transform={place(146, 230)}>
        <Part name="legR" origin="50% -40%">
          <path d="M-5 0 L0 -2 L5 0" stroke="#F5A83B" strokeWidth={3.6} strokeLinecap="round" fill="none" />
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

const envelopeBit: ParticleRenderer = () => (
  <g>
    <rect x={-8} y={-6} width={16} height={12} rx={1.6} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={2.2} />
    <path d="M-8 -6 L0 1 L8 -6" fill="none" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
  </g>
);
// 快递投递产物：信封 + 纸箱包裹 + 签收标（"放在安全的地方"＝淋雨）
const parcelBox: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <rect x={-8} y={-8} width={16} height={16} rx={2} fill="#C9A86A" strokeWidth={2.2} />
    <path d="M0 -8 V8" fill="none" strokeWidth={2} stroke="#B98A4E" />
    <path d="M-8 -1 H8" fill="none" strokeWidth={2} stroke="#E3E7F0" />
    <rect x={-5} y={-6} width={6} height={4} rx={1} fill="#FFFFFF" strokeWidth={1.4} />
  </g>
);
const deliveredTag: ParticleRenderer = (rand) => {
  const g = rand() < 0.7 ? "✓" : "?";
  return (
    <g>
      <rect x={-9} y={-9} width={18} height={18} rx={5} fill="#57B84C" stroke={OUTLINE} strokeWidth={2.4} />
      <text x={0} y={5} fontSize={13} fontWeight={900} textAnchor="middle" fill="#FFFFFF" fontFamily="inherit">{g}</text>
    </g>
  );
};

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.22,
    palette: { body: BODY, deep: GREY, belly: CREAM, accent: VOLT, accent2: CLOUD },
    foodAnchor: { x: 128, y: 168 },
    shadowRx: 56,
  },
  // 无人机遥控器：面板 + 双摇杆 + 天线发信号
  tool: () => (
    <g>
      <rect x={-18} y={-24} width={36} height={20} rx={5} fill="#5C6172" stroke={OUTLINE} strokeWidth={3.6} />
      <circle cx={-9} cy={-14} r={4} fill="#C8CCD8" stroke={OUTLINE} strokeWidth={2.2} />
      <path d="M-9 -14 v-5" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={9} cy={-14} r={4} fill="#C8CCD8" stroke={OUTLINE} strokeWidth={2.2} />
      <path d="M9 -14 l4 -3" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M14 -24 L18 -38" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
      <circle cx={18} cy={-39} r={2.2} fill={VOLT} stroke={OUTLINE} strokeWidth={1.6} />
      <path d="M22 -44 q4 4 2 9 M27 -47 q5 6 3 13" fill="none" stroke={CLOUD} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 206, y: 194 },
    baseAngle: -Math.PI / 2.4,
    cone: 0.6,
    shapes: [envelopeBit, parcelBox, deliveredTag],
  },
  meta: {
    nameZh: "信使鸽",
    elements: ["electric", "normal", "water"],
    family: "鸟禽",
    toolAnchor: { x: 190, y: 231 },
    nodeBudget: 170,
    lieNote: "头埋进邮包里，包带还挎着",
  },
};
