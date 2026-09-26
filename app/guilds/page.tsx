"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  GUILD_REQUEST_NOTE_MAX,
  guildIconPublicUrl,
  guildMatchesServerFilter,
  guildRoomHref,
  isGuildMasterOf,
  normalizeGuildRequestNote,
  type Guild,
  type GuildMembership,
} from "../../lib/content/guilds";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { DiscordIcon, GlobeIcon, GuildsIcon, LockIcon, SearchIcon } from "../components/Icons";
import { GuildCreateRequestPanel } from "../components/GuildCreateRequestPanel";
import { PageHead, SectionBanner } from "../components/Ui";

type OwnMembership = Pick<GuildMembership, "guild_id" | "status">;

function GuildMark({ guild }: { guild: Guild }) {
  const iconUrl = guildIconPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, guild.icon_path);
  if (iconUrl) {
    return (
      <div className="guild-card-mark has-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconUrl} alt="" />
      </div>
    );
  }
  return (
    <div className="guild-card-mark" aria-hidden="true">
      <GuildsIcon className="icon" />
    </div>
  );
}

export default function GuildsPage() {
  const { t, tf } = useLocale();
  const { session, loading: authLoading, signIn } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();
  useDocumentTitle(t.guilds.title);

  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [memberships, setMemberships] = useState<OwnMembership[]>([]);
  const [serverFilter, setServerFilter] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [joinGuildId, setJoinGuildId] = useState<string | null>(null);
  const [joinNote, setJoinNote] = useState("");
  // Guilds whose listing has run out of Premium: readable, not writable.
  const [frozenIds, setFrozenIds] = useState<Set<string>>(new Set());

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const listed = await supabase
        .from("guilds")
        .select("id, slug, name, description, server_name, icon_path, master_discord_user_id, created_at")
        .order("name");
      if (gone) return;
      if (listed.error) setError(listed.error.message);
      else setGuilds((listed.data ?? []) as Guild[]);

      const frozen = await supabase.rpc("frozen_guild_ids");
      if (gone) return;
      if (!frozen.error) {
        setFrozenIds(new Set(((frozen.data ?? []) as string[]).map(String)));
      }

      if (!session) {
        setMemberships([]);
        return;
      }
      const mine = await supabase
        .from("guild_memberships")
        .select("guild_id, status")
        .eq("user_id", session.userId);
      if (gone) return;
      if (mine.error) setError(mine.error.message);
      else setMemberships((mine.data ?? []) as OwnMembership[]);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, session, reloadToken]);

  const openMembership = useMemo(
    () => memberships.find((row) => row.status === "pending" || row.status === "active") ?? null,
    [memberships],
  );

  const membershipByGuild = useMemo(() => {
    const map = new Map<string, OwnMembership>();
    for (const row of memberships) map.set(row.guild_id, row);
    return map;
  }, [memberships]);

  // Your own guild (or the one you asked to join) comes first; the rest stay in name order.
  const visibleGuilds = useMemo(() => {
    const rank = (guild: Guild) => {
      if (isGuildMasterOf(guild, session?.discordUserId)) return 0;
      const status = membershipByGuild.get(guild.id)?.status;
      return status === "active" ? 0 : status === "pending" ? 1 : 2;
    };
    return guilds
      .filter((guild) => guildMatchesServerFilter(guild, serverFilter))
      .sort((a, b) => rank(a) - rank(b));
  }, [guilds, serverFilter, membershipByGuild, session?.discordUserId]);

  const beginJoin = (guild: Guild) => {
    setJoinGuildId(guild.id);
    setJoinNote("");
    setError("");
  };

  const cancelJoin = () => {
    setJoinGuildId(null);
    setJoinNote("");
  };

  const requestJoin = async (guild: Guild) => {
    if (!supabase || !session) return;
    setBusyId(guild.id);
    setError("");
    const note = normalizeGuildRequestNote(joinNote);
    const existing = membershipByGuild.get(guild.id);
    if (existing?.status === "rejected") {
      const { error: updateError } = await supabase
        .from("guild_memberships")
        .update({
          status: "pending",
          request_note: note,
          requested_at: new Date().toISOString(),
          decided_at: null,
          decided_by: null,
        })
        .eq("guild_id", guild.id)
        .eq("user_id", session.userId);
      if (updateError) setError(updateError.message);
      else {
        cancelJoin();
        reload();
      }
    } else {
      const { error: insertError } = await supabase.from("guild_memberships").insert({
        guild_id: guild.id,
        user_id: session.userId,
        status: "pending",
        request_note: note,
      });
      if (insertError) setError(insertError.message);
      else {
        cancelJoin();
        reload();
      }
    }
    setBusyId(null);
  };

  const withdrawOrLeave = async (guild: Guild) => {
    if (!supabase || !session) return;
    setBusyId(guild.id);
    setError("");
    const { error: updateError } = await supabase
      .from("guild_memberships")
      .update({
        status: "rejected",
        decided_at: new Date().toISOString(),
        decided_by: session.userId,
      })
      .eq("guild_id", guild.id)
      .eq("user_id", session.userId);
    if (updateError) setError(updateError.message);
    else reload();
    setBusyId(null);
  };

  const isSiteAdmin = session?.role === "admin";

  return (
    <>
      <SectionBanner id="guilds" />
      <PageHead eyebrow={t.navDescriptions.guilds} title={t.guilds.title} lede={t.guilds.lede} />

      <GuildCreateRequestPanel />

      {error && (
        <p className="result-error" role="alert">
          {error}
        </p>
      )}

      {!supabase && (
        <div className="notice notice-info">
          <p>{t.guilds.empty}</p>
        </div>
      )}

      <div className="guilds-browse">
        {supabase && guilds.length > 0 && (
          <div className="guild-toolbar">
          <div className="guild-filter">
            <SearchIcon className="icon" />
            <input
              type="search"
              value={serverFilter}
              autoComplete="off"
              spellCheck={false}
              aria-label={t.guilds.serverFilterLabel}
              placeholder={t.guilds.serverFilterPlaceholder}
              onChange={(e) => setServerFilter(e.target.value)}
            />
          </div>
          <p className="guild-count" aria-live="polite">
            {visibleGuilds.length === 1 ? t.guilds.listCountOne : tf(t.guilds.listCount, { count: visibleGuilds.length })}
          </p>
          </div>
        )}

        {supabase && guilds.length === 0 ? (
          <div className="empty-state">{authLoading ? t.guilds.loading : t.guilds.empty}</div>
        ) : visibleGuilds.length === 0 && guilds.length > 0 ? (
          <div className="empty-state">{t.guilds.serverFilterEmpty}</div>
        ) : visibleGuilds.length > 0 ? (
          <div className="guild-list">
            {visibleGuilds.map((guild) => {
            const membership = membershipByGuild.get(guild.id);
            const isDiscordMaster = isGuildMasterOf(guild, session?.discordUserId);
            const canManage = isDiscordMaster || isSiteAdmin;
            const isActiveMember = membership?.status === "active";
            const canEnter = canManage || isActiveMember;
            const isPending = membership?.status === "pending";
            const isRejected = membership?.status === "rejected";
            const blockedByOther =
              Boolean(openMembership) && openMembership?.guild_id !== guild.id && !canManage;
            const frozen = frozenIds.has(guild.id);
            const busy = busyId === guild.id;
            const drafting = joinGuildId === guild.id;
            const noteId = `${ids}-note-${guild.id}`;
            const statusLabel = isDiscordMaster
              ? t.guilds.master
              : isSiteAdmin
                ? t.guilds.siteAdmin
                : isActiveMember
                  ? t.guilds.member
                  : null;
            const statusClass = isDiscordMaster
              ? "pill pill-gold"
              : isSiteAdmin
                ? "pill status"
                : isActiveMember
                  ? "pill pill-good"
                  : "";

            const own = isDiscordMaster || isActiveMember;
            return (
              <article className={own ? "guild-card is-own" : "guild-card"} key={guild.id}>
                <div className="guild-card-head">
                  <GuildMark guild={guild} />
                  <div className="guild-card-top">
                    {own ? <p className="guild-card-eyebrow">{t.guilds.yourGuild}</p> : null}
                    <h2>{guild.name}</h2>
                    {guild.server_name ? (
                      <p className="guild-chip">
                        <GlobeIcon className="icon" />
                        <span className="visually-hidden">{t.guilds.serverLabel}: </span>
                        {guild.server_name}
                      </p>
                    ) : null}
                  </div>
                  {frozen ? (
                    <span className="pill pill-warn guild-frozen-pill" title={t.guilds.frozenHint}>
                      <LockIcon className="icon icon-sm" />
                      {t.guilds.frozen}
                    </span>
                  ) : null}
                  {statusLabel ? <span className={statusClass}>{statusLabel}</span> : null}
                </div>
                <div className="guild-card-body">
                  {guild.description ? <p className="guild-card-desc">{guild.description}</p> : null}
                  {isSiteAdmin ? (
                    <p className="guild-meta mono">
                      {t.guilds.masterIdLabel}: {guild.master_discord_user_id}
                    </p>
                  ) : null}
                  {drafting ? (
                    <div className="guild-join-form">
                      <div className="field">
                        <label htmlFor={noteId}>{t.guilds.requestNoteLabel}</label>
                        <textarea
                          id={noteId}
                          value={joinNote}
                          maxLength={GUILD_REQUEST_NOTE_MAX}
                          rows={3}
                          placeholder={t.guilds.requestNotePlaceholder}
                          onChange={(e) => setJoinNote(e.target.value)}
                        />
                        <p className="label-note">{t.guilds.requestNoteHint}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="guild-card-actions">
                  {canEnter && (
                    <>
                      <Link className="button button-primary" href={guildRoomHref(guild.slug)}>
                        {t.guilds.openRoom}
                      </Link>
                      {isActiveMember && !canManage && (
                        <button
                          className="small-button"
                          type="button"
                          disabled={busy}
                          onClick={() => void withdrawOrLeave(guild)}
                        >
                          {t.guilds.leave}
                        </button>
                      )}
                    </>
                  )}
                  {!canEnter && isPending && (
                    <>
                      <span className="pill">{t.guilds.pending}</span>
                      <button
                        className="small-button"
                        type="button"
                        disabled={busy}
                        onClick={() => void withdrawOrLeave(guild)}
                      >
                        {t.guilds.withdraw}
                      </button>
                    </>
                  )}
                  {!canEnter && !isPending && blockedByOther && (
                    <span className="pill pill-warn">{t.guilds.otherGuild}</span>
                  )}
                  {!canEnter && !isPending && !blockedByOther && !session && (
                    <button className="button button-primary" type="button" onClick={() => void signIn()}>
                      <DiscordIcon className="icon" />
                      {t.auth.signIn}
                    </button>
                  )}
                  {!canEnter && !isPending && frozen && session ? (
                    <span className="guild-meta">{t.guilds.frozenJoin}</span>
                  ) : null}
                  {!canEnter && !isPending && !blockedByOther && !frozen && session && drafting && (
                    <>
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={busy}
                        onClick={() => void requestJoin(guild)}
                      >
                        {t.guilds.requestSend}
                      </button>
                      <button className="small-button" type="button" disabled={busy} onClick={cancelJoin}>
                        {t.guilds.requestCancel}
                      </button>
                    </>
                  )}
                  {!canEnter && !isPending && !blockedByOther && !frozen && session && !drafting && (
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={busy}
                      onClick={() => beginJoin(guild)}
                    >
                      {isRejected ? t.guilds.reapply : t.guilds.join}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          </div>
        ) : null}
      </div>

      {supabase && !session && !authLoading && guilds.length > 0 && (
        <p className="assumption">{t.guilds.signInToJoin}</p>
      )}
    </>
  );
}
