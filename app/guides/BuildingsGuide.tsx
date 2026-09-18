"use client";

import { useMemo, useState } from "react";
import { guideLayout } from "../../lib/content/guides";
import {
  BUILDINGS,
  BUILDING_CATEGORIES,
  PRODUCTION_GROUPS,
  PRODUCTION_RESOURCES,
  buildingImageUrl,
  localizedBuildingName,
  localizedBuildingNote,
  productionBuildingsByGroup,
  type Building,
  type BuildingCategory,
  type ProductionGroupId,
  type ProductionResource,
  type ProductionTag,
} from "../../lib/content/buildings";
import { fill, type Dictionary } from "../../lib/i18n";

type Guide = Dictionary["guideEntries"]["buildings"];

export function isBuildingsGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "buildings";
}

/** Colour of a stage: the four tones repeat when there are more. */
const tone = (index: number) => String((index % 4) + 1);

/** Resources that at least one production building produces or needs. */
const USED_RESOURCES = PRODUCTION_RESOURCES.filter((resource) =>
  BUILDINGS.some(
    (building) =>
      building.category === "production" &&
      (building.produces === resource || building.requires?.includes(resource)),
  ),
);

function fold(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function matches(
  building: Building,
  guide: Guide,
  needle: string,
  category: BuildingCategory | "all",
  resource: ProductionResource | null,
): boolean {
  if (category !== "all" && building.category !== category) return false;
  if (resource) {
    if (building.category !== "production") return false;
    if (building.produces !== resource && !building.requires?.includes(resource)) return false;
  }
  if (!needle) return true;
  const words = [
    localizedBuildingName(building, guide.buildingTexts),
    building.name,
    guide.categories[building.category],
    building.produces ? guide.resources[building.produces] : "",
    ...(building.requires?.map((entry) => guide.resources[entry]) ?? []),
    ...(building.tags?.map((tag) => guide.tags[tag as ProductionTag]) ?? []),
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
        <span key={step} className={step <= priority ? "is-on" : undefined} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

function BuildingCard({
  building,
  guide,
  resource,
}: {
  building: Building;
  guide: Guide;
  resource: ProductionResource | null;
}) {
  const name = localizedBuildingName(building, guide.buildingTexts);
  const note = localizedBuildingNote(building, guide.buildingTexts);
  const image = buildingImageUrl(building);
  const notes = [
    ...(building.tags?.map((tag) => guide.tags[tag as ProductionTag]) ?? []),
    ...(note ? [note] : []),
  ];
  const production = building.category === "production";
  return (
    <article className="pb-card" id={building.id} data-resource={building.produces} data-category={building.category}>
      <div className={image ? "pb-card-art" : "pb-card-art is-empty"}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" decoding="async" />
        ) : production && building.produces ? (
          <span className="pb-dot pb-dot-large" data-resource={building.produces} aria-hidden="true" />
        ) : (
          <span className="pb-dot pb-dot-large" aria-hidden="true" />
        )}
      </div>
      <div className="pb-card-body">
        <header className="pb-card-head">
          <h3>{name}</h3>
          {production ? <Stars priority={building.priority ?? 0} guide={guide} /> : null}
        </header>
        {building.levelMax ? (
          <p className="pb-level">{fill(guide.levelRange, { max: building.levelMax })}</p>
        ) : null}
        {production && building.produces && building.requires ? (
          <dl className="pb-facts">
            <div>
              <dt>{guide.producesLabel}</dt>
              <dd>
                <ResourceChip resource={building.produces} guide={guide} output active={resource === building.produces} />
              </dd>
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
        ) : null}
        {notes.length > 0 ? (
          <ul className="pb-notes">
            {notes.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

type Stage = {
  key: string;
  title: string;
  index: number;
  buildings: Building[];
};

export function BuildingsGuide({ guide }: { guide: Guide }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BuildingCategory | "all">("all");
  const [resource, setResource] = useState<ProductionResource | null>(null);
  const needle = fold(query.trim());

  const stages = useMemo(() => {
    const filter = (building: Building) => matches(building, guide, needle, category, resource);
    const list: Stage[] = [];
    let index = 0;

    const population = BUILDINGS.filter((building) => building.category === "population").filter(filter);
    if (population.length > 0) {
      list.push({ key: "population", title: guide.categories.population, index: index++, buildings: population });
    }

    for (const groupId of PRODUCTION_GROUPS) {
      const buildings = productionBuildingsByGroup(groupId).filter(filter);
      if (buildings.length === 0) continue;
      list.push({
        key: groupId,
        title: guide.groups[groupId as ProductionGroupId],
        index: index++,
        buildings,
      });
    }

    const military = BUILDINGS.filter((building) => building.category === "military").filter(filter);
    if (military.length > 0) {
      list.push({ key: "military", title: guide.categories.military, index: index++, buildings: military });
    }

    return list;
  }, [guide, needle, category, resource]);

  const shown = stages.reduce((sum, stage) => sum + stage.buildings.length, 0);
  const showResourceFilter = category === "all" || category === "production";

  return (
    <div className="guide-wide production-guide">
      <p className="intro">{guide.intro}</p>

      <h2>{guide.categoriesHeading}</h2>
      <p className="guide-lede">{guide.categoriesLede}</p>

      <div className="pb-toolbar">
        <label className="hero-search">
          <span className="visually-hidden">{guide.searchLabel}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={guide.searchPlaceholder}
          />
        </label>
        <div className="pb-resource-filter" role="group" aria-label={guide.categoryFilterLabel}>
          <button type="button" className="pb-filter" aria-pressed={category === "all"} onClick={() => setCategory("all")}>
            {guide.filterAllCategories}
          </button>
          {BUILDING_CATEGORIES.map((entry) => (
            <button
              key={entry}
              type="button"
              className="pb-filter"
              aria-pressed={category === entry}
              onClick={() => setCategory(category === entry ? "all" : entry)}
            >
              {guide.categories[entry]}
            </button>
          ))}
        </div>
        {showResourceFilter ? (
          <div className="pb-resource-filter" role="group" aria-label={guide.resourceFilterLabel}>
            <button
              type="button"
              className="pb-filter"
              aria-pressed={resource === null}
              onClick={() => setResource(null)}
            >
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
        ) : null}
      </div>
      <p className="hero-count" aria-live="polite">
        {fill(guide.countLabel, { count: shown })}
      </p>

      {stages.length === 0 ? (
        <p className="empty-state">{guide.empty}</p>
      ) : (
        <ol className="gl-phases pb-stages">
          {stages.map((stage) => (
            <li
              className="gl-phase"
              key={stage.key}
              data-tone={tone(stage.index)}
              aria-labelledby={`building-stage-${stage.key}`}
            >
              <header className="gl-phase-head">
                <span className="gl-phase-number" aria-hidden="true">
                  {stage.index + 1}
                </span>
                <div>
                  <p className="gl-phase-kicker">
                    {stage.buildings.length === 1
                      ? guide.buildingCountOne
                      : fill(guide.buildingCount, { count: stage.buildings.length })}
                  </p>
                  <h3 id={`building-stage-${stage.key}`}>{stage.title}</h3>
                </div>
              </header>
              <div className="pb-grid">
                {stage.buildings.map((building) => (
                  <BuildingCard key={building.id} building={building} guide={guide} resource={resource} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      {stages.length > 0 ? (
        <>
          <h2>{guide.overviewHeading}</h2>
          <p className="guide-lede">{guide.overviewLede}</p>
          <div className="table-scroll panel pb-overview">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{guide.colBuilding}</th>
                  <th scope="col">{guide.colCategory}</th>
                  <th scope="col">{guide.colLevels}</th>
                  <th scope="col">{guide.producesLabel}</th>
                  <th scope="col">{guide.requiresLabel}</th>
                  <th scope="col">{guide.priorityLabel}</th>
                </tr>
              </thead>
              {stages.map((stage) => (
                <tbody key={stage.key}>
                  <tr className="pb-overview-group">
                    <th scope="colgroup" colSpan={6}>
                      <span className="gl-step-number" data-tone={tone(stage.index)} aria-hidden="true">
                        {stage.index + 1}
                      </span>
                      {stage.title}
                    </th>
                  </tr>
                  {stage.buildings.map((building) => {
                    const image = buildingImageUrl(building);
                    return (
                      <tr key={building.id}>
                        <th scope="row">
                          <a className="pb-overview-name" href={`#${building.id}`}>
                            <span className="pb-thumb">
                              {image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={image} alt="" loading="lazy" decoding="async" />
                              ) : building.produces ? (
                                <span className="pb-dot" data-resource={building.produces} />
                              ) : (
                                <span className="pb-dot" />
                              )}
                            </span>
                            {localizedBuildingName(building, guide.buildingTexts)}
                          </a>
                        </th>
                        <td>{guide.categories[building.category]}</td>
                        <td>{building.levelMax ? fill(guide.levelRange, { max: building.levelMax }) : "—"}</td>
                        <td>
                          {building.produces ? (
                            <ResourceChip
                              resource={building.produces}
                              guide={guide}
                              output
                              active={resource === building.produces}
                            />
                          ) : (
                            <span className="gl-overview-empty" aria-hidden="true">
                              ·
                            </span>
                          )}
                        </td>
                        <td>
                          {building.requires?.length ? (
                            <span className="pb-chips">
                              {building.requires.map((entry) => (
                                <ResourceChip key={entry} resource={entry} guide={guide} active={resource === entry} />
                              ))}
                            </span>
                          ) : (
                            <span className="gl-overview-empty" aria-hidden="true">
                              ·
                            </span>
                          )}
                        </td>
                        <td>
                          {(building.priority ?? 0) > 0 ? (
                            <Stars priority={building.priority ?? 0} guide={guide} />
                          ) : (
                            <span className="gl-overview-empty" aria-hidden="true">
                              ·
                            </span>
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
