import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatGuildServer,
  guildOwnerChoice,
  isGuildServerNumber,
  normalizeGuildServerNumber,
  GUILD_SERVER_NUMBER_MAX,
} from "../lib/content/guilds.ts";

describe("server number and name", () => {
  it("joins both halves into one label", () => {
    assert.equal(formatGuildServer("123", "Alexandria"), "S123 Alexandria");
  });

  it("keeps whichever half was given", () => {
    assert.equal(formatGuildServer("123", ""), "S123");
    assert.equal(formatGuildServer("", "Alexandria"), "Alexandria");
    assert.equal(formatGuildServer("", ""), "");
  });

  it("takes the digits out of what a person typed", () => {
    assert.equal(normalizeGuildServerNumber("S123"), "123");
    assert.equal(normalizeGuildServerNumber("s 12 3"), "123");
    assert.equal(normalizeGuildServerNumber("1234567890").length, GUILD_SERVER_NUMBER_MAX);
    assert.equal(formatGuildServer(" S 42 ", "  Nile  "), "S42 Nile");
  });

  it("accepts only digits as a server number", () => {
    assert.equal(isGuildServerNumber("42"), true);
    assert.equal(isGuildServerNumber(" 42 "), true);
    assert.equal(isGuildServerNumber("S42"), false);
    assert.equal(isGuildServerNumber(""), false);
  });
});

const me = { userId: "user-1", discordUserId: "123456789012345678", name: "Xenatosa" };

describe("who the requested guild belongs to", () => {
  it("points at the requester for their own account", () => {
    assert.deepEqual(guildOwnerChoice("self", "", me), {
      owner_kind: "self",
      owner_user_id: "user-1",
      master_discord_user_id: "123456789012345678",
      master_handle: "Xenatosa",
    });
  });

  it("falls back to the requester when nobody else was named", () => {
    assert.equal(guildOwnerChoice("other", "   ", me).owner_kind, "self");
    assert.equal(guildOwnerChoice("other", "   ", me).owner_user_id, "user-1");
  });

  it("stores a typed snowflake as the master id", () => {
    assert.deepEqual(guildOwnerChoice("other", " 987654321098765432 ", me), {
      owner_kind: "other",
      owner_user_id: null,
      master_discord_user_id: "987654321098765432",
      master_handle: "",
    });
  });

  it("stores anything else as a handle for the admin to resolve", () => {
    assert.deepEqual(guildOwnerChoice("other", "Helvi", me), {
      owner_kind: "other",
      owner_user_id: null,
      master_discord_user_id: null,
      master_handle: "Helvi",
    });
  });

  it("leaves a password account without a snowflake", () => {
    const passwordAccount = { userId: "user-2", discordUserId: null, name: "Nora" };
    assert.deepEqual(guildOwnerChoice("self", "", passwordAccount), {
      owner_kind: "self",
      owner_user_id: "user-2",
      master_discord_user_id: null,
      master_handle: "Nora",
    });
  });
});
