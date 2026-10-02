import assert from "node:assert/strict";
import test from "node:test";
import { HEROES } from "../lib/content/heroes.ts";
import { MODELED_HEROES, MODELED_ITEMS, seededRandom, skillFor, simulateBattle, optimizeTeams, validateBattle } from "../lib/calculators/hero-battle.ts";
import { COLLECTION_ITEMS } from "../lib/content/collection.ts";

const hero = (id, patch = {}) => ({ id, atk: 100, hp: 1000, stars: 0, ...patch });
const options = { rounds: 20, seed: 42, trials: 8, budget: 30, size: 2, objective: "damage", enemy: [hero("achilles")], dummy: true, enemyReduction: 0, items: [], collection: [] };
test("modeled entries exist and all recorded star tiers compile to finite skill values", () => {
  for (const id of MODELED_HEROES) for (const stars of [0, 4, 5, 9, 10, 39, 40]) {
    const skill = skillFor(hero(id, { stars }));
    assert.ok(skill && skill.chance > 0 && skill.chance <= 1 && skill.coefficient > 0, id);
    assert.ok(skill.values.every(Number.isFinite));
  }
  for (const id of MODELED_ITEMS) assert.ok(COLLECTION_ITEMS.some((item) => item.id === id));
  assert.equal(skillFor(hero("billy-the-kid")).source, "workbook-fallback");
});
test("every Core hero has a documented direct-damage model or is rejected as unknown", () => {
  for (const entry of HEROES) {
    const skill = skillFor(hero(entry.id));
    assert.ok(skill && skill.chance > 0 && skill.coefficient > 0, entry.id);
  }
  assert.equal(skillFor(hero("not-a-core-hero")), null);
});
test("every living hero rolls; the lowest successful unused slot gets the single action", () => {
  const team = [hero("achilles"), hero("billy-the-kid"), hero("caesar")];
  const seed = Array.from({ length: 10_000 }, (_, value) => value).find((value) => {
    const random = seededRandom(value);
    return team.every((unit) => random() < skillFor(unit).chance);
  });
  assert.notEqual(seed, undefined, "find a deterministic trial where every slot triggers");
  const result = simulateBattle(team, { ...options, rounds: 1 }, seed, true);
  const rolls = result.events.filter((event) => event.action === "skillRoll" && event.side === 0);
  assert.deepEqual(rolls.map((event) => [event.round, event.actor, event.succeeded, event.selected]), team.map((unit, index) => [1, unit.id, true, index === 0]));
  assert.deepEqual(result.events.filter((event) => event.action === "heroAction" && event.side === 0).map((event) => [event.round, event.actor, event.effectKey]), [[1, "achilles", "skillAttack"]]);
  assert.equal(result.events.filter((event) => event.action === "heroAction" && event.side === 0).length, 1);
  assert.ok(result.events.filter((event) => ["normal", "skill", "critical", "extra", "collection"].includes(event.action)).every((event) => event.target && event.hpBefore !== undefined && event.hpAfter !== undefined));
});
test("the player opens round 1 and the enemy gets exactly one action after that", () => {
  const team = [hero("achilles", { hp: 100000 }), hero("caesar", { hp: 100000 })];
  const enemy = [hero("guinevere", { atk: 30, hp: 100000 }), hero("merlin", { atk: 30, hp: 100000 })];
  const result = simulateBattle(team, { ...options, rounds: 4, dummy: false, enemy }, 1, true);
  const actions = result.events.filter((event) => event.action === "heroAction");
  const playerFirst = result.events.findIndex((event) => event.action === "heroAction" && event.side === 0);
  const enemyFirst = result.events.findIndex((event) => event.action === "heroAction" && event.side === 1);
  assert.ok(playerFirst >= 0 && enemyFirst > playerFirst);
  assert.deepEqual(actions.filter((event) => event.side === 1).map(({ round }) => round), [1]);
  assert.deepEqual(actions.filter((event) => event.side === 0).map(({ round }) => round), [1, 2, 3, 4]);
  const dummy = simulateBattle(team, { ...options, rounds: 4, dummy: true }, 1, true);
  assert.equal(dummy.events.some((event) => event.side === 1 && event.action === "heroAction"), false);
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
  const opts = { ...options, dummy: false, enemy: [hero("guinevere", { atk: 2000, hp: 100000 })] };
  const result = simulateBattle([hero("achilles", { hp: 100 }), hero("caesar", { hp: 100 })], opts, 42, true);
  const falls = result.events.filter((event) => event.action.startsWith("fall:"));
  assert.deepEqual(falls.slice(0, 2).map((event) => event.action), ["fall:caesar", "fall:achilles"]);
  assert.ok(result.damage > 0, "player acts before the opponent in round 1");
  assert.equal(result.alive, 0);
  assert.equal(result.remaining, 0);
});
test("DoT resolves per victim action while a hero skill is used only once", () => {
  const result = simulateBattle([hero("lancelot")], { ...options, rounds: 30 }, 42, true);
  const dots = result.events.filter((event) => event.action === "dot");
  const casts = result.events.filter((event) => event.actor === "lancelot" && event.action === "cast").length;
  assert.equal(casts, 1);
  assert.equal(dots.length, 3);
  assert.ok(dots.every((event) => event.amount === 75));
});
test("DoT Collection effects change simulated damage rather than guide points", () => {
  const base = simulateBattle([hero("lancelot")], options);
  const boosted = simulateBattle([hero("lancelot")], { ...options, collection: ["dead-sea-scrolls", "brutus-dagger"] });
  assert.ok(boosted.damage > base.damage);
});
test("each hero skill is consumed at most once and later turns become normal attacks", () => {
  const result = simulateBattle([hero("guinevere")], { ...options, rounds: 100 }, 42, true);
  assert.equal(result.events.filter((event) => event.action === "cast").length, 1);
  assert.ok(result.events.filter((event) => event.action === "heroAction" && event.effectKey === "normalAttack").length > 1);
});
test("a used skill still rolls but cannot win a later action", () => {
  const unit = hero("guinevere");
  const seed = Array.from({ length: 10_000 }, (_, value) => value).find((candidate) => {
    const result = simulateBattle([unit], { ...options, rounds: 2 }, candidate, true);
    return result.events.some((event) => event.action === "cast" && event.actor === unit.id && event.round === 1)
      && result.events.some((event) => event.action === "skillRoll" && event.actor === unit.id && event.round === 2 && event.succeeded);
  });
  assert.notEqual(seed, undefined);
  const result = simulateBattle([unit], { ...options, rounds: 2 }, seed, true);
  const secondRoll = result.events.find((event) => event.action === "skillRoll" && event.actor === unit.id && event.round === 2);
  assert.equal(secondRoll.succeeded, true);
  assert.equal(secondRoll.eligible, false);
  assert.equal(secondRoll.selected, false);
  assert.equal(result.events.find((event) => event.action === "heroAction" && event.round === 2).effectKey, "normalAttack");
  assert.equal(result.events.filter((event) => event.action === "cast" && event.actor === unit.id).length, 1);
});
test("the one-time round-1 opponent attack can be absorbed by a shield", () => {
  const opts = { ...options, dummy: false, enemy: [hero("guinevere", { atk: 80, hp: 100000 })], rounds: 2 };
  const seed = Array.from({ length: 10_000 }, (_, value) => value).find((value) => seededRandom(value)() < skillFor(hero("da-vinci")).chance);
  const result = simulateBattle([hero("da-vinci", { hp: 3000 }), hero("pompey", { hp: 3000 })], opts, seed, true);
  assert.ok(result.absorbed > 0);
  assert.ok(result.remaining >= 0 && result.remaining <= 1);
});
test("Cryptid healing resolves in its later scheduled round after the opponent's opening hit", () => {
  const result = simulateBattle([hero("achilles", { hp: 3000 })], {
    ...options, dummy: false, rounds: 2, enemy: [hero("guinevere", { atk: 80, hp: 100000 })],
    cryptides: [null, { id: "sleipnir", skills: 1 }],
  }, 1, true);
  assert.ok(result.healing > 0);
  assert.equal(result.events.find((event) => event.action === "heal")?.round, 2);
});
test("unsupported skills/items and invalid settings fail instead of receiving invented effects", () => {
  const pool = [hero("achilles"), hero("caesar")];
  for (const patch of [{ rounds: 0 }, { rounds: 101 }, { seed: -1 }, { size: 0 }, { size: 3 }, { trials: 0 }, { budget: 1001 }, { enemyReduction: NaN }, { collection: ["wings-of-icarus"] }, { collectionSlots: 7 }, { enemyCount: 2 }, { cryptides: [{ id: "nidhogg", skills: 4 }] }, { cryptides: Array.from({ length: 5 }, () => ({ id: "nidhogg", skills: 1 })) }]) assert.throws(() => validateBattle(pool, { ...options, ...patch }), RangeError);
  assert.doesNotThrow(() => validateBattle([hero("billy-the-kid"), hero("caesar")], options));
  assert.throws(() => validateBattle([hero("not-a-core-hero"), hero("caesar")], options), RangeError);
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
test("optimizer searches owned Collection choices together with the best ordered team", () => {
  const pool = [hero("lancelot")];
  const opts = { ...options, size: 1, budget: 2, collectionSlots: 1, collection: ["dead-sea-scrolls", "prometheus-torch"] };
  const result = optimizeTeams(pool, opts);
  assert.equal(result.exhaustive, true);
  assert.equal(result.evaluated, 2);
  const expected = opts.collection.map((id) => {
    const damage = Array.from({ length: 128 }, (_, i) => simulateBattle(pool, { ...opts, collection: [id] }, (opts.seed + i * 7919 + 1000003) >>> 0).damage).reduce((sum, value) => sum + value, 0) / 128;
    return { id, damage };
  }).sort((a, b) => b.damage - a.damage)[0];
  assert.deepEqual(result.candidates[0].collection, [expected.id]);
  assert.equal(result.candidates[0].damage, expected.damage);
  assert.ok(result.candidates.every((candidate) => candidate.collection.length === 1));
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
  const opts = { ...options, rounds: 3, dummy: false, enemy: [hero("guinevere", { atk: 30, hp: 100000 })] };
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
  assert.equal(dummy.events.filter((event) => event.actor === "brutus-dagger").length, dummy.events.filter((event) => event.action === "dot").length);
});

test("one-time Arthur skill expires while the Horn's independently stacked reduction remains", () => {
  const opts = { ...options, rounds: 15, dummy: false, enemy: [hero("guinevere", { hp: 100000 })], collection: ["heimdalls-horn"] };
  const result = simulateBattle([hero("king-arthur", { atk: 1, hp: 100000 })], opts, 42, true);
  assert.equal(result.events.filter((event) => event.side === 0 && event.action === "cast").length, 1);
  assert.ok(result.events.some((event) => event.side === 0 && event.action === "expire" && event.effectKey === "reduction"));
  assert.equal(result.events.filter((event) => event.side === 0 && event.actor === "heimdalls-horn" && event.action === "buff").length, 5);
});

test("Cryptides are staggered one per round in slots 1–4 and never act again", () => {
  const result = simulateBattle([hero("achilles"), hero("caesar")], {
    ...options, rounds: 8, cryptides: [{ id: "sleipnir", skills: 3 }, { id: "nidhogg", skills: 3 }, { id: "cerberus", skills: 2 }, { id: "caladrius", skills: 1 }],
  }, 42, true);
  assert.deepEqual(result.events.filter((event) => event.action === "cryptidAction").map(({ round, actor, amount }) => [round, actor, amount]), [[1, "sleipnir", 3], [2, "nidhogg", 3], [3, "cerberus", 2], [4, "caladrius", 1]]);
  assert.equal(result.events.filter((event) => event.action === "cryptidAction").length, 4);
  assert.ok(result.events.filter((event) => event.action === "cryptidAction").every((event) => event.round <= 4));
  const secondSlotOnly = simulateBattle([hero("achilles")], { ...options, rounds: 6, cryptides: [null, { id: "nidhogg", skills: 2 }] }, 42, true);
  assert.deepEqual(secondSlotOnly.events.filter((event) => event.action === "cryptidAction").map(({ round, actor }) => [round, actor]), [[2, "nidhogg"]]);
  assert.ok(result.damage > simulateBattle([hero("achilles"), hero("caesar")], { ...options, rounds: 4 }, 42).damage);
  const oneUnlocked = simulateBattle([hero("guinevere")], { ...options, rounds: 8, enemyReduction: .5, cryptides: [{ id: "nidhogg", skills: 1 }] }, 42);
  const threeUnlocked = simulateBattle([hero("guinevere")], { ...options, rounds: 8, enemyReduction: .5, cryptides: [{ id: "nidhogg", skills: 3 }] }, 42);
  assert.ok(threeUnlocked.damage > oneUnlocked.damage);
});

test("optimizer evaluates Cryptid identity and round assignments as part of the layout", () => {
  const result = optimizeTeams([hero("achilles")], {
    ...options, size: 1, rounds: 4, trials: 1, budget: 20, collectionSlots: 0,
    cryptides: [{ id: "nidhogg", skills: 2 }, { id: "caladrius", skills: 1 }],
  });
  assert.equal(result.exhaustive, true);
  assert.equal(result.evaluated, 12); // 4 × 3 distinct assignments of 2 Cryptids to rounds 1–4.
  const best = result.candidates[0];
  assert.equal(best.cryptides.length, 4);
  assert.equal(best.cryptides.filter(Boolean).length, 2);
  assert.deepEqual(new Set(best.cryptides.filter(Boolean).map(({ id }) => id)), new Set(["nidhogg", "caladrius"]));
  assert.deepEqual(result.trace.events.filter((event) => event.action === "cryptidAction").map(({ round, actor }) => [round, actor]), best.cryptides.flatMap((entry, index) => entry ? [[index + 1, entry.id]] : []));
});

test("Sleipnir removes the allied debuff applied by the opponent's round-1 skill", () => {
  const seed = Array.from({ length: 10_000 }, (_, value) => value).find((candidate) => seededRandom(candidate)() < skillFor(hero("charles-the-great")).chance);
  const result = simulateBattle([hero("lancelot")], {
    ...options, dummy: false, rounds: 4, enemy: [hero("charles-the-great", { hp: 100000 })],
    cryptides: [null, null, { id: "sleipnir", skills: 3 }],
  }, seed, true);
  assert.ok(result.events.some((event) => event.action === "dispelDebuff" && event.amount > 0));
});

test("finite dummy groups share one pool and attacks are never multiplied by target count", () => {
  const team = [hero("hermes", { atk: 1500 })];
  const infiniteOne = simulateBattle(team, { ...options, rounds: 1, enemyCount: 1, infiniteDummy: true }, 0);
  const infiniteThirty = simulateBattle(team, { ...options, rounds: 1, enemyCount: 30, infiniteDummy: true }, 0);
  assert.equal(infiniteOne.damage, infiniteThirty.damage);
  const finiteOne = simulateBattle(team, { ...options, rounds: 1, enemyCount: 1, infiniteDummy: false }, 0);
  const finiteFive = simulateBattle(team, { ...options, rounds: 1, enemyCount: 5, infiniteDummy: false }, 0);
  const finiteThirty = simulateBattle(team, { ...options, rounds: 1, enemyCount: 30, infiniteDummy: false }, 0);
  assert.equal(finiteOne.damage, 1000);
  assert.ok(finiteFive.damage > finiteOne.damage);
  assert.equal(finiteFive.damage, 3000);
  assert.equal(finiteThirty.damage, finiteFive.damage);
});
