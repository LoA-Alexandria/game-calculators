import test from "node:test";
import assert from "node:assert/strict";
import {
  contentShareMessage,
  hasContentSharePermission,
  validShareFields,
} from "../supabase/functions/benben-discord/content-share.ts";
import { premiumRoleShouldBePresent } from "../supabase/functions/sync-premium-discord-role/premium-role.ts";

test("content share accepts only complete content and published Pop Epoch links", () => {
  const fields = {
    category: "guide",
    title: "Hero layouts",
    summary: "A short guide summary.",
    link: "https://loa-alexandria.github.io/game-calculators/guides/hero-layouts/",
  };
  assert.equal(validShareFields(fields), true);
  assert.equal(validShareFields({ ...fields, category: "premium" }), false);
  assert.equal(validShareFields({ ...fields, title: " " }), false);
  assert.equal(validShareFields({ ...fields, title: "x".repeat(121) }), false);
  assert.equal(validShareFields({ ...fields, link: "https://example.com/" }), false);
  assert.equal(validShareFields({ ...fields, link: "https://loa-alexandria.github.io.evil.com/game-calculators/" }), false);
  assert.equal(validShareFields({ ...fields, link: "http://loa-alexandria.github.io/game-calculators/" }), false);
});

test("content share produces a non-pinging branded embed", () => {
  const post = contentShareMessage("event", "Atlantis", "Event guide", "https://loa-alexandria.github.io/game-calculators/events/atlantis/");
  assert.equal(post.embeds[0].title, "Event · Atlantis");
  assert.equal(post.embeds[0].description, "Event guide");
  assert.deepEqual(post.allowed_mentions, { parse: [] });
});

test("only members with Manage Messages may use the content share command", () => {
  assert.equal(hasContentSharePermission("8192"), true);
  assert.equal(hasContentSharePermission("8193"), true);
  assert.equal(hasContentSharePermission("0"), false);
  assert.equal(hasContentSharePermission("manage_messages"), false);
  assert.equal(hasContentSharePermission(undefined), false);
});

test("VIP exists only during a valid active entitlement window", () => {
  const start = Date.parse("2026-09-01T00:00:00.000Z");
  const expires = Date.parse("2026-10-01T00:00:00.000Z");
  const active = { status: "active", starts_at: new Date(start).toISOString(), expires_at: new Date(expires).toISOString() };
  assert.equal(premiumRoleShouldBePresent(active, start), true);
  assert.equal(premiumRoleShouldBePresent(active, expires - 1), true);
  assert.equal(premiumRoleShouldBePresent(active, expires), false);
  assert.equal(premiumRoleShouldBePresent({ ...active, status: "revoked" }, start), false);
  assert.equal(premiumRoleShouldBePresent({ ...active, starts_at: "invalid" }, start), false);
  assert.equal(premiumRoleShouldBePresent(null, start), false);
});
