import type { NavSection } from "../navigation.ts";
import { asset } from "../site.ts";

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
};

export const SECTION_BANNER_LOGO_SRC: Partial<Record<NavSection["id"], string>> = {
  news: "/banners/news-logo.webp",
  events: "/banners/events-logo.webp",
  guides: "/banners/guides-logo.webp",
  calculators: "/banners/calculators-logo.webp",
  simulations: "/banners/simulations-logo.webp",
};

export function sectionBannerUrl(id: NavSection["id"]): string | null {
  const path = SECTION_BANNER_SRC[id];
  return path ? asset(path) : null;
}

export function sectionBannerLogoUrl(id: NavSection["id"]): string | null {
  const path = SECTION_BANNER_LOGO_SRC[id];
  return path ? asset(path) : null;
}
