import type { GameConfig, GameSave } from "../types";
import { isMaxLevel } from "./config";
import { fusionReady } from "./tutorial";

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

function formatOffline(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 24) return `${Math.floor(hours / 24)} 天`;
  if (hours >= 1) return `${hours} 小时`;
  return `${Math.max(1, Math.floor(ms / 60_000))} 分钟`;
}

function goalText(save: GameSave, config: GameConfig): string {
  if (fusionReady(config, save)) return "把两只满级伙伴融合，见证 2 阶诞生";
  const cheapest = Math.min(...Object.values(config.eggPrices));
  if (save.pets.length < 2 && save.coins >= cheapest) return "再买一颗蛋，凑一对好融合";
  if (save.pets.some((pet) => !isMaxLevel(config, pet))) return "精力攒满了，亲手点它升到满级";
  return "点两下打工攒金币，升级后院多养几只";
}

export function WelcomeBackCard({
  save,
  config,
  offlineMs,
  onClose,
}: {
  save: GameSave;
  config: GameConfig;
  offlineMs: number;
  onClose: () => void;
}) {
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
      ? "还没有精灵"
      : active.stamina >= config.staminaMax
        ? `精力已回满，攒好 ${config.staminaMax} 击随时开工`
        : `精力恢复到 ${active.stamina}/${config.staminaMax}`;
  const eggText =
    readyEggs > 0
      ? `${readyEggs} 颗蛋孵好了，快去收！`
      : incubating > 0
        ? `${incubating} 颗蛋还在孵化中`
        : "孵化区空着，去商店挑颗蛋吧";

  return (
    <div className="welcome-overlay" onClick={onClose}>
      <div className="welcome-card" role="dialog" aria-label="欢迎回来" onClick={(event) => event.stopPropagation()}>
        <div className="welcome-title">🌅 欢迎回来！</div>
        <div className="welcome-sub">你离开了约 {formatOffline(offlineMs)}</div>
        <ul className="welcome-list">
          <li>⚡ {staminaText}</li>
          <li>🥚 {eggText}</li>
          <li>🎯 今日目标：{goalText(save, config)}</li>
        </ul>
        <button type="button" className="welcome-cta" onClick={onClose}>
          开始今天
        </button>
      </div>
    </div>
  );
}
