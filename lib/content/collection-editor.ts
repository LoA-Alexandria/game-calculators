/**
 * Pure state logic for the Collection editor. The page only renders this state
 * and calls these functions, so adding items, pictures, and translations can
 * be tested without a browser.
 *
 * The editor works on a copy of `lib/data/collection.json`. A static site
 * cannot save for everyone, so the result leaves the browser as that JSON
 * file, any new pictures, and one `collectionTexts` block per dictionary, for
 * someone to commit. Uploaded pictures stay in the draft as data URLs.
 *
 * Name, skill name, and effect are kept in every language at once
 * (`Translations`); English is what goes into the JSON. Rarity, skill level,
 * and pictures are the same in every language.
 */

import {
  COLLECTION_DATA,
  COLLECTION_RARITIES,
  type CollectionData,
  type CollectionItem,
  type CollectionRarity,
  type CollectionTexts,
} from "./collection.ts";
import { DEFAULT_LOCALE, LOCALE_CODES, getDictionary, mapLocales, type Locale } from "../i18n/index.ts";
import { blankTranslations, dictionaryLiteral, parseTranslations, type Translations } from "../i18n/translations.ts";

/** A published picture has `file`; one uploaded in the editor has `data`. */
export type EditorImage = { uid: string; file?: string; data?: string };

export const COLLECTION_TEXT_FIELDS = ["name", "skillName", "skillText"] as const;
export type CollectionTextField = (typeof COLLECTION_TEXT_FIELDS)[number];

/** The two pictures an item has. */
export type CollectionPicture = "image" | "icon";

export type EditorItem = {
  uid: string;
  /** Empty for an item added in the editor until export derives it from the English name. */
  id: string;
  rarity: CollectionRarity;
  name: Translations;
  skillName: Translations;
  skillText: Translations;
  /** Kept as typed; export writes it as a number. */
  skillLevel: string;
  image: EditorImage | null;
  icon: EditorImage | null;
};

export type CollectionEditorState = {
  version: 1;
  items: EditorItem[];
  nextId: number;
};

/** Pictures are shrunk to these edge lengths in the browser before they are stored. */
export const COLLECTION_IMAGE_MAX_EDGE = 360;
export const COLLECTION_ICON_MAX_EDGE = 144;

const RARITY_SET = new Set<string>(COLLECTION_RARITIES);
const rarityIndex = (rarity: CollectionRarity) => COLLECTION_RARITIES.indexOf(rarity);
const json = (value: unknown) => JSON.stringify(value);

/** The published translations, so the editor starts from what the site shows. */
export function catalogsFromDictionaries(): Record<Locale, CollectionTexts> {
  return mapLocales((locale) => getDictionary(locale).guideEntries.collection.collectionTexts as CollectionTexts);
}

function translated(english: string, read: (locale: Locale) => string | undefined): Translations {
  return mapLocales((locale) => (locale === DEFAULT_LOCALE ? english : (read(locale) ?? "")));
}

export function fromCollectionData(data: CollectionData, catalogs: Partial<Record<Locale, CollectionTexts>> = {}): CollectionEditorState {
  let nextId = 1;
  const items = data.items.map((item): EditorItem => {
    const local = (locale: Locale) => catalogs[locale]?.[item.id];
    return {
      uid: `c${nextId++}`,
      id: item.id,
      rarity: item.rarity,
      name: translated(item.name, (locale) => local(locale)?.name),
      skillName: translated(item.skill.name, (locale) => local(locale)?.skillName),
      skillText: translated(item.skill.text, (locale) => local(locale)?.skillText),
      skillLevel: String(item.skill.level),
      image: item.image ? { uid: `i${nextId++}`, file: item.image } : null,
      icon: item.skill.icon ? { uid: `i${nextId++}`, file: item.skill.icon } : null,
    };
  });
  return { version: 1, items, nextId };
}

export function itemIdFrom(name: string, taken: Iterable<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "item";
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

export function itemByUid(state: CollectionEditorState, uid: string): EditorItem | undefined {
  return state.items.find((item) => item.uid === uid);
}

function mapItem(state: CollectionEditorState, uid: string, change: (item: EditorItem) => EditorItem): CollectionEditorState {
  return { ...state, items: state.items.map((item) => (item.uid === uid ? change(item) : item)) };
}

/** Index just after the last item of `rarity`, keeping the list grouped by rarity. */
function groupEnd(items: readonly EditorItem[], rarity: CollectionRarity): number {
  let index = 0;
  items.forEach((item, position) => {
    if (rarityIndex(item.rarity) <= rarityIndex(rarity)) index = position + 1;
  });
  return index;
}

export function addItem(state: CollectionEditorState, rarity: CollectionRarity): { state: CollectionEditorState; uid: string } {
  const uid = `c${state.nextId}`;
  const item: EditorItem = {
    uid,
    id: "",
    rarity,
    name: blankTranslations(),
    skillName: blankTranslations(),
    skillText: blankTranslations(),
    skillLevel: "1",
    image: null,
    icon: null,
  };
  const items = [...state.items];
  items.splice(groupEnd(items, rarity), 0, item);
  return { state: { ...state, items, nextId: state.nextId + 1 }, uid };
}

export function removeItem(state: CollectionEditorState, uid: string): CollectionEditorState {
  return { ...state, items: state.items.filter((item) => item.uid !== uid) };
}

export function setRarity(state: CollectionEditorState, uid: string, rarity: CollectionRarity): CollectionEditorState {
  const current = itemByUid(state, uid);
  if (!current || current.rarity === rarity) return state;
  const items = state.items.filter((item) => item.uid !== uid);
  items.splice(groupEnd(items, rarity), 0, { ...current, rarity });
  return { ...state, items };
}

export function setSkillLevel(state: CollectionEditorState, uid: string, level: string): CollectionEditorState {
  return mapItem(state, uid, (item) => ({ ...item, skillLevel: level }));
}

export function setItemText(
  state: CollectionEditorState,
  uid: string,
  field: CollectionTextField,
  locale: Locale,
  value: string,
): CollectionEditorState {
  return mapItem(state, uid, (item) => ({ ...item, [field]: { ...item[field], [locale]: value } }));
}

/** Swaps an item with its neighbour of the same rarity. */
export function moveItem(state: CollectionEditorState, uid: string, offset: -1 | 1): CollectionEditorState {
  const index = state.items.findIndex((item) => item.uid === uid);
  if (index < 0) return state;
  const rarity = state.items[index].rarity;
  let target = index + offset;
  while (target >= 0 && target < state.items.length && state.items[target].rarity !== rarity) target += offset;
  if (target < 0 || target >= state.items.length) return state;
  const items = [...state.items];
  [items[index], items[target]] = [items[target], items[index]];
  return { ...state, items };
}

export function setPicture(state: CollectionEditorState, uid: string, picture: CollectionPicture, data: string): CollectionEditorState {
  if (!isImageData(data) || !itemByUid(state, uid)) return state;
  const next = mapItem(state, uid, (item) => ({ ...item, [picture]: { uid: `i${state.nextId}`, data } }));
  return { ...next, nextId: state.nextId + 1 };
}

export function removePicture(state: CollectionEditorState, uid: string, picture: CollectionPicture): CollectionEditorState {
  return mapItem(state, uid, (item) => ({ ...item, [picture]: null }));
}

/** The id every item gets on export, by uid. */
export function exportIds(state: CollectionEditorState): Map<string, string> {
  const taken = new Set(state.items.map((item) => item.id).filter(Boolean));
  const ids = new Map<string, string>();
  for (const item of state.items) {
    let id = item.id;
    if (!id) {
      id = itemIdFrom(item.name[DEFAULT_LOCALE].trim(), taken);
      taken.add(id);
    }
    ids.set(item.uid, id);
  }
  return ids;
}

export function parseLevel(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const level = Number(trimmed);
  return level >= 1 ? level : null;
}

export type CollectionUpload = { file: string; data: string; item: string };
export type CollectionExport = { data: CollectionData; uploads: CollectionUpload[]; removedFiles: string[] };

/**
 * The collection as it would be committed. Each uploaded picture is named
 * after its item (`<id>.webp`, `<id>-skill.webp`), avoiding names already used.
 */
export function exportCollection(state: CollectionEditorState, published: CollectionData): CollectionExport {
  const ids = exportIds(state);
  const publishedFiles = published.items.flatMap((item) => [item.image, item.skill.icon]).filter(Boolean);
  const takenFiles = new Set([
    ...publishedFiles,
    ...state.items.flatMap((item) => [item.image?.file ?? "", item.icon?.file ?? ""]),
  ]);
  const uploads: CollectionUpload[] = [];

  const fileFor = (picture: EditorImage | null, stem: string, item: string): string => {
    if (!picture) return "";
    if (picture.file) return picture.file;
    const ext = extensionOf(picture.data ?? "");
    let file = `${stem}.${ext}`;
    let counter = 2;
    while (takenFiles.has(file)) file = `${stem}-${counter++}.${ext}`;
    takenFiles.add(file);
    uploads.push({ file, data: picture.data ?? "", item });
    return file;
  };

  const items = state.items.map((item): CollectionItem => {
    const id = ids.get(item.uid) ?? item.id;
    const label = item.name[DEFAULT_LOCALE].trim() || id;
    return {
      id,
      name: item.name[DEFAULT_LOCALE].trim(),
      rarity: item.rarity,
      image: fileFor(item.image, id, label),
      skill: {
        name: item.skillName[DEFAULT_LOCALE].trim(),
        level: parseLevel(item.skillLevel) ?? 1,
        text: item.skillText[DEFAULT_LOCALE].trim(),
        icon: fileFor(item.icon, `${id}-skill`, label),
      },
    };
  });

  const kept = new Set(items.flatMap((item) => [item.image, item.skill.icon]));
  const removedFiles = [...new Set(publishedFiles)].filter((file) => !kept.has(file));
  return { data: { items }, uploads, removedFiles };
}

/** One line per item, so a changed effect is a one-line diff. */
export function serializeCollectionData(data: CollectionData): string {
  const rows = data.items.map((item, index, all) => {
    const skill = `{ "name": ${json(item.skill.name)}, "level": ${item.skill.level}, "text": ${json(item.skill.text)}, "icon": ${json(item.skill.icon)} }`;
    const row = `{ "id": ${json(item.id)}, "name": ${json(item.name)}, "rarity": ${json(item.rarity)}, "image": ${json(item.image)}, "skill": ${skill} }`;
    return `    ${row}${index < all.length - 1 ? "," : ""}`;
  });
  return ["{", `  "items": [`, ...rows, "  ]", "}", ""].join("\n");
}

/** Translations keyed by item id, without the blanks. English stays in the JSON, so its catalog is empty. */
export function exportedCollectionTexts(state: CollectionEditorState): Record<Locale, CollectionTexts> {
  const ids = exportIds(state);
  return mapLocales((locale) => {
    const catalog: CollectionTexts = {};
    if (locale === DEFAULT_LOCALE) return catalog;
    for (const item of state.items) {
      const entry: CollectionTexts[string] = {};
      for (const field of COLLECTION_TEXT_FIELDS) {
        const value = item[field][locale]?.trim();
        if (value) entry[field] = value;
      }
      if (Object.keys(entry).length > 0) catalog[ids.get(item.uid) ?? item.id] = entry;
    }
    return catalog;
  });
}

/** The `collectionTexts` block to paste into each dictionary. */
export function collectionTextBlocks(state: CollectionEditorState): Record<Locale, string> {
  const catalogs = exportedCollectionTexts(state);
  return mapLocales((locale) => `      collectionTexts: ${dictionaryLiteral(catalogs[locale], "      ")},`);
}

/** How many items differ from the published collection, counting removals and a changed order once. */
export function countCollectionChanges(published: CollectionEditorState, draft: CollectionEditorState): number {
  const rows = (state: CollectionEditorState) => {
    const exported = exportCollection(state, COLLECTION_DATA).data.items;
    const texts = exportedCollectionTexts(state);
    return new Map(exported.map((row) => [row.id, JSON.stringify([row, ...LOCALE_CODES.map((locale) => texts[locale][row.id] ?? null)])]));
  };
  const before = rows(published);
  const after = rows(draft);
  let changes = 0;
  for (const [id, text] of after) if (before.get(id) !== text) changes += 1;
  for (const id of before.keys()) if (!after.has(id)) changes += 1;
  if (changes === 0 && [...before.keys()].join("\0") !== [...after.keys()].join("\0")) changes = 1;
  return changes;
}

export type CollectionProblem =
  | { code: "emptyName"; rarity: CollectionRarity }
  | { code: "duplicateName"; name: string }
  | { code: "missingImage"; item: string }
  | { code: "missingIcon"; item: string }
  | { code: "emptySkill"; item: string }
  | { code: "badLevel"; item: string };

export function findCollectionProblems(state: CollectionEditorState): CollectionProblem[] {
  const problems: CollectionProblem[] = [];
  const seen = new Set<string>();
  for (const item of state.items) {
    const name = item.name[DEFAULT_LOCALE].trim();
    const label = name || item.rarity;
    if (!name) problems.push({ code: "emptyName", rarity: item.rarity });
    if (name && seen.has(name.toLowerCase())) problems.push({ code: "duplicateName", name });
    seen.add(name.toLowerCase());
    if (!item.image) problems.push({ code: "missingImage", item: label });
    if (!item.icon) problems.push({ code: "missingIcon", item: label });
    if (!item.skillName[DEFAULT_LOCALE].trim() || !item.skillText[DEFAULT_LOCALE].trim()) problems.push({ code: "emptySkill", item: label });
    if (parseLevel(item.skillLevel) === null) problems.push({ code: "badLevel", item: label });
  }
  return problems;
}

function parsePicture(value: unknown): EditorImage | null | undefined {
  if (value === null) return null;
  const image = value as EditorImage;
  if (typeof image?.uid !== "string") return undefined;
  const hasFile = typeof image.file === "string" && image.file.length > 0;
  if (hasFile === isImageData(image.data)) return undefined;
  return image;
}

export function parseCollectionDraft(raw: string | null): CollectionEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as CollectionEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.items)) return null;
    const items: EditorItem[] = [];
    for (const item of value.items) {
      if (typeof item?.uid !== "string" || typeof item.id !== "string" || !RARITY_SET.has(item.rarity)) return null;
      if (typeof item.skillLevel !== "string") return null;
      const name = parseTranslations(item.name);
      const skillName = parseTranslations(item.skillName);
      const skillText = parseTranslations(item.skillText);
      const image = parsePicture(item.image);
      const icon = parsePicture(item.icon);
      if (!name || !skillName || !skillText || image === undefined || icon === undefined) return null;
      items.push({ ...item, name, skillName, skillText, image, icon });
    }
    return { version: 1, items, nextId: value.nextId };
  } catch {
    return null;
  }
}

/** The collection and its translations as they are published right now. */
export const PUBLISHED_COLLECTION = fromCollectionData(COLLECTION_DATA, catalogsFromDictionaries());
