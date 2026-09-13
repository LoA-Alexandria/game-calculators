"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EVENTS, type EventEntry } from "../../lib/content/events";
import {
  activeAt,
  dayKey,
  daysCovered,
  monthGrid,
  occurrencesInRange,
  upcomingAfter,
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
 * `compact` is a denser grid: smaller cells, no day selection, no weekday
 * header beyond a single letter.
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

/**
 * Live and upcoming events plus the month grid, for the overview under the
 * site stats. The sidebar used to hold a three-row list; that belonged next
 * to the counts once the main column had room for a real calendar.
 */
export function OverviewAgenda({ now }: { now: Date | null }) {
  const { t, locale } = useLocale();
  const live = now ? activeAt(EVENTS, now) : [];
  const next = now ? upcomingAfter(EVENTS, now, 21, 5) : [];
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

  return (
    <section className="section overview-events" aria-label={t.nav.events}>
      <div className="section-heading">
        <h2>{t.nav.events}</h2>
        <Link href="/events/">
          {t.events.openCalendar} <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="events-layout">
        <section className="panel">
          <h2>{t.events.upcoming}</h2>
          {now === null ? (
            <p className="assumption" style={{ margin: 0 }}>…</p>
          ) : live.length === 0 && next.length === 0 ? (
            <p className="assumption" style={{ margin: 0 }}>{t.events.sidebarEmpty}</p>
          ) : (
            <ul className="event-list">
              {live.map((occurrence) => (
                <li
                  className={`event-row event-${occurrence.event.kind}`}
                  key={`${occurrence.event.id}-${occurrence.start.toISOString()}-live`}
                >
                  <span className={`dot dot-${occurrence.event.kind}`} aria-hidden="true" />
                  <div className="event-body">
                    <strong>{occurrence.event.name(t)}</strong>
                    <p>{occurrence.event.summary(t)}</p>
                    <p className="mono">{t.events.liveNow}</p>
                  </div>
                </li>
              ))}
              {next.map((occurrence) => (
                <li
                  className={`event-row event-${occurrence.event.kind}`}
                  key={`${occurrence.event.id}-${occurrence.start.toISOString()}`}
                >
                  <span className={`dot dot-${occurrence.event.kind}`} aria-hidden="true" />
                  <div className="event-body">
                    <strong>{occurrence.event.name(t)}</strong>
                    <p>{occurrence.event.summary(t)}</p>
                    <p className="mono">{when.format(occurrence.start)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <h2>{t.events.calendar}</h2>
          <MonthCalendar today={now} />
          <p className="assumption">{t.events.timesAreUtc}</p>
        </section>
      </div>
    </section>
  );
}
