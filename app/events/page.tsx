"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { sectionById, type NavItem } from "../../lib/navigation";
import { EventsIcon, SearchIcon } from "../components/Icons";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { PageHead, SectionBanner } from "../components/Ui";
import { asset } from "../../lib/site";

/** Lower-case and without accents, so "grosse" finds Große. */
function fold(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();
}

export default function EventsPage() {
  const { t } = useLocale();
  const section = sectionById("events");
  const [query, setQuery] = useState("");
  useDocumentTitle(t.events.title);

  const needle = fold(query);
  const shown = useMemo(
    () =>
      section.items.filter(
        (item) =>
          !needle ||
          fold(`${item.label(t)} ${item.description?.(t) ?? ""}`).includes(needle),
      ),
    [needle, section.items, t],
  );

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
        </div>

        {needle && shown.length === 0 ? <p className="empty-state">{t.events.noMatch}</p> : null}

        {total === 0 ? (
          <p className="empty-state">{t.events.empty}</p>
        ) : shown.length > 0 ? (
          <ul className="guides-grid">
            {shown.map((item) => (
              <li key={item.href}>
                <EventCard item={item} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}

function EventCard({ item }: { item: NavItem }) {
  const { t } = useLocale();
  const icon = item.icon ? asset(item.icon) : null;
  return (
    <article className="guide-card">
      {icon ? (
        <div className="guide-card-art is-icon" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt="" width={88} height={88} />
        </div>
      ) : (
        <div className="guide-card-art is-glyph" aria-hidden="true">
          <EventsIcon className="guide-card-glyph" />
        </div>
      )}
      <div className="guide-card-body">
        <h3>
          <Link className="guide-card-link" href={item.href}>
            {item.label(t)}
          </Link>
        </h3>
        {item.description ? <p>{item.description(t)}</p> : null}
      </div>
    </article>
  );
}
