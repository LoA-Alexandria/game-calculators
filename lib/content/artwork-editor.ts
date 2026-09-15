/**
 * Pure state logic for the Artwork catalogue editor. The page only renders this
 * state and calls these functions, so adding paintings, heroes, and exporting
 * can be tested without a browser.
 *
 * The editor works on a copy of `lib/data/paintings.json` (English) and each
 * dictionary's `guideEntries.artwork.catalogTexts` (the other languages). A
 * static site cannot save for everyone, so the result leaves the browser as
 * that JSON file and one text block per dictionary for someone to commit — the
 * same way the other guide editors work.
 */

import { HEROES } from "./heroes.ts";
import {
  PAINTING_RARITIES,
  PAINTING_STATS,
  type Painting,
  type PaintingRarity,
  type PaintingSet,
  type PaintingSetText,
  type PaintingStat,
  type PaintingText,
  type PaintingTexts,
} from "./artwork.ts";
import { DEFAULT_LOCALE, LOCALE_CODES, getDictionary, mapLocales, type Locale } from "../i18n/index.ts";
import { dictionaryLiteral } from "../i18n/translations.ts";

export type PaintingCatalogueData = { sets: PaintingSet[] };

export type EditorPainting = {
  uid: string;
  id: string;
  name: string;
  heroes: string[];
  stats: PaintingStat[];
  starStats: PaintingStat[];
  productivity: string;
  /** Name and productivity in the other languages; the fields above are English. */
  texts: Partial<Record<Locale, PaintingText>>;
};

export type EditorSet = {
  uid: string;
  id: string;
  name: string;
  rarity: PaintingRarity;
  effect: string;
  paintings: EditorPainting[];
  /** Name and set skill in the other languages; the fields above are English. */
  texts: Partial<Record<Locale, PaintingSetText>>;
};

/** Each dictionary's `guideEntries.artwork.catalogTexts`. */
export function publishedCatalogTexts(): Record<Locale, PaintingTexts> {
  return mapLocales((locale) => getDictionary(locale).guideEntries.artwork.catalogTexts as PaintingTexts);
}

function textsFor<T extends object>(catalogs: Partial<Record<Locale, Record<string, T> | undefined>>, id: string): Partial<Record<Locale, T>> {
  const texts: Partial<Record<Locale, T>> = {};
  for (const locale of LOCALE_CODES) {
    const text = catalogs[locale]?.[id];
    if (locale !== DEFAULT_LOCALE && text) texts[locale] = { ...text };
  }
  return texts;
}

export type EditorState = {
  version: 1;
  sets: EditorSet[];
  nextId: number;
};

const STAT_SET = new Set<string>(PAINTING_STATS);
const RARITY_SET = new Set<string>(PAINTING_RARITIES);
const UR_PLUS = new Set(HEROES.filter((hero) => hero.rarity === "UR+").map((hero) => hero.name));

export function catalogueIdFrom(name: string, taken: Iterable<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "item";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}${counter}`)) counter += 1;
  return `${base}${counter}`;
}

function cleanStats(stats: readonly string[]): PaintingStat[] {
  const seen = new Set<PaintingStat>();
  const result: PaintingStat[] = [];
  for (const stat of stats) {
    if (!STAT_SET.has(stat)) continue;
    const typed = stat as PaintingStat;
    if (seen.has(typed)) continue;
    seen.add(typed);
    result.push(typed);
  }
  return result;
}

function copyPainting(canvas: Painting, uid: string, catalogs: Partial<Record<Locale, PaintingTexts>>): EditorPainting {
  return {
    uid,
    id: canvas.id,
    name: canvas.name,
    heroes: [...canvas.heroes],
    stats: cleanStats(canvas.stats),
    starStats: cleanStats(canvas.starStats ?? []),
    productivity: canvas.productivity ?? "",
    texts: textsFor(mapLocales((locale) => catalogs[locale]?.paintings), canvas.id),
  };
}

export function fromCatalogue(data: PaintingCatalogueData, catalogs: Partial<Record<Locale, PaintingTexts>> = {}): EditorState {
  let nextId = 1;
  return {
    version: 1,
    sets: data.sets.map((set) => ({
      uid: `s${nextId++}`,
      id: set.id,
      name: set.name,
      rarity: set.rarity,
      effect: set.effect,
      paintings: set.paintings.map((canvas) => copyPainting(canvas, `p${nextId++}`, catalogs)),
      texts: textsFor(mapLocales((locale) => catalogs[locale]?.sets), set.id),
    })),
    nextId,
  };
}

function cleanPainting(canvas: EditorPainting): Painting {
  const painting: Painting = {
    id: canvas.id,
    name: canvas.name.trim(),
    heroes: canvas.heroes.map((hero) => hero.trim()).filter(Boolean),
    stats: cleanStats(canvas.stats),
    productivity: canvas.productivity.trim(),
  };
  const starStats = cleanStats(canvas.starStats);
  if (starStats.length) painting.starStats = starStats;
  return painting;
}

export function toCatalogue(state: EditorState): PaintingCatalogueData {
  return {
    sets: state.sets.map((set) => ({
      id: set.id,
      name: set.name.trim(),
      rarity: set.rarity,
      effect: set.effect.trim(),
      paintings: set.paintings.map(cleanPainting),
    })),
  };
}

export function findSet(state: EditorState, uid: string): EditorSet | undefined {
  return state.sets.find((set) => set.uid === uid);
}

export function findPainting(
  state: EditorState,
  paintingUid: string,
): { set: EditorSet; index: number } | null {
  for (const set of state.sets) {
    const index = set.paintings.findIndex((canvas) => canvas.uid === paintingUid);
    if (index >= 0) return { set, index };
  }
  return null;
}

function withSets(state: EditorState, sets: EditorSet[]): EditorState {
  return { ...state, sets };
}

function withSet(state: EditorState, uid: string, patch: Partial<EditorSet>): EditorState {
  return withSets(
    state,
    state.sets.map((set) => (set.uid === uid ? { ...set, ...patch } : set)),
  );
}

export function updateSet(state: EditorState, uid: string, patch: Partial<Pick<EditorSet, "name" | "rarity" | "effect">>): EditorState {
  return withSet(state, uid, patch);
}

export function addSet(state: EditorState, rarity: PaintingRarity, name = ""): { state: EditorState; uid: string } {
  const uid = `s${state.nextId}`;
  const id = catalogueIdFrom(name || "new-set", state.sets.map((set) => set.id));
  return {
    uid,
    state: {
      ...state,
      nextId: state.nextId + 1,
      sets: [...state.sets, { uid, id, name, rarity, effect: "", paintings: [], texts: {} }],
    },
  };
}

export function removeSet(state: EditorState, uid: string): EditorState {
  if (state.sets.length <= 1) return state;
  return withSets(state, state.sets.filter((set) => set.uid !== uid));
}

export function addPainting(state: EditorState, setUid: string, name = ""): { state: EditorState; uid: string } | null {
  const set = findSet(state, setUid);
  if (!set) return null;
  const uid = `p${state.nextId}`;
  const taken = state.sets.flatMap((entry) => entry.paintings.map((canvas) => canvas.id));
  const id = catalogueIdFrom(name || "new-painting", taken);
  return {
    uid,
    state: {
      ...withSet(state, setUid, {
        paintings: [
          ...set.paintings,
          { uid, id, name, heroes: [], stats: [], starStats: [], productivity: "", texts: {} },
        ],
      }),
      nextId: state.nextId + 1,
    },
  };
}

export function removePainting(state: EditorState, paintingUid: string): EditorState {
  return withSets(
    state,
    state.sets.map((set) => ({
      ...set,
      paintings: set.paintings.filter((canvas) => canvas.uid !== paintingUid),
    })),
  );
}

export function updatePainting(
  state: EditorState,
  paintingUid: string,
  patch: Partial<Pick<EditorPainting, "name" | "productivity" | "stats" | "starStats">>,
): EditorState {
  return withSets(
    state,
    state.sets.map((set) => ({
      ...set,
      paintings: set.paintings.map((canvas) => (canvas.uid === paintingUid ? { ...canvas, ...patch } : canvas)),
    })),
  );
}

export function movePainting(state: EditorState, paintingUid: string, toIndex: number): EditorState {
  const found = findPainting(state, paintingUid);
  if (!found) return state;
  const moving = found.set.paintings[found.index];
  const without = found.set.paintings.filter((canvas) => canvas.uid !== paintingUid);
  const index = Math.max(0, Math.min(toIndex, without.length));
  return withSet(state, found.set.uid, {
    paintings: [...without.slice(0, index), moving, ...without.slice(index)],
  });
}

export function addHero(state: EditorState, paintingUid: string, name: string): EditorState {
  const hero = name.trim();
  if (!hero) return state;
  const found = findPainting(state, paintingUid);
  if (!found) return state;
  const canvas = found.set.paintings[found.index];
  if (canvas.heroes.includes(hero)) return state;
  return updatePaintingHeroes(state, paintingUid, [...canvas.heroes, hero]);
}

export function removeHero(state: EditorState, paintingUid: string, name: string): EditorState {
  const found = findPainting(state, paintingUid);
  if (!found) return state;
  return updatePaintingHeroes(
    state,
    paintingUid,
    found.set.paintings[found.index].heroes.filter((hero) => hero !== name),
  );
}

function updatePaintingHeroes(state: EditorState, paintingUid: string, heroes: string[]): EditorState {
  return withSets(
    state,
    state.sets.map((set) => ({
      ...set,
      paintings: set.paintings.map((canvas) => (canvas.uid === paintingUid ? { ...canvas, heroes } : canvas)),
    })),
  );
}

export function toggleStat(
  state: EditorState,
  paintingUid: string,
  field: "stats" | "starStats",
  stat: PaintingStat,
): EditorState {
  const found = findPainting(state, paintingUid);
  if (!found) return state;
  const canvas = found.set.paintings[found.index];
  const current = canvas[field];
  const next = current.includes(stat) ? current.filter((item) => item !== stat) : cleanStats([...current, stat]);
  return updatePainting(state, paintingUid, { [field]: next });
}

export function unusedHeroes(canvas: EditorPainting): typeof HEROES {
  const used = new Set(canvas.heroes);
  return HEROES.filter((hero) => !used.has(hero.name));
}

export function serializePaintingData(data: PaintingCatalogueData): string {
  const sets = data.sets.map((set, index, all) => {
    const head = `    { "id": ${JSON.stringify(set.id)}, "name": ${JSON.stringify(set.name)}, "rarity": ${JSON.stringify(set.rarity)}, "effect": ${JSON.stringify(set.effect)}, "paintings": [`;
    const body = set.paintings.map((canvas, paintingIndex) => {
      const row: Record<string, unknown> = {
        id: canvas.id,
        name: canvas.name,
        heroes: canvas.heroes,
        stats: [...canvas.stats],
      };
      if (canvas.productivity) row.productivity = canvas.productivity;
      if (canvas.starStats?.length) row.starStats = [...canvas.starStats];
      return `      ${JSON.stringify(row)}${paintingIndex < set.paintings.length - 1 ? "," : ""}`;
    });
    return [head, ...body, `    ] }${index < all.length - 1 ? "," : ""}`].join("\n");
  });
  return ["{", `  "sets": [`, ...sets, `  ]`, "}", ""].join("\n");
}

/** One language's set name or set skill; English is edited with `updateSet`. */
export function setSetText(state: EditorState, setUid: string, locale: Locale, field: keyof PaintingSetText, value: string): EditorState {
  if (locale === DEFAULT_LOCALE) return state;
  const set = findSet(state, setUid);
  if (!set) return state;
  return withSet(state, setUid, { texts: { ...set.texts, [locale]: { ...set.texts[locale], [field]: value } } });
}

/** One language's painting name or productivity; English is edited with `updatePainting`. */
export function setPaintingText(state: EditorState, paintingUid: string, locale: Locale, field: keyof PaintingText, value: string): EditorState {
  if (locale === DEFAULT_LOCALE) return state;
  return withSets(
    state,
    state.sets.map((set) => ({
      ...set,
      paintings: set.paintings.map((canvas) =>
        canvas.uid === paintingUid ? { ...canvas, texts: { ...canvas.texts, [locale]: { ...canvas.texts[locale], [field]: value } } } : canvas,
      ),
    })),
  );
}

function trimmed<T extends Record<string, string | undefined>>(text: T | undefined): T | null {
  if (!text) return null;
  const clean = Object.fromEntries(
    Object.entries(text).flatMap(([key, value]) => (value?.trim() ? [[key, value.trim()]] : [])),
  ) as T;
  return Object.keys(clean).length ? clean : null;
}

/** Every language's `catalogTexts` as the export would publish them. */
export function exportCatalogTexts(state: EditorState): Record<Locale, PaintingTexts> {
  return mapLocales((locale) => {
    const catalog: PaintingTexts = {};
    if (locale === DEFAULT_LOCALE) return catalog;
    const sets: Record<string, PaintingSetText> = {};
    const paintings: Record<string, PaintingText> = {};
    for (const set of state.sets) {
      const setText = trimmed(set.texts[locale]);
      if (setText) sets[set.id] = setText;
      for (const canvas of set.paintings) {
        const paintingText = trimmed(canvas.texts[locale]);
        if (paintingText) paintings[canvas.id] = paintingText;
      }
    }
    if (Object.keys(sets).length) catalog.sets = sets;
    if (Object.keys(paintings).length) catalog.paintings = paintings;
    return catalog;
  });
}

/**
 * The `catalogTexts` block for each dictionary whose translations differ from
 * the published ones. It replaces `catalogTexts` inside `guideEntries.artwork`.
 */
export function catalogTextBlocks(texts: Record<Locale, PaintingTexts>, published: Record<Locale, PaintingTexts>): Partial<Record<Locale, string>> {
  const blocks: Partial<Record<Locale, string>> = {};
  for (const locale of LOCALE_CODES) {
    if (JSON.stringify(texts[locale]) === JSON.stringify(published[locale] ?? {})) continue;
    blocks[locale] = `// replace catalogTexts inside guideEntries.artwork\n      catalogTexts: ${dictionaryLiteral(texts[locale], "      ")},`;
  }
  return blocks;
}

/** Sets and paintings whose translation in any language differs from the published one. */
export function countCatalogTextChanges(texts: Record<Locale, PaintingTexts>, published: Record<Locale, PaintingTexts>): number {
  const changed = new Set<string>();
  for (const locale of LOCALE_CODES) {
    for (const group of ["sets", "paintings"] as const) {
      const after = texts[locale][group] ?? {};
      const before = published[locale]?.[group] ?? {};
      for (const id of new Set([...Object.keys(after), ...Object.keys(before)])) {
        if (JSON.stringify(after[id]) !== JSON.stringify(before[id])) changed.add(`${group}:${id}`);
      }
    }
  }
  return changed.size;
}

export function countChanges(published: PaintingCatalogueData, draft: PaintingCatalogueData): number {
  const before = new Map(published.sets.map((set) => [set.id, JSON.stringify(set)]));
  const after = new Map(draft.sets.map((set) => [set.id, JSON.stringify(set)]));
  let changes = 0;
  for (const [id, json] of after) {
    const old = before.get(id);
    if (old === undefined || old !== json) changes += 1;
  }
  for (const id of before.keys()) if (!after.has(id)) changes += 1;
  if (
    published.sets.map((set) => set.id).join("\0") !== draft.sets.map((set) => set.id).join("\0")
    && changes === 0
  ) {
    changes += 1;
  }
  return changes;
}

export type Problem =
  | { code: "emptySetName"; id: string }
  | { code: "emptyPaintingName"; set: string; id: string }
  | { code: "emptySet"; id: string }
  | { code: "duplicateSet"; id: string }
  | { code: "duplicatePainting"; id: string }
  | { code: "urPlusHero"; set: string; painting: string; hero: string }
  | { code: "duplicateHero"; set: string; painting: string; hero: string };

export function findProblems(state: EditorState): Problem[] {
  const problems: Problem[] = [];
  const setIds = new Set<string>();
  const paintingIds = new Set<string>();
  for (const set of state.sets) {
    if (!set.name.trim()) problems.push({ code: "emptySetName", id: set.id });
    if (setIds.has(set.id)) problems.push({ code: "duplicateSet", id: set.id });
    setIds.add(set.id);
    if (set.paintings.length === 0) problems.push({ code: "emptySet", id: set.id || set.name });
    for (const canvas of set.paintings) {
      if (!canvas.name.trim()) problems.push({ code: "emptyPaintingName", set: set.name || set.id, id: canvas.id });
      if (paintingIds.has(canvas.id)) problems.push({ code: "duplicatePainting", id: canvas.id });
      paintingIds.add(canvas.id);
      const seen = new Set<string>();
      for (const hero of canvas.heroes) {
        if (seen.has(hero)) problems.push({ code: "duplicateHero", set: set.name || set.id, painting: canvas.name || canvas.id, hero });
        seen.add(hero);
        if (UR_PLUS.has(hero) && hero !== "Joan of Arc") {
          problems.push({ code: "urPlusHero", set: set.name || set.id, painting: canvas.name || canvas.id, hero });
        }
      }
    }
  }
  return problems;
}

export function parseDraft(raw: string | null): EditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as EditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.sets)) return null;
    for (const set of value.sets) {
      if (typeof set.uid !== "string" || typeof set.id !== "string" || typeof set.name !== "string") return null;
      if (!RARITY_SET.has(set.rarity) || typeof set.effect !== "string" || !Array.isArray(set.paintings)) return null;
      // Drafts from before translations were editable have no texts yet.
      set.texts = typeof set.texts === "object" && set.texts !== null ? set.texts : {};
      for (const canvas of set.paintings) {
        canvas.texts = typeof canvas.texts === "object" && canvas.texts !== null ? canvas.texts : {};
        if (typeof canvas.uid !== "string" || typeof canvas.id !== "string" || typeof canvas.name !== "string") return null;
        if (!Array.isArray(canvas.heroes) || !Array.isArray(canvas.stats) || !Array.isArray(canvas.starStats)) return null;
        if (typeof canvas.productivity !== "string") return null;
      }
    }
    return value;
  } catch {
    return null;
  }
}
