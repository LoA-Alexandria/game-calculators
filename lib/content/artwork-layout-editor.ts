/**
 * Pure state logic for the Artwork layouts editor. The page only renders this
 * state and calls these functions, so adding sets, reordering, and exporting
 * can be tested without a browser.
 *
 * The editor works on a copy of `lib/data/artwork-layouts.json`. A static site
 * cannot save for everyone, so the result leaves the browser as that JSON file
 * (plus dictionary lines for any new text) for someone to commit — the same
 * way the hero-tier, news, event, and guide editors work.
 */

import { PAINTING_SETS, type PaintingSet } from "./artwork.ts";
import type {
  ArtworkLayoutData,
  LayoutBuildData,
  LayoutRowData,
} from "./artwork-layouts.ts";
import { DEFAULT_LOCALE, LOCALE_CODES, dictionaryFile, getDictionary, type Locale } from "../i18n/index.ts";
import { parseTranslations, textIn, translationsFrom, type Translations } from "../i18n/translations.ts";

export type { Translations };

export const TEXT_GROUPS = ["names", "notes", "reasons"] as const;
export type TextGroup = (typeof TEXT_GROUPS)[number];
/** New keys and new wording for existing keys, each in every registered language. */
export type CustomTexts = Record<TextGroup, Record<string, Translations>>;

/** The dictionary group under `guideEntries.artworkLayouts` for each editor group. */
const DICTIONARY_GROUP = { names: "buildNames", notes: "notes", reasons: "reasons" } as const;

export type EditorRow = {
  uid: string;
  setId: string;
  reason: string;
  insert: boolean;
};

export type EditorBuild = {
  id: string;
  note: string;
  rows: EditorRow[];
};

export type EditorState = {
  version: 1;
  builds: EditorBuild[];
  texts: CustomTexts;
  nextId: number;
};

function emptyTexts(): CustomTexts {
  return { names: {}, notes: {}, reasons: {} };
}

function copyRow(row: LayoutRowData, uid: string): EditorRow {
  return { uid, setId: row.setId, reason: row.reason, insert: Boolean(row.insert) };
}

export function fromLayoutData(data: ArtworkLayoutData): EditorState {
  let nextId = 1;
  return {
    version: 1,
    builds: data.builds.map((build) => ({
      id: build.id,
      note: build.note ?? "",
      rows: build.rows.map((row) => copyRow(row, `r${nextId++}`)),
    })),
    texts: emptyTexts(),
    nextId,
  };
}

function cleanRow(row: EditorRow): LayoutRowData {
  const clean: LayoutRowData = { setId: row.setId, reason: row.reason };
  if (row.insert) clean.insert = true;
  return clean;
}

export function toLayoutData(state: EditorState): ArtworkLayoutData {
  return {
    builds: state.builds.map((build): LayoutBuildData => ({
      id: build.id,
      ...(build.note ? { note: build.note } : {}),
      rows: build.rows.map(cleanRow),
    })),
  };
}

export function findBuild(state: EditorState, id: string): EditorBuild | undefined {
  return state.builds.find((build) => build.id === id);
}

function withBuilds(state: EditorState, builds: EditorBuild[]): EditorState {
  return { ...state, builds };
}

function withBuild(state: EditorState, id: string, patch: Partial<EditorBuild>): EditorState {
  return withBuilds(
    state,
    state.builds.map((build) => (build.id === id ? { ...build, ...patch } : build)),
  );
}

export function moveRow(state: EditorState, buildId: string, uid: string, toIndex: number): EditorState {
  const build = findBuild(state, buildId);
  if (!build) return state;
  const from = build.rows.findIndex((row) => row.uid === uid);
  if (from < 0) return state;
  const moving = build.rows[from];
  const without = build.rows.filter((row) => row.uid !== uid);
  const index = Math.max(0, Math.min(toIndex, without.length));
  return withBuild(state, buildId, {
    rows: [...without.slice(0, index), moving, ...without.slice(index)],
  });
}

export function updateRow(
  state: EditorState,
  buildId: string,
  uid: string,
  patch: Partial<Pick<EditorRow, "setId" | "reason" | "insert">>,
): EditorState {
  const build = findBuild(state, buildId);
  if (!build) return state;
  return withBuild(state, buildId, {
    rows: build.rows.map((row) => (row.uid === uid ? { ...row, ...patch } : row)),
  });
}

export function removeRow(state: EditorState, buildId: string, uid: string): EditorState {
  const build = findBuild(state, buildId);
  if (!build) return state;
  return withBuild(state, buildId, { rows: build.rows.filter((row) => row.uid !== uid) });
}

export function addRow(
  state: EditorState,
  buildId: string,
  setId: string,
  reason = "",
): { state: EditorState; uid: string } | null {
  const build = findBuild(state, buildId);
  if (!build || build.rows.some((row) => row.setId === setId)) return null;
  const uid = `r${state.nextId}`;
  return {
    uid,
    state: {
      ...withBuild(state, buildId, {
        rows: [...build.rows, { uid, setId, reason, insert: false }],
      }),
      nextId: state.nextId + 1,
    },
  };
}

export function setBuildNote(state: EditorState, buildId: string, note: string): EditorState {
  return withBuild(state, buildId, { note });
}

export function layoutIdFrom(name: string, taken: Iterable<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "build";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}${counter}`)) counter += 1;
  return `${base}${counter}`;
}

export function textKeyFrom(english: string, taken: Iterable<string>): string {
  const words = english
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  const base =
    words
      .map((word, index) => (index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
      .join("")
      .replace(/^[0-9]+/, "") || "custom";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}${counter}`)) counter += 1;
  return `${base}${counter}`;
}

export function addText(state: EditorState, group: TextGroup, key: string, text: Translations): EditorState {
  return { ...state, texts: { ...state.texts, [group]: { ...state.texts[group], [key]: text } } };
}

/** The wording a key has in every dictionary right now. */
export function publishedText(group: TextGroup, key: string): Translations {
  return translationsFrom((locale) => (getDictionary(locale).guideEntries.artworkLayouts[DICTIONARY_GROUP[group]] as Record<string, string>)[key]);
}

/** The text for a key in one language: the editor's wording first, then the dictionary, then English. */
export function textFor(texts: CustomTexts, group: TextGroup, key: string, locale: Locale): string {
  const custom = texts[group][key];
  if (custom) return textIn(custom, locale);
  return textIn(publishedText(group, key), locale);
}

export function addBuild(
  state: EditorState,
  names: Translations,
  fromBuildId?: string,
): { state: EditorState; id: string } {
  const id = layoutIdFrom(names[DEFAULT_LOCALE], state.builds.map((build) => build.id));
  const source = fromBuildId ? findBuild(state, fromBuildId) : undefined;
  let nextId = state.nextId;
  const rows: EditorRow[] = (source?.rows ?? []).map((row) => ({
    ...row,
    uid: `r${nextId++}`,
  }));
  const withName = addText(state, "names", id, names);
  return {
    id,
    state: {
      ...withName,
      builds: [...withName.builds, { id, note: source?.note ?? "", rows }],
      nextId,
    },
  };
}

export function removeBuild(state: EditorState, buildId: string): EditorState {
  if (state.builds.length <= 1) return state;
  if (!state.builds.some((build) => build.id === buildId)) return state;
  return withBuilds(state, state.builds.filter((build) => build.id !== buildId));
}

export function unusedSets(build: EditorBuild): PaintingSet[] {
  const used = new Set(build.rows.map((row) => row.setId));
  return PAINTING_SETS.filter((set) => !used.has(set.id));
}

/**
 * The JSON file, one row per line: readable in a pull request, and a moved set
 * shows up as two changed lines rather than a reformatted file.
 */
export function serializeLayoutData(data: ArtworkLayoutData): string {
  const builds = data.builds.map((build, index, all) => {
    const head = `    { "id": ${JSON.stringify(build.id)}${build.note ? `, "note": ${JSON.stringify(build.note)}` : ""}, "rows": [`;
    const body = build.rows.map((row, rowIndex) => {
      const clean: LayoutRowData = { setId: row.setId, reason: row.reason };
      if (row.insert) clean.insert = true;
      return `      ${JSON.stringify(clean)}${rowIndex < build.rows.length - 1 ? "," : ""}`;
    });
    return [head, ...body, `    ] }${index < all.length - 1 ? "," : ""}`].join("\n");
  });
  return ["{", `  "builds": [`, ...builds, `  ]`, "}", ""].join("\n");
}

/**
 * Lines to add to or replace in each dictionary for text typed in the editor.
 * A language left empty gets the English text. Empty when there is none.
 */
export function dictionarySnippet(texts: CustomTexts): Record<Locale, string> {
  const result = {} as Record<Locale, string>;
  for (const locale of LOCALE_CODES) {
    const blocks = TEXT_GROUPS.flatMap((group) => {
      const entries = Object.entries(texts[group]);
      if (entries.length === 0) return [];
      const lines = entries.map(([key, value]) => `        ${key}: ${JSON.stringify(textIn(value, locale))},`);
      return [`      // guideEntries.artworkLayouts.${DICTIONARY_GROUP[group]}`, ...lines];
    });
    result[locale] = blocks.length ? [`// ${dictionaryFile(locale)}`, ...blocks].join("\n") : "";
  }
  return result;
}

export function countChanges(published: ArtworkLayoutData, draft: ArtworkLayoutData): number {
  const before = new Map(published.builds.map((build) => [build.id, JSON.stringify(build)]));
  const after = new Map(draft.builds.map((build) => [build.id, JSON.stringify(build)]));
  let changes = 0;
  for (const [id, json] of after) {
    const old = before.get(id);
    if (old === undefined || old !== json) changes += 1;
  }
  for (const id of before.keys()) if (!after.has(id)) changes += 1;
  if (
    published.builds.map((build) => build.id).join("\0") !== draft.builds.map((build) => build.id).join("\0")
    && changes === 0
  ) {
    changes += 1;
  }
  return changes;
}

export type Problem =
  | { code: "emptyBuild"; id: string }
  | { code: "emptyName"; id: string }
  | { code: "unknownSet"; id: string; setId: string }
  | { code: "duplicateSet"; id: string; setId: string }
  | { code: "emptyReason"; id: string; setId: string }
  | { code: "missingText"; group: TextGroup; key: string };

export function findProblems(
  state: EditorState,
  known: Record<TextGroup, ReadonlySet<string>>,
): Problem[] {
  const problems: Problem[] = [];
  const catalogue = new Set(PAINTING_SETS.map((set) => set.id));
  const hasText = (group: TextGroup, key: string | undefined) =>
    !key || known[group].has(key) || key in state.texts[group];

  for (const build of state.builds) {
    if (!build.id || (!known.names.has(build.id) && !(build.id in state.texts.names))) {
      problems.push({ code: "emptyName", id: build.id });
    }
    if (build.note && !hasText("notes", build.note)) {
      problems.push({ code: "missingText", group: "notes", key: build.note });
    }
    if (build.rows.length === 0) problems.push({ code: "emptyBuild", id: build.id });
    const seen = new Set<string>();
    for (const row of build.rows) {
      if (!catalogue.has(row.setId)) problems.push({ code: "unknownSet", id: build.id, setId: row.setId });
      if (seen.has(row.setId)) problems.push({ code: "duplicateSet", id: build.id, setId: row.setId });
      seen.add(row.setId);
      if (!row.reason) problems.push({ code: "emptyReason", id: build.id, setId: row.setId });
      else if (!hasText("reasons", row.reason)) {
        problems.push({ code: "missingText", group: "reasons", key: row.reason });
      }
    }
  }
  return problems;
}

/** Validates a stored draft; anything unexpected is dropped rather than half-loaded. */
export function parseDraft(raw: string | null): EditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as EditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.builds) || !value.texts) {
      return null;
    }
    for (const group of TEXT_GROUPS) {
      if (typeof value.texts[group] !== "object" || value.texts[group] === null) return null;
      // A draft saved before a language was added loads with that language empty.
      for (const [key, text] of Object.entries(value.texts[group])) {
        const parsed = parseTranslations(text);
        if (!parsed) return null;
        value.texts[group][key] = parsed;
      }
    }
    for (const build of value.builds) {
      if (typeof build.id !== "string" || !Array.isArray(build.rows)) return null;
      if (typeof build.note !== "string") return null;
      for (const row of build.rows) {
        if (typeof row.uid !== "string" || typeof row.setId !== "string" || typeof row.reason !== "string") return null;
        if (typeof row.insert !== "boolean") return null;
      }
    }
    return value;
  } catch {
    return null;
  }
}
