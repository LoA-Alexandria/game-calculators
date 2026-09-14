"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS, groupByBadge, type NavItem, type NavSection } from "../../lib/navigation";
import { navCrumbs, pathIsCurrentOrNested, pathIsExact } from "../../lib/content/nav-shell";
import { DISCORD_CONFIGURED, DISCORD_URL, NAV_COLLAPSED_STORAGE_KEY, REPOSITORY_URL } from "../../lib/site";
import { useAuth } from "./AuthProvider";
import { useLocale } from "./LocaleProvider";
import { AccountMenu } from "./AccountMenu";
import { LanguageMenu } from "./LanguageMenu";
import { SchemeMenu } from "./SchemeMenu";
import { ThemeToggle } from "./ThemeToggle";
import {
  BrandMark,
  ChevronIcon,
  CloseIcon,
  DiscordIcon,
  HomeIcon,
  MenuIcon,
  SearchIcon,
  SECTION_ICONS,
  SidebarIcon,
} from "./Icons";

/**
 * How many entries a section shows before it offers its index page instead.
 * Collapsing alone is not enough: one open section with forty guides would
 * still be an endless list. Guides skip this because they are grouped.
 */
const VISIBLE_ITEMS = 8;
const DRAWER_QUERY = "(max-width: 1024px)";

function matches(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase().includes(needle);
}

function isTypingTarget(target: EventTarget | null): boolean {
  return Boolean(
    (target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable=true]"),
  );
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea")]
    .filter((element) => !element.closest("[inert]") && element.tabIndex !== -1);
}

const NAV_COLLAPSED_EVENT = "popepoch-nav-collapsed";

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(NAV_COLLAPSED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(NAV_COLLAPSED_EVENT, onChange);
  };
}

function readCollapsed() {
  try {
    return localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(next: boolean) {
  try {
    localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
  } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(NAV_COLLAPSED_EVENT));
}

function subscribeDrawer(onChange: () => void) {
  const media = window.matchMedia(DRAWER_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readDrawer() {
  return window.matchMedia(DRAWER_QUERY).matches;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, tf } = useLocale();
  const { error: authError } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  /**
   * Which sections the reader opened or closed by hand. Anything absent falls
   * back to "open if it contains the current page", so arriving on a guide
   * shows its neighbours without every other section unfolding too.
   */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [hash, setHash] = useState("");
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const narrow = useSyncExternalStore(subscribeDrawer, readDrawer, () => false);
  const wantFilterFocus = useRef(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const railCollapsed = collapsed && !narrow;

  /**
   * On a phone the overlay covers the page, so following any link inside it
   * should close it. Handled on the click rather than by watching the path, so
   * tapping the already-current entry closes it too.
   */
  const closeIfNavigating = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("nav-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("nav-open");
    };
  }, [open]);

  useEffect(() => {
    const media = window.matchMedia(DRAWER_QUERY);
    const onChange = () => { if (!media.matches) setOpen(false); };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!open || !narrow) return;
    const root = sidebarRef.current;
    if (!root) return;
    const menuButton = menuButtonRef.current;
    const start = focusableIn(root)[0];
    start?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusableIn(root);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      menuButton?.focus();
    };
  }, [open, narrow]);

  useEffect(() => {
    const apply = () => setHash(window.location.hash.replace(/^#/, ""));
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const chord = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (slash && isTypingTarget(event.target)) return;
      if (!chord && !slash) return;
      event.preventDefault();
      if (narrow) {
        if (open) filterRef.current?.focus();
        else {
          wantFilterFocus.current = true;
          setOpen(true);
        }
        return;
      }
      if (collapsed) {
        wantFilterFocus.current = true;
        writeCollapsed(false);
        return;
      }
      filterRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [narrow, open, collapsed]);

  useEffect(() => {
    if (!wantFilterFocus.current) return;
    if (narrow && !open) return;
    if (!narrow && collapsed) return;
    wantFilterFocus.current = false;
    filterRef.current?.focus();
  }, [narrow, open, collapsed]);

  useEffect(() => {
    if (railCollapsed) return;
    const active = sidebarRef.current?.querySelector<HTMLElement>(
      ".nav-sublink.is-active, .nav-link.is-active",
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [pathname, hash, railCollapsed]);

  const query = filter.trim().toLocaleLowerCase();

  /** Sections keep their heading while filtering; only the items narrow. */
  const sections = useMemo<{ section: NavSection; items: NavItem[] }[]>(() => {
    if (!query) return SECTIONS.map((section) => ({ section, items: section.items }));
    return SECTIONS.map((section) => {
      // A section whose own name matches keeps all of its entries.
      const sectionHit = matches(section.label(t), query);
      const items = section.items.filter(
        (item) =>
          sectionHit ||
          matches(item.label(t), query) ||
          matches(item.description?.(t) ?? "", query) ||
          matches(item.badge?.(t) ?? "", query),
      );
      return { section, items, sectionHit };
    })
      .filter((entry) => entry.items.length > 0 || entry.sectionHit)
      .map(({ section, items }) => ({ section, items }));
  }, [query, t]);

  const nothingFound = query.length > 0 && sections.length === 0;

  /** While filtering, every section with a match is revealed. */
  const isOpen = (section: NavSection) => {
    if (query) return true;
    return toggled[section.id] ?? (pathIsCurrentOrNested(pathname, section.href));
  };

  const crumbs = useMemo(() => navCrumbs(pathname, t), [pathname, t]);
  const linkClass = (active: boolean, current = false) => {
    const names = ["nav-link"];
    if (active) names.push("is-active");
    else if (current) names.push("is-current");
    return names.join(" ");
  };

  return (
    <div className={railCollapsed ? "layout-root is-nav-collapsed" : "layout-root"}>
      <a className="skip-link" href="#content">{t.shell.skipToContent}</a>

      <button
        type="button"
        className="nav-scrim"
        hidden={!open}
        aria-label={t.shell.closeMenu}
        onClick={() => setOpen(false)}
      />

      <aside
        ref={(node) => { sidebarRef.current = node; }}
        className={open ? "sidebar is-open" : "sidebar"}
        aria-label={t.shell.sectionLabel}
        onClick={closeIfNavigating}
      >
        <div className="sidebar-head">
          <Link className="brand" href="/" title={t.shell.brand}>
            <span className="brand-mark"><BrandMark className="icon" /></span>
            <span className="brand-text">
              <strong>{t.shell.brand}</strong>
              <span>{t.shell.tagline}</span>
            </span>
          </Link>
          <button
            type="button"
            className="icon-button sidebar-collapse"
            aria-label={railCollapsed ? t.shell.expandNav : t.shell.collapseNav}
            title={railCollapsed ? t.shell.expandNav : t.shell.collapseNav}
            aria-pressed={railCollapsed}
            onClick={() => writeCollapsed(!collapsed)}
          >
            <SidebarIcon className="icon" />
          </button>
          <button
            type="button"
            className="icon-button sidebar-close"
            aria-label={t.shell.closeMenu}
            onClick={() => setOpen(false)}
          >
            <CloseIcon className="icon" />
          </button>
        </div>

        <div className="nav-filter">
          <SearchIcon className="icon" />
          <input
            ref={filterRef}
            type="search"
            value={filter}
            autoComplete="off"
            spellCheck={false}
            aria-label={t.shell.filterLabel}
            title={`${t.shell.filterLabel} (${t.shell.filterShortcut})`}
            aria-keyshortcuts="/ Control+k Meta+k"
            placeholder={t.shell.filterPlaceholder}
            onChange={(event) => setFilter(event.target.value)}
          />
          {filter ? (
            <button
              type="button"
              className="nav-filter-clear"
              aria-label={t.shell.clearFilter}
              onClick={() => {
                setFilter("");
                filterRef.current?.focus();
              }}
            >
              <CloseIcon className="icon icon-sm" />
            </button>
          ) : null}
        </div>

        <nav className="sidebar-nav" aria-label={t.shell.sectionLabel}>
          <Link
            className={linkClass(pathIsExact(pathname, "/"))}
            href="/"
            title={t.nav.home}
            aria-label={railCollapsed ? t.nav.home : undefined}
            aria-current={pathIsExact(pathname, "/") ? "page" : undefined}
          >
            <HomeIcon className="icon" />
            <span>{t.nav.home}</span>
          </Link>

          {sections.map(({ section, items }) => {
            const Icon = SECTION_ICONS[section.icon];
            const sectionExact = pathIsExact(pathname, section.href);
            const sectionCurrent = pathIsCurrentOrNested(pathname, section.href);
            const sectionOpen = isOpen(section);
            const label = section.label(t);
            const groups = section.id === "guides"
              ? groupByBadge(items, t, t.guides.other)
              : null;
            // A filtered list is already narrow, so show every match.
            const shown = query || groups ? items : items.slice(0, VISIBLE_ITEMS);
            const hidden = groups ? 0 : items.length - shown.length;
            return (
              <div className="nav-group" key={section.id}>
                <div className="nav-row">
                  <Link
                    className={linkClass(sectionExact, sectionCurrent)}
                    href={section.href}
                    title={label}
                    aria-label={railCollapsed ? label : undefined}
                    aria-current={sectionExact ? "page" : undefined}
                  >
                    <Icon className="icon" />
                    <span>{label}</span>
                    {section.items.length > 0 && (
                      <span className="nav-count">{section.items.length}</span>
                    )}
                  </Link>
                  {section.items.length > 0 && (
                    <button
                      type="button"
                      className={sectionOpen ? "nav-toggle is-open" : "nav-toggle"}
                      aria-expanded={sectionOpen}
                      aria-controls={`nav-section-${section.id}`}
                      aria-label={tf(
                        sectionOpen ? t.shell.collapseSection : t.shell.expandSection,
                        { section: label },
                      )}
                      onClick={() => setToggled((current) => ({ ...current, [section.id]: !sectionOpen }))}
                    >
                      <ChevronIcon className="icon icon-sm" />
                    </button>
                  )}
                </div>
                {section.items.length > 0 && (
                  <div
                    className={sectionOpen ? "nav-collapse is-open" : "nav-collapse"}
                    id={`nav-section-${section.id}`}
                  >
                    <div
                      className="nav-collapse-inner"
                      inert={!sectionOpen}
                      aria-hidden={!sectionOpen}
                    >
                      {groups ? (
                        <ul className="nav-sublist">
                          {groups.map((group) => {
                            const groupCurrent = group.items.some((item) => pathIsCurrentOrNested(pathname, item.href))
                              || (sectionExact && hash === group.id);
                            return (
                              <li key={group.id}>
                                <Link
                                  className={groupCurrent ? "nav-sublink nav-category is-current" : "nav-sublink nav-category"}
                                  href={`${section.href}#${group.id}`}
                                >
                                  {group.category}
                                </Link>
                                <ul className="nav-sublist">
                                  {group.items.map((item) => {
                                    const active = pathIsCurrentOrNested(pathname, item.href);
                                    const exact = pathIsExact(pathname, item.href);
                                    return (
                                      <li key={item.href}>
                                        <Link
                                          className={active ? "nav-sublink is-active" : "nav-sublink"}
                                          href={item.href}
                                          aria-current={exact ? "page" : undefined}
                                        >
                                          {item.label(t)}
                                        </Link>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <ul className="nav-sublist">
                          {shown.map((item) => {
                            const active = pathIsCurrentOrNested(pathname, item.href);
                            const exact = pathIsExact(pathname, item.href);
                            return (
                              <li key={item.href}>
                                <Link
                                  className={active ? "nav-sublink is-active" : "nav-sublink"}
                                  href={item.href}
                                  aria-current={exact ? "page" : undefined}
                                >
                                  {item.label(t)}
                                </Link>
                              </li>
                            );
                          })}
                          {hidden > 0 && (
                            <li>
                              <Link className="nav-sublink nav-more" href={section.href}>
                                {tf(t.shell.showAll, { count: items.length })}
                              </Link>
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {nothingFound && <p className="nav-empty">{t.shell.filterEmpty}</p>}
        </nav>

        <div className="sidebar-foot">
          <a
            className="discord-link"
            href={DISCORD_URL}
            title={t.shell.discordTitle}
            target="_blank"
            rel="noreferrer"
          >
            <DiscordIcon className="icon" />
            <span>{t.shell.discord}</span>
            {!DISCORD_CONFIGURED && <span className="pill pill-warn">TODO</span>}
          </a>
          <div className="sidebar-meta-row">
            <a className="sidebar-meta" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              {t.shell.github}
            </a>
          </div>
        </div>
      </aside>

      <div className="layout-main" {...(open && narrow ? { inert: true } : {})}>
        <header className="topbar">
          <button
            ref={menuButtonRef}
            type="button"
            className="icon-button topbar-menu"
            aria-label={narrow ? t.shell.openMenu : t.shell.expandNav}
            aria-expanded={narrow ? open : !collapsed}
            onClick={() => {
              if (narrow) setOpen(true);
              else writeCollapsed(false);
            }}
          >
            <MenuIcon className="icon" />
          </button>
          <nav className="topbar-crumbs" aria-label={t.shell.breadcrumb}>
            <ol>
              {crumbs.map((crumb, index) => (
                <li key={`${crumb.href}:${index}`}>
                  {index > 0 && <span className="topbar-sep" aria-hidden="true">/</span>}
                  {crumb.current ? (
                    <span className="topbar-crumb is-current" aria-current="page">{crumb.label}</span>
                  ) : (
                    <Link className="topbar-crumb" href={crumb.href}>{crumb.label}</Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <span className="topbar-spacer" />
          <AccountMenu />
          <a
            className="icon-button topbar-discord"
            href={DISCORD_URL}
            title={t.shell.discordTitle}
            aria-label={t.shell.discordTitle}
            target="_blank"
            rel="noreferrer"
          >
            <DiscordIcon className="icon" />
          </a>
          <LanguageMenu />
          <SchemeMenu />
          <ThemeToggle />
        </header>

        {authError && (
          <div className="auth-banner" role="alert">
            <strong>Discord sign-in failed.</strong> {authError}
          </div>
        )}

        <main className="content" id="content">{children}</main>

        <footer className="site-footer">
          <p>{t.footer.disclaimer}</p>
          <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">{t.footer.source}</a>
        </footer>
      </div>
    </div>
  );
}
