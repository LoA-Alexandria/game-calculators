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
 * Guides with their own editor (listed in `lib/content/guide-meta.ts`) skip the
 * dictionary-snippet Edit / Remove: on those pages it would only rewrite
 * surrounding copy.
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
  "museion",
  "heroLeveling",
  "productionBuildings",
  "cryptides",
  "goddesses",
  "goddessLeveling",
  "collection",
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
  | "museion"
  | "heroLeveling"
  | "productionBuildings"
  | "cryptides"
  | "goddessLeveling"
  | "collection"
  | "article";

/**
 * Which renderer a guide entry needs. Each custom layout is recognised by a
 * field no other entry has — `builds` alone is not enough, because Artwork and
 * Hero layouts both have one. Goddesses also has `filterAll` like Heroes, so
 * `goddessTexts` is checked first. Goddess leveling is recognised by
 * `phaseTexts`, Collection by `collectionTexts`, Goddess Theater is recognised by `playsHeading`
 * Hero linking by `linksHeading`, Anecdotes by `anecdoteTexts`, Server age
 * unlocks by `timelineHeading`, Museion by `buildingsHeading`, Hero leveling
 * by `focusHeading`, production buildings by `requirementsHeading`, and
 * Cryptides by `cryptidesHeading`.
 * `tests/guides.test.mjs` pins every entry.
 */
export function guideLayout(guide: object): GuideLayout {
  if ("goddessTexts" in guide) return "goddesses";
  if ("phaseTexts" in guide) return "goddessLeveling";
  if ("collectionTexts" in guide) return "collection";
  if ("battleTiers" in guide) return "heroTierList";
  if ("buildTexts" in guide) return "heroLayouts";
  if ("levels" in guide) return "artworkLayouts";
  if ("setsHeading" in guide) return "artwork";
  if ("playsHeading" in guide) return "goddessTheater";
  if ("linksHeading" in guide) return "heroLinking";
  if ("anecdoteTexts" in guide) return "anecdotes";
  if ("timelineHeading" in guide) return "serverAgeUnlocks";
  if ("buildingsHeading" in guide) return "museion";
  if ("focusHeading" in guide) return "heroLeveling";
  if ("requirementsHeading" in guide) return "productionBuildings";
  if ("cryptidesHeading" in guide) return "cryptides";
  if ("filterAll" in guide) return "heroes";
  return "article";
}
