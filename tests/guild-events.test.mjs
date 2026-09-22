import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  currentEventDayIndex,
  hoursUntilBerlinMidnight,
  pledgeCoverage,
  seriesScore,
  scoreGap,
} from "../lib/content/guild-events.ts";

describe("guild event planning helpers", () => {
  it("computes the score gap we still need to close", () => {
    assert.equal(scoreGap(100, 150), 50);
    assert.equal(scoreGap(200, 150), 0);
  });

  it("sums ready and waiting pledges for coverage", () => {
    const covered = pledgeCoverage(100, 250, [
      { amount: 100, status: "ready" },
      { amount: 60, status: "waiting" },
      { amount: 999, status: "spent" },
    ]);
    assert.equal(covered.gap, 150);
    assert.equal(covered.available, 160);
    assert.equal(covered.covers, true);

    const short = pledgeCoverage(0, 100, [{ amount: 40, status: "ready" }]);
    assert.equal(short.covers, false);
  });

  it("counts series wins and losses", () => {
    assert.deepEqual(
      seriesScore([{ result: "won" }, { result: "lost" }, { result: "pending" }]),
      { won: 1, lost: 1 },
    );
  });

  it("picks the first pending day as current", () => {
    assert.equal(
      currentEventDayIndex(3, [
        { day_index: 1, result: "won" },
        { day_index: 2, result: "pending" },
      ]),
      2,
    );
    assert.equal(currentEventDayIndex(3, [{ day_index: 1, result: "won" }]), 2);
    assert.equal(currentEventDayIndex(3, []), 1);
  });

  it("reports hours until Berlin midnight as a finite countdown", () => {
    const { hours, minutes, ms } = hoursUntilBerlinMidnight(new Date("2026-06-15T12:00:00.000Z"));
    assert.ok(ms > 0);
    assert.ok(hours >= 0 && hours < 24);
    assert.ok(minutes >= 0 && minutes < 60);
    assert.equal(hours * 3_600_000 + minutes * 60_000 <= ms + 60_000, true);
  });
});
