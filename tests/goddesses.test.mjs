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
  localizedGoddess,
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
    assert.ok(goddessNamed(name)?.obtain.trim(), `${name} has an obtain line next to the mark`);
  }
});

test("portraits resolve roster names and skip names that are not in the roster", () => {
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

test("affinity and obtain are English in the roster and translated by id in every other language", () => {
  const ids = new Set(GODDESSES.map((goddess) => goddess.id));
  for (const goddess of GODDESSES) assert.ok(goddess.obtain.trim(), `${goddess.name} names a source`);
  assert.deepEqual(en.guideEntries.goddesses.goddessTexts, {});
  for (const [code, dictionary] of Object.entries(LANGUAGES)) {
    const texts = dictionary.guideEntries.goddesses.goddessTexts;
    for (const id of Object.keys(texts)) assert.ok(ids.has(id), `${code}: goddessTexts.${id} is a roster id`);
    // Every goddess says where she comes from in every language, translated or English.
    for (const goddess of GODDESSES) assert.ok(localizedGoddess(goddess, texts).obtain, `${code} names a source for ${goddess.name}`);
  }
  assert.equal(goddessNamed("Venus")?.obtain, "First top-up, $2.50");
  assert.equal(goddessNamed("Bastet")?.affinity, "");
  const german = LANGUAGES.de.guideEntries.goddesses.goddessTexts;
  assert.equal(localizedGoddess(goddessNamed("Venus"), german).obtain, "Erste Aufladung, 2,50 $");
  // An empty translation falls back to English rather than showing nothing.
  assert.equal(localizedGoddess(goddessNamed("Venus"), { venus: { obtain: " " } }).obtain, "First top-up, $2.50");
});

test("the first source of a goddess comes before the Ring Toss that brings her back", () => {
  const row = (name) => goddessNamed(name)?.obtain ?? "";
  // Muse, Moirai and Ixchel arrived with a feature; Ring Toss #4 and #5 are a
  // second chance, not the first source, which is what the roster used to say.
  assert.match(row("Muse"), /^Museion unlock event.*back in Ring Toss #4$/);
  assert.match(row("Moirai"), /^Goddess Theater unlock event.*back in Ring Toss #4$/);
  assert.match(row("Ixchel"), /^Grand Voyage unlock event.*back in Ring Toss #5$/);
  assert.match(row("Medusa"), /^Ring Toss #1/);
});

test("goddess search matches affinity and obtain from the current language", () => {
  const extra = (goddess) => {
    const text = localizedGoddess(goddess, en.guideEntries.goddesses.goddessTexts);
    return `${text.affinity} ${text.obtain}`;
  };
  const hits = searchGoddesses("ring toss", "all", extra);
  assert.equal(hits.some((goddess) => goddess.id === "medusa"), true);
  assert.equal(searchGoddesses("museion", "all", extra).map((goddess) => goddess.id).join(), "muse");
  assert.equal(searchGoddesses("zzzz", "all", extra).length, 0);
  assert.equal(searchGoddesses("bastet", "SSR", extra).map((goddess) => goddess.id).join(), "bastet");
});

test("goddesses keep their own layout although they share the heroes filter keys", () => {
  assert.equal(guideLayout(en.guideEntries.goddesses), "goddesses");
  assert.equal("filterAll" in en.guideEntries.goddesses, true);
  assert.equal("goddessTexts" in en.guideEntries.heroes, false);
});

test("the goddesses banner collage uses primary portraits that exist on disk", async () => {
  const { access } = await import("node:fs/promises");
  const { GODDESS_BANNER_IMAGES } = await import("../lib/content/goddess-banner.ts");
  const primary = new Set(GODDESSES.flatMap((goddess) => (goddess.images[0] ? [goddess.images[0]] : [])));
  for (const file of GODDESS_BANNER_IMAGES) {
    assert.ok(primary.has(file), `${file} should be a primary roster portrait`);
    await access(new URL(`../public/goddesses/${file}`, import.meta.url));
  }
});
