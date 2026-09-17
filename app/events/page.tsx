"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { eventCategoryGroups, sectionById, type NavGroup, type NavItem } from "../../lib/navigation";
import { EventsIcon, SearchIcon } from "../components/Icons";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead, SectionBanner } from "../components/Ui";

/** Lower-case and without accents, so "grosse" finds Große. */
function fold(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
}

export default function EventsPage() {
  const { t } = useLocale();
  const pathname = usePathname();
  const section = sectionById("events");
  const groups = useMemo(() => eventCategoryGroups(t, section.items), [section.items, t]);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  useDocumentTitle(t.events.title);

  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.replace(/^#/, "");
      setCategory(groups.some((group) => group.id === hash) ? hash : "all");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [pathname, groups]);

  const pick = (id: string) => {
    setCategory(id);
    window.history.replaceState(null, "", id === "all" ? (pathname ?? "/events/") : `#${id}`);
  };

  const needle = fold(query);
  const shown = groups
    .filter((group) => category === "all" || group.id === category)
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !needle ||
          fold(`${item.label(t)} ${item.description?.(t) ?? ""} ${group.category}`).includes(needle),
      ),
    }))
    .filter((group) => !needle || group.items.length > 0 || category !== "all");

  const total = section.items.length;

  return (
    <>
      <SectionBanner id="events" />
      <PageHead eyebrow={t.navDescriptions.events} title={t.events.title} lede={t.events.lede} />

      <div className="guides-index">
        <ul className="guides-stats">
          <li>
            <strong>{total}</strong> {t.events.statEntries}
          </li>
          <li>
            <strong>{groups.length}</strong> {t.events.statCategories}
          </li>
        </ul>

        <div className="guides-toolbar">
          <label className="guides-search">
            <SearchIcon className="icon icon-sm" />
            <span className="visually-hidden">{t.events.searchLabel}</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.events.searchPlaceholder}
            />
          </label>
          <div className="guides-filters" role="group" aria-label={t.events.filterLabel}>
            <button type="button" className="guides-filter" aria-pressed={category === "all"} onClick={() => pick("all")}>
              {t.events.filterAll}
              <span className="guides-filter-count">{total}</span>
            </button>
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                className="guides-filter"
                data-category={group.id}
                aria-pressed={category === group.id}
                onClick={() => pick(group.id)}
              >
                {group.category}
                <span className="guides-filter-count">{group.items.length}</span>
              </button>
            ))}
          </div>
        </div>

        {needle && shown.every((group) => group.items.length === 0) ? (
          <p className="empty-state">{t.events.noMatch}</p>
        ) : null}

        {shown.map((group) => (
          <EventCategory key={group.id} group={group} />
        ))}
      </div>
    </>
  );
}

function EventCategory({ group }: { group: NavGroup }) {
  const { t, tf } = useLocale();
  const ledes = t.events.categoryLedes as Record<string, string>;
  return (
    <section className="guides-category" id={group.id} data-category={group.id} aria-labelledby={`events-${group.id}`}>
      <header className="guides-category-head">
        <h2 id={`events-${group.id}`}>{group.category}</h2>
        <span className="guides-category-count">
          {group.items.length === 1
            ? t.events.countEntriesOne
            : tf(t.events.countEntries, { count: group.items.length })}
        </span>
        {ledes[group.id] ? <p>{ledes[group.id]}</p> : null}
      </header>
      {group.items.length === 0 ? (
        <p className="assumption" style={{ margin: 0 }}>
          {t.events.categoryEmpty}
        </p>
      ) : (
        <ul className="guides-grid">
          {group.items.map((item) => (
            <li key={item.href}>
              <EventCard item={item} category={group.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EventCard({ item, category }: { item: NavItem; category: string }) {
  const { t } = useLocale();
  return (
    <article className="guide-card" data-category={category}>
      <div className="guide-card-art is-glyph" aria-hidden="true">
        <EventsIcon className="guide-card-glyph" />
      </div>
      <div className="guide-card-body">
        <h3>
          <Link className="guide-card-link" href={item.href}>
            {item.label(t)}
          </Link>
        </h3>
        {item.description ? <p>{item.description(t)}</p> : null}
        <div className="guide-card-foot">
          <span className="guide-card-category">{item.badge?.(t)}</span>
        </div>
      </div>
    </article>
  );
}
