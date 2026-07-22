// ---------------------------------------------------------------------------
// 舞龙灯 lanternloong — e4（electric+fire+grass+ice）· 傀儡构装
// 剪影：纸扎小龙灯：大灯笼龙头（须+角+腮），身后两节发光灯身
//       各透一色元素光（e4 环绕件 aura），竹篾骨架，底部流苏。节庆巡游台柱。
// 睡姿（P3）：龙身瘪下来叠成一摞，头枕灯架。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const PAPER = "#E2432E";
const PAPER_DEEP = "#B32E17";
const GLOW = "#FFF1C9";
const GOLD = "#FFD93B";
const ICE = "#8FD8E8";
const LEAF = "#8CD97B";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* e4 环绕件：身后两节灯身（各透一色元素光，part-aura 呼吸发光） */}
      <g className="part-aura">
        <g transform={place(78, 172, -14)}>
          <ellipse cx={0} cy={0} rx={22} ry={28} fill={LEAF} opacity={0.9} stroke={OUTLINE} strokeWidth={4.5} />
          <path d="M-22 0 Q0 8 22 0 M-20 -12 Q0 -5 20 -12 M-20 12 Q0 20 20 12" fill="none" stroke={OUTLINE} strokeWidth={2} opacity={0.4} />
          <ellipse cx={-4} cy={-6} rx={7} ry={10} fill="#FFFFFF" opacity={0.5} />
        </g>
        <g transform={place(182, 176, 14)}>
          <ellipse cx={0} cy={0} rx={20} ry={26} fill={ICE} opacity={0.9} stroke={OUTLINE} strokeWidth={4.5} />
          <path d="M-20 0 Q0 8 20 0 M-18 -11 Q0 -4 18 -11 M-18 11 Q0 18 18 11" fill="none" stroke={OUTLINE} strokeWidth={2} opacity={0.4} />
          <ellipse cx={-3} cy={-5} rx={6} ry={9} fill="#FFFFFF" opacity={0.5} />
        </g>
      </g>
      {/* 尾：末节小灯笼拖着彩带（右下） */}
      <g transform={place(196, 208, 18)}>
        <Part name="tail" origin="0% 50%">
          <circle cx={8} cy={0} r={10} fill={GOLD} stroke={OUTLINE} strokeWidth={3.6} />
          <path d="M14 8 q4 8 0 14 M18 6 q6 6 4 13" fill="none" stroke={PAPER} strokeWidth={2.6} strokeLinecap="round" />
        </Part>
      </g>
      {/* 撑杆两根（构装感：从灯身下方到地） */}
      <g stroke="#B98A4E" strokeWidth={5} strokeLinecap="round">
        <path d="M96 196 L92 230" />
        <path d="M160 198 L164 230" />
      </g>
      {/* 主灯笼龙头（大圆灯，纸骨line + 发光内芯） */}
      <ellipse cx={128} cy={150} rx={52} ry={56} fill={PAPER} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={128} cy={150} rx={36} ry={44} fill={PAPER_DEEP} opacity={0.4} />
      <ellipse cx={120} cy={136} rx={18} ry={24} fill={GLOW} opacity={0.55} />
      {/* 竹篾骨架横纹 */}
      <g fill="none" stroke={OUTLINE} strokeWidth={2.2} opacity={0.4}>
        <path d="M78 136 Q128 148 178 136" />
        <path d="M78 164 Q128 176 178 164" />
      </g>
      {/* 龙腮鳍纸扇（左右） */}
      <g stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round">
        <path d="M80 132 Q64 124 58 108 Q76 108 86 120 Z" fill={GOLD} />
        <path d="M176 132 Q192 124 198 108 Q180 108 170 120 Z" fill={GOLD} />
      </g>
      {/* 龙须（金线卷须） */}
      <g fill="none" stroke={GOLD} strokeWidth={3} strokeLinecap="round">
        <path d="M100 186 Q88 196 76 194 Q70 193 70 188" />
        <path d="M156 186 Q168 196 180 194 Q186 193 186 188" />
      </g>
      {/* 小手（提灯小木手） */}
      <g transform={place(96, 200, 24)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6} ry={9} fill={GOLD} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(160, 200, -24)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6} ry={9} fill={GOLD} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 流苏脚（红黄穗） */}
      <g transform={place(110, 230)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-6 -8 L6 -8 L5 0 L-5 0 Z" fill={GOLD} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
          <path d="M-4 0 v6 M0 0 v7 M4 0 v6" stroke={PAPER} strokeWidth={2.6} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(146, 230)}>
        <Part name="legR" origin="50% -40%">
          <path d="M-6 -8 L6 -8 L5 0 L-5 0 Z" fill={GOLD} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
          <path d="M-4 0 v6 M0 0 v7 M4 0 v6" stroke={PAPER} strokeWidth={2.6} strokeLinecap="round" />
        </Part>
      </g>
      {/* 脸（灯面上的龙脸：圆眼 + 宽鼻头） */}
      <g className="part-face">
        <ExpFace cx1={110} cx2={146} cy={144} r={9.5} mouthY={172} mouthW={16} expression={expression} base={eyes} />
        <ellipse cx={128} cy={162} rx={10} ry={6} fill={GOLD} stroke={OUTLINE} strokeWidth={3} />
        <Blush cx1={98} cx2={158} cy={160} />
      </g>
      {/* 头顶：一对纸扎鹿角 + 火苗顶珠（headtop 呼吸摇） */}
      <g transform={place(128, 96)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={GOLD} strokeWidth={5} strokeLinecap="round">
            <path d="M-14 2 Q-18 -10 -12 -16 M-14 -8 Q-20 -10 -24 -8" />
            <path d="M14 2 Q18 -10 12 -16 M14 -8 Q20 -10 24 -8" />
          </g>
          <path d="M0 -2 q-4 -5 -2 -10 q3 2.5 3 6 q2.5 -4 1 -8 q5 3.5 3.5 9 q-1.5 4.5 -5.5 3 z" fill="#FFB03A" stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(200, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：巡游队形——龙头灯在前，两节灯身拖后，尾灯压阵，撑杆随行。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 身后两节灯身（拖行，元素光） */}
      <g className="part-aura">
        <g transform={place(92, 176, -8)}>
          <ellipse cx={0} cy={0} rx={20} ry={26} fill={LEAF} opacity={0.9} stroke={OUTLINE} strokeWidth={4.5} />
          <path d="M-20 0 Q0 8 20 0 M-18 -11 Q0 -4 18 -11" fill="none" stroke={OUTLINE} strokeWidth={2} opacity={0.4} />
          <ellipse cx={-4} cy={-5} rx={6} ry={9} fill="#FFFFFF" opacity={0.5} />
        </g>
        <g transform={place(58, 190, -14)}>
          <ellipse cx={0} cy={0} rx={17} ry={22} fill={ICE} opacity={0.9} stroke={OUTLINE} strokeWidth={4.5} />
          <path d="M-17 0 Q0 7 17 0" fill="none" stroke={OUTLINE} strokeWidth={2} opacity={0.4} />
          <ellipse cx={-3} cy={-4} rx={5} ry={7.5} fill="#FFFFFF" opacity={0.5} />
        </g>
      </g>
      {/* 尾：末节小灯笼拖彩带（队尾） */}
      <g transform={place(40, 210)}>
        <Part name="tail" origin="100% 50%">
          <circle cx={-4} cy={0} r={9} fill={GOLD} stroke={OUTLINE} strokeWidth={3.4} />
          <path d="M-10 7 q-4 7 -1 13 M-14 4 q-6 6 -5 12" fill="none" stroke={PAPER} strokeWidth={2.4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 撑杆（两根随行） */}
      <g stroke="#B98A4E" strokeWidth={5} strokeLinecap="round">
        <path d="M92 198 L88 230" />
        <path d="M152 204 L156 230" />
      </g>
      {/* 主灯笼龙头（在前） */}
      <ellipse cx={150} cy={152} rx={46} ry={50} fill={PAPER} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={150} cy={152} rx={32} ry={39} fill={PAPER_DEEP} opacity={0.4} />
      <ellipse cx={142} cy={138} rx={16} ry={21} fill={GLOW} opacity={0.55} />
      <g fill="none" stroke={OUTLINE} strokeWidth={2.2} opacity={0.4}>
        <path d="M106 140 Q150 152 194 140" />
        <path d="M106 164 Q150 176 194 164" />
      </g>
      {/* 龙腮鳍纸扇（脑后一面） */}
      <path d="M112 130 Q96 122 90 106 Q108 106 118 118 Z" fill={GOLD} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
      {/* 龙须（前卷金线） */}
      <g fill="none" stroke={GOLD} strokeWidth={3} strokeLinecap="round">
        <path d="M182 184 Q194 192 202 188 Q206 186 205 182" />
        <path d="M170 192 Q176 202 186 202" />
      </g>
      {/* 小木手（提灯走） */}
      <g transform={place(118, 202, 22)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6} ry={9} fill={GOLD} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(162, 206, -22)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={8} rx={6} ry={9} fill={GOLD} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 流苏脚（迈步） */}
      <g transform={place(116, 230)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-6 -8 L6 -8 L5 0 L-5 0 Z" fill={GOLD} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
          <path d="M-4 0 v6 M0 0 v7 M4 0 v6" stroke={PAPER} strokeWidth={2.6} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(150, 231)}>
        <Part name="legR" origin="50% -40%">
          <path d="M-6 -8 L6 -8 L5 0 L-5 0 Z" fill={GOLD} stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
          <path d="M-4 0 v6 M0 0 v7 M4 0 v6" stroke={PAPER} strokeWidth={2.6} strokeLinecap="round" />
        </Part>
      </g>
      {/* 脸（灯面龙脸侧相） */}
      <g className="part-face">
        <ExpSideFace cx={164} cy={144} r={9.5} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={178} cy={162} rx={9} ry={5.5} fill={GOLD} stroke={OUTLINE} strokeWidth={3} />
        <path d="M176 174 q7 5 14 0" fill="none" stroke={OUTLINE} strokeWidth={3.2} strokeLinecap="round" />
        <ellipse cx={152} cy={164} rx={7} ry={4.5} fill="#F5917B" opacity={0.6} />
      </g>
      {/* 头顶：纸扎鹿角 + 火苗顶珠（前倾） */}
      <g transform={place(150, 100, 6)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={GOLD} strokeWidth={5} strokeLinecap="round">
            <path d="M-14 2 Q-18 -10 -12 -16 M-14 -8 Q-20 -10 -24 -8" />
            <path d="M14 2 Q18 -10 12 -16 M14 -8 Q20 -10 24 -8" />
          </g>
          <path d="M0 -2 q-4 -5 -2 -10 q3 2.5 3 6 q2.5 -4 1 -8 q5 3.5 3.5 9 q-1.5 4.5 -5.5 3 z" fill="#FFB03A" stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：收灯歇工——两节灯身瘪成一摞叠在旁，龙头灯枕在交叉灯架上打盹。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 瘪下来叠成一摞的灯身 */}
      <g className="part-aura">
        <g transform={place(84, 208)}>
          <ellipse cx={0} cy={0} rx={26} ry={10} fill={LEAF} opacity={0.9} stroke={OUTLINE} strokeWidth={4} />
          <path d="M-24 0 Q0 5 24 0" fill="none" stroke={OUTLINE} strokeWidth={2} opacity={0.4} />
        </g>
        <g transform={place(84, 224)}>
          <ellipse cx={0} cy={0} rx={30} ry={9} fill={ICE} opacity={0.9} stroke={OUTLINE} strokeWidth={4} />
          <path d="M-28 0 Q0 5 28 0" fill="none" stroke={OUTLINE} strokeWidth={2} opacity={0.4} />
        </g>
      </g>
      {/* 尾：末节小灯笼靠在摞边 */}
      <g transform={place(46, 224)}>
        <Part name="tail" origin="100% 50%">
          <circle cx={-4} cy={0} r={8.5} fill={GOLD} stroke={OUTLINE} strokeWidth={3.2} />
          <path d="M-9 6 q-3 6 -1 11" fill="none" stroke={PAPER} strokeWidth={2.4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 交叉灯架（头枕处） */}
      <g stroke="#B98A4E" strokeWidth={5.5} strokeLinecap="round">
        <path d="M138 231 L172 196" />
        <path d="M186 231 L154 194" />
      </g>
      <path d="M150 208 L178 206" stroke="#8A6410" strokeWidth={3.4} strokeLinecap="round" />
      {/* 主灯笼龙头（枕在灯架上，微斜） */}
      <g transform="rotate(-8 158 172)">
        <ellipse cx={158} cy={172} rx={42} ry={45} fill={PAPER} stroke={OUTLINE} strokeWidth={6} />
        <ellipse cx={158} cy={172} rx={29} ry={35} fill={PAPER_DEEP} opacity={0.4} />
        <ellipse cx={150} cy={160} rx={14} ry={19} fill={GLOW} opacity={0.5} />
        <g fill="none" stroke={OUTLINE} strokeWidth={2.2} opacity={0.4}>
          <path d="M118 162 Q158 172 198 162" />
          <path d="M120 184 Q158 194 196 184" />
        </g>
      </g>
      {/* 龙腮鳍（垂下一面） */}
      <path d="M122 150 Q106 144 100 130 Q116 130 126 140 Z" fill={GOLD} stroke={OUTLINE} strokeWidth={3.2} strokeLinejoin="round" />
      {/* 龙须（垂地） */}
      <g fill="none" stroke={GOLD} strokeWidth={3} strokeLinecap="round">
        <path d="M136 208 Q128 218 118 218" />
        <path d="M180 210 Q188 220 196 218" />
      </g>
      {/* 小木手（搭在灯身摞上） */}
      <g transform={place(108, 202, 62)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8.5} fill={GOLD} stroke={OUTLINE} strokeWidth={3.8} />
        </Part>
      </g>
      <g transform={place(126, 212, -58)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8.5} fill={GOLD} stroke={OUTLINE} strokeWidth={3.8} />
        </Part>
      </g>
      {/* 流苏脚（摊在架旁） */}
      <g transform={place(148, 231)}>
        <Part name="legL" origin="50% -40%">
          <path d="M-5.5 -7 L5.5 -7 L4.5 0 L-4.5 0 Z" fill={GOLD} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
          <path d="M-3.5 0 v5 M0 0 v6 M3.5 0 v5" stroke={PAPER} strokeWidth={2.4} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(178, 231)}>
        <Part name="legR" origin="50% -40%">
          <path d="M-5.5 -7 L5.5 -7 L4.5 0 L-4.5 0 Z" fill={GOLD} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round" />
          <path d="M-3.5 0 v5 M0 0 v6 M3.5 0 v5" stroke={PAPER} strokeWidth={2.4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 脸（灯面睡龙颜） */}
      <g className="part-face">
        <ExpFace cx1={144} cx2={176} cy={166} r={9} mouthY={192} mouthW={14} expression={expression} base={eyes} />
        <ellipse cx={160} cy={184} rx={9} ry={5.5} fill={GOLD} stroke={OUTLINE} strokeWidth={3} />
        <Blush cx1={134} cx2={188} cy={180} />
      </g>
      {/* 头顶：鹿角耷拉 + 火苗顶珠转小 */}
      <g transform={place(156, 124, -10)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={GOLD} strokeWidth={4.5} strokeLinecap="round">
            <path d="M-13 2 Q-18 -6 -14 -13 M-13 -6 Q-19 -7 -22 -5" />
            <path d="M13 2 Q18 -6 14 -13 M13 -6 Q19 -7 22 -5" />
          </g>
          <path d="M0 -2 q-3 -4 -1.5 -8 q2.5 2 2.5 5 q2 -3 1 -6 q4 3 2.5 7 q-1.5 3.5 -4.5 2 z" fill="#FFB03A" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
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

const paperLantern: ParticleRenderer = () => (
  <g>
    <rect x={-5} y={-9} width={10} height={2.6} rx={1} fill={GOLD} stroke={OUTLINE} strokeWidth={1.6} />
    <ellipse cx={0} cy={-0.4} rx={6.4} ry={7} fill={PAPER} stroke={OUTLINE} strokeWidth={2} />
    <path d="M-3 -6.4 Q-4.2 -0.4 -3 5.6 M0 -7.4 V6.6 M3 -6.4 Q4.2 -0.4 3 5.6" fill="none" stroke={PAPER_DEEP} strokeWidth={1.4} opacity={0.7} />
    <rect x={-5} y={6} width={10} height={2.6} rx={1} fill={GOLD} stroke={OUTLINE} strokeWidth={1.6} />
    <path d="M-1.6 8.6 v3 M0 8.6 v3.6 M1.6 8.6 v3" stroke={PAPER_DEEP} strokeWidth={1.6} strokeLinecap="round" />
  </g>
);
const festivalDrum: ParticleRenderer = () => (
  <g>
    <path d="M-8 -6 Q-10.5 0 -8 6 L8 6 Q10.5 0 8 -6 Z" fill={PAPER} stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
    <ellipse cx={-8} cy={0} rx={2.4} ry={6.2} fill={GLOW} stroke={OUTLINE} strokeWidth={1.8} />
    <ellipse cx={8} cy={0} rx={2.4} ry={6.2} fill={GLOW} stroke={OUTLINE} strokeWidth={1.8} />
    <path d="M-6 -4.5 L6 4.5 M-6 4.5 L6 -4.5" stroke={GOLD} strokeWidth={1.6} strokeLinecap="round" />
  </g>
);
const confetti: ParticleRenderer = (rand) => {
  const cols = [GOLD, ICE, LEAF, PAPER];
  const c = cols[Math.floor(rand() * cols.length)];
  return (
    <rect
      x={-3.4}
      y={-3.4}
      width={6.8}
      height={6.8}
      rx={1.4}
      fill={c}
      stroke={OUTLINE}
      strokeWidth={1.8}
      transform={`rotate(${Math.floor(rand() * 80 - 40)})`}
    />
  );
};

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.08,
    palette: { body: PAPER, deep: PAPER_DEEP, belly: GLOW, accent: GOLD, accent2: ICE },
    foodAnchor: { x: 128, y: 172 },
    shadowRx: 62,
  },
  // 舞龙杆：长杆 + 杆头红绸结
  tool: () => (
    <g>
      <path d="M-2.4 0 L2.4 0 L2 -48 L-2 -48 Z" fill="#B98A4E" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M0 -48 Q-8 -52 -10 -58 M0 -48 Q8 -52 10 -58" fill="none" stroke={PAPER} strokeWidth={3.4} strokeLinecap="round" />
      <circle cx={0} cy={-50} r={4} fill={GOLD} stroke={OUTLINE} strokeWidth={2.4} />
      <path d="M-4 -20 h8" stroke={PAPER} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M-4 -34 h8" stroke={PAPER} strokeWidth={2.6} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 200, y: 184 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.7,
    shapes: [paperLantern, festivalDrum, confetti],
  },
  meta: {
    nameZh: "舞龙灯",
    elements: ["electric", "fire", "grass", "ice"],
    family: "傀儡构装",
    toolAnchor: { x: 200, y: 231 },
    nodeBudget: 255,
    lieNote: "龙身瘪下来叠成一摞，头枕灯架",
  },
};
