import assert from "node:assert/strict";
import test from "node:test";

import {
  isLifetimePremium,
  isPremiumActive,
  manualPremiumExpiry,
  lifetimePremiumExpiry,
  nextPremiumExpiry,
  PREMIUM_LIFETIME_EXPIRES_AT,
  PREMIUM_LIFETIME_NOTE,
  PREMIUM_PERIOD_DAYS,
  PREMIUM_PRICE_EUR,
  EARLY_SUPPORTER_LIMIT,
  isEarlySupporterActive,
} from "../lib/content/premium.ts";
import { earlySupporterRoleShouldBePresent } from "../supabase/functions/sync-premium-discord-role/premium-role.ts";

test("listed Premium price is five dollars for thirty days", () => {
  assert.equal(PREMIUM_PRICE_EUR, 5);
  assert.equal(PREMIUM_PERIOD_DAYS, 30);
});

test("Early Supporter cohort is capped at twenty and remains independent of Premium expiry", () => {
  assert.equal(EARLY_SUPPORTER_LIMIT, 20);
  assert.equal(isEarlySupporterActive({ revoked_at: null }), true);
  assert.equal(isEarlySupporterActive({ revoked_at: "2026-10-01T00:00:00Z" }), false);
  assert.equal(earlySupporterRoleShouldBePresent({ revoked_at: null }), true);
  assert.equal(earlySupporterRoleShouldBePresent({ revoked_at: "2026-10-01T00:00:00Z" }), false);
  assert.equal(earlySupporterRoleShouldBePresent(null), false);
});

test("active premium needs status active and a future expiry", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  assert.equal(isPremiumActive({ status: "active", expires_at: "2026-10-28T12:00:00Z" }, now), true);
  assert.equal(isPremiumActive({ status: "active", expires_at: "2026-09-01T12:00:00Z" }, now), false);
  assert.equal(isPremiumActive({ status: "revoked", expires_at: "2026-10-28T12:00:00Z" }, now), false);
  assert.equal(isPremiumActive(null, now), false);
});

test("lifetime grant uses far-future expiry and is treated as active", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  assert.equal(lifetimePremiumExpiry(), PREMIUM_LIFETIME_EXPIRES_AT);
  assert.equal(PREMIUM_LIFETIME_NOTE, "lifetime");
  assert.equal(
    isPremiumActive({ status: "active", expires_at: PREMIUM_LIFETIME_EXPIRES_AT }, now),
    true,
  );
  assert.equal(
    isLifetimePremium({ note: PREMIUM_LIFETIME_NOTE, expires_at: PREMIUM_LIFETIME_EXPIRES_AT }),
    true,
  );
  assert.equal(
    isLifetimePremium({ note: null, expires_at: PREMIUM_LIFETIME_EXPIRES_AT }),
    true,
  );
  assert.equal(
    isLifetimePremium({ note: null, expires_at: "2026-10-28T12:00:00Z" }),
    false,
  );
});

test("renewal stacks thirty days from the later of now or current expiry", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const fromNow = nextPremiumExpiry(null, now);
  assert.equal(fromNow.toISOString(), "2026-10-28T12:00:00.000Z");
  assert.equal(PREMIUM_PERIOD_DAYS, 30);

  const stacked = nextPremiumExpiry("2026-10-10T12:00:00Z", now);
  assert.equal(stacked.toISOString(), "2026-11-09T12:00:00.000Z");
});

test("manual Premium grants add one, two, or three 30-day months", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  assert.equal(manualPremiumExpiry(null, 1, now).toISOString(), "2026-10-28T12:00:00.000Z");
  assert.equal(manualPremiumExpiry(null, 2, now).toISOString(), "2026-11-27T12:00:00.000Z");
  assert.equal(manualPremiumExpiry(null, 3, now).toISOString(), "2026-12-27T12:00:00.000Z");
  assert.throws(() => manualPremiumExpiry(null, 4, now), RangeError);
});

test("manual Premium grants stack from future expiry and ignore expired expiry", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  assert.equal(
    manualPremiumExpiry("2026-10-10T12:00:00Z", 2, now).toISOString(),
    "2026-12-09T12:00:00.000Z",
  );
  assert.equal(
    manualPremiumExpiry("2026-09-01T12:00:00Z", 3, now).toISOString(),
    "2026-12-27T12:00:00.000Z",
  );
});
