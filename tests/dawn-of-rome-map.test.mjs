import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DAWN_COL_PITCH,
  DAWN_OF_ROME_BASES,
  DAWN_OF_ROME_MAP,
  DAWN_ROW_PITCH,
  DAWN_TONES,
  isDawnTone,
  isRomeClickable,
  isRomeTile,
  romeHexCenter,
  romeHexPolygon,
  romePaintTargets,
  romePixelToHex,
  romeTileKind,
  romeTiles,
} from "../lib/content/dawn-of-rome-map.ts";
import {
  ROME_BLOCKED_TILES,
  ROME_OUTSIDE_TILES,
  ROME_STRUCTURE_GROUPS,
} from "../lib/content/dawn-of-rome-tile-data.ts";

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
    for (const [col, row] of [[0, 0], [3, 4], [7, 12], [28, 26], [6, 1]]) {
      const centre = romeHexCenter(col, row);
      assert.deepEqual(romePixelToHex(centre.x, centre.y), { col, row });
      // Well inside the tile, towards each side.
      const inX = DAWN_OF_ROME_MAP.hexWidth * 0.3;
      const inY = DAWN_OF_ROME_MAP.hexHeight * 0.4;
      assert.deepEqual(romePixelToHex(centre.x + inX, centre.y), { col, row });
      assert.deepEqual(romePixelToHex(centre.x - inX, centre.y), { col, row });
      assert.deepEqual(romePixelToHex(centre.x, centre.y + inY), { col, row });
      assert.deepEqual(romePixelToHex(centre.x, centre.y - inY), { col, row });
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
    assert.equal(tiles.length, 29 * 28);
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

  it("never hands back a tile keyed on minus zero", () => {
    const left = romePixelToHex(DAWN_OF_ROME_MAP.originX - 1, DAWN_OF_ROME_MAP.originY - 1);
    assert.ok(Object.is(left.col, 0) || left.col !== 0, "col is 0, never -0");
    assert.ok(Object.is(left.row, 0) || left.row !== 0, "row is 0, never -0");
    assert.equal(`${left.col},${left.row}`, "0,0");
  });

  it("knows its six territory colours", () => {
    assert.equal(DAWN_TONES.length, 6);
    assert.equal(isDawnTone(1), true);
    assert.equal(isDawnTone(7), false);
  });

  it("keeps blue and outside tiles from accepting paint", () => {
    assert.ok(ROME_BLOCKED_TILES.length > 50, "blue hexes form the non-clickable set");
    assert.ok(ROME_OUTSIDE_TILES.length > 0);
    for (const [col, row] of ROME_BLOCKED_TILES) {
      assert.equal(romeTileKind(col, row), "blocked");
      assert.equal(isRomeClickable(col, row), false);
      assert.deepEqual(romePaintTargets(col, row), []);
    }
    for (const [col, row] of ROME_OUTSIDE_TILES) {
      assert.equal(romeTileKind(col, row), "outside");
      assert.equal(isRomeClickable(col, row), false);
    }
    // Red hexes stay paintable; blue mountains/coast/volcano do not.
    const clickable = romeTiles().filter((tile) => isRomeClickable(tile.col, tile.row));
    assert.ok(clickable.length > 350, "red board must stay clickable");
    assert.ok(clickable.length < 600, "blue hexes must remove a real share of the lattice");
  });

  it("treats each structure group as one paint target", () => {
    assert.ok(ROME_STRUCTURE_GROUPS.length > 0);
    for (const group of ROME_STRUCTURE_GROUPS) {
      assert.ok(group.length >= 1);
      const [col, row] = group[0];
      assert.equal(romeTileKind(col, row), "structure");
      assert.equal(isRomeClickable(col, row), true);
      const targets = romePaintTargets(col, row);
      assert.equal(targets.length, group.length);
      for (const [c, r] of group) {
        assert.ok(targets.some((tile) => tile.col === c && tile.row === r));
      }
    }
  });

  it("paints a plain board tile alone", () => {
    const plain = romeTiles().find(
      (tile) => romeTileKind(tile.col, tile.row) === "plain",
    );
    assert.ok(plain);
    assert.equal(isRomeClickable(plain.col, plain.row), true);
    assert.deepEqual(romePaintTargets(plain.col, plain.row), [plain]);
  });
});
