// 昨日战报的纯逻辑（无 React / 无 Tauri）：日期格式化 + 狠辣吐槽选择。
// 抽成独立模块便于 scripts/verify_welcome_report.mjs 离线单测（esbuild+Node）。

import { fmt, type Language, type ShellStrings } from "../i18n";
import type { DaySummary } from "../types";
import { formatCount } from "./format";

type WelcomeStrings = ShellStrings["welcome"];

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ISO 日期（YYYY-MM-DD）→ 人话短日期：zh「7月20日」/ en「Jul 20」。解析失败原样返回。 */
export function formatReportDate(iso: string, lang: Language): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (lang === "zh") return `${month}月${day}日`;
  return `${EN_MONTHS[month - 1] ?? m[2]} ${day}`;
}

/** raw token（含 cache_read，与公告板同口径）落哪个吐槽档（T0–T5）。导出供单测钉边界。 */
export function roastTier(tokensRaw: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (tokensRaw < 1e6) return 0; // 摸鱼
  if (tokensRaw < 2e7) return 1; // 轻度
  if (tokensRaw < 1e8) return 2; // 常规
  if (tokensRaw < 4e8) return 3; // 高产
  if (tokensRaw < 1e9) return 4; // 爆肝
  return 5; // 非人类
}

/** 高 token 但基本没动手的阈值（甩手掌柜吐槽）：raw ≥ 5000 万且戳宠物 ≤ 3。 */
const HANDS_OFF_TOKENS = 5e7;
const HANDS_OFF_CLICKS = 3;

/** 按「昨日整体数据量」选一句狠辣吐槽：特殊组合优先（命中即用，压过档位），否则按 raw
 *  token 落 T0–T5 档；档内用 dayIndex 定种子取一句（同一天重开不变，隔天会换）。
 *  `{tokens}`/`{fusions}`/`{clicks}` 由此处插值。 */
export function pickRoast(s: DaySummary, W: WelcomeStrings, dailyClickCap: number): string {
  const tokens = formatCount(s.tokensRaw);
  const seeded = (arr: string[]): string => arr[Math.max(0, s.dayIndex) % arr.length] ?? arr[0];
  // —— 特殊组合（优先级从上到下，命中即用）——
  if (s.nightOwl) return W.roastNightOwl;
  if (s.fusions >= 3) return fmt(W.roastFusionManiac, { fusions: s.fusions });
  if (s.eggsMinted > 0 && s.hatches === 0) return W.roastEggHoarder;
  if (s.tokensRaw >= HANDS_OFF_TOKENS && s.clicks <= HANDS_OFF_CLICKS) return W.roastHandsOff;
  if (dailyClickCap > 0 && s.clicks >= dailyClickCap) return fmt(W.roastClickStorm, { clicks: s.clicks });
  if (s.tokensRaw < 1e6 && s.clicks === 0 && s.hatches === 0 && s.fusions === 0) return W.roastNothing;
  // —— 档位（狠辣暴击 T0–T5）——
  const tierArrays = [W.roastT0, W.roastT1, W.roastT2, W.roastT3, W.roastT4, W.roastT5];
  return fmt(seeded(tierArrays[roastTier(s.tokensRaw)]), { tokens });
}
