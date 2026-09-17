import assert from "node:assert/strict";
import test from "node:test";

import {
  COLLECTION_AGES,
  COLLECTION_LAYOUTS_DATA,
  COLLECTION_LAYOUT_TAGS,
  layoutItem,
  localizedOptionNote,
  localizedSetup,
  optionForItem,
  optionsForAge,
} from "../lib/content/collection-layouts.ts";
import { COLLECTION_ITEMS } from "../lib/content/collection.ts";
import { guideLayout } from "../lib/content/guides.ts";
import { getDictionary, mapLocales } from "../lib/i18n/index.ts";

const LANGUAGES = mapLocales(getDictionary);
const KNOWN = new Set(COLLECTION_ITEMS.map((item) => item.id));

test("every age has its options, each collection once, with a known tag", () => {
  const items = COLLECTION_LAYOUTS_DATA.options.map((option) => option.item);
  assert.equal(new Set(items).size, items.length, "a collection is listed once");
  for (const age of COLLECTION_AGES) {
    assert.ok(optionsForAge(age).length >= 1, `${age} has options`);
  }
  for (const option of COLLECTION_LAYOUTS_DATA.options) {
    assert.ok(COLLECTION_AGES.includes(option.age), `${option.item} age`);
    assert.ok(option.name.trim() && option.note.trim(), `${option.item} has a name and a note`);
    for (const tag of option.tags) assert.ok(COLLECTION_LAYOUT_TAGS.includes(tag), `${option.item}: ${tag}`);
  }
});

test("every setup fills all six slots with a collection the options list knows", () => {
  assert.ok(COLLECTION_LAYOUTS_DATA.setups.length >= 3);
  const ids = new Set(COLLECTION_LAYOUTS_DATA.setups.map((setup) => setup.id));
  assert.equal(ids.size, COLLECTION_LAYOUTS_DATA.setups.length, "setup ids are unique");
  for (const setup of COLLECTION_LAYOUTS_DATA.setups) {
    assert.ok(setup.credit.trim() && setup.title.trim(), `${setup.id} has a credit and a title`);
    for (const tag of setup.tags) assert.ok(COLLECTION_LAYOUT_TAGS.includes(tag), `${setup.id}: ${tag}`);
    for (const age of COLLECTION_AGES) {
      const item = setup.slots[age];
      assert.ok(item, `${setup.id}: ${age} slot is filled`);
      const option = optionForItem(item);
      assert.ok(option, `${setup.id}: ${item} is in the options list`);
      assert.equal(option.age, age, `${setup.id}: ${item} belongs to ${age}`);
    }
  }
  // Boah's all-round row, as published on Discord.
  const boah = COLLECTION_LAYOUTS_DATA.setups.find((setup) => setup.id === "boah-all-round");
  assert.deepEqual(COLLECTION_AGES.map((age) => boah.slots[age]), [
    "model-of-noahs-ark",
    "flintstone-pedal-car",
    "golden-mask-of-agamemnon",
    "olympia-olive-wreath",
    "holy-hand-grenade",
    "the-creation-of-adam",
  ]);
});

test("pictures come from the Collection guide, and a missing collection still shows its name", () => {
  const known = COLLECTION_LAYOUTS_DATA.options.filter((option) => KNOWN.has(option.item));
  assert.ok(known.length >= 18, "most collections already have a picture");
  const torch = layoutItem("prometheus-torch", "fallback", LANGUAGES.de.guideEntries.collection.collectionTexts);
  assert.equal(torch.known, true);
  assert.equal(torch.name, "Prometheus’ Fackel");
  assert.match(torch.image, /prometheus-torch\.webp/);
  const pending = layoutItem("not-collected-yet", "Wings of Icarus", {});
  assert.deepEqual(pending, { id: "not-collected-yet", name: "Wings of Icarus", image: null, rarity: null, known: false });
});

test("German and French translate every setup and collection note, keyed by id", () => {
  const setupIds = new Set(COLLECTION_LAYOUTS_DATA.setups.map((setup) => setup.id));
  const itemIds = new Set(COLLECTION_LAYOUTS_DATA.options.map((option) => option.item));
  assert.deepEqual(LANGUAGES.en.guideEntries.collectionLayouts.setupTexts, {});
  assert.deepEqual(LANGUAGES.en.guideEntries.collectionLayouts.optionTexts, {});
  for (const code of ["de", "fr"]) {
    const entry = LANGUAGES[code].guideEntries.collectionLayouts;
    assert.deepEqual(Object.keys(entry.setupTexts).sort(), [...setupIds].sort(), `${code} setups`);
    assert.deepEqual(Object.keys(entry.optionTexts).sort(), [...itemIds].sort(), `${code} options`);
    for (const setup of COLLECTION_LAYOUTS_DATA.setups) {
      const text = entry.setupTexts[setup.id];
      assert.ok(text.title && text.lede, `${code}.${setup.id}`);
      assert.equal(text.notes?.length ?? 0, setup.notes.length, `${code}.${setup.id} notes line up`);
    }
  }
  const german = LANGUAGES.de.guideEntries.collectionLayouts;
  assert.equal(localizedSetup(COLLECTION_LAYOUTS_DATA.setups[0], german.setupTexts).title, "Allround-Setup");
  assert.equal(localizedSetup(COLLECTION_LAYOUTS_DATA.setups[0], {}).title, "All-round setup");
  const torch = COLLECTION_LAYOUTS_DATA.options[0];
  assert.match(localizedOptionNote(torch, german.optionTexts), /Buff auf ANG/);
  assert.equal(localizedOptionNote(torch, { [torch.item]: { note: " " } }), torch.note);
});

test("the guide uses its own layout and its ages are named in every language", () => {
  for (const [code, dictionary] of Object.entries(LANGUAGES)) {
    assert.equal(guideLayout(dictionary.guideEntries.collectionLayouts), "collectionLayouts");
    for (const age of COLLECTION_AGES) {
      assert.ok(dictionary.guideEntries.collectionLayouts.ages[age]?.trim(), `${code}: ${age}`);
    }
    for (const tag of COLLECTION_LAYOUT_TAGS) {
      assert.ok(dictionary.guideEntries.collectionLayouts.tags[tag]?.trim(), `${code}: ${tag}`);
    }
  }
});
