import assert from "node:assert/strict";
import test from "node:test";
import { HEROES } from "../lib/content/heroes.ts";
import { LAYOUT_DATA } from "../lib/content/hero-layouts.ts";
import { COLLECTION_ITEMS } from "../lib/content/collection.ts";
import { planHeroTeams, productionValue, resolveLayoutHero, LAYOUT_COLLECTION } from "../lib/calculators/hero-team.ts";

const base = { heroes: [], items: [], collection: [], size: 5, mode: "combat", building: "Coal Plant" };
const combat = (patch) => planHeroTeams({ ...base, ...patch });
const profile = (rows, id) => rows.find((row) => row.id === id);
test("all modeled guide hero names and Collection aliases resolve", () => {
  for (const build of LAYOUT_DATA.builds) {
    for (const pick of [...build.key, ...build.important, ...build.other]) assert.ok(resolveLayoutHero(pick.hero), pick.hero);
    for (const pick of build.collection) {
      assert.ok(LAYOUT_COLLECTION[pick.hero]?.length, pick.hero);
      for (const id of LAYOUT_COLLECTION[pick.hero]) assert.ok(COLLECTION_ITEMS.some((item) => item.id === id));
    }
  }
  for (const role of LAYOUT_DATA.utility) for (const group of role.groups) for (const pick of group.picks) assert.ok(resolveLayoutHero(pick.hero), pick.hero);
});
test("empty inventory cannot earn a team or Collection score", () => {
  for (const result of combat({ collection: ["holy-hand-grenade"] })) {
    assert.equal(result.members.length, 0);
    assert.equal(result.score, 0);
  }
});
test("invalid team sizes, progression and buildings are rejected", () => {
  for (const size of [0, -1, 26, 1.5, NaN, Infinity]) assert.throws(() => combat({ size }), RangeError);
  for (const patch of [{ level: 0 }, { stars: -1 }, { stars: 1.5 }, { productionLevel: 999 }]) assert.throws(() => combat({ heroes: [{ id: "achilles", ...patch }] }), RangeError);
  assert.throws(() => combat({ mode: "production", building: "Unknown" }), RangeError);
});
test("team size boundaries and duplicates never create unowned heroes", () => {
  const heroes = HEROES.map((hero) => ({ id: hero.id }));
  for (const size of [1, 25]) for (const result of combat({ size, heroes: [...heroes, heroes[0], { id: "unknown" }] })) {
    assert.ok(result.members.length <= size);
    assert.equal(new Set(result.members.map((member) => member.id)).size, result.members.length);
    assert.ok(result.members.every((member) => heroes.some((hero) => hero.id === member.id)));
  }
});
test("exclusive item requirements affect Billy only when owned or equipped", () => {
  const heroes = [{ id: "billy-the-kid" }];
  assert.equal(profile(combat({ heroes }), "pursuit").members.length, 0);
  for (const patch of [{ items: ["sin-and-redemption"] }, { collection: ["sin-and-redemption"] }]) {
    const result = profile(combat({ heroes, ...patch }), "pursuit");
    assert.equal(result.members[0].zone, "key");
    assert.equal(result.score, 12);
  }
  assert.equal(profile(combat({ heroes, items: ["divine-greaves"] }), "pursuit").score, 0);
});
test("unknown conditions are not assumed and duplicate Collections count once", () => {
  const heroes = [{ id: "joan-of-arc" }, { id: "achilles" }];
  const result = profile(combat({ heroes, collection: ["holy-hand-grenade", "holy-hand-grenade"] }), "crit");
  assert.deepEqual(result.members.map((member) => member.id), ["achilles"]);
  assert.equal(result.score, 15);
  assert.ok(result.missing.includes("Joan of Arc"));
});
test("hero level and stars do not invent stats or change guide ranking", () => {
  assert.deepEqual(combat({ heroes: [{ id: "achilles" }] }), combat({ heroes: [{ id: "achilles", level: 999, stars: 5 }] }));
});
test("production matches target or universal buildings; unknown values remain unknown", () => {
  const heroes = ["heracles", "hermes", "achilles", "billy-the-kid"].map((id) => ({ id }));
  const [result] = combat({ heroes, mode: "production" });
  assert.deepEqual(result.members.map((member) => member.id), ["heracles", "hermes"]);
  assert.ok(result.members.every((member) => member.production === 40));
  assert.deepEqual(result.unmodeled, ["billy-the-kid"]);
  assert.equal(result.score, 0);
  assert.equal(productionValue(HEROES.find((hero) => hero.id === "heracles"), 999), null);
});
test("production ability levels are separate from hero level and do not sum", () => {
  const hero = HEROES.find((hero) => hero.id === "heracles");
  const level = hero.production.levels.length;
  const value = productionValue(hero, level);
  assert.ok(value.percent > 40);
  const [result] = combat({ mode: "production", heroes: [{ id: hero.id, productionLevel: level }, { id: "hermes" }] });
  assert.equal(result.members[0].production, value.percent);
  assert.equal(result.score, 0);
});
test("input order does not affect tie breaking and input remains unchanged", () => {
  const heroes = HEROES.map((hero) => ({ id: hero.id }));
  const snapshot = structuredClone(heroes);
  assert.deepEqual(combat({ heroes }), combat({ heroes: [...heroes].reverse() }));
  assert.deepEqual(heroes, snapshot);
});
test("explicit production star gates respect below, exact and unknown boundaries", () => {
  const run = (stars) => combat({ mode: "production", heroes: [{ id: "heracles", productionLevel: 5, stars }] })[0];
  assert.equal(run(5).members.length, 0);
  assert.equal(run(6).members[0].production, 56);
  assert.equal(run(undefined).members[0].requiredStars, 6);
  assert.equal(run(6).members[0].requiredStars, undefined);
});
