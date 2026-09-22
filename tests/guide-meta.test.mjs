import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import test from "node:test";

import { GUIDE_PRESENTATION } from "../lib/content/guide-meta.ts";
import { guideIdFromHref } from "../lib/content/guides.ts";
import { LOCALE_CODES, getDictionary } from "../lib/i18n/index.ts";
import { sectionById } from "../lib/navigation.ts";

const file = (path) => new URL(`..${path}`, import.meta.url);

test("every guide in the navigation has a card with pictures that exist", () => {
  const items = sectionById("guides").items;
  for (const item of items) {
    const id = guideIdFromHref(item.href);
    const presentation = GUIDE_PRESENTATION[id];
    assert.ok(presentation, `${item.href} has no entry in GUIDE_PRESENTATION`);
    assert.ok(presentation.art.length <= 4, `${id}: at most four pictures`);
    for (const path of presentation.art) assert.ok(existsSync(file(`/public${path}`)), `${id}: ${path} is missing`);
  }
});

test("a guide lists its editor exactly when it has an editor page", () => {
  const withPage = readdirSync(file("/app/guides/"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(file(`/app/guides/${entry.name}/edit/page.tsx`)))
    .map((entry) => `/guides/${entry.name}/edit/`)
    .sort();
  const listed = Object.values(GUIDE_PRESENTATION).map((entry) => entry.editor?.href).filter(Boolean).sort();
  assert.deepEqual(listed, withPage);
});

test("every category on the Guides index has a line in every language", () => {
  const categories = new Set(sectionById("guides").items.map((item) => item.categoryId));
  for (const code of LOCALE_CODES) {
    const guides = getDictionary(code).guides;
    for (const category of categories) {
      assert.ok(guides.categoryLedes[category]?.trim(), `${code}: categoryLedes.${category}`);
    }
    assert.match(guides.countGuides, /\{count\}/, `${code}: countGuides`);
  }
});
