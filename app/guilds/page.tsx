"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  guildRoomHref,
  isGuildMasterOf,
  type Guild,
  type GuildMembership,
} from "../../lib/content/guilds";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { DiscordIcon, GuildsIcon } from "../components/Icons";
import { PageHead, SectionBanner } from "../components/Ui";

type OwnMembership = Pick<GuildMembership, "guild_id" | "status">;

export default function GuildsPage() {
  const { t } = useLocale();
  const { session, loading: authLoading, signIn } = useAuth();
  const supabase = getSupabaseBrowserClient();
  useDocumentTitle(t.guilds.title);

  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [memberships, setMemberships] = useState<OwnMembership[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const listed = await supabase
        .from("guilds")
        .select("id, slug, name, description, master_discord_user_id, created_at")
        .order("name");
      if (gone) return;
      if (listed.error) setError(listed.error.message);
      else setGuilds((listed.data ?? []) as Guild[]);

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

  const requestJoin = async (guild: Guild) => {
    if (!supabase || !session) return;
    setBusyId(guild.id);
    setError("");
    const existing = membershipByGuild.get(guild.id);
    if (existing?.status === "rejected") {
      const { error: updateError } = await supabase
        .from("guild_memberships")
        .update({ status: "pending", requested_at: new Date().toISOString(), decided_at: null, decided_by: null })
        .eq("guild_id", guild.id)
        .eq("user_id", session.userId);
      if (updateError) setError(updateError.message);
      else reload();
    } else {
      const { error: insertError } = await supabase.from("guild_memberships").insert({
        guild_id: guild.id,
        user_id: session.userId,
        status: "pending",
      });
      if (insertError) setError(insertError.message);
      else reload();
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

      {supabase && guilds.length === 0 ? (
        <div className="empty-state">{authLoading ? t.guilds.loading : t.guilds.empty}</div>
      ) : (
        <div className="guild-list">
          {guilds.map((guild) => {
            const membership = membershipByGuild.get(guild.id);
            const isDiscordMaster = isGuildMasterOf(guild, session?.discordUserId);
            const canManage = isDiscordMaster || isSiteAdmin;
            const isActiveMember = membership?.status === "active";
            const canEnter = canManage || isActiveMember;
            const isPending = membership?.status === "pending";
            const isRejected = membership?.status === "rejected";
            const blockedByOther =
              Boolean(openMembership) && openMembership?.guild_id !== guild.id && !canManage;
            const busy = busyId === guild.id;
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

            return (
              <article className="guild-card" key={guild.id}>
                <div className="guild-card-mark" aria-hidden="true">
                  <GuildsIcon className="icon" />
                </div>
                <div className="guild-card-body">
                  <div className="guild-card-top">
                    <h2>{guild.name}</h2>
                    {statusLabel ? <span className={statusClass}>{statusLabel}</span> : null}
                  </div>
                  {guild.description ? <p className="guild-card-desc">{guild.description}</p> : null}
                  {isSiteAdmin ? (
                    <p className="guild-meta mono">
                      {t.guilds.masterIdLabel}: {guild.master_discord_user_id}
                    </p>
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
                  {!canEnter && !isPending && !blockedByOther && session && (
                    <button
                      className="button button-primary"
                      type="button"
                      disabled={busy}
                      onClick={() => void requestJoin(guild)}
                    >
                      {isRejected ? t.guilds.reapply : t.guilds.join}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {supabase && !session && !authLoading && guilds.length > 0 && (
        <p className="assumption">{t.guilds.signInToJoin}</p>
      )}
    </>
  );
}
