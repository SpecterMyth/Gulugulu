// 宣传片语言开关:`?lang=zh` = 全中文字幕版;缺省 = 英文版。
// 两版共用同一套场景/时间线/特效,只切文案与排版,分别录制。
export type TrLang = "en" | "zh";

export function trLang(): TrLang {
  try {
    return new URLSearchParams(window.location.search).get("lang") === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

/** 字幕打字机速度(字/秒)。中文单字信息量大,打字放慢才读得完。 */
export const CPS: Record<TrLang, number> = { en: 46, zh: 18 };
/** 标题卡打字速度(字/秒)。 */
export const TITLE_CPS: Record<TrLang, number> = { en: 28, zh: 14 };

/** 字幕分段:S=普通,H=高亮金色。介绍字幕逐字打出。 */
export type Seg = { t: string; hi?: boolean };
export const S = (t: string): Seg => ({ t });
export const H = (t: string): Seg => ({ t, hi: true });
