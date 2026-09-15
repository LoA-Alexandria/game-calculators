import assert from "node:assert/strict";
import test from "node:test";

import { GODDESSES } from "../lib/content/goddesses.ts";
import { HEROES, searchHeroes } from "../lib/content/heroes.ts";
import {
  GODDESS_SKIN_GROUPS,
  GODDESS_SKINS,
  HERO_SKIN_GROUPS,
  HERO_SKINS,
  isGoddessSkinGroup,
  isHeroSkinGroup,
  localizedSkin,
  skinSearchText,
  skinsFor,
} from "../lib/content/skins.ts";
import { getDictionary, mapLocales } from "../lib/i18n/index.ts";

const LANGUAGES = mapLocales(getDictionary);
const heroNames = new Set(HEROES.map((hero) => hero.name));
const goddessNames = new Set(GODDESSES.map((goddess) => goddess.name));

test("every hero skin names a roster hero and a group the dictionary has", () => {
  const ids = HERO_SKINS.map((skin) => skin.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const skin of HERO_SKINS) {
    assert.ok(heroNames.has(skin.owner), `${skin.id} names ${skin.owner}`);
    assert.ok(isHeroSkinGroup(skin.group), `${skin.id} uses a known group`);
    assert.ok(skin.name.trim() && skin.obtain.trim(), `${skin.id} has a name and a source`);
    assert.ok(!(skin.missable && skin.unconfirmed), `${skin.id} carries one mark at most`);
  }
  for (const [code, dictionary] of Object.entries(LANGUAGES)) {
    for (const group of HERO_SKIN_GROUPS) {
      assert.ok(dictionary.guideEntries.heroes.skinGroups[group]?.title, `${code} ${group}`);
    }
  }
  // Autumn's Epoch Pass and Grail lists, 7 August 2026.
  assert.equal(skinsFor(HERO_SKINS, "Joan of Arc").length, 2);
  assert.equal(skinsFor(HERO_SKINS, "Merlin")[0]?.name, "The Boy And The Dragon");
  assert.equal(HERO_SKINS.find((skin) => skin.id === "michelangelo-delivery-service")?.missable, true);
  assert.equal(HERO_SKINS.find((skin) => skin.id === "napoleon-bonaparte-empire-on-the-march")?.unconfirmed, true);
});

test("every goddess skin names a roster goddess and a group the dictionary has", () => {
  const ids = GODDESS_SKINS.map((skin) => skin.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const skin of GODDESS_SKINS) {
    assert.ok(goddessNames.has(skin.owner), `${skin.id} names ${skin.owner}`);
    assert.ok(isGoddessSkinGroup(skin.group), `${skin.id} uses a known group`);
    assert.ok(skin.name.trim() && skin.obtain.trim(), `${skin.id} has a name and a source`);
    assert.ok(!(skin.missable && skin.unconfirmed), `${skin.id} carries one mark at most`);
  }
  for (const [code, dictionary] of Object.entries(LANGUAGES)) {
    for (const group of GODDESS_SKIN_GROUPS) {
      assert.ok(dictionary.guideEntries.goddesses.skinGroups[group]?.title, `${code} ${group}`);
    }
  }
  assert.equal(GODDESS_SKINS.filter((skin) => skin.missable).length, 7);
  assert.equal(skinsFor(GODDESS_SKINS, "Venus")[0]?.name, "GOAL");
  assert.equal(skinsFor(GODDESS_SKINS, "Lady Liberty").length, 0, "SSR goddesses have no skins in this list");
});

test("a skin a language has not translated yet keeps the English name and obtain", () => {
  const carousel = skinsFor(HERO_SKINS, "Joan of Arc").find((skin) => skin.id === "joan-of-arc-carousel");
  assert.ok(carousel);
  assert.equal(localizedSkin(carousel, {}).name, "Carousel");
  assert.equal(localizedSkin(carousel, { "joan-of-arc-carousel": { name: "Karussell", obtain: "Epoch Pass, endet an Tag 14." } }).obtain, "Epoch Pass, endet an Tag 14.");
  assert.match(skinSearchText("Joan of Arc", HERO_SKINS, [{ "joan-of-arc-carousel": { name: "Karussell" } }]), /Karussell/);
  assert.match(skinSearchText("Joan of Arc", HERO_SKINS), /We are the Champions/);
  assert.equal(
    searchHeroes("Carousel", "all", [], (hero) => skinSearchText(hero.name, HERO_SKINS)).some((hero) => hero.id === "joan-of-arc"),
    true,
  );
});

test("published dictionaries key skinTexts to a skin that exists", () => {
  for (const [code, dictionary] of Object.entries(LANGUAGES)) {
    const heroIds = new Set(HERO_SKINS.map((skin) => skin.id));
    const goddessIds = new Set(GODDESS_SKINS.map((skin) => skin.id));
    for (const id of Object.keys(dictionary.guideEntries.heroes.skinTexts)) {
      assert.ok(heroIds.has(id), `${code} heroes.skinTexts.${id}`);
    }
    for (const id of Object.keys(dictionary.guideEntries.goddesses.skinTexts)) {
      assert.ok(goddessIds.has(id), `${code} goddesses.skinTexts.${id}`);
    }
  }
});
