import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  HERO_RARITIES,
  HEROES,
  HERO_STAR_COSTS,
  heroImageUrl,
  heroNamed,
  heroPortrait,
  heroesByRarity,
  searchHeroes,
} from "../lib/content/heroes.ts";

test("every portrait in the roster is a file in public/heroes and none is orphaned", () => {
  const folder = new URL("../public/heroes/", import.meta.url);
  const files = readdirSync(folder);
  const referenced = HEROES.flatMap((hero) => hero.images);
  assert.equal(new Set(referenced).size, referenced.length, "no file is shared by two entries");
  assert.deepEqual([...referenced].sort(), [...files].sort());
  for (const file of files) {
    const head = readFileSync(new URL(file, folder)).subarray(0, 12).toString("latin1");
    assert.ok(file.endsWith(".webp") ? head.startsWith("RIFF") && head.endsWith("WEBP") : file.endsWith(".png"), `${file} is an image`);
  }
  for (const hero of HEROES) assert.ok(HERO_RARITIES.includes(hero.rarity), `${hero.name} has a known rarity`);
  assert.equal(HEROES.filter((hero) => hero.images.length > 0).length, 74);
  assert.deepEqual(heroNamed("Cleopatra")?.images, []);
});

test("portraits resolve the tier list and layouts spelling of a hero", () => {
  assert.equal(heroPortrait("Newton"), heroImageUrl("isaac-newton.webp"));
  assert.equal(heroPortrait("Isaac Newton"), heroImageUrl("isaac-newton.webp"));
  assert.equal(heroNamed("Gawain")?.name, "Garwain");
  assert.equal(heroNamed("  merlin ")?.id, "merlin");
  assert.equal(heroPortrait("Cleopatra"), null);
  assert.equal(heroPortrait("Augustus"), null);
  assert.equal(heroImageUrl("merlin.webp"), "/heroes/merlin.webp");
});

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
