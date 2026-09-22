import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getDictionary, mapLocales } from "../lib/i18n/index.ts";
import { sectionById } from "../lib/navigation.ts";
import { guideHasSnippetEditor, guideHref, guideLayout } from "../lib/content/guides.ts";
import { heroNamed } from "../lib/content/heroes.ts";
import {
  FOCUS_BANDS,
  LEVELING_BUILDS,
  LEVELING_DATA,
  focusHeroes,
} from "../lib/content/hero-leveling.ts";
import {
  PUBLISHED_LEVELING,
  addFocusHero,
  exportLeveling,
  findLevelingProblems,
  removeFocusHero,
  serializeLevelingData,
} from "../lib/content/hero-leveling-editor.ts";

test("Hero leveling sits under Tips and skips the snippet editor", () => {
  const item = sectionById("guides").items.find((entry) => entry.href === "/guides/hero-leveling/");
  assert.equal(item?.categoryId, "tips");
  assert.equal(guideHref("heroLeveling"), "/guides/hero-leveling/");
  assert.equal(guideHasSnippetEditor("heroLeveling"), false);
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    assert.equal(guideLayout(dictionary.guideEntries.heroLeveling), "heroLeveling", code);
    assert.ok(dictionary.levelingEditor.openEditor, code);
  }
});

test("every published focus and fragment hero is on the Heroes roster", () => {
  assert.equal(LEVELING_DATA.defaultBuild, "crit");
  assert.deepEqual(
    LEVELING_DATA.builds.map((build) => build.id).sort(),
    [...LEVELING_BUILDS].sort(),
  );
  for (const build of LEVELING_DATA.builds) {
    for (const band of build.bands) {
      assert.ok(FOCUS_BANDS.includes(band.id), `${build.id}: ${band.id}`);
      for (const hero of band.heroes) {
        assert.ok(heroNamed(hero), `${build.id}: unknown hero ${hero}`);
      }
    }
    for (const rule of build.fragments) {
      if (rule.kind === "unlocks") continue;
      if (rule.kind === "splitEvenWhenUr") {
        for (const hero of rule.heroes) assert.ok(heroNamed(hero), `${build.id}: ${hero}`);
        continue;
      }
      assert.ok(heroNamed(rule.hero), `${build.id}: ${rule.hero}`);
    }
  }
  const crit = LEVELING_DATA.builds.find((build) => build.id === "crit");
  assert.ok(crit);
  assert.deepEqual(focusHeroes(crit).slice(0, 4), [
    "Joan of Arc",
    "Achilles",
    "Tutankhamun",
    "Blackbeard",
  ]);
});

test("an untouched draft exports the published leveling file byte for byte", () => {
  const result = exportLeveling(PUBLISHED_LEVELING);
  const file = readFileSync(new URL("../lib/data/hero-leveling.json", import.meta.url), "utf8");
  assert.equal(serializeLevelingData(result), file);
  assert.deepEqual(findLevelingProblems(PUBLISHED_LEVELING), []);
});

test("adding and removing a focus hero on DoT round-trips through export", () => {
  const build = PUBLISHED_LEVELING.builds.find((entry) => entry.id === "dot");
  assert.ok(build);
  let state = addFocusHero(PUBLISHED_LEVELING, "dot", "Hermes");
  assert.ok(exportLeveling(state).builds.find((entry) => entry.id === "dot")?.bands.some((band) => band.heroes.includes("Hermes")));
  const uid = state.builds.find((entry) => entry.id === "dot")?.focus.find((entry) => entry.hero === "Hermes")?.uid;
  assert.ok(uid);
  state = removeFocusHero(state, "dot", uid);
  assert.equal(serializeLevelingData(exportLeveling(state)), serializeLevelingData(LEVELING_DATA));
});
