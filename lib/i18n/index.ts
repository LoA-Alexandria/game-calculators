import en, { type Dictionary } from "./dictionaries/en.ts";
import de from "./dictionaries/de.ts";
import fr from "./dictionaries/fr.ts";

export type { Dictionary };

/**
 * The language registry. To add a language:
 *   1. copy `dictionaries/en.ts`, translate the values, keep every key;
 *   2. add one entry here.
 * `Dictionary` is derived from the English file, so TypeScript reports any key
 * the new language forgot.
 */
export const LOCALES = [
  { code: "en", label: "English", short: "EN", htmlLang: "en" },
  { code: "de", label: "Deutsch", short: "DE", htmlLang: "de" },
  { code: "fr", label: "Français", short: "FR", htmlLang: "fr" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";

const DICTIONARIES: Record<Locale, Dictionary> = { en, de, fr };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.some((entry) => entry.code === value);
}

export function localeMeta(locale: Locale) {
  return LOCALES.find((entry) => entry.code === locale) ?? LOCALES[0];
}

/**
 * Picks the best supported language for a list of browser preferences,
 * matching `de-AT` against `de`. Falls back to the default language.
 */
export function negotiateLocale(preferences: readonly string[]): Locale {
  for (const preference of preferences) {
    const base = preference.toLowerCase().split("-")[0];
    const match = LOCALES.find((entry) => entry.code === base);
    if (match) return match.code;
  }
  return DEFAULT_LOCALE;
}

/** Replaces `{name}` placeholders. Unknown names are left untouched. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/** Locale tag for `Intl` — used for thousands separators and dates. */
export function intlTag(locale: Locale): string {
  return localeMeta(locale).htmlLang;
}
