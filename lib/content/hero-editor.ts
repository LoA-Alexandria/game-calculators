/**
 * Pure state logic for the Heroes roster editor. The page only renders this
 * state and calls these functions, so adding heroes, abilities, and portraits
 * can be tested without a browser.
 *
 * The editor works on a copy of `lib/data/heroes.json`. A static site cannot
 * save for everyone, so the result leaves the browser as that JSON file plus
 * any new portrait files for someone to commit, the same way the other guide
 * editors work. Uploaded portraits stay in the draft as data URLs until then.
 */

import { heroReferences, rosterName, type HeroReference } from "./hero-links.ts";
import {
  HERO_ABILITY_KINDS,
  HERO_RARITIES,
  type Hero,
  type HeroAbility,
  type HeroAbilityKind,
  type HeroData,
  type HeroRarity,
  type HeroSkill,
} from "./heroes.ts";

/** A published portrait has `file`; one uploaded in the editor has `data`. */
export type EditorImage = { uid: string; file?: string; data?: string };

export type EditorHero = {
  uid: string;
  /** Empty for a hero added in the editor until export derives it from the name. */
  id: string;
  name: string;
  rarity: HeroRarity;
  obtain: string;
  images: EditorImage[];
  /** Every slot is always present in the editor; export leaves out the empty ones. */
  abilities: Record<HeroAbilityKind, HeroAbility>;
  artifact: HeroSkill | null;
};

export type HeroEditorState = {
  version: 2;
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

const emptyAbility = (): HeroAbility => ({ name: "", levels: [""] });

function emptyAbilities(): Record<HeroAbilityKind, HeroAbility> {
  return { skill: emptyAbility(), buff: emptyAbility(), production: emptyAbility() };
}

export function fromHeroData(data: HeroData): HeroEditorState {
  let nextId = 1;
  return {
    version: 2,
    heroes: data.heroes.map((hero) => {
      const abilities = emptyAbilities();
      for (const kind of HERO_ABILITY_KINDS) {
        const ability = hero[kind];
        if (ability) abilities[kind] = { name: ability.name, levels: ability.levels.length ? [...ability.levels] : [""] };
      }
      return {
        uid: `h${nextId++}`,
        id: hero.id,
        name: hero.name,
        rarity: hero.rarity,
        obtain: hero.obtain,
        images: hero.images.map((file) => ({ uid: `i${nextId++}`, file })),
        abilities,
        artifact: hero.artifact ? { name: hero.artifact.name, text: hero.artifact.text } : null,
      };
    }),
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

/** Trimmed, without trailing unknown levels; null when nothing is filled in. */
function cleanAbility(ability: HeroAbility): HeroAbility | null {
  const name = ability.name.trim();
  const levels = ability.levels.map((level) => level.trim());
  while (levels.length > 0 && levels[levels.length - 1] === "") levels.pop();
  if (!name && levels.length === 0) return null;
  return { name, levels };
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
    const row: Hero = { id, name: hero.name.trim(), rarity: hero.rarity, obtain: hero.obtain.trim(), images };
    for (const kind of HERO_ABILITY_KINDS) {
      const ability = cleanAbility(hero.abilities[kind]);
      if (ability) row[kind] = ability;
    }
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
  const hero: EditorHero = { uid, id: "", name, rarity, obtain: "", images: [], abilities: emptyAbilities(), artifact: null };
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

function mapAbility(
  state: HeroEditorState,
  heroUid: string,
  kind: HeroAbilityKind,
  change: (ability: HeroAbility) => HeroAbility,
): HeroEditorState {
  return mapHero(state, heroUid, (hero) => ({ ...hero, abilities: { ...hero.abilities, [kind]: change(hero.abilities[kind]) } }));
}

export function setAbilityName(state: HeroEditorState, heroUid: string, kind: HeroAbilityKind, name: string): HeroEditorState {
  return mapAbility(state, heroUid, kind, (ability) => ({ ...ability, name }));
}

/** Text for one level; `index` 0 is Lv. 1. */
export function setAbilityLevel(state: HeroEditorState, heroUid: string, kind: HeroAbilityKind, index: number, text: string): HeroEditorState {
  return mapAbility(state, heroUid, kind, (ability) => {
    if (index < 0 || index >= ability.levels.length) return ability;
    const levels = [...ability.levels];
    levels[index] = text;
    return { ...ability, levels };
  });
}

/** Adds the next level, starting from the previous level's text, which usually only changes in its numbers. */
export function addAbilityLevel(state: HeroEditorState, heroUid: string, kind: HeroAbilityKind): HeroEditorState {
  return mapAbility(state, heroUid, kind, (ability) => ({
    ...ability,
    levels: [...ability.levels, ability.levels[ability.levels.length - 1] ?? ""],
  }));
}

/** Removes a level; the last remaining level is emptied instead. */
export function removeAbilityLevel(state: HeroEditorState, heroUid: string, kind: HeroAbilityKind, index: number): HeroEditorState {
  return mapAbility(state, heroUid, kind, (ability) => {
    if (index < 0 || index >= ability.levels.length) return ability;
    const levels = ability.levels.filter((_, position) => position !== index);
    return { ...ability, levels: levels.length ? levels : [""] };
  });
}

export function clearAbility(state: HeroEditorState, heroUid: string, kind: HeroAbilityKind): HeroEditorState {
  return mapAbility(state, heroUid, kind, () => emptyAbility());
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

const json = (value: unknown) => JSON.stringify(value);

function abilityJson(ability: HeroAbility): string {
  return `{ "name": ${json(ability.name)}, "levels": [${ability.levels.map(json).join(", ")}] }`;
}

/** One line per hero, and one line per ability or artifact, so a roster diff stays readable. */
export function serializeHeroData(data: HeroData): string {
  const rows = data.heroes.map((hero, index, all) => {
    const comma = index < all.length - 1 ? "," : "";
    const images = `[${hero.images.map(json).join(", ")}]`;
    const head = `    { "id": ${json(hero.id)}, "name": ${json(hero.name)}, "rarity": ${json(hero.rarity)}, "obtain": ${json(hero.obtain)}, "images": ${images}`;
    const parts: string[] = [];
    for (const kind of HERO_ABILITY_KINDS) {
      const ability = hero[kind];
      if (ability) parts.push(`      ${json(kind)}: ${abilityJson(ability)}`);
    }
    if (hero.artifact) parts.push(`      "artifact": { "name": ${json(hero.artifact.name)}, "text": ${json(hero.artifact.text)} }`);
    if (parts.length === 0) return `${head} }${comma}`;
    return `${head},\n${parts.join(",\n")} }${comma}`;
  });
  return ["{", `  "heroes": [`, ...rows, "  ]", "}", ""].join("\n");
}

export function countHeroChanges(published: HeroData, draft: HeroData): number {
  const before = new Map(published.heroes.map((hero) => [hero.id, JSON.stringify(hero)]));
  const after = new Map(draft.heroes.map((hero) => [hero.id, JSON.stringify(hero)]));
  let changes = 0;
  for (const [id, text] of after) if (before.get(id) !== text) changes += 1;
  for (const id of before.keys()) if (!after.has(id)) changes += 1;
  const order = (data: HeroData) => data.heroes.map((hero) => hero.id).join("\0");
  if (changes === 0 && order(published) !== order(draft)) changes = 1;
  return changes;
}

export type HeroProblem =
  | { code: "emptyName"; rarity: HeroRarity }
  | { code: "duplicateName"; name: string }
  | { code: "incompleteAbility"; hero: string; kind: HeroAbilityKind }
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
    for (const kind of HERO_ABILITY_KINDS) {
      const ability = cleanAbility(hero.abilities[kind]);
      // A level may be unknown, but a named ability needs some text and text needs a name.
      if (ability && (!ability.name || ability.levels.every((level) => level === ""))) {
        problems.push({ code: "incompleteAbility", hero: name || hero.rarity, kind });
      }
    }
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

function isAbility(value: unknown): value is HeroAbility {
  const ability = value as HeroAbility;
  return (
    typeof ability?.name === "string"
    && Array.isArray(ability.levels)
    && ability.levels.length > 0
    && ability.levels.every((level) => typeof level === "string")
  );
}

export function parseHeroDraft(raw: string | null): HeroEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as HeroEditorState;
    if (value?.version !== 2 || typeof value.nextId !== "number" || !Array.isArray(value.heroes)) return null;
    for (const hero of value.heroes) {
      if (typeof hero.uid !== "string" || typeof hero.id !== "string" || typeof hero.name !== "string") return null;
      if (!RARITY_SET.has(hero.rarity) || typeof hero.obtain !== "string") return null;
      if (!Array.isArray(hero.images) || typeof hero.abilities !== "object" || hero.abilities === null) return null;
      for (const image of hero.images) {
        if (typeof image?.uid !== "string") return null;
        const hasFile = typeof image.file === "string" && image.file.length > 0;
        const hasData = isImageData(image.data);
        if (hasFile === hasData) return null;
      }
      for (const kind of HERO_ABILITY_KINDS) if (!isAbility(hero.abilities[kind])) return null;
      if (hero.artifact !== null && !isSkill(hero.artifact)) return null;
    }
    return value;
  } catch {
    return null;
  }
}
