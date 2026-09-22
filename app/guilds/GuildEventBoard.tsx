"use client";

import { useCallback, useEffect, useId, useState } from "react";
import {
  GUILD_PLAN_EVENTS,
  currentEventDayIndex,
  guildPlanEventDef,
  hoursUntilBerlinMidnight,
  pledgeCoverage,
  seriesScore,
  type GuildEventDayResult,
  type GuildEventPledgeStatus,
  type GuildPlanEventId,
} from "../../lib/content/guild-events";
import { guildRosterLabel, type GuildRosterEntry } from "../../lib/content/guilds";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useLocale } from "../components/LocaleProvider";

type DayRow = {
  id?: string;
  day_index: number;
  our_score: number;
  enemy_score: number;
  result: GuildEventDayResult;
  call_note: string;
};

type PledgeRow = {
  user_id: string;
  amount: number;
  status: GuildEventPledgeStatus;
};

type Props = {
  guildId: string;
  userId: string;
  canOfficer: boolean;
  roster: GuildRosterEntry[];
  eventId: GuildPlanEventId;
};

function eventLabel(
  t: ReturnType<typeof useLocale>["t"],
  id: GuildPlanEventId,
): string {
  const def = guildPlanEventDef(id);
  return t.guilds.events[def.labelKey];
}

export function GuildEventBoard({ guildId, userId, canOfficer, roster, eventId }: Props) {
  const { t, tf } = useLocale();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();
  const def = guildPlanEventDef(eventId);

  const [days, setDays] = useState<DayRow[]>([]);
  const [pledges, setPledges] = useState<PledgeRow[]>([]);
  const [dayIndex, setDayIndex] = useState(1);
  const [ourScore, setOurScore] = useState("0");
  const [enemyScore, setEnemyScore] = useState("0");
  const [callNote, setCallNote] = useState("");
  const [pledgeAmount, setPledgeAmount] = useState("0");
  const [pledgeStatus, setPledgeStatus] = useState<GuildEventPledgeStatus>("waiting");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const [dayRes, pledgeRes] = await Promise.all([
        supabase
          .from("guild_event_days")
          .select("id, day_index, our_score, enemy_score, result, call_note")
          .eq("guild_id", guildId)
          .eq("event_id", eventId)
          .order("day_index"),
        supabase
          .from("guild_event_pledges")
          .select("user_id, amount, status, day_index")
          .eq("guild_id", guildId)
          .eq("event_id", eventId),
      ]);
      if (gone) return;
      if (dayRes.error) setError(dayRes.error.message);
      else {
        const nextDays = (dayRes.data ?? []) as DayRow[];
        setDays(nextDays);
        const current = currentEventDayIndex(def.seriesDays, nextDays);
        setDayIndex(current);
        const row = nextDays.find((d) => d.day_index === current);
        setOurScore(String(row?.our_score ?? 0));
        setEnemyScore(String(row?.enemy_score ?? 0));
        setCallNote(row?.call_note ?? "");
      }
      if (pledgeRes.error) setError(pledgeRes.error.message);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, guildId, eventId, def.seriesDays, reloadToken]);

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const { data, error: pledgeError } = await supabase
        .from("guild_event_pledges")
        .select("user_id, amount, status")
        .eq("guild_id", guildId)
        .eq("event_id", eventId)
        .eq("day_index", dayIndex);
      if (gone) return;
      if (pledgeError) {
        setError(pledgeError.message);
        return;
      }
      const rows = (data ?? []) as PledgeRow[];
      setPledges(rows);
      const mine = rows.find((r) => r.user_id === userId);
      setPledgeAmount(String(mine?.amount ?? 0));
      setPledgeStatus(mine?.status ?? "waiting");
    })();
    return () => {
      gone = true;
    };
  }, [supabase, guildId, eventId, dayIndex, userId, reloadToken]);

  const series = seriesScore(days);
  const our = Number(ourScore) || 0;
  const enemy = Number(enemyScore) || 0;
  const coverage = pledgeCoverage(our, enemy, pledges);
  void tick;
  const timer = hoursUntilBerlinMidnight(new Date());

  const rosterName = (uid: string) => {
    const entry = roster.find((r) => r.user_id === uid);
    if (entry) return guildRosterLabel(entry);
    return uid.slice(0, 8) + "…";
  };

  const ensureDay = async (): Promise<DayRow | null> => {
    if (!supabase) return null;
    const existing = days.find((d) => d.day_index === dayIndex);
    if (existing?.id) return existing;
    const { data, error: insertError } = await supabase
      .from("guild_event_days")
      .upsert(
        {
          guild_id: guildId,
          event_id: eventId,
          day_index: dayIndex,
          our_score: our,
          enemy_score: enemy,
          result: "pending",
          call_note: callNote.trim().slice(0, 280),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "guild_id,event_id,day_index" },
      )
      .select("id, day_index, our_score, enemy_score, result, call_note")
      .maybeSingle();
    if (insertError) {
      setError(insertError.message);
      return null;
    }
    return data as DayRow;
  };

  const saveScores = async () => {
    if (!supabase || !canOfficer) return;
    setBusy(true);
    setError("");
    const { error: upsertError } = await supabase.from("guild_event_days").upsert(
      {
        guild_id: guildId,
        event_id: eventId,
        day_index: dayIndex,
        our_score: Math.max(0, Math.floor(our)),
        enemy_score: Math.max(0, Math.floor(enemy)),
        call_note: callNote.trim().slice(0, 280),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guild_id,event_id,day_index" },
    );
    if (upsertError) setError(upsertError.message);
    else reload();
    setBusy(false);
  };

  const setResult = async (result: GuildEventDayResult) => {
    if (!supabase || !canOfficer) return;
    setBusy(true);
    setError("");
    await ensureDay();
    const { error: upsertError } = await supabase.from("guild_event_days").upsert(
      {
        guild_id: guildId,
        event_id: eventId,
        day_index: dayIndex,
        our_score: Math.max(0, Math.floor(our)),
        enemy_score: Math.max(0, Math.floor(enemy)),
        result,
        call_note: callNote.trim().slice(0, 280),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guild_id,event_id,day_index" },
    );
    if (upsertError) setError(upsertError.message);
    else reload();
    setBusy(false);
  };

  const savePledge = async () => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const amount = Math.max(0, Math.floor(Number(pledgeAmount) || 0));
    const { error: upsertError } = await supabase.from("guild_event_pledges").upsert(
      {
        guild_id: guildId,
        event_id: eventId,
        day_index: dayIndex,
        user_id: userId,
        amount,
        status: pledgeStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guild_id,event_id,day_index,user_id" },
    );
    if (upsertError) setError(upsertError.message);
    else reload();
    setBusy(false);
  };

  const selectDay = (index: number) => {
    setDayIndex(index);
    const row = days.find((d) => d.day_index === index);
    setOurScore(String(row?.our_score ?? 0));
    setEnemyScore(String(row?.enemy_score ?? 0));
    setCallNote(row?.call_note ?? "");
  };

  const currentResult = days.find((d) => d.day_index === dayIndex)?.result ?? "pending";
  const lead = our - enemy;

  return (
    <section className="guild-panel guild-event-board">
      <header className="guild-panel-head">
        <h2>{eventLabel(t, eventId)}</h2>
        <span className="count">
          {t.guilds.eventSeries}: {series.won} : {series.lost}
        </span>
      </header>

      <p className="guild-event-hint">
        {def.featured ? t.guilds.eventTacticsHint : t.guilds.eventGenericHint}
      </p>

      {error ? (
        <p className="result-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="guild-event-days" role="tablist" aria-label={t.guilds.eventSeries}>
        {Array.from({ length: def.seriesDays }, (_, i) => i + 1).map((n) => {
          const row = days.find((d) => d.day_index === n);
          const active = n === dayIndex;
          return (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? "guild-event-day is-active" : "guild-event-day"}
              onClick={() => selectDay(n)}
            >
              <span>{tf(t.guilds.eventDay, { n })}</span>
              <small>
                {row?.result === "won"
                  ? t.guilds.eventResultWon
                  : row?.result === "lost"
                    ? t.guilds.eventResultLost
                    : n === dayIndex
                      ? t.guilds.eventToday
                      : t.guilds.eventResultPending}
              </small>
            </button>
          );
        })}
      </div>

      <p className="guild-event-timer" aria-live="polite">
        <span className="guild-event-timer-label">{t.guilds.eventTimerLabel}</span>
        <strong className="guild-event-timer-value">
          {tf(t.guilds.eventTimerValue, { hours: timer.hours, minutes: timer.minutes })}
        </strong>
      </p>

      <div className="guild-event-scores">
        <div className="field">
          <label htmlFor={`${ids}-our`}>{t.guilds.eventOurScore}</label>
          <input
            id={`${ids}-our`}
            inputMode="numeric"
            value={ourScore}
            disabled={!canOfficer || busy}
            onChange={(e) => setOurScore(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
        <div className="field">
          <label htmlFor={`${ids}-enemy`}>{t.guilds.eventEnemyScore}</label>
          <input
            id={`${ids}-enemy`}
            inputMode="numeric"
            value={enemyScore}
            disabled={!canOfficer || busy}
            onChange={(e) => setEnemyScore(e.target.value.replace(/[^\d]/g, ""))}
          />
        </div>
      </div>

      <div className="guild-event-bar" aria-hidden="true">
        <span
          className="guild-event-bar-us"
          style={{ width: `${our + enemy > 0 ? (our / (our + enemy)) * 100 : 50}%` }}
        />
      </div>

      <p className="guild-event-coverage" role="status">
        {lead > 0
          ? tf(t.guilds.eventCoverageLead, { lead })
          : coverage.covers
            ? tf(t.guilds.eventCoverageOk, { available: coverage.available, gap: coverage.gap })
            : tf(t.guilds.eventCoverageShort, {
                short: Math.max(0, coverage.gap - coverage.available),
                available: coverage.available,
                gap: coverage.gap,
              })}
      </p>

      {canOfficer ? (
        <div className="guild-event-officer-actions">
          <button className="button button-primary" type="button" disabled={busy} onClick={() => void saveScores()}>
            {t.guilds.eventScoresSave}
          </button>
          <button
            className="small-button"
            type="button"
            disabled={busy || currentResult === "won"}
            onClick={() => void setResult("won")}
          >
            {t.guilds.eventMarkWon}
          </button>
          <button
            className="small-button"
            type="button"
            disabled={busy || currentResult === "lost"}
            onClick={() => void setResult("lost")}
          >
            {t.guilds.eventMarkLost}
          </button>
          <button
            className="small-button"
            type="button"
            disabled={busy || currentResult === "pending"}
            onClick={() => void setResult("pending")}
          >
            {t.guilds.eventResetDay}
          </button>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor={`${ids}-call`}>{t.guilds.eventCallLabel}</label>
        <input
          id={`${ids}-call`}
          value={callNote}
          maxLength={280}
          disabled={!canOfficer || busy}
          placeholder={t.guilds.eventCallPlaceholder}
          onChange={(e) => setCallNote(e.target.value)}
        />
        {canOfficer ? (
          <button className="small-button" type="button" disabled={busy} onClick={() => void saveScores()}>
            {t.guilds.eventCallSave}
          </button>
        ) : null}
      </div>

      <div className="guild-event-pledges">
        <header className="guild-panel-head">
          <h3>{t.guilds.eventPledgesTitle}</h3>
          <span className="count">{pledges.length}</span>
        </header>

        <div className="guild-event-my-pledge">
          <div className="field">
            <label htmlFor={`${ids}-pledge`}>{t.guilds.eventPledgeAmount}</label>
            <input
              id={`${ids}-pledge`}
              inputMode="numeric"
              value={pledgeAmount}
              disabled={busy}
              onChange={(e) => setPledgeAmount(e.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
          <div className="field">
            <label htmlFor={`${ids}-pledge-status`} className="visually-hidden">
              Status
            </label>
            <select
              id={`${ids}-pledge-status`}
              value={pledgeStatus}
              disabled={busy}
              onChange={(e) => setPledgeStatus(e.target.value as GuildEventPledgeStatus)}
            >
              <option value="waiting">{t.guilds.eventPledgeStatusWaiting}</option>
              <option value="ready">{t.guilds.eventPledgeStatusReady}</option>
              <option value="spent">{t.guilds.eventPledgeStatusSpent}</option>
            </select>
          </div>
          <button className="button button-primary" type="button" disabled={busy} onClick={() => void savePledge()}>
            {t.guilds.eventPledgeSave}
          </button>
        </div>

        {pledges.length === 0 ? (
          <p className="guild-panel-empty">{t.guilds.membersEmpty}</p>
        ) : (
          <ul className="guild-event-pledge-list">
            {pledges.map((row) => (
              <li key={row.user_id}>
                <span className="guild-pledge-name">{rosterName(row.user_id)}</span>
                <span className="guild-pledge-amount mono">{row.amount.toLocaleString()}</span>
                <span className="pill guild-pledge-status" data-status={row.status}>
                  {row.status === "ready"
                    ? t.guilds.eventPledgeStatusReady
                    : row.status === "spent"
                      ? t.guilds.eventPledgeStatusSpent
                      : t.guilds.eventPledgeStatusWaiting}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function GuildEventPicker({
  guildId,
  activeIds,
  canOfficer,
  open,
  onClose,
  onChanged,
}: {
  guildId: string;
  activeIds: GuildPlanEventId[];
  canOfficer: boolean;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t } = useLocale();
  const supabase = getSupabaseBrowserClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open || !canOfficer) return null;

  const toggle = async (eventId: GuildPlanEventId, on: boolean) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    if (on) {
      const { error: insertError } = await supabase.from("guild_active_events").insert({
        guild_id: guildId,
        event_id: eventId,
      });
      if (insertError) setError(insertError.message);
      else onChanged();
    } else {
      const { error: deleteError } = await supabase
        .from("guild_active_events")
        .delete()
        .eq("guild_id", guildId)
        .eq("event_id", eventId);
      if (deleteError) setError(deleteError.message);
      else onChanged();
    }
    setBusy(false);
  };

  return (
    <section className="guild-panel guild-manage-panel">
      <header className="guild-panel-head">
        <h2>{t.guilds.eventsActivate}</h2>
        <button className="small-button" type="button" onClick={onClose}>
          {t.guilds.eventsActivateClose}
        </button>
      </header>
      {error ? (
        <p className="result-error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="guild-event-picker">
        {GUILD_PLAN_EVENTS.map((event) => {
          const on = activeIds.includes(event.id);
          return (
            <li key={event.id}>
              <span>{t.guilds.events[event.labelKey]}</span>
              <button
                className={on ? "small-button button-primary" : "small-button"}
                type="button"
                disabled={busy}
                aria-pressed={on}
                onClick={() => void toggle(event.id, !on)}
              >
                {on ? t.guilds.eventsDeactivate : t.guilds.eventsActivate}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
