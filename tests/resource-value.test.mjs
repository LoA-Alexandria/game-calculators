import assert from "node:assert/strict";
import test from "node:test";

import { calculateResourceValue } from "../lib/calculators/resource-value.ts";

test("multiplies item quantity by point value", () => {
  assert.equal(calculateResourceValue(25, 4), 100);
});

test("clamps negative inputs to zero", () => {
  assert.equal(calculateResourceValue(-2, 4), 0);
  assert.equal(calculateResourceValue(2, -4), 0);
});

test("returns zero for non-finite inputs", () => {
  assert.equal(calculateResourceValue(Number.NaN, 4), 0);
  assert.equal(calculateResourceValue(2, Number.POSITIVE_INFINITY), 0);
});
