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
  type LevelingBuild,
  type LevelingBuildId,
} from "../../lib/content/hero-leveling";
import { heroNamed, heroPortrait } from "../../lib/content/heroes";
import { fill, type Dictionary } from "../../lib/i18n";
import { useAuth } from "../components/AuthProvider";
import { PenIcon } from "../components/Icons";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["heroLeveling"];

type RankedHero = { hero: string; rank: number; band: FocusBandId; note: string };

export function isHeroLevelingGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "heroLeveling";
}

function rankedFocus(build: LevelingBuild, notes: Guide["heroNotes"]): RankedHero[] {
  const rows: RankedHero[] = [];
  for (const bandId of FOCUS_BANDS) {
    const band = build.bands.find((entry) => entry.id === bandId);
    if (!band) continue;
    for (const hero of band.heroes) {
      rows.push({
        hero,
        rank: rows.length + 1,
        band: bandId,
        note: heroNote(hero, notes),
      });
    }
  }
  return rows;
}

function HeroChip({
  hero,
  size,
}: {
  hero: string;
  size: "hero-portrait-large" | "hero-portrait-medium" | "hero-portrait-small";
}) {
  const found = heroNamed(hero);
  const body = (
    <>
      <HeroPortrait name={hero} rarity={found?.rarity} src={heroPortrait(hero)} className={size} />
      <span className="leveling-chip-meta">
        <span className="leveling-chip-name">{hero}</span>
        {found ? (
          <span className="leveling-chip-rarity" data-rarity={found.rarity}>
            {found.rarity}
          </span>
        ) : null}
      </span>
    </>
  );
  if (!found) return <span className="leveling-chip">{body}</span>;
  return (
    <Link className="leveling-chip" href={`${guideHref("heroes")}#${encodeURIComponent(found.id)}`}>
      {body}
    </Link>
  );
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

function ShardHeroes({ rule }: { rule: FragmentRule }) {
  if ("hero" in rule) return <HeroChip hero={rule.hero} size="hero-portrait-small" />;
  if ("heroes" in rule) {
    return (
      <div className="leveling-shard-heroes">
        <HeroChip hero={rule.heroes[0]} size="hero-portrait-small" />
        <HeroChip hero={rule.heroes[1]} size="hero-portrait-small" />
      </div>
    );
  }
  return null;
}

function PriorityBoard({
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
  const ranked = rankedFocus(build, guide.heroNotes);
  const podium = ranked.slice(0, 3);
  const podiumBand = podium.at(-1)?.band;
  const rest = ranked.slice(3).map((entry, index, list) => ({
    ...entry,
    showBand: index === 0 ? entry.band !== podiumBand : entry.band !== list[index - 1]?.band,
  }));

  if (empty) {
    return (
      <section className="leveling-board" aria-label={buildNames[buildId] ?? buildId}>
        <p className="callout">{guide.emptyBuild}</p>
      </section>
    );
  }

  return (
    <section className="leveling-board" aria-label={buildNames[buildId] ?? buildId}>
      <div className="leveling-board-main">
        <header className="leveling-board-head">
          <h3>{guide.focusHeading}</h3>
          <p>{guide.focusLede}</p>
        </header>

        {podium.length > 0 ? (
          <ol className="leveling-podium">
            {podium.map((entry) => (
              <li key={entry.hero} className="leveling-podium-item" data-rank={entry.rank}>
                <span className="leveling-podium-rank">{fill(guide.rankLabel, { rank: entry.rank })}</span>
                <HeroChip hero={entry.hero} size="hero-portrait-large" />
                {entry.note ? <p className="leveling-podium-note">{entry.note}</p> : null}
              </li>
            ))}
          </ol>
        ) : null}

        {rest.length > 0 ? (
          <ol className="leveling-ladder">
            {rest.map((entry) => (
              <li key={entry.hero} className="leveling-ladder-item">
                {entry.showBand ? <p className="leveling-ladder-band">{guide.bands[entry.band]}</p> : null}
                <div className="leveling-ladder-row">
                  <span className="leveling-ladder-rank">{fill(guide.rankLabel, { rank: entry.rank })}</span>
                  <HeroChip hero={entry.hero} size="hero-portrait-medium" />
                  {entry.note ? <p className="leveling-ladder-note">{entry.note}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {build.fragments.length > 0 ? (
        <aside className="leveling-shards">
          <header className="leveling-board-head">
            <h3>{guide.fragmentsHeading}</h3>
            <p>{guide.fragmentsLede}</p>
          </header>
          <ol className="leveling-shard-list">
            {build.fragments.map((rule, index) => (
              <li key={`${rule.kind}-${index}`}>
                <span className="leveling-shard-index">{fill(guide.rankLabel, { rank: index + 1 })}</span>
                <div className="leveling-shard-body">
                  <p>{fragmentText(rule, guide)}</p>
                  <ShardHeroes rule={rule} />
                </div>
              </li>
            ))}
          </ol>
        </aside>
      ) : null}
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

      <div className="leveling-toolbar">
        <div>
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
        </div>
        <div className="hero-filters leveling-filters" aria-label={guide.buildsHeading}>
          {buildIds.map((id) => (
            <button
              key={id}
              type="button"
              className="hero-filter"
              aria-pressed={id === selected}
              onClick={() => setSelected(id)}
            >
              {buildNames[id]}
            </button>
          ))}
        </div>
      </div>

      <PriorityBoard key={selected} buildId={selected} guide={guide} buildNames={buildNames} />

      <section className="leveling-caps-block">
        <h2>{guide.levelsHeading}</h2>
        <p className="guide-lede">{guide.levelsLede}</p>
        <ol className="leveling-caps-rail">
          {LEVELING_DATA.levelTargets.map((target, index) => (
            <li key={target.id}>
              <span className="leveling-caps-index">{index + 1}</span>
              <div>
                <strong>{guide.levelTargets[target.id]}</strong>
                <span className="leveling-caps-value">{fill(guide.levelTargetValue, { target: target.target })}</span>
                {target.noAscend ? <span className="leveling-caps-note">{guide.noAscend}</span> : null}
              </div>
            </li>
          ))}
        </ol>
        <p className="leveling-caps-after">{guide.levelsAfter}</p>
      </section>

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
