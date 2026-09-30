import { guideLayout } from "../../lib/content/guides";
import type { Dictionary } from "../../lib/i18n";

type Guide = Dictionary["guideEntries"]["heroCollectionDestiny"];

export function isHeroCollectionDestinyGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "heroCollectionDestiny";
}

export function HeroCollectionDestinyGuide({ guide }: { guide: Guide }) {
  return (
    <div className="guide-wide destiny-guide">
      <p className="intro">{guide.intro}</p>

      <section className="destiny-guide-overview" aria-labelledby="destiny-overview-heading">
        <span className="destiny-guide-symbol" aria-hidden="true">↻</span>
        <div>
          <span className="event-rotation-eyebrow">{guide.eventTypeBadge}</span>
          <h2 id="destiny-overview-heading">{guide.eventTypeHeading}</h2>
          <p>{guide.eventTypeBody}</p>
        </div>
      </section>

      <section className="destiny-guide-section" aria-labelledby="destiny-cycle-heading">
        <div className="destiny-guide-section-heading">
          <span className="event-rotation-eyebrow">{guide.cycleMeta}</span>
          <h2 id="destiny-cycle-heading">{guide.cycleHeading}</h2>
          <p>{guide.cycleIntro}</p>
        </div>
        <ol className="destiny-cycle-list">
          {guide.cycleEvents.map((event, index) => (
            <li className="destiny-cycle-card" key={event.name}>
              <span className="destiny-cycle-number">{index + 1}</span>
              <div>
                <h3>{event.name}</h3>
                <span className="destiny-resource-tag">{event.material}</span>
                <p>{event.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        <aside className="destiny-age-note">
          <h3>{guide.ageHeading}</h3>
          <p>{guide.ageIntro}</p>
          <div className="destiny-age-grid">
            {guide.ageBands.map((band) => (
              <div className="destiny-age-band" key={band.label}>
                <strong>{band.label}</strong>
                <span>{band.reward}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="destiny-guide-section" aria-labelledby="destiny-save-heading">
        <div className="destiny-guide-section-heading">
          <span className="event-rotation-eyebrow">{guide.saveEyebrow}</span>
          <h2 id="destiny-save-heading">{guide.saveHeading}</h2>
          <p>{guide.saveIntro}</p>
        </div>
        <div className="destiny-save-grid">
          {guide.saveRules.map((rule, index) => (
            <article className={`destiny-save-card${index === 0 ? " is-use-now" : ""}`} key={rule.range}>
              <span className="destiny-save-range">{rule.range}</span>
              <p>{rule.action}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="destiny-guide-section" aria-labelledby="destiny-milestones-heading">
        <div className="destiny-guide-section-heading">
          <span className="event-rotation-eyebrow">{guide.milestoneEyebrow}</span>
          <h2 id="destiny-milestones-heading">{guide.milestoneHeading}</h2>
          <p>{guide.milestoneIntro}</p>
        </div>
        <ol className="destiny-milestone-list">
          {guide.milestones.map((milestone) => (
            <li className="destiny-milestone-row" key={milestone.count}>
              <strong>{milestone.count}</strong>
              <span>{milestone.reward}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="destiny-guide-section" aria-labelledby="destiny-rewards-heading">
        <div className="destiny-guide-section-heading">
          <span className="event-rotation-eyebrow">{guide.rewardEyebrow}</span>
          <h2 id="destiny-rewards-heading">{guide.rewardHeading}</h2>
          <p>{guide.rewardIntro}</p>
        </div>
        <div className="destiny-reward-grid">
          <article className="destiny-reward-card destiny-reward-hero">
            <span className="destiny-reward-icon" aria-hidden="true">✦</span>
            <h3>{guide.heroRewardsHeading}</h3>
            <p>{guide.heroRewardsIntro}</p>
            <ul>{guide.heroRewards.map((reward) => <li key={reward}>{reward}</li>)}</ul>
          </article>
          <article className="destiny-reward-card destiny-reward-collection">
            <span className="destiny-reward-icon" aria-hidden="true">▧</span>
            <h3>{guide.collectionRewardsHeading}</h3>
            <p>{guide.collectionRewardsIntro}</p>
            <ul>{guide.collectionRewards.map((reward) => <li key={reward}>{reward}</li>)}</ul>
          </article>
        </div>
      </section>

      <section className="destiny-tips-card" aria-labelledby="destiny-tips-heading">
        <span className="destiny-tips-symbol" aria-hidden="true">✧</span>
        <div>
          <h2 id="destiny-tips-heading">{guide.tipsHeading}</h2>
          <ul>{guide.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </div>
      </section>

      <p className="callout event-rotation-source-note">{guide.note}</p>
    </div>
  );
}
