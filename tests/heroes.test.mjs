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
  localizedHero,
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
  assert.equal(heroNamed("Gawain")?.name, "Gawain");
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
  assert.equal(merlin?.skill?.name, "Ice Dragon's Breath");
  const morgana = HEROES.find((hero) => hero.id === "morgana");
  assert.equal(morgana?.rarity, "UR");
  assert.match(morgana?.skill?.levels[0] ?? "", /Strip/);
  const cleopatra = HEROES.find((hero) => hero.id === "cleopatra");
  assert.equal(cleopatra?.rarity, "UR+");
  const hermes = HEROES.find((hero) => hero.id === "hermes");
  assert.equal(hermes?.obtain, "Tap Football");
});

test("event heroes name the run of their event, and only heroes with one source name it", () => {
  const source = (id) => HEROES.find((hero) => hero.id === id)?.obtain;
  // Autumn's obtain guide, 9 August 2026. Arthur and Lancelot were filed under
  // Atlantis here until it confirmed the Grail, which is also what the Hero
  // linking guide says.
  assert.equal(source("king-arthur"), "Holy Grail #1");
  assert.equal(source("garwain"), "Holy Grail #1");
  assert.equal(source("lancelot"), "Holy Grail #3");
  assert.equal(source("morgana"), "Holy Grail #5");
  assert.equal(source("odysseus"), "Deep into Atlantis #1");
  assert.equal(source("circe"), "Deep into Atlantis #5");
  assert.equal(source("lagertha"), "The eve of Ragnarok #3");
  assert.equal(source("cleopatra"), "Crown of the Nile");
  assert.equal(source("achilles"), "Campaign red chest");
  assert.equal(source("charles-the-great"), "Monument of Eternity and the guild shop");

  // Every UR+ comes from one event, so none of them may be left blank.
  for (const hero of heroesByRarity("UR+")) assert.ok(hero.obtain.trim(), `${hero.name} names a source`);
  // The rest come from the shared pools, which the guide lists once.
  assert.equal(source("confucius"), "");
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

test("game text falls back to English until a language overrides it", () => {
  const merlin = HEROES.find((hero) => hero.id === "merlin");
  assert.deepEqual(localizedHero(merlin, {}), merlin, "no catalog leaves the hero alone");

  const de = {
    merlin: {
      obtain: "Wunschbrunnen",
      skill: { name: "Atem des Eisdrachen", levels: ["Lv. 1 auf Deutsch", "  "] },
    },
  };
  const translated = localizedHero(merlin, de);
  assert.equal(translated.obtain, "Wunschbrunnen");
  assert.equal(translated.name, merlin.name, "the name is the same in every language");
  assert.equal(translated.skill.name, "Atem des Eisdrachen");
  assert.equal(translated.skill.levels[0], "Lv. 1 auf Deutsch");
  assert.equal(translated.skill.levels[1], merlin.skill.levels[1], "a blank level keeps the English text");
  assert.equal(translated.skill.levels.length, merlin.skill.levels.length);
  assert.deepEqual(translated.buff, merlin.buff, "an untranslated ability is unchanged");

  // A reader searching in their own language finds the hero by the translated text.
  assert.equal(searchHeroes("Eisdrachen", "all", [de]).map((hero) => hero.id).includes("merlin"), true);
  assert.equal(searchHeroes("Eisdrachen", "all").length, 0);
  assert.equal(searchHeroes("Ice Dragon", "all", [de]).map((hero) => hero.id).includes("merlin"), true);
});

test("every published dictionary keys its hero texts to a hero in the roster", async () => {
  const { LOCALES, getDictionary } = await import("../lib/i18n/index.ts");
  const ids = new Set(HEROES.map((hero) => hero.id));
  for (const { code } of LOCALES) {
    const texts = getDictionary(code).guideEntries.heroes.heroTexts;
    for (const id of Object.keys(texts)) assert.ok(ids.has(id), `${code}: ${id} is a hero id`);
  }
  assert.deepEqual(getDictionary("en").guideEntries.heroes.heroTexts, {}, "English is the roster JSON itself");
});

test("the heroes banner collage uses primary portraits that exist on disk", async () => {
  const { access } = await import("node:fs/promises");
  const { HERO_BANNER_IMAGES } = await import("../lib/content/hero-banner.ts");
  const primary = new Set(HEROES.flatMap((hero) => (hero.images[0] ? [hero.images[0]] : [])));
  for (const file of HERO_BANNER_IMAGES) {
    assert.ok(primary.has(file), `${file} should be a primary roster portrait`);
    await access(new URL(`../public/heroes/${file}`, import.meta.url));
  }
});
