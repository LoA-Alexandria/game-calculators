import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  campSlots,
  campTargets,
  campTotals,
  currentEventDayIndex,
  emptyCamp,
  guildPlanEventDef,
  hoursUntilBerlinMidnight,
  nextCampPriority,
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

describe("siege camps", () => {
  const camp = (slot, values) => ({ ...emptyCamp(slot), ...values });

  it("gives Trials of Odin the five camps around Asgard", () => {
    assert.equal(guildPlanEventDef("trials-of-odin").camps, 5);
    assert.equal(guildPlanEventDef("heart-of-gold").camps, undefined);
  });

  it("fills every slot, so a fresh siege still shows the whole map", () => {
    const slots = campSlots(5, [camp(3, { name: "AZE" })]);
    assert.deepEqual(slots.map((row) => row.slot), [1, 2, 3, 4, 5]);
    assert.equal(slots[2].name, "AZE");
    assert.equal(slots[0].progress, 100, "an untouched camp still stands");
  });

  it("orders targets by the officers' order, leaves out our camp, and sinks destroyed ones", () => {
    const targets = campTargets([
      camp(1, { name: "Dark Legion", is_ours: true, priority: 1 }),
      camp(2, { name: "ATLANTES", priority: 2 }),
      camp(3, { name: "Librarians" }),
      camp(4, { name: "AZE", priority: 1 }),
      camp(5, { name: "al-Ula", priority: 3, progress: 0 }),
    ]);
    assert.deepEqual(targets.map((row) => row.name), ["AZE", "ATLANTES", "Librarians", "al-Ula"]);
  });

  it("adds up the rings and horns the plan spends on enemy camps", () => {
    const totals = campTotals([
      camp(1, { is_ours: true, rings: 9, horns: 9 }),
      camp(2, { rings: 2, horns: 40 }),
      camp(3, { rings: 3, horns: 60 }),
    ]);
    assert.deepEqual(totals, { rings: 5, horns: 100 });
  });

  it("hands out the next free order number", () => {
    const camps = [camp(1, { is_ours: true }), camp(2, { priority: 1 }), camp(3, {}), camp(4, { priority: 2 })];
    assert.equal(nextCampPriority(camps), 3);
    assert.equal(nextCampPriority([camp(1, {})]), 1);
  });
});
