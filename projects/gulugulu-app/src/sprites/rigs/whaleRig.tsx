import { OUTLINE, type RigProps } from "../rigTypes";
import { Blush, Part } from "../parts/common";
import { ExpFace, ExpSideFace } from "../parts/faces";
import { BellyWave, Flippers, Fluke, SideFlipper, Spout } from "../kits/waterKit";

// -----------------------------------------------------------------------------
// 鲸底座（bubblefrog 泡泡鲸 / 水系家族的基体）——漂浮物种（无腿）。
// 剪影：悬浮的宽胶囊（仍是全阵容最宽最圆）+ 鲸鱼体型语言：
//   - 右后方伸出上翘的尾柄，末端立起一片大尾鳍（鲸鱼翘尾巴）；
//     尾柄画在 rig 里，slots.tail 装在尾柄末端（闪电尾等替换件继续可用）。
//   - 顶部右段微拱 = 背脊，配一道很淡的头身分界弧线（暗示大头+背部）。
//   - 肚皮补丁上下 3 道弧形腹沟线（鲸鱼喉腹褶）。
// 身体底部悬在 y≈210（地面 233，影子由装配器画，留出悬浮空隙）。
// baby：整只 = 一颗头，超宽圆胶囊（~190×110），五官直接在胶囊正面；
// kid：胶囊拉长、体腔更修长（~170×130），脸部占比缩小到 40-50% 观感。
// 默认件=喷水柱(headTop)/大尾鳍(tail)/浅色水斑(marking)，slots 可替换。
// 表情：眼+嘴都走 ExpFace / ExpSideFace（withMouth=true，通用嘴）。
// -----------------------------------------------------------------------------

export function WhaleRig(props: RigProps) {
  if (props.view === "side") return <WhaleSide {...props} />;
  if (props.pose === "lie") return <WhaleLieFront {...props} />;
  return <WhaleFront {...props} />;
}

function WhaleFront({ stage, palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  const baby = stage === "baby";

  // 胶囊主形（baby 超宽圆 190×110；kid 拉长 170×130），底部都悬在 y=210；
  // 顶部右段控制点抬高 → 背脊微拱（整体宽度不变，仍最宽）
  const bodyPath = baby
    ? "M33 155 C33 121 68 100 128 100 C182 82 223 121 223 155 C223 189 188 210 128 210 C68 210 33 189 33 155 Z"
    : "M43 145 C43 106 76 80 128 80 C176 66 213 106 213 145 C213 182 184 210 128 210 C72 210 43 182 43 145 Z";
  // 尾柄：根部埋在胶囊右后方（被身体盖住），向右上翘出、越过肩线，
  // 尖端 = slots.tail 的安装点
  const tailStock = baby
    ? "M180 190 C218 186 242 162 238 128 C236 115 227 104 214 98 L199 107 C206 132 195 152 170 164 Z"
    : "M174 186 C208 182 232 158 228 124 C226 112 217 101 205 95 L190 104 C197 128 187 148 162 160 Z";
  const stockLine = baby ? "M216 164 Q228 140 226 118" : "M208 158 Q220 134 218 112";
  const tailMount = baby
    ? "translate(207 105) scale(-1 1) rotate(10)"
    : "translate(197 102) scale(-1 1) rotate(10)";
  const topY = baby ? 100 : 80;
  const eyeDx = baby ? 30 : 26;
  const eyeY = baby ? 146 : 122;
  const eyeR = baby ? 10 : 9;
  const mouthY = baby ? 166 : 140;
  const blushDx = baby ? 52 : 46;
  const blushY = baby ? 162 : 136;
  const finY = baby ? 164 : 156;
  const finL = baby ? 46 : 51;
  const finR = baby ? 211 : 206;

  return (
    <Part name="body" origin="50% 100%">
      {/* 立起的大尾：尾柄（rig 自绘）+ 尾鳍槽（默认大 Fluke；闪电尾等装在尾柄末端） */}
      <path d={tailStock} fill={palette.body} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
      <path d={stockLine} stroke={palette.deep} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.25} />
      <g transform={tailMount}>
        <Part name="tail" origin="100% 92%">
          {slots.tail ?? (
            <g transform="rotate(25)">
              <Fluke color={palette.body} deep={palette.deep} scale={baby ? 1.35 : 1.45} />
            </g>
          )}
        </Part>
      </g>
      {/* 背部槽 */}
      {slots.back && (
        <g transform={`translate(128 ${topY + 16})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 胶囊身体（整只就是一颗头） */}
      <path d={bodyPath} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      {/* 顶部水光高光 */}
      <path
        d={baby ? "M66 124 Q84 108 108 104" : "M74 108 Q90 92 112 88"}
        stroke={palette.belly}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
        opacity={0.5}
      />
      {/* 头身分界：背脊下一道很淡的弧线（大头 + 背部） */}
      <path
        d={baby ? "M172 100 Q190 120 196 144" : "M164 82 Q184 102 190 126"}
        stroke={palette.deep}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={0.2}
      />
      {/* 水斑（marking 槽默认件） */}
      {slots.marking ?? (
        <g fill={palette.belly}>
          <circle cx={baby ? 84 : 86} cy={baby ? 126 : 108} r={baby ? 8.5 : 8} opacity={0.4} />
          <circle cx={baby ? 170 : 166} cy={baby ? 117 : 100} r={5.5} opacity={0.32} />
        </g>
      )}
      {/* 大肚皮补丁（波浪顶边） */}
      <g transform={`translate(128 ${baby ? 190 : 186})`}>
        <BellyWave color={palette.belly} wave={palette.accent} />
      </g>
      {/* 腹沟纹（鲸鱼喉腹褶）：横跨肚皮的三道弧线 */}
      <g stroke={palette.deep} strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.3}>
        {baby ? (
          <>
            <path d="M86 176 Q128 185 170 176" />
            <path d="M92 190 Q128 199 164 190" />
            <path d="M102 202 Q128 209 154 202" />
          </>
        ) : (
          <>
            <path d="M88 174 Q128 183 168 174" />
            <path d="M94 187 Q128 196 162 187" />
            <path d="M104 199 Q128 206 152 199" />
          </>
        )}
      </g>
      {/* 一对小侧鳍（armL/armR，打工/庆祝会挥） */}
      <g transform={`translate(${finL} ${finY})`}>
        <Part name="armL" origin="92% 10%">
          <Flippers mirror color={palette.body} />
        </Part>
      </g>
      <g transform={`translate(${finR} ${finY})`}>
        <Part name="armR" origin="8% 10%">
          <Flippers color={palette.body} />
        </Part>
      </g>
      {/* 脸（表情库：normal 回落 happy 弯月眼；嘴用通用表情嘴） */}
      <g className="part-face">
        <ExpFace
          cx1={128 - eyeDx}
          cx2={128 + eyeDx}
          cy={eyeY}
          r={eyeR}
          mouthY={mouthY}
          mouthW={baby ? 16 : 15}
          expression={expression}
          base={eyes}
        />
        <Blush cx1={128 - blushDx} cx2={128 + blushDx} cy={blushY} />
        {slots.cheeks && (
          <g transform={`translate(128 ${blushY})`}>
            <Part name="cheeks" origin="50% 50%">{slots.cheeks}</Part>
          </g>
        )}
      </g>
      {/* 头顶槽（默认喷水柱） */}
      <g transform={`translate(128 ${topY + 2})`}>
        <Part name="headtop" origin="50% 100%">
          {slots.headTop ?? <Spout nozzle={palette.deep} scale={baby ? 1 : 1.1} />}
        </Part>
      </g>
      {/* 工具（工作状态淡入）：拖把斜靠在右侧鳍旁 */}
      {slots.tool && (
        <g transform="translate(196 227)">
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

function WhaleSide({ stage, palette, slots = {}, eyes = "happy", expression = "normal" }: RigProps) {
  const baby = stage === "baby";

  // 侧视胶囊（鲸朝右）：头端在右侧圆润，左侧收成小尾柄（kid 更明显）
  const bodyPath = baby
    ? "M58 160 C60 124 96 100 146 100 C192 100 218 124 218 154 C218 184 190 206 146 208 C104 210 64 194 58 172 C57 168 57 164 58 160 Z"
    : "M50 158 C56 122 96 92 148 92 C196 92 220 118 220 150 C220 182 194 206 150 208 C112 210 76 200 60 182 C53 174 49 166 50 158 Z";
  const eyeX = baby ? 182 : 184;
  const eyeY = baby ? 138 : 130;
  const spoutX = baby ? 162 : 166;
  const spoutY = baby ? 102 : 94;

  return (
    <Part name="body" origin="50% 100%">
      {/* 尾鳍在左后方（移动时 CSS 拍打 part-tail，pivot=尾根） */}
      <g transform={baby ? "translate(64 172) rotate(6)" : "translate(56 170) rotate(4)"}>
        <Part name="tail" origin="100% 92%">{slots.tail ?? <Fluke color={palette.body} deep={palette.deep} scale={baby ? 1 : 1.05} />}</Part>
      </g>
      {slots.back && (
        <g transform={`translate(${baby ? 120 : 122} ${baby ? 110 : 102})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 身体 */}
      <path d={bodyPath} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      {/* 顶部水光高光 */}
      <path
        d={baby ? "M96 122 Q112 106 136 103" : "M94 116 Q112 98 138 95"}
        stroke={palette.belly}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
        opacity={0.5}
      />
      {/* 水斑（marking 槽默认件） */}
      {slots.marking ?? (
        <g fill={palette.belly}>
          <circle cx={baby ? 112 : 110} cy={baby ? 126 : 120} r={8} opacity={0.4} />
          <circle cx={baby ? 152 : 152} cy={baby ? 114 : 106} r={5} opacity={0.32} />
        </g>
      )}
      {/* 肚皮补丁（偏向身前/右下） */}
      <g transform={`translate(${baby ? 152 : 156} ${baby ? 188 : 186})`}>
        <BellyWave color={palette.belly} wave={palette.accent} scale={0.9} />
      </g>
      {/* 近侧侧鳍（armR：打工挥动主角） */}
      <g transform={`translate(${baby ? 154 : 156} ${baby ? 164 : 160}) rotate(-8)`}>
        <Part name="armR" origin="94% 20%">
          <SideFlipper color={palette.body} />
        </Part>
      </g>
      {/* 脸（表情库单眼 + 通用表情嘴 + 腮红） */}
      <g className="part-face">
        <ExpSideFace
          cx={eyeX}
          cy={eyeY}
          r={baby ? 9.5 : 9}
          mouthX={baby ? 195 : 197}
          mouthY={baby ? 155 : 149}
          mouthW={12}
          expression={expression}
          base={eyes}
        />
        <ellipse cx={baby ? 172 : 174} cy={baby ? 157 : 151} rx={9} ry={5.5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 头顶槽（默认喷水柱，微微后倾） */}
      <g transform={`translate(${spoutX} ${spoutY}) rotate(4)`}>
        <Part name="headtop" origin="50% 100%">
          {slots.headTop ?? <Spout nozzle={palette.deep} scale={baby ? 1 : 1.1} />}
        </Part>
      </g>
    </Part>
  );
}

/** 睡眠搁浅式贴地：取消悬浮，胶囊略压扁摊宽、底缘贴地（y≈231）；
 *  侧鳍摊平贴地，立起的大尾放低放平拖在地上，喷水柱只剩微弱小水滴。 */
function WhaleLieFront({ stage, palette, slots = {}, eyes = "happy", expression = "sleep" }: RigProps) {
  const baby = stage === "baby";

  // 贴地胶囊（压扁摊宽，底缘 231；顶部右段仍微拱出背脊）
  const bodyPath = baby
    ? "M30 186 C30 156 66 142 128 142 C186 128 226 156 226 186 C226 214 188 231 128 231 C68 231 30 214 30 186 Z"
    : "M38 178 C38 140 72 122 128 122 C180 108 218 140 218 178 C218 211 186 231 128 231 C72 231 38 211 38 178 Z";
  // 放平的尾柄：贴着地面从右后方伸出
  const tailStock = baby
    ? "M166 194 C206 190 226 202 224 220 C222 228 212 231 200 230 L166 224 Z"
    : "M158 192 C196 188 214 200 212 218 C210 226 200 229 190 228 L158 222 Z";
  const stockLine = baby ? "M200 200 Q216 206 217 218" : "M186 198 Q202 204 203 216";
  // 尾鳍装在放低的尾柄末端，转到贴地放平的角度（探出身体轮廓可见）
  const tailMount = baby
    ? "translate(204 218) scale(-1 1) rotate(-58)"
    : "translate(192 216) scale(-1 1) rotate(-58)";
  const topY = baby ? 142 : 122;
  const eyeDx = baby ? 30 : 26;
  const eyeY = baby ? 178 : 162;
  const mouthY = baby ? 197 : 182;
  const blushDx = baby ? 52 : 46;
  const blushY = baby ? 192 : 176;

  return (
    <Part name="body" origin="50% 100%">
      {/* 放平的大尾：低矮尾柄 + 贴地尾鳍（闪电尾等替换件同样放平拖地） */}
      <path d={tailStock} fill={palette.body} stroke={OUTLINE} strokeWidth={5} strokeLinejoin="round" />
      <path d={stockLine} stroke={palette.deep} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.25} />
      <g transform={tailMount}>
        <Part name="tail" origin="100% 92%">
          {slots.tail ?? (
            <g transform="rotate(25)">
              <Fluke color={palette.body} deep={palette.deep} scale={baby ? 1 : 0.85} />
            </g>
          )}
        </Part>
      </g>
      {/* 背部槽（乌云/浪花等悬在趴姿上方） */}
      {slots.back && (
        <g transform={`translate(128 ${topY + 14})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 贴地胶囊身体 */}
      <path d={bodyPath} fill={palette.body} stroke={OUTLINE} strokeWidth={6} />
      {/* 顶部水光高光 */}
      <path
        d={baby ? "M62 166 Q80 150 106 146" : "M66 148 Q84 130 108 126"}
        stroke={palette.belly}
        strokeWidth={5}
        strokeLinecap="round"
        fill="none"
        opacity={0.5}
      />
      {/* 头身分界弧线 */}
      <path
        d={baby ? "M172 142 Q190 162 196 186" : "M164 122 Q184 142 190 166"}
        stroke={palette.deep}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={0.2}
      />
      {/* 水斑（marking 槽默认件） */}
      {slots.marking ?? (
        <g fill={palette.belly}>
          <circle cx={baby ? 84 : 86} cy={baby ? 168 : 150} r={baby ? 8.5 : 8} opacity={0.4} />
          <circle cx={baby ? 168 : 164} cy={baby ? 158 : 142} r={5.5} opacity={0.32} />
        </g>
      )}
      {/* 大肚皮补丁（贴地摊开） */}
      <g transform={`translate(128 ${baby ? 208 : 206})`}>
        <BellyWave color={palette.belly} wave={palette.accent} />
      </g>
      {/* 腹沟纹（保留鲸鱼喉腹褶） */}
      <g stroke={palette.deep} strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.3}>
        {baby ? (
          <>
            <path d="M84 196 Q128 205 172 196" />
            <path d="M92 209 Q128 218 164 209" />
            <path d="M102 220 Q128 227 154 220" />
          </>
        ) : (
          <>
            <path d="M86 192 Q128 201 170 192" />
            <path d="M94 205 Q128 214 162 205" />
            <path d="M102 217 Q128 224 154 217" />
          </>
        )}
      </g>
      {/* 侧鳍摊平贴地（向外摊开搁在地面上） */}
      <g transform={baby ? "translate(80 221) rotate(58)" : "translate(84 219) rotate(58)"}>
        <Part name="armL" origin="92% 10%">
          <Flippers mirror color={palette.body} />
        </Part>
      </g>
      <g transform={baby ? "translate(176 221) rotate(-58)" : "translate(172 219) rotate(-58)"}>
        <Part name="armR" origin="8% 10%">
          <Flippers color={palette.body} />
        </Part>
      </g>
      {/* 脸：闭眼 + 小口 */}
      <g className="part-face">
        <ExpFace
          cx1={128 - eyeDx}
          cx2={128 + eyeDx}
          cy={eyeY}
          r={baby ? 10 : 9}
          mouthY={mouthY}
          mouthW={baby ? 16 : 15}
          expression={expression}
          base={eyes}
        />
        <Blush cx1={128 - blushDx} cx2={128 + blushDx} cy={blushY} />
        {slots.cheeks && (
          <g transform={`translate(128 ${blushY})`}>
            <Part name="cheeks" origin="50% 50%">{slots.cheeks}</Part>
          </g>
        )}
      </g>
      {/* 头顶槽：默认件缩小微垂成"微弱小水滴"；替换件（乌云等）悬在趴姿上方 */}
      <g transform={`translate(128 ${topY + 2})`}>
        <Part name="headtop" origin="50% 100%">
          {slots.headTop ?? (
            <g transform="rotate(14)">
              <Spout nozzle={palette.deep} scale={(baby ? 1 : 1.1) * 0.62} />
            </g>
          )}
        </Part>
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
