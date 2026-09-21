"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  guildListHref,
  guildRoomHref,
  isGuildMasterOf,
  readGuildSlugParam,
  type Guild,
  type GuildMembership,
  type GuildTab,
} from "../../lib/content/guilds";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { SignInCard } from "../components/SignInGate";
import { PageHead, SectionBanner } from "../components/Ui";

type PendingRow = Pick<GuildMembership, "guild_id" | "user_id" | "status" | "requested_at">;

function subscribeSearch(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function readGuildSlug(): string | null {
  return readGuildSlugParam(new URLSearchParams(window.location.search).get("guild"));
}

function useGuildSlug(pathname: string): string | null {
  // `pathname` is read so client navigations between room tabs re-sample search.
  void pathname;
  return useSyncExternalStore(subscribeSearch, readGuildSlug, () => null);
}

export function GuildRoom({ tab }: { tab: GuildTab }) {
  const { t } = useLocale();
  const { session, loading: authLoading } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const pathname = usePathname() ?? "";
  const slug = useGuildSlug(pathname);

  const [guild, setGuild] = useState<Guild | null>(null);
  const [membership, setMembership] = useState<Pick<GuildMembership, "status"> | null>(null);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [fetchedSlug, setFetchedSlug] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useDocumentTitle(guild ? `${guild.name} · ${tab === "news" ? t.guilds.news : t.guilds.planung}` : t.guilds.title);

  useEffect(() => {
    if (!supabase || !slug) return;
    let gone = false;
    void (async () => {
      const listed = await supabase
        .from("guilds")
        .select("id, slug, name, description, master_discord_user_id, created_at")
        .eq("slug", slug)
        .maybeSingle();
      if (gone) return;
      if (listed.error) {
        setError(listed.error.message);
        setGuild(null);
        setMembership(null);
        setPending([]);
        setFetchedSlug(slug);
        return;
      }
      const nextGuild = (listed.data as Guild | null) ?? null;
      setGuild(nextGuild);
      if (!nextGuild || !session) {
        setMembership(null);
        setPending([]);
        setFetchedSlug(slug);
        return;
      }

      const mine = await supabase
        .from("guild_memberships")
        .select("status")
        .eq("guild_id", nextGuild.id)
        .eq("user_id", session.userId)
        .maybeSingle();
      if (gone) return;
      if (mine.error) setError(mine.error.message);
      else setMembership(mine.data ? { status: mine.data.status as GuildMembership["status"] } : null);

      const isMaster =
        isGuildMasterOf(nextGuild, session.discordUserId) || session.role === "admin";
      if (isMaster) {
        const queue = await supabase
          .from("guild_memberships")
          .select("guild_id, user_id, status, requested_at")
          .eq("guild_id", nextGuild.id)
          .eq("status", "pending")
          .order("requested_at");
        if (gone) return;
        if (queue.error) setError(queue.error.message);
        else setPending((queue.data ?? []) as PendingRow[]);
      } else {
        setPending([]);
      }
      setFetchedSlug(slug);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, slug, session, reloadToken]);

  const decide = async (userId: string, status: "active" | "rejected") => {
    if (!supabase || !session || !guild) return;
    setBusy(true);
    setError("");
    const { error: updateError } = await supabase
      .from("guild_memberships")
      .update({
        status,
        decided_at: new Date().toISOString(),
        decided_by: session.userId,
      })
      .eq("guild_id", guild.id)
      .eq("user_id", userId);
    if (updateError) setError(updateError.message);
    else reload();
    setBusy(false);
  };

  if (!slug) {
    return (
      <>
        <SectionBanner id="guilds" />
        <PageHead title={t.guilds.title} lede={t.guilds.noSlug} />
        <Link className="small-button" href={guildListHref()}>
          {t.guilds.backToList}
        </Link>
      </>
    );
  }

  if (authLoading || (supabase && fetchedSlug !== slug)) {
    return (
      <>
        <SectionBanner id="guilds" />
        <div className="empty-state">{t.guilds.loading}</div>
      </>
    );
  }

  if (!session) return <SignInCard />;

  if (!guild) {
    return (
      <>
        <SectionBanner id="guilds" />
        <PageHead title={t.guilds.title} lede={t.guilds.notFound} />
        <Link className="small-button" href={guildListHref()}>
          {t.guilds.backToList}
        </Link>
      </>
    );
  }

  const isMaster = isGuildMasterOf(guild, session.discordUserId) || session.role === "admin";
  const canEnter = isMaster || membership?.status === "active";

  if (!canEnter) {
    return (
      <>
        <SectionBanner id="guilds" />
        <PageHead eyebrow={guild.name} title={t.guilds.title} lede={t.guilds.roomGate} />
        <Link className="small-button" href={guildListHref()}>
          {t.guilds.backToList}
        </Link>
      </>
    );
  }

  return (
    <>
      <SectionBanner id="guilds" />
      <PageHead
        eyebrow={t.nav.guilds}
        title={guild.name}
        lede={guild.description || t.navDescriptions.guilds}
      />

      <nav className="guild-tabs" aria-label={guild.name}>
        <Link
          className={tab === "news" ? "guild-tab is-active" : "guild-tab"}
          href={guildRoomHref(guild.slug, "news")}
          aria-current={tab === "news" ? "page" : undefined}
        >
          {t.guilds.news}
        </Link>
        <Link
          className={tab === "planung" ? "guild-tab is-active" : "guild-tab"}
          href={guildRoomHref(guild.slug, "planung")}
          aria-current={tab === "planung" ? "page" : undefined}
        >
          {t.guilds.planung}
        </Link>
      </nav>

      {error && (
        <p className="result-error" role="alert">
          {error}
        </p>
      )}

      {isMaster && (
        <section className="panel guild-pending">
          <h2>{t.guilds.pendingTitle}</h2>
          {pending.length === 0 ? (
            <p className="muted">{t.guilds.pendingEmpty}</p>
          ) : (
            <ul className="guild-pending-list">
              {pending.map((row) => (
                <li key={row.user_id}>
                  <span className="mono">{row.user_id.slice(0, 8)}…</span>
                  <span className="guild-pending-actions">
                    <button
                      className="small-button button-primary"
                      type="button"
                      disabled={busy}
                      onClick={() => void decide(row.user_id, "active")}
                    >
                      {t.guilds.approve}
                    </button>
                    <button
                      className="small-button button-danger"
                      type="button"
                      disabled={busy}
                      onClick={() => void decide(row.user_id, "rejected")}
                    >
                      {t.guilds.reject}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="panel">
        <h2>{tab === "news" ? t.guilds.news : t.guilds.planung}</h2>
        <p>{tab === "news" ? t.guilds.newsEmpty : t.guilds.planungEmpty}</p>
      </section>

      <p>
        <Link className="small-button" href={guildListHref()}>
          {t.guilds.backToList}
        </Link>
      </p>
    </>
  );
}
