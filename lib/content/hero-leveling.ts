/**
 * Hero leveling and fragment priorities. Focus order can differ per Hero layouts
 * build (Crit, DoT, Pursuit, Execute). Rows live in `lib/data/hero-leveling.json`
 * (English hero names); band labels, fragment rule prose, and optional hero notes
 * live in `guideEntries.heroLeveling` in every dictionary.
 *
 * Source: Boah’s Discord list, with Autumn’s addendum (Ice, S12), August 2026.
 */

import data from "../data/hero-leveling.json" with { type: "json" };
import { LAYOUT_DATA } from "./hero-layouts.ts";

/** Same build ids as Hero layouts. */
export const LEVELING_BUILDS = ["crit", "dot", "pursuit", "execute"] as const;
export type LevelingBuildId = (typeof LEVELING_BUILDS)[number];

export const FOCUS_BANDS = ["sPlus", "gold", "silver"] as const;
export type FocusBandId = (typeof FOCUS_BANDS)[number];

export const LEVEL_TARGET_IDS = ["urUrPlus", "ssr", "rSr"] as const;
export type LevelTargetId = (typeof LEVEL_TARGET_IDS)[number];

export const FRAGMENT_KINDS = ["unlocks", "allUr", "allSsrWhenUrPlus", "splitEvenWhenUr"] as const;
export type FragmentKind = (typeof FRAGMENT_KINDS)[number];

export type FocusBand = { id: FocusBandId; heroes: string[] };

export type FragmentRule =
  | { kind: "unlocks" }
  | { kind: "allUr"; hero: string }
  | { kind: "allSsrWhenUrPlus"; hero: string }
  | { kind: "splitEvenWhenUr"; heroes: [string, string] };

export type LevelingBuild = {
  id: LevelingBuildId;
  bands: FocusBand[];
  fragments: FragmentRule[];
};

export type LevelTarget = {
  id: LevelTargetId;
  target: string;
  noAscend?: boolean;
};

export type HeroLevelingData = {
  defaultBuild: LevelingBuildId;
  builds: LevelingBuild[];
  levelTargets: LevelTarget[];
};

/** Optional note beside a focus hero, keyed by roster name. */
export type LevelingHeroNotes = Record<string, string>;

export const LEVELING_DATA = data as HeroLevelingData;

export function levelingBuildIds(): LevelingBuildId[] {
  const fromLayouts = LAYOUT_DATA.builds
    .map((build) => build.id)
    .filter((id): id is LevelingBuildId => (LEVELING_BUILDS as readonly string[]).includes(id));
  return fromLayouts.length > 0 ? fromLayouts : [...LEVELING_BUILDS];
}

export function buildById(id: string): LevelingBuild | undefined {
  return LEVELING_DATA.builds.find((build) => build.id === id);
}

export function focusHeroes(build: LevelingBuild): string[] {
  return build.bands.flatMap((band) => band.heroes);
}

export function heroNote(hero: string, notes: LevelingHeroNotes): string {
  return notes[hero]?.trim() ?? "";
}

export function isLevelingBuildId(id: string): id is LevelingBuildId {
  return (LEVELING_BUILDS as readonly string[]).includes(id);
}
