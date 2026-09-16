/**
 * Pure state logic for the Hero leveling editor. Focus lists and fragment rules
 * are per Hero layouts build; level targets are shared. Export replaces
 * `lib/data/hero-leveling.json` plus one `heroNotes` block per dictionary.
 */

import { HEROES } from "./heroes.ts";
import {
  FOCUS_BANDS,
  FRAGMENT_KINDS,
  LEVELING_BUILDS,
  LEVELING_DATA,
  LEVEL_TARGET_IDS,
  type FocusBand,
  type FocusBandId,
  type FragmentKind,
  type FragmentRule,
  type HeroLevelingData,
  type LevelTarget,
  type LevelTargetId,
  type LevelingBuild,
  type LevelingBuildId,
  type LevelingHeroNotes,
} from "./hero-leveling.ts";
import { LOCALES, getDictionary, mapLocales, type Locale } from "../i18n/index.ts";
import { dictionaryLiteral } from "../i18n/translations.ts";

export type EditorFocusHero = { uid: string; hero: string; band: FocusBandId };
export type EditorFragment =
  | { uid: string; kind: "unlocks" }
  | { uid: string; kind: "allUr"; hero: string }
  | { uid: string; kind: "allSsrWhenUrPlus"; hero: string }
  | { uid: string; kind: "splitEvenWhenUr"; heroes: [string, string] };

export type EditorBuild = {
  id: LevelingBuildId;
  focus: EditorFocusHero[];
  fragments: EditorFragment[];
};

export type EditorLevelTarget = {
  uid: string;
  id: LevelTargetId;
  target: string;
  noAscend: boolean;
};

/** Notes per language, keyed by focus row uid. */
export type LevelingNotes = Record<Locale, Record<string, string>>;

export type LevelingEditorState = {
  version: 1;
  defaultBuild: LevelingBuildId;
  builds: EditorBuild[];
  levelTargets: EditorLevelTarget[];
  notes: LevelingNotes;
  nextId: number;
};

const HERO_NAMES = new Set(HEROES.map((hero) => hero.name));
const BAND_SET = new Set<string>(FOCUS_BANDS);
const KIND_SET = new Set<string>(FRAGMENT_KINDS);
const BUILD_SET = new Set<string>(LEVELING_BUILDS);
const TARGET_SET = new Set<string>(LEVEL_TARGET_IDS);

function emptyNotes(): LevelingNotes {
  return Object.fromEntries(LOCALES.map((locale) => [locale.code, {}])) as LevelingNotes;
}

export function catalogsFromDictionaries(): Record<Locale, LevelingHeroNotes> {
  return mapLocales((locale) => getDictionary(locale).guideEntries.heroLeveling.heroNotes as LevelingHeroNotes);
}

export function fromLevelingData(
  data: HeroLevelingData,
  catalogs: Partial<Record<Locale, LevelingHeroNotes>> = {},
): LevelingEditorState {
  let nextId = 1;
  const notes = emptyNotes();
  const builds = data.builds.map((build): EditorBuild => {
    const focus: EditorFocusHero[] = [];
    for (const band of build.bands) {
      for (const hero of band.heroes) {
        const uid = `f${nextId++}`;
        for (const { code } of LOCALES) {
          const note = catalogs[code]?.[hero];
          if (note) notes[code][uid] = note;
        }
        focus.push({ uid, hero, band: band.id });
      }
    }
    const fragments = build.fragments.map((rule): EditorFragment => {
      const uid = `r${nextId++}`;
      if (rule.kind === "unlocks") return { uid, kind: "unlocks" };
      if (rule.kind === "splitEvenWhenUr") {
        return { uid, kind: "splitEvenWhenUr", heroes: [...rule.heroes] as [string, string] };
      }
      return { uid, kind: rule.kind, hero: rule.hero };
    });
    return { id: build.id, focus, fragments };
  });
  const levelTargets = data.levelTargets.map((target) => ({
    uid: `t${nextId++}`,
    id: target.id,
    target: target.target,
    noAscend: Boolean(target.noAscend),
  }));
  return { version: 1, defaultBuild: data.defaultBuild, builds, levelTargets, notes, nextId };
}

export function buildOf(state: LevelingEditorState, id: LevelingBuildId): EditorBuild | undefined {
  return state.builds.find((build) => build.id === id);
}

export function unusedFocusHeroes(state: LevelingEditorState, buildId: LevelingBuildId): typeof HEROES {
  const build = buildOf(state, buildId);
  if (!build) return [];
  const used = new Set(build.focus.map((entry) => entry.hero));
  return HEROES.filter((hero) => !used.has(hero.name));
}

function patchBuild(
  state: LevelingEditorState,
  buildId: LevelingBuildId,
  update: (build: EditorBuild) => EditorBuild,
): LevelingEditorState {
  return {
    ...state,
    builds: state.builds.map((build) => (build.id === buildId ? update(build) : build)),
  };
}

function forgetNotes(notes: LevelingNotes, uid: string): LevelingNotes {
  const next = emptyNotes();
  for (const { code } of LOCALES) {
    const copy = { ...notes[code] };
    delete copy[uid];
    next[code] = copy;
  }
  return next;
}

export function addFocusHero(
  state: LevelingEditorState,
  buildId: LevelingBuildId,
  hero: string,
  band: FocusBandId = "sPlus",
): LevelingEditorState {
  const name = hero.trim();
  if (!HERO_NAMES.has(name)) return state;
  const build = buildOf(state, buildId);
  if (!build || build.focus.some((entry) => entry.hero === name)) return state;
  return {
    ...patchBuild(state, buildId, (current) => ({
      ...current,
      focus: [...current.focus, { uid: `f${state.nextId}`, hero: name, band }],
    })),
    nextId: state.nextId + 1,
  };
}

export function removeFocusHero(
  state: LevelingEditorState,
  buildId: LevelingBuildId,
  uid: string,
): LevelingEditorState {
  return {
    ...patchBuild(state, buildId, (current) => ({
      ...current,
      focus: current.focus.filter((entry) => entry.uid !== uid),
    })),
    notes: forgetNotes(state.notes, uid),
  };
}

export function setFocusBand(
  state: LevelingEditorState,
  buildId: LevelingBuildId,
  uid: string,
  band: FocusBandId,
): LevelingEditorState {
  return patchBuild(state, buildId, (current) => ({
    ...current,
    focus: current.focus.map((entry) => (entry.uid === uid ? { ...entry, band } : entry)),
  }));
}

export function moveFocusHero(
  state: LevelingEditorState,
  buildId: LevelingBuildId,
  uid: string,
  delta: -1 | 1,
): LevelingEditorState {
  return patchBuild(state, buildId, (current) => {
    const index = current.focus.findIndex((entry) => entry.uid === uid);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= current.focus.length) return current;
    const focus = [...current.focus];
    [focus[index], focus[next]] = [focus[next], focus[index]];
    return { ...current, focus };
  });
}

export function noteOf(state: LevelingEditorState, locale: Locale, uid: string): string {
  return state.notes[locale]?.[uid] ?? "";
}

export function setNote(
  state: LevelingEditorState,
  locale: Locale,
  uid: string,
  note: string,
): LevelingEditorState {
  return {
    ...state,
    notes: {
      ...state.notes,
      [locale]: { ...state.notes[locale], [uid]: note },
    },
  };
}

export function addFragment(
  state: LevelingEditorState,
  buildId: LevelingBuildId,
  kind: FragmentKind = "unlocks",
): LevelingEditorState {
  const uid = `r${state.nextId}`;
  let rule: EditorFragment;
  if (kind === "unlocks") rule = { uid, kind: "unlocks" };
  else if (kind === "splitEvenWhenUr") rule = { uid, kind: "splitEvenWhenUr", heroes: ["", ""] };
  else rule = { uid, kind, hero: "" };
  return {
    ...patchBuild(state, buildId, (current) => ({
      ...current,
      fragments: [...current.fragments, rule],
    })),
    nextId: state.nextId + 1,
  };
}

export function removeFragment(
  state: LevelingEditorState,
  buildId: LevelingBuildId,
  uid: string,
): LevelingEditorState {
  return patchBuild(state, buildId, (current) => ({
    ...current,
    fragments: current.fragments.filter((rule) => rule.uid !== uid),
  }));
}

export function updateFragment(
  state: LevelingEditorState,
  buildId: LevelingBuildId,
  uid: string,
  patch: Partial<EditorFragment>,
): LevelingEditorState {
  return patchBuild(state, buildId, (current) => ({
    ...current,
    fragments: current.fragments.map((rule) => {
      if (rule.uid !== uid) return rule;
      const kind = (patch.kind ?? rule.kind) as FragmentKind;
      if (kind === "unlocks") return { uid, kind: "unlocks" };
      if (kind === "splitEvenWhenUr") {
        const heroes =
          "heroes" in patch && patch.heroes
            ? patch.heroes
            : "heroes" in rule
              ? rule.heroes
              : (["", ""] as [string, string]);
        return { uid, kind: "splitEvenWhenUr", heroes };
      }
      const hero = "hero" in patch && typeof patch.hero === "string" ? patch.hero : "hero" in rule ? rule.hero : "";
      return { uid, kind, hero };
    }),
  }));
}

export function moveFragment(
  state: LevelingEditorState,
  buildId: LevelingBuildId,
  uid: string,
  delta: -1 | 1,
): LevelingEditorState {
  return patchBuild(state, buildId, (current) => {
    const index = current.fragments.findIndex((rule) => rule.uid === uid);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= current.fragments.length) return current;
    const fragments = [...current.fragments];
    [fragments[index], fragments[next]] = [fragments[next], fragments[index]];
    return { ...current, fragments };
  });
}

export function setDefaultBuild(state: LevelingEditorState, id: LevelingBuildId): LevelingEditorState {
  if (!BUILD_SET.has(id)) return state;
  return { ...state, defaultBuild: id };
}

export function setLevelTarget(
  state: LevelingEditorState,
  uid: string,
  patch: Partial<Pick<EditorLevelTarget, "target" | "noAscend">>,
): LevelingEditorState {
  return {
    ...state,
    levelTargets: state.levelTargets.map((target) => (target.uid === uid ? { ...target, ...patch } : target)),
  };
}

function bandsFromFocus(focus: EditorFocusHero[]): FocusBand[] {
  const bands: FocusBand[] = [];
  for (const bandId of FOCUS_BANDS) {
    const heroes = focus.filter((entry) => entry.band === bandId).map((entry) => entry.hero);
    if (heroes.length > 0) bands.push({ id: bandId, heroes });
  }
  return bands;
}

function exportFragment(rule: EditorFragment): FragmentRule | null {
  if (rule.kind === "unlocks") return { kind: "unlocks" };
  if (rule.kind === "splitEvenWhenUr") {
    const [left, right] = rule.heroes.map((name) => name.trim());
    if (!left || !right) return null;
    return { kind: "splitEvenWhenUr", heroes: [left, right] };
  }
  const hero = rule.hero.trim();
  if (!hero) return null;
  return { kind: rule.kind, hero };
}

export function exportLeveling(state: LevelingEditorState): HeroLevelingData {
  return {
    defaultBuild: state.defaultBuild,
    builds: state.builds.map(
      (build): LevelingBuild => ({
        id: build.id,
        bands: bandsFromFocus(build.focus),
        fragments: build.fragments.map(exportFragment).filter((rule): rule is FragmentRule => rule !== null),
      }),
    ),
    levelTargets: state.levelTargets.map(
      (target): LevelTarget => ({
        id: target.id,
        target: target.target.trim(),
        ...(target.noAscend ? { noAscend: true } : {}),
      }),
    ),
  };
}

export function serializeLevelingData(data: HeroLevelingData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** Notes keyed by hero name for heroes that still appear in some build's focus. */
export function exportedHeroNotes(state: LevelingEditorState): Record<Locale, LevelingHeroNotes> {
  const focusUids = new Map<string, string>();
  for (const build of state.builds) {
    for (const entry of build.focus) focusUids.set(entry.uid, entry.hero);
  }
  return mapLocales((locale) => {
    const catalog: LevelingHeroNotes = {};
    for (const [uid, hero] of focusUids) {
      const note = state.notes[locale]?.[uid]?.trim();
      if (note) catalog[hero] = note;
    }
    return catalog;
  });
}

export function heroNoteBlocks(state: LevelingEditorState): Record<Locale, string> {
  const catalogs = exportedHeroNotes(state);
  return mapLocales((locale) => `      heroNotes: ${dictionaryLiteral(catalogs[locale], "      ")},`);
}

export function countLevelingChanges(published: LevelingEditorState, draft: LevelingEditorState): number {
  const before = serializeLevelingData(exportLeveling(published));
  const after = serializeLevelingData(exportLeveling(draft));
  const beforeNotes = JSON.stringify(exportedHeroNotes(published));
  const afterNotes = JSON.stringify(exportedHeroNotes(draft));
  if (before === after && beforeNotes === afterNotes) return 0;
  return 1;
}

export type LevelingProblem = { code: string; values?: Record<string, string | number> };

export function findLevelingProblems(state: LevelingEditorState): LevelingProblem[] {
  const problems: LevelingProblem[] = [];
  if (!BUILD_SET.has(state.defaultBuild)) problems.push({ code: "badDefaultBuild" });
  const defaultBuild = buildOf(state, state.defaultBuild);
  if (defaultBuild && defaultBuild.focus.length === 0) {
    problems.push({ code: "emptyDefaultFocus", values: { build: state.defaultBuild } });
  }
  for (const build of state.builds) {
    const seen = new Set<string>();
    for (const entry of build.focus) {
      if (!HERO_NAMES.has(entry.hero)) {
        problems.push({ code: "unknownHero", values: { build: build.id, hero: entry.hero } });
      }
      if (!BAND_SET.has(entry.band)) {
        problems.push({ code: "badBand", values: { build: build.id, hero: entry.hero } });
      }
      if (seen.has(entry.hero)) {
        problems.push({ code: "duplicateHero", values: { build: build.id, hero: entry.hero } });
      }
      seen.add(entry.hero);
    }
    for (const rule of build.fragments) {
      if (!KIND_SET.has(rule.kind)) {
        problems.push({ code: "badFragment", values: { build: build.id } });
        continue;
      }
      if (rule.kind === "unlocks") continue;
      if (rule.kind === "splitEvenWhenUr") {
        for (const hero of rule.heroes) {
          if (!hero.trim()) problems.push({ code: "emptyFragmentHero", values: { build: build.id } });
          else if (!HERO_NAMES.has(hero.trim())) {
            problems.push({ code: "unknownHero", values: { build: build.id, hero } });
          }
        }
        continue;
      }
      if (!rule.hero.trim()) problems.push({ code: "emptyFragmentHero", values: { build: build.id } });
      else if (!HERO_NAMES.has(rule.hero.trim())) {
        problems.push({ code: "unknownHero", values: { build: build.id, hero: rule.hero } });
      }
    }
  }
  for (const target of state.levelTargets) {
    if (!TARGET_SET.has(target.id)) problems.push({ code: "badLevelTarget", values: { id: target.id } });
    if (!target.target.trim()) problems.push({ code: "emptyLevelTarget", values: { id: target.id } });
  }
  return problems;
}

export function parseLevelingDraft(raw: string | null): LevelingEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as LevelingEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.builds)) return null;
    if (!BUILD_SET.has(value.defaultBuild) || !Array.isArray(value.levelTargets)) return null;
    const notes = emptyNotes();
    for (const { code } of LOCALES) {
      const block = value.notes?.[code];
      if (block && typeof block === "object") {
        for (const [uid, note] of Object.entries(block)) {
          if (typeof note === "string") notes[code][uid] = note;
        }
      }
    }
    const builds: EditorBuild[] = [];
    for (const entry of value.builds) {
      if (!BUILD_SET.has(entry?.id) || !Array.isArray(entry.focus) || !Array.isArray(entry.fragments)) return null;
      const focus: EditorFocusHero[] = [];
      for (const row of entry.focus) {
        if (typeof row?.uid !== "string" || typeof row.hero !== "string" || !BAND_SET.has(row.band)) return null;
        focus.push({ uid: row.uid, hero: row.hero, band: row.band });
      }
      const fragments: EditorFragment[] = [];
      for (const rule of entry.fragments) {
        if (typeof rule?.uid !== "string" || !KIND_SET.has(rule.kind)) return null;
        if (rule.kind === "unlocks") fragments.push({ uid: rule.uid, kind: "unlocks" });
        else if (rule.kind === "splitEvenWhenUr") {
          if (!Array.isArray(rule.heroes) || rule.heroes.length !== 2) return null;
          if (rule.heroes.some((hero) => typeof hero !== "string")) return null;
          fragments.push({
            uid: rule.uid,
            kind: "splitEvenWhenUr",
            heroes: [rule.heroes[0], rule.heroes[1]],
          });
        } else if (typeof rule.hero !== "string") return null;
        else fragments.push({ uid: rule.uid, kind: rule.kind, hero: rule.hero });
      }
      builds.push({ id: entry.id, focus, fragments });
    }
    for (const id of LEVELING_BUILDS) {
      if (!builds.some((build) => build.id === id)) return null;
    }
    const levelTargets: EditorLevelTarget[] = [];
    for (const target of value.levelTargets) {
      if (typeof target?.uid !== "string" || !TARGET_SET.has(target.id) || typeof target.target !== "string") {
        return null;
      }
      levelTargets.push({
        uid: target.uid,
        id: target.id,
        target: target.target,
        noAscend: Boolean(target.noAscend),
      });
    }
    return {
      version: 1,
      defaultBuild: value.defaultBuild,
      builds,
      levelTargets,
      notes,
      nextId: value.nextId,
    };
  } catch {
    return null;
  }
}

export const PUBLISHED_LEVELING = fromLevelingData(LEVELING_DATA, catalogsFromDictionaries());
