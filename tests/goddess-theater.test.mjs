import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { GODDESSES } from "../lib/content/goddesses.ts";
import { THEATER_PLAYS, searchTheaterPlays, theaterCoverUrl } from "../lib/content/goddess-theater.ts";
import { guideLayout } from "../lib/content/guides.ts";
import { sectionById } from "../lib/navigation.ts";
import en from "../lib/i18n/dictionaries/en.ts";

test("every theater cast names a roster goddess and no Brunhilde spelling remains", () => {
  const names = new Set(GODDESSES.map((goddess) => goddess.name));
  assert.equal(THEATER_PLAYS.length, 27);
  assert.equal(new Set(THEATER_PLAYS.map((play) => play.id)).size, THEATER_PLAYS.length);
  for (const play of THEATER_PLAYS) {
    for (const row of play.roles) {
      assert.ok(names.has(row.goddess), `${play.name}: ${row.goddess}`);
      assert.notEqual(row.goddess, "Brunhilde");
    }
  }
  const musketeers = THEATER_PLAYS.find((play) => play.id === "three-musketeers");
  assert.equal(musketeers?.unlock, "tutorial");
  assert.deepEqual(musketeers?.roles, []);
});

test("relevant stills match the community marks", () => {
  const marked = THEATER_PLAYS.flatMap((play) =>
    play.roles.filter((row) => row.relevant).map((row) => `${play.id}:${row.goddess}`),
  );
  assert.deepEqual(marked, [
    "count-of-monte-cristo:Fortuna",
    "count-of-monte-cristo:Eve",
    "frankenstein:Hela",
    "treasure-island:Muse",
    "peter-pan:Artemis",
    "midsummer-nights-dream:Hera",
    "robin-hood:Artemis",
    "robin-hood:Hera",
    "wizard-of-oz:Eve",
    "sleeping-beauty:Venus",
    "happy-prince:Medusa",
  ]);
});

test("theater search matches play, goddess, and role", () => {
  assert.equal(searchTheaterPlays("wendy")[0]?.id, "peter-pan");
  assert.equal(searchTheaterPlays("bastet").some((play) => play.id === "cats"), true);
  assert.equal(searchTheaterPlays("tutorial")[0]?.id, "three-musketeers");
  assert.equal(searchTheaterPlays("zzzz").length, 0);
});

test("every play cover is a WebP in public/goddess-theater and none is a still or leftover", () => {
  const folder = new URL("../public/goddess-theater/", import.meta.url);
  const files = readdirSync(folder).filter((file) => !file.startsWith("."));
  const referenced = THEATER_PLAYS.map((play) => play.image);
  assert.equal(new Set(referenced).size, referenced.length, "no file is shared by two plays");
  assert.deepEqual([...referenced].sort(), [...files].sort());
  for (const play of THEATER_PLAYS) {
    assert.equal(play.image, `${play.id}.webp`);
    assert.equal(theaterCoverUrl(play.image), `/goddess-theater/${play.image}`);
    assert.equal(/still/i.test(play.image), false);
  }
  for (const file of files) {
    const head = readFileSync(new URL(file, folder)).subarray(0, 12).toString("latin1");
    assert.ok(file.endsWith(".webp") && head.startsWith("RIFF") && head.endsWith("WEBP"), `${file} is WebP`);
    assert.equal(/still/i.test(file), false, `${file} must not be a still`);
  }
});

test("Goddess Theater sits in the Buildings guide category", () => {
  const item = sectionById("guides").items.find((entry) => entry.href === "/guides/goddess-theater/");
  assert.equal(item?.categoryId, "buildings");
  assert.equal(guideLayout(en.guideEntries.goddessTheater), "goddessTheater");
  assert.equal(en.guideCategories.buildings, "Buildings");
  assert.equal(en.guideCategories.event, "Events");
});
