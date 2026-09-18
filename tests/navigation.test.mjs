import assert from "node:assert/strict";
import test from "node:test";

import { getDictionary } from "../lib/i18n/index.ts";
import {
  EVENT_CATEGORY_IDS,
  eventCategoryGroups,
  groupByBadge,
  guideCount,
  sectionById,
  sectionHasBrowsePanel,
  toolCount,
} from "../lib/navigation.ts";

test("groups nav items by category id, then badge, and keeps first-seen order", () => {
  const t = {};
  const items = [
    { href: "/a", label: () => "A", badge: () => "City layout", categoryId: "cityLayout" },
    { href: "/b", label: () => "B", badge: () => "Goddess", categoryId: "goddess" },
    { href: "/c", label: () => "C", badge: () => "City layout", categoryId: "cityLayout" },
    { href: "/d", label: () => "D" },
  ];
  const groups = groupByBadge(items, t, "Other");
  assert.deepEqual(
    groups.map((group) => ({
      id: group.id,
      category: group.category,
      hrefs: group.items.map((item) => item.href),
    })),
    [
      { id: "cityLayout", category: "City layout", hrefs: ["/a", "/c"] },
      { id: "goddess", category: "Goddess", hrefs: ["/b"] },
      { id: "Other", category: "Other", hrefs: ["/d"] },
    ],
  );
});

test("home counters match the published navigation tree", () => {
  assert.equal(toolCount(), 6);
  assert.equal(guideCount(), 20);
});

test("Events index always exposes Anleitungen and Tips categories", () => {
  const en = getDictionary("en");
  assert.deepEqual([...EVENT_CATEGORY_IDS], ["anleitungen", "tips"]);
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/atlantis/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/monument-of-eternity/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/supply-reform/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/trials-of-odin/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/astral-wonderland/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/mushroom-adventure/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/great-flood/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/dawn-of-rome/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/ring-toss/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/life-incubator/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/road-to-worldcup/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/duel-festival/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/mayan-ruins/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/peak-of-enlightenment/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/red-carpet/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/global-regatta/"));
  assert.ok(sectionById("events").items.some((item) => item.href === "/events/heart-of-gold/"));
  const groups = eventCategoryGroups(en);
  assert.deepEqual(
    groups.map((group) => ({ id: group.id, category: group.category, count: group.items.length })),
    [
      { id: "anleitungen", category: en.eventCategories.anleitungen, count: 0 },
      { id: "tips", category: en.eventCategories.tips, count: 19 },
    ],
  );
});

test("Atlantis is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.atlantis;
    assert.equal(entry.title, "Atlantis");
    assert.ok(entry.sections.some((section) => section.heading === "Endless Floor"));
    assert.ok(entry.sections.some((section) => /Bonus Area/i.test(section.heading)));
  }
});

test("Spring Returns is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.springReturns;
    assert.match(entry.title, /Spring Returns/);
    assert.ok(entry.sections.some((section) => /Signboards/.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /Buntings/.test(section.body.join(" "))));
  }
});

test("Holy Grail is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.holyGrail;
    assert.equal(entry.title, "Holy Grail");
    assert.ok(entry.sections.some((section) => /Zone 3/i.test(section.heading) || /Zone 3/i.test(section.body.join(" "))));
    assert.match(entry.note, /Autumn/);
  }
});

test("Monument of Eternity is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.monumentOfEternity;
    assert.equal(entry.title, "Monument of Eternity");
    assert.ok(entry.sections.some((section) => /120/.test(section.body.join(" ")) || /80–90|80-90|80 – 90/.test(section.body.join(" "))));
    assert.match(entry.note, /Autumn/);
  }
});

test("Supply Reform is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.supplyReform;
    assert.equal(entry.title, "Supply Reform");
    assert.ok(entry.sections.some((section) => /next row|nächste Reihe|prochaine rangée/i.test(section.body.join(" "))));
  }
});

test("Trials of Odin is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.trialsOfOdin;
    assert.match(entry.title, /Trials of Odin/);
    assert.ok(entry.sections.some((section) => /Draupnir|Military Token/i.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /Surtr/.test(section.body.join(" "))));
    assert.match(entry.note, /Cherr/);
    assert.match(entry.note, /Autumn/);
  }
});

test("Astral Wonderland is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.astralWonderland;
    assert.equal(entry.title, "Astral Wonderland");
    assert.ok(entry.sections.some((section) => /720/.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /Creator Area/i.test(section.heading) || /Creator Area/i.test(section.body.join(" "))));
    assert.match(entry.note, /Autumn/);
  }
});

test("Mushroom Adventure is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.mushroomAdventure;
    assert.equal(entry.title, "Mushroom Adventure");
    assert.ok(entry.sections.some((section) => /Level 8|niveau 8/i.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /Scythe|Sensen|faux/i.test(section.body.join(" "))));
    assert.match(entry.note, /Autumn/);
  }
});

test("Great Flood is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.greatFlood;
    assert.equal(entry.title, "Great Flood");
    assert.ok(entry.sections.some((section) => /Stockpile/i.test(section.heading) || /Stockpile/i.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /bend|abbiegen|tourner/i.test(section.body.join(" "))));
    assert.match(entry.note, /Autumn/);
  }
});

test("Dawn of Rome is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.dawnOfRome;
    assert.match(entry.title, /Dawn of Rome/);
    assert.match(entry.title, /Crown of the Nile/);
    assert.ok(entry.sections.some((section) => /25%|25 %/.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /Cavalry|Kavallerie|Cavalerie/.test(section.body.join(" "))));
    assert.match(entry.note, /Cherr/);
    assert.match(entry.note, /Autumn/);
  }
});

test("Ring Toss is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.ringToss;
    assert.match(entry.title, /Ring Toss/);
    assert.ok(entry.sections.some((section) => /69/.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /hard pity|Hard Pity/i.test(section.heading) || /100/.test(section.body.join(" "))));
    assert.match(entry.note, /Cherr/);
    assert.match(entry.note, /Autumn/);
  }
});

test("Life Incubator is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.lifeIncubator;
    assert.equal(entry.title, "Life Incubator");
    assert.ok(entry.sections.some((section) => /trench|Graben|tranchée/i.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /center|Mitte|centrale/i.test(section.body.join(" "))));
    assert.match(entry.note, /Autumn/);
  }
});

test("Road to Worldcup is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.roadToWorldcup;
    assert.equal(entry.title, "Road to Worldcup");
    assert.ok(entry.sections.some((section) => /352/.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /50/.test(section.body.join(" "))));
    assert.match(entry.note, /Autumn/);
  }
});

test("Duel Festival is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.duelFestival;
    assert.equal(entry.title, "Duel Festival");
    assert.ok(entry.sections.some((section) => /Group 1|Gruppe 1|groupe 1/i.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /1–2|1-2/.test(section.body.join(" "))));
    assert.match(entry.note, /Autumn/);
  }
});

test("Mayan Ruins is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.mayanRuins;
    assert.equal(entry.title, "Mayan Ruins");
    assert.ok(entry.sections.some((section) => /Stage 20|Stage 20/.test(section.body.join(" ")) || /20/.test(section.body.join(" "))));
    assert.match(entry.note, /obsolete|obsolet|obsolète/i);
    assert.match(entry.note, /Autumn/);
  }
});

test("Peak of Enlightenment is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.peakOfEnlightenment;
    assert.equal(entry.title, "Peak of Enlightenment");
    assert.ok(entry.sections.some((section) => /72/.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /harp|Harf/i.test(section.body.join(" "))));
  }
});

test("Red Carpet is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.redCarpet;
    assert.equal(entry.title, "Red Carpet");
    assert.ok(entry.sections.some((section) => /144/.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /lipstick|Lippenstift|rouges à lèvres/i.test(section.body.join(" "))));
  }
});

test("Global Regatta is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.globalRegatta;
    assert.equal(entry.title, "Global Regatta");
    assert.ok(entry.sections.some((section) => /mile|Meile/i.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /barrel|Fässer|baril/i.test(section.body.join(" "))));
  }
});

test("Heart of Gold is listed under Events Tips in every language", () => {
  for (const locale of ["en", "de", "fr"]) {
    const dictionary = getDictionary(locale);
    const entry = dictionary.eventGuideEntries.heartOfGold;
    assert.equal(entry.title, "Heart of Gold");
    assert.ok(entry.sections.some((section) => /750/.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => /2×2|2x2|vier Felder|quatre cases/i.test(section.body.join(" "))));
    assert.ok(entry.sections.some((section) => "image" in section && section.image?.src.includes("heart-of-gold-boss-pattern")));
  }
});

test("Guides and Events open the browse panel even when Events has no items", () => {
  assert.equal(sectionHasBrowsePanel(sectionById("guides")), true);
  assert.equal(sectionHasBrowsePanel(sectionById("events")), true);
  assert.equal(sectionHasBrowsePanel(sectionById("news")), false);
  assert.equal(sectionHasBrowsePanel(sectionById("calculators")), true);
});
