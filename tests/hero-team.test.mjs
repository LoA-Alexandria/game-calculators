import assert from "node:assert/strict";
import test from "node:test";
import { HEROES } from "../lib/content/heroes.ts";
import { productionValue, simulateProduction } from "../lib/calculators/hero-team.ts";
const hero = (id, patch = {}) => ({ id, productionLevel: 1, stars: 0, ...patch });
test("global building allocation reserves a universal hero for the unmatched building", () => {
  const result = simulateProduction([hero("hermes"), hero("heracles")], [{ building: "Coal Plant", baseRate: 100 }, { building: "Farm", baseRate: 200 }], 2);
  assert.deepEqual(result.assignments.map((slot) => slot.hero), ["heracles", "hermes"]);
  assert.equal(result.total, 840);
  assert.equal(result.baseline, 600);
  assert.deepEqual(result.timeline.map((row) => row.total), [0, 420, 840]);
});
test("production gates and missing source text do not invent bonuses", () => {
  const slots = [{ building: "Coal Plant", baseRate: 100 }];
  assert.equal(simulateProduction([hero("heracles", { productionLevel: 5, stars: 5 })], slots, 1).rate, 100);
  assert.equal(simulateProduction([hero("heracles", { productionLevel: 5, stars: 6 })], slots, 1).rate, 156);
  assert.equal(productionValue(HEROES.find((entry) => entry.id === "billy-the-kid")), null);
});
test("zero time and empty inventory preserve base output with no invented assignments", () => {
  const slots = [{ building: "Farm", baseRate: 100 }];
  assert.equal(simulateProduction([], slots, 0).total, 0);
  const result = simulateProduction([], slots, 1.5);
  assert.equal(result.total, 150);
  assert.equal(result.assignments[0].hero, null);
  assert.deepEqual(result.timeline.map((row) => row.hour), [0, 1, 1.5]);
});
test("one hero cannot staff two slots and input order does not change the optimum", () => {
  const slots = [{ building: "Farm", baseRate: 100 }, { building: "Coal Plant", baseRate: 100 }];
  assert.equal(simulateProduction([hero("hermes")], slots, 1).assignments.filter((slot) => slot.hero).length, 1);
  const pool = [hero("hermes"), hero("heracles")];
  assert.deepEqual(simulateProduction(pool, slots, 1), simulateProduction([...pool].reverse(), slots, 1));
});
test("production rejects invalid numbers, duplicate heroes and unknown buildings", () => {
  for (const hours of [-1, 169, NaN]) assert.throws(() => simulateProduction([], [{ building: "Farm", baseRate: 100 }], hours), RangeError);
  assert.throws(() => simulateProduction([], [{ building: "unknown", baseRate: 100 }], 1), RangeError);
  assert.throws(() => simulateProduction([hero("hermes"), hero("hermes")], [{ building: "Farm", baseRate: 100 }], 1), RangeError);
});
