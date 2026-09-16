import assert from "node:assert/strict";
import test from "node:test";

import { getDictionary, mapLocales } from "../lib/i18n/index.ts";
import en from "../lib/i18n/dictionaries/en.ts";
import { sectionById } from "../lib/navigation.ts";
import { guideHref, guideLayout, isGuideEntryId } from "../lib/content/guides.ts";
import {
  AGE_MILESTONES,
  AGE_UNCONFIRMED,
  eventDetail,
  eventName,
  milestoneLabel,
} from "../lib/content/server-age-unlocks.ts";

test("server age unlocks sits under Tips and tricks", () => {
  const item = sectionById("guides").items.find((entry) => entry.href === "/guides/server-age-unlocks/");
  assert.equal(item?.categoryId, "tips");
  assert.equal(guideHref("serverAgeUnlocks"), "/guides/server-age-unlocks/");
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    assert.equal(guideLayout(dictionary.guideEntries.serverAgeUnlocks), "serverAgeUnlocks", code);
  }
});

test("every age event has a stable id and unique ids across the guide", () => {
  const ids = [
    ...AGE_MILESTONES.flatMap((milestone) => [milestone.id, ...milestone.events.map((event) => event.id)]),
    ...AGE_UNCONFIRMED.map((event) => event.id),
  ];
  assert.equal(new Set(ids).size, ids.length, "ids must be unique");
  for (const milestone of AGE_MILESTONES) {
    assert.ok(milestone.events.length > 0, `${milestone.id} needs events`);
    assert.ok(
      milestone.day != null || Boolean(milestone.label),
      `${milestone.id} needs a day or a label`,
    );
  }
});

test("related guides named by age events exist in the dictionaries", () => {
  for (const event of [...AGE_MILESTONES.flatMap((m) => m.events), ...AGE_UNCONFIRMED]) {
    if (!event.relatedGuide) continue;
    assert.equal(isGuideEntryId(event.relatedGuide, en.guideEntries), true, event.relatedGuide);
  }
});

test("one-time chronogate unlocks stay marked, and day labels fall back cleanly", () => {
  const once = AGE_MILESTONES.flatMap((m) => m.events).filter((event) => event.oneTime);
  assert.ok(once.some((event) => event.id === "muses-choice"));
  assert.ok(once.some((event) => event.id === "island-adventure"));
  const dayOne = AGE_MILESTONES.find((m) => m.id === "day-1");
  assert.equal(milestoneLabel(dayOne, {}), null);
  assert.equal(milestoneLabel(AGE_MILESTONES.find((m) => m.id === "around-day-40"), {}), "Somewhere in this patch…");
  assert.equal(eventName(once[0], { [once[0].id]: { name: "Translated" } }), "Translated");
  assert.equal(eventDetail({ id: "x", name: "X", detail: "Hint" }, {}), "Hint");
});
