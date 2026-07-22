import { fmt, type Language, t } from "../i18n";
import type { PetEvent, PetEventType, PetState } from "../types";
import { randomItem } from "./geometry";
import { formatCount } from "../game/format";
import quotesData from "../../assets/text/ai_quotes.json";

export const LANGUAGE_STORAGE_KEY = "gulugulu.language";

export type QuoteEntry = {
  id: string;
  lang: Language;
  text: string;
  tags: string[];
};

const quotes = quotesData.quotes as QuoteEntry[];
const quotesByLanguage: Record<Language, QuoteEntry[]> = {
  zh: quotes.filter((quote) => quote.lang === "zh"),
  en: quotes.filter((quote) => quote.lang === "en"),
};

// —— 动态台词池（连接 Claude/Codex 后由后台预生成，App 挂载时灌入；见 setDynamicQuotes）——
// 结构与静态池一致；非空时 chooseQuote 有 50% 概率改抽动态句（§随机台词生成规则）。
const dynamicByLanguage: Record<Language, QuoteEntry[]> = { zh: [], en: [] };
const dynamicDecks: Record<Language, Set<string>> = { zh: new Set(), en: new Set() };

/** 后台生成的一批动态台词到达后调用：按语言重建动态池 + 重置其无重复袋。 */
export function setDynamicQuotes(entries: QuoteEntry[]): void {
  dynamicByLanguage.zh = entries.filter((quote) => quote.lang === "zh");
  dynamicByLanguage.en = entries.filter((quote) => quote.lang === "en");
  dynamicDecks.zh = new Set(dynamicByLanguage.zh.map((quote) => quote.id));
  dynamicDecks.en = new Set(dynamicByLanguage.en.map((quote) => quote.id));
}

const speechContextTags: Record<PetState, string[]> = {
  idle: ["assistant", "chatgpt", "meme", "sycophancy"],
  sleeping: ["disclaimer", "reasoning", "comfort"],
  clicked: ["meme", "sycophancy", "comfort"],
  laboring: ["coding", "agent", "meme"],
  exhausted: ["comfort", "disclaimer", "apology"],
  drag_start: ["comfort", "apology", "meme"],
  dragging: ["comfort", "apology", "agent"],
  drop: ["apology", "meme", "agent"],
  moving: ["agent", "coding", "meme"],
  thinking: ["reasoning", "deepseek", "essay", "disclaimer"],
  working: ["coding", "agent", "claude", "overconfident"],
  success: ["coding", "agent", "overconfident", "meme"],
  fed: ["coding", "overconfident", "meme", "hallucination"],
  error: ["apology", "refusal", "safety", "hallucination"],
};

const speakingEventTypes = new Set<PetEventType>([
  "agent_thinking_start",
  "agent_work_finish",
  "user_click",
  "user_drag_end",
]);

export function makePetEvent(type: PetEventType): PetEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
  };
}

export function loadInitialLanguage(): Language {
  const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return savedLanguage === "en" || savedLanguage === "zh" ? savedLanguage : "en";
}

export function createQuoteDecks(): Record<Language, Set<string>> {
  return {
    zh: new Set(quotesByLanguage.zh.map((quote) => quote.id)),
    en: new Set(quotesByLanguage.en.map((quote) => quote.id)),
  };
}

/** 从给定池（按语言分区 + 无重复袋）里按状态 tag 优先挑一条：上下文候选优先，
 *  耗尽回退任意未用句，袋空则重播整池。返回替换过 XXX 占位符的文本；池空返回 null。 */
function pickFromPool(
  byLanguage: Record<Language, QuoteEntry[]>,
  decks: Record<Language, Set<string>>,
  language: Language,
  tags: string[],
): string | null {
  const languageQuotes = byLanguage[language];
  if (languageQuotes.length === 0) return null;
  let unusedIds = decks[language];
  if (unusedIds.size === 0) {
    unusedIds = new Set(languageQuotes.map((quote) => quote.id));
    decks[language] = unusedIds;
  }
  const unusedQuotes = languageQuotes.filter((quote) => unusedIds.has(quote.id));
  const contextualQuotes = unusedQuotes.filter((quote) => quote.tags.some((tag) => tags.includes(tag)));
  const candidates = contextualQuotes.length > 0 ? contextualQuotes : unusedQuotes;
  const selected = randomItem(candidates.length > 0 ? candidates : languageQuotes);
  if (!selected) return null;
  unusedIds.delete(selected.id);
  return selected.text.replace("XXX", t(language).sh.speech.statePlaceholder);
}

/** 选一条随机台词：连接 Claude/Codex 后动态池非空时，一半概率走动态句、一半走
 *  固定句（§随机台词生成规则）；动态池为空（未连接 / 未生成完）时全走静态。
 *  `decks` 是静态池的无重复袋（组件持有）；动态池的袋在模块内维护。 */
export function chooseQuote(language: Language, state: PetState, decks: Record<Language, Set<string>>): string {
  const tags = speechContextTags[state];
  if (dynamicByLanguage[language].length > 0 && Math.random() < 0.5) {
    const dynamic = pickFromPool(dynamicByLanguage, dynamicDecks, language, tags);
    if (dynamic != null) return dynamic;
  }
  return pickFromPool(quotesByLanguage, decks, language, tags) ?? "";
}

export function shouldSpeakForEvent(type: PetEventType): boolean {
  return speakingEventTypes.has(type);
}

/** 恢复期点击的驳回文案（InteractionEconomy §6.4：不是错误，是"让我睡会"）。 */
export function staminaRecoveryText(
  stamina: number | undefined,
  wakeThreshold: number | undefined,
  language: Language,
): string {
  const sp = t(language).sh.speech;
  if (stamina == null || wakeThreshold == null || wakeThreshold <= 0) {
    return sp.recoveryNap;
  }
  const shown = Math.max(0, Math.min(stamina, wakeThreshold));
  return fmt(sp.recoveryProgress, { threshold: wakeThreshold, shown });
}

/** Token 餐气泡（token→经验，2026-07-21 机制修订，InteractionEconomy §3.3）：
 *  吃到某个 Agent 产出的 Token、陪伴宠经验涨了时冒的话。只报吃到的 Token 总量
 *  + 涨了多少经验（+是否升级），不再拆四分明细——「吃到 Codex 的 2.5万 Token，
 *  经验 +50！」。source 认得 "codex"/"claudeCode"，其它（调试投喂等）省略来源名。
 *  数字走 formatCount（万/亿·k/m/b）保持大数可读；调用方已保证 exp > 0。 */
export function tokenMealText(
  source: string,
  totalTokens: number,
  exp: number,
  leveledUp: boolean,
  language: Language,
): string {
  const name = source === "claudeCode" ? "Claude" : source === "codex" ? "Codex" : "";
  const sp = t(language).sh.speech;
  const amount = formatCount(totalTokens, language);
  const tail = fmt(leveledUp ? sp.tokenMealLevelUp : sp.tokenMealExp, {
    exp: formatCount(exp, language),
  });
  return name ? fmt(sp.tokenMealNamed, { name, amount, tail }) : fmt(sp.tokenMealAnon, { amount, tail });
}
