import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLISHED_SKINS,
  addSkin,
  countSkinChanges,
  exportSkins,
  exportedSkinTexts,
  findSkinProblems,
  untranslatedSkins,
  fromSkinsData,
  idOf,
  parseSkinsDraft,
  removeSkin,
  serializeSkinsData,
  setSkinText,
  skinGroups,
  skinId,
  skinOwners,
  skinText,
  updateSkin,
} from "../lib/content/skins-editor.ts";
import { GODDESS_SKINS, HERO_SKINS } from "../lib/content/skins.ts";
import { DEFAULT_LOCALE, LOCALE_CODES } from "../lib/i18n/index.ts";

const heroes = () => fromSkinsData("hero", { skins: HERO_SKINS });

test("an untouched draft gives every row back exactly as it was committed", () => {
  for (const [roster, committed] of [["hero", HERO_SKINS], ["goddess", GODDESS_SKINS]]) {
    const state = fromSkinsData(roster, { skins: committed });
    assert.deepEqual(exportSkins(state).skins, committed, roster);
    assert.equal(countSkinChanges(state, state), 0, roster);
  }
});

test("the English wording comes off the file and the flags only when they are set", () => {
  const state = heroes();
  const first = state.skins[0];
  assert.equal(skinText(state, DEFAULT_LOCALE, first.uid).name, HERO_SKINS[0].name);
  assert.equal(skinText(state, DEFAULT_LOCALE, first.uid).obtain, HERO_SKINS[0].obtain);

  const rows = exportSkins(state).skins;
  assert.equal("missable" in rows[0], HERO_SKINS[0].missable === true);
  const missable = HERO_SKINS.find((skin) => skin.missable);
  if (missable) {
    assert.equal(exportSkins(state).skins.find((skin) => skin.id === missable.id).missable, true);
  }
});

test("a translation travels as skinTexts, and English does not", () => {
  const state = heroes();
  const uid = state.skins[0].uid;
  const next = setSkinText(state, "de", uid, { name: "Karussell", obtain: "Epochen-Pass" });
  const texts = exportedSkinTexts(next);
  assert.deepEqual(texts.de[state.skins[0].id], { name: "Karussell", obtain: "Epochen-Pass" });
  assert.deepEqual(texts.en, {}, "the file already carries the English wording");
  assert.deepEqual(texts.fr, {}, "and a language nobody wrote stays empty");
  // The English row is untouched by a translation.
  assert.deepEqual(exportSkins(next).skins, exportSkins(state).skins);
});

test("a new row is filed under an id made from its owner and its name", () => {
  let state = heroes();
  const before = state.skins.length;
  state = addSkin(state, "Joan of Arc");
  const added = state.skins.at(-1);
  assert.equal(state.skins.length, before + 1);
  state = setSkinText(state, DEFAULT_LOCALE, added.uid, { name: "Winter Ball", obtain: "Ring Toss" });
  assert.equal(idOf(state, added), "joan-of-arc-winter-ball");
  assert.equal(skinId("Cleopatra", "Sunlit Reed"), "cleopatra-sunlit-reed");
  assert.equal(skinId("Élisabeth", "Rôse"), "elisabeth-rose", "accents fold away");

  const row = exportSkins(state).skins.at(-1);
  assert.deepEqual(row, {
    id: "joan-of-arc-winter-ball",
    owner: "Joan of Arc",
    name: "Winter Ball",
    group: skinGroups("hero").at(-1),
    obtain: "Ring Toss",
  });
  assert.equal(countSkinChanges(heroes(), state), 1, "one row moved");
});

test("a removed row takes its translations with it", () => {
  let state = heroes();
  const uid = state.skins[0].uid;
  state = setSkinText(state, "de", uid, { name: "Karussell" });
  state = removeSkin(state, uid);
  for (const locale of LOCALE_CODES) {
    assert.equal(uid in state.texts[locale], false, locale);
  }
  assert.equal(exportSkins(state).skins.length, HERO_SKINS.length - 1);
});

test("the problems a reviewer needs to see", () => {
  let state = heroes();
  assert.deepEqual(findSkinProblems(fromSkinsData("hero", { skins: [] })), []);

  // A row with no English name cannot be filed at all.
  state = addSkin(state, "Joan of Arc");
  const added = state.skins.at(-1);
  assert.ok(findSkinProblems(state).some((problem) => problem.code === "noName"));

  // An owner the roster does not have would leave the skin without a portrait.
  state = setSkinText(state, DEFAULT_LOCALE, added.uid, { name: "Winter Ball" });
  state = updateSkin(state, added.uid, { owner: "Nobody At All" });
  assert.ok(findSkinProblems(state).some((problem) => problem.code === "unknownOwner"));

  // A group outside the roster's list would not be shown anywhere.
  state = updateSkin(state, added.uid, { owner: skinOwners("hero")[0], group: "notAGroup" });
  assert.ok(findSkinProblems(state).some((problem) => problem.code === "unknownGroup"));

  // Two rows under one id would overwrite each other's translations.
  state = updateSkin(state, added.uid, { group: skinGroups("hero")[0], id: HERO_SKINS[0].id });
  assert.ok(findSkinProblems(state).some((problem) => problem.code === "duplicateId"));
});

test("every committed row names a roster owner and a group the guide shows", () => {
  // The guard on the data itself: a skin nobody can be matched to is invisible.
  for (const roster of ["hero", "goddess"]) {
    const state = fromSkinsData(roster, { skins: roster === "hero" ? HERO_SKINS : GODDESS_SKINS });
    const owners = new Set(skinOwners(roster).map((name) => name.toLowerCase()));
    const groups = new Set(skinGroups(roster));
    for (const skin of state.skins) {
      assert.ok(owners.has(skin.owner.trim().toLowerCase()), `${roster}: ${skin.owner} is not on the roster`);
      assert.ok(groups.has(skin.group), `${roster}: ${skin.group} is not a group`);
    }
  }
});

test("a draft survives a reload, and nonsense does not load at all", () => {
  let state = heroes();
  state = setSkinText(state, "fr", state.skins[0].uid, { name: "Carrousel" });
  const back = parseSkinsDraft(JSON.stringify(state), "hero");
  assert.deepEqual(back, state);
  assert.equal(parseSkinsDraft(JSON.stringify(state), "goddess"), null, "a draft belongs to one roster");
  assert.equal(parseSkinsDraft("not json", "hero"), null);
  assert.equal(parseSkinsDraft(null, "hero"), null);
  assert.equal(parseSkinsDraft(JSON.stringify({ version: 2, skins: [] }), "hero"), null);
});

test("the file is written one row per line, and reads back the same", () => {
  const text = serializeSkinsData(exportSkins(heroes()));
  assert.equal(JSON.parse(text).skins.length, HERO_SKINS.length);
  assert.deepEqual(JSON.parse(text).skins, HERO_SKINS);
  assert.match(text, /^\{\n {2}"skins": \[\n/);
  assert.equal(text.endsWith("]\n}\n"), true);
});

test("what is published is what the site shows right now", () => {
  assert.deepEqual(exportSkins(PUBLISHED_SKINS.hero).skins, HERO_SKINS);
  assert.deepEqual(exportSkins(PUBLISHED_SKINS.goddess).skins, GODDESS_SKINS);
});

test("untranslated rows are counted, not called a problem", () => {
  // A reader without a translation sees the English line, so this is a note
  // rather than something to fix — otherwise the untouched file would open
  // with a warning for every row in two languages.
  const state = fromSkinsData("hero", { skins: HERO_SKINS });
  assert.deepEqual(findSkinProblems(state), [], "the committed file has nothing to fix");
  const counts = untranslatedSkins(state);
  assert.equal(counts.length, 2, "German and French");
  for (const row of counts) assert.equal(row.count, HERO_SKINS.length, row.language);

  const written = setSkinText(state, "de", state.skins[0].uid, { name: "Karussell" });
  assert.equal(untranslatedSkins(written).find((row) => row.count === HERO_SKINS.length - 1).count, HERO_SKINS.length - 1);
});
