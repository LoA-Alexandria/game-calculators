import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_TRADE_SET,
  TRADE_DAILY_LIMIT,
  TRADE_ITEM_KINDS,
  TRADE_SETS,
  isTradeDayStatus,
  memberProgress,
  missingPartsOf,
  readMarks,
  sparePartsOf,
  suggestTrades,
  tradeCounts,
  tradeSetById,
} from "../lib/content/guild-trade.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const set = tradeSetById(DEFAULT_TRADE_SET);

test("the Spring Furniture set is the one the spreadsheet described", () => {
  assert.ok(set, "the default set is missing");
  const of = (kind) => set.items.filter((item) => item.kind === kind);
  // Twelve UR pieces of eight parts, twelve single choice parts, twenty SSR of six.
  assert.equal(of("ur").length, 12);
  assert.equal(of("choice").length, 12);
  assert.equal(of("ssr").length, 20);
  for (const item of of("ur")) assert.deepEqual(item.parts, ["A", "B", "C", "D", "E", "F", "G", "H"]);
  for (const item of of("ssr")) assert.deepEqual(item.parts, ["A", "B", "C", "D", "E", "F"]);
  for (const item of of("choice")) assert.deepEqual(item.parts, []);
  for (const item of set.items) {
    assert.ok(TRADE_ITEM_KINDS.includes(item.kind), item.id);
    assert.ok(item.name.trim(), item.id);
  }
  const ids = set.items.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
});

test("every piece has its picture on disk", () => {
  for (const item of set.items) {
    const file = join(root, "public", "trade", set.id, `${item.id}.webp`);
    assert.ok(existsSync(file), `${item.id} has no tile`);
  }
});

test("progress counts finished pieces, the way the spreadsheet did", () => {
  const ur = set.items.filter((item) => item.kind === "ur");
  const ssr = set.items.filter((item) => item.kind === "ssr");
  const marks = readMarks([
    ...ur.slice(0, 6).map((item) => ({ member_id: "a", item_id: item.id, part: "" })),
    ...ssr.slice(0, 5).map((item) => ({ member_id: "a", item_id: item.id, part: "" })),
    // Parts alone move nothing: a piece is finished or it is not.
    { member_id: "a", item_id: ur[6].id, part: "A" },
    { member_id: "a", item_id: ur[6].id, part: "B" },
  ]);
  const progress = memberProgress(set, marks.get("a"));
  assert.equal(progress.byGroup.ur, 6 / 12);
  assert.equal(progress.byGroup.ssr, 5 / 20);
  assert.equal(progress.total, (6 / 12 + 5 / 20) / 2, "the total is the mean of the two");

  const empty = memberProgress(set, undefined);
  assert.equal(empty.total, 0);
  assert.equal(empty.byGroup.ur, 0);
});

test("a part is spare once its piece is finished, and missing until then", () => {
  const piece = set.items.find((item) => item.kind === "ssr");
  const other = set.items.filter((item) => item.kind === "ssr")[1];
  const marks = readMarks([
    { member_id: "a", item_id: piece.id, part: "" },
    { member_id: "a", item_id: piece.id, part: "C" },
    { member_id: "a", item_id: other.id, part: "A" },
  ]);
  const mine = marks.get("a");
  assert.deepEqual(sparePartsOf(set, mine), [{ itemId: piece.id, part: "C" }]);

  const missing = missingPartsOf(set, mine);
  assert.ok(!missing.some((want) => want.itemId === piece.id), "a finished piece wants nothing");
  const wantsOfOther = missing.filter((want) => want.itemId === other.id).map((want) => want.part);
  assert.deepEqual(wantsOfOther, ["B", "C", "D", "E", "F"], "the part already held is not wanted");
});

test("suggestions move a spare part to someone short of it", () => {
  const piece = set.items.find((item) => item.kind === "ur");
  const marks = readMarks([
    { member_id: "giver", item_id: piece.id, part: "" },
    { member_id: "giver", item_id: piece.id, part: "A" },
  ]);
  const out = suggestTrades(set, marks, ["giver", "taker"]);
  const forPiece = out.filter((row) => row.itemId === piece.id);
  assert.deepEqual(forPiece, [{ from: "giver", to: "taker", itemId: piece.id, part: "A" }]);
});

test("nobody is asked to send or receive more than a day allows", () => {
  const pieces = set.items.filter((item) => item.kind === "ur").slice(0, 6);
  const marks = readMarks(
    pieces.flatMap((item) => [
      { member_id: "giver", item_id: item.id, part: "" },
      { member_id: "giver", item_id: item.id, part: "A" },
    ]),
  );
  const out = suggestTrades(set, marks, ["giver", "taker"]);
  assert.equal(out.length, TRADE_DAILY_LIMIT, "capped at the daily limit");
  assert.ok(out.every((row) => row.from === "giver" && row.to === "taker"));

  // What is already planned counts against the same limit.
  const already = suggestTrades(set, marks, ["giver", "taker"], {
    alreadySent: new Map([["giver", TRADE_DAILY_LIMIT]]),
  });
  assert.deepEqual(already, [], "a member at the limit is left alone");
});

test("the scarcer part is placed first, and the list does not wander", () => {
  const [first, second] = set.items.filter((item) => item.kind === "ur");
  const marks = readMarks([
    // Two members can spare part A of the first piece; only one can spare the second's.
    { member_id: "a", item_id: first.id, part: "" },
    { member_id: "a", item_id: first.id, part: "A" },
    { member_id: "b", item_id: first.id, part: "" },
    { member_id: "b", item_id: first.id, part: "A" },
    { member_id: "a", item_id: second.id, part: "" },
    { member_id: "a", item_id: second.id, part: "A" },
  ]);
  const members = ["a", "b", "taker"];
  const out = suggestTrades(set, marks, members);
  assert.equal(out[0].itemId, second.id, "the part only one member can spare is placed first");
  assert.equal(out[0].from, "a", "and it comes from the only member who can spare it");
  // Same board, same plan, whatever order the members arrive in.
  assert.deepEqual(suggestTrades(set, marks, [...members].reverse()), out);
});

test("a member is never asked to give a part to themselves", () => {
  const piece = set.items.find((item) => item.kind === "ssr");
  const marks = readMarks([
    { member_id: "only", item_id: piece.id, part: "" },
    { member_id: "only", item_id: piece.id, part: "B" },
  ]);
  assert.deepEqual(suggestTrades(set, marks, ["only"]), []);
});

test("the counters add up what a day's plan asks of each member", () => {
  const { sent, received } = tradeCounts([
    { from_member: "a", to_member: "b" },
    { from_member: "a", to_member: "c" },
    { from_member: "b", to_member: "a" },
  ]);
  assert.equal(sent.get("a"), 2);
  assert.equal(sent.get("b"), 1);
  assert.equal(received.get("a"), 1);
  assert.equal(received.get("b"), 1);
  assert.equal(received.get("c"), 1);
  assert.equal(sent.get("c"), undefined);
});

test("the trade tab has a route of its own beside news and planning", async () => {
  const { guildRoomHref } = await import("../lib/content/guilds.ts");
  assert.equal(guildRoomHref("alexandria", "trade"), "/guilds/room/trade/?guild=alexandria");
  assert.equal(guildRoomHref("alexandria", "news"), "/guilds/room/news/?guild=alexandria");
  assert.equal(guildRoomHref("alexandria", "planung"), "/guilds/room/planung/?guild=alexandria");
  assert.ok(existsSync(join(root, "app/guilds/room/trade/page.tsx")), "the page is missing");
});

test("every language names the tab and the board", async () => {
  const { getDictionary, mapLocales } = await import("../lib/i18n/index.ts");
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    const words = dictionary.guilds.trade;
    assert.ok(dictionary.guilds.tradeTab.trim(), code);
    for (const key of ["progressHeading", "mineHeading", "dayHeading", "suggestHeading", "haveIt"]) {
      assert.ok(words[key]?.trim(), `${code}.${key}`);
    }
    for (const status of ["stop", "pending", "go"]) {
      assert.ok(words.statuses[status]?.trim(), `${code}.${status}`);
    }
    assert.ok(words.partsHeld.includes("{held}") && words.partsHeld.includes("{total}"), code);
    assert.ok(words.dayLede.includes("{limit}"), code);
    assert.ok(words.partOf.includes("{part}") && words.partOf.includes("{item}"), code);
  }
});

test("no two migrations share a version number", async () => {
  const { readdirSync } = await import("node:fs");
  const files = readdirSync(join(root, "supabase/migrations")).filter((name) => name.endsWith(".sql"));
  const seen = new Set();
  const twice = files
    .map((name) => name.split("_")[0])
    .filter((version) => (seen.has(version) ? true : (seen.add(version), false)));
  // Supabase records an applied migration by this number alone, so a second
  // file carrying it is never run and never reported as skipped.
  assert.deepEqual(twice, [], "these versions are used by more than one migration");
  assert.ok(files.some((name) => name.endsWith("_guild_trade.sql")), "the trade migration is missing");
});

test("only the three statuses the board offers are accepted", () => {
  assert.equal(isTradeDayStatus("stop"), true);
  assert.equal(isTradeDayStatus("pending"), true);
  assert.equal(isTradeDayStatus("go"), true);
  assert.equal(isTradeDayStatus("GO"), false);
  assert.equal(isTradeDayStatus(""), false);
  assert.equal(TRADE_SETS.length >= 1, true);
});
