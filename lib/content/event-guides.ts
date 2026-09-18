/**
 * Event write-up extras from the Pop Epoch wiki Events hub
 * (https://pop-epoch-help.fandom.com/wiki/Events), last merged on 18 September
 * 2026. Square help icons live in `public/events/`. In-game help text is English
 * in `lib/data/event-wiki.json`; Discord community tips stay in
 * `eventGuideEntries`. Typical wiki rules; rewards and schedules can change by
 * season.
 */

import data from "../data/event-wiki.json" with { type: "json" };
import { asset } from "../site.ts";

export type EventWikiSection = {
  heading: string;
  items: string[];
};

export type EventWikiImage = {
  src: string;
  alt: string;
};

export type EventWikiEntry = {
  id: string;
  wikiTitle: string;
  wikiUrl: string;
  icon: string | null;
  intro: string;
  sections: EventWikiSection[];
  images: EventWikiImage[];
  stub: boolean;
};

const ENTRIES = data.events as EventWikiEntry[];
const BY_ID = new Map(ENTRIES.map((entry) => [entry.id, entry]));

export const EVENT_WIKI_SOURCE = data.source;
export const EVENT_WIKI_FETCHED = data.fetched;

export function eventWiki(id: string): EventWikiEntry | undefined {
  return BY_ID.get(id);
}

/** Public path (`/events/….webp`) for a nav or index icon, if the wiki had one. */
export function eventWikiIcon(id: string): string | undefined {
  return BY_ID.get(id)?.icon ?? undefined;
}

export function eventWikiIconUrl(id: string): string | undefined {
  const icon = eventWikiIcon(id);
  return icon ? asset(icon) : undefined;
}

export function eventWikiHasHelp(id: string): boolean {
  const entry = BY_ID.get(id);
  if (!entry) return false;
  return Boolean(entry.intro || entry.sections.length > 0);
}

export function allEventWikiEntries(): readonly EventWikiEntry[] {
  return ENTRIES;
}
