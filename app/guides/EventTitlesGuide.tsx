"use client";

import Image from "next/image";
import Link from "next/link";
import { EVENT_TITLES, UNNAMED_GREEN_TITLE_EVENTS, eventTitleHref, type EventTitle, type EventTitleTier } from "../../lib/content/event-title-guide";
import { eventWikiIconUrl } from "../../lib/content/event-guides";
import type { Dictionary } from "../../lib/i18n";
import { asset } from "../../lib/site";
import { useEventWiki } from "../events/useEventWiki";

type Guide = Dictionary["guideEntries"]["eventTitles"];

const TIERS: readonly EventTitleTier[] = ["orange", "purple", "blue", "green"];

export function isEventTitlesGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return "eventTitlesHeading" in guide;
}

function EventLink({ entry, guide, t }: { entry: EventTitle["events"][number]; guide: Guide; t: Dictionary }) {
  const entries = useEventWiki();
  const icon = entry.guideId ? eventWikiIconUrl(entry.guideId, entries) : undefined;
  const name = guide.eventNames[entry.name as keyof typeof guide.eventNames] ?? (entry.guideId ? t.eventGuideEntries[entry.guideId].title : entry.name);
  const condition = entry.condition ? guide.conditions[entry.condition as keyof typeof guide.conditions] ?? entry.condition : undefined;
  const noteKey = `steelheart-overlord:${entry.name}` as keyof typeof guide.eventNotes;
  const note = entry.note ? guide.eventNotes[noteKey] ?? entry.note : undefined;
  return (
    <li className="event-title-event">
      <Link href={eventTitleHref(entry)}>
        {icon ? <Image src={icon} alt="" width={24} height={24} /> : <span className="event-title-link-mark" aria-hidden="true">↗</span>}
        <span className="event-title-event-copy">
          <span className="event-title-event-name">{name}</span>
          {condition ? <span className="event-title-condition">{condition}</span> : null}
          {note ? <span className="event-title-condition">{note}</span> : null}
        </span>
      </Link>
    </li>
  );
}

function TitleCard({ title, tierLabel, guide, t }: { title: EventTitle; tierLabel: string; guide: Guide; t: Dictionary }) {
  const name = guide.titleNames[title.id as keyof typeof guide.titleNames] ?? title.name;
  return (
    <article className="event-title-card" data-tier={title.tier}>
      <div className="event-title-art-wrap">
        {title.image ? (
          <Image className="event-title-art" src={asset(title.image)} alt={name} width={600} height={135} />
        ) : (
          <div className="event-title-art-fallback" aria-label={`${name}: ${guide.artMissingLabel}`}>
            <span>{name}</span>
          </div>
        )}
      </div>
      <div className="event-title-card-head">
        <h3>{name}</h3>
        <span className="event-title-tier">{tierLabel}</span>
      </div>
      <ul className="event-title-events">
        {title.events.map((entry, index) => <EventLink entry={entry} guide={guide} t={t} key={`${entry.name}-${index}`} />)}
      </ul>
    </article>
  );
}

export function EventTitlesGuide({ guide, t }: { guide: Guide; t: Dictionary }) {
  return (
    <div className="guide-wide event-titles-guide">
      <p className="intro">{guide.intro}</p>
      <nav className="event-title-legend" aria-label={guide.eventTitlesHeading}>
        {TIERS.map((tier) => (
          <a className="event-title-legend-item" data-tier={tier} href={`#event-title-${tier}`} key={tier}>
            <span className="event-title-dot" aria-hidden="true" />
            {guide.tiers[tier]}
            <span className="event-title-count">{EVENT_TITLES.filter((title) => title.tier === tier).length}</span>
          </a>
        ))}
      </nav>

      {TIERS.map((tier) => {
        const titles = EVENT_TITLES.filter((title) => title.tier === tier);
        return (
          <section className="event-title-tier-section" id={`event-title-${tier}`} data-tier={tier} key={tier}>
            <header className="event-title-section-head">
              <span className="event-title-dot" aria-hidden="true" />
              <h2>{guide.tiers[tier]}</h2>
              <span>{titles.length} {guide.titlesUnit}</span>
            </header>
            <div className="event-title-grid">
              {titles.map((title) => <TitleCard key={title.id} title={title} tierLabel={guide.tiers[tier]} guide={guide} t={t} />)}
            </div>
          </section>
        );
      })}

      <aside className="event-title-missing" aria-labelledby="event-title-missing-heading">
        <div className="event-title-missing-mark" aria-hidden="true">?</div>
        <div>
          <h2 id="event-title-missing-heading">{guide.missingTitleHeading}</h2>
          <p>{guide.missingTitleBody}</p>
          <ul className="event-title-events">
            {UNNAMED_GREEN_TITLE_EVENTS.map((entry) => <EventLink entry={entry} guide={guide} t={t} key={entry.name} />)}
          </ul>
        </div>
      </aside>

      <p className="callout event-title-source">{guide.sourceNote}</p>
    </div>
  );
}
