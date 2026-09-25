import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  guildListingStatus,
  premiumDaysLeft,
  premiumRunsOutSoon,
  PREMIUM_REMINDER_DAYS,
} from "../lib/content/account.ts";
import { PREMIUM_LIFETIME_EXPIRES_AT } from "../lib/content/premium.ts";

const now = new Date("2026-09-25T12:00:00.000Z");
const inDays = (days) => new Date(now.getTime() + days * 86_400_000).toISOString();

describe("how long Premium still runs", () => {
  it("counts whole days, rounding a part-day up", () => {
    assert.equal(premiumDaysLeft(inDays(10), now), 10);
    assert.equal(premiumDaysLeft(inDays(0.25), now), 1);
  });

  it("never counts backwards", () => {
    assert.equal(premiumDaysLeft(inDays(-3), now), 0);
    assert.equal(premiumDaysLeft(now.toISOString(), now), 0);
  });

  it("survives a missing or broken expiry", () => {
    assert.equal(premiumDaysLeft(null, now), 0);
    assert.equal(premiumDaysLeft(undefined, now), 0);
    assert.equal(premiumDaysLeft("not a date", now), 0);
  });
});

describe("the renewal reminder", () => {
  const active = (expires) => ({ status: "active", expires_at: expires, note: null });

  it("shows inside the window and not before it", () => {
    assert.equal(premiumRunsOutSoon(active(inDays(PREMIUM_REMINDER_DAYS)), now), true);
    assert.equal(premiumRunsOutSoon(active(inDays(PREMIUM_REMINDER_DAYS + 1)), now), false);
  });

  it("stays quiet for an expired, revoked or missing row", () => {
    assert.equal(premiumRunsOutSoon(active(inDays(-1)), now), false);
    assert.equal(premiumRunsOutSoon({ status: "revoked", expires_at: inDays(2), note: null }, now), false);
    assert.equal(premiumRunsOutSoon(null, now), false);
  });

  it("never nags a lifetime grant", () => {
    assert.equal(
      premiumRunsOutSoon({ status: "active", expires_at: PREMIUM_LIFETIME_EXPIRES_AT, note: "lifetime" }, now),
      false,
    );
  });
});

describe("the one guild slot", () => {
  it("is registered once the guild exists", () => {
    assert.equal(guildListingStatus({ status: "approved", created_guild_id: "g1" }), "registered");
  });

  it("is still pending while nobody has created it", () => {
    assert.equal(guildListingStatus({ status: "pending", created_guild_id: null }), "pending");
    assert.equal(guildListingStatus({ status: "approved", created_guild_id: null }), "pending");
  });

  it("is free without a row, or after a rejection", () => {
    assert.equal(guildListingStatus(null), "none");
    assert.equal(guildListingStatus({ status: "rejected", created_guild_id: null }), "none");
  });
});
