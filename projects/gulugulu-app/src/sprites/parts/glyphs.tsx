import { OUTLINE } from "../rigTypes";

// -----------------------------------------------------------------------------
// 共享 SVG 字形原语（InteractionEconomy.md §6.3）：
// 键帽与 Token 芯片的视觉语言来自 workFx.tsx 的 voltmouse keycap / guluduck
// codeChip，抽到这里供 FlightLayer（汇聚飞行）与 workFx（发散粒子）共用。
// 全部画在以 (0,0) 为中心的局部坐标系里。
// -----------------------------------------------------------------------------

/** 键帽字形。label 为真实按键字符（隐私契约：仅瞬时显示，不落盘）。 */
export function KeycapGlyph({ label }: { label: string }) {
  const wide = label === "␣"; // 空格：加宽键帽
  const gold = label === "⏎"; // 回车：金面键帽
  const w = wide ? 32 : 18;
  return (
    <g>
      <rect
        x={-w / 2}
        y={-9}
        width={w}
        height={18}
        rx={4}
        fill={gold ? "#FFD97A" : "#FFF6CE"}
        stroke={OUTLINE}
        strokeWidth={2.6}
      />
      <text
        x={0}
        y={4.5}
        fontSize={10.5}
        fontWeight={900}
        textAnchor="middle"
        fill="#3B2B1D"
        fontFamily="inherit"
      >
        {label}
      </text>
    </g>
  );
}

/** 堆叠键帽（一批超出上限时的 ×N 承载）：两枚错位叠放 + 角标。 */
export function StackedKeycapGlyph({ count }: { count: number }) {
  return (
    <g>
      <rect x={-6} y={-12} width={18} height={18} rx={4} fill="#F3E4B8" stroke={OUTLINE} strokeWidth={2.2} />
      <rect x={-12} y={-7} width={18} height={18} rx={4} fill="#FFF6CE" stroke={OUTLINE} strokeWidth={2.6} />
      <text x={-3} y={7} fontSize={10} fontWeight={900} textAnchor="middle" fill="#3B2B1D" fontFamily="inherit">
        ⌨
      </text>
      <text x={12} y={-8} fontSize={9} fontWeight={900} textAnchor="middle" fill="#8A6437" fontFamily="inherit">
        ×{count}
      </text>
    </g>
  );
}

/** Token 经验饭团字形（吃 Token 时从远处飘来的食物，喂陪伴宠经验）。像素尺寸随等级在
 *  FlightLayer 侧放大（这里画在固定 ±16 的局部坐标里，与 🍙 叙事呼应）。
 *  等级越高，海苔越宽、点缀越多，读作"更大的一餐"。 */
export function FoodGlyph({ level }: { level: number }) {
  return (
    <g>
      {/* 饭团圆润三角身体 */}
      <path
        d="M0 -16 Q13 -14 15 6 Q15 15 0 15 Q-15 15 -15 6 Q-13 -14 0 -16 Z"
        fill="#FFFDF5"
        stroke={OUTLINE}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      {/* 底部海苔带 */}
      <path
        d="M-11 3 Q0 7 11 3 L11 13 Q0 16 -11 13 Z"
        fill="#3B4A2E"
        stroke={OUTLINE}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* 芝麻点缀，等级越高越多 */}
      <circle cx={-5} cy={-3} r={1.5} fill="#D9C89A" />
      <circle cx={5} cy={-5} r={1.3} fill="#D9C89A" />
      {level >= 2 && <circle cx={0} cy={-9} r={1.3} fill="#D9C89A" />}
      {level >= 3 && <circle cx={-8} cy={-8} r={1.2} fill="#D9C89A" />}
      {/* 高等级加一缕热气，强调"大餐" */}
      {level >= 3 && (
        <path
          d="M-4 -17 q3 -4 0 -8 M4 -17 q-3 -4 0 -8"
          fill="none"
          stroke="#E7DFC8"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.85}
        />
      )}
    </g>
  );
}

/** Token 量 → 食物等级（指数分档：≤2k=1，≤8k=2，≤32k=3，……×4/级，封顶 6）。 */
export function foodLevelForTokens(tokens: number): number {
  if (tokens <= 2000) return 1;
  return Math.min(6, 1 + Math.ceil(Math.log(tokens / 2000) / Math.log(4)));
}
