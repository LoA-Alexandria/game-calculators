/**
 * Pure state logic for the Goddesses roster editor. The page only renders this
 * state and calls these functions, so adding goddesses, pictures, and
 * translations can be tested without a browser.
 *
 * The editor works on a copy of `lib/data/goddesses.json`. A static site
 * cannot save for everyone, so the result leaves the browser as that JSON file
 * plus any new pictures for someone to commit, the same way the Heroes editor
 * works. Uploaded pictures stay in the draft as data URLs until then.
 *
 * Names, rarities, marks, and pictures are the same in every language and
 * stay in that JSON, with the English affinity and obtain. Other languages
 * are kept per goddess and export as `goddessTexts` blocks for the
 * dictionaries.
 */

import { GODDESS_BANNER_IMAGES } from "./goddess-banner.ts";
import { GODDESS_LEVELING_DATA } from "./goddess-leveling.ts";
import { THEATER_DATA } from "./goddess-theater.ts";
import {
  GODDESS_DATA,
  GODDESS_RARITIES,
  type Goddess,
  type GoddessData,
  type GoddessRarity,
  type GoddessTexts,
} from "./goddesses.ts";
import { GODDESS_SKINS } from "./skins.ts";
import { DEFAULT_LOCALE, LOCALES, getDictionary, type Locale } from "../i18n/index.ts";

/** A published picture has `file`; one uploaded in the editor has `data`. */
export type EditorImage = { uid: string; file?: string; data?: string };

/** A goddess is either obtainable, gone for now, or unconfirmed — never both marks. */
export const GODDESS_MARKS = ["none", "missable", "unconfirmed"] as const;
export type GoddessMark = (typeof GODDESS_MARKS)[number];

export type EditorGoddess = {
  uid: string;
  /** Empty for a goddess added in the editor until export derives it from the name. */
  id: string;
  name: string;
  rarity: GoddessRarity;
  affinity: string;
  obtain: string;
  title: string;
  bio: string;
  images: EditorImage[];
  skinRaisesToSsr: boolean;
  mark: GoddessMark;
};

export type GoddessTextDraft = { affinity: string; obtain: string };

/**
 * Translations keyed by locale and then by the goddess's editor uid. English is
 * never kept here: `EditorGoddess` already holds it.
 */
export type GoddessEditorTexts = Record<Locale, Record<string, GoddessTextDraft>>;

export type GoddessEditorState = {
  version: 1;
  goddesses: EditorGoddess[];
  texts: GoddessEditorTexts;
  nextId: number;
};

export type GoddessTextField = keyof GoddessTextDraft;

/** Pictures are shrunk to this edge length in the browser before they are stored. */
export const GODDESS_PORTRAIT_MAX_EDGE = 240;

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const property = (key: string) => (IDENTIFIER.test(key) ? key : JSON.stringify(key));
const json = (value: unknown) => JSON.stringify(value);
const RARITY_SET = new Set<string>(GODDESS_RARITIES);
const MARK_SET = new Set<string>(GODDESS_MARKS);
const rarityIndex = (rarity: GoddessRarity) => GODDESS_RARITIES.indexOf(rarity);

function emptyTexts(): GoddessEditorTexts {
  return Object.fromEntries(LOCALES.map((locale) => [locale.code, {}])) as GoddessEditorTexts;
}

const emptyText = (): GoddessTextDraft => ({ affinity: "", obtain: "" });

/** The published translations, so the editor starts from what the site shows. */
export function catalogsFromDictionaries(): Record<Locale, GoddessTexts> {
  const catalogs = {} as Record<Locale, GoddessTexts>;
  for (const { code } of LOCALES) catalogs[code] = getDictionary(code).guideEntries.goddesses.goddessTexts;
  return catalogs;
}

export function goddessIdFrom(name: string, taken: Iterable<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "goddess";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

function markOf(goddess: Goddess): GoddessMark {
  if (goddess.missable) return "missable";
  if (goddess.unconfirmed) return "unconfirmed";
  return "none";
}

export function fromGoddessData(data: GoddessData, catalogs: Partial<Record<Locale, GoddessTexts>> = {}): GoddessEditorState {
  let nextId = 1;
  const texts = emptyTexts();
  const goddesses = data.goddesses.map((goddess): EditorGoddess => {
    const uid = `g${nextId++}`;
    for (const { code } of LOCALES) {
      if (code === DEFAULT_LOCALE) continue;
      const local = catalogs[code]?.[goddess.id];
      if (local) texts[code][uid] = { affinity: local.affinity ?? "", obtain: local.obtain ?? "" };
    }
    return {
      uid,
      id: goddess.id,
      name: goddess.name,
      rarity: goddess.rarity,
      affinity: goddess.affinity,
      obtain: goddess.obtain,
      title: goddess.title ?? "",
      bio: goddess.bio ?? "",
      images: goddess.images.map((file) => ({ uid: `i${nextId++}`, file })),
      skinRaisesToSsr: goddess.skinRaisesTo === "SSR",
      mark: markOf(goddess),
    };
  });
  return { version: 1, goddesses, texts, nextId };
}

export function goddessByUid(state: GoddessEditorState, uid: string): EditorGoddess | undefined {
  return state.goddesses.find((goddess) => goddess.uid === uid);
}

/** Affinity and obtain in one language; English is read back from the goddess row. */
export function goddessTextOf(state: GoddessEditorState, locale: Locale, uid: string): GoddessTextDraft {
  const goddess = goddessByUid(state, uid);
  if (!goddess) return emptyText();
  if (locale === DEFAULT_LOCALE) return { affinity: goddess.affinity, obtain: goddess.obtain };
  return state.texts[locale]?.[uid] ?? emptyText();
}

function mapGoddess(state: GoddessEditorState, uid: string, change: (goddess: EditorGoddess) => EditorGoddess): GoddessEditorState {
  return { ...state, goddesses: state.goddesses.map((goddess) => (goddess.uid === uid ? change(goddess) : goddess)) };
}

export function setGoddessText(
  state: GoddessEditorState,
  uid: string,
  locale: Locale,
  field: GoddessTextField,
  value: string,
): GoddessEditorState {
  if (!goddessByUid(state, uid)) return state;
  if (locale === DEFAULT_LOCALE) return mapGoddess(state, uid, (goddess) => ({ ...goddess, [field]: value }));
  const current = state.texts[locale]?.[uid] ?? emptyText();
  return { ...state, texts: { ...state.texts, [locale]: { ...state.texts[locale], [uid]: { ...current, [field]: value } } } };
}

/** Index just after the last goddess of `rarity`, keeping the roster grouped by rarity. */
function groupEnd(goddesses: readonly EditorGoddess[], rarity: GoddessRarity): number {
  let index = 0;
  goddesses.forEach((goddess, position) => {
    if (rarityIndex(goddess.rarity) <= rarityIndex(rarity)) index = position + 1;
  });
  return index;
}

export function addGoddess(state: GoddessEditorState, rarity: GoddessRarity, name = ""): { state: GoddessEditorState; uid: string } {
  const uid = `g${state.nextId}`;
  const goddess: EditorGoddess = {
    uid,
    id: "",
    name,
    rarity,
    affinity: "",
    obtain: "",
    title: "",
    bio: "",
    images: [],
    skinRaisesToSsr: false,
    mark: "none",
  };
  const goddesses = [...state.goddesses];
  goddesses.splice(groupEnd(goddesses, rarity), 0, goddess);
  return { state: { ...state, goddesses, nextId: state.nextId + 1 }, uid };
}

export function removeGoddess(state: GoddessEditorState, uid: string): GoddessEditorState {
  const texts = emptyTexts();
  for (const { code } of LOCALES) {
    const catalog = { ...state.texts[code] };
    delete catalog[uid];
    texts[code] = catalog;
  }
  return { ...state, goddesses: state.goddesses.filter((goddess) => goddess.uid !== uid), texts };
}

export function updateGoddess(
  state: GoddessEditorState,
  uid: string,
  patch: Partial<Pick<EditorGoddess, "name" | "rarity" | "mark" | "skinRaisesToSsr">>,
): GoddessEditorState {
  const current = goddessByUid(state, uid);
  if (!current) return state;
  const next = { ...current, ...patch };
  if (patch.rarity && patch.rarity !== current.rarity) {
    const goddesses = state.goddesses.filter((goddess) => goddess.uid !== uid);
    goddesses.splice(groupEnd(goddesses, next.rarity), 0, next);
    return { ...state, goddesses };
  }
  return mapGoddess(state, uid, () => next);
}

/** Swaps a goddess with her neighbour of the same rarity. */
export function moveGoddess(state: GoddessEditorState, uid: string, offset: -1 | 1): GoddessEditorState {
  const index = state.goddesses.findIndex((goddess) => goddess.uid === uid);
  if (index < 0) return state;
  const rarity = state.goddesses[index].rarity;
  let target = index + offset;
  while (target >= 0 && target < state.goddesses.length && state.goddesses[target].rarity !== rarity) target += offset;
  if (target < 0 || target >= state.goddesses.length) return state;
  const goddesses = [...state.goddesses];
  [goddesses[index], goddesses[target]] = [goddesses[target], goddesses[index]];
  return { ...state, goddesses };
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

export function addImage(state: GoddessEditorState, uid: string, data: string): GoddessEditorState {
  if (!isImageData(data) || !goddessByUid(state, uid)) return state;
  const imageUid = `i${state.nextId}`;
  const next = mapGoddess(state, uid, (goddess) => ({ ...goddess, images: [...goddess.images, { uid: imageUid, data }] }));
  return { ...next, nextId: state.nextId + 1 };
}

export function removeImage(state: GoddessEditorState, uid: string, imageUid: string): GoddessEditorState {
  return mapGoddess(state, uid, (goddess) => ({ ...goddess, images: goddess.images.filter((image) => image.uid !== imageUid) }));
}

/** Moves a picture to the front, where the roster shows it as the portrait. */
export function makePortrait(state: GoddessEditorState, uid: string, imageUid: string): GoddessEditorState {
  return mapGoddess(state, uid, (goddess) => {
    const image = goddess.images.find((entry) => entry.uid === imageUid);
    if (!image) return goddess;
    return { ...goddess, images: [image, ...goddess.images.filter((entry) => entry.uid !== imageUid)] };
  });
}

/** The id each goddess will have in the JSON, so a translation can be keyed by it. */
function exportIds(state: GoddessEditorState): Map<string, string> {
  const taken = new Set(state.goddesses.map((goddess) => goddess.id).filter(Boolean));
  const ids = new Map<string, string>();
  for (const goddess of state.goddesses) {
    let id = goddess.id;
    if (!id) {
      id = goddessIdFrom(goddess.name.trim(), taken);
      taken.add(id);
    }
    ids.set(goddess.uid, id);
  }
  return ids;
}

export type GoddessUpload = { file: string; data: string; goddess: string };
export type GoddessExport = { data: GoddessData; uploads: GoddessUpload[]; removedFiles: string[] };

/**
 * The roster as it would be committed. Goddesses added in the editor get an id
 * from their name, and each uploaded picture gets a file name from that id
 * that no published or kept file already uses.
 */
export function exportGoddesses(state: GoddessEditorState, published: GoddessData): GoddessExport {
  const ids = exportIds(state);
  const publishedFiles = published.goddesses.flatMap((goddess) => goddess.images);
  const takenFiles = new Set([...publishedFiles, ...state.goddesses.flatMap((goddess) => goddess.images.map((image) => image.file ?? ""))]);
  const uploads: GoddessUpload[] = [];

  const goddesses = state.goddesses.map((goddess): Goddess => {
    const id = ids.get(goddess.uid) ?? goddess.id;
    const images = goddess.images.map((image) => {
      if (image.file) return image.file;
      const ext = extensionOf(image.data ?? "");
      let file = `${id}.${ext}`;
      let counter = 2;
      while (takenFiles.has(file)) file = `${id}-${counter++}.${ext}`;
      takenFiles.add(file);
      uploads.push({ file, data: image.data ?? "", goddess: goddess.name.trim() || id });
      return file;
    });
    const row: Goddess = {
      id,
      name: goddess.name.trim(),
      rarity: goddess.rarity,
      affinity: goddess.affinity.trim(),
      obtain: goddess.obtain.trim(),
      images,
    };
    if (goddess.title.trim()) row.title = goddess.title.trim();
    if (goddess.bio.trim()) row.bio = goddess.bio.trim();
    if (goddess.skinRaisesToSsr) row.skinRaisesTo = "SSR";
    if (goddess.mark === "missable") row.missable = true;
    if (goddess.mark === "unconfirmed") row.unconfirmed = true;
    return row;
  });

  const kept = new Set(goddesses.flatMap((goddess) => goddess.images));
  const removedFiles = [...new Set(publishedFiles)].filter((file) => !kept.has(file));
  return { data: { goddesses }, uploads, removedFiles };
}

/** One line per goddess, in the key order the file has always used, so a diff stays readable. */
export function serializeGoddessData(data: GoddessData): string {
  const rows = data.goddesses.map((goddess, index, all) => {
    const parts = [
      `"id": ${json(goddess.id)}`,
      `"name": ${json(goddess.name)}`,
      `"rarity": ${json(goddess.rarity)}`,
      `"affinity": ${json(goddess.affinity)}`,
      `"obtain": ${json(goddess.obtain)}`,
      `"images": [${goddess.images.map(json).join(", ")}]`,
    ];
    if (goddess.title) parts.push(`"title": ${json(goddess.title)}`);
    if (goddess.bio) parts.push(`"bio": ${json(goddess.bio)}`);
    if (goddess.skinRaisesTo) parts.push(`"skinRaisesTo": ${json(goddess.skinRaisesTo)}`);
    if (goddess.missable) parts.push(`"missable": true`);
    if (goddess.unconfirmed) parts.push(`"unconfirmed": true`);
    return `    { ${parts.join(", ")} }${index < all.length - 1 ? "," : ""}`;
  });
  return ["{", `  "goddesses": [`, ...rows, "  ]", "}", ""].join("\n");
}

/** Translations keyed by goddess id, without the blanks. English stays in the JSON, so its catalog is empty. */
export function exportedGoddessTexts(state: GoddessEditorState): Record<Locale, GoddessTexts> {
  const ids = exportIds(state);
  const result = {} as Record<Locale, GoddessTexts>;
  for (const { code } of LOCALES) {
    const catalog: GoddessTexts = {};
    if (code !== DEFAULT_LOCALE) {
      for (const goddess of state.goddesses) {
        const draft = state.texts[code]?.[goddess.uid];
        if (!draft) continue;
        const affinity = draft.affinity.trim();
        const obtain = draft.obtain.trim();
        if (!affinity && !obtain) continue;
        catalog[ids.get(goddess.uid) ?? goddess.id] = { ...(affinity ? { affinity } : {}), ...(obtain ? { obtain } : {}) };
      }
    }
    result[code] = catalog;
  }
  return result;
}

/** The `goddessTexts` block to paste into each dictionary. */
export function goddessTextBlocks(state: GoddessEditorState): Record<Locale, string> {
  const catalogs = exportedGoddessTexts(state);
  const result = {} as Record<Locale, string>;
  for (const { code } of LOCALES) {
    const ids = Object.keys(catalogs[code]);
    if (ids.length === 0) {
      result[code] = "      goddessTexts: {},";
      continue;
    }
    const lines = ["      goddessTexts: {"];
    for (const id of ids) {
      const entry = catalogs[code][id];
      const parts = [
        ...(entry.affinity ? [`affinity: ${json(entry.affinity)}`] : []),
        ...(entry.obtain ? [`obtain: ${json(entry.obtain)}`] : []),
      ];
      lines.push(`        ${property(id)}: { ${parts.join(", ")} },`);
    }
    lines.push("      },");
    result[code] = lines.join("\n");
  }
  return result;
}

export function countGoddessChanges(published: GoddessData, draft: GoddessData): number {
  const before = new Map(published.goddesses.map((goddess) => [goddess.id, JSON.stringify(goddess)]));
  const after = new Map(draft.goddesses.map((goddess) => [goddess.id, JSON.stringify(goddess)]));
  let changes = 0;
  for (const [id, text] of after) if (before.get(id) !== text) changes += 1;
  for (const id of before.keys()) if (!after.has(id)) changes += 1;
  const order = (data: GoddessData) => data.goddesses.map((goddess) => goddess.id).join("\0");
  if (changes === 0 && order(published) !== order(draft)) changes = 1;
  return changes;
}

/** Roster changes plus one per language whose translations moved. */
export function countGoddessDraftChanges(published: GoddessEditorState, draft: GoddessEditorState): number {
  let changes = countGoddessChanges(exportGoddesses(published, GODDESS_DATA).data, exportGoddesses(draft, GODDESS_DATA).data);
  const before = exportedGoddessTexts(published);
  const after = exportedGoddessTexts(draft);
  for (const { code } of LOCALES) {
    if (code === DEFAULT_LOCALE) continue;
    if (JSON.stringify(before[code]) !== JSON.stringify(after[code])) changes += 1;
  }
  return changes;
}

/** Other guides that name a goddess: the theater casts and skins by name, the upgrade order by id. */
export const GODDESS_USES = ["theater", "skins", "leveling"] as const;
export type GoddessUse = (typeof GODDESS_USES)[number];

export type GoddessProblem =
  | { code: "emptyName"; rarity: GoddessRarity }
  | { code: "duplicateName"; name: string }
  | { code: "stillUsed"; name: string; where: GoddessUse[] }
  | { code: "bannerImage"; file: string };

export function findGoddessProblems(state: GoddessEditorState, published: GoddessData): GoddessProblem[] {
  const problems: GoddessProblem[] = [];
  const names = new Set<string>();
  for (const goddess of state.goddesses) {
    const name = goddess.name.trim();
    if (!name) problems.push({ code: "emptyName", rarity: goddess.rarity });
    const key = name.toLowerCase();
    if (name && names.has(key)) problems.push({ code: "duplicateName", name });
    names.add(key);
  }

  const ids = new Set(exportIds(state).values());
  const theater = new Set(THEATER_DATA.plays.flatMap((play) => play.roles.map((role) => role.goddess.toLowerCase())));
  const skins = new Set(GODDESS_SKINS.map((skin) => skin.owner.toLowerCase()));
  const leveling = new Set(GODDESS_LEVELING_DATA.phases.flatMap((phase) => phase.rows.map((row) => row.goddess)));
  for (const goddess of published.goddesses) {
    const where: GoddessUse[] = [];
    const renamed = !names.has(goddess.name.toLowerCase());
    if (renamed && theater.has(goddess.name.toLowerCase())) where.push("theater");
    if (renamed && skins.has(goddess.name.toLowerCase())) where.push("skins");
    if (!ids.has(goddess.id) && leveling.has(goddess.id)) where.push("leveling");
    if (where.length) problems.push({ code: "stillUsed", name: goddess.name, where });
  }

  const kept = new Set(state.goddesses.flatMap((goddess) => goddess.images.map((image) => image.file ?? "")));
  for (const file of GODDESS_BANNER_IMAGES) {
    if (!kept.has(file)) problems.push({ code: "bannerImage", file });
  }
  return problems;
}

function isTextDraft(value: unknown): value is GoddessTextDraft {
  const text = value as GoddessTextDraft;
  return typeof text?.affinity === "string" && typeof text.obtain === "string";
}

export function parseGoddessDraft(raw: string | null): GoddessEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as GoddessEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.goddesses)) return null;
    if (!value.texts || typeof value.texts !== "object") return null;
    const texts = emptyTexts();
    for (const { code } of LOCALES) {
      const catalog = value.texts[code];
      if (!catalog) continue;
      if (typeof catalog !== "object") return null;
      for (const draft of Object.values(catalog)) if (!isTextDraft(draft)) return null;
      texts[code] = catalog;
    }
    for (const goddess of value.goddesses) {
      if (typeof goddess.uid !== "string" || typeof goddess.id !== "string" || typeof goddess.name !== "string") return null;
      if (!RARITY_SET.has(goddess.rarity) || !MARK_SET.has(goddess.mark)) return null;
      if (typeof goddess.affinity !== "string" || typeof goddess.obtain !== "string") return null;
      goddess.title = typeof goddess.title === "string" ? goddess.title : "";
      goddess.bio = typeof goddess.bio === "string" ? goddess.bio : "";
      if (typeof goddess.skinRaisesToSsr !== "boolean" || !Array.isArray(goddess.images)) return null;
      for (const image of goddess.images) {
        if (typeof image?.uid !== "string") return null;
        const hasFile = typeof image.file === "string" && image.file.length > 0;
        if (hasFile === isImageData(image.data)) return null;
      }
    }
    return { ...value, texts };
  } catch {
    return null;
  }
}

/** The roster and its translations as they are published right now. */
export const PUBLISHED_GODDESSES = fromGoddessData(GODDESS_DATA, catalogsFromDictionaries());
