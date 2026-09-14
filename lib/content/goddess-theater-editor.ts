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
import { THEATER_DATA, type TheaterData, type TheaterPlay, type TheaterRole } from "./goddess-theater.ts";

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

export type TheaterEditorState = {
  version: 1;
  plays: EditorPlay[];
  nextId: number;
};

/** Covers are shrunk to this edge length in the browser before they are stored. */
export const COVER_MAX_EDGE = 240;

const GODDESS_NAMES = new Set(GODDESSES.map((goddess) => goddess.name));

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

export function fromTheaterData(data: TheaterData): TheaterEditorState {
  let nextId = 1;
  return {
    version: 1,
    plays: data.plays.map((play) => ({
      uid: `p${nextId++}`,
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
    })),
    nextId,
  };
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
  return {
    uid,
    state: {
      ...state,
      nextId: state.nextId + 1,
      plays: [...state.plays, { uid, id: "", name, roles: [], cover: null }],
    },
  };
}

export function removePlay(state: TheaterEditorState, uid: string): TheaterEditorState {
  if (state.plays.length <= 1) return state;
  return { ...state, plays: state.plays.filter((play) => play.uid !== uid) };
}

export function updatePlay(
  state: TheaterEditorState,
  uid: string,
  patch: Partial<Pick<EditorPlay, "name" | "unlock">>,
): TheaterEditorState {
  return mapPlay(state, uid, (play) => {
    const next = { ...play, ...patch };
    if (patch.unlock === undefined && "unlock" in patch) delete next.unlock;
    return next;
  });
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
  return {
    ...mapPlay(state, playUid, (entry) => ({
      ...entry,
      roles: [...entry.roles, { uid, goddess: name, role: "", relevant: false }],
    })),
    nextId: state.nextId + 1,
  };
}

export function removeRole(state: TheaterEditorState, playUid: string, roleUid: string): TheaterEditorState {
  return mapPlay(state, playUid, (play) => ({
    ...play,
    roles: play.roles.filter((row) => row.uid !== roleUid),
  }));
}

export function updateRole(
  state: TheaterEditorState,
  playUid: string,
  roleUid: string,
  patch: Partial<Pick<EditorRole, "role" | "relevant">>,
): TheaterEditorState {
  return mapPlay(state, playUid, (play) => ({
    ...play,
    roles: play.roles.map((row) => (row.uid === roleUid ? { ...row, ...patch } : row)),
  }));
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
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.plays)) return null;
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
    return value;
  } catch {
    return null;
  }
}

export const PUBLISHED_THEATER = fromTheaterData(THEATER_DATA);
