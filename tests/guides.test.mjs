import assert from "node:assert/strict";
import test from "node:test";

import en from "../lib/i18n/dictionaries/en.ts";
import { sectionById } from "../lib/navigation.ts";
import {
  camelToKebab,
  guideHref,
  guideIdFromHref,
  isGuideEntryId,
  kebabToCamel,
} from "../lib/content/guides.ts";

test("converts guide slugs and dictionary ids both ways", () => {
  assert.equal(kebabToCamel("water-supply"), "waterSupply");
  assert.equal(camelToKebab("waterSupply"), "water-supply");
  assert.equal(guideHref("waterSupply"), "/guides/water-supply/");
  assert.equal(guideHref("goddesses"), "/guides/goddesses/");
  assert.equal(guideIdFromHref("/guides/water-supply/"), "waterSupply");
  assert.equal(guideIdFromHref("/guides/goddesses/"), "goddesses");
  assert.equal(guideIdFromHref("/guides/new/"), null);
});

test("every published guide has a dictionary entry", () => {
  for (const item of sectionById("guides").items) {
    const id = guideIdFromHref(item.href);
    assert.ok(id, `no id for ${item.href}`);
    assert.equal(isGuideEntryId(id, en.guideEntries), true);
  }
});

test("goddesses phase 2 stops Fortuna and Bastet at 60", () => {
  const { phases, note } = en.guideEntries.goddesses;
  const phase2 = phases.find((phase) => phase.tone === "2");
  assert.ok(phase2, "missing phase 2");
  assert.equal(phase2.rows.find((row) => row.name === "Fortuna")?.target, "60");
  assert.equal(phase2.rows.find((row) => row.name === "Bastet")?.target, "60");
  assert.equal(note, "");
});
