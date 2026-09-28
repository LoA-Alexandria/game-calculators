import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  APTITUDE_IDS,
  PUBLISHED_INCOME,
  countIncomeChanges,
  exportIncome,
  findIncomeProblems,
  fromIncomeData,
  missingNumbers,
  parseIncomeDraft,
  readNumber,
  serializeIncomeData,
  setPlay,
  toggleGoddessAptitude,
  togglePlayAptitude,
} from "../lib/calculators/theater-income-editor.ts";
import { INCOME_PLAYS, incomeFrom } from "../lib/calculators/theater-income.ts";
import { THEATER_PLAYS } from "../lib/content/goddess-theater.ts";

const committed = JSON.parse(readFileSync(new URL("../lib/data/theater-income.json", import.meta.url), "utf8"));
const state = () => fromIncomeData(committed);

test("an untouched draft gives the file back exactly as it is committed", () => {
  assert.deepEqual(exportIncome(state()), committed);
  assert.equal(countIncomeChanges(state(), state()), 0);
  assert.deepEqual(findIncomeProblems(state()), [], "the committed file has nothing to fix");
});

test("every committed play is one the theater guide has", () => {
  // The guard behind the page: a play the guide does not name has no title and
  // is left out, so the income list would quietly shrink.
  const known = new Set(THEATER_PLAYS.map((play) => play.id));
  for (const play of committed.plays) assert.ok(known.has(play.id), play.id);
  assert.equal(incomeFrom(committed).plays.length, committed.plays.length);
});

test("a play that is not in the guide is left out rather than thrown over", () => {
  const withGhost = { ...committed, plays: [...committed.plays, { id: "not-a-play", rarity: "UR" }] };
  assert.equal(incomeFrom(withGhost).plays.length, committed.plays.length, "the page still opens");
  assert.ok(findIncomeProblems(fromIncomeData(withGhost)).some((problem) => problem.code === "unknownPlay"));
});

test("the numbers this editor exists for", () => {
  // The plays whose base numbers nobody has read off the game yet; typing
  // them is the whole point of this editor.
  const missing = missingNumbers(state());
  const withoutNumbers = committed.plays.filter((play) => play.ticket === undefined || play.visitors === undefined);
  assert.equal(missing.length, withoutNumbers.length);
  assert.ok(missing.length > 0, "nothing left to type would make this editor pointless");

  let next = state();
  const play = next.plays.find((entry) => entry.uid === missing[0].uid);
  next = setPlay(next, play.uid, { ticket: "480", visitors: "510" });
  assert.equal(missingNumbers(next).length, withoutNumbers.length - 1);
  const written = exportIncome(next).plays.find((entry) => entry.id === play.id);
  assert.equal(written.ticket, 480);
  assert.equal(written.visitors, 510);
  assert.equal(countIncomeChanges(state(), next), 1);
});

test("half a row is a problem, because it reads as known and is not", () => {
  const missing = missingNumbers(state())[0];
  const half = setPlay(state(), missing.uid, { ticket: "480" });
  assert.deepEqual(findIncomeProblems(half), [{ code: "halfRow", id: missing.id }]);
  assert.equal("ticket" in exportIncome(half).plays.find((play) => play.id === missing.id), true);
});

test("a box takes a whole number or nothing at all", () => {
  assert.equal(readNumber("480"), 480);
  assert.equal(readNumber(" 480 "), 480);
  assert.equal(readNumber("480.4"), 480);
  assert.equal(readNumber(""), undefined);
  assert.equal(readNumber("  "), undefined);
  assert.equal(readNumber("-5"), undefined);
  assert.equal(readNumber("0"), undefined);
  assert.equal(readNumber("lots"), undefined);
});

test("aptitudes keep the file's order however they are ticked", () => {
  const first = state().plays[0];
  let next = togglePlayAptitude(state(), first.uid, APTITUDE_IDS[5]);
  next = togglePlayAptitude(next, first.uid, APTITUDE_IDS[1]);
  const written = exportIncome(next).plays[0].aptitudes;
  assert.deepEqual(
    [...written].sort((left, right) => APTITUDE_IDS.indexOf(left) - APTITUDE_IDS.indexOf(right)),
    written,
    "written in the order the file lists them",
  );
  // Ticking twice takes it off again.
  const off = togglePlayAptitude(next, first.uid, APTITUDE_IDS[1]);
  assert.equal(exportIncome(off).plays[0].aptitudes.includes(APTITUDE_IDS[1]), false);
});

test("a goddess cannot both have an aptitude and be known not to have it", () => {
  const goddess = state().goddesses[0];
  const aptitude = APTITUDE_IDS.find((id) => !goddess.aptitudes.includes(id) && !goddess.lacks.includes(id));
  let next = toggleGoddessAptitude(state(), goddess.uid, aptitude, "lacks");
  assert.ok(next.goddesses[0].lacks.includes(aptitude));
  next = toggleGoddessAptitude(next, goddess.uid, aptitude, "aptitudes");
  assert.ok(next.goddesses[0].aptitudes.includes(aptitude));
  assert.equal(next.goddesses[0].lacks.includes(aptitude), false, "the other list lets go");
  assert.deepEqual(findIncomeProblems(next).filter((problem) => problem.code === "contradiction"), []);
});

test("more than three aptitudes on one goddess is a problem", () => {
  let next = state();
  const goddess = next.goddesses.find((entry) => entry.aptitudes.length === 3) ?? next.goddesses[0];
  const spare = APTITUDE_IDS.filter((id) => !goddess.aptitudes.includes(id));
  next = toggleGoddessAptitude(next, goddess.uid, spare[0], "aptitudes");
  assert.ok(findIncomeProblems(next).some((problem) => problem.code === "tooManyAptitudes"));
});

test("the file is written one row per line and reads back the same", () => {
  const text = serializeIncomeData(exportIncome(state()));
  assert.deepEqual(JSON.parse(text), committed);
  const plays = text.slice(text.indexOf('"plays"'), text.indexOf('"goddesses"'));
  assert.equal(plays.split("\n").filter((line) => line.startsWith("    {")).length, committed.plays.length);
});

test("a draft survives a reload, and nonsense does not load at all", () => {
  const next = setPlay(state(), state().plays[0].uid, { ticket: "1" });
  assert.deepEqual(parseIncomeDraft(JSON.stringify(next)), next);
  assert.equal(parseIncomeDraft("not json"), null);
  assert.equal(parseIncomeDraft(null), null);
  assert.equal(parseIncomeDraft(JSON.stringify({ ...next, version: 2 })), null);
  const badAptitude = { ...next, plays: [{ ...next.plays[0], aptitudes: ["nonsense"] }, ...next.plays.slice(1)] };
  assert.equal(parseIncomeDraft(JSON.stringify(badAptitude)), null);
});

test("what is published is what the calculator uses right now", () => {
  assert.deepEqual(exportIncome(PUBLISHED_INCOME), committed);
  assert.equal(PUBLISHED_INCOME.plays.length, INCOME_PLAYS.length);
});
