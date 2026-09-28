"use client";

import Link from "next/link";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  DEFAULT_TRADE_SET,
  TRADE_DAILY_LIMIT,
  TRADE_DAY_STATUSES,
  isTradeDayStatus,
  memberProgress,
  readMarks,
  suggestTrades,
  tradeCounts,
  tradeItemUrl,
  tradeSetById,
  type TradeDayStatus,
  type TradeItem,
  type TradeMark,
  type TradeSuggestion,
  type TradeSet,
} from "../../lib/content/guild-trade";
import type { GuildRosterEntry } from "../../lib/content/guilds";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useLocale } from "../components/LocaleProvider";
import { CheckIcon, PlusIcon, TrashIcon, PenIcon} from "../components/Icons";
import { useGuideData } from "../guides/GuideOverrides";
import { useAuth } from "../components/AuthProvider";

type DayRow = {
  id: string;
  trade_on: string;
  status: TradeDayStatus;
  note: string;
};

type GiftRow = {
  id: string;
  from_member: string;
  to_member: string;
  item_id: string;
  part: string;
  done: boolean;
};

const NO_GIFTS: GiftRow[] = [];

type Props = {
  guildId: string;
  userId: string;
  roster: GuildRosterEntry[];
  /** A guild whose Premium has run out is readable but not writable. */
  frozen?: boolean;
};

/** Today in the browser's own zone; a trading day is a calendar day, not an instant. */
function today(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function GuildTradeBoard({ guildId, userId, roster, frozen = false }: Props) {
  const { t, tf, d } = useLocale();
  const { allows } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();
  const words = t.guilds.trade;

  // The build carries the sets; a published one lies over them a moment later,
  // so next season's furniture needs no deploy.
  const sets = useGuideData<{ sets: TradeSet[] }>("trade-sets").sets;
  // The first set is the one a guild is collecting; a second one appears when
  // the next event's furniture is added, and everything below follows the pick.
  const [chosen, setChosen] = useState("");
  const setId = sets.some((entry) => entry.id === chosen) ? chosen : sets[0]?.id ?? DEFAULT_TRADE_SET;
  const set = tradeSetById(setId, sets);

  const [marks, setMarks] = useState<TradeMark[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [dayId, setDayId] = useState<string | null>(null);
  // Keyed by the day it was loaded for, so switching days cannot show the
  // previous day's gifts for a frame while the new ones are on their way.
  const [loaded, setLoaded] = useState<{ dayId: string; rows: GiftRow[] }>({ dayId: "", rows: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openItem, setOpenItem] = useState<string | null>(null);

  const members = useMemo(
    () => roster.filter((entry) => entry.user_id).map((entry) => entry.user_id as string),
    [roster],
  );
  const nameOf = useCallback(
    (id: string) => roster.find((entry) => entry.user_id === id)?.display_name ?? words.someone,
    [roster, words.someone],
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    const [markRows, dayRows] = await Promise.all([
      supabase
        .from("guild_trade_marks")
        .select("member_id,item_id,part")
        .eq("guild_id", guildId)
        .eq("set_id", setId),
      supabase
        .from("guild_trade_days")
        .select("id,trade_on,status,note")
        .eq("guild_id", guildId)
        .eq("set_id", setId)
        .order("trade_on", { ascending: false })
        .limit(14),
    ]);
    if (markRows.error || dayRows.error) {
      setError(markRows.error?.message ?? dayRows.error?.message ?? words.loadFailed);
      setLoading(false);
      return;
    }
    setError("");
    setMarks((markRows.data ?? []) as TradeMark[]);
    const list = (dayRows.data ?? []) as DayRow[];
    setDays(list);
    setDayId((current) => current ?? list[0]?.id ?? null);
    setLoading(false);
  }, [supabase, guildId, setId, words.loadFailed]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!supabase || !dayId) return;
    let cancelled = false;
    void (async () => {
      const { data, error: giftError } = await supabase
        .from("guild_trade_rows")
        .select("id,from_member,to_member,item_id,part,done")
        .eq("day_id", dayId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (giftError) {
        setError(giftError.message);
        return;
      }
      setLoaded({ dayId, rows: (data ?? []) as GiftRow[] });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, dayId]);

  const byMember = useMemo(() => readMarks(marks), [marks]);
  const mine = byMember.get(userId);
  const day = days.find((row) => row.id === dayId) ?? null;
  const gifts = loaded.dayId && loaded.dayId === dayId ? loaded.rows : NO_GIFTS;
  const counts = useMemo(() => tradeCounts(gifts), [gifts]);

  const suggestions = useMemo(() => {
    if (!set) return [];
    return suggestTrades(set, byMember, members, {
      alreadySent: counts.sent,
      alreadyReceived: counts.received,
    });
  }, [set, byMember, members, counts]);

  if (!set) return null;
  const canWrite = !frozen;

  const fail = (message: string) => {
    setError(message);
    setBusy(false);
  };

  /** A tick is a row that exists; untick deletes it. */
  const toggleMark = async (item: TradeItem, part: string) => {
    if (!supabase || !canWrite || busy) return;
    const has = part ? (mine?.parts.get(item.id)?.has(part) ?? false) : (mine?.done.has(item.id) ?? false);
    setBusy(true);
    const match = { guild_id: guildId, member_id: userId, set_id: setId, item_id: item.id, part };
    const { error: writeError } = has
      ? await supabase.from("guild_trade_marks").delete().match(match)
      : await supabase.from("guild_trade_marks").insert(match);
    if (writeError) return fail(writeError.message);
    setMarks((rows) =>
      has
        ? rows.filter((row) => !(row.member_id === userId && row.item_id === item.id && row.part === part))
        : [...rows, { member_id: userId, item_id: item.id, part }],
    );
    setBusy(false);
  };

  const openDay = async (date: string) => {
    if (!supabase || !canWrite || busy) return;
    const existing = days.find((row) => row.trade_on === date);
    if (existing) {
      setDayId(existing.id);
      return;
    }
    setBusy(true);
    const { data, error: writeError } = await supabase
      .from("guild_trade_days")
      .insert({ guild_id: guildId, set_id: setId, trade_on: date, created_by: userId })
      .select("id,trade_on,status,note")
      .single();
    if (writeError || !data) return fail(writeError?.message ?? words.saveFailed);
    setDays((rows) => [data as DayRow, ...rows]);
    setDayId((data as DayRow).id);
    setBusy(false);
  };

  const setStatus = async (status: string) => {
    if (!supabase || !canWrite || !day || busy || !isTradeDayStatus(status)) return;
    setBusy(true);
    const { error: writeError } = await supabase
      .from("guild_trade_days")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", day.id);
    if (writeError) return fail(writeError.message);
    setDays((rows) => rows.map((row) => (row.id === day.id ? { ...row, status } : row)));
    setBusy(false);
  };

  const addGift = async (gift: TradeSuggestion) => {
    if (!supabase || !canWrite || !day || busy) return;
    setBusy(true);
    const { data, error: writeError } = await supabase
      .from("guild_trade_rows")
      .insert({
        day_id: day.id,
        guild_id: guildId,
        from_member: gift.from,
        to_member: gift.to,
        item_id: gift.itemId,
        part: gift.part,
        created_by: userId,
      })
      .select("id,from_member,to_member,item_id,part,done")
      .single();
    if (writeError || !data) return fail(writeError?.message ?? words.saveFailed);
    setLoaded((current) => ({ dayId: day.id, rows: [...current.rows, data as GiftRow] }));
    setBusy(false);
  };

  const dropGift = async (id: string) => {
    if (!supabase || !canWrite || busy) return;
    setBusy(true);
    const { error: writeError } = await supabase.from("guild_trade_rows").delete().eq("id", id);
    if (writeError) return fail(writeError.message);
    setLoaded((current) => ({ ...current, rows: current.rows.filter((row) => row.id !== id) }));
    setBusy(false);
  };

  const markGiftDone = async (row: GiftRow) => {
    if (!supabase || !canWrite || busy) return;
    setBusy(true);
    const { error: writeError } = await supabase
      .from("guild_trade_rows")
      .update({ done: !row.done })
      .eq("id", row.id);
    if (writeError) return fail(writeError.message);
    setLoaded((current) => ({
      ...current,
      rows: current.rows.map((entry) => (entry.id === row.id ? { ...entry, done: !entry.done } : entry)),
    }));
    setBusy(false);
  };

  const itemName = (id: string) => set.items.find((item) => item.id === id)?.name ?? id;
  const giftLabel = (itemId: string, part: string) =>
    part ? tf(words.partOf, { part, item: itemName(itemId) }) : itemName(itemId);

  const ranking = [...members]
    .map((id) => ({ id, progress: memberProgress(set, byMember.get(id)) }))
    .sort((a, b) => b.progress.total - a.progress.total || nameOf(a.id).localeCompare(nameOf(b.id)));

  return (
    <div className="guild-trade">
      {error ? (
        <p className="result-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="guild-panel">
        <div className="guild-panel-head">
          <h2>{words.progressHeading}</h2>
          <p className="guild-panel-lede">{tf(words.progressLede, { set: set.name })}</p>
          {sets.length > 1 ? (
            <div className="field guild-trade-set-pick">
              <label htmlFor={`${ids}-set`}>{words.setLabel}</label>
              <select id={`${ids}-set`} value={setId} onChange={(event) => setChosen(event.target.value)}>
                {sets.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
            </div>
          ) : null}
          {allows("guides.draft") ? (
            <Link className="small-button" href="/guilds/trade-sets/edit/">
              <PenIcon className="icon icon-sm" />
              {t.tradeSetsEditor.openEditor}
            </Link>
          ) : null}
        </div>
        {loading ? (
          <p className="guild-empty">{words.loading}</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table guild-trade-progress">
              <thead>
                <tr>
                  <th scope="col">{words.member}</th>
                  <th scope="col">{words.groupUr}</th>
                  <th scope="col">{words.groupSsr}</th>
                  <th scope="col">{words.groupChoice}</th>
                  <th scope="col">{words.total}</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row) => (
                  <tr key={row.id} className={row.id === userId ? "is-me" : undefined}>
                    <th scope="row">{nameOf(row.id)}</th>
                    <td className="mono">{percent(row.progress.byGroup.ur ?? 0)}</td>
                    <td className="mono">{percent(row.progress.byGroup.ssr ?? 0)}</td>
                    <td className="mono">{percent(row.progress.byGroup.choice ?? 0)}</td>
                    <td className="mono">
                      <span className="guild-trade-bar" aria-hidden="true">
                        <span style={{ width: percent(row.progress.total) }} />
                      </span>
                      {percent(row.progress.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="guild-panel">
        <div className="guild-panel-head">
          <h2>{words.mineHeading}</h2>
          <p className="guild-panel-lede">{words.mineLede}</p>
        </div>
        <ul className="guild-trade-grid">
          {set.items.map((item) => {
            const done = mine?.done.has(item.id) ?? false;
            const held = mine?.parts.get(item.id) ?? new Set<string>();
            const open = openItem === item.id;
            return (
              <li key={item.id} className={done ? "guild-trade-card is-done" : "guild-trade-card"}>
                {/* A static export cannot optimise images; the tiles are small WebP already. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tradeItemUrl(setId, item.id)} alt="" width={132} height={134} loading="lazy" decoding="async" />
                <div className="guild-trade-card-body">
                  <strong>{item.name}</strong>
                  <label className="guild-trade-done">
                    <input
                      type="checkbox"
                      checked={done}
                      disabled={!canWrite || busy}
                      onChange={() => void toggleMark(item, "")}
                    />
                    {words.haveIt}
                  </label>
                  {item.parts.length > 0 ? (
                    <>
                      <button
                        type="button"
                        className="guild-trade-parts-toggle"
                        aria-expanded={open}
                        aria-controls={`${ids}-${item.id}`}
                        onClick={() => setOpenItem(open ? null : item.id)}
                      >
                        {tf(words.partsHeld, { held: held.size, total: item.parts.length })}
                      </button>
                      {open ? (
                        <ul className="guild-trade-parts" id={`${ids}-${item.id}`}>
                          {item.parts.map((part) => (
                            <li key={part}>
                              <button
                                type="button"
                                className={held.has(part) ? "guild-trade-part is-held" : "guild-trade-part"}
                                aria-pressed={held.has(part)}
                                disabled={!canWrite || busy}
                                onClick={() => void toggleMark(item, part)}
                              >
                                {part}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="guild-panel">
        <div className="guild-panel-head">
          <h2>{words.dayHeading}</h2>
          <p className="guild-panel-lede">{tf(words.dayLede, { limit: TRADE_DAILY_LIMIT })}</p>
        </div>
        <div className="guild-trade-day-bar">
          <label className="field">
            <span>{words.dayPick}</span>
            <select
              value={dayId ?? ""}
              onChange={(event) => setDayId(event.target.value || null)}
              disabled={days.length === 0}
            >
              {days.length === 0 ? <option value="">{words.noDays}</option> : null}
              {days.map((row) => (
                <option key={row.id} value={row.id}>
                  {d(row.trade_on)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="small-button"
            type="button"
            disabled={!canWrite || busy}
            onClick={() => void openDay(today())}
          >
            <PlusIcon className="icon icon-sm" />
            {words.openToday}
          </button>
          {day ? (
            <label className="field">
              <span>{words.status}</span>
              <select
                value={day.status}
                disabled={!canWrite || busy}
                onChange={(event) => void setStatus(event.target.value)}
                data-status={day.status}
              >
                {TRADE_DAY_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {words.statuses[status]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {day ? (
          <>
            <ul className="guild-trade-gifts">
              {gifts.map((row) => (
                <li key={row.id} className={row.done ? "is-done" : undefined}>
                  <button
                    type="button"
                    className="guild-trade-tick"
                    aria-pressed={row.done}
                    disabled={!canWrite || busy}
                    onClick={() => void markGiftDone(row)}
                    aria-label={words.markSent}
                  >
                    <CheckIcon className="icon icon-sm" />
                  </button>
                  <span className="guild-trade-gift-line">
                    <strong>{nameOf(row.from_member)}</strong>
                    <span aria-hidden="true">→</span>
                    <strong>{nameOf(row.to_member)}</strong>
                    <span className="guild-trade-gift-item">{giftLabel(row.item_id, row.part)}</span>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    disabled={!canWrite || busy}
                    onClick={() => void dropGift(row.id)}
                    aria-label={words.dropGift}
                  >
                    <TrashIcon className="icon icon-sm" />
                  </button>
                </li>
              ))}
              {gifts.length === 0 ? <li className="guild-empty">{words.noGifts}</li> : null}
            </ul>

            <div className="table-scroll">
              <table className="data-table guild-trade-counts">
                <caption>{tf(words.countsCaption, { limit: TRADE_DAILY_LIMIT })}</caption>
                <thead>
                  <tr>
                    <th scope="col">{words.member}</th>
                    <th scope="col">{words.sends}</th>
                    <th scope="col">{words.receives}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((id) => {
                    const sent = counts.sent.get(id) ?? 0;
                    const got = counts.received.get(id) ?? 0;
                    const mark = (n: number) => (n > TRADE_DAILY_LIMIT ? "is-over" : n === TRADE_DAILY_LIMIT ? "is-full" : "");
                    return (
                      <tr key={id} className={id === userId ? "is-me" : undefined}>
                        <th scope="row">{nameOf(id)}</th>
                        <td className={`mono ${mark(sent)}`}>{sent}</td>
                        <td className={`mono ${mark(got)}`}>{got}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="guild-empty">{words.noDayYet}</p>
        )}
      </section>

      <section className="guild-panel">
        <div className="guild-panel-head">
          <h2>{words.suggestHeading}</h2>
          <p className="guild-panel-lede">{words.suggestLede}</p>
        </div>
        {suggestions.length === 0 ? (
          <p className="guild-empty">{words.noSuggestions}</p>
        ) : (
          <ul className="guild-trade-gifts">
            {suggestions.slice(0, 40).map((gift) => (
              <li key={`${gift.from}-${gift.to}-${gift.itemId}-${gift.part}`}>
                <span className="guild-trade-gift-line">
                  <strong>{nameOf(gift.from)}</strong>
                  <span aria-hidden="true">→</span>
                  <strong>{nameOf(gift.to)}</strong>
                  <span className="guild-trade-gift-item">{giftLabel(gift.itemId, gift.part)}</span>
                </span>
                <button
                  className="small-button"
                  type="button"
                  disabled={!canWrite || !day || busy}
                  onClick={() => void addGift(gift)}
                >
                  <PlusIcon className="icon icon-sm" />
                  {words.addToDay}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
