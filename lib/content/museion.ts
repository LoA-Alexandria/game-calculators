/**
 * Museion building placements: which heroes the game marks as “best” for each
 * hall, plus later placements from Spitzell and Zee. Rows live in
 * `lib/data/museion.json` (English names); `guideEntries.museion.buildingTexts`
 * holds the display name in every language. Hero names follow the Heroes roster
 * spelling when the hero exists there.
 */

import data from "../data/museion.json" with { type: "json" };
import { heroNamed } from "./heroes.ts";

export const MUSEION_STATS = ["insight", "creativity", "initiative", "intellect"] as const;
export type MuseionStat = (typeof MUSEION_STATS)[number];

export type MuseionBuilding = {
  id: string;
  name: string;
  /** Primary then secondary Museion competition stats. Empty when unknown. */
  stats: MuseionStat[];
  heroes: string[];
};

export type MuseionData = { buildings: MuseionBuilding[] };

export type MuseionBuildingText = { name?: string };
export type MuseionBuildingTexts = Record<string, MuseionBuildingText>;

/** Heroes named by Autumn / Spitzell / Zee who are not in the Core roster yet. */
export const MUSEION_OFF_ROSTER = [] as const;

/** JSON has no string literal types; tests check ids, stats, and hero names. */
export const MUSEION_DATA = data as MuseionData;
export const MUSEION_BUILDINGS: readonly MuseionBuilding[] = MUSEION_DATA.buildings;

export function localizedBuildingName(building: MuseionBuilding, texts: MuseionBuildingTexts): string {
  return texts[building.id]?.name?.trim() || building.name;
}

export function buildingById(id: string): MuseionBuilding | undefined {
  return MUSEION_BUILDINGS.find((building) => building.id === id);
}

/** Search buildings by translated name or by any hero on them. */
export function searchMuseionBuildings(
  query: string,
  catalogs: MuseionBuildingTexts[],
): MuseionBuilding[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...MUSEION_BUILDINGS];
  return MUSEION_BUILDINGS.filter((building) => {
    const names = [building.name, ...catalogs.map((catalog) => catalog[building.id]?.name ?? "")];
    const hay = [...names, ...building.heroes].join(" ").toLowerCase();
    return hay.includes(needle);
  });
}

export function museionHeroKnown(name: string): boolean {
  return Boolean(heroNamed(name)) || (MUSEION_OFF_ROSTER as readonly string[]).includes(name);
}
