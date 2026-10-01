import assert from "node:assert/strict";
import test from "node:test";

import costs from "../lib/calculators/signet-ring-costs.json" with { type: "json" };
import { calculateSignetRingCost, MAXIMUM_SIGNET_LEVEL } from "../lib/calculators/signet-ring-cost.ts";

test("versioned schedule includes every level through 500", () => {
  assert.equal(MAXIMUM_SIGNET_LEVEL, 500);
  assert.equal(costs.levelCosts.length, 500);
  assert.equal(costs.levelCosts[0], 0);
});

test("same-level calculation costs nothing", () => {
  assert.deepEqual(calculateSignetRingCost(39, 39), {
    currentLevel: 39,
    targetLevel: 39,
    coins: 0,
    signetRings: 0,
    ascensions: [],
  });
});

test("ascending past level 20 charges its ring after including level 21", () => {
  assert.deepEqual(calculateSignetRingCost(20, 21), {
    currentLevel: 20,
    targetLevel: 21,
    coins: 223,
    signetRings: 1,
    ascensions: [{ afterLevel: 20, rings: 1 }],
  });
});

test("stopping at an ascension milestone does not charge the next ascension", () => {
  assert.deepEqual(calculateSignetRingCost(19, 20), {
    currentLevel: 19,
    targetLevel: 20,
    coins: 190,
    signetRings: 0,
    ascensions: [],
  });
});

test("crossing milestones sums destination-level coin costs and rings", () => {
  const result = calculateSignetRingCost(49, 51);
  assert.equal(result.coins, 138480);
  assert.equal(result.signetRings, 5);
  assert.deepEqual(result.ascensions, [{ afterLevel: 50, rings: 5 }]);
});

test("level 500 is the last supported target and excludes the next ascension", () => {
  const result = calculateSignetRingCost(499, 500);
  assert.equal(result.coins, 3300000000000);
  assert.equal(result.signetRings, 0);
});

test("rejects fractional, out-of-range, and reversed levels", () => {
  assert.throws(() => calculateSignetRingCost(1.5, 2), { code: "wholeNumbers" });
  assert.throws(() => calculateSignetRingCost(0, 2), { code: "levelRange" });
  assert.throws(() => calculateSignetRingCost(1, 501), { code: "levelRange" });
  assert.throws(() => calculateSignetRingCost(10, 9), { code: "targetNotLower" });
});
