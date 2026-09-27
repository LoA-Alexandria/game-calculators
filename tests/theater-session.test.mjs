import assert from "node:assert/strict";
import test from "node:test";

import { PLAY_ENERGY, THEATER_BUILDINGS, simulateTheaterRun, theaterBuildingForLevel, theaterTierForLevel } from "../lib/calculators/theater-session.ts";

test("theater levels resolve to the five buildings and their unlock capacities", () => {
  assert.deepEqual([1, 2, 3, 14, 15, 26, 27, 39, 40].map((level) => theaterBuildingForLevel(level).id), [
    "parade", "parade", "openAir", "openAir", "art", "art", "royal", "royal", "civic",
  ]);
  assert.deepEqual(THEATER_BUILDINGS.map(({ theaterSlots, goddessSlots }) => [theaterSlots, goddessSlots]), [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]);
  assert.deepEqual([2, 3, 14, 15, 26, 27, 39, 40].map(theaterTierForLevel), [2, 1, 12, 1, 12, 1, 13, 1]);
  assert.throws(() => theaterBuildingForLevel(0), RangeError);
  assert.throws(() => theaterBuildingForLevel(2.5), RangeError);
});

test("each building has a complete rarity distribution and the recorded energy costs", () => {
  for (const building of THEATER_BUILDINGS) {
    assert.equal(Object.values(building.rarityChances).reduce((sum, chance) => sum + chance, 0), 100, building.id);
  }
  assert.deepEqual(PLAY_ENERGY, { "UR+": 600, UR: 300, SSR: 160, SR: 60, R: 30 });
  assert.deepEqual(THEATER_BUILDINGS.map(({ rarityChances }) => [rarityChances.R, rarityChances.SR, rarityChances.SSR, rarityChances.UR, rarityChances["UR+"]]), [
    [80, 20, 0, 0, 0],
    [40, 50, 10, 0, 0],
    [20, 35, 35, 10, 0],
    [10, 30, 40, 10, 10],
    [5, 25, 40, 10, 20],
  ]);
});

test("three offers and independent theater slots produce expected, minimum, and maximum totals", () => {
  const result = simulateTheaterRun({
    level: 3,
    startingEnergy: [30, 30],
    lipsticks: 1,
    lipstickSlot: 0,
    rewards: {
      R: { low: 100, average: 100, high: 100 },
      SR: { low: 1_000, average: 1_000, high: 1_000 },
    },
  });
  assert.deepEqual(result.slots.map(({ energy }) => energy), [35, 30]);
  assert.equal(result.expectedPlays, 1.568, "R is affordable and appears in at least one of three offers with probability 1 - 0.6^3");
  assert.equal(result.minimum, 0, "all three offers may omit R");
  assert.equal(result.maximum, 200, "both slots can complete one R script");
  assert.equal(result.average, 156.8, "each slot contributes 100 points with probability 0.784");
});

test("run input validation covers slot count, energy, lipstick amount, and target slot", () => {
  const input = { level: 1, startingEnergy: [10], lipsticks: 0, lipstickSlot: 0, rewards: {} };
  assert.throws(() => simulateTheaterRun({ ...input, startingEnergy: [] }), RangeError);
  assert.throws(() => simulateTheaterRun({ ...input, startingEnergy: [-1] }), RangeError);
  assert.throws(() => simulateTheaterRun({ ...input, lipsticks: 10_001 }), RangeError);
  assert.throws(() => simulateTheaterRun({ ...input, lipstickSlot: 1 }), RangeError);
});

test("mass mode accepts more than 1,000 lipsticks and applies all of their energy", () => {
  const result = simulateTheaterRun({
    level: 1,
    startingEnergy: [0],
    lipsticks: 2_400,
    lipstickSlot: 0,
    rewards: { R: { low: 100, average: 100, high: 100 } },
  });
  assert.equal(result.slots[0].energy, 12_000);
  assert.ok(result.expectedPlays > 0);
  assert.throws(() => simulateTheaterRun({
    level: 1,
    startingEnergy: [0],
    lipsticks: 10_001,
    lipstickSlot: 0,
    rewards: {},
  }), RangeError);
});
