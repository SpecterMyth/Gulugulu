import { OUTLINE, type Expression, type RigProps } from "../rigTypes";
import { Blush, Part } from "../parts/common";
import { ExpFace, ExpSideFace } from "../parts/faces";
import { Ahoge, DuckTailFan, TuxedoWing } from "../kits/duckKit";

// -----------------------------------------------------------------------------
// 鸭底座 v4（guluduck / 元素鸭家族 / 咕噜天鹅的基体）
// 头部返工（去"人头"感）：
// - 不再是正圆 + 黑瓜皮盖（那个组合像戴帽子的小孩）。头是下宽上窄的
//   胖蛋形——鼓腮帮、圆缓顶，通体一色；头顶默认三撮体色小绒羽（雏鸭胎毛）。
// - 大扁嘴仍挂在脸下部、两角略超出脸宽（Donald 式），眼睛紧贴嘴上缘。
// 侧视重构：与正面同一套头身比——同高的胖蛋头 + 紧贴头后下方的团子身
//（头身相叠无脖子），长扁嘴从头前下部伸出，尾根贴背、蹼脚在身下。
// pose="lie"：鸭子孵蛋式趴窝（面包团身体 + 头搁在身前 + 翅膀收拢）。
// -----------------------------------------------------------------------------

export function DuckRig(props: RigProps) {
  if (props.view === "side") return <DuckSide {...props} />;
  if (props.pose === "lie") return <DuckLieFront {...props} />;
  return <DuckFront {...props} />;
}

const BILL = "#F5A83B";
const BILL_DEEP = "#E8912D";

function billMode(expression: Expression): "closed" | "open" | "chew" {
  if (expression === "munch") return "chew";
  if (expression === "happy" || expression === "star" || expression === "surprised") return "open";
  return "closed";
}

/** 正面头：下宽上窄的胖蛋形（腮帮最宽、顶圆缓），代替旧正圆。
 *  crownY=顶点，cheekY=腮帮最宽线，chinY=下巴底，hw=腮帮半宽。 */
function DuckHeadFront({ cx, crownY, cheekY, chinY, hw, fill }: {
  cx: number; crownY: number; cheekY: number; chinY: number; hw: number; fill: string;
}) {
  const d =
    `M${cx} ${crownY}` +
    ` C ${cx - hw * 0.57} ${crownY} ${cx - hw} ${crownY + (cheekY - crownY) * 0.4} ${cx - hw} ${cheekY}` +
    ` C ${cx - hw} ${cheekY + (chinY - cheekY) * 0.62} ${cx - hw * 0.57} ${chinY} ${cx} ${chinY}` +
    ` C ${cx + hw * 0.57} ${chinY} ${cx + hw} ${cheekY + (chinY - cheekY) * 0.62} ${cx + hw} ${cheekY}` +
    ` C ${cx + hw} ${crownY + (cheekY - crownY) * 0.4} ${cx + hw * 0.57} ${crownY} ${cx} ${crownY} Z`;
  return <path d={d} fill={fill} stroke={OUTLINE} strokeWidth={6} strokeLinejoin="round" />;
}

/** 侧面头：同一颗胖蛋头的侧影——后脑圆、前脸（嘴根处）略鼓。
 *  高度与正面完全一致（crownY/cheekY 同值），保证左右移动时体型对应。 */
function DuckHeadSide({ cx, crownY, cheekY, chinX, chinY, backX, frontX, fill }: {
  cx: number; crownY: number; cheekY: number; chinX: number; chinY: number;
  backX: number; frontX: number; fill: string;
}) {
  const d =
    `M${cx} ${crownY}` +
    ` C ${cx - (cx - backX) * 0.55} ${crownY} ${backX} ${crownY + (cheekY - crownY) * 0.42} ${backX} ${cheekY}` +
    ` C ${backX} ${cheekY + (chinY - cheekY) * 0.68} ${backX + (chinX - backX) * 0.45} ${chinY} ${chinX} ${chinY}` +
    ` C ${chinX + (frontX - chinX) * 0.55} ${chinY} ${frontX - 2} ${chinY - (chinY - cheekY) * 0.3} ${frontX} ${cheekY}` +
    ` C ${frontX} ${crownY + (cheekY - crownY) * 0.42} ${cx + (frontX - cx) * 0.55} ${crownY} ${cx} ${crownY} Z`;
  return <path d={d} fill={fill} stroke={OUTLINE} strokeWidth={6} strokeLinejoin="round" />;
}

/** 正面大扁嘴（挂在脸下部、略超出脸宽）。cx=中心，topY=上缘，w=半宽。 */
function DuckBillFront({ cx, topY, w, expression }: { cx: number; topY: number; w: number; expression: Expression }) {
  const mode = billMode(expression);
  const upper = (
    <g>
      <path
        d={`M${cx - w} ${topY + 6} Q${cx} ${topY - 8} ${cx + w} ${topY + 6} Q${cx + w * 1.12} ${topY + 16} ${cx + w * 0.84} ${topY + 23} Q${cx} ${topY + 34} ${cx - w * 0.84} ${topY + 23} Q${cx - w * 1.12} ${topY + 16} ${cx - w} ${topY + 6} Z`}
        fill={BILL}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <g stroke={OUTLINE} strokeWidth={2.8} strokeLinecap="round" opacity={0.75} fill="none">
        <path d={`M${cx - w * 0.24} ${topY + 6.5} q1.5 2.5 3.5 3.5`} />
        <path d={`M${cx + w * 0.24} ${topY + 6.5} q-1.5 2.5 -3.5 3.5`} />
      </g>
    </g>
  );
  if (mode === "closed") {
    return (
      <g className="face-mouth">
        {upper}
        <path
          d={`M${cx - w * 0.62} ${topY + 27} Q${cx} ${topY + 38} ${cx + w * 0.62} ${topY + 27} Q${cx + w * 0.4} ${topY + 41} ${cx} ${topY + 43} Q${cx - w * 0.4} ${topY + 41} ${cx - w * 0.62} ${topY + 27} Z`}
          fill={BILL_DEEP}
          stroke={OUTLINE}
          strokeWidth={4.5}
          strokeLinejoin="round"
        />
      </g>
    );
  }
  const openBase = topY + 26;
  return (
    <g className="face-mouth">
      {upper}
      <g className={mode === "chew" ? "face-chew" : undefined}>
        <path
          d={`M${cx - w * 0.6} ${openBase} Q${cx} ${openBase + 9} ${cx + w * 0.6} ${openBase} Q${cx + w * 0.42} ${openBase + 21} ${cx} ${openBase + 24} Q${cx - w * 0.42} ${openBase + 21} ${cx - w * 0.6} ${openBase} Z`}
          fill={OUTLINE}
        />
        {(expression === "happy" || expression === "star" || mode === "chew") && (
          <path
            d={`M${cx - w * 0.24} ${openBase + 12} Q${cx} ${openBase + 19} ${cx + w * 0.24} ${openBase + 12} Q${cx} ${openBase + 25} ${cx - w * 0.24} ${openBase + 12} Z`}
            fill="#F5917B"
          />
        )}
        <path
          d={`M${cx - w * 0.54} ${openBase + 17} Q${cx} ${openBase + 28} ${cx + w * 0.54} ${openBase + 17} Q${cx + w * 0.36} ${openBase + 29} ${cx} ${openBase + 31} Q${cx - w * 0.36} ${openBase + 29} ${cx - w * 0.54} ${openBase + 17} Z`}
          fill={BILL_DEEP}
          stroke={OUTLINE}
          strokeWidth={4.5}
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

/** 侧面长扁嘴（从头前下部向前伸）。root=嘴根，len=长度。 */
function DuckBillSide({ rootX, rootY, len, expression }: { rootX: number; rootY: number; len: number; expression: Expression }) {
  const mode = billMode(expression);
  const upper = (
    <g>
      <path
        d={`M${rootX} ${rootY - 9} Q${rootX + len * 0.7} ${rootY - 14} ${rootX + len} ${rootY - 4} Q${rootX + len + 4} ${rootY + 3} ${rootX + len - 6} ${rootY + 6} Q${rootX + len * 0.4} ${rootY + 10} ${rootX} ${rootY + 5} Z`}
        fill={BILL}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d={`M${rootX + len * 0.5} ${rootY - 7} q2 2 4.5 2.6`} stroke={OUTLINE} strokeWidth={2.6} strokeLinecap="round" fill="none" opacity={0.75} />
    </g>
  );
  if (mode === "closed") {
    return (
      <g className="face-mouth">
        {upper}
        <path
          d={`M${rootX + 2} ${rootY + 7} Q${rootX + len * 0.55} ${rootY + 12} ${rootX + len - 6} ${rootY + 7} Q${rootX + len * 0.45} ${rootY + 16} ${rootX + 4} ${rootY + 12} Z`}
          fill={BILL_DEEP}
          stroke={OUTLINE}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        <path d={`M${rootX + 2} ${rootY + 7} q3 3 8 3.5`} stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" fill="none" />
      </g>
    );
  }
  return (
    <g className="face-mouth">
      {upper}
      <g className={mode === "chew" ? "face-chew" : undefined}>
        <path
          d={`M${rootX + 2} ${rootY + 6} Q${rootX + len * 0.55} ${rootY + 11} ${rootX + len - 6} ${rootY + 7} Q${rootX + len * 0.45} ${rootY + 21} ${rootX + 4} ${rootY + 15} Z`}
          fill={OUTLINE}
        />
        <path
          d={`M${rootX + 4} ${rootY + 14} Q${rootX + len * 0.5} ${rootY + 21} ${rootX + len - 10} ${rootY + 13} Q${rootX + len * 0.36} ${rootY + 25} ${rootX + 6} ${rootY + 19} Z`}
          fill={BILL_DEEP}
          stroke={OUTLINE}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

/** 大蹼脚（正面，带蹼纹）。pivot=(0,0)=脚踝。 */
function BigWebFoot({ mirror = false }: { mirror?: boolean }) {
  return (
    <g transform={mirror ? "scale(-1 1)" : undefined}>
      <path
        d="M-14 10 L0 -5 L15 10 Q7 15 0 15 Q-7 15 -14 10 Z"
        fill={BILL}
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      <g stroke={OUTLINE} strokeWidth={2.2} opacity={0.5} fill="none">
        <path d="M-5 3 L-5 12" />
        <path d="M5 3 L5 12" />
      </g>
    </g>
  );
}

/** 侧面蹼脚（向前伸的小扇蹼）。pivot=(0,0)=脚踝。 */
function SideWebFoot() {
  return (
    <g>
      <path d="M0 -6 q-1 8 0 13" stroke={BILL} strokeWidth={7} strokeLinecap="round" fill="none" />
      <path d="M-6 5 q13 -4 22 3 l-5 7 q-11 3 -19 -2 z" fill={BILL} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M4 8 l1 6 M10 8 l1 5" stroke={OUTLINE} strokeWidth={2} opacity={0.45} fill="none" />
    </g>
  );
}

function DuckFront({ stage, palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  const baby = stage === "baby";
  const head = baby
    ? { cx: 128, crownY: 82, cheekY: 140, chinY: 180, hw: 56 }
    : { cx: 128, crownY: 64, cheekY: 112, chinY: 150, hw: 47 };
  const body = baby
    ? { cx: 128, cy: 206, rx: 48, ry: 26 }
    : { cx: 128, cy: 188, rx: 46, ry: 40 };
  const eyeY = baby ? 134 : 110;
  const eyeDx = baby ? 22 : 19;
  const billTop = baby ? 146 : 122;
  const billW = baby ? 58 : 49;

  return (
    <Part name="body" origin="50% 100%">
      {/* 卷羽尾（黑），在身体后面 */}
      <g transform={baby ? "translate(84 200) rotate(-8)" : "translate(84 184) rotate(-8)"}>
        <Part name="tail" origin="85% 90%">{slots.tail ?? <DuckTailFan />}</Part>
      </g>
      {slots.back && (
        <g transform={`translate(128 ${baby ? 182 : 156})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 身体（多被大头宽嘴挡住，露出两侧与下缘） */}
      <ellipse cx={body.cx} cy={body.cy} rx={body.rx} ry={body.ry} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={128} cy={body.cy + 6} rx={body.rx * 0.58} ry={body.ry * 0.5} fill={palette.belly} opacity={0.6} />
      {/* 大蹼脚（略外八） */}
      <g transform="translate(102 222) rotate(-6)">
        <Part name="legL" origin="50% -20%">
          {!baby && <path d="M0 -6 q-1 6 0 10" stroke={BILL} strokeWidth={8} strokeLinecap="round" fill="none" />}
          <g transform="translate(0 4)"><BigWebFoot mirror /></g>
        </Part>
      </g>
      <g transform="translate(154 222) rotate(6)">
        <Part name="legR" origin="50% -20%">
          {!baby && <path d="M0 -6 q1 6 0 10" stroke={BILL} strokeWidth={8} strokeLinecap="round" fill="none" />}
          <g transform="translate(0 4)"><BigWebFoot /></g>
        </Part>
      </g>
      {/* 羽毛翅膀 */}
      <g transform={`translate(${baby ? 80 : 80} ${baby ? 186 : 160})`}>
        <Part name="armL" origin="80% 5%">
          <TuxedoWing mirror body={palette.body} tip={palette.deep} />
        </Part>
      </g>
      <g transform={`translate(${baby ? 176 : 176} ${baby ? 186 : 160})`}>
        <Part name="armR" origin="20% 5%">
          <TuxedoWing body={palette.body} tip={palette.deep} />
        </Part>
      </g>
      {/* 胖蛋形头（通体一色，鼓腮帮） */}
      <DuckHeadFront cx={head.cx} crownY={head.crownY} cheekY={head.cheekY} chinY={head.chinY} hw={head.hw} fill={palette.body} />
      {slots.marking}
      {/* 脸：眼睛贴嘴上缘；嘴挂在脸下部、两角略超出脸宽 */}
      <g className="part-face">
        <ExpFace
          cx1={128 - eyeDx}
          cx2={128 + eyeDx}
          cy={eyeY}
          r={baby ? 9 : 8}
          mouthY={0}
          expression={expression}
          base={eyes}
          withMouth={false}
        />
        <DuckBillFront cx={128} topY={billTop} w={billW} expression={expression} />
        <Blush cx1={128 - (baby ? 44 : 36)} cx2={128 + (baby ? 44 : 36)} cy={baby ? 150 : 125} />
        {slots.cheeks && (
          <g transform={`translate(128 ${baby ? 146 : 122})`}>
            <Part name="cheeks" origin="50% 50%">{slots.cheeks}</Part>
          </g>
        )}
      </g>
      {/* 头顶槽（默认三撮体色小绒羽） */}
      <g transform={`translate(128 ${head.crownY + 4})`}>
        <Part name="headtop" origin="50% 100%">{slots.headTop ?? <Ahoge color={palette.body} />}</Part>
      </g>
      {slots.tool && (
        <g transform="translate(190 226)">
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

function DuckSide({ stage, palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  const baby = stage === "baby";
  // 与正面同一套头身比：胖蛋头同高（crown/cheek 同 y），团子身紧贴头后下方（相叠无脖子）
  const head = baby
    ? { cx: 138, crownY: 82, cheekY: 140, chinX: 132, chinY: 178, backX: 88, frontX: 190 }
    : { cx: 134, crownY: 66, cheekY: 118, chinX: 129, chinY: 152, backX: 89, frontX: 179 };
  const body = baby
    ? { cx: 102, cy: 196, rx: 50, ry: 32 }
    : { cx: 110, cy: 184, rx: 46, ry: 38 };
  const billRoot = baby ? { x: 182, y: 146 } : { x: 172, y: 124 };
  const billLen = baby ? 46 : 42;

  return (
    <Part name="body" origin="50% 100%">
      {/* 上卷尾贴在背后上缘 */}
      <g transform={baby ? "translate(58 184) rotate(4)" : "translate(66 174) rotate(2)"}>
        <Part name="tail" origin="85% 90%">{slots.tail ?? <DuckTailFan />}</Part>
      </g>
      {slots.back && (
        <g transform={`translate(${baby ? 88 : 94} ${baby ? 158 : 148})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 团子身体（上缘钻进头后下方，无脖子） */}
      <ellipse cx={body.cx} cy={body.cy} rx={body.rx} ry={body.ry} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      <ellipse cx={body.cx + 10} cy={body.cy + 8} rx={body.rx * 0.52} ry={body.ry * 0.45} fill={palette.belly} opacity={0.6} />
      {/* 腿 + 前伸蹼脚（侧视行走主角） */}
      <g transform={`translate(${baby ? 94 : 100} ${baby ? 223 : 221})`}>
        <Part name="legL" origin="50% -35%">
          <SideWebFoot />
        </Part>
      </g>
      <g transform={`translate(${baby ? 130 : 134} ${baby ? 223 : 221})`}>
        <Part name="legR" origin="50% -35%">
          <SideWebFoot />
        </Part>
      </g>
      {/* 折叠羽翅贴在身侧 */}
      <g transform={`translate(${baby ? 98 : 106} ${baby ? 178 : 168}) rotate(-16)`}>
        <Part name="armR" origin="20% 5%">
          <TuxedoWing body={palette.body} tip={palette.deep} />
        </Part>
      </g>
      {/* 胖蛋头侧影（与正面同高同色） */}
      <DuckHeadSide
        cx={head.cx}
        crownY={head.crownY}
        cheekY={head.cheekY}
        chinX={head.chinX}
        chinY={head.chinY}
        backX={head.backX}
        frontX={head.frontX}
        fill={palette.body}
      />
      {slots.marking}
      {/* 长扁嘴（从头前下部向前伸） */}
      <DuckBillSide rootX={billRoot.x} rootY={billRoot.y} len={billLen} expression={expression} />
      <g className="part-face">
        <ExpSideFace
          cx={baby ? 160 : 152}
          cy={baby ? 128 : 106}
          r={baby ? 9 : 8}
          expression={expression}
          base={eyes}
          withMouth={false}
        />
        <ellipse cx={baby ? 146 : 140} cy={baby ? 152 : 130} rx={9} ry={5.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶槽 */}
      <g transform={`translate(${baby ? 136 : 132} ${head.crownY + 4})`}>
        <Part name="headtop" origin="50% 100%">{slots.headTop ?? <Ahoge color={palette.body} />}</Part>
      </g>
    </Part>
  );
}

/** 睡眠趴窝（鸭子孵蛋式）：面包团身体贴地 + 头搁在身前 + 翅膀收拢。 */
function DuckLieFront({ stage, palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  const baby = stage === "baby";
  const body = baby
    ? { cx: 128, cy: 211, rx: 60, ry: 20 }
    : { cx: 128, cy: 209, rx: 64, ry: 22 };
  const head = baby
    ? { cx: 128, crownY: 130, cheekY: 174, chinY: 210, hw: 50 }
    : { cx: 128, crownY: 128, cheekY: 170, chinY: 204, hw: 46 };
  const billTop = baby ? 188 : 180;
  const billW = baby ? 44 : 40;

  return (
    <Part name="body" origin="50% 100%">
      {/* 卷羽尾贴地探出 */}
      <g transform={baby ? "translate(64 206) rotate(-2)" : "translate(60 204) rotate(-2)"}>
        <Part name="tail" origin="85% 90%">{slots.tail ?? <DuckTailFan />}</Part>
      </g>
      {slots.back && (
        <g transform="translate(128 196)">
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 面包团身体（趴地摊开） */}
      <ellipse cx={body.cx} cy={body.cy} rx={body.rx} ry={body.ry} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      {/* 收拢的翅膀（贴在身体两侧的小鼓包） */}
      <g transform={`translate(${128 - body.rx + 10} ${body.cy - 6})`}>
        <Part name="armL" origin="80% 20%">
          <path d="M0 0 q-12 4 -10 16 q10 4 16 -4 q2 -8 -6 -12 z" fill={palette.body} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M-8 10 q6 4 12 0" fill="none" stroke={palette.deep} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
        </Part>
      </g>
      <g transform={`translate(${128 + body.rx - 10} ${body.cy - 6})`}>
        <Part name="armR" origin="20% 20%">
          <path d="M0 0 q12 4 10 16 q-10 4 -16 -4 q-2 -8 6 -12 z" fill={palette.body} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
          <path d="M8 10 q-6 4 -12 0" fill="none" stroke={palette.deep} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
        </Part>
      </g>
      {/* 头搁在身前（下巴贴着身体），同款胖蛋头略压扁 */}
      <DuckHeadFront cx={head.cx} crownY={head.crownY} cheekY={head.cheekY} chinY={head.chinY} hw={head.hw} fill={palette.body} />
      {slots.marking}
      <g className="part-face">
        <ExpFace
          cx1={128 - 20}
          cx2={128 + 20}
          cy={baby ? 176 : 170}
          r={8}
          mouthY={0}
          expression={expression}
          base={eyes}
          withMouth={false}
        />
        <DuckBillFront cx={128} topY={billTop} w={billW} expression={expression} />
        <Blush cx1={128 - 38} cx2={128 + 38} cy={baby ? 188 : 182} />
      </g>
      {/* 头顶槽 */}
      <g transform={`translate(128 ${head.crownY + 4})`}>
        <Part name="headtop" origin="50% 100%">{slots.headTop ?? <Ahoge color={palette.body} />}</Part>
      </g>
      {slots.platform && (
        <g transform="translate(128 231)">
          <Part name="platform" origin="50% 0%">{slots.platform}</Part>
        </g>
      )}
    </Part>
  );
}
