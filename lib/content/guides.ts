import type { Dictionary } from "../i18n/index.ts";
import { sectionById } from "../navigation.ts";

export type GuideEntryId = keyof Dictionary["guideEntries"];
export type GuideCategoryId = keyof Dictionary["guideCategories"];

export function kebabToCamel(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

export function camelToKebab(id: string): string {
  return id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function guideHref(id: string): string {
  return `/guides/${camelToKebab(id)}/`;
}

export function guideIdFromHref(href: string): string | null {
  const match = href.match(/^\/guides\/([^/]+)\/?$/);
  if (!match || match[1] === "new") return null;
  return kebabToCamel(match[1]);
}

export function isGuideEntryId(
  id: string,
  entries: Dictionary["guideEntries"],
): id is GuideEntryId {
  return Object.hasOwn(entries, id);
}

/**
 * Artwork, Artwork layouts, Heroes, Hero layouts, the Hero tier list, Goddess
 * Theater, Hero linking, and Anecdotes have their own editors. The dictionary-snippet
 * Edit / Remove on the guide page would only rewrite surrounding copy, so
 * those skip it.
 */
const SNIPPET_EDITOR_SKIP = new Set<string>([
  "artwork",
  "artworkLayouts",
  "heroes",
  "heroLayouts",
  "heroTierList",
  "goddessTheater",
  "heroLinking",
  "anecdotes",
  "serverAgeUnlocks",
]);

export function guideHasSnippetEditor(id: string): boolean {
  return !SNIPPET_EDITOR_SKIP.has(id);
}

export function guideCategoryId(
  href: string,
  categories: Dictionary["guideCategories"],
): GuideCategoryId {
  const item = sectionById("guides").items.find((entry) => entry.href === href);
  const id = item?.categoryId;
  if (id && Object.hasOwn(categories, id)) return id as GuideCategoryId;
  return "layouts";
}

export type GuideLayout =
  | "goddesses"
  | "artwork"
  | "artworkLayouts"
  | "heroLayouts"
  | "heroes"
  | "heroTierList"
  | "goddessTheater"
  | "heroLinking"
  | "anecdotes"
  | "serverAgeUnlocks"
  | "article";

/**
 * Which renderer a guide entry needs. Each custom layout is recognised by a
 * field no other entry has — `builds` alone is not enough, because Artwork and
 * Hero layouts both have one. Goddesses also has `filterAll` like Heroes, so
 * `phases` is checked first. Goddess Theater is recognised by `playsHeading`
 * Hero linking by `linksHeading`, Anecdotes by `anecdoteTexts`, and Server age
 * unlocks by `timelineHeading`. `tests/guides.test.mjs` pins every entry.
 */
export function guideLayout(guide: object): GuideLayout {
  if ("phases" in guide) return "goddesses";
  if ("battleTiers" in guide) return "heroTierList";
  if ("buildTexts" in guide) return "heroLayouts";
  if ("levels" in guide) return "artworkLayouts";
  if ("setsHeading" in guide) return "artwork";
  if ("playsHeading" in guide) return "goddessTheater";
  if ("linksHeading" in guide) return "heroLinking";
  if ("anecdoteTexts" in guide) return "anecdotes";
  if ("timelineHeading" in guide) return "serverAgeUnlocks";
  if ("filterAll" in guide) return "heroes";
  return "article";
}
