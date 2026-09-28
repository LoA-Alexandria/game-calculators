import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  COMMITTED_LORE,
  LORE_FILES,
  LORE_LANGUAGES,
  PUBLISHED_LORE,
  countLoreChanges,
  exportLore,
  findLoreProblems,
  fromLoreData,
  parseLoreDraft,
  serializeLore,
  setLore,
  untranslatedLore,
} from "../lib/content/lore-editor.ts";
import { GODDESSES } from "../lib/content/goddesses.ts";
import { HEROES } from "../lib/content/heroes.ts";

const file = (name) => JSON.parse(readFileSync(new URL(`../lib/data/${name}.json`, import.meta.url), "utf8"));
const heroes = () => fromLoreData("hero", COMMITTED_LORE.hero);

test("an untouched draft gives both files back exactly as they are committed", () => {
  for (const roster of ["hero", "goddess"]) {
    const state = fromLoreData(roster, COMMITTED_LORE[roster]);
    for (const language of LORE_LANGUAGES) {
      assert.deepEqual(exportLore(state, language), file(LORE_FILES[roster][language]), `${roster} ${language}`);
    }
    assert.equal(countLoreChanges(state, state), 0, roster);
    assert.deepEqual(findLoreProblems(state), [], `${roster} has nothing to fix`);
  }
});

test("every hero and goddess has a row, with the English beside the translation", () => {
  const state = heroes();
  assert.equal(state.rows.length, HEROES.length);
  assert.equal(fromLoreData("goddess", COMMITTED_LORE.goddess).rows.length, GODDESSES.length);

  const hero = HEROES.find((entry) => entry.bio);
  const row = state.rows.find((entry) => entry.id === hero.id);
  assert.equal(row.english.bio, hero.bio, "the English story is shown, not edited");
  assert.equal(row.de.bio, COMMITTED_LORE.hero.de[hero.id].bio);
});

test("a change travels only in the language it was written in", () => {
  const state = heroes();
  const id = state.rows[0].id;
  const next = setLore(state, id, "de", { title: "Neuer Beiname", bio: "Neue Geschichte." });
  assert.deepEqual(exportLore(next, "de")[id], { title: "Neuer Beiname", bio: "Neue Geschichte." });
  assert.deepEqual(exportLore(next, "fr")[id], exportLore(state, "fr")[id], "French is untouched");
  assert.equal(countLoreChanges(state, next), 1);
});

test("an emptied entry leaves the file rather than sitting there blank", () => {
  const state = heroes();
  const id = state.rows[0].id;
  const cleared = setLore(setLore(state, id, "de", { title: "" }), id, "de", { bio: "  " });
  assert.equal(id in exportLore(cleared, "de"), false);
  assert.equal(countLoreChanges(state, cleared), 1);
  assert.deepEqual(findLoreProblems(cleared), [], "nothing is half written");
});

test("half a translation is named, because the page would show two languages at once", () => {
  const state = heroes();
  const row = state.rows[0];
  const onlyBio = setLore(state, row.id, "de", { title: "" });
  assert.deepEqual(findLoreProblems(onlyBio), [{ code: "bioWithoutTitle", name: row.name, language: "de" }]);
  const onlyTitle = setLore(state, row.id, "de", { bio: "" });
  assert.deepEqual(findLoreProblems(onlyTitle), [{ code: "titleWithoutBio", name: row.name, language: "de" }]);
});

test("lore for somebody the roster no longer has is kept and named", () => {
  const withGhost = {
    de: { ...COMMITTED_LORE.hero.de, "not-a-hero": { title: "Geist", bio: "Steht noch da." } },
    fr: COMMITTED_LORE.hero.fr,
  };
  const state = fromLoreData("hero", withGhost);
  assert.equal(state.rows.length, HEROES.length + 1);
  assert.deepEqual(findLoreProblems(state), [{ code: "notOnRoster", id: "not-a-hero" }]);
  assert.equal(exportLore(state, "de")["not-a-hero"].title, "Geist", "somebody's writing is not eaten");
});

test("what is still untranslated is counted, not called a problem", () => {
  const state = heroes();
  assert.deepEqual(untranslatedLore(state), [], "the roster is fully translated today");
  const cleared = setLore(setLore(state, state.rows[0].id, "fr", { title: "" }), state.rows[0].id, "fr", { bio: "" });
  assert.deepEqual(untranslatedLore(cleared), [{ language: "fr", count: 1 }]);
});

test("the files are written exactly as they are committed", () => {
  // Byte for byte, so an export shows the lines somebody changed rather than
  // reformatting all eighty-two of them.
  for (const roster of ["hero", "goddess"]) {
    const state = fromLoreData(roster, COMMITTED_LORE[roster]);
    for (const language of LORE_LANGUAGES) {
      const text = serializeLore(exportLore(state, language));
      const name = LORE_FILES[roster][language];
      assert.equal(
        text,
        readFileSync(new URL(`../lib/data/${name}.json`, import.meta.url), "utf8"),
        name,
      );
    }
  }
});

test("a draft survives a reload, and nonsense does not load at all", () => {
  const next = setLore(heroes(), heroes().rows[0].id, "de", { title: "Anders" });
  assert.deepEqual(parseLoreDraft(JSON.stringify(next), "hero"), next);
  assert.equal(parseLoreDraft(JSON.stringify(next), "goddess"), null, "a draft belongs to one roster");
  assert.equal(parseLoreDraft("not json", "hero"), null);
  assert.equal(parseLoreDraft(null, "hero"), null);
  const badRow = { ...next, rows: [{ ...next.rows[0], de: { title: 4, bio: "x" } }] };
  assert.equal(parseLoreDraft(JSON.stringify(badRow), "hero"), null);
});

test("what is published is what the rosters show right now", () => {
  for (const roster of ["hero", "goddess"]) {
    for (const language of LORE_LANGUAGES) {
      assert.deepEqual(exportLore(PUBLISHED_LORE[roster], language), file(LORE_FILES[roster][language]));
    }
  }
});
