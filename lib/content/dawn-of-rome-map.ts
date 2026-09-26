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

/**
 * The two pictures of this board.
 *
 * Crown of the Nile is the same board seen the other way round: the same
 * lattice, the same tile for tile, the same places at the same sizes, only
 * mirrored left to right and drawn over Egypt with Egyptian names. Measured
 * the same way as Rome — the mirrored places land on the Nile buildings to
 * within a few pixels — so one set of tiles serves both and a guild's
 * territory survives a switch.
 *
 * Only the drawing differs: where the lattice starts on the picture, how tall
 * the picture is, and whether a column counts from the left or the right.
 */
export const ROME_MAP_VARIANTS = ["dawn-of-rome", "crown-of-the-nile"] as const;
export type RomeMapVariant = (typeof ROME_MAP_VARIANTS)[number];

export const ROME_MAPS: Record<
  RomeMapVariant,
  {
    image: string;
    width: number;
    height: number;
    ratio: string;
    originX: number;
    originY: number;
    /** Column 0 is drawn on the right. */
    mirrored: boolean;
  }
> = {
  "dawn-of-rome": {
    image: "/guilds/dawn-of-rome.webp",
    width: 1024,
    height: 935,
    ratio: "1024 / 935",
    originX: 9,
    originY: 16,
    mirrored: false,
  },
  "crown-of-the-nile": {
    image: "/guilds/crown-of-the-nile.webp",
    width: 1024,
    height: 975,
    ratio: "1024 / 975",
    originX: 8,
    originY: 62,
    mirrored: true,
  },
};

export function isRomeMapVariant(value: string): value is RomeMapVariant {
  return (ROME_MAP_VARIANTS as readonly string[]).includes(value);
}

/** The column a tile is drawn in, which is the other end on a mirrored map. */
function drawnCol(col: number, variant: RomeMapVariant): number {
  return ROME_MAPS[variant].mirrored ? DAWN_OF_ROME_MAP.maxCol - col : col;
}

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

/** Source-pixel centre of one tile on one of the two pictures. */
export function romeHexCenter(
  col: number,
  row: number,
  variant: RomeMapVariant = "dawn-of-rome",
): { x: number; y: number } {
  const { originX, originY } = ROME_MAPS[variant];
  const drawn = drawnCol(col, variant);
  // The half-row drop follows the column as it is drawn, so the mirrored map
  // keeps its own comb; `maxCol` is even, so parity survives the mirror anyway.
  const drop = Math.abs(drawn % 2) === 1 ? DAWN_ROW_PITCH / 2 : 0;
  return { x: originX + drawn * DAWN_COL_PITCH, y: originY + drop + row * DAWN_ROW_PITCH };
}

/**
 * The six corners of one tile, ready for an SVG `points` attribute. The tiles
 * are flat-top, like the ones printed on the map: a flat edge above and below,
 * a point left and right.
 */
export function romeHexPolygon(
  col: number,
  row: number,
  variant: RomeMapVariant = "dawn-of-rome",
): string {
  const { x, y } = romeHexCenter(col, row, variant);
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
export function romePixelToHex(
  px: number,
  py: number,
  variant: RomeMapVariant = "dawn-of-rome",
): RomeTile {
  const map = ROME_MAPS[variant];
  const drawnGuess = whole((px - map.originX) / DAWN_COL_PITCH);
  const guess = drawnCol(drawnGuess, variant);
  let best: RomeTile = { col: guess, row: 0 };
  let bestDistance = Infinity;
  const step = map.mirrored ? -1 : 1;
  for (const col of [guess - step, guess, guess + step]) {
    const columnTop = romeHexCenter(col, 0, variant).y;
    const near = whole((py - columnTop) / DAWN_ROW_PITCH);
    for (const row of [near - 1, near, near + 1]) {
      const centre = romeHexCenter(col, row, variant);
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
 * The colours a territory can wear. 1 is our guild, 2 the guild we are allied
 * with, and the rest are for the guilds on the other side, so one board can
 * show who holds what.
 */
export const DAWN_TONES = [1, 2, 3, 4, 5, 6] as const;
export type DawnTone = (typeof DAWN_TONES)[number];

export function isDawnTone(value: number): value is DawnTone {
  return (DAWN_TONES as readonly number[]).includes(value);
}

/**
 * The quick fills on the board's toolbar. A half is decided by the middle of
 * the picture; a structure always goes whole, by where its own middle falls,
 * because its hexes are one target and half a city in another colour would be
 * a lie about who holds it.
 */
export type RomeFill = "all" | "west" | "east" | "north" | "south";

const MAP_MID_X = DAWN_OF_ROME_MAP.width / 2;
const MAP_MID_Y = DAWN_OF_ROME_MAP.height / 2;

function inHalf(fill: RomeFill, x: number, y: number): boolean {
  if (fill === "all") return true;
  if (fill === "west") return x < MAP_MID_X;
  if (fill === "east") return x >= MAP_MID_X;
  if (fill === "north") return y < MAP_MID_Y;
  return y >= MAP_MID_Y;
}

/** Where a structure sits as a whole: the mean of its hex centres. */
function structureCentre(structure: RomeStructure): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const [col, row] of structure.tiles) {
    const centre = romeHexCenter(col, row);
    x += centre.x;
    y += centre.y;
  }
  return { x: x / structure.tiles.length, y: y / structure.tiles.length };
}

/** Every tile a quick fill should paint. */
export function romeFillTiles(fill: RomeFill): RomeTile[] {
  const tiles: RomeTile[] = [];
  const wholeStructures = new Set<number>();
  for (let i = 0; i < ROME_STRUCTURES.length; i++) {
    const { x, y } = structureCentre(ROME_STRUCTURES[i]);
    if (inHalf(fill, x, y)) wholeStructures.add(i);
  }
  for (const { col, row } of romeTiles()) {
    if (!isRomeClickable(col, row)) continue;
    const index = STRUCTURE_OF.get(tileKey(col, row));
    if (index !== undefined) {
      if (wholeStructures.has(index)) tiles.push({ col, row });
      continue;
    }
    const centre = romeHexCenter(col, row);
    if (inHalf(fill, centre.x, centre.y)) tiles.push({ col, row });
  }
  return tiles;
}

/** Where a place sits on the picture, in percent, for its label or marker. */
export function romeStructurePoint(
  structure: RomeStructure,
  variant: RomeMapVariant = "dawn-of-rome",
): { x: number; y: number } {
  const map = ROME_MAPS[variant];
  let x = 0;
  let y = 0;
  for (const [col, row] of structure.tiles) {
    const centre = romeHexCenter(col, row, variant);
    x += centre.x;
    y += centre.y;
  }
  return {
    x: (x / structure.tiles.length / map.width) * 100,
    y: (y / structure.tiles.length / map.height) * 100,
  };
}

/** The neutral places the board names, with where to write each one. */
export function romeNamedPlaces(
  variant: RomeMapVariant = "dawn-of-rome",
): { structure: RomeStructure; point: { x: number; y: number } }[] {
  return ROME_STRUCTURES.filter((structure) => structure.name).map((structure) => ({
    structure,
    point: romeStructurePoint(structure, variant),
  }));
}

/**
 * The six outposts, in slot order, as percentages of whichever picture is on
 * screen. They are the `home` structures themselves rather than a second list
 * of coordinates, so a slot cannot drift away from the place it names.
 */
function homesInSlotOrder(): RomeStructure[] {
  const homes = ROME_STRUCTURES.filter((structure) => structure.kind === "home");
  // Always ranked on the unmirrored board, so a slot keeps its place when the
  // picture flips: top, then the upper pair left to right, the lower pair, and
  // the bottom one.
  const at = (structure: RomeStructure) => romeStructurePoint(structure, "dawn-of-rome");
  const byRow = [...homes].sort((a, b) => at(a).y - at(b).y);
  const [top, ...rest] = byRow;
  const bottom = rest.pop();
  const upper = rest.slice(0, 2).sort((a, b) => at(a).x - at(b).x);
  const lower = rest.slice(2).sort((a, b) => at(a).x - at(b).x);
  return [top, ...upper, ...lower, bottom].filter(Boolean) as RomeStructure[];
}

export function romeBasePoints(
  variant: RomeMapVariant = "dawn-of-rome",
): { x: number; y: number }[] {
  return homesInSlotOrder().map((structure) => romeStructurePoint(structure, variant));
}
