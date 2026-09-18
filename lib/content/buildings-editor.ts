/**
 * Pure state logic for the buildings editor. Export replaces
 * `lib/data/buildings.json` plus one `buildingTexts` block per dictionary
 * (name and optional free-form note per building).
 */

import {
  BUILDING_CATEGORIES,
  BUILDINGS_DATA,
  PRODUCTION_GROUPS,
  PRODUCTION_RESOURCES,
  PRODUCTION_TAGS,
  type Building,
  type BuildingCategory,
  type BuildingTexts,
  type BuildingsData,
  type ProductionGroupId,
  type ProductionResource,
  type ProductionTag,
} from "./buildings.ts";
import { DEFAULT_LOCALE, getDictionary, mapLocales, type Locale } from "../i18n/index.ts";
import { blankTranslations, dictionaryLiteral, parseTranslations, type Translations } from "../i18n/translations.ts";

export type EditorBuilding = {
  uid: string;
  id: string;
  category: BuildingCategory;
  name: Translations;
  note: Translations;
  levelMax: number;
  group: ProductionGroupId;
  produces: ProductionResource;
  requires: ProductionResource[];
  priority: number;
  tags: ProductionTag[];
  /** Path under `public/`, when art exists. */
  image?: string;
};

export type BuildingsEditorState = {
  version: 2;
  buildings: EditorBuilding[];
  nextId: number;
};

const RESOURCE_SET = new Set<string>(PRODUCTION_RESOURCES);
const TAG_SET = new Set<string>(PRODUCTION_TAGS);
const GROUP_SET = new Set<string>(PRODUCTION_GROUPS);
const CATEGORY_SET = new Set<string>(BUILDING_CATEGORIES);

export function catalogsFromDictionaries(): Record<Locale, BuildingTexts> {
  return mapLocales((locale) => getDictionary(locale).guideEntries.buildings.buildingTexts as BuildingTexts);
}

function translated(english: string, read: (locale: Locale) => string | undefined): Translations {
  return mapLocales((locale) => (locale === DEFAULT_LOCALE ? english : (read(locale) ?? "")));
}

export function fromBuildingsData(
  data: BuildingsData,
  catalogs: Partial<Record<Locale, BuildingTexts>> = {},
): BuildingsEditorState {
  let nextId = 1;
  const buildings: EditorBuilding[] = data.buildings.map((building) => {
    const local = (locale: Locale) => catalogs[locale]?.[building.id];
    return {
      uid: `b${nextId++}`,
      id: building.id,
      category: building.category,
      name: translated(building.name, (locale) => local(locale)?.name),
      note: mapLocales((locale) => local(locale)?.note ?? ""),
      levelMax: building.levelMax ?? 1,
      group: building.group ?? "basic",
      produces: building.produces ?? "wood",
      requires: building.requires ? [...building.requires] : ["wood", "stone"],
      priority: building.priority ?? 0,
      tags: building.tags ? [...building.tags] : [],
      ...(building.image ? { image: building.image } : {}),
    };
  });
  return { version: 2, buildings, nextId };
}

export function buildingByUid(state: BuildingsEditorState, uid: string): EditorBuilding | undefined {
  return state.buildings.find((building) => building.uid === uid);
}

export function setBuildingName(
  state: BuildingsEditorState,
  uid: string,
  locale: Locale,
  value: string,
): BuildingsEditorState {
  return {
    ...state,
    buildings: state.buildings.map((building) =>
      building.uid === uid ? { ...building, name: { ...building.name, [locale]: value } } : building,
    ),
  };
}

export function setBuildingNote(
  state: BuildingsEditorState,
  uid: string,
  locale: Locale,
  value: string,
): BuildingsEditorState {
  return {
    ...state,
    buildings: state.buildings.map((building) =>
      building.uid === uid ? { ...building, note: { ...building.note, [locale]: value } } : building,
    ),
  };
}

export function setBuildingFields(
  state: BuildingsEditorState,
  uid: string,
  patch: Partial<
    Pick<
      EditorBuilding,
      "category" | "group" | "produces" | "requires" | "priority" | "tags" | "levelMax" | "image"
    >
  >,
): BuildingsEditorState {
  return {
    ...state,
    buildings: state.buildings.map((building) => {
      if (building.uid !== uid) return building;
      const next = { ...building, ...patch };
      if (patch.requires) {
        next.requires = patch.requires.filter((resource) => RESOURCE_SET.has(resource)).slice(0, 4);
      }
      if (patch.tags) {
        next.tags = patch.tags.filter((tag) => TAG_SET.has(tag));
      }
      if (typeof patch.priority === "number") {
        next.priority = Math.max(0, Math.min(3, Math.round(patch.priority)));
      }
      if (typeof patch.levelMax === "number") {
        next.levelMax = Math.max(1, Math.round(patch.levelMax));
      }
      if (patch.group && !GROUP_SET.has(patch.group)) return building;
      if (patch.produces && !RESOURCE_SET.has(patch.produces)) return building;
      if (patch.category && !CATEGORY_SET.has(patch.category)) return building;
      return next;
    }),
  };
}

export function moveBuilding(state: BuildingsEditorState, uid: string, delta: -1 | 1): BuildingsEditorState {
  const index = state.buildings.findIndex((building) => building.uid === uid);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= state.buildings.length) return state;
  const buildings = [...state.buildings];
  [buildings[index], buildings[next]] = [buildings[next], buildings[index]];
  return { ...state, buildings };
}

function buildingIdFrom(name: string, taken: Iterable<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "building";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

export function addBuilding(
  state: BuildingsEditorState,
  category: BuildingCategory = "production",
): { state: BuildingsEditorState; uid: string } {
  const uid = `b${state.nextId}`;
  const building: EditorBuilding = {
    uid,
    id: "",
    category: CATEGORY_SET.has(category) ? category : "production",
    name: blankTranslations(),
    note: blankTranslations(),
    levelMax: 1,
    group: "basic",
    produces: "wood",
    requires: ["wood", "stone"],
    priority: 0,
    tags: [],
  };
  return { uid, state: { ...state, buildings: [...state.buildings, building], nextId: state.nextId + 1 } };
}

export function removeBuilding(state: BuildingsEditorState, uid: string): BuildingsEditorState {
  if (state.buildings.length <= 1) return state;
  return { ...state, buildings: state.buildings.filter((building) => building.uid !== uid) };
}

export function exportIds(state: BuildingsEditorState): Map<string, string> {
  const taken = new Set(state.buildings.map((building) => building.id).filter(Boolean));
  const ids = new Map<string, string>();
  for (const building of state.buildings) {
    let id = building.id;
    if (!id) {
      id = buildingIdFrom(building.name[DEFAULT_LOCALE].trim(), taken);
      taken.add(id);
    }
    ids.set(building.uid, id);
  }
  return ids;
}

export function exportBuildings(state: BuildingsEditorState): BuildingsData {
  const ids = exportIds(state);
  const buildings: Building[] = state.buildings.map((building) => {
    const id = ids.get(building.uid) ?? building.id;
    const row: Building = {
      id,
      name: building.name[DEFAULT_LOCALE].trim(),
      category: building.category,
      levelMax: building.levelMax,
      ...(building.image ? { image: building.image } : {}),
    };
    if (building.category === "production") {
      row.group = building.group;
      row.produces = building.produces;
      row.requires = [...building.requires];
      row.priority = building.priority;
      row.tags = [...building.tags];
    }
    return row;
  });
  return { buildings };
}

export function serializeBuildingsData(data: BuildingsData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function exportedBuildingTexts(state: BuildingsEditorState): Record<Locale, BuildingTexts> {
  const ids = exportIds(state);
  return mapLocales((locale) => {
    const catalog: BuildingTexts = {};
    for (const building of state.buildings) {
      const name = building.name[locale].trim();
      const note = building.note[locale].trim();
      if (!name && !note) continue;
      if (locale !== DEFAULT_LOCALE && !building.name[DEFAULT_LOCALE].trim()) continue;
      const entry: { name?: string; note?: string } = {};
      if (name) entry.name = name;
      if (note) entry.note = note;
      catalog[ids.get(building.uid) ?? building.id] = entry;
    }
    return catalog;
  });
}

export function buildingTextBlocks(state: BuildingsEditorState): Record<Locale, string> {
  const catalogs = exportedBuildingTexts(state);
  return mapLocales((locale) => `      buildingTexts: ${dictionaryLiteral(catalogs[locale], "      ")},`);
}

export function countBuildingChanges(published: BuildingsEditorState, draft: BuildingsEditorState): number {
  const before = serializeBuildingsData(exportBuildings(published));
  const after = serializeBuildingsData(exportBuildings(draft));
  const beforeTexts = JSON.stringify(exportedBuildingTexts(published));
  const afterTexts = JSON.stringify(exportedBuildingTexts(draft));
  if (before === after && beforeTexts === afterTexts) return 0;
  return 1;
}

export type BuildingProblem = { code: string; values?: Record<string, string | number> };

export function findBuildingProblems(state: BuildingsEditorState): BuildingProblem[] {
  const problems: BuildingProblem[] = [];
  if (state.buildings.length === 0) problems.push({ code: "noBuildings" });
  const ids = new Set<string>();
  for (const building of state.buildings) {
    const name = building.name[DEFAULT_LOCALE].trim();
    if (!name) problems.push({ code: "emptyName", values: { building: building.id || building.uid } });
    const id = building.id || buildingIdFrom(name, ids);
    if (ids.has(id)) problems.push({ code: "duplicateId", values: { id } });
    ids.add(id);
    if (!CATEGORY_SET.has(building.category)) {
      problems.push({ code: "badCategory", values: { building: name || building.uid } });
    }
    if (building.levelMax < 1) {
      problems.push({ code: "badLevelMax", values: { building: name || building.uid } });
    }
    if (building.category !== "production") continue;
    if (!GROUP_SET.has(building.group)) {
      problems.push({ code: "badGroup", values: { building: name || building.uid } });
    }
    if (!RESOURCE_SET.has(building.produces)) {
      problems.push({ code: "badProduces", values: { building: name || building.uid } });
    }
    if (building.requires.length === 0) {
      problems.push({ code: "emptyRequires", values: { building: name || building.uid } });
    }
    for (const resource of building.requires) {
      if (!RESOURCE_SET.has(resource)) {
        problems.push({ code: "badRequires", values: { building: name || building.uid, resource } });
      }
    }
    for (const tag of building.tags) {
      if (!TAG_SET.has(tag)) {
        problems.push({ code: "badTag", values: { building: name || building.uid, tag } });
      }
    }
  }
  return problems;
}

export function parseBuildingsDraft(raw: string | null): BuildingsEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as BuildingsEditorState;
    if (value?.version !== 2 || typeof value.nextId !== "number" || !Array.isArray(value.buildings)) return null;
    const buildings: EditorBuilding[] = [];
    for (const entry of value.buildings) {
      if (typeof entry?.uid !== "string" || typeof entry.id !== "string") return null;
      if (!CATEGORY_SET.has(entry.category)) return null;
      if (typeof entry.levelMax !== "number") return null;
      if (!GROUP_SET.has(entry.group) || !RESOURCE_SET.has(entry.produces)) return null;
      if (!Array.isArray(entry.requires) || entry.requires.some((resource) => !RESOURCE_SET.has(resource))) {
        return null;
      }
      if (!Array.isArray(entry.tags) || entry.tags.some((tag) => !TAG_SET.has(tag))) return null;
      if (typeof entry.priority !== "number") return null;
      const name = parseTranslations(entry.name);
      const note = parseTranslations(entry.note);
      if (!name || !note) return null;
      buildings.push({
        uid: entry.uid,
        id: entry.id,
        category: entry.category,
        name,
        note,
        levelMax: entry.levelMax,
        group: entry.group,
        produces: entry.produces,
        requires: [...entry.requires],
        priority: entry.priority,
        tags: [...entry.tags],
        ...(typeof entry.image === "string" && entry.image ? { image: entry.image } : {}),
      });
    }
    return { version: 2, buildings, nextId: value.nextId };
  } catch {
    return null;
  }
}

export const PUBLISHED_BUILDINGS = fromBuildingsData(BUILDINGS_DATA, catalogsFromDictionaries());
