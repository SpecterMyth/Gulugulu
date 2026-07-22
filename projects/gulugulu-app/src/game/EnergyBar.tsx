import { useId } from "react";
import { fmt } from "../i18n";
import { useT } from "../useT";
import { formatCount } from "./format";

// -----------------------------------------------------------------------------
// 精力条 + 每日爱心计（InteractionEconomy.md §6.1/§6.2）
// - EnergyBar：hud（菜单栏）/ tag（后院名牌微条）/ float（头顶·舞台悬浮条）
//   三种变体共用一套色阶（≥60% 绿 / 10~60% 橙 / <10% 恢复期灰紫呼吸）与
//   10% 唤醒刻度；pulseKey 变化时播一次"获得脉冲"。
// - DailyLoveMeter：心形液面 = 今日剩余点击额度；点满换 🌙 月亮徽章。
// 样式见 styles.css 的 .energy-bar-* / .love-meter-*。
// -----------------------------------------------------------------------------

export function EnergyBar({
  value,
  max,
  wakeThreshold,
  variant,
  pulseKey,
}: {
  value: number;
  max: number;
  wakeThreshold: number;
  variant: "hud" | "tag" | "float";
  /** 键盘入账时 +1，触发一次获得脉冲动画（2026-07-21 起精力只来自键盘+自然恢复）。 */
  pulseKey?: number;
}) {
  const { T } = useT();
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const wakePct = max > 0 ? Math.max(0, Math.min(100, (wakeThreshold / max) * 100)) : 10;
  const stage = pct < wakePct ? "recovering" : pct < 60 ? "low" : "high";
  return (
    <div
      className={`energy-bar energy-bar-${variant} is-${stage}`}
      title={fmt(T.bk.energyTitle, { value, max })}
      aria-hidden="true"
    >
      <div className="energy-bar-fill" style={{ width: `${pct}%` }} />
      {/* 获得脉冲：key 变化强制重挂载以重播动画 */}
      {pulseKey != null && pulseKey > 0 && (
        <span key={pulseKey} className="energy-bar-pulse" style={{ width: `${pct}%` }} />
      )}
    </div>
  );
}

/** 经验条（后院名牌内）：点击打工后与精力条同窗短暂显示。
 *  满级不显示——由调用方用 isMaxLevel 把关，本组件只管画条。 */
export function ExpBar({ value, max }: { value: number; max: number }) {
  const { T } = useT();
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className="exp-bar"
      title={fmt(T.bk.expTitle, { value: formatCount(value), max: formatCount(max) })}
      aria-hidden="true"
    >
      <div className="exp-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

const HEART_PATH =
  "M12 21 C 7.2 16.8 2 12.6 2 8.2 A 5 5 0 0 1 12 6.4 A 5 5 0 0 1 22 8.2 C 22 12.6 16.8 16.8 12 21 Z";

/** 每日点击额度的心形液面计。叙事是"今天能给它的爱"，永不使用红色/禁止感。 */
export function DailyLoveMeter({
  clicks,
  cap,
  showCount,
}: {
  clicks: number;
  cap: number;
  /** 是否显示剩余数字（后院牌簇 true；260px 菜单栏 false，数字进 title）。 */
  showCount?: boolean;
}) {
  const { T } = useT();
  const clipId = useId();
  const left = Math.max(0, cap - clicks);
  const ratio = cap > 0 ? left / cap : 0;
  const stage = left === 0 ? "done" : ratio < 0.1 ? "gold" : ratio < 0.5 ? "amber" : "pink";
  const fillTop = 22 - 18 * Math.max(0.06, ratio); // 心形内液面（永远留一点底）
  return (
    <span
      className={`love-meter is-${stage}`}
      title={fmt(T.bk.love.title, { clicks: formatCount(clicks), cap: formatCount(cap) })}
    >
      {left === 0 ? (
        <span className="love-meter-moon">🌙</span>
      ) : (
        <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
          <defs>
            <clipPath id={clipId}>
              <path d={HEART_PATH} />
            </clipPath>
          </defs>
          <path d={HEART_PATH} className="love-meter-outline" />
          <rect
            className="love-meter-liquid"
            x={0}
            y={fillTop}
            width={24}
            height={24}
            clipPath={`url(#${clipId})`}
          />
        </svg>
      )}
      {showCount && (
        <span className="love-meter-count">{left === 0 ? T.bk.love.tomorrow : formatCount(left)}</span>
      )}
    </span>
  );
}
