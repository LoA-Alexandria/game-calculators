import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { PAINTING_SETS } from "../lib/content/artwork.ts";
import {
  addHero,
  addPainting,
  addSet,
  countChanges,
  findPainting,
  findProblems,
  findSet,
  fromCatalogue,
  movePainting,
  parseDraft,
  removeHero,
  removePainting,
  removeSet,
  serializePaintingData,
  toCatalogue,
  unusedHeroes,
  updatePainting,
  updateSet,
} from "../lib/content/artwork-editor.ts";

const published = fromCatalogue({ sets: PAINTING_SETS });

test("the published file is exactly what the editor exports for an untouched draft", () => {
  const onDisk = readFileSync(new URL("../lib/data/paintings.json", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.equal(serializePaintingData(toCatalogue(fromCatalogue({ sets: PAINTING_SETS }))), onDisk);
  assert.equal(countChanges({ sets: PAINTING_SETS }, toCatalogue(fromCatalogue({ sets: PAINTING_SETS }))), 0);
});

test("the published catalogue has no editor problems", () => {
  assert.deepEqual(findProblems(fromCatalogue({ sets: PAINTING_SETS })), []);
});

test("adding a painting, attaching a roster hero, and removing them round-trips", () => {
  const glory = published.sets[0];
  const added = addPainting(published, glory.uid, "Night Watch");
  assert.ok(added);
  const named = updatePainting(added.state, added.uid, { name: "Night Watch", productivity: "Glass" });
  const withHero = addHero(named, added.uid, "Achilles");
  const canvas = findPainting(withHero, added.uid).set.paintings.find((row) => row.uid === added.uid);
  assert.equal(canvas.name, "Night Watch");
  assert.equal(canvas.heroes.includes("Achilles"), true);
  assert.equal(countChanges({ sets: PAINTING_SETS }, toCatalogue(withHero)) > 0, true);
  const withoutHero = removeHero(withHero, added.uid, "Achilles");
  assert.equal(findPainting(withoutHero, added.uid).set.paintings.find((row) => row.uid === added.uid).heroes.includes("Achilles"), false);
  const removed = removePainting(withoutHero, added.uid);
  assert.equal(countChanges({ sets: PAINTING_SETS }, toCatalogue(removed)), 0);
});

test("heroes already on a painting are skipped, and UR+ names are flagged", () => {
  const first = published.sets[0].paintings[0];
  assert.equal(unusedHeroes(first).some((hero) => first.heroes.includes(hero.name)), false);
  const merlin = addHero(published, first.uid, "Merlin");
  const problems = findProblems(merlin);
  assert.equal(problems.some((problem) => problem.code === "urPlusHero" && problem.hero === "Merlin"), true);
  const duplicate = addHero(published, first.uid, first.heroes[0]);
  assert.equal(findPainting(duplicate, first.uid).set.paintings[0].heroes.filter((hero) => hero === first.heroes[0]).length, 1);
});

test("sets can be added, renamed, and deleted, but the last one stays", () => {
  const created = addSet(published, "SR", "Test Set");
  assert.equal(findSet(created.state, created.uid).rarity, "SR");
  const renamed = updateSet(created.state, created.uid, { name: "Test Set", effect: "A placeholder effect." });
  assert.equal(findSet(renamed, created.uid).name, "Test Set");
  const dropped = removeSet(renamed, created.uid);
  assert.equal(dropped.sets.some((set) => set.uid === created.uid), false);
  const only = { ...published, sets: [published.sets[0]] };
  assert.equal(removeSet(only, published.sets[0].uid).sets.length, 1);
});

test("the rank menu moves a painting inside its set", () => {
  const set = published.sets[0];
  const first = set.paintings[0];
  const moved = movePainting(published, first.uid, 99);
  const rows = findSet(moved, set.uid).paintings;
  assert.equal(rows[rows.length - 1].uid, first.uid);
  assert.equal(published.sets[0].paintings[0].uid, first.uid);
});

test("stored drafts are validated before use", () => {
  assert.equal(parseDraft(JSON.stringify(published))?.version, 1);
  assert.equal(parseDraft("{"), null);
  assert.equal(parseDraft(JSON.stringify({ ...published, version: 2 })), null);
});

test("set and painting wording is edited per language and exported per dictionary", async () => {
  const { catalogTextBlocks, countCatalogTextChanges, exportCatalogTexts, publishedCatalogTexts, setPaintingText, setSetText } =
    await import("../lib/content/artwork-editor.ts");
  const { localizedSet } = await import("../lib/content/artwork.ts");
  const texts = publishedCatalogTexts();
  let state = fromCatalogue({ sets: PAINTING_SETS }, texts);
  const set = state.sets[0];
  const canvas = set.paintings[0];

  assert.deepEqual(catalogTextBlocks(exportCatalogTexts(state), texts), {}, "an untouched draft has nothing to paste");
  state = setSetText(state, set.uid, "de", "name", "  Ruhm und Schatten ");
  state = setSetText(state, set.uid, "de", "effect", "");
  state = setPaintingText(state, canvas.uid, "de", "productivity", "Glashütte");
  state = setSetText(state, set.uid, "en", "name", "ignored");
  assert.equal(findSet(state, set.uid).name, set.name, "English is edited with updateSet, not as a translation");

  const exported = exportCatalogTexts(state);
  assert.deepEqual(exported.de, {
    sets: { [set.id]: { name: "Ruhm und Schatten" } },
    paintings: { [canvas.id]: { productivity: "Glashütte" } },
  });
  assert.deepEqual(exported.en, {});
  assert.equal(countCatalogTextChanges(exported, texts), 2);
  const blocks = catalogTextBlocks(exported, texts);
  assert.deepEqual(Object.keys(blocks), ["de"]);
  assert.match(blocks.de, /catalogTexts: \{\n        sets: \{\n          "glory-and-shadow": \{\n            name: "Ruhm und Schatten",/);

  const german = localizedSet(PAINTING_SETS[0], exported.de);
  assert.equal(german.name, "Ruhm und Schatten");
  assert.equal(german.effect, PAINTING_SETS[0].effect, "an empty translation keeps the English set skill");
  assert.equal(german.paintings[0].productivity, "Glashütte");
  assert.equal(german.paintings[0].name, PAINTING_SETS[0].paintings[0].name);

  const restored = parseDraft(JSON.stringify(state));
  assert.deepEqual(exportCatalogTexts(restored), exported);
  const older = JSON.parse(JSON.stringify(state));
  delete older.sets[0].texts;
  delete older.sets[0].paintings[0].texts;
  assert.deepEqual(parseDraft(JSON.stringify(older)).sets[0].texts, {}, "drafts from before translations still load");
});
