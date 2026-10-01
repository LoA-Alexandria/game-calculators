import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { EVENT_TITLES, UNNAMED_GREEN_TITLE_EVENTS, eventTitleHref } from "../lib/content/event-title-guide.ts";
import { guideHasSnippetEditor, guideHref, guideLayout } from "../lib/content/guides.ts";
import { LOCALE_CODES, getDictionary } from "../lib/i18n/index.ts";
import { sectionById } from "../lib/navigation.ts";

const localFile = (path) => new URL(`..${path}`, import.meta.url);

test("event title guide is listed under Tips and tricks in every language", () => {
  const item = sectionById("guides").items.find((entry) => entry.href === "/guides/event-titles/");
  assert.equal(item?.categoryId, "tips");
  assert.equal(guideHref("eventTitles"), "/guides/event-titles/");
  assert.equal(guideHasSnippetEditor("eventTitles"), false);
  assert.ok(existsSync(localFile("/app/guides/event-titles/page.tsx")));
  for (const code of LOCALE_CODES) {
    const guide = getDictionary(code).guideEntries.eventTitles;
    assert.equal(guideLayout(guide), "eventTitles", code);
    for (const tier of ["orange", "purple", "blue", "green"]) assert.ok(guide.tiers[tier], `${code}: ${tier}`);
    for (const title of EVENT_TITLES) assert.ok(guide.titleNames[title.id], `${code}: missing title ${title.id}`);
    for (const event of [...EVENT_TITLES.flatMap((title) => title.events), ...UNNAMED_GREEN_TITLE_EVENTS]) {
      assert.ok(guide.eventNames[event.name], `${code}: missing event translation ${event.name}`);
      if (event.condition) assert.ok(guide.conditions[event.condition], `${code}: missing condition translation ${event.condition}`);
      if (event.note) assert.ok(guide.eventNotes[`steelheart-overlord:${event.name}`], `${code}: missing event note translation`);
    }
  }
});

test("title art is linked to published event pages and supplied artwork", () => {
  const events = sectionById("events").items;
  assert.equal(EVENT_TITLES.length, 15);
  const titleIds = new Set();
  for (const title of EVENT_TITLES) {
    assert.ok(!titleIds.has(title.id), `${title.id} appears twice`);
    titleIds.add(title.id);
    assert.ok(title.name);
    assert.ok(title.events.length, `${title.name} has no event`);
    if (title.image) assert.ok(existsSync(localFile(`/public${title.image}`)), `${title.image} missing`);
    for (const event of title.events) {
      assert.ok(event.name, `${title.id} has an unnamed event`);
      if (event.guideId) {
        assert.ok(events.some((item) => item.href === eventTitleHref(event)), `${event.name} event guide is not in navigation`);
      } else {
        assert.equal(eventTitleHref(event), "/events/", `${event.name} should fall back to the event index`);
      }
    }
  }
  assert.ok(EVENT_TITLES.some((title) => title.name === "King of the Seven Seas" && !title.image), "no King of the Seven Seas screenshot was supplied");
  assert.equal(UNNAMED_GREEN_TITLE_EVENTS.length, 2);
  assert.ok(UNNAMED_GREEN_TITLE_EVENTS.every((event) => !event.name.includes("Official") && eventTitleHref(event)));
});
