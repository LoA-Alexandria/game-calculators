import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { getDictionary, mapLocales } from "../lib/i18n/index.ts";
import en from "../lib/i18n/dictionaries/en.ts";
import {
  GODDESS_RARITIES,
  GODDESSES,
  goddessImageUrl,
  goddessNamed,
  goddessPortrait,
  goddessesByRarity,
  searchGoddesses,
} from "../lib/content/goddesses.ts";
import { guideLayout } from "../lib/content/guides.ts";

// Every registered language, so a new dictionary is checked without editing this test.
const LANGUAGES = mapLocales(getDictionary);

test("every portrait in the goddess roster is a file in public/goddesses and none is orphaned", () => {
  const folder = new URL("../public/goddesses/", import.meta.url);
  const files = readdirSync(folder).filter((file) => !file.startsWith("."));
  const referenced = GODDESSES.flatMap((goddess) => goddess.images);
  assert.equal(new Set(referenced).size, referenced.length, "no file is shared by two entries");
  assert.deepEqual([...referenced].sort(), [...files].sort());
  for (const file of files) {
    const head = readFileSync(new URL(file, folder)).subarray(0, 12).toString("latin1");
    assert.ok(file.endsWith(".webp") && head.startsWith("RIFF") && head.endsWith("WEBP"), `${file} is WebP`);
  }
  for (const goddess of GODDESSES) {
    assert.ok(GODDESS_RARITIES.includes(goddess.rarity), `${goddess.name} has a known rarity`);
  }
  assert.equal(GODDESSES.length, 21);
  assert.equal(new Set(GODDESSES.map((goddess) => goddess.id)).size, GODDESSES.length);
  assert.deepEqual(goddessNamed("Bastet")?.images, []);
  assert.deepEqual(goddessNamed("Hera")?.images, ["hera.webp"]);
  // Autumn's obtain guide named these two, who are not on the wiki page.
  assert.deepEqual(goddessNamed("Isis")?.images, []);
  assert.deepEqual(goddessNamed("Calypso")?.images, []);
});

test("a goddess is marked missable or unconfirmed, never both", () => {
  const missable = GODDESSES.filter((goddess) => goddess.missable).map((goddess) => goddess.name);
  const unconfirmed = GODDESSES.filter((goddess) => goddess.unconfirmed).map((goddess) => goddess.name);
  assert.deepEqual(missable.sort(), ["Freya", "Isis"]);
  assert.deepEqual(unconfirmed.sort(), ["Calypso", "Hera"]);
  for (const goddess of GODDESSES) {
    assert.ok(!(goddess.missable && goddess.unconfirmed), `${goddess.name} carries one mark at most`);
  }
  // A marked goddess still says what is known, so the mark never stands alone.
  for (const name of [...missable, ...unconfirmed]) {
    const row = en.guideEntries.goddesses.roster.find((entry) => entry.name === name);
    assert.ok(row?.obtain.trim(), `${name} has an obtain line next to the mark`);
  }
});

test("portraits resolve roster names and skip names that are only in the upgrade order", () => {
  assert.equal(goddessPortrait("Lady Liberty"), goddessImageUrl("lady-liberty.webp"));
  assert.equal(goddessPortrait("  hera "), goddessImageUrl("hera.webp"));
  assert.equal(goddessPortrait("Bastet"), null);
  assert.equal(goddessPortrait("Calypso"), null);
  assert.equal(goddessPortrait("Everyone else"), null);
  assert.equal(goddessImageUrl("hera.webp"), "/goddesses/hera.webp");
});

test("roster covers the wiki rarities and skins that raise to SSR", () => {
  assert.equal(goddessesByRarity("SSR").length, 10);
  assert.equal(goddessesByRarity("SR").length, 7);
  assert.equal(goddessesByRarity("R").length, 4);
  assert.equal(GODDESSES.filter((goddess) => goddess.skinRaisesTo === "SSR").length, 7);
  assert.equal(goddessNamed("Brunhild")?.skinRaisesTo, "SSR");
  assert.equal(goddessNamed("Venus")?.skinRaisesTo, undefined);
});

test("affinity and obtain stay in every dictionary, keyed by the English roster name", () => {
  const names = GODDESSES.map((goddess) => goddess.name).sort();
  for (const [code, dictionary] of Object.entries(LANGUAGES)) {
    const roster = dictionary.guideEntries.goddesses.roster ?? [];
    assert.deepEqual(roster.map((row) => row.name).sort(), names, `${code} roster names`);
    // Every goddess now says where she comes from, in every language.
    for (const row of roster) assert.ok(row.obtain.trim(), `${code} names a source for ${row.name}`);
  }
  const venus = en.guideEntries.goddesses.roster.find((row) => row.name === "Venus");
  assert.equal(venus?.obtain, "First top-up, $2.50");
  const bastet = en.guideEntries.goddesses.roster.find((row) => row.name === "Bastet");
  assert.equal(bastet?.affinity, "");
});

test("the first source of a goddess comes before the Ring Toss that brings her back", () => {
  const row = (name) => en.guideEntries.goddesses.roster.find((entry) => entry.name === name)?.obtain ?? "";
  // Muse, Moirai and Ixchel arrived with a feature; Ring Toss #4 and #5 are a
  // second chance, not the first source, which is what the roster used to say.
  assert.match(row("Muse"), /^Museion unlock event.*back in Ring Toss #4$/);
  assert.match(row("Moirai"), /^Goddess Theater unlock event.*back in Ring Toss #4$/);
  assert.match(row("Ixchel"), /^Grand Voyage unlock event.*back in Ring Toss #5$/);
  assert.match(row("Medusa"), /^Ring Toss #1/);
});

test("goddess search matches affinity and obtain from the current language", () => {
  const extra = (goddess) => {
    const row = en.guideEntries.goddesses.roster.find((entry) => entry.name === goddess.name);
    return `${row?.affinity ?? ""} ${row?.obtain ?? ""}`;
  };
  const hits = searchGoddesses("ring toss", "all", extra);
  assert.equal(hits.some((goddess) => goddess.id === "medusa"), true);
  assert.equal(searchGoddesses("museion", "all", extra).map((goddess) => goddess.id).join(), "muse");
  assert.equal(searchGoddesses("zzzz", "all", extra).length, 0);
  assert.equal(searchGoddesses("bastet", "SSR", extra).map((goddess) => goddess.id).join(), "bastet");
});

test("goddesses still use the phases layout after gaining the heroes filter keys", () => {
  assert.equal(guideLayout(en.guideEntries.goddesses), "goddesses");
  assert.equal("filterAll" in en.guideEntries.goddesses, true);
  assert.equal("phases" in en.guideEntries.heroes, false);
});
