/**
 * Helpers for text that editors keep in every language at once. They read the
 * languages from the registry, so a language added there shows up in every
 * editor and export without further changes.
 */

import { DEFAULT_LOCALE, LOCALE_CODES, mapLocales, type Locale } from "./index.ts";

/** One string per registered language. */
export type Translations = Record<Locale, string>;

export function blankTranslations(): Translations {
  return mapLocales(() => "");
}

/** Translations filled from a lookup, such as each dictionary's current text. */
export function translationsFrom(read: (locale: Locale) => string | undefined): Translations {
  return mapLocales((locale) => read(locale) ?? "");
}

/** The text in `locale`, or the English text when that language is still empty. */
export function textIn(translations: Partial<Record<Locale, string>> | undefined, locale: Locale): string {
  const own = translations?.[locale]?.trim();
  return own || translations?.[DEFAULT_LOCALE]?.trim() || "";
}

/** Languages other than English that still have no text of their own. */
export function missingLocales(translations: Partial<Record<Locale, string>> | undefined): Locale[] {
  return LOCALE_CODES.filter((locale) => locale !== DEFAULT_LOCALE && !translations?.[locale]?.trim());
}

export function sameTranslations(left: Translations, right: Translations): boolean {
  return LOCALE_CODES.every((locale) => (left[locale] ?? "").trim() === (right[locale] ?? "").trim());
}

/**
 * Checks a stored value against the registry. A draft saved before a language
 * was added still loads: the new language starts empty.
 */
export function parseTranslations(value: unknown): Translations | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record[DEFAULT_LOCALE] !== "string") return null;
  return mapLocales((locale) => (typeof record[locale] === "string" ? (record[locale] as string) : ""));
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** An object key as it would be written in a dictionary file. */
export function propertyName(key: string): string {
  return IDENTIFIER.test(key) ? key : JSON.stringify(key);
}

/**
 * A plain value (strings, numbers, booleans, arrays, objects) written as a
 * TypeScript literal in the dictionaries' style: two-space indent, unquoted
 * keys where possible, a trailing comma on every line.
 */
export function dictionaryLiteral(value: unknown, indent = ""): string {
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((item) => typeof item !== "object" || item === null)) {
      return `[\n${value.map((item) => `${inner}${JSON.stringify(item)},`).join("\n")}\n${indent}]`;
    }
    return `[\n${value.map((item) => `${inner}${dictionaryLiteral(item, inner)},`).join("\n")}\n${indent}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined);
    if (entries.length === 0) return "{}";
    return `{\n${entries.map(([key, item]) => `${inner}${propertyName(key)}: ${dictionaryLiteral(item, inner)},`).join("\n")}\n${indent}}`;
  }
  return JSON.stringify(value);
}
