"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  MESSAGE_BODY_MAX,
  chatOrder,
  mergeChatRows,
  normalizeBody,
  type MessageRow,
} from "../../lib/content/messages";
import type { GuildRosterEntry } from "../../lib/content/guilds";
import { guildRosterLabel } from "../../lib/content/guilds";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useLocale } from "../components/LocaleProvider";
import { useAuth } from "../components/AuthProvider";
import { ChatIcon } from "../components/Icons";

const COLUMNS = "id, kind, sender_id, recipient_id, guild_id, alliance_id, subject, body, created_at, read_at";
const HISTORY_LIMIT = 200;

/** Stable name colours are decorative, not ranks or online indicators. */
function nameTone(id: string): number {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 6;
}

type ChatConnection = "connecting" | "live" | "reconnecting";

export function GuildChatPanel({
  guildId,
  roster,
  frozen,
  canWrite,
}: {
  guildId: string;
  roster: GuildRosterEntry[];
  frozen: boolean;
  canWrite: boolean;
}) {
  const { t, d, locale } = useLocale();
  const { session } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();
  const me = session?.userId ?? "";
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<ChatConnection>("connecting");
  const bottom = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (!supabase || !me) return;
    let gone = false;

    const markRead = () => supabase.from("message_reads").upsert(
      { user_id: me, kind: "guild", channel_id: guildId, last_read_at: new Date().toISOString() },
      { onConflict: "user_id,kind,channel_id" },
    );

    const channel = supabase
      .channel(`guild-chat:${guildId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `guild_id=eq.${guildId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          if (row.kind === "guild" && row.guild_id === guildId) {
            setRows((current) => mergeChatRows(current, [row], HISTORY_LIMIT));
            if (row.sender_id !== me) void markRead();
          }
        },
      )
      .subscribe((status) => {
        if (gone) return;
        setConnection(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "reconnecting" : "connecting");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setError(t.guilds.chatConnectionError);
        else if (status === "SUBSCRIBED") setError((current) => current === t.guilds.chatConnectionError ? "" : current);
      });

    void (async () => {
      const { data, error: historyError } = await supabase
        .from("messages")
        .select(COLUMNS)
        .eq("kind", "guild")
        .eq("guild_id", guildId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);
      if (gone) return;
      if (historyError) {
        setError(historyError.message);
        return;
      }
      setRows((current) => mergeChatRows(current, (data ?? []) as MessageRow[], HISTORY_LIMIT));
      void markRead();
    })();

    return () => {
      gone = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, me, guildId, t.guilds.chatConnectionError]);

  const ordered = chatOrder(rows);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [ordered.length]);

  const send = async () => {
    if (!supabase || !me || !canWrite || busy) return;
    const body = normalizeBody(draft);
    if (!body) return;
    setBusy(true);
    setError("");
    const { data, error: sendError } = await supabase
      .from("messages")
      .insert({ kind: "guild", guild_id: guildId, sender_id: me, body })
      .select(COLUMNS)
      .single();
    if (sendError) setError(sendError.message);
    else {
      setRows((current) => mergeChatRows(current, [data as MessageRow], HISTORY_LIMIT));
      setDraft("");
    }
    setBusy(false);
  };

  const nameOf = (userId: string) => {
    const entry = roster.find((member) => member.user_id === userId);
    return userId === me ? t.guilds.membersYou : entry ? guildRosterLabel(entry) : t.guilds.chatUnknownMember;
  };

  return (
    <section className="guild-panel guild-chat-panel" aria-labelledby="guild-chat-title">
      <header className="guild-panel-head guild-chat-head">
        <h2 id="guild-chat-title"><ChatIcon className="icon" />{t.guilds.chatTitle}</h2>
        <span className={`guild-chat-status is-${connection}`} role="status">
          <span aria-hidden="true" />
          {connection === "live" ? t.guilds.chatLive : connection === "reconnecting" ? t.guilds.chatReconnecting : t.guilds.chatConnecting}
        </span>
      </header>

      {error ? <p className="result-error" role="alert">{error}</p> : null}

      {ordered.length === 0 ? (
        <div className="guild-chat-empty">
          <ChatIcon className="icon guild-empty-icon" />
          <strong>{t.guilds.emptyTitle}</strong>
          <p>{t.guilds.chatEmpty}</p>
        </div>
      ) : (
        <ol className="guild-chat-thread" aria-label={t.guilds.chatTitle} aria-live="polite" aria-relevant="additions" tabIndex={0}>
          {ordered.map((row) => (
            <li key={row.id} className={`guild-chat-line${row.sender_id === me ? " is-mine" : ""}`}>
              <time dateTime={row.created_at} title={d(row.created_at)} aria-label={new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at))}>
                {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(row.created_at))}
              </time>
              <p className="guild-chat-message">
                <span className="guild-chat-channel">[{t.messages.tabGuild}] </span>
                <strong className={`guild-chat-name tone-${nameTone(row.sender_id)}`}>[{nameOf(row.sender_id)}]</strong>
                <span className="guild-chat-body">: {row.body}</span>
              </p>
            </li>
          ))}
          <li className="guild-chat-scroll-anchor" aria-hidden="true" ref={bottom} />
        </ol>
      )}

      {!canWrite ? <p className="mail-note">{frozen ? t.guilds.chatFrozenReadOnly : t.guilds.chatReadOnly}</p> : null}
      <form
        className="mail-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="visually-hidden" htmlFor={`${ids}-message`}>{t.guilds.chatWrite}</label>
        <textarea
          id={`${ids}-message`}
          value={draft}
          rows={2}
          maxLength={MESSAGE_BODY_MAX}
          placeholder={t.guilds.chatWrite}
          disabled={busy || !canWrite}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button className="button button-primary" type="submit" disabled={busy || !canWrite || !normalizeBody(draft)}>
          {busy ? t.guilds.chatSending : t.guilds.chatSend}
        </button>
      </form>
      <p className="guild-chat-hint">{t.guilds.chatKeyboardHint}</p>
    </section>
  );
}
