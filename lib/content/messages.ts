/**
 * Messages: direct mail between two players, the guild chat, and the chat two
 * allied guilds share.
 *
 * Everything here is pure. The rows come from `messages`, which keeps all three
 * kinds in one table and tells them apart by `kind`.
 */

export const MESSAGE_KINDS = ["direct", "guild", "alliance"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const MESSAGE_SUBJECT_MAX = 120;
export const MESSAGE_BODY_MAX = 2000;

export type MessageRow = {
  id: string;
  kind: MessageKind;
  sender_id: string;
  recipient_id: string | null;
  guild_id: string | null;
  alliance_id: string | null;
  subject: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

/** One correspondent, their last letter, and what is still unread from them. */
export type Conversation = {
  other: string;
  last: MessageRow;
  unread: number;
};

/** A row off the wire may be missing its date; sorting must not fall over it. */
function when(row: MessageRow): string {
  return row.created_at ?? "";
}

/** Trim a message and cut it to what the column takes. */
export function normalizeBody(value: string): string {
  return value.trim().slice(0, MESSAGE_BODY_MAX);
}

export function normalizeSubject(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, MESSAGE_SUBJECT_MAX);
}

/** The other side of a direct message, seen from `me`. */
export function counterpart(row: MessageRow, me: string): string | null {
  if (row.kind !== "direct") return null;
  return row.sender_id === me ? row.recipient_id : row.sender_id;
}

/**
 * Direct mail folded into one entry per correspondent, newest first. A letter
 * counts as unread only when it came in and was never opened.
 */
export function conversations(rows: readonly MessageRow[], me: string): Conversation[] {
  const byOther = new Map<string, Conversation>();
  for (const row of rows) {
    const other = counterpart(row, me);
    if (!other) continue;
    const unread = row.recipient_id === me && row.read_at === null ? 1 : 0;
    const seen = byOther.get(other);
    if (!seen) {
      byOther.set(other, { other, last: row, unread });
      continue;
    }
    seen.unread += unread;
    if (when(row) > when(seen.last)) seen.last = row;
  }
  return [...byOther.values()].sort((a, b) => when(b.last).localeCompare(when(a.last)));
}

/** The letters exchanged with one player, oldest first. */
export function thread(rows: readonly MessageRow[], me: string, other: string): MessageRow[] {
  return rows
    .filter((row) => counterpart(row, me) === other)
    .slice()
    .sort((a, b) => when(a).localeCompare(when(b)));
}

/** Letters that came in and were never opened. */
export function unreadMail(rows: readonly MessageRow[], me: string): number {
  return rows.filter((row) => row.kind === "direct" && row.recipient_id === me && row.read_at === null).length;
}

/**
 * Chat messages written after the reader last looked. Their own messages never
 * count, so writing something does not leave a mark on yourself.
 */
export function unreadChat(
  rows: readonly MessageRow[],
  me: string,
  lastReadAt: string | null,
): number {
  return rows.filter(
    (row) => row.sender_id !== me && (lastReadAt === null || when(row) > lastReadAt),
  ).length;
}

/** Every user whose name the screen has to show. */
export function peopleInMessages(rows: readonly MessageRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.sender_id);
    if (row.recipient_id) ids.add(row.recipient_id);
  }
  return [...ids];
}

/** Chat messages, oldest first, the way a chat reads. */
export function chatOrder(rows: readonly MessageRow[]): MessageRow[] {
  return rows.slice().sort((a, b) => when(a).localeCompare(when(b)));
}
