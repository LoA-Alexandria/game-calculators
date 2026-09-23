/**
 * Helpers for guild-post localization and MyMemory chunking.
 * Pure functions so the Edge Function and the browser stay in step.
 */

import { LOCALE_CODES, type Locale } from "../i18n/index.ts";
import { blankTranslations, parseTranslations, type Translations } from "../i18n/translations.ts";
import { guildPostHtml, looksLikeGuildHtml } from "./guild-rich-text.ts";

/** MyMemory rejects queries longer than 500 bytes. */
export const MYMEMORY_CHUNK_BYTES = 500;

const LOCALES: readonly Locale[] = LOCALE_CODES;

export function isGuildPostLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Strip tags for machine translation. Keeps line breaks from block tags. */
export function htmlToPlainText(html: string): string {
  const input = html.trim();
  if (!input) return "";
  if (!looksLikeGuildHtml(input)) return input;
  return input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Split text so each piece is at most `maxBytes` UTF-8 bytes, preferring
 * breaks at newlines or spaces.
 */
export function chunkTextForMyMemory(text: string, maxBytes = MYMEMORY_CHUNK_BYTES): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const encoder = new TextEncoder();
  if (encoder.encode(trimmed).length <= maxBytes) return [trimmed];

  const chunks: string[] = [];
  let rest = trimmed;
  while (rest.length > 0) {
    if (encoder.encode(rest).length <= maxBytes) {
      chunks.push(rest);
      break;
    }
    let cut = rest.length;
    let low = 1;
    let high = rest.length;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (encoder.encode(rest.slice(0, mid)).length <= maxBytes) {
        cut = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const window = rest.slice(0, cut);
    const breakAt = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const end = breakAt > cut * 0.4 ? breakAt : cut;
    const piece = rest.slice(0, end).trimEnd();
    if (piece) chunks.push(piece);
    rest = rest.slice(end).trimStart();
  }
  return chunks;
}

export function parseLocaleMap(value: unknown): Translations {
  return parseTranslations(value) ?? blankTranslations();
}

/** Title for the reader's locale, falling back to the source column. */
export function guildPostTitleForLocale(
  post: { title: string; title_i18n?: unknown; source_locale?: string },
  locale: Locale,
): string {
  const map = parseTranslations(post.title_i18n);
  const own = map?.[locale]?.trim();
  if (own) return own;
  const source = isGuildPostLocale(post.source_locale) ? map?.[post.source_locale]?.trim() : "";
  if (source) return source;
  return post.title;
}

/** Body HTML for the reader's locale, falling back to the source column. */
export function guildPostBodyForLocale(
  post: { body: string; body_i18n?: unknown; source_locale?: string },
  locale: Locale,
): string {
  const map = parseTranslations(post.body_i18n);
  const own = map?.[locale]?.trim();
  if (own) return guildPostHtml(own);
  const source = isGuildPostLocale(post.source_locale) ? map?.[post.source_locale]?.trim() : "";
  if (source) return guildPostHtml(source);
  return guildPostHtml(post.body);
}

export function otherLocales(source: Locale): Locale[] {
  return LOCALES.filter((code) => code !== source);
}
