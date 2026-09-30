import { LOCALE_CODES, dictionaryFile, type Locale } from "../i18n/index.ts";
import { blankTranslations, dictionaryLiteral, propertyName, textIn, type Translations } from "../i18n/translations.ts";
import { HEROES } from "./heroes.ts";
import { GODDESSES } from "./goddesses.ts";

export type ContentKind = "news" | "guide" | "event";
export type ContentBlockType = "paragraph" | "heading" | "image" | "coreLink" | "hero" | "goddess" | "arrow" | "callout";
export type ContentArrowDirection = "right" | "down" | "left";
export type ContentBlock = {
  type: ContentBlockType;
  text: Translations;
  src: string;
  alt: Translations;
  href: string;
  entityId: string;
  direction: ContentArrowDirection;
};
export type ContentBuilderDraft = {
  kind: ContentKind;
  slug: string;
  date: string;
  categoryId: string;
  image: string;
  title: Translations;
  summary: Translations;
  intro: Translations;
  note: Translations;
  blocks: ContentBlock[];
};

export function emptyContentBlock(type: ContentBlockType = "paragraph"): ContentBlock {
  return { type, text: blankTranslations(), src: "", alt: blankTranslations(), href: "", entityId: "", direction: "right" };
}

export function slugifyContent(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function contentIdFromSlug(slug: string): string {
  return slug.split(/[^a-z0-9]+/i).filter(Boolean).map((part, index) =>
    index === 0 ? part.toLowerCase() : part[0].toUpperCase() + part.slice(1).toLowerCase(),
  ).join("") || "newContent";
}

export function safeContentUrl(value: string): boolean {
  const path = value.split(/[?#]/, 1)[0];
  const safeSitePath = value.startsWith("/") && !value.startsWith("//") && !path.split("/").includes("..");
  return safeSitePath || /^https:\/\//i.test(value);
}

function bodyLines(draft: ContentBuilderDraft, locale: Locale): string[] {
  const lines: string[] = [];
  for (const block of draft.blocks) {
    const text = textIn(block.text, locale).trim();
    if (block.type === "paragraph" && text) lines.push(text);
    if (block.type === "heading" && text) lines.push(`## ${text}`);
    if (block.type === "callout" && text) lines.push(`> ${text}`);
    if (block.type === "hero" && HEROES.some((hero) => hero.id === block.entityId)) lines.push(`[[hero:${block.entityId}]]`);
    if (block.type === "goddess" && GODDESSES.some((goddess) => goddess.id === block.entityId)) lines.push(`[[goddess:${block.entityId}]]`);
    if (block.type === "arrow" && ["right", "down", "left"].includes(block.direction)) lines.push(`[[arrow:${block.direction}]]`);
    if (block.type === "image" && safeContentUrl(block.src)) {
      const alt = textIn(block.alt, locale).trim();
      lines.push(`![${alt}](${block.src})`);
    }
    if (block.type === "coreLink" && text && safeContentUrl(block.href)) lines.push(`[${text}](${block.href})`);
  }
  return lines;
}

function paragraphArray(lines: string[]): string[] {
  return lines.join("\n\n").split(/\n\s*\n/).map((line) => line.trim()).filter(Boolean);
}

export function contentDictionaryEntry(draft: ContentBuilderDraft, locale: Locale): Record<string, unknown> {
  const lines = bodyLines(draft, locale);
  if (draft.kind === "news") {
    return { title: textIn(draft.title, locale), summary: textIn(draft.summary, locale), body: paragraphArray(lines) };
  }
  const sections: { heading: string; body: string[] }[] = [];
  let heading = "";
  let body: string[] = [];
  const flush = () => {
    if (heading || body.length) sections.push({ heading, body: paragraphArray(body) });
    heading = "";
    body = [];
  };
  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      heading = line.slice(3);
    } else body.push(line);
  }
  flush();
  return {
    title: textIn(draft.title, locale),
    summary: textIn(draft.summary, locale),
    intro: textIn(draft.intro, locale),
    sections,
    note: textIn(draft.note, locale),
  };
}

export function contentDictionaryBlocks(draft: ContentBuilderDraft): Partial<Record<Locale, string>> {
  const id = contentIdFromSlug(draft.slug || draft.title.en);
  const catalog = draft.kind === "news" ? "newsEntries" : draft.kind === "event" ? "eventGuideEntries" : "guideEntries";
  return Object.fromEntries(LOCALE_CODES.map((locale) => [
    locale,
    [
      `// ${dictionaryFile(locale)} — add under ${catalog}`,
      `    ${propertyName(id)}: ${dictionaryLiteral(contentDictionaryEntry(draft, locale), "    ")},`,
    ].join("\n"),
  ])) as Partial<Record<Locale, string>>;
}

export function contentSiteInstructions(draft: ContentBuilderDraft): string {
  const id = contentIdFromSlug(draft.slug || draft.title.en);
  const slug = slugifyContent(draft.slug || draft.title.en) || "new-content";
  if (draft.kind === "news") {
    return [
      `// lib/content/news.ts — add this item near the top of NEWS`,
      `  {`,
      `    id: ${JSON.stringify(id)},`,
      `    date: ${JSON.stringify(draft.date)},`,
      ...(draft.image && safeContentUrl(draft.image) ? [`    image: ${JSON.stringify(draft.image)},`] : []),
      `    title: (t) => t.newsEntries.${id}.title,`,
      `    summary: (t) => t.newsEntries.${id}.summary,`,
      `    body: (t) => t.newsEntries.${id}.body,`,
      `  },`,
      ``,
      `No separate page file is needed for News.`,
    ].join("\n");
  }
  const section = draft.kind === "event" ? "events" : "guides";
  const href = `/${section}/${slug}/`;
  return [
    `// lib/navigation.ts — add this item to ${section}.items`,
    `  {`,
    `    href: ${JSON.stringify(href)},`,
    `    label: (t) => t.${draft.kind === "event" ? "eventGuideEntries" : "guideEntries"}.${id}.title,`,
    `    description: (t) => t.${draft.kind === "event" ? "eventGuideEntries" : "guideEntries"}.${id}.summary,`,
    ...(draft.kind === "guide" ? [`    badge: (t) => t.guideCategories.${draft.categoryId},`, `    categoryId: ${JSON.stringify(draft.categoryId)},`] : []),
    ...(draft.kind === "event" && draft.image && safeContentUrl(draft.image) ? [`    icon: ${JSON.stringify(draft.image)},`] : []),
    `  },`,
    ``,
    `// app/${section}/${slug}/page.tsx`,
    `"use client";`,
    `import { ${draft.kind === "event" ? "EventArticle" : "GuideArticle"} } from "../${draft.kind === "event" ? "EventArticle" : "GuideArticle"}";`,
    `export default function ${id[0].toUpperCase()}${id.slice(1)}Page() { return <${draft.kind === "event" ? "EventArticle" : "GuideArticle"} id=${JSON.stringify(id)} />; }`,
    ...(draft.kind === "guide" ? [
      ``,
      `// lib/content/guide-meta.ts — add to GUIDE_PRESENTATION`,
      `  ${propertyName(id)}: { art: ${JSON.stringify(draft.image && safeContentUrl(draft.image) ? [draft.image] : [])} },`,
    ] : []),
    ...(draft.kind === "event" ? [`// Event wiki help is optional; without it, the page shows the community write-up only.`] : []),
  ].join("\n");
}
