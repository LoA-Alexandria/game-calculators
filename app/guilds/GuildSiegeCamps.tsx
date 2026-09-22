"use client";

import { useCallback, useEffect, useId, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  GUILD_CAMP_NAME_MAX,
  GUILD_CAMP_NOTE_MAX,
  GUILD_CAMP_SERVER_MAX,
  campSlots,
  campTargets,
  campTotals,
  type GuildEventCampRow,
  type GuildPlanEventId,
} from "../../lib/content/guild-events";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useLocale } from "../components/LocaleProvider";
import { GuildsIcon, PenIcon } from "../components/Icons";

const COLUMNS = "slot, name, server_name, is_ours, priority, progress, rings, horns, note";

/**
 * Where each camp sits on the board, in percent. Trials of Odin puts five camps
 * around Asgard: one north, one on each side, two south.
 */
const CAMP_POSITIONS = [
  { x: 50, y: 13 },
  { x: 15, y: 41 },
  { x: 85, y: 41 },
  { x: 29, y: 81 },
  { x: 71, y: 81 },
  { x: 50, y: 95 },
] as const;

/** A phone is too narrow for the wide ring, so the camps stand in pairs instead. */
const CAMP_POSITIONS_NARROW = [
  { x: 50, y: 8 },
  { x: 22, y: 32 },
  { x: 78, y: 32 },
  { x: 22, y: 76 },
  { x: 78, y: 76 },
  { x: 50, y: 96 },
] as const;

const NARROW = "(max-width: 720px)";

function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useNarrowMap(): boolean {
  return useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

function position(slot: number, narrow: boolean) {
  const ring = narrow ? CAMP_POSITIONS_NARROW : CAMP_POSITIONS;
  return ring[(slot - 1) % ring.length];
}

function whole(value: string, max: number): number {
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? Math.min(Math.max(0, Math.floor(parsed)), max) : 0;
}

/**
 * The siege map as a plan: which camp is ours, which enemy camp to hit first,
 * and how many Draupnir Rings and Horns to spend on each. Tap a camp to read
 * its plan; officers edit the camp they picked.
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
  const narrow = useNarrowMap();

  const [camps, setCamps] = useState<GuildEventCampRow[]>(() => campSlots(count, []));
  // The pick and the unsaved edit belong to one siege, so switching days drops both without an effect.
  const [selection, setSelection] = useState<{ key: string; slot: number } | null>(null);
  const [draft, setDraft] = useState<{ key: string; row: GuildEventCampRow } | null>(null);
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
        priority: next.is_ours ? 0 : next.priority,
        progress: next.progress,
        rings: next.is_ours ? 0 : next.rings,
        horns: next.is_ours ? 0 : next.horns,
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

  /** Only one camp can be ours, so the one that held the flag gives it up. */
  const markOurs = async (camp: GuildEventCampRow, ours: boolean) => {
    const previous = camps.find((entry) => entry.is_ours && entry.slot !== camp.slot);
    if (ours && previous) await save(previous, { is_ours: false });
    await save(camp, { is_ours: ours });
  };

  const ours = camps.find((camp) => camp.is_ours) ?? null;
  const targets = campTargets(camps);
  const totals = campTotals(camps);
  const orderOf = (camp: GuildEventCampRow) => targets.findIndex((entry) => entry.slot === camp.slot) + 1;
  const campLabel = (camp: GuildEventCampRow) => camp.name.trim() || tf(t.guilds.campSlot, { n: camp.slot });

  const siege = `${eventId}:${dayIndex}`;
  const selected = selection && selection.key === siege ? selection.slot : null;
  const current = selected === null ? null : camps.find((camp) => camp.slot === selected) ?? null;
  const edited = draft && draft.key === siege && current && draft.row.slot === current.slot ? draft.row : null;
  const row = edited ?? current;
  const dirty = edited !== null;
  const change = (patch: Partial<GuildEventCampRow>) => {
    if (row) setDraft({ key: siege, row: { ...row, ...patch } });
  };
  const field = (key: string) => `${ids}-${key}`;

  const state = (camp: GuildEventCampRow) =>
    camp.is_ours
      ? "ours"
      : camp.progress === 0
        ? "done"
        : camp.name.trim() || camp.priority > 0
          ? "target"
          : "empty";

  const pick = (slot: number, toggle = false) => {
    setSelection((value) =>
      toggle && value?.key === siege && value.slot === slot ? null : { key: siege, slot },
    );
    setDraft(null);
  };

  return (
    <section className="guild-panel guild-camps">
      <header className="guild-panel-head">
        <h2>
          {t.guilds.campsTitle}
          <span className="count">{targets.length}</span>
        </h2>
        <span className="guild-camps-totals">
          {tf(t.guilds.campsTotals, { rings: n(totals.rings), horns: n(totals.horns) })}
        </span>
      </header>

      <p className="guild-event-hint">{canOfficer ? t.guilds.campsHint : t.guilds.campsHintMember}</p>
      {error ? (
        <p className="result-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="guild-map" role="group" aria-label={t.guilds.campsMapLabel}>
        {/* The camps sit in an inset plot, so a wide card never hangs over the edge on a phone. */}
        <div className="guild-map-plot">
        <svg className="guild-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {camps.map((camp) => {
            const point = position(camp.slot, narrow);
            return (
              <line
                key={camp.slot}
                x1="50"
                y1="50"
                x2={point.x}
                y2={point.y}
                className={camp.is_ours ? "guild-map-line is-ours" : "guild-map-line"}
              />
            );
          })}
        </svg>
        <p className="guild-map-centre">{t.guilds.campsCentre}</p>
        {camps.map((camp) => {
          const point = position(camp.slot, narrow);
          const order = orderOf(camp);
          return (
            <button
              key={camp.slot}
              type="button"
              className="guild-map-camp"
              data-state={state(camp)}
              aria-pressed={selected === camp.slot}
              style={{ "--camp-x": `${point.x}%`, "--camp-y": `${point.y}%` } as CSSProperties}
              onClick={() => pick(camp.slot, true)}
            >
              <span className="guild-map-camp-top">
                {camp.is_ours ? (
                  <span className="guild-map-badge is-ours">
                    <GuildsIcon className="icon" />
                    <span className="visually-hidden">{t.guilds.campOurs}</span>
                  </span>
                ) : order > 0 ? (
                  <span className="guild-map-badge">
                    {order}
                    <span className="visually-hidden"> {tf(t.guilds.campTarget, { n: order })}</span>
                  </span>
                ) : null}
                <span className="guild-map-name">{campLabel(camp)}</span>
              </span>
              {camp.server_name ? <span className="guild-map-server">{camp.server_name}</span> : null}
              <span className="guild-map-bar" aria-hidden="true">
                <span style={{ width: `${camp.progress}%` }} />
              </span>
              <span className="guild-map-numbers">
                <span className="guild-map-percent">{tf(t.guilds.campProgressValue, { percent: camp.progress })}</span>
                {!camp.is_ours && (camp.rings > 0 || camp.horns > 0) ? (
                  <span className="guild-map-spend">
                    {tf(t.guilds.campSpendShort, { rings: n(camp.rings), horns: n(camp.horns) })}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
        </div>
      </div>

      {targets.length > 0 ? (
        <ol className="guild-camp-order" aria-label={t.guilds.campsOrderLabel}>
          {targets.map((camp, index) => (
            <li key={camp.slot}>
              <button
                type="button"
                className={camp.progress === 0 ? "guild-camp-chip is-done" : "guild-camp-chip"}
                aria-pressed={selected === camp.slot}
                onClick={() => pick(camp.slot)}
              >
                <span className="guild-camp-chip-order">{index + 1}</span>
                {campLabel(camp)}
              </button>
            </li>
          ))}
        </ol>
      ) : null}

      {row ? (
        <div className="guild-camp-detail">
          <header className="guild-camp-detail-head">
            <strong>{campLabel(row)}</strong>
            {row.is_ours ? (
              <span className="pill pill-good">{t.guilds.campOurs}</span>
            ) : orderOf(row) > 0 ? (
              <span className="pill">{tf(t.guilds.campTarget, { n: orderOf(row) })}</span>
            ) : null}
            <span className="guild-camps-server">{tf(t.guilds.campSlot, { n: row.slot })}</span>
          </header>

          {canOfficer ? (
            <>
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
                        {Array.from({ length: Math.max(count - 1, 1) }, (_, i) => i + 1).map((order) => (
                          <option key={order} value={order}>
                            {tf(t.guilds.campTarget, { n: order })}
                          </option>
                        ))}
                      </select>
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
                  </>
                )}
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
              </div>
              <div className="guild-camp-edit-actions">
                <button
                  className="small-button button-primary"
                  type="button"
                  disabled={busy || !dirty}
                  onClick={() => void save(row)}
                >
                  <PenIcon className="icon icon-sm" />
                  {t.guilds.campSave}
                </button>
                <button
                  className="small-button"
                  type="button"
                  disabled={busy}
                  aria-pressed={row.is_ours}
                  onClick={() => void markOurs(row, !row.is_ours)}
                >
                  {row.is_ours ? t.guilds.campUnsetOurs : t.guilds.campSetOurs}
                </button>
                {dirty ? (
                  <button className="small-button" type="button" disabled={busy} onClick={() => setDraft(null)}>
                    {t.guilds.postCancel}
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="guild-camp-detail-read">
              <p className="guild-camp-spend">
                <span className="guild-camp-progress">{tf(t.guilds.campProgressValue, { percent: row.progress })}</span>
                {row.rings > 0 ? <span>{tf(t.guilds.campRingsValue, { count: n(row.rings) })}</span> : null}
                {row.horns > 0 ? <span>{tf(t.guilds.campHornsValue, { count: n(row.horns) })}</span> : null}
              </p>
              {row.note.trim() ? <p className="guild-camp-note">{row.note}</p> : null}
            </div>
          )}
        </div>
      ) : (
        <p className="guild-camps-pick">{ours ? t.guilds.campsPick : t.guilds.campOursHint}</p>
      )}
    </section>
  );
}
