import assert from "node:assert/strict";
import test from "node:test";

import {
  APTITUDES,
  GODDESS_APTITUDES,
  INCOME_PLAYS,
  PLAY_RARITIES,
  deployment,
  incomePlay,
  performance,
  redCarpetPoints,
  upgradeGains,
} from "../lib/calculators/theater-income.ts";
import { THEATER_PLAYS } from "../lib/content/goddess-theater.ts";
import { GODDESSES } from "../lib/content/goddesses.ts";

const STATS = { ticketPercent: 270, visitorPercent: 268.5, merchandise: 810 };

// Autumn's three test performances, 20 August 2026: every coin matches.
test("Pride and Prejudice with −5 % ticket price matches the result screen", () => {
  const result = performance({ ticket: 285, visitors: 315, bonusPercent: 90 }, { ...STATS, event: "ticketDown" });
  assert.equal(result.ticketPrice, 1040);
  assert.equal(result.audience, 1160);
  assert.equal(result.ticketIncome, 2_292_160);
  assert.equal(result.merchandiseIncome, 1_785_240);
  assert.equal(result.total, 4_077_400);
});

test("Don Quixote with +5 % visitor flow matches the result screen", () => {
  const result = performance({ ticket: 300, visitors: 300, bonusPercent: 80 }, { ...STATS, event: "visitorsUp" });
  assert.equal(result.ticketPrice, 1110);
  assert.equal(result.audience, 1120);
  assert.equal(result.ticketIncome, 2_237_760);
  assert.equal(result.merchandiseIncome, 1_632_960);
});

test("Robinson Crusoe with −5 % visitor flow matches the result screen", () => {
  const result = performance({ ticket: 500, visitors: 490, bonusPercent: 90 }, { ...STATS, event: "visitorsDown" });
  assert.equal(result.ticketPrice, 1850);
  assert.equal(result.audience, 1781, "1,781.15 visitors are rounded down");
  assert.equal(result.ticketIncome, 6_260_215);
  assert.equal(result.merchandiseIncome, 2_740_959);
});

test("Autumn's Royal Theater ranking follows from the same formula", () => {
  const royal = { ticketPercent: 310, visitorPercent: 310, merchandise: 930, event: "none" };
  const total = (id, bonusPercent) => {
    const entry = incomePlay(id);
    return performance({ ticket: entry.ticket, visitors: entry.visitors, bonusPercent }, royal).total;
  };
  // She lists 5.14M, 4.78M, and 11.37M, cut after two decimals; her goddesses gave 90 %, 80 %, and 90 %.
  const millions = (coins) => Math.floor(coins / 10_000) / 100;
  assert.equal(millions(total("pride-and-prejudice", 90)), 5.14);
  assert.equal(millions(total("don-quixote", 80)), 4.78);
  assert.equal(millions(total("robinson-crusoe", 90)), 11.37);
});

test("Red Carpet points are 83–85 % of the income ÷ 1,000, rounded down to whole hundreds", () => {
  // Every item is worth a multiple of 100 (Cheer Stick 100, Clapper 200, Vintage Camera 500).
  assert.deepEqual(redCarpetPoints(9_500_000), [7800, 8000]);
  assert.deepEqual(redCarpetPoints(1_000_000), [800, 800]);
  assert.deepEqual(redCarpetPoints(0), [0, 0]);
});

test("after Merchandise, visitor flow is worth more than ticket price", () => {
  const gains = upgradeGains({ ticket: 500, visitors: 490, bonusPercent: 90 }, { ...STATS, event: "none" });
  assert.ok(gains.visitors > gains.ticket, `${gains.visitors} > ${gains.ticket}`);
  const noMerch = upgradeGains({ ticket: 300, visitors: 300, bonusPercent: 80 }, { ticketPercent: 100, visitorPercent: 100, merchandise: 0, event: "none" });
  assert.ok(Math.abs(noMerch.visitors - noMerch.ticket) < noMerch.ticket * 0.01, "equal bases and levels: both are worth the same");
});

test("auto deploy reproduces the bonuses of Autumn's casts", () => {
  const bonus = (id, owned) => deployment(incomePlay(id), owned);
  const pride = bonus("pride-and-prejudice", ["Venus", "Vivian", "Fortuna", "Muse"]);
  assert.equal(pride.percent, 90);
  assert.equal(pride.exact, true);
  const quixote = bonus("don-quixote", ["Fortuna", "Vivian", "Venus", "Hestia"]);
  assert.equal(quixote.percent, 80);
  assert.equal(quixote.exact, true);
  const robinson = bonus("robinson-crusoe", ["Ixchel", "Brunhild", "Artemis", "Freya"]);
  assert.equal(robinson.percent, 90);
  assert.deepEqual(robinson.goddesses.map((row) => row.name), ["Ixchel", "Artemis", "Brunhild", "Freya"]);
});

test("auto deploy takes the best goddesses up to the play's slots", () => {
  const quixote = deployment(incomePlay("don-quixote"), ["Hestia", "Fortuna", "Vivian", "Venus", "Muse"]);
  // Fortuna 3, then Venus and Vivian 2 each; Muse (Artistry) and Hestia (Idealism) tie for the fourth slot.
  assert.equal(quixote.goddesses.length, 4);
  assert.equal(quixote.percent, 80);
});

test("a goddess whose aptitudes are not recorded makes the bonus a lower bound", () => {
  const pride = deployment(incomePlay("pride-and-prejudice"), ["Venus", "Lilith"]);
  assert.equal(pride.percent, 30);
  assert.equal(pride.exact, false);
  assert.deepEqual(pride.unknown, ["Lilith"]);
  // With four goddesses matching two or more, an unknown one could still match three.
  const full = deployment(incomePlay("pride-and-prejudice"), ["Venus", "Vivian", "Fortuna", "Muse", "Lilith"]);
  assert.equal(full.exact, false);
  // Artemis lacks Suspense, so Robinson Crusoe is exact without her third aptitude; Peter Pan is not.
  assert.equal(deployment(incomePlay("robinson-crusoe"), ["Artemis"]).exact, true);
  assert.equal(deployment(incomePlay("peter-pan"), ["Artemis"]).exact, false);
  assert.equal(deployment({ ...incomePlay("hamlet"), aptitudes: undefined }, ["Venus"]), null, "a play without aptitudes has no bonus to work out");
});

test("Bastet shares all three of Cats' aptitudes, as Autumn expected", () => {
  const cats = deployment(incomePlay("cats"), ["Bastet"]);
  assert.deepEqual(cats.goddesses, [{ name: "Bastet", matches: 3 }]);
  assert.equal(cats.percent, 30);
});

test("every play and every goddess but Lilith and Artemis has three recorded aptitudes", () => {
  for (const entry of INCOME_PLAYS) assert.equal(entry.aptitudes?.length, 3, entry.id);
  const partial = GODDESS_APTITUDES.filter((goddess) => goddess.aptitudes.length < 3).map((goddess) => goddess.name);
  assert.deepEqual(partial, ["Artemis"]);
  const recorded = new Set(GODDESS_APTITUDES.map((goddess) => goddess.name));
  assert.deepEqual(GODDESSES.filter((goddess) => !recorded.has(goddess.name)).map((goddess) => goddess.name), ["Lilith"]);
  assert.equal(APTITUDES.length, 12);
});

test("the data names real plays and goddesses and stays consistent", () => {
  assert.equal(INCOME_PLAYS.length, THEATER_PLAYS.length, "every play has a rarity");
  assert.deepEqual(new Set(INCOME_PLAYS.map((entry) => entry.id)), new Set(THEATER_PLAYS.map((play) => play.id)));
  const aptitudes = new Set(APTITUDES.map((aptitude) => aptitude.id));
  for (const entry of INCOME_PLAYS) {
    assert.ok(PLAY_RARITIES.includes(entry.rarity), `${entry.id} rarity`);
    if (entry.aptitudes) {
      assert.equal(entry.aptitudes.length, 3, `${entry.id} has three aptitudes`);
      for (const aptitude of entry.aptitudes) assert.ok(aptitudes.has(aptitude), `${entry.id}: ${aptitude}`);
    }
    assert.equal(Boolean(entry.ticket), Boolean(entry.visitors), `${entry.id} has both base values or neither`);
  }
  const names = new Set(GODDESSES.map((goddess) => goddess.name));
  for (const goddess of GODDESS_APTITUDES) {
    assert.ok(names.has(goddess.name), `${goddess.name} is in the roster`);
    assert.ok(goddess.aptitudes.length <= 3);
    for (const aptitude of [...goddess.aptitudes, ...(goddess.lacks ?? [])]) assert.ok(aptitudes.has(aptitude), `${goddess.name}: ${aptitude}`);
    assert.ok(!goddess.lacks?.some((aptitude) => goddess.aptitudes.includes(aptitude)), `${goddess.name} cannot have and lack one aptitude`);
  }
});
