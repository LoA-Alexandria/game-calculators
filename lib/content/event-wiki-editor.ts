/**
 * Pure state logic for the event help editor.
 *
 * What it holds is the in-game help the wiki publishes for each event: a lead
 * paragraph, then sections of bullet points, and whatever pictures the page
 * showed. It came from one fetch of the Events hub, so the file keeps the
 * address and the day it was taken — and the editor keeps them editable,
 * because the next person to correct a rule should say where the correction
 * came from.
 *
 * Bullets and pictures are typed one per line: a bullet is a sentence, and a
 * list of sentences is what a textarea is for.
 */

import {
  EVENT_WIKI_DATA,
  type EventWikiData,
  type EventWikiEntry,
  type EventWikiImage,
  type EventWikiSection,
} from "./event-guides.ts";

export type EditorWikiSection = {
  uid: string;
  heading: string;
  /** One bullet per line. */
  items: string;
};

export type EditorWikiEvent = {
  uid: string;
  id: string;
  wikiTitle: string;
  wikiUrl: string;
  icon: string;
  intro: string;
  /**
   * The wiki marks its own thin pages as stubs; six of ours are marked and
   * still carry help, so this says "the source page is thin", not "there is
   * nothing here".
   */
  stub: boolean;
  sections: EditorWikiSection[];
  /** `path | alt text`, one picture per line. */
  images: string;
};

export type WikiEditorState = {
  version: 1;
  source: string;
  fetched: string;
  events: EditorWikiEvent[];
  nextId: number;
};

export function linesOf(text: string): string[] {
  return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

/** `path | alt`, because a picture is a file and a sentence about it. */
export function imagesFrom(text: string): EventWikiImage[] {
  return linesOf(text).map((line) => {
    const at = line.indexOf("|");
    if (at < 0) return { src: line.trim(), alt: "" };
    return { src: line.slice(0, at).trim(), alt: line.slice(at + 1).trim() };
  });
}

export function imagesToText(images: readonly EventWikiImage[]): string {
  return images.map((image) => (image.alt ? `${image.src} | ${image.alt}` : image.src)).join("\n");
}

export function fromWikiData(data: EventWikiData): WikiEditorState {
  let nextId = 1;
  return {
    version: 1,
    source: data.source,
    fetched: data.fetched,
    events: data.events.map((entry) => ({
      uid: `e${nextId++}`,
      id: entry.id,
      wikiTitle: entry.wikiTitle,
      wikiUrl: entry.wikiUrl,
      icon: entry.icon ?? "",
      intro: entry.intro,
      stub: entry.stub,
      sections: entry.sections.map((section) => ({
        uid: `s${nextId++}`,
        heading: section.heading,
        items: section.items.join("\n"),
      })),
      images: imagesToText(entry.images),
    })),
    nextId,
  };
}

export function eventOf(state: WikiEditorState, uid: string): EditorWikiEvent | undefined {
  return state.events.find((entry) => entry.uid === uid);
}

function mapEvent(
  state: WikiEditorState,
  uid: string,
  change: (entry: EditorWikiEvent) => EditorWikiEvent,
): WikiEditorState {
  return { ...state, events: state.events.map((entry) => (entry.uid === uid ? change(entry) : entry)) };
}

export function setEvent(
  state: WikiEditorState,
  uid: string,
  patch: Partial<Omit<EditorWikiEvent, "uid" | "sections">>,
): WikiEditorState {
  return mapEvent(state, uid, (entry) => ({ ...entry, ...patch }));
}

export function setSource(state: WikiEditorState, patch: Partial<Pick<WikiEditorState, "source" | "fetched">>): WikiEditorState {
  return { ...state, ...patch };
}

export function addSection(state: WikiEditorState, uid: string): { state: WikiEditorState; uid: string } {
  const sectionUid = `s${state.nextId}`;
  return {
    state: mapEvent({ ...state, nextId: state.nextId + 1 }, uid, (entry) => ({
      ...entry,
      sections: [...entry.sections, { uid: sectionUid, heading: "", items: "" }],
    })),
    uid: sectionUid,
  };
}

export function removeSection(state: WikiEditorState, uid: string, sectionUid: string): WikiEditorState {
  return mapEvent(state, uid, (entry) => ({
    ...entry,
    sections: entry.sections.filter((section) => section.uid !== sectionUid),
  }));
}

export function setSection(
  state: WikiEditorState,
  uid: string,
  sectionUid: string,
  patch: Partial<Pick<EditorWikiSection, "heading" | "items">>,
): WikiEditorState {
  return mapEvent(state, uid, (entry) => ({
    ...entry,
    sections: entry.sections.map((section) => (section.uid === sectionUid ? { ...section, ...patch } : section)),
  }));
}

export function moveSection(state: WikiEditorState, uid: string, sectionUid: string, step: -1 | 1): WikiEditorState {
  return mapEvent(state, uid, (entry) => {
    const at = entry.sections.findIndex((section) => section.uid === sectionUid);
    const to = at + step;
    if (at < 0 || to < 0 || to >= entry.sections.length) return entry;
    const sections = [...entry.sections];
    [sections[at], sections[to]] = [sections[to], sections[at]];
    return { ...entry, sections };
  });
}

/** The file as it would be committed, in the order the editor shows it. */
export function exportWiki(state: WikiEditorState): EventWikiData {
  return {
    source: state.source.trim(),
    fetched: state.fetched.trim(),
    events: state.events.map((entry): EventWikiEntry => ({
      id: entry.id.trim(),
      wikiTitle: entry.wikiTitle.trim(),
      wikiUrl: entry.wikiUrl.trim(),
      icon: entry.icon.trim() || null,
      intro: entry.intro.trim(),
      sections: entry.sections
        .map((section): EventWikiSection => ({ heading: section.heading.trim(), items: linesOf(section.items) }))
        // A heading somebody started is kept — it is their typing, and the
        // editor names it rather than eating it. Only a wholly empty row goes.
        .filter((section) => section.heading || section.items.length > 0),
      images: imagesFrom(entry.images),
      stub: entry.stub,
    })),
  };
}

export function countWikiChanges(published: WikiEditorState, draft: WikiEditorState): number {
  const before = exportWiki(published);
  const after = exportWiki(draft);
  let changes = 0;
  if (before.source !== after.source || before.fetched !== after.fetched) changes += 1;
  const was = new Map(before.events.map((entry) => [entry.id, JSON.stringify(entry)]));
  for (const entry of after.events) {
    if (was.get(entry.id) !== JSON.stringify(entry)) changes += 1;
  }
  for (const entry of before.events) {
    if (!after.events.some((other) => other.id === entry.id)) changes += 1;
  }
  return changes;
}

export type WikiProblem =
  | { code: "noId"; title: string }
  | { code: "duplicateId"; id: string }
  | { code: "emptySection"; event: string }
  | { code: "pictureWithoutAlt"; event: string; src: string }
  | { code: "strayPicture"; event: string; src: string };

export function findWikiProblems(state: WikiEditorState): WikiProblem[] {
  const problems: WikiProblem[] = [];
  const seen = new Set<string>();
  for (const entry of state.events) {
    const id = entry.id.trim();
    if (!id) {
      problems.push({ code: "noId", title: entry.wikiTitle.trim() });
      continue;
    }
    if (seen.has(id)) problems.push({ code: "duplicateId", id });
    seen.add(id);

    const title = entry.wikiTitle.trim() || id;
    for (const section of entry.sections) {
      if (section.heading.trim() && linesOf(section.items).length === 0) {
        problems.push({ code: "emptySection", event: title });
      }
    }
    for (const image of imagesFrom(entry.images)) {
      // A picture on a page a screen reader cannot see is a picture nobody
      // described; the pages show these inside the help text.
      if (!image.alt) problems.push({ code: "pictureWithoutAlt", event: title, src: image.src });
      if (!image.src.startsWith("/")) problems.push({ code: "strayPicture", event: title, src: image.src });
    }
  }
  return problems;
}

/** How many events still have no help at all, which is what the stub flag marks. */
export function eventsWithoutHelp(state: WikiEditorState): string[] {
  return state.events
    .filter((entry) => !entry.intro.trim() && entry.sections.every((section) => linesOf(section.items).length === 0))
    .map((entry) => entry.wikiTitle.trim() || entry.id);
}

/** Indented the way the file is committed, so an export diffs line by line. */
export function serializeWiki(data: EventWikiData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function parseWikiDraft(raw: string | null): WikiEditorState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as WikiEditorState;
    if (value?.version !== 1 || typeof value.nextId !== "number" || !Array.isArray(value.events)) return null;
    if (typeof value.source !== "string" || typeof value.fetched !== "string") return null;
    for (const entry of value.events) {
      if (typeof entry?.uid !== "string" || typeof entry.id !== "string") return null;
      for (const key of ["wikiTitle", "wikiUrl", "icon", "intro", "images"] as const) {
        if (typeof entry[key] !== "string") return null;
      }
      if (typeof entry.stub !== "boolean" || !Array.isArray(entry.sections)) return null;
      for (const section of entry.sections) {
        if (typeof section?.uid !== "string") return null;
        if (typeof section.heading !== "string" || typeof section.items !== "string") return null;
      }
    }
    return value;
  } catch {
    return null;
  }
}

/** The help as it is published right now. */
export const PUBLISHED_WIKI = fromWikiData(EVENT_WIKI_DATA);
