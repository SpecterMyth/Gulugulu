import { OUTLINE, type RigProps } from "../rigTypes";
import { Blush, Part, PawFoot } from "../parts/common";
import { ExpFace, ExpSideFace } from "../parts/faces";
import { CreamMuzzle, FlameTail, PointedEars, SideEar } from "../kits/fireKit";

// -----------------------------------------------------------------------------
// 狐底座（emberfox / infernofox / plasmatanuki 的基体）
// 剪影像一支蜡烛：大头双尖耳 + 一条高过头顶的 S 形三层火焰大尾（tail 槽默认件，
// 尾尖到 y≈30，全阵容最高）。baby：新生儿比例，头 ≥60%、米粒小身、小肉垫爪；
// kid：幼童比例，头 ~50%、躯干拉长、四肢明显、站得更直。
// 默认件=火焰尾/双尖耳/奶油口鼻/肚皮补丁，二阶通过 slots 替换。
// 表情：眼睛+嘴走 ExpFace/ExpSideFace（CreamMuzzle withMouth=false 只留补丁+鼻）。
// pose="lie"：狐狸蜷卧式睡姿（低扁圆团 + 头趴前爪 + 火焰尾绕身前当围巾）。
// -----------------------------------------------------------------------------

export function FoxRig(props: RigProps) {
  if (props.view === "side") return <FoxSide {...props} />;
  if (props.pose === "lie") return <FoxLieFront {...props} />;
  return <FoxFront {...props} />;
}

/** 小圆臂。pivot=(0,0)=肩点，默认向右下垂（armR）；mirror 用于左臂。 */
function FoxArm({ color, mirror = false, long = false }: { color: string; mirror?: boolean; long?: boolean }) {
  const d = long
    ? "M0 0 q14 5 13 24 q-7 9 -16 2 q-4 -13 3 -26 z"
    : "M0 0 q12 4 11 17 q-6 7 -13 1 q-3 -10 2 -18 z";
  return (
    <path
      d={d}
      transform={mirror ? "scale(-1 1)" : undefined}
      fill={color}
      stroke={OUTLINE}
      strokeWidth={5}
      strokeLinejoin="round"
    />
  );
}

/** 侧视小脚（朝右），局部 (0,0)=脚踝，脚底 y≈+7。 */
function FoxFootSide({ color }: { color: string }) {
  return (
    <path
      d="M-8 0 q0 -7 8 -7 q11 0 13 6 q-1 8 -12 8 q-8 0 -9 -7 z"
      fill={color}
      stroke={OUTLINE}
      strokeWidth={4.5}
      strokeLinejoin="round"
    />
  );
}

function FoxFront({ stage, palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  const baby = stage === "baby";
  const head = baby ? { cx: 128, cy: 147, r: 50 } : { cx: 128, cy: 116, r: 40 };
  const body = baby
    ? { cx: 128, cy: 209, rx: 36, ry: 24 }
    : { cx: 128, cy: 186, rx: 33, ry: 36 };
  const eyeY = baby ? 145 : 118;
  const eyeDx = baby ? 22 : 18;
  const eyeR = baby ? 9 : 8;

  return (
    <Part name="body" origin="50% 100%">
      {/* 火焰大尾（身后左侧，S 形高过头顶 → 蜡烛剪影） */}
      <g transform={baby ? "translate(94 212) rotate(-10)" : "translate(90 206) rotate(-12)"}>
        <Part name="tail" origin="55% 98%">{slots.tail ?? <FlameTail scale={baby ? 1.12 : 1.1} />}</Part>
      </g>
      {/* 背部槽 */}
      {slots.back && (
        <g transform={`translate(128 ${baby ? 190 : 168})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 双尖耳（headTop 槽；画在头后面，耳基由头盖住） */}
      <g transform={`translate(128 ${head.cy - head.r + 10})`}>
        <Part name="headtop" origin="50% 92%">
          {slots.headTop ?? <PointedEars color={palette.body} inner={palette.belly} scale={baby ? 1 : 0.88} />}
        </Part>
      </g>
      {/* 米粒小身 / 幼童躯干 */}
      <ellipse cx={body.cx} cy={body.cy} rx={body.rx} ry={body.ry} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      {/* 肚皮奶油补丁（marking 槽默认件） */}
      {slots.marking ?? (
        <ellipse cx={128} cy={baby ? 215 : 197} rx={body.rx * 0.6} ry={baby ? body.ry * 0.6 : 20} fill={palette.belly} />
      )}
      {/* 小短腿 + 深色袜肉垫爪（kid 才露腿，baby 只有脚尖） */}
      <g transform={`translate(${128 - 19} ${baby ? 227 : 226})`}>
        <Part name="legL" origin="50% -30%">
          {!baby && <path d="M0 -16 q-2 9 0 16" stroke={palette.deep} strokeWidth={9} strokeLinecap="round" fill="none" />}
          <PawFoot x={0} y={0} rx={baby ? 11 : 12} color={palette.deep} />
        </Part>
      </g>
      <g transform={`translate(${128 + 19} ${baby ? 227 : 226})`}>
        <Part name="legR" origin="50% -30%">
          {!baby && <path d="M0 -16 q2 9 0 16" stroke={palette.deep} strokeWidth={9} strokeLinecap="round" fill="none" />}
          <PawFoot x={0} y={0} rx={baby ? 11 : 12} color={palette.deep} />
        </Part>
      </g>
      {/* 大圆头 */}
      <circle cx={head.cx} cy={head.cy} r={head.r} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      {/* 小圆臂 */}
      <g transform={`translate(${baby ? 98 : 100} ${baby ? 196 : 166})`}>
        <Part name="armL" origin="75% 5%">
          <FoxArm color={palette.deep} mirror long={!baby} />
        </Part>
      </g>
      <g transform={`translate(${baby ? 158 : 156} ${baby ? 196 : 166})`}>
        <Part name="armR" origin="25% 5%">
          <FoxArm color={palette.deep} long={!baby} />
        </Part>
      </g>
      {/* 脸 */}
      <g className="part-face">
        {/* 挑眉（吊梢急性子） */}
        <g stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" fill="none">
          <path d={baby ? "M115 130 q-10 1 -17 -7" : "M117 105 q-9 1 -15 -6"} />
          <path d={baby ? "M141 130 q10 1 17 -7" : "M139 105 q9 1 15 -6"} />
        </g>
        {/* 奶油口鼻补丁（withMouth=false：嘴走表情库，画在鼻下） */}
        <g transform={`translate(128 ${baby ? 170 : 139})`}>
          <CreamMuzzle color={palette.belly} scale={baby ? 1 : 0.85} withMouth={false} />
        </g>
        <ExpFace
          cx1={128 - eyeDx}
          cx2={128 + eyeDx}
          cy={eyeY}
          r={eyeR}
          mouthY={baby ? 173 : 142}
          mouthW={baby ? 11 : 9}
          expression={expression}
          base={eyes}
          withMouth
        />
        <Blush cx1={baby ? 92 : 100} cx2={baby ? 164 : 156} cy={baby ? 168 : 139} />
        {slots.cheeks && (
          <g transform={`translate(128 ${baby ? 164 : 135})`}>
            <Part name="cheeks" origin="50% 50%">{slots.cheeks}</Part>
          </g>
        )}
      </g>
      {/* 工具（工作状态淡入），摆在右前方地面 */}
      {slots.tool && (
        <g transform="translate(187 227)">
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

function FoxSide({ stage, palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  const baby = stage === "baby";
  const head = baby ? { cx: 132, cy: 146, r: 48 } : { cx: 136, cy: 122, r: 39 };
  const body = baby
    ? { cx: 122, cy: 205, rx: 40, ry: 25 }
    : { cx: 126, cy: 190, rx: 35, ry: 34 };

  return (
    <Part name="body" origin="50% 100%">
      {/* 火焰大尾：身后弓起、高过头顶 */}
      <g transform={baby ? "translate(88 214) rotate(-12)" : "translate(86 210) rotate(-12)"}>
        <Part name="tail" origin="55% 98%">{slots.tail ?? <FlameTail scale={baby ? 1.1 : 1.12} />}</Part>
      </g>
      {slots.back && (
        <g transform={`translate(${baby ? 112 : 116} ${baby ? 186 : 168})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 远侧耳（深色，露一角） */}
      <g transform={`translate(${baby ? 113 : 119} ${baby ? 107 : 91}) rotate(-16)`}>
        <SideEar color={palette.deep} inner={palette.body} scale={baby ? 0.9 : 0.8} />
      </g>
      {/* 近侧耳（headTop 槽） */}
      <g transform={`translate(${baby ? 146 : 150} ${baby ? 104 : 88}) rotate(8)`}>
        <Part name="headtop" origin="50% 92%">
          {slots.headTop ?? <SideEar color={palette.body} inner={palette.belly} scale={baby ? 1 : 0.88} />}
        </Part>
      </g>
      {/* 身体 */}
      <ellipse cx={body.cx} cy={body.cy} rx={body.rx} ry={body.ry} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      {/* marking 槽（默认下腹奶油弯月，躲开前爪） */}
      {slots.marking ?? (
        <ellipse
          cx={baby ? 144 : 146}
          cy={baby ? 218 : 206}
          rx={baby ? 12 : 11}
          ry={7}
          fill={palette.belly}
        />
      )}
      {/* 腿（侧视行走主角，pivot 在髋点上方） */}
      <g transform={`translate(${baby ? 108 : 112} ${baby ? 225 : 224})`}>
        <Part name="legL" origin="50% -30%">
          <path d="M0 -10 q-1 9 0 12" stroke={palette.deep} strokeWidth={8} strokeLinecap="round" fill="none" />
          <FoxFootSide color={palette.deep} />
        </Part>
      </g>
      <g transform={`translate(${baby ? 140 : 146} ${baby ? 225 : 224})`}>
        <Part name="legR" origin="50% -30%">
          <path d="M0 -10 q1 9 0 12" stroke={palette.deep} strokeWidth={8} strokeLinecap="round" fill="none" />
          <FoxFootSide color={palette.deep} />
        </Part>
      </g>
      {/* 头 */}
      <circle cx={head.cx} cy={head.cy} r={head.r} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      {/* 脸（吻部 + 单眼 + 挑眉 + 表情嘴 + 腮红） */}
      <g className="part-face">
        {/* 奶油圆吻（朝右小雪包）+ 鼻头（嘴走表情库，对准吻部） */}
        <ellipse
          cx={baby ? 168 : 166}
          cy={baby ? 158 : 134}
          rx={baby ? 16 : 13}
          ry={baby ? 11 : 9}
          transform={baby ? "rotate(-8 168 158)" : "rotate(-8 166 134)"}
          fill={palette.belly}
          stroke={OUTLINE}
          strokeWidth={4.5}
        />
        <ellipse cx={baby ? 180 : 176} cy={baby ? 151 : 128} rx={4.5} ry={3.5} fill={OUTLINE} />
        <path
          d={baby ? "M158 118 q-9 -5 -17 -4" : "M161 99 q-8 -5 -15 -4"}
          stroke={OUTLINE}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <ExpSideFace
          cx={baby ? 150 : 154}
          cy={baby ? 136 : 114}
          r={baby ? 9 : 8}
          mouthX={baby ? 169 : 166}
          mouthY={baby ? 162 : 137}
          mouthW={baby ? 8 : 7}
          expression={expression}
          base={eyes}
        />
        <ellipse cx={baby ? 145 : 148} cy={baby ? 164 : 140} rx={9} ry={5.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 近侧小臂（深色前爪，贴身体前侧） */}
      <g transform={`translate(${baby ? 133 : 134} ${baby ? 191 : 171}) rotate(-8)`}>
        <Part name="armR" origin="25% 5%">
          <FoxArm color={palette.deep} long={!baby} />
        </Part>
      </g>
    </Part>
  );
}

/** 睡眠蜷卧（狐狸团子式，非旋转倒下）：身体蜷成低扁圆团贴地，头趴在
 *  前爪上（前侧、微低、脸朝观众），双尖耳仍立着；火焰大尾从身后绕到
 *  身前横放当围巾（略压扁、色层保留，睡觉时安静地绕在身前）。 */
function FoxLieFront({ stage, palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  const baby = stage === "baby";
  // 头偏左前、团子偏右 → 右侧留出蜷起的后臀 + 尾根（蜷卧的不对称构图）
  const body = baby
    ? { cx: 132, cy: 203, rx: 58, ry: 28 }
    : { cx: 134, cy: 204, rx: 62, ry: 27 };
  const head = baby ? { cx: 122, cy: 172, r: 44 } : { cx: 124, cy: 176, r: 40 };
  const eyeY = baby ? 176 : 180;
  const eyeDx = baby ? 20 : 17;
  const muzzleY = baby ? 197 : 200;
  const blushDx = baby ? 34 : 31;
  const blushY = baby ? 195 : 198;

  return (
    <Part name="body" origin="50% 100%">
      {/* 背部槽（贴在团子上方） */}
      {slots.back && (
        <g transform="translate(128 186)">
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 双尖耳（headTop 槽；画在头后面、耳基由头盖住，趴下后仍立在头顶） */}
      <g transform={`translate(${head.cx} ${head.cy - head.r + 10})`}>
        <Part name="headtop" origin="50% 92%">
          {slots.headTop ?? <PointedEars color={palette.body} inner={palette.belly} scale={baby ? 0.95 : 0.85} />}
        </Part>
      </g>
      {/* 蜷成低扁圆团的身体 */}
      <ellipse cx={body.cx} cy={body.cy} rx={body.rx} ry={body.ry} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      {/* 蜷起的后臀弧线（右侧鼓包暗示，尾巴从它下面绕出来） */}
      <path
        d={baby ? "M162 182 Q180 196 174 216" : "M166 183 Q185 197 179 217"}
        fill="none"
        stroke={palette.deep}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.4}
      />
      {slots.marking}
      {/* 火焰大尾绕到身前横放当围巾：略压扁、色层保留；蓬松多层的焰身
          安静地卧在脸旁（左），焰梢向右收窄、掖进右侧后臀下（mirror 让
          S 形焰边垂向地面而不是翘进头后） */}
      <g transform={baby ? "translate(62 205) rotate(86) scale(-0.7 0.72)" : "translate(64 204) rotate(86) scale(-0.7 0.74)"}>
        <Part name="tail" origin="55% 98%">{slots.tail ?? <FlameTail />}</Part>
      </g>
      {/* 前爪小肉垫（露在头下方、搭在尾巴上，头枕着） */}
      <g transform={`translate(${head.cx - 17} ${baby ? 218 : 219})`}>
        <Part name="armL" origin="50% 0%">
          <PawFoot x={0} y={0} rx={baby ? 10.5 : 11} color={palette.deep} />
        </Part>
      </g>
      <g transform={`translate(${head.cx + 17} ${baby ? 218 : 219})`}>
        <Part name="armR" origin="50% 0%">
          <PawFoot x={0} y={0} rx={baby ? 10.5 : 11} color={palette.deep} />
        </Part>
      </g>
      {/* 头趴在前爪上（前侧微低、脸朝观众） */}
      <circle cx={head.cx} cy={head.cy} r={head.r} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      <g className="part-face">
        {/* 奶油口鼻补丁（睡觉不画挑眉，放松） */}
        <g transform={`translate(${head.cx} ${muzzleY})`}>
          <CreamMuzzle color={palette.belly} scale={baby ? 0.95 : 0.85} withMouth={false} />
        </g>
        <ExpFace
          cx1={head.cx - eyeDx}
          cx2={head.cx + eyeDx}
          cy={eyeY}
          r={baby ? 8.5 : 8}
          mouthY={baby ? 201 : 204}
          mouthW={baby ? 11 : 9}
          expression={expression}
          base={eyes}
          withMouth
        />
        <Blush cx1={head.cx - blushDx} cx2={head.cx + blushDx} cy={blushY} />
        {slots.cheeks && (
          <g transform={`translate(${head.cx} ${blushY - 3})`}>
            <Part name="cheeks" origin="50% 50%">{slots.cheeks}</Part>
          </g>
        )}
      </g>
      {slots.platform && (
        <g transform="translate(128 231)">
          <Part name="platform" origin="50% 0%">{slots.platform}</Part>
        </g>
      )}
    </Part>
  );
}
