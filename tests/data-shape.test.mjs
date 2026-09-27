import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  fitsCommitted,
  fitsShape,
  inferShape,
  isSafePicturePath,
  looksLikePicture,
  mergeShapes,
} from "../lib/content/data-shape.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "lib/data");
const files = readdirSync(dataDir).filter((name) => name.endsWith(".json"));
const load = (name) => JSON.parse(readFileSync(join(dataDir, name), "utf8"));

test("every data file the site ships fits its own shape", () => {
  // If this fails the inference is wrong, and no override for that guide would
  // ever be accepted either.
  assert.ok(files.length >= 25, `only ${files.length} data files found`);
  for (const name of files) {
    const data = load(name);
    assert.equal(fitsCommitted(data, data), true, name);
  }
});

test("a file cannot stand in for a different file", () => {
  const cryptides = load("cryptides.json");
  const heroes = load("heroes.json");
  assert.equal(fitsCommitted(cryptides, heroes), false);
  assert.equal(fitsCommitted(heroes, cryptides), false);
});

test("the shape follows the file, not a guess", () => {
  const committed = { rows: [{ id: "a", count: 1, image: "a.webp" }] };
  const shape = inferShape(committed);

  assert.equal(fitsShape(shape, { rows: [{ id: "b", count: 2, image: "b.webp" }] }), true);
  assert.equal(fitsShape(shape, { rows: [{ id: "b", count: 2, image: "b.webp" }, { id: "c", count: 3, image: "c.webp" }] }), true, "a longer list is still a list");
  assert.equal(fitsShape(shape, { rows: [] }), false, "a list the file fills may not come back empty");
  assert.equal(fitsShape(shape, { rows: [{ id: "b", count: "two", image: "b.webp" }] }), false, "a number became a word");
  assert.equal(fitsShape(shape, { rows: [{ id: "b", image: "b.webp" }] }), false, "a field went missing");
  assert.equal(fitsShape(shape, { rows: [{ id: "b", count: 2, image: "b.webp", extra: 1 }] }), false, "a field appeared");
  assert.equal(fitsShape(shape, { rows: {} }), false, "a list became an object");
  assert.equal(fitsShape(shape, {}), false);
  assert.equal(fitsShape(shape, null), false);
});

test("a field the file always fills may not come back blank", () => {
  const shape = inferShape({ rows: [{ id: "a", note: "" }] });
  assert.equal(fitsShape(shape, { rows: [{ id: "b", note: "" }] }), true, "a field the file leaves blank may stay blank");
  assert.equal(fitsShape(shape, { rows: [{ id: "", note: "" }] }), false, "an id may not");
  assert.equal(fitsShape(shape, { rows: [{ id: "   ", note: "" }] }), false, "nor may spaces stand in for one");
});

test("a field only some rows have is optional, and keeps its type", () => {
  const committed = { rows: [{ id: "a" }, { id: "b", note: "hello" }] };
  const shape = inferShape(committed);
  assert.equal(fitsShape(shape, { rows: [{ id: "c" }] }), true);
  assert.equal(fitsShape(shape, { rows: [{ id: "c", note: "there" }] }), true);
  assert.equal(fitsShape(shape, { rows: [{ id: "c", note: 7 }] }), false, "optional is not untyped");
});

test("a picture path is held to the stricter rule", () => {
  const shape = inferShape({ image: "skills/nidhogg-1.webp" });
  assert.equal(fitsShape(shape, { image: "evolution/nidhogg-6.webp" }), true);
  assert.equal(fitsShape(shape, { image: "up/cryptides/nidhogg-k3f9.webp" }), true, "an upload is still a path");
  // The event wiki spells its pictures from the site root; that stays on this origin.
  assert.equal(fitsShape(shape, { image: "/events/atlantis.webp" }), true);
  for (const bad of [
    "https://example.com/evil.webp",
    "//example.com/evil.webp",
    "javascript:alert(1)//x.webp",
    "../../secret.webp",
    "data:image/webp;base64,AAA=",
    "nidhogg.svg",
    "",
  ]) {
    assert.equal(fitsShape(shape, { image: bad }), false, bad || "(empty)");
  }
});

test("a string that is not a picture in the file is not treated as one", () => {
  const shape = inferShape({ title: "How feeding works" });
  assert.equal(fitsShape(shape, { title: "Anything at all: with punctuation!" }), true);
});

test("a field the file is inconsistent about lets nothing structured through", () => {
  const mixed = mergeShapes(inferShape("text"), inferShape(7));
  assert.equal(mixed.kind, "mixed");
  assert.equal(fitsShape(mixed, "text"), true);
  assert.equal(fitsShape(mixed, 7), true);
  assert.equal(fitsShape(mixed, null), true);
  assert.equal(fitsShape(mixed, { nested: true }), false, "structure is what a renderer walks into");
  assert.equal(fitsShape(mixed, ["a list"]), false);
});

test("nothing enormous or bottomless gets through", () => {
  const shape = inferShape({ rows: [{ id: "a" }] });
  const huge = { rows: Array.from({ length: 300_000 }, () => ({ id: "a" })) };
  assert.equal(fitsShape(shape, huge), false, "too many nodes");

  const longString = inferShape({ id: "a" });
  assert.equal(fitsShape(longString, { id: "x".repeat(30_000) }), false, "too long a string");

  let deep = { id: "a" };
  for (let n = 0; n < 40; n += 1) deep = { id: deep };
  assert.equal(fitsShape(longString, deep), false, "too deep");
});

test("the picture test only claims what it can see", () => {
  assert.equal(looksLikePicture("a.webp"), true);
  assert.equal(looksLikePicture("a.PNG"), true);
  assert.equal(looksLikePicture("a.svg"), false);
  assert.equal(looksLikePicture("Tea Party Corridor"), false);
  assert.equal(isSafePicturePath("skills/a-1.webp"), true);
  assert.equal(isSafePicturePath("C:/evil.webp"), false);
});
