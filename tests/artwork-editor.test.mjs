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
  state = setSetText(state, set.uid, "de", "name", "  Glanz und Schatten ");
  state = setSetText(state, set.uid, "de", "effect", "");
  state = setPaintingText(state, canvas.uid, "de", "productivity", "Glashütte");
  state = setSetText(state, set.uid, "en", "name", "ignored");
  assert.equal(findSet(state, set.uid).name, set.name, "English is edited with updateSet, not as a translation");

  const exported = exportCatalogTexts(state);
  // The German catalogue already translates every set; this edit renames one and clears its effect.
  assert.deepEqual(exported.de.sets[set.id], { name: "Glanz und Schatten" });
  const otherSets = (catalog) => Object.fromEntries(Object.entries(catalog ?? {}).filter(([id]) => id !== set.id));
  assert.deepEqual(otherSets(exported.de.sets), otherSets(texts.de.sets));
  // The German catalogue already holds names and titles; the edit only changes the productivity.
  assert.deepEqual(exported.de.paintings[canvas.id], { ...texts.de.paintings?.[canvas.id], productivity: "Glashütte" });
  const others = (catalog) => Object.fromEntries(Object.entries(catalog ?? {}).filter(([id]) => id !== canvas.id));
  assert.deepEqual(others(exported.de.paintings), others(texts.de.paintings));
  assert.deepEqual(exported.en, {});
  assert.equal(countCatalogTextChanges(exported, texts), 2);
  const blocks = catalogTextBlocks(exported, texts);
  assert.deepEqual(Object.keys(blocks), ["de"]);
  assert.match(blocks.de, /catalogTexts: \{\n        sets: \{\n          "glory-and-shadow": \{\n            name: "Glanz und Schatten",/);

  const german = localizedSet(PAINTING_SETS[0], exported.de);
  assert.equal(german.name, "Glanz und Schatten");
  assert.equal(german.effect, PAINTING_SETS[0].effect, "an empty translation keeps the English set skill");
  assert.equal(german.paintings[0].productivity, "Glashütte");
  assert.equal(german.paintings[0].name, texts.de.paintings[canvas.id].name);

  const restored = parseDraft(JSON.stringify(state));
  assert.deepEqual(exportCatalogTexts(restored), exported);
  const older = JSON.parse(JSON.stringify(state));
  delete older.sets[0].texts;
  delete older.sets[0].paintings[0].texts;
  assert.deepEqual(parseDraft(JSON.stringify(older)).sets[0].texts, {}, "drafts from before translations still load");
});

test("an uploaded picture and the original title export with the painting", async () => {
  const { exportArtwork, removePaintingImage, setPaintingImage } = await import("../lib/content/artwork-editor.ts");
  const pixel = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
  const monkeys = published.sets.find((set) => set.id === "monkey-society");
  const added = addPainting(published, monkeys.uid, "The Monkey Cook");
  let state = updatePainting(added.state, added.uid, { name: "The Monkey Cook", original: "Monkeys in the Kitchen", artist: "David Teniers the Younger", year: "1645", circa: true });
  state = setPaintingImage(state, added.uid, pixel);
  assert.equal(setPaintingImage(state, added.uid, "data:text/html;base64,AAAA"), state, "only raster pictures are kept");

  const result = exportArtwork(state);
  const row = result.data.sets.find((set) => set.id === "monkey-society").paintings.at(-1);
  assert.equal(row.id, added.state.sets.find((set) => set.uid === monkeys.uid).paintings.at(-1).id);
  assert.deepEqual(
    { original: row.original, artist: row.artist, year: row.year, circa: row.circa, image: row.image },
    { original: "Monkeys in the Kitchen", artist: "David Teniers the Younger", year: "1645", circa: true, image: `${row.id}.webp` },
  );
  assert.deepEqual(result.uploads.map((upload) => upload.file), [`${row.id}.webp`]);
  assert.deepEqual(result.removedFiles, []);
  assert.match(serializePaintingData(result.data), /"original":"Monkeys in the Kitchen","artist":"David Teniers the Younger","year":"1645","circa":true,"image":"[a-z0-9-]+\.webp"\}/);

  // Taking a published picture away lists its file for deletion.
  const swing = published.sets.flatMap((set) => set.paintings).find((canvas) => canvas.id === "the-swing");
  assert.equal(swing.image?.file, "the-swing.webp");
  assert.deepEqual(exportArtwork(removePaintingImage(published, swing.uid)).removedFiles, ["the-swing.webp"]);
});

test("drafts saved before pictures and original titles load with them empty", () => {
  const old = JSON.parse(JSON.stringify(published));
  for (const set of old.sets) {
    for (const canvas of set.paintings) {
      delete canvas.original;
      delete canvas.artist;
      delete canvas.year;
      delete canvas.circa;
      delete canvas.image;
    }
  }
  const parsed = parseDraft(JSON.stringify(old));
  const canvas = parsed.sets[0].paintings[0];
  assert.deepEqual([canvas.original, canvas.artist, canvas.year, canvas.circa, canvas.image], ["", "", "", false, null]);
  const broken = JSON.parse(JSON.stringify(published));
  broken.sets[0].paintings[0].image = { uid: "x", data: "data:text/html;base64,AAAA" };
  assert.equal(parseDraft(JSON.stringify(broken)), null);
});
