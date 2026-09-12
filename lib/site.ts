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

/**
 * TODO: replace with the real invite before going live.
 * A Discord invite is a public URL and safe to commit; prefer a non-expiring
 * one so the link in the sidebar does not go dead.
 */
export const DISCORD_URL = "https://discord.gg/REPLACE-ME";

/** True while `DISCORD_URL` is still the placeholder above. */
export const DISCORD_CONFIGURED = !DISCORD_URL.includes("REPLACE-ME");

/** Key shared with the vendored Irrigation Planner for its theme override. */
export const THEME_STORAGE_KEY = "popepoch-theme";

/** Key holding the reader's language choice. */
export const LOCALE_STORAGE_KEY = "popepoch-locale";

/**
 * Demo-only keys. The session one holds a role that nothing verifies, so it is
 * named to make that obvious in devtools. Both disappear with the real backend
 * — see docs/AUTH-AND-CMS.md.
 */
export const SESSION_STORAGE_KEY = "popepoch-demo-session";
export const MAPPINGS_STORAGE_KEY = "popepoch-demo-role-mappings";
export const GUIDE_DRAFT_STORAGE_KEY = "popepoch-demo-guide-draft";
