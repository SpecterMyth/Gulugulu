"""Offline English -> locale translation worker for generate_runtime_locales.mjs.

The worker keeps one Argos model loaded for the full request and writes only the
JSON result to stdout. Progress and diagnostics go to stderr.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

import argostranslate.package
import argostranslate.translate


LOCALIZATION_CONTEXT = json.loads(
    Path(__file__).with_name("localization_context.json").read_text(encoding="utf-8")
)
FACTORY_CARD_GLOSSARY = json.loads(
    Path(__file__).with_name("factory_card_glossary.json").read_text(encoding="utf-8")
)
for locale_terms in FACTORY_CARD_GLOSSARY["locales"].values():
    for token, localized in FACTORY_CARD_GLOSSARY.get("defaultTerms", {}).items():
        locale_terms.setdefault(token, localized)
ALWAYS_CLARIFIED_SOURCES: dict[str, str] = LOCALIZATION_CONTEXT["clarifications"]
CONTEXT_PATTERN_EXCLUSIONS = set(LOCALIZATION_CONTEXT.get("patternExclusions", []))
CONTEXT_PATTERNS = [
    (
        re.compile(rule["pattern"], re.IGNORECASE if "i" in rule.get("flags", "") else 0),
        rule["replacement"],
    )
    for rule in LOCALIZATION_CONTEXT["patterns"]
]
SHIFT_SENSE_CORRECTIONS = {
    locale: [
        (re.compile(rule["pattern"], re.IGNORECASE), rule["replacement"])
        for rule in rules
    ]
    for locale, rules in LOCALIZATION_CONTEXT["shiftSenseCorrections"].items()
}
FACTORY_CARD_TERM_PATTERNS = [
    (
        re.compile(rule["pattern"], re.IGNORECASE if "i" in rule.get("flags", "") else 0),
        rule["token"],
    )
    for rule in FACTORY_CARD_GLOSSARY["sourceTerms"]
]
# Argos is allowed to rewrite prose, but not runtime variables, product names,
# gameplay acronyms, tier/level markers, or pictograms.  Translating those was
# the source of corrupted UI such as ``{cost}Wat?`` (🪙), ``Name`` (Steam), and
# ``○`` (several unrelated emoji) in otherwise complete locale files.
EMOJI_RE = (
    r"(?:[\U0001F000-\U0001FAFF\u2190-\u2BFF]"
    r"(?:[\uFE0E\uFE0F])?(?:\u200D[\U0001F000-\U0001FAFF\u2190-\u2BFF](?:[\uFE0E\uFE0F])?)*)"
)
PROTECTED_TOKEN_RE = re.compile(
    rf"\{{\w+\}}|{EMOJI_RE}|"
    r"(?:[+−-]|×|≥)?\d+(?:,\d{3})*(?:\.\d+)?(?:[–-]\d+(?:\.\d+)?)?(?:%|x)?|"
    r"\b(?:Claude Code|Codex CLI|Gulugulu|Claude|Codex|Steam|KPIs?|EXP|AI|CLI|Gulus?|GULUS?)\b(?:\(s\))?(?:['’]s|['’])?"
    r"(?:[,.;:!?…—–/+-]\s*|\s+)?|"
    r"Lv(?:\d+|\{\w+\})|T(?:\d+(?:[–-]\d+)?|\{\w+\})|No\.(?:\d+|\{\w+\})?|"
    r"[←→↔×✓✔★☆‹›–—‘’“”「」『』·/]",
)

SOURCE_CLARIFICATIONS = {
    "Resume run": "Resume the saved game",
    "resume run": "resume the saved game",
    "Fuse": "Start fusion",
    "fuse": "start fusion",
    "Run it back": "Play another game",
    "SHIFT-END SHOP": "shop after the work shift",
    "Factory Drop": "factory reward",
    "FACTORY DROP": "factory reward",
    "Debug": "debug mode",
    "On": "enabled",
    "Idle": "waiting",
    "Retry": "try again",
    "Me": "my rank",
    "ME": "my rank",
    "LEADERBOARD": "competition ranking table",
    "NORMAL": "standard game mode",
    "Normal": "standard",
    "View leaderboard": "open the rankings",
    "GLOBAL TOP 100": "global top one hundred rankings",
    "Misses": "failed attempts",
    "Icicle": "ice spike",
    "Waterway": "water channel",
    "Canopy": "forest canopy",
    "Jack of All Trades": "versatile worker",
    "Backfill": "replacement hiring",
    "Rebind": "change key binding",
    "Sprite": "character image",
    "Hatched": "egg hatched",
    "KPI Met": "KPI achieved",
    "Apex Predator": "top predator",
    "Tycoon": "business magnate",
    "Ignite": "set on fire",
    "Overstaff": "extra staff",
    "Lush": "lush growth",
    "Migrated to Gluttony": "upgraded into Gluttony",
    "Arc Ignition": "electric arc ignition",
    "Fire-Eater": "creature that eats fire",
    "Bio-Network": "biological network",
    "Skins ×{count}": "cosmetic appearances ×{count}",
    "{count} elems": "{count} elements",
    "Backyard": "outdoor pet yard",
    "Coins": "game coins",
    "Locked": "unavailable until unlocked",
    "Done": "finished",
    "Save & leave": "save the game and exit",
    "CONTINUE": "proceed",
    "BACK": "go to the previous screen",
    "Refund": "money returned",
    "Runs": "completed games",
    "RUN HAUL": "rewards from this game",
    "Overstaffing Bonus": "bonus for extra staff",
    "Backflow": "reverse water flow",
    "Gluttony": "extreme hunger",
    "Full-Roster Bonus": "bonus for a full staff roster",
    "Mudslide": "sliding mud",
    "Update Codex CLI": "update the Codex command-line program",
    "You were away for about {duration}": "time away: about {duration}",
    "I am at the hatchery": "current location: hatchery",
    "Onboarding Complete": "tutorial complete",
    "Full Roster": "full staff team",
    "Insolvent": "no money left",
    "My sincerest apologies.": "I am very sorry.",
    "Headcount cap +5": "maximum staff count +5",
    "Codex online": "Codex is connected",
    "Agent online": "assistant is connected",
    "Codex + Claude Code online": "Codex and Claude Code are connected",
    "Claude Code online": "Claude Code is connected",
    "Upgrade · {cost}🪙": "improve · {cost}🪙",
    "Details ›": "more information ›",
    "Skip +{v}": "skip reward +{v}",
    "Reroll −{v}": "draw again −{v}",
    "IN ✓": "included ✓",
    "REROLL": "draw again",
    "REROLL UNSELECTED GULUS": "draw new unselected Gulus",
    "PAY & CLOCK IN!": "pay and start the work shift!",
    "GLOBAL FACTORY LEADERBOARD": "world factory rankings",
    "Gale Day": "strong wind day",
    "Crunch Day": "intense work day",
    "Rush trickle": "extra rush income",
    "RANK / PLAYER": "ranking / player",
    "PICK": "choose",
    "GULU POOL": "available GULU reserve",
    "SHOP MAXED": "shop fully upgraded",
    "Workshop · Uploaders": "workshop · creators",
    "Install": "install program",
    "Import": "import data",
    "Dress Up": "change appearance",
    "Stick": "wooden stick",
    "Team": "work team",
    "Water": "water element",
    "Regular": "standard employee",
    "Fireline": "line of fire",
    "Wildfire": "uncontrolled fire",
    "Side Hustler": "worker with a second job",
    "Stamina": "physical energy",
    "Clock out and play": "finish work and play",
    "Gotta Fuse 'Em All": "need to fuse them all",
    "Ascendant III": "rising master three",
    "10K CLUB!": "ten-thousand club!",
    "100M MOGUL!": "one-hundred-million magnate!",
    "Legacy Résumé": "inherited work history",
    "Legacy Dispatch": "inherited dispatch",
    "Legacy Resonance": "inherited resonance",
    "Assimilation": "absorption and integration",
    "Irrigation": "watering system",
    "Fusions": "fusion count",
    "Code Banquet": "programming banquet",
    "Circuit": "electric circuit",
    "Bittersweet": "sweet and bitter",
    "Prism": "light prism",
    "Rebind": "change key binding",
    "Tap Follow — it'll tag along~": "tap Follow so the pet comes with you",
    "Tap Start Fusion — boom!": "tap Start Fusion to begin!",
    "Skip onboarding": "skip the tutorial",
    "No local Claude Code / Codex CLI detected": "no compatible command-line assistant was found on this computer",
    "Install / force update:": "install or update the program:",
    "The deployed Gulu and the Gulus exploited by this score; disconnected field units are excluded.": "the Gulu on the field and the Gulus used by this score; disconnected units are not included.",
    "Ignite: score Work Performance 1 extra time(s)": "ignite: score work points one additional time",
    "Ignite: score Work Performance 3 extra time(s)": "ignite: score work points three additional times",
    "Ignite: score Work Performance 6 extra time(s)": "ignite: score work points six additional times",
    "Ignite: score Work Performance 10 extra time(s)": "ignite: score work points ten additional times",
    "Ignite: score Work Performance 15 extra time(s)": "ignite: score work points fifteen additional times",
    "A deployed Fire Gulu gains +20 Work Performance": "a Fire Gulu at a desk gets twenty additional work points",
    "A deployed Water Gulu gains +20 Work Performance": "a Water Gulu at a desk gets twenty additional work points",
    "A deployed Electric Gulu gains +20 Work Performance": "an Electric Gulu at a desk gets twenty additional work points",
    "{name} (click to work)": "{name} (click to start work)",
    "pet": "virtual pet",
    "Shift {n}/{total}": "work shift {n}/{total}",
    "Shift 1": "work shift 1",
    "{count} TOTAL": "{count} in total",
    "{name}, level {level}. {description}": "{name}, rank {level}. {description}",
}


def ensure_model(target: str) -> None:
    installed = argostranslate.translate.get_installed_languages()
    english = next((language for language in installed if language.code == "en"), None)
    if english and any(
        translation.to_lang.code == target for translation in english.translations_from
    ):
        return

    print(f"Installing offline en->{target} model...", file=sys.stderr, flush=True)
    argostranslate.package.update_package_index()
    packages = argostranslate.package.get_available_packages()
    package = next(
        (item for item in packages if item.from_code == "en" and item.to_code == target),
        None,
    )
    if package is None:
        raise RuntimeError(f"No Argos package for en->{target}")
    argostranslate.package.install_from_path(package.download())


def translate_literal(text: str, target: str) -> str:
    if not text:
        return ""
    leading = re.match(r"^\s*", text).group(0)
    trailing = re.search(r"\s*$", text).group(0)
    end = len(text) - len(trailing) if trailing else len(text)
    core = text[len(leading) : end]
    if not core:
        return text
    if not re.search(r"[A-Za-z]", core):
        return text
    first_letter = re.search(r"[A-Za-z]", core)
    assert first_letter is not None
    # Preserve punctuation that was separated from the sentence by protected
    # gameplay/numeric tokens. Tiny spans such as "; larger" otherwise make
    # some Argos models hallucinate page/date counters.
    prefix = core[: first_letter.start()]
    last_index = max(match.end() for match in re.finditer(r"[A-Za-z]", core))
    body = core[first_letter.start() : last_index]
    suffix = core[last_index:]
    return leading + prefix + argostranslate.translate.translate(body, "en", target).strip() + suffix + trailing


def translate_preserving_tokens(text: str, target: str) -> str:
    """Translate prose spans while keeping every runtime/UI token byte-stable.

    ``translate_literal`` deliberately retains outer whitespace.  This matters
    for composited labels such as ``" 🏠 local"`` which are concatenated after a
    creature name; stripping that leading space glues the two labels together.
    """
    matches = list(PROTECTED_TOKEN_RE.finditer(text))
    if not matches:
        return translate_literal(text, target)
    pieces: list[str] = []
    cursor = 0
    for match in matches:
        pieces.append(translate_literal(text[cursor : match.start()], target))
        pieces.append(match.group(0))
        cursor = match.end()
    pieces.append(translate_literal(text[cursor:], target))
    return "".join(pieces)


def contextualize_source(text: str) -> str:
    """Disambiguate terse game copy before it reaches the generic model."""
    if text in CONTEXT_PATTERN_EXCLUSIONS:
        return text
    reviewed = ALWAYS_CLARIFIED_SOURCES.get(text)
    if reviewed is not None:
        return reviewed
    for pattern, replacement in CONTEXT_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def protect_factory_card_terms(text: str) -> str:
    """Turn gameplay concepts into protected tokens before generic translation."""
    for pattern, token in FACTORY_CARD_TERM_PATTERNS:
        text = pattern.sub(f"{{{token}}}", text)
    # Articles stranded next to a protected term become one-letter translation
    # spans (notably English "A" -> page/date junk in CJK models). Formula-style
    # card copy does not need them, so remove only articles directly before a
    # protected gameplay token.
    text = re.sub(r"(?i)\b(?:a|an)\s+(?=\{[A-Z_]+\})", "", text)
    return text


def localize_factory_card_terms(text: str, locale: str) -> str:
    """Restore every protected concept with the reviewed locale glossary."""
    terms = FACTORY_CARD_GLOSSARY["locales"].get(locale, {})
    for token, localized in terms.items():
        text = text.replace(f"{{{token}}}", localized)
    return text


def translate_factory_card_sentence(text: str, target: str) -> str:
    """Translate a card as one sentence so grammar survives glossary tokens.

    Splitting at every number and concept produced technically complete but
    unnatural fragments in languages whose word order differs from English.
    Argos reliably keeps semantic ``{TOKEN_NAME}`` markers, though it may alter
    their case or insert spaces around underscores, so normalize those marker
    spellings before restoring the reviewed glossary. If a model drops a token
    or changes a gameplay number, fall back to the conservative span path.
    """
    number_re = re.compile(r"(?:[+−-]|×|≥)?\d+(?:,\d{3})*(?:\.\d+)?(?:[–-]\d+(?:\.\d+)?)?(?:%|x|×)?")
    literal_values: dict[str, str] = {}

    def protect_literal(match: re.Match[str]) -> str:
        token = f"CARDLITERAL{chr(ord('A') + len(literal_values))}"
        literal_values[token] = match.group(0)
        return f"{{{token}}}"

    protected_literals = re.sub(r"\bKPIs?\b", protect_literal, text)
    number_values: dict[str, str] = {}

    def protect_number(match: re.Match[str]) -> str:
        # Alphabetic marker names survive the sentence models more reliably
        # than bare digits, whose range dashes and sign spacing are localized.
        index = len(number_values)
        suffix = ""
        value = index
        while True:
            suffix = chr(ord("A") + value % 26) + suffix
            value = value // 26 - 1
            if value < 0:
                break
        token = f"CARDVALUE{suffix}"
        number_values[token] = match.group(0)
        return f"{{{token}}}"

    protected_text = number_re.sub(protect_number, protected_literals)
    expected = re.findall(r"\{([A-Z_]+)\}", protected_text)
    if not expected:
        return translate_literal(text, target)
    normalized_tokens = {re.sub(r"[^A-Z]", "", token): token for token in set(expected)}
    translated = translate_literal(protected_text, target)

    def normalize_marker(match: re.Match[str]) -> str:
        key = re.sub(r"[^A-Z]", "", match.group(1).upper())
        token = normalized_tokens.get(key)
        return f"{{{token}}}" if token is not None else match.group(0)

    translated = re.sub(r"\{([^{}]+)\}", normalize_marker, translated)
    actual = re.findall(r"\{([A-Z_]+)\}", translated)
    residual = re.sub(r"\{[A-Z_]+\}", "", translated)
    if (
        sorted(actual) != sorted(expected)
        or "{" in residual
        or "}" in residual
        or "�" in translated
        or repeated_or_exploded(text, translated)
    ):
        return translate_preserving_tokens(text, target)
    for token, value in number_values.items():
        translated = translated.replace(f"{{{token}}}", value)
    for token, value in literal_values.items():
        translated = translated.replace(f"{{{token}}}", value)
    if number_re.findall(translated) != number_re.findall(text):
        return translate_preserving_tokens(text, target)
    return translated


def normalize_shift_semantics(source: str, translated: str, locale: str) -> str:
    if not re.search(r"\bshifts?\b", source, re.IGNORECASE):
        return translated
    for pattern, replacement in SHIFT_SENSE_CORRECTIONS.get(locale, []):
        translated = pattern.sub(replacement, translated)
    return translated


def remove_spurious_mnemonics(source: str, translated: str) -> str:
    """Drop translator-invented `(G)`/`(P)` markers that were not in source."""
    translated = re.sub(r"\(([A-Z])\)(?=\{\w+\})", "(", translated)
    translated = re.sub(r"（([A-Z])）(?=\{\w+\})", "（", translated)
    if not re.search(r"[（(][A-Z][）)]", source):
        translated = re.sub(r"\s*[（(][A-Z][）)]\s*", " ", translated).strip()
    return translated


def normalize_numeric_affixes(source: str, translated: str) -> str:
    """Keep signs attached to values; repair MT output like `+ key {exp}`."""
    for operator, name in re.findall(r"([+−])\{(\w+)\}", source):
        translated = re.sub(
            re.escape(operator) + rf"[^{{}}]{{0,16}}\{{{name}\}}",
            f"{operator}{{{name}}}",
            translated,
            count=1,
        )
    return translated


def repeated_or_exploded(source: str, translated: str) -> bool:
    words = translated.split()
    counts: dict[str, int] = {}
    for word in words:
        counts[word] = counts.get(word, 0) + 1
    return (
        len(translated) > max(180, len(source) * 8)
        or (counts and max(counts.values()) > 12)
    )


def collapse_adjacent_repetitions(text: str) -> str:
    """Remove decoder loops such as ``Work Work Work`` from short UI copy."""
    pattern = re.compile(r"(?iu)\b([\wÀ-ž]{2,})(?:\s+\1\b)+")
    previous = None
    while previous != text:
        previous = text
        text = pattern.sub(lambda match: match.group(1), text)
    return text


def trim_numeric_decoder_tail(source: str, translated: str) -> str:
    """Trim model loops that append dozens of bare bonus numbers to a valid sentence."""
    number_pattern = re.compile(r"[+−×]?\d+(?:[.,]\d+)?%?")
    expected = list(number_pattern.finditer(source))
    actual = list(number_pattern.finditer(translated))
    if not expected or len(actual) <= max(6, len(expected) * 3):
        return translated
    tail_start = actual[len(expected)].start()
    tail = translated[tail_start:]
    if re.fullmatch(r"[\s+−×%.,;:/\d]+", tail):
        return translated[:tail_start].rstrip()
    return translated


def lowercase_unprotected(text: str) -> str:
    """Lowercase retry prose without changing case-sensitive product tokens."""
    pieces: list[str] = []
    cursor = 0
    for match in PROTECTED_TOKEN_RE.finditer(text):
        pieces.append(text[cursor : match.start()].lower())
        pieces.append(match.group(0))
        cursor = match.end()
    pieces.append(text[cursor:].lower())
    return "".join(pieces)


def retry_untranslated(source: str, translated: str, target: str) -> str:
    if translated != source or not re.search(r"[A-Za-z]", source):
        return translated
    prefix_match = re.match(r"^[^A-Za-z{]+", source)
    prefix = prefix_match.group(0) if prefix_match else ""
    core = source[len(prefix) :]
    retry_source = SOURCE_CLARIFICATIONS.get(source, lowercase_unprotected(core))
    candidate = prefix + translate_preserving_tokens(retry_source, target)
    if candidate.casefold() == retry_source.casefold() or repeated_or_exploded(source, candidate):
        return translated
    letters = "".join(character for character in source if character.isalpha())
    if letters and letters == letters.upper():
        candidate = candidate.upper()
    return candidate


def regionalize(text: str, locale: str) -> str:
    if locale == "zh-Hant":
        try:
            from opencc import OpenCC
        except ImportError as error:
            raise RuntimeError(
                "zh-Hant generation requires opencc-python-reimplemented"
            ) from error
        return OpenCC("s2twp").convert(text)

    # Argos provides one Spanish and one Portuguese model. These conservative
    # replacements keep high-frequency UI terminology appropriate per region.
    replacements: dict[str, list[tuple[str, str]]] = {
        "es-419": [
            ("ordenador", "computadora"),
            ("Ordenador", "Computadora"),
            ("vosotros", "ustedes"),
            ("Vosotros", "Ustedes"),
        ],
        "pt-BR": [
            ("equipa", "equipe"),
            ("Equipa", "Equipe"),
            ("ecrã", "tela"),
            ("Ecrã", "Tela"),
            ("ficheiro", "arquivo"),
            ("Ficheiro", "Arquivo"),
        ],
        "pt-PT": [
            ("equipe", "equipa"),
            ("Equipe", "Equipa"),
            ("tela", "ecrã"),
            ("Tela", "Ecrã"),
            ("arquivo", "ficheiro"),
            ("Arquivo", "Ficheiro"),
        ],
    }
    for source, target in replacements.get(locale, []):
        text = text.replace(source, target)
    return text


def main() -> None:
    request: dict[str, Any] = json.load(sys.stdin)
    locale = str(request["locale"])
    target = str(request["target"])
    strings = request["strings"]
    zh_hans_factory_card_strings = request.get("zhHansFactoryCardStrings", [None] * len(strings))
    improve_untranslated = bool(request.get("improveUntranslated"))
    if not isinstance(strings, list) or not all(isinstance(value, str) for value in strings):
        raise TypeError("strings must be an array of strings")
    if not isinstance(zh_hans_factory_card_strings, list) or len(zh_hans_factory_card_strings) != len(strings):
        raise TypeError("zhHansFactoryCardStrings must parallel strings")

    ensure_model(target)
    results: list[str] = []
    total = len(strings)
    for index, original in enumerate(strings, start=1):
        reviewed_zh_hans = zh_hans_factory_card_strings[index - 1]
        if locale == "zh-Hant" and isinstance(reviewed_zh_hans, str):
            translated = reviewed_zh_hans
        else:
            prepared = protect_factory_card_terms(contextualize_source(original))
            translated = (
                translate_factory_card_sentence(prepared, target)
                if isinstance(reviewed_zh_hans, str)
                else translate_preserving_tokens(prepared, target)
            )
        if improve_untranslated:
            translated = retry_untranslated(original, translated, target)
        translated = regionalize(translated, locale)
        translated = localize_factory_card_terms(translated, locale)
        translated = normalize_shift_semantics(original, translated, locale)
        translated = remove_spurious_mnemonics(original, translated)
        translated = normalize_numeric_affixes(original, translated)
        translated = trim_numeric_decoder_tail(original, translated)
        translated = collapse_adjacent_repetitions(translated)
        results.append(translated)
        if index % 100 == 0 or index == total:
            print(f"{locale}: translated {index}/{total}", file=sys.stderr, flush=True)

    json.dump(results, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
