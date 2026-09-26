/**
 * Dawn of Rome / Crown of the Nile planning map.
 *
 * The picture is `public/guilds/dawn-of-rome.webp` (1024×935), the region
 * around Rome without the game's own labels — the cities carry different names
 * in every client language, so the board stays wordless and a guild writes its
 * own names on the places it cares about.
 *
 * The grid below is measured from the printed hexes, not guessed: the lattice
 * repeats every 74.5 px across and 59.5 px down, every second row shifted half
 * a column, with the first row of centres at y = 93. The drawn hexes are
 * slightly squashed, so the height comes from the row pitch rather than from a
 * regular hexagon.
 *
 * Guild-planning colour key (see `dawn-of-rome-tile-data.ts`):
 * - blue hexes — not clickable (coast, mountains, volcano, impassable)
 * - red hexes — clickable plains; structure groups on red share one paint target
 * - outside the painted board — not clickable
 */

import {
  ROME_BLOCKED_TILES,
  ROME_OUTSIDE_TILES,
  ROME_STRUCTURES,
  type RomeStructure,
  type RomeStructureKind,
  type RomeTileRef,
} from "./dawn-of-rome-tile-data.ts";

export const DAWN_OF_ROME_MAP = {
  image: "/guilds/dawn-of-rome.webp",
  width: 1024,
  height: 935,
  ratio: "1024 / 935",
  /** Point to point across a tile, in source pixels. */
  hexWidth: 48,
  /** Flat edge to flat edge, top to bottom. The art squashes them a little. */
  hexHeight: 35.5,
  /** Centre of tile (0, 0). */
  originX: 9,
  originY: 16,
  /** The tiles that cover the picture; odd columns sit half a row lower. */
  minCol: 0,
  maxCol: 28,
  minRow: -1,
  maxRow: 26,
} as const;

/** Distance between two columns: a flat-top tile overlaps its neighbour by a quarter. */
export const DAWN_COL_PITCH = DAWN_OF_ROME_MAP.hexWidth * 0.75;
/** Distance between two tiles in the same column. */
export const DAWN_ROW_PITCH = DAWN_OF_ROME_MAP.hexHeight;

export type RomeTile = { col: number; row: number };

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Math.round hands back -0 just left of the origin, and -0 keys a tile wrong. */
function whole(value: number): number {
  const rounded = Math.round(value);
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** Source-pixel centre of one tile. */
export function romeHexCenter(col: number, row: number): { x: number; y: number } {
  const { originX, originY } = DAWN_OF_ROME_MAP;
  const drop = Math.abs(col % 2) === 1 ? DAWN_ROW_PITCH / 2 : 0;
  return { x: originX + col * DAWN_COL_PITCH, y: originY + drop + row * DAWN_ROW_PITCH };
}

/**
 * The six corners of one tile, ready for an SVG `points` attribute. The tiles
 * are flat-top, like the ones printed on the map: a flat edge above and below,
 * a point left and right.
 */
export function romeHexPolygon(col: number, row: number): string {
  const { x, y } = romeHexCenter(col, row);
  const w = DAWN_OF_ROME_MAP.hexWidth;
  const h = DAWN_OF_ROME_MAP.hexHeight;
  return [
    [x - w / 4, y - h / 2],
    [x + w / 4, y - h / 2],
    [x + w / 2, y],
    [x + w / 4, y + h / 2],
    [x - w / 4, y + h / 2],
    [x - w / 2, y],
  ]
    .map(([px, py]) => `${round(px)},${round(py)}`)
    .join(" ");
}

/**
 * The tile under a point. The nearest column is not always the right one,
 * because of the slanted corners, so the neighbours are tried too and the
 * closest centre wins — with the axes scaled so the comparison matches the
 * drawn shape rather than a circle.
 */
export function romePixelToHex(px: number, py: number): RomeTile {
  const guess = whole((px - DAWN_OF_ROME_MAP.originX) / DAWN_COL_PITCH);
  let best: RomeTile = { col: guess, row: 0 };
  let bestDistance = Infinity;
  for (const col of [guess - 1, guess, guess + 1]) {
    const columnTop = romeHexCenter(col, 0).y;
    const near = whole((py - columnTop) / DAWN_ROW_PITCH);
    for (const row of [near - 1, near, near + 1]) {
      const centre = romeHexCenter(col, row);
      const dx = px - centre.x;
      const dy = ((py - centre.y) * DAWN_OF_ROME_MAP.hexWidth) / DAWN_OF_ROME_MAP.hexHeight;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { col, row };
      }
    }
  }
  return best;
}

/** Every tile of the board, row by row. */
export function romeTiles(): RomeTile[] {
  const tiles: RomeTile[] = [];
  for (let row = DAWN_OF_ROME_MAP.minRow; row <= DAWN_OF_ROME_MAP.maxRow; row++) {
    for (let col = DAWN_OF_ROME_MAP.minCol; col <= DAWN_OF_ROME_MAP.maxCol; col++) {
      tiles.push({ col, row });
    }
  }
  return tiles;
}

/** Whether a tile belongs to the lattice at all. */
export function isRomeTile(col: number, row: number): boolean {
  const { minCol, maxCol, minRow, maxRow } = DAWN_OF_ROME_MAP;
  return col >= minCol && col <= maxCol && row >= minRow && row <= maxRow;
}

export type RomeTileKind = "outside" | "blocked" | "plain" | "structure";

function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

function refKey([col, row]: RomeTileRef): string {
  return tileKey(col, row);
}

const OUTSIDE = new Set(ROME_OUTSIDE_TILES.map(refKey));
const BLOCKED = new Set(ROME_BLOCKED_TILES.map(refKey));
const STRUCTURE_OF = new Map<string, number>();
for (let i = 0; i < ROME_STRUCTURES.length; i++) {
  for (const ref of ROME_STRUCTURES[i].tiles) {
    STRUCTURE_OF.set(refKey(ref), i);
  }
}

/**
 * Planning-key role of one lattice tile.
 *
 * A structure wins over the terrain key: a few of them stand on hexes the
 * colour pass had marked impassable (the outpost at (1, 6), the village at
 * (18, 3)), and a place you can take has to be clickable wherever it sits.
 */
export function romeTileKind(col: number, row: number): RomeTileKind {
  if (!isRomeTile(col, row)) return "outside";
  const key = tileKey(col, row);
  if (STRUCTURE_OF.has(key)) return "structure";
  if (OUTSIDE.has(key)) return "outside";
  if (BLOCKED.has(key)) return "blocked";
  return "plain";
}

/** The structure a tile belongs to, or null for open land. */
export function romeStructureAt(col: number, row: number): RomeStructure | null {
  const index = STRUCTURE_OF.get(tileKey(col, row));
  return index === undefined ? null : ROME_STRUCTURES[index];
}

/** What kind of place a tile is, counting open land as its own kind. */
export type RomePlaceKind = RomeStructureKind | "plain";

export function romePlaceKind(col: number, row: number): RomePlaceKind | null {
  const kind = romeTileKind(col, row);
  if (kind === "outside" || kind === "blocked") return null;
  return romeStructureAt(col, row)?.kind ?? "plain";
}

/** Officers may paint this tile (plain hex or any hex of a blue structure). */
export function isRomeClickable(col: number, row: number): boolean {
  const kind = romeTileKind(col, row);
  return kind === "plain" || kind === "structure";
}

/**
 * Every hex that should change when this one is painted. Blue structures share
 * one tone across the whole group; plain tiles only touch themselves.
 */
export function romePaintTargets(col: number, row: number): RomeTile[] {
  if (!isRomeClickable(col, row)) return [];
  const structure = romeStructureAt(col, row);
  if (!structure) return [{ col, row }];
  return structure.tiles.map(([c, r]) => ({ col: c, row: r }));
}

/**
 * The six outposts at the edge of the map, in percent of the picture. They are
 * the player bases: a guild holds one, exactly like a village in Trials of
 * Odin, and the slot order matches `camps: 6` on the event def.
 */
export const DAWN_OF_ROME_BASES: readonly { x: number; y: number }[] = [
  { x: 50, y: 2.7 },
  { x: 10.3, y: 25.7 },
  { x: 90.3, y: 25.1 },
  { x: 10.3, y: 67.4 },
  { x: 90.8, y: 67.2 },
  { x: 50, y: 92 },
];

/**
 * The colours a territory can wear. 1 is our guild, 2 the guild we are allied
 * with, and the rest are for the guilds on the other side, so one board can
 * show who holds what.
 */
export const DAWN_TONES = [1, 2, 3, 4, 5, 6] as const;
export type DawnTone = (typeof DAWN_TONES)[number];

export function isDawnTone(value: number): value is DawnTone {
  return (DAWN_TONES as readonly number[]).includes(value);
}
