import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { getDictionary, mapLocales } from "../lib/i18n/index.ts";
import { sectionById } from "../lib/navigation.ts";
import { guideHasSnippetEditor, guideHref, guideLayout } from "../lib/content/guides.ts";
import {
  PRODUCTION_BUILDINGS_DATA,
  PRODUCTION_GROUPS,
  PRODUCTION_RESOURCES,
  PRODUCTION_TAGS,
  allProductionBuildings,
} from "../lib/content/production-buildings.ts";
import {
  PUBLISHED_PRODUCTION,
  addBuilding,
  exportProductionBuildings,
  findProductionProblems,
  removeBuilding,
  serializeProductionData,
} from "../lib/content/production-buildings-editor.ts";

test("Production buildings sits under Core elements and skips the snippet editor", () => {
  const item = sectionById("guides").items.find((entry) => entry.href === "/guides/production-buildings/");
  assert.equal(item?.categoryId, "coreElements");
  assert.equal(guideHref("productionBuildings"), "/guides/production-buildings/");
  assert.equal(guideHasSnippetEditor("productionBuildings"), false);
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    assert.equal(guideLayout(dictionary.guideEntries.productionBuildings), "productionBuildings", code);
    assert.ok(dictionary.productionBuildingsEditor.openEditor, code);
  }
});

test("every production building has known resources, tags, and a name in every language", () => {
  const ids = allProductionBuildings().map((building) => building.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 17);
  for (const group of PRODUCTION_BUILDINGS_DATA.groups) {
    assert.ok(PRODUCTION_GROUPS.includes(group.id), group.id);
    for (const building of group.buildings) {
      assert.ok(PRODUCTION_RESOURCES.includes(building.produces), `${building.id}: ${building.produces}`);
      assert.ok(building.requires.length > 0, building.id);
      for (const resource of building.requires) {
        assert.ok(PRODUCTION_RESOURCES.includes(resource), `${building.id}: ${resource}`);
      }
      for (const tag of building.tags) {
        assert.ok(PRODUCTION_TAGS.includes(tag), `${building.id}: ${tag}`);
      }
      assert.ok(building.priority >= 0 && building.priority <= 3, building.id);
    }
  }
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    const guide = dictionary.guideEntries.productionBuildings;
    for (const resource of PRODUCTION_RESOURCES) assert.ok(guide.resources[resource], `${code}:${resource}`);
    for (const tag of PRODUCTION_TAGS) assert.ok(guide.tags[tag], `${code}:${tag}`);
    for (const group of PRODUCTION_GROUPS) assert.ok(guide.groups[group], `${code}:${group}`);
    for (const building of allProductionBuildings()) {
      const name = guide.buildingTexts[building.id]?.name?.trim() || (code === "en" ? building.name : "");
      assert.ok(name, `${code}: missing name for ${building.id}`);
    }
  }
});

test("listed production building pictures exist under public/production-buildings/", () => {
  const root = new URL("../public/production-buildings/", import.meta.url);
  for (const building of allProductionBuildings()) {
    if (!building.image) continue;
    const path = new URL(building.image, root);
    assert.ok(existsSync(path), building.image);
  }
  const files = readdirSync(root).filter((name) => name.endsWith(".webp")).sort();
  const listed = allProductionBuildings()
    .map((building) => building.image)
    .filter(Boolean)
    .sort();
  assert.deepEqual(files, listed);
});

test("an untouched draft exports the published production buildings file byte for byte", () => {
  const result = exportProductionBuildings(PUBLISHED_PRODUCTION);
  const file = readFileSync(new URL("../lib/data/production-buildings.json", import.meta.url), "utf8");
  assert.equal(serializeProductionData(result), file);
  assert.deepEqual(findProductionProblems(PUBLISHED_PRODUCTION), []);
});

test("adding and removing a building round-trips through export", () => {
  const result = addBuilding(PUBLISHED_PRODUCTION, "steam");
  let state = result.state;
  state = {
    ...state,
    buildings: state.buildings.map((building) =>
      building.uid === result.uid
        ? { ...building, name: { ...building.name, en: "Test Plant" }, id: "test-plant" }
        : building,
    ),
  };
  assert.ok(exportProductionBuildings(state).groups.some((group) => group.buildings.some((b) => b.id === "test-plant")));
  state = removeBuilding(state, result.uid);
  assert.equal(serializeProductionData(exportProductionBuildings(state)), serializeProductionData(PRODUCTION_BUILDINGS_DATA));
});
