import assert from "node:assert/strict";
import test from "node:test";

import {
  OVERRIDABLE_FIELDS,
  applyOverride,
  mergeTexts,
  overrideFrom,
  overrideWith,
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

test("the names of the things a guide lists can be overridden", () => {
  // This is the edit everybody tries first, and the one that silently did
  // nothing: the displayed name comes from these texts, not the data file.
  const cryptides = getDictionary("en").guideEntries.cryptides;
  const renamed = {
    ...cryptides.cryptideTexts,
    nidhogg: { ...cryptides.cryptideTexts.nidhogg, name: "Nidhoggd" },
  };
  const shown = applyOverride(cryptides, { cryptideTexts: renamed });
  assert.equal(shown.cryptideTexts.nidhogg.name, "Nidhoggd");
  assert.equal(shown.cryptideTexts.caladrius.name, cryptides.cryptideTexts.caladrius.name);
  assert.equal(shown.title, cryptides.title, "the rest of the guide is untouched");

  assert.deepEqual(overrideFrom(cryptides, { ...cryptides, cryptideTexts: renamed }), {
    cryptideTexts: { nidhogg: { name: "Nidhoggd" } },
  }, "only the name that changed travels");
  assert.deepEqual(overrideFrom(cryptides, { ...cryptides }), {}, "no change, nothing sent");
});

test("a text tree with something other than words in it is refused", () => {
  const bad = [
    { nidhogg: { name: 42 } },
    { nidhogg: { skills: ["a list"] } },
    { nidhogg: { skills: { one: { body: { too: { deep: "here" } } } } } },
    "a string",
    ["a list"],
  ];
  for (const payload of bad) {
    assert.equal("cryptideTexts" in readOverride({ cryptideTexts: payload }), false, JSON.stringify(payload));
  }
  const fine = { nidhogg: { name: "N", skills: { s1: { name: "A", body: "B" } }, foods: { f1: { name: "C" } } } };
  assert.deepEqual(readOverride({ cryptideTexts: fine }).cryptideTexts, fine);
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

test("a name edited back to the built one is taken out of the payload", () => {
  // The bug this pins: the editor showed the published name, the name was put
  // back to the committed one, and the payload then said nothing about the
  // field — so the published row kept winning and the page never changed.
  const cryptides = getDictionary("en").guideEntries.cryptides;
  const renamed = {
    ...cryptides.cryptideTexts,
    nidhogg: { ...cryptides.cryptideTexts.nidhogg, name: "Nidhoggd" },
  };
  const live = { cryptideTexts: { nidhogg: { name: "Nidhoggd" } } };

  assert.deepEqual(
    overrideWith(live, cryptides, { ...cryptides }, ["cryptideTexts"]),
    {},
    "back to the built name, so nothing is laid over the build any more",
  );
  assert.deepEqual(
    overrideWith(live, cryptides, { ...cryptides, cryptideTexts: renamed }, ["cryptideTexts"]),
    live,
    "saving the same thing again writes the same payload",
  );
});

test("an editor leaves the fields it does not own alone", () => {
  const cryptides = getDictionary("en").guideEntries.cryptides;
  const renamed = {
    ...cryptides.cryptideTexts,
    nidhogg: { ...cryptides.cryptideTexts.nidhogg, name: "Nidhoggd" },
  };
  const live = { cryptideTexts: renamed, intro: "A published intro." };

  // The prose editor writes the prose. The published names survive it, in both
  // directions: a new summary, and a summary put back.
  const prose = { title: cryptides.title, summary: "A new line.", intro: cryptides.intro };
  const after = overrideWith(live, cryptides, prose, Object.keys(prose));
  assert.equal(after.cryptideTexts, renamed, "the names another editor published are kept");
  assert.equal(after.summary, "A new line.");
  assert.equal("intro" in after, false, "the intro is back to the built one");

  // And the names editor does not drop the prose.
  const names = overrideWith(live, cryptides, { ...cryptides, cryptideTexts: renamed }, ["cryptideTexts"]);
  assert.equal(names.intro, "A published intro.");
});

test("a field a payload may not carry is dropped rather than published", () => {
  const cryptides = getDictionary("en").guideEntries.cryptides;
  const live = { summary: "A published line." };
  assert.deepEqual(
    overrideWith(live, cryptides, { ...cryptides, summary: "   " }, ["summary"]),
    {},
    "a cleared box means back to the built text, not a blank guide",
  );
  assert.deepEqual(
    overrideWith(live, cryptides, { ...cryptides, cryptideTexts: { nidhogg: { name: 42 } } }, ["cryptideTexts"]),
    live,
    "nonsense never reaches the payload",
  );
});

test("a payload carries only the names that were changed", () => {
  const cryptides = getDictionary("en").guideEntries.cryptides;
  const edited = {
    ...cryptides,
    cryptideTexts: {
      ...cryptides.cryptideTexts,
      nidhogg: { ...cryptides.cryptideTexts.nidhogg, name: "Nidhoggd" },
    },
  };
  const payload = overrideWith(null, cryptides, edited, ["cryptideTexts"]);
  assert.deepEqual(payload, { cryptideTexts: { nidhogg: { name: "Nidhoggd" } } });
  assert.equal(
    "caladrius" in payload.cryptideTexts,
    false,
    "the names nobody touched stay in the build, where a later commit can still change them",
  );
  assert.equal(
    "skills" in payload.cryptideTexts.nidhogg,
    false,
    "and so do the skills of the one that was renamed",
  );
});

test("a name an editor left empty is not published as empty", () => {
  // The editors build a full tree of boxes. An empty one means "as built", and
  // writing it through would blank a skill name on the page.
  const cryptides = getDictionary("en").guideEntries.cryptides;
  const blanked = {
    ...cryptides,
    cryptideTexts: {
      nidhogg: {
        name: "Nidhoggd",
        skills: { "fireball-hail": { name: "", body: "" } },
        foods: { ribs: { name: "   " } },
      },
    },
  };
  assert.deepEqual(overrideWith(null, cryptides, blanked, ["cryptideTexts"]), {
    cryptideTexts: { nidhogg: { name: "Nidhoggd" } },
  });
});

test("published names are laid over the built ones, not in place of them", () => {
  const cryptides = getDictionary("en").guideEntries.cryptides;
  const shown = applyOverride(cryptides, { cryptideTexts: { nidhogg: { name: "Nidhoggd" } } });
  assert.equal(shown.cryptideTexts.nidhogg.name, "Nidhoggd");
  assert.deepEqual(
    shown.cryptideTexts.nidhogg.skills,
    cryptides.cryptideTexts.nidhogg.skills,
    "the skills of the renamed Cryptide survive",
  );
  assert.deepEqual(
    shown.cryptideTexts.caladrius,
    cryptides.cryptideTexts.caladrius,
    "and so does every other entry",
  );
  assert.equal(mergeTexts(cryptides.cryptideTexts, undefined), cryptides.cryptideTexts);
});

test("a rename and a revert make a round trip", () => {
  const cryptides = getDictionary("en").guideEntries.cryptides;
  const renamed = mergeTexts(cryptides.cryptideTexts, { nidhogg: { name: "Nidhoggd" } });
  const live = overrideWith(null, cryptides, { ...cryptides, cryptideTexts: renamed }, ["cryptideTexts"]);
  assert.deepEqual(live, { cryptideTexts: { nidhogg: { name: "Nidhoggd" } } });

  // What the editor now opens on, and the letter taken back off it.
  const asShown = mergeTexts(cryptides.cryptideTexts, live.cryptideTexts);
  assert.equal(asShown.nidhogg.name, "Nidhoggd");
  const back = mergeTexts(asShown, { nidhogg: { name: cryptides.cryptideTexts.nidhogg.name } });
  assert.deepEqual(
    overrideWith(live, cryptides, { ...cryptides, cryptideTexts: back }, ["cryptideTexts"]),
    {},
    "nothing is laid over the build any more, so publishing takes the row away",
  );
});
