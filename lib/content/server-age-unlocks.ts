/**
 * Server age unlocks: when one-time events and age-locked features first appear
 * on a new server. Rows live in `lib/data/server-age-unlocks.json` (English);
 * `guideEntries.serverAgeUnlocks.eventTexts` can override wording per language.
 * An optional `image` names a file in `public/server-age-unlocks/`.
 */

import data from "../data/server-age-unlocks.json" with { type: "json" };
import { asset } from "../site.ts";
import type { GuideEntryId } from "./guides.ts";

export type AgeEvent = {
  id: string;
  name: string;
  detail?: string;
  /** Longer blurb shown on hover / focus. */
  description?: string;
  oneTime?: boolean;
  relatedGuide?: GuideEntryId;
  /** File name in `public/server-age-unlocks/`. */
  image?: string;
};

export type AgeMilestone = {
  id: string;
  /** Exact server day when known. */
  day?: number;
  /** Free-form label when the day is a range or uncertain. */
  label?: string;
  events: AgeEvent[];
};

export type AgeUnlockText = {
  name?: string;
  detail?: string;
  label?: string;
  description?: string;
};
export type AgeUnlockTexts = Record<string, AgeUnlockText>;

export type AgeUnlocksData = {
  milestones: AgeMilestone[];
  unconfirmed: AgeEvent[];
};

/** JSON has no string literal types; tests check related guides and ids. */
export const AGE_UNLOCKS_DATA = data as AgeUnlocksData;

/** Ordered server-age milestones from Autumn’s Discord guide (14 Sep 2026). */
export const AGE_MILESTONES: readonly AgeMilestone[] = AGE_UNLOCKS_DATA.milestones;

/** Features whose unlock day is still unknown. */
export const AGE_UNCONFIRMED: readonly AgeEvent[] = AGE_UNLOCKS_DATA.unconfirmed;

const pick = (own: string | undefined, english: string | undefined) => own?.trim() || english?.trim() || "";

export function eventName(event: AgeEvent, texts: AgeUnlockTexts): string {
  return pick(texts[event.id]?.name, event.name) || event.name;
}

export function eventDetail(event: AgeEvent, texts: AgeUnlockTexts): string | null {
  const detail = pick(texts[event.id]?.detail, event.detail);
  return detail || null;
}

export function eventDescription(event: AgeEvent, texts: AgeUnlockTexts): string | null {
  const description = pick(texts[event.id]?.description, event.description);
  return description || null;
}

/** Custom milestone wording, or null when the day template should be used. */
export function milestoneLabel(milestone: AgeMilestone, texts: AgeUnlockTexts): string | null {
  const override = pick(texts[milestone.id]?.label, milestone.label);
  return override || null;
}

export function eventImageUrl(file: string): string {
  return asset(`/server-age-unlocks/${file}`);
}

export function allAgeEvents(data: AgeUnlocksData = AGE_UNLOCKS_DATA): AgeEvent[] {
  return [...data.milestones.flatMap((milestone) => milestone.events), ...data.unconfirmed];
}
