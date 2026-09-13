import assert from "node:assert/strict";
import test from "node:test";

import { HEROES, HERO_STAR_COSTS, heroesByRarity, searchHeroes } from "../lib/content/heroes.ts";

test("roster covers every wiki rarity and names the screenshot fills", () => {
  assert.equal(heroesByRarity("UR+").length, 14);
  assert.equal(heroesByRarity("UR").length, 13);
  assert.equal(heroesByRarity("SSR").length, 18);
  assert.equal(heroesByRarity("SR").length, 18);
  assert.equal(heroesByRarity("R").length, 12);
  assert.equal(HEROES.length, 75);
  assert.equal(new Set(HEROES.map((hero) => hero.id)).size, HEROES.length);
  assert.equal(HEROES.some((hero) => JSON.stringify(hero).includes("Data pending")), false);

  const merlin = HEROES.find((hero) => hero.id === "merlin");
  assert.equal(merlin?.skills[0]?.name, "Ice Dragon's Breath");
  const morgana = HEROES.find((hero) => hero.id === "morgana");
  assert.equal(morgana?.rarity, "UR");
  assert.match(morgana?.skills[0]?.text ?? "", /Strip/);
  const cleopatra = HEROES.find((hero) => hero.id === "cleopatra");
  assert.equal(cleopatra?.rarity, "UR+");
  const hermes = HEROES.find((hero) => hero.id === "hermes");
  assert.equal(hermes?.obtain, "Tap Football");
});

test("star fragment row 1 starts at 25 green shards", () => {
  assert.deepEqual(HERO_STAR_COSTS[0]?.costs, [25, 50, 100, 100, 200, 300, 400, 500]);
  assert.equal(HERO_STAR_COSTS[4]?.costs[7], 600);
});

test("hero search matches skill text across rarities", () => {
  const hits = searchHeroes("shield break", "all");
  assert.equal(hits.some((hero) => hero.id === "merlin"), true);
  assert.equal(searchHeroes("zzzz", "all").length, 0);
});
