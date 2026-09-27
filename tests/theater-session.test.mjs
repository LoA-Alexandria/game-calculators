import assert from "node:assert/strict";
import test from "node:test";

import { PLAY_ENERGY, THEATER_BUILDINGS, rarityAppearanceChance, simulateTheaterRun, theaterBuildingForLevel, theaterTierForLevel } from "../lib/calculators/theater-session.ts";

test("theater levels resolve to the five buildings and their unlock capacities", () => {
  assert.deepEqual([1, 2, 3, 14, 15, 26, 27, 39, 40].map((level) => theaterBuildingForLevel(level).id), [
    "parade", "parade", "openAir", "openAir", "art", "art", "royal", "royal", "civic",
  ]);
  assert.deepEqual(THEATER_BUILDINGS.map(({ theaterSlots, goddessSlots }) => [theaterSlots, goddessSlots]), [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]]);
  assert.deepEqual([2, 3, 14, 15, 26, 27, 39, 40].map(theaterTierForLevel), [2, 1, 12, 1, 12, 1, 13, 1]);
  assert.throws(() => theaterBuildingForLevel(0), RangeError);
  assert.throws(() => theaterBuildingForLevel(2.5), RangeError);
});

test("three-offer appearance chances are distinct from per-offer odds", () => {
  const royal = theaterBuildingForLevel(39);
  assert.equal(royal.rarityChances.R, 10);
  assert.equal(royal.rarityChances.SR, 30);
  assert.ok(Math.abs(rarityAppearanceChance(royal.rarityChances.R) - 27.1) < 1e-10);
  assert.ok(Math.abs(rarityAppearanceChance(royal.rarityChances.SR) - 65.7) < 1e-10);
  assert.equal(rarityAppearanceChance(0), 0);
  assert.equal(rarityAppearanceChance(100), 100);
  assert.throws(() => rarityAppearanceChance(-1), RangeError);
  assert.throws(() => rarityAppearanceChance(10, 0), RangeError);
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

test("starting plays spend energy before three-offer projections are added", () => {
  const result = simulateTheaterRun({
    level: 3,
    startingEnergy: [90, 90],
    startingPlays: ["SR", "SR"].map((rarity) => ({ rarity, reward: { low: 10, average: 20, high: 30 } })),
    lipsticks: 1,
    lipstickSlot: 0,
    rewards: {
      R: { low: 100, average: 100, high: 100 },
      SR: { low: 1_000, average: 1_000, high: 1_000 },
    },
  });
  assert.deepEqual(result.slots.map(({ energy }) => energy), [95, 90]);
  assert.equal(result.minimum, 20, "the two forced starting plays always contribute their low reward");
  assert.equal(result.maximum, 260, "the fixed high reward is added to the two possible R scripts");
  assert.equal(result.average, 196.8, "fixed starting plays add 40 points to the expected offer reward");
});

test("run input validation covers slot count, energy, lipstick amount, and target slot", () => {
  const input = { level: 1, startingEnergy: [30], startingPlays: [{ rarity: "R", reward: { low: 0, average: 0, high: 0 } }], lipsticks: 0, lipstickSlot: 0, rewards: {} };
  assert.throws(() => simulateTheaterRun({ ...input, startingEnergy: [] }), RangeError);
  assert.throws(() => simulateTheaterRun({ ...input, startingPlays: [] }), RangeError);
  assert.throws(() => simulateTheaterRun({ ...input, startingEnergy: [-1] }), RangeError);
  assert.throws(() => simulateTheaterRun({ ...input, lipsticks: 10_001 }), RangeError);
  assert.throws(() => simulateTheaterRun({ ...input, lipstickSlot: 1 }), RangeError);
});

test("mass mode accepts more than 1,000 lipsticks and applies all of their energy", () => {
  const result = simulateTheaterRun({
    level: 1,
    startingEnergy: [30],
    startingPlays: [{ rarity: "R", reward: { low: 100, average: 100, high: 100 } }],
    lipsticks: 2_400,
    lipstickSlot: 0,
    rewards: { R: { low: 100, average: 100, high: 100 } },
  });
  assert.equal(result.slots[0].energy, 12_030);
  assert.ok(result.average > 100);
  assert.throws(() => simulateTheaterRun({
    level: 1,
    startingEnergy: [0],
    startingPlays: [{ rarity: "R", reward: { low: 0, average: 0, high: 0 } }],
    lipsticks: 10_001,
    lipstickSlot: 0,
    rewards: {},
  }), RangeError);
  assert.throws(() => simulateTheaterRun({
    level: 1,
    startingEnergy: [29],
    startingPlays: [{ rarity: "R", reward: { low: 0, average: 0, high: 0 } }],
    lipsticks: 0,
    lipstickSlot: 0,
    rewards: {},
  }), /does not cover its selected play/);
});
