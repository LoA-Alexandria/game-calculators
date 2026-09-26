import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getDictionary, mapLocales } from "../lib/i18n/index.ts";
import { sectionById } from "../lib/navigation.ts";
import { guideHref, guideLayout } from "../lib/content/guides.ts";
import { GUIDE_PRESENTATION } from "../lib/content/guide-meta.ts";
import { CRYPTID_FORMATION, cryptideById, formationCryptides } from "../lib/content/cryptid-layout.ts";
import { CRYPTIDES } from "../lib/content/cryptides.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Cryptid layout sits under Layouts and uses its own renderer", () => {
  const item = sectionById("guides").items.find((entry) => entry.href === "/guides/cryptid-layout/");
  assert.ok(item, "the guide is not in the navigation");
  assert.equal(item.categoryId, "layouts");
  assert.equal(guideHref("cryptidLayout"), "/guides/cryptid-layout/");
  assert.ok(existsSync(join(root, "app/guides/cryptid-layout/page.tsx")), "the page is missing");
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    assert.equal(guideLayout(dictionary.guideEntries.cryptidLayout), "cryptidLayout", code);
  }
});

test("the formation covers the four slots once each and names every Cryptide", () => {
  const slots = CRYPTID_FORMATION.flatMap((group) => group.slots);
  assert.deepEqual([...slots].sort((a, b) => a - b), [1, 2, 3, 4]);
  const named = CRYPTID_FORMATION.flatMap((group) => group.cryptides);
  assert.equal(named.length, slots.length, "one Cryptide per slot");
  assert.deepEqual([...named].sort(), CRYPTIDES.map((cryptide) => cryptide.id).sort());
  for (const id of named) assert.ok(cryptideById(id), id);
  assert.deepEqual(
    formationCryptides().map((cryptide) => cryptide.id),
    ["cerberus", "caladrius", "nidhogg", "sleipnir"],
  );
});

test("every language gives a reason per group and the same lists", () => {
  const groups = CRYPTID_FORMATION.map((group) => group.id);
  let steps = null;
  let levels = null;
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    const guide = dictionary.guideEntries.cryptidLayout;
    assert.ok(guide.title.trim(), code);
    assert.ok(guide.summary.trim(), code);
    assert.ok(guide.slotLabel.includes("{slots}"), `${code} slot label keeps its placeholder`);
    for (const group of groups) assert.ok(guide.slotReasons[group]?.trim(), `${code}.${group}`);
    assert.equal(Object.keys(guide.slotReasons).length, groups.length, `${code} has no stray reason`);
    assert.ok(guide.sourceNote.includes("Autumn"), `${code} keeps the credit`);
    // The lists are one piece of advice each, so they have to line up across
    // languages; a missing step would read as a different plan.
    steps ??= guide.prioritySteps.length;
    levels ??= guide.towerLevels.length;
    assert.equal(guide.prioritySteps.length, steps, `${code} priority steps`);
    assert.equal(guide.towerLevels.length, levels, `${code} tower levels`);
    for (const row of guide.towerLevels) {
      assert.ok(row.tier.trim(), code);
      assert.ok(row.target.trim(), code);
    }
  }
  assert.equal(steps, 5);
  assert.equal(levels, 4);
});

test("the guide card shows pictures that are on disk and no editor", () => {
  const presentation = GUIDE_PRESENTATION.cryptidLayout;
  assert.ok(presentation, "no entry in GUIDE_PRESENTATION");
  assert.equal(presentation.editor, undefined, "the layout has no editor of its own yet");
  assert.ok(presentation.art.length > 0);
  for (const file of presentation.art) {
    assert.ok(existsSync(join(root, "public", file)), file);
  }
});
