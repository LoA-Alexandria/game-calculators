import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PUBLISHED_LAYOUTS,
  addNote,
  addSetup,
  countLayoutChanges,
  exportLayouts,
  exportedOptionTexts,
  exportedSetupTexts,
  findLayoutProblems,
  layoutTextBlocks,
  moveSetup,
  parseLayoutsDraft,
  removeSetup,
  serializeLayoutsData,
  setCredit,
  setNoteText,
  setOptionText,
  setSetupText,
  setSlot,
  setupIdFrom,
  toggleSetupTag,
} from "../lib/content/collection-layouts-editor.ts";
import { COLLECTION_LAYOUTS_DATA } from "../lib/content/collection-layouts.ts";
import { getDictionary } from "../lib/i18n/index.ts";

const uidOf = (state, id) => state.setups.find((setup) => setup.id === id).uid;
const optionUid = (state, item) => state.options.find((option) => option.item === item).uid;

test("an untouched draft exports the published file and dictionary blocks byte for byte", () => {
  const state = PUBLISHED_LAYOUTS;
  assert.deepEqual(exportLayouts(state), COLLECTION_LAYOUTS_DATA);
  assert.equal(
    serializeLayoutsData(exportLayouts(state)),
    readFileSync(new URL("../lib/data/collection-layouts.json", import.meta.url), "utf8"),
  );
  assert.equal(countLayoutChanges(PUBLISHED_LAYOUTS, state), 0);
  assert.deepEqual(findLayoutProblems(state), []);

  const blocks = layoutTextBlocks(state);
  assert.equal(blocks.en, "      setupTexts: {},\n      optionTexts: {},");
  for (const code of ["de", "fr"]) {
    const dictionary = readFileSync(new URL(`../lib/i18n/dictionaries/${code}.ts`, import.meta.url), "utf8");
    assert.ok(dictionary.includes(blocks[code]), `${code} dictionary contains its exported blocks`);
    const entry = getDictionary(code).guideEntries.collectionLayouts;
    assert.deepEqual(exportedSetupTexts(state)[code], entry.setupTexts);
    assert.deepEqual(exportedOptionTexts(state)[code], entry.optionTexts);
  }
});

test("a new setup gets an id from its English title and keeps its slots", () => {
  let { state, uid } = addSetup(PUBLISHED_LAYOUTS);
  state = setSetupText(state, uid, "title", "en", "Seal cheese");
  state = setSetupText(state, uid, "title", "de", "Siegel-Cheese");
  state = setSetupText(state, uid, "lede", "en", " Stops them moving. ");
  state = setCredit(state, uid, "Autumn (Ice, S12)");
  state = toggleSetupTag(state, uid, "pvp");
  state = toggleSetupTag(state, uid, "seal");
  state = toggleSetupTag(state, uid, "pvp");
  state = addNote(state, uid);
  const note = state.setups.at(-1).notes[0].uid;
  state = setNoteText(state, uid, note, "en", "Needs both triggers to land.");
  for (const [age, item] of Object.entries({
    iceAge: "prometheus-torch",
    stoneAge: "thors-hammer",
    bronzeAge: "trojan-horse",
    classical: "olympia-olive-wreath",
    medieval: "plague-doctor-mask",
    renaissance: "david",
  })) {
    state = setSlot(state, uid, age, item);
  }

  const data = exportLayouts(state);
  const added = data.setups.at(-1);
  assert.equal(added.id, "seal-cheese");
  assert.deepEqual(added.tags, ["seal"]);
  assert.equal(added.lede, "Stops them moving.");
  assert.deepEqual(added.notes, ["Needs both triggers to land."]);
  assert.equal(added.slots.bronzeAge, "trojan-horse");
  assert.equal(exportedSetupTexts(state).de["seal-cheese"].title, "Siegel-Cheese");
  assert.deepEqual(findLayoutProblems(state), []);
  assert.equal(countLayoutChanges(PUBLISHED_LAYOUTS, state), 1);
  assert.equal(setupIdFrom("Seal cheese", ["seal-cheese"]), "seal-cheese-2");
});

test("problems name the setup, and moving or removing counts as one change", () => {
  const uid = uidOf(PUBLISHED_LAYOUTS, "autumn-pve");
  const empty = setSlot(PUBLISHED_LAYOUTS, uid, "classical", "");
  assert.ok(findLayoutProblems(empty).some((problem) => problem.code === "emptySlot" && problem.age === "classical"));
  const unknown = setSlot(PUBLISHED_LAYOUTS, uid, "classical", "nothing-like-this");
  assert.ok(findLayoutProblems(unknown).some((problem) => problem.code === "unknownItem" && problem.item === "nothing-like-this"));
  const blank = setOptionText(PUBLISHED_LAYOUTS, optionUid(PUBLISHED_LAYOUTS, "david"), "en", "  ");
  assert.ok(findLayoutProblems(blank).some((problem) => problem.code === "emptyNote"));
  const twice = setSetupText(PUBLISHED_LAYOUTS, uid, "title", "en", "All-round setup");
  assert.ok(findLayoutProblems(twice).some((problem) => problem.code === "duplicateTitle"));

  assert.equal(countLayoutChanges(PUBLISHED_LAYOUTS, removeSetup(PUBLISHED_LAYOUTS, uid)), 1);
  const moved = moveSetup(PUBLISHED_LAYOUTS, uid, -1);
  assert.equal(moved.setups[1].id, "autumn-pve");
  assert.equal(countLayoutChanges(PUBLISHED_LAYOUTS, moved), 1);
});

test("a stored draft round-trips, and a damaged one is ignored", () => {
  const state = setOptionText(PUBLISHED_LAYOUTS, optionUid(PUBLISHED_LAYOUTS, "pandoras-box"), "fr", "Risqué.");
  assert.deepEqual(parseLayoutsDraft(JSON.stringify(state)), state);
  assert.equal(parseLayoutsDraft(null), null);
  assert.equal(parseLayoutsDraft("{"), null);
  assert.equal(parseLayoutsDraft(JSON.stringify({ ...state, version: 2 })), null);
  const badTag = { ...state, setups: state.setups.map((setup, index) => (index === 0 ? { ...setup, tags: ["nope"] } : setup)) };
  assert.equal(parseLayoutsDraft(JSON.stringify(badTag)), null);
  const badAge = { ...state, options: state.options.map((option, index) => (index === 0 ? { ...option, age: "spaceAge" } : option)) };
  assert.equal(parseLayoutsDraft(JSON.stringify(badAge)), null);
});
