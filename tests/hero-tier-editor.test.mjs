import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import en from "../lib/i18n/dictionaries/en.ts";
import { TIER_DATA } from "../lib/content/hero-tiers.ts";
import {
  TEXT_GROUPS,
  addGroup,
  addItem,
  addText,
  containerId,
  countChanges,
  dictionarySnippet,
  findItem,
  findProblems,
  fromTierData,
  moveItem,
  moveToGroup,
  parseDraft,
  removeItem,
  serializeTierData,
  textKeyFrom,
  toTierData,
  updateItem,
} from "../lib/content/hero-tier-editor.ts";

const known = Object.fromEntries(
  TEXT_GROUPS.map((group) => [group, new Set(Object.keys(en.guideEntries.heroTierList[group]))]),
);
const noChanges = { overall: 0, battle: 0, utility: 0, productivity: 0 };

test("the published file is exactly what the editor exports for an untouched draft", () => {
  const onDisk = readFileSync(new URL("../lib/data/hero-tiers.json", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.equal(serializeTierData(toTierData(fromTierData(TIER_DATA))), onDisk);
  assert.deepEqual(countChanges(TIER_DATA, toTierData(fromTierData(TIER_DATA))), noChanges);
});

test("the published data has no problems", () => {
  assert.deepEqual(findProblems(fromTierData(TIER_DATA), known), []);
});

test("moving a hero to another tier changes only that list", () => {
  const state = fromTierData(TIER_DATA);
  const joan = state.lists.overall[0].items[0];
  const moved = moveItem(state, "overall", joan.uid, containerId("overall", "A"), 0);
  assert.equal(findItem(moved, "overall", joan.uid).container.tier, "A");
  assert.equal(findItem(moved, "overall", joan.uid).index, 0);
  assert.equal(moved.lists.overall[0].items.length, state.lists.overall[0].items.length - 1);
  const changes = countChanges(TIER_DATA, toTierData(moved));
  assert.equal(changes.overall, 1, "one move is one change, not one per shifted hero");
  assert.equal(changes.battle + changes.utility + changes.productivity, 0);
  assert.equal(state.lists.overall[0].items[0].uid, joan.uid, "the original state is not mutated");
});

test("reordering inside a tier counts as a change and clamps the index", () => {
  const state = fromTierData(TIER_DATA);
  const first = state.lists.battle[0].items[0];
  const moved = moveItem(state, "battle", first.uid, containerId("battle", "SS"), 99);
  const ss = moved.lists.battle[0].items;
  assert.equal(ss[ss.length - 1].uid, first.uid);
  assert.equal(countChanges(TIER_DATA, toTierData(moved)).battle, 1);
});

test("adding, editing, and removing a hero round-trips through the export", () => {
  let { state, uid } = addItem(fromTierData(TIER_DATA), "utility", containerId("utility", "B"));
  state = updateItem(state, "utility", uid, { hero: "  Charlie Chaplin ", effect: "astralDamage12", situational: true });
  const exported = toTierData(state).utility.find((row) => row.tier === "B").entries.at(-1);
  assert.deepEqual(exported, { hero: "Charlie Chaplin", effect: "astralDamage12", situational: true });
  assert.equal(countChanges(TIER_DATA, toTierData(state)).utility, 1);
  const edited = updateItem(state, "utility", state.lists.utility[0].items[0].uid, { situational: true });
  assert.equal(countChanges(TIER_DATA, toTierData(edited)).utility, 2, "an edit in place counts too");
  const removed = removeItem(state, "utility", uid);
  assert.deepEqual(countChanges(TIER_DATA, toTierData(removed)), noChanges);
});

test("productivity heroes move between resource groups, and empty groups are not exported", () => {
  let state = fromTierData(TIER_DATA);
  const hermes = state.lists.productivity.find((container) => container.resource === "universal").items[0];
  state = addGroup(state, "SS", "coal");
  assert.equal(toTierData(state).productivity.some((row) => row.tier === "SS"), false);
  state = moveToGroup(state, hermes.uid, "SS", "coal");
  const ss = toTierData(state).productivity.find((row) => row.tier === "SS");
  assert.deepEqual(ss.groups.map((group) => group.resource), ["coal"]);
  assert.equal(ss.groups[0].entries[0].hero, "Hermes");
  assert.equal(toTierData(state).productivity[0].tier, "SS", "rows stay in tier order");
});

test("new text gets a readable, unique key and a snippet for every language", () => {
  assert.equal(textKeyFrom("Damage in Astral Wonderland +12 %", []), "damageInAstralWonderland12");
  assert.equal(textKeyFrom("Résumé", ["resume"]), "resume2");
  assert.equal(textKeyFrom("!!!", []), "custom");
  const state = addText(fromTierData(TIER_DATA), "effects", "chaplinBonus", { en: "Astral bonus", de: "Astral-Bonus", fr: "" });
  const snippet = dictionarySnippet(state.texts);
  assert.match(snippet.en, /chaplinBonus: "Astral bonus",/);
  assert.match(snippet.de, /chaplinBonus: "Astral-Bonus",/);
  assert.match(snippet.fr, /chaplinBonus: "Astral bonus",/, "an empty translation falls back to English");
  assert.equal(dictionarySnippet(fromTierData(TIER_DATA).texts).en, "");
});

test("problems are reported for broken entries", () => {
  let state = fromTierData(TIER_DATA);
  const joan = state.lists.overall[0].items[0];
  state = updateItem(state, "overall", joan.uid, { battle: "SSS", reason: "notAKey" });
  let added = addItem(state, "overall", containerId("overall", "D"));
  state = added.state;
  added = addItem(state, "battle", containerId("battle", "D"), { hero: "Odysseus", roles: ["dot"] });
  state = added.state;
  const productivity = addItem(state, "productivity", state.lists.productivity[0].id, { hero: "Nobody", bonus: [] });
  state = productivity.state;
  const codes = findProblems(state, known).map((problem) => problem.code).sort();
  assert.deepEqual(codes, ["badBonus", "badGrade", "duplicate", "emptyName", "missingText"]);
  state = addText(state, "reasons", "notAKey", { en: "x", de: "x", fr: "x" });
  assert.equal(findProblems(state, known).some((problem) => problem.code === "missingText"), false);
});

test("stored drafts are validated before use", () => {
  const state = fromTierData(TIER_DATA);
  assert.deepEqual(parseDraft(JSON.stringify(state)), state);
  assert.equal(parseDraft(null), null);
  assert.equal(parseDraft("{not json"), null);
  assert.equal(parseDraft(JSON.stringify({ ...state, version: 2 })), null);
  const broken = structuredClone(state);
  broken.lists.overall[0].tier = "Z";
  assert.equal(parseDraft(JSON.stringify(broken)), null);
});
