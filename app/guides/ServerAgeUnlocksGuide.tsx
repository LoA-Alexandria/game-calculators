"use client";

import Link from "next/link";
import { useState } from "react";
import { guideHref, guideLayout, isGuideEntryId } from "../../lib/content/guides";
import { eventWikiIconUrl } from "../../lib/content/event-guides";
import { eventGuideHref } from "../../lib/content/event-guide-routes";
import {
  ageEventGuideId,
  eventDescription,
  eventDetail,
  eventImageUrl,
  eventName,
  milestoneLabel,
  type AgeEvent,
  AGE_UNLOCKS_DATA,
} from "../../lib/content/server-age-unlocks";
import { fill, type Dictionary } from "../../lib/i18n";
import { useLocale } from "../components/LocaleProvider";
import { useGuideData } from "./GuideOverrides";
import { useEventWiki } from "../events/useEventWiki";

type Guide = Dictionary["guideEntries"]["serverAgeUnlocks"];

export function isServerAgeUnlocksGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "serverAgeUnlocks";
}

function EventRow({ event, guide }: { event: AgeEvent; guide: Guide }) {
  const { t } = useLocale();
  const entries = useEventWiki();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const name = eventName(event, guide.eventTexts);
  const detail = eventDetail(event, guide.eventTexts);
  const description = eventDescription(event, guide.eventTexts);
  const eventGuideId = ageEventGuideId(event);
  const eventGuide = eventGuideId ? t.eventGuideEntries[eventGuideId] : null;
  const eventHref = eventGuideId ? eventGuideHref(eventGuideId) : null;
  const image = event.image
    ? eventImageUrl(event.image)
    : eventGuideId
      ? eventWikiIconUrl(eventGuideId, entries) ?? null
      : null;
  const related =
    event.relatedGuide && isGuideEntryId(event.relatedGuide, t.guideEntries)
      ? t.guideEntries[event.relatedGuide]
      : null;
  const hasDetails = Boolean(description || image);

  return (
    <li className={`age-event${hasDetails ? " age-event-has-details" : ""}${detailsOpen ? " is-open" : ""}`}>
      <button
        type="button"
        className="age-event-trigger"
        aria-expanded={hasDetails ? detailsOpen : undefined}
        aria-controls={hasDetails ? `age-details-${event.id}` : undefined}
        onClick={hasDetails ? () => setDetailsOpen((open) => !open) : undefined}
      >
        <span className="age-event-main">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="age-event-thumb" src={image} alt="" width={40} height={40} />
          ) : null}
          <span className="age-event-name">{name}</span>
          {event.oneTime ? (
            <span className="age-event-once" title={guide.oneTimeHint}>
              {guide.oneTimeMark}
            </span>
          ) : null}
          {hasDetails ? (
            <span className="age-event-more" aria-hidden="true">
              {detailsOpen ? "−" : "+"}
            </span>
          ) : null}
        </span>
        {detail ? <span className="age-event-detail">{detail}</span> : null}
      </button>
      <div className="age-event-links">
        {related ? (
          <Link className="age-event-link" href={guideHref(event.relatedGuide!)}>
            {fill(guide.relatedLabel, { guide: related.title })}
          </Link>
        ) : null}
        {eventGuide && eventHref ? (
          <Link className="age-event-link" href={eventHref}>
            {fill(guide.eventLinkLabel, { event: eventGuide.title })}
          </Link>
        ) : null}
      </div>
      {hasDetails ? (
        <div className="age-event-details" id={`age-details-${event.id}`} hidden={!detailsOpen}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="age-event-details-image" src={image} alt="" width={220} height={140} />
          ) : null}
          <div className="age-event-details-body">
            {description ? <p className="age-event-card-description">{description}</p> : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function ServerAgeUnlocksGuide({ guide }: { guide: Guide }) {
  // The build carries the guide; a published edit lies over it a moment later.
  const data = useGuideData<typeof AGE_UNLOCKS_DATA>("server-age-unlocks");
  const milestones = data.milestones;
  return (
    <div className="guide-wide age-unlocks-guide">
      <p className="intro">{guide.intro}</p>
      {guide.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </section>
      ))}

      <div className="tier-lists-head">
        <h2>{guide.timelineHeading}</h2>
      </div>
      <p className="guide-lede">{guide.timelineLede}</p>
      <nav className="age-milestone-index" aria-label={guide.timelineHeading}>
        {milestones.map((milestone) => {
          const label =
            milestoneLabel(milestone, guide.eventTexts) ??
            (milestone.day != null ? fill(guide.dayLabel, { day: milestone.day }) : milestone.id);
          return (
            <a
              className="age-milestone-jump"
              href={`#age-milestone-${milestone.id}`}
              key={milestone.id}
              aria-label={`${label}, ${milestone.events.length}`}
            >
              <span>{label}</span>
              <b>{milestone.events.length}</b>
            </a>
          );
        })}
        <a className="age-milestone-jump age-milestone-jump-muted" href="#age-unconfirmed">
          <span>{guide.unconfirmedHeading}</span>
          <b>{data.unconfirmed.length}</b>
        </a>
      </nav>
      <ol className="age-timeline">
        {milestones.map((milestone, index) => {
          const label =
            milestoneLabel(milestone, guide.eventTexts) ??
            (milestone.day != null ? fill(guide.dayLabel, { day: milestone.day }) : milestone.id);
          const isLast = index === milestones.length - 1;
          return (
            <li className="age-milestone" key={milestone.id} id={`age-milestone-${milestone.id}`}>
              <div className="age-milestone-rail" aria-hidden="true">
                <span className="age-milestone-node" />
                {!isLast ? (
                  <span className="age-milestone-stem">
                    <span className="age-milestone-arrow" />
                  </span>
                ) : null}
              </div>
              <div className="age-milestone-body">
                <h3 className="age-milestone-day">{label}</h3>
                <ul className="age-event-list">
                  {milestone.events.map((event) => (
                    <EventRow key={event.id} event={event} guide={guide} />
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="age-unconfirmed-section" id="age-unconfirmed">
        <div className="age-unconfirmed-heading">
          <span className="age-unconfirmed-icon" aria-hidden="true">?</span>
          <div>
            <h2>{guide.unconfirmedHeading}</h2>
            <p className="guide-lede">{guide.unconfirmedLede}</p>
          </div>
        </div>
        <ul className="age-unconfirmed">
          {data.unconfirmed.map((event) => (
            <EventRow key={event.id} event={event} guide={guide} />
          ))}
        </ul>
      </section>

      <p className="hero-credit">{guide.credit}</p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
