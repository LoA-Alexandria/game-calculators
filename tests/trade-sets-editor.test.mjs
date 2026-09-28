import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PUBLISHED_TRADE,
  addItem,
  addSet,
  countTradeChanges,
  exportTrade,
  findTradeProblems,
  fromTradeData,
  itemId,
  lettersFor,
  parseTradeDraft,
  partsOf,
  removeItem,
  removeSet,
  serializeTradeData,
  setGroupParts,
  setItem,
  setOf,
  setSetField,
  tradeSlug,
} from "../lib/content/trade-sets-editor.ts";
import { TRADE_SETS } from "../lib/content/guild-trade.ts";

const committed = JSON.parse(readFileSync(new URL("../lib/data/trade-sets.json", import.meta.url), "utf8"));
const state = () => fromTradeData({ sets: TRADE_SETS });
const spring = () => state().sets[0];

test("an untouched draft gives the file back exactly as it is committed", () => {
  assert.deepEqual(exportTrade(state()), committed);
  assert.equal(countTradeChanges(state(), state()), 0);
  assert.deepEqual(findTradeProblems(state()), [], "the committed set has nothing to fix");
});

test("the committed set is the one the board expects", () => {
  const set = exportTrade(state()).sets[0];
  assert.equal(set.items.length, 44);
  assert.deepEqual(set.groups, [
    { id: "ur", parts: 8 },
    { id: "choice", parts: 0 },
    { id: "ssr", parts: 6 },
  ]);
  assert.equal(set.items.filter((item) => item.kind === "ur").length, 12);
  assert.equal(set.items.filter((item) => item.kind === "choice").length, 12);
  assert.equal(set.items.filter((item) => item.kind === "ssr").length, 20);
});

test("a new set starts with the three groups the game uses", () => {
  const { state: next, uid } = addSet(state());
  const added = setOf(next, uid);
  assert.deepEqual(added.groups.map((group) => [group.kind, group.parts]), [
    ["ur", "8"],
    ["choice", "0"],
    ["ssr", "6"],
  ]);
  assert.equal(added.items.length, 0);
  // A set with no name cannot be filed, and an empty one is worth saying.
  assert.ok(findTradeProblems(next).some((problem) => problem.code === "noSetName"));
  const named = setSetField(next, uid, { name: "Summer Furniture" });
  assert.deepEqual(findTradeProblems(named), [{ code: "emptySet", set: "Summer Furniture" }]);
  assert.equal(exportTrade(named).sets[1].id, "summer-furniture", "the id follows the name");
  assert.equal(countTradeChanges(state(), removeSet(named, uid)), 0, "and taking it back leaves nothing");
});

test("a new piece comes with the letters its kind asks for", () => {
  const { state: withSet, uid } = addSet(setSetField(state(), spring().uid, {}));
  const named = setSetField(withSet, uid, { name: "Summer Furniture" });
  const { state: withUr, uid: urUid } = addItem(named, uid, "ur");
  assert.equal(setOf(withUr, uid).items[0].parts, "A B C D E F G H");

  const { state: withSsr } = addItem(withUr, uid, "ssr");
  assert.equal(setOf(withSsr, uid).items[1].parts, "A B C D E F");

  const { state: withChoice } = addItem(withSsr, uid, "choice");
  assert.equal(setOf(withChoice, uid).items[2].parts, "", "a choice part is a single trade");

  // Changing a piece's kind moves it to the other size, as long as nobody
  // has written its letters by hand.
  const moved = setItem(withChoice, uid, urUid, { kind: "ssr" });
  assert.equal(setOf(moved, uid).items[0].parts, "A B C D E F");
  const byHand = setItem(withChoice, uid, urUid, { parts: "A B" });
  assert.equal(setOf(setItem(byHand, uid, urUid, { kind: "ssr" }), uid).items[0].parts, "A B", "left alone");
});

test("a piece whose letters do not match its group is named", () => {
  const set = spring();
  const item = set.items.find((entry) => entry.kind === "ur");
  const short = setItem(state(), set.uid, item.uid, { parts: "A B C" });
  assert.deepEqual(findTradeProblems(short), [
    { code: "partsMismatch", set: set.name, item: item.name, has: 3, wants: 8 },
  ]);

  // Changing the group's size is the other way to say the same thing.
  const smaller = setGroupParts(state(), set.uid, "ur", "3");
  assert.equal(findTradeProblems(smaller).filter((problem) => problem.code === "partsMismatch").length, 12);
});

test("two pieces under one id are a problem", () => {
  const set = spring();
  const first = set.items[0];
  const second = set.items[1];
  const clash = setItem(state(), set.uid, second.uid, { id: "", name: first.name });
  assert.ok(findTradeProblems(clash).some((problem) => problem.code === "duplicateItem"));
  assert.equal(itemId({ id: "", name: "Tea Party Corridor" }), "tea-party-corridor");
  assert.equal(tradeSlug("Flower Crown Seating"), "flower-crown-seating");
  assert.equal(tradeSlug("Café Étoile"), "cafe-etoile");
});

test("letters are read however they are typed", () => {
  assert.deepEqual(partsOf("A B C"), ["A", "B", "C"]);
  assert.deepEqual(partsOf(" A,B , C "), ["A", "B", "C"]);
  assert.deepEqual(partsOf(""), []);
  assert.equal(lettersFor(0), "");
  assert.equal(lettersFor(8), "A B C D E F G H");
});

test("a removed piece is gone from the file", () => {
  const set = spring();
  const gone = removeItem(state(), set.uid, set.items[0].uid);
  assert.equal(exportTrade(gone).sets[0].items.length, 43);
  assert.equal(countTradeChanges(state(), gone), 1);
});

test("the file is written one piece per line and reads back the same", () => {
  const text = serializeTradeData(exportTrade(state()));
  assert.deepEqual(JSON.parse(text), committed);
  assert.equal(text.split("\n").filter((line) => line.startsWith('      {"id"')).length, 44);
});

test("a draft survives a reload, and nonsense does not load at all", () => {
  const next = setItem(state(), spring().uid, spring().items[0].uid, { name: "Tea Party Hall" });
  assert.deepEqual(parseTradeDraft(JSON.stringify(next)), next);
  assert.equal(parseTradeDraft("not json"), null);
  assert.equal(parseTradeDraft(null), null);
  assert.equal(parseTradeDraft(JSON.stringify({ ...next, version: 2 })), null);
  const badKind = {
    ...next,
    sets: [{ ...next.sets[0], items: [{ ...next.sets[0].items[0], kind: "legendary" }] }],
  };
  assert.equal(parseTradeDraft(JSON.stringify(badKind)), null);
});

test("what is published is what the board shows right now", () => {
  assert.deepEqual(exportTrade(PUBLISHED_TRADE), committed);
});
