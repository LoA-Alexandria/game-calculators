import assert from "node:assert/strict";
import test from "node:test";

import {
  chunkTextForMyMemory,
  guildPostBodyForLocale,
  guildPostTitleForLocale,
  htmlToPlainText,
  MYMEMORY_CHUNK_BYTES,
  otherLocales,
} from "../lib/content/guild-post-i18n.ts";

test("htmlToPlainText strips tags and keeps line breaks", () => {
  assert.equal(htmlToPlainText("<p>Hello</p><p>World</p>"), "Hello\nWorld");
  assert.equal(htmlToPlainText("plain only"), "plain only");
});

test("chunkTextForMyMemory keeps short text whole and splits long UTF-8", () => {
  assert.deepEqual(chunkTextForMyMemory("short"), ["short"]);
  const long = "a".repeat(MYMEMORY_CHUNK_BYTES + 40);
  const chunks = chunkTextForMyMemory(long);
  assert.ok(chunks.length >= 2);
  const encoder = new TextEncoder();
  for (const chunk of chunks) {
    assert.ok(encoder.encode(chunk).length <= MYMEMORY_CHUNK_BYTES);
  }
  assert.equal(chunks.join("").length, long.length);
});

test("guild post locale helpers fall back to source columns", () => {
  const post = {
    title: "Source title",
    body: "<p>Source body</p>",
    source_locale: "de",
    title_i18n: { de: "Quelle", en: "Source", fr: "Source FR" },
    body_i18n: { de: "<p>Körper</p>", en: "<p>Body</p>", fr: "" },
  };
  assert.equal(guildPostTitleForLocale(post, "en"), "Source");
  assert.equal(guildPostTitleForLocale(post, "fr"), "Source FR");
  assert.match(guildPostBodyForLocale(post, "en"), /Body/);
  assert.match(guildPostBodyForLocale(post, "fr"), /Körper/);
  assert.deepEqual(otherLocales("de"), ["en", "fr"]);
});
