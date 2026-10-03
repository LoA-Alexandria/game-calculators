import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PUBLISHED_VOYAGE,
  ROUTE_DATA,
  SHIPWRECK_DATA,
  addCity,
  countVoyageChanges,
  exportRoutes,
  exportShipwreck,
  findVoyageProblems,
  fromVoyageData,
  parseMatrix,
  parseVoyageDraft,
  readCell,
  removeCity,
  setCargo,
  setCell,
  setCity,
  setMatrix,
  setPrice,
  setShipwreck,
} from "../lib/calculators/grand-voyage-editor.ts";

const routes = JSON.parse(readFileSync(new URL("../lib/data/grand-voyage-routes.json", import.meta.url), "utf8"));
const wreck = JSON.parse(
  readFileSync(new URL("../lib/data/grand-voyage-shipwreck-observation.json", import.meta.url), "utf8"),
);
const state = () => fromVoyageData(ROUTE_DATA, SHIPWRECK_DATA);

test("an untouched draft gives both files back exactly as they are committed", () => {
  assert.equal(JSON.stringify(exportRoutes(state())), JSON.stringify(routes));
  assert.equal(JSON.stringify(exportShipwreck(state())), JSON.stringify(wreck));
  assert.equal(countVoyageChanges(state(), state()), 0);
  assert.deepEqual(findVoyageProblems(state()), [], "the committed matrices have nothing to fix");
});

test("the matrix is as wide as the city list, both ways", () => {
  const start = state();
  assert.equal(start.cities.length, routes.cities.length);
  for (const table of ["days", "profits"]) {
    assert.equal(start[table].length, start.cities.length, table);
    for (const row of start[table]) assert.equal(row.length, start.cities.length, table);
  }
});

test("a new city brings a row and a column with it", () => {
  const next = addCity(state(), "Reykjavik");
  const size = state().cities.length + 1;
  assert.equal(next.cities.at(-1), "Reykjavik");
  for (const table of ["days", "profits"]) {
    assert.equal(next[table].length, size, table);
    for (const row of next[table]) assert.equal(row.length, size, table);
  }
  assert.deepEqual(findVoyageProblems(next), [], "empty legs are nothing, not a problem");

  // And removing it takes both away again.
  const gone = removeCity(next, size - 1);
  assert.equal(JSON.stringify(exportRoutes(gone)), JSON.stringify(routes));
});

test("removing a city takes its prices with it", () => {
  const start = state();
  const city = start.shipwreck.prices[0].city;
  const index = start.cities.indexOf(city);
  assert.ok(index >= 0);
  const gone = removeCity(start, index);
  assert.equal(gone.shipwreck.prices.some((row) => row.city === city), false);
  assert.equal(city in exportShipwreck(gone).salePrices, false);
});

test("renaming a city renames it everywhere it is named", () => {
  const start = state();
  const index = start.cities.indexOf(start.shipwreck.origin);
  const renamed = setCity(start, index, "Shipwreck Bay");
  assert.equal(renamed.shipwreck.origin, "Shipwreck Bay");
  assert.equal(exportShipwreck(renamed).origin, "Shipwreck Bay");
  assert.deepEqual(findVoyageProblems(renamed), [], "nothing points at the old name");
});

test("a cell that is not a number is named, and a leg to itself is too", () => {
  const start = state();
  const bad = setCell(start, "profits", 0, 1, "lots");
  assert.deepEqual(findVoyageProblems(bad), [
    { code: "badCell", table: "profits", from: start.cities[0], to: start.cities[1] },
  ]);
  const self = setCell(start, "days", 2, 2, "0.5");
  assert.deepEqual(findVoyageProblems(self), [{ code: "selfLeg", city: start.cities[2] }]);
  // Money may be lost on a leg; time may not run backwards.
  assert.deepEqual(findVoyageProblems(setCell(start, "profits", 0, 1, "-500")), []);
  assert.deepEqual(findVoyageProblems(setCell(start, "days", 0, 1, "-0.5")), [
    { code: "negativeDays", from: start.cities[0], to: start.cities[1] },
  ]);
});

test("a box takes a number however a spreadsheet wrote it", () => {
  assert.equal(readCell("0.08366898148148148"), 0.08366898148148148);
  assert.equal(readCell("0,125"), 0.125, "a German decimal comma");
  assert.equal(readCell(" 388200 "), 388200);
  assert.equal(readCell(""), null);
  assert.equal(readCell("lots"), null);
  assert.equal(readCell("-29460"), -29460, "a leg can lose money");
});

test("a pasted block has to be exactly the size of the matrix", () => {
  const size = state().cities.length;
  const square = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => String(row * size + column)),
  );
  const pasted = parseMatrix(square.map((row) => row.join("\t")).join("\n"), size);
  assert.equal(pasted.ok, true);
  assert.deepEqual(pasted.rows, square);

  assert.deepEqual(parseMatrix("", size), { ok: false, reason: "empty", rows: 0, columns: 0 });
  const short = parseMatrix("1\t2\n3\t4", size);
  assert.equal(short.ok, false);
  assert.equal(short.reason, "size");
  assert.equal(short.rows, 2);

  // Semicolons and wide gaps separate cells as well as tabs do.
  const two = parseMatrix("1;2\n3;4", 2);
  assert.deepEqual(two.rows, [["1", "2"], ["3", "4"]]);
});

test("a pasted matrix replaces the table it was pasted into", () => {
  const start = state();
  const size = start.cities.length;
  const zeros = Array.from({ length: size }, () => Array.from({ length: size }, () => "0"));
  const next = setMatrix(start, "profits", zeros);
  assert.equal(exportRoutes(next).profits.flat().every((value) => value === 0), true);
  assert.equal(
    JSON.stringify(exportRoutes(next).time_days),
    JSON.stringify(routes.time_days),
    "the other table is untouched",
  );
});

test("the observed cargo and its prices travel together", () => {
  const start = state();
  const good = start.shipwreck.cargo[0].good;
  const city = start.shipwreck.prices[0].city;
  let next = setCargo(start, 0, { quantity: "40" });
  next = setPrice(next, city, 0, "34000");
  next = setShipwreck(next, { effectiveDate: "2026-09-28 observation" });
  const written = exportShipwreck(next);
  assert.equal(written.cargo[good].quantity, 40);
  assert.equal(written.salePrices[city][good], 34000);
  assert.equal(written.effectiveDate, "2026-09-28 observation");
  assert.equal(countVoyageChanges(start, next), 1, "one change: the observation");
});

test("a price for a city the routes do not have is named", () => {
  const start = state();
  const stray = {
    ...start,
    shipwreck: { ...start.shipwreck, prices: [...start.shipwreck.prices, { city: "Atlantis", prices: ["1", "2", "3"] }] },
  };
  assert.deepEqual(findVoyageProblems(stray), [{ code: "unknownPriceCity", city: "Atlantis" }]);
});

test("a draft survives a reload, and nonsense does not load at all", () => {
  const next = setCell(state(), "days", 0, 1, "0.09");
  assert.deepEqual(parseVoyageDraft(JSON.stringify(next)), next);
  assert.equal(parseVoyageDraft("not json"), null);
  assert.equal(parseVoyageDraft(null), null);
  assert.equal(parseVoyageDraft(JSON.stringify({ ...next, version: 2 })), null);
  const ragged = { ...next, days: [...next.days.slice(1)] };
  assert.equal(parseVoyageDraft(JSON.stringify(ragged)), null, "the matrix has to stay square");
});

test("what is published is what the planner uses right now", () => {
  assert.equal(JSON.stringify(exportRoutes(PUBLISHED_VOYAGE)), JSON.stringify(routes));
  assert.equal(JSON.stringify(exportShipwreck(PUBLISHED_VOYAGE)), JSON.stringify(wreck));
});
