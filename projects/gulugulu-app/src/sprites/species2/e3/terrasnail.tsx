// ---------------------------------------------------------------------------
// 苔壳蜗 terrasnail — e3（grass+ice+water）· 甲壳
// 剪影：软糯薄荷蜗牛，壳=玻璃冰花房（螺旋玻璃罩内一株小绿植+飘雪，招牌），
//       头顶两根眼柱触角。移动温室管理员。
// 睡姿（P3）：缩进花房壳，壳里雪夜灯微亮。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const SKIN = "#B8E0C8";
const DEEP = "#8FC8A8";
const CREAM = "#EFFAF0";
const GLASS = "#CFEFF6";
const GLASS_EDGE = "#8FD8E8";
const LEAF = "#57B84C";
const SNOW = "#F7FCFD";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 玻璃冰花房壳（右后方大圆罩：螺旋纹 + 内景植物 + 飘雪） */}
      <g transform={place(158, 168)}>
        <circle cx={0} cy={0} r={44} fill={GLASS} opacity={0.85} stroke={OUTLINE} strokeWidth={5.5} />
        <path d="M40 -6 A40 40 0 1 0 -6 40 A28 28 0 1 1 22 12 A16 16 0 1 0 6 -4" fill="none" stroke={GLASS_EDGE} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
        {/* 内景：小绿植 */}
        <g transform="translate(-4 16)">
          <path d="M0 4 Q-1 -6 1 -12" fill="none" stroke={LEAF} strokeWidth={3} strokeLinecap="round" />
          <path d="M0 -8 q-8 -1 -10 -9 q9 0 10 9 z M1 -10 q8 -2 9 -10 q-9 1 -9 10 z" fill="#8CD97B" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
        </g>
        {/* 内景：飘雪点 + 高光 */}
        <g fill={SNOW}>
          <circle cx={-14} cy={-14} r={2.4} />
          <circle cx={8} cy={-22} r={2} />
          <circle cx={20} cy={-4} r={2.2} />
          <circle cx={-2} cy={-2} r={1.8} />
        </g>
        <path d="M-24 -22 q6 -8 16 -10" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      </g>
      {/* 尾（软体尾尖从壳后探出一点点） */}
      <g transform={place(204, 222)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 4 Q10 4 14 -2 Q8 -6 0 -4 Z" fill={SKIN} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 软体身（低趴长条，从壳下钻出向左） */}
      <path
        d="M52 218 Q54 198 76 194 Q108 190 150 196 Q192 202 198 218 Q196 230 176 231 Q120 234 66 230 Q52 228 52 218 Z"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d="M64 222 q10 -4 20 0 M94 224 q10 -4 20 0" fill="none" stroke={DEEP} strokeWidth={2.6} strokeLinecap="round" opacity={0.8} />
      {/* 头（左端大圆头抬起——大头比例） */}
      <circle cx={74} cy={180} r={37} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={74} cy={196} rx={20} ry={11} fill={CREAM} opacity={0.95} />
      {/* 小手（贴地小肉手） */}
      <g transform={place(56, 208, 30)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={6} rx={5.5} ry={8} fill={SKIN} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(100, 212, -20)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={6} rx={5.5} ry={8} fill={SKIN} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 腹足前后段（legL/R：蜗牛没有脚，用腹足波做迈步件） */}
      <g transform={place(96, 231)}>
        <Part name="legL" origin="50% -50%">
          <path d="M-10 0 q10 -5 20 0" fill="none" stroke={DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(146, 231)}>
        <Part name="legR" origin="50% -50%">
          <path d="M-10 0 q10 -5 20 0" fill="none" stroke={DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 脸（眼睛在头上部，柱触角下） */}
      <g className="part-face">
        <ExpFace cx1={62} cx2={88} cy={174} r={9} mouthY={193} mouthW={11} expression={expression} base={eyes} />
        <Blush cx1={53} cx2={97} cy={186} />
      </g>
      {/* 头顶：两根眼柱触角（球端，headtop 呼吸摇=可爱地晃） */}
      <g transform={place(74, 148)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={SKIN} strokeWidth={7} strokeLinecap="round">
            <path d="M-8 2 Q-12 -10 -10 -18" />
            <path d="M8 2 Q12 -10 10 -18" />
          </g>
          <g fill="none" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" opacity={0.4}>
            <path d="M-8 2 Q-12 -10 -10 -18 M8 2 Q12 -10 10 -18" />
          </g>
          <circle cx={-10} cy={-21} r={5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} />
          <circle cx={10} cy={-21} r={5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(36, 231)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：头朝行进方向昂起，花房壳驮在身中后，腹足推波。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 玻璃冰花房壳（身中后） */}
      <g transform={place(104, 166)}>
        <circle cx={0} cy={0} r={42} fill={GLASS} opacity={0.85} stroke={OUTLINE} strokeWidth={5.5} />
        <path d="M38 -6 A38 38 0 1 0 -6 38 A26 26 0 1 1 21 11 A15 15 0 1 0 6 -4" fill="none" stroke={GLASS_EDGE} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
        <g transform="translate(-4 14)">
          <path d="M0 4 Q-1 -6 1 -12" fill="none" stroke={LEAF} strokeWidth={3} strokeLinecap="round" />
          <path d="M0 -8 q-8 -1 -10 -9 q9 0 10 9 z M1 -10 q8 -2 9 -10 q-9 1 -9 10 z" fill="#8CD97B" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
        </g>
        <g fill={SNOW}>
          <circle cx={-13} cy={-13} r={2.2} />
          <circle cx={8} cy={-20} r={2} />
          <circle cx={18} cy={-4} r={2} />
        </g>
        <path d="M-22 -20 q6 -8 15 -10" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      </g>
      {/* 尾（壳后软体尾尖） */}
      <g transform={place(54, 224)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 4 Q-10 4 -14 -2 Q-8 -6 0 -4 Z" fill={SKIN} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 软体身（低趴长条，头端在右昂起） */}
      <path
        d="M56 218 Q58 202 80 198 Q120 192 160 198 Q192 204 198 218 Q196 230 176 231 Q118 234 68 230 Q54 228 56 218 Z"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d="M70 222 q10 -4 20 0 M100 224 q10 -4 20 0" fill="none" stroke={DEEP} strokeWidth={2.6} strokeLinecap="round" opacity={0.8} />
      {/* 头（右端大圆头昂起） */}
      <circle cx={176} cy={184} r={34} fill={SKIN} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={182} cy={200} rx={17} ry={10} fill={CREAM} opacity={0.95} />
      {/* 小肉手 */}
      <g transform={place(156, 212, 22)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={6} rx={5} ry={7.5} fill={DEEP} stroke={OUTLINE} strokeWidth={3.8} />
        </Part>
      </g>
      <g transform={place(196, 208, -22)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={6} rx={5.5} ry={8} fill={SKIN} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 腹足波（推进） */}
      <g transform={place(100, 231)}>
        <Part name="legL" origin="50% -50%">
          <path d="M-10 0 q10 -5 20 0" fill="none" stroke={DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(148, 231)}>
        <Part name="legR" origin="50% -50%">
          <path d="M-10 0 q10 -5 20 0" fill="none" stroke={DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={186} cy={178} r={9} mouthX={194} mouthY={196} mouthW={10} expression={expression} base={eyes} />
        <ellipse cx={172} cy={194} rx={6.5} ry={4.5} fill="#F5A8C6" opacity={0.7} />
      </g>
      {/* 头顶：两根眼柱触角（前倾） */}
      <g transform={place(180, 154)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={SKIN} strokeWidth={7} strokeLinecap="round">
            <path d="M-8 2 Q-8 -10 -4 -17" />
            <path d="M8 2 Q13 -8 14 -16" />
          </g>
          <g fill="none" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" opacity={0.4}>
            <path d="M-8 2 Q-8 -10 -4 -17 M8 2 Q13 -8 14 -16" />
          </g>
          <circle cx={-3} cy={-20} r={5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} />
          <circle cx={15} cy={-19} r={5} fill={DEEP} stroke={OUTLINE} strokeWidth={2.8} />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：整只缩进花房壳，隔着玻璃看得到睡脸，壳里雪夜灯微亮。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 缩拢的软体（壳下一圈） */}
      <path
        d="M84 226 Q86 210 108 208 Q148 206 172 212 Q180 218 176 226 Q128 234 84 226 Z"
        fill={SKIN}
        stroke={OUTLINE}
        strokeWidth={5.5}
        strokeLinejoin="round"
      />
      {/* 尾尖（右缘微露） */}
      <g transform={place(178, 224)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 4 Q9 4 13 -2 Q7 -6 0 -4 Z" fill={SKIN} stroke={OUTLINE} strokeWidth={3.8} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 腹足波（壳底） */}
      <g transform={place(112, 231)}>
        <Part name="legL" origin="50% -50%">
          <path d="M-9 0 q9 -4 18 0" fill="none" stroke={DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(148, 231)}>
        <Part name="legR" origin="50% -50%">
          <path d="M-9 0 q9 -4 18 0" fill="none" stroke={DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 壳内：缩进去的头 + 睡脸（会被玻璃罩罩住） */}
      <circle cx={106} cy={196} r={26} fill={SKIN} stroke={OUTLINE} strokeWidth={5} />
      <g transform={place(94, 216, 20)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={5} rx={4.5} ry={7} fill={SKIN} stroke={OUTLINE} strokeWidth={3.6} />
        </Part>
      </g>
      <g transform={place(122, 218, -20)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={5} rx={4.5} ry={7} fill={SKIN} stroke={OUTLINE} strokeWidth={3.6} />
        </Part>
      </g>
      <g className="part-face">
        <ExpFace cx1={97} cx2={116} cy={192} r={7} mouthY={207} mouthW={9} expression={expression} base={eyes} />
      </g>
      {/* 触角（壳内耷拉） */}
      <g transform={place(104, 172)}>
        <Part name="headtop" origin="50% 100%">
          <g fill="none" stroke={SKIN} strokeWidth={6} strokeLinecap="round">
            <path d="M-6 2 Q-12 -4 -14 -10" />
            <path d="M6 2 Q12 -4 13 -11" />
          </g>
          <circle cx={-15} cy={-12} r={4.2} fill={DEEP} stroke={OUTLINE} strokeWidth={2.4} />
          <circle cx={14} cy={-13} r={4.2} fill={DEEP} stroke={OUTLINE} strokeWidth={2.4} />
        </Part>
      </g>
      {/* 雪夜小灯（壳内暖光） */}
      <g transform="translate(150 194)">
        <circle r={13} fill="#FFE9AD" opacity={0.45} />
        <path d="M-4 6 L4 6 L3 -4 Q0 -7 -3 -4 Z" fill="#F5C542" stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        <circle cx={0} cy={0} r={1.8} fill="#E85D3A" />
      </g>
      {/* 玻璃花房罩（罩住全身） */}
      <g transform={place(128, 180)}>
        <circle cx={0} cy={0} r={48} fill={GLASS} opacity={0.72} stroke={OUTLINE} strokeWidth={5.5} />
        <path d="M43 -7 A43 43 0 1 0 -7 43 A30 30 0 1 1 24 13 A17 17 0 1 0 7 -5" fill="none" stroke={GLASS_EDGE} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
        <g transform="translate(8 -22)">
          <path d="M0 4 Q-1 -4 1 -10" fill="none" stroke={LEAF} strokeWidth={2.8} strokeLinecap="round" />
          <path d="M0 -6 q-7 -1 -9 -8 q8 0 9 8 z" fill="#8CD97B" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
        </g>
        <g fill={SNOW}>
          <circle cx={-16} cy={-16} r={2.2} />
          <circle cx={6} cy={-30} r={2} />
          <circle cx={24} cy={-10} r={2} />
          <circle cx={-26} cy={2} r={1.8} />
        </g>
        <path d="M-26 -24 q7 -9 18 -11" fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      </g>
    </Part>
  );
}

function Rig(props: RigProps) {
  if (props.view === "side") return <Side {...props} />;
  if (props.pose === "lie") return <Lie {...props} />;
  return <Front {...props} />;
}

// 微景观园艺产物：玻璃罐（土＋苗）+ 苔藓团 + 鹅卵石
const glassJar: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round" strokeLinecap="round">
    <path d="M-6 -8 L6 -8 L6 6 Q6 9 3 9 L-3 9 Q-6 9 -6 6 Z" fill={GLASS} strokeWidth={2.2} opacity={0.9} />
    <rect x={-5} y={-10} width={10} height={2.6} rx={1} fill={GLASS_EDGE} strokeWidth={1.8} />
    <path d="M-5 4 Q0 2 5 4 L5 6 Q5 9 3 9 L-3 9 Q-5 9 -5 6 Z" fill="#8A5A3B" stroke="none" />
    <path d="M0 4 V-2 M0 0 q-3 -1 -3 -4 q3 0 3 4 M0 -1 q3 -1 3 -4 q-3 0 -3 4" fill="none" strokeWidth={1.6} stroke={LEAF} />
  </g>
);
const mossTuft: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <path d="M-8 4 Q-9 -2 -4 -3 Q-3 -8 2 -6 Q8 -8 8 -1 Q10 3 5 5 Q0 8 -8 4 Z" fill={LEAF} strokeWidth={2.2} />
    <g fill="#3E8A34" stroke="none">
      <circle cx={-3} cy={-1} r={1} /><circle cx={2} cy={-2} r={1} /><circle cx={4} cy={2} r={1} />
    </g>
  </g>
);
const pebble: ParticleRenderer = () => (
  <g>
    <ellipse cx={0} cy={1} rx={8} ry={6} fill="#A7ADB8" stroke={OUTLINE} strokeWidth={2.2} />
    <path d="M-4 -2 Q0 -4 4 -2" fill="none" stroke="#D2D6DE" strokeWidth={1.8} strokeLinecap="round" />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.08,
    palette: { body: SKIN, deep: DEEP, belly: CREAM, accent: GLASS_EDGE, accent2: LEAF },
    foodAnchor: { x: 76, y: 194 },
    shadowRx: 66,
  },
  // 园艺小铲：木柄铲 + 一撮土和小芽
  tool: () => (
    <g>
      <path d="M-2.2 0 L2.2 0 L2 -18 L-2 -18 Z" fill="#B98A4E" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
      <path d="M-6 -18 L6 -18 L5 -32 Q0 -37 -5 -32 Z" fill="#8E93A6" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M0 -20 v-8" stroke="#5C6172" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M8 -4 q6 -2 9 2 q-5 3 -9 0 z" fill="#8A5A3B" stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M12 -8 q0 -4 2 -6" fill="none" stroke={LEAF} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M14 -14 q-5 -1 -6 -6 q6 0 6 6 z" fill="#8CD97B" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 40, y: 208 },
    baseAngle: (-Math.PI * 2) / 3,
    cone: 0.55,
    shapes: [glassJar, mossTuft, pebble],
  },
  meta: {
    nameZh: "苔壳蜗",
    elements: ["grass", "ice", "water"],
    family: "甲壳",
    toolAnchor: { x: 36, y: 231 },
    nodeBudget: 205,
    lieNote: "缩进花房壳，壳里雪夜灯微亮",
  },
};
