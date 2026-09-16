/**
 * Pure state logic for the goddess upgrade order editor. The page only renders
 * this state and calls these functions, so phases, rows, and translations can
 * be tested without a browser.
 *
 * The editor works on a copy of `lib/data/goddess-leveling.json` and exports
 * that file plus a `phaseTexts` block per dictionary, like the other guide
 * editors. Levels are the same in every language; a phase's subtitle and lede
 * are English in the JSON and translated per language.
 */

import { GODDESS_LEVELING_DATA, type GoddessLevelingData, type LevelingPhase, type LevelingRow, type PhaseTexts } from "./goddess-leveling.ts";
import { GODDESSES } from "./goddesses.ts";
import { DEFAULT_LOCALE, LOCALES, getDictionary, type Locale } from "../i18n/index.ts";

export type EditorLevelingRow = {
  uid: string;
  /** Roster id, or null for everyone the phases do not name. */
  goddess: string | null;
  target: string;
  withoutSsr: string;
};

export type EditorPhase = {
  uid: string;
  /** Empty for a phase added in the editor until export derives it from the subtitle. */
  id: string;
  subtitle: string;
  lede: string;
  rows: EditorLevelingRow[];
};

export type PhaseTextDraft = { subtitle: string; lede: string };
export type PhaseTextField = keyof PhaseTextDraft;

export type GoddessLevelingEditorState = {
  version: 1;
  phases: EditorPhase[];
  /** Translations keyed by locale and then by phase uid; English is on the phase itself. */
  texts: Record<Locale, Record<string, PhaseTextDraft>>;
  nextId: number;
};

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const property = (key: string) => (IDENTIFIER.test(key) ? key : JSON.stringify(key));
const json = (value: unknown) => JSON.stringify(value);
const GODDESS_IDS = new Set(GODDESSES.map((goddess) => goddess.id));

function emptyTexts(): GoddessLevelingEditorState["texts"] {
  return Object.fromEntries(LOCALES.map((locale) => [locale.code, {}])) as GoddessLevelingEditorState["texts"];
}

const emptyText = (): PhaseTextDraft => ({ subtitle: "", lede: "" });

export function catalogsFromDictionaries(): Record<Locale, PhaseTexts> {
  const catalogs = {} as Record<Locale, PhaseTexts>;
  for (const { code } of LOCALES) catalogs[code] = getDictionary(code).guideEntries.goddessLeveling.phaseTexts;
  return catalogs;
}

export function fromLevelingData(data: GoddessLevelingData, catalogs: Partial<Record<Locale, PhaseTexts>> = {}): GoddessLevelingEditorState {
  let nextId = 1;
  const texts = emptyTexts();
  const phases = data.phases.map((phase): EditorPhase => {
    const uid = `p${nextId++}`;
    for (const { code } of LOCALES) {
      if (code === DEFAULT_LOCALE) continue;
      const local = catalogs[code]?.[phase.id];
      if (local) texts[code][uid] = { subtitle: local.subtitle ?? "", lede: local.lede ?? "" };
    }
    return {
      uid,
      id: phase.id,
      subtitle: phase.subtitle,
      lede: phase.lede,
      rows: phase.rows.map((row) => ({
        uid: `r${nextId++}`,
        goddess: row.goddess,
        target: row.target,
        withoutSsr: row.withoutSsr ?? "",
      })),
    };
  });
  return { version: 1, phases, texts, nextId };
}

export function phaseByUid(state: GoddessLevelingEditorState, uid: string): EditorPhase | undefined {
  return state.phases.find((phase) => phase.uid === uid);
}

export function phaseTextOf(state: GoddessLevelingEditorState, locale: Locale, uid: string): PhaseTextDraft {
  const phase = phaseByUid(state, uid);
  if (!phase) return emptyText();
  if (locale === DEFAULT_LOCALE) return { subtitle: phase.subtitle, lede: phase.lede };
  return state.texts[locale]?.[uid] ?? emptyText();
}

function mapPhase(state: GoddessLevelingEditorState, uid: string, change: (phase: EditorPhase) => EditorPhase): GoddessLevelingEditorState {
  return { ...state, phases: state.phases.map((phase) => (phase.uid === uid ? change(phase) : phase)) };
}

export function setPhaseText(
  state: GoddessLevelingEditorState,
  uid: string,
  locale: Locale,
  field: PhaseTextField,
  value: string,
): GoddessLevelingEditorState {
  if (!phaseByUid(state, uid)) return state;
  if (locale === DEFAULT_LOCALE) return mapPhase(state, uid, (phase) => ({ ...phase, [field]: value }));
  const current = state.texts[locale]?.[uid] ?? emptyText();
  return { ...state, texts: { ...state.texts, [locale]: { ...state.texts[locale], [uid]: { ...current, [field]: value } } } };
}

export function addPhase(state: GoddessLevelingEditorState): { state: GoddessLevelingEditorState; uid: string } {
  const uid = `p${state.nextId}`;
  const phase: EditorPhase = { uid, id: "", subtitle: "", lede: "", rows: [] };
  return { state: { ...state, phases: [...state.phases, phase], nextId: state.nextId + 1 }, uid };
}

export function removePhase(state: GoddessLevelingEditorState, uid: string): GoddessLevelingEditorState {
  const texts = emptyTexts();
  for (const { code } of LOCALES) {
    const catalog = { ...state.texts[code] };
    delete catalog[uid];
    texts[code] = catalog;
  }
  return { ...state, phases: state.phases.filter((phase) => phase.uid !== uid), texts };
}

function swap<T>(list: readonly T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset;
  if (index < 0 || target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function movePhase(state: GoddessLevelingEditorState, uid: string, offset: -1 | 1): GoddessLevelingEditorState {
  const index = state.phases.findIndex((phase) => phase.uid === uid);
  return { ...state, phases: swap(state.phases, index, offset) };
}

/** Adds a row for a goddess (or everyone else), starting from the level the row above uses. */
export function addRow(state: GoddessLevelingEditorState, phaseUid: string, goddess: string | null): GoddessLevelingEditorState {
  const phase = phaseByUid(state, phaseUid);
  if (!phase) return state;
  const row: EditorLevelingRow = { uid: `r${state.nextId}`, goddess, target: phase.rows.at(-1)?.target ?? "", withoutSsr: "" };
  const next = mapPhase(state, phaseUid, (entry) => ({ ...entry, rows: [...entry.rows, row] }));
  return { ...next, nextId: state.nextId + 1 };
}

export function removeRow(state: GoddessLevelingEditorState, phaseUid: string, rowUid: string): GoddessLevelingEditorState {
  return mapPhase(state, phaseUid, (phase) => ({ ...phase, rows: phase.rows.filter((row) => row.uid !== rowUid) }));
}

export function moveRow(state: GoddessLevelingEditorState, phaseUid: string, rowUid: string, offset: -1 | 1): GoddessLevelingEditorState {
  return mapPhase(state, phaseUid, (phase) => ({
    ...phase,
    rows: swap(phase.rows, phase.rows.findIndex((row) => row.uid === rowUid), offset),
  }));
}

export function updateRow(
  state: GoddessLevelingEditorState,
  phaseUid: string,
  rowUid: string,
  patch: Partial<Pick<EditorLevelingRow, "goddess" | "target" | "withoutSsr">>,
): GoddessLevelingEditorState {
  return mapPhase(state, phaseUid, (phase) => ({
    ...phase,
    rows: phase.rows.map((row) => (row.uid === rowUid ? { ...row, ...patch } : row)),
  }));
}

/** Goddesses a phase does not have a row for yet, in roster order. */
export function unusedGoddesses(phase: EditorPhase): typeof GODDESSES {
  const used = new Set(phase.rows.map((row) => row.goddess));
  return GODDESSES.filter((goddess) => !used.has(goddess.id));
}

export function hasEveryoneElse(phase: EditorPhase): boolean {
  return phase.rows.some((row) => row.goddess === null);
}

export function phaseIdFrom(subtitle: string, taken: Iterable<string>): string {
  const base =
    subtitle
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "phase";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let counter = 2;
  while (used.has(`${base}-${counter}`)) counter += 1;
  return `${base}-${counter}`;
}

function exportIds(state: GoddessLevelingEditorState): Map<string, string> {
  const taken = new Set(state.phases.map((phase) => phase.id).filter(Boolean));
  const ids = new Map<string, string>();
  for (const phase of state.phases) {
    let id = phase.id;
    if (!id) {
      id = phaseIdFrom(phase.subtitle.trim(), taken);
      taken.add(id);
    }
    ids.set(phase.uid, id);
  }
  return ids;
}

export function exportLeveling(state: GoddessLevelingEditorState): GoddessLevelingData {
  const ids = exportIds(state);
  return {
    phases: state.phases.map((phase): LevelingPhase => ({
      id: ids.get(phase.uid) ?? phase.id,
      subtitle: phase.subtitle.trim(),
      lede: phase.lede.trim(),
      rows: phase.rows.map((row): LevelingRow => {
        const next: LevelingRow = { goddess: row.goddess, target: row.target.trim() };
        if (row.withoutSsr.trim()) next.withoutSsr = row.withoutSsr.trim();
        return next;
      }),
    })),
  };
}

/** One line per row, so a change to a level is a one-line diff. */
export function serializeLevelingData(data: GoddessLevelingData): string {
  const phases = data.phases.map((phase, index) => {
    const rows = phase.rows.map((row, rowIndex) => {
      const parts = [`"goddess": ${json(row.goddess)}`, `"target": ${json(row.target)}`];
      if (row.withoutSsr) parts.push(`"withoutSsr": ${json(row.withoutSsr)}`);
      return `        { ${parts.join(", ")} }${rowIndex < phase.rows.length - 1 ? "," : ""}`;
    });
    return [
      "    {",
      `      "id": ${json(phase.id)},`,
      `      "subtitle": ${json(phase.subtitle)},`,
      `      "lede": ${json(phase.lede)},`,
      rows.length ? `      "rows": [` : `      "rows": []`,
      ...(rows.length ? [...rows, "      ]"] : []),
      `    }${index < data.phases.length - 1 ? "," : ""}`,
    ].join("\n");
  });
  return ["{", `  "phases": [`, ...phases, "  ]", "}", ""].join("\n");
}

export function exportedPhaseTexts(state: GoddessLevelingEditorState): Record<Locale, PhaseTexts> {
  const ids = exportIds(state);
  const result = {} as Record<Locale, PhaseTexts>;
  for (const { code } of LOCALES) {
    const catalog: PhaseTexts = {};
    if (code !== DEFAULT_LOCALE) {
      for (const phase of state.phases) {
        const draft = state.texts[code]?.[phase.uid];
        if (!draft) continue;
        const subtitle = draft.subtitle.trim();
        const lede = draft.lede.trim();
        if (!subtitle && !lede) continue;
        catalog[ids.get(phase.uid) ?? phase.id] = { ...(subtitle ? { subtitle } : {}), ...(lede ? { lede } : {}) };
      }
    }
    result[code] = catalog;
  }
  return result;
}

/** The `phaseTexts` block to paste into each dictionary. */
export function phaseTextBlocks(state: GoddessLevelingEditorState): Record<Locale, string> {
  const catalogs = exportedPhaseTexts(state);
  const result = {} as Record<Locale, string>;
  for (const { code } of LOCALES) {
    const ids = Object.keys(catalogs[code]);
    if (ids.length === 0) {
      result[code] = "      phaseTexts: {},";
      continue;
    }
    const lines = ["      phaseTexts: {"];
    for (const id of ids) {
      const entry = catalogs[code][id];
      const parts = [
        ...(entry.subtitle ? [`subtitle: ${json(entry.subtitle)}`] : []),
        ...(entry.lede ? [`lede: ${json(entry.lede)}`] : []),
      ];
      lines.push(`        ${property(id)}: { ${parts.join(", ")} },`);
    }
    lines.push("      },");
    result[code] = lines.join("\n");
  }
  return result;
}

/** Changed, added, or removed phases, plus one per language whose translations moved. */
export function countLevelingChanges(published: GoddessLevelingEditorState, draft: GoddessLevelingEditorState): number {
  const before = exportLeveling(published).phases;
  const after = exportLeveling(draft).phases;
  const beforeById = new Map(before.map((phase) => [phase.id, JSON.stringify(phase)]));
  const afterIds = new Set(after.map((phase) => phase.id));
  let changes = 0;
  for (const phase of after) if (beforeById.get(phase.id) !== JSON.stringify(phase)) changes += 1;
  for (const phase of before) if (!afterIds.has(phase.id)) changes += 1;
  if (changes === 0 && before.map((phase) => phase.id).join() !== after.map((phase) => phase.id).join()) changes = 1;
  const textsBefore = exportedPhaseTexts(published);
  const textsAfter = exportedPhaseTexts(draft);
  for (const { code } of LOCALES) {
    if (code === DEFAULT_LOCALE) continue;
    if (JSON.stringify(textsBefore[code]) !== JSON.stringify(textsAfter[code])) changes += 1;
  }
  return changes;
}

export type LevelingProblem =
  | { code: "emptySubtitle"; phase: number }
  | { code: "emptyPhase"; phase: number }
  | { code: "emptyTarget"; phase: number; goddess: string | null }
  | { code: "unknownGoddess"; phase: number; goddess: string }
  | { code: "duplicateRow"; phase: number; goddess: string | null };

export function findLevelingProblems(state: GoddessLevelingEditorState): LevelingProblem[] {
  const problems: LevelingProblem[] = [];
  state.phases.forEach((phase, index) => {
    const number = index + 1;
    if (!phase.subtitle.trim()) problems.push({ code: "emptySubtitle", phase: number });
    if (phase.rows.length === 0) problems.push({ code: "emptyPhase", phase: number });
    const seen = new Set<string | null>();
    for (const row of phase.rows) {
      if (row.goddess !== null && !GODDESS_IDS.has(row.goddess)) problems.push({ code: "unknownGoddess", phase: number, goddess: row.goddess });
      if (!row.target.trim()) problems.push({ code: "emptyTarget", phase: number, goddess: row.goddess });
      if (seen.has(row.goddess)) problems.push({ code: "duplicateRow", phase: number, goddess: row.goddess });
      seen.add(row.goddess);
    }
  });
  return problems;
}

function isRow(value: unknown): value is EditorLevelingRow {
  const row = value as EditorLevelingRow;
  return (
    typeof row?.uid === "string"
    && (row.goddess === null || typeof row.goddess === "string")
    && typeof row.target === "string"
    && typeof row.withoutSsr === "string"
  );
}

export function parseLevelingDraft(raw: string | null): GoddessLevelingEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as GoddessLevelingEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.phases)) return null;
    if (!value.texts || typeof value.texts !== "object") return null;
    const texts = emptyTexts();
    for (const { code } of LOCALES) {
      const catalog = value.texts[code];
      if (!catalog) continue;
      if (typeof catalog !== "object") return null;
      for (const draft of Object.values(catalog)) {
        if (typeof draft?.subtitle !== "string" || typeof draft.lede !== "string") return null;
      }
      texts[code] = catalog;
    }
    for (const phase of value.phases) {
      if (typeof phase?.uid !== "string" || typeof phase.id !== "string") return null;
      if (typeof phase.subtitle !== "string" || typeof phase.lede !== "string" || !Array.isArray(phase.rows)) return null;
      if (!phase.rows.every(isRow)) return null;
    }
    return { ...value, texts };
  } catch {
    return null;
  }
}

export const PUBLISHED_GODDESS_LEVELING = fromLevelingData(GODDESS_LEVELING_DATA, catalogsFromDictionaries());
