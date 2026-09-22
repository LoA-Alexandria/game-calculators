"use client";

import { useEffect, useId, useState } from "react";
import {
  GUILD_ALLIANCE_NOTE_MAX,
  alliancePartnerId,
  canAnswerAlliance,
  offerableGuilds,
  type GuildAllianceRow,
} from "../../lib/content/guild-alliances";
import { guildMatchesServerFilter, type Guild } from "../../lib/content/guilds";
import type { GuildPlanEventId } from "../../lib/content/guild-events";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useLocale } from "../components/LocaleProvider";
import { GuildsIcon, PlusIcon } from "../components/Icons";

type PickerGuild = Pick<Guild, "id" | "name" | "server_name">;

/**
 * The alliance line above the siege map: who we are allied with for this event,
 * the offer waiting for an answer, or the button an officer uses to ask.
 */
export function GuildAlliance({
  guildId,
  userId,
  eventId,
  canOfficer,
  rows,
  accepted,
  onChanged,
}: {
  guildId: string;
  userId: string;
  eventId: GuildPlanEventId;
  canOfficer: boolean;
  rows: GuildAllianceRow[];
  accepted: GuildAllianceRow | null;
  onChanged: () => void;
}) {
  const { t, tf } = useLocale();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();

  const [guilds, setGuilds] = useState<PickerGuild[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState("");
  const [note, setNote] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const { data, error: listError } = await supabase
        .from("guilds")
        .select("id, name, server_name")
        .order("name");
      if (gone) return;
      if (listError) setError(listError.message);
      else setGuilds((data ?? []) as PickerGuild[]);
    })();
    return () => {
      gone = true;
    };
  }, [supabase]);

  const guildName = (id: string) => guilds.find((guild) => guild.id === id)?.name ?? "…";

  const offer = async () => {
    if (!supabase || !pick) return;
    setBusy(true);
    setError("");
    const { error: insertError } = await supabase.from("guild_alliances").insert({
      event_id: eventId,
      from_guild_id: guildId,
      to_guild_id: pick,
      created_by: userId,
      note: note.trim().slice(0, GUILD_ALLIANCE_NOTE_MAX),
    });
    if (insertError) setError(insertError.message);
    else {
      setOpen(false);
      setPick("");
      setNote("");
      setQuery("");
      onChanged();
    }
    setBusy(false);
  };

  const answer = async (row: GuildAllianceRow, status: "accepted" | "declined") => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("respond_to_guild_alliance", {
      p_alliance_id: row.id,
      p_status: status,
    });
    if (rpcError) setError(rpcError.message);
    else onChanged();
    setBusy(false);
  };

  /** Withdrawing an offer or ending an alliance takes the shared plan with it. */
  const end = async (row: GuildAllianceRow) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error: deleteError } = await supabase.from("guild_alliances").delete().eq("id", row.id);
    if (deleteError) setError(deleteError.message);
    else {
      setConfirmEnd(false);
      onChanged();
    }
    setBusy(false);
  };

  const pending = rows.filter((row) => row.status === "pending");
  const choices = offerableGuilds(guilds, guildId, rows).filter((guild) =>
    guildMatchesServerFilter(guild, query),
  );

  return (
    <div className="guild-alliance">
      {error ? (
        <p className="result-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="guild-alliance-line">
        {accepted ? (
          <>
            <span className="pill pill-good">
              <GuildsIcon className="icon icon-sm" />
              {guildName(alliancePartnerId(accepted, guildId))}
            </span>
            {canOfficer ? (
              confirmEnd ? (
                <>
                  <span className="guild-alliance-confirm">{t.guilds.allianceEndConfirm}</span>
                  <button
                    className="small-button button-danger"
                    type="button"
                    disabled={busy}
                    onClick={() => void end(accepted)}
                  >
                    {t.guilds.allianceEnd}
                  </button>
                  <button className="small-button" type="button" disabled={busy} onClick={() => setConfirmEnd(false)}>
                    {t.guilds.postCancel}
                  </button>
                </>
              ) : (
                <button className="small-button" type="button" disabled={busy} onClick={() => setConfirmEnd(true)}>
                  {t.guilds.allianceEnd}
                </button>
              )
            ) : null}
          </>
        ) : null}

        {pending.map((row) =>
          canAnswerAlliance(row, guildId) ? (
            <span key={row.id} className="guild-alliance-offer">
              <span className="pill">{tf(t.guilds.allianceIncoming, { guild: guildName(row.from_guild_id) })}</span>
              {row.note.trim() ? <span className="guild-alliance-note">{row.note}</span> : null}
              {canOfficer ? (
                <>
                  <button
                    className="small-button button-primary"
                    type="button"
                    disabled={busy}
                    onClick={() => void answer(row, "accepted")}
                  >
                    {t.guilds.allianceAccept}
                  </button>
                  <button
                    className="small-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void answer(row, "declined")}
                  >
                    {t.guilds.allianceDecline}
                  </button>
                </>
              ) : null}
            </span>
          ) : (
            <span key={row.id} className="guild-alliance-offer">
              <span className="pill">{tf(t.guilds.allianceWaiting, { guild: guildName(row.to_guild_id) })}</span>
              {canOfficer ? (
                <button className="small-button" type="button" disabled={busy} onClick={() => void end(row)}>
                  {t.guilds.allianceWithdraw}
                </button>
              ) : null}
            </span>
          ),
        )}

        {!accepted && pending.length === 0 && canOfficer && !open ? (
          <button className="small-button" type="button" onClick={() => setOpen(true)}>
            <PlusIcon className="icon icon-sm" />
            {t.guilds.allianceOffer}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="guild-alliance-form">
          <div className="field">
            <label htmlFor={`${ids}-search`}>{t.guilds.allianceGuildLabel}</label>
            <input
              id={`${ids}-search`}
              value={query}
              placeholder={t.guilds.serverFilterPlaceholder}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`${ids}-pick`} className="visually-hidden">
              {t.guilds.allianceGuildLabel}
            </label>
            <select id={`${ids}-pick`} value={pick} disabled={busy} onChange={(e) => setPick(e.target.value)}>
              <option value="">{t.guilds.alliancePick}</option>
              {choices.map((guild) => (
                <option key={guild.id} value={guild.id}>
                  {guild.server_name ? `${guild.name} · ${guild.server_name}` : guild.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field guild-alliance-note-field">
            <label htmlFor={`${ids}-note`}>{t.guilds.allianceNoteLabel}</label>
            <input
              id={`${ids}-note`}
              value={note}
              maxLength={GUILD_ALLIANCE_NOTE_MAX}
              placeholder={t.guilds.allianceNotePlaceholder}
              disabled={busy}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="guild-alliance-actions">
            <button
              className="small-button button-primary"
              type="button"
              disabled={busy || !pick}
              onClick={() => void offer()}
            >
              {t.guilds.allianceSend}
            </button>
            <button className="small-button" type="button" disabled={busy} onClick={() => setOpen(false)}>
              {t.guilds.postCancel}
            </button>
            {choices.length === 0 ? <span className="guild-alliance-note">{t.guilds.allianceNoGuilds}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
