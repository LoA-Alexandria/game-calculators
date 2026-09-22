/**
 * Pure state logic for the collection layouts editor. The page only renders
 * this state and calls these functions, so setups, slots, and translations can
 * be tested without a browser.
 *
 * The editor works on a copy of `lib/data/collection-layouts.json` and exports
 * that file plus one `setupTexts` and `optionTexts` block per dictionary, like
 * the other guide editors. Slots and options name a collection by its id in
 * the Collection guide; titles, ledes, notes, and what a collection does are
 * kept in every language at once, with English going into the JSON.
 */

import {
  COLLECTION_AGES,
  COLLECTION_LAYOUTS_DATA,
  type CollectionAge,
  type CollectionLayoutTag,
  type CollectionLayoutsData,
  type CollectionOption,
  type CollectionSetup,
  type OptionTexts,
  type SetupTexts,
  isCollectionAge,
  isCollectionLayoutTag,
} from "./collection-layouts.ts";
import { COLLECTION_ITEMS } from "./collection.ts";
import { DEFAULT_LOCALE, LOCALE_CODES, getDictionary, mapLocales, type Locale } from "../i18n/index.ts";
import { blankTranslations, dictionaryLiteral, parseTranslations, type Translations } from "../i18n/translations.ts";

export type EditorNote = { uid: string; text: Translations };

export type EditorSetup = {
  uid: string;
  /** Empty for a setup added in the editor until export derives it from the English title. */
  id: string;
  credit: string;
  tags: CollectionLayoutTag[];
  title: Translations;
  lede: Translations;
  notes: EditorNote[];
  /** Collection id per age slot; an empty string leaves the slot open. */
  slots: Record<CollectionAge, string>;
};

export type EditorOption = {
  uid: string;
  age: CollectionAge;
  item: string;
  /** English fallback name, used until the Collection guide has that item. */
  name: string;
  tags: CollectionLayoutTag[];
  note: Translations;
};

export type LayoutsEditorState = {
  version: 1;
  setups: EditorSetup[];
  options: EditorOption[];
  nextId: number;
};

const json = (value: unknown) => JSON.stringify(value);
const KNOWN_ITEMS = new Set(COLLECTION_ITEMS.map((item) => item.id));

export function catalogs(): { setups: Record<Locale, SetupTexts>; options: Record<Locale, OptionTexts> } {
  return {
    setups: mapLocales((locale) => getDictionary(locale).guideEntries.collectionLayouts.setupTexts as SetupTexts),
    options: mapLocales((locale) => getDictionary(locale).guideEntries.collectionLayouts.optionTexts as OptionTexts),
  };
}

function translated(english: string, read: (locale: Locale) => string | undefined): Translations {
  return mapLocales((locale) => (locale === DEFAULT_LOCALE ? english : (read(locale) ?? "")));
}

const emptySlots = (): Record<CollectionAge, string> =>
  Object.fromEntries(COLLECTION_AGES.map((age) => [age, ""])) as Record<CollectionAge, string>;

export function fromLayoutsData(
  data: CollectionLayoutsData,
  setupTexts: Partial<Record<Locale, SetupTexts>> = {},
  optionTexts: Partial<Record<Locale, OptionTexts>> = {},
): LayoutsEditorState {
  let nextId = 1;
  const setups = data.setups.map((setup): EditorSetup => ({
    uid: `s${nextId++}`,
    id: setup.id,
    credit: setup.credit,
    tags: [...setup.tags],
    title: translated(setup.title, (locale) => setupTexts[locale]?.[setup.id]?.title),
    lede: translated(setup.lede, (locale) => setupTexts[locale]?.[setup.id]?.lede),
    notes: setup.notes.map((note, index) => ({
      uid: `n${nextId++}`,
      text: translated(note, (locale) => setupTexts[locale]?.[setup.id]?.notes?.[index]),
    })),
    slots: { ...emptySlots(), ...setup.slots },
  }));
  const options = data.options.map((option): EditorOption => ({
    uid: `o${nextId++}`,
    age: option.age,
    item: option.item,
    name: option.name,
    tags: [...option.tags],
    note: translated(option.note, (locale) => optionTexts[locale]?.[option.item]?.note),
  }));
  return { version: 1, setups, options, nextId };
}

export function setupIdFrom(title: string, taken: Iterable<string>): string {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "setup";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

export function setupByUid(state: LayoutsEditorState, uid: string): EditorSetup | undefined {
  return state.setups.find((setup) => setup.uid === uid);
}

export function optionByUid(state: LayoutsEditorState, uid: string): EditorOption | undefined {
  return state.options.find((option) => option.uid === uid);
}

function mapSetup(state: LayoutsEditorState, uid: string, change: (setup: EditorSetup) => EditorSetup): LayoutsEditorState {
  return { ...state, setups: state.setups.map((setup) => (setup.uid === uid ? change(setup) : setup)) };
}

function mapOption(state: LayoutsEditorState, uid: string, change: (option: EditorOption) => EditorOption): LayoutsEditorState {
  return { ...state, options: state.options.map((option) => (option.uid === uid ? change(option) : option)) };
}

export function addSetup(state: LayoutsEditorState): { state: LayoutsEditorState; uid: string } {
  const uid = `s${state.nextId}`;
  const setup: EditorSetup = {
    uid,
    id: "",
    credit: "",
    tags: [],
    title: blankTranslations(),
    lede: blankTranslations(),
    notes: [],
    slots: emptySlots(),
  };
  return { state: { ...state, setups: [...state.setups, setup], nextId: state.nextId + 1 }, uid };
}

export function removeSetup(state: LayoutsEditorState, uid: string): LayoutsEditorState {
  return { ...state, setups: state.setups.filter((setup) => setup.uid !== uid) };
}

export function moveSetup(state: LayoutsEditorState, uid: string, offset: -1 | 1): LayoutsEditorState {
  const index = state.setups.findIndex((setup) => setup.uid === uid);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= state.setups.length) return state;
  const setups = [...state.setups];
  [setups[index], setups[target]] = [setups[target], setups[index]];
  return { ...state, setups };
}

export function setCredit(state: LayoutsEditorState, uid: string, credit: string): LayoutsEditorState {
  return mapSetup(state, uid, (setup) => ({ ...setup, credit }));
}

export function setSlot(state: LayoutsEditorState, uid: string, age: CollectionAge, item: string): LayoutsEditorState {
  return mapSetup(state, uid, (setup) => ({ ...setup, slots: { ...setup.slots, [age]: item } }));
}

export function setSetupText(
  state: LayoutsEditorState,
  uid: string,
  field: "title" | "lede",
  locale: Locale,
  value: string,
): LayoutsEditorState {
  return mapSetup(state, uid, (setup) => ({ ...setup, [field]: { ...setup[field], [locale]: value } }));
}

export function addNote(state: LayoutsEditorState, uid: string): LayoutsEditorState {
  const note: EditorNote = { uid: `n${state.nextId}`, text: blankTranslations() };
  const next = mapSetup(state, uid, (setup) => ({ ...setup, notes: [...setup.notes, note] }));
  return { ...next, nextId: state.nextId + 1 };
}

export function removeNote(state: LayoutsEditorState, uid: string, noteUid: string): LayoutsEditorState {
  return mapSetup(state, uid, (setup) => ({ ...setup, notes: setup.notes.filter((note) => note.uid !== noteUid) }));
}

export function setNoteText(state: LayoutsEditorState, uid: string, noteUid: string, locale: Locale, value: string): LayoutsEditorState {
  return mapSetup(state, uid, (setup) => ({
    ...setup,
    notes: setup.notes.map((note) => (note.uid === noteUid ? { ...note, text: { ...note.text, [locale]: value } } : note)),
  }));
}

export function toggleSetupTag(state: LayoutsEditorState, uid: string, tag: CollectionLayoutTag): LayoutsEditorState {
  return mapSetup(state, uid, (setup) => ({
    ...setup,
    tags: setup.tags.includes(tag) ? setup.tags.filter((entry) => entry !== tag) : [...setup.tags, tag],
  }));
}

export function toggleOptionTag(state: LayoutsEditorState, uid: string, tag: CollectionLayoutTag): LayoutsEditorState {
  return mapOption(state, uid, (option) => ({
    ...option,
    tags: option.tags.includes(tag) ? option.tags.filter((entry) => entry !== tag) : [...option.tags, tag],
  }));
}

export function setOptionText(state: LayoutsEditorState, uid: string, locale: Locale, value: string): LayoutsEditorState {
  return mapOption(state, uid, (option) => ({ ...option, note: { ...option.note, [locale]: value } }));
}

/** The id every setup gets on export, by uid. */
export function exportIds(state: LayoutsEditorState): Map<string, string> {
  const taken = new Set(state.setups.map((setup) => setup.id).filter(Boolean));
  const ids = new Map<string, string>();
  for (const setup of state.setups) {
    let id = setup.id;
    if (!id) {
      id = setupIdFrom(setup.title[DEFAULT_LOCALE].trim(), taken);
      taken.add(id);
    }
    ids.set(setup.uid, id);
  }
  return ids;
}

export function exportLayouts(state: LayoutsEditorState): CollectionLayoutsData {
  const ids = exportIds(state);
  return {
    setups: state.setups.map((setup): CollectionSetup => ({
      id: ids.get(setup.uid) ?? setup.id,
      credit: setup.credit.trim(),
      tags: [...setup.tags],
      title: setup.title[DEFAULT_LOCALE].trim(),
      lede: setup.lede[DEFAULT_LOCALE].trim(),
      notes: setup.notes.map((note) => note.text[DEFAULT_LOCALE].trim()).filter(Boolean),
      slots: { ...setup.slots },
    })),
    options: state.options.map((option): CollectionOption => ({
      age: option.age,
      item: option.item,
      name: option.name.trim(),
      tags: [...option.tags],
      note: option.note[DEFAULT_LOCALE].trim(),
    })),
  };
}

/** One line per field, so a changed slot or note is a small diff. */
export function serializeLayoutsData(data: CollectionLayoutsData): string {
  const lines = ["{", `  "setups": [`];
  data.setups.forEach((setup, index) => {
    const slots = COLLECTION_AGES.map((age) => `${json(age)}: ${json(setup.slots[age] ?? "")}`).join(", ");
    lines.push(
      "    {",
      `      "id": ${json(setup.id)},`,
      `      "credit": ${json(setup.credit)},`,
      `      "tags": [${setup.tags.map(json).join(", ")}],`,
      `      "title": ${json(setup.title)},`,
      `      "lede": ${json(setup.lede)},`,
      `      "notes": [${setup.notes.map(json).join(", ")}],`,
      `      "slots": { ${slots} }`,
      `    }${index < data.setups.length - 1 ? "," : ""}`,
    );
  });
  lines.push("  ],", `  "options": [`);
  data.options.forEach((option, index) => {
    lines.push(
      "    {",
      `      "age": ${json(option.age)},`,
      `      "item": ${json(option.item)},`,
      `      "name": ${json(option.name)},`,
      `      "tags": [${option.tags.map(json).join(", ")}],`,
      `      "note": ${json(option.note)}`,
      `    }${index < data.options.length - 1 ? "," : ""}`,
    );
  });
  lines.push("  ]", "}", "");
  return lines.join("\n");
}

export function exportedSetupTexts(state: LayoutsEditorState): Record<Locale, SetupTexts> {
  const ids = exportIds(state);
  return mapLocales((locale) => {
    const catalog: SetupTexts = {};
    if (locale === DEFAULT_LOCALE) return catalog;
    for (const setup of state.setups) {
      const entry: SetupTexts[string] = {};
      const title = setup.title[locale]?.trim();
      const lede = setup.lede[locale]?.trim();
      const notes = setup.notes.map((note) => note.text[locale]?.trim() ?? "");
      if (title) entry.title = title;
      if (lede) entry.lede = lede;
      if (notes.some(Boolean)) entry.notes = notes;
      if (Object.keys(entry).length > 0) catalog[ids.get(setup.uid) ?? setup.id] = entry;
    }
    return catalog;
  });
}

export function exportedOptionTexts(state: LayoutsEditorState): Record<Locale, OptionTexts> {
  return mapLocales((locale) => {
    const catalog: OptionTexts = {};
    if (locale === DEFAULT_LOCALE) return catalog;
    for (const option of state.options) {
      const note = option.note[locale]?.trim();
      if (note) catalog[option.item] = { note };
    }
    return catalog;
  });
}

/** The `setupTexts` and `optionTexts` blocks to paste into each dictionary. */
export function layoutTextBlocks(state: LayoutsEditorState): Record<Locale, string> {
  const setups = exportedSetupTexts(state);
  const options = exportedOptionTexts(state);
  return mapLocales((locale) =>
    [
      `      setupTexts: ${dictionaryLiteral(setups[locale], "      ")},`,
      `      optionTexts: ${dictionaryLiteral(options[locale], "      ")},`,
    ].join("\n"),
  );
}

/** Setups and collections that differ from what is published, counting a removal once. */
export function countLayoutChanges(published: LayoutsEditorState, draft: LayoutsEditorState): number {
  const rows = (state: LayoutsEditorState) => {
    const data = exportLayouts(state);
    const setupTexts = exportedSetupTexts(state);
    const optionTexts = exportedOptionTexts(state);
    const map = new Map<string, string>();
    for (const setup of data.setups) {
      map.set(`setup:${setup.id}`, JSON.stringify([setup, ...LOCALE_CODES.map((locale) => setupTexts[locale][setup.id] ?? null)]));
    }
    for (const option of data.options) {
      map.set(`option:${option.item}`, JSON.stringify([option, ...LOCALE_CODES.map((locale) => optionTexts[locale][option.item] ?? null)]));
    }
    return map;
  };
  const before = rows(published);
  const after = rows(draft);
  let changes = 0;
  for (const [key, text] of after) if (before.get(key) !== text) changes += 1;
  for (const key of before.keys()) if (!after.has(key)) changes += 1;
  if (changes === 0 && [...before.keys()].join("\0") !== [...after.keys()].join("\0")) changes = 1;
  return changes;
}

export type LayoutProblem =
  | { code: "emptyTitle" }
  | { code: "duplicateTitle"; title: string }
  | { code: "emptySlot"; setup: string; age: CollectionAge }
  | { code: "unknownItem"; setup: string; item: string }
  | { code: "emptyNote"; item: string };

export function findLayoutProblems(state: LayoutsEditorState): LayoutProblem[] {
  const problems: LayoutProblem[] = [];
  const seen = new Set<string>();
  for (const setup of state.setups) {
    const title = setup.title[DEFAULT_LOCALE].trim();
    if (!title) problems.push({ code: "emptyTitle" });
    if (title && seen.has(title.toLowerCase())) problems.push({ code: "duplicateTitle", title });
    seen.add(title.toLowerCase());
    for (const age of COLLECTION_AGES) {
      const item = setup.slots[age]?.trim();
      if (!item) problems.push({ code: "emptySlot", setup: title || setup.id, age });
      else if (!KNOWN_ITEMS.has(item) && !state.options.some((option) => option.item === item)) {
        problems.push({ code: "unknownItem", setup: title || setup.id, item });
      }
    }
  }
  for (const option of state.options) {
    if (!option.note[DEFAULT_LOCALE].trim()) problems.push({ code: "emptyNote", item: option.name || option.item });
  }
  return problems;
}

export function parseLayoutsDraft(raw: string | null): LayoutsEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as LayoutsEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number") return null;
    if (!Array.isArray(value.setups) || !Array.isArray(value.options)) return null;
    const setups: EditorSetup[] = [];
    for (const setup of value.setups) {
      const title = parseTranslations(setup?.title);
      const lede = parseTranslations(setup?.lede);
      if (typeof setup?.uid !== "string" || typeof setup.id !== "string" || typeof setup.credit !== "string") return null;
      if (!title || !lede || !Array.isArray(setup.notes) || !Array.isArray(setup.tags)) return null;
      if (!setup.tags.every((tag: string) => isCollectionLayoutTag(tag))) return null;
      if (typeof setup.slots !== "object" || setup.slots === null) return null;
      const notes: EditorNote[] = [];
      for (const note of setup.notes) {
        const text = parseTranslations(note?.text);
        if (typeof note?.uid !== "string" || !text) return null;
        notes.push({ uid: note.uid, text });
      }
      setups.push({ ...setup, title, lede, notes, slots: { ...emptySlots(), ...setup.slots } });
    }
    const options: EditorOption[] = [];
    for (const option of value.options) {
      const note = parseTranslations(option?.note);
      if (typeof option?.uid !== "string" || typeof option.item !== "string" || typeof option.name !== "string") return null;
      if (!note || !isCollectionAge(option.age) || !Array.isArray(option.tags)) return null;
      if (!option.tags.every((tag: string) => isCollectionLayoutTag(tag))) return null;
      options.push({ ...option, note });
    }
    return { version: 1, setups, options, nextId: value.nextId };
  } catch {
    return null;
  }
}

const PUBLISHED_CATALOGS = catalogs();

/** The layouts and their translations as they are published right now. */
export const PUBLISHED_LAYOUTS = fromLayoutsData(COLLECTION_LAYOUTS_DATA, PUBLISHED_CATALOGS.setups, PUBLISHED_CATALOGS.options);
