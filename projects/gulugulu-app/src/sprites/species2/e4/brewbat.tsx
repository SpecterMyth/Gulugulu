// ---------------------------------------------------------------------------
// 炼药蝠 brewbat — e4（fire+grass+ice+water）· 漂浮体
// 剪影：圆耳小蝙蝠悬停，翅膜内衬四色药剂分层纹（招牌），
//       药水泡轨道（e4 环绕件 orbit）。炼金夜班学徒。
// 睡姿（P3）：用翅膀裹成墨西哥卷饼平放。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BAT = "#7E6BB8";
const BAT_DEEP = "#5C4A94";
const BELLY = "#EFE8FF";
const FIRE = "#FFB03A";
const LEAF = "#8CD97B";
const ICE = "#CFEFF6";
const SEA = "#9BDCFF";

/** 一片翅膜（内衬四色药剂条带；mirror 得右翅） */
function PotionWing({ mirror = false }: { mirror?: boolean }) {
  return (
    <g transform={mirror ? "scale(-1 1)" : undefined}>
      <path
        d="M0 0 Q-30 -14 -46 -2 Q-50 12 -38 18 L-30 12 Q-26 22 -16 22 L-12 14 Q-8 22 0 18 Z"
        fill={BAT_DEEP}
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      <g opacity={0.9}>
        <path d="M-42 0 Q-30 -6 -18 -4 L-16 2 Q-30 0 -40 6 Z" fill={FIRE} />
        <path d="M-38 8 Q-26 4 -14 6 L-13 10 Q-24 8 -34 12 Z" fill={LEAF} />
        <path d="M-30 14 Q-20 12 -10 13 L-9 16 Q-18 15 -26 17 Z" fill={ICE} />
      </g>
    </g>
  );
}

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e4 环绕件：药水泡轨道（part-orbit 慢转，四色小瓶泡） */}
      <g transform={place(128, 158)}>
        <g className="part-orbit">
          <g stroke={OUTLINE} strokeWidth={2}>
            <circle cx={-58} cy={0} r={5} fill={FIRE} />
            <circle cx={58} cy={0} r={5} fill={LEAF} />
            <circle cx={0} cy={-19} r={5} fill={ICE} />
            <circle cx={0} cy={19} r={5} fill={SEA} />
          </g>
          <circle cx={-56} cy={-2} r={1.4} fill="#FFFFFF" />
          <circle cx={2} cy={-21} r={1.4} fill="#FFFFFF" />
        </g>
      </g>
      {/* 双翅（armL/R：药剂条带翅膜） */}
      <g transform={place(94, 148, 6)}>
        <Part name="armL" origin="90% 10%">
          <PotionWing />
        </Part>
      </g>
      <g transform={place(162, 148, -6)}>
        <Part name="armR" origin="10% 10%">
          <PotionWing mirror />
        </Part>
      </g>
      {/* 尾：小尾膜（下方三角） */}
      <g transform={place(128, 206)}>
        <Part name="tail" origin="50% 0%">
          <path d="M-8 0 Q0 12 8 0 Q0 4 -8 0 Z" fill={BAT_DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 圆身（头身一体的毛球蝙蝠） */}
      <circle cx={128} cy={158} r={48} fill={BAT} stroke={OUTLINE} strokeWidth={6} />
      {/* 奶白肚 */}
      <ellipse cx={128} cy={182} rx={26} ry={18} fill={BELLY} opacity={0.95} />
      {/* 小勾脚（悬停垂足） */}
      <g transform={place(114, 208)}>
        <Part name="legL" origin="50% -40%">
          <path d="M0 -6 q0 5 -4 7" fill="none" stroke={BAT_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(142, 208)}>
        <Part name="legR" origin="50% -40%">
          <path d="M0 -6 q0 5 4 7" fill="none" stroke={BAT_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 大圆耳（内耳药剂色） */}
      <g fill={BAT} stroke={OUTLINE} strokeWidth={5}>
        <circle cx={94} cy={116} r={17} />
        <circle cx={162} cy={116} r={17} />
      </g>
      <circle cx={94} cy={116} r={8} fill={FIRE} opacity={0.75} />
      <circle cx={162} cy={116} r={8} fill={ICE} opacity={0.85} />
      {/* 脸（小尖牙可爱款） */}
      <g className="part-face">
        <ExpFace cx1={112} cx2={144} cy={150} r={9.5} mouthY={170} mouthW={13} expression={expression} base={eyes} />
        <path d="M119 173 L119 168 L124 173 Z M137 173 L137 168 L132 173 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
        <Blush cx1={100} cx2={156} cy={164} />
      </g>
      {/* 头顶：一撮呆毛 + 小药滴（headtop 呼吸摇） */}
      <g transform={place(128, 110)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-4 -6 -1 -12 Q3 -7 2 -2 Q5 -8 8 -8 Q7 -2 3 2 Z" fill={BAT_DEEP} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
          <path d="M12 -8 q3 3.5 3 5.5 a3 3 0 0 1 -6 0 q0 -2 3 -5.5 z" fill={LEAF} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
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

/** 侧视（右向）：悬停前飞，远翅上扬近翅下压，圆耳一前一后，药泡随行。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 药水泡轨道（随行） */}
      <g transform={place(128, 158)}>
        <g className="part-orbit">
          <g stroke={OUTLINE} strokeWidth={2}>
            <circle cx={-54} cy={0} r={5} fill={FIRE} />
            <circle cx={54} cy={0} r={5} fill={LEAF} />
            <circle cx={0} cy={-18} r={5} fill={ICE} />
          </g>
          <circle cx={-52} cy={-2} r={1.4} fill="#FFFFFF" />
        </g>
      </g>
      {/* 远翅（上扬后掠） */}
      <g transform={place(108, 130, 28)}>
        <Part name="armL" origin="90% 10%">
          <PotionWing />
        </Part>
      </g>
      {/* 尾：小尾膜（身后） */}
      <g transform={place(102, 196, 26)}>
        <Part name="tail" origin="50% 0%">
          <path d="M-8 0 Q0 12 8 0 Q0 4 -8 0 Z" fill={BAT_DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 圆身（前倾飞行） */}
      <circle cx={130} cy={162} r={46} fill={BAT} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={142} cy={184} rx={22} ry={16} fill={BELLY} opacity={0.95} />
      {/* 小勾脚（悬停垂足） */}
      <g transform={place(118, 210)}>
        <Part name="legL" origin="50% -40%">
          <path d="M0 -6 q0 5 -4 7" fill="none" stroke={BAT_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(140, 210)}>
        <Part name="legR" origin="50% -40%">
          <path d="M0 -6 q0 5 4 7" fill="none" stroke={BAT_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 近翅（下压前扑） */}
      <g transform={place(146, 172, -18)}>
        <Part name="armR" origin="10% 10%">
          <PotionWing mirror />
        </Part>
      </g>
      {/* 大圆耳（前后两只） */}
      <g fill={BAT} stroke={OUTLINE} strokeWidth={5}>
        <circle cx={108} cy={114} r={15} />
        <circle cx={152} cy={106} r={16} />
      </g>
      <circle cx={108} cy={114} r={7} fill={FIRE} opacity={0.75} />
      <circle cx={152} cy={106} r={7.5} fill={ICE} opacity={0.85} />
      {/* 脸（侧脸 + 小尖牙） */}
      <g className="part-face">
        <ExpSideFace cx={152} cy={150} r={9.5} mouthX={160} mouthY={170} mouthW={11} expression={expression} base={eyes} />
        <path d="M152 172 L152 167 L157 172 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
        <ellipse cx={138} cy={164} rx={7} ry={4.5} fill="#D0A8E0" opacity={0.8} />
      </g>
      {/* 头顶：呆毛 + 药滴（迎风） */}
      <g transform={place(132, 104, -8)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-5 -5 -2 -11 Q2 -6 1 -2 Q4 -8 7 -7 Q6 -2 3 2 Z" fill={BAT_DEEP} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
          <path d="M11 -7 q3 3.5 3 5.5 a3 3 0 0 1 -6 0 q0 -2 3 -5.5 z" fill={LEAF} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：双翅把自己裹成一只墨西哥卷饼平放，头从卷口探出，药剂条纹在卷皮上。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 卷饼本体（翅膜裹身横放） */}
      <path
        d="M66 206 Q64 184 92 180 L156 178 Q172 180 174 200 Q174 222 152 228 L92 230 Q66 228 66 206 Z"
        fill={BAT_DEEP}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 卷皮上的药剂分层条纹 */}
      <g opacity={0.9}>
        <path d="M76 194 Q118 188 162 190 L162 196 Q118 194 76 200 Z" fill={FIRE} />
        <path d="M74 206 Q118 200 164 202 L164 208 Q118 206 74 212 Z" fill={LEAF} />
        <path d="M78 218 Q118 213 160 215 L160 220 Q118 218 78 224 Z" fill={ICE} />
      </g>
      {/* 卷缝线（翅缘） */}
      <path d="M84 184 Q108 204 92 228 M132 180 Q156 202 140 228" fill="none" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" opacity={0.5} />
      {/* 翅拇指小钩（卷口两处） */}
      <g transform={place(100, 184, 24)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 L-6 -8 L-2 -10" fill="none" stroke={BAT_DEEP} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(140, 182, -20)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 L6 -8 L2 -10" fill="none" stroke={BAT_DEEP} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        </Part>
      </g>
      {/* 尾膜 + 勾脚（卷尾端露出） */}
      <g transform={place(64, 216, -70)}>
        <Part name="tail" origin="50% 0%">
          <path d="M-7 0 Q0 10 7 0 Q0 3.5 -7 0 Z" fill={BAT_DEEP} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(74, 228)}>
        <Part name="legL" origin="50% -40%">
          <path d="M0 -5 q0 4 -4 6" fill="none" stroke={BAT_DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(86, 231)}>
        <Part name="legR" origin="50% -40%">
          <path d="M0 -5 q0 4 4 6" fill="none" stroke={BAT_DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 静置的药泡两粒（卷上） */}
      <g stroke={OUTLINE} strokeWidth={2}>
        <circle cx={104} cy={172} r={4.5} fill={SEA} />
        <circle cx={126} cy={168} r={4} fill={ICE} />
      </g>
      {/* 头（从卷口探出）+ 圆耳 */}
      <g fill={BAT} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={158} cy={166} r={13} />
        <circle cx={192} cy={162} r={13.5} />
      </g>
      <circle cx={158} cy={166} r={6} fill={FIRE} opacity={0.75} />
      <circle cx={192} cy={162} r={6.5} fill={ICE} opacity={0.85} />
      <circle cx={176} cy={194} r={27} fill={BAT} stroke={OUTLINE} strokeWidth={5.5} />
      {/* 脸（睡 + 小尖牙） */}
      <g className="part-face">
        <ExpFace cx1={166} cx2={188} cy={190} r={7.5} mouthY={206} mouthW={9} expression={expression} base={eyes} />
        <path d="M170 208 L170 204 L174 208 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
        <Blush cx1={158} cx2={196} cy={202} />
      </g>
      {/* 头顶：呆毛（塌） */}
      <g transform={place(176, 168, 10)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-4 -4 -1 -9 Q2 -5 1 -1 Q4 -6 6 -5 Q5 -1 2 2 Z" fill={BAT_DEEP} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
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

// 药水瓶：软木塞 + 液面
const potionVial: ParticleRenderer = () => (
  <g>
    <rect x={-3.4} y={-9} width={6.8} height={3.4} rx={1} fill="#B98A4E" stroke={OUTLINE} strokeWidth={1.8} />
    <path d="M-3.4 -6 L3.4 -6 L3.4 5 Q3.4 9 0 9 Q-3.4 9 -3.4 5 Z" fill="#E4EEF5" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M-3.4 1 L3.4 1 L3.4 5 Q3.4 9 0 9 Q-3.4 9 -3.4 5 Z" fill={LEAF} opacity={0.9} />
    <circle cx={-1.4} cy={4} r={1} fill="#FFFFFF" opacity={0.7} />
  </g>
);
// 锥形瓶：冒泡的烧瓶
const flask: ParticleRenderer = () => (
  <g>
    <path d="M-2 -8 L2 -8 L2 -3 L7 7 Q8 9 5 9 L-5 9 Q-8 9 -7 7 L-2 -3 Z" fill="#E4EEF5" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M-5.4 3 L5.4 3 L7 7 Q8 9 5 9 L-5 9 Q-8 9 -7 7 Z" fill={SEA} opacity={0.9} />
    <path d="M-2.6 -8 h5.2" stroke={OUTLINE} strokeWidth={1.6} strokeLinecap="round" />
    <g fill="#FFFFFF" opacity={0.85} stroke={OUTLINE} strokeWidth={0.9}>
      <circle cx={-1.5} cy={5.5} r={1.1} />
      <circle cx={2} cy={6.6} r={0.9} />
    </g>
  </g>
);
// 魔法书：翻开的书 + 符文
const spellbook: ParticleRenderer = () => (
  <g>
    <path d="M0 -5 Q-5 -7 -9 -5 L-9 6 Q-5 4 0 6 Q5 4 9 6 L9 -5 Q5 -7 0 -5 Z" fill={BAT} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M-7.6 -4 Q-4 -5.5 -0.7 -4 L-0.7 4.6 Q-4 3.2 -7.6 4.6 Z" fill={BELLY} />
    <path d="M7.6 -4 Q4 -5.5 0.7 -4 L0.7 4.6 Q4 3.2 7.6 4.6 Z" fill={BELLY} />
    <path d="M0 -5 V6" stroke={OUTLINE} strokeWidth={1.6} />
    <path d="M-5.2 -1 L-3.6 1 L-5.2 3 M4.4 -1 L2.8 1 L4.4 3" fill="none" stroke={FIRE} strokeWidth={1.4} strokeLinecap="round" />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.08,
    palette: { body: BAT, deep: BAT_DEEP, belly: BELLY, accent: LEAF, accent2: ICE },
    floating: true,
    shadowRx: 46,
    foodAnchor: { x: 128, y: 170 },
  },
  // 炼金蒸馏瓶：圆底瓶 + 弯管 + 接收小瓶，冒着彩泡
  tool: () => (
    <g>
      <path d="M-14 0 Q-20 -4 -20 -12 Q-20 -22 -10 -24 L-10 -32 L-4 -32 L-4 -24 Q6 -22 6 -12 Q6 -4 0 0 Q-7 2 -14 0 Z" fill={ICE} opacity={0.95} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <path d="M-16 -10 Q-7 -14 2 -10 L2 -6 Q-7 -3 -16 -6 Z" fill={LEAF} opacity={0.9} />
      <path d="M-4 -30 L10 -38 L18 -30" fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
      <path d="M14 -26 L22 -26 L21 -14 Q18 -12 15 -14 Z" fill="#EAF7FF" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
      <path d="M16 -22 Q18 -24 20 -22 L20 -16 Q18 -15 16 -16 Z" fill={FIRE} opacity={0.9} />
      <circle cx={-10} cy={-16} r={1.8} fill="#FFFFFF" />
    </g>
  ),
  workFx: {
    emitter: { x: 196, y: 194 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.6,
    shapes: [potionVial, flask, spellbook],
  },
  meta: {
    nameZh: "炼药蝠",
    elements: ["fire", "grass", "ice", "water"],
    family: "漂浮体",
    toolAnchor: { x: 192, y: 226 },
    nodeBudget: 255,
    lieNote: "用翅膀裹成墨西哥卷饼平放",
  },
};
