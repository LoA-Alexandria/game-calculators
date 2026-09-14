import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  addAbilityLevel,
  addHero,
  addImage,
  clearAbility,
  countHeroChanges,
  exportHeroes,
  findHeroProblems,
  fromHeroData,
  heroByUid,
  heroIdFrom,
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
  updateHero,
} from "../lib/content/hero-editor.ts";
import { heroAppearances, heroReferences } from "../lib/content/hero-links.ts";
import { HERO_DATA } from "../lib/content/heroes.ts";

const WEBP = "data:image/webp;base64,UklGRg==";
const PNG = "data:image/png;base64,iVBORw0KGgo=";

const uidOf = (state, name) => state.heroes.find((hero) => hero.name === name).uid;

test("an untouched draft exports lib/data/heroes.json byte for byte", () => {
  const state = fromHeroData(HERO_DATA);
  const result = exportHeroes(state, HERO_DATA);
  assert.equal(serializeHeroData(result.data), readFileSync(new URL("../lib/data/heroes.json", import.meta.url), "utf8"));
  assert.deepEqual(result.uploads, []);
  assert.deepEqual(result.removedFiles, []);
  assert.equal(countHeroChanges(HERO_DATA, result.data), 0);
  assert.deepEqual(findHeroProblems(state, HERO_DATA), []);
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
  assert.equal(heracles.abilities.skill.levels.length, 3);
  assert.deepEqual(heracles.abilities.buff, { name: "", levels: [""] });

  const circe = uidOf(state, "Circe");
  state = addAbilityLevel(state, circe, "skill");
  const copied = heroByUid(state, circe).abilities.skill.levels;
  assert.equal(copied[1], copied[0], "a new level starts from the one before");
  state = setAbilityLevel(state, circe, "skill", 1, copied[0].replace("200%", "210%"));
  state = setAbilityName(state, circe, "production", "  Farm Mastery ");
  state = setAbilityLevel(state, circe, "production", 0, "Farm Resource Productivity +40%. ");
  state = setArtifact(state, circe, { name: "Wand", text: "Longer curses." });

  let row = exportHeroes(state, HERO_DATA).data.heroes.find((hero) => hero.name === "Circe");
  assert.equal(row.skill.levels.length, 2);
  assert.match(row.skill.levels[1], /210% of ATK/);
  assert.deepEqual(row.production, { name: "Farm Mastery", levels: ["Farm Resource Productivity +40%."] });
  assert.equal(row.buff, undefined, "an empty slot is left out");
  assert.deepEqual(row.artifact, { name: "Wand", text: "Longer curses." });
  assert.ok(
    serializeHeroData({ heroes: [row] }).includes('\n      "production": { "name": "Farm Mastery", "levels": ["Farm Resource Productivity +40%."] },\n'),
    "each ability sits on its own line",
  );

  state = removeAbilityLevel(state, circe, "skill", 1);
  state = clearAbility(setArtifact(state, circe, null), circe, "production");
  row = exportHeroes(state, HERO_DATA).data.heroes.find((hero) => hero.name === "Circe");
  assert.deepEqual(row, HERO_DATA.heroes.find((hero) => hero.name === "Circe"));
  assert.deepEqual(heroByUid(removeAbilityLevel(state, circe, "skill", 0), circe).abilities.skill.levels, [""]);

  // Cleopatra's Lv. 1 is unknown: the gap stays, only trailing blanks are dropped.
  const cleopatra = uidOf(state, "Cleopatra");
  state = addAbilityLevel(state, cleopatra, "skill");
  state = setAbilityLevel(state, cleopatra, "skill", 2, "   ");
  row = exportHeroes(state, HERO_DATA).data.heroes.find((hero) => hero.name === "Cleopatra");
  assert.equal(row.skill.levels[0], "");
  assert.equal(row.skill.levels.length, 2);
});

test("problems flag blanks, duplicates, and heroes other guides still name", () => {
  let state = fromHeroData(HERO_DATA);
  const blank = addHero(state, "SSR");
  state = addHero(blank.state, "R", "circe").state;
  state = setAbilityName(state, uidOf(state, "Merlin"), "buff", "Arcane Wisdom");
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
  assert.equal(parseHeroDraft(JSON.stringify({ ...state, version: 1 })), null, "drafts from before abilities are dropped");

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
