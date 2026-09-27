import assert from "node:assert/strict";
import test from "node:test";

import {
  GUIDE_DATA_KINDS,
  committedData,
  dataFits,
  isGuideDataKind,
  resolveData,
} from "../lib/content/guide-data.ts";
import { CRYPTIDES_DATA } from "../lib/content/cryptides.ts";

/** The committed file, deep-copied, so a test can bend one field of it. */
const copy = () => JSON.parse(JSON.stringify(CRYPTIDES_DATA));

test("the committed file is what the build carries", () => {
  assert.equal(committedData("cryptides"), CRYPTIDES_DATA);
  assert.deepEqual(GUIDE_DATA_KINDS, ["cryptides"]);
  assert.equal(isGuideDataKind("cryptides"), true);
  assert.equal(isGuideDataKind("heroes"), false);
});

test("a payload shaped like the file is used", () => {
  const edited = copy();
  edited.talent.unlockCost = 7;
  edited.cryptides[0].name = "Nidhogg the Renamed";
  assert.equal(dataFits("cryptides", edited), true);
  const used = resolveData("cryptides", edited);
  assert.equal(used.talent.unlockCost, 7);
  assert.equal(used.cryptides[0].name, "Nidhogg the Renamed");
});

test("nothing from the database is used until it fits", () => {
  // Every one of these would throw somewhere in the guide if it got through.
  const broken = [
    null,
    undefined,
    "a string",
    42,
    [],
    {},
    { talent: {}, cryptides: [] },
    { talent: { unlockCost: 5, dropAmount: 5, dropEveryLevels: 20 }, cryptides: [] },
    { ...copy(), cryptides: "not a list" },
  ];
  for (const payload of broken) {
    assert.equal(resolveData("cryptides", payload), CRYPTIDES_DATA, JSON.stringify(payload));
  }
});

test("one bad row rejects the whole payload rather than half of it", () => {
  const cases = {
    "a missing skills array": (data) => { delete data.cryptides[1].skills; },
    "a skill without an id": (data) => { data.cryptides[0].skills[0].id = ""; },
    "a food with a negative growth": (data) => { data.cryptides[0].foods[0].growth = -5; },
    "an unknown tower": (data) => { data.cryptides[0].tower = "catapult"; },
    "an unknown talent material": (data) => { data.cryptides[0].talentMaterial = "gold"; },
    "two Cryptides with one id": (data) => { data.cryptides[1].id = data.cryptides[0].id; },
    "a blank name": (data) => { data.cryptides[0].name = "   "; },
    "a talent number that is not whole": (data) => { data.talent.dropAmount = 2.5; },
  };
  for (const [what, bend] of Object.entries(cases)) {
    const data = copy();
    bend(data);
    assert.equal(dataFits("cryptides", data), false, what);
    assert.equal(resolveData("cryptides", data), CRYPTIDES_DATA, what);
  }
});

test("a picture may only be a file inside the guide's own folder", () => {
  const bad = [
    "https://example.com/evil.webp",
    "/etc/passwd",
    "../../secret.webp",
    "foo//bar.webp",
    "Nidhogg.webp",
    "nidhogg.png",
    "nidhogg",
    "",
  ];
  for (const image of bad) {
    const data = copy();
    data.cryptides[0].image = image;
    assert.equal(dataFits("cryptides", data), false, image || "(empty)");
  }

  const good = ["nidhogg.webp", "skills/nidhogg-1.webp", "evolution/nidhogg-6.webp"];
  for (const image of good) {
    const data = copy();
    data.cryptides[0].image = image;
    assert.equal(dataFits("cryptides", data), true, image);
  }
});

test("stages are optional, but not malformed", () => {
  const without = copy();
  for (const row of without.cryptides) delete row.stages;
  assert.equal(dataFits("cryptides", without), true, "a Cryptide nobody has photographed");

  const wrong = copy();
  wrong.cryptides[0].stages = [{ stage: "childhood" }];
  assert.equal(dataFits("cryptides", wrong), false, "a stage without a picture");
});

test("the file that ships today passes its own check", () => {
  // If this ever fails, the shape the page expects and the file it is built
  // from have drifted apart, and no override would be accepted either.
  assert.equal(dataFits("cryptides", CRYPTIDES_DATA), true);
});
