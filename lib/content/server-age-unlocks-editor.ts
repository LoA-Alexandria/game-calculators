/**
 * Pure state logic for the Server age unlocks editor. The page only renders
 * this state and calls these functions, so adding milestones and events,
 * uploading pictures, and exporting can be tested without a browser.
 *
 * The editor works on a copy of `lib/data/server-age-unlocks.json`. A static
 * site cannot save for everyone, so the result leaves the browser as that JSON
 * file, any new pictures, and one `eventTexts` block per dictionary. Uploaded
 * pictures stay in the draft as data URLs until then.
 *
 * Every text is kept in all languages at once (`Translations`). English is
 * what goes into the JSON; other languages export as `eventTexts`.
 */

import {
  AGE_UNLOCKS_DATA,
  type AgeEvent,
  type AgeMilestone,
  type AgeUnlockText,
  type AgeUnlockTexts,
  type AgeUnlocksData,
} from "./server-age-unlocks.ts";
import { isGuideEntryId, type GuideEntryId } from "./guides.ts";
import { DEFAULT_LOCALE, LOCALE_CODES, getDictionary, mapLocales, type Locale } from "../i18n/index.ts";
import { blankTranslations, dictionaryLiteral, parseTranslations, type Translations } from "../i18n/translations.ts";
import en from "../i18n/dictionaries/en.ts";

/** A published picture has `file`; one uploaded in the editor has `data`. */
export type EditorImage = { uid: string; file?: string; data?: string };

export const EVENT_TEXT_FIELDS = ["name", "detail", "description"] as const;
export type EventTextField = (typeof EVENT_TEXT_FIELDS)[number];

export type EditorAgeEvent = {
  uid: string;
  /** Empty for an event added in the editor until export derives it from the name. */
  id: string;
  name: Translations;
  detail: Translations;
  description: Translations;
  oneTime: boolean;
  relatedGuide: string;
  image: EditorImage | null;
};

export type EditorAgeMilestone = {
  uid: string;
  id: string;
  day: string;
  label: Translations;
  events: EditorAgeEvent[];
};

export type AgeUnlocksEditorState = {
  version: 1;
  milestones: EditorAgeMilestone[];
  unconfirmed: EditorAgeEvent[];
  nextId: number;
};

/** Pictures are shrunk to this edge length in the browser before they are stored. */
export const AGE_UNLOCK_IMAGE_MAX_EDGE = 960;

/** The published translations, so the editor starts from what the site shows. */
export function catalogsFromDictionaries(): Record<Locale, AgeUnlockTexts> {
  return mapLocales((locale) => getDictionary(locale).guideEntries.serverAgeUnlocks.eventTexts as AgeUnlockTexts);
}

function translated(english: string, read: (locale: Locale) => string | undefined): Translations {
  return mapLocales((locale) => (locale === DEFAULT_LOCALE ? english : (read(locale) ?? "")));
}

function fromEvent(
  event: AgeEvent,
  nextId: { n: number },
  catalogs: Partial<Record<Locale, AgeUnlockTexts>>,
): EditorAgeEvent {
  const uid = `e${nextId.n++}`;
  const local = (locale: Locale): AgeUnlockText | undefined => catalogs[locale]?.[event.id];
  return {
    uid,
    id: event.id,
    name: translated(event.name, (locale) => local(locale)?.name),
    detail: translated(event.detail ?? "", (locale) => local(locale)?.detail),
    description: translated(event.description ?? "", (locale) => local(locale)?.description),
    oneTime: Boolean(event.oneTime),
    relatedGuide: event.relatedGuide ?? "",
    image: event.image ? { uid: `i${nextId.n++}`, file: event.image } : null,
  };
}

export function fromAgeUnlocksData(
  data: AgeUnlocksData,
  catalogs: Partial<Record<Locale, AgeUnlockTexts>> = {},
): AgeUnlocksEditorState {
  const nextId = { n: 1 };
  const milestones = data.milestones.map((milestone): EditorAgeMilestone => {
    const uid = `m${nextId.n++}`;
    const local = (locale: Locale) => catalogs[locale]?.[milestone.id];
    return {
      uid,
      id: milestone.id,
      day: milestone.day != null ? String(milestone.day) : "",
      label: translated(milestone.label ?? "", (locale) => local(locale)?.label),
      events: milestone.events.map((event) => fromEvent(event, nextId, catalogs)),
    };
  });
  const unconfirmed = data.unconfirmed.map((event) => fromEvent(event, nextId, catalogs));
  return { version: 1, milestones, unconfirmed, nextId: nextId.n };
}

export function ageEventIdFrom(name: string, taken: Iterable<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "event";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

export function milestoneIdFrom(day: string, label: string, taken: Iterable<string>): string {
  const dayNumber = Number(day);
  if (Number.isFinite(dayNumber) && dayNumber > 0 && String(Math.trunc(dayNumber)) === day.trim()) {
    return ageEventIdFrom(`day-${Math.trunc(dayNumber)}`, taken);
  }
  return ageEventIdFrom(label || "milestone", taken);
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

function everyEvent(state: AgeUnlocksEditorState): EditorAgeEvent[] {
  return [...state.milestones.flatMap((milestone) => milestone.events), ...state.unconfirmed];
}

/** The id every row gets on export, by uid. */
export function exportIds(state: AgeUnlocksEditorState): Map<string, string> {
  const taken = new Set(
    [
      ...state.milestones.map((milestone) => milestone.id),
      ...everyEvent(state).map((event) => event.id),
    ].filter(Boolean),
  );
  const ids = new Map<string, string>();
  for (const milestone of state.milestones) {
    let id = milestone.id;
    if (!id) {
      id = milestoneIdFrom(milestone.day, milestone.label[DEFAULT_LOCALE], taken);
      taken.add(id);
    }
    ids.set(milestone.uid, id);
  }
  for (const event of everyEvent(state)) {
    let id = event.id;
    if (!id) {
      id = ageEventIdFrom(event.name[DEFAULT_LOCALE].trim(), taken);
      taken.add(id);
    }
    ids.set(event.uid, id);
  }
  return ids;
}

export type AgeUnlockUpload = { file: string; data: string; event: string };
export type AgeUnlockExport = { data: AgeUnlocksData; uploads: AgeUnlockUpload[]; removedFiles: string[] };

function publishedImages(data: AgeUnlocksData): string[] {
  return [
    ...data.milestones.flatMap((milestone) => milestone.events.map((event) => event.image ?? "")),
    ...data.unconfirmed.map((event) => event.image ?? ""),
  ].filter(Boolean);
}

function exportEvent(
  event: EditorAgeEvent,
  ids: Map<string, string>,
  takenFiles: Set<string>,
  uploads: AgeUnlockUpload[],
): AgeEvent {
  const id = ids.get(event.uid) ?? event.id;
  const english = (text: Translations) => text[DEFAULT_LOCALE].trim();
  let image = event.image?.file ?? "";
  if (!image && event.image?.data) {
    const ext = extensionOf(event.image.data);
    image = `${id}.${ext}`;
    let counter = 2;
    while (takenFiles.has(image)) image = `${id}-${counter++}.${ext}`;
    takenFiles.add(image);
    uploads.push({ file: image, data: event.image.data, event: english(event.name) || id });
  }
  const related = event.relatedGuide.trim();
  // Key order matches lib/data/server-age-unlocks.json.
  return {
    id,
    name: english(event.name),
    ...(english(event.detail) ? { detail: english(event.detail) } : {}),
    ...(english(event.description) ? { description: english(event.description) } : {}),
    ...(event.oneTime ? { oneTime: true } : {}),
    ...(related && isGuideEntryId(related, en.guideEntries) ? { relatedGuide: related as GuideEntryId } : {}),
    ...(image ? { image } : {}),
  };
}

/**
 * The list as it would be committed. Uploaded pictures get a file name from
 * the event id.
 */
export function exportAgeUnlocks(state: AgeUnlocksEditorState, published: AgeUnlocksData): AgeUnlockExport {
  const ids = exportIds(state);
  const publishedFiles = publishedImages(published);
  const takenFiles = new Set([
    ...publishedFiles,
    ...everyEvent(state).map((event) => event.image?.file ?? "").filter(Boolean),
  ]);
  const uploads: AgeUnlockUpload[] = [];

  const milestones = state.milestones.map((milestone): AgeMilestone => {
    const id = ids.get(milestone.uid) ?? milestone.id;
    const dayRaw = milestone.day.trim();
    const dayNumber = Number(dayRaw);
    const day =
      dayRaw && Number.isFinite(dayNumber) && dayNumber > 0 && String(Math.trunc(dayNumber)) === dayRaw
        ? Math.trunc(dayNumber)
        : undefined;
    const label = milestone.label[DEFAULT_LOCALE].trim();
    return {
      id,
      ...(day != null ? { day } : {}),
      ...(label ? { label } : {}),
      events: milestone.events.map((event) => exportEvent(event, ids, takenFiles, uploads)),
    };
  });
  const unconfirmed = state.unconfirmed.map((event) => exportEvent(event, ids, takenFiles, uploads));
  const kept = new Set(
    [...milestones.flatMap((milestone) => milestone.events), ...unconfirmed]
      .map((event) => event.image ?? "")
      .filter(Boolean),
  );
  const removedFiles = [...new Set(publishedFiles)].filter((file) => !kept.has(file));
  return { data: { milestones, unconfirmed }, uploads, removedFiles };
}

export function serializeAgeUnlocksData(data: AgeUnlocksData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function textForEvent(event: EditorAgeEvent, locale: Locale): AgeUnlockText | null {
  const entry: AgeUnlockText = {};
  for (const field of EVENT_TEXT_FIELDS) {
    const own = event[field][locale].trim();
    if (own && event[field][DEFAULT_LOCALE].trim()) entry[field] = own;
  }
  return Object.keys(entry).length > 0 ? entry : null;
}

/** Translations keyed by milestone / event id. English stays in the JSON. */
export function exportedEventTexts(state: AgeUnlocksEditorState): Record<Locale, AgeUnlockTexts> {
  const ids = exportIds(state);
  return mapLocales((locale) => {
    const catalog: AgeUnlockTexts = {};
    if (locale === DEFAULT_LOCALE) return catalog;
    for (const milestone of state.milestones) {
      const label = milestone.label[locale].trim();
      if (label && milestone.label[DEFAULT_LOCALE].trim()) {
        catalog[ids.get(milestone.uid) ?? milestone.id] = { label };
      }
      for (const event of milestone.events) {
        const entry = textForEvent(event, locale);
        if (entry) catalog[ids.get(event.uid) ?? event.id] = entry;
      }
    }
    for (const event of state.unconfirmed) {
      const entry = textForEvent(event, locale);
      if (entry) catalog[ids.get(event.uid) ?? event.id] = entry;
    }
    return catalog;
  });
}

/** The `eventTexts` block to paste into each dictionary. */
export function eventTextBlocks(state: AgeUnlocksEditorState): Record<Locale, string> {
  const catalogs = exportedEventTexts(state);
  return mapLocales((locale) => `      eventTexts: ${dictionaryLiteral(catalogs[locale], "      ")},`);
}

/** How many milestones or events differ from the published list. */
export function countAgeUnlockChanges(published: AgeUnlocksEditorState, draft: AgeUnlocksEditorState): number {
  const rows = (state: AgeUnlocksEditorState) => {
    const exported = exportAgeUnlocks(state, AGE_UNLOCKS_DATA).data;
    const texts = exportedEventTexts(state);
    const keys = [
      ...exported.milestones.map((milestone) => milestone.id),
      ...exported.milestones.flatMap((milestone) => milestone.events.map((event) => event.id)),
      ...exported.unconfirmed.map((event) => event.id),
    ];
    const payload = JSON.stringify([
      exported,
      ...LOCALE_CODES.map((locale) => Object.fromEntries(keys.map((id) => [id, texts[locale][id] ?? null]))),
    ]);
    return { keys, payload };
  };
  const before = rows(published);
  const after = rows(draft);
  if (before.payload === after.payload) return 0;
  const beforeSet = new Set(before.keys);
  const afterSet = new Set(after.keys);
  let changes = 0;
  for (const id of afterSet) if (!beforeSet.has(id)) changes += 1;
  for (const id of beforeSet) if (!afterSet.has(id)) changes += 1;
  // Content edits without add/remove still count as at least one change.
  return Math.max(changes, 1);
}

export function milestoneByUid(state: AgeUnlocksEditorState, uid: string): EditorAgeMilestone | undefined {
  return state.milestones.find((milestone) => milestone.uid === uid);
}

export function eventByUid(state: AgeUnlocksEditorState, uid: string): EditorAgeEvent | undefined {
  return everyEvent(state).find((event) => event.uid === uid);
}

function blankEvent(uid: string): EditorAgeEvent {
  return {
    uid,
    id: "",
    name: blankTranslations(),
    detail: blankTranslations(),
    description: blankTranslations(),
    oneTime: false,
    relatedGuide: "",
    image: null,
  };
}

export function addMilestone(state: AgeUnlocksEditorState): { state: AgeUnlocksEditorState; uid: string } {
  const uid = `m${state.nextId}`;
  const milestone: EditorAgeMilestone = {
    uid,
    id: "",
    day: "",
    label: blankTranslations(),
    events: [blankEvent(`e${state.nextId + 1}`)],
  };
  return {
    uid,
    state: {
      ...state,
      milestones: [...state.milestones, milestone],
      nextId: state.nextId + 2,
    },
  };
}

export function removeMilestone(state: AgeUnlocksEditorState, uid: string): AgeUnlocksEditorState {
  if (state.milestones.length <= 1) return state;
  return { ...state, milestones: state.milestones.filter((milestone) => milestone.uid !== uid) };
}

export function moveMilestone(state: AgeUnlocksEditorState, uid: string, delta: -1 | 1): AgeUnlocksEditorState {
  const index = state.milestones.findIndex((milestone) => milestone.uid === uid);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= state.milestones.length) return state;
  const milestones = [...state.milestones];
  [milestones[index], milestones[next]] = [milestones[next], milestones[index]];
  return { ...state, milestones };
}

export function setMilestoneDay(state: AgeUnlocksEditorState, uid: string, day: string): AgeUnlocksEditorState {
  return {
    ...state,
    milestones: state.milestones.map((milestone) => (milestone.uid === uid ? { ...milestone, day } : milestone)),
  };
}

export function setMilestoneLabel(
  state: AgeUnlocksEditorState,
  uid: string,
  locale: Locale,
  value: string,
): AgeUnlocksEditorState {
  return {
    ...state,
    milestones: state.milestones.map((milestone) =>
      milestone.uid === uid ? { ...milestone, label: { ...milestone.label, [locale]: value } } : milestone,
    ),
  };
}

export function addEvent(
  state: AgeUnlocksEditorState,
  target: { kind: "milestone"; uid: string } | { kind: "unconfirmed" },
): { state: AgeUnlocksEditorState; uid: string } {
  const uid = `e${state.nextId}`;
  const event = blankEvent(uid);
  if (target.kind === "unconfirmed") {
    return { uid, state: { ...state, unconfirmed: [...state.unconfirmed, event], nextId: state.nextId + 1 } };
  }
  return {
    uid,
    state: {
      ...state,
      milestones: state.milestones.map((milestone) =>
        milestone.uid === target.uid ? { ...milestone, events: [...milestone.events, event] } : milestone,
      ),
      nextId: state.nextId + 1,
    },
  };
}

function mapEvent(
  state: AgeUnlocksEditorState,
  uid: string,
  change: (event: EditorAgeEvent) => EditorAgeEvent,
): AgeUnlocksEditorState {
  return {
    ...state,
    milestones: state.milestones.map((milestone) => ({
      ...milestone,
      events: milestone.events.map((event) => (event.uid === uid ? change(event) : event)),
    })),
    unconfirmed: state.unconfirmed.map((event) => (event.uid === uid ? change(event) : event)),
  };
}

export function removeEvent(state: AgeUnlocksEditorState, uid: string): AgeUnlocksEditorState {
  const inMilestone = state.milestones.some((milestone) => milestone.events.some((event) => event.uid === uid));
  if (inMilestone) {
    return {
      ...state,
      milestones: state.milestones.map((milestone) => {
        if (!milestone.events.some((event) => event.uid === uid)) return milestone;
        if (milestone.events.length <= 1) return milestone;
        return { ...milestone, events: milestone.events.filter((event) => event.uid !== uid) };
      }),
    };
  }
  return { ...state, unconfirmed: state.unconfirmed.filter((event) => event.uid !== uid) };
}

export function moveEvent(state: AgeUnlocksEditorState, uid: string, delta: -1 | 1): AgeUnlocksEditorState {
  for (const milestone of state.milestones) {
    const index = milestone.events.findIndex((event) => event.uid === uid);
    if (index < 0) continue;
    const next = index + delta;
    if (next < 0 || next >= milestone.events.length) return state;
    const events = [...milestone.events];
    [events[index], events[next]] = [events[next], events[index]];
    return {
      ...state,
      milestones: state.milestones.map((entry) => (entry.uid === milestone.uid ? { ...entry, events } : entry)),
    };
  }
  const index = state.unconfirmed.findIndex((event) => event.uid === uid);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= state.unconfirmed.length) return state;
  const unconfirmed = [...state.unconfirmed];
  [unconfirmed[index], unconfirmed[next]] = [unconfirmed[next], unconfirmed[index]];
  return { ...state, unconfirmed };
}

export function setEventText(
  state: AgeUnlocksEditorState,
  uid: string,
  field: EventTextField,
  locale: Locale,
  value: string,
): AgeUnlocksEditorState {
  return mapEvent(state, uid, (event) => ({ ...event, [field]: { ...event[field], [locale]: value } }));
}

export function setOneTime(state: AgeUnlocksEditorState, uid: string, oneTime: boolean): AgeUnlocksEditorState {
  return mapEvent(state, uid, (event) => ({ ...event, oneTime }));
}

export function setRelatedGuide(state: AgeUnlocksEditorState, uid: string, relatedGuide: string): AgeUnlocksEditorState {
  return mapEvent(state, uid, (event) => ({ ...event, relatedGuide }));
}

export function setImage(state: AgeUnlocksEditorState, uid: string, image: EditorImage): AgeUnlocksEditorState {
  return mapEvent(state, uid, (event) => ({ ...event, image }));
}

export function removeImage(state: AgeUnlocksEditorState, uid: string): AgeUnlocksEditorState {
  return mapEvent(state, uid, (event) => ({ ...event, image: null }));
}

export type AgeUnlockProblem = { code: string; values?: Record<string, string | number> };

export function findAgeUnlockProblems(state: AgeUnlocksEditorState): AgeUnlockProblem[] {
  const problems: AgeUnlockProblem[] = [];
  const names = new Map<string, number>();
  if (state.milestones.length === 0) problems.push({ code: "noMilestones" });

  for (const milestone of state.milestones) {
    const day = milestone.day.trim();
    const label = milestone.label[DEFAULT_LOCALE].trim();
    if (!day && !label) problems.push({ code: "emptyMilestone", values: { milestone: milestone.id || milestone.uid } });
    if (day) {
      const number = Number(day);
      if (!Number.isFinite(number) || number <= 0 || String(Math.trunc(number)) !== day) {
        problems.push({ code: "badDay", values: { milestone: label || day || milestone.uid } });
      }
    }
    if (milestone.events.length === 0) {
      problems.push({ code: "emptyEvents", values: { milestone: label || day || milestone.uid } });
    }
    for (const event of milestone.events) {
      const name = event.name[DEFAULT_LOCALE].trim();
      if (!name) problems.push({ code: "emptyName", values: { where: label || day || "timeline" } });
      else names.set(name, (names.get(name) ?? 0) + 1);
      const related = event.relatedGuide.trim();
      if (related && !isGuideEntryId(related, en.guideEntries)) {
        problems.push({ code: "badGuide", values: { event: name || event.uid, guide: related } });
      }
    }
  }

  for (const event of state.unconfirmed) {
    const name = event.name[DEFAULT_LOCALE].trim();
    if (!name) problems.push({ code: "emptyName", values: { where: "unconfirmed" } });
    else names.set(name, (names.get(name) ?? 0) + 1);
    const related = event.relatedGuide.trim();
    if (related && !isGuideEntryId(related, en.guideEntries)) {
      problems.push({ code: "badGuide", values: { event: name || event.uid, guide: related } });
    }
  }

  for (const [name, count] of names) {
    if (count > 1) problems.push({ code: "duplicateName", values: { name } });
  }
  return problems;
}

function parseImage(value: unknown): EditorImage | null | undefined {
  if (value === null) return null;
  const image = value as EditorImage;
  if (typeof image?.uid !== "string") return undefined;
  if (image.file !== undefined && typeof image.file !== "string") return undefined;
  if (image.data !== undefined && !isImageData(image.data)) return undefined;
  return image.file || image.data ? image : undefined;
}

function parseEvent(entry: unknown): EditorAgeEvent | null {
  const event = entry as EditorAgeEvent;
  if (typeof event?.uid !== "string" || typeof event.id !== "string") return null;
  if (typeof event.oneTime !== "boolean" || typeof event.relatedGuide !== "string") return null;
  const image = parseImage(event.image);
  if (image === undefined) return null;
  const fields = {} as Record<EventTextField, Translations>;
  for (const field of EVENT_TEXT_FIELDS) {
    const text = parseTranslations(event[field]);
    if (!text) return null;
    fields[field] = text;
  }
  return { uid: event.uid, id: event.id, oneTime: event.oneTime, relatedGuide: event.relatedGuide, image, ...fields };
}

/** A saved draft, or null when it is missing or does not fit the current shape. */
export function parseAgeUnlockDraft(raw: string | null): AgeUnlocksEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as AgeUnlocksEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number") return null;
    if (!Array.isArray(value.milestones) || !Array.isArray(value.unconfirmed)) return null;
    const milestones: EditorAgeMilestone[] = [];
    for (const entry of value.milestones) {
      if (typeof entry?.uid !== "string" || typeof entry.id !== "string" || typeof entry.day !== "string") return null;
      if (!Array.isArray(entry.events)) return null;
      const label = parseTranslations(entry.label);
      if (!label) return null;
      const events: EditorAgeEvent[] = [];
      for (const event of entry.events) {
        const parsed = parseEvent(event);
        if (!parsed) return null;
        events.push(parsed);
      }
      milestones.push({ uid: entry.uid, id: entry.id, day: entry.day, label, events });
    }
    const unconfirmed: EditorAgeEvent[] = [];
    for (const event of value.unconfirmed) {
      const parsed = parseEvent(event);
      if (!parsed) return null;
      unconfirmed.push(parsed);
    }
    return { version: 1, milestones, unconfirmed, nextId: value.nextId };
  } catch {
    return null;
  }
}

export const PUBLISHED_AGE_UNLOCKS = fromAgeUnlocksData(AGE_UNLOCKS_DATA, catalogsFromDictionaries());

/** Guide ids editors can link an event to. */
export function relatedGuideOptions(): GuideEntryId[] {
  return Object.keys(en.guideEntries) as GuideEntryId[];
}
