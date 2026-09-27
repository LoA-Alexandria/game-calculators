import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { getDictionary, mapLocales } from "../lib/i18n/index.ts";
import { sectionById } from "../lib/navigation.ts";
import { guideHref, guideLayout } from "../lib/content/guides.ts";
import { GUIDE_PRESENTATION } from "../lib/content/guide-meta.ts";
import {
  CRYPTID_FORMATION,
  CRYPTID_PRIORITY,
  cryptideById,
  formationCryptides,
} from "../lib/content/cryptid-layout.ts";
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
    steps ??= Object.keys(guide.prioritySteps).length;
    assert.equal(Object.keys(guide.prioritySteps).length, steps, `${code} priority steps`);
    for (const step of CRYPTID_PRIORITY) assert.ok(guide.prioritySteps[step.id]?.trim(), `${code}.${step.id}`);
    assert.ok(guide.priorityTarget.includes("{rarity}"), `${code} target keeps its placeholder`);
    for (const field of ["towerHeading", "towerBody", "towerLevels", "towerNote"]) {
      assert.equal(field in guide, false, `${code} no duplicate Tower level field ${field}`);
    }
  }
  assert.equal(steps, 5);
});

test("every step of the path names Cryptides that exist and a rarity to reach", () => {
  const rarities = new Set(["SSR", "UR"]);
  for (const step of CRYPTID_PRIORITY) {
    assert.ok(step.cryptides.length > 0, step.id);
    assert.ok(rarities.has(step.target), `${step.id} target`);
    for (const id of step.cryptides) assert.ok(cryptideById(id), `${step.id}: ${id}`);
  }
  // Everything named across the path is a Cryptide the guide actually has, and
  // every Cryptide is reached at some point.
  const touched = new Set(CRYPTID_PRIORITY.flatMap((step) => step.cryptides));
  assert.deepEqual([...touched].sort(), CRYPTIDES.map((cryptide) => cryptide.id).sort());
  const ur = CRYPTID_PRIORITY.filter((step) => step.target === "UR").flatMap((step) => step.cryptides);
  assert.deepEqual([...ur].sort(), CRYPTIDES.map((cryptide) => cryptide.id).sort(), "all four end at UR");
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
