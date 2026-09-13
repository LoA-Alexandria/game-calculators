import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import en from "../lib/i18n/dictionaries/en.ts";
import { ARTWORK_LAYOUT_DATA } from "../lib/content/artwork-layouts.ts";
import {
  addBuild,
  addRow,
  addText,
  countChanges,
  dictionarySnippet,
  findBuild,
  findProblems,
  fromLayoutData,
  moveRow,
  parseDraft,
  removeBuild,
  removeRow,
  serializeLayoutData,
  setBuildNote,
  toLayoutData,
  unusedSets,
  updateRow,
} from "../lib/content/artwork-layout-editor.ts";

const published = fromLayoutData(ARTWORK_LAYOUT_DATA);
const known = {
  names: new Set(Object.keys(en.guideEntries.artworkLayouts.buildNames)),
  notes: new Set(Object.keys(en.guideEntries.artworkLayouts.notes)),
  reasons: new Set(Object.keys(en.guideEntries.artworkLayouts.reasons)),
};

test("the published file is exactly what the editor exports for an untouched draft", () => {
  const onDisk = readFileSync(new URL("../lib/data/artwork-layouts.json", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.equal(serializeLayoutData(toLayoutData(fromLayoutData(ARTWORK_LAYOUT_DATA))), onDisk);
  assert.equal(countChanges(ARTWORK_LAYOUT_DATA, toLayoutData(fromLayoutData(ARTWORK_LAYOUT_DATA))), 0);
});

test("the published ranking has no problems", () => {
  assert.deepEqual(findProblems(fromLayoutData(ARTWORK_LAYOUT_DATA), known), []);
});

test("the rank menu moves a set and counts as one change", () => {
  const crit = published.builds[0];
  const first = crit.rows[0];
  const moved = moveRow(published, "crit", first.uid, 99);
  const rows = findBuild(moved, "crit").rows;
  assert.equal(rows[rows.length - 1].uid, first.uid);
  assert.equal(rows[0].uid, crit.rows[1].uid);
  assert.equal(countChanges(ARTWORK_LAYOUT_DATA, toLayoutData(moved)), 1);
  assert.equal(published.builds[0].rows[0].uid, first.uid, "the original state is not mutated");
});

test("adding a set from Artwork, editing it, and removing it round-trips", () => {
  const added = addRow(published, "crit", "sheltered-by-night", "defense");
  assert.ok(added);
  assert.equal(findBuild(added.state, "crit").rows.at(-1).setId, "sheltered-by-night");
  assert.equal(countChanges(ARTWORK_LAYOUT_DATA, toLayoutData(added.state)), 1);
  const edited = updateRow(added.state, "crit", added.uid, { insert: true });
  assert.equal(findBuild(edited, "crit").rows.at(-1).insert, true);
  const removed = removeRow(edited, "crit", added.uid);
  assert.equal(countChanges(ARTWORK_LAYOUT_DATA, toLayoutData(removed)), 0);
  assert.equal(addRow(published, "crit", "nature-in-bloom"), null, "a set already in the build is not added twice");
});

test("builds can be copied, noted, and deleted, but the last one stays", () => {
  const created = addBuild(published, { en: "Stall", de: "Stall", fr: "Stall" }, "crit");
  assert.equal(created.id, "stall");
  assert.equal(findBuild(created.state, "stall").rows[0].setId, "nature-in-bloom");
  assert.equal(created.state.texts.names.stall.en, "Stall");
  const noted = setBuildNote(created.state, "stall", "rest");
  assert.equal(findBuild(noted, "stall").note, "rest");
  const dropped = removeBuild(noted, "stall");
  assert.equal(dropped.builds.some((build) => build.id === "stall"), false);
  assert.equal(countChanges(ARTWORK_LAYOUT_DATA, toLayoutData(dropped)), 0);
  const only = { ...published, builds: [published.builds[0]] };
  assert.equal(removeBuild(only, "crit").builds.length, 1);
});

test("unused sets skip what the current build already ranks", () => {
  const leftover = unusedSets(published.builds[0]);
  assert.equal(leftover.some((set) => set.id === "nature-in-bloom"), false);
  assert.equal(leftover.some((set) => set.id === "self-portrait"), true);
});

test("a draft with a new reason exports dictionary lines and is rejected when truncated", () => {
  const withText = addText(published, "reasons", "stallHold", { en: "Holds a stall line", de: "", fr: "" });
  const snippets = dictionarySnippet(withText.texts);
  assert.match(snippets.en, /stallHold: "Holds a stall line"/);
  assert.equal(parseDraft(JSON.stringify(published))?.version, 1);
  assert.equal(parseDraft("{"), null);
  assert.equal(parseDraft(JSON.stringify({ ...published, version: 2 })), null);
});
