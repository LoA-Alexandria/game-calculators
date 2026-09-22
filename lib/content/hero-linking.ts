/**
 * Hero linking — the Legend screen — from a community list shared on Discord
 * on 15 September 2026: which heroes unlock a link, which track and step they
 * come from, and the order worth spending links in.
 *
 * The mechanic itself is read off an in-game screenshot from the same day: a
 * Legend joins two heroes, the linkable hero inherits 10% of the other hero's
 * final attributes, and levelling the Legend raises both heroes' ATK and HP.
 * Only what that screenshot and the list actually show is recorded here; the
 * per-level numbers are not, because one screenshot is a single data point.
 *
 * Rows live in `lib/data/hero-linking.json` and the editor exports a
 * replacement for that file. Heroes are named with the Heroes roster spelling,
 * so their portraits and roster links resolve. The prose beside a hero is not
 * game data, so it lives in `guideEntries.heroLinking.linkTexts` in every
 * dictionary instead of in the JSON, with English as the text the other
 * languages fall back to.
 */

import roster from "../data/hero-linking.json" with { type: "json" };

/** The two tracks a link unlocks from. */
export const LINK_SOURCES = ["grail", "odin"] as const;
export type LinkSource = (typeof LINK_SOURCES)[number];

export type HeroLink = {
  /** Heroes roster spelling. */
  hero: string;
  source: LinkSource;
  /** Which step of that track unlocks the link. */
  step: number;
};

/** A hero worth spending a link on, in the order they should be linked. */
export type LinkTarget = { hero: string };

export type HeroLinkingData = { links: HeroLink[]; priority: LinkTarget[] };

/** The note beside a hero in one language, keyed by hero name within its list. */
export type HeroLinkingTexts = {
  links?: Record<string, string>;
  priority?: Record<string, string>;
};

export const LINKING_DATA = roster as HeroLinkingData;
export const HERO_LINKS: HeroLink[] = LINKING_DATA.links;
export const LINK_PRIORITY: LinkTarget[] = LINKING_DATA.priority;

/** The links of one track, in step order. */
export function linksBySource(source: LinkSource): HeroLink[] {
  return HERO_LINKS.filter((link) => link.source === source).sort((left, right) => left.step - right.step);
}

/**
 * The note beside a hero as a reader sees it: their own language when it has
 * one, otherwise the English note, the same fallback the rest of the site uses.
 */
export function linkNote(hero: string, texts: HeroLinkingTexts, english: HeroLinkingTexts): string {
  return texts.links?.[hero]?.trim() || english.links?.[hero]?.trim() || "";
}

export function priorityNote(hero: string, texts: HeroLinkingTexts, english: HeroLinkingTexts): string {
  return texts.priority?.[hero]?.trim() || english.priority?.[hero]?.trim() || "";
}
