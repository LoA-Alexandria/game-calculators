/**
 * Prestige on the Dawn of Rome board.
 *
 * Every hex a guild holds pays prestige for as long as it holds it. Open land
 * pays per hex; a structure pays once for the whole place, because its hexes
 * are one target — painting any of them paints them all, and the game quotes
 * one rate per outpost or city rather than one per hex.
 *
 * Only two rates are known so far. The rest are `null` on purpose: a missing
 * rate reads as "not known yet" everywhere, rather than quietly counting as
 * zero and making a total look complete when it is not. Fill them in below and
 * nothing else has to change.
 */

import {
  romePlaceKind,
  romeStructureAt,
  type RomePlaceKind,
} from "./dawn-of-rome-map.ts";
import { ROME_STRUCTURES } from "./dawn-of-rome-tile-data.ts";

/** Prestige per minute, per structure — and for `plain`, per hex. */
export const ROME_PRESTIGE_PER_MINUTE: Record<RomePlaceKind, number | null> = {
  home: 400,
  large: 360,
  rome: null,
  gate: null,
  medium: null,
  small: null,
  plain: null,
};

/** The order the board lists places in: the richest first, land last. */
export const ROME_PLACE_ORDER: readonly RomePlaceKind[] = [
  "rome",
  "home",
  "large",
  "medium",
  "gate",
  "small",
  "plain",
];

export type PaintedHex = { q: number; r: number; tone: number };

export type RomePrestigeLine = {
  kind: RomePlaceKind;
  /** Structures held, or hexes held for open land. */
  held: number;
  perMinute: number | null;
  /** `held × perMinute`, or null while the rate is unknown. */
  total: number | null;
};

export type RomePrestigeTally = {
  tone: number;
  lines: readonly RomePrestigeLine[];
  /** Sum over the kinds whose rate is known. */
  perMinute: number;
  /** True when something held has no rate yet, so the total is a floor. */
  incomplete: boolean;
  /** Hexes held, counting every hex of every structure. */
  hexes: number;
};

function structureIndex(): Map<string, number> {
  const byTile = new Map<string, number>();
  for (let i = 0; i < ROME_STRUCTURES.length; i++) {
    for (const [col, row] of ROME_STRUCTURES[i].tiles) byTile.set(`${col},${row}`, i);
  }
  return byTile;
}

const STRUCTURE_INDEX = structureIndex();

/**
 * What one tone holds, and what it earns a minute.
 *
 * A structure counts once, however many of its hexes are painted — a group is
 * painted as a whole, and a half-painted one left over from an older board
 * should not pay twice.
 */
export function romePrestigeFor(
  painted: readonly PaintedHex[],
  tone: number,
): RomePrestigeTally {
  const held = new Map<RomePlaceKind, number>();
  const seenStructures = new Set<number>();
  let hexes = 0;

  for (const hex of painted) {
    if (hex.tone !== tone) continue;
    const kind = romePlaceKind(hex.q, hex.r);
    if (!kind) continue;
    hexes += 1;
    if (kind === "plain") {
      held.set("plain", (held.get("plain") ?? 0) + 1);
      continue;
    }
    const index = STRUCTURE_INDEX.get(`${hex.q},${hex.r}`);
    if (index === undefined || seenStructures.has(index)) continue;
    seenStructures.add(index);
    held.set(kind, (held.get(kind) ?? 0) + 1);
  }

  const lines: RomePrestigeLine[] = [];
  let perMinute = 0;
  let incomplete = false;
  for (const kind of ROME_PLACE_ORDER) {
    const count = held.get(kind) ?? 0;
    if (count === 0) continue;
    const rate = ROME_PRESTIGE_PER_MINUTE[kind];
    const total = rate === null ? null : count * rate;
    if (total === null) incomplete = true;
    else perMinute += total;
    lines.push({ kind, held: count, perMinute: rate, total });
  }

  return { tone, lines, perMinute, incomplete, hexes };
}

/** Every tone that holds something, richest first. */
export function romePrestigeBoard(painted: readonly PaintedHex[]): RomePrestigeTally[] {
  const tones = [...new Set(painted.map((hex) => hex.tone))].filter((tone) => tone > 0);
  return tones
    .map((tone) => romePrestigeFor(painted, tone))
    .filter((tally) => tally.hexes > 0)
    .sort((a, b) => b.perMinute - a.perMinute || b.hexes - a.hexes || a.tone - b.tone);
}

/** Prestige earned over a stretch of time, for the board's running total. */
export function romePrestigeOver(perMinute: number, minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.round(perMinute * minutes);
}

/** Which structure a hex belongs to, for the map's own labels. */
export function romePlaceOf(col: number, row: number) {
  return romeStructureAt(col, row);
}
