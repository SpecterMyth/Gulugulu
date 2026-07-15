import { OUTLINE, type RigProps } from "../rigTypes";
import { Blush, Part } from "../parts/common";
import { ExpFace, ExpSideFace } from "../parts/faces";
import { CapSpots, GillSkirt, MushroomCap, Sprout } from "../kits/grassKit";

// -----------------------------------------------------------------------------
// 蘑菇底座（sproutcap 嫩芽菇 / 菇林兽 mycobeast / 烬叶菇 cinderleaf /
// 霜霜兔 frostbunny 的基体）。
// 剪影：一顶占画面 2/3 的大圆顶伞帽 + 帽下一小截奶白菌柄（脸长在菌柄上，
// 眼睛贴着帽檐下缘）。帽子是身体主形的一部分（画在 part-body 里，走路跟着
// 颠），不占 headTop 槽；headTop 槽默认件是帽顶嫩芽 Sprout。
// baby：帽=头（宽~176），菌柄=脸，小圆点脚尖；kid：菌柄长高成小身体，
// 露出短手短腿，帽缩到 ~0.72 仍是主角。
// 主线集成：SvgSprite.tsx 里 RIGS.mushroom = MushroomRig。
// 表情：眼睛+嘴走 ExpFace/ExpSideFace（帽檐半遮眼的位置不变）。
// pose="lie"：盖着自己的帽子睡（菌柄趴成矮扁团 + 菌帽滑落盖住大半张脸）。
// -----------------------------------------------------------------------------

export function MushroomRig(props: RigProps) {
  if (props.view === "side") return <MushroomSide {...props} />;
  if (props.pose === "lie") return <MushroomLieFront {...props} />;
  return <MushroomFront {...props} />;
}

/** 短手臂（kid）。局部坐标，pivot=(0,0)=肩点，向下垂。mirror 用于左臂。 */
function StubArm({ color, mirror = false }: { color: string; mirror?: boolean }) {
  return (
    <g transform={mirror ? "scale(-1 1)" : undefined}>
      <path
        d="M0 0 C9 2 13 10 11 20 C10 26 4 28 -1 25 C-6 18 -7 8 -4 2 Z"
        fill={color}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
    </g>
  );
}

function MushroomFront({ stage, palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  const baby = stage === "baby";
  // 帽底中心（rim）与缩放：baby 帽宽 176（rim y=166，顶 y≈70）；
  // kid 帽宽 ~127（rim y=130，顶 y≈62），帽占比降到 ~45%。
  const capRimY = baby ? 166 : 130;
  const capScale = baby ? 1 : 0.72;
  const capTopY = baby ? 74 : 64;
  const eyeY = baby ? 181 : 144;
  const eyeDx = baby ? 14 : 16;
  const eyeR = baby ? 7.5 : 7;
  const mouthY = baby ? 194 : 156;
  const blushY = baby ? 197 : 159;
  const blushDx = baby ? 20 : 22;

  // 菌柄：baby=帽下一小截脸；kid=长高的小身体（顶部藏在帽下）
  const stalkD = baby
    ? "M101 158 L101 210 Q101 228 128 228 Q155 228 155 210 L155 158 Z"
    : "M94 152 Q94 116 128 116 Q162 116 162 152 L162 188 Q162 218 128 218 Q94 218 94 188 Z";

  return (
    <Part name="body" origin="50% 100%">
      {/* 尾巴槽（蘑菇默认无尾，二阶可挂藤尾等） */}
      {slots.tail && (
        <g transform={baby ? "translate(98 214) rotate(-10)" : "translate(94 202) rotate(-10)"}>
          <Part name="tail" origin="90% 90%">{slots.tail}</Part>
        </g>
      )}
      {/* 背部槽 */}
      {slots.back && (
        <g transform={`translate(128 ${baby ? 168 : 148})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 菌柄（脸/身体） */}
      <path d={stalkD} fill={palette.belly} stroke={OUTLINE} strokeWidth={6} strokeLinejoin="round" />
      {/* 腿脚：baby 小圆点脚尖；kid 短腿 + 圆脚 */}
      <g transform="translate(113 0)">
        <Part name="legL" origin="50% -30%">
          {!baby && <path d="M0 210 q-1 8 0 12" stroke={palette.belly} strokeWidth={8} strokeLinecap="round" fill="none" />}
          <ellipse cx={0} cy={baby ? 228 : 226} rx={baby ? 7.5 : 11} ry={baby ? 4.5 : 6.5} fill={baby ? palette.belly : palette.accent} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform="translate(143 0)">
        <Part name="legR" origin="50% -30%">
          {!baby && <path d="M0 210 q1 8 0 12" stroke={palette.belly} strokeWidth={8} strokeLinecap="round" fill="none" />}
          <ellipse cx={0} cy={baby ? 228 : 226} rx={baby ? 7.5 : 11} ry={baby ? 4.5 : 6.5} fill={baby ? palette.belly : palette.accent} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 短手（kid 才有） */}
      {!baby && (
        <>
          <g transform="translate(96 160)">
            <Part name="armL" origin="80% 5%">
              <StubArm mirror color={palette.belly} />
            </Part>
          </g>
          <g transform="translate(160 160)">
            <Part name="armR" origin="20% 5%">
              <StubArm color={palette.belly} />
            </Part>
          </g>
        </>
      )}
      {/* 脸（长在菌柄上；眼睛贴着帽檐下缘，被帽檐半遮出害羞感） */}
      <g className="part-face">
        <ExpFace
          cx1={128 - eyeDx}
          cx2={128 + eyeDx}
          cy={eyeY}
          r={eyeR}
          mouthY={mouthY}
          mouthW={11}
          expression={expression}
          base={eyes}
          withMouth
        />
        <Blush cx1={128 - blushDx} cx2={128 + blushDx} cy={blushY} />
        {slots.cheeks && (
          <g transform={`translate(128 ${blushY})`}>
            <Part name="cheeks" origin="50% 50%">{slots.cheeks}</Part>
          </g>
        )}
      </g>
      {/* 大菌帽（身体主形，画在脸之后 → 帽檐盖住眼睛上缘） */}
      <g transform={`translate(128 ${capRimY})`}>
        <MushroomCap scale={capScale} color={palette.body} deep={palette.deep} outlineWidth={6 / capScale}>
          <GillSkirt color={palette.deep} />
        </MushroomCap>
      </g>
      {/* marking 槽：默认帽面圆斑 */}
      {slots.marking ?? (
        <g transform={`translate(128 ${capRimY}) scale(${capScale})`}>
          <CapSpots color={palette.belly} accent={palette.accent} />
        </g>
      )}
      {/* 头顶槽：默认帽顶嫩芽（idle 轻摇由 .part-headtop 驱动） */}
      <g transform={`translate(128 ${capTopY})`}>
        <Part name="headtop" origin="50% 100%">{slots.headTop ?? <Sprout color={palette.accent} />}</Part>
      </g>
      {/* 座台槽（脚下） */}
      {slots.platform && (
        <g transform="translate(128 232)">
          <Part name="platform" origin="50% 0%">{slots.platform}</Part>
        </g>
      )}
      {/* 工具（只在 front 渲染；工作状态淡入），摆在右前方地面 */}
      {slots.tool && (
        <g transform="translate(192 226)">
          <Part name="tool" origin="50% 100%">{slots.tool}</Part>
        </g>
      )}
    </Part>
  );
}

/** 睡眠趴地（盖着自己的帽子睡，非旋转倒下）：菌柄小身体趴成矮扁面包团
 *  贴地，大菌帽从头顶滑落盖住大半张脸——帽檐压到眼睛位置，只露出下半张
 *  脸（闭眼睫毛/小嘴/腮红从帽檐下探出来）；帽顶件耷拉着歪向一边。 */
function MushroomLieFront({ stage, palette, slots = {}, eyes = "round", expression = "sleep" }: RigProps) {
  const baby = stage === "baby";
  const capScale = baby ? 1 : 0.72;
  /** 站姿帽底 y（自定义 marking 以站姿全局坐标作画，见 markingT） */
  const standRimY = baby ? 166 : 130;
  /** 滑落后的帽底 y：帽檐波浪边正好压到眼睛位置 */
  const capRimY = baby ? 192 : 193;
  const capTilt = -7;
  const capSquash = 0.9;
  /** 帽放置：滑落 + 向左微歪 + 轻压扁（放松感） */
  const capT = `translate(128 ${capRimY}) rotate(${capTilt}) scale(1 ${capSquash})`;
  /** 把站姿全局坐标映射到滑落后的帽坐标系：自定义帽斑（霜斑/冰凌/焦点/
   *  火星）跟着帽走，保持与帽的相对位置（站/躺 capScale 相同故可约去） */
  const markingT = `${capT} translate(-128 ${-standRimY})`;
  /** 帽顶点 = capT 作用于帽局部 (0, -94·capScale)（手算取整）；-20° 耷拉角 */
  const topX = baby ? 118 : 121;
  const topY = baby ? 108 : 133;

  const eyeY = baby ? 200 : 202;
  const eyeDx = baby ? 14 : 16;
  const mouthY = baby ? 212 : 213;
  const blushY = baby ? 213 : 214;
  const blushDx = baby ? 20 : 22;

  // 趴倒的菌柄：矮扁面包团贴地（顶部藏进帽子里）
  const stalkD = baby
    ? "M78 230 L78 208 Q78 180 128 180 Q178 180 178 208 L178 230 Z"
    : "M74 230 L74 210 Q74 184 128 184 Q182 184 182 210 L182 230 Z";
  const footRx = baby ? 7.5 : 10;
  const footRy = baby ? 4.5 : 5.5;
  const footDx = baby ? 52 : 58;
  const footColor = baby ? palette.belly : palette.accent;

  return (
    <Part name="body" origin="50% 100%">
      {/* 尾巴槽（如余烬菇小火焰尾）：贴地横卧在身后 */}
      {slots.tail && (
        <g transform={baby ? "translate(100 222) rotate(-62) scale(0.72)" : "translate(96 221) rotate(-64) scale(0.72)"}>
          <Part name="tail" origin="90% 90%">{slots.tail}</Part>
        </g>
      )}
      {slots.back && (
        <g transform="translate(128 192)">
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 摊平的小脚尖（从团子底边两侧探出，画在菌柄下层） */}
      <g transform={`translate(${128 - footDx} 227) rotate(32)`}>
        <Part name="legL" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={footRx} ry={footRy} fill={footColor} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={`translate(${128 + footDx} 227) rotate(-32)`}>
        <Part name="legR" origin="50% -30%">
          <ellipse cx={0} cy={0} rx={footRx} ry={footRy} fill={footColor} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 菌柄趴团 */}
      <path d={stalkD} fill={palette.belly} stroke={OUTLINE} strokeWidth={6} strokeLinejoin="round" />
      {/* 收在身侧的小手鼓包（kid） */}
      {!baby && (
        <>
          <g transform="translate(80 206)">
            <Part name="armL" origin="80% 20%">
              <path d="M0 0 q-11 4 -9 14 q9 4 14 -3 q2 -8 -5 -11 z" fill={palette.belly} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
            </Part>
          </g>
          <g transform="translate(176 206)">
            <Part name="armR" origin="20% 20%">
              <path d="M0 0 q11 4 9 14 q-9 4 -14 -3 q-2 -8 5 -11 z" fill={palette.belly} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
            </Part>
          </g>
        </>
      )}
      {/* 脸：只露下半张（闭眼睫毛/小嘴/腮红从帽檐下探出来） */}
      <g className="part-face">
        <ExpFace
          cx1={128 - eyeDx}
          cx2={128 + eyeDx}
          cy={eyeY}
          r={baby ? 7.5 : 7}
          mouthY={mouthY}
          mouthW={11}
          expression={expression}
          base={eyes}
          withMouth
        />
        <Blush cx1={128 - blushDx} cx2={128 + blushDx} cy={blushY} />
        {slots.cheeks && (
          <g transform={`translate(128 ${blushY})`}>
            <Part name="cheeks" origin="50% 50%">{slots.cheeks}</Part>
          </g>
        )}
      </g>
      {/* 大菌帽滑落盖脸（画在脸之后 → 帽檐压住眼睛上缘） */}
      <g transform={capT}>
        <MushroomCap scale={capScale} color={palette.body} deep={palette.deep} outlineWidth={6 / capScale}>
          <GillSkirt color={palette.deep} />
        </MushroomCap>
      </g>
      {/* marking 槽：默认帽斑照常；自定义帽斑整体映射到滑落后的帽上 */}
      {slots.marking ? (
        <g transform={markingT}>{slots.marking}</g>
      ) : (
        <g transform={`${capT} scale(${capScale})`}>
          <CapSpots color={palette.belly} accent={palette.accent} />
        </g>
      )}
      {/* 头顶槽：跟着帽顶滑到一侧、耷拉着歪 */}
      <g transform={`translate(${topX} ${topY}) rotate(-20)`}>
        <Part name="headtop" origin="50% 100%">{slots.headTop ?? <Sprout color={palette.accent} />}</Part>
      </g>
      {slots.platform && (
        <g transform="translate(128 232)">
          <Part name="platform" origin="50% 0%">{slots.platform}</Part>
        </g>
      )}
    </Part>
  );
}

function MushroomSide({ stage, palette, slots = {}, eyes = "round", expression = "normal" }: RigProps) {
  const baby = stage === "baby";
  const capRimY = baby ? 166 : 130;
  const capScale = baby ? 1 : 0.72;
  // 嫩芽偏后（-x）一点，侧影更像被风吹着
  const sproutX = baby ? 116 : 122;
  const sproutY = baby ? 76 : 66;

  // 菌柄侧影：底边抬高，给迈步的小脚留位置
  const stalkD = baby
    ? "M101 158 L101 200 Q101 218 128 218 Q155 218 155 200 L155 158 Z"
    : "M96 152 Q96 116 128 116 Q160 116 160 152 L160 184 Q160 212 128 212 Q96 212 96 184 Z";
  const legY = baby ? 220 : 214;
  const footR = baby ? 9.5 : 11;
  const footColor = baby ? palette.belly : palette.accent;

  return (
    <Part name="body" origin="50% 100%">
      {slots.tail && (
        <g transform={baby ? "translate(100 210) rotate(-8)" : "translate(98 200) rotate(-8)"}>
          <Part name="tail" origin="90% 90%">{slots.tail}</Part>
        </g>
      )}
      {slots.back && (
        <g transform={`translate(118 ${baby ? 168 : 148})`}>
          <Part name="back" origin="50% 80%">{slots.back}</Part>
        </g>
      )}
      {/* 菌柄 */}
      <path d={stalkD} fill={palette.belly} stroke={OUTLINE} strokeWidth={6} strokeLinejoin="round" />
      {/* 迈步小脚（侧视行走主角） */}
      <g transform={`translate(114 ${legY})`}>
        <Part name="legL" origin="50% -35%">
          <path d="M0 -6 q-1 7 0 11" stroke={footColor} strokeWidth={7} strokeLinecap="round" fill="none" />
          <ellipse cx={2} cy={5} rx={footR} ry={5} fill={footColor} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      <g transform={`translate(142 ${legY})`}>
        <Part name="legR" origin="50% -35%">
          <path d="M0 -6 q1 7 0 11" stroke={footColor} strokeWidth={7} strokeLinecap="round" fill="none" />
          <ellipse cx={2} cy={5} rx={footR} ry={5} fill={footColor} stroke={OUTLINE} strokeWidth={4.5} />
        </Part>
      </g>
      {/* 单臂（kid，垂在身侧偏后） */}
      {!baby && (
        <g transform="translate(150 174) rotate(-18)">
          <Part name="armR" origin="20% 5%">
            <StubArm color={palette.belly} />
          </Part>
        </g>
      )}
      {/* 脸（单眼，帽檐盖住半张脸；嘴走表情库，别画出菌柄外） */}
      <g className="part-face">
        <ExpSideFace
          cx={baby ? 146 : 142}
          cy={baby ? 185.5 : 146}
          r={7}
          mouthX={baby ? 148 : 145}
          mouthY={baby ? 196 : 156}
          mouthW={9}
          expression={expression}
          base={eyes}
        />
        <ellipse cx={baby ? 134 : 131} cy={baby ? 200 : 160} rx={8.5} ry={5} fill="#F5917B" opacity={0.55} />
      </g>
      {/* 大菌帽侧影（同一圆顶剪影） */}
      <g transform={`translate(128 ${capRimY})`}>
        <MushroomCap scale={capScale} color={palette.body} deep={palette.deep} outlineWidth={6 / capScale}>
          <GillSkirt color={palette.deep} />
        </MushroomCap>
      </g>
      {slots.marking ?? (
        <g transform={`translate(128 ${capRimY}) scale(${capScale})`}>
          <CapSpots color={palette.belly} accent={palette.accent} />
        </g>
      )}
      {/* 头顶嫩芽 */}
      <g transform={`translate(${sproutX} ${sproutY})`}>
        <Part name="headtop" origin="50% 100%">{slots.headTop ?? <Sprout color={palette.accent} />}</Part>
      </g>
      {slots.platform && (
        <g transform="translate(128 232)">
          <Part name="platform" origin="50% 0%">{slots.platform}</Part>
        </g>
      )}
    </Part>
  );
}
