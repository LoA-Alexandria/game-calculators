/**
 * Pure state logic for the Goddess Theater income editor.
 *
 * What it edits is measurements, not prose: the base ticket price and visitor
 * flow the game shows in a play's preview, how many goddesses a play takes,
 * which aptitudes it asks for, and which aptitudes each goddess has or is
 * known not to have. All of it is read off the screen while playing, so the
 * editor's job is to make typing a row quick and to say plainly which rows are
 * still missing their numbers.
 *
 * The names of the plays come from the theater guide and are not touched here.
 */

import {
  APTITUDES,
  INCOME_DATA,
  PLAY_RARITIES,
  type AptitudeId,
  type GoddessAptitudes,
  type PlayRarity,
  type RawIncomeData,
  type RawIncomePlay,
} from "./theater-income.ts";
import { THEATER_PLAYS } from "../content/goddess-theater.ts";

export const APTITUDE_IDS = APTITUDES.map((aptitude) => aptitude.id);
/** A goddess has three aptitudes; the file may hold fewer while they are found. */
export const APTITUDES_PER_GODDESS = 3;

export type EditorPlay = {
  uid: string;
  id: string;
  rarity: PlayRarity;
  /** Empty while the number has not been read off the game yet. */
  ticket: string;
  visitors: string;
  /** Empty means "as many as every other play", the file's own default. */
  slots: string;
  aptitudes: AptitudeId[];
};

export type EditorGoddess = {
  uid: string;
  name: string;
  aptitudes: AptitudeId[];
  lacks: AptitudeId[];
};

export type IncomeEditorState = {
  version: 1;
  bonusPerMatch: string;
  slots: string;
  plays: EditorPlay[];
  goddesses: EditorGoddess[];
  nextId: number;
};

const number = (value: number | undefined): string => (value === undefined ? "" : String(value));

/** A whole number from a box, or undefined when it is empty or not a number. */
export function readNumber(value: string): number | undefined {
  const text = value.trim();
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

export function fromIncomeData(raw: RawIncomeData): IncomeEditorState {
  let nextId = 1;
  return {
    version: 1,
    bonusPerMatch: String(raw.bonusPerMatch),
    slots: String(raw.slots),
    plays: raw.plays.map((play) => ({
      uid: `p${nextId++}`,
      id: play.id,
      rarity: play.rarity as PlayRarity,
      ticket: number(play.ticket),
      visitors: number(play.visitors),
      slots: play.slots === undefined || play.slots === raw.slots ? "" : String(play.slots),
      aptitudes: [...((play.aptitudes ?? []) as AptitudeId[])],
    })),
    goddesses: raw.goddesses.map((goddess) => ({
      uid: `g${nextId++}`,
      name: goddess.name,
      aptitudes: [...(goddess.aptitudes as AptitudeId[])],
      lacks: [...((goddess.lacks ?? []) as AptitudeId[])],
    })),
    nextId,
  };
}

export function setPlay(
  state: IncomeEditorState,
  uid: string,
  patch: Partial<Pick<EditorPlay, "ticket" | "visitors" | "slots" | "rarity">>,
): IncomeEditorState {
  return { ...state, plays: state.plays.map((play) => (play.uid === uid ? { ...play, ...patch } : play)) };
}

/** Turns one aptitude of a play on or off, keeping the file's order. */
export function togglePlayAptitude(state: IncomeEditorState, uid: string, aptitude: AptitudeId): IncomeEditorState {
  return {
    ...state,
    plays: state.plays.map((play) =>
      play.uid === uid ? { ...play, aptitudes: toggled(play.aptitudes, aptitude) } : play,
    ),
  };
}

/**
 * A goddess's aptitudes and the ones she is known not to have. The two lists
 * are exclusive: marking an aptitude on one side takes it off the other, so a
 * contradiction cannot be typed in the first place.
 */
export function toggleGoddessAptitude(
  state: IncomeEditorState,
  uid: string,
  aptitude: AptitudeId,
  list: "aptitudes" | "lacks",
): IncomeEditorState {
  return {
    ...state,
    goddesses: state.goddesses.map((goddess) => {
      if (goddess.uid !== uid) return goddess;
      const other = list === "aptitudes" ? "lacks" : "aptitudes";
      return {
        ...goddess,
        [list]: toggled(goddess[list], aptitude),
        [other]: goddess[other].filter((entry) => entry !== aptitude),
      };
    }),
  };
}

function toggled(list: readonly AptitudeId[], aptitude: AptitudeId): AptitudeId[] {
  return list.includes(aptitude)
    ? list.filter((entry) => entry !== aptitude)
    : APTITUDE_IDS.filter((id) => id === aptitude || list.includes(id));
}

/** The file as it would be committed, in the order the editor shows it. */
export function exportIncome(state: IncomeEditorState): RawIncomeData {
  const slots = readNumber(state.slots) ?? INCOME_DATA.slots;
  return {
    bonusPerMatch: readNumber(state.bonusPerMatch) ?? INCOME_DATA.bonusPerMatch,
    slots,
    aptitudes: APTITUDES.map((aptitude) => ({
      id: aptitude.id,
      ...(aptitude.resource ? { resource: aptitude.resource } : {}),
    })),
    plays: state.plays.map((play): RawIncomePlay => {
      const own = readNumber(play.slots);
      const ticket = readNumber(play.ticket);
      const visitors = readNumber(play.visitors);
      return {
        id: play.id,
        rarity: play.rarity,
        ...(own !== undefined && own !== slots ? { slots: own } : {}),
        ...(ticket !== undefined ? { ticket } : {}),
        ...(visitors !== undefined ? { visitors } : {}),
        ...(play.aptitudes.length > 0 ? { aptitudes: [...play.aptitudes] } : {}),
      };
    }),
    goddesses: state.goddesses.map((goddess): GoddessAptitudes => ({
      name: goddess.name,
      aptitudes: [...goddess.aptitudes],
      ...(goddess.lacks.length > 0 ? { lacks: [...goddess.lacks] } : {}),
    })),
  };
}

/** How many plays still have no numbers, which is what this editor is for. */
export function missingNumbers(state: IncomeEditorState): EditorPlay[] {
  return state.plays.filter((play) => readNumber(play.ticket) === undefined || readNumber(play.visitors) === undefined);
}

export function countIncomeChanges(published: IncomeEditorState, draft: IncomeEditorState): number {
  const before = exportIncome(published);
  const after = exportIncome(draft);
  let changes = 0;
  if (before.bonusPerMatch !== after.bonusPerMatch) changes += 1;
  if (before.slots !== after.slots) changes += 1;

  const playsBefore = new Map(before.plays.map((play) => [play.id, JSON.stringify(play)]));
  for (const play of after.plays) {
    if (playsBefore.get(play.id) !== JSON.stringify(play)) changes += 1;
  }
  const goddessesBefore = new Map(before.goddesses.map((goddess) => [goddess.name, JSON.stringify(goddess)]));
  for (const goddess of after.goddesses) {
    if (goddessesBefore.get(goddess.name) !== JSON.stringify(goddess)) changes += 1;
  }
  return changes;
}

export type IncomeProblem =
  | { code: "unknownPlay"; id: string }
  | { code: "halfRow"; id: string }
  | { code: "tooManyAptitudes"; name: string; count: number }
  | { code: "contradiction"; name: string; aptitude: string };

export function findIncomeProblems(state: IncomeEditorState): IncomeProblem[] {
  const problems: IncomeProblem[] = [];
  const known = new Set(THEATER_PLAYS.map((play) => play.id));
  for (const play of state.plays) {
    if (!known.has(play.id)) problems.push({ code: "unknownPlay", id: play.id });
    const ticket = readNumber(play.ticket);
    const visitors = readNumber(play.visitors);
    // One number without the other cannot be computed with, so it is worse
    // than neither: the play looks known and is not.
    if ((ticket === undefined) !== (visitors === undefined)) problems.push({ code: "halfRow", id: play.id });
  }
  for (const goddess of state.goddesses) {
    if (goddess.aptitudes.length > APTITUDES_PER_GODDESS) {
      problems.push({ code: "tooManyAptitudes", name: goddess.name, count: goddess.aptitudes.length });
    }
    for (const aptitude of goddess.aptitudes) {
      if (goddess.lacks.includes(aptitude)) {
        problems.push({ code: "contradiction", name: goddess.name, aptitude });
      }
    }
  }
  return problems;
}

/** One play per line, so a changed number shows up as one changed line. */
export function serializeIncomeData(data: RawIncomeData): string {
  const list = (rows: readonly unknown[]) => rows.map((row) => `    ${JSON.stringify(row)}`).join(",\n");
  return [
    "{",
    `  "bonusPerMatch": ${data.bonusPerMatch},`,
    `  "slots": ${data.slots},`,
    '  "aptitudes": [',
    list(data.aptitudes),
    "  ],",
    '  "plays": [',
    list(data.plays),
    "  ],",
    '  "goddesses": [',
    list(data.goddesses),
    "  ]",
    "}",
    "",
  ].join("\n");
}

export function parseIncomeDraft(raw: string | null): IncomeEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as IncomeEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number") return null;
    if (!Array.isArray(value.plays) || !Array.isArray(value.goddesses)) return null;
    const ids = new Set<string>(APTITUDE_IDS);
    const rarities = new Set<string>(PLAY_RARITIES);
    for (const play of value.plays) {
      if (typeof play?.uid !== "string" || typeof play.id !== "string") return null;
      if (!rarities.has(play.rarity)) return null;
      if (typeof play.ticket !== "string" || typeof play.visitors !== "string" || typeof play.slots !== "string") return null;
      if (!Array.isArray(play.aptitudes) || play.aptitudes.some((entry) => !ids.has(entry))) return null;
    }
    for (const goddess of value.goddesses) {
      if (typeof goddess?.uid !== "string" || typeof goddess.name !== "string") return null;
      if (!Array.isArray(goddess.aptitudes) || goddess.aptitudes.some((entry) => !ids.has(entry))) return null;
      if (!Array.isArray(goddess.lacks) || goddess.lacks.some((entry) => !ids.has(entry))) return null;
    }
    if (typeof value.bonusPerMatch !== "string" || typeof value.slots !== "string") return null;
    return value;
  } catch {
    return null;
  }
}

/** The numbers as they are published right now. */
export const PUBLISHED_INCOME = fromIncomeData({
  bonusPerMatch: INCOME_DATA.bonusPerMatch,
  slots: INCOME_DATA.slots,
  aptitudes: INCOME_DATA.aptitudes,
  plays: INCOME_DATA.plays.map((play): RawIncomePlay => ({
    id: play.id,
    rarity: play.rarity,
    ...(play.slots !== INCOME_DATA.slots ? { slots: play.slots } : {}),
    ...(play.ticket !== undefined ? { ticket: play.ticket } : {}),
    ...(play.visitors !== undefined ? { visitors: play.visitors } : {}),
    ...(play.aptitudes ? { aptitudes: play.aptitudes } : {}),
  })),
  goddesses: INCOME_DATA.goddesses,
});
