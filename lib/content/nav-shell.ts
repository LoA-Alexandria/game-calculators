import type { Dictionary } from "../i18n/index.ts";
import { SECTIONS } from "../navigation.ts";

/**
 * Strip a trailing slash so `/guides/artwork/` and `/guides/artwork` compare
 * as the same place. Keep `/` as `/`.
 */
export function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path || "/";
}

/** True when the reader is on this href, ignoring a trailing slash. */
export function pathIsExact(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  return normalizePath(pathname) === normalizePath(href);
}

/**
 * True when the reader is on this href or a nested page under it
 * (`/guides/artwork/edit/` matches `/guides/artwork/`, but
 * `/guides/artwork-layouts/` does not).
 */
export function pathIsCurrentOrNested(
  pathname: string | null | undefined,
  href: string,
): boolean {
  if (!pathname) return false;
  const current = normalizePath(pathname);
  const target = normalizePath(href);
  if (current === target) return true;
  if (target === "/") return false;
  return current.startsWith(`${target}/`);
}

export type NavCrumb = {
  href: string;
  label: string;
  current?: boolean;
};

const CREATE_PAGES: { href: string; parent: string; label: (t: Dictionary) => string }[] = [
  { href: "/guides/new/", parent: "/guides/", label: (t) => t.nav.newGuide },
  { href: "/news/new/", parent: "/news/", label: (t) => t.nav.newNews },
  { href: "/admin/", parent: "/", label: (t) => t.nav.admin },
  { href: "/post/", parent: "/", label: (t) => t.nav.post },
];

/**
 * Clickable trail for the top bar: Overview, then the section, then the
 * specific guide or tool. Nested editor URLs stop at the published page so
 * `/guides/artwork/edit/` still reads as Artwork.
 */
export function navCrumbs(
  pathname: string | null | undefined,
  t: Dictionary,
): NavCrumb[] {
  const crumbs: NavCrumb[] = [{ href: "/", label: t.nav.home }];
  if (pathIsExact(pathname, "/")) {
    crumbs[0].current = true;
    return crumbs;
  }

  const created = CREATE_PAGES.find((page) => pathIsExact(pathname, page.href));
  if (created) {
    if (created.parent !== "/") {
      const parent = SECTIONS.find((section) => pathIsExact(section.href, created.parent));
      crumbs.push({
        href: created.parent,
        label: parent ? parent.label(t) : created.parent,
      });
    }
    crumbs.push({ href: created.href, label: created.label(t), current: true });
    return crumbs;
  }

  const section = SECTIONS.find((entry) => pathIsCurrentOrNested(pathname, entry.href));
  if (!section) {
    crumbs[crumbs.length - 1].current = true;
    return crumbs;
  }

  crumbs.push({ href: section.href, label: section.label(t) });
  const item = section.items.find((entry) => pathIsCurrentOrNested(pathname, entry.href));
  if (item) crumbs.push({ href: item.href, label: item.label(t) });
  crumbs[crumbs.length - 1].current = true;
  return crumbs;
}
