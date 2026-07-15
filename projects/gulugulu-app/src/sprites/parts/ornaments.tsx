import { OUTLINE } from "../rigTypes";

// -----------------------------------------------------------------------------
// species2 共享装饰件（融合 2.0 华丽度阶梯词汇 · SpeciesArtSpec §3/§4）。
// 约定：局部坐标；角/冠/羽 pivot=(0,0)=底部中点向上生长；环绕件以 (0,0) 为环心。
// 环绕件由物种包在 <g className="part-orbit|part-aura|part-crest"> 里获得
// 一次性 CSS 动画（sprites.css orn- 段）。装饰类 g 不得与状态 part-* 同元素。
// -----------------------------------------------------------------------------

/** 小尖角（可弯）。h=高，w=底宽，bend=弯曲偏移（+右）。 */
export function Horn({ color, h = 24, w = 11, bend = 4, stroke = 4 }: { color: string; h?: number; w?: number; bend?: number; stroke?: number }) {
  const hw = w / 2;
  return (
    <path
      d={`M${-hw} 0 Q${bend * 0.4 - hw * 0.2} ${-h * 0.55} ${bend} ${-h} Q${bend * 0.6 + hw * 0.3} ${-h * 0.5} ${hw} 0 Z`}
      fill={color}
      stroke={OUTLINE}
      strokeWidth={stroke}
      strokeLinejoin="round"
    />
  );
}

/** 分叉小鹿角（单只；mirror 得另一侧）。 */
export function BranchAntler({ color, h = 30, mirror = false, stroke = 4 }: { color: string; h?: number; mirror?: boolean; stroke?: number }) {
  return (
    <g transform={mirror ? "scale(-1 1)" : undefined} fill="none" stroke={color} strokeWidth={6.5} strokeLinecap="round">
      <path d={`M0 0 Q2 ${-h * 0.55} 7 ${-h}`} stroke={OUTLINE} strokeWidth={6.5 + stroke} />
      <path d={`M3 ${-h * 0.45} Q9 ${-h * 0.6} 13 ${-h * 0.78}`} stroke={OUTLINE} strokeWidth={5 + stroke} />
      <path d={`M0 0 Q2 ${-h * 0.55} 7 ${-h}`} />
      <path d={`M3 ${-h * 0.45} Q9 ${-h * 0.6} 13 ${-h * 0.78}`} strokeWidth={5} />
    </g>
  );
}

/** 冠羽/呆羽三簇（colors 从中间到两侧）。 */
export function CrestPlume({ colors, h = 26 }: { colors: string[]; h?: number }) {
  const c = (i: number) => colors[Math.min(i, colors.length - 1)];
  return (
    <g stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
      <path d={`M-4 0 Q-16 ${-h * 0.5} -9 ${-h * 0.82} Q-3 ${-h * 0.55} -1 ${-h * 0.15} Z`} fill={c(1)} />
      <path d={`M4 0 Q16 ${-h * 0.5} 9 ${-h * 0.82} Q3 ${-h * 0.55} 1 ${-h * 0.15} Z`} fill={c(2)} />
      <path d={`M-4 1 Q-6 ${-h * 0.72} 0 ${-h} Q6 ${-h * 0.72} 4 1 Q0 4 -4 1 Z`} fill={c(0)} />
    </g>
  );
}

/** 颈羽/围脖（扇贝边半环，扣在颈线上方；width=总宽）。 */
export function NeckRuff({ color, width = 76, depth = 15, scallops = 5, stroke = 4.5 }: { color: string; width?: number; depth?: number; scallops?: number; stroke?: number }) {
  const half = width / 2;
  const step = width / scallops;
  let d = `M${-half} 0`;
  for (let i = 0; i < scallops; i++) {
    const x0 = -half + i * step;
    d += ` Q${x0 + step / 2} ${depth * 2} ${x0 + step} 0`;
  }
  d += ` L${half} -6 Q0 ${-depth * 0.4} ${-half} -6 Z`;
  return <path d={d} fill={color} stroke={OUTLINE} strokeWidth={stroke} strokeLinejoin="round" />;
}

/** 小王冠（points 齿数）。pivot=底边中点。 */
export function CrownTier({ color = "#F5C542", points = 3, w = 30, h = 16, gem }: { color?: string; points?: number; w?: number; h?: number; gem?: string }) {
  const half = w / 2;
  const step = w / points;
  let d = `M${-half} 0 L${-half} ${-h * 0.45}`;
  for (let i = 0; i < points; i++) {
    const x0 = -half + i * step;
    d += ` L${x0 + step / 2} ${-h} L${x0 + step} ${-h * 0.45}`;
  }
  d += ` L${half} 0 Z`;
  return (
    <g>
      <path d={d} fill={color} stroke={OUTLINE} strokeWidth={3.6} strokeLinejoin="round" />
      {gem && <circle cx={0} cy={-h * 0.35} r={3} fill={gem} stroke={OUTLINE} strokeWidth={2} />}
    </g>
  );
}

/** 宝石镶嵌点。 */
export function GemInlay({ color, r = 4 }: { color: string; r?: number }) {
  return (
    <g>
      <path d={`M0 ${-r} L${r} 0 L0 ${r} L${-r} 0 Z`} fill={color} stroke={OUTLINE} strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={-r * 0.25} cy={-r * 0.25} r={r * 0.22} fill="#FFFFFF" opacity={0.9} />
    </g>
  );
}

/** 轨道珠环（e4+ 环绕件）：count 颗小珠均布在椭圆环上。
 *  由调用方包 <g className="part-orbit"> 获得 360° 慢旋。 */
export function OrbitOrbs({ colors, rx = 62, ry = 20, r = 5, count = 4 }: { colors: string[]; rx?: number; ry?: number; r?: number; count?: number }) {
  const orbs = Array.from({ length: count }, (_, i) => {
    const a = (Math.PI * 2 * i) / count;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    return <circle key={i} cx={x} cy={y} r={r} fill={colors[i % colors.length]} stroke={OUTLINE} strokeWidth={2.4} />;
  });
  return <g>{orbs}</g>;
}

/** 光环（头顶/身后光圈，配 part-aura 脉动）。 */
export function AuraRing({ color, rx = 26, ry = 9, stroke = 5 }: { color: string; rx?: number; ry?: number; stroke?: number }) {
  return (
    <g>
      <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="none" stroke={color} strokeWidth={stroke} opacity={0.9} />
      <ellipse cx={0} cy={0} rx={rx} ry={ry} fill="none" stroke="#FFFFFF" strokeWidth={stroke * 0.35} opacity={0.7} />
    </g>
  );
}

/** 礼装弧（e5+ 背后的层叠光弧/羽弧；colors 由内到外）。pivot=弧心。 */
export function RegaliaArc({ colors, r = 52, spreadDeg = 150, gap = 10, stroke = 8 }: { colors: string[]; r?: number; spreadDeg?: number; gap?: number; stroke?: number }) {
  const arcs = colors.map((color, i) => {
    const rr = r + i * gap;
    const a = (spreadDeg / 2) * (Math.PI / 180);
    const x = Math.sin(a) * rr;
    const y = -Math.cos(a) * rr;
    return (
      <path
        key={i}
        d={`M${-x} ${y} A${rr} ${rr} 0 0 1 ${x} ${y}`}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        opacity={0.92}
      />
    );
  });
  return <g>{arcs}</g>;
}

/** 元素徽记排（e5/e6 露出全部成员元素的小圆徽）。 */
export function ElementPips({ colors, spread = 16, r = 5.5 }: { colors: string[]; spread?: number; r?: number }) {
  const n = colors.length;
  const start = (-(n - 1) * spread) / 2;
  return (
    <g>
      {colors.map((color, i) => (
        <g key={i} transform={`translate(${start + i * spread} 0)`}>
          <circle r={r} fill={color} stroke={OUTLINE} strokeWidth={2.6} />
          <circle cx={-r * 0.3} cy={-r * 0.3} r={r * 0.24} fill="#FFFFFF" opacity={0.85} />
        </g>
      ))}
    </g>
  );
}
