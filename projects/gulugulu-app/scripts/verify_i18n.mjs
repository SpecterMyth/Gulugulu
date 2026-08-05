import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSync } from "esbuild";
import {
  FACTORY_CORE_FLOW_SOURCES,
  LLM_REVIEWED_OVERRIDES,
} from "./localization_llm_reviewed_overrides.mjs";

const APP_ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(APP_ROOT, "..", "..");
const strict = process.argv.includes("--strict");
let failures = 0;
const ok = (condition, message) => {
  if (condition) console.log(`✓ ${message}`);
  else {
    failures += 1;
    console.error(`✗ ${message}`);
  }
};

const { outputFiles } = buildSync({
  stdin: {
    contents: `
      export { LANGUAGES } from "./src/i18n/core.ts";
      export { STRINGS } from "./src/i18n.ts";
      export { UI_LOCALES } from "./src/i18n/uiLocales.ts";
      export { BACKYARD, BACKYARD_LABEL_LOCALES, BACKYARD_SEMANTIC_LOCALES } from "./src/i18n/backyard.ts";
      export { FACTORY } from "./src/i18n/factory.ts";
      export { FACTORY_ROGUE, FACTORY_ACTION_LABEL_LOCALES, FACTORY_PAYMENT_BUTTON_LOCALES, FACTORY_SHIFT_LABEL_LOCALES, FACTORY_TERM_LABEL_LOCALES, FACTORY_RESUME_LOCALES, FACTORY_SETTLEMENT_SCORE_LOCALES } from "./src/i18n/factoryRogue.ts";
      export { MESSAGES } from "./src/i18n/messages.ts";
      export { ELEMENT_NAMES, SPECIES_EN_DESC, SPECIES_EN_NAMES, SPECIES_NAME_OVERRIDES } from "./src/i18n/species.ts";
      export { SHELL, SHELL_COLLECTION_LOCALES } from "./src/i18n/shell.ts";
      export { CARD_DEFS } from "./src/game/factory/rogueConfig.ts";
      export { ROGUE_CARD_KEYWORDS, rogueKeywordText } from "./src/game/factory/rogueKeywords.ts";
      export { ONBOARDING_EN_COPY, ONBOARDING_UI_EN, ONBOARDING_UI_ZH } from "./src/app/onboarding/onboardingCopy.ts";
      export { FACTORY_FIRST_RUN_COPY } from "./src/game/factory/FactoryFirstRunGuide.tsx";
      export { ACHIEVEMENT_NAMES } from "./src/game/achievements.ts";
      export { DEBUG_EN, DEBUG_STRINGS } from "./src/i18n/debug.ts";
      export { default as CONFIG } from "./src/game/config.json";
      export { default as QUOTES } from "./assets/text/ai_quotes.json";
    `,
    resolveDir: APP_ROOT,
    sourcefile: "i18n-verifier-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  loader: { ".css": "empty" },
  write: false,
  logLevel: "silent",
});
const M = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

const ids = M.LANGUAGES.map((item) => item.id);
const generatedIds = ids.filter((id) => id !== "en" && id !== "zh-Hans");
const steamIds = M.LANGUAGES.map((item) => item.steamId).filter(Boolean);
const generated = JSON.parse(
  readFileSync(join(APP_ROOT, "src", "i18n", "generated", "runtimeLocales.json"), "utf8"),
);
const factoryCardGlossary = JSON.parse(
  readFileSync(join(APP_ROOT, "scripts", "factory_card_glossary.json"), "utf8"),
);
for (const terms of Object.values(factoryCardGlossary.locales)) {
  Object.assign(terms, { ...factoryCardGlossary.defaultTerms, ...terms });
}

const flattenStrings = (value, prefix = "", out = new Map()) => {
  if (typeof value === "string") out.set(prefix, value);
  else if (Array.isArray(value)) value.forEach((item, index) => flattenStrings(item, `${prefix}[${index}]`, out));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) flattenStrings(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
};
const cloneStatic = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(cloneStatic);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([, child]) => typeof child !== "function").map(([key, child]) => [key, cloneStatic(child)]),
    );
  }
  return value;
};
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(",");
const placeholderLinks = (text) => [...text.matchAll(/\{(\w+)\}\s*([/:])\s*\{(\w+)\}/g)]
  .map((match) => `${match[1]}${match[2]}${match[3]}`);
const inventedMnemonic = (source, localized) => (
  !/[（(][A-Z][）)]/u.test(source) && /[（(][A-Z][）)]/u.test(localized)
);
const brokenNumericAffix = (source, localized) => [...source.matchAll(/([+−])\{(\w+)\}/gu)]
  .some(([, operator, name]) => localized.includes(operator)
    && !new RegExp(`${operator === "+" ? "\\+" : operator}\\{${name}\\}`, "u").test(localized));
const getPath = (value, path) => path.split(".").reduce((current, key) => current?.[key], value);

// Keep in lockstep with generate_runtime_locales.mjs / argos_translate_worker.py.
// These are runtime/UI contracts, not translatable prose.
const PROTECTED_TOKEN_RE = /\{\w+\}|(?:[\u{1F000}-\u{1FAFF}\u2190-\u2BFF](?:[\uFE0E\uFE0F])?(?:\u200D[\u{1F000}-\u{1FAFF}\u2190-\u2BFF](?:[\uFE0E\uFE0F])?)*)|\b(?:Claude Code|Codex CLI|Gulugulu|Claude|Codex|Steam|KPIs?|EXP|AI|CLI|Gulus?|GULUS?)\b(?:\(s\))?(?:['’]s|['’])?(?:[,.;:!?…—–/+\-]\s*|\s+)?|Lv(?:\d+|\{\w+\})|T(?:\d+(?:[–-]\d+)?|\{\w+\})|No\.(?:\d+|\{\w+\})?|[←→↔×✓✔★☆‹›–—‘’“”「」『』·\/]/gu;
const protectedTokens = (text) => {
  PROTECTED_TOKEN_RE.lastIndex = 0;
  return [...text.matchAll(PROTECTED_TOKEN_RE)].map((match) => match[0]);
};
const canonicalProtectedToken = (token) => {
  const stripped = token.replace(/(?:[,.;:!?…—–/+\-]\s*|\s+)$/u, "");
  return stripped || token;
};
const preservesProtectedTokens = (sourceText, localizedText) => {
  const glossaryLocalizesGulu = factoryCardGlossary.sourceTerms.some((term) =>
    (term.token === "GULU" || term.token.endsWith("_GULU"))
    && new RegExp(term.pattern, term.flags?.includes("i") ? "iu" : "u").test(sourceText)
  );
  const expected = protectedTokens(sourceText).map(canonicalProtectedToken).filter(
    (token) => !glossaryLocalizesGulu || !/^Gulus?(?:\(s\))?(?:['\u2019]s)?$/u.test(token),
  );
  const actual = protectedTokens(localizedText).map(canonicalProtectedToken);
  let cursor = 0;
  return expected.every((token) => {
    const index = actual.indexOf(token, cursor);
    if (index < 0) return false;
    cursor = index + 1;
    return true;
  });
};
const outerWhitespace = (text) => `${text.match(/^\s*/u)?.[0] ?? ""}\u0000${text.match(/\s*$/u)?.[0] ?? ""}`;
const stripProtected = (text) => {
  PROTECTED_TOKEN_RE.lastIndex = 0;
  return text.replace(PROTECTED_TOKEN_RE, "");
};
const hasTranslatableEnglish = (text) => /[A-Za-z]/.test(stripProtected(text));
const normalizedProse = (text) => stripProtected(text).replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("en");
const EXPECTED_SCRIPT = {
  "zh-Hant": /\p{Script=Han}/u,
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  ko: /\p{Script=Hangul}/u,
  ru: /\p{Script=Cyrillic}/u,
  uk: /\p{Script=Cyrillic}/u,
  ar: /\p{Script=Arabic}/u,
  th: /\p{Script=Thai}/u,
};
const FOREIGN_NON_LATIN_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Thai}]/u;

ok(ids.length === 21 && new Set(ids).size === 21, "应用语言注册表包含 21 个唯一 BCP-47 id");
ok(ids.includes("zh-Hans") && ids.includes("zh-Hant") && !ids.includes("zh"), "简体/繁体中文使用独立规范 id");
ok(M.LANGUAGES.find((item) => item.id === "ar")?.dir === "rtl", "阿拉伯语启用 RTL 文档方向");
ok(
  generatedIds.length === 19 && generatedIds.every((id) => generated[id]) && Object.keys(generated).length === 19,
  "生成资源完整覆盖 19 个非英语/非简中语言",
);

const runtimeDomains = {
  ui: M.STRINGS,
  backyard: M.BACKYARD,
  factory: M.FACTORY,
  factoryRogue: M.FACTORY_ROGUE,
  messages: M.MESSAGES,
  elements: M.ELEMENT_NAMES,
  shell: M.SHELL,
};
for (const [domainName, domain] of Object.entries(runtimeDomains)) {
  const english = flattenStrings(domain.en);
  for (const id of ids) {
    const current = flattenStrings(domain[id]);
    const missing = [...english.entries()].filter(([, text]) => text.trim()).map(([key]) => key).filter((key) => !current.get(key)?.trim());
    const broken = [...english.entries()].filter(([key, text]) => placeholders(text) !== placeholders(current.get(key) ?? ""));
    ok(missing.length === 0, `${id}/${domainName}: ${english.size} 个静态文本键均有值${missing.length ? `（缺 ${missing.slice(0, 5).join(", ")}）` : ""}`);
    ok(broken.length === 0, `${id}/${domainName}: 模板占位符一致`);
  }
}

ok(
  ids.every((id) => M.SHELL[id].pop.combo === "Combo ×{n}" && M.FACTORY_ROGUE[id].hudCombo === "Combo ×{n}"),
  "21 种语言的 Combo HUD/飘字统一保留英文术语",
);
const reviewedShiftKeys = Object.keys(M.FACTORY_SHIFT_LABEL_LOCALES.en);
ok(
  ids.every((id) => reviewedShiftKeys.every(
    (key) => M.FACTORY_ROGUE[id][key] === M.FACTORY_SHIFT_LABEL_LOCALES[id]?.[key],
  )),
  `21 种语言的 ${reviewedShiftKeys.length} 个 Shift 短标签均使用“工作班次”语义的人工校对译文`,
);
const reviewedFactoryTermKeys = Object.keys(M.FACTORY_TERM_LABEL_LOCALES.en);
ok(
  ids.every((id) => reviewedFactoryTermKeys.every(
    (key) => M.FACTORY_ROGUE[id][key] === M.FACTORY_TERM_LABEL_LOCALES[id]?.[key],
  )),
  `21 种语言的 ${reviewedFactoryTermKeys.length} 个招聘/局次多义短标签均使用人工校对译文`,
);
const reviewedResumeKeys = Object.keys(M.FACTORY_RESUME_LOCALES.en);
ok(
  ids.every((id) => reviewedResumeKeys.every(
    (key) => M.FACTORY_ROGUE[id][key] === M.FACTORY_RESUME_LOCALES[id]?.[key],
  )),
  `21 种语言的 ${reviewedResumeKeys.length} 个断点续玩文案均使用人工校对译文`,
);
const reviewedPaymentButtonKeys = Object.keys(M.FACTORY_PAYMENT_BUTTON_LOCALES.en);
ok(
  ids.every((id) => reviewedPaymentButtonKeys.every(
    (key) => M.FACTORY_ROGUE[id][key] === M.FACTORY_PAYMENT_BUTTON_LOCALES[id]?.[key],
  )),
  `21 种语言的 ${reviewedPaymentButtonKeys.length} 个结算支付按钮均使用人工校对译文`,
);

const englishQuotes = M.QUOTES.quotes.filter((quote) => quote.lang === "en");
const keywordIds = [...new Set(Object.values(M.ROGUE_CARD_KEYWORDS).flat())];
const defaultRecipeSpecies = [...new Set(Object.values(M.CONFIG.speciesByRecipe))];
const cardLevels = new Map(M.CARD_DEFS.map((card) => [card.id, card.maxLevel ?? 1]));
const expectedGeneratedDomains = [
  "ui", "backyard", "factoryRogue", "messages", "elements", "speciesNames", "speciesDescriptions",
  "speciesGenericDescription", "shell", "onboarding", "onboardingUi", "factoryFirstRun",
  "achievements", "rogueKeywords", "quotes", "factoryRogueCards",
  "debug",
];

const cardSource = Object.fromEntries(
  Object.entries(M.FACTORY_ROGUE.en.cards).map(([id, card]) => [
    id,
    {
      name: card.name,
      descriptions: Array.from({ length: cardLevels.get(id) ?? 1 }, (_, index) => card.desc(index + 1)),
    },
  ]),
);
const sourceTree = {
  ui: M.STRINGS.en,
  backyard: M.BACKYARD.en,
  factoryRogue: cloneStatic(M.FACTORY_ROGUE.en),
  messages: M.MESSAGES.en,
  elements: M.ELEMENT_NAMES.en,
  speciesNames: Object.fromEntries(
    Object.entries(M.SPECIES_EN_NAMES).map(([code, name]) => [code, name.toLocaleLowerCase("en")]),
  ),
  speciesDescriptions: M.SPECIES_EN_DESC,
  speciesGenericDescription: "A mysterious Gulugulu creature with a one-of-a-kind design.",
  shell: M.SHELL.en,
  onboarding: M.ONBOARDING_EN_COPY,
  onboardingUi: M.ONBOARDING_UI_EN,
  factoryFirstRun: M.FACTORY_FIRST_RUN_COPY.en,
  achievements: Object.fromEntries(Object.entries(M.ACHIEVEMENT_NAMES).map(([id, names]) => [id, names.en])),
  rogueKeywords: Object.fromEntries(keywordIds.map((id) => [id, M.rogueKeywordText(id, "en")])),
  quotes: Object.fromEntries(englishQuotes.map((quote) => [quote.id, quote.text])),
  factoryRogueCards: cardSource,
  debug: M.DEBUG_EN,
};
const zhCardSource = Object.fromEntries(
  Object.entries(M.FACTORY_ROGUE["zh-Hans"].cards).map(([id, card]) => [
    id,
    {
      name: card.name,
      descriptions: Array.from({ length: cardLevels.get(id) ?? 1 }, (_, index) => card.desc(index + 1)),
    },
  ]),
);
const zhReferenceTree = {
  ui: M.STRINGS["zh-Hans"],
  backyard: M.BACKYARD["zh-Hans"],
  factoryRogue: cloneStatic(M.FACTORY_ROGUE["zh-Hans"]),
  messages: M.MESSAGES["zh-Hans"],
  elements: M.ELEMENT_NAMES["zh-Hans"],
  shell: M.SHELL["zh-Hans"],
  onboardingUi: M.ONBOARDING_UI_ZH,
  factoryFirstRun: M.FACTORY_FIRST_RUN_COPY["zh-Hans"],
  achievements: Object.fromEntries(Object.entries(M.ACHIEVEMENT_NAMES).map(([id, names]) => [id, names.zh])),
  rogueKeywords: Object.fromEntries(keywordIds.map((id) => [id, M.rogueKeywordText(id, "zh-Hans")])),
  factoryRogueCards: zhCardSource,
  debug: M.DEBUG_STRINGS["zh-Hans"],
};
const bilingualEnglishStrings = flattenStrings(sourceTree);
const bilingualChineseStrings = flattenStrings(zhReferenceTree);
const bilingualPaths = [...bilingualChineseStrings.keys()].filter((path) => bilingualEnglishStrings.has(path));
ok(bilingualPaths.length >= 900, `英文＋简中双源语义校对覆盖 ${bilingualPaths.length} 个同位置文本`);
const bilingualSourcePlaceholderIssues = bilingualPaths.filter((path) => (
  placeholders(bilingualEnglishStrings.get(path)) !== placeholders(bilingualChineseStrings.get(path))
));
ok(
  bilingualSourcePlaceholderIssues.length === 0,
  `英文与简中参考文本占位符一致${bilingualSourcePlaceholderIssues.length ? `（${bilingualSourcePlaceholderIssues.slice(0, 12).join("、")}）` : ""}`,
);

const glossaryTokens = factoryCardGlossary.sourceTerms.map((term) => term.token);
const glossaryPatterns = factoryCardGlossary.sourceTerms.map((term) => ({
  ...term,
  regex: new RegExp(term.pattern, term.flags?.includes("i") ? "iu" : "u"),
}));
const keywordGlossaryTokens = {
  ignite: "IGNITE", circuit: "CIRCUIT", branch: "BRANCH", frozen: "FROZEN",
  overstaff: "OVERSTAFF", sameName: "SAME_NAME", convert: "CONVERT", grow: "GROW",
  lush: "LUSH", height: "HEIGHT", absorb: "ABSORB", size: "SIZE", stick: "STICK",
};
ok(
  ids.every((id) => glossaryTokens.every((token) => factoryCardGlossary.locales[id]?.[token]?.trim())),
  `21 种语言的 ${glossaryTokens.length} 个工厂卡牌概念术语齐全`,
);

const localeStaticTree = (id) => id === "en" || id === "zh-Hans"
  ? {
      ui: M.STRINGS[id],
      backyard: M.BACKYARD[id],
      factoryRogue: cloneStatic(M.FACTORY_ROGUE[id]),
      messages: M.MESSAGES[id],
      shell: M.SHELL[id],
    }
  : generated[id];
const spuriousMnemonic = /(?:\(([A-Z])\)|（([A-Z])）)(?=\{\w+\}|\s*$)/u;
const mnemonicPollution = ids.flatMap((id) =>
  [...flattenStrings(localeStaticTree(id)).entries()]
    .filter(([, text]) => spuriousMnemonic.test(text))
    .map(([key, text]) => `${id}:${key}=${text}`),
);
ok(
  mnemonicPollution.length === 0,
  `21 种语言无多余的按钮助记键/占位符字母${mnemonicPollution.length ? `（${mnemonicPollution.slice(0, 10).join(" | ")}）` : ""}`,
);

const universallyShared = new Set([
  "{name} · T{from} → T{to}", "T{from} → T{to}", "{cost}🪙", "1d", "1w", "1m",
  "No.{n}", "KPI", "EXP {value}/{max}", "Combo ×{n}", "{n}-color", "⏱ {s}s",
  "{provider}: {err}", "“{name}”", "🎉 {msg}", "★MAX!",
  " 🏠 local",
]);
const naturallyShared = {
  fr: new Set(["Parents: {a} × {b}", "Rare", "Normal", "{n} minute", "{n} minutes", "Important", "Tycoon", "Circuit", "📖 Collection", "📖 Collection {collected}/{total}"]),
  de: new Set(["📖 Museum", "Normal", "{n} minute"]),
  "es-ES": new Set(["Total", "Local", "Superconductor", "Error"]),
  "es-419": new Set(["Total", "Local", "Superconductor", "Error"]),
  "pt-BR": new Set(["Total", "Local"]),
  "pt-PT": new Set(["Total", "Local"]),
  it: new Set(["Tycoon"]),
  tr: new Set(["Tycoon", "Normal"]),
  id: new Set(["Total", "📖 Museum", "Steam debug"]),
  nl: new Set(["AI variant #{index}", "📖 Museum", "Circuit"]),
};
const allowedExact = (language, text) => universallyShared.has(text) || naturallyShared[language]?.has(text);
const reviewedFactoryActionKeys = new Set(["hubBack", "loStart", "hudBack", "hirePayStart", "hireGoBack", "lbBack", "sumBack"]);
const reviewedFactoryShiftKeys = new Set(reviewedShiftKeys);
const reviewedFactoryTermKeySet = new Set(reviewedFactoryTermKeys);
const reviewedResumeKeySet = new Set(reviewedResumeKeys);
const reviewedPaymentButtonKeySet = new Set(reviewedPaymentButtonKeys);
const reviewedFactoryCoreSourceSet = new Set(FACTORY_CORE_FLOW_SOURCES);
const reviewedFactoryCoreKeySet = new Set(
  Object.entries(M.FACTORY_ROGUE.en)
    .filter(([, text]) => typeof text === "string" && reviewedFactoryCoreSourceSet.has(text))
    .map(([key]) => key),
);
const isReviewedOverridePath = (language, key) => (
  key.startsWith("ui.")
    && getPath(M.UI_LOCALES[language], key.slice("ui.".length)) != null
) || (
  key.startsWith("backyard.")
    && (
      getPath(M.BACKYARD_LABEL_LOCALES[language], key.slice("backyard.".length)) != null
      || getPath(M.BACKYARD_SEMANTIC_LOCALES[language], key.slice("backyard.".length)) != null
    )
) || (
  key.startsWith("shell.")
    && getPath(M.SHELL_COLLECTION_LOCALES[language], key.slice("shell.".length)) != null
) || (
  key.startsWith("factoryRogue.")
    && (
      reviewedFactoryActionKeys.has(key.slice("factoryRogue.".length))
      || reviewedFactoryShiftKeys.has(key.slice("factoryRogue.".length))
      || reviewedFactoryTermKeySet.has(key.slice("factoryRogue.".length))
      || reviewedResumeKeySet.has(key.slice("factoryRogue.".length))
      || reviewedPaymentButtonKeySet.has(key.slice("factoryRogue.".length))
      || reviewedFactoryCoreKeySet.has(key.slice("factoryRogue.".length))
    )
);

// In every source below, Shift means a factory work period—not movement,
// switching, translation, or a bit-shift operation. These stems catch the
// exact bad senses that previously reached the UI.
const FORBIDDEN_SHIFT_SENSES = {
  "zh-Hant": ["移位", "轉變", "移動"],
  ja: ["移動"],
  ko: ["이동"],
  fr: ["déplacement", "changement"],
  de: ["verschieb", "umschalt"],
  "es-ES": ["cambio", "desplaz"],
  "es-419": ["cambio", "desplaz"],
  "pt-BR": ["desloc", "mudança"],
  "pt-PT": ["desloc", "mudança"],
  ru: ["сдвиг"],
  it: ["spostamento", "cambio"],
  pl: ["przesunię"],
  tr: ["değişim"],
  uk: ["зсув", "шифт"],
  ar: ["التحول", "الشحن"],
  th: ["เลื่อนบิต", "การเปลี่ยนแปลง"],
  vi: ["dịch", "thay đổi"],
  id: ["pergeseran"],
  nl: ["verschuiving"],
};
const NON_LATIN_CARD_LOCALES = new Set(["ja", "ko", "ru", "uk", "ar", "th"]);
const ALLOWED_CARD_LATIN_TOKEN_RE = /\b(?:Gulus?|KPI|Lv)\b/giu;

for (const id of generatedIds) {
  const locale = generated[id];
  ok(expectedGeneratedDomains.every((domain) => locale[domain] != null), `${id}: 17 个运行时翻译域齐全`);
  ok(Object.keys(locale.quotes ?? {}).length === englishQuotes.length, `${id}: 默认角色对话 ${englishQuotes.length}/${englishQuotes.length}`);
  ok(Object.keys(locale.onboarding ?? {}).length === Object.keys(M.ONBOARDING_EN_COPY).length, `${id}: 新手引导 60/60`);
  ok(Object.keys(locale.achievements ?? {}).length === Object.keys(M.ACHIEVEMENT_NAMES).length, `${id}: 成就名称完整`);
  ok(Object.keys(locale.rogueKeywords ?? {}).length === keywordIds.length, `${id}: 卡牌关键词完整`);
  ok(
    Object.entries(keywordGlossaryTokens).every(([keyword, token]) =>
      locale.rogueKeywords?.[keyword]?.name === factoryCardGlossary.locales[id]?.[token]
    ),
    `${id}: 卡牌关键词名称与效果说明术语一致`,
  );
  ok(Object.keys(locale.speciesNames ?? {}).length === Object.keys(M.SPECIES_EN_NAMES).length, `${id}: 默认物种名称 ${Object.keys(locale.speciesNames ?? {}).length}/${Object.keys(M.SPECIES_EN_NAMES).length}`);
  ok(defaultRecipeSpecies.every((code) => locale.speciesNames?.[code]?.trim()), `${id}: 默认配方物种名称 ${defaultRecipeSpecies.length}/${defaultRecipeSpecies.length}`);
  const cards = locale.factoryRogueCards ?? {};
  const expectedCardCount = Object.keys(cardSource).length;
  ok(Object.keys(cards).length === expectedCardCount, `${id}: 工厂卡牌 ${Object.keys(cards).length}/${expectedCardCount}`);
  ok(
    M.CARD_DEFS.every((card) => cards[card.id]?.name?.trim() && cards[card.id]?.descriptions?.length === (card.maxLevel ?? 1)),
    `${id}: 每张卡牌的名称与全部等级描述齐全`,
  );
  const cardGlossaryMismatches = [];
  const cardFormattingIssues = [];
  const cardEmbeddedEnglishIssues = [];
  for (const [cardId, sourceCard] of Object.entries(cardSource)) {
    const localizedCard = cards[cardId];
    for (let index = 0; index < sourceCard.descriptions.length; index += 1) {
      const sourceDescription = sourceCard.descriptions[index];
      const localizedDescription = localizedCard?.descriptions?.[index] ?? "";
      if (/[{}\\�]/u.test(localizedDescription)
        || localizedDescription.length > Math.max(180, sourceDescription.length * 5)) {
        cardFormattingIssues.push(`${cardId}@${index + 1}`);
      }
      if (NON_LATIN_CARD_LOCALES.has(id)
        && /[A-Za-z]{2,}/u.test(localizedDescription.replace(ALLOWED_CARD_LATIN_TOKEN_RE, ""))) {
        cardEmbeddedEnglishIssues.push(`${cardId}@${index + 1}`);
      }
      for (const term of glossaryPatterns) {
        if (!term.regex.test(sourceDescription)) continue;
        const expected = factoryCardGlossary.locales[id]?.[term.token];
        if (!expected || !localizedDescription.includes(expected)) {
          cardGlossaryMismatches.push(`${cardId}@${index + 1}:${term.token}`);
        }
      }
      if (/\{(?:WORK|TEAM|EXPLOITATION|FIRE|WATER|GRASS|ELECTRIC|ICE|NORMAL|GENERATED|OVERSTAFF|SAME|IGNITE|FROZEN|FREEZE|GROW|ABSORB|SIZE|CIRCUIT|BRANCH|CONVERT|LUSH|HEIGHT|STICK)[A-Z_]*\}/u.test(localizedDescription)) {
        cardGlossaryMismatches.push(`${cardId}@${index + 1}:unresolved-token`);
      }
    }
  }
  ok(
    cardGlossaryMismatches.length === 0,
    `${id}: 卡牌效果统一使用本语言概念术语${cardGlossaryMismatches.length ? `（${cardGlossaryMismatches.slice(0, 12).join("、")}）` : ""}`,
  );
  ok(
    cardFormattingIssues.length === 0,
    `${id}: 卡牌效果无异常占位符、转义串或爆长文本${cardFormattingIssues.length ? `（${cardFormattingIssues.slice(0, 12).join("、")}）` : ""}`,
  );
  ok(
    cardEmbeddedEnglishIssues.length === 0,
    `${id}: 非拉丁语卡牌效果无残余英文${cardEmbeddedEnglishIssues.length ? `（${cardEmbeddedEnglishIssues.slice(0, 12).join("、")}）` : ""}`,
  );

  const sourceStrings = flattenStrings(sourceTree);
  const localizedStrings = flattenStrings(locale);
  const bilingualStructureIssues = [];
  for (const path of bilingualPaths) {
    const englishText = bilingualEnglishStrings.get(path) ?? "";
    const chineseText = bilingualChineseStrings.get(path) ?? "";
    const localizedText = localizedStrings.get(path) ?? "";
    const englishEqualsAt = englishText.indexOf("=");
    const englishRightSideLetters = englishEqualsAt < 0
      ? []
      : (englishText.slice(englishEqualsAt + 1).replace(/\{[^}]+\}|\b(?:Gulus?|Gulugulu|AI|EXP|KPI)\b/giu, "").match(/\p{L}/gu) ?? []);
    if (englishEqualsAt >= 0 && chineseText.includes("=") && englishRightSideLetters.length >= 3) {
      const equalsAt = localizedText.indexOf("=");
      const rightSideLetters = equalsAt < 0
        ? []
        : (localizedText.slice(equalsAt + 1).replace(/\{[^}]+\}|\b(?:Gulus?|Gulugulu|AI|EXP|KPI)\b/giu, "").match(/\p{L}/gu) ?? []);
      if (equalsAt < 0 || rightSideLetters.length < 3) bilingualStructureIssues.push(`${path}:incomplete-equals`);
    }
    const englishLinks = placeholderLinks(englishText);
    const chineseLinks = placeholderLinks(chineseText);
    for (const link of englishLinks.filter((value) => chineseLinks.includes(value))) {
      const match = /^(\w+)([/:])(\w+)$/.exec(link);
      if (!match) continue;
      const separator = match[2] === "/" ? "\\/" : ":";
      const expected = new RegExp(`\\{${match[1]}\\}\\s*${separator}\\s*\\{${match[3]}\\}`, "u");
      if (!expected.test(localizedText)) bilingualStructureIssues.push(`${path}:broken-${link}`);
    }
    for (const operator of ["→", "↔", "≥"]) {
      if (englishText.includes(operator)
        && chineseText.includes(operator)
        && !localizedText.includes(operator)
        && !isReviewedOverridePath(id, path)) {
        bilingualStructureIssues.push(`${path}:missing-${operator}`);
      }
    }
  }
  ok(
    bilingualStructureIssues.length === 0,
    `${id}: 以简中复核英文后，等式、参数关系和方向语义完整${bilingualStructureIssues.length ? `（${bilingualStructureIssues.slice(0, 12).join("、")}）` : ""}`,
  );
  const missing = [...sourceStrings.entries()].filter(([, text]) => text.trim()).map(([key]) => key).filter((key) => !localizedStrings.get(key)?.trim());
  const broken = [...sourceStrings.entries()].filter(([key, text]) => placeholders(text) !== placeholders(localizedStrings.get(key) ?? ""));
  const protectedBroken = [...sourceStrings.entries()].filter(([key, text]) => {
    if (isReviewedOverridePath(id, key)) return false;
    const localized = localizedStrings.get(key) ?? "";
    return !preservesProtectedTokens(text, localized) || outerWhitespace(text) !== outerWhitespace(localized);
  });
  const corruptedSymbols = [...localizedStrings.entries()].filter(([key, text]) =>
    /[�□○▪]/u.test(text) && !/[�□○▪]/u.test(sourceStrings.get(key) ?? ""),
  );
  const inventedMnemonics = [...localizedStrings.entries()].filter(([key, text]) =>
    inventedMnemonic(sourceStrings.get(key) ?? "", text),
  );
  const brokenNumericAffixes = [...localizedStrings.entries()].filter(([key, text]) =>
    brokenNumericAffix(sourceStrings.get(key) ?? "", text),
  );
  const untranslated = [...sourceStrings.entries()].filter(
    ([key, text]) => {
      const localized = localizedStrings.get(key) ?? "";
      return hasTranslatableEnglish(text)
        && normalizedProse(text).length >= 4
        && normalizedProse(localized) === normalizedProse(text)
        && !allowedExact(id, text);
    },
  );
  const degenerate = [...localizedStrings.entries()].filter(([, text]) => {
    const words = text.split(/\s+/);
    const counts = new Map();
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
    return text.length > 1800 || Math.max(0, ...counts.values()) > 20;
  });
  const scriptMismatches = [...sourceStrings.entries()].filter(([key, text]) => {
    if (allowedExact(id, text)) return false;
    const sourceProse = stripProtected(text).replace(/[^\p{L}]/gu, "");
    if (sourceProse.length < 4 || /^[A-Z]{2,8}$/u.test(sourceProse)) return false;
    const localizedProse = stripProtected(localizedStrings.get(key) ?? "");
    if (!/\p{L}/u.test(localizedProse)) return false;
    const expected = EXPECTED_SCRIPT[id];
    if (expected) return !expected.test(localizedProse);
    return FOREIGN_NON_LATIN_SCRIPT.test(localizedProse);
  });
  const shiftSenseMismatches = [...sourceStrings.entries()].filter(([key, text]) => {
    if (!/\bshifts?\b/iu.test(text)) return false;
    const localized = (localizedStrings.get(key) ?? "").toLocaleLowerCase(id);
    return (FORBIDDEN_SHIFT_SENSES[id] ?? []).some((term) => localized.includes(term));
  });
  ok(missing.length === 0, `${id}: 生成资源无空值或缺失键${missing.length ? `（缺 ${missing.slice(0, 5).join(", ")}）` : ""}`);
  ok(broken.length === 0, `${id}: 生成资源占位符一致`);
  ok(protectedBroken.length === 0, `${id}: 专名、缩写、UI 符号与边界空格完整${protectedBroken.length ? `（${protectedBroken.slice(0, 10).map(([key]) => key).join("、")}）` : ""}`);
  ok(corruptedSymbols.length === 0, `${id}: 无替代方框/圆点等翻译污染${corruptedSymbols.length ? `（${corruptedSymbols.slice(0, 10).map(([key, text]) => `${key}=${text}`).join(" | ")}）` : ""}`);
  ok(inventedMnemonics.length === 0, `${id}: 无翻译器臆造的 (P)/(G) 等快捷键标记${inventedMnemonics.length ? `（${inventedMnemonics.slice(0, 10).map(([key, text]) => `${key}=${text}`).join(" | ")}）` : ""}`);
  ok(brokenNumericAffixes.length === 0, `${id}: 正负号与数值占位符保持相邻${brokenNumericAffixes.length ? `（${brokenNumericAffixes.slice(0, 10).map(([key, text]) => `${key}=${text}`).join(" | ")}）` : ""}`);
  ok(degenerate.length === 0, `${id}: 无重复/异常膨胀译文${degenerate.length ? `（${degenerate.slice(0, 10).map(([key, text]) => `${key}=${text.slice(0, 180)}`).join(" | ")}）` : ""}`);
  ok(shiftSenseMismatches.length === 0, `${id}: Shift 相关文案未误用“位移/切换”等错误义项${shiftSenseMismatches.length ? `（${shiftSenseMismatches.slice(0, 10).map(([key]) => key).join("、")}）` : ""}`);
  if (strict) ok(scriptMismatches.length === 0, `${id}: 译文文字系统与目标语言一致${scriptMismatches.length ? `（${scriptMismatches.slice(0, 20).map(([key, text]) => `${key}=${text}`).join(" | ")}）` : ""}`);
  if (strict) ok(untranslated.length === 0, `${id}: 无未声明的英文同文（剩余 ${untranslated.length}${untranslated.length ? `：${untranslated.slice(0, 30).map(([key, text]) => `${key}=${text}`).join(" | ")}` : ""}）`);
}

ok(
  generatedIds.every((id) => FACTORY_CORE_FLOW_SOURCES.every((englishText) => {
    const key = Object.entries(M.FACTORY_ROGUE.en).find(([, text]) => text === englishText)?.[0];
    return key && generated[id].factoryRogue?.[key] === LLM_REVIEWED_OVERRIDES[id]?.[englishText];
  })),
  `19 个追加语言的 ${FACTORY_CORE_FLOW_SOURCES.length} 个工厂主循环高风险文本均使用模型校对译文`,
);
const settlementScoreKeys = ["settlementDetails", "settlementTeam", "settlementBase", "settlementAbsorbed", "settlementExtra", "settlementPools"];
ok(
  generatedIds.every((id) => settlementScoreKeys.every((key) =>
    M.FACTORY_SETTLEMENT_SCORE_LOCALES[id]?.[key]?.trim()
    && M.FACTORY_ROGUE[id][key] === M.FACTORY_SETTLEMENT_SCORE_LOCALES[id][key]
  )),
  "19 个追加语言均使用人工校对的工厂结算计分标签",
);
const factoryActionLabelKeys = ["hubBack", "loStart", "hudBack", "hirePayStart", "hireGoBack", "lbBack", "sumBack"];
ok(
  generatedIds.every((id) => factoryActionLabelKeys.every((key) => {
    const reviewed = M.FACTORY_ACTION_LABEL_LOCALES[id]?.[key]?.trim();
    return reviewed
      && /[\p{L}\p{N}]/u.test(reviewed)
      && generated[id].factoryRogue?.[key] === reviewed
      && M.FACTORY_ROGUE[id][key] === reviewed;
  })),
  "19 个追加语言的工厂返回/开工按钮均使用非标点的人工校对译文",
);
const backyardLabelPaths = [
  "dexProgress", "museum.moreTitle", "museum.openBtn", "dex.overlayTitle", "dex.progress", "dexDetail.unknownDesc", "dexDetail.shareText",
  "decor.glade", "decor.wilds", "decor.hatchery", "decor.shop", "decor.board", "decor.museum", "decor.market", "decor.trainingHall",
  "scene.soilTitle", "scene.backBtn", "scene.yardUpgrade", "scene.yardUpgradeSub",
  "hatchery.collectPill", "nearPet.fuse", "nearPet.follow", "nearPet.release",
  "training.hallUnlocks", "training.hallMaxed", "training.materialsTitle", "training.pickTitle",
  "training.pickHint", "training.noEligible", "training.atTopTier",
];
const reviewedUiPaths = Object.keys(M.UI_LOCALES["zh-Hant"] ?? {});
ok(
  generatedIds.every((id) => reviewedUiPaths.every((path) => (
    generated[id].ui?.[path] === M.UI_LOCALES[id]?.[path]
    && M.STRINGS[id]?.[path] === M.UI_LOCALES[id]?.[path]
  ))),
  `19 个追加语言的 ${reviewedUiPaths.length} 个高频界面文本均使用人工校对译文`,
);
ok(
  generatedIds.every((id) => backyardLabelPaths.every((path) => {
    const reviewed = getPath(M.BACKYARD_LABEL_LOCALES[id], path)?.trim();
    return reviewed
      && /[\p{L}\p{N}]/u.test(reviewed.replace(/\{[^}]+\}/g, ""))
      && getPath(generated[id].backyard, path) === reviewed
      && getPath(M.BACKYARD[id], path) === reviewed;
  })),
  "19 个追加语言的收藏、后院导航、常驻动作与升阶术语均使用人工校对译文",
);
const hatcheryUnlockPaths = [
  "hatchery.unlockThisTitle", "hatchery.unlockPrevTitle", "hatchery.unlockPill",
  "hatchery.lockedPill", "hatchery.needCoinsUnlock",
];
ok(
  generatedIds.every((id) => hatcheryUnlockPaths.every((path) => {
    const reviewed = getPath(M.BACKYARD_LABEL_LOCALES[id], path)?.trim();
    return reviewed && getPath(M.BACKYARD[id], path) === reviewed;
  })),
  "19 个追加语言的蛋坑解锁文案均使用人工校对译文",
);
const backyardSemanticPaths = [
  "training.lockedHint", "training.slots", "training.remaining", "training.openBtn",
  "training.costTime", "training.universalShort", "scene.backTitle",
];
ok(
  generatedIds.every((id) => backyardSemanticPaths.every((path) => {
    const reviewed = getPath(M.BACKYARD_SEMANTIC_LOCALES[id], path)?.trim();
    return reviewed
      && getPath(generated[id].backyard, path) === reviewed
      && getPath(M.BACKYARD[id], path) === reviewed;
  })),
  "19 个追加语言的训练馆多义短句均通过简中语义复核",
);
const shellCollectionPaths = ["tutorial.graduation", "tutorial.pokedex"];
ok(
  generatedIds.every((id) => shellCollectionPaths.every((path) => {
    const reviewed = getPath(M.SHELL_COLLECTION_LOCALES[id], path)?.trim();
    return reviewed
      && getPath(generated[id].shell, path) === reviewed
      && getPath(M.SHELL[id], path) === reviewed;
  })),
  "19 个追加语言的收藏引导使用人工校对译文",
);
const collectionLabelPaths = [
  "dexProgress", "museum.moreTitle", "museum.openBtn", "dex.overlayTitle", "dex.progress", "dexDetail.unknownDesc", "dexDetail.shareText",
];
ok(
  ids.every((id) => (
    collectionLabelPaths.every((path) => !/\bDex\b/iu.test(getPath(M.BACKYARD[id], path) ?? ""))
    && shellCollectionPaths.every((path) => !/\bDex\b/iu.test(getPath(M.SHELL[id], path) ?? ""))
  )),
  "21 种语言的玩家可见收藏文案与引导不再误用 Dex",
);
ok(Object.keys(M.SPECIES_EN_NAMES).length === Object.keys(M.CONFIG.species).length, "84 个默认物种均有可翻译语义名");
ok(
  generatedIds.every((id) => Object.keys(M.SPECIES_NAME_OVERRIDES[id] ?? {}).length === Object.keys(M.CONFIG.species).length),
  "19 个追加语言均有 84 个固定物种人工命名",
);
const speciesNameViolations = generatedIds.flatMap((id) => {
  const entries = Object.entries(M.SPECIES_NAME_OVERRIDES[id] ?? {});
  const seen = new Set();
  return entries.flatMap(([code, name]) => {
    const normalized = name.toLocaleLowerCase(id);
    const issues = [];
    if (seen.has(normalized)) issues.push(`${id}/${code}=重名`);
    if (name.trim().split(/\s+/).length > 2) issues.push(`${id}/${code}=超过两词`);
    seen.add(normalized);
    return issues;
  });
});
ok(
  speciesNameViolations.length === 0,
  `人工物种名在每种语言中唯一且不超过两个空格分词${speciesNameViolations.length ? `（${speciesNameViolations.join("、")}）` : ""}`,
);
ok(
  generatedIds.every((id) => Object.entries(M.SPECIES_NAME_OVERRIDES[id] ?? {}).every(
    ([code, name]) => generated[id]?.speciesNames?.[code] === name,
  )),
  "运行时生成资源与人工物种词表完全同步",
);

const languageSupport = JSON.parse(readFileSync(join(REPO_ROOT, "scripts", "steam", "localization", "language-support.json"), "utf8"));
ok(languageSupport.languages.length === 21, "Steam 语言支持表包含 21 项");
ok(languageSupport.languages.every((entry) => !entry.fullAudio && !entry.subtitles), "Steam 不误声明音频或字幕支持");
ok(
  languageSupport.languages.filter((entry) => entry.steam).every((entry) => ids.includes(entry.app) && steamIds.includes(entry.steam)),
  "应用语言与 Steam 官方语言码映射有效",
);
ok(languageSupport.languages.find((entry) => entry.app === "ar")?.steam === null, "阿拉伯语仅声明为应用内语言");

const itemdefs = JSON.parse(readFileSync(join(REPO_ROOT, "scripts", "steam", "out", "itemdefs.i18n.json"), "utf8"));
const visibleItems = itemdefs.items.filter((item) => item.type === "item");
for (const steamId of steamIds.filter((id) => id !== "english")) {
  const complete = visibleItems.filter(
    (item) => item[`name_${steamId}`] && item[`display_type_${steamId}`] && item[`description_${steamId}`],
  ).length;
  ok(complete === visibleItems.length, `${steamId}: Steam 可见物品 ${complete}/${visibleItems.length}`);
}
const safeItemdefs = JSON.parse(readFileSync(join(REPO_ROOT, "scripts", "steam", "out", "itemdefs.i18n.safe.json"), "utf8"));
const safeItemsById = new Map(safeItemdefs.items.map((item) => [String(item.itemdefid), item]));
const steamByApp = new Map(languageSupport.languages.map(({ app, steam }) => [app, steam]));
ok(
  generatedIds.filter((id) => steamByApp.get(id)).every((id) => {
    const field = `name_${steamByApp.get(id)}`;
    return Object.entries(M.CONFIG.species).every(([code, info]) =>
      safeItemsById.get(String(info.steamItemDef))?.[field] === M.SPECIES_NAME_OVERRIDES[id]?.[code]
    );
  }),
  "Steam 安全上传包与 18 个平台语言的 84 个物种名完全同步",
);

if (failures > 0) {
  console.error(`\n✗ verify_i18n: ${failures} 项失败`);
  process.exit(1);
}
console.log(`\n✓ verify_i18n: ${strict ? "严格" : "常规"}本地化校验通过`);
