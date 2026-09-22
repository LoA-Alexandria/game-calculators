import assert from "node:assert/strict";
import test from "node:test";

import { COLOR_SCHEMES, DEFAULT_COLOR_SCHEME, isColorScheme } from "../lib/theme.ts";

test("stone is the default colour scheme", () => {
  assert.equal(DEFAULT_COLOR_SCHEME, "stone");
  assert.equal(COLOR_SCHEMES[0].id, "stone");
});

test("isColorScheme accepts only the four palettes", () => {
  for (const scheme of COLOR_SCHEMES) {
    assert.equal(isColorScheme(scheme.id), true);
  }
  assert.equal(isColorScheme("light"), false);
  assert.equal(isColorScheme("dark"), false);
  assert.equal(isColorScheme("comic"), false);
  assert.equal(isColorScheme(""), false);
  assert.equal(isColorScheme(null), false);
});
