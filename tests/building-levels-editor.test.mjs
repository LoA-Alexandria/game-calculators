import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  COST_RESOURCES,
  PUBLISHED_LEVELS,
  addRow,
  buildingOf,
  countLevelChanges,
  exportLevels,
  findLevelProblems,
  formatCosts,
  fromLevelsData,
  parseCosts,
  parseLevelsDraft,
  removeRow,
  serializeLevelsData,
  setRow,
  setStages,
} from "../lib/content/building-levels-editor.ts";
import { BUILDING_LEVELS } from "../lib/content/building-levels.ts";
import { BUILDINGS } from "../lib/content/buildings.ts";

const committed = JSON.parse(readFileSync(new URL("../lib/data/building-levels.json", import.meta.url), "utf8"));
const state = () => fromLevelsData(BUILDING_LEVELS);
const first = () => state().buildings[0];

test("an untouched draft gives the file back exactly as it is committed", () => {
  // 4,598 rows: compared as text, so a failure reports in a moment rather
  // than spending a minute building a diff of the whole file.
  assert.equal(JSON.stringify(exportLevels(state())), JSON.stringify(committed));
  assert.equal(countLevelChanges(state(), state()), 0);
  assert.deepEqual(findLevelProblems(state()), [], "the committed tables have nothing to fix");
});

test("every building with a table is one the roster has", () => {
  const known = new Set(BUILDINGS.map((building) => building.id));
  for (const id of Object.keys(committed)) assert.ok(known.has(id), id);
});

test("costs read back the way they were written", () => {
  const row = first().rows.find((entry) => entry.upgrade.includes("\n")) ?? first().rows[0];
  assert.deepEqual(parseCosts(row.upgrade), committed[first().id].levels.find((entry) => String(entry.level) === row.level).upgrade);
  assert.equal(formatCosts([{ resource: "land", amount: "1,080" }]), "land 1,080");
  assert.deepEqual(parseCosts("land 210\nwood 103"), [
    { resource: "land", amount: "210" },
    { resource: "wood", amount: "103" },
  ]);
  assert.deepEqual(parseCosts("  land 210  \n\n"), [{ resource: "land", amount: "210" }], "blank lines are ignored");
  assert.deepEqual(parseCosts(""), []);
});

test("a cost that cannot be read is refused rather than guessed", () => {
  // A comma cannot separate two costs: the amounts have commas in them.
  assert.equal(parseCosts("land 210, wood 103"), null);
  assert.equal(parseCosts("gold 5"), null, "a resource the game does not have");
  assert.equal(parseCosts("land"), null, "an amount is missing");
  assert.equal(parseCosts("land lots"), null);
  assert.equal(parseCosts("land -5"), null);
  assert.deepEqual(parseCosts("wood 1.39M"), [{ resource: "wood", amount: "1.39M" }], "the game's own shorthand");
  assert.deepEqual(parseCosts("stone 42.10T"), [{ resource: "stone", amount: "42.10T" }]);
  assert.ok(COST_RESOURCES.includes("land") && COST_RESOURCES.includes("precisionParts"));
});

test("an unreadable cost is named, and does not reach the file", () => {
  const building = first();
  const row = building.rows[0];
  const broken = setRow(state(), building.id, row.uid, { upgrade: "land 210, wood 103" });
  assert.deepEqual(findLevelProblems(broken), [
    { code: "badCosts", id: building.id, level: row.level, kind: "upgrade" },
  ]);
  const written = exportLevels(broken)[building.id].levels[0];
  assert.equal("upgrade" in written, false, "rather than half a cost list");
});

test("a new row carries on from the last level", () => {
  const building = first();
  const highest = Math.max(...building.rows.map((row) => Number(row.level)));
  const { state: next, uid } = addRow(state(), building.id);
  const added = buildingOf(next, building.id).rows.at(-1);
  assert.equal(added.uid, uid);
  assert.equal(added.level, String(highest + 1));
  assert.equal(countLevelChanges(state(), next), 1);

  const gone = removeRow(next, building.id, uid);
  assert.equal(countLevelChanges(state(), gone), 0, "and taking it back leaves nothing behind");
});

test("two rows on one level are a problem", () => {
  const building = first();
  const { state: next, uid } = addRow(state(), building.id);
  const clash = setRow(next, building.id, uid, { level: building.rows[0].level });
  assert.ok(findLevelProblems(clash).some((problem) => problem.code === "duplicateLevel"));
});

test("a stage picture has to live where the guide looks for it", () => {
  const building = first();
  const ok = setStages(state(), building.id, building.stages.join("\n"));
  assert.deepEqual(findLevelProblems(ok), []);
  const stray = setStages(state(), building.id, "elsewhere/tent-1.webp");
  assert.deepEqual(findLevelProblems(stray), [
    { code: "strayStage", id: building.id, path: "elsewhere/tent-1.webp" },
  ]);
  assert.deepEqual(exportLevels(stray)[building.id].stages, ["elsewhere/tent-1.webp"]);
});

test("an empty box leaves the field out rather than writing an empty one", () => {
  const building = first();
  const row = building.rows.find((entry) => entry.population) ?? building.rows[0];
  const cleared = setRow(state(), building.id, row.uid, { population: "  " });
  const written = exportLevels(cleared)[building.id].levels.find((entry) => String(entry.level) === row.level);
  assert.equal("population" in written, false);
});

test("the file is written the way it is committed", () => {
  const text = serializeLevelsData(exportLevels(state()));
  assert.equal(JSON.stringify(JSON.parse(text)), JSON.stringify(committed));
  assert.equal(text, `${readFileSync(new URL("../lib/data/building-levels.json", import.meta.url), "utf8").trim()}\n`);
});

test("a draft survives a reload, and nonsense does not load at all", () => {
  const next = setRow(state(), first().id, first().rows[0].uid, { civIndex: "49" });
  assert.deepEqual(parseLevelsDraft(JSON.stringify(next)), next);
  assert.equal(parseLevelsDraft("not json"), null);
  assert.equal(parseLevelsDraft(null), null);
  assert.equal(parseLevelsDraft(JSON.stringify({ ...next, version: 2 })), null);
  const badRow = {
    ...next,
    buildings: [{ ...next.buildings[0], rows: [{ ...next.buildings[0].rows[0], level: 4 }] }, ...next.buildings.slice(1)],
  };
  assert.equal(parseLevelsDraft(JSON.stringify(badRow)), null, "a level has to stay a string");
});

test("what is published is what the guide shows right now", () => {
  assert.equal(JSON.stringify(exportLevels(PUBLISHED_LEVELS)), JSON.stringify(committed));
});
