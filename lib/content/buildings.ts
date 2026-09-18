/**
 * City buildings from the Pop Epoch Wiki Buildings page
 * (https://pop-epoch-help.fandom.com/wiki/Buildings), last merged on 18 September
 * 2026: population, production, and military rosters with highest-stage art and
 * level caps. Per-level upgrade cost tables stay on the wiki for now.
 *
 * Production rows also keep Discord priority asterisks and barracks/research
 * tags (Enlightenment credited to Spitzell). New Steam production buildings
 * start unmarked until the community confirms priority. Rows live in
 * `lib/data/buildings.json`. Group labels, resource names, tag prose, and
 * optional name/note overrides live in `guideEntries.buildings`.
 *
 * Images: client cut-outs under `public/production-buildings/` (16 Sep 2026)
 * where we already had them; wiki highest-stage art under `public/buildings/`
 * for population, military, and missing production portraits. The artwork
 * belongs to the game's publisher.
 */

import data from "../data/buildings.json" with { type: "json" };
import { asset } from "../site.ts";

export const BUILDING_CATEGORIES = ["population", "production", "military"] as const;
export type BuildingCategory = (typeof BUILDING_CATEGORIES)[number];

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
  "precisionParts",
  "oil",
  "information",
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

export type Building = {
  id: string;
  name: string;
  category: BuildingCategory;
  /** Highest level on the wiki Buildings card. */
  levelMax?: number;
  /**
   * Path under `public/`, e.g. `buildings/tent.webp` or
   * `production-buildings/farm.webp`.
   */
  image?: string;
  /** Production only: Discord age bucket. */
  group?: ProductionGroupId;
  produces?: ProductionResource;
  requires?: ProductionResource[];
  /** 0 = unmarked, 1–3 = Discord asterisk priority. Production only. */
  priority?: number;
  tags?: ProductionTag[];
};

export type BuildingsData = { buildings: Building[] };

export type BuildingText = { name?: string; note?: string };
export type BuildingTexts = Record<string, BuildingText>;

/** @deprecated Use BuildingTexts — kept for editor migration aliases. */
export type ProductionBuildingText = BuildingText;
export type ProductionBuildingTexts = BuildingTexts;

export const BUILDINGS_DATA = data as BuildingsData;
export const BUILDINGS: Building[] = BUILDINGS_DATA.buildings;

export function allBuildings(): Building[] {
  return BUILDINGS;
}

export function buildingsByCategory(category: BuildingCategory | "all"): Building[] {
  if (category === "all") return BUILDINGS;
  return BUILDINGS.filter((building) => building.category === category);
}

export function productionBuildings(): Building[] {
  return BUILDINGS.filter((building) => building.category === "production");
}

export function productionBuildingsByGroup(group: ProductionGroupId): Building[] {
  return productionBuildings().filter((building) => building.group === group);
}

export function localizedBuildingName(building: Building, texts: BuildingTexts): string {
  return texts[building.id]?.name?.trim() || building.name;
}

export function localizedBuildingNote(building: Building, texts: BuildingTexts): string {
  return texts[building.id]?.note?.trim() || "";
}

/** Bump when replacing arts so browsers skip stale cached webps. */
const BUILDING_IMAGE_VERSION = "1";

export function buildingImageUrl(building: Building): string | null {
  const file = building.image?.trim();
  if (!file) return null;
  return `${asset(`/${file}`)}?v=${BUILDING_IMAGE_VERSION}`;
}

/** @deprecated Prefer buildingImageUrl. */
export function productionBuildingImageUrl(building: Building): string | null {
  return buildingImageUrl(building);
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

export function isBuildingCategory(value: string): value is BuildingCategory {
  return (BUILDING_CATEGORIES as readonly string[]).includes(value);
}

/** Flat production list helpers for older tests/callers. */
export function allProductionBuildings(): Building[] {
  return productionBuildings();
}

export const PRODUCTION_BUILDINGS_DATA = {
  get groups() {
    return PRODUCTION_GROUPS.map((id) => ({
      id,
      buildings: productionBuildingsByGroup(id),
    })).filter((group) => group.buildings.length > 0);
  },
};
