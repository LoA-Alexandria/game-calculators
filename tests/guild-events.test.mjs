import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  campAttackers,
  campSlots,
  campTargets,
  currentEventDayIndex,
  emptyCamp,
  emptyOrder,
  guildPlanEventDef,
  hoursUntilBerlinMidnight,
  nextCampPriority,
  hornShareTotal,
  setCampPriority,
  pledgeCoverage,
  seriesScore,
  scoreGap,
  ringSpread,
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

  it("gives Dawn of Rome six bases without stock, with hex territory", () => {
    const rome = guildPlanEventDef("dawn-of-rome");
    assert.equal(rome.camps, 6);
    assert.equal(rome.stock, false);
    assert.equal(rome.hexTerritory, true);
  });

  it("fills every slot, so a fresh siege still shows the whole map", () => {
    const slots = campSlots(5, [camp(3, { name: "AZE" })]);
    assert.deepEqual(slots.map((row) => row.slot), [1, 2, 3, 4, 5]);
    assert.equal(slots[2].name, "AZE");
    assert.equal(slots[0].priority, 0, "an untouched camp has no order yet");
  });

  it("orders targets by the officers' order and leaves out our camp", () => {
    const targets = campTargets([
      camp(1, { name: "Dark Legion", is_ours: true, priority: 1 }),
      camp(2, { name: "ATLANTES", priority: 2 }),
      camp(3, { name: "Librarians" }),
      camp(4, { name: "AZE", priority: 1 }),
      camp(5, { name: "al-Ula", priority: 3 }),
    ]);
    assert.deepEqual(targets.map((row) => row.name), ["AZE", "ATLANTES", "al-Ula", "Librarians"]);
  });

  it("hands out the next free order number", () => {
    const camps = [camp(1, { is_ours: true }), camp(2, { priority: 1 }), camp(3, {}), camp(4, { priority: 2 })];
    assert.equal(nextCampPriority(camps), 3);
    assert.equal(nextCampPriority([camp(1, {})]), 1);
  });
});

describe("siege orders", () => {
  const order = (userId, values) => ({ ...emptyOrder(userId), ...values });
  const rows = [
    order("u-1", { attack_target: 2 }),
    order("u-2", { attack_target: 2 }),
    order("u-3", {}),
  ];

  it("lists who an officer sent to a camp", () => {
    assert.deepEqual(campAttackers(2, rows), ["u-1", "u-2"]);
    assert.deepEqual(campAttackers(3, rows), [], "nobody is sent to a camp by default");
  });
});

describe("horn shares and ring spread", () => {
  const target = (slot, values) => ({ ...emptyCamp(slot), ...values });

  it("adds up the horn shares of the targets only", () => {
    const camps = [
      target(1, { is_ours: true, horn_share: 100 }),
      target(2, { horn_share: 50 }),
      target(3, { horn_share: 25 }),
    ];
    assert.equal(hornShareTotal(camps), 75);
    assert.equal(hornShareTotal([]), 0);
  });

  it("clamps a share that was stored out of range", () => {
    assert.equal(hornShareTotal([target(1, { horn_share: 140 }), target(2, { horn_share: -20 })]), 100);
  });

  it("tells one camp from the whole field", () => {
    const one = [target(1, { ring_focus: true }), target(2, {}), target(3, {})];
    const all = [target(1, { ring_focus: true }), target(2, { ring_focus: true })];
    assert.equal(ringSpread([target(1, {}), target(2, {})]), "none");
    assert.equal(ringSpread(one), "one");
    assert.equal(ringSpread(all), "all");
  });
});

describe("setting the target order on the map", () => {
  const board = (...priorities) =>
    priorities.map((priority, index) => ({
      slot: index + 1,
      name: `Camp ${index + 1}`,
      server_name: "",
      is_ours: false,
      priority,
      note: "",
    }));

  it("gives an unnumbered camp a place and pushes the rest down", () => {
    const changed = setCampPriority(board(1, 2, 0), 3, 1);
    assert.deepEqual(
      changed.map((camp) => [camp.slot, camp.priority]).sort(),
      [[1, 2], [2, 3], [3, 1]],
    );
  });

  it("swaps two camps that both have a number", () => {
    const changed = setCampPriority(board(1, 2, 3), 3, 1);
    assert.deepEqual(
      changed.map((camp) => [camp.slot, camp.priority]).sort(),
      [[1, 3], [3, 1]],
    );
  });

  it("closes the gap when a camp leaves the order", () => {
    const changed = setCampPriority(board(1, 2, 3), 1, 0);
    assert.deepEqual(
      changed.map((camp) => [camp.slot, camp.priority]).sort(),
      [[1, 0], [2, 1], [3, 2]],
    );
  });

  it("never numbers past the end of the list, and leaves our own camp alone", () => {
    assert.deepEqual(setCampPriority(board(1, 0, 0), 2, 6).find((c) => c.slot === 2).priority, 2);
    const ours = [{ slot: 1, name: "", server_name: "", is_ours: true, priority: 0, note: "" }];
    assert.deepEqual(setCampPriority(ours, 1, 1), []);
  });
});
