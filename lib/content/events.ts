import type { Dictionary } from "../i18n/index.ts";
import type { GameEvent } from "../events.ts";

/**
 * The event schedule.
 *
 * Events live here rather than in a database because the site is a static
 * export: a calendar entry typed into a browser would only exist in that
 * browser. Committing them is what makes them visible to everyone, the same
 * way news entries work.
 *
 * The editor at /events/ produces exactly one of these rows to paste in.
 * When a backend exists this file becomes a table with the same shape — see
 * docs/AUTH-AND-CMS.md.
 *
 * ---------------------------------------------------------------------------
 * THE ENTRIES BELOW ARE EXAMPLES, NOT THE REAL SCHEDULE.
 * Nobody has told me when Pop Epoch's events actually run. Replace the times,
 * weekdays and durations with the real ones before relying on the calendar,
 * and delete this notice when you do.
 * ---------------------------------------------------------------------------
 *
 * Times are UTC. `weekdays` counts Sunday as 0.
 */
export type EventEntry = GameEvent & {
  name: (t: Dictionary) => string;
  summary: (t: Dictionary) => string;
};

export const EVENTS: EventEntry[] = [
  {
    id: "grand-voyage-season",
    kind: "main",
    start: "2026-09-14T12:00:00Z",
    durationHours: 84,
    recurrence: { type: "weekly", interval: 2, weekdays: [1] },
    name: (t) => t.eventEntries.grandVoyage.name,
    summary: (t) => t.eventEntries.grandVoyage.summary,
  },
  {
    id: "red-carpet-night",
    kind: "main",
    start: "2026-09-25T18:00:00Z",
    durationHours: 54,
    recurrence: { type: "monthly", interval: 1, dayOfMonth: 25 },
    name: (t) => t.eventEntries.redCarpet.name,
    summary: (t) => t.eventEntries.redCarpet.summary,
  },
  {
    id: "goddess-offering",
    kind: "routine",
    start: "2026-09-15T06:00:00Z",
    durationHours: 12,
    recurrence: { type: "weekly", interval: 1, weekdays: [2, 5] },
    name: (t) => t.eventEntries.goddessOffering.name,
    summary: (t) => t.eventEntries.goddessOffering.summary,
  },
  {
    id: "irrigation-drive",
    kind: "routine",
    start: "2026-09-17T08:00:00Z",
    durationHours: 24,
    recurrence: { type: "weekly", interval: 1, weekdays: [4] },
    name: (t) => t.eventEntries.irrigationDrive.name,
    summary: (t) => t.eventEntries.irrigationDrive.summary,
  },
  {
    id: "alliance-ladder",
    kind: "ladder",
    start: "2026-09-19T00:00:00Z",
    durationHours: 48,
    recurrence: { type: "weekly", interval: 1, weekdays: [6] },
    name: (t) => t.eventEntries.allianceLadder.name,
    summary: (t) => t.eventEntries.allianceLadder.summary,
  },
  {
    id: "monthly-standings",
    kind: "ladder",
    start: "2026-09-30T20:00:00Z",
    durationHours: 4,
    recurrence: { type: "monthly", interval: 1, dayOfMonth: 31 },
    name: (t) => t.eventEntries.monthlyStandings.name,
    summary: (t) => t.eventEntries.monthlyStandings.summary,
  },
];

/** True while the entries above are still the placeholder schedule. */
export const EVENTS_ARE_PLACEHOLDER = true;
