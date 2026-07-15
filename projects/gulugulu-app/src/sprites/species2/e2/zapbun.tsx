// ---------------------------------------------------------------------------
// 静电兔 zapbun — e2（electric+normal）· 双足小人
// 剪影：站立小兔，双长耳=天线（尖端天线球），背后插发条钥匙，大脚丫。
// 睡姿（P3）：抱着发条钥匙侧躺，长耳当毯子。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { NubArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BODY = "#FFF6CE";
const DEEP = "#E39B00";
const WHITE = "#FFFFFF";
const VOLT = "#FFD93B";
const GREY = "#8E93A6";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 背后发条钥匙（探出右上剪影；缓慢摇摆的 crest 装饰） */}
      <g transform={place(170, 168, -32)}>
        <g className="part-crest">
          <path d="M0 10 L0 -10" stroke={OUTLINE} strokeWidth={6} strokeLinecap="round" />
          <path d="M0 -10 L0 -22" stroke={GREY} strokeWidth={5} strokeLinecap="round" />
          <path d="M-9 -30 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M-3 -30 a3 3 0 1 1 6 0 a3 3 0 1 1 -6 0" fillRule="evenodd" fill={VOLT} stroke={OUTLINE} strokeWidth={3.4} />
        </g>
      </g>
      {/* 尾：圆棉尾（左下探出） */}
      <g transform={place(88, 214)}>
        <Part name="tail" origin="50% 50%">
          <circle cx={-6} cy={0} r={10} fill={WHITE} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 身体（小梨形） */}
      <path
        d="M96 228 Q92 186 112 172 Q128 164 144 172 Q164 186 160 228 Q128 238 96 228 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <ellipse cx={128} cy={208} rx={20} ry={14} fill={WHITE} opacity={0.9} />
      {/* 小手 */}
      <g transform={place(100, 184, 24)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={BODY} rx={7} ry={11} />
        </Part>
      </g>
      <g transform={place(156, 184, -24)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={BODY} rx={7} ry={11} />
        </Part>
      </g>
      {/* 大脚丫（兔签名：向前的长椭圆脚） */}
      <g transform={place(108, 230)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={13} ry={6.5} fill={WHITE} stroke={OUTLINE} strokeWidth={4.5} />
          <path d="M-4 -2 v4 M3 -2 v4" stroke={DEEP} strokeWidth={2} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(148, 230)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={13} ry={6.5} fill={WHITE} stroke={OUTLINE} strokeWidth={4.5} />
          <path d="M-4 -2 v4 M3 -2 v4" stroke={DEEP} strokeWidth={2} strokeLinecap="round" />
        </Part>
      </g>
      {/* 头（圆球，压住身体上缘） */}
      <circle cx={128} cy={132} r={40} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 天线长耳（headtop：一起呼吸摇摆；耳尖天线球） */}
      <g transform={place(128, 100)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="translate(-17 0) rotate(-10)">
            <path d="M-8 0 Q-11 -34 -4 -52 Q6 -50 8 -18 Q8 -4 0 2 Z" fill={BODY} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
            <path d="M-4 -14 Q-6 -34 -2 -44 Q3 -40 3 -18 Q2 -10 -1 -8 Z" fill={WHITE} opacity={0.85} />
            <path d="M1 -26 l-3.4 5.6 h2.8 l-3.4 5.6" fill="none" stroke={DEEP} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={-1} cy={-56} r={5.5} fill={VOLT} stroke={OUTLINE} strokeWidth={3.4} />
          </g>
          <g transform="translate(17 0) rotate(10) scale(-1 1)">
            <path d="M-8 0 Q-11 -34 -4 -52 Q6 -50 8 -18 Q8 -4 0 2 Z" fill={BODY} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
            <path d="M-4 -14 Q-6 -34 -2 -44 Q3 -40 3 -18 Q2 -10 -1 -8 Z" fill={WHITE} opacity={0.85} />
            <circle cx={-1} cy={-56} r={5.5} fill={VOLT} stroke={OUTLINE} strokeWidth={3.4} />
          </g>
        </Part>
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={112} cx2={144} cy={130} r={9.5} mouthY={146} mouthW={13} expression={expression} base={eyes} />
        <Blush cx1={100} cx2={156} cy={142} />
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

/** 侧视（右向）：长天线耳向后上扬，发条钥匙背在身后，大脚迈步。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：圆棉尾（左后） */}
      <g transform={place(84, 206)}>
        <Part name="tail" origin="100% 50%">
          <circle cx={-6} cy={0} r={10} fill={WHITE} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 背后发条钥匙（斜插背部，crest 摇摆） */}
      <g transform={place(102, 168, -58)}>
        <g className="part-crest">
          <path d="M0 10 L0 -8" stroke={OUTLINE} strokeWidth={5.5} strokeLinecap="round" />
          <path d="M0 -8 L0 -18" stroke={GREY} strokeWidth={4.5} strokeLinecap="round" />
          <path d="M-8 -25 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M-2.6 -25 a2.6 2.6 0 1 1 5.2 0 a2.6 2.6 0 1 1 -5.2 0" fillRule="evenodd" fill={VOLT} stroke={OUTLINE} strokeWidth={3} />
        </g>
      </g>
      {/* 身体（侧梨形，胸挺向右） */}
      <path
        d="M96 224 Q88 182 106 164 Q120 152 138 156 Q160 162 164 192 Q166 214 152 226 Q122 234 96 224 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <ellipse cx={140} cy={206} rx={17} ry={12} fill={WHITE} opacity={0.9} />
      {/* 大脚（前后迈步） */}
      <g transform={place(110, 230)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={13} ry={6.5} fill={WHITE} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={place(148, 230)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={13} ry={6.5} fill={WHITE} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 近侧小手 */}
      <g transform={place(150, 180, -20)}>
        <Part name="armR" origin="50% 8%">
          <NubArm color={BODY} rx={6.5} ry={10} stroke={4.5} />
        </Part>
      </g>
      <g transform={place(118, 184, 12)}>
        <Part name="armL" origin="50% 8%">
          <NubArm color={BODY} rx={6} ry={9} stroke={4.5} />
        </Part>
      </g>
      {/* 头（前上圆头） */}
      <circle cx={148} cy={126} r={36} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 脸（单眼） */}
      <g className="part-face">
        <ExpSideFace cx={160} cy={118} r={9.5} mouthX={172} mouthY={140} mouthW={11} expression={expression} base={eyes} />
        <ellipse cx={146} cy={138} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：双天线耳向后上扬（错开两片，headtop 摇） */}
      <g transform={place(136, 96)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="translate(-10 2) rotate(-38)">
            <path d="M-8 0 Q-11 -32 -4 -50 Q6 -48 8 -18 Q8 -4 0 2 Z" fill={BODY} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
            <path d="M-4 -14 Q-6 -32 -2 -42 Q3 -38 3 -18 Q2 -10 -1 -8 Z" fill={WHITE} opacity={0.85} />
            <circle cx={-1} cy={-54} r={5.5} fill={VOLT} stroke={OUTLINE} strokeWidth={3.4} />
          </g>
          <g transform="translate(10 0) rotate(-18)">
            <path d="M-8 0 Q-11 -32 -4 -50 Q6 -48 8 -18 Q8 -4 0 2 Z" fill={BODY} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
            <path d="M1 -26 l-3.2 5.2 h2.6 l-3.2 5.2" fill="none" stroke={DEEP} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={-1} cy={-54} r={5.5} fill={VOLT} stroke={OUTLINE} strokeWidth={3.4} />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：抱着发条钥匙侧躺，长耳搭在身上当毯子。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾：棉尾（右后贴地） */}
      <g transform={place(190, 220)}>
        <Part name="tail" origin="0% 50%">
          <circle cx={6} cy={0} r={9} fill={WHITE} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 横卧身体 */}
      <ellipse cx={142} cy={212} rx={46} ry={19} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 侧枕头（左侧贴地） */}
      <circle cx={84} cy={202} r={30} fill={BODY} stroke={OUTLINE} strokeWidth={6} />
      {/* 长耳当毯子（两片横盖在身上） */}
      <g transform={place(104, 188)}>
        <Part name="headtop" origin="0% 50%">
          <g transform="rotate(74)">
            <path d="M-8 0 Q-11 -34 -4 -54 Q6 -52 8 -20 Q8 -4 0 2 Z" fill={BODY} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
            <path d="M-4 -16 Q-6 -36 -2 -46 Q3 -42 3 -20 Q2 -10 -1 -8 Z" fill={WHITE} opacity={0.85} />
          </g>
          <g transform="translate(8 4) rotate(84)">
            <path d="M-8 0 Q-11 -30 -4 -48 Q6 -46 8 -18 Q8 -4 0 2 Z" fill={BODY} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
          </g>
        </Part>
      </g>
      {/* 怀里的发条钥匙（tail 之外的静态道具） */}
      <g transform={place(116, 222, 78)}>
        <path d="M0 8 L0 -8" stroke={OUTLINE} strokeWidth={5} strokeLinecap="round" />
        <path d="M-7 -14 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 M-2.4 -14 a2.4 2.4 0 1 1 4.8 0 a2.4 2.4 0 1 1 -4.8 0" fillRule="evenodd" fill={VOLT} stroke={OUTLINE} strokeWidth={2.8} />
      </g>
      {/* 小手环抱 */}
      <g transform={place(102, 222, -14)}>
        <Part name="armL" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={8.5} ry={5} fill={BODY} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(130, 226, 8)}>
        <Part name="armR" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={8.5} ry={5} fill={BODY} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 大脚放平（身尾侧） */}
      <g transform={place(176, 226, 10)}>
        <Part name="legR" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={12} ry={5.5} fill={WHITE} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(158, 229, -6)}>
        <Part name="legL" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={11} ry={5} fill={WHITE} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 脸（闭眼侧枕） */}
      <g className="part-face">
        <ExpFace cx1={74} cx2={96} cy={198} r={6.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <path d="M80 212 q5 4 10 0" fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" />
        <ellipse cx={66} cy={208} rx={6} ry={4} fill="#F5917B" opacity={0.5} />
      </g>
    </Part>
  );
}

function Rig(props: RigProps) {
  if (props.view === "side") return <Side {...props} />;
  if (props.pose === "lie") return <Lie {...props} />;
  return <Front {...props} />;
}

const pixelStar: ParticleRenderer = () => (
  <g fill={VOLT} stroke={OUTLINE} strokeWidth={1.8}>
    <rect x={-5.5} y={-5.5} width={11} height={11} rx={1.5} />
    <rect x={-2} y={-2} width={4} height={4} fill="#FFFFFF" stroke="none" />
  </g>
);
const boltBit: ParticleRenderer = () => (
  <path d="M1.5 -8 L-4 1 h3.5 L-1.5 8 L4.5 -1 h-3.5 Z" fill={VOLT} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
);
const heartBit: ParticleRenderer = () => (
  <path d="M0 5.5 C-6.5 0.5 -6 -5 -2.5 -5.5 C-1 -5.7 0 -4.6 0 -3.6 C0 -4.6 1 -5.7 2.5 -5.5 C6 -5 6.5 0.5 0 5.5 Z" fill="#F5917B" stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1,
    palette: { body: BODY, deep: DEEP, belly: WHITE, accent: VOLT, accent2: "#6E6E78" },
    foodAnchor: { x: 132, y: 146 },
    shadowRx: 52,
  },
  // 游戏手柄：圆角双柄 + 十字键 + AB 按钮 + 天线（无线款）
  tool: () => (
    <g>
      <path d="M-20 -14 Q-26 -14 -26 -22 Q-26 -32 -16 -32 L16 -32 Q26 -32 26 -22 Q26 -14 20 -14 Q12 -10 0 -10 Q-12 -10 -20 -14 Z" fill={GREY} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      <path d="M-15 -23 h8 M-11 -27 v8" stroke="#3E4356" strokeWidth={3} strokeLinecap="round" />
      <circle cx={11} cy={-26} r={2.8} fill="#E85D3A" stroke={OUTLINE} strokeWidth={1.8} />
      <circle cx={18} cy={-21} r={2.8} fill="#57B84C" stroke={OUTLINE} strokeWidth={1.8} />
      <path d="M22 -32 L26 -42" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={26} cy={-43} r={2} fill={VOLT} stroke={OUTLINE} strokeWidth={1.6} />
      <path d="M0 0 L0 -10" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" opacity={0.4} />
    </g>
  ),
  workFx: {
    emitter: { x: 188, y: 205 },
    baseAngle: -Math.PI / 2.2,
    cone: 0.6,
    shapes: [pixelStar, boltBit, heartBit],
  },
  meta: {
    nameZh: "静电兔",
    elements: ["electric", "normal"],
    family: "双足小人",
    toolAnchor: { x: 188, y: 231 },
    nodeBudget: 130,
    lieNote: "抱着发条钥匙侧躺，长耳当毯子",
  },
};
