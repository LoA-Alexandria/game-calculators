/**
 * Pure state logic for the skins editor, for both rosters.
 *
 * A skin row is game data — who wears it, which event handed it out, whether it
 * can still be missed — and lives in `lib/data/hero-skins.json` or
 * `lib/data/goddess-skins.json`. Its name and its obtain line are words, so
 * every language keeps its own copy in the draft and they leave as a
 * `skinTexts` block; English is the one the file carries, because that is what
 * the other languages fall back to.
 *
 * The two rosters differ only in which groups a skin may sit in and which names
 * an owner may have, so one set of functions serves both.
 */

import { GODDESSES } from "./goddesses.ts";
import { HEROES } from "./heroes.ts";
import {
  GODDESS_SKINS,
  GODDESS_SKIN_GROUPS,
  HERO_SKINS,
  HERO_SKIN_GROUPS,
  type SkinData,
  type SkinRecord,
  type SkinTexts,
} from "./skins.ts";
import { DEFAULT_LOCALE, LOCALES, LOCALE_CODES, getDictionary, mapLocales, type Locale } from "../i18n/index.ts";
import { dictionaryLiteral } from "../i18n/translations.ts";

export const SKIN_ROSTERS = ["hero", "goddess"] as const;
export type SkinRoster = (typeof SKIN_ROSTERS)[number];

/** The data file each roster is kept in, by the name `lib/data` gives it. */
export const SKIN_FILES: Record<SkinRoster, string> = {
  hero: "hero-skins",
  goddess: "goddess-skins",
};

/** The guide whose dictionary entry holds the names of a roster's skins. */
export const SKIN_GUIDES: Record<SkinRoster, "heroes" | "goddesses"> = {
  hero: "heroes",
  goddess: "goddesses",
};

export function skinGroups(roster: SkinRoster): readonly string[] {
  return roster === "hero" ? HERO_SKIN_GROUPS : GODDESS_SKIN_GROUPS;
}

/** Roster spellings an owner may have, so a portrait and a link always resolve. */
export function skinOwners(roster: SkinRoster): readonly string[] {
  return roster === "hero" ? HEROES.map((hero) => hero.name) : GODDESSES.map((goddess) => goddess.name);
}

/** One skin while it is edited: game data, plus its words in every language. */
export type EditorSkin = {
  uid: string;
  id: string;
  owner: string;
  group: string;
  missable: boolean;
  unconfirmed: boolean;
};

/** Names and obtain lines per language, keyed by the row's editor uid. */
export type SkinsTexts = Record<Locale, Record<string, { name: string; obtain: string }>>;

export type SkinsEditorState = {
  version: 1;
  roster: SkinRoster;
  skins: EditorSkin[];
  texts: SkinsTexts;
  nextId: number;
};

function emptyTexts(): SkinsTexts {
  return mapLocales(() => ({}));
}

/** A row's words in one language, blank when nobody has written them. */
export function skinText(state: SkinsEditorState, locale: Locale, uid: string): { name: string; obtain: string } {
  return state.texts[locale][uid] ?? { name: "", obtain: "" };
}

/** `owner-name`, the shape the committed files use, so a text keeps its key. */
export function skinId(owner: string, name: string): string {
  const slug = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return [slug(owner), slug(name)].filter(Boolean).join("-");
}

/** The published translations of a roster's skins, one catalogue per language. */
export function catalogsFromDictionaries(roster: SkinRoster): Record<Locale, SkinTexts> {
  return mapLocales((locale) => getDictionary(locale).guideEntries[SKIN_GUIDES[roster]].skinTexts as SkinTexts);
}

export function fromSkinsData(
  roster: SkinRoster,
  data: SkinData,
  catalogs: Partial<Record<Locale, SkinTexts>> = {},
): SkinsEditorState {
  let nextId = 1;
  const texts = emptyTexts();
  const skins = data.skins.map((skin): EditorSkin => {
    const uid = `s${nextId++}`;
    for (const locale of LOCALE_CODES) {
      const local = catalogs[locale]?.[skin.id];
      // English is the file's own wording unless a dictionary changes it.
      const name = local?.name ?? (locale === DEFAULT_LOCALE ? skin.name : "");
      const obtain = local?.obtain ?? (locale === DEFAULT_LOCALE ? skin.obtain : "");
      if (name || obtain) texts[locale][uid] = { name, obtain };
    }
    return {
      uid,
      id: skin.id,
      owner: skin.owner,
      group: skin.group,
      missable: skin.missable === true,
      unconfirmed: skin.unconfirmed === true,
    };
  });
  return { version: 1, roster, skins, texts, nextId };
}

export function skinByUid(state: SkinsEditorState, uid: string): EditorSkin | undefined {
  return state.skins.find((skin) => skin.uid === uid);
}

export function addSkin(state: SkinsEditorState, owner: string): SkinsEditorState {
  const name = owner.trim();
  if (!name) return state;
  const uid = `s${state.nextId}`;
  const group = skinGroups(state.roster).at(-1) ?? "unknown";
  return {
    ...state,
    skins: [...state.skins, { uid, id: "", owner: name, group, missable: false, unconfirmed: false }],
    nextId: state.nextId + 1,
  };
}

export function removeSkin(state: SkinsEditorState, uid: string): SkinsEditorState {
  return {
    ...state,
    skins: state.skins.filter((skin) => skin.uid !== uid),
    texts: mapLocales((locale) => {
      const rows = { ...state.texts[locale] };
      delete rows[uid];
      return rows;
    }),
  };
}

export function updateSkin(
  state: SkinsEditorState,
  uid: string,
  patch: Partial<Pick<EditorSkin, "owner" | "group" | "missable" | "unconfirmed" | "id">>,
): SkinsEditorState {
  return {
    ...state,
    skins: state.skins.map((skin) => (skin.uid === uid ? { ...skin, ...patch } : skin)),
  };
}

export function setSkinText(
  state: SkinsEditorState,
  locale: Locale,
  uid: string,
  patch: Partial<{ name: string; obtain: string }>,
): SkinsEditorState {
  return {
    ...state,
    texts: {
      ...state.texts,
      [locale]: { ...state.texts[locale], [uid]: { ...skinText(state, locale, uid), ...patch } },
    },
  };
}

/** The identifier a row is filed under: the one it came with, or one from its words. */
export function idOf(state: SkinsEditorState, skin: EditorSkin): string {
  return skin.id || skinId(skin.owner, skinText(state, DEFAULT_LOCALE, skin.uid).name);
}

/** The file as it would be committed: rows in the order the editor shows them. */
export function exportSkins(state: SkinsEditorState): SkinData {
  return {
    skins: state.skins.map((skin): SkinRecord => {
      const english = skinText(state, DEFAULT_LOCALE, skin.uid);
      return {
        id: idOf(state, skin),
        owner: skin.owner.trim(),
        name: english.name.trim(),
        group: skin.group,
        obtain: english.obtain.trim(),
        // Flags are written only when they are true, the way the files have it.
        ...(skin.missable ? { missable: true } : {}),
        ...(skin.unconfirmed ? { unconfirmed: true } : {}),
      };
    }),
  };
}

/**
 * Translations keyed by skin id, without the blanks and without English: the
 * file already carries the English wording, and a dictionary that repeats it
 * would only be a second place to change it.
 */
export function exportedSkinTexts(state: SkinsEditorState): Record<Locale, SkinTexts> {
  return mapLocales((locale) => {
    const out: SkinTexts = {};
    if (locale === DEFAULT_LOCALE) return out;
    for (const skin of state.skins) {
      const words = skinText(state, locale, skin.uid);
      const name = words.name.trim();
      const obtain = words.obtain.trim();
      if (!name && !obtain) continue;
      out[idOf(state, skin)] = { ...(name ? { name } : {}), ...(obtain ? { obtain } : {}) };
    }
    return out;
  });
}

/** The `skinTexts` block to paste into each dictionary. */
export function textBlocks(state: SkinsEditorState): Record<Locale, string> {
  const catalogs = exportedSkinTexts(state);
  return mapLocales((locale) => `      skinTexts: ${dictionaryLiteral(catalogs[locale], "      ")},`);
}

function formatSkin(skin: SkinRecord): string {
  const parts = [
    `"id": ${JSON.stringify(skin.id)}`,
    `"owner": ${JSON.stringify(skin.owner)}`,
    `"name": ${JSON.stringify(skin.name)}`,
    `"group": ${JSON.stringify(skin.group)}`,
    `"obtain": ${JSON.stringify(skin.obtain)}`,
    ...(skin.missable ? ['"missable": true'] : []),
    ...(skin.unconfirmed ? ['"unconfirmed": true'] : []),
  ];
  return `    { ${parts.join(", ")} }`;
}

export function serializeSkinsData(data: SkinData): string {
  return `{\n  "skins": [\n${data.skins.map(formatSkin).join(",\n")}\n  ]\n}\n`;
}

/** Rows that moved or changed, plus one per language whose words moved. */
export function countSkinChanges(published: SkinsEditorState, draft: SkinsEditorState): number {
  const before = exportSkins(published).skins;
  const after = exportSkins(draft).skins;
  let changes = 0;
  const key = (skin: SkinRecord) => JSON.stringify(skin);
  const beforeRows = new Map(before.map((skin) => [skin.id, key(skin)]));
  const afterRows = new Map(after.map((skin) => [skin.id, key(skin)]));
  for (const [id, value] of afterRows) if (beforeRows.get(id) !== value) changes += 1;
  for (const id of beforeRows.keys()) if (!afterRows.has(id)) changes += 1;

  const beforeTexts = exportedSkinTexts(published);
  const afterTexts = exportedSkinTexts(draft);
  for (const locale of LOCALE_CODES) {
    if (JSON.stringify(beforeTexts[locale]) !== JSON.stringify(afterTexts[locale])) changes += 1;
  }
  return changes;
}

export type SkinProblem =
  | { code: "noName"; owner: string }
  | { code: "unknownOwner"; owner: string }
  | { code: "unknownGroup"; owner: string; group: string }
  | { code: "duplicateId"; id: string };

export function findSkinProblems(state: SkinsEditorState): SkinProblem[] {
  const problems: SkinProblem[] = [];
  const owners = new Set(skinOwners(state.roster).map((name) => name.toLowerCase()));
  const groups = new Set<string>(skinGroups(state.roster));
  const seen = new Set<string>();

  for (const skin of state.skins) {
    const english = skinText(state, DEFAULT_LOCALE, skin.uid);
    const name = english.name.trim();
    if (!name) {
      problems.push({ code: "noName", owner: skin.owner });
      continue;
    }
    if (!owners.has(skin.owner.trim().toLowerCase())) {
      problems.push({ code: "unknownOwner", owner: skin.owner });
    }
    if (!groups.has(skin.group)) {
      problems.push({ code: "unknownGroup", owner: skin.owner, group: skin.group });
    }
    const id = idOf(state, skin);
    if (seen.has(id)) problems.push({ code: "duplicateId", id });
    seen.add(id);
  }
  return problems;
}

/**
 * How many rows have no wording of their own per language, English aside.
 *
 * Not a problem — a reader without a translation sees the English line, the way
 * the rest of the site works — but worth saying out loud, because it is what
 * this editor is for and the easiest thing to forget.
 */
export function untranslatedSkins(state: SkinsEditorState): { language: string; count: number }[] {
  return LOCALES.filter(({ code }) => code !== DEFAULT_LOCALE)
    .map(({ code, label }) => ({
      language: label,
      count: state.skins.filter((skin) => {
        const words = skinText(state, code, skin.uid);
        return !words.name.trim() && !words.obtain.trim();
      }).length,
    }))
    .filter((row) => row.count > 0);
}

export function parseSkinsDraft(raw: string | null, roster: SkinRoster): SkinsEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as SkinsEditorState;
    if (value?.version !== 1 || value.roster !== roster) return null;
    if (typeof value.nextId !== "number" || !Array.isArray(value.skins)) return null;
    for (const skin of value.skins) {
      if (typeof skin?.uid !== "string" || typeof skin.owner !== "string") return null;
      if (typeof skin.group !== "string" || typeof skin.id !== "string") return null;
    }
    // A draft saved before a language was added still loads; that one starts empty.
    const texts = emptyTexts();
    for (const locale of LOCALE_CODES) {
      const rows = value.texts?.[locale];
      if (!rows || typeof rows !== "object") continue;
      for (const [uid, words] of Object.entries(rows)) {
        if (typeof words?.name !== "string" || typeof words.obtain !== "string") return null;
        texts[locale][uid] = { name: words.name, obtain: words.obtain };
      }
    }
    return {
      version: 1,
      roster,
      skins: value.skins.map((skin) => ({
        uid: skin.uid,
        id: skin.id,
        owner: skin.owner,
        group: skin.group,
        missable: skin.missable === true,
        unconfirmed: skin.unconfirmed === true,
      })),
      texts,
      nextId: value.nextId,
    };
  } catch {
    return null;
  }
}

/** The rows and words as they are published right now. */
export const PUBLISHED_SKINS: Record<SkinRoster, SkinsEditorState> = {
  hero: fromSkinsData("hero", { skins: HERO_SKINS }, catalogsFromDictionaries("hero")),
  goddess: fromSkinsData("goddess", { skins: GODDESS_SKINS }, catalogsFromDictionaries("goddess")),
};
