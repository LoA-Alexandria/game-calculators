/**
 * Pure state logic for the building levels editor.
 *
 * What it edits is a wiki table per building: one row per published level with
 * the civilisation index, the population or troops it carries, what the upgrade
 * costs and what it keeps costing. Numbers stay strings, because the tables
 * write them the way the game does — "1,080" — and turning that into a number
 * and back would only lose the grouping.
 *
 * Costs are edited as one line per resource, `<resource> <amount>`, so a row's
 * whole cost list can be typed without leaving the keyboard. A comma cannot
 * separate them: the amounts have commas in them.
 */

import { BUILDINGS, PRODUCTION_RESOURCES } from "./buildings.ts";
import {
  BUILDING_LEVELS,
  type BuildingCost,
  type BuildingLevelDetail,
  type BuildingLevelRow,
  type BuildingLevelsData,
} from "./building-levels.ts";

/** Everything an upgrade or upkeep may be paid in: production plus the land itself. */
export const COST_RESOURCES = ["land", ...PRODUCTION_RESOURCES] as const;
export type CostResource = (typeof COST_RESOURCES)[number];

/** Where a stage picture has to live, so the guide can find it. */
export const STAGE_PREFIX = "buildings/stages/";

export type EditorLevelRow = {
  uid: string;
  level: string;
  civIndex: string;
  population: string;
  troopCapacity: string;
  troopLevel: string;
  /** One `<resource> <amount>` per line. */
  upgrade: string;
  upkeep: string;
};

export type EditorBuilding = {
  id: string;
  stages: string[];
  rows: EditorLevelRow[];
};

export type LevelsEditorState = {
  version: 1;
  buildings: EditorBuilding[];
  nextId: number;
};

export function formatCosts(costs: readonly BuildingCost[] | undefined): string {
  return (costs ?? []).map((cost) => `${cost.resource} ${cost.amount}`).join("\n");
}

/** `null` when a line cannot be read, so a typo never reaches the file. */
export function parseCosts(text: string): BuildingCost[] | null {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const costs: BuildingCost[] = [];
  for (const line of lines) {
    const at = line.search(/\s/);
    if (at < 0) return null;
    const resource = line.slice(0, at);
    const amount = line.slice(at + 1).trim();
    if (!(COST_RESOURCES as readonly string[]).includes(resource)) return null;
    // The tables write amounts the way the game does: thousands commas up to
    // six figures, then two decimals and a magnitude — "308,264", "1.39M",
    // "42.10T".
    if (!/^\d[\d,]*(\.\d+)?[KMBT]?$/.test(amount)) return null;
    costs.push({ resource, amount });
  }
  return costs;
}

export function fromLevelsData(data: BuildingLevelsData): LevelsEditorState {
  let nextId = 1;
  return {
    version: 1,
    buildings: Object.entries(data).map(([id, detail]) => ({
      id,
      stages: [...detail.stages],
      rows: detail.levels.map((row) => ({
        uid: `r${nextId++}`,
        level: String(row.level),
        civIndex: row.civIndex ?? "",
        population: row.population ?? "",
        troopCapacity: row.troopCapacity ?? "",
        troopLevel: row.troopLevel ?? "",
        upgrade: formatCosts(row.upgrade),
        upkeep: formatCosts(row.upkeep),
      })),
    })),
    nextId,
  };
}

export function buildingOf(state: LevelsEditorState, id: string): EditorBuilding | undefined {
  return state.buildings.find((building) => building.id === id);
}

export function setRow(
  state: LevelsEditorState,
  id: string,
  uid: string,
  patch: Partial<Omit<EditorLevelRow, "uid">>,
): LevelsEditorState {
  return {
    ...state,
    buildings: state.buildings.map((building) =>
      building.id === id
        ? { ...building, rows: building.rows.map((row) => (row.uid === uid ? { ...row, ...patch } : row)) }
        : building,
    ),
  };
}

/** A new row after the last one, with the next level number already filled in. */
export function addRow(state: LevelsEditorState, id: string): { state: LevelsEditorState; uid: string } {
  const uid = `r${state.nextId}`;
  const building = buildingOf(state, id);
  const highest = Math.max(0, ...(building?.rows ?? []).map((row) => Number(row.level) || 0));
  const row: EditorLevelRow = {
    uid,
    level: String(highest + 1),
    civIndex: "",
    population: "",
    troopCapacity: "",
    troopLevel: "",
    upgrade: "",
    upkeep: "",
  };
  return {
    state: {
      ...state,
      nextId: state.nextId + 1,
      buildings: state.buildings.map((entry) =>
        entry.id === id ? { ...entry, rows: [...entry.rows, row] } : entry,
      ),
    },
    uid,
  };
}

export function removeRow(state: LevelsEditorState, id: string, uid: string): LevelsEditorState {
  return {
    ...state,
    buildings: state.buildings.map((building) =>
      building.id === id ? { ...building, rows: building.rows.filter((row) => row.uid !== uid) } : building,
    ),
  };
}

export function setStages(state: LevelsEditorState, id: string, text: string): LevelsEditorState {
  const stages = text.split("\n").map((line) => line.trim()).filter(Boolean);
  return {
    ...state,
    buildings: state.buildings.map((building) => (building.id === id ? { ...building, stages } : building)),
  };
}

/** The file as it would be committed, in the order the editor shows it. */
export function exportLevels(state: LevelsEditorState): BuildingLevelsData {
  const out: BuildingLevelsData = {};
  for (const building of state.buildings) {
    const detail: BuildingLevelDetail = {
      stages: [...building.stages],
      levels: building.rows.map((row): BuildingLevelRow => {
        const upgrade = parseCosts(row.upgrade) ?? [];
        const upkeep = parseCosts(row.upkeep) ?? [];
        return {
          level: Number(row.level) || 0,
          ...(row.population.trim() ? { population: row.population.trim() } : {}),
          ...(row.troopCapacity.trim() ? { troopCapacity: row.troopCapacity.trim() } : {}),
          ...(row.troopLevel.trim() ? { troopLevel: row.troopLevel.trim() } : {}),
          ...(row.civIndex.trim() ? { civIndex: row.civIndex.trim() } : {}),
          ...(upgrade.length > 0 ? { upgrade } : {}),
          ...(upkeep.length > 0 ? { upkeep } : {}),
        };
      }),
    };
    out[building.id] = detail;
  }
  return out;
}

/** Rows that moved, one per building whose stages moved. */
export function countLevelChanges(published: LevelsEditorState, draft: LevelsEditorState): number {
  const before = exportLevels(published);
  const after = exportLevels(draft);
  let changes = 0;
  for (const [id, detail] of Object.entries(after)) {
    const was = before[id];
    if (!was) {
      changes += 1;
      continue;
    }
    if (JSON.stringify(was.stages) !== JSON.stringify(detail.stages)) changes += 1;
    const rows = new Map(was.levels.map((row) => [row.level, JSON.stringify(row)]));
    for (const row of detail.levels) if (rows.get(row.level) !== JSON.stringify(row)) changes += 1;
    for (const row of was.levels) if (!detail.levels.some((entry) => entry.level === row.level)) changes += 1;
  }
  for (const id of Object.keys(before)) if (!(id in after)) changes += 1;
  return changes;
}

export type LevelProblem =
  | { code: "unknownBuilding"; id: string }
  | { code: "noLevel"; id: string }
  | { code: "duplicateLevel"; id: string; level: string }
  | { code: "badCosts"; id: string; level: string; kind: "upgrade" | "upkeep" }
  | { code: "strayStage"; id: string; path: string };

export function findLevelProblems(state: LevelsEditorState): LevelProblem[] {
  const problems: LevelProblem[] = [];
  const known = new Set(BUILDINGS.map((building) => building.id));
  for (const building of state.buildings) {
    if (!known.has(building.id)) problems.push({ code: "unknownBuilding", id: building.id });
    for (const path of building.stages) {
      if (!path.startsWith(STAGE_PREFIX)) problems.push({ code: "strayStage", id: building.id, path });
    }
    const seen = new Set<number>();
    for (const row of building.rows) {
      const level = Number(row.level);
      if (!Number.isInteger(level) || level < 1) {
        problems.push({ code: "noLevel", id: building.id });
        continue;
      }
      if (seen.has(level)) problems.push({ code: "duplicateLevel", id: building.id, level: row.level });
      seen.add(level);
      if (parseCosts(row.upgrade) === null) {
        problems.push({ code: "badCosts", id: building.id, level: row.level, kind: "upgrade" });
      }
      if (parseCosts(row.upkeep) === null) {
        problems.push({ code: "badCosts", id: building.id, level: row.level, kind: "upkeep" });
      }
    }
  }
  return problems;
}

/** The file is one long line, the way it is committed. */
export function serializeLevelsData(data: BuildingLevelsData): string {
  return `${JSON.stringify(data)}\n`;
}

export function parseLevelsDraft(raw: string | null): LevelsEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as LevelsEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number") return null;
    if (!Array.isArray(value.buildings)) return null;
    for (const building of value.buildings) {
      if (typeof building?.id !== "string" || !Array.isArray(building.stages)) return null;
      if (building.stages.some((path) => typeof path !== "string")) return null;
      if (!Array.isArray(building.rows)) return null;
      for (const row of building.rows) {
        if (typeof row?.uid !== "string") return null;
        for (const key of ["level", "civIndex", "population", "troopCapacity", "troopLevel", "upgrade", "upkeep"]) {
          if (typeof (row as unknown as Record<string, unknown>)[key] !== "string") return null;
        }
      }
    }
    return value;
  } catch {
    return null;
  }
}

/** The tables as they are published right now. */
export const PUBLISHED_LEVELS = fromLevelsData(BUILDING_LEVELS);
