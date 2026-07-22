// 数值缩写显示（EconomyScaling.md §0）：中文 万/亿，其它语言 k/m/b，最多 4 位有效数字。
// 所有面向玩家的金额/经验/Token 显示都走 formatCount，指数经济下才可读。
// 语言默认取当前 UI 语言（localStorage `gulugulu.language`，随设置切换实时生效）。

const LANGUAGE_STORAGE_KEY = "gulugulu.language";

type Lang = "zh" | "en";

function currentLang(): Lang {
  try {
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

/** 保留 ≤4 位有效数字并去掉多余尾随零（5.250→"5.25"、9531.25→"9531"）。 */
function sig4(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n === 0) return "0";
  return String(Number(n.toPrecision(4)));
}

/**
 * 缩写一个非负计数值。
 * - 中文：`< 1万` 原样整数；`万`(1e4)、`亿`(1e8)。
 * - 其它（短刻度）：`< 1K` 原样整数；`K`(1e3)、`M`(1e6)、`B`(1e9)。
 * 负数保留前导 `-`。
 */
export function formatCount(value: number, lang: Lang = currentLang()): string {
  if (!Number.isFinite(value)) return "0";
  const neg = value < 0;
  const v = Math.abs(value);
  let body: string;
  if (lang === "zh") {
    if (v < 1e4) body = String(Math.round(v));
    else if (v < 1e8) body = `${sig4(v / 1e4)}万`;
    else body = `${sig4(v / 1e8)}亿`;
  } else {
    if (v < 1e3) body = String(Math.round(v));
    else if (v < 1e6) body = `${sig4(v / 1e3)}K`;
    else if (v < 1e9) body = `${sig4(v / 1e6)}M`;
    else body = `${sig4(v / 1e9)}B`;
  }
  return neg ? `-${body}` : body;
}
