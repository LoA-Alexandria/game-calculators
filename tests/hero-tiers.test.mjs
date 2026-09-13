import assert from "node:assert/strict";
import test from "node:test";

import en from "../lib/i18n/dictionaries/en.ts";
import de from "../lib/i18n/dictionaries/de.ts";
import fr from "../lib/i18n/dictionaries/fr.ts";
import { LAYOUT_DATA, placedHeroes } from "../lib/content/hero-layouts.ts";
import {
  BATTLE_TIERS,
  OVERALL_TIERS,
  PRODUCTIVITY_TIERS,
  TIER_IDS,
  UTILITY_TIERS,
  matchesHero,
  parseGrade,
} from "../lib/content/hero-tiers.ts";

const LANGUAGES = { en, de, fr };
const productivityEntries = PRODUCTIVITY_TIERS.flatMap((row) =>
  row.groups.flatMap((group) => group.entries.map((entry) => ({ ...entry, tier: row.tier, resource: group.resource }))),
);

test("every grade in the overall list parses", () => {
  for (const row of OVERALL_TIERS) {
    for (const entry of row.entries) {
      for (const grade of [entry.battle, entry.utility, entry.productivity]) {
        if (grade !== undefined) assert.ok(parseGrade(grade), `${entry.hero}: ${grade}`);
      }
    }
  }
  assert.deepEqual(parseGrade("A>S"), { tier: "A", to: "S", fine: "", flagged: false });
  assert.deepEqual(parseGrade("SS(S+)"), { tier: "SS", to: null, fine: "S+", flagged: false });
  assert.deepEqual(parseGrade("C*"), { tier: "C", to: null, fine: "", flagged: true });
  assert.equal(parseGrade("S+"), null);
});

test("the tier rows run from SS to D in order", () => {
  for (const rows of [OVERALL_TIERS, BATTLE_TIERS, UTILITY_TIERS]) {
    assert.deepEqual(rows.map((row) => row.tier), [...TIER_IDS]);
  }
  const productivity = PRODUCTIVITY_TIERS.map((row) => row.tier);
  assert.deepEqual(productivity, TIER_IDS.filter((tier) => productivity.includes(tier)));
});

test("no hero is listed twice in the same form within one list", () => {
  const check = (label, keys) => {
    const seen = new Set();
    for (const key of keys) {
      assert.equal(seen.has(key), false, `${label}: ${key} appears twice`);
      seen.add(key);
    }
  };
  check("overall", OVERALL_TIERS.flatMap((row) => row.entries.map((entry) => `${entry.hero}|${entry.variant ?? ""}`)));
  check("battle", BATTLE_TIERS.flatMap((row) => row.entries.map((entry) => `${entry.hero}|${entry.variant ?? ""}`)));
  check("utility", UTILITY_TIERS.flatMap((row) => row.entries.map((entry) => `${entry.hero}|${entry.note ?? ""}`)));
  check("productivity", productivityEntries.map((entry) => `${entry.hero}|${entry.resource}`));
});

test("heroes graded for utility or productivity overall appear in those lists", () => {
  const utilityHeroes = new Set(UTILITY_TIERS.flatMap((row) => row.entries.map((entry) => entry.hero)));
  const productivityHeroes = new Set(productivityEntries.map((entry) => entry.hero));
  for (const row of OVERALL_TIERS) {
    for (const entry of row.entries) {
      if (entry.utility) assert.ok(utilityHeroes.has(entry.hero), `${entry.hero} has a utility grade but no utility entry`);
      if (entry.productivity) assert.ok(productivityHeroes.has(entry.hero), `${entry.hero} has a productivity grade but no productivity entry`);
    }
  }
});

test("every key the data uses has text in every language", () => {
  const used = {
    variants: new Set(), roles: new Set(), effects: new Set(), resources: new Set(), notes: new Set(),
  };
  const tag = (entry) => {
    if (entry.variant) used.variants.add(entry.variant);
    if (entry.note) used.notes.add(entry.note);
  };
  OVERALL_TIERS.forEach((row) => row.entries.forEach(tag));
  BATTLE_TIERS.forEach((row) => row.entries.forEach((entry) => { tag(entry); entry.roles.forEach((role) => used.roles.add(role)); }));
  UTILITY_TIERS.forEach((row) => row.entries.forEach((entry) => { tag(entry); used.effects.add(entry.effect); }));
  productivityEntries.forEach((entry) => { tag(entry); used.resources.add(entry.resource); });
  for (const [code, dictionary] of Object.entries(LANGUAGES)) {
    const text = dictionary.guideEntries.heroTierList;
    for (const [group, keys] of Object.entries(used)) {
      for (const key of keys) {
        assert.equal(typeof text[group][key], "string", `${code}.${group}.${key}`);
        assert.notEqual(text[group][key].trim(), "", `${code}.${group}.${key} is empty`);
      }
    }
  }
});

test("hero names match the Hero layouts guide", () => {
  const tierHeroes = new Set([
    ...OVERALL_TIERS.flatMap((row) => row.entries.map((entry) => entry.hero)),
    ...BATTLE_TIERS.flatMap((row) => row.entries.map((entry) => entry.hero)),
    ...UTILITY_TIERS.flatMap((row) => row.entries.map((entry) => entry.hero)),
    ...productivityEntries.map((entry) => entry.hero),
  ]);
  for (const name of placedHeroes(LAYOUT_DATA)) {
    assert.ok(tierHeroes.has(name), `${name} from Hero layouts is missing or spelled differently in the tier list`);
  }
});

test("the hero filter ignores case and accents", () => {
  assert.equal(matchesHero("Joan of Arc", "joan"), true);
  assert.equal(matchesHero("Cu Chulainn", "CÚ"), true);
  assert.equal(matchesHero("Tesla", "arthur"), false);
  assert.equal(matchesHero("Tesla", "   "), true);
});

test("every reason key has text in every language, and every reason is used once", () => {
  const used = OVERALL_TIERS.flatMap((row) => row.entries.map((entry) => entry.reason).filter(Boolean));
  assert.equal(new Set(used).size, used.length, "a reason is attached to two entries");
  for (const [code, dictionary] of Object.entries(LANGUAGES)) {
    const reasons = dictionary.guideEntries.heroTierList.reasons;
    assert.deepEqual(Object.keys(reasons).sort(), [...used].sort(), `${code} reasons differ from the entries that use them`);
    for (const key of used) assert.notEqual(reasons[key].trim(), "", `${code}.reasons.${key} is empty`);
    for (const entry of dictionary.guideEntries.heroTierList.changelog) {
      assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/, `${code} changelog date`);
    }
  }
});
