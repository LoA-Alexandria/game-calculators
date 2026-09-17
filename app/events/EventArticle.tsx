"use client";

import Link from "next/link";
import type { Dictionary } from "../../lib/i18n";
import { sectionById, type EventCategoryId } from "../../lib/navigation";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { BackLink } from "../components/Ui";

export type EventGuideId = keyof Dictionary["eventGuideEntries"];

export function isEventGuideId(
  id: string,
  entries: Dictionary["eventGuideEntries"],
): id is EventGuideId {
  return Object.hasOwn(entries, id);
}

function categoryForGuide(id: EventGuideId): EventCategoryId {
  const href = `/events/${id}/`;
  const item = sectionById("events").items.find((entry) => entry.href === href);
  const categoryId = item?.categoryId;
  if (categoryId === "anleitungen" || categoryId === "tips") return categoryId;
  return "tips";
}

/**
 * Simple event write-up: Events crumbs, title, intro, sections. Kept separate
 * from GuideArticle so Guides stay untouched.
 */
export function EventArticle({ id }: { id: EventGuideId }) {
  const { t } = useLocale();
  const guide = t.eventGuideEntries[id];
  const categoryId = categoryForGuide(id);
  useDocumentTitle(guide.title);

  return (
    <>
      <BackLink href="/events/" label={t.nav.events} />
      <header className="guide-head" data-category={categoryId}>
        <nav className="guide-crumbs" aria-label={t.nav.events}>
          <Link href="/events/">{t.nav.events}</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/events/#${categoryId}`}>{t.eventCategories[categoryId]}</Link>
        </nav>
        <h1>{guide.title}</h1>
        <p className="guide-head-lede">{guide.summary}</p>
      </header>
      <article className="article">
        <p className="intro">{guide.intro}</p>
        {guide.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </section>
        ))}
        {guide.note ? <p className="callout">{guide.note}</p> : null}
      </article>
    </>
  );
}
