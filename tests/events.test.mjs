import assert from "node:assert/strict";
import test from "node:test";

import {
  activeAt,
  daysCovered,
  dayKey,
  monthGrid,
  occurrencesInRange,
  upcomingAfter,
} from "../lib/events.ts";

/** Monday 2026-09-14, 12:00 UTC. */
const MONDAY = "2026-09-14T12:00:00Z";

const weekly = {
  id: "weekly",
  kind: "routine",
  start: MONDAY,
  durationHours: 6,
  recurrence: { type: "weekly", interval: 1, weekdays: [1] },
};

test("repeats weekly on the chosen weekday", () => {
  const found = occurrencesInRange(
    [weekly],
    new Date("2026-09-14T00:00:00Z"),
    new Date("2026-10-05T23:59:59Z"),
  );
  assert.deepEqual(
    found.map((occurrence) => occurrence.start.toISOString()),
    [
      "2026-09-14T12:00:00.000Z",
      "2026-09-21T12:00:00.000Z",
      "2026-09-28T12:00:00.000Z",
      "2026-10-05T12:00:00.000Z",
    ],
  );
});

test("never starts an occurrence before the event's own start", () => {
  const found = occurrencesInRange(
    [weekly],
    new Date("2026-08-01T00:00:00Z"),
    new Date("2026-09-20T00:00:00Z"),
  );
  assert.equal(found.length, 1);
  assert.equal(found[0].start.toISOString(), "2026-09-14T12:00:00.000Z");
});

test("stops repeating after `until`", () => {
  const found = occurrencesInRange(
    [{ ...weekly, until: "2026-09-22T00:00:00Z" }],
    new Date("2026-09-14T00:00:00Z"),
    new Date("2026-10-31T00:00:00Z"),
  );
  assert.equal(found.length, 2);
});

test("counts an occurrence that merely overlaps the window", () => {
  // the window sits entirely inside a six-hour run
  const found = occurrencesInRange(
    [weekly],
    new Date("2026-09-14T14:00:00Z"),
    new Date("2026-09-14T15:00:00Z"),
  );
  assert.equal(found.length, 1);
});

test("handles several weekdays in one week", () => {
  const found = occurrencesInRange(
    [{ ...weekly, recurrence: { type: "weekly", interval: 1, weekdays: [1, 4] } }],
    new Date("2026-09-14T00:00:00Z"),
    new Date("2026-09-20T23:59:59Z"),
  );
  assert.deepEqual(
    found.map((occurrence) => occurrence.start.toISOString().slice(0, 10)),
    ["2026-09-14", "2026-09-17"],
  );
});

test("repeats every other week when the interval is two", () => {
  const found = occurrencesInRange(
    [{ ...weekly, recurrence: { type: "weekly", interval: 2, weekdays: [1] } }],
    new Date("2026-09-14T00:00:00Z"),
    new Date("2026-10-13T00:00:00Z"),
  );
  assert.deepEqual(
    found.map((occurrence) => occurrence.start.toISOString().slice(0, 10)),
    ["2026-09-14", "2026-09-28", "2026-10-12"],
  );
});

test("clamps a monthly day to the end of a shorter month", () => {
  const found = occurrencesInRange(
    [{
      id: "month-end",
      kind: "ladder",
      start: "2026-01-31T09:00:00Z",
      durationHours: 2,
      recurrence: { type: "monthly", interval: 1, dayOfMonth: 31 },
    }],
    new Date("2026-01-01T00:00:00Z"),
    new Date("2026-04-30T23:59:59Z"),
  );
  assert.deepEqual(
    found.map((occurrence) => occurrence.start.toISOString().slice(0, 10)),
    ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"],
  );
});

test("an occurrence starting after the window ends is left out", () => {
  // the April run begins at 09:00, so a window closing at 00:00 excludes it
  const upTo = (end) => occurrencesInRange(
    [{
      id: "month-end",
      kind: "ladder",
      start: "2026-01-31T09:00:00Z",
      durationHours: 2,
      recurrence: { type: "monthly", interval: 1, dayOfMonth: 31 },
    }],
    new Date("2026-04-01T00:00:00Z"),
    new Date(end),
  ).length;
  assert.equal(upTo("2026-04-30T00:00:00Z"), 0);
  assert.equal(upTo("2026-04-30T10:00:00Z"), 1);
});

test("a one-off happens exactly once", () => {
  const found = occurrencesInRange(
    [{ ...weekly, id: "once", recurrence: { type: "once" } }],
    new Date("2026-09-01T00:00:00Z"),
    new Date("2026-12-31T00:00:00Z"),
  );
  assert.equal(found.length, 1);
});

test("reports what is running right now, and nothing after it ends", () => {
  assert.equal(activeAt([weekly], new Date("2026-09-14T15:00:00Z")).length, 1);
  assert.equal(activeAt([weekly], new Date("2026-09-14T19:00:00Z")).length, 0);
  assert.equal(activeAt([weekly], new Date("2026-09-15T12:00:00Z")).length, 0);
});

test("upcoming excludes an occurrence already under way", () => {
  const next = upcomingAfter([weekly], new Date("2026-09-14T15:00:00Z"), 30, 5);
  assert.equal(next[0].start.toISOString(), "2026-09-21T12:00:00.000Z");
});

test("a run spanning midnight marks every day it covers", () => {
  const [occurrence] = occurrencesInRange(
    [{ ...weekly, durationHours: 60 }],
    new Date("2026-09-14T00:00:00Z"),
    new Date("2026-09-14T23:00:00Z"),
  );
  assert.deepEqual(daysCovered(occurrence), ["2026-09-14", "2026-09-15", "2026-09-16"]);
});

test("the month grid is six Monday-first weeks covering the month", () => {
  const grid = monthGrid(2026, 8); // September 2026
  assert.equal(grid.length, 42);
  assert.equal(grid[0].getUTCDay(), 1);
  assert.equal(dayKey(grid[0]), "2026-08-31");
  assert.ok(grid.some((day) => dayKey(day) === "2026-09-30"));
});

test("rejects a backwards range and an impossible duration", () => {
  assert.throws(
    () => occurrencesInRange([weekly], new Date("2026-09-20T00:00:00Z"), new Date("2026-09-10T00:00:00Z")),
    /ends before/,
  );
  assert.throws(
    () => occurrencesInRange([{ ...weekly, durationHours: 0 }], new Date(MONDAY), new Date(MONDAY)),
    /zero hours/,
  );
});
