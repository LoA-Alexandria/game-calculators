/**
 * The Cryptid layout guide: the order the four Cryptides go into a fight, the
 * levels a Tower asks of a troop, and which Cryptide to evolve first.
 *
 * Source: Autumn (Ice, S12), shared on Discord on 6 and 11 August 2026. The
 * Cryptides themselves — names, portraits, skills — come from the Cryptides
 * guide, so this file holds only the order and nothing that is already there.
 *
 * Everything readable (the reason for each slot, the Tower levels, the
 * evolution steps) lives in `guideEntries.cryptidLayout` under keys this file
 * points at, the way the other layout guides do it.
 */

import { CRYPTIDES, type Cryptide } from "./cryptides.ts";

/**
 * The opening line-up, written as groups rather than four numbered slots.
 *
 * That is how it was given: Cerberus and Caladrius were named together for the
 * first two spots, without saying which of the two leads. Inventing an order
 * between them would be putting words in the guide's mouth, so the pair stays
 * a pair and the slot numbers are written out as the group covers them.
 */
export const CRYPTID_FORMATION: readonly {
  id: string;
  slots: readonly number[];
  cryptides: readonly string[];
}[] = [
  { id: "opening", slots: [1, 2], cryptides: ["cerberus", "caladrius"] },
  { id: "nidhogg", slots: [3], cryptides: ["nidhogg"] },
  { id: "sleipnir", slots: [4], cryptides: ["sleipnir"] },
];

/**
 * The order to raise them in, as Autumn gave it on 11 August 2026.
 *
 * Each step names the Cryptides it is about, so the page can show them rather
 * than only spell them out. "Then the other two" is written out as Caladrius
 * and Sleipnir, which is what is left after the two before it.
 */
export const CRYPTID_PRIORITY: readonly {
  id: string;
  cryptides: readonly string[];
  /** The rarity the step pushes them to. */
  target: "SSR" | "UR";
  /** The step spells out an order, so its pictures are numbered. */
  ordered?: boolean;
}[] = [
  { id: "allSsr", cryptides: ["cerberus", "caladrius", "nidhogg", "sleipnir"], target: "SSR" },
  { id: "order", cryptides: ["cerberus", "caladrius", "nidhogg", "sleipnir"], target: "SSR", ordered: true },
  { id: "nidhoggUr", cryptides: ["nidhogg"], target: "UR" },
  { id: "cerberusUr", cryptides: ["cerberus"], target: "UR" },
  { id: "rest", cryptides: ["caladrius", "sleipnir"], target: "UR" },
];

/** One Cryptide by its id in the Cryptides guide. */
export function cryptideById(id: string): Cryptide | undefined {
  return CRYPTIDES.find((cryptide) => cryptide.id === id);
}

/** Every Cryptide the formation names, in slot order. */
export function formationCryptides(): Cryptide[] {
  return CRYPTID_FORMATION.flatMap((group) =>
    group.cryptides.map(cryptideById).filter((cryptide): cryptide is Cryptide => Boolean(cryptide)),
  );
}
