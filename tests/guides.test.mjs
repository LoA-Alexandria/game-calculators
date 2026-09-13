import assert from "node:assert/strict";
import test from "node:test";

import {
  camelToKebab,
  guideHref,
  guideIdFromHref,
  kebabToCamel,
} from "../lib/content/guides.ts";

test("converts guide slugs and dictionary ids both ways", () => {
  assert.equal(kebabToCamel("water-supply"), "waterSupply");
  assert.equal(camelToKebab("waterSupply"), "water-supply");
  assert.equal(guideHref("waterSupply"), "/guides/water-supply/");
  assert.equal(guideIdFromHref("/guides/water-supply/"), "waterSupply");
  assert.equal(guideIdFromHref("/guides/new/"), null);
});
