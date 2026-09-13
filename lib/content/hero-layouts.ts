/**
 * Language-independent parts of the Hero layouts guide. The text lives in
 * `guideEntries.heroLayouts` in every dictionary; hero and Collection names
 * there stay in English so all three languages point at the same in-game
 * names.
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

/** A hero or item, optionally with a translated qualifier such as "with item". */
export type LayoutPick = string | { name: string; note: string };

export function pickName(pick: LayoutPick): string {
  return typeof pick === "string" ? pick : pick.name;
}

export function pickNote(pick: LayoutPick): string {
  return typeof pick === "string" ? "" : pick.note;
}
