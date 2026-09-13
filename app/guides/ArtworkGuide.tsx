"use client";

import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { guideLayout } from "../../lib/content/guides";
import {
  PAINTING_RARITIES,
  paintingsForHero,
  setsByRarity,
  type Painting,
  type PaintingHit,
  type PaintingRarity,
  type PaintingSet,
  type PaintingStat,
} from "../../lib/content/artwork";
import { CheckIcon } from "../components/Icons";
import { fill, type Dictionary } from "../../lib/i18n";

type Guide = Dictionary["guideEntries"]["artwork"];

export function isArtworkGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "artwork";
}

function initial(name: string): string {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? name;
  return (last.charAt(0) || "?").toUpperCase();
}

function dash(value: string): string {
  return value.trim() ? value : "—";
}

function StatChips({
  stats,
  labels,
}: {
  stats: readonly PaintingStat[];
  labels: Guide["stats"];
}) {
  if (stats.length === 0) return <span>—</span>;
  return (
    <ul className="pick-list">
      {stats.map((stat, index) => (
        <li className="pick pick-stat" key={`${stat}-${index}`}>
          <span className="pick-name">{labels[stat]}</span>
        </li>
      ))}
    </ul>
  );
}

function HeroPicks({ heroes }: { heroes: readonly string[] }) {
  return (
    <ul className="pick-list">
      {heroes.map((name) => (
        <li className="pick" key={name}>
          <span className="pick-avatar" aria-hidden="true">{initial(name)}</span>
          <span className="pick-name">{name}</span>
        </li>
      ))}
    </ul>
  );
}

function PaintingBlock({
  painting,
  guide,
}: {
  painting: Painting;
  guide: Guide;
}) {
  return (
    <article className="painting-block">
      <h4>{painting.name}</h4>
      <HeroPicks heroes={painting.heroes} />
      <dl className="painting-facts">
        <div>
          <dt>{painting.starStats ? guide.colLevel : guide.colStats}</dt>
          <dd><StatChips stats={painting.stats} labels={guide.stats} /></dd>
        </div>
        {painting.starStats ? (
          <div>
            <dt>{guide.colStar}</dt>
            <dd><StatChips stats={painting.starStats} labels={guide.stats} /></dd>
          </div>
        ) : null}
        <div>
          <dt>{guide.colProduce}</dt>
          <dd>{dash(painting.productivity)}</dd>
        </div>
      </dl>
    </article>
  );
}

function SetCard({ entry, guide }: { entry: PaintingSet; guide: Guide }) {
  return (
    <article className="utility-card painting-set" data-rarity={entry.rarity}>
      <header className="painting-set-head">
        <span className="rarity" data-rarity={entry.rarity}>{entry.rarity}</span>
        <h3>{entry.name}</h3>
      </header>
      <p className="painting-effect">{entry.effect}</p>
      <div className="painting-grid">
        {entry.paintings.map((canvas) => (
          <PaintingBlock key={canvas.id} painting={canvas} guide={guide} />
        ))}
      </div>
    </article>
  );
}

function RarityTabs({ guide }: { guide: Guide }) {
  const base = useId();
  const [rarity, setRarity] = useState<PaintingRarity>("SSR");
  const sets = setsByRarity(rarity);

  const tabId = (id: PaintingRarity) => `${base}-tab-${id}`;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = PAINTING_RARITIES.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setRarity(PAINTING_RARITIES[next]);
    document.getElementById(tabId(PAINTING_RARITIES[next]))?.focus();
  };

  return (
    <>
      <div className="build-tabs" role="tablist" aria-label={guide.setsHeading}>
        {PAINTING_RARITIES.map((tier, index) => {
          const selected = tier === rarity;
          return (
            <button
              key={tier}
              id={tabId(tier)}
              type="button"
              role="tab"
              className="build-tab"
              data-build={tier}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setRarity(tier)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span className="build-dot" aria-hidden="true" />
              {tier}
            </button>
          );
        })}
      </div>
      <div
        className="build-panel painting-panel"
        data-build={rarity}
        id={`${base}-panel`}
        role="tabpanel"
        aria-labelledby={tabId(rarity)}
      >
        <div className="painting-sets">
          {sets.map((entry) => (
            <SetCard key={entry.id} entry={entry} guide={guide} />
          ))}
        </div>
      </div>
    </>
  );
}

function groupHits(hits: PaintingHit[]): { set: PaintingSet; paintings: Painting[] }[] {
  const order: string[] = [];
  const map = new Map<string, { set: PaintingSet; paintings: Painting[] }>();
  for (const hit of hits) {
    const existing = map.get(hit.set.id);
    if (!existing) {
      order.push(hit.set.id);
      map.set(hit.set.id, { set: hit.set, paintings: [hit.painting] });
      continue;
    }
    existing.paintings.push(hit.painting);
  }
  return order.map((id) => map.get(id)).filter((row): row is { set: PaintingSet; paintings: Painting[] } => Boolean(row));
}

export function ArtworkGuide({ guide }: { guide: Guide }) {
  const [query, setQuery] = useState("");
  const hits = useMemo(() => paintingsForHero(query), [query]);
  const grouped = useMemo(() => groupHits(hits), [hits]);

  return (
    <div className="guide-wide hero-layouts artwork-layouts">
      <p className="intro">{guide.intro}</p>
      <p className="guide-credit">
        <span>{guide.credit}</span>
        <span>{guide.creditDate}</span>
        {guide.status ? <span className="build-status">{guide.status}</span> : null}
      </p>

      <h2>{guide.notesHeading}</h2>
      <div className="formation-rules">
        {guide.glossary.map((item, index) => (
          <article className="formation-rule" key={item.abbr}>
            <span className="formation-rule-index" aria-hidden="true">{index + 1}</span>
            <h3>{item.abbr}</h3>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
      <ul className="tip-list">
        {guide.tips.map((tip) => (
          <li key={tip}>
            <CheckIcon className="icon icon-sm" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>

      <div className="formation-intro artwork-spend">
        <div>
          <h2>{guide.spendHeading}</h2>
          <div className="formation-rules">
            {guide.steps.map((step, index) => (
              <article className="formation-rule" key={step.title}>
                <span className="formation-rule-index" aria-hidden="true">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
        <div>
          <h2>{guide.levelsHeading}</h2>
          <div className="table-scroll panel guide-table-panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{guide.colRank}</th>
                  <th>{guide.colRarity}</th>
                  <th>{guide.colStat}</th>
                </tr>
              </thead>
              <tbody>
                {guide.levels.map((row) => (
                  <tr key={`${row.rarity}-${row.stat}`}>
                    <td data-label={guide.colRank}><strong className="mono">{row.rank}</strong></td>
                    <td data-label={guide.colRarity}>
                      <span className="rarity" data-rarity={row.rarity}>{row.rarity}</span>
                    </td>
                    <td data-label={guide.colStat}>{row.stat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2>{query.trim() ? guide.filterHeading : guide.setsHeading}</h2>
      {query.trim() ? null : guide.setsLede ? <p className="utility-lede">{guide.setsLede}</p> : null}
      <label className="hero-search artwork-filter">
        <span className="visually-hidden">{guide.filterLabel}</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={guide.filterPlaceholder}
        />
      </label>
      {query.trim() ? (
        grouped.length === 0 ? (
          <p className="empty-state">{guide.empty}</p>
        ) : (
          <>
            <p className="hero-count">{fill(guide.countLabel, { count: hits.length })}</p>
            <div className="painting-sets">
              {grouped.map((row) => (
                <article className="utility-card painting-set" data-rarity={row.set.rarity} key={row.set.id}>
                  <header className="painting-set-head">
                    <span className="rarity" data-rarity={row.set.rarity}>{row.set.rarity}</span>
                    <h3>{row.set.name}</h3>
                  </header>
                  <p className="painting-effect">{row.set.effect}</p>
                  <div className="painting-grid">
                    {row.paintings.map((canvas) => (
                      <PaintingBlock key={canvas.id} painting={canvas} guide={guide} />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </>
        )
      ) : (
        <>
          <p className="utility-lede">{guide.filterLede}</p>
          <RarityTabs guide={guide} />
        </>
      )}
    </div>
  );
}
