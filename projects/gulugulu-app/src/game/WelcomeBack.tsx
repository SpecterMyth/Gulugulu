import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DaySummary, GameConfig, GameSave } from "../types";
import { fmt, type ShellStrings } from "../i18n";
import { useT } from "../useT";
import { isTauri } from "../tauri";
import { isMaxLevel } from "./config";
import { formatCount } from "./format";
import { fusionReady } from "./tutorial";
import { formatReportDate, pickRoast } from "./welcomeReport";

// ---------------------------------------------------------------------------
// 欢迎回来摘要卡（OnboardingFlow.md §二·调整 4）
//
// 每天开场的仪式性入口，是所有隔夜悬念的兑现舞台。离线检测**不依赖存档字段**
// （GameSave.lastSeenAt 仅预留给 v2，基线从不写入）：运行时以 localStorage 记录
// 最近心跳时间戳，启动时对比当前时间 >2h 即弹卡。不含"昨日收益"栏
// （DailyCounters 翻转即清零，避免新存档字段）。Rust 侧零改动。
// ---------------------------------------------------------------------------

const HEARTBEAT_KEY = "gulugulu.lastHeartbeat";
const OFFLINE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2h
const HEARTBEAT_INTERVAL_MS = 30_000;

/** 运行时定期写心跳时间戳（+卸载时补一次）。返回清理函数。 */
export function startHeartbeat(): () => void {
  const beat = () => {
    try {
      window.localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
    } catch {
      // localStorage 不可用时静默跳过——欢迎卡是加分项，不阻塞游戏。
    }
  };
  const timer = window.setInterval(beat, HEARTBEAT_INTERVAL_MS);
  window.addEventListener("beforeunload", beat);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("beforeunload", beat);
    beat();
  };
}

/** 启动时读上次心跳：离线 >2h（或 `?welcome=1` 强制）返回离线时长，否则 null。
 *  读取后立即写入当前心跳，避免同一次启动重复弹卡。首次运行（无心跳）不弹。 */
export function readOfflineWelcome(): { offlineMs: number } | null {
  try {
    const raw = window.localStorage.getItem(HEARTBEAT_KEY);
    const forced =
      typeof window !== "undefined" && new URLSearchParams(window.location.search).has("welcome");
    const last = raw ? Number(raw) : NaN;
    window.localStorage.setItem(HEARTBEAT_KEY, String(Date.now()));
    if (forced) {
      return { offlineMs: Number.isFinite(last) ? Math.max(0, Date.now() - last) : OFFLINE_THRESHOLD_MS };
    }
    if (!Number.isFinite(last)) return null; // 首次运行——没有隔夜可兑现
    const offlineMs = Date.now() - last;
    return offlineMs > OFFLINE_THRESHOLD_MS ? { offlineMs } : null;
  } catch {
    return null;
  }
}

/** 离线时长的人话表述（EN 区分单复数；zh 单复同文，见词表）。 */
function formatOffline(ms: number, W: ShellStrings["welcome"]): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return fmt(days === 1 ? W.durDay : W.durDays, { n: days });
  }
  if (hours >= 1) return fmt(hours === 1 ? W.durHour : W.durHours, { n: hours });
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  return fmt(minutes === 1 ? W.durMinute : W.durMinutes, { n: minutes });
}

function goalText(save: GameSave, config: GameConfig, W: ShellStrings["welcome"]): string {
  if (fusionReady(config, save)) return W.goalFuse;
  const cheapest = Math.min(...Object.values(config.eggPrices));
  if (save.pets.length < 2 && save.coins >= cheapest) return W.goalBuyEgg;
  if (save.pets.some((pet) => !isMaxLevel(config, pet))) return W.goalLevelUp;
  return W.goalEarn;
}

// ---------------------------------------------------------------------------
// 昨日战报（WelcomeBack 昨日总结改造）
// ---------------------------------------------------------------------------

/** 拉取「昨日战报」（Tauri-gated；预览模式/失败返回 null，卡片自动降级为旧式当前状态）。 */
function useYesterdaySummary(): DaySummary | null {
  const [summary, setSummary] = useState<DaySummary | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    invoke<DaySummary>("get_yesterday_summary")
      .then((next) => {
        if (!disposed) setSummary(next);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, []);
  return summary;
}

/** 全宽统计行（图标+标签｜数值）。用于 Token 头条 / 生成量副行 / 金币收入。 */
function HeroStat({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: boolean }) {
  return (
    <div className={sub ? "welcome-hero-stat welcome-hero-sub" : "welcome-hero-stat"}>
      <span className="welcome-stat-label">
        {icon} {label}
      </span>
      <span className="welcome-stat-val">{value}</span>
    </div>
  );
}

/** 紧凑小格（2 列栅格里的一格）：上排图标+标签，下排数值。 */
function StatTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="welcome-tile">
      <span className="welcome-tile-label">
        {icon} {label}
      </span>
      <b className="welcome-tile-val">{value}</b>
    </div>
  );
}

export function WelcomeBackCard({
  save,
  config,
  offlineMs,
  onClose,
  onMeasure,
}: {
  save: GameSave;
  config: GameConfig;
  offlineMs: number;
  onClose: () => void;
  /** 把卡片实际内容高度报给上层，用于把窗口增高到不截断（见 App.tsx window sizing）。 */
  onMeasure?: (height: number) => void;
}) {
  const { lang, T } = useT();
  const W = T.sh.welcome;
  const summary = useYesterdaySummary();
  const cardRef = useRef<HTMLDivElement>(null);

  // 卡片内容高度上报：scrollHeight 取的是完整内容高（含内边距），即便此刻正被小窗/
  // max-height 夹住出滚动条也准确。用 ResizeObserver 覆盖「列表态→昨日战报」的异步切换、
  // 字体/emoji 加载、吐槽文案换行等一切高度变化；卡片宽度只随窗口宽（固定）变化，增高窗口
  // 不改内容高，故不会形成观察循环。
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el == null || onMeasure == null) return;
    const report = () => onMeasure(el.scrollHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onMeasure]);
  // 有归档、或当天有 Token 历史 → 出昨日战报；否则（预览/首启无数据）降级为旧式当前状态。
  const showReport = summary != null && (summary.hasDigest || summary.tokensRaw > 0);
  const active = save.pets.find((pet) => pet.id === save.activePetId) ?? null;
  const now = Math.floor(Date.now() / 1000);
  const readyEggs = save.eggs.filter(
    (egg) => egg.slot != null && egg.hatchAt != null && now >= egg.hatchAt,
  ).length;
  const incubating = save.eggs.filter(
    (egg) => egg.slot != null && egg.hatchAt != null && now < egg.hatchAt,
  ).length;

  const staminaText =
    active == null
      ? W.noPet
      : active.stamina >= config.staminaMax
        ? fmt(W.staminaFull, { max: config.staminaMax })
        : fmt(W.staminaPartial, { current: active.stamina, max: config.staminaMax });
  const eggText =
    readyEggs > 0
      ? fmt(W.eggsReady, { n: readyEggs })
      : incubating > 0
        ? fmt(W.eggsIncubating, { n: incubating })
        : W.eggsEmpty;

  return (
    <div className="welcome-overlay" onClick={onClose}>
      <div
        ref={cardRef}
        className="welcome-card"
        role="dialog"
        aria-label={W.aria}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="welcome-title">{W.title}</div>
        <div className="welcome-sub">{fmt(W.awayFor, { duration: formatOffline(offlineMs, W) })}</div>
        {showReport && summary ? (
          <div className="welcome-report">
            <div className="welcome-report-date">
              {fmt(summary.isYesterday ? W.reportTitle : W.reportTitlePrev, {
                date: formatReportDate(summary.date, lang),
              })}
            </div>
            <HeroStat icon="🔥" label={W.rowTokens} value={formatCount(summary.tokensRaw)} />
            <HeroStat icon="✍️" label={W.rowTokensGen} value={formatCount(summary.tokenBreakdown.output)} sub />
            <div className="welcome-stat-grid">
              <StatTile icon="⌨️" label={W.rowKeys} value={formatCount(summary.keys)} />
              <StatTile icon="🐾" label={W.rowClicks} value={formatCount(summary.clicks)} />
              <StatTile
                icon="🧬"
                label={W.rowFusions}
                value={`${summary.fusions}${W.unitTimes ? ` ${W.unitTimes}` : ""}`}
              />
              <StatTile
                icon="🥚"
                label={W.rowHatches}
                value={`${summary.hatches}${W.unitPets ? ` ${W.unitPets}` : ""}`}
              />
            </div>
            <HeroStat icon="💰" label={W.rowCoins} value={`+${formatCount(summary.coinsEarned)}`} />
            <div className="welcome-roast">{pickRoast(summary, W, config.dailyClickCap)}</div>
          </div>
        ) : (
          <ul className="welcome-list">
            <li>⚡ {staminaText}</li>
            <li>🥚 {eggText}</li>
            <li>🎯 {fmt(W.todayGoal, { goal: goalText(save, config, W) })}</li>
          </ul>
        )}
        <button type="button" className="welcome-cta" onClick={onClose}>
          {W.start}
        </button>
      </div>
    </div>
  );
}
