/**
 * Pure state logic for the anecdote editor. The page only renders this state
 * and calls these functions, so adding, editing, reordering, and exporting
 * anecdotes can be tested without a browser.
 *
 * The editor works on a copy of `lib/data/anecdotes.json`. A static site cannot
 * save for everyone, so the result leaves the browser as that JSON file, any
 * new pictures, and one `anecdoteTexts` block per dictionary, for someone to
 * commit. Uploaded pictures stay in the draft as data URLs until then.
 *
 * Every text is kept in all languages at once (`Translations`), so steps can
 * be added, removed, and moved without a translation drifting onto the wrong
 * step. English is what goes into the JSON.
 */

import {
  ANECDOTE_DATA,
  ANECDOTE_GROUPS,
  type Anecdote,
  type AnecdoteData,
  type AnecdoteGroup,
  type AnecdoteStepText,
  type AnecdoteText,
  type AnecdoteTexts,
} from "./anecdotes.ts";
import { DEFAULT_LOCALE, LOCALE_CODES, getDictionary, mapLocales, type Locale } from "../i18n/index.ts";
import { blankTranslations, dictionaryLiteral, parseTranslations, type Translations } from "../i18n/translations.ts";

/** A published picture has `file`; one uploaded in the editor has `data`. */
export type EditorImage = { uid: string; file?: string; data?: string };
export type EditorSubstep = { uid: string; text: Translations };
export type EditorStep = { uid: string; text: Translations; substeps: EditorSubstep[] };

/** The texts of an anecdote that are not steps. */
export const ANECDOTE_TEXT_FIELDS = ["name", "prerequisite", "reward", "note"] as const;
export type AnecdoteTextField = (typeof ANECDOTE_TEXT_FIELDS)[number];

export type EditorAnecdote = {
  uid: string;
  /** Empty for an anecdote added in the editor until export derives it from the name. */
  id: string;
  group: AnecdoteGroup;
  name: Translations;
  /** Uid of the anecdote to finish first, or empty. */
  after: string;
  prerequisite: Translations;
  reward: Translations;
  note: Translations;
  steps: EditorStep[];
  /** Comma-separated names, as typed. */
  thanks: string;
  image: EditorImage | null;
};

export type AnecdoteEditorState = {
  version: 1;
  anecdotes: EditorAnecdote[];
  nextId: number;
};

/** Pictures are shrunk to this edge length in the browser before they are stored. */
export const ANECDOTE_IMAGE_MAX_EDGE = 960;

/** The published translations, so the editor starts from what the site shows. */
export function catalogsFromDictionaries(): Record<Locale, AnecdoteTexts> {
  return mapLocales((locale) => getDictionary(locale).guideEntries.anecdotes.anecdoteTexts as AnecdoteTexts);
}

function translated(english: string, read: (locale: Locale) => string | undefined): Translations {
  return mapLocales((locale) => (locale === DEFAULT_LOCALE ? english : (read(locale) ?? "")));
}

export function fromAnecdoteData(
  data: AnecdoteData,
  catalogs: Partial<Record<Locale, AnecdoteTexts>> = {},
): AnecdoteEditorState {
  let nextId = 1;
  const uidById = new Map<string, string>();
  const anecdotes = data.anecdotes.map((anecdote): EditorAnecdote => {
    const uid = `a${nextId++}`;
    uidById.set(anecdote.id, uid);
    const local = (locale: Locale): AnecdoteText | undefined => catalogs[locale]?.[anecdote.id];
    return {
      uid,
      id: anecdote.id,
      group: anecdote.group,
      name: translated(anecdote.name, (locale) => local(locale)?.name),
      after: anecdote.after ?? "",
      prerequisite: translated(anecdote.prerequisite ?? "", (locale) => local(locale)?.prerequisite),
      reward: translated(anecdote.reward ?? "", (locale) => local(locale)?.reward),
      note: translated(anecdote.note ?? "", (locale) => local(locale)?.note),
      steps: anecdote.steps.map((step, index) => ({
        uid: `s${nextId++}`,
        text: translated(step.text, (locale) => local(locale)?.steps?.[index]?.text),
        substeps: (step.substeps ?? []).map((substep, position) => ({
          uid: `s${nextId++}`,
          text: translated(substep, (locale) => local(locale)?.steps?.[index]?.substeps?.[position]),
        })),
      })),
      thanks: (anecdote.thanks ?? []).join(", "),
      image: anecdote.image ? { uid: `i${nextId++}`, file: anecdote.image } : null,
    };
  });
  // `after` holds an id in the JSON and a uid in the editor, so renaming or adding an anecdote keeps the link.
  for (const anecdote of anecdotes) anecdote.after = uidById.get(anecdote.after) ?? "";
  return { version: 1, anecdotes, nextId };
}

export function anecdoteIdFrom(name: string, taken: Iterable<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "anecdote";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

/** Uploads are re-encoded in the browser, so only these raster types are kept. */
const IMAGE_DATA = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

export function isImageData(value: unknown): value is string {
  return typeof value === "string" && IMAGE_DATA.test(value);
}

function extensionOf(dataUrl: string): string {
  const mime = IMAGE_DATA.exec(dataUrl)?.[1] ?? "webp";
  return mime === "jpeg" ? "jpg" : mime;
}

/** The id every anecdote gets on export, by uid. */
export function exportIds(state: AnecdoteEditorState): Map<string, string> {
  const taken = new Set(state.anecdotes.map((anecdote) => anecdote.id).filter(Boolean));
  const ids = new Map<string, string>();
  for (const anecdote of state.anecdotes) {
    let id = anecdote.id;
    if (!id) {
      id = anecdoteIdFrom(anecdote.name[DEFAULT_LOCALE].trim(), taken);
      taken.add(id);
    }
    ids.set(anecdote.uid, id);
  }
  return ids;
}

export function thanksList(thanks: string): string[] {
  return thanks.split(",").map((name) => name.trim()).filter(Boolean);
}

export type AnecdoteUpload = { file: string; data: string; anecdote: string };
export type AnecdoteExport = { data: AnecdoteData; uploads: AnecdoteUpload[]; removedFiles: string[] };

/**
 * The list as it would be committed. Empty steps are left out, and each
 * uploaded picture gets a file name from the anecdote's id.
 */
export function exportAnecdotes(state: AnecdoteEditorState, published: AnecdoteData): AnecdoteExport {
  const ids = exportIds(state);
  const publishedFiles = published.anecdotes.map((anecdote) => anecdote.image ?? "").filter(Boolean);
  const takenFiles = new Set([...publishedFiles, ...state.anecdotes.map((anecdote) => anecdote.image?.file ?? "").filter(Boolean)]);
  const uploads: AnecdoteUpload[] = [];

  const anecdotes = state.anecdotes.map((anecdote): Anecdote => {
    const id = ids.get(anecdote.uid) ?? anecdote.id;
    const english = (text: Translations) => text[DEFAULT_LOCALE].trim();
    let image = anecdote.image?.file ?? "";
    if (!image && anecdote.image?.data) {
      const ext = extensionOf(anecdote.image.data);
      image = `${id}.${ext}`;
      let counter = 2;
      while (takenFiles.has(image)) image = `${id}-${counter++}.${ext}`;
      takenFiles.add(image);
      uploads.push({ file: image, data: anecdote.image.data, anecdote: english(anecdote.name) || id });
    }
    const steps = anecdote.steps
      .map((step) => {
        const substeps = step.substeps.map((substep) => english(substep.text)).filter(Boolean);
        return { text: english(step.text), ...(substeps.length > 0 ? { substeps } : {}) };
      })
      .filter((step) => step.text || step.substeps);
    const after = anecdote.after ? ids.get(anecdote.after) : undefined;
    const thanks = thanksList(anecdote.thanks);
    // Key order is the order `lib/data/anecdotes.json` is written in.
    return {
      id,
      group: anecdote.group,
      name: english(anecdote.name),
      ...(after ? { after } : {}),
      ...(english(anecdote.prerequisite) ? { prerequisite: english(anecdote.prerequisite) } : {}),
      ...(english(anecdote.reward) ? { reward: english(anecdote.reward) } : {}),
      steps,
      ...(english(anecdote.note) ? { note: english(anecdote.note) } : {}),
      ...(thanks.length > 0 ? { thanks } : {}),
      ...(image ? { image } : {}),
    };
  });

  const kept = new Set(anecdotes.map((anecdote) => anecdote.image ?? "").filter(Boolean));
  const removedFiles = [...new Set(publishedFiles)].filter((file) => !kept.has(file));
  return { data: { anecdotes }, uploads, removedFiles };
}

export function serializeAnecdoteData(data: AnecdoteData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** Drops trailing blanks so a translated first step does not drag empty entries along. */
function trimEnd<T>(items: T[], empty: (item: T) => boolean): T[] {
  const next = [...items];
  while (next.length > 0 && empty(next[next.length - 1])) next.pop();
  return next;
}

function textFor(anecdote: EditorAnecdote, locale: Locale): AnecdoteText | null {
  const entry: AnecdoteText = {};
  for (const field of ANECDOTE_TEXT_FIELDS) {
    const own = anecdote[field][locale].trim();
    // A translation of a text English does not have would never be shown.
    if (own && anecdote[field][DEFAULT_LOCALE].trim()) entry[field] = own;
  }
  const steps = trimEnd(
    anecdote.steps
      .filter((step) => step.text[DEFAULT_LOCALE].trim() || step.substeps.some((substep) => substep.text[DEFAULT_LOCALE].trim()))
      .map((step): AnecdoteStepText => {
        const substeps = trimEnd(
          step.substeps.filter((substep) => substep.text[DEFAULT_LOCALE].trim()).map((substep) => substep.text[locale].trim()),
          (text) => !text,
        );
        const text = step.text[locale].trim();
        return { ...(text ? { text } : {}), ...(substeps.length > 0 ? { substeps } : {}) };
      }),
    (step) => !step.text && !step.substeps,
  );
  if (steps.length > 0) entry.steps = steps;
  return Object.keys(entry).length > 0 ? entry : null;
}

/** Translations keyed by anecdote id, without the blanks. English stays in the JSON, so its catalog is empty. */
export function exportedAnecdoteTexts(state: AnecdoteEditorState): Record<Locale, AnecdoteTexts> {
  const ids = exportIds(state);
  return mapLocales((locale) => {
    const catalog: AnecdoteTexts = {};
    if (locale === DEFAULT_LOCALE) return catalog;
    for (const anecdote of state.anecdotes) {
      const entry = textFor(anecdote, locale);
      if (entry) catalog[ids.get(anecdote.uid) ?? anecdote.id] = entry;
    }
    return catalog;
  });
}

/** The `anecdoteTexts` block to paste into each dictionary. */
export function anecdoteTextBlocks(state: AnecdoteEditorState): Record<Locale, string> {
  const catalogs = exportedAnecdoteTexts(state);
  return mapLocales((locale) => `      anecdoteTexts: ${dictionaryLiteral(catalogs[locale], "      ")},`);
}

/** How many anecdotes differ from the published list, counting removals and a changed order once. */
export function countAnecdoteChanges(published: AnecdoteEditorState, draft: AnecdoteEditorState): number {
  const rows = (state: AnecdoteEditorState) => {
    const exported = exportAnecdotes(state, ANECDOTE_DATA).data.anecdotes;
    const texts = exportedAnecdoteTexts(state);
    return new Map(exported.map((row) => [row.id, JSON.stringify([row, ...LOCALE_CODES.map((locale) => texts[locale][row.id] ?? null)])]));
  };
  const before = rows(published);
  const after = rows(draft);
  let changes = 0;
  for (const [id, json] of after) if (before.get(id) !== json) changes += 1;
  for (const id of before.keys()) if (!after.has(id)) changes += 1;
  if (changes === 0 && [...before.keys()].join("\0") !== [...after.keys()].join("\0")) changes = 1;
  return changes;
}

export function anecdoteByUid(state: AnecdoteEditorState, uid: string): EditorAnecdote | undefined {
  return state.anecdotes.find((anecdote) => anecdote.uid === uid);
}

function mapAnecdote(state: AnecdoteEditorState, uid: string, change: (anecdote: EditorAnecdote) => EditorAnecdote): AnecdoteEditorState {
  return { ...state, anecdotes: state.anecdotes.map((anecdote) => (anecdote.uid === uid ? change(anecdote) : anecdote)) };
}

export function addAnecdote(state: AnecdoteEditorState, group: AnecdoteGroup): { state: AnecdoteEditorState; uid: string } {
  const uid = `a${state.nextId}`;
  const anecdote: EditorAnecdote = {
    uid,
    id: "",
    group,
    name: blankTranslations(),
    after: "",
    prerequisite: blankTranslations(),
    reward: blankTranslations(),
    note: blankTranslations(),
    steps: [{ uid: `s${state.nextId + 1}`, text: blankTranslations(), substeps: [] }],
    thanks: "",
    image: null,
  };
  // A new anecdote goes after the last one of its group, so the groups stay together.
  const lastOfGroup = state.anecdotes.map((entry) => entry.group).lastIndexOf(group);
  const index = lastOfGroup < 0 ? state.anecdotes.length : lastOfGroup + 1;
  const anecdotes = [...state.anecdotes.slice(0, index), anecdote, ...state.anecdotes.slice(index)];
  return { uid, state: { ...state, anecdotes, nextId: state.nextId + 2 } };
}

/** Removes an anecdote; any anecdote that had to follow it no longer does. */
export function removeAnecdote(state: AnecdoteEditorState, uid: string): AnecdoteEditorState {
  if (state.anecdotes.length <= 1) return state;
  return {
    ...state,
    anecdotes: state.anecdotes
      .filter((anecdote) => anecdote.uid !== uid)
      .map((anecdote) => (anecdote.after === uid ? { ...anecdote, after: "" } : anecdote)),
  };
}

/** Moves an anecdote one place up or down within its group. */
export function moveAnecdote(state: AnecdoteEditorState, uid: string, offset: -1 | 1): AnecdoteEditorState {
  const index = state.anecdotes.findIndex((anecdote) => anecdote.uid === uid);
  if (index < 0) return state;
  const group = state.anecdotes[index].group;
  let target = index + offset;
  while (target >= 0 && target < state.anecdotes.length && state.anecdotes[target].group !== group) target += offset;
  if (target < 0 || target >= state.anecdotes.length) return state;
  const anecdotes = [...state.anecdotes];
  [anecdotes[index], anecdotes[target]] = [anecdotes[target], anecdotes[index]];
  return { ...state, anecdotes };
}

/** Changes the group; the anecdote moves to the end of its new group. */
export function setGroup(state: AnecdoteEditorState, uid: string, group: AnecdoteGroup): AnecdoteEditorState {
  const anecdote = anecdoteByUid(state, uid);
  if (!anecdote || anecdote.group === group) return state;
  const rest = state.anecdotes.filter((entry) => entry.uid !== uid);
  const lastOfGroup = rest.map((entry) => entry.group).lastIndexOf(group);
  const index = lastOfGroup < 0 ? rest.length : lastOfGroup + 1;
  return { ...state, anecdotes: [...rest.slice(0, index), { ...anecdote, group }, ...rest.slice(index)] };
}

/** The anecdotes `uid` may follow: any other one that does not already come after it. */
export function afterOptions(state: AnecdoteEditorState, uid: string): EditorAnecdote[] {
  const follows = (candidate: string): boolean => {
    const seen = new Set<string>();
    let current = anecdoteByUid(state, candidate);
    while (current?.after && !seen.has(current.uid)) {
      if (current.after === uid) return true;
      seen.add(current.uid);
      current = anecdoteByUid(state, current.after);
    }
    return false;
  };
  return state.anecdotes.filter((anecdote) => anecdote.uid !== uid && !follows(anecdote.uid));
}

export function setAfter(state: AnecdoteEditorState, uid: string, after: string): AnecdoteEditorState {
  if (after && !afterOptions(state, uid).some((anecdote) => anecdote.uid === after)) return state;
  return mapAnecdote(state, uid, (anecdote) => ({ ...anecdote, after }));
}

export function setThanks(state: AnecdoteEditorState, uid: string, thanks: string): AnecdoteEditorState {
  return mapAnecdote(state, uid, (anecdote) => ({ ...anecdote, thanks }));
}

export function setAnecdoteText(
  state: AnecdoteEditorState,
  uid: string,
  field: AnecdoteTextField,
  locale: Locale,
  value: string,
): AnecdoteEditorState {
  return mapAnecdote(state, uid, (anecdote) => ({ ...anecdote, [field]: { ...anecdote[field], [locale]: value } }));
}

function mapSteps(state: AnecdoteEditorState, uid: string, change: (steps: EditorStep[], nextId: number) => EditorStep[]): AnecdoteEditorState {
  return { ...mapAnecdote(state, uid, (anecdote) => ({ ...anecdote, steps: change(anecdote.steps, state.nextId) })), nextId: state.nextId + 1 };
}

/** Adds an empty step after `index`, or at the end. */
export function addStep(state: AnecdoteEditorState, uid: string, index?: number): AnecdoteEditorState {
  return mapSteps(state, uid, (steps, nextId) => {
    const at = index === undefined ? steps.length : index + 1;
    return [...steps.slice(0, at), { uid: `s${nextId}`, text: blankTranslations(), substeps: [] }, ...steps.slice(at)];
  });
}

export function removeStep(state: AnecdoteEditorState, uid: string, stepUid: string): AnecdoteEditorState {
  return mapAnecdote(state, uid, (anecdote) => ({ ...anecdote, steps: anecdote.steps.filter((step) => step.uid !== stepUid) }));
}

export function moveStep(state: AnecdoteEditorState, uid: string, stepUid: string, offset: -1 | 1): AnecdoteEditorState {
  return mapAnecdote(state, uid, (anecdote) => {
    const index = anecdote.steps.findIndex((step) => step.uid === stepUid);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= anecdote.steps.length) return anecdote;
    const steps = [...anecdote.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    return { ...anecdote, steps };
  });
}

function mapStep(state: AnecdoteEditorState, uid: string, stepUid: string, change: (step: EditorStep) => EditorStep): AnecdoteEditorState {
  return mapAnecdote(state, uid, (anecdote) => ({
    ...anecdote,
    steps: anecdote.steps.map((step) => (step.uid === stepUid ? change(step) : step)),
  }));
}

export function setStepText(state: AnecdoteEditorState, uid: string, stepUid: string, locale: Locale, value: string): AnecdoteEditorState {
  return mapStep(state, uid, stepUid, (step) => ({ ...step, text: { ...step.text, [locale]: value } }));
}

export function addSubstep(state: AnecdoteEditorState, uid: string, stepUid: string): AnecdoteEditorState {
  const next = mapStep(state, uid, stepUid, (step) => ({
    ...step,
    substeps: [...step.substeps, { uid: `s${state.nextId}`, text: blankTranslations() }],
  }));
  return { ...next, nextId: state.nextId + 1 };
}

export function removeSubstep(state: AnecdoteEditorState, uid: string, stepUid: string, substepUid: string): AnecdoteEditorState {
  return mapStep(state, uid, stepUid, (step) => ({ ...step, substeps: step.substeps.filter((substep) => substep.uid !== substepUid) }));
}

export function setSubstepText(
  state: AnecdoteEditorState,
  uid: string,
  stepUid: string,
  substepUid: string,
  locale: Locale,
  value: string,
): AnecdoteEditorState {
  return mapStep(state, uid, stepUid, (step) => ({
    ...step,
    substeps: step.substeps.map((substep) => (substep.uid === substepUid ? { ...substep, text: { ...substep.text, [locale]: value } } : substep)),
  }));
}

export function setImage(state: AnecdoteEditorState, uid: string, data: string): AnecdoteEditorState {
  if (!isImageData(data)) return state;
  return { ...mapAnecdote(state, uid, (anecdote) => ({ ...anecdote, image: { uid: `i${state.nextId}`, data } })), nextId: state.nextId + 1 };
}

export function removeImage(state: AnecdoteEditorState, uid: string): AnecdoteEditorState {
  return mapAnecdote(state, uid, (anecdote) => ({ ...anecdote, image: null }));
}

export type AnecdoteProblem =
  | { code: "emptyName"; group: AnecdoteGroup }
  | { code: "duplicateName"; name: string }
  | { code: "nothingToDo"; anecdote: string }
  | { code: "emptyStep"; anecdote: string; step: number }
  | { code: "emptySubstep"; anecdote: string; step: number };

export function findAnecdoteProblems(state: AnecdoteEditorState): AnecdoteProblem[] {
  const problems: AnecdoteProblem[] = [];
  const names = new Set<string>();
  for (const anecdote of state.anecdotes) {
    const name = anecdote.name[DEFAULT_LOCALE].trim();
    if (!name) problems.push({ code: "emptyName", group: anecdote.group });
    else if (names.has(name.toLowerCase())) problems.push({ code: "duplicateName", name });
    names.add(name.toLowerCase());
    const label = name || "—";
    if (anecdote.steps.length === 0 && !anecdote.prerequisite[DEFAULT_LOCALE].trim() && !anecdote.after) {
      problems.push({ code: "nothingToDo", anecdote: label });
    }
    anecdote.steps.forEach((step, index) => {
      if (!step.text[DEFAULT_LOCALE].trim()) problems.push({ code: "emptyStep", anecdote: label, step: index + 1 });
      if (step.substeps.some((substep) => !substep.text[DEFAULT_LOCALE].trim())) {
        problems.push({ code: "emptySubstep", anecdote: label, step: index + 1 });
      }
    });
  }
  return problems;
}

const GROUP_SET = new Set<string>(ANECDOTE_GROUPS);

function parseImage(value: unknown): EditorImage | null | undefined {
  if (value === null) return null;
  const image = value as EditorImage;
  if (typeof image?.uid !== "string") return undefined;
  if (image.file !== undefined && typeof image.file !== "string") return undefined;
  if (image.data !== undefined && !isImageData(image.data)) return undefined;
  return image.file || image.data ? image : undefined;
}

/** A saved draft, or null when it is missing or does not fit the current shape. */
export function parseAnecdoteDraft(raw: string | null): AnecdoteEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as AnecdoteEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.anecdotes)) return null;
    const anecdotes: EditorAnecdote[] = [];
    for (const entry of value.anecdotes) {
      if (typeof entry?.uid !== "string" || typeof entry.id !== "string" || !GROUP_SET.has(entry.group)) return null;
      if (typeof entry.after !== "string" || typeof entry.thanks !== "string" || !Array.isArray(entry.steps)) return null;
      const image = parseImage(entry.image);
      if (image === undefined) return null;
      const fields = {} as Record<AnecdoteTextField, Translations>;
      for (const field of ANECDOTE_TEXT_FIELDS) {
        // A language added since the draft was saved starts empty.
        const text = parseTranslations(entry[field]);
        if (!text) return null;
        fields[field] = text;
      }
      const steps: EditorStep[] = [];
      for (const step of entry.steps) {
        const text = parseTranslations(step?.text);
        if (typeof step?.uid !== "string" || !text || !Array.isArray(step.substeps)) return null;
        const substeps: EditorSubstep[] = [];
        for (const substep of step.substeps) {
          const substepText = parseTranslations(substep?.text);
          if (typeof substep?.uid !== "string" || !substepText) return null;
          substeps.push({ uid: substep.uid, text: substepText });
        }
        steps.push({ uid: step.uid, text, substeps });
      }
      anecdotes.push({ uid: entry.uid, id: entry.id, group: entry.group, after: entry.after, thanks: entry.thanks, image, steps, ...fields });
    }
    return { version: 1, anecdotes, nextId: value.nextId };
  } catch {
    return null;
  }
}

export const PUBLISHED_ANECDOTES = fromAnecdoteData(ANECDOTE_DATA, catalogsFromDictionaries());
