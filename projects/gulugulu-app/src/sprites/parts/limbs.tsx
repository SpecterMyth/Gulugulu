import { OUTLINE } from "../rigTypes";

// -----------------------------------------------------------------------------
// species2 共享四肢件（融合 2.0 · SpeciesArtSpec §3）。
// 约定：全部局部坐标、pivot=(0,0)=关节（肩/髋）；由 rig 用外层
// <g transform=...> 放置，并包在 <Part name="armL|armR|legL|legR"> 里。
// 肩 origin 建议 "50% 8%"，髋 origin 建议 "50% -30%"（悬挂摆动自然）。
// -----------------------------------------------------------------------------

/** 豆芽小圆手（最通用）。垂挂向下，手尖 y≈ry*2。 */
export function NubArm({ color, rx = 8, ry = 13, stroke = 5 }: { color: string; rx?: number; ry?: number; stroke?: number }) {
  return <ellipse cx={0} cy={ry * 0.82} rx={rx} ry={ry} fill={color} stroke={OUTLINE} strokeWidth={stroke} />;
}

/** 长条手臂（端头圆润，适合"举着/搬着"姿态的双足小人）。 */
export function LongArm({ color, len = 26, w = 13, stroke = 5 }: { color: string; len?: number; w?: number; stroke?: number }) {
  const hw = w / 2;
  return (
    <path
      d={`M${-hw} 0 Q${-hw} ${len} 0 ${len + hw * 0.6} Q${hw} ${len} ${hw} 0 Q0 ${-hw * 0.8} ${-hw} 0 Z`}
      fill={color}
      stroke={OUTLINE}
      strokeWidth={stroke}
      strokeLinejoin="round"
    />
  );
}

/** 小翅膀手（鸟禽/蝙蝠通用；mirror 用于左侧）。翅尖朝下后方。 */
export function WingArm({ color, deep, len = 30, mirror = false }: { color: string; deep?: string; len?: number; mirror?: boolean }) {
  const l = len;
  return (
    <g transform={mirror ? "scale(-1 1)" : undefined}>
      <path
        d={`M0 0 Q${l * 0.55} ${l * 0.18} ${l * 0.62} ${l * 0.66} Q${l * 0.36} ${l * 0.6} ${l * 0.3} ${l * 0.86} Q${l * 0.1} ${l * 0.72} 0 ${l * 0.8} Q${-l * 0.18} ${l * 0.4} 0 0 Z`}
        fill={color}
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
      {deep && <path d={`M${l * 0.12} ${l * 0.28} Q${l * 0.34} ${l * 0.36} ${l * 0.4} ${l * 0.62}`} fill="none" stroke={deep} strokeWidth={3} strokeLinecap="round" />}
    </g>
  );
}

/** 桨鳍手（水栖用）。 */
export function FlipperArm({ color, len = 24, mirror = false }: { color: string; len?: number; mirror?: boolean }) {
  return (
    <g transform={mirror ? "scale(-1 1)" : undefined}>
      <path
        d={`M0 0 Q${len * 0.9} ${len * 0.25} ${len * 0.75} ${len * 0.7} Q${len * 0.3} ${len * 0.95} 0 ${len * 0.55} Q${-len * 0.12} ${len * 0.25} 0 0 Z`}
        fill={color}
        stroke={OUTLINE}
        strokeWidth={4.5}
        strokeLinejoin="round"
      />
    </g>
  );
}

/** 短墩腿 + 椭圆脚（最通用；deep 缺省同 color）。脚底压在 y=0。 */
export function StubLeg({ color, deep, rx = 9, ry = 5.5, lift = 10, stroke = 4.5 }: { color: string; deep?: string; rx?: number; ry?: number; lift?: number; stroke?: number }) {
  const d = deep ?? color;
  return (
    <g>
      {lift > 0 && <path d={`M0 ${-lift} q-1 ${lift * 0.55} 0 ${lift}`} stroke={d} strokeWidth={rx * 0.8} strokeLinecap="round" fill="none" />}
      <ellipse cx={0} cy={0} rx={rx} ry={ry} fill={d} stroke={OUTLINE} strokeWidth={stroke} />
    </g>
  );
}

/** 细长腿 + 蹄/靴（四足兽·有蹄用）。腿从髋(0,-len)垂到脚(0,0)。 */
export function TallLeg({ color, hoof, len = 26, w = 9, hoofH = 8 }: { color: string; hoof: string; len?: number; w?: number; hoofH?: number }) {
  const hw = w / 2;
  return (
    <g>
      <path d={`M${-hw} ${-len} L${hw} ${-len} L${hw * 0.9} ${-hoofH} L${-hw * 0.9} ${-hoofH} Z`} fill={color} stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round" />
      <path d={`M${-hw - 1} ${-hoofH} L${hw + 1} ${-hoofH} L${hw + 0.5} 0 Q0 2.5 ${-hw - 0.5} 0 Z`} fill={hoof} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
    </g>
  );
}

/** 圆爪短腿（四足兽站姿前腿；paw 缺省 belly 色肉垫效果由物种自绘）。 */
export function PawLeg({ color, rx = 10, ry = 12, stroke = 5 }: { color: string; rx?: number; ry?: number; stroke?: number }) {
  return <ellipse cx={0} cy={-ry * 0.7} rx={rx} ry={ry} fill={color} stroke={OUTLINE} strokeWidth={stroke} />;
}
