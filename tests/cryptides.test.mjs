import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { getDictionary, mapLocales } from "../lib/i18n/index.ts";
import { sectionById } from "../lib/navigation.ts";
import { guideHasSnippetEditor, guideHref, guideLayout } from "../lib/content/guides.ts";
import {
  CRYPTIDES,
  CRYPTIDES_DATA,
  CRYPTID_TOWERS,
  TALENT_MATERIALS,
} from "../lib/content/cryptides.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("Cryptides sits under Core elements and uses its own renderer", () => {
  const item = sectionById("guides").items.find((entry) => entry.href === "/guides/cryptides/");
  assert.equal(item?.categoryId, "coreElements");
  assert.equal(guideHref("cryptides"), "/guides/cryptides/");
  assert.equal(guideHasSnippetEditor("cryptides"), false);
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    assert.equal(guideLayout(dictionary.guideEntries.cryptides), "cryptides", code);
    assert.ok(dictionary.guideEntries.cryptides.cryptidesHeading, code);
  }
});

test("every Cryptide has tower material, skills, foods, and on-disk images", () => {
  assert.equal(CRYPTIDES.length, 4);
  assert.equal(CRYPTIDES_DATA.talent.unlockCost, 5);
  assert.equal(CRYPTIDES_DATA.talent.dropAmount, 5);
  assert.equal(CRYPTIDES_DATA.talent.dropEveryLevels, 20);
  const expected = {
    cerberus: { tower: "pike", material: "bell" },
    nidhogg: { tower: "bow", material: "branch" },
    caladrius: { tower: "shield", material: "potion" },
    sleipnir: { tower: "horse", material: "grass" },
  };
  for (const cryptide of CRYPTIDES) {
    assert.ok(CRYPTID_TOWERS.includes(cryptide.tower), cryptide.id);
    assert.ok(TALENT_MATERIALS.includes(cryptide.talentMaterial), cryptide.id);
    assert.equal(cryptide.tower, expected[cryptide.id].tower, cryptide.id);
    assert.equal(cryptide.talentMaterial, expected[cryptide.id].material, cryptide.id);
    assert.equal(cryptide.skills.length, 3, cryptide.id);
    assert.equal(cryptide.foods.length, 3, cryptide.id);
    assert.ok(existsSync(join(root, "public", "cryptides", cryptide.image)), cryptide.image);
    for (const skill of cryptide.skills) {
      assert.ok(existsSync(join(root, "public", "cryptides", skill.image)), skill.image);
    }
    for (const food of cryptide.foods) {
      assert.ok(existsSync(join(root, "public", "cryptides", food.image)), food.image);
      assert.ok(food.growth > 0, food.id);
    }
  }
});

test("every language names every Cryptide skill and food", () => {
  for (const [code, dictionary] of Object.entries(mapLocales(getDictionary))) {
    const texts = dictionary.guideEntries.cryptides.cryptideTexts;
    for (const cryptide of CRYPTIDES) {
      const entry = texts[cryptide.id];
      assert.ok(entry?.name, `${code}.${cryptide.id}`);
      for (const skill of cryptide.skills) {
        assert.ok(entry.skills?.[skill.id]?.name, `${code}.${cryptide.id}.${skill.id}`);
        assert.ok(entry.skills?.[skill.id]?.body, `${code}.${cryptide.id}.${skill.id}.body`);
      }
      for (const food of cryptide.foods) {
        assert.ok(entry.foods?.[food.id]?.name, `${code}.${cryptide.id}.${food.id}`);
      }
    }
  }
});
