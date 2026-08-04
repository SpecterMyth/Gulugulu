// i18n 基础类型与工具。域词表(backyard/shell/messages/species)只依赖本文件，
// 汇总入口 src/i18n.ts 负责合并——域文件禁止反向 import "../i18n"(防循环)。

export type TextDirection = "ltr" | "rtl";

/**
 * Gulugulu 当前提供的应用语言选项。id 使用 BCP-47；steamId 使用 Steamworks 的语言码。
 * label 始终用该语言自身书写，避免切错语言后无法找到返回项。
 */
export const LANGUAGES = [
  { id: "en", label: "English", htmlLang: "en", dir: "ltr", steamId: "english" },
  { id: "zh-Hans", label: "简体中文", htmlLang: "zh-Hans", dir: "ltr", steamId: "schinese" },
  { id: "zh-Hant", label: "繁體中文", htmlLang: "zh-Hant", dir: "ltr", steamId: "tchinese" },
  { id: "ja", label: "日本語", htmlLang: "ja", dir: "ltr", steamId: "japanese" },
  { id: "ko", label: "한국어", htmlLang: "ko", dir: "ltr", steamId: "koreana" },
  { id: "fr", label: "Français", htmlLang: "fr", dir: "ltr", steamId: "french" },
  { id: "de", label: "Deutsch", htmlLang: "de", dir: "ltr", steamId: "german" },
  { id: "es-ES", label: "Español (España)", htmlLang: "es-ES", dir: "ltr", steamId: "spanish" },
  { id: "es-419", label: "Español (Latinoamérica)", htmlLang: "es-419", dir: "ltr", steamId: "latam" },
  { id: "pt-BR", label: "Português (Brasil)", htmlLang: "pt-BR", dir: "ltr", steamId: "brazilian" },
  { id: "pt-PT", label: "Português (Portugal)", htmlLang: "pt-PT", dir: "ltr", steamId: "portuguese" },
  { id: "ru", label: "Русский", htmlLang: "ru", dir: "ltr", steamId: "russian" },
  { id: "it", label: "Italiano", htmlLang: "it", dir: "ltr", steamId: "italian" },
  { id: "pl", label: "Polski", htmlLang: "pl", dir: "ltr", steamId: "polish" },
  { id: "tr", label: "Türkçe", htmlLang: "tr", dir: "ltr", steamId: "turkish" },
  { id: "uk", label: "Українська", htmlLang: "uk", dir: "ltr", steamId: "ukrainian" },
  // Steamworks does not currently expose Arabic as a platform/store language.
  { id: "ar", label: "العربية", htmlLang: "ar", dir: "rtl", steamId: null },
  { id: "th", label: "ไทย", htmlLang: "th", dir: "ltr", steamId: "thai" },
  { id: "vi", label: "Tiếng Việt", htmlLang: "vi", dir: "ltr", steamId: "vietnamese" },
  { id: "id", label: "Bahasa Indonesia", htmlLang: "id", dir: "ltr", steamId: "indonesian" },
  { id: "nl", label: "Nederlands", htmlLang: "nl", dir: "ltr", steamId: "dutch" },
] as const;

export type Language = (typeof LANGUAGES)[number]["id"];
export type SteamLanguage = Exclude<(typeof LANGUAGES)[number]["steamId"], null>;
export type LanguageDefinition = (typeof LANGUAGES)[number];
export type DeepPartial<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

const LANGUAGE_BY_ID = new Map<string, LanguageDefinition>(LANGUAGES.map((item) => [item.id, item]));

/** 旧版设置和常见 OS locale 的别名；返回值始终是正式 BCP-47 id。 */
const LANGUAGE_ALIASES: Readonly<Record<string, Language>> = {
  zh: "zh-Hans",
  "zh-cn": "zh-Hans",
  "zh-sg": "zh-Hans",
  "zh-hans": "zh-Hans",
  "zh-tw": "zh-Hant",
  "zh-hk": "zh-Hant",
  "zh-mo": "zh-Hant",
  "zh-hant": "zh-Hant",
  "es-mx": "es-419",
  "es-ar": "es-419",
  "es-cl": "es-419",
  "es-co": "es-419",
  "es-pe": "es-419",
  "es-us": "es-419",
  "pt-br": "pt-BR",
  "pt-pt": "pt-PT",
  ua: "uk",
  in: "id",
};

const LATIN_AMERICAN_SPANISH_REGIONS = new Set([
  "ar", "bo", "br", "bz", "cl", "co", "cr", "cu", "do", "ec", "gt", "hn", "mx", "ni", "pa", "pe", "pr", "py", "sv", "us", "uy", "ve",
]);

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && LANGUAGE_BY_ID.has(value);
}

/** 将保存值、URL 参数或系统 locale 归一化到应用支持的语言。 */
export function normalizeLanguage(value: string | null | undefined): Language | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (isLanguage(raw)) return raw;

  const locale = raw.replace(/_/g, "-");
  const lower = locale.toLowerCase();
  const aliased = LANGUAGE_ALIASES[lower];
  if (aliased) return aliased;

  const [base, region] = lower.split("-");
  if (base === "zh") return region === "tw" || region === "hk" || region === "mo" || region === "hant" ? "zh-Hant" : "zh-Hans";
  if (base === "es") return region && LATIN_AMERICAN_SPANISH_REGIONS.has(region) ? "es-419" : "es-ES";
  if (base === "pt") return region === "pt" ? "pt-PT" : "pt-BR";
  return LANGUAGES.find((item) => item.id.toLowerCase() === base)?.id ?? null;
}

export function languageDefinition(language: Language): LanguageDefinition {
  return LANGUAGE_BY_ID.get(language) ?? LANGUAGE_BY_ID.get("en")!;
}

export function isChineseLanguage(language: Language): boolean {
  return language === "zh-Hans" || language === "zh-Hant";
}

export function applyDocumentLanguage(language: Language): void {
  const definition = languageDefinition(language);
  document.documentElement.lang = definition.htmlLang;
  document.documentElement.dir = definition.dir;
  document.documentElement.dataset.language = language;
}

/**
 * 域词表迁移助手。所有语言 key 都会存在；尚未传入专门词表时暂以英语为安全兜底。
 * 完整性脚本会阻止带兜底标记的正式发布包进入 Steam 发布流程。
 */
export function createLanguageMap<T>(
  english: T,
  simplifiedChinese: T,
  localized: Partial<Record<Language, DeepPartial<T>>> = {},
): Record<Language, T> {
  return Object.fromEntries(
    LANGUAGES.map(({ id }) => [
      id,
      mergeLocalized(id === "zh-Hans" ? simplifiedChinese : english, localized[id]),
    ]),
  ) as Record<Language, T>;
}

function mergeLocalized<T>(base: T, override: DeepPartial<T> | undefined): T {
  if (override === undefined) return base;
  if (
    base == null ||
    override == null ||
    typeof base !== "object" ||
    typeof override !== "object" ||
    Array.isArray(base) ||
    Array.isArray(override)
  ) {
    return override as T;
  }
  const merged = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    merged[key] = mergeLocalized(merged[key], value);
  }
  return merged as T;
}

/** 迁移仍以 `zh`/`en` 为键的旧词表；新词表请直接使用 createLanguageMap。 */
export function migrateLegacyLanguageMap<T>(
  legacy: { en: T; zh: T } & Partial<Record<Language, DeepPartial<T>>>,
): Record<Language, T> {
  return createLanguageMap(legacy.en, legacy.zh, legacy);
}

/** 模板插值:fmt("需要 {cost} 金币", {cost: 5}) → "需要 5 金币"。未知占位符原样保留。 */
export function fmt(template: string, args?: Record<string, string | number>): string {
  if (!args) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    args[key] != null ? String(args[key]) : match,
  );
}
