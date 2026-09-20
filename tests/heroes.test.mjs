import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  HERO_AGES,
  HERO_RARITIES,
  HERO_TROOPS,
  HEROES,
  HERO_STAR_COSTS,
  heroImageUrl,
  heroNamed,
  heroPortrait,
  heroesByRarity,
  localizedHero,
  searchHeroes,
} from "../lib/content/heroes.ts";

/** Encyclopedia bios that open with a fuller name than the roster card. */
const BIO_OPENERS = {
  caesar: "Julius Caesar",
  "queen-victoria": "Alexandrina Victoria",
  "isaac-newton": "Sir Isaac Newton",
  "charles-the-great": "Charlemagne",
  "da-vinci": "Leonardo da Vinci",
  beethoven: "Ludwig van Beethoven",
  franklin: "Benjamin Franklin",
  columbus: "Christopher Columbus",
  "eleanor-of-aquitaine": ["Eleanor of Aquitaine", "Eleanor Aquitaine"],
  "thomas-edison": "Thomas Alva Edison",
  "mary-i": "Mary Stuart",
  wallace: "William Wallace",
  "catherine-de-medici": ["Catherine de'Medici", "Catherine de' Medici"],
};

function bioOpensFor(hero, bio) {
  const aliases = BIO_OPENERS[hero.id];
  const names = aliases ? (Array.isArray(aliases) ? aliases : [aliases]) : [hero.name];
  return names.some((name) => bio.startsWith(name));
}

test("every portrait in the roster is a file in public/heroes and none is orphaned", () => {
  const folder = new URL("../public/heroes/", import.meta.url);
  // The figures live in their own folder next to the portraits.
  const files = readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  const referenced = HEROES.flatMap((hero) => hero.images);
  assert.equal(new Set(referenced).size, referenced.length, "no file is shared by two entries");
  assert.deepEqual([...referenced].sort(), [...files].sort());
  for (const file of files) {
    const head = readFileSync(new URL(file, folder)).subarray(0, 12).toString("latin1");
    assert.ok(file.endsWith(".webp") ? head.startsWith("RIFF") && head.endsWith("WEBP") : file.endsWith(".png"), `${file} is an image`);
  }
  for (const hero of HEROES) assert.ok(HERO_RARITIES.includes(hero.rarity), `${hero.name} has a known rarity`);
  assert.equal(HEROES.filter((hero) => hero.images.length > 0).length, 82);
  assert.ok(heroNamed("Cleopatra")?.images[0]);
});

test("every figure belongs to a hero, and no hero file is orphaned", async () => {
  const { HERO_CHIBIS, heroChibiUrl } = await import("../lib/content/hero-chibis.ts");
  const folder = new URL("../public/heroes/chibi/", import.meta.url);
  const files = readdirSync(folder).filter((file) => !file.startsWith("."));
  assert.deepEqual([...HERO_CHIBIS].sort(), [...HERO_CHIBIS], "the list stays sorted");
  assert.deepEqual(HERO_CHIBIS.map((id) => `${id}.webp`).sort(), [...files].sort());
  const ids = new Set(HEROES.map((hero) => hero.id));
  for (const id of HERO_CHIBIS) assert.ok(ids.has(id), `${id} is a hero in the roster`);
  for (const file of files) {
    const head = readFileSync(new URL(file, folder)).subarray(0, 12).toString("latin1");
    assert.ok(head.startsWith("RIFF") && head.endsWith("WEBP"), `${file} is a WebP`);
  }
  assert.match(heroChibiUrl("hermes") ?? "", /\/heroes\/chibi\/hermes\.webp$/);
  assert.equal(heroChibiUrl("guan-yu"), null);
});

test("portraits resolve the tier list and layouts spelling of a hero", () => {
  assert.equal(heroPortrait("Newton"), heroImageUrl("isaac-newton.webp"));
  assert.equal(heroPortrait("Isaac Newton"), heroImageUrl("isaac-newton.webp"));
  assert.equal(heroNamed("Gawain")?.name, "Gawain");
  assert.equal(heroNamed("  merlin ")?.id, "merlin");
  assert.ok(heroPortrait("Cleopatra"));
  assert.ok(heroPortrait("Augustus"));
  assert.ok(heroPortrait("Alexander the Great"));
  assert.equal(heroImageUrl("merlin.webp"), "/heroes/merlin.webp");
});

test("roster covers every wiki rarity and names the screenshot fills", () => {
  assert.equal(heroesByRarity("UR+").length, 15);
  assert.equal(heroesByRarity("UR").length, 19);
  assert.equal(heroesByRarity("SSR").length, 18);
  assert.equal(heroesByRarity("SR").length, 18);
  assert.equal(heroesByRarity("R").length, 12);
  assert.equal(HEROES.length, 82);
  assert.equal(new Set(HEROES.map((hero) => hero.id)).size, HEROES.length);
  assert.equal(HEROES.some((hero) => JSON.stringify(hero).includes("Data pending")), false);

  const filled = HEROES.filter((hero) => hero.skill && hero.buff && hero.production);
  assert.equal(filled.length, 37);
  for (const hero of filled) {
    assert.equal(hero.skill?.levels.length, 9, `${hero.name} skill table`);
    assert.equal(hero.buff?.levels.length, 9, `${hero.name} buff table`);
    assert.equal(hero.production?.levels.length, 25, `${hero.name} production table`);
  }

  const merlin = HEROES.find((hero) => hero.id === "merlin");
  assert.equal(merlin?.skill?.name, "Ice Dragon's Breath");
  assert.equal(merlin?.skill?.levels.length, 9);
  assert.equal(merlin?.production?.levels.length, 25);
  const morgana = HEROES.find((hero) => hero.id === "morgana");
  assert.equal(morgana?.rarity, "UR");
  assert.match(morgana?.skill?.levels[0] ?? "", /Strip/);
  const cleopatra = HEROES.find((hero) => hero.id === "cleopatra");
  assert.equal(cleopatra?.rarity, "UR+");
  assert.ok(cleopatra?.skill?.levels[0], "client screenshots filled Cleopatra Lv. 1");
  const hermes = HEROES.find((hero) => hero.id === "hermes");
  assert.equal(hermes?.obtain, "Tap Football");
  const alexander = HEROES.find((hero) => hero.id === "alexander-the-great");
  assert.equal(alexander?.rarity, "UR");
  assert.ok(alexander?.images[0]);
  assert.equal(alexander?.skill?.levels.length, 9);
  const augustus = HEROES.find((hero) => hero.id === "augustus");
  assert.equal(augustus?.rarity, "UR");
  assert.ok(augustus?.images[0]);
  assert.equal(augustus?.skill?.levels.length, 9);
});

test("wiki Hero page fills title, troop, age, and bio for every roster card", () => {
  for (const hero of HEROES) {
    assert.ok(hero.title?.trim(), `${hero.name} has a title`);
    assert.ok(HERO_TROOPS.includes(hero.troop), `${hero.name} troop`);
    assert.ok(HERO_AGES.includes(hero.age), `${hero.name} age`);
    assert.ok(hero.bio?.trim(), `${hero.name} has a bio`);
    assert.ok(bioOpensFor(hero, hero.bio), `${hero.name} bio should open as that hero, not another: ${hero.bio.slice(0, 48)}`);
  }
  assert.equal(HEROES.find((hero) => hero.id === "archimedes")?.title, "Lever Master");
  assert.match(HEROES.find((hero) => hero.id === "billy-the-kid")?.bio ?? "", /Outlaw|Billy|Kid/i);
  assert.match(HEROES.find((hero) => hero.id === "hermes")?.bio ?? "", /^Hermes\b/);
  assert.match(HEROES.find((hero) => hero.id === "merlin")?.bio ?? "", /^Merlin\b/);
  assert.match(HEROES.find((hero) => hero.id === "bjorn-ironside")?.bio ?? "", /^Bjorn Ironside\b/);
  assert.match(HEROES.find((hero) => hero.id === "circe")?.bio ?? "", /^Circe\b/);
  assert.match(HEROES.find((hero) => hero.id === "lagertha")?.bio ?? "", /^Lagertha\b/);
});

test("localized hero title and bio fall back to English", () => {
  const archimedes = HEROES.find((hero) => hero.id === "archimedes");
  const de = { archimedes: { title: "Meister des Hebels", bio: "Deutsche Bio." } };
  const translated = localizedHero(archimedes, de);
  assert.equal(translated.title, "Meister des Hebels");
  assert.equal(translated.bio, "Deutsche Bio.");
  assert.equal(translated.troop, archimedes.troop);
  assert.equal(searchHeroes("Meister des Hebels", "all", [de]).some((hero) => hero.id === "archimedes"), true);
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

  // Every UR+ comes from one event, so none of them may be left blank — except
  // Billy the Kid, whose wiki card has no obtain line yet.
  for (const hero of heroesByRarity("UR+")) {
    if (hero.id === "billy-the-kid") {
      assert.equal(hero.obtain, "");
      continue;
    }
    assert.ok(hero.obtain.trim(), `${hero.name} names a source`);
  }
  assert.equal(source("guan-yu"), "Crown Vault");
  assert.equal(source("lu-bu"), "Crown Vault");
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

test("published lore catalogs cover every hero with a wiki bio", async () => {
  const { heroLoreTexts, mergeHeroTexts } = await import("../lib/content/heroes.ts");
  for (const code of ["de", "fr"]) {
    const lore = heroLoreTexts(code);
    assert.equal(Object.keys(lore).length, HEROES.length, `${code} lore`);
    for (const hero of HEROES) {
      assert.ok(lore[hero.id]?.title?.trim(), `${code} ${hero.id} title`);
      assert.ok(lore[hero.id]?.bio?.trim(), `${code} ${hero.id} bio`);
      assert.ok(bioOpensFor(hero, lore[hero.id].bio), `${code} ${hero.id} bio should open as that hero: ${lore[hero.id].bio.slice(0, 48)}`);
    }
  }
  const merged = mergeHeroTexts({ archimedes: { obtain: "Pool" } }, heroLoreTexts("de"));
  assert.equal(merged.archimedes.obtain, "Pool");
  assert.equal(merged.archimedes.title, heroLoreTexts("de").archimedes.title);
});

test("every published dictionary keys its hero texts to a hero in the roster", async () => {
  const { LOCALES, getDictionary } = await import("../lib/i18n/index.ts");
  const ids = new Set(HEROES.map((hero) => hero.id));
  for (const { code } of LOCALES) {
    const texts = getDictionary(code).guideEntries.heroes.heroTexts;
    for (const id of Object.keys(texts)) assert.ok(ids.has(id), `${code}: ${id} is a hero id`);
  }
  assert.deepEqual(getDictionary("en").guideEntries.heroes.heroTexts, {}, "English is the roster JSON itself");
  const de = getDictionary("de").guideEntries.heroes.heroTexts;
  assert.equal(Object.keys(de).length, 37);
  assert.equal(de.merlin?.skill?.name, "Eisiger Drachenatem");
  assert.match(de.merlin?.skill?.levels[0] ?? "", /Schildbruch/);
  assert.deepEqual(getDictionary("fr").guideEntries.heroes.heroTexts, {}, "French falls back to English");
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

test("exclusive collection items overlay the hero artifact in the reader's language", async () => {
  const { exclusiveCollectionForHero, exclusiveCollectionSearchText } = await import("../lib/content/collection.ts");
  const { getDictionary } = await import("../lib/i18n/index.ts");
  const german = getDictionary("de").guideEntries.collection.collectionTexts;
  const french = getDictionary("fr").guideEntries.collection.collectionTexts;
  const caesar = HEROES.find((hero) => hero.id === "caesar");
  const hermes = HEROES.find((hero) => hero.id === "hermes");
  const merlin = HEROES.find((hero) => hero.id === "merlin");
  assert.equal(exclusiveCollectionForHero("merlin"), undefined);
  assert.equal(exclusiveCollectionForHero("caesar")?.id, "golden-throne");
  assert.equal(localizedHero(caesar, {}, german).artifact.name, "Goldener Thron");
  assert.match(localizedHero(caesar, {}, german).artifact.text, /Fähigkeitsschadensbonus/);
  assert.equal(localizedHero(hermes, {}, german).artifact.name, "Geflügelte Sandalen");
  assert.equal(localizedHero(hermes, {}, french).artifact.name, "Sandales ailées");
  assert.equal(localizedHero(merlin, {}, german).artifact, undefined);
  assert.equal(
    searchHeroes("Goldener Thron", "all", [], (hero) => exclusiveCollectionSearchText(hero.id, [german])).some((hero) => hero.id === "caesar"),
    true,
  );
});
