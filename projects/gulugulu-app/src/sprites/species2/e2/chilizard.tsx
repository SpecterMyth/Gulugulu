// ---------------------------------------------------------------------------
// 火辣蜥 chilizard — e2（fire+grass）· 蛇形爬行
// 剪影：低趴小蜥蜴，尾巴=一根卷曲大红辣椒（招牌），背脊一排叶鳍。
// 睡姿（P3）：辣椒尾圈成圆圈，下巴枕在圈上。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const SKIN = "#8CD97B";
const DEEP = "#57B84C";
const CREAM = "#FFF4DC";
const CHILI = "#E2432E";
const FLAME = "#FFB03A";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾=大红辣椒（左上卷起，明显探出剪影） */}
      <g transform={place(76, 196, -20)}>
        <Part name="tail" origin="90% 90%">
          <path
            d="M0 0 Q-34 -6 -40 -34 Q-42 -52 -28 -56 Q-16 -58 -12 -46 Q-24 -48 -28 -38 Q-30 -22 -10 -12 Q-4 -8 0 0 Z"
            fill={CHILI}
            stroke={OUTLINE}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <path d="M-26 -55 Q-24 -64 -14 -64 Q-18 -58 -18 -52 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
          <path d="M-34 -34 Q-34 -46 -27 -50" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" opacity={0.5} />
        </Part>
      </g>
      {/* 背脊叶鳍一排（先画，身体压住根部） */}
      <g fill={DEEP} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round">
        <path d="M96 168 Q92 152 102 148 Q106 160 104 170 Z" />
        <path d="M120 160 Q118 142 130 138 Q134 152 130 164 Z" />
        <path d="M146 162 Q146 146 158 144 Q160 158 154 168 Z" />
      </g>
      {/* 身体（低趴宽椭圆） */}
      <ellipse cx={128} cy={196} rx={56} ry={34} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      {/* 奶油肚 + 火纹斑 */}
      <ellipse cx={128} cy={210} rx={34} ry={16} fill={CREAM} opacity={0.95} />
      <g fill={FLAME} opacity={0.85}>
        <circle cx={92} cy={186} r={5} />
        <circle cx={166} cy={190} r={4} />
      </g>
      {/* 小手 */}
      <g transform={place(90, 206, 20)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6.5} ry={9.5} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={place(166, 206, -20)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6.5} ry={9.5} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(106, 232)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={5} />
        </Part>
      </g>
      <g transform={place(150, 232)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={5} />
        </Part>
      </g>
      {/* 脸（宽扁蜥蜴脸，嘴角上挑） */}
      <g className="part-face">
        <ExpFace cx1={108} cx2={148} cy={184} r={10} mouthY={202} mouthW={18} expression={expression} base={eyes} />
        <Blush cx1={94} cx2={162} cy={197} />
      </g>
      {/* 头顶：一小簇火苗呆毛（吃辣上头） */}
      <g transform={place(128, 162)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 q-5 -6 -2 -12 q4 3 3 7 q3 -5 1 -9 q6 4 4 11 q-2 5 -6 3 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
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

/** 侧视（右向）：低趴长身，辣椒尾左上卷，背脊叶鳍一排，宽吻朝右。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 辣椒尾（左上卷，招牌） */}
      <g transform={place(70, 194, -14)}>
        <Part name="tail" origin="90% 90%">
          <path
            d="M0 0 Q-30 -6 -36 -32 Q-38 -48 -25 -52 Q-14 -54 -11 -43 Q-21 -45 -25 -35 Q-27 -21 -9 -11 Q-3 -7 0 0 Z"
            fill={CHILI}
            stroke={OUTLINE}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <path d="M-23 -51 Q-21 -59 -12 -59 Q-16 -54 -16 -48 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 背脊叶鳍（向后倾一排） */}
      <g fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round">
        <path d="M92 176 Q86 160 96 156 Q101 168 99 178 Z" />
        <path d="M118 168 Q114 150 126 146 Q131 160 127 172 Z" />
        <path d="M146 168 Q144 152 156 150 Q159 164 153 174 Z" />
      </g>
      {/* 低趴长身（吻端朝右） */}
      <path
        d="M74 202 Q72 172 108 164 Q150 156 180 172 Q198 182 194 198 Q188 214 156 220 Q108 226 82 216 Q72 210 74 202 Z"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 奶油下颌 + 火纹斑 */}
      <path d="M150 190 Q188 186 194 200 Q186 216 154 218 Q142 204 150 190 Z" fill={CREAM} opacity={0.95} />
      <circle cx={100} cy={188} r={5} fill={FLAME} opacity={0.85} />
      {/* 近侧小手 */}
      <g transform={place(140, 210, -14)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={6} ry={8.5} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={place(112, 214, 8)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8} fill={SKIN} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 小脚（迈步） */}
      <g transform={place(102, 232)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={5} />
        </Part>
      </g>
      <g transform={place(150, 232)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={SKIN} deep={DEEP} rx={8} ry={4.5} lift={5} />
        </Part>
      </g>
      {/* 脸（单眼 + 上挑嘴角） */}
      <g className="part-face">
        <ExpSideFace cx={166} cy={182} r={9.5} mouthX={182} mouthY={202} mouthW={13} expression={expression} base={eyes} />
        <ellipse cx={154} cy={200} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：火苗呆毛（前倾） */}
      <g transform={place(168, 164)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 q-5 -6 -2 -12 q4 3 3 7 q3 -5 1 -9 q6 4 4 11 q-2 5 -6 3 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：辣椒尾在身前圈成圆圈，下巴枕在圈上打盹。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 身体贴地（后段低扁） */}
      <ellipse cx={146} cy={210} rx={48} ry={20} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      {/* 背脊叶鳍（趴下后倒向一侧） */}
      <g fill={DEEP} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <path d="M136 194 Q130 182 140 178 Q145 188 143 196 Z" />
        <path d="M162 192 Q158 180 168 178 Q172 188 168 196 Z" />
      </g>
      {/* 辣椒尾盘在身前一圈（招牌枕头） */}
      <g transform={place(92, 212)}>
        <Part name="tail" origin="80% 50%">
          <path
            d="M18 8 Q-14 12 -22 -4 Q-27 -18 -14 -24 Q-2 -28 3 -18 Q-8 -20 -13 -11 Q-16 -1 2 2 Q12 3 18 0 Z"
            fill={CHILI}
            stroke={OUTLINE}
            strokeWidth={5}
            strokeLinejoin="round"
          />
          <path d="M-11 -23 Q-9 -31 0 -31 Q-4 -26 -4 -20 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 头枕在辣椒圈上（下巴搭圈） */}
      <ellipse cx={104} cy={196} rx={30} ry={22} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      <path d="M80 204 Q104 216 130 204 Q124 216 104 218 Q86 214 80 204 Z" fill={CREAM} opacity={0.95} />
      {/* 小手搭圈边 */}
      <g transform={place(122, 218, 10)}>
        <Part name="armR" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={7} ry={4.5} fill={SKIN} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(84, 220, -8)}>
        <Part name="armL" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={6.5} ry={4} fill={SKIN} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 脸（闭眼） */}
      <g className="part-face">
        <ExpFace cx1={94} cx2={116} cy={192} r={7} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path d="M100 208 q5 4 10 0" fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
      </g>
      {/* 头顶：火苗呆毛缩小打盹 */}
      <g transform={place(102, 176)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 q-3 -4 -1 -8 q3 2 2 5 q2 -3 1 -6 q4 3 3 7 q-1 3 -5 2 z" fill={FLAME} opacity={0.9} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
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

const chiliBit: ParticleRenderer = () => (
  <g>
    <path d="M-1 -6 Q6 -4 5 4 Q4 8 0 7 Q-5 5 -4 -3 Z" fill={CHILI} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <path d="M-2 -7 q2 -2 4 -1" fill="none" stroke={DEEP} strokeWidth={2} strokeLinecap="round" />
  </g>
);
const flameBit: ParticleRenderer = () => (
  <path d="M0 6 q-5 -4 -3 -10 q2 -5.5 6.5 -9 q-1.5 5.5 2 8.5 q4 3.5 3 8 a6 6 0 0 1 -8.5 2.5 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
);
const leafBit: ParticleRenderer = () => (
  <path d="M0 -8 q7 2.5 1.5 12 q-8 -1.5 -1.5 -12 z" fill={SKIN} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.08,
    palette: { body: SKIN, deep: DEEP, belly: CREAM, accent: CHILI, accent2: FLAME },
    foodAnchor: { x: 132, y: 200 },
    shadowRx: 60,
  },
  // 颠勺炒锅：黑锅 + 长柄 + 空中辣椒与火苗
  tool: () => (
    <g>
      <path d="M-22 -16 Q-20 -2 0 -2 Q20 -2 22 -16 Z" fill="#3E4356" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M22 -16 l14 -5" stroke={OUTLINE} strokeWidth={5.5} strokeLinecap="round" />
      <path d="M-16 -14 Q-14 -6 0 -6" fill="none" stroke="#5C6172" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M-8 -26 Q-2 -24 -3 -18 Q-4 -15 -8 -16 Q-12 -18 -11 -23 Z" fill={CHILI} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M6 -34 q-4 -3 -2.5 -8 q3.5 2.5 3 6 q2.5 -4 1 -7 q4.5 3 3.5 8 q-1 4 -5 1 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 196, y: 204 },
    baseAngle: -Math.PI / 2.4,
    cone: 0.55,
    shapes: [chiliBit, flameBit, leafBit],
  },
  meta: {
    nameZh: "火辣蜥",
    elements: ["fire", "grass"],
    family: "蛇形爬行",
    toolAnchor: { x: 192, y: 231 },
    nodeBudget: 130,
    lieNote: "辣椒尾圈成圆圈，下巴枕在圈上",
  },
};
