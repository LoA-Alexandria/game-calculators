import assert from "node:assert/strict";
import test from "node:test";

import { HEROES } from "../lib/content/heroes.ts";
import {
  PAINTING_SETS,
  paintingsForHero,
  setsByRarity,
} from "../lib/content/artwork.ts";
import en from "../lib/i18n/dictionaries/en.ts";
import de from "../lib/i18n/dictionaries/de.ts";
import fr from "../lib/i18n/dictionaries/fr.ts";
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

test("artwork layouts sits with the other Layouts guides", () => {
  const item = sectionById("guides").items.find((entry) => entry.href === "/guides/artwork/");
  assert.equal(item?.categoryId, "layouts");
  for (const dictionary of [en, de, fr]) {
    assert.equal(dictionary.guideEntries.artwork.status.length > 0, true);
    assert.equal(dictionary.guideEntries.artwork.levels[0]?.stat, "ATK");
  }
});
