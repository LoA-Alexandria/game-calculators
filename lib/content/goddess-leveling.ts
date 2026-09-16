/**
 * Goddess upgrade order: which goddess to raise to which level, phase by
 * phase. It used to sit at the bottom of the Goddesses guide and is now its
 * own guide under Tips and tricks, edited at `/guides/goddess-leveling/edit/`.
 *
 * Phases and rows live in `lib/data/goddess-leveling.json`. A row names a
 * goddess by her roster id, or `null` for everyone the phases have not named.
 * `target` and `withoutSsr` are levels as the game writes them ("180",
 * "30 → 60 → 90 → max"), so they are the same in every language. The English
 * subtitle and lede of a phase are in the JSON; other languages override them
 * in `guideEntries.goddessLeveling.phaseTexts`, keyed by phase id.
 *
 * The order is the community table the Goddesses guide already published,
 * not the wiki's level list (wiki phase 2 takes Fortuna and Bastet to 90).
 */

import data from "../data/goddess-leveling.json" with { type: "json" };

export type LevelingRow = {
  /** Roster id, or null for every goddess not named in the phases. */
  goddess: string | null;
  target: string;
  /** Where to stop while she has no SSR skin, when that differs. */
  withoutSsr?: string;
};

export type LevelingPhase = {
  id: string;
  subtitle: string;
  lede: string;
  rows: LevelingRow[];
};

export type GoddessLevelingData = { phases: LevelingPhase[] };

export type PhaseTexts = Record<string, { subtitle?: string; lede?: string }>;

export const GODDESS_LEVELING_DATA = data as GoddessLevelingData;

/** Subtitle and lede in the reader's language, falling back to English per field. */
export function localizedPhase(phase: LevelingPhase, texts: PhaseTexts): { subtitle: string; lede: string } {
  const local = texts[phase.id];
  return {
    subtitle: local?.subtitle?.trim() || phase.subtitle,
    lede: local?.lede?.trim() || phase.lede,
  };
}

/** Colour of a phase card: the four tones repeat when there are more phases. */
export function phaseTone(index: number): string {
  return String((index % 4) + 1);
}
