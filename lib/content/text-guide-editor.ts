/**
 * The editor for guides that are nothing but text in the dictionaries: every
 * event guide, and guides such as Ads / Buy. Such an entry is a row of strings
 * (title, summary, intro, credit, …) plus `sections`, each a heading and its
 * paragraphs. The editor keeps every field in every language at once and gives
 * back, per dictionary that changed, the entry to paste over the old one.
 *
 * Which strings an entry has is read from the English entry itself, so an entry
 * that grows a field needs no change here. `tests/text-guide-editor.test.mjs`
 * checks that an untouched draft gives back every entry unchanged.
 */

import { DEFAULT_LOCALE, LOCALE_CODES, dictionaryFile, getDictionary, mapLocales, type Locale } from "../i18n/index.ts";
import { dictionaryLiteral, propertyName, textIn, type Translations } from "../i18n/translations.ts";

export type TextGuideCatalog = "guideEntries" | "eventGuideEntries";

type Picture = { src: string; alt: string; width: number; height: number };
type Section = { heading: string; body: string[]; image?: Picture };
type Entry = Record<string, unknown> & { sections: Section[] };

/** A picture under a section: the file is the same in every language, the alt text is not. */
export type TextGuidePicture = { src: string; width: number; height: number; alt: Translations };

/** A section while it is edited: its paragraphs are one text, split at blank lines. */
export type TextGuideSection = { heading: Translations; body: Translations; image?: TextGuidePicture };

export type TextGuideDraft = {
  /** Every string field of the entry, in the order the dictionary has them. */
  fields: { key: string; text: Translations }[];
  /** Where `sections` sits among the fields, so the entry keeps its order. */
  sectionsAt: number;
  sections: TextGuideSection[];
};

function entryIn(catalog: TextGuideCatalog, id: string, locale: Locale): Entry | undefined {
  const entries = getDictionary(locale)[catalog] as unknown as Record<string, Entry | undefined>;
  return entries[id];
}

/** Whether an entry is text only: strings plus sections of heading and paragraphs. */
export function isTextGuide(catalog: TextGuideCatalog, id: string): boolean {
  const entry = entryIn(catalog, id, DEFAULT_LOCALE);
  if (!entry || !Array.isArray(entry.sections)) return false;
  const pictureOk = (image: unknown) => {
    if (image === undefined) return true;
    const record = image as Record<string, unknown>;
    return typeof image === "object" && image !== null &&
      typeof record.src === "string" && typeof record.alt === "string" &&
      typeof record.width === "number" && typeof record.height === "number" &&
      Object.keys(record).every((key) => ["src", "alt", "width", "height"].includes(key));
  };
  const sectionsOk = entry.sections.every(
    (section) =>
      typeof section === "object" && section !== null &&
      typeof section.heading === "string" && Array.isArray(section.body) &&
      section.body.every((line) => typeof line === "string") && pictureOk(section.image) &&
      Object.keys(section).every((key) => key === "heading" || key === "body" || key === "image"),
  );
  return sectionsOk && Object.entries(entry).every(([key, value]) => key === "sections" || typeof value === "string");
}

/** Paragraphs are separated by a blank line while they are edited. */
export function joinParagraphs(body: readonly string[]): string {
  return body.join("\n\n");
}

export function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

/** The entry as every dictionary has it now. */
export function textGuideDraft(catalog: TextGuideCatalog, id: string): TextGuideDraft {
  const english = entryIn(catalog, id, DEFAULT_LOCALE);
  if (!english) throw new Error(`${catalog}.${id} is not in the English dictionary`);
  const keys = Object.keys(english);
  const scalar = keys.filter((key) => key !== "sections");
  const sectionCount = Math.max(...LOCALE_CODES.map((locale) => entryIn(catalog, id, locale)?.sections.length ?? 0), 0);
  return {
    fields: scalar.map((key) => ({
      key,
      text: mapLocales((locale) => {
        const value = entryIn(catalog, id, locale)?.[key];
        return typeof value === "string" ? value : "";
      }),
    })),
    sectionsAt: keys.indexOf("sections"),
    sections: Array.from({ length: sectionCount }, (_, index) => {
      const picture = english.sections[index]?.image;
      return {
        heading: mapLocales((locale) => entryIn(catalog, id, locale)?.sections[index]?.heading ?? ""),
        body: mapLocales((locale) => joinParagraphs(entryIn(catalog, id, locale)?.sections[index]?.body ?? [])),
        ...(picture
          ? {
              image: {
                src: picture.src,
                width: picture.width,
                height: picture.height,
                alt: mapLocales((locale) => entryIn(catalog, id, locale)?.sections[index]?.image?.alt ?? ""),
              },
            }
          : {}),
      };
    }),
  };
}

/**
 * The entry for one language. A field still empty in that language takes the
 * English text, which is also what a reader of that language sees until
 * somebody translates it. A section with nothing in it is left out.
 */
export function textGuideEntry(draft: TextGuideDraft, locale: Locale): Entry {
  const sections: Section[] = draft.sections
    .filter((section) => textIn(section.heading, locale) || textIn(section.body, locale))
    .map((section) => ({
      heading: textIn(section.heading, locale),
      body: splitParagraphs(textIn(section.body, locale)),
      ...(section.image
        ? {
            image: {
              src: section.image.src,
              alt: textIn(section.image.alt, locale),
              width: section.image.width,
              height: section.image.height,
            },
          }
        : {}),
    }));
  const out: Record<string, unknown> = {};
  draft.fields.forEach((field, index) => {
    if (index === draft.sectionsAt) out.sections = sections;
    out[field.key] = textIn(field.text, locale);
  });
  if (draft.sectionsAt < 0 || draft.sectionsAt >= draft.fields.length) out.sections = sections;
  return out as Entry;
}

/** Languages whose entry the draft changes. */
export function changedLocales(catalog: TextGuideCatalog, id: string, draft: TextGuideDraft): Locale[] {
  return LOCALE_CODES.filter((locale) => {
    const published = entryIn(catalog, id, locale);
    return JSON.stringify(published) !== JSON.stringify(textGuideEntry(draft, locale));
  });
}

/** The block that replaces the entry in one dictionary. */
export function textGuideBlock(catalog: TextGuideCatalog, id: string, draft: TextGuideDraft, locale: Locale): string {
  const indent = "    ";
  return [
    `// ${dictionaryFile(locale)} — replace ${catalog}.${id}`,
    `${indent}${propertyName(id)}: ${dictionaryLiteral(textGuideEntry(draft, locale), indent)},`,
  ].join("\n");
}

/** One block per dictionary that changed. */
export function textGuideBlocks(catalog: TextGuideCatalog, id: string, draft: TextGuideDraft): Partial<Record<Locale, string>> {
  const out: Partial<Record<Locale, string>> = {};
  for (const locale of changedLocales(catalog, id, draft)) out[locale] = textGuideBlock(catalog, id, draft, locale);
  return out;
}

/** Reads a stored draft back; anything that does not fit the entry any more is dropped. */
export function parseTextGuideDraft(raw: string | null, base: TextGuideDraft): TextGuideDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TextGuideDraft>;
    if (!Array.isArray(parsed.fields) || !Array.isArray(parsed.sections)) return null;
    const text = (value: unknown): Translations =>
      mapLocales((locale) => {
        const record = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
        return typeof record[locale] === "string" ? (record[locale] as string) : "";
      });
    const stored = new Map(parsed.fields.map((field) => [field?.key, field?.text]));
    return {
      fields: base.fields.map((field) => ({ key: field.key, text: stored.has(field.key) ? text(stored.get(field.key)) : field.text })),
      sectionsAt: base.sectionsAt,
      sections: parsed.sections.map((section) => {
        const picture = section?.image;
        return {
          heading: text(section?.heading),
          body: text(section?.body),
          ...(picture && typeof picture.src === "string" && typeof picture.width === "number" && typeof picture.height === "number"
            ? { image: { src: picture.src, width: picture.width, height: picture.height, alt: text(picture.alt) } }
            : {}),
        };
      }),
    };
  } catch {
    return null;
  }
}

export function textGuideStorageKey(catalog: TextGuideCatalog, id: string): string {
  return `popepoch-text-guide:${catalog}:${id}`;
}
