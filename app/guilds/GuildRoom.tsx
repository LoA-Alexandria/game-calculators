"use client";

import { useCallback, useEffect, useId, useState, useSyncExternalStore, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GuildEventBoard, GuildEventPicker } from "./GuildEventBoard";
import { GuildRichTextEditor, GuildRichTextView } from "./GuildRichText";
import { guildPostHtml, sanitizeGuildHtml } from "../../lib/content/guild-rich-text";
import {
  GUILD_PLAN_EVENTS,
  isGuildPlanEventId,
  guildPlanEventDef,
  type GuildPlanEventId,
} from "../../lib/content/guild-events";
import {
  GUILD_DISPLAY_NAME_MAX,
  GUILD_ICON_BUCKET,
  guildIconObjectPath,
  guildIconPublicUrl,
  guildListHref,
  guildRoomHref,
  guildRosterLabel,
  isGuildIconFile,
  isGuildMasterOf,
  normalizeGuildDisplayName,
  readGuildSlugParam,
  type Guild,
  type GuildMembership,
  type GuildPost,
  type GuildRosterEntry,
  type GuildTab,
} from "../../lib/content/guilds";
import { asset } from "../../lib/site";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import {
  CloseIcon,
  EventsIcon,
  GearIcon,
  GlobeIcon,
  GuildsIcon,
  InboxIcon,
  NewsIcon,
  PenIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from "../components/Icons";
import { SignInCard } from "../components/SignInGate";
import { PageHead, SectionBanner } from "../components/Ui";

type PendingRow = Pick<GuildMembership, "guild_id" | "user_id" | "status" | "request_note" | "requested_at">;
type ManagePanel = "requests" | "settings" | null;
type MembershipState = Pick<GuildMembership, "status" | "role">;

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

/** Up to two letters for a member's avatar. */
function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return letters.toUpperCase();
}

/** A stable colour per member, so the same person keeps the same avatar. */
function avatarTone(key: string): number {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 6;
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

type AllianceOffer = {
  id: string;
  event_id: GuildPlanEventId;
  from_guild_id: string;
  note: string;
  name: string;
};

export function GuildRoom({ tab }: { tab: GuildTab }) {
  const { t, tf, d } = useLocale();
  const { session, loading: authLoading } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const slug = useGuildSlug(pathname);
  const ids = useId();

  const [guild, setGuild] = useState<Guild | null>(null);
  const [membership, setMembership] = useState<MembershipState | null>(null);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [posts, setPosts] = useState<GuildPost[]>([]);
  const [roster, setRoster] = useState<GuildRosterEntry[]>([]);
  const [activeEventIds, setActiveEventIds] = useState<GuildPlanEventId[]>([]);
  const [planEventId, setPlanEventId] = useState<GuildPlanEventId | null>(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
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
  const [managePanel, setManagePanel] = useState<ManagePanel>(null);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [managingRoster, setManagingRoster] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [offers, setOffers] = useState<AllianceOffer[]>([]);

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
        setActiveEventIds([]);
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
        setActiveEventIds([]);
        setFetchedSlug(slug);
        return;
      }

      const mine = await supabase
        .from("guild_memberships")
        .select("status, role")
        .eq("guild_id", nextGuild.id)
        .eq("user_id", session.userId)
        .maybeSingle();
      if (gone) return;
      if (mine.error) setError(mine.error.message);
      else {
        setMembership(
          mine.data
            ? {
                status: mine.data.status as GuildMembership["status"],
                role: (mine.data.role as GuildMembership["role"]) ?? "member",
              }
            : null,
        );
      }

      const isMaster =
        isGuildMasterOf(nextGuild, session.discordUserId) || session.role === "admin";
      const isOfficerMember = mine.data?.status === "active" && mine.data?.role === "officer";
      const canOfficer = isMaster || Boolean(isOfficerMember);
      const canEnter = isMaster || mine.data?.status === "active";

      if (canOfficer) {
        const queue = await supabase
          .from("guild_memberships")
          .select("guild_id, user_id, status, request_note, requested_at")
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
        const [feed, members, active] = await Promise.all([
          supabase
            .from("guild_posts")
            .select("id, guild_id, channel, title, body, author_id, created_at, updated_at")
            .eq("guild_id", nextGuild.id)
            .eq("channel", tab)
            .order("created_at", { ascending: false }),
          supabase.rpc("guild_roster", { p_guild_id: nextGuild.id }),
          supabase.from("guild_active_events").select("event_id").eq("guild_id", nextGuild.id),
        ]);
        if (gone) return;
        if (feed.error) setError(feed.error.message);
        else setPosts((feed.data ?? []) as GuildPost[]);
        if (members.error) setError(members.error.message);
        else {
          setRoster(
            ((members.data ?? []) as GuildRosterEntry[]).map((row) => ({
              ...row,
              is_officer: Boolean(row.is_officer),
            })),
          );
        }
        if (active.error) setError(active.error.message);
        else {
          const ids = (active.data ?? [])
            .map((row) => row.event_id as string)
            .filter(isGuildPlanEventId);
          setActiveEventIds(ids);
          setPlanEventId((current) => {
            if (current && ids.includes(current)) return current;
            return ids[0] ?? null;
          });
        }
      } else {
        setPosts([]);
        setRoster([]);
        setActiveEventIds([]);
      }
      setFetchedSlug(slug);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, slug, session, reloadToken, tab]);

  // Alliance offers reach the guild through the same inbox as join requests,
  // so nobody has to open an event to find out somebody asked.
  useEffect(() => {
    if (!supabase || !guild) return;
    let gone = false;
    void (async () => {
      const { data, error: offerError } = await supabase
        .from("guild_alliances")
        .select("id, event_id, from_guild_id, note, created_at")
        .eq("to_guild_id", guild.id)
        .eq("status", "pending");
      if (gone) return;
      if (offerError) {
        setOffers([]);
        return;
      }
      const rows = (data ?? []).filter((row) => isGuildPlanEventId(row.event_id as string));
      const ids = [...new Set(rows.map((row) => row.from_guild_id as string))];
      let names: Record<string, string> = {};
      if (ids.length > 0) {
        const listed = await supabase.from("guilds").select("id, name").in("id", ids);
        if (gone) return;
        names = Object.fromEntries(((listed.data ?? []) as { id: string; name: string }[]).map((g) => [g.id, g.name]));
      }
      setOffers(
        rows.map((row) => ({
          id: row.id as string,
          event_id: row.event_id as GuildPlanEventId,
          from_guild_id: row.from_guild_id as string,
          note: (row.note as string) ?? "",
          name: names[row.from_guild_id as string] ?? "",
        })),
      );
    })();
    return () => {
      gone = true;
    };
  }, [supabase, guild, reloadToken]);

  /** Taking an offer turns the event on and opens it straight away. */
  const answerOffer = async (offer: AllianceOffer, status: "accepted" | "declined") => {
    if (!supabase || !guild) return;
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("respond_to_guild_alliance", {
      p_alliance_id: offer.id,
      p_status: status,
    });
    if (rpcError) {
      setError(rpcError.message);
      setBusy(false);
      return;
    }
    if (status === "accepted") {
      if (!activeEventIds.includes(offer.event_id)) {
        const { error: activateError } = await supabase
          .from("guild_active_events")
          .insert({ guild_id: guild.id, event_id: offer.event_id });
        if (activateError && !/duplicate|unique/i.test(activateError.message)) setError(activateError.message);
      }
      setPlanEventId(offer.event_id);
      setManagePanel(null);
      if (tab !== "planung") router.push(guildRoomHref(guild.slug, "planung"));
    }
    reload();
    setBusy(false);
  };

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

  const startEditDisplayName = (entry: GuildRosterEntry) => {
    setDisplayNameDraft(entry.display_name?.trim() || "");
    setEditingDisplayName(true);
  };

  const saveDisplayName = async () => {
    if (!supabase || !guild) return;
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("set_guild_display_name", {
      p_guild_id: guild.id,
      p_name: normalizeGuildDisplayName(displayNameDraft),
    });
    if (rpcError) setError(rpcError.message);
    else {
      setEditingDisplayName(false);
      reload();
    }
    setBusy(false);
  };

  const setMemberRole = async (userId: string, role: "member" | "officer") => {
    if (!supabase || !guild) return;
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("set_guild_member_role", {
      p_guild_id: guild.id,
      p_user_id: userId,
      p_role: role,
    });
    if (rpcError) setError(rpcError.message);
    else reload();
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
  const canManageSettings = isDiscordMaster || isSiteAdmin;
  const canOfficer =
    canManageSettings || (membership?.status === "active" && membership.role === "officer");
  const canEnter = canManageSettings || membership?.status === "active";

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

  const ownRole = isDiscordMaster
    ? { label: t.guilds.master, className: "pill pill-gold" }
    : membership?.status === "active" && membership.role === "officer"
      ? { label: t.guilds.officer, className: "pill" }
      : membership?.status === "active"
        ? { label: t.guilds.member, className: "pill pill-good" }
        : isSiteAdmin
          ? { label: t.guilds.siteAdmin, className: "pill status" }
          : null;
  const nameOf = (userId: string) => {
    const entry = roster.find((row) => row.user_id === userId);
    return entry ? guildRosterLabel(entry) : null;
  };
  const rosterGroups = [
    { id: "master", label: t.guilds.master, rows: roster.filter((entry) => entry.is_master) },
    { id: "officers", label: t.guilds.officersGroup, rows: roster.filter((entry) => !entry.is_master && entry.is_officer) },
    { id: "members", label: t.guilds.membersGroup, rows: roster.filter((entry) => !entry.is_master && !entry.is_officer) },
  ].filter((group) => group.rows.length > 0);

  const startCompose = () => {
    setComposeFor("news");
    setEditingId(null);
    setTitle("");
    setBody("");
  };

  const composer = (
    <section className="guild-panel guild-compose-panel">
      <header className="guild-panel-head">
        <h2>{editingId ? t.guilds.composeEdit : t.guilds.composeNews}</h2>
        <button
          className="icon-button"
          type="button"
          aria-label={t.guilds.composeClose}
          disabled={busy}
          onClick={resetComposer}
        >
          <CloseIcon className="icon icon-sm" />
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
            {editingId ? t.guilds.postEdit : t.guilds.postAdd}
          </button>
          <button className="small-button" type="button" disabled={busy} onClick={resetComposer}>
            {t.guilds.postCancel}
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <div className="guild-room">
      <header
        className="guild-hero"
        style={{ "--guild-hero-image": `url("${asset("/banners/guides-scene.webp")}")` } as CSSProperties}
      >
        <div className="guild-hero-art" aria-hidden="true" />
        <div className="guild-hero-body">
          <GuildMark guild={guild} />
          <div className="guild-hero-text">
            <p className="guild-hero-eyebrow">{t.guilds.guildEyebrow}</p>
            <h1>{guild.name}</h1>
            <ul className="guild-hero-meta">
              {guild.server_name ? (
                <li className="guild-chip">
                  <GlobeIcon className="icon" />
                  {guild.server_name}
                </li>
              ) : null}
              <li className="guild-chip">
                <UsersIcon className="icon" />
                {roster.length === 1 ? t.guilds.heroMembersOne : tf(t.guilds.heroMembers, { count: roster.length })}
              </li>
              {ownRole ? (
                <li>
                  <span className={ownRole.className}>{ownRole.label}</span>
                </li>
              ) : null}
            </ul>
          </div>
          <div className="guild-hero-tools">
            <button
              type="button"
              className={rosterOpen ? "icon-button guild-roster-toggle is-open" : "icon-button guild-roster-toggle"}
              aria-label={rosterOpen ? t.guilds.membersClose : t.guilds.membersOpen}
              aria-expanded={rosterOpen}
              aria-controls={`${ids}-roster`}
              onClick={() => setRosterOpen((open) => !open)}
            >
              <UsersIcon className="icon" />
            </button>
            {canOfficer ? (
              <button
                type="button"
                className={managePanel === "requests" ? "icon-button is-open" : "icon-button"}
                aria-label={t.guilds.requestsOpen}
                aria-expanded={managePanel === "requests"}
                aria-controls={`${ids}-requests`}
                onClick={() => setManagePanel((open) => (open === "requests" ? null : "requests"))}
              >
                <InboxIcon className="icon" />
                {pending.length + offers.length > 0 ? (
                  <span className="guild-tool-badge" aria-hidden="true">{pending.length + offers.length}</span>
                ) : null}
              </button>
            ) : null}
            {canManageSettings ? (
              <button
                type="button"
                className={managePanel === "settings" ? "icon-button is-open" : "icon-button"}
                aria-label={t.guilds.settingsOpen}
                aria-expanded={managePanel === "settings"}
                aria-controls={`${ids}-settings`}
                onClick={() => setManagePanel((open) => (open === "settings" ? null : "settings"))}
              >
                <GearIcon className="icon" />
              </button>
            ) : null}
          </div>
          {guild.description ? <p className="guild-hero-desc">{guild.description}</p> : null}
        </div>
        <nav className="guild-hero-tabs" aria-label={guild.name}>
          <Link
            className={tab === "news" ? "guild-hero-tab is-active" : "guild-hero-tab"}
            href={guildRoomHref(guild.slug, "news")}
            aria-current={tab === "news" ? "page" : undefined}
          >
            <NewsIcon className="icon" />
            {t.guilds.news}
          </Link>
          <Link
            className={tab === "planung" ? "guild-hero-tab is-active" : "guild-hero-tab"}
            href={guildRoomHref(guild.slug, "planung")}
            aria-current={tab === "planung" ? "page" : undefined}
          >
            <EventsIcon className="icon" />
            {t.guilds.planung}
          </Link>
        </nav>
      </header>

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

      {canOfficer && managePanel === "requests" ? (
        <section className="guild-panel guild-manage-panel" id={`${ids}-requests`}>
          <header className="guild-panel-head">
            <h2>{t.guilds.inboxTitle}</h2>
            <span className="count">{pending.length + offers.length}</span>
          </header>
          {offers.length > 0 ? (
            <ul className="guild-pending-list guild-offer-list">
              {offers.map((offer) => (
                <li key={offer.id}>
                  <span className="guild-avatar" aria-hidden="true">
                    <GuildsIcon className="icon icon-sm" />
                  </span>
                  <div className="guild-pending-meta">
                    <p className="guild-pending-who">
                      <strong>{tf(t.guilds.allianceIncoming, { guild: offer.name })}</strong>
                      <span>{t.guilds.events[guildPlanEventDef(offer.event_id).labelKey]}</span>
                    </p>
                    <p className={offer.note.trim() ? "guild-pending-note" : "guild-pending-note is-empty"}>
                      {offer.note.trim() || t.guilds.requestNoteEmpty}
                    </p>
                  </div>
                  <span className="guild-pending-actions">
                    <button
                      className="small-button button-primary"
                      type="button"
                      disabled={busy}
                      onClick={() => void answerOffer(offer, "accepted")}
                    >
                      {t.guilds.allianceAccept}
                    </button>
                    <button
                      className="small-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void answerOffer(offer, "declined")}
                    >
                      {t.guilds.allianceDecline}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {pending.length === 0 && offers.length === 0 ? (
            <p className="guild-panel-empty">{t.guilds.pendingEmpty}</p>
          ) : (
            <ul className="guild-pending-list">
              {pending.map((row) => (
                <li key={row.user_id}>
                  <span className="guild-avatar" aria-hidden="true">?</span>
                  <div className="guild-pending-meta">
                    <p className="guild-pending-who">
                      <strong>{t.guilds.applicant}</strong>
                      <span className="mono">{row.user_id.slice(0, 8)}</span>
                      <span>{tf(t.guilds.requestedOn, { date: d(row.requested_at.slice(0, 10)) })}</span>
                    </p>
                    <p className={row.request_note.trim() ? "guild-pending-note" : "guild-pending-note is-empty"}>
                      {row.request_note.trim() || t.guilds.requestNoteEmpty}
                    </p>
                  </div>
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
      ) : null}

      {canManageSettings && managePanel === "settings" ? (
        <section className="guild-panel guild-manage-panel" id={`${ids}-settings`}>
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
            <div className="field guild-settings-icon">
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
      ) : null}

      <div className="guild-room-layout">
        <div className="guild-room-main">
          {tab === "planung" ? (
            <>
              {activeEventIds.length > 0 ? (
                <nav className="guild-event-tabs" aria-label={t.guilds.planung}>
                  {activeEventIds.map((id) => {
                    const def = GUILD_PLAN_EVENTS.find((e) => e.id === id);
                    if (!def) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={planEventId === id ? "guild-tab is-active" : "guild-tab"}
                        aria-pressed={planEventId === id}
                        onClick={() => setPlanEventId(id)}
                      >
                        {t.guilds.events[def.labelKey]}
                      </button>
                    );
                  })}
                </nav>
              ) : null}
              {planEventId ? (
                <GuildEventBoard
                  guildId={guild.id}
                  guildName={guild.name}
                  userId={session.userId}
                  canOfficer={canOfficer}
                  roster={roster}
                  eventId={planEventId}
                  onManageEvents={() => setEventPickerOpen(true)}
                />
              ) : (
                <section className="guild-panel">
                  <div className="guild-empty">
                    <EventsIcon className="icon guild-empty-icon" />
                    <strong>{t.guilds.emptyTitle}</strong>
                    <p>{t.guilds.eventsActiveEmpty}</p>
                    {canOfficer ? (
                      <button className="small-button button-primary" type="button" onClick={() => setEventPickerOpen(true)}>
                        <PlusIcon className="icon icon-sm" />
                        {t.guilds.eventsActivate}
                      </button>
                    ) : null}
                  </div>
                </section>
              )}
              {canOfficer ? (
                <GuildEventPicker
                  guildId={guild.id}
                  activeIds={activeEventIds}
                  canOfficer={canOfficer}
                  open={eventPickerOpen}
                  onClose={() => setEventPickerOpen(false)}
                  onChanged={reload}
                />
              ) : null}
            </>
          ) : (
            <>
              {canOfficer && composing ? composer : null}
              <section className="guild-panel">
                <header className="guild-panel-head">
                  <h2>
                    {t.guilds.news}
                    <span className="count">{posts.length}</span>
                  </h2>
                  {canOfficer && !composing ? (
                    <button className="small-button button-primary" type="button" onClick={startCompose}>
                      <PlusIcon className="icon icon-sm" />
                      {t.guilds.composeOpen}
                    </button>
                  ) : null}
                </header>
                {posts.length === 0 ? (
                  <div className="guild-empty">
                    <NewsIcon className="icon guild-empty-icon" />
                    <strong>{t.guilds.emptyTitle}</strong>
                    <p>{t.guilds.newsEmpty}</p>
                  </div>
                ) : (
                  <ul className="guild-post-list">
                    {posts.map((post) => {
                      const author = nameOf(post.author_id);
                      const edited = Date.parse(post.updated_at) - Date.parse(post.created_at) > 60_000;
                      return (
                        <li className="guild-post" key={post.id}>
                          <header className="guild-post-head">
                            <div className="guild-post-title">
                              <h3>{post.title}</h3>
                              <p className="guild-post-meta">
                                {author ? <span>{author}</span> : null}
                                <time dateTime={post.created_at}>{d(post.created_at.slice(0, 10))}</time>
                                {edited ? <span>{t.guilds.postEdited}</span> : null}
                              </p>
                            </div>
                            {canOfficer ? (
                              <div className="guild-post-tools">
                                <button
                                  className="icon-button"
                                  type="button"
                                  disabled={busy}
                                  aria-label={t.guilds.postEditStart}
                                  title={t.guilds.postEditStart}
                                  onClick={() => startEdit(post)}
                                >
                                  <PenIcon className="icon icon-sm" />
                                </button>
                                <button
                                  className="icon-button guild-post-delete"
                                  type="button"
                                  disabled={busy}
                                  aria-label={t.guilds.postRemove}
                                  title={t.guilds.postRemove}
                                  aria-expanded={confirmDeleteId === post.id}
                                  onClick={() => setConfirmDeleteId((current) => (current === post.id ? null : post.id))}
                                >
                                  <TrashIcon className="icon icon-sm" />
                                </button>
                              </div>
                            ) : null}
                          </header>
                          {confirmDeleteId === post.id ? (
                            <div className="guild-post-confirm" role="alert">
                              <span>{t.guilds.postRemoveConfirm}</span>
                              <button
                                className="small-button button-danger"
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  setConfirmDeleteId(null);
                                  void removePost(post.id);
                                }}
                              >
                                {t.guilds.postRemove}
                              </button>
                              <button className="small-button" type="button" onClick={() => setConfirmDeleteId(null)}>
                                {t.guilds.postCancel}
                              </button>
                            </div>
                          ) : null}
                          <GuildRichTextView html={guildPostHtml(post.body)} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>

        <aside
          className={rosterOpen ? "guild-roster is-open" : "guild-roster"}
          id={`${ids}-roster`}
          aria-label={t.guilds.membersTitle}
        >
          <header className="guild-panel-head">
            <h2>
              {t.guilds.membersTitle}
              <span className="count">{roster.length}</span>
            </h2>
            <span className="guild-roster-head-actions">
              {canManageSettings && roster.length > 1 ? (
                <button
                  type="button"
                  className="small-button"
                  aria-pressed={managingRoster}
                  onClick={() => setManagingRoster((value) => !value)}
                >
                  {managingRoster ? t.guilds.rosterManageDone : t.guilds.rosterManage}
                </button>
              ) : null}
              <button
                type="button"
                className="icon-button guild-roster-drawer-close"
                aria-label={t.guilds.membersClose}
                onClick={() => setRosterOpen(false)}
              >
                <CloseIcon className="icon" />
              </button>
            </span>
          </header>
          {roster.length === 0 ? (
            <p className="guild-panel-empty">{t.guilds.membersEmpty}</p>
          ) : (
            rosterGroups.map((group) => (
              <section className="guild-roster-group" key={group.id}>
                {rosterGroups.length > 1 ? (
                  <h3>
                    {group.label}
                    <span>{group.rows.length}</span>
                  </h3>
                ) : null}
                <ul className="guild-roster-list">
                  {group.rows.map((entry, index) => {
                    const key = entry.user_id ?? entry.discord_user_id ?? `${group.id}-${index}`;
                    const isYou = Boolean(
                      (entry.user_id && entry.user_id === session.userId)
                      || (!entry.user_id && entry.is_master && isDiscordMaster),
                    );
                    const editingYou = isYou && editingDisplayName;
                    const named = Boolean(entry.display_name?.trim());
                    const label = guildRosterLabel(entry);
                    return (
                      <li key={key} className={isYou ? "guild-member is-you" : "guild-member"}>
                        <span className="guild-avatar" data-tone={avatarTone(key)} aria-hidden="true">
                          {named ? initials(label) : "?"}
                        </span>
                        {editingYou ? (
                          <div className="guild-roster-edit">
                            <label className="visually-hidden" htmlFor={`${ids}-display-name`}>
                              {t.guilds.displayNameLabel}
                            </label>
                            <input
                              id={`${ids}-display-name`}
                              value={displayNameDraft}
                              maxLength={GUILD_DISPLAY_NAME_MAX}
                              placeholder={t.guilds.displayNamePlaceholder}
                              autoComplete="nickname"
                              onChange={(e) => setDisplayNameDraft(e.target.value)}
                            />
                            <div className="guild-roster-edit-actions">
                              <button
                                className="small-button button-primary"
                                type="button"
                                disabled={busy}
                                onClick={() => void saveDisplayName()}
                              >
                                {t.guilds.displayNameSave}
                              </button>
                              <button
                                className="small-button"
                                type="button"
                                disabled={busy}
                                onClick={() => setEditingDisplayName(false)}
                              >
                                {t.guilds.postCancel}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="guild-member-name">
                              {named ? label : t.guilds.unnamedMember}
                              {!named ? <small className="mono">{label}</small> : null}
                            </span>
                            <span className="guild-roster-tags">
                              {isYou ? <span className="pill">{t.guilds.membersYou}</span> : null}
                              {isYou ? (
                                <button
                                  className="icon-button guild-roster-edit-btn"
                                  type="button"
                                  disabled={busy}
                                  aria-label={t.guilds.displayNameEdit}
                                  title={t.guilds.displayNameEdit}
                                  onClick={() => startEditDisplayName(entry)}
                                >
                                  <PenIcon className="icon icon-sm" />
                                </button>
                              ) : null}
                            </span>
                            {managingRoster && canManageSettings && entry.user_id && !entry.is_master ? (
                              <button
                                className="small-button guild-member-manage"
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void setMemberRole(
                                    entry.user_id!,
                                    entry.is_officer ? "member" : "officer",
                                  )
                                }
                              >
                                {entry.is_officer ? t.guilds.demoteOfficer : t.guilds.promoteOfficer}
                              </button>
                            ) : null}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </aside>
      </div>

      {rosterOpen ? (
        <button
          type="button"
          className="guild-roster-scrim"
          aria-label={t.guilds.membersClose}
          onClick={() => setRosterOpen(false)}
        />
      ) : null}

      <Link className="guild-back" href={guildListHref()}>
        ← {t.guilds.backToList}
      </Link>
    </div>
  );
}
