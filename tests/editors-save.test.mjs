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
    for (const match of text.matchAll(/<SaveToSite\s([^>]*?)\/>/gs)) {
      const props = {};
      for (const prop of match[1].matchAll(/(\w+)=(?:"([^"]*)"|\{([^}]*)\})/g)) {
        props[prop[1]] = prop[2] ?? prop[3].trim();
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

test("a guide named for its texts really has that field", () => {
  const entries = getDictionary("en").guideEntries;
  for (const { editor, props } of savers()) {
    if (!props.guideId && !props.textField) continue;
    assert.ok(props.guideId && props.textField && props.texts, `${editor} names texts only halfway`);
    const entry = entries[props.guideId];
    assert.ok(entry, `${editor} names guide "${props.guideId}", which does not exist`);
    assert.ok(props.textField in entry, `${props.guideId} has no ${props.textField}`);
    assert.ok(
      OVERRIDABLE_FIELDS.includes(props.textField),
      `${props.textField} is not a field an override may carry`,
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
    // Only the editors that write per-entry names need those published too.
    if (props.textField) {
      assert.ok(text.includes("usePublishedTexts("), `${editor} opens on the committed names`);
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
