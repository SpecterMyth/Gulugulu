import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// 后院场景的共享基元：世界宽度常量 + 绝对定位样式糖。
// 供 BackyardScene（相机取景 / 近景层宽）与 BackyardDecor（布景绘制）共用，
// 单一事实源，避免两处各写一份或形成循环依赖。
// ---------------------------------------------------------------------------

/** 近景画卷世界宽度：角色活动区、相机取景、近景层宽都以此为准。 */
export const WORLD_W = 5600;

export type Sty = CSSProperties;

/** 绝对定位样式糖：省去每处重复写 position:"absolute"。 */
export const abs = (s: Sty): Sty => ({ position: "absolute", ...s });
