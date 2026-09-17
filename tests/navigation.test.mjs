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
  const groups = eventCategoryGroups(en);
  assert.deepEqual(
    groups.map((group) => ({ id: group.id, category: group.category, count: group.items.length })),
    [
      { id: "anleitungen", category: en.eventCategories.anleitungen, count: 0 },
      { id: "tips", category: en.eventCategories.tips, count: 1 },
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

test("Guides and Events open the browse panel even when Events has no items", () => {
  assert.equal(sectionHasBrowsePanel(sectionById("guides")), true);
  assert.equal(sectionHasBrowsePanel(sectionById("events")), true);
  assert.equal(sectionHasBrowsePanel(sectionById("news")), false);
  assert.equal(sectionHasBrowsePanel(sectionById("calculators")), true);
});
