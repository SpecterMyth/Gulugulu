// ---------------------------------------------------------------------------
// 汽雾螈 steamalotl — e2（fire+water）· 鱼类水栖
// 剪影：粉白六角螈，六根外鳃=噗噗冒汽的蒸汽管（招牌），宽头笑脸，小尾鳍。
// 睡姿（P3）：外鳃拢到身前当抱枕趴睡。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const SKIN = "#F8C8D0";
const DEEP = "#E8919E";
const CREAM = "#FFF0F0";
const STEAM = "#FFFFFF";
const SEA = "#9BDCFF";

/** 一根外鳃蒸汽管（pivot=根部，向外上伸；蒸汽只画顶排，控节点数） */
function GillPipe({ steam = false }: { steam?: boolean }) {
  return (
    <g>
      <path d="M0 3 Q-14 0 -20 -10" fill="none" stroke={DEEP} strokeWidth={9} strokeLinecap="round" />
      <circle cx={-21} cy={-11} r={5.5} fill={"#E85D3A"} stroke={OUTLINE} strokeWidth={2.8} />
      {steam && <path d="M-24 -18 q-2 -4 1 -7" fill="none" stroke={STEAM} strokeWidth={3} strokeLinecap="round" opacity={0.95} />}
    </g>
  );
}

function Front({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾鳍（右下探出，半透粉鳍） */}
      <g transform={place(178, 214, 18)}>
        <Part name="tail" origin="10% 80%">
          <path d="M0 0 Q22 -6 28 -24 Q14 -22 6 -12 Q2 -6 0 0 Z" fill={SKIN} opacity={0.92} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M8 -6 Q16 -12 20 -18" fill="none" stroke={DEEP} strokeWidth={2.6} strokeLinecap="round" />
        </Part>
      </g>
      {/* 六根外鳃（左三右三，先画根部被头压住；蒸汽只在顶排） */}
      <g>
        <g transform={place(90, 132, 18)}><GillPipe steam /></g>
        <g transform={place(84, 152, 2)}><GillPipe /></g>
        <g transform={place(88, 172, -16)}><GillPipe /></g>
        <g transform={`${place(166, 132, -18)} scale(-1 1)`}><GillPipe steam /></g>
        <g transform={`${place(172, 152, -2)} scale(-1 1)`}><GillPipe /></g>
        <g transform={`${place(168, 172, 16)} scale(-1 1)`}><GillPipe /></g>
      </g>
      {/* 身体（矮墩） */}
      <ellipse cx={128} cy={202} rx={44} ry={28} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={128} cy={212} rx={26} ry={13} fill={CREAM} opacity={0.95} />
      {/* 宽头（六角螈签名大圆头，压住鳃根与身体上缘） */}
      <ellipse cx={128} cy={152} rx={48} ry={40} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      {/* 小手 */}
      <g transform={place(94, 206, 20)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6} ry={9} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={place(162, 206, -20)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6} ry={9} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(110, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={7.5} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={7.5} ry={4.5} lift={4} />
        </Part>
      </g>
      {/* 脸：六角螈标志性眯眯笑 */}
      <g className="part-face">
        <ExpFace cx1={108} cx2={148} cy={148} r={9} mouthY={166} mouthW={16} expression={expression} base={eyes} />
        <Blush cx1={96} cx2={160} cy={162} />
      </g>
      {/* 头顶：一小撮水花呆毛 */}
      <g transform={place(128, 112)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-4 -6 -1 -12 Q2 -7 2 -3 Q5 -9 4 -13 Q9 -8 6 -1 Q3 4 0 2 Z" fill={SEA} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(190, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：宽头朝前扭扭走，近侧三根外鳃向后扬，尾鳍在后摆。 */
function Side({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾鳍（身后上翘） */}
      <g transform={place(72, 204, 6)}>
        <Part name="tail" origin="90% 80%">
          <path d="M0 0 Q-22 -6 -28 -26 Q-12 -24 -5 -13 Q-1 -6 0 0 Z" fill={SKIN} opacity={0.92} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M-9 -8 Q-17 -14 -21 -20" fill="none" stroke={DEEP} strokeWidth={2.6} strokeLinecap="round" />
        </Part>
      </g>
      {/* 身体（低趴矮墩） */}
      <ellipse cx={112} cy={202} rx={40} ry={26} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      {/* 近侧三根外鳃（向后扬） */}
      <g>
        <g transform={place(116, 126, 42)}><GillPipe steam /></g>
        <g transform={place(106, 146, 14)}><GillPipe /></g>
        <g transform={place(110, 168, -16)}><GillPipe /></g>
      </g>
      {/* 远侧手 */}
      <g transform={place(126, 210, 12)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8.5} fill={DEEP} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 小脚（迈步） */}
      <g transform={place(118, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={7.5} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(148, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={7.5} ry={4.5} lift={4} />
        </Part>
      </g>
      {/* 宽头（朝前，压住鳃根与身体前缘） */}
      <ellipse cx={150} cy={156} rx={44} ry={38} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      {/* 近侧手（前伸小短手） */}
      <g transform={place(152, 212, -16)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={9} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 脸（六角螈眯眯笑侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={164} cy={150} r={10} mouthX={174} mouthY={170} mouthW={14} expression={expression} base={eyes} />
        <ellipse cx={150} cy={168} rx={8} ry={5.5} fill="#FBA9B8" opacity={0.85} />
      </g>
      {/* 头顶：水花呆毛 */}
      <g transform={place(152, 118)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-4 -6 -1 -12 Q2 -7 2 -3 Q5 -9 4 -13 Q9 -8 6 -1 Q3 4 0 2 Z" fill={SEA} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：六根外鳃拢到身前叠成抱枕，脸埋着睡，顶鳃还噗小汽。 */
function Lie({ palette, slots = {}, eyes = "happy", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾鳍（贴地摊平） */}
      <g transform={place(184, 222, 26)}>
        <Part name="tail" origin="10% 80%">
          <path d="M0 0 Q20 -4 26 -20 Q12 -18 5 -10 Q1 -5 0 0 Z" fill={SKIN} opacity={0.92} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 身体（低趴） */}
      <ellipse cx={146} cy={210} rx={44} ry={20} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      {/* 外鳃抱枕（拢到身前，卷进怀里） */}
      <g>
        <g transform={place(96, 214, -36)}><GillPipe /></g>
        <g transform={place(90, 224, -72)}><GillPipe /></g>
        <g transform={place(104, 228, -104)}><GillPipe /></g>
        <g transform={`${place(120, 224, 56)} scale(-1 1)`}><GillPipe steam /></g>
        <g transform={`${place(130, 228, 92)} scale(-1 1)`}><GillPipe /></g>
      </g>
      {/* 小脚（后蹬） */}
      <g transform={place(168, 226)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={7} ry={4.5} lift={3} />
        </Part>
      </g>
      <g transform={place(184, 230)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={7} ry={4.5} lift={3} />
        </Part>
      </g>
      {/* 宽头（趴在鳃枕上） */}
      <ellipse cx={106} cy={184} rx={44} ry={36} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      {/* 小手抱枕 */}
      <g transform={place(86, 216, 24)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8} fill={SKIN} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(132, 220, -24)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8} fill={SKIN} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={90} cx2={124} cy={182} r={9} mouthY={200} mouthW={13} expression={expression} base={eyes} />
        <Blush cx1={78} cx2={136} cy={196} />
      </g>
      {/* 头顶：水花呆毛（耷拉） */}
      <g transform={place(104, 150)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-4 -5 -1 -11 Q2 -6 2 -3 Q5 -8 4 -12 Q8 -7 5 -1 Q3 3 0 2 Z" fill={SEA} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
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

const steamPuff: ParticleRenderer = () => (
  <g>
    <circle cx={-3} cy={1} r={4.5} fill={STEAM} opacity={0.92} stroke={SEA} strokeWidth={2} />
    <circle cx={3.5} cy={-2} r={3.4} fill={STEAM} opacity={0.92} stroke={SEA} strokeWidth={2} />
  </g>
);
const dropBit: ParticleRenderer = () => (
  <path d="M0 -7 q5.5 6.5 5.5 10.5 a5.5 5.5 0 0 1 -11 0 q0 -4 5.5 -10.5 z" fill={SEA} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.15,
    palette: { body: SKIN, deep: DEEP, belly: CREAM, accent: "#E85D3A", accent2: SEA },
    eyes: "happy",
    foodAnchor: { x: 130, y: 166 },
    shadowRx: 56,
  },
  // 蒸汽熨斗：熨斗体 + 手柄 + 底板喷汽
  tool: () => (
    <g>
      <path d="M-18 -4 Q-18 -18 -2 -18 L14 -18 Q20 -18 20 -10 L20 -4 Q0 2 -18 -4 Z" fill={SEA} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      <path d="M-8 -18 Q-8 -28 2 -28 L10 -28 Q14 -28 14 -22 L14 -18" fill="none" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
      <path d="M-14 -2 h30" stroke="#5C7FB5" strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={12} cy={-12} r={2.2} fill="#E85D3A" stroke={OUTLINE} strokeWidth={1.6} />
      <path d="M-16 4 q-2 4 1 7 M-6 5 q-2 4 1 7 M4 5 q-2 4 1 7" fill="none" stroke={STEAM} strokeWidth={2.6} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 192, y: 214 },
    baseAngle: -Math.PI / 2.4,
    cone: 0.55,
    shapes: [steamPuff, dropBit, steamPuff],
  },
  meta: {
    nameZh: "汽雾螈",
    elements: ["fire", "water"],
    family: "鱼类水栖",
    toolAnchor: { x: 190, y: 231 },
    nodeBudget: 130,
    lieNote: "外鳃拢到身前当抱枕趴睡",
  },
};
