import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GUILD_DISPLAY_NAME_MAX,
  GUILD_REQUEST_NOTE_MAX,
  guildRosterLabel,
  normalizeGuildDisplayName,
  normalizeGuildRequestNote,
} from "../lib/content/guilds.ts";

describe("guild request notes", () => {
  it("trims whitespace and clamps to the max length", () => {
    assert.equal(normalizeGuildRequestNote("  hello  "), "hello");
    assert.equal(normalizeGuildRequestNote("x".repeat(GUILD_REQUEST_NOTE_MAX + 20)).length, GUILD_REQUEST_NOTE_MAX);
  });
});

describe("guild display names", () => {
  it("trims and clamps display names", () => {
    assert.equal(normalizeGuildDisplayName("  Alex  "), "Alex");
    assert.equal(normalizeGuildDisplayName("x".repeat(GUILD_DISPLAY_NAME_MAX + 5)).length, GUILD_DISPLAY_NAME_MAX);
  });

  it("prefers display name over Discord id", () => {
    assert.equal(guildRosterLabel({ display_name: "Alex", discord_user_id: "123456789012345678" }), "Alex");
    assert.equal(guildRosterLabel({ display_name: "  ", discord_user_id: "123456789012345678" }), "1234…5678");
    assert.equal(guildRosterLabel({ display_name: "", discord_user_id: null }), "—");
  });
});
