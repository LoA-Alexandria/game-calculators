/**
 * Premium helpers: period length and whether a stored entitlement is live.
 *
 * Lifetime Premium is still a row in `premium_entitlements` (not a site role):
 * `source: 'manual'`, `note: 'lifetime'`, and a far-future `expires_at`.
 * `isPremiumActive` / RLS `has_active_premium` keep working unchanged.
 */

export const PREMIUM_PERIOD_DAYS = 30;

/** Listed Premium price in euro. Must match the PayPal NCP amount. */
export const PREMIUM_PRICE_EUR = 5;

/** Marker stored in `premium_entitlements.note` for admin lifetime grants. */
export const PREMIUM_LIFETIME_NOTE = "lifetime";

/**
 * Far-future expiry for lifetime grants. Chosen so ordinary 30-day renewals
 * never reach it and `isPremiumActive` stays true for decades.
 */
export const PREMIUM_LIFETIME_EXPIRES_AT = "2099-01-01T00:00:00.000Z";

export type PremiumEntitlement = {
  user_id: string;
  status: "active" | "expired" | "revoked";
  starts_at: string;
  expires_at: string;
  source: "paypal_ncp" | "manual";
  paypal_txn_id: string | null;
  note: string | null;
};

export function isPremiumActive(
  row: Pick<PremiumEntitlement, "status" | "expires_at"> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!row || row.status !== "active") return false;
  const ends = Date.parse(row.expires_at);
  return Number.isFinite(ends) && ends > now.getTime();
}

/** True when the row was granted as lifetime (note marker or far-future expiry). */
export function isLifetimePremium(
  row: Pick<PremiumEntitlement, "note" | "expires_at"> | null | undefined,
): boolean {
  if (!row) return false;
  if (row.note === PREMIUM_LIFETIME_NOTE) return true;
  const ends = Date.parse(row.expires_at);
  const lifetime = Date.parse(PREMIUM_LIFETIME_EXPIRES_AT);
  return Number.isFinite(ends) && Number.isFinite(lifetime) && ends >= lifetime;
}

/** ISO expiry used when an admin grants Lifetime Premium. */
export function lifetimePremiumExpiry(): string {
  return PREMIUM_LIFETIME_EXPIRES_AT;
}

/** Extend from the later of now or the current expiry by one Premium period. */
export function nextPremiumExpiry(currentExpiresAt: string | null | undefined, now: Date = new Date()): Date {
  const current = currentExpiresAt ? Date.parse(currentExpiresAt) : NaN;
  const base = Number.isFinite(current) && current > now.getTime() ? new Date(current) : now;
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + PREMIUM_PERIOD_DAYS);
  return next;
}
