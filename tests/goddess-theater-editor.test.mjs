import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { THEATER_DATA } from "../lib/content/goddess-theater.ts";
import {
  addPlay,
  addRole,
  countChanges,
  countTheaterChanges,
  exportTheater,
  exportedPlayTexts,
  findProblems,
  fromTheaterData,
  movePlay,
  parseDraft,
  playByUid,
  playTextOf,
  removeCover,
  removePlay,
  removeRole,
  serializeTheaterData,
  setCover,
  setPlayName,
  setRoleName,
  setTutorial,
  textBlocks,
  unusedGoddesses,
  updatePlay,
  updateRole,
} from "../lib/content/goddess-theater-editor.ts";

const published = fromTheaterData(THEATER_DATA);

test("the published file is exactly what the editor exports for an untouched draft", () => {
  const onDisk = readFileSync(new URL("../lib/data/goddess-theater.json", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const result = exportTheater(fromTheaterData(THEATER_DATA), THEATER_DATA);
  assert.equal(serializeTheaterData(result.data), onDisk);
  assert.equal(countChanges(THEATER_DATA, result.data), 0);
  assert.deepEqual(result.uploads, []);
  assert.deepEqual(result.removedFiles, []);
});

test("the published theatre has no editor problems", () => {
  assert.deepEqual(findProblems(fromTheaterData(THEATER_DATA)), []);
});

test("adding a play, assigning a Core goddess, and removing them round-trips", () => {
  const added = addPlay(published, "New Play");
  const named = updatePlay(added.state, added.uid, { name: "New Play" });
  const withRole = addRole(named, added.uid, "Eve");
  const role = playByUid(withRole, added.uid).roles[0];
  const filled = updateRole(withRole, added.uid, role.uid, { role: "Lead", relevant: true });
  assert.equal(playByUid(filled, added.uid).roles[0].goddess, "Eve");
  const exported = exportTheater(filled, THEATER_DATA);
  const created = exported.data.plays.find((play) => play.id === "new-play");
  assert.equal(created?.roles[0].goddess, "Eve");
  assert.equal(created?.roles[0].relevant, true);
  assert.equal(countChanges(THEATER_DATA, exported.data) > 0, true);
  const withoutRole = removeRole(filled, added.uid, role.uid);
  const removed = removePlay(withoutRole, added.uid);
  assert.equal(countChanges(THEATER_DATA, exportTheater(removed, THEATER_DATA).data), 0);
});

test("goddesses already in a play are skipped, and names must come from the Core roster", () => {
  const peter = published.plays.find((play) => play.id === "peter-pan");
  assert.ok(peter);
  assert.equal(unusedGoddesses(peter).some((goddess) => peter.roles.some((row) => row.goddess === goddess.name)), false);
  const duplicate = addRole(published, peter.uid, "Eve");
  assert.equal(playByUid(duplicate, peter.uid).roles.filter((row) => row.goddess === "Eve").length, 1);
  const unknown = addRole(published, peter.uid, "Achilles");
  assert.equal(playByUid(unknown, peter.uid).roles.some((row) => row.goddess === "Achilles"), false);
});

test("plays can be added, renamed, reordered, and deleted, but the last one stays", () => {
  const created = addPlay(published, "Test Play");
  const renamed = updatePlay(created.state, created.uid, { name: "Test Play" });
  assert.equal(playByUid(renamed, created.uid).name, "Test Play");
  const moved = movePlay(renamed, created.uid, 0);
  assert.equal(moved.plays[0].uid, created.uid);
  const dropped = removePlay(moved, created.uid);
  assert.equal(dropped.plays.some((play) => play.uid === created.uid), false);
  const only = { ...published, plays: [published.plays[0]] };
  assert.equal(removePlay(only, published.plays[0].uid).plays.length, 1);
});

test("a tutorial play drops its cast on export, and a missing cover is reported", () => {
  const musketeers = published.plays.find((play) => play.id === "three-musketeers");
  assert.ok(musketeers);
  const withRole = addRole(published, musketeers.uid, "Hera");
  const exported = exportTheater(withRole, THEATER_DATA);
  assert.deepEqual(exported.data.plays.find((play) => play.id === "three-musketeers")?.roles, []);
  const uncovered = removeCover(published, musketeers.uid);
  assert.equal(findProblems(uncovered).some((problem) => problem.code === "missingCover"), true);
  const png = "data:image/png;base64,AAAA";
  assert.equal(setCover(published, musketeers.uid, png).plays.find((play) => play.uid === musketeers.uid)?.cover?.data, png);
  const tutorial = setTutorial(published, published.plays[0].uid, true);
  assert.equal(playByUid(tutorial, published.plays[0].uid).unlock, "tutorial");
});

test("stored drafts are validated before use", () => {
  assert.equal(parseDraft(JSON.stringify(published))?.version, 2);
  assert.equal(parseDraft("{"), null);
  assert.equal(parseDraft(JSON.stringify({ ...published, version: 1 })), null);
});

test("English names stay in the JSON; other languages export playTexts", () => {
  const monte = published.plays.find((play) => play.id === "count-of-monte-cristo");
  assert.ok(monte);
  const german = setPlayName(published, monte.uid, "de", "Der Graf von Monte Christo");
  const named = setRoleName(german, monte.uid, "Fortuna", "de", "Edmond");
  const exported = exportTheater(named, THEATER_DATA);
  assert.equal(exported.data.plays.find((play) => play.id === "count-of-monte-cristo")?.name, "The Count of Monte Cristo");
  assert.equal(countChanges(THEATER_DATA, exported.data), 0);
  assert.equal(countTheaterChanges(published, named) > 0, true);
  assert.equal(exportedPlayTexts(named).de["count-of-monte-cristo"].name, "Der Graf von Monte Christo");
  assert.equal(exportedPlayTexts(named).de["count-of-monte-cristo"].roles.Fortuna, "Edmond");
  assert.equal(textBlocks(published).de, "      playTexts: {},");
  assert.match(textBlocks(named).de, /Der Graf von Monte Christo/);
  assert.equal(playTextOf(named, "fr", monte.uid).name, "");
});
