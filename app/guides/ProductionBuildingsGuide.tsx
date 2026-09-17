"use client";

import { useMemo, useState } from "react";
import { guideLayout } from "../../lib/content/guides";
import {
  PRODUCTION_BUILDINGS_DATA,
  PRODUCTION_RESOURCES,
  localizedBuildingName,
  localizedBuildingNote,
  productionBuildingImageUrl,
  type ProductionBuilding,
  type ProductionGroupId,
  type ProductionResource,
  type ProductionTag,
} from "../../lib/content/production-buildings";
import { fill, type Dictionary } from "../../lib/i18n";

type Guide = Dictionary["guideEntries"]["productionBuildings"];

export function isProductionBuildingsGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "productionBuildings";
}

/** Colour of a stage: the four tones repeat when there are more. */
const tone = (index: number) => String((index % 4) + 1);

/** Resources that at least one building produces or needs, in the usual order. */
const USED_RESOURCES = PRODUCTION_RESOURCES.filter((resource) =>
  PRODUCTION_BUILDINGS_DATA.groups.some((group) =>
    group.buildings.some((building) => building.produces === resource || building.requires.includes(resource)),
  ),
);

function fold(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function matches(building: ProductionBuilding, guide: Guide, needle: string, resource: ProductionResource | null): boolean {
  if (resource && building.produces !== resource && !building.requires.includes(resource)) return false;
  if (!needle) return true;
  const words = [
    localizedBuildingName(building, guide.buildingTexts),
    building.name,
    guide.resources[building.produces],
    ...building.requires.map((entry) => guide.resources[entry]),
    ...building.tags.map((tag) => guide.tags[tag as ProductionTag]),
  ];
  return fold(words.join(" ")).includes(needle);
}

function ResourceChip({
  resource,
  guide,
  output,
  active,
}: {
  resource: ProductionResource;
  guide: Guide;
  output?: boolean;
  active?: boolean;
}) {
  const className = ["pb-chip", output ? "is-output" : "", active ? "is-active" : ""].filter(Boolean).join(" ");
  return (
    <span className={className} data-resource={resource}>
      <span className="pb-dot" aria-hidden="true" />
      {guide.resources[resource]}
    </span>
  );
}

function Stars({ priority, guide }: { priority: number; guide: Guide }) {
  if (priority <= 0) return null;
  return (
    <span className="pb-stars" role="img" aria-label={fill(guide.priorityOf, { count: priority })} title={guide.priorityLabel}>
      {[1, 2, 3].map((step) => (
        <span key={step} className={step <= priority ? "is-on" : undefined} aria-hidden="true">★</span>
      ))}
    </span>
  );
}

function BuildingCard({ building, guide, resource }: { building: ProductionBuilding; guide: Guide; resource: ProductionResource | null }) {
  const name = localizedBuildingName(building, guide.buildingTexts);
  const note = localizedBuildingNote(building, guide.buildingTexts);
  const image = productionBuildingImageUrl(building);
  const notes = [...building.tags.map((tag) => guide.tags[tag as ProductionTag]), ...(note ? [note] : [])];
  return (
    <article className="pb-card" id={building.id} data-resource={building.produces}>
      <div className={image ? "pb-card-art" : "pb-card-art is-empty"}>
        {image ? (
          // Cut-outs from the game; a static export cannot optimise images.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="pb-dot pb-dot-large" data-resource={building.produces} aria-hidden="true" />
        )}
      </div>
      <div className="pb-card-body">
        <header className="pb-card-head">
          <h3>{name}</h3>
          <Stars priority={building.priority} guide={guide} />
        </header>
        <dl className="pb-facts">
          <div>
            <dt>{guide.producesLabel}</dt>
            <dd><ResourceChip resource={building.produces} guide={guide} output active={resource === building.produces} /></dd>
          </div>
          <div>
            <dt>{guide.requiresLabel}</dt>
            <dd className="pb-chips">
              {building.requires.map((entry) => (
                <ResourceChip key={entry} resource={entry} guide={guide} active={resource === entry} />
              ))}
            </dd>
          </div>
        </dl>
        {notes.length > 0 ? (
          <ul className="pb-notes">
            {notes.map((text) => <li key={text}>{text}</li>)}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

export function ProductionBuildingsGuide({ guide }: { guide: Guide }) {
  const [query, setQuery] = useState("");
  const [resource, setResource] = useState<ProductionResource | null>(null);
  const needle = fold(query.trim());
  const groups = useMemo(
    () =>
      PRODUCTION_BUILDINGS_DATA.groups
        .map((group, index) => ({
          id: group.id as ProductionGroupId,
          index,
          buildings: group.buildings.filter((building) => matches(building, guide, needle, resource)),
        }))
        .filter((group) => group.buildings.length > 0),
    [guide, needle, resource],
  );
  const shown = groups.reduce((sum, group) => sum + group.buildings.length, 0);

  return (
    <div className="guide-wide production-guide">
      <p className="intro">{guide.intro}</p>

      <h2>{guide.requirementsHeading}</h2>
      <p className="guide-lede">{guide.requirementsLede}</p>

      <div className="pb-toolbar">
        <label className="hero-search">
          <span className="visually-hidden">{guide.searchLabel}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={guide.searchPlaceholder} />
        </label>
        <div className="pb-resource-filter" role="group" aria-label={guide.resourceFilterLabel}>
          <button type="button" className="pb-filter" aria-pressed={resource === null} onClick={() => setResource(null)}>
            {guide.filterAll}
          </button>
          {USED_RESOURCES.map((entry) => (
            <button
              key={entry}
              type="button"
              className="pb-filter"
              data-resource={entry}
              aria-pressed={resource === entry}
              onClick={() => setResource(resource === entry ? null : entry)}
            >
              <span className="pb-dot" aria-hidden="true" />
              {guide.resources[entry]}
            </button>
          ))}
        </div>
      </div>
      <p className="hero-count" aria-live="polite">{fill(guide.countLabel, { count: shown })}</p>

      {groups.length === 0 ? (
        <p className="empty-state">{guide.empty}</p>
      ) : (
        <ol className="gl-phases pb-stages">
          {groups.map((group) => (
            <li className="gl-phase" key={group.id} data-tone={tone(group.index)} aria-labelledby={`production-group-${group.id}`}>
              <header className="gl-phase-head">
                <span className="gl-phase-number" aria-hidden="true">{group.index + 1}</span>
                <div>
                  <p className="gl-phase-kicker">
                    {group.buildings.length === 1 ? guide.buildingCountOne : fill(guide.buildingCount, { count: group.buildings.length })}
                  </p>
                  <h3 id={`production-group-${group.id}`}>{guide.groups[group.id]}</h3>
                </div>
              </header>
              <div className="pb-grid">
                {group.buildings.map((building) => (
                  <BuildingCard key={building.id} building={building} guide={guide} resource={resource} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      {groups.length > 0 ? (
        <>
          <h2>{guide.overviewHeading}</h2>
          <p className="guide-lede">{guide.overviewLede}</p>
          <div className="table-scroll panel pb-overview">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{guide.colBuilding}</th>
                  <th scope="col">{guide.producesLabel}</th>
                  <th scope="col">{guide.requiresLabel}</th>
                  <th scope="col">{guide.priorityLabel}</th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.id}>
                  <tr className="pb-overview-group">
                    <th scope="colgroup" colSpan={4}>
                      <span className="gl-step-number" data-tone={tone(group.index)} aria-hidden="true">{group.index + 1}</span>
                      {guide.groups[group.id]}
                    </th>
                  </tr>
                  {group.buildings.map((building) => {
                    const image = productionBuildingImageUrl(building);
                    return (
                      <tr key={building.id}>
                        <th scope="row">
                          <a className="pb-overview-name" href={`#${building.id}`}>
                            <span className="pb-thumb">
                              {image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={image} alt="" loading="lazy" decoding="async" />
                              ) : (
                                <span className="pb-dot" data-resource={building.produces} />
                              )}
                            </span>
                            {localizedBuildingName(building, guide.buildingTexts)}
                          </a>
                        </th>
                        <td><ResourceChip resource={building.produces} guide={guide} output active={resource === building.produces} /></td>
                        <td>
                          <span className="pb-chips">
                            {building.requires.map((entry) => (
                              <ResourceChip key={entry} resource={entry} guide={guide} active={resource === entry} />
                            ))}
                          </span>
                        </td>
                        <td>
                          {building.priority > 0 ? (
                            <Stars priority={building.priority} guide={guide} />
                          ) : (
                            <span className="gl-overview-empty" aria-hidden="true">·</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        </>
      ) : null}

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
