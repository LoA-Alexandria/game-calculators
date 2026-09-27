import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { DATA_FILE_NAMES, dataFits } from "../lib/content/guide-data.ts";
import { OVERRIDABLE_FIELDS } from "../lib/content/guide-overrides.ts";
import { getDictionary } from "../lib/i18n/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const guidesDir = join(root, "app/guides");
const editors = readdirSync(guidesDir).filter((name) => name.endsWith("Editor.tsx"));
const source = (name) => readFileSync(join(guidesDir, name), "utf8");

/** Every `<SaveToSite …>` in the codebase, with the props it was given. */
function savers() {
  const out = [];
  for (const name of editors) {
    const text = source(name);
    for (const match of text.matchAll(/<SaveToSite\s([^<>]*?)\/>/g)) {
      const props = {};
      // `texts={{ a: …, b: … }}` nests, so a brace is counted rather than matched.
      for (const prop of match[1].matchAll(/(\w+)=(?:"([^"]*)"|\{)/g)) {
        if (prop[2] !== undefined) {
          props[prop[1]] = prop[2];
          continue;
        }
        let depth = 1;
        let at = prop.index + prop[0].length;
        while (at < match[1].length && depth > 0) {
          if (match[1][at] === "{") depth += 1;
          if (match[1][at] === "}") depth -= 1;
          at += 1;
        }
        props[prop[1]] = match[1].slice(prop.index + prop[0].length, at - 1).trim();
      }
      out.push({ editor: name, props });
    }
  }
  return out;
}

test("every editor that saves points at a data file that exists", () => {
  const found = savers();
  assert.ok(found.length >= 16, `only ${found.length} editors can save`);
  for (const { editor, props } of found) {
    assert.ok(props.file, `${editor} has no file`);
    assert.ok(
      DATA_FILE_NAMES.includes(props.file),
      `${editor} writes "${props.file}", which is not a file under lib/data`,
    );
    assert.ok(props.data, `${editor} passes no data`);
  }
});

test("no two editors claim the same data file", () => {
  // Two editors writing one file would overwrite each other's work, and the
  // second save would silently undo the first.
  const byFile = new Map();
  for (const { editor, props } of savers()) {
    const already = byFile.get(props.file);
    assert.equal(already, undefined, `${editor} and ${already} both write ${props.file}`);
    byFile.set(props.file, editor);
  }
});

/** The dictionary fields an editor names in `texts={{ … }}`. */
function textFields(props) {
  if (!props.texts) return [];
  const inner = props.texts.replace(/^\{|\}$/g, "");
  const fields = [];
  let depth = 0;
  for (const part of inner.split(/([{}(),])/)) {
    if (part === "{" || part === "(") depth += 1;
    else if (part === "}" || part === ")") depth -= 1;
    else if (depth === 0) {
      const named = part.match(/^\s*(\w+)\s*:/);
      if (named) fields.push(named[1]);
    }
  }
  return fields;
}

test("a guide named for its texts really has those fields", () => {
  const entries = getDictionary("en").guideEntries;
  for (const { editor, props } of savers()) {
    const fields = textFields(props);
    if (!props.guideId && fields.length === 0) continue;
    assert.ok(props.guideId && fields.length > 0, `${editor} names texts only halfway`);
    const entry = entries[props.guideId];
    assert.ok(entry, `${editor} names guide "${props.guideId}", which does not exist`);
    for (const field of fields) {
      assert.ok(field in entry, `${props.guideId} has no ${field}`);
      assert.ok(
        OVERRIDABLE_FIELDS.includes(field),
        `${field} is not a field an override may carry`,
      );
    }
  }
});

test("an editor that hands out dictionary blocks also publishes those words", () => {
  // The leak this closes: thirteen editors saved their data file and nothing
  // else, so a renamed label looked saved and never reached the page. An
  // editor that can write words for the dictionary has to be able to publish
  // them.
  for (const { editor, props } of savers()) {
    if (!source(editor).includes("DictionaryBlocks")) continue;
    const fields = textFields(props);
    assert.ok(
      fields.length > 0,
      `${editor} can write dictionary text but its Save button only carries ${props.file}`,
    );
  }
});

test("the editors that still only export are the ones we know about", () => {
  const without = editors.filter((name) => !source(name).includes("<SaveToSite")).sort();
  // GuideEditor writes guide prose rather than a data file, so it saves
  // through its own path. Anything else appearing here is an editor that was
  // added without a way to save it.
  assert.deepEqual(without, ["GuideEditor.tsx"]);
});

test("an editor that saves also starts from what is published", () => {
  // An editor that opens on the committed data shows the old names while the
  // site shows the new ones, and its next save puts the old ones back. Saving
  // without this is worse than not saving at all.
  for (const { editor, props } of savers()) {
    const text = source(editor);
    assert.ok(
      text.includes("useGuideData<"),
      `${editor} saves ${props.file} but opens on the committed version`,
    );
    // Only the editors that write words need those published too.
    if (textFields(props).length > 0) {
      assert.ok(
        text.includes("usePublishedTexts(") || text.includes("fromLayout(") || text.includes("state.texts"),
        `${editor} opens on the committed names`,
      );
    }
  }
});

test("a file cannot be saved under a name it does not fit", () => {
  // The guard behind all of this: the right file accepts its own contents,
  // and a different one does not.
  const heroes = JSON.parse(readFileSync(join(root, "lib/data/heroes.json"), "utf8"));
  assert.equal(dataFits("heroes", heroes), true);
  assert.equal(dataFits("collection", heroes), false);
  assert.equal(dataFits("museion", heroes), false);
});

test("the text editor can save and starts from what is published", () => {
  // Every event page and every text-only guide is edited through this one
  // component, so its save path stands in for all of them.
  const text = readFileSync(join(root, "app/components/TextGuideEditor.tsx"), "utf8");
  assert.match(text, /saveGuideDraft\(/, "the text editor cannot write to the site");
  assert.match(text, /publishGuide\(/, "the text editor cannot publish");
  assert.match(text, /usePublishedOverrides\(/, "the text editor opens on the built text");
  assert.match(text, /textGuideDraft\(catalog, id, shown\)/, "its baseline is not what the site shows");

  // And both pages that mount it read the published entry back.
  for (const page of ["app/events/EventArticle.tsx", "app/guides/GuideArticle.tsx"]) {
    assert.match(readFileSync(join(root, page), "utf8"), /useGuideEntry\(/, `${page} shows only the built text`);
  }
});

test("a guide reads the data the site serves, or is on the list of those that do not yet", () => {
  // Publishing writes a row; a guide that still reads its committed file shows
  // nothing of it. The list below is the work left, and it may only shrink.
  const waiting = [
    "CryptidTowerLayoutGuide.tsx",
  ];
  const pages = readdirSync(guidesDir).filter(
    (name) => name.endsWith("Guide.tsx") || name === "HeroRoster.tsx",
  );
  const withoutData = pages
    // A guide with a data constant in its imports: a plain helper is no sign.
    .filter((name) => /import \{[^}]*\b[A-Z][A-Z_0-9]{2,}\b[^}]*\} from "\.\.\/\.\.\/lib\/content\//s.test(source(name)))
    .filter((name) => !source(name).includes("useGuideData<"))
    .sort();
  assert.deepEqual(
    withoutData,
    waiting.filter((name) => pages.includes(name)).sort(),
    "a guide either reads the published data or is named above",
  );
});
