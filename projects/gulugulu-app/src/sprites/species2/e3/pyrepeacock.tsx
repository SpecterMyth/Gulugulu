// ---------------------------------------------------------------------------
// 烟花雀 pyrepeacock — e3（electric+fire+grass）· 鸟禽
// 剪影：小孔雀，开屏=一面烟花（羽眼=火花星、羽枝带电光、羽底叶纹，招牌），
//       身前小巧，头顶三点冠。爱炫但业务过硬。
// 睡姿（P3）：尾屏收拢裹住自己像睡袋。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { WingArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BODY = "#3F9BA8";
const DEEP = "#2E7488";
const CREAM = "#FFE8D6";
const FLAME = "#FFB03A";
const VOLT = "#FFD93B";
const LEAF = "#8CD97B";

/** 一根烟花尾羽（pivot=羽根向上，尖端烟花星） */
function FireworkFeather({ len = 52, tint = FLAME }: { len?: number; tint?: string }) {
  return (
    <g>
      <path d={`M0 0 Q-3 ${-len * 0.5} 0 ${-len}`} fill="none" stroke={LEAF} strokeWidth={5} strokeLinecap="round" />
      <path d={`M0 ${-len} l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 z`} fill={tint} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" transform={`translate(0 ${-4})`} />
      <path d={`M-1 ${-len * 0.55} l-3 -5 M1 ${-len * 0.55} l3 -5`} stroke={VOLT} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 烟花尾屏（招牌：一面扇形烟花，先画在身后；羽根抬高让烟花全露出剪影） */}
      <g transform={place(128, 172)}>
        <g transform="rotate(-78)"><FireworkFeather len={66} tint={FLAME} /></g>
        <g transform="rotate(-52)"><FireworkFeather len={80} tint={VOLT} /></g>
        <g transform="rotate(-26)"><FireworkFeather len={90} tint="#E2432E" /></g>
        <g transform="rotate(0)"><FireworkFeather len={94} tint={FLAME} /></g>
        <g transform="rotate(26)"><FireworkFeather len={90} tint={VOLT} /></g>
        <g transform="rotate(52)"><FireworkFeather len={80} tint={FLAME} /></g>
        <g transform="rotate(78)"><FireworkFeather len={66} tint="#E2432E" /></g>
      </g>
      {/* 尾 Part（收拢的尾根羽，左下露出一点） */}
      <g transform={place(94, 214, -20)}>
        <Part name="tail" origin="90% 50%">
          <path d="M0 0 Q-14 0 -20 8 Q-10 12 -2 6 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 身体（小巧梨形，衬托大尾屏） */}
      <path
        d="M98 214 Q94 168 112 150 Q128 138 144 150 Q162 168 158 214 Q128 226 98 214 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <ellipse cx={128} cy={196} rx={22} ry={16} fill={CREAM} opacity={0.95} />
      {/* 翅膀 */}
      <g transform={place(98, 172, 14)}>
        <Part name="armL" origin="50% 8%">
          <WingArm color={DEEP} deep={OUTLINE} len={24} mirror />
        </Part>
      </g>
      <g transform={place(158, 172, -14)}>
        <Part name="armR" origin="50% 8%">
          <WingArm color={DEEP} deep={OUTLINE} len={24} />
        </Part>
      </g>
      {/* 鸟脚 */}
      <g transform={place(112, 231)}>
        <Part name="legL" origin="50% -30%">
          <path d="M0 -9 v7" stroke={FLAME} strokeWidth={5} strokeLinecap="round" />
          <path d="M-6 0 L0 -3 L6 0 M0 -3 V1" stroke={FLAME} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      <g transform={place(144, 231)}>
        <Part name="legR" origin="50% -30%">
          <path d="M0 -9 v7" stroke={FLAME} strokeWidth={5} strokeLinecap="round" />
          <path d="M-6 0 L0 -3 L6 0 M0 -3 V1" stroke={FLAME} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      {/* 头（大头比例） */}
      <circle cx={128} cy={124} r={37} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={113} cx2={143} cy={118} r={9.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path
          d={expression === "happy" || expression === "star" || expression === "surprised"
            ? "M120 136 L136 136 L128 146 Z"
            : "M121 136 L135 136 L128 143 Z"}
          fill={FLAME}
          stroke={OUTLINE}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <Blush cx1={106} cx2={150} cy={134} />
      </g>
      {/* 头顶：三点孔雀冠（headtop 呼吸摇） */}
      <g transform={place(128, 88)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round">
            <path d="M-8 2 Q-10 -6 -12 -10 M0 0 Q0 -8 0 -13 M8 2 Q10 -6 12 -10" />
          </g>
          <circle cx={-12} cy={-12} r={3.4} fill={VOLT} stroke={OUTLINE} strokeWidth={2} />
          <circle cx={0} cy={-15} r={3.8} fill={FLAME} stroke={OUTLINE} strokeWidth={2} />
          <circle cx={12} cy={-12} r={3.4} fill={VOLT} stroke={OUTLINE} strokeWidth={2} />
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

/** 侧视（右向）：昂首阔步，烟花尾羽向后上扬成拖屏，喙朝前。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 烟花尾羽（向后上扬拖屏） */}
      <g transform={place(104, 182)}>
        <g transform="rotate(-28)"><FireworkFeather len={88} tint={FLAME} /></g>
        <g transform="rotate(-52)"><FireworkFeather len={80} tint={VOLT} /></g>
        <g transform="rotate(-76)"><FireworkFeather len={72} tint="#E2432E" /></g>
        <g transform="rotate(-100)"><FireworkFeather len={62} tint={FLAME} /></g>
      </g>
      {/* 尾根羽（身后） */}
      <g transform={place(94, 210, -16)}>
        <Part name="tail" origin="90% 50%">
          <path d="M0 0 Q-14 0 -20 8 Q-10 12 -2 6 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 远侧翅 */}
      <g transform={place(112, 174, 14)}>
        <Part name="armL" origin="50% 8%">
          <WingArm color="#265E70" deep={OUTLINE} len={22} mirror />
        </Part>
      </g>
      {/* 身体（小巧梨形前倾） */}
      <path
        d="M102 214 Q98 168 116 152 Q130 140 146 154 Q162 170 158 214 Q130 226 102 214 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <ellipse cx={138} cy={196} rx={17} ry={14} fill={CREAM} opacity={0.95} />
      {/* 鸟脚（阔步） */}
      <g transform={place(116, 231)}>
        <Part name="legL" origin="50% -30%">
          <path d="M0 -9 v7" stroke={FLAME} strokeWidth={5} strokeLinecap="round" />
          <path d="M-6 0 L0 -3 L6 0 M0 -3 V1" stroke={FLAME} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <path d="M0 -9 v7" stroke={FLAME} strokeWidth={5} strokeLinecap="round" />
          <path d="M-6 0 L0 -3 L6 0 M0 -3 V1" stroke={FLAME} strokeWidth={4} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      {/* 近侧翅（摆动） */}
      <g transform={place(142, 176, -16)}>
        <Part name="armR" origin="50% 8%">
          <WingArm color={DEEP} deep={OUTLINE} len={24} />
        </Part>
      </g>
      {/* 头（昂首朝前） */}
      <circle cx={152} cy={124} r={34} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 脸（侧脸 + 尖喙） */}
      <g className="part-face">
        <ExpSideFace cx={160} cy={118} r={9.5} expression={expression} base={eyes} withMouth={false} />
        <path
          d={expression === "happy" || expression === "star" || expression === "surprised"
            ? "M180 126 L196 133 L180 141 Z"
            : "M181 128 L194 134 L181 139 Z"}
          fill={FLAME}
          stroke={OUTLINE}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <ellipse cx={148} cy={136} rx={6.5} ry={4.5} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 头顶：三点冠（迎风后仰） */}
      <g transform={place(150, 90, -8)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round">
            <path d="M-8 2 Q-11 -6 -14 -9 M0 0 Q-1 -8 -2 -13 M8 2 Q9 -6 10 -11 " />
          </g>
          <circle cx={-15} cy={-11} r={3.4} fill={VOLT} stroke={OUTLINE} strokeWidth={2} />
          <circle cx={-2} cy={-15} r={3.8} fill={FLAME} stroke={OUTLINE} strokeWidth={2} />
          <circle cx={11} cy={-13} r={3.4} fill={VOLT} stroke={OUTLINE} strokeWidth={2} />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：尾屏收拢成睡袋斜裹全身，只露头和脚尖，羽尖烟花星聚在袋口。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 收拢尾屏=睡袋（斜裹，tail 缓摇） */}
      <g transform={place(106, 184)}>
        <Part name="tail" origin="0% 30%">
          <path
            d="M0 -6 Q-4 -26 18 -30 Q40 -32 58 -18 Q82 0 86 28 Q84 42 66 44 Q30 46 8 36 Q-4 22 0 -6 Z"
            fill={DEEP}
            stroke={OUTLINE}
            strokeWidth={5.5}
            strokeLinejoin="round"
          />
          <g fill="none" stroke={LEAF} strokeWidth={3.4} strokeLinecap="round" opacity={0.9}>
            <path d="M8 -12 Q40 -8 66 14" />
            <path d="M4 6 Q36 12 60 30" />
          </g>
          <g>
            <path d="M84 14 l1.8 3.6 l3.6 1.8 l-3.6 1.8 l-1.8 3.6 l-1.8 -3.6 l-3.6 -1.8 l3.6 -1.8 z" fill={FLAME} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
            <path d="M78 32 l1.6 3.2 l3.2 1.6 l-3.2 1.6 l-1.6 3.2 l-1.6 -3.2 l-3.2 -1.6 l3.2 -1.6 z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
            <path d="M62 42 l1.6 3.2 l3.2 1.6 l-3.2 1.6 l-1.6 3.2 l-1.6 -3.2 l-3.2 -1.6 l3.2 -1.6 z" fill="#E2432E" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
          </g>
        </Part>
      </g>
      {/* 袋里的翅膀一角 */}
      <g transform={place(118, 194, 34)}>
        <Part name="armL" origin="50% 8%">
          <WingArm color="#265E70" deep={OUTLINE} len={18} mirror />
        </Part>
      </g>
      <g transform={place(136, 202, -22)}>
        <Part name="armR" origin="50% 8%">
          <WingArm color={DEEP} deep={OUTLINE} len={20} />
        </Part>
      </g>
      {/* 脚尖从袋底露出 */}
      <g transform={place(130, 231)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-5 0 L0 -2 L5 0" stroke={FLAME} strokeWidth={3.6} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      <g transform={place(150, 232)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-5 0 L0 -2 L5 0" stroke={FLAME} strokeWidth={3.6} strokeLinecap="round" fill="none" />
        </Part>
      </g>
      {/* 头（从袋口探出，靠地而眠） */}
      <circle cx={94} cy={176} r={32} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={82} cx2={106} cy={170} r={8.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path d="M88 186 L100 186 L94 193 Z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        <Blush cx1={74} cx2={114} cy={182} />
      </g>
      {/* 头顶：三点冠（垂头） */}
      <g transform={place(92, 142, -12)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round">
            <path d="M-8 2 Q-11 -5 -13 -8 M0 0 Q-1 -7 -1 -11 M8 2 Q9 -5 11 -8" />
          </g>
          <circle cx={-14} cy={-10} r={3.2} fill={VOLT} stroke={OUTLINE} strokeWidth={2} />
          <circle cx={-1} cy={-13} r={3.6} fill={FLAME} stroke={OUTLINE} strokeWidth={2} />
          <circle cx={12} cy={-10} r={3.2} fill={VOLT} stroke={OUTLINE} strokeWidth={2} />
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

// 烟花点火产物：升空的瓶装小烟花 + 仙女棒 + 五彩纸屑
const launchRocket: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round">
    <path d="M0 -12 L4.5 -4 L-4.5 -4 Z" fill={FLAME} />
    <rect x={-4.5} y={-4} width={9} height={11} rx={1.6} fill="#E2432E" />
    <path d="M-4.5 3 L-9 8 L-4.5 6.5 Z" fill={DEEP} />
    <path d="M4.5 3 L9 8 L4.5 6.5 Z" fill={DEEP} />
    <path d="M0 7 q-3 3 -2 6" fill="none" strokeWidth={1.8} strokeLinecap="round" />
  </g>
);
const sparkler: ParticleRenderer = (rand) => {
  const tip = [VOLT, FLAME, "#FF5CA8"][Math.floor(rand() * 3)];
  return (
    <g>
      <line x1={-7} y1={9} x2={1} y2={-2} stroke="#B98A4E" strokeWidth={2.4} strokeLinecap="round" />
      <g stroke={tip} strokeWidth={2} strokeLinecap="round">
        <path d="M2 -2 L2 -10 M2 -2 L-4 -6 M2 -2 L8 -6 M2 -2 L-3 3 M2 -2 L7 3" />
      </g>
      <circle cx={2} cy={-2} r={2} fill={tip} stroke={OUTLINE} strokeWidth={1.4} />
    </g>
  );
};
const confetti: ParticleRenderer = (rand) => {
  const cols = [FLAME, VOLT, LEAF, "#5C7FB5", "#FF5CA8"];
  const c = cols[Math.floor(rand() * cols.length)];
  const rot = Math.floor(rand() * 90);
  return <rect x={-4} y={-4} width={8} height={8} rx={1.5} fill={c} stroke={OUTLINE} strokeWidth={2} transform={`rotate(${rot})`} />;
};

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.05,
    palette: { body: BODY, deep: DEEP, belly: CREAM, accent: FLAME, accent2: VOLT },
    foodAnchor: { x: 128, y: 140 },
    shadowRx: 52,
  },
  // 烟花点火器：点火盒 + 按钮 + 引线连一支小烟花筒
  tool: () => (
    <g>
      <rect x={-10} y={-18} width={20} height={18} rx={4} fill="#E2432E" stroke={OUTLINE} strokeWidth={3.2} />
      <circle cx={0} cy={-11} r={3.4} fill={VOLT} stroke={OUTLINE} strokeWidth={2.2} />
      <path d="M10 -12 Q22 -14 26 -24" fill="none" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="4 3" />
      <g transform="translate(28 -30) rotate(-18)">
        <rect x={-4} y={-10} width={8} height={14} rx={2} fill="#5C7FB5" stroke={OUTLINE} strokeWidth={2.4} />
        <path d="M0 -12 l1.6 3.2 l3.2 1.6 l-3.2 1.6 l-1.6 3.2 l-1.6 -3.2 l-3.2 -1.6 l3.2 -1.6 z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.4} strokeLinejoin="round" transform="translate(0 -6)" />
      </g>
    </g>
  ),
  workFx: {
    emitter: { x: 220, y: 196 },
    baseAngle: -Math.PI / 2.4,
    cone: 0.7,
    shapes: [launchRocket, sparkler, confetti],
  },
  meta: {
    nameZh: "烟花雀",
    elements: ["electric", "fire", "grass"],
    family: "鸟禽",
    toolAnchor: { x: 194, y: 231 },
    nodeBudget: 205,
    lieNote: "尾屏收拢裹住自己像睡袋",
  },
};
