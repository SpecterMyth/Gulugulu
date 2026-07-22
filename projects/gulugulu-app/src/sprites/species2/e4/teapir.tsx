// ---------------------------------------------------------------------------
// 抹茶貘 teapir — e4（fire+grass+ice+normal）· 有蹄神兽
// 剪影：圆滚食梦貘，长鼻=铜茶壶嘴（冒茶汽），头顶壶盖帽，梦之碎片环绕。
// 睡姿（P3）：抱着茶壶睡出连串 Z——全谱睡相最专业。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm, TallLeg } from "../../parts/limbs";
import { OrbitOrbs } from "../../parts/ornaments";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BODY = "#A9B0C4";
const DEEP = "#6E6E78";
const CREAM = "#FFF4DC";
const COPPER = "#D9A514";
const LEAF = "#8CD97B";
const FROST = "#B0E5F0";
const BAMBOO = "#D8C48A";
const MATCHA = "#8FB93E";

function Front({ palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e4 环绕件：梦之碎片轨道环（茶叶/雪片/余烬/星，画在身体后） */}
      <g transform={place(128, 176)}>
        <g className="part-orbit">
          <OrbitOrbs colors={[LEAF, FROST, "#E85D3A", CREAM]} rx={70} ry={24} r={5} count={4} />
        </g>
      </g>
      {/* 尾：小貘尾拖一缕梦雾 */}
      <g transform={place(74, 198, -18)}>
        <Part name="tail" origin="20% 50%">
          <ellipse cx={-4} cy={0} rx={7} ry={4.5} fill={BODY} stroke={OUTLINE} strokeWidth={4} />
          <path d="M-12 -2 q-8 -3 -10 -10" fill="none" stroke={FROST} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
        </Part>
      </g>
      {/* 身体（矮墩四足） */}
      <ellipse cx={128} cy={193} rx={53} ry={36} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 背鞍斑（貘签名双色）+ 梦纹 */}
      <path d="M84 180 Q128 158 172 180 L172 196 Q128 178 84 196 Z" fill={DEEP} opacity={0.5} />
      <ellipse cx={128} cy={206} rx={31} ry={17} fill={CREAM} opacity={0.92} />
      <g fill="none" strokeLinecap="round">
        <path d="M108 206 q5 -7 11 -2 q-7 1 -4 6" stroke={FROST} strokeWidth={2.6} />
        <path d="M140 202 q6 -5 10 0" stroke={LEAF} strokeWidth={2.6} />
      </g>
      {/* 小手（貘的前爪缩在身侧） */}
      <g transform={place(82, 200, 22)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={BODY} rx={7} ry={11} />
        </Part>
      </g>
      <g transform={place(174, 200, -22)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={BODY} rx={7} ry={11} />
        </Part>
      </g>
      {/* 有蹄短腿 */}
      <g transform={place(106, 231)}>
        <Part name="legL" origin="50% -30%">
          <TallLeg color={BODY} hoof={DEEP} len={17} w={11} hoofH={7} />
        </Part>
      </g>
      <g transform={place(150, 231)}>
        <Part name="legR" origin="50% -30%">
          <TallLeg color={BODY} hoof={DEEP} len={17} w={11} hoofH={7} />
        </Part>
      </g>
      {/* 圆耳（头压耳根） */}
      <g fill={BODY} stroke={OUTLINE} strokeWidth={5}>
        <circle cx={92} cy={100} r={15} />
        <circle cx={164} cy={100} r={15} />
      </g>
      <circle cx={92} cy={100} r={7} fill={CREAM} stroke="none" />
      <circle cx={164} cy={100} r={7} fill={CREAM} stroke="none" />
      {/* 头（大头比例再提一档） */}
      <ellipse cx={128} cy={138} rx={48} ry={40} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 长鼻=铜壶嘴（招牌剪影件）：从脸下部向右伸出、明显探出头轮廓，
          端口铜箍 + 一大缕茶汽 */}
      <g>
        <path
          d="M128 154 Q150 160 172 152 Q186 146 188 134 L177 128 Q173 140 158 144 Q140 148 128 144 Z"
          fill={BODY}
          stroke={OUTLINE}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <path d="M177 128 L188 134 L184 144 L173 139 Z" fill={COPPER} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <path d="M186 120 q5 -7 0 -13 q9 3 6 14 q-2 6 -6 -1 z" fill="#FFFFFF" stroke={FROST} strokeWidth={2.4} strokeLinejoin="round" opacity={0.95} />
        <circle cx={192} cy={104} r={3} fill="#FFFFFF" stroke={FROST} strokeWidth={2} opacity={0.85} />
      </g>
      {/* 脸（食梦貘=眯眯眼；嘴被鼻子占位，不另画嘴；腮红避开鼻子） */}
      <g className="part-face">
        <ExpFace cx1={107} cx2={147} cy={128} r={10} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={94} cx2={162} cy={146} />
      </g>
      {/* 头顶：壶盖小帽（铜盖+钮），下缘一圈茶叶纹 */}
      <g transform={place(128, 100)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-17 0 Q0 -13 17 0 Z" fill={COPPER} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
          <circle cx={0} cy={-11} r={4} fill={CREAM} stroke={OUTLINE} strokeWidth={3} />
          <path d="M-11 -2 q3 -3 6 0 M5 -2 q3 -3 6 0" fill="none" stroke={LEAF} strokeWidth={2.2} strokeLinecap="round" />
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

/** 侧视（右向）：矮墩貘踏步，铜壶鼻朝前冒茶汽，壶盖帽随行，梦片环绕。 */
function Side({ palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 梦之碎片轨道 */}
      <g transform={place(126, 176)}>
        <g className="part-orbit">
          <OrbitOrbs colors={[LEAF, FROST, "#E85D3A", CREAM]} rx={66} ry={22} r={5} count={4} />
        </g>
      </g>
      {/* 尾：小貘尾拖梦雾（身后） */}
      <g transform={place(72, 188, -14)}>
        <Part name="tail" origin="20% 50%">
          <ellipse cx={-4} cy={0} rx={7} ry={4.5} fill={BODY} stroke={OUTLINE} strokeWidth={4} />
          <path d="M-12 -2 q-8 -3 -10 -10" fill="none" stroke={FROST} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
        </Part>
      </g>
      {/* 远侧前后腿 */}
      <g transform={place(100, 230)}>
        <Part name="legL" origin="50% -30%">
          <TallLeg color={DEEP} hoof={DEEP} len={16} w={10} hoofH={7} />
        </Part>
      </g>
      <g transform={place(146, 230)}>
        <Part name="armL" origin="50% -30%">
          <TallLeg color={DEEP} hoof={DEEP} len={16} w={10} hoofH={7} />
        </Part>
      </g>
      {/* 身体（矮墩横身） */}
      <ellipse cx={124} cy={190} rx={50} ry={33} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 背鞍斑 + 梦纹 */}
      <path d="M82 178 Q124 158 168 178 L168 194 Q124 176 82 194 Z" fill={DEEP} opacity={0.5} />
      <ellipse cx={130} cy={204} rx={29} ry={15} fill={CREAM} opacity={0.92} />
      <path d="M112 204 q5 -7 11 -2 q-7 1 -4 6" fill="none" stroke={FROST} strokeWidth={2.6} strokeLinecap="round" />
      {/* 近侧前后腿（踏步） */}
      <g transform={place(114, 231)}>
        <Part name="legR" origin="50% -30%">
          <TallLeg color={BODY} hoof={DEEP} len={17} w={11} hoofH={7} />
        </Part>
      </g>
      <g transform={place(160, 231)}>
        <Part name="armR" origin="50% -30%">
          <TallLeg color={BODY} hoof={DEEP} len={17} w={11} hoofH={7} />
        </Part>
      </g>
      {/* 圆耳（前后两只） */}
      <g fill={BODY} stroke={OUTLINE} strokeWidth={5}>
        <circle cx={118} cy={96} r={13} />
        <circle cx={152} cy={92} r={14} />
      </g>
      <circle cx={118} cy={96} r={6} fill={CREAM} stroke="none" />
      <circle cx={152} cy={92} r={6.5} fill={CREAM} stroke="none" />
      {/* 头（前伸大头） */}
      <ellipse cx={148} cy={132} rx={42} ry={36} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 长鼻=铜壶嘴（朝前上扬，冒茶汽） */}
      <g>
        <path
          d="M160 148 Q182 152 196 144 Q206 138 208 128 L197 122 Q194 134 180 139 Q170 142 160 140 Z"
          fill={BODY}
          stroke={OUTLINE}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        <path d="M197 122 L208 128 L204 138 L193 133 Z" fill={COPPER} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <path d="M206 114 q5 -7 0 -13 q9 3 6 14 q-2 6 -6 -1 z" fill="#FFFFFF" stroke={FROST} strokeWidth={2.4} strokeLinejoin="round" opacity={0.95} />
      </g>
      {/* 脸（眯眯侧眼） */}
      <g className="part-face">
        <ExpSideFace cx={156} cy={122} r={10} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={144} cy={142} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：壶盖小帽（前倾） */}
      <g transform={place(146, 96, 6)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-16 0 Q0 -12 16 0 Z" fill={COPPER} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
          <circle cx={0} cy={-10} r={4} fill={CREAM} stroke={OUTLINE} strokeWidth={3} />
          <path d="M-10 -2 q3 -3 6 0" fill="none" stroke={LEAF} strokeWidth={2.2} strokeLinecap="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：抱着铜茶壶趴睡，壶鼻搭在壶盖上，梦片降到贴地环。 */
function Lie({ palette, slots = {}, eyes = "sleepy", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 梦之碎片（贴地慢环） */}
      <g transform={place(128, 216)}>
        <g className="part-orbit">
          <OrbitOrbs colors={[LEAF, FROST, "#E85D3A", CREAM]} rx={62} ry={12} r={4.5} count={4} />
        </g>
      </g>
      {/* 尾：小貘尾（贴地） */}
      <g transform={place(190, 212, 12)}>
        <Part name="tail" origin="0% 50%">
          <ellipse cx={4} cy={0} rx={7} ry={4.5} fill={BODY} stroke={OUTLINE} strokeWidth={4} />
          <path d="M12 -2 q8 -3 10 -10" fill="none" stroke={FROST} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
        </Part>
      </g>
      {/* 身体（趴伏） */}
      <ellipse cx={136} cy={204} rx={52} ry={26} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      <path d="M92 196 Q136 176 182 196 L182 210 Q136 194 92 210 Z" fill={DEEP} opacity={0.5} />
      {/* 收拢的四蹄 */}
      <g transform={place(110, 229)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={10} ry={5} fill={BODY} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={-8} cy={0} rx={3.6} ry={4.2} fill={DEEP} stroke={OUTLINE} strokeWidth={2.4} />
        </Part>
      </g>
      <g transform={place(148, 230)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={10} ry={5} fill={BODY} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={-8} cy={0} rx={3.6} ry={4.2} fill={DEEP} stroke={OUTLINE} strokeWidth={2.4} />
        </Part>
      </g>
      {/* 抱着的铜茶壶（枕前） */}
      <g transform="translate(84 210)">
        <circle cx={0} cy={0} r={16} fill={COPPER} stroke={OUTLINE} strokeWidth={4} />
        <path d="M-7 -5 q7 -4 14 0" fill="none" stroke="#FFF1C9" strokeWidth={2.2} strokeLinecap="round" />
        <path d="M-13 -8 Q-24 -14 -22 -24 L-16 -25 Q-15 -16 -8 -13 Z" fill={COPPER} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        <path d="M0 -16 q0 -3 0 -4" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
        <circle cx={0} cy={-21} r={3} fill={CREAM} stroke={OUTLINE} strokeWidth={2.4} />
        <path d="M-22 -30 q4 -5 1 -9" fill="none" stroke={FROST} strokeWidth={2.2} strokeLinecap="round" opacity={0.9} />
      </g>
      {/* 圆耳 */}
      <g fill={BODY} stroke={OUTLINE} strokeWidth={5}>
        <circle cx={96} cy={148} r={13} />
        <circle cx={148} cy={144} r={14} />
      </g>
      <circle cx={96} cy={148} r={6} fill={CREAM} stroke="none" />
      <circle cx={148} cy={144} r={6.5} fill={CREAM} stroke="none" />
      {/* 头（伏低抱壶） */}
      <ellipse cx={122} cy={178} rx={42} ry={34} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 长鼻（垂搭在壶盖上） */}
      <path
        d="M104 194 Q92 202 82 200 Q72 198 70 190 L78 184 Q82 190 92 190 Q100 190 106 186 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      <path d="M78 184 L70 190 L74 197 L82 192 Z" fill={COPPER} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      {/* 小手环抱壶身 */}
      <g transform={place(96, 216, 34)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={BODY} rx={6.5} ry={10} />
        </Part>
      </g>
      <g transform={place(124, 220, -18)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={BODY} rx={6.5} ry={10} />
        </Part>
      </g>
      {/* 脸（睡相最专业） */}
      <g className="part-face">
        <ExpFace cx1={108} cx2={140} cy={170} r={9.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={98} cx2={150} cy={186} />
      </g>
      {/* 头顶：壶盖帽（滑到后脑） */}
      <g transform={place(136, 148, -14)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-15 0 Q0 -11 15 0 Z" fill={COPPER} stroke={OUTLINE} strokeWidth={3.8} strokeLinejoin="round" />
          <circle cx={0} cy={-9} r={3.6} fill={CREAM} stroke={OUTLINE} strokeWidth={2.8} />
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

// 茶叶（沿用既有茶叶粒，保留备用）
const teaLeaf: ParticleRenderer = () => (
  <path d="M0 -7 q6.5 2 1.5 11 q-7.5 -1.5 -1.5 -11 z" fill={LEAF} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);
// 茶筅：竹柄 + 扇开的穗
const bambooWhisk: ParticleRenderer = () => (
  <g>
    <rect x={-2.4} y={1} width={4.8} height={8} rx={2} fill={BAMBOO} stroke={OUTLINE} strokeWidth={2} />
    <g stroke={BAMBOO} strokeWidth={1.6} strokeLinecap="round" fill="none">
      <path d="M-2 1 Q-7 -4 -7 -9 M-0.6 1 Q-3 -5 -3 -10 M0.6 1 Q0.6 -5 0.6 -10.5 M2 1 Q7 -4 7 -9 M-0.2 1 Q3.4 -5 3.4 -10" />
    </g>
    <path d="M-2.4 4 h4.8" stroke={OUTLINE} strokeWidth={1.2} opacity={0.5} />
  </g>
);
// 抹茶粉堆
const matchaMound: ParticleRenderer = () => (
  <g>
    <path d="M-8 6 Q-8 -5 0 -6 Q8 -5 8 6 Q0 8 -8 6 Z" fill={MATCHA} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M-8 6 Q0 8 8 6" fill="none" stroke={OUTLINE} strokeWidth={1.6} opacity={0.5} />
    <g fill="#7A9E32" opacity={0.8}>
      <circle cx={-2.5} cy={-1} r={0.9} />
      <circle cx={2} cy={0} r={0.8} />
      <circle cx={0} cy={2.5} r={0.8} />
    </g>
  </g>
);
// 三色团子（和菓子）
const wagashi: ParticleRenderer = () => (
  <g>
    <path d="M0 9 V-9" stroke={BAMBOO} strokeWidth={2} strokeLinecap="round" />
    <circle cx={0} cy={-5} r={3.8} fill="#F3C6D2" stroke={OUTLINE} strokeWidth={2} />
    <circle cx={0} cy={1} r={3.8} fill={CREAM} stroke={OUTLINE} strokeWidth={2} />
    <circle cx={0} cy={7} r={3.8} fill={MATCHA} stroke={OUTLINE} strokeWidth={2} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.13,
    palette: { body: BODY, deep: DEEP, belly: CREAM, accent: "#E85D3A", accent2: LEAF },
    eyes: "sleepy",
    foodAnchor: { x: 172, y: 134 },
    shadowRx: 60,
  },
  // 长嘴铜茶壶：圆壶身 + 细长壶嘴 + 盖钮 + 提梁，壶嘴冒茶汽
  tool: () => (
    <g>
      <circle cx={0} cy={-15} r={14} fill={COPPER} stroke={OUTLINE} strokeWidth={4} />
      <path d="M-6 -19 q6 -4 12 0" fill="none" stroke="#FFF1C9" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M11 -20 Q28 -26 33 -44 L27 -46 Q23 -31 9 -26 Z" fill={COPPER} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <path d="M-9 -26 Q-20 -38 -6 -41" fill="none" stroke={OUTLINE} strokeWidth={4.5} strokeLinecap="round" />
      <path d="M0 -29 q0 -4 0 -5" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
      <circle cx={0} cy={-33} r={3.2} fill={CREAM} stroke={OUTLINE} strokeWidth={2.6} />
      <path d="M31 -50 q4 -5 1 -9" fill="none" stroke={FROST} strokeWidth={2.4} strokeLinecap="round" opacity={0.9} />
    </g>
  ),
  workFx: {
    emitter: { x: 222, y: 186 },
    baseAngle: -Math.PI / 2.2,
    cone: 0.55,
    shapes: [bambooWhisk, matchaMound, wagashi],
  },
  meta: {
    nameZh: "抹茶貘",
    elements: ["fire", "grass", "ice", "normal"],
    family: "有蹄神兽",
    toolAnchor: { x: 190, y: 231 },
    nodeBudget: 220,
    lieNote: "抱着茶壶睡出连串 Z——全谱睡相最专业",
  },
};
