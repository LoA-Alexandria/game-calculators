/**
 * Pure state logic for the trade sets editor.
 *
 * A set is one event's furniture: its groups (how many parts a piece of that
 * kind is built from) and its pieces. The board reads nothing else, so adding
 * next season's set here is all it takes for a guild to start marking parts.
 *
 * Parts are typed as their letters — "A B C D E F G H" — because that is how
 * the game names them and how the board labels its boxes. A choice part has
 * none at all, which is what makes it a single trade rather than a piece.
 */

import {
  TRADE_ITEM_KINDS,
  TRADE_SETS,
  type TradeItem,
  type TradeItemKind,
  type TradeSet,
} from "./guild-trade.ts";

/** Letters in order, so a piece of six parts is A to F without typing them. */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type EditorTradeItem = {
  uid: string;
  id: string;
  name: string;
  kind: TradeItemKind;
  /** The letters, separated by spaces. Empty for a choice part. */
  parts: string;
};

export type EditorTradeGroup = { kind: TradeItemKind; parts: string };

export type EditorTradeSet = {
  uid: string;
  id: string;
  name: string;
  groups: EditorTradeGroup[];
  items: EditorTradeItem[];
};

export type TradeEditorState = {
  version: 1;
  sets: EditorTradeSet[];
  nextId: number;
};

/** `Spring Furniture` becomes `spring-furniture`, the shape the files use. */
export function tradeSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function partsOf(text: string): string[] {
  return text.trim().split(/[\s,]+/).filter(Boolean);
}

/** The first `count` letters, for a new piece of a kind that has a size. */
export function lettersFor(count: number): string {
  return LETTERS.slice(0, Math.max(0, Math.min(count, LETTERS.length))).split("").join(" ");
}

export function fromTradeData(data: { sets: TradeSet[] }): TradeEditorState {
  let nextId = 1;
  return {
    version: 1,
    sets: data.sets.map((set) => ({
      uid: `s${nextId++}`,
      id: set.id,
      name: set.name,
      groups: set.groups.map((group) => ({ kind: group.id, parts: String(group.parts) })),
      items: set.items.map((item) => ({
        uid: `i${nextId++}`,
        id: item.id,
        name: item.name,
        kind: item.kind,
        parts: item.parts.join(" "),
      })),
    })),
    nextId,
  };
}

export function setOf(state: TradeEditorState, uid: string): EditorTradeSet | undefined {
  return state.sets.find((set) => set.uid === uid);
}

function mapSet(
  state: TradeEditorState,
  uid: string,
  change: (set: EditorTradeSet) => EditorTradeSet,
): TradeEditorState {
  return { ...state, sets: state.sets.map((set) => (set.uid === uid ? change(set) : set)) };
}

/** A new set starts with the three groups the game has always used. */
export function addSet(state: TradeEditorState): { state: TradeEditorState; uid: string } {
  const uid = `s${state.nextId}`;
  const set: EditorTradeSet = {
    uid,
    id: "",
    name: "",
    groups: TRADE_ITEM_KINDS.map((kind) => ({ kind, parts: kind === "choice" ? "0" : kind === "ur" ? "8" : "6" })),
    items: [],
  };
  return { state: { ...state, nextId: state.nextId + 1, sets: [...state.sets, set] }, uid };
}

export function removeSet(state: TradeEditorState, uid: string): TradeEditorState {
  return { ...state, sets: state.sets.filter((set) => set.uid !== uid) };
}

export function setSetField(
  state: TradeEditorState,
  uid: string,
  patch: Partial<Pick<EditorTradeSet, "id" | "name">>,
): TradeEditorState {
  return mapSet(state, uid, (set) => ({ ...set, ...patch }));
}

export function setGroupParts(
  state: TradeEditorState,
  uid: string,
  kind: TradeItemKind,
  parts: string,
): TradeEditorState {
  return mapSet(state, uid, (set) => ({
    ...set,
    groups: set.groups.map((group) => (group.kind === kind ? { ...group, parts } : group)),
  }));
}

/** A new piece comes with the letters its kind asks for, ready to rename. */
export function addItem(state: TradeEditorState, uid: string, kind: TradeItemKind): { state: TradeEditorState; uid: string } {
  const itemUid = `i${state.nextId}`;
  const set = setOf(state, uid);
  const size = Number(set?.groups.find((group) => group.kind === kind)?.parts ?? 0);
  const item: EditorTradeItem = {
    uid: itemUid,
    id: "",
    name: "",
    kind,
    parts: Number.isFinite(size) ? lettersFor(size) : "",
  };
  return {
    state: mapSet({ ...state, nextId: state.nextId + 1 }, uid, (entry) => ({ ...entry, items: [...entry.items, item] })),
    uid: itemUid,
  };
}

export function removeItem(state: TradeEditorState, uid: string, itemUid: string): TradeEditorState {
  return mapSet(state, uid, (set) => ({ ...set, items: set.items.filter((item) => item.uid !== itemUid) }));
}

export function setItem(
  state: TradeEditorState,
  uid: string,
  itemUid: string,
  patch: Partial<Omit<EditorTradeItem, "uid">>,
): TradeEditorState {
  return mapSet(state, uid, (set) => ({
    ...set,
    items: set.items.map((item) => {
      if (item.uid !== itemUid) return item;
      const next = { ...item, ...patch };
      // Changing the kind changes how many parts a piece has, unless somebody
      // has already written its letters by hand.
      if (patch.kind && patch.kind !== item.kind && item.parts === partsFor(set, item.kind)) {
        next.parts = partsFor(set, patch.kind);
      }
      return next;
    }),
  }));
}

function partsFor(set: EditorTradeSet, kind: TradeItemKind): string {
  return lettersFor(Number(set.groups.find((group) => group.kind === kind)?.parts ?? 0));
}

/** The id a piece is filed under: the one it came with, or one from its name. */
export function itemId(item: EditorTradeItem): string {
  return item.id || tradeSlug(item.name);
}

export function setId(set: EditorTradeSet): string {
  return set.id || tradeSlug(set.name);
}

/** The file as it would be committed, in the order the editor shows it. */
export function exportTrade(state: TradeEditorState): { sets: TradeSet[] } {
  return {
    sets: state.sets.map((set): TradeSet => ({
      id: setId(set),
      name: set.name.trim(),
      groups: set.groups.map((group) => ({ id: group.kind, parts: Number(group.parts) || 0 })),
      items: set.items.map((item): TradeItem => ({
        id: itemId(item),
        name: item.name.trim(),
        kind: item.kind,
        parts: partsOf(item.parts),
      })),
    })),
  };
}

export function countTradeChanges(published: TradeEditorState, draft: TradeEditorState): number {
  const before = new Map(exportTrade(published).sets.map((set) => [set.id, set]));
  const after = exportTrade(draft).sets;
  let changes = 0;
  for (const set of after) {
    const was = before.get(set.id);
    if (!was) {
      changes += 1;
      continue;
    }
    if (set.name !== was.name || JSON.stringify(set.groups) !== JSON.stringify(was.groups)) changes += 1;
    const items = new Map(was.items.map((item) => [item.id, JSON.stringify(item)]));
    for (const item of set.items) if (items.get(item.id) !== JSON.stringify(item)) changes += 1;
    for (const item of was.items) if (!set.items.some((entry) => entry.id === item.id)) changes += 1;
  }
  for (const set of before.values()) if (!after.some((entry) => entry.id === set.id)) changes += 1;
  return changes;
}

export type TradeProblem =
  | { code: "noSetName" }
  | { code: "duplicateSet"; id: string }
  | { code: "noItemName"; set: string }
  | { code: "duplicateItem"; set: string; id: string }
  | { code: "partsMismatch"; set: string; item: string; has: number; wants: number }
  | { code: "emptySet"; set: string };

export function findTradeProblems(state: TradeEditorState): TradeProblem[] {
  const problems: TradeProblem[] = [];
  const seenSets = new Set<string>();
  for (const set of state.sets) {
    const name = set.name.trim();
    if (!name) {
      problems.push({ code: "noSetName" });
      continue;
    }
    const id = setId(set);
    if (seenSets.has(id)) problems.push({ code: "duplicateSet", id });
    seenSets.add(id);
    if (set.items.length === 0) problems.push({ code: "emptySet", set: name });

    const seenItems = new Set<string>();
    for (const item of set.items) {
      if (!item.name.trim()) {
        problems.push({ code: "noItemName", set: name });
        continue;
      }
      const own = itemId(item);
      if (seenItems.has(own)) problems.push({ code: "duplicateItem", set: name, id: own });
      seenItems.add(own);

      // A piece with the wrong number of letters is never finished, or is
      // finished too early: the board counts the parts it is told about.
      const wants = Number(set.groups.find((group) => group.kind === item.kind)?.parts ?? 0);
      const has = partsOf(item.parts).length;
      if (has !== wants) {
        problems.push({ code: "partsMismatch", set: name, item: item.name.trim(), has, wants });
      }
    }
  }
  return problems;
}

/** One piece per line, so a renamed piece shows up as one changed line. */
export function serializeTradeData(data: { sets: TradeSet[] }): string {
  const sets = data.sets.map((set) => {
    const groups = set.groups.map((group) => JSON.stringify(group)).join(", ");
    const items = set.items.map((item) => `      ${JSON.stringify(item)}`).join(",\n");
    return [
      "    {",
      `      "id": ${JSON.stringify(set.id)},`,
      `      "name": ${JSON.stringify(set.name)},`,
      `      "groups": [${groups}],`,
      '      "items": [',
      items,
      "      ]",
      "    }",
    ].join("\n");
  });
  return `{\n  "sets": [\n${sets.join(",\n")}\n  ]\n}\n`;
}

export function parseTradeDraft(raw: string | null): TradeEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as TradeEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.sets)) return null;
    const kinds = new Set<string>(TRADE_ITEM_KINDS);
    for (const set of value.sets) {
      if (typeof set?.uid !== "string" || typeof set.id !== "string" || typeof set.name !== "string") return null;
      if (!Array.isArray(set.groups) || !Array.isArray(set.items)) return null;
      for (const group of set.groups) {
        if (!kinds.has(group?.kind) || typeof group.parts !== "string") return null;
      }
      for (const item of set.items) {
        if (typeof item?.uid !== "string" || typeof item.id !== "string") return null;
        if (typeof item.name !== "string" || typeof item.parts !== "string") return null;
        if (!kinds.has(item.kind)) return null;
      }
    }
    return value;
  } catch {
    return null;
  }
}

/** The sets as they are published right now. */
export const PUBLISHED_TRADE = fromTradeData({ sets: TRADE_SETS });
