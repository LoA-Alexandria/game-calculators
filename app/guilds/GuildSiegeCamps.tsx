"use client";

import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import {
  GUILD_CAMP_NAME_MAX,
  GUILD_CAMP_NOTE_MAX,
  GUILD_CAMP_SERVER_MAX,
  GUILD_ORDER_TARGET_ALL,
  campAssignment,
  campSlots,
  campTargets,
  emptyOrder,
  unassignedTotals,
  type GuildEventCampRow,
  type GuildEventOrderRow,
  type GuildPlanEventId,
} from "../../lib/content/guild-events";
import { guildRosterLabel, type GuildRosterEntry } from "../../lib/content/guilds";
import { asset } from "../../lib/site";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useLocale } from "../components/LocaleProvider";
import { GuildsIcon, PenIcon, UsersIcon } from "../components/Icons";

const CAMP_COLUMNS = "slot, name, server_name, is_ours, priority, note";
const ORDER_COLUMNS = "user_id, rings, horns, rings_target, horns_target, attack_target";

/**
 * Whose board this is. A guild plans on its own tables, two allied guilds on
 * the shared ones; only the keys differ, so both draw the same map.
 */
export type SiegeScope =
  | { kind: "guild"; guildId: string }
  | { kind: "alliance"; allianceId: string };

/** A roster entry, plus the guild it comes from on a shared board. */
export type SiegeMember = GuildRosterEntry & { guild_name?: string };

/**
 * The siege map itself: the game's board with the camps rebuilt and its labels
 * taken off, plus where each camp stands on it, in percent.
 */
const SIEGE_MAPS: Partial<Record<GuildPlanEventId, { image: string; ratio: string; points: { x: number; y: number }[] }>> = {
  "trials-of-odin": {
    image: "/guilds/trials-of-odin.webp",
    ratio: "900 / 1055",
    points: [
      { x: 67, y: 7 },
      { x: 18, y: 33 },
      { x: 82, y: 34 },
      { x: 24, y: 77 },
      { x: 81, y: 71 },
    ],
  },
};

/** A plain ring, for an event that has camps but no picture yet. */
const FALLBACK = {
  image: "",
  ratio: "16 / 9",
  points: [
    { x: 50, y: 12 },
    { x: 14, y: 40 },
    { x: 86, y: 40 },
    { x: 28, y: 82 },
    { x: 72, y: 82 },
    { x: 50, y: 95 },
  ],
};

function whole(value: string, max: number): number {
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? Math.min(Math.max(0, Math.floor(parsed)), max) : 0;
}

/**
 * The siege map as a plan. Officers mark our camp and the order the others fall
 * in; members write down the Draupnir Rings and Horns they still have; officers
 * point those, and each member's attacks, at one camp or at every camp.
 */
export function GuildSiegeCamps({
  scope,
  eventId,
  dayIndex,
  count,
  canOfficer,
  userId,
  roster,
}: {
  scope: SiegeScope;
  eventId: GuildPlanEventId;
  dayIndex: number;
  count: number;
  canOfficer: boolean;
  userId: string;
  roster: SiegeMember[];
}) {
  const { t, tf, n } = useLocale();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();
  const map = SIEGE_MAPS[eventId] ?? FALLBACK;
  const owner = scope.kind === "alliance" ? scope.allianceId : scope.guildId;
  // Where the rows live, and how they are keyed. Allies both keep a camp, so
  // marking one friendly does not take the flag off the other.
  const source = useMemo(
    () =>
      scope.kind === "alliance"
        ? {
            campTable: "guild_alliance_camps",
            orderTable: "guild_alliance_orders",
            key: { alliance_id: owner } as Record<string, string>,
            campConflict: "alliance_id,day_index,slot",
            orderConflict: "alliance_id,day_index,user_id",
            singleOurs: false,
          }
        : {
            campTable: "guild_event_camps",
            orderTable: "guild_event_orders",
            key: { guild_id: owner, event_id: eventId } as Record<string, string>,
            campConflict: "guild_id,event_id,day_index,slot",
            orderConflict: "guild_id,event_id,day_index,user_id",
            singleOurs: true,
          },
    [scope.kind, owner, eventId],
  );

  const [camps, setCamps] = useState<GuildEventCampRow[]>(() => campSlots(count, []));
  const [orders, setOrders] = useState<GuildEventOrderRow[]>([]);
  // The pick and the unsaved edit belong to one siege, so switching days drops both without an effect.
  const [selection, setSelection] = useState<{ key: string; slot: number } | null>(null);
  const [draft, setDraft] = useState<{ key: string; row: GuildEventCampRow } | null>(null);
  const [mine, setMine] = useState<{ key: string; rings: string; horns: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    if (!supabase) return;
    let gone = false;
    void (async () => {
      const [campRes, orderRes] = await Promise.all([
        supabase
          .from(source.campTable)
          .select(CAMP_COLUMNS)
          .match({ ...source.key, day_index: dayIndex })
          .order("slot"),
        supabase
          .from(source.orderTable)
          .select(ORDER_COLUMNS)
          .match({ ...source.key, day_index: dayIndex }),
      ]);
      if (gone) return;
      if (campRes.error) setError(campRes.error.message);
      else setCamps(campSlots(count, (campRes.data ?? []) as GuildEventCampRow[]));
      if (orderRes.error) setError(orderRes.error.message);
      else setOrders((orderRes.data ?? []) as GuildEventOrderRow[]);
    })();
    return () => {
      gone = true;
    };
  }, [supabase, source, dayIndex, count, reloadToken]);

  const siege = `${owner}:${eventId}:${dayIndex}`;

  const saveCamp = async (camp: GuildEventCampRow, patch: Partial<GuildEventCampRow> = {}) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const next = { ...camp, ...patch };
    const { error: saveError } = await supabase.from(source.campTable).upsert(
      {
        ...source.key,
        day_index: dayIndex,
        slot: next.slot,
        name: next.name.trim().slice(0, GUILD_CAMP_NAME_MAX),
        server_name: next.server_name.trim().slice(0, GUILD_CAMP_SERVER_MAX),
        is_ours: next.is_ours,
        priority: next.is_ours ? 0 : next.priority,
        note: next.note.trim().slice(0, GUILD_CAMP_NOTE_MAX),
        updated_at: new Date().toISOString(),
      },
      { onConflict: source.campConflict },
    );
    if (saveError) setError(saveError.message);
    else {
      setDraft(null);
      reload();
    }
    setBusy(false);
  };

  /** A guild holds one camp, so the old one gives up the flag; allies keep both. */
  const markOurs = async (camp: GuildEventCampRow, ours: boolean) => {
    const previous = camps.find((entry) => entry.is_ours && entry.slot !== camp.slot);
    if (ours && previous && source.singleOurs) await saveCamp(previous, { is_ours: false });
    await saveCamp(camp, { is_ours: ours });
  };

  const saveOrder = async (order: GuildEventOrderRow, patch: Partial<GuildEventOrderRow> = {}) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    const next = { ...order, ...patch };
    const { error: saveError } = await supabase.from(source.orderTable).upsert(
      {
        ...source.key,
        day_index: dayIndex,
        user_id: next.user_id,
        rings: next.rings,
        horns: next.horns,
        rings_target: next.rings_target,
        horns_target: next.horns_target,
        attack_target: next.attack_target,
        updated_at: new Date().toISOString(),
      },
      { onConflict: source.orderConflict },
    );
    if (saveError) setError(saveError.message);
    else {
      setMine(null);
      reload();
    }
    setBusy(false);
  };

  const orderOfMember = (memberId: string) =>
    orders.find((order) => order.user_id === memberId) ?? emptyOrder(memberId);
  const memberName = (memberId: string) => {
    const entry = roster.find((member) => member.user_id === memberId);
    return entry ? guildRosterLabel(entry) : `${memberId.slice(0, 8)}…`;
  };

  const targets = campTargets(camps);
  const open = unassignedTotals(orders);
  const orderOf = (camp: GuildEventCampRow) => targets.findIndex((entry) => entry.slot === camp.slot) + 1;
  const campLabel = (camp: GuildEventCampRow) => camp.name.trim() || tf(t.guilds.campSlot, { n: camp.slot });

  const selected = selection && selection.key === siege ? selection.slot : null;
  const current = selected === null ? null : camps.find((camp) => camp.slot === selected) ?? null;
  const edited = draft && draft.key === siege && current && draft.row.slot === current.slot ? draft.row : null;
  const row = edited ?? current;
  const dirty = edited !== null;
  const change = (patch: Partial<GuildEventCampRow>) => {
    if (row) setDraft({ key: siege, row: { ...row, ...patch } });
  };
  const field = (key: string) => `${ids}-${key}`;

  const pick = (slot: number, toggle = false) => {
    setSelection((value) =>
      toggle && value?.key === siege && value.slot === slot ? null : { key: siege, slot },
    );
    setDraft(null);
  };

  const myOrder = orderOfMember(userId);
  const myRings = mine?.key === siege ? mine.rings : String(myOrder.rings);
  const myHorns = mine?.key === siege ? mine.horns : String(myOrder.horns);
  const myDirty = mine?.key === siege;

  /** Every camp an officer can point something at, our own camp included for defence. */
  const targetOptions = [
    { value: GUILD_ORDER_TARGET_ALL, label: t.guilds.campTargetAll },
    ...camps
      .filter((camp) => !camp.is_ours)
      .map((camp) => ({ value: camp.slot, label: campLabel(camp) })),
  ];

  const targetLabel = (value: number) =>
    targetOptions.find((option) => option.value === value)?.label ?? t.guilds.campTargetAll;

  const members = roster.filter((member) => member.user_id);

  return (
    <section className="guild-panel guild-camps">
      {error ? (
        <p className="result-error" role="alert">
          {error}
        </p>
      ) : null}

      <div
        className="guild-map"
        role="group"
        aria-label={t.guilds.campsMapLabel}
        style={{
          aspectRatio: map.ratio,
          ...(map.image ? { backgroundImage: `url("${asset(map.image)}")` } : {}),
        }}
      >
        {camps.map((camp) => {
          const point = map.points[(camp.slot - 1) % map.points.length];
          const order = orderOf(camp);
          const assigned = campAssignment(camp.slot, orders);
          const quiet = assigned.rings === 0 && assigned.horns === 0 && assigned.attackers.length === 0;
          return (
            <button
              key={camp.slot}
              type="button"
              className="guild-map-camp"
              data-state={camp.is_ours ? "ours" : camp.name.trim() || camp.priority > 0 ? "target" : "empty"}
              aria-pressed={selected === camp.slot}
              style={{ "--camp-x": `${point.x}%`, "--camp-y": `${point.y}%` } as CSSProperties}
              onClick={() => pick(camp.slot, true)}
            >
              <span className="guild-map-camp-top">
                {camp.is_ours ? (
                  <span className="guild-map-badge is-ours">
                    <GuildsIcon className="icon" />
                    <span className="visually-hidden">{t.guilds.campOurs}</span>
                  </span>
                ) : order > 0 ? (
                  <span className="guild-map-badge">
                    {order}
                    <span className="visually-hidden"> {tf(t.guilds.campTarget, { n: order })}</span>
                  </span>
                ) : null}
                <span className="guild-map-name">{campLabel(camp)}</span>
              </span>
              {camp.is_ours || quiet ? null : (
                <span className="guild-map-numbers">
                  {assigned.rings > 0 || assigned.horns > 0 ? (
                    <span className="guild-map-spend">
                      {tf(t.guilds.campSpendShort, { rings: n(assigned.rings), horns: n(assigned.horns) })}
                    </span>
                  ) : null}
                  {assigned.attackers.length > 0 ? (
                    <span className="guild-map-attackers">
                      <UsersIcon className="icon" />
                      {n(assigned.attackers.length)}
                      <span className="visually-hidden"> {t.guilds.campAttackers}</span>
                    </span>
                  ) : null}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {row ? (
        <div className="guild-camp-detail">
          <header className="guild-camp-detail-head">
            <strong>{campLabel(row)}</strong>
            {row.is_ours ? (
              <span className="pill pill-good">{t.guilds.campOurs}</span>
            ) : orderOf(row) > 0 ? (
              <span className="pill">{tf(t.guilds.campTarget, { n: orderOf(row) })}</span>
            ) : null}
            <span className="guild-camps-server">{tf(t.guilds.campSlot, { n: row.slot })}</span>
          </header>

          {canOfficer ? (
            <>
              <div className="guild-camp-edit-grid">
                <div className="field">
                  <label htmlFor={field("name")}>{t.guilds.campName}</label>
                  <input
                    id={field("name")}
                    value={row.name}
                    maxLength={GUILD_CAMP_NAME_MAX}
                    onChange={(e) => change({ name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor={field("server")}>{t.guilds.serverLabel}</label>
                  <input
                    id={field("server")}
                    value={row.server_name}
                    maxLength={GUILD_CAMP_SERVER_MAX}
                    placeholder="Bay-S8"
                    onChange={(e) => change({ server_name: e.target.value })}
                  />
                </div>
                {row.is_ours ? null : (
                  <div className="field">
                    <label htmlFor={field("priority")}>{t.guilds.campPriority}</label>
                    <select
                      id={field("priority")}
                      value={row.priority}
                      onChange={(e) => change({ priority: Number(e.target.value) })}
                    >
                      <option value={0}>{t.guilds.campPriorityNone}</option>
                      {Array.from({ length: Math.max(count - 1, 1) }, (_, i) => i + 1).map((order) => (
                        <option key={order} value={order}>
                          {tf(t.guilds.campTarget, { n: order })}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="field guild-camp-note-field">
                  <label htmlFor={field("note")}>{t.guilds.campNote}</label>
                  <input
                    id={field("note")}
                    value={row.note}
                    maxLength={GUILD_CAMP_NOTE_MAX}
                    placeholder={t.guilds.campNotePlaceholder}
                    onChange={(e) => change({ note: e.target.value })}
                  />
                </div>
              </div>
              <div className="guild-camp-edit-actions">
                <button
                  className="small-button button-primary"
                  type="button"
                  disabled={busy || !dirty}
                  onClick={() => void saveCamp(row)}
                >
                  <PenIcon className="icon icon-sm" />
                  {t.guilds.campSave}
                </button>
                <button
                  className="small-button"
                  type="button"
                  disabled={busy}
                  aria-pressed={row.is_ours}
                  onClick={() => void markOurs(row, !row.is_ours)}
                >
                  {row.is_ours ? t.guilds.campUnsetOurs : t.guilds.campSetOurs}
                </button>
                {dirty ? (
                  <button className="small-button" type="button" disabled={busy} onClick={() => setDraft(null)}>
                    {t.guilds.postCancel}
                  </button>
                ) : null}
              </div>
            </>
          ) : row.note.trim() ? (
            <p className="guild-camp-note">{row.note}</p>
          ) : null}

          {row.is_ours ? null : (
            <div className="guild-camp-assigned">
              <p className="guild-camp-spend">
                <span>{tf(t.guilds.campRingsValue, { count: n(campAssignment(row.slot, orders).rings) })}</span>
                <span>{tf(t.guilds.campHornsValue, { count: n(campAssignment(row.slot, orders).horns) })}</span>
              </p>
              {campAssignment(row.slot, orders).attackers.length > 0 ? (
                <p className="guild-camp-note">
                  {t.guilds.campAttackers}: {campAssignment(row.slot, orders).attackers.map(memberName).join(", ")}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <div className="guild-orders">
        <header className="guild-panel-head">
          <h3>{t.guilds.ordersTitle}</h3>
          <span className="guild-camps-totals">
            {tf(t.guilds.ordersOpen, { rings: n(open.rings), horns: n(open.horns) })}
          </span>
        </header>

        <div className="guild-orders-mine">
          <div className="field">
            <label htmlFor={field("my-rings")}>{t.guilds.ordersMyRings}</label>
            <input
              id={field("my-rings")}
              inputMode="numeric"
              value={myRings}
              disabled={busy}
              onChange={(e) => setMine({ key: siege, rings: e.target.value.replace(/[^\d]/g, ""), horns: myHorns })}
            />
          </div>
          <div className="field">
            <label htmlFor={field("my-horns")}>{t.guilds.ordersMyHorns}</label>
            <input
              id={field("my-horns")}
              inputMode="numeric"
              value={myHorns}
              disabled={busy}
              onChange={(e) => setMine({ key: siege, rings: myRings, horns: e.target.value.replace(/[^\d]/g, "") })}
            />
          </div>
          <button
            className="button button-primary"
            type="button"
            disabled={busy || !myDirty}
            onClick={() =>
              void saveOrder(myOrder, {
                rings: whole(myRings, 9999),
                horns: whole(myHorns, 999_999),
              })
            }
          >
            {t.guilds.ordersSaveMine}
          </button>
        </div>

        {members.length === 0 ? (
          <p className="guild-panel-empty">{t.guilds.membersEmpty}</p>
        ) : (
          <ul className="guild-orders-list">
            {members.map((member) => {
              const order = orderOfMember(member.user_id!);
              const has = order.rings > 0 || order.horns > 0;
              return (
                <li key={member.user_id} className={member.user_id === userId ? "guild-order is-you" : "guild-order"}>
                  <span className="guild-order-name">
                    {guildRosterLabel(member)}
                    {member.guild_name ? <small className="guild-order-guild">{member.guild_name}</small> : null}
                  </span>
                  <span className="guild-order-stock">
                    {tf(t.guilds.campSpendShort, { rings: n(order.rings), horns: n(order.horns) })}
                  </span>
                  {canOfficer ? (
                    <span className="guild-order-targets">
                      <label>
                        <span className="visually-hidden">{t.guilds.ordersRingsTarget}</span>
                        <span aria-hidden="true">{t.guilds.ordersRingsShort}</span>
                        <select
                          value={order.rings_target}
                          disabled={busy || order.rings === 0}
                          onChange={(e) => void saveOrder(order, { rings_target: Number(e.target.value) })}
                        >
                          {targetOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="visually-hidden">{t.guilds.ordersHornsTarget}</span>
                        <span aria-hidden="true">{t.guilds.ordersHornsShort}</span>
                        <select
                          value={order.horns_target}
                          disabled={busy || order.horns === 0}
                          onChange={(e) => void saveOrder(order, { horns_target: Number(e.target.value) })}
                        >
                          {targetOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="visually-hidden">{t.guilds.ordersAttackTarget}</span>
                        <span aria-hidden="true">{t.guilds.ordersAttackShort}</span>
                        <select
                          value={order.attack_target}
                          disabled={busy}
                          onChange={(e) => void saveOrder(order, { attack_target: Number(e.target.value) })}
                        >
                          {targetOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                    </span>
                  ) : (
                    <span className="guild-order-plan">
                      {has ? (
                        <>
                          <span>{t.guilds.ordersRingsShort} {targetLabel(order.rings_target)}</span>
                          <span>{t.guilds.ordersHornsShort} {targetLabel(order.horns_target)}</span>
                        </>
                      ) : null}
                      <span>{t.guilds.ordersAttackShort} {targetLabel(order.attack_target)}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
