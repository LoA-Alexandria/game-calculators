"use client";

import { useCallback, useEffect, useId, useState } from "react";
import {
  GUILD_CAMP_NAME_MAX,
  GUILD_CAMP_NOTE_MAX,
  GUILD_CAMP_SERVER_MAX,
  campSlots,
  campTargets,
  campTotals,
  nextCampPriority,
  type GuildEventCampRow,
  type GuildPlanEventId,
} from "../../lib/content/guild-events";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useLocale } from "../components/LocaleProvider";
import { GuildsIcon, PenIcon } from "../components/Icons";

const COLUMNS = "slot, name, server_name, is_ours, priority, progress, rings, horns, note";

function whole(value: string, max: number): number {
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? Math.min(Math.max(0, Math.floor(parsed)), max) : 0;
}

/**
 * The siege map as a plan: which camp is ours, which enemy camp to hit first,
 * and how many Draupnir Rings and Horns to spend on each. Officers edit,
 * members read.
 */
export function GuildSiegeCamps({
  guildId,
  eventId,
  dayIndex,
  count,
  canOfficer,
}: {
  guildId: string;
  eventId: GuildPlanEventId;
  dayIndex: number;
  count: number;
  canOfficer: boolean;
}) {
  const { t, tf, n } = useLocale();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();

  const [camps, setCamps] = useState<GuildEventCampRow[]>(() => campSlots(count, []));
  const [draft, setDraft] = useState<GuildEventCampRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const { data, error: loadError } = await supabase
        .from("guild_event_camps")
        .select(COLUMNS)
        .eq("guild_id", guildId)
        .eq("event_id", eventId)
        .eq("day_index", dayIndex)
        .order("slot");
      if (gone) return;
      if (loadError) setError(loadError.message);
      else setCamps(campSlots(count, (data ?? []) as GuildEventCampRow[]));
    })();
    return () => {
      gone = true;
    };
  }, [supabase, guildId, eventId, dayIndex, count, reloadToken]);

  const save = async (camp: GuildEventCampRow, patch: Partial<GuildEventCampRow> = {}) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const next = { ...camp, ...patch };
    const { error: saveError } = await supabase.from("guild_event_camps").upsert(
      {
        guild_id: guildId,
        event_id: eventId,
        day_index: dayIndex,
        slot: next.slot,
        name: next.name.trim().slice(0, GUILD_CAMP_NAME_MAX),
        server_name: next.server_name.trim().slice(0, GUILD_CAMP_SERVER_MAX),
        is_ours: next.is_ours,
        priority: next.priority,
        progress: next.progress,
        rings: next.rings,
        horns: next.horns,
        note: next.note.trim().slice(0, GUILD_CAMP_NOTE_MAX),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guild_id,event_id,day_index,slot" },
    );
    if (saveError) setError(saveError.message);
    else {
      setDraft(null);
      reload();
    }
    setBusy(false);
  };

  /** Only one camp can be ours, so the others are cleared in the same go. */
  const markOurs = async (slot: number) => {
    const previous = camps.find((camp) => camp.is_ours && camp.slot !== slot);
    if (previous) await save(previous, { is_ours: false, priority: 0 });
    const camp = camps.find((entry) => entry.slot === slot);
    if (camp) await save(camp, { is_ours: true, priority: 0 });
  };

  const ours = camps.find((camp) => camp.is_ours) ?? null;
  const targets = campTargets(camps);
  const totals = campTotals(camps);
  const campLabel = (camp: GuildEventCampRow) => camp.name.trim() || tf(t.guilds.campSlot, { n: camp.slot });

  return (
    <section className="guild-panel guild-camps">
      <header className="guild-panel-head">
        <h2>
          {t.guilds.campsTitle}
          <span className="count">{targets.length}</span>
        </h2>
        {canOfficer ? (
          <button
            type="button"
            className="small-button"
            aria-pressed={editing}
            disabled={busy}
            onClick={() => {
              setEditing((value) => !value);
              setDraft(null);
            }}
          >
            <PenIcon className="icon icon-sm" />
            {editing ? t.guilds.campsEditDone : t.guilds.campsEdit}
          </button>
        ) : null}
      </header>

      <p className="guild-event-hint">{t.guilds.campsHint}</p>
      {error ? (
        <p className="result-error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="guild-camps-ours">
        <span className="guild-chip">
          <GuildsIcon className="icon" />
          {t.guilds.campOurs}
        </span>
        <strong>{ours ? campLabel(ours) : t.guilds.campOursUnset}</strong>
        {ours?.server_name ? <span className="guild-camps-server">{ours.server_name}</span> : null}
      </p>

      <p className="guild-camps-totals">
        {tf(t.guilds.campsTotals, { rings: n(totals.rings), horns: n(totals.horns) })}
      </p>

      {editing && canOfficer ? (
        <ul className="guild-camp-edit-list">
          {camps.map((camp) => {
            const row = draft?.slot === camp.slot ? draft : camp;
            const dirty = draft?.slot === camp.slot;
            const field = (key: string) => `${ids}-${camp.slot}-${key}`;
            const change = (patch: Partial<GuildEventCampRow>) => setDraft({ ...row, ...patch });
            return (
              <li className={row.is_ours ? "guild-camp-edit is-ours" : "guild-camp-edit"} key={camp.slot}>
                <div className="guild-camp-edit-head">
                  <strong>{tf(t.guilds.campSlot, { n: camp.slot })}</strong>
                  <label className="field-inline">
                    <input
                      type="radio"
                      name={`${ids}-ours`}
                      checked={row.is_ours}
                      disabled={busy}
                      onChange={() => void markOurs(camp.slot)}
                    />
                    {t.guilds.campSetOurs}
                  </label>
                </div>
                <div className="guild-camp-edit-grid">
                  <div className="field">
                    <label htmlFor={field("name")}>{t.guilds.campName}</label>
                    <input
                      id={field("name")}
                      value={row.name}
                      maxLength={GUILD_CAMP_NAME_MAX}
                      onChange={(e) => change({ name: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={field("server")}>{t.guilds.serverLabel}</label>
                    <input
                      id={field("server")}
                      value={row.server_name}
                      maxLength={GUILD_CAMP_SERVER_MAX}
                      placeholder="Bay-S8"
                      onChange={(e) => change({ server_name: e.target.value })}
                    />
                  </div>
                  {row.is_ours ? null : (
                    <>
                      <div className="field">
                        <label htmlFor={field("priority")}>{t.guilds.campPriority}</label>
                        <select
                          id={field("priority")}
                          value={row.priority}
                          onChange={(e) => change({ priority: Number(e.target.value) })}
                        >
                          <option value={0}>{t.guilds.campPriorityNone}</option>
                          {Array.from({ length: Math.max(count - 1, nextCampPriority(camps)) }, (_, i) => i + 1).map((order) => (
                            <option key={order} value={order}>
                              {tf(t.guilds.campTarget, { n: order })}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor={field("progress")}>
                          {t.guilds.campProgress} <span className="label-note">%</span>
                        </label>
                        <input
                          id={field("progress")}
                          inputMode="numeric"
                          value={String(row.progress)}
                          onChange={(e) => change({ progress: whole(e.target.value, 100) })}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={field("rings")}>{t.guilds.campRings}</label>
                        <input
                          id={field("rings")}
                          inputMode="numeric"
                          value={String(row.rings)}
                          onChange={(e) => change({ rings: whole(e.target.value, 9999) })}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={field("horns")}>{t.guilds.campHorns}</label>
                        <input
                          id={field("horns")}
                          inputMode="numeric"
                          value={String(row.horns)}
                          onChange={(e) => change({ horns: whole(e.target.value, 999_999) })}
                        />
                      </div>
                      <div className="field guild-camp-note-field">
                        <label htmlFor={field("note")}>{t.guilds.campNote}</label>
                        <input
                          id={field("note")}
                          value={row.note}
                          maxLength={GUILD_CAMP_NOTE_MAX}
                          placeholder={t.guilds.campNotePlaceholder}
                          onChange={(e) => change({ note: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="guild-camp-edit-actions">
                  <button
                    className="small-button button-primary"
                    type="button"
                    disabled={busy || !dirty}
                    onClick={() => void save(row)}
                  >
                    {t.guilds.campSave}
                  </button>
                  {dirty ? (
                    <button className="small-button" type="button" disabled={busy} onClick={() => setDraft(null)}>
                      {t.guilds.postCancel}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : targets.every((camp) => !camp.name.trim() && camp.priority === 0) ? (
        <div className="guild-empty">
          <GuildsIcon className="icon guild-empty-icon" />
          <strong>{t.guilds.emptyTitle}</strong>
          <p>{t.guilds.campsEmpty}</p>
        </div>
      ) : (
        <ol className="guild-camp-list">
          {targets.map((camp, index) => (
            <li className={camp.progress === 0 ? "guild-camp is-done" : "guild-camp"} key={camp.slot}>
              <span className="guild-camp-rank" aria-hidden="true">{index + 1}</span>
              <div className="guild-camp-body">
                <p className="guild-camp-name">
                  {campLabel(camp)}
                  {camp.server_name ? <span className="guild-camp-server">{camp.server_name}</span> : null}
                </p>
                <div className="guild-camp-bar" aria-hidden="true">
                  <span style={{ width: `${camp.progress}%` }} />
                </div>
                <p className="guild-camp-spend">
                  <span className="guild-camp-progress">
                    <span className="visually-hidden">{t.guilds.campProgress}: </span>
                    {tf(t.guilds.campProgressValue, { percent: camp.progress })}
                  </span>
                  {camp.rings > 0 ? <span>{tf(t.guilds.campRingsValue, { count: n(camp.rings) })}</span> : null}
                  {camp.horns > 0 ? <span>{tf(t.guilds.campHornsValue, { count: n(camp.horns) })}</span> : null}
                </p>
                {camp.note.trim() ? <p className="guild-camp-note">{camp.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
