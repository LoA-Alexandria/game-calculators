"use client";

import Link from "next/link";
import { GODDESS_LEVELING_DATA, localizedPhase, phaseTone, type LevelingRow } from "../../lib/content/goddess-leveling";
import { GODDESSES, goddessById, goddessImageUrl, type Goddess } from "../../lib/content/goddesses";
import { guideHref, guideLayout } from "../../lib/content/guides";
import { fill, type Dictionary } from "../../lib/i18n";
import { HeroPortrait } from "../components/HeroPortrait";

type Guide = Dictionary["guideEntries"]["goddessLeveling"];

export function isGoddessLevelingGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "goddessLeveling";
}

const portraitOf = (goddess: Goddess) => (goddess.images[0] ? goddessImageUrl(goddess.images[0]) : null);
const rosterLink = (goddess: Goddess) => `${guideHref("goddesses")}#${encodeURIComponent(goddess.id)}`;

/** Goddesses no phase names, for the "everyone else" card. */
function unnamedGoddesses(): Goddess[] {
  const named = new Set(GODDESS_LEVELING_DATA.phases.flatMap((phase) => phase.rows.map((row) => row.goddess)));
  return GODDESSES.filter((goddess) => !named.has(goddess.id));
}

function LevelCard({ row, guide }: { row: LevelingRow; guide: Guide }) {
  const goddess = row.goddess ? goddessById(row.goddess) : undefined;
  const target = (
    <span className="gl-level">
      <span className="gl-level-label">{guide.levelLabel}</span>
      <strong className="gl-level-value">{row.target}</strong>
    </span>
  );
  const withoutSsr = row.withoutSsr ? (
    <span className="gl-without">
      {guide.withoutSsrLabel}
      <strong>{row.withoutSsr}</strong>
    </span>
  ) : null;

  if (!goddess) {
    const others = unnamedGoddesses();
    return (
      <li className="gl-card is-everyone">
        <span className="gl-stack" aria-hidden="true">
          {others.slice(0, 5).map((entry) => (
            <HeroPortrait key={entry.id} name={entry.name} rarity={entry.rarity} src={portraitOf(entry)} className="hero-portrait-small" />
          ))}
        </span>
        <span className="gl-card-text">
          <strong className="gl-name">{guide.everyoneElse}</strong>
          <span className="gl-note">{guide.everyoneElseNote}</span>
        </span>
        {target}
        {withoutSsr}
      </li>
    );
  }

  return (
    <li className="gl-card" data-rarity={goddess.rarity}>
      <Link className="gl-card-link" href={rosterLink(goddess)}>
        <HeroPortrait name={goddess.name} rarity={goddess.rarity} src={portraitOf(goddess)} className="hero-portrait-medium" />
        <span className="gl-card-text">
          <strong className="gl-name">{goddess.name}</strong>
          <span className="rarity" data-rarity={goddess.rarity}>{goddess.rarity}</span>
        </span>
      </Link>
      {target}
      {withoutSsr}
    </li>
  );
}

/** Every named goddess across the phases, so her whole path reads on one line. */
function Overview({ guide }: { guide: Guide }) {
  const phases = GODDESS_LEVELING_DATA.phases.filter((phase) => phase.rows.some((row) => row.goddess));
  const order: string[] = [];
  for (const phase of phases) {
    for (const row of phase.rows) if (row.goddess && !order.includes(row.goddess)) order.push(row.goddess);
  }
  if (order.length === 0) return null;
  return (
    <div className="table-scroll panel gl-overview">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{guide.colGoddess}</th>
            {phases.map((phase) => (
              <th scope="col" key={phase.id}>
                {fill(guide.phaseLabel, { number: GODDESS_LEVELING_DATA.phases.indexOf(phase) + 1 })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.map((id) => {
            const goddess = goddessById(id);
            return (
              <tr key={id}>
                <th scope="row">
                  <span className="guide-name">
                    <HeroPortrait name={goddess?.name ?? id} rarity={goddess?.rarity} src={goddess ? portraitOf(goddess) : null} className="hero-portrait-small" />
                    {goddess?.name ?? id}
                  </span>
                </th>
                {phases.map((phase) => {
                  const row = phase.rows.find((entry) => entry.goddess === id);
                  return (
                    <td key={phase.id} data-tone={phaseTone(GODDESS_LEVELING_DATA.phases.indexOf(phase))}>
                      {row ? (
                        <>
                          <strong className="gl-overview-level">{row.target}</strong>
                          {row.withoutSsr ? <small>{guide.withoutSsrLabel}: {row.withoutSsr}</small> : null}
                        </>
                      ) : (
                        <span className="gl-overview-empty" aria-hidden="true">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function GoddessLevelingGuide({ guide }: { guide: Guide }) {
  return (
    <div className="guide-wide goddess-leveling">
      <p className="intro">{guide.intro}</p>

      <h2>{guide.phasesHeading}</h2>
      <p className="guide-lede">{guide.phasesLede}</p>

      <ol className="gl-phases">
        {GODDESS_LEVELING_DATA.phases.map((phase, index) => {
          const text = localizedPhase(phase, guide.phaseTexts);
          return (
            <li className="gl-phase" key={phase.id} data-tone={phaseTone(index)}>
              <header className="gl-phase-head">
                <span className="gl-phase-number" aria-hidden="true">{index + 1}</span>
                <div>
                  <p className="gl-phase-kicker">{fill(guide.phaseLabel, { number: index + 1 })}</p>
                  <h3>{text.subtitle}</h3>
                  {text.lede ? <p className="gl-phase-lede">{text.lede}</p> : null}
                </div>
              </header>
              <ul className="gl-cards">
                {phase.rows.map((row, rowIndex) => (
                  <LevelCard key={`${row.goddess ?? "everyone"}-${rowIndex}`} row={row} guide={guide} />
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

      <h2>{guide.overviewHeading}</h2>
      <p className="guide-lede">{guide.overviewLede}</p>
      <Overview guide={guide} />

      <p className="guide-more">
        <Link href={guideHref("goddesses")}>{guide.rosterLink}</Link>
      </p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
