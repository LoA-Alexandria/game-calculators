import assert from "node:assert/strict";
import test from "node:test";

import {
  guildPostHtml,
  looksLikeGuildHtml,
  sanitizeGuildHtml,
} from "../lib/content/guild-rich-text.ts";
import { guildMatchesServerFilter } from "../lib/content/guilds.ts";

test("server filter matches case-insensitively on server and name", () => {
  const guild = { name: "Celestial", server_name: "S9 - Garden" };
  assert.equal(guildMatchesServerFilter(guild, "garden"), true);
  assert.equal(guildMatchesServerFilter(guild, "GARDEN"), true);
  assert.equal(guildMatchesServerFilter(guild, "celest"), true);
  assert.equal(guildMatchesServerFilter(guild, "ice"), false);
  assert.equal(guildMatchesServerFilter(guild, "  "), true);
});

test("sanitizeGuildHtml keeps formatting tags and drops scripts", () => {
  const dirty = `<p>Hello <b>bold</b> <script>alert(1)</script><a href="https://x.test">x</a></p>`;
  const clean = sanitizeGuildHtml(dirty);
  assert.match(clean, /<b>bold<\/b>/i);
  assert.doesNotMatch(clean, /script/i);
  assert.doesNotMatch(clean, /href/i);
  assert.doesNotMatch(clean, /<a/i);
});

test("sanitizeGuildHtml keeps size classes on spans", () => {
  const clean = sanitizeGuildHtml(`<span class="guild-rt-lg evil">Big</span>`);
  assert.match(clean, /class="guild-rt-lg"/);
  assert.doesNotMatch(clean, /evil/);
});

test("plain posts render without looking like HTML", () => {
  assert.equal(looksLikeGuildHtml("Just text\n\nNext"), false);
  assert.equal(looksLikeGuildHtml("<p>Hi</p>"), true);
  assert.match(guildPostHtml("Line one\n\nLine two"), /<p>/);
});
