"use client";

import Link from "next/link";
import { guideHref, guideLayout, isGuideEntryId } from "../../lib/content/guides";
import {
  AGE_MILESTONES,
  AGE_UNCONFIRMED,
  eventDescription,
  eventDetail,
  eventImageUrl,
  eventName,
  milestoneLabel,
  type AgeEvent,
} from "../../lib/content/server-age-unlocks";
import { fill, type Dictionary } from "../../lib/i18n";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["serverAgeUnlocks"];

export function isServerAgeUnlocksGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "serverAgeUnlocks";
}

function EventRow({ event, guide }: { event: AgeEvent; guide: Guide }) {
  const { t } = useLocale();
  const name = eventName(event, guide.eventTexts);
  const detail = eventDetail(event, guide.eventTexts);
  const description = eventDescription(event, guide.eventTexts);
  const image = event.image ? eventImageUrl(event.image) : null;
  const related =
    event.relatedGuide && isGuideEntryId(event.relatedGuide, t.guideEntries)
      ? t.guideEntries[event.relatedGuide]
      : null;
  const hasCard = Boolean(description || image);

  return (
    <li className={`age-event${hasCard ? " age-event-has-card" : ""}`}>
      <button type="button" className="age-event-trigger" aria-describedby={hasCard ? `age-card-${event.id}` : undefined}>
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
        </span>
        {detail ? <span className="age-event-detail">{detail}</span> : null}
      </button>
      {related ? (
        <Link className="age-event-link" href={guideHref(event.relatedGuide!)}>
          {fill(guide.relatedLabel, { guide: related.title })}
        </Link>
      ) : null}
      {hasCard ? (
        <div className="age-event-card" id={`age-card-${event.id}`} role="tooltip">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="age-event-card-image" src={image} alt="" width={220} height={140} />
          ) : null}
          <div className="age-event-card-body">
            <strong className="age-event-card-name">{name}</strong>
            {detail ? <span className="age-event-card-detail">{detail}</span> : null}
            {description ? <p className="age-event-card-description">{description}</p> : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function ServerAgeUnlocksGuide({ guide }: { guide: Guide }) {
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
      <ol className="age-timeline">
        {AGE_MILESTONES.map((milestone, index) => {
          const label =
            milestoneLabel(milestone, guide.eventTexts) ??
            (milestone.day != null ? fill(guide.dayLabel, { day: milestone.day }) : milestone.id);
          const isLast = index === AGE_MILESTONES.length - 1;
          return (
            <li className="age-milestone" key={milestone.id}>
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

      <h2>{guide.unconfirmedHeading}</h2>
      <p className="guide-lede">{guide.unconfirmedLede}</p>
      <ul className="age-unconfirmed">
        {AGE_UNCONFIRMED.map((event) => (
          <EventRow key={event.id} event={event} guide={guide} />
        ))}
      </ul>

      <p className="hero-credit">{guide.credit}</p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
