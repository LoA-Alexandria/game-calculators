"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { guideHref, guideLayout } from "../../lib/content/guides";
import {
  MUSEION_STATS,
  localizedBuildingName,
  searchMuseionBuildings,
  type MuseionBuilding,
  type MuseionStat,
} from "../../lib/content/museion";
import { heroNamed, heroPortrait } from "../../lib/content/heroes";
import { fill, LOCALES, getDictionary, type Dictionary } from "../../lib/i18n";
import { useAuth } from "../components/AuthProvider";
import { PenIcon } from "../components/Icons";
import { HeroPortrait } from "../components/HeroPortrait";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["museion"];

export function isMuseionGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "museion";
}

function HeroName({ hero }: { hero: string }) {
  const found = heroNamed(hero);
  const name = (
    <span className="guide-name">
      <HeroPortrait name={hero} rarity={found?.rarity} src={heroPortrait(hero)} className="hero-portrait-small" />
      {hero}
      {found ? <span className="museion-rarity">{found.rarity}</span> : null}
    </span>
  );
  if (!found) return name;
  return <Link href={`${guideHref("heroes")}#${encodeURIComponent(found.id)}`}>{name}</Link>;
}

function StatsLine({ stats, guide }: { stats: MuseionStat[]; guide: Guide }) {
  if (stats.length === 0) return <p className="museion-stats museion-stats-unknown">{guide.statsUnknown}</p>;
  const labels = [guide.primaryStatLabel, guide.secondaryStatLabel];
  return (
    <ul className="museion-stats">
      {stats.map((stat, index) => (
        <li key={stat}>
          <span className="museion-stats-role">{labels[index] ?? labels[labels.length - 1]}</span>
          <span className="museion-stat">{guide.stats[stat]}</span>
        </li>
      ))}
    </ul>
  );
}

function BuildingCard({ building, guide }: { building: MuseionBuilding; guide: Guide }) {
  return (
    <article className="museion-building" id={building.id}>
      <header className="museion-building-head">
        <h3>{localizedBuildingName(building, guide.buildingTexts)}</h3>
        <StatsLine stats={building.stats} guide={guide} />
      </header>
      <ul className="museion-heroes">
        {building.heroes.map((hero) => (
          <li key={hero}>
            <HeroName hero={hero} />
          </li>
        ))}
      </ul>
    </article>
  );
}

export function MuseionGuide({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  const { allows } = useAuth();
  const [query, setQuery] = useState("");
  const buildings = useMemo(
    () =>
      searchMuseionBuildings(
        query,
        LOCALES.map((locale) => getDictionary(locale.code).guideEntries.museion.buildingTexts),
      ),
    [query],
  );

  return (
    <div className="guide-wide museion-guide">
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
        <h2>{guide.buildingsHeading}</h2>
        {allows("guides.draft") ? (
          <Link className="small-button" href="/guides/museion/edit/">
            <PenIcon className="icon icon-sm" />
            {t.museionEditor.openEditor}
          </Link>
        ) : null}
      </div>
      <p className="guide-lede">{guide.buildingsLede}</p>
      <div className="hero-filters museion-filters">
        <label className="visually-hidden" htmlFor="museion-search">
          {guide.searchLabel}
        </label>
        <input
          id="museion-search"
          type="search"
          value={query}
          placeholder={guide.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="tier-small">{fill(guide.countLabel, { count: buildings.length })}</span>
      </div>
      {buildings.length === 0 ? (
        <p className="callout">{guide.empty}</p>
      ) : (
        <div className="museion-grid">
          {buildings.map((building) => (
            <BuildingCard key={building.id} building={building} guide={guide} />
          ))}
        </div>
      )}

      <h2>{guide.statsHeading}</h2>
      <p className="guide-lede">{guide.statsLede}</p>
      <ul className="museion-stat-key">
        {MUSEION_STATS.map((stat) => (
          <li key={stat}>
            <strong>{guide.stats[stat]}</strong>
          </li>
        ))}
      </ul>

      <p className="hero-credit">{guide.credit}</p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
