"use client";

import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import {
  GUILD_CAMP_NAME_MAX,
  GUILD_CAMP_NOTE_MAX,
  GUILD_ORDER_TARGET_ALL,
  campAssignment,
  campSlots,
  campTargets,
  emptyOrder,
  orderTotals,
  setCampPriority,
  unassignedTotals,
  type GuildEventCampRow,
  type GuildEventOrderRow,
  type GuildPlanEventId,
} from "../../lib/content/guild-events";
import { guildRosterLabel, type GuildRosterEntry } from "../../lib/content/guilds";
import { asset } from "../../lib/site";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useLocale } from "../components/LocaleProvider";
import { CheckIcon, CloseIcon, GuildsIcon, UsersIcon } from "../components/Icons";

const CAMP_COLUMNS = "slot, name, server_name, is_ours, priority, note";
const ORDER_COLUMNS = "user_id, rings, horns, rings_target, horns_target, attack_target";

/** The event's map, and where each village stands on it, in percent. */
const SIEGE_MAPS: Partial<Record<GuildPlanEventId, { image: string; ratio: string; points: { x: number; y: number }[] }>> = {
  "trials-of-odin": {
    image: "/guilds/trials-of-odin.webp",
    ratio: "485 / 766",
    points: [
      { x: 63, y: 32 },
      { x: 18, y: 48 },
      { x: 82, y: 48 },
      { x: 73, y: 68 },
      { x: 28, y: 75 },
    ],
  },
};

/** A plain ring, for an event that has villages but no picture yet. */
const FALLBACK = {
  image: "",
  ratio: "16 / 9",
  points: [
    { x: 50, y: 14 },
    { x: 15, y: 42 },
    { x: 85, y: 42 },
    { x: 30, y: 82 },
    { x: 70, y: 82 },
    { x: 50, y: 96 },
  ],
};

/** Whose board this is: one guild's own plan, or the one two allies share. */
export type SiegeScope =
  | { kind: "guild"; guildId: string }
  | { kind: "alliance"; allianceId: string };

/** A roster entry, plus the guild it comes from on a shared board. */
export type SiegeMember = GuildRosterEntry & { guild_name?: string };

/** A village an allied guild holds; it can never be a target. */
export type SiegeBase = { slot: number; label: string; own: boolean };

function whole(value: string, max: number): number {
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? Math.min(Math.max(0, Math.floor(parsed)), max) : 0;
}

/**
 * The siege plan, drawn on the event's map. Officers name the villages, mark
 * the bases and put the rest in the order they should fall; members write down
 * the Draupnir Rings and Military Tokens (Horns) they hold, and officers point
 * that stock, and each member's attacks, at a village.
 */
export function GuildSiegeCamps({
  scope,
  eventId,
  dayIndex,
  count,
  canOfficer,
  userId,
  roster,
  bases = [],
  needsBase = false,
  onPickBase,
  onChanged,
  ownLabel = "",
}: {
  scope: SiegeScope;
  eventId: GuildPlanEventId;
  dayIndex: number;
  count: number;
  canOfficer: boolean;
  userId: string;
  roster: SiegeMember[];
  bases?: SiegeBase[];
  needsBase?: boolean;
  onPickBase?: (slot: number) => Promise<void> | void;
  onChanged?: () => void;
  ownLabel?: string;
}) {
  const { t, tf, n } = useLocale();
  const supabase = getSupabaseBrowserClient();
  const ids = useId();
  const map = SIEGE_MAPS[eventId] ?? FALLBACK;
  const shared = scope.kind === "alliance";
  const owner = shared ? scope.allianceId : scope.guildId;

  const source = useMemo(
    () =>
      shared
        ? {
            campTable: "guild_alliance_camps",
            orderTable: "guild_alliance_orders",
            key: { alliance_id: owner } as Record<string, string>,
            campConflict: "alliance_id,day_index,slot",
            orderConflict: "alliance_id,day_index,user_id",
          }
        : {
            campTable: "guild_event_camps",
            orderTable: "guild_event_orders",
            key: { guild_id: owner, event_id: eventId } as Record<string, string>,
            campConflict: "guild_id,event_id,day_index,slot",
            orderConflict: "guild_id,event_id,day_index,user_id",
          },
    [shared, owner, eventId],
  );

  const [camps, setCamps] = useState<GuildEventCampRow[]>(() => campSlots(count, []));
  const [orders, setOrders] = useState<GuildEventOrderRow[]>([]);
  // Pick, name draft and stock draft all belong to one siege, so switching days
  // drops them without an effect that writes state.
  const [selection, setSelection] = useState<{ key: string; slot: number } | null>(null);
  const [nameDraft, setNameDraft] = useState<{ key: string; slot: number; value: string } | null>(null);
  const [stock, setStock] = useState<{ key: string; rings: string; horns: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);
  const siege = `${owner}:${eventId}:${dayIndex}`;

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

  const saveCamps = async (rows: GuildEventCampRow[]) => {
    if (!supabase || rows.length === 0) return;
    setBusy(true);
    setError("");
    const { error: saveError } = await supabase.from(source.campTable).upsert(
      rows.map((row) => ({
        ...source.key,
        day_index: dayIndex,
        slot: row.slot,
        name: row.name.trim().slice(0, GUILD_CAMP_NAME_MAX),
        is_ours: row.is_ours,
        priority: row.is_ours ? 0 : row.priority,
        note: row.note.trim().slice(0, GUILD_CAMP_NOTE_MAX),
        updated_at: new Date().toISOString(),
      })),
      { onConflict: source.campConflict },
    );
    if (saveError) setError(saveError.message);
    else {
      setNameDraft(null);
      reload();
      onChanged?.();
    }
    setBusy(false);
  };

  const saveCamp = (camp: GuildEventCampRow, patch: Partial<GuildEventCampRow> = {}) =>
    saveCamps([{ ...camp, ...patch }]);

  /** A guild holds one village, so the old base gives up the flag. */
  const markBase = async (camp: GuildEventCampRow, isBase: boolean) => {
    const previous = camps.find((entry) => entry.is_ours && entry.slot !== camp.slot);
    const rows = previous && isBase ? [{ ...previous, is_ours: false }] : [];
    // Our own village carries our guild's name unless someone typed another one.
    const name = isBase && !camp.name.trim() ? ownLabel : camp.name;
    await saveCamps([...rows, { ...camp, name, is_ours: isBase, priority: 0 }]);
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
      setStock(null);
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

  // A guild's own board keeps its base in the camp row; a shared board gets one
  // village per allied guild from the alliance itself.
  const allBases: SiegeBase[] = shared
    ? bases
    : camps
        .filter((camp) => camp.is_ours)
        .map((camp) => ({ slot: camp.slot, label: camp.name.trim() || ownLabel, own: true }));
  const baseAt = (slot: number) => allBases.find((base) => base.slot === slot) ?? null;

  const blank = campSlots(count, []);
  const campAt = (slot: number) => camps.find((camp) => camp.slot === slot) ?? blank[slot - 1];
  const attackable = camps.filter((camp) => !baseAt(camp.slot));
  // Only a village that actually has an order carries a number on the map.
  const targets = campTargets(attackable).filter((camp) => camp.priority > 0);
  const orderOf = (slot: number) => targets.findIndex((entry) => entry.slot === slot) + 1;
  const campLabel = (camp: GuildEventCampRow) => camp.name.trim() || tf(t.guilds.campSlot, { n: camp.slot });

  const selected = selection && selection.key === siege ? selection.slot : null;
  const current = selected === null ? null : campAt(selected);
  const selectedBase = selected === null ? null : baseAt(selected);
  const naming =
    nameDraft && nameDraft.key === siege && selected !== null && nameDraft.slot === selected
      ? nameDraft.value
      : null;

  // The card sits under its village, and flips when the village is near an edge.
  const anchor = current ? map.points[(current.slot - 1) % map.points.length] : null;
  const popAlign = !anchor ? "center" : anchor.x < 30 ? "start" : anchor.x > 70 ? "end" : "center";
  const popSide = anchor && anchor.y > 50 ? "up" : "down";
  const close = () => setSelection(null);

  const pick = (slot: number) => {
    setSelection((value) => (value?.key === siege && value.slot === slot ? null : { key: siege, slot }));
    setNameDraft(null);
  };

  const field = (key: string) => `${ids}-${key}`;
  const myOrder = orderOfMember(userId);
  const myRings = stock?.key === siege ? stock.rings : String(myOrder.rings);
  const myHorns = stock?.key === siege ? stock.horns : String(myOrder.horns);
  const stockDirty = stock?.key === siege;
  const total = orderTotals(orders);
  const open = unassignedTotals(orders);
  // Whoever brought something comes first; an officer assigns from the top down.
  const members = roster
    .filter((member) => member.user_id)
    .slice()
    .sort((a, b) => {
      const left = orderOfMember(a.user_id!);
      const right = orderOfMember(b.user_id!);
      return Number(right.rings + right.horns > 0) - Number(left.rings + left.horns > 0);
    });
  // Nothing is planned on a shared board before both guilds hold a village.
  const locked = shared && allBases.length < 2;
  const plans = canOfficer && !locked;

  const targetLabel = (value: number) =>
    value === GUILD_ORDER_TARGET_ALL ? t.guilds.campTargetAll : campLabel(campAt(value));

  return (
    <section className="siege">
      {error ? (
        <p className="result-error" role="alert">
          {error}
        </p>
      ) : null}

      {needsBase ? (
        <p className="siege-callout" role="status">
          {t.guilds.basePickHint}
        </p>
      ) : null}

      <div
        className="siege-map"
        role="group"
        aria-label={t.guilds.campsMapLabel}
        style={{
          aspectRatio: map.ratio,
          ...(map.image ? { backgroundImage: `url("${asset(map.image)}")` } : {}),
        }}
      >
        {Array.from({ length: count }, (_, index) => index + 1).map((slot) => {
          const point = map.points[(slot - 1) % map.points.length];
          const base = baseAt(slot);
          const camp = campAt(slot);
          const order = orderOf(slot);
          const assigned = campAssignment(slot, orders);
          const quiet = assigned.rings === 0 && assigned.horns === 0 && assigned.attackers.length === 0;

          return (
            <button
              key={slot}
              type="button"
              className="siege-village"
              data-state={base ? (base.own ? "ours" : "ally") : order > 0 ? "target" : "free"}
              data-prio={order > 0 ? Math.min(order, 4) : undefined}
              aria-pressed={selected === slot}
              style={{ "--village-x": `${point.x}%`, "--village-y": `${point.y}%` } as CSSProperties}
              onClick={() => pick(slot)}
            >
              <span className="siege-village-head">
                {base ? (
                  <span className="siege-badge is-base">
                    <GuildsIcon className="icon" />
                  </span>
                ) : order > 0 ? (
                  <span className="siege-badge" data-prio={Math.min(order, 4)}>
                    {order}
                  </span>
                ) : null}
                <span className="siege-village-name">{base ? base.label : campLabel(camp)}</span>
              </span>
              {base || quiet ? null : (
                <span className="siege-village-numbers">
                  <span>{tf(t.guilds.campSpendShort, { rings: n(assigned.rings), horns: n(assigned.horns) })}</span>
                  {assigned.attackers.length > 0 ? (
                    <span className="siege-village-attackers">
                      <UsersIcon className="icon" />
                      {n(assigned.attackers.length)}
                    </span>
                  ) : null}
                </span>
              )}
            </button>
          );
        })}

        {current ? (
          <>
            <button type="button" className="siege-pop-backdrop" aria-label={t.guilds.popClose} onClick={close} />
            <div
              className="siege-pop"
              data-align={popAlign}
              data-side={popSide}
              style={
                anchor
                  ? ({ "--village-x": `${anchor.x}%`, "--village-y": `${anchor.y}%` } as CSSProperties)
                  : undefined
              }
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
              }}
            >
              <header className="siege-pop-head">
                {plans && !selectedBase ? (
                  <>
                    <input
                      className="siege-pop-name"
                      aria-label={t.guilds.campName}
                      value={naming ?? current.name}
                      maxLength={GUILD_CAMP_NAME_MAX}
                      placeholder={tf(t.guilds.campSlot, { n: current.slot })}
                      disabled={busy}
                      onChange={(e) => setNameDraft({ key: siege, slot: current.slot, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && naming !== null) void saveCamp(current, { name: naming });
                      }}
                    />
                    <button
                      type="button"
                      className="siege-pop-ok"
                      aria-label={t.guilds.campSave}
                      disabled={busy || naming === null}
                      onClick={() => naming !== null && void saveCamp(current, { name: naming })}
                    >
                      <CheckIcon className="icon icon-sm" />
                    </button>
                  </>
                ) : (
                  <strong>{selectedBase ? selectedBase.label : campLabel(current)}</strong>
                )}
                <button type="button" className="siege-pop-close" aria-label={t.guilds.popClose} onClick={close}>
                  <CloseIcon className="icon icon-sm" />
                </button>
              </header>

              {selectedBase ? (
                <div className="siege-pop-row">
                  <span className={selectedBase.own ? "pill pill-good" : "pill"}>
                    {selectedBase.own ? t.guilds.baseOur : t.guilds.baseAlly}
                  </span>
                  {canOfficer && selectedBase.own && !shared ? (
                    <button className="small-button" type="button" disabled={busy} onClick={() => void markBase(current, false)}>
                      {t.guilds.baseRemove}
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  {canOfficer ? (
                    <div className="siege-pop-row">
                      {shared ? (
                        needsBase && onPickBase ? (
                          <button
                            className="small-button button-primary"
                            type="button"
                            disabled={busy}
                            onClick={() => void onPickBase(current.slot)}
                          >
                            {t.guilds.baseSet}
                          </button>
                        ) : null
                      ) : (
                        <button className="small-button" type="button" disabled={busy} onClick={() => void markBase(current, true)}>
                          {t.guilds.baseSet}
                        </button>
                      )}
                    </div>
                  ) : null}

                  {plans ? (
                    <div className="siege-pop-row siege-pop-order">
                      <span className="siege-order-label">{t.guilds.targetOrder}</span>
                      {Array.from({ length: Math.max(count - allBases.length, 1) }, (_, i) => i + 1).map((value) => (
                            <button
                              key={value}
                              type="button"
                              className="siege-order-chip"
                              data-prio={Math.min(value, 4)}
                              aria-label={tf(t.guilds.campTarget, { n: value })}
                              aria-pressed={orderOf(current.slot) === value}
                              disabled={busy}
                              onClick={() =>
                                void saveCamps(
                                  setCampPriority(attackable, current.slot, orderOf(current.slot) === value ? 0 : value),
                                )
                              }
                            >
                              {value}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {plans ? (
                    <input
                      className="siege-pop-note"
                      key={`${siege}:${current.slot}:note`}
                      aria-label={t.guilds.campNote}
                      defaultValue={current.note}
                      maxLength={GUILD_CAMP_NOTE_MAX}
                      placeholder={t.guilds.campNotePlaceholder}
                      disabled={busy}
                      onBlur={(e) => {
                        if (e.target.value !== current.note) void saveCamp(current, { note: e.target.value });
                      }}
                    />
                  ) : current.note.trim() ? (
                    <p className="siege-note-text">{current.note}</p>
                  ) : null}

                  {plans ? (
                    <ul className="siege-assign">
                      {members.map((member) => {
                        const order = orderOfMember(member.user_id!);
                        const slot = current.slot;
                        return (
                          <li key={member.user_id}>
                            <span className="siege-assign-name">
                              {guildRosterLabel(member)}
                              {member.guild_name ? <small>{member.guild_name}</small> : null}
                            </span>
                            <span className="siege-assign-stock mono">
                              {tf(t.guilds.campSpendShort, { rings: n(order.rings), horns: n(order.horns) })}
                            </span>
                            <span className="siege-assign-buttons">
                              <button
                                type="button"
                                className="siege-assign-button"
                                aria-pressed={order.rings_target === slot}
                                disabled={busy || order.rings === 0}
                                onClick={() =>
                                  void saveOrder(order, {
                                    rings_target: order.rings_target === slot ? GUILD_ORDER_TARGET_ALL : slot,
                                  })
                                }
                              >
                                {t.guilds.campRings}
                              </button>
                              <button
                                type="button"
                                className="siege-assign-button"
                                aria-pressed={order.horns_target === slot}
                                disabled={busy || order.horns === 0}
                                onClick={() =>
                                  void saveOrder(order, {
                                    horns_target: order.horns_target === slot ? GUILD_ORDER_TARGET_ALL : slot,
                                  })
                                }
                              >
                                {t.guilds.campHorns}
                              </button>
                              <button
                                type="button"
                                className="siege-assign-button"
                                aria-pressed={order.attack_target === slot}
                                disabled={busy}
                                onClick={() =>
                                  void saveOrder(order, {
                                    attack_target: order.attack_target === slot ? GUILD_ORDER_TARGET_ALL : slot,
                                  })
                                }
                              >
                                {t.guilds.campAttackers}
                              </button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="siege-panel-line">
                      <span>
                        {tf(t.guilds.campSpendShort, {
                          rings: n(campAssignment(current.slot, orders).rings),
                          horns: n(campAssignment(current.slot, orders).horns),
                        })}
                      </span>
                      {campAssignment(current.slot, orders).attackers.length > 0 ? (
                        <span>
                          {t.guilds.campAttackers}:{" "}
                          {campAssignment(current.slot, orders).attackers.map(memberName).join(", ")}
                        </span>
                      ) : null}
                    </p>
                  )}
                </>
              )}
            </div>
          </>
        ) : null}
      </div>

      <div className="siege-stock">
        <div className="field">
          <label htmlFor={field("rings")}>{t.guilds.ordersMyRings}</label>
          <input
            id={field("rings")}
            inputMode="numeric"
            value={myRings}
            disabled={busy}
            onChange={(e) => setStock({ key: siege, rings: e.target.value.replace(/[^\d]/g, ""), horns: myHorns })}
          />
        </div>
        <div className="field">
          <label htmlFor={field("horns")}>{t.guilds.ordersMyHorns}</label>
          <input
            id={field("horns")}
            inputMode="numeric"
            value={myHorns}
            disabled={busy}
            onChange={(e) => setStock({ key: siege, rings: myRings, horns: e.target.value.replace(/[^\d]/g, "") })}
          />
        </div>
        <button
          className="button button-primary"
          type="button"
          disabled={busy || !stockDirty}
          onClick={() => void saveOrder(myOrder, { rings: whole(myRings, 9999), horns: whole(myHorns, 999_999) })}
        >
          {t.guilds.ordersSaveMine}
        </button>
        <p className="siege-stock-sum">
          {tf(t.guilds.stockSum, {
            rings: n(total.rings),
            horns: n(total.horns),
            openRings: n(open.rings),
            openHorns: n(open.horns),
          })}
        </p>
        <p className="siege-stock-mine">
          <span>
            {t.guilds.ordersRingsShort} {targetLabel(myOrder.rings_target)}
          </span>
          <span>
            {t.guilds.ordersHornsShort} {targetLabel(myOrder.horns_target)}
          </span>
          <span>
            {t.guilds.ordersAttackShort} {targetLabel(myOrder.attack_target)}
          </span>
        </p>
      </div>
    </section>
  );
}
