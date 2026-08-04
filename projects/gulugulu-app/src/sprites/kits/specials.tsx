import { OUTLINE } from "../rigTypes";

// -----------------------------------------------------------------------------
// 二阶特例件（计划 §1.3）：王冠×3、红披风、浪花冠、雷雨乌云、浮冰座台、
// 莲叶帽、兔耳雪绒。局部坐标：头顶件 pivot=底部中点，背部件 pivot=贴合点，
// 座台件 pivot=顶部中点。
// -----------------------------------------------------------------------------

/** 银灰小王冠（咕噜天鹅）。pivot=冠底中点。 */
export function SilverCrown() {
  return (
    <g>
      <path
        d="M-16 0 L-16 -14 L-8 -6 L0 -18 L8 -6 L16 -14 L16 0 Z"
        fill="#C8CCD8"
        stroke={OUTLINE}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <circle cx={0} cy={-18} r={3} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2.5} />
    </g>
  );
}

/** 静电王冠（雷霆鼠皇）：金冠 + 冠尖小电花。pivot=冠底中点。 */
export function StaticCrown() {
  return (
    <g>
      <path
        d="M-18 0 L-18 -15 L-9 -7 L0 -20 L9 -7 L18 -15 L18 0 Z"
        fill="#FFD93B"
        stroke={OUTLINE}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <g stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round">
        <path d="M-18 -19 l3 -5 M0 -24 l0 -6 M18 -19 l-3 -5" />
      </g>
      <circle cx={0} cy={-8} r={3.2} fill="#E2432E" stroke={OUTLINE} strokeWidth={2.5} />
    </g>
  );
}

/** 冰凌王冠（极冰雪帝）：尖冰柱冠。pivot=冠底中点。 */
export function IcicleCrown() {
  return (
    <g fill="#B0E5F0" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
      <path d="M-18 0 L-14 -16 L-8 -2 L0 -24 L8 -2 L14 -16 L18 0 Z" />
      <path d="M-4 -12 L0 -20 L4 -12 Z" fill="#F7FCFD" stroke="none" opacity={0.8} />
    </g>
  );
}

/** 红披风（雷霆鼠皇）。背部件，pivot=领口中点，向下垂。 */
export function RedCape({ width = 56, length = 58 }: { width?: number; length?: number }) {
  const half = width / 2;
  return (
    <g>
      <path
        d={`M${-half} 0 Q${-half - 8} ${length * 0.6} ${-half + 4} ${length} Q0 ${length + 8} ${half - 4} ${length} Q${half + 8} ${length * 0.6} ${half} 0 Z`}
        fill="#E2432E"
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      <path
        d={`M${-half + 6} 6 Q0 ${length * 0.2} ${half - 6} 6`}
        fill="none"
        stroke="#B32E17"
        strokeWidth={3}
        strokeLinecap="round"
      />
    </g>
  );
}

/** 浪花冠（浪涛鲸）：背驮的一朵卷浪。背部件，pivot=浪底中点。 */
export function WaveCrest({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <path
        d="M-30 0 Q-34 -26 -12 -34 Q12 -42 24 -26 Q34 -13 22 -6 Q28 -16 16 -22 Q22 -10 8 -8 Q16 -18 4 -24 Q10 -12 -4 -10 Q2 -20 -10 -24 Q-22 -18 -20 0 Z"
        fill="#9BDCFF"
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      <circle cx={-14} cy={-26} r={3} fill="#FFFFFF" opacity={0.9} />
      <circle cx={4} cy={-32} r={2.4} fill="#FFFFFF" opacity={0.8} />
    </g>
  );
}

/** 雷雨小乌云（雷雨鲸）：头顶悬浮乌云 + 两道小雨丝 + 一道小闪电。pivot=云底中点。 */
export function StormCloud() {
  return (
    <g>
      <g fill="#8E93A6" stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
        <path d="M-26 -8 a10 10 0 0 1 10 -12 a12 12 0 0 1 22 -4 a10 10 0 0 1 16 8 a8 8 0 0 1 -4 16 q-30 4 -40 0 a8 8 0 0 1 -4 -8 z" />
      </g>
      <path d="M-2 2 l-6 10 h5 l-4 10" fill="none" stroke="#FFD93B" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      <g stroke="#9BDCFF" strokeWidth={2.6} strokeLinecap="round">
        <path d="M-16 4 l-2 7" />
        <path d="M12 4 l-2 7" />
      </g>
    </g>
  );
}

/** 随身小浮冰（浮冰雪怪）：座台件，pivot=浮冰顶面中点。 */
export function IceFloe({ width = 120 }: { width?: number }) {
  const half = width / 2;
  return (
    <g>
      <path
        d={`M${-half} 0 L${-half + 14} 14 L${-half * 0.4} 18 L${half * 0.3} 15 L${half - 10} 17 L${half} 0 Z`}
        fill="#DFF4FA"
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      <path d={`M${-half + 8} 4 L${-half * 0.3} 7 M${half * 0.15} 5 L${half - 14} 8`} stroke="#B0E5F0" strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

/** 莲叶圆帽（莲叶鲸）：带缺口的莲叶。头顶件，pivot=叶心（贴头顶）。 */
export function LilyPadHat({ scale = 1 }: { scale?: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <path
        d="M0 0 m-34 0 a34 22 0 1 1 68 0 a34 22 0 1 1 -68 0 M0 0 L26 -14 L30 -4 Z"
        fill="#57B84C"
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
        fillRule="evenodd"
      />
      <g stroke="#3B8F33" strokeWidth={2.6} strokeLinecap="round" opacity={0.8}>
        <path d="M0 0 L-22 -10 M0 0 L-26 6 M0 0 L-4 16 M0 0 L18 12" />
      </g>
    </g>
  );
}

/** 兔耳形雪绒 ×2（雪兔菇）：头顶件，pivot=双耳根中点。 */
export function BunnyEarTufts() {
  return (
    <g fill="#CFEFF6" stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round">
      <path d="M-20 0 q-10 -26 -2 -44 q12 8 12 32 q0 8 -10 12 z" />
      <path d="M20 0 q10 -26 2 -44 q-12 8 -12 32 q0 8 10 12 z" />
      <path d="M-16 -8 q-4 -16 0 -28 q5 6 5 22 z" fill="#F7FCFD" stroke="none" opacity={0.85} />
      <path d="M16 -8 q4 -16 0 -28 q-5 6 -5 22 z" fill="#F7FCFD" stroke="none" opacity={0.85} />
    </g>
  );
}
