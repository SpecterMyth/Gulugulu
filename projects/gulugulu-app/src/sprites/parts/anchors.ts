// -----------------------------------------------------------------------------
// species2 共享锚点常量（融合 2.0 · SpeciesArtSpec §3）。
// 所有 rig 在 256×256 viewBox 作画：地面线 y=233，水平中心 x=128。
// -----------------------------------------------------------------------------

/** 地面线（脚底/趴卧底缘对齐这里） */
export const GROUND_Y = 233;
/** 水平中心 */
export const CX = 128;
/** 影子椭圆中心 y（SvgSprite 固定画在 236） */
export const SHADOW_CY = 236;
/** 工具锚缺省位（身体右侧贴地；各 rig 可按体型外移防遮挡） */
export const DEFAULT_TOOL_ANCHOR = { x: 186, y: 231 } as const;

/** 生成放置 transform 字符串：translate + 可选 rotate/scale。
 *  统一走这里，消灭手打 `translate(.. ..) rotate(..)` 的笔误类错误。 */
export function place(x: number, y: number, rot = 0, scale = 1): string {
  let t = `translate(${x} ${y})`;
  if (rot !== 0) t += ` rotate(${rot})`;
  if (scale !== 1) t += ` scale(${scale})`;
  return t;
}
