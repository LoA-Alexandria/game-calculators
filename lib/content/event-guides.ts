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

export type EventWikiData = { source: string; fetched: string; events: EventWikiEntry[] };

export const EVENT_WIKI_DATA = data as EventWikiData;
const ENTRIES = EVENT_WIKI_DATA.events;
const BY_ID = new Map(ENTRIES.map((entry) => [entry.id, entry]));

/** One entry, from the built file or from what the site serves. */
function entryOf(id: string, entries: readonly EventWikiEntry[]): EventWikiEntry | undefined {
  return entries === ENTRIES ? BY_ID.get(id) : entries.find((entry) => entry.id === id);
}
const EVENT_ICON_OVERRIDES: Record<string, string> = {
  // The event write-up predates the wiki icon field; use the local original icon.
  redCarpet: "/events/red-carpet.svg",
};

export const EVENT_WIKI_SOURCE = data.source;
export const EVENT_WIKI_FETCHED = data.fetched;

/** `entries` defaults to the built file; a page passes the published ones. */
export function eventWiki(id: string, entries: readonly EventWikiEntry[] = ENTRIES): EventWikiEntry | undefined {
  return entryOf(id, entries);
}

/** Public path for a nav or index icon, from the wiki or a local override. */
export function eventWikiIcon(id: string, entries: readonly EventWikiEntry[] = ENTRIES): string | undefined {
  return entryOf(id, entries)?.icon ?? EVENT_ICON_OVERRIDES[id];
}

export function eventWikiIconUrl(id: string, entries: readonly EventWikiEntry[] = ENTRIES): string | undefined {
  const icon = eventWikiIcon(id, entries);
  return icon ? asset(icon) : undefined;
}

export function eventWikiHasHelp(id: string, entries: readonly EventWikiEntry[] = ENTRIES): boolean {
  const entry = entryOf(id, entries);
  if (!entry) return false;
  return Boolean(entry.intro || entry.sections.length > 0);
}

export function allEventWikiEntries(entries: readonly EventWikiEntry[] = ENTRIES): readonly EventWikiEntry[] {
  return entries;
}
