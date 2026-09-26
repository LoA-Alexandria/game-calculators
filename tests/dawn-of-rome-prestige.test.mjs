import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ROME_PRESTIGE_PER_MINUTE,
  romePrestigeBoard,
  romePrestigeFor,
  romePrestigeOver,
} from "../lib/content/dawn-of-rome-prestige.ts";
import { ROME_STRUCTURES } from "../lib/content/dawn-of-rome-tile-data.ts";
import { romePlaceKind, romeTiles, romeTileKind } from "../lib/content/dawn-of-rome-map.ts";

const structure = (kind) => ROME_STRUCTURES.find((s) => s.kind === kind);
const hexesOf = (kind, tone) => structure(kind).tiles.map(([q, r]) => ({ q, r, tone }));
const plain = romeTiles().filter((tile) => romeTileKind(tile.col, tile.row) === "plain");

describe("what kind of place a hex is", () => {
  it("names the structure a hex belongs to", () => {
    for (const s of ROME_STRUCTURES) {
      for (const [col, row] of s.tiles) assert.equal(romePlaceKind(col, row), s.kind);
    }
  });

  it("calls open board land plain, and blocked land nothing", () => {
    assert.equal(romePlaceKind(plain[0].col, plain[0].row), "plain");
    assert.equal(romePlaceKind(-5, -5), null);
  });
});

describe("prestige a minute", () => {
  it("pays an outpost once, not once per hex", () => {
    const tally = romePrestigeFor(hexesOf("home", 1), 1);
    assert.equal(tally.hexes, 4);
    assert.deepEqual(
      tally.lines.map((line) => [line.kind, line.held, line.total]),
      [["home", 1, 400]],
    );
    assert.equal(tally.perMinute, 400);
    assert.equal(tally.incomplete, false);
  });

  it("adds the places up", () => {
    const painted = [...hexesOf("home", 1), ...hexesOf("large", 1)];
    const tally = romePrestigeFor(painted, 1);
    assert.equal(tally.perMinute, 400 + 360);
    assert.equal(tally.hexes, 8);
  });

  it("counts open land by the hex", () => {
    const painted = plain.slice(0, 5).map(({ col, row }) => ({ q: col, r: row, tone: 2 }));
    const tally = romePrestigeFor(painted, 2);
    assert.deepEqual(
      tally.lines.map((line) => [line.kind, line.held]),
      [["plain", 5]],
    );
  });

  it("says so when a rate is still missing instead of counting it as nothing", () => {
    assert.equal(ROME_PRESTIGE_PER_MINUTE.rome, null);
    const tally = romePrestigeFor(hexesOf("rome", 1), 1);
    assert.equal(tally.incomplete, true);
    assert.equal(tally.lines[0].total, null);
    assert.equal(tally.perMinute, 0);
  });

  it("ignores hexes another guild holds", () => {
    const painted = [...hexesOf("home", 1), ...hexesOf("large", 3)];
    assert.equal(romePrestigeFor(painted, 1).perMinute, 400);
    assert.equal(romePrestigeFor(painted, 3).perMinute, 360);
  });

  it("does not pay twice for a half-painted group left over from an older board", () => {
    const [first, second] = structure("home").tiles;
    const painted = [
      { q: first[0], r: first[1], tone: 1 },
      { q: second[0], r: second[1], tone: 1 },
    ];
    assert.equal(romePrestigeFor(painted, 1).lines[0].held, 1);
  });
});

describe("the board of guilds", () => {
  it("ranks the tones by what they earn", () => {
    const painted = [
      ...hexesOf("large", 3),
      ...hexesOf("home", 1),
      ...hexesOf("medium", 5),
    ];
    const board = romePrestigeBoard(painted);
    assert.deepEqual(board.map((tally) => tally.tone), [1, 3, 5]);
    assert.equal(board[0].perMinute, 400);
    assert.equal(board[2].incomplete, true, "the round city has no rate yet");
  });

  it("leaves out tones that hold nothing", () => {
    assert.deepEqual(romePrestigeBoard([]), []);
    assert.deepEqual(romePrestigeBoard([{ q: 0, r: 0, tone: 0 }]), []);
  });
});

describe("prestige over time", () => {
  it("multiplies out and rounds", () => {
    assert.equal(romePrestigeOver(400, 90), 36000);
    assert.equal(romePrestigeOver(360, 0.5), 180);
  });

  it("never counts backwards", () => {
    assert.equal(romePrestigeOver(400, -5), 0);
    assert.equal(romePrestigeOver(400, Number.NaN), 0);
  });
});
