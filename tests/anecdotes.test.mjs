import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  ANECDOTES,
  ANECDOTE_DATA,
  ANECDOTE_GROUPS,
  anecdotesAfter,
  chainPosition,
  localizedAnecdote,
  searchAnecdotes,
} from "../lib/content/anecdotes.ts";
import {
  PUBLISHED_ANECDOTES,
  addAnecdote,
  addStep,
  addSubstep,
  afterOptions,
  anecdoteByUid,
  anecdoteIdFrom,
  anecdoteTextBlocks,
  countAnecdoteChanges,
  exportAnecdotes,
  exportedAnecdoteTexts,
  findAnecdoteProblems,
  fromAnecdoteData,
  moveAnecdote,
  moveStep,
  parseAnecdoteDraft,
  removeAnecdote,
  removeImage,
  removeStep,
  serializeAnecdoteData,
  setAfter,
  setAnecdoteText,
  setGroup,
  setImage,
  setStepText,
  setSubstepText,
  setThanks,
} from "../lib/content/anecdotes-editor.ts";
import { guideLayout } from "../lib/content/guides.ts";
import { DEFAULT_LOCALE, LOCALE_CODES, getDictionary } from "../lib/i18n/index.ts";
import { sectionById } from "../lib/navigation.ts";

const PIXEL = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
const others = LOCALE_CODES.filter((code) => code !== DEFAULT_LOCALE);

test("the anecdote list is well formed", () => {
  assert.equal(ANECDOTES.length, 50);
  const ids = new Set();
  for (const anecdote of ANECDOTES) {
    assert.match(anecdote.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, anecdote.id);
    assert.ok(!ids.has(anecdote.id), `${anecdote.id} twice`);
    ids.add(anecdote.id);
    assert.ok(ANECDOTE_GROUPS.includes(anecdote.group), `${anecdote.id}: group ${anecdote.group}`);
    assert.ok(anecdote.name.trim(), `${anecdote.id}: name`);
    assert.ok(anecdote.prerequisite || anecdote.after, `${anecdote.id}: nothing unlocks it`);
    for (const step of anecdote.steps) {
      assert.ok(step.text.trim(), `${anecdote.id}: empty step`);
      if (step.substeps) assert.ok(step.substeps.length > 0 && step.substeps.every((substep) => substep.trim()), `${anecdote.id}: empty substep`);
    }
  }
  assert.equal(new Set(ANECDOTES.map((anecdote) => anecdote.name.toLowerCase())).size, ANECDOTES.length, "names are unique");
  // Groups stay together, so the page and the editor show them in the same order.
  const order = ANECDOTES.map((anecdote) => anecdote.group).filter((group, index, all) => group !== all[index - 1]);
  assert.deepEqual(order, [...ANECDOTE_GROUPS]);
});

test("every chain link names an earlier anecdote and no chain loops", () => {
  const ids = ANECDOTES.map((anecdote) => anecdote.id);
  for (const anecdote of ANECDOTES) {
    if (!anecdote.after) continue;
    assert.ok(ids.includes(anecdote.after), `${anecdote.id} follows unknown ${anecdote.after}`);
    const seen = new Set([anecdote.id]);
    let current = anecdote;
    while (current.after) {
      assert.ok(!seen.has(current.after), `${anecdote.id}: loop`);
      seen.add(current.after);
      current = ANECDOTES.find((entry) => entry.id === current.after);
    }
  }
  assert.deepEqual(chainPosition("jackals-vs-dog"), { step: 1, total: 11 });
  assert.deepEqual(chainPosition("stone-pet"), { step: 11, total: 11 });
  assert.deepEqual(chainPosition("king-of-conquest-ii"), { step: 2, total: 2 });
  assert.equal(chainPosition("river-gods-gift"), null);
  assert.deepEqual(anecdotesAfter("cat-tax").map((anecdote) => anecdote.id), ["express-pass"]);
});

test("pictures named in the list exist, and none are left over", () => {
  const listed = ANECDOTES.map((anecdote) => anecdote.image).filter(Boolean);
  const folder = new URL("../public/anecdotes/", import.meta.url);
  const files = existsSync(folder) ? readdirSync(folder) : [];
  assert.deepEqual([...files].sort(), [...listed].sort());
});

test("the guide is listed under Tips and tricks with a translation catalog in every language", () => {
  const item = sectionById("guides").items.find((entry) => entry.href === "/guides/anecdotes/");
  assert.equal(item?.categoryId, "tips");
  const ids = new Set(ANECDOTES.map((anecdote) => anecdote.id));
  for (const code of LOCALE_CODES) {
    const guide = getDictionary(code).guideEntries.anecdotes;
    assert.equal(guideLayout(guide), "anecdotes", code);
    for (const group of ANECDOTE_GROUPS) assert.ok(guide.groups[group] && guide.groupLedes[group], `${code}: ${group}`);
    for (const id of Object.keys(guide.anecdoteTexts)) assert.ok(ids.has(id), `${code}: anecdoteTexts.${id} is not an anecdote`);
  }
});

test("translations apply per field and step, and fall back to English", () => {
  const duel = ANECDOTES.find((anecdote) => anecdote.id === "artistic-duel");
  const texts = { "artistic-duel": { name: "Künstlerduell", steps: [{}, { substeps: ["", "Michelangelo: Schlafzimmer"] }], note: "ignored" } };
  const local = localizedAnecdote(duel, texts);
  assert.equal(local.name, "Künstlerduell");
  assert.equal(local.prerequisite, duel.prerequisite);
  assert.equal(local.steps[0].text, duel.steps[0].text);
  assert.deepEqual(local.steps[1].substeps, [duel.steps[1].substeps[0], "Michelangelo: Schlafzimmer"]);
  assert.equal(local.note, undefined, "a translation of a text English does not have is not shown");
  assert.equal(searchAnecdotes("künstlerduell", "all").length, 0);
  assert.deepEqual(searchAnecdotes("künstlerduell", "all", [texts]).map((anecdote) => anecdote.id), ["artistic-duel"]);
  assert.deepEqual(searchAnecdotes("osiris", "egypt").map((anecdote) => anecdote.id), [
    "civet-coffee",
    "osiris-is-all",
    "direct-hire",
    "sit-ups",
    "sleep-guide",
    "stone-pet",
  ]);
  assert.equal(searchAnecdotes("osiris", "general").length, 0);
});

test("an untouched draft exports the published file and empty text blocks byte for byte", () => {
  const result = exportAnecdotes(PUBLISHED_ANECDOTES, ANECDOTE_DATA);
  const file = readFileSync(new URL("../lib/data/anecdotes.json", import.meta.url), "utf8");
  assert.equal(serializeAnecdoteData(result.data), file);
  assert.deepEqual(result.uploads, []);
  assert.deepEqual(result.removedFiles, []);
  assert.equal(countAnecdoteChanges(PUBLISHED_ANECDOTES, PUBLISHED_ANECDOTES), 0);
  const blocks = anecdoteTextBlocks(PUBLISHED_ANECDOTES);
  for (const code of LOCALE_CODES) {
    const catalog = getDictionary(code).guideEntries.anecdotes.anecdoteTexts;
    if (Object.keys(catalog).length === 0) assert.equal(blocks[code], "      anecdoteTexts: {},", code);
  }
  assert.deepEqual(findAnecdoteProblems(PUBLISHED_ANECDOTES), []);
});

test("adding an anecdote with steps, a picture, and a chain link exports all of it", () => {
  const start = PUBLISHED_ANECDOTES;
  let { state, uid } = addAnecdote(start, "general");
  const stone = start.anecdotes.find((anecdote) => anecdote.id === "stone-pet");
  // It goes after the last General anecdote, before the Egyptian Tales.
  assert.equal(state.anecdotes.findIndex((anecdote) => anecdote.uid === uid), start.anecdotes.filter((anecdote) => anecdote.group === "general").length);
  state = setAnecdoteText(state, uid, "name", "en", "Hidden Harbour");
  state = setAnecdoteText(state, uid, "prerequisite", "en", "Build the Dock");
  const first = anecdoteByUid(state, uid).steps[0].uid;
  state = setStepText(state, uid, first, "en", "Tap the gull.");
  state = addSubstep(state, uid, first);
  const sub = anecdoteByUid(state, uid).steps[0].substeps[0].uid;
  state = setSubstepText(state, uid, first, sub, "en", "The one on the mast");
  state = addStep(state, uid);
  state = setStepText(state, uid, anecdoteByUid(state, uid).steps[1].uid, "en", "Collect the letter.");
  state = setAfter(state, uid, stone.uid);
  state = setThanks(state, uid, " Kraes,  Zee ,");
  state = setImage(state, uid, PIXEL);
  state = setGroup(state, uid, "egypt");
  assert.equal(state.anecdotes.at(-1).uid, uid, "a new group puts it at the end of that group");

  const result = exportAnecdotes(state, ANECDOTE_DATA);
  const row = result.data.anecdotes.at(-1);
  assert.deepEqual(row, {
    id: "hidden-harbour",
    group: "egypt",
    name: "Hidden Harbour",
    after: "stone-pet",
    prerequisite: "Build the Dock",
    steps: [{ text: "Tap the gull.", substeps: ["The one on the mast"] }, { text: "Collect the letter." }],
    thanks: ["Kraes", "Zee"],
    image: "hidden-harbour.webp",
  });
  assert.deepEqual(result.uploads.map((upload) => upload.file), ["hidden-harbour.webp"]);
  assert.equal(countAnecdoteChanges(start, state), 1);
  assert.equal(anecdoteIdFrom("River God's Gift", []), "river-gods-gift");
  assert.equal(anecdoteIdFrom("Cat Tax", ["cat-tax"]), "cat-tax-2");

  // Removing the anecdote it follows clears the link instead of pointing at nothing.
  const without = removeAnecdote(state, stone.uid);
  assert.equal(anecdoteByUid(without, uid).after, "");
  assert.equal(removeImage(state, uid).anecdotes.at(-1).image, null);
});

test("translations stay on their step when steps move or are removed", () => {
  const cat = PUBLISHED_ANECDOTES.anecdotes.find((anecdote) => anecdote.id === "cat-tax");
  const [one, two, three] = cat.steps.map((step) => step.uid);
  let state = setStepText(PUBLISHED_ANECDOTES, cat.uid, two, "de", "Wähle die Feder.");
  state = setAnecdoteText(state, cat.uid, "name", "de", "Katzensteuer");
  state = moveStep(state, cat.uid, two, -1);
  assert.deepEqual(anecdoteByUid(state, cat.uid).steps.map((step) => step.uid), [two, one, three]);
  state = removeStep(state, cat.uid, one);

  const texts = exportedAnecdoteTexts(state);
  for (const code of others) {
    if (code === "de") assert.deepEqual(texts.de["cat-tax"], { name: "Katzensteuer", steps: [{ text: "Wähle die Feder." }] });
    else assert.equal(texts[code]["cat-tax"], undefined, code);
  }
  assert.deepEqual(texts[DEFAULT_LOCALE], {});
  const blocks = anecdoteTextBlocks(state);
  assert.match(blocks.de, /^      anecdoteTexts: \{\n        "cat-tax": \{\n          name: "Katzensteuer",/);
  assert.equal(countAnecdoteChanges(PUBLISHED_ANECDOTES, state), 1);

  // The published list with that translation reads back into the same draft text.
  const reread = fromAnecdoteData(exportAnecdotes(state, ANECDOTE_DATA).data, texts);
  const back = reread.anecdotes.find((anecdote) => anecdote.id === "cat-tax");
  assert.equal(back.steps[0].text.de, "Wähle die Feder.");
  assert.equal(back.name.de, "Katzensteuer");
});

test("chain links cannot loop, and anecdotes move only within their group", () => {
  const byId = (id) => PUBLISHED_ANECDOTES.anecdotes.find((anecdote) => anecdote.id === id);
  const jackals = byId("jackals-vs-dog");
  const options = afterOptions(PUBLISHED_ANECDOTES, jackals.uid).map((anecdote) => anecdote.id);
  assert.ok(!options.includes("stone-pet"), "the end of its own chain is not offered");
  assert.ok(!options.includes("jackals-vs-dog"));
  assert.ok(options.includes("river-gods-gift"));
  assert.equal(setAfter(PUBLISHED_ANECDOTES, jackals.uid, byId("stone-pet").uid), PUBLISHED_ANECDOTES);

  const lastGeneral = byId("undelivered-photos");
  assert.equal(moveAnecdote(PUBLISHED_ANECDOTES, lastGeneral.uid, 1), PUBLISHED_ANECDOTES, "it does not cross into Egyptian Tales");
  const moved = moveAnecdote(PUBLISHED_ANECDOTES, lastGeneral.uid, -1);
  assert.equal(moved.anecdotes.at(24).uid, byId("ocean-voyage-blocks").uid);
  assert.equal(countAnecdoteChanges(PUBLISHED_ANECDOTES, moved), 1, "a new order counts as one change");
});

test("problems name what blocks a clean export", () => {
  let { state, uid } = addAnecdote(PUBLISHED_ANECDOTES, "general");
  state = addSubstep(state, uid, anecdoteByUid(state, uid).steps[0].uid);
  assert.deepEqual(findAnecdoteProblems(state), [
    { code: "emptyName", group: "general" },
    { code: "emptyStep", anecdote: "—", step: 1 },
    { code: "emptySubstep", anecdote: "—", step: 1 },
  ]);
  state = setAnecdoteText(state, uid, "name", "en", "cat tax");
  state = removeStep(state, uid, anecdoteByUid(state, uid).steps[0].uid);
  // The new one sits before Egyptian Tales, so the published Cat Tax is the second of the two.
  assert.deepEqual(findAnecdoteProblems(state), [
    { code: "nothingToDo", anecdote: "cat tax" },
    { code: "duplicateName", name: "Cat Tax" },
  ]);
});

test("a saved draft loads back, and a language added later starts empty", () => {
  const { state } = addAnecdote(setImage(PUBLISHED_ANECDOTES, PUBLISHED_ANECDOTES.anecdotes[0].uid, PIXEL), "egypt");
  assert.deepEqual(parseAnecdoteDraft(JSON.stringify(state)), state);

  const old = JSON.parse(JSON.stringify(state));
  const first = old.anecdotes[0];
  first.name = { en: first.name.en };
  first.steps[0].text = { en: first.steps[0].text.en };
  const parsed = parseAnecdoteDraft(JSON.stringify(old));
  for (const code of others) {
    assert.equal(parsed.anecdotes[0].name[code], "");
    assert.equal(parsed.anecdotes[0].steps[0].text[code], "");
  }

  assert.equal(parseAnecdoteDraft(null), null);
  assert.equal(parseAnecdoteDraft("{"), null);
  assert.equal(parseAnecdoteDraft(JSON.stringify({ ...state, version: 2 })), null);
  const badImage = JSON.parse(JSON.stringify(state));
  badImage.anecdotes[0].image = { uid: "i1", data: "data:text/html;base64,AAAA" };
  assert.equal(parseAnecdoteDraft(JSON.stringify(badImage)), null);
});
