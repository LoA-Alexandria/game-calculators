import type { Dictionary } from "../i18n/index.ts";

/**
 * News entries. The text lives in the dictionaries so every language has it;
 * only the language-independent parts (id, date, optional link) are here.
 *
 * Adding an entry: write `newsEntries.<id>` in every dictionary, then add one
 * row below. Newest first.
 */
export type NewsEntry = {
  id: string;
  /** ISO date, formatted for the reader's language at render time. */
  date: string;
  /** Optional "read more" target, for example the tool the entry is about. */
  href?: string;
  title: (t: Dictionary) => string;
  summary: (t: Dictionary) => string;
  body: (t: Dictionary) => string[];
};

export const NEWS: NewsEntry[] = [
  {
    id: "relaunch",
    date: "2026-09-12",
    title: (t) => t.newsEntries.relaunch.title,
    summary: (t) => t.newsEntries.relaunch.summary,
    body: (t) => t.newsEntries.relaunch.body,
  },
  {
    id: "planner",
    date: "2026-09-12",
    href: "/simulations/irrigation-planner/",
    title: (t) => t.newsEntries.planner.title,
    summary: (t) => t.newsEntries.planner.summary,
    body: (t) => t.newsEntries.planner.body,
  },
];
