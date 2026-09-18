"use client";

import Link from "next/link";
import type { Dictionary } from "../../lib/i18n";
import {
  eventWiki,
  eventWikiHasHelp,
  eventWikiIconUrl,
} from "../../lib/content/event-guides";
import { asset } from "../../lib/site";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { BackLink } from "../components/Ui";

export type EventGuideId = keyof Dictionary["eventGuideEntries"];

export function isEventGuideId(
  id: string,
  entries: Dictionary["eventGuideEntries"],
): id is EventGuideId {
  return Object.hasOwn(entries, id);
}

/**
 * Event write-up: wiki in-game help first (when the wiki page has any), then
 * Discord community tips. Kept separate from GuideArticle so Guides stay
 * untouched.
 */
export function EventArticle({ id }: { id: EventGuideId }) {
  const { t } = useLocale();
  const guide = t.eventGuideEntries[id];
  const wiki = eventWiki(id);
  const icon = eventWikiIconUrl(id);
  const showWiki = eventWikiHasHelp(id);
  useDocumentTitle(guide.title);

  return (
    <>
      <BackLink href="/events/" label={t.nav.events} />
      <header className="guide-head event-head">
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="event-head-icon" src={icon} alt="" width={72} height={72} />
        ) : null}
        <div className="event-head-copy">
          <nav className="guide-crumbs" aria-label={t.nav.events}>
            <Link href="/events/">{t.nav.events}</Link>
          </nav>
          <h1>{guide.title}</h1>
          <p className="guide-head-lede">{guide.summary}</p>
        </div>
      </header>
      <article className="article">
        <p className="intro">{guide.intro}</p>
        {showWiki && wiki ? (
          <section className="event-wiki">
            <h2>{t.events.wikiHelp}</h2>
            {wiki.intro ? <p>{wiki.intro}</p> : null}
            {wiki.sections.map((section) => (
              <div key={section.heading} className="event-wiki-block">
                <h3>{section.heading}</h3>
                <ul className="event-wiki-list">
                  {section.items.map((item, index) => (
                    <li key={`${section.heading}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            {wiki.images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.src}
                className="event-tip-figure"
                src={asset(image.src)}
                alt={image.alt}
                loading="lazy"
                decoding="async"
              />
            ))}
            {wiki.wikiUrl ? (
              <p className="event-wiki-source">
                <a href={wiki.wikiUrl} target="_blank" rel="noreferrer">
                  {t.events.wikiSource}
                </a>
                {" — "}
                {t.events.wikiCredit}
              </p>
            ) : null}
          </section>
        ) : null}
        {guide.sections.length > 0 ? (
          <div className="event-community">
            {showWiki ? <h2>{t.events.communityTips}</h2> : null}
            {guide.sections.map((section) => (
              <section key={section.heading}>
                {showWiki ? <h3>{section.heading}</h3> : <h2>{section.heading}</h2>}
                {section.body.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
                {"image" in section && section.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="event-tip-figure"
                    src={asset(section.image.src)}
                    alt={section.image.alt}
                    width={section.image.width}
                    height={section.image.height}
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </section>
            ))}
          </div>
        ) : null}
        {guide.note ? <p className="callout">{guide.note}</p> : null}
      </article>
    </>
  );
}
