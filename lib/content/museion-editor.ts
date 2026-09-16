/**
 * Pure state logic for the Museion editor. The page only renders this state and
 * calls these functions, so assigning heroes to buildings and exporting can be
 * tested without a browser.
 *
 * The editor works on a copy of `lib/data/museion.json`. A static site cannot
 * save for everyone, so the result leaves the browser as that JSON file plus
 * one `buildingTexts` block per dictionary. English building names stay in the
 * JSON; other languages export as `buildingTexts`. Heroes come from the Core
 * roster (plus a few off-roster names already published in the guide).
 */

import { HEROES } from "./heroes.ts";
import {
  MUSEION_DATA,
  MUSEION_OFF_ROSTER,
  MUSEION_STATS,
  type MuseionBuilding,
  type MuseionBuildingTexts,
  type MuseionData,
  type MuseionStat,
} from "./museion.ts";
import { DEFAULT_LOCALE, getDictionary, mapLocales, type Locale } from "../i18n/index.ts";
import { blankTranslations, dictionaryLiteral, parseTranslations, type Translations } from "../i18n/translations.ts";

export type EditorMuseionBuilding = {
  uid: string;
  id: string;
  name: Translations;
  stats: MuseionStat[];
  heroes: string[];
};

export type MuseionEditorState = {
  version: 1;
  buildings: EditorMuseionBuilding[];
  nextId: number;
};

const STAT_SET = new Set<string>(MUSEION_STATS);
const HERO_NAMES = new Set(HEROES.map((hero) => hero.name));
const OFF_ROSTER = new Set<string>(MUSEION_OFF_ROSTER);

export function catalogsFromDictionaries(): Record<Locale, MuseionBuildingTexts> {
  return mapLocales((locale) => getDictionary(locale).guideEntries.museion.buildingTexts as MuseionBuildingTexts);
}

function translated(english: string, read: (locale: Locale) => string | undefined): Translations {
  return mapLocales((locale) => (locale === DEFAULT_LOCALE ? english : (read(locale) ?? "")));
}

export function fromMuseionData(
  data: MuseionData,
  catalogs: Partial<Record<Locale, MuseionBuildingTexts>> = {},
): MuseionEditorState {
  let nextId = 1;
  const buildings = data.buildings.map((building): EditorMuseionBuilding => {
    const uid = `b${nextId++}`;
    const local = (locale: Locale) => catalogs[locale]?.[building.id];
    return {
      uid,
      id: building.id,
      name: translated(building.name, (locale) => local(locale)?.name),
      stats: [...building.stats],
      heroes: [...building.heroes],
    };
  });
  return { version: 1, buildings, nextId };
}

export function buildingByUid(state: MuseionEditorState, uid: string): EditorMuseionBuilding | undefined {
  return state.buildings.find((building) => building.uid === uid);
}

/** Roster heroes not yet on this building. Off-roster names stay only if already listed. */
export function unusedHeroes(state: MuseionEditorState, uid: string): typeof HEROES {
  const building = buildingByUid(state, uid);
  if (!building) return [];
  const used = new Set(building.heroes);
  return HEROES.filter((hero) => !used.has(hero.name));
}

export function addHero(state: MuseionEditorState, uid: string, hero: string): MuseionEditorState {
  const name = hero.trim();
  if (!HERO_NAMES.has(name) && !OFF_ROSTER.has(name)) return state;
  return {
    ...state,
    buildings: state.buildings.map((building) => {
      if (building.uid !== uid || building.heroes.includes(name)) return building;
      return { ...building, heroes: [...building.heroes, name] };
    }),
  };
}

export function removeHero(state: MuseionEditorState, uid: string, hero: string): MuseionEditorState {
  return {
    ...state,
    buildings: state.buildings.map((building) =>
      building.uid === uid ? { ...building, heroes: building.heroes.filter((name) => name !== hero) } : building,
    ),
  };
}

export function moveHero(state: MuseionEditorState, uid: string, hero: string, delta: -1 | 1): MuseionEditorState {
  return {
    ...state,
    buildings: state.buildings.map((building) => {
      if (building.uid !== uid) return building;
      const index = building.heroes.indexOf(hero);
      const next = index + delta;
      if (index < 0 || next < 0 || next >= building.heroes.length) return building;
      const heroes = [...building.heroes];
      [heroes[index], heroes[next]] = [heroes[next], heroes[index]];
      return { ...building, heroes };
    }),
  };
}

export function setBuildingName(
  state: MuseionEditorState,
  uid: string,
  locale: Locale,
  value: string,
): MuseionEditorState {
  return {
    ...state,
    buildings: state.buildings.map((building) =>
      building.uid === uid ? { ...building, name: { ...building.name, [locale]: value } } : building,
    ),
  };
}

export function setBuildingStats(state: MuseionEditorState, uid: string, stats: MuseionStat[]): MuseionEditorState {
  const cleaned = stats.filter((stat) => STAT_SET.has(stat)).slice(0, 2);
  return {
    ...state,
    buildings: state.buildings.map((building) => (building.uid === uid ? { ...building, stats: cleaned } : building)),
  };
}

export function moveBuilding(state: MuseionEditorState, uid: string, delta: -1 | 1): MuseionEditorState {
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
      .replace(/[̀-ͯ]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "building";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

export function addBuilding(state: MuseionEditorState): { state: MuseionEditorState; uid: string } {
  const uid = `b${state.nextId}`;
  const building: EditorMuseionBuilding = {
    uid,
    id: "",
    name: blankTranslations(),
    stats: [],
    heroes: [],
  };
  return { uid, state: { ...state, buildings: [...state.buildings, building], nextId: state.nextId + 1 } };
}

export function removeBuilding(state: MuseionEditorState, uid: string): MuseionEditorState {
  if (state.buildings.length <= 1) return state;
  return { ...state, buildings: state.buildings.filter((building) => building.uid !== uid) };
}

export function exportIds(state: MuseionEditorState): Map<string, string> {
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

export function exportMuseion(state: MuseionEditorState): MuseionData {
  const ids = exportIds(state);
  return {
    buildings: state.buildings.map((building): MuseionBuilding => ({
      id: ids.get(building.uid) ?? building.id,
      name: building.name[DEFAULT_LOCALE].trim(),
      stats: [...building.stats],
      heroes: [...building.heroes],
    })),
  };
}

export function serializeMuseionData(data: MuseionData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function exportedBuildingTexts(state: MuseionEditorState): Record<Locale, MuseionBuildingTexts> {
  const ids = exportIds(state);
  return mapLocales((locale) => {
    const catalog: MuseionBuildingTexts = {};
    if (locale === DEFAULT_LOCALE) return catalog;
    for (const building of state.buildings) {
      const name = building.name[locale].trim();
      if (name && building.name[DEFAULT_LOCALE].trim()) {
        catalog[ids.get(building.uid) ?? building.id] = { name };
      }
    }
    return catalog;
  });
}

export function buildingTextBlocks(state: MuseionEditorState): Record<Locale, string> {
  const catalogs = exportedBuildingTexts(state);
  return mapLocales((locale) => `      buildingTexts: ${dictionaryLiteral(catalogs[locale], "      ")},`);
}

export function countMuseionChanges(published: MuseionEditorState, draft: MuseionEditorState): number {
  const before = serializeMuseionData(exportMuseion(published));
  const after = serializeMuseionData(exportMuseion(draft));
  const beforeTexts = JSON.stringify(exportedBuildingTexts(published));
  const afterTexts = JSON.stringify(exportedBuildingTexts(draft));
  if (before === after && beforeTexts === afterTexts) return 0;
  return 1;
}

export type MuseionProblem = { code: string; values?: Record<string, string | number> };

export function findMuseionProblems(state: MuseionEditorState): MuseionProblem[] {
  const problems: MuseionProblem[] = [];
  if (state.buildings.length === 0) problems.push({ code: "noBuildings" });
  const ids = new Set<string>();
  for (const building of state.buildings) {
    const name = building.name[DEFAULT_LOCALE].trim();
    if (!name) problems.push({ code: "emptyName", values: { building: building.id || building.uid } });
    const id = building.id || buildingIdFrom(name, ids);
    if (ids.has(id)) problems.push({ code: "duplicateId", values: { id } });
    ids.add(id);
    if (building.stats.some((stat) => !STAT_SET.has(stat))) {
      problems.push({ code: "badStats", values: { building: name || building.uid } });
    }
    if (building.heroes.length === 0) {
      problems.push({ code: "emptyHeroes", values: { building: name || building.uid } });
    }
    const seen = new Set<string>();
    for (const hero of building.heroes) {
      if (!HERO_NAMES.has(hero) && !OFF_ROSTER.has(hero)) {
        problems.push({ code: "unknownHero", values: { building: name || building.uid, hero } });
      }
      if (seen.has(hero)) problems.push({ code: "duplicateHero", values: { building: name || building.uid, hero } });
      seen.add(hero);
    }
  }
  return problems;
}

export function parseMuseionDraft(raw: string | null): MuseionEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as MuseionEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.buildings)) return null;
    const buildings: EditorMuseionBuilding[] = [];
    for (const entry of value.buildings) {
      if (typeof entry?.uid !== "string" || typeof entry.id !== "string" || !Array.isArray(entry.heroes)) return null;
      if (!Array.isArray(entry.stats) || entry.stats.some((stat) => !STAT_SET.has(stat))) return null;
      const name = parseTranslations(entry.name);
      if (!name) return null;
      if (entry.heroes.some((hero) => typeof hero !== "string")) return null;
      buildings.push({
        uid: entry.uid,
        id: entry.id,
        name,
        stats: entry.stats as MuseionStat[],
        heroes: [...entry.heroes],
      });
    }
    return { version: 1, buildings, nextId: value.nextId };
  } catch {
    return null;
  }
}

export const PUBLISHED_MUSEION = fromMuseionData(MUSEION_DATA, catalogsFromDictionaries());
