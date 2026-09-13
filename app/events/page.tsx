"use client";

import { useMemo, useState } from "react";
import { EVENTS, EVENTS_ARE_PLACEHOLDER } from "../../lib/content/events";
import { activeAt, monthGrid, upcomingAfter, type Occurrence } from "../../lib/events";
import type { EventEntry } from "../../lib/content/events";
import { useAuth } from "../components/AuthProvider";
import { kindLabel, MonthCalendar, useMonthOccurrences } from "../components/EventCalendar";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { useNow } from "../components/useNow";
import { PageHead, SectionBanner } from "../components/Ui";
import { EventEditor, type EventEditorTarget } from "./EventEditor";
import { AlertIcon, PenIcon, TrashIcon } from "../components/Icons";

export default function EventsPage() {
  const { t, locale, tf } = useLocale();
  const { allows } = useAuth();
  const now = useNow();
  useDocumentTitle(t.events.title);

  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<EventEditorTarget | null>(null);

  const live = useMemo(() => (now ? activeAt(EVENTS, now) : []), [now]);
  const next = useMemo(() => (now ? upcomingAfter(EVENTS, now, 60, 6) : []), [now]);

  const grid = useMemo(() => {
    const at = now ?? new Date();
    return monthGrid(at.getUTCFullYear(), at.getUTCMonth());
  }, [now]);
  const byDay = useMonthOccurrences(grid);
  const onSelectedDay = selected ? byDay.get(selected) ?? [] : [];

  return (
    <>
      <SectionBanner id="events" />
      <PageHead eyebrow={t.nav.events} title={t.events.title} lede={t.events.lede} />

      {EVENTS_ARE_PLACEHOLDER && (
        <div className="notice notice-warn" style={{ marginBottom: 20 }}>
          <AlertIcon className="icon" />
          <div>
            <strong>{t.events.placeholderTitle}</strong>
            <p>{t.events.placeholderBody}</p>
          </div>
        </div>
      )}

      <div className="events-layout">
        <div>
          <section className="panel">
            <h2>{t.events.liveNow}</h2>
            {now === null ? (
              <p className="assumption" style={{ margin: 0 }}>…</p>
            ) : live.length === 0 ? (
              <p className="assumption" style={{ margin: 0 }}>{t.events.noneRunning}</p>
            ) : (
              <ul className="event-list">
                {live.map((occurrence) => (
                  <EventRow key={`${occurrence.event.id}-${occurrence.start.toISOString()}`} occurrence={occurrence} now={now} live />
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2>{t.events.upcoming}</h2>
            {now === null ? (
              <p className="assumption" style={{ margin: 0 }}>…</p>
            ) : next.length === 0 ? (
              <p className="assumption" style={{ margin: 0 }}>{t.events.noneUpcoming}</p>
            ) : (
              <ul className="event-list">
                {next.map((occurrence) => (
                  <EventRow key={`${occurrence.event.id}-${occurrence.start.toISOString()}`} occurrence={occurrence} now={now} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <div>
          <section className="panel">
            <h2>{t.events.calendar}</h2>
            <MonthCalendar today={now} selected={selected} onSelect={setSelected} />
            <p className="assumption">{t.events.timesAreUtc}</p>
          </section>

          {selected && (
            <section className="panel">
              <h2>
                {tf(t.events.onDay, {
                  day: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" })
                    .format(new Date(`${selected}T12:00:00Z`)),
                })}
              </h2>
              {onSelectedDay.length === 0 ? (
                <p className="assumption" style={{ margin: 0 }}>{t.events.nothingOnDay}</p>
              ) : (
                <ul className="event-list">
                  {onSelectedDay.map((occurrence) => (
                    <EventRow key={`${occurrence.event.id}-${occurrence.start.toISOString()}`} occurrence={occurrence} now={now} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      </div>

      {allows("events.write") && (
        <>
          <section className="panel" style={{ marginTop: 24 }}>
            <h2>{t.events.scheduleTitle}</h2>
            <p>{t.events.scheduleLede}</p>
            {EVENTS.length === 0 ? (
              <p className="assumption" style={{ margin: 0 }}>{t.common.empty}</p>
            ) : (
              <ul className="event-list">
                {EVENTS.map((event) => (
                  <li className={`event-row event-${event.kind}`} key={event.id}>
                    <span className={`dot dot-${event.kind}`} aria-hidden="true" />
                    <div className="event-body">
                      <div className="event-title">
                        <strong>{event.name(t)}</strong>
                        <span className="pill">{kindLabel(event.kind, t)}</span>
                      </div>
                      <p>{event.summary(t)}</p>
                      <div className="event-actions">
                        <button
                          className="small-button"
                          type="button"
                          onClick={() => {
                            setTarget({ event, action: "edit" });
                            window.setTimeout(() => document.getElementById("event-editor")?.scrollIntoView({ block: "start" }), 0);
                          }}
                        >
                          <PenIcon className="icon icon-sm" />
                          {t.events.editEvent}
                        </button>
                        <button
                          className="small-button button-danger"
                          type="button"
                          onClick={() => {
                            setTarget({ event, action: "remove" });
                            window.setTimeout(() => document.getElementById("event-editor")?.scrollIntoView({ block: "start" }), 0);
                          }}
                        >
                          <TrashIcon className="icon icon-sm" />
                          {t.events.removeEvent}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <EventEditor
            key={target ? `${target.action}-${target.event.id}` : "new"}
            target={target}
            onClose={() => setTarget(null)}
          />
        </>
      )}
    </>
  );
}

function EventRow({ occurrence, now, live = false }: { occurrence: Occurrence<EventEntry>; now: Date | null; live?: boolean }) {
  const { t, locale } = useLocale();
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const target = live ? occurrence.end : occurrence.start;
  let phrase = when.format(target);
  if (now) {
    const minutes = Math.round((target.getTime() - now.getTime()) / 60_000);
    const spoken =
      Math.abs(minutes) < 60
        ? relative.format(minutes, "minute")
        : Math.abs(minutes) < 60 * 48
          ? relative.format(Math.round(minutes / 60), "hour")
          : relative.format(Math.round(minutes / 1440), "day");
    phrase = spoken;
  }

  return (
    <li className={`event-row event-${occurrence.event.kind}`}>
      <span className={`dot dot-${occurrence.event.kind}`} aria-hidden="true" />
      <div className="event-body">
        <div className="event-title">
          <strong>{occurrence.event.name(t)}</strong>
          <span className="pill">{kindLabel(occurrence.event.kind, t)}</span>
        </div>
        <p>{occurrence.event.summary(t)}</p>
        <span className="event-when mono">
          {live ? `${t.events.liveNow} · ` : ""}
          {when.format(occurrence.start)}
          {" · "}
          {live ? `${t.events.ends.replace("{when}", phrase)}` : `${t.events.starts.replace("{when}", phrase)}`}
        </span>
      </div>
    </li>
  );
}
