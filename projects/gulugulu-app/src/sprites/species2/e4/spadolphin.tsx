// ---------------------------------------------------------------------------
// 泡汤豚 spadolphin — e4（fire+ice+normal+water）· 鱼类水栖（漂浮）
// 剪影：奶白小海豚立身，额顶小毛巾，背鳍挂温泉暖帘，腰间温泉水圈
//       （e4 环绕件 part-aura），尾鳍卷着木牌。旅馆女将。
// 睡姿（P3）：尾巴卷着"本日营业结束"木牌侧躺。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { FlipperArm } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const BODY = "#F2E8DC";
const DEEP = "#C9B8A0";
const BELLY = "#FFF8EE";
const WARM = "#E85D3A";
const FROST = "#8FD8E8";
const SEA = "#9BDCFF";

function Front({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 背鳍 + 挂着的温泉暖帘（左上探出，banner 摆动） */}
      <g transform={place(94, 138, -20)}>
        <path d="M0 12 Q-14 -2 -6 -18 Q6 -8 8 8 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
        <g transform="translate(-10 -12)">
          <g className="part-banner">
            <path d="M-22 0 h22" stroke="#8A6410" strokeWidth={3} strokeLinecap="round" />
            <path d="M-21 0 L-21 16 L-15 16 L-15 0 M-13 0 L-13 18 L-7 18 L-7 0 M-5 0 L-5 15 L0 15 L0 0" fill={WARM} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
            <text x={-13} y={12} textAnchor="middle" fontSize={7} fontWeight={900} fill="#FFF8EE">湯</text>
          </g>
        </g>
      </g>
      {/* 尾鳍卷木牌（右下，tail 摇摆） */}
      <g transform={place(170, 216, 14)}>
        <Part name="tail" origin="10% 60%">
          <path d="M0 0 Q18 2 26 -8 Q30 -14 26 -18 Q20 -8 8 -8 Q2 -6 0 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <g transform="translate(24 -26) rotate(10)">
            <rect x={-8} y={-8} width={16} height={18} rx={2.5} fill="#E2C08A" stroke={OUTLINE} strokeWidth={2.6} />
            <path d="M-4 -3 h8 M-4 2 h8 M-4 7 h5" stroke="#8A6410" strokeWidth={1.8} strokeLinecap="round" />
          </g>
        </Part>
      </g>
      {/* e4 环绕件：腰间温泉水圈（part-aura 脉动）+ 蒸汽 */}
      <g transform={place(128, 196)}>
        <g className="part-aura">
          <ellipse cx={0} cy={0} rx={52} ry={15} fill="none" stroke={SEA} strokeWidth={7} opacity={0.9} />
          <ellipse cx={0} cy={0} rx={52} ry={15} fill="none" stroke="#EAF7FF" strokeWidth={2.6} opacity={0.9} />
          <path d="M-44 -8 q-3 -6 1 -10 M46 -6 q3 -6 -1 -10" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
        </g>
      </g>
      {/* 立身海豚（弧背立锥，头大尾细） */}
      <path
        d="M96 214 Q88 150 108 118 Q120 100 132 102 Q148 106 156 134 Q166 172 158 214 Q128 226 96 214 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 奶白肚 */}
      <path d="M112 152 Q130 144 146 154 Q152 190 144 212 Q126 218 110 210 Q104 182 112 152 Z" fill={BELLY} opacity={0.95} />
      {/* 吻部（海豚笑吻，朝下前方） */}
      <path d="M112 138 Q124 150 140 140 Q138 152 126 153 Q114 152 112 138 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      {/* 小鳍手 */}
      <g transform={place(96, 172, 34)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={BODY} len={20} mirror />
        </Part>
      </g>
      <g transform={place(158, 172, -34)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={BODY} len={20} />
        </Part>
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={112} cx2={142} cy={126} r={8.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={102} cx2={152} cy={138} />
      </g>
      {/* 头顶：叠好的小毛巾（headtop 呼吸摇） */}
      <g transform={place(124, 102)}>
        <Part name="headtop" origin="50% 100%">
          <rect x={-14} y={-10} width={28} height={10} rx={3} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.2} />
          <path d="M-14 -5 h28" stroke={FROST} strokeWidth={2.2} />
          <path d="M6 -14 q3 -5 0 -9" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" opacity={0.95} />
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(190, 228)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：水平泳姿前游，笑吻朝前，背鳍暖帘随行，腰圈斜挂，尾拖木牌。 */
function Side({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 尾鳍 + 木牌（身后拖行） */}
      <g transform={place(66, 192, -8)}>
        <Part name="tail" origin="100% 50%">
          <path d="M0 0 Q-10 -10 -20 -12 Q-16 -2 -10 2 Q-18 4 -22 10 Q-10 14 -2 8 Q1 4 0 0 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <g transform="translate(-20 22) rotate(-8)">
            <rect x={-8} y={-9} width={16} height={18} rx={2.5} fill="#E2C08A" stroke={OUTLINE} strokeWidth={2.6} />
            <path d="M-4 -4 h8 M-4 1 h8 M-4 6 h5" stroke="#8A6410" strokeWidth={1.8} strokeLinecap="round" />
          </g>
        </Part>
      </g>
      {/* 水平海豚身（头右尾左） */}
      <path
        d="M62 192 Q66 166 106 156 Q148 148 176 164 Q190 174 190 186 Q188 200 162 210 Q116 222 82 210 Q62 204 62 192 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      {/* 奶白肚（下缘） */}
      <path d="M84 206 Q120 216 158 208 Q136 218 108 218 Q92 214 84 206 Z" fill={BELLY} opacity={0.95} />
      {/* 笑吻（朝前） */}
      <path d="M186 176 Q202 180 205 188 Q200 196 186 194 Q182 186 186 176 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      {/* 背鳍 + 温泉暖帘（背上随行） */}
      <g transform={place(116, 152, -14)}>
        <path d="M0 10 Q-13 -2 -5 -17 Q6 -8 8 7 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
        <g transform="translate(-9 -11)">
          <g className="part-banner">
            <path d="M-21 0 h21" stroke="#8A6410" strokeWidth={3} strokeLinecap="round" />
            <path d="M-20 0 L-20 15 L-14 15 L-14 0 M-12 0 L-12 17 L-6 17 L-6 0 M-4 0 L-4 14 L0 14 L0 0" fill={WARM} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
            <text x={-12} y={11} textAnchor="middle" fontSize={7} fontWeight={900} fill="#FFF8EE">湯</text>
          </g>
        </g>
      </g>
      {/* e4 环绕件：腰间温泉水圈（斜挂身中段） */}
      <g transform={place(118, 194)}>
        <g className="part-aura">
          <ellipse cx={0} cy={0} rx={40} ry={13} fill="none" stroke={SEA} strokeWidth={6.5} opacity={0.9} transform="rotate(-6)" />
          <ellipse cx={0} cy={0} rx={40} ry={13} fill="none" stroke="#EAF7FF" strokeWidth={2.4} opacity={0.9} transform="rotate(-6)" />
          <path d="M-34 -10 q-3 -6 1 -10 M36 -14 q3 -6 -1 -10" fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" />
        </g>
      </g>
      {/* 小鳍手（划水） */}
      <g transform={place(108, 204, 30)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={DEEP} len={16} mirror />
        </Part>
      </g>
      <g transform={place(140, 208, -26)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={BODY} len={18} />
        </Part>
      </g>
      {/* 脸（笑眼朝前） */}
      <g className="part-face">
        <ExpSideFace cx={168} cy={172} r={9} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={156} cy={186} rx={7} ry={4.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶：小毛巾（贴头前倾） */}
      <g transform={place(150, 156, 8)}>
        <Part name="headtop" origin="50% 100%">
          <rect x={-13} y={-9} width={26} height={9} rx={3} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3} />
          <path d="M-13 -4.5 h26" stroke={FROST} strokeWidth={2} />
          <path d="M6 -13 q3 -5 0 -9" fill="none" stroke={FROST} strokeWidth={2.4} strokeLinecap="round" opacity={0.9} />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：侧躺歇业——尾巴卷起"本日营业结束"木牌立着，水圈摊成地上一汪，毛巾盖额。 */
function Lie({ palette, slots = {}, eyes = "happy", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 摊在地上的温泉水圈（一汪） */}
      <g transform={place(118, 226)}>
        <g className="part-aura">
          <ellipse cx={0} cy={0} rx={56} ry={9} fill="none" stroke={SEA} strokeWidth={6} opacity={0.85} />
          <ellipse cx={0} cy={0} rx={56} ry={9} fill="none" stroke="#EAF7FF" strokeWidth={2.2} opacity={0.85} />
        </g>
      </g>
      {/* 侧躺海豚身（头左尾右） */}
      <path
        d="M56 210 Q58 188 92 180 Q134 172 164 184 Q182 190 180 206 Q176 220 148 224 Q96 230 68 222 Q56 218 56 210 Z"
        fill={BODY}
        stroke={OUTLINE}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <path d="M76 216 Q116 226 152 218 Q128 226 100 226 Q84 222 76 216 Z" fill={BELLY} opacity={0.95} />
      {/* 笑吻（贴地朝左） */}
      <path d="M60 196 Q46 198 44 205 Q48 212 61 210 Q64 202 60 196 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      {/* 背鳍 + 暖帘（塌在背坡当小毯） */}
      <g transform={place(122, 178, 10)}>
        <path d="M0 9 Q-12 -1 -4 -15 Q6 -7 7 6 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
        <g transform="translate(6 -8) rotate(24)">
          <g className="part-banner">
            <path d="M0 0 h19" stroke="#8A6410" strokeWidth={3} strokeLinecap="round" />
            <path d="M1 0 L1 14 L7 14 L7 0 M9 0 L9 16 L15 16 L15 0" fill={WARM} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
          </g>
        </g>
      </g>
      {/* 尾巴卷木牌（右端翘起，牌子立着=歇业展示） */}
      <g transform={place(180, 208)}>
        <Part name="tail" origin="20% 80%">
          <path d="M0 6 Q14 2 18 -10 Q20 -20 14 -25" fill="none" stroke={DEEP} strokeWidth={9} strokeLinecap="round" />
          <path d="M10 -28 Q16 -34 24 -33 Q22 -25 15 -23 Z M14 -25 Q10 -36 2 -38 Q2 -29 8 -24 Z" fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
          <g transform="translate(4 -12) rotate(-6)">
            <rect x={-10} y={-11} width={20} height={22} rx={2.5} fill="#E2C08A" stroke={OUTLINE} strokeWidth={2.8} />
            <path d="M-5 -5 h10 M-5 0 h10 M-5 5 h7" stroke="#8A6410" strokeWidth={1.9} strokeLinecap="round" />
          </g>
        </Part>
      </g>
      {/* 小鳍手（一枕头下一搭肚上） */}
      <g transform={place(70, 218, 42)}>
        <Part name="armL" origin="50% 8%">
          <FlipperArm color={DEEP} len={14} mirror />
        </Part>
      </g>
      <g transform={place(118, 200, -80)}>
        <Part name="armR" origin="50% 8%">
          <FlipperArm color={BODY} len={16} />
        </Part>
      </g>
      {/* 脸（闭眼睡） */}
      <g className="part-face">
        <ExpFace cx1={76} cx2={100} cy={194} r={7.5} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={66} cx2={110} cy={204} />
      </g>
      {/* 头顶：毛巾盖在额头上 */}
      <g transform={place(86, 180, -6)}>
        <Part name="headtop" origin="50% 100%">
          <rect x={-13} y={-9} width={26} height={9} rx={3} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3} />
          <path d="M-13 -4.5 h26" stroke={FROST} strokeWidth={2} />
          <path d="M17 -8 q4 -6 0 -12" fill="none" stroke={FROST} strokeWidth={2.4} strokeLinecap="round" opacity={0.9} />
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

// 黄瓜切片（敷眼）：绿盘 + 皮缘
const cucumberSlice: ParticleRenderer = () => (
  <g>
    <circle cx={0} cy={0} r={7.5} fill="#CBE39A" stroke={OUTLINE} strokeWidth={2} />
    <circle cx={0} cy={0} r={5.6} fill="#A7CE6B" />
    <circle cx={0} cy={0} r={2.4} fill="#E7F2CE" />
    <g fill="#7FA24A">
      <ellipse cx={0} cy={-3.4} rx={0.7} ry={1.1} />
      <ellipse cx={3} cy={1.7} rx={0.7} ry={1.1} transform="rotate(120 3 1.7)" />
      <ellipse cx={-3} cy={1.7} rx={0.7} ry={1.1} transform="rotate(-120 -3 1.7)" />
    </g>
  </g>
);
// 叠放的禅意石堆
const spaStones: ParticleRenderer = () => (
  <g fill="#9A9186" stroke={OUTLINE} strokeWidth={2}>
    <ellipse cx={0} cy={7} rx={8} ry={3.4} />
    <ellipse cx={0.5} cy={0.5} rx={6} ry={3} />
    <ellipse cx={-0.5} cy={-5.4} rx={4.2} ry={2.6} />
  </g>
);
// 卷起的浴巾
const rolledTowel: ParticleRenderer = () => (
  <g>
    <rect x={-9} y={-5} width={18} height={10} rx={5} fill={BELLY} stroke={OUTLINE} strokeWidth={2} />
    <ellipse cx={-9} cy={0} rx={2.4} ry={5} fill={BODY} stroke={OUTLINE} strokeWidth={2} />
    <path d="M-9.4 0 a2 3.4 0 0 0 0.8 0" fill="none" stroke={OUTLINE} strokeWidth={1.3} />
    <path d="M4 -5 v10" stroke={WARM} strokeWidth={1.8} strokeLinecap="round" />
    <path d="M7 -4.4 v8.8" stroke={FROST} strokeWidth={1.6} strokeLinecap="round" />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1.08,
    palette: { body: BODY, deep: DEEP, belly: BELLY, accent: WARM, accent2: FROST },
    eyes: "happy",
    floating: true,
    shadowRx: 48,
    foodAnchor: { x: 126, y: 148 },
  },
  // 前台服务铃：托盘 + 圆铃 + 按钮，叮的音波
  tool: () => (
    <g>
      <ellipse cx={0} cy={-3} rx={16} ry={5} fill="#C8CCD8" stroke={OUTLINE} strokeWidth={3.2} />
      <path d="M-11 -6 Q-11 -22 0 -22 Q11 -22 11 -6 Z" fill="#D9A514" stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
      <path d="M-6 -14 q2 -4 6 -4" fill="none" stroke="#FFF1C9" strokeWidth={2.2} strokeLinecap="round" />
      <rect x={-2.5} y={-27} width={5} height={5} rx={1.5} fill="#3E4356" stroke={OUTLINE} strokeWidth={2} />
      <path d="M15 -20 a8 8 0 0 1 4 6 M18 -28 a13 13 0 0 1 6 10" fill="none" stroke="#D9A514" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 190, y: 208 },
    baseAngle: -Math.PI / 2.2,
    cone: 0.6,
    shapes: [cucumberSlice, spaStones, rolledTowel],
  },
  meta: {
    nameZh: "泡汤豚",
    elements: ["fire", "ice", "normal", "water"],
    family: "鱼类水栖",
    toolAnchor: { x: 190, y: 228 },
    nodeBudget: 220,
    lieNote: "尾巴卷着“本日营业结束”木牌侧躺",
  },
};
