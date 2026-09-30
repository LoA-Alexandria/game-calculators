import assert from "node:assert/strict";
import test from "node:test";

import {
  contentDictionaryBlocks,
  contentDictionaryEntry,
  contentIdFromSlug,
  contentSiteInstructions,
  emptyContentBlock,
  safeContentUrl,
  slugifyContent,
} from "../lib/content/content-builder.ts";
import { LOCALE_CODES } from "../lib/i18n/index.ts";

function translated(en) {
  return Object.fromEntries(LOCALE_CODES.map((locale) => [locale, locale === "en" ? en : ""]));
}

function draft(kind = "guide") {
  const paragraph = emptyContentBlock("paragraph");
  paragraph.text = translated("A useful paragraph.");
  const heading = emptyContentBlock("heading");
  heading.text = translated("Getting started");
  const image = emptyContentBlock("image");
  image.src = "/guides/example.webp";
  image.alt = translated("Example art");
  const link = emptyContentBlock("coreLink");
  link.href = "/guides/core-elements/";
  link.text = translated("Read Core Elements");
  const callout = emptyContentBlock("callout");
  callout.text = translated("Keep this in mind.");
  return {
    kind, slug: "a-useful-guide", date: "2026-09-29", categoryId: "coreElements", image: "/guides/cover.webp",
    title: translated("A useful guide"), summary: translated("A short summary."), intro: translated("An introduction."),
    note: translated("A closing note."), blocks: [paragraph, heading, image, link, callout],
  };
}

test("content slugs and code ids are stable and ASCII-safe", () => {
  assert.equal(slugifyContent("  Über Core & Tips!  "), "uber-core-tips");
  assert.equal(contentIdFromSlug("a-useful-guide"), "aUsefulGuide");
  assert.equal(contentIdFromSlug("---"), "newContent");
});

test("content URLs allow site paths and HTTPS, but reject unsafe schemes and traversal", () => {
  assert.equal(safeContentUrl("/guides/core-elements/"), true);
  assert.equal(safeContentUrl("https://example.com/image.webp"), true);
  assert.equal(safeContentUrl("//evil.test/image"), false);
  assert.equal(safeContentUrl("javascript:alert(1)"), false);
  assert.equal(safeContentUrl("/images/../private.png"), false);
});

test("guide dictionaries serialize the rich block sequence into existing guide shape", () => {
  const entry = contentDictionaryEntry(draft("guide"), "en");
  assert.equal(entry.title, "A useful guide");
  assert.equal(entry.summary, "A short summary.");
  assert.equal(entry.intro, "An introduction.");
  assert.equal(entry.sections.length, 2);
  assert.equal(entry.sections[0].heading, "");
  assert.deepEqual(entry.sections[0].body, ["A useful paragraph."]);
  assert.deepEqual(entry.sections[1].body, [
    "![Example art](/guides/example.webp)",
    "[Read Core Elements](/guides/core-elements/)",
    "> Keep this in mind.",
  ]);
  assert.equal(entry.sections[1].heading, "Getting started");
  assert.equal(entry.note, "A closing note.");
});

test("news output includes summary and article page instructions", () => {
  const news = draft("news");
  const entry = contentDictionaryEntry(news, "en");
  assert.deepEqual(entry.body, [
    "A useful paragraph.",
    "## Getting started",
    "![Example art](/guides/example.webp)",
    "[Read Core Elements](/guides/core-elements/)",
    "> Keep this in mind.",
  ]);
  assert.match(contentSiteInstructions(news), /lib\/content\/news\.ts/);
  assert.match(contentSiteInstructions(news), /No separate page file is needed for News/);
});

test("builder produces all registered language blocks and explicit route instructions", () => {
  const guide = draft("guide");
  const blocks = contentDictionaryBlocks(guide);
  assert.deepEqual(Object.keys(blocks).sort(), [...LOCALE_CODES].sort());
  assert.match(blocks.en, /guideEntries/);
  assert.match(contentSiteInstructions(guide), /app\/guides\/a-useful-guide\/page\.tsx/);
  assert.match(contentSiteInstructions(guide), /GUIDE_PRESENTATION/);
  assert.match(contentSiteInstructions(draft("event")), /app\/events\/a-useful-guide\/page\.tsx/);
});
