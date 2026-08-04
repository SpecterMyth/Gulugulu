// ---------------------------------------------------------------------------
// 谷雨牛 mistyox — e4（electric+grass+normal+water）· 有蹄神兽
// 剪影：青灰小水牛，弯月大角间挂一串算珠（招牌），背驮一小片
//       自带细雨的稻云（e4 环绕件 aura）。算账最快的老会计。
// 睡姿（P3）：标准牛卧，眼半闭仍在心算。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { TallLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const HIDE = "#9FB0A8";
const DEEP = "#6E8078";
const CREAM = "#F2EFE0";
const VOLT = "#FFD93B";
const RAIN = "#9BDCFF";
const STRAW = "#E2C25C";

function Front({ palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e4 环绕件：背上的稻云细雨（part-aura 呼吸） */}
      <g transform={place(180, 112)}>
        <g className="part-aura">
          <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.4}>
            <circle cx={-14} cy={2} r={10} />
            <circle cx={0} cy={-3} r={12} />
            <circle cx={13} cy={3} r={8.5} />
          </g>
          <g fill={STRAW} stroke={OUTLINE} strokeWidth={1.8}>
            <ellipse cx={-4} cy={-10} rx={2.4} ry={4.5} transform="rotate(-16 -4 -10)" />
            <ellipse cx={3} cy={-12} rx={2.4} ry={4.5} transform="rotate(12 3 -12)" />
          </g>
          <g stroke={RAIN} strokeWidth={2.4} strokeLinecap="round">
            <path d="M-12 14 l-2 6 M0 15 l-2 6 M12 14 l-2 6" />
          </g>
        </g>
      </g>
      {/* 尾：绳尾穗（左下探出） */}
      <g transform={place(78, 196)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 Q-12 6 -14 18" fill="none" stroke={DEEP} strokeWidth={4.5} strokeLinecap="round" />
          <path d="M-16 18 q2 8 -1 12 q-4 -2 -4 -8 q0 -3 5 -4 z" fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 有蹄短腿 */}
      <g transform={place(104, 231)}>
        <Part name="legL" origin="50% -20%">
          <TallLeg color={HIDE} hoof={DEEP} len={22} w={11} hoofH={8} />
        </Part>
      </g>
      <g transform={place(152, 231)}>
        <Part name="legR" origin="50% -20%">
          <TallLeg color={HIDE} hoof={DEEP} len={22} w={11} hoofH={8} />
        </Part>
      </g>
      {/* 身体（敦实牛身，让位给大头） */}
      <ellipse cx={128} cy={188} rx={47} ry={31} fill={HIDE} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={128} cy={200} rx={28} ry={15} fill={CREAM} opacity={0.95} />
      {/* 小手（前蹄手收在胸前） */}
      <g transform={place(96, 198, 20)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={9} fill={HIDE} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(160, 198, -20)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={9} fill={HIDE} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 垂耳（随大头外移） */}
      <g fill={HIDE} stroke={OUTLINE} strokeWidth={4.5}>
        <ellipse cx={82} cy={112} rx={15} ry={9} transform="rotate(-22 82 112)" />
        <ellipse cx={174} cy={112} rx={15} ry={9} transform="rotate(22 174 112)" />
      </g>
      {/* 头（宽吻牛脸——婴儿比例大头） */}
      <ellipse cx={128} cy={124} rx={47} ry={40} fill={HIDE} stroke={OUTLINE} strokeWidth={6} />
      {/* 宽鼻吻 + 鼻孔 + 金鼻环 */}
      <ellipse cx={128} cy={144} rx={25} ry={14} fill={CREAM} stroke={OUTLINE} strokeWidth={4} />
      <g fill={DEEP}>
        <ellipse cx={118} cy={143} rx={3} ry={4} />
        <ellipse cx={138} cy={143} rx={3} ry={4} />
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={108} cx2={148} cy={116} r={10} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={94} cx2={162} cy={132} />
      </g>
      {/* 头顶：弯月大角 + 角间算珠串（招牌，headtop 呼吸摇） */}
      <g transform={place(128, 92)}>
        <Part name="headtop" origin="50% 100%">
          <g fill={CREAM} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
            <path d="M-14 4 Q-34 2 -38 -14 Q-30 -18 -22 -12 Q-16 -7 -12 2 Z" />
            <path d="M14 4 Q34 2 38 -14 Q30 -18 22 -12 Q16 -7 12 2 Z" />
          </g>
          {/* 算珠串（挂在两角间） */}
          <path d="M-30 -12 Q0 -2 30 -12" fill="none" stroke="#8A6410" strokeWidth={2.6} strokeLinecap="round" />
          <g stroke={OUTLINE} strokeWidth={1.8}>
            <circle cx={-18} cy={-8.5} r={3.4} fill="#E2432E" />
            <circle cx={-9} cy={-6.5} r={3.4} fill={VOLT} />
            <circle cx={0} cy={-5.5} r={3.4} fill="#8CD97B" />
            <circle cx={9} cy={-6.5} r={3.4} fill={RAIN} />
            <circle cx={18} cy={-8.5} r={3.4} fill="#B99BE8" />
          </g>
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

/** 侧视（右向）：小水牛踏步，弯月角朝前，稻云跟在背上洒细雨，绳尾在后。 */
function Side({ palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 背上的稻云细雨（随行） */}
      <g transform={place(108, 112)}>
        <g className="part-aura">
          <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.4}>
            <circle cx={-14} cy={2} r={10} />
            <circle cx={0} cy={-3} r={12} />
            <circle cx={13} cy={3} r={8.5} />
          </g>
          <g fill={STRAW} stroke={OUTLINE} strokeWidth={1.8}>
            <ellipse cx={-4} cy={-10} rx={2.4} ry={4.5} transform="rotate(-16 -4 -10)" />
            <ellipse cx={3} cy={-12} rx={2.4} ry={4.5} transform="rotate(12 3 -12)" />
          </g>
          <g stroke={RAIN} strokeWidth={2.4} strokeLinecap="round">
            <path d="M-12 14 l-2 6 M0 15 l-2 6 M12 14 l-2 6" />
          </g>
        </g>
      </g>
      {/* 尾：绳尾穗（身后甩） */}
      <g transform={place(76, 182)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 Q-14 8 -16 22" fill="none" stroke={DEEP} strokeWidth={4.5} strokeLinecap="round" />
          <path d="M-18 22 q2 8 -1 12 q-4 -2 -4 -8 q0 -3 5 -4 z" fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 远侧前后腿 */}
      <g transform={place(98, 230)}>
        <Part name="legL" origin="50% -20%">
          <TallLeg color={DEEP} hoof={DEEP} len={20} w={10} hoofH={8} />
        </Part>
      </g>
      <g transform={place(144, 230)}>
        <Part name="armL" origin="50% -20%">
          <TallLeg color={DEEP} hoof={DEEP} len={20} w={10} hoofH={8} />
        </Part>
      </g>
      {/* 身体（敦实牛身横放） */}
      <ellipse cx={122} cy={184} rx={48} ry={30} fill={HIDE} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={122} cy={198} rx={28} ry={13} fill={CREAM} opacity={0.95} />
      {/* 近侧前后腿（踏步） */}
      <g transform={place(112, 231)}>
        <Part name="legR" origin="50% -20%">
          <TallLeg color={HIDE} hoof={DEEP} len={22} w={11} hoofH={8} />
        </Part>
      </g>
      <g transform={place(158, 231)}>
        <Part name="armR" origin="50% -20%">
          <TallLeg color={HIDE} hoof={DEEP} len={22} w={11} hoofH={8} />
        </Part>
      </g>
      {/* 垂耳（脑后一只） */}
      <ellipse cx={134} cy={110} rx={14} ry={8.5} fill={HIDE} stroke={OUTLINE} strokeWidth={4.5} transform="rotate(-24 134 110)" />
      {/* 头（宽吻牛脸前伸） */}
      <ellipse cx={168} cy={124} rx={42} ry={36} fill={HIDE} stroke={OUTLINE} strokeWidth={6} />
      {/* 宽鼻吻（朝前） + 鼻孔 */}
      <ellipse cx={188} cy={142} rx={19} ry={12} fill={CREAM} stroke={OUTLINE} strokeWidth={4} />
      <ellipse cx={194} cy={140} rx={3} ry={4} fill={DEEP} />
      {/* 脸（侧脸眯眯眼） */}
      <g className="part-face">
        <ExpSideFace cx={172} cy={114} r={10} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={160} cy={134} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：弯月角 + 算珠串（前后错落） */}
      <g transform={place(160, 92)}>
        <Part name="headtop" origin="50% 100%">
          <g fill={CREAM} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
            <path d="M-12 4 Q-32 2 -36 -13 Q-28 -17 -20 -11 Q-14 -6 -10 2 Z" />
            <path d="M14 4 Q32 0 35 -14 Q27 -18 20 -12 Q15 -6 12 2 Z" />
          </g>
          <path d="M-28 -11 Q0 -2 28 -12" fill="none" stroke="#8A6410" strokeWidth={2.6} strokeLinecap="round" />
          <g stroke={OUTLINE} strokeWidth={1.8}>
            <circle cx={-16} cy={-7.5} r={3.2} fill="#E2432E" />
            <circle cx={-7} cy={-5.5} r={3.2} fill={VOLT} />
            <circle cx={2} cy={-5} r={3.2} fill="#8CD97B" />
            <circle cx={11} cy={-6.5} r={3.2} fill={RAIN} />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：标准牛卧四蹄收拢，头微垂眼半闭，稻云降下来贴背当被。 */
function Lie({ palette, slots = {}, eyes = "sleepy", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 稻云（降低贴背，细雨改星点） */}
      <g transform={place(94, 138)}>
        <g className="part-aura">
          <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.2}>
            <circle cx={-13} cy={2} r={9} />
            <circle cx={0} cy={-3} r={11} />
            <circle cx={12} cy={3} r={8} />
          </g>
          <g fill={STRAW} stroke={OUTLINE} strokeWidth={1.8}>
            <ellipse cx={-3} cy={-9} rx={2.2} ry={4} transform="rotate(-16 -3 -9)" />
          </g>
          <g stroke={RAIN} strokeWidth={2.2} strokeLinecap="round" opacity={0.8}>
            <path d="M-10 12 l-1.5 4 M4 13 l-1.5 4" />
          </g>
        </g>
      </g>
      {/* 尾：绳尾穗（盘在身侧） */}
      <g transform={place(70, 214)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 Q-12 4 -14 14" fill="none" stroke={DEEP} strokeWidth={4.2} strokeLinecap="round" />
          <path d="M-16 14 q2 7 -1 11 q-4 -2 -4 -7 q0 -3 5 -4 z" fill={DEEP} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 身体（牛卧椭圆） */}
      <ellipse cx={118} cy={200} rx={52} ry={28} fill={HIDE} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={118} cy={212} rx={30} ry={13} fill={CREAM} opacity={0.95} />
      {/* 收拢的四蹄（折叠蹄包一排） */}
      <g transform={place(84, 226)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={11} ry={5.5} fill={HIDE} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={-9} cy={0} rx={4} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} />
        </Part>
      </g>
      <g transform={place(108, 229)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={11} ry={5.5} fill={HIDE} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={-9} cy={0} rx={4} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} />
        </Part>
      </g>
      <g transform={place(134, 228, -4)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={0} rx={10} ry={5} fill={HIDE} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={8} cy={0} rx={4} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} />
        </Part>
      </g>
      <g transform={place(152, 224, -8)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={0} rx={9} ry={5} fill={HIDE} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={7} cy={0} rx={4} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} />
        </Part>
      </g>
      {/* 垂耳（头侧） */}
      <ellipse cx={128} cy={148} rx={14} ry={8.5} fill={HIDE} stroke={OUTLINE} strokeWidth={4.5} transform="rotate(-30 128 148)" />
      {/* 头（微垂宽吻牛脸） */}
      <ellipse cx={162} cy={166} rx={40} ry={34} fill={HIDE} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={176} cy={186} rx={20} ry={12} fill={CREAM} stroke={OUTLINE} strokeWidth={4} />
      <g fill={DEEP}>
        <ellipse cx={170} cy={185} rx={2.8} ry={3.8} />
        <ellipse cx={184} cy={184} rx={2.8} ry={3.8} />
      </g>
      {/* 脸（半闭眼心算） */}
      <g className="part-face">
        <ExpFace cx1={146} cx2={180} cy={158} r={9} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={136} cx2={192} cy={172} />
      </g>
      {/* 头顶：弯月角 + 算珠串（梦里还在拨） */}
      <g transform={place(158, 138, -6)}>
        <Part name="headtop" origin="50% 100%">
          <g fill={CREAM} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
            <path d="M-12 4 Q-31 2 -35 -12 Q-27 -16 -19 -10 Q-13 -5 -10 2 Z" />
            <path d="M13 4 Q31 0 34 -13 Q26 -17 19 -11 Q14 -6 11 2 Z" />
          </g>
          <path d="M-27 -10 Q0 -1 27 -11" fill="none" stroke="#8A6410" strokeWidth={2.6} strokeLinecap="round" />
          <g stroke={OUTLINE} strokeWidth={1.8}>
            <circle cx={-15} cy={-6.5} r={3.2} fill="#E2432E" />
            <circle cx={-6} cy={-4.5} r={3.2} fill={VOLT} />
            <circle cx={3} cy={-4.5} r={3.2} fill="#8CD97B" />
            <circle cx={12} cy={-6} r={3.2} fill={RAIN} />
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

// 一粒米（沿用稻米元素，收敛为单粒稻谷）
const riceGrain: ParticleRenderer = () => (
  <g transform="rotate(-18)">
    <path d="M0 -7 Q4 -4 4 0 Q4 6 0 7 Q-4 6 -4 0 Q-4 -4 0 -7 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M0 -4 V4" stroke={STRAW} strokeWidth={1.3} strokeLinecap="round" opacity={0.8} />
  </g>
);
// 斗笠：锥顶草帽
const strawHat: ParticleRenderer = () => (
  <g>
    <path d="M0 -8 L11 6 Q0 9 -11 6 Z" fill={STRAW} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M-7 3 Q0 5 7 3 M-4 -1.5 Q0 -0.5 4 -1.5" fill="none" stroke="#B99A3E" strokeWidth={1.3} strokeLinecap="round" />
    <ellipse cx={0} cy={6} rx={11} ry={2.6} fill="none" stroke={OUTLINE} strokeWidth={1.6} opacity={0.5} />
  </g>
);
// 镰刀：弯刃 + 木柄
const sickle: ParticleRenderer = () => (
  <g>
    <path d="M-6 8 L-3 -1" stroke="#8A6410" strokeWidth={3.4} strokeLinecap="round" />
    <path d="M-3 -1 Q2 -9 10 -6 Q4 -8 -1 -2 Q-2 0 -3 -1 Z" fill="#C8CCD8" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.1,
    palette: { body: HIDE, deep: DEEP, belly: CREAM, accent: VOLT, accent2: RAIN },
    eyes: "sleepy",
    foodAnchor: { x: 128, y: 146 },
    shadowRx: 58,
  },
  // 算盘：木框 + 双层珠
  tool: () => (
    <g>
      <rect x={-18} y={-30} width={36} height={26} rx={3.5} fill="#B98A4E" stroke={OUTLINE} strokeWidth={3.4} />
      <path d="M-18 -20 h36" stroke={OUTLINE} strokeWidth={2.4} />
      <g stroke="#8A6410" strokeWidth={1.8}>
        <path d="M-10 -30 v26 M0 -30 v26 M10 -30 v26" />
      </g>
      <g stroke={OUTLINE} strokeWidth={1.6}>
        <circle cx={-10} cy={-25} r={3} fill="#E2432E" />
        <circle cx={0} cy={-23} r={3} fill={VOLT} />
        <circle cx={10} cy={-25} r={3} fill="#E2432E" />
        <circle cx={-10} cy={-12} r={3} fill="#8CD97B" />
        <circle cx={0} cy={-15} r={3} fill={RAIN} />
        <circle cx={10} cy={-10} r={3} fill="#B99BE8" />
      </g>
    </g>
  ),
  workFx: {
    emitter: { x: 194, y: 204 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.55,
    shapes: [riceGrain, strawHat, sickle],
  },
  meta: {
    nameZh: "谷雨牛",
    elements: ["electric", "grass", "normal", "water"],
    family: "有蹄神兽",
    toolAnchor: { x: 194, y: 231 },
    nodeBudget: 255,
    lieNote: "标准牛卧，眼半闭仍在心算",
  },
};
