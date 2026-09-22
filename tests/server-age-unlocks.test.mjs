import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { getDictionary, mapLocales } from "../lib/i18n/index.ts";
import en from "../lib/i18n/dictionaries/en.ts";
import { sectionById } from "../lib/navigation.ts";
import { guideHasSnippetEditor, guideHref, guideLayout, isGuideEntryId } from "../lib/content/guides.ts";
import {
  AGE_MILESTONES,
  AGE_UNCONFIRMED,
  AGE_UNLOCKS_DATA,
  allAgeEvents,
  eventDetail,
  eventName,
  milestoneLabel,
} from "../lib/content/server-age-unlocks.ts";
import {
  PUBLISHED_AGE_UNLOCKS,
  addEvent,
  addMilestone,
  exportAgeUnlocks,
  findAgeUnlockProblems,
  serializeAgeUnlocksData,
  setEventText,
  eventTextBlocks,
} from "../lib/content/server-age-unlocks-editor.ts";

test("server age unlocks sits under Tips and tricks and skips the snippet editor", () => {
  const item = sectionById("guides").items.find((entry) => entry.href === "/guides/server-age-unlocks/");
  assert.equal(item?.categoryId, "tips");
  assert.equal(guideHref("serverAgeUnlocks"), "/guides/server-age-unlocks/");
  assert.equal(guideHasSnippetEditor("serverAgeUnlocks"), false);
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    assert.equal(guideLayout(dictionary.guideEntries.serverAgeUnlocks), "serverAgeUnlocks", code);
    assert.ok(dictionary.ageUnlocksEditor.openEditor, code);
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
  for (const event of allAgeEvents()) {
    if (!event.relatedGuide) continue;
    assert.equal(isGuideEntryId(event.relatedGuide, en.guideEntries), true, event.relatedGuide);
  }
});

test("one-time chronogate unlocks stay marked, and day labels fall back cleanly", () => {
  const once = allAgeEvents().filter((event) => event.oneTime);
  assert.ok(once.some((event) => event.id === "muses-choice"));
  assert.ok(once.some((event) => event.id === "island-adventure"));
  const dayOne = AGE_MILESTONES.find((m) => m.id === "day-1");
  assert.equal(milestoneLabel(dayOne, {}), null);
  assert.equal(milestoneLabel(AGE_MILESTONES.find((m) => m.id === "around-day-40"), {}), "Somewhere in this patch…");
  assert.equal(eventName(once[0], { [once[0].id]: { name: "Translated" } }), "Translated");
  assert.equal(eventDetail({ id: "x", name: "X", detail: "Hint" }, {}), "Hint");
});

test("an untouched draft exports the published file and empty text blocks byte for byte", () => {
  const result = exportAgeUnlocks(PUBLISHED_AGE_UNLOCKS, AGE_UNLOCKS_DATA);
  const file = readFileSync(new URL("../lib/data/server-age-unlocks.json", import.meta.url), "utf8");
  assert.equal(serializeAgeUnlocksData(result.data), file);
  assert.deepEqual(result.uploads, []);
  assert.deepEqual(result.removedFiles, []);
  assert.deepEqual(findAgeUnlockProblems(PUBLISHED_AGE_UNLOCKS), []);
  const blocks = eventTextBlocks(PUBLISHED_AGE_UNLOCKS);
  for (const [code, block] of Object.entries(blocks)) {
    assert.equal(block, "      eventTexts: {},", code);
  }
});

test("adding a milestone and event round-trips through export", () => {
  let state = PUBLISHED_AGE_UNLOCKS;
  const added = addMilestone(state);
  state = added.state;
  state = setEventText(state, state.milestones.at(-1).events[0].uid, "name", "en", "Fresh Unlock");
  state = addEvent(state, { kind: "unconfirmed" }).state;
  const lastUnconfirmed = state.unconfirmed.at(-1);
  state = setEventText(state, lastUnconfirmed.uid, "name", "en", "Mystery Feature");
  const result = exportAgeUnlocks(state, AGE_UNLOCKS_DATA);
  assert.ok(result.data.milestones.some((milestone) => milestone.events.some((event) => event.name === "Fresh Unlock")));
  assert.ok(result.data.unconfirmed.some((event) => event.name === "Mystery Feature"));
});

test("referenced age-unlock pictures exist, and none are orphaned", () => {
  const folder = new URL("../public/server-age-unlocks/", import.meta.url);
  const files = readdirSync(folder).filter((file) => !file.startsWith("."));
  const referenced = allAgeEvents().map((event) => event.image).filter(Boolean);
  assert.equal(new Set(referenced).size, referenced.length, "no image is shared by two events");
  assert.deepEqual([...referenced].sort(), [...files].sort());
});
