import assert from "node:assert/strict";
import test from "node:test";

import {
  changedLocales,
  isTextGuide,
  parseTextGuideDraft,
  textGuideBlock,
  textGuideBlocks,
  textGuideDraft,
  textGuideEntry,
} from "../lib/content/text-guide-editor.ts";
import { DEFAULT_LOCALE, LOCALE_CODES, getDictionary } from "../lib/i18n/index.ts";

const english = getDictionary(DEFAULT_LOCALE);
const EVENT_GUIDES = Object.keys(english.eventGuideEntries);
/** Guides whose own page is only text, and that the text editor serves. */
const TEXT_GUIDES = ["adsBuy", "technology", "manor"];

/** Reads an exported block back into the object it describes. */
function evaluate(block) {
  const body = block.split("\n").slice(1).join("\n").trim().replace(/^[\w$]+:\s*/, "").replace(/,$/, "");
  return Function(`"use strict"; return (${body});`)();
}

test("every event guide and the text-only guides are text the editor can hold", () => {
  assert.ok(EVENT_GUIDES.length >= 29, `${EVENT_GUIDES.length} event guides`);
  for (const id of EVENT_GUIDES) assert.ok(isTextGuide("eventGuideEntries", id), `eventGuideEntries.${id}`);
  for (const id of TEXT_GUIDES) assert.ok(isTextGuide("guideEntries", id), `guideEntries.${id}`);
  // A guide with its own data file is not plain text.
  assert.equal(isTextGuide("guideEntries", "heroes"), false);
  assert.equal(isTextGuide("guideEntries", "cryptides"), false);
});

test("an untouched draft gives back every entry in every language unchanged", () => {
  const cases = [
    ...EVENT_GUIDES.map((id) => ["eventGuideEntries", id]),
    ...TEXT_GUIDES.map((id) => ["guideEntries", id]),
  ];
  for (const [catalog, id] of cases) {
    const draft = textGuideDraft(catalog, id);
    for (const locale of LOCALE_CODES) {
      const published = getDictionary(locale)[catalog][id];
      assert.deepEqual(textGuideEntry(draft, locale), published, `${locale} ${catalog}.${id}`);
      // key order is part of the file, so it has to survive as well
      assert.deepEqual(Object.keys(textGuideEntry(draft, locale)), Object.keys(published), `${locale} ${catalog}.${id} order`);
      assert.deepEqual(evaluate(textGuideBlock(catalog, id, draft, locale)), published, `${locale} ${catalog}.${id} block`);
    }
    assert.deepEqual(changedLocales(catalog, id, draft), [], `${catalog}.${id} unchanged`);
    assert.deepEqual(textGuideBlocks(catalog, id, draft), {}, `${catalog}.${id} exports nothing`);
  }
});

test("an edit in one language exports that dictionary only", () => {
  const draft = textGuideDraft("eventGuideEntries", "atlantis");
  const intro = draft.fields.find((field) => field.key === "intro");
  intro.text.de = "Eine neue Einleitung.";
  assert.deepEqual(changedLocales("eventGuideEntries", "atlantis", draft), ["de"]);
  const blocks = textGuideBlocks("eventGuideEntries", "atlantis", draft);
  assert.deepEqual(Object.keys(blocks), ["de"]);
  assert.match(blocks.de, /^\/\/ lib\/i18n\/dictionaries\/de\.ts — replace eventGuideEntries\.atlantis\n {4}atlantis: \{/);
  assert.equal(evaluate(blocks.de).intro, "Eine neue Einleitung.");
});

test("an empty translation falls back to English, and paragraphs split at blank lines", () => {
  const draft = textGuideDraft("eventGuideEntries", "holyGrail");
  draft.fields.find((field) => field.key === "note").text.fr = "";
  draft.sections[0].body.fr = "Premier paragraphe.\n\n  Deuxième paragraphe.  \n\n\n";
  const entry = textGuideEntry(draft, "fr");
  assert.equal(entry.note, english.eventGuideEntries.holyGrail.note);
  assert.deepEqual(entry.sections[0].body, ["Premier paragraphe.", "Deuxième paragraphe."]);
});

test("a new section lands in every language, an empty one is left out", () => {
  const draft = textGuideDraft("guideEntries", "adsBuy");
  const blank = () => Object.fromEntries(LOCALE_CODES.map((code) => [code, ""]));
  draft.sections.push({ heading: { ...blank(), en: "Extra" }, body: { ...blank(), en: "One tip." } });
  draft.sections.push({ heading: blank(), body: blank() });
  const count = english.guideEntries.adsBuy.sections.length;
  for (const locale of LOCALE_CODES) {
    const entry = textGuideEntry(draft, locale);
    assert.equal(entry.sections.length, count + 1, locale);
    assert.deepEqual(entry.sections.at(-1), { heading: "Extra", body: ["One tip."] });
    // the extra fields of Ads / Buy stay where they were
    assert.deepEqual(Object.keys(entry), Object.keys(english.guideEntries.adsBuy));
  }
});

test("a stored draft is read back against the entry it belongs to", () => {
  const base = textGuideDraft("eventGuideEntries", "ringToss");
  const stored = JSON.parse(JSON.stringify(base));
  stored.fields[0].text.de = "Geänderter Titel";
  stored.fields.push({ key: "gone", text: { en: "x" } });
  const back = parseTextGuideDraft(JSON.stringify(stored), base);
  assert.equal(back.fields[0].text.de, "Geänderter Titel");
  assert.deepEqual(back.fields.map((field) => field.key), base.fields.map((field) => field.key));
  assert.equal(parseTextGuideDraft("not json", base), null);
  assert.equal(parseTextGuideDraft(null, base), null);
});
