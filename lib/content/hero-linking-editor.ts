/**
 * Pure state logic for the Hero linking editor. The page only renders this
 * state and calls these functions, so picking heroes, reordering the priority
 * list, and exporting can be tested without a browser.
 *
 * The editor works on a copy of `lib/data/hero-linking.json`. A static site
 * cannot save for everyone, so the result leaves the browser as that JSON file
 * plus one dictionary block per language, the same way the other guide editors
 * work.
 *
 * Heroes come from the Core elements Heroes roster and are stored by their
 * roster name, so a portrait and a roster link always resolve. The note beside
 * a hero is prose rather than game data, so every language — English included —
 * keeps its own copy in the draft and is exported as a `linkTexts` block.
 */

import { HEROES } from "./heroes.ts";
import {
  LINKING_DATA,
  LINK_SOURCES,
  type HeroLink,
  type HeroLinkingData,
  type HeroLinkingTexts,
  type LinkSource,
  type LinkTarget,
} from "./hero-linking.ts";
import { LOCALES, getDictionary, type Locale } from "../i18n/index.ts";

/** The two lists the editor keeps; a note is filed under one of them. */
export const LINK_LISTS = ["links", "priority"] as const;
export type LinkList = (typeof LINK_LISTS)[number];

export type EditorLink = { uid: string; hero: string; source: LinkSource; step: number };
export type EditorTarget = { uid: string; hero: string };

/** Notes per language, keyed by list and then by the row's editor uid. */
export type LinkingTexts = Record<Locale, Record<LinkList, Record<string, string>>>;

export type LinkingEditorState = {
  version: 1;
  links: EditorLink[];
  priority: EditorTarget[];
  texts: LinkingTexts;
  nextId: number;
};

const HERO_NAMES = new Set(HEROES.map((hero) => hero.name));
const SOURCE_SET = new Set<string>(LINK_SOURCES);
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const property = (key: string) => (IDENTIFIER.test(key) ? key : JSON.stringify(key));

function emptyTexts(): LinkingTexts {
  return Object.fromEntries(LOCALES.map((locale) => [locale.code, { links: {}, priority: {} }])) as LinkingTexts;
}

/** The published notes, so the editor starts from what the site shows. */
export function catalogsFromDictionaries(): Record<Locale, HeroLinkingTexts> {
  const catalogs = {} as Record<Locale, HeroLinkingTexts>;
  for (const { code } of LOCALES) catalogs[code] = getDictionary(code).guideEntries.heroLinking.linkTexts;
  return catalogs;
}

export function fromLinkingData(
  data: HeroLinkingData,
  catalogs: Partial<Record<Locale, HeroLinkingTexts>> = {},
): LinkingEditorState {
  let nextId = 1;
  const texts = emptyTexts();
  const links = data.links.map((link) => {
    const uid = `l${nextId++}`;
    for (const { code } of LOCALES) {
      const note = catalogs[code]?.links?.[link.hero];
      if (note) texts[code].links[uid] = note;
    }
    return { uid, hero: link.hero, source: link.source, step: link.step };
  });
  const priority = data.priority.map((target) => {
    const uid = `p${nextId++}`;
    for (const { code } of LOCALES) {
      const note = catalogs[code]?.priority?.[target.hero];
      if (note) texts[code].priority[uid] = note;
    }
    return { uid, hero: target.hero };
  });
  return { version: 1, links, priority, texts, nextId };
}

export function linkByUid(state: LinkingEditorState, uid: string): EditorLink | undefined {
  return state.links.find((link) => link.uid === uid);
}

/** Roster heroes that are not in `list` yet, so the picker cannot add a duplicate. */
export function unusedHeroes(state: LinkingEditorState, list: LinkList): typeof HEROES {
  const used = new Set(
    list === "links" ? state.links.map((link) => link.hero) : state.priority.map((target) => target.hero),
  );
  return HEROES.filter((hero) => !used.has(hero.name));
}

function forget(texts: LinkingTexts, list: LinkList, uid: string): LinkingTexts {
  const next = emptyTexts();
  for (const { code } of LOCALES) {
    const notes = { ...texts[code][list] };
    delete notes[uid];
    next[code] = { ...texts[code], [list]: notes };
  }
  return next;
}

export function addLink(state: LinkingEditorState, hero: string, source: LinkSource = "grail"): LinkingEditorState {
  const name = hero.trim();
  if (!HERO_NAMES.has(name) || state.links.some((link) => link.hero === name)) return state;
  const step = Math.max(0, ...state.links.filter((link) => link.source === source).map((link) => link.step)) + 1;
  return {
    ...state,
    links: [...state.links, { uid: `l${state.nextId}`, hero: name, source, step }],
    nextId: state.nextId + 1,
  };
}

export function removeLink(state: LinkingEditorState, uid: string): LinkingEditorState {
  return { ...state, links: state.links.filter((link) => link.uid !== uid), texts: forget(state.texts, "links", uid) };
}

export function updateLink(
  state: LinkingEditorState,
  uid: string,
  patch: Partial<Pick<EditorLink, "source" | "step">>,
): LinkingEditorState {
  return {
    ...state,
    links: state.links.map((link) => (link.uid === uid ? { ...link, ...patch } : link)),
  };
}

export function addTarget(state: LinkingEditorState, hero: string): LinkingEditorState {
  const name = hero.trim();
  if (!HERO_NAMES.has(name) || state.priority.some((target) => target.hero === name)) return state;
  return {
    ...state,
    priority: [...state.priority, { uid: `p${state.nextId}`, hero: name }],
    nextId: state.nextId + 1,
  };
}

export function removeTarget(state: LinkingEditorState, uid: string): LinkingEditorState {
  return {
    ...state,
    priority: state.priority.filter((target) => target.uid !== uid),
    texts: forget(state.texts, "priority", uid),
  };
}

/** Moves a hero to `toIndex` in the priority list, which is the order links are spent in. */
export function moveTarget(state: LinkingEditorState, uid: string, toIndex: number): LinkingEditorState {
  const current = state.priority.findIndex((target) => target.uid === uid);
  if (current < 0) return state;
  const moving = state.priority[current];
  const without = state.priority.filter((target) => target.uid !== uid);
  const index = Math.max(0, Math.min(toIndex, without.length));
  return { ...state, priority: [...without.slice(0, index), moving, ...without.slice(index)] };
}

export function noteOf(state: LinkingEditorState, locale: Locale, list: LinkList, uid: string): string {
  return state.texts[locale]?.[list]?.[uid] ?? "";
}

export function setNote(
  state: LinkingEditorState,
  locale: Locale,
  list: LinkList,
  uid: string,
  note: string,
): LinkingEditorState {
  return {
    ...state,
    texts: {
      ...state.texts,
      [locale]: { ...state.texts[locale], [list]: { ...state.texts[locale][list], [uid]: note } },
    },
  };
}

/** The file as it would be committed: links in track and step order, priority as arranged. */
export function exportLinking(state: LinkingEditorState): HeroLinkingData {
  const links = [...state.links]
    .sort((left, right) => {
      const track = LINK_SOURCES.indexOf(left.source) - LINK_SOURCES.indexOf(right.source);
      return track !== 0 ? track : left.step - right.step;
    })
    .map((link): HeroLink => ({ hero: link.hero, source: link.source, step: link.step }));
  return { links, priority: state.priority.map((target): LinkTarget => ({ hero: target.hero })) };
}

/** Notes keyed by hero name, without the blanks. */
export function exportedLinkTexts(state: LinkingEditorState): Record<Locale, HeroLinkingTexts> {
  const result = {} as Record<Locale, HeroLinkingTexts>;
  for (const { code } of LOCALES) {
    const links: Record<string, string> = {};
    for (const link of state.links) {
      const note = noteOf(state, code, "links", link.uid).trim();
      if (note) links[link.hero] = note;
    }
    const priority: Record<string, string> = {};
    for (const target of state.priority) {
      const note = noteOf(state, code, "priority", target.uid).trim();
      if (note) priority[target.hero] = note;
    }
    result[code] = {
      ...(Object.keys(links).length > 0 ? { links } : {}),
      ...(Object.keys(priority).length > 0 ? { priority } : {}),
    };
  }
  return result;
}

function formatNotes(name: string, notes: Record<string, string> | undefined, indent: string): string[] {
  if (!notes || Object.keys(notes).length === 0) return [];
  const lines = [`${indent}${name}: {`];
  for (const [hero, note] of Object.entries(notes)) {
    lines.push(`${indent}  ${property(hero)}: ${JSON.stringify(note)},`);
  }
  lines.push(`${indent}},`);
  return lines;
}

/** The `linkTexts` block to paste into each dictionary. */
export function textBlocks(state: LinkingEditorState): Record<Locale, string> {
  const catalogs = exportedLinkTexts(state);
  const result = {} as Record<Locale, string>;
  for (const { code } of LOCALES) {
    const catalog = catalogs[code];
    if (!catalog.links && !catalog.priority) {
      result[code] = "      linkTexts: {},";
      continue;
    }
    result[code] = [
      "      linkTexts: {",
      ...formatNotes("links", catalog.links, "        "),
      ...formatNotes("priority", catalog.priority, "        "),
      "      },",
    ].join("\n");
  }
  return result;
}

function formatLink(link: HeroLink): string {
  return `    { "hero": ${JSON.stringify(link.hero)}, "source": ${JSON.stringify(link.source)}, "step": ${link.step} }`;
}

export function serializeLinkingData(data: HeroLinkingData): string {
  const links = data.links.map(formatLink).join(",\n");
  const priority = data.priority.map((target) => `    { "hero": ${JSON.stringify(target.hero)} }`).join(",\n");
  return `{\n  "links": [\n${links}\n  ],\n  "priority": [\n${priority}\n  ]\n}\n`;
}

/** Rows that moved, plus one per language whose notes moved. */
export function countLinkingChanges(published: LinkingEditorState, draft: LinkingEditorState): number {
  const before = exportLinking(published);
  const after = exportLinking(draft);
  let changes = 0;
  const key = (link: HeroLink) => `${link.source}#${link.step}`;
  const beforeLinks = new Map(before.links.map((link) => [link.hero, key(link)]));
  const afterLinks = new Map(after.links.map((link) => [link.hero, key(link)]));
  for (const [hero, value] of afterLinks) if (beforeLinks.get(hero) !== value) changes += 1;
  for (const hero of beforeLinks.keys()) if (!afterLinks.has(hero)) changes += 1;

  const order = (data: HeroLinkingData) => data.priority.map((target) => target.hero).join("\0");
  if (order(before) !== order(after)) changes += 1;

  const beforeTexts = exportedLinkTexts(published);
  const afterTexts = exportedLinkTexts(draft);
  for (const { code } of LOCALES) {
    if (JSON.stringify(beforeTexts[code]) !== JSON.stringify(afterTexts[code])) changes += 1;
  }
  return changes;
}

export type LinkingProblem =
  | { code: "unknownHero"; hero: string }
  | { code: "duplicateLink"; hero: string }
  | { code: "duplicateStep"; source: LinkSource; step: number }
  | { code: "noLinks" }
  | { code: "noPriority" }
  | { code: "missingNote"; hero: string; language: string };

export function findLinkingProblems(state: LinkingEditorState): LinkingProblem[] {
  const problems: LinkingProblem[] = [];
  if (state.links.length === 0) problems.push({ code: "noLinks" });
  if (state.priority.length === 0) problems.push({ code: "noPriority" });

  const seenLink = new Set<string>();
  const seenStep = new Set<string>();
  for (const link of state.links) {
    if (!HERO_NAMES.has(link.hero)) problems.push({ code: "unknownHero", hero: link.hero });
    if (seenLink.has(link.hero)) problems.push({ code: "duplicateLink", hero: link.hero });
    seenLink.add(link.hero);
    const step = `${link.source}#${link.step}`;
    if (seenStep.has(step)) problems.push({ code: "duplicateStep", source: link.source, step: link.step });
    seenStep.add(step);
  }
  for (const target of state.priority) {
    if (!HERO_NAMES.has(target.hero)) problems.push({ code: "unknownHero", hero: target.hero });
  }

  // A note written in one language but not the others would show up blank there.
  for (const list of LINK_LISTS) {
    const rows = list === "links" ? state.links : state.priority;
    for (const row of rows) {
      const written = LOCALES.filter(({ code }) => noteOf(state, code, list, row.uid).trim());
      if (written.length === 0 || written.length === LOCALES.length) continue;
      for (const { code, label } of LOCALES) {
        if (!noteOf(state, code, list, row.uid).trim()) problems.push({ code: "missingNote", hero: row.hero, language: label });
      }
    }
  }
  return problems;
}

export function parseLinkingDraft(raw: string | null): LinkingEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as LinkingEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number") return null;
    if (!Array.isArray(value.links) || !Array.isArray(value.priority)) return null;
    for (const link of value.links) {
      if (typeof link?.uid !== "string" || typeof link.hero !== "string") return null;
      if (!SOURCE_SET.has(link.source) || !Number.isInteger(link.step) || link.step < 1) return null;
    }
    for (const target of value.priority) {
      if (typeof target?.uid !== "string" || typeof target.hero !== "string") return null;
    }
    if (!value.texts || typeof value.texts !== "object") return null;
    const texts = emptyTexts();
    for (const { code } of LOCALES) {
      const catalog = value.texts[code];
      if (!catalog || typeof catalog !== "object") continue;
      for (const list of LINK_LISTS) {
        const notes = catalog[list];
        if (!notes || typeof notes !== "object") continue;
        if (Object.values(notes).some((note) => typeof note !== "string")) return null;
        texts[code][list] = notes;
      }
    }
    return { ...value, texts };
  } catch {
    return null;
  }
}

/** The links and notes as they are published right now. */
export const PUBLISHED_LINKING = fromLinkingData(LINKING_DATA, catalogsFromDictionaries());
