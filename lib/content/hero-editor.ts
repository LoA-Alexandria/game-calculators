/**
 * Pure state logic for the Heroes roster editor. The page only renders this
 * state and calls these functions, so adding heroes, abilities, and portraits
 * can be tested without a browser.
 *
 * The editor works on a copy of `lib/data/heroes.json`. A static site cannot
 * save for everyone, so the result leaves the browser as that JSON file plus
 * any new portrait files for someone to commit, the same way the other guide
 * editors work. Uploaded portraits stay in the draft as data URLs until then.
 *
 * Names, rarities, and portraits are the same in every language and stay in
 * that JSON. The wording the game shows — obtain note, ability names, level
 * texts, artifact — is translated, so the draft also carries one text catalog
 * per language and exports them as `heroTexts` blocks for the dictionaries.
 */

import { heroReferences, rosterName, type HeroReference } from "./hero-links.ts";
import {
  HERO_ABILITY_KINDS,
  HERO_AGES,
  HERO_DATA,
  HERO_RARITIES,
  HERO_TROOPS,
  type Hero,
  type HeroAbility,
  type HeroAbilityKind,
  type HeroAbilityText,
  type HeroAge,
  type HeroData,
  type HeroRarity,
  type HeroSkill,
  type HeroTexts,
  type HeroTroop,
} from "./heroes.ts";
import { DEFAULT_LOCALE, LOCALES, getDictionary, type Locale } from "../i18n/index.ts";

/** A published portrait has `file`; one uploaded in the editor has `data`. */
export type EditorImage = { uid: string; file?: string; data?: string };

export type EditorHero = {
  uid: string;
  /** Empty for a hero added in the editor until export derives it from the name. */
  id: string;
  name: string;
  rarity: HeroRarity;
  obtain: string;
  title: string;
  troop: HeroTroop | "";
  age: HeroAge | "";
  bio: string;
  images: EditorImage[];
  /** Every slot is always present in the editor; export leaves out the empty ones. */
  abilities: Record<HeroAbilityKind, HeroAbility>;
  artifact: HeroSkill | null;
};

/** One language's wording for an ability; `levels` lines up with the English levels. */
export type AbilityTextDraft = { name: string; levels: string[] };

export type HeroTextDraft = {
  obtain: string;
  title: string;
  bio: string;
  abilities: Record<HeroAbilityKind, AbilityTextDraft>;
  artifact: { name: string; text: string };
};

/**
 * Translations keyed by locale and then by the hero's editor uid. English is
 * never kept here: `EditorHero` already holds it, and that is what
 * `lib/data/heroes.json` is written from.
 */
export type HeroEditorTexts = Record<Locale, Record<string, HeroTextDraft>>;

export type HeroEditorState = {
  version: 3;
  heroes: EditorHero[];
  texts: HeroEditorTexts;
  nextId: number;
};

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const property = (key: string) => (IDENTIFIER.test(key) ? key : JSON.stringify(key));

function emptyTexts(): HeroEditorTexts {
  return Object.fromEntries(LOCALES.map((locale) => [locale.code, {}])) as HeroEditorTexts;
}

function emptyAbilityText(): AbilityTextDraft {
  return { name: "", levels: [] };
}

function emptyHeroText(): HeroTextDraft {
  return {
    obtain: "",
    title: "",
    bio: "",
    abilities: { skill: emptyAbilityText(), buff: emptyAbilityText(), production: emptyAbilityText() },
    artifact: { name: "", text: "" },
  };
}

/** The published translations, so the editor starts from what the site shows. */
export function catalogsFromDictionaries(): Record<Locale, HeroTexts> {
  const catalogs = {} as Record<Locale, HeroTexts>;
  for (const { code } of LOCALES) catalogs[code] = getDictionary(code).guideEntries.heroes.heroTexts;
  return catalogs;
}

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

export function fromHeroData(data: HeroData, catalogs: Partial<Record<Locale, HeroTexts>> = {}): HeroEditorState {
  let nextId = 1;
  const texts = emptyTexts();
  const heroes = data.heroes.map((hero) => {
    const abilities = emptyAbilities();
    for (const kind of HERO_ABILITY_KINDS) {
      const ability = hero[kind];
      if (ability) abilities[kind] = { name: ability.name, levels: ability.levels.length ? [...ability.levels] : [""] };
    }
    const uid = `h${nextId++}`;
    for (const { code } of LOCALES) {
      if (code === DEFAULT_LOCALE) continue;
      const local = catalogs[code]?.[hero.id];
      if (!local) continue;
      const draft = emptyHeroText();
      draft.obtain = local.obtain ?? "";
      draft.title = local.title ?? "";
      draft.bio = local.bio ?? "";
      for (const kind of HERO_ABILITY_KINDS) {
        draft.abilities[kind] = {
          name: local[kind]?.name ?? "",
          levels: [...(local[kind]?.levels ?? [])],
        };
      }
      draft.artifact = { name: local.artifact?.name ?? "", text: local.artifact?.text ?? "" };
      texts[code][uid] = draft;
    }
    return {
      uid,
      id: hero.id,
      name: hero.name,
      rarity: hero.rarity,
      obtain: hero.obtain,
      title: hero.title ?? "",
      troop: (hero.troop ?? "") as EditorHero["troop"],
      age: (hero.age ?? "") as EditorHero["age"],
      bio: hero.bio ?? "",
      images: hero.images.map((file) => ({ uid: `i${nextId++}`, file })),
      abilities,
      artifact: hero.artifact ? { name: hero.artifact.name, text: hero.artifact.text } : null,
    };
  });
  return { version: 3, heroes, texts, nextId };
}

/**
 * The wording of one hero in one language. English is read back from the hero
 * row, so the editor can show every language through the same fields.
 */
export function heroTextOf(state: HeroEditorState, locale: Locale, uid: string): HeroTextDraft {
  const hero = heroByUid(state, uid);
  if (!hero) return emptyHeroText();
  if (locale === DEFAULT_LOCALE) {
    const abilities = { skill: emptyAbilityText(), buff: emptyAbilityText(), production: emptyAbilityText() };
    for (const kind of HERO_ABILITY_KINDS) {
      abilities[kind] = { name: hero.abilities[kind].name, levels: [...hero.abilities[kind].levels] };
    }
    return {
      obtain: hero.obtain,
      title: hero.title,
      bio: hero.bio,
      abilities,
      artifact: { name: hero.artifact?.name ?? "", text: hero.artifact?.text ?? "" },
    };
  }
  return state.texts[locale]?.[uid] ?? emptyHeroText();
}

function mapText(
  state: HeroEditorState,
  locale: Locale,
  uid: string,
  edit: (text: HeroTextDraft) => HeroTextDraft,
): HeroEditorState {
  const current = state.texts[locale]?.[uid] ?? emptyHeroText();
  return { ...state, texts: { ...state.texts, [locale]: { ...state.texts[locale], [uid]: edit(current) } } };
}

function mapAbilityText(
  state: HeroEditorState,
  locale: Locale,
  uid: string,
  kind: HeroAbilityKind,
  edit: (ability: AbilityTextDraft) => AbilityTextDraft,
): HeroEditorState {
  return mapText(state, locale, uid, (text) => ({
    ...text,
    abilities: { ...text.abilities, [kind]: edit(text.abilities[kind]) },
  }));
}

/** Drops the text every language keeps for a hero that is gone. */
function forgetHeroText(texts: HeroEditorTexts, uid: string): HeroEditorTexts {
  const next = emptyTexts();
  for (const { code } of LOCALES) {
    const catalog = { ...texts[code] };
    delete catalog[uid];
    next[code] = catalog;
  }
  return next;
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
    const row: Hero = {
      id,
      name: hero.name.trim(),
      rarity: hero.rarity,
      obtain: hero.obtain.trim(),
      images,
    };
    if (hero.title?.trim()) row.title = hero.title.trim();
    if (hero.troop) row.troop = hero.troop;
    if (hero.age) row.age = hero.age;
    if (hero.bio?.trim()) row.bio = hero.bio.trim();
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
  const hero: EditorHero = {
    uid,
    id: "",
    name,
    rarity,
    obtain: "",
    title: "",
    troop: "",
    age: "",
    bio: "",
    images: [],
    abilities: emptyAbilities(),
    artifact: null,
  };
  const heroes = [...state.heroes];
  heroes.splice(groupEnd(heroes, rarity), 0, hero);
  return { state: { ...state, heroes, nextId: state.nextId + 1 }, uid };
}

export function removeHero(state: HeroEditorState, uid: string): HeroEditorState {
  return { ...state, heroes: state.heroes.filter((hero) => hero.uid !== uid), texts: forgetHeroText(state.texts, uid) };
}

export function updateHero(
  state: HeroEditorState,
  uid: string,
  patch: Partial<Pick<EditorHero, "name" | "rarity" | "obtain" | "title" | "troop" | "age" | "bio">>,
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

/** The obtain note in one language; English is the row that goes into the JSON. */
export function setObtain(state: HeroEditorState, uid: string, locale: Locale, obtain: string): HeroEditorState {
  if (locale === DEFAULT_LOCALE) return updateHero(state, uid, { obtain });
  return mapText(state, locale, uid, (text) => ({ ...text, obtain }));
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

export function setAbilityName(
  state: HeroEditorState,
  heroUid: string,
  kind: HeroAbilityKind,
  name: string,
  locale: Locale = DEFAULT_LOCALE,
): HeroEditorState {
  if (locale !== DEFAULT_LOCALE) return mapAbilityText(state, locale, heroUid, kind, (ability) => ({ ...ability, name }));
  return mapAbility(state, heroUid, kind, (ability) => ({ ...ability, name }));
}

/** Text for one level; `index` 0 is Lv. 1. A translation only fills slots English already has. */
export function setAbilityLevel(
  state: HeroEditorState,
  heroUid: string,
  kind: HeroAbilityKind,
  index: number,
  text: string,
  locale: Locale = DEFAULT_LOCALE,
): HeroEditorState {
  if (locale !== DEFAULT_LOCALE) {
    const english = heroByUid(state, heroUid)?.abilities[kind].levels.length ?? 0;
    if (index < 0 || index >= english) return state;
    return mapAbilityText(state, locale, heroUid, kind, (ability) => {
      const levels = [...ability.levels];
      while (levels.length <= index) levels.push("");
      levels[index] = text;
      return { ...ability, levels };
    });
  }
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

/** Removes a level; the last remaining level is emptied instead. Translations lose the same slot so the rest stays lined up. */
export function removeAbilityLevel(state: HeroEditorState, heroUid: string, kind: HeroAbilityKind, index: number): HeroEditorState {
  const english = heroByUid(state, heroUid)?.abilities[kind].levels.length ?? 0;
  if (index < 0 || index >= english) return state;
  let next = mapAbility(state, heroUid, kind, (ability) => {
    const levels = ability.levels.filter((_, position) => position !== index);
    return { ...ability, levels: levels.length ? levels : [""] };
  });
  for (const { code } of LOCALES) {
    if (code === DEFAULT_LOCALE) continue;
    if (!next.texts[code]?.[heroUid]) continue;
    next = mapAbilityText(next, code, heroUid, kind, (ability) => ({
      ...ability,
      levels: ability.levels.filter((_, position) => position !== index),
    }));
  }
  return next;
}

export function clearAbility(state: HeroEditorState, heroUid: string, kind: HeroAbilityKind): HeroEditorState {
  let next = mapAbility(state, heroUid, kind, () => emptyAbility());
  for (const { code } of LOCALES) {
    if (code === DEFAULT_LOCALE) continue;
    if (!next.texts[code]?.[heroUid]) continue;
    next = mapAbilityText(next, code, heroUid, kind, () => emptyAbilityText());
  }
  return next;
}

export function setArtifact(state: HeroEditorState, heroUid: string, artifact: HeroSkill | null): HeroEditorState {
  let next = mapHero(state, heroUid, (hero) => ({ ...hero, artifact }));
  if (artifact === null) {
    for (const { code } of LOCALES) {
      if (code === DEFAULT_LOCALE) continue;
      if (!next.texts[code]?.[heroUid]) continue;
      next = mapText(next, code, heroUid, (text) => ({ ...text, artifact: { name: "", text: "" } }));
    }
  }
  return next;
}

/** The artifact name or effect in one language. */
export function setArtifactText(
  state: HeroEditorState,
  heroUid: string,
  locale: Locale,
  patch: Partial<HeroSkill>,
): HeroEditorState {
  if (locale === DEFAULT_LOCALE) {
    const current = heroByUid(state, heroUid)?.artifact;
    if (!current) return state;
    return setArtifact(state, heroUid, { ...current, ...patch });
  }
  return mapText(state, locale, heroUid, (text) => ({ ...text, artifact: { ...text.artifact, ...patch } }));
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
    const fields = [
      `"id": ${json(hero.id)}`,
      `"name": ${json(hero.name)}`,
      `"rarity": ${json(hero.rarity)}`,
      `"obtain": ${json(hero.obtain)}`,
      `"images": ${images}`,
    ];
    if (hero.title) fields.push(`"title": ${json(hero.title)}`);
    if (hero.troop) fields.push(`"troop": ${json(hero.troop)}`);
    if (hero.age) fields.push(`"age": ${json(hero.age)}`);
    if (hero.bio) fields.push(`"bio": ${json(hero.bio)}`);
    const head = `    { ${fields.join(", ")}`;
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

/** The id each hero will have in the JSON, so a translation can be keyed by it. */
function exportIds(state: HeroEditorState): Map<string, string> {
  const taken = new Set(state.heroes.map((hero) => hero.id).filter(Boolean));
  const ids = new Map<string, string>();
  for (const hero of state.heroes) {
    let id = hero.id;
    if (!id) {
      id = heroIdFrom(hero.name.trim(), taken);
      taken.add(id);
    }
    ids.set(hero.uid, id);
  }
  return ids;
}

function cleanAbilityText(english: HeroAbility, draft: AbilityTextDraft): HeroAbilityText | null {
  const name = draft.name.trim();
  const levels = english.levels.map((_, index) => draft.levels[index]?.trim() ?? "");
  while (levels.length > 0 && levels[levels.length - 1] === "") levels.pop();
  if (!name && levels.length === 0) return null;
  return { ...(name ? { name } : {}), ...(levels.length > 0 ? { levels } : {}) };
}

function cleanHeroText(hero: EditorHero, draft: HeroTextDraft): HeroTexts[string] | null {
  const entry: HeroTexts[string] = {};
  const obtain = draft.obtain.trim();
  if (obtain) entry.obtain = obtain;
  const title = draft.title.trim();
  if (title) entry.title = title;
  const bio = draft.bio.trim();
  if (bio) entry.bio = bio;
  for (const kind of HERO_ABILITY_KINDS) {
    // Nothing to translate for a slot the roster has no English text for.
    const english = cleanAbility(hero.abilities[kind]);
    if (!english) continue;
    const text = cleanAbilityText(english, draft.abilities[kind]);
    if (text) entry[kind] = text;
  }
  if (hero.artifact) {
    const name = draft.artifact.name.trim();
    const text = draft.artifact.text.trim();
    if (name || text) entry.artifact = { ...(name ? { name } : {}), ...(text ? { text } : {}) };
  }
  return Object.keys(entry).length > 0 ? entry : null;
}

/** Translations keyed by hero id, without the blanks. English stays in the JSON, so its catalog is empty. */
export function exportedHeroTexts(state: HeroEditorState): Record<Locale, HeroTexts> {
  const ids = exportIds(state);
  const result = {} as Record<Locale, HeroTexts>;
  for (const { code } of LOCALES) {
    const catalog: HeroTexts = {};
    if (code !== DEFAULT_LOCALE) {
      for (const hero of state.heroes) {
        const draft = state.texts[code]?.[hero.uid];
        const entry = draft ? cleanHeroText(hero, draft) : null;
        if (entry) catalog[ids.get(hero.uid) ?? hero.id] = entry;
      }
    }
    result[code] = catalog;
  }
  return result;
}

function formatAbilityText(kind: string, text: HeroAbilityText): string[] {
  const lines = [`          ${kind}: {`];
  if (text.name) lines.push(`            name: ${json(text.name)},`);
  if (text.levels?.length) {
    lines.push("            levels: [");
    for (const level of text.levels) lines.push(`              ${json(level)},`);
    lines.push("            ],");
  }
  lines.push("          },");
  return lines;
}

function formatHeroTexts(catalog: HeroTexts): string {
  const ids = Object.keys(catalog);
  if (ids.length === 0) return "      heroTexts: {},";
  const lines = ["      heroTexts: {"];
  for (const id of ids) {
    const entry = catalog[id];
    lines.push(`        ${property(id)}: {`);
    if (entry.obtain) lines.push(`          obtain: ${json(entry.obtain)},`);
    if (entry.title) lines.push(`          title: ${json(entry.title)},`);
    if (entry.bio) lines.push(`          bio: ${json(entry.bio)},`);
    for (const kind of HERO_ABILITY_KINDS) {
      const text = entry[kind];
      if (text) lines.push(...formatAbilityText(kind, text));
    }
    if (entry.artifact) {
      const parts = [
        ...(entry.artifact.name ? [`name: ${json(entry.artifact.name)}`] : []),
        ...(entry.artifact.text ? [`text: ${json(entry.artifact.text)}`] : []),
      ];
      lines.push(`          artifact: { ${parts.join(", ")} },`);
    }
    lines.push("        },");
  }
  lines.push("      },");
  return lines.join("\n");
}

/** The `heroTexts` block to paste into each dictionary. */
export function heroTextBlocks(state: HeroEditorState): Record<Locale, string> {
  const catalogs = exportedHeroTexts(state);
  const result = {} as Record<Locale, string>;
  for (const { code } of LOCALES) result[code] = formatHeroTexts(catalogs[code]);
  return result;
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

/** Roster changes plus one per language whose translations moved. */
export function countHeroDraftChanges(published: HeroEditorState, draft: HeroEditorState): number {
  let changes = countHeroChanges(exportHeroes(published, HERO_DATA).data, exportHeroes(draft, HERO_DATA).data);
  const before = exportedHeroTexts(published);
  const after = exportedHeroTexts(draft);
  for (const { code } of LOCALES) {
    if (code === DEFAULT_LOCALE) continue;
    if (JSON.stringify(before[code]) !== JSON.stringify(after[code])) changes += 1;
  }
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

function isAbilityText(value: unknown): value is AbilityTextDraft {
  const ability = value as AbilityTextDraft;
  return (
    typeof ability?.name === "string"
    && Array.isArray(ability.levels)
    && ability.levels.every((level) => typeof level === "string")
  );
}

function isHeroText(value: unknown): value is HeroTextDraft {
  const text = value as HeroTextDraft;
  if (typeof text?.obtain !== "string") return false;
  if (text.title !== undefined && typeof text.title !== "string") return false;
  if (text.bio !== undefined && typeof text.bio !== "string") return false;
  if (typeof text.abilities !== "object" || text.abilities === null) return false;
  if (typeof text.artifact?.name !== "string" || typeof text.artifact.text !== "string") return false;
  return HERO_ABILITY_KINDS.every((kind) => isAbilityText(text.abilities[kind]));
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
    if (value?.version !== 3 || typeof value.nextId !== "number" || !Array.isArray(value.heroes)) return null;
    if (!value.texts || typeof value.texts !== "object") return null;
    const texts = emptyTexts();
    for (const { code } of LOCALES) {
      const catalog = value.texts[code];
      if (!catalog) continue;
      if (typeof catalog !== "object") return null;
      for (const draft of Object.values(catalog)) {
        if (!isHeroText(draft)) return null;
        draft.title = draft.title ?? "";
        draft.bio = draft.bio ?? "";
      }
      texts[code] = catalog;
    }
    for (const hero of value.heroes) {
      if (typeof hero.uid !== "string" || typeof hero.id !== "string" || typeof hero.name !== "string") return null;
      if (!RARITY_SET.has(hero.rarity) || typeof hero.obtain !== "string") return null;
      hero.title = typeof hero.title === "string" ? hero.title : "";
      hero.bio = typeof hero.bio === "string" ? hero.bio : "";
      const troopOk = hero.troop === undefined || hero.troop === "" || HERO_TROOPS.includes(hero.troop as HeroTroop);
      const ageOk = hero.age === undefined || hero.age === "" || HERO_AGES.includes(hero.age as HeroAge);
      if (!troopOk || !ageOk) return null;
      hero.troop = (hero.troop ?? "") as EditorHero["troop"];
      hero.age = (hero.age ?? "") as EditorHero["age"];
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
    return { ...value, texts };
  } catch {
    return null;
  }
}

/** The roster and its translations as they are published right now. */
export const PUBLISHED_HEROES = fromHeroData(HERO_DATA, catalogsFromDictionaries());
