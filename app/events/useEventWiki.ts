"use client";

import { type EventWikiData, type EventWikiEntry } from "../../lib/content/event-guides";
import { useGuideData } from "../guides/GuideOverrides";

/**
 * The event help as the site serves it: the build, or a published replacement.
 *
 * Four pages show an event icon or its help, and all of them read it through
 * here, so a corrected rule reaches every one of them at once.
 */
export function useEventWiki(): readonly EventWikiEntry[] {
  return useGuideData<EventWikiData>("event-wiki").events;
}
