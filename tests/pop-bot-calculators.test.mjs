import assert from "node:assert/strict";
import test from "node:test";

import { calculateMaterials, GODDESS_MATERIALS, RED_CARPET_MATERIALS } from "../lib/calculators/event-materials.ts";
import { calculateGoddessXp } from "../lib/calculators/goddess-xp.ts";
import { buildUpgradePlan, CITIES, requiredGroupLevel, upgradeCost } from "../lib/calculators/city-upgrades.ts";
import { calculateRoute, formatDuration, ROUTE_CITIES } from "../lib/calculators/grand-voyage-route.ts";

test("calculates Goddess material points", () => {
  const result = calculateMaterials(GODDESS_MATERIALS.map((item, index) => ({ ...item, quantity: index + 1 })));
  assert.equal(result.total, 37);
});

test("calculates Red Carpet material points", () => {
  const result = calculateMaterials(RED_CARPET_MATERIALS.map((item) => ({ ...item, quantity: 2 })));
  assert.equal(result.total, 1600);
});

test("calculates Goddess XP across level boundaries", () => {
  assert.equal(calculateGoddessXp(1, 2), 7);
  assert.equal(calculateGoddessXp(1, 12), 229);
  assert.throws(() => calculateGoddessXp(12, 12), /higher/);
});

test("preserves city data, caps, and milestone rules", () => {
  assert.equal(CITIES.length, 33);
  assert.equal(requiredGroupLevel(1), 0);
  assert.equal(requiredGroupLevel(25), 20);
  assert.equal(requiredGroupLevel(35), 30);
  const gibraltar = CITIES.find((city) => city.name === "Gibraltar");
  assert.ok(gibraltar);
  assert.equal(upgradeCost(gibraltar, 18, 19), 1_450_000);
});

test("includes required peer upgrades in city plan", () => {
  const plan = buildUpgradePlan("London", 19, 25, { Hamburg: 19, Amsterdam: 20, Plymouth: 5, Dublin: 30 });
  assert.deepEqual(plan.prerequisites.map((item) => item.city.name), ["Hamburg", "Plymouth"]);
  assert.equal(plan.totalCost, 31_628_800);
});

test("preserves known Grand Voyage route values", () => {
  assert.equal(ROUTE_CITIES.length, 33);
  const result = calculateRoute(["Gibraltar", "Lisbon"]);
  assert.equal(result.legs[0].profit, 388_200);
  assert.equal(result.legs[1].profit, 358_900);
  assert.equal(result.totalProfit, 747_100);
  assert.deepEqual(result.completeRoute, ["Gibraltar", "Lisbon", "Gibraltar"]);
});

test("validates routes and formats durations", () => {
  assert.throws(() => calculateRoute(["Gibraltar"]), /between 2 and 6/);
  assert.throws(() => calculateRoute(["Gibraltar", "Gibraltar"]), /only once/);
  assert.equal(formatDuration(2.01), "2h 01m");
  assert.equal(formatDuration(0.5), "30m");
});
