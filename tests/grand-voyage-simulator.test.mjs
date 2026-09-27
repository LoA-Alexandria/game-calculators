import assert from "node:assert/strict";
import test from "node:test";
import { calculateRoute } from "../lib/calculators/grand-voyage-route.ts";
import {
  DEFAULT_VOYAGE_PROFILE, levelForCity, nextCityUpgrade, observedShipwreckShipments, optimizeVoyageRoutes,
} from "../lib/calculators/grand-voyage-simulator.ts";

const profile = (changes = {}) => ({
  ...DEFAULT_VOYAGE_PROFILE,
  unlockedRegions: ["French Waters"],
  ...changes,
});

test("searches all two- and three-port loops in an unlocked region", () => {
  const result = optimizeVoyageRoutes(profile(), 3, 20);
  assert.equal(result.length, 5); // Three pairs and both directions of the one three-port cycle.
  assert.ok(result.every((route) => route.cities.every((city) => ["Bordeaux", "Saint-Malo", "Paris"].includes(city))));
  const expected = [
    ["Bordeaux", "Saint-Malo", "Paris"],
    ["Bordeaux", "Paris", "Saint-Malo"],
  ];
  for (const cities of expected) {
    const found = result.find((route) => route.cities.join(",") === cities.join(","));
    assert.ok(found);
    assert.equal(found.referenceProfit, calculateRoute(cities).totalProfit);
  }
  assert.ok(result.every((route, index) => !index || result[index - 1].referencePerHour >= route.referencePerHour));
});

test("time calibration changes hours and rate but never invents new profits", () => {
  const baseline = optimizeVoyageRoutes(profile(), 2, 3);
  const slower = optimizeVoyageRoutes(profile({ timeCalibration: 1.25 }), 2, 3);
  assert.deepEqual(slower.map((route) => route.cities), baseline.map((route) => route.cities));
  for (let index = 0; index < baseline.length; index++) {
    assert.equal(slower[index].referenceProfit, baseline[index].referenceProfit);
    assert.ok(Math.abs(slower[index].hours / baseline[index].hours - 1.25) < 1e-10);
  }
});

test("empty access and invalid profile boundaries", () => {
  assert.deepEqual(optimizeVoyageRoutes(profile({ unlockedRegions: [] })), []);
  assert.throws(() => optimizeVoyageRoutes(profile({ playerLevel: 0 })), /positive integer/);
  assert.throws(() => optimizeVoyageRoutes(profile({ timeCalibration: 0 })), /above zero/);
  assert.throws(() => optimizeVoyageRoutes(profile({ regionLevels: { "French Waters": 7 } })), /0, 5/);
  assert.throws(() => optimizeVoyageRoutes(profile({ unlockedRegions: ["Atlantis"] })), /Unknown/);
});

test("regional base, port correction and five-level gate cost", () => {
  const p = profile({ regionLevels: { "French Waters": 5 } });
  assert.equal(levelForCity(p, "Paris"), 5);
  assert.equal(nextCityUpgrade(p, "Paris").cost, 46_100);
  const corrected = profile({ regionLevels: { "French Waters": 5 }, cityLevels: { Paris: 5, Bordeaux: 4 } });
  assert.deepEqual(nextCityUpgrade(corrected, "Paris").missingPeers, ["Bordeaux"]);
  assert.equal(levelForCity(corrected, "Bordeaux"), 4);
  assert.equal(nextCityUpgrade(profile({ cityLevels: { Paris: 35 } }), "Paris"), null);
});

test("observed Shipwreck cargo uses dated unit prices and only accessible destinations", () => {
  assert.deepEqual(observedShipwreckShipments(profile()), []);
  const access = profile({ unlockedRegions: ["North Atlantic Islands", "North Sea States"] });
  const shipments = observedShipwreckShipments(access);
  assert.ok(shipments.length > 0);
  assert.ok(shipments.every((item) => Number.isFinite(item.profitPerHour)));
  const hamburg = shipments.find((item) => item.destination === "Hamburg");
  assert.ok(hamburg);
  assert.equal(hamburg.profit, 728_416);
  assert.equal(observedShipwreckShipments(profile({ unlockedRegions: ["North Atlantic Islands"] })).some((item) => item.destination === "Hamburg"), false);
});
