import assert from "node:assert/strict";
import test from "node:test";

import {
  OVERRIDABLE_FIELDS,
  applyOverride,
  overrideFrom,
  overridesByGuide,
  readOverride,
} from "../lib/content/guide-overrides.ts";
import { getDictionary } from "../lib/i18n/index.ts";

const baked = getDictionary("en").guideEntries.cryptidLayout;

test("an override replaces only the fields it names", () => {
  const shown = applyOverride(baked, { summary: "A shorter line." });
  assert.equal(shown.summary, "A shorter line.");
  assert.equal(shown.title, baked.title, "everything else stays as it was built");
  assert.equal(shown.intro, baked.intro);
  assert.notEqual(shown, baked, "the base is not mutated");
  assert.equal(baked.summary.includes("A shorter line."), false);
});

test("an empty payload leaves the built guide exactly as it is", () => {
  assert.equal(applyOverride(baked, {}), baked);
  assert.equal(applyOverride(baked, null), baked);
  assert.equal(applyOverride(baked, "nonsense"), baked);
  assert.equal(applyOverride(baked, { summary: "   " }), baked, "a cleared box is not an override");
});

test("a field the guide does not have cannot be invented", () => {
  const shown = applyOverride(baked, { title: "Kept", nonsense: "ignored" });
  assert.equal(shown.title, "Kept");
  assert.equal("nonsense" in shown, false);
});

test("only the known fields survive a payload", () => {
  const override = readOverride({
    title: "A",
    summary: "B",
    slotLabel: "Slot {slots}",
    prioritySteps: { allSsr: "no" },
    sections: [{ heading: "H", body: ["one", "two"] }],
  });
  assert.deepEqual(Object.keys(override).sort(), ["sections", "summary", "title"]);
  assert.deepEqual(override.sections, [{ heading: "H", body: ["one", "two"] }]);
  // Structured guide data is not editable this way, by design.
  assert.equal("slotLabel" in override, false);
  assert.equal("prioritySteps" in override, false);
});

test("a malformed section list is dropped rather than half applied", () => {
  assert.equal("sections" in readOverride({ sections: [{ heading: "H" }] }), false);
  assert.equal("sections" in readOverride({ sections: [{ heading: 1, body: [] }] }), false);
  assert.equal("sections" in readOverride({ sections: [{ heading: "H", body: [1] }] }), false);
  assert.equal("sections" in readOverride({ sections: "no" }), false);
  const shown = applyOverride(baked, { sections: [{ heading: "H" }] });
  assert.deepEqual(shown.sections, baked.sections, "the built sections stand");
});

test("the editor sends only what it changed", () => {
  const edited = { ...baked, summary: "New line." };
  assert.deepEqual(overrideFrom(baked, edited), { summary: "New line." });
  assert.deepEqual(overrideFrom(baked, { ...baked }), {}, "an untouched guide sends nothing");

  const resections = { ...baked, sections: [{ heading: "New", body: ["text"] }] };
  assert.deepEqual(overrideFrom(baked, resections), { sections: [{ heading: "New", body: ["text"] }] });
});

test("rows are read per language", () => {
  const rows = [
    { guide_id: "cryptidLayout", locale: "de", payload: { title: "Deutsch" } },
    { guide_id: "cryptidLayout", locale: "en", payload: { title: "English" } },
    { guide_id: "cryptides", locale: "de", payload: { title: "Auch Deutsch" } },
    { guide_id: "manor", locale: "de", payload: {} },
    { guide_id: "manor", locale: "de", payload: null },
  ];
  const german = overridesByGuide(rows, "de");
  assert.deepEqual([...german.keys()].sort(), ["cryptidLayout", "cryptides"]);
  assert.deepEqual(german.get("cryptidLayout"), { title: "Deutsch" });
  assert.equal(german.has("manor"), false, "an empty payload is not an override");
  assert.deepEqual([...overridesByGuide(rows, "fr").keys()], []);
});

test("every overridable field is one a guide entry actually carries", () => {
  // `applyOverride` only writes fields the base already has, so a name that no
  // guide uses would be dead weight and a sign the list has drifted.
  const entries = Object.values(getDictionary("en").guideEntries);
  for (const field of OVERRIDABLE_FIELDS) {
    assert.ok(
      entries.some((entry) => field in entry),
      `no guide has a ${field}`,
    );
  }
});
