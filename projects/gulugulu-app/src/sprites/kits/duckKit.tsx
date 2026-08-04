import { OUTLINE } from "../rigTypes";

// -----------------------------------------------------------------------------
// 鸭系签名件（normal / guluduck）。局部坐标，pivot 见各件注释。
// 2026-07 返工：突出"鸭子特征"——卷羽尾、带羽缺口的翅膀。
// 头顶返工：黑色发丝呆毛 → 体色小绒羽（雏鸭胎毛），去"人类头发"感。
// 供二阶"元素鸭家族"与咕噜天鹅复用/替换。
// -----------------------------------------------------------------------------

/** 单撮绒羽（胖花瓣形）。pivot=(0,0)=羽根，向上生长，h=高度。 */
export function FluffTuft({ color = "#FFFFFF", h = 22 }: { color?: string; h?: number }) {
  return (
    <path
      d={`M-5 2 C ${-7.2} ${-h * 0.35} ${-4.6} ${-h * 0.8} 0 ${-h} C ${4.6} ${-h * 0.8} ${7.2} ${-h * 0.35} 5 2 Q 0 5.5 -5 2 Z`}
      fill={color}
      stroke={OUTLINE}
      strokeWidth={4.5}
      strokeLinejoin="round"
    />
  );
}

/** 头顶三撮绒羽（中间高两侧低、略外撇）。pivot=(0,0)=羽根中点。 */
export function Ahoge({ color = "#FFFFFF", scale = 1 }: { color?: string; scale?: number }) {
  return (
    <g transform={scale !== 1 ? `scale(${scale})` : undefined}>
      <g transform="translate(-12 3) rotate(-27)"><FluffTuft color={color} h={15} /></g>
      <g transform="translate(12 3) rotate(25)"><FluffTuft color={color} h={14} /></g>
      <FluffTuft color={color} h={22} />
    </g>
  );
}

/** 鸭子招牌上卷尾（黑色）。pivot=(0,0)=尾根，向左上卷起。 */
export function DuckTailFan({ color = "#2E2E36" }: { color?: string }) {
  return (
    <g fill={color} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round">
      <path d="M0 0 q-18 -2 -24 -14 q-4 -9 3 -14 q8 -5 14 1 q-7 1 -6 8 q1 7 9 8 q6 4 4 11 z" />
      <path d="M-4 -6 q-10 -3 -12 -11" fill="none" strokeWidth={2.6} opacity={0.5} />
    </g>
  );
}

/** 羽毛翅膀（带两个羽缺口 + 黑翅尖）。pivot=(0,0)=肩点，翅尖向下。
 *  mirror 用于左翅。 */
export function TuxedoWing({ body = "#FFFFFF", tip = "#2E2E36", mirror = false }: { body?: string; tip?: string; mirror?: boolean }) {
  return (
    <g transform={mirror ? "scale(-1 1)" : undefined}>
      <path
        d="M0 0 q17 3 21 19 q2 9 -2 15 l-5 -5 l-2 8 l-6 -4 l-2 7 q-8 -5 -9 -17 q-1 -14 5 -23 z"
        fill={body}
        stroke={OUTLINE}
        strokeWidth={5}
        strokeLinejoin="round"
      />
      <path d="M6 24 q1 8 -1 12 l6 -4 l2 6 q6 -6 6 -14 q-6 3 -13 0 z" fill={tip} stroke={OUTLINE} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M5 8 q6 4 8 12" fill="none" stroke={OUTLINE} strokeWidth={2.4} opacity={0.35} strokeLinecap="round" />
    </g>
  );
}
