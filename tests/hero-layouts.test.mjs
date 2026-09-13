import assert from "node:assert/strict";
import test from "node:test";

import en from "../lib/i18n/dictionaries/en.ts";
import de from "../lib/i18n/dictionaries/de.ts";
import fr from "../lib/i18n/dictionaries/fr.ts";
import {
  BUILD_ZONES,
  COLLECTION_ITEMS,
  FORMATION_COLUMNS,
  FORMATION_SLOTS,
  LAYOUT_DATA,
  layoutTexts,
  slotWeight,
} from "../lib/content/hero-layouts.ts";

const LANGUAGES = { en, de, fr };
const allPicks = [
  ...LAYOUT_DATA.builds.flatMap((build) => [...BUILD_ZONES.flatMap((zone) => build[zone]), ...build.counters.flatMap((counter) => counter.picks)]),
  ...LAYOUT_DATA.utility.flatMap((role) => role.groups.flatMap((group) => group.picks)),
];

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

test("every key the layout data uses has text in every language, and no text is orphaned", () => {
  for (const [code, dictionary] of Object.entries(LANGUAGES)) {
    const texts = layoutTexts(dictionary.guideEntries.heroLayouts);
    assert.deepEqual(Object.keys(texts.buildTexts), LAYOUT_DATA.builds.map((build) => build.id), `${code} build texts`);
    assert.deepEqual(
      Object.keys(texts.counterLabels).sort(),
      LAYOUT_DATA.builds.flatMap((build) => build.counters.map((counter) => counter.id)).sort(),
      `${code} counter labels`,
    );
    assert.deepEqual(Object.keys(texts.roleNames), LAYOUT_DATA.utility.map((role) => role.id), `${code} role names`);
    assert.deepEqual(
      Object.keys(texts.groupLabels).sort(),
      LAYOUT_DATA.utility.flatMap((role) => role.groups.map((group) => group.id)).sort(),
      `${code} group labels`,
    );
    for (const pick of allPicks) {
      if (pick.note) assert.equal(typeof texts.pickNotes[pick.note], "string", `${code} note ${pick.note}`);
    }
    for (const build of LAYOUT_DATA.builds) assert.notEqual(texts.buildTexts[build.id].name.trim(), "", `${code} ${build.id} name`);
  }
  const en0 = layoutTexts(en.guideEntries.heroLayouts);
  for (const dictionary of [de, fr]) {
    const other = layoutTexts(dictionary.guideEntries.heroLayouts);
    for (const build of LAYOUT_DATA.builds) {
      for (const field of ["pros", "cons", "notes"]) {
        assert.equal(other.buildTexts[build.id][field].length, en0.buildTexts[build.id][field].length, `${build.id}.${field} lines line up`);
      }
    }
  }
});

test("every best-collection pick is styled as a Collection item", () => {
  for (const build of LAYOUT_DATA.builds) {
    for (const pick of build.collection) {
      assert.equal(COLLECTION_ITEMS.has(pick.hero), true, `${pick.hero} in ${build.id}`);
    }
  }
});

test("the water supply, hero layout, and artwork guides share the Layouts category", () => {
  for (const dictionary of Object.values(LANGUAGES)) {
    assert.equal(typeof dictionary.guideCategories.layouts, "string");
    assert.equal("cityLayout" in dictionary.guideCategories, false);
  }
});
