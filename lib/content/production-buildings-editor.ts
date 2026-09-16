/**
 * Pure state logic for the production buildings editor. Export replaces
 * `lib/data/production-buildings.json` plus one `buildingTexts` block per
 * dictionary (name and optional free-form note per building).
 */

import {
  PRODUCTION_BUILDINGS_DATA,
  PRODUCTION_GROUPS,
  PRODUCTION_RESOURCES,
  PRODUCTION_TAGS,
  type ProductionBuilding,
  type ProductionBuildingTexts,
  type ProductionBuildingsData,
  type ProductionGroup,
  type ProductionGroupId,
  type ProductionResource,
  type ProductionTag,
} from "./production-buildings.ts";
import { DEFAULT_LOCALE, getDictionary, mapLocales, type Locale } from "../i18n/index.ts";
import { blankTranslations, dictionaryLiteral, parseTranslations, type Translations } from "../i18n/translations.ts";

export type EditorProductionBuilding = {
  uid: string;
  id: string;
  group: ProductionGroupId;
  name: Translations;
  note: Translations;
  produces: ProductionResource;
  requires: ProductionResource[];
  priority: number;
  tags: ProductionTag[];
  /** File under `public/production-buildings/`, when a cut-out exists. */
  image?: string;
};

export type ProductionBuildingsEditorState = {
  version: 1;
  buildings: EditorProductionBuilding[];
  nextId: number;
};

const RESOURCE_SET = new Set<string>(PRODUCTION_RESOURCES);
const TAG_SET = new Set<string>(PRODUCTION_TAGS);
const GROUP_SET = new Set<string>(PRODUCTION_GROUPS);

export function catalogsFromDictionaries(): Record<Locale, ProductionBuildingTexts> {
  return mapLocales(
    (locale) => getDictionary(locale).guideEntries.productionBuildings.buildingTexts as ProductionBuildingTexts,
  );
}

function translated(english: string, read: (locale: Locale) => string | undefined): Translations {
  return mapLocales((locale) => (locale === DEFAULT_LOCALE ? english : (read(locale) ?? "")));
}

export function fromProductionData(
  data: ProductionBuildingsData,
  catalogs: Partial<Record<Locale, ProductionBuildingTexts>> = {},
): ProductionBuildingsEditorState {
  let nextId = 1;
  const buildings: EditorProductionBuilding[] = [];
  for (const group of data.groups) {
    for (const building of group.buildings) {
      const local = (locale: Locale) => catalogs[locale]?.[building.id];
      buildings.push({
        uid: `b${nextId++}`,
        id: building.id,
        group: group.id,
        name: translated(building.name, (locale) => local(locale)?.name),
        note: mapLocales((locale) => local(locale)?.note ?? ""),
        produces: building.produces,
        requires: [...building.requires],
        priority: building.priority,
        tags: [...building.tags],
        ...(building.image ? { image: building.image } : {}),
      });
    }
  }
  return { version: 1, buildings, nextId };
}

export function buildingByUid(
  state: ProductionBuildingsEditorState,
  uid: string,
): EditorProductionBuilding | undefined {
  return state.buildings.find((building) => building.uid === uid);
}

export function setBuildingName(
  state: ProductionBuildingsEditorState,
  uid: string,
  locale: Locale,
  value: string,
): ProductionBuildingsEditorState {
  return {
    ...state,
    buildings: state.buildings.map((building) =>
      building.uid === uid ? { ...building, name: { ...building.name, [locale]: value } } : building,
    ),
  };
}

export function setBuildingNote(
  state: ProductionBuildingsEditorState,
  uid: string,
  locale: Locale,
  value: string,
): ProductionBuildingsEditorState {
  return {
    ...state,
    buildings: state.buildings.map((building) =>
      building.uid === uid ? { ...building, note: { ...building.note, [locale]: value } } : building,
    ),
  };
}

export function setBuildingFields(
  state: ProductionBuildingsEditorState,
  uid: string,
  patch: Partial<
    Pick<EditorProductionBuilding, "group" | "produces" | "requires" | "priority" | "tags">
  >,
): ProductionBuildingsEditorState {
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
      if (patch.group && !GROUP_SET.has(patch.group)) return building;
      if (patch.produces && !RESOURCE_SET.has(patch.produces)) return building;
      return next;
    }),
  };
}

export function moveBuilding(
  state: ProductionBuildingsEditorState,
  uid: string,
  delta: -1 | 1,
): ProductionBuildingsEditorState {
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
  state: ProductionBuildingsEditorState,
  group: ProductionGroupId = "basic",
): { state: ProductionBuildingsEditorState; uid: string } {
  const uid = `b${state.nextId}`;
  const building: EditorProductionBuilding = {
    uid,
    id: "",
    group: GROUP_SET.has(group) ? group : "basic",
    name: blankTranslations(),
    note: blankTranslations(),
    produces: "wood",
    requires: ["wood", "stone"],
    priority: 0,
    tags: [],
  };
  return { uid, state: { ...state, buildings: [...state.buildings, building], nextId: state.nextId + 1 } };
}

export function removeBuilding(state: ProductionBuildingsEditorState, uid: string): ProductionBuildingsEditorState {
  if (state.buildings.length <= 1) return state;
  return { ...state, buildings: state.buildings.filter((building) => building.uid !== uid) };
}

export function exportIds(state: ProductionBuildingsEditorState): Map<string, string> {
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

export function exportProductionBuildings(state: ProductionBuildingsEditorState): ProductionBuildingsData {
  const ids = exportIds(state);
  const groups: ProductionGroup[] = PRODUCTION_GROUPS.map((groupId) => ({
    id: groupId,
    buildings: state.buildings
      .filter((building) => building.group === groupId)
      .map(
        (building): ProductionBuilding => ({
          id: ids.get(building.uid) ?? building.id,
          name: building.name[DEFAULT_LOCALE].trim(),
          produces: building.produces,
          requires: [...building.requires],
          priority: building.priority,
          tags: [...building.tags],
          ...(building.image ? { image: building.image } : {}),
        }),
      ),
  })).filter((group) => group.buildings.length > 0);
  return { groups };
}

export function serializeProductionData(data: ProductionBuildingsData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function exportedBuildingTexts(
  state: ProductionBuildingsEditorState,
): Record<Locale, ProductionBuildingTexts> {
  const ids = exportIds(state);
  return mapLocales((locale) => {
    const catalog: ProductionBuildingTexts = {};
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

export function buildingTextBlocks(state: ProductionBuildingsEditorState): Record<Locale, string> {
  const catalogs = exportedBuildingTexts(state);
  return mapLocales((locale) => `      buildingTexts: ${dictionaryLiteral(catalogs[locale], "      ")},`);
}

export function countProductionChanges(
  published: ProductionBuildingsEditorState,
  draft: ProductionBuildingsEditorState,
): number {
  const before = serializeProductionData(exportProductionBuildings(published));
  const after = serializeProductionData(exportProductionBuildings(draft));
  const beforeTexts = JSON.stringify(exportedBuildingTexts(published));
  const afterTexts = JSON.stringify(exportedBuildingTexts(draft));
  if (before === after && beforeTexts === afterTexts) return 0;
  return 1;
}

export type ProductionProblem = { code: string; values?: Record<string, string | number> };

export function findProductionProblems(state: ProductionBuildingsEditorState): ProductionProblem[] {
  const problems: ProductionProblem[] = [];
  if (state.buildings.length === 0) problems.push({ code: "noBuildings" });
  const ids = new Set<string>();
  for (const building of state.buildings) {
    const name = building.name[DEFAULT_LOCALE].trim();
    if (!name) problems.push({ code: "emptyName", values: { building: building.id || building.uid } });
    const id = building.id || buildingIdFrom(name, ids);
    if (ids.has(id)) problems.push({ code: "duplicateId", values: { id } });
    ids.add(id);
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

export function parseProductionDraft(raw: string | null): ProductionBuildingsEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as ProductionBuildingsEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.buildings)) return null;
    const buildings: EditorProductionBuilding[] = [];
    for (const entry of value.buildings) {
      if (typeof entry?.uid !== "string" || typeof entry.id !== "string") return null;
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
        group: entry.group,
        name,
        note,
        produces: entry.produces,
        requires: [...entry.requires],
        priority: entry.priority,
        tags: [...entry.tags],
      });
    }
    return { version: 1, buildings, nextId: value.nextId };
  } catch {
    return null;
  }
}

export const PUBLISHED_PRODUCTION = fromProductionData(PRODUCTION_BUILDINGS_DATA, catalogsFromDictionaries());
