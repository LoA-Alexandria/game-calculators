import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import test from "node:test";

import {
  allEventWikiEntries,
  eventWiki,
  eventWikiIcon,
} from "../lib/content/event-guides.ts";
import { getDictionary } from "../lib/i18n/index.ts";
import { sectionById } from "../lib/navigation.ts";

const file = (path) => new URL(`..${path}`, import.meta.url);

test("every Events nav row with an icon has that file in public/events", () => {
  for (const item of sectionById("events").items) {
    if (!item.icon) continue;
    assert.ok(existsSync(file(`/public${item.icon}`)), `${item.href} missing ${item.icon}`);
  }
});

test("wiki rows cover every published event write-up", () => {
  const dictionary = getDictionary("en");
  const ids = Object.keys(dictionary.eventGuideEntries);
  for (const id of ids) {
    assert.ok(eventWiki(id), `event-wiki.json is missing ${id}`);
  }
  assert.equal(allEventWikiEntries().length, ids.length);
});

test("Heart of Gold still has the 2×2 dig figure on the community tip", () => {
  const entry = getDictionary("en").eventGuideEntries.heartOfGold;
  assert.ok(entry.sections.some((section) => "image" in section && section.image?.src.includes("heart-of-gold-boss-pattern")));
  assert.ok(existsSync(file("/public/events/heart-of-gold-boss-pattern.webp")));
});

test("Genie Wish and Grand Voyage are in the Events nav with wiki icons", () => {
  const items = sectionById("events").items;
  const genie = items.find((item) => item.href === "/events/genie-wish/");
  const voyage = items.find((item) => item.href === "/events/grand-voyage/");
  assert.equal(eventWikiIcon("genieWish"), "/events/genie-wish.webp");
  assert.equal(eventWikiIcon("grandVoyage"), "/events/grand-voyage.webp");
  assert.ok(genie?.icon);
  assert.ok(voyage?.icon);
});

test("each event guide page folder exists for the nav slug", () => {
  const pages = new Set(
    readdirSync(file("/app/events/"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `/events/${entry.name}/`),
  );
  for (const item of sectionById("events").items) {
    assert.ok(pages.has(item.href), `${item.href} has no app/events page`);
  }
});
