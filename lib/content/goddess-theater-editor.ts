/**
 * Pure state logic for the Goddess Theater editor. The page only renders this
 * state and calls these functions, so adding plays, assigning Core goddesses,
 * and exporting can be tested without a browser.
 *
 * The editor works on a copy of `lib/data/goddess-theater.json`. A static site
 * cannot save for everyone, so the result leaves the browser as that JSON file
 * plus any new cover files for someone to commit — the same way the other
 * guide editors work. Uploaded covers stay in the draft as data URLs until then.
 */

import { GODDESSES } from "./goddesses.ts";
import {
  THEATER_DATA,
  type TheaterData,
  type TheaterPlay,
  type TheaterPlayTexts,
  type TheaterRole,
} from "./goddess-theater.ts";
import { DEFAULT_LOCALE, LOCALES, getDictionary, type Locale } from "../i18n/index.ts";

/** A published cover has `file`; one uploaded in the editor has `data`. */
export type EditorCover = { uid: string; file?: string; data?: string };

export type EditorRole = {
  uid: string;
  goddess: string;
  role: string;
  relevant: boolean;
};

export type EditorPlay = {
  uid: string;
  /** Empty for a play added in the editor until export derives it from the name. */
  id: string;
  name: string;
  unlock?: "tutorial";
  cover: EditorCover | null;
  roles: EditorRole[];
};

export type PlayText = { name: string; roles: Record<string, string> };
export type TheaterTexts = Record<Locale, Record<string, PlayText>>;

export type TheaterEditorState = {
  version: 2;
  plays: EditorPlay[];
  texts: TheaterTexts;
  nextId: number;
};

/** Covers are shrunk to this edge length in the browser before they are stored. */
export const COVER_MAX_EDGE = 240;

const GODDESS_NAMES = new Set(GODDESSES.map((goddess) => goddess.name));
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const property = (key: string) => (IDENTIFIER.test(key) ? key : JSON.stringify(key));

function emptyTexts(): TheaterTexts {
  return Object.fromEntries(LOCALES.map((locale) => [locale.code, {}])) as TheaterTexts;
}

function emptyPlayText(): PlayText {
  return { name: "", roles: {} };
}

export function catalogsFromDictionaries(): Record<Locale, TheaterPlayTexts> {
  const catalogs = {} as Record<Locale, TheaterPlayTexts>;
  for (const { code } of LOCALES) {
    catalogs[code] = getDictionary(code).guideEntries.goddessTheater.playTexts;
  }
  return catalogs;
}

function playTextOf(state: TheaterEditorState, locale: Locale, uid: string): PlayText {
  return state.texts[locale]?.[uid] ?? emptyPlayText();
}

export { playTextOf };

export function fromTheaterData(
  data: TheaterData,
  catalogs: Partial<Record<Locale, TheaterPlayTexts>> = {},
): TheaterEditorState {
  let nextId = 1;
  const texts = emptyTexts();
  const plays = data.plays.map((play) => {
    const uid = `p${nextId++}`;
    for (const { code } of LOCALES) {
      const local = catalogs[code]?.[play.id];
      const roles: Record<string, string> = {};
      for (const row of play.roles) {
        roles[row.goddess] = code === DEFAULT_LOCALE ? row.role : (local?.roles?.[row.goddess] ?? "");
      }
      texts[code][uid] = {
        name: code === DEFAULT_LOCALE ? play.name : (local?.name ?? ""),
        roles,
      };
    }
    return {
      uid,
      id: play.id,
      name: play.name,
      unlock: play.unlock,
      cover: play.image ? { uid: `c${nextId++}`, file: play.image } : null,
      roles: play.roles.map((row) => ({
        uid: `r${nextId++}`,
        goddess: row.goddess,
        role: row.role,
        relevant: Boolean(row.relevant),
      })),
    };
  });
  return { version: 2, plays, texts, nextId };
}

export function playIdFrom(name: string, taken: Iterable<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "play";
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

function cleanRole(row: EditorRole): TheaterRole | null {
  const goddess = row.goddess.trim();
  const role = row.role.trim();
  if (!goddess && !role) return null;
  const next: TheaterRole = { goddess, role };
  if (row.relevant) next.relevant = true;
  return next;
}

export type TheaterUpload = { file: string; data: string; play: string };
export type TheaterExport = { data: TheaterData; uploads: TheaterUpload[]; removedFiles: string[] };

/**
 * The roster as it would be committed. Plays added in the editor get an id
 * from their name, and each uploaded cover gets a file name from that id.
 */
export function exportTheater(state: TheaterEditorState, published: TheaterData): TheaterExport {
  const takenIds = new Set(state.plays.map((play) => play.id).filter(Boolean));
  const publishedFiles = published.plays.map((play) => play.image).filter(Boolean);
  const takenFiles = new Set([...publishedFiles, ...state.plays.map((play) => play.cover?.file ?? "").filter(Boolean)]);
  const uploads: TheaterUpload[] = [];

  const plays = state.plays.map((play): TheaterPlay => {
    let id = play.id;
    if (!id) {
      id = playIdFrom(play.name.trim(), takenIds);
      takenIds.add(id);
    }
    let image = "";
    if (play.cover?.file) image = play.cover.file;
    else if (play.cover?.data) {
      const ext = extensionOf(play.cover.data);
      image = `${id}.${ext}`;
      let counter = 2;
      while (takenFiles.has(image)) image = `${id}-${counter++}.${ext}`;
      takenFiles.add(image);
      uploads.push({ file: image, data: play.cover.data, play: play.name.trim() || id });
    }
    const row: TheaterPlay = {
      id,
      name: play.name.trim(),
      image,
      ...(play.unlock === "tutorial" ? { unlock: "tutorial" as const } : {}),
      roles: play.unlock === "tutorial" ? [] : play.roles.map(cleanRole).filter((entry): entry is TheaterRole => Boolean(entry)),
    };
    return row;
  });

  const kept = new Set(plays.map((play) => play.image).filter(Boolean));
  const removedFiles = [...new Set(publishedFiles)].filter((file) => !kept.has(file));
  return { data: { plays }, uploads, removedFiles };
}

export function playByUid(state: TheaterEditorState, uid: string): EditorPlay | undefined {
  return state.plays.find((play) => play.uid === uid);
}

function mapPlay(state: TheaterEditorState, uid: string, change: (play: EditorPlay) => EditorPlay): TheaterEditorState {
  return { ...state, plays: state.plays.map((play) => (play.uid === uid ? change(play) : play)) };
}

export function addPlay(state: TheaterEditorState, name = ""): { state: TheaterEditorState; uid: string } {
  const uid = `p${state.nextId}`;
  const texts = emptyTexts();
  for (const { code } of LOCALES) {
    texts[code] = { ...state.texts[code], [uid]: { name: code === DEFAULT_LOCALE ? name : "", roles: {} } };
  }
  return {
    uid,
    state: {
      ...state,
      nextId: state.nextId + 1,
      plays: [...state.plays, { uid, id: "", name, roles: [], cover: null }],
      texts,
    },
  };
}

export function removePlay(state: TheaterEditorState, uid: string): TheaterEditorState {
  if (state.plays.length <= 1) return state;
  const texts = emptyTexts();
  for (const { code } of LOCALES) {
    const next = { ...state.texts[code] };
    delete next[uid];
    texts[code] = next;
  }
  return { ...state, plays: state.plays.filter((play) => play.uid !== uid), texts };
}

export function updatePlay(
  state: TheaterEditorState,
  uid: string,
  patch: Partial<Pick<EditorPlay, "name" | "unlock">>,
): TheaterEditorState {
  let next = mapPlay(state, uid, (play) => {
    const updated = { ...play, ...patch };
    if (patch.unlock === undefined && "unlock" in patch) delete updated.unlock;
    return updated;
  });
  if (patch.name !== undefined) next = setPlayName(next, uid, DEFAULT_LOCALE, patch.name);
  return next;
}

function mapText(state: TheaterEditorState, locale: Locale, uid: string, edit: (text: PlayText) => PlayText): TheaterEditorState {
  const current = playTextOf(state, locale, uid);
  return {
    ...state,
    texts: {
      ...state.texts,
      [locale]: { ...state.texts[locale], [uid]: edit(current) },
    },
  };
}

export function setPlayName(state: TheaterEditorState, uid: string, locale: Locale, name: string): TheaterEditorState {
  let next = mapText(state, locale, uid, (text) => ({ ...text, name }));
  if (locale === DEFAULT_LOCALE) next = mapPlay(next, uid, (play) => ({ ...play, name }));
  return next;
}

export function setRoleName(
  state: TheaterEditorState,
  playUid: string,
  goddess: string,
  locale: Locale,
  role: string,
): TheaterEditorState {
  let next = mapText(state, locale, playUid, (text) => ({
    ...text,
    roles: { ...text.roles, [goddess]: role },
  }));
  if (locale === DEFAULT_LOCALE) {
    next = mapPlay(next, playUid, (play) => ({
      ...play,
      roles: play.roles.map((row) => (row.goddess === goddess ? { ...row, role } : row)),
    }));
  }
  return next;
}

export function setTutorial(state: TheaterEditorState, uid: string, tutorial: boolean): TheaterEditorState {
  return mapPlay(state, uid, (play) => {
    if (tutorial) return { ...play, unlock: "tutorial" };
    const next = { ...play };
    delete next.unlock;
    return next;
  });
}

export function movePlay(state: TheaterEditorState, uid: string, toIndex: number): TheaterEditorState {
  const current = state.plays.findIndex((play) => play.uid === uid);
  if (current < 0) return state;
  const moving = state.plays[current];
  const without = state.plays.filter((play) => play.uid !== uid);
  const index = Math.max(0, Math.min(toIndex, without.length));
  return { ...state, plays: [...without.slice(0, index), moving, ...without.slice(index)] };
}

export function setCover(state: TheaterEditorState, uid: string, data: string): TheaterEditorState {
  if (!isImageData(data)) return state;
  const coverUid = `c${state.nextId}`;
  return { ...mapPlay(state, uid, (play) => ({ ...play, cover: { uid: coverUid, data } })), nextId: state.nextId + 1 };
}

export function removeCover(state: TheaterEditorState, uid: string): TheaterEditorState {
  return mapPlay(state, uid, (play) => ({ ...play, cover: null }));
}

export function unusedGoddesses(play: EditorPlay): typeof GODDESSES {
  const used = new Set(play.roles.map((row) => row.goddess));
  return GODDESSES.filter((goddess) => !used.has(goddess.name));
}

export function addRole(state: TheaterEditorState, playUid: string, goddess: string): TheaterEditorState {
  const name = goddess.trim();
  if (!name || !GODDESS_NAMES.has(name)) return state;
  const play = playByUid(state, playUid);
  if (!play || play.roles.some((row) => row.goddess === name)) return state;
  const uid = `r${state.nextId}`;
  const texts = emptyTexts();
  for (const { code } of LOCALES) {
    const current = playTextOf(state, code, playUid);
    texts[code] = {
      ...state.texts[code],
      [playUid]: { ...current, roles: { ...current.roles, [name]: current.roles[name] ?? "" } },
    };
  }
  return {
    ...mapPlay(state, playUid, (entry) => ({
      ...entry,
      roles: [...entry.roles, { uid, goddess: name, role: "", relevant: false }],
    })),
    texts,
    nextId: state.nextId + 1,
  };
}

export function removeRole(state: TheaterEditorState, playUid: string, roleUid: string): TheaterEditorState {
  const play = playByUid(state, playUid);
  const row = play?.roles.find((entry) => entry.uid === roleUid);
  const next = mapPlay(state, playUid, (entry) => ({
    ...entry,
    roles: entry.roles.filter((entry) => entry.uid !== roleUid),
  }));
  if (!row) return next;
  const texts = emptyTexts();
  for (const { code } of LOCALES) {
    const current = playTextOf(next, code, playUid);
    const roles = { ...current.roles };
    delete roles[row.goddess];
    texts[code] = { ...next.texts[code], [playUid]: { ...current, roles } };
  }
  return { ...next, texts };
}

export function updateRole(
  state: TheaterEditorState,
  playUid: string,
  roleUid: string,
  patch: Partial<Pick<EditorRole, "role" | "relevant">>,
): TheaterEditorState {
  let next = mapPlay(state, playUid, (play) => ({
    ...play,
    roles: play.roles.map((row) => (row.uid === roleUid ? { ...row, ...patch } : row)),
  }));
  if (patch.role !== undefined) {
    const row = playByUid(next, playUid)?.roles.find((entry) => entry.uid === roleUid);
    if (row) next = setRoleName(next, playUid, row.goddess, DEFAULT_LOCALE, patch.role);
  }
  return next;
}

export function countChanges(published: TheaterData, draft: TheaterData): number {
  const before = new Map(published.plays.map((play) => [play.id, JSON.stringify(play)]));
  const after = new Map(draft.plays.map((play) => [play.id, JSON.stringify(play)]));
  let changes = 0;
  for (const [id, json] of after) {
    const old = before.get(id);
    if (old === undefined || old !== json) changes += 1;
  }
  for (const id of before.keys()) if (!after.has(id)) changes += 1;
  if (published.plays.map((play) => play.id).join("\0") !== draft.plays.map((play) => play.id).join("\0") && changes === 0) {
    changes += 1;
  }
  return changes;
}

function playExportId(state: TheaterEditorState, play: EditorPlay, taken: Set<string>): string {
  if (play.id) return play.id;
  return playIdFrom(play.name.trim() || playTextOf(state, DEFAULT_LOCALE, play.uid).name.trim(), taken);
}

/** Translated names keyed by play id, omitting empty strings. */
export function exportedPlayTexts(state: TheaterEditorState): Record<Locale, TheaterPlayTexts> {
  const taken = new Set(state.plays.map((play) => play.id).filter(Boolean));
  const result = {} as Record<Locale, TheaterPlayTexts>;
  for (const { code } of LOCALES) {
    const catalog: TheaterPlayTexts = {};
    for (const play of state.plays) {
      const id = playExportId(state, play, taken);
      if (!play.id) taken.add(id);
      const text = playTextOf(state, code, play.uid);
      const roles: Record<string, string> = {};
      for (const [goddess, role] of Object.entries(text.roles)) {
        if (role.trim()) roles[goddess] = role.trim();
      }
      const name = text.name.trim();
      if (!name && Object.keys(roles).length === 0) continue;
      catalog[id] = {
        ...(name ? { name } : {}),
        ...(Object.keys(roles).length > 0 ? { roles } : {}),
      };
    }
    result[code] = catalog;
  }
  return result;
}

export function countTheaterChanges(published: TheaterEditorState, draft: TheaterEditorState): number {
  const exportedPublished = exportTheater(published, THEATER_DATA);
  const exportedDraft = exportTheater(draft, THEATER_DATA);
  let changes = countChanges(exportedPublished.data, exportedDraft.data);
  const before = exportedPlayTexts(published);
  const after = exportedPlayTexts(draft);
  for (const { code } of LOCALES) {
    if (code === DEFAULT_LOCALE) continue;
    const left = JSON.stringify(before[code]);
    const right = JSON.stringify(after[code]);
    if (left !== right) changes += 1;
  }
  return changes;
}

function formatPlayTexts(catalog: TheaterPlayTexts): string {
  const ids = Object.keys(catalog);
  if (ids.length === 0) return "      playTexts: {},";
  const lines = ["      playTexts: {"];
  for (const id of ids) {
    const entry = catalog[id];
    lines.push(`        ${property(id)}: {`);
    if (entry.name) lines.push(`          name: ${JSON.stringify(entry.name)},`);
    if (entry.roles && Object.keys(entry.roles).length > 0) {
      lines.push("          roles: {");
      for (const [goddess, role] of Object.entries(entry.roles)) {
        lines.push(`            ${property(goddess)}: ${JSON.stringify(role)},`);
      }
      lines.push("          },");
    }
    lines.push("        },");
  }
  lines.push("      },");
  return lines.join("\n");
}

export function textBlocks(state: TheaterEditorState): Record<Locale, string> {
  const catalogs = exportedPlayTexts(state);
  const result = {} as Record<Locale, string>;
  for (const { code } of LOCALES) {
    result[code] = formatPlayTexts(code === DEFAULT_LOCALE ? {} : catalogs[code]);
  }
  return result;
}

function formatRole(row: TheaterRole): string {
  const extra = row.relevant ? `, "relevant": true` : "";
  return `        { "goddess": ${JSON.stringify(row.goddess)}, "role": ${JSON.stringify(row.role)}${extra} }`;
}

function formatPlay(play: TheaterPlay): string {
  const unlock = play.unlock ? `\n      "unlock": ${JSON.stringify(play.unlock)},` : "";
  const roles =
    play.roles.length === 0
      ? "[]"
      : `[\n${play.roles.map(formatRole).join(",\n")}\n      ]`;
  return `    {
      "id": ${JSON.stringify(play.id)},
      "name": ${JSON.stringify(play.name)},
      "image": ${JSON.stringify(play.image)},${unlock}
      "roles": ${roles}
    }`;
}

export function serializeTheaterData(data: TheaterData): string {
  return `{\n  "plays": [\n${data.plays.map(formatPlay).join(",\n")}\n  ]\n}\n`;
}

export type TheaterProblem =
  | { code: "emptyPlayName"; id: string }
  | { code: "duplicatePlay"; id: string }
  | { code: "duplicateName"; name: string }
  | { code: "emptyRole"; play: string; goddess: string }
  | { code: "unknownGoddess"; play: string; goddess: string }
  | { code: "duplicateGoddess"; play: string; goddess: string }
  | { code: "noRoles"; play: string }
  | { code: "missingCover"; play: string };

export function findProblems(state: TheaterEditorState): TheaterProblem[] {
  const problems: TheaterProblem[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const play of state.plays) {
    const label = play.name.trim() || play.id || "play";
    if (!play.name.trim()) problems.push({ code: "emptyPlayName", id: play.id || label });
    const id = play.id || playIdFrom(play.name.trim(), ids);
    if (play.id && ids.has(play.id)) problems.push({ code: "duplicatePlay", id: play.id });
    if (play.id) ids.add(play.id);
    else ids.add(id);
    const name = play.name.trim().toLowerCase();
    if (name) {
      if (names.has(name)) problems.push({ code: "duplicateName", name: play.name.trim() });
      names.add(name);
    }
    if (!play.cover) problems.push({ code: "missingCover", play: label });
    if (play.unlock === "tutorial") continue;
    if (play.roles.length === 0) problems.push({ code: "noRoles", play: label });
    const seen = new Set<string>();
    for (const row of play.roles) {
      if (!row.role.trim()) problems.push({ code: "emptyRole", play: label, goddess: row.goddess || "—" });
      if (row.goddess && !GODDESS_NAMES.has(row.goddess)) {
        problems.push({ code: "unknownGoddess", play: label, goddess: row.goddess });
      }
      if (row.goddess && seen.has(row.goddess)) {
        problems.push({ code: "duplicateGoddess", play: label, goddess: row.goddess });
      }
      if (row.goddess) seen.add(row.goddess);
    }
  }
  return problems;
}

export function parseDraft(raw: string | null): TheaterEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as TheaterEditorState;
    if (value?.version !== 2 || typeof value.nextId !== "number" || !Array.isArray(value.plays)) return null;
    if (!value.texts || typeof value.texts !== "object") return null;
    const texts = emptyTexts();
    for (const { code } of LOCALES) {
      const catalog = value.texts[code];
      texts[code] = catalog && typeof catalog === "object" ? catalog : {};
    }
    for (const play of value.plays) {
      if (typeof play.uid !== "string" || typeof play.id !== "string" || typeof play.name !== "string") return null;
      if (play.unlock !== undefined && play.unlock !== "tutorial") return null;
      if (play.cover !== null) {
        if (typeof play.cover?.uid !== "string") return null;
        if (play.cover.file !== undefined && typeof play.cover.file !== "string") return null;
        if (play.cover.data !== undefined && !isImageData(play.cover.data)) return null;
        if (!play.cover.file && !play.cover.data) return null;
      }
      if (!Array.isArray(play.roles)) return null;
      for (const row of play.roles) {
        if (typeof row.uid !== "string" || typeof row.goddess !== "string" || typeof row.role !== "string") return null;
        if (typeof row.relevant !== "boolean") return null;
      }
    }
    return { ...value, texts };
  } catch {
    return null;
  }
}

export const PUBLISHED_THEATER = fromTheaterData(THEATER_DATA, catalogsFromDictionaries());
