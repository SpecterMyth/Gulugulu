import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildSync } from "esbuild";
import { applyReviewedFactoryCardDescriptions } from "./factory_card_reviewed_descriptions.mjs";
import {
  FACTORY_CORE_FLOW_SOURCES,
  LLM_REVIEWED_OVERRIDES,
} from "./localization_llm_reviewed_overrides.mjs";

const APP_ROOT = join(import.meta.dirname, "..");
const OUTPUT = join(APP_ROOT, "src", "i18n", "generated", "runtimeLocales.json");
const CACHE = join(APP_ROOT, ".localization-translation-cache.json");
const LOCALIZATION_CONTEXT = JSON.parse(
  readFileSync(join(import.meta.dirname, "localization_context.json"), "utf8"),
);
const FACTORY_CARD_GLOSSARY = JSON.parse(
  readFileSync(join(import.meta.dirname, "factory_card_glossary.json"), "utf8"),
);
for (const terms of Object.values(FACTORY_CARD_GLOSSARY.locales)) {
  Object.assign(terms, { ...FACTORY_CARD_GLOSSARY.defaultTerms, ...terms });
}
const LOCALIZATION_REVISION = `${LOCALIZATION_CONTEXT.revision}:${FACTORY_CARD_GLOSSARY.revision}`;
const TRADITIONAL_FACTORY_CARD_REVISION = 4;
const CONTEXT_PATTERNS = LOCALIZATION_CONTEXT.patterns.map(
  (rule) => new RegExp(rule.pattern, rule.flags?.includes("i") ? "iu" : "u"),
);
const FACTORY_CARD_TERM_PATTERNS = FACTORY_CARD_GLOSSARY.sourceTerms.map(
  (rule) => new RegExp(rule.pattern, rule.flags?.includes("i") ? "iu" : "u"),
);
const FACTORY_KEYWORD_GLOSSARY_TOKENS = {
  ignite: "IGNITE",
  circuit: "CIRCUIT",
  branch: "BRANCH",
  frozen: "FROZEN",
  overstaff: "OVERSTAFF",
  sameName: "SAME_NAME",
  convert: "CONVERT",
  grow: "GROW",
  lush: "LUSH",
  height: "HEIGHT",
  absorb: "ABSORB",
  size: "SIZE",
  stick: "STICK",
};
const CONTEXT_PATTERN_EXCLUSIONS = new Set(LOCALIZATION_CONTEXT.patternExclusions ?? []);
const contextApplies = (text) => !CONTEXT_PATTERN_EXCLUSIONS.has(text) && (
  Object.hasOwn(LOCALIZATION_CONTEXT.clarifications, text)
  || CONTEXT_PATTERNS.some((pattern) => pattern.test(text))
);
const SHIFT_SENSE_CORRECTIONS = Object.fromEntries(
  Object.entries(LOCALIZATION_CONTEXT.shiftSenseCorrections).map(([locale, rules]) => [
    locale,
    rules.map((rule) => [
      new RegExp(rule.pattern.replaceAll("\\w", "[\\p{L}\\p{M}]"), "giu"),
      rule.replacement,
    ]),
  ]),
);
const normalizeShiftSemantics = (sourceText, localizedText, locale) => {
  if (!/\bshifts?\b/iu.test(sourceText)) return localizedText;
  for (const [pattern, replacement] of SHIFT_SENSE_CORRECTIONS[locale] ?? []) {
    localizedText = localizedText.replace(pattern, replacement);
  }
  return localizedText;
};
const removeSpuriousMnemonics = (sourceText, localizedText) => {
  const leadingWhitespace = sourceText.match(/^\s*/u)?.[0] ?? "";
  const trailingWhitespace = sourceText.match(/\s*$/u)?.[0] ?? "";
  localizedText = localizedText
    .replace(/\(([A-Z])\)(?=\{\w+\})/gu, "(")
    .replace(/（([A-Z])）(?=\{\w+\})/gu, "（");
  // Translators sometimes invent desktop-menu mnemonics such as `(P)` in the
  // middle of a button label. Remove all such markers when the source has none.
  if (!/[（(][A-Z][）)]/u.test(sourceText)) {
    localizedText = localizedText.replace(/\s*[（(][A-Z][）)]\s*/gu, " ").trim();
  }
  return `${leadingWhitespace}${localizedText.trim()}${trailingWhitespace}`;
};
const normalizeNumericAffixes = (sourceText, localizedText) => {
  // A sign is part of the numeric value. Repair MT output such as
  // `+ key {exp} EXP` without touching the localized prose around it.
  for (const match of sourceText.matchAll(/([+−])\{(\w+)\}/gu)) {
    const [, operator, name] = match;
    const escapedOperator = operator === "+" ? "\\+" : operator;
    localizedText = localizedText.replace(
      new RegExp(`${escapedOperator}[^{}]{0,16}\\{${name}\\}`, "u"),
      `${operator}{${name}}`,
    );
  }
  return localizedText;
};
const normalizePlaceholderLinks = (sourceText, localizedText) => {
  for (const match of sourceText.matchAll(/\{(\w+)\}\s*([/:])\s*\{(\w+)\}/gu)) {
    const [, left, separator, right] = match;
    const localizedLink = new RegExp(`\\{${left}\\}[^{}]*\\{${right}\\}`, "u");
    localizedText = localizedText.replace(localizedLink, `{${left}}${separator}{${right}}`);
  }
  return localizedText;
};
const targetArg = process.argv.find((arg) => arg.startsWith("--languages="));
const improveUntranslated = process.argv.includes("--improve-untranslated");

// Must mirror argos_translate_worker.py.  These tokens are UI contracts, not
// prose: a locale may translate everything around them but never replace them.
const PROTECTED_TOKEN_RE = /\{\w+\}|(?:[\u{1F000}-\u{1FAFF}\u2190-\u2BFF](?:[\uFE0E\uFE0F])?(?:\u200D[\u{1F000}-\u{1FAFF}\u2190-\u2BFF](?:[\uFE0E\uFE0F])?)*)|\b(?:Claude Code|Codex CLI|Gulugulu|Claude|Codex|Steam|KPIs?|EXP|AI|CLI|Gulus?|GULUS?)\b(?:\(s\))?(?:['’]s|['’])?(?:[,.;:!?…—–/+\-]\s*|\s+)?|Lv(?:\d+|\{\w+\})|T(?:\d+(?:[–-]\d+)?|\{\w+\})|No\.(?:\d+|\{\w+\})?|[←→↔×✓✔★☆‹›–—‘’“”「」『』·\/]/gu;

const TARGETS = {
  "zh-Hant": "zh",
  ja: "ja",
  ko: "ko",
  fr: "fr",
  de: "de",
  "es-ES": "es",
  "es-419": "es",
  "pt-BR": "pt",
  "pt-PT": "pt",
  ru: "ru",
  it: "it",
  pl: "pl",
  tr: "tr",
  uk: "uk",
  ar: "ar",
  th: "th",
  vi: "vi",
  id: "id",
  nl: "nl",
};
const EXPECTED_SCRIPT = {
  "zh-Hant": /\p{Script=Han}/u,
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  ko: /\p{Script=Hangul}/u,
  ru: /\p{Script=Cyrillic}/u,
  uk: /\p{Script=Cyrillic}/u,
  ar: /\p{Script=Arabic}/u,
  th: /\p{Script=Thai}/u,
};

const selected = targetArg
  ? targetArg.slice("--languages=".length).split(",").filter(Boolean)
  : Object.keys(TARGETS);
for (const id of selected) {
  if (!(id in TARGETS)) throw new Error(`Unknown target language: ${id}`);
}
for (const id of Object.keys(TARGETS)) {
  const missingCoreCopy = FACTORY_CORE_FLOW_SOURCES.filter(
    (englishText) => typeof LLM_REVIEWED_OVERRIDES[id]?.[englishText] !== "string",
  );
  if (missingCoreCopy.length > 0) {
    throw new Error(
      `${id}: missing ${missingCoreCopy.length} model-reviewed factory core-flow translation(s):\n`
      + missingCoreCopy.map((text) => JSON.stringify(text)).join("\n"),
    );
  }
}

// "Combo" is a universal game term in Gulugulu. Keep the compact HUD/pop
// label byte-identical in every locale instead of translating it.
const UNIVERSAL_REVIEWED_OVERRIDES = {
  "Combo ×{n}": "Combo ×{n}",
  " · T{tier}": " · T{tier}",
  ", ": ", ",
  " · AI ×{count}": " · AI ×{count}",
};

// EXP gain is a compact game notification, not an instruction involving the
// "+ key". Machine translation has repeatedly interpreted the leading plus
// sign as a keyboard key (and once duplicated it four times), so keep both
// variants human-reviewed in every generated locale.
const REVIEWED_EXP_GAIN = {
  "zh-Hant": ["+{exp} EXP！", "+{exp} EXP — 升級啦！🎉"],
  ja: ["+{exp} EXP！", "+{exp} EXP — レベルアップ！🎉"],
  ko: ["+{exp} EXP!", "+{exp} EXP — 레벨 업! 🎉"],
  fr: ["+{exp} EXP !", "+{exp} EXP — niveau supérieur ! 🎉"],
  de: ["+{exp} EXP!", "+{exp} EXP — Stufe hoch! 🎉"],
  "es-ES": ["+{exp} EXP!", "+{exp} EXP — ¡subes de nivel! 🎉"],
  "es-419": ["+{exp} EXP!", "+{exp} EXP — ¡subes de nivel! 🎉"],
  "pt-BR": ["+{exp} EXP!", "+{exp} EXP — subiu de nível! 🎉"],
  "pt-PT": ["+{exp} EXP!", "+{exp} EXP — subiste de nível! 🎉"],
  ru: ["+{exp} EXP!", "+{exp} EXP — новый уровень! 🎉"],
  it: ["+{exp} EXP!", "+{exp} EXP — livello su! 🎉"],
  pl: ["+{exp} EXP!", "+{exp} EXP — nowy poziom! 🎉"],
  tr: ["{exp} EXP kazandın!", "{exp} EXP kazandın — seviye atladın! 🎉"],
  uk: ["+{exp} EXP!", "+{exp} EXP — новий рівень! 🎉"],
  ar: ["حصلت على {exp} EXP!", "حصلت على {exp} EXP — ارتقيت! 🎉"],
  th: ["ได้รับ {exp} EXP!", "ได้รับ {exp} EXP — เลเวลอัป! 🎉"],
  vi: ["Nhận {exp} EXP!", "Nhận {exp} EXP — lên cấp! 🎉"],
  id: ["Dapat {exp} EXP!", "Dapat {exp} EXP — naik level! 🎉"],
  nl: ["+{exp} EXP!", "+{exp} EXP — level omhoog! 🎉"],
};
const REVIEWED_PLUS_SIGN_UI = {
  "zh-Hant": {
    "Full shift done! This bar: 🪙+{coins} ✨+{exp}": "整個班次完成！本輪：🪙+{coins} ✨+{exp}",
    "+{amount} coins (current: {coins})": "金幣 +{amount}（目前 {coins}）",
  },
  ko: {
    "Full shift done! This bar: 🪙+{coins} ✨+{exp}": "한 교대 완료! 이번 수익: 🪙+{coins} ✨+{exp}",
    "+{amount} coins (current: {coins})": "코인 +{amount} (현재 {coins})",
  },
  tr: {
    "+{amount} coins (current: {coins})": "{amount} jeton kazandın (toplam: {coins})",
  },
};

// Small, reviewed overrides for known model degeneration on very short Turkish
// fragments. Keeping them source-keyed also makes regeneration deterministic.
const REVIEWED_OVERRIDES = {
  ja: {
    "+{amount} coins (current: {coins})": "+{amount} コイン（現在：{coins}）",
    "Codex + Claude Code online": "Codex + Claude Code オンライン",
    "+{exp} EXP!": "+{exp} EXP！",
  },
  ko: {
    "After scoring: 10% chance to Absorb nearest Gulu; larger Size wins; if equal, scoring Gulu wins":
      "득점 후: 10% 확률로 가장 가까운 Gulu를 흡수; 크기가 큰 쪽이 흡수하고, 같으면 득점한 Gulu가 흡수",
    "After scoring: 20% chance to Absorb nearest Gulu; larger Size wins; if equal, scoring Gulu wins":
      "득점 후: 20% 확률로 가장 가까운 Gulu를 흡수; 크기가 큰 쪽이 흡수하고, 같으면 득점한 Gulu가 흡수",
    "After scoring: 30% chance to Absorb nearest Gulu; larger Size wins; if equal, scoring Gulu wins":
      "득점 후: 30% 확률로 가장 가까운 Gulu를 흡수; 크기가 큰 쪽이 흡수하고, 같으면 득점한 Gulu가 흡수",
    "After scoring: 40% chance to Absorb up to 2 nearest Gulus; larger Size wins; if equal, scoring Gulu wins":
      "득점 후: 40% 확률로 가까운 Gulu를 최대 2마리 흡수; 크기가 큰 쪽이 흡수하고, 같으면 득점한 Gulu가 흡수",
    "After scoring: 60% chance to Absorb up to 3 nearest Gulus; larger Size wins; if equal, scoring Gulu wins":
      "득점 후: 60% 확률로 가까운 Gulu를 최대 3마리 흡수; 크기가 큰 쪽이 흡수하고, 같으면 득점한 Gulu가 흡수",
    "📖 Museum": "📖 박물관",
    "🌅 Welcome back!": "🌅 다시 오신 것을 환영해요!",
    "Guluduck's too stuffed to walk, burping and wondering if it joined a sweatshop.":
      "Guluduck은 배가 너무 불러 걷지도 못한 채, 트림하며 ‘내가 악덕 공장에 들어온 건가?’ 고민해요.",
  },
  fr: {
    "matcha tapir": "tapir au matcha",
    "Steam debug": "Débogage Steam",
    "GULU HIRING": "RECRUTEMENT GULU",
    "✨ Fuse!": "✨ Fusion !",
    "10K CLUB!": "CLUB DES 10 K !",
    "MILLIONAIRE!": "MILLIONNAIRE !",
  },
  de: {
    "KPI Met": "KPI erreicht",
    "Steam Global Leaderboard": "Globale Steam-Bestenliste",
    "GLOBAL FACTORY LEADERBOARD": "GLOBALE FABRIK-BESTENLISTE",
    Rebind: "Tastenbelegung ändern",
    "Codex + Claude Code online": "Codex + Claude Code sind online",
    "Claude Code online": "Claude Code ist online",
    "Default agent": "Standard-Assistent",
    " · ☁️ Cloud save on": " · ☁️ Cloud-Speicher an",
    " · ☁️ Cloud save off": " · ☁️ Cloud-Speicher aus",
    "Cache read": "Cache gelesen",
    "Copy share link": "Freigabelink kopieren",
    "After-shift Shop (Shift {n})": "Feierabend-Shop (Schicht {n})",
    "Save & leave": "Speichern & gehen",
    "Shift bill {v}": "Schichtrechnung {v}",
    "10K CLUB!": "CLUB DER ZEHNTAUSENDER!",
    "100M MOGUL!": "100-MIO-MOGUL!",
    "Flash-Freeze Route": "Schockfrost-Route",
    "Team Player": "Teamgeist",
    "warm capybara": "Kuschelcapybara",
    "matcha tapir": "Teekannen-Tapir",
    "Final sprint!": "Endspurt!",
    "+{exp} EXP — level up! 🎉": "+{exp} EXP — Stufe hoch! 🎉",
    "Tap Start Fusion — boom!": "Start Fusion antippen — bumm!",
    "Skip tutorial": "Einführung überspringen",
    "{n} minute": "{n} Minute",
    "Pet pokes": "Haustier-Stupser",
    "Skip onboarding": "Einführung überspringen",
    "Resume tutorial": "Einführung fortsetzen",
    "Gotta Fuse 'Em All": "Fusionier sie alle!",
    "Code Snack": "Code-Häppchen",
    "Headcount cap +5": "Personallimit +5",
    "Steam debug": "Steam-Fehlersuche",
    "Factory debug": "Fabrik-Fehlersuche",
    "Multi-element fusion ({count})": "Mehrfach-Elementfusion ({count})",
  },
  "es-ES": {
    "Multiply wage growth for 1-color jobs by ×1.004.": "Multiplica el aumento salarial de los trabajos de 1 color por ×1.004.",
    "Migrated to Gluttony": "Ahora usa el efecto de Glotonería",
    "gulu duck": "pato Gulu",
    "gulu swan": "cisne Gulu",
    "inferno fox": "zorro infernal",
    "aurora mink": "visón aurora",
    "aurora owl": "búho aurora",
    "latte snowman": "muñeco de nieve latte",
    "ramen raccoon": "mapache de ramen",
    "yarn cat": "gato de lana",
    "matcha tapir": "tapir de matcha",
    "queen bee": "abeja reina",
    "terracotta pangolin": "pangolín de terracota",
    Moving: "En movimiento",
    Landing: "Aterrizaje",
    "Steam debug": "Depuración de Steam",
    "Factory debug": "Depuración de fábrica",
    "Steam Global Leaderboard": "Clasificación mundial de Steam",
    "GULU HIRING": "CONTRATACIÓN GULU",
    "GULU POOL": "RESERVA GULU",
    "CURRENT GULU POOL": "RESERVA GULU ACTUAL",
    "REROLL UNSELECTED GULUS": "VOLVER A SORTEAR GULUS NO ELEGIDOS",
    "GULU POOL FULL": "RESERVA GULU LLENA",
    "⬆ Yard Upgraded · Lv{level}": "⬆ Patio mejorado · Lv{level}",
    "💤 Gen unfinished": "💤 Generación pendiente",
    "📖 Open Dex": "📖 Abrir Dex",
    "Cache write": "Escritura de caché",
    "🍙 Tokens→✨EXP": "🍙 Fichas→✨EXP",
    "MILLIONAIRE!": "¡MILLONARIO!",
    "100M MOGUL!": "¡MAGNATE DE 100 M!",
    "KPI ACHIEVED!": "¡KPI LOGRADO!",
    "{count} TOTAL": "{count} EN TOTAL",
    "BEST SHIFT": "MEJOR TURNO",
    "WEEKENDS EXIST": "EXISTEN LOS FINES DE SEMANA",
  },
  "es-419": {
    "Multiply wage growth for 1-color jobs by ×1.004.": "Multiplica el aumento salarial de los trabajos de 1 color por ×1.004.",
    "Migrated to Gluttony": "Ahora usa el efecto de Glotonería",
    "gulu duck": "pato Gulu",
    "gulu swan": "cisne Gulu",
    "inferno fox": "zorro infernal",
    "aurora mink": "visón aurora",
    "aurora owl": "búho aurora",
    "latte snowman": "muñeco de nieve latte",
    "ramen raccoon": "mapache de ramen",
    "yarn cat": "gato de lana",
    "matcha tapir": "tapir de matcha",
    "queen bee": "abeja reina",
    "terracotta pangolin": "pangolín de terracota",
    Moving: "En movimiento",
    Landing: "Aterrizaje",
    "Steam debug": "Depuración de Steam",
    "Factory debug": "Depuración de fábrica",
    "Steam Global Leaderboard": "Clasificación mundial de Steam",
    "GULU HIRING": "CONTRATACIÓN GULU",
    "GULU POOL": "RESERVA GULU",
    "CURRENT GULU POOL": "RESERVA GULU ACTUAL",
    "REROLL UNSELECTED GULUS": "VOLVER A SORTEAR GULUS NO ELEGIDOS",
    "GULU POOL FULL": "RESERVA GULU LLENA",
    "⬆ Yard Upgraded · Lv{level}": "⬆ Patio mejorado · Lv{level}",
    "💤 Gen unfinished": "💤 Generación pendiente",
    "📖 Open Dex": "📖 Abrir Dex",
    "Cache write": "Escritura de caché",
    "🍙 Tokens→✨EXP": "🍙 Fichas→✨EXP",
    "MILLIONAIRE!": "¡MILLONARIO!",
    "100M MOGUL!": "¡MAGNATE DE 100 M!",
    "KPI ACHIEVED!": "¡KPI LOGRADO!",
    "{count} TOTAL": "{count} EN TOTAL",
    "BEST SHIFT": "MEJOR TURNO",
    "WEEKENDS EXIST": "EXISTEN LOS FINES DE SEMANA",
  },
  "pt-BR": {
    "messenger dove": "pombo-correio",
    "latte snowman": "boneco de neve latte",
    "snow bonsai": "bonsai de neve",
    "Steam debug": "Depuração da Steam",
    "🍙 Tokens→✨EXP": "🍙 Fichas→✨EXP",
    "MILLIONAIRE!": "MILIONÁRIO!",
  },
  "pt-PT": {
    "messenger dove": "pombo-correio",
    "latte snowman": "boneco de neve latte",
    "snow bonsai": "bonsai de neve",
    "Steam debug": "Depuração do Steam",
    "🍙 Tokens→✨EXP": "🍙 Fichas→✨EXP",
    "MILLIONAIRE!": "MILIONÁRIO!",
  },
  ru: {
    "Ignite: score Work Performance 6 extra time(s)": "Поджог: дополнительно засчитать эффективность работы 6 раз",
    "Ignite: score Work Performance 10 extra time(s)": "Поджог: дополнительно засчитать эффективность работы 10 раз",
  },
  it: {
    "gulu swan": "cigno Gulu",
    "inferno fox": "volpe infernale",
    "aurora mink": "visone aurora",
    "sauna pufferfish": "pesce palla da sauna",
    "moss shell snail": "lumaca dal guscio di muschio",
    "potion bat": "pipistrello delle pozioni",
    Dragging: "Trascinamento",
    Landing: "Atterraggio",
    "🛝 Classic Sandbox demo": "🛝 Demo sandbox classica",
    "✨ Fuse!": "✨ Fondi!",
    "Steam Trading": "Scambi Steam",
    "STOP THE GRIND": "BASTA SGOBBARE",
    "Steam debug": "Diagnostica di Steam",
  },
  pl: {
    "rock music rooster": "rockowy kogut",
    "matcha tapir": "tapir matcha",
    "Steam debug": "Debugowanie Steam",
    "⛔ Can't Fuse": "⛔ Nie można scalać",
    "Office Stack-Up": "Biurowa układanka",
    "MILLIONAIRE!": "MILIONER!",
    "SHIFT-END SHOP": "SKLEP PO ZMIANIE",
    "Flash-Freeze Route": "Trasa błyskawicznego mrożenia",
    "Fire-Eater": "Pożeracz ognia",
    "matcha tapir": "herbaciany tapir",
    "No Clock-Out": "Zmiana bez końca",
    "Debt-Free Graduate": "Absolwent bez długów",
  },
  tr: {
    "Migrated to Gluttony": "Artık Aşırı Açlık etkisini kullanır",
    "Headcount cap +5": "Personel sınırı +5",
    "gulu swan": "Gulu kuğusu",
    "aurora mink": "kutup ışığı vizonu",
    "aurora owl": "kutup ışığı baykuşu",
    "bubble bath otter": "köpük banyosu su samuru",
    "ramen raccoon": "ramen rakunu",
    "barbecue alligator": "barbekü timsahı",
    "terracotta pangolin": "terakota pangolini",
    Work: "İş",
    Off: "Kapalı",
    Cancel: "İptal",
    "Connect {name}": "{name} ile bağlan",
    Use: "Kullan",
    "Copy share link": "Paylaşım bağlantısını kopyala",
    Close: "Kapat",
    Maxed: "Maksimum",
    "Pick {n}/{total}": "Seç {n}/{total}",
    Common: "Yaygın",
    PICK: "SEÇ",
    "Office Network": "Ofis Ağı",
    Stamina: "Dayanıklılık",
    "{name} egg": "{name} yumurtası",
    "🤖 {provider} designing": "🤖 {provider} tasarlıyor",
    First: "İlk",
    "Updated {time}": "{time} tarihinde güncellendi",
    "Level {level}": "Seviye {level}",
    "Takes {time}": "{time} sürer",
    Superconductor: "Süperiletken",
    Dragging: "Sürükleniyor",
    "Deleted {deleted} Workshop item(s)": "{deleted} Atölye öğesi silindi",
    "Save debug": "Kayıt hata ayıklama",
    "Clear save": "Kaydı temizle",
    "Steam debug": "Steam hata ayıklama",
    "No {name} CLI detected — install it and sign in, then connect":
      "{name} CLI bulunamadı — kurup giriş yaptıktan sonra bağlan",
    "A “{name}” egg is in the hatchery": "“{name}” yumurtası kuluçkada",
    "A Steam operation on this egg is in progress — please wait":
      "Bu yumurtanın Steam işlemi sürüyor — biraz bekle",
    "A Steam operation on this pet is in progress — please wait":
      "Bu evcilin Steam işlemi sürüyor — biraz bekle",
    "A Gulu with exactly the same species as the scorer.":
      "Puanı getirenle birebir aynı türden bir Gulu.",
    "🛒 Steam Market": "🛒 Steam Pazarı",
    "Update Codex CLI": "Codex CLI sürümünü güncelle",
    "REROLL UNSELECTED GULUS": "SEÇİLMEYEN GULUS İÇİN YENİ SEÇİM",
    "Codex online": "Codex çevrimiçi",
    "Codex + Claude Code online": "Codex + Claude Code çevrimiçi",
    "Claude Code online": "Claude Code çevrimiçi",
    "📖 Open Dex": "📖 Dex'i aç",
    "{count} elems": "{count} element",
    "Ritual underway…": "Ritüel başladı…",
    "Paying…": "Ödeniyor…",
    "BEST SHIFT": "EN İYİ VARDİYA",
    Enable: "Aç",
    "Gotta Fuse 'Em All": "Hepsini Birleştir!",
    "1-color Gulus: bonus +1x": "1 renkli Gulus: +1x bonus",
    "1-color Gulus: bonus +3x": "1 renkli Gulus: +3x bonus",
    "1-color Gulus: bonus +7x": "1 renkli Gulus: +7x bonus",
    "2-color Gulus: bonus +1x": "2 renkli Gulus: +1x bonus",
    "2-color Gulus: bonus +3x": "2 renkli Gulus: +3x bonus",
    "2-color Gulus: bonus +7x": "2 renkli Gulus: +7x bonus",
    "{name} connected": "{name} bağlı",
    "{name} connected ({account})": "{name} bağlı ({account})",
  },
  uk: {
    "aurora mink": "норка полярного сяйва",
    "Generated live by your local {provider}": "Наживо створено вашим локальним {provider}",
  },
  ar: {
    "Multiply wage growth for 1-color jobs by ×1.004.": "اضرب نمو أجور الوظائف أحادية اللون في ×1.004.",
    "All 1-color Gulus gain bonus +1x.": "تحصل كل وحدات Gulu أحادية اللون على مكافأة +1x.",
    "All 1-color Gulus gain bonus +3x.": "تحصل كل وحدات Gulu أحادية اللون على مكافأة +3x.",
    "All 1-color Gulus gain bonus +7x.": "تحصل كل وحدات Gulu أحادية اللون على مكافأة +7x.",
    "All 1-color Gulus gain bonus +15x.": "تحصل كل وحدات Gulu أحادية اللون على مكافأة +15x.",
    "All 1-color Gulus gain bonus +39x.": "تحصل كل وحدات Gulu أحادية اللون على مكافأة +39x.",
    "All 2-color Gulus gain bonus +1x.": "تحصل كل وحدات Gulu ثنائية اللون على مكافأة +1x.",
    "All 2-color Gulus gain bonus +3x.": "تحصل كل وحدات Gulu ثنائية اللون على مكافأة +3x.",
    "All 2-color Gulus gain bonus +7x.": "تحصل كل وحدات Gulu ثنائية اللون على مكافأة +7x.",
    "All 2-color Gulus gain bonus +15x.": "تحصل كل وحدات Gulu ثنائية اللون على مكافأة +15x.",
    "All 2-color Gulus gain bonus +39x.": "تحصل كل وحدات Gulu ثنائية اللون على مكافأة +39x.",
    "All 3-color Gulus gain bonus +1x.": "تحصل كل وحدات Gulu ثلاثية اللون على مكافأة +1x.",
    "All 3-color Gulus gain bonus +3x.": "تحصل كل وحدات Gulu ثلاثية اللون على مكافأة +3x.",
    "All 3-color Gulus gain bonus +9x.": "تحصل كل وحدات Gulu ثلاثية اللون على مكافأة +9x.",
    "All 3-color Gulus gain bonus +24x.": "تحصل كل وحدات Gulu ثلاثية اللون على مكافأة +24x.",
    "All 3-color Gulus gain bonus +59x.": "تحصل كل وحدات Gulu ثلاثية اللون على مكافأة +59x.",
    "When a Gulu leaves by strike or dismissal, refund 25% of its hire price.": "عندما يغادر Gulu بسبب إضراب أو فصل، استرد 25% من تكلفة توظيفه.",
    "When a Gulu leaves by strike or dismissal, refund 50% of its hire price.": "عندما يغادر Gulu بسبب إضراب أو فصل، استرد 50% من تكلفة توظيفه.",
    "When a Gulu leaves by strike or dismissal, refund 1x of its hire price.": "عندما يغادر Gulu بسبب إضراب أو فصل، استرد 1x من تكلفة توظيفه.",
    "When a Gulu leaves by strike or dismissal, refund 2x of its hire price.": "عندما يغادر Gulu بسبب إضراب أو فصل، استرد 2x من تكلفة توظيفه.",
    "When a Gulu leaves by strike or dismissal, refund 3x of its hire price.": "عندما يغادر Gulu بسبب إضراب أو فصل، استرد 3x من تكلفة توظيفه.",
    "After the regular draft, run an extra draft with 1 Gulus.": "بعد الاختيار المعتاد، أجرِ اختيارًا إضافيًا يضم 1 من Gulu.",
    "After the regular draft, run an extra draft with 2 Gulus.": "بعد الاختيار المعتاد، أجرِ اختيارًا إضافيًا يضم 2 من Gulu.",
    "After the regular draft, run an extra draft with 3 Gulus.": "بعد الاختيار المعتاد، أجرِ اختيارًا إضافيًا يضم 3 من Gulu.",
    "After the regular draft, run an extra draft with 4 Gulus.": "بعد الاختيار المعتاد، أجرِ اختيارًا إضافيًا يضم 4 من Gulu.",
    "After the regular draft, run an extra draft with 5 Gulus.": "بعد الاختيار المعتاد، أجرِ اختيارًا إضافيًا يضم 5 من Gulu.",
    "After the regular draft, run an extra draft with 6 Gulus.": "بعد الاختيار المعتاد، أجرِ اختيارًا إضافيًا يضم 6 من Gulu.",
    "After the regular draft, run an extra draft with 7 Gulus.": "بعد الاختيار المعتاد، أجرِ اختيارًا إضافيًا يضم 7 من Gulu.",
    "After the regular draft, run an extra draft with 8 Gulus.": "بعد الاختيار المعتاد، أجرِ اختيارًا إضافيًا يضم 8 من Gulu.",
    "After the regular draft, run an extra draft with 9 Gulus.": "بعد الاختيار المعتاد، أجرِ اختيارًا إضافيًا يضم 9 من Gulu.",
    "After the regular draft, run an extra draft with 10 Gulus.": "بعد الاختيار المعتاد، أجرِ اختيارًا إضافيًا يضم 10 من Gulu.",
    "Increase the maximum staff count by +5.": "زد الحد الأقصى لعدد الموظفين بمقدار +5.",
    "Migrated to Absorb": "يستخدم الآن تأثير الامتصاص",
    "Migrated to Employee of the Universe": "يستخدم الآن تأثير موظف الكون",
    "inferno fox": "ثعلب الجحيم",
    "aurora mink": "منك الشفق",
    "terracotta pangolin": "آكل النمل الحرشفي الفخاري",
    Install: "تثبيت",
    "The deployed Gulu and the Gulus exploited by this score; disconnected field units are excluded.":
      "يشمل Gulu المنتشر وGulus المستغَلّين بهذه النتيجة؛ ولا يشمل الوحدات المنفصلة.",
    "Ignite: score Work Performance 3 extra time(s)": "الإشعال: احتساب أداء العمل 3 مرات إضافية",
    "Ignite: score Work Performance 6 extra time(s)": "الإشعال: احتساب أداء العمل 6 مرات إضافية",
    "Ignite: score Work Performance 10 extra time(s)": "الإشعال: احتساب أداء العمل 10 مرات إضافية",
    "Ignite: score Work Performance 15 extra time(s)": "الإشعال: احتساب أداء العمل 15 مرة إضافية",
    Confirm: "تأكيد",
    "Save debug": "تصحيح الحفظ",
    "Steam debug": "تصحيح Steam",
    "Click feedback": "استجابة النقر",
    "🍙 Tokens→✨EXP": "🍙 الرموز→✨EXP",
    "Click Gulus in the factory; each refunds 100% of its latest hire price":
      "انقر على Gulus في المصنع؛ يُسترد 100% من آخر سعر توظيف لكل واحد",
    "SHIFT CLEARED — CLOCK OUT!": "انتهت الوردية — حان الانصراف!",
    "CURRENT GULU POOL": "مجموعة GULU الحالية",
    "REROLL UNSELECTED GULUS": "أعِد سحب GULUS غير المختارين",
    "GULU POOL FULL": "مجموعة GULU ممتلئة",
    "PAY & NEXT DRAFT": "ادفع وانتقل للاختيار التالي",
    "PROMISES ≠ PIZZA": "الوعود ≠ بيتزا",
    "PAID NAP RIGHTS": "القيلولة المدفوعة حق",
    Gluttony: "شره",
    Grass: "عشب",
    "Egg tucked into a hatchery slot": "وُضعت البيضة في خانة الحاضنة",
    "Tap Start Fusion — boom!": "اضغط بدء الدمج — وانفجار!",
    "Pet pokes": "نقرات الحيوان الأليف",
    "HATCH PIT UNLOCKED": "فُتحت حفرة الفقس!",
    "Backyard License": "رخصة الفناء الخلفي",
    "IN ✓": "مختار ✓",
    "GULU HIRING": "توظيف GULU",
    "GULU POOL IS EMPTY": "مجموعة GULU فارغة",
    "Review the hiring cost, cash after payment, and reserved bill before confirming the hires.":
      "راجع تكلفة التوظيف والنقد المتبقي بعد الدفع والفاتورة المحجوزة قبل تأكيد التعيينات.",
    "Migrated to Gluttony": "تم التحول إلى الشره",
    "Ignite, each extra desk: bonus +50%": "الإشعال، لكل مكتب إضافي: مكافأة +50%",
    "Ignite, each extra desk: bonus +1x": "الإشعال، لكل مكتب إضافي: مكافأة +1x",
    "Ignite, each extra desk: bonus +3x": "الإشعال، لكل مكتب إضافي: مكافأة +3x",
    "Ignite, each extra desk: bonus +8x": "الإشعال، لكل مكتب إضافي: مكافأة +8x",
    "Ignite, each extra desk: bonus +20x": "الإشعال، لكل مكتب إضافي: مكافأة +20x",
    "Ignite, each same-name Water: bonus +1x": "الإشعال، لكل ماء يحمل الاسم نفسه: مكافأة +1x",
    "Ignite, each same-name Water: bonus +1.5x": "الإشعال، لكل ماء يحمل الاسم نفسه: مكافأة +1.5x",
    "Ignite, each same-name Water: bonus +2.5x": "الإشعال، لكل ماء يحمل الاسم نفسه: مكافأة +2.5x",
    "Ignite, each same-name Water: bonus +4x": "الإشعال، لكل ماء يحمل الاسم نفسه: مكافأة +4x",
    "Ignite, each same-name Water: bonus +6x": "الإشعال، لكل ماء يحمل الاسم نفسه: مكافأة +6x",
  },
  th: {
    "SIX FIGURES!": "ทะลุหลักแสนแล้ว!",
    "GULU POOL IS EMPTY": "กลุ่ม GULU ว่างเปล่า",
    "Steam Global Leaderboard": "อันดับโลกบน Steam",
    "Temp Agency": "บริษัทจัดหางานชั่วคราว",
    "Audit-Proof": "ตรวจยังไงก็ผ่าน",
    "Million-Revenue Report": "รายงานรายได้หลักล้าน",
    PICK: "เลือก",
    CONTINUE: "ไปต่อ",
    "PAY & NEXT DRAFT": "จ่ายแล้วรับสมัครต่อ",
    "Ice Gulus and Grass Gulus Stick; each Ice–Grass edge gives bonus +25% (max 4)":
      "Gulu ธาตุน้ำแข็งกับ Gulu ธาตุหญ้ายึดติดกัน; ขอบน้ำแข็ง–หญ้าแต่ละเส้นให้โบนัส +25% (สูงสุด 4)",
    "Ice Gulus and Grass Gulus Stick; each Ice–Grass edge gives bonus +35% (max 6)":
      "Gulu ธาตุน้ำแข็งกับ Gulu ธาตุหญ้ายึดติดกัน; ขอบน้ำแข็ง–หญ้าแต่ละเส้นให้โบนัส +35% (สูงสุด 6)",
    "Ice Gulus and Grass Gulus Stick; each Ice–Grass edge gives bonus +50% (max 8)":
      "Gulu ธาตุน้ำแข็งกับ Gulu ธาตุหญ้ายึดติดกัน; ขอบน้ำแข็ง–หญ้าแต่ละเส้นให้โบนัส +50% (สูงสุด 8)",
    "Ice Gulus and Grass Gulus Stick; each Ice–Grass edge gives bonus +80% (max 12)":
      "Gulu ธาตุน้ำแข็งกับ Gulu ธาตุหญ้ายึดติดกัน; ขอบน้ำแข็ง–หญ้าแต่ละเส้นให้โบนัส +80% (สูงสุด 12)",
    "Ice Gulus and Grass Gulus Stick; each Ice–Grass edge gives bonus +1.25x (max 99); count the whole connected group":
      "Gulu ธาตุน้ำแข็งกับ Gulu ธาตุหญ้ายึดติดกัน; ขอบน้ำแข็ง–หญ้าแต่ละเส้นให้โบนัส +1.25x (สูงสุด 99); นับทั้งกลุ่มที่เชื่อมกัน",
    "Ice Gulu + Grass Gulu: Stick; each Stick edge between the 2 types gives bonus +25% (max 4)":
      "Gulu ธาตุน้ำแข็งกับ Gulu ธาตุหญ้ายึดติดกัน; ขอบเชื่อมระหว่าง 2 ธาตุแต่ละเส้นให้โบนัส +25% (สูงสุด 4)",
    "Ice Gulu + Grass Gulu: Stick; each Stick edge between the 2 types gives bonus +35% (max 6)":
      "Gulu ธาตุน้ำแข็งกับ Gulu ธาตุหญ้ายึดติดกัน; ขอบเชื่อมระหว่าง 2 ธาตุแต่ละเส้นให้โบนัส +35% (สูงสุด 6)",
    "Ice Gulu + Grass Gulu: Stick; each Stick edge between the 2 types gives bonus +50% (max 8)":
      "Gulu ธาตุน้ำแข็งกับ Gulu ธาตุหญ้ายึดติดกัน; ขอบเชื่อมระหว่าง 2 ธาตุแต่ละเส้นให้โบนัส +50% (สูงสุด 8)",
    "Ice Gulu + Grass Gulu: Stick; each Stick edge between the 2 types gives bonus +80% (max 12)":
      "Gulu ธาตุน้ำแข็งกับ Gulu ธาตุหญ้ายึดติดกัน; ขอบเชื่อมระหว่าง 2 ธาตุแต่ละเส้นให้โบนัส +80% (สูงสุด 12)",
    "Ice Gulu + Grass Gulu: Stick; each Stick edge between the 2 types gives bonus +1.25x (max 99); count the whole connected group":
      "Gulu ธาตุน้ำแข็งกับ Gulu ธาตุหญ้ายึดติดกัน; ขอบเชื่อมระหว่าง 2 ธาตุแต่ละเส้นให้โบนัส +1.25x (สูงสุด 99); นับทั้งกลุ่มที่เชื่อมกัน",
  },
  vi: {
    "aurora mink": "chồn cực quang",
    "terracotta pangolin": "tê tê đất nung",
    "{name} (click to work)": "{name} (nhấp để làm việc)",
    "GULU HIRING": "TUYỂN GULU",
    "{count} elems": "{count} nguyên tố",
    "PAID NAP RIGHTS": "QUYỀN NGỦ CÓ LƯƠNG",
    "Lush Workforce": "ĐỘI NGŨ XANH TỐT",
  },
  id: {
    "Migrated to Gluttony": "Sekarang memakai efek Kerakusan",
    "ember fox": "rubah bara",
    "inferno fox": "rubah neraka",
    "ripple duck": "bebek riak",
    "sauna pufferfish": "ikan buntal sauna",
    "yarn cat": "kucing benang",
    "sea angel": "malaikat laut",
    "terracotta pangolin": "trenggiling terakota",
    Dragging: "Menyeret",
    "Gulu Draft": "Seleksi Gulu",
    "Shift ∞+{m}": "Giliran ∞+{m}",
    "Shift {shift} · Draft {round}/{max}": "Giliran {shift} · Seleksi {round}/{max}",
    "Steam debug": "Debug Steam",
    "GULU POOL FULL": "KELOMPOK GULU PENUH",
    "{count} TOTAL": "JUMLAH {count}",
    "Flash-Freeze Route": "Jalur Beku Kilat",
    "Fire-Eater": "Pelahap Api",
    "Full-Roster Bonus": "Bonus Tim Lengkap",
    "{n} hits!": "{n} pukulan!",
    "Feed it to max out back~": "Beri makan sampai halaman belakang mentok~",
    "ACHIEVEMENT · {names}": "PRESTASI · {names}",
    "Hand-Raised": "Dibesarkan Sendiri",
    "Grass on desk: that desk's Team Performance ×1.8": "Rumput di meja: Kinerja Tim meja itu ×1.8",
    "Ignite, each same-name Water: bonus +1x": "Pemantik, tiap Air bernama sama: bonus +1x",
    "Ignite, each same-name Water: bonus +1.5x": "Pemantik, tiap Air bernama sama: bonus +1.5x",
    "Ignite, each same-name Water: bonus +2.5x": "Pemantik, tiap Air bernama sama: bonus +2.5x",
    "Ignite, each same-name Water: bonus +4x": "Pemantik, tiap Air bernama sama: bonus +4x",
    "Ignite, each same-name Water: bonus +6x": "Pemantik, tiap Air bernama sama: bonus +6x",
    "Headcount cap +5": "Batas pegawai +5",
  },
  nl: {
    "latte snowman": "latte-sneeuwpop",
    "barbecue alligator": "barbecue-alligator",
    "matcha tapir": "matcha-tapir",
    "terracotta pangolin": "terracotta-schubdier",
    "🔧 Steam integration off (local debug mode) — everything runs locally":
      "🔧 Steam-integratie uit (lokale debugmodus) — alles draait lokaal",
    "⚪ Steam offline — fusion, tier-2 hatching, and releasing Steam-minted pets are unavailable":
      "⚪ Steam offline — fusie, uitbroeden van niveau 2 en vrijlaten van via Steam verkregen huisdieren zijn niet beschikbaar",
    "🍙 Tokens→✨EXP": "🍙 Fiches→✨EXP",
    Landing: "Landen",
    "Factory debug": "Fabrieksdebug",
    "Token detail · {range}": "Tokendetails · {range}",
    "+{exp} EXP — level up! 🎉": "+{exp} EXP — level omhoog! 🎉",
    "GULU POOL": "GULU-RESERVE",
    "Slots {used}/{total}": "Plekken {used}/{total}",
    "⬆ Yard Upgraded · Lv{level}": "⬆ Tuin verbeterd · Lv{level}",
    "Shift {n}/{total}": "Dienst {n}/{total}",
    "MILLIONAIRE!": "MILJONAIR!",
    "Parallel Circuit": "Parallelle schakeling",
    "Flash-Freeze Route": "Flitsvriesroute",
    "matcha tapir": "theetapir",
    "{n} hits!": "{n} tikken!",
    "Variant Curator": "Variantenbeheerder",
    "Master Builder": "Meesterbouwer",
    "Code Snack": "Codehapje",
    "Mega Pulse": "Megapuls",
  },
};

const REVIEWED_SHARED_UI = {
  "zh-Hant": { " 🏠 local": " 🏠 本機", "🟢 Steam connected": "🟢 Steam 已連線", "Build Training Hall · {cost}🪙": "蓋間訓練館 · {cost}🪙" },
  ja: { " 🏠 local": " 🏠 ローカル", "🟢 Steam connected": "🟢 Steam 接続済み", "Build Training Hall · {cost}🪙": "トレーニング場を建てる · {cost}🪙" },
  ko: { " 🏠 local": " 🏠 로컬", "🟢 Steam connected": "🟢 Steam 연결됨", "Build Training Hall · {cost}🪙": "훈련장 짓기 · {cost}🪙" },
  fr: { " 🏠 local": " 🏠 local", "🟢 Steam connected": "🟢 Steam connecté", "Build Training Hall · {cost}🪙": "Construire la salle d’entraînement · {cost}🪙" },
  de: { " 🏠 local": " 🏠 lokal", "🟢 Steam connected": "🟢 Steam verbunden", "Build Training Hall · {cost}🪙": "Trainingshalle bauen · {cost}🪙" },
  "es-ES": { " 🏠 local": " 🏠 local", "🟢 Steam connected": "🟢 Steam conectado", "Build Training Hall · {cost}🪙": "Construir sala de entrenamiento · {cost}🪙" },
  "es-419": { " 🏠 local": " 🏠 local", "🟢 Steam connected": "🟢 Steam conectado", "Build Training Hall · {cost}🪙": "Construir sala de entrenamiento · {cost}🪙" },
  "pt-BR": { " 🏠 local": " 🏠 local", "🟢 Steam connected": "🟢 Steam ligado", "Build Training Hall · {cost}🪙": "Construir sala de treino · {cost}🪙" },
  "pt-PT": { " 🏠 local": " 🏠 local", "🟢 Steam connected": "🟢 Steam ligado", "Build Training Hall · {cost}🪙": "Construir sala de treino · {cost}🪙" },
  ru: { " 🏠 local": " 🏠 локально", "🟢 Steam connected": "🟢 Steam подключён", "Build Training Hall · {cost}🪙": "Построить тренировочный зал · {cost}🪙" },
  it: { " 🏠 local": " 🏠 locale", "🟢 Steam connected": "🟢 Steam collegato", "Build Training Hall · {cost}🪙": "Costruisci sala allenamento · {cost}🪙" },
  pl: { " 🏠 local": " 🏠 lokalnie", "🟢 Steam connected": "🟢 Steam połączony", "Build Training Hall · {cost}🪙": "Zbuduj salę treningową · {cost}🪙" },
  tr: { " 🏠 local": " 🏠 yerel", "🟢 Steam connected": "🟢 Steam bağlı", "Build Training Hall · {cost}🪙": "Antrenman salonu kur · {cost}🪙" },
  uk: { " 🏠 local": " 🏠 локально", "🟢 Steam connected": "🟢 Steam підключено", "Build Training Hall · {cost}🪙": "Збудувати тренувальну залу · {cost}🪙" },
  ar: { " 🏠 local": " 🏠 محلي", "🟢 Steam connected": "🟢 Steam متصل", "Build Training Hall · {cost}🪙": "ابنِ قاعة التدريب · {cost}🪙" },
  th: { " 🏠 local": " 🏠 ในเครื่อง", "🟢 Steam connected": "🟢 เชื่อมต่อ Steam แล้ว", "Build Training Hall · {cost}🪙": "สร้างห้องฝึก · {cost}🪙" },
  vi: { " 🏠 local": " 🏠 cục bộ", "🟢 Steam connected": "🟢 Steam đã kết nối", "Build Training Hall · {cost}🪙": "Xây phòng tập · {cost}🪙" },
  id: { " 🏠 local": " 🏠 lokal", "🟢 Steam connected": "🟢 Steam terhubung", "Build Training Hall · {cost}🪙": "Bangun ruang latihan · {cost}🪙" },
  nl: { " 🏠 local": " 🏠 lokaal", "🟢 Steam connected": "🟢 Steam verbonden", "Build Training Hall · {cost}🪙": "Bouw trainingszaal · {cost}🪙" },
};

const REVIEWED_AGENT_STATUS = {
  "zh-Hant": ["{name} 已連線", "{name} 已連線（{account}）"],
  ja: ["{name} 接続済み", "{name} 接続済み（{account}）"],
  ko: ["{name} 연결됨", "{name} 연결됨 ({account})"],
  fr: ["{name} connecté", "{name} connecté ({account})"],
  de: ["{name} verbunden", "{name} verbunden ({account})"],
  "es-ES": ["{name} conectado", "{name} conectado ({account})"],
  "es-419": ["{name} conectado", "{name} conectado ({account})"],
  "pt-BR": ["{name} ligado", "{name} ligado ({account})"],
  "pt-PT": ["{name} ligado", "{name} ligado ({account})"],
  ru: ["{name} подключён", "{name} подключён ({account})"],
  it: ["{name} connesso", "{name} connesso ({account})"],
  pl: ["{name}: połączono", "{name}: połączono ({account})"],
  tr: ["{name} bağlı", "{name} bağlı ({account})"],
  uk: ["{name} підключено", "{name} підключено ({account})"],
  ar: ["{name} متصل", "{name} متصل ({account})"],
  th: ["เชื่อมต่อ {name} แล้ว", "เชื่อมต่อ {name} แล้ว ({account})"],
  vi: ["{name} đã kết nối", "{name} đã kết nối ({account})"],
  id: ["{name} terhubung", "{name} terhubung ({account})"],
  nl: ["{name} verbonden", "{name} verbonden ({account})"],
};

const { outputFiles } = buildSync({
  stdin: {
    contents: `
      export { STRINGS } from "./src/i18n.ts";
      export { UI_LOCALES } from "./src/i18n/uiLocales.ts";
      export { BACKYARD, BACKYARD_LABEL_LOCALES, BACKYARD_SEMANTIC_LOCALES } from "./src/i18n/backyard.ts";
      export { FACTORY_ROGUE, FACTORY_ACTION_LABEL_LOCALES, FACTORY_PAYMENT_BUTTON_LOCALES, FACTORY_SHIFT_LABEL_LOCALES, FACTORY_TERM_LABEL_LOCALES, FACTORY_RESUME_LOCALES } from "./src/i18n/factoryRogue.ts";
      export { MESSAGES } from "./src/i18n/messages.ts";
      export { ELEMENT_NAMES, SPECIES_EN_DESC, SPECIES_EN_NAMES, SPECIES_NAME_OVERRIDES } from "./src/i18n/species.ts";
      export { SHELL, SHELL_COLLECTION_LOCALES } from "./src/i18n/shell.ts";
      export { CARD_DEFS } from "./src/game/factory/rogueConfig.ts";
      export { ROGUE_CARD_KEYWORDS, rogueKeywordText } from "./src/game/factory/rogueKeywords.ts";
      export { ONBOARDING_EN_COPY, ONBOARDING_UI_EN } from "./src/app/onboarding/onboardingCopy.ts";
      export { FACTORY_FIRST_RUN_COPY } from "./src/game/factory/FactoryFirstRunGuide.tsx";
      export { ACHIEVEMENT_NAMES } from "./src/game/achievements.ts";
      export { DEBUG_EN } from "./src/i18n/debug.ts";
      export { default as QUOTES } from "./assets/text/ai_quotes.json";
    `,
    resolveDir: APP_ROOT,
    sourcefile: "runtime-locales-generator-entry.ts",
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  loader: { ".css": "empty" },
  write: false,
  logLevel: "silent",
});
const source = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

const domains = {
  ui: source.STRINGS.en,
  backyard: source.BACKYARD.en,
  factoryRogue: source.FACTORY_ROGUE.en,
  messages: source.MESSAGES.en,
  elements: source.ELEMENT_NAMES.en,
  // Lowercase tells sentence-oriented offline models these are translatable
  // creature-name phrases rather than protected English proper nouns.
  speciesNames: Object.fromEntries(
    Object.entries(source.SPECIES_EN_NAMES).map(([code, name]) => [code, name.toLocaleLowerCase("en")]),
  ),
  speciesDescriptions: source.SPECIES_EN_DESC,
  speciesGenericDescription: "A mysterious Gulugulu creature with a one-of-a-kind design.",
  shell: source.SHELL.en,
  onboarding: source.ONBOARDING_EN_COPY,
  onboardingUi: source.ONBOARDING_UI_EN,
  factoryFirstRun: source.FACTORY_FIRST_RUN_COPY.en,
  debug: source.DEBUG_EN,
  achievements: Object.fromEntries(Object.entries(source.ACHIEVEMENT_NAMES).map(([id, names]) => [id, names.en])),
  rogueKeywords: Object.fromEntries(
    [...new Set(Object.values(source.ROGUE_CARD_KEYWORDS).flat())]
      .map((id) => [id, source.rogueKeywordText(id, "en")]),
  ),
  quotes: Object.fromEntries(
    source.QUOTES.quotes.filter((quote) => quote.lang === "en").map((quote) => [quote.id, quote.text]),
  ),
};

const cardLevels = new Map(source.CARD_DEFS.map((card) => [card.id, card.maxLevel ?? 1]));
const cardSource = Object.fromEntries(
  Object.entries(source.FACTORY_ROGUE.en.cards).map(([id, card]) => [
    id,
    {
      name: card.name,
      descriptions: Array.from({ length: cardLevels.get(id) ?? 1 }, (_, index) => card.desc(index + 1)),
    },
  ]),
);
const factoryCardDescriptionSources = new Set(
  Object.values(cardSource).flatMap((card) => card.descriptions),
);
const zhHansFactoryCardTranslations = new Map();
for (const [cardId, englishCard] of Object.entries(source.FACTORY_ROGUE.en.cards)) {
  const zhHansCard = source.FACTORY_ROGUE["zh-Hans"].cards[cardId];
  const levels = cardLevels.get(cardId) ?? 1;
  for (let level = 1; level <= levels; level += 1) {
    zhHansFactoryCardTranslations.set(englishCard.desc(level), zhHansCard.desc(level));
  }
}

function cloneStatic(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(cloneStatic);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => typeof child !== "function")
        .map(([key, child]) => [key, cloneStatic(child)]),
    );
  }
  return value;
}

function mergeStatic(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return override ?? base;
  const merged = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeStatic(merged[key], value)
      : value;
  }
  return merged;
}

function collectStrings(value, out = new Set()) {
  if (typeof value === "string" && value.trim()) out.add(value);
  else if (Array.isArray(value)) value.forEach((child) => collectStrings(child, out));
  else if (value && typeof value === "object") Object.values(value).forEach((child) => collectStrings(child, out));
  return out;
}

function collectSourceStringsForOverlay(sourceValue, overlay, out) {
  if (typeof overlay === "string") {
    if (typeof sourceValue === "string" && sourceValue.trim()) out.add(sourceValue);
    return;
  }
  if (!overlay || typeof overlay !== "object") return;
  for (const [key, child] of Object.entries(overlay)) {
    collectSourceStringsForOverlay(sourceValue?.[key], child, out);
  }
}

function collapseAdjacentRepetitions(text) {
  let previous;
  do {
    previous = text;
    text = text.replace(/\b([\p{L}]{2,})(?:\s+\1\b)+/giu, (match) => match.trim().split(/\s+/)[0]);
  } while (text !== previous);
  return text;
}

function replaceStrings(value, translations) {
  if (typeof value === "string") return collapseAdjacentRepetitions(translations.get(value) ?? value);
  if (Array.isArray(value)) return value.map((child) => replaceStrings(child, translations));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceStrings(child, translations)]));
  }
  return value;
}

function placeholders(text) {
  return [...text.matchAll(/\{\w+\}/g)].map((match) => match[0]).sort().join("|");
}

function protectedTokens(text) {
  PROTECTED_TOKEN_RE.lastIndex = 0;
  return [...text.matchAll(PROTECTED_TOKEN_RE)].map((match) => match[0]);
}

function hasTranslatableEnglish(text) {
  PROTECTED_TOKEN_RE.lastIndex = 0;
  return /[A-Za-z]/.test(text.replace(PROTECTED_TOKEN_RE, ""));
}

function stripProtected(text) {
  PROTECTED_TOKEN_RE.lastIndex = 0;
  return text.replace(PROTECTED_TOKEN_RE, "");
}

function translationNeedsImprovement(locale, sourceText, localizedText) {
  if (!hasTranslatableEnglish(sourceText)) return false;
  const sourceProse = stripProtected(sourceText).replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("en");
  const localizedProse = stripProtected(localizedText).replace(/[^\p{L}\p{N}]/gu, "");
  if (sourceProse.length < 4) return false;
  const expectedScript = EXPECTED_SCRIPT[locale];
  if (expectedScript) return !expectedScript.test(localizedProse);
  return sourceProse === localizedProse.toLocaleLowerCase("en");
}

function preservesProtectedTokens(sourceText, localizedText) {
  const canonical = (token) => {
    const stripped = token.replace(/(?:[,.;:!?…—–/+\-]\s*|\s+)$/u, "");
    return stripped || token;
  };
  const glossaryLocalizesGulu = FACTORY_CARD_GLOSSARY.sourceTerms.some((term, index) =>
    (term.token === "GULU" || term.token.endsWith("_GULU")) && FACTORY_CARD_TERM_PATTERNS[index].test(sourceText)
  );
  const expected = protectedTokens(sourceText).map(canonical).filter(
    (token) => !glossaryLocalizesGulu || !/^Gulus?(?:\(s\))?(?:['\u2019]s)?$/u.test(token),
  );
  const actual = protectedTokens(localizedText).map(canonical);
  let cursor = 0;
  return expected.every((token) => {
    const index = actual.indexOf(token, cursor);
    if (index < 0) return false;
    cursor = index + 1;
    return true;
  });
}

function outerWhitespace(text) {
  return `${text.match(/^\s*/u)?.[0] ?? ""}\u0000${text.match(/\s*$/u)?.[0] ?? ""}`;
}

function translationContractHolds(sourceText, localizedText) {
  return typeof localizedText === "string"
    && placeholders(sourceText) === placeholders(localizedText)
    && preservesProtectedTokens(sourceText, localizedText)
    && (!factoryCardDescriptionSources.has(sourceText) || numericTokens(sourceText) === numericTokens(localizedText))
    && outerWhitespace(sourceText) === outerWhitespace(localizedText)
    && translationLooksSane(sourceText, localizedText);
}

function numericTokens(text) {
  return (text.match(/(?:[+−-]|×|≥)?\d+(?:,\d{3})*(?:\.\d+)?(?:[–-]\d+(?:\.\d+)?)?(?:%|x)?/gu) ?? []).join("|");
}

function translationLooksSane(sourceText, localizedText) {
  if (localizedText.length > Math.max(180, sourceText.length * 8)) return false;
  if (factoryCardDescriptionSources.has(sourceText)
    && (/[{}\\]/u.test(localizedText) || localizedText.includes("�"))) return false;
  const chunks = localizedText.match(/[+\p{L}\p{N}]+/gu) ?? [];
  const counts = new Map();
  for (const chunk of chunks) counts.set(chunk, (counts.get(chunk) ?? 0) + 1);
  return Math.max(0, ...counts.values()) <= 12;
}

const cache = (() => {
  try { return JSON.parse(readFileSync(CACHE, "utf8")); }
  catch { return {}; }
})();
const existing = (() => {
  try { return JSON.parse(readFileSync(OUTPUT, "utf8")); }
  catch { return {}; }
})();

async function translateLanguage(id) {
  cache[id] ??= {};
  cache.__meta ??= {};
  cache.__meta.contextRevisionByLanguage ??= {};
  const localeRevision = id === "zh-Hant"
    ? `${LOCALIZATION_REVISION}:cards-${TRADITIONAL_FACTORY_CARD_REVISION}`
    : LOCALIZATION_REVISION;
  const refreshContext = cache.__meta.contextRevisionByLanguage[id] !== localeRevision;
  const reviewedTranslations = {
    "1d": "1d",
    "1w": "1w",
    "1m": "1m",
    ...(REVIEWED_OVERRIDES[id] ?? {}),
    ...(REVIEWED_SHARED_UI[id] ?? {}),
    ...(LLM_REVIEWED_OVERRIDES[id] ?? {}),
    ...UNIVERSAL_REVIEWED_OVERRIDES,
  };
  const reviewedExpGain = REVIEWED_EXP_GAIN[id];
  if (reviewedExpGain) {
    reviewedTranslations["+{exp} EXP!"] = reviewedExpGain[0];
    reviewedTranslations["+{exp} EXP — level up! 🎉"] = reviewedExpGain[1];
  }
  Object.assign(reviewedTranslations, REVIEWED_PLUS_SIGN_UI[id] ?? {});
  const reviewedAgentStatus = REVIEWED_AGENT_STATUS[id];
  if (reviewedAgentStatus) {
    reviewedTranslations["{name} connected"] = reviewedAgentStatus[0];
    reviewedTranslations["{name} connected ({account})"] = reviewedAgentStatus[1];
  }
  Object.assign(cache[id], reviewedTranslations);
  const reviewedSourceStrings = new Set(Object.keys(reviewedTranslations));
  const sourceTree = Object.fromEntries(Object.entries(domains).map(([key, value]) => [key, cloneStatic(value)]));
  sourceTree.factoryRogueCards = cardSource;
  collectSourceStringsForOverlay(sourceTree.ui, source.UI_LOCALES[id], reviewedSourceStrings);
  collectSourceStringsForOverlay(sourceTree.backyard, source.BACKYARD_LABEL_LOCALES[id], reviewedSourceStrings);
  collectSourceStringsForOverlay(sourceTree.backyard, source.BACKYARD_SEMANTIC_LOCALES[id], reviewedSourceStrings);
  collectSourceStringsForOverlay(sourceTree.factoryRogue, source.FACTORY_ACTION_LABEL_LOCALES[id], reviewedSourceStrings);
  collectSourceStringsForOverlay(sourceTree.factoryRogue, source.FACTORY_PAYMENT_BUTTON_LOCALES[id], reviewedSourceStrings);
  collectSourceStringsForOverlay(sourceTree.factoryRogue, source.FACTORY_SHIFT_LABEL_LOCALES[id], reviewedSourceStrings);
  collectSourceStringsForOverlay(sourceTree.factoryRogue, source.FACTORY_TERM_LABEL_LOCALES[id], reviewedSourceStrings);
  collectSourceStringsForOverlay(sourceTree.factoryRogue, source.FACTORY_RESUME_LOCALES[id], reviewedSourceStrings);
  collectSourceStringsForOverlay(sourceTree.shell, source.SHELL_COLLECTION_LOCALES[id], reviewedSourceStrings);
  const all = [...collectStrings(sourceTree)];
  let invalidated = 0;
  const invalidExamples = [];
  for (const text of all) {
    if (cache[id][text] != null) {
      cache[id][text] = normalizeShiftSemantics(text, cache[id][text], id);
      cache[id][text] = removeSpuriousMnemonics(text, cache[id][text]);
      cache[id][text] = normalizeNumericAffixes(text, cache[id][text]);
      cache[id][text] = normalizePlaceholderLinks(text, cache[id][text]);
    }
  }
  if (refreshContext) {
    for (const text of all) {
      if (!reviewedSourceStrings.has(text)
        && (contextApplies(text) || factoryCardDescriptionSources.has(text))
        && cache[id][text] != null) {
        delete cache[id][text];
        invalidated += 1;
      }
    }
  }
  for (const text of all) {
    const isReviewedTraditionalCard = id === "zh-Hant" && zhHansFactoryCardTranslations.has(text);
    if (cache[id][text] != null
      && !reviewedSourceStrings.has(text)
      && !isReviewedTraditionalCard
      && !translationContractHolds(text, cache[id][text])) {
      if (invalidExamples.length < 5) invalidExamples.push(text);
      delete cache[id][text];
      invalidated += 1;
    }
  }
  const pending = all.filter(
    (text) => cache[id][text] == null || (
      improveUntranslated
      && !reviewedSourceStrings.has(text)
      && translationNeedsImprovement(id, text, cache[id][text])
    ),
  );
  console.log(`${id}: ${all.length} unique strings, ${pending.length} pending (${invalidated} invalid cache entries removed)`);
  if (invalidExamples.length) console.log(`${id}: invalid examples: ${invalidExamples.map((text) => JSON.stringify(text)).join(", ")}`);

  if (pending.length > 0) {
    throw new Error(
      `${id}: ${pending.length} translations require review. `
      + "Add model-reviewed entries to localization_llm_reviewed_overrides.mjs; "
      + "automated translation is disabled.\n"
      + pending.map((text) => JSON.stringify(text)).join("\n"),
    );
  }
  const map = new Map(Object.entries(cache[id]));
  existing[id] = replaceStrings(sourceTree, map);
  existing[id].speciesNames = {
    ...existing[id].speciesNames,
    ...(source.SPECIES_NAME_OVERRIDES[id] ?? {}),
  };
  existing[id].factoryRogue = {
    ...existing[id].factoryRogue,
    ...(source.FACTORY_ACTION_LABEL_LOCALES[id] ?? {}),
    ...(source.FACTORY_PAYMENT_BUTTON_LOCALES[id] ?? {}),
    ...(source.FACTORY_SHIFT_LABEL_LOCALES[id] ?? {}),
    ...(source.FACTORY_TERM_LABEL_LOCALES[id] ?? {}),
    ...(source.FACTORY_RESUME_LOCALES[id] ?? {}),
  };
  existing[id].backyard = mergeStatic(
    existing[id].backyard,
    source.BACKYARD_LABEL_LOCALES[id],
  );
  existing[id].backyard = mergeStatic(
    existing[id].backyard,
    source.BACKYARD_SEMANTIC_LOCALES[id],
  );
  existing[id].ui = mergeStatic(
    existing[id].ui,
    source.UI_LOCALES[id],
  );
  existing[id].shell = mergeStatic(
    existing[id].shell,
    source.SHELL_COLLECTION_LOCALES[id],
  );
  applyReviewedFactoryCardDescriptions(id, existing[id].factoryRogueCards, cardSource);
  for (const [keyword, token] of Object.entries(FACTORY_KEYWORD_GLOSSARY_TOKENS)) {
    if (existing[id].rogueKeywords?.[keyword]) {
      existing[id].rogueKeywords[keyword].name = FACTORY_CARD_GLOSSARY.locales[id][token];
    }
  }
  cache.__meta.contextRevisionByLanguage[id] = localeRevision;
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
  writeFileSync(CACHE, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
  console.log(`${id}: written`);
}

for (const id of selected) await translateLanguage(id);
console.log(`Generated ${OUTPUT}`);
