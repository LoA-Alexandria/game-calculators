import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { estimatedHeldAngLevelOne, estimatedHeldLpLevelOne, heldAngAfterStarBonus, heldAngMilestoneBonus, heldLpMilestoneBonus, heldStatsAtLevel, heldStarAngBonusPercent, heroBasicStatsForHero, referenceHeldAng } from "../lib/calculators/hero-stat-baselines.ts";

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

test("chat LP values produce individual level-one estimates for heroes with readings", () => {
  const heroesWithLp = new Set(catalog.heldStatObservations.filter((row) => row.heldLp !== null).map((row) => row.heroId));
  assert.ok(roster.heroes.every((hero) => heroBasicStatsForHero(hero.id) !== null));
  assert.equal(heroesWithLp.size, 80);
  for (const heroId of heroesWithLp) assert.ok(heroBasicStatsForHero(heroId).heldLp > 0, heroId);
  assert.equal(heroBasicStatsForHero("unknown-hero"), null);
  assert.equal(heroBasicStatsForHero("guan-yu").heldAng, 616);
  assert.equal(heroBasicStatsForHero("guan-yu").heldLp, 6791);
  assert.equal(heroBasicStatsForHero("guan-yu").heldLpEstimated, false);
  assert.equal(heroBasicStatsForHero("lu-bu").heldLp, 7087);
  assert.equal(heroBasicStatsForHero("morgana").heldLp, 6808);
  assert.equal(heroBasicStatsForHero("queen-victoria").heldLp, 6129);
  assert.equal(heroBasicStatsForHero("garwain").heldLp, 6550);
  assert.equal(heroBasicStatsForHero("lu-bu").heldLpEstimated, true);
  assert.equal(heroBasicStatsForHero("yi-sun-sin").heldLp, null);
  assert.equal(heroBasicStatsForHero("achilles").heldAngEstimated, true);
});

test("the shared level curve reproduces Guan Yu's chat LP values within their display precision", () => {
  assert.equal(estimatedHeldLpLevelOne(observation("guan-yu", 10)), 6794);
  assert.equal(heldLpMilestoneBonus(20, "before-enlightenment"), 0);
  assert.equal(heldLpMilestoneBonus(20, "after-enlightenment"), 4000);
  assert.equal(heldLpMilestoneBonus(50, "after-ascension"), 20000);

  const readings = catalog.heldStatObservations.filter((row) => row.heroId === "guan-yu" && row.heldLp !== null);
  assert.equal(readings.length, 61);
  for (const row of readings) {
    const projected = Math.round(6791 * referenceHeldAng(row.level) / 616) + heldLpMilestoneBonus(row.level, row.phase);
    assert.ok(Math.abs(projected - row.heldLp) <= Math.max(300, row.heldLp * 0.006), `Lv. ${row.level} ${row.phase}: ${projected} vs ${row.heldLp}`);
  }
});

test("Basic level calculator scales ANG and LP and applies milestone bonuses", () => {
  const base = { heldAng: 616, heldLp: 6791 };
  assert.deepEqual(heldStatsAtLevel(base, 1), base);
  assert.deepEqual(heldStatsAtLevel(base, 20), { heldAng: referenceHeldAng(20), heldLp: Math.round(6791 * referenceHeldAng(20) / 616) });
  assert.deepEqual(heldStatsAtLevel(base, 20, "after-ascension"), {
    heldAng: referenceHeldAng(20) + 400,
    heldLp: Math.round(6791 * referenceHeldAng(20) / 616) + 4000,
  });
  assert.deepEqual(heldStatsAtLevel(base, 21), {
    heldAng: referenceHeldAng(21) + 400,
    heldLp: Math.round(6791 * referenceHeldAng(21) / 616) + 4000,
  });
  assert.deepEqual(heldStatsAtLevel(base, 500), {
    heldAng: Math.round(616 * referenceHeldAng(500) / 616) + 16820,
    heldLp: Math.round(6791 * referenceHeldAng(500) / 616) + 164200,
  });
  const guan151 = catalog.heldStatObservations.find((row) => row.heroId === "guan-yu" && row.level === 151 && row.phase === "normal");
  const projectedGuan151 = heldStatsAtLevel(heroBasicStatsForHero("guan-yu"), 151);
  assert.ok(Math.abs(projectedGuan151.heldAng - guan151.heldAng) <= 100);
  assert.ok(Math.abs(projectedGuan151.heldLp - guan151.heldLp) <= 300);
  assert.deepEqual(heldStatsAtLevel(base, 0), { heldAng: null, heldLp: null });
  assert.deepEqual(heldStatsAtLevel(base, 501), { heldAng: null, heldLp: null });
});

test("star input is accepted while unprovided star percentages remain placeholders", () => {
  assert.equal(heldStarAngBonusPercent(0), 0);
  assert.equal(heldAngAfterStarBonus(1234, 0), 1234);
  assert.equal(heldStarAngBonusPercent(1), null);
  assert.equal(heldAngAfterStarBonus(1234, 1), null);
  assert.equal(heldStarAngBonusPercent(40), null);
  assert.equal(heldStarAngBonusPercent(41), null);
});

test("Basic stats use their own profile tab instead of the other-guides list", () => {
  const heroRoster = readFileSync(new URL("../app/guides/HeroRoster.tsx", import.meta.url), "utf8");
  const navigation = readFileSync(new URL("../lib/navigation.ts", import.meta.url), "utf8");
  assert.match(heroRoster, /id: "basic"[\s\S]*?title: guide\.basicHeading/);
  assert.match(heroRoster, /heroBasicStatsForHero\(hero\.id\)/);
  assert.doesNotMatch(heroRoster, /hero-basic-observations|basicReadings|basicUnavailable/);
  assert.equal(existsSync(new URL("../app/guides/hero-stats/page.tsx", import.meta.url)), false);
  assert.equal(navigation.includes("/guides/hero-stats/"), false);
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
