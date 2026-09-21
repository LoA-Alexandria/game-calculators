"use client";

import { useCallback, useEffect, useId, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GuildRichTextEditor, GuildRichTextView } from "./GuildRichText";
import { guildPostHtml, sanitizeGuildHtml } from "../../lib/content/guild-rich-text";
import {
  GUILD_ICON_BUCKET,
  guildIconObjectPath,
  guildIconPublicUrl,
  guildListHref,
  guildRoomHref,
  isGuildIconFile,
  isGuildMasterOf,
  readGuildSlugParam,
  type Guild,
  type GuildMembership,
  type GuildPost,
  type GuildRosterEntry,
  type GuildTab,
} from "../../lib/content/guilds";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { GuildsIcon, PenIcon, PlusIcon, TrashIcon } from "../components/Icons";
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
  void pathname;
  return useSyncExternalStore(subscribeSearch, readGuildSlug, () => null);
}

function GuildMark({ guild }: { guild: Guild }) {
  const iconUrl = guildIconPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, guild.icon_path);
  if (iconUrl) {
    return (
      <div className="guild-room-mark has-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconUrl} alt="" />
      </div>
    );
  }
  return (
    <div className="guild-room-mark" aria-hidden="true">
      <GuildsIcon className="icon" />
    </div>
  );
}

function formatDiscordId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function GuildRoom({ tab }: { tab: GuildTab }) {
  const { t, d } = useLocale();
  const { session, loading: authLoading } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const pathname = usePathname() ?? "";
  const slug = useGuildSlug(pathname);
  const ids = useId();

  const [guild, setGuild] = useState<Guild | null>(null);
  const [membership, setMembership] = useState<Pick<GuildMembership, "status"> | null>(null);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [posts, setPosts] = useState<GuildPost[]>([]);
  const [roster, setRoster] = useState<GuildRosterEntry[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [fetchedSlug, setFetchedSlug] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composeFor, setComposeFor] = useState<GuildTab | null>(null);
  const composing = composeFor === tab;

  const [editName, setEditName] = useState("");
  const [editServer, setEditServer] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useDocumentTitle(guild ? `${guild.name} · ${tab === "news" ? t.guilds.news : t.guilds.planung}` : t.guilds.title);

  useEffect(() => {
    if (!supabase || !slug) return;
    let gone = false;
    void (async () => {
      const listed = await supabase
        .from("guilds")
        .select("id, slug, name, description, server_name, icon_path, master_discord_user_id, created_at")
        .eq("slug", slug)
        .maybeSingle();
      if (gone) return;
      if (listed.error) {
        setError(listed.error.message);
        setGuild(null);
        setMembership(null);
        setPending([]);
        setPosts([]);
        setRoster([]);
        setFetchedSlug(slug);
        return;
      }
      const nextGuild = (listed.data as Guild | null) ?? null;
      setGuild(nextGuild);
      if (nextGuild) {
        setEditName(nextGuild.name);
        setEditServer(nextGuild.server_name ?? "");
      }
      if (!nextGuild || !session) {
        setMembership(null);
        setPending([]);
        setPosts([]);
        setRoster([]);
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

      const canManage =
        isGuildMasterOf(nextGuild, session.discordUserId) || session.role === "admin";
      const canEnter = canManage || mine.data?.status === "active";

      if (canManage) {
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

      if (canEnter) {
        const [feed, members] = await Promise.all([
          supabase
            .from("guild_posts")
            .select("id, guild_id, channel, title, body, author_id, created_at, updated_at")
            .eq("guild_id", nextGuild.id)
            .eq("channel", tab)
            .order("created_at", { ascending: false }),
          supabase.rpc("guild_roster", { p_guild_id: nextGuild.id }),
        ]);
        if (gone) return;
        if (feed.error) setError(feed.error.message);
        else setPosts((feed.data ?? []) as GuildPost[]);
        if (members.error) setError(members.error.message);
        else setRoster((members.data ?? []) as GuildRosterEntry[]);
      } else {
        setPosts([]);
        setRoster([]);
      }
      setFetchedSlug(slug);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, slug, session, reloadToken, tab]);

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

  const resetComposer = () => {
    setTitle("");
    setBody("");
    setEditingId(null);
    setComposeFor(null);
  };

  const savePost = async () => {
    if (!supabase || !session || !guild) return;
    const nextTitle = title.trim();
    const nextBody = sanitizeGuildHtml(body);
    if (!nextTitle) return;
    setBusy(true);
    setError("");
    if (editingId) {
      const { error: updateError } = await supabase
        .from("guild_posts")
        .update({
          title: nextTitle,
          body: nextBody,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);
      if (updateError) setError(updateError.message);
      else {
        resetComposer();
        reload();
      }
    } else {
      const { error: insertError } = await supabase.from("guild_posts").insert({
        guild_id: guild.id,
        channel: tab,
        title: nextTitle,
        body: nextBody,
        author_id: session.userId,
      });
      if (insertError) setError(insertError.message);
      else {
        resetComposer();
        reload();
      }
    }
    setBusy(false);
  };

  const startEdit = (post: GuildPost) => {
    setEditingId(post.id);
    setTitle(post.title);
    setBody(guildPostHtml(post.body));
    setComposeFor(tab);
  };

  const removePost = async (postId: string) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error: deleteError } = await supabase.from("guild_posts").delete().eq("id", postId);
    if (deleteError) setError(deleteError.message);
    else {
      if (editingId === postId) resetComposer();
      reload();
    }
    setBusy(false);
  };

  const saveSettings = async () => {
    if (!supabase || !guild) return;
    const nextName = editName.trim();
    if (nextName.length < 2) return;
    if (iconFile && !isGuildIconFile(iconFile)) {
      setError(t.admin.guildsIconInvalid);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");

    let nextIconPath = guild.icon_path;
    if (iconFile) {
      const path = guildIconObjectPath(guild.id, iconFile.type);
      if (!path) {
        setError(t.admin.guildsIconInvalid);
        setBusy(false);
        return;
      }
      if (guild.icon_path && guild.icon_path !== path) {
        await supabase.storage.from(GUILD_ICON_BUCKET).remove([guild.icon_path]);
      }
      const { error: uploadError } = await supabase.storage
        .from(GUILD_ICON_BUCKET)
        .upload(path, iconFile, { upsert: true, contentType: iconFile.type });
      if (uploadError) {
        setError(uploadError.message);
        setBusy(false);
        return;
      }
      nextIconPath = path;
    }

    const { error: updateError } = await supabase
      .from("guilds")
      .update({
        name: nextName,
        server_name: editServer.trim().slice(0, 80),
        icon_path: nextIconPath,
      })
      .eq("id", guild.id);
    if (updateError) setError(updateError.message);
    else {
      setIconFile(null);
      setNotice(t.guilds.settingsSaved);
      reload();
    }
    setBusy(false);
  };

  const removeIcon = async () => {
    if (!supabase || !guild?.icon_path) return;
    setBusy(true);
    setError("");
    await supabase.storage.from(GUILD_ICON_BUCKET).remove([guild.icon_path]);
    const { error: updateError } = await supabase
      .from("guilds")
      .update({ icon_path: null })
      .eq("id", guild.id);
    if (updateError) setError(updateError.message);
    else {
      setIconFile(null);
      setNotice(t.guilds.settingsSaved);
      reload();
    }
    setBusy(false);
  };

  if (!slug) {
    return (
      <>
        <SectionBanner id="guilds" />
        <PageHead title={t.guilds.title} lede={t.guilds.noSlug} />
        <Link className="guild-back" href={guildListHref()}>
          ← {t.guilds.backToList}
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
        <Link className="guild-back" href={guildListHref()}>
          ← {t.guilds.backToList}
        </Link>
      </>
    );
  }

  const isDiscordMaster = isGuildMasterOf(guild, session.discordUserId);
  const isSiteAdmin = session.role === "admin";
  const canManage = isDiscordMaster || isSiteAdmin;
  const canEnter = canManage || membership?.status === "active";

  if (!canEnter) {
    return (
      <>
        <SectionBanner id="guilds" />
        <PageHead eyebrow={guild.name} title={t.guilds.title} lede={t.guilds.roomGate} />
        <Link className="guild-back" href={guildListHref()}>
          ← {t.guilds.backToList}
        </Link>
      </>
    );
  }

  return (
    <div className="guild-room">
      <SectionBanner id="guilds" />
      <div className="guild-room-head">
        <GuildMark guild={guild} />
        <PageHead
          eyebrow={t.nav.guilds}
          title={guild.name}
          lede={
            [guild.server_name, guild.description].filter(Boolean).join(" · ")
            || t.navDescriptions.guilds
          }
        />
      </div>

      <div className="guild-room-toolbar">
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
        {(isDiscordMaster || isSiteAdmin) && (
          <span className={isDiscordMaster ? "pill pill-gold" : "pill status"}>
            {isDiscordMaster ? t.guilds.master : t.guilds.siteAdmin}
          </span>
        )}
      </div>

      {error && (
        <p className="result-error" role="alert">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="result-ok" role="status">
          {notice}
        </p>
      )}

      <div className="guild-room-layout">
        <div className="guild-room-main">
          {canManage && (
            <section className="guild-panel">
              <header className="guild-panel-head">
                <h2>{t.guilds.settingsTitle}</h2>
              </header>
              <div className="guild-settings">
                <div className="field">
                  <label htmlFor={`${ids}-name`}>{t.guilds.nameLabel}</label>
                  <input
                    id={`${ids}-name`}
                    value={editName}
                    maxLength={80}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`${ids}-server`}>{t.guilds.serverLabel}</label>
                  <input
                    id={`${ids}-server`}
                    value={editServer}
                    maxLength={80}
                    placeholder="S9 - Garden"
                    onChange={(e) => setEditServer(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`${ids}-icon`}>{t.guilds.iconChange}</label>
                  <input
                    id={`${ids}-icon`}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setIconFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="guild-settings-actions">
                  <button
                    className="button button-primary"
                    type="button"
                    disabled={busy || editName.trim().length < 2}
                    onClick={() => void saveSettings()}
                  >
                    {t.guilds.settingsSave}
                  </button>
                  {guild.icon_path ? (
                    <button
                      className="small-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void removeIcon()}
                    >
                      {t.guilds.iconRemove}
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          )}

          {canManage && (
            <section className="guild-panel guild-pending">
              <header className="guild-panel-head">
                <h2>{t.guilds.pendingTitle}</h2>
                <span className="count">{pending.length}</span>
              </header>
              {pending.length === 0 ? (
                <p className="guild-panel-empty">{t.guilds.pendingEmpty}</p>
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

          {canManage && !composing && (
            <div className="guild-compose-trigger">
              <button
                className="button button-primary"
                type="button"
                onClick={() => {
                  setComposeFor(tab);
                  setEditingId(null);
                  setTitle("");
                  setBody("");
                }}
              >
                <PlusIcon className="icon" />
                {t.guilds.composeOpen}
              </button>
            </div>
          )}

          {canManage && composing && (
            <section className="guild-panel">
              <header className="guild-panel-head">
                <h2>{editingId ? t.guilds.postEdit : tab === "news" ? t.guilds.composeNews : t.guilds.composePlanung}</h2>
                <button className="small-button" type="button" disabled={busy} onClick={resetComposer}>
                  {t.guilds.composeClose}
                </button>
              </header>
              <div className="guild-compose">
                <div className="field">
                  <label htmlFor={`${ids}-title`}>{t.guilds.postTitle}</label>
                  <input
                    id={`${ids}-title`}
                    value={title}
                    maxLength={120}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <GuildRichTextEditor
                  id={`${ids}-body`}
                  label={t.guilds.postBody}
                  value={body}
                  onChange={setBody}
                  disabled={busy}
                />
                <div className="guild-compose-actions">
                  <button
                    className="button button-primary"
                    type="button"
                    disabled={busy || !title.trim()}
                    onClick={() => void savePost()}
                  >
                    <PlusIcon className="icon" />
                    {editingId ? t.guilds.postEdit : t.guilds.postAdd}
                  </button>
                  <button className="small-button" type="button" disabled={busy} onClick={resetComposer}>
                    {t.guilds.postCancel}
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="guild-panel">
            <header className="guild-panel-head">
              <h2>{tab === "news" ? t.guilds.news : t.guilds.planung}</h2>
              <span className="count">{posts.length}</span>
            </header>
            {posts.length === 0 ? (
              <div className="guild-empty">
                <GuildsIcon className="icon guild-empty-icon" />
                <strong>{t.guilds.emptyTitle}</strong>
                <p>{tab === "news" ? t.guilds.newsEmpty : t.guilds.planungEmpty}</p>
              </div>
            ) : (
              <ul className="guild-post-list">
                {posts.map((post) => (
                  <li className="guild-post" key={post.id}>
                    <div className="guild-post-head">
                      <h3>{post.title}</h3>
                      <time dateTime={post.created_at}>{d(post.created_at.slice(0, 10))}</time>
                    </div>
                    <GuildRichTextView html={guildPostHtml(post.body)} />
                    {canManage && (
                      <div className="guild-post-actions">
                        <button
                          className="small-button"
                          type="button"
                          disabled={busy}
                          onClick={() => startEdit(post)}
                        >
                          <PenIcon className="icon icon-sm" />
                          {t.guilds.postEdit}
                        </button>
                        <button
                          className="small-button button-danger"
                          type="button"
                          disabled={busy}
                          onClick={() => void removePost(post.id)}
                        >
                          <TrashIcon className="icon icon-sm" />
                          {t.guilds.postRemove}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="guild-roster" aria-label={t.guilds.membersTitle}>
          <header className="guild-panel-head">
            <h2>{t.guilds.membersTitle}</h2>
            <span className="count">{roster.length}</span>
          </header>
          {roster.length === 0 ? (
            <p className="guild-panel-empty">{t.guilds.membersEmpty}</p>
          ) : (
            <ul className="guild-roster-list">
              {roster.map((entry, index) => {
                const key = entry.user_id ?? entry.discord_user_id ?? String(index);
                const isYou = Boolean(entry.user_id && entry.user_id === session.userId);
                return (
                  <li key={key}>
                    <span className="guild-roster-id mono">{formatDiscordId(entry.discord_user_id)}</span>
                    <span className="guild-roster-tags">
                      {entry.is_master ? <span className="pill pill-gold">{t.guilds.master}</span> : null}
                      {isYou ? <span className="pill">{t.guilds.membersYou}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>

      <Link className="guild-back" href={guildListHref()}>
        ← {t.guilds.backToList}
      </Link>
    </div>
  );
}
