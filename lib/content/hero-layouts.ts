import layoutData from "../data/hero-layouts.json" with { type: "json" };

/**
 * Language-independent parts of the Hero layouts guide. Which hero sits in
 * which build, counter, or utility group is in `lib/data/hero-layouts.json`,
 * the file the layouts editor exports. Everything readable (build names and
 * texts, counter and group labels, notes such as "with item") lives in
 * `guideEntries.heroLayouts` under keys the JSON points at. Hero and Collection
 * names are the same in every language.
 */

/**
 * Slot numbers as the in-game Formation screen lays them out, top to bottom.
 * The front column is shorter, so its first and last rows are empty (`0`).
 * Numbers grow outwards from the middle of each column, front column first.
 */
export const FORMATION_COLUMNS = {
  back: [24, 22, 20, 18, 17, 19, 21, 23, 25],
  middle: [15, 13, 11, 9, 8, 10, 12, 14, 16],
  front: [0, 6, 4, 2, 1, 3, 5, 7, 0],
} as const;

export type FormationColumn = keyof typeof FORMATION_COLUMNS;

/** Left to right as on screen: the frontline is the right-hand column. */
export const FORMATION_ORDER: readonly FormationColumn[] = ["back", "middle", "front"];

export const FORMATION_SLOTS = 25;

/**
 * 0 for slot 1 (falls last, casts first) up to 1 for the last slot (falls
 * first), so the board can tint slots without knowing the slot count.
 */
export function slotWeight(slot: number): number {
  if (!Number.isInteger(slot) || slot < 1 || slot > FORMATION_SLOTS) return 1;
  return (slot - 1) / (FORMATION_SLOTS - 1);
}

/** Collection items get their own chip style next to heroes. */
export const COLLECTION_ITEMS: ReadonlySet<string> = new Set([
  "Bicycle",
  "Boat",
  "Dagger",
  "David/Adam",
  "Grenade",
  "Hammer",
  "Horse",
  "Mask",
  "Noah’s Ark",
  "Pedal Car",
  "Replica",
  "Wings",
  "Wreath",
]);

/** A hero or Collection item; `note` is a key into `pickNotes` ("with item"). */
export type LayoutPick = { hero: string; note?: string };
export type LayoutCounter = { id: string; picks: LayoutPick[] };
export type LayoutGroup = { id: string; picks: LayoutPick[] };
export type LayoutRole = { id: string; groups: LayoutGroup[] };

export const BUILD_ZONES = ["key", "important", "other", "collection"] as const;
export type BuildZone = (typeof BUILD_ZONES)[number];

export type LayoutBuild = Record<BuildZone, LayoutPick[]> & { id: string; counters: LayoutCounter[] };
export type LayoutData = { builds: LayoutBuild[]; utility: LayoutRole[] };

export const LAYOUT_DATA = layoutData as LayoutData;

export type BuildText = {
  name: string;
  status: string;
  tagline: string;
  pros: readonly string[];
  cons: readonly string[];
  notes: readonly string[];
};

/** The keyed text maps in `guideEntries.heroLayouts` that the JSON points at. */
export type LayoutTexts = {
  buildTexts: Record<string, BuildText>;
  counterLabels: Record<string, string>;
  pickNotes: Record<string, string>;
  roleNames: Record<string, string>;
  groupLabels: Record<string, string>;
};

export const LAYOUT_TEXT_MAPS = ["buildTexts", "counterLabels", "pickNotes", "roleNames", "groupLabels"] as const;

/**
 * Reads the keyed maps out of a dictionary entry. The dictionary infers a
 * literal key per build, which is right for type-checking the languages
 * against each other but too narrow to index with an id from the JSON.
 */
export function layoutTexts(entry: { [key in (typeof LAYOUT_TEXT_MAPS)[number]]: object }): LayoutTexts {
  return {
    buildTexts: entry.buildTexts as Record<string, BuildText>,
    counterLabels: entry.counterLabels as Record<string, string>,
    pickNotes: entry.pickNotes as Record<string, string>,
    roleNames: entry.roleNames as Record<string, string>,
    groupLabels: entry.groupLabels as Record<string, string>,
  };
}

/** Every hero named anywhere in the layout, Collection items excluded. */
export function placedHeroes(data: LayoutData): Set<string> {
  const names = new Set<string>();
  const add = (picks: readonly LayoutPick[]) => {
    for (const pick of picks) if (!COLLECTION_ITEMS.has(pick.hero)) names.add(pick.hero);
  };
  for (const build of data.builds) {
    for (const zone of BUILD_ZONES) add(build[zone]);
    for (const counter of build.counters) add(counter.picks);
  }
  for (const role of data.utility) for (const group of role.groups) add(group.picks);
  return names;
}
