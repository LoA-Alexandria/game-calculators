/**
 * Catalog and pure helpers for guild planning events.
 * Event rules that matter for coordination live here as versioned code.
 */

export const GUILD_PLAN_EVENT_IDS = [
  "trials-of-odin",
  "dawn-of-rome",
  "heart-of-gold",
  "spring-returns",
] as const;

export type GuildPlanEventId = (typeof GUILD_PLAN_EVENT_IDS)[number];

export type GuildEventDayResult = "pending" | "won" | "lost";
export type GuildEventPledgeStatus = "ready" | "waiting" | "spent";

export type GuildPlanEventDef = {
  id: GuildPlanEventId;
  /** Dictionary key under t.guilds.events.<key> */
  labelKey: "trialsOfOdin" | "dawnOfRome" | "heartOfGold" | "springReturns";
  seriesDays: number;
  winDaysNeeded: number;
  /** Highlight Spring Returns tactics copy in the UI. */
  featured: boolean;
  /**
   * How many camps the siege map has, ours included. Trials of Odin puts five
   * around Asgard; events without a map leave this out.
   */
  camps?: number;
};

export const GUILD_PLAN_EVENTS: readonly GuildPlanEventDef[] = [
  {
    id: "trials-of-odin",
    labelKey: "trialsOfOdin",
    seriesDays: 3,
    winDaysNeeded: 2,
    featured: false,
    camps: 5,
  },
  {
    id: "dawn-of-rome",
    labelKey: "dawnOfRome",
    seriesDays: 3,
    winDaysNeeded: 2,
    featured: false,
  },
  {
    id: "heart-of-gold",
    labelKey: "heartOfGold",
    seriesDays: 3,
    winDaysNeeded: 2,
    featured: false,
  },
  {
    id: "spring-returns",
    labelKey: "springReturns",
    seriesDays: 3,
    winDaysNeeded: 2,
    featured: true,
  },
] as const;

export function isGuildPlanEventId(value: string): value is GuildPlanEventId {
  return (GUILD_PLAN_EVENT_IDS as readonly string[]).includes(value);
}

export function guildPlanEventDef(id: GuildPlanEventId): GuildPlanEventDef {
  const found = GUILD_PLAN_EVENTS.find((event) => event.id === id);
  if (!found) throw new Error(`Unknown guild plan event: ${id}`);
  return found;
}

export type GuildEventDayRow = {
  day_index: number;
  our_score: number;
  enemy_score: number;
  result: GuildEventDayResult;
  call_note: string;
};

export type GuildEventPledgeRow = {
  user_id: string;
  amount: number;
  status: GuildEventPledgeStatus;
};

/** One camp on the siege map, as `guild_event_camps` stores it. */
export type GuildEventCampRow = {
  slot: number;
  name: string;
  server_name: string;
  is_ours: boolean;
  /** 0 means no order yet; 1 is hit first. */
  priority: number;
  note: string;
};

/**
 * What a member brings to a siege and where an officer sends it.
 * A target of 0 means every camp, or the member's own choice.
 */
export type GuildEventOrderRow = {
  user_id: string;
  rings: number;
  horns: number;
  rings_target: number;
  horns_target: number;
  attack_target: number;
};

export const GUILD_ORDER_TARGET_ALL = 0;

export const GUILD_CAMP_NAME_MAX = 60;
export const GUILD_CAMP_SERVER_MAX = 40;
export const GUILD_CAMP_NOTE_MAX = 200;

/** An empty camp for a slot the guild has not filled in yet. */
export function emptyCamp(slot: number): GuildEventCampRow {
  return { slot, name: "", server_name: "", is_ours: false, priority: 0, note: "" };
}

/** An empty order row for a member who has not said what they have. */
export function emptyOrder(userId: string): GuildEventOrderRow {
  return { user_id: userId, rings: 0, horns: 0, rings_target: 0, horns_target: 0, attack_target: 0 };
}

/** Every slot of the map, filled from the stored rows, so a fresh siege still shows the board. */
export function campSlots(count: number, rows: readonly GuildEventCampRow[]): GuildEventCampRow[] {
  return Array.from({ length: count }, (_, index) => {
    const slot = index + 1;
    return rows.find((row) => row.slot === slot) ?? emptyCamp(slot);
  });
}

/**
 * Targets in the order they should be hit: our own camp drops out, camps with
 * an order come first, then the rest by slot.
 */
export function campTargets(camps: readonly GuildEventCampRow[]): GuildEventCampRow[] {
  return camps
    .filter((camp) => !camp.is_ours)
    .slice()
    .sort((a, b) => {
      const ordered = Number(a.priority === 0) - Number(b.priority === 0);
      if (ordered !== 0) return ordered;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.slot - b.slot;
    });
}

/** Everything the guild has for this siege, whether it is pointed at a camp or not. */
export function orderTotals(orders: readonly GuildEventOrderRow[]): { rings: number; horns: number } {
  return orders.reduce(
    (sum, order) => ({ rings: sum.rings + order.rings, horns: sum.horns + order.horns }),
    { rings: 0, horns: 0 },
  );
}

/**
 * Rings, horns, and attackers an officer has pointed at one camp. Orders left
 * on "every camp" are counted separately, so a camp never claims them.
 */
export function campAssignment(
  slot: number,
  orders: readonly GuildEventOrderRow[],
): { rings: number; horns: number; attackers: string[] } {
  return orders.reduce(
    (sum, order) => ({
      rings: sum.rings + (order.rings_target === slot ? order.rings : 0),
      horns: sum.horns + (order.horns_target === slot ? order.horns : 0),
      attackers: order.attack_target === slot ? [...sum.attackers, order.user_id] : sum.attackers,
    }),
    { rings: 0, horns: 0, attackers: [] as string[] },
  );
}

/** Rings and horns nobody has been given a camp for yet. */
export function unassignedTotals(orders: readonly GuildEventOrderRow[]): { rings: number; horns: number } {
  return orders.reduce(
    (sum, order) => ({
      rings: sum.rings + (order.rings_target === GUILD_ORDER_TARGET_ALL ? order.rings : 0),
      horns: sum.horns + (order.horns_target === GUILD_ORDER_TARGET_ALL ? order.horns : 0),
    }),
    { rings: 0, horns: 0 },
  );
}

/** The order number a newly prioritised camp should get. */
export function nextCampPriority(camps: readonly GuildEventCampRow[]): number {
  const used = camps.filter((camp) => !camp.is_ours && camp.priority > 0).length;
  return Math.min(used + 1, 6);
}

type BerlinParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function berlinParts(date: Date): BerlinParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const raw = Object.fromEntries(
    formatter.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return {
    year: Number(raw.year),
    month: Number(raw.month),
    day: Number(raw.day),
    hour: Number(raw.hour),
    minute: Number(raw.minute),
    second: Number(raw.second),
  };
}

/** Milliseconds from `now` until the next midnight in Europe/Berlin. */
export function msUntilBerlinMidnight(now: Date = new Date()): number {
  const wall = berlinParts(now);
  let year = wall.year;
  let month = wall.month;
  let day = wall.day;
  if (wall.hour !== 0 || wall.minute !== 0 || wall.second !== 0) {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    year = next.getUTCFullYear();
    month = next.getUTCMonth() + 1;
    day = next.getUTCDate();
  }

  let guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  for (let i = 0; i < 4; i++) {
    const parts = berlinParts(new Date(guess));
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const want = Date.UTC(year, month - 1, day, 0, 0, 0);
    guess += want - asUtc;
  }
  return Math.max(0, guess - now.getTime());
}

/** Whole hours and leftover minutes until Berlin midnight. */
export function hoursUntilBerlinMidnight(now: Date = new Date()): {
  hours: number;
  minutes: number;
  ms: number;
} {
  const ms = msUntilBerlinMidnight(now);
  const totalMinutes = Math.floor(ms / 60_000);
  return {
    ms,
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function scoreGap(ourScore: number, enemyScore: number): number {
  return Math.max(0, Math.floor(enemyScore) - Math.floor(ourScore));
}

/** Ready+waiting pledges that can still cover the gap (spent excluded). */
export function pledgeCoverage(
  ourScore: number,
  enemyScore: number,
  pledges: ReadonlyArray<Pick<GuildEventPledgeRow, "amount" | "status">>,
): { gap: number; available: number; covers: boolean } {
  const gap = scoreGap(ourScore, enemyScore);
  const available = pledges
    .filter((p) => p.status === "ready" || p.status === "waiting")
    .reduce((sum, p) => sum + Math.max(0, Math.floor(p.amount)), 0);
  return { gap, available, covers: available >= gap };
}

export function seriesScore(
  days: ReadonlyArray<Pick<GuildEventDayRow, "result">>,
): { won: number; lost: number } {
  let won = 0;
  let lost = 0;
  for (const day of days) {
    if (day.result === "won") won += 1;
    if (day.result === "lost") lost += 1;
  }
  return { won, lost };
}

/** First pending day, else last day index in the series. */
export function currentEventDayIndex(
  seriesDays: number,
  days: ReadonlyArray<Pick<GuildEventDayRow, "day_index" | "result">>,
): number {
  const pending = [...days]
    .filter((d) => d.result === "pending")
    .sort((a, b) => a.day_index - b.day_index);
  if (pending[0]) return pending[0].day_index;
  const maxDone = days.reduce((m, d) => Math.max(m, d.day_index), 0);
  if (maxDone >= seriesDays) return seriesDays;
  return Math.min(seriesDays, Math.max(1, maxDone + 1));
}
