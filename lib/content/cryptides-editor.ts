/**
 * The Cryptides editor's model. `lib/data/cryptides.json` holds what is the
 * same in every language (ids, rarity, Tower, talent material, feed growth,
 * picture files, the talent numbers); `guideEntries.cryptides.cryptideTexts`
 * holds the words, English included. The editor keeps both together, per
 * Cryptide, and gives back the JSON, the new pictures, the files to delete, and
 * one `cryptideTexts` block per dictionary that changed.
 *
 * `tests/cryptides-editor.test.mjs` checks that an untouched draft gives back
 * the JSON byte for byte and every language's texts unchanged.
 */

import {
  CRYPTIDES_DATA,
  CRYPTID_TOWERS,
  TALENT_MATERIALS,
  type CryptidesData,
  type CryptideText,
  type CryptideTexts,
  type CryptidTower,
  type TalentMaterial,
} from "./cryptides.ts";
import { DEFAULT_LOCALE, LOCALE_CODES, getDictionary, mapLocales, type Locale } from "../i18n/index.ts";
import { blankTranslations, dictionaryLiteral, textIn, type Translations } from "../i18n/translations.ts";

/** A picture already on the site (`file`), or one uploaded in this draft (`data`). */
export type EditorImage = { file?: string; data?: string };

export type EditorSkill = { uid: string; id: string; image: EditorImage | null; name: Translations; body: Translations };
export type EditorFood = { uid: string; id: string; growth: string; image: EditorImage | null; name: Translations };
export type EditorCryptide = {
  uid: string;
  /** Empty for a Cryptide added in this draft; the export makes one from the English name. */
  id: string;
  name: Translations;
  rarity: string;
  tower: CryptidTower;
  talentMaterial: TalentMaterial;
  image: EditorImage | null;
  skills: EditorSkill[];
  foods: EditorFood[];
};
export type EditorTalent = { unlockCost: string; dropAmount: string; dropEveryLevels: string };
export type CryptidesEditorState = { version: 1; nextUid: number; talent: EditorTalent; cryptides: EditorCryptide[] };

export const CRYPTIDE_RARITIES = ["SSR", "SR", "R"] as const;
export const CRYPTIDE_PORTRAIT_MAX_EDGE = 480;
export const CRYPTIDE_ICON_MAX_EDGE = 160;

/** Every language's `cryptideTexts` as the dictionaries have them now. */
export function catalogsFromDictionaries(): Record<Locale, CryptideTexts> {
  return mapLocales((locale) => getDictionary(locale).guideEntries.cryptides.cryptideTexts as CryptideTexts);
}

export function fromCryptidesData(data: CryptidesData, catalogs: Partial<Record<Locale, CryptideTexts>>): CryptidesEditorState {
  let next = 0;
  const uid = (prefix: string) => `${prefix}${++next}`;
  const words = (read: (text: CryptideText | undefined) => string | undefined, cryptideId: string, english?: string) =>
    mapLocales((locale) => read(catalogs[locale]?.[cryptideId]) ?? (locale === DEFAULT_LOCALE ? english ?? "" : ""));
  const cryptides = data.cryptides.map((row): EditorCryptide => ({
    uid: uid("c"),
    id: row.id,
    name: words((text) => text?.name, row.id, row.name),
    rarity: row.rarity,
    tower: row.tower,
    talentMaterial: row.talentMaterial,
    image: row.image ? { file: row.image } : null,
    skills: row.skills.map((skill) => ({
      uid: uid("s"),
      id: skill.id,
      image: skill.image ? { file: skill.image } : null,
      name: words((text) => text?.skills?.[skill.id]?.name, row.id),
      body: words((text) => text?.skills?.[skill.id]?.body, row.id),
    })),
    foods: row.foods.map((food) => ({
      uid: uid("f"),
      id: food.id,
      growth: String(food.growth),
      image: food.image ? { file: food.image } : null,
      name: words((text) => text?.foods?.[food.id]?.name, row.id),
    })),
  }));
  return {
    version: 1,
    nextUid: next,
    talent: {
      unlockCost: String(data.talent.unlockCost),
      dropAmount: String(data.talent.dropAmount),
      dropEveryLevels: String(data.talent.dropEveryLevels),
    },
    cryptides,
  };
}

export const PUBLISHED_CRYPTIDES = fromCryptidesData(CRYPTIDES_DATA, catalogsFromDictionaries());

// ------------------------------------------------------------------ edits

function mapCryptide(state: CryptidesEditorState, uid: string, change: (cryptide: EditorCryptide) => EditorCryptide): CryptidesEditorState {
  return { ...state, cryptides: state.cryptides.map((cryptide) => (cryptide.uid === uid ? change(cryptide) : cryptide)) };
}

function move<T>(list: readonly T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset;
  if (index < 0 || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function cryptideByUid(state: CryptidesEditorState, uid: string): EditorCryptide | undefined {
  return state.cryptides.find((cryptide) => cryptide.uid === uid);
}

export function addCryptide(state: CryptidesEditorState): { state: CryptidesEditorState; uid: string } {
  const uid = `c${state.nextUid + 1}`;
  const blank = (prefix: string, index: number) => `${prefix}${state.nextUid + 2 + index}`;
  const cryptide: EditorCryptide = {
    uid,
    id: "",
    name: blankTranslations(),
    rarity: "SSR",
    tower: CRYPTID_TOWERS[0],
    talentMaterial: TALENT_MATERIALS[0],
    image: null,
    // Every Cryptide in the game has three skills and three foods, so a new one starts with the slots.
    skills: [0, 1, 2].map((index) => ({ uid: blank("s", index), id: "", image: null, name: blankTranslations(), body: blankTranslations() })),
    foods: [0, 1, 2].map((index) => ({ uid: blank("f", index + 3), id: "", growth: String([10, 30, 100][index]), image: null, name: blankTranslations() })),
  };
  return { state: { ...state, nextUid: state.nextUid + 7, cryptides: [...state.cryptides, cryptide] }, uid };
}

export function removeCryptide(state: CryptidesEditorState, uid: string): CryptidesEditorState {
  return { ...state, cryptides: state.cryptides.filter((cryptide) => cryptide.uid !== uid) };
}

export function moveCryptide(state: CryptidesEditorState, uid: string, offset: -1 | 1): CryptidesEditorState {
  const index = state.cryptides.findIndex((cryptide) => cryptide.uid === uid);
  return { ...state, cryptides: move(state.cryptides, index, offset) };
}

export function setCryptideName(state: CryptidesEditorState, uid: string, locale: Locale, value: string): CryptidesEditorState {
  return mapCryptide(state, uid, (cryptide) => ({ ...cryptide, name: { ...cryptide.name, [locale]: value } }));
}

export function setCryptideField(
  state: CryptidesEditorState,
  uid: string,
  field: "rarity" | "tower" | "talentMaterial",
  value: string,
): CryptidesEditorState {
  return mapCryptide(state, uid, (cryptide) => ({ ...cryptide, [field]: value }));
}

export function setPortrait(state: CryptidesEditorState, uid: string, image: EditorImage | null): CryptidesEditorState {
  return mapCryptide(state, uid, (cryptide) => ({ ...cryptide, image }));
}

export function setTalent(state: CryptidesEditorState, field: keyof EditorTalent, value: string): CryptidesEditorState {
  return { ...state, talent: { ...state.talent, [field]: value } };
}

export type RowKind = "skills" | "foods";

export function addRow(state: CryptidesEditorState, uid: string, kind: RowKind): CryptidesEditorState {
  const rowUid = `${kind === "skills" ? "s" : "f"}${state.nextUid + 1}`;
  const next = mapCryptide(state, uid, (cryptide) =>
    kind === "skills"
      ? { ...cryptide, skills: [...cryptide.skills, { uid: rowUid, id: "", image: null, name: blankTranslations(), body: blankTranslations() }] }
      : { ...cryptide, foods: [...cryptide.foods, { uid: rowUid, id: "", growth: "", image: null, name: blankTranslations() }] },
  );
  return { ...next, nextUid: state.nextUid + 1 };
}

export function removeRow(state: CryptidesEditorState, uid: string, kind: RowKind, rowUid: string): CryptidesEditorState {
  return mapCryptide(state, uid, (cryptide) =>
    kind === "skills"
      ? { ...cryptide, skills: cryptide.skills.filter((row) => row.uid !== rowUid) }
      : { ...cryptide, foods: cryptide.foods.filter((row) => row.uid !== rowUid) },
  );
}

export function moveRow(state: CryptidesEditorState, uid: string, kind: RowKind, rowUid: string, offset: -1 | 1): CryptidesEditorState {
  return mapCryptide(state, uid, (cryptide) =>
    kind === "skills"
      ? { ...cryptide, skills: move(cryptide.skills, cryptide.skills.findIndex((row) => row.uid === rowUid), offset) }
      : { ...cryptide, foods: move(cryptide.foods, cryptide.foods.findIndex((row) => row.uid === rowUid), offset) },
  );
}

export function setSkillText(
  state: CryptidesEditorState,
  uid: string,
  rowUid: string,
  field: "name" | "body",
  locale: Locale,
  value: string,
): CryptidesEditorState {
  return mapCryptide(state, uid, (cryptide) => ({
    ...cryptide,
    skills: cryptide.skills.map((row) => (row.uid === rowUid ? { ...row, [field]: { ...row[field], [locale]: value } } : row)),
  }));
}

export function setFoodName(state: CryptidesEditorState, uid: string, rowUid: string, locale: Locale, value: string): CryptidesEditorState {
  return mapCryptide(state, uid, (cryptide) => ({
    ...cryptide,
    foods: cryptide.foods.map((row) => (row.uid === rowUid ? { ...row, name: { ...row.name, [locale]: value } } : row)),
  }));
}

export function setFoodGrowth(state: CryptidesEditorState, uid: string, rowUid: string, value: string): CryptidesEditorState {
  return mapCryptide(state, uid, (cryptide) => ({
    ...cryptide,
    foods: cryptide.foods.map((row) => (row.uid === rowUid ? { ...row, growth: value } : row)),
  }));
}

export function setRowImage(state: CryptidesEditorState, uid: string, kind: RowKind, rowUid: string, image: EditorImage | null): CryptidesEditorState {
  return mapCryptide(state, uid, (cryptide) =>
    kind === "skills"
      ? { ...cryptide, skills: cryptide.skills.map((row) => (row.uid === rowUid ? { ...row, image } : row)) }
      : { ...cryptide, foods: cryptide.foods.map((row) => (row.uid === rowUid ? { ...row, image } : row)) },
  );
}

// ------------------------------------------------------------------ export

export function slugFrom(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function uniqueSlug(base: string, taken: Set<string>, fallback: string): string {
  const root = base || fallback;
  let id = root;
  for (let n = 2; taken.has(id); n += 1) id = `${root}-${n}`;
  taken.add(id);
  return id;
}

/** The id every Cryptide, skill and food will have: kept when it has one, made from the English name when new. */
export function exportIds(state: CryptidesEditorState): Map<string, string> {
  const out = new Map<string, string>();
  const cryptideIds = new Set(state.cryptides.map((cryptide) => cryptide.id).filter(Boolean));
  for (const cryptide of state.cryptides) {
    const id = cryptide.id || uniqueSlug(slugFrom(cryptide.name[DEFAULT_LOCALE]), cryptideIds, "cryptide");
    out.set(cryptide.uid, id);
    for (const kind of ["skills", "foods"] as const) {
      const rows = cryptide[kind];
      const taken = new Set(rows.map((row) => row.id).filter(Boolean));
      rows.forEach((row, index) => {
        out.set(row.uid, row.id || uniqueSlug(slugFrom(row.name[DEFAULT_LOCALE]), taken, `${kind === "skills" ? "skill" : "food"}-${index + 1}`));
      });
    }
  }
  return out;
}

function whole(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

export type CryptideUpload = { file: string; data: string; label: string };
export type CryptidesExport = { data: CryptidesData; uploads: CryptideUpload[]; removedFiles: string[] };

/**
 * The JSON, the pictures to add, and the files nothing uses any more. A new
 * picture is named after the Cryptide and its place: `<id>.webp`,
 * `skills/<id>-<n>.webp`, `foods/<id>-<n>.webp`.
 */
export function exportCryptides(state: CryptidesEditorState, published: CryptidesData): CryptidesExport {
  const ids = exportIds(state);
  const uploads: CryptideUpload[] = [];
  const picture = (image: EditorImage | null, file: string, label: string): string => {
    if (!image) return "";
    if (image.data) {
      uploads.push({ file, data: image.data, label });
      return file;
    }
    return image.file ?? "";
  };
  const talentNumber = (value: string, fallback: number) => whole(value) ?? fallback;
  const data: CryptidesData = {
    talent: {
      unlockCost: talentNumber(state.talent.unlockCost, published.talent.unlockCost),
      dropAmount: talentNumber(state.talent.dropAmount, published.talent.dropAmount),
      dropEveryLevels: talentNumber(state.talent.dropEveryLevels, published.talent.dropEveryLevels),
    },
    cryptides: state.cryptides.map((cryptide) => {
      const id = ids.get(cryptide.uid) ?? "";
      const name = textIn(cryptide.name, DEFAULT_LOCALE);
      return {
        id,
        name,
        rarity: cryptide.rarity,
        tower: cryptide.tower,
        talentMaterial: cryptide.talentMaterial,
        image: picture(cryptide.image, `${id}.webp`, name),
        skills: cryptide.skills.map((skill, index) => ({
          id: ids.get(skill.uid) ?? "",
          image: picture(skill.image, `skills/${id}-${index + 1}.webp`, `${name} · ${textIn(skill.name, DEFAULT_LOCALE)}`),
        })),
        foods: cryptide.foods.map((food, index) => ({
          id: ids.get(food.uid) ?? "",
          growth: whole(food.growth) ?? 0,
          image: picture(food.image, `foods/${id}-${index + 1}.webp`, `${name} · ${textIn(food.name, DEFAULT_LOCALE)}`),
        })),
      };
    }),
  };
  const used = new Set(data.cryptides.flatMap((row) => [row.image, ...row.skills.map((s) => s.image), ...row.foods.map((f) => f.image)]));
  const before = published.cryptides.flatMap((row) => [row.image, ...row.skills.map((s) => s.image), ...row.foods.map((f) => f.image)]);
  const uploaded = new Set(uploads.map((upload) => upload.file));
  // A file that an upload replaces under the same name is overwritten, not deleted.
  const removedFiles = [...new Set(before.filter((file) => file && !used.has(file) && !uploaded.has(file)))];
  return { data, uploads, removedFiles };
}

/** `lib/data/cryptides.json` as it is written: one line per skill and per food. */
export function serializeCryptidesData(data: CryptidesData): string {
  const json = (value: unknown) => JSON.stringify(value);
  const lines = ["{", `  "talent": {`];
  lines.push(`    "unlockCost": ${data.talent.unlockCost},`);
  lines.push(`    "dropAmount": ${data.talent.dropAmount},`);
  lines.push(`    "dropEveryLevels": ${data.talent.dropEveryLevels}`);
  lines.push("  },", `  "cryptides": [`);
  data.cryptides.forEach((row, index) => {
    const skills = row.skills.map((skill, at) =>
      `        { "id": ${json(skill.id)}, "image": ${json(skill.image)} }${at < row.skills.length - 1 ? "," : ""}`);
    const foods = row.foods.map((food, at) =>
      `        { "id": ${json(food.id)}, "growth": ${food.growth}, "image": ${json(food.image)} }${at < row.foods.length - 1 ? "," : ""}`);
    lines.push(
      "    {",
      `      "id": ${json(row.id)},`,
      `      "name": ${json(row.name)},`,
      `      "rarity": ${json(row.rarity)},`,
      `      "tower": ${json(row.tower)},`,
      `      "talentMaterial": ${json(row.talentMaterial)},`,
      `      "image": ${json(row.image)},`,
      `      "skills": [`,
      ...skills,
      "      ],",
      `      "foods": [`,
      ...foods,
      "      ]",
      `    }${index < data.cryptides.length - 1 ? "," : ""}`,
    );
  });
  lines.push("  ]", "}", "");
  return lines.join("\n");
}

/**
 * Every language's `cryptideTexts`. A text still empty in a language takes the
 * English one, which is also what that language's readers see.
 */
export function exportedCryptideTexts(state: CryptidesEditorState): Record<Locale, CryptideTexts> {
  const ids = exportIds(state);
  return mapLocales((locale) => {
    const out: CryptideTexts = {};
    for (const cryptide of state.cryptides) {
      const id = ids.get(cryptide.uid) ?? "";
      out[id] = {
        name: textIn(cryptide.name, locale),
        skills: Object.fromEntries(
          cryptide.skills.map((skill) => [ids.get(skill.uid) ?? "", { name: textIn(skill.name, locale), body: textIn(skill.body, locale) }]),
        ),
        foods: Object.fromEntries(cryptide.foods.map((food) => [ids.get(food.uid) ?? "", { name: textIn(food.name, locale) }])),
      };
    }
    return out;
  });
}

/** The `cryptideTexts` block to put inside `guideEntries.cryptides` of each dictionary. */
export function cryptideTextBlocks(state: CryptidesEditorState): Record<Locale, string> {
  const texts = exportedCryptideTexts(state);
  return mapLocales((locale) => `      cryptideTexts: ${dictionaryLiteral(texts[locale], "      ")},`);
}

/** Languages whose `cryptideTexts` the draft changes. */
export function changedTextLocales(state: CryptidesEditorState): Locale[] {
  const now = exportedCryptideTexts(state);
  const published = catalogsFromDictionaries();
  return LOCALE_CODES.filter((locale) => JSON.stringify(now[locale]) !== JSON.stringify(published[locale]));
}

/** How many Cryptides, plus the talent numbers, differ from what is published. */
export function countCryptideChanges(published: CryptidesEditorState, draft: CryptidesEditorState): number {
  const key = (cryptide: EditorCryptide) => JSON.stringify({ ...cryptide, uid: "", skills: cryptide.skills.map((row) => ({ ...row, uid: "" })), foods: cryptide.foods.map((row) => ({ ...row, uid: "" })) });
  const before = new Map(published.cryptides.map((cryptide) => [cryptide.id, key(cryptide)]));
  let changes = draft.cryptides.filter((cryptide) => !cryptide.id || before.get(cryptide.id) !== key(cryptide)).length;
  changes += published.cryptides.filter((cryptide) => !draft.cryptides.some((row) => row.id === cryptide.id)).length;
  if (JSON.stringify(published.talent) !== JSON.stringify(draft.talent)) changes += 1;
  const order = (state: CryptidesEditorState) => state.cryptides.map((cryptide) => cryptide.id).join(",");
  if (changes === 0 && order(published) !== order(draft)) changes = 1;
  return changes;
}

export type CryptideProblem =
  | { code: "emptyName"; index: number }
  | { code: "duplicateName"; name: string }
  | { code: "missingPortrait"; cryptide: string }
  | { code: "missingIcon"; cryptide: string; row: string }
  | { code: "emptySkill"; cryptide: string; position: number }
  | { code: "emptyFood"; cryptide: string; position: number }
  | { code: "badGrowth"; cryptide: string; row: string }
  | { code: "badTalent"; field: keyof EditorTalent };

/** What the export warns about; none of it stops the export. */
export function findCryptideProblems(state: CryptidesEditorState): CryptideProblem[] {
  const problems: CryptideProblem[] = [];
  const seen = new Map<string, number>();
  state.cryptides.forEach((cryptide, index) => {
    const name = cryptide.name[DEFAULT_LOCALE].trim();
    if (!name) problems.push({ code: "emptyName", index: index + 1 });
    else seen.set(name.toLowerCase(), (seen.get(name.toLowerCase()) ?? 0) + 1);
    const label = name || `#${index + 1}`;
    if (!cryptide.image) problems.push({ code: "missingPortrait", cryptide: label });
    cryptide.skills.forEach((skill, at) => {
      const rowName = skill.name[DEFAULT_LOCALE].trim();
      if (!rowName) problems.push({ code: "emptySkill", cryptide: label, position: at + 1 });
      if (!skill.image) problems.push({ code: "missingIcon", cryptide: label, row: rowName || `#${at + 1}` });
    });
    cryptide.foods.forEach((food, at) => {
      const rowName = food.name[DEFAULT_LOCALE].trim();
      if (!rowName) problems.push({ code: "emptyFood", cryptide: label, position: at + 1 });
      if (!food.image) problems.push({ code: "missingIcon", cryptide: label, row: rowName || `#${at + 1}` });
      if (whole(food.growth) === null) problems.push({ code: "badGrowth", cryptide: label, row: rowName || `#${at + 1}` });
    });
  });
  for (const cryptide of state.cryptides) {
    const name = cryptide.name[DEFAULT_LOCALE].trim();
    if (name && (seen.get(name.toLowerCase()) ?? 0) > 1 && !problems.some((p) => p.code === "duplicateName" && p.name === name)) {
      problems.push({ code: "duplicateName", name });
    }
  }
  for (const field of ["unlockCost", "dropAmount", "dropEveryLevels"] as const) {
    if (whole(state.talent[field]) === null) problems.push({ code: "badTalent", field });
  }
  return problems;
}

/** Reads a stored draft back; a draft from an older shape is dropped rather than half-loaded. */
export function parseCryptidesDraft(raw: string | null): CryptidesEditorState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CryptidesEditorState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.cryptides) || typeof parsed.talent !== "object") return null;
    const words = (value: unknown): Translations =>
      mapLocales((locale) => {
        const record = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
        return typeof record[locale] === "string" ? (record[locale] as string) : "";
      });
    const image = (value: unknown): EditorImage | null => {
      const record = (typeof value === "object" && value !== null ? value : null) as Record<string, unknown> | null;
      if (!record) return null;
      if (typeof record.data === "string" && record.data.startsWith("data:image/")) return { data: record.data };
      if (typeof record.file === "string") return { file: record.file };
      return null;
    };
    const text = (value: unknown) => (typeof value === "string" ? value : "");
    const cryptides = parsed.cryptides.map((row): EditorCryptide => ({
      uid: text(row?.uid),
      id: text(row?.id),
      name: words(row?.name),
      rarity: text(row?.rarity) || "SSR",
      tower: (CRYPTID_TOWERS as readonly string[]).includes(row?.tower as string) ? (row.tower as CryptidTower) : CRYPTID_TOWERS[0],
      talentMaterial: (TALENT_MATERIALS as readonly string[]).includes(row?.talentMaterial as string) ? (row.talentMaterial as TalentMaterial) : TALENT_MATERIALS[0],
      image: image(row?.image),
      skills: (Array.isArray(row?.skills) ? row.skills : []).map((skill) => ({
        uid: text(skill?.uid), id: text(skill?.id), image: image(skill?.image), name: words(skill?.name), body: words(skill?.body),
      })),
      foods: (Array.isArray(row?.foods) ? row.foods : []).map((food) => ({
        uid: text(food?.uid), id: text(food?.id), growth: text(food?.growth), image: image(food?.image), name: words(food?.name),
      })),
    }));
    const talent = parsed.talent as Partial<EditorTalent>;
    return {
      version: 1,
      nextUid: typeof parsed.nextUid === "number" ? parsed.nextUid : 1000,
      talent: { unlockCost: text(talent.unlockCost), dropAmount: text(talent.dropAmount), dropEveryLevels: text(talent.dropEveryLevels) },
      cryptides,
    };
  } catch {
    return null;
  }
}
