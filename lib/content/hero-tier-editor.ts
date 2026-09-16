/**
 * Pure state logic for the Hero tier list editor. The page only renders this
 * state and calls these functions, so moving, adding, and exporting can be
 * tested without a browser.
 *
 * The editor works on a copy of `lib/data/hero-tiers.json` with an id on every
 * entry. A static site cannot save for everyone, so the result leaves the
 * browser as that JSON file (plus dictionary lines for any new text) for
 * someone to commit, the same way the news, event, and guide editors work.
 */

import {
  TIER_IDS,
  parseGrade,
  type TierId,
  type TierListData,
} from "./hero-tiers.ts";
import { HERO_RARITIES } from "./heroes.ts";
import { LOCALE_CODES, dictionaryFile, getDictionary, type Locale } from "../i18n/index.ts";
import { parseTranslations, textIn, translationsFrom, type Translations } from "../i18n/translations.ts";

export const LIST_IDS = ["overall", "battle", "utility", "productivity"] as const;
export type ListId = (typeof LIST_IDS)[number];

export const TEXT_GROUPS = ["variants", "roles", "effects", "resources", "notes", "reasons"] as const;
export type TextGroup = (typeof TEXT_GROUPS)[number];

export type { Translations };

/**
 * Text typed in the editor: new keys the dictionaries do not have yet, and new
 * wording for keys they do have. Each holds every registered language.
 */
export type CustomTexts = Record<TextGroup, Record<string, Translations>>;

/** Every field any list uses; each list reads only its own. */
export type LooseEntry = {
  hero: string;
  /** The rarity this placement is rated at; empty means the roster's. */
  rarity?: string;
  variant?: string;
  note?: string;
  battle?: string;
  utility?: string;
  productivity?: string;
  linker?: boolean;
  reason?: string;
  roles?: string[];
  effect?: string;
  situational?: boolean;
  bonus?: number[];
};

export type EditorItem = { uid: string; entry: LooseEntry };

export type Container = {
  id: string;
  tier: TierId;
  /** Productivity only: the resource group this container is. */
  resource?: string;
  /** Overall only: whether the tier is ranked. */
  ordered?: boolean;
  items: EditorItem[];
};

export type EditorState = {
  version: 1;
  lists: Record<ListId, Container[]>;
  texts: CustomTexts;
  nextId: number;
};

export function containerId(list: ListId, tier: TierId, resource?: string): string {
  return resource ? `${list}|${tier}|${resource}` : `${list}|${tier}`;
}

function emptyTexts(): CustomTexts {
  return { variants: {}, roles: {}, effects: {}, resources: {}, notes: {}, reasons: {} };
}

function copyEntry(entry: object): LooseEntry {
  const source = entry as LooseEntry;
  const copy: LooseEntry = { ...source };
  if (source.roles) copy.roles = [...source.roles];
  if (source.bonus) copy.bonus = [...source.bonus];
  return copy;
}

export function fromTierData(data: TierListData): EditorState {
  let nextId = 1;
  const item = (entry: object): EditorItem => ({ uid: `h${nextId++}`, entry: copyEntry(entry) });
  const simple = (list: "overall" | "battle" | "utility") =>
    TIER_IDS.map((tier): Container => {
      const row = data[list].find((candidate) => candidate.tier === tier);
      return {
        id: containerId(list, tier),
        tier,
        ...(list === "overall" ? { ordered: Boolean(row?.ordered) } : {}),
        items: (row?.entries ?? []).map(item),
      };
    });
  const productivity = data.productivity.flatMap((row) =>
    row.groups.map((group): Container => ({
      id: containerId("productivity", row.tier, group.resource),
      tier: row.tier,
      resource: group.resource,
      items: group.entries.map(item),
    })),
  );
  return {
    version: 1,
    lists: { overall: simple("overall"), battle: simple("battle"), utility: simple("utility"), productivity },
    texts: emptyTexts(),
    nextId,
  };
}

const KEY_ORDER: (keyof LooseEntry)[] = [
  "hero", "rarity", "variant", "battle", "utility", "productivity", "roles", "effect", "bonus", "situational", "linker", "note", "reason",
];

/** Drops empty optional fields and fixes the key order, so exports diff cleanly. */
export function cleanEntry(list: ListId, entry: LooseEntry): LooseEntry {
  const allowed: Record<ListId, (keyof LooseEntry)[]> = {
    overall: ["hero", "rarity", "variant", "battle", "utility", "productivity", "linker", "note", "reason"],
    battle: ["hero", "rarity", "variant", "roles", "linker", "note"],
    utility: ["hero", "rarity", "variant", "effect", "situational", "note"],
    productivity: ["hero", "rarity", "variant", "bonus", "note"],
  };
  const clean: Record<string, unknown> = {};
  for (const key of KEY_ORDER) {
    if (!allowed[list].includes(key)) continue;
    const value = entry[key];
    if (key === "hero") { clean.hero = (value as string | undefined)?.trim() ?? ""; continue; }
    if (key === "roles") { clean.roles = [...((value as string[] | undefined) ?? [])]; continue; }
    if (key === "bonus") { clean.bonus = [...((value as number[] | undefined) ?? [])]; continue; }
    if (value === undefined || value === "" || value === false) continue;
    clean[key] = value;
  }
  return clean as LooseEntry;
}

export function toTierData(state: EditorState): TierListData {
  const simple = (list: "overall" | "battle" | "utility") =>
    TIER_IDS.map((tier) => {
      const container = state.lists[list].find((candidate) => candidate.tier === tier);
      const entries = (container?.items ?? []).map((item) => cleanEntry(list, item.entry));
      return list === "overall"
        ? { tier, ordered: Boolean(container?.ordered), entries }
        : { tier, entries };
    });
  const productivity = TIER_IDS.map((tier) => ({
    tier,
    groups: state.lists.productivity
      .filter((container) => container.tier === tier && container.items.length > 0 && container.resource)
      .map((container) => ({
        resource: container.resource as string,
        entries: container.items.map((item) => cleanEntry("productivity", item.entry)),
      })),
  })).filter((row) => row.groups.length > 0);
  return {
    overall: simple("overall"),
    battle: simple("battle"),
    utility: simple("utility"),
    productivity,
  } as unknown as TierListData;
}

export function findItem(state: EditorState, list: ListId, uid: string): { container: Container; index: number } | null {
  for (const container of state.lists[list]) {
    const index = container.items.findIndex((item) => item.uid === uid);
    if (index >= 0) return { container, index };
  }
  return null;
}

function withList(state: EditorState, list: ListId, containers: Container[]): EditorState {
  return { ...state, lists: { ...state.lists, [list]: containers } };
}

/** Moves an item to `toIndex` in the target container (clamped). */
export function moveItem(state: EditorState, list: ListId, uid: string, toContainerId: string, toIndex: number): EditorState {
  const found = findItem(state, list, uid);
  const target = state.lists[list].find((container) => container.id === toContainerId);
  if (!found || !target) return state;
  const moving = found.container.items[found.index];
  const containers = state.lists[list].map((container) => ({
    ...container,
    items: container.items.filter((item) => item.uid !== uid),
  }));
  const destination = containers.find((container) => container.id === toContainerId) as Container;
  const index = Math.max(0, Math.min(toIndex, destination.items.length));
  destination.items = [...destination.items.slice(0, index), moving, ...destination.items.slice(index)];
  return withList(state, list, containers);
}

export function updateItem(state: EditorState, list: ListId, uid: string, patch: Partial<LooseEntry>): EditorState {
  return withList(
    state,
    list,
    state.lists[list].map((container) => ({
      ...container,
      items: container.items.map((item) => (item.uid === uid ? { ...item, entry: { ...item.entry, ...patch } } : item)),
    })),
  );
}

export function removeItem(state: EditorState, list: ListId, uid: string): EditorState {
  return withList(
    state,
    list,
    state.lists[list].map((container) => ({ ...container, items: container.items.filter((item) => item.uid !== uid) })),
  );
}

export function defaultEntry(list: ListId): LooseEntry {
  if (list === "battle") return { hero: "", roles: [] };
  if (list === "utility") return { hero: "", effect: "" };
  if (list === "productivity") return { hero: "", bonus: [40] };
  return { hero: "", battle: "C" };
}

export function addItem(state: EditorState, list: ListId, toContainerId: string, entry = defaultEntry(list)): { state: EditorState; uid: string } {
  const uid = `h${state.nextId}`;
  const containers = state.lists[list].map((container) =>
    container.id === toContainerId ? { ...container, items: [...container.items, { uid, entry }] } : container,
  );
  return { state: { ...withList(state, list, containers), nextId: state.nextId + 1 }, uid };
}

export function setOrdered(state: EditorState, tier: TierId, ordered: boolean): EditorState {
  return withList(
    state,
    "overall",
    state.lists.overall.map((container) => (container.tier === tier ? { ...container, ordered } : container)),
  );
}

/** Adds an empty resource group to a productivity tier, unless it exists. */
export function addGroup(state: EditorState, tier: TierId, resource: string): EditorState {
  const id = containerId("productivity", tier, resource);
  if (state.lists.productivity.some((container) => container.id === id)) return state;
  const containers = [...state.lists.productivity, { id, tier, resource, items: [] }];
  containers.sort((a, b) => TIER_IDS.indexOf(a.tier) - TIER_IDS.indexOf(b.tier));
  return withList(state, "productivity", containers);
}

/** Moves an item into another resource group, creating it if needed. */
export function moveToGroup(state: EditorState, uid: string, tier: TierId, resource: string): EditorState {
  const withGroup = addGroup(state, tier, resource);
  const id = containerId("productivity", tier, resource);
  const target = withGroup.lists.productivity.find((container) => container.id === id) as Container;
  return moveItem(withGroup, "productivity", uid, id, target.items.length);
}

export function textKeyFrom(english: string, taken: Iterable<string>): string {
  const words = english
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  const base = words
    .map((word, index) => (index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join("")
    .replace(/^[0-9]+/, "") || "custom";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}${counter}`)) counter += 1;
  return `${base}${counter}`;
}

export function addText(state: EditorState, group: TextGroup, key: string, text: Translations): EditorState {
  return { ...state, texts: { ...state.texts, [group]: { ...state.texts[group], [key]: text } } };
}

/** The wording a key has in every dictionary right now. */
export function publishedText(group: TextGroup, key: string): Translations {
  return translationsFrom((locale) => (getDictionary(locale).guideEntries.heroTierList[group] as Record<string, string>)[key]);
}

/** The text for a key in one language: the editor's wording first, then the dictionary, then English. */
export function textFor(texts: CustomTexts, group: TextGroup, key: string, locale: Locale): string {
  const custom = texts[group][key];
  if (custom) return textIn(custom, locale);
  return textIn(publishedText(group, key), locale) || key;
}

/**
 * Lines to add to or replace in each dictionary for text typed in the editor.
 * A language left empty gets the English text. Empty when there is none.
 */
export function dictionarySnippet(texts: CustomTexts): Record<Locale, string> {
  const result = {} as Record<Locale, string>;
  for (const locale of LOCALE_CODES) {
    const blocks = TEXT_GROUPS.flatMap((group) => {
      const entries = Object.entries(texts[group]);
      if (entries.length === 0) return [];
      const lines = entries.map(([key, value]) => `        ${key}: ${JSON.stringify(textIn(value, locale))},`);
      return [`      // guideEntries.heroTierList.${group}`, ...lines];
    });
    result[locale] = blocks.length ? [`// ${dictionaryFile(locale)}`, ...blocks].join("\n") : "";
  }
  return result;
}

/**
 * The JSON file, one entry per line: readable in a pull request, and a moved
 * hero shows up as two changed lines rather than a reformatted file.
 */
export function serializeTierData(data: TierListData): string {
  const entryLines = (entries: readonly object[], indent: string) =>
    entries.map((entry, index) => `${indent}${JSON.stringify(entry)}${index < entries.length - 1 ? "," : ""}`);
  const rows = (list: "overall" | "battle" | "utility") =>
    data[list].map((row, index, all) => {
      const head = list === "overall"
        ? `    { "tier": ${JSON.stringify(row.tier)}, "ordered": ${Boolean((row as { ordered?: boolean }).ordered)}, "entries": [`
        : `    { "tier": ${JSON.stringify(row.tier)}, "entries": [`;
      const body = entryLines(row.entries, "      ");
      return [head, ...body, `    ] }${index < all.length - 1 ? "," : ""}`].join("\n");
    });
  const productivity = data.productivity.map((row, index, all) => {
    const groups = row.groups.map((group, groupIndex) =>
      [
        `      { "resource": ${JSON.stringify(group.resource)}, "entries": [`,
        ...entryLines(group.entries, "        "),
        `      ] }${groupIndex < row.groups.length - 1 ? "," : ""}`,
      ].join("\n"),
    );
    return [`    { "tier": ${JSON.stringify(row.tier)}, "groups": [`, ...groups, `    ] }${index < all.length - 1 ? "," : ""}`].join("\n");
  });
  return [
    "{",
    `  "overall": [`, ...rows("overall"), "  ],",
    `  "battle": [`, ...rows("battle"), "  ],",
    `  "utility": [`, ...rows("utility"), "  ],",
    `  "productivity": [`, ...productivity, "  ]",
    "}",
    "",
  ].join("\n");
}

/** Length of the longest strictly increasing subsequence. */
export function longestIncreasing(values: number[]): number {
  const tails: number[] = [];
  for (const value of values) {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (tails[middle] < value) low = middle + 1;
      else high = middle;
    }
    tails[low] = value;
  }
  return tails.length;
}

type Placed = { container: string; index: number; content: string; hero: string };

function placements(data: TierListData, list: ListId): Map<string, Placed> {
  const map = new Map<string, Placed>();
  const seen = new Map<string, number>();
  const add = (entry: LooseEntry, container: string, index: number) => {
    // The rarity tells Joan of Arc at UR and at UR+ apart; `hero` pairs up a placement whose rarity changed.
    const hero = `${entry.hero}|${entry.variant ?? ""}`;
    const base = `${hero}|${entry.rarity ?? ""}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    map.set(`${base}#${count}`, { container, index, content: JSON.stringify(cleanEntry(list, entry)), hero });
  };
  if (list === "productivity") {
    for (const row of data.productivity) for (const group of row.groups) {
      group.entries.forEach((entry, index) => add(entry as LooseEntry, `${row.tier}|${group.resource}`, index));
    }
  } else {
    for (const row of data[list]) row.entries.forEach((entry, index) => add(entry as LooseEntry, row.tier, index));
  }
  return map;
}

/**
 * How many heroes differ from the published list, per list: added, removed,
 * edited, moved to another tier, or reordered within their tier. Moving one
 * hero counts once, not once for every hero that shifts along with it.
 */
export function countChanges(published: TierListData, draft: TierListData): Record<ListId, number> {
  const result = {} as Record<ListId, number>;
  for (const list of LIST_IDS) {
    const before = placements(published, list);
    const after = placements(draft, list);
    let changes = 0;
    const stayed = new Map<string, { key: string; before: number; after: number }[]>();
    const added = new Map<string, number>();
    const removed = new Map<string, number>();
    const bump = (counts: Map<string, number>, hero: string) => counts.set(hero, (counts.get(hero) ?? 0) + 1);
    for (const [key, placed] of after) {
      const old = before.get(key);
      if (!old) { bump(added, placed.hero); continue; }
      if (old.container !== placed.container) { changes += 1; continue; }
      if (old.content !== placed.content) changes += 1;
      const bucket = stayed.get(placed.container) ?? [];
      bucket.push({ key, before: old.index, after: placed.index });
      stayed.set(placed.container, bucket);
    }
    for (const [key, placed] of before) if (!after.has(key)) bump(removed, placed.hero);
    // A placement that only changed its rarity shows up as one removed and one added: count it once.
    for (const hero of new Set([...added.keys(), ...removed.keys()])) {
      changes += Math.max(added.get(hero) ?? 0, removed.get(hero) ?? 0);
    }
    for (const bucket of stayed.values()) {
      const order = [...bucket].sort((a, b) => a.after - b.after).map((item) => item.before);
      changes += order.length - longestIncreasing(order);
    }
    result[list] = changes;
  }
  return result;
}

export type Problem =
  | { code: "emptyName"; list: ListId; tier: TierId }
  | { code: "duplicate"; list: ListId; hero: string }
  | { code: "badGrade"; list: ListId; hero: string; grade: string }
  | { code: "badBonus"; list: ListId; hero: string }
  | { code: "missingText"; list: ListId; hero: string; group: TextGroup; key: string };

/**
 * Problems that would break the page or confuse readers. `known` holds the
 * text keys the dictionaries already have, per group.
 */
export function findProblems(state: EditorState, known: Record<TextGroup, ReadonlySet<string>>): Problem[] {
  const problems: Problem[] = [];
  const hasText = (group: TextGroup, key: string | undefined) => !key || known[group].has(key) || key in state.texts[group];
  for (const list of LIST_IDS) {
    const seen = new Set<string>();
    for (const container of state.lists[list]) {
      for (const { entry } of container.items) {
        const hero = entry.hero.trim();
        if (!hero) { problems.push({ code: "emptyName", list, tier: container.tier }); continue; }
        // The same hero may sit in one list twice when the rarity or variant differs (Joan of Arc at UR and UR+).
        const identity = `${hero}|${entry.rarity ?? ""}|${entry.variant ?? ""}|${list === "productivity" ? container.resource : list === "utility" ? `${entry.effect}|${entry.note ?? ""}` : ""}`;
        if (seen.has(identity)) problems.push({ code: "duplicate", list, hero });
        seen.add(identity);
        if (list === "overall") {
          for (const grade of [entry.battle, entry.utility, entry.productivity]) {
            if (grade && !parseGrade(grade)) problems.push({ code: "badGrade", list, hero, grade });
          }
        }
        if (list === "productivity" && (!entry.bonus?.length || entry.bonus.some((value) => !Number.isFinite(value)))) {
          problems.push({ code: "badBonus", list, hero });
        }
        const check = (group: TextGroup, key: string | undefined) => {
          if (!hasText(group, key)) problems.push({ code: "missingText", list, hero, group, key: key as string });
        };
        check("variants", entry.variant);
        check("notes", entry.note);
        if (list === "overall") check("reasons", entry.reason);
        if (list === "battle") for (const role of entry.roles ?? []) check("roles", role);
        if (list === "utility") {
          if (!entry.effect) problems.push({ code: "missingText", list, hero, group: "effects", key: "" });
          else check("effects", entry.effect);
        }
        if (list === "productivity") check("resources", container.resource);
      }
    }
  }
  return problems;
}

/** Variants that became the `rarity` field; drafts saved before then still name them. */
const RARITY_VARIANTS: Record<string, string> = { atUr: "UR", atUrPlus: "UR+" };

function upgradeRarity(entry: LooseEntry) {
  const rarity = entry.variant ? RARITY_VARIANTS[entry.variant] : undefined;
  if (rarity && !entry.rarity) {
    entry.rarity = rarity;
    delete entry.variant;
  }
  if (entry.rarity !== undefined && !(HERO_RARITIES as readonly string[]).includes(entry.rarity)) delete entry.rarity;
}

/** Validates a stored draft; anything unexpected is dropped rather than half-loaded. */
export function parseDraft(raw: string | null): EditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as EditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !value.lists || !value.texts) return null;
    for (const list of LIST_IDS) {
      if (!Array.isArray(value.lists[list])) return null;
      for (const container of value.lists[list]) {
        if (typeof container.id !== "string" || !TIER_IDS.includes(container.tier) || !Array.isArray(container.items)) return null;
        for (const item of container.items) {
          if (typeof item.uid !== "string" || typeof item.entry?.hero !== "string") return null;
          upgradeRarity(item.entry);
        }
      }
    }
    for (const group of TEXT_GROUPS) {
      if (typeof value.texts[group] !== "object" || value.texts[group] === null) return null;
      // A draft saved before a language was added loads with that language empty.
      for (const [key, text] of Object.entries(value.texts[group])) {
        const parsed = parseTranslations(text);
        if (!parsed) return null;
        value.texts[group][key] = parsed;
      }
    }
    return value;
  } catch {
    return null;
  }
}
