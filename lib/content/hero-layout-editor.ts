/**
 * Pure state logic for the Hero layouts editor: builds with their hero zones
 * and counters, the battle utility groups, and the text for all three
 * languages. The page renders this state and calls these functions.
 *
 * Like the tier list editor, the result leaves the browser as files to commit:
 * `lib/data/hero-layouts.json` and the five keyed text blocks of
 * `guideEntries.heroLayouts` for each dictionary. An untouched draft produces
 * both byte for byte.
 */

import {
  BUILD_ZONES,
  COLLECTION_ITEMS,
  LAYOUT_TEXT_MAPS,
  type BuildText,
  type BuildZone,
  type LayoutData,
  type LayoutPick,
  type LayoutTexts,
} from "./hero-layouts.ts";
import { LANGUAGES, longestIncreasing, textKeyFrom, type Language } from "./hero-tier-editor.ts";

export type Chip = { uid: string; hero: string; note?: string };
export type ChipList = { id: string; chips: Chip[] };
export type BuildState = { id: string; zones: Record<BuildZone, Chip[]>; counters: ChipList[] };
export type RoleState = { id: string; groups: ChipList[] };
export type EditableBuildText = { name: string; status: string; tagline: string; pros: string[]; cons: string[]; notes: string[] };
export type EditableTexts = {
  buildTexts: Record<string, EditableBuildText>;
  counterLabels: Record<string, string>;
  pickNotes: Record<string, string>;
  roleNames: Record<string, string>;
  groupLabels: Record<string, string>;
};

export type LayoutEditorState = {
  version: 1;
  builds: BuildState[];
  utility: RoleState[];
  texts: Record<Language, EditableTexts>;
  nextId: number;
};

export type TextMap = "counterLabels" | "pickNotes" | "roleNames" | "groupLabels";
export type BuildListField = "pros" | "cons" | "notes";
export type BuildLineField = "name" | "status" | "tagline";

/*
 * Zone ids name where a chip lives:
 *   b|<build>|key · b|<build>|important · b|<build>|other · b|<build>|collection
 *   b|<build>|counter|<counter> · u|<role>|<group>
 */
export function buildZoneId(buildId: string, zone: BuildZone): string {
  return `b|${buildId}|${zone}`;
}
export function counterZoneId(buildId: string, counterId: string): string {
  return `b|${buildId}|counter|${counterId}`;
}
export function groupZoneId(roleId: string, groupId: string): string {
  return `u|${roleId}|${groupId}`;
}

function copyText(text: BuildText): EditableBuildText {
  return { name: text.name, status: text.status, tagline: text.tagline, pros: [...text.pros], cons: [...text.cons], notes: [...text.notes] };
}

export function fromLayout(data: LayoutData, texts: Record<Language, LayoutTexts>): LayoutEditorState {
  let nextId = 1;
  const chips = (picks: readonly LayoutPick[]): Chip[] =>
    picks.map((pick) => (pick.note ? { uid: `c${nextId++}`, hero: pick.hero, note: pick.note } : { uid: `c${nextId++}`, hero: pick.hero }));
  const builds = data.builds.map((build): BuildState => ({
    id: build.id,
    zones: Object.fromEntries(BUILD_ZONES.map((zone) => [zone, chips(build[zone])])) as Record<BuildZone, Chip[]>,
    counters: build.counters.map((counter) => ({ id: counter.id, chips: chips(counter.picks) })),
  }));
  const utility = data.utility.map((role): RoleState => ({
    id: role.id,
    groups: role.groups.map((group) => ({ id: group.id, chips: chips(group.picks) })),
  }));
  const copied = {} as Record<Language, EditableTexts>;
  for (const language of LANGUAGES) {
    const source = texts[language];
    copied[language] = {
      buildTexts: Object.fromEntries(Object.entries(source.buildTexts).map(([id, text]) => [id, copyText(text)])),
      counterLabels: { ...source.counterLabels },
      pickNotes: { ...source.pickNotes },
      roleNames: { ...source.roleNames },
      groupLabels: { ...source.groupLabels },
    };
  }
  return { version: 1, builds, utility, texts: copied, nextId };
}

const toPicks = (chips: readonly Chip[]): LayoutPick[] =>
  chips.map((chip) => (chip.note ? { hero: chip.hero.trim(), note: chip.note } : { hero: chip.hero.trim() }));

export function toLayout(state: LayoutEditorState): LayoutData {
  return {
    builds: state.builds.map((build) => ({
      id: build.id,
      key: toPicks(build.zones.key),
      important: toPicks(build.zones.important),
      other: toPicks(build.zones.other),
      collection: toPicks(build.zones.collection),
      counters: build.counters.map((counter) => ({ id: counter.id, picks: toPicks(counter.chips) })),
    })),
    utility: state.utility.map((role) => ({
      id: role.id,
      groups: role.groups.map((group) => ({ id: group.id, picks: toPicks(group.chips) })),
    })),
  };
}

/** Every zone in display order: builds first, then utility. */
export function zoneIds(state: LayoutEditorState): string[] {
  return [
    ...state.builds.flatMap((build) => [
      ...BUILD_ZONES.map((zone) => buildZoneId(build.id, zone)),
      ...build.counters.map((counter) => counterZoneId(build.id, counter.id)),
    ]),
    ...state.utility.flatMap((role) => role.groups.map((group) => groupZoneId(role.id, group.id))),
  ];
}

export function zoneChips(state: LayoutEditorState, zoneId: string): Chip[] | null {
  const parts = zoneId.split("|");
  if (parts[0] === "b") {
    const build = state.builds.find((each) => each.id === parts[1]);
    if (!build) return null;
    if (parts[2] === "counter") return build.counters.find((counter) => counter.id === parts[3])?.chips ?? null;
    return (BUILD_ZONES as readonly string[]).includes(parts[2]) ? build.zones[parts[2] as BuildZone] : null;
  }
  if (parts[0] === "u") {
    return state.utility.find((role) => role.id === parts[1])?.groups.find((group) => group.id === parts[2])?.chips ?? null;
  }
  return null;
}

export function findChip(state: LayoutEditorState, uid: string): { zoneId: string; index: number; chip: Chip } | null {
  for (const zoneId of zoneIds(state)) {
    const chips = zoneChips(state, zoneId) as Chip[];
    const index = chips.findIndex((chip) => chip.uid === uid);
    if (index >= 0) return { zoneId, index, chip: chips[index] };
  }
  return null;
}

/** Returns a copy with `edit` applied to one zone's chip list. */
function editZone(state: LayoutEditorState, zoneId: string, edit: (chips: Chip[]) => Chip[]): LayoutEditorState {
  const parts = zoneId.split("|");
  if (parts[0] === "b") {
    return {
      ...state,
      builds: state.builds.map((build) => {
        if (build.id !== parts[1]) return build;
        if (parts[2] === "counter") {
          return { ...build, counters: build.counters.map((counter) => (counter.id === parts[3] ? { ...counter, chips: edit(counter.chips) } : counter)) };
        }
        const zone = parts[2] as BuildZone;
        return { ...build, zones: { ...build.zones, [zone]: edit(build.zones[zone]) } };
      }),
    };
  }
  return {
    ...state,
    utility: state.utility.map((role) =>
      role.id !== parts[1]
        ? role
        : { ...role, groups: role.groups.map((group) => (group.id === parts[2] ? { ...group, chips: edit(group.chips) } : group)) },
    ),
  };
}

export function removeChip(state: LayoutEditorState, uid: string): LayoutEditorState {
  const found = findChip(state, uid);
  return found ? editZone(state, found.zoneId, (chips) => chips.filter((chip) => chip.uid !== uid)) : state;
}

export function moveChip(state: LayoutEditorState, uid: string, toZoneId: string, toIndex: number): LayoutEditorState {
  const found = findChip(state, uid);
  if (!found || !zoneChips(state, toZoneId)) return state;
  const without = removeChip(state, uid);
  return editZone(without, toZoneId, (chips) => {
    const index = Math.max(0, Math.min(toIndex, chips.length));
    return [...chips.slice(0, index), found.chip, ...chips.slice(index)];
  });
}

export function insertHero(state: LayoutEditorState, zoneId: string, hero: string, index?: number): { state: LayoutEditorState; uid: string } {
  const uid = `c${state.nextId}`;
  const target = zoneChips(state, zoneId);
  if (!target || !hero.trim()) return { state, uid: "" };
  const next = editZone(state, zoneId, (chips) => {
    const at = index === undefined ? chips.length : Math.max(0, Math.min(index, chips.length));
    return [...chips.slice(0, at), { uid, hero: hero.trim() }, ...chips.slice(at)];
  });
  return { state: { ...next, nextId: state.nextId + 1 }, uid };
}

export function setChipNote(state: LayoutEditorState, uid: string, note: string | undefined): LayoutEditorState {
  const found = findChip(state, uid);
  if (!found) return state;
  return editZone(state, found.zoneId, (chips) =>
    chips.map((chip) => {
      if (chip.uid !== uid) return chip;
      const { note: _previous, ...rest } = chip;
      void _previous;
      return note ? { ...rest, note } : rest;
    }),
  );
}

function allTextKeys(state: LayoutEditorState, map: TextMap | "buildTexts"): string[] {
  return LANGUAGES.flatMap((language) => Object.keys(state.texts[language][map]));
}

function forEachLanguage(state: LayoutEditorState, edit: (texts: EditableTexts, language: Language) => EditableTexts): LayoutEditorState {
  const texts = {} as Record<Language, EditableTexts>;
  for (const language of LANGUAGES) texts[language] = edit(state.texts[language], language);
  return { ...state, texts };
}

/** Sets one text in one language. New keys are created in every language with the same value, so no dictionary is ever missing one. */
export function setText(state: LayoutEditorState, language: Language, map: TextMap, key: string, value: string): LayoutEditorState {
  return forEachLanguage(state, (texts, each) => {
    if (each !== language && key in texts[map]) return texts;
    return { ...texts, [map]: { ...texts[map], [key]: value } };
  });
}

export function setBuildLine(state: LayoutEditorState, language: Language, buildId: string, field: BuildLineField, value: string): LayoutEditorState {
  return forEachLanguage(state, (texts, each) =>
    each !== language ? texts : { ...texts, buildTexts: { ...texts.buildTexts, [buildId]: { ...texts.buildTexts[buildId], [field]: value } } },
  );
}

/**
 * Lines of pros, cons, and notes line up by position across languages, so
 * adding or removing a line does it everywhere; editing a line only changes
 * the language being edited.
 */
export function setBuildListItem(state: LayoutEditorState, language: Language, buildId: string, field: BuildListField, index: number, value: string): LayoutEditorState {
  return forEachLanguage(state, (texts, each) => {
    if (each !== language) return texts;
    const text = texts.buildTexts[buildId];
    const lines = text[field].map((line, i) => (i === index ? value : line));
    return { ...texts, buildTexts: { ...texts.buildTexts, [buildId]: { ...text, [field]: lines } } };
  });
}

export function addBuildListItem(state: LayoutEditorState, language: Language, buildId: string, field: BuildListField, value = ""): LayoutEditorState {
  return forEachLanguage(state, (texts) => {
    const text = texts.buildTexts[buildId];
    return { ...texts, buildTexts: { ...texts.buildTexts, [buildId]: { ...text, [field]: [...text[field], value] } } };
  });
}

export function removeBuildListItem(state: LayoutEditorState, buildId: string, field: BuildListField, index: number): LayoutEditorState {
  return forEachLanguage(state, (texts) => {
    const text = texts.buildTexts[buildId];
    return { ...texts, buildTexts: { ...texts.buildTexts, [buildId]: { ...text, [field]: text[field].filter((_, i) => i !== index) } } };
  });
}

export function addBuild(state: LayoutEditorState, name: string): { state: LayoutEditorState; id: string } {
  const id = textKeyFrom(name.trim() || "build", [...state.builds.map((build) => build.id), ...allTextKeys(state, "buildTexts")]);
  const build: BuildState = { id, zones: { key: [], important: [], other: [], collection: [] }, counters: [] };
  const next = forEachLanguage({ ...state, builds: [...state.builds, build] }, (texts) => ({
    ...texts,
    buildTexts: { ...texts.buildTexts, [id]: { name: name.trim(), status: "", tagline: "", pros: [], cons: [], notes: [] } },
  }));
  return { state: next, id };
}

function dropKeys(state: LayoutEditorState, map: TextMap | "buildTexts", keys: readonly string[]): LayoutEditorState {
  if (keys.length === 0) return state;
  return forEachLanguage(state, (texts) => ({
    ...texts,
    [map]: Object.fromEntries(Object.entries(texts[map]).filter(([key]) => !keys.includes(key))),
  }));
}

export function removeBuild(state: LayoutEditorState, buildId: string): LayoutEditorState {
  const build = state.builds.find((each) => each.id === buildId);
  if (!build) return state;
  const without = { ...state, builds: state.builds.filter((each) => each.id !== buildId) };
  return dropKeys(dropKeys(without, "buildTexts", [buildId]), "counterLabels", build.counters.map((counter) => counter.id));
}

export function moveBuild(state: LayoutEditorState, buildId: string, delta: number): LayoutEditorState {
  const index = state.builds.findIndex((build) => build.id === buildId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= state.builds.length) return state;
  const builds = [...state.builds];
  const [moving] = builds.splice(index, 1);
  builds.splice(target, 0, moving);
  return { ...state, builds };
}

export function addCounter(state: LayoutEditorState, buildId: string, label: string): { state: LayoutEditorState; id: string } {
  const id = textKeyFrom(`${buildId} ${label.trim() || "counter"}`, allTextKeys(state, "counterLabels"));
  const withCounter = {
    ...state,
    builds: state.builds.map((build) => (build.id === buildId ? { ...build, counters: [...build.counters, { id, chips: [] }] } : build)),
  };
  return { state: forEachLanguage(withCounter, (texts) => ({ ...texts, counterLabels: { ...texts.counterLabels, [id]: label.trim() } })), id };
}

export function removeCounter(state: LayoutEditorState, buildId: string, counterId: string): LayoutEditorState {
  const without = {
    ...state,
    builds: state.builds.map((build) => (build.id === buildId ? { ...build, counters: build.counters.filter((counter) => counter.id !== counterId) } : build)),
  };
  return dropKeys(without, "counterLabels", [counterId]);
}

export function addGroup(state: LayoutEditorState, roleId: string, label: string): { state: LayoutEditorState; id: string } {
  const id = textKeyFrom(`${roleId} ${label.trim() || "group"}`, allTextKeys(state, "groupLabels"));
  const withGroup = {
    ...state,
    utility: state.utility.map((role) => (role.id === roleId ? { ...role, groups: [...role.groups, { id, chips: [] }] } : role)),
  };
  return { state: forEachLanguage(withGroup, (texts) => ({ ...texts, groupLabels: { ...texts.groupLabels, [id]: label.trim() } })), id };
}

export function removeGroup(state: LayoutEditorState, roleId: string, groupId: string): LayoutEditorState {
  const without = {
    ...state,
    utility: state.utility.map((role) => (role.id === roleId ? { ...role, groups: role.groups.filter((group) => group.id !== groupId) } : role)),
  };
  return dropKeys(without, "groupLabels", [groupId]);
}

/** Adds a note such as "with item" in every language and returns its key. */
export function addNote(state: LayoutEditorState, text: Record<Language, string>): { state: LayoutEditorState; key: string } {
  const key = textKeyFrom(text.en.trim() || "note", allTextKeys(state, "pickNotes"));
  const next = forEachLanguage(state, (texts, language) => ({
    ...texts,
    pickNotes: { ...texts.pickNotes, [key]: text[language].trim() || text.en.trim() },
  }));
  return { state: next, key };
}

/** Heroes placed anywhere, or only in one build when `buildId` is given. Collection items are excluded. */
export function heroesIn(state: LayoutEditorState, buildId?: string): Set<string> {
  const names = new Set<string>();
  const add = (chips: readonly Chip[]) => {
    for (const chip of chips) if (!COLLECTION_ITEMS.has(chip.hero.trim())) names.add(chip.hero.trim());
  };
  for (const build of state.builds) {
    if (buildId && build.id !== buildId) continue;
    for (const zone of BUILD_ZONES) add(build.zones[zone]);
    for (const counter of build.counters) add(counter.chips);
  }
  if (!buildId) for (const role of state.utility) for (const group of role.groups) add(group.chips);
  return names;
}

export function serializeLayout(data: LayoutData): string {
  const picks = (list: readonly LayoutPick[]) => JSON.stringify(list);
  const builds = data.builds.map((build, index) => {
    const counters = build.counters.map(
      (counter, counterIndex) => `        { "id": ${JSON.stringify(counter.id)}, "picks": ${picks(counter.picks)} }${counterIndex < build.counters.length - 1 ? "," : ""}`,
    );
    return [
      `    { "id": ${JSON.stringify(build.id)},`,
      ...BUILD_ZONES.map((zone) => `      "${zone}": ${picks(build[zone])},`),
      counters.length ? `      "counters": [` : `      "counters": []`,
      ...(counters.length ? [...counters, "      ]"] : []),
      `    }${index < data.builds.length - 1 ? "," : ""}`,
    ].join("\n");
  });
  const utility = data.utility.map((role, index) => {
    const groups = role.groups.map(
      (group, groupIndex) => `      { "id": ${JSON.stringify(group.id)}, "picks": ${picks(group.picks)} }${groupIndex < role.groups.length - 1 ? "," : ""}`,
    );
    return [`    { "id": ${JSON.stringify(role.id)}, "groups": [`, ...groups, `    ] }${index < data.utility.length - 1 ? "," : ""}`].join("\n");
  });
  return ["{", `  "builds": [`, ...builds, "  ],", `  "utility": [`, ...utility, "  ]", "}", ""].join("\n");
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const property = (key: string) => (IDENTIFIER.test(key) ? key : JSON.stringify(key));

/**
 * The five keyed maps of `guideEntries.heroLayouts` for one language, in the
 * dictionary's own formatting, so the block can replace the one in the file.
 */
export function textBlock(texts: EditableTexts, buildOrder: readonly string[], utilityOrder: { roles: readonly string[]; groups: readonly string[]; counters: readonly string[] }): string {
  const lines: string[] = [];
  const list = (field: string, values: readonly string[], indent: string) => {
    if (values.length === 0) { lines.push(`${indent}${field}: [],`); return; }
    lines.push(`${indent}${field}: [`);
    for (const value of values) lines.push(`${indent}  ${JSON.stringify(value)},`);
    lines.push(`${indent}],`);
  };
  lines.push("      buildTexts: {");
  for (const id of buildOrder) {
    const text = texts.buildTexts[id];
    if (!text) continue;
    lines.push(`        ${property(id)}: {`);
    lines.push(`          name: ${JSON.stringify(text.name)},`);
    lines.push(`          status: ${JSON.stringify(text.status)},`);
    lines.push(`          tagline: ${JSON.stringify(text.tagline)},`);
    list("pros", text.pros, "          ");
    list("cons", text.cons, "          ");
    list("notes", text.notes, "          ");
    lines.push("        },");
  }
  lines.push("      },");
  const map = (name: string, values: Record<string, string>, order: readonly string[]) => {
    lines.push(`      ${name}: {`);
    const keys = [...order.filter((key) => key in values), ...Object.keys(values).filter((key) => !order.includes(key)).sort()];
    for (const key of keys) lines.push(`        ${property(key)}: ${JSON.stringify(values[key])},`);
    lines.push("      },");
  };
  map("counterLabels", texts.counterLabels, utilityOrder.counters);
  map("pickNotes", texts.pickNotes, Object.keys(texts.pickNotes));
  map("roleNames", texts.roleNames, utilityOrder.roles);
  map("groupLabels", texts.groupLabels, utilityOrder.groups);
  return lines.join("\n");
}

export function textBlocks(state: LayoutEditorState): Record<Language, string> {
  const order = {
    roles: state.utility.map((role) => role.id),
    groups: state.utility.flatMap((role) => role.groups.map((group) => group.id)),
    counters: state.builds.flatMap((build) => build.counters.map((counter) => counter.id)),
  };
  const builds = state.builds.map((build) => build.id);
  const result = {} as Record<Language, string>;
  for (const language of LANGUAGES) result[language] = textBlock(state.texts[language], builds, order);
  return result;
}

/**
 * Changes against the published state: heroes added, removed, moved to another
 * zone, or reordered within one (a single move counts once), plus builds,
 * counters, and groups added or removed, plus every text that differs.
 */
export function countLayoutChanges(published: LayoutEditorState, draft: LayoutEditorState): number {
  const placements = (state: LayoutEditorState) => {
    const map = new Map<string, { zone: string; index: number; note: string }>();
    const seen = new Map<string, number>();
    for (const zoneId of zoneIds(state)) {
      (zoneChips(state, zoneId) as Chip[]).forEach((chip, index) => {
        const base = `${zoneId.split("|").slice(0, 2).join("|")}|${chip.hero.trim()}`;
        const count = (seen.get(base) ?? 0) + 1;
        seen.set(base, count);
        map.set(`${base}#${count}`, { zone: zoneId, index, note: chip.note ?? "" });
      });
    }
    return map;
  };
  const before = placements(published);
  const after = placements(draft);
  let changes = 0;
  const stayed = new Map<string, { before: number; after: number }[]>();
  for (const [key, place] of after) {
    const old = before.get(key);
    if (!old || old.zone !== place.zone) { changes += 1; continue; }
    if (old.note !== place.note) changes += 1;
    const bucket = stayed.get(place.zone) ?? [];
    bucket.push({ before: old.index, after: place.index });
    stayed.set(place.zone, bucket);
  }
  for (const key of before.keys()) if (!after.has(key)) changes += 1;
  for (const bucket of stayed.values()) {
    const order = [...bucket].sort((a, b) => a.after - b.after).map((item) => item.before);
    changes += order.length - longestIncreasing(order);
  }
  const ids = (state: LayoutEditorState) => new Set([
    ...state.builds.map((build) => `b:${build.id}`),
    ...state.builds.flatMap((build) => build.counters.map((counter) => `c:${counter.id}`)),
    ...state.utility.flatMap((role) => role.groups.map((group) => `g:${group.id}`)),
  ]);
  const idsBefore = ids(published);
  const idsAfter = ids(draft);
  for (const id of idsAfter) if (!idsBefore.has(id)) changes += 1;
  for (const id of idsBefore) if (!idsAfter.has(id)) changes += 1;
  const buildOrder = (state: LayoutEditorState) => state.builds.map((build) => build.id).join(",");
  if (buildOrder(published) !== buildOrder(draft) && idsBefore.size === idsAfter.size) changes += 1;
  for (const language of LANGUAGES) {
    for (const map of LAYOUT_TEXT_MAPS) {
      const a = published.texts[language][map] as Record<string, unknown>;
      const b = draft.texts[language][map] as Record<string, unknown>;
      for (const key of Object.keys(b)) if (key in a && JSON.stringify(a[key]) !== JSON.stringify(b[key])) changes += 1;
    }
  }
  return changes;
}

export type LayoutProblem =
  | { code: "buildName"; build: string }
  | { code: "emptyHero"; zone: string }
  | { code: "duplicate"; zone: string; hero: string }
  | { code: "noteText"; hero: string; note: string };

export function findLayoutProblems(state: LayoutEditorState): LayoutProblem[] {
  const problems: LayoutProblem[] = [];
  for (const build of state.builds) {
    if (LANGUAGES.some((language) => !state.texts[language].buildTexts[build.id]?.name.trim())) problems.push({ code: "buildName", build: build.id });
  }
  for (const zoneId of zoneIds(state)) {
    const seen = new Set<string>();
    for (const chip of zoneChips(state, zoneId) as Chip[]) {
      const hero = chip.hero.trim();
      if (!hero) { problems.push({ code: "emptyHero", zone: zoneId }); continue; }
      if (seen.has(hero)) problems.push({ code: "duplicate", zone: zoneId, hero });
      seen.add(hero);
      if (chip.note && LANGUAGES.some((language) => !(chip.note as string in state.texts[language].pickNotes))) {
        problems.push({ code: "noteText", hero, note: chip.note });
      }
    }
  }
  return problems;
}

export function parseLayoutDraft(raw: string | null): LayoutEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as LayoutEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.builds) || !Array.isArray(value.utility)) return null;
    for (const build of value.builds) {
      if (typeof build.id !== "string" || !build.zones || !Array.isArray(build.counters)) return null;
      for (const zone of BUILD_ZONES) if (!Array.isArray(build.zones[zone])) return null;
    }
    for (const role of value.utility) if (typeof role.id !== "string" || !Array.isArray(role.groups)) return null;
    for (const language of LANGUAGES) {
      const texts = value.texts?.[language];
      if (!texts) return null;
      for (const map of LAYOUT_TEXT_MAPS) if (typeof texts[map] !== "object" || texts[map] === null) return null;
    }
    return value;
  } catch {
    return null;
  }
}
