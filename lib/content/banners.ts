import type { NavSection } from "../navigation.ts";
import { asset } from "../site.ts";
import { camelToKebab, type GuideEntryId } from "./guides.ts";

/**
 * Optional images for the banner slot on each section index.
 *
 * Drop a file in `public/banners/` and set the path here (for example
 * `/banners/events.webp`). Until a path is set, the page draws a decorative
 * CSS banner so the space is already reserved.
 *
 * The four illustrated banners are original splash art for this unofficial
 * fan site, not artwork from the game.
 */
export const SECTION_BANNER_SRC: Partial<Record<NavSection["id"], string>> = {
  news: "/banners/guides-scene.webp",
  events: "/banners/guides-scene.webp",
  guides: "/banners/guides-scene.webp",
  calculators: "/banners/guides-scene.webp",
  simulations: "/banners/guides-scene.webp",
  guilds: "/banners/guides-scene.webp",
};

export const SECTION_BANNER_LOGO_SRC: Partial<Record<NavSection["id"], string>> = {
  news: "/banners/news-logo.webp",
  events: "/banners/events-logo.webp",
  guides: "/banners/guides-logo.webp",
  calculators: "/banners/calculators-logo.webp",
  simulations: "/banners/simulations-logo.webp",
  // Guilds shows the scene alone until it has a plaque of its own; the guides one said "GUIDES".
};

export function sectionBannerUrl(id: NavSection["id"]): string | null {
  const path = SECTION_BANNER_SRC[id];
  return path ? asset(path) : null;
}

export function sectionBannerLogoUrl(id: NavSection["id"]): string | null {
  const path = SECTION_BANNER_LOGO_SRC[id];
  return path ? asset(path) : null;
}

export type TitleBanner = { src: string; width: number; height: number };

/**
 * Artwork that takes the place of a title. The picture already says the title,
 * so the heading keeps the translated one as its alt text.
 *
 * Every guide, every event and every tool has one, supplied by the site team
 * and redrawn at 2048 × 288 on 26 September 2026 — twice the slot they fill,
 * so they stay sharp on a dense screen. The file name is the id in kebab-case,
 * which is also the page's own slug.
 */
const TITLE_BANNER_SIZE = { width: 1024, height: 144 } as const;

/** Bumped when the pictures are redrawn, so a cached one is not served. */
const TITLE_BANNER_VERSION = "hd1";

function titleBanner(path: string): TitleBanner {
  return { src: `${asset(path)}?v=${TITLE_BANNER_VERSION}`, ...TITLE_BANNER_SIZE };
}

const GUIDE_BANNER_IDS: readonly GuideEntryId[] = [
  "heroes", "technology", "collection", "artwork", "collectionLayouts",
  "artworkLayouts", "manor", "adsBuy", "goddesses", "cryptides",
  "goddessTheater", "anecdotes", "heroLayouts", "heroTierList", "heroLinking",
  "heroLeveling", "goddessLeveling", "buildings", "serverAgeUnlocks", "museion",
];

export function guideTitleBanner(id: GuideEntryId): TitleBanner | null {
  return GUIDE_BANNER_IDS.includes(id) ? titleBanner(`/banners/${camelToKebab(id)}.webp`) : null;
}

/** Every event page has one too; the id is its slug. */
export function eventTitleBanner(id: string): TitleBanner {
  return titleBanner(`/banners/events/${camelToKebab(id)}.webp`);
}

/**
 * The same 1024 × 144 title slot, for a calculator or simulation, keyed by the
 * page's own path. Supplied by the site team on 26 September 2026
 * (`public/banners/tools/`), together with the matching icons in
 * `public/tool-icons/`, which the cards on the two index pages wear.
 */
const TOOL_ART: Record<string, string> = {
  "/calculators/city-upgrade/": "city-upgrade",
  "/calculators/goddess-materials/": "goddess-materials",
  "/calculators/goddess-xp/": "goddess-xp",
  "/calculators/grand-voyage-route/": "grand-voyage-route",
  "/calculators/red-carpet-materials/": "red-carpet-materials",
  "/calculators/theater-income/": "theater-income",
  "/simulations/irrigation-planner/": "irrigation-planner",
};

/** Trailing slash or not, a path finds its artwork. */
function toolKey(href: string | null | undefined): string | null {
  if (!href) return null;
  const path = href.endsWith("/") ? href : `${href}/`;
  return TOOL_ART[path] ?? null;
}

export function toolTitleBanner(href: string | null | undefined): TitleBanner | null {
  const name = toolKey(href);
  return name ? titleBanner(`/banners/tools/${name}.webp`) : null;
}

export function toolIconUrl(href: string | null | undefined): string | null {
  const name = toolKey(href);
  return name ? asset(`/tool-icons/${name}.webp`) : null;
}

/**
 * Header art for a group of guides on the guides index. The file names are the
 * category ids from `lib/navigation.ts` in kebab-case.
 */
const GUIDE_CATEGORY_ART: Record<string, string> = {
  coreElements: "core-elements",
  buildings: "buildings",
  layouts: "layouts",
  tierLists: "tier-lists",
  tips: "tips",
};

export function guideCategoryArtUrl(categoryId: string): string | null {
  const name = GUIDE_CATEGORY_ART[categoryId];
  return name ? asset(`/banners/guide-categories/${name}.webp`) : null;
}
