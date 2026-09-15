import en, { type Dictionary } from "./dictionaries/en.ts";
import de from "./dictionaries/de.ts";
import fr from "./dictionaries/fr.ts";

export type { Dictionary };

/**
 * The language registry, and the only place that lists the languages. To add
 * one, run `pnpm i18n:add <code> "<Name>"` (for example `pnpm i18n:add es
 * "Español"`): it copies `dictionaries/en.ts` and adds the import, the entry
 * below, and the dictionary. Then translate the new file.
 *
 * `Dictionary` is derived from the English file, so TypeScript reports any key
 * a language forgot. Every editor, export, and test reads the languages from
 * here, so nothing else needs to change.
 */
export const LOCALES = [
  { code: "en", label: "English", short: "EN", htmlLang: "en" },
  { code: "de", label: "Deutsch", short: "DE", htmlLang: "de" },
  { code: "fr", label: "Français", short: "FR", htmlLang: "fr" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

/** English is the reference language: data files hold English, and missing text falls back to it. */
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_CODES: readonly Locale[] = LOCALES.map((entry) => entry.code);

const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  de,
  fr,
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

/** One value per registered language, in registry order. */
export function mapLocales<T>(make: (locale: Locale) => T): Record<Locale, T> {
  return Object.fromEntries(LOCALE_CODES.map((code) => [code, make(code)])) as Record<Locale, T>;
}

/** The dictionary file an editor tells people to paste into. */
export function dictionaryFile(locale: Locale): string {
  return `lib/i18n/dictionaries/${locale}.ts`;
}

/** Every dictionary file, for instructions like "delete it from …". */
export function dictionaryFiles(): string {
  return LOCALE_CODES.map(dictionaryFile).join(", ");
}

/** The registered language for a value, or English. */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
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
