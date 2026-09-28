/**
 * Pure state logic for the lore editor: the epithet and the story of every
 * hero and goddess, in the languages that have their own.
 *
 * English lives in the roster files, because that is what the other languages
 * fall back to. German and French live one file per roster per language, and a
 * page shows the lore over whatever the dictionary says, so this is the only
 * place those two are written.
 *
 * Both languages of a roster are edited together and saved together: a page
 * half translated is what happens when they are not.
 */

import { GODDESSES, type Goddess } from "./goddesses.ts";
import { HEROES, type Hero } from "./heroes.ts";
import loreDe from "../data/hero-lore-de.json" with { type: "json" };
import loreFr from "../data/hero-lore-fr.json" with { type: "json" };
import goddessDe from "../data/goddess-lore-de.json" with { type: "json" };
import goddessFr from "../data/goddess-lore-fr.json" with { type: "json" };

export const LORE_ROSTERS = ["hero", "goddess"] as const;
export type LoreRoster = (typeof LORE_ROSTERS)[number];

/** The two languages that keep their own lore; English is in the roster file. */
export const LORE_LANGUAGES = ["de", "fr"] as const;
export type LoreLanguage = (typeof LORE_LANGUAGES)[number];

export type LoreEntry = { title?: string; bio?: string };
export type LoreFile = Record<string, LoreEntry>;

/** The data file each roster and language is kept in, by its name under `lib/data/`. */
export const LORE_FILES: Record<LoreRoster, Record<LoreLanguage, string>> = {
  hero: { de: "hero-lore-de", fr: "hero-lore-fr" },
  goddess: { de: "goddess-lore-de", fr: "goddess-lore-fr" },
};

export const COMMITTED_LORE: Record<LoreRoster, Record<LoreLanguage, LoreFile>> = {
  hero: { de: loreDe as LoreFile, fr: loreFr as LoreFile },
  goddess: { de: goddessDe as LoreFile, fr: goddessFr as LoreFile },
};

export type EditorLoreRow = {
  id: string;
  /** The roster's own name and epithet, so a translator can see what they are translating. */
  name: string;
  english: LoreEntry;
  de: { title: string; bio: string };
  fr: { title: string; bio: string };
};

export type LoreEditorState = {
  version: 1;
  roster: LoreRoster;
  rows: EditorLoreRow[];
};

function rosterOf(roster: LoreRoster): readonly (Hero | Goddess)[] {
  return roster === "hero" ? HEROES : GODDESSES;
}

export function fromLoreData(
  roster: LoreRoster,
  files: Record<LoreLanguage, LoreFile>,
  people: readonly (Hero | Goddess)[] = rosterOf(roster),
): LoreEditorState {
  const seen = new Set<string>();
  const rows: EditorLoreRow[] = people.map((person) => {
    seen.add(person.id);
    return {
      id: person.id,
      name: person.name,
      english: { title: person.title ?? "", bio: person.bio ?? "" },
      de: {
        title: files.de[person.id]?.title ?? "",
        bio: files.de[person.id]?.bio ?? "",
      },
      fr: {
        title: files.fr[person.id]?.title ?? "",
        bio: files.fr[person.id]?.bio ?? "",
      },
    };
  });
  // Lore for somebody the roster no longer has is kept rather than dropped: it
  // is somebody's writing, and the editor names it instead of eating it.
  for (const language of LORE_LANGUAGES) {
    for (const id of Object.keys(files[language])) {
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push({
        id,
        name: id,
        english: {},
        de: { title: files.de[id]?.title ?? "", bio: files.de[id]?.bio ?? "" },
        fr: { title: files.fr[id]?.title ?? "", bio: files.fr[id]?.bio ?? "" },
      });
    }
  }
  return { version: 1, roster, rows };
}

export function setLore(
  state: LoreEditorState,
  id: string,
  language: LoreLanguage,
  patch: Partial<{ title: string; bio: string }>,
): LoreEditorState {
  return {
    ...state,
    rows: state.rows.map((row) => (row.id === id ? { ...row, [language]: { ...row[language], ...patch } } : row)),
  };
}

/** One language's file as it would be committed, in roster order. */
export function exportLore(state: LoreEditorState, language: LoreLanguage): LoreFile {
  const out: LoreFile = {};
  for (const row of state.rows) {
    const title = row[language].title.trim();
    const bio = row[language].bio.trim();
    if (!title && !bio) continue;
    out[row.id] = { ...(title ? { title } : {}), ...(bio ? { bio } : {}) };
  }
  return out;
}

/** Rows whose wording moved, counted once per language. */
export function countLoreChanges(published: LoreEditorState, draft: LoreEditorState): number {
  let changes = 0;
  for (const language of LORE_LANGUAGES) {
    const before = exportLore(published, language);
    const after = exportLore(draft, language);
    const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const id of ids) {
      if (JSON.stringify(before[id]) !== JSON.stringify(after[id])) changes += 1;
    }
  }
  return changes;
}

export type LoreProblem =
  | { code: "notOnRoster"; id: string }
  | { code: "bioWithoutTitle"; name: string; language: LoreLanguage }
  | { code: "titleWithoutBio"; name: string; language: LoreLanguage };

export function findLoreProblems(state: LoreEditorState): LoreProblem[] {
  const problems: LoreProblem[] = [];
  const known = new Set(rosterOf(state.roster).map((person) => person.id));
  for (const row of state.rows) {
    if (!known.has(row.id)) problems.push({ code: "notOnRoster", id: row.id });
    for (const language of LORE_LANGUAGES) {
      const title = row[language].title.trim();
      const bio = row[language].bio.trim();
      // Half a translation reads as a mistake on the page: the epithet in one
      // language above the story in another.
      if (bio && !title) problems.push({ code: "bioWithoutTitle", name: row.name, language });
      if (title && !bio) problems.push({ code: "titleWithoutBio", name: row.name, language });
    }
  }
  return problems;
}

/** How many of the roster have no lore at all, per language. */
export function untranslatedLore(state: LoreEditorState): { language: LoreLanguage; count: number }[] {
  return LORE_LANGUAGES.map((language) => ({
    language,
    count: state.rows.filter((row) => !row[language].title.trim() && !row[language].bio.trim()).length,
  })).filter((row) => row.count > 0);
}

/**
 * Indented the way the files are committed, so an export is a diff of the
 * lines that changed rather than of the whole file.
 */
export function serializeLore(file: LoreFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}

export function parseLoreDraft(raw: string | null, roster: LoreRoster): LoreEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as LoreEditorState;
    if (value?.version !== 1 || value.roster !== roster || !Array.isArray(value.rows)) return null;
    for (const row of value.rows) {
      if (typeof row?.id !== "string" || typeof row.name !== "string") return null;
      for (const language of LORE_LANGUAGES) {
        if (typeof row[language]?.title !== "string" || typeof row[language]?.bio !== "string") return null;
      }
    }
    return value;
  } catch {
    return null;
  }
}

/** The lore as it is published right now. */
export const PUBLISHED_LORE: Record<LoreRoster, LoreEditorState> = {
  hero: fromLoreData("hero", COMMITTED_LORE.hero),
  goddess: fromLoreData("goddess", COMMITTED_LORE.goddess),
};
