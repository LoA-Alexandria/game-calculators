/**
 * Premium helpers: period length and whether a stored entitlement is live.
 */

export const PREMIUM_PERIOD_DAYS = 30;

/** Listed Premium price in euro. Must match the PayPal NCP amount. */
export const PREMIUM_PRICE_EUR = 5;

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

/** Extend from the later of now or the current expiry by one Premium period. */
export function nextPremiumExpiry(currentExpiresAt: string | null | undefined, now: Date = new Date()): Date {
  const current = currentExpiresAt ? Date.parse(currentExpiresAt) : NaN;
  const base = Number.isFinite(current) && current > now.getTime() ? new Date(current) : now;
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + PREMIUM_PERIOD_DAYS);
  return next;
}
