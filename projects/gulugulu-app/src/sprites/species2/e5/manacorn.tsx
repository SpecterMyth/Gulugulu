// ---------------------------------------------------------------------------
// 灵角兽 manacorn — e5（electric+fire+grass+ice+water，缺一般）· 有蹄神兽
// 剪影：白色小独角兽：水晶塔罗独角（招牌）+ 五元素流光鬃毛（礼装层）+
//       彩虹尾 + 金蹄 + 胸前塔罗吊坠。占卜从不失手（只说好话）。
// 睡姿（P3）：前腿折叠卧，角尖挂"打烊"小牌。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { TallLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const COAT = "#F7F4FF";
const COAT_DEEP = "#D9CBF5";
const MANE_1 = "#FFD93B";
const MANE_2 = "#E85D3A";
const MANE_3 = "#8CD97B";
const MANE_4 = "#8FD8E8";
const MANE_5 = "#2E7BD6";
const HORN = "#B99BE8";

function Front({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 彩虹尾（五色层叠，左侧甩出=礼装层1） */}
      <g transform={place(80, 178)}>
        <Part name="tail" origin="100% 20%">
          <g fill="none" strokeLinecap="round">
            <path d="M0 0 Q-22 6 -26 26" stroke={MANE_1} strokeWidth={6} />
            <path d="M0 4 Q-18 10 -21 28" stroke={MANE_2} strokeWidth={5.5} />
            <path d="M0 8 Q-14 14 -16 30" stroke={MANE_3} strokeWidth={5} />
            <path d="M0 12 Q-10 18 -11 30" stroke={MANE_4} strokeWidth={4.5} />
            <path d="M0 16 Q-6 20 -6 30" stroke={MANE_5} strokeWidth={4} />
          </g>
        </Part>
      </g>
      {/* 细腿金蹄 */}
      <g transform={place(106, 231)}>
        <Part name="legL" origin="50% -20%">
          <TallLeg color={COAT} hoof="#F5C542" len={28} w={10} hoofH={7} />
        </Part>
      </g>
      <g transform={place(150, 231)}>
        <Part name="legR" origin="50% -20%">
          <TallLeg color={COAT} hoof="#F5C542" len={28} w={10} hoofH={7} />
        </Part>
      </g>
      {/* 身体（略缩让位大头） */}
      <ellipse cx={128} cy={184} rx={44} ry={30} fill={COAT} stroke={OUTLINE} strokeWidth={6} />
      {/* 星尘斑 */}
      <g fill={HORN} opacity={0.7}>
        <path d="M100 172 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" />
        <circle cx={156} cy={182} r={2.4} />
        <circle cx={142} cy={198} r={2} />
      </g>
      {/* 胸前塔罗吊坠（礼装层2） */}
      <path d="M112 158 Q128 168 144 158" fill="none" stroke="#F5C542" strokeWidth={3.4} strokeLinecap="round" />
      <g transform="translate(128 172) rotate(-6)">
        <rect x={-7} y={-10} width={14} height={20} rx={2.5} fill={HORN} stroke={OUTLINE} strokeWidth={2.8} />
        <path d="M0 -6 l1.6 3.2 l3.2 1.6 l-3.2 1.6 l-1.6 3.2 l-1.6 -3.2 l-3.2 -1.6 l3.2 -1.6 z" fill="#FFF7DD" stroke={OUTLINE} strokeWidth={1.4} strokeLinejoin="round" />
      </g>
      {/* 小手（前蹄手） */}
      <g transform={place(98, 196, 20)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8.5} fill={COAT} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(158, 196, -20)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8.5} fill={COAT} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 五色流光鬃毛（颈后垂到身侧=礼装层3，先画被头压住） */}
      <g fill="none" strokeLinecap="round">
        <path d="M150 108 Q168 118 170 146 Q170 162 162 170" stroke={MANE_1} strokeWidth={7} />
        <path d="M152 116 Q166 126 167 148 Q167 160 160 167" stroke={MANE_2} strokeWidth={6} />
        <path d="M153 124 Q163 132 164 150 Q163 160 158 164" stroke={MANE_3} strokeWidth={5} />
        <path d="M154 132 Q160 138 160 152 Q159 158 156 161" stroke={MANE_4} strokeWidth={4} />
        <path d="M154 140 Q157 144 156 154" stroke={MANE_5} strokeWidth={3.4} />
      </g>
      {/* 垂耳（随大头外移） */}
      <g fill={COAT} stroke={OUTLINE} strokeWidth={4}>
        <ellipse cx={90} cy={90} rx={13} ry={8} transform="rotate(-26 90 90)" />
        <ellipse cx={166} cy={90} rx={13} ry={8} transform="rotate(26 166 90)" />
      </g>
      {/* 头（圆吻马脸——婴儿比例大头） */}
      <ellipse cx={128} cy={112} rx={44} ry={38} fill={COAT} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={128} cy={132} rx={20} ry={12} fill="#FFFFFF" stroke={COAT_DEEP} strokeWidth={2.2} />
      {/* 额发一缕五色 */}
      <path d="M110 86 Q116 96 114 104" fill="none" stroke={MANE_2} strokeWidth={5} strokeLinecap="round" />
      <path d="M103 92 Q109 100 108 108" fill="none" stroke={MANE_4} strokeWidth={4.5} strokeLinecap="round" />
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={110} cx2={146} cy={104} r={9.5} mouthY={132} mouthW={12} expression={expression} base={eyes} />
        <g fill={COAT_DEEP}>
          <ellipse cx={119} cy={130} rx={2} ry={3} />
          <ellipse cx={137} cy={130} rx={2} ry={3} />
        </g>
        <Blush cx1={99} cx2={157} cy={120} />
      </g>
      {/* 头顶：水晶塔罗独角（招牌，headtop 呼吸摇） */}
      <g transform={place(128, 76)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-6 2 L6 2 L2 -30 Q0 -34 -2 -30 Z" fill={HORN} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
          <path d="M-4 -4 L4 -6 M-3 -12 L3 -14 M-2 -20 L2 -21" stroke="#FFF7DD" strokeWidth={2} strokeLinecap="round" />
          <path d="M8 -26 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" fill="#FFD93B" stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round" />
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

/** 侧视（右向）：小碎步慢跑，独角朝前，五色鬃毛沿颈背飘，彩虹尾拖后。 */
function Side({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 彩虹尾（身后甩） */}
      <g transform={place(80, 176)}>
        <Part name="tail" origin="100% 20%">
          <g fill="none" strokeLinecap="round">
            <path d="M0 0 Q-22 6 -26 26" stroke={MANE_1} strokeWidth={6} />
            <path d="M0 4 Q-18 10 -21 28" stroke={MANE_2} strokeWidth={5.5} />
            <path d="M0 8 Q-14 14 -16 30" stroke={MANE_3} strokeWidth={5} />
            <path d="M0 12 Q-10 18 -11 30" stroke={MANE_4} strokeWidth={4.5} />
            <path d="M0 16 Q-6 20 -6 30" stroke={MANE_5} strokeWidth={4} />
          </g>
        </Part>
      </g>
      {/* 远侧前后腿 */}
      <g transform={place(100, 230)}>
        <Part name="legL" origin="50% -20%">
          <TallLeg color={COAT_DEEP} hoof="#E2A52C" len={26} w={9.5} hoofH={7} />
        </Part>
      </g>
      <g transform={place(144, 230)}>
        <Part name="armL" origin="50% -20%">
          <TallLeg color={COAT_DEEP} hoof="#E2A52C" len={26} w={9.5} hoofH={7} />
        </Part>
      </g>
      {/* 身体（横向） */}
      <ellipse cx={122} cy={182} rx={46} ry={29} fill={COAT} stroke={OUTLINE} strokeWidth={6} />
      {/* 星尘斑 */}
      <g fill={HORN} opacity={0.7}>
        <path d="M98 172 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" />
        <circle cx={132} cy={196} r={2.2} />
      </g>
      {/* 近侧前后腿（小碎步） */}
      <g transform={place(114, 231)}>
        <Part name="legR" origin="50% -20%">
          <TallLeg color={COAT} hoof="#F5C542" len={28} w={10} hoofH={7} />
        </Part>
      </g>
      <g transform={place(158, 231)}>
        <Part name="armR" origin="50% -20%">
          <TallLeg color={COAT} hoof="#F5C542" len={28} w={10} hoofH={7} />
        </Part>
      </g>
      {/* 五色流光鬃毛（沿颈背向后飘） */}
      <g fill="none" strokeLinecap="round">
        <path d="M150 92 Q128 100 112 122 Q102 136 100 152" stroke={MANE_1} strokeWidth={7} />
        <path d="M152 100 Q132 108 118 128 Q110 140 108 152" stroke={MANE_2} strokeWidth={6} />
        <path d="M153 108 Q136 116 124 134 Q118 144 116 152" stroke={MANE_3} strokeWidth={5} />
        <path d="M154 116 Q140 124 130 138" stroke={MANE_4} strokeWidth={4} />
        <path d="M154 124 Q144 130 138 140" stroke={MANE_5} strokeWidth={3.4} />
      </g>
      {/* 颈（连接身与头） */}
      <path d="M142 168 Q146 132 162 118 Q180 126 176 148 Q170 166 160 176 Z" fill={COAT} stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round" />
      {/* 胸前塔罗吊坠（挂颈侧） */}
      <path d="M144 162 Q158 170 170 160" fill="none" stroke="#F5C542" strokeWidth={3} strokeLinecap="round" />
      <g transform="translate(158 174) rotate(-6)">
        <rect x={-6} y={-9} width={12} height={18} rx={2.4} fill={HORN} stroke={OUTLINE} strokeWidth={2.6} />
        <path d="M0 -5 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" fill="#FFF7DD" stroke={OUTLINE} strokeWidth={1.3} strokeLinejoin="round" />
      </g>
      {/* 垂耳（脑后） */}
      <ellipse cx={144} cy={92} rx={12} ry={7.5} fill={COAT} stroke={OUTLINE} strokeWidth={4} transform="rotate(-30 144 92)" />
      {/* 头（圆吻马脸前伸） */}
      <ellipse cx={172} cy={110} rx={40} ry={35} fill={COAT} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={192} cy={126} rx={17} ry={11} fill="#FFFFFF" stroke={COAT_DEEP} strokeWidth={2.2} />
      {/* 额发一缕 */}
      <path d="M152 84 Q158 94 156 102" fill="none" stroke={MANE_2} strokeWidth={5} strokeLinecap="round" />
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={178} cy={104} r={9.5} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={198} cy={123} rx={2} ry={3} fill={COAT_DEEP} />
        <path d="M188 134 q5 4 10 -1" fill="none" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
        <ellipse cx={166} cy={124} rx={6.5} ry={4.5} fill="#F5A8C6" opacity={0.7} />
      </g>
      {/* 头顶：水晶塔罗独角（朝前上扬） */}
      <g transform={place(168, 76, 14)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-6 2 L6 2 L2 -28 Q0 -32 -2 -28 Z" fill={HORN} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
          <path d="M-4 -4 L4 -6 M-3 -12 L3 -14 M-2 -19 L2 -20" stroke="#FFF7DD" strokeWidth={2} strokeLinecap="round" />
          <path d="M8 -24 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" fill="#FFD93B" stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：前腿折叠的马卧，角尖挂着"打烊"小木牌，鬃毛铺在背上。 */
function Lie({ palette, slots = {}, eyes = "happy", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 彩虹尾（贴地铺开） */}
      <g transform={place(72, 210)}>
        <Part name="tail" origin="100% 20%">
          <g fill="none" strokeLinecap="round">
            <path d="M0 0 Q-20 4 -24 20" stroke={MANE_1} strokeWidth={5.5} />
            <path d="M0 4 Q-16 8 -19 22" stroke={MANE_2} strokeWidth={5} />
            <path d="M0 8 Q-12 12 -14 23" stroke={MANE_3} strokeWidth={4.5} />
            <path d="M0 12 Q-8 15 -9 23" stroke={MANE_4} strokeWidth={4} />
          </g>
        </Part>
      </g>
      {/* 身体（卧姿） */}
      <ellipse cx={118} cy={200} rx={50} ry={27} fill={COAT} stroke={OUTLINE} strokeWidth={6} />
      {/* 星尘斑 */}
      <g fill={HORN} opacity={0.7}>
        <path d="M94 190 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" />
        <circle cx={128} cy={212} r={2.2} />
      </g>
      {/* 折叠前后腿（蹄包一排） */}
      <g transform={place(86, 224)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={11} ry={5.5} fill={COAT} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={-9} cy={0} rx={4} ry={4.5} fill="#F5C542" stroke={OUTLINE} strokeWidth={2.4} />
        </Part>
      </g>
      <g transform={place(110, 227)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={11} ry={5.5} fill={COAT} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={-9} cy={0} rx={4} ry={4.5} fill="#F5C542" stroke={OUTLINE} strokeWidth={2.4} />
        </Part>
      </g>
      <g transform={place(136, 226, -4)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={0} rx={10} ry={5} fill={COAT} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={8} cy={0} rx={4} ry={4.5} fill="#F5C542" stroke={OUTLINE} strokeWidth={2.4} />
        </Part>
      </g>
      <g transform={place(154, 222, -8)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={0} rx={9} ry={5} fill={COAT} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={7} cy={0} rx={4} ry={4.5} fill="#F5C542" stroke={OUTLINE} strokeWidth={2.4} />
        </Part>
      </g>
      {/* 五色鬃毛（铺在颈背） */}
      <g fill="none" strokeLinecap="round">
        <path d="M138 132 Q116 144 104 166 Q98 176 98 186" stroke={MANE_1} strokeWidth={6.5} />
        <path d="M142 140 Q122 152 112 170 Q108 178 108 186" stroke={MANE_2} strokeWidth={5.5} />
        <path d="M144 148 Q128 158 120 174" stroke={MANE_3} strokeWidth={4.5} />
        <path d="M146 156 Q134 164 128 176" stroke={MANE_4} strokeWidth={3.8} />
      </g>
      {/* 垂耳 */}
      <ellipse cx={132} cy={132} rx={12} ry={7.5} fill={COAT} stroke={OUTLINE} strokeWidth={4} transform="rotate(-32 132 132)" />
      {/* 头（低垂圆吻马脸） */}
      <ellipse cx={158} cy={152} rx={38} ry={33} fill={COAT} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={174} cy={170} rx={16} ry={10} fill="#FFFFFF" stroke={COAT_DEEP} strokeWidth={2.2} />
      {/* 额发 */}
      <path d="M140 126 Q146 136 144 144" fill="none" stroke={MANE_4} strokeWidth={4.5} strokeLinecap="round" />
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={144} cx2={176} cy={146} r={9} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <g fill={COAT_DEEP}>
          <ellipse cx={169} cy={169} rx={1.8} ry={2.8} />
          <ellipse cx={181} cy={168} rx={1.8} ry={2.8} />
        </g>
        <Blush cx1={136} cx2={188} cy={162} />
      </g>
      {/* 头顶：独角 + 角尖挂"打烊"小牌 */}
      <g transform={place(152, 122, -18)}>
        <Part name="headtop" origin="50% 100%">
          <path d="M-6 2 L6 2 L2 -26 Q0 -30 -2 -26 Z" fill={HORN} stroke={OUTLINE} strokeWidth={3.4} strokeLinejoin="round" />
          <path d="M-4 -4 L4 -6 M-3 -12 L3 -13 M-2 -18 L2 -19" stroke="#FFF7DD" strokeWidth={2} strokeLinecap="round" />
          {/* 打烊小牌（挂绳 + 木牌） */}
          <path d="M0 -24 Q-8 -20 -12 -12" fill="none" stroke="#8A6410" strokeWidth={2.2} strokeLinecap="round" />
          <g transform="translate(-16 -6) rotate(-10)">
            <rect x={-9} y={-6} width={18} height={12} rx={2} fill="#E2C08A" stroke={OUTLINE} strokeWidth={2.4} />
            <path d="M-5 -1.5 h10 M-5 2.5 h6" stroke="#8A6410" strokeWidth={1.7} strokeLinecap="round" />
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

const tarotBit: ParticleRenderer = () => (
  <g transform="rotate(-12)">
    <rect x={-5} y={-7} width={10} height={14} rx={2} fill="#B99BE8" stroke={OUTLINE} strokeWidth={2} />
    <path d="M0 -3 l1 2 l2 1 l-2 1 l-1 2 l-1 -2 l-2 -1 l2 -1 z" fill="#FFF7DD" />
  </g>
);
// 水晶球（占卜台上的招牌道具）
const crystalBallStand: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    {/* 金座 */}
    <path d="M-6 9 L6 9 L4 5 L-4 5 Z" fill={MANE_1} strokeWidth={1.8} />
    <path d="M-3.5 5 L3.5 5 L2.5 2 L-2.5 2 Z" fill={MANE_1} strokeWidth={1.6} />
    {/* 水晶球 */}
    <circle cx={0} cy={-4} r={7} fill={HORN} strokeWidth={2} />
    <path d="M-3.5 -6 q2.5 -2 5 -0.5" fill="none" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" opacity={0.9} />
  </g>
);
// 神奇 8 号球（"Ask Again Later"）
const magic8Ball: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    <circle cx={0} cy={0} r={8.5} fill="#2A2A32" strokeWidth={2} />
    <circle cx={0} cy={-3.5} r={3.6} fill="#FFFFFF" strokeWidth={1.4} />
    <text x={0} y={-1.4} fontSize={6} fontWeight={900} textAnchor="middle" fill="#1A1A20" stroke="none" fontFamily="inherit">8</text>
    {/* 蓝色答案三角窗 */}
    <path d="M0 2 L5 8.5 L-5 8.5 Z" fill="#2E7BD6" strokeWidth={1.4} />
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1,
    palette: { body: COAT, deep: COAT_DEEP, belly: "#FFFFFF", accent: HORN, accent2: "#7FE3C8" },
    eyes: "happy",
    foodAnchor: { x: 128, y: 136 },
    shadowRx: 52,
  },
  // 塔罗牌：一叠牌 + 翻开的星星牌
  tool: () => (
    <g>
      <g transform="rotate(6)">
        <rect x={-12} y={-22} width={16} height={22} rx={2.5} fill="#7280C9" stroke={OUTLINE} strokeWidth={2.8} />
        <path d="M-8 -17 h8 M-8 -12 h8 M-8 -7 h5" stroke="#9FA8E8" strokeWidth={1.8} strokeLinecap="round" />
      </g>
      <g transform="translate(8 -8) rotate(-14)">
        <rect x={-8} y={-20} width={16} height={24} rx={2.5} fill="#FFF7DD" stroke={OUTLINE} strokeWidth={2.8} />
        <path d="M0 -14 l1.8 3.6 l3.6 1.8 l-3.6 1.8 l-1.8 3.6 l-1.8 -3.6 l-3.6 -1.8 l3.6 -1.8 z" fill="#FFD93B" stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round" />
      </g>
    </g>
  ),
  workFx: {
    emitter: { x: 196, y: 208 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.65,
    shapes: [tarotBit, crystalBallStand, magic8Ball],
  },
  meta: {
    nameZh: "灵角兽",
    elements: ["electric", "fire", "grass", "ice", "water"],
    family: "有蹄神兽",
    toolAnchor: { x: 194, y: 231 },
    nodeBudget: 305,
    lieNote: "前腿折叠卧，角尖挂“打烊”小牌",
  },
};
