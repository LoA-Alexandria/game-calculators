import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_CODES,
  dictionaryFile,
  dictionaryFiles,
  getDictionary,
  mapLocales,
  toLocale,
} from "../lib/i18n/index.ts";
import {
  blankTranslations,
  dictionaryLiteral,
  missingLocales,
  parseTranslations,
  textIn,
} from "../lib/i18n/translations.ts";
import { dictionaryFromEnglish, identifierFor, registerLocale, validateLocale } from "../scripts/i18n-tools.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** Catalog maps hold translations by id and are sparse on purpose. */
const SPARSE = new Set(["heroTexts", "playTexts", "catalogTexts", "anecdoteTexts", "skinTexts", "eventTexts", "buildingTexts", "linkTexts", "heroNotes"]);

function shapeDifferences(reference, other, path = "") {
  if (Array.isArray(reference)) {
    if (!Array.isArray(other)) return [`${path} is not a list`];
    return reference.flatMap((item, index) => (index < other.length ? shapeDifferences(item, other[index], `${path}[${index}]`) : []));
  }
  if (typeof reference === "object" && reference !== null) {
    if (typeof other !== "object" || other === null) return [`${path} is not an object`];
    const differences = [];
    for (const key of Object.keys(reference)) {
      if (!(key in other)) differences.push(`${path}.${key} is missing`);
      else if (!SPARSE.has(key)) differences.push(...shapeDifferences(reference[key], other[key], `${path}.${key}`));
    }
    for (const key of Object.keys(other)) if (!(key in reference)) differences.push(`${path}.${key} is extra`);
    return differences;
  }
  return typeof reference === typeof other ? [] : [`${path} should be a ${typeof reference}`];
}

test("every registered language has a dictionary with English's keys", () => {
  assert.equal(LOCALE_CODES[0], DEFAULT_LOCALE, "English comes first");
  assert.deepEqual([...LOCALE_CODES], LOCALES.map((entry) => entry.code));
  const files = readdirSync(new URL("../lib/i18n/dictionaries/", import.meta.url)).map((name) => name.replace(/\.ts$/, ""));
  assert.deepEqual([...files].sort(), [...LOCALE_CODES].sort(), "one dictionary file per registered language");
  const english = getDictionary(DEFAULT_LOCALE);
  for (const locale of LOCALE_CODES) {
    assert.deepEqual(shapeDifferences(english, getDictionary(locale)), [], `${locale} matches English`);
    assert.equal(dictionaryFile(locale), `lib/i18n/dictionaries/${locale}.ts`);
  }
  assert.equal(dictionaryFiles(), LOCALE_CODES.map(dictionaryFile).join(", "));
  assert.equal(toLocale("de"), "de");
  assert.equal(toLocale("xx"), DEFAULT_LOCALE);
  assert.deepEqual(Object.keys(mapLocales((locale) => locale)), [...LOCALE_CODES]);
});

test("no code outside the registry lists the languages by hand", () => {
  const offenders = [];
  const patterns = [
    /\[\s*"en"\s*,\s*"de"\s*,\s*"fr"\s*\]/,
    /\ben:\s*"",\s*de:\s*"",\s*fr:\s*""/,
    /\b(?:langEn|langDe|langFr|newTextEn|newTextDe|newTextFr)\b/,
    /en\.ts, de\.ts,? and fr\.ts/,
    /getDictionary\("(?:de|fr)"\)/,
  ];
  const walk = (dir) => {
    for (const name of readdirSync(new URL(dir, import.meta.url))) {
      const path = `${dir}${name}`;
      if (statSync(new URL(path, import.meta.url)).isDirectory()) {
        if (name !== "dictionaries") walk(`${path}/`);
      } else if (/\.(ts|tsx)$/.test(name) && !path.endsWith("i18n/index.ts")) {
        const source = readFileSync(new URL(path, import.meta.url), "utf8");
        for (const pattern of patterns) if (pattern.test(source)) offenders.push(`${path.slice(3)} ${pattern}`);
      }
    }
  };
  walk("../app/");
  walk("../lib/");
  assert.deepEqual(offenders, []);
});

test("translations fall back to English and survive a new language", () => {
  const blank = blankTranslations();
  assert.deepEqual(Object.keys(blank), [...LOCALE_CODES]);
  const text = { ...blank, en: "Shield wall", de: "Schildwall" };
  assert.equal(textIn(text, "de"), "Schildwall");
  assert.equal(textIn(text, "fr"), "Shield wall");
  assert.deepEqual(missingLocales(text), LOCALE_CODES.filter((locale) => locale !== "en" && locale !== "de"));
  // A draft saved when only English existed still loads, with the other languages empty.
  assert.deepEqual(parseTranslations({ en: "Old" }), { ...blank, en: "Old" });
  assert.equal(parseTranslations({ de: "Ohne Englisch" }), null);
  assert.equal(parseTranslations("text"), null);
});

test("dictionary literals read back as the same value", () => {
  const value = {
    merlin: { obtain: "Tap Football", skill: { name: "Ice Dragon's Breath", levels: ["", "Text \"quoted\""] } },
    "count-of-monte-cristo": { name: "Graf" },
    empty: {},
  };
  const literal = dictionaryLiteral(value, "      ");
  assert.match(literal, /\n        merlin: \{/);
  assert.match(literal, /\n        "count-of-monte-cristo": \{/);
  assert.deepEqual(new Function(`return ${literal};`)(), value);
  assert.equal(dictionaryLiteral({}), "{}");
});

test("adding a language writes a typed dictionary and registers it", () => {
  assert.equal(identifierFor("pt-BR"), "ptBR");
  assert.throws(() => validateLocale({ code: "Spanish", label: "Español" }));
  assert.throws(() => validateLocale({ code: "es", label: " " }));
  assert.doesNotThrow(() => validateLocale({ code: "es", label: "Español" }));

  const dictionary = dictionaryFromEnglish(read("lib/i18n/dictionaries/en.ts"), { code: "es", label: "Español" });
  assert.match(dictionary, /^import type \{ Dictionary \} from "\.\/en\.ts";/);
  assert.match(dictionary, /\nconst es: Dictionary = \{\n  shell: \{/);
  assert.match(dictionary, /\n\};\n\nexport default es;\n$/);
  assert.equal(dictionary.includes("typeof en"), false);

  const index = read("lib/i18n/index.ts");
  const registered = registerLocale(index, { code: "xx", label: "Test" });
  const lastImport = [...index.matchAll(/^import \w+ from "\.\/dictionaries\/[\w-]+\.ts";$/gm)].at(-1)[0];
  assert.ok(registered.includes(`${lastImport}\nimport xx from "./dictionaries/xx.ts";`), "the import follows the last dictionary import");
  assert.match(registered, /  \{ code: "xx", label: "Test", short: "XX", htmlLang: "xx" \},\n\] as const;/);
  assert.match(registered, /const DICTIONARIES: Record<Locale, Dictionary> = \{\n(?:  \w+,\n)+  xx,\n\};/);
  assert.throws(() => registerLocale(registered, { code: "xx", label: "Test" }), /already registered/);

  const regional = registerLocale(index, { code: "pt-BR", label: "Português (Brasil)", short: "PT" });
  assert.match(regional, /import ptBR from "\.\/dictionaries\/pt-BR\.ts";/);
  assert.match(regional, /  "pt-BR": ptBR,\n\};/);
});
