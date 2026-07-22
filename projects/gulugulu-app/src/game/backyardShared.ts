import type { CSSProperties } from "react";

// ---------------------------------------------------------------------------
// 后院场景的共享基元：世界宽度常量 + 绝对定位样式糖。
// 供 BackyardScene（相机取景 / 近景层宽）与 BackyardDecor（布景绘制）共用，
// 单一事实源，避免两处各写一份或形成循环依赖。
// ---------------------------------------------------------------------------

/** 近景画卷·核心内容世界宽度：孵化区 → 交易市场尾边这一段占用的区域。 */
export const WORLD_W = 5840;

/** 左右尽头各再扩一屏纯装饰带。
 *  作用：① 孵化区不再顶着世界左墙——相机可把它滑离左下角的「后院」标题 HUD，
 *  消除两者叠字；② 交易市场之后也有一屏可漫步的风景，两端对称收边。 */
export const WORLD_PAD_L = 900;
export const WORLD_PAD_R = 900;

/** 扩展后的世界边界（含两侧装饰带）：相机取景、角色活动、地面铺陈都以此为准。 */
export const WORLD_MIN = -WORLD_PAD_L;
export const WORLD_MAX = WORLD_W + WORLD_PAD_R;
export const WORLD_SPAN = WORLD_MAX - WORLD_MIN;

export type Sty = CSSProperties;

/** 绝对定位样式糖：省去每处重复写 position:"absolute"。 */
export const abs = (s: Sty): Sty => ({ position: "absolute", ...s });

/** 沿路灯柱的世界 X（NearDecor 画灯柱，BackyardNightLights 在同一 X 点灯）。
 *  单一事实源，避免灯柱与夜灯错位。灯头约在 bottom 236。 */
export const LAMP_POSTS: number[] = [980, 1745, 3010, 3720];
/** 灯头（灯泡/夜灯光晕）距地高度。 */
export const LAMP_HEAD_BOTTOM = 236;
