// ---------------------------------------------------------------------------
// 琉璃蜓 crystalwing — e5（electric+grass+ice+normal+water，缺火）· 昆虫多足
// 剪影：小蜻蜓：四片雕花玻璃翅（各一色纹样，礼装层）+ 细长节尾 +
//       大复眼。湿地自然观察员。
// 睡姿（P3）：四翅平铺贴地像玻璃标本，趴叶垫上。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const TEAL = "#7FCFC0";
const TEAL_DEEP = "#4FA396";
const PALE = "#EFFAF8";
const VOLT = "#FFD93B";
const VIOLET = "#B99BE8";
const SEA = "#9BDCFF";
const LEAF = "#8CD97B";

/** 一片雕花玻璃翅（tint=纹样色；pivot=翅根） */
function GlassWing({ tint, len = 44, mirror = false }: { tint: string; len?: number; mirror?: boolean }) {
  return (
    <g transform={mirror ? "scale(-1 1)" : undefined}>
      <path
        d={`M0 0 Q${-len * 0.7} ${-len * 0.28} ${-len} ${-len * 0.1} Q${-len * 1.02} ${len * 0.12} ${-len * 0.6} ${len * 0.2} Q${-len * 0.24} ${len * 0.22} 0 ${len * 0.12} Z`}
        fill="#F2FBFA"
        opacity={0.88}
        stroke={OUTLINE}
        strokeWidth={3.4}
        strokeLinejoin="round"
      />
      <g fill="none" stroke={tint} strokeWidth={2.2} strokeLinecap="round" opacity={0.9}>
        <path d={`M${-len * 0.2} 2 Q${-len * 0.5} ${-len * 0.12} ${-len * 0.82} ${-len * 0.04}`} />
        <path d={`M${-len * 0.3} ${len * 0.1} Q${-len * 0.55} ${len * 0.02} ${-len * 0.72} ${len * 0.08}`} />
        <circle cx={-len * 0.55} cy={-2} r={2.4} />
      </g>
    </g>
  );
}

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 四片雕花玻璃翅（礼装层：上大下小，各一色纹样） */}
      <g transform={place(104, 138, -24)}>
        <g className="part-crest">
          <GlassWing tint={VOLT} len={48} />
        </g>
      </g>
      <g transform={place(152, 138, 24)}>
        <g className="part-banner">
          <GlassWing tint={VIOLET} len={48} mirror />
        </g>
      </g>
      <g transform={place(102, 158, -4)}>
        <g className="part-aura">
          <GlassWing tint={SEA} len={38} />
        </g>
      </g>
      <g transform={place(154, 158, 4)}>
        <g className="part-aura">
          <GlassWing tint={LEAF} len={38} mirror />
        </g>
      </g>
      {/* 细长节尾（招牌：垂向右下的分节尾，端头星灯） */}
      <g transform={place(150, 196, 30)}>
        <Part name="tail" origin="0% 0%">
          <path d="M0 0 Q22 10 34 28" fill="none" stroke={TEAL} strokeWidth={10} strokeLinecap="round" />
          <g stroke={TEAL_DEEP} strokeWidth={2.6} strokeLinecap="round">
            <path d="M8 5 l4 -5 M17 12 l4 -5 M25 20 l4 -5" />
          </g>
          <path d="M36 32 l1.8 3.6 l3.6 1.8 l-3.6 1.8 l-1.8 3.6 l-1.8 -3.6 l-3.6 -1.8 l3.6 -1.8 z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" transform="translate(0 -4)" />
        </Part>
      </g>
      {/* 胸腹（短胖节身） */}
      <ellipse cx={128} cy={172} rx={38} ry={34} fill={TEAL} stroke={OUTLINE} strokeWidth={6} />
      <path d="M96 178 Q128 190 160 178" fill="none" stroke={TEAL_DEEP} strokeWidth={3.4} strokeLinecap="round" />
      <ellipse cx={128} cy={190} rx={20} ry={11} fill={PALE} opacity={0.95} />
      {/* 小手 */}
      <g transform={place(98, 178, 26)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8.5} fill={TEAL} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(158, 178, -26)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8.5} fill={TEAL} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 停歇细腿（一对） */}
      <g transform={place(114, 230)}>
        <Part name="legL" origin="50% -50%">
          <path d="M0 -18 q-3 10 -8 16 M-8 -2 q4 2 8 2" fill="none" stroke={TEAL_DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(142, 230)}>
        <Part name="legR" origin="50% -50%">
          <path d="M0 -18 q3 10 8 16 M8 -2 q-4 2 -8 2" fill="none" stroke={TEAL_DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 头（宽头 + 大复眼在两侧上方） */}
      <circle cx={128} cy={124} r={28} fill={TEAL} stroke={OUTLINE} strokeWidth={6} />
      <g fill={VIOLET} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={104} cy={112} r={15} />
        <circle cx={152} cy={112} r={15} />
      </g>
      {/* 复眼网点高光 */}
      <g fill={PALE} opacity={0.8}>
        <circle cx={99} cy={107} r={3} />
        <circle cx={108} cy={114} r={2} />
        <circle cx={147} cy={107} r={3} />
        <circle cx={156} cy={114} r={2} />
      </g>
      {/* 脸（复眼下的小圆眼+嘴） */}
      <g className="part-face">
        <ExpFace cx1={118} cx2={138} cy={126} r={7} mouthY={140} mouthW={10} expression={expression} base={eyes} />
        <Blush cx1={110} cx2={146} cy={136} />
      </g>
      {/* 头顶：短触角一对（headtop 呼吸摇） */}
      <g transform={place(128, 100)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-5 2 Q-8 -6 -6 -10 M5 2 Q8 -6 6 -10" fill="none" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
          <circle cx={-6} cy={-12} r={2.4} fill={SEA} stroke={OUTLINE} strokeWidth={1.8} />
          <circle cx={6} cy={-12} r={2.4} fill={SEA} stroke={OUTLINE} strokeWidth={1.8} />
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

/** 侧视（右向）：悬停巡湿地——双层玻璃翅向后上扬，节尾水平拖后，复眼朝前。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 玻璃翅（后上扬双层 + 下层小翅） */}
      <g transform={place(116, 128, -34)}>
        <g className="part-crest">
          <GlassWing tint={VOLT} len={48} />
        </g>
      </g>
      <g transform={place(126, 120, -56)}>
        <g className="part-banner">
          <GlassWing tint={VIOLET} len={44} />
        </g>
      </g>
      <g transform={place(108, 148, -14)}>
        <g className="part-aura">
          <GlassWing tint={SEA} len={36} />
        </g>
      </g>
      {/* 细长节尾（水平拖后，端头星灯） */}
      <g transform={place(96, 178)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-22 4 -40 2" fill="none" stroke={TEAL} strokeWidth={10} strokeLinecap="round" />
          <g stroke={TEAL_DEEP} strokeWidth={2.6} strokeLinecap="round">
            <path d="M-10 5 l1 -9 M-21 6 l1 -9 M-31 5 l1 -8" />
          </g>
          <path d="M-44 0 l1.8 3.6 l3.6 1.8 l-3.6 1.8 l-1.8 3.6 l-1.8 -3.6 l-3.6 -1.8 l3.6 -1.8 z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" transform="translate(0 -4)" />
        </Part>
      </g>
      {/* 胸腹（前倾节身） */}
      <ellipse cx={130} cy={172} rx={36} ry={32} fill={TEAL} stroke={OUTLINE} strokeWidth={6} />
      <path d="M100 178 Q130 190 160 176" fill="none" stroke={TEAL_DEEP} strokeWidth={3.4} strokeLinecap="round" />
      <ellipse cx={138} cy={190} rx={17} ry={10} fill={PALE} opacity={0.95} />
      {/* 小手（前后） */}
      <g transform={place(112, 182, 22)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5} ry={8} fill={TEAL_DEEP} stroke={OUTLINE} strokeWidth={3.8} />
        </Part>
      </g>
      <g transform={place(152, 180, -26)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8.5} fill={TEAL} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 停歇细腿（悬停收拢） */}
      <g transform={place(118, 229)}>
        <Part name="legL" origin="50% -50%">
          <path d="M0 -16 q-3 9 -8 14" fill="none" stroke={TEAL_DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(140, 229)}>
        <Part name="legR" origin="50% -50%">
          <path d="M0 -16 q3 9 8 14" fill="none" stroke={TEAL_DEEP} strokeWidth={4} strokeLinecap="round" />
        </Part>
      </g>
      {/* 头（朝前）+ 大复眼（近侧一颗为主） */}
      <circle cx={158} cy={128} r={26} fill={TEAL} stroke={OUTLINE} strokeWidth={6} />
      <circle cx={144} cy={112} r={12} fill="#A78BD9" stroke={OUTLINE} strokeWidth={4} />
      <circle cx={170} cy={110} r={15} fill={VIOLET} stroke={OUTLINE} strokeWidth={4.5} />
      <g fill={PALE} opacity={0.8}>
        <circle cx={165} cy={105} r={3} />
        <circle cx={174} cy={112} r={2} />
      </g>
      {/* 脸（复眼下的小侧眼+嘴） */}
      <g className="part-face">
        <ExpSideFace cx={164} cy={132} r={6.5} mouthX={172} mouthY={144} mouthW={8} expression={expression} base={eyes} />
        <ellipse cx={152} cy={142} rx={5.5} ry={4} fill="#F5A8C6" opacity={0.7} />
      </g>
      {/* 头顶：短触角（前倾） */}
      <g transform={place(156, 102, 10)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-5 2 Q-8 -6 -6 -10 M5 2 Q8 -6 6 -10" fill="none" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
          <circle cx={-6} cy={-12} r={2.4} fill={SEA} stroke={OUTLINE} strokeWidth={1.8} />
          <circle cx={6} cy={-12} r={2.4} fill={SEA} stroke={OUTLINE} strokeWidth={1.8} />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：趴在叶垫上，四翅向四角平铺贴地像玻璃标本，节尾摆直。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 叶垫 */}
      <ellipse cx={128} cy={218} rx={62} ry={15} fill={LEAF} stroke={OUTLINE} strokeWidth={4.5} />
      <path d="M72 218 Q128 208 184 218" fill="none" stroke="#57B84C" strokeWidth={2.6} strokeLinecap="round" />
      {/* 四翅平铺贴地（标本式四角展开） */}
      <g transform={place(102, 190, -42)}>
        <g className="part-crest">
          <GlassWing tint={VOLT} len={44} />
        </g>
      </g>
      <g transform={place(154, 190, 42)}>
        <g className="part-banner">
          <GlassWing tint={VIOLET} len={44} mirror />
        </g>
      </g>
      <g transform={place(100, 208, -6)}>
        <g className="part-aura">
          <GlassWing tint={SEA} len={36} />
        </g>
      </g>
      <g transform={place(156, 208, 6)}>
        <g className="part-aura">
          <GlassWing tint={LEAF} len={36} mirror />
        </g>
      </g>
      {/* 节尾（向右摆直贴地） */}
      <g transform={place(158, 210)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 0 Q18 2 32 0" fill="none" stroke={TEAL} strokeWidth={9} strokeLinecap="round" />
          <g stroke={TEAL_DEEP} strokeWidth={2.4} strokeLinecap="round">
            <path d="M9 4 l1 -8 M19 4 l1 -8" />
          </g>
          <path d="M36 -2 l1.6 3.2 l3.2 1.6 l-3.2 1.6 l-1.6 3.2 l-1.6 -3.2 l-3.2 -1.6 l3.2 -1.6 z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.7} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 胸腹（贴地趴伏） */}
      <ellipse cx={128} cy={198} rx={35} ry={25} fill={TEAL} stroke={OUTLINE} strokeWidth={6} />
      <path d="M98 204 Q128 214 158 204" fill="none" stroke={TEAL_DEEP} strokeWidth={3.2} strokeLinecap="round" />
      {/* 小手（收拢） */}
      <g transform={place(108, 212, 20)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={6} rx={5} ry={7.5} fill={TEAL} stroke={OUTLINE} strokeWidth={3.8} />
        </Part>
      </g>
      <g transform={place(148, 212, -20)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={6} rx={5} ry={7.5} fill={TEAL} stroke={OUTLINE} strokeWidth={3.8} />
        </Part>
      </g>
      {/* 停歇细腿（折叠） */}
      <g transform={place(114, 228)}>
        <Part name="legL" origin="50% -50%">
          <path d="M0 -8 q-4 5 -9 7" fill="none" stroke={TEAL_DEEP} strokeWidth={3.8} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(142, 228)}>
        <Part name="legR" origin="50% -50%">
          <path d="M0 -8 q4 5 9 7" fill="none" stroke={TEAL_DEEP} strokeWidth={3.8} strokeLinecap="round" />
        </Part>
      </g>
      {/* 头（伏在前，复眼半垂高光转暗） */}
      <circle cx={128} cy={168} r={26} fill={TEAL} stroke={OUTLINE} strokeWidth={6} />
      <g fill={VIOLET} stroke={OUTLINE} strokeWidth={4.5}>
        <circle cx={106} cy={158} r={14} />
        <circle cx={150} cy={158} r={14} />
      </g>
      <g fill={PALE} opacity={0.45}>
        <circle cx={101} cy={153} r={2.6} />
        <circle cx={145} cy={153} r={2.6} />
      </g>
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={119} cx2={137} cy={170} r={6.5} mouthY={182} mouthW={9} expression={expression} base={eyes} />
        <Blush cx1={111} cx2={145} cy={179} />
      </g>
      {/* 头顶：短触角（耷拉） */}
      <g transform={place(128, 146)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-5 2 Q-9 -3 -8 -8 M5 2 Q9 -3 8 -8" fill="none" stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" />
          <circle cx={-8} cy={-10} r={2.4} fill={SEA} stroke={OUTLINE} strokeWidth={1.8} />
          <circle cx={8} cy={-10} r={2.4} fill={SEA} stroke={OUTLINE} strokeWidth={1.8} />
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

// 放大镜下的产物：镜片反光 + 被放大的小瓢虫（配放大的玻璃叶脉）
const lensGlint: ParticleRenderer = () => (
  <path d="M0 -6 Q1 -1 6 0 Q1 1 0 6 Q-1 1 -6 0 Q-1 -1 0 -6 Z" fill="#FFFFFF" stroke={SEA} strokeWidth={1.8} strokeLinejoin="round" />
);
const bugBit: ParticleRenderer = () => (
  <g>
    <ellipse cx={0} cy={0} rx={5} ry={6} fill="#E2432E" stroke={OUTLINE} strokeWidth={2} />
    <path d="M0 -6 V6" stroke={OUTLINE} strokeWidth={1.4} />
    <circle cx={-2} cy={-1} r={1} fill={OUTLINE} />
    <circle cx={2} cy={1.5} r={1} fill={OUTLINE} />
  </g>
);
const glassLeaf: ParticleRenderer = () => (
  <path d="M0 -8 q7 2.5 1.5 12 q-8 -1.5 -1.5 -12 z" fill={LEAF} opacity={0.85} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.1,
    palette: { body: TEAL, deep: TEAL_DEEP, belly: PALE, accent: VIOLET, accent2: SEA },
    foodAnchor: { x: 128, y: 140 },
    shadowRx: 52,
  },
  // 放大镜：木柄圆镜 + 观察到的小瓢虫
  tool: () => (
    <g>
      <path d="M-3 0 L3 0 L2 -12 L-2 -12 Z" fill="#B98A4E" stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round" />
      <circle cx={0} cy={-26} r={14} fill="#EAF7FF" opacity={0.85} stroke={OUTLINE} strokeWidth={3.4} />
      <circle cx={0} cy={-26} r={14} fill="none" stroke="#D9A514" strokeWidth={2} />
      <path d="M-7 -32 q4 -4 9 -3" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
      <g transform="translate(3 -22)">
        <circle r={3} fill="#E2432E" stroke={OUTLINE} strokeWidth={1.6} />
        <path d="M0 -3 V3" stroke={OUTLINE} strokeWidth={1.2} />
      </g>
    </g>
  ),
  workFx: {
    emitter: { x: 194, y: 202 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.6,
    shapes: [lensGlint, bugBit, glassLeaf],
  },
  meta: {
    nameZh: "琉璃蜓",
    elements: ["electric", "grass", "ice", "normal", "water"],
    family: "昆虫多足",
    toolAnchor: { x: 194, y: 231 },
    nodeBudget: 305,
    lieNote: "四翅平铺贴地像玻璃标本，趴叶垫上",
  },
};
