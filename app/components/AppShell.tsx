"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECTIONS, type NavItem, type NavSection } from "../../lib/navigation";
import { DISCORD_CONFIGURED, DISCORD_URL, REPOSITORY_URL } from "../../lib/site";
import { useAuth } from "./AuthProvider";
import { useLocale } from "./LocaleProvider";
import { SidebarAgenda } from "./EventCalendar";
import { useNow } from "./useNow";
import { LanguageMenu } from "./LanguageMenu";
import { ThemeToggle } from "./ThemeToggle";
import {
  BrandMark,
  ChevronIcon,
  CloseIcon,
  DiscordIcon,
  HomeIcon,
  MenuIcon,
  PenIcon,
  SearchIcon,
  SECTION_ICONS,
  ShieldIcon,
} from "./Icons";

/**
 * How many entries a section shows before it offers its index page instead.
 * Collapsing alone is not enough: one open section with forty guides would
 * still be an endless list.
 */
const VISIBLE_ITEMS = 8;

function matches(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase().includes(needle);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, tf } = useLocale();
  const { allows, session, loading, error: authError, signIn, signOut } = useAuth();
  const now = useNow();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  /**
   * Which sections the reader opened or closed by hand. Anything absent falls
   * back to "open if it contains the current page", so arriving on a guide
   * shows its neighbours without every other section unfolding too.
   */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

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
          matches(item.description?.(t) ?? "", query),
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
    return toggled[section.id] ?? (pathname?.startsWith(section.href) ?? false);
  };
  const activeSection = SECTIONS.find((section) => pathname?.startsWith(section.href));
  // /guides/new/ and /admin/ are not browsable sections, so name them directly.
  const context = pathname === "/guides/new/"
      ? t.nav.newGuide
      : pathname === "/admin/"
        ? t.nav.admin
        : (activeSection?.label(t) ?? t.nav.home);

  return (
    <div className="layout-root">
      <a className="skip-link" href="#content">{t.shell.skipToContent}</a>

      <button
        type="button"
        className="nav-scrim"
        hidden={!open}
        aria-label={t.shell.closeMenu}
        onClick={() => setOpen(false)}
      />

      <aside
        className={open ? "sidebar is-open" : "sidebar"}
        aria-label={t.shell.sectionLabel}
        onClick={closeIfNavigating}
      >
        <div className="sidebar-head">
          <Link className="brand" href="/">
            <span className="brand-mark"><BrandMark className="icon" /></span>
            <span className="brand-text">
              <strong>{t.shell.brand}</strong>
              <span>{t.shell.tagline}</span>
            </span>
          </Link>
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
            type="search"
            value={filter}
            aria-label={t.shell.filterLabel}
            placeholder={t.shell.filterPlaceholder}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>

        <nav className="sidebar-nav" aria-label={t.shell.sectionLabel}>
          <Link className={pathname === "/" ? "nav-link is-active" : "nav-link"} href="/">
            <HomeIcon className="icon" />
            <span>{t.nav.home}</span>
          </Link>

          {sections.map(({ section, items }) => {
            const Icon = SECTION_ICONS[section.icon];
            const sectionActive = pathname?.startsWith(section.href) ?? false;
            const open = isOpen(section);
            const label = section.label(t);
            // A filtered list is already narrow, so show every match.
            const shown = query ? items : items.slice(0, VISIBLE_ITEMS);
            const hidden = items.length - shown.length;
            return (
              <div className="nav-group" key={section.id}>
                <div className="nav-row">
                  <Link
                    className={sectionActive ? "nav-link is-active" : "nav-link"}
                    href={section.href}
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
                      className={open ? "nav-toggle is-open" : "nav-toggle"}
                      aria-expanded={open}
                      aria-controls={`nav-section-${section.id}`}
                      aria-label={tf(
                        open ? t.shell.collapseSection : t.shell.expandSection,
                        { section: label },
                      )}
                      onClick={() => setToggled((current) => ({ ...current, [section.id]: !open }))}
                    >
                      <ChevronIcon className="icon icon-sm" />
                    </button>
                  )}
                </div>
                {section.items.length > 0 && (
                  <div
                    className={open ? "nav-collapse is-open" : "nav-collapse"}
                    id={`nav-section-${section.id}`}
                  >
                    <ul className="nav-sublist">
                      {shown.map((item) => (
                        <li key={item.href}>
                          <Link
                            className={pathname === item.href ? "nav-sublink is-active" : "nav-sublink"}
                            href={item.href}
                          >
                            {item.label(t)}
                          </Link>
                        </li>
                      ))}
                      {hidden > 0 && (
                        <li>
                          <Link className="nav-sublink nav-more" href={section.href}>
                            {tf(t.shell.showAll, { count: items.length })}
                          </Link>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}

          {nothingFound && <p className="nav-empty">{t.shell.filterEmpty}</p>}
        </nav>

        <SidebarAgenda now={now} />

        <div className="sidebar-foot">
          {allows("events.write") && (
            <Link
              className={pathname === "/events/" ? "discord-link is-active" : "discord-link"}
              href="/events/"
            >
              <PenIcon className="icon" />
              <span>{t.nav.newEvent}</span>
            </Link>
          )}
          {allows("news.write") && (
            <Link
              className={pathname === "/news/new/" ? "discord-link is-active" : "discord-link"}
              href="/news/new/"
            >
              <PenIcon className="icon" />
              <span>{t.nav.newNews}</span>
            </Link>
          )}
          {allows("guides.draft") && (
            <Link
              className={pathname === "/guides/new/" ? "discord-link is-active" : "discord-link"}
              href="/guides/new/"
            >
              <PenIcon className="icon" />
              <span>{t.nav.newGuide}</span>
            </Link>
          )}
          {allows("roles.assign") && (
            <Link
              className={pathname === "/admin/" ? "discord-link is-active" : "discord-link"}
              href="/admin/"
            >
              <ShieldIcon className="icon" />
              <span>{t.nav.admin}</span>
            </Link>
          )}
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

      <div className="layout-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-button topbar-menu"
            aria-label={t.shell.openMenu}
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <MenuIcon className="icon" />
          </button>
          <div className="topbar-context">{context}</div>
          <span className="topbar-spacer" />
          {!loading && (session
            ? <div className="topbar-account"><span>{session.name}</span><button type="button" onClick={() => void signOut()}>{t.auth.signOut}</button></div>
            : <button className="topbar-sign-in" type="button" onClick={() => void signIn()}>{t.auth.signIn}</button>
          )}
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
