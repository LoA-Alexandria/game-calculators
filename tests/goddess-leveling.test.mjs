import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PUBLISHED_GODDESS_LEVELING,
  addPhase,
  addRow,
  countLevelingChanges,
  exportLeveling,
  exportedPhaseTexts,
  findLevelingProblems,
  hasEveryoneElse,
  moveRow,
  movePhase,
  parseLevelingDraft,
  phaseIdFrom,
  phaseTextBlocks,
  phaseTextOf,
  removePhase,
  removeRow,
  serializeLevelingData,
  setPhaseText,
  unusedGoddesses,
  updateRow,
} from "../lib/content/goddess-leveling-editor.ts";
import { GODDESS_LEVELING_DATA, localizedPhase, phaseTone } from "../lib/content/goddess-leveling.ts";
import { GODDESSES } from "../lib/content/goddesses.ts";
import { getDictionary, mapLocales } from "../lib/i18n/index.ts";

const LANGUAGES = mapLocales(getDictionary);
const phase = (index) => PUBLISHED_GODDESS_LEVELING.phases[index];

test("the upgrade order names roster goddesses and keeps the community levels", () => {
  const ids = new Set(GODDESSES.map((goddess) => goddess.id));
  for (const entry of GODDESS_LEVELING_DATA.phases) {
    assert.ok(entry.subtitle.trim(), `${entry.id} has a subtitle`);
    for (const row of entry.rows) {
      if (row.goddess !== null) assert.ok(ids.has(row.goddess), `${entry.id}: ${row.goddess} is in the roster`);
      assert.ok(row.target.trim(), `${entry.id}: ${row.goddess} has a level`);
    }
  }
  const [core, milestones, midGame, lateGame] = GODDESS_LEVELING_DATA.phases;
  assert.deepEqual(core.rows.find((row) => row.goddess === "demeter"), { goddess: "demeter", target: "180", withoutSsr: "90" });
  // Phase 2 stops Fortuna and Bastet at 60, not the wiki's 90.
  assert.equal(milestones.rows.find((row) => row.goddess === "fortuna")?.target, "60");
  assert.equal(milestones.rows.find((row) => row.goddess === "bastet")?.target, "60");
  assert.equal(midGame.rows.find((row) => row.goddess === "calypso")?.target, "180");
  assert.deepEqual(lateGame.rows, [{ goddess: null, target: "30 → 60 → 90 → max" }]);
  assert.deepEqual(findLevelingProblems(PUBLISHED_GODDESS_LEVELING), []);
});

test("phase subtitles are translated by id in every language and fall back to English", () => {
  const ids = new Set(GODDESS_LEVELING_DATA.phases.map((entry) => entry.id));
  assert.deepEqual(LANGUAGES.en.guideEntries.goddessLeveling.phaseTexts, {});
  for (const [code, dictionary] of Object.entries(LANGUAGES)) {
    const texts = dictionary.guideEntries.goddessLeveling.phaseTexts;
    for (const id of Object.keys(texts)) assert.ok(ids.has(id), `${code}: phaseTexts.${id} is a phase id`);
  }
  const late = GODDESS_LEVELING_DATA.phases[3];
  assert.equal(localizedPhase(late, LANGUAGES.de.guideEntries.goddessLeveling.phaseTexts).subtitle, "Endgame");
  assert.equal(localizedPhase(late, {}).subtitle, "Late game");
  assert.equal(localizedPhase(late, { "late-game": { subtitle: " " } }).subtitle, "Late game");
  assert.deepEqual([0, 1, 2, 3, 4].map(phaseTone), ["1", "2", "3", "4", "1"]);
});

test("an untouched draft exports the published file and dictionaries byte for byte", () => {
  const state = PUBLISHED_GODDESS_LEVELING;
  assert.deepEqual(exportLeveling(state), GODDESS_LEVELING_DATA);
  assert.equal(
    serializeLevelingData(exportLeveling(state)),
    readFileSync(new URL("../lib/data/goddess-leveling.json", import.meta.url), "utf8"),
  );
  assert.equal(countLevelingChanges(PUBLISHED_GODDESS_LEVELING, state), 0);
  const blocks = phaseTextBlocks(state);
  assert.equal(blocks.en, "      phaseTexts: {},");
  for (const code of ["de", "fr"]) {
    const dictionary = readFileSync(new URL(`../lib/i18n/dictionaries/${code}.ts`, import.meta.url), "utf8");
    assert.ok(dictionary.includes(blocks[code]), `${code} dictionary contains its exported block`);
  }
});

test("phases and rows can be added, reordered, edited, and removed", () => {
  let { state, uid } = addPhase(PUBLISHED_GODDESS_LEVELING);
  state = setPhaseText(state, uid, "en", "subtitle", "Endless");
  state = setPhaseText(state, uid, "fr", "subtitle", "Sans fin");
  assert.ok(findLevelingProblems(state).some((problem) => problem.code === "emptyPhase" && problem.phase === 5));
  state = addRow(state, uid, "hera");
  state = addRow(state, uid, null);
  const added = state.phases.at(-1);
  assert.equal(hasEveryoneElse(added), true);
  assert.equal(unusedGoddesses(added).some((goddess) => goddess.id === "hera"), false);
  state = updateRow(state, uid, added.rows[0].uid, { target: "240", withoutSsr: "120" });
  state = updateRow(state, uid, added.rows[1].uid, { target: "max" });
  state = moveRow(state, uid, added.rows[1].uid, -1);
  state = movePhase(state, uid, -1);

  const data = exportLeveling(state);
  assert.equal(data.phases[3].id, "endless");
  assert.deepEqual(data.phases[3].rows, [{ goddess: null, target: "max" }, { goddess: "hera", target: "240", withoutSsr: "120" }]);
  assert.deepEqual(exportedPhaseTexts(state).fr.endless, { subtitle: "Sans fin" });
  assert.equal(phaseTextOf(state, "fr", uid).subtitle, "Sans fin");
  assert.deepEqual(findLevelingProblems(state), []);
  // One new phase, the late-game phase unchanged but moved, and one French translation.
  assert.equal(countLevelingChanges(PUBLISHED_GODDESS_LEVELING, state), 2);

  state = removeRow(state, uid, state.phases[3].rows[0].uid);
  state = removePhase(state, uid);
  assert.deepEqual(exportLeveling(state), GODDESS_LEVELING_DATA);
  assert.equal(phaseIdFrom("Late game", ["late-game"]), "late-game-2");
});

test("problems name the phase, and a damaged draft is ignored", () => {
  const first = phase(0);
  let state = updateRow(PUBLISHED_GODDESS_LEVELING, first.uid, first.rows[0].uid, { target: " " });
  state = updateRow(state, first.uid, first.rows[1].uid, { goddess: "demeter" });
  state = setPhaseText(state, phase(1).uid, "en", "subtitle", "");
  const codes = findLevelingProblems(state).map((problem) => `${problem.code}:${problem.phase}`);
  assert.deepEqual(codes.sort(), ["duplicateRow:1", "emptySubtitle:2", "emptyTarget:1"]);

  assert.deepEqual(parseLevelingDraft(JSON.stringify(state)), state);
  assert.equal(parseLevelingDraft(null), null);
  assert.equal(parseLevelingDraft("[]"), null);
  const broken = { ...state, phases: [{ ...first, rows: [{ uid: "r1", goddess: 3, target: "", withoutSsr: "" }] }] };
  assert.equal(parseLevelingDraft(JSON.stringify(broken)), null);
});
