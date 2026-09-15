/**
 * Anecdotes: hidden stories in the game, each unlocked by a prerequisite and
 * finished by tapping the right things in the right order. The list is Autumn's
 * (Ice, S12) guide shared on Discord, last added to on 10 September 2026, with
 * help from Kraes, Zee, Spitzell, and Popo. The wording was tidied
 * (spelling, one action per step) without changing what to do; where the guide
 * leaves a gap (the egg order in Philosophical Thesis, the colour order in The
 * Dome Confinement) the anecdote says so in `note` instead of guessing.
 *
 * Rows live in `lib/data/anecdotes.json`; the anecdote editor exports a
 * replacement for that file. The wording there is English;
 * `guideEntries.anecdotes.anecdoteTexts` can override it per language. A
 * picture is optional: `image` names a file in `public/anecdotes/`, and the
 * page shows an empty slot until one is added.
 */

import data from "../data/anecdotes.json" with { type: "json" };
import { asset } from "../site.ts";

export const ANECDOTE_GROUPS = ["general", "egypt"] as const;
export type AnecdoteGroup = (typeof ANECDOTE_GROUPS)[number];

/** One thing to do. `substeps` are the options, places, or answers it lists. */
export type AnecdoteStep = { text: string; substeps?: string[] };

export type Anecdote = {
  id: string;
  group: AnecdoteGroup;
  name: string;
  /** Id of the anecdote that has to be finished first. */
  after?: string;
  /** Any other condition, in the game's words. */
  prerequisite?: string;
  reward?: string;
  steps: AnecdoteStep[];
  /** A warning or a known gap in the guide. */
  note?: string;
  /** Community members credited for this anecdote. Names are not translated. */
  thanks?: string[];
  /** File name in `public/anecdotes/`. */
  image?: string;
};

export type AnecdoteData = { anecdotes: Anecdote[] };

/** One step in another language; a missing or blank part keeps the English text. */
export type AnecdoteStepText = { text?: string; substeps?: string[] };

/**
 * An anecdote's wording in one language, keyed by anecdote id in
 * `guideEntries.anecdotes.anecdoteTexts`. Steps line up with the English steps
 * by position.
 */
export type AnecdoteText = {
  name?: string;
  prerequisite?: string;
  reward?: string;
  note?: string;
  steps?: AnecdoteStepText[];
};
export type AnecdoteTexts = Record<string, AnecdoteText>;

/** JSON has no string literal types; `tests/anecdotes.test.mjs` checks the groups. */
export const ANECDOTE_DATA = data as AnecdoteData;
export const ANECDOTES: Anecdote[] = ANECDOTE_DATA.anecdotes;

const pick = (own: string | undefined, english: string | undefined) => own?.trim() || english;

/** The anecdote with every filled-in translation from `texts` applied. */
export function localizedAnecdote(anecdote: Anecdote, texts: AnecdoteTexts): Anecdote {
  const local = texts[anecdote.id];
  if (!local) return anecdote;
  const next: Anecdote = {
    ...anecdote,
    name: pick(local.name, anecdote.name) ?? anecdote.name,
    steps: anecdote.steps.map((step, index) => {
      const own = local.steps?.[index];
      const text = pick(own?.text, step.text) ?? step.text;
      if (!step.substeps) return { text };
      return { text, substeps: step.substeps.map((substep, position) => pick(own?.substeps?.[position], substep) ?? substep) };
    }),
  };
  for (const key of ["prerequisite", "reward", "note"] as const) {
    if (anecdote[key]) next[key] = pick(local[key], anecdote[key]);
  }
  return next;
}

export function anecdoteImageUrl(file: string): string {
  return asset(`/anecdotes/${file}`);
}

/** Every searchable string of one wording of an anecdote. */
function textOf(anecdote: Anecdote): string[] {
  return [
    anecdote.name,
    anecdote.prerequisite ?? "",
    anecdote.reward ?? "",
    anecdote.note ?? "",
    ...anecdote.steps.flatMap((step) => [step.text, ...(step.substeps ?? [])]),
  ];
}

/** `catalogs` lets a search also match the wording readers see in other languages. */
export function searchAnecdotes(
  query: string,
  group: AnecdoteGroup | "all",
  catalogs: readonly AnecdoteTexts[] = [],
  list: readonly Anecdote[] = ANECDOTES,
): Anecdote[] {
  const pool = group === "all" ? [...list] : list.filter((anecdote) => anecdote.group === group);
  const needle = query.trim().toLowerCase();
  if (!needle) return pool;
  return pool.filter((anecdote) => {
    const translated = catalogs.flatMap((texts) => (texts[anecdote.id] ? textOf(localizedAnecdote(anecdote, texts)) : []));
    return [...textOf(anecdote), ...translated].join(" ").toLowerCase().includes(needle);
  });
}

/** The anecdotes that name `id` as the one to finish first. */
export function anecdotesAfter(id: string, list: readonly Anecdote[] = ANECDOTES): Anecdote[] {
  return list.filter((anecdote) => anecdote.after === id);
}

export function anecdoteById(id: string, list: readonly Anecdote[] = ANECDOTES): Anecdote | undefined {
  return list.find((anecdote) => anecdote.id === id);
}

/**
 * Where an anecdote sits in a chain of "finish first" links: its step from the
 * first anecdote, and how many anecdotes hang off that first one. Null when it
 * is not part of a chain.
 */
export function chainPosition(id: string, list: readonly Anecdote[] = ANECDOTES): { step: number; total: number } | null {
  const byId = new Map(list.map((anecdote) => [anecdote.id, anecdote]));
  let root = byId.get(id);
  if (!root) return null;
  let step = 1;
  const seen = new Set([root.id]);
  while (root.after && byId.has(root.after) && !seen.has(root.after)) {
    root = byId.get(root.after)!;
    seen.add(root.id);
    step += 1;
  }
  let total = 1;
  const queue = [root.id];
  const counted = new Set(queue);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of list) {
      if (next.after === current && !counted.has(next.id)) {
        counted.add(next.id);
        queue.push(next.id);
        total += 1;
      }
    }
  }
  return total > 1 ? { step, total } : null;
}
