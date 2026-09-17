"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { guideHref, guideLayout } from "../../lib/content/guides";
import {
  FOCUS_BANDS,
  LEVELING_DATA,
  buildById,
  heroNote,
  levelingBuildIds,
  type FocusBandId,
  type FragmentRule,
  type LevelingBuild,
  type LevelingBuildId,
} from "../../lib/content/hero-leveling";
import { heroNamed, heroPortrait } from "../../lib/content/heroes";
import { fill, type Dictionary } from "../../lib/i18n";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["heroLeveling"];

type RankedHero = { hero: string; rank: number; note: string };
type FocusStage = { band: FocusBandId; heroes: RankedHero[] };

export function isHeroLevelingGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "heroLeveling";
}

/** Focus bands in order, each with its heroes numbered straight through the list. */
function focusStages(build: LevelingBuild, notes: Guide["heroNotes"]): FocusStage[] {
  const stages: FocusStage[] = [];
  let rank = 0;
  for (const bandId of FOCUS_BANDS) {
    const band = build.bands.find((entry) => entry.id === bandId);
    if (!band?.heroes.length) continue;
    stages.push({
      band: bandId,
      heroes: band.heroes.map((hero) => ({ hero, rank: ++rank, note: heroNote(hero, notes) })),
    });
  }
  return stages;
}

function fragmentHeroes(rule: FragmentRule): string[] {
  if ("hero" in rule) return [rule.hero];
  if ("heroes" in rule) return [...rule.heroes];
  return [];
}

/** Colour of a stage or step: the four tones repeat when there are more. */
const tone = (index: number) => String((index % 4) + 1);

function HeroCard({ hero, guide, rank, note }: { hero: string; guide: Guide; rank?: number; note?: string }) {
  const found = heroNamed(hero);
  const face = (
    <>
      <HeroPortrait name={hero} rarity={found?.rarity} src={heroPortrait(hero)} className="hero-portrait-medium" />
      <span className="gl-card-text">
        <strong className="gl-name">{hero}</strong>
        {found ? <span className="rarity" data-rarity={found.rarity}>{found.rarity}</span> : null}
      </span>
    </>
  );
  return (
    <li className="gl-card" data-rarity={found?.rarity}>
      {found ? (
        <Link className="gl-card-link" href={`${guideHref("heroes")}#${encodeURIComponent(found.id)}`}>{face}</Link>
      ) : (
        <span className="gl-card-link">{face}</span>
      )}
      {rank ? (
        <span className="gl-level">
          <span className="gl-level-label">{guide.rankWord}</span>
          <strong className="gl-level-value">{fill(guide.rankLabel, { rank })}</strong>
        </span>
      ) : null}
      {note ? <span className="gl-card-note">{note}</span> : null}
    </li>
  );
}

function BuildBoard({ build, guide }: { build: LevelingBuild; guide: Guide }) {
  const stages = focusStages(build, guide.heroNotes);
  if (stages.length === 0 && build.fragments.length === 0) {
    return <p className="callout">{guide.emptyBuild}</p>;
  }

  // Which focus stage and fragment steps each hero appears in, for the overview.
  const overview = new Map<string, { rank?: number; stage?: number; fragments: number[] }>();
  stages.forEach((stage, index) => {
    for (const entry of stage.heroes) overview.set(entry.hero, { rank: entry.rank, stage: index, fragments: [] });
  });
  build.fragments.forEach((rule, index) => {
    for (const hero of fragmentHeroes(rule)) {
      const row = overview.get(hero) ?? { fragments: [] };
      if (!row.fragments.includes(index)) row.fragments.push(index);
      overview.set(hero, row);
    }
  });

  return (
    <>
      {stages.length > 0 ? (
        <>
          <h2>{guide.focusHeading}</h2>
          <p className="guide-lede">{guide.focusLede}</p>
          <ol className="gl-phases">
            {stages.map((stage, index) => {
              const first = stage.heroes[0].rank;
              const last = stage.heroes[stage.heroes.length - 1].rank;
              return (
                <li className="gl-phase" key={stage.band} data-tone={tone(index)}>
                  <header className="gl-phase-head">
                    <span className="gl-phase-number" aria-hidden="true">{index + 1}</span>
                    <div>
                      <p className="gl-phase-kicker">
                        {first === last ? fill(guide.rankLabel, { rank: first }) : fill(guide.rankRange, { from: first, to: last })}
                      </p>
                      <h3>{guide.bands[stage.band]}</h3>
                    </div>
                  </header>
                  <ul className="gl-cards">
                    {stage.heroes.map((entry) => (
                      <HeroCard key={entry.hero} hero={entry.hero} guide={guide} rank={entry.rank} note={entry.note} />
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </>
      ) : null}

      {build.fragments.length > 0 ? (
        <>
          <h2>{guide.fragmentsHeading}</h2>
          <p className="guide-lede">{guide.fragmentsLede}</p>
          <ol className="gl-phases">
            {build.fragments.map((rule, index) => {
              const heroes = fragmentHeroes(rule);
              return (
                <li className="gl-phase" key={`${rule.kind}-${index}`} data-tone={tone(index)}>
                  <header className="gl-phase-head">
                    <span className="gl-phase-number" aria-hidden="true">{index + 1}</span>
                    <div>
                      <p className="gl-phase-kicker">{fill(guide.stepLabel, { step: index + 1 })}</p>
                      <h3>{guide.fragmentKinds[rule.kind]}</h3>
                    </div>
                  </header>
                  {heroes.length > 0 ? (
                    <ul className="gl-cards">
                      {heroes.map((hero) => <HeroCard key={hero} hero={hero} guide={guide} />)}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : null}

      {overview.size > 0 ? (
        <>
          <h2>{guide.overviewHeading}</h2>
          <p className="guide-lede">{guide.overviewLede}</p>
          <div className="table-scroll panel gl-overview">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{guide.colHero}</th>
                  <th scope="col">{guide.colRank}</th>
                  <th scope="col">{guide.colFocus}</th>
                  <th scope="col">{guide.colFragments}</th>
                </tr>
              </thead>
              <tbody>
                {[...overview.entries()].map(([hero, row]) => {
                  const found = heroNamed(hero);
                  return (
                    <tr key={hero}>
                      <th scope="row">
                        <span className="guide-name">
                          <HeroPortrait name={hero} rarity={found?.rarity} src={heroPortrait(hero)} className="hero-portrait-small" />
                          {hero}
                        </span>
                      </th>
                      <td data-tone={row.stage === undefined ? undefined : tone(row.stage)}>
                        {row.rank ? (
                          <strong className="gl-overview-level">{fill(guide.rankLabel, { rank: row.rank })}</strong>
                        ) : (
                          <span className="gl-overview-empty" aria-hidden="true">·</span>
                        )}
                      </td>
                      <td className="gl-overview-text">
                        {row.stage === undefined ? (
                          <span className="gl-overview-empty" aria-hidden="true">·</span>
                        ) : (
                          guide.bands[stages[row.stage].band]
                        )}
                      </td>
                      <td className="gl-overview-text">
                        {row.fragments.length ? (
                          <span className="gl-steps">
                            {row.fragments.map((step) => (
                              <span className="gl-step" key={step}>
                                <span className="gl-step-number" data-tone={tone(step)} aria-hidden="true">{step + 1}</span>
                                {guide.fragmentKinds[build.fragments[step].kind]}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="gl-overview-empty" aria-hidden="true">·</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}

export function HeroLevelingGuide({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  const buildIds = levelingBuildIds();
  const [selected, setSelected] = useState<LevelingBuildId>(LEVELING_DATA.defaultBuild);
  const buildNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const id of buildIds) {
      names[id] = t.guideEntries.heroLayouts.buildTexts[id]?.name ?? guide.buildNames[id] ?? id;
    }
    return names;
  }, [buildIds, guide.buildNames, t.guideEntries.heroLayouts.buildTexts]);
  const build = buildById(selected);

  return (
    <div className="guide-wide leveling-guide">
      <p className="intro">{guide.intro}</p>

      <h2>{guide.buildsHeading}</h2>
      <p className="guide-lede">{guide.buildsLede}</p>
      <div className="hero-filters leveling-filters" role="group" aria-label={guide.buildsHeading}>
        {buildIds.map((id) => (
          <button key={id} type="button" className="hero-filter" aria-pressed={id === selected} onClick={() => setSelected(id)}>
            {buildNames[id]}
          </button>
        ))}
      </div>

      {build ? <BuildBoard key={selected} build={build} guide={guide} /> : null}

      <h2>{guide.levelsHeading}</h2>
      <p className="guide-lede">{guide.levelsLede}</p>
      <ol className="gl-cards leveling-caps">
        {LEVELING_DATA.levelTargets.map((target, index) => (
          <li className="gl-card" key={target.id} data-tone={tone(index)}>
            <span className="gl-card-link">
              <span className="gl-cap-number" aria-hidden="true">{index + 1}</span>
              <span className="gl-card-text">
                <strong className="gl-name">{guide.levelTargets[target.id]}</strong>
              </span>
            </span>
            <span className="gl-level">
              <span className="gl-level-label">{guide.levelWord}</span>
              <strong className="gl-level-value">{target.target}</strong>
            </span>
            {target.noAscend ? <span className="gl-without">{guide.noAscend}</span> : null}
          </li>
        ))}
      </ol>
      <p className="leveling-caps-after">{guide.levelsAfter}</p>

      {guide.sections.map((section) => (
        <details className="leveling-details" key={section.heading}>
          <summary>{section.heading}</summary>
          {section.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </details>
      ))}

      <p className="hero-credit">{guide.credit}</p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
