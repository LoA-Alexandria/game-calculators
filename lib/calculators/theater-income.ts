/**
 * Goddess Theater income, after Autumn's (Ice, S12) tests of 20 August 2026.
 *
 *   Ticket price = ⌊base ticket × (1 + ticket price upgrades ± event)⌋
 *   Audience     = ⌊base visitors × (1 + visitor flow upgrades ± event)⌋
 *   Ticket income       = ⌊ticket price × audience × (1 + muse coin bonus)⌋
 *   Merchandise income  = ⌊merchandise × audience × (1 + muse coin bonus)⌋
 *
 * The game rounds the price and the audience down before multiplying; that is
 * where the few coins of difference in her notes came from. Her three
 * performances (Pride and Prejudice, Don Quixote, Robinson Crusoe) come out to
 * the coin with these rules, see `tests/theater-income.test.mjs`.
 *
 * Each matching aptitude between a deployed goddess and the play adds 10 % muse
 * coin bonus; auto deploy sends the goddesses with the most matches.
 */
import data from "../data/theater-income.json" with { type: "json" };
import { THEATER_PLAYS, type TheaterPlay } from "../content/goddess-theater.ts";

export const PLAY_RARITIES = ["UR+", "UR", "SSR", "SR", "R"] as const;
export type PlayRarity = (typeof PLAY_RARITIES)[number];

/** The twelve aptitudes; ids are English, the names the game shows are in each dictionary's `theaterIncome.aptitudes`. */
export type AptitudeId =
  | "adventure"
  | "artistry"
  | "darkness"
  | "family"
  | "idealism"
  | "innocence"
  | "instinct"
  | "intrigue"
  | "love"
  | "revenge"
  | "satire"
  | "suspense";

/** A rehearsal event nudges the base ticket price or visitor flow by 5 % for the whole run. */
export const REHEARSAL_EVENTS = ["none", "ticketUp", "ticketDown", "visitorsUp", "visitorsDown"] as const;
export type RehearsalEvent = (typeof REHEARSAL_EVENTS)[number];

export type TheaterStats = {
  /** Ticket price upgrades in percent, in steps of 0.5 (e.g. 270). */
  ticketPercent: number;
  /** Visitor flow upgrades in percent, in steps of 0.5 (e.g. 268.5). */
  visitorPercent: number;
  /** Merchandise price, a whole number (e.g. 810). */
  merchandise: number;
  event: RehearsalEvent;
};

export type PlayNumbers = {
  /** Base ticket price from the in-game preview. */
  ticket: number;
  /** Base visitor flow from the in-game preview. */
  visitors: number;
  /** Muse coin bonus in percent (e.g. 90). */
  bonusPercent: number;
};

export type Performance = {
  ticketPrice: number;
  audience: number;
  ticketIncome: number;
  merchandiseIncome: number;
  total: number;
};

export type IncomePlay = {
  id: string;
  play: TheaterPlay;
  rarity: PlayRarity;
  /** Goddesses the play takes; auto deploy fills them with the best matches. */
  slots: number;
  ticket?: number;
  visitors?: number;
  aptitudes?: AptitudeId[];
  /** Autumn's total at 310 % / 310 % / 930 merchandise with her goddesses. */
  reference?: number;
};

export type GoddessAptitudes = {
  name: string;
  /** Aptitudes known so far; a goddess has three. */
  aptitudes: AptitudeId[];
  /** Aptitudes she is known not to have, which makes some plays exact before all three are known. */
  lacks?: AptitudeId[];
};

type RawPlay = { id: string; rarity: string; slots?: number; ticket?: number; visitors?: number; aptitudes?: string[]; reference?: number };
type RawData = {
  bonusPerMatch: number;
  slots: number;
  reference: { ticketPercent: number; visitorPercent: number; merchandise: number };
  aptitudes: { id: string; resource?: string }[];
  plays: RawPlay[];
  goddesses: { name: string; aptitudes: string[]; lacks?: string[] }[];
};

const RAW = data as RawData;

export const BONUS_PER_MATCH = RAW.bonusPerMatch;
export const REFERENCE_STATS = RAW.reference;
/** Each aptitude and the Exploration-age resource its goddess training raises, where the game has shown it. */
export const APTITUDES = RAW.aptitudes as { id: AptitudeId; resource?: string }[];
export const GODDESS_APTITUDES = RAW.goddesses as GoddessAptitudes[];

export const INCOME_PLAYS: IncomePlay[] = RAW.plays.map((raw) => {
  const play = THEATER_PLAYS.find((entry) => entry.id === raw.id);
  if (!play) throw new Error(`theater-income.json names a play that is not in goddess-theater.json: ${raw.id}`);
  return {
    id: raw.id,
    play,
    rarity: raw.rarity as PlayRarity,
    slots: raw.slots ?? RAW.slots,
    ...(raw.ticket ? { ticket: raw.ticket } : {}),
    ...(raw.visitors ? { visitors: raw.visitors } : {}),
    ...(raw.aptitudes ? { aptitudes: raw.aptitudes as AptitudeId[] } : {}),
    ...(raw.reference ? { reference: raw.reference } : {}),
  };
});

export function incomePlay(id: string): IncomePlay | undefined {
  return INCOME_PLAYS.find((entry) => entry.id === id);
}

/** Percent in tenths, so 268.5 % is exactly 2685 and nothing drifts in floating point. */
function tenths(percent: number): number {
  return Math.round(percent * 10);
}

/** ⌊base × (1 + percent)⌋, computed in whole numbers. */
function raised(base: number, percentTenths: number): number {
  return Math.floor((base * (1000 + percentTenths)) / 1000);
}

function eventTenths(event: RehearsalEvent, kind: "ticket" | "visitors"): number {
  if (event === `${kind}Up`) return 50;
  if (event === `${kind}Down`) return -50;
  return 0;
}

export function performance(play: PlayNumbers, stats: TheaterStats): Performance {
  const ticketPrice = raised(play.ticket, tenths(stats.ticketPercent) + eventTenths(stats.event, "ticket"));
  const audience = raised(play.visitors, tenths(stats.visitorPercent) + eventTenths(stats.event, "visitors"));
  const bonus = 100 + Math.round(play.bonusPercent);
  const ticketIncome = Math.floor((ticketPrice * audience * bonus) / 100);
  const merchandiseIncome = Math.floor((Math.floor(stats.merchandise) * audience * bonus) / 100);
  return { ticketPrice, audience, ticketIncome, merchandiseIncome, total: ticketIncome + merchandiseIncome };
}

/**
 * Red Carpet Night drops worth about 83–85 % of the income ÷ 1,000 in event
 * points (Autumn, 21 August 2026: 9.5M income gave 8,100 points). Every item
 * is worth a multiple of 100, so both ends are rounded down to whole hundreds.
 */
export const RED_CARPET_SHARE = [0.83, 0.85] as const;

export function redCarpetPoints(total: number): [number, number] {
  const hundreds = (share: number) => Math.floor((total * share) / 100_000) * 100;
  return [hundreds(RED_CARPET_SHARE[0]), hundreds(RED_CARPET_SHARE[1])];
}

/** What one more upgrade step (+0.5 %) of ticket price or visitor flow adds to this play. */
export function upgradeGains(play: PlayNumbers, stats: TheaterStats): { ticket: number; visitors: number } {
  const now = performance(play, stats).total;
  return {
    ticket: performance(play, { ...stats, ticketPercent: stats.ticketPercent + 0.5 }).total - now,
    visitors: performance(play, { ...stats, visitorPercent: stats.visitorPercent + 0.5 }).total - now,
  };
}

export type Deployment = {
  /** Muse coin bonus in percent from the goddesses auto deploy would send. */
  percent: number;
  goddesses: { name: string; matches: number }[];
  /** False when an owned goddess might match more than is recorded, so the bonus is only a lower bound. */
  exact: boolean;
  /** Owned goddesses whose aptitudes for this play are not fully known. */
  unknown: string[];
};

/**
 * The bonus auto deploy reaches with the goddesses a player owns. Null when the
 * play's own aptitudes are not recorded yet.
 */
export function deployment(entry: IncomePlay, owned: readonly string[]): Deployment | null {
  const needs = entry.aptitudes;
  if (!needs) return null;
  const known = new Map(GODDESS_APTITUDES.map((goddess) => [goddess.name, goddess]));
  const unknown: string[] = [];
  const rows = owned.map((name) => {
    const goddess = known.get(name);
    const matches = goddess ? needs.filter((aptitude) => goddess.aptitudes.includes(aptitude)).length : 0;
    const settled =
      goddess !== undefined &&
      (goddess.aptitudes.length >= 3 || needs.every((aptitude) => goddess.aptitudes.includes(aptitude) || goddess.lacks?.includes(aptitude)));
    if (!settled) unknown.push(name);
    return { name, matches };
  });
  const chosen = rows
    .filter((row) => row.matches > 0)
    .sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name))
    .slice(0, entry.slots);
  const percent = chosen.reduce((sum, row) => sum + row.matches * BONUS_PER_MATCH, 0);
  // A goddess with unknown aptitudes only matters if she could still beat the weakest one sent, or fill a free slot.
  const weakest = chosen.length < entry.slots ? 0 : chosen[chosen.length - 1].matches;
  const exact = unknown.every((name) => {
    const goddess = known.get(name);
    const recorded = goddess ? needs.filter((aptitude) => goddess.aptitudes.includes(aptitude)).length : 0;
    const open = needs.filter((aptitude) => !goddess?.aptitudes.includes(aptitude) && !goddess?.lacks?.includes(aptitude)).length;
    return recorded + Math.min(open, 3 - (goddess?.aptitudes.length ?? 0)) <= weakest;
  });
  return { percent, goddesses: chosen, exact, unknown: exact ? [] : unknown };
}
