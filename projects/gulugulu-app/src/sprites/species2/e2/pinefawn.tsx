// ---------------------------------------------------------------------------
// 雪松鹿 pinefawn — e2（grass+ice）· 四足兽
// 剪影：细腿小鹿，角=两枝挂雪的松枝（招牌），背上雪花斑点，颈系小铃铛。
// 睡姿（P3）：四腿收拢的标准鹿卧，鼻尖埋进尾巴。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { TallLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const FUR = "#93B889";
const DEEP = "#5E8A5E";
const CREAM = "#FFF7E8";
const SNOW = "#F7FCFD";
const ICE = "#8FD8E8";

/** 一枝挂雪松枝角（pivot=角根） */
function PineAntler({ mirror = false }: { mirror?: boolean }) {
  return (
    <g transform={mirror ? "scale(-1 1)" : undefined}>
      <path d="M0 0 Q2 -14 8 -24 M4 -12 Q10 -14 14 -20 M6 -20 Q2 -26 3 -32" fill="none" stroke={DEEP} strokeWidth={5} strokeLinecap="round" />
      <g fill={SNOW} stroke={OUTLINE} strokeWidth={2.4}>
        <circle cx={8} cy={-25} r={4} />
        <circle cx={14} cy={-20} r={3.2} />
        <circle cx={3} cy={-32} r={3.4} />
      </g>
    </g>
  );
}

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小白团尾（右侧探出） */}
      <g transform={place(174, 196)}>
        <Part name="tail" origin="0% 50%">
          <circle cx={7} cy={0} r={8} fill={SNOW} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 细腿（鹿签名：高挑） */}
      <g transform={place(108, 231)}>
        <Part name="legL" origin="50% -20%">
          <TallLeg color={FUR} hoof={DEEP} len={30} w={9.5} hoofH={7} />
        </Part>
      </g>
      <g transform={place(148, 231)}>
        <Part name="legR" origin="50% -20%">
          <TallLeg color={FUR} hoof={DEEP} len={30} w={9.5} hoofH={7} />
        </Part>
      </g>
      {/* 身体（挺立小胸脯） */}
      <ellipse cx={128} cy={180} rx={44} ry={32} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 背部雪花斑（鹿斑=雪点） */}
      <g fill={SNOW} opacity={0.95}>
        <circle cx={98} cy={168} r={4} />
        <circle cx={112} cy={160} r={3.4} />
        <circle cx={146} cy={162} r={3.6} />
        <circle cx={160} cy={172} r={3.2} />
      </g>
      <ellipse cx={128} cy={196} rx={24} ry={14} fill={CREAM} opacity={0.95} />
      {/* 小手（前腿收在胸前的小蹄手） */}
      <g transform={place(96, 192, 20)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8.5} fill={FUR} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(160, 192, -20)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8.5} fill={FUR} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 颈铃铛丝带 */}
      <path d="M106 156 Q128 164 150 156" fill="none" stroke="#E2432E" strokeWidth={5} strokeLinecap="round" />
      <g transform="translate(128 164)">
        <circle r={6} fill="#F5C542" stroke={OUTLINE} strokeWidth={2.8} />
        <path d="M0 1.5 v2.8" stroke={OUTLINE} strokeWidth={2} strokeLinecap="round" />
      </g>
      {/* 头（大头婴儿比例 + 大耳） */}
      <g fill={FUR} stroke={OUTLINE} strokeWidth={4.5}>
        <ellipse cx={88} cy={100} rx={15} ry={10} transform="rotate(-28 88 100)" />
        <ellipse cx={168} cy={100} rx={15} ry={10} transform="rotate(28 168 100)" />
      </g>
      <circle cx={95} cy={103} r={5} fill="#F5A8C6" opacity={0.7} />
      <circle cx={161} cy={103} r={5} fill="#F5A8C6" opacity={0.7} />
      <ellipse cx={128} cy={118} rx={42} ry={37} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={128} cy={138} rx={19} ry={13} fill={CREAM} />
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={111} cx2={145} cy={112} r={10} mouthY={140} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={128} cy={132} rx={6} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} />
        <Blush cx1={100} cx2={156} cy={128} />
      </g>
      {/* 头顶：挂雪松枝角一对（headtop 呼吸摇） */}
      <g transform={place(128, 86)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="translate(-16 0) scale(1.15)"><PineAntler mirror /></g>
          <g transform="translate(16 0) scale(1.15)"><PineAntler /></g>
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(188, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：细腿小鹿踏步，头颈前伸，松枝角朝前，团尾在后。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小白团尾（身后） */}
      <g transform={place(82, 170)}>
        <Part name="tail" origin="100% 50%">
          <circle cx={-6} cy={0} r={8} fill={SNOW} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 远侧前后腿（深色） */}
      <g transform={place(100, 230)}>
        <Part name="legL" origin="50% -20%">
          <TallLeg color={DEEP} hoof={DEEP} len={28} w={9} hoofH={7} />
        </Part>
      </g>
      <g transform={place(142, 230)}>
        <Part name="armL" origin="50% -20%">
          <TallLeg color={DEEP} hoof={DEEP} len={28} w={9} hoofH={7} />
        </Part>
      </g>
      {/* 身体（横向小胸脯） */}
      <ellipse cx={124} cy={178} rx={46} ry={28} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 背部雪花斑 */}
      <g fill={SNOW} opacity={0.95}>
        <circle cx={96} cy={166} r={4} />
        <circle cx={112} cy={158} r={3.4} />
        <circle cx={134} cy={158} r={3.6} />
      </g>
      <ellipse cx={124} cy={196} rx={26} ry={12} fill={CREAM} opacity={0.95} />
      {/* 近侧前后腿（迈步） */}
      <g transform={place(116, 231)}>
        <Part name="legR" origin="50% -20%">
          <TallLeg color={FUR} hoof={DEEP} len={30} w={9.5} hoofH={7} />
        </Part>
      </g>
      <g transform={place(158, 231)}>
        <Part name="armR" origin="50% -20%">
          <TallLeg color={FUR} hoof={DEEP} len={30} w={9.5} hoofH={7} />
        </Part>
      </g>
      {/* 颈（连接身与头） */}
      <path d="M146 168 Q150 134 166 120 Q184 128 180 148 Q174 166 164 176 Z" fill={FUR} stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round" />
      {/* 颈铃铛丝带 */}
      <path d="M148 160 Q160 168 172 158" fill="none" stroke="#E2432E" strokeWidth={4.5} strokeLinecap="round" />
      <g transform="translate(162 168)">
        <circle r={5.5} fill="#F5C542" stroke={OUTLINE} strokeWidth={2.6} />
        <path d="M0 1.4 v2.6" stroke={OUTLINE} strokeWidth={2} strokeLinecap="round" />
      </g>
      {/* 头（大头前伸）+ 后耳 */}
      <ellipse cx={146} cy={92} rx={14} ry={9} fill={FUR} stroke={OUTLINE} strokeWidth={4.5} transform="rotate(-34 146 92)" />
      <circle cx={149} cy={94} r={4.5} fill="#F5A8C6" opacity={0.7} />
      <ellipse cx={168} cy={112} rx={36} ry={31} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={188} cy={126} rx={15} ry={10} fill={CREAM} />
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={176} cy={106} r={10} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={196} cy={122} rx={5} ry={4} fill={DEEP} stroke={OUTLINE} strokeWidth={2.4} />
        <path d="M186 134 q5 4 10 0" fill="none" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
        <ellipse cx={166} cy={124} rx={6.5} ry={4.5} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 头顶：挂雪松枝角（前后两枝） */}
      <g transform={place(162, 84)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="translate(-12 2) scale(1.05)"><PineAntler mirror /></g>
          <g transform="translate(8 0) scale(1.15)"><PineAntler /></g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：四腿收拢的标准鹿卧，颈往回收，鼻尖埋进白团尾。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 身体（卧姿椭圆） */}
      <ellipse cx={120} cy={202} rx={52} ry={27} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 背部雪花斑 */}
      <g fill={SNOW} opacity={0.95}>
        <circle cx={92} cy={188} r={4} />
        <circle cx={108} cy={180} r={3.4} />
        <circle cx={130} cy={182} r={3.6} />
      </g>
      {/* 尾：白团尾（右后，鼻尖埋处） */}
      <g transform={place(168, 208)}>
        <Part name="tail" origin="50% 50%">
          <circle cx={0} cy={0} r={10} fill={SNOW} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 收拢的四腿（折叠蹄包） */}
      <g transform={place(88, 226)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={12} ry={5.5} fill={FUR} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={-10} cy={0} rx={4} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} />
        </Part>
      </g>
      <g transform={place(112, 229)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={12} ry={5.5} fill={FUR} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={-10} cy={0} rx={4} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} />
        </Part>
      </g>
      <g transform={place(138, 228, -4)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={0} rx={11} ry={5} fill={FUR} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={9} cy={0} rx={4} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} />
        </Part>
      </g>
      <g transform={place(156, 224, -8)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={0} rx={10} ry={5} fill={FUR} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={8} cy={0} rx={4} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} />
        </Part>
      </g>
      {/* 后耳（头后） */}
      <ellipse cx={112} cy={144} rx={13} ry={8.5} fill={FUR} stroke={OUTLINE} strokeWidth={4.5} transform="rotate(-40 112 144)" />
      <circle cx={115} cy={146} r={4} fill="#F5A8C6" opacity={0.7} />
      {/* 大头（低垂，鼻尖探向尾巴，直接压在身上） */}
      <ellipse cx={138} cy={166} rx={33} ry={29} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 颈铃铛（挂头下缘） */}
      <path d="M110 184 Q124 192 138 184" fill="none" stroke="#E2432E" strokeWidth={4.5} strokeLinecap="round" />
      <g transform="translate(124 192)">
        <circle r={5} fill="#F5C542" stroke={OUTLINE} strokeWidth={2.4} />
        <path d="M0 1.2 v2.4" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" />
      </g>
      {/* 口鼻（贴向尾巴） */}
      <ellipse cx={158} cy={186} rx={14} ry={10} fill={CREAM} transform="rotate(26 158 186)" />
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={126} cx2={150} cy={160} r={8.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={165} cy={194} rx={5} ry={4} fill={DEEP} stroke={OUTLINE} strokeWidth={2.4} />
        <Blush cx1={118} cx2={158} cy={176} />
      </g>
      {/* 头顶：松枝角（歇枝） */}
      <g transform={place(132, 140, -10)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="translate(-13 0) scale(1.0)"><PineAntler mirror /></g>
          <g transform="translate(13 0) scale(1.08)"><PineAntler /></g>
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

const pineBit: ParticleRenderer = () => (
  <g stroke={DEEP} strokeWidth={2.2} strokeLinecap="round">
    <path d="M0 -6 V6 M0 -3 L-4 -6 M0 -3 L4 -6 M0 1 L-4.5 -2 M0 1 L4.5 -2 M0 5 L-5 2 M0 5 L5 2" />
  </g>
);
// 彩灯串：电线弧 + 4 颗彩色灯泡
const stringLights: ParticleRenderer = () => (
  <g>
    <path d="M-11 -5 Q-5 3 0 -4 Q5 3 11 -5" fill="none" stroke={DEEP} strokeWidth={2} strokeLinecap="round" />
    <g stroke={OUTLINE} strokeWidth={1.6}>
      <ellipse cx={-8} cy={0} rx={2} ry={2.8} fill="#E2432E" />
      <ellipse cx={-2.5} cy={2} rx={2} ry={2.8} fill="#FFD93B" />
      <ellipse cx={2.5} cy={2} rx={2} ry={2.8} fill="#57B84C" />
      <ellipse cx={8} cy={0} rx={2} ry={2.8} fill="#2E7BD6" />
    </g>
  </g>
);
// 电锯：圆润机身 + 带锯齿的导板
const chainsaw: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <path d="M-11 -2 Q-12 -7 -7 -7 L-2 -7 Q2 -7 2 -3 L2 3 Q2 6 -3 6 L-8 6 Q-11 6 -11 2 Z" fill="#E2432E" strokeWidth={2.4} />
    <path d="M-9 -7 Q-9 -11 -5 -10" fill="none" strokeWidth={2} strokeLinecap="round" />
    <path d="M2 -3 L12 -2 Q14 -1 12 1 L2 2 Z" fill="#C8CCD8" strokeWidth={2.2} />
    <g stroke={OUTLINE} strokeWidth={1.2}>
      <path d="M4 -2.6 v-1.6 M7 -2.7 v-1.6 M10 -2.6 v-1.6 M4 1.6 v1.6 M7 1.7 v1.6 M10 1.6 v1.6" />
    </g>
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.06,
    palette: { body: FUR, deep: DEEP, belly: CREAM, accent: ICE, accent2: "#8CD97B" },
    foodAnchor: { x: 130, y: 140 },
    shadowRx: 52,
  },
  // 雪橇铃：木柄上一串铃铛 + 缎带
  tool: () => (
    <g>
      <path d="M-2.4 0 L2.4 0 L2 -30 L-2 -30 Z" fill="#B98A4E" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M0 -30 Q-10 -34 -12 -42 M0 -30 Q10 -34 12 -42 M0 -30 Q0 -38 0 -44" fill="none" stroke="#E2432E" strokeWidth={3} strokeLinecap="round" />
      <g fill="#F5C542" stroke={OUTLINE} strokeWidth={2.4}>
        <circle cx={-12} cy={-44} r={5} />
        <circle cx={0} cy={-47} r={5} />
        <circle cx={12} cy={-44} r={5} />
      </g>
      <path d="M-12 -42.5 v2.6 M0 -45.5 v2.6 M12 -42.5 v2.6" stroke={OUTLINE} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M-5 -8 Q0 -4 5 -8 L3 -2 L-3 -2 Z" fill="#E2432E" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 188, y: 186 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.55,
    shapes: [pineBit, stringLights, chainsaw],
  },
  meta: {
    nameZh: "雪松鹿",
    elements: ["grass", "ice"],
    family: "四足兽",
    toolAnchor: { x: 188, y: 231 },
    nodeBudget: 165,
    lieNote: "四腿收拢的标准鹿卧，鼻尖埋进尾巴",
  },
};
