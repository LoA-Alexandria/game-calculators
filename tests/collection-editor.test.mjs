import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PUBLISHED_COLLECTION,
  addItem,
  collectionTextBlocks,
  countCollectionChanges,
  exportCollection,
  exportedCollectionTexts,
  findCollectionProblems,
  itemByUid,
  itemIdFrom,
  moveItem,
  parseCollectionDraft,
  parseLevel,
  removeItem,
  removePicture,
  serializeCollectionData,
  setItemText,
  setPicture,
  setRarity,
  setSkillLevel,
} from "../lib/content/collection-editor.ts";
import { COLLECTION_DATA } from "../lib/content/collection.ts";
import { getDictionary } from "../lib/i18n/index.ts";

const WEBP = "data:image/webp;base64,UklGRg==";
const uidOf = (state, id) => state.items.find((item) => item.id === id).uid;

test("an untouched draft exports the published JSON and dictionary blocks byte for byte", () => {
  const state = PUBLISHED_COLLECTION;
  const result = exportCollection(state, COLLECTION_DATA);
  assert.deepEqual(result.data, COLLECTION_DATA);
  assert.deepEqual(result.uploads, []);
  assert.deepEqual(result.removedFiles, []);
  assert.equal(serializeCollectionData(result.data), readFileSync(new URL("../lib/data/collection.json", import.meta.url), "utf8"));
  assert.equal(countCollectionChanges(PUBLISHED_COLLECTION, state), 0);
  assert.deepEqual(findCollectionProblems(state), []);

  const blocks = collectionTextBlocks(state);
  assert.equal(blocks.en, "      collectionTexts: {},");
  for (const code of ["de", "fr"]) {
    const dictionary = readFileSync(new URL(`../lib/i18n/dictionaries/${code}.ts`, import.meta.url), "utf8");
    assert.ok(dictionary.includes(blocks[code]), `${code} dictionary contains its exported block`);
    assert.deepEqual(exportedCollectionTexts(state)[code], getDictionary(code).guideEntries.collection.collectionTexts);
  }
});

test("a new item gets an id from its English name and pictures named after it", () => {
  let { state, uid } = addItem(PUBLISHED_COLLECTION, "SR");
  state = setItemText(state, uid, "name", "en", "Rosetta Stone");
  state = setItemText(state, uid, "name", "de", "Stein von Rosetta");
  state = setItemText(state, uid, "skillName", "en", "Decipher");
  state = setItemText(state, uid, "skillText", "en", " Reveals everything. ");
  state = setSkillLevel(state, uid, "3");
  state = setPicture(state, uid, "image", WEBP);
  state = setPicture(state, uid, "icon", WEBP);
  state = setPicture(state, uid, "icon", "not a picture");

  const result = exportCollection(state, COLLECTION_DATA);
  const row = result.data.items.find((item) => item.id === "rosetta-stone");
  assert.deepEqual(row, {
    id: "rosetta-stone",
    name: "Rosetta Stone",
    rarity: "SR",
    image: "rosetta-stone.webp",
    skill: { name: "Decipher", level: 3, text: "Reveals everything.", icon: "rosetta-stone-skill.webp" },
  });
  assert.deepEqual(result.uploads.map((upload) => upload.file), ["rosetta-stone.webp", "rosetta-stone-skill.webp"]);
  assert.deepEqual(exportedCollectionTexts(state).de["rosetta-stone"], { name: "Stein von Rosetta" });
  assert.equal(result.data.items.at(-1).id, "rosetta-stone", "added at the end of its rarity");
  assert.deepEqual(findCollectionProblems(state), []);
  assert.equal(countCollectionChanges(PUBLISHED_COLLECTION, state), 1);
  assert.equal(itemIdFrom("Thor’s Hammer", ["thors-hammer"]), "thors-hammer-2");
});

test("replacing and removing pictures lists the files to add and delete", () => {
  const uid = uidOf(PUBLISHED_COLLECTION, "david");
  let state = setPicture(PUBLISHED_COLLECTION, uid, "image", WEBP);
  let result = exportCollection(state, COLLECTION_DATA);
  assert.deepEqual(result.uploads.map((upload) => upload.file), ["david-2.webp"]);
  assert.deepEqual(result.removedFiles, ["david.webp"]);
  state = removePicture(state, uid, "icon");
  result = exportCollection(state, COLLECTION_DATA);
  assert.deepEqual(result.removedFiles.sort(), ["david-skill.webp", "david.webp"]);
  assert.ok(findCollectionProblems(state).some((problem) => problem.code === "missingIcon" && problem.item === "David"));
});

test("rarity changes regroup an item, moves stay within a rarity, and removals count once", () => {
  const uid = uidOf(PUBLISHED_COLLECTION, "trojan-horse");
  const raised = setRarity(PUBLISHED_COLLECTION, uid, "UR");
  assert.deepEqual(raised.items.slice(0, 2).map((item) => item.id), ["aeolus-bag-of-winds", "trojan-horse"]);
  const first = PUBLISHED_COLLECTION.items[0];
  assert.equal(moveItem(PUBLISHED_COLLECTION, first.uid, 1), PUBLISHED_COLLECTION, "the only UR item cannot move");
  const torch = uidOf(PUBLISHED_COLLECTION, "prometheus-torch");
  assert.equal(moveItem(PUBLISHED_COLLECTION, torch, 1).items[2].id, "prometheus-torch");
  assert.equal(countCollectionChanges(PUBLISHED_COLLECTION, removeItem(PUBLISHED_COLLECTION, torch)), 1);
});

test("problems name the item, and a damaged draft is ignored", () => {
  let { state, uid } = addItem(PUBLISHED_COLLECTION, "SSR");
  const codes = findCollectionProblems(state).map((problem) => problem.code).sort();
  assert.deepEqual(codes, ["emptyName", "emptySkill", "missingIcon", "missingImage"]);
  state = setItemText(state, uid, "name", "en", "david");
  state = setSkillLevel(state, uid, "0");
  const more = findCollectionProblems(state).map((problem) => problem.code);
  assert.ok(more.includes("duplicateName") && more.includes("badLevel"));
  assert.equal(parseLevel(" 12 "), 12);
  assert.equal(parseLevel("1.5"), null);

  assert.deepEqual(parseCollectionDraft(JSON.stringify(state)), state);
  assert.equal(parseCollectionDraft(null), null);
  assert.equal(parseCollectionDraft("{"), null);
  const broken = { ...state, items: state.items.map((item, index) => (index === 0 ? { ...item, image: { uid: "x" } } : item)) };
  assert.equal(parseCollectionDraft(JSON.stringify(broken)), null);
  assert.equal(itemByUid(state, uid).skillLevel, "0");
});
