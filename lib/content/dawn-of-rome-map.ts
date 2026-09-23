/**
 * Dawn of Rome / Crown of the Nile planning map.
 *
 * Source: stitched in-game map, exported as `public/guilds/dawn-of-rome.webp`
 * (1024×935). Flat-top hex size and origin are calibrated to the printed grid;
 * settle markers sit on the white-label cities and villages (neutral until claimed).
 * The six outer camps are guild bases, same role as Trials of Odin villages.
 */

export const DAWN_OF_ROME_MAP = {
  image: "/guilds/dawn-of-rome.webp",
  width: 1024,
  height: 935,
  ratio: "1024 / 935",
  /** Flat-top hex: center → vertex, in source pixels. */
  hexSize: 24.1,
  /** Pixel center of axial (0, 0). */
  originX: 34,
  originY: 48,
} as const;

/** One of the six outer bases — same planning role as an Odin village. */
export type DawnBasePoint = { x: number; y: number };

/**
 * Base markers in percent of the map image, clockwise from the north camp.
 * Slot order matches `camps: 6` on the event def.
 */
export const DAWN_OF_ROME_BASES: readonly DawnBasePoint[] = [
  { x: 50, y: 11 },
  { x: 8, y: 42 },
  { x: 92, y: 42 },
  { x: 14, y: 78 },
  { x: 86, y: 78 },
  { x: 50, y: 92 },
];

/** A capturable neutral settlement drawn as a white label on the map. */
export type DawnSettlementDef = {
  id: string;
  /** Display name as on the map (French orthography kept where the art uses it). */
  label: string;
  /** Center of the label, in percent of the map image. */
  x: number;
  y: number;
};

/**
 * White-label cities, villages and passes. Not foreign guilds — neutral until a
 * guild claims them on the planning board.
 */
export const DAWN_OF_ROME_SETTLEMENTS: readonly DawnSettlementDef[] = [
  { id: "rome", label: "Rome", x: 48, y: 48 },
  { id: "sutrium", label: "Sutrium", x: 38, y: 16 },
  { id: "eretum", label: "Eretum", x: 58, y: 17 },
  { id: "tres", label: "Trés", x: 52, y: 28 },
  { id: "kailey", label: "Kailey", x: 62, y: 30 },
  { id: "tibur", label: "Tibur", x: 68, y: 36 },
  { id: "ceyni", label: "Ceyni", x: 82, y: 32 },
  { id: "arsium", label: "Arsium", x: 18, y: 38 },
  { id: "laurentum", label: "Laurentum", x: 22, y: 48 },
  { id: "ostie", label: "Ostie", x: 28, y: 54 },
  { id: "satricum", label: "Satricum", x: 20, y: 68 },
  { id: "ardea", label: "Ardea", x: 36, y: 62 },
  { id: "anagni", label: "Anagni", x: 78, y: 48 },
  { id: "alatri", label: "Alatri", x: 86, y: 54 },
  { id: "preneste", label: "Préneste", x: 72, y: 58 },
  { id: "aricie", label: "Aricie", x: 58, y: 64 },
  { id: "lanuvium", label: "Lanuvium", x: 78, y: 72 },
  { id: "citerne", label: "Citerne", x: 48, y: 78 },
  { id: "velletri", label: "Velletri", x: 62, y: 74 },
  { id: "passe-n", label: "Passe", x: 52, y: 38 },
  { id: "passe-w", label: "Passe", x: 38, y: 48 },
  { id: "passe-se", label: "Passe", x: 58, y: 56 },
];

export type Axial = { q: number; r: number };

function axialRound(q: number, r: number): Axial {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

/** Source-pixel center of an axial hex. */
export function dawnHexToPixel(q: number, r: number): { x: number; y: number } {
  const { hexSize: size, originX, originY } = DAWN_OF_ROME_MAP;
  return {
    x: size * (1.5 * q) + originX,
    y: size * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r) + originY,
  };
}

/** Axial hex under a source-pixel point. */
export function dawnPixelToHex(px: number, py: number): Axial {
  const { hexSize: size, originX, originY } = DAWN_OF_ROME_MAP;
  const x = px - originX;
  const y = py - originY;
  const q = ((2 / 3) * x) / size;
  const r = ((-1 / 3) * x + (Math.sqrt(3) / 3) * y) / size;
  return axialRound(q, r);
}

/** Flat-top hex corner points in source pixels (for SVG). */
export function dawnHexPolygon(q: number, r: number): string {
  const { x: cx, y: cy } = dawnHexToPixel(q, r);
  const size = DAWN_OF_ROME_MAP.hexSize;
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 180) * (60 * i);
    pts.push(`${cx + size * Math.cos(ang)},${cy + size * Math.sin(ang)}`);
  }
  return pts.join(" ");
}

export function dawnSettlementById(id: string): DawnSettlementDef | undefined {
  return DAWN_OF_ROME_SETTLEMENTS.find((row) => row.id === id);
}

/** Ownership of a painted hex or claimed settlement. */
export type DawnOwnerKind = "ours" | "ally" | "neutral";

export function dawnOwnerKind(
  ownerGuildId: string | null | undefined,
  ownGuildId: string,
  partnerGuildId?: string | null,
): DawnOwnerKind {
  if (!ownerGuildId) return "neutral";
  if (ownerGuildId === ownGuildId) return "ours";
  if (partnerGuildId && ownerGuildId === partnerGuildId) return "ally";
  return "ally";
}
