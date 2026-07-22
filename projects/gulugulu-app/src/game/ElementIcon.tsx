// 元素小图标：六元素各一枚"对应颜色 + 对应形状"的字形（config.elements[el].badge），
// 用于图鉴配方行的元素标签，替代纯色圆点——让"红焰=火 / 蓝滴=水 / 黄电=电"一眼可辨。
// 形状取自 config 的 badge 字段（star/flame/bolt/drop/leaf/snow）；未知徽记回退圆点。
// 全部画在 16×16 局部坐标里，深色描边沿用精灵的 OUTLINE，风格与主美术一致。

export const OUTLINE = "#3B2B1D";

/** badge → 单路径字形（含描边，填充用元素色）。leaf 末段是叶脉（开放子路径，仅描边）。
 *  也被 scripts/render_steam_icons.tsx 复用来画 AI 占位图标的元素徽记（单一真源）。 */
export const BADGE_PATHS: Record<string, string> = {
  star: "M8 1 L9.71 5.65 L14.66 5.84 L10.76 8.9 L12.11 13.66 L8 10.9 L3.89 13.66 L5.24 8.9 L1.34 5.84 L6.29 5.65 Z",
  flame:
    "M8 2 C 11 5.5 11.5 8 10.8 10.3 C 10.2 12.2 9.1 13.4 8 13.4 C 6.9 13.4 5.8 12.2 5.2 10.3 C 4.5 8 5 5.5 8 2 Z",
  bolt: "M9.6 1.5 L4 9 H7 L6.4 14.5 L12 6.6 H8.8 L9.6 1.5 Z",
  drop: "M8 2 C 10.8 6 12 8.2 12 10.2 A 4 4 0 0 1 4 10.2 C 4 8.2 5.2 6 8 2 Z",
  leaf: "M8 1.5 C 12 5 12 11 8 14.5 C 4 11 4 5 8 1.5 Z M8 3.5 L8 12.5",
  snow: "M8 1 L9.3 5.75 L14.06 4.5 L10.6 8 L14.06 11.5 L9.3 10.25 L8 15 L6.7 10.25 L1.94 11.5 L5.4 8 L1.94 4.5 L6.7 5.75 Z",
};

export function ElementIcon({
  badge,
  color,
  title,
  size = 14,
}: {
  badge: string;
  color: string;
  title?: string;
  size?: number;
}) {
  const d = BADGE_PATHS[badge];
  return (
    <svg
      className="el-icon"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role="img"
      aria-label={title ?? badge}
    >
      {title ? <title>{title}</title> : null}
      {d ? (
        <path
          d={d}
          fill={color}
          stroke={OUTLINE}
          strokeWidth={1.4}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : (
        <circle cx={8} cy={8} r={5.5} fill={color} stroke={OUTLINE} strokeWidth={1.4} />
      )}
    </svg>
  );
}
