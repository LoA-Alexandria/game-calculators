import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PUBLISHED_WIKI,
  addSection,
  countWikiChanges,
  eventOf,
  eventsWithoutHelp,
  exportWiki,
  findWikiProblems,
  fromWikiData,
  imagesFrom,
  imagesToText,
  linesOf,
  moveSection,
  parseWikiDraft,
  removeSection,
  serializeWiki,
  setEvent,
  setSection,
  setSource,
} from "../lib/content/event-wiki-editor.ts";
import { EVENT_WIKI_DATA, eventWiki, eventWikiHasHelp, eventWikiIcon } from "../lib/content/event-guides.ts";

const committed = JSON.parse(readFileSync(new URL("../lib/data/event-wiki.json", import.meta.url), "utf8"));
const state = () => fromWikiData(EVENT_WIKI_DATA);

test("an untouched draft gives the file back exactly as it is committed", () => {
  assert.deepEqual(exportWiki(state()), committed);
  assert.equal(countWikiChanges(state(), state()), 0);
  assert.deepEqual(findWikiProblems(state()), [], "the committed help has nothing to fix");
});

test("the file is written exactly as it is committed", () => {
  assert.equal(
    serializeWiki(exportWiki(state())),
    readFileSync(new URL("../lib/data/event-wiki.json", import.meta.url), "utf8"),
  );
});

test("every event has a row, and the fetch is kept with it", () => {
  const start = state();
  assert.equal(start.events.length, committed.events.length);
  assert.equal(start.source, committed.source);
  assert.equal(start.fetched, committed.fetched);

  const moved = setSource(start, { fetched: "2026-10-03" });
  assert.equal(exportWiki(moved).fetched, "2026-10-03");
  assert.equal(countWikiChanges(start, moved), 1, "where the help came from is one change");
});

test("bullets are one per line, and blank lines are not bullets", () => {
  assert.deepEqual(linesOf("one\n\n  two  \n"), ["one", "two"]);
  const start = state();
  const event = start.events.find((entry) => entry.sections.length > 0);
  const section = event.sections[0];
  const next = setSection(start, event.uid, section.uid, { items: "First rule.\n\nSecond rule.\n" });
  const written = exportWiki(next).events.find((entry) => entry.id === event.id).sections[0];
  assert.deepEqual(written.items, ["First rule.", "Second rule."]);
});

test("a picture is a file and a sentence about it", () => {
  assert.deepEqual(imagesFrom("/events/a.webp | A board\n/events/b.webp"), [
    { src: "/events/a.webp", alt: "A board" },
    { src: "/events/b.webp", alt: "" },
  ]);
  assert.equal(imagesToText([{ src: "/events/a.webp", alt: "A board" }]), "/events/a.webp | A board");

  const start = state();
  const event = start.events[0];
  const next = setEvent(start, event.uid, { images: "/events/a.webp" });
  assert.ok(findWikiProblems(next).some((problem) => problem.code === "pictureWithoutAlt"));
  const stray = setEvent(start, event.uid, { images: "events/a.webp | A board" });
  assert.ok(findWikiProblems(stray).some((problem) => problem.code === "strayPicture"));
});

test("a heading with no bullets under it is named but not eaten", () => {
  const start = state();
  const event = start.events[0];
  const before = exportWiki(start).events.find((entry) => entry.id === event.id).sections.length;
  const { state: added, uid } = addSection(start, event.uid);
  const headed = setSection(added, event.uid, uid, { heading: "Rewards" });
  assert.ok(findWikiProblems(headed).some((problem) => problem.code === "emptySection"));
  // The heading somebody typed is kept; only a wholly empty row is dropped.
  assert.equal(exportWiki(headed).events.find((entry) => entry.id === event.id).sections.length, before + 1);
  assert.equal(exportWiki(added).events.find((entry) => entry.id === event.id).sections.length, before);
  assert.equal(countWikiChanges(start, removeSection(headed, event.uid, uid)), 0);
});

test("sections keep the order they are put in", () => {
  const start = state();
  const event = start.events.find((entry) => entry.sections.length > 1);
  const headings = event.sections.map((section) => section.heading);
  const moved = moveSection(start, event.uid, event.sections[1].uid, -1);
  const written = exportWiki(moved).events.find((entry) => entry.id === event.id).sections.map((s) => s.heading);
  assert.deepEqual(written.slice(0, 2), [headings[1], headings[0]]);
  // Past either end nothing happens.
  const first = eventOf(moveSection(start, event.uid, event.sections[0].uid, -1), event.uid);
  assert.deepEqual(first.sections.map((s) => s.heading), headings);
});

test("the stub flag says the wiki page is thin, not that help is missing", () => {
  // Six committed events are marked as stubs and carry help anyway; the flag
  // belongs to the source page, so it is not a contradiction to fix.
  const marked = state().events.filter((entry) => entry.stub);
  assert.ok(marked.length > 0);
  assert.ok(marked.some((entry) => entry.intro.trim() || entry.sections.length > 0));
  assert.deepEqual(findWikiProblems(state()), []);
});

test("the events still waiting for help are listed", () => {
  const empty = eventsWithoutHelp(state());
  for (const entry of committed.events) {
    const hasHelp = Boolean(entry.intro) || entry.sections.some((section) => section.items.length > 0);
    const name = entry.wikiTitle || entry.id;
    assert.equal(empty.includes(name), !hasHelp, name);
  }
});

test("the pages read the entries they are given", () => {
  const published = exportWiki(setEvent(state(), state().events[0].uid, { intro: "A published line." })).events;
  const id = committed.events[0].id;
  assert.equal(eventWiki(id, published).intro, "A published line.");
  assert.equal(eventWiki(id).intro, committed.events[0].intro, "the built file is untouched");
  assert.equal(eventWikiHasHelp(id, published), true);
  assert.equal(eventWikiIcon(id, published), committed.events[0].icon);
});

test("a draft survives a reload, and nonsense does not load at all", () => {
  const next = setEvent(state(), state().events[0].uid, { intro: "Changed." });
  assert.deepEqual(parseWikiDraft(JSON.stringify(next)), next);
  assert.equal(parseWikiDraft("not json"), null);
  assert.equal(parseWikiDraft(null), null);
  assert.equal(parseWikiDraft(JSON.stringify({ ...next, version: 2 })), null);
  const badStub = { ...next, events: [{ ...next.events[0], stub: "yes" }, ...next.events.slice(1)] };
  assert.equal(parseWikiDraft(JSON.stringify(badStub)), null);
});

test("what is published is what the event pages show right now", () => {
  assert.deepEqual(exportWiki(PUBLISHED_WIKI), committed);
});
