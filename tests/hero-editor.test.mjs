import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  addAbilityLevel,
  addHero,
  addImage,
  clearAbility,
  countHeroChanges,
  countHeroDraftChanges,
  exportHeroes,
  exportedHeroTexts,
  findHeroProblems,
  fromHeroData,
  heroByUid,
  heroIdFrom,
  heroTextBlocks,
  heroTextOf,
  makePortrait,
  moveHero,
  parseHeroDraft,
  removeAbilityLevel,
  removeHero,
  removeImage,
  serializeHeroData,
  setAbilityLevel,
  setAbilityName,
  setArtifact,
  setArtifactText,
  setObtain,
  updateHero,
  PUBLISHED_HEROES,
} from "../lib/content/hero-editor.ts";
import { heroAppearances, heroReferences } from "../lib/content/hero-links.ts";
import { HERO_DATA } from "../lib/content/heroes.ts";

const WEBP = "data:image/webp;base64,UklGRg==";
const PNG = "data:image/png;base64,iVBORw0KGgo=";

const uidOf = (state, name) => state.heroes.find((hero) => hero.name === name).uid;

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("an untouched draft exports the published JSON and dictionary blocks byte for byte", () => {
  const state = fromHeroData(HERO_DATA);
  const result = exportHeroes(state, HERO_DATA);
  assert.equal(serializeHeroData(result.data), read("../lib/data/heroes.json"));
  assert.deepEqual(result.uploads, []);
  assert.deepEqual(result.removedFiles, []);
  assert.equal(countHeroChanges(HERO_DATA, result.data), 0);
  assert.deepEqual(findHeroProblems(state, HERO_DATA), []);

  const blocks = heroTextBlocks(PUBLISHED_HEROES);
  for (const language of ["en", "de", "fr"]) {
    assert.ok(read(`../lib/i18n/dictionaries/${language}.ts`).includes(blocks[language]), `${language} block matches the dictionary`);
  }
  assert.equal(countHeroDraftChanges(PUBLISHED_HEROES, PUBLISHED_HEROES), 0);
});

test("a new hero joins the end of its rarity and gets an id from its name", () => {
  let { state, uid } = addHero(fromHeroData(HERO_DATA), "UR");
  state = updateHero(state, uid, { name: "  Lu Bu ", obtain: "Warlord event" });
  const index = state.heroes.findIndex((hero) => hero.uid === uid);
  assert.equal(state.heroes[index - 1].rarity, "UR");
  assert.equal(state.heroes[index + 1].rarity, "SSR");

  const { data } = exportHeroes(state, HERO_DATA);
  const added = data.heroes.find((hero) => hero.name === "Lu Bu");
  assert.deepEqual(added, { id: "lu-bu", name: "Lu Bu", rarity: "UR", obtain: "Warlord event", images: [] });
  assert.equal(countHeroChanges(HERO_DATA, data), 1);

  const second = addHero(state, "R", "Merlin");
  assert.equal(exportHeroes(second.state, HERO_DATA).data.heroes.find((hero) => hero.rarity === "R" && hero.name === "Merlin").id, "merlin-2");
  assert.equal(heroIdFrom("Ça Ira!", []), "ca-ira");
  assert.equal(heroIdFrom("", []), "hero");
});

test("uploads get free file names and removed portraits are listed for deletion", () => {
  let state = fromHeroData(HERO_DATA);
  const merlin = uidOf(state, "Merlin");
  state = addImage(state, merlin, WEBP);
  const created = addHero(state, "SR", "Billy the Kid");
  state = addImage(created.state, created.uid, PNG);

  let result = exportHeroes(state, HERO_DATA);
  assert.deepEqual(result.data.heroes.find((hero) => hero.name === "Merlin").images, ["merlin.webp", "merlin-2.webp", "merlin-3.webp"]);
  assert.deepEqual(result.uploads, [
    { file: "merlin-3.webp", data: WEBP, hero: "Merlin" },
    { file: "billy-the-kid.png", data: PNG, hero: "Billy the Kid" },
  ]);

  const firstImage = heroByUid(state, merlin).images[0].uid;
  const upload = heroByUid(state, merlin).images[2].uid;
  state = makePortrait(state, merlin, upload);
  state = removeImage(state, merlin, firstImage);
  result = exportHeroes(state, HERO_DATA);
  // The freed name is not reused, so a commit never overwrites a file it also deletes.
  assert.deepEqual(result.data.heroes.find((hero) => hero.name === "Merlin").images, ["merlin-3.webp", "merlin-2.webp"]);
  assert.deepEqual(result.removedFiles, ["merlin.webp"]);
});

test("rarity changes regroup a hero and moves stay inside the rarity", () => {
  let state = fromHeroData(HERO_DATA);
  const hermes = uidOf(state, "Hermes");
  assert.equal(moveHero(state, hermes, -1), state);
  const moved = moveHero(state, hermes, 1);
  assert.deepEqual(moved.heroes.slice(0, 2).map((hero) => hero.name), ["Merlin", "Hermes"]);

  const lastUrPlus = state.heroes.filter((hero) => hero.rarity === "UR+").at(-1);
  assert.equal(moveHero(state, lastUrPlus.uid, 1), state);

  state = updateHero(state, hermes, { rarity: "R" });
  assert.equal(state.heroes.at(-1).name, "Hermes");
  assert.equal(state.heroes[0].name, "Merlin");
});

test("abilities keep their three slots and their levels", () => {
  let state = fromHeroData(HERO_DATA);
  const heracles = heroByUid(state, uidOf(state, "Heracles"));
  assert.deepEqual(Object.keys(heracles.abilities), ["skill", "buff", "production"]);
  assert.equal(heracles.abilities.skill.levels.length, 9);

  const morgana = uidOf(state, "Morgana");
  assert.deepEqual(heroByUid(state, morgana).abilities.buff, { name: "", levels: [""] });
  state = addAbilityLevel(state, morgana, "skill");
  const copied = heroByUid(state, morgana).abilities.skill.levels;
  assert.equal(copied[1], copied[0], "a new level starts from the one before");
  state = setAbilityLevel(state, morgana, "skill", 1, copied[0].replace("200%", "210%"));
  state = setAbilityName(state, morgana, "production", "  Farm Mastery ");
  state = setAbilityLevel(state, morgana, "production", 0, "Farm Resource Productivity +40%. ");
  state = setArtifact(state, morgana, { name: "Wand", text: "Longer curses." });

  let row = exportHeroes(state, HERO_DATA).data.heroes.find((hero) => hero.name === "Morgana");
  assert.equal(row.skill.levels.length, 2);
  assert.match(row.skill.levels[1], /210% of ATK/);
  assert.deepEqual(row.production, { name: "Farm Mastery", levels: ["Farm Resource Productivity +40%."] });
  assert.equal(row.buff, undefined, "an empty slot is left out");
  assert.deepEqual(row.artifact, { name: "Wand", text: "Longer curses." });
  assert.ok(
    serializeHeroData({ heroes: [row] }).includes('\n      "production": { "name": "Farm Mastery", "levels": ["Farm Resource Productivity +40%."] },\n'),
    "each ability sits on its own line",
  );

  state = removeAbilityLevel(state, morgana, "skill", 1);
  state = clearAbility(setArtifact(state, morgana, null), morgana, "production");
  row = exportHeroes(state, HERO_DATA).data.heroes.find((hero) => hero.name === "Morgana");
  assert.deepEqual(row, HERO_DATA.heroes.find((hero) => hero.name === "Morgana"));
  assert.deepEqual(heroByUid(removeAbilityLevel(state, morgana, "skill", 0), morgana).abilities.skill.levels, [""]);

  // An empty first level is kept; only trailing blanks are dropped.
  const gap = addHero(fromHeroData(HERO_DATA), "R");
  let extra = updateHero(gap.state, gap.uid, { name: "Gap Hero" });
  extra = setAbilityName(extra, gap.uid, "skill", "Gap");
  extra = setAbilityLevel(extra, gap.uid, "skill", 0, "");
  extra = addAbilityLevel(extra, gap.uid, "skill");
  extra = setAbilityLevel(extra, gap.uid, "skill", 1, "200% ATK");
  extra = addAbilityLevel(extra, gap.uid, "skill");
  extra = setAbilityLevel(extra, gap.uid, "skill", 2, "   ");
  row = exportHeroes(extra, HERO_DATA).data.heroes.find((hero) => hero.name === "Gap Hero");
  assert.equal(row.skill.levels[0], "");
  assert.equal(row.skill.levels.length, 2);
});

test("English stays in the JSON; other languages export heroTexts", () => {
  const published = fromHeroData(HERO_DATA);
  let state = published;
  const merlin = uidOf(state, "Merlin");
  const englishSkill = HERO_DATA.heroes.find((hero) => hero.id === "merlin").skill;

  // English is the roster row itself, read back through the same field.
  state = setObtain(state, merlin, "en", "Wish Pool");
  assert.equal(heroByUid(state, merlin).obtain, "Wish Pool");
  assert.equal(heroTextOf(state, "en", merlin).obtain, "Wish Pool");
  assert.equal(heroTextOf(state, "en", merlin).abilities.skill.name, englishSkill.name);

  state = setObtain(state, merlin, "de", "Wunschbrunnen");
  state = setAbilityName(state, merlin, "skill", "Atem des Eisdrachen", "de");
  state = setAbilityLevel(state, merlin, "skill", 0, "  Stufe 1 auf Deutsch ", "de");
  state = setArtifact(state, merlin, { name: "Staff", text: "Longer curses." });
  state = setArtifactText(state, merlin, "de", { name: "Stab" });

  const row = exportHeroes(state, HERO_DATA).data.heroes.find((hero) => hero.id === "merlin");
  assert.equal(row.obtain, "Wish Pool", "a translation never reaches lib/data/heroes.json");
  assert.deepEqual(row.skill, englishSkill);
  assert.deepEqual(row.artifact, { name: "Staff", text: "Longer curses." });

  const texts = exportedHeroTexts(state);
  assert.deepEqual(texts.en, {}, "English lives in the JSON");
  assert.deepEqual(texts.de.merlin, {
    obtain: "Wunschbrunnen",
    // Only Lv. 1 was translated, so the later levels are left to fall back.
    skill: { name: "Atem des Eisdrachen", levels: ["Stufe 1 auf Deutsch"] },
    artifact: { name: "Stab" },
  });
  assert.equal(texts.fr.merlin, undefined, "an untouched language exports nothing");
  assert.equal(countHeroDraftChanges(published, state), 2, "one roster change and one language");

  const blocks = heroTextBlocks(state);
  assert.equal(blocks.en, "      heroTexts: {},");
  assert.ok(blocks.de.includes('        merlin: {'), "keyed by hero id");
  assert.ok(blocks.de.includes('          obtain: "Wunschbrunnen",'));
  assert.ok(blocks.de.includes('            levels: [\n              "Stufe 1 auf Deutsch",\n            ],'));
  assert.ok(blocks.de.includes('          artifact: { name: "Stab" },'));

  // Dropping the artifact drops what every language said about it.
  state = setArtifact(state, merlin, null);
  assert.deepEqual(exportedHeroTexts(state).de.merlin.artifact, undefined);
  state = removeHero(state, merlin);
  assert.equal(state.texts.de[merlin], undefined);
});

test("a level a language translated keeps its place when English loses one", () => {
  let state = fromHeroData(HERO_DATA);
  const heracles = uidOf(state, "Heracles");
  assert.equal(heroByUid(state, heracles).abilities.skill.levels.length, 9);
  for (const [index, text] of ["eins", "zwei", "drei"].entries()) {
    state = setAbilityLevel(state, heracles, "skill", index, text, "de");
  }

  state = removeAbilityLevel(state, heracles, "skill", 1);
  assert.equal(heroByUid(state, heracles).abilities.skill.levels.length, 8);
  assert.deepEqual(heroTextOf(state, "de", heracles).abilities.skill.levels, ["eins", "drei"]);

  // A translation cannot invent a level the roster does not have.
  assert.equal(setAbilityLevel(state, heracles, "skill", 20, "zwanzig", "de"), state);

  state = clearAbility(state, heracles, "skill");
  assert.deepEqual(heroTextOf(state, "de", heracles).abilities.skill, { name: "", levels: [] });
  assert.equal(exportedHeroTexts(state).de.heracles, undefined);
});

test("problems flag blanks, duplicates, and heroes other guides still name", () => {
  let state = fromHeroData(HERO_DATA);
  const blank = addHero(state, "SSR");
  state = addHero(blank.state, "R", "circe").state;
  state = clearAbility(state, uidOf(state, "Merlin"), "buff");
  state = setAbilityName(state, uidOf(state, "Merlin"), "buff", "Arcane Wisdom");
  state = clearAbility(state, uidOf(state, "Circe"), "production");
  state = setAbilityLevel(state, uidOf(state, "Circe"), "production", 0, "Productivity +10%");
  state = setArtifact(state, uidOf(state, "Merlin"), { name: "Staff", text: " " });
  state = removeHero(state, uidOf(state, "Isaac Newton"));
  state = updateHero(state, uidOf(state, "Cu Chulainn"), { name: "Cú Chulainn" });

  const problems = findHeroProblems(state, HERO_DATA);
  assert.deepEqual(problems.find((problem) => problem.code === "emptyName"), { code: "emptyName", rarity: "SSR" });
  assert.deepEqual(problems.find((problem) => problem.code === "duplicateName"), { code: "duplicateName", name: "circe" });
  assert.deepEqual(problems.filter((problem) => problem.code === "incompleteAbility"), [
    { code: "incompleteAbility", hero: "Merlin", kind: "buff" },
    { code: "incompleteAbility", hero: "Circe", kind: "production" },
  ]);
  assert.deepEqual(problems.find((problem) => problem.code === "emptyArtifact"), { code: "emptyArtifact", hero: "Merlin" });
  const used = problems.filter((problem) => problem.code === "stillUsed");
  assert.deepEqual(used.map((problem) => problem.name), ["Isaac Newton", "Cu Chulainn"]);
  assert.deepEqual(used[0].where.sort(), ["artwork", "layouts", "tierList"]);
  assert.deepEqual(used[1].where, ["artwork"]);
});

test("appearances follow the guides' spelling of a roster hero", () => {
  const newton = heroAppearances("Isaac Newton");
  assert.deepEqual(heroAppearances("Newton"), newton);
  assert.equal(newton.tiers[0].tier, "A");
  assert.deepEqual(newton.builds, [{ build: "crit", zone: "important" }]);
  assert.ok(newton.paintings.some((entry) => entry.painting === "The Gleaners"));
  assert.deepEqual(heroAppearances("Nobody"), { tiers: [], builds: [], roles: [], paintings: [] });
  for (const hero of HERO_DATA.heroes) assert.ok(heroReferences().has(hero.name), `${hero.name} is named by a guide`);
});

test("drafts are validated before they are used", () => {
  let state = fromHeroData(HERO_DATA);
  state = addImage(state, uidOf(state, "Circe"), WEBP);
  assert.deepEqual(parseHeroDraft(JSON.stringify(state)), state);
  assert.equal(parseHeroDraft(null), null);
  assert.equal(parseHeroDraft("{"), null);
  assert.equal(parseHeroDraft(JSON.stringify({ ...state, version: 2 })), null, "drafts from before translations are dropped");
  const badText = structuredClone(state);
  badText.texts.de = { h1: { obtain: 7, abilities: {}, artifact: { name: "", text: "" } } };
  assert.equal(parseHeroDraft(JSON.stringify(badText)), null);

  const bad = structuredClone(state);
  bad.heroes[0].rarity = "SSS";
  assert.equal(parseHeroDraft(JSON.stringify(bad)), null);
  const both = structuredClone(state);
  both.heroes[0].images[0].data = WEBP;
  assert.equal(parseHeroDraft(JSON.stringify(both)), null);
  const script = structuredClone(state);
  script.heroes[3].images.push({ uid: "x", data: "javascript:alert(1)" });
  assert.equal(parseHeroDraft(JSON.stringify(script)), null);
  const levels = structuredClone(state);
  levels.heroes[1].abilities.skill.levels = [];
  assert.equal(parseHeroDraft(JSON.stringify(levels)), null);
});
