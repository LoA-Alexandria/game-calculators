import assert from "node:assert/strict";
import test from "node:test";

import {
  guildRoomHref,
  isDiscordUserId,
  isGuildMasterOf,
  isGuildSlug,
  readGuildSlugParam,
  suggestGuildSlug,
} from "../lib/content/guilds.ts";

test("suggestGuildSlug normalizes display names", () => {
  assert.equal(suggestGuildSlug("  Ice S12  "), "ice-s12");
  assert.equal(suggestGuildSlug("Café Pop!"), "cafe-pop");
  assert.equal(suggestGuildSlug("---"), "");
});

test("isGuildSlug accepts stable room ids only", () => {
  assert.equal(isGuildSlug("ice-s12"), true);
  assert.equal(isGuildSlug("a"), false);
  assert.equal(isGuildSlug("Ice"), false);
  assert.equal(isGuildSlug("bad_slug"), false);
});

test("guild room links stay static-export friendly", () => {
  assert.equal(guildRoomHref("ice-s12"), "/guilds/room/news/?guild=ice-s12");
  assert.equal(guildRoomHref("ice-s12", "planung"), "/guilds/room/planung/?guild=ice-s12");
});

test("readGuildSlugParam rejects junk", () => {
  assert.equal(readGuildSlugParam("Ice-S12"), "ice-s12");
  assert.equal(readGuildSlugParam("nope!"), null);
  assert.equal(readGuildSlugParam(null), null);
});

test("Discord snowflake and master match helpers", () => {
  assert.equal(isDiscordUserId("1534890988588498944"), true);
  assert.equal(isDiscordUserId("abc"), false);
  assert.equal(
    isGuildMasterOf({ master_discord_user_id: "1534890988588498944" }, "1534890988588498944"),
    true,
  );
  assert.equal(
    isGuildMasterOf({ master_discord_user_id: "1534890988588498944" }, "1"),
    false,
  );
});
