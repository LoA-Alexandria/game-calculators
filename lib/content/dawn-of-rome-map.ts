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
 */

export const DAWN_OF_ROME_MAP = {
  image: "/guilds/dawn-of-rome.webp",
  width: 1024,
  height: 935,
  ratio: "1024 / 935",
  /** Distance between two centres in the same row, in source pixels. */
  pitchX: 74.5,
  /** Distance between two rows, in source pixels. */
  pitchY: 59.5,
  /** Centre of tile (0, 0). */
  originX: 6.5,
  originY: 93,
  /** The tiles that cover the picture; odd rows start half a column left. */
  minCol: -1,
  maxCol: 13,
  minRow: -2,
  maxRow: 15,
} as const;

/** Point to point, top to bottom. Rows overlap by a quarter, as hexes do. */
export const DAWN_HEX_HEIGHT = DAWN_OF_ROME_MAP.pitchY / 0.75;

export type RomeTile = { col: number; row: number };

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Source-pixel centre of one tile. */
export function romeHexCenter(col: number, row: number): { x: number; y: number } {
  const { pitchX, pitchY, originX, originY } = DAWN_OF_ROME_MAP;
  const shift = Math.abs(row % 2) === 1 ? pitchX / 2 : 0;
  return { x: originX + shift + col * pitchX, y: originY + row * pitchY };
}

/** The six corners of one tile, ready for an SVG `points` attribute. */
export function romeHexPolygon(col: number, row: number): string {
  const { x, y } = romeHexCenter(col, row);
  const w = DAWN_OF_ROME_MAP.pitchX / 2;
  const h = DAWN_HEX_HEIGHT;
  return [
    [x, y - h / 2],
    [x + w, y - h / 4],
    [x + w, y + h / 4],
    [x, y + h / 2],
    [x - w, y + h / 4],
    [x - w, y - h / 4],
  ]
    .map(([px, py]) => `${round(px)},${round(py)}`)
    .join(" ");
}

/**
 * The tile under a point. The nearest row is not always the right one, because
 * of the slanted edges, so the neighbours are tried too and the closest centre
 * wins — with the vertical axis squashed to match the drawn shape.
 */
export function romePixelToHex(px: number, py: number): RomeTile {
  const guess = Math.round((py - DAWN_OF_ROME_MAP.originY) / DAWN_OF_ROME_MAP.pitchY);
  let best: RomeTile = { col: 0, row: guess };
  let bestDistance = Infinity;
  for (const row of [guess - 1, guess, guess + 1]) {
    const rowStart = romeHexCenter(0, row).x;
    const near = Math.round((px - rowStart) / DAWN_OF_ROME_MAP.pitchX);
    for (const col of [near - 1, near, near + 1]) {
      const centre = romeHexCenter(col, row);
      const dx = px - centre.x;
      const dy = ((py - centre.y) * DAWN_OF_ROME_MAP.pitchX) / DAWN_HEX_HEIGHT;
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

/** Whether a tile belongs to the board at all. */
export function isRomeTile(col: number, row: number): boolean {
  const { minCol, maxCol, minRow, maxRow } = DAWN_OF_ROME_MAP;
  return col >= minCol && col <= maxCol && row >= minRow && row <= maxRow;
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
