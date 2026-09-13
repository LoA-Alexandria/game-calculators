import type { NavSection } from "../navigation.ts";
import { asset } from "../site.ts";

/**
 * Optional images for the banner slot on each section index.
 *
 * Drop a file in `public/banners/` and set the path here (for example
 * `/banners/events.webp`). Until a path is set, the page draws a decorative
 * CSS banner so the space is already reserved.
 */
export const SECTION_BANNER_SRC: Partial<Record<NavSection["id"], string>> = {};

export function sectionBannerUrl(id: NavSection["id"]): string | null {
  const path = SECTION_BANNER_SRC[id];
  return path ? asset(path) : null;
}
