import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GUILD_REQUEST_NOTE_MAX,
  normalizeGuildRequestNote,
} from "../lib/content/guilds.ts";

describe("guild request notes", () => {
  it("trims whitespace and clamps to the max length", () => {
    assert.equal(normalizeGuildRequestNote("  hello  "), "hello");
    assert.equal(normalizeGuildRequestNote("x".repeat(GUILD_REQUEST_NOTE_MAX + 20)).length, GUILD_REQUEST_NOTE_MAX);
  });
});
