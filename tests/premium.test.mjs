import assert from "node:assert/strict";
import test from "node:test";

import {
  isLifetimePremium,
  isPremiumActive,
  lifetimePremiumExpiry,
  nextPremiumExpiry,
  PREMIUM_LIFETIME_EXPIRES_AT,
  PREMIUM_LIFETIME_NOTE,
  PREMIUM_PERIOD_DAYS,
  PREMIUM_PRICE_EUR,
} from "../lib/content/premium.ts";

test("listed Premium price is five euro for thirty days", () => {
  assert.equal(PREMIUM_PRICE_EUR, 5);
  assert.equal(PREMIUM_PERIOD_DAYS, 30);
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
