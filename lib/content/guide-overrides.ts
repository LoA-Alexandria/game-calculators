/**
 * Guide text written on the site, laid over the text baked into the build.
 *
 * The repository stays the base. Every guide renders from what the build
 * carries, with no database involved; a row in `guide_content` replaces only
 * the fields it actually names. That way an override cannot empty a guide, a
 * slow database cannot delay one, and the tests that pin the committed data
 * keep their grip.
 *
 * Only the plain text of a guide travels this way — headings, paragraphs, the
 * credit line. Structured data (rosters, item tables, anything with a picture
 * beside it) stays in the repository, because a picture needs a file and a
 * number wants a test.
 */

/** Fields an override may carry. Anything else in a payload is ignored. */
export const OVERRIDABLE_FIELDS = [
  "title",
  "summary",
  "intro",
  "credit",
  "creditDate",
  "status",
  "note",
  "sections",
  // The names of the things a guide lists — a Cryptide and its skills, a hero,
  // a painting, a play. They live here rather than in the data file, because
  // the file is one per guide and these are one per language, and every guide
  // prefers them to the file when it has them.
  "anecdoteTexts",
  "buildTexts",
  "buildingTexts",
  "catalogTexts",
  "collectionTexts",
  "cryptideTexts",
  "eventTexts",
  "goddessTexts",
  "heroTexts",
  "linkTexts",
  "optionTexts",
  "phaseTexts",
  "playTexts",
  "setupTexts",
  "skinTexts",
] as const;

/** The fields above that hold a tree of names rather than one line of text. */
const TEXT_MAPS = new Set<string>([
  "anecdoteTexts", "buildTexts", "buildingTexts", "catalogTexts", "collectionTexts",
  "cryptideTexts", "eventTexts", "goddessTexts", "heroTexts", "linkTexts",
  "optionTexts", "phaseTexts", "playTexts", "setupTexts", "skinTexts",
]);
export type OverridableField = (typeof OVERRIDABLE_FIELDS)[number];

export type GuideSection = { heading: string; body: string[] };
export type GuideOverride = Partial<Record<OverridableField, unknown>>;

/** A row of `guide_content` or `guide_drafts` as the browser reads it. */
export type GuideContentRow = {
  guide_id: string;
  locale: string;
  payload: GuideOverride | null;
};

/**
 * A tree of names: an entry, then its rows, then their fields. Only strings at
 * the leaves, because a renderer walks these and anything else is what breaks
 * a page.
 */
function isTextTree(value: unknown, depth = 0): boolean {
  if (typeof value === "string") return true;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  // The real nesting is four objects deep before the words: the map of
  // entries, one entry, its skills or foods, then one row. Five refuses
  // anything past that without refusing the shape that exists.
  if (depth >= 5) return false;
  return Object.values(value).every((child) => isTextTree(child, depth + 1));
}

function isSection(value: unknown): value is GuideSection {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.heading === "string" &&
    Array.isArray(row.body) &&
    row.body.every((line) => typeof line === "string")
  );
}

/**
 * The part of a payload that is safe to use: known fields, right shapes, and
 * nothing empty. An empty string is dropped rather than applied, so a cleared
 * box in the editor falls back to the committed text instead of blanking the
 * guide.
 */
export function readOverride(payload: unknown): GuideOverride {
  if (typeof payload !== "object" || payload === null) return {};
  const row = payload as Record<string, unknown>;
  const out: GuideOverride = {};
  for (const field of OVERRIDABLE_FIELDS) {
    const value = row[field];
    if (field === "sections") {
      if (Array.isArray(value) && value.every(isSection)) out.sections = value;
      continue;
    }
    if (TEXT_MAPS.has(field)) {
      if (isTextTree(value) && typeof value === "object") out[field] = value;
      continue;
    }
    if (typeof value === "string" && value.trim()) out[field] = value;
  }
  return out;
}

/**
 * The guide as the page should show it. `base` is what the build carries and
 * is always the fallback, field by field.
 */
export function applyOverride<T extends object>(base: T, payload: unknown): T {
  const override = readOverride(payload);
  if (Object.keys(override).length === 0) return base;
  const merged = { ...base } as Record<string, unknown>;
  for (const [field, value] of Object.entries(override)) {
    // A guide that never had the field cannot gain one this way: the renderers
    // read a fixed shape, and an unexpected key would simply be ignored.
    if (field in merged) merged[field] = value;
  }
  return merged as T;
}

/** Overrides keyed by guide, for one language. */
export function overridesByGuide(rows: readonly GuideContentRow[], locale: string): Map<string, GuideOverride> {
  const out = new Map<string, GuideOverride>();
  for (const row of rows) {
    if (row.locale !== locale) continue;
    const override = readOverride(row.payload);
    if (Object.keys(override).length > 0) out.set(row.guide_id, override);
  }
  return out;
}

/** What the editor sends: only the fields that differ from the committed text. */
export function overrideFrom<T extends object>(base: T, edited: T): GuideOverride {
  const out: GuideOverride = {};
  const from = base as Record<string, unknown>;
  const to = edited as Record<string, unknown>;
  for (const field of OVERRIDABLE_FIELDS) {
    if (!(field in to)) continue;
    if (JSON.stringify(to[field]) === JSON.stringify(from[field])) continue;
    const value = to[field];
    if (field === "sections") {
      if (Array.isArray(value) && value.every(isSection)) out.sections = value;
      continue;
    }
    if (TEXT_MAPS.has(field)) {
      if (isTextTree(value) && typeof value === "object") out[field] = value;
      continue;
    }
    if (typeof value === "string" && value.trim()) out[field] = value;
  }
  return out;
}
