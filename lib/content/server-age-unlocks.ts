import data from "../data/server-age-unlocks.json" with { type: "json" };
import type { GuideEntryId } from "./guides.ts";

export type AgeEvent = {
  id: string;
  name: string;
  detail?: string;
  oneTime?: boolean;
  relatedGuide?: GuideEntryId;
};

export type AgeMilestone = {
  id: string;
  /** Exact server day when known. */
  day?: number;
  /** Free-form label when the day is a range or uncertain. */
  label?: string;
  events: AgeEvent[];
};

export type AgeUnlockTexts = Record<
  string,
  { name?: string; detail?: string; label?: string }
>;

type AgeUnlocksFile = {
  milestones: AgeMilestone[];
  unconfirmed: AgeEvent[];
};

const FILE = data as AgeUnlocksFile;

/** Ordered server-age milestones from Autumn’s Discord guide (14 Sep 2026). */
export const AGE_MILESTONES: readonly AgeMilestone[] = FILE.milestones;

/** Features whose unlock day is still unknown. */
export const AGE_UNCONFIRMED: readonly AgeEvent[] = FILE.unconfirmed;

export function eventName(event: AgeEvent, texts: AgeUnlockTexts): string {
  return texts[event.id]?.name?.trim() || event.name;
}

export function eventDetail(event: AgeEvent, texts: AgeUnlockTexts): string | null {
  const detail = texts[event.id]?.detail?.trim() || event.detail?.trim();
  return detail || null;
}

/** Custom milestone wording, or null when the day template should be used. */
export function milestoneLabel(milestone: AgeMilestone, texts: AgeUnlockTexts): string | null {
  const override = texts[milestone.id]?.label?.trim();
  if (override) return override;
  if (milestone.label) return milestone.label;
  return null;
}
