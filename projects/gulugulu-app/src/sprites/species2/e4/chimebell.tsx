// ---------------------------------------------------------------------------
// 风铃草 chimebell — e4（electric+grass+ice+normal）· 植物体
// 剪影：倒挂风铃草精灵：头=垂钟花冠（扇贝檐+冰晶铃舌，招牌），
//       茎身叶手，音符轨道环绕（e4 环绕件 orbit）。禅意音疗师。
// 睡姿（P3）：花铃罩下来当睡帽，叶手合拢。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BELL = "#9FA8E8";
const BELL_DEEP = "#7280C9";
const STEM = "#57B84C";
const STEM_DEEP = "#3B8F33";
const CREAM = "#FFF8EE";
const ICE = "#8FD8E8";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e4 环绕件：音符轨道（part-orbit 慢转） */}
      <g transform={place(128, 160)}>
        <g className="part-orbit">
          <g stroke={OUTLINE} strokeLinecap="round">
            <g transform="translate(-60 6)">
              <path d="M-2 5 a3 3 0 1 0 0.1 0 M1 4 V-5 Q1 -6.5 3 -6 L5.5 -5.2" fill={BELL_DEEP} strokeWidth={2} />
            </g>
            <g transform="translate(60 -6)">
              <path d="M-2 5 a3 3 0 1 0 0.1 0 M1 4 V-5 Q1 -6.5 3 -6 L5.5 -5.2" fill={STEM} strokeWidth={2} />
            </g>
            <g transform="translate(4 -46)">
              <path d="M0 -5 L3.5 0 L0 5 L-3.5 0 Z" fill={ICE} strokeWidth={1.8} stroke={OUTLINE} />
            </g>
            <g transform="translate(-4 40)">
              <path d="M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4 Z" fill="#FFD93B" strokeWidth={1.6} stroke={OUTLINE} />
            </g>
          </g>
        </g>
      </g>
      {/* 尾：茎后垂下的一片叶（左下） */}
      <g transform={place(100, 214, -24)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 q-14 4 -18 14 q12 2 18 -6 q2 -4 0 -8 z" fill={STEM} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 茎身（纤细，微弯） */}
      <path d="M122 150 Q118 180 122 212 Q128 218 134 212 Q138 180 134 150 Z" fill={STEM} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
      {/* 叶手（合十向前的圆叶） */}
      <g transform={place(116, 182, 40)}>
        <Part name="armL" origin="100% 20%">
          <path d="M0 0 Q-16 0 -22 -10 Q-10 -18 -2 -8 Q1 -4 0 0 Z" fill={STEM} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(140, 182, -40)}>
        <Part name="armR" origin="0% 20%">
          <path d="M0 0 Q16 0 22 -10 Q10 -18 2 -8 Q-1 -4 0 0 Z" fill={STEM} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 根足 */}
      <g transform={place(116, 230)}>
        <Part name="legL" origin="50% -30%">
          <path d="M0 -10 Q-4 -4 -8 0 M0 -10 Q-1 -4 -2 0" fill="none" stroke={STEM_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(140, 230)}>
        <Part name="legR" origin="50% -30%">
          <path d="M0 -10 Q4 -4 8 0 M0 -10 Q1 -4 2 0" fill="none" stroke={STEM_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 垂钟花冠（招牌：倒挂大钟=头，扇贝下檐 + 檐口小卷） */}
      <g>
        <path
          d="M92 96 Q92 62 128 62 Q164 62 164 96 Q164 120 158 134 Q152 146 143 146 Q138 138 128 138 Q118 138 113 146 Q104 146 98 134 Q92 120 92 96 Z"
          fill={BELL}
          stroke={OUTLINE}
          strokeWidth={5.5}
          strokeLinejoin="round"
        />
        {/* 檐口扇贝 + 上卷小角 */}
        <path d="M98 132 Q104 140 113 144 M158 132 Q152 140 143 144" fill="none" stroke={BELL_DEEP} strokeWidth={3} strokeLinecap="round" />
        <path d="M96 128 Q88 130 86 124 M160 128 Q168 130 170 124" fill="none" stroke={BELL} strokeWidth={5} strokeLinecap="round" />
        {/* 花脉 */}
        <path d="M108 74 Q104 100 108 126 M148 74 Q152 100 148 126" fill="none" stroke={BELL_DEEP} strokeWidth={2.6} strokeLinecap="round" opacity={0.8} />
        {/* 冰晶铃舌（钟内垂下，随呼吸微晃=crest） */}
        <g transform="translate(128 140)">
          <g className="part-crest">
            <path d="M0 0 V10" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
            <path d="M0 10 L5 17 L0 26 L-5 17 Z" fill={ICE} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
          </g>
        </g>
      </g>
      {/* 脸（钟面中央） */}
      <g className="part-face">
        <ExpFace cx1={114} cx2={142} cy={98} r={9} mouthY={116} mouthW={12} expression={expression} base={eyes} />
        <Blush cx1={104} cx2={152} cy={110} />
      </g>
      {/* 头顶：花萼三叉 + 挂茎（headtop 呼吸摇） */}
      <g transform={place(128, 62)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 0 Q-2 -10 4 -16" fill="none" stroke={STEM_DEEP} strokeWidth={3.4} strokeLinecap="round" />
          <g fill={STEM} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
            <path d="M-12 2 Q-16 -8 -8 -10 Q-4 -4 -4 2 Z" />
            <path d="M12 2 Q16 -8 8 -10 Q4 -4 4 2 Z" />
            <path d="M-2 0 Q0 -10 2 0 Z" />
          </g>
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

/** 侧视（右向）：钟冠前倾踏步，铃舌向后轻荡，叶手前后摆，音符随行。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 音符轨道（随行） */}
      <g transform={place(128, 158)}>
        <g className="part-orbit">
          <g stroke={OUTLINE} strokeLinecap="round">
            <g transform="translate(-56 6)">
              <path d="M-2 5 a3 3 0 1 0 0.1 0 M1 4 V-5 Q1 -6.5 3 -6 L5.5 -5.2" fill={BELL_DEEP} strokeWidth={2} />
            </g>
            <g transform="translate(56 -6)">
              <path d="M-2 5 a3 3 0 1 0 0.1 0 M1 4 V-5 Q1 -6.5 3 -6 L5.5 -5.2" fill={STEM} strokeWidth={2} />
            </g>
            <g transform="translate(4 -44)">
              <path d="M0 -5 L3.5 0 L0 5 L-3.5 0 Z" fill={ICE} strokeWidth={1.8} stroke={OUTLINE} />
            </g>
          </g>
        </g>
      </g>
      {/* 尾：垂叶（身后） */}
      <g transform={place(104, 212, -26)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 q-14 4 -18 14 q12 2 18 -6 q2 -4 0 -8 z" fill={STEM} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 远侧叶手（后摆） */}
      <g transform={place(120, 186, 52)}>
        <Part name="armL" origin="100% 20%">
          <path d="M0 0 Q-15 0 -20 -9 Q-9 -16 -2 -7 Q1 -4 0 0 Z" fill={STEM_DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 茎身（前倾） */}
      <path d="M124 148 Q120 180 124 212 Q130 218 136 212 Q140 180 136 148 Z" fill={STEM} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
      {/* 根足（踏步） */}
      <g transform={place(118, 230)}>
        <Part name="legL" origin="50% -30%">
          <path d="M0 -10 Q-4 -4 -8 0 M0 -10 Q-1 -4 -2 0" fill="none" stroke={STEM_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(144, 231)}>
        <Part name="legR" origin="50% -30%">
          <path d="M0 -10 Q4 -4 8 0 M0 -10 Q1 -4 2 0" fill="none" stroke={STEM_DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 近侧叶手（前摆） */}
      <g transform={place(142, 182, -48)}>
        <Part name="armR" origin="0% 20%">
          <path d="M0 0 Q16 0 22 -10 Q10 -18 2 -8 Q-1 -4 0 0 Z" fill={STEM} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 垂钟花冠（前倾） */}
      <g>
        <path
          d="M92 96 Q92 62 128 62 Q164 62 164 96 Q164 120 158 134 Q152 146 143 146 Q138 138 128 138 Q118 138 113 146 Q104 146 98 134 Q92 120 92 96 Z"
          fill={BELL}
          stroke={OUTLINE}
          strokeWidth={5.5}
          strokeLinejoin="round"
        />
        <path d="M98 132 Q104 140 113 144 M158 132 Q152 140 143 144" fill="none" stroke={BELL_DEEP} strokeWidth={3} strokeLinecap="round" />
        <path d="M160 128 Q168 130 170 124" fill="none" stroke={BELL} strokeWidth={5} strokeLinecap="round" />
        <path d="M112 74 Q108 100 112 126" fill="none" stroke={BELL_DEEP} strokeWidth={2.6} strokeLinecap="round" opacity={0.8} />
        {/* 冰晶铃舌（向后轻荡） */}
        <g transform="translate(120 140) rotate(-14)">
          <g className="part-crest">
            <path d="M0 0 V10" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
            <path d="M0 10 L5 17 L0 26 L-5 17 Z" fill={ICE} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
          </g>
        </g>
      </g>
      {/* 脸（钟面偏前） */}
      <g className="part-face">
        <ExpSideFace cx={146} cy={96} r={9} mouthX={152} mouthY={114} mouthW={11} expression={expression} base={eyes} />
        <ellipse cx={132} cy={110} rx={6.5} ry={4.5} fill="#F5A8C6" opacity={0.7} />
      </g>
      {/* 头顶：花萼三叉（前倾） */}
      <g transform={place(130, 62, 8)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 0 Q-2 -10 4 -16" fill="none" stroke={STEM_DEEP} strokeWidth={3.4} strokeLinecap="round" />
          <g fill={STEM} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
            <path d="M-12 2 Q-16 -8 -8 -10 Q-4 -4 -4 2 Z" />
            <path d="M12 2 Q16 -8 8 -10 Q4 -4 4 2 Z" />
            <path d="M-2 0 Q0 -10 2 0 Z" />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：花铃整个罩下来当睡帽，叶手在檐前合拢，铃舌搁在地上。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 音符（落地两枚，安静） */}
      <g stroke={OUTLINE} strokeLinecap="round" opacity={0.9}>
        <g transform="translate(66 222)">
          <path d="M-2 5 a3 3 0 1 0 0.1 0 M1 4 V-5 Q1 -6.5 3 -6 L5.5 -5.2" fill={BELL_DEEP} strokeWidth={2} />
        </g>
        <g transform="translate(192 218)">
          <path d="M0 -5 L3.5 0 L0 5 L-3.5 0 Z" fill={ICE} strokeWidth={1.8} stroke={OUTLINE} />
        </g>
      </g>
      {/* 尾：垂叶（摊地） */}
      <g transform={place(90, 228, -58)}>
        <Part name="tail" origin="100% 0%">
          <path d="M0 0 q-13 4 -17 13 q11 2 17 -6 q2 -4 0 -7 z" fill={STEM} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 罩下来的花铃（睡帽，罩住全身） */}
      <g>
        <path
          d="M84 158 Q84 120 128 120 Q172 120 172 158 Q172 184 165 200 Q158 214 147 214 Q141 206 128 206 Q115 206 109 214 Q98 214 91 200 Q84 184 84 158 Z"
          fill={BELL}
          stroke={OUTLINE}
          strokeWidth={5.5}
          strokeLinejoin="round"
        />
        <path d="M91 198 Q98 208 109 212 M165 198 Q158 208 147 212" fill="none" stroke={BELL_DEEP} strokeWidth={3} strokeLinecap="round" />
        <path d="M89 194 Q81 196 79 190 M167 194 Q175 196 177 190" fill="none" stroke={BELL} strokeWidth={5} strokeLinecap="round" />
        <path d="M104 132 Q100 162 104 192 M152 132 Q156 162 152 192" fill="none" stroke={BELL_DEEP} strokeWidth={2.6} strokeLinecap="round" opacity={0.8} />
        {/* 铃舌（垂到地上歇着） */}
        <g transform="translate(128 208)">
          <g className="part-crest">
            <path d="M0 0 V8" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
            <path d="M0 8 L5 15 L0 24 L-5 15 Z" fill={ICE} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
          </g>
        </g>
      </g>
      {/* 叶手（檐前合拢） */}
      <g transform={place(116, 222, 64)}>
        <Part name="armL" origin="100% 20%">
          <path d="M0 0 Q-14 0 -19 -8 Q-9 -15 -2 -7 Q1 -3 0 0 Z" fill={STEM} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      <g transform={place(140, 222, -64)}>
        <Part name="armR" origin="0% 20%">
          <path d="M0 0 Q14 0 19 -8 Q9 -15 2 -7 Q-1 -3 0 0 Z" fill={STEM} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 根足尖（檐下微露） */}
      <g transform={place(112, 232)}>
        <Part name="legL" origin="50% -30%">
          <path d="M0 -6 Q-3 -3 -6 0 M0 -6 Q-1 -3 -1 0" fill="none" stroke={STEM_DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(146, 232)}>
        <Part name="legR" origin="50% -30%">
          <path d="M0 -6 Q3 -3 6 0 M0 -6 Q1 -3 1 0" fill="none" stroke={STEM_DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 脸（钟面睡颜） */}
      <g className="part-face">
        <ExpFace cx1={114} cx2={142} cy={158} r={9} mouthY={176} mouthW={12} expression={expression} base={eyes} />
        <Blush cx1={104} cx2={152} cy={170} />
      </g>
      {/* 头顶：花萼（安睡朝上） */}
      <g transform={place(128, 120)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M0 0 Q-2 -9 3 -14" fill="none" stroke={STEM_DEEP} strokeWidth={3.2} strokeLinecap="round" />
          <g fill={STEM} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
            <path d="M-11 2 Q-15 -7 -7 -9 Q-4 -4 -4 2 Z" />
            <path d="M11 2 Q15 -7 7 -9 Q4 -4 4 2 Z" />
            <path d="M-2 0 Q0 -9 2 0 Z" />
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

const noteBit: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinecap="round">
    <path d="M-2 6 a3.5 3.5 0 1 0 0.1 0 M1.5 5 V-6 Q1.5 -8 4 -7.5 L7 -6.5" fill={BELL_DEEP} strokeWidth={2.2} />
  </g>
);
const iceBit: ParticleRenderer = () => (
  <path d="M0 -7 L4.5 0 L0 7 L-4.5 0 Z" fill="#F7FCFD" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);
const petalBit: ParticleRenderer = () => (
  <path d="M0 -7 Q6 -3 4 4 Q0 8 -4 4 Q-6 -3 0 -7 Z" fill={BELL} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1,
    palette: { body: BELL, deep: BELL_DEEP, belly: CREAM, accent: ICE, accent2: STEM },
    foodAnchor: { x: 128, y: 116 },
    shadowRx: 50,
  },
  // 手持竖琴：小竖琴 + 拨出的音波
  tool: () => (
    <g>
      <path d="M-8 0 Q-16 -18 -6 -34 Q-2 -38 2 -36 Q-6 -22 0 -4 Z" fill="#D9A514" stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      <path d="M2 -36 Q14 -34 14 -22 Q14 -10 4 -2 L0 -4 Q10 -12 10 -22 Q10 -30 0 -32 Z" fill="#F5C542" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <g stroke="#FFF7DD" strokeWidth={1.6}>
        <path d="M-2 -30 L6 -8 M-4 -26 L3 -7 M-6 -20 L0 -6" />
      </g>
      <path d="M16 -28 a9 9 0 0 1 4 7" fill="none" stroke={BELL_DEEP} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 196, y: 200 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.6,
    shapes: [noteBit, iceBit, petalBit],
  },
  meta: {
    nameZh: "风铃草",
    elements: ["electric", "grass", "ice", "normal"],
    family: "植物体",
    toolAnchor: { x: 192, y: 231 },
    nodeBudget: 255,
    lieNote: "花铃罩下来当睡帽，叶手合拢",
  },
};
