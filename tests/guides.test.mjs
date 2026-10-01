import assert from "node:assert/strict";
import test from "node:test";

import { getDictionary, mapLocales } from "../lib/i18n/index.ts";
import en from "../lib/i18n/dictionaries/en.ts";
import { sectionById } from "../lib/navigation.ts";
import {
  camelToKebab,
  guideHref,
  guideIdFromHref,
  guideHasSnippetEditor,
  guideLayout,
  isGuideEntryId,
  kebabToCamel,
} from "../lib/content/guides.ts";

test("converts guide slugs and dictionary ids both ways", () => {
  assert.equal(kebabToCamel("hero-layouts"), "heroLayouts");
  assert.equal(camelToKebab("heroLayouts"), "hero-layouts");
  assert.equal(guideHref("heroLayouts"), "/guides/hero-layouts/");
  assert.equal(guideHref("goddesses"), "/guides/goddesses/");
  assert.equal(guideHref("artwork"), "/guides/artwork/");
  assert.equal(guideHref("artworkLayouts"), "/guides/artwork-layouts/");
  assert.equal(guideHref("heroes"), "/guides/heroes/");
  assert.equal(guideHref("goddessTheater"), "/guides/goddess-theater/");
  assert.equal(guideHref("heroCollectionDestiny"), "/guides/hero-collection-destiny/");
  assert.equal(guideIdFromHref("/guides/hero-layouts/"), "heroLayouts");
  assert.equal(guideIdFromHref("/guides/goddesses/"), "goddesses");
  assert.equal(guideIdFromHref("/guides/artwork/"), "artwork");
  assert.equal(guideIdFromHref("/guides/artwork-layouts/"), "artworkLayouts");
  assert.equal(guideIdFromHref("/guides/heroes/"), "heroes");
  assert.equal(guideIdFromHref("/guides/goddess-theater/"), "goddessTheater");
  assert.equal(guideIdFromHref("/guides/new/"), null);
});

test("every published guide has a dictionary entry", () => {
  for (const item of sectionById("guides").items) {
    const id = guideIdFromHref(item.href);
    assert.ok(id, `no id for ${item.href}`);
    assert.equal(isGuideEntryId(id, en.guideEntries), true);
  }
});

test("structured ranking guides skip the snippet Edit / Remove", () => {
  assert.equal(guideHasSnippetEditor("artworkLayouts"), false);
  assert.equal(guideHasSnippetEditor("heroTierList"), false);
  assert.equal(guideHasSnippetEditor("heroLayouts"), false);
  assert.equal(guideHasSnippetEditor("artwork"), false);
  assert.equal(guideHasSnippetEditor("heroes"), false);
  assert.equal(guideHasSnippetEditor("goddessTheater"), false);
  assert.equal(guideHasSnippetEditor("serverAgeUnlocks"), false);
  assert.equal(guideHasSnippetEditor("eventOrderRotation"), false);
  assert.equal(guideHasSnippetEditor("eventTitles"), false);
  assert.equal(guideHasSnippetEditor("museion"), false);
  assert.equal(guideHasSnippetEditor("heroLeveling"), false);
  assert.equal(guideHasSnippetEditor("buildings"), false);
  assert.equal(guideHasSnippetEditor("cryptides"), false);
  assert.equal(guideHasSnippetEditor("goddesses"), false);
  assert.equal(guideHasSnippetEditor("goddessLeveling"), false);
  assert.equal(guideHasSnippetEditor("collection"), false);
  assert.equal(guideHasSnippetEditor("collectionLayouts"), false);
  assert.equal(guideHasSnippetEditor("adsBuy"), false);
});

test("artwork layouts levels SSR ATK first", () => {
  const { levels, note, buildNames } = en.guideEntries.artworkLayouts;
  assert.equal(levels[0]?.rarity, "SSR");
  assert.equal(levels[0]?.stat, "ATK");
  assert.equal(Object.keys(buildNames).join(), "crit,pursuit,dot,hybrid");
  assert.equal(note, "");
});

test("Hero / Collection Destiny keeps its rotation and milestone guide complete in every locale", () => {
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    const guide = dictionary.guideEntries.heroCollectionDestiny;
    assert.equal(guide.cycleEvents.length, 4, `${code}: four Destiny events`);
    assert.equal(guide.ageBands.length, 2, `${code}: both server-age rebate cases`);
    assert.equal(guide.saveRules.length, 4, `${code}: all saving thresholds`);
    assert.equal(guide.milestones.length, 9, `${code}: complete milestone ladder`);
    assert.equal(guide.heroRewards.length, 7, `${code}: Hero Destiny rewards`);
    assert.equal(guide.collectionRewards.length, 6, `${code}: Collection Destiny rewards`);
    assert.match(guide.note, /Autumn/i, `${code}: source attribution`);
  }
});

test("each guide entry is claimed by exactly the renderer it was written for", () => {
  const custom = {
    goddesses: "goddesses",
    artwork: "artwork",
    artworkLayouts: "artworkLayouts",
    heroLayouts: "heroLayouts",
    heroes: "heroes",
    heroTierList: "heroTierList",
    goddessTheater: "goddessTheater",
    heroLinking: "heroLinking",
    anecdotes: "anecdotes",
    serverAgeUnlocks: "serverAgeUnlocks",
    eventOrderRotation: "eventOrderRotation",
    eventTitles: "eventTitles",
    heroCollectionDestiny: "heroCollectionDestiny",
    museion: "museion",
    heroLeveling: "heroLeveling",
    buildings: "buildings",
    cryptides: "cryptides",
    goddessLeveling: "goddessLeveling",
    collection: "collection",
    collectionLayouts: "collectionLayouts",
    cryptidLayout: "cryptidLayout",
    cryptidTowerLayout: "cryptidTowerLayout",
    adsBuy: "adsBuy",
  };
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    for (const [id, guide] of Object.entries(dictionary.guideEntries)) {
      assert.equal(guideLayout(guide), custom[id] ?? "article", `${code}.${id}`);
    }
  }
});
