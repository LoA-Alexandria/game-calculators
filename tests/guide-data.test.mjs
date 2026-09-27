import assert from "node:assert/strict";
import test from "node:test";

import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  DATA_FILE_NAMES,
  committedData,
  dataFits,
  isDataFileName,
  resolveData,
} from "../lib/content/guide-data.ts";
import { CRYPTIDES_DATA } from "../lib/content/cryptides.ts";

/** The committed file, deep-copied, so a test can bend one field of it. */
const copy = () => JSON.parse(JSON.stringify(CRYPTIDES_DATA));

test("every file under lib/data is registered", () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "data");
  const onDisk = readdirSync(dir).filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -5)).sort();
  assert.deepEqual([...DATA_FILE_NAMES].sort(), onDisk, "a data file is missing from the registry");
  for (const name of onDisk) {
    assert.equal(isDataFileName(name), true, name);
    assert.ok(committedData(name), name);
    // A file has to accept itself, or no override for it could ever be used.
    assert.equal(dataFits(name, committedData(name)), true, name);
  }
});

test("an unknown file is not a way in", () => {
  assert.equal(isDataFileName("../secrets"), false);
  assert.equal(committedData("nope"), undefined);
  assert.equal(dataFits("nope", { anything: true }), false);
  assert.equal(resolveData("nope", { anything: true }), undefined);
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
  for (const payload of [
    null,
    "a string",
    42,
    [],
    {},
    { talent: {}, cryptides: [] },
    { ...copy(), cryptides: "not a list" },
    { ...copy(), cryptides: [] },
  ]) {
    assert.equal(resolveData("cryptides", payload), CRYPTIDES_DATA, JSON.stringify(payload));
  }
});

test("one bad row rejects the whole payload rather than half of it", () => {
  const cases = {
    "a missing skills array": (data) => { delete data.cryptides[1].skills; },
    "a skill without an id": (data) => { data.cryptides[0].skills[0].id = ""; },
    "a growth that became a word": (data) => { data.cryptides[0].foods[0].growth = "ten"; },
    "a tower that became a number": (data) => { data.cryptides[0].tower = 3; },
    "a blank name": (data) => { data.cryptides[0].name = "   "; },
    "a field the file never had": (data) => { data.cryptides[0].colour = "red"; },
    "a stage list emptied": (data) => { data.cryptides[0].stages = []; },
  };
  for (const [what, bend] of Object.entries(cases)) {
    const data = copy();
    bend(data);
    assert.equal(dataFits("cryptides", data), false, what);
    assert.equal(resolveData("cryptides", data), CRYPTIDES_DATA, what);
  }
});

test("a picture may not leave this origin", () => {
  for (const image of [
    "https://example.com/evil.webp",
    "//example.com/evil.webp",
    "../../secret.webp",
    "data:image/webp;base64,AAA=",
    "nidhogg",
    "",
  ]) {
    const data = copy();
    data.cryptides[0].image = image;
    assert.equal(dataFits("cryptides", data), false, image || "(empty)");
  }

  for (const image of ["nidhogg.webp", "skills/nidhogg-1.webp", "up/cryptides/nidhogg-k3f9.webp"]) {
    const data = copy();
    data.cryptides[0].image = image;
    assert.equal(dataFits("cryptides", data), true, image);
  }
});

test("the file that ships today passes its own check", () => {
  // If this ever fails, the shape the page expects and the file it is built
  // from have drifted apart, and no override would be accepted either.
  assert.equal(dataFits("cryptides", CRYPTIDES_DATA), true);
});
