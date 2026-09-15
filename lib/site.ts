/**
 * Site-wide constants.
 *
 * `BASE_PATH` mirrors the `basePath` in `next.config.ts`. Next.js rewrites
 * `next/link` hrefs and bundled asset URLs on its own, but it does not touch
 * plain string URLs such as an `<iframe src>`, so anything pointing at a file
 * in `public/` has to be prefixed with this value by hand. The value is handed
 * to the browser bundle through `env.NEXT_PUBLIC_BASE_PATH` in the Next config,
 * so it is safe to read from client components too.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a path in `public/` so it resolves under the GitHub Pages base path. */
export function asset(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}

export const REPOSITORY_URL = "https://github.com/LoA-Alexandria/game-calculators";

/** Public Discord invite for the Pop Epoch community. Safe to commit. */
export const DISCORD_URL = "https://discord.gg/dNdQB6MVW8";

/** True while `DISCORD_URL` is still the placeholder above. */
export const DISCORD_CONFIGURED = !DISCORD_URL.includes("REPLACE-ME");

/** Key shared with the vendored Irrigation Planner for its theme override. */
export const THEME_STORAGE_KEY = "popepoch-theme";

/** Key shared with the Irrigation Planner for the colour-scheme palette. */
export const SCHEME_STORAGE_KEY = "popepoch-scheme";

/** Key holding the reader's language choice. */
export const LOCALE_STORAGE_KEY = "popepoch-locale";

/** Local autosave key for an editor's in-progress guide draft. */
export const GUIDE_DRAFT_STORAGE_KEY = "popepoch-guide-draft";

/** Local draft of the Hero tier list editor. */
export const TIER_DRAFT_STORAGE_KEY = "popepoch-tier-draft";

/** Local draft of the Hero layouts editor. */
export const LAYOUT_DRAFT_STORAGE_KEY = "popepoch-layout-draft";

/** Local draft of the Artwork layouts editor. */
export const ARTWORK_LAYOUT_DRAFT_STORAGE_KEY = "popepoch-artwork-layout-draft";

/** Local draft of the Artwork catalogue editor. */
export const ARTWORK_CATALOGUE_DRAFT_STORAGE_KEY = "popepoch-artwork-catalogue-draft";

/** Local draft of the Heroes roster editor, uploaded portraits included. */
export const HERO_DRAFT_STORAGE_KEY = "popepoch-hero-draft";

/** Local draft of the Goddess Theater editor, uploaded covers included. */
export const THEATER_DRAFT_STORAGE_KEY = "popepoch-theater-draft";

/** Local draft of the Hero linking editor. */
export const LINKING_DRAFT_STORAGE_KEY = "popepoch-linking-draft";

/** Whether the desktop sidebar is collapsed to an icon rail. */
export const NAV_COLLAPSED_STORAGE_KEY = "popepoch-nav-collapsed";
