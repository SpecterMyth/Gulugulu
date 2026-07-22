// ---------------------------------------------------------------------------
// 冰海象 bowlrus — e3（ice+normal+water）· 鱼类水栖
// 剪影：胖锥形小海象坐姿，双獠牙=保龄球瓶纹（招牌），大胡子肉垫，
//       脚下小冰砖座（e3 平台件）。
// 睡姿（P3）：侧躺叠成一坨，獠牙搭肚上。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { FlipperArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const HIDE = "#C0A88E";
const DEEP = "#8F7355";
const CREAM = "#EAF7FF";
const ICE = "#8FD8E8";
const ICE_LIGHT = "#CFEFF6";

function Front({ palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e3 平台件：脚下小冰砖座 */}
      <g transform={place(128, 226)}>
        <path d="M-58 0 L58 0 L50 12 L-50 12 Z" fill={ICE_LIGHT} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
        <path d="M-30 0 L-26 12 M6 0 L8 12 M34 0 L38 12" stroke={ICE} strokeWidth={2.6} />
        <path d="M-44 4 l8 -2 M20 5 l9 -2" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
      </g>
      {/* 尾鳍（身后左侧探出一点） */}
      <g transform={place(80, 218)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-12 2 -18 10 Q-8 12 -2 8 Z M0 0 Q-14 -4 -20 0 Q-12 6 -2 4 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 胖锥形身体（海象坐姿） */}
      <path
        d="M78 220 Q84 158 108 128 Q120 114 128 114 Q136 114 148 128 Q172 158 178 220 Q128 234 78 220 Z"
        fill={HIDE}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 球道条纹肚（保龄球馆地板既视感） */}
      <path d="M104 176 Q128 168 152 176 L156 216 Q128 224 100 216 Z" fill={CREAM} opacity={0.95} />
      <g stroke={ICE} strokeWidth={2.4} opacity={0.85}>
        <path d="M112 180 L108 214 M128 178 L128 218 M144 180 L148 214" />
      </g>
      {/* 前鳍（撑地） */}
      <g transform={place(88, 196, 40)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={HIDE} len={22} mirror />
        </Part>
      </g>
      <g transform={place(168, 196, -40)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={HIDE} len={22} />
        </Part>
      </g>
      {/* 后鳍脚（从身前底部露出） */}
      <g transform={place(112, 230)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-8 0 Q-4 -6 2 -5 Q6 -4 6 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(144, 230)}>
        <Part name="legR" origin="50% -30%">
          <path d="M8 0 Q4 -6 -2 -5 Q-6 -4 -6 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 大胡子肉垫（口鼻区） */}
      <g>
        <ellipse cx={112} cy={158} rx={17} ry={13} fill={CREAM} stroke={OUTLINE} strokeWidth={4} />
        <ellipse cx={144} cy={158} rx={17} ry={13} fill={CREAM} stroke={OUTLINE} strokeWidth={4} />
        <g fill={DEEP}>
          <circle cx={106} cy={155} r={1.6} />
          <circle cx={114} cy={158} r={1.6} />
          <circle cx={108} cy={162} r={1.6} />
          <circle cx={142} cy={158} r={1.6} />
          <circle cx={150} cy={155} r={1.6} />
          <circle cx={148} cy={162} r={1.6} />
        </g>
      </g>
      {/* 保龄球瓶纹獠牙（招牌）：白牙 + 双红环 */}
      <g stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round">
        <path d="M112 168 Q110 186 114 196 Q118 198 120 196 Q122 184 120 168 Z" fill="#FFFFFF" />
        <path d="M144 168 Q146 186 142 196 Q138 198 136 196 Q134 184 136 168 Z" fill="#FFFFFF" />
      </g>
      <g stroke="#E2432E" strokeWidth={2.4} fill="none">
        <path d="M113 176 q4 1.5 7 0 M114 181 q3.5 1.5 6 0" />
        <path d="M136 176 q4 1.5 7 0 M136 181 q3.5 1.5 6 0" />
      </g>
      {/* 鼻梁 + 脸 */}
      <ellipse cx={128} cy={148} rx={9} ry={6.5} fill={DEEP} stroke={OUTLINE} strokeWidth={3} />
      <g className="part-face">
        <ExpFace cx1={110} cx2={146} cy={134} r={8.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={96} cx2={160} cy={148} />
      </g>
      {/* 头顶：一撮冰蓝呆毛 */}
      <g transform={place(128, 116)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-4 2 Q-8 -8 -2 -14 Q2 -8 1 -3 Q4 -10 8 -11 Q8 -3 3 2 Z" fill={ICE} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(196, 224)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：胖锥身前倾挪步，胡子肉垫朝前，獠牙垂下，冰砖随行。 */
function Side({ palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 冰砖座 */}
      <g transform={place(128, 226)}>
        <path d="M-54 0 L54 0 L46 12 L-46 12 Z" fill={ICE_LIGHT} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
        <path d="M-26 0 L-22 12 M12 0 L14 12" stroke={ICE} strokeWidth={2.6} />
        <path d="M-40 4 l8 -2 M24 5 l9 -2" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
      </g>
      {/* 尾鳍（身后） */}
      <g transform={place(84, 216)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-12 2 -18 10 Q-8 12 -2 8 Z M0 0 Q-14 -4 -20 0 Q-12 6 -2 4 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 远侧前鳍 */}
      <g transform={place(116, 200, 34)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={DEEP} len={20} mirror />
        </Part>
      </g>
      {/* 胖锥身（前倾） */}
      <path
        d="M84 220 Q90 158 118 128 Q130 114 140 120 Q154 130 162 158 Q174 190 172 220 Q128 234 84 220 Z"
        fill={HIDE}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 球道条纹肚（体前） */}
      <path d="M134 176 Q152 172 164 180 L166 214 Q146 222 128 216 Z" fill={CREAM} opacity={0.95} />
      <g stroke={ICE} strokeWidth={2.4} opacity={0.85}>
        <path d="M140 182 L138 212 M152 180 L154 214" />
      </g>
      {/* 后鳍脚（微露） */}
      <g transform={place(116, 230)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-8 0 Q-4 -6 2 -5 Q6 -4 6 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(142, 230)}>
        <Part name="legR" origin="50% -30%">
          <path d="M8 0 Q4 -6 -2 -5 Q-6 -4 -6 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 近侧前鳍（撑步） */}
      <g transform={place(146, 198, -36)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={HIDE} len={22} />
        </Part>
      </g>
      {/* 大胡子肉垫（朝前）+ 鼻梁 */}
      <ellipse cx={152} cy={152} rx={18} ry={14} fill={CREAM} stroke={OUTLINE} strokeWidth={4} />
      <g fill={DEEP}>
        <circle cx={146} cy={148} r={1.6} />
        <circle cx={156} cy={150} r={1.6} />
        <circle cx={150} cy={156} r={1.6} />
      </g>
      <ellipse cx={160} cy={140} rx={8} ry={6} fill={DEEP} stroke={OUTLINE} strokeWidth={3} />
      {/* 保龄球瓶纹獠牙（垂在肉垫前，微前弯） */}
      <g stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round">
        <path d="M146 162 Q142 180 149 192 Q155 195 158 190 Q161 176 157 162 Z" fill="#FFFFFF" />
      </g>
      <g stroke="#E2432E" strokeWidth={2.4} fill="none">
        <path d="M147 171 q5 2 9 0 M149 177 q4 2 7.5 0" />
      </g>
      {/* 脸（侧脸眯眯眼） */}
      <g className="part-face">
        <ExpSideFace cx={146} cy={130} r={8.5} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={134} cy={146} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：冰蓝呆毛 */}
      <g transform={place(134, 112)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-4 2 Q-8 -8 -2 -14 Q2 -8 1 -3 Q4 -10 8 -11 Q8 -3 3 2 Z" fill={ICE} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：在冰砖床上侧躺叠成一坨，獠牙搭在肚坡上，前鳍盖肚。 */
function Lie({ palette, slots = {}, eyes = "sleepy", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 冰砖床 */}
      <g transform={place(128, 227)}>
        <path d="M-64 0 L64 0 L56 11 L-56 11 Z" fill={ICE_LIGHT} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
        <path d="M-34 0 L-30 11 M10 0 L12 11 M40 0 L44 11" stroke={ICE} strokeWidth={2.6} />
      </g>
      {/* 尾鳍（左端叠着） */}
      <g transform={place(70, 216)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-12 0 -16 8 Q-7 11 -1 7 Z M0 -3 Q-13 -7 -18 -2 Q-10 4 -1 2 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 侧躺叠成一坨的身体（头端在右微抬） */}
      <path
        d="M64 222 Q62 198 92 190 Q130 180 164 192 Q186 200 184 218 Q182 228 160 228 Q100 234 64 222 Z"
        fill={HIDE}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 肚坡奶油条纹 */}
      <path d="M92 200 Q120 192 146 200 L144 222 Q112 228 90 220 Z" fill={CREAM} opacity={0.95} />
      <g stroke={ICE} strokeWidth={2.2} opacity={0.85}>
        <path d="M104 202 L102 220 M122 198 L122 224 M138 202 L140 220" />
      </g>
      {/* 后鳍脚（左端微露两片） */}
      <g transform={place(84, 226)}>
        <Part name="legL" origin="50% -30%">
          <path d="M-8 0 Q-4 -6 2 -5 Q6 -4 6 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(98, 229)}>
        <Part name="legR" origin="50% -30%">
          <path d="M8 0 Q4 -6 -2 -5 Q-6 -4 -6 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 远侧前鳍（垫在身下） */}
      <g transform={place(150, 222, 74)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={DEEP} len={16} mirror />
        </Part>
      </g>
      {/* 头（右端，胡子肉垫朝左倚在肚坡上） */}
      <g>
        <ellipse cx={146} cy={200} rx={15} ry={12} fill={CREAM} stroke={OUTLINE} strokeWidth={4} />
        <ellipse cx={172} cy={198} rx={15} ry={12} fill={CREAM} stroke={OUTLINE} strokeWidth={4} />
        <g fill={DEEP}>
          <circle cx={142} cy={197} r={1.5} />
          <circle cx={150} cy={200} r={1.5} />
          <circle cx={168} cy={200} r={1.5} />
          <circle cx={176} cy={197} r={1.5} />
        </g>
      </g>
      <ellipse cx={159} cy={188} rx={8.5} ry={6} fill={DEEP} stroke={OUTLINE} strokeWidth={3} />
      {/* 獠牙搭在肚坡上（朝左躺倒） */}
      <g stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round">
        <path d="M140 208 Q126 214 114 210 Q112 206 114 204 Q126 206 138 202 Z" fill="#FFFFFF" />
        <path d="M154 212 Q142 220 130 218 Q128 214 130 212 Q142 212 152 206 Z" fill="#FFFFFF" />
      </g>
      <g stroke="#E2432E" strokeWidth={2.2} fill="none">
        <path d="M122 210 q1.5 -3 0.5 -5 M136 216 q1.5 -3 0.5 -5" />
      </g>
      {/* 近侧前鳍（搭在肚皮上） */}
      <g transform={place(120, 204, -78)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={HIDE} len={18} />
        </Part>
      </g>
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={148} cx2={174} cy={182} r={7.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={138} cx2={184} cy={192} />
      </g>
      {/* 头顶：冰蓝呆毛（塌向一边） */}
      <g transform={place(178, 176)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-4 2 Q-6 -6 -1 -11 Q2 -6 1 -2 Q4 -8 7 -8 Q7 -2 3 2 Z" fill={ICE} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
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

// 保龄产物：球瓶 + 保龄球 + STRIKE 计分牌
const bowlingPin: ParticleRenderer = () => (
  <g>
    <path d="M-3 6 Q-5 0 -2.5 -3 Q-4 -6 -1.5 -7.5 Q0 -8.5 1.5 -7.5 Q4 -6 2.5 -3 Q5 0 3 6 Q0 8 -3 6 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
    <path d="M-2.2 -4 q2.2 1 4.4 0" stroke="#E2432E" strokeWidth={1.6} fill="none" strokeLinecap="round" />
    <path d="M-2.6 -1.5 q2.6 1.2 5.2 0" stroke="#E2432E" strokeWidth={1.6} fill="none" strokeLinecap="round" />
  </g>
);
const bowlingBall: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <circle cx={0} cy={0} r={8} fill="#2E3A6E" strokeWidth={2.2} />
    <g fill="#1B2450" stroke="none">
      <circle cx={-2} cy={-2} r={1.4} /><circle cx={2} cy={-2.5} r={1.4} /><circle cx={0.5} cy={1} r={1.4} />
    </g>
    <path d="M-5 -3 Q-3 -6 1 -6" fill="none" stroke="#8FA3D9" strokeWidth={1.6} strokeLinecap="round" />
  </g>
);
const strikeText: ParticleRenderer = (rand) => {
  const g = ["STRIKE!", "X", "SPARE"][Math.floor(rand() * 3)];
  return (
    <g>
      <rect x={-15} y={-8} width={30} height={16} rx={4} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.4} />
      <text x={0} y={4} fontSize={g.length > 3 ? 7 : 11} fontWeight={900} textAnchor="middle" fill="#FFFFFF" fontFamily="inherit">{g}</text>
    </g>
  );
};

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.2,
    palette: { body: HIDE, deep: DEEP, belly: CREAM, accent: ICE, accent2: "#2E7BD6" },
    eyes: "sleepy",
    foodAnchor: { x: 128, y: 166 },
    shadowRx: 60,
  },
  // 保龄球 + 双瓶：指孔球搁在小球架上
  tool: () => (
    <g>
      <path d="M-16 0 h30" stroke={DEEP} strokeWidth={4} strokeLinecap="round" />
      <circle cx={-4} cy={-14} r={13} fill="#2E7BD6" stroke={OUTLINE} strokeWidth={3.6} />
      <g fill="#1B5FB0">
        <circle cx={-8} cy={-18} r={1.8} />
        <circle cx={-3} cy={-20} r={1.8} />
        <circle cx={-1} cy={-15} r={1.8} />
      </g>
      <g transform="translate(14 0)">
        <path d="M-2.6 0 Q-4.5 -5 -2.2 -8 Q-3.6 -11 -1.4 -12.5 Q0 -13.5 1.4 -12.5 Q3.6 -11 2.2 -8 Q4.5 -5 2.6 0 Q0 1.6 -2.6 0 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
        <path d="M-1.8 -8.5 q1.8 1 3.6 0" stroke="#E2432E" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      </g>
    </g>
  ),
  workFx: {
    emitter: { x: 196, y: 208 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.6,
    shapes: [bowlingPin, bowlingBall, strikeText],
  },
  meta: {
    nameZh: "冰海象",
    elements: ["ice", "normal", "water"],
    family: "鱼类水栖",
    toolAnchor: { x: 196, y: 224 },
    nodeBudget: 170,
    lieNote: "侧躺叠成一坨，獠牙搭肚上",
  },
};
