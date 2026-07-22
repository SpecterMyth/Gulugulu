// ---------------------------------------------------------------------------
// 蜜壶草 juicepitcher — e4（electric+fire+grass+water）· 植物体
// 剪影：圆滚猪笼草=果汁杯（杯身果汁液面+气泡），插一根藤蔓吸管，
//       笼盖=小叶帽，果粒轨道环绕（e4 环绕件）。果汁摊摊主。
// 睡姿（P3）：盖上笼盖，藤蔓卷成圈垫着。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm, StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const POD = "#7CC96B";
const POD_DEEP = "#4E9A4A";
const CREAM = "#FFF4DC";
const JUICE = "#F5A83B";
const VOLT = "#FFD93B";
const SEA = "#9BDCFF";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e4 环绕件：果粒轨道（橙片/柠檬/樱桃/冰粒，part-orbit 慢转） */}
      <g transform={place(128, 172)}>
        <g className="part-orbit">
          <g stroke={OUTLINE} strokeWidth={2.2}>
            <circle cx={-64} cy={0} r={6} fill={JUICE} />
            <circle cx={64} cy={0} r={6} fill="#E2432E" />
            <circle cx={0} cy={-21} r={6} fill={VOLT} />
            <circle cx={0} cy={21} r={6} fill="#CFEFF6" />
          </g>
          <path d="M-67 -3 L-61 3 M-64 -3 v6" stroke={OUTLINE} strokeWidth={1.4} />
          <path d="M-3 -21 h6" stroke={OUTLINE} strokeWidth={1.4} />
        </g>
      </g>
      {/* 尾：卷藤蔓（左下探出） */}
      <g transform={place(78, 214)}>
        <Part name="tail" origin="100% 30%">
          <path d="M0 0 Q-14 4 -18 -4 Q-20 -12 -12 -12 Q-7 -12 -8 -7 Q-13 -8 -12 -5 Q-10 -1 0 -4 Z" fill="none" stroke={POD_DEEP} strokeWidth={3.6} strokeLinecap="round" />
        </Part>
      </g>
      {/* 杯身（猪笼草笼=果汁杯，上宽下略窄圆润） */}
      <path
        d="M86 132 L170 132 Q176 180 166 214 Q150 230 128 230 Q106 230 90 214 Q80 180 86 132 Z"
        fill={POD}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 果汁液面 + 气泡（杯身下半橙汁） */}
      <path d="M90 170 Q128 180 166 170 Q170 196 162 212 Q148 226 128 226 Q108 226 94 212 Q86 196 90 170 Z" fill={JUICE} opacity={0.92} />
      <path d="M90 170 Q128 180 166 170" fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      <g fill="#FFF1C9" opacity={0.9}>
        <circle cx={108} cy={190} r={3.4} />
        <circle cx={146} cy={196} r={2.8} />
        <circle cx={126} cy={208} r={2.4} />
      </g>
      {/* 杯身条纹高光 + 电花贴纸 */}
      <path d="M96 140 Q94 160 96 166" fill="none" stroke="#A8E39B" strokeWidth={4} strokeLinecap="round" />
      <path d="M156 146 l-3.2 5.4 h2.6 l-3.2 5.4" fill="none" stroke={VOLT} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
      {/* 藤蔓吸管（从杯口插入，弯管+叶旗） */}
      <g>
        <path d="M150 128 Q158 108 174 104 Q186 101 188 92" fill="none" stroke={POD_DEEP} strokeWidth={7} strokeLinecap="round" />
        <path d="M150 128 Q158 108 174 104 Q186 101 188 92" fill="none" stroke="#A8E39B" strokeWidth={2.6} strokeLinecap="round" />
        <path d="M188 90 q9 -2 10 -10 q-9 0 -10 10 z" fill="#8CD97B" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
      </g>
      {/* 小手 */}
      <g transform={place(84, 178, 24)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={POD} rx={7} ry={11} />
        </Part>
      </g>
      <g transform={place(172, 178, -24)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={POD} rx={7} ry={11} />
        </Part>
      </g>
      {/* 根须小脚 */}
      <g transform={place(112, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={POD} deep={POD_DEEP} rx={7.5} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(144, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={POD} deep={POD_DEEP} rx={7.5} ry={4.5} lift={4} />
        </Part>
      </g>
      {/* 脸（杯身上半） */}
      <g className="part-face">
        <ExpFace cx1={110} cx2={146} cy={150} r={9.5} mouthY={168} mouthW={13} expression={expression} base={eyes} />
        <Blush cx1={98} cx2={158} cy={162} />
      </g>
      {/* 头顶：笼盖=小叶帽（半开翘起，headtop 呼吸摇） */}
      <g transform={place(112, 128)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(-16)">
            <path d="M-24 0 Q-26 -14 -8 -18 Q12 -20 22 -8 Q14 2 0 2 Q-14 2 -24 0 Z" fill={POD_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
            <path d="M-16 -6 Q0 -12 14 -6" fill="none" stroke="#A8E39B" strokeWidth={2.4} strokeLinecap="round" />
          </g>
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

/** 侧视（右向）：果汁杯迈步，吸管朝前上扬，笼盖后翘，果粒轨道随行。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 果粒轨道（随行） */}
      <g transform={place(126, 174)}>
        <g className="part-orbit">
          <g stroke={OUTLINE} strokeWidth={2.2}>
            <circle cx={-58} cy={0} r={6} fill={JUICE} />
            <circle cx={58} cy={0} r={6} fill="#E2432E" />
            <circle cx={0} cy={-20} r={6} fill={VOLT} />
            <circle cx={0} cy={20} r={6} fill="#CFEFF6" />
          </g>
          <path d="M-61 -3 L-55 3 M-58 -3 v6" stroke={OUTLINE} strokeWidth={1.4} />
        </g>
      </g>
      {/* 尾：卷藤蔓（身后） */}
      <g transform={place(82, 212)}>
        <Part name="tail" origin="100% 30%">
          <path d="M0 0 Q-14 4 -18 -4 Q-20 -12 -12 -12 Q-7 -12 -8 -7 Q-13 -8 -12 -5 Q-10 -1 0 -4 Z" fill="none" stroke={POD_DEEP} strokeWidth={3.6} strokeLinecap="round" />
        </Part>
      </g>
      {/* 杯身（侧视略窄） */}
      <path
        d="M92 134 L162 134 Q170 180 160 214 Q146 230 126 230 Q108 230 94 214 Q84 180 92 134 Z"
        fill={POD}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 果汁液面 + 气泡 */}
      <path d="M92 172 Q126 182 162 172 Q166 196 158 210 Q144 226 126 226 Q108 226 96 210 Q88 196 92 172 Z" fill={JUICE} opacity={0.92} />
      <path d="M92 172 Q126 182 162 172" fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      <g fill="#FFF1C9" opacity={0.9}>
        <circle cx={110} cy={192} r={3.2} />
        <circle cx={144} cy={198} r={2.6} />
      </g>
      <path d="M100 142 Q98 160 100 166" fill="none" stroke="#A8E39B" strokeWidth={4} strokeLinecap="round" />
      {/* 藤蔓吸管（朝前上扬） */}
      <g>
        <path d="M148 130 Q158 110 174 106 Q186 103 188 94" fill="none" stroke={POD_DEEP} strokeWidth={7} strokeLinecap="round" />
        <path d="M148 130 Q158 110 174 106 Q186 103 188 94" fill="none" stroke="#A8E39B" strokeWidth={2.6} strokeLinecap="round" />
        <path d="M188 92 q9 -2 10 -10 q-9 0 -10 10 z" fill="#8CD97B" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
      </g>
      {/* 小手（前后摆） */}
      <g transform={place(92, 182, 22)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={POD_DEEP} rx={6.5} ry={10} />
        </Part>
      </g>
      <g transform={place(162, 180, -26)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={POD} rx={7} ry={11} />
        </Part>
      </g>
      {/* 根须小脚（迈步） */}
      <g transform={place(112, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={POD} deep={POD_DEEP} rx={7.5} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(144, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={POD} deep={POD_DEEP} rx={7.5} ry={4.5} lift={4} />
        </Part>
      </g>
      {/* 脸（杯身侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={146} cy={150} r={9.5} mouthX={156} mouthY={168} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={132} cy={164} rx={7.5} ry={5} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 头顶：笼盖（后翘小叶帽） */}
      <g transform={place(108, 130)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(-22)">
            <path d="M-22 0 Q-24 -13 -7 -17 Q11 -19 20 -8 Q13 2 0 2 Q-13 2 -22 0 Z" fill={POD_DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
            <path d="M-14 -6 Q0 -11 12 -6" fill="none" stroke="#A8E39B" strokeWidth={2.4} strokeLinecap="round" />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：打烊——笼盖盖严杯口，藤蔓卷成一圈垫在杯底，果粒落地歇着。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：藤蔓卷成圈垫底 */}
      <g transform={place(128, 228)}>
        <Part name="tail" origin="50% 50%">
          <g fill="none" stroke={POD_DEEP} strokeLinecap="round">
            <ellipse cx={0} cy={0} rx={46} ry={8} strokeWidth={5} />
            <ellipse cx={0} cy={3} rx={34} ry={6} strokeWidth={4} opacity={0.8} />
            <path d="M44 -4 Q52 -8 50 -14 Q44 -14 44 -8" strokeWidth={3.2} />
          </g>
        </Part>
      </g>
      {/* 落地歇着的果粒 */}
      <g stroke={OUTLINE} strokeWidth={2.2}>
        <circle cx={70} cy={224} r={6} fill={JUICE} />
        <circle cx={188} cy={222} r={6} fill="#E2432E" />
        <circle cx={92} cy={232} r={5.5} fill="#CFEFF6" />
      </g>
      <path d="M67 221 L73 227 M70 221 v6" stroke={OUTLINE} strokeWidth={1.4} />
      {/* 杯身（沉一点的墩） */}
      <path
        d="M88 148 L168 148 Q174 188 164 216 Q150 228 128 228 Q106 228 92 216 Q82 188 88 148 Z"
        fill={POD}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 果汁液面（安静沉淀） */}
      <path d="M92 184 Q128 192 164 184 Q166 202 158 212 Q146 224 128 224 Q110 224 98 212 Q90 202 92 184 Z" fill={JUICE} opacity={0.92} />
      <path d="M92 184 Q128 192 164 184" fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      <circle cx={118} cy={202} r={2.8} fill="#FFF1C9" opacity={0.9} />
      <path d="M96 156 Q94 172 96 178" fill="none" stroke="#A8E39B" strokeWidth={4} strokeLinecap="round" />
      {/* 藤蔓吸管（垂软贴杯壁） */}
      <path d="M156 146 Q170 156 172 172" fill="none" stroke={POD_DEEP} strokeWidth={6.5} strokeLinecap="round" />
      <path d="M156 146 Q170 156 172 172" fill="none" stroke="#A8E39B" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M172 174 q8 2 9 10 q-8 0 -9 -10 z" fill="#8CD97B" stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
      {/* 小手（垂在杯侧） */}
      <g transform={place(88, 196, 6)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={POD} rx={6.5} ry={10} />
        </Part>
      </g>
      <g transform={place(168, 196, -6)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={POD} rx={6.5} ry={10} />
        </Part>
      </g>
      {/* 根须小脚（收拢） */}
      <g transform={place(114, 230)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={POD} deep={POD_DEEP} rx={7} ry={4} lift={2} />
        </Part>
      </g>
      <g transform={place(142, 230)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={POD} deep={POD_DEEP} rx={7} ry={4} lift={2} />
        </Part>
      </g>
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={112} cx2={144} cy={166} r={9} mouthY={182} mouthW={12} expression={expression} base={eyes} />
        <Blush cx1={100} cx2={156} cy={178} />
      </g>
      {/* 头顶：笼盖盖严（平盖） */}
      <g transform={place(128, 146)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-42 0 Q-44 -12 -22 -16 Q0 -19 22 -16 Q44 -12 42 0 Q22 5 0 5 Q-22 5 -42 0 Z" fill={POD_DEEP} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M-26 -8 Q0 -14 26 -8" fill="none" stroke="#A8E39B" strokeWidth={2.6} strokeLinecap="round" />
          <path d="M0 -16 q-2 -6 2 -9" fill="none" stroke={POD_DEEP} strokeWidth={3.4} strokeLinecap="round" />
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

const citrusSlice: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={7} fill={JUICE} stroke={OUTLINE} strokeWidth={2} />
    <circle cx={0} cy={0} r={4.4} fill="#FFC66E" />
    <g stroke="#FFF1C9" strokeWidth={1.3} strokeLinecap="round">
      <path d="M0 0 V-6 M0 0 V6 M0 0 H-6 M0 0 H6 M0 0 L4.2 -4.2 M0 0 L-4.2 -4.2 M0 0 L4.2 4.2 M0 0 L-4.2 4.2" />
    </g>
  </g>
);
const bendyStraw: ParticleRenderer = () => (
  <g>
    <path d="M-6 9 L-6 -2 Q-6 -7 -1 -7 L7 -7 L7 -3 L-2 -3 L-2 9 Z" fill="#E2432E" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M-4.8 6 h1.6 M-4.8 2 h1.6 M-4.8 -1.4 h1.6 M0 -5.2 h5" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" />
  </g>
);
const blenderJar: ParticleRenderer = () => (
  <g>
    <rect x={-7} y={-9} width={14} height={3.2} rx={1.2} fill="#8E93A6" stroke={OUTLINE} strokeWidth={1.8} />
    <path d="M-6 -5.6 L6 -5.6 L5 8 Q0 10 -5 8 Z" fill={SEA} opacity={0.85} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M-5 1.5 Q0 3.4 5 1.5 L4.2 7.6 Q0 9.4 -4.2 7.6 Z" fill={JUICE} opacity={0.9} />
    <path d="M-2.6 5 L2.6 5 M0 3.4 L0 6.6" stroke="#5C6172" strokeWidth={1.6} strokeLinecap="round" />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.08,
    palette: { body: POD, deep: POD_DEEP, belly: CREAM, accent: JUICE, accent2: SEA },
    foodAnchor: { x: 128, y: 168 },
    shadowRx: 56,
  },
  // 手摇榨汁机：料斗 + 摇柄 + 出汁口接杯
  tool: () => (
    <g>
      <path d="M-14 -14 L14 -14 L10 -30 L-10 -30 Z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
      <path d="M-4 -14 L4 -14 L4 -8 L-4 -8 Z" fill="#5C6172" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
      <path d="M14 -26 L24 -34" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
      <circle cx={25} cy={-35} r={3.4} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.2} />
      <circle cx={0} cy={-34} r={5} fill={JUICE} stroke={OUTLINE} strokeWidth={2.6} />
      <path d="M0 -8 q0 3 0 4" stroke={JUICE} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M-6 0 L6 0 L5 -6 L-5 -6 Z" fill="#CFEFF6" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 196, y: 200 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.6,
    shapes: [citrusSlice, bendyStraw, blenderJar],
  },
  meta: {
    nameZh: "蜜壶草",
    elements: ["electric", "fire", "grass", "water"],
    family: "植物体",
    toolAnchor: { x: 196, y: 231 },
    nodeBudget: 255,
    lieNote: "盖上笼盖，藤蔓卷成圈垫着",
  },
};
