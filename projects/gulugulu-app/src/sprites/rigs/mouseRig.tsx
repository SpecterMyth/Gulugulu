import { OUTLINE, type Expression, type RigProps } from "../rigTypes";
import { Part } from "../parts/common";
import { ExpFace, ExpSideFace } from "../parts/faces";
import { BoltTail, RoundEars, SideEar, SparkCheeks, SparkPlus } from "../kits/electricKit";

// -----------------------------------------------------------------------------
// 鼠底座（voltmouse / 雷霆鼠皇的基体）。
// 2026-07 放大返工：与全阵容对齐（鸭 bbox ~118×150、蘑菇 ~176×150）。
// baby：整只 = 一颗头。大圆球贴地（r≈56，球底 y≈233），五官直接长在球上；
//       超大双圆耳（r≈28）+ 折线闪电尾（×1.3）+ 电花脸颊是剪影签名；
//       脚是球底两个宽点。bbox ~128×136。
// kid：长出胖圆身体（头占比 ~45%）、短手短腿，比 baby 略高（bbox ~84×153）。
// 表情：走 ExpFace/ExpSideFace 通用眼+嘴；鼠门牙只在 normal/happy/think
// 露出（呆萌露齿），其余表情（张嘴/闭眼等）不画。
// 默认件=电系签名件（闪电尾/双圆耳/电花颊/小闪电呆毛），二阶通过 slots 替换。
// -----------------------------------------------------------------------------

export function MouseRig(props: RigProps) {
  if (props.view === "side") return <MouseSide {...props} />;
  if (props.pose === "lie") return <MouseLieFront {...props} />;
  return <MouseFront {...props} />;
}

/** 小闪电呆毛（默认 headTop 件）。pivot=(0,0)=发根，向上抖。 */
function ZigAhoge({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={scale !== 1 ? `scale(${scale})` : undefined}>
      <path
        d="M0 1 L-3 -7 L3 -11 L-1 -19"
        stroke={OUTLINE}
        strokeWidth={4}
        fill="none"
        strokeLinejoin="miter"
        strokeLinecap="round"
      />
    </g>
  );
}

/** 门牙是否露出：只有 normal/happy/think 露齿呆萌，其余表情不画。 */
function toothVisible(expression: Expression): boolean {
  return expression === "normal" || expression === "happy" || expression === "think";
}

/** 一颗上门牙（鼠签名）。cx=牙中心，y=牙根（挂在嘴线下方），s=缩放。 */
function FrontTooth({ cx, y, s = 1 }: { cx: number; y: number; s?: number }) {
  const hw = 3.4 * s;
  const straight = y + 5.4 * s;
  const bottom = y + 8.4 * s;
  return (
    <path
      d={`M${cx - hw} ${y} L${cx + hw} ${y} L${cx + hw} ${straight} Q${cx + hw} ${bottom} ${cx} ${bottom} Q${cx - hw} ${bottom} ${cx - hw} ${straight} Z`}
      fill="#FFFFFF"
      stroke={OUTLINE}
      strokeWidth={2.5 * s}
      strokeLinejoin="round"
    />
  );
}

function MouseFront({ stage, palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  const baby = stage === "baby";

  // 关键锚点（baby：整只=球；kid：头球 + 胖圆身）
  const head = baby ? { cx: 128, cy: 177, r: 56 } : { cx: 128, cy: 127, r: 34 };
  const eyeY = baby ? 167 : 130;
  const eyeDx = baby ? 24 : 16;
  const eyeR = baby ? 11 : 9.5;
  const mouthY = baby ? 188 : 142;

  return (
    <Part name="body" origin="50% 100%">
      {/* 闪电尾（默认件），从球后伸出上翘、明显探出剪影 */}
      <g transform={baby ? "translate(78 188) rotate(-42)" : "translate(89 192) rotate(-30)"}>
        <Part name="tail" origin="70% 100%">
          {slots.tail ?? <BoltTail scale={1.3} />}
        </Part>
      </g>
      {/* 背部槽（kid 锚点贴颈后，让固定尺寸的披风/围脖下摆能探出身体） */}
      {slots.back && (
        <g transform={`translate(128 ${baby ? 157 : 174})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* kid：胖圆身体 + 肚皮 + 短手短腿 */}
      {!baby && (
        <>
          <ellipse cx={128} cy={193} rx={42} ry={37} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
          {slots.marking ?? <ellipse cx={128} cy={203} rx={27} ry={18} fill={palette.belly} opacity={0.85} />}
          <g transform="translate(91 174) rotate(16)">
            <Part name="armL" origin="50% 8%">
              <ellipse cx={0} cy={11} rx={8} ry={13.5} fill={palette.body} stroke={OUTLINE} strokeWidth={5} />
            </Part>
          </g>
          <g transform="translate(165 174) rotate(-16)">
            <Part name="armR" origin="50% 8%">
              <ellipse cx={0} cy={11} rx={8} ry={13.5} fill={palette.body} stroke={OUTLINE} strokeWidth={5} />
            </Part>
          </g>
          <g transform="translate(110 229)">
            <Part name="legL" origin="50% -30%">
              <path d="M0 -10 q-1 5.5 0 10" stroke={palette.deep} strokeWidth={7.5} strokeLinecap="round" fill="none" />
              <ellipse cx={0} cy={1} rx={9} ry={5.5} fill={palette.deep} stroke={OUTLINE} strokeWidth={4} />
            </Part>
          </g>
          <g transform="translate(146 229)">
            <Part name="legR" origin="50% -30%">
              <path d="M0 -10 q1 5.5 0 10" stroke={palette.deep} strokeWidth={7.5} strokeLinecap="round" fill="none" />
              <ellipse cx={0} cy={1} rx={9} ry={5.5} fill={palette.deep} stroke={OUTLINE} strokeWidth={4} />
            </Part>
          </g>
        </>
      )}
      {/* 超大双圆耳（画在头球前面一层的后面：先耳后头，头轮廓压住耳根） */}
      <g transform={`translate(128 ${baby ? 125 : 97})`}>
        <RoundEars
          body={palette.body}
          inner={palette.belly}
          r={baby ? 28 : 17}
          spread={baby ? 36 : 23.5}
        />
      </g>
      {/* 头球（baby 的整只身体） */}
      <circle cx={head.cx} cy={head.cy} r={head.r} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      {/* baby：肚皮斑 + 球底两个宽点脚 + 小豆芽手 */}
      {baby && (
        <>
          {slots.marking ?? <ellipse cx={128} cy={209} rx={29} ry={15} fill={palette.belly} opacity={0.85} />}
          <g transform="translate(78 197) rotate(20)">
            <Part name="armL" origin="50% 8%">
              <ellipse cx={0} cy={10} rx={8} ry={12.5} fill={palette.body} stroke={OUTLINE} strokeWidth={5} />
            </Part>
          </g>
          <g transform="translate(178 197) rotate(-20)">
            <Part name="armR" origin="50% 8%">
              <ellipse cx={0} cy={10} rx={8} ry={12.5} fill={palette.body} stroke={OUTLINE} strokeWidth={5} />
            </Part>
          </g>
          <g transform="translate(106 229)">
            <Part name="legL" origin="50% -60%">
              <ellipse cx={0} cy={0} rx={9.5} ry={5.5} fill={palette.deep} stroke={OUTLINE} strokeWidth={4.5} />
            </Part>
          </g>
          <g transform="translate(150 229)">
            <Part name="legR" origin="50% -60%">
              <ellipse cx={0} cy={0} rx={9.5} ry={5.5} fill={palette.deep} stroke={OUTLINE} strokeWidth={4.5} />
            </Part>
          </g>
        </>
      )}
      {/* 脸（表情库通用眼+嘴 + 条件门牙 + 电花脸颊） */}
      <g className="part-face">
        <ExpFace
          cx1={128 - eyeDx}
          cx2={128 + eyeDx}
          cy={eyeY}
          r={eyeR}
          mouthY={mouthY}
          mouthW={baby ? 28 : 18}
          expression={expression}
          base={eyes}
        />
        {toothVisible(expression) && (
          <FrontTooth cx={128} y={mouthY + 1.5} s={baby ? 1.35 : 1.1} />
        )}
        <g transform={`translate(128 ${baby ? 187 : 141})`}>
          <Part name="cheeks" origin="50% 50%">
            {slots.cheeks ?? <SparkCheeks spread={baby ? 43 : 26} r={baby ? 9.5 : 6.5} />}
          </Part>
        </g>
      </g>
      {/* 头顶槽（默认小闪电呆毛，落在两耳之间） */}
      <g transform={`translate(128 ${baby ? 124 : 95})`}>
        <Part name="headtop" origin="50% 100%">{slots.headTop ?? <ZigAhoge scale={baby ? 1.3 : 1} />}</Part>
      </g>
      {/* 工具（工作状态淡入）：小身板趴大键盘（锚点外移防遮挡） */}
      {slots.tool && (
        <g transform={`translate(${baby ? 166 : 155} 231)`}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

function MouseSide({ stage, palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  const baby = stage === "baby";
  const head = baby ? { cx: 130, cy: 177, r: 56 } : { cx: 126, cy: 131, r: 34 };
  const mouthX = baby ? 166 : 150;
  const mouthY = baby ? 188 : 141;

  return (
    <Part name="body" origin="50% 100%">
      {/* 闪电尾在后上方，明显探出剪影 */}
      <g transform={baby ? "translate(82 183) rotate(-30)" : "translate(97 189) rotate(-30)"}>
        <Part name="tail" origin="70% 100%">
          {slots.tail ?? <BoltTail scale={1.3} />}
        </Part>
      </g>
      {slots.back && (
        <g transform={`translate(${baby ? 113 : 117} ${baby ? 143 : 165})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* kid：胖圆身体 */}
      {!baby && (
        <ellipse cx={132} cy={194} rx={40} ry={35} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      )}
      {/* 单大耳（偏后上，头球压住耳根） */}
      <g transform={baby ? "translate(105 118)" : "translate(106 97)"}>
        <SideEar body={palette.body} inner={palette.belly} r={baby ? 28 : 17} />
      </g>
      {/* 头球 */}
      <circle cx={head.cx} cy={head.cy} r={head.r} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      {/* 肚皮斑 */}
      {slots.marking ??
        (baby ? (
          <ellipse cx={141} cy={209} rx={26} ry={14} fill={palette.belly} opacity={0.85} />
        ) : (
          <ellipse cx={141} cy={209} rx={21} ry={13} fill={palette.belly} opacity={0.85} />
        ))}
      {/* 两个宽点脚（侧视迈步主角），pivot 高挂在髋点上方 */}
      <g transform={`translate(${baby ? 110 : 117} 229)`}>
        <Part name="legL" origin={baby ? "50% -160%" : "50% -35%"}>
          {!baby && <path d="M0 -9 q-1 4.5 0 9" stroke={palette.deep} strokeWidth={7.5} strokeLinecap="round" fill="none" />}
          <ellipse cx={0} cy={0} rx={baby ? 10 : 8.5} ry={baby ? 5.5 : 5} fill={palette.deep} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={`translate(${baby ? 152 : 150} 229)`}>
        <Part name="legR" origin={baby ? "50% -160%" : "50% -35%"}>
          {!baby && <path d="M0 -9 q1 4.5 0 9" stroke={palette.deep} strokeWidth={7.5} strokeLinecap="round" fill="none" />}
          <ellipse cx={0} cy={0} rx={baby ? 10 : 8.5} ry={baby ? 5.5 : 5} fill={palette.deep} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 前侧小豆芽手（moving 摆动；baby 是纯球没有手） */}
      {!baby && (
        <g transform="translate(155 183) rotate(-20)">
          <Part name="armR" origin="50% 8%">
            <ellipse cx={0} cy={9} rx={8} ry={13} fill={palette.body} stroke={OUTLINE} strokeWidth={4.5} />
          </Part>
        </g>
      )}
      {/* 脸（表情库单眼+小嘴 + 条件门牙 + 电花颊） */}
      <g className="part-face">
        <ExpSideFace
          cx={baby ? 154 : 148}
          cy={baby ? 166 : 124}
          r={baby ? 11 : 9.5}
          mouthX={mouthX}
          mouthY={mouthY}
          mouthW={baby ? 24 : 14}
          expression={expression}
          base={eyes}
        />
        {toothVisible(expression) && (
          <FrontTooth cx={mouthX} y={mouthY + 1.5} s={baby ? 1.35 : 1.1} />
        )}
        <circle cx={baby ? 141 : 137} cy={baby ? 190 : 143} r={baby ? 9 : 6} fill={palette.accent} />
        <SparkPlus x={baby ? 126 : 126} y={baby ? 199 : 150} s={baby ? 4.5 : 3.6} />
      </g>
      {/* 头顶槽（耳前方） */}
      <g transform={`translate(${baby ? 141 : 137} ${baby ? 125 : 101})`}>
        <Part name="headtop" origin="50% 100%">{slots.headTop ?? <ZigAhoge scale={baby ? 1.3 : 1} />}</Part>
      </g>
    </Part>
  );
}

/** 睡眠大字趴（趴成饼的仓鼠）：头球压扁贴地、双圆耳向两侧耷拉、
 *  豆芽手向前摊平在地、小点脚在后方露出一点、闪电尾放平软软拖在身后。 */
function MouseLieFront({ stage, palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  const baby = stage === "baby";
  // 压扁的头球（baby 高 ~72 ≈ 站姿 64%；kid 大头趴在矮墩身体前）
  const head = baby ? { cx: 128, cy: 197, rx: 66, ry: 36 } : { cx: 128, cy: 190, rx: 40, ry: 31 };
  const ear = baby ? { dx: 63, y: 178, r: 28 } : { dx: 33, y: 167, r: 17 };
  const eyeDx = baby ? 26 : 17;
  const eyeY = baby ? 193 : 187;
  const mouthY = baby ? 207 : 200;
  const mouthHW = baby ? 12 : 10;

  return (
    <Part name="body" origin="50% 100%">
      {/* 闪电尾放平：软软拖在身后地上（tail-sway 缓慢摇摆） */}
      <g transform={baby ? "translate(70 226) rotate(-70)" : "translate(86 224) rotate(-60)"}>
        <Part name="tail" origin="70% 100%">
          {slots.tail ?? <BoltTail scale={1.3} />}
        </Part>
      </g>
      {/* 背部槽：披风/围脖摊在趴姿身后的地上（横向放宽贴地） */}
      {slots.back && (
        <g transform={baby ? "translate(128 176) scale(1.2 0.9)" : "translate(128 184) scale(1.35 0.85)"}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* kid：矮墩身体（大部分被前趴的头挡住） */}
      {!baby && <ellipse cx={128} cy={214} rx={54} ry={19} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />}
      {/* 小点脚在后方露出一点（被身体压住大半，避开前伸的豆芽手） */}
      <g transform={`translate(${baby ? 66 : 78} ${baby ? 213 : 225}) rotate(-14)`}>
        <Part name="legL" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={baby ? 9.5 : 8} ry={baby ? 5.5 : 4.5} fill={palette.deep} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      <g transform={`translate(${baby ? 190 : 178} ${baby ? 213 : 225}) rotate(14)`}>
        <Part name="legR" origin="50% 50%">
          <ellipse cx={0} cy={0} rx={baby ? 9.5 : 8} ry={baby ? 5.5 : 4.5} fill={palette.deep} stroke={OUTLINE} strokeWidth={4} />
        </Part>
      </g>
      {/* 超大双圆耳向两侧耷拉：中心外移下移 + 微旋压扁（头轮廓压住耳根） */}
      <g transform={`translate(${128 - ear.dx} ${ear.y}) rotate(-18) scale(1 0.82)`}>
        <SideEar body={palette.body} inner={palette.belly} r={ear.r} />
      </g>
      <g transform={`translate(${128 + ear.dx} ${ear.y}) rotate(18) scale(1 0.82)`}>
        <SideEar body={palette.body} inner={palette.belly} r={ear.r} />
      </g>
      {/* 压扁头球（baby=整只；kid=趴在身前的大头） */}
      <ellipse cx={head.cx} cy={head.cy} rx={head.rx} ry={head.ry} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      {slots.marking}
      {/* 豆芽手向前伸出、摊平在地 */}
      <g transform={baby ? "translate(86 228) rotate(-18)" : "translate(94 226) rotate(-16)"}>
        <Part name="armL" origin="80% 50%">
          <ellipse cx={0} cy={0} rx={baby ? 13.5 : 11.5} ry={baby ? 6.5 : 6} fill={palette.body} stroke={OUTLINE} strokeWidth={5} />
        </Part>
      </g>
      <g transform={baby ? "translate(170 228) rotate(18)" : "translate(162 226) rotate(16)"}>
        <Part name="armR" origin="20% 50%">
          <ellipse cx={0} cy={0} rx={baby ? 13.5 : 11.5} ry={baby ? 6.5 : 6} fill={palette.body} stroke={OUTLINE} strokeWidth={5} />
        </Part>
      </g>
      {/* 脸（闭眼 + w 嘴 + 电花颊），朝观众 */}
      <g className="part-face">
        <ExpFace
          cx1={128 - eyeDx}
          cx2={128 + eyeDx}
          cy={eyeY}
          r={baby ? 10 : 9}
          mouthY={0}
          expression={expression}
          base={eyes}
          withMouth={false}
        />
        <path
          d={`M${128 - mouthHW} ${mouthY} q${mouthHW / 2} 5 ${mouthHW} 0 q${mouthHW / 2} 5 ${mouthHW} 0`}
          fill="none"
          stroke={OUTLINE}
          strokeWidth={4}
          strokeLinecap="round"
        />
        <g transform={`translate(128 ${baby ? 205 : 198})`}>
          <Part name="cheeks" origin="50% 50%">
            {slots.cheeks ?? <SparkCheeks spread={baby ? 45 : 27} r={baby ? 9 : 6.5} />}
          </Part>
        </g>
      </g>
      {/* 头顶槽（趴下后的头顶：压扁头球顶点） */}
      <g transform={`translate(128 ${baby ? 164 : 162})`}>
        <Part name="headtop" origin="50% 100%">{slots.headTop ?? <ZigAhoge scale={baby ? 1.3 : 1} />}</Part>
      </g>
      {/* 座台槽（浮冰等：画在最前，边缘压住身体底缘=趴在座台上） */}
      {slots.platform && (
        <g transform="translate(128 231)">
          <Part name="platform" origin="50% 0%">{slots.platform}</Part>
        </g>
      )}
    </Part>
  );
}
