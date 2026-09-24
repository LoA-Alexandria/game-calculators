import assert from "node:assert/strict";
import test from "node:test";

import { isPremiumActive, nextPremiumExpiry, PREMIUM_PERIOD_DAYS } from "../lib/content/premium.ts";

test("active premium needs status active and a future expiry", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  assert.equal(isPremiumActive({ status: "active", expires_at: "2026-10-28T12:00:00Z" }, now), true);
  assert.equal(isPremiumActive({ status: "active", expires_at: "2026-09-01T12:00:00Z" }, now), false);
  assert.equal(isPremiumActive({ status: "revoked", expires_at: "2026-10-28T12:00:00Z" }, now), false);
  assert.equal(isPremiumActive(null, now), false);
});

test("renewal stacks thirty days from the later of now or current expiry", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const fromNow = nextPremiumExpiry(null, now);
  assert.equal(fromNow.toISOString(), "2026-10-28T12:00:00.000Z");
  assert.equal(PREMIUM_PERIOD_DAYS, 30);

  const stacked = nextPremiumExpiry("2026-10-10T12:00:00Z", now);
  assert.equal(stacked.toISOString(), "2026-11-09T12:00:00.000Z");
});
