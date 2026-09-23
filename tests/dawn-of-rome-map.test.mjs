import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DAWN_OF_ROME_BASES,
  DAWN_OF_ROME_SETTLEMENTS,
  dawnHexToPixel,
  dawnOwnerKind,
  dawnPixelToHex,
  dawnSettlementById,
} from "../lib/content/dawn-of-rome-map.ts";

describe("dawn of rome map", () => {
  it("lists six bases and the white-label settlements", () => {
    assert.equal(DAWN_OF_ROME_BASES.length, 6);
    assert.ok(DAWN_OF_ROME_SETTLEMENTS.length >= 20);
    assert.equal(dawnSettlementById("rome")?.label, "Rome");
    assert.ok(DAWN_OF_ROME_SETTLEMENTS.every((row) => row.id && row.label));
  });

  it("round-trips axial hexes through pixel space", () => {
    for (const [q, r] of [
      [0, 0],
      [3, -1],
      [10, 8],
      [-2, 4],
    ]) {
      const { x, y } = dawnHexToPixel(q, r);
      const back = dawnPixelToHex(x, y);
      assert.deepEqual(back, { q, r });
    }
  });

  it("treats null settlement owners as neutral", () => {
    assert.equal(dawnOwnerKind(null, "g1", "g2"), "neutral");
    assert.equal(dawnOwnerKind("g1", "g1", "g2"), "ours");
    assert.equal(dawnOwnerKind("g2", "g1", "g2"), "ally");
  });
});
