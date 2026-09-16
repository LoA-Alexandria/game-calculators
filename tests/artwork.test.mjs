import assert from "node:assert/strict";
import test from "node:test";

import { LOCALE_CODES, getDictionary } from "../lib/i18n/index.ts";
import { HEROES } from "../lib/content/heroes.ts";
import {
  PAINTING_SETS,
  paintingsForHero,
  setsByRarity,
} from "../lib/content/artwork.ts";
import { SET_SKILL_BUILDS, setSkillRank } from "../lib/content/artwork-layouts.ts";
import { sectionById } from "../lib/navigation.ts";

test("catalogue covers Autumn's rarities and does not invent Buzz Aldrin's fourth hero", () => {
  assert.equal(setsByRarity("SSR").length, 10);
  assert.equal(setsByRarity("SR").length, 10);
  assert.equal(setsByRarity("R").length, 5);
  assert.equal(PAINTING_SETS[0]?.name, "Glory and Shadow");
  const ids = PAINTING_SETS.flatMap((entry) => entry.paintings.map((canvas) => canvas.id));
  assert.equal(new Set(ids).size, ids.length);
  const moon = PAINTING_SETS.flatMap((entry) => entry.paintings).find((canvas) => canvas.id === "buzz-aldrin-on-the-moon");
  assert.equal(moon?.heroes.length, 3);
  assert.equal(moon?.heroes.includes("Nikola Tesla"), true);
});

test("hero filter matches Discord short names and keeps Joan as the UR+ exception", () => {
  const achilles = paintingsForHero("Achilles");
  assert.equal(achilles.some((hit) => hit.set.name === "Nature in Bloom"), true);
  assert.equal(achilles.some((hit) => hit.painting.name === "Young Hare"), true);
  const joan = paintingsForHero("Joan");
  assert.equal(joan.some((hit) => hit.painting.name === "The Floor Scrapers"), true);
  const augustus = paintingsForHero("Augustus");
  assert.equal(augustus.some((hit) => hit.set.name === "Glory and Shadow"), true);
  assert.equal(paintingsForHero("zzzz").length, 0);

  const named = new Set(PAINTING_SETS.flatMap((entry) => entry.paintings.flatMap((canvas) => canvas.heroes)));
  assert.equal(named.has("Joan of Arc"), true);
  for (const hero of HEROES.filter((entry) => entry.rarity === "UR+")) {
    assert.equal(named.has(hero.name), false, `${hero.name} is UR+ and should not appear`);
  }
});

test("artwork sits in Core elements and artwork layouts stays under Layouts", () => {
  const artwork = sectionById("guides").items.find((entry) => entry.href === "/guides/artwork/");
  const layouts = sectionById("guides").items.find((entry) => entry.href === "/guides/artwork-layouts/");
  assert.equal(artwork?.categoryId, "coreElements");
  assert.equal(layouts?.categoryId, "layouts");
  for (const dictionary of LOCALE_CODES.map(getDictionary)) {
    assert.equal(dictionary.guideEntries.artwork.status.length > 0, true);
    assert.equal(dictionary.guideEntries.artworkLayouts.levels[0]?.stat, "ATK");
    assert.equal(dictionary.guideEntries.artworkLayouts.buildNames.crit.length > 0, true);
  }
});

test("set-skill ranking swaps the first slot and keeps Autumn's eight named sets", () => {
  assert.equal(setSkillRank("crit")[0]?.set.name, "Nature in Bloom");
  assert.equal(setSkillRank("pursuit")[0]?.set.name, "Self-Portrait");
  assert.equal(setSkillRank("dot")[0]?.set.name, "Urban Proletariat");
  const hybrid = setSkillRank("hybrid");
  assert.equal(hybrid.length, 8);
  assert.equal(hybrid.find((row) => row.insert)?.set.name, "Ukiya-e Masterpieces");
  for (const build of SET_SKILL_BUILDS) {
    assert.equal(setSkillRank(build).length, 8, build);
  }
});

test("every painting picture exists, none is left over, and the translations name real paintings", async () => {
  const { readdirSync } = await import("node:fs");
  const listed = PAINTING_SETS.flatMap((entry) => entry.paintings.map((canvas) => canvas.image)).filter(Boolean);
  const files = readdirSync(new URL("../public/artwork/", import.meta.url));
  assert.deepEqual([...files].sort(), [...listed].sort());
  const ids = new Set(PAINTING_SETS.flatMap((entry) => entry.paintings.map((canvas) => canvas.id)));
  const setIds = new Set(PAINTING_SETS.map((entry) => entry.id));
  for (const code of LOCALE_CODES) {
    const texts = getDictionary(code).guideEntries.artwork.catalogTexts;
    for (const id of Object.keys(texts.paintings ?? {})) assert.ok(ids.has(id), `${code}: ${id} is not a painting`);
    for (const id of Object.keys(texts.sets ?? {})) assert.ok(setIds.has(id), `${code}: ${id} is not a set`);
  }
  for (const canvas of PAINTING_SETS.flatMap((entry) => entry.paintings)) {
    if (canvas.circa) assert.ok(canvas.year, `${canvas.id}: circa without a year`);
    if (canvas.year) assert.match(canvas.year, /^\d{3,4}(–\d{3,4})?$/, `${canvas.id}: year ${canvas.year}`);
  }
});

test("the catalogue search finds heroes, painting names and originals in every language, and artists", async () => {
  const { searchCatalogue, originalTitle } = await import("../lib/content/artwork.ts");
  const catalogs = LOCALE_CODES.map((code) => getDictionary(code).guideEntries.artwork.catalogTexts);
  const ids = (query) => searchCatalogue(query, catalogs).map((hit) => hit.painting.id);
  assert.ok(ids("Achilles").includes("young-hare"));
  assert.deepEqual(ids("Die Schaukel"), ["the-swing"]);
  assert.deepEqual(ids("escarpolette"), ["the-swing"]);
  assert.deepEqual(ids("nighthawks"), ["nightshade"]);
  assert.ok(ids("van gogh").includes("cafe-terrace-at-night"));
  assert.ok(ids("durer").includes("young-hare"), "accents do not matter");
  assert.deepEqual(searchCatalogue("", catalogs), []);

  const swing = PAINTING_SETS.flatMap((entry) => entry.paintings).find((canvas) => canvas.id === "the-swing");
  const french = getDictionary("fr").guideEntries.artwork.catalogTexts;
  assert.equal(originalTitle(swing, french), "Les Hasards heureux de l’escarpolette");
  assert.equal(originalTitle(swing, {}), "The Swing");
});
