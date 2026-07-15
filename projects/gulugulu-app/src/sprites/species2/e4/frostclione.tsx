// ---------------------------------------------------------------------------
// 海天使 frostclione — e4（electric+grass+ice+water）· 漂浮体
// 剪影：半透明冰蓝海天使（水滴形身+双拍翅），头顶小触角犄角，
//       胸口叶绿之心发光，极光涟漪环（e4 环绕件 part-aura）。深海诗人。
// 睡姿（P3）：双翅合拢作祈祷状，落地蜷成水滴形。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BODY = "#DDF2F8";
const DEEP = "#A8D8E8";
const AURORA = "#7FE3C8";
const HEART = "#8CD97B";
const VOLT = "#FFD93B";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e4 环绕件：极光涟漪环（part-aura 脉动，双色） */}
      <g transform={place(128, 168)}>
        <g className="part-aura">
          <ellipse cx={0} cy={0} rx={62} ry={44} fill="none" stroke={AURORA} strokeWidth={4} opacity={0.55} />
          <ellipse cx={0} cy={0} rx={72} ry={52} fill="none" stroke="#B99BE8" strokeWidth={2.6} opacity={0.4} />
        </g>
      </g>
      {/* 双拍翅（armL/R：海天使的招牌翼足） */}
      <g transform={place(94, 156, 24)}>
        <Part name="armL" origin="80% 10%">
          <path d="M0 0 Q-30 -6 -40 12 Q-28 28 -8 18 Q-1 14 0 6 Z" fill={DEEP} opacity={0.95} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M-8 6 Q-22 6 -30 14" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
        </Part>
      </g>
      <g transform={place(162, 156, -24)}>
        <Part name="armR" origin="20% 10%">
          <path d="M0 0 Q30 -6 40 12 Q28 28 8 18 Q1 14 0 6 Z" fill={DEEP} opacity={0.95} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M8 6 Q22 6 30 14" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
        </Part>
      </g>
      {/* 尾：水滴尾尖的一缕极光丝（下方） */}
      <g transform={place(128, 222)}>
        <Part name="tail" origin="50% 0%">
          <path d="M0 0 Q-4 8 2 12" fill="none" stroke={AURORA} strokeWidth={3.4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 身体（半透水滴形：上圆下尖） */}
      <path
        d="M92 138 Q92 96 128 96 Q164 96 164 138 Q164 176 146 202 Q136 216 128 222 Q120 216 110 202 Q92 176 92 138 Z"
        fill={BODY}
        opacity={0.96}
        stroke={OUTLINE}
        strokeWidth={5.5}
        strokeLinejoin="round"
      />
      {/* 体内高光 + 尾腔纹 */}
      <path d="M104 116 q4 -10 14 -12" fill="none" stroke="#FFFFFF" strokeWidth={3.4} strokeLinecap="round" opacity={0.85} />
      <path d="M112 186 Q128 196 144 186" fill="none" stroke={DEEP} strokeWidth={2.8} strokeLinecap="round" opacity={0.8} />
      {/* 胸口叶绿之心（发光核，电光小星环绕） */}
      <g transform={place(128, 158)}>
        <path d="M0 9 C-11 1 -10 -8 -4 -9.5 C-1.5 -10 0 -8 0 -6.5 C0 -8 1.5 -10 4 -9.5 C10 -8 11 1 0 9 Z" fill={HEART} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <circle cx={-2} cy={-3} r={2} fill="#FFFFFF" opacity={0.9} />
        <path d="M-14 -8 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round" />
      </g>
      {/* 腿位（漂浮种：裙摆内的两片小鳍） */}
      <g transform={place(116, 212)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-5 0 Q0 -6 5 0 Q0 3 -5 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(140, 212)}>
        <Part name="legR" origin="50% -40%">
          <path d="M-5 0 Q0 -6 5 0 Q0 3 -5 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={114} cx2={142} cy={126} r={9} mouthY={142} mouthW={11} expression={expression} base={eyes} />
        <Blush cx1={104} cx2={152} cy={138} />
      </g>
      {/* 头顶：一对小触角犄角（clione 签名，headtop 呼吸摇） */}
      <g transform={place(128, 98)}>
        <Part name="headtop" origin="50% 100%">
          <g fill={DEEP} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round">
            <path d="M-12 2 Q-16 -8 -10 -14 Q-6 -6 -7 2 Z" />
            <path d="M12 2 Q16 -8 10 -14 Q6 -6 7 2 Z" />
          </g>
          <circle cx={-10} cy={-15} r={2.4} fill={AURORA} stroke={OUTLINE} strokeWidth={1.8} />
          <circle cx={10} cy={-15} r={2.4} fill={AURORA} stroke={OUTLINE} strokeWidth={1.8} />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(192, 226)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：水滴身前倾漂游，双翅一前一后拍水，犄角朝前。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 极光涟漪环（斜挂） */}
      <g transform={place(126, 170)}>
        <g className="part-aura">
          <ellipse cx={0} cy={0} rx={60} ry={42} fill="none" stroke={AURORA} strokeWidth={4} opacity={0.55} transform="rotate(-8)" />
          <ellipse cx={0} cy={0} rx={70} ry={50} fill="none" stroke="#B99BE8" strokeWidth={2.6} opacity={0.4} transform="rotate(-8)" />
        </g>
      </g>
      {/* 远侧翅（后拍） */}
      <g transform={place(106, 152, 34)}>
        <Part name="armL" origin="80% 10%">
          <path d="M0 0 Q-28 -8 -38 8 Q-27 24 -8 16 Q-1 12 0 6 Z" fill="#8FC8DC" opacity={0.95} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 尾：极光丝（尾尖向后） */}
      <g transform={place(116, 220)}>
        <Part name="tail" origin="50% 0%">
          <path d="M0 0 Q-6 8 -1 13" fill="none" stroke={AURORA} strokeWidth={3.4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 身体（前倾水滴：头端偏右） */}
      <path
        d="M96 136 Q100 96 134 98 Q166 102 162 142 Q158 178 142 200 Q132 214 122 218 Q114 210 106 190 Q94 166 96 136 Z"
        fill={BODY}
        opacity={0.96}
        stroke={OUTLINE}
        strokeWidth={5.5}
        strokeLinejoin="round"
      />
      {/* 体内高光 + 尾腔纹 */}
      <path d="M110 116 q4 -10 14 -11" fill="none" stroke="#FFFFFF" strokeWidth={3.4} strokeLinecap="round" opacity={0.85} />
      <path d="M114 184 Q128 192 142 182" fill="none" stroke={DEEP} strokeWidth={2.8} strokeLinecap="round" opacity={0.8} />
      {/* 胸口叶绿之心（体前） */}
      <g transform={place(138, 158)}>
        <path d="M0 9 C-11 1 -10 -8 -4 -9.5 C-1.5 -10 0 -8 0 -6.5 C0 -8 1.5 -10 4 -9.5 C10 -8 11 1 0 9 Z" fill={HEART} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <circle cx={-2} cy={-3} r={2} fill="#FFFFFF" opacity={0.9} />
        <path d="M12 -10 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round" />
      </g>
      {/* 近侧翅（前拍大翼） */}
      <g transform={place(146, 156, -30)}>
        <Part name="armR" origin="20% 10%">
          <path d="M0 0 Q30 -6 40 12 Q28 28 8 18 Q1 14 0 6 Z" fill={DEEP} opacity={0.95} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M8 6 Q22 6 30 14" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" opacity={0.8} />
        </Part>
      </g>
      {/* 裙摆小鳍（漂浮代腿） */}
      <g transform={place(114, 208)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-5 0 Q0 -6 5 0 Q0 3 -5 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(134, 204)}>
        <Part name="legR" origin="50% -40%">
          <path d="M-5 0 Q0 -6 5 0 Q0 3 -5 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={146} cy={124} r={9} mouthX={154} mouthY={140} mouthW={10} expression={expression} base={eyes} />
        <ellipse cx={134} cy={138} rx={6.5} ry={4.5} fill="#F5A8C6" opacity={0.7} />
      </g>
      {/* 头顶：小触角犄角（前倾） */}
      <g transform={place(134, 100, 10)}>
        <Part name="headtop" origin="50% 100%">
          <g fill={DEEP} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round">
            <path d="M-12 2 Q-16 -8 -10 -14 Q-6 -6 -7 2 Z" />
            <path d="M12 2 Q16 -8 10 -14 Q6 -6 7 2 Z" />
          </g>
          <circle cx={-10} cy={-15} r={2.4} fill={AURORA} stroke={OUTLINE} strokeWidth={1.8} />
          <circle cx={10} cy={-15} r={2.4} fill={AURORA} stroke={OUTLINE} strokeWidth={1.8} />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：落地蜷成圆水滴，双翅在胸前合拢作祈祷状，极光环平铺成地上光晕。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 地上极光光晕（平铺） */}
      <g transform={place(128, 228)}>
        <g className="part-aura">
          <ellipse cx={0} cy={0} rx={58} ry={9} fill="none" stroke={AURORA} strokeWidth={4} opacity={0.5} />
          <ellipse cx={0} cy={0} rx={68} ry={12} fill="none" stroke="#B99BE8" strokeWidth={2.4} opacity={0.35} />
        </g>
      </g>
      {/* 尾：极光丝（垂在裙摆后） */}
      <g transform={place(128, 228)}>
        <Part name="tail" origin="50% 0%">
          <path d="M0 0 Q-5 5 1 8" fill="none" stroke={AURORA} strokeWidth={3.2} strokeLinecap="round" />
        </Part>
      </g>
      {/* 身体（蜷圆的水滴，落地坐姿） */}
      <path
        d="M90 170 Q90 128 128 128 Q166 128 166 170 Q166 200 148 218 Q138 228 128 230 Q118 228 108 218 Q90 200 90 170 Z"
        fill={BODY}
        opacity={0.96}
        stroke={OUTLINE}
        strokeWidth={5.5}
        strokeLinejoin="round"
      />
      {/* 体内高光 */}
      <path d="M104 148 q4 -10 14 -12" fill="none" stroke="#FFFFFF" strokeWidth={3.4} strokeLinecap="round" opacity={0.85} />
      {/* 裙摆小鳍（收拢贴地） */}
      <g transform={place(116, 224)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-5 0 Q0 -5 5 0 Q0 3 -5 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(140, 224)}>
        <Part name="legR" origin="50% -40%">
          <path d="M-5 0 Q0 -5 5 0 Q0 3 -5 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 双翅胸前合拢（祈祷状，翼尖相触） */}
      <g transform={place(108, 178, 52)}>
        <Part name="armL" origin="80% 10%">
          <path d="M0 0 Q-26 -6 -36 10 Q-25 25 -7 16 Q-1 12 0 6 Z" fill={DEEP} opacity={0.95} stroke={OUTLINE} strokeWidth={4.2} strokeLinejoin="round" />
          <path d="M-8 6 Q-19 6 -26 12" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" opacity={0.8} />
        </Part>
      </g>
      <g transform={place(148, 178, -52)}>
        <Part name="armR" origin="20% 10%">
          <path d="M0 0 Q26 -6 36 10 Q25 25 7 16 Q1 12 0 6 Z" fill={DEEP} opacity={0.95} stroke={OUTLINE} strokeWidth={4.2} strokeLinejoin="round" />
          <path d="M8 6 Q19 6 26 12" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" opacity={0.8} />
        </Part>
      </g>
      {/* 胸口之心（合翅间发光） */}
      <g transform={place(128, 190)}>
        <circle cx={0} cy={0} r={13} fill={HEART} opacity={0.25} />
        <path d="M0 8 C-10 1 -9 -7 -3.5 -8.5 C-1.3 -9 0 -7 0 -6 C0 -7 1.3 -9 3.5 -8.5 C9 -7 10 1 0 8 Z" fill={HEART} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        <circle cx={-2} cy={-3} r={1.8} fill="#FFFFFF" opacity={0.9} />
      </g>
      {/* 脸（垂目而眠） */}
      <g className="part-face">
        <ExpFace cx1={114} cx2={142} cy={156} r={8.5} mouthY={172} mouthW={10} expression={expression} base={eyes} />
        <Blush cx1={104} cx2={152} cy={168} />
      </g>
      {/* 头顶：犄角（外垂） */}
      <g transform={place(128, 130)}>
        <Part name="headtop" origin="50% 100%">
          <g fill={DEEP} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round">
            <path d="M-12 2 Q-18 -5 -14 -12 Q-8 -6 -8 2 Z" />
            <path d="M12 2 Q18 -5 14 -12 Q8 -6 8 2 Z" />
          </g>
          <circle cx={-14} cy={-13} r={2.4} fill={AURORA} stroke={OUTLINE} strokeWidth={1.8} />
          <circle cx={14} cy={-13} r={2.4} fill={AURORA} stroke={OUTLINE} strokeWidth={1.8} />
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

const auroraRibbon: ParticleRenderer = () => (
  <path d="M-6 4 Q-2 -6 4 -4 Q8 -3 6 2 Q2 8 -4 7 Q-7 6 -6 4 Z" fill={AURORA} opacity={0.9} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
);
// 采样瓶的第二产物：采到的微光浮游生物（配 1 颗气泡）
const planktonBit: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <circle cx={0} cy={0} r={3.4} fill={AURORA} opacity={0.85} strokeWidth={1.8} />
    <path d="M0 -3.4 v-4 M-3 2 l-3 3 M3 2 l3 3" strokeWidth={1.6} strokeLinecap="round" fill="none" />
  </g>
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
    palette: { body: BODY, deep: DEEP, belly: "#FFFFFF", accent: AURORA, accent2: HEART },
    floating: true,
    shadowRx: 44,
    foodAnchor: { x: 128, y: 142 },
  },
  // 深海采样瓶：软木塞玻璃瓶，里面装着一小段极光
  tool: () => (
    <g>
      <path d="M-9 0 Q-12 -4 -12 -12 L-12 -26 L12 -26 L12 -12 Q12 -4 9 0 Q0 3 -9 0 Z" fill="#CFEFF6" opacity={0.9} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <rect x={-7} y={-34} width={14} height={9} rx={2.5} fill="#B98A4E" stroke={OUTLINE} strokeWidth={2.8} />
      <path d="M-8 -14 Q-2 -20 4 -14 Q8 -10 4 -7" fill="none" stroke={AURORA} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M-6 -10 Q0 -14 5 -10" fill="none" stroke="#B99BE8" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={-5} cy={-22} r={1.6} fill="#FFFFFF" />
      <path d="M14 -20 q4 -2 5 -6" fill="none" stroke="#9BDCFF" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 192, y: 200 },
    baseAngle: -Math.PI / 2.2,
    cone: 0.6,
    shapes: [auroraRibbon, planktonBit, bubbleBit],
  },
  meta: {
    nameZh: "海天使",
    elements: ["electric", "grass", "ice", "water"],
    family: "漂浮体",
    toolAnchor: { x: 192, y: 226 },
    nodeBudget: 255,
    lieNote: "双翅合拢作祈祷状，落地蜷成水滴形",
  },
};
