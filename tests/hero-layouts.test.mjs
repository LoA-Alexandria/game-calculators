import assert from "node:assert/strict";
import test from "node:test";

import en from "../lib/i18n/dictionaries/en.ts";
import de from "../lib/i18n/dictionaries/de.ts";
import fr from "../lib/i18n/dictionaries/fr.ts";
import {
  COLLECTION_ITEMS,
  FORMATION_COLUMNS,
  FORMATION_SLOTS,
  pickName,
  slotWeight,
} from "../lib/content/hero-layouts.ts";

const LANGUAGES = { en, de, fr };

/** Everything that must match the English names, with the translated labels stripped. */
function names(guide) {
  return {
    builds: guide.builds.map((build) => ({
      id: build.id,
      key: build.key.map(pickName),
      important: build.important.map(pickName),
      other: build.other.map(pickName),
      collection: build.collection.map(pickName),
      counters: build.counters.map((counter) => counter.picks.map(pickName)),
    })),
    utility: guide.utility.map((role) => role.groups.map((group) => group.picks.map(pickName))),
  };
}

test("the formation board numbers every slot exactly once", () => {
  const slots = Object.values(FORMATION_COLUMNS).flat().filter((slot) => slot !== 0);
  assert.equal(slots.length, FORMATION_SLOTS);
  assert.deepEqual([...slots].sort((a, b) => a - b), Array.from({ length: FORMATION_SLOTS }, (_, i) => i + 1));
  assert.equal(FORMATION_COLUMNS.front.includes(1), true, "slot 1 sits in the frontline");
});

test("slot weight runs from the last hero to fall to the first", () => {
  assert.equal(slotWeight(1), 0);
  assert.equal(slotWeight(FORMATION_SLOTS), 1);
  assert.equal(slotWeight(13), 0.5);
  assert.equal(slotWeight(0), 1);
  assert.equal(slotWeight(Number.NaN), 1);
});

test("hero and Collection names are identical in every language", () => {
  const reference = names(en.guideEntries.heroLayouts);
  for (const [code, dictionary] of Object.entries(LANGUAGES)) {
    assert.deepEqual(names(dictionary.guideEntries.heroLayouts), reference, `${code} differs from en`);
  }
});

test("every best-collection pick is styled as a Collection item", () => {
  for (const build of en.guideEntries.heroLayouts.builds) {
    for (const pick of build.collection) {
      assert.equal(COLLECTION_ITEMS.has(pickName(pick)), true, `${pickName(pick)} in ${build.id}`);
    }
  }
});

test("the water supply, hero layout, and artwork guides share the Layouts category", () => {
  for (const dictionary of Object.values(LANGUAGES)) {
    assert.equal(typeof dictionary.guideCategories.layouts, "string");
    assert.equal("cityLayout" in dictionary.guideCategories, false);
  }
});
