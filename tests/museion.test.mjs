import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getDictionary, mapLocales } from "../lib/i18n/index.ts";
import { sectionById } from "../lib/navigation.ts";
import { guideHasSnippetEditor, guideHref, guideLayout } from "../lib/content/guides.ts";
import { heroNamed } from "../lib/content/heroes.ts";
import {
  MUSEION_BUILDINGS,
  MUSEION_DATA,
  MUSEION_OFF_ROSTER,
  MUSEION_STATS,
  museionHeroKnown,
} from "../lib/content/museion.ts";
import {
  PUBLISHED_MUSEION,
  addHero,
  exportMuseion,
  findMuseionProblems,
  removeHero,
  serializeMuseionData,
} from "../lib/content/museion-editor.ts";

test("Museion sits under Buildings and skips the snippet editor", () => {
  const item = sectionById("guides").items.find((entry) => entry.href === "/guides/museion/");
  assert.equal(item?.categoryId, "buildings");
  assert.equal(guideHref("museion"), "/guides/museion/");
  assert.equal(guideHasSnippetEditor("museion"), false);
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    assert.equal(guideLayout(dictionary.guideEntries.museion), "museion", code);
    assert.ok(dictionary.museionEditor.openEditor, code);
  }
});

test("every Museion building has a unique id, known stats, and known heroes", () => {
  const ids = MUSEION_BUILDINGS.map((building) => building.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(MUSEION_BUILDINGS.length, 12);
  for (const building of MUSEION_BUILDINGS) {
    assert.ok(building.name, building.id);
    assert.ok(building.heroes.length > 0, building.id);
    for (const stat of building.stats) {
      assert.ok(MUSEION_STATS.includes(stat), `${building.id}: ${stat}`);
    }
    for (const hero of building.heroes) {
      assert.ok(museionHeroKnown(hero), `${building.id}: unknown hero ${hero}`);
    }
  }
  for (const name of MUSEION_OFF_ROSTER) {
    assert.equal(heroNamed(name), undefined, `${name} should stay off-roster until added`);
  }
  assert.ok(heroNamed("Guan Yu"));
  assert.ok(heroNamed("Lu Bu"));
  assert.ok(heroNamed("Miyamoto Musashi"));
  assert.ok(heroNamed("Yi Sun-sin"));
});

test("an untouched draft exports the published Museion file byte for byte", () => {
  const result = exportMuseion(PUBLISHED_MUSEION);
  const file = readFileSync(new URL("../lib/data/museion.json", import.meta.url), "utf8");
  assert.equal(serializeMuseionData(result), file);
  assert.deepEqual(findMuseionProblems(PUBLISHED_MUSEION), []);
});

test("every Museion building has a display name and translated stats in every language", () => {
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    const guide = dictionary.guideEntries.museion;
    assert.ok(guide.primaryStatLabel, code);
    assert.ok(guide.secondaryStatLabel, code);
    for (const stat of MUSEION_STATS) {
      assert.ok(guide.stats[stat], `${code}: ${stat}`);
    }
    for (const building of MUSEION_BUILDINGS) {
      const name = guide.buildingTexts[building.id]?.name?.trim() || (code === "en" ? building.name : "");
      assert.ok(name, `${code}: missing name for ${building.id}`);
    }
  }
});

test("adding and removing a roster hero round-trips through export", () => {
  const building = PUBLISHED_MUSEION.buildings.find((entry) => entry.id === "theater-of-sophocles");
  assert.ok(building);
  let state = addHero(PUBLISHED_MUSEION, building.uid, "Hermes");
  assert.ok(exportMuseion(state).buildings.find((entry) => entry.id === "theater-of-sophocles")?.heroes.includes("Hermes"));
  state = removeHero(state, building.uid, "Hermes");
  assert.equal(serializeMuseionData(exportMuseion(state)), serializeMuseionData(MUSEION_DATA));
});
