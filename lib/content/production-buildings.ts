/**
 * Production building resource requirements: what each building produces and
 * what it costs to upgrade, plus barracks / research notes. Rows live in
 * `lib/data/production-buildings.json` (English names); group labels, resource
 * names, tag prose, and optional building name/note overrides live in
 * `guideEntries.productionBuildings` in every dictionary.
 *
 * Source: community Discord list (asterisks mark relative priority); Enlightenment
 * entries credited to Spitzell. Building pictures in `public/production-buildings/`
 * were cut from German client screenshots on 16 September 2026, with UI overlays
 * (speech bubbles, arrows, floating text) removed.
 */

import data from "../data/production-buildings.json" with { type: "json" };
import { asset } from "../site.ts";

export const PRODUCTION_GROUPS = [
  "basic",
  "advanced",
  "luxury",
  "exploration",
  "enlightenment",
  "steam",
] as const;
export type ProductionGroupId = (typeof PRODUCTION_GROUPS)[number];

export const PRODUCTION_RESOURCES = [
  "wood",
  "food",
  "stone",
  "copper",
  "iron",
  "cloth",
  "horses",
  "alcohol",
  "leather",
  "glass",
  "paper",
  "creations",
  "steel",
  "gunpowder",
  "lemons",
  "coffee",
  "coal",
] as const;
export type ProductionResource = (typeof PRODUCTION_RESOURCES)[number];

export const PRODUCTION_TAGS = [
  "pikemanBarracks",
  "archerBarracksExploration",
  "shieldBarracks",
  "allSoldiersExploration",
  "replacesWoodExplorationPikemen",
  "researchRenaissance",
  "goldGeneration",
  "cavalryBarracksExploration",
  "researchEarlyExploration",
  "luxuryExplorationBasis",
  "researchMidExploration",
  "researchLateExplorationEnlightenment",
  "soldiersAfterExploration",
  "explorationResourcesBasis",
  "explorationArchersCavalry",
  "lignite",
] as const;
export type ProductionTag = (typeof PRODUCTION_TAGS)[number];

export type ProductionBuilding = {
  id: string;
  name: string;
  produces: ProductionResource;
  requires: ProductionResource[];
  /** 0 = unmarked, 1–3 = Discord asterisk priority. */
  priority: number;
  tags: ProductionTag[];
  /** File name under `public/production-buildings/`, when a cut-out exists. */
  image?: string;
};

export type ProductionGroup = {
  id: ProductionGroupId;
  buildings: ProductionBuilding[];
};

export type ProductionBuildingsData = { groups: ProductionGroup[] };

export type ProductionBuildingText = { name?: string; note?: string };
export type ProductionBuildingTexts = Record<string, ProductionBuildingText>;

export const PRODUCTION_BUILDINGS_DATA = data as ProductionBuildingsData;

export function allProductionBuildings(): ProductionBuilding[] {
  return PRODUCTION_BUILDINGS_DATA.groups.flatMap((group) => group.buildings);
}

export function localizedBuildingName(building: ProductionBuilding, texts: ProductionBuildingTexts): string {
  return texts[building.id]?.name?.trim() || building.name;
}

export function localizedBuildingNote(building: ProductionBuilding, texts: ProductionBuildingTexts): string {
  return texts[building.id]?.note?.trim() || "";
}

/** URL of a cut-out in `public/production-buildings/`, or null when none is listed. */
/** Bump when replacing cutouts so browsers skip stale cached webps. */
const PRODUCTION_BUILDING_IMAGE_VERSION = "6";

export function productionBuildingImageUrl(building: ProductionBuilding): string | null {
  const file = building.image?.trim();
  if (!file) return null;
  return `${asset(`/production-buildings/${file}`)}?v=${PRODUCTION_BUILDING_IMAGE_VERSION}`;
}

export function isProductionResource(value: string): value is ProductionResource {
  return (PRODUCTION_RESOURCES as readonly string[]).includes(value);
}

export function isProductionTag(value: string): value is ProductionTag {
  return (PRODUCTION_TAGS as readonly string[]).includes(value);
}

export function isProductionGroupId(value: string): value is ProductionGroupId {
  return (PRODUCTION_GROUPS as readonly string[]).includes(value);
}
