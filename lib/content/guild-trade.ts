/**
 * Guild trade: who owns which pieces of an event furniture set, who is short
 * of what, and which gifts would fix that.
 *
 * The set itself lives in `lib/data/trade-sets.json`, read out of the guild's
 * own spreadsheet (LoA Spring Furniture 1.0, September 2026): twelve UR pieces
 * of eight parts, twelve single choice parts, twenty SSR pieces of six. The
 * pictures beside them are the game's own inventory tiles.
 *
 * Everything in this file is a pure function of the marks a guild has stored,
 * so `tests/guild-trade.test.mjs` can hold it to its arithmetic without a
 * database.
 */

import data from "../data/trade-sets.json" with { type: "json" };
import { asset } from "../site.ts";

export const TRADE_ITEM_KINDS = ["ur", "choice", "ssr"] as const;
export type TradeItemKind = (typeof TRADE_ITEM_KINDS)[number];

export type TradeItem = {
  id: string;
  name: string;
  kind: TradeItemKind;
  /** The letters a piece is built from; a choice part has none. */
  parts: string[];
};

export type TradeSet = {
  id: string;
  name: string;
  groups: { id: TradeItemKind; parts: number }[];
  items: TradeItem[];
};

export const TRADE_SETS = (data as { sets: TradeSet[] }).sets;
export const DEFAULT_TRADE_SET = TRADE_SETS[0].id;

/**
 * How many pieces one member may send and how many they may receive in a
 * trading day. The spreadsheet painted a counter green at exactly three and
 * red above it, so three is both the cap and the day's target.
 */
export const TRADE_DAILY_LIMIT = 3;

export const TRADE_DAY_STATUSES = ["stop", "pending", "go"] as const;
export type TradeDayStatus = (typeof TRADE_DAY_STATUSES)[number];

export function isTradeDayStatus(value: string): value is TradeDayStatus {
  return (TRADE_DAY_STATUSES as readonly string[]).includes(value);
}

/** `sets` defaults to the built file; the board passes the published ones. */
export function tradeSetById(id: string, sets: readonly TradeSet[] = TRADE_SETS): TradeSet | undefined {
  return sets.find((set) => set.id === id);
}

export function tradeItemUrl(setId: string, itemId: string): string {
  return asset(`/trade/${setId}/${itemId}.webp`);
}

/**
 * One tick a member has made: the piece is finished (`part` empty), or they
 * are holding that part of it.
 */
export type TradeMark = { member_id: string; item_id: string; part: string };

/** The ticks of one member, as the board reads them. */
export type MemberMarks = { done: Set<string>; parts: Map<string, Set<string>> };

export function readMarks(marks: readonly TradeMark[]): Map<string, MemberMarks> {
  const out = new Map<string, MemberMarks>();
  for (const mark of marks) {
    let entry = out.get(mark.member_id);
    if (!entry) {
      entry = { done: new Set(), parts: new Map() };
      out.set(mark.member_id, entry);
    }
    if (!mark.part) {
      entry.done.add(mark.item_id);
      continue;
    }
    const held = entry.parts.get(mark.item_id) ?? new Set<string>();
    held.add(mark.part);
    entry.parts.set(mark.item_id, held);
  }
  return out;
}

function blank(): MemberMarks {
  return { done: new Set(), parts: new Map() };
}

/**
 * How far one member has got, per group and overall.
 *
 * The spreadsheet counted finished pieces only: UR progress was the twelve UR
 * ticks over twelve, SSR the twenty over twenty, and the total the mean of the
 * two. Parts did not count towards it, and they do not here either — a piece
 * is finished or it is not.
 */
export type TradeProgress = { byGroup: Record<string, number>; total: number };

export function memberProgress(set: TradeSet, marks: MemberMarks | undefined): TradeProgress {
  const mine = marks ?? blank();
  const byGroup: Record<string, number> = {};
  const counted: number[] = [];
  for (const group of set.groups) {
    const items = set.items.filter((item) => item.kind === group.id);
    const done = items.filter((item) => mine.done.has(item.id)).length;
    const share = items.length === 0 ? 0 : done / items.length;
    byGroup[group.id] = share;
    // Choice parts are single items you pick, not a set you complete, so they
    // sit outside the headline number the way they did in the spreadsheet.
    if (group.id !== "choice") counted.push(share);
  }
  const total = counted.length === 0 ? 0 : counted.reduce((sum, share) => sum + share, 0) / counted.length;
  return { byGroup, total };
}

/**
 * A part a member could give away: they are holding it and the piece it
 * belongs to is already finished, so it is doing nothing for them.
 */
export function sparePartsOf(set: TradeSet, marks: MemberMarks | undefined): { itemId: string; part: string }[] {
  const mine = marks ?? blank();
  const out: { itemId: string; part: string }[] = [];
  for (const item of set.items) {
    if (!mine.done.has(item.id)) continue;
    for (const part of mine.parts.get(item.id) ?? []) {
      if (item.parts.includes(part)) out.push({ itemId: item.id, part });
    }
  }
  return out;
}

/** A part a member still wants: the piece is unfinished and they do not hold it. */
export function missingPartsOf(set: TradeSet, marks: MemberMarks | undefined): { itemId: string; part: string }[] {
  const mine = marks ?? blank();
  const out: { itemId: string; part: string }[] = [];
  for (const item of set.items) {
    if (mine.done.has(item.id)) continue;
    const held = mine.parts.get(item.id) ?? new Set<string>();
    for (const part of item.parts) {
      if (!held.has(part)) out.push({ itemId: item.id, part });
    }
  }
  return out;
}

export type TradeSuggestion = { from: string; to: string; itemId: string; part: string };

/**
 * Gifts worth making: someone holds a part they no longer need and someone
 * else is short of it.
 *
 * The scarcest parts are matched first — a part only one member can spare
 * would otherwise lose its one giver to an easier match — and nobody is asked
 * to send or receive more than a day allows. Ties break on the ids so the same
 * board always proposes the same list; two people reading it see one plan.
 */
export function suggestTrades(
  set: TradeSet,
  marks: Map<string, MemberMarks>,
  members: readonly string[],
  options: { limit?: number; alreadySent?: Map<string, number>; alreadyReceived?: Map<string, number> } = {},
): TradeSuggestion[] {
  const limit = options.limit ?? TRADE_DAILY_LIMIT;
  const sent = new Map(options.alreadySent ?? []);
  const received = new Map(options.alreadyReceived ?? []);
  const roster = [...members].sort();

  // part key -> who can give it, who wants it
  const givers = new Map<string, string[]>();
  const takers = new Map<string, string[]>();
  const key = (itemId: string, part: string) => `${itemId}/${part}`;
  for (const member of roster) {
    const mine = marks.get(member);
    for (const spare of sparePartsOf(set, mine)) {
      const at = key(spare.itemId, spare.part);
      givers.set(at, [...(givers.get(at) ?? []), member]);
    }
    for (const want of missingPartsOf(set, mine)) {
      const at = key(want.itemId, want.part);
      takers.set(at, [...(takers.get(at) ?? []), member]);
    }
  }

  const open = [...givers.keys()]
    .filter((at) => (takers.get(at) ?? []).length > 0)
    .sort((a, b) => {
      const scarcity = (givers.get(a) as string[]).length - (givers.get(b) as string[]).length;
      return scarcity !== 0 ? scarcity : a.localeCompare(b);
    });

  const out: TradeSuggestion[] = [];
  for (const at of open) {
    const [itemId, part] = at.split("/");
    for (const from of givers.get(at) ?? []) {
      if ((sent.get(from) ?? 0) >= limit) continue;
      const to = (takers.get(at) ?? []).find(
        (member) => member !== from && (received.get(member) ?? 0) < limit,
      );
      if (!to) continue;
      out.push({ from, to, itemId, part });
      sent.set(from, (sent.get(from) ?? 0) + 1);
      received.set(to, (received.get(to) ?? 0) + 1);
      takers.set(at, (takers.get(at) ?? []).filter((member) => member !== to));
    }
  }
  return out;
}

/** How many gifts each member is down for, on one day's plan. */
export function tradeCounts(rows: readonly { from_member: string; to_member: string }[]): {
  sent: Map<string, number>;
  received: Map<string, number>;
} {
  const sent = new Map<string, number>();
  const received = new Map<string, number>();
  for (const row of rows) {
    sent.set(row.from_member, (sent.get(row.from_member) ?? 0) + 1);
    received.set(row.to_member, (received.get(row.to_member) ?? 0) + 1);
  }
  return { sent, received };
}

/** Over the daily limit, which the board marks rather than blocks. */
export function overLimit(count: number, limit: number = TRADE_DAILY_LIMIT): boolean {
  return count > limit;
}
