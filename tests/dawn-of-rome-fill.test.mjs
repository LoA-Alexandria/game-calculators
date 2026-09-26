import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DAWN_OF_ROME_MAP,
  isRomeClickable,
  romeFillTiles,
  romeHexCenter,
  romeStructureAt,
  romeTiles,
} from "../lib/content/dawn-of-rome-map.ts";
import { ROME_STRUCTURES } from "../lib/content/dawn-of-rome-tile-data.ts";

const key = ({ col, row }) => `${col},${row}`;
const clickable = romeTiles().filter((tile) => isRomeClickable(tile.col, tile.row));

describe("the quick fills", () => {
  it("takes the whole clickable board and nothing else", () => {
    const all = romeFillTiles("all");
    assert.equal(all.length, clickable.length);
    for (const tile of all) assert.equal(isRomeClickable(tile.col, tile.row), true);
  });

  it("splits the board in two without losing or sharing a hex", () => {
    for (const [a, b] of [["west", "east"], ["north", "south"]]) {
      const left = romeFillTiles(a).map(key);
      const right = romeFillTiles(b).map(key);
      assert.equal(new Set([...left, ...right]).size, clickable.length, `${a}+${b} covers the board`);
      assert.equal(left.filter((k) => right.includes(k)).length, 0, `${a} and ${b} never share a hex`);
      assert.ok(left.length > clickable.length * 0.3, `${a} is a real half`);
      assert.ok(right.length > clickable.length * 0.3, `${b} is a real half`);
    }
  });

  it("never splits a structure across a half", () => {
    for (const half of ["west", "east", "north", "south"]) {
      const taken = new Set(romeFillTiles(half).map(key));
      for (const structure of ROME_STRUCTURES) {
        const inside = structure.tiles.filter(([col, row]) => taken.has(`${col},${row}`));
        assert.ok(
          inside.length === 0 || inside.length === structure.tiles.length,
          `${half} took ${inside.length} of ${structure.tiles.length} hexes of a ${structure.kind}`,
        );
      }
    }
  });

  it("puts a structure on the side its own middle is on", () => {
    // Rome straddles the middle; it belongs to whichever half its centre is in.
    const rome = ROME_STRUCTURES.find((s) => s.kind === "rome");
    const west = new Set(romeFillTiles("west").map(key));
    const east = new Set(romeFillTiles("east").map(key));
    const inWest = rome.tiles.some(([col, row]) => west.has(`${col},${row}`));
    const inEast = rome.tiles.some(([col, row]) => east.has(`${col},${row}`));
    assert.ok(inWest !== inEast, "Rome goes to exactly one side");
    assert.ok(
      rome.tiles.some(([col, row]) => romeHexCenter(col, row).x >= DAWN_OF_ROME_MAP.width / 2)
        && rome.tiles.some(([col, row]) => romeHexCenter(col, row).x < DAWN_OF_ROME_MAP.width / 2),
      "and it really does straddle the middle",
    );
  });

  it("only ever hands back hexes that belong to the board", () => {
    for (const half of ["all", "west", "east", "north", "south"]) {
      for (const tile of romeFillTiles(half)) {
        const structure = romeStructureAt(tile.col, tile.row);
        assert.ok(structure === null || structure.tiles.length > 0);
      }
    }
  });
});
