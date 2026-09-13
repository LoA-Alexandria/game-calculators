"use client";

import { useMemo, useState } from "react";
import { guideLayout } from "../../lib/content/guides";
import { fill, type Dictionary } from "../../lib/i18n";
import {
  HERO_FRAGMENT_KEYS,
  HERO_RARITIES,
  HERO_STAR_COSTS,
  searchHeroes,
  type Hero,
  type HeroRarity,
} from "../../lib/content/heroes";

type Guide = Dictionary["guideEntries"]["heroes"];

export function isHeroesGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Dictionary["guideEntries"]["heroes"] {
  return guideLayout(guide) === "heroes";
}

function initial(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return (last.charAt(0) || "?").toUpperCase();
}

function dash(value: string): string {
  return value.trim() ? value : "—";
}

function HeroCard({
  hero,
  colObtain,
  artifactLabel,
}: {
  hero: Hero;
  colObtain: string;
  artifactLabel: string;
}) {
  const hasBody = hero.skills.length > 0 || Boolean(hero.artifact);
  return (
    <article className="hero-card" data-rarity={hero.rarity}>
      <header className="hero-card-head">
        <span className="guide-avatar" aria-hidden="true">{initial(hero.name)}</span>
        <div>
          <h3>{hero.name}</h3>
          <p>
            <span className="rarity" data-rarity={hero.rarity}>{hero.rarity}</span>
            <span className="hero-obtain">{colObtain}: {dash(hero.obtain)}</span>
          </p>
        </div>
      </header>
      {hasBody ? (
        <dl className="hero-skills">
          {hero.skills.map((skill) => (
            <div key={skill.name}>
              <dt>{skill.name}</dt>
              <dd>{skill.text}</dd>
            </div>
          ))}
          {hero.artifact ? (
            <div>
              <dt>{artifactLabel}: {hero.artifact.name}</dt>
              <dd>{hero.artifact.text}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </article>
  );
}

export function HeroRoster({ guide }: { guide: Guide }) {
  const [rarity, setRarity] = useState<HeroRarity | "all">("UR+");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => searchHeroes(query, rarity), [query, rarity]);
  const fragmentLabels = guide.fragments;

  return (
    <div className="guide-wide">
      <p className="intro">{guide.intro}</p>

      <h2>{guide.basicsHeading}</h2>
      <div className="rule-grid">
        {guide.basics.map((step, index) => (
          <article className="rule-card" key={step.title}>
            <span className="phase-index" aria-hidden="true">{index + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </article>
        ))}
      </div>

      <h2>{guide.starHeading}</h2>
      <div className="table-scroll panel guide-table-panel">
        <table className="data-table data-table-wide">
          <thead>
            <tr>
              <th>{guide.colStar}</th>
              {HERO_FRAGMENT_KEYS.map((key) => (
                <th key={key}>{fragmentLabels[key]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HERO_STAR_COSTS.map((row) => (
              <tr key={row.star}>
                <td data-label={guide.colStar}><strong className="mono">{row.star}★</strong></td>
                {row.costs.map((cost, index) => (
                  <td key={HERO_FRAGMENT_KEYS[index]} data-label={fragmentLabels[HERO_FRAGMENT_KEYS[index]]}>
                    <span className="mono">{cost}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{guide.rosterHeading}</h2>
      <div className="hero-toolbar">
        <div className="hero-filters" role="group" aria-label={guide.filterLabel}>
          <button
            type="button"
            className="hero-filter"
            aria-pressed={rarity === "all"}
            onClick={() => setRarity("all")}
          >
            {guide.filterAll}
          </button>
          {HERO_RARITIES.map((tier) => (
            <button
              key={tier}
              type="button"
              className="hero-filter"
              data-rarity={tier}
              aria-pressed={rarity === tier}
              onClick={() => setRarity(tier)}
            >
              {tier}
            </button>
          ))}
        </div>
        <label className="hero-search">
          <span className="visually-hidden">{guide.searchLabel}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={guide.searchPlaceholder}
          />
        </label>
      </div>
      <p className="hero-count">{fill(guide.countLabel, { count: rows.length })}</p>
      {rows.length === 0 ? (
        <p className="empty-state">{guide.empty}</p>
      ) : (
        <div className="hero-grid">
          {rows.map((hero) => (
            <HeroCard
              key={hero.id}
              hero={hero}
              colObtain={guide.colObtain}
              artifactLabel={guide.artifactLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
