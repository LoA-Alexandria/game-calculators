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
  // Headings and ledes a text-only guide carries beside its sections.
  "adsHeading",
  "adsLede",
  "spendHeading",
  "spendLede",
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

/**
 * What a row of `guide_content` is keyed by. Guides keep their dictionary key;
 * an event is prefixed, because the two catalogues are numbered apart and
 * nothing says an event may not one day be called what a guide is called.
 */
export function entryKey(catalog: "guideEntries" | "eventGuideEntries", id: string): string {
  return catalog === "eventGuideEntries" ? `event:${id}` : id;
}

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

/**
 * The committed names with the published ones laid over them, leaf by leaf.
 *
 * A payload carries only the names somebody changed, so replacing the whole
 * map would take every other name with it: the guide would fall back to
 * identifiers, and the editor — which opens on what is published — would show
 * empty boxes and save those blanks over the rest.
 */
export function mergeTexts<T>(committed: T, override: unknown): T {
  if (typeof override === "string") return override as unknown as T;
  if (typeof override !== "object" || override === null || Array.isArray(override)) return committed;
  const base = (typeof committed === "object" && committed !== null ? committed : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = mergeTexts(base[key], value);
  }
  return out as unknown as T;
}

/**
 * What an editor actually changed in a tree of names, and nothing else.
 *
 * A name back at the committed one, or an empty box, leaves no trace: that is
 * how the site returns to the built version. A tree with nothing left in it
 * comes back as `undefined`, which drops the field.
 */
function prunedTexts(committed: unknown, edited: unknown): unknown {
  if (typeof edited === "string") {
    if (!edited.trim()) return undefined;
    if (typeof committed === "string" && committed.trim() === edited.trim()) return undefined;
    return edited;
  }
  if (typeof edited !== "object" || edited === null || Array.isArray(edited)) return undefined;
  const base = (typeof committed === "object" && committed !== null ? committed : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(edited)) {
    const kept = prunedTexts(base[key], value);
    if (kept !== undefined) out[key] = kept;
  }
  return Object.keys(out).length > 0 ? out : undefined;
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
    if (!(field in merged)) continue;
    merged[field] = TEXT_MAPS.has(field) ? mergeTexts(merged[field], value) : value;
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

/** The one value a field may carry, or `undefined` when it may not carry one. */
function cleanField(field: string, value: unknown): unknown {
  if (field === "sections") {
    return Array.isArray(value) && value.every(isSection) ? value : undefined;
  }
  if (TEXT_MAPS.has(field)) {
    if (value === undefined) return undefined;
    return isTextTree(value) && typeof value === "object" ? value : undefined;
  }
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * The payload to store after an edit: what is published already, with the
 * fields this editor owns brought up to date.
 *
 * Two things make the merge necessary. An editor owns a few fields and knows
 * nothing about the rest — the prose editor must not drop the names the
 * Cryptides editor published, and the other way round. And a field edited back
 * to the committed text has to be *taken out*, because leaving it alone means
 * the published row keeps winning and the site never returns to the built
 * version. That was the bug: removing a letter from a name looked saved and
 * changed nothing.
 *
 * So the result can be empty, and an empty payload means exactly this guide
 * and language are back to what the build carries.
 */
export function overrideWith<T extends object>(
  published: GuideOverride | null,
  base: T,
  edited: T,
  fields: readonly string[],
): GuideOverride {
  const out: GuideOverride = { ...readOverride(published) };
  const from = base as Record<string, unknown>;
  const to = edited as Record<string, unknown>;
  for (const field of fields) {
    if (!OVERRIDABLE_FIELDS.includes(field as OverridableField)) continue;
    if (!(field in to)) continue;
    const key = field as OverridableField;
    const value = TEXT_MAPS.has(field)
      ? cleanField(field, prunedTexts(from[field], to[field]))
      : JSON.stringify(to[field]) === JSON.stringify(from[field])
        ? undefined
        : cleanField(field, to[field]);
    if (value === undefined) delete out[key];
    else out[key] = value;
  }
  return out;
}

/** What an editor that owns the whole entry sends: only what differs. */
export function overrideFrom<T extends object>(base: T, edited: T): GuideOverride {
  return overrideWith(null, base, edited, OVERRIDABLE_FIELDS);
}
