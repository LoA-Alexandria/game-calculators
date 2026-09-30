import Link from "next/link";
import { guideLayout } from "../../lib/content/guides";
import { eventWikiIconUrl } from "../../lib/content/event-guides";
import { eventGuideHref, type EventGuideId } from "../../lib/content/event-guide-routes";
import type { Dictionary } from "../../lib/i18n";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["eventOrderRotation"];
type EventId = EventGuideId;

export function isEventOrderRotationGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "eventOrderRotation";
}

function EventCard({ id, number }: { id: EventId; number?: number }) {
  const { t } = useLocale();
  const event = t.eventGuideEntries[id];
  const image = eventWikiIconUrl(id);
  const href = eventGuideHref(id);
  const content = (
    <>
      {number ? <span className="event-rotation-number">{number}</span> : null}
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" width={42} height={42} loading="lazy" />
      ) : null}
      <span>{event.title}</span>
    </>
  );

  return <Link className="event-rotation-card" href={href}>{content}</Link>;
}

function PlainEventCard({ name, number }: { name: string; number?: number }) {
  return (
    <div className="event-rotation-card">
      {number ? <span className="event-rotation-number">{number}</span> : null}
      <span>{name}</span>
    </div>
  );
}

function Sequence({ ids, repeat }: { ids: EventId[]; repeat?: string }) {
  return (
    <div className="event-rotation-sequence">
      {ids.map((id, index) => (
        <div className="event-rotation-step" key={id}>
          <EventCard id={id} number={index + 1} />
          {index < ids.length - 1 ? <span className="event-rotation-arrow" aria-hidden="true">→</span> : null}
        </div>
      ))}
      {repeat ? <span className="event-rotation-repeat">↺ {repeat}</span> : null}
    </div>
  );
}

function Pair({ left, right }: { left: EventId; right: EventId }) {
  return (
    <div className="event-rotation-pair">
      <EventCard id={left} />
      <span className="event-rotation-plus" aria-label="and">+</span>
      <EventCard id={right} />
    </div>
  );
}

export function EventOrderRotationGuide({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  return (
    <div className="guide-wide event-rotation-guide">
      <p className="intro">{guide.intro}</p>

      <section className="event-rotation-era">
        <div className="event-rotation-era-heading">
          <span className="event-rotation-eyebrow">{guide.rotationHeading}</span>
          <h2>{guide.under30Heading}</h2>
        </div>
        <div className="event-rotation-panel">
          <h3>{guide.mainHeading}</h3>
          <Sequence ids={["holyGrail", "dawnOfRome", "atlantis", "trialsOfOdin"]} repeat={guide.repeatLabel} />
          <p className="event-rotation-caption">{guide.mainMeta}</p>
        </div>

        <div className="event-rotation-panel">
          <h3>{guide.routineHeading}</h3>
          <p className="event-rotation-caption">{guide.routineMeta}</p>
          <div className="event-rotation-pairs">
            <Pair left="mushroomAdventure" right="goddessOfTime" />
            <Pair left="lifeIncubator" right="evolutionInstitute" />
            <Pair left="supplyReform" right="legendOfSerenissima" />
          </div>
        </div>

        <div className="event-rotation-columns">
          <div className="event-rotation-panel">
            <h3>{guide.occasionalHeading}</h3>
            <div className="event-rotation-chip-list">
              <EventCard id="genieWish" />
              <EventCard id="ringToss" />
              <EventCard id="shoppingCartRace" />
            </div>
            <p className="event-rotation-caption">{guide.occasionalNote}</p>
          </div>
          <div className="event-rotation-panel">
            <h3>{guide.chronogateHeading}</h3>
            <div className="event-rotation-chip-list">
              <EventCard id="peakOfEnlightenment" />
              <EventCard id="redCarpet" />
              <PlainEventCard name={guide.favorOfGodsLabel} />
            </div>
            <p className="event-rotation-caption">{guide.chronogateNote}</p>
          </div>
        </div>
      </section>

      <section className="event-rotation-era event-rotation-era-later">
        <div className="event-rotation-era-heading">
          <span className="event-rotation-eyebrow">{guide.rotationHeading}</span>
          <h2>{guide.after40Heading}</h2>
        </div>
        <div className="event-rotation-panel">
          <h3>{guide.mainHeading}</h3>
          <Sequence ids={["roadToWorldcup", "astralWonderland", "duelFestival", "heartOfGold"]} repeat={guide.repeatLabel} />
          <p className="event-rotation-caption">{guide.lateMainMeta}</p>
          <p className="event-rotation-callout">{guide.lateMainNote}</p>
        </div>

        <div className="event-rotation-panel event-rotation-panel-compact">
          <h3>{guide.newRoutineHeading}</h3>
          <div className="event-rotation-pair">
            <EventCard id="greatFlood" />
            <span className="event-rotation-plus" aria-label="and">+</span>
            <PlainEventCard name={guide.raceToCivilizationLabel} />
          </div>
          <p className="event-rotation-caption">{guide.newRoutineNote}</p>
        </div>
      </section>

      <section className="event-rotation-panel event-rotation-destiny">
        <div>
          <span className="event-rotation-eyebrow">{guide.destinyMeta}</span>
          <h2>{guide.destinyHeading}</h2>
          <p className="event-rotation-caption">{guide.destinyNote}</p>
        </div>
        <div className="event-rotation-destiny-track">
          {[guide.heroDestinyLabel, guide.collectionYellowLabel, guide.collectionBlueLabel, guide.heroDestinyLabel].map((name, index) => (
            <div className="event-rotation-step" key={`${name}-${index}`}>
              <PlainEventCard name={name} number={index + 1} />
              {index < 3 ? <span className="event-rotation-arrow" aria-hidden="true">→</span> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="event-rotation-milestones">
        <h2>{guide.milestonesHeading}</h2>
        <div className="event-rotation-milestone-grid">
          <article className="event-rotation-milestone">
            <span className="event-rotation-milestone-day">{guide.day90Label}</span>
            <h3>{t.eventGuideEntries.dawnOfRome.title} → {guide.crownOfNileLabel}</h3>
            <p>{guide.day90Note}</p>
          </article>
          <article className="event-rotation-milestone">
            <span className="event-rotation-milestone-day">{guide.day120Label}</span>
            <h3>{t.eventGuideEntries.grandVoyage.title}</h3>
            <p>{guide.day120Note}</p>
          </article>
        </div>
      </section>

      {guide.note ? <p className="callout event-rotation-source-note">{guide.note}</p> : null}
    </div>
  );
}
