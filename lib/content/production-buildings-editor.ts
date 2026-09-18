/**
 * @deprecated Import from `./buildings-editor.ts`.
 */
export {
  PUBLISHED_BUILDINGS as PUBLISHED_PRODUCTION,
  addBuilding,
  buildingByUid,
  buildingTextBlocks,
  countBuildingChanges as countProductionChanges,
  exportBuildings as exportProductionBuildings,
  findBuildingProblems as findProductionProblems,
  fromBuildingsData as fromProductionData,
  moveBuilding,
  parseBuildingsDraft as parseProductionDraft,
  removeBuilding,
  serializeBuildingsData as serializeProductionData,
  setBuildingFields,
  setBuildingName,
  setBuildingNote,
  type BuildingProblem as ProductionProblem,
  type BuildingsEditorState as ProductionBuildingsEditorState,
  type EditorBuilding as EditorProductionBuilding,
} from "./buildings-editor.ts";
