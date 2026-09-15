import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getDictionary, mapLocales } from "../lib/i18n/index.ts";
import { LAYOUT_DATA, layoutTexts } from "../lib/content/hero-layouts.ts";
import {
  addBuild,
  addBuildListItem,
  addCounter,
  addGroup,
  addNote,
  buildZoneId,
  counterZoneId,
  countLayoutChanges,
  findChip,
  findLayoutProblems,
  fromLayout,
  groupZoneId,
  heroesIn,
  insertHero,
  moveBuild,
  moveChip,
  parseLayoutDraft,
  removeBuild,
  removeChip,
  removeCounter,
  removeGroup,
  serializeLayout,
  setBuildLine,
  setBuildListItem,
  setChipNote,
  textBlocks,
  toLayout,
} from "../lib/content/hero-layout-editor.ts";

// Every registered language, so the test still runs after one is added.
const TEXTS = mapLocales((locale) => layoutTexts(getDictionary(locale).guideEntries.heroLayouts));
const published = () => fromLayout(LAYOUT_DATA, TEXTS);
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("an untouched draft exports the published JSON and dictionary blocks byte for byte", () => {
  const state = published();
  assert.equal(serializeLayout(toLayout(state)), read("../lib/data/hero-layouts.json"));
  const blocks = textBlocks(state);
  for (const language of ["en", "de", "fr"]) {
    assert.ok(read(`../lib/i18n/dictionaries/${language}.ts`).includes(`${blocks[language]}\n    },`), `${language} block matches the dictionary`);
  }
  assert.equal(countLayoutChanges(state, state), 0);
  assert.deepEqual(findLayoutProblems(state), []);
});

test("moving a hero to another zone or position counts once", () => {
  const base = published();
  const joan = base.builds[0].zones.key[0];
  const moved = moveChip(base, joan.uid, buildZoneId("crit", "other"), 0);
  assert.equal(findChip(moved, joan.uid).zoneId, buildZoneId("crit", "other"));
  assert.equal(countLayoutChanges(base, moved), 1);
  const achilles = base.builds[0].zones.key[1];
  const reordered = moveChip(base, achilles.uid, buildZoneId("crit", "key"), 0);
  assert.equal(countLayoutChanges(base, reordered), 1);
  assert.equal(base.builds[0].zones.key[0].uid, joan.uid, "the input state is not mutated");
});

test("heroes from the pool are inserted, found, and removed", () => {
  const base = published();
  assert.equal(heroesIn(base).has("Cu Chulainn"), false);
  const { state, uid } = insertHero(base, buildZoneId("pursuit", "other"), "Cu Chulainn", 0);
  assert.equal(heroesIn(state).has("Cu Chulainn"), true);
  assert.equal(heroesIn(state, "pursuit").has("Cu Chulainn"), true);
  assert.equal(heroesIn(state, "crit").has("Cu Chulainn"), false);
  assert.equal(toLayout(state).builds.find((build) => build.id === "pursuit").other[0].hero, "Cu Chulainn");
  assert.equal(countLayoutChanges(base, state), 1);
  assert.equal(countLayoutChanges(base, removeChip(state, uid)), 0);
  assert.equal(heroesIn(base).has("Grenade"), false, "Collection items are not heroes");
});

test("a new build gets text in every language and leaves no trace when removed", () => {
  const base = published();
  const { state, id } = addBuild(base, "Shield Wall");
  assert.equal(id, "shieldWall");
  for (const language of ["en", "de", "fr"]) assert.equal(state.texts[language].buildTexts[id].name, "Shield Wall");
  assert.equal(toLayout(state).builds.at(-1).id, id);
  const named = setBuildLine(state, "de", id, "name", "Schildwall");
  assert.equal(named.texts.de.buildTexts[id].name, "Schildwall");
  assert.equal(named.texts.en.buildTexts[id].name, "Shield Wall", "editing one language leaves the others");
  const { state: withCounter, id: counterId } = addCounter(named, id, "Pierce");
  assert.ok(withCounter.texts.fr.counterLabels[counterId]);
  const removed = removeBuild(withCounter, id);
  assert.deepEqual(toLayout(removed), toLayout(base));
  assert.deepEqual(textBlocks(removed), textBlocks(base));
  assert.equal(countLayoutChanges(base, removed), 0);
  assert.ok(countLayoutChanges(base, state) >= 1);
});

test("builds can be reordered, and counters and utility groups added and removed", () => {
  const base = published();
  const reordered = moveBuild(base, "execute", -1);
  assert.deepEqual(toLayout(reordered).builds.map((build) => build.id), ["crit", "dot", "execute", "pursuit"]);
  assert.equal(moveBuild(base, "crit", -1), base, "the first build cannot move further left");
  assert.equal(countLayoutChanges(base, reordered), 1);
  const withoutCounter = removeCounter(base, "crit", "critDelay");
  assert.equal("critDelay" in withoutCounter.texts.de.counterLabels, false);
  const { state: grouped, id: groupId } = addGroup(base, "buffers", "Speed");
  const withHero = insertHero(grouped, groupZoneId("buffers", groupId), "Hermes").state;
  assert.equal(toLayout(withHero).utility.find((role) => role.id === "buffers").groups.at(-1).picks[0].hero, "Hermes");
  assert.deepEqual(textBlocks(removeGroup(grouped, "buffers", groupId)), textBlocks(base));
  assert.ok(counterZoneId("crit", "critDelay").startsWith("b|crit|counter|"));
});

test("pros, cons, and notes stay aligned across languages", () => {
  const base = published();
  const added = addBuildListItem(base, "de", "crit", "pros", "Neu");
  for (const language of ["en", "de", "fr"]) {
    assert.equal(added.texts[language].buildTexts.crit.pros.length, base.texts[language].buildTexts.crit.pros.length + 1);
  }
  const edited = setBuildListItem(added, "fr", "crit", "pros", 0, "Changé");
  assert.equal(edited.texts.fr.buildTexts.crit.pros[0], "Changé");
  assert.equal(edited.texts.en.buildTexts.crit.pros[0], base.texts.en.buildTexts.crit.pros[0]);
});

test("notes such as 'with item' can be created and attached", () => {
  const base = published();
  const { state, key } = addNote(base, { en: "with skin", de: "mit Skin", fr: "" });
  assert.equal(state.texts.fr.pickNotes[key], "with skin", "an empty translation falls back to English");
  const achilles = base.builds[0].zones.key[1];
  const noted = setChipNote(state, achilles.uid, key);
  assert.deepEqual(toLayout(noted).builds[0].key[1], { hero: "Achilles", note: key });
  assert.deepEqual(toLayout(setChipNote(noted, achilles.uid, undefined)).builds[0].key[1], { hero: "Achilles" });
});

test("problems are reported", () => {
  let state = published();
  state = insertHero(state, buildZoneId("crit", "key"), "Achilles").state;
  state = setChipNote(state, state.builds[1].zones.key[0].uid, "noSuchNote");
  state = setBuildLine(state, "fr", "dot", "name", " ");
  const empty = insertHero(state, buildZoneId("crit", "other"), "Temp");
  state = removeChip(empty.state, "nothing");
  const chip = findChip(state, empty.uid).chip;
  chip.hero = "";
  const codes = findLayoutProblems(state).map((problem) => problem.code).sort();
  assert.deepEqual(codes, ["buildName", "duplicate", "emptyHero", "noteText"]);
});

test("stored drafts are validated before use", () => {
  const state = published();
  assert.deepEqual(parseLayoutDraft(JSON.stringify(state)), state);
  assert.equal(parseLayoutDraft(null), null);
  assert.equal(parseLayoutDraft("nope"), null);
  assert.equal(parseLayoutDraft(JSON.stringify({ ...state, version: 3 })), null);
  // A draft saved before a language existed takes that language from its dictionary.
  const older = structuredClone(state);
  delete older.texts.de;
  assert.deepEqual(parseLayoutDraft(JSON.stringify(older)).texts.de, state.texts.de);
  const broken = structuredClone(state);
  delete broken.texts.en;
  assert.equal(parseLayoutDraft(JSON.stringify(broken)), null);
});
