import { OUTLINE, type BodyPlan, type ChimeraForm, type RigPalette, type RigProps } from "../rigTypes";
import { Part } from "../parts/common";
import { ExpFace, ExpSideFace } from "../parts/faces";

// -----------------------------------------------------------------------------
// Chimera 底座（AI 融合专用"拼装身体"）。
//
// 目标：让融合结果拥有与 6 个动物 rig 完全不同的剪影，同时**零动画成本**——
// 身体由 ChimeraForm 参数搭建，但一切都塞进标准 <Part name="body/tail/
// headtop/armL/armR/legL/legR/cheeks/back/marking/platform"> + .part-face，
// 于是 sprites.css 的 14 个状态动画（呼吸/迈步/摆尾/庆祝/进食/睡眠…）自动生效。
//
// 三个构图（与动物 rig 同规格）：
//   front — 站立正面（主视图）
//   side  — 朝右侧面（moving 状态；左移由外层 CSS scaleX(-1) 翻转）
//   lie   — 躺倒睡姿（sleeping/exhausted）：身体段横向摊平成小土丘链、
//           头贴地、耳朵耷拉、小手摊在身前——不是把站姿压扁。
//
// 可爱底线（渲染层硬下限，与提示词规则配套）：perched 头有绝对最小半径、
// 眼睛有最小字号，保证任何参数组合下脸部都大而清晰。
// -----------------------------------------------------------------------------

const GROUND_Y = 233;
const CX = 128;

const DEFAULT_FORM: ChimeraForm = {
  bodyPlan: "stack",
  segments: 1,
  bodyW: 1,
  bodyH: 1,
  taper: 0.3,
  headStyle: "merged",
  headScale: 0.8,
  legStyle: "stub",
  legCount: 2,
  armStyle: "nub",
  earStyle: "round",
  floating: false,
};

const BODY_PLANS: BodyPlan[] = ["stack", "round", "upright", "quadruped", "long", "floaty", "bighead"];

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}

type Segment = { cy: number; rx: number; ry: number };
type Layout = {
  segments: Segment[];
  head: { cx: number; cy: number; rx: number; ry: number };
  headStyle: "merged" | "perched";
  legStyle: "none" | "stub" | "tall";
  legCount: 2 | 4;
  armStyle: "none" | "nub" | "wing" | "flipper";
  earStyle: "none" | "round" | "point" | "long" | "fin";
  W: number;
  bottomY: number;
  /** 绘制最高点（含头/耳/头顶留白）的 y——用于自适应缩放进画布。 */
  topExtent: number;
};

const EAR_ALLOW: Record<Layout["earStyle"], number> = { none: 0, round: 20, point: 38, long: 48, fin: 20 };
const HEADTOP_BUFFER = 16; // 头顶槽（冠/芽等）预留
/** perched 头球的绝对最小半径（脸要大而清晰——可爱底线） */
const MIN_PERCHED_HEAD_R = 26;

function normalizedForm(raw: ChimeraForm | undefined): ChimeraForm {
  const merged = { ...DEFAULT_FORM, ...(raw ?? {}) };
  if (!BODY_PLANS.includes(merged.bodyPlan)) merged.bodyPlan = "stack";
  return merged;
}

function computeLayout(raw: ChimeraForm | undefined): Layout {
  const form = normalizedForm(raw);
  const segCount = (clamp(Math.round(form.segments), 1, 3) || 1) as 1 | 2 | 3;
  const bodyW = clamp(form.bodyW, 0.75, 1.3);
  const bodyH = clamp(form.bodyH, 0.75, 1.35);
  const taper = clamp(form.taper, 0, 1);
  const legStyle = form.legStyle;
  const legAllow = legStyle === "tall" ? 22 : legStyle === "stub" ? 9 : 2;

  const W = 104 * bodyW;
  const bottomY = GROUND_Y - legAllow;
  const perched = form.headStyle === "perched";
  const minTop = 36 + (perched ? 24 : 0);
  let H = 132 * bodyH;
  if (bottomY - H < minTop) H = bottomY - minTop;

  const overlap = 0.34;
  const segH = H / (1 + (segCount - 1) * (1 - overlap));
  const segRy = segH * (segCount === 1 ? 0.5 : 0.56);

  const segments: Segment[] = [];
  for (let i = 0; i < segCount; i += 1) {
    const cy = bottomY - segH * 0.5 - i * segH * (1 - overlap);
    const t = segCount === 1 ? 0 : i / (segCount - 1);
    const rx = (W / 2) * (1 - taper * 0.45 * t);
    segments.push({ cy, rx, ry: segRy });
  }

  const top = segments[segCount - 1];
  let head: Layout["head"];
  if (perched) {
    // 可爱底线：头球不许小于 MIN_PERCHED_HEAD_R（脸随头走）
    const r = Math.max(clamp(form.headScale, 0.5, 1) * top.rx, MIN_PERCHED_HEAD_R);
    head = { cx: CX, cy: top.cy - top.ry - r * 0.55, rx: r, ry: r };
  } else {
    head = { cx: CX, cy: top.cy - top.ry * 0.12, rx: top.rx, ry: top.ry };
  }

  const earStyle = form.earStyle;
  const earTop = head.cy - head.ry * 0.5 - EAR_ALLOW[earStyle];
  const topExtent = Math.min(head.cy - head.ry, earTop, top.cy - top.ry) - HEADTOP_BUFFER;

  return {
    segments,
    head,
    headStyle: form.headStyle,
    legStyle,
    legCount: (form.legCount === 4 ? 4 : 2) as 2 | 4,
    armStyle: form.armStyle,
    earStyle,
    W,
    bottomY,
    topExtent,
  };
}

/** 按 form 算一个"整体贴回画布内"的缩放（≤1，绕地面收缩顶部）。
 *  由 buildVisualFromSpec 作为 SpeciesVisual.scale 使用，替代动物 rig 的固定放大。 */
export function chimeraFitScale(form: ChimeraForm | undefined): number {
  const plan = normalizedForm(form).bodyPlan;
  const topExtent =
    plan === "stack" ? computeLayout(form).topExtent : computeAnimalLayout(form, "front").topExtent;
  const targetTop = 14;
  if (topExtent >= targetTop) return 1;
  return clamp((GROUND_Y - targetTop) / (GROUND_Y - topExtent), 0.6, 1);
}

/** 打工特效的发射点（≈工具锚点；WorkBurst 自定义物种通道用）。 */
export function chimeraFxEmitter(form: ChimeraForm | undefined): { x: number; y: number } {
  const plan = normalizedForm(form).bodyPlan;
  const W = plan === "stack" ? computeLayout(form).W : computeAnimalLayout(form, "front").W;
  return { x: Math.round(CX + W * 0.5 + 10), y: 206 };
}

/** 眼睛尺寸：随头走 + 绝对下限（可爱底线：表情必须一眼可读）。 */
function eyeRadiusFor(head: Layout["head"]): number {
  return clamp(Math.min(head.rx, head.ry) * 0.22, 8, 13);
}

function Ear({ side, style, palette }: { side: -1 | 1; style: Layout["earStyle"]; palette: RigPalette }) {
  if (style === "none") return null;
  const inner = palette.belly;
  if (style === "round") {
    return (
      <g>
        <circle cx={0} cy={0} r={16} fill={palette.body} stroke={OUTLINE} strokeWidth={5} />
        <circle cx={0} cy={0} r={8} fill={inner} />
      </g>
    );
  }
  if (style === "point") {
    return (
      <g transform={`scale(${side} 1)`}>
        <path d="M-2 10 C-6 -8 -12 -22 -22 -34 C-26 -20 -26 -2 -20 12 Z" fill={palette.body} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
        <path d="M-6 6 C-9 -6 -13 -15 -18 -23 C-20 -13 -20 -3 -17 8 Z" fill={inner} />
      </g>
    );
  }
  if (style === "long") {
    return (
      <g transform={`scale(${side} 1)`}>
        <path d="M0 -6 q-14 6 -16 30 q-1 12 8 15 q9 -2 9 -16 q0 -18 -1 -29 z" fill={palette.body} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
        <path d="M-2 2 q-8 6 -9 22 q0 7 5 9 q5 -1 5 -10 z" fill={inner} />
      </g>
    );
  }
  // fin：背鳍状小扇（贴头顶两侧向上）
  return (
    <g transform={`scale(${side} 1)`}>
      <path d="M0 8 C-4 -6 -14 -14 -24 -16 C-18 -4 -16 4 -14 12 Z" fill={palette.accent ?? palette.body} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
    </g>
  );
}

function Arm({ style, palette }: { style: Layout["armStyle"]; palette: RigPalette }) {
  if (style === "none") return null;
  if (style === "wing") {
    return (
      <path d="M0 -2 q18 2 24 18 q3 9 -1 16 l-6 -6 l-2 8 l-6 -5 l-2 7 q-9 -6 -10 -20 q-1 -14 3 -26 z" fill={palette.accent2 ?? palette.belly} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
    );
  }
  if (style === "flipper") {
    return (
      <path d="M0 0 q16 -3 24 8 q6 10 -2 20 q-10 6 -18 -3 q-6 -10 -4 -25 z" fill={palette.body} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
    );
  }
  // nub 小圆手
  return <ellipse cx={0} cy={11} rx={8.5} ry={13} fill={palette.body} stroke={OUTLINE} strokeWidth={5} />;
}

function Leg({ style, palette, mirror = false }: { style: Layout["legStyle"]; palette: RigPalette; mirror?: boolean }) {
  if (style === "none") return null;
  const s = mirror ? -1 : 1;
  if (style === "tall") {
    return (
      <g>
        <path d={`M0 -14 q${s * 1} 8 0 14`} stroke={palette.deep} strokeWidth={8} strokeLinecap="round" fill="none" />
        <ellipse cx={0} cy={2} rx={10} ry={5.5} fill={palette.deep} stroke={OUTLINE} strokeWidth={4} />
      </g>
    );
  }
  // stub 短墩
  return <ellipse cx={0} cy={0} rx={10} ry={6} fill={palette.deep} stroke={OUTLINE} strokeWidth={4.5} />;
}

// ---------------------------------------------------------------------------
// 正面（站立主视图）
// ---------------------------------------------------------------------------

function ChimeraFront(props: RigProps) {
  const { palette, slots = {}, eyes = "round", expression = "normal" } = props;
  const L = computeLayout(props.form);
  const top = L.segments[L.segments.length - 1];
  const bottom = L.segments[0];
  const midSeg = L.segments[Math.floor((L.segments.length - 1) / 2)];

  const eyeR = eyeRadiusFor(L.head);
  const eyeDx = L.head.rx * 0.42;
  const eyeY = L.head.cy - L.head.ry * 0.05;
  const mouthY = L.head.cy + L.head.ry * 0.34;
  const armY = top.cy + top.ry * 0.15;
  const armDx = top.rx + 2;
  const legDx = L.W * 0.24;
  const earDx = L.head.rx * 0.62;
  const earY = L.head.cy - L.head.ry * 0.5;

  return (
    <Part name="body" origin="50% 100%">
      {/* 背部槽（披风/浪冠等，画在身体后面） */}
      {slots.back && (
        <g transform={`translate(${CX} ${top.cy - 4})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 尾巴槽（从下段后方伸出；无槽则不画） */}
      {slots.tail && (
        <g transform={`translate(${CX - bottom.rx * 0.7} ${bottom.cy}) rotate(-26)`}>
          <Part name="tail" origin="80% 100%">{slots.tail}</Part>
        </g>
      )}
      {/* 内建耳（画在头后面，头轮廓压住耳根） */}
      {L.earStyle !== "none" && (
        <>
          <g transform={`translate(${CX - earDx} ${earY})`}>
            <Ear side={-1} style={L.earStyle} palette={palette} />
          </g>
          <g transform={`translate(${CX + earDx} ${earY}) scale(-1 1)`}>
            <Ear side={-1} style={L.earStyle} palette={palette} />
          </g>
        </>
      )}
      {/* 身体体块（自下而上；下段先画在后，上段压住重叠处） */}
      {L.segments.map((seg, i) => (
        <ellipse
          key={i}
          cx={CX}
          cy={seg.cy}
          rx={seg.rx}
          ry={seg.ry}
          fill={palette.body}
          stroke={OUTLINE}
          strokeWidth={6}
        />
      ))}
      {/* 肚皮 / marking 槽（画在中段正面） */}
      {slots.marking ? (
        <g transform={`translate(${CX} ${midSeg.cy + midSeg.ry * 0.25})`}>{slots.marking}</g>
      ) : (
        <ellipse cx={CX} cy={bottom.cy + bottom.ry * 0.18} rx={bottom.rx * 0.62} ry={bottom.ry * 0.5} fill={palette.belly} opacity={0.85} />
      )}
      {/* 腿（在身体前一层，从底段下缘伸出） */}
      {L.legStyle !== "none" && (
        <>
          {L.legCount === 4 && (
            <>
              <g transform={`translate(${CX - legDx * 0.45} ${L.bottomY + (L.legStyle === "tall" ? 2 : 4)})`} opacity={0.92}>
                <Leg style={L.legStyle} palette={palette} />
              </g>
              <g transform={`translate(${CX + legDx * 0.45} ${L.bottomY + (L.legStyle === "tall" ? 2 : 4)})`} opacity={0.92}>
                <Leg style={L.legStyle} palette={palette} mirror />
              </g>
            </>
          )}
          <g transform={`translate(${CX - legDx} ${L.bottomY + (L.legStyle === "tall" ? 2 : 4)})`}>
            <Part name="legL" origin="50% -40%"><Leg style={L.legStyle} palette={palette} /></Part>
          </g>
          <g transform={`translate(${CX + legDx} ${L.bottomY + (L.legStyle === "tall" ? 2 : 4)})`}>
            <Part name="legR" origin="50% -40%"><Leg style={L.legStyle} palette={palette} mirror /></Part>
          </g>
        </>
      )}
      {/* 手（身体上段两侧） */}
      {L.armStyle !== "none" && (
        <>
          <g transform={`translate(${CX - armDx} ${armY}) rotate(14)`}>
            <Part name="armL" origin="50% 6%"><Arm style={L.armStyle} palette={palette} /></Part>
          </g>
          <g transform={`translate(${CX + armDx} ${armY}) rotate(-14) scale(-1 1)`}>
            <Part name="armR" origin="50% 6%"><Arm style={L.armStyle} palette={palette} /></Part>
          </g>
        </>
      )}
      {/* perched 头球（merged 时头即顶段，已画） */}
      {L.headStyle === "perched" && (
        <circle cx={L.head.cx} cy={L.head.cy} r={L.head.rx} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      )}
      {/* 脸（表情库通用眼+嘴 + 可选腮红槽） */}
      <g className="part-face">
        <ExpFace
          cx1={L.head.cx - eyeDx}
          cx2={L.head.cx + eyeDx}
          cy={eyeY}
          r={eyeR}
          mouthY={mouthY}
          mouthW={eyeR * 2.4}
          expression={expression}
          base={eyes}
        />
        {slots.cheeks && (
          <g transform={`translate(${L.head.cx} ${eyeY + eyeR * 1.6})`}>
            <Part name="cheeks" origin="50% 50%">{slots.cheeks}</Part>
          </g>
        )}
      </g>
      {/* 头顶槽（冠/芽/呆毛等，落在头顶上方） */}
      {slots.headTop && (
        <g transform={`translate(${L.head.cx} ${L.head.cy - L.head.ry + 2})`}>
          <Part name="headtop" origin="50% 100%">{slots.headTop}</Part>
        </g>
      )}
      {/* 座台槽（浮冰等，脚下） */}
      {slots.platform && (
        <g transform={`translate(${CX} ${GROUND_Y - 2})`}>
          <Part name="platform" origin="50% 0%">{slots.platform}</Part>
        </g>
      )}
      {/* 工具（工作状态淡入，画在右侧脚边） */}
      {slots.tool && (
        <g transform={`translate(${CX + L.W * 0.5 + 8} ${GROUND_Y})`}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

// ---------------------------------------------------------------------------
// 侧面（moving；朝右构图，左移由外层 CSS scaleX(-1) 翻转）
// ---------------------------------------------------------------------------

function ChimeraSide(props: RigProps) {
  const { palette, slots = {}, eyes = "round", expression = "normal" } = props;
  const L = computeLayout(props.form);
  const top = L.segments[L.segments.length - 1];
  const bottom = L.segments[0];

  const eyeR = eyeRadiusFor(L.head);
  const eyeCx = L.head.cx + L.head.rx * 0.42;
  const eyeCy = L.head.cy - L.head.ry * 0.08;
  const mouthX = L.head.cx + L.head.rx * 0.58;
  const mouthY = L.head.cy + L.head.ry * 0.28;
  const legDx = L.W * 0.22;

  return (
    <Part name="body" origin="50% 100%">
      {/* 尾巴槽：身后（左侧）探出，明显参与剪影 */}
      {slots.tail && (
        <g transform={`translate(${CX - bottom.rx * 0.9} ${bottom.cy - bottom.ry * 0.1}) rotate(-30)`}>
          <Part name="tail" origin="80% 100%">{slots.tail}</Part>
        </g>
      )}
      {/* 背部槽：贴颈后（偏左） */}
      {slots.back && (
        <g transform={`translate(${CX - top.rx * 0.35} ${top.cy - top.ry * 0.4})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 单耳（偏后上，头轮廓压住耳根） */}
      {L.earStyle !== "none" && (
        <g transform={`translate(${L.head.cx - L.head.rx * 0.25} ${L.head.cy - L.head.ry * 0.55})`}>
          <Ear side={-1} style={L.earStyle} palette={palette} />
        </g>
      )}
      {/* 身体体块（与正面同构；侧面读感靠脸的朝向 + 前肢在前） */}
      {L.segments.map((seg, i) => (
        <ellipse key={i} cx={CX} cy={seg.cy} rx={seg.rx} ry={seg.ry} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      ))}
      {/* 肚皮补丁（前下方，朝行进方向偏移） */}
      <ellipse
        cx={CX + bottom.rx * 0.22}
        cy={bottom.cy + bottom.ry * 0.22}
        rx={bottom.rx * 0.5}
        ry={bottom.ry * 0.42}
        fill={palette.belly}
        opacity={0.85}
      />
      {/* 腿（左右脚交替迈步：rig-stride 作用在 part-legL/R） */}
      {L.legStyle !== "none" && (
        <>
          <g transform={`translate(${CX - legDx} ${L.bottomY + (L.legStyle === "tall" ? 2 : 4)})`}>
            <Part name="legL" origin={L.legStyle === "tall" ? "50% -35%" : "50% -160%"}>
              <Leg style={L.legStyle} palette={palette} />
            </Part>
          </g>
          <g transform={`translate(${CX + legDx} ${L.bottomY + (L.legStyle === "tall" ? 2 : 4)})`}>
            <Part name="legR" origin={L.legStyle === "tall" ? "50% -35%" : "50% -160%"}>
              <Leg style={L.legStyle} palette={palette} mirror />
            </Part>
          </g>
        </>
      )}
      {/* 前侧单手（moving 时 rig-paddle/arm-swing 摆动） */}
      {L.armStyle !== "none" && (
        <g transform={`translate(${CX + top.rx * 0.62} ${top.cy + top.ry * 0.1}) rotate(-18)`}>
          <Part name="armR" origin="50% 6%"><Arm style={L.armStyle} palette={palette} /></Part>
        </g>
      )}
      {/* perched 头球 */}
      {L.headStyle === "perched" && (
        <circle cx={L.head.cx} cy={L.head.cy} r={L.head.rx} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      )}
      {/* 侧脸：单眼 + 前伸小嘴（朝右） */}
      <g className="part-face">
        <ExpSideFace
          cx={eyeCx}
          cy={eyeCy}
          r={eyeR}
          mouthX={mouthX}
          mouthY={mouthY}
          mouthW={eyeR * 1.7}
          expression={expression}
          base={eyes}
        />
      </g>
      {/* 头顶槽（略前倾，行进感） */}
      {slots.headTop && (
        <g transform={`translate(${L.head.cx + L.head.rx * 0.1} ${L.head.cy - L.head.ry + 2}) rotate(6)`}>
          <Part name="headtop" origin="50% 100%">{slots.headTop}</Part>
        </g>
      )}
      {slots.platform && (
        <g transform={`translate(${CX} ${GROUND_Y - 2})`}>
          <Part name="platform" origin="50% 0%">{slots.platform}</Part>
        </g>
      )}
    </Part>
  );
}

// ---------------------------------------------------------------------------
// 躺倒睡姿（sleeping/exhausted）——身体段横向摊平成小土丘链，头贴地在右端，
// 耳朵向两侧耷拉、小手摊在身前、脚尖从身后露出一点。不是压扁站姿。
// ---------------------------------------------------------------------------

function ChimeraLie(props: RigProps) {
  const { palette, slots = {}, eyes = "round", expression = "sleep" } = props;
  const form = normalizedForm(props.form);
  const segCount = (clamp(Math.round(form.segments), 1, 3) || 1) as 1 | 2 | 3;
  const bodyW = clamp(form.bodyW, 0.75, 1.3);
  const bodyH = clamp(form.bodyH, 0.75, 1.35);
  const perched = form.headStyle === "perched";

  // 土丘链几何：头在右端（贴地圆），身体段向左依次排开（40% 重叠）
  const moundRx = clamp(46 * bodyW * (segCount === 1 ? 1.15 : 0.92), 30, 56);
  const moundRy = clamp(26 * bodyH, 19, 30);
  const step = moundRx * 1.1;
  const headR = perched
    ? Math.max(clamp(form.headScale, 0.5, 1) * moundRx, MIN_PERCHED_HEAD_R)
    : moundRx * 1.06;
  const headRy = headR * 0.84;

  // 链条总宽（头 + 后续段），夹取后整体居中
  let chain = headR * 2 + (segCount - (perched ? 0 : 1)) * step;
  const fit = Math.min(1, 196 / chain);
  const mRx = moundRx * fit;
  const mRy = Math.max(moundRy * fit, 17);
  const hR = Math.max(headR * fit, 24);
  const hRy = hR * 0.84;
  const stepF = step * fit;
  chain *= fit;

  const groundLie = GROUND_Y - 3;
  const rightX = CX + chain / 2;
  const headCx = rightX - hR;
  const headCy = groundLie - hRy;
  // 身体段圆心：merged 首段即头（跳过 i=0），perched 则全部为身体
  const moundXs: number[] = [];
  const bodyCount = perched ? segCount : Math.max(segCount - 1, 0);
  for (let i = 0; i < bodyCount; i += 1) {
    moundXs.push(headCx - hR * 0.72 - (i + 0.5) * stepF);
  }

  const eyeR = clamp(Math.min(hR, hRy) * 0.24, 8, 12);
  const eyeDx = hR * 0.4;
  const eyeY = headCy - hRy * 0.02;
  const mouthY = headCy + hRy * 0.36;
  const tailX = moundXs.length > 0 ? moundXs[moundXs.length - 1] - mRx * 0.6 : headCx - hR * 0.9;

  return (
    <Part name="body" origin="50% 100%">
      {/* 尾巴槽：放平软软拖在身后地上 */}
      {slots.tail && (
        <g transform={`translate(${tailX} ${groundLie - 6}) rotate(-64)`}>
          <Part name="tail" origin="80% 100%">{slots.tail}</Part>
        </g>
      )}
      {/* 背部槽：摊在身后地上（横向放宽贴地） */}
      {slots.back && (
        <g transform={`translate(${moundXs[0] ?? headCx} ${groundLie - mRy * 1.4}) scale(1.25 0.8)`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 脚尖从身体左端后方露出一点 */}
      {form.legStyle !== "none" && (
        <>
          <g transform={`translate(${tailX + mRx * 0.3} ${groundLie - 4}) rotate(-12)`}>
            <Part name="legL" origin="50% 50%">
              <ellipse cx={0} cy={0} rx={8.5} ry={5} fill={palette.deep} stroke={OUTLINE} strokeWidth={4} />
            </Part>
          </g>
          <g transform={`translate(${tailX + mRx * 0.62} ${groundLie - 2}) rotate(10)`}>
            <Part name="legR" origin="50% 50%">
              <ellipse cx={0} cy={0} rx={8.5} ry={5} fill={palette.deep} stroke={OUTLINE} strokeWidth={4} />
            </Part>
          </g>
        </>
      )}
      {/* 身体土丘链（从远到近画，靠头一段压住后段） */}
      {[...moundXs].reverse().map((x, i) => (
        <ellipse key={i} cx={x} cy={groundLie - mRy} rx={mRx} ry={mRy} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      ))}
      {/* 耳朵向两侧耷拉（头轮廓压住耳根） */}
      {form.earStyle !== "none" && (
        <>
          <g transform={`translate(${headCx - hR * 0.58} ${headCy - hRy * 0.28}) rotate(-38) scale(1 0.84)`}>
            <Ear side={-1} style={form.earStyle} palette={palette} />
          </g>
          <g transform={`translate(${headCx + hR * 0.58} ${headCy - hRy * 0.28}) rotate(38) scale(-1 0.84)`}>
            <Ear side={-1} style={form.earStyle} palette={palette} />
          </g>
        </>
      )}
      {/* 贴地的头（微扁圆，脸朝观众） */}
      <ellipse cx={headCx} cy={headCy} rx={hR} ry={hRy} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      {/* 小手向前摊平在地（睡姿标配的软化细节） */}
      {form.armStyle !== "none" && (
        <>
          <g transform={`translate(${headCx - hR * 0.66} ${groundLie - 5}) rotate(-16)`}>
            <Part name="armL" origin="80% 50%">
              <ellipse cx={0} cy={0} rx={11.5} ry={6} fill={palette.body} stroke={OUTLINE} strokeWidth={5} />
            </Part>
          </g>
          <g transform={`translate(${headCx + hR * 0.66} ${groundLie - 5}) rotate(16)`}>
            <Part name="armR" origin="20% 50%">
              <ellipse cx={0} cy={0} rx={11.5} ry={6} fill={palette.body} stroke={OUTLINE} strokeWidth={5} />
            </Part>
          </g>
        </>
      )}
      {/* 闭眼睡脸（朝观众） */}
      <g className="part-face">
        <ExpFace
          cx1={headCx - eyeDx}
          cx2={headCx + eyeDx}
          cy={eyeY}
          r={eyeR}
          mouthY={mouthY}
          mouthW={eyeR * 2}
          expression={expression}
          base={eyes}
        />
      </g>
      {/* 头顶槽（贴着躺平的头顶） */}
      {slots.headTop && (
        <g transform={`translate(${headCx} ${headCy - hRy + 2}) rotate(-8)`}>
          <Part name="headtop" origin="50% 100%">{slots.headTop}</Part>
        </g>
      )}
      {/* 座台槽（浮冰等：画在最前，边缘压住身体底缘=趴在座台上） */}
      {slots.platform && (
        <g transform={`translate(${CX} ${GROUND_Y - 2})`}>
          <Part name="platform" origin="50% 0%">{slots.platform}</Part>
        </g>
      )}
    </Part>
  );
}

// ===========================================================================
// 动物体型原型（bodyPlan）—— AI 融合"剪影多样化"的核心。
// 六种一眼可辨、各自像某类动物的骨架，全部仍包进标准 <Part>，于是
// sprites.css 的 14 态动画（呼吸/迈步/摆尾/庆祝/进食/睡眠…）零成本继承：
//   round     圆团崽：大圆身 + 大圆头（雏鸟/兔/仓鼠/团子）
//   upright   直立崽：竖立梨形身 + 肚皮补丁 + 并脚（企鹅/小鸭/熊崽）
//   quadruped 四足兽：横向身体 + 四腿 + 前上方大头（猫/狐/鹿/鼠）
//   long      长条崽：贴地长身 + 分节小丘 + 一端是头（毛虫/水獭/壁虎）
//   floaty    漂浮崽：离地圆身 + 侧鳍/小翅、无腿（鲸/水母/幽灵）
//   bighead   大头崽：巨头压小身（蝌蚪/Q 版大头）
// computeAnimalLayout 按 plan 算出 blobs（身体椭圆，后→前）+ head + 各锚点；
// AnimalBody 通用绘制 front/side；睡姿沿用 ChimeraLie 的蜷卧团子（体型无关）。
// ===========================================================================

type Blob = { cx: number; cy: number; rx: number; ry: number };
type Anchor = { x: number; y: number; rot?: number; mirror?: boolean };

type AnimalLayout = {
  view: "front" | "side";
  blobs: Blob[];
  head: { cx: number; cy: number; r: number };
  /** true=头即身体顶部（漂浮/团状），不额外画头球，脸画在 blob 上 */
  mergedHead: boolean;
  belly: Blob | null;
  /** 前 2 个走 legL/legR（迈步动画），其余静态（四足内侧腿） */
  legs: Anchor[];
  arms: Anchor[];
  ears: Anchor[];
  tail: Anchor | null;
  headTop: { x: number; y: number };
  marking: { x: number; y: number };
  cheeksY: number;
  legStyle: "none" | "stub" | "tall";
  armStyle: "none" | "nub" | "wing" | "flipper";
  earStyle: "none" | "round" | "point" | "long" | "fin";
  W: number;
  topExtent: number;
};

function computeAnimalLayout(raw: ChimeraForm | undefined, view: "front" | "side"): AnimalLayout {
  const form = normalizedForm(raw);
  const plan: BodyPlan = form.bodyPlan === "stack" ? "round" : form.bodyPlan;
  const bw = clamp(form.bodyW, 0.75, 1.3);
  const bh = clamp(form.bodyH, 0.75, 1.35);
  const legStyle: AnimalLayout["legStyle"] = plan === "floaty" ? "none" : form.legStyle;
  const armStyle = form.armStyle;
  const earStyle = form.earStyle;
  const side = view === "side";
  const legAllow = legStyle === "tall" ? 22 : legStyle === "stub" ? 10 : 3;
  const bottomY = GROUND_Y - legAllow;

  let blobs: Blob[] = [];
  let head = { cx: CX, cy: 120, r: 40 };
  let mergedHead = false;
  let belly: Blob | null = null;
  let legs: Anchor[] = [];
  let arms: Anchor[] = [];
  let ears: Anchor[] = [];
  let tail: Anchor | null = null;
  let W = 100 * bw;

  switch (plan) {
    case "upright": {
      const rx = 40 * bw;
      const ry = 66 * bh;
      const cy = bottomY - ry;
      // 梨形躯干：下腹宽 + 上胸窄（企鹅/小鸭直立剪影），比单椭圆更"站得住"。
      blobs = [
        { cx: CX, cy: cy + ry * 0.24, rx: rx * 1.08, ry: ry * 0.64 },
        { cx: CX, cy: cy - ry * 0.34, rx: rx * 0.8, ry: ry * 0.5 },
      ];
      head = { cx: CX, cy: cy - ry * 0.66, r: Math.max(35 * bw, 26) };
      belly = { cx: CX, cy: cy + ry * 0.26, rx: rx * 0.66, ry: ry * 0.5 };
      W = rx * 1.08;
      const footDx = 13 * bw;
      if (legStyle !== "none") legs = [{ x: CX - footDx, y: bottomY }, { x: CX + footDx, y: bottomY, mirror: true }];
      arms = side
        ? [{ x: CX + rx + 1, y: cy - ry * 0.08, rot: -12, mirror: true }]
        : [
            { x: CX - rx - 1, y: cy - ry * 0.06, rot: 12 },
            { x: CX + rx + 1, y: cy - ry * 0.06, rot: -12, mirror: true },
          ];
      tail = { x: CX - rx * 0.82, y: cy + ry * 0.3, rot: -22 };
      break;
    }
    case "quadruped": {
      const ry = 30 * bh;
      const lift = legStyle === "tall" ? 20 : 12;
      if (side) {
        const rx = 56 * bw;
        const cy = bottomY - ry - lift;
        blobs = [{ cx: CX, cy, rx, ry }];
        head = { cx: CX + rx * 0.64, cy: cy - ry * 0.55, r: Math.max(40 * bw, 28) };
        belly = { cx: CX + rx * 0.12, cy: cy + ry * 0.3, rx: rx * 0.44, ry: ry * 0.4 };
        W = rx;
        legs = [{ x: CX + rx * 0.5, y: bottomY, mirror: true }, { x: CX - rx * 0.5, y: bottomY }];
        tail = { x: CX - rx * 0.95, y: cy - ry * 0.1, rot: -48 };
      } else {
        const rx = 50 * bw;
        const cy = bottomY - ry - lift;
        blobs = [{ cx: CX, cy, rx, ry }];
        head = { cx: CX, cy: cy - ry * 0.66, r: Math.max(44 * bw, 30) };
        belly = { cx: CX, cy: cy + ry * 0.22, rx: rx * 0.5, ry: ry * 0.5 };
        W = rx;
        const lo = rx * 0.64;
        const li = rx * 0.26;
        legs = [
          { x: CX - lo, y: bottomY },
          { x: CX + lo, y: bottomY, mirror: true },
          { x: CX - li, y: bottomY },
          { x: CX + li, y: bottomY, mirror: true },
        ];
        tail = { x: CX - rx * 0.9, y: cy - ry * 0.15, rot: -46 };
      }
      break;
    }
    case "long": {
      const bumps = (clamp(Math.round(form.segments), 2, 3) || 2) as 2 | 3;
      const rx = 32 * bw;
      const ry = 24 * bh;
      const groundLong = GROUND_Y - 2;
      const cy = groundLong - ry;
      head = { cx: CX + rx * 0.85, cy: cy - ry * 0.4, r: Math.max(32 * bw, 24) };
      const list: Blob[] = [];
      for (let i = 0; i < bumps; i += 1) {
        const x = head.cx - (i + 1) * rx * 1.15;
        list.push({ cx: x, cy: cy + (i % 2 === 0 ? -1 : 3), rx, ry: ry * (1 - i * 0.06) });
      }
      // 整条毛虫头右尾左、天然偏心：把水平中点移回 CX，宽体型也不出画布左缘。
      const leftMost = list[list.length - 1].cx - rx * 1.7; // 含尾根
      const rightMost = head.cx + head.r;
      const shift = CX - (leftMost + rightMost) / 2;
      head.cx += shift;
      for (const b of list) b.cx += shift;
      blobs = list.reverse(); // 远端（左）先画，靠头的一节压在最前
      W = (bumps + 1) * rx;
      if (legStyle !== "none") {
        legs = [
          { x: head.cx - rx * 0.5, y: groundLong, mirror: true },
          { x: blobs[0].cx + rx * 0.3, y: groundLong },
        ];
      }
      tail = { x: blobs[0].cx - rx * 0.7, y: cy, rot: -28 };
      break;
    }
    case "floaty": {
      const rx = 52 * bw;
      const ry = 44 * bh;
      const cy = 150 - (bh - 1) * 10;
      blobs = [{ cx: CX, cy, rx, ry }];
      mergedHead = true;
      head = { cx: CX, cy: cy - ry * 0.16, r: rx * 0.82 };
      belly = { cx: CX, cy: cy + ry * 0.32, rx: rx * 0.52, ry: ry * 0.36 };
      W = rx;
      arms = side
        ? [{ x: CX + rx * 0.86, y: cy + ry * 0.12, rot: -10, mirror: true }]
        : [
            { x: CX - rx * 0.9, y: cy + ry * 0.12, rot: 20 },
            { x: CX + rx * 0.9, y: cy + ry * 0.12, rot: -20, mirror: true },
          ];
      tail = { x: CX - rx * 0.5, y: cy + ry * 0.85, rot: -52 };
      break;
    }
    case "bighead": {
      const bodyRx = 30 * bw;
      const bodyRy = 22 * bh;
      const bodyCy = bottomY - bodyRy;
      const R = Math.max(58 * bw, 42);
      blobs = [{ cx: CX, cy: bodyCy, rx: bodyRx, ry: bodyRy }];
      // 头坐在小身体正上方、只轻微交叠 → 巨头 + 露出的小肚 = 蝌蚪/Q 版剪影。
      head = { cx: CX, cy: bodyCy - bodyRy - R + 15, r: R };
      belly = { cx: CX, cy: bodyCy + bodyRy * 0.12, rx: bodyRx * 0.62, ry: bodyRy * 0.55 };
      W = R;
      const footDx = bodyRx * 0.62;
      if (legStyle !== "none") legs = [{ x: CX - footDx, y: bottomY }, { x: CX + footDx, y: bottomY, mirror: true }];
      // 小手贴在露出的小身体两侧（凸显"大头小身"的萌感）
      arms = side
        ? [{ x: CX + bodyRx + 1, y: bodyCy - bodyRy * 0.05, rot: -14, mirror: true }]
        : [
            { x: CX - bodyRx - 1, y: bodyCy - bodyRy * 0.05, rot: 14 },
            { x: CX + bodyRx + 1, y: bodyCy - bodyRy * 0.05, rot: -14, mirror: true },
          ];
      tail = { x: CX - bodyRx * 0.9, y: bodyCy, rot: -26 };
      break;
    }
    case "round":
    default: {
      const rx = 58 * bw;
      const ry = 52 * bh;
      const cy = bottomY - ry;
      blobs = [{ cx: CX, cy, rx, ry }];
      head = { cx: CX, cy: cy - ry * 0.64, r: Math.max(42 * bw, 30) };
      belly = { cx: CX, cy: cy + ry * 0.26, rx: rx * 0.5, ry: ry * 0.42 };
      W = rx;
      if (legStyle !== "none") legs = [{ x: CX - rx * 0.4, y: bottomY }, { x: CX + rx * 0.4, y: bottomY, mirror: true }];
      arms = side
        ? [{ x: CX + rx * 0.86, y: cy - ry * 0.02, rot: -16, mirror: true }]
        : [
            { x: CX - rx - 1, y: cy - ry * 0.02, rot: 16 },
            { x: CX + rx + 1, y: cy - ry * 0.02, rot: -16, mirror: true },
          ];
      tail = { x: CX - rx * 0.72, y: cy + ry * 0.18, rot: -28 };
      break;
    }
  }

  if (armStyle === "none") arms = [];

  if (earStyle !== "none") {
    const ey = head.cy - head.r * 0.45;
    ears = side
      ? [{ x: head.cx - head.r * 0.15, y: ey }]
      : [
          { x: head.cx - head.r * 0.6, y: ey },
          { x: head.cx + head.r * 0.6, y: ey, mirror: true },
        ];
  }

  const headTop = { x: head.cx, y: head.cy - head.r + 2 };
  const mainBlob = blobs[blobs.length - 1] ?? { cx: CX, cy: 170, rx: 40, ry: 30 };
  const marking = { x: mainBlob.cx, y: mainBlob.cy + mainBlob.ry * 0.1 };
  const cheeksY = head.cy + head.r * 0.28;

  const earTopY = ears.length ? Math.min(...ears.map((e) => e.y - EAR_ALLOW[earStyle])) : Infinity;
  const blobTop = Math.min(...blobs.map((b) => b.cy - b.ry));
  const topExtent = Math.min(head.cy - head.r, earTopY, blobTop) - HEADTOP_BUFFER;

  return {
    view,
    blobs,
    head,
    mergedHead,
    belly,
    legs,
    arms,
    ears,
    tail,
    headTop,
    marking,
    cheeksY,
    legStyle,
    armStyle,
    earStyle,
    W,
    topExtent,
  };
}

/** 六种动物体型的通用绘制（front/side 共用；layer 序同动物 rig）。 */
function AnimalBody(props: RigProps, L: AnimalLayout) {
  const { palette, slots = {}, eyes = "round", expression = "normal" } = props;
  const side = L.view === "side";
  const { head } = L;
  const eyeR = clamp(head.r * 0.22, 8, 13);

  return (
    <Part name="body" origin="50% 100%">
      {/* 背部槽（画在身体后面） */}
      {slots.back && (
        <g transform={`translate(${CX} ${(L.blobs[L.blobs.length - 1]?.cy ?? 160) - 4})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 尾巴槽 */}
      {L.tail && slots.tail && (
        <g transform={`translate(${L.tail.x} ${L.tail.y}) rotate(${L.tail.rot ?? 0})`}>
          <Part name="tail" origin="80% 100%">{slots.tail}</Part>
        </g>
      )}
      {/* 内建耳（画在头后面，头轮廓压住耳根） */}
      {L.earStyle !== "none" &&
        L.ears.map((e, i) => (
          <g key={i} transform={`translate(${e.x} ${e.y})${e.mirror ? " scale(-1 1)" : ""}`}>
            <Ear side={-1} style={L.earStyle} palette={palette} />
          </g>
        ))}
      {/* 身体体块（后→前） */}
      {L.blobs.map((b, i) => (
        <ellipse key={i} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      ))}
      {/* 肚皮 / marking 槽 */}
      {slots.marking ? (
        <g transform={`translate(${L.marking.x} ${L.marking.y})`}>{slots.marking}</g>
      ) : (
        L.belly && (
          <ellipse cx={L.belly.cx} cy={L.belly.cy} rx={L.belly.rx} ry={L.belly.ry} fill={palette.belly} opacity={0.85} />
        )
      )}
      {/* 腿（前 2 条走 legL/legR 迈步，其余静态） */}
      {L.legStyle !== "none" &&
        L.legs.map((leg, i) => {
          const lift = L.legStyle === "tall" ? 2 : 4;
          const inner = <Leg style={L.legStyle} palette={palette} mirror={leg.mirror} />;
          if (i < 2) {
            const name = (side ? (i === 0 ? "legR" : "legL") : i === 0 ? "legL" : "legR") as "legL" | "legR";
            return (
              <g key={i} transform={`translate(${leg.x} ${leg.y + lift})`}>
                <Part name={name} origin={L.legStyle === "tall" ? "50% -35%" : "50% -40%"}>{inner}</Part>
              </g>
            );
          }
          return (
            <g key={i} transform={`translate(${leg.x} ${leg.y + lift})`} opacity={0.9}>
              {inner}
            </g>
          );
        })}
      {/* 手/翅/鳍 */}
      {L.armStyle !== "none" &&
        L.arms.map((arm, i) => {
          const name = (side || i === 1 ? "armR" : "armL") as "armL" | "armR";
          return (
            <g key={i} transform={`translate(${arm.x} ${arm.y}) rotate(${arm.rot ?? 0})${arm.mirror ? " scale(-1 1)" : ""}`}>
              <Part name={name} origin="50% 6%"><Arm style={L.armStyle} palette={palette} /></Part>
            </g>
          );
        })}
      {/* 头球（merged 时头即身体顶部，已画） */}
      {!L.mergedHead && <circle cx={head.cx} cy={head.cy} r={head.r} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />}
      {/* 脸 */}
      <g className="part-face">
        {side ? (
          <ExpSideFace
            cx={head.cx + head.r * 0.4}
            cy={head.cy - head.r * 0.06}
            r={eyeR}
            mouthX={head.cx + head.r * 0.56}
            mouthY={head.cy + head.r * 0.28}
            mouthW={eyeR * 1.7}
            expression={expression}
            base={eyes}
          />
        ) : (
          <ExpFace
            cx1={head.cx - head.r * 0.42}
            cx2={head.cx + head.r * 0.42}
            cy={head.cy - head.r * 0.04}
            r={eyeR}
            mouthY={head.cy + head.r * 0.34}
            mouthW={eyeR * 2.4}
            expression={expression}
            base={eyes}
          />
        )}
        {slots.cheeks && !side && (
          <g transform={`translate(${head.cx} ${L.cheeksY})`}>
            <Part name="cheeks" origin="50% 50%">{slots.cheeks}</Part>
          </g>
        )}
      </g>
      {/* 头顶槽 */}
      {slots.headTop && (
        <g transform={`translate(${L.headTop.x} ${L.headTop.y})`}>
          <Part name="headtop" origin="50% 100%">{slots.headTop}</Part>
        </g>
      )}
      {/* 座台槽 */}
      {slots.platform && (
        <g transform={`translate(${CX} ${GROUND_Y - 2})`}>
          <Part name="platform" origin="50% 0%">{slots.platform}</Part>
        </g>
      )}
      {/* 工具 */}
      {slots.tool && (
        <g transform={`translate(${CX + L.W * 0.5 + 8} ${GROUND_Y})`}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

function AnimalFront(props: RigProps) {
  return AnimalBody(props, computeAnimalLayout(props.form, "front"));
}

function AnimalSide(props: RigProps) {
  return AnimalBody(props, computeAnimalLayout(props.form, "side"));
}

export function ChimeraRig(props: RigProps) {
  const plan = normalizedForm(props.form).bodyPlan;
  // 睡姿统一走蜷卧团子（体型无关：猫/兔睡着都缩成一团），复用既有实现。
  if (props.pose === "lie") return <ChimeraLie {...props} />;
  if (plan === "stack") {
    // 兼容旧存档：无 bodyPlan 的历史自定义物种沿用堆叠体型，形象不变。
    if (props.view === "side") return <ChimeraSide {...props} />;
    return <ChimeraFront {...props} />;
  }
  if (props.view === "side") return <AnimalSide {...props} />;
  return <AnimalFront {...props} />;
}
