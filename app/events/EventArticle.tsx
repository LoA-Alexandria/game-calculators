"use client";

import Link from "next/link";
import { useState } from "react";
import { toLocale, type Dictionary } from "../../lib/i18n";
import { textGuideEntry, type TextGuideDraft } from "../../lib/content/text-guide-editor";
import {
  eventWiki,
  eventWikiHasHelp,
  eventWikiIconUrl,
} from "../../lib/content/event-guides";
import { asset } from "../../lib/site";
import { useAuth } from "../components/AuthProvider";
import { PenIcon } from "../components/Icons";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { TextGuideEditor } from "../components/TextGuideEditor";
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
/** What the page shows of an event guide: the published entry, or the draft while it is edited. */
type ShownGuide = {
  title: string;
  summary: string;
  intro: string;
  note: string;
  sections: readonly { heading: string; body: readonly string[]; image?: { src: string; alt: string; width: number; height: number } }[];
};

export function EventArticle({ id }: { id: EventGuideId }) {
  const { t, locale } = useLocale();
  const { allows } = useAuth();
  const canEdit = allows("guides.draft");
  const [editing, setEditing] = useState(false);
  // While the editor is open the page shows the draft, so it is its own preview.
  const [draft, setDraft] = useState<TextGuideDraft | null>(null);
  const published: ShownGuide = t.eventGuideEntries[id];
  const guide: ShownGuide = draft ? (textGuideEntry(draft, toLocale(locale)) as unknown as ShownGuide) : published;
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
          {canEdit && !editing ? (
            <div className="guide-head-meta">
              <span className="guide-head-actions">
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    window.setTimeout(() => document.getElementById("text-guide-editor")?.scrollIntoView({ block: "start" }), 0);
                  }}
                >
                  <PenIcon className="icon icon-sm" />
                  {t.guides.edit}
                </button>
              </span>
            </div>
          ) : null}
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
      {canEdit && editing ? (
        <TextGuideEditor
          catalog="eventGuideEntries"
          id={id}
          onDraft={setDraft}
          onClose={() => {
            setEditing(false);
            setDraft(null);
          }}
        />
      ) : null}
    </>
  );
}
