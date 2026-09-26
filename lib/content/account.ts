/**
 * The account page reads two things: how long Premium still runs, and the
 * guild listing that Premium is holding open.
 *
 * Nothing here talks to Supabase; it is the arithmetic behind the page so the
 * boundaries (an expiry today, an expiry an hour ago) can be tested.
 */

import { isLifetimePremium, isPremiumActive, type PremiumEntitlement } from "./premium.ts";

/** How close to the end the page starts pressing for a renewal. */
export const PREMIUM_REMINDER_DAYS = 5;

export type PremiumRow = Pick<
  PremiumEntitlement,
  "status" | "expires_at" | "note"
> & { auto_renew?: boolean };

/**
 * Whole days left, rounded up: an expiry later today is one day, not zero.
 * Never negative, so an expired row reads as 0 rather than a count backwards.
 */
export function premiumDaysLeft(expiresAt: string | null | undefined, now: Date = new Date()): number {
  if (!expiresAt) return 0;
  const ends = Date.parse(expiresAt);
  if (!Number.isFinite(ends)) return 0;
  const ms = ends - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

/**
 * True when the page should push the renewal: Premium is running, it is not a
 * lifetime grant, and it ends within the reminder window. Whether the member
 * asked to keep it running only decides how loudly — both states are shown.
 */
export function premiumRunsOutSoon(row: PremiumRow | null | undefined, now: Date = new Date()): boolean {
  if (!isPremiumActive(row, now)) return false;
  if (isLifetimePremium(row)) return false;
  return premiumDaysLeft(row?.expires_at, now) <= PREMIUM_REMINDER_DAYS;
}

export type GuildListingStatus = "none" | "pending" | "registered";

/** What the account page says about the one guild slot. */
export function guildListingStatus(
  request: { status: string; created_guild_id: string | null } | null | undefined,
): GuildListingStatus {
  if (!request) return "none";
  if (request.status === "approved" && request.created_guild_id) return "registered";
  if (request.status === "pending" || request.status === "approved") return "pending";
  return "none";
}
