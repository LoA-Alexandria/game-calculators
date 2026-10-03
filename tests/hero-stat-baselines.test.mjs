import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { estimatedHeldAngLevelOne, heldAngMilestoneBonus, referenceHeldAng } from "../lib/calculators/hero-stat-baselines.ts";

const catalog = JSON.parse(readFileSync(new URL("../lib/calculators/hero-stat-baselines.json", import.meta.url), "utf8"));
const roster = JSON.parse(readFileSync(new URL("../lib/data/heroes.json", import.meta.url), "utf8"));
const observation = (heroId, level, phase = "normal") => catalog.heldStatObservations.find((row) => row.heroId === heroId && row.level === level && row.phase === phase);

test("hero stat catalog covers the published hero roster without inventing missing values", () => {
  assert.equal(catalog.heroes.length, roster.heroes.length);
  assert.deepEqual(catalog.heroes.map((hero) => hero.id), roster.heroes.map((hero) => hero.id));
  assert.equal(new Set(catalog.heroes.map((hero) => hero.id)).size, catalog.heroes.length);
  assert.ok(catalog.heroes.every((hero) => hero.combatBaseAttack.value === null || Number.isFinite(hero.combatBaseAttack.value)));
  assert.ok(catalog.heroes.every((hero) => hero.combatBaseLp.value === null && hero.combatBaseLp.status === "not-in-source"));
  assert.equal(catalog.heroes.find((hero) => hero.id === "guinevere").combatBaseAttack.status, "source-blank");
  assert.equal(catalog.heroes.find((hero) => hero.id === "heracles").combatBaseAttack.status, "source-blank");
  assert.equal(catalog.heroes.find((hero) => hero.id === "andersen").combatBaseAttack.status, "possible-name-match-needs-confirmation");
  assert.ok(catalog.heldStatObservations.every((row) => roster.heroes.some((hero) => hero.id === row.heroId)));
  assert.ok(catalog.heldStatObservations.every((row) => Number.isInteger(row.level) && Number.isInteger(row.heldAng)));
});

test("Guan Yu milestone readings and later user readings are kept as observations", () => {
  assert.equal(observation("guan-yu", 1).heldAng, 616);
  assert.equal(observation("guan-yu", 20, "before-enlightenment").heldAng, 2627);
  assert.equal(observation("guan-yu", 20, "after-enlightenment").heldAng, 3027);
  assert.equal(observation("guan-yu", 43).heldAng, 8313, "raw report is preserved despite the fit anomaly");
  assert.equal(observation("guan-yu", 50, "after-ascension").heldAng, 11990);
  assert.equal(observation("guan-yu", 53, "after-ascension").heldLp, 141200);
  assert.equal(observation("guan-yu", 23).heldLp, null, "unknown observations stay blank");
});

test("integer growth rule and milestone boundaries stay explicit", () => {
  assert.equal(referenceHeldAng(1), 616);
  assert.equal(referenceHeldAng(2), 670);
  assert.equal(heldAngMilestoneBonus(19, "normal"), 0);
  assert.equal(heldAngMilestoneBonus(20, "before-enlightenment"), 0);
  assert.equal(heldAngMilestoneBonus(20, "after-enlightenment"), 400);
  assert.equal(heldAngMilestoneBonus(50, "after-ascension"), 2000);
  assert.equal(heldAngMilestoneBonus(100, "before-ascension"), 2000);
  assert.equal(heldAngMilestoneBonus(100, "after-ascension"), 3500);
  assert.equal(heldAngMilestoneBonus(300, "after-ascension"), 16820);
  assert.equal(heldAngMilestoneBonus(500, "before-ascension"), 16820, "level-500 bonus is not included before ascension");
});

test("cross-hero level-one ANG estimates match known low-level checks and flag disputed input", () => {
  assert.ok(Math.abs(estimatedHeldAngLevelOne(observation("lu-bu", 10)) - 587) <= 1);
  assert.ok(Math.abs(estimatedHeldAngLevelOne(observation("morgana", 10)) - 615) <= 1);
  assert.ok(Math.abs(estimatedHeldAngLevelOne(observation("miyamoto-musashi", 10)) - 652) <= 2);
  const after150 = observation("guan-yu", 150, "after-ascension");
  assert.equal(after150.heldAng, 77070);
  assert.equal(estimatedHeldAngLevelOne(after150), 617);
  assert.equal(observation("guan-yu", 151).heldAng, 77980);
  assert.equal(catalog.heldStatObservations.some((row) => row.dataQuality === "needs-confirmation"), false);
  assert.ok(catalog.heldStatObservations.some((row) => row.heroId === "queen-victoria" && row.level === 300 && row.heldAng === 316900));
});
