// ---------------------------------------------------------------------------
// 焊花虫 weldbug — e2（electric+fire）· 昆虫多足
// 剪影：圆滚甲虫，背上两块焊接面罩式鞘翅（带观察窗），头顶折线天线。
// 睡姿（P3）：鞘翅撑地当小帐篷，天线耷拉。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm, StubLeg } from "../../parts/limbs";
import { SmallFlame } from "../../kits/fireKit";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BODY = "#F5A83B";
const SHELL = "#C23B1F";
const CREAM = "#FFE8D6";
const VOLT = "#FFD93B";
const GLASS = "#3E4356";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：屁股后的小焊花火苗（明显探出剪影左下） */}
      <g transform={place(68, 208, -52)}>
        <Part name="tail" origin="50% 100%">
          <SmallFlame scale={1.15} />
        </Part>
      </g>
      {/* 身体：大圆甲虫 */}
      <circle cx={128} cy={182} r={52} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 鞘翅=两块焊接面罩（深红壳 + 观察窗 + 铆钉），中缝在 x=128 */}
      <g>
        <path d="M128 112 Q74 118 70 172 Q100 170 128 163 Z" fill={SHELL} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
        <path d="M128 112 Q182 118 186 172 Q156 170 128 163 Z" fill={SHELL} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
        <path d="M128 112 L128 163" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
        {/* 观察窗（焊接玻璃）+ 高光 */}
        <g transform={place(97, 141, -14)}>
          <rect x={-11} y={-7} width={22} height={14} rx={4} fill={GLASS} stroke={OUTLINE} strokeWidth={3} />
          <path d="M-6 -2 l7 -3" stroke="#7FD1FF" strokeWidth={2.4} strokeLinecap="round" />
        </g>
        <g transform={place(159, 141, 14)}>
          <rect x={-11} y={-7} width={22} height={14} rx={4} fill={GLASS} stroke={OUTLINE} strokeWidth={3} />
          <path d="M-6 -2 l7 -3" stroke="#7FD1FF" strokeWidth={2.4} strokeLinecap="round" />
        </g>
        {/* 铆钉一排 */}
        <g fill={VOLT} stroke={OUTLINE} strokeWidth={2}>
          <circle cx={88} cy={162} r={2.8} />
          <circle cx={108} cy={159} r={2.8} />
          <circle cx={148} cy={159} r={2.8} />
          <circle cx={168} cy={162} r={2.8} />
        </g>
      </g>
      {/* 小手 */}
      <g transform={place(84, 194, 20)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={BODY} rx={7} ry={11} />
        </Part>
      </g>
      <g transform={place(172, 194, -20)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={BODY} rx={7} ry={11} />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(106, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={BODY} deep={SHELL} rx={8.5} ry={5} lift={8} />
        </Part>
      </g>
      <g transform={place(150, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={BODY} deep={SHELL} rx={8.5} ry={5} lift={8} />
        </Part>
      </g>
      {/* 肚皮补丁（脸的底色） */}
      <ellipse cx={128} cy={196} rx={33} ry={22} fill={CREAM} opacity={0.9} />
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={108} cx2={148} cy={186} r={10} mouthY={205} mouthW={15} expression={expression} base={eyes} />
        <Blush cx1={94} cx2={162} cy={199} />
      </g>
      {/* 头顶：折线天线 ×2，尖端小电星（探出剪影的电系签名） */}
      <g transform={place(128, 113)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" strokeLinejoin="miter">
            <path d="M-9 2 L-16 -12 L-10 -22" />
            <path d="M9 2 L16 -12 L10 -22" />
          </g>
          <g fill={VOLT} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round">
            <path d="M-10 -22 L-8 -27 L-6 -22 L-8 -17 Z" transform="rotate(-14 -8 -22)" />
            <path d="M10 -22 L12 -27 L14 -22 L12 -17 Z" transform="rotate(14 12 -22)" />
          </g>
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

/** 侧视（右向）：拱形鞘翅盖背 + 单窗 + 前脸，小脚迈步。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：焊花火苗（左后贴地喷） */}
      <g transform={place(80, 202, -64)}>
        <Part name="tail" origin="50% 100%">
          <SmallFlame scale={0.95} />
        </Part>
      </g>
      {/* 身体侧视（圆滚） */}
      <circle cx={132} cy={184} r={50} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 拱形鞘翅（覆盖背部 2/3，观察窗 + 铆钉 + 尾缘缝线） */}
      <path
        d="M86 178 Q84 122 136 118 Q178 122 182 162 Q160 170 132 172 Q104 174 86 178 Z"
        fill={SHELL}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M92 160 Q130 150 178 152" fill="none" stroke={OUTLINE} strokeWidth={2.6} opacity={0.4} />
      <g transform={place(140, 146, 6)}>
        <rect x={-11} y={-7} width={22} height={14} rx={4} fill={GLASS} stroke={OUTLINE} strokeWidth={3} />
        <path d="M-6 -2 l7 -3" stroke="#7FD1FF" strokeWidth={2.4} strokeLinecap="round" />
      </g>
      <g fill={VOLT} stroke={OUTLINE} strokeWidth={2}>
        <circle cx={104} cy={166} r={2.8} />
        <circle cx={166} cy={160} r={2.8} />
      </g>
      {/* 近侧小手 */}
      <g transform={place(148, 204, -16)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={BODY} rx={6.5} ry={10} stroke={4.5} />
        </Part>
      </g>
      <g transform={place(120, 208, 10)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={BODY} rx={6} ry={9} stroke={4.5} />
        </Part>
      </g>
      {/* 小脚（侧视迈步主角） */}
      <g transform={place(112, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={BODY} deep={SHELL} rx={8.5} ry={5} lift={8} />
        </Part>
      </g>
      <g transform={place(150, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={BODY} deep={SHELL} rx={8.5} ry={5} lift={8} />
        </Part>
      </g>
      {/* 前脸（奶油颊区 + 单眼） */}
      <ellipse cx={156} cy={196} rx={21} ry={16} fill={CREAM} opacity={0.92} />
      <g className="part-face">
        <ExpSideFace cx={154} cy={172} r={10} mouthX={164} mouthY={194} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={140} cy={192} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：单根折线天线（前倾） */}
      <g transform={place(152, 120)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 L8 -12 L3 -22" fill="none" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" strokeLinejoin="miter" />
          <path d="M3 -22 L5 -27 L7 -22 L5 -17 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：鞘翅撑地当小帐篷（A 形双壳），身体缩在帐下贴地，天线耷拉。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：熄成小火苗的焊灯（左侧地上） */}
      <g transform={place(66, 226, -20)}>
        <Part name="tail" origin="50% 100%">
          <SmallFlame scale={0.55} />
        </Part>
      </g>
      {/* 帐篷双壳（A 形斜立，招牌鞘翅再利用） */}
      <g stroke={OUTLINE} strokeLinejoin="round">
        <path d="M128 146 L62 224 Q94 232 128 228 Z" fill={SHELL} strokeWidth={5} />
        <path d="M128 146 L194 224 Q162 232 128 228 Z" fill={SHELL} strokeWidth={5} />
        <path d="M128 146 L128 228" stroke={OUTLINE} strokeWidth={3.4} opacity={0.5} />
      </g>
      <g transform={place(95, 196, -42)}>
        <rect x={-9} y={-6} width={18} height={12} rx={3.4} fill={GLASS} stroke={OUTLINE} strokeWidth={2.6} />
      </g>
      <g fill={VOLT} stroke={OUTLINE} strokeWidth={1.8}>
        <circle cx={76} cy={218} r={2.4} />
        <circle cx={180} cy={218} r={2.4} />
      </g>
      {/* 帐下身体（低扁，从帐口探出小脸） */}
      <ellipse cx={128} cy={216} rx={34} ry={15} fill={BODY} stroke={OUTLINE} strokeWidth={5} />
      <ellipse cx={128} cy={219} rx={22} ry={9} fill={CREAM} opacity={0.95} />
      {/* 小手收拢身前 */}
      <g transform={place(102, 226, -10)}>
        <Part name="armL" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={8} ry={4.5} fill={BODY} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(154, 226, 10)}>
        <Part name="armR" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={8} ry={4.5} fill={BODY} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 脸（sleep 闭眼 + 小圆嘴） */}
      <g className="part-face">
        <ExpFace cx1={116} cx2={140} cy={212} r={7} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <circle cx={128} cy={221} r={1.8} fill={OUTLINE} opacity={0.85} />
      </g>
      {/* 头顶：耷拉的双天线（从帐顶垂下） */}
      <g transform={place(128, 146)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={OUTLINE} strokeWidth={3.4} strokeLinecap="round">
            <path d="M-3 0 q-12 4 -15 15" />
            <path d="M3 0 q12 4 15 15" />
          </g>
          <circle cx={-18} cy={16} r={2.6} fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} />
          <circle cx={18} cy={16} r={2.6} fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} />
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

const hexNut: ParticleRenderer = () => (
  <g>
    <path d="M-6 -3.5 L0 -7 L6 -3.5 L6 3.5 L0 7 L-6 3.5 Z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <circle cx={0} cy={0} r={2.4} fill="#5C6172" />
  </g>
);
// 拧出来的螺栓：六角头 + 带螺纹的杆（斜纹）
const boltScrew: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <path d="M-5 -8 L0 -11 L5 -8 L5 -3 L0 0 L-5 -3 Z" fill="#8E93A6" strokeWidth={2} />
    <rect x={-3.5} y={-1} width={7} height={11} rx={0.6} fill="#C8CCD8" strokeWidth={2} />
    <g stroke="#5C6172" strokeWidth={1.2} strokeLinecap="round">
      <path d="M-3.5 1.4 l7 2 M-3.5 4.4 l7 2 M-3.5 7.4 l7 2" />
    </g>
  </g>
);
// 焊工护目镜：两片深色镜片 + 头带
const weldGoggles: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeWidth={2}>
    <path d="M-11 -2 Q0 -6 11 -2" fill="none" strokeWidth={2.4} strokeLinecap="round" />
    <circle cx={-5} cy={2} r={4.6} fill={GLASS} />
    <circle cx={5} cy={2} r={4.6} fill={GLASS} />
    <path d="M-0.6 2 h1.2" fill="none" />
    <g fill="#7FD1FF" stroke="none">
      <circle cx={-6.2} cy={0.6} r={1.3} />
      <circle cx={3.8} cy={0.6} r={1.3} />
    </g>
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.12,
    palette: { body: BODY, deep: SHELL, belly: CREAM, accent: VOLT, accent2: "#E85D3A" },
    foodAnchor: { x: 132, y: 200 },
    shadowRx: 56,
  },
  // 电焊枪：手柄 + 横置枪身 + 斜嘴喷蓝焰 + 电缆卷
  tool: () => (
    <g>
      <path d="M-1 0 q-13 5 -10 15" fill="none" stroke="#C23B1F" strokeWidth={3} strokeLinecap="round" />
      <path d="M-4 0 L4 0 L3 -22 L-3 -22 Z" fill="#3E4356" stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />
      <rect x={-7} y={-34} width={22} height={12} rx={3.5} fill="#8E93A6" stroke={OUTLINE} strokeWidth={3.5} />
      <path d="M15 -30 L25 -37" stroke={OUTLINE} strokeWidth={5} strokeLinecap="round" />
      <path d="M25 -37 q7 -2 9 -9 q2 7 -2.5 11 q-4.5 3.5 -7 -1 z" fill="#7FD1FF" stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
      <circle cx={29} cy={-42} r={1.7} fill="#FFFFFF" />
      <path d="M-11 -26 h5 M-11 -30 h5" stroke="#FFD93B" strokeWidth={2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 214, y: 192 },
    baseAngle: -Math.PI / 3,
    cone: 0.5,
    shapes: [hexNut, boltScrew, weldGoggles],
  },
  meta: {
    nameZh: "焊花虫",
    elements: ["electric", "fire"],
    family: "昆虫多足",
    toolAnchor: { x: 188, y: 231 },
    nodeBudget: 130,
    lieNote: "鞘翅撑地当小帐篷，天线耷拉",
  },
};
