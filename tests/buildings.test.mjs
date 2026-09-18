import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { getDictionary, mapLocales } from "../lib/i18n/index.ts";
import { sectionById } from "../lib/navigation.ts";
import { guideHasSnippetEditor, guideHref, guideLayout } from "../lib/content/guides.ts";
import {
  BUILDING_CATEGORIES,
  BUILDINGS,
  PRODUCTION_GROUPS,
  PRODUCTION_RESOURCES,
  PRODUCTION_TAGS,
  allBuildings,
  productionBuildings,
} from "../lib/content/buildings.ts";
import {
  PUBLISHED_BUILDINGS,
  addBuilding,
  exportBuildings,
  findBuildingProblems,
  removeBuilding,
  serializeBuildingsData,
} from "../lib/content/buildings-editor.ts";

test("Buildings sits under Core elements and skips the snippet editor", () => {
  const item = sectionById("guides").items.find((entry) => entry.href === "/guides/buildings/");
  assert.equal(item?.categoryId, "coreElements");
  assert.equal(guideHref("buildings"), "/guides/buildings/");
  assert.equal(guideHasSnippetEditor("buildings"), false);
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    assert.equal(guideLayout(dictionary.guideEntries.buildings), "buildings", code);
    assert.ok(dictionary.buildingsEditor.openEditor, code);
  }
});

test("the roster covers population, production, and military from the wiki", () => {
  assert.equal(BUILDINGS.length, 37);
  assert.equal(BUILDINGS.filter((building) => building.category === "population").length, 9);
  assert.equal(BUILDINGS.filter((building) => building.category === "production").length, 20);
  assert.equal(BUILDINGS.filter((building) => building.category === "military").length, 8);
  assert.ok(BUILDINGS.some((building) => building.id === "spice-workshop"));
  assert.ok(BUILDINGS.some((building) => building.id === "coal-plant"));
  assert.ok(BUILDINGS.some((building) => building.id === "precision-parts-plant"));
  assert.ok(BUILDINGS.some((building) => building.id === "oil-plant"));
  assert.ok(BUILDINGS.some((building) => building.id === "communications-bureau"));
  assert.ok(BUILDINGS.some((building) => building.id === "tent"));
  assert.ok(BUILDINGS.some((building) => building.id === "pikeman-barracks"));
});

test("every building has known fields, and production rows keep Discord resources", () => {
  const ids = allBuildings().map((building) => building.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const building of BUILDINGS) {
    assert.ok(BUILDING_CATEGORIES.includes(building.category), building.id);
    assert.ok((building.levelMax ?? 0) >= 1, building.id);
    if (building.category !== "production") continue;
    assert.ok(PRODUCTION_GROUPS.includes(building.group), `${building.id}: ${building.group}`);
    assert.ok(PRODUCTION_RESOURCES.includes(building.produces), `${building.id}: ${building.produces}`);
    assert.ok(building.requires?.length, building.id);
    for (const resource of building.requires ?? []) {
      assert.ok(PRODUCTION_RESOURCES.includes(resource), `${building.id}: ${resource}`);
    }
    for (const tag of building.tags ?? []) {
      assert.ok(PRODUCTION_TAGS.includes(tag), `${building.id}: ${tag}`);
    }
    assert.ok((building.priority ?? 0) >= 0 && (building.priority ?? 0) <= 3, building.id);
  }
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    const guide = dictionary.guideEntries.buildings;
    for (const resource of PRODUCTION_RESOURCES) assert.ok(guide.resources[resource], `${code}:${resource}`);
    for (const tag of PRODUCTION_TAGS) assert.ok(guide.tags[tag], `${code}:${tag}`);
    for (const group of PRODUCTION_GROUPS) assert.ok(guide.groups[group], `${code}:${group}`);
    for (const category of BUILDING_CATEGORIES) assert.ok(guide.categories[category], `${code}:${category}`);
    for (const building of allBuildings()) {
      const name = guide.buildingTexts[building.id]?.name?.trim() || (code === "en" ? building.name : "");
      assert.ok(name, `${code}: missing name for ${building.id}`);
    }
  }
});

test("listed building pictures exist and none are orphaned under public/buildings", () => {
  const buildingsRoot = new URL("../public/buildings/", import.meta.url);
  const productionRoot = new URL("../public/production-buildings/", import.meta.url);
  for (const building of BUILDINGS) {
    assert.ok(building.image, building.id);
    const path = building.image.startsWith("production-buildings/")
      ? new URL(building.image.slice("production-buildings/".length), productionRoot)
      : new URL(building.image.slice("buildings/".length), buildingsRoot);
    assert.ok(existsSync(path), building.image);
    const head = readFileSync(path).subarray(0, 12).toString("latin1");
    assert.ok(head.startsWith("RIFF") && head.endsWith("WEBP"), building.image);
  }
  const listedBuildings = BUILDINGS.map((building) => building.image)
    .filter((image) => image?.startsWith("buildings/"))
    .map((image) => image.slice("buildings/".length))
    .sort();
  const files = readdirSync(buildingsRoot).filter((name) => name.endsWith(".webp")).sort();
  assert.deepEqual(files, listedBuildings);
});

test("an untouched draft exports the published buildings file byte for byte", () => {
  const exported = serializeBuildingsData(exportBuildings(PUBLISHED_BUILDINGS));
  const published = readFileSync(new URL("../lib/data/buildings.json", import.meta.url), "utf8");
  assert.equal(exported, published);
  assert.equal(findBuildingProblems(PUBLISHED_BUILDINGS).length, 0);
});

test("adding and removing a building round-trips through export", () => {
  const added = addBuilding(PUBLISHED_BUILDINGS, "military");
  assert.equal(added.state.buildings.length, PUBLISHED_BUILDINGS.buildings.length + 1);
  const removed = removeBuilding(added.state, added.uid);
  assert.equal(removed.buildings.length, PUBLISHED_BUILDINGS.buildings.length);
  assert.equal(productionBuildings().length, 20);
});
