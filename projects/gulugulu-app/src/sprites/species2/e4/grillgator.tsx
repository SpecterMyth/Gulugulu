// ---------------------------------------------------------------------------
// 烧烤鳄 grillgator — e4（electric+fire+normal+water）· 蛇形爬行
// 剪影：低趴长身小鳄，背鳞=一排冒火光的烤炉格栅，身披发光灯串（e4 环绕件），
//       长吻带软牙，尾端拖插头。夜市烧烤扛把子。
// 睡姿（P3）：大字趴，嘴里还叼着一根签子。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const SKIN = "#5FA867";
const DEEP = "#3F7F49";
const CREAM = "#F2E7C8";
const GRILL = "#3E4356";
const FLAME = "#FFB03A";
const VOLT = "#FFD93B";
const CORN = "#F5C542";
const SAUSAGE = "#B5623C";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾（左侧长尾拖插头，明显探出剪影） */}
      <g transform={place(70, 208, 0)}>
        <Part name="tail" origin="100% 60%">
          <path d="M0 8 Q-24 8 -32 -6 Q-36 -14 -30 -20" fill="none" stroke={SKIN} strokeWidth={13} strokeLinecap="round" />
          <path d="M0 8 Q-24 8 -32 -6" fill="none" stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" opacity={0.3} />
          <g transform="translate(-30 -24) rotate(-30)">
            <rect x={-5} y={-7} width={10} height={11} rx={2.5} fill={VOLT} stroke={OUTLINE} strokeWidth={2.8} />
            <path d="M-2.5 -7 v-5 M2.5 -7 v-5" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
          </g>
        </Part>
      </g>
      {/* 身体（低趴宽体） */}
      <ellipse cx={128} cy={198} rx={58} ry={32} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      {/* 背鳞=烤炉格栅一排（火光从格缝透出） */}
      <g>
        <g transform={place(98, 168, -8)}>
          <rect x={-11} y={-14} width={22} height={16} rx={3} fill={GRILL} stroke={OUTLINE} strokeWidth={3.4} />
          <path d="M-7 -11 v10 M0 -11 v10 M7 -11 v10" stroke={FLAME} strokeWidth={2.2} strokeLinecap="round" />
        </g>
        <g transform={place(128, 162)}>
          <rect x={-12} y={-16} width={24} height={18} rx={3} fill={GRILL} stroke={OUTLINE} strokeWidth={3.4} />
          <path d="M-8 -13 v12 M0 -13 v12 M8 -13 v12" stroke={FLAME} strokeWidth={2.4} strokeLinecap="round" />
        </g>
        <g transform={place(158, 168, 8)}>
          <rect x={-11} y={-14} width={22} height={16} rx={3} fill={GRILL} stroke={OUTLINE} strokeWidth={3.4} />
          <path d="M-7 -11 v10 M0 -11 v10 M7 -11 v10" stroke={FLAME} strokeWidth={2.2} strokeLinecap="round" />
        </g>
      </g>
      {/* e4 环绕件：披在身上的灯串（灯泡 part-aura 脉动发光） */}
      <path d="M76 190 Q100 214 128 212 Q158 210 180 188" fill="none" stroke="#8A6410" strokeWidth={3} strokeLinecap="round" />
      <g className="part-aura">
        <g stroke={OUTLINE} strokeWidth={2.2}>
          <circle cx={90} cy={200} r={4.5} fill={VOLT} />
          <circle cx={112} cy={210} r={4.5} fill="#F5917B" />
          <circle cx={140} cy={210} r={4.5} fill={VOLT} />
          <circle cx={166} cy={200} r={4.5} fill="#9BDCFF" />
        </g>
      </g>
      {/* 长吻（向前下方的宽扁嘴，软牙两颗） */}
      <path
        d="M92 208 Q86 190 104 184 Q128 178 152 184 Q170 190 164 208 Q158 222 128 222 Q98 222 92 208 Z"
        fill={CREAM}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M104 214 L104 208 L110 214 Z M152 214 L152 208 L146 214 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
      <g fill={DEEP}>
        <circle cx={116} cy={196} r={2.4} />
        <circle cx={140} cy={196} r={2.4} />
      </g>
      {/* 小手 */}
      <g transform={place(84, 208, 22)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6.5} ry={9.5} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={place(172, 208, -22)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6.5} ry={9.5} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(104, 232)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(152, 232)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      {/* 脸：眼睛突出在吻上方（鳄鱼签名） */}
      <g fill={SKIN} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={106} cy={172} r={13} />
        <circle cx={150} cy={172} r={13} />
      </g>
      <g className="part-face">
        <ExpFace cx1={106} cx2={150} cy={172} r={8} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={94} cx2={162} cy={188} />
      </g>
      {/* 头顶：一撮小火苗呆毛（两眼之间，headtop 呼吸摇） */}
      <g transform={place(128, 164)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 q-4 -5 -2 -10 q3 2.5 3 6 q2.5 -4 1 -8 q5 3.5 3.5 9 q-1.5 4.5 -5.5 3 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
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

/** 侧视（右向）：低趴长身向前爬，长吻朝前，背上格栅一排，灯串披身侧。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾（身后拖插头） */}
      <g transform={place(68, 206)}>
        <Part name="tail" origin="100% 60%">
          <path d="M0 6 Q-26 8 -34 -6 Q-38 -14 -32 -20" fill="none" stroke={SKIN} strokeWidth={12} strokeLinecap="round" />
          <g transform="translate(-32 -24) rotate(-30)">
            <rect x={-5} y={-7} width={10} height={11} rx={2.5} fill={VOLT} stroke={OUTLINE} strokeWidth={2.8} />
            <path d="M-2.5 -7 v-5 M2.5 -7 v-5" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
          </g>
        </Part>
      </g>
      {/* 远侧前后腿（深色，先画） */}
      <g transform={place(98, 231)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={DEEP} deep={DEEP} rx={7.5} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(150, 231)}>
        <Part name="armL" origin="50% -30%">
          <StubLeg color={DEEP} deep={DEEP} rx={7.5} ry={4.5} lift={4} />
        </Part>
      </g>
      {/* 身体（低趴长体） */}
      <ellipse cx={122} cy={200} rx={54} ry={27} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      {/* 背鳞=格栅一排（顺背脊） */}
      <g transform={place(92, 176, -10)}>
        <rect x={-10} y={-13} width={20} height={15} rx={3} fill={GRILL} stroke={OUTLINE} strokeWidth={3.2} />
        <path d="M-6 -10 v9 M0 -10 v9 M6 -10 v9" stroke={FLAME} strokeWidth={2.2} strokeLinecap="round" />
      </g>
      <g transform={place(120, 170)}>
        <rect x={-11} y={-15} width={22} height={17} rx={3} fill={GRILL} stroke={OUTLINE} strokeWidth={3.2} />
        <path d="M-7 -12 v11 M0 -12 v11 M7 -12 v11" stroke={FLAME} strokeWidth={2.3} strokeLinecap="round" />
      </g>
      <g transform={place(148, 176, 10)}>
        <rect x={-10} y={-13} width={20} height={15} rx={3} fill={GRILL} stroke={OUTLINE} strokeWidth={3.2} />
        <path d="M-6 -10 v9 M0 -10 v9 M6 -10 v9" stroke={FLAME} strokeWidth={2.2} strokeLinecap="round" />
      </g>
      {/* 灯串（披在身侧） */}
      <path d="M72 196 Q98 218 126 216 Q152 214 172 196" fill="none" stroke="#8A6410" strokeWidth={3} strokeLinecap="round" />
      <g className="part-aura">
        <g stroke={OUTLINE} strokeWidth={2.2}>
          <circle cx={88} cy={206} r={4.5} fill={VOLT} />
          <circle cx={112} cy={214} r={4.5} fill="#F5917B" />
          <circle cx={140} cy={212} r={4.5} fill={VOLT} />
          <circle cx={164} cy={202} r={4.5} fill="#9BDCFF" />
        </g>
      </g>
      {/* 长吻（朝前，宽扁软牙） */}
      <path
        d="M158 182 Q186 176 206 186 Q214 192 206 200 Q188 210 158 206 Q150 196 158 182 Z"
        fill={CREAM}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M176 206 L176 200 L182 206 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={200} cy={188} r={2.2} fill={DEEP} />
      {/* 近侧前后腿（爬步） */}
      <g transform={place(112, 232)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(164, 232)}>
        <Part name="armR" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      {/* 突出眼包（单侧） */}
      <circle cx={156} cy={172} r={13} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
      <g className="part-face">
        <ExpSideFace cx={158} cy={170} r={8} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={146} cy={190} rx={7} ry={4.5} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 头顶：小火苗呆毛（眼包前） */}
      <g transform={place(150, 156)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 q-4 -5 -2 -10 q3 2.5 3 6 q2.5 -4 1 -8 q5 3.5 3.5 9 q-1.5 4.5 -5.5 3 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：大字摊平贴地，四脚外撇，嘴角还叼着一根烤串，灯串松垮拖地。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾（摊平在左，插头躺地） */}
      <g transform={place(64, 220)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 4 Q-20 6 -30 2" fill="none" stroke={SKIN} strokeWidth={11} strokeLinecap="round" />
          <g transform="translate(-34 2) rotate(-90)">
            <rect x={-5} y={-7} width={10} height={11} rx={2.5} fill={VOLT} stroke={OUTLINE} strokeWidth={2.8} />
            <path d="M-2.5 -7 v-5 M2.5 -7 v-5" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
          </g>
        </Part>
      </g>
      {/* 身体（摊得更扁更宽） */}
      <ellipse cx={128} cy={212} rx={62} ry={21} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      {/* 四脚大字外撇 */}
      <g transform={place(76, 226, 52)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(180, 226, -52)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(76, 204, 106)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={9} rx={6.5} ry={10.5} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={place(180, 204, -106)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={9} rx={6.5} ry={10.5} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 背鳞格栅（火光转小） */}
      <g transform={place(100, 194, -6)}>
        <rect x={-10} y={-12} width={20} height={14} rx={3} fill={GRILL} stroke={OUTLINE} strokeWidth={3.2} />
        <path d="M-6 -9 v8 M0 -9 v8 M6 -9 v8" stroke={FLAME} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      </g>
      <g transform={place(128, 190)}>
        <rect x={-11} y={-13} width={22} height={15} rx={3} fill={GRILL} stroke={OUTLINE} strokeWidth={3.2} />
        <path d="M-7 -10 v9 M0 -10 v9 M7 -10 v9" stroke={FLAME} strokeWidth={2.2} strokeLinecap="round" opacity={0.7} />
      </g>
      <g transform={place(156, 194, 6)}>
        <rect x={-10} y={-12} width={20} height={14} rx={3} fill={GRILL} stroke={OUTLINE} strokeWidth={3.2} />
        <path d="M-6 -9 v8 M0 -9 v8 M6 -9 v8" stroke={FLAME} strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      </g>
      {/* 灯串（松垮拖到地上） */}
      <path d="M70 226 Q100 238 128 236 Q158 234 184 224" fill="none" stroke="#8A6410" strokeWidth={3} strokeLinecap="round" />
      <g className="part-aura">
        <g stroke={OUTLINE} strokeWidth={2.2}>
          <circle cx={92} cy={232} r={4.2} fill={VOLT} />
          <circle cx={128} cy={236} r={4.2} fill="#F5917B" />
          <circle cx={162} cy={230} r={4.2} fill="#9BDCFF" />
        </g>
      </g>
      {/* 长吻（贴地） */}
      <path
        d="M96 218 Q92 202 108 198 Q128 194 148 198 Q164 202 160 218 Q154 230 128 230 Q102 230 96 218 Z"
        fill={CREAM}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M108 224 L108 219 L113 224 Z" fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <g fill={DEEP}>
        <circle cx={118} cy={206} r={2.2} />
        <circle cx={138} cy={206} r={2.2} />
      </g>
      {/* 嘴角叼着的烤串 */}
      <g transform="translate(156 222) rotate(-24)">
        <path d="M0 0 L26 0" stroke="#B98A4E" strokeWidth={2.6} strokeLinecap="round" />
        <circle cx={10} cy={0} r={3.6} fill="#E2432E" stroke={OUTLINE} strokeWidth={2} />
        <circle cx={17} cy={0} r={3.6} fill={FLAME} stroke={OUTLINE} strokeWidth={2} />
        <circle cx={24} cy={0} r={3.6} fill="#8CD97B" stroke={OUTLINE} strokeWidth={2} />
      </g>
      {/* 突出眼包（闭眼） */}
      <g fill={SKIN} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={108} cy={186} r={12} />
        <circle cx={148} cy={186} r={12} />
      </g>
      <g className="part-face">
        <ExpFace cx1={108} cx2={148} cy={186} r={7.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={96} cx2={160} cy={200} />
      </g>
      {/* 头顶：小火苗（蔫下来） */}
      <g transform={place(128, 178)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 q-3 -4 -1.5 -8 q2.5 2 2.5 5 q2 -3 1 -6 q4 3 2.5 7 q-1.5 3.5 -4.5 2 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
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

const skewerBit: ParticleRenderer = () => (
  <g transform="rotate(-30)">
    <path d="M0 8 V-8" stroke="#B98A4E" strokeWidth={2.2} strokeLinecap="round" />
    <circle cx={0} cy={-6} r={3} fill="#E2432E" stroke={OUTLINE} strokeWidth={1.8} />
    <circle cx={0} cy={0} r={3} fill={FLAME} stroke={OUTLINE} strokeWidth={1.8} />
    <circle cx={0} cy={6} r={3} fill="#8CD97B" stroke={OUTLINE} strokeWidth={1.8} />
  </g>
);
const grilledCorn: ParticleRenderer = () => (
  <g transform="rotate(-20)">
    <rect x={-4.5} y={-8} width={9} height={16} rx={4.5} fill={CORN} stroke={OUTLINE} strokeWidth={2} />
    <g stroke="#C99A2E" strokeWidth={1} opacity={0.9}>
      <path d="M-4.5 -3.5 H4.5 M-4.5 0 H4.5 M-4.5 3.5 H4.5 M-1.5 -7.5 V7.5 M1.5 -7.5 V7.5" />
    </g>
    <path d="M-4.5 6 Q-8 8 -8.5 10.5 M4.5 6 Q8 8 8.5 10.5" fill="none" stroke={DEEP} strokeWidth={2.4} strokeLinecap="round" />
  </g>
);
const sausage: ParticleRenderer = () => (
  <g transform="rotate(-18)">
    <rect x={-8} y={-4.5} width={16} height={9} rx={4.5} fill={SAUSAGE} stroke={OUTLINE} strokeWidth={2} />
    <path d="M-8 -4.5 q-3 4.5 0 9 M8 -4.5 q3 4.5 0 9" fill="none" stroke={OUTLINE} strokeWidth={1.6} strokeLinecap="round" />
    <path d="M-5 -1 q5 -2 10 0 M-5 2 q5 -2 10 0" fill="none" stroke="#8A4526" strokeWidth={1.1} opacity={0.7} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.1,
    palette: { body: SKIN, deep: DEEP, belly: CREAM, accent: FLAME, accent2: VOLT },
    foodAnchor: { x: 128, y: 208 },
    shadowRx: 62,
  },
  // 烤串蒲扇：大蒲扇 + 两串烤串
  tool: () => (
    <g>
      <g transform="rotate(-14)">
        <path d="M0 -8 Q-16 -10 -18 -26 Q-18 -40 0 -40 Q18 -40 18 -26 Q16 -10 0 -8 Z" fill={CREAM} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <path d="M0 -10 V-38 M-9 -12 Q-11 -24 -8 -36 M9 -12 Q11 -24 8 -36" stroke="#B98A4E" strokeWidth={2} strokeLinecap="round" />
        <path d="M0 0 V-8" stroke="#8A6410" strokeWidth={4} strokeLinecap="round" />
      </g>
      <g transform="translate(16 -18) rotate(24)">
        <path d="M0 10 V-16" stroke="#B98A4E" strokeWidth={2.4} strokeLinecap="round" />
        <circle cx={0} cy={-13} r={3.4} fill="#E2432E" stroke={OUTLINE} strokeWidth={2} />
        <circle cx={0} cy={-6} r={3.4} fill={FLAME} stroke={OUTLINE} strokeWidth={2} />
        <circle cx={0} cy={1} r={3.4} fill="#8CD97B" stroke={OUTLINE} strokeWidth={2} />
      </g>
    </g>
  ),
  workFx: {
    emitter: { x: 200, y: 200 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.6,
    shapes: [skewerBit, grilledCorn, sausage],
  },
  meta: {
    nameZh: "烧烤鳄",
    elements: ["electric", "fire", "normal", "water"],
    family: "蛇形爬行",
    toolAnchor: { x: 196, y: 231 },
    nodeBudget: 220,
    lieNote: "大字趴，嘴里还叼着一根签子",
  },
};
