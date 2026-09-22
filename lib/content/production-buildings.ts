/**
 * @deprecated Import from `./buildings.ts` — kept so older imports keep working
 * until callers are updated.
 */
export {
  BUILDINGS as PRODUCTION_BUILDINGS,
  BUILDINGS_DATA as PRODUCTION_BUILDINGS_DATA,
  PRODUCTION_GROUPS,
  PRODUCTION_RESOURCES,
  PRODUCTION_TAGS,
  allProductionBuildings,
  buildingImageUrl as productionBuildingImageUrl,
  isProductionGroupId,
  isProductionResource,
  isProductionTag,
  localizedBuildingName,
  localizedBuildingNote,
  type Building as ProductionBuilding,
  type BuildingText as ProductionBuildingText,
  type BuildingTexts as ProductionBuildingTexts,
  type BuildingsData as ProductionBuildingsData,
  type ProductionGroupId,
  type ProductionResource,
  type ProductionTag,
} from "./buildings.ts";

export type ProductionGroup = {
  id: import("./buildings.ts").ProductionGroupId;
  buildings: import("./buildings.ts").Building[];
};
