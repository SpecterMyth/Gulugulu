// ---------------------------------------------------------------------------
// 晶麒麟 prismkirin — e6（全六元素）· 有蹄神兽 · 全谱旗舰
// 剪影：六棱水晶角小麒麟：六色流光鬃 + 虹彩背鳞排 + 金蹄踏云 +
//       身侧六元素徽环（orbit）+ 颊鬃狮尾。登场自带 BGM（自己哼的）。
// 睡姿（P3）：神兽卧姿，鬃毛光带铺成小毯，角光调暗当夜灯。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import { TallLeg } from "../../parts/limbs";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const COAT = "#FFF7EE";
const GOLDEN = "#E2C08A";
const PRISM = "#B99BE8";
const E_N = "#6E6E78";
const E_F = "#E85D3A";
const E_E = "#FFD93B";
const E_W = "#2E7BD6";
const E_G = "#57B84C";
const E_I = "#8FD8E8";
const GOLD = "#F5C542";

function Front({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 全要素层1：身侧六元素徽环（part-orbit 慢转） */}
      <g transform={place(128, 168)}>
        <g className="part-orbit">
          <g stroke={OUTLINE} strokeWidth={2.2}>
            <circle cx={-70} cy={0} r={6} fill={E_F} />
            <circle cx={70} cy={0} r={6} fill={E_W} />
            <circle cx={-38} cy={-20} r={6} fill={E_E} />
            <circle cx={38} cy={-20} r={6} fill={E_I} />
            <circle cx={-38} cy={20} r={6} fill={E_G} />
            <circle cx={38} cy={20} r={6} fill={E_N} />
          </g>
          <g fill="#FFFFFF" opacity={0.85}>
            <circle cx={-72} cy={-2} r={1.6} />
            <circle cx={36} cy={-22} r={1.6} />
            <circle cx={-40} cy={18} r={1.6} />
          </g>
        </g>
      </g>
      {/* 全要素层2：背脊光带（六色弧带从颈后拖到尾侧，part-banner 波动） */}
      <g transform={place(158, 110)}>
        <g className="part-banner">
          <g fill="none" strokeLinecap="round" opacity={0.95}>
            <path d="M0 0 Q36 10 44 44 Q46 62 36 74" stroke={E_E} strokeWidth={6} />
            <path d="M2 6 Q34 16 40 46 Q41 60 33 70" stroke={E_F} strokeWidth={5} />
            <path d="M3 12 Q31 22 35 48 Q36 58 30 66" stroke={E_G} strokeWidth={4.2} />
            <path d="M4 18 Q28 28 30 50 Q30 57 26 62" stroke={E_I} strokeWidth={3.4} />
            <path d="M5 24 Q25 32 25 50" stroke={E_W} strokeWidth={2.8} />
          </g>
        </g>
      </g>
      {/* 狮尾（左侧甩出，端穗六色其三） */}
      <g transform={place(80, 182)}>
        <Part name="tail" origin="100% 20%">
          <path d="M0 0 Q-20 6 -24 24" fill="none" stroke={GOLDEN} strokeWidth={6} strokeLinecap="round" />
          <g stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round">
            <path d="M-28 24 Q-34 32 -30 40 Q-24 36 -24 30 Z" fill={E_F} />
            <path d="M-24 28 Q-26 38 -20 42 Q-16 36 -18 30 Z" fill={E_E} />
            <path d="M-20 26 Q-18 36 -12 38 Q-11 31 -14 27 Z" fill={E_I} />
          </g>
        </Part>
      </g>
      {/* 金蹄细腿 + 蹄下小云（全要素层3：云蹄） */}
      <g transform={place(104, 226)}>
        <Part name="legL" origin="50% -20%">
          <TallLeg color={COAT} hoof="#F5C542" len={26} w={10} hoofH={7} />
        </Part>
      </g>
      <g transform={place(152, 226)}>
        <Part name="legR" origin="50% -20%">
          <TallLeg color={COAT} hoof="#F5C542" len={26} w={10} hoofH={7} />
        </Part>
      </g>
      <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.4}>
        <ellipse cx={104} cy={230} rx={16} ry={7} />
        <ellipse cx={152} cy={230} rx={16} ry={7} />
      </g>
      {/* 身体（略缩让位大头） */}
      <ellipse cx={128} cy={182} rx={46} ry={31} fill={COAT} stroke={OUTLINE} strokeWidth={6} />
      {/* 虹彩背鳞排（沿背脊三片，随头放大下移） */}
      <g stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round">
        <path d="M90 162 L102 152 L110 164 Q100 168 90 162 Z" fill={E_I} />
        <path d="M112 156 L124 146 L132 160 Q122 164 112 156 Z" fill={E_G} />
        <path d="M136 158 L148 150 L154 164 Q144 166 136 158 Z" fill={E_W} />
      </g>
      {/* 腹部金环纹 + 星尘 */}
      <path d="M92 186 Q128 198 164 186" fill="none" stroke={GOLDEN} strokeWidth={3.4} strokeLinecap="round" />
      <ellipse cx={128} cy={196} rx={26} ry={13} fill="#FFFFFF" opacity={0.95} />
      <g fill={PRISM} opacity={0.8}>
        <path d="M104 170 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" />
        <circle cx={156} cy={178} r={2.2} />
      </g>
      {/* 小手（胸前收拢小蹄手） */}
      <g transform={place(100, 194, 22)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8.5} fill={COAT} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={place(156, 194, -22)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={7} rx={5.5} ry={8.5} fill={COAT} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 颊鬃（麒麟腮须，六色其二）+ 垂耳（随大头外移） */}
      <g stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round">
        <path d="M88 122 Q74 124 70 136 Q81 140 90 133 Z" fill={E_E} />
        <path d="M168 122 Q182 124 186 136 Q175 140 166 133 Z" fill={E_G} />
      </g>
      <g fill={COAT} stroke={OUTLINE} strokeWidth={4}>
        <ellipse cx={92} cy={90} rx={13} ry={8} transform="rotate(-26 92 90)" />
        <ellipse cx={164} cy={90} rx={13} ry={8} transform="rotate(26 164 90)" />
      </g>
      {/* 头（圆吻龙马脸——婴儿比例大头） */}
      <ellipse cx={128} cy={114} rx={45} ry={38} fill={COAT} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={128} cy={134} rx={21} ry={12} fill="#FFFFFF" stroke={GOLDEN} strokeWidth={2.2} />
      {/* 额前六色刘海鬃（小三缕） */}
      <g fill="none" strokeLinecap="round">
        <path d="M108 86 Q112 96 110 104" stroke={E_F} strokeWidth={5} />
        <path d="M117 83 Q120 93 118 102" stroke={E_W} strokeWidth={4.5} />
        <path d="M100 92 Q105 100 103 108" stroke={E_I} strokeWidth={4} />
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={110} cx2={146} cy={106} r={9.5} mouthY={134} mouthW={12} expression={expression} base={eyes} />
        <g fill={GOLDEN}>
          <ellipse cx={119} cy={132} rx={2} ry={3} />
          <ellipse cx={137} cy={132} rx={2} ry={3} />
        </g>
        <Blush cx1={99} cx2={157} cy={122} />
      </g>
      {/* 头顶：六棱水晶角（招牌：宽棱镜多面体 + 侧枝 + 顶星，headtop 呼吸摇） */}
      <g transform={place(128, 78)}>
        <Part name="headtop" origin="50% 100%">
          <g stroke={OUTLINE} strokeLinejoin="round">
            <path d="M-8 2 L-14 -18 L-7 -32 L7 -32 L14 -18 L8 2 Z" fill={PRISM} strokeWidth={3.6} />
            <path d="M-7 -32 L0 -44 L7 -32" fill={PRISM} strokeWidth={3.6} />
            <path d="M-14 -18 L0 -22 L14 -18 M-7 -32 L0 -22 L7 -32 M0 -22 L0 2" fill="none" strokeWidth={2} stroke="#8F7AD1" />
          </g>
          <g fill="none" strokeWidth={2.2} strokeLinecap="round">
            <path d="M-10 -14 l4 -3" stroke="#FFFFFF" opacity={0.9} />
            <path d="M6 -26 l3 -3" stroke="#FFFFFF" opacity={0.9} />
          </g>
          <path d="M-18 -6 Q-24 -10 -25 -16 M18 -6 Q24 -10 25 -16" fill="none" stroke={GOLDEN} strokeWidth={3.4} strokeLinecap="round" />
          <path d="M0 -48 l1.8 3.6 l3.6 1.8 l-3.6 1.8 l-1.8 3.6 l-1.8 -3.6 l-3.6 -1.8 l3.6 -1.8 z" fill={E_E} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
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

/** 侧视（右向）：踏云小跑，棱镜角朝前，六色鬃沿颈背拖成光带，狮尾后甩。 */
function Side({ palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 六元素徽环（随行） */}
      <g transform={place(124, 170)}>
        <g className="part-orbit">
          <g stroke={OUTLINE} strokeWidth={2.2}>
            <circle cx={-64} cy={0} r={6} fill={E_F} />
            <circle cx={64} cy={0} r={6} fill={E_W} />
            <circle cx={-34} cy={-19} r={6} fill={E_E} />
            <circle cx={34} cy={-19} r={6} fill={E_I} />
            <circle cx={-34} cy={19} r={6} fill={E_G} />
            <circle cx={34} cy={19} r={6} fill={E_N} />
          </g>
        </g>
      </g>
      {/* 背脊光带（向后拖出六色，banner 波动） */}
      <g transform={place(112, 112)}>
        <g className="part-banner">
          <g fill="none" strokeLinecap="round" opacity={0.95}>
            <path d="M0 0 Q-36 6 -50 34 Q-55 48 -50 60" stroke={E_E} strokeWidth={6} />
            <path d="M0 6 Q-32 14 -44 38 Q-48 50 -44 58" stroke={E_F} strokeWidth={5} />
            <path d="M0 12 Q-28 22 -38 42 Q-40 50 -37 56" stroke={E_G} strokeWidth={4.2} />
            <path d="M0 18 Q-24 28 -30 44" stroke={E_I} strokeWidth={3.4} />
            <path d="M0 24 Q-18 32 -22 44" stroke={E_W} strokeWidth={2.8} />
          </g>
        </g>
      </g>
      {/* 狮尾（身后甩，三色端穗） */}
      <g transform={place(78, 182)}>
        <Part name="tail" origin="100% 20%">
          <path d="M0 0 Q-20 6 -24 24" fill="none" stroke={GOLDEN} strokeWidth={6} strokeLinecap="round" />
          <g stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round">
            <path d="M-28 24 Q-34 32 -30 40 Q-24 36 -24 30 Z" fill={E_F} />
            <path d="M-24 28 Q-26 38 -20 42 Q-16 36 -18 30 Z" fill={E_E} />
            <path d="M-20 26 Q-18 36 -12 38 Q-11 31 -14 27 Z" fill={E_I} />
          </g>
        </Part>
      </g>
      {/* 远侧前后腿（踏云） */}
      <g transform={place(100, 227)}>
        <Part name="legL" origin="50% -20%">
          <TallLeg color="#EFE3D2" hoof="#E2A52C" len={24} w={9.5} hoofH={7} />
        </Part>
      </g>
      <g transform={place(146, 227)}>
        <Part name="armL" origin="50% -20%">
          <TallLeg color="#EFE3D2" hoof="#E2A52C" len={24} w={9.5} hoofH={7} />
        </Part>
      </g>
      {/* 蹄下云朵 */}
      <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={3.4}>
        <ellipse cx={106} cy={231} rx={16} ry={7} />
        <ellipse cx={154} cy={231} rx={16} ry={7} />
      </g>
      {/* 身体（横向） */}
      <ellipse cx={122} cy={184} rx={48} ry={30} fill={COAT} stroke={OUTLINE} strokeWidth={6} />
      {/* 虹彩背鳞排（沿背脊） */}
      <g stroke={OUTLINE} strokeWidth={2.8} strokeLinejoin="round">
        <path d="M86 168 L98 158 L106 170 Q96 174 86 168 Z" fill={E_I} />
        <path d="M108 160 L120 150 L128 164 Q118 168 108 160 Z" fill={E_G} />
        <path d="M132 158 L144 150 L150 164 Q140 166 132 158 Z" fill={E_W} />
      </g>
      {/* 腹部金环纹 + 星尘 */}
      <path d="M88 190 Q122 202 158 188" fill="none" stroke={GOLDEN} strokeWidth={3.4} strokeLinecap="round" />
      <ellipse cx={124} cy={198} rx={26} ry={12} fill="#FFFFFF" opacity={0.95} />
      <path d="M100 174 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" fill={PRISM} opacity={0.8} />
      {/* 近侧前后腿（小跑） */}
      <g transform={place(114, 228)}>
        <Part name="legR" origin="50% -20%">
          <TallLeg color={COAT} hoof="#F5C542" len={26} w={10} hoofH={7} />
        </Part>
      </g>
      <g transform={place(158, 228)}>
        <Part name="armR" origin="50% -20%">
          <TallLeg color={COAT} hoof="#F5C542" len={26} w={10} hoofH={7} />
        </Part>
      </g>
      {/* 六色流光鬃（沿颈背向后飘） */}
      <g fill="none" strokeLinecap="round">
        <path d="M150 90 Q126 98 110 120 Q100 134 98 150" stroke={E_E} strokeWidth={7} />
        <path d="M152 98 Q132 106 118 126 Q110 138 108 150" stroke={E_F} strokeWidth={6} />
        <path d="M153 106 Q136 114 124 132 Q118 142 116 150" stroke={E_G} strokeWidth={5} />
        <path d="M154 114 Q140 122 130 136" stroke={E_I} strokeWidth={4} />
        <path d="M154 122 Q144 128 138 138" stroke={E_W} strokeWidth={3.4} />
      </g>
      {/* 颈（连接身与头） */}
      <path d="M140 170 Q144 132 160 118 Q180 126 176 148 Q170 166 158 178 Z" fill={COAT} stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round" />
      {/* 颊鬃（近侧腮须）+ 垂耳（脑后） */}
      <path d="M156 132 Q146 138 144 148 Q154 150 160 142 Z" fill={E_G} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <ellipse cx={144} cy={90} rx={12} ry={7.5} fill={COAT} stroke={OUTLINE} strokeWidth={4} transform="rotate(-30 144 90)" />
      {/* 头（圆吻龙马脸前伸） */}
      <ellipse cx={170} cy={110} rx={40} ry={34} fill={COAT} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={191} cy={128} rx={17} ry={10} fill="#FFFFFF" stroke={GOLDEN} strokeWidth={2.2} />
      {/* 额前六色刘海 */}
      <g fill="none" strokeLinecap="round">
        <path d="M150 84 Q156 94 154 102" stroke={E_F} strokeWidth={5} />
        <path d="M142 90 Q148 98 146 106" stroke={E_I} strokeWidth={4.5} />
      </g>
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={176} cy={104} r={9.5} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={197} cy={125} rx={2} ry={3} fill={GOLDEN} />
        <path d="M186 136 q5 4 10 -1" fill="none" stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" />
        <ellipse cx={164} cy={124} rx={6.5} ry={4.5} fill="#F5A8C6" opacity={0.7} />
      </g>
      {/* 头顶：六棱水晶角（朝前上扬） */}
      <g transform={place(164, 76, 12)}>
        <Part name="headtop" origin="50% 100%">
          <g stroke={OUTLINE} strokeLinejoin="round">
            <path d="M-8 2 L-14 -18 L-7 -32 L7 -32 L14 -18 L8 2 Z" fill={PRISM} strokeWidth={3.6} />
            <path d="M-7 -32 L0 -44 L7 -32" fill={PRISM} strokeWidth={3.6} />
            <path d="M-14 -18 L0 -22 L14 -18 M-7 -32 L0 -22 L7 -32 M0 -22 L0 2" fill="none" strokeWidth={2} stroke="#8F7AD1" />
          </g>
          <path d="M-10 -14 l4 -3 M6 -26 l3 -3" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" opacity={0.9} />
          <path d="M-18 -6 Q-24 -10 -25 -16" fill="none" stroke={GOLDEN} strokeWidth={3.4} strokeLinecap="round" />
          <path d="M0 -48 l1.8 3.6 l3.6 1.8 l-3.6 1.8 l-1.8 3.6 l-1.8 -3.6 l-3.6 -1.8 l3.6 -1.8 z" fill={E_E} stroke={OUTLINE} strokeWidth={1.8} strokeLinejoin="round" />
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：神兽卧姿四蹄收拢，六色鬃光带铺在身侧当小毯，棱镜角调暗成夜灯。 */
function Lie({ palette, slots = {}, eyes = "happy", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 六元素徽环（贴地缓转） */}
      <g transform={place(128, 222)}>
        <g className="part-orbit">
          <g stroke={OUTLINE} strokeWidth={2}>
            <circle cx={-60} cy={0} r={5.5} fill={E_F} />
            <circle cx={60} cy={0} r={5.5} fill={E_W} />
            <circle cx={-30} cy={-8} r={5.5} fill={E_E} />
            <circle cx={30} cy={-8} r={5.5} fill={E_I} />
            <circle cx={-30} cy={8} r={5.5} fill={E_G} />
            <circle cx={30} cy={8} r={5.5} fill={E_N} />
          </g>
        </g>
      </g>
      {/* 鬃毛光带铺成小毯（左侧摊地，banner 微动） */}
      <g transform={place(78, 196)}>
        <g className="part-banner">
          <g fill="none" strokeLinecap="round" opacity={0.95}>
            <path d="M0 0 Q-24 8 -32 26 Q-34 36 -30 42" stroke={E_E} strokeWidth={6} />
            <path d="M2 6 Q-18 14 -24 30 Q-25 38 -22 42" stroke={E_F} strokeWidth={5} />
            <path d="M4 12 Q-12 20 -16 32" stroke={E_G} strokeWidth={4.2} />
            <path d="M6 18 Q-6 24 -9 34" stroke={E_I} strokeWidth={3.4} />
            <path d="M8 24 Q-1 28 -3 36" stroke={E_W} strokeWidth={2.8} />
          </g>
        </g>
      </g>
      {/* 狮尾（盘在身侧） */}
      <g transform={place(184, 212)}>
        <Part name="tail" origin="0% 20%">
          <path d="M0 0 Q16 4 18 18" fill="none" stroke={GOLDEN} strokeWidth={5.5} strokeLinecap="round" />
          <g stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round">
            <path d="M20 18 Q26 24 22 32 Q16 28 16 23 Z" fill={E_F} />
            <path d="M16 22 Q17 31 12 34 Q9 28 11 23 Z" fill={E_E} />
          </g>
        </Part>
      </g>
      {/* 身体（神兽卧姿） */}
      <ellipse cx={122} cy={200} rx={52} ry={27} fill={COAT} stroke={OUTLINE} strokeWidth={6} />
      {/* 虹彩背鳞（伏贴两片） */}
      <g stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round">
        <path d="M92 182 L103 174 L110 184 Q101 188 92 182 Z" fill={E_I} />
        <path d="M114 176 L125 168 L131 180 Q122 184 114 176 Z" fill={E_G} />
      </g>
      {/* 腹部金环纹 + 星尘 */}
      <path d="M86 206 Q122 216 160 204" fill="none" stroke={GOLDEN} strokeWidth={3.2} strokeLinecap="round" />
      <path d="M98 190 l1.4 2.8 l2.8 1.4 l-2.8 1.4 l-1.4 2.8 l-1.4 -2.8 l-2.8 -1.4 l2.8 -1.4 z" fill={PRISM} opacity={0.8} />
      {/* 收拢四蹄（金蹄包一排） */}
      <g transform={place(88, 224)}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={11} ry={5.5} fill={COAT} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={-9} cy={0} rx={4} ry={4.5} fill="#F5C542" stroke={OUTLINE} strokeWidth={2.4} />
        </Part>
      </g>
      <g transform={place(112, 227)}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={11} ry={5.5} fill={COAT} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={-9} cy={0} rx={4} ry={4.5} fill="#F5C542" stroke={OUTLINE} strokeWidth={2.4} />
        </Part>
      </g>
      <g transform={place(138, 226, -4)}>
        <Part name="armL" origin="50% 8%">
          <ellipse cx={0} cy={0} rx={10} ry={5} fill={COAT} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={8} cy={0} rx={4} ry={4.5} fill="#F5C542" stroke={OUTLINE} strokeWidth={2.4} />
        </Part>
      </g>
      <g transform={place(156, 222, -8)}>
        <Part name="armR" origin="50% 8%">
          <ellipse cx={0} cy={0} rx={9} ry={5} fill={COAT} stroke={OUTLINE} strokeWidth={3.6} />
          <ellipse cx={7} cy={0} rx={4} ry={4.5} fill="#F5C542" stroke={OUTLINE} strokeWidth={2.4} />
        </Part>
      </g>
      {/* 颈 + 颊鬃 + 垂耳 */}
      <path d="M124 186 Q128 156 146 146 Q166 152 162 174 Q156 190 146 198 Z" fill={COAT} stroke={OUTLINE} strokeWidth={5.5} strokeLinejoin="round" />
      <path d="M138 160 Q128 164 126 174 Q136 176 142 168 Z" fill={E_E} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <ellipse cx={132} cy={128} rx={12} ry={7.5} fill={COAT} stroke={OUTLINE} strokeWidth={4} transform="rotate(-32 132 128)" />
      {/* 头（微垂而眠） */}
      <ellipse cx={158} cy={150} rx={38} ry={32} fill={COAT} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={176} cy={168} rx={16} ry={10} fill="#FFFFFF" stroke={GOLDEN} strokeWidth={2.2} />
      {/* 额前刘海 */}
      <g fill="none" strokeLinecap="round">
        <path d="M140 124 Q146 134 144 142" stroke={E_F} strokeWidth={4.5} />
        <path d="M132 130 Q138 138 136 146" stroke={E_I} strokeWidth={4} />
      </g>
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={146} cx2={176} cy={144} r={9} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <g fill={GOLDEN}>
          <ellipse cx={171} cy={167} rx={1.8} ry={2.8} />
          <ellipse cx={182} cy={166} rx={1.8} ry={2.8} />
        </g>
        <Blush cx1={138} cx2={186} cy={160} />
      </g>
      {/* 头顶：棱镜角调暗成夜灯（柔光晕） */}
      <g transform={place(150, 120, -10)}>
        <Part name="headtop" origin="50% 100%">
          <circle cx={0} cy={-18} r={26} fill={PRISM} opacity={0.22} />
          <g stroke={OUTLINE} strokeLinejoin="round">
            <path d="M-7 2 L-12 -15 L-6 -27 L6 -27 L12 -15 L7 2 Z" fill={PRISM} strokeWidth={3.4} />
            <path d="M-6 -27 L0 -37 L6 -27" fill={PRISM} strokeWidth={3.4} />
            <path d="M-12 -15 L0 -18 L12 -15 M-6 -27 L0 -18 L6 -27 M0 -18 L0 2" fill="none" strokeWidth={1.8} stroke="#8F7AD1" />
          </g>
          <path d="M-8 -12 l3 -2" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" opacity={0.9} />
          <path d="M0 -41 l1.6 3.2 l3.2 1.6 l-3.2 1.6 l-1.6 3.2 l-1.6 -3.2 l-3.2 -1.6 l3.2 -1.6 z" fill={E_E} stroke={OUTLINE} strokeWidth={1.6} strokeLinejoin="round" opacity={0.9} />
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

// 旗舰打工的产物（超顶配，非元素）：金奖杯 + 切工钻石 + S 级徽章
const trophy: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    {/* 杯身 */}
    <path d="M-6 -9 L6 -9 L5 -3 Q3 2 0 2 Q-3 2 -5 -3 Z" fill={GOLD} strokeWidth={2} />
    {/* 双耳 */}
    <path d="M-6 -8 Q-11 -7 -9 -2 Q-8 0 -5 -1" fill="none" strokeWidth={1.8} />
    <path d="M6 -8 Q11 -7 9 -2 Q8 0 5 -1" fill="none" strokeWidth={1.8} />
    {/* 杯柄 */}
    <path d="M0 2 V6" strokeWidth={2.4} strokeLinecap="round" />
    {/* 底座 */}
    <path d="M-5 10 L5 10 L4 6 L-4 6 Z" fill={GOLD} strokeWidth={2} />
    {/* 杯面星 */}
    <path d="M0 -7 l1 2.1 l2.3 0.3 l-1.7 1.6 l0.4 2.3 l-2 -1.1 l-2 1.1 l0.4 -2.3 l-1.7 -1.6 l2.3 -0.3 z" fill="#FFF3C4" stroke="none" />
  </g>
);
const diamond: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    {/* 亭部 */}
    <path d="M-4 -8 L4 -8 L8 -4 L0 10 L-8 -4 Z" fill={E_I} strokeWidth={2} />
    {/* 冠部台面 */}
    <path d="M-4 -8 L-8 -4 L8 -4 L4 -8 Z" fill="#CFEFF6" strokeWidth={2} />
    {/* 刻面线 */}
    <g stroke={OUTLINE} strokeWidth={1.2} fill="none">
      <path d="M-4 -8 L-2 -4 L0 10 M4 -8 L2 -4 L0 10 M-8 -4 L-2 -4 M8 -4 L2 -4 M-2 -4 L2 -4" />
    </g>
    <path d="M-3 -6.4 h3.4" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" />
  </g>
);
const rankBadge: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round">
    {/* 绶带 */}
    <path d="M-3 6 L-5 13 L-1 11 Z" fill={E_F} strokeWidth={1.6} />
    <path d="M3 6 L5 13 L1 11 Z" fill={E_F} strokeWidth={1.6} />
    {/* 花瓣勋章 */}
    <path d="M0 -9 L2 -6.2 L5.4 -7 L5.2 -3.4 L8.6 -1.6 L6.4 1.4 L8 4.8 L4.3 5.2 L2.8 8.8 L0 6.6 L-2.8 8.8 L-4.3 5.2 L-8 4.8 L-6.4 1.4 L-8.6 -1.6 L-5.2 -3.4 L-5.4 -7 L-2 -6.2 Z" fill={GOLD} strokeWidth={1.8} />
    <circle cx={0} cy={-1} r={4.8} fill="#FFF3C4" strokeWidth={1.6} />
    <text x={0} y={2.2} fontSize={9} fontWeight={900} textAnchor="middle" fill={E_F} stroke="none" fontFamily="inherit">S</text>
  </g>
);

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1,
    palette: { body: COAT, deep: GOLDEN, belly: "#FFFFFF", accent: PRISM, accent2: E_I },
    eyes: "happy",
    foodAnchor: { x: 128, y: 138 },
    shadowRx: 56,
  },
  // 棱镜权杖：金杖 + 顶端六棱水晶折射彩光
  tool: () => (
    <g>
      <path d="M-2.6 0 L2.6 0 L2 -34 L-2 -34 Z" fill="#D9A514" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <circle cx={0} cy={-12} r={3} fill={E_F} stroke={OUTLINE} strokeWidth={1.8} />
      <path d="M-7 -40 L0 -52 L7 -40 L7 -34 L0 -30 L-7 -34 Z" fill={PRISM} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
      <path d="M0 -52 V-30" stroke="#8F7AD1" strokeWidth={1.8} />
      <g strokeWidth={2.2} strokeLinecap="round" fill="none">
        <path d="M9 -44 l7 -4" stroke={E_F} />
        <path d="M10 -38 l8 0" stroke={E_E} />
        <path d="M9 -32 l7 4" stroke={E_W} />
      </g>
    </g>
  ),
  workFx: {
    emitter: { x: 198, y: 190 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.7,
    shapes: [trophy, diamond, rankBadge],
  },
  meta: {
    nameZh: "晶麒麟",
    elements: ["electric", "fire", "grass", "ice", "normal", "water"],
    family: "有蹄神兽",
    toolAnchor: { x: 196, y: 231 },
    nodeBudget: 380,
    lieNote: "神兽卧姿，鬃毛光带铺成小毯，角光调暗当夜灯",
  },
};
