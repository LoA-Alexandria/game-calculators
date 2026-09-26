import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DAWN_OF_ROME_MAP,
  ROME_MAPS,
  ROME_MAP_VARIANTS,
  isRomeClickable,
  isRomeMapVariant,
  romeBasePoints,
  romeFillTiles,
  romeHexCenter,
  romeNamedPlaces,
  romePixelToHex,
  romeTiles,
} from "../lib/content/dawn-of-rome-map.ts";
import { ROME_STRUCTURES } from "../lib/content/dawn-of-rome-tile-data.ts";

describe("the two pictures of one board", () => {
  it("knows both, and nothing else", () => {
    assert.deepEqual([...ROME_MAP_VARIANTS], ["dawn-of-rome", "crown-of-the-nile"]);
    assert.equal(isRomeMapVariant("crown-of-the-nile"), true);
    assert.equal(isRomeMapVariant("trials-of-odin"), false);
  });

  it("gives them the same tiles, so a guild's territory survives the switch", () => {
    // The lattice is the board; only the drawing differs.
    assert.equal(romeFillTiles("all").length, 457);
    assert.equal(romeTiles().length, 29 * 28);
  });

  it("draws column 0 at the other end of the mirrored picture", () => {
    const left = romeHexCenter(0, 5, "dawn-of-rome");
    const right = romeHexCenter(0, 5, "crown-of-the-nile");
    assert.ok(left.x < DAWN_OF_ROME_MAP.width / 2, "Rome draws it on the left");
    assert.ok(right.x > DAWN_OF_ROME_MAP.width / 2, "the Nile draws it on the right");
    assert.equal(
      Math.round(romeHexCenter(DAWN_OF_ROME_MAP.maxCol, 5, "crown-of-the-nile").x),
      Math.round(ROME_MAPS["crown-of-the-nile"].originX),
    );
  });

  it("finds its way back from a pixel on either picture", () => {
    for (const variant of ROME_MAP_VARIANTS) {
      for (const tile of [{ col: 0, row: 0 }, { col: 14, row: 12 }, { col: 28, row: 20 }]) {
        const centre = romeHexCenter(tile.col, tile.row, variant);
        assert.deepEqual(romePixelToHex(centre.x, centre.y, variant), tile, variant);
      }
    }
  });

  it("keeps every hex inside the picture it is drawn on", () => {
    for (const variant of ROME_MAP_VARIANTS) {
      const map = ROME_MAPS[variant];
      for (const { col, row } of romeTiles()) {
        if (!isRomeClickable(col, row)) continue;
        const { x, y } = romeHexCenter(col, row, variant);
        assert.ok(x > 0 && x < map.width, `${variant} ${col},${row} x=${x}`);
        assert.ok(y > 0 && y < map.height, `${variant} ${col},${row} y=${y}`);
      }
    }
  });
});

describe("what the two pictures call their places", () => {
  it("names the same places on both", () => {
    const named = ROME_STRUCTURES.filter((structure) => structure.name);
    assert.equal(named.length, 22);
    for (const structure of named) {
      assert.ok(structure.nileName, `${structure.name} has no Egyptian name`);
    }
    for (const structure of ROME_STRUCTURES) {
      if (structure.kind === "home") {
        assert.equal(structure.name, undefined, "an outpost carries the guild's own name");
      }
    }
  });

  it("writes them in different spots on the two pictures", () => {
    const rome = romeNamedPlaces("dawn-of-rome");
    const nile = romeNamedPlaces("crown-of-the-nile");
    assert.equal(rome.length, nile.length);
    // Alexandria sits where Rome does, because the middle is the middle.
    const middle = (places) => places.find(({ structure }) => structure.kind === "rome").point;
    assert.ok(Math.abs(middle(rome).x - middle(nile).x) < 1);
    // A place off to one side swaps sides.
    const ostia = rome.find(({ structure }) => structure.name === "ostia").point;
    const plinthine = nile.find(({ structure }) => structure.name === "ostia").point;
    assert.ok(ostia.x < 40 && plinthine.x > 60, `${ostia.x} / ${plinthine.x}`);
  });
});

describe("the six outposts", () => {
  it("come from the places themselves, in slot order", () => {
    for (const variant of ROME_MAP_VARIANTS) {
      const points = romeBasePoints(variant);
      assert.equal(points.length, 6);
      for (const point of points) {
        assert.ok(point.x > 0 && point.x < 100, `${variant} x=${point.x}`);
        assert.ok(point.y > 0 && point.y < 100, `${variant} y=${point.y}`);
      }
      // Slot 1 is the one at the top, slot 6 the one at the bottom.
      assert.ok(points[0].y < 15, `${variant} slot 1 sits at the top`);
      assert.ok(points[5].y > 85, `${variant} slot 6 sits at the bottom`);
    }
  });

  it("puts slot 2 on opposite sides of the two pictures", () => {
    assert.ok(romeBasePoints("dawn-of-rome")[1].x < 20);
    assert.ok(romeBasePoints("crown-of-the-nile")[1].x > 80);
  });
});
