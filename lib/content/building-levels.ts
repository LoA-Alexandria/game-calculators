/**
 * Per-building upgrade stages and level rows from the Pop Epoch Wiki Buildings
 * page (https://pop-epoch-help.fandom.com/wiki/Buildings), last merged with the
 * roster on 18 September 2026. Tables are the wiki’s published level samples
 * (not necessarily every integer level up to the cap). Stage arts live under
 * `public/buildings/stages/`.
 */

import levels from "../data/building-levels.json" with { type: "json" };
import { asset } from "../site.ts";

export type BuildingCost = { resource: string; amount: string };

export type BuildingLevelRow = {
  level: number;
  civIndex?: string;
  population?: string;
  troopCapacity?: string;
  troopLevel?: string;
  upgrade?: BuildingCost[];
  upkeep?: BuildingCost[];
};

export type BuildingLevelDetail = {
  stages: string[];
  levels: BuildingLevelRow[];
};

export type BuildingLevelsData = Record<string, BuildingLevelDetail>;

export const BUILDING_LEVELS = levels as BuildingLevelsData;

const BUILDING_STAGE_IMAGE_VERSION = "1";

export function buildingLevelDetail(id: string): BuildingLevelDetail | undefined {
  return BUILDING_LEVELS[id];
}

export function buildingStageUrl(path: string): string {
  return `${asset(`/${path}`)}?v=${BUILDING_STAGE_IMAGE_VERSION}`;
}
