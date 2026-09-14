import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import en from "../lib/i18n/dictionaries/en.ts";
import de from "../lib/i18n/dictionaries/de.ts";
import fr from "../lib/i18n/dictionaries/fr.ts";
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

const LANGUAGES = { en, de, fr };

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
  assert.equal(GODDESSES.length, 19);
  assert.equal(new Set(GODDESSES.map((goddess) => goddess.id)).size, GODDESSES.length);
  assert.deepEqual(goddessNamed("Bastet")?.images, []);
  assert.deepEqual(goddessNamed("Hera")?.images, ["hera.webp"]);
  assert.equal(goddessNamed("Calypso"), undefined);
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
  assert.equal(goddessesByRarity("SSR").length, 8);
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
    assert.equal(roster.some((row) => row.name === "Calypso"), false, `${code} has no Calypso roster row`);
  }
  const venus = en.guideEntries.goddesses.roster.find((row) => row.name === "Venus");
  assert.equal(venus?.obtain, "First purchase bundle");
  const bastet = en.guideEntries.goddesses.roster.find((row) => row.name === "Bastet");
  assert.equal(bastet?.affinity, "");
});

test("goddess search matches affinity and obtain from the current language", () => {
  const extra = (goddess) => {
    const row = en.guideEntries.goddesses.roster.find((entry) => entry.name === goddess.name);
    return `${row?.affinity ?? ""} ${row?.obtain ?? ""}`;
  };
  const hits = searchGoddesses("ringtoss", "all", extra);
  assert.equal(hits.some((goddess) => goddess.id === "medusa"), true);
  assert.equal(searchGoddesses("zzzz", "all", extra).length, 0);
  assert.equal(searchGoddesses("bastet", "SSR", extra).map((goddess) => goddess.id).join(), "bastet");
});

test("goddesses still use the phases layout after gaining the heroes filter keys", () => {
  assert.equal(guideLayout(en.guideEntries.goddesses), "goddesses");
  assert.equal("filterAll" in en.guideEntries.goddesses, true);
  assert.equal("phases" in en.guideEntries.heroes, false);
});
