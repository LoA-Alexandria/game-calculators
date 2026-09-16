"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { guideHref, guideLayout } from "../../lib/content/guides";
import {
  FOCUS_BANDS,
  LEVELING_DATA,
  buildById,
  focusHeroes,
  heroNote,
  levelingBuildIds,
  type FocusBandId,
  type FragmentRule,
  type LevelingBuildId,
} from "../../lib/content/hero-leveling";
import { heroNamed, heroPortrait } from "../../lib/content/heroes";
import { fill, type Dictionary } from "../../lib/i18n";
import { useAuth } from "../components/AuthProvider";
import { PenIcon } from "../components/Icons";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["heroLeveling"];

export function isHeroLevelingGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "heroLeveling";
}

function HeroName({ hero }: { hero: string }) {
  const found = heroNamed(hero);
  const name = (
    <span className="guide-name">
      <HeroPortrait name={hero} rarity={found?.rarity} src={heroPortrait(hero)} className="hero-portrait-small" />
      {hero}
    </span>
  );
  if (!found) return name;
  return <Link href={`${guideHref("heroes")}#${encodeURIComponent(found.id)}`}>{name}</Link>;
}

function fragmentText(rule: FragmentRule, guide: Guide): string {
  switch (rule.kind) {
    case "unlocks":
      return guide.fragmentKinds.unlocks;
    case "allUr":
      return guide.fragmentKinds.allUr;
    case "allSsrWhenUrPlus":
      return guide.fragmentKinds.allSsrWhenUrPlus;
    case "splitEvenWhenUr":
      return guide.fragmentKinds.splitEvenWhenUr;
    default:
      return "";
  }
}

function BuildPanel({
  buildId,
  guide,
  buildNames,
}: {
  buildId: LevelingBuildId;
  guide: Guide;
  buildNames: Record<string, string>;
}) {
  const build = buildById(buildId);
  if (!build) return null;
  const empty = focusHeroes(build).length === 0 && build.fragments.length === 0;

  return (
    <section className="leveling-build" aria-label={buildNames[buildId] ?? buildId}>
      {empty ? (
        <p className="callout">{guide.emptyBuild}</p>
      ) : (
        <>
          <h3>{guide.focusHeading}</h3>
          <p className="guide-lede">{guide.focusLede}</p>
          {FOCUS_BANDS.map((bandId) => {
            const band = build.bands.find((entry) => entry.id === bandId);
            if (!band || band.heroes.length === 0) return null;
            const offset = FOCUS_BANDS.slice(0, FOCUS_BANDS.indexOf(bandId)).reduce((sum, id) => {
              const earlier = build.bands.find((entry) => entry.id === id);
              return sum + (earlier?.heroes.length ?? 0);
            }, 0);
            return (
              <div className="leveling-band" key={bandId}>
                <h4>{guide.bands[bandId as FocusBandId]}</h4>
                <ol className="leveling-list">
                  {band.heroes.map((hero, index) => {
                    const note = heroNote(hero, guide.heroNotes);
                    return (
                      <li key={hero}>
                        <span className="leveling-rank">{fill(guide.rankLabel, { rank: offset + index + 1 })}</span>
                        <HeroName hero={hero} />
                        {note ? <span className="leveling-note">{note}</span> : null}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
          {build.fragments.length > 0 ? (
            <>
              <h3>{guide.fragmentsHeading}</h3>
              <p className="guide-lede">{guide.fragmentsLede}</p>
              <ol className="leveling-list leveling-fragments">
                {build.fragments.map((rule, index) => (
                  <li key={`${rule.kind}-${index}`}>
                    <span className="leveling-rank">{fill(guide.rankLabel, { rank: index + 1 })}</span>
                    <div className="leveling-fragment-body">
                      <span className="leveling-fragment">{fragmentText(rule, guide)}</span>
                      {"hero" in rule ? <HeroName hero={rule.hero} /> : null}
                      {"heroes" in rule ? (
                        <span className="leveling-fragment-heroes">
                          <HeroName hero={rule.heroes[0]} />
                          <span aria-hidden="true"> · </span>
                          <HeroName hero={rule.heroes[1]} />
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

export function HeroLevelingGuide({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  const { allows } = useAuth();
  const buildIds = levelingBuildIds();
  const [selected, setSelected] = useState<LevelingBuildId>(LEVELING_DATA.defaultBuild);
  const buildNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const id of buildIds) {
      names[id] = t.guideEntries.heroLayouts.buildTexts[id]?.name ?? guide.buildNames[id] ?? id;
    }
    return names;
  }, [buildIds, guide.buildNames, t.guideEntries.heroLayouts.buildTexts]);

  return (
    <div className="guide-wide leveling-guide">
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
        <h2>{guide.buildsHeading}</h2>
        {allows("guides.draft") ? (
          <Link className="small-button" href="/guides/hero-leveling/edit/">
            <PenIcon className="icon icon-sm" />
            {t.levelingEditor.openEditor}
          </Link>
        ) : null}
      </div>
      <p className="guide-lede">{guide.buildsLede}</p>
      <div className="hero-filters leveling-filters" role="tablist" aria-label={guide.buildsHeading}>
        {buildIds.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={id === selected ? "is-active" : undefined}
            aria-selected={id === selected}
            onClick={() => setSelected(id)}
          >
            {buildNames[id]}
          </button>
        ))}
      </div>
      <BuildPanel buildId={selected} guide={guide} buildNames={buildNames} />

      <h2>{guide.levelsHeading}</h2>
      <p className="guide-lede">{guide.levelsLede}</p>
      <ul className="leveling-levels">
        {LEVELING_DATA.levelTargets.map((target) => (
          <li key={target.id}>
            <strong>{guide.levelTargets[target.id]}</strong>
            <span>{fill(guide.levelTargetValue, { target: target.target })}</span>
            {target.noAscend ? <span className="leveling-note">{guide.noAscend}</span> : null}
          </li>
        ))}
      </ul>
      <p>{guide.levelsAfter}</p>

      <p className="hero-credit">{guide.credit}</p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
