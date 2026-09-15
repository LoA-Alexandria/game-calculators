#!/usr/bin/env node
/**
 * Adds a language to the site:
 *
 *   pnpm i18n:add es "Español"
 *   pnpm i18n:add pt-BR "Português (Brasil)" --short PT --html-lang pt-BR
 *
 * It copies the English dictionary to `lib/i18n/dictionaries/<code>.ts` and
 * registers it in `lib/i18n/index.ts`. The menu, every editor, the exports,
 * and the tests pick the new language up from the registry. Translate the new
 * file afterwards; `pnpm i18n:report` shows what is still English.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dictionaryFromEnglish, registerLocale, validateLocale } from "./i18n-tools.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [code, label, ...rest] = process.argv.slice(2);
const option = (name) => {
  const index = rest.indexOf(name);
  return index >= 0 ? rest[index + 1] : undefined;
};
const locale = { code, label, short: option("--short"), htmlLang: option("--html-lang") };

try {
  validateLocale(locale);
  const dictionaryPath = join(root, "lib/i18n/dictionaries", `${code}.ts`);
  const indexPath = join(root, "lib/i18n/index.ts");
  if (existsSync(dictionaryPath)) throw new Error(`lib/i18n/dictionaries/${code}.ts already exists.`);

  const english = readFileSync(join(root, "lib/i18n/dictionaries/en.ts"), "utf8");
  const index = readFileSync(indexPath, "utf8");
  const registered = registerLocale(index, locale);
  writeFileSync(dictionaryPath, dictionaryFromEnglish(english, locale));
  writeFileSync(indexPath, registered);

  console.log(`Added ${label} (${code}).`);
  console.log(`  lib/i18n/dictionaries/${code}.ts  copied from English; translate the values`);
  console.log(`  lib/i18n/index.ts                 import, LOCALES entry, and DICTIONARIES`);
  console.log(`Next: pnpm test && pnpm build, then pnpm i18n:report to see what is left to translate.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error('Usage: pnpm i18n:add <code> "<Name>" [--short XX] [--html-lang xx-YY]');
  process.exitCode = 1;
}
