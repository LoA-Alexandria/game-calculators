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

export function guideCategoryId(
  href: string,
  categories: Dictionary["guideCategories"],
): GuideCategoryId {
  const item = sectionById("guides").items.find((entry) => entry.href === href);
  const id = item?.categoryId;
  if (id && Object.hasOwn(categories, id)) return id as GuideCategoryId;
  return "cityLayout";
}
