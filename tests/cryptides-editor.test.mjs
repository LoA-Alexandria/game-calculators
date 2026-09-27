import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PUBLISHED_CRYPTIDES,
  addCryptide,
  addRow,
  catalogsFromDictionaries,
  changedTextLocales,
  countCryptideChanges,
  cryptideTextBlocks,
  exportCryptides,
  exportIds,
  exportedCryptideTexts,
  findCryptideProblems,
  moveCryptide,
  moveRow,
  parseCryptidesDraft,
  removeCryptide,
  removeRow,
  serializeCryptidesData,
  setCryptideName,
  setFoodGrowth,
  setPortrait,
  setRowImage,
  setSkillText,
  setStageImage,
  setTalent,
} from "../lib/content/cryptides-editor.ts";
import { CRYPTID_STAGES, CRYPTIDES_DATA } from "../lib/content/cryptides.ts";
import { LOCALE_CODES } from "../lib/i18n/index.ts";

const FILE = readFileSync(new URL("../lib/data/cryptides.json", import.meta.url), "utf8");
const PNG = "data:image/webp;base64,UklGRg==";

/** Reads a `cryptideTexts:` block back into the object it describes. */
function evaluate(block) {
  const body = block.trim().replace(/^cryptideTexts:\s*/, "").replace(/,$/, "");
  return Function(`"use strict"; return (${body});`)();
}

test("an untouched draft gives back the JSON byte for byte and every language's texts", () => {
  const result = exportCryptides(PUBLISHED_CRYPTIDES, CRYPTIDES_DATA);
  assert.equal(serializeCryptidesData(result.data), FILE);
  assert.deepEqual(result.uploads, []);
  assert.deepEqual(result.removedFiles, []);
  const published = catalogsFromDictionaries();
  const texts = exportedCryptideTexts(PUBLISHED_CRYPTIDES);
  const blocks = cryptideTextBlocks(PUBLISHED_CRYPTIDES);
  for (const locale of LOCALE_CODES) {
    assert.deepEqual(texts[locale], published[locale], locale);
    assert.deepEqual(evaluate(blocks[locale]), published[locale], `${locale} block`);
  }
  assert.deepEqual(changedTextLocales(PUBLISHED_CRYPTIDES), []);
  assert.equal(countCryptideChanges(PUBLISHED_CRYPTIDES, PUBLISHED_CRYPTIDES), 0);
  assert.deepEqual(findCryptideProblems(PUBLISHED_CRYPTIDES), []);
});

test("a German skill text changes only the German block", () => {
  const nidhogg = PUBLISHED_CRYPTIDES.cryptides.find((cryptide) => cryptide.id === "nidhogg");
  const skill = nidhogg.skills[0];
  const state = setSkillText(PUBLISHED_CRYPTIDES, nidhogg.uid, skill.uid, "body", "de", "Neuer Text.");
  assert.deepEqual(changedTextLocales(state), ["de"]);
  assert.equal(exportedCryptideTexts(state).de.nidhogg.skills["fireball-hail"].body, "Neuer Text.");
  assert.equal(serializeCryptidesData(exportCryptides(state, CRYPTIDES_DATA).data), FILE, "the JSON does not change");
  assert.equal(countCryptideChanges(PUBLISHED_CRYPTIDES, state), 1);
});

test("a new Cryptide gets ids from its English names and pictures named after them", () => {
  let { state, uid } = addCryptide(PUBLISHED_CRYPTIDES);
  state = setCryptideName(state, uid, "en", "Jörmungandr");
  state = setCryptideName(state, uid, "de", "Midgardschlange");
  const added = state.cryptides.at(-1);
  state = setPortrait(state, uid, { data: PNG });
  state = setSkillText(state, uid, added.skills[0].uid, "name", "en", "Tidal Coil");
  state = setRowImage(state, uid, "skills", added.skills[0].uid, { data: PNG });
  const ids = exportIds(state);
  assert.equal(ids.get(uid), "jormungandr");
  assert.equal(ids.get(added.skills[0].uid), "tidal-coil");
  assert.equal(ids.get(added.skills[1].uid), "skill-2", "an unnamed skill still gets an id");
  const result = exportCryptides(state, CRYPTIDES_DATA);
  const row = result.data.cryptides.at(-1);
  assert.equal(row.id, "jormungandr");
  assert.equal(row.name, "Jörmungandr");
  assert.equal(row.image, "jormungandr.webp");
  assert.equal(row.skills[0].image, "skills/jormungandr-1.webp");
  assert.deepEqual(row.foods.map((food) => food.growth), [10, 30, 100]);
  assert.deepEqual(result.uploads.map((upload) => upload.file), ["jormungandr.webp", "skills/jormungandr-1.webp"]);
  const texts = exportedCryptideTexts(state);
  assert.equal(texts.de.jormungandr.name, "Midgardschlange");
  assert.equal(texts.fr.jormungandr.name, "Jörmungandr", "an empty translation takes the English name");
  assert.ok(findCryptideProblems(state).some((problem) => problem.code === "missingIcon"));
});

test("stage art is named after the rung, and a half-filled ladder is warned about", () => {
  const published = PUBLISHED_CRYPTIDES.cryptides.find((cryptide) => cryptide.id === "nidhogg");
  assert.deepEqual(published.stages.map((slot) => slot.stage), [...CRYPTID_STAGES]);
  assert.deepEqual(published.stages.map((slot) => slot.image?.file), [
    "evolution/nidhogg-1.webp", "evolution/nidhogg-2.webp", "evolution/nidhogg-3.webp",
    "evolution/nidhogg-4.webp", "evolution/nidhogg-5.webp", "evolution/nidhogg-6.webp",
  ]);

  // The fourth rung gets a new picture; it is named for the rung, not for the
  // order of the upload, so it lands on top of the file it replaces.
  const art = "data:image/webp;base64,AAA=";
  const state = setStageImage(PUBLISHED_CRYPTIDES, published.uid, "adult", { data: art });
  const result = exportCryptides(state, CRYPTIDES_DATA);
  assert.deepEqual(result.uploads.map((upload) => upload.file), ["evolution/nidhogg-4.webp"]);
  assert.deepEqual(result.removedFiles, [], "an overwritten picture is not a deleted one");
  const row = result.data.cryptides.find((cryptide) => cryptide.id === "nidhogg");
  assert.deepEqual(row.stages.map((entry) => entry.stage), [...CRYPTID_STAGES]);

  // A rung left empty drops out of the JSON, and the export says so.
  const gap = setStageImage(PUBLISHED_CRYPTIDES, published.uid, "adult", null);
  const gapped = exportCryptides(gap, CRYPTIDES_DATA).data.cryptides.find((cryptide) => cryptide.id === "nidhogg");
  assert.deepEqual(gapped.stages.map((entry) => entry.stage), CRYPTID_STAGES.filter((stage) => stage !== "adult"));
  assert.ok(findCryptideProblems(gap).some((problem) => problem.code === "partialLadder"));
  assert.ok(!findCryptideProblems(PUBLISHED_CRYPTIDES).some((problem) => problem.code === "partialLadder"));
});

test("removing a Cryptide lists its pictures for deletion; order and rows move", () => {
  const cerberus = PUBLISHED_CRYPTIDES.cryptides.find((cryptide) => cryptide.id === "cerberus");
  const removed = exportCryptides(removeCryptide(PUBLISHED_CRYPTIDES, cerberus.uid), CRYPTIDES_DATA);
  assert.deepEqual(removed.removedFiles.sort(), [
    "cerberus.webp",
    "evolution/cerberus-1.webp", "evolution/cerberus-2.webp", "evolution/cerberus-3.webp",
    "evolution/cerberus-4.webp", "evolution/cerberus-5.webp", "evolution/cerberus-6.webp",
    "foods/cerberus-1.webp", "foods/cerberus-2.webp", "foods/cerberus-3.webp",
    "skills/cerberus-1.webp", "skills/cerberus-2.webp", "skills/cerberus-3.webp",
  ]);

  const first = PUBLISHED_CRYPTIDES.cryptides[0];
  const moved = moveCryptide(PUBLISHED_CRYPTIDES, first.uid, 1);
  assert.equal(moved.cryptides[1].uid, first.uid);
  assert.equal(countCryptideChanges(PUBLISHED_CRYPTIDES, moved), 1);

  const skills = moveRow(PUBLISHED_CRYPTIDES, first.uid, "skills", first.skills[0].uid, 1);
  assert.equal(skills.cryptides[0].skills[1].uid, first.skills[0].uid);
  const fewer = removeRow(PUBLISHED_CRYPTIDES, first.uid, "foods", first.foods[2].uid);
  assert.equal(fewer.cryptides[0].foods.length, 2);
  const more = addRow(PUBLISHED_CRYPTIDES, first.uid, "foods");
  assert.equal(more.cryptides[0].foods.length, 4);
});

test("bad numbers are warned about and fall back in the export", () => {
  const first = PUBLISHED_CRYPTIDES.cryptides[0];
  let state = setFoodGrowth(PUBLISHED_CRYPTIDES, first.uid, first.foods[0].uid, "ten");
  state = setTalent(state, "dropAmount", "");
  const codes = findCryptideProblems(state).map((problem) => problem.code);
  assert.ok(codes.includes("badGrowth"));
  assert.ok(codes.includes("badTalent"));
  assert.equal(exportCryptides(state, CRYPTIDES_DATA).data.talent.dropAmount, CRYPTIDES_DATA.talent.dropAmount);
});

test("a stored draft is read back, an unknown one is dropped", () => {
  const first = PUBLISHED_CRYPTIDES.cryptides[0];
  const state = setCryptideName(PUBLISHED_CRYPTIDES, first.uid, "fr", "Nidhögg");
  const back = parseCryptidesDraft(JSON.stringify(state));
  assert.deepEqual(back, state);
  assert.equal(parseCryptidesDraft(JSON.stringify({ version: 2 })), null);
  assert.equal(parseCryptidesDraft("{"), null);
  assert.equal(parseCryptidesDraft(null), null);
});
