import { OUTLINE, type RigPalette, type RigProps } from "../rigTypes";
import { Blush, Part } from "../parts/common";
import { ExpFace, ExpSideFace } from "../parts/faces";
import { FrostBreath, FurRidge, IceSpikes, ICE_DEEP_TEAL } from "../kits/iceKit";

// -----------------------------------------------------------------------------
// 雪怪底座（frostpeng 霜霜雪怪 / glacierpeng 极冰雪帝 / 冰组合系的基体）。
// 剪影：宽梯形锯齿毛边轮廓 + 两条垂到地面的大手臂——一只毛边三角饭团，
// 全阵容"最壮"。baby：头脸占上部 ~60%，短粗腿藏毛下只露脚尖；
// kid：身体拉高、腰身出现、腿露出一点，站得更挺。默认件=头顶立毛+小冰晶
// （headtop）/ 背部小冰晶簇（back）/ 绒毛尾球（tail）/ 深色毛须纹（marking），
// 二阶通过 slots 替换。配色红线：无大面积纯白，一律用 palette 的青白系。
// 表情：眼睛走 ExpFace/ExpSideFace；normal 是高冷特例（平眉 + sleepy 半合眼 +
// 自绘平嘴），其余表情用表情库通用嘴。深青圆鼻画在嘴上方，正/侧视同为圆点
//（侧视贴脸补丁前缘），侧影脸段是圆润口鼻弧、不出尖。
// -----------------------------------------------------------------------------

export function YetiRig(props: RigProps) {
  if (props.view === "side") return <YetiSide {...props} />;
  if (props.pose === "lie") return <YetiLieFront {...props} />;
  return <YetiFront {...props} />;
}

/** 鼻头/深件点缀色：优先二阶 accent2，回退冰系深青 */
function deepTint(palette: RigPalette): string {
  return palette.accent2 ?? ICE_DEEP_TEAL;
}

/** 大手臂（垂到地面、末端圆爪）。局部坐标：pivot≈(2,2)=肩点，向下垂 ~120px。 */
function YetiArm({ palette, mirror = false, scale = 1 }: { palette: RigPalette; mirror?: boolean; scale?: number }) {
  const sx = (mirror ? -1 : 1) * scale;
  return (
    <g transform={sx !== 1 || scale !== 1 ? `scale(${sx} ${scale})` : undefined}>
      {/* 肘外侧小毛簇（先画，让主形盖住根部） */}
      <path d="M31 42 L41 50 L30 56 Z" fill={palette.body} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      {/* 胖乎乎的主臂 */}
      <path
        d="M2 2 q22 0 28 22 q7 28 3 56 q-2 26 -11 36 q-14 10 -26 0 q-7 -24 -5 -52 q2 -32 5 -58 z"
        fill={palette.body}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      {/* 掌垫 + 爪缝 */}
      <ellipse cx={9} cy={104} rx={8.5} ry={6.5} fill={palette.belly} opacity={0.85} />
      <g stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" fill="none">
        <path d="M3 118 q1 -7 0 -11" />
        <path d="M12 116 q1 -7 0 -11" />
      </g>
    </g>
  );
}

/** 头顶默认件：一小簇立毛 + 一颗小冰晶。pivot=(0,0)=底部中点。 */
function TuftCrystal({ palette }: { palette: RigPalette }) {
  return (
    <g>
      <path
        d="M-14 0 q-2 -10 -8 -14 q10 -2 14 4 q0 -12 8 -16 q6 6 4 14 q8 -6 14 -4 q-6 6 -6 14 z"
        fill={palette.body}
        stroke={OUTLINE}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <g transform="translate(15 -6) rotate(18)">
        <IceSpikes count={1} scale={0.62} color={palette.accent} highlight={palette.belly} />
      </g>
    </g>
  );
}

/** 绒毛尾球（默认 tail）。pivot=(0,0)=尾根，向左上蓬起。 */
function TailFluff({ color }: { color: string }) {
  return (
    <path
      d="M0 0 q-10 2 -18 -2 q4 -5 10 -6 q-8 -2 -10 -10 q8 -2 14 2 q-2 -8 4 -12 q6 6 6 16 q0 9 -6 12 z"
      fill={color}
      stroke={OUTLINE}
      strokeWidth={4.5}
      strokeLinejoin="round"
    />
  );
}

/** 默认 marking：下身三缕深色毛须纹。 */
function FurStreaks({ cx, y, color }: { cx: number; y: number; color: string }) {
  return (
    <g stroke={color} strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.55}>
      <path d={`M${cx - 28} ${y} q3 9 -1 15`} />
      <path d={`M${cx} ${y + 6} q3 9 -1 15`} />
      <path d={`M${cx + 28} ${y} q3 9 -1 15`} />
    </g>
  );
}

// =============================== 正面 ===============================

function YetiFront({ stage, palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  const baby = stage === "baby";
  const nose = deepTint(palette);

  // 毛边梯形主形（锯齿毛尖烘进剪影：两侧各3 + 顶部小耳簇2）
  const bodyPath = baby
    ? // baby：宽 ≈176（含毛尖）、高 ≈175，上窄下宽，头脸占上部 ~60%
      "M54 224 Q56 208 62 192 L40 182 L64 170 Q66 160 70 148 L48 138 L72 126 " +
      "Q74 116 80 104 L64 94 L84 84 Q86 76 92 70 L84 58 L100 54 Q128 40 156 54 " +
      "L172 58 L164 70 Q170 76 172 84 L192 94 L176 104 Q182 116 184 126 L208 138 " +
      "L186 148 Q190 160 192 170 L216 182 L194 192 Q200 208 202 224 Q128 232 54 224 Z"
    : // kid：拉高（高 ≈190），腰身出现，站得更挺
      "M80 205 Q76 196 76 188 L60 180 L78 168 Q84 158 88 148 Q84 134 82 122 " +
      "L66 114 L84 102 Q86 88 94 70 L86 60 L102 56 Q128 42 154 56 L170 60 L162 70 " +
      "Q170 88 172 102 L190 114 L174 122 Q172 134 168 148 Q172 158 178 168 " +
      "L196 180 L180 188 Q180 196 176 205 Q128 213 80 205 Z";

  const face = baby
    ? { cy: 108, rx: 42, ry: 40, eyeCy: 102, eyeDx: 22, eyeR: 9, noseCy: 116, noseR: 5, mouthY: 128, mouthW: 14, browY: 88, blushDx: 28, blushCy: 124, cheekY: 124 }
    : { cy: 92, rx: 36, ry: 33, eyeCy: 88, eyeDx: 19, eyeR: 8, noseCy: 100, noseR: 4.5, mouthY: 111, mouthW: 12, browY: 76, blushDx: 26, blushCy: 108, cheekY: 108 };

  return (
    <Part name="body" origin="50% 100%">
      {/* 座台槽（浮冰等，画在最后面） */}
      {slots.platform && (
        <g transform="translate(128 231)">
          <Part name="platform" origin="50% 0%">{slots.platform}</Part>
        </g>
      )}
      {/* 绒毛尾球（左后方探出一点） */}
      <g transform={baby ? "translate(64 204) rotate(-10)" : "translate(76 192) rotate(-12)"}>
        <Part name="tail" origin="90% 90%">{slots.tail ?? <TailFluff color={palette.body} />}</Part>
      </g>
      {/* 背部槽：默认小冰晶簇，从右肩后探头 */}
      <g transform={baby ? "translate(186 96) rotate(40)" : "translate(180 90) rotate(40)"}>
        <Part name="back" origin="50% 80%">{slots.back ?? <IceSpikes count={3} scale={0.8} color={palette.accent} highlight={palette.belly} />}</Part>
      </g>
      {/* 短粗腿（藏毛下：baby 只露脚尖，kid 露一小截） */}
      <g transform={`translate(${baby ? 102 : 106} 0)`}>
        <Part name="legL" origin="50% 15%">
          {!baby && <path d="M-10 192 h20 v30 q0 6 -10 6 q-10 0 -10 -6 z" fill={palette.body} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />}
          <ellipse cx={0} cy={baby ? 228 : 227} rx={baby ? 15 : 12} ry={6} fill={palette.deep} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={`translate(${baby ? 154 : 150} 0)`}>
        <Part name="legR" origin="50% 15%">
          {!baby && <path d="M-10 192 h20 v30 q0 6 -10 6 q-10 0 -10 -6 z" fill={palette.body} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />}
          <ellipse cx={0} cy={baby ? 228 : 227} rx={baby ? 15 : 12} ry={6} fill={palette.deep} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 毛边梯形主形 */}
      <path d={bodyPath} fill={palette.body} stroke={OUTLINE} strokeWidth={6} strokeLinejoin="round" />
      {/* 下身柔影 */}
      <ellipse cx={128} cy={baby ? 210 : 188} rx={baby ? 56 : 42} ry={baby ? 11 : 9} fill={palette.deep} opacity={0.22} />
      {/* marking 槽：默认深色毛须纹 */}
      {slots.marking ?? <FurStreaks cx={128} y={baby ? 190 : 168} color={palette.deep} />}
      {/* kid：裙摆毛边（FurRidge 复用），盖住腿根 */}
      {!baby && (
        <g transform="translate(128 203)">
          <FurRidge width={94} teeth={7} depth={10} color={palette.body} />
        </g>
      )}
      {/* 脸补丁大底色（留在 part-face 外，随身体而非脸部微动） */}
      <ellipse cx={128} cy={face.cy} rx={face.rx} ry={face.ry} fill={palette.belly} />
      {/* 五官：眼睛走表情库；normal 高冷特例 = 平眉 + 半合眼 + 自绘平嘴 */}
      <g className="part-face">
        <g stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" fill="none">
          <path d={`M${128 - face.eyeDx - 8} ${face.browY} q8 -3 15 -1`} />
          <path d={`M${128 + face.eyeDx + 8} ${face.browY} q-8 -3 -15 -1`} />
        </g>
        <ExpFace
          cx1={128 - face.eyeDx}
          cx2={128 + face.eyeDx}
          cy={face.eyeCy}
          r={face.eyeR}
          mouthY={face.mouthY}
          mouthW={face.mouthW}
          expression={expression}
          base={eyes}
          withMouth={expression !== "normal"}
        />
        {/* 深青圆鼻（嘴上方，正/侧视同款圆点） */}
        <circle cx={128} cy={face.noseCy} r={face.noseR} fill={nose} stroke={OUTLINE} strokeWidth={3} />
        {expression === "normal" && (
          <path d={`M${128 - face.mouthW / 2} ${face.mouthY} h${face.mouthW}`} stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
        )}
        <Blush cx1={128 - face.blushDx} cx2={128 + face.blushDx} cy={face.blushCy} />
        {slots.cheeks && (
          <g transform={`translate(128 ${face.cheekY})`}>
            <Part name="cheeks" origin="50% 50%">{slots.cheeks}</Part>
          </g>
        )}
      </g>
      {/* 两条大手臂：从身侧垂到地面，末端圆爪（挥舞/工作主角） */}
      <g transform={baby ? "translate(80 112)" : "translate(86 102)"}>
        <Part name="armL" origin="74% 2%">
          <YetiArm palette={palette} mirror scale={baby ? 1 : 0.95} />
        </Part>
      </g>
      <g transform={baby ? "translate(176 112)" : "translate(170 102)"}>
        <Part name="armR" origin="26% 2%">
          <YetiArm palette={palette} scale={baby ? 1 : 0.95} />
        </Part>
      </g>
      {/* 头顶槽：默认立毛+小冰晶 */}
      <g transform={`translate(128 ${baby ? 58 : 54})`}>
        <Part name="headtop" origin="50% 100%">{slots.headTop ?? <TuftCrystal palette={palette} />}</Part>
      </g>
      {/* 工具（工作状态淡入），摆在右前方地面 */}
      {slots.tool && (
        <g transform={baby ? "translate(200 230)" : "translate(196 230)"}>
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

// =============================== 睡眠前扑趴 ===============================

/** 睡眠前扑摊手趴（扑倒的大毛绒玩具）：毛绒梯形压扁放倒摊宽，
 *  两条大手臂向前伸直摊在地面两侧（横放、爪朝前），脸贴近地面朝观众。 */
function YetiLieFront({ stage, palette, slots = {}, eyes = "sleepy", expression = "sleep" }: RigProps) {
  const baby = stage === "baby";
  const nose = deepTint(palette);

  // 压扁放倒的毛绒主形：更宽更矮（高 ~105，宽 ~190），侧边毛尖 + 顶部耳簇保留
  const bodyPath = baby
    ? "M54 226 Q48 216 50 204 L32 198 L52 188 Q56 176 66 164 L50 154 L70 148 " +
      "Q86 137 104 133 L98 122 L114 125 Q128 119 142 125 L158 122 L152 133 " +
      "Q170 137 186 148 L206 154 L190 164 Q200 176 204 188 L224 198 L204 204 " +
      "Q206 216 200 226 Q128 237 54 226 Z"
    : "M62 224 Q56 214 58 203 L42 197 L60 188 Q64 176 72 165 L58 155 L76 150 " +
      "Q92 139 108 135 L102 124 L116 127 Q128 121 140 127 L154 124 L148 135 " +
      "Q164 139 180 150 L198 155 L184 165 Q192 176 196 188 L214 197 L198 203 " +
      "Q200 214 194 224 Q128 238 62 224 Z";

  const face = baby
    ? { cy: 185, rx: 40, ry: 34, eyeCy: 179, eyeDx: 20, eyeR: 8.5, noseCy: 191, noseR: 5, mouthY: 203, mouthW: 14, browY: 167, blushDx: 28, blushCy: 199, cheekY: 199 }
    : { cy: 181, rx: 36, ry: 30, eyeCy: 175, eyeDx: 18, eyeR: 8, noseCy: 186, noseR: 4.5, mouthY: 197, mouthW: 12, browY: 164, blushDx: 26, blushCy: 194, cheekY: 194 };

  return (
    <Part name="body" origin="50% 100%">
      {/* 绒毛尾球（左后方贴地探出，避开摊平的手臂） */}
      <g transform={baby ? "translate(48 204) rotate(-10)" : "translate(56 200) rotate(-12)"}>
        <Part name="tail" origin="90% 90%">{slots.tail ?? <TailFluff color={palette.body} />}</Part>
      </g>
      {/* 背部槽：冰晶仍从趴下的背上探出（避开头顶槽） */}
      <g transform={baby ? "translate(178 152) rotate(34)" : "translate(180 154) rotate(40)"}>
        <Part name="back" origin="50% 80%">{slots.back ?? <IceSpikes count={3} scale={0.8} color={palette.accent} highlight={palette.belly} />}</Part>
      </g>
      {/* 压扁放倒的毛绒主形 */}
      <path d={bodyPath} fill={palette.body} stroke={OUTLINE} strokeWidth={6} strokeLinejoin="round" />
      {/* 下身柔影 */}
      <ellipse cx={128} cy={baby ? 216 : 213} rx={baby ? 58 : 50} ry={baby ? 9 : 8} fill={palette.deep} opacity={0.22} />
      {/* marking 槽：默认深色毛须纹（趴姿在下颌两侧） */}
      {slots.marking ?? <FurStreaks cx={128} y={baby ? 206 : 202} color={palette.deep} />}
      {/* 脸贴近地面朝观众：脸补丁在低位 */}
      <ellipse cx={128} cy={face.cy} rx={face.rx} ry={face.ry} fill={palette.belly} />
      <g className="part-face">
        <g stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" fill="none">
          <path d={`M${128 - face.eyeDx - 8} ${face.browY} q8 -3 15 -1`} />
          <path d={`M${128 + face.eyeDx + 8} ${face.browY} q-8 -3 -15 -1`} />
        </g>
        <ExpFace
          cx1={128 - face.eyeDx}
          cx2={128 + face.eyeDx}
          cy={face.eyeCy}
          r={face.eyeR}
          mouthY={0}
          expression={expression}
          base={eyes}
          withMouth={false}
        />
        {/* 深青圆鼻 + 高冷平嘴（睡着也一脸淡定） */}
        <circle cx={128} cy={face.noseCy} r={face.noseR} fill={nose} stroke={OUTLINE} strokeWidth={3} />
        <path d={`M${128 - face.mouthW / 2} ${face.mouthY} h${face.mouthW}`} stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
        <Blush cx1={128 - face.blushDx} cx2={128 + face.blushDx} cy={face.blushCy} />
        {slots.cheeks && (
          <g transform={`translate(128 ${face.cheekY})`}>
            <Part name="cheeks" origin="50% 50%">{slots.cheeks}</Part>
          </g>
        )}
      </g>
      {/* 两条大手臂向前伸直、横放摊在地面两侧（爪朝前） */}
      <g transform={baby ? "translate(90 197) rotate(72)" : "translate(102 203) rotate(74)"}>
        <Part name="armL" origin="74% 2%">
          <YetiArm palette={palette} mirror scale={baby ? 0.68 : 0.55} />
        </Part>
      </g>
      <g transform={baby ? "translate(166 197) rotate(-72)" : "translate(154 203) rotate(-74)"}>
        <Part name="armR" origin="26% 2%">
          <YetiArm palette={palette} scale={baby ? 0.68 : 0.55} />
        </Part>
      </g>
      {/* 头顶槽：立毛冰晶在趴下后的头顶（主形顶点） */}
      <g transform={`translate(128 ${baby ? 125 : 127})`}>
        <Part name="headtop" origin="50% 100%">{slots.headTop ?? <TuftCrystal palette={palette} />}</Part>
      </g>
      {/* 座台槽画在最前：浮冰边缘压住身体底缘 = 趴在浮冰上睡 */}
      {slots.platform && (
        <g transform="translate(128 231)">
          <Part name="platform" origin="50% 0%">{slots.platform}</Part>
        </g>
      )}
    </Part>
  );
}

// =============================== 侧面（朝右） ===============================

function YetiSide({ stage, palette, slots = {}, eyes = "sleepy", expression = "normal" }: RigProps) {
  const baby = stage === "baby";
  const nose = deepTint(palette);

  // 毛绒梯形侧影：背侧（左）3 毛尖 + 顶部小耳簇；前侧（右）脸段是圆润口鼻弧
  // （圆鼻与正视一致、不出尖），毛尖只留在下巴以下（胸口 + 前下摆 2 处）
  const bodyPath = baby
    ? "M62 210 Q64 196 66 184 L48 176 L68 162 Q70 150 74 136 L58 128 L78 116 " +
      "Q80 104 86 92 L72 82 L92 74 Q96 62 108 56 L102 44 L120 46 Q142 44 158 60 " +
      "Q170 72 176 88 Q184 98 183 112 Q180 122 176 130 L192 138 L181 148 " +
      "Q184 152 184 156 L196 164 L186 174 Q190 190 190 210 Q128 220 62 210 Z"
    : "M70 204 Q72 186 76 170 L60 162 L78 148 Q80 136 84 120 L70 112 L88 100 " +
      "Q90 88 96 78 L84 68 L102 62 Q112 44 134 46 Q154 48 166 64 Q176 78 179 94 " +
      "Q179 106 174 116 L189 124 L178 134 Q186 146 188 166 L198 174 L188 182 " +
      "Q192 194 192 204 Q128 212 70 204 Z";

  const face = baby
    ? { cx: 142, cy: 102, r: 32, eyeCx: 148, eyeCy: 96, eyeR: 9, noseCx: 172, noseCy: 106, noseR: 5, mouthX: 162, mouthY: 118, mouthW: 9, browX: 138, browY: 82, blushCx: 132, blushCy: 120, breathX: 186, breathY: 114 }
    : { cx: 144, cy: 90, r: 28, eyeCx: 149, eyeCy: 86, eyeR: 8, noseCx: 169, noseCy: 96, noseR: 4.5, mouthX: 160, mouthY: 107, mouthW: 8, browX: 140, browY: 74, blushCx: 134, blushCy: 108, breathX: 182, breathY: 106 };

  const legY = baby ? { top: 194, foot: 226 } : { top: 186, foot: 226 };

  return (
    <Part name="body" origin="50% 100%">
      {/* 绒毛尾球（背后） */}
      <g transform={baby ? "translate(66 196) rotate(-14)" : "translate(74 188) rotate(-14)"}>
        <Part name="tail" origin="90% 90%">{slots.tail ?? <TailFluff color={palette.body} />}</Part>
      </g>
      {/* 背部槽：小冰晶沿上背探出 */}
      <g transform={baby ? "translate(90 86) rotate(-34)" : "translate(94 90) rotate(-34)"}>
        <Part name="back" origin="50% 80%">{slots.back ?? <IceSpikes count={3} scale={0.75} color={palette.accent} highlight={palette.belly} />}</Part>
      </g>
      {/* 两条短粗腿（侧视迈步主角） */}
      <g transform="translate(100 0)">
        <Part name="legL" origin="50% 12%">
          <path d={`M-9 ${legY.top} h18 v${legY.foot - legY.top - 10} q0 5 -9 5 q-9 0 -9 -5 z`} fill={palette.body} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
          <ellipse cx={5} cy={legY.foot} rx={13} ry={6.5} fill={palette.deep} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform="translate(148 0)">
        <Part name="legR" origin="50% 12%">
          <path d={`M-9 ${legY.top} h18 v${legY.foot - legY.top - 10} q0 5 -9 5 q-9 0 -9 -5 z`} fill={palette.body} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
          <ellipse cx={5} cy={legY.foot} rx={13} ry={6.5} fill={palette.deep} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 毛绒梯形侧影 */}
      <path d={bodyPath} fill={palette.body} stroke={OUTLINE} strokeWidth={6} strokeLinejoin="round" />
      <ellipse cx={128} cy={baby ? 198 : 190} rx={48} ry={10} fill={palette.deep} opacity={0.22} />
      {slots.marking ?? <FurStreaks cx={124} y={baby ? 178 : 166} color={palette.deep} />}
      {!baby && (
        <g transform="translate(130 203)">
          <FurRidge width={104} teeth={7} depth={10} color={palette.body} />
        </g>
      )}
      {/* 侧脸补丁大底色（留在 part-face 外） */}
      <ellipse cx={face.cx} cy={face.cy} rx={face.r} ry={face.r} fill={palette.belly} />
      {/* 五官：单眼表情库；normal 高冷特例 = 平眉 + 半合眼 + 自绘平嘴 */}
      <g className="part-face">
        <path d={`M${face.browX} ${face.browY} q8 -3 14 0`} stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" fill="none" />
        <ExpSideFace
          cx={face.eyeCx}
          cy={face.eyeCy}
          r={face.eyeR}
          mouthX={face.mouthX + face.mouthW / 2}
          mouthY={face.mouthY}
          mouthW={face.mouthW}
          expression={expression}
          base={eyes}
          withMouth={expression !== "normal"}
        />
        {/* 深青圆鼻：与正视同款圆点，贴在脸补丁前缘、嘴上方 */}
        <circle cx={face.noseCx} cy={face.noseCy} r={face.noseR} fill={nose} stroke={OUTLINE} strokeWidth={3} />
        {expression === "normal" && (
          <path d={`M${face.mouthX} ${face.mouthY} h${face.mouthW}`} stroke={OUTLINE} strokeWidth={4} strokeLinecap="round" />
        )}
        <ellipse cx={face.blushCx} cy={face.blushCy} rx={9} ry={5.5} fill="#F5917B" opacity={0.55} />
      </g>
      <g transform={`translate(${face.breathX} ${face.breathY})`}>
        <FrostBreath color={palette.accent} />
      </g>
      {/* 近侧大臂（从肩部垂下，前后甩的主角；肩点在脸补丁下方避免挡嘴） */}
      <g transform={baby ? "translate(152 128)" : "translate(152 118)"}>
        <Part name="armR" origin="26% 2%">
          <YetiArm palette={palette} scale={baby ? 0.85 : 0.8} />
        </Part>
      </g>
      {/* 头顶槽 */}
      <g transform={baby ? "translate(122 56)" : "translate(126 52)"}>
        <Part name="headtop" origin="50% 100%">{slots.headTop ?? <TuftCrystal palette={palette} />}</Part>
      </g>
    </Part>
  );
}
