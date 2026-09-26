import assert from "node:assert/strict";
import test from "node:test";
import { HEROES } from "../lib/content/heroes.ts";
import { MODELED_HEROES, MODELED_ITEMS, skillFor, simulateBattle, optimizeTeams, validateBattle } from "../lib/calculators/hero-battle.ts";
import { COLLECTION_ITEMS } from "../lib/content/collection.ts";

const hero = (id, patch = {}) => ({ id, atk: 100, hp: 1000, stars: 0, ...patch });
const options = { rounds: 20, seed: 42, trials: 8, budget: 30, size: 2, enemyFirst: false, repeatSkills: false, objective: "damage", enemy: [hero("achilles")], dummy: true, enemyReduction: 0, items: [], collection: [] };
test("modeled entries exist and all recorded star tiers compile to finite skill values", () => {
  for (const id of MODELED_HEROES) for (const stars of [0, 4, 5, 9, 10, 39, 40]) {
    const skill = skillFor(hero(id, { stars }));
    assert.ok(skill && skill.chance > 0 && skill.chance <= 1 && skill.coefficient > 0, id);
    assert.ok(skill.values.every(Number.isFinite));
  }
  for (const id of MODELED_ITEMS) assert.ok(COLLECTION_ITEMS.some((item) => item.id === id));
  assert.equal(skillFor(hero("billy-the-kid")), null);
});
test("star boundary uses source unlocks without scaling ATK or HP", () => {
  assert.equal(skillFor(hero("hermes", { stars: 4 })).level, 1);
  assert.equal(skillFor(hero("hermes", { stars: 5 })).level, 2);
  assert.equal(skillFor(hero("hermes", { stars: 40 })).coefficient, 2.8);
});
test("same seed replays identical events and different seeds exercise trigger variance", () => {
  const team = [hero("achilles"), hero("caesar")];
  assert.deepEqual(simulateBattle(team, options, 42, true), simulateBattle(team, options, 42, true));
  assert.notEqual(simulateBattle(team, options, 42).damage, simulateBattle(team, options, 999).damage);
});
test("zero attack deals zero damage and all state remains bounded", () => {
  const result = simulateBattle([hero("achilles", { atk: 0 })], options, 42, true);
  assert.equal(result.damage, 0);
  assert.equal(result.remaining, 1);
  assert.equal(result.rounds, 20);
  assert.ok(result.events.every((event) => event.amount >= 0 && event.allyHp >= 0 && event.enemyHp >= 0));
});
test("normal and skill damage consume HP; highest slot falls first and dead units stop contributing", () => {
  const opts = { ...options, dummy: false, enemyFirst: true, enemy: [hero("guinevere", { atk: 2000, hp: 100000 })] };
  const result = simulateBattle([hero("achilles", { hp: 100 }), hero("caesar", { hp: 100 })], opts, 42, true);
  const falls = result.events.filter((event) => event.action.startsWith("fall:"));
  assert.deepEqual(falls.slice(0, 2).map((event) => event.action), ["fall:caesar", "fall:achilles"]);
  assert.equal(result.damage, 0);
  assert.equal(result.alive, 0);
  assert.equal(result.remaining, 0);
});
test("DoT runs for exactly three victim actions and expires", () => {
  const result = simulateBattle([hero("lancelot")], { ...options, rounds: 30 }, 42, true);
  const dots = result.events.filter((event) => event.action === "dot");
  assert.equal(dots.length, 3);
  assert.ok(dots.every((event) => event.amount === 75));
});
test("DoT Collection effects change simulated damage rather than guide points", () => {
  const base = simulateBattle([hero("lancelot")], options);
  const boosted = simulateBattle([hero("lancelot")], { ...options, collection: ["dead-sea-scrolls", "brutus-dagger"] });
  assert.ok(boosted.damage > base.damage);
});
test("skill trigger exhaustion and repeat mode produce distinct event sequences", () => {
  const team = [hero("guinevere")];
  const once = simulateBattle(team, { ...options, rounds: 100 }, 42, true);
  const repeat = simulateBattle(team, { ...options, rounds: 100, repeatSkills: true }, 42, true);
  assert.equal(once.events.filter((event) => event.action === "cast").length, 1);
  assert.ok(repeat.events.filter((event) => event.action === "cast").length > 1);
});
test("healing restores actual missing HP and shields absorb incoming damage", () => {
  const opts = { ...options, dummy: false, enemy: [hero("guinevere", { atk: 80, hp: 100000 })], rounds: 50 };
  const result = simulateBattle([hero("da-vinci", { hp: 3000 }), hero("pompey", { hp: 3000 })], opts, 42, true);
  assert.ok(result.healing > 0);
  assert.ok(result.absorbed > 0);
  assert.ok(result.remaining >= 0 && result.remaining <= 1);
});
test("unsupported skills/items and invalid settings fail instead of receiving invented effects", () => {
  const pool = [hero("achilles"), hero("caesar")];
  for (const patch of [{ rounds: 0 }, { rounds: 101 }, { seed: -1 }, { size: 0 }, { size: 3 }, { trials: 0 }, { budget: 1001 }, { enemyReduction: NaN }, { collection: ["wings-of-icarus"] }]) assert.throws(() => validateBattle(pool, { ...options, ...patch }), RangeError);
  assert.throws(() => validateBattle([hero("billy-the-kid"), hero("caesar")], options), RangeError);
  assert.throws(() => validateBattle([hero("achilles", { hp: 0 }), hero("caesar")], options), RangeError);
});
test("optimizer independently enumerates and ranks ordered teams from a small inventory", () => {
  const pool = [hero("achilles"), hero("caesar"), hero("da-vinci")];
  const result = optimizeTeams(pool, options);
  assert.equal(result.exhaustive, true);
  assert.equal(result.evaluated, 6);
  assert.ok(result.candidates.every((candidate) => candidate.team.length === 2 && new Set(candidate.team.map((unit) => unit.id)).size === 2));
  assert.ok(result.candidates.every((candidate) => candidate.team.every((unit) => pool.some((entry) => entry.id === unit.id))));
  assert.ok(result.candidates[0].damage >= result.candidates[1].damage);
  assert.deepEqual(result, optimizeTeams([...pool].reverse(), options));
});
test("larger searches respect the candidate budget and never mutate inventory", () => {
  const pool = [...MODELED_HEROES].slice(0, 8).map((id) => hero(id));
  const before = structuredClone(pool);
  const result = optimizeTeams(pool, { ...options, size: 3, budget: 20 });
  assert.equal(result.exhaustive, false);
  assert.equal(result.evaluated, 20);
  assert.deepEqual(pool, before);
});
test("manual stat changes can change the best discovered team without any layout data", () => {
  const pool = [hero("guinevere", { atk: 1 }), hero("garwain", { atk: 500 })];
  const result = optimizeTeams(pool, { ...options, size: 1 });
  assert.equal(result.candidates[0].team[0].id, "garwain");
});
test("all one-round supported skills remain finite across seeded samples", () => {
  for (const entry of HEROES.filter((hero) => MODELED_HEROES.has(hero.id))) for (const seed of [0, 1, 42]) {
    const result = simulateBattle([hero(entry.id)], { ...options, rounds: 1 }, seed);
    assert.ok(Number.isFinite(result.damage) && result.damage >= 0, entry.id);
  }
});
test("a one-turn barrier protects against the next incoming action even when casting second", () => {
  const opts = { ...options, rounds: 3, dummy: false, enemyFirst: true, enemy: [hero("guinevere", { atk: 30, hp: 100000 })] };
  let protectedSecondCaster = false;
  for (let seed = 0; seed < 100; seed++) {
    const result = simulateBattle([hero("pompey", { hp: 10000 })], opts, seed, true);
    if (result.events.some((event) => event.side === 1 && event.action === "immune")) { protectedSecondCaster = true; break; }
  }
  assert.equal(protectedSecondCaster, true);
});
test("snapshot percentage positions for complex effects fail on source drift", () => {
  const expected = { hermes: [.4,2,.3], merlin: [.4,2,.4,1.5], "king-arthur": [.4,2,.2,.75], odysseus: [.4,2,.75,.5], "bjorn-ironside": [.4,2,.2,.5,.5], lagertha: [.4,2,.5,.5,.5], pompey: [.4,2,.5,.5], caesar: [.4,2,1,.4,.4], "da-vinci": [.4,2,.2,.2], augustus: [.4,2,1,.5] };
  for (const [id, values] of Object.entries(expected)) assert.deepEqual(skillFor(hero(id)).values, values, id);
});

test("Brutus Dagger resolves after the opponent acts, including dummy boundaries", () => {
  const opts = { ...options, dummy: false, rounds: 4, enemy: [hero("guinevere", { hp: 300 })], collection: ["brutus-dagger"] };
  const result = simulateBattle([hero("lancelot")], opts, 0, true);
  const dagger = result.events.findIndex((event) => event.actor === "brutus-dagger" && event.action === "collection");
  assert.ok(dagger > result.events.findIndex((event) => event.side === 1 && ["normal", "skill"].includes(event.action)));
  assert.ok(result.remaining < 1);
  const dummy = simulateBattle([hero("lancelot")], { ...opts, dummy: true, rounds: 20 }, 0, true);
  assert.equal(dummy.events.filter((event) => event.actor === "brutus-dagger").length, 3);
});

test("Horn stacks coexist with Arthur reduction and persist after its expiry", () => {
  const opts = { ...options, rounds: 15, dummy: false, repeatSkills: true, enemy: [hero("guinevere", { hp: 100000 })], collection: ["heimdalls-horn"] };
  const result = simulateBattle([hero("king-arthur", { atk: 1, hp: 100000 })], opts, 42, true);
  const damageAt = (round) => result.events.find((event) => event.round === round && event.side === 1 && event.action === "skill").amount;
  assert.ok(Math.abs(damageAt(9) - 64) < 1e-9); // 48% Horn + 20% Arthur.
  assert.equal(damageAt(13), 104); // Arthur expires; 48% Horn remains.
});
