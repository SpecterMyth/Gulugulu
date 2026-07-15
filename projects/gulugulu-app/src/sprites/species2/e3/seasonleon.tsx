// ---------------------------------------------------------------------------
// 四季龙 seasonleon — e3（fire+grass+ice）· 蛇形爬行
// 剪影：小变色龙，身体三段花色（焰橙/叶绿/霜蓝）随心情流动，
//       大螺旋卷尾（招牌）+ 锯齿背冠。艺术家脾气。
// 睡姿（P3）：卷尾圈成圆枕，一只眼先睡。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { StubLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const GREEN = "#8CD97B";
const GREEN_DEEP = "#57B84C";
const CREAM = "#FFF4DC";
const FLAME = "#FFB03A";
const ICE = "#8FD8E8";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 大螺旋卷尾（招牌：右侧立起的蚊香圈） */}
      <g transform={place(174, 206)}>
        <Part name="tail" origin="20% 80%">
          <path
            d="M0 6 Q28 8 34 -12 Q38 -30 22 -34 Q8 -37 5 -24 Q3 -14 14 -13 Q22 -13 21 -21 Q20 -27 15 -26"
            fill="none"
            stroke={GREEN_DEEP}
            strokeWidth={11}
            strokeLinecap="round"
          />
          <path
            d="M0 6 Q28 8 34 -12 Q38 -30 22 -34"
            fill="none"
            stroke={FLAME}
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.85}
          />
        </Part>
      </g>
      {/* 锯齿背冠（先画被身体压根） */}
      <g fill={ICE} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <path d="M90 170 L96 156 L104 168 Z" />
        <path d="M108 162 L116 146 L124 160 Z" />
        <path d="M130 158 L138 144 L146 158 Z" />
      </g>
      {/* 身体（低趴宽体，三段花色） */}
      <ellipse cx={128} cy={196} rx={54} ry={34} fill={GREEN} stroke={OUTLINE} strokeWidth={6} />
      {/* 三段花色分区（焰橙左段 / 霜蓝右段，中段本色） */}
      <path d="M76 188 Q90 172 106 168 Q100 196 102 224 Q88 220 78 208 Q74 198 76 188 Z" fill={FLAME} opacity={0.85} />
      <path d="M180 188 Q166 172 150 168 Q156 196 154 224 Q168 220 178 208 Q182 198 180 188 Z" fill={ICE} opacity={0.85} />
      <ellipse cx={128} cy={212} rx={28} ry={14} fill={CREAM} opacity={0.95} />
      {/* 分段细线 */}
      <path d="M106 170 Q102 196 104 222 M150 170 Q154 196 152 222" fill="none" stroke={OUTLINE} strokeWidth={2.4} opacity={0.35} />
      {/* 小抓手 */}
      <g transform={place(92, 206, 22)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 Q-4 8 -9 9 M0 0 Q2 9 -1 12" fill="none" stroke={GREEN_DEEP} strokeWidth={5.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(164, 206, -22)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 Q4 8 9 9 M0 0 Q-2 9 1 12" fill="none" stroke={GREEN_DEEP} strokeWidth={5.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 小脚 */}
      <g transform={place(108, 232)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={GREEN} deep={GREEN_DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(148, 232)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={GREEN} deep={GREEN_DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      {/* 炮塔眼座（变色龙签名：眼睛长在凸起眼座上） */}
      <g fill={GREEN} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={104} cy={172} r={14} />
        <circle cx={152} cy={172} r={14} />
      </g>
      <circle cx={104} cy={172} r={8} fill={FLAME} opacity={0.5} />
      <circle cx={152} cy={172} r={8} fill={ICE} opacity={0.6} />
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={104} cx2={152} cy={172} r={7.5} mouthY={196} mouthW={20} expression={expression} base={eyes} />
        <Blush cx1={94} cx2={162} cy={188} />
      </g>
      {/* 头顶：一小滴颜料呆毛（headtop 呼吸摇） */}
      <g transform={place(128, 158)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-3 -5 0 -10 Q5 -6 3 0 Q1 3 0 2 Z" fill="#B99BE8" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(194, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：低趴踱步，炮塔眼朝前，螺旋卷尾在身后立圈，背冠一排。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 大螺旋卷尾（身后立圈） */}
      <g transform={place(78, 202)}>
        <Part name="tail" origin="80% 80%">
          <path
            d="M0 6 Q-28 8 -34 -12 Q-38 -30 -22 -34 Q-8 -37 -5 -24 Q-3 -14 -14 -13 Q-22 -13 -21 -21 Q-20 -27 -15 -26"
            fill="none"
            stroke={GREEN_DEEP}
            strokeWidth={11}
            strokeLinecap="round"
          />
          <path d="M0 6 Q-28 8 -34 -12 Q-38 -30 -22 -34" fill="none" stroke={FLAME} strokeWidth={4} strokeLinecap="round" opacity={0.85} />
        </Part>
      </g>
      {/* 锯齿背冠（沿背脊） */}
      <g fill={ICE} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <path d="M96 176 L102 162 L110 174 Z" />
        <path d="M116 168 L124 152 L132 166 Z" />
        <path d="M138 166 L146 152 L154 166 Z" />
      </g>
      {/* 身体（低趴长身，前后双色段） */}
      <ellipse cx={128} cy={200} rx={52} ry={32} fill={GREEN} stroke={OUTLINE} strokeWidth={6} />
      <path d="M80 192 Q92 176 108 172 Q102 200 104 226 Q90 222 82 210 Q78 200 80 192 Z" fill={ICE} opacity={0.85} />
      <path d="M176 192 Q164 176 148 172 Q154 200 152 226 Q166 222 174 210 Q178 200 176 192 Z" fill={FLAME} opacity={0.85} />
      <ellipse cx={128} cy={216} rx={26} ry={12} fill={CREAM} opacity={0.95} />
      <path d="M108 174 Q104 200 106 224 M148 174 Q152 200 150 224" fill="none" stroke={OUTLINE} strokeWidth={2.4} opacity={0.35} />
      {/* 小抓手（一前一后） */}
      <g transform={place(114, 218, 14)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 Q-4 7 -8 8 M0 0 Q2 8 -1 11" fill="none" stroke={GREEN_DEEP} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(148, 216, -16)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 Q4 7 8 8 M0 0 Q-2 8 1 11" fill="none" stroke={GREEN_DEEP} strokeWidth={5.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 小脚（迈步） */}
      <g transform={place(106, 232)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={GREEN} deep={GREEN_DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      <g transform={place(150, 232)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={GREEN} deep={GREEN_DEEP} rx={8} ry={4.5} lift={4} />
        </Part>
      </g>
      {/* 炮塔眼座（朝前单座） */}
      <circle cx={160} cy={174} r={14} fill={GREEN} stroke={OUTLINE} strokeWidth={4.5} />
      <circle cx={160} cy={174} r={8} fill={FLAME} opacity={0.5} />
      {/* 脸（侧脸 + 大弧嘴） */}
      <g className="part-face">
        <ExpSideFace cx={162} cy={172} r={7.5} mouthX={172} mouthY={196} mouthW={16} expression={expression} base={eyes} />
        <ellipse cx={150} cy={192} rx={7} ry={4.5} fill="#F5A8C6" opacity={0.7} />
      </g>
      {/* 头顶：颜料呆毛 */}
      <g transform={place(142, 156)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-3 -5 0 -10 Q5 -6 3 0 Q1 3 0 2 Z" fill="#B99BE8" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：卷尾立成圆枕，身子歪靠上去睡，背冠贴伏，一侧眼座先垂下。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 卷尾圆枕（右侧立圈，先画作枕） */}
      <g transform={place(184, 208)}>
        <Part name="tail" origin="30% 80%">
          <path
            d="M0 6 Q26 8 32 -12 Q36 -30 20 -34 Q6 -37 3 -24 Q1 -14 12 -13 Q20 -13 19 -21 Q18 -27 13 -26"
            fill="none"
            stroke={GREEN_DEEP}
            strokeWidth={11}
            strokeLinecap="round"
          />
          <path d="M0 6 Q26 8 32 -12 Q36 -30 20 -34" fill="none" stroke={FLAME} strokeWidth={4} strokeLinecap="round" opacity={0.85} />
        </Part>
      </g>
      {/* 锯齿背冠（贴伏） */}
      <g fill={ICE} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <path d="M78 186 L84 174 L92 184 Z" />
        <path d="M98 180 L106 166 L114 178 Z" />
        <path d="M122 176 L130 164 L138 176 Z" />
      </g>
      {/* 身体（低趴歪靠向尾枕） */}
      <ellipse cx={118} cy={206} rx={50} ry={28} fill={GREEN} stroke={OUTLINE} strokeWidth={6} />
      <path d="M72 198 Q84 184 100 180 Q94 206 96 228 Q82 224 74 214 Q70 206 72 198 Z" fill={FLAME} opacity={0.85} />
      <path d="M164 198 Q154 184 138 180 Q144 206 142 228 Q156 224 162 214 Q166 206 164 198 Z" fill={ICE} opacity={0.85} />
      <ellipse cx={118} cy={220} rx={24} ry={11} fill={CREAM} opacity={0.95} />
      {/* 小抓手（收在身前） */}
      <g transform={place(96, 224, 16)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 Q-4 6 -8 7 M0 0 Q2 7 -1 9" fill="none" stroke={GREEN_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(136, 226, -14)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 Q4 6 8 7 M0 0 Q-2 7 1 9" fill="none" stroke={GREEN_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 小脚（摊平） */}
      <g transform={place(102, 233)}>
        <Part name="legL" origin="50% -30%">
          <StubLeg color={GREEN} deep={GREEN_DEEP} rx={7.5} ry={4} lift={2} />
        </Part>
      </g>
      <g transform={place(142, 233)}>
        <Part name="legR" origin="50% -30%">
          <StubLeg color={GREEN} deep={GREEN_DEEP} rx={7.5} ry={4} lift={2} />
        </Part>
      </g>
      {/* 炮塔眼座（一高一低——一只眼先睡） */}
      <g fill={GREEN} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={98} cy={184} r={13} />
        <circle cx={140} cy={190} r={12} />
      </g>
      <circle cx={98} cy={184} r={7.5} fill={FLAME} opacity={0.5} />
      <circle cx={140} cy={190} r={7} fill={ICE} opacity={0.6} />
      {/* 脸（睡，头歪向尾枕） */}
      <g className="part-face">
        <ExpFace cx1={98} cx2={140} cy={186} r={7} mouthY={208} mouthW={16} expression={expression} base={eyes} />
        <Blush cx1={88} cx2={150} cy={200} />
      </g>
      {/* 头顶：颜料呆毛（塌） */}
      <g transform={place(118, 170, 10)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 2 Q-3 -4 0 -9 Q5 -5 3 0 Q1 3 0 2 Z" fill="#B99BE8" stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
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

const paintFlame: ParticleRenderer = () => (
  <path d="M0 -6 q5 5.5 5 9 a5 5 0 0 1 -10 0 q0 -3.5 5 -9 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);
const paintLeaf: ParticleRenderer = () => (
  <path d="M0 -6 q5 5.5 5 9 a5 5 0 0 1 -10 0 q0 -3.5 5 -9 z" fill={GREEN} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);
const paintIce: ParticleRenderer = () => (
  <path d="M0 -6 q5 5.5 5 9 a5 5 0 0 1 -10 0 q0 -3.5 5 -9 z" fill={ICE} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.2,
    palette: { body: GREEN, deep: GREEN_DEEP, belly: CREAM, accent: FLAME, accent2: ICE },
    foodAnchor: { x: 128, y: 196 },
    shadowRx: 60,
  },
  // 调色盘画笔：拇指孔调色盘 + 三色颜料 + 一支笔
  tool: () => (
    <g>
      <g transform="rotate(-10)">
        <path d="M-16 -8 Q-20 -24 -4 -28 Q14 -31 18 -18 Q20 -8 10 -6 Q8 -1 2 -2 Q-8 -3 -16 -8 Z" fill="#E2C08A" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        <circle cx={-4} cy={-12} r={3.4} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2} />
        <circle cx={-8} cy={-20} r={3} fill={FLAME} stroke={OUTLINE} strokeWidth={1.8} />
        <circle cx={1} cy={-23} r={3} fill={GREEN} stroke={OUTLINE} strokeWidth={1.8} />
        <circle cx={10} cy={-20} r={3} fill={ICE} stroke={OUTLINE} strokeWidth={1.8} />
      </g>
      <g transform="translate(16 -6) rotate(36)">
        <path d="M-1.8 0 L1.8 0 L1.4 -20 L-1.4 -20 Z" fill="#B98A4E" stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        <path d="M-1.4 -20 L1.4 -20 L0 -27 Z" fill="#B99BE8" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      </g>
    </g>
  ),
  workFx: {
    emitter: { x: 200, y: 202 },
    baseAngle: -Math.PI / 2.4,
    cone: 0.6,
    shapes: [paintFlame, paintLeaf, paintIce],
  },
  meta: {
    nameZh: "四季龙",
    elements: ["fire", "grass", "ice"],
    family: "蛇形爬行",
    toolAnchor: { x: 194, y: 231 },
    nodeBudget: 205,
    lieNote: "卷尾圈成圆枕，一只眼先睡",
  },
};
