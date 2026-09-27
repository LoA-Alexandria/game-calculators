/**
 * Structured guide data written on the site, laid over the file baked into the
 * build — the rosters and item tables in `lib/data/*.json`, not just prose.
 *
 * Prose can only ever look wrong. A malformed roster can stop a page rendering
 * at all, because the components walk it: `cryptide.skills.map(...)` on
 * something that is not an array throws. So nothing from the database is
 * trusted here. Every payload is checked against the shape the page expects,
 * and anything that does not fit is dropped whole in favour of the committed
 * file. There is no partial acceptance: half a roster is worse than the old one.
 *
 * Pictures are still files under `public/`. An entry may only name one that is
 * committed; uploading from the site needs Storage and comes separately.
 */

import { CRYPTIDES_DATA, CRYPTID_TOWERS, TALENT_MATERIALS, type CryptidesData } from "./cryptides.ts";

/** A guide whose data file can be replaced from the site. */
export type GuideDataKind = "cryptides";

type Checker<T> = (value: unknown) => value is T;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFile(value: unknown): value is string {
  // A picture is a path inside `public/<guide>/`. No absolute URL, no scheme,
  // no walking up out of the folder: those are how an override would start
  // pointing somewhere it should not.
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 120 &&
    !value.includes("..") &&
    !value.includes("//") &&
    !value.startsWith("/") &&
    /^[a-z0-9][a-z0-9/_-]*\.webp$/.test(value)
  );
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,59}$/.test(value);
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1_000_000;
}

function isCryptidesData(value: unknown): value is CryptidesData {
  if (!isRecord(value)) return false;
  const talent = value.talent;
  if (!isRecord(talent)) return false;
  for (const key of ["unlockCost", "dropAmount", "dropEveryLevels"]) {
    if (!isWholeNumber(talent[key])) return false;
  }
  if (!Array.isArray(value.cryptides) || value.cryptides.length === 0) return false;

  const seen = new Set<string>();
  for (const row of value.cryptides) {
    if (!isRecord(row)) return false;
    if (!isId(row.id) || seen.has(row.id)) return false;
    seen.add(row.id);
    if (typeof row.name !== "string" || !row.name.trim()) return false;
    if (typeof row.rarity !== "string" || !row.rarity.trim()) return false;
    if (!(CRYPTID_TOWERS as readonly unknown[]).includes(row.tower)) return false;
    if (!(TALENT_MATERIALS as readonly unknown[]).includes(row.talentMaterial)) return false;
    if (!isFile(row.image)) return false;

    if (!Array.isArray(row.skills) || !Array.isArray(row.foods)) return false;
    for (const skill of row.skills) {
      if (!isRecord(skill) || !isId(skill.id) || !isFile(skill.image)) return false;
    }
    for (const food of row.foods) {
      if (!isRecord(food) || !isId(food.id) || !isFile(food.image) || !isWholeNumber(food.growth)) return false;
    }
    // Stages are optional; a Cryptide nobody has photographed has none.
    if (row.stages !== undefined) {
      if (!Array.isArray(row.stages)) return false;
      for (const art of row.stages) {
        if (!isRecord(art) || typeof art.stage !== "string" || !isFile(art.image)) return false;
      }
    }
  }
  return true;
}

const GUIDE_DATA: Record<GuideDataKind, { committed: unknown; check: Checker<unknown> }> = {
  cryptides: { committed: CRYPTIDES_DATA, check: isCryptidesData as Checker<unknown> },
};

export const GUIDE_DATA_KINDS = Object.keys(GUIDE_DATA) as GuideDataKind[];

/** The committed file, as the build carries it. */
export function committedData(kind: GuideDataKind): unknown {
  return GUIDE_DATA[kind].committed;
}

/**
 * The data the page should use: the payload when it fits the shape, otherwise
 * the committed file. Never a mixture.
 */
export function resolveData(kind: GuideDataKind, payload: unknown): unknown {
  const entry = GUIDE_DATA[kind];
  if (payload == null) return entry.committed;
  return entry.check(payload) ? payload : entry.committed;
}

/** Whether a payload would be used, for the editor to say so before saving. */
export function dataFits(kind: GuideDataKind, payload: unknown): boolean {
  return GUIDE_DATA[kind].check(payload);
}

export function isGuideDataKind(value: string): value is GuideDataKind {
  return Object.hasOwn(GUIDE_DATA, value);
}
