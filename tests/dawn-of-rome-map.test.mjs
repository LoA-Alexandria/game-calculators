import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DAWN_HEX_HEIGHT,
  DAWN_OF_ROME_BASES,
  DAWN_OF_ROME_MAP,
  DAWN_TONES,
  isDawnTone,
  isRomeTile,
  romeHexCenter,
  romeHexPolygon,
  romePixelToHex,
  romeTiles,
} from "../lib/content/dawn-of-rome-map.ts";

describe("dawn of rome map", () => {
  it("keeps the six outposts inside the picture", () => {
    assert.equal(DAWN_OF_ROME_BASES.length, 6);
    for (const base of DAWN_OF_ROME_BASES) {
      assert.ok(base.x > 0 && base.x < 100, "x in percent");
      assert.ok(base.y > 0 && base.y < 100, "y in percent");
    }
  });

  it("puts every second row half a column across", () => {
    const first = romeHexCenter(0, 0);
    assert.deepEqual(first, { x: DAWN_OF_ROME_MAP.originX, y: DAWN_OF_ROME_MAP.originY });
    assert.equal(romeHexCenter(1, 0).x - first.x, DAWN_OF_ROME_MAP.pitchX);
    assert.equal(romeHexCenter(0, 1).x - first.x, DAWN_OF_ROME_MAP.pitchX / 2);
    assert.equal(romeHexCenter(0, 1).y - first.y, DAWN_OF_ROME_MAP.pitchY);
    // A row below and a row above are shifted the same way.
    assert.equal(romeHexCenter(0, -1).x, romeHexCenter(0, 1).x);
  });

  it("finds the tile under a point, including near the slanted edges", () => {
    for (const [col, row] of [[0, 0], [3, 4], [-1, 7], [13, 15], [6, -2]]) {
      const centre = romeHexCenter(col, row);
      assert.deepEqual(romePixelToHex(centre.x, centre.y), { col, row });
      // Well inside the tile, towards each side.
      assert.deepEqual(romePixelToHex(centre.x + 20, centre.y), { col, row });
      assert.deepEqual(romePixelToHex(centre.x, centre.y + 20), { col, row });
    }
  });

  it("hands a click just past the edge to the neighbour", () => {
    const centre = romeHexCenter(4, 4);
    const right = romePixelToHex(centre.x + DAWN_OF_ROME_MAP.pitchX * 0.8, centre.y);
    assert.deepEqual(right, { col: 5, row: 4 });
    const below = romePixelToHex(centre.x, centre.y + DAWN_OF_ROME_MAP.pitchY * 0.9);
    assert.equal(below.row, 5);
  });

  it("covers the picture with a few hundred tiles", () => {
    const tiles = romeTiles();
    assert.equal(tiles.length, 15 * 18);
    assert.ok(tiles.every((tile) => isRomeTile(tile.col, tile.row)));
    assert.equal(isRomeTile(99, 0), false);
    // The board reaches past both edges, so no strip of map is unclickable.
    const xs = tiles.map((tile) => romeHexCenter(tile.col, tile.row).x);
    const ys = tiles.map((tile) => romeHexCenter(tile.col, tile.row).y);
    assert.ok(Math.min(...xs) <= 0 + DAWN_OF_ROME_MAP.pitchX / 2);
    assert.ok(Math.max(...xs) >= DAWN_OF_ROME_MAP.width - DAWN_OF_ROME_MAP.pitchX / 2);
    assert.ok(Math.min(...ys) <= 0);
    assert.ok(Math.max(...ys) >= DAWN_OF_ROME_MAP.height);
  });

  it("draws a hexagon with six corners of the measured size", () => {
    const points = romeHexPolygon(2, 2).split(" ").map((pair) => pair.split(",").map(Number));
    assert.equal(points.length, 6);
    const ys = points.map(([, y]) => y);
    assert.ok(Math.abs(Math.max(...ys) - Math.min(...ys) - DAWN_HEX_HEIGHT) < 0.2);
    const xs = points.map(([x]) => x);
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - DAWN_OF_ROME_MAP.pitchX) < 0.2);
  });

  it("knows its six territory colours", () => {
    assert.equal(DAWN_TONES.length, 6);
    assert.equal(isDawnTone(1), true);
    assert.equal(isDawnTone(7), false);
  });
});
