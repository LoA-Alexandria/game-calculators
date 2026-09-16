import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PUBLISHED_GODDESSES,
  addGoddess,
  addImage,
  countGoddessDraftChanges,
  exportGoddesses,
  exportedGoddessTexts,
  findGoddessProblems,
  goddessByUid,
  goddessIdFrom,
  goddessTextBlocks,
  goddessTextOf,
  makePortrait,
  moveGoddess,
  parseGoddessDraft,
  removeGoddess,
  removeImage,
  serializeGoddessData,
  setGoddessText,
  updateGoddess,
} from "../lib/content/goddess-editor.ts";
import { GODDESS_DATA } from "../lib/content/goddesses.ts";
import { getDictionary } from "../lib/i18n/index.ts";

const WEBP = "data:image/webp;base64,UklGRg==";
const uidOf = (state, name) => state.goddesses.find((goddess) => goddess.name === name).uid;

test("an untouched draft exports the published roster and dictionaries byte for byte", () => {
  const state = PUBLISHED_GODDESSES;
  const result = exportGoddesses(state, GODDESS_DATA);
  assert.deepEqual(result.data, GODDESS_DATA);
  assert.equal(result.uploads.length, 0);
  assert.equal(result.removedFiles.length, 0);
  assert.equal(serializeGoddessData(result.data), readFileSync(new URL("../lib/data/goddesses.json", import.meta.url), "utf8"));
  assert.equal(countGoddessDraftChanges(PUBLISHED_GODDESSES, state), 0);
  assert.deepEqual(findGoddessProblems(state, GODDESS_DATA), []);

  const blocks = goddessTextBlocks(state);
  assert.equal(blocks.en, "      goddessTexts: {},");
  for (const code of ["de", "fr"]) {
    const dictionary = readFileSync(new URL(`../lib/i18n/dictionaries/${code}.ts`, import.meta.url), "utf8");
    assert.ok(dictionary.includes(blocks[code]), `${code} dictionary contains its exported block`);
    assert.deepEqual(exportedGoddessTexts(state)[code], getDictionary(code).guideEntries.goddesses.goddessTexts);
  }
});

test("a new goddess gets an id, a picture file, and stays grouped by rarity", () => {
  let { state, uid } = addGoddess(PUBLISHED_GODDESSES, "SR", "Selene");
  state = addImage(state, uid, WEBP);
  state = addImage(state, uid, "not a picture");
  state = setGoddessText(state, uid, "en", "obtain", " Moon event ");
  state = setGoddessText(state, uid, "de", "obtain", "Mond-Event");
  state = updateGoddess(state, uid, { mark: "unconfirmed", skinRaisesToSsr: true });

  const rarities = state.goddesses.map((goddess) => goddess.rarity);
  assert.deepEqual(rarities, [...rarities].sort((a, b) => ["SSR", "SR", "R"].indexOf(a) - ["SSR", "SR", "R"].indexOf(b)));

  const result = exportGoddesses(state, GODDESS_DATA);
  const selene = result.data.goddesses.find((goddess) => goddess.name === "Selene");
  assert.deepEqual(selene, {
    id: "selene",
    name: "Selene",
    rarity: "SR",
    affinity: "",
    obtain: "Moon event",
    images: ["selene.webp"],
    skinRaisesTo: "SSR",
    unconfirmed: true,
  });
  assert.deepEqual(result.uploads.map((upload) => upload.file), ["selene.webp"]);
  assert.deepEqual(exportedGoddessTexts(state).de.selene, { obtain: "Mond-Event" });
  assert.equal(goddessTextOf(state, "en", uid).obtain, " Moon event ");
  assert.equal(countGoddessDraftChanges(PUBLISHED_GODDESSES, state), 2);
});

test("ids and picture names never collide with the published roster", () => {
  assert.equal(goddessIdFrom("Hera", ["hera"]), "hera-2");
  assert.equal(goddessIdFrom("Hélène!", []), "helene");
  let state = addImage(PUBLISHED_GODDESSES, uidOf(PUBLISHED_GODDESSES, "Venus"), WEBP);
  const venus = exportGoddesses(state, GODDESS_DATA).data.goddesses.find((goddess) => goddess.id === "venus");
  assert.deepEqual(venus.images, ["venus.webp", "venus-2.webp"]);
  state = makePortrait(state, uidOf(state, "Venus"), goddessByUid(state, uidOf(state, "Venus")).images[1].uid);
  assert.equal(exportGoddesses(state, GODDESS_DATA).data.goddesses.find((goddess) => goddess.id === "venus").images[0], "venus-2.webp");
});

test("rarity changes move a goddess into her new group; moves stay within a rarity", () => {
  const uid = uidOf(PUBLISHED_GODDESSES, "Nike");
  const raised = updateGoddess(PUBLISHED_GODDESSES, uid, { rarity: "SSR" });
  const ssr = raised.goddesses.filter((goddess) => goddess.rarity === "SSR");
  assert.equal(ssr.at(-1).name, "Nike");
  const first = PUBLISHED_GODDESSES.goddesses[0];
  assert.equal(moveGoddess(PUBLISHED_GODDESSES, first.uid, -1), PUBLISHED_GODDESSES, "the first SSR cannot move up");
  const moved = moveGoddess(PUBLISHED_GODDESSES, first.uid, 1);
  assert.equal(moved.goddesses[1].uid, first.uid);
});

test("removing or renaming a goddess other guides name is flagged, and banner pictures are protected", () => {
  const hera = uidOf(PUBLISHED_GODDESSES, "Hera");
  const renamed = updateGoddess(PUBLISHED_GODDESSES, hera, { name: "Juno" });
  const problem = findGoddessProblems(renamed, GODDESS_DATA).find((entry) => entry.code === "stillUsed");
  assert.equal(problem?.name, "Hera");
  assert.ok(problem.where.includes("theater"));

  const bastet = uidOf(PUBLISHED_GODDESSES, "Bastet");
  const removed = removeGoddess(PUBLISHED_GODDESSES, bastet);
  const bastetProblem = findGoddessProblems(removed, GODDESS_DATA).find((entry) => entry.code === "stillUsed" && entry.name === "Bastet");
  assert.ok(bastetProblem?.where.includes("leveling"), "the upgrade order names Bastet by id");

  const athena = uidOf(PUBLISHED_GODDESSES, "Athena");
  const image = goddessByUid(PUBLISHED_GODDESSES, athena).images[0].uid;
  const withoutPortrait = removeImage(PUBLISHED_GODDESSES, athena, image);
  assert.deepEqual(exportGoddesses(withoutPortrait, GODDESS_DATA).removedFiles, ["athena.webp"]);
  assert.ok(findGoddessProblems(withoutPortrait, GODDESS_DATA).some((entry) => entry.code === "bannerImage" && entry.file === "athena.webp"));

  const empty = addGoddess(PUBLISHED_GODDESSES, "R").state;
  assert.ok(findGoddessProblems(empty, GODDESS_DATA).some((entry) => entry.code === "emptyName" && entry.rarity === "R"));
  const twice = addGoddess(PUBLISHED_GODDESSES, "R", "nike").state;
  assert.ok(findGoddessProblems(twice, GODDESS_DATA).some((entry) => entry.code === "duplicateName"));
});

test("a stored draft round-trips, and a damaged one is ignored", () => {
  let { state, uid } = addGoddess(PUBLISHED_GODDESSES, "R", "Selene");
  state = addImage(state, uid, WEBP);
  state = setGoddessText(state, uid, "fr", "affinity", "Bonus lunaire");
  assert.deepEqual(parseGoddessDraft(JSON.stringify(state)), state);
  assert.equal(parseGoddessDraft(null), null);
  assert.equal(parseGoddessDraft("{"), null);
  assert.equal(parseGoddessDraft(JSON.stringify({ ...state, version: 2 })), null);
  const badMark = { ...state, goddesses: state.goddesses.map((goddess, index) => (index === 0 ? { ...goddess, mark: "gone" } : goddess)) };
  assert.equal(parseGoddessDraft(JSON.stringify(badMark)), null);
});
