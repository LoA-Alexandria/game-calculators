#!/usr/bin/env node
/**
 * What is still untranslated, per language:
 *
 *   pnpm i18n:report            counts, with a short list per language
 *   pnpm i18n:report de --all   every string in German that equals English
 *
 * A string equal to English is not always a mistake (brand names, "Buff"),
 * so this is a to-do list for translators, not a failing check. It also counts
 * how many heroes, painting sets, goddesses, and plays have wording in each language.
 */

import { DEFAULT_LOCALE, LOCALES, getDictionary } from "../lib/i18n/index.ts";
import { HEROES } from "../lib/content/heroes.ts";
import { PAINTING_SETS } from "../lib/content/artwork.ts";
import { COLLECTION_ITEMS } from "../lib/content/collection.ts";
import { GODDESSES } from "../lib/content/goddesses.ts";
import { THEATER_PLAYS } from "../lib/content/goddess-theater.ts";
import { leaves } from "./i18n-tools.mjs";

const args = process.argv.slice(2);
const only = args.find((arg) => !arg.startsWith("--"));
const all = args.includes("--all");

/** Catalogs are sparse by design; they are counted separately below. */
const CATALOGS = /(?:^|\.)(heroTexts|playTexts|catalogTexts|goddessTexts|phaseTexts|collectionTexts|setupTexts|optionTexts)(?:\.|$)/;

const english = new Map(leaves(getDictionary(DEFAULT_LOCALE)).filter(([path]) => !CATALOGS.test(path)));
const paintings = PAINTING_SETS.reduce((sum, set) => sum + set.paintings.length, 0);

for (const { code, label } of LOCALES) {
  if (code === DEFAULT_LOCALE || (only && only !== code)) continue;
  const dictionary = getDictionary(code);
  const same = leaves(dictionary)
    .filter(([path, value]) => !CATALOGS.test(path) && english.get(path) === value && /\p{L}{3,}/u.test(value));
  const heroTexts = Object.keys(dictionary.guideEntries.heroes.heroTexts).length;
  const catalog = dictionary.guideEntries.artwork.catalogTexts;
  const sets = Object.keys(catalog.sets ?? {}).length;
  const paintingTexts = Object.keys(catalog.paintings ?? {}).length;
  const plays = Object.keys(dictionary.guideEntries.goddessTheater.playTexts).length;
  const goddesses = Object.keys(dictionary.guideEntries.goddesses.goddessTexts).length;
  const collection = Object.keys(dictionary.guideEntries.collection.collectionTexts).length;

  console.log(`\n${label} (${code})`);
  console.log(`  ${same.length} of ${english.size} strings are identical to English`);
  console.log(`  hero wording: ${heroTexts}/${HEROES.length} heroes · painting sets: ${sets}/${PAINTING_SETS.length} · paintings: ${paintingTexts}/${paintings} · goddesses: ${goddesses}/${GODDESSES.length} · collection: ${collection}/${COLLECTION_ITEMS.length} · plays: ${plays}/${THEATER_PLAYS.length}`);
  for (const [path, value] of all ? same : same.slice(0, 12)) {
    console.log(`    ${path}: ${JSON.stringify(value.length > 70 ? `${value.slice(0, 67)}...` : value)}`);
  }
  if (!all && same.length > 12) console.log(`    … ${same.length - 12} more (add --all)`);
}
