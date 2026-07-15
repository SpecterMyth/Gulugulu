// ---------------------------------------------------------------------------
// 沸腾虾 boilshrimp — e3（electric+fire+water）· 甲壳
// 剪影：C 形卷身小虾，节壳=麻辣锅纹，两根长电须（招牌），尾扇撑地。
// 睡姿（P3）：虾身卷成完整一圈，须须垂地。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const SHELL = "#F5917B";
const DEEP = "#E2432E";
const CREAM = "#FFE8D6";
const VOLT = "#FFD93B";
const SOUP = "#C23B1F";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾扇（撑地，右下探出，招牌之二） */}
      <g transform={place(168, 224, 24)}>
        <Part name="tail" origin="10% 90%">
          <g fill={DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
            <path d="M0 0 Q16 -4 26 6 Q16 12 2 8 Z" />
            <path d="M0 -4 Q18 -14 30 -8 Q20 2 2 2 Z" fill={SHELL} />
          </g>
        </Part>
      </g>
      {/* C 形卷身：大头球 + 向右下卷的节壳 */}
      {/* 节壳（从头后向右下三节，麻辣锅纹） */}
      <g stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round">
        <path d="M150 148 Q178 158 176 188 Q174 212 152 222 Q136 228 124 222 Q146 214 152 196 Q158 172 144 156 Z" fill={SHELL} />
      </g>
      <g fill="none" stroke={DEEP} strokeWidth={4} strokeLinecap="round">
        <path d="M158 160 q10 8 10 22" />
        <path d="M162 186 q-2 14 -14 24" />
      </g>
      {/* 麻辣锅纹：节壳上的辣椒圈点 */}
      <g fill={SOUP} opacity={0.85}>
        <circle cx={166} cy={172} r={3.4} />
        <circle cx={158} cy={202} r={3} />
        <circle cx={146} cy={216} r={2.6} />
      </g>
      {/* 头（大圆球，压住节壳起点） */}
      <circle cx={116} cy={166} r={50} fill={SHELL} stroke={OUTLINE} strokeWidth={6} />
      <path d="M76 186 Q116 206 156 182 Q150 210 116 214 Q84 208 76 186 Z" fill={CREAM} opacity={0.95} />
      {/* 虾腿（细小三对，前排两只做 legL/R） */}
      <g stroke={DEEP} strokeWidth={4.5} strokeLinecap="round">
        <path d="M96 214 q-4 8 -10 10" />
        <path d="M138 216 q4 8 10 10" />
      </g>
      <g transform={place(106, 228)}>
        <Part name="legL" origin="50% -60%">
          <path d="M0 -8 q-3 6 -8 8" fill="none" stroke={DEEP} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(128, 230)}>
        <Part name="legR" origin="50% -60%">
          <path d="M0 -8 q3 6 8 8" fill="none" stroke={DEEP} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 小手 */}
      <g transform={place(80, 178, 26)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={SHELL} rx={6.5} ry={10} stroke={4.5} />
        </Part>
      </g>
      <g transform={place(150, 186, -30)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={SHELL} rx={6.5} ry={10} stroke={4.5} />
        </Part>
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={98} cx2={134} cy={162} r={9.5} mouthY={182} mouthW={14} expression={expression} base={eyes} />
        <Blush cx1={86} cx2={146} cy={175} />
      </g>
      {/* 头顶：两根长电须（弯垂+锯齿电光尖，headtop 呼吸摇） */}
      <g transform={place(112, 120)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={OUTLINE} strokeWidth={3.8} strokeLinecap="round">
            <path d="M-8 2 Q-24 -18 -14 -38" />
            <path d="M8 2 Q26 -16 20 -36" />
          </g>
          <path d="M-14 -38 l-3 -6 l5 1 l-1 -6" fill="none" stroke={VOLT} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 -36 l3 -6 l-5 1 l1 -6" fill="none" stroke={VOLT} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
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

/** 侧视（右向）：C 弓身小虾头前尾后，泳足小步划水，电须向后飘。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾扇（身后撑地） */}
      <g transform={place(76, 214, 6)}>
        <Part name="tail" origin="90% 60%">
          <g fill={DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
            <path d="M0 0 Q-16 -6 -26 4 Q-16 12 -2 8 Z" />
            <path d="M0 -4 Q-18 -14 -30 -8 Q-20 2 -2 2 Z" fill={SHELL} />
          </g>
        </Part>
      </g>
      {/* 节壳弓身（从头后拱向尾根） */}
      <path
        d="M126 140 Q92 132 78 164 Q68 190 80 212 Q90 226 110 228 Q94 210 94 186 Q94 158 126 152 Z"
        fill={SHELL}
        stroke={OUTLINE}
        strokeWidth={5.5}
        strokeLinejoin="round"
      />
      <g fill="none" stroke={DEEP} strokeWidth={4} strokeLinecap="round">
        <path d="M98 152 q-10 10 -10 26" />
        <path d="M86 190 q2 14 12 24" />
      </g>
      <g fill={SOUP} opacity={0.85}>
        <circle cx={88} cy={172} r={3.2} />
        <circle cx={94} cy={206} r={2.8} />
      </g>
      {/* 泳足（小短腿划步） */}
      <g transform={place(114, 230)}>
        <Part name="legL" origin="50% -60%">
          <path d="M0 -8 q-3 6 -8 8" fill="none" stroke={DEEP} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(136, 230)}>
        <Part name="legR" origin="50% -60%">
          <path d="M0 -8 q3 6 8 8" fill="none" stroke={DEEP} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 头（大圆球，前倾朝右） */}
      <circle cx={140} cy={172} r={46} fill={SHELL} stroke={OUTLINE} strokeWidth={6} />
      <path d="M108 194 Q142 212 174 188 Q168 214 138 218 Q112 210 108 194 Z" fill={CREAM} opacity={0.95} />
      {/* 小手（胸前划动） */}
      <g transform={place(122, 210, 18)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={SHELL} rx={6} ry={9.5} stroke={4.5} />
        </Part>
      </g>
      <g transform={place(154, 208, -22)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={SHELL} rx={6.5} ry={10} stroke={4.5} />
        </Part>
      </g>
      {/* 脸（侧脸单眼） */}
      <g className="part-face">
        <ExpSideFace cx={158} cy={166} r={9.5} mouthX={168} mouthY={188} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={146} cy={184} rx={7.5} ry={5} fill="#FDBFAE" opacity={0.9} />
      </g>
      {/* 电须（向后飘，锯齿电光尖） */}
      <g transform={place(146, 128)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={OUTLINE} strokeWidth={3.8} strokeLinecap="round">
            <path d="M2 2 Q-22 -12 -44 -4" />
            <path d="M8 0 Q-12 -22 -36 -20" />
          </g>
          <path d="M-44 -4 l-6 -3 l5 -2 l-4 -4" fill="none" stroke={VOLT} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M-36 -20 l-6 -2 l4 -3 l-5 -3" fill="none" stroke={VOLT} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：虾身卷成完整一圈（尾扇收到下巴前），电须垂地断电。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 卷成一圈的节壳（甜甜圈状，圈眼露出） */}
      <circle cx={132} cy={196} r={42} fill={SHELL} stroke={OUTLINE} strokeWidth={5.5} />
      <circle cx={150} cy={202} r={15} fill={CREAM} stroke={OUTLINE} strokeWidth={4} />
      {/* 节纹（顺圈放射） */}
      <g fill="none" stroke={DEEP} strokeWidth={4} strokeLinecap="round">
        <path d="M164 172 q8 10 8 24" />
        <path d="M170 206 q-4 14 -16 22" />
        <path d="M142 232 q-12 4 -24 0" />
      </g>
      {/* 麻辣锅纹点 */}
      <g fill={SOUP} opacity={0.85}>
        <circle cx={168} cy={192} r={3} />
        <circle cx={152} cy={222} r={2.6} />
      </g>
      {/* 尾扇（卷到下巴前，被小手抱住） */}
      <g transform={place(112, 220, -4)}>
        <Part name="tail" origin="10% 50%">
          <g fill={DEEP} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round">
            <path d="M0 0 Q-14 -6 -24 2 Q-14 10 -2 7 Z" />
            <path d="M0 -3 Q-16 -12 -27 -6 Q-18 4 -2 3 Z" fill={SHELL} />
          </g>
        </Part>
      </g>
      {/* 虾腿（收拢在圈下） */}
      <g transform={place(148, 230)}>
        <Part name="legL" origin="50% -60%">
          <path d="M0 -6 q-3 5 -8 6" fill="none" stroke={DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(164, 226)}>
        <Part name="legR" origin="50% -60%">
          <path d="M0 -6 q3 5 8 6" fill="none" stroke={DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 头（压住圈左上，贴向圈心） */}
      <circle cx={94} cy={174} r={36} fill={SHELL} stroke={OUTLINE} strokeWidth={6} />
      <path d="M64 188 Q94 204 124 186 Q118 206 92 210 Q70 204 64 188 Z" fill={CREAM} opacity={0.95} />
      {/* 小手抱着尾扇 */}
      <g transform={place(82, 204, 24)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={SHELL} rx={6} ry={9} stroke={4} />
        </Part>
      </g>
      <g transform={place(110, 208, -18)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={SHELL} rx={6} ry={9} stroke={4} />
        </Part>
      </g>
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={82} cx2={108} cy={172} r={8.5} mouthY={188} mouthW={11} expression={expression} base={eyes} />
        <Blush cx1={72} cx2={118} cy={184} />
      </g>
      {/* 电须垂地（断电没火花） */}
      <g transform={place(90, 140)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={OUTLINE} strokeWidth={3.6} strokeLinecap="round">
            <path d="M-6 2 Q-34 12 -36 80" />
            <path d="M4 2 Q-22 26 -28 84" />
          </g>
          <path d="M-36 80 l-2 5 M-28 84 l2 5" stroke={VOLT} strokeWidth={2.6} strokeLinecap="round" fill="none" />
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

const oilBubble: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={5.5} fill={SOUP} opacity={0.9} stroke={OUTLINE} strokeWidth={2} />
    <circle cx={-1.6} cy={-1.6} r={1.6} fill="#FFB03A" />
  </g>
);
const boltBit: ParticleRenderer = () => (
  <path d="M1.5 -8 L-4 1 h3.5 L-1.5 8 L4.5 -1 h-3.5 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
);
const steamPuff: ParticleRenderer = () => (
  <g>
    <circle cx={-3} cy={1} r={4.2} fill="#FFFFFF" opacity={0.9} stroke="#9BDCFF" strokeWidth={2} />
    <circle cx={3.5} cy={-2} r={3.2} fill="#FFFFFF" opacity={0.9} stroke="#9BDCFF" strokeWidth={2} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.08,
    palette: { body: SHELL, deep: DEEP, belly: CREAM, accent: VOLT, accent2: "#9BDCFF" },
    foodAnchor: { x: 118, y: 180 },
    shadowRx: 58,
  },
  // 鸳鸯火锅：双格锅（红汤/清汤）+ 沸腾泡 + 蒸汽
  tool: () => (
    <g>
      <path d="M-20 -4 Q-20 -22 0 -22 Q20 -22 20 -4 Q10 2 0 2 Q-10 2 -20 -4 Z" fill="#3E4356" stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      <path d="M0 -22 V0" stroke={OUTLINE} strokeWidth={2.6} />
      <path d="M-16 -14 Q-8 -18 -2 -16 L-2 -8 Q-10 -6 -16 -10 Z" fill={SOUP} />
      <path d="M2 -16 Q10 -18 16 -14 L16 -10 Q9 -6 2 -8 Z" fill="#EAF7FF" />
      <circle cx={-9} cy={-13} r={1.8} fill="#FFB03A" />
      <circle cx={9} cy={-12} r={1.8} fill="#FFFFFF" />
      <path d="M-24 -12 l-4 -2 M24 -12 l4 -2" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" />
      <path d="M-6 -28 q-2 -5 1 -9 M7 -27 q3 -5 0 -9" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 196, y: 204 },
    baseAngle: -Math.PI / 2.2,
    cone: 0.6,
    shapes: [oilBubble, boltBit, steamPuff],
  },
  meta: {
    nameZh: "沸腾虾",
    elements: ["electric", "fire", "water"],
    family: "甲壳",
    toolAnchor: { x: 196, y: 231 },
    nodeBudget: 170,
    lieNote: "虾身卷成完整一圈，须须垂地",
  },
};
