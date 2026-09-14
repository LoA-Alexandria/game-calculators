/**
 * Pure state logic for the Heroes roster editor. The page only renders this
 * state and calls these functions, so adding heroes, skills, and portraits can
 * be tested without a browser.
 *
 * The editor works on a copy of `lib/data/heroes.json`. A static site cannot
 * save for everyone, so the result leaves the browser as that JSON file plus
 * any new portrait files for someone to commit, the same way the other guide
 * editors work. Uploaded portraits stay in the draft as data URLs until then.
 */

import { heroReferences, rosterName, type HeroReference } from "./hero-links.ts";
import {
  HERO_RARITIES,
  type Hero,
  type HeroData,
  type HeroRarity,
  type HeroSkill,
} from "./heroes.ts";

/** A published portrait has `file`; one uploaded in the editor has `data`. */
export type EditorImage = { uid: string; file?: string; data?: string };
export type EditorSkill = HeroSkill & { uid: string };

export type EditorHero = {
  uid: string;
  /** Empty for a hero added in the editor until export derives it from the name. */
  id: string;
  name: string;
  rarity: HeroRarity;
  obtain: string;
  images: EditorImage[];
  skills: EditorSkill[];
  artifact: HeroSkill | null;
};

export type HeroEditorState = {
  version: 1;
  heroes: EditorHero[];
  nextId: number;
};

const RARITY_SET = new Set<string>(HERO_RARITIES);
const rarityIndex = (rarity: HeroRarity) => HERO_RARITIES.indexOf(rarity);

/** Images are shrunk to this edge length in the browser before they are stored. */
export const PORTRAIT_MAX_EDGE = 240;

export function heroIdFrom(name: string, taken: Iterable<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "hero";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

export function fromHeroData(data: HeroData): HeroEditorState {
  let nextId = 1;
  return {
    version: 1,
    heroes: data.heroes.map((hero) => ({
      uid: `h${nextId++}`,
      id: hero.id,
      name: hero.name,
      rarity: hero.rarity,
      obtain: hero.obtain,
      images: hero.images.map((file) => ({ uid: `i${nextId++}`, file })),
      skills: hero.skills.map((skill) => ({ uid: `k${nextId++}`, name: skill.name, text: skill.text })),
      artifact: hero.artifact ? { name: hero.artifact.name, text: hero.artifact.text } : null,
    })),
    nextId,
  };
}

export type HeroUpload = { file: string; data: string; hero: string };
export type HeroExport = { data: HeroData; uploads: HeroUpload[]; removedFiles: string[] };

/** Uploads are re-encoded in the browser, so only these raster types are kept. */
const IMAGE_DATA = /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

export function isImageData(value: unknown): value is string {
  return typeof value === "string" && IMAGE_DATA.test(value);
}

function extensionOf(dataUrl: string): string {
  const mime = IMAGE_DATA.exec(dataUrl)?.[1] ?? "webp";
  return mime === "jpeg" ? "jpg" : mime;
}

/**
 * The roster as it would be committed. Heroes added in the editor get an id
 * from their name, and each uploaded portrait gets a file name from its hero
 * that no published or kept file already uses.
 */
export function exportHeroes(state: HeroEditorState, published: HeroData): HeroExport {
  const takenIds = new Set(state.heroes.map((hero) => hero.id).filter(Boolean));
  const publishedFiles = published.heroes.flatMap((hero) => hero.images);
  const takenFiles = new Set([...publishedFiles, ...state.heroes.flatMap((hero) => hero.images.map((image) => image.file ?? ""))]);
  const uploads: HeroUpload[] = [];

  const heroes = state.heroes.map((hero): Hero => {
    let id = hero.id;
    if (!id) {
      id = heroIdFrom(hero.name.trim(), takenIds);
      takenIds.add(id);
    }
    const images = hero.images.map((image) => {
      if (image.file) return image.file;
      const ext = extensionOf(image.data ?? "");
      let file = `${id}.${ext}`;
      let counter = 2;
      while (takenFiles.has(file)) file = `${id}-${counter++}.${ext}`;
      takenFiles.add(file);
      uploads.push({ file, data: image.data ?? "", hero: hero.name.trim() || id });
      return file;
    });
    const row: Hero = {
      id,
      name: hero.name.trim(),
      rarity: hero.rarity,
      obtain: hero.obtain.trim(),
      images,
      skills: hero.skills.map((skill) => ({ name: skill.name.trim(), text: skill.text.trim() })),
    };
    if (hero.artifact) row.artifact = { name: hero.artifact.name.trim(), text: hero.artifact.text.trim() };
    return row;
  });

  const kept = new Set(heroes.flatMap((hero) => hero.images));
  const removedFiles = [...new Set(publishedFiles)].filter((file) => !kept.has(file));
  return { data: { heroes }, uploads, removedFiles };
}

export function heroByUid(state: HeroEditorState, uid: string): EditorHero | undefined {
  return state.heroes.find((hero) => hero.uid === uid);
}

function mapHero(state: HeroEditorState, uid: string, change: (hero: EditorHero) => EditorHero): HeroEditorState {
  return { ...state, heroes: state.heroes.map((hero) => (hero.uid === uid ? change(hero) : hero)) };
}

/** Index just after the last hero of `rarity`, keeping the roster grouped by rarity. */
function groupEnd(heroes: readonly EditorHero[], rarity: HeroRarity, skipUid?: string): number {
  let index = 0;
  heroes.forEach((hero, position) => {
    if (hero.uid === skipUid) return;
    if (rarityIndex(hero.rarity) <= rarityIndex(rarity)) index = position + 1;
  });
  return index;
}

export function addHero(state: HeroEditorState, rarity: HeroRarity, name = ""): { state: HeroEditorState; uid: string } {
  const uid = `h${state.nextId}`;
  const hero: EditorHero = { uid, id: "", name, rarity, obtain: "", images: [], skills: [], artifact: null };
  const heroes = [...state.heroes];
  heroes.splice(groupEnd(heroes, rarity), 0, hero);
  return { state: { ...state, heroes, nextId: state.nextId + 1 }, uid };
}

export function removeHero(state: HeroEditorState, uid: string): HeroEditorState {
  return { ...state, heroes: state.heroes.filter((hero) => hero.uid !== uid) };
}

export function updateHero(
  state: HeroEditorState,
  uid: string,
  patch: Partial<Pick<EditorHero, "name" | "rarity" | "obtain">>,
): HeroEditorState {
  const current = heroByUid(state, uid);
  if (!current) return state;
  const next = { ...current, ...patch };
  if (patch.rarity && patch.rarity !== current.rarity) {
    const heroes = state.heroes.filter((hero) => hero.uid !== uid);
    heroes.splice(groupEnd(heroes, next.rarity), 0, next);
    return { ...state, heroes };
  }
  return mapHero(state, uid, () => next);
}

/** Swaps a hero with its neighbour of the same rarity. */
export function moveHero(state: HeroEditorState, uid: string, offset: -1 | 1): HeroEditorState {
  const index = state.heroes.findIndex((hero) => hero.uid === uid);
  if (index < 0) return state;
  const rarity = state.heroes[index].rarity;
  let target = index + offset;
  while (target >= 0 && target < state.heroes.length && state.heroes[target].rarity !== rarity) target += offset;
  if (target < 0 || target >= state.heroes.length) return state;
  const heroes = [...state.heroes];
  [heroes[index], heroes[target]] = [heroes[target], heroes[index]];
  return { ...state, heroes };
}

export function addSkill(state: HeroEditorState, heroUid: string): { state: HeroEditorState; uid: string } {
  const uid = `k${state.nextId}`;
  const next = mapHero(state, heroUid, (hero) => ({ ...hero, skills: [...hero.skills, { uid, name: "", text: "" }] }));
  return { state: { ...next, nextId: state.nextId + 1 }, uid };
}

export function updateSkill(
  state: HeroEditorState,
  heroUid: string,
  skillUid: string,
  patch: Partial<HeroSkill>,
): HeroEditorState {
  return mapHero(state, heroUid, (hero) => ({
    ...hero,
    skills: hero.skills.map((skill) => (skill.uid === skillUid ? { ...skill, ...patch } : skill)),
  }));
}

export function removeSkill(state: HeroEditorState, heroUid: string, skillUid: string): HeroEditorState {
  return mapHero(state, heroUid, (hero) => ({ ...hero, skills: hero.skills.filter((skill) => skill.uid !== skillUid) }));
}

export function moveSkill(state: HeroEditorState, heroUid: string, skillUid: string, offset: -1 | 1): HeroEditorState {
  return mapHero(state, heroUid, (hero) => {
    const index = hero.skills.findIndex((skill) => skill.uid === skillUid);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= hero.skills.length) return hero;
    const skills = [...hero.skills];
    [skills[index], skills[target]] = [skills[target], skills[index]];
    return { ...hero, skills };
  });
}

export function setArtifact(state: HeroEditorState, heroUid: string, artifact: HeroSkill | null): HeroEditorState {
  return mapHero(state, heroUid, (hero) => ({ ...hero, artifact }));
}

export function addImage(state: HeroEditorState, heroUid: string, data: string): HeroEditorState {
  if (!isImageData(data)) return state;
  const uid = `i${state.nextId}`;
  const next = mapHero(state, heroUid, (hero) => ({ ...hero, images: [...hero.images, { uid, data }] }));
  return { ...next, nextId: state.nextId + 1 };
}

export function removeImage(state: HeroEditorState, heroUid: string, imageUid: string): HeroEditorState {
  return mapHero(state, heroUid, (hero) => ({ ...hero, images: hero.images.filter((image) => image.uid !== imageUid) }));
}

/** Moves an image to the front, where the roster shows it as the portrait. */
export function makePortrait(state: HeroEditorState, heroUid: string, imageUid: string): HeroEditorState {
  return mapHero(state, heroUid, (hero) => {
    const image = hero.images.find((entry) => entry.uid === imageUid);
    if (!image) return hero;
    return { ...hero, images: [image, ...hero.images.filter((entry) => entry.uid !== imageUid)] };
  });
}

function skillJson(skill: HeroSkill): string {
  return `{ "name": ${JSON.stringify(skill.name)}, "text": ${JSON.stringify(skill.text)} }`;
}

/** One hero per line, and one line per skill, so a roster diff stays readable. */
export function serializeHeroData(data: HeroData): string {
  const rows = data.heroes.map((hero, index, all) => {
    const comma = index < all.length - 1 ? "," : "";
    const images = `[${hero.images.map((file) => JSON.stringify(file)).join(", ")}]`;
    const head = `    { "id": ${JSON.stringify(hero.id)}, "name": ${JSON.stringify(hero.name)}, "rarity": ${JSON.stringify(hero.rarity)}, "obtain": ${JSON.stringify(hero.obtain)}, "images": ${images}, "skills": [`;
    const artifact = hero.artifact ? `, "artifact": ${skillJson(hero.artifact)}` : "";
    if (hero.skills.length === 0) return `${head}]${artifact} }${comma}`;
    const skills = hero.skills.map((skill, skillIndex) => `      ${skillJson(skill)}${skillIndex < hero.skills.length - 1 ? "," : ""}`);
    return [head, ...skills, `    ]${artifact} }${comma}`].join("\n");
  });
  return ["{", `  "heroes": [`, ...rows, "  ]", "}", ""].join("\n");
}

export function countHeroChanges(published: HeroData, draft: HeroData): number {
  const before = new Map(published.heroes.map((hero) => [hero.id, JSON.stringify(hero)]));
  const after = new Map(draft.heroes.map((hero) => [hero.id, JSON.stringify(hero)]));
  let changes = 0;
  for (const [id, json] of after) if (before.get(id) !== json) changes += 1;
  for (const id of before.keys()) if (!after.has(id)) changes += 1;
  const order = (data: HeroData) => data.heroes.map((hero) => hero.id).join("\0");
  if (changes === 0 && order(published) !== order(draft)) changes = 1;
  return changes;
}

export type HeroProblem =
  | { code: "emptyName"; rarity: HeroRarity }
  | { code: "duplicateName"; name: string }
  | { code: "emptySkill"; hero: string; index: number }
  | { code: "emptyArtifact"; hero: string }
  | { code: "stillUsed"; name: string; where: HeroReference[] };

export function findHeroProblems(state: HeroEditorState, published: HeroData): HeroProblem[] {
  const problems: HeroProblem[] = [];
  const seen = new Set<string>();
  for (const hero of state.heroes) {
    const name = hero.name.trim();
    if (!name) problems.push({ code: "emptyName", rarity: hero.rarity });
    const key = name.toLowerCase();
    if (name && seen.has(key)) problems.push({ code: "duplicateName", name });
    seen.add(key);
    hero.skills.forEach((skill, index) => {
      if (!skill.name.trim() || !skill.text.trim()) problems.push({ code: "emptySkill", hero: name || hero.rarity, index: index + 1 });
    });
    if (hero.artifact && (!hero.artifact.name.trim() || !hero.artifact.text.trim())) {
      problems.push({ code: "emptyArtifact", hero: name || hero.rarity });
    }
  }

  const references = heroReferences();
  for (const hero of published.heroes) {
    if (seen.has(hero.name.toLowerCase())) continue;
    const where = references.get(rosterName(hero.name));
    if (where?.size) problems.push({ code: "stillUsed", name: hero.name, where: [...where] });
  }
  return problems;
}

function isSkill(value: unknown): value is HeroSkill {
  const skill = value as HeroSkill;
  return typeof skill?.name === "string" && typeof skill.text === "string";
}

export function parseHeroDraft(raw: string | null): HeroEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as HeroEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.heroes)) return null;
    for (const hero of value.heroes) {
      if (typeof hero.uid !== "string" || typeof hero.id !== "string" || typeof hero.name !== "string") return null;
      if (!RARITY_SET.has(hero.rarity) || typeof hero.obtain !== "string") return null;
      if (!Array.isArray(hero.images) || !Array.isArray(hero.skills)) return null;
      for (const image of hero.images) {
        if (typeof image?.uid !== "string") return null;
        const hasFile = typeof image.file === "string" && image.file.length > 0;
        const hasData = isImageData(image.data);
        if (hasFile === hasData) return null;
      }
      for (const skill of hero.skills) if (!isSkill(skill) || typeof skill.uid !== "string") return null;
      if (hero.artifact !== null && !isSkill(hero.artifact)) return null;
    }
    return value;
  } catch {
    return null;
  }
}
