import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DAWN_COL_PITCH,
  DAWN_OF_ROME_BASES,
  DAWN_OF_ROME_MAP,
  DAWN_ROW_PITCH,
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

  it("puts every second column half a row lower", () => {
    const first = romeHexCenter(0, 0);
    assert.deepEqual(first, { x: DAWN_OF_ROME_MAP.originX, y: DAWN_OF_ROME_MAP.originY });
    assert.equal(romeHexCenter(0, 1).y - first.y, DAWN_ROW_PITCH);
    assert.equal(romeHexCenter(1, 0).x - first.x, DAWN_COL_PITCH);
    assert.equal(romeHexCenter(1, 0).y - first.y, DAWN_ROW_PITCH / 2);
    // A column left and a column right drop the same way.
    assert.equal(romeHexCenter(-1, 0).y, romeHexCenter(1, 0).y);
    // Tiles overlap by a quarter, the way flat-top hexes tile.
    assert.equal(DAWN_COL_PITCH, DAWN_OF_ROME_MAP.hexWidth * 0.75);
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
    const below = romePixelToHex(centre.x, centre.y + DAWN_ROW_PITCH * 0.9);
    assert.deepEqual(below, { col: 4, row: 5 });
    const right = romePixelToHex(centre.x + DAWN_COL_PITCH, centre.y + DAWN_ROW_PITCH / 2);
    assert.equal(right.col, 5);
  });

  it("covers the picture with a few hundred tiles", () => {
    const tiles = romeTiles();
    assert.equal(tiles.length, 20 * 18);
    assert.ok(tiles.every((tile) => isRomeTile(tile.col, tile.row)));
    assert.equal(isRomeTile(99, 0), false);
    // The board reaches past both edges, so no strip of map is unclickable.
    const xs = tiles.map((tile) => romeHexCenter(tile.col, tile.row).x);
    const ys = tiles.map((tile) => romeHexCenter(tile.col, tile.row).y);
    assert.ok(Math.min(...xs) <= DAWN_OF_ROME_MAP.hexWidth / 2);
    assert.ok(Math.max(...xs) >= DAWN_OF_ROME_MAP.width - DAWN_OF_ROME_MAP.hexWidth / 2);
    assert.ok(Math.min(...ys) <= 0);
    assert.ok(Math.max(...ys) >= DAWN_OF_ROME_MAP.height);
  });

  it("draws a flat-top hexagon of the measured size", () => {
    const points = romeHexPolygon(2, 2).split(" ").map((pair) => pair.split(",").map(Number));
    assert.equal(points.length, 6);
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - DAWN_OF_ROME_MAP.hexWidth) < 0.2);
    assert.ok(Math.abs(Math.max(...ys) - Math.min(...ys) - DAWN_OF_ROME_MAP.hexHeight) < 0.2);
    // Flat above and below: two corners share the top edge, two the bottom.
    assert.equal(ys.filter((y) => y === Math.min(...ys)).length, 2);
    assert.equal(ys.filter((y) => y === Math.max(...ys)).length, 2);
    // Pointed left and right: one corner each.
    assert.equal(xs.filter((x) => x === Math.min(...xs)).length, 1);
    assert.equal(xs.filter((x) => x === Math.max(...xs)).length, 1);
  });

  it("knows its six territory colours", () => {
    assert.equal(DAWN_TONES.length, 6);
    assert.equal(isDawnTone(1), true);
    assert.equal(isDawnTone(7), false);
  });
});
