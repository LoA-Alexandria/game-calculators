"use client";

import { useId, useMemo, useState } from "react";
import type { EventEntry } from "../../lib/content/events";
import { EVENT_KINDS, isEventKind, occurrencesInRange, type EventKind, type GameEvent } from "../../lib/events";
import { DEFAULT_LOCALE, dictionaryFiles, getDictionary, mapLocales, type Dictionary } from "../../lib/i18n/index";
import { blankTranslations, textIn, type Translations } from "../../lib/i18n/translations";
import { AllLanguagesToggle, DictionaryBlocks, TranslatedField, useEditorLanguages } from "../components/EditorLanguages";
import { useLocale } from "../components/LocaleProvider";
import { CheckIcon, CopyIcon, InfoIcon } from "../components/Icons";

type RepeatType = "once" | "weekly" | "monthly";

export type EventEditorTarget = {
  event: EventEntry;
  action: "edit" | "remove";
};

function slug(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "new-event";
}

function toDictKey(id: string): string {
  return id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function dictKeyFor(event: EventEntry, t: Dictionary): string {
  const copies = t.eventEntries as Record<string, { name: string; summary: string }>;
  for (const [key, copy] of Object.entries(copies)) {
    if (copy.name === event.name(t) && copy.summary === event.summary(t)) return key;
  }
  return toDictKey(event.id);
}

function isoToLocal(value: string): string {
  return value.slice(0, 16);
}

function isoToDate(value: string | undefined): string {
  return value ? value.slice(0, 10) : "";
}

/**
 * Produces one row for `lib/content/events.ts`, or the notes for removing one.
 *
 * There is nowhere to save an event to: the site is a static export, so an
 * entry typed here would live only in this browser. Committing the generated
 * snippet is what makes the change visible to everyone.
 */
export function EventEditor({
  target = null,
  onClose,
}: {
  target?: EventEditorTarget | null;
  onClose?: () => void;
}) {
  const { t, locale } = useLocale();
  const { languages } = useEditorLanguages({ withDefault: true });
  const ids = useId();
  const editing = target?.action === "edit" ? target.event : null;
  const removing = target?.action === "remove" ? target.event : null;

  const [name, setName] = useState<Translations>(() => (editing ? mapLocales((code) => editing.name(getDictionary(code))) : blankTranslations()));
  const [summary, setSummary] = useState<Translations>(() => (editing ? mapLocales((code) => editing.summary(getDictionary(code))) : blankTranslations()));
  const [kind, setKind] = useState<EventKind>(editing?.kind ?? "routine");
  const [start, setStart] = useState(editing ? isoToLocal(editing.start) : "");
  const [duration, setDuration] = useState(editing ? String(editing.durationHours) : "6");
  const [repeat, setRepeat] = useState<RepeatType>(editing?.recurrence.type ?? "weekly");
  const [interval, setInterval] = useState(
    editing && editing.recurrence.type !== "once" ? String(editing.recurrence.interval) : "1",
  );
  const [weekdays, setWeekdays] = useState<number[]>(
    editing?.recurrence.type === "weekly" ? editing.recurrence.weekdays : [1],
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    editing?.recurrence.type === "monthly" ? String(editing.recurrence.dayOfMonth) : "1",
  );
  const [until, setUntil] = useState(editing ? isoToDate(editing.until) : "");
  const [copied, setCopied] = useState(false);

  const draft = useMemo<GameEvent | null>(() => {
    if (removing || !start) return null;
    const hours = Number(duration);
    if (!Number.isFinite(hours) || hours <= 0) return null;
    const recurrence =
      repeat === "once"
        ? { type: "once" as const }
        : repeat === "weekly"
          ? { type: "weekly" as const, interval: Math.max(1, Number(interval) || 1), weekdays: weekdays.length ? weekdays : [1] }
          : { type: "monthly" as const, interval: Math.max(1, Number(interval) || 1), dayOfMonth: Math.min(31, Math.max(1, Number(dayOfMonth) || 1)) };
    return {
      id: editing?.id ?? slug(name[DEFAULT_LOCALE]),
      kind,
      start: `${start}:00Z`,
      durationHours: hours,
      recurrence,
      ...(until ? { until: `${until}T00:00:00Z` } : {}),
    };
  }, [removing, editing, name, kind, start, duration, repeat, interval, weekdays, dayOfMonth, until]);

  const preview = useMemo(() => {
    if (!draft) return [];
    try {
      const from = new Date(draft.start);
      const to = new Date(from.getTime() + 400 * 24 * 3_600_000);
      return occurrencesInRange([draft], from, to).slice(0, 5);
    } catch {
      return [];
    }
  }, [draft]);

  const dictKey = removing
    ? dictKeyFor(removing, t)
    : editing
      ? dictKeyFor(editing, t)
      : toDictKey(draft?.id ?? slug(name[DEFAULT_LOCALE]));

  const entry = useMemo(() => {
    if (removing) {
      return [
        `Remove event ${JSON.stringify(removing.id)} (${removing.name(t)})`,
        ``,
        `- Delete the object with that id from EVENTS in lib/content/events.ts`,
        `- Delete eventEntries.${dictKey} from ${dictionaryFiles()}`,
      ].join("\n");
    }
    if (!draft) return "";
    const recurrence =
      draft.recurrence.type === "once"
        ? `{ type: "once" }`
        : draft.recurrence.type === "weekly"
          ? `{ type: "weekly", interval: ${draft.recurrence.interval}, weekdays: [${draft.recurrence.weekdays.join(", ")}] }`
          : `{ type: "monthly", interval: ${draft.recurrence.interval}, dayOfMonth: ${draft.recurrence.dayOfMonth} }`;
    return [
      `  {`,
      `    id: ${JSON.stringify(draft.id)},`,
      `    kind: ${JSON.stringify(draft.kind)},`,
      `    start: ${JSON.stringify(draft.start)},`,
      `    durationHours: ${draft.durationHours},`,
      `    recurrence: ${recurrence},`,
      ...(draft.until ? [`    until: ${JSON.stringify(draft.until)},`] : []),
      `    name: (t) => t.eventEntries.${dictKey}.name,`,
      `    summary: (t) => t.eventEntries.${dictKey}.summary,`,
      `  },`,
    ].join("\n");
  }, [removing, draft, dictKey, t]);

  const blocks = useMemo(
    () =>
      removing || !draft
        ? {}
        : mapLocales((code) => [
            `// under eventEntries`,
            `    ${dictKey}: { name: ${JSON.stringify(textIn(name, code) || "…")}, summary: ${JSON.stringify(textIn(summary, code) || "…")} },`,
          ].join("\n")),
    [removing, draft, dictKey, name, summary],
  );

  const weekdayNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, index) =>
      format.format(new Date(Date.UTC(2026, 8, 13 + index))));
  }, [locale]);

  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  const title = removing ? t.events.editorRemoveTitle : editing ? t.events.editorEditTitle : t.events.editorTitle;
  const note = removing ? t.events.editorRemoveNote : editing ? t.events.editorReplaceNote : t.events.editorOutputNote;

  return (
    <section className="panel" id="event-editor" style={{ marginTop: 24 }}>
      <h2>{title}</h2>
      <p>{removing ? t.events.editorRemoveLede : t.events.editorLede}</p>

      <div className="notice notice-info" style={{ marginBottom: 18 }}>
        <InfoIcon className="icon" />
        <div><p>{note}</p></div>
      </div>

      {removing ? (
        <div className="editor-sticky">
          <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>{t.events.editorRemoveOutput}</h3>
          <textarea className="code-out" readOnly value={entry} />
          <div className="form-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={!entry}
              onClick={() => navigator.clipboard?.writeText(entry).then(
                () => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); },
                () => { /* clipboard blocked */ },
              )}
            >
              {copied ? <CheckIcon className="icon" /> : <CopyIcon className="icon" />}
              {copied ? t.editor.copied : t.editor.copy}
            </button>
            {onClose && (
              <button className="button" type="button" onClick={onClose}>{t.events.editorCancel}</button>
            )}
          </div>
        </div>
      ) : (
        <div className="editor-layout">
          <div>
            <div className="form-actions editor-languages-bar">
              <AllLanguagesToggle />
            </div>
            <TranslatedField
              label={t.events.editorName}
              languages={languages}
              get={(code) => name[code]}
              set={(code, value) => setName((current) => ({ ...current, [code]: value }))}
            />
            <TranslatedField
              label={t.events.editorSummary}
              languages={languages}
              get={(code) => summary[code]}
              set={(code, value) => setSummary((current) => ({ ...current, [code]: value }))}
            />
            <div className="input-row">
              <div className="field">
                <label htmlFor={`${ids}-kind`}>{t.events.editorKind}</label>
                <select id={`${ids}-kind`} value={kind} onChange={(e) => { if (isEventKind(e.target.value)) setKind(e.target.value); }}>
                  {EVENT_KINDS.map((option) => (
                    <option key={option} value={option}>
                      {option === "main" ? t.events.kindMain : option === "routine" ? t.events.kindRoutine : t.events.kindLadder}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${ids}-duration`}>{t.events.editorDuration}</label>
                <input id={`${ids}-duration`} type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor={`${ids}-start`}>{t.events.editorStart}</label>
              <input id={`${ids}-start`} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>

            <fieldset>
              <legend>{t.events.editorRepeat}</legend>
              <div className="field">
                <select value={repeat} onChange={(e) => setRepeat(e.target.value as RepeatType)} aria-label={t.events.editorRepeat}>
                  <option value="once">{t.events.repeatOnce}</option>
                  <option value="weekly">{t.events.repeatWeekly}</option>
                  <option value="monthly">{t.events.repeatMonthly}</option>
                </select>
              </div>

              {repeat !== "once" && (
                <div className="field">
                  <label htmlFor={`${ids}-interval`}>{t.events.editorInterval}</label>
                  <input id={`${ids}-interval`} type="number" min="1" value={interval} onChange={(e) => setInterval(e.target.value)} />
                </div>
              )}

              {repeat === "weekly" && (
                <div className="field">
                  <label>{t.events.editorWeekdays}</label>
                  <div className="weekday-picker">
                    {weekdayNames.map((label, index) => (
                      <button
                        type="button"
                        key={label + index}
                        className={weekdays.includes(index) ? "weekday is-on" : "weekday"}
                        aria-pressed={weekdays.includes(index)}
                        onClick={() => setWeekdays((current) =>
                          current.includes(index) ? current.filter((d) => d !== index) : [...current, index].sort((a, b) => a - b))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {repeat === "monthly" && (
                <div className="field">
                  <label htmlFor={`${ids}-dom`}>
                    {t.events.editorDayOfMonth} <span className="label-note">{t.events.editorDayOfMonthNote}</span>
                  </label>
                  <input id={`${ids}-dom`} type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} />
                </div>
              )}

              {repeat !== "once" && (
                <div className="field">
                  <label htmlFor={`${ids}-until`}>{t.events.editorUntil}</label>
                  <input id={`${ids}-until`} type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
                </div>
              )}
            </fieldset>
          </div>

          <div className="editor-sticky">
            <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>{t.events.editorPreview}</h3>
            {preview.length === 0 ? (
              <p className="assumption" style={{ margin: 0 }}>—</p>
            ) : (
              <ul className="event-list">
                {preview.map((occurrence) => (
                  <li className="event-row" key={occurrence.start.toISOString()}>
                    <span className={`dot dot-${kind}`} aria-hidden="true" />
                    <div className="event-body">
                      <span className="event-when mono">
                        {when.format(occurrence.start)} → {when.format(occurrence.end)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <h3 style={{ fontSize: "1rem", margin: "18px 0 8px" }}>{t.events.editorOutput}</h3>
            <textarea className="code-out" readOnly value={entry} />
            <div className="form-actions">
              <button
                className="button button-primary"
                type="button"
                disabled={!entry}
                onClick={() => navigator.clipboard?.writeText(entry).then(
                  () => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); },
                  () => { /* clipboard blocked */ },
                )}
              >
                {copied ? <CheckIcon className="icon" /> : <CopyIcon className="icon" />}
                {copied ? t.editor.copied : t.editor.copy}
              </button>
              {onClose && target && (
                <button className="button" type="button" onClick={onClose}>{t.events.editorCancel}</button>
              )}
            </div>
            <DictionaryBlocks blocks={blocks} title={t.editorLanguages.exportBlocks} lede={t.editorLanguages.exportBlocksLede} rows={3} />
          </div>
        </div>
      )}
    </section>
  );
}
