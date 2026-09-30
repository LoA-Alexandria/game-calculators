import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  MESSAGE_BODY_MAX,
  chatOrder,
  conversations,
  counterpart,
  mergeChatRows,
  normalizeBody,
  normalizeSubject,
  peopleInMessages,
  thread,
  unreadChat,
  unreadMail,
} from "../lib/content/messages.ts";

const ME = "u-me";
const FRIEND = "u-friend";
const OTHER = "u-other";

function mail(id, overrides = {}) {
  return {
    id,
    kind: "direct",
    sender_id: FRIEND,
    recipient_id: ME,
    guild_id: null,
    alliance_id: null,
    subject: "",
    body: "hi",
    created_at: "2026-09-24T10:00:00Z",
    read_at: null,
    ...overrides,
  };
}

describe("message helpers", () => {
  it("names the other side of a letter, whichever way it went", () => {
    assert.equal(counterpart(mail("a"), ME), FRIEND);
    assert.equal(counterpart(mail("b", { sender_id: ME, recipient_id: FRIEND }), ME), FRIEND);
    assert.equal(counterpart(mail("c", { kind: "guild", recipient_id: null, guild_id: "g1" }), ME), null);
  });

  it("folds mail into one entry per correspondent, newest first", () => {
    const rows = [
      mail("a", { created_at: "2026-09-24T09:00:00Z" }),
      mail("b", { sender_id: ME, recipient_id: FRIEND, created_at: "2026-09-24T11:00:00Z" }),
      mail("c", { sender_id: OTHER, created_at: "2026-09-24T12:00:00Z" }),
    ];
    const list = conversations(rows, ME);
    assert.deepEqual(list.map((entry) => entry.other), [OTHER, FRIEND]);
    assert.equal(list[0].unread, 1);
    // One unread from the friend; the one we sent ourselves never counts.
    assert.equal(list[1].unread, 1);
    assert.equal(list[1].last.id, "b");
  });

  it("reads a thread oldest first and leaves other people out", () => {
    const rows = [
      mail("a", { created_at: "2026-09-24T09:00:00Z" }),
      mail("b", { sender_id: ME, recipient_id: FRIEND, created_at: "2026-09-24T11:00:00Z" }),
      mail("c", { sender_id: OTHER, created_at: "2026-09-24T12:00:00Z" }),
    ];
    assert.deepEqual(thread(rows, ME, FRIEND).map((row) => row.id), ["a", "b"]);
  });

  it("counts only letters that came in and were never opened", () => {
    const rows = [
      mail("a"),
      mail("b", { read_at: "2026-09-24T10:05:00Z" }),
      mail("c", { sender_id: ME, recipient_id: FRIEND }),
    ];
    assert.equal(unreadMail(rows, ME), 1);
  });

  it("counts chat messages written since the reader last looked, except their own", () => {
    const rows = [
      mail("a", { kind: "guild", recipient_id: null, guild_id: "g1", created_at: "2026-09-24T09:00:00Z" }),
      mail("b", { kind: "guild", recipient_id: null, guild_id: "g1", created_at: "2026-09-24T11:00:00Z" }),
      mail("c", { kind: "guild", sender_id: ME, recipient_id: null, guild_id: "g1", created_at: "2026-09-24T12:00:00Z" }),
    ];
    assert.equal(unreadChat(rows, ME, "2026-09-24T10:00:00Z"), 1);
    assert.equal(unreadChat(rows, ME, null), 2, "never opened means everything but our own");
    assert.equal(unreadChat(rows, ME, "2026-09-24T23:00:00Z"), 0);
  });

  it("collects every name the screen has to resolve", () => {
    const ids = peopleInMessages([mail("a"), mail("b", { sender_id: OTHER, recipient_id: ME })]);
    assert.deepEqual(ids.sort(), [FRIEND, ME, OTHER].sort());
  });

  it("survives a row that came back without a date", () => {
    const rows = [mail("a", { created_at: undefined }), mail("b")];
    assert.doesNotThrow(() => chatOrder(rows));
    assert.doesNotThrow(() => conversations(rows, ME));
    assert.equal(chatOrder(rows)[0].id, "a", "a row with no date sorts first, not into a crash");
  });

  it("puts a chat in reading order", () => {
    const rows = [mail("b", { created_at: "2026-09-24T12:00:00Z" }), mail("a", { created_at: "2026-09-24T09:00:00Z" })];
    assert.deepEqual(chatOrder(rows).map((row) => row.id), ["a", "b"]);
  });

  it("merges loaded history and realtime inserts without duplicates, keeping the newest rows", () => {
    const rows = [
      mail("a", { created_at: "2026-09-24T09:00:00Z" }),
      mail("b", { created_at: "2026-09-24T10:00:00Z" }),
    ];
    assert.deepEqual(mergeChatRows(rows, [rows[1], mail("c", { created_at: "2026-09-24T11:00:00Z" })]).map((row) => row.id), ["a", "b", "c"]);
    assert.deepEqual(mergeChatRows(rows, [mail("c", { created_at: "2026-09-24T11:00:00Z" })], 2).map((row) => row.id), ["b", "c"]);
  });

  it("publishes guild messages for Realtime and keeps frozen guild chats read-only", () => {
    const migration = readFileSync(new URL("../supabase/migrations/20261011120000_guild_chat_realtime.sql", import.meta.url), "utf8");
    assert.match(migration, /alter publication supabase_realtime add table public\.messages/i);
    assert.match(migration, /kind = 'guild' and public\.is_guild_member\(guild_id\) and not public\.guild_is_frozen\(guild_id\)/i);
    assert.match(migration, /kind = 'alliance' and public\.is_alliance_member\(alliance_id\)/i);
    assert.match(migration, /sender_id = auth\.uid\(\)/i);
  });

  it("trims what goes into the columns", () => {
    assert.equal(normalizeSubject("  two   words  "), "two words");
    assert.equal(normalizeBody("  hello  "), "hello");
    assert.equal(normalizeBody("x".repeat(MESSAGE_BODY_MAX + 50)).length, MESSAGE_BODY_MAX);
  });
});
