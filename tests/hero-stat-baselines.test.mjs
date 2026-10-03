import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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

test("the tentative reference curve is close to observed non-milestone hero data", () => {
  const { coefficients, referenceHeroId } = catalog.model;
  const start = (id) => catalog.heroes.find((hero) => hero.id === id).heldStatStart.ang;
  const predict = (level, heroId) => {
    const reference = coefficients.a + coefficients.b * level + coefficients.c * level ** 2;
    return reference * start(heroId) / start(referenceHeroId);
  };
  assert.ok(Math.abs(predict(10, "lu-bu") - observation("lu-bu", 10).heldAng) < 2);
  assert.ok(Math.abs(predict(15, "lu-bu") - observation("lu-bu", 15).heldAng) < 4);
  assert.equal(catalog.heroes.find((hero) => hero.id === "miyamoto-musashi").heldStatStart.ang, 652);
});
