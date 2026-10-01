import assert from "node:assert/strict";
import test from "node:test";
import { HEROES } from "../lib/content/heroes.ts";
import { baseValueSource, scoreBaseLineup, STAR_COLORS } from "../lib/calculators/hero-base-value.ts";

test("workbook baseline values cover the full Core roster and keep missing attacks explicit", () => {
  const sourceIds = HEROES.filter((hero) => baseValueSource(hero.id));
  assert.equal(sourceIds.length, 82);
  assert.equal(baseValueSource("achilles")?.attack, 8.29);
  assert.equal(baseValueSource("achilles")?.starColor, 4);
  assert.equal(baseValueSource("merlin")?.attack, null);
  assert.equal(baseValueSource("mime-hero"), undefined);
});

test("score matches the workbook formula and star colors add ten percentage points each", () => {
  const result = scoreBaseLineup([{ id: "achilles", attack: 8.29, starColor: 4 }], 1);
  assert.equal(result.rows[0].activationChance, 0.4);
  assert.equal(result.rows[0].skillDamage, 2.3);
  assert.ok(Math.abs(result.rows[0].score - 7.6268) < 1e-10);
  const max = scoreBaseLineup([{ id: "achilles", attack: 8.29, starColor: STAR_COLORS.length }], 1);
  assert.ok(Math.abs(max.totalScore - 9.2848) < 1e-10);
});

test("lineup returns the top unlocked-slot count and breaks ties by hero name", () => {
  const result = scoreBaseLineup([
    { id: "beethoven", attack: 5, starColor: 1 },
    { id: "achilles", attack: 5, starColor: 1 },
    { id: "caesar", attack: 5, starColor: 1 },
  ], 2);
  assert.deepEqual(result.lineup.map((row) => row.name), ["Achilles", "Caesar"]);
  assert.equal(result.totalScore, 2 * 4);
  assert.equal(result.rows.length, 3);
});

test("zero ATK is a valid value while missing ATK and invalid settings are rejected", () => {
  assert.equal(scoreBaseLineup([{ id: "achilles", attack: 0, starColor: 1 }], 1).totalScore, 0);
  assert.throws(() => scoreBaseLineup([{ id: "merlin", attack: null, starColor: 1 }], 1), RangeError);
  assert.throws(() => scoreBaseLineup([{ id: "achilles", attack: -1, starColor: 1 }], 1), RangeError);
  assert.throws(() => scoreBaseLineup([{ id: "achilles", attack: 10, starColor: 10 }], 1), RangeError);
  assert.throws(() => scoreBaseLineup([{ id: "achilles", attack: 10, starColor: 1 }], 0), RangeError);
  assert.throws(() => scoreBaseLineup([{ id: "achilles", attack: 10, starColor: 1 }], 26), RangeError);
  assert.throws(() => scoreBaseLineup([{ id: "achilles", attack: 10, starColor: 1 }, { id: "achilles", attack: 12, starColor: 2 }], 1), RangeError);
});
