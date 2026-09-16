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
  assert.equal(guideHasSnippetEditor("museion"), false);
  assert.equal(guideHasSnippetEditor("heroLeveling"), false);
  assert.equal(guideHasSnippetEditor("support"), true);
});

test("artwork layouts levels SSR ATK first", () => {
  const { levels, note, buildNames } = en.guideEntries.artworkLayouts;
  assert.equal(levels[0]?.rarity, "SSR");
  assert.equal(levels[0]?.stat, "ATK");
  assert.equal(Object.keys(buildNames).join(), "crit,pursuit,dot,hybrid");
  assert.equal(note, "");
});

test("goddesses phase 2 stops Fortuna and Bastet at 60", () => {
  const { phases, note } = en.guideEntries.goddesses;
  const phase2 = phases.find((phase) => phase.tone === "2");
  assert.ok(phase2, "missing phase 2");
  assert.equal(phase2.rows.find((row) => row.name === "Fortuna")?.target, "60");
  assert.equal(phase2.rows.find((row) => row.name === "Bastet")?.target, "60");
  assert.equal(note, "");
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
    museion: "museion",
    heroLeveling: "heroLeveling",
  };
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    for (const [id, guide] of Object.entries(dictionary.guideEntries)) {
      assert.equal(guideLayout(guide), custom[id] ?? "article", `${code}.${id}`);
    }
  }
});
