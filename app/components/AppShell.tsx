"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS, groupByBadge, sectionHasBrowsePanel, type NavItem, type NavSection } from "../../lib/navigation";
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
 * Guides skip this because they are grouped by category.
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

function sectionForPath(pathname: string): NavSection | null {
  return SECTIONS.find((section) => pathIsCurrentOrNested(pathname, section.href)) ?? null;
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
  const [hash, setHash] = useState("");
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const narrow = useSyncExternalStore(subscribeDrawer, readDrawer, () => false);
  const wantFilterFocus = useRef(false);
  const shellRef = useRef<HTMLElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const pathSection = sectionForPath(pathname);
  const onOverview = pathIsExact(pathname, "/");
  const pathHasPanel = Boolean(pathSection && sectionHasBrowsePanel(pathSection));
  const query = filter.trim().toLocaleLowerCase();
  const searching = query.length > 0;
  /**
   * Overview is rail-only. The browse panel opens for sections with a nested
   * list (Guides, Events, Calculators, Simulations), or while a search runs.
   */
  const panelClosed = !narrow && !searching && (onOverview || !pathHasPanel || collapsed);
  const panelVisible = narrow ? open : !panelClosed;
  const browseSection = pathSection
    ?? SECTIONS.find((section) => section.items.length > 0)
    ?? SECTIONS[0];

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
    const root = shellRef.current;
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
    if (!panelVisible) return;
    const active = shellRef.current?.querySelector<HTMLElement>(".panel-link.is-active");
    active?.scrollIntoView({ block: "nearest" });
  }, [pathname, hash, panelVisible, browseSection.id]);

  const filteredSections = useMemo<{ section: NavSection; items: NavItem[] }[]>(() => {
    if (!query) return SECTIONS.map((section) => ({ section, items: section.items }));
    return SECTIONS.map((section) => {
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

  const browseEntry = filteredSections.find((entry) => entry.section.id === browseSection.id)
    ?? { section: browseSection, items: browseSection.items };

  const nothingFound = searching && filteredSections.length === 0;

  const crumbs = useMemo(() => navCrumbs(pathname, t), [pathname, t]);

  const renderItemList = (section: NavSection, items: NavItem[]) => {
    const groups = section.id === "guides" ? groupByBadge(items, t, t.guides.other) : null;
    const shown = searching || groups ? items : items.slice(0, VISIBLE_ITEMS);
    const hidden = groups ? 0 : items.length - shown.length;
    const sectionExact = pathIsExact(pathname, section.href);

    if (groups) {
      return (
        <ul className="panel-list">
          {groups.map((group) => {
            const groupCurrent = group.items.some((item) => pathIsCurrentOrNested(pathname, item.href))
              || (sectionExact && hash === group.id);
            return (
              <li key={group.id} className="panel-group">
                <Link
                  className={groupCurrent ? "panel-category is-current" : "panel-category"}
                  href={`${section.href}#${group.id}`}
                >
                  {group.category}
                </Link>
                <ul className="panel-list panel-list-nested">
                  {group.items.map((item) => {
                    const active = pathIsCurrentOrNested(pathname, item.href);
                    const exact = pathIsExact(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          className={active ? "panel-link is-active" : "panel-link"}
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
      );
    }

    return (
      <ul className="panel-list">
        {shown.map((item) => {
          const active = pathIsCurrentOrNested(pathname, item.href);
          const exact = pathIsExact(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                className={active ? "panel-link is-active" : "panel-link"}
                href={item.href}
                aria-current={exact ? "page" : undefined}
              >
                <span className="panel-link-title">{item.label(t)}</span>
                {item.description ? (
                  <span className="panel-link-desc">{item.description(t)}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
        {hidden > 0 && (
          <li>
            <Link className="panel-link panel-more" href={section.href}>
              {tf(t.shell.showAll, { count: items.length })}
            </Link>
          </li>
        )}
      </ul>
    );
  };

  return (
    <div className={panelClosed ? "layout-root is-nav-collapsed" : "layout-root"}>
      <a className="skip-link" href="#content">{t.shell.skipToContent}</a>

      <button
        type="button"
        className="nav-scrim"
        hidden={!open}
        aria-label={t.shell.closeMenu}
        onClick={() => setOpen(false)}
      />

      <aside
        ref={(node) => { shellRef.current = node; }}
        className={open ? "nav-shell is-open" : "nav-shell"}
        aria-label={t.shell.sectionLabel}
        onClick={closeIfNavigating}
      >
        <div className="nav-rail">
          <Link
            className="rail-brand"
            href="/"
            title={t.shell.brand}
            aria-label={t.shell.brand}
            onClick={() => writeCollapsed(false)}
          >
            <span className="brand-mark"><BrandMark className="icon" /></span>
          </Link>

          <nav className="rail-nav" aria-label={t.shell.sectionLabel}>
            <Link
              className={onOverview ? "rail-link is-active" : "rail-link"}
              href="/"
              title={t.nav.home}
              aria-label={t.nav.home}
              aria-current={onOverview ? "page" : undefined}
              onClick={() => writeCollapsed(false)}
            >
              <HomeIcon className="icon" />
            </Link>

            {SECTIONS.map((section) => {
              const Icon = SECTION_ICONS[section.icon];
              const current = pathIsCurrentOrNested(pathname, section.href);
              const label = section.label(t);
              return (
                <Link
                  key={section.id}
                  className={current ? "rail-link is-active" : "rail-link"}
                  href={section.href}
                  title={label}
                  aria-label={label}
                  aria-current={pathIsExact(pathname, section.href) ? "page" : undefined}
                  onClick={() => {
                    if (!narrow) writeCollapsed(!sectionHasBrowsePanel(section));
                  }}
                >
                  <Icon className="icon" />
                  {section.items.length > 0 && (
                    <span className="rail-count" aria-hidden="true">{section.items.length}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="rail-foot">
            <a
              className="rail-link"
              href={DISCORD_URL}
              title={t.shell.discordTitle}
              aria-label={t.shell.discordTitle}
              target="_blank"
              rel="noreferrer"
            >
              <DiscordIcon className="icon" />
            </a>
            <SchemeMenu />
            <ThemeToggle />
            <button
              type="button"
              className="rail-link rail-collapse"
              aria-label={panelClosed ? t.shell.expandNav : t.shell.collapseNav}
              title={panelClosed ? t.shell.expandNav : t.shell.collapseNav}
              aria-pressed={panelClosed}
              hidden={onOverview || (!pathHasPanel && !searching)}
              onClick={() => writeCollapsed(!collapsed)}
            >
              <SidebarIcon className="icon" />
            </button>
            <button
              type="button"
              className="rail-link rail-close"
              aria-label={t.shell.closeMenu}
              onClick={() => setOpen(false)}
            >
              <CloseIcon className="icon" />
            </button>
          </div>
        </div>

        <div className="nav-panel" {...(panelVisible ? {} : { inert: true, "aria-hidden": true })}>
          <div className="panel-head">
            <div className="panel-brand-text">
              <strong>{t.shell.brand}</strong>
              <span>{t.shell.tagline}</span>
            </div>
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

          <div className="panel-body">
            {nothingFound ? (
              <p className="nav-empty">{t.shell.filterEmpty}</p>
            ) : searching ? (
              filteredSections.map(({ section, items }) => (
                <section className="panel-section" key={section.id}>
                  <Link className="panel-section-title" href={section.href}>
                    {section.label(t)}
                  </Link>
                  {items.length > 0 ? (
                    renderItemList(section, items)
                  ) : (
                    <p className="panel-section-hint">{section.description(t)}</p>
                  )}
                </section>
              ))
            ) : pathHasPanel ? (
              <section className="panel-section">
                <Link className="panel-section-title" href={browseEntry.section.href}>
                  {browseEntry.section.label(t)}
                </Link>
                <p className="panel-section-hint">{browseEntry.section.description(t)}</p>
                {renderItemList(browseEntry.section, browseEntry.items)}
              </section>
            ) : (
              <section className="panel-section">
                <p className="panel-section-hint">{t.shell.tagline}</p>
                <ul className="panel-list">
                  {SECTIONS.map((section) => {
                    const active = pathIsCurrentOrNested(pathname, section.href);
                    return (
                      <li key={section.id}>
                        <Link
                          className={active ? "panel-link is-active" : "panel-link"}
                          href={section.href}
                          onClick={() => {
                            if (!narrow) writeCollapsed(!sectionHasBrowsePanel(section));
                          }}
                        >
                          <span className="panel-link-title">{section.label(t)}</span>
                          <span className="panel-link-desc">{section.description(t)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>

          <div className="panel-foot">
            <a className="panel-meta" href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              {t.shell.github}
            </a>
            {!DISCORD_CONFIGURED && <span className="pill pill-warn">TODO</span>}
          </div>
        </div>
      </aside>

      <div className="layout-main" {...(open && narrow ? { inert: true } : {})}>
        <header className="topbar">
          {narrow ? (
            <button
              ref={menuButtonRef}
              type="button"
              className="icon-button topbar-menu"
              aria-label={t.shell.openMenu}
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <MenuIcon className="icon" />
            </button>
          ) : null}
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
          <LanguageMenu />
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
