// ---------------------------------------------------------------------------
// 摇摆葵 discobloom — e4（electric+fire+grass+normal）· 植物体
// 剪影：会走的向日葵：花盘=黑胶唱片脸（沟槽环纹），花瓣火橙电黄相间，
//       花盘后光晕（e4 环绕件 part-aura），叶片手 + 根靴。夜场主唱。
// 睡姿（P3）：花盘垂地，花瓣合拢当睡帽。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const STEM = "#57B84C";
const STEM_DEEP = "#3B8F33";
const CREAM = "#FFF4DC";
const PETAL_A = "#FFB03A";
const PETAL_B = "#FFD93B";
const VINYL = "#4A4034";
const MIRROR = "#AEB8CC";

/** 一圈花瓣（交替双色，count 片） */
function PetalRing({ r = 40, count = 12 }: { r?: number; count?: number }) {
  const petals = Array.from({ length: count }, (_, i) => {
    const a = (360 / count) * i;
    return (
      <g key={i} transform={`rotate(${a}) translate(0 ${-r})`}>
        <path
          d="M0 6 Q-8 -4 -5 -14 Q0 -22 5 -14 Q8 -4 0 6 Z"
          fill={i % 2 === 0 ? PETAL_A : PETAL_B}
          stroke={OUTLINE}
          strokeWidth={3.2}
          strokeLinejoin="round"
        />
      </g>
    );
  });
  return <g>{petals}</g>;
}

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e4 环绕件：花盘后光晕（part-aura 脉动） */}
      <g transform={place(128, 124)}>
        <g className="part-aura">
          <circle cx={0} cy={0} r={58} fill="none" stroke={PETAL_B} strokeWidth={5} opacity={0.5} />
          <circle cx={0} cy={0} r={66} fill="none" stroke={PETAL_A} strokeWidth={3} opacity={0.35} />
        </g>
      </g>
      {/* 尾：一片垂叶（茎后左下） */}
      <g transform={place(96, 208, -30)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 q-16 4 -20 16 q14 2 20 -8 q2 -4 0 -8 z" fill={STEM} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 茎身 */}
      <path d="M120 158 L136 158 L138 214 Q128 218 118 214 Z" fill={STEM} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
      {/* 叶片手 */}
      <g transform={place(114, 178, 30)}>
        <Part name="armL" origin="100% 20%">
          <path d="M0 0 Q-18 -2 -26 -14 Q-10 -20 -2 -8 Q1 -3 0 0 Z" fill={STEM} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(142, 178, -30)}>
        <Part name="armR" origin="0% 20%">
          <path d="M0 0 Q18 -2 26 -14 Q10 -20 2 -8 Q-1 -3 0 0 Z" fill={STEM} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 根靴小脚 */}
      <g transform={place(114, 230)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-8 0 Q-8 -12 0 -12 Q6 -12 6 -4 Q6 0 2 0 Z" fill={STEM_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(142, 230)}>
        <Part name="legR" origin="50% -30%">
          <path d="M8 0 Q8 -12 0 -12 Q-6 -12 -6 -4 Q-6 0 -2 0 Z" fill={STEM_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 花盘（花瓣圈 + 黑胶唱片脸） */}
      <g transform={place(128, 124)}>
        <PetalRing r={42} count={12} />
        <circle cx={0} cy={0} r={38} fill={VINYL} stroke={OUTLINE} strokeWidth={5.5} />
        {/* 唱片沟槽环纹 + 高光 */}
        <g fill="none" stroke="#6B5F4E" strokeWidth={2}>
          <circle cx={0} cy={0} r={30} />
          <circle cx={0} cy={0} r={23} />
        </g>
        <path d="M-24 -14 a28 28 0 0 1 10 -10" fill="none" stroke="#FFF6CE" strokeWidth={2.6} strokeLinecap="round" opacity={0.7} />
      </g>
      {/* 脸（唱片中央标贴区） */}
      <g className="part-face">
        <circle cx={128} cy={128} r={16} fill={CREAM} stroke={OUTLINE} strokeWidth={3} opacity={0.98} />
        <ExpFace cx1={117} cx2={139} cy={120} r={7.5} mouthY={136} mouthW={11} expression={expression} base={eyes} />
        <Blush cx1={108} cx2={148} cy={132} />
      </g>
      {/* 头顶：一根呆芽 + 小音符（headtop 呼吸摇） */}
      <g transform={place(128, 62)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 4 Q-2 -4 1 -10" fill="none" stroke={STEM_DEEP} strokeWidth={3.4} strokeLinecap="round" />
          <g stroke={OUTLINE} strokeLinecap="round">
            <path d="M6 -14 a3 3 0 1 0 0.1 0 M8.5 -15 V-24 L13 -22.5" fill={VINYL} strokeWidth={2} />
          </g>
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(192, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：花盘朝行进方向偏转，茎身前倾迈步，叶手前后摆。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 光晕（花盘后） */}
      <g transform={place(140, 122)}>
        <g className="part-aura">
          <circle cx={0} cy={0} r={56} fill="none" stroke={PETAL_B} strokeWidth={5} opacity={0.5} />
          <circle cx={0} cy={0} r={64} fill="none" stroke={PETAL_A} strokeWidth={3} opacity={0.35} />
        </g>
      </g>
      {/* 尾：垂叶（茎后） */}
      <g transform={place(102, 206, -32)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 q-16 4 -20 16 q14 2 20 -8 q2 -4 0 -8 z" fill={STEM} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 远侧叶手（后摆） */}
      <g transform={place(116, 184, 40)}>
        <Part name="armL" origin="100% 20%">
          <path d="M0 0 Q-16 -2 -24 -12 Q-9 -18 -2 -7 Q1 -3 0 0 Z" fill={STEM_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 茎身（前倾） */}
      <path d="M124 158 L142 160 L138 214 Q128 218 120 214 Z" fill={STEM} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
      {/* 根靴（迈步） */}
      <g transform={place(116, 230)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-6 0 Q-6 -12 1 -12 Q7 -12 7 -4 Q7 0 3 0 Z" fill={STEM_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-6 0 Q-6 -12 1 -12 Q7 -12 7 -4 Q7 0 3 0 Z" fill={STEM_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 近侧叶手（前摆） */}
      <g transform={place(146, 180, -36)}>
        <Part name="armR" origin="0% 20%">
          <path d="M0 0 Q18 -2 26 -14 Q10 -20 2 -8 Q-1 -3 0 0 Z" fill={STEM} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 花盘（偏向行进方向） */}
      <g transform={place(140, 122)}>
        <PetalRing r={40} count={12} />
        <circle cx={0} cy={0} r={36} fill={VINYL} stroke={OUTLINE} strokeWidth={5.5} />
        <g fill="none" stroke="#6B5F4E" strokeWidth={2}>
          <circle cx={0} cy={0} r={28} />
          <circle cx={0} cy={0} r={21} />
        </g>
        <path d="M-22 -13 a26 26 0 0 1 9 -9" fill="none" stroke="#FFF6CE" strokeWidth={2.6} strokeLinecap="round" opacity={0.7} />
      </g>
      {/* 脸（标贴偏右=侧脸） */}
      <g className="part-face">
        <circle cx={150} cy={126} r={15} fill={CREAM} stroke={OUTLINE} strokeWidth={3} opacity={0.98} />
        <ExpSideFace cx={152} cy={122} r={7.5} mouthX={156} mouthY={134} mouthW={9} expression={expression} base={eyes} />
        <ellipse cx={142} cy={132} rx={5.5} ry={4} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 头顶：呆芽 + 音符（迎风） */}
      <g transform={place(146, 62)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 4 Q-2 -4 1 -10" fill="none" stroke={STEM_DEEP} strokeWidth={3.4} strokeLinecap="round" />
          <g stroke={OUTLINE} strokeLinecap="round">
            <path d="M6 -14 a3 3 0 1 0 0.1 0 M8.5 -15 V-24 L13 -22.5" fill={VINYL} strokeWidth={2} />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：唱罢谢幕——花盘垂到地上，花瓣向上合拢成睡帽，茎弯成拱。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 光晕（贴地花盘后，暗一档） */}
      <g transform={place(86, 196)}>
        <g className="part-aura">
          <circle cx={0} cy={0} r={44} fill="none" stroke={PETAL_B} strokeWidth={4} opacity={0.35} />
          <circle cx={0} cy={0} r={52} fill="none" stroke={PETAL_A} strokeWidth={2.6} opacity={0.25} />
        </g>
      </g>
      {/* 茎（弯成拱，从花盘伸向右侧根靴） */}
      <path
        d="M112 186 Q144 182 158 202 Q166 214 162 226 L148 228 Q148 214 140 206 Q130 198 110 198 Z"
        fill={STEM}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      {/* 尾：垂叶（茎拱后侧摊地） */}
      <g transform={place(178, 226, -12)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 q14 -6 22 -2 q-6 10 -18 8 q-4 -2 -4 -6 z" fill={STEM} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 根靴（右端侧倒） */}
      <g transform={place(160, 228, -74)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-6 0 Q-6 -11 0 -11 Q6 -11 6 -4 Q6 0 2 0 Z" fill={STEM_DEEP} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(172, 220, -84)}>
        <Part name="legR" origin="50% -30%">
          <path d="M-6 0 Q-6 -11 0 -11 Q6 -11 6 -4 Q6 0 2 0 Z" fill={STEM_DEEP} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 叶手（一片垫盘下，一片搭茎上） */}
      <g transform={place(104, 224, 84)}>
        <Part name="armL" origin="100% 20%">
          <path d="M0 0 Q-15 -2 -22 -11 Q-8 -16 -2 -6 Q1 -3 0 0 Z" fill={STEM_DEEP} stroke={OUTLINE} strokeWidth={3.8} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(128, 202, -30)}>
        <Part name="armR" origin="0% 20%">
          <path d="M0 0 Q15 -2 22 -11 Q8 -16 2 -6 Q-1 -3 0 0 Z" fill={STEM} stroke={OUTLINE} strokeWidth={3.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 花盘（垂地）+ 合拢花瓣睡帽（向上收拢） */}
      <g transform={place(86, 196)}>
        <g>
          {[-64, -40, -16, 8, 32, 56].map((a, i) => (
            <g key={a} transform={`rotate(${a}) translate(0 -32)`}>
              <path
                d="M0 8 Q-7 -2 -4.5 -12 Q0 -19 4.5 -12 Q7 -2 0 8 Z"
                fill={i % 2 === 0 ? PETAL_A : PETAL_B}
                stroke={OUTLINE}
                strokeWidth={3}
                strokeLinejoin="round"
              />
            </g>
          ))}
        </g>
        <circle cx={0} cy={0} r={34} fill={VINYL} stroke={OUTLINE} strokeWidth={5.5} />
        <g fill="none" stroke="#6B5F4E" strokeWidth={2}>
          <circle cx={0} cy={0} r={26} />
          <circle cx={0} cy={0} r={19} />
        </g>
      </g>
      {/* 脸（标贴，睡） */}
      <g className="part-face">
        <circle cx={86} cy={200} r={14} fill={CREAM} stroke={OUTLINE} strokeWidth={3} opacity={0.98} />
        <ExpFace cx1={78} cx2={94} cy={196} r={6.5} mouthY={208} mouthW={9} expression={expression} base={eyes} />
        <Blush cx1={70} cx2={102} cy={204} />
      </g>
      {/* 头顶：呆芽（从睡帽顶垂下） */}
      <g transform={place(64, 164, -34)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 4 Q-2 -3 1 -9" fill="none" stroke={STEM_DEEP} strokeWidth={3.2} strokeLinecap="round" />
          <path d="M1 -10 q-7 -2 -8 -8 q7 0 8 8 z" fill={STEM} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
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

const discoBall: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={7.5} fill={MIRROR} stroke={OUTLINE} strokeWidth={2} />
    <g stroke="#8892A6" strokeWidth={1.1} opacity={0.85}>
      <path d="M-7 -2.6 H7 M-7 2.6 H7 M-2.6 -7 V7 M2.6 -7 V7" />
    </g>
    <path d="M-4.4 -4 l2 2 M3 -3.2 l1.6 1.6" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" />
  </g>
);
const vinylRecord: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={7.5} fill={VINYL} stroke={OUTLINE} strokeWidth={2} />
    <circle cx={0} cy={0} r={5} fill="none" stroke="#6B5F4E" strokeWidth={1.2} />
    <circle cx={0} cy={0} r={2.6} fill={PETAL_A} stroke={OUTLINE} strokeWidth={1.6} />
    <circle cx={0} cy={0} r={0.8} fill={VINYL} />
  </g>
);
const grooveNote: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinecap="round">
    <path d="M-2 6 a3.5 3.5 0 1 0 0.1 0 M1.5 5 V-6 Q1.5 -8 4 -7.5 L7 -6.5" fill={VINYL} strokeWidth={2.2} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1,
    palette: { body: STEM, deep: STEM_DEEP, belly: CREAM, accent: PETAL_A, accent2: PETAL_B },
    foodAnchor: { x: 128, y: 136 },
    shadowRx: 50,
  },
  // 立式麦克风：话筒头 + 立杆 + 底座
  tool: () => (
    <g>
      <path d="M-12 0 h24" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
      <path d="M0 0 L0 -34" stroke="#8E93A6" strokeWidth={4} strokeLinecap="round" />
      <g transform="translate(0 -42) rotate(-14)">
        <rect x={-6} y={-2} width={12} height={10} rx={4} fill="#5C6172" stroke={OUTLINE} strokeWidth={2.6} />
        <circle cx={0} cy={-6} r={7.5} fill="#3E4356" stroke={OUTLINE} strokeWidth={2.8} />
        <path d="M-4 -8 h8 M-4 -5 h8" stroke="#8E93A6" strokeWidth={1.4} strokeLinecap="round" />
      </g>
      <path d="M8 -46 a8 8 0 0 1 4 6 M12 -52 a12 12 0 0 1 6 9" fill="none" stroke={PETAL_B} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 192, y: 186 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.65,
    shapes: [discoBall, vinylRecord, grooveNote],
  },
  meta: {
    nameZh: "摇摆葵",
    elements: ["electric", "fire", "grass", "normal"],
    family: "植物体",
    toolAnchor: { x: 192, y: 231 },
    nodeBudget: 255,
    lieNote: "花盘垂地，花瓣合拢当睡帽",
  },
};
