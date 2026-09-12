"use client";

import { useMemo, useState } from "react";
import { EVENTS, type EventEntry } from "../../lib/content/events";
import {
  dayKey,
  daysCovered,
  monthGrid,
  occurrencesInRange,
  type EventKind,
  type Occurrence,
} from "../../lib/events";
import { useLocale } from "./LocaleProvider";
import { ChevronIcon } from "./Icons";

/** Stable stand-in used only until the real clock arrives. */
const FALLBACK_MONTH = new Date(Date.UTC(2026, 8, 1));

export function kindLabel(kind: EventKind, t: ReturnType<typeof useLocale>["t"]): string {
  if (kind === "main") return t.events.kindMain;
  if (kind === "routine") return t.events.kindRoutine;
  return t.events.kindLadder;
}

/** Occurrences grouped by the UTC day they cover, for a whole month grid. */
export function useMonthOccurrences(days: Date[]) {
  return useMemo(() => {
    if (days.length === 0) return new Map<string, Occurrence<EventEntry>[]>();
    const from = days[0];
    const to = new Date(days[days.length - 1].getTime() + 24 * 3_600_000 - 1);
    const byDay = new Map<string, Occurrence<EventEntry>[]>();
    for (const occurrence of occurrencesInRange(EVENTS, from, to)) {
      for (const key of daysCovered(occurrence)) {
        const list = byDay.get(key);
        if (list) list.push(occurrence);
        else byDay.set(key, [occurrence]);
      }
    }
    return byDay;
  }, [days]);
}

/**
 * A month grid with a dot per event kind on each day.
 *
 * `compact` is the sidebar version: smaller cells, no day selection, no
 * weekday header beyond a single letter.
 */
export function MonthCalendar({
  today,
  compact = false,
  selected,
  onSelect,
}: {
  /** The reader's current day, or null before hydration. */
  today: Date | null;
  compact?: boolean;
  selected?: string | null;
  onSelect?: (key: string) => void;
}) {
  const { t, locale } = useLocale();
  const [offset, setOffset] = useState(0);

  const shown = useMemo(() => {
    // before hydration there is no clock; show a fixed month rather than one
    // that differs between the exported HTML and the browser
    const at = today ?? FALLBACK_MONTH;
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + offset, 1));
  }, [today, offset]);
  const days = useMemo(
    () => monthGrid(shown.getUTCFullYear(), shown.getUTCMonth()),
    [shown],
  );
  const byDay = useMonthOccurrences(days);

  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(shown);
  const weekdayName = new Intl.DateTimeFormat(locale, { weekday: compact ? "narrow" : "short", timeZone: "UTC" });
  const todayKey = today ? dayKey(today) : null;

  return (
    <div className={compact ? "calendar calendar-compact" : "calendar"}>
      <div className="calendar-head">
        <button
          type="button"
          className="calendar-step"
          aria-label={t.events.previousMonth}
          onClick={() => setOffset((value) => value - 1)}
        >
          <ChevronIcon className="icon icon-sm calendar-prev" />
        </button>
        <strong>{monthName}</strong>
        <button
          type="button"
          className="calendar-step"
          aria-label={t.events.nextMonth}
          onClick={() => setOffset((value) => value + 1)}
        >
          <ChevronIcon className="icon icon-sm" />
        </button>
      </div>

      <div className="calendar-grid" role="grid">
        {days.slice(0, 7).map((day) => (
          <span className="calendar-weekday" key={`w-${dayKey(day)}`} aria-hidden="true">
            {weekdayName.format(day)}
          </span>
        ))}
        {days.map((day) => {
          const key = dayKey(day);
          const occurrences = byDay.get(key) ?? [];
          const outside = day.getUTCMonth() !== shown.getUTCMonth();
          const kinds = [...new Set(occurrences.map((o) => o.event.kind))];
          const classes = [
            "calendar-day",
            outside ? "is-outside" : "",
            key === todayKey ? "is-today" : "",
            key === selected ? "is-selected" : "",
            occurrences.length > 0 ? "has-events" : "",
          ].filter(Boolean).join(" ");

          const label = `${new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(day)}${
            occurrences.length ? ` — ${occurrences.map((o) => o.event.name(t)).join(", ")}` : ""
          }`;

          if (!onSelect) {
            return (
              <span className={classes} key={key} title={label}>
                <span className="calendar-date">{day.getUTCDate()}</span>
                <span className="calendar-dots" aria-hidden="true">
                  {kinds.map((kind) => <i className={`dot dot-${kind}`} key={kind} />)}
                </span>
              </span>
            );
          }

          return (
            <button
              type="button"
              className={classes}
              key={key}
              aria-label={label}
              aria-pressed={key === selected}
              onClick={() => onSelect(key)}
            >
              <span className="calendar-date">{day.getUTCDate()}</span>
              <span className="calendar-dots" aria-hidden="true">
                {kinds.map((kind) => <i className={`dot dot-${kind}`} key={kind} />)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="calendar-legend">
        {(["main", "routine", "ladder"] as const).map((kind) => (
          <span key={kind}>
            <i className={`dot dot-${kind}`} aria-hidden="true" />
            {kindLabel(kind, t)}
          </span>
        ))}
      </div>
    </div>
  );
}
