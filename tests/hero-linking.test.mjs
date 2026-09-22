import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  HERO_LINKS,
  LINKING_DATA,
  LINK_PRIORITY,
  LINK_SOURCES,
  linkNote,
  linksBySource,
  priorityNote,
} from "../lib/content/hero-linking.ts";
import {
  addLink,
  addTarget,
  countLinkingChanges,
  exportLinking,
  exportedLinkTexts,
  findLinkingProblems,
  fromLinkingData,
  moveTarget,
  noteOf,
  parseLinkingDraft,
  removeLink,
  removeTarget,
  serializeLinkingData,
  setNote,
  textBlocks,
  unusedHeroes,
  updateLink,
  PUBLISHED_LINKING,
} from "../lib/content/hero-linking-editor.ts";
import { HEROES } from "../lib/content/heroes.ts";
import { LOCALES, getDictionary } from "../lib/i18n/index.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const uidOf = (state, list, hero) => state[list].find((row) => row.hero === hero).uid;

test("every hero named by the linking guide is in the Heroes roster", () => {
  const names = new Set(HEROES.map((hero) => hero.name));
  for (const link of HERO_LINKS) {
    assert.ok(names.has(link.hero), `${link.hero} is a roster hero`);
    assert.ok(LINK_SOURCES.includes(link.source), `${link.hero} has a known track`);
    assert.ok(Number.isInteger(link.step) && link.step >= 1, `${link.hero} has a step`);
  }
  for (const target of LINK_PRIORITY) assert.ok(names.has(target.hero), `${target.hero} is a roster hero`);

  // Two heroes on the same step of one track would both claim to be "#1".
  const steps = HERO_LINKS.map((link) => `${link.source}#${link.step}`);
  assert.equal(new Set(steps).size, steps.length);
});

test("the published list is the one the community shared", () => {
  assert.deepEqual(linksBySource("grail").map((link) => link.hero), ["King Arthur", "Lancelot", "Merlin"]);
  assert.deepEqual(linksBySource("odin").map((link) => link.hero), ["Ragnar Lodbrok", "Lagertha", "Bjorn Ironside"]);
  assert.deepEqual(linksBySource("grail").map((link) => link.step), [1, 3, 5]);
  assert.deepEqual(LINK_PRIORITY.map((target) => target.hero), ["Joan of Arc", "Achilles"]);
});

test("a note a language has not translated yet shows the English one", () => {
  const english = { links: { "King Arthur": "Needs 1 star." }, priority: { "Joan of Arc": "first" } };
  assert.equal(linkNote("King Arthur", {}, {}), "");
  assert.equal(linkNote("King Arthur", { links: { "King Arthur": "  Braucht 1 Stern. " } }, english), "Braucht 1 Stern.");
  assert.equal(linkNote("King Arthur", {}, english), "Needs 1 star.", "an untranslated note falls back");
  assert.equal(linkNote("Merlin", {}, english), "", "a hero with no note anywhere stays blank");
  // The two lists are separate, so a note cannot leak from one into the other.
  assert.equal(priorityNote("Joan of Arc", { links: { "Joan of Arc": "wrong list" } }, {}), "");
  assert.equal(priorityNote("Joan of Arc", {}, english), "first");
});

test("every published dictionary keys its notes to a hero that is in the guide", () => {
  const links = new Set(HERO_LINKS.map((link) => link.hero));
  const priority = new Set(LINK_PRIORITY.map((target) => target.hero));
  for (const { code } of LOCALES) {
    const texts = getDictionary(code).guideEntries.heroLinking.linkTexts;
    for (const hero of Object.keys(texts.links ?? {})) assert.ok(links.has(hero), `${code}: ${hero} can link`);
    for (const hero of Object.keys(texts.priority ?? {})) assert.ok(priority.has(hero), `${code}: ${hero} is in the order`);
  }
});

test("an untouched draft exports the published JSON and dictionary blocks byte for byte", () => {
  assert.equal(serializeLinkingData(exportLinking(PUBLISHED_LINKING)), read("../lib/data/hero-linking.json"));
  const blocks = textBlocks(PUBLISHED_LINKING);
  for (const language of ["en", "de", "fr"]) {
    assert.ok(read(`../lib/i18n/dictionaries/${language}.ts`).includes(blocks[language]), `${language} block matches`);
  }
  assert.equal(countLinkingChanges(PUBLISHED_LINKING, PUBLISHED_LINKING), 0);
  assert.deepEqual(findLinkingProblems(PUBLISHED_LINKING), []);
});

test("heroes come from the roster, and the picker never offers one twice", () => {
  const published = fromLinkingData(LINKING_DATA);
  let state = published;

  // A hero already in that list, and anything not in the roster at all, is refused.
  assert.equal(addLink(state, "King Arthur"), state);
  assert.equal(addLink(state, "Nobody"), state);
  assert.equal(addTarget(state, "Joan of Arc"), state);
  assert.equal(unusedHeroes(state, "links").some((hero) => hero.name === "King Arthur"), false);
  assert.equal(unusedHeroes(state, "links").some((hero) => hero.name === "Achilles"), true);
  assert.equal(unusedHeroes(state, "priority").some((hero) => hero.name === "King Arthur"), true);

  // A new link lands on the next free step of its track.
  state = addLink(state, "Morgana", "odin");
  const morgana = uidOf(state, "links", "Morgana");
  assert.equal(state.links.find((link) => link.uid === morgana).step, 6);
  state = updateLink(state, morgana, { step: 7 });
  const exported = exportLinking(state);
  assert.deepEqual(
    exported.links.filter((link) => link.source === "odin").map((link) => `${link.hero} ${link.step}`),
    ["Ragnar Lodbrok 1", "Lagertha 3", "Bjorn Ironside 5", "Morgana 7"],
    "the export is sorted by track, then step",
  );
  assert.equal(countLinkingChanges(published, state), 1);

  state = addTarget(state, "Merlin");
  state = moveTarget(state, uidOf(state, "priority", "Merlin"), 0);
  assert.deepEqual(exportLinking(state).priority.map((target) => target.hero), ["Merlin", "Joan of Arc", "Achilles"]);
  assert.deepEqual(exportLinking(moveTarget(state, uidOf(state, "priority", "Merlin"), 99)).priority.at(-1).hero, "Merlin");
});

test("notes are kept per language and exported as one block each", () => {
  const published = fromLinkingData(LINKING_DATA);
  let state = published;
  const arthur = uidOf(state, "links", "King Arthur");
  const joan = uidOf(state, "priority", "Joan of Arc");

  state = setNote(state, "en", "links", arthur, "  Needs 1 star. ");
  state = setNote(state, "de", "links", arthur, "Braucht 1 Stern.");
  state = setNote(state, "en", "priority", joan, "Usually the strongest hero early.");
  assert.equal(noteOf(state, "en", "links", arthur), "  Needs 1 star. ");
  assert.equal(noteOf(state, "fr", "links", arthur), "", "an untouched language stays empty");

  const texts = exportedLinkTexts(state);
  assert.deepEqual(texts.en, {
    links: { "King Arthur": "Needs 1 star." },
    priority: { "Joan of Arc": "Usually the strongest hero early." },
  });
  assert.deepEqual(texts.de, { links: { "King Arthur": "Braucht 1 Stern." } });
  assert.deepEqual(texts.fr, {}, "no notes means no block content");
  // English and German both moved, so both count.
  assert.equal(countLinkingChanges(published, state), 2);

  const blocks = textBlocks(state);
  assert.equal(blocks.fr, "      linkTexts: {},");
  assert.ok(blocks.en.includes('          "King Arthur": "Needs 1 star.",'));
  assert.ok(blocks.en.includes("        priority: {"));
  assert.ok(blocks.de.includes("        links: {"));
  assert.equal(blocks.de.includes("priority"), false, "an empty list is left out");

  // An English note lists the languages that still fall back to it.
  const problems = findLinkingProblems(state);
  assert.deepEqual(problems.filter((problem) => problem.code === "missingNote").map((problem) => problem.language), [
    "Français",
    "Deutsch",
    "Français",
  ]);
  // A note only in German is not flagged: there is no English text to fall back from.
  const germanOnly = setNote(published, "de", "links", uidOf(published, "links", "Merlin"), "Nur Deutsch");
  assert.equal(findLinkingProblems(germanOnly).some((problem) => problem.code === "missingNote"), false);

  // Removing a row takes its note in every language with it.
  state = removeLink(state, arthur);
  assert.equal(exportedLinkTexts(state).de.links, undefined);
  state = removeTarget(state, joan);
  assert.equal(exportedLinkTexts(state).en.priority, undefined);
});

test("stored drafts are validated before use", () => {
  const state = setNote(fromLinkingData(LINKING_DATA), "de", "links", "l1", "Hallo");
  assert.deepEqual(parseLinkingDraft(JSON.stringify(state)), state);
  assert.equal(parseLinkingDraft(null), null);
  assert.equal(parseLinkingDraft("{"), null);
  assert.equal(parseLinkingDraft(JSON.stringify({ ...state, version: 0 })), null);

  const badSource = structuredClone(state);
  badSource.links[0].source = "zeus";
  assert.equal(parseLinkingDraft(JSON.stringify(badSource)), null);
  const badStep = structuredClone(state);
  badStep.links[0].step = 0;
  assert.equal(parseLinkingDraft(JSON.stringify(badStep)), null);
  const badNote = structuredClone(state);
  badNote.texts.de.links.l1 = 7;
  assert.equal(parseLinkingDraft(JSON.stringify(badNote)), null);
  const badTarget = structuredClone(state);
  delete badTarget.priority[0].hero;
  assert.equal(parseLinkingDraft(JSON.stringify(badTarget)), null);
});

test("problems flag an empty list and a hero the roster no longer has", () => {
  const empty = { version: 1, links: [], priority: [], texts: {}, nextId: 1 };
  assert.deepEqual(findLinkingProblems(parseLinkingDraft(JSON.stringify(empty))).map((problem) => problem.code), [
    "noLinks",
    "noPriority",
  ]);

  const state = fromLinkingData({
    links: [
      { hero: "King Arthur", source: "grail", step: 1 },
      { hero: "Someone Else", source: "grail", step: 1 },
    ],
    priority: [{ hero: "Joan of Arc" }],
  });
  const codes = findLinkingProblems(state).map((problem) => problem.code);
  assert.ok(codes.includes("unknownHero"));
  assert.ok(codes.includes("duplicateStep"));
});
