import runtimeLocalesJson from "./generated/runtimeLocales.json";
import type { BackyardStrings } from "./backyard";
import type { DeepPartial, Language } from "./core";
import type { FactoryRogueStrings } from "./factoryRogue";
import type { ShellStrings } from "./shell";
import type { CardId } from "../game/factory/rogueConfig";
import type { DebugStrings } from "./debug";

type GeneratedCardText = {
  name: string;
  descriptions: string[];
};

export type GeneratedRuntimeLocale = {
  backyard: DeepPartial<BackyardStrings>;
  factoryRogue: DeepPartial<FactoryRogueStrings> & { cards?: unknown };
  factoryRogueCards: Partial<Record<CardId, GeneratedCardText>>;
  messages: Record<string, string>;
  elements: Record<string, string>;
  speciesNames: Record<string, string>;
  speciesDescriptions: Record<string, string>;
  speciesGenericDescription: string;
  shell: DeepPartial<ShellStrings>;
  onboarding: Record<string, { chapter: string; label: string; cta?: string }>;
  onboardingUi: Record<string, string>;
  factoryFirstRun: Record<string, string>;
  achievements: Record<string, string>;
  rogueKeywords: Record<string, { name: string; tip: string }>;
  quotes: Record<string, string>;
  debug: DeepPartial<DebugStrings>;
};

/**
 * Generated locale payload. English and Simplified Chinese remain the authored
 * source tables; this file only contains the other registered app languages.
 */
export const GENERATED_RUNTIME_LOCALES = runtimeLocalesJson as unknown as Partial<
  Record<Language, GeneratedRuntimeLocale>
>;

export function generatedDomainLocales<K extends keyof GeneratedRuntimeLocale>(
  domain: K,
): Partial<Record<Language, GeneratedRuntimeLocale[K]>> {
  return Object.fromEntries(
    Object.entries(GENERATED_RUNTIME_LOCALES).flatMap(([language, locale]) =>
      locale?.[domain] == null ? [] : [[language, locale[domain]]],
    ),
  ) as Partial<Record<Language, GeneratedRuntimeLocale[K]>>;
}

/** Build live card description functions from the generated level-by-level copy. */
export function generatedFactoryRogueLocales(): Partial<
  Record<Language, DeepPartial<FactoryRogueStrings>>
> {
  return Object.fromEntries(
    Object.entries(GENERATED_RUNTIME_LOCALES).map(([language, locale]) => {
      const { cards: _generatedNamesOnly, ...staticStrings } = locale?.factoryRogue ?? {};
      const cards = Object.fromEntries(
        Object.entries(locale?.factoryRogueCards ?? {}).map(([id, text]) => [
          id,
          {
            name: text.name,
            desc: (level: number) => {
              const index = Math.max(0, Math.min(text.descriptions.length - 1, Math.floor(level) - 1));
              return text.descriptions[index] ?? "";
            },
          },
        ]),
      );
      return [language, { ...staticStrings, cards }];
    }),
  ) as Partial<Record<Language, DeepPartial<FactoryRogueStrings>>>;
}
