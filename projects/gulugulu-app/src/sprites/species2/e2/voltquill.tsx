// ---------------------------------------------------------------------------
// 电叶猬 voltquill — e2（electric+grass）· 四足兽
// 剪影：低趴小刺猬，背上一圈蓄电叶片刺（叶尖带静电星），奶油小脸尖吻。
// 睡姿（P3）：卷成一颗微微发光的叶球。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const FUR = "#C9A86A";
const LEAF = "#57B84C";
const LEAF_DEEP = "#3B8F33";
const CREAM = "#FFF4DC";
const VOLT = "#FFD93B";

/** 一片背刺叶（pivot=叶根，向上生长） */
function SpikeLeaf({ s = 1, color = LEAF }: { s?: number; color?: string }) {
  return (
    <path
      d={`M0 0 Q${-7 * s} ${-14 * s} 0 ${-24 * s} Q${8 * s} ${-13 * s} 0 0 Z`}
      fill={color}
      stroke={OUTLINE}
      strokeWidth={4}
      strokeLinejoin="round"
    />
  );
}

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小叶尾（探出左侧剪影） */}
      <g transform={place(70, 208, -40)}>
        <Part name="tail" origin="50% 100%">
          <SpikeLeaf s={0.8} color={LEAF_DEEP} />
        </Part>
      </g>
      {/* 背刺叶圈：沿背弧一排（先画，被身体压住叶根） */}
      <g>
        <g transform={place(76, 182, -64)}><SpikeLeaf s={1.05} color={LEAF_DEEP} /></g>
        <g transform={place(86, 166, -46)}><SpikeLeaf s={1.2} /></g>
        <g transform={place(102, 154, -26)}><SpikeLeaf s={1.3} color={LEAF_DEEP} /></g>
        <g transform={place(122, 148, -6)}><SpikeLeaf s={1.35} /></g>
        <g transform={place(142, 150, 14)}><SpikeLeaf s={1.3} color={LEAF_DEEP} /></g>
        <g transform={place(160, 160, 34)}><SpikeLeaf s={1.2} /></g>
        <g transform={place(174, 174, 54)}><SpikeLeaf s={1.05} color={LEAF_DEEP} /></g>
        {/* 叶尖静电星 */}
        <g fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round">
          <path d="M122 116 l2.6 5 l5 2.6 l-5 2.6 l-2.6 5 l-2.6 -5 l-5 -2.6 l5 -2.6 z" />
          <path d="M84 152 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 z" />
          <path d="M168 156 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 z" />
        </g>
      </g>
      {/* 身体（低趴椭圆） */}
      <ellipse cx={128} cy={194} rx={52} ry={36} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 奶油脸区 + 尖吻 */}
      <path d="M92 176 Q128 158 164 176 Q170 206 128 214 Q86 206 92 176 Z" fill={CREAM} opacity={0.95} />
      {/* 小手 */}
      <g transform={place(88, 202, 18)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={9} rx={6.5} ry={10} fill={FUR} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={place(168, 202, -18)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={9} rx={6.5} ry={10} fill={FUR} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(108, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={FUR} deep={"#A8845B"} rx={8} ry={5} lift={7} />
        </Part>
      </g>
      <g transform={place(148, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={FUR} deep={"#A8845B"} rx={8} ry={5} lift={7} />
        </Part>
      </g>
      {/* 脸：圆眼 + 尖吻小鼻 */}
      <g className="part-face">
        <ExpFace cx1={110} cx2={146} cy={186} r={9.5} mouthY={206} mouthW={12} expression={expression} base={eyes} />
        <ellipse cx={128} cy={201} rx={7} ry={5} fill="#8A5A3B" stroke={OUTLINE} strokeWidth={3} />
        <Blush cx1={97} cx2={159} cy={198} />
      </g>
      {/* 头顶：一株小嫩芽（草系签名） */}
      <g transform={place(128, 146)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 q-1 -8 0 -12" fill="none" stroke={LEAF_DEEP} strokeWidth={3.4} strokeLinecap="round" />
          <path d="M0 -10 q-8 -2 -9 -10 q9 0 9 10 z" fill={LEAF} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
          <path d="M0 -10 q8 -2 9 -10 q-9 0 -9 10 z" fill={LEAF} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
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

/** 侧视（右向）：背刺叶沿背弧一排，尖吻朝右，小脚迈步。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小叶尾（左后探出） */}
      <g transform={place(66, 202, -44)}>
        <Part name="tail" origin="50% 100%">
          <SpikeLeaf s={0.85} color={LEAF_DEEP} />
        </Part>
      </g>
      {/* 背刺叶（沿背弧向后倾斜一排） */}
      <g>
        <g transform={place(80, 178, -58)}><SpikeLeaf s={1.05} color={LEAF_DEEP} /></g>
        <g transform={place(94, 160, -44)}><SpikeLeaf s={1.2} /></g>
        <g transform={place(114, 150, -30)}><SpikeLeaf s={1.3} color={LEAF_DEEP} /></g>
        <g transform={place(136, 146, -16)}><SpikeLeaf s={1.3} /></g>
        <g transform={place(156, 150, -2)}><SpikeLeaf s={1.2} color={LEAF_DEEP} /></g>
        <g fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round">
          <path d="M120 112 l2.4 4.6 l4.6 2.4 l-4.6 2.4 l-2.4 4.6 l-2.4 -4.6 l-4.6 -2.4 l4.6 -2.4 z" />
          <path d="M158 122 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 z" />
        </g>
      </g>
      {/* 身体（低趴，右端尖吻） */}
      <path
        d="M78 200 Q76 162 116 154 Q158 148 178 172 Q192 186 186 200 Q180 214 150 220 Q104 226 84 214 Q76 208 78 200 Z"
        fill={FUR}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 奶油前脸 + 鼻头 */}
      <path d="M148 168 Q182 168 188 194 Q182 214 152 216 Q138 192 148 168 Z" fill={CREAM} opacity={0.95} />
      <ellipse cx={186} cy={192} rx={6.5} ry={5} fill="#8A5A3B" stroke={OUTLINE} strokeWidth={3} />
      {/* 近侧小手 */}
      <g transform={place(146, 208, -14)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6} ry={9} fill={FUR} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={place(120, 212, 8)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={5.5} ry={8} fill={FUR} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 小脚（迈步主角） */}
      <g transform={place(104, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={FUR} deep={"#A8845B"} rx={8} ry={5} lift={7} />
        </Part>
      </g>
      <g transform={place(148, 231)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={FUR} deep={"#A8845B"} rx={8} ry={5} lift={7} />
        </Part>
      </g>
      {/* 脸（单眼） */}
      <g className="part-face">
        <ExpSideFace cx={158} cy={178} r={9.5} mouthX={172} mouthY={198} mouthW={11} expression={expression} base={eyes} />
        <ellipse cx={146} cy={196} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：小嫩芽（前倾） */}
      <g transform={place(150, 152)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 q-1 -7 1 -11" fill="none" stroke={LEAF_DEEP} strokeWidth={3.2} strokeLinecap="round" />
          <path d="M1 -9 q-8 -2 -9 -9 q8 0 9 9 z" fill={LEAF} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：卷成一颗微微发光的叶球——背刺围成球壳，小脸从球缝露出。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：小叶尾贴地（左侧） */}
      <g transform={place(70, 224, -80)}>
        <Part name="tail" origin="50% 100%">
          <SpikeLeaf s={0.7} color={LEAF_DEEP} />
        </Part>
      </g>
      {/* 叶球本体（圆球贴地） */}
      <circle cx={128} cy={192} r={42} fill={FUR} stroke={OUTLINE} strokeWidth={6} />
      {/* 环球背刺叶（球壳一圈，向外放射） */}
      <g>
        <g transform={place(92, 172, -64)}><SpikeLeaf s={0.95} color={LEAF_DEEP} /></g>
        <g transform={place(106, 158, -38)}><SpikeLeaf s={1.05} /></g>
        <g transform={place(128, 152, -8)}><SpikeLeaf s={1.1} color={LEAF_DEEP} /></g>
        <g transform={place(150, 158, 24)}><SpikeLeaf s={1.05} /></g>
        <g transform={place(164, 172, 52)}><SpikeLeaf s={0.95} color={LEAF_DEEP} /></g>
        <g transform={place(172, 192, 78)}><SpikeLeaf s={0.85} /></g>
        <g transform={place(84, 192, -78)}><SpikeLeaf s={0.85} /></g>
      </g>
      {/* 发光微芒（睡时静电微光） */}
      <g fill={VOLT} opacity={0.75}>
        <path d="M96 156 l1.6 3.2 l3.2 1.6 l-3.2 1.6 l-1.6 3.2 l-1.6 -3.2 l-3.2 -1.6 l3.2 -1.6 z" />
        <path d="M162 160 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" />
      </g>
      {/* 球缝小脸（下前方，蜷睡） */}
      <ellipse cx={128} cy={210} rx={26} ry={14} fill={CREAM} opacity={0.95} />
      <g className="part-face">
        <ExpFace cx1={116} cx2={140} cy={206} r={7} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={128} cy={216} rx={5} ry={3.4} fill="#8A5A3B" stroke={OUTLINE} strokeWidth={2.4} />
      </g>
      {/* 小手抱在脸旁 */}
      <g transform={place(104, 222, -12)}>
        <Part name="armL" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={7.5} ry={4.5} fill={FUR} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(152, 222, 12)}>
        <Part name="armR" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={7.5} ry={4.5} fill={FUR} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 头顶：嫩芽耷在球顶 */}
      <g transform={place(128, 150)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 q-4 -5 -3 -10" fill="none" stroke={LEAF_DEEP} strokeWidth={3} strokeLinecap="round" />
          <path d="M-3 -8 q-8 -1 -10 -8 q8 0 10 8 z" fill={LEAF} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
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

const leafBit: ParticleRenderer = () => (
  <path d="M0 -8 q7 2.5 1.5 12 q-8 -1.5 -1.5 -12 z" fill="#8CD97B" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
);
const staticStar: ParticleRenderer = () => (
  <path d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
);
const dustPuff: ParticleRenderer = () => (
  <g>
    <circle cx={-2.5} cy={1} r={4} fill="#E8E0D2" stroke={OUTLINE} strokeWidth={1.8} />
    <circle cx={3.5} cy={-1.5} r={3} fill="#F4EFE4" stroke={OUTLINE} strokeWidth={1.8} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.2,
    palette: { body: FUR, deep: LEAF_DEEP, belly: CREAM, accent: VOLT, accent2: "#8CD97B" },
    foodAnchor: { x: 132, y: 204 },
    shadowRx: 58,
  },
  // 迷你吸尘器：圆罐机身 + 软管 + 吸嘴，罐身电花贴纸
  tool: () => (
    <g>
      <ellipse cx={-2} cy={-11} rx={13} ry={11} fill="#9BDCFF" stroke={OUTLINE} strokeWidth={4} />
      <ellipse cx={-2} cy={-11} rx={5} ry={4.5} fill="#5C6172" stroke={OUTLINE} strokeWidth={2.4} />
      <path d="M-7 -13 l3 -3 M-3 -14 l3 -3" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M9 -14 Q22 -18 24 -34" fill="none" stroke="#5C6172" strokeWidth={4.5} strokeLinecap="round" />
      <path d="M20 -36 L28 -36 L30 -44 L18 -44 Z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M4 -22 l-2.6 4.4 h2.2 l-2.6 4.4" fill="none" stroke={VOLT} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 214, y: 190 },
    baseAngle: -Math.PI / 2.6,
    cone: 0.55,
    shapes: [leafBit, staticStar, dustPuff],
  },
  meta: {
    nameZh: "电叶猬",
    elements: ["electric", "grass"],
    family: "四足兽",
    toolAnchor: { x: 190, y: 231 },
    nodeBudget: 130,
    lieNote: "卷成一颗微微发光的叶球",
  },
};
