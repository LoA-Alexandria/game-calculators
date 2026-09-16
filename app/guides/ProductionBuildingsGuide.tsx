"use client";

import Link from "next/link";
import { guideLayout } from "../../lib/content/guides";
import {
  PRODUCTION_BUILDINGS_DATA,
  localizedBuildingName,
  localizedBuildingNote,
  productionBuildingImageUrl,
  type ProductionBuilding,
  type ProductionGroupId,
  type ProductionResource,
  type ProductionTag,
} from "../../lib/content/production-buildings";
import { type Dictionary } from "../../lib/i18n";
import { useAuth } from "../components/AuthProvider";
import { PenIcon } from "../components/Icons";
import { useLocale } from "../components/LocaleProvider";

type Guide = Dictionary["guideEntries"]["productionBuildings"];

export function isProductionBuildingsGuide(
  guide: Dictionary["guideEntries"][keyof Dictionary["guideEntries"]],
): guide is Guide {
  return guideLayout(guide) === "productionBuildings";
}

function priorityMarks(priority: number): string {
  if (priority <= 0) return "";
  return "*".repeat(Math.min(3, priority));
}

function ResourceList({
  resources,
  guide,
}: {
  resources: ProductionResource[];
  guide: Guide;
}) {
  return (
    <span className="production-resources">
      {resources.map((resource, index) => (
        <span key={`${resource}-${index}`}>
          {index > 0 ? <span className="production-sep"> · </span> : null}
          <span className="production-resource">{guide.resources[resource]}</span>
        </span>
      ))}
    </span>
  );
}

function BuildingCard({ building, guide }: { building: ProductionBuilding; guide: Guide }) {
  const name = localizedBuildingName(building, guide.buildingTexts);
  const note = localizedBuildingNote(building, guide.buildingTexts);
  const marks = priorityMarks(building.priority);
  const image = productionBuildingImageUrl(building);
  return (
    <article className="production-building" id={building.id}>
      {image ? (
        <div className="production-building-art">
          <img src={image} alt="" loading="lazy" decoding="async" />
        </div>
      ) : null}
      <header className="production-building-head">
        <h3>
          {name}
          {marks ? <span className="production-priority" aria-label={guide.priorityLabel}>{marks}</span> : null}
        </h3>
      </header>
      <dl className="production-facts">
        <div>
          <dt>{guide.producesLabel}</dt>
          <dd>
            <ResourceList resources={[building.produces]} guide={guide} />
          </dd>
        </div>
        <div>
          <dt>{guide.requiresLabel}</dt>
          <dd>
            <ResourceList resources={building.requires} guide={guide} />
          </dd>
        </div>
      </dl>
      {building.tags.length > 0 || note ? (
        <ul className="production-tags">
          {building.tags.map((tag) => (
            <li key={tag}>{guide.tags[tag as ProductionTag]}</li>
          ))}
          {note ? <li>{note}</li> : null}
        </ul>
      ) : null}
    </article>
  );
}

export function ProductionBuildingsGuide({ guide }: { guide: Guide }) {
  const { t } = useLocale();
  const { allows } = useAuth();

  return (
    <div className="guide-wide production-guide">
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
        <h2>{guide.requirementsHeading}</h2>
        {allows("guides.draft") ? (
          <Link className="small-button" href="/guides/production-buildings/edit/">
            <PenIcon className="icon icon-sm" />
            {t.productionBuildingsEditor.openEditor}
          </Link>
        ) : null}
      </div>
      <p className="guide-lede">{guide.requirementsLede}</p>

      {PRODUCTION_BUILDINGS_DATA.groups.map((group) => (
        <section className="production-group" key={group.id} aria-labelledby={`production-group-${group.id}`}>
          <h3 id={`production-group-${group.id}`}>{guide.groups[group.id as ProductionGroupId]}</h3>
          <div className="production-grid">
            {group.buildings.map((building) => (
              <BuildingCard key={building.id} building={building} guide={guide} />
            ))}
          </div>
        </section>
      ))}

      <p className="hero-credit">{guide.credit}</p>
      {guide.note ? <p className="callout">{guide.note}</p> : null}
    </div>
  );
}
