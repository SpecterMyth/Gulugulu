// ---------------------------------------------------------------------------
// 暖包豚 toastybara — e3（fire+grass+normal）· 四足兽
// 剪影：方砖体型水豚（矩形圆角=招牌），头顶吐司帽，尾巴=麦穗，格纹餐巾搭背。
// 睡姿（P3）：整只摊平，像刚出炉的长面包。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const FUR = "#C9A86A";
const DEEP = "#A8845B";
const CREAM = "#FFF4DC";
const TOAST = "#E8B04B";
const TOAST_EDGE = "#B98A4E";
const WHEAT = "#E2C25C";

function Front({ palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：麦穗（左侧探出） */}
      <g transform={place(72, 190, -30)}>
        <Part name="tail" origin="50% 100%">
          <path d="M0 4 V-16" stroke={DEEP} strokeWidth={3.4} strokeLinecap="round" />
          <g fill={WHEAT} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round">
            <ellipse cx={-4} cy={-14} rx={3.4} ry={6} transform="rotate(24 -4 -14)" />
            <ellipse cx={4} cy={-14} rx={3.4} ry={6} transform="rotate(-24 4 -14)" />
            <ellipse cx={-3.4} cy={-22} rx={3.2} ry={5.5} transform="rotate(24 -3.4 -22)" />
            <ellipse cx={3.4} cy={-22} rx={3.2} ry={5.5} transform="rotate(-24 3.4 -22)" />
            <ellipse cx={0} cy={-28} rx={3} ry={5.5} />
          </g>
        </Part>
      </g>
      {/* 身体：方砖圆角矩形（水豚签名体型） */}
      <rect x={70} y={148} width={116} height={82} rx={30} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* e3 装饰：格纹小餐巾搭背（左肩斜搭） */}
      <g transform={place(88, 150, -8)}>
        <path d="M-14 0 L18 0 L18 30 L-14 30 Z" fill="#FFF6F0" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <g stroke="#E2432E" strokeWidth={2.2} opacity={0.85}>
          <path d="M-14 8 h32 M-14 18 h32 M-6 0 v30 M6 0 v30" />
        </g>
      </g>
      {/* 奶油口鼻区（方吻） */}
      <rect x={96} y={176} width={64} height={44} rx={20} fill={CREAM} opacity={0.95} />
      {/* 小手（贴身侧） */}
      <g transform={place(80, 196, 14)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={9} rx={6.5} ry={10} fill={FUR} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={place(176, 196, -14)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={9} rx={6.5} ry={10} fill={FUR} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(102, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={FUR} deep={DEEP} rx={9} ry={5} lift={6} />
        </Part>
      </g>
      <g transform={place(154, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={FUR} deep={DEEP} rx={9} ry={5} lift={6} />
        </Part>
      </g>
      {/* 小圆耳 */}
      <g fill={DEEP} stroke={OUTLINE} strokeWidth={4}>
        <circle cx={88} cy={152} r={8} />
        <circle cx={168} cy={152} r={8} />
      </g>
      {/* 脸：淡定眯眯眼 + 方鼻 */}
      <g className="part-face">
        <ExpFace cx1={106} cx2={150} cy={172} r={8.5} mouthY={198} mouthW={12} expression={expression} base={eyes} />
        <path d="M120 186 Q128 182 136 186 Q136 192 128 192 Q120 192 120 186 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        <Blush cx1={96} cx2={160} cy={186} />
      </g>
      {/* 头顶：吐司帽（一片斜戴的吐司，headtop 呼吸摇） */}
      <g transform={place(128, 148)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(-10)">
            <path
              d="M-20 0 L-20 -14 Q-20 -22 -12 -22 Q-9 -28 -2 -26 Q2 -30 8 -27 Q16 -28 16 -20 Q20 -18 20 -12 L20 0 Z"
              fill={TOAST}
              stroke={OUTLINE}
              strokeWidth={4}
              strokeLinejoin="round"
            />
            <path d="M-14 -4 L-14 -12 Q-14 -17 -8 -17 Q-5 -21 0 -19 Q3 -22 8 -20 Q13 -20 13 -15 L14 -4 Z" fill="#FFF1C9" opacity={0.9} />
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

/** 侧视（右向）：方砖体整块侧行，方吻朝前，吐司帽前倾，麦穗尾在后。 */
function Side({ palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：麦穗（身后斜出） */}
      <g transform={place(70, 190, -42)}>
        <Part name="tail" origin="50% 100%">
          <path d="M0 4 V-14" stroke={DEEP} strokeWidth={3.4} strokeLinecap="round" />
          <g fill={WHEAT} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round">
            <ellipse cx={-4} cy={-13} rx={3.2} ry={5.5} transform="rotate(24 -4 -13)" />
            <ellipse cx={4} cy={-13} rx={3.2} ry={5.5} transform="rotate(-24 4 -13)" />
            <ellipse cx={0} cy={-20} rx={3} ry={5.5} />
          </g>
        </Part>
      </g>
      {/* 远侧前后腿（深色，先画） */}
      <g transform={place(96, 230)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={DEEP} deep={DEEP} rx={8.5} ry={5} lift={6} />
        </Part>
      </g>
      <g transform={place(148, 230)}>
        <Part name="armL" origin="50% -30%">
          <StubLeg color={DEEP} deep={DEEP} rx={8.5} ry={5} lift={6} />
        </Part>
      </g>
      {/* 身体：方砖圆角矩形（侧视整块） */}
      <rect x={74} y={150} width={110} height={80} rx={28} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 格纹餐巾搭背 */}
      <g transform={place(96, 150, -6)}>
        <path d="M-14 0 L16 0 L16 28 L-14 28 Z" fill="#FFF6F0" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        <g stroke="#E2432E" strokeWidth={2.2} opacity={0.85}>
          <path d="M-14 8 h30 M-14 18 h30 M-6 0 v28 M6 0 v28" />
        </g>
      </g>
      {/* 方吻（探出体前） */}
      <rect x={158} y={174} width={40} height={40} rx={15} fill={CREAM} stroke={OUTLINE} strokeWidth={5} />
      {/* 近侧前后腿（迈步） */}
      <g transform={place(112, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={FUR} deep={DEEP} rx={9} ry={5} lift={6} />
        </Part>
      </g>
      <g transform={place(164, 231)}>
        <Part name="armR" origin="50% -30%">
          <StubLeg color={FUR} deep={DEEP} rx={9} ry={5} lift={6} />
        </Part>
      </g>
      {/* 小圆耳（前后两只） */}
      <g fill={DEEP} stroke={OUTLINE} strokeWidth={4}>
        <circle cx={126} cy={148} r={7} />
        <circle cx={152} cy={150} r={8} />
      </g>
      {/* 脸：眯眯单眼 + 方鼻 + 淡定嘴 */}
      <g className="part-face">
        <ExpSideFace cx={150} cy={172} r={8.5} expression={expression} base={eyes} withMouth={false} />
        <path d="M176 186 Q184 182 192 186 Q192 192 184 192 Q176 192 176 186 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        <path d="M182 200 q6 4 12 0" fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
        <ellipse cx={142} cy={190} rx={7} ry={4.5} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 头顶：吐司帽（前倾） */}
      <g transform={place(140, 146)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(-12)">
            <path
              d="M-18 0 L-18 -13 Q-18 -20 -11 -20 Q-8 -26 -2 -24 Q2 -28 7 -25 Q14 -26 14 -18 Q18 -16 18 -11 L18 0 Z"
              fill={TOAST}
              stroke={OUTLINE}
              strokeWidth={4}
              strokeLinejoin="round"
            />
            <path d="M-12 -4 L-12 -11 Q-12 -15 -7 -15 Q-4 -19 0 -17 Q3 -20 7 -18 Q11 -18 11 -13 L12 -4 Z" fill="#FFF1C9" opacity={0.9} />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：整只摊平成刚出炉的长面包，冒热气，帽子歪到耳边，餐巾当小被子。 */
function Lie({ palette, slots = {}, eyes = "sleepy", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：麦穗（塌在地上） */}
      <g transform={place(50, 216, -86)}>
        <Part name="tail" origin="50% 100%">
          <path d="M0 4 V-12" stroke={DEEP} strokeWidth={3.2} strokeLinecap="round" />
          <g fill={WHEAT} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round">
            <ellipse cx={-3.5} cy={-11} rx={3} ry={5} transform="rotate(24 -3.5 -11)" />
            <ellipse cx={3.5} cy={-11} rx={3} ry={5} transform="rotate(-24 3.5 -11)" />
            <ellipse cx={0} cy={-17} rx={2.8} ry={5} />
          </g>
        </Part>
      </g>
      {/* 身体：摊平的长面包 */}
      <rect x={52} y={176} width={148} height={56} rx={26} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 烘烤纹：顶部光泽 + 两道割口 */}
      <path d="M66 190 Q128 178 186 190" fill="none" stroke={CREAM} strokeWidth={6} strokeLinecap="round" opacity={0.8} />
      <path d="M96 184 q10 -4 20 0 M136 183 q10 -4 20 0" fill="none" stroke={TOAST_EDGE} strokeWidth={2.6} strokeLinecap="round" opacity={0.7} />
      {/* 刚出炉热气（两缕，暖色可见） */}
      <g fill="none" stroke="#DBBE8E" strokeLinecap="round" opacity={0.95}>
        <path d="M84 168 q-4 -8 1 -14" strokeWidth={4.5} />
        <path d="M112 162 q4 -9 -1 -16" strokeWidth={4} />
      </g>
      {/* 格纹餐巾当小被子（搭背中段） */}
      <g transform={place(104, 176, -4)}>
        <path d="M-16 0 L16 0 L16 26 L-16 26 Z" fill="#FFF6F0" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        <g stroke="#E2432E" strokeWidth={2.2} opacity={0.85}>
          <path d="M-16 8 h32 M-16 18 h32 M-6 0 v26 M6 0 v26" />
        </g>
      </g>
      {/* 四只脚尖从面包底下露出 */}
      <g transform={place(78, 233)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={-2} rx={7} ry={4} fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} />
        </Part>
      </g>
      <g transform={place(102, 233)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={-2} rx={7} ry={4} fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} />
        </Part>
      </g>
      <g transform={place(152, 233)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={-2} rx={7} ry={4} fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} />
        </Part>
      </g>
      <g transform={place(176, 233)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={-2} rx={7} ry={4} fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} />
        </Part>
      </g>
      {/* 小圆耳 */}
      <g fill={DEEP} stroke={OUTLINE} strokeWidth={4}>
        <circle cx={118} cy={180} r={7} />
        <circle cx={176} cy={180} r={7} />
      </g>
      {/* 脸（右段，睡） */}
      <g className="part-face">
        <ExpFace cx1={128} cx2={166} cy={198} r={8} mouthY={218} mouthW={11} expression={expression} base={eyes} />
        <path d="M140 208 Q147 204 154 208 Q154 214 147 214 Q140 214 140 208 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        <Blush cx1={118} cx2={176} cy={210} />
      </g>
      {/* 头顶：吐司帽歪到耳边 */}
      <g transform={place(196, 186)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="rotate(26)">
            <path
              d="M-15 0 L-15 -11 Q-15 -17 -9 -17 Q-7 -22 -2 -20 Q2 -23 6 -21 Q12 -21 12 -15 Q15 -13 15 -9 L15 0 Z"
              fill={TOAST}
              stroke={OUTLINE}
              strokeWidth={3.6}
              strokeLinejoin="round"
            />
            <path d="M-10 -4 L-10 -9 Q-10 -12 -6 -12 Q-3 -16 0 -14 Q3 -16 6 -14 Q9 -14 9 -10 L10 -4 Z" fill="#FFF1C9" opacity={0.9} />
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

const toastBit: ParticleRenderer = () => (
  <g>
    <path d="M-6 -5 Q-6 -8 -3 -8 Q-1 -10 1 -9 Q4 -10 5 -7 Q7 -6 7 -4 L7 5 L-6 5 Z" fill={TOAST} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M-3 -3 L4 -3 L4 2 L-3 2 Z" fill="#FFF1C9" opacity={0.9} />
  </g>
);
const wheatBit: ParticleRenderer = () => (
  <g fill={WHEAT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round">
    <ellipse cx={0} cy={-3} rx={2.6} ry={4.5} />
    <ellipse cx={-3} cy={2} rx={2.4} ry={4} transform="rotate(20 -3 2)" />
    <ellipse cx={3} cy={2} rx={2.4} ry={4} transform="rotate(-20 3 2)" />
  </g>
);
const emberBit: ParticleRenderer = () => (
  <path d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill="#FFB03A" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.28,
    palette: { body: FUR, deep: DEEP, belly: CREAM, accent: TOAST, accent2: "#8CD97B" },
    eyes: "sleepy",
    foodAnchor: { x: 130, y: 196 },
    shadowRx: 62,
  },
  // 烤面包机：圆角机身 + 两片弹起的吐司 + 拨杆
  tool: () => (
    <g>
      <path d="M-18 0 L18 0 L18 -20 Q18 -26 12 -26 L-12 -26 Q-18 -26 -18 -20 Z" fill="#E2432E" stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      <path d="M-10 -26 L-10 -38 Q-10 -43 -5 -43 Q-1 -45 1 -43 L2 -26 Z" fill={TOAST} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M5 -26 L5 -34 Q5 -39 10 -39 Q13 -40 14 -37 L14 -26 Z" fill={TOAST_EDGE} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M-13 -8 h9" stroke="#FFF1C9" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M21 -16 h4" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 196, y: 192 },
    baseAngle: -Math.PI / 2.2,
    cone: 0.55,
    shapes: [toastBit, wheatBit, emberBit],
  },
  meta: {
    nameZh: "暖包豚",
    elements: ["fire", "grass", "normal"],
    family: "四足兽",
    toolAnchor: { x: 196, y: 231 },
    nodeBudget: 170,
    lieNote: "整只摊平，像刚出炉的长面包",
  },
};
