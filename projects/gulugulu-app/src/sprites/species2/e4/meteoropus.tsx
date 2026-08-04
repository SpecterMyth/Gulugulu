// ---------------------------------------------------------------------------
// 云章鱼 meteoropus — e4（electric+fire+ice+water）· 漂浮体
// 剪影：骑在自己云朵上的薰衣草色小章鱼，四条触手垂在云沿、
//       各拎一种天气挂坠（e4 环绕件），头顶小气象天线。
// 睡姿（P3）：把云揉成枕头趴上面——连云落地。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const SKIN = "#B9A8E8";
const DEEP = "#8F7AD1";
const BELLY = "#EFE8FF";
const VOLT = "#FFD93B";
const SEA = "#9BDCFF";
const FLAME = "#FFB03A";
const SNOW = "#F7FCFD";
const COFFEE = "#7A4A2B";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 坐骑云朵（底座，蓬蓬三球） */}
      <g>
        <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={5}>
          <ellipse cx={94} cy={210} rx={26} ry={17} />
          <ellipse cx={162} cy={210} rx={26} ry={17} />
          <ellipse cx={128} cy={216} rx={34} ry={19} />
        </g>
        <path d="M70 214 Q128 200 186 214" fill="none" stroke="#E3E7F0" strokeWidth={3} strokeLinecap="round" />
      </g>
      {/* 四条触手垂在云沿，各拎天气挂坠（e4 环绕件） */}
      <g>
        <g transform={place(88, 196)}>
          <path d="M0 0 Q-8 14 -2 24" fill="none" stroke={SKIN} strokeWidth={9} strokeLinecap="round" />
          <g transform="translate(-2 30)">
            <circle r={6} fill={FLAME} stroke={OUTLINE} strokeWidth={2.4} />
            <path d="M0 -2 q-2 -2 -1 -4 q2 1 1 4 z" fill="#FFF1C9" />
          </g>
        </g>
        <g transform={place(112, 202)}>
          <path d="M0 0 Q-4 16 2 26" fill="none" stroke={SKIN} strokeWidth={9} strokeLinecap="round" />
          <g transform="translate(2 31)">
            <path d="M0 -6 q5 5.5 5 9 a5 5 0 0 1 -10 0 q0 -3.5 5 -9 z" fill={SEA} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
          </g>
        </g>
        <g transform={place(144, 202)}>
          <path d="M0 0 Q4 16 -2 26" fill="none" stroke={SKIN} strokeWidth={9} strokeLinecap="round" />
          <g transform="translate(-2 30)" stroke={SNOW} strokeWidth={2.2} strokeLinecap="round">
            <path d="M0 -5 V5 M-4.5 -2.5 L4.5 2.5 M-4.5 2.5 L4.5 -2.5" />
          </g>
        </g>
        <g transform={place(168, 196)}>
          <path d="M0 0 Q8 14 2 24" fill="none" stroke={SKIN} strokeWidth={9} strokeLinecap="round" />
          <g transform="translate(2 30)">
            <path d="M1.5 -7 L-3.5 1 h3 L-1.5 7 L4 -1 h-3 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
          </g>
        </g>
      </g>
      {/* 尾：身后一条卷卷触手（左侧探出，tail 摇摆） */}
      <g transform={place(84, 176)}>
        <Part name="tail" origin="100% 20%">
          <path d="M0 0 Q-18 4 -20 18 Q-20 28 -10 27 Q-4 26 -6 20 Q-12 22 -12 17 Q-12 8 0 6 Z" fill={SKIN} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 章鱼头身（大圆顶） */}
      <path
        d="M80 178 Q78 116 128 112 Q178 116 176 178 Q176 202 128 204 Q80 202 80 178 Z"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 额前云纹斑 */}
      <g fill={BELLY} opacity={0.9}>
        <circle cx={102} cy={132} r={7} />
        <circle cx={113} cy={126} r={9} />
        <circle cx={124} cy={132} r={7} />
      </g>
      {/* 小手（云上撑着） */}
      <g transform={place(92, 178, 30)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={SKIN} rx={7} ry={11} />
        </Part>
      </g>
      <g transform={place(164, 178, -30)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={SKIN} rx={7} ry={11} />
        </Part>
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={112} cx2={146} cy={160} r={10} mouthY={182} mouthW={13} expression={expression} base={eyes} />
        <Blush cx1={99} cx2={159} cy={174} />
      </g>
      {/* 头顶：小气象天线（转子=orbit 慢转） */}
      <g transform={place(128, 112)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 V-10" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" />
          <g transform="translate(0 -14)">
            <g className="part-orbit">
              <path d="M-9 0 H9 M0 -9 V9" stroke={DEEP} strokeWidth={2.8} strokeLinecap="round" />
              <circle cx={9} cy={0} r={2.6} fill={VOLT} stroke={OUTLINE} strokeWidth={1.6} />
              <circle cx={-9} cy={0} r={2.6} fill={SEA} stroke={OUTLINE} strokeWidth={1.6} />
              <circle cx={0} cy={-9} r={2.6} fill={FLAME} stroke={OUTLINE} strokeWidth={1.6} />
              <circle cx={0} cy={9} r={2.6} fill={SNOW} stroke={OUTLINE} strokeWidth={1.6} />
            </g>
            <circle r={2.4} fill={BELLY} stroke={OUTLINE} strokeWidth={1.8} />
          </g>
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(194, 224)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：骑云前行，圆顶朝前，触手拖在云后各拎挂坠，天线迎风。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 坐骑云朵 */}
      <g>
        <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={5}>
          <ellipse cx={96} cy={212} rx={26} ry={16} />
          <ellipse cx={160} cy={212} rx={25} ry={16} />
          <ellipse cx={128} cy={218} rx={33} ry={17} />
        </g>
        <path d="M74 216 Q128 202 184 216" fill="none" stroke="#E3E7F0" strokeWidth={3} strokeLinecap="round" />
      </g>
      {/* 触手拖在云后（随行飘），各拎天气挂坠 */}
      <g>
        <g transform={place(86, 198)}>
          <path d="M0 0 Q-12 10 -10 22" fill="none" stroke={SKIN} strokeWidth={9} strokeLinecap="round" />
          <g transform="translate(-10 28)">
            <circle r={6} fill={FLAME} stroke={OUTLINE} strokeWidth={2.4} />
            <path d="M0 -2 q-2 -2 -1 -4 q2 1 1 4 z" fill="#FFF1C9" />
          </g>
        </g>
        <g transform={place(108, 204)}>
          <path d="M0 0 Q-8 14 -4 24" fill="none" stroke={SKIN} strokeWidth={9} strokeLinecap="round" />
          <g transform="translate(-4 29)">
            <path d="M0 -6 q5 5.5 5 9 a5 5 0 0 1 -10 0 q0 -3.5 5 -9 z" fill={SEA} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
          </g>
        </g>
        <g transform={place(160, 202)}>
          <path d="M0 0 Q6 14 0 24" fill="none" stroke={SKIN} strokeWidth={9} strokeLinecap="round" />
          <g transform="translate(0 29)">
            <path d="M1.5 -7 L-3.5 1 h3 L-1.5 7 L4 -1 h-3 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
          </g>
        </g>
      </g>
      {/* 尾：卷卷触手（云后） */}
      <g transform={place(88, 174)}>
        <Part name="tail" origin="100% 20%">
          <path d="M0 0 Q-18 4 -20 18 Q-20 28 -10 27 Q-4 26 -6 20 Q-12 22 -12 17 Q-12 8 0 6 Z" fill={SKIN} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 章鱼头身（大圆顶前倾） */}
      <path
        d="M84 180 Q82 118 132 114 Q180 120 176 180 Q174 202 128 204 Q86 202 84 180 Z"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 额前云纹斑（前额右侧） */}
      <g fill={BELLY} opacity={0.9}>
        <circle cx={146} cy={132} r={7} />
        <circle cx={157} cy={126} r={9} />
        <circle cx={167} cy={132} r={6.5} />
      </g>
      {/* 小手（一前一后扶云） */}
      <g transform={place(102, 184, 26)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={DEEP} rx={6.5} ry={10} />
        </Part>
      </g>
      <g transform={place(160, 184, -26)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={SKIN} rx={7} ry={11} />
        </Part>
      </g>
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={156} cy={160} r={10} mouthX={166} mouthY={182} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={143} cy={176} rx={7.5} ry={5} fill="#E8B8D0" opacity={0.8} />
      </g>
      {/* 头顶：气象天线（迎风微倾） */}
      <g transform={place(136, 114, 6)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 V-10" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" />
          <g transform="translate(0 -14)">
            <g className="part-orbit">
              <path d="M-9 0 H9 M0 -9 V9" stroke={DEEP} strokeWidth={2.8} strokeLinecap="round" />
              <circle cx={9} cy={0} r={2.6} fill={VOLT} stroke={OUTLINE} strokeWidth={1.6} />
              <circle cx={-9} cy={0} r={2.6} fill={SEA} stroke={OUTLINE} strokeWidth={1.6} />
              <circle cx={0} cy={-9} r={2.6} fill={FLAME} stroke={OUTLINE} strokeWidth={1.6} />
              <circle cx={0} cy={9} r={2.6} fill={SNOW} stroke={OUTLINE} strokeWidth={1.6} />
            </g>
            <circle r={2.4} fill={BELLY} stroke={OUTLINE} strokeWidth={1.8} />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：把云揉成枕头连云落地，头枕云团，触手摊地、挂坠散一旁，天线耷拉。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 揉成一团的云枕（左侧落地） */}
      <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={5}>
        <ellipse cx={58} cy={210} rx={18} ry={12} />
        <ellipse cx={84} cy={202} rx={21} ry={14} />
        <ellipse cx={72} cy={218} rx={24} ry={12} />
      </g>
      {/* 尾：卷卷触手（右后） */}
      <g transform={place(172, 192)}>
        <Part name="tail" origin="0% 20%">
          <path d="M0 0 Q18 4 20 18 Q20 28 10 27 Q4 26 6 20 Q12 22 12 17 Q12 8 0 6 Z" fill={SKIN} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 摊地触手（右前两条 + 前方一条），挂坠散落 */}
      <g>
        <g transform={place(152, 216)}>
          <path d="M0 0 Q12 6 22 4" fill="none" stroke={SKIN} strokeWidth={9} strokeLinecap="round" />
          <g transform="translate(29 4)">
            <path d="M1.5 -7 L-3.5 1 h3 L-1.5 7 L4 -1 h-3 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
          </g>
        </g>
        <g transform={place(136, 224)}>
          <path d="M0 0 Q8 6 16 6" fill="none" stroke={SKIN} strokeWidth={9} strokeLinecap="round" />
          <g transform="translate(23 6)">
            <path d="M0 -6 q5 5.5 5 9 a5 5 0 0 1 -10 0 q0 -3.5 5 -9 z" fill={SEA} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
          </g>
        </g>
        <g transform={place(112, 228)}>
          <path d="M0 0 Q6 3 12 2" fill="none" stroke={SKIN} strokeWidth={8} strokeLinecap="round" />
          <g transform="translate(18 2)" stroke={SNOW} strokeWidth={2.2} strokeLinecap="round">
            <path d="M0 -5 V5 M-4.5 -2.5 L4.5 2.5 M-4.5 2.5 L4.5 -2.5" />
          </g>
        </g>
      </g>
      {/* 章鱼头身（趴伏，头枕云团） */}
      <path
        d="M82 212 Q76 166 122 160 Q170 164 168 208 Q166 224 126 226 Q86 224 82 212 Z"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 额前云纹斑 */}
      <g fill={BELLY} opacity={0.9}>
        <circle cx={100} cy={176} r={6.5} />
        <circle cx={111} cy={170} r={8.5} />
        <circle cx={122} cy={176} r={6.5} />
      </g>
      {/* 小手（一只搂云枕，一只收在颌下） */}
      <g transform={place(88, 204, 42)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={SKIN} rx={6.5} ry={10} />
        </Part>
      </g>
      <g transform={place(118, 214, -14)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={SKIN} rx={6.5} ry={10} />
        </Part>
      </g>
      {/* 脸（睡，脸偏云枕一侧） */}
      <g className="part-face">
        <ExpFace cx1={102} cx2={132} cy={194} r={9} mouthY={212} mouthW={12} expression={expression} base={eyes} />
        <Blush cx1={90} cx2={144} cy={206} />
      </g>
      {/* 头顶：气象天线耷拉 */}
      <g transform={place(142, 162, 38)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 V-9" stroke={OUTLINE} strokeWidth={3.2} strokeLinecap="round" />
          <g transform="translate(0 -13)">
            <g className="part-orbit">
              <path d="M-8 0 H8 M0 -8 V8" stroke={DEEP} strokeWidth={2.6} strokeLinecap="round" />
              <circle cx={8} cy={0} r={2.4} fill={VOLT} stroke={OUTLINE} strokeWidth={1.6} />
              <circle cx={-8} cy={0} r={2.4} fill={SEA} stroke={OUTLINE} strokeWidth={1.6} />
              <circle cx={0} cy={-8} r={2.4} fill={FLAME} stroke={OUTLINE} strokeWidth={1.6} />
              <circle cx={0} cy={8} r={2.4} fill={SNOW} stroke={OUTLINE} strokeWidth={1.6} />
            </g>
            <circle r={2.2} fill={BELLY} stroke={OUTLINE} strokeWidth={1.8} />
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

// 咖啡师的产物：外带咖啡杯 + 拉花爱心 + 咖啡豆
const coffeeCup: ParticleRenderer = () => (
  <g>
    <path d="M-6 -2 L6 -2 L4.6 8 Q0 10 -4.6 8 Z" fill={SNOW} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M-5.6 2 H5" stroke={DEEP} strokeWidth={2.2} opacity={0.5} />
    <path d="M-7 -2 L7 -2 L5.6 -5.5 L-5.6 -5.5 Z" fill="#C9895B" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <rect x={-2} y={-8.5} width={4} height={3.2} rx={1} fill="#C9895B" stroke={OUTLINE} strokeWidth={1.8} />
  </g>
);
const latteHeart: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={7.5} fill="#E8D3B0" stroke={OUTLINE} strokeWidth={2} />
    <path d="M0 5 Q-5 0.4 -5 -2.4 Q-5 -5 -2.5 -5 Q-0.8 -5 0 -3 Q0.8 -5 2.5 -5 Q5 -5 5 -2.4 Q5 0.4 0 5 Z" fill={COFFEE} stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round" />
  </g>
);
const coffeeBean: ParticleRenderer = () => (
  <g transform="rotate(-24)">
    <ellipse cx={0} cy={0} rx={4.6} ry={7} fill={COFFEE} stroke={OUTLINE} strokeWidth={2} />
    <path d="M0 -6 Q-2 0 0 6" fill="none" stroke="#3B2B1D" strokeWidth={1.6} strokeLinecap="round" />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.12,
    palette: { body: SKIN, deep: DEEP, belly: BELLY, accent: VOLT, accent2: SEA },
    floating: true,
    shadowRx: 50,
    foodAnchor: { x: 130, y: 182 },
  },
  // 风速仪：手柄 + 三杯转轮
  tool: () => (
    <g>
      <path d="M-2.5 0 L2.5 0 L2 -24 L-2 -24 Z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <g transform="translate(0 -30)">
        <path d="M-12 0 H12 M0 0 V-10" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
        <path d="M-12 -3 a4.5 4.5 0 0 0 0 7 q4 1 5 -3 Z" fill={SEA} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
        <path d="M12 -3 a4.5 4.5 0 0 1 0 7 q-4 1 -5 -3 Z" fill={SEA} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
        <path d="M-3 -10 a4.5 4.5 0 0 1 7 0 q1 4 -3 5 Z" fill={SEA} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
        <circle r={2.6} fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} />
      </g>
      <circle cx={0} cy={-2} r={2.2} fill={DEEP} stroke={OUTLINE} strokeWidth={1.6} />
    </g>
  ),
  workFx: {
    emitter: { x: 194, y: 192 },
    baseAngle: -Math.PI / 2.2,
    cone: 0.65,
    shapes: [coffeeCup, latteHeart, coffeeBean],
  },
  meta: {
    nameZh: "云章鱼",
    elements: ["electric", "fire", "ice", "water"],
    family: "漂浮体",
    toolAnchor: { x: 194, y: 224 },
    nodeBudget: 220,
    lieNote: "把云揉成枕头趴上面——连云落地",
  },
};
