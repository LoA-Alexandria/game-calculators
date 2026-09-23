"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  MESSAGE_BODY_MAX,
  chatOrder,
  conversations,
  normalizeBody,
  peopleInMessages,
  thread,
  unreadChat,
  unreadMail,
  type MessageRow,
} from "../../lib/content/messages";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useAuth } from "../components/AuthProvider";
import { useDocumentTitle, useLocale } from "../components/LocaleProvider";
import { ChevronIcon, GuildsIcon, InboxIcon, PlusIcon, SearchIcon, UsersIcon } from "../components/Icons";
import { PageHead } from "../components/Ui";

const COLUMNS = "id, kind, sender_id, recipient_id, guild_id, alliance_id, subject, body, created_at, read_at";
const POLL_MS = 20_000;

type Channel = { id: string; label: string };
type Person = { user_id: string; name: string };

/**
 * The post room: direct mail with anybody, the guild chat, and the chat the
 * two guilds of an alliance share. Everything is read straight from
 * `messages`, which RLS already limits to what the reader may see.
 */
export function MailRoom() {
  const { t, tf, d } = useLocale();
  const { session, loading: authLoading } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();
  const me = session?.userId ?? "";

  const [tab, setTab] = useState<"direct" | "guild" | "alliance">("direct");
  const [mail, setMail] = useState<MessageRow[]>([]);
  const [chat, setChat] = useState<MessageRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [guild, setGuild] = useState<Channel | null>(null);
  const [alliance, setAlliance] = useState<Channel | null>(null);
  const [reads, setReads] = useState<Record<string, string>>({});
  const [openWith, setOpenWith] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [draft, setDraft] = useState("");
  const [blocked, setBlocked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const bottom = useRef<HTMLDivElement | null>(null);

  useDocumentTitle(t.messages.title);
  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  // Which chats this reader has: their guild, and the alliance it is in.
  useEffect(() => {
    if (!supabase || !me) return;
    let gone = false;
    void (async () => {
      const membership = await supabase
        .from("guild_memberships")
        .select("guild_id")
        .eq("user_id", me)
        .eq("status", "active")
        .maybeSingle();
      if (gone) return;
      const guildId = (membership.data?.guild_id as string | undefined) ?? null;
      if (!guildId) {
        setGuild(null);
        setAlliance(null);
        return;
      }
      const [guildRow, allianceRows] = await Promise.all([
        supabase.from("guilds").select("id, name").eq("id", guildId).maybeSingle(),
        supabase
          .from("guild_alliances")
          .select("id, event_id, from_guild_id, to_guild_id")
          .eq("status", "accepted")
          .or(`from_guild_id.eq.${guildId},to_guild_id.eq.${guildId}`),
      ]);
      if (gone) return;
      const own = (guildRow.data as { id: string; name: string } | null) ?? null;
      setGuild(own ? { id: own.id, label: own.name } : null);
      const live = (allianceRows.data ?? []) as { id: string; from_guild_id: string; to_guild_id: string }[];
      const first = live[0] ?? null;
      if (!first) {
        setAlliance(null);
        return;
      }
      const partnerId = first.from_guild_id === guildId ? first.to_guild_id : first.from_guild_id;
      const partner = await supabase.from("guilds").select("name").eq("id", partnerId).maybeSingle();
      if (gone) return;
      setAlliance({ id: first.id, label: (partner.data?.name as string | undefined) ?? t.messages.tabAlliance });
    })();
    return () => {
      gone = true;
    };
  }, [supabase, me, t.messages.tabAlliance, tick]);

  // Direct mail, both ways.
  useEffect(() => {
    if (!supabase || !me) return;
    let gone = false;
    void (async () => {
      const { data, error: mailError } = await supabase
        .from("messages")
        .select(COLUMNS)
        .eq("kind", "direct")
        .order("created_at", { ascending: false })
        .limit(300);
      if (gone) return;
      if (mailError) setError(mailError.message);
      else setMail((data ?? []) as MessageRow[]);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, me, tick]);

  const channel = tab === "guild" ? guild : tab === "alliance" ? alliance : null;
  const channelKind = tab === "guild" ? "guild" : "alliance";

  useEffect(() => {
    if (!supabase || !me || !channel) return;
    let gone = false;
    void (async () => {
      const column = channelKind === "guild" ? "guild_id" : "alliance_id";
      const { data, error: chatError } = await supabase
        .from("messages")
        .select(COLUMNS)
        .eq("kind", channelKind)
        .eq(column, channel.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (gone) return;
      if (chatError) setError(chatError.message);
      else setChat((data ?? []) as MessageRow[]);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, me, channel, channelKind, tick]);

  // How far this reader got in each chat, and who they blocked.
  useEffect(() => {
    if (!supabase || !me) return;
    let gone = false;
    void (async () => {
      const [readRows, blockRows] = await Promise.all([
        supabase.from("message_reads").select("kind, channel_id, last_read_at").eq("user_id", me),
        supabase.from("message_blocks").select("blocked_id").eq("blocker_id", me),
      ]);
      if (gone) return;
      const marks: Record<string, string> = {};
      for (const row of (readRows.data ?? []) as { kind: string; channel_id: string; last_read_at: string }[]) {
        marks[`${row.kind}:${row.channel_id}`] = row.last_read_at;
      }
      setReads(marks);
      setBlocked(((blockRows.data ?? []) as { blocked_id: string }[]).map((row) => row.blocked_id));
    })();
    return () => {
      gone = true;
    };
  }, [supabase, me, tick]);

  // One name lookup for everybody on screen.
  const seen = useMemo(() => peopleInMessages([...mail, ...chat]).join(","), [mail, chat]);
  useEffect(() => {
    if (!supabase || !seen) return;
    let gone = false;
    void (async () => {
      const wanted = seen.split(",");
      const { data } = await supabase.rpc("message_names", { p_ids: wanted });
      if (gone) return;
      const found: Record<string, string> = {};
      for (const row of (data ?? []) as Person[]) found[row.user_id] = row.name;
      setNames((current) => ({ ...current, ...found }));
    })();
    return () => {
      gone = true;
    };
  }, [supabase, seen]);

  const nameOf = (id: string) => (id === me ? t.messages.you : names[id] ?? `${id.slice(0, 8)}…`);

  const search = async (value: string) => {
    if (!supabase) return;
    setQuery(value);
    const { data, error: searchError } = await supabase.rpc("find_people", { p_query: value });
    if (searchError) setError(searchError.message);
    else setPeople((data ?? []) as Person[]);
  };

  const openThread = async (other: string) => {
    setOpenWith(other);
    setComposing(false);
    setDraft("");
    if (!supabase) return;
    const unread = mail.some((row) => row.sender_id === other && row.recipient_id === me && row.read_at === null);
    if (!unread) return;
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("kind", "direct")
      .eq("sender_id", other)
      .eq("recipient_id", me)
      .is("read_at", null);
    reload();
  };

  const sendMail = async () => {
    if (!supabase || !openWith) return;
    const body = normalizeBody(draft);
    if (!body) return;
    setBusy(true);
    setError("");
    const { error: sendError } = await supabase.rpc("send_direct_message", {
      p_recipient_id: openWith,
      p_subject: "",
      p_body: body,
    });
    if (sendError) setError(sendError.message);
    else {
      setDraft("");
      reload();
    }
    setBusy(false);
  };

  const sendChat = async () => {
    if (!supabase || !channel) return;
    const body = normalizeBody(draft);
    if (!body) return;
    setBusy(true);
    setError("");
    const { error: sendError } = await supabase.from("messages").insert({
      kind: channelKind,
      sender_id: me,
      ...(channelKind === "guild" ? { guild_id: channel.id } : { alliance_id: channel.id }),
      body,
    });
    if (sendError) setError(sendError.message);
    else {
      setDraft("");
      reload();
    }
    setBusy(false);
  };

  const markChannelRead = async () => {
    if (!supabase || !channel) return;
    await supabase.from("message_reads").upsert(
      { user_id: me, kind: channelKind, channel_id: channel.id, last_read_at: new Date().toISOString() },
      { onConflict: "user_id,kind,channel_id" },
    );
    reload();
  };

  const toggleBlock = async (other: string) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    if (blocked.includes(other)) {
      const { error: unblockError } = await supabase
        .from("message_blocks")
        .delete()
        .eq("blocker_id", me)
        .eq("blocked_id", other);
      if (unblockError) setError(unblockError.message);
    } else {
      const { error: blockError } = await supabase
        .from("message_blocks")
        .insert({ blocker_id: me, blocked_id: other });
      if (blockError) setError(blockError.message);
    }
    reload();
    setBusy(false);
  };

  const threads = conversations(mail, me);
  const open = openWith ? thread(mail, me, openWith) : [];
  const chatRows = chatOrder(chat);
  const mailUnread = unreadMail(mail, me);
  const chatUnread = channel ? unreadChat(chat, me, reads[`${channelKind}:${channel.id}`] ?? null) : 0;

  // Reading a chat moves the mark along, once the rows are in.
  useEffect(() => {
    if (tab === "direct" || !channel || chatUnread === 0) return;
    const id = window.setTimeout(() => void markChannelRead(), 800);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, channel, chatUnread]);

  useEffect(() => {
    if (tab !== "direct" && bottom.current) bottom.current.scrollIntoView({ block: "end" });
  }, [tab, chatRows.length]);

  if (authLoading) return null;
  if (!session) {
    return (
      <>
        <PageHead title={t.messages.title} lede={t.messages.lede} />
        <section className="panel">
          <p className="guild-panel-empty">{t.messages.signIn}</p>
        </section>
      </>
    );
  }

  const composer = (send: () => void) => (
    <form
      className="mail-composer"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <label className="visually-hidden" htmlFor={`${ids}-draft`}>
        {t.messages.write}
      </label>
      <textarea
        id={`${ids}-draft`}
        value={draft}
        rows={2}
        maxLength={MESSAGE_BODY_MAX}
        placeholder={t.messages.write}
        disabled={busy}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            send();
          }
        }}
      />
      <button className="button button-primary" type="submit" disabled={busy || normalizeBody(draft) === ""}>
        {t.messages.send}
      </button>
    </form>
  );

  const bubbles = (rows: MessageRow[]) => (
    <ul className="mail-thread">
      {rows.map((row) => (
        <li key={row.id} className={row.sender_id === me ? "mail-bubble is-mine" : "mail-bubble"}>
          <p className="mail-bubble-head">
            <strong>{nameOf(row.sender_id)}</strong>
            <span>{d(row.created_at.slice(0, 10))}</span>
          </p>
          <p className="mail-bubble-body">{row.body}</p>
        </li>
      ))}
      <div ref={bottom} />
    </ul>
  );

  return (
    <>
      <PageHead title={t.messages.title} lede={t.messages.lede} />

      {error ? (
        <p className="result-error" role="alert">
          {error}
        </p>
      ) : null}

      <nav className="mail-tabs" aria-label={t.messages.title}>
        <button
          type="button"
          className={tab === "direct" ? "guild-tab is-active" : "guild-tab"}
          aria-pressed={tab === "direct"}
          onClick={() => {
            setTab("direct");
            setDraft("");
          }}
        >
          <InboxIcon className="icon icon-sm" />
          {t.messages.tabDirect}
          {mailUnread > 0 ? <span className="mail-count">{mailUnread}</span> : null}
        </button>
        <button
          type="button"
          className={tab === "guild" ? "guild-tab is-active" : "guild-tab"}
          aria-pressed={tab === "guild"}
          disabled={!guild}
          onClick={() => {
            setTab("guild");
            setDraft("");
          }}
        >
          <GuildsIcon className="icon icon-sm" />
          {guild ? guild.label : t.messages.tabGuild}
        </button>
        <button
          type="button"
          className={tab === "alliance" ? "guild-tab is-active" : "guild-tab"}
          aria-pressed={tab === "alliance"}
          disabled={!alliance}
          onClick={() => {
            setTab("alliance");
            setDraft("");
          }}
        >
          <UsersIcon className="icon icon-sm" />
          {t.messages.tabAlliance}
        </button>
      </nav>

      {tab === "direct" ? (
        <section className="panel mail-panel">
          {openWith ? (
            <>
              <header className="mail-head">
                <button className="small-button" type="button" onClick={() => setOpenWith(null)}>
                  <ChevronIcon className="icon icon-sm" />
                  {t.messages.back}
                </button>
                <strong>{nameOf(openWith)}</strong>
                <button className="small-button" type="button" disabled={busy} onClick={() => void toggleBlock(openWith)}>
                  {blocked.includes(openWith) ? t.messages.unblock : t.messages.block}
                </button>
              </header>
              {blocked.includes(openWith) ? <p className="mail-note">{t.messages.blockedNote}</p> : null}
              {open.length === 0 ? <p className="guild-panel-empty">{t.messages.inboxEmpty}</p> : bubbles(open)}
              {composer(() => void sendMail())}
            </>
          ) : composing ? (
            <>
              <header className="mail-head">
                <button className="small-button" type="button" onClick={() => setComposing(false)}>
                  <ChevronIcon className="icon icon-sm" />
                  {t.messages.back}
                </button>
                <strong>{t.messages.compose}</strong>
              </header>
              <div className="field mail-search">
                <label htmlFor={`${ids}-search`}>{t.messages.searchLabel}</label>
                <span className="mail-search-field">
                  <SearchIcon className="icon icon-sm" />
                  <input
                    id={`${ids}-search`}
                    value={query}
                    placeholder={t.messages.searchPlaceholder}
                    onChange={(event) => void search(event.target.value)}
                  />
                </span>
              </div>
              {people.length === 0 ? (
                <p className="guild-panel-empty">{t.messages.searchEmpty}</p>
              ) : (
                <ul className="mail-people">
                  {people.map((person) => (
                    <li key={person.user_id}>
                      <span>{person.name}</span>
                      <button
                        className="small-button button-primary"
                        type="button"
                        onClick={() => void openThread(person.user_id)}
                      >
                        {t.messages.write}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <header className="mail-head">
                <strong>{t.messages.tabDirect}</strong>
                <button
                  className="small-button button-primary"
                  type="button"
                  onClick={() => {
                    setComposing(true);
                    void search("");
                  }}
                >
                  <PlusIcon className="icon icon-sm" />
                  {t.messages.compose}
                </button>
              </header>
              {threads.length === 0 ? (
                <p className="guild-panel-empty">{t.messages.inboxEmpty}</p>
              ) : (
                <ul className="mail-list">
                  {threads.map((entry) => (
                    <li key={entry.other}>
                      <button type="button" className="mail-row" onClick={() => void openThread(entry.other)}>
                        <span className="mail-row-name">
                          {nameOf(entry.other)}
                          {entry.unread > 0 ? <span className="mail-count">{entry.unread}</span> : null}
                        </span>
                        <span className="mail-row-last">{entry.last.body}</span>
                        <span className="mail-row-date">{d(entry.last.created_at.slice(0, 10))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      ) : (
        <section className="panel mail-panel">
          <header className="mail-head">
            <strong>{channel ? channel.label : tab === "guild" ? t.messages.tabGuild : t.messages.tabAlliance}</strong>
            {chatUnread > 0 ? <span className="mail-count">{tf(t.messages.unread, { count: chatUnread })}</span> : null}
          </header>
          {!channel ? (
            <p className="guild-panel-empty">{tab === "guild" ? t.messages.noGuild : t.messages.noAlliance}</p>
          ) : (
            <>
              {chatRows.length === 0 ? <p className="guild-panel-empty">{t.messages.chatEmpty}</p> : bubbles(chatRows)}
              {composer(() => void sendChat())}
            </>
          )}
        </section>
      )}
    </>
  );
}
