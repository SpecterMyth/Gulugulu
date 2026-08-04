// ---------------------------------------------------------------------------
// 风车鼹 windmole — e3（electric+grass+normal）· 双足小人
// 剪影：圆滚鼹鼠，背着小风车背包（叶片缓慢旋转），护目镜推在头顶，大挖掘爪。
// 睡姿（P3）：挖浅坑趴进去，只露背和风车。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const FUR = "#A08A73";
const DEEP = "#6E5B49";
const CREAM = "#F2E7D5";
const VOLT = "#FFD93B";
const LEAF = "#8CD97B";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e3 背饰：风车背包（杆 + 旋转叶片=part-orbit），探出左上剪影 */}
      <g>
        <path d="M84 176 L74 120" stroke={DEEP} strokeWidth={6} strokeLinecap="round" />
        <path d="M84 176 L74 120" stroke="#B98A4E" strokeWidth={3} strokeLinecap="round" />
        <g transform={place(74, 118)}>
          <g className="part-orbit">
            <g stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round">
              <path d="M0 -3 Q-4 -22 4 -30 Q12 -20 3 -3 Z" fill={VOLT} />
              <path d="M3 0 Q22 -4 30 4 Q20 12 3 3 Z" fill={LEAF} />
              <path d="M0 3 Q4 22 -4 30 Q-12 20 -3 3 Z" fill={VOLT} />
              <path d="M-3 0 Q-22 4 -30 -4 Q-20 -12 -3 -3 Z" fill={LEAF} />
            </g>
            <circle cx={0} cy={0} r={4.5} fill={CREAM} stroke={OUTLINE} strokeWidth={3} />
          </g>
        </g>
      </g>
      {/* 尾：粉色小细尾（右下探出） */}
      <g transform={place(172, 212)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 0 Q14 -2 18 -12" fill="none" stroke="#F5917B" strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 身体（浑圆一体=头身合一） */}
      <circle cx={128} cy={178} r={54} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={128} cy={202} rx={31} ry={19} fill={CREAM} opacity={0.95} />
      {/* 大挖掘爪（双手，签名件） */}
      <g transform={place(82, 190, 24)}>
        <Part name="armL" origin="50% 8%">
          <path d="M-9 0 Q-13 14 -4 20 Q6 24 10 14 Q12 8 8 0 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M-4 18 v5 M2 19 v5 M7 16 v5" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(174, 190, -24)}>
        <Part name="armR" origin="50% 8%">
          <path d="M9 0 Q13 14 4 20 Q-6 24 -10 14 Q-12 8 -8 0 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M4 18 v5 M-2 19 v5 M-7 16 v5" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(110, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={FUR} deep={DEEP} rx={8.5} ry={5} lift={7} />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={FUR} deep={DEEP} rx={8.5} ry={5} lift={7} />
        </Part>
      </g>
      {/* 脸：眯眯眼鼹鼠 + 大粉鼻 */}
      <g className="part-face">
        <ExpFace cx1={110} cx2={146} cy={172} r={9} mouthY={196} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={128} cy={188} rx={9} ry={6.5} fill="#F5917B" stroke={OUTLINE} strokeWidth={3.4} />
        <path d="M96 186 h-8 M98 192 h-7 M160 186 h8 M158 192 h7" stroke={OUTLINE} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
        <Blush cx1={99} cx2={157} cy={192} />
      </g>
      {/* 头顶：护目镜推在额头（headtop 呼吸摇） */}
      <g transform={place(128, 134)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-30 4 Q0 -6 30 4" fill="none" stroke={DEEP} strokeWidth={7} strokeLinecap="round" />
          <g fill="#B0E5F0" stroke={OUTLINE} strokeWidth={3.6}>
            <circle cx={-13} cy={-2} r={9} />
            <circle cx={13} cy={-2} r={9} />
          </g>
          <path d="M-16 -5 l4 -3 M10 -5 l4 -3" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
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

/** 侧视（右向）：球身鼹鼠，风车背包在背后，大爪在前迈步。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 风车背包（背后左上，orbit 旋转） */}
      <g>
        <path d="M96 178 L84 122" stroke={DEEP} strokeWidth={6} strokeLinecap="round" />
        <path d="M96 178 L84 122" stroke="#B98A4E" strokeWidth={3} strokeLinecap="round" />
        <g transform={place(84, 120)}>
          <g className="part-orbit">
            <g stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round">
              <path d="M0 -3 Q-4 -20 4 -27 Q11 -18 3 -3 Z" fill={VOLT} />
              <path d="M3 0 Q20 -4 27 4 Q18 11 3 3 Z" fill={LEAF} />
              <path d="M0 3 Q4 20 -4 27 Q-11 18 -3 3 Z" fill={VOLT} />
              <path d="M-3 0 Q-20 4 -27 -4 Q-18 -11 -3 -3 Z" fill={LEAF} />
            </g>
            <circle cx={0} cy={0} r={4} fill={CREAM} stroke={OUTLINE} strokeWidth={2.8} />
          </g>
        </g>
      </g>
      {/* 尾：粉细尾（左后） */}
      <g transform={place(80, 208)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-14 -2 -18 -12" fill="none" stroke="#F5917B" strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 球身（头身一体，鼻尖朝右） */}
      <circle cx={130} cy={180} r={52} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 前脸奶油区 + 大粉鼻朝右 */}
      <path d="M150 154 Q182 160 186 190 Q180 216 150 218 Q136 186 150 154 Z" fill={CREAM} opacity={0.95} />
      <ellipse cx={184} cy={186} rx={9} ry={7} fill="#F5917B" stroke={OUTLINE} strokeWidth={3.4} />
      <path d="M176 176 l8 -3 M178 196 l8 2" stroke={OUTLINE} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
      {/* 大挖掘爪（近侧一只在前，摆动主角之一） */}
      <g transform={place(152, 200, -18)}>
        <Part name="armR" origin="50% 8%">
          <path d="M-8 0 Q-11 12 -3 18 Q7 21 10 12 Q12 6 8 0 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M-2 16 v5 M3 17 v5 M8 14 v5" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(118, 206, 10)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6.5} ry={9} fill={FUR} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(110, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={FUR} deep={DEEP} rx={8.5} ry={5} lift={7} />
        </Part>
      </g>
      <g transform={place(150, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={FUR} deep={DEEP} rx={8.5} ry={5} lift={7} />
        </Part>
      </g>
      {/* 脸（单眯眼） */}
      <g className="part-face">
        <ExpSideFace cx={158} cy={166} r={8.5} mouthX={172} mouthY={196} mouthW={10} expression={expression} base={eyes} />
        <ellipse cx={146} cy={192} rx={7} ry={4.5} fill="#F5917B" opacity={0.5} />
      </g>
      {/* 头顶：护目镜（推在头顶前坡） */}
      <g transform={place(140, 134)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-24 6 Q0 -6 24 4" fill="none" stroke={DEEP} strokeWidth={6.5} strokeLinecap="round" />
          <circle cx={4} cy={-3} r={9} fill="#B0E5F0" stroke={OUTLINE} strokeWidth={3.4} />
          <path d="M0 -6 l4 -3" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：挖浅坑趴进去——只露圆背、风车和小尾巴，头埋坑里微露侧脸。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 风车立在坑旁（orbit 慢转，睡时被 CSS 减速） */}
      <g>
        <path d="M186 226 L180 164" stroke={DEEP} strokeWidth={6} strokeLinecap="round" />
        <path d="M186 226 L180 164" stroke="#B98A4E" strokeWidth={3} strokeLinecap="round" />
        <g transform={place(180, 162)}>
          <g className="part-orbit">
            <g stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
              <path d="M0 -3 Q-3 -17 4 -23 Q10 -15 3 -3 Z" fill={VOLT} />
              <path d="M3 0 Q17 -3 23 4 Q15 10 3 3 Z" fill={LEAF} />
              <path d="M0 3 Q3 17 -4 23 Q-10 15 -3 3 Z" fill={VOLT} />
              <path d="M-3 0 Q-17 3 -23 -4 Q-15 -10 -3 -3 Z" fill={LEAF} />
            </g>
            <circle cx={0} cy={0} r={3.6} fill={CREAM} stroke={OUTLINE} strokeWidth={2.6} />
          </g>
        </g>
      </g>
      {/* 浅坑土沿 */}
      <path d="M52 228 Q76 216 104 220 M150 222 Q170 218 196 228" fill="none" stroke="#8A6B4F" strokeWidth={6} strokeLinecap="round" />
      <g fill="#8A6B4F" opacity={0.8}>
        <circle cx={70} cy={224} r={3.4} />
        <circle cx={162} cy={222} r={3} />
      </g>
      {/* 圆背拱出坑面 */}
      <path d="M78 228 Q80 178 126 176 Q170 178 172 228 Z" fill={FUR} stroke={OUTLINE} strokeWidth={6} strokeLinejoin="round" />
      {/* 背纹 + 微露的护目镜带 */}
      <path d="M94 202 Q126 192 158 202" fill="none" stroke={DEEP} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
      {/* 尾：粉尾从背后翘出 */}
      <g transform={place(174, 214)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 0 Q12 -4 14 -14" fill="none" stroke="#F5917B" strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 微露侧脸（坑沿左侧：闭眼 + 鼻尖埋土） */}
      <g className="part-face">
        <path d="M78 226 Q70 212 82 204 Q94 200 100 210 Q104 220 96 227 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        <ExpFace cx1={88} cx2={88} cy={214} r={5.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={76} cy={222} rx={6} ry={4.5} fill="#F5917B" stroke={OUTLINE} strokeWidth={2.6} />
      </g>
      {/* 小手扒坑沿 */}
      <g transform={place(106, 226, -6)}>
        <Part name="armL" origin="50% 50%">
          <path d="M-7 0 Q-7 -7 0 -7 Q6 -7 6 -1 M-4 0 v3 M0 0 v4 M4 0 v3" fill="none" stroke={CREAM} strokeWidth={3.6} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(146, 226, 6)}>
        <Part name="armR" origin="50% 50%">
          <path d="M7 0 Q7 -7 0 -7 Q-6 -7 -6 -1 M4 0 v3 M0 0 v4 M-4 0 v3" fill="none" stroke={CREAM} strokeWidth={3.6} strokeLinecap="round" />
        </Part>
      </g>
      {/* 头顶：一撮背毛（headtop 呼吸摇） */}
      <g transform={place(126, 176)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-4 2 Q-6 -5 -1 -9 Q2 -4 1 0 Q4 -6 7 -6 Q6 -1 2 2 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
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

// 挖矿产物：镐子 + 钻石矿 + 泥块（Minecraft 挖到钻石）
const pickaxe: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round" strokeLinecap="round">
    <path d="M-7 8 L5 -6" stroke="#B98A4E" strokeWidth={3} />
    <path d="M-2 -9 Q5 -8 10 -3 M-2 -9 Q-8 -6 -11 0" fill="none" stroke="#8E93A6" strokeWidth={3} />
  </g>
);
const gemOre: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round" strokeWidth={2}>
    <path d="M0 -8 L7 -2 L0 9 L-7 -2 Z" fill="#5CE1E6" />
    <path d="M-7 -2 H7 M0 -8 L-3 -2 M0 -8 L3 -2" fill="none" strokeWidth={1.4} stroke="#2E9BA0" />
  </g>
);
const dirtClod: ParticleRenderer = () => (
  <g>
    <path d="M-6 -3 Q-2 -8 3 -6 Q8 -5 7 1 Q6 7 0 7 Q-7 6 -6 -3 Z" fill="#8A5A3B" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <circle cx={-1} cy={0} r={1.1} fill="#6B4529" />
    <circle cx={3} cy={2} r={1} fill="#6B4529" />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.12,
    palette: { body: FUR, deep: DEEP, belly: CREAM, accent: VOLT, accent2: LEAF },
    foodAnchor: { x: 132, y: 196 },
    shadowRx: 58,
  },
  // 手摇发电机：木箱 + 摇柄 + 小灯泡（亮）
  tool: () => (
    <g>
      <rect x={-16} y={-26} width={32} height={26} rx={4} fill="#B98A4E" stroke={OUTLINE} strokeWidth={4} />
      <path d="M-16 -18 h32" stroke={DEEP} strokeWidth={2.4} />
      <path d="M16 -20 L27 -30" stroke={OUTLINE} strokeWidth={4.5} strokeLinecap="round" />
      <circle cx={28} cy={-31} r={4} fill="#E85D3A" stroke={OUTLINE} strokeWidth={2.6} />
      <circle cx={-6} cy={-34} r={6} fill={VOLT} stroke={OUTLINE} strokeWidth={3} />
      <path d="M-6 -28 v3" stroke={OUTLINE} strokeWidth={2.4} />
      <path d="M-13 -41 l3 3 M-6 -44 v4 M1 -41 l-3 3" stroke={VOLT} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 192, y: 200 },
    baseAngle: -Math.PI / 2.4,
    cone: 0.55,
    shapes: [pickaxe, gemOre, dirtClod],
  },
  meta: {
    nameZh: "风车鼹",
    elements: ["electric", "grass", "normal"],
    family: "双足小人",
    toolAnchor: { x: 192, y: 231 },
    nodeBudget: 170,
    lieNote: "挖浅坑趴进去，只露背和风车",
  },
};
