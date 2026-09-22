"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronIcon, CloseIcon } from "../components/Icons";
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
import {
  buildingLevelDetail,
  buildingStageUrl,
  type BuildingCost,
  type BuildingLevelRow,
} from "../../lib/content/building-levels";
import { fill, type Dictionary } from "../../lib/i18n";

type Guide = Dictionary["guideEntries"]["buildings"];

export function isBuildingsGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "buildings";
}

const tone = (index: number) => String((index % 4) + 1);

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

function resourceLabel(guide: Guide, resource: string): string {
  return guide.resources[resource as ProductionResource] ?? resource;
}

function ResourceChip({
  resource,
  guide,
  output,
  active,
}: {
  resource: string;
  guide: Guide;
  output?: boolean;
  active?: boolean;
}) {
  const className = ["pb-chip", output ? "is-output" : "", active ? "is-active" : ""].filter(Boolean).join(" ");
  return (
    <span className={className} data-resource={resource}>
      <span className="pb-dot" aria-hidden="true" />
      {resourceLabel(guide, resource)}
    </span>
  );
}

function CostList({ costs, guide }: { costs?: BuildingCost[]; guide: Guide }) {
  if (!costs?.length) return <span className="gl-overview-empty">—</span>;
  return (
    <span className="pb-costs">
      {costs.map((cost) => (
        <span key={`${cost.resource}-${cost.amount}`} className="pb-cost" data-resource={cost.resource}>
          <span className="pb-dot" aria-hidden="true" />
          <span className="pb-cost-name">{resourceLabel(guide, cost.resource)}</span>
          <span className="pb-cost-amt">{cost.amount}</span>
        </span>
      ))}
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
  onOpen,
}: {
  building: Building;
  guide: Guide;
  resource: ProductionResource | null;
  onOpen: (building: Building) => void;
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
    <button
      type="button"
      className="pb-card"
      id={building.id}
      data-resource={building.produces}
      data-category={building.category}
      aria-haspopup="dialog"
      onClick={() => onOpen(building)}
    >
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
    </button>
  );
}

function BuildingDetail({
  building,
  list,
  guide,
  onStep,
  onClose,
}: {
  building: Building;
  list: Building[];
  guide: Guide;
  onStep: (building: Building) => void;
  onClose: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const detail = buildingLevelDetail(building.id);
  const stages = detail?.stages ?? [];
  const [shown, setShown] = useState(() => Math.max(0, stages.length - 1));
  const name = localizedBuildingName(building, guide.buildingTexts);
  const note = localizedBuildingNote(building, guide.buildingTexts);
  const index = list.findIndex((entry) => entry.id === building.id);
  const previous = index > 0 ? list[index - 1] : undefined;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : undefined;
  const production = building.category === "production";
  const notes = [
    ...(building.tags?.map((tag) => guide.tags[tag as ProductionTag]) ?? []),
    ...(note ? [note] : []),
  ];

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (!node.open) node.showModal();
  }, [building.id]);

  const attach = (node: HTMLDialogElement | null) => {
    dialog.current = node;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "ArrowLeft" && previous) {
      event.preventDefault();
      onStep(previous);
    }
    if (event.key === "ArrowRight" && next) {
      event.preventDefault();
      onStep(next);
    }
  };

  const currentStage = stages[shown] ? buildingStageUrl(stages[shown]) : buildingImageUrl(building);

  return (
    <dialog
      ref={attach}
      className="hero-detail building-detail"
      aria-labelledby={`${id}-name`}
      onClose={onClose}
      onKeyDown={onKeyDown}
    >
      <div className="hero-detail-nav">
        <button
          type="button"
          className="icon-button hero-detail-prev"
          aria-label={guide.previousBuilding}
          disabled={!previous}
          onClick={() => previous && onStep(previous)}
        >
          <ChevronIcon className="icon icon-sm" />
        </button>
        <span className="hero-detail-position">{index >= 0 ? `${index + 1} / ${list.length}` : ""}</span>
        <button
          type="button"
          className="icon-button"
          aria-label={guide.nextBuilding}
          disabled={!next}
          onClick={() => next && onStep(next)}
        >
          <ChevronIcon className="icon icon-sm" />
        </button>
        <button type="button" className="icon-button hero-detail-close" aria-label={guide.close} onClick={() => dialog.current?.close()}>
          <CloseIcon className="icon icon-sm" />
        </button>
      </div>
      <header className="hero-detail-head">
        <div className="building-detail-portrait">
          {currentStage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentStage} alt="" width={200} height={200} decoding="async" />
          ) : null}
        </div>
        <div className="hero-detail-title">
          <h2 id={`${id}-name`}>{name}</h2>
          <p>
            <span className="rarity">{guide.categories[building.category]}</span>
            {building.levelMax ? <span className="hero-detail-fact">{fill(guide.levelRange, { max: building.levelMax })}</span> : null}
            {production ? <Stars priority={building.priority ?? 0} guide={guide} /> : null}
          </p>
          {stages.length > 1 ? (
            <div className="hero-skins" role="group" aria-label={guide.stagesLabel}>
              {stages.map((stage, position) => (
                <button
                  key={stage}
                  type="button"
                  className="hero-skin"
                  aria-pressed={position === shown}
                  aria-label={fill(guide.stageLabel, { number: position + 1 })}
                  onClick={() => setShown(position)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={buildingStageUrl(stage)} alt="" width={80} height={80} loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>
      <div className="hero-detail-body">
        {production && building.produces && building.requires ? (
          <>
            <h3>{guide.producesLabel}</h3>
            <p>
              <ResourceChip resource={building.produces} guide={guide} output />
            </p>
            <h3>{guide.requiresLabel}</h3>
            <p className="pb-chips">
              {building.requires.map((entry) => (
                <ResourceChip key={entry} resource={entry} guide={guide} />
              ))}
            </p>
          </>
        ) : null}
        {notes.length > 0 ? (
          <>
            <h3>{guide.notesHeading}</h3>
            <ul className="pb-notes">
              {notes.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </>
        ) : null}
        {detail?.levels.length ? (
          <>
            <h3>{guide.levelsHeading}</h3>
            <p className="guide-lede">{guide.levelsLede}</p>
            <LevelsTable building={building} rows={detail.levels} guide={guide} />
          </>
        ) : null}
      </div>
    </dialog>
  );
}

function LevelsTable({ building, rows, guide }: { building: Building; rows: BuildingLevelRow[]; guide: Guide }) {
  const population = building.category === "population";
  const military = building.category === "military";
  return (
    <div className="table-scroll panel pb-levels">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{guide.colLevel}</th>
            {population ? <th scope="col">{guide.colPopulation}</th> : null}
            {military ? <th scope="col">{guide.colTroopCapacity}</th> : null}
            {military ? <th scope="col">{guide.colTroopLevel}</th> : null}
            <th scope="col">{guide.colCivIndex}</th>
            <th scope="col">{guide.colUpgrade}</th>
            {!population && !military ? <th scope="col">{guide.colUpkeep}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.level}>
              <th scope="row">{row.level}</th>
              {population ? <td>{row.population ?? "—"}</td> : null}
              {military ? <td>{row.troopCapacity ?? "—"}</td> : null}
              {military ? <td>{row.troopLevel ?? "—"}</td> : null}
              <td>{row.civIndex ?? "—"}</td>
              <td>
                <CostList costs={row.upgrade} guide={guide} />
              </td>
              {!population && !military ? (
                <td>
                  <CostList costs={row.upkeep} guide={guide} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  const [openId, setOpenId] = useState<string | null>(null);
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

  const flatList = useMemo(() => stages.flatMap((stage) => stage.buildings), [stages]);
  const openBuilding = openId ? BUILDINGS.find((building) => building.id === openId) : undefined;
  const shown = flatList.length;
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
                  <BuildingCard
                    key={building.id}
                    building={building}
                    guide={guide}
                    resource={resource}
                    onOpen={(entry) => setOpenId(entry.id)}
                  />
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
                          <button type="button" className="pb-overview-name" onClick={() => setOpenId(building.id)}>
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
                          </button>
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

      {openBuilding ? (
        <BuildingDetail
          key={openBuilding.id}
          building={openBuilding}
          list={flatList.length ? flatList : BUILDINGS}
          guide={guide}
          onStep={(entry) => setOpenId(entry.id)}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
}
