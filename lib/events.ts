/**
 * Recurring game events.
 *
 * Pure date arithmetic, kept out of the interface so it can be tested: an
 * event's schedule is a rule, and "what is running right now" has to be derived
 * from it rather than written down by hand and left to go stale.
 *
 * Everything works in UTC. Game events are announced in one timezone for the
 * whole server, so deriving occurrences from the reader's local clock would
 * show different answers to different people.
 */

/** What kind of event this is. Drives colour and grouping in the interface. */
export const EVENT_KINDS = ["main", "routine", "ladder"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export function isEventKind(value: unknown): value is EventKind {
  return typeof value === "string" && (EVENT_KINDS as readonly string[]).includes(value);
}

/**
 * How an event repeats.
 *
 * - `once`     — a single occurrence at `start`.
 * - `weekly`   — every `interval` weeks, on `weekdays` (0 = Sunday).
 * - `monthly`  — every `interval` months, on `dayOfMonth`. A day past the end
 *                of a shorter month is clamped to that month's last day, so
 *                "the 31st" still fires in February.
 */
export type Recurrence =
  | { type: "once" }
  | { type: "weekly"; interval: number; weekdays: number[] }
  | { type: "monthly"; interval: number; dayOfMonth: number };

export type GameEvent = {
  id: string;
  kind: EventKind;
  /** ISO instant of the first occurrence's start, e.g. "2026-09-14T12:00:00Z". */
  start: string;
  /** How long one occurrence lasts, in hours. */
  durationHours: number;
  recurrence: Recurrence;
  /** ISO date after which the event no longer repeats. Optional. */
  until?: string;
};

/**
 * One concrete run of an event.
 *
 * Generic over the event type so the concrete entry — with its name and
 * summary — survives the trip through the schedule functions instead of being
 * widened back to a bare `GameEvent`.
 */
export type Occurrence<E extends GameEvent = GameEvent> = { event: E; start: Date; end: Date };

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function addMonthsClamped(from: Date, months: number, dayOfMonth: number): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + months;
  // day 0 of the following month is the last day of this one
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, lastDay);
  return new Date(Date.UTC(year, month, day, from.getUTCHours(), from.getUTCMinutes()));
}

/**
 * Every occurrence overlapping [from, to], sorted by start.
 *
 * An occurrence counts as overlapping when any part of it falls inside the
 * window, so a week-long event still shows up on a day in the middle of it.
 */
export function occurrencesInRange<E extends GameEvent>(
  events: readonly E[],
  from: Date,
  to: Date,
): Occurrence<E>[] {
  if (to.getTime() < from.getTime()) throw new Error("The range ends before it starts.");

  const found: Occurrence<E>[] = [];

  for (const event of events) {
    const first = new Date(event.start);
    if (Number.isNaN(first.getTime())) throw new Error(`Event ${event.id} has an unreadable start.`);
    if (event.durationHours <= 0) throw new Error(`Event ${event.id} must last longer than zero hours.`);

    const length = event.durationHours * HOUR;
    const limit = event.until ? new Date(event.until).getTime() : Infinity;
    const push = (start: Date) => {
      const startedAt = start.getTime();
      if (startedAt > limit) return false;
      const endsAt = startedAt + length;
      if (endsAt >= from.getTime() && startedAt <= to.getTime()) {
        found.push({ event, start, end: new Date(endsAt) });
      }
      return startedAt <= to.getTime();
    };

    if (event.recurrence.type === "once") {
      push(first);
      continue;
    }

    if (event.recurrence.type === "weekly") {
      const { interval, weekdays } = event.recurrence;
      if (interval < 1) throw new Error(`Event ${event.id} repeats less than every week.`);
      if (weekdays.length === 0) throw new Error(`Event ${event.id} has no weekday to repeat on.`);

      // Walk cycle by cycle from the first week, stopping once past the window.
      const cycle = interval * 7 * DAY;
      const weekStart = first.getTime() - first.getUTCDay() * DAY;
      const firstCycle = Math.max(0, Math.floor((from.getTime() - length - weekStart) / cycle));

      for (let index = firstCycle; ; index += 1) {
        const base = weekStart + index * cycle;
        if (base > to.getTime() + cycle) break;
        let any = false;
        for (const weekday of [...weekdays].sort((a, b) => a - b)) {
          const start = new Date(base + weekday * DAY);
          start.setUTCHours(first.getUTCHours(), first.getUTCMinutes(), 0, 0);
          if (start.getTime() < first.getTime()) continue;
          if (push(start)) any = true;
        }
        if (!any && base > to.getTime()) break;
      }
      continue;
    }

    const { interval, dayOfMonth } = event.recurrence;
    if (interval < 1) throw new Error(`Event ${event.id} repeats less than every month.`);
    for (let index = 0; ; index += 1) {
      const start = addMonthsClamped(first, index * interval, dayOfMonth);
      if (start.getTime() > to.getTime() + 62 * DAY) break;
      if (!push(start) && start.getTime() > to.getTime()) break;
      if (index > 400) break; // guard against a rule that never advances
    }
  }

  return found.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Occurrences running at `at` — what the overview calls "live now". */
export function activeAt<E extends GameEvent>(events: readonly E[], at: Date): Occurrence<E>[] {
  return occurrencesInRange(events, at, at);
}

/** The next occurrences starting after `at`, soonest first. */
export function upcomingAfter<E extends GameEvent>(
  events: readonly E[],
  at: Date,
  days = 60,
  limit = 5,
): Occurrence<E>[] {
  const to = new Date(at.getTime() + days * DAY);
  return occurrencesInRange(events, at, to)
    .filter((occurrence) => occurrence.start.getTime() > at.getTime())
    .slice(0, limit);
}

/** UTC calendar-day key, for grouping occurrences into a month grid. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Every day an occurrence covers, as `dayKey`s — a three-day event marks all
 * three days in the calendar, not just the day it began.
 */
export function daysCovered(occurrence: Occurrence): string[] {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(
    occurrence.start.getUTCFullYear(),
    occurrence.start.getUTCMonth(),
    occurrence.start.getUTCDate(),
  ));
  // strictly less than: a run ending exactly at 00:00 does not cover that day
  while (cursor.getTime() < occurrence.end.getTime()) {
    keys.push(dayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

/** The 42-day grid (six weeks) covering a month, starting on Monday. */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(first.getTime() - offset * DAY);
  return Array.from({ length: 42 }, (_, index) => new Date(start.getTime() + index * DAY));
}
