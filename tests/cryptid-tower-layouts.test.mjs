import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { CRYPTID_TOWER_BUILDS } from "../lib/content/cryptid-tower-layouts.ts";
import { COLLECTION_ITEMS } from "../lib/content/collection.ts";
import { CRYPTIDES } from "../lib/content/cryptides.ts";
import { HEROES } from "../lib/content/heroes.ts";
import { getDictionary, LOCALE_CODES } from "../lib/i18n/index.ts";
import { sectionById } from "../lib/navigation.ts";

const file = (path) => new URL(`..${path}`, import.meta.url);
const cryptideIds = new Set(CRYPTIDES.map((cryptide) => cryptide.id));

test("tower recommendations resolve to Core heroes, collections, and Cryptides", () => {
  assert.deepEqual(CRYPTID_TOWER_BUILDS.map((build) => build.id), ["pike", "archer", "shield"]);
  for (const build of CRYPTID_TOWER_BUILDS) {
    assert.ok(cryptideIds.has(build.cryptide), `${build.id} Cryptide`);
    assert.ok(build.key.length && build.important.length, `${build.id} has hero recommendations`);
    for (const id of [...build.key, ...build.important]) {
      const hero = HEROES.find((entry) => entry.id === id);
      assert.ok(hero, `${build.id}: unknown hero ${id}`);
      assert.ok(hero.images[0] && existsSync(file(`/public/heroes/${hero.images[0]}`)), `${id} portrait`);
    }
    assert.equal(build.collections.length, 6, `${build.id} fills all six Collection slots`);
    for (const choices of build.collections) {
      assert.ok(choices.length > 0, `${build.id} has no empty Collection slots`);
      for (const id of choices) {
        const item = COLLECTION_ITEMS.find((entry) => entry.id === id);
        assert.ok(item, `${build.id}: unknown Collection item ${id}`);
        assert.ok(existsSync(file(`/public/collection/${item.image}`)), `${id} image`);
      }
    }
  }
});

test("Cryptid Tower guide has localized copy and a Layouts navigation entry", () => {
  const item = sectionById("guides").items.find((entry) => entry.href === "/guides/cryptid-tower-layout/");
  assert.ok(item);
  assert.equal(item.categoryId, "layouts");
  for (const code of LOCALE_CODES) {
    const guide = getDictionary(code).guideEntries.cryptidTowerLayout;
    assert.ok(guide.towerBuilds.pike.title.trim());
    assert.ok(guide.towerBuilds.archer.title.trim());
    assert.ok(guide.towerBuilds.shield.title.trim());
    assert.ok(guide.levelGuidanceHeading.trim());
    assert.ok(guide.levelGuidanceIntro.trim());
    assert.ok(guide.levelGuidanceEveryHero.includes("100"));
    assert.ok(guide.levelGuidanceUr.includes("200"));
    assert.ok(guide.levelGuidanceSsr.includes("150"));
    assert.ok(guide.levelGuidanceRsSr.includes("120"));
    assert.ok(guide.levelGuidanceNote.trim());
    assert.ok(guide.sourceNote.trim());
    assert.ok(guide.itemAliasNote.includes("Golden Mask") || guide.itemAliasNote.includes("Goldene Maske") || guide.itemAliasNote.includes("Masque d’or"));
  }
});
