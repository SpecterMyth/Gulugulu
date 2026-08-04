// ---------------------------------------------------------------------------
// 风暴龙 stormdrake — e3（electric+fire+ice）· 蛇形爬行
// 剪影：面条身形的东方小龙立起 S 弯（招牌），一角冒火一角结霜，
//       背鬃=静电茸毛，脚踩一小朵云。云端气象员。
// 睡姿（P3）：盘成三圈，头枕尾巴。
// ---------------------------------------------------------------------------
import { OUTLINE, type RigProps } from "../../rigTypes";
import { Part, Blush } from "../../parts/common";
import { ExpFace, ExpSideFace } from "../../parts/faces";
import { place } from "../../parts/anchors";
import type { SpeciesPack } from "../types";
import type { ParticleRenderer } from "../../parts/workFx";

const SCALE = "#8FA3D9";
const DEEP = "#5C6FA8";
const BELLY = "#FFF6CE";
const FLAME = "#FFB03A";
const ICE = "#8FD8E8";
const VOLT = "#FFD93B";

function Front({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 脚下小云（platform 感） */}
      <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={4.5}>
        <ellipse cx={106} cy={222} rx={20} ry={12} />
        <ellipse cx={140} cy={226} rx={24} ry={13} />
      </g>
      {/* 尾（S 身的尾端从云后翘出，火苗尾尖） */}
      <g transform={place(172, 210, 20)}>
        <Part name="tail" origin="10% 80%">
          <path d="M0 0 Q16 -4 20 -18" fill="none" stroke={SCALE} strokeWidth={12} strokeLinecap="round" />
          <path d="M20 -22 q-4 -4 -2 -9 q3 2.5 3 6 q2.5 -4 1 -7 q5 3 4 8.5 q-1 4.5 -6 1.5 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 面条 S 身（自云中立起，向上到头） */}
      <path
        d="M108 218 Q84 206 88 178 Q92 152 116 148 Q136 145 138 128 Q139 118 132 112 L150 104 Q158 118 152 134 Q144 152 122 158 Q104 162 102 180 Q100 198 120 206 Q130 210 132 218 Q120 226 108 218 Z"
        fill={SCALE}
        stroke={OUTLINE}
        strokeWidth={5.5}
        strokeLinejoin="round"
      />
      {/* 腹甲纹（S 身内侧） */}
      <g fill="none" stroke={BELLY} strokeWidth={4} strokeLinecap="round" opacity={0.95}>
        <path d="M96 176 q8 3 16 1" />
        <path d="M98 190 q8 4 16 3" />
        <path d="M112 202 q7 4 14 3" />
      </g>
      {/* 背鬃=静电茸毛（沿 S 背脊三簇） */}
      <g fill={VOLT} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round">
        <path d="M86 172 l-7 -3 l5 -4 l-6 -3 l7 -3 l-2 6 z" />
        <path d="M92 156 l-6 -5 l6 -2 l-4 -5 l8 -1 l-1 7 z" />
        <path d="M104 146 l-4 -6 l7 -1 l-2 -6 l7 2 l-3 6 z" />
      </g>
      {/* 小手（龙爪一对，扒在身前） */}
      <g transform={place(112, 168, 24)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 Q-3 8 -8 10 M0 0 Q0 9 -2 12 M0 0 Q3 8 2 11" fill="none" stroke={SCALE} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(146, 172, -24)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 Q3 8 8 10 M0 0 Q0 9 2 12 M0 0 Q-3 8 -2 11" fill="none" stroke={SCALE} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 腿位（云上两只小爪） */}
      <g transform={place(108, 226)}>
        <Part name="legL" origin="50% -40%">
          <ellipse cx={0} cy={0} rx={7.5} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} />
        </Part>
      </g>
      <g transform={place(142, 228)}>
        <Part name="legR" origin="50% -40%">
          <ellipse cx={0} cy={0} rx={7.5} ry={4.5} fill={DEEP} stroke={OUTLINE} strokeWidth={3.4} />
        </Part>
      </g>
      {/* 龙头（宽吻大圆头，昂首——大头比例） */}
      <g>
        <ellipse cx={142} cy={90} rx={40} ry={33} fill={SCALE} stroke={OUTLINE} strokeWidth={6} />
        {/* 宽吻 */}
        <path d="M113 96 Q104 105 111 115 Q126 121 143 117 Q141 105 134 98 Z" fill={BELLY} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        <g fill={DEEP}>
          <circle cx={119} cy={105} r={2.2} />
          <circle cx={128} cy={109} r={2.2} />
        </g>
        {/* 龙须两根 */}
        <path d="M110 100 q-11 2 -15 -4 M112 110 q-11 4 -17 0" fill="none" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
      </g>
      {/* 脸 */}
      <g className="part-face">
        <ExpFace cx1={133} cx2={161} cy={82} r={9} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={124} cx2={168} cy={98} />
      </g>
      {/* 头顶：一角火一角冰（招牌，headtop 呼吸摇） */}
      <g transform={place(147, 61)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="translate(-12 0)">
            <path d="M-4 2 L4 2 L1 -12 Q0 -14 -1 -12 Z" fill="#F5C9A5" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
            <path d="M0 -14 q-4 -4 -2 -9 q3 2 3 6 q2.5 -4 1 -7 q4.5 3 3.5 8 q-1 4 -5.5 2 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
          </g>
          <g transform="translate(12 0)">
            <path d="M-4 2 L4 2 L1 -12 Q0 -14 -1 -12 Z" fill="#F5C9A5" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
            <path d="M0 -20 L4 -13 L1 -6 L-3 -13 Z" fill={ICE} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
          </g>
        </Part>
      </g>
      {/* 工具（工作状态淡入） */}
      {slots.tool && (
        <g transform={place(196, 228)}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 侧视（右向）：面条龙贴云波浪前行，龙头在前昂起，尾焰在后。 */
function Side({ palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 脚下小云（随行两朵） */}
      <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={4.5}>
        <ellipse cx={100} cy={226} rx={20} ry={12} />
        <ellipse cx={150} cy={228} rx={23} ry={12} />
      </g>
      {/* 尾（波浪尾端翘起 + 火苗尾尖） */}
      <g transform={place(92, 208)}>
        <Part name="tail" origin="100% 80%">
          <path d="M0 4 Q-18 2 -22 -12" fill="none" stroke={OUTLINE} strokeWidth={17} strokeLinecap="round" />
          <path d="M0 4 Q-18 2 -22 -12" fill="none" stroke={SCALE} strokeWidth={11.5} strokeLinecap="round" />
          <path d="M-22 -18 q-4 -4 -2 -9 q3 2.5 3 6 q2.5 -4 1 -7 q5 3 4 8.5 q-1 4.5 -6 1.5 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 面条身（水平波浪，双描边法） */}
      <path d="M92 206 Q108 216 128 208 Q150 200 158 182 Q164 168 172 160" fill="none" stroke={OUTLINE} strokeWidth={19} strokeLinecap="round" />
      <path d="M92 206 Q108 216 128 208 Q150 200 158 182 Q164 168 172 160" fill="none" stroke={SCALE} strokeWidth={13.5} strokeLinecap="round" />
      {/* 腹甲纹（波浪内侧） */}
      <g fill="none" stroke={BELLY} strokeWidth={3.6} strokeLinecap="round" opacity={0.95}>
        <path d="M108 212 q8 2 16 -1" />
        <path d="M140 200 q7 -3 12 -9" />
      </g>
      {/* 背鬃=静电茸毛（沿背脊两簇） */}
      <g fill={VOLT} stroke={OUTLINE} strokeWidth={2.6} strokeLinejoin="round">
        <path d="M120 198 l-2 -7 l6 2 l0 -6 l6 4 l-4 5 z" />
        <path d="M148 184 l0 -7 l5 3 l2 -6 l4 6 l-6 4 z" />
      </g>
      {/* 龙爪（身下两只小爪迈步） */}
      <g transform={place(112, 224, 8)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 Q-3 6 -7 8 M0 0 Q0 7 -1 9 M0 0 Q3 6 2 9" fill="none" stroke={DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(146, 214, -8)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 Q-3 6 -7 8 M0 0 Q0 7 -1 9 M0 0 Q3 6 2 9" fill="none" stroke={SCALE} strokeWidth={5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 云上小爪（腿位） */}
      <g transform={place(102, 228)}>
        <Part name="legL" origin="50% -40%">
          <ellipse cx={0} cy={0} rx={7} ry={4.2} fill={DEEP} stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      <g transform={place(152, 230)}>
        <Part name="legR" origin="50% -40%">
          <ellipse cx={0} cy={0} rx={7} ry={4.2} fill={DEEP} stroke={OUTLINE} strokeWidth={3.2} />
        </Part>
      </g>
      {/* 龙头（昂首朝前） */}
      <g>
        <ellipse cx={182} cy={136} rx={36} ry={30} fill={SCALE} stroke={OUTLINE} strokeWidth={6} />
        {/* 宽吻（朝前下） */}
        <path d="M200 142 Q212 148 208 160 Q196 168 182 162 Q178 150 186 144 Z" fill={BELLY} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        <g fill={DEEP}>
          <circle cx={200} cy={150} r={2.2} />
          <circle cx={196} cy={158} r={2.2} />
        </g>
        {/* 龙须（向后飘两根） */}
        <path d="M186 160 q-12 8 -24 6 M192 166 q-10 10 -22 10" fill="none" stroke={OUTLINE} strokeWidth={2.4} strokeLinecap="round" />
      </g>
      {/* 脸（侧脸） */}
      <g className="part-face">
        <ExpSideFace cx={182} cy={128} r={9} expression={expression} base={eyes} withMouth={false} />
        <ellipse cx={172} cy={146} rx={6.5} ry={4.5} fill="#F5A8C6" opacity={0.75} />
      </g>
      {/* 头顶：一角火一角冰（前后错落） */}
      <g transform={place(180, 108, 6)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="translate(-13 2)">
            <path d="M-4 2 L4 2 L1 -12 Q0 -14 -1 -12 Z" fill="#F5C9A5" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
            <path d="M0 -14 q-4 -4 -2 -9 q3 2 3 6 q2.5 -4 1 -7 q4.5 3 3.5 8 q-1 4 -5.5 2 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
          </g>
          <g transform="translate(11 0)">
            <path d="M-4 2 L4 2 L1 -12 Q0 -14 -1 -12 Z" fill="#F5C9A5" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
            <path d="M0 -20 L4 -13 L1 -6 L-3 -13 Z" fill={ICE} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
          </g>
        </Part>
      </g>
    </Part>
  );
}

/** 趴卧：在云垫上盘成圈，头枕在带火苗的尾尖上。 */
function Lie({ palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  return (
    <Part name="body" origin="50% 100%">
      {/* 云垫 */}
      <g fill="#FFFFFF" stroke={OUTLINE} strokeWidth={4.5}>
        <ellipse cx={100} cy={228} rx={26} ry={12} />
        <ellipse cx={156} cy={230} rx={30} ry={12} />
      </g>
      {/* 盘圈身（螺旋双描边） */}
      <path
        d="M76 208 Q72 176 108 168 Q152 160 172 184 Q184 202 166 216 Q146 228 122 220 Q106 214 110 200 Q114 188 132 190"
        fill="none"
        stroke={OUTLINE}
        strokeWidth={18}
        strokeLinecap="round"
      />
      <path
        d="M76 208 Q72 176 108 168 Q152 160 172 184 Q184 202 166 216 Q146 228 122 220 Q106 214 110 200 Q114 188 132 190"
        fill="none"
        stroke={SCALE}
        strokeWidth={12.5}
        strokeLinecap="round"
      />
      {/* 背鬃茸毛（外圈脊上） */}
      <g fill={VOLT} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round">
        <path d="M100 164 l-2 -7 l6 2 l0 -6 l6 4 l-4 5 z" />
        <path d="M148 162 l0 -7 l5 3 l2 -6 l4 6 l-6 4 z" />
      </g>
      {/* 腹甲纹 */}
      <g fill="none" stroke={BELLY} strokeWidth={3.4} strokeLinecap="round" opacity={0.95}>
        <path d="M84 200 q6 4 13 4" />
        <path d="M150 222 q8 -2 14 -7" />
      </g>
      {/* 尾（尾尖火苗，枕在头下） */}
      <g transform={place(136, 192)}>
        <Part name="tail" origin="0% 50%">
          <path d="M0 0 Q14 2 20 8" fill="none" stroke={OUTLINE} strokeWidth={14} strokeLinecap="round" />
          <path d="M0 0 Q14 2 20 8" fill="none" stroke={SCALE} strokeWidth={9.5} strokeLinecap="round" />
          <path d="M24 4 q-4 -4 -2 -9 q3 2.5 3 6 q2.5 -4 1 -7 q5 3 4 8.5 q-1 4.5 -6 1.5 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
        </Part>
      </g>
      {/* 龙爪（收在圈边） */}
      <g transform={place(92, 222, 20)}>
        <Part name="armL" origin="50% 8%">
          <path d="M0 0 Q-3 6 -7 8 M0 0 Q0 7 -1 9 M0 0 Q3 6 2 9" fill="none" stroke={DEEP} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      <g transform={place(184, 210, -18)}>
        <Part name="armR" origin="50% 8%">
          <path d="M0 0 Q-3 6 -7 8 M0 0 Q0 7 -1 9 M0 0 Q3 6 2 9" fill="none" stroke={SCALE} strokeWidth={4.5} strokeLinecap="round" />
        </Part>
      </g>
      {/* 云上小爪（腿位微露） */}
      <g transform={place(112, 231)}>
        <Part name="legL" origin="50% -40%">
          <ellipse cx={0} cy={0} rx={6.5} ry={4} fill={DEEP} stroke={OUTLINE} strokeWidth={3} />
        </Part>
      </g>
      <g transform={place(156, 232)}>
        <Part name="legR" origin="50% -40%">
          <ellipse cx={0} cy={0} rx={6.5} ry={4} fill={DEEP} stroke={OUTLINE} strokeWidth={3} />
        </Part>
      </g>
      {/* 龙头（枕在尾尖上） */}
      <g>
        <ellipse cx={152} cy={178} rx={33} ry={27} fill={SCALE} stroke={OUTLINE} strokeWidth={6} />
        <path d="M128 186 Q118 194 124 204 Q136 210 150 206 Q150 196 144 190 Z" fill={BELLY} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
        <g fill={DEEP}>
          <circle cx={131} cy={194} r={2} />
          <circle cx={138} cy={199} r={2} />
        </g>
        <path d="M126 190 q-10 2 -14 -2 M128 198 q-10 4 -15 1" fill="none" stroke={OUTLINE} strokeWidth={2.2} strokeLinecap="round" />
      </g>
      {/* 脸（睡） */}
      <g className="part-face">
        <ExpFace cx1={144} cx2={168} cy={172} r={8} mouthY={0} expression={expression} base={eyes} withMouth={false} />
        <Blush cx1={136} cx2={176} cy={186} />
      </g>
      {/* 头顶：火冰双角（横躺错落） */}
      <g transform={place(158, 152, -8)}>
        <Part name="headtop" origin="50% 100%">
          <g transform="translate(-11 2)">
            <path d="M-4 2 L4 2 L1 -11 Q0 -13 -1 -11 Z" fill="#F5C9A5" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
            <path d="M0 -13 q-4 -4 -2 -8 q3 2 3 5.5 q2.5 -3.5 1 -6.5 q4.5 3 3.5 7.5 q-1 4 -5.5 2 z" fill={FLAME} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
          </g>
          <g transform="translate(11 0)">
            <path d="M-4 2 L4 2 L1 -11 Q0 -13 -1 -11 Z" fill="#F5C9A5" stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
            <path d="M0 -18 L4 -12 L1 -5 L-3 -12 Z" fill={ICE} stroke={OUTLINE} strokeWidth={2.4} strokeLinejoin="round" />
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

// 天气主播的道具产物：地图冷锋箭头 + 折叠伞 + 预报卡（100% 加班概率）
const mapArrow: ParticleRenderer = () => (
  <path d="M-9 -7 L2 0 L-9 7 L-9 2 L-4 0 L-9 -2 Z" fill="#2E7BD6" stroke={OUTLINE} strokeWidth={2} strokeLinejoin="round" />
);
const umbrellaBit: ParticleRenderer = () => (
  <g stroke={OUTLINE} strokeLinejoin="round" strokeLinecap="round">
    <path d="M-9 0 Q-9 -9 0 -9 Q9 -9 9 0 Q5 -3 3 0 Q0 -3 -3 0 Q-5 -3 -9 0 Z" fill="#E2432E" strokeWidth={2.2} />
    <path d="M0 0 V7 Q0 10 3 10" fill="none" strokeWidth={2.2} />
  </g>
);
const forecastTag: ParticleRenderer = (rand) => {
  const g = ["100%", "☀", "⛈"][Math.floor(rand() * 3)];
  return (
    <g>
      <rect x={-13} y={-8} width={26} height={16} rx={4} fill={BELLY} stroke={OUTLINE} strokeWidth={2.4} />
      <text x={0} y={4} fontSize={9} fontWeight={900} textAnchor="middle" fill={OUTLINE} fontFamily="inherit">{g}</text>
    </g>
  );
};

export const PACK: SpeciesPack = {
  rig: Rig,
  visual: {
    scale: 1,
    palette: { body: SCALE, deep: DEEP, belly: BELLY, accent: FLAME, accent2: ICE },
    foodAnchor: { x: 132, y: 108 },
    shadowRx: 56,
  },
  // 气象云台仪：支架 + 云台球 + 天气指针
  tool: () => (
    <g>
      <path d="M-10 0 L0 -12 L10 0 M0 -12 V-4" stroke={OUTLINE} strokeWidth={3.2} strokeLinecap="round" fill="none" />
      <circle cx={0} cy={-24} r={12} fill="#EAF7FF" stroke={OUTLINE} strokeWidth={3.4} />
      <path d="M0 -24 L7 -30" stroke="#E2432E" strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={0} cy={-24} r={2} fill={OUTLINE} />
      <path d="M-8 -38 q3 -3 6 0 q3 3 6 0" fill="none" stroke={ICE} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M-6 -18 l-2 3 M6 -18 l2 3" stroke={VOLT} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  workFx: {
    emitter: { x: 196, y: 200 },
    baseAngle: -Math.PI / 2.3,
    cone: 0.65,
    shapes: [mapArrow, umbrellaBit, forecastTag],
  },
  meta: {
    nameZh: "风暴龙",
    elements: ["electric", "fire", "ice"],
    family: "蛇形爬行",
    toolAnchor: { x: 196, y: 228 },
    nodeBudget: 205,
    lieNote: "盘成三圈，头枕尾巴",
  },
};
