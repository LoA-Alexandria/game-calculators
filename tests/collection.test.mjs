import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  COLLECTION_ITEMS,
  COLLECTION_RARITIES,
  collectionImageUrl,
  itemsByRarity,
  localizedItem,
  searchCollection,
} from "../lib/content/collection.ts";
import { guideLayout } from "../lib/content/guides.ts";
import { getDictionary, mapLocales } from "../lib/i18n/index.ts";

const LANGUAGES = mapLocales(getDictionary);

test("every collection picture is a WebP file in public/collection and none is left over", () => {
  const folder = new URL("../public/collection/", import.meta.url);
  const files = readdirSync(folder).filter((file) => !file.startsWith("."));
  const referenced = COLLECTION_ITEMS.flatMap((item) => [item.image, item.skill.icon]);
  assert.equal(new Set(referenced).size, referenced.length, "no file is shared by two items");
  assert.deepEqual([...referenced].sort(), [...files].sort());
  for (const file of files) {
    const head = readFileSync(new URL(file, folder)).subarray(0, 12).toString("latin1");
    assert.ok(file.endsWith(".webp") && head.startsWith("RIFF") && head.endsWith("WEBP"), `${file} is WebP`);
  }
  assert.equal(collectionImageUrl("david.webp"), "/collection/david.webp");
});

test("items have unique ids, a known rarity, a skill level, and text", () => {
  assert.equal(COLLECTION_ITEMS.length, 42);
  assert.equal(new Set(COLLECTION_ITEMS.map((item) => item.id)).size, COLLECTION_ITEMS.length);
  for (const item of COLLECTION_ITEMS) {
    assert.ok(COLLECTION_RARITIES.includes(item.rarity), `${item.id} rarity`);
    assert.ok(Number.isInteger(item.skill.level) && item.skill.level >= 1, `${item.id} skill level`);
    assert.ok(item.name.trim() && item.skill.name.trim() && item.skill.text.trim(), `${item.id} has English text`);
  }
  // Grouped by rarity in the file, the way the guide shows them.
  const order = COLLECTION_ITEMS.map((item) => COLLECTION_RARITIES.indexOf(item.rarity));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.deepEqual([itemsByRarity("UR").length, itemsByRarity("SSR").length, itemsByRarity("SR").length], [18, 12, 12]);
});

test("German and French translate every item, keyed by id, and English stays in the JSON", () => {
  const ids = new Set(COLLECTION_ITEMS.map((item) => item.id));
  assert.deepEqual(LANGUAGES.en.guideEntries.collection.collectionTexts, {});
  for (const code of ["de", "fr"]) {
    const texts = LANGUAGES[code].guideEntries.collection.collectionTexts;
    assert.deepEqual(Object.keys(texts).sort(), [...ids].sort(), `${code} covers every item`);
    for (const [id, entry] of Object.entries(texts)) {
      assert.ok(entry.name && entry.skillName && entry.skillText, `${code}.${id} has name, skill, and effect`);
    }
  }
  const torch = COLLECTION_ITEMS.find((item) => item.id === "prometheus-torch");
  assert.equal(localizedItem(torch, LANGUAGES.de.guideEntries.collection.collectionTexts).name, "Prometheus’ Fackel");
  assert.equal(torch.skill.level, 8);
  // An empty translation falls back to English per field.
  assert.deepEqual(localizedItem(torch, { "prometheus-torch": { name: " " } }), {
    name: "Prometheus’ Torch",
    skillName: "Blessing of the First Flame",
    skillText: torch.skill.text,
  });
});

test("search finds items by name, skill, or effect in the reader's language and in English", () => {
  const german = LANGUAGES.de.guideEntries.collection.collectionTexts;
  assert.deepEqual(searchCollection("fackel", "all", german).map((item) => item.id), ["prometheus-torch"]);
  assert.deepEqual(searchCollection("torch", "all", german).map((item) => item.id), ["prometheus-torch"]);
  assert.deepEqual(searchCollection("otzi", "all", {}).map((item) => item.id), ["otzis-copper-axe"]);
  assert.ok(searchCollection("heilung", "SR", german).some((item) => item.id === "decameron-manuscript"));
  // "Heilungseffekt" only appears in the Creation of Adam among the SSR items.
  assert.deepEqual(searchCollection("heilung", "SSR", german).map((item) => item.id), ["the-creation-of-adam"]);
  assert.equal(searchCollection("zzz", "SSR", german).length, 0);
  const ur = searchCollection("", "UR", german);
  assert.equal(ur.length, 18);
  assert.ok(ur.some((item) => item.id === "aeolus-bag-of-winds"));
  assert.ok(ur.some((item) => item.id === "golden-throne"));
  assert.ok(ur.some((item) => item.id === "napoleons-bicorne"));
});

test("the Collection guide uses its own layout", () => {
  for (const dictionary of Object.values(LANGUAGES)) {
    assert.equal(guideLayout(dictionary.guideEntries.collection), "collection");
  }
});
