/**
 * Pure helpers behind `pnpm i18n:add`, kept separate so the tests can run them
 * on strings without touching the real files.
 */

const CODE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;

/** `pt-BR` → `ptBR`: the variable name the dictionary file exports. */
export function identifierFor(code) {
  return code.replace(/-([A-Za-z0-9])/g, (_, letter) => letter.toUpperCase());
}

export function validateLocale({ code, label, short }) {
  if (!CODE.test(code ?? "")) throw new Error(`"${code}" is not a language code like es, pt, or pt-BR.`);
  if (!label?.trim()) throw new Error("Give the language's own name, for example \"Español\".");
  if (short !== undefined && !/^[A-Z0-9-]{2,5}$/.test(short)) throw new Error(`"${short}" is not a short label like ES.`);
}

/** A new dictionary file: English values, typed as `Dictionary`, ready to translate. */
export function dictionaryFromEnglish(english, { code, label }) {
  const id = identifierFor(code);
  const bodyStart = english.indexOf("const en = {");
  const tail = english.lastIndexOf("export type Dictionary = typeof en;");
  if (bodyStart < 0 || tail < 0) throw new Error("dictionaries/en.ts no longer has the shape this script expects.");
  const body = english
    .slice(bodyStart, tail)
    .replace("const en = {", `const ${id}: Dictionary = {`)
    .replace(/\}\s*;\s*$/, "};\n");
  return [
    `import type { Dictionary } from "./en.ts";`,
    ``,
    `/**`,
    ` * ${label}. Created from the English dictionary: every value below is still`,
    ` * English until someone translates it. Keep the keys; TypeScript reports any`,
    ` * that go missing. \`pnpm i18n:report\` lists what is still identical to English.`,
    ` */`,
    body.trimEnd(),
    ``,
    `export default ${id};`,
    ``,
  ].join("\n");
}

/** The registry in `lib/i18n/index.ts` with one more language: import, entry, and dictionary. */
export function registerLocale(index, { code, label, short, htmlLang }) {
  const id = identifierFor(code);
  if (new RegExp(`code: "${code}"`).test(index)) throw new Error(`"${code}" is already registered.`);

  const imports = [...index.matchAll(/^import \w+ from "\.\/dictionaries\/[\w-]+\.ts";$/gm)];
  const lastImport = imports.at(-1);
  if (!lastImport) throw new Error("No dictionary imports found in lib/i18n/index.ts.");
  const importEnd = lastImport.index + lastImport[0].length;
  let next = `${index.slice(0, importEnd)}\nimport ${id} from "./dictionaries/${code}.ts";${index.slice(importEnd)}`;

  const localesEnd = next.indexOf("] as const;", next.indexOf("export const LOCALES = ["));
  if (localesEnd < 0) throw new Error("LOCALES not found in lib/i18n/index.ts.");
  const entry = `  { code: ${JSON.stringify(code)}, label: ${JSON.stringify(label)}, short: ${JSON.stringify(short ?? code.toUpperCase())}, htmlLang: ${JSON.stringify(htmlLang ?? code)} },\n`;
  next = `${next.slice(0, localesEnd)}${entry}${next.slice(localesEnd)}`;

  const mapStart = next.indexOf("const DICTIONARIES: Record<Locale, Dictionary> = {");
  const mapEnd = next.indexOf("\n};", mapStart);
  if (mapStart < 0 || mapEnd < 0) throw new Error("DICTIONARIES not found in lib/i18n/index.ts.");
  const key = id === code ? id : `${JSON.stringify(code)}: ${id}`;
  next = `${next.slice(0, mapEnd)}\n  ${key},${next.slice(mapEnd)}`;
  return next;
}

/** Every string leaf of a dictionary with its dotted path. */
export function leaves(value, path = "") {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((item, index) => leaves(item, `${path}[${index}]`));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => leaves(item, path ? `${path}.${key}` : key));
  }
  return [];
}
