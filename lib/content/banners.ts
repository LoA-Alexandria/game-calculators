import type { NavSection } from "../navigation.ts";
import { asset } from "../site.ts";
import type { GuideEntryId } from "./guides.ts";

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
 * Artwork that takes the place of a guide's title text. The picture already
 * says the title, so the heading keeps the translated title as its alt text.
 *
 * The Hero tier list banner was supplied by the site team on 16 September
 * 2026 (`public/banners/hero-tier-list.webp`, 1024 × 144). The Artwork
 * gallery banner was supplied the same day (`public/banners/artwork.webp`,
 * 1024 × 144). The Goddesses banner followed later that day
 * (`public/banners/goddesses.webp`, 1024 × 144). The Heroes banner is original
 * splash art for the same 1024 × 144 title slot (`public/banners/heroes.webp`,
 * 18 September 2026).
 */
const TITLE_BANNER_VERSION: Partial<Record<GuideEntryId, string>> = {
  heroes: "5",
};

export const GUIDE_TITLE_BANNERS: Partial<Record<GuideEntryId, TitleBanner>> = {
  heroTierList: { src: "/banners/hero-tier-list.webp", width: 1024, height: 144 },
  artwork: { src: "/banners/artwork.webp", width: 1024, height: 144 },
  goddesses: { src: "/banners/goddesses.webp", width: 1024, height: 144 },
  heroes: { src: "/banners/heroes.webp", width: 1024, height: 144 },
};

export function guideTitleBanner(id: GuideEntryId): TitleBanner | null {
  const banner = GUIDE_TITLE_BANNERS[id];
  if (!banner) return null;
  const src = asset(banner.src);
  const version = TITLE_BANNER_VERSION[id];
  return { ...banner, src: version ? `${src}?v=${version}` : src };
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
  return name ? { src: asset(`/banners/tools/${name}.webp`), width: 1024, height: 144 } : null;
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
